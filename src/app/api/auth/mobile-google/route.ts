export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user as userTable, session as sessionTable, account as accountTable, userProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { toPublicUrl } from "@/lib/storage";
import { getClientIp } from "@/lib/getClientIp";
import { trackSession } from "@/lib/sessionMeta";
import { randomUUID, randomBytes } from "crypto";
import { z } from "zod";

const MobileGoogleBodySchema = z.union([
  z.object({
    idToken: z.string().min(1, "Google ID token is required"),
  }),
  z.object({
    code: z.string().min(1, "Authorization code is required"),
    redirectUri: z.string().min(1, "Redirect URI is required"),
    codeVerifier: z.string().optional(),
  }),
]);

interface GoogleTokenInfo {
  iss?: string;
  sub?: string;
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  exp?: string;
  error_description?: string;
  error?: string;
}

/**
 * POST /api/auth/mobile-google
 *
 * Verifies a Google ID token from Expo / native mobile clients directly,
 * or exchanges a PKCE authorization code with Google using server credentials.
 * Validates the Google account, creates or finds the user and account records,
 * and issues a fresh 7-day session token.
 *
 * Eliminates website browser redirects, custom tab web pages, and cookie state mismatches.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = MobileGoogleBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    let idToken = "";

    if ("idToken" in parsed.data) {
      idToken = parsed.data.idToken;
    } else {
      const { code, redirectUri, codeVerifier } = parsed.data;
      const isNativeIos = redirectUri.startsWith("com.googleusercontent.apps.");
      const isNativeAndroid = redirectUri.startsWith("exp://") || (!redirectUri.startsWith("http://") && !redirectUri.startsWith("https://"));

      const effectiveClientId = isNativeIos
        ? (process.env.GOOGLE_IOS_CLIENT_ID || "").trim()
        : isNativeAndroid && process.env.GOOGLE_ANDROID_CLIENT_ID
          ? (process.env.GOOGLE_ANDROID_CLIENT_ID || "").trim()
          : (process.env.GOOGLE_CLIENT_ID || "").trim();

      const params = new URLSearchParams({
        code,
        client_id: effectiveClientId,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });

      // Public clients (iOS/Android native apps) do not use client_secret
      if (!isNativeIos && !isNativeAndroid) {
        const serverGoogleClientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
        if (serverGoogleClientSecret) {
          params.append("client_secret", serverGoogleClientSecret);
        }
      }

      if (codeVerifier) {
        params.append("code_verifier", codeVerifier);
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: errData.error_description || errData.error || "Failed to exchange authorization code with Google" },
          { status: 401 }
        );
      }

      const tokenData = await tokenRes.json();
      if (!tokenData.id_token) {
        return NextResponse.json({ error: "Google did not return an ID token" }, { status: 401 });
      }
      idToken = tokenData.id_token;
    }

    // 1. Verify Google ID token via Google's official TokenInfo endpoint
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!googleRes.ok) {
      const errData = await googleRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData.error_description || "Invalid Google ID token" },
        { status: 401 }
      );
    }

    const tokenInfo: GoogleTokenInfo = await googleRes.json();

    // 2. Security Assertions: Issuer & Expiration
    const validIssuers = ["https://accounts.google.com", "accounts.google.com"];
    if (!tokenInfo.iss || !validIssuers.includes(tokenInfo.iss)) {
      return NextResponse.json({ error: "Invalid token issuer" }, { status: 401 });
    }

    const expSeconds = parseInt(tokenInfo.exp || "0", 10);
    if (isNaN(expSeconds) || expSeconds * 1000 <= Date.now()) {
      return NextResponse.json({ error: "Google token has expired" }, { status: 401 });
    }

    // 3. Security Assertion: Audience
    const serverGoogleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
    const allowedAudiences = [
      serverGoogleClientId,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
    ].filter((id): id is string => Boolean(id && id.trim().length > 0));

    if (allowedAudiences.length > 0 && (!tokenInfo.aud || !allowedAudiences.includes(tokenInfo.aud))) {
      return NextResponse.json(
        { error: "Google token audience mismatch" },
        { status: 401 }
      );
    }

    // 4. Require verified email
    const isEmailVerified = tokenInfo.email_verified === "true" || tokenInfo.email_verified === true;
    if (!isEmailVerified || !tokenInfo.email) {
      return NextResponse.json(
        { error: "Google account email is not verified" },
        { status: 403 }
      );
    }

    const email = tokenInfo.email.toLowerCase().trim();
    const googleSub = tokenInfo.sub || "";
    const name = tokenInfo.name || email.split("@")[0] || "User";
    const picture = tokenInfo.picture || null;

    let targetUserId = "";
    let finalDisplayName = name;
    let finalAvatarUrl = picture;

    // 5. Look up existing user by email
    const [existingUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);

    if (existingUser) {
      if (existingUser.banned) {
        return NextResponse.json(
          { error: "This account has been banned: " + (existingUser.banReason || "Policy violation") },
          { status: 403 }
        );
      }

      // Check user profile for disabled status safely
      let profile: { displayName: string | null; avatarUrl: string | null; disabled: boolean | null } | undefined;
      try {
        const [p] = await db
          .select({
            displayName: userProfiles.displayName,
            avatarUrl: userProfiles.avatarUrl,
            disabled: userProfiles.disabled,
          })
          .from(userProfiles)
          .where(eq(userProfiles.userId, existingUser.id))
          .limit(1);
        profile = p;
      } catch (profileErr) {
        console.warn("[POST /api/auth/mobile-google] Could not fetch profile details, continuing:", profileErr);
      }

      if (profile?.disabled) {
        return NextResponse.json(
          { error: "This account has been disabled by an administrator" },
          { status: 403 }
        );
      }

      targetUserId = existingUser.id;
      if (profile?.displayName) finalDisplayName = profile.displayName;
      if (profile?.avatarUrl) {
        finalAvatarUrl = toPublicUrl(profile.avatarUrl) || profile.avatarUrl;
      } else if (existingUser.image) {
        finalAvatarUrl = existingUser.image;
      }

      // Update user verified flag and image if not set
      await db
        .update(userTable)
        .set({
          emailVerified: true,
          updatedAt: new Date(),
          ...(picture && !existingUser.image ? { image: picture } : {}),
        })
        .where(eq(userTable.id, existingUser.id));

      // Ensure google account link exists in account table
      const [existingAccount] = await db
        .select()
        .from(accountTable)
        .where(and(eq(accountTable.providerId, "google"), eq(accountTable.userId, existingUser.id)))
        .limit(1);

      if (!existingAccount && googleSub) {
        await db.insert(accountTable).values({
          id: randomUUID(),
          accountId: googleSub,
          providerId: "google",
          userId: existingUser.id,
          idToken,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).catch(() => {});
      }
    } else {
      // 6. Auto-provision new user account
      const newUserId = randomUUID();
      const now = new Date();

      await db.insert(userTable).values({
        id: newUserId,
        name,
        email,
        emailVerified: true,
        image: picture,
        createdAt: now,
        updatedAt: now,
        role: "user",
        banned: false,
        twoFactorEnabled: false,
      });

      if (googleSub) {
        await db.insert(accountTable).values({
          id: randomUUID(),
          accountId: googleSub,
          providerId: "google",
          userId: newUserId,
          idToken,
          createdAt: now,
          updatedAt: now,
        }).catch(() => {});
      }

      await db.insert(userProfiles).values({
        userId: newUserId,
        displayName: name,
        avatarUrl: picture,
        lastPasswordChangedAt: null,
        storageUsedBytes: 0,
        storageQuotaBytes: 104857600, // 100 MB default
      }).onConflictDoNothing();

      targetUserId = newUserId;
      finalDisplayName = name;
      finalAvatarUrl = picture;
    }

    // 7. Generate a 7-day session token compatible with Better Auth bearer plugin
    const sessionId = randomUUID();
    const sessionToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(sessionTable).values({
      id: sessionId,
      token: sessionToken,
      userId: targetUserId,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: getClientIp(req) || "127.0.0.1",
      userAgent: req.headers.get("user-agent") || "VaultrMobile/1.0",
    });

    // Eagerly track device metadata for the new session
    trackSession(sessionId, targetUserId, req).catch(() => {});

    return NextResponse.json({
      success: true,
      token: sessionToken,
      user: {
        id: targetUserId,
        email,
        name: finalDisplayName,
        image: finalAvatarUrl,
        avatarUrl: finalAvatarUrl,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/auth/mobile-google]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

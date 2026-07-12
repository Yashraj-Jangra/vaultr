/**
 * src/lib/sessionMeta.ts
 *
 * Session metadata layer — extends Better Auth sessions with device info,
 * geo-location, and last-active tracking that Better Auth doesn't provide.
 *
 * Design decisions (from config):
 *  - Device parsing: ua-parser-js
 *  - Geo-location:  ip-api.com (free, no key, fire-and-forget)
 *  - Last-active:   DB-level 5-minute throttle (WHERE last_active_at < NOW() - 5min)
 *  - Idle expiry:   14 days — sessions idle longer are cleaned on next list call
 */

import { UAParser } from "ua-parser-js";
import { db } from "@/db";
import { session, sessionMeta, user } from "@/db/schema";
import { eq, and, sql, lt, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/getClientIp";

// ── Private IP ranges — skip geo-lookup for these ────────────────────────────
const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => r.test(ip));
}

// ── Device name parsing ───────────────────────────────────────────────────────
export function parseDeviceName(userAgent: string | null | undefined): {
  deviceName: string;
  browser: string;
  os: string;
} {
  if (!userAgent) {
    return { deviceName: "Unknown Device", browser: "Unknown", os: "Unknown" };
  }

  const parser = new UAParser(userAgent);
  const b = parser.getBrowser();
  const o = parser.getOS();

  const browserStr = [b.name, b.major ? b.major : b.version?.split(".")[0]]
    .filter(Boolean)
    .join(" ") || "Unknown Browser";

  const osStr = [o.name, o.version].filter(Boolean).join(" ") || "Unknown OS";

  return {
    deviceName: `${browserStr} on ${osStr}`,
    browser: browserStr,
    os: osStr,
  };
}

// ── Geo-lookup via ip-api.com ─────────────────────────────────────────────────
async function lookupGeo(ip: string): Promise<{ country: string; city: string } | null> {
  if (!ip || isPrivateIp(ip)) return null;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { status: string; country?: string; city?: string };
    if (data.status !== "success") return null;
    return {
      country: data.country ?? "",
      city:    data.city    ?? "",
    };
  } catch {
    return null;
  }
}

// ── Upsert session meta ───────────────────────────────────────────────────────
// Called from verifyUserToken on every authenticated request.
// Creates the row on first call; throttles last_active_at updates to 5 min
// at the DB level so concurrent requests don't all write.

export async function trackSession(
  sessionId: string,
  userId: string,
  req: NextRequest
): Promise<void> {
  const ip = getClientIp(req) ?? null;
  const ua = req.headers.get("user-agent");
  const { deviceName, browser, os } = parseDeviceName(ua);

  try {
    await db
      .insert(sessionMeta)
      .values({
        sessionId,
        userId,
        deviceName,
        browser,
        os,
        ipAddress: ip,
        lastActiveAt: sql`NOW()`,
        createdAt:    sql`NOW()`,
      })
      .onConflictDoUpdate({
        target: sessionMeta.sessionId,
        set: {
          // Only update last_active_at if it's older than 5 minutes
          lastActiveAt: sql`CASE WHEN ${sessionMeta.lastActiveAt} < NOW() - INTERVAL '5 minutes' THEN NOW() ELSE ${sessionMeta.lastActiveAt} END`,
        },
      });

    // Geo-lookup: fire-and-forget only on first insert (skip if we already have geo)
    if (ip && !isPrivateIp(ip)) {
      const [existing] = await db
        .select({ country: sessionMeta.country })
        .from(sessionMeta)
        .where(eq(sessionMeta.sessionId, sessionId))
        .limit(1);

      if (!existing?.country) {
        // Don't await — fire-and-forget so request isn't delayed
        lookupGeo(ip).then(async (geo) => {
          if (!geo) return;
          await db
            .update(sessionMeta)
            .set({ country: geo.country, city: geo.city })
            .where(eq(sessionMeta.sessionId, sessionId));
        }).catch(() => { /* non-critical */ });
      }
    }
  } catch (err) {
    // Non-critical — never let session tracking break auth
    console.error("[sessionMeta] trackSession failed:", err);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionWithMeta {
  sessionId:     string;
  createdAt:     Date;
  expiresAt:     Date;
  isCurrent:     boolean;
  deviceName:    string;
  browser:       string;
  os:            string;
  ipAddress:     string | null;
  country:       string | null;
  city:          string | null;
  lastActiveAt:  Date | null;
}

export interface AdminSessionRow extends SessionWithMeta {
  userId:      string;
  userEmail:   string;
  userName:    string;
}

// ── List sessions for a user ──────────────────────────────────────────────────

export async function getUserSessions(
  userId: string,
  currentSessionId: string
): Promise<SessionWithMeta[]> {
  const IDLE_CUTOFF = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      sessionId:    session.id,
      createdAt:    session.createdAt,
      expiresAt:    session.expiresAt,
      deviceName:   sessionMeta.deviceName,
      browser:      sessionMeta.browser,
      os:           sessionMeta.os,
      ipAddress:    sessionMeta.ipAddress,
      country:      sessionMeta.country,
      city:         sessionMeta.city,
      lastActiveAt: sessionMeta.lastActiveAt,
    })
    .from(session)
    .leftJoin(sessionMeta, eq(session.id, sessionMeta.sessionId))
    .where(
      and(
        eq(session.userId, userId),
        // Filter out expired sessions
        sql`${session.expiresAt} > NOW()`,
        // Filter out sessions idle more than 14 days
        sql`COALESCE(${sessionMeta.lastActiveAt}, ${session.createdAt}) > ${IDLE_CUTOFF.toISOString()}`
      )
    )
    .orderBy(sql`COALESCE(${sessionMeta.lastActiveAt}, ${session.createdAt}) DESC`);

  return rows.map((r) => ({
    sessionId:    r.sessionId,
    createdAt:    r.createdAt,
    expiresAt:    r.expiresAt,
    isCurrent:    r.sessionId === currentSessionId,
    deviceName:   r.deviceName ?? "Unknown Device",
    browser:      r.browser    ?? "Unknown",
    os:           r.os         ?? "Unknown",
    ipAddress:    r.ipAddress  ?? null,
    country:      r.country    ?? null,
    city:         r.city       ?? null,
    lastActiveAt: r.lastActiveAt ?? null,
  }));
}

// ── List ALL sessions (admin view) ────────────────────────────────────────────

export async function getAllSessions(opts: {
  limit:   number;
  offset:  number;
  search?: string;
}): Promise<{ sessions: AdminSessionRow[]; total: number }> {
  const { limit, offset, search } = opts;

  const baseConditions = [sql`${session.expiresAt} > NOW()`];
  if (search) {
    const like = `%${search.toLowerCase()}%`;
    baseConditions.push(
      sql`(LOWER(${user.email}) LIKE ${like} OR LOWER(${user.name}) LIKE ${like})`
    );
  }

  const whereClause = baseConditions.reduce((acc, c) => sql`${acc} AND ${c}`);

  const [countRow] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(whereClause);

  const total = parseInt(countRow?.count ?? "0", 10);

  const rows = await db
    .select({
      sessionId:    session.id,
      createdAt:    session.createdAt,
      expiresAt:    session.expiresAt,
      userId:       user.id,
      userEmail:    user.email,
      userName:     user.name,
      deviceName:   sessionMeta.deviceName,
      browser:      sessionMeta.browser,
      os:           sessionMeta.os,
      ipAddress:    sessionMeta.ipAddress,
      country:      sessionMeta.country,
      city:         sessionMeta.city,
      lastActiveAt: sessionMeta.lastActiveAt,
    })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .leftJoin(sessionMeta, eq(session.id, sessionMeta.sessionId))
    .where(whereClause)
    .orderBy(sql`COALESCE(${sessionMeta.lastActiveAt}, ${session.createdAt}) DESC`)
    .limit(limit)
    .offset(offset);

  return {
    total,
    sessions: rows.map((r) => ({
      sessionId:    r.sessionId,
      createdAt:    r.createdAt,
      expiresAt:    r.expiresAt,
      isCurrent:    false,
      userId:       r.userId,
      userEmail:    r.userEmail,
      userName:     r.userName,
      deviceName:   r.deviceName ?? "Unknown Device",
      browser:      r.browser    ?? "Unknown",
      os:           r.os         ?? "Unknown",
      ipAddress:    r.ipAddress  ?? null,
      country:      r.country    ?? null,
      city:         r.city       ?? null,
      lastActiveAt: r.lastActiveAt ?? null,
    })),
  };
}

// ── Terminate a single session ────────────────────────────────────────────────

export async function terminateSession(sessionId: string): Promise<void> {
  // Deleting from Better Auth's session table cascades to session_meta
  await db.delete(session).where(eq(session.id, sessionId));
}

// ── Terminate all sessions for a user (except optionally the current one) ─────

export async function terminateUserSessions(
  userId: string,
  exceptSessionId?: string
): Promise<{ terminated: number }> {
  const conditions = [eq(session.userId, userId)];
  
  // Build query based on whether we're excluding current session
  const rows = await db
    .select({ id: session.id })
    .from(session)
    .where(eq(session.userId, userId));

  const toDelete = exceptSessionId
    ? rows.filter((r) => r.id !== exceptSessionId).map((r) => r.id)
    : rows.map((r) => r.id);

  if (toDelete.length > 0) {
    await db.delete(session).where(inArray(session.id, toDelete));
  }

  return { terminated: toDelete.length };
}

// ── Get session count per user (for admin user list badge) ───────────────────

export async function getActiveSessionCounts(userIds: string[]): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};

  const rows = await db
    .select({
      userId: session.userId,
      count:  sql<string>`COUNT(*)`,
    })
    .from(session)
    .where(
      and(
        inArray(session.userId, userIds),
        sql`${session.expiresAt} > NOW()`
      )
    )
    .groupBy(session.userId);

  return Object.fromEntries(rows.map((r) => [r.userId, parseInt(r.count, 10)]));
}

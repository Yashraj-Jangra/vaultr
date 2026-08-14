export const runtime = "nodejs";

/**
 * /api/vault/folders
 *
 * GET    — list all folders for the current user (items + custom empty folders) with counts
 * POST   — create a new folder (adds to user_profiles.custom_folders)
 * PATCH  — rename a folder (updates items & user_profiles.custom_folders)
 * DELETE — delete a folder (updates/trashes items & removes from user_profiles.custom_folders)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems, userProfiles } from "@/db/schema";
import { eq, and, isNotNull, sql, or, like, isNull } from "drizzle-orm";
import { z } from "zod";

const CreateFolderSchema = z.object({
  name: z.string().min(1).max(100),
});

const RenameFolderSchema = z.object({
  from: z.string().min(1).max(100),
  to: z.string().min(1).max(100),
});

const DeleteFolderSchema = z.object({
  name: z.string().min(1).max(100),
  disposition: z.enum(["uncategorize", "trash"]).default("uncategorize"),
});

async function getStoredCustomFolders(userId: string): Promise<string[]> {
  try {
    const profile = await db
      .select({ customFolders: userProfiles.customFolders })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return (profile[0]?.customFolders || []).filter(
      (f): f is string => typeof f === "string" && f.trim().length > 0
    );
  } catch (err) {
    console.warn("[getStoredCustomFolders] Error reading customFolders:", err);
    return [];
  }
}

async function setStoredCustomFolders(userId: string, customFolders: string[]): Promise<string[]> {
  try {
    const unique = Array.from(new Set(customFolders)).sort();
    await db
      .insert(userProfiles)
      .values({
        userId: userId,
        customFolders: unique,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { customFolders: unique },
      });
    return unique;
  } catch (err) {
    console.warn("[setStoredCustomFolders] Error setting customFolders:", err);
    return customFolders;
  }
}

// ── GET: list folders with counts (including empty custom folders) ─────────────
export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);

    // 1. Get active item folder counts
    const rows = await db
      .select({
        folder: vaultItems.folder,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(vaultItems)
      .where(
        and(
          eq(vaultItems.userId, user.id),
          isNotNull(vaultItems.folder),
          isNull(vaultItems.deletedAt)
        )
      )
      .groupBy(vaultItems.folder);

    const folderMap = new Map<string, number>();
    rows.forEach((r) => {
      if (r.folder) folderMap.set(r.folder, r.count);
    });

    // 2. Get user custom folders
    const customList = await getStoredCustomFolders(user.id);
    customList.forEach((cf) => {
      if (cf && typeof cf === "string") {
        const parts = cf.split("/").filter(Boolean);
        for (let i = 1; i <= parts.length; i++) {
          const path = parts.slice(0, i).join("/");
          if (!folderMap.has(path)) {
            folderMap.set(path, 0);
          }
        }
      }
    });

    const folders = Array.from(folderMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ folders });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/vault/folders]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── POST: create a new empty folder ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();

    const parsed = CreateFolderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const trimmed = parsed.data.name.trim();
    const segments = trimmed.split("/").filter(Boolean);
    if (segments.length > 3) {
      return NextResponse.json(
        { error: "Folder paths can have at most 3 levels (e.g. Work/Projects/Alpha)" },
        { status: 422 }
      );
    }

    const fullPath = segments.join("/");
    const newPaths: string[] = [];
    for (let i = 1; i <= segments.length; i++) {
      newPaths.push(segments.slice(0, i).join("/"));
    }

    const current = await getStoredCustomFolders(user.id);
    const updatedCustom = await setStoredCustomFolders(user.id, [...current, ...newPaths]);

    return NextResponse.json({ success: true, folder: fullPath, customFolders: updatedCustom });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/vault/folders]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── PATCH: rename a folder (including all subfolders) ──────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();

    const parsed = RenameFolderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { from, to } = parsed.data;

    if (from === to) {
      return NextResponse.json({ updated: 0 });
    }

    const segments = to.split("/").filter(Boolean);
    if (segments.length > 3) {
      return NextResponse.json(
        { error: "Folder paths can have at most 3 levels (e.g. Work/Projects/Alpha)" },
        { status: 422 }
      );
    }

    const fromPrefix = `${from}/`;
    const fromLen = from.length + 1; // 1-indexed for Postgres substring

    const updated = await db
      .update(vaultItems)
      .set({
        folder: sql`CASE 
          WHEN ${vaultItems.folder} = ${from} THEN ${to}::text
          WHEN ${vaultItems.folder} LIKE ${fromPrefix + "%"} THEN ${to} || substring(${vaultItems.folder} from ${fromLen})
          ELSE ${vaultItems.folder}
        END`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vaultItems.userId, user.id),
          or(
            eq(vaultItems.folder, from),
            like(vaultItems.folder, `${fromPrefix}%`)
          )
        )
      )
      .returning({ id: vaultItems.id });

    // Also rename in userProfiles.customFolders
    const currentCustom = await getStoredCustomFolders(user.id);
    const updatedCustomList = currentCustom.map((f) => {
      if (f === from) return to;
      if (f.startsWith(fromPrefix)) return `${to}/${f.slice(fromPrefix.length)}`;
      return f;
    });

    const uniqueCustom = await setStoredCustomFolders(user.id, updatedCustomList);

    return NextResponse.json({ updated: updated.length, customFolders: uniqueCustom });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/vault/folders]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── DELETE: delete a folder (including all subfolders) ─────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const body = await req.json();

    const parsed = DeleteFolderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { name, disposition } = parsed.data;
    const now = new Date();
    const namePrefix = `${name}/`;

    let updatePayload: Partial<typeof vaultItems.$inferInsert>;

    if (disposition === "trash") {
      updatePayload = { deletedAt: now, updatedAt: now };
    } else {
      updatePayload = { folder: null, updatedAt: now };
    }

    const updated = await db
      .update(vaultItems)
      .set(updatePayload)
      .where(
        and(
          eq(vaultItems.userId, user.id),
          or(
            eq(vaultItems.folder, name),
            like(vaultItems.folder, `${namePrefix}%`)
          )
        )
      )
      .returning({ id: vaultItems.id });

    // Also remove from userProfiles.customFolders
    const currentCustom = await getStoredCustomFolders(user.id);
    const updatedCustomList = currentCustom.filter(
      (f) => f !== name && !f.startsWith(namePrefix)
    );

    const uniqueCustom = await setStoredCustomFolders(user.id, updatedCustomList);

    return NextResponse.json({ updated: updated.length, disposition, customFolders: uniqueCustom });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[DELETE /api/vault/folders]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const runtime = "nodejs";

/**
 * /api/vault/folders
 *
 * GET    — list all folders for the current user with item counts
 * PATCH  — rename a folder (bulk-updates all items with old name to new name)
 * DELETE — delete a folder (moves items to uncategorized or trashes them)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth/verifyUser";
import { db } from "@/db";
import { vaultItems } from "@/db/schema";
import { eq, and, isNotNull, sql, or, like } from "drizzle-orm";
import { z } from "zod";

const RenameFolderSchema = z.object({
  from: z.string().min(1).max(100),
  to: z.string().min(1).max(100),
});

const DeleteFolderSchema = z.object({
  name: z.string().min(1).max(100),
  disposition: z.enum(["uncategorize", "trash"]).default("uncategorize"),
});

// ── GET: list folders with counts ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);

    const rows = await db
      .select({
        folder: vaultItems.folder,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(vaultItems)
      .where(and(eq(vaultItems.userId, user.id), isNotNull(vaultItems.folder)))
      .groupBy(vaultItems.folder);

    const folders = rows
      .filter((r) => r.folder !== null)
      .map((r) => ({ name: r.folder as string, count: r.count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ folders });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/vault/folders]", err);
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

    // Validate target name (max 3 path segments)
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

    return NextResponse.json({ updated: updated.length });
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
      // Soft-delete all items in this folder and its subfolders
      updatePayload = { deletedAt: now, updatedAt: now };
    } else {
      // Uncategorize: remove folder assignment
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

    return NextResponse.json({ updated: updated.length, disposition });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[DELETE /api/vault/folders]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

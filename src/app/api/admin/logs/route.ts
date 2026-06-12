import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import type { AuditLogEntry } from "@/lib/auditLog";

const LOG_DIR = join(process.cwd(), "logs", "security");

/** Returns YYYY-MM-DD strings for all available log files, newest first. */
function getAvailableDates(): string[] {
  if (!existsSync(LOG_DIR)) return [];
  try {
    return readdirSync(LOG_DIR)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.replace(".jsonl", ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** Parses a JSONL log file into an array of entries, newest-first. */
function readLogFile(date: string): AuditLogEntry[] {
  const filePath = join(LOG_DIR, `${date}.jsonl`);
  if (!existsSync(filePath)) return [];
  try {
    const content = readFileSync(filePath, "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as AuditLogEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is AuditLogEntry => e !== null)
      .reverse(); // newest first
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    const { searchParams } = new URL(req.url);

    // ── Return list of available log dates
    if (searchParams.get("dates") === "1") {
      return NextResponse.json({ dates: getAvailableDates() });
    }

    const date =
      searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const uid        = searchParams.get("uid")   ?? "";
    const event      = searchParams.get("event") ?? "";
    const q          = searchParams.get("q")     ?? "";
    const limit      = Math.min(Number(searchParams.get("limit")  ?? 200), 1000);
    const offset     = Number(searchParams.get("offset") ?? 0);

    let entries = readLogFile(date);

    // ── Filters
    if (uid)   entries = entries.filter((e) => e.uid === uid);
    if (event) entries = entries.filter((e) => e.event === event);
    if (q) {
      const lower = q.toLowerCase();
      entries = entries.filter((e) =>
        [e.deviceName, e.ip, e.location, e.email, e.sessionId, e.uid]
          .some((f) => f?.toLowerCase().includes(lower))
      );
    }

    const total     = entries.length;
    const paginated = entries.slice(offset, offset + limit);

    return NextResponse.json({ entries: paginated, total, hasMore: offset + limit < total });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[admin/logs GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

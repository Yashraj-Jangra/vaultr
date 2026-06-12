import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { createGzip } from "zlib";

export async function POST(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
    }

    const parsed = new URL(dbUrl);
    const dbUser = parsed.username || "vaultr";
    const dbName = parsed.pathname.slice(1) || "vaultr_db";

    const backupsDir = path.join(process.cwd(), "backups");
    
    // Ensure backups directory exists
    try {
      await fs.access(backupsDir);
    } catch {
      await fs.mkdir(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}.sql.gz`;
    const filepath = path.join(backupsDir, filename);

    await new Promise((resolve, reject) => {
      // Spawn pg_dump inside docker
      const pgDump = spawn("docker", ["exec", "vaultr_postgres", "pg_dump", "-U", dbUser, dbName]);
      
      const gzip = createGzip();
      const outStream = createWriteStream(filepath);

      pgDump.stdout.pipe(gzip).pipe(outStream);

      pgDump.stderr.on("data", (data) => {
        console.error(`pg_dump stderr: ${data}`);
      });

      pgDump.on("close", (code) => {
        if (code === 0) resolve(true);
        else reject(new Error(`pg_dump exited with code ${code}`));
      });

      pgDump.on("error", reject);
      outStream.on("error", reject);
      gzip.on("error", reject);
    });

    return NextResponse.json({ success: true, file: filename });
  } catch (error: any) {
    console.error("Backup failed:", error);
    return NextResponse.json({ error: error.message || "Failed to create backup" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    const backupsDir = path.join(process.cwd(), "backups");
    
    try {
      await fs.access(backupsDir);
    } catch {
      return NextResponse.json({ backups: [] });
    }

    const files = await fs.readdir(backupsDir);
    const backups = [];

    for (const file of files) {
      if (file.endsWith(".sql.gz")) {
        const stats = await fs.stat(path.join(backupsDir, file));
        backups.push({
          name: file,
          size: stats.size,
          createdAt: stats.birthtime,
        });
      }
    }

    // Sort newest first
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({ backups });
  } catch (error: any) {
    console.error("Failed to list backups:", error);
    return NextResponse.json({ error: error.message || "Failed to list backups" }, { status: 500 });
  }
}

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth/verifyAdmin";
import { db } from "@/db";
import { configSystem } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendDiscordWebhook } from "@/lib/webhook";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    
    let config = await db.select().from(configSystem).where(eq(configSystem.id, 1)).limit(1);
    
    // Auto-initialize if it doesn't exist
    if (config.length === 0) {
      await db.insert(configSystem).values({ id: 1 });
      config = await db.select().from(configSystem).where(eq(configSystem.id, 1)).limit(1);
    }
    
    return NextResponse.json(config[0]);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/admin/system]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdminToken(req);
    const body = await req.json();

    // Ensure config row exists
    const existing = await db.select().from(configSystem).where(eq(configSystem.id, 1)).limit(1);
    if (existing.length === 0) {
      await db.insert(configSystem).values({ id: 1 });
    }

    await db
      .update(configSystem)
      .set({
        pauseSignups: body.pauseSignups,
        maintenanceMode: body.maintenanceMode,
        discordWebhook: body.discordWebhook,
        backupCron: body.backupCron,
      })
      .where(eq(configSystem.id, 1));

    // Send a webhook alert if panic buttons were toggled
    if (body.pauseSignups !== undefined && existing[0]?.pauseSignups !== body.pauseSignups) {
      await sendDiscordWebhook(
        "System State Changed", 
        `**Pause Signups:** ${body.pauseSignups ? "ENABLED (Locked)" : "DISABLED (Open)"}`,
        body.pauseSignups ? 0xff9900 : 0x00ff00
      );
    }

    if (body.maintenanceMode !== undefined && existing[0]?.maintenanceMode !== body.maintenanceMode) {
      await sendDiscordWebhook(
        "Maintenance Mode Toggled", 
        `**Maintenance Mode:** ${body.maintenanceMode ? "ENABLED (System Down)" : "DISABLED (Online)"}`,
        body.maintenanceMode ? 0xff0000 : 0x00ff00
      );
    }

    if (body.discordWebhook !== undefined && existing[0]?.discordWebhook !== body.discordWebhook) {
      if (body.discordWebhook) {
        await sendDiscordWebhook(
          "🔗 Discord Webhook Active", 
          `This webhook has been successfully linked to the Vaultr system logs.\n\n**Status:** Connected & Active\n**Environment:** ${process.env.NODE_ENV || "development"}`,
          0x5865F2
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/admin/system]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

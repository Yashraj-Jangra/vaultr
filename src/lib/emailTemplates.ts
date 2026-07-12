/**
 * src/lib/emailTemplates.ts
 *
 * Server-side email template engine.
 * Templates are stored in the admin_email_templates table (PostgreSQL).
 * Each template has: subject, bodyHtml, bodyText, fromProfileId.
 * Variables are replaced with {{VAR_NAME}} syntax.
 *
 * Replaces: Local Database adminSettings/emailTemplates doc
 */

import nodemailer, { Transporter } from "nodemailer";
import { db } from "@/db";
import { adminSmtp, adminEmailTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmtpProfile {
  id: string;
  name: string;
  email: string;
  isDefault: boolean;
}

export interface SmtpConfig {
  host: string;
  port: string | number;
  user: string;
  pass: string;
  supportEmail?: string;
  profiles: SmtpProfile[];
}

export interface EmailTemplate {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  fromProfileId?: string;
}

export type TemplateKey =
  | "device_verification"
  | "new_device_alert"
  | "welcome"
  | "password_changed"
  | "account_deleted"
  | "support_reply"
  | "new_ticket_alert"
  | "email_verification";

// ─── Default templates ────────────────────────────────────────────────────────

const WRAPPER = (content: string, footerLine = "Vaultr · Zero-knowledge vault") => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:14px;border:1px solid #262626;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;border-bottom:1px solid #262626;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-weight:800;font-size:18px;">V</span>
            </div>
            <span style="color:#e5e7eb;font-size:18px;font-weight:700;letter-spacing:-0.5px;">Vaultr</span>
          </div>
        </td></tr>
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #262626;background:#0d0d0d;">
          <p style="margin:0;font-size:11px;color:#4b4b4b;text-align:center;">${footerLine} &nbsp;·&nbsp; Do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export const DEFAULT_TEMPLATES: Record<TemplateKey, EmailTemplate> = {
  device_verification: {
    subject: "{{OTP}} — Your Vaultr device verification code",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 8px;font-size:22px;color:#f5f5f5;font-weight:700;">Verify your device</h2>
      <p style="color:#a3a3a3;font-size:14px;margin:0 0 28px;line-height:1.6;">
        Enter this code in Vaultr to verify <strong style="color:#d4d4d4;">{{DEVICE_NAME}}</strong>.
        The code expires in <strong style="color:#d4d4d4;">15 minutes</strong>.
      </p>
      <div style="background:#1a1a1a;border:1px solid #3f3f3f;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
        <span style="font-family:'Courier New',monospace;font-size:44px;font-weight:800;letter-spacing:12px;color:#ffffff;display:block;">{{OTP}}</span>
      </div>
      <p style="font-size:13px;color:#737373;line-height:1.6;">
        If you didn't request this, your vault is safe — someone may have entered your email by mistake. You can ignore this email.
      </p>`),
    bodyText: "Your Vaultr verification code: {{OTP}}\n\nDevice: {{DEVICE_NAME}}\nExpires in 15 minutes.\n\nIf you didn't request this, ignore this email.",
  },

  new_device_alert: {
    subject: "⚠️ New device signed in to your Vaultr account",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 8px;font-size:22px;color:#f5f5f5;font-weight:700;">New sign-in detected</h2>
      <p style="color:#a3a3a3;font-size:14px;margin:0 0 24px;line-height:1.6;">
        A new device has signed in to your Vaultr account. If this was you, no action is needed.
      </p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:5px 0;font-size:13px;color:#737373;width:100px;">Device</td><td style="font-size:13px;color:#d4d4d4;font-weight:500;">{{DEVICE_NAME}}</td></tr>
          <tr><td style="padding:5px 0;font-size:13px;color:#737373;">Location</td><td style="font-size:13px;color:#d4d4d4;font-weight:500;">{{LOCATION}}</td></tr>
          <tr><td style="padding:5px 0;font-size:13px;color:#737373;">Time</td><td style="font-size:13px;color:#d4d4d4;font-weight:500;">{{TIME}}</td></tr>
        </table>
      </div>
      <p style="font-size:13px;color:#737373;margin-bottom:20px;line-height:1.6;">
        If you don't recognise this sign-in, revoke the session immediately from your Security settings.
      </p>
      <a href="{{SECURITY_URL}}" style="display:inline-block;padding:11px 22px;background:#dc2626;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Review Active Sessions</a>`),
    bodyText: "New sign-in detected on your Vaultr account.\n\nDevice: {{DEVICE_NAME}}\nLocation: {{LOCATION}}\nTime: {{TIME}}\n\nReview sessions: {{SECURITY_URL}}",
  },

  welcome: {
    subject: "Welcome to Vaultr 🔐",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 8px;font-size:22px;color:#f5f5f5;font-weight:700;">Welcome, {{USER_NAME}}!</h2>
      <p style="color:#a3a3a3;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Your zero-knowledge vault is ready. Everything you store is encrypted on your device — we never see your data.
      </p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#a3a3a3;">🔑 &nbsp;Your vault is encrypted with <strong style="color:#d4d4d4;">AES-256-GCM</strong></p>
        <p style="margin:0 0 8px;font-size:13px;color:#a3a3a3;">🛡️ &nbsp;Your master password never leaves your device</p>
        <p style="margin:0;font-size:13px;color:#a3a3a3;">📱 &nbsp;Access from any device — verify each one</p>
      </div>
      <a href="{{APP_URL}}" style="display:inline-block;padding:11px 22px;background:#6366f1;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Open my vault →</a>`),
    bodyText: "Welcome to Vaultr, {{USER_NAME}}!\n\nYour zero-knowledge vault is ready.\n\nOpen vault: {{APP_URL}}",
  },

  password_changed: {
    subject: "Your Vaultr master password was changed",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 8px;font-size:22px;color:#f5f5f5;font-weight:700;">Master password changed</h2>
      <p style="color:#a3a3a3;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Your Vaultr master password was successfully changed on <strong style="color:#d4d4d4;">{{DATE}}</strong>.
        All vault items ({{ITEM_COUNT}}) were re-encrypted with the new key.
      </p>
      <p style="font-size:13px;color:#737373;line-height:1.6;">
        If you did not make this change, contact support immediately and revoke all sessions from your Security settings.
      </p>
      <a href="{{SECURITY_URL}}" style="display:inline-block;margin-top:16px;padding:11px 22px;background:#dc2626;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Review Sessions</a>`),
    bodyText: "Your Vaultr master password was changed on {{DATE}}.\n{{ITEM_COUNT}} items were re-encrypted.\n\nIf this wasn't you, review sessions: {{SECURITY_URL}}",
  },

  account_deleted: {
    subject: "Your Vaultr account has been deleted",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 8px;font-size:22px;color:#f5f5f5;font-weight:700;">Account deleted</h2>
      <p style="color:#a3a3a3;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Your Vaultr account and all associated encrypted vault data have been permanently deleted.
        This action cannot be undone.
      </p>
      <p style="font-size:13px;color:#737373;line-height:1.6;">
        Thank you for using Vaultr. If you deleted your account by mistake or have questions, please reach out to support.
      </p>`),
    bodyText: "Your Vaultr account has been permanently deleted. All vault data is gone. This cannot be undone.",
  },

  support_reply: {
    subject: "Re: {{TICKET_SUBJECT}}",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#f5f5f5;font-weight:700;">Support Reply</h2>
      <p style="color:#a3a3a3;font-size:14px;margin:0 0 16px;line-height:1.6;">
        You have received a new reply on your support ticket: <strong style="color:#d4d4d4;">{{TICKET_SUBJECT}}</strong>
      </p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#d4d4d4;line-height:1.6;white-space:pre-wrap;">{{MESSAGE}}</p>
      </div>
      <a href="{{APP_URL}}/settings/support" style="display:inline-block;padding:11px 22px;background:#6366f1;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">View Ticket</a>`),
    bodyText: "You have received a reply on your ticket: {{TICKET_SUBJECT}}\n\n{{MESSAGE}}\n\nView Ticket: {{APP_URL}}/settings/support",
  },

  new_ticket_alert: {
    subject: "New Support Ticket: {{TICKET_SUBJECT}}",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#f5f5f5;font-weight:700;">New Support Ticket Created</h2>
      <p style="color:#a3a3a3;font-size:14px;margin:0 0 16px;line-height:1.6;">
        A new support ticket has been submitted by <strong style="color:#d4d4d4;">{{USER_EMAIL}}</strong>.
      </p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:5px 0;font-size:13px;color:#737373;width:100px;">Priority</td><td style="font-size:13px;color:#d4d4d4;font-weight:500;">{{PRIORITY}}</td></tr>
          <tr><td style="padding:5px 0;font-size:13px;color:#737373;">Subject</td><td style="font-size:13px;color:#d4d4d4;font-weight:500;">{{TICKET_SUBJECT}}</td></tr>
        </table>
      </div>
      <a href="{{APP_URL}}/admin/support" style="display:inline-block;padding:11px 22px;background:#dc2626;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">View Inbox</a>`),
    bodyText: "New support ticket from {{USER_EMAIL}}.\nPriority: {{PRIORITY}}\nSubject: {{TICKET_SUBJECT}}\n\nView Inbox: {{APP_URL}}/admin/support",
  },
  email_verification: {
    subject: "Verify your email address for Vaultr 🔐",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 8px;font-size:22px;color:#f5f5f5;font-weight:700;">Verify your email</h2>
      <p style="color:#a3a3a3;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Thanks for signing up! Please verify your email address to active your Vaultr account.
      </p>
      <a href="{{VERIFICATION_URL}}" style="display:inline-block;padding:11px 22px;background:#6366f1;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin-bottom:24px;">Verify Email</a>
      <p style="font-size:13px;color:#737373;line-height:1.6;">
        If the button doesn't work, copy and paste this URL into your browser:<br/>
        <span style="word-break:break-all;color:#6366f1;">{{VERIFICATION_URL}}</span>
      </p>`),
    bodyText: "Verify your email address for Vaultr.\n\nClick the link below to verify your email:\n{{VERIFICATION_URL}}",
  },
};

// ─── Template loader ──────────────────────────────────────────────────────────

export async function loadTemplate(key: TemplateKey): Promise<EmailTemplate> {
  try {
    const [row] = await db
      .select({ data: adminEmailTemplates.data })
      .from(adminEmailTemplates)
      .where(eq(adminEmailTemplates.id, 1))
      .limit(1);

    if (row?.data) {
      const data = row.data as Record<string, EmailTemplate>;
      if (data[key]) {
        return { ...DEFAULT_TEMPLATES[key], ...data[key] };
      }
    }
  } catch { /* silent — always fall back to defaults */ }
  return DEFAULT_TEMPLATES[key];
}

// ─── Variable substitution ────────────────────────────────────────────────────

export function renderTemplate(
  template: EmailTemplate,
  vars: Record<string, string>
): { subject: string; html: string; text: string } {
  const replace = (str: string) =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
  return {
    subject: replace(template.subject),
    html:    replace(template.bodyHtml),
    text:    replace(template.bodyText),
  };
}

// ─── SMTP transporter factory ─────────────────────────────────────────────────

export async function createTransporter(): Promise<{
  transporter: Transporter;
  smtp: SmtpConfig;
  fromAddress: string;
} | null> {
  try {
    const [row] = await db
      .select({ data: adminSmtp.data })
      .from(adminSmtp)
      .where(eq(adminSmtp.id, 1))
      .limit(1);

    if (!row?.data) return null;
    const smtp = row.data as SmtpConfig;
    if (!smtp.host || !smtp.user || !smtp.pass) return null;

    const transporter = nodemailer.createTransport({
      host:   smtp.host,
      port:   Number(smtp.port ?? 587),
      secure: Number(smtp.port) === 465,
      auth:   { user: smtp.user, pass: smtp.pass },
    });

    const profiles: SmtpProfile[] = smtp.profiles ?? [];
    const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
    const fromAddress = defaultProfile
      ? `"${defaultProfile.name}" <${defaultProfile.email}>`
      : `"Vaultr" <${smtp.user}>`;

    return { transporter, smtp, fromAddress };
  } catch { return null; }
}

// ─── Convenience: send a templated email ─────────────────────────────────────

export async function sendTemplatedEmail(opts: {
  templateKey: TemplateKey;
  to: string;
  vars: Record<string, string>;
  fromProfileId?: string;
}): Promise<void> {
  const conn = await createTransporter();
  if (!conn) throw new Error("SMTP not configured");

  const template = await loadTemplate(opts.templateKey);
  const rendered = renderTemplate(template, opts.vars);

  let fromAddress = conn.fromAddress;
  if (opts.fromProfileId ?? template.fromProfileId) {
    const pid = opts.fromProfileId ?? template.fromProfileId;
    const profile = conn.smtp.profiles?.find((p) => p.id === pid);
    if (profile) fromAddress = `"${profile.name}" <${profile.email}>`;
  }

  await conn.transporter.sendMail({
    from:    fromAddress,
    to:      opts.to,
    subject: rendered.subject,
    html:    rendered.html,
    text:    rendered.text,
  });
}

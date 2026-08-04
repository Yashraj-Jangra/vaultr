/**
 * src/lib/emailTemplates.ts
 *
 * Server-side email template engine.
 * Templates are stored in the admin_email_templates table (PostgreSQL).
 * Each template has: subject, bodyHtml, bodyText, fromProfileId.
 * Variables are replaced with {{VAR_NAME}} syntax.
 */

import nodemailer, { Transporter } from "nodemailer";
import { db } from "@/db";
import { adminSmtp, adminEmailTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";

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
  | "email_verification"
  | "password_reset";

// ─── Branding Logo CID Attachment Helper ──────────────────────────────────────

export const VAULTR_LOGO_CID = "vaultr-logo-dark@vaultr.app";

export function getBrandLogoAttachment() {
  const logoPath = path.join(process.cwd(), "public/brand/logo-dark.png");
  if (fs.existsSync(logoPath)) {
    return [
      {
        filename: "logo-dark.png",
        path: logoPath,
        cid: VAULTR_LOGO_CID,
      },
    ];
  }
  return [];
}

// ─── Master Email Layout Wrapper ──────────────────────────────────────────────

export const WRAPPER = (
  content: string,
  badgeText = "END-TO-END ENCRYPTED",
  footerLine = "Vaultr · Zero-Knowledge Security Architecture"
) => {
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://vaultr.app").replace(/\/$/, "");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="dark"/>
  <meta name="supported-color-schemes" content="dark"/>
  <title>Vaultr</title>
</head>
<body style="margin:0;padding:0;background-color:#050507;background:#050507;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050507;background:#050507;width:100%;table-layout:fixed;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!-- Container Card -->
        <table width="540" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:540px;background-color:#0d0d10;background:#0d0d10;border-radius:18px;border:1px solid #1f1f26;box-shadow:0 20px 50px -10px rgba(0,0,0,0.85);overflow:hidden;">
          <!-- Top Accent Glow Line -->
          <tr>
            <td style="height:2px;background:linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.18) 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header Row -->
          <tr>
            <td style="padding:26px 32px 22px;border-bottom:1px solid #18181f;background-color:#0d0d10;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <a href="${appBaseUrl}" target="_blank" style="text-decoration:none;display:inline-block;">
                      <img src="cid:${VAULTR_LOGO_CID}" alt="Vaultr" width="112" height="24" style="height:24px;width:auto;max-width:130px;display:block;border:0;outline:none;" />
                    </a>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:10px;font-weight:700;color:#a1a1aa;background-color:rgba(255,255,255,0.06);background:rgba(255,255,255,0.06);padding:4px 10px;border-radius:9999px;border:1px solid rgba(255,255,255,0.09);letter-spacing:0.06em;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${badgeText}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding:36px 32px 40px;background-color:#0d0d10;color:#f4f4f5;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 32px;border-top:1px solid #16161f;background-color:#08080a;background:#08080a;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:500;color:#52525b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">
                ${footerLine}
              </p>
              <p style="margin:0;font-size:10px;color:#3f3f46;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Security Notification &nbsp;·&nbsp; Do not reply directly to this email
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ─── Default Templates ────────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: Record<TemplateKey, EmailTemplate> = {
  device_verification: {
    subject: "{{OTP}} — Your Vaultr device verification code",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">Verify your device</h2>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 28px;line-height:1.6;">
        Enter this single-use code in Vaultr to authenticate <strong style="color:#ffffff;font-weight:600;">{{DEVICE_NAME}}</strong>.
        This verification code will expire in <strong style="color:#ffffff;font-weight:600;">15 minutes</strong>.
      </p>
      <div style="background-color:#131317;background:#131317;border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:26px 16px;text-align:center;margin-bottom:28px;box-shadow:inset 0 2px 4px rgba(0,0,0,0.5);">
        <span style="font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:42px;font-weight:800;letter-spacing:14px;color:#ffffff;display:block;margin-left:14px;">{{OTP}}</span>
      </div>
      <p style="font-size:12.5px;color:#71717a;line-height:1.6;margin:0;">
        If you did not attempt to sign in to Vaultr, your account is completely safe. Someone may have mistyped their email address. You can safely ignore this email.
      </p>`),
    bodyText: "Your Vaultr verification code: {{OTP}}\n\nDevice: {{DEVICE_NAME}}\nExpires in 15 minutes.\n\nIf you didn't request this, ignore this email.",
  },

  new_device_alert: {
    subject: "⚠️ New device signed in to your Vaultr account",
    bodyHtml: WRAPPER(`
      <div style="display:inline-block;padding:4px 10px;background-color:rgba(239,68,68,0.1);background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:6px;margin-bottom:14px;">
        <span style="font-size:11px;font-weight:700;color:#ef4444;letter-spacing:0.04em;text-transform:uppercase;">⚠️ Security Alert</span>
      </div>
      <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">New device sign-in</h2>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;line-height:1.6;">
        A new device recently authenticated into your Vaultr account. If this was you, no further action is required.
      </p>
      <div style="background-color:#131317;background:#131317;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px 22px;margin-bottom:26px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#71717a;width:90px;">Device</td>
            <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">{{DEVICE_NAME}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#71717a;">Location</td>
            <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">{{LOCATION}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#71717a;">Timestamp</td>
            <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">{{TIME}}</td>
          </tr>
        </table>
      </div>
      <p style="font-size:13px;color:#71717a;margin-bottom:24px;line-height:1.6;">
        If you do not recognize this activity, your password may be compromised. Revoke active sessions immediately.
      </p>
      <a href="{{SECURITY_URL}}" style="display:inline-block;padding:12px 26px;background-color:#ef4444;background:#ef4444;color:#ffffff;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(239,68,68,0.25);">Review Active Sessions &rarr;</a>`, "SECURITY ALERT"),
    bodyText: "New sign-in detected on your Vaultr account.\n\nDevice: {{DEVICE_NAME}}\nLocation: {{LOCATION}}\nTime: {{TIME}}\n\nReview sessions: {{SECURITY_URL}}",
  },

  welcome: {
    subject: "Welcome to Vaultr 🔐",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">Welcome to Vaultr, {{USER_NAME}}</h2>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Your zero-knowledge encrypted vault is ready. Everything you store is client-side encrypted before leaving your browser or mobile device.
      </p>
      <div style="background-color:#131317;background:#131317;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:22px 24px;margin-bottom:28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#d4d4d8;">
              🔐 &nbsp;<strong style="color:#ffffff;font-weight:600;">AES-256-GCM Encryption</strong> — Standard military-grade cryptography
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#d4d4d8;">
              🛡️ &nbsp;<strong style="color:#ffffff;font-weight:600;">Zero-Knowledge</strong> — Your master password is never sent to our servers
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#d4d4d8;">
              ⚡ &nbsp;<strong style="color:#ffffff;font-weight:600;">Cross-Platform</strong> — Access seamlessly on Web, Extension & Mobile
            </td>
          </tr>
        </table>
      </div>
      <a href="{{APP_URL}}" style="display:inline-block;padding:12px 26px;background-color:#ffffff;background:#ffffff;color:#000000;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(255,255,255,0.15);">Open My Vault &rarr;</a>`, "WELCOME TO VAULTR"),
    bodyText: "Welcome to Vaultr, {{USER_NAME}}!\n\nYour zero-knowledge vault is ready.\n\nOpen vault: {{APP_URL}}",
  },

  password_changed: {
    subject: "Your Vaultr master password was changed",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">Master password updated</h2>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Your Vaultr master password was successfully changed on <strong style="color:#ffffff;font-weight:600;">{{DATE}}</strong>.
        All <strong style="color:#ffffff;font-weight:600;">{{ITEM_COUNT}}</strong> vault items were safely re-encrypted with your new key.
      </p>
      <div style="background-color:#131317;background:#131317;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px 22px;margin-bottom:26px;">
        <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5;">
          🔒 Your new key derivation has been updated across all authorized devices.
        </p>
      </div>
      <p style="font-size:13px;color:#71717a;margin-bottom:24px;line-height:1.6;">
        If you did not authorize this change, please contact Vaultr support immediately and revoke all active device sessions.
      </p>
      <a href="{{SECURITY_URL}}" style="display:inline-block;padding:12px 26px;background-color:#ef4444;background:#ef4444;color:#ffffff;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(239,68,68,0.25);">Review Active Sessions &rarr;</a>`, "SECURITY UPDATE"),
    bodyText: "Your Vaultr master password was changed on {{DATE}}.\n{{ITEM_COUNT}} items were re-encrypted.\n\nIf this wasn't you, review sessions: {{SECURITY_URL}}",
  },

  account_deleted: {
    subject: "Your Vaultr account has been deleted",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">Account permanently deleted</h2>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Your Vaultr account and all associated encrypted vault records have been permanently wiped from our database.
      </p>
      <div style="background-color:#131317;background:#131317;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px 22px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
          ⚠️ This operation is irreversible. All encrypted blobs, session keys, and vault items have been purged.
        </p>
      </div>
      <p style="font-size:13px;color:#71717a;line-height:1.6;margin:0;">
        Thank you for using Vaultr. If you ever wish to return, you can create a new account anytime.
      </p>`, "ACCOUNT TERMINATED"),
    bodyText: "Your Vaultr account has been permanently deleted. All vault data is gone. This cannot be undone.",
  },

  support_reply: {
    subject: "Re: {{TICKET_SUBJECT}}",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">New response to your support ticket</h2>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 20px;line-height:1.6;">
        You received a reply regarding: <strong style="color:#ffffff;font-weight:600;">{{TICKET_SUBJECT}}</strong>
      </p>
      <div style="background-color:#131317;background:#131317;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:22px 24px;margin-bottom:26px;">
        <p style="margin:0;font-size:14px;color:#f4f4f5;line-height:1.6;white-space:pre-wrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">{{MESSAGE}}</p>
      </div>
      <a href="{{APP_URL}}/settings/support" style="display:inline-block;padding:12px 26px;background-color:#ffffff;background:#ffffff;color:#000000;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(255,255,255,0.15);">View Support Ticket &rarr;</a>`, "SUPPORT RESPONSE"),
    bodyText: "You have received a reply on your ticket: {{TICKET_SUBJECT}}\n\n{{MESSAGE}}\n\nView Ticket: {{APP_URL}}/settings/support",
  },

  new_ticket_alert: {
    subject: "New Support Ticket: {{TICKET_SUBJECT}}",
    bodyHtml: WRAPPER(`
      <div style="display:inline-block;padding:4px 10px;background-color:rgba(255,255,255,0.06);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;margin-bottom:14px;">
        <span style="font-size:11px;font-weight:700;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">🎫 Admin Notification</span>
      </div>
      <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">New support ticket created</h2>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;line-height:1.6;">
        A user submitted a new ticket requiring administrator attention.
      </p>
      <div style="background-color:#131317;background:#131317;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px 22px;margin-bottom:26px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#71717a;width:90px;">From</td>
            <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">{{USER_EMAIL}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#71717a;">Priority</td>
            <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">{{PRIORITY}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#71717a;">Subject</td>
            <td style="padding:6px 0;font-size:13px;color:#ffffff;font-weight:600;">{{TICKET_SUBJECT}}</td>
          </tr>
        </table>
      </div>
      <a href="{{APP_URL}}/admin/support" style="display:inline-block;padding:12px 26px;background-color:#ffffff;background:#ffffff;color:#000000;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(255,255,255,0.15);">Open Admin Inbox &rarr;</a>`, "ADMIN ALERT"),
    bodyText: "New support ticket from {{USER_EMAIL}}.\nPriority: {{PRIORITY}}\nSubject: {{TICKET_SUBJECT}}\n\nView Inbox: {{APP_URL}}/admin/support",
  },

  email_verification: {
    subject: "Verify your email address for Vaultr 🔐",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">Verify your email address</h2>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 28px;line-height:1.6;">
        Welcome to Vaultr! Please click the button below to confirm your email address and activate your zero-knowledge account.
      </p>
      <a href="{{VERIFICATION_URL}}" style="display:inline-block;padding:12px 26px;background-color:#ffffff;background:#ffffff;color:#000000;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;margin-bottom:28px;box-shadow:0 4px 14px rgba(255,255,255,0.15);">Verify Email Address &rarr;</a>
      <div style="background-color:#131317;background:#131317;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;">
        <p style="font-size:12px;color:#71717a;line-height:1.6;margin:0;">
          If the button above does not work, copy and paste this URL into your web browser:<br/>
          <span style="word-break:break-all;color:#a1a1aa;font-family:ui-monospace,monospace;font-size:11px;">{{VERIFICATION_URL}}</span>
        </p>
      </div>`, "EMAIL VERIFICATION"),
    bodyText: "Verify your email address for Vaultr.\n\nClick the link below to verify your email:\n{{VERIFICATION_URL}}",
  },

  password_reset: {
    subject: "Reset your Vaultr master password 🔐",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:22px;color:#ffffff;font-weight:700;letter-spacing:-0.02em;">Reset your password</h2>
      <p style="color:#a1a1aa;font-size:14px;margin:0 0 28px;line-height:1.6;">
        We received a request to reset the password for your Vaultr account (<strong style="color:#ffffff;">{{USER_EMAIL}}</strong>).
        Click the button below to choose a new password.
      </p>
      <a href="{{RESET_URL}}" style="display:inline-block;padding:12px 26px;background-color:#ffffff;background:#ffffff;color:#000000;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;margin-bottom:28px;box-shadow:0 4px 14px rgba(255,255,255,0.15);">Reset Password &rarr;</a>
      <div style="background-color:#131317;background:#131317;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;">
        <p style="font-size:12px;color:#71717a;line-height:1.6;margin:0;">
          If you did not request a password reset, you can safely ignore this email. Your vault remains encrypted.
        </p>
      </div>`, "PASSWORD RESET"),
    bodyText: "Reset your Vaultr password.\n\nClick the link below to set a new password:\n{{RESET_URL}}",
  },
};

// ─── Template Loader ──────────────────────────────────────────────────────────

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

// ─── Variable Substitution ────────────────────────────────────────────────────

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

// ─── SMTP Transporter Factory ─────────────────────────────────────────────────

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

// ─── Convenience: Send a Templated Email ──────────────────────────────────────

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
    from:        fromAddress,
    to:          opts.to,
    subject:     rendered.subject,
    html:        rendered.html,
    text:        rendered.text,
    attachments: getBrandLogoAttachment(),
  });
}

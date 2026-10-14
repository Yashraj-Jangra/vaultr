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

export const VAULTR_LOGO_CID = "vaultr-full-light-transparent@vaultr.app";

export function getBrandLogoAttachment() {
  const logoPath = path.join(process.cwd(), "public/brand/vaultr-full-light-transparent.png");
  if (fs.existsSync(logoPath)) {
    return [
      {
        filename: "vaultr-full-light-transparent.png",
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
  badgeText?: string,
  footerLine = "Vaultr · Secure password management"
) => {
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://vaultr.app").replace(/\/$/, "");

  const badgeHtml = badgeText
    ? `<span style="font-size:11px;font-weight:500;color:#6b7280;background-color:#f3f4f6;padding:3px 9px;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${badgeText}</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>Vaultr</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f8fa;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f8fa;background:#f6f8fa;width:100%;table-layout:fixed;">
    <tr>
      <td align="center" style="padding:48px 16px 56px;">
        <!-- Container Card -->
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;background-color:#ffffff;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.04);overflow:hidden;">
          <!-- Header Row -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #f3f4f6;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <a href="${appBaseUrl}" target="_blank" style="text-decoration:none;display:inline-block;">
                      <img src="cid:${VAULTR_LOGO_CID}" alt="Vaultr" width="93" height="28" style="height:28px;width:auto;display:block;border:0;outline:none;" />
                    </a>
                  </td>
                  ${badgeText ? `<td align="right" style="vertical-align:middle;">${badgeHtml}</td>` : ""}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding:32px 32px 36px;color:#111827;font-size:14px;line-height:1.6;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 28px;border-top:1px solid #f3f4f6;background-color:#fafafa;background:#fafafa;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:500;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;">
                ${footerLine}
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;">
                This is an automated notification · Do not reply directly to this email
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
    subject: "{{OTP}} is your Vaultr verification code",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:600;letter-spacing:-0.015em;">Verify your device</h2>
      <p style="color:#4b5563;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Enter the verification code below to sign in to your Vaultr account on <strong style="color:#111827;font-weight:600;">{{DEVICE_NAME}}</strong>. This code will expire in <strong style="color:#111827;font-weight:600;">15 minutes</strong>.
      </p>
      <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:22px 16px;text-align:center;margin:0 0 24px;">
        <span style="font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#111827;display:inline-block;margin-left:10px;">{{OTP}}</span>
      </div>
      <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">
        If you didn't attempt to sign in to Vaultr, you can safely ignore this email. Someone may have entered your email address by mistake.
      </p>`),
    bodyText: "Your Vaultr verification code: {{OTP}}\n\nDevice: {{DEVICE_NAME}}\nExpires in 15 minutes.\n\nIf you didn't request this, ignore this email.",
  },

  new_device_alert: {
    subject: "New sign-in to your Vaultr account",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:600;letter-spacing:-0.015em;">New device sign-in</h2>
      <p style="color:#4b5563;font-size:14px;margin:0 0 20px;line-height:1.6;">
        A new device recently signed in to your Vaultr account. If this was you, no action is needed.
      </p>
      <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6b7280;width:95px;font-weight:500;">Device</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">{{DEVICE_NAME}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:500;">Location</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">{{LOCATION}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:500;">Time</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">{{TIME}}</td>
          </tr>
        </table>
      </div>
      <p style="font-size:13px;color:#6b7280;margin:0 0 22px;line-height:1.6;">
        If you don't recognize this activity, your master password may be compromised. We recommend reviewing active sessions immediately.
      </p>
      <a href="{{SECURITY_URL}}" style="display:inline-block;padding:11px 22px;background-color:#dc2626;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">Review Active Sessions</a>`, "Security Alert"),
    bodyText: "New sign-in detected on your Vaultr account.\n\nDevice: {{DEVICE_NAME}}\nLocation: {{LOCATION}}\nTime: {{TIME}}\n\nReview sessions: {{SECURITY_URL}}",
  },

  welcome: {
    subject: "Welcome to Vaultr",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:600;letter-spacing:-0.015em;">Welcome to Vaultr, {{USER_NAME}}</h2>
      <p style="color:#4b5563;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Your vault is ready. Vaultr keeps your passwords, passkeys, and personal notes secure with end-to-end encryption — meaning only you have the keys to view your data.
      </p>
      <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;margin:0 0 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:7px 0;font-size:13px;color:#374151;line-height:1.5;">
              <strong style="color:#111827;font-weight:600;">Zero-Knowledge Privacy</strong> — Your records are encrypted directly on your device. We can never see your master password or stored data.
            </td>
          </tr>
          <tr>
            <td style="padding:7px 0;font-size:13px;color:#374151;line-height:1.5;border-top:1px solid #f3f4f6;">
              <strong style="color:#111827;font-weight:600;">Seamless Autofill</strong> — Access and fill your credentials across Web, Browser Extension, and Mobile.
            </td>
          </tr>
          <tr>
            <td style="padding:7px 0;font-size:13px;color:#374151;line-height:1.5;border-top:1px solid #f3f4f6;">
              <strong style="color:#111827;font-weight:600;">Instant Sync</strong> — Any updates you make are automatically synchronized across all your devices in real time.
            </td>
          </tr>
        </table>
      </div>
      <a href="{{APP_URL}}" style="display:inline-block;padding:11px 22px;background-color:#111827;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">Go to Your Vault</a>`),
    bodyText: "Welcome to Vaultr, {{USER_NAME}}!\n\nYour zero-knowledge vault is ready.\n\nOpen vault: {{APP_URL}}",
  },

  password_changed: {
    subject: "Your master password was changed",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:600;letter-spacing:-0.015em;">Master password updated</h2>
      <p style="color:#4b5563;font-size:14px;margin:0 0 20px;line-height:1.6;">
        The master password for your Vaultr account was successfully changed on <strong style="color:#111827;font-weight:600;">{{DATE}}</strong>. All <strong style="color:#111827;font-weight:600;">{{ITEM_COUNT}}</strong> items in your vault were re-encrypted with your new key.
      </p>
      <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
        <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.5;">
          Active sessions on other devices may be prompted to unlock again using your new master password.
        </p>
      </div>
      <p style="font-size:13px;color:#6b7280;margin:0 0 22px;line-height:1.6;">
        If you did not make this change, please review your active sessions immediately and contact support.
      </p>
      <a href="{{SECURITY_URL}}" style="display:inline-block;padding:11px 22px;background-color:#dc2626;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">Review Active Sessions</a>`, "Security Update"),
    bodyText: "Your Vaultr master password was changed on {{DATE}}.\n{{ITEM_COUNT}} items were re-encrypted.\n\nIf this wasn't you, review sessions: {{SECURITY_URL}}",
  },

  account_deleted: {
    subject: "Your Vaultr account has been deleted",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:600;letter-spacing:-0.015em;">Account deleted</h2>
      <p style="color:#4b5563;font-size:14px;margin:0 0 18px;line-height:1.6;">
        Your Vaultr account and all associated encrypted vault records have been permanently deleted as requested.
      </p>
      <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
          This operation is irreversible. All encrypted records, cryptographic keys, and user settings have been purged.
        </p>
      </div>
      <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0;">
        Thank you for having used Vaultr. If you ever need a secure vault again in the future, you are always welcome to create a new account.
      </p>`),
    bodyText: "Your Vaultr account has been permanently deleted. All vault data is gone. This cannot be undone.",
  },

  support_reply: {
    subject: "Re: {{TICKET_SUBJECT}}",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:600;letter-spacing:-0.015em;">Support response</h2>
      <p style="color:#4b5563;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Our support team has responded to your request regarding <strong style="color:#111827;font-weight:600;">{{TICKET_SUBJECT}}</strong>:
      </p>
      <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-left:3px solid #111827;border-radius:8px;padding:18px 20px;margin:0 0 24px;">
        <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6;white-space:pre-wrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">{{MESSAGE}}</p>
      </div>
      <a href="{{APP_URL}}/settings/support" style="display:inline-block;padding:11px 22px;background-color:#111827;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">View Support Ticket</a>`),
    bodyText: "You have received a reply on your ticket: {{TICKET_SUBJECT}}\n\n{{MESSAGE}}\n\nView Ticket: {{APP_URL}}/settings/support",
  },

  new_ticket_alert: {
    subject: "[Support] {{TICKET_SUBJECT}}",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:600;letter-spacing:-0.015em;">New support ticket received</h2>
      <p style="color:#4b5563;font-size:14px;margin:0 0 20px;line-height:1.6;">
        A user submitted a new ticket that is awaiting administrator review:
      </p>
      <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6b7280;width:95px;font-weight:500;">From</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">{{USER_EMAIL}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:500;">Priority</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">{{PRIORITY}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6b7280;font-weight:500;">Subject</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:500;">{{TICKET_SUBJECT}}</td>
          </tr>
        </table>
      </div>
      <a href="{{APP_URL}}/admin/support" style="display:inline-block;padding:11px 22px;background-color:#111827;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">Open Ticket in Admin</a>`),
    bodyText: "New support ticket from {{USER_EMAIL}}.\nPriority: {{PRIORITY}}\nSubject: {{TICKET_SUBJECT}}\n\nView Inbox: {{APP_URL}}/admin/support",
  },

  email_verification: {
    subject: "Verify your email address",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:600;letter-spacing:-0.015em;">Verify your email address</h2>
      <p style="color:#4b5563;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Thanks for signing up for Vaultr. Please confirm your email address to activate your account and finish setting up your vault.
      </p>
      <div style="margin:0 0 24px;">
        <a href="{{VERIFICATION_URL}}" style="display:inline-block;padding:11px 22px;background-color:#111827;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">Verify Email Address</a>
      </div>
      <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:0 0 16px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="{{VERIFICATION_URL}}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">{{VERIFICATION_URL}}</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">
        If you did not create a Vaultr account, you can safely ignore this email.
      </p>`),
    bodyText: "Verify your email address for Vaultr.\n\nClick the link below to verify your email:\n{{VERIFICATION_URL}}\n\nIf you did not request this, you can ignore this email.",
  },

  password_reset: {
    subject: "Reset your Vaultr password",
    bodyHtml: WRAPPER(`
      <h2 style="margin:0 0 10px;font-size:20px;color:#111827;font-weight:600;letter-spacing:-0.015em;">Reset your password</h2>
      <p style="color:#4b5563;font-size:14px;margin:0 0 24px;line-height:1.6;">
        We received a request to reset the password for your Vaultr account (<strong style="color:#111827;font-weight:600;">{{USER_EMAIL}}</strong>). Click the button below to choose a new password.
      </p>
      <div style="margin:0 0 24px;">
        <a href="{{RESET_URL}}" style="display:inline-block;padding:11px 22px;background-color:#111827;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">Reset Password</a>
      </div>
      <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:0 0 16px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="{{RESET_URL}}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">{{RESET_URL}}</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">
        If you didn't request a password reset, you can safely ignore this email. Your vault remains locked.
      </p>`),
    bodyText: "Reset your Vaultr password.\n\nClick the link below to set a new password:\n{{RESET_URL}}\n\nIf you did not request this, you can ignore this email.",
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

"use client";

import { useState, useEffect } from "react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import {
  Save,
  AlertCircle,
  Check,
  Eye,
  Code2,
  RotateCcw,
  Mail,
  Shield,
  ShieldCheck,
  KeyRound,
  UserX,
  Loader2,
} from "lucide-react";

// ── Available template keys must match server-side TemplateKey union
const TEMPLATE_DEFS = [
  {
    key: "device_verification",
    label: "Device Verification",
    icon: ShieldCheck,
    description: "Sent when a user requests a 6-digit OTP to verify a new device.",
    vars: ["{{OTP}}", "{{DEVICE_NAME}}"],
  },
  {
    key: "new_device_alert",
    label: "New Device Alert",
    icon: Shield,
    description: "Sent when a new device signs into an account that already has sessions.",
    vars: ["{{DEVICE_NAME}}", "{{LOCATION}}", "{{TIME}}", "{{SECURITY_URL}}"],
  },
  {
    key: "welcome",
    label: "Welcome",
    icon: Mail,
    description: "Sent to new users after they create their account.",
    vars: ["{{USER_NAME}}", "{{APP_URL}}"],
  },
  {
    key: "password_changed",
    label: "Master Password Changed",
    icon: KeyRound,
    description: "Sent after a user successfully changes their master password.",
    vars: ["{{DATE}}", "{{ITEM_COUNT}}", "{{SECURITY_URL}}"],
  },
  {
    key: "account_deleted",
    label: "Account Deleted",
    icon: UserX,
    description: "Sent after a user permanently deletes their account.",
    vars: [],
  },
] as const;

type TemplateKey = (typeof TEMPLATE_DEFS)[number]["key"];

interface TemplateState {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  fromProfileId: string;
}

interface SmtpProfile {
  id: string;
  name: string;
  email: string;
  isDefault: boolean;
}

const EMPTY: TemplateState = { subject: "", bodyHtml: "", bodyText: "", fromProfileId: "" };

export default function EmailTemplatesPage() {
  const { user } = useFirebaseAuth();
  const [selected, setSelected] = useState<TemplateKey>("device_verification");
  const [templates, setTemplates] = useState<Record<string, TemplateState>>({});
  const [profiles, setProfiles] = useState<SmtpProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Load templates + SMTP profiles from API
  useEffect(() => {
    (async () => {
      try {
        const [tRes, sRes] = await Promise.all([
          fetch("/api/admin/email/templates"),
          fetch("/api/admin/email"),
        ]);
        if (tRes.ok) {
          const tData = await tRes.json();
          setTemplates(tData.templates || {});
        }
        if (sRes.ok) {
          const sData = await sRes.json();
          setProfiles(sData.profiles || []);
        }
      } catch (err) {
        console.error("Failed to load templates or profiles", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const current: TemplateState = templates[selected] ?? EMPTY;

  const updateField = (field: keyof TemplateState, value: string) => {
    setTemplates((prev) => ({
      ...prev,
      [selected]: { ...(prev[selected] ?? EMPTY), [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templates),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save templates");
      }
      setMsg({ ok: true, text: "Templates saved successfully." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTemplates((prev) => {
      const next = { ...prev };
      delete next[selected];
      return next;
    });
  };

  const handleTestSend = async () => {
    if (!testEmail || !user) return;
    setSendingTest(true);
    setTestMsg(null);
    try {
      // Save templates first so the test uses the latest edits
      await fetch("/api/admin/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templates),
      });
      const res = await fetch("/api/admin/email/test-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ templateKey: selected, to: testEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTestMsg({ ok: true, text: `Test email sent to ${testEmail}` });
    } catch (e) {
      setTestMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSendingTest(false);
    }
  };

  const def = TEMPLATE_DEFS.find((t) => t.key === selected)!;

  if (loading) return <div className="p-8 animate-pulse bg-[var(--surface)] h-screen" />;

  return (
    <div className="flex h-full">
      {/* ── Left sidebar: template picker */}
      <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-y-auto">
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="text-[15px] font-semibold tracking-tight">Email Templates</h2>
          <p className="text-xs text-[var(--fg-muted)] mt-1">Click a template to edit it</p>
        </div>
        <nav className="p-3 space-y-1">
          {TEMPLATE_DEFS.map((t) => {
            const Icon = t.icon;
            const hasCustom = !!templates[t.key]?.subject;
            return (
              <button
                key={t.key}
                onClick={() => { setSelected(t.key); setView("edit"); setMsg(null); setTestMsg(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${
                  selected === t.key
                    ? "bg-[var(--accent)] text-[var(--bg)]"
                    : "text-[var(--fg-muted)] hover:bg-[var(--border)] hover:text-[var(--fg)]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate font-medium">{t.label}</span>
                {hasCustom && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selected === t.key ? "bg-[var(--bg)]/60" : "bg-[var(--accent)]"}`} />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Right: editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 pb-24 max-w-3xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold tracking-tight">{def.label}</h3>
              <p className="text-sm text-[var(--fg-muted)] mt-1">{def.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleReset}
                title="Reset to default template"
                className="p-2 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save All
              </button>
            </div>
          </div>

          {/* Status */}
          {msg && (
            <div className={`mb-5 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${msg.ok ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400" : "bg-red-950/30 border-red-900/50 text-red-400"}`}>
              {msg.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {msg.text}
            </div>
          )}

          {/* Available variables chip list */}
          {def.vars.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-[var(--fg-muted)]">Variables:</span>
              {def.vars.map((v) => (
                <code
                  key={v}
                  className="text-[11px] px-2 py-0.5 rounded bg-[var(--border)] text-[var(--fg)] font-mono cursor-pointer"
                  onClick={() => navigator.clipboard?.writeText(v)}
                  title="Click to copy"
                >
                  {v}
                </code>
              ))}
            </div>
          )}

          <div className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            {/* From profile */}
            <div>
              <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1.5">From Profile</label>
              <select
                value={current.fromProfileId ?? ""}
                onChange={(e) => updateField("fromProfileId", e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
              >
                <option value="">Default profile (from SMTP settings)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} &lt;{p.email}&gt;{p.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1.5">Subject Line</label>
              <input
                type="text"
                value={current.subject}
                onChange={(e) => updateField("subject", e.target.value)}
                placeholder="Leave blank to use the built-in default"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
              />
            </div>

            {/* HTML body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-[var(--fg-muted)]">HTML Body</label>
                <div className="flex items-center gap-1 p-0.5 rounded-md bg-[var(--bg)] border border-[var(--border)]">
                  <button
                    onClick={() => setView("edit")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${view === "edit" ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}
                  >
                    <Code2 className="w-3.5 h-3.5" />Code
                  </button>
                  <button
                    onClick={() => setView("preview")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${view === "preview" ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}
                  >
                    <Eye className="w-3.5 h-3.5" />Preview
                  </button>
                </div>
              </div>

              {view === "edit" ? (
                <textarea
                  rows={16}
                  value={current.bodyHtml}
                  onChange={(e) => updateField("bodyHtml", e.target.value)}
                  placeholder="Paste your HTML here, or leave blank to use the built-in template. Use {{VARIABLE}} for dynamic content."
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-mono focus:border-[var(--accent)] focus:outline-none transition-colors resize-y"
                  spellCheck={false}
                />
              ) : (
                <div className="rounded-md border border-[var(--border)] overflow-hidden" style={{ height: 380 }}>
                  {current.bodyHtml ? (
                    <iframe
                      srcDoc={current.bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, k) => `<span style="background:#fef08a;color:#111;border-radius:3px;padding:0 2px;">{{${k}}}</span>`)}
                      className="w-full h-full"
                      title="Email preview"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-[var(--fg-muted)]">
                      No custom HTML — built-in default will be used.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Plain text */}
            <div>
              <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1.5">Plain Text Fallback</label>
              <textarea
                rows={5}
                value={current.bodyText}
                onChange={(e) => updateField("bodyText", e.target.value)}
                placeholder="Plain text version for clients that don't support HTML. Leave blank to use default."
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-mono focus:border-[var(--accent)] focus:outline-none transition-colors resize-y"
              />
            </div>
          </div>

          {/* ── Test email */}
          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <div>
              <h4 className="text-sm font-semibold">Send Test Email</h4>
              <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                Sends a preview of the <strong>{def.label}</strong> template with placeholder variable values to the address below.
              </p>
            </div>
            {testMsg && (
              <div className={`flex items-center gap-2 text-xs rounded border px-3 py-2 ${testMsg.ok ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400" : "bg-red-950/30 border-red-900/50 text-red-400"}`}>
                {testMsg.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {testMsg.text}
              </div>
            )}
            <div className="flex gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
              />
              <button
                onClick={handleTestSend}
                disabled={sendingTest || !testEmail}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send test
              </button>
            </div>
          </div>

          {/* Info: reset */}
          <p className="mt-4 text-xs text-[var(--fg-muted)]">
            🔄 Use the reset button to clear customizations and revert to the built-in template.
            Built-in templates are always available as a fallback.
          </p>
        </div>
      </div>
    </div>
  );
}

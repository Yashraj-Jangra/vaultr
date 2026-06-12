"use client";

import { useState, useEffect } from "react";
import { Save, AlertCircle, Send, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function SMTPSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [formData, setFormData] = useState({
    host: "",
    port: "587",
    user: "",
    pass: "",
    supportEmail: "",
    profiles: [{ id: "default", name: "Vaultr Admin", email: "no-reply@vaultr.app", isDefault: true }],
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/smtp");
        if (res.ok) {
          const data = await res.json();
          if (data.smtp) {
            setFormData({
              host: data.smtp.host ?? "",
              port: data.smtp.port ?? "587",
              user: data.smtp.user ?? "",
              pass: data.smtp.pass ?? "",
              supportEmail: data.smtp.supportEmail ?? "",
              profiles: data.smtp.profiles ?? [{ id: "default", name: data.smtp.fromName ?? "Vaultr Admin", email: data.smtp.user ?? "", isDefault: true }],
            });
          }
        }
      } catch (err) {
        console.error("Failed to load SMTP settings", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save SMTP settings");
      }
      setMessage({ type: 'success', text: "SMTP settings saved successfully." });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: (err as Error).message || "Failed to save settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!user) return;
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to send test email");
      }
      setMessage({ type: 'success', text: "Test email sent successfully! Please check your inbox." });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: (err as Error).message || "Failed to send test email." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="p-8 pb-20 animate-pulse bg-[var(--surface)] min-h-screen" />;
  }

  return (
    <div className="p-8 pb-20 w-full max-w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">SMTP Settings</h2>
        <p className="text-sm text-[var(--fg-muted)] mt-1">Configure your email provider to send outgoing mail to users.</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center border ${
          message.type === 'error' 
            ? 'bg-[var(--danger)]/5 text-[var(--danger)] border-[var(--danger)]/20' 
            : 'bg-[#34d399]/5 text-[#34d399] border-[#34d399]/20'
        }`}>
          {message.type === 'error' ? (
            <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 mr-3 shrink-0" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-[var(--fg)] block mb-2">SMTP Host</label>
            <input
              type="text"
              required
              placeholder="e.g. smtp.mailgun.org"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-[var(--fg)] block mb-2">SMTP Port</label>
            <input
              type="number"
              required
              placeholder="e.g. 587 or 465"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              className="w-full md:w-1/2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
            />
          </div>



          <div className="md:col-span-2 border-t border-[var(--border)] pt-8 mt-2">
            <h3 className="text-sm font-semibold mb-2 tracking-tight text-[var(--fg)]">Authentication</h3>
            <p className="text-xs text-[var(--fg-muted)] mb-6">
              These are the credentials used to authenticate with your SMTP server (e.g., Mailgun API key or Gmail App Password).
            </p>
          </div>

          <div className="md:col-span-1">
            <label className="text-sm font-medium text-[var(--fg)] block mb-2">SMTP Username</label>
            <input
              type="text"
              required
              autoComplete="off"
              value={formData.user}
              onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-sm font-medium text-[var(--fg)] block mb-2">SMTP Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={formData.pass}
              onChange={(e) => setFormData({ ...formData, pass: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
            />
          </div>

          <div className="md:col-span-2 border-t border-[var(--border)] pt-8 mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-[var(--fg)]">Sender Profiles</h3>
                <p className="text-xs text-[var(--fg-muted)] mt-1">
                  Configure different alias emails (e.g. support@, no-reply@) that emails will be sent &apos;From&apos;.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, profiles: [...formData.profiles, { id: crypto.randomUUID(), name: "", email: "", isDefault: false }] })}
                className="shrink-0 flex items-center justify-center rounded-md bg-[var(--bg)] border border-[var(--border)] px-4 py-2 text-xs font-medium hover:bg-[var(--border)] transition-colors"
              >
                + Add Profile
              </button>
            </div>

            <div className="space-y-4">
              {formData.profiles.map((profile, idx) => (
                <div key={profile.id} className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] transition-colors hover:border-neutral-700">
                  <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                       <label className="text-xs text-[var(--fg-muted)] mb-1.5 block">From Name</label>
                       <input
                         type="text"
                         required
                         placeholder="e.g. Vaultr Support"
                         value={profile.name}
                         onChange={(e) => {
                           const newProfiles = [...formData.profiles];
                           newProfiles[idx].name = e.target.value;
                           setFormData({ ...formData, profiles: newProfiles });
                         }}
                         className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
                       />
                    </div>
                    <div className="flex-1">
                       <label className="text-xs text-[var(--fg-muted)] mb-1.5 block">From Email</label>
                       <input
                         type="email"
                         required
                         placeholder="e.g. support@vaultr.app"
                         value={profile.email}
                         onChange={(e) => {
                           const newProfiles = [...formData.profiles];
                           newProfiles[idx].email = e.target.value;
                           setFormData({ ...formData, profiles: newProfiles });
                         }}
                         className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
                       />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between lg:justify-end w-full lg:w-auto mt-2 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-0 border-[var(--border)] lg:min-w-[150px]">
                    <label className="flex items-center text-sm font-medium mr-6 cursor-pointer text-[var(--fg)]">
                      <input 
                         type="radio" 
                         name="defaultProfile" 
                         checked={profile.isDefault}
                         onChange={() => {
                           const newProfiles = formData.profiles.map((p, i) => ({ ...p, isDefault: i === idx }));
                           setFormData({ ...formData, profiles: newProfiles });
                         }}
                         className="mr-2 w-4 h-4 text-[var(--accent)] bg-[var(--bg)] border-[var(--border)] focus:ring-[var(--accent)]"
                      />
                      Default
                    </label>

                    <button
                      type="button"
                      disabled={formData.profiles.length === 1}
                      onClick={() => {
                        const newProfiles = formData.profiles.filter((_, i) => i !== idx);
                        if (profile.isDefault && newProfiles.length > 0) newProfiles[0].isDefault = true;
                        setFormData({ ...formData, profiles: newProfiles });
                      }}
                      className="text-sm font-medium text-[var(--danger)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-[var(--border)]">
              <label className="text-sm font-medium text-[var(--fg)] block mb-2">Support Email Address (for Admin Alerts)</label>
              <select
                value={formData.supportEmail}
                onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                className="w-full md:w-1/2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
              >
                <option value="">None (Disable admin alerts)</option>
                {formData.profiles.filter(p => p.email).map((profile) => (
                  <option key={profile.id} value={profile.email}>
                    {profile.name ? `${profile.name} <${profile.email}>` : profile.email}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--fg-muted)] mt-2">
                Select an existing profile to receive email notifications when users open new support tickets.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 mt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || saving || !formData.host || !formData.user || !formData.pass}
            className="w-full sm:w-auto flex items-center justify-center rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] px-6 py-2.5 text-sm font-medium hover:bg-[var(--border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-[var(--fg)] border-t-transparent" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}{" "}
            Test Connection
          </button>
          
          <button
            type="submit"
            disabled={saving || testing}
            className="w-full sm:w-auto flex items-center justify-center rounded-md bg-neutral-100 text-neutral-900 px-6 py-2.5 text-sm font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}{" "}
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}

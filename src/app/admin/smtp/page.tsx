"use client";

import { useState, useEffect } from "react";
import { Save, AlertCircle } from "lucide-react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";

export default function SMTPSettingsPage() {
  const { user } = useFirebaseAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [formData, setFormData] = useState({
    host: "",
    port: "587",
    user: "",
    pass: "",
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

  if (loading) {
    return <div className="p-8 pb-20 animate-pulse bg-[var(--surface)] h-screen" />;
  }

  return (
    <div className="p-8 pb-20 max-w-2xl">
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
          <AlertCircle className="w-5 h-5 mr-3" />
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">SMTP Host</label>
            <input
              type="text"
              required
              placeholder="e.g. smtp.mailgun.org"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">SMTP Port</label>
            <input
              type="number"
              required
              placeholder="e.g. 587 or 465"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>

          <div className="md:col-span-2 border-t border-[var(--border)] pt-6 mt-2">
            <h3 className="text-sm font-semibold mb-4 tracking-tight">Authentication</h3>
            <p className="text-xs text-[var(--fg-muted)] mb-4">
              These are the credentials used to authenticate with your SMTP server (e.g., Mailgun API key or Gmail App Password).
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">SMTP Username</label>
            <input
              type="text"
              required
              autoComplete="off"
              value={formData.user}
              onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">SMTP Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={formData.pass}
              onChange={(e) => setFormData({ ...formData, pass: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>

          <div className="md:col-span-2 border-t border-[var(--border)] pt-6 mt-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Sender Profiles</h3>
                <p className="text-xs text-[var(--fg-muted)] mt-1">
                  Configure different alias emails (e.g. support@, no-reply@) that emails will be sent &apos;From&apos;.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, profiles: [...formData.profiles, { id: crypto.randomUUID(), name: "", email: "", isDefault: false }] })}
                className="text-xs font-medium text-[var(--accent)] hover:opacity-80 transition-opacity"
              >
                + Add Profile
              </button>
            </div>

            <div className="space-y-4">
              {formData.profiles.map((profile, idx) => (
                <div key={profile.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                  <div className="flex-1 w-full flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                       <label className="text-xs text-[var(--fg-muted)] mb-1 block">From Name</label>
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
                         className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs focus:border-[var(--accent)] focus:outline-none transition-colors"
                       />
                    </div>
                    <div className="flex-1">
                       <label className="text-xs text-[var(--fg-muted)] mb-1 block">From Email</label>
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
                         className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs focus:border-[var(--accent)] focus:outline-none transition-colors"
                       />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-[var(--border)]">
                    <label className="flex items-center text-xs font-medium mr-4 cursor-pointer">
                      <input 
                         type="radio" 
                         name="defaultProfile" 
                         checked={profile.isDefault}
                         onChange={() => {
                           const newProfiles = formData.profiles.map((p, i) => ({ ...p, isDefault: i === idx }));
                           setFormData({ ...formData, profiles: newProfiles });
                         }}
                         className="mr-1.5"
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
                      className="text-xs text-[var(--danger)] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center rounded-md bg-[var(--accent)] text-[var(--bg)] px-6 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-[var(--bg)] border-t-transparent" />
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

"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
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
    fromName: "Vaultr Admin",
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const ref = doc(db, "adminSettings", "smtp");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setFormData({
            host: data.host ?? "",
            port: data.port ?? "587",
            user: data.user ?? "",
            pass: data.pass ?? "",
            fromName: data.fromName ?? "Vaultr Admin",
          });
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
      const ref = doc(db, "adminSettings", "smtp");
      await setDoc(ref, formData);
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

          <div>
            <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">From Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Vaultr App"
              value={formData.fromName}
              onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>

          <div className="md:col-span-2 border-t border-[var(--border)] pt-6 mt-2">
            <h3 className="text-sm font-semibold mb-4 tracking-tight">Authentication</h3>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">Username / Email</label>
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
            <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">Password / API Key</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={formData.pass}
              onChange={(e) => setFormData({ ...formData, pass: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
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

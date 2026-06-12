"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Send, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

export default function EmailSenderPage() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<{id: string, name: string, email: string, isDefault: boolean}[]>([]);
  const [messageBox, setMessageBox] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [sendMode, setSendMode] = useState<"single" | "broadcast">("single");
  
  const [formData, setFormData] = useState({
    fromProfileId: "default",
    to: "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch("/api/admin/email");
        if (res.ok) {
          const data = await res.json();
          const loadedProfiles = data.profiles || [];
          setProfiles(loadedProfiles);
          const defaultProfile = loadedProfiles.find((p: {id: string, name: string, email: string, isDefault: boolean}) => p.isDefault) || loadedProfiles[0];
          if (defaultProfile) {
            setFormData(prev => ({ ...prev, fromProfileId: defaultProfile.id }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch SMTP profiles", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfiles();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessageBox(null);
    try {
      const endpoint = sendMode === "broadcast" ? "/api/admin/email/broadcast" : "/api/admin/email";
      const res = await fetch(endpoint, {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to send email");
      }

      const responseData = await res.json();
      const msg = sendMode === "broadcast" 
        ? `Broadcast sent to ${responseData.count} users successfully.` 
        : "Email dispatched successfully.";
      
      setMessageBox({ type: 'success', text: msg });
      // Reset only the message and subject, keep profile and to
      setFormData(prev => ({ ...prev, subject: "", message: "" }));
    } catch (err: unknown) {
      setMessageBox({ type: 'error', text: (err as Error).message || "Failed to send email." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
     return <div className="p-8 pb-20 animate-pulse bg-[var(--surface)] min-h-screen" />;
  }

  return (
    <div className="p-8 pb-20 w-full max-w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Outgoing Communications</h2>
        <p className="text-sm text-[var(--fg-muted)] mt-1">Send manual email announcements or targeted notices.</p>
      </div>

      {messageBox && (
        <div className={`mb-6 p-4 rounded-lg flex items-center border ${
          messageBox.type === 'error' 
            ? 'bg-[var(--danger)]/5 text-[var(--danger)] border-[var(--danger)]/20' 
            : 'bg-[#34d399]/5 text-[#34d399] border-[#34d399]/20'
        }`}>
          {messageBox.type === 'error' ? (
            <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 mr-3 shrink-0" />
          )}
          <span className="text-sm font-medium">{messageBox.text}</span>
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6">
          
          <div>
            <label className="text-sm font-medium text-[var(--fg)] block mb-2">From Profile</label>
            <select
              required
              value={formData.fromProfileId}
              onChange={(e) => setFormData({ ...formData, fromProfileId: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
            >
               {profiles.length === 0 && <option value="default">Default Profile</option>}
               {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} &lt;{p.email}&gt;</option>
               ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--fg)] block mb-2">Send Mode</label>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 bg-[var(--bg)] border border-[var(--border)] p-4 rounded-md">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={sendMode === "single"} 
                  onChange={() => setSendMode("single")} 
                  className="w-4 h-4 text-[var(--accent)] bg-[var(--bg)] border-[var(--border)] focus:ring-[var(--accent)]" 
                />
                <span className="text-sm text-[var(--fg)] font-medium">Single Recipient</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={sendMode === "broadcast"} 
                  onChange={() => setSendMode("broadcast")} 
                  className="w-4 h-4 text-[var(--danger)] bg-[var(--bg)] border-[var(--border)] focus:ring-[var(--danger)]" 
                />
                <span className="text-sm text-[var(--danger)] font-medium">Broadcast to ALL Users</span>
              </label>
            </div>
          </div>

          {sendMode === "single" && (
            <div>
              <label className="text-sm font-medium text-[var(--fg)] block mb-2">To</label>
              <input
                type="email"
                required={sendMode === "single"}
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
                placeholder="user@example.com"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-[var(--fg)] block mb-2">Subject</label>
            <input
              type="text"
              required
              placeholder="Feature Update: ..."
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--fg)] block mb-2">Message Body</label>
            <textarea
              required
              rows={10}
              placeholder="Type your message here... Newlines will be formatted to HTML automatically."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all resize-y"
            />
          </div>

        </div>

        <div className="pt-8 mt-4 flex justify-between items-center border-t border-[var(--border)]">
          <p className="text-xs text-[var(--fg-muted)]">Emails are securely logged for audit purposes.</p>
          <button
            type="submit"
            disabled={saving || (sendMode === "single" && !formData.to)}
            className={`flex items-center justify-center rounded-md px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              sendMode === "broadcast" 
                ? "bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90" 
                : "bg-neutral-100 text-neutral-900 hover:bg-white"
            }`}
          >
            {saving ? (
              <Loader2 className={`w-4 h-4 mr-2 animate-spin ${sendMode === "broadcast" ? "text-white" : "text-neutral-900"}`} />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {sendMode === "broadcast" ? "Broadcast to All" : "Send Email"}
          </button>
        </div>
      </form>
    </div>
  );
}

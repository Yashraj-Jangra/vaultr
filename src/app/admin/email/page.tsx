"use client";

import { useState } from "react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Send, AlertCircle, Loader2 } from "lucide-react";

export default function EmailSenderPage() {
  const { user } = useFirebaseAuth();
  const [saving, setSaving] = useState(false);
  const [messageBox, setMessageBox] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [formData, setFormData] = useState({
    to: "",
    subject: "",
    message: "",
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessageBox(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/admin/email", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
         },
         body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to send email");
      }

      setMessageBox({ type: 'success', text: "Email dispatched successfully." });
      setFormData({ to: "", subject: "", message: "" });
    } catch (err: unknown) {
      setMessageBox({ type: 'error', text: (err as Error).message || "Failed to send email." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 pb-20 max-w-4xl">
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
          <AlertCircle className="w-5 h-5 mr-3" />
          <span className="text-sm font-medium">{messageBox.text}</span>
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div>
          <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">To</label>
          <input
            type="text"
            required
            placeholder="Comma separated emails (e.g. user@app.com, test@app.com) or * for broadcast"
            value={formData.to}
            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">Subject</label>
          <input
            type="text"
            required
            placeholder="Feature Update: ..."
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">Message Body</label>
          <textarea
            required
            rows={10}
            placeholder="Type your message here... Newlines will be formatted to HTML automatically."
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none transition-colors resize-y"
          />
        </div>

        <div className="pt-4 flex justify-between items-center border-t border-[var(--border)]">
          <p className="text-xs text-[var(--fg-muted)]">Emails are logged for security purposes.</p>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center rounded-md bg-[var(--accent)] text-[var(--bg)] px-6 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}{" "}
            Send Email
          </button>
        </div>
      </form>
    </div>
  );
}

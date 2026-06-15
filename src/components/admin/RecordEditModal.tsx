"use client";

import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle } from "lucide-react";

interface RecordEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  record: any;
  onSave: () => void;
}

export function RecordEditModal({ isOpen, onClose, tableName, record, onSave }: RecordEditModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && record) {
      setFormData(record);
      setError(null);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  // Determine Primary Key field to disable it
  const pkField = record.id !== undefined ? "id" : (record.userId !== undefined ? "userId" : null);

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkField) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/database/${tableName}/${record[pkField]}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 bg-[var(--bg)] shrink-0">
          <div>
            <h3 className="font-semibold text-[var(--fg)] text-lg">Edit Record</h3>
            <p className="text-[11px] text-[var(--fg-muted)] font-mono mt-1">
              {tableName} <span className="opacity-50 mx-1">•</span> {pkField ? record[pkField] : "Unknown PK"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--surface-hover)] text-[var(--fg-muted)] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-500/10 p-4 text-red-400 border border-red-500/20">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form id="edit-record-form" onSubmit={handleSubmit} className="space-y-5">
            {Object.entries(formData).map(([key, value]) => {
              const isPk = key === pkField;
              const isBoolean = typeof value === "boolean";
              const isObject = typeof value === "object" && value !== null;
              
              // Guess if it's a long string or JSON string to use textarea
              let isLongText = false;
              let displayValue = value;

              if (isObject) {
                displayValue = JSON.stringify(value, null, 2);
                isLongText = true;
              } else if (typeof value === "string") {
                if (value.length > 50 || value.startsWith("{") || value.startsWith("[")) {
                  isLongText = true;
                }
              } else if (value === null || value === undefined) {
                displayValue = "";
              }

              return (
                <div key={key}>
                  <label className="block text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider mb-2">
                    {key}
                  </label>
                  {isBoolean ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={value || false}
                        disabled={isPk}
                        onChange={(e) => handleChange(key, e.target.checked)}
                        className="w-5 h-5 accent-[var(--accent)] rounded border-[var(--border)] cursor-pointer"
                      />
                      <span className="text-sm text-[var(--fg)]">{value ? "True" : "False"}</span>
                    </div>
                  ) : isLongText ? (
                    <textarea
                      value={displayValue || ""}
                      disabled={isPk}
                      onChange={(e) => {
                        let newVal: any = e.target.value;
                        if (isObject) {
                          try { newVal = JSON.parse(e.target.value); } catch { /* ignore parsing errors while typing */ }
                        }
                        handleChange(key, newVal);
                      }}
                      className={`w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] font-mono min-h-[120px] resize-y custom-scrollbar ${isPk ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={displayValue || ""}
                      disabled={isPk}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className={`w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 text-sm text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${isPk ? 'opacity-50 cursor-not-allowed font-mono' : ''}`}
                    />
                  )}
                </div>
              );
            })}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4 bg-[var(--bg)] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-record-form"
            disabled={saving || !pkField}
            className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium text-[var(--bg)] bg-[var(--accent)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-[var(--bg)]/30 border-t-[var(--bg)] rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

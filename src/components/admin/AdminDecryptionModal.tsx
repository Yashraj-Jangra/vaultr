"use client";

import React, { useState, useEffect } from "react";
import { Lock, Unlock, X, Copy, Check } from "lucide-react";
import { deriveKey, decrypt } from "@/hooks/useCrypto";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  encryptedBlob: string;
  itemId: string;
  userId?: string;
}

export function AdminDecryptionModal({ isOpen, onClose, encryptedBlob, itemId, userId }: Props) {
  const [password, setPassword] = useState("");
  const [salt, setSalt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decryptedData, setDecryptedData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      setSalt(userId);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);
    setDecryptedData(null);

    try {
      // Derive the AES-GCM key from the provided master password + user email as salt
      const key = await deriveKey(password, salt || "vaultr");

      // 2. Decrypt the blob
      const plaintext = await decrypt(key, encryptedBlob);
      
      // Try to parse as JSON for pretty printing
      try {
        const json = JSON.parse(plaintext);
        setDecryptedData(JSON.stringify(json, null, 2));
      } catch {
        setDecryptedData(plaintext);
      }
    } catch (err) {
      console.error(err);
      setError("Decryption failed. Incorrect master password or corrupted blob.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!decryptedData) return;
    navigator.clipboard.writeText(decryptedData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="font-semibold text-[var(--fg)]">Zero-Knowledge Decryption</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--bg)] text-[var(--fg-muted)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-[var(--fg-muted)] mb-6">
            This vault item is encrypted with AES-256-GCM. The server cannot read it. 
            To view its contents, you must provide the user's master password.
          </p>

          {!decryptedData ? (
            <form onSubmit={handleDecrypt} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--fg-muted)]">
                  User ID (salt)
                </label>
                <input
                  type="text"
                  value={salt}
                  onChange={(e) => setSalt(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none mb-4"
                  placeholder="User ID..."
                  required
                />
                <label className="mb-2 block text-sm font-medium text-[var(--fg-muted)]">
                  User&apos;s Master Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
                  placeholder="Enter master password..."
                  required
                />
              </div>

              {error && (
                <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)] border border-[var(--danger)]/20">
                  {error}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent)]/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                     <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                  {loading ? "Decrypting..." : "Decrypt Locally"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-500 border border-emerald-500/20 flex items-center gap-2">
                <Unlock className="h-4 w-4" /> Successfully decrypted locally.
              </div>
              
              <div className="relative">
                <pre className="w-full h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 text-[13px] font-mono text-[var(--fg)]">
                  {decryptedData}
                </pre>
                <button
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2 p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                  title="Copy JSON"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setDecryptedData(null)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--bg)] transition-colors"
                >
                  Clear & Lock
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

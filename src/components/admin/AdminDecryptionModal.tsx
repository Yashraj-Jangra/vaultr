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

function parseManualKey(keyStr: string): Uint8Array {
  const cleaned = keyStr.trim();
  
  // Hex: 64 characters representing 32 bytes (256-bit key)
  if (/^[0-9a-fA-F]{64}$/.test(cleaned)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(cleaned.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  
  // Base64: decode and verify length is 32 bytes
  try {
    const binary = atob(cleaned);
    if (binary.length === 32) {
      const bytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
  } catch (e) {
    // fall through
  }
  
  throw new Error("Invalid key format. Key must be a 256-bit AES key formatted as a 64-character Hex string or a Base64 string.");
}

export function AdminDecryptionModal({ isOpen, onClose, encryptedBlob, itemId, userId }: Props) {
  const [method, setMethod] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [salt, setSalt] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decryptedData, setDecryptedData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (userId) {
        setSalt(userId);
      }
      setPassword("");
      setManualKey("");
      setError(null);
      setDecryptedData(null);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (method === "password" && !password) return;
    if (method === "key" && !manualKey) return;

    setLoading(true);
    setError(null);
    setDecryptedData(null);

    try {
      let key: CryptoKey;

      if (method === "password") {
        // Derive key from password + salt
        key = await deriveKey(password, salt || "vaultr");
      } else {
        // Parse and import manual raw key
        const rawKeyBytes = parseManualKey(manualKey);
        key = await window.crypto.subtle.importKey(
          "raw",
          rawKeyBytes as any,
          "AES-GCM",
          false,
          ["decrypt"]
        );
      }

      // Decrypt the blob
      const plaintext = await decrypt(key, encryptedBlob);
      
      // Try to parse as JSON for pretty printing
      try {
        const json = JSON.parse(plaintext);
        setDecryptedData(JSON.stringify(json, null, 2));
      } catch {
        setDecryptedData(plaintext);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Decryption failed. Incorrect master password, invalid key, or corrupted blob.");
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
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
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
            Select a method below to decrypt and view the payload locally.
          </p>

          {!decryptedData ? (
            <div className="space-y-6">
              {/* Tab Switcher */}
              <div className="flex border-b border-[var(--border)] text-sm">
                <button
                  type="button"
                  onClick={() => { setMethod("password"); setError(null); }}
                  className={`flex-1 pb-2.5 font-medium border-b-2 text-center transition-colors ${
                    method === "password"
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  Master Password
                </button>
                <button
                  type="button"
                  onClick={() => { setMethod("key"); setError(null); }}
                  className={`flex-1 pb-2.5 font-medium border-b-2 text-center transition-colors ${
                    method === "key"
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  Manual Encryption Key
                </button>
              </div>

              <form onSubmit={handleDecrypt} className="space-y-4">
                {method === "password" ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--fg-muted)]">
                        User ID (salt)
                      </label>
                      <input
                        type="text"
                        value={salt}
                        onChange={(e) => setSalt(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none font-mono text-sm"
                        placeholder="User ID..."
                        required
                      />
                    </div>
                    <div>
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
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[var(--fg-muted)]">
                      Manual Encryption Key (Hex or Base64)
                    </label>
                    <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
                      Provide the 256-bit AES encryption key in Hex format (64 characters) or Base64 format.
                    </p>
                    <input
                      type="text"
                      value={manualKey}
                      onChange={(e) => setManualKey(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none font-mono text-sm"
                      placeholder="Enter raw key string..."
                      required
                    />
                  </div>
                )}

                {error && (
                  <div className="rounded-md bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)] border border-[var(--danger)]/20 leading-relaxed">
                    {error}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading || (method === "password" ? !password : !manualKey)}
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
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-500 border border-emerald-500/20 flex items-center gap-2">
                <Unlock className="h-4 w-4" /> Successfully decrypted locally.
              </div>
              
              <div className="relative">
                <pre className="w-full h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 text-[13px] font-mono text-[var(--fg)] leading-relaxed">
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


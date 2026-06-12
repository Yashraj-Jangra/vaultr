"use client";

import React, { useState, useRef, ChangeEvent } from "react";
import Papa from "papaparse";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useVault } from "@/context/VaultContext";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Download,
  Upload,
  Trash2,
  UserX,
  FileText,
  Check,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { DecryptedPayload } from "@/app/vault/page";

// ─── Section shell ────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[var(--border)] rounded-xl p-6 space-y-5 bg-[var(--surface)]">
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h2 className="text-[14px] font-semibold text-neutral-200">{title}</h2>
          {description && (
            <p className="text-[12px] text-neutral-600">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusMsg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <span
      className={`text-[12px] flex items-center gap-1.5 ${
        ok ? "text-emerald-400" : "text-red-400"
      }`}
    >
      {ok ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5" />
      )}
      {text}
    </span>
  );
}

// ─── CSV → DecryptedPayload mapping ──────────────────────────────────────────

interface CsvRow {
  name?: string;
  username?: string;
  password?: string;
  url?: string;
  login_username?: string;      // LastPass
  login_password?: string;      // LastPass
  login_uri?: string;           // Bitwarden
  login_totp?: string;          // Bitwarden
  login_notes?: string;         // Bitwarden
  totp?: string;                // Chrome / generic
  note?: string;
  notes?: string;
  folder?: string;
  group?: string;               // Bitwarden/LastPass uses group
  grouping?: string;            // LastPass uses grouping
  [key: string]: string | undefined;
}

function mapCsvRow(
  row: CsvRow
): { name: string; folder: string; payload: DecryptedPayload } {
  const name =
    row.name ||
    row.url ||
    row.login_uri ||
    (row.note || row.notes ? "Imported Note" : "Imported entry");
    
  let _template: "login" | "card" | "note" | "address" = "login";
  if (row.card_number || row.cc_number) _template = "card";
  else if (row.address || row.city) _template = "address";
  else if (!row.url && !row.login_uri && !row.password && !row.login_password && (row.note || row.notes)) _template = "note";

  const folder = row.folder || row.group || row.grouping || "";

  const payload: DecryptedPayload = {
    _template,
    username: row.username || row.login_username || "",
    password: row.password || row.login_password || "",
    url: row.url || row.login_uri || "",
    urls: row.url || row.login_uri ? [row.url || row.login_uri || ""] : [],
    totpSecret: row.totp || row.login_totp || "",
    entryNotes: row.note || row.notes || row.login_notes || "",
  };
  return { name, folder, payload };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DataSettingsPage() {
  const { user } = useFirebaseAuth();
  const { items, encryptData } = useVault();

  // ── Export state
  const [exporting, setExporting] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [useExportPassphrase, setUseExportPassphrase] = useState(false);
  const [exportMsg, setExportMsg] = useState({ text: "", ok: true });

  // ── Import state
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importMsg, setImportMsg] = useState({ text: "", ok: true });

  // ── CSV import state
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<Array<{ name: string; folder: string; payload: DecryptedPayload }>>([]);
  const [csvSaving, setCsvSaving] = useState(false);
  const [csvConflict, setCsvConflict] = useState<"skip" | "overwrite">("skip");
  const [csvMsg, setCsvMsg] = useState({ text: "", ok: true });
  const [csvProgress, setCsvProgress] = useState<number | null>(null);

  // ── Danger zone state
  const [dangerOpen, setDangerOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState({ text: "", ok: true });

  const liveItems = items.filter((i) => !i.deletedAt);

  // ─── Export ──────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!user?.uid) return;
    setExporting(true);
    setExportMsg({ text: "", ok: true });
    try {
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        uid: user.uid,
        items: items.map((item) => {
          const { id, ...rest } = item;
          void id; // ignore unused
          return rest;
        }), // strip runtime id
      };
      const jsonStr = JSON.stringify(exportData, null, 2);
      let blob: Blob;

      if (useExportPassphrase && exportPassphrase.trim()) {
        // Wrap the JSON with AES-GCM using a passphrase-derived key
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
          "raw",
          enc.encode(exportPassphrase),
          { name: "PBKDF2" },
          false,
          ["deriveBits", "deriveKey"]
        );
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const wrapKey = await window.crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt"]
        );
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const cipher = await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          wrapKey,
          enc.encode(jsonStr)
        );
        // Pack: "vaultr-enc" magic + salt (16) + iv (12) + ciphertext
        const magic = enc.encode("vaultr-enc");
        const combined = new Uint8Array(
          magic.length + salt.length + iv.length + cipher.byteLength
        );
        combined.set(magic, 0);
        combined.set(salt, magic.length);
        combined.set(iv, magic.length + salt.length);
        combined.set(new Uint8Array(cipher), magic.length + salt.length + iv.length);
        blob = new Blob([combined], { type: "application/octet-stream" });
        // save as .enc.json (just name convention)
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const date = new Date().toISOString().split("T")[0];
        a.download = `vaultr-export-${date}.enc`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        blob = new Blob([jsonStr], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const date = new Date().toISOString().split("T")[0];
        a.download = `vaultr-export-${date}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }

      setExportMsg({
        text: `Exported ${items.length} item(s) successfully.`,
        ok: true,
      });
    } catch (err) {
      setExportMsg({
        text: (err as Error).message || "Export failed.",
        ok: false,
      });
    } finally {
      setExporting(false);
    }
  };

  // ─── Import ──────────────────────────────────────────────────────────────

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    setImporting(true);
    setImportMsg({ text: "", ok: true });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const magic = new TextDecoder().decode(new Uint8Array(arrayBuffer, 0, 10));
      let jsonStr: string;

      if (magic === "vaultr-enc") {
        // Passphrase-protected export
        if (!importPassphrase.trim()) {
          setImportMsg({
            text: "This file is passphrase-protected. Enter the passphrase first.",
            ok: false,
          });
          setImporting(false);
          return;
        }
        const enc = new TextEncoder();
        const magicBytes = enc.encode("vaultr-enc");
        const data = new Uint8Array(arrayBuffer);
        const salt = data.slice(magicBytes.length, magicBytes.length + 16);
        const iv = data.slice(magicBytes.length + 16, magicBytes.length + 28);
        const cipher = data.slice(magicBytes.length + 28);

        const keyMaterial = await window.crypto.subtle.importKey(
          "raw",
          enc.encode(importPassphrase),
          { name: "PBKDF2" },
          false,
          ["deriveKey"]
        );
        const wrapKey = await window.crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );
        const plain = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          wrapKey,
          cipher
        );
        jsonStr = new TextDecoder().decode(plain);
      } else {
        jsonStr = new TextDecoder().decode(arrayBuffer);
      }

      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed.items)) {
        throw new Error("Invalid export file format.");
      }

      let added = 0;
      // Re-encrypt each blob under the current key
      for (const item of parsed.items) {
        if (!item.encryptedBlob) continue;
        // Decrypt from file (blobs are encrypted under original key — we just carry them over).
        // For a vaultr-export, blobs are already encrypted under the user's key.
        // We simply re-add them as-is (same uid = same key derivation).
        const res = await fetch("/api/vault/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            encryptedBlob: item.encryptedBlob,
            domain: item.domain ?? null,
            folder: item.folder ?? null,
            template: item.template ?? "login",
            tags: item.tags ?? [],
            favorite: item.favorite ?? false,
            hasTotp: item.hasTotp ?? false,
          }),
        });
        if (!res.ok) throw new Error("Failed to import entry");
        added++;
      }

      setImportMsg({
        text: `Imported ${added} item(s) successfully.`,
        ok: true,
      });
    } catch (err) {
      setImportMsg({
        text: (err as Error).message || "Import failed. Check the file format.",
        ok: false,
      });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  // ─── CSV Import ───────────────────────────────────────────────────────────

  const handleCsvFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvMsg({ text: "", ok: true });

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const mapped = result.data.map(mapCsvRow);
        setCsvRows(mapped);
      },
      error: (err: { message: string }) => {
        setCsvMsg({ text: err.message, ok: false });
      },
    });

    if (csvRef.current) csvRef.current.value = "";
  };

  const handleCsvImport = async () => {
    if (!user?.uid || csvRows.length === 0) return;
    setCsvSaving(true);
    setCsvMsg({ text: "", ok: true });

    try {
      let added = 0;
      for (let i = 0; i < csvRows.length; i++) {
        const { name, folder, payload } = csvRows[i];
        
        if (csvConflict === "skip") {
          // Skip if entry with same name exists
          const existing = liveItems.find((i) => i.name === name);
          if (existing) continue;
        }

        const encryptedBlob = await encryptData(JSON.stringify(payload));
        const res = await fetch("/api/vault/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            folder: folder || null,
            encryptedBlob,
            domain: (() => {
              try {
                if (!payload.url) return null;
                return new URL(
                  payload.url.startsWith("http") ? payload.url : `https://${payload.url}`
                ).hostname;
              } catch {
                return null;
              }
            })(),
            template: payload._template || "login",
            tags: [],
            favorite: false,
            hasTotp: !!payload.totpSecret,
          }),
        });
        if (!res.ok) throw new Error("Failed to import CSV entry");
        added++;

        // Chunking to prevent UI freeze and show progress
        if (i % 10 === 0) {
          setCsvProgress(Math.round(((i + 1) / csvRows.length) * 100));
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      setCsvRows([]);
      setCsvProgress(null);
      setCsvMsg({
        text: `Imported ${added} item(s) from CSV.`,
        ok: true,
      });
    } catch (err) {
      setCsvMsg({
        text: (err as Error).message || "CSV import failed.",
        ok: false,
      });
    } finally {
      setCsvSaving(false);
    }
  };

  // ─── Delete vault data ────────────────────────────────────────────────────

  const handleDeleteVault = async () => {
    if (deleteConfirm !== "DELETE" || !user?.uid) return;
    setDeleting(true);
    setDeleteMsg({ text: "", ok: true });
    try {
      const res = await fetch("/api/vault/items", {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to clear vault data");
      }
      setDeleteConfirm("");
      setDeleteMsg({
        text: `All vault data deleted successfully.`,
        ok: true,
      });
    } catch (err) {
      setDeleteMsg({
        text: (err as Error).message || "Delete failed.",
        ok: false,
      });
    } finally {
      setDeleting(false);
    }
  };

  // ─── Delete account ───────────────────────────────────────────────────────

  const handleDeleteAccount = async () => {
    if (deleteAccountConfirm !== "DELETE ACCOUNT" || !user?.uid) return;
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/settings/delete-account", {
        method: "POST",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete account");
      }
      await authClient.signOut();
      window.location.href = "/auth";
    } catch (err) {
      setDeleteMsg({
        text: (err as Error).message || "Account deletion failed.",
        ok: false,
      });
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[18px] font-semibold text-neutral-100">Data</h1>
        <p className="text-[13px] text-neutral-600">
          Export, import, and manage your vault data.
        </p>
      </div>

      {/* ── Export */}
      <Section
        title="Export Vault"
        description="Download an encrypted snapshot of your vault. Blobs remain AES-256-GCM encrypted in the export file."
        icon={Download}
      >
        <div className="space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={useExportPassphrase}
              onChange={(e) => setUseExportPassphrase(e.target.checked)}
              className="accent-neutral-400 w-3.5 h-3.5"
            />
            <span className="text-[13px] text-neutral-400">
              Protect export file with a passphrase (recommended)
            </span>
          </label>

          {useExportPassphrase && (
            <Input
              type="password"
              value={exportPassphrase}
              onChange={(e) => setExportPassphrase(e.target.value)}
              placeholder="Export passphrase (optional)"
              className="font-mono"
            />
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleExport} variant="default" disabled={exporting}>
              {exporting ? "Exporting…" : `Export ${items.length} item(s)`}
            </Button>
          </div>
          <StatusMsg {...exportMsg} />
        </div>
      </Section>

      {/* ── Import vault */}
      <Section
        title="Import Vault"
        description="Re-upload a vaultr export file (.json or passphrase-protected .enc). Existing items are preserved."
        icon={Upload}
      >
        <div className="space-y-3">
          <Input
            type="password"
            value={importPassphrase}
            onChange={(e) => setImportPassphrase(e.target.value)}
            placeholder="Passphrase (only if file was exported with one)"
            className="font-mono"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-[13px] text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Upload className="w-4 h-4" />
              {importing ? "Importing…" : "Choose file"}
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept=".json,.enc"
            className="hidden"
            onChange={handleImport}
          />
          <StatusMsg {...importMsg} />
        </div>
      </Section>

      {/* ── CSV Import */}
      <Section
        title="CSV Import"
        description="Import entries from LastPass, Bitwarden, 1Password, or Chrome exports."
        icon={FileText}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => csvRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-[13px] text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Choose CSV file
            </button>
            <input
              ref={csvRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvFile}
            />
          </div>

          {/* CSV preview table */}
          {csvRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-neutral-400">
                  Previewing <strong className="text-neutral-200">{csvRows.length}</strong> entries
                </p>
                <div className="flex items-center gap-2 text-[12px] text-neutral-500">
                  Conflict:
                  {(["skip", "overwrite"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setCsvConflict(opt)}
                      className={`px-2.5 py-1 rounded border text-[12px] transition-colors cursor-pointer capitalize ${
                        csvConflict === opt
                          ? "border-neutral-500 bg-neutral-800 text-neutral-200"
                          : "border-[var(--border)] text-neutral-600 hover:border-neutral-700"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                <div className="overflow-x-auto max-h-52 overflow-y-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-neutral-900 sticky top-0">
                      <tr>
                        {["Name", "Type", "Username", "URL", "Folder"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 text-neutral-600 font-medium border-b border-[var(--border)]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 50).map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-[var(--border)] hover:bg-neutral-900/60"
                        >
                          <td className="px-3 py-2 text-neutral-300 max-w-[140px] truncate">
                            {row.name}
                          </td>
                          <td className="px-3 py-2 text-neutral-500 max-w-[80px] capitalize">
                            {row.payload._template}
                          </td>
                          <td className="px-3 py-2 text-neutral-500 max-w-[120px] truncate">
                            {row.payload.username || "—"}
                          </td>
                          <td className="px-3 py-2 text-neutral-600 max-w-[120px] truncate">
                            {row.payload.url || "—"}
                          </td>
                          <td className="px-3 py-2 text-neutral-600 max-w-[100px] truncate">
                            {row.folder || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvRows.length > 50 && (
                  <p className="text-[11px] text-center text-neutral-700 py-2 border-t border-[var(--border)]">
                    Showing 50 of {csvRows.length} rows
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleCsvImport}
                  variant="default"
                  disabled={csvSaving}
                >
                  {csvSaving
                    ? (csvProgress !== null ? `Importing... ${csvProgress}%` : "Importing…")
                    : `Import ${csvRows.length} entries`}
                </Button>
                <button
                  onClick={() => setCsvRows([])}
                  className="text-[12px] text-neutral-600 hover:text-neutral-400 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <StatusMsg {...csvMsg} />
        </div>
      </Section>

      {/* ── Danger Zone */}
      <section className="border border-red-900/40 rounded-xl overflow-hidden">
        <button
          onClick={() => setDangerOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 bg-red-950/10 hover:bg-red-950/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-[14px] font-semibold text-red-300">
              Danger Zone
            </span>
          </div>
          {dangerOpen ? (
            <ChevronDown className="w-4 h-4 text-red-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-red-500" />
          )}
        </button>

        {dangerOpen && (
          <div className="px-6 pb-6 space-y-6 border-t border-red-900/30 pt-6 bg-[var(--surface)]">
            {/* Delete all vault data */}
            <div className="space-y-3">
              <div>
                <h3 className="text-[13px] font-semibold text-red-300">
                  Delete All Vault Data
                </h3>
                <p className="text-[12px] text-neutral-600 mt-0.5">
                  Permanently wipes all {liveItems.length} item(s) from your vault. This action
                  cannot be undone.
                </p>
              </div>
              <div className="space-y-2">
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder='Type "DELETE" to confirm'
                  className="font-mono"
                />
                <Button
                  onClick={handleDeleteVault}
                  variant="danger"
                  disabled={deleteConfirm !== "DELETE" || deleting}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleting ? "Deleting…" : "Delete All Vault Data"}
                </Button>
              </div>
            </div>

            <div className="h-px bg-red-900/30" />

            {/* Delete account */}
            <div className="space-y-3">
              <div>
                <h3 className="text-[13px] font-semibold text-red-300">
                  Delete Account
                </h3>
                <p className="text-[12px] text-neutral-600 mt-0.5">
                  Permanently deletes your account and all associated vault data. You will be signed
                  out immediately. This cannot be undone.
                </p>
              </div>
              <div className="space-y-2">
                <Input
                  value={deleteAccountConfirm}
                  onChange={(e) => setDeleteAccountConfirm(e.target.value)}
                  placeholder='Type "DELETE ACCOUNT" to confirm'
                  className="font-mono"
                />
                <Button
                  onClick={handleDeleteAccount}
                  variant="danger"
                  disabled={
                    deleteAccountConfirm !== "DELETE ACCOUNT" || deletingAccount
                  }
                >
                  <UserX className="w-3.5 h-3.5" />
                  {deletingAccount ? "Deleting account…" : "Delete My Account"}
                </Button>
              </div>
            </div>

            <StatusMsg {...deleteMsg} />
          </div>
        )}
      </section>
    </div>
  );
}

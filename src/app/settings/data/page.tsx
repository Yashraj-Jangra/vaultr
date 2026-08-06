"use client";

import React, { useState, useRef, useEffect, ChangeEvent } from "react";
import Papa from "papaparse";
import { useAuth } from "@/hooks/useAuth";
import { useVault } from "@/context/VaultContext";
import { useCrypto, deriveKey } from "@/hooks/useCrypto";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Download,
  Upload,
  UserX,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Database,
  Clock,
  Lock,
} from "lucide-react";
import type { DecryptedPayload } from "@/app/vault/page";

function StatusMsg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <span className={`text-[12px] flex items-center gap-1.5 ${ok ? "text-emerald-400" : "text-red-400"}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
      {text}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col md:flex-row gap-8 py-10 border-b border-[var(--border)] last:border-0">
      <div className="w-full md:w-1/3 shrink-0">
        <h2 className="text-[14px] font-semibold text-neutral-200">{title}</h2>
        {description && <p className="text-[13px] text-neutral-500 mt-1.5 pr-4 leading-relaxed">{description}</p>}
      </div>
      <div className="w-full md:flex-1 space-y-4">
        {children}
      </div>
    </section>
  );
}

function FieldBox({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-neutral-900/40 border border-neutral-800/60 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

// ─── CSV → DecryptedPayload mapping ──────────────────────────────────────────

interface CsvRow {
  name?: string; username?: string; password?: string; url?: string;
  login_username?: string; login_password?: string; login_uri?: string;
  login_totp?: string; login_notes?: string; totp?: string; note?: string;
  notes?: string; folder?: string; group?: string; grouping?: string;
  [key: string]: string | undefined;
}

function mapCsvRow(row: CsvRow): { name: string; folder: string; payload: DecryptedPayload } {
  const name = row.name || row.url || row.login_uri || (row.note || row.notes ? "Imported Note" : "Imported entry");
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
  const { user } = useAuth();
  const { items, encryptData } = useVault();

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [useExportPassphrase, setUseExportPassphrase] = useState(true);
  const [exportMsg, setExportMsg] = useState({ text: "", ok: true });

  // Import state
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importMsg, setImportMsg] = useState({ text: "", ok: true });

  // CSV import state
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<Array<{ name: string; folder: string; payload: DecryptedPayload }>>([]);
  const [csvSaving, setCsvSaving] = useState(false);
  const [csvConflict, setCsvConflict] = useState<"skip" | "overwrite">("skip");
  const [csvMsg, setCsvMsg] = useState({ text: "", ok: true });
  const [csvProgress, setCsvProgress] = useState<number | null>(null);

  // Danger zone state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [masterPasswordInput, setMasterPasswordInput] = useState("");
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState({ text: "", ok: true });
  const [accountDeleteMsg, setAccountDeleteMsg] = useState({ text: "", ok: true });

  const [scheduledDeleteAt, setScheduledDeleteAt] = useState<string | null>(null);
  const [fetchingSchedule, setFetchingSchedule] = useState(true);

  const { decrypt } = useCrypto();

  const fetchScheduleStatus = async () => {
    try {
      const res = await fetch("/api/vault/schedule-delete");
      if (res.ok) {
        const data = await res.json();
        setScheduledDeleteAt(data.scheduledDeleteAt);
      }
    } catch { /* ignore */ }
    finally { setFetchingSchedule(false); }
  };

  useEffect(() => {
    if (user?.id) fetchScheduleStatus();
  }, [user?.id]);

  const liveItems = items.filter((i) => !i.deletedAt);

  // ─── Export ──────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!user?.uid) return;
    setExporting(true);
    setExportMsg({ text: "", ok: true });
    try {
      const exportData = {
        version: 1, exportedAt: new Date().toISOString(), uid: user.uid,
        items: items.map(({ id, ...rest }) => rest), // eslint-disable-line @typescript-eslint/no-unused-vars
      };
      const jsonStr = JSON.stringify(exportData, null, 2);
      let blob: Blob;

      if (useExportPassphrase && exportPassphrase.trim()) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey("raw", enc.encode(exportPassphrase), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const wrapKey = await window.crypto.subtle.deriveKey(
          { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
          keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
        );
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const cipher = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, enc.encode(jsonStr));
        const magic = enc.encode("vaultr-enc");
        const combined = new Uint8Array(magic.length + salt.length + iv.length + cipher.byteLength);
        combined.set(magic, 0); combined.set(salt, magic.length); combined.set(iv, magic.length + salt.length); combined.set(new Uint8Array(cipher), magic.length + salt.length + iv.length);
        blob = new Blob([combined], { type: "application/octet-stream" });
      } else {
        blob = new Blob([jsonStr], { type: "application/json" });
      }
      
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vaultr-export-${new Date().toISOString().split("T")[0]}.${useExportPassphrase ? "enc" : "json"}`;
      a.click();
      URL.revokeObjectURL(a.href);
      setExportMsg({ text: `Exported ${items.length} item(s) successfully.`, ok: true });
    } catch (err) {
      setExportMsg({ text: (err as Error).message || "Export failed.", ok: false });
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
        if (!importPassphrase.trim()) { setImportMsg({ text: "Passphrase required.", ok: false }); setImporting(false); return; }
        const enc = new TextEncoder();
        const magicBytes = enc.encode("vaultr-enc");
        const data = new Uint8Array(arrayBuffer);
        const salt = data.slice(magicBytes.length, magicBytes.length + 16);
        const iv = data.slice(magicBytes.length + 16, magicBytes.length + 28);
        const cipher = data.slice(magicBytes.length + 28);

        const keyMaterial = await window.crypto.subtle.importKey("raw", enc.encode(importPassphrase), { name: "PBKDF2" }, false, ["deriveKey"]);
        const wrapKey = await window.crypto.subtle.deriveKey(
          { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
          keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
        );
        const plain = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, wrapKey, cipher);
        jsonStr = new TextDecoder().decode(plain);
      } else {
        jsonStr = new TextDecoder().decode(arrayBuffer);
      }

      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed.items)) throw new Error("Invalid export file format.");

      let added = 0;
      for (const item of parsed.items) {
        if (!item.encryptedBlob) continue;
        const res = await fetch("/api/vault/items", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name, encryptedBlob: item.encryptedBlob, domain: item.domain ?? null, folder: item.folder ?? null, template: item.template ?? "login", tags: item.tags ?? [], favorite: item.favorite ?? false, hasTotp: item.hasTotp ?? false,
          }),
        });
        if (!res.ok) throw new Error("Failed to import entry");
        added++;
      }
      setImportMsg({ text: `Imported ${added} item(s) successfully.`, ok: true });
    } catch (err) {
      setImportMsg({ text: (err as Error).message || "Import failed.", ok: false });
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
      header: true, skipEmptyLines: true,
      complete: (result) => setCsvRows(result.data.map(mapCsvRow)),
      error: (err: { message: string }) => setCsvMsg({ text: err.message, ok: false }),
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
        if (csvConflict === "skip" && liveItems.find((i) => i.name === name)) continue;

        const encryptedBlob = await encryptData(JSON.stringify(payload));
        const res = await fetch("/api/vault/items", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, folder: folder || null, encryptedBlob,
            domain: (() => { try { return payload.url ? new URL(payload.url.startsWith("http") ? payload.url : `https://${payload.url}`).hostname : null; } catch { return null; } })(),
            template: payload._template || "login", tags: [], favorite: false, hasTotp: !!payload.totpSecret,
          }),
        });
        if (!res.ok) throw new Error("Failed to import CSV entry");
        added++;

        if (i % 10 === 0) {
          setCsvProgress(Math.round(((i + 1) / csvRows.length) * 100));
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      setCsvRows([]);
      setCsvProgress(null);
      setCsvMsg({ text: `Imported ${added} item(s) from CSV.`, ok: true });
    } catch (err) {
      setCsvMsg({ text: (err as Error).message || "CSV import failed.", ok: false });
    } finally {
      setCsvSaving(false);
    }
  };

  // ─── Deletion ────────────────────────────────────────────────────

  const handleScheduleDeleteVault = async () => {
    if (deleteConfirm !== "DELETE" || !masterPasswordInput || !user?.id) return;
    setDeleting(true);
    setDeleteMsg({ text: "", ok: true });
    try {
      // 1. Double-gate: Verify Master Password
      if (items.length > 0) {
        try {
          const derived = await deriveKey(masterPasswordInput, user.id);
          await decrypt(derived, items[0].encryptedBlob);
        } catch {
          throw new Error("Wrong master password. Unable to schedule vault deletion.");
        }
      }

      // 2. Schedule deletion
      const res = await fetch("/api/vault/schedule-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule vault deletion");

      setScheduledDeleteAt(data.scheduledDeleteAt);
      setDeleteConfirm("");
      setMasterPasswordInput("");
      setDeleteMsg({ text: "Vault deletion scheduled for 24 hours from now. An alert email was dispatched.", ok: true });
    } catch (err) {
      setDeleteMsg({ text: (err as Error).message || "Scheduling failed.", ok: false });
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelScheduledDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/vault/schedule-delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to cancel scheduled deletion");
      setScheduledDeleteAt(null);
      setDeleteMsg({ text: "Scheduled vault deletion canceled.", ok: true });
    } catch (err) {
      setDeleteMsg({ text: (err as Error).message || "Cancel failed.", ok: false });
    } finally {
      setDeleting(false);
    }
  };

  const handleExecuteWipe = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/vault/items", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to execute vault wipe");
      setScheduledDeleteAt(null);
      setDeleteMsg({ text: "All vault items permanently deleted.", ok: true });
    } catch (err) {
      setDeleteMsg({ text: (err as Error).message || "Wipe failed.", ok: false });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteAccountConfirm !== "DELETE ACCOUNT" || !user?.uid) return;
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/settings/delete-account", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete account");
      await authClient.signOut();
      window.location.href = "/auth";
    } catch (err) {
      setAccountDeleteMsg({ text: (err as Error).message || "Account deletion failed.", ok: false });
      setDeletingAccount(false);
    }
  };

  return (
    <div className="pb-20 max-w-5xl mx-auto">
      <div className="mb-10 border-b border-[var(--border)] pb-6">
        <h1 className="text-[22px] font-semibold text-neutral-100">Data</h1>
        <p className="text-[14px] text-neutral-500 mt-1">Export, import, and manage your vault data.</p>
      </div>

      <Section title="Export Vault" description="Download an encrypted JSON snapshot of your vault.">
        <FieldBox>
          <div className="space-y-4 max-w-md">
            <label className="flex items-center gap-4 cursor-pointer group relative">
              <div className="relative w-[36px] h-[20px]">
                <input type="checkbox" checked={useExportPassphrase} onChange={(e) => setUseExportPassphrase(e.target.checked)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className={`w-[36px] h-[20px] rounded-full transition-colors relative border ${
                  useExportPassphrase 
                    ? "bg-[var(--accent)] border-[var(--accent)]" 
                    : "bg-neutral-900 border-neutral-700 group-hover:border-neutral-500"
                }`}>
                  <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all shadow-sm ${
                    useExportPassphrase 
                      ? "bg-[var(--bg)] left-[18px]" 
                      : "bg-neutral-500 left-[2px] group-hover:bg-neutral-300"
                  }`} />
                </div>
              </div>
              <span className="text-[13px] text-neutral-300 font-medium group-hover:text-neutral-100 transition-colors">Protect with passphrase</span>
            </label>
            
            {useExportPassphrase && (
              <Input type="password" value={exportPassphrase} onChange={(e) => setExportPassphrase(e.target.value)} placeholder="Enter export passphrase" className="bg-neutral-900 border-neutral-800" />
            )}

            <div className="flex items-center gap-4 pt-2">
              <Button onClick={handleExport} variant="primary" disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Export {items.length} item(s)
              </Button>
              <StatusMsg {...exportMsg} />
            </div>
          </div>
        </FieldBox>
      </Section>

      <Section title="Import Vault" description="Restore a vaultr export file (.json or .enc). Existing items are preserved.">
        <FieldBox>
          <div className="space-y-4 max-w-md">
            <Input type="password" value={importPassphrase} onChange={(e) => setImportPassphrase(e.target.value)} placeholder="Passphrase (if protected)" className="bg-neutral-900 border-neutral-800" />
            <input ref={importRef} type="file" accept=".json,.enc" className="hidden" onChange={handleImport} />
            
            <div className="flex items-center gap-4 pt-2">
              <Button onClick={() => importRef.current?.click()} disabled={importing} variant="default">
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Choose File
              </Button>
              <StatusMsg {...importMsg} />
            </div>
          </div>
        </FieldBox>
      </Section>

      <Section title="Import from CSV" description="Import entries from LastPass, Bitwarden, 1Password, Chrome, etc.">
        <FieldBox>
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex items-center gap-4">
                <Button onClick={() => csvRef.current?.click()} variant="default">
                  <FileText className="w-4 h-4 mr-2" /> Select CSV File
                </Button>
                <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
              </div>
            </div>

            {csvRows.length > 0 && (
              <div className="space-y-4 pt-5 mt-4 border-t border-neutral-800">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-neutral-300">Previewing <span className="text-white">{csvRows.length}</span> entries</p>
                  <div className="flex items-center gap-2">
                    {(["skip", "overwrite"] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setCsvConflict(opt)}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors border ${
                          csvConflict === opt ? "border-neutral-500 bg-neutral-800 text-neutral-200" : "border-transparent text-neutral-500 hover:text-neutral-300"
                        }`}
                      >
                        {opt} Conflict
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-neutral-800 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto bg-neutral-900/50">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-neutral-900 sticky top-0 border-b border-neutral-800">
                      <tr>
                        <th className="px-4 py-2.5 font-medium text-neutral-400">Name</th>
                        <th className="px-4 py-2.5 font-medium text-neutral-400">Type</th>
                        <th className="px-4 py-2.5 font-medium text-neutral-400">Username</th>
                        <th className="px-4 py-2.5 font-medium text-neutral-400">URL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {csvRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="px-4 py-2 text-neutral-300">{row.name}</td>
                          <td className="px-4 py-2 text-neutral-500 capitalize">{row.payload._template}</td>
                          <td className="px-4 py-2 text-neutral-500">{row.payload.username || "—"}</td>
                          <td className="px-4 py-2 text-neutral-500 truncate max-w-[150px]">{row.payload.url || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvRows.length > 50 && (
                    <div className="p-2 text-center text-[11px] text-neutral-500 bg-neutral-900 border-t border-neutral-800">
                      Showing 50 of {csvRows.length} rows
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <Button onClick={handleCsvImport} variant="primary" disabled={csvSaving}>
                    {csvSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importing {csvProgress}%</> : "Confirm Import"}
                  </Button>
                  <button onClick={() => setCsvRows([])} className="text-[13px] font-medium text-neutral-500 hover:text-neutral-300 transition-colors">Cancel</button>
                  <StatusMsg {...csvMsg} />
                </div>
              </div>
            )}
          </div>
        </FieldBox>
      </Section>

      <Section title="Danger Zone" description="Irreversible, destructive actions.">
        <div className="space-y-6">
          <FieldBox className="border-red-900/30 bg-red-950/10">
            <div className="space-y-5 max-w-md">
              <div className="space-y-1">
                <h3 className="text-[13px] font-semibold text-red-500 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" /> Delete Vault Data
                </h3>
                <p className="text-[12px] text-red-500/70">
                  Wipe all {liveItems.length} item(s) from your vault. Your account remains.
                </p>
              </div>

              {scheduledDeleteAt ? (
                <div className="space-y-4 p-4 border border-amber-900/50 bg-amber-950/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[13px] font-semibold text-amber-200">
                        {new Date() >= new Date(scheduledDeleteAt)
                          ? "24-Hour Cooldown Elapsed"
                          : "Vault Deletion Scheduled"}
                      </p>
                      <p className="text-[12px] text-amber-400/80 leading-relaxed">
                        {new Date() >= new Date(scheduledDeleteAt)
                          ? "The 24-hour waiting period has completed. You may now permanently wipe all vault data."
                          : `Scheduled for ${new Date(scheduledDeleteAt).toLocaleString()}. An alert email was dispatched. You can cancel this request anytime before the timer completes.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    {new Date() >= new Date(scheduledDeleteAt) && (
                      <Button onClick={handleExecuteWipe} variant="danger" disabled={deleting}>
                        {deleting ? "Executing Wipe…" : "Execute Final Vault Wipe"}
                      </Button>
                    )}
                    <Button onClick={handleCancelScheduledDelete} variant="default" disabled={deleting}>
                      {deleting ? "Canceling…" : "Cancel Deletion Request"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder='Type "DELETE" to confirm'
                    className="font-mono bg-red-950/20 border-red-900/40 text-red-400 focus:border-red-500/50"
                  />
                  <Input
                    type="password"
                    value={masterPasswordInput}
                    onChange={(e) => setMasterPasswordInput(e.target.value)}
                    placeholder="Enter Master Password to confirm"
                    className="bg-red-950/20 border-red-900/40 text-neutral-200 focus:border-red-500/50"
                  />
                  <div className="flex items-center gap-4 pt-1">
                    <Button
                      onClick={handleScheduleDeleteVault}
                      variant="danger"
                      disabled={deleteConfirm !== "DELETE" || !masterPasswordInput || deleting}
                    >
                      {deleting ? "Scheduling…" : "Schedule Vault Deletion (24h Delay)"}
                    </Button>
                    <StatusMsg {...deleteMsg} />
                  </div>
                </div>
              )}
            </div>
          </FieldBox>

          <FieldBox className="border-red-900/30 bg-red-950/10">
            <div className="space-y-5 max-w-md">
              <div className="space-y-1">
                <h3 className="text-[13px] font-semibold text-red-500 flex items-center gap-2"><UserX className="w-3.5 h-3.5" /> Delete Account</h3>
                <p className="text-[12px] text-red-500/70">Permanently delete your account and all associated vault data.</p>
              </div>
              <div className="space-y-3">
                <Input value={deleteAccountConfirm} onChange={(e) => setDeleteAccountConfirm(e.target.value)} placeholder='Type "DELETE ACCOUNT" to confirm' className="font-mono bg-red-950/20 border-red-900/40 text-red-400 focus:border-red-500/50" />
                <div className="flex items-center gap-4">
                  <Button onClick={handleDeleteAccount} variant="danger" disabled={deleteAccountConfirm !== "DELETE ACCOUNT" || deletingAccount}>
                    {deletingAccount ? "Deleting…" : "Delete Account"}
                  </Button>
                  <StatusMsg {...accountDeleteMsg} />
                </div>
              </div>
            </div>
          </FieldBox>
        </div>
      </Section>
    </div>
  );
}

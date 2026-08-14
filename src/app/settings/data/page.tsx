"use client";

import React, { useState, useRef, useEffect, ChangeEvent } from "react";
import Papa from "papaparse";
import { useAuth } from "@/hooks/useAuth";
import { useVault } from "@/context/VaultContext";
import { useCrypto, deriveKey } from "@/hooks/useCrypto";
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
  Database,
  Clock,
  Trash2,
  KeyRound,
  CreditCard,
  FileJson,
  Search,
  Key,
  Folder,
  X,
  AlertTriangle,
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

import {
  parseImportFileContent,
  type ParsedImportItem,
  type ConflictMode,
  type DuplicateCheckResult,
} from "@vaultr/core";
import { ImportPreviewModal } from "@/components/vault/ImportPreviewModal";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DataSettingsPage() {
  const { user } = useAuth();
  const { items, encryptData, decryptItem, batchAction, fetchItems } = useVault();

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [useExportPassphrase, setUseExportPassphrase] = useState(true);
  const [exportMsg, setExportMsg] = useState({ text: "", ok: true });

  // Native Backup (.json / .enc) Import state
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importMsg, setImportMsg] = useState({ text: "", ok: true });
  const [backupProgress, setBackupProgress] = useState<number | null>(null);

  // File Import / Preview State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedExternalFile, setSelectedExternalFile] = useState<File | null>(null);
  const [previewItems, setPreviewItems] = useState<ParsedImportItem[]>([]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importStatusMsg, setImportStatusMsg] = useState({ text: "", ok: true });
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [sourceFileName, setSourceFileName] = useState("");

  // Revert / Undo State
  const [lastImportedBatch, setLastImportedBatch] = useState<{
    insertedIds: string[];
    count: number;
  } | null>(null);
  const [reverting, setReverting] = useState(false);

  // Danger zone state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [masterPasswordInput, setMasterPasswordInput] = useState("");
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState({ text: "", ok: true });
  const [accountDeleteMsg, setAccountDeleteMsg] = useState({ text: "", ok: true });

  const [scheduledDeleteAt, setScheduledDeleteAt] = useState<string | null>(null);
  const [, setFetchingSchedule] = useState(true);

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

  const liveItems = React.useMemo(() => items.filter((i) => !i.deletedAt), [items]);

  // Decrypted index of existing items for multi-factor duplicate matching (logins, notes, cards, etc.)
  const [decryptedExistingItems, setDecryptedExistingItems] = useState<Array<{
    id: string;
    name: string;
    domain?: string | null;
    template?: string | null;
    username?: string | null;
  }>>([]);

  const itemsSignature = React.useMemo(
    () => liveItems.map((i) => `${i.id}-${i.updatedAt || ""}`).join("|"),
    [liveItems]
  );

  useEffect(() => {
    let isCancelled = false;
    async function loadExistingDecrypted() {
      if (liveItems.length === 0) {
        setDecryptedExistingItems([]);
        return;
      }
      try {
        const list = await Promise.all(
          liveItems.map(async (item) => {
            let username: string | null = null;
            let domain = item.domain || null;
            try {
              if (item.encryptedBlob) {
                const raw = await decryptItem(item.encryptedBlob);
                const parsed = JSON.parse(raw);
                username = parsed.username || parsed.email || null;
                if (!domain && (parsed.url || parsed.urls?.[0])) {
                  domain = parsed.url || parsed.urls?.[0];
                }
              }
            } catch {}
            return {
              id: item.id,
              name: item.name,
              domain,
              template: item.template || "login",
              username,
            };
          })
        );
        if (!isCancelled) {
          setDecryptedExistingItems(list);
        }
      } catch {}
    }
    loadExistingDecrypted();
    return () => {
      isCancelled = true;
    };
  }, [itemsSignature]);

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

  // ─── Native Vaultr Backup (.json / .enc) Import ──────────────────────────────

  const handleNativeImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    setImporting(true);
    setImportMsg({ text: "", ok: true });
    setBackupProgress(0);

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

      // Batch processing in chunks of 50 to prevent request queue limit crashes
      const validItems = parsed.items.filter((i: any) => i.encryptedBlob);
      const CHUNK_SIZE = 50;
      let totalInserted = 0;

      for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
        const chunk = validItems.slice(i, i + CHUNK_SIZE);
        const payloadItems = chunk.map((item: any) => ({
          name: item.name,
          encryptedBlob: item.encryptedBlob,
          domain: item.domain ?? null,
          folder: item.folder ?? null,
          template: item.template ?? "login",
          tags: item.tags ?? [],
          favorite: item.favorite ?? false,
          hasTotp: item.hasTotp ?? false,
        }));

        const res = await fetch("/api/vault/items/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payloadItems }),
        });

        if (!res.ok) throw new Error("Failed to import batch from backup file");
        const resData = await res.json();
        totalInserted += resData.inserted || 0;

        setBackupProgress(Math.round(((i + chunk.length) / validItems.length) * 100));
        await new Promise((r) => setTimeout(r, 10));
      }

      setImportMsg({ text: `Imported ${totalInserted} item(s) from backup successfully.`, ok: true });
    } catch (err) {
      setImportMsg({ text: (err as Error).message || "Import failed.", ok: false });
    } finally {
      setImporting(false);
      setBackupProgress(null);
      if (importRef.current) importRef.current.value = "";
    }
  };

  // ─── External File Selection (CSV or Bitwarden JSON) ──────────────────────────

  const handleExternalFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedExternalFile(file);
    setSourceFileName(file.name);
    setImportStatusMsg({ text: "", ok: true });

    // Automatically parse the selected file and open the preview modal popup
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseImportFileContent(text, file.name);
        if (parsed && parsed.length > 0) {
          setPreviewItems(parsed);
          setIsPreviewModalOpen(true);
        } else {
          setImportStatusMsg({
            text: "Could not detect valid credentials or supported entries in the selected file.",
            ok: false,
          });
        }
      } catch (err) {
        setImportStatusMsg({ text: `Failed to parse file: ${(err as Error).message}`, ok: false });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleParseExternalFile = () => {
    if (previewItems.length > 0) {
      setIsPreviewModalOpen(true);
      return;
    }
    if (selectedExternalFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = parseImportFileContent(text, selectedExternalFile.name);
          if (parsed && parsed.length > 0) {
            setPreviewItems(parsed);
            setIsPreviewModalOpen(true);
          } else {
            setImportStatusMsg({
              text: "Could not detect valid credentials or supported entries in the selected file.",
              ok: false,
            });
          }
        } catch (err) {
          setImportStatusMsg({ text: `Failed to parse file: ${(err as Error).message}`, ok: false });
        }
      };
      reader.readAsText(selectedExternalFile);
      return;
    }
    fileInputRef.current?.click();
  };

  // ─── Execute Preview Bulk Import (Chunked Engine from Modal) ───────────────

  const handleConfirmImport = async (
    itemsToImport: ParsedImportItem[],
    conflictMode: ConflictMode,
    duplicateMap: Map<string, DuplicateCheckResult>
  ) => {
    if (!user?.uid || itemsToImport.length === 0) return;
    setImportSaving(true);
    setImportStatusMsg({ text: "", ok: true });
    setImportProgress(0);

    try {
      // 1. Filter out duplicates if mode is "skip"
      let finalItemsToImport = itemsToImport;
      if (conflictMode === "skip") {
        finalItemsToImport = itemsToImport.filter((item) => !duplicateMap.get(item.id)?.isDuplicate);
      }

      if (finalItemsToImport.length === 0) {
        setImportStatusMsg({
          text: "All selected entries were skipped because matching items already exist in your vault.",
          ok: true,
        });
        setIsPreviewModalOpen(false);
        setImportSaving(false);
        return;
      }

      const CHUNK_SIZE = 50;
      let totalInserted = 0;
      let totalUpdated = 0;
      const allInsertedIds: string[] = [];
      const allFailedItems: Array<{ name: string; reason: string }> = [];

      for (let i = 0; i < finalItemsToImport.length; i += CHUNK_SIZE) {
        const chunk = finalItemsToImport.slice(i, i + CHUNK_SIZE);
        const validEncryptedItems: any[] = [];

        // Parallel encryption within batch chunk
        for (const item of chunk) {
          try {
            const encryptedBlob = await encryptData(JSON.stringify(item.payload));
            const primaryUrl = item.payload.url || (item.payload.urls && item.payload.urls[0]) || "";
            let domain: string | null = null;
            if (primaryUrl) {
              const trimmedUrl = primaryUrl.trim().toLowerCase();
              if (trimmedUrl.startsWith("androidapp:")) {
                domain = trimmedUrl;
              } else {
                try {
                  domain = new URL(trimmedUrl.startsWith("http") ? trimmedUrl : `https://${trimmedUrl}`).hostname;
                } catch {
                  domain = null;
                }
              }
            }

            const dup = duplicateMap.get(item.id);
            const updateId = conflictMode === "overwrite" && dup?.isDuplicate ? dup.matchedItemId : undefined;

            validEncryptedItems.push({
              id: updateId,
              name: item.name,
              folder: item.folder || null,
              encryptedBlob,
              domain,
              template: item.payload._template || item.template || "login",
              tags: [],
              favorite: false,
              hasTotp: !!item.payload.totpSecret,
            });
          } catch (encErr: any) {
            allFailedItems.push({
              name: item.name,
              reason: encErr?.message || "Encryption error",
            });
          }
        }

        if (validEncryptedItems.length > 0) {
          try {
            const res = await fetch("/api/vault/items/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: validEncryptedItems }),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || "Bulk import request failed");
            }

            const resData = await res.json();
            totalInserted += resData.inserted || 0;
            totalUpdated += resData.updated || 0;
            if (resData.insertedIds && Array.isArray(resData.insertedIds)) {
              allInsertedIds.push(...resData.insertedIds);
            }
            if (resData.failedItems && Array.isArray(resData.failedItems)) {
              allFailedItems.push(...resData.failedItems);
            }
          } catch (apiErr: any) {
            validEncryptedItems.forEach((it) => {
              allFailedItems.push({
                name: it.name,
                reason: apiErr?.message || "API request failed",
              });
            });
          }
        }

        setImportProgress(Math.round(((i + chunk.length) / finalItemsToImport.length) * 100));
        // Small yield point to maintain browser responsiveness
        await new Promise((r) => setTimeout(r, 10));
      }

      if (allInsertedIds.length > 0) {
        setLastImportedBatch({ insertedIds: allInsertedIds, count: allInsertedIds.length });
      }

      // Re-fetch items from server
      try {
        await fetchItems();
      } catch {}

      setPreviewItems([]);
      setIsPreviewModalOpen(false);
      setSelectedExternalFile(null);
      setImportProgress(null);

      let summaryMsg =
        totalUpdated > 0
          ? `Successfully imported ${totalInserted} new item(s) and updated ${totalUpdated} existing item(s).`
          : `Successfully imported ${totalInserted} item(s) to your vault.`;

      if (allFailedItems.length > 0) {
        summaryMsg += ` (${allFailedItems.length} item(s) failed: ${allFailedItems
          .slice(0, 2)
          .map((f) => f.name)
          .join(", ")}${allFailedItems.length > 2 ? "..." : ""})`;
      }

      setImportStatusMsg({ text: summaryMsg, ok: allFailedItems.length === 0 });
    } catch (err) {
      setImportStatusMsg({ text: (err as Error).message || "Import failed.", ok: false });
    } finally {
      setImportSaving(false);
    }
  };

  const handleRevertImport = async () => {
    if (!lastImportedBatch || lastImportedBatch.insertedIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to revert this import and permanently delete the ${lastImportedBatch.count} newly added entries?`
      )
    ) {
      return;
    }

    setReverting(true);
    try {
      await batchAction("purge", lastImportedBatch.insertedIds);
      await fetchItems();
      const count = lastImportedBatch.count;
      setLastImportedBatch(null);
      setImportStatusMsg({ text: `Successfully reverted import and removed ${count} items.`, ok: true });
    } catch (err: any) {
      setImportStatusMsg({ text: err.message || "Failed to revert import.", ok: false });
    } finally {
      setReverting(false);
    }
  };

  // ─── Deletion ────────────────────────────────────────────────────

  const handleScheduleDeleteVault = async () => {
    if (deleteConfirm !== "DELETE" || !masterPasswordInput || !user?.id) return;
    setDeleting(true);
    setDeleteMsg({ text: "", ok: true });
    try {
      if (items.length > 0) {
        try {
          const derived = await deriveKey(masterPasswordInput, user.id);
          await decrypt(derived, items[0].encryptedBlob);
        } catch {
          setDeleteMsg({ text: "Incorrect Master Password.", ok: false });
          setDeleting(false);
          return;
        }
      }

      const res = await fetch("/api/vault/schedule-delete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule deletion");

      setScheduledDeleteAt(data.scheduledDeleteAt);
      setDeleteMsg({ text: "Vault deletion scheduled. An alert email was dispatched.", ok: true });
      setDeleteConfirm("");
      setMasterPasswordInput("");
    } catch (err: any) {
      setDeleteMsg({ text: err.message || "Failed to schedule deletion.", ok: false });
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelScheduledDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/vault/schedule-delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to cancel deletion");
      setScheduledDeleteAt(null);
      setDeleteMsg({ text: "Vault deletion request canceled.", ok: true });
    } catch (err: any) {
      setDeleteMsg({ text: err.message || "Failed to cancel.", ok: false });
    } finally {
      setDeleting(false);
    }
  };

  const handleExecuteWipe = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/vault/items", { method: "DELETE" });
      if (!res.ok) throw new Error("Wipe failed");
      setScheduledDeleteAt(null);
      setDeleteMsg({ text: "Vault data wiped successfully.", ok: true });
      window.location.reload();
    } catch (err: any) {
      setDeleteMsg({ text: err.message || "Failed to wipe vault.", ok: false });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteAccountConfirm !== "DELETE ACCOUNT") return;
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/vault/profile", { method: "DELETE" });
      if (!res.ok) throw new Error("Account deletion failed");
      window.location.href = "/auth";
    } catch (err: any) {
      setAccountDeleteMsg({ text: err.message || "Failed to delete account.", ok: false });
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ─── Export ────────────────────────────────────────────────────────── */}
      <Section title="Export Vault" description="Save an encrypted or unencrypted backup of all your vault items.">
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

      {/* ─── Restore Vaultr Backup ────────────────────────────────────────────── */}
      <Section title="Restore Backup" description="Restore a native Vaultr export file (.json or .enc). Existing items are preserved.">
        <FieldBox>
          <div className="space-y-4 max-w-md">
            <Input type="password" value={importPassphrase} onChange={(e) => setImportPassphrase(e.target.value)} placeholder="Passphrase (if protected)" className="bg-neutral-900 border-neutral-800" />
            <input ref={importRef} type="file" accept=".json,.enc" className="hidden" onChange={handleNativeImport} />
            
            <div className="flex items-center gap-4 pt-2">
              <Button onClick={() => importRef.current?.click()} disabled={importing} variant="default">
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {importing && backupProgress !== null ? `Restoring ${backupProgress}%` : "Choose Backup File"}
              </Button>
              <StatusMsg {...importMsg} />
            </div>
          </div>
        </FieldBox>
      </Section>

      {/* ─── External Import (Bitwarden, 1Password, CSV, Passkeys) ─────────────── */}
      <Section title="Import External Data" description="Import entries from Bitwarden, LastPass, 1Password, Chrome, Dashlane, KeePass, etc.">
        <FieldBox>
          <div className="space-y-4 max-w-md">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={handleExternalFileChange}
            />

            {/* File selection box & chosen filename badge */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-[13px] font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/80 hover:border-neutral-700 transition-all cursor-pointer shrink-0"
              >
                <FileText className="w-4 h-4 text-neutral-400" />
                <span>{selectedExternalFile ? "Change File" : "Select File"}</span>
              </button>

              <div className="flex-1 min-w-0 px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-800/80 text-[13px] truncate">
                {selectedExternalFile ? (
                  <span className="text-neutral-200 font-medium">{selectedExternalFile.name}</span>
                ) : (
                  <span className="text-neutral-600">CSV or Bitwarden JSON</span>
                )}
              </div>
            </div>

            {/* Action Row matching theme of Export Vault / Restore Backup */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                onClick={handleParseExternalFile}
                disabled={!selectedExternalFile && previewItems.length === 0}
                variant="default"
              >
                <Upload className="w-4 h-4 mr-2" />
                {previewItems.length > 0 ? `Review & Import (${previewItems.length} items)` : "Import File"}
              </Button>
              {lastImportedBatch && (
                <Button
                  onClick={handleRevertImport}
                  disabled={reverting}
                  variant="danger"
                  className="text-[12px] h-9 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300"
                >
                  {reverting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Undo Last Import ({lastImportedBatch.count} items)
                </Button>
              )}
              <StatusMsg {...importStatusMsg} />
            </div>

            <p className="text-[12px] text-neutral-500 pt-1">
              Supports CSV & Bitwarden JSON (Logins, Cards, Notes, Addresses, Profiles, Passkeys).
            </p>
          </div>
        </FieldBox>
      </Section>

      {/* ─── Danger Zone ────────────────────────────────────────────────────── */}
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

      {/* ─── Import Preview Popup Modal ────────────────────────────────────── */}
      <ImportPreviewModal
        open={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        fileName={sourceFileName}
        initialItems={previewItems}
        existingItems={decryptedExistingItems}
        onConfirmImport={handleConfirmImport}
        importSaving={importSaving}
        importProgress={importProgress}
      />
    </div>
  );
}

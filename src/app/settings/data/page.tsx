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

// ─── CSV & JSON → DecryptedPayload Mapping Helpers ─────────────────────────────

interface GenericImportRow {
  name?: string;
  username?: string;
  password?: string;
  url?: string;
  login_username?: string;
  login_password?: string;
  login_uri?: string;
  login_totp?: string;
  login_notes?: string;
  totp?: string;
  note?: string;
  notes?: string;
  folder?: string;
  group?: string;
  grouping?: string;
  card_number?: string;
  cc_number?: string;
  expiry?: string;
  cvv?: string;
  pin?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  passkey_id?: string;
  credential_id?: string;
  rp_id?: string;
  user_handle?: string;
  [key: string]: string | undefined;
}

export interface ParsedImportItem {
  id: string; // temp client ID for preview list manipulation
  name: string;
  folder: string;
  payload: DecryptedPayload;
}

// Extract and normalize multiple URLs from various CSV columns & comma-separated strings
function parseUrls(row: GenericImportRow): string[] {
  const candidates = [
    row.url,
    row.login_uri,
    row["URL 1"],
    row["URL 2"],
    row["URL 3"],
    row.login_uri2,
    row.login_uri3,
    row.website,
  ];

  const parsed: string[] = [];
  for (const item of candidates) {
    if (!item) continue;
    // Handle comma-separated URIs (e.g. Bitwarden / 1Password)
    const parts = item.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    for (const p of parts) {
      if (!parsed.includes(p)) parsed.push(p);
    }
  }
  return parsed;
}

function mapCsvRow(row: GenericImportRow, index: number): ParsedImportItem {
  const urls = parseUrls(row);
  const primaryUrl = urls[0] || "";

  // Template auto-detection
  let _template: "login" | "card" | "note" | "address" | "profile" = "login";
  if (row.card_number || row.cc_number) _template = "card";
  else if (row.address || row.city) _template = "address";
  else if (!primaryUrl && !row.password && !row.login_password && (row.note || row.notes)) _template = "note";

  const name =
    row.name ||
    primaryUrl ||
    (row.note || row.notes ? "Imported Note" : `Imported Entry #${index + 1}`);

  const folder = row.folder || row.group || row.grouping || "";

  // Passkey detection
  const isPasskey = !!(row.passkey_id || row.credential_id || row.rp_id);

  const payload: DecryptedPayload = {
    _template,
    username: row.username || row.login_username || "",
    password: row.password || row.login_password || "",
    url: primaryUrl,
    urls: urls.length > 0 ? urls : primaryUrl ? [primaryUrl] : [],
    totpSecret: row.totp || row.login_totp || "",
    entryNotes: row.note || row.notes || row.login_notes || "",
    cardNumber: row.card_number || row.cc_number || "",
    expiry: row.expiry || "",
    cvv: row.cvv || "",
    pin: row.pin || "",
    line1: row.address || "",
    city: row.city || "",
    state: row.state || "",
    zip: row.zip || "",
    country: row.country || "",
    isPasskey,
    passkeyRpId: row.rp_id || "",
    passkeyCredentialId: row.passkey_id || row.credential_id || "",
    passkeyUserHandle: row.user_handle || "",
  };

  return {
    id: `csv-${index}-${Date.now()}`,
    name,
    folder,
    payload,
  };
}

// ─── Bitwarden JSON Importer ──────────────────────────────────────────────────

function parseBitwardenJson(data: any): ParsedImportItem[] {
  if (!data || !Array.isArray(data.items)) return [];

  const folderMap = new Map<string, string>();
  if (Array.isArray(data.folders)) {
    for (const f of data.folders) {
      if (f.id && f.name) folderMap.set(f.id, f.name);
    }
  }

  const result: ParsedImportItem[] = [];

  data.items.forEach((item: any, idx: number) => {
    if (!item) return;

    let _template: "login" | "card" | "note" | "address" | "profile" = "login";
    // Bitwarden item types: 1 = Login, 2 = SecureNote, 3 = Card, 4 = Identity
    if (item.type === 2) _template = "note";
    else if (item.type === 3) _template = "card";
    else if (item.type === 4) _template = "profile";

    const name = item.name || `Imported Item #${idx + 1}`;
    const folder = (item.folderId && folderMap.get(item.folderId)) || "";

    const loginData = item.login || {};
    const cardData = item.card || {};
    const identityData = item.identity || {};
    const secureNoteData = item.secureNote || {};

    // Extract URIs
    const urls: string[] = [];
    if (Array.isArray(loginData.uris)) {
      loginData.uris.forEach((u: any) => {
        if (u?.uri && typeof u.uri === "string") urls.push(u.uri);
      });
    }

    // Custom fields → entryNotes or customFields
    let extraNotes = item.notes || "";
    if (Array.isArray(item.fields) && item.fields.length > 0) {
      const fieldLines = item.fields
        .map((f: any) => (f.name ? `${f.name}: ${f.value || ""}` : f.value))
        .filter(Boolean);
      if (fieldLines.length > 0) {
        extraNotes += (extraNotes ? "\n\n--- Custom Fields ---\n" : "") + fieldLines.join("\n");
      }
    }

    // Passkeys in Bitwarden
    const fido2 = Array.isArray(loginData.fido2Credentials) ? loginData.fido2Credentials[0] : null;

    const payload: DecryptedPayload = {
      _template,
      username: loginData.username || "",
      password: loginData.password || "",
      url: urls[0] || "",
      urls: urls.length > 0 ? urls : [],
      totpSecret: loginData.totp || "",
      entryNotes: extraNotes,

      // Card
      cardNumber: cardData.number || "",
      cardName: cardData.cardholderName || "",
      expiry: cardData.expirationMonth && cardData.expirationYear ? `${cardData.expirationMonth}/${cardData.expirationYear}` : "",
      cvv: cardData.code || "",

      // Profile / Identity
      fullName: identityData.firstName && identityData.lastName ? `${identityData.firstName} ${identityData.lastName}` : identityData.firstName || "",
      email: identityData.email || "",
      phone: identityData.phone || "",
      line1: identityData.address1 || "",
      city: identityData.city || "",
      state: identityData.state || "",
      zip: identityData.postalCode || "",
      country: identityData.country || "",

      // Passkey
      isPasskey: !!fido2,
      passkeyRpId: fido2?.rpId || "",
      passkeyCredentialId: fido2?.credentialId || "",
      passkeyUserHandle: fido2?.userHandle || "",
    };

    result.push({
      id: `bw-${idx}-${Date.now()}`,
      name,
      folder,
      payload,
    });
  });

  return result;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DataSettingsPage() {
  const { user } = useAuth();
  const { items, encryptData } = useVault();

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
  const [previewItems, setPreviewItems] = useState<ParsedImportItem[]>([]);
  const [importSaving, setImportSaving] = useState(false);
  const [conflictMode, setConflictMode] = useState<"skip" | "overwrite">("skip");
  const [importStatusMsg, setImportStatusMsg] = useState({ text: "", ok: true });
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");

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

  const handleExternalFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatusMsg({ text: "", ok: true });
    setSourceFileName(file.name);

    const isJson = file.name.endsWith(".json");

    if (isJson) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && Array.isArray(parsed.items)) {
            const bwItems = parseBitwardenJson(parsed);
            setPreviewItems(bwItems);
          } else {
            setImportStatusMsg({ text: "Unrecognized JSON format. Expected Bitwarden export format.", ok: false });
          }
        } catch (err) {
          setImportStatusMsg({ text: `Failed to parse JSON file: ${(err as Error).message}`, ok: false });
        }
      };
      reader.readAsText(file);
    } else {
      Papa.parse<GenericImportRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const items = result.data.map(mapCsvRow);
          setPreviewItems(items);
        },
        error: (err: { message: string }) => setImportStatusMsg({ text: err.message, ok: false }),
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Execute Preview Bulk Import (Chunked Engine) ──────────────────────────

  const handleConfirmImport = async () => {
    if (!user?.uid || previewItems.length === 0) return;
    setImportSaving(true);
    setImportStatusMsg({ text: "", ok: true });
    setImportProgress(0);

    try {
      // 1. Filter out duplicates if mode is "skip"
      const itemsToImport = previewItems.filter((item) => {
        if (conflictMode === "skip" && liveItems.some((live) => live.name.toLowerCase() === item.name.toLowerCase())) {
          return false;
        }
        return true;
      });

      if (itemsToImport.length === 0) {
        setImportStatusMsg({ text: "All selected entries were skipped (duplicates).", ok: true });
        setImportSaving(false);
        return;
      }

      const CHUNK_SIZE = 50;
      let totalInserted = 0;

      for (let i = 0; i < itemsToImport.length; i += CHUNK_SIZE) {
        const chunk = itemsToImport.slice(i, i + CHUNK_SIZE);

        // Parallel encryption within batch chunk
        const encryptedChunk = await Promise.all(
          chunk.map(async (item) => {
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

            return {
              name: item.name,
              folder: item.folder || null,
              encryptedBlob,
              domain,
              template: item.payload._template || "login",
              tags: [],
              favorite: false,
              hasTotp: !!item.payload.totpSecret,
            };
          })
        );

        // Single bulk insert API call per 50 items
        const res = await fetch("/api/vault/items/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: encryptedChunk }),
        });

        if (!res.ok) throw new Error("Bulk import request failed");
        const resData = await res.json();
        totalInserted += resData.inserted || 0;

        setImportProgress(Math.round(((i + chunk.length) / itemsToImport.length) * 100));
        // Small yield point to maintain browser responsiveness
        await new Promise((r) => setTimeout(r, 10));
      }

      setPreviewItems([]);
      setImportProgress(null);
      setImportStatusMsg({ text: `Successfully imported ${totalInserted} item(s) to your vault.`, ok: true });
    } catch (err) {
      setImportStatusMsg({ text: (err as Error).message || "Import failed.", ok: false });
    } finally {
      setImportSaving(false);
    }
  };

  // Preview List Handlers
  const handleRemovePreviewItem = (id: string) => {
    setPreviewItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItemTemplate = (id: string, newTemplate: "login" | "card" | "note" | "address" | "profile") => {
    setPreviewItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, payload: { ...item.payload, _template: newTemplate } };
        }
        return item;
      })
    );
  };

  // Preview Stats
  const stats = React.useMemo(() => {
    let logins = 0, cards = 0, notes = 0, addresses = 0, profiles = 0, passkeys = 0, duplicates = 0;
    const folderSet = new Set<string>();

    previewItems.forEach((item) => {
      const t = item.payload._template;
      if (item.payload.isPasskey) passkeys++;
      if (t === "login") logins++;
      else if (t === "card") cards++;
      else if (t === "note") notes++;
      else if (t === "address") addresses++;
      else if (t === "profile") profiles++;

      if (item.folder) folderSet.add(item.folder);

      if (liveItems.some((live) => live.name.toLowerCase() === item.name.toLowerCase())) {
        duplicates++;
      }
    });

    return { logins, cards, notes, addresses, profiles, passkeys, duplicates, folders: folderSet.size };
  }, [previewItems, liveItems]);

  const filteredPreviewItems = React.useMemo(() => {
    if (!searchFilter.trim()) return previewItems;
    const query = searchFilter.toLowerCase();
    return previewItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.payload.username && item.payload.username.toLowerCase().includes(query)) ||
        (item.payload.url && item.payload.url.toLowerCase().includes(query)) ||
        (item.folder && item.folder.toLowerCase().includes(query))
    );
  }, [previewItems, searchFilter]);

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
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex items-center gap-3">
                <Button onClick={() => fileInputRef.current?.click()} variant="default" className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700">
                  <FileText className="w-4 h-4 mr-2" /> Select File (CSV / Bitwarden JSON)
                </Button>
                <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleExternalFileSelect} />
              </div>
              <p className="text-[12px] text-neutral-500">Supports CSV & Bitwarden JSON (Logins, Cards, Notes, Passkeys)</p>
            </div>

            <StatusMsg {...importStatusMsg} />

            {/* Preview Modal / Table Panel */}
            {previewItems.length > 0 && (
              <div className="space-y-5 pt-5 mt-4 border-t border-neutral-800 animate-in fade-in duration-200">
                
                {/* Header & Stats Bar */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/80 p-4 rounded-xl border border-neutral-800">
                    <div>
                      <h3 className="text-[14px] font-semibold text-white flex items-center gap-2">
                        Previewing <span className="text-emerald-400">{previewItems.length}</span> Items
                        <span className="text-[11px] text-neutral-500 font-normal">from {sourceFileName}</span>
                      </h3>
                      <p className="text-[12px] text-neutral-400 mt-0.5">
                        Review entries, correct templates, or remove unwanted rows before importing.
                      </p>
                    </div>

                    {/* Conflict mode selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-neutral-400 font-medium">Conflict:</span>
                      {(["skip", "overwrite"] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setConflictMode(opt)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-semibold tracking-wide transition-colors border ${
                            conflictMode === opt
                              ? "border-neutral-500 bg-neutral-800 text-neutral-100 shadow-sm"
                              : "border-transparent text-neutral-500 hover:text-neutral-300"
                          }`}
                        >
                          {opt === "skip" ? "Skip Duplicates" : "Overwrite"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary Breakdown Pills */}
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 font-medium flex items-center gap-1.5">
                      <KeyRound className="w-3 h-3 text-emerald-400" /> Logins: {stats.logins}
                    </span>
                    {stats.passkeys > 0 && (
                      <span className="px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 font-medium flex items-center gap-1.5">
                        <Key className="w-3 h-3 text-emerald-400" /> Passkeys: {stats.passkeys}
                      </span>
                    )}
                    {stats.cards > 0 && (
                      <span className="px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 font-medium flex items-center gap-1.5">
                        <CreditCard className="w-3 h-3 text-blue-400" /> Cards: {stats.cards}
                      </span>
                    )}
                    {stats.notes > 0 && (
                      <span className="px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 font-medium flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-amber-400" /> Notes: {stats.notes}
                      </span>
                    )}
                    {stats.folders > 0 && (
                      <span className="px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 font-medium flex items-center gap-1.5">
                        <Folder className="w-3 h-3 text-purple-400" /> Folders: {stats.folders}
                      </span>
                    )}
                    {stats.duplicates > 0 && (
                      <span className="px-2.5 py-1 rounded-md bg-amber-950/30 border border-amber-800/40 text-amber-300 font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400" /> Duplicates: {stats.duplicates} {conflictMode === "skip" ? "(will skip)" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Filter Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter preview items by name, username, URL, or folder..."
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-[12px] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                  />
                  {searchFilter && (
                    <button onClick={() => setSearchFilter("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Preview Data Grid */}
                <div className="border border-neutral-800 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto bg-neutral-950/60 shadow-inner">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-neutral-900/90 sticky top-0 border-b border-neutral-800 backdrop-blur-md z-10">
                      <tr>
                        <th className="px-3.5 py-2.5 font-medium text-neutral-400">Name</th>
                        <th className="px-3.5 py-2.5 font-medium text-neutral-400">Type</th>
                        <th className="px-3.5 py-2.5 font-medium text-neutral-400">Username</th>
                        <th className="px-3.5 py-2.5 font-medium text-neutral-400">URL / Target</th>
                        <th className="px-3.5 py-2.5 font-medium text-neutral-400">Folder</th>
                        <th className="px-3.5 py-2.5 font-medium text-neutral-400 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {filteredPreviewItems.map((item) => {
                        const isDuplicate = liveItems.some((live) => live.name.toLowerCase() === item.name.toLowerCase());
                        const primaryUrl = item.payload.url || (item.payload.urls && item.payload.urls[0]) || "";

                        return (
                          <tr key={item.id} className={`hover:bg-neutral-800/40 transition-colors ${isDuplicate ? "bg-amber-950/10" : ""}`}>
                            <td className="px-3.5 py-2 text-neutral-200 font-medium">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[180px]">{item.name}</span>
                                {item.payload.isPasskey && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">Passkey</span>
                                )}
                                {isDuplicate && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px]" title="Item with this name already exists in vault">Duplicate</span>
                                )}
                              </div>
                            </td>

                            <td className="px-3.5 py-2">
                              <select
                                value={item.payload._template || "login"}
                                onChange={(e) => handleUpdateItemTemplate(item.id, e.target.value as any)}
                                className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-neutral-600"
                              >
                                <option value="login">Login</option>
                                <option value="card">Card</option>
                                <option value="note">Note</option>
                                <option value="address">Address</option>
                                <option value="profile">Profile</option>
                              </select>
                            </td>

                            <td className="px-3.5 py-2 text-neutral-400 truncate max-w-[140px]">
                              {item.payload.username || "—"}
                            </td>

                            <td className="px-3.5 py-2 text-neutral-400 truncate max-w-[180px]" title={primaryUrl}>
                              {primaryUrl || "—"}
                              {item.payload.urls && item.payload.urls.length > 1 && (
                                <span className="text-[10px] text-neutral-500 ml-1">({item.payload.urls.length} URLs)</span>
                              )}
                            </td>

                            <td className="px-3.5 py-2 text-neutral-400 truncate max-w-[110px]">
                              {item.folder ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-purple-400">
                                  <Folder className="w-3 h-3" /> {item.folder}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td className="px-3.5 py-2 text-right">
                              <button
                                onClick={() => handleRemovePreviewItem(item.id)}
                                className="p-1 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                title="Remove entry from import list"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Import Confirmation Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button onClick={handleConfirmImport} variant="primary" disabled={importSaving} className="w-full sm:w-auto">
                      {importSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Importing {importProgress !== null ? `${importProgress}%` : "..."}
                        </>
                      ) : (
                        `Confirm Import (${previewItems.length} items)`
                      )}
                    </Button>
                    <button
                      onClick={() => setPreviewItems([])}
                      disabled={importSaving}
                      className="px-3 py-2 text-[13px] font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
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
    </div>
  );
}

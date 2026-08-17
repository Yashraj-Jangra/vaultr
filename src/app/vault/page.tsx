"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useVault } from "@/context/VaultContext";
import { useCrypto, deriveKey, decrypt } from "@/hooks/useCrypto";
import { useTheme } from "@/context/ThemeContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { generateTOTP, getTotpPercentage } from "@/lib/totp";
import {
  Copy, Check, Eye, EyeOff, Trash2, ExternalLink,
  RefreshCw, ChevronDown, ChevronRight, Folder, FolderOpen,
  CreditCard, User, FileText, Lock, Plus, Minus, X, Wand2, Inbox, Shield, Star, Edit2, LayoutList, LayoutGrid,
  ShieldCheck, Mail, Loader2, AlertTriangle, CornerDownRight, FolderPlus, MapPin,
} from "lucide-react";
import { buildFolderTree, FolderNode } from "@/components/layout/Sidebar";
import { SiteIcon } from "@/components/vault/SiteIcon";
import { PasswordHealth } from "@/components/vault/PasswordHealth";
import { NewEntryDialog, AttachmentRow } from "@/components/vault/NewEntryDialog";
import { FolderSelect } from "@/components/vault/FolderSelect";
import { DetailedCardVisual, detectCardBrand } from "@/components/vault/DialogPreviews";
import { ConfirmDeleteModal } from "@/components/vault/ConfirmDeleteModal";
import { EmptyTrashModal, PurgeTarget } from "@/components/vault/EmptyTrashModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type Template = "login" | "card" | "address" | "profile" | "note";

interface CustomField { id: string; key: string; value: string; }

export interface DecryptedPayload {
  _template?: Template;
  _folder?: string;
  username?: string;
  password?: string;
  url?: string;
  urls?: string[];
  cardName?: string;
  cardholderName?: string;
  cardNumber?: string;
  expiry?: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
  pin?: string;
  cardBrand?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  fullName?: string;
  dob?: string;
  idNumber?: string;
  email?: string;
  phone?: string;
  note?: string;
  customFields?: { key: string; value: string; type?: "text" | "hidden" }[];
  fields?: { id?: string; name: string; value: string; type?: "text" | "hidden" }[];
  totpSecret?: string;
  entryNotes?: string;
  passwordHistory?: string[];
  // passkey / credentials
  isPasskey?: boolean;
  passkeyRpId?: string;
  passkeyCredentialId?: string;
  passkeyUserHandle?: string;
  // legacy
  payload?: string;
}

export interface VaultItem {
  id: string;
  name: string;
  encryptedBlob: string;
  domain?: string;
  folder?: string;
  template?: Template;
  createdAt?: string;
  updatedAt?: string;
  lastAccessedAt?: string;
  favorite?: boolean;
  hasTotp?: boolean;
  tags?: string[];
  deletedAt?: string | null;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function generatePassword(len: number, upper: boolean, lower: boolean, nums: boolean, syms: boolean): string {
  const U = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const L = "abcdefghijklmnopqrstuvwxyz";
  const N = "0123456789";
  const S = "!@#$%^&*-_=+";
  let pool = "";
  if (upper) pool += U;
  if (lower) pool += L;
  if (nums) pool += N;
  if (syms) pool += S;
  if (!pool) return "";
  const arr = new Uint32Array(len);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(v => pool[v % pool.length]).join("");
}

function extractDomain(url: string): string {
  if (!url) return "";
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("androidapp:") ||
    trimmed.startsWith("android://") ||
    trimmed.startsWith("android:") ||
    trimmed.startsWith("android")
  ) {
    return trimmed;
  }
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return "";
  }
}

const TEMPLATE_META: Record<Template, { label: string; icon: React.ReactNode; badgeClass: string; iconBg: string }> = {
  login: {
    label: "Login",
    icon: <Lock className="w-5.5 h-5.5 text-indigo-400" />,
    badgeClass: "text-indigo-400 bg-indigo-950/60 border-indigo-900/50",
    iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
  },
  card: {
    label: "Card",
    icon: <CreditCard className="w-5.5 h-5.5 text-violet-400" />,
    badgeClass: "text-violet-400 bg-violet-950/60 border-violet-900/50",
    iconBg: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  },
  address: {
    label: "Address",
    icon: <MapPin className="w-5.5 h-5.5 text-emerald-400" />,
    badgeClass: "text-emerald-400 bg-emerald-950/60 border-emerald-900/50",
    iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  },
  profile: {
    label: "Profile",
    icon: <User className="w-5.5 h-5.5 text-sky-400" />,
    badgeClass: "text-sky-400 bg-sky-950/60 border-sky-900/50",
    iconBg: "bg-sky-500/10 border-sky-500/20 text-sky-400",
  },
  note: {
    label: "Note",
    icon: <FileText className="w-5.5 h-5.5 text-amber-400" />,
    badgeClass: "text-amber-400 bg-amber-950/60 border-amber-900/50",
    iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  },
};

// ─── Small components ─────────────────────────────────────────────────────────

function CopyBtn({ value, size = "sm" }: { value: string; size?: "sm" | "xs" }) {
  const [copied, setCopied] = useState(false);
  const sz = size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer p-1 shrink-0"
      title="Copy"
    >
      {copied ? <Check className={`${sz} text-emerald-400`} /> : <Copy className={sz} />}
    </button>
  );
}

function MaskedValue({ value, mono = true, dots = 12, isCard = false, onToggle }: { value: string; mono?: boolean; dots?: number; isCard?: boolean; onToggle?: (v: boolean) => void }) {
  const [visible, setVisible] = useState(false);

  const displayVal = useMemo(() => {
    if (!visible) {
      if (isCard && value.replace(/\D/g, "").length >= 4) {
        return "•••• •••• •••• " + value.replace(/\D/g, "").slice(-4);
      }
      return "•".repeat(dots);
    }
    if (isCard) {
      const clean = value.replace(/\D/g, "");
      if (!clean) return value;
      const groups = clean.length === 15 ? [4, 6, 5] : [4, 4, 4, 4];
      const parts: string[] = [];
      let idx = 0;
      for (const g of groups) {
        if (idx >= clean.length) break;
        parts.push(clean.slice(idx, idx + g));
        idx += g;
      }
      if (idx < clean.length) parts.push(clean.slice(idx));
      return parts.join(" ");
    }
    return value;
  }, [visible, value, isCard, dots]);

  return (
    <div className="flex items-center justify-end gap-1.5 min-w-0">
      <span className={`truncate min-w-0 ${mono ? "font-mono" : ""} ${visible ? "text-neutral-200" : "text-neutral-500"} text-[12.5px] ${!visible && !isCard ? "tracking-widest" : ""}`}>
        {displayVal}
      </span>
      <div className="flex items-center shrink-0">
        <button onClick={() => { setVisible(v => { const next = !v; onToggle?.(next); return next; }) }} className="text-neutral-600 hover:text-neutral-300 cursor-pointer p-1 shrink-0">
          {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
        <CopyBtn value={value} />
      </div>
    </div>
  );
}

type CharClass = "lower" | "upper" | "digit" | "symbol";

function classifyChar(c: string): CharClass {
  if (/[a-z]/.test(c)) return "lower";
  if (/[A-Z]/.test(c)) return "upper";
  if (/[0-9]/.test(c)) return "digit";
  return "symbol";
}

const CHAR_STYLE: Record<CharClass, string> = {
  lower:  "text-neutral-300",
  upper:  "text-sky-400 font-semibold",
  digit:  "text-amber-400 font-bold",
  symbol: "text-rose-400 font-bold",
};

function PasswordGen({ onUse, compact = false }: { onUse?: (pw: string) => void; compact?: boolean }) {
  const [len, setLen] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [nums, setNums] = useState(true);
  const [syms, setSyms] = useState(true);
  const [seed, setSeed] = useState(0); // increment to trigger regen
  const [copied, setCopied] = useState(false);

  // Derive password purely — regenerates whenever any config or seed changes
  const pw = useMemo(
    () => generatePassword(len, upper, lower, nums, syms),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [len, upper, lower, nums, syms, seed]
  );

  const regen = () => setSeed(s => s + 1);
  const copy = () => { navigator.clipboard.writeText(pw); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className={`space-y-2.5 text-left ${compact ? "" : "p-3 border border-neutral-800 rounded-xl bg-neutral-950/80 shadow-lg"}`}>
      {/* Output row */}
      <div className="flex items-center justify-between gap-2 bg-neutral-900/60 border border-neutral-800/80 rounded-lg px-3 py-2">
        <div className="flex-1 font-mono text-[12px] break-all select-all tracking-wider">
          {pw ? (
            pw.split("").map((c, i) => (
              <span key={i} className={CHAR_STYLE[classifyChar(c)]}>{c}</span>
            ))
          ) : (
            <span className="text-neutral-600">—</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={regen} className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer rounded-md hover:bg-neutral-800/80" title="Regenerate">
            <RefreshCw className="w-3 h-3" />
          </button>
          <button onClick={copy} className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer rounded-md hover:bg-neutral-800/80" title="Copy">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
          {onUse && (
            <button
              onClick={() => onUse(pw)}
              className="px-2.5 py-1 text-[10.5px] font-semibold bg-neutral-100 text-neutral-900 hover:bg-white rounded-md transition-all cursor-pointer shrink-0 ml-0.5 shadow-sm"
            >
              Use
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
        <div className="flex items-center gap-2 flex-1 min-w-[130px]">
          <span className="text-[11px] text-neutral-100 font-mono font-semibold shrink-0">Len: {len}</span>
          <input
            type="range" min={8} max={64} value={len}
            onChange={e => setLen(+e.target.value)}
            className="w-full h-1.5 accent-white cursor-pointer rounded-full appearance-none"
            style={{
              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${((len - 8) / (64 - 8)) * 100}%, #3f3f46 ${((len - 8) / (64 - 8)) * 100}%, #3f3f46 100%)`
            }}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {([["A–Z", upper, setUpper], ["a–z", lower, setLower], ["0–9", nums, setNums], ["!@#", syms, setSyms]] as [string, boolean, (v: boolean) => void][]).map(([label, val, set]) => (
            <button
              key={label}
              type="button"
              onClick={() => set(!val)}
              className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-medium border transition-colors cursor-pointer ${
                val
                  ? "border-neutral-700 bg-neutral-800 text-neutral-200"
                  : "border-neutral-800/60 bg-transparent text-neutral-600 hover:text-neutral-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── New Entry Form ───────────────────────────────────────────────────────────

interface NewEntryFormProps {
  folders: string[];
  onSave: (name: string, template: Template, folder: string, tags: string[], payload: DecryptedPayload, editId?: string) => Promise<void>;
  onCancel: () => void;
  initialData?: {
    id: string;
    name: string;
    folder?: string;
    tags?: string[];
    template: Template;
    payload: DecryptedPayload;
  };
}

function NewEntryForm({ folders, onSave, onCancel, initialData }: NewEntryFormProps) {
  const searchParams = useSearchParams();
  const currentNavFolder = searchParams?.get("folder") ?? "";
  const [template, setTemplate] = useState<Template>(initialData?.template || "login");
  const [name, setName] = useState(initialData?.name || "");
  const [folder, setFolder] = useState(initialData?.folder || currentNavFolder || "");
  const [newFolder, setNewFolder] = useState("");
  const [tags, setTags] = useState<string>(initialData?.tags?.join(", ") || "");
  const [saving, setSaving] = useState(false);
  const [showGen, setShowGen] = useState(false);

  // Login
  const [username, setUsername] = useState(initialData?.payload.username || "");
  const [password, setPassword] = useState(initialData?.payload.password || "");
  const [urls, setUrls] = useState<string[]>(() => {
    const arr = initialData?.payload.urls ? [...initialData.payload.urls] : [];
    if (initialData?.payload.url && !arr.includes(initialData.payload.url)) {
      arr.unshift(initialData.payload.url);
    }
    return arr.length > 0 ? arr : [""];
  });
  const [totpSecret, setTotpSecret] = useState(initialData?.payload.totpSecret || "");
  const [showTotpField, setShowTotpField] = useState(!!initialData?.payload.totpSecret);

  // Card
  const [cardName, setCardName] = useState(initialData?.payload.cardName || "");
  const [cardNumber, setCardNumber] = useState(initialData?.payload.cardNumber || "");
  const [expiryMonth, setExpiryMonth] = useState(() => {
    const raw = initialData?.payload.expiry ?? "";
    return raw.split(/\s*\/\s*/)[0]?.trim() ?? "";
  });
  const [expiryMonthError, setExpiryMonthError] = useState(false);
  const [expiryYear, setExpiryYear] = useState(() => {
    const raw = initialData?.payload.expiry ?? "";
    return raw.split(/\s*\/\s*/)[1]?.trim() ?? "";
  });
  const [expiryYearError, setExpiryYearError] = useState(false);
  const [cvv, setCvv] = useState(initialData?.payload.cvv || "");
  const [pin, setPin] = useState(initialData?.payload.pin || "");

  // Address
  const [line1, setLine1] = useState(initialData?.payload.line1 || "");
  const [line2, setLine2] = useState(initialData?.payload.line2 || "");
  const [city, setCity] = useState(initialData?.payload.city || "");
  const [state, setState_] = useState(initialData?.payload.state || "");
  const [zip, setZip] = useState(initialData?.payload.zip || "");
  const [country, setCountry] = useState(initialData?.payload.country || "");

  // Profile
  const [fullName, setFullName] = useState(initialData?.payload.fullName || "");
  const [dob, setDob] = useState(initialData?.payload.dob || "");
  const [idNumber, setIdNumber] = useState(initialData?.payload.idNumber || "");
  const [profEmail, setProfEmail] = useState(initialData?.payload.email || "");
  const [phone, setPhone] = useState(initialData?.payload.phone || "");

  // Note
  const [note, setNote] = useState(initialData?.payload.note || "");

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>(() =>
    initialData?.payload.customFields?.map(f => ({ id: crypto.randomUUID(), key: f.key, value: f.value })) || []
  );
  const addCustom = () => setCustomFields(p => [...p, { id: crypto.randomUUID(), key: "", value: "" }]);

  // Shared
  const [entryNotes, setEntryNotes] = useState(initialData?.payload.entryNotes || "");

  const activeFolder = folder === "__new__" ? newFolder.trim() : folder;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload: DecryptedPayload = {
      _template: template,
      _folder: activeFolder || undefined,
      customFields: customFields.filter(f => f.key.trim() || f.value.trim()).map(f => ({ key: f.key, value: f.value })),
      entryNotes: entryNotes.trim() ? entryNotes.trim() : undefined,
    };
    if (template === "login") {
      const validUrls = urls.map(u => u.trim()).filter(Boolean);
      Object.assign(payload, { 
        username, 
        password, 
        url: validUrls[0] || "",
        urls: validUrls, 
        totpSecret: totpSecret.trim() 
      });
    }
    if (template === "card") {
      let saveYear = expiryYear.trim();
      if (saveYear.length === 2) {
        const y = parseInt(saveYear, 10);
        saveYear = String(y < 50 ? 2000 + y : 1900 + y);
      }
      const expiry = (expiryMonth.trim() || saveYear) ? `${expiryMonth.padStart(2, '0')} / ${saveYear}` : "";
      Object.assign(payload, { cardName, cardNumber, expiry, cvv, pin });
    }
    if (template === "address") Object.assign(payload, { line1, line2, city, state: state, zip, country });
    if (template === "profile") Object.assign(payload, { fullName, dob, idNumber, email: profEmail, phone });
    if (template === "note") Object.assign(payload, { note });

    const parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);

    // Auto-update history if editing and password changed
    if (initialData?.payload.password && initialData.payload.password !== password) {
      payload.passwordHistory = [...(initialData.payload.passwordHistory || []), initialData.payload.password].slice(-5); // keep last 5
    } else if (initialData?.payload.passwordHistory) {
      payload.passwordHistory = initialData.payload.passwordHistory;
    }

    await onSave(name.trim(), template, activeFolder, parsedTags, payload, initialData?.id);
    setSaving(false);
  };


  // ── Template icon pills ─────────────────────────────────────────────────
  const TEMPLATES: { id: Template; label: string; icon: React.ReactNode }[] = [
    { id: "login",   label: "Login",   icon: <Lock       className="w-3.5 h-3.5" /> },
    { id: "card",    label: "Card",    icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: "note",    label: "Note",    icon: <FileText   className="w-3.5 h-3.5" /> },
    { id: "address", label: "Address", icon: <FileText   className="w-3.5 h-3.5" /> },
    { id: "profile", label: "Profile", icon: <User       className="w-3.5 h-3.5" /> },
  ];

  return (
    <Card className="space-y-0 p-0 overflow-hidden animate-form-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-neutral-800 border border-[var(--border)] flex items-center justify-center">
            {TEMPLATES.find(t => t.id === template)?.icon ?? <Lock className="w-3.5 h-3.5 text-neutral-400" />}
          </div>
          <span className="text-[13px] font-medium text-neutral-200">
            {initialData ? "Edit entry" : "New entry"}
          </span>
        </div>
        <button onClick={onCancel} className="text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer p-1 rounded-md hover:bg-neutral-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* ── Type pill selector ─────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Type</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] border transition-all cursor-pointer ${
                  template === t.id
                    ? "border-neutral-600 bg-neutral-800 text-neutral-200"
                    : "border-[var(--border)] text-neutral-500 hover:text-neutral-300 hover:border-neutral-700"
                }`}
              >
                <span className={template === t.id ? "text-neutral-300" : "text-neutral-700"}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Name ──────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Name</span>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={
              template === "login"   ? "e.g. Gmail, GitHub" :
              template === "card"    ? "e.g. Visa Personal" :
              template === "address" ? "e.g. Home, Office" :
              template === "profile" ? "e.g. Personal ID" :
                                       "Note title"
            }
            autoFocus={!initialData}
          />
        </div>

        {/* ── Folder + Tags row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Folder</span>
            <FolderSelect value={folder} onChange={setFolder} folders={folders} />
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Tags</span>
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="work, personal…" />
          </div>
        </div>

        {folder === "__new__" && (
          <Input value={newFolder} onChange={e => setNewFolder(e.target.value)} placeholder="New folder name" autoFocus />
        )}

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="border-t border-[var(--border)]" />

        {/* ── Template-specific fields ───────────────────────────────────── */}
        {template === "login" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Credentials</span>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username / Email" />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="font-mono" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowGen(v => !v)}
                  title="Generate password"
                  className={`shrink-0 px-2.5 border rounded-lg transition-colors cursor-pointer ${
                    showGen ? "border-neutral-600 bg-neutral-800 text-neutral-200" : "border-[var(--border)] text-neutral-600 hover:text-neutral-300 hover:border-neutral-700"
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {showGen && (
                <div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--surface-2)]">
                  <PasswordGen compact onUse={pw => { setPassword(pw); setShowGen(false); }} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-neutral-700 uppercase tracking-widest">URLs</span>
              {urls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={u} onChange={e => setUrls(p => p.map((x, idx) => idx === i ? e.target.value : x))} placeholder="https://…" />
                  {i === urls.length - 1 ? (
                    <button type="button" onClick={() => setUrls(p => [...p, ""])} className="shrink-0 px-2 border rounded-lg border-[var(--border)] text-neutral-600 hover:text-neutral-300 hover:border-neutral-600 transition-colors cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
                  ) : (
                    <button type="button" onClick={() => setUrls(p => p.filter((_, idx) => idx !== i))} className="shrink-0 px-2 border rounded-lg border-[var(--border)] text-neutral-600 hover:text-red-400 hover:border-red-900/50 transition-colors cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
            </div>

            {!showTotpField ? (
              <button type="button" onClick={() => setShowTotpField(true)} className="text-[11px] text-neutral-600 hover:text-neutral-300 w-fit flex items-center gap-1.5 transition-colors cursor-pointer">
                <Plus className="w-3 h-3" /> Add 2FA Secret
              </button>
            ) : (
              <div className="relative space-y-1.5">
                <span className="text-[10px] text-neutral-700 uppercase tracking-widest">2FA</span>
                <Input value={totpSecret} onChange={e => setTotpSecret(e.target.value)} type="password" placeholder="TOTP Setup Key (Base32)" className="font-mono pr-14" />
                <div className="absolute top-[30px] right-3 text-[10px] uppercase font-semibold tracking-wider text-neutral-600 select-none bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">TOTP</div>
              </div>
            )}
          </div>
        )}

        {template === "card" && (
          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Card Details</span>
            <Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Cardholder name" />
            <Input value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="Card number" className="font-mono" />
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Input
                  value={expiryMonth}
                  onChange={e => {
                    setExpiryMonth(e.target.value.replace(/\D/g, "").slice(0, 2));
                    setExpiryMonthError(false);
                  }}
                  onBlur={() => {
                    if (!expiryMonth) { setExpiryMonthError(false); return; }
                    const n = parseInt(expiryMonth, 10);
                    if (isNaN(n) || n < 1 || n > 12) { setExpiryMonthError(true); }
                    else { setExpiryMonth(String(n).padStart(2, "0")); setExpiryMonthError(false); }
                  }}
                  placeholder="MM"
                  className={expiryMonthError ? "border-red-500" : ""}
                />
                {expiryMonthError && <p className="text-red-400 text-[10px] mt-0.5">01 – 12</p>}
              </div>
              <div>
                <Input
                  value={expiryYear}
                  onChange={e => {
                    setExpiryYear(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setExpiryYearError(false);
                  }}
                  onBlur={() => {
                    if (!expiryYear) { setExpiryYearError(false); return; }
                    const len = expiryYear.length;
                    if (len !== 2 && len !== 4) { setExpiryYearError(true); }
                    else { setExpiryYearError(false); }
                  }}
                  placeholder="YY / YYYY"
                  className={expiryYearError ? "border-red-500" : ""}
                />
                {expiryYearError && <p className="text-red-400 text-[10px] mt-0.5">YY or YYYY</p>}
              </div>
              <Input value={cvv} onChange={e => setCvv(e.target.value)} placeholder="CVV" type="password" />
              <Input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" type="password" />
            </div>
          </div>
        )}

        {template === "address" && (
          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Address</span>
            <Input value={line1} onChange={e => setLine1(e.target.value)} placeholder="Address line 1" />
            <Input value={line2} onChange={e => setLine2(e.target.value)} placeholder="Address line 2 (apt, suite…)" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
              <Input value={state} onChange={e => setState_(e.target.value)} placeholder="State / Province" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={zip} onChange={e => setZip(e.target.value)} placeholder="ZIP / Postal code" />
              <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" />
            </div>
          </div>
        )}

        {template === "profile" && (
          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Profile</span>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={profEmail} onChange={e => setProfEmail(e.target.value)} placeholder="Email" type="email" />
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={dob} onChange={e => setDob(e.target.value)} placeholder="Date of birth" />
              <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="ID / Passport no." />
            </div>
          </div>
        )}

        {template === "note" && (
          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Content</span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Write your secure note…"
              rows={6}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--fg)] placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors resize-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
            />
          </div>
        )}

        {/* ── Private notes (non-note templates) ────────────────────────── */}
        {template !== "note" && (
          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Notes</span>
            <textarea
              value={entryNotes}
              onChange={e => setEntryNotes(e.target.value)}
              placeholder="Private notes…"
              rows={2}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--fg)] placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors resize-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
            />
          </div>
        )}

        {/* ── Custom fields ─────────────────────────────────────────────── */}
        {customFields.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] text-neutral-700 uppercase tracking-widest">Custom Fields</span>
            {customFields.map(f => (
              <div key={f.id} className="flex gap-2">
                <Input value={f.key} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, key: e.target.value } : x))} placeholder="Label" className="w-1/3" />
                <Input value={f.value} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder="Value" type="password" />
                <button onClick={() => setCustomFields(p => p.filter(x => x.id !== f.id))} className="text-neutral-700 hover:text-red-400 transition-colors cursor-pointer shrink-0 px-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={addCustom} className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer flex items-center gap-1.5">
          <Plus className="w-3 h-3" /> Add custom field
        </button>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-[var(--border)] bg-[var(--surface-2)]">
        <span className="text-[11px] text-neutral-700 flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> Encrypted locally
        </span>
        <div className="flex items-center gap-2">
          <Button onClick={onCancel} variant="ghost">Cancel</Button>
          <Button onClick={handleSave} variant="primary" disabled={!name.trim() || saving}>
            {saving ? "Saving…" : initialData ? "Save Changes" : "Encrypt & Save"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Row detail renderer ──────────────────────────────────────────────────────

function SectionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 mt-3 first:mt-0">
      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-1">{title}</div>
      <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden divide-y divide-neutral-800/50">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value, masked = false, isUrl = false, isCard = false, dots = 12, onToggle }: {
  label: string; value: string; masked?: boolean; isUrl?: boolean; isCard?: boolean; dots?: number; onToggle?: (v: boolean) => void
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between px-3 py-2.5 min-w-0">
      <span className="text-[11px] text-neutral-400 font-medium shrink-0 pr-3">{label}</span>
      <div className="flex-1 min-w-0 text-right">
        {masked ? <MaskedValue value={value} dots={dots} isCard={isCard} onToggle={onToggle} /> :
          isUrl ? (
            <div className="flex items-center justify-end gap-1.5 min-w-0">
              <a
                href={value.startsWith("http") ? value : `https://${value}`}
                target="_blank" rel="noopener noreferrer"
                className="text-[12px] font-mono text-sky-400 hover:underline truncate min-w-0"
                title={value}
              >
                {value}
              </a>
              <CopyBtn value={value} />
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1.5 min-w-0">
              <span className="text-[12px] font-mono text-neutral-200 truncate min-w-0" title={value}>{value}</span>
              <CopyBtn value={value} />
            </div>
          )
        }
      </div>
    </div>
  );
}

function TotpDisplay({ secret }: { secret: string }) {
  const [code, setCode] = useState("------");
  const [percent, setPercent] = useState(100);

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      try {
        const _code = await generateTOTP(secret);
        if (mounted) {
          setCode(_code);
          setPercent(getTotpPercentage());
        }
      } catch {
        if (mounted) setCode("ERROR");
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, [secret]);

  const isExpiring = percent <= (5 / 30) * 100;

  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-[11px] text-neutral-400 font-medium">2FA Code</span>
      <div className="flex items-center gap-3">
        <div className="relative w-4 h-4 flex items-center justify-center">
          <svg className="w-4 h-4 -rotate-90 transform" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="text-neutral-800" />
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"
              className={isExpiring ? "text-red-500 transition-all duration-1000 ease-linear" : "text-sky-400 transition-all duration-1000 ease-linear"}
              strokeDasharray="62.8"
              strokeDashoffset={62.8 * (1 - percent / 100)}
            />
          </svg>
        </div>
        <span className={`font-mono text-[13px] font-bold tracking-widest ${isExpiring ? "text-red-500" : "text-sky-400"}`}>{code.slice(0, 3)} {code.slice(3, 6)}</span>
        <CopyBtn value={code} />
      </div>
    </div>
  );
}

function PasswordHistoryButton({ history }: { history: string[] }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<number | null>(null);

  return (
    <div className="mt-3 pt-2 border-t border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[12px] font-medium text-sky-400 hover:underline cursor-pointer"
      >
        Password history: {history.length}
      </button>

      {open && (
        <div className="mt-2 bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden divide-y divide-neutral-800/50">
          {history.map((pw, i) => (
            <div key={i} className="flex justify-between items-center px-3 py-2 text-[12px] font-mono">
              <span className="text-neutral-300">
                {revealed === i ? pw : "••••••••••••"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRevealed(revealed === i ? null : i)}
                  className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {revealed === i ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <CopyBtn value={pw} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpandedDetails({ itemId, data, readOnly, onEdit, inGrid = false, decryptItem, cryptoKey }: { itemId?: string; data: DecryptedPayload, readOnly?: boolean, onEdit?: () => void, inGrid?: boolean, decryptItem: (blob: string) => Promise<string>, cryptoKey: CryptoKey | null }) {
  const [showCard, setShowCard] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    if (!itemId) return;
    fetch(`/api/vault/attachments?vaultItemId=${itemId}`)
      .then(res => res.json())
      .then(d => {
        if (d.attachments) setAttachments(d.attachments);
      })
      .catch(console.error);
  }, [itemId]);

  const t = data._template ?? "login";
  return (
    <div className={inGrid 
      ? "p-4 space-y-3 text-sm" 
      : "px-4 pb-4 pt-3 mx-4 mb-1 space-y-2.5 border-t border-[var(--border)] text-sm"
    }>
      {t === "login" && (
        <>
          {(data.username || data.password) && (
            <SectionGroup title="LOGIN CREDENTIALS">
              <DetailRow label="Username" value={data.username || ""} />
              <DetailRow label="Password" value={data.password || ""} masked />
            </SectionGroup>
          )}

          {data.totpSecret && (
            <SectionGroup title="AUTHENTICATOR">
              <TotpDisplay secret={data.totpSecret} />
            </SectionGroup>
          )}

          {(data.url || (data.urls && data.urls.length > 0)) && (
            <SectionGroup title="WEBSITE URLS">
              {data.urls && data.urls.length > 0 ? (
                data.urls.map((u, i) => <DetailRow key={i} label={i === 0 ? "Website (URI)" : `Website (URI #${i+1})`} value={u} isUrl />)
              ) : (
                <DetailRow label="Website (URI)" value={data.url || ""} isUrl />
              )}
            </SectionGroup>
          )}
        </>
      )}

      {t === "card" && (() => {
        const resolvedBrand = (data.cardBrand && data.cardBrand.toLowerCase() !== "auto-detect" ? data.cardBrand : "") || detectCardBrand(data.cardNumber || "");
        return (
          <>
            <CreditCardGraphic data={data} showCard={showCard} />
            <SectionGroup title="CARD DETAILS">
              {resolvedBrand ? <DetailRow label="Network" value={resolvedBrand} /> : null}
              <DetailRow label="Name" value={data.cardName || data.cardholderName || ""} />
              <DetailRow label="Number" value={data.cardNumber || ""} masked isCard onToggle={setShowCard} />
            </SectionGroup>

            {(data.expiry || data.expMonth || data.expYear || data.cvv || data.pin) && (
              <SectionGroup title="SECURITY & VALIDITY">
                <DetailRow label="Expiry" value={data.expiry || (data.expMonth || data.expYear ? `${data.expMonth || "MM"} / ${data.expYear || "YY"}` : "")} />
                <DetailRow label="CVV" value={data.cvv || ""} masked dots={3} />
                {data.pin ? <DetailRow label="PIN" value={data.pin} masked dots={3} /> : null}
              </SectionGroup>
            )}
          </>
        );
      })()}

      {t === "address" && (
        <>
          {(data.line1 || data.line2) && (
            <SectionGroup title="STREET ADDRESS">
              <DetailRow label="Line 1" value={data.line1 || ""} />
              <DetailRow label="Line 2" value={data.line2 || ""} />
            </SectionGroup>
          )}
          {(data.city || data.state || data.zip || data.country) && (
            <SectionGroup title="LOCATION">
              <DetailRow label="City" value={data.city || ""} />
              <DetailRow label="State" value={data.state || ""} />
              <DetailRow label="ZIP" value={data.zip || ""} />
              <DetailRow label="Country" value={data.country || ""} />
            </SectionGroup>
          )}
        </>
      )}

      {t === "profile" && (
        <>
          <SectionGroup title="IDENTITY & CONTACT">
            <DetailRow label="Name" value={data.fullName || ""} />
            <DetailRow label="Email" value={data.email || ""} />
            <DetailRow label="Phone" value={data.phone || ""} />
            <DetailRow label="DOB" value={data.dob || ""} />
            <DetailRow label="ID / No." value={data.idNumber || ""} masked />
          </SectionGroup>
        </>
      )}

      {t === "note" && (data.note || data.entryNotes) && (
        <SectionGroup title="SECURE NOTE">
          <div className="p-3 space-y-1.5">
            <div className="flex items-start justify-between">
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Note Content</span>
              <CopyBtn value={data.note || data.entryNotes || ""} />
            </div>
            <p className="text-[13px] text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">{data.note || data.entryNotes}</p>
          </div>
        </SectionGroup>
      )}

      {((data.fields || data.customFields) as any[])?.length > 0 && (
        <SectionGroup title="CUSTOM FIELDS">
          {((data.fields || data.customFields) as any[])?.map((f: any, i: number) => {
            const val = f.value;
            if (!val) return null;
            const labelStr = f.name || f.key || "Field";
            const isHidden = f.type === "hidden";
            return (
              <DetailRow key={i} label={labelStr} value={val} masked={isHidden} />
            );
          })}
        </SectionGroup>
      )}

      {t !== "note" && data.entryNotes && (
        <SectionGroup title="PRIVATE NOTES">
          <div className="p-3 space-y-1.5">
            <div className="flex items-start justify-between">
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Notes</span>
              <CopyBtn value={data.entryNotes} />
            </div>
            <p className="text-[13px] text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">{data.entryNotes}</p>
          </div>
        </SectionGroup>
      )}

      {/* Legacy blobs */}
      {data.payload && (
        <p className="text-[13px] text-amber-400 font-mono break-all">{data.payload}</p>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <SectionGroup title="ATTACHMENTS">
          <div className="space-y-2 pt-1 pb-1">
            {attachments.map(att => (
              <AttachmentRow
                key={att.id}
                attachment={att}
                decryptItem={decryptItem}
                cryptoKey={cryptoKey}
              />
            ))}
          </div>
        </SectionGroup>
      )}

      {/* Password History */}
      {data.passwordHistory && data.passwordHistory.length > 0 && (
        <PasswordHistoryButton history={data.passwordHistory} />
      )}

      {/* Health Check */}
      {t === "login" && data.password && !readOnly && (
        <PasswordHealth password={data.password} />
      )}

      {/* Actions */}
      {!readOnly && onEdit && (
        <div className="flex justify-end pt-2 border-t border-[var(--border)] mt-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Entry
          </button>
        </div>
      )}
    </div>
  );
}


function CreditCardGraphic({ data, showCard }: { data: DecryptedPayload; showCard?: boolean }) {
  const cardName = data.cardName || data.cardholderName || "";
  const expiry = data.expiry || (data.expMonth || data.expYear ? `${data.expMonth || "MM"} / ${data.expYear || "YY"}` : "");
  const cardBrand = (data.cardBrand && data.cardBrand.toLowerCase() !== "auto-detect" ? data.cardBrand : "") || detectCardBrand(data.cardNumber || "");
  return (
    <div className="w-full max-w-[280px] mx-auto mb-4 scale-95 origin-center">
      <DetailedCardVisual
        cardNumber={data.cardNumber || ""}
        cardName={cardName}
        expiry={expiry}
        cardBrand={cardBrand}
        isNumberVisible={showCard}
      />
    </div>
  );
}

function getItemIcon(item: VaultItem, url?: string) {
  const template = item.template || "login";
  const meta = TEMPLATE_META[template as Template];

  if (template === "card") {
    const nameLower = item.name.toLowerCase();
    const isVisa = nameLower.includes("visa");
    const isMastercard = nameLower.includes("mastercard") || nameLower.includes("master card") || nameLower.includes(" mc");
    const isAmex = nameLower.includes("amex") || nameLower.includes("american express");
    const isDiscover = nameLower.includes("discover");

    const isRupay = nameLower.includes("rupay");

    let cardBadge: React.ReactNode;
    if (isVisa) {
      cardBadge = <img src="/logos/Visa.svg" className="h-5 w-auto object-contain drop-shadow" alt="Visa" />;
    } else if (isMastercard) {
      cardBadge = <img src="/logos/Mastercard.svg" className="h-6 w-auto object-contain drop-shadow" alt="Mastercard" />;
    } else if (isAmex) {
      cardBadge = <img src="/logos/AMEX.svg" className="h-6 w-auto object-contain drop-shadow" alt="AMEX" />;
    } else if (isDiscover) {
      cardBadge = <img src="/logos/Discover.svg" className="h-4 w-auto object-contain drop-shadow" alt="Discover" />;
    } else if (isRupay) {
      cardBadge = <img src="/logos/Rupay.svg" className="h-4 w-auto object-contain drop-shadow" alt="RuPay" />;
    } else {
      cardBadge = meta.icon;
    }

    return (
      <div className="w-9 h-9 flex items-center justify-center shrink-0">
        {cardBadge}
      </div>
    );
  }

  if (template === "login") {
    return <SiteIcon domain={item.domain} name={item.name} url={url} size={36} />;
  }

  return (
    <div className="w-9 h-9 flex items-center justify-center shrink-0">
      {meta.icon}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VaultPage() {
  const { user, logout } = useAuth();
  const { activeTheme } = useTheme();
  const router = useRouter();



  // ── Pull everything from the shared VaultContext ──────────────────────────
  const {
    cryptoKey,
    isLoading,
    items,
    encryptData,
    decryptItem,
    folders: ctxFolders,
    deleteItem,
    hardDeleteItem,
    restoreItem,
    toggleFavorite,
    isNewEntryOpen,
    setIsNewEntryOpen,
    saveItem,
    updateItem,
    batchAction,
  } = useVault();

  const searchParams = useSearchParams();
  const activeFolder = searchParams.get("folder"); // null = all, "" = uncategorized
  const activeFilter = searchParams.get("filter");
  const activeTag = searchParams.get("tag");
  const activeType = searchParams.get("type"); // item template type filter
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["__uncategorized__"]));

  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedData, setRevealedData] = useState<DecryptedPayload | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDialogItem, setEditDialogItem] = useState<{
    id: string;
    name: string;
    folder?: string;
    tags?: string[];
    template: Template;
    payload: DecryptedPayload;
  } | null>(null);

  // Bulk / Sort state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "name">("createdAt");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmTrash, setBulkConfirmTrash] = useState(false);
  const isSelectionMode = selectedIds.size > 0;

  // Permanent Delete Purge Modal state with Master Password Reprompt
  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null);

  const [viewMode, setViewModeState] = useState<"list" | "grid">("list");
  useEffect(() => {
    const saved = localStorage.getItem("vaultr_view_mode");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "grid") setViewModeState("grid");
  }, []);
  const setViewMode = (mode: "list" | "grid") => {
    setViewModeState(mode);
    localStorage.setItem("vaultr_view_mode", mode);
  };

  // Clear selections on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds(new Set());
  }, [activeFolder, activeFilter, activeTag, activeType]);

  // Keyboard shortcuts for bulk selection mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectionMode) {
        setSelectedIds(new Set());
      }
      if ((e.key === "Delete" || e.key === "Backspace") && isSelectionMode && !bulkBusy) {
        // Only if not in an input
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          if (activeFilter !== "trash") setBulkConfirmTrash(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSelectionMode, bulkBusy, activeFilter]);

  const [defaultTemplate, setDefaultTemplate] = useState<Template>("login");

  useEffect(() => {
    const newParam = searchParams.get("new");
    const revealParam = searchParams.get("reveal");
    const editParam = searchParams.get("edit");
    const targetParamId = editParam || revealParam;

    if (newParam && ["login", "card", "address", "profile", "note"].includes(newParam)) {
      setDefaultTemplate(newParam as Template);
      setIsNewEntryOpen(true);
      window.history.replaceState(null, "", "/vault");
    } else if (targetParamId && items.length > 0) {
      const targetItem = items.find(x => x.id === targetParamId);
      if (targetItem) {
        decryptItem(targetItem.encryptedBlob).then(raw => {
          let parsed: DecryptedPayload;
          try { parsed = JSON.parse(raw); } catch { parsed = { payload: raw }; }
          if (!parsed._template && (parsed.username || parsed.password)) parsed._template = targetItem.template || "login";
          if (editParam) {
            setEditDialogItem({
              id: targetItem.id,
              name: targetItem.name,
              folder: targetItem.folder,
              tags: targetItem.tags,
              template: targetItem.template || parsed._template || "login",
              payload: parsed,
            });
          } else {
            // Auto expand ancestor folders so the item is rendered in the DOM
            if (targetItem.folder) {
              const segments = targetItem.folder.split("/");
              const pathsToOpen: string[] = [];
              let currentPath = "";
              for (const seg of segments) {
                currentPath = currentPath ? `${currentPath}/${seg}` : seg;
                pathsToOpen.push(currentPath);
              }
              setExpandedFolders(prev => {
                const next = new Set(prev);
                pathsToOpen.forEach(p => next.add(p));
                return next;
              });
            } else {
              setExpandedFolders(prev => new Set(prev).add("__uncategorized__"));
            }

            // Expand and reveal item
            setRevealedId(targetItem.id);
            setRevealedData(parsed);

            // Smooth scroll to the item in viewport and pulse highlight ring
            setTimeout(() => {
              const el = document.getElementById(`vault-item-${targetItem.id}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-[var(--accent,#6366f1)]", "ring-offset-2", "ring-offset-neutral-950", "transition-all");
                setTimeout(() => {
                  el.classList.remove("ring-2", "ring-[var(--accent,#6366f1)]", "ring-offset-2", "ring-offset-neutral-950");
                }, 2200);
              }
            }, 120);
          }
        }).catch(() => {});
      }
      window.history.replaceState(null, "", "/vault");
    }
  }, [searchParams, items, decryptItem, setIsNewEntryOpen]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = async (name: string, template: Template, folder: string, tags: string[], payload: DecryptedPayload, editIdParams?: string): Promise<string | undefined> => {
    if (!cryptoKey || !user) return;
    const blob = await encryptData(JSON.stringify(payload));
    let domain = payload.url ? extractDomain(payload.url) : "";
    if (template === "card" && payload.cardNumber) {
      const clean = payload.cardNumber.replace(/\D/g, "");
      if (clean.length >= 4) {
        const last4 = clean.slice(-4);
        const brand = payload.cardBrand && payload.cardBrand.toLowerCase() !== "auto-detect" ? payload.cardBrand : "";
        const displayBrand = brand.toLowerCase() === "other" || !brand ? "Credit Card" : brand;
        domain = `${displayBrand} •••• ${last4}`;
      }
    }

    if (editIdParams) {
      const updates: Partial<VaultItem> = {
        name,
        encryptedBlob: blob,
        template,
        hasTotp: !!payload.totpSecret,
        tags: tags.length > 0 ? tags : [],
        folder: folder || undefined,
        domain: domain || undefined,
      };
      await updateItem(editIdParams, updates);

      setEditId(null);
      setEditDialogItem(null);
      if (revealedId === editIdParams) {
        setRevealedData(payload);
      }
      return editIdParams;
    } else {
      const doc_ = {
        name,
        encryptedBlob: blob,
        template,
        hasTotp: !!payload.totpSecret,
        tags: tags.length > 0 ? tags : [],
        folder: folder || undefined,
        domain: domain || undefined,
      };
      const saved = await saveItem(doc_);
      setIsNewEntryOpen(false);
      return saved?.id;
    }
  };

  const [deleteModalTarget, setDeleteModalTarget] = useState<VaultItem | null>(null);

  const handleTrashItem = async (id: string) => {
    await deleteItem(id);
    if (revealedId === id) { setRevealedId(null); setRevealedData(null); }
  };

  const handleRestoreItem = async (id: string) => {
    await restoreItem(id);
  };

  const handleHardDelete = (item: VaultItem) => {
    setPurgeTarget({ type: "single", ids: [item.id], count: 1 });
  };

  const handleConfirmPurge = async (password: string) => {
    if (!purgeTarget) return;

    // Verify master password zero-knowledge check
    const testKey = await deriveKey(password, user?.id || "");
    const sampleItem = items.find((i) => purgeTarget.ids.includes(i.id)) || items[0];
    if (sampleItem) {
      await decrypt(testKey, sampleItem.encryptedBlob);
    }

    // Verification passed! Execute bulk permanent purge
    await batchAction("purge", purgeTarget.ids);
    setSelectedIds(new Set());
    setPurgeTarget(null);
  };

  const confirmHardDelete = async () => {
    if (!deleteModalTarget) return;
    await hardDeleteItem(deleteModalTarget.id);
    if (revealedId === deleteModalTarget.id) { setRevealedId(null); setRevealedData(null); }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkAction = async (action: "trash" | "restore" | "favorite" | "unfavorite" | "move", payload?: string) => {
    if (!user || selectedIds.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      // Map legacy "favorite" (toggle) to explicit favorite/unfavorite
      let resolvedAction: "trash" | "restore" | "favorite" | "unfavorite" | "move" = action;
      if (action === "favorite") {
        // Determine: if any selected item is NOT favorited, favorite all; otherwise unfavorite all
        const anyUnfavorited = ids.some(id => !items.find(i => i.id === id)?.favorite);
        resolvedAction = anyUnfavorited ? "favorite" : "unfavorite";
      }
      await batchAction(resolvedAction, ids, payload);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("[handleBulkAction]", err);
      alert("Bulk action failed. Please try again.");
    } finally {
      setBulkBusy(false);
    }
  };


  const toggleReveal = async (id: string, blob: string) => {
    if (revealedId === id) { setRevealedId(null); setRevealedData(null); setEditId(null); return; }
    if (!cryptoKey) return;
    try {
      const raw = await decryptItem(blob);
      let parsed: DecryptedPayload;
      try { parsed = JSON.parse(raw); } catch { parsed = { payload: raw }; }
      // backward compat: old entries didn't have _template
      if (!parsed._template && (parsed.username || parsed.password)) parsed._template = "login";
      setRevealedId(id);
      setRevealedData(parsed);
      setEditId(null);
    } catch { alert("Decryption failed."); }
  };

  // Derived — use ctxFolders from context (same data, avoids duplication)
  const folders = ctxFolders;

  const visibleItems = useMemo(() => {
    let filtered = items;

    // Trash vs Not Trash
    if (activeFilter === "trash") {
      filtered = filtered.filter(i => !!i.deletedAt);
    } else {
      filtered = filtered.filter(i => !i.deletedAt); // Hide garbage normally
    }

    // Advanced filters
    if (activeFilter === "favorites") {
      filtered = filtered.filter(i => !!i.favorite);
    }

    if (activeTag) {
      filtered = filtered.filter(i => i.tags?.includes(activeTag));
    }

    if (activeType) {
      filtered = filtered.filter(i => (i.template ?? "login") === activeType);
    }

    if (activeFolder !== null) {
      if (activeFolder === "") filtered = filtered.filter(i => !i.folder);
      else filtered = filtered.filter(i => i.folder === activeFolder);
    }

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "updatedAt") {
        const dA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dB - dA;
      } else {
        const dA = new Date(a.createdAt || 0).getTime();
        const dB = new Date(b.createdAt || 0).getTime();
        return dB - dA;
      }
    });

    return filtered;
  }, [items, activeFolder, activeFilter, activeTag, activeType, sortBy]);

  // Group by folder for "all" view
  const grouped = useMemo(() => {
    if (activeFolder !== null || activeFilter !== null || activeTag !== null || activeType !== null) return null;
    const map: Record<string, VaultItem[]> = { "": [] };
    folders.forEach(f => { map[f] = []; });
    visibleItems.forEach(i => { const k = i.folder || ""; if (map[k]) map[k].push(i); });
    return map;
  }, [visibleItems, folders, activeFolder, activeFilter, activeTag, activeType]);

  // Direct child subfolders when a folder is opened
  const directSubfolders = useMemo(() => {
    if (!activeFolder) return [];
    const prefix = `${activeFolder}/`;
    return folders.filter(f => {
      if (!f.startsWith(prefix)) return false;
      const rest = f.slice(prefix.length);
      return !rest.includes("/");
    });
  }, [folders, activeFolder]);

  // Select all visible items
  const handleSelectAll = () => {
    if (selectedIds.size === visibleItems.length && visibleItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleItems.map(i => i.id)));
    }
  };

  const toggleFolderCollapse = (f: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };


  // ── Not logged in
  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Button onClick={() => router.push("/")} variant="primary">Sign In</Button>
    </div>
  );

  // ── Loading state while restoring session or fetching items
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
    </div>
  );

  // ── Unlocked ──────────────────────────────────────────────────────────────

  const renderItem = (item: VaultItem) => {
    const isSelected = selectedIds.has(item.id);
    const isRevealed = revealedId === item.id;
    const itemPayload = isRevealed ? revealedData : null;
    const itemIcon = getItemIcon(item, itemPayload?.url || itemPayload?.urls?.[0]);
    const template = (item.template || (isRevealed && revealedData?._template) || "login") as Template;
    const meta = TEMPLATE_META[template];

    // Smart sub-line preview
    let subLine: string;
    if (isRevealed && revealedData) {
      if (template === "login") {
        subLine = revealedData.username || revealedData.email || (revealedData.urls?.[0] ? extractDomain(revealedData.urls[0]) : "");
      } else if (template === "card") {
        subLine = revealedData.cardNumber ? `•••• ${revealedData.cardNumber.replace(/\D/g, "").slice(-4)}` : (item.domain || revealedData.cardName || "");
      } else if (template === "note") {
        subLine = revealedData.note ? revealedData.note.slice(0, 60) : "";
      } else if (template === "profile") {
        subLine = revealedData.fullName || revealedData.email || "";
      } else if (template === "address") {
        subLine = [revealedData.city, revealedData.country].filter(Boolean).join(", ");
      } else {
        subLine = "";
      }
    } else {
      // Masked hints before reveal
      if (template === "login") subLine = item.domain ? `${item.domain}` : "Login credential";
      else if (template === "card") subLine = item.domain || "•••• ••••";
      else if (template === "note") subLine = "Encrypted note";
      else if (template === "profile") subLine = "Identity profile";
      else if (template === "address") subLine = "Saved address";
      else subLine = "";
    }

    const dateStr = item.updatedAt || item.createdAt
      ? new Date(item.updatedAt || item.createdAt || "").toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;

    const actionButtons = (
      <>
        {(!activeFilter || activeFilter !== "trash") && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id, !item.favorite); }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${item.favorite ? "text-amber-400 bg-amber-950/30" : "text-neutral-600 hover:text-amber-400 hover:bg-neutral-800"}`}
            title={item.favorite ? "Remove favorite" : "Add to favorites"}
          >
            <Star className={`w-3.5 h-3.5 ${item.favorite ? "fill-amber-400" : ""}`} />
          </button>
        )}
        {isRevealed && revealedData?.url && (
          <a
            href={revealedData.url.startsWith("http") ? revealedData.url : `https://${revealedData.url}`}
            target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            title="Open URL"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {activeFilter === "trash" ? (
          <>
            <button onClick={(e) => { e.stopPropagation(); handleRestoreItem(item.id); }} className="p-1.5 rounded-lg text-neutral-600 hover:text-emerald-400 hover:bg-emerald-950/30 transition-colors cursor-pointer" title="Restore">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleHardDelete(item); }} className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer" title="Delete permanently">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); handleTrashItem(item.id); }}
            className="p-1.5 rounded-lg text-neutral-700 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
            title="Move to Trash"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </>
    );

    if (viewMode === "grid") {
      return (
        <div
          key={item.id}
          id={`vault-item-${item.id}`}
          className={`group relative flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
            isRevealed
              ? "border-neutral-700 bg-neutral-900/60 shadow-lg shadow-black/20"
              : isSelected
              ? "border-[var(--accent)]/50 bg-neutral-900/40 ring-1 ring-[var(--accent)]/30"
              : "border-neutral-800/60 bg-neutral-900/20 hover:border-neutral-700 hover:bg-neutral-900/40"
          }`}
        >
          {/* Card header */}
          <div className="p-4 flex-1" onClick={() => toggleReveal(item.id, item.encryptedBlob)}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="shrink-0">{itemIcon}</div>
              <div className="flex items-center gap-1.5 shrink-0">
                {item.favorite && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                {item.hasTotp && (
                  <span className="text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded-full border border-violet-900/50 bg-violet-950/60 text-violet-400">2FA</span>
                )}
              </div>
            </div>

            <h3 className="text-[13px] font-semibold text-neutral-100 truncate mb-1">{item.name}</h3>
            <p className={`text-[11px] truncate font-mono ${isRevealed ? "text-neutral-400" : "text-neutral-600"}`}>
              {subLine}
            </p>

            {/* Folder + Tags */}
            {(item.folder || (item.tags && item.tags.length > 0)) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.folder && activeFolder === null && (
                  <span className="text-[9px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-neutral-500">
                    <Folder className="w-2.5 h-2.5" />{item.folder.split("/").pop()}
                  </span>
                )}
                {item.tags?.slice(0, 2).map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-neutral-500">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="px-3 py-2 border-t border-neutral-800/50 bg-neutral-950/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => { e.stopPropagation(); toggleSelection(item.id); }}
                onClick={(e) => e.stopPropagation()}
                className={`w-3.5 h-3.5 rounded accent-neutral-400 cursor-pointer transition-opacity ${isSelected || isSelectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
              />
              {dateStr && <span className="text-[9px] text-neutral-700 font-mono">{dateStr}</span>}
            </div>
            <div className="flex items-center gap-0.5">
              {actionButtons}
            </div>
          </div>

          {/* Expanded details */}
          {isRevealed && revealedData && (
            <div className="border-t border-neutral-800/60 bg-neutral-950/50">
              <ExpandedDetails
                itemId={item.id}
                decryptItem={decryptItem}
                cryptoKey={cryptoKey}
                data={revealedData}
                readOnly={activeFilter === "trash"}
                inGrid
                onEdit={() => setEditDialogItem({ id: item.id, name: item.name, folder: item.folder, tags: item.tags, template, payload: revealedData })}
              />
            </div>
          )}
        </div>
      );
    }

    // ── LIST VIEW ────────────────────────────────────────────────────────────
    return (
      <div
        key={item.id}
        id={`vault-item-${item.id}`}
        className={`group relative transition-all duration-150 border-l-2 ${
          isRevealed
            ? "bg-neutral-900/50 border-l-[var(--accent,#6366f1)]"
            : isSelected
            ? "bg-neutral-900/30 border-l-transparent"
            : "border-l-transparent hover:bg-neutral-900/15"
        }`}
      >
        <div className="flex items-center gap-2.5 px-3 py-3">
          {/* Checkbox — fixed width always reserved to prevent layout shift */}
          <div className="w-4 shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => { e.stopPropagation(); toggleSelection(item.id); }}
              className={`w-4 h-4 rounded accent-neutral-400 cursor-pointer bg-neutral-900 transition-opacity duration-150 ${
                isSelected || isSelectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-60"
              }`}
            />
          </div>

          {/* Icon */}
          <div className="shrink-0" onClick={() => toggleReveal(item.id, item.encryptedBlob)}>
            {itemIcon}
          </div>

          {/* Name + meta — main clickable area */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleReveal(item.id, item.encryptedBlob)}>
            {/* Top row: name + favorite + 2FA + date */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13.5px] font-medium text-neutral-100 truncate flex-shrink min-w-0">{item.name}</span>
              {item.favorite && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
              {item.hasTotp && (
                <span className="text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded-full border border-violet-900/50 bg-violet-950/60 text-violet-400 shrink-0 hidden sm:inline">2FA</span>
              )}
              {dateStr && (
                <span className="text-[10px] text-neutral-700 font-mono shrink-0 ml-auto hidden sm:inline">{dateStr}</span>
              )}
            </div>

            {/* Sub-line: masked preview or revealed data */}
            <div className="flex items-center gap-2 mt-0.5 min-w-0">
              <p className={`text-[11px] font-mono truncate ${isRevealed ? "text-neutral-400" : "text-neutral-600"}`}>
                {subLine || <span className="italic text-neutral-700 not-italic font-sans">Tap to reveal</span>}
              </p>
              {/* Folder pill — only in All Items view */}
              {item.folder && activeFolder === null && (
                <span className="text-[9px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-neutral-500 shrink-0 hidden sm:inline-flex">
                  <Folder className="w-2.5 h-2.5" />{item.folder.split("/").pop()}
                </span>
              )}
              {item.tags?.slice(0, 2).map(tag => (
                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-neutral-500 shrink-0 hidden sm:inline">#{tag}</span>
              ))}
            </div>
          </div>

          {/* Actions — always usable, hover-reveal on desktop */}
          <div className="flex items-center gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
            {actionButtons}
          </div>
        </div>

        {/* Expanded detail panel */}
        {isRevealed && revealedData && (
          <div className="mx-4 mb-3 rounded-xl border border-neutral-800/60 bg-neutral-950/60 overflow-hidden">
            <ExpandedDetails
              itemId={item.id}
              decryptItem={decryptItem}
              cryptoKey={cryptoKey}
              data={revealedData}
              readOnly={activeFilter === "trash"}
              onEdit={() => setEditDialogItem({ id: item.id, name: item.name, folder: item.folder, tags: item.tags, template, payload: revealedData })}
            />
          </div>
        )}
      </div>
    );
  };


  const renderGrouped = () => {
    if (!grouped) return null;

    const folderTree = buildFolderTree(folders);

    const renderFolderNode = (node: FolderNode, depth: number = 0) => {
      const grpItems = grouped[node.name] ?? [];
      const isExpanded = expandedFolders.has(node.name);
      const collapsed = !isExpanded;
      const indentPx = depth * 14;
      const hasChildren = node.children.length > 0;

      // Count items in node + descendants
      const descendantPaths = [node.name];
      const collect = (n: FolderNode) => n.children.forEach(c => { descendantPaths.push(c.name); collect(c); });
      collect(node);
      const totalCount = visibleItems.filter(i => i.folder && descendantPaths.includes(i.folder)).length;
      const directCount = grpItems.length;

      return (
        <div key={`folder-${node.name}`} className="my-3" style={{ marginLeft: `${indentPx}px` }}>
          {/* Unified folder card: header + items in one border */}
          <div className={`rounded-2xl border transition-colors ${
            collapsed ? "border-neutral-800/60" : "border-neutral-800/60"
          } overflow-hidden bg-neutral-900/20`}>

            {/* Header Row */}
            <div
              className="flex items-center justify-between px-3 py-2.5 group cursor-pointer hover:bg-neutral-900/30 transition-colors"
              onClick={() => toggleFolderCollapse(node.name)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0">
                  {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
                {depth > 0 && <CornerDownRight className="w-3 h-3 text-neutral-700 shrink-0" />}
                {collapsed
                  ? <Folder className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  : <FolderOpen className="w-3.5 h-3.5 text-[var(--accent,#6366f1)] shrink-0" />
                }
                <span className="text-[12px] font-semibold text-neutral-400 group-hover:text-neutral-200 truncate transition-colors">{node.label}</span>
                <span className="text-[9px] font-mono text-neutral-600 bg-neutral-800/60 px-1.5 py-0.5 rounded-full shrink-0">
                  {hasChildren && totalCount !== directCount ? `${directCount}/${totalCount}` : totalCount}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <Link
                  href={`/vault?folder=${encodeURIComponent(node.name)}`}
                  className="p-1 px-2 rounded-lg text-neutral-600 hover:text-neutral-200 hover:bg-neutral-800/60 text-[10px] flex items-center gap-1 transition-colors"
                  title="Open folder"
                >
                  Open <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Items directly in this folder */}
            {!collapsed && grpItems.length > 0 && (
              viewMode === "grid" ? (
                <div className="border-t border-neutral-800/40 p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-start gap-3">
                  {grpItems.map(renderItem)}
                </div>
              ) : (
                <div className="border-t border-neutral-800/40 divide-y divide-neutral-800/30">
                  {grpItems.map(renderItem)}
                </div>
              )
            )}
          </div>

          {/* Subfolder children indented below */}
          {!collapsed && node.children.length > 0 && (
            <div className="mt-1.5 space-y-1.5">
              {node.children.map(child => renderFolderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    const sections: React.ReactElement[] = [];

    folderTree.forEach(rootNode => {
      sections.push(renderFolderNode(rootNode, 0));
    });

    // Uncategorized
    const loose = grouped[""] ?? [];
    if (loose.length > 0) {
      const isLooseExpanded = expandedFolders.has("__uncategorized__");
      const looseCollapsed = !isLooseExpanded;
      sections.push(
        <div key="uncategorized" className="my-3">
          <div className="rounded-2xl border border-neutral-800/60 overflow-hidden bg-neutral-900/20">
            {/* Uncategorized header */}
            <div
              className="flex items-center justify-between px-3 py-2.5 group cursor-pointer hover:bg-neutral-900/30 transition-colors"
              onClick={() => toggleFolderCollapse("__uncategorized__")}
            >
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0">
                  {looseCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
                <Inbox className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-[12px] font-semibold text-neutral-400 group-hover:text-neutral-200">Uncategorized</span>
                <span className="text-[9px] font-mono text-neutral-600 bg-neutral-800/60 px-1.5 py-0.5 rounded-full">{loose.length}</span>
              </div>
            </div>
            {/* Items */}
            {!looseCollapsed && (
              viewMode === "grid" ? (
                <div className="border-t border-neutral-800/40 p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-start gap-3">
                  {loose.map(renderItem)}
                </div>
              ) : (
                <div className="border-t border-neutral-800/40 divide-y divide-neutral-800/30">
                  {loose.map(renderItem)}
                </div>
              )
            )}
          </div>
        </div>
      );
    }

    return sections;
  };

  return (
    <div>

      <main className={`${viewMode === "grid" ? "max-w-5xl" : "max-w-2xl"} mx-auto px-5 py-8 space-y-6 transition-all duration-300`}>

        {/* Add new entry button */}
        <button
          onClick={() => setIsNewEntryOpen(true)}
          className="group flex items-center gap-2.5 w-full px-4 py-3 rounded-xl border border-dashed border-[var(--border)] text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900/40 transition-all cursor-pointer"
        >
          <div className="w-5 h-5 rounded-md border border-[var(--border)] group-hover:border-neutral-600 flex items-center justify-center transition-colors shrink-0">
            <Plus className="w-3 h-3" />
          </div>
          <span className="text-[13px]">Add new item</span>
          <span className="ml-auto text-[11px] text-neutral-700 font-mono hidden sm:block">login · card · note</span>
        </button>

        {/* Opened folder banner & breadcrumbs */}
        {activeFolder !== null && activeFolder !== "" && (() => {
          const segments = activeFolder.split("/").filter(Boolean);
          return (
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 shadow-sm space-y-3">
              <nav className="flex items-center gap-1.5 flex-wrap text-[12px]" aria-label="Folder path">
                <Link href="/vault" className="text-neutral-500 hover:text-neutral-200 transition-colors flex items-center gap-1">
                  <LayoutList className="w-3.5 h-3.5" />
                  All Items
                </Link>
                {segments.map((seg, idx) => {
                  const path = segments.slice(0, idx + 1).join("/");
                  const isLast = idx === segments.length - 1;
                  return (
                    <React.Fragment key={path}>
                      <ChevronRight className="w-3 h-3 text-neutral-700 shrink-0" />
                      {isLast ? (
                        <span className="text-neutral-200 font-medium">{seg}</span>
                      ) : (
                        <Link href={`/vault?folder=${encodeURIComponent(path)}`} className="text-neutral-500 hover:text-neutral-200 transition-colors">
                          {seg}
                        </Link>
                      )}
                    </React.Fragment>
                  );
                })}
              </nav>

              <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
                <div className="flex items-center gap-2.5">
                  <FolderOpen className="w-5 h-5 text-[var(--accent,#6366f1)] shrink-0" />
                  <h1 className="text-[15px] font-semibold text-neutral-100">{segments[segments.length - 1]}</h1>
                  <span className="text-[11px] font-mono text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-800">
                    {visibleItems.length} item{visibleItems.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Subfolders Grid in opened folder view */}
        {activeFolder && directSubfolders.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] text-neutral-600 uppercase tracking-widest px-1 font-semibold">
              Subfolders ({directSubfolders.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {directSubfolders.map(subPath => {
                const subName = subPath.slice(activeFolder.length + 1);
                const subItemCount = items.filter(i => !i.deletedAt && (i.folder === subPath || i.folder?.startsWith(subPath + "/"))).length;
                return (
                  <Link
                    key={subPath}
                    href={`/vault?folder=${encodeURIComponent(subPath)}`}
                    className="group flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-800/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="p-1.5 rounded-lg bg-neutral-800/80 text-neutral-400 group-hover:text-neutral-200 transition-colors shrink-0">
                        <Folder className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-neutral-300 group-hover:text-neutral-100 truncate">{subName}</div>
                        <div className="text-[10px] text-neutral-600 font-mono">{subItemCount} item{subItemCount !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-300 transition-colors shrink-0 ml-1" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* New entry dialog (portal) */}
        <NewEntryDialog
          open={isNewEntryOpen}
          folders={folders}
          onSave={handleSave}
          onClose={() => setIsNewEntryOpen(false)}
          defaultTemplate={defaultTemplate}
          defaultFolder={activeFolder || ""}
        />

        {/* Edit entry dialog (portal) */}
        {editDialogItem && (
          <NewEntryDialog
            open={!!editDialogItem}
            folders={folders}
            onSave={handleSave}
            onClose={() => setEditDialogItem(null)}
            initialData={editDialogItem}
          />
        )}

        {/* Entries */}
        <div className="space-y-px">
          {/* List header */}
          <div className="flex items-center justify-between py-2">
            {/* Left: label + select-all */}
            <div className="flex items-center gap-3">
              {visibleItems.length > 0 && (
                <input
                  type="checkbox"
                  title="Select all"
                  checked={selectedIds.size === visibleItems.length && visibleItems.length > 0}
                  onChange={handleSelectAll}
                  className="w-3.5 h-3.5 rounded accent-neutral-500 cursor-pointer"
                />
              )}
              <div className="text-xs text-neutral-600 uppercase tracking-wider">
                {activeFilter === "trash" ? "Trash" :
                  activeFilter === "favorites" ? "Favorites" :
                    activeType ? `${activeType.charAt(0).toUpperCase()}${activeType.slice(1)}s` :
                      activeFolder !== null ? (activeFolder === "" ? "Uncategorized" : activeFolder) :
                        activeTag ? `#${activeTag}` :
                          "All Items"}
              </div>
                {isSelectionMode && (
                  <span className="text-[10px] text-neutral-500">{selectedIds.size} selected</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Empty Trash Button in Trash View */}
                {activeFilter === "trash" && visibleItems.length > 0 && (
                  <button
                    onClick={() => setPurgeTarget({ type: "all", ids: visibleItems.map(i => i.id), count: visibleItems.length })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-900/50 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-200 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Empty Trash ({visibleItems.length})
                  </button>
                )}
                {/* view toggle */}
                <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-800 hidden sm:flex">
                  <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md ${viewMode === "list" ? "bg-neutral-800 text-neutral-200 shadow-sm" : "text-neutral-500 hover:text-neutral-300"} transition-all flex items-center`}>
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md ${viewMode === "grid" ? "bg-neutral-800 text-neutral-200 shadow-sm" : "text-neutral-500 hover:text-neutral-300"} transition-all flex items-center`}>
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-600 hidden sm:inline">Sort:</span>
                  <Select
                    value={sortBy}
                    onChange={(v) => setSortBy(v as "createdAt" | "updatedAt" | "name")}
                    options={[
                      { value: "createdAt", label: "Date Added" },
                      { value: "updatedAt", label: "Last Modified" },
                      { value: "name",      label: "Name (A–Z)" },
                    ]}
                    className="w-36"
                  /></div>
              <span className="text-xs text-neutral-700 select-none hidden sm:inline">|</span>
              <span className="text-xs text-neutral-700">{visibleItems.length}</span>
            </div>
          </div>

          {/* Folder filter pills */}
          {folders.length > 0 && activeFolder === null && (
            <div className="flex flex-wrap gap-1.5 pb-3">
              {folders.map(f => (
                <button
                  key={f}
                  onClick={() => router.push(`/vault?folder=${encodeURIComponent(f)}`)}
                  className="text-[11px] flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-neutral-500 hover:text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors"
                >
                  <Folder className="w-2.5 h-2.5" /> {f}
                </button>
              ))}
              <button
                onClick={() => router.push("/vault?folder=")}
                className="text-[11px] flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] text-neutral-500 hover:text-neutral-300 hover:border-neutral-600 cursor-pointer transition-colors"
              >
                <Inbox className="w-2.5 h-2.5" /> Uncategorized
              </button>
            </div>
          )}

          {/* Empty state */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center relative">
              {/* Illustration */}
              <div className="w-80 h-80 sm:w-80 sm:h-80 opacity-80 mb-5">
                <Image
                  src="/illustrations/empty_4zx0.svg"
                  alt=""
                  width={144}
                  height={144}
                  className="object-contain w-full h-full"
                />
              </div>
              <p className="text-[14px] font-medium text-neutral-400 mb-1">Your vault is empty</p>
              <p className="text-[12px] text-neutral-600 max-w-[220px] leading-relaxed">Add your first entry using the button above. Everything is encrypted locally.</p>
            </div>
          )}

          {/* Grouped (all folders view) */}
          {grouped && items.length > 0 && (
            <div className="space-y-0">
              {renderGrouped()}
            </div>
          )}

          {/* Filtered (single-folder view) */}
          {!grouped && visibleItems.length > 0 && (
            <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-start gap-4" : "rounded-2xl border border-neutral-800/60 overflow-hidden divide-y divide-neutral-800/40 bg-neutral-900/10"}>
              {visibleItems.map(renderItem)}
            </div>
          )}

          {!grouped && visibleItems.length === 0 && items.length > 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-80 h-80 opacity-80 mb-4">
                <Image
                  src={activeFilter === "trash" ? "/illustrations/throw-away_k2t5.svg" : "/illustrations/new-entries_xw4m.svg"}
                  alt=""
                  width={80}
                  height={80}
                  className="object-contain w-full h-full"
                />
              </div>
              <p className="text-[13px] text-neutral-500">
                {activeFilter === "trash" ? "Trash is empty." : "No entries in this folder."}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Floating Bulk Action Bar */}
      {isSelectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
          {/* Confirm trash sub-panel */}
          {bulkConfirmTrash && (
            <div className="mb-2 flex items-center gap-3 px-4 py-3 rounded-xl border border-red-900/50 bg-neutral-950/95 backdrop-blur-md shadow-xl">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-[12px] text-neutral-300">
                Move <strong className="text-neutral-100">{selectedIds.size}</strong> item{selectedIds.size !== 1 ? "s" : ""} to trash?
              </span>
              <button
                onClick={async () => { setBulkConfirmTrash(false); await handleBulkAction("trash"); }}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 text-[11px] font-medium border border-red-900/50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {bulkBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Confirm
              </button>
              <button
                onClick={() => setBulkConfirmTrash(false)}
                className="p-1 rounded text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Main bar */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-neutral-800 bg-neutral-950/90 backdrop-blur-md shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
            {/* Loading overlay */}
            {bulkBusy && (
              <div className="flex items-center gap-2 px-2">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                <span className="text-[11px] text-neutral-400 whitespace-nowrap">Processing {selectedIds.size} items…</span>
              </div>
            )}

            {!bulkBusy && (
              <>
                {/* Selection info */}
                <div className="flex flex-col pr-1">
                  <span className="text-[12px] font-semibold text-neutral-200 whitespace-nowrap">{selectedIds.size} selected</span>
                  <button onClick={() => setSelectedIds(new Set())} className="text-[10px] text-neutral-600 hover:text-neutral-400 text-left transition-colors cursor-pointer">
                    Esc to deselect
                  </button>
                </div>

                <div className="w-px h-6 bg-neutral-800 mx-1" />

                {/* Move to folder — only outside trash */}
                {activeFilter !== "trash" && folders.length > 0 && (
                  <>
                    <select
                      onChange={e => {
                        if (e.target.value === "__none") return;
                        handleBulkAction("move", e.target.value);
                        (e.target as HTMLSelectElement).value = "__none";
                      }}
                      defaultValue="__none"
                      disabled={bulkBusy}
                      className="text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-300 px-2 py-1.5 rounded-lg outline-none cursor-pointer hover:border-neutral-600 transition-colors max-w-[130px] disabled:opacity-50"
                    >
                      <option value="__none" disabled>Move to…</option>
                      <option value="">(Uncategorized)</option>
                      {folders.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <div className="w-px h-6 bg-neutral-800 mx-1" />
                  </>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-0.5">
                  {activeFilter !== "trash" && (
                    <button
                      onClick={() => handleBulkAction("favorite")}
                      disabled={bulkBusy}
                      className="p-2 text-neutral-500 hover:text-amber-400 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Toggle Favorite"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}

                  {activeFilter === "trash" ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleBulkAction("restore")}
                        disabled={bulkBusy}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 hover:text-emerald-400 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="Restore Selected"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Restore
                      </button>
                      <button
                        onClick={() => setPurgeTarget({ type: "selected", ids: Array.from(selectedIds), count: selectedIds.size })}
                        disabled={bulkBusy}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="Permanently Delete Selected"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Permanently
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setBulkConfirmTrash(true)}
                      disabled={bulkBusy}
                      className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Move to Trash (Del)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        open={!!deleteModalTarget}
        itemName={deleteModalTarget?.name || ""}
        itemTemplate={deleteModalTarget?.template}
        onClose={() => setDeleteModalTarget(null)}
        onConfirm={confirmHardDelete}
      />

      {/* Empty Trash / Permanent Purge Master Password Reprompt Modal */}
      <EmptyTrashModal
        open={!!purgeTarget}
        target={purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={handleConfirmPurge}
      />
    </div>
  );
}

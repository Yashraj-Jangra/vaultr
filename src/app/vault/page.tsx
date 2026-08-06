"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useVault } from "@/context/VaultContext";
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
  ShieldCheck, Mail, Loader2, AlertTriangle, CornerDownRight, FolderPlus,
} from "lucide-react";
import { buildFolderTree, FolderNode } from "@/components/layout/Sidebar";
import { SiteIcon } from "@/components/vault/SiteIcon";
import { PasswordHealth } from "@/components/vault/PasswordHealth";
import { NewEntryDialog } from "@/components/vault/NewEntryDialog";
import { FolderSelect } from "@/components/vault/FolderSelect";
import { DetailedCardVisual } from "@/components/vault/DialogPreviews";
import { ConfirmDeleteModal } from "@/components/vault/ConfirmDeleteModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type Template = "login" | "card" | "address" | "profile" | "note";

interface CustomField { id: string; key: string; value: string; }

export interface DecryptedPayload {
  _template?: Template;
  _folder?: string;
  // login
  username?: string;
  password?: string;
  url?: string;
  urls?: string[];
  // card
  cardName?: string;
  cardNumber?: string;
  cardBrand?: string;
  expiry?: string;
  cvv?: string;
  pin?: string;
  // address
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  // profile
  fullName?: string;
  dob?: string;
  idNumber?: string;
  email?: string;
  phone?: string;
  // note
  note?: string;
  // shared
  customFields?: { key: string; value: string }[];
  totpSecret?: string;
  entryNotes?: string;
  passwordHistory?: string[];
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
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return "";
  }
}

const TEMPLATE_META: Record<Template, { label: string; icon: React.ReactNode; badgeClass: string; iconBg: string }> = {
  login: {
    label: "Login",
    icon: <Lock className="w-3.5 h-3.5" />,
    badgeClass: "text-indigo-400 bg-indigo-950/60 border-indigo-900/50",
    iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
  },
  card: {
    label: "Card",
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    badgeClass: "text-violet-400 bg-violet-950/60 border-violet-900/50",
    iconBg: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  },
  address: {
    label: "Address",
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    badgeClass: "text-emerald-400 bg-emerald-950/60 border-emerald-900/50",
    iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  },
  profile: {
    label: "Profile",
    icon: <User className="w-3.5 h-3.5" />,
    badgeClass: "text-sky-400 bg-sky-950/60 border-sky-900/50",
    iconBg: "bg-sky-500/10 border-sky-500/20 text-sky-400",
  },
  note: {
    label: "Note",
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
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

function MaskedValue({ value, mono = true }: { value: string; mono?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center justify-between gap-1 min-w-0">
      <span className={`truncate min-w-0 ${mono ? "font-mono" : ""} ${visible ? "text-neutral-200" : "text-neutral-500"} text-[12.5px]`}>
        {visible ? value : "••••••••••••"}
      </span>
      <div className="flex items-center shrink-0">
        <button onClick={() => setVisible(v => !v)} className="text-neutral-600 hover:text-neutral-300 cursor-pointer p-1 shrink-0">
          {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
        <CopyBtn value={value} />
      </div>
    </div>
  );
}

// ─── Password Generator widget ────────────────────────────────────────────────

function PasswordGen({ onUse, compact = false }: { onUse?: (pw: string) => void; compact?: boolean }) {
  const [len, setLen] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [nums, setNums] = useState(true);
  const [syms, setSyms] = useState(false);
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
    <div className={`space-y-3 ${compact ? "" : "p-4 border border-[var(--border)] rounded-lg bg-[var(--surface)]"}`}>
      {/* Output row */}
      <div className="flex items-center gap-1 bg-neutral-900 border border-[var(--border)] rounded px-3 py-2">
        <span className="flex-1 font-mono text-[12px] text-neutral-200 break-all select-all">{pw || "—"}</span>
        <button onClick={regen} className="text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer p-1 shrink-0" title="Regenerate">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={copy} className="text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer p-1 shrink-0" title="Copy">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-neutral-600 w-6 text-right shrink-0">{len}</span>
        <input
          type="range" min={8} max={64} value={len}
          onChange={e => setLen(+e.target.value)}
          className="flex-1 h-1 accent-neutral-500 cursor-pointer"
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {([["A–Z", upper, setUpper], ["a–z", lower, setLower], ["0–9", nums, setNums], ["!@#", syms, setSyms]] as [string, boolean, (v: boolean) => void][]).map(([label, val, set]) => (
          <label key={label} className="flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-neutral-300 cursor-pointer select-none transition-colors">
            <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="accent-neutral-400 w-3 h-3" />
            {label}
          </label>
        ))}
      </div>

      {onUse && (
        <button
          onClick={() => onUse(pw)}
          className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
        >
          ↑ Use this password
        </button>
      )}
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
  const [expiry, setExpiry] = useState(initialData?.payload.expiry || "");
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
    if (template === "card") Object.assign(payload, { cardName, cardNumber, expiry, cvv, pin });
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
            <div className="grid grid-cols-3 gap-2">
              <Input value={expiry} onChange={e => setExpiry(e.target.value)} placeholder="MM / YY" />
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

function DetailRow({ label, value, masked = false, isUrl = false }: {
  label: string; value: string; masked?: boolean; isUrl?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="text-[10.5px] text-neutral-500 font-medium w-16 sm:w-20 pt-0.5 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex-1 min-w-0">
        {masked ? <MaskedValue value={value} /> :
          isUrl ? (
            <div className="flex items-center justify-between gap-1 min-w-0">
              <a
                href={value.startsWith("http") ? value : `https://${value}`}
                target="_blank" rel="noopener noreferrer"
                className="text-[12.5px] font-mono text-indigo-400 hover:text-indigo-300 truncate underline decoration-indigo-500/30 min-w-0"
                title={value}
              >
                {value}
              </a>
              <CopyBtn value={value} />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1 min-w-0">
              <span className="text-[12.5px] font-mono text-neutral-200 truncate min-w-0" title={value}>{value}</span>
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

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-4 h-4 flex items-center justify-center">
        <svg className="w-4 h-4 -rotate-90 transform" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" className="text-neutral-800" />
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"
            className="text-sky-400 transition-all duration-1000 ease-linear"
            strokeDasharray="62.8"
            strokeDashoffset={62.8 * (1 - percent / 100)}
          />
        </svg>
      </div>
      <span className="font-mono text-[13px] text-sky-400 font-bold tracking-widest">{code.slice(0, 3)} {code.slice(3, 6)}</span>
      <CopyBtn value={code} />
    </div>
  );
}

function ExpandedDetails({ data, readOnly, onEdit, inGrid = false }: { data: DecryptedPayload, readOnly?: boolean, onEdit?: () => void, inGrid?: boolean }) {
  const t = data._template ?? "login";
  return (
    <div className={inGrid 
      ? "p-4 space-y-3 text-sm" 
      : "px-4 pb-4 pt-3 mx-4 mb-1 space-y-2.5 border-t border-[var(--border)] text-sm"
    }>
      {t === "login" && <>
        <DetailRow label="User" value={data.username || ""} />
        <DetailRow label="Password" value={data.password || ""} masked />
        {data.urls && data.urls.length > 0 ? (
          data.urls.map((u, i) => <DetailRow key={i} label={i === 0 ? "URL" : `URL ${i+1}`} value={u} isUrl />)
        ) : (
          <DetailRow label="URL" value={data.url || ""} isUrl />
        )}
        {data.totpSecret && (
          <div className="flex items-start gap-4">
            <span className="text-[11px] text-neutral-600 w-20 pt-0.5 shrink-0 uppercase tracking-wider">2FA Code</span>
            <div className="flex-1 min-w-0">
              <TotpDisplay secret={data.totpSecret} />
            </div>
          </div>
        )}
      </>}

      {t === "card" && <>
        <CreditCardGraphic data={data} />
        <DetailRow label="Name" value={data.cardName || ""} />
        <DetailRow label="Number" value={data.cardNumber || ""} masked />
        <DetailRow label="Expiry" value={data.expiry || ""} />
        <DetailRow label="CVV" value={data.cvv || ""} masked />
        <DetailRow label="PIN" value={data.pin || ""} masked />
      </>}

      {t === "address" && <>
        <DetailRow label="Line 1" value={data.line1 || ""} />
        <DetailRow label="Line 2" value={data.line2 || ""} />
        <DetailRow label="City" value={data.city || ""} />
        <DetailRow label="State" value={data.state || ""} />
        <DetailRow label="ZIP" value={data.zip || ""} />
        <DetailRow label="Country" value={data.country || ""} />
      </>}

      {t === "profile" && <>
        <DetailRow label="Name" value={data.fullName || ""} />
        <DetailRow label="Email" value={data.email || ""} />
        <DetailRow label="Phone" value={data.phone || ""} />
        <DetailRow label="DOB" value={data.dob || ""} />
        <DetailRow label="ID / No." value={data.idNumber || ""} masked />
      </>}

      {t === "note" && data.note && (
        <div className="space-y-1.5">
          <div className="flex items-start justify-between">
            <span className="text-[11px] text-neutral-600 uppercase tracking-wider">Note</span>
            <CopyBtn value={data.note} />
          </div>
          <p className="text-[13px] text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">{data.note}</p>
        </div>
      )}

      {data.customFields?.map((f, i) => f.value ? (
        <DetailRow key={i} label={f.key || "Field"} value={f.value} masked />
      ) : null)}

      {data.entryNotes && (
        <div className="space-y-1.5 pt-2 border-t border-[var(--border)] mt-2">
          <div className="flex items-start justify-between">
            <span className="text-[11px] text-neutral-600 uppercase tracking-wider">Private Notes</span>
            <CopyBtn value={data.entryNotes} />
          </div>
          <p className="text-[13px] text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">{data.entryNotes}</p>
        </div>
      )}

      {/* Legacy blobs */}
      {data.payload && (
        <p className="text-[13px] text-amber-400 font-mono break-all">{data.payload}</p>
      )}

      {/* Password History */}
      {data.passwordHistory && data.passwordHistory.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-[var(--border)] mt-2">
          <span className="text-[11px] text-neutral-600 uppercase tracking-wider">Previous Passwords</span>
          <div className="flex flex-col gap-1">
            {data.passwordHistory.map((pw, i) => (
              <div key={i} className="flex justify-between items-center bg-neutral-900 px-2 py-1.5 rounded text-[11px] font-mono text-neutral-400">
                <span>{pw}</span>
                <CopyBtn value={pw} />
              </div>
            ))}
          </div>
        </div>
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


function CreditCardGraphic({ data }: { data: DecryptedPayload }) {
  return (
    <div className="w-full max-w-[280px] mx-auto mb-4 scale-95 origin-center">
      <DetailedCardVisual
        cardNumber={data.cardNumber || ""}
        cardName={data.cardName || ""}
        expiry={data.expiry || ""}
        cardBrand={data.cardBrand}
      />
    </div>
  );
}

function getItemIcon(item: VaultItem) {
  const template = item.template || "login";
  const meta = TEMPLATE_META[template as Template];

  if (template === "card") {
    const nameLower = item.name.toLowerCase();
    const isVisa = nameLower.includes("visa");
    const isMastercard = nameLower.includes("mastercard") || nameLower.includes("master card") || nameLower.includes(" mc");
    const isAmex = nameLower.includes("amex") || nameLower.includes("american express");
    const isDiscover = nameLower.includes("discover");

    let cardBadge: React.ReactNode;
    if (isVisa) {
      cardBadge = <div className="text-[7.5px] font-black text-violet-300 italic tracking-tighter">VISA</div>;
    } else if (isMastercard) {
      cardBadge = (
        <div className="flex items-center gap-px">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-90" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-90 -ml-1.5" />
        </div>
      );
    } else if (isAmex) {
      cardBadge = <div className="text-[6.5px] font-bold text-violet-300">AMEX</div>;
    } else if (isDiscover) {
      cardBadge = <div className="text-[6.5px] font-extrabold text-amber-300">DISC</div>;
    } else {
      cardBadge = meta.icon;
    }

    return (
      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${meta.iconBg}`}>
        {cardBadge}
      </div>
    );
  }

  if (template === "login") {
    return (
      <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
        <SiteIcon domain={item.domain} name={item.name} size={32} />
      </div>
    );
  }

  return (
    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${meta.iconBg}`}>
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
    unlock: ctxUnlock,
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

  const [masterPassword, setMasterPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [unlockOverlay, setUnlockOverlay] = useState<"main" | "forgot" | "why">("main");

  // Random SVG pair — picked once on mount using lazy initializer (avoids setState-in-effect)
  const [randomSvgs] = useState<[string, string]>(() => {
    const svgs = [
      "/illustrations/vault_tyfh.svg",
      "/illustrations/safe_0mei.svg",
      "/illustrations/security_0ubl.svg",
      "/illustrations/firewall_cfej.svg",
      "/illustrations/private-files_m2bw.svg",
      "/illustrations/two-factor-authentication_ofho.svg",
      "/illustrations/mobile-encryption_flk2.svg"
    ];
    const shuffled = [...svgs].sort(() => 0.5 - Math.random());
    return [shuffled[0], shuffled[1]];
  });

  const searchParams = useSearchParams();
  const activeFolder = searchParams.get("folder"); // null = all, "" = uncategorized
  const activeFilter = searchParams.get("filter");
  const activeTag = searchParams.get("tag");
  const activeType = searchParams.get("type"); // item template type filter
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

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

    if (newParam && ["login", "card", "address", "profile", "note"].includes(newParam)) {
      setDefaultTemplate(newParam as Template);
      setIsNewEntryOpen(true);
      window.history.replaceState(null, "", "/vault");
    } else if (revealParam && items.length > 0) {
      const targetItem = items.find(x => x.id === revealParam);
      if (targetItem) {
        decryptItem(targetItem.encryptedBlob).then(raw => {
          let parsed: DecryptedPayload;
          try { parsed = JSON.parse(raw); } catch { parsed = { payload: raw }; }
          if (!parsed._template && (parsed.username || parsed.password)) parsed._template = "login";
          setEditDialogItem({
            id: targetItem.id,
            name: targetItem.name,
            folder: targetItem.folder,
            tags: targetItem.tags,
            template: targetItem.template || "login",
            payload: parsed,
          });
        }).catch(() => {});
      }
      window.history.replaceState(null, "", "/vault");
    }
  }, [searchParams, items, decryptItem, setIsNewEntryOpen]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleUnlock = async () => {
    if (!masterPassword) return;
    setUnlockError("");
    setUnlocking(true);
    // ctxUnlock validates password, saves session, and returns an error string on failure
    const err = await ctxUnlock(masterPassword);
    if (err) {
      setUnlockError(err);
      setShakeKey(k => k + 1);
    }
    setUnlocking(false);
  };

  const handleSave = async (name: string, template: Template, folder: string, tags: string[], payload: DecryptedPayload, editIdParams?: string): Promise<string | undefined> => {
    if (!cryptoKey || !user) return;
    const blob = await encryptData(JSON.stringify(payload));
    const domain = payload.url ? extractDomain(payload.url) : "";

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
    setDeleteModalTarget(item);
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
    setCollapsedFolders(prev => {
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

  // ── Locked — advanced unlock screen
  if (!cryptoKey) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--fg)] overflow-hidden">

      {/* ══════════════════════ DECORATIVE BACKGROUND ══════════════════════ */}

      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.015) 0%, transparent 70%)" }} />

      {/* Left side illustration */}
      <div key={`left-${randomSvgs[0]}`} className="absolute top-1/2 -translate-y-1/2 -left-16 hidden md:block w-[400px] h-[400px] pointer-events-none select-none opacity-[0.04]">
        <Image src={randomSvgs[0]} alt="" width={400} height={400} className="object-contain" priority />
      </div>

      {/* Bottom right illustration */}
      <div key={`right-${randomSvgs[1]}`} className="absolute -bottom-16 -right-16 hidden md:block w-[450px] h-[450px] pointer-events-none select-none opacity-[0.04]">
        <Image src={randomSvgs[1]} alt="" width={450} height={450} className="object-contain" priority />
      </div>

      {/* Mobile background illustration (fall back) */}
      <div key={`mob-${randomSvgs[0]}`} className="absolute bottom-10 right-0 w-48 h-48 pointer-events-none select-none md:hidden opacity-[0.03]">
        <Image src={randomSvgs[0]} alt="" width={192} height={192} className="object-contain" />
      </div>

      {/* ══════════════════════ CENTER FORM ══════════════════════ */}
      <div className="w-full max-w-[340px] relative z-10">

        {/* ✨ Main Unlock View ✨ */}
        <div
          className="w-full transition-all duration-500"
          style={{
            opacity: unlockOverlay === "main" ? 1 : 0,
            transform: unlockOverlay === "main" ? "translateY(0)" : "translateY(20px)",
            pointerEvents: unlockOverlay === "main" ? "auto" : "none",
            position: unlockOverlay === "main" ? "relative" : "absolute",
            top: 0, left: 0
          }}
        >
          {/* Lock icon halo */}
          <div className="flex flex-col items-center gap-5 animate-auth-panel-in">
            <div className="relative flex items-center justify-center mb-2">
              <div
                className="absolute w-28 h-28 rounded-full opacity-20 animate-pulse-ring"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)" }}
              />
              <div
                className={`w-20 h-20 rounded-2xl border flex items-center justify-center transition-all duration-300 relative z-10 ${unlocking
                  ? "bg-neutral-800 border-neutral-600 scale-105"
                  : "bg-[#0d0d0d] border-[var(--border)]"
                  }`}
              >
                <Image
                  src={activeTheme.mode === "dark" ? "/brand/lock-brand-dark.png" : "/brand/lock-brand-light.png"}
                  alt="_vaultr"
                  width={48}
                  height={48}
                  className={`w-12 h-12 object-contain transition-all duration-300 ${unlocking ? "opacity-100" : "opacity-60"}`}
                />
              </div>
            </div>

            <div className="text-center space-y-1.5 mb-2">
              <div className="flex items-center justify-center mb-1 opacity-60">
                <Image
                  src="/brand/logo-dark.png"
                  alt="_vaultr"
                  width={100}
                  height={20}
                  className="h-5 w-auto object-contain"
                />
              </div>
              <h1 className="text-[18px] font-semibold text-neutral-100 tracking-tight">
                {unlocking ? "Decrypting vault…" : "Unlock your vault"}
              </h1>
              <p className="text-[12px] text-neutral-500 font-mono truncate max-w-[260px]">
                {user.email}
              </p>
            </div>
          </div>

          <div key={shakeKey} className={`space-y-4 mt-6 ${unlockError && shakeKey > 0 ? "animate-shake" : ""}`}>
            {unlockError && (
              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-red-900/40 bg-red-950/25 animate-auth-form-in">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1" />
                <p className="text-[12px] text-red-400">{unlockError}</p>
              </div>
            )}

            <div className="relative">
              <input
                type="password"
                value={masterPassword}
                onChange={e => setMasterPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUnlock()}
                placeholder="Master password"
                autoFocus
                disabled={unlocking}
                className="w-full bg-[#0d0d0d] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-neutral-200 placeholder-neutral-700 outline-none focus:border-neutral-600 focus:ring-1 focus:ring-white/5 transition-all duration-200 pr-12 disabled:opacity-40 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
              />
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-700 pointer-events-none" />
            </div>

            <button
              onClick={handleUnlock}
              disabled={!masterPassword || unlocking}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-[0_4px_16px_rgba(255,255,255,0.05)]"
            >
              {unlocking
                ? <span className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-900 rounded-full animate-spin" />
                : <><Lock className="w-3.5 h-3.5" /> Unlock vault</>}
            </button>
          </div>

          <div className="flex items-center justify-between mt-6 text-[12px]">
            <button
              onClick={() => { setUnlockOverlay("forgot"); }}
              className="text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              Forgot password?
            </button>
            <button
              onClick={() => { setUnlockOverlay("why"); }}
              className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" /> Why is this needed?
            </button>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={async () => { await logout(); router.push("/"); }}
              className="text-[11px] text-neutral-700 hover:text-neutral-500 transition-colors cursor-pointer"
            >
              Sign out instead
            </button>
          </div>
        </div>

        {/* ✨ Forgot Password View ✨ */}
        <div
          className="w-full transition-all duration-500"
          style={{
            opacity: unlockOverlay === "forgot" ? 1 : 0,
            transform: unlockOverlay === "forgot" ? "translateY(0)" : "translateY(20px)",
            pointerEvents: unlockOverlay === "forgot" ? "auto" : "none",
            position: unlockOverlay === "forgot" ? "relative" : "absolute",
            top: 0, left: 0
          }}
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-red-950/20 border border-red-900/30 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(220,38,38,0.1)]">
              <Lock className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-[18px] font-semibold text-neutral-100">Unrecoverable Password</h2>
          </div>

          <div className="space-y-4">
            <p className="text-[13px] text-neutral-400 leading-relaxed text-center">
              SecureVault uses strict <strong>Zero-Knowledge Encryption</strong>. Your master password is never sent to our servers. It is strictly used locally to derive your AES-256-GCM decryption keys.
            </p>
            <div className="flex items-start gap-2.5 p-4 rounded-xl border border-red-900/40 bg-red-950/10">
              <Shield className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-200/80 leading-relaxed">
                This means if you forget your master password, <strong>your data cannot be recovered by anyone, including us.</strong>
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => { setUnlockOverlay("main"); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium transition-all active:scale-[0.98]"
            >
              Try another password
            </button>
            <button
              onClick={async () => { await logout(); router.push("/"); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-all active:scale-[0.98] bg-transparent"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ✨ Why Is This Needed View ✨ */}
        <div
          className="w-full transition-all duration-500"
          style={{
            opacity: unlockOverlay === "why" ? 1 : 0,
            transform: unlockOverlay === "why" ? "translateY(0)" : "translateY(20px)",
            pointerEvents: unlockOverlay === "why" ? "auto" : "none",
            position: unlockOverlay === "why" ? "relative" : "absolute",
            top: 0, left: 0
          }}
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-950/20 border border-indigo-900/30 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(99,102,241,0.1)]">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <h2 className="text-[18px] font-semibold text-neutral-100">Local Decryption</h2>
          </div>

          <div className="space-y-4">
            <p className="text-[13px] text-neutral-400 leading-relaxed text-center">
              When you log in, we only authenticate your identity, which pulls down the encrypted blobs from the server.
            </p>
            <p className="text-[13px] text-neutral-400 leading-relaxed text-center">
              Your <strong>Master Password</strong> is mathematically hashed (PBKDF2) locally inside your browser to derive a cryptographic key.
            </p>
            <div className="flex justify-center py-2">
              <div className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[#0d0d0d] font-mono text-[11px] text-neutral-500">
                AES-256-GCM
              </div>
            </div>
            <p className="text-[13px] text-neutral-400 leading-relaxed text-center">
              This key then decrypts your vault data locally. Without it, your data remains secure cipher text.
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={() => { setUnlockOverlay("main"); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium transition-all active:scale-[0.98]"
            >
              ← Back to unlock
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  // ── Unlocked ──────────────────────────────────────────────────────────────

  const renderItem = (item: VaultItem) => {
    const isSelected = selectedIds.has(item.id);
    const itemIcon = getItemIcon(item);
    const template = (item.template || "login") as Template;
    const meta = TEMPLATE_META[template];
    const isRevealed = revealedId === item.id;

    // Smart sub-line preview
    let subLine: string;
    if (isRevealed && revealedData) {
      if (template === "login") {
        subLine = revealedData.username || revealedData.email || (revealedData.urls?.[0] ? extractDomain(revealedData.urls[0]) : "");
      } else if (template === "card") {
        subLine = revealedData.cardNumber ? `•••• •••• •••• ${revealedData.cardNumber.slice(-4)}` : revealedData.cardName || "";
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
      else if (template === "card") subLine = "•••• •••• •••• ••••";
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
        className={`group relative transition-all duration-150 ${
          isRevealed
            ? "bg-neutral-900/50 border-l-2 border-l-[var(--accent,#6366f1)]"
            : isSelected
            ? "bg-neutral-900/30"
            : "hover:bg-neutral-900/15"
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
      const collapsed = collapsedFolders.has(node.name);
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
                  Open <ChevronRight className="w-3 h-3" />
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
      sections.push(
        <div key="uncategorized" className="my-3">
          <div className="rounded-2xl border border-neutral-800/60 overflow-hidden bg-neutral-900/20">
            {/* Uncategorized header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Inbox className="w-3.5 h-3.5 text-neutral-600" />
              <span className="text-[12px] font-semibold text-neutral-500">Uncategorized</span>
              <span className="text-[9px] font-mono text-neutral-600 bg-neutral-800/60 px-1.5 py-0.5 rounded-full">{loose.length}</span>
            </div>
            {/* Items */}
            {viewMode === "grid" ? (
              <div className="border-t border-neutral-800/40 p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 items-start gap-3">
                {loose.map(renderItem)}
              </div>
            ) : (
              <div className="border-t border-neutral-800/40 divide-y divide-neutral-800/30">
                {loose.map(renderItem)}
              </div>
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
                    <button
                      onClick={() => handleBulkAction("restore")}
                      disabled={bulkBusy}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-neutral-400 hover:text-green-400 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Restore Selected"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Restore
                    </button>
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
    </div>
  );
}

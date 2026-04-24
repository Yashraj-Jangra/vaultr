"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useVault } from "@/context/VaultContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionManager } from "@/hooks/useSessionManager";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { generateTOTP, getTotpPercentage } from "@/lib/totp";
import {
  Copy, Check, Eye, EyeOff, Trash2, ExternalLink,
  RefreshCw, ChevronDown, ChevronRight, Folder, FolderOpen,
  CreditCard, User, FileText, Lock, Plus, Minus, X, Wand2, Inbox, Shield, Star, Edit2, LayoutList, LayoutGrid,
  ShieldCheck, Mail,
} from "lucide-react";
import { SiteIcon } from "@/components/vault/SiteIcon";
import { PasswordHealth } from "@/components/vault/PasswordHealth";

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

const TEMPLATE_META: Record<Template, { label: string; icon: React.ReactNode }> = {
  login: { label: "Login", icon: <Lock className="w-3.5 h-3.5" /> },
  card: { label: "Credit Card", icon: <CreditCard className="w-3.5 h-3.5" /> },
  address: { label: "Address", icon: <FileText className="w-3.5 h-3.5" /> },
  profile: { label: "Profile", icon: <User className="w-3.5 h-3.5" /> },
  note: { label: "Secure Note", icon: <FileText className="w-3.5 h-3.5" /> },
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
    <div className="flex items-center gap-1 min-w-0">
      <span className={`break-all ${mono ? "font-mono" : ""} ${visible ? "text-neutral-200" : "text-neutral-600"} text-[13px]`}>
        {visible ? value : "•".repeat(Math.min(value.length, 20))}
      </span>
      <button onClick={() => setVisible(v => !v)} className="text-neutral-600 hover:text-neutral-300 cursor-pointer p-1 shrink-0">
        {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
      <CopyBtn value={value} />
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
  const [template, setTemplate] = useState<Template>(initialData?.template || "login");
  const [name, setName] = useState(initialData?.name || "");
  const [folder, setFolder] = useState(initialData?.folder || "");
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
            <Select
              value={folder}
              onChange={setFolder}
              options={[
                { value: "", label: "No folder" },
                ...folders.map(f => ({ value: f, label: f, icon: <Folder className="w-3.5 h-3.5" /> })),
                { value: "__new__", label: "+ New folder…", divider: folders.length > 0 },
              ]}
              placeholder="No folder"
            />
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
    <div className="flex items-start gap-4">
      <span className="text-[11px] text-neutral-600 w-20 pt-0.5 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex-1 min-w-0">
        {masked ? <MaskedValue value={value} /> :
          isUrl ? (
            <div className="flex items-center gap-1">
              <a
                href={value.startsWith("http") ? value : `https://${value}`}
                target="_blank" rel="noopener noreferrer"
                className="text-[13px] text-neutral-400 hover:text-neutral-200 break-all transition-colors"
              >
                {value}
              </a>
              <CopyBtn value={value} />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-[13px] text-neutral-200 break-all">{value}</span>
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

function ExpandedDetails({ data, readOnly, onEdit }: { data: DecryptedPayload, readOnly?: boolean, onEdit?: () => void }) {
  const t = data._template ?? "login";
  return (
    <div className="px-4 pb-4 pt-3 mx-4 mb-1 space-y-2.5 border-t border-[var(--border)] text-sm">
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VaultPage() {
  const { user, logout } = useFirebaseAuth();
  const router = useRouter();

  // ── Device gate: hook MUST be called before any early return (Rules of Hooks)
  const {
    loading: sessionsLoading,
    needsDeviceGate,
    autoVerificationEmailSent,
    sendVerificationEmail,
    verifyOtp,
    otpError,
    sendingCode: gateSendingCode,
    verifying: gateVerifying,
    clearOtpState: clearGateOtpState,
  } = useSessionManager(user?.uid ?? null);

  const [gateOtp, setGateOtp] = useState("");
  const [gateSent, setGateSent] = useState(false);
  const [gateShakeKey, setGateShakeKey] = useState(0);

  // Auto-show OTP input when server already dispatched the code
  useEffect(() => {
    if (autoVerificationEmailSent) setGateSent(true);
  }, [autoVerificationEmailSent]);

  // ── Pull everything from the shared VaultContext ──────────────────────────
  const {
    cryptoKey,
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

  // Bulk / Sort state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "name">("createdAt");
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

  const handleSave = async (name: string, template: Template, folder: string, tags: string[], payload: DecryptedPayload, editIdParams?: string) => {
    if (!cryptoKey || !user?.uid) return;
    const blob = await encryptData(JSON.stringify(payload));
    const domain = payload.url ? extractDomain(payload.url) : "";

    if (editIdParams) {
      const docRef = doc(db, "users", user.uid, "vaultItems", editIdParams);
      const updates: Partial<VaultItem> = {
        name,
        encryptedBlob: blob,
        template,
        hasTotp: !!payload.totpSecret,
        tags: tags.length > 0 ? tags : [],
        updatedAt: new Date().toISOString(),
      };
      // For folder and domain, empty string replaces existing value
      await updateDoc(docRef, { ...updates, folder: folder || "", domain: domain || "" });

      setEditId(null);
      if (revealedId === editIdParams) {
        setRevealedData(payload);
      }
    } else {
      const now = new Date().toISOString();
      const doc_: Partial<VaultItem> = {
        name,
        encryptedBlob: blob,
        template,
        createdAt: now,
        updatedAt: now,
        hasTotp: !!payload.totpSecret,
        tags: tags.length > 0 ? tags : [],
      };
      if (folder) doc_.folder = folder;
      if (domain) doc_.domain = domain;
      await addDoc(collection(db, "users", user.uid, "vaultItems"), doc_);
      setIsNewEntryOpen(false);
    }
  };

  const handleTrashItem = async (id: string) => {
    await deleteItem(id);
    if (revealedId === id) { setRevealedId(null); setRevealedData(null); }
  };

  const handleRestoreItem = async (id: string) => {
    await restoreItem(id);
  };

  const handleHardDelete = async (id: string) => {
    if (!window.confirm("This item will be deleted permanently and can never be recovered. Are you sure you want to proceed?")) return;
    await hardDeleteItem(id);
    if (revealedId === id) { setRevealedId(null); setRevealedData(null); }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkAction = async (action: "trash" | "restore" | "delete" | "favorite" | "move", payload?: string) => {
    if (!user || selectedIds.size === 0) return;

    if (action === "delete") {
      if (!window.confirm(`These ${selectedIds.size} item(s) will be deleted permanently and can never be recovered. Are you sure you want to proceed?`)) return;
    }

    const promises: Promise<void>[] = [];

    selectedIds.forEach(id => {
      if (action === "trash") promises.push(deleteItem(id));
      else if (action === "restore") promises.push(restoreItem(id));
      else if (action === "delete") promises.push(hardDeleteItem(id));
      else if (action === "favorite") {
        const item = items.find(i => i.id === id);
        if (item) promises.push(toggleFavorite(id, !item.favorite));
      }
      else if (action === "move") {
        const docRef = doc(db, "users", user.uid, "vaultItems", id);
        promises.push(updateDoc(docRef, { folder: payload || "" }));
      }
    });

    await Promise.all(promises);
    setSelectedIds(new Set());
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

  // ── Device gate handlers
  const handleGateSendCode = async () => {
    const result = await sendVerificationEmail();
    if (result.ok) {
      setGateSent(true);
      clearGateOtpState();
      setGateOtp("");
    }
  };

  const handleGateVerify = async () => {
    if (gateOtp.length !== 6) return;
    const result = await verifyOtp(gateOtp);
    if (!result.ok) setGateShakeKey((k) => k + 1);
    // On success: Firestore onSnapshot sets isTrusted → true
    // → isVerified → true → needsDeviceGate → false → gate unmounts automatically
  };

  // ── Not logged in
  if (!user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Button onClick={() => router.push("/")} variant="primary">Sign In</Button>
    </div>
  );

  // ── Sessions / prefs still loading — show minimal dark screen to prevent flash
  if (sessionsLoading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]">
      <div className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[#0d0d0d] flex items-center justify-center">
        <Lock className="w-4 h-4 text-neutral-700" />
      </div>
    </div>
  );

  // ── Device verification gate
  // Only shown when requireVerificationOnNew = true (OFF by default) AND device is not yet trusted.
  // When OFF: zero UI, zero banners — the user goes straight to their master password.
  if (needsDeviceGate) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--fg)] overflow-hidden">

      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.015) 0%, transparent 70%)" }} />

      {/* Left illustration */}
      <div className="absolute top-1/2 -translate-y-1/2 -left-16 hidden md:block w-[400px] h-[400px] pointer-events-none select-none opacity-[0.04]">
        <Image src={randomSvgs[0]} alt="" width={400} height={400} className="object-contain" priority />
      </div>
      {/* Bottom-right illustration */}
      <div className="absolute -bottom-16 -right-16 hidden md:block w-[450px] h-[450px] pointer-events-none select-none opacity-[0.04]">
        <Image src={randomSvgs[1]} alt="" width={450} height={450} className="object-contain" priority />
      </div>
      {/* Mobile fallback */}
      <div className="absolute bottom-10 right-0 w-48 h-48 pointer-events-none select-none md:hidden opacity-[0.03]">
        <Image src={randomSvgs[0]} alt="" width={192} height={192} className="object-contain" />
      </div>

      {/* Center card */}
      <div className="w-full max-w-[340px] relative z-10">

        {/* Header */}
        <div className="flex flex-col items-center gap-5 animate-auth-panel-in">
          {/* Shield halo */}
          <div className="relative flex items-center justify-center mb-2">
            <div
              className="absolute w-24 h-24 rounded-full opacity-20 animate-pulse-ring"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)" }}
            />
            <div className="w-16 h-16 rounded-2xl border border-[var(--border)] bg-[#0d0d0d] flex items-center justify-center relative z-10">
              <ShieldCheck className="w-6 h-6 text-neutral-500" />
            </div>
          </div>

          <div className="text-center space-y-1.5 mb-2">
            <div className="flex items-center justify-center gap-1.5 opacity-40">
              <ShieldCheck className="w-3 h-3" />
              <span className="text-[11px] font-medium tracking-widest uppercase text-neutral-500">Device Verification</span>
            </div>
            <h1 className="text-[18px] font-semibold text-neutral-100 tracking-tight">
              Verify this device
            </h1>
            <p className="text-[12px] text-neutral-500">
              Your account requires device verification before you can access your vault.
            </p>
          </div>
        </div>

        {/* Form */}
        <div key={gateShakeKey} className={`space-y-3 mt-6 ${gateShakeKey > 0 && otpError ? "animate-shake" : ""}`}>

          {/* Auto-sent info badge */}
          {gateSent && autoVerificationEmailSent && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-blue-900/40 bg-blue-950/20 animate-auth-form-in">
              <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <p className="text-[12px] text-blue-400">A verification code was sent to your email.</p>
            </div>
          )}

          {/* Error */}
          {otpError && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-red-900/40 bg-red-950/25 animate-auth-form-in">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1" />
              <p className="text-[12px] text-red-400">{otpError}</p>
            </div>
          )}

          {/* Step 1: request code */}
          {!gateSent ? (
            <button
              onClick={handleGateSendCode}
              disabled={gateSendingCode}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(255,255,255,0.05)]"
            >
              {gateSendingCode
                ? <span className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-900 rounded-full animate-spin" />
                : <><Mail className="w-3.5 h-3.5" /> Send verification code</>}
            </button>
          ) : (
            /* Step 2: enter code */
            <div className="space-y-3">
              <p className="text-[12px] text-neutral-500 text-center">Enter the 6-digit code sent to your email:</p>

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={gateOtp}
                onChange={(e) => {
                  clearGateOtpState();
                  setGateOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                }}
                onKeyDown={(e) => e.key === "Enter" && handleGateVerify()}
                placeholder="000000"
                autoFocus
                className="w-full bg-[#0d0d0d] border border-[var(--border)] rounded-xl px-4 py-3 text-[18px] text-neutral-200 font-mono text-center tracking-[0.4em] placeholder-neutral-800 outline-none focus:border-neutral-600 focus:ring-1 focus:ring-white/5 transition-all duration-200 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
              />

              <button
                onClick={handleGateVerify}
                disabled={gateVerifying || gateOtp.length !== 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-[0_4px_16px_rgba(255,255,255,0.05)]"
              >
                {gateVerifying
                  ? <span className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-900 rounded-full animate-spin" />
                  : <><ShieldCheck className="w-3.5 h-3.5" /> Verify device</>}
              </button>

              <button
                onClick={handleGateSendCode}
                disabled={gateSendingCode}
                className="w-full text-center text-[12px] text-neutral-700 hover:text-neutral-500 transition-colors py-1"
              >
                {gateSendingCode ? "Sending…" : "Resend code"}
              </button>
            </div>
          )}
        </div>
      </div>
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
                className="absolute w-24 h-24 rounded-full opacity-20 animate-pulse-ring"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)" }}
              />
              <div
                className={`w-16 h-16 rounded-2xl border flex items-center justify-center transition-all duration-300 relative z-10 ${unlocking
                  ? "bg-neutral-800 border-neutral-600 scale-105"
                  : "bg-[#0d0d0d] border-[var(--border)]"
                  }`}
              >
                <Lock className={`w-6 h-6 transition-all duration-300 ${unlocking ? "text-neutral-200" : "text-neutral-500"}`} />
              </div>
            </div>

            <div className="text-center space-y-1.5 mb-2">
              <div className="flex items-center justify-center gap-1.5 opacity-40">
                <Lock className="w-3 h-3" />
                <span className="text-[11px] font-medium tracking-widest uppercase text-neutral-500">SecureVault</span>
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
    return (
      <div key={item.id} className={viewMode === "grid" 
        ? `border border-[var(--border)] rounded-lg transition-colors bg-neutral-950/20 flex flex-col ${isSelected ? "ring-1 ring-neutral-500 bg-neutral-900/50" : ""}`
        : `border-t border-[var(--border)] first:border-t-0 transition-colors ${isSelected ? "bg-neutral-900/50" : ""}`
      }>
        <div className="flex items-center gap-3 px-4 py-2.5 group">
          {/* Selection Checkbox */}
          <div className={`shrink-0 flex items-center justify-center transition-opacity ${isSelected || isSelectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => { e.stopPropagation(); toggleSelection(item.id); }}
              className="w-4 h-4 rounded border-[var(--border)] accent-neutral-500 cursor-pointer bg-neutral-900"
            />
          </div>

          {/* Icon */}
          <SiteIcon domain={item.domain} name={item.name} />

          {/* Name + meta */}
          <div
            className="flex-1 cursor-pointer min-w-0"
            onClick={() => toggleReveal(item.id, item.encryptedBlob)}
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-neutral-200 truncate">{item.name}</span>
              {item.template && item.template !== "login" && (
                <span className="text-[10px] text-neutral-600 uppercase tracking-wider shrink-0">
                  {TEMPLATE_META[item.template]?.label}
                </span>
              )}
              {item.createdAt && (
                <span className="text-[11px] text-neutral-700 font-mono shrink-0 ml-auto">
                  {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
            {revealedId === item.id && revealedData?.username ? (
              <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{revealedData.username}</p>
            ) : (
              <p className="text-[11px] text-neutral-700 mt-0.5">Click to reveal</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0 opacity-10 md:opacity-100 group-hover:opacity-100 transition-opacity">
            {(!activeFilter || activeFilter !== "trash") && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id, !item.favorite); }}
                className={`hover:text-amber-400 transition-colors p-1.5 cursor-pointer ${item.favorite ? "text-amber-400" : "text-neutral-700"}`}
                title={item.favorite ? "Remove favorite" : "Add favorite"}
              >
                <Star className={`w-3.5 h-3.5 ${item.favorite ? "fill-amber-400" : ""}`} />
              </button>
            )}

            {revealedId === item.id && revealedData?.url && (
              <a
                href={revealedData.url.startsWith("http") ? revealedData.url : `https://${revealedData.url}`}
                target="_blank" rel="noopener noreferrer"
                className="text-neutral-600 hover:text-neutral-300 transition-colors p-1.5"
                title="Open URL"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {activeFilter === "trash" ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); handleRestoreItem(item.id); }} className="text-neutral-600 hover:text-green-400 transition-colors p-1.5 cursor-pointer" title="Restore"><RefreshCw className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => { e.stopPropagation(); handleHardDelete(item.id); }} className="text-neutral-600 hover:text-red-500 transition-colors p-1.5 cursor-pointer" title="Delete permanently"><Trash2 className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleTrashItem(item.id); }}
                className="text-neutral-700 hover:text-red-500 transition-colors p-1.5 cursor-pointer"
                title="Move to Trash"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Expanded detail */}
        {revealedId === item.id && revealedData && (
          editId === item.id ? (
            <div className="px-4 pb-4 pt-3 mx-4 mb-1">
              <NewEntryForm
                folders={folders}
                onSave={handleSave}
                onCancel={() => setEditId(null)}
                initialData={{
                  id: item.id,
                  name: item.name,
                  folder: item.folder,
                  tags: item.tags,
                  template: item.template || "login",
                  payload: revealedData
                }}
              />
            </div>
          ) : (
            <ExpandedDetails data={revealedData} readOnly={activeFilter === "trash"} onEdit={() => setEditId(item.id)} />
          )
        )}
      </div>
    );
  };

  const renderGrouped = () => {
    if (!grouped) return null;

    const sections: React.ReactElement[] = [];

    // Folder groups first
    folders.forEach(f => {
      const grpItems = grouped[f] ?? [];
      const collapsed = collapsedFolders.has(f);
      sections.push(
        <div key={`folder-${f}`}>
          <button
            onClick={() => { router.push("/vault"); toggleFolderCollapse(f); }}
            className="w-full flex items-center gap-2 px-1 py-2 text-[11px] text-neutral-500 hover:text-neutral-300 uppercase tracking-wider cursor-pointer transition-colors"
          >
            {collapsed
              ? <FolderOpen className="w-3.5 h-3.5" />
              : <Folder className="w-3.5 h-3.5" />
            }
            {f}
            <span className="text-neutral-700 ml-auto normal-case">{grpItems.length}</span>
            {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {!collapsed && grpItems.length > 0 && (
            <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4" : "border border-[var(--border)] rounded-lg overflow-hidden mb-4"}>
              {grpItems.map(renderItem)}
            </div>
          )}
          {!collapsed && grpItems.length === 0 && (
            <p className="text-[12px] text-neutral-700 px-1 pb-4">Empty folder.</p>
          )}
        </div>
      );
    });

    // Uncategorized
    const loose = grouped[""] ?? [];
    if (loose.length > 0) {
      sections.push(
        <div key="uncategorized">
          {folders.length > 0 && (
            <div className="text-[11px] text-neutral-600 uppercase tracking-wider px-1 py-2">Uncategorized</div>
          )}
          <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "border border-[var(--border)] rounded-lg overflow-hidden"}>
            {loose.map(renderItem)}
          </div>
        </div>
      );
    }

    return sections;
  };

  return (
    <div>

      <main className="max-w-2xl mx-auto px-5 py-8 space-y-6">

        {/* New entry button / form */}
        {!isNewEntryOpen ? (
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
        ) : (
          <NewEntryForm
            folders={folders}
            onSave={handleSave}
            onCancel={() => setIsNewEntryOpen(false)}
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
            <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "border border-[var(--border)] rounded-lg overflow-hidden"}>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-neutral-800 bg-neutral-950/90 backdrop-blur-md shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
          {/* Selection info */}
          <div className="flex flex-col pr-1">
            <span className="text-[12px] font-semibold text-neutral-200 whitespace-nowrap">{selectedIds.size} selected</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-[10px] text-neutral-600 hover:text-neutral-400 text-left transition-colors cursor-pointer">Deselect all</button>
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
                className="text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-300 px-2 py-1.5 rounded-lg outline-none cursor-pointer hover:border-neutral-600 transition-colors max-w-[130px]"
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
                className="p-2 text-neutral-500 hover:text-amber-400 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
                title="Toggle Favorite"
              >
                <Star className="w-4 h-4" />
              </button>
            )}

            {activeFilter === "trash" ? (
              <>
                <button
                  onClick={() => handleBulkAction("restore")}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-neutral-400 hover:text-green-400 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
                  title="Restore Selected"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restore
                </button>
                <button
                  onClick={() => handleBulkAction("delete")}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-neutral-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                  title="Delete Permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </>
            ) : (
              <button
                onClick={() => handleBulkAction("trash")}
                className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                title="Move to Trash"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useVault } from "@/context/VaultContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { generateTOTP, getTotpPercentage } from "@/lib/totp";
import {
  Copy, Check, Eye, EyeOff, Trash2, ExternalLink,
  RefreshCw, ChevronDown, ChevronRight, Folder, FolderOpen,
  CreditCard, User, FileText, Lock, Plus, X, Wand2, Inbox, Shield
} from "lucide-react";

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
  hasTotp?: boolean;
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

// Favicon with text fallback
function SiteIcon({ domain, name }: { domain?: string; name: string }) {
  const [err, setErr] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();
  if (!domain || err) {
    return (
      <span className="w-7 h-7 rounded bg-neutral-800 border border-[var(--border)] flex items-center justify-center text-[10px] font-medium text-neutral-400 shrink-0 select-none">
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      onError={() => setErr(true)}
      className="w-7 h-7 shrink-0 rounded object-contain bg-neutral-800 border border-[var(--border)] p-0.5"
    />
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
  onSave: (name: string, template: Template, folder: string, payload: DecryptedPayload) => Promise<void>;
  onCancel: () => void;
}

function NewEntryForm({ folders, onSave, onCancel }: NewEntryFormProps) {
  const [template, setTemplate] = useState<Template>("login");
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [saving, setSaving] = useState(false);
  const [showGen, setShowGen] = useState(false);

  // Login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [showTotpField, setShowTotpField] = useState(false);

  // Card
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [pin, setPin] = useState("");

  // Address
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState_] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");

  // Profile
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [profEmail, setProfEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Note
  const [note, setNote] = useState("");

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const addCustom = () => setCustomFields(p => [...p, { id: Math.random().toString(36).slice(2), key: "", value: "" }]);

  const activeFolder = folder === "__new__" ? newFolder.trim() : folder;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload: DecryptedPayload = {
      _template: template,
      _folder: activeFolder || undefined,
      customFields: customFields.map(f => ({ key: f.key, value: f.value })),
    };
    if (template === "login") Object.assign(payload, { username, password, url, totpSecret: totpSecret.trim() });
    if (template === "card") Object.assign(payload, { cardName, cardNumber, expiry, cvv, pin });
    if (template === "address") Object.assign(payload, { line1, line2, city, state: state, zip, country });
    if (template === "profile") Object.assign(payload, { fullName, dob, idNumber, email: profEmail, phone });
    if (template === "note") Object.assign(payload, { note });
    await onSave(name.trim(), template, activeFolder, payload);
    setSaving(false);
  };

  const sel = "w-full bg-transparent border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--fg)] focus:outline-none focus:border-[var(--border-hover)] transition-colors appearance-none cursor-pointer";

  return (
    <Card className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium">New entry</span>
        <button onClick={onCancel} className="text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Template + Folder row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 uppercase tracking-wider">Type</label>
          <div className="relative">
            <select className={sel} value={template} onChange={e => setTemplate(e.target.value as Template)}>
              <option value="login">Login</option>
              <option value="card">Credit Card</option>
              <option value="address">Address</option>
              <option value="profile">Profile</option>
              <option value="note">Secure Note</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-neutral-600 uppercase tracking-wider">Folder</label>
          <div className="relative">
            <select className={sel} value={folder} onChange={e => setFolder(e.target.value)}>
              <option value="">No folder</option>
              {folders.map(f => <option key={f} value={f}>{f}</option>)}
              <option value="__new__">+ New folder…</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {folder === "__new__" && (
        <Input value={newFolder} onChange={e => setNewFolder(e.target.value)} placeholder="Folder name" autoFocus />
      )}

      {/* Entry name */}
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={
          template === "login" ? "Name — e.g. Gmail, GitHub" :
            template === "card" ? "Card label — e.g. Visa Personal" :
              template === "address" ? "Label — e.g. Home, Office" :
                template === "profile" ? "Profile label — e.g. Personal ID" :
                  "Note title"
        }
      />

      {/* Template-specific fields */}
      {template === "login" && (
        <div className="space-y-3">
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username / Email" />

          {/* Password row with generator toggle */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="font-mono pr-8"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowGen(v => !v)}
                title="Generate password"
                className={`shrink-0 px-2 border rounded-md transition-colors cursor-pointer ${showGen
                    ? "border-neutral-600 text-neutral-200"
                    : "border-[var(--border)] text-neutral-600 hover:text-neutral-300 hover:border-neutral-600"
                  }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {showGen && (
              <div className="border border-[var(--border)] rounded-lg p-3 bg-neutral-950/60">
                <PasswordGen compact onUse={pw => { setPassword(pw); setShowGen(false); }} />
              </div>
            )}
          </div>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (optional)" />

          {!showTotpField ? (
            <button 
              type="button" 
              onClick={() => setShowTotpField(true)}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 w-fit flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add 2FA Secret
            </button>
          ) : (
            <div className="relative">
              <Input 
                value={totpSecret} 
                onChange={e => setTotpSecret(e.target.value)} 
                type="password"
                placeholder="TOTP Setup Key (Base32)" 
                className="font-mono pr-12"
              />
              <div className="absolute top-[9px] right-3 text-[10px] uppercase font-semibold tracking-wider text-neutral-600 select-none bg-neutral-900 px-1 py-0.5 rounded">
                TOTP
              </div>
            </div>
          )}
        </div>
      )}

      {template === "card" && (
        <div className="space-y-3">
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
        <div className="space-y-3">
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
        <div className="space-y-3">
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
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Write your secure note…"
          rows={5}
          className="w-full bg-transparent border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--fg)] placeholder-neutral-600 focus:outline-none focus:border-[var(--border-hover)] transition-colors resize-none"
        />
      )}

      {/* Custom fields */}
      {customFields.length > 0 && (
        <div className="space-y-2 pt-1">
          {customFields.map(f => (
            <div key={f.id} className="flex gap-2">
              <Input
                value={f.key}
                onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, key: e.target.value } : x))}
                placeholder="Label"
                className="w-1/3"
              />
              <Input
                value={f.value}
                onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))}
                placeholder="Value"
                type="password"
              />
              <button
                onClick={() => setCustomFields(p => p.filter(x => x.id !== f.id))}
                className="text-neutral-700 hover:text-red-400 transition-colors cursor-pointer shrink-0 px-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={addCustom}
        className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Add field
      </button>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
        <Button onClick={onCancel} variant="ghost">Cancel</Button>
        <Button onClick={handleSave} variant="primary" disabled={!name.trim() || saving}>
          {saving ? "Saving…" : "Encrypt & Save"}
        </Button>
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
      <span className="font-mono text-[13px] text-sky-400 font-bold tracking-widest">{code.slice(0,3)} {code.slice(3,6)}</span>
      <CopyBtn value={code} />
    </div>
  );
}

function ExpandedDetails({ data }: { data: DecryptedPayload }) {
  const t = data._template ?? "login";
  return (
    <div className="px-4 pb-4 pt-3 mx-4 mb-1 space-y-2.5 border-t border-[var(--border)]">
      {t === "login" && <>
        <DetailRow label="User" value={data.username || ""} />
        <DetailRow label="Password" value={data.password || ""} masked />
        <DetailRow label="URL" value={data.url || ""} isUrl />
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

      {/* Legacy blobs */}
      {data.payload && (
        <p className="text-[13px] text-amber-400 font-mono break-all">{data.payload}</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VaultPage() {
  const { user, logout } = useFirebaseAuth();
  const router = useRouter();

  // ── Pull everything from the shared VaultContext ──────────────────────────
  const {
    cryptoKey,
    items,
    unlock: ctxUnlock,
    encryptData,
    decryptItem,
    folders: ctxFolders,
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

  const [showForm, setShowForm] = useState(false);

  const searchParams = useSearchParams();
  const activeFolder = searchParams.get("folder"); // null = all, "" = uncategorized
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedData, setRevealedData] = useState<DecryptedPayload | null>(null);


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

  const handleSave = async (name: string, template: Template, folder: string, payload: DecryptedPayload) => {
    if (!cryptoKey || !user?.uid) return;
    const blob = await encryptData(JSON.stringify(payload));
    const domain = payload.url ? extractDomain(payload.url) : "";
    const doc_: Partial<VaultItem> = {
      name,
      encryptedBlob: blob,
      template,
      createdAt: new Date().toISOString(),
      hasTotp: !!payload.totpSecret,
    };
    if (folder) doc_.folder = folder;
    if (domain) doc_.domain = domain;
    await addDoc(collection(db, "users", user.uid, "vaultItems"), doc_);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!user?.uid) return;
    await deleteDoc(doc(db, "users", user.uid, "vaultItems", id));
    if (revealedId === id) { setRevealedId(null); setRevealedData(null); }
  };

  const toggleReveal = async (id: string, blob: string) => {
    if (revealedId === id) { setRevealedId(null); setRevealedData(null); return; }
    if (!cryptoKey) return;
    try {
      const raw = await decryptItem(blob);
      let parsed: DecryptedPayload;
      try { parsed = JSON.parse(raw); } catch { parsed = { payload: raw }; }
      // backward compat: old entries didn't have _template
      if (!parsed._template && (parsed.username || parsed.password)) parsed._template = "login";
      setRevealedId(id);
      setRevealedData(parsed);
    } catch { alert("Decryption failed."); }
  };

  // Derived — use ctxFolders from context (same data, avoids duplication)
  const folders = ctxFolders;

  const visibleItems = useMemo(() => {
    if (activeFolder === null) return items;
    if (activeFolder === "") return items.filter(i => !i.folder);
    return items.filter(i => i.folder === activeFolder);
  }, [items, activeFolder]);

  // Group by folder for "all" view
  const grouped = useMemo(() => {
    if (activeFolder !== null) return null;
    const map: Record<string, VaultItem[]> = { "": [] };
    folders.forEach(f => { map[f] = []; });
    items.forEach(i => { const k = i.folder || ""; if (map[k]) map[k].push(i); });
    return map;
  }, [items, folders, activeFolder]);

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

  const renderItem = (item: VaultItem) => (
    <div key={item.id} className="border-t border-[var(--border)] first:border-t-0">
      <div className="flex items-center gap-3 px-4 py-2.5">
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
        <div className="flex items-center gap-0.5 shrink-0">
          {revealedId === item.id && revealedData?.url && (
            <a
              href={revealedData.url.startsWith("http") ? revealedData.url : `https://${revealedData.url}`}
              target="_blank" rel="noopener noreferrer"
              className="text-neutral-600 hover:text-neutral-300 transition-colors p-1.5"
              title="Open URL"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => toggleReveal(item.id, item.encryptedBlob)}
            className={`text-[11px] px-2 py-1 rounded cursor-pointer transition-colors ${revealedId === item.id ? "text-neutral-300 bg-neutral-800" : "text-neutral-600 hover:text-neutral-400"
              }`}
          >
            {revealedId === item.id ? "Hide" : "Reveal"}
          </button>
          <button
            onClick={() => handleDelete(item.id)}
            className="text-neutral-700 hover:text-red-500 transition-colors p-1.5 cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {revealedId === item.id && revealedData && (
        <ExpandedDetails data={revealedData} />
      )}
    </div>
  );

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
            <div className="border border-[var(--border)] rounded-lg overflow-hidden mb-4">
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
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
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
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="text-[13px] text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New entry
          </button>
        ) : (
          <NewEntryForm
            folders={folders}
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Entries */}
        <div className="space-y-px">
          {/* List header */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-xs text-neutral-600 uppercase tracking-wider">
              {activeFolder !== null ? (
                <>{activeFolder === "" ? "Uncategorized" : activeFolder}</>
              ) : (
                <>Entries</>
              )}
            </div>
            <span className="text-xs text-neutral-700">{visibleItems.length}</span>
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
              <div className="w-28 h-28 sm:w-36 sm:h-36 opacity-60 mb-5">
                <Image
                  src="/illustrations/private-files_m2bw.svg"
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
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              {visibleItems.map(renderItem)}
            </div>
          )}

          {!grouped && visibleItems.length === 0 && items.length > 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 opacity-50 mb-4">
                <Image
                  src="/illustrations/computer-files_7dj6.svg"
                  alt=""
                  width={80}
                  height={80}
                  className="object-contain w-full h-full"
                />
              </div>
              <p className="text-[13px] text-neutral-500">No entries in this folder.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

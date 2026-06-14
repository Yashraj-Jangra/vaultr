"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Lock, CreditCard, FileText, User, Wand2, Plus, Minus,
  RefreshCw, Copy, Check, Folder, Shield, Eye, EyeOff,
  Globe, ShieldAlert, ShieldCheck, Hash, StickyNote,
  MapPin, ChevronRight, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

// ── Types ────────────────────────────────────────────────────────────────────

type Template = "login" | "card" | "address" | "profile" | "note";

interface CustomField { id: string; key: string; value: string; }

export interface DecryptedPayload {
  _template?: Template;
  _folder?: string;
  username?: string; password?: string; url?: string; urls?: string[];
  cardName?: string; cardNumber?: string; expiry?: string; cvv?: string; pin?: string;
  line1?: string; line2?: string; city?: string; state?: string; zip?: string; country?: string;
  fullName?: string; dob?: string; idNumber?: string; email?: string; phone?: string;
  note?: string;
  customFields?: { key: string; value: string }[];
  totpSecret?: string; entryNotes?: string; passwordHistory?: string[]; payload?: string;
}

export interface NewEntryDialogProps {
  open: boolean;
  folders: string[];
  onSave: (name: string, template: Template, folder: string, tags: string[], payload: DecryptedPayload, editId?: string) => Promise<void>;
  onClose: () => void;
  initialData?: { id: string; name: string; folder?: string; tags?: string[]; template: Template; payload: DecryptedPayload; };
}

// ── Template config ───────────────────────────────────────────────────────────

const TEMPLATES: { id: Template; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { id: "login",   label: "Login",   desc: "Credentials & URLs", icon: <Lock      className="w-4 h-4" />, color: "from-violet-500/20 to-violet-500/5  border-violet-500/30  text-violet-400" },
  { id: "card",    label: "Card",    desc: "Payment cards",      icon: <CreditCard className="w-4 h-4" />, color: "from-sky-500/20    to-sky-500/5    border-sky-500/30    text-sky-400"    },
  { id: "note",    label: "Note",    desc: "Secure text",        icon: <StickyNote className="w-4 h-4" />, color: "from-amber-500/20  to-amber-500/5  border-amber-500/30  text-amber-400"  },
  { id: "address", label: "Address", desc: "Location info",      icon: <MapPin    className="w-4 h-4" />, color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400"},
  { id: "profile", label: "Profile", desc: "Identity data",      icon: <User      className="w-4 h-4" />, color: "from-rose-500/20   to-rose-500/5   border-rose-500/30   text-rose-400"   },
];

// ── Password utilities ────────────────────────────────────────────────────────

function generatePassword(len: number, upper: boolean, lower: boolean, nums: boolean, syms: boolean): string {
  const pool = [upper ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "", lower ? "abcdefghijklmnopqrstuvwxyz" : "", nums ? "0123456789" : "", syms ? "!@#$%^&*-_=+" : ""].join("");
  if (!pool) return "";
  const arr = new Uint32Array(len);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(v => pool[v % pool.length]).join("");
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string; width: string } {
  if (!pw) return { score: 0, label: "", color: "bg-neutral-800", width: "0%" };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 14) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: s, label: "Weak",   color: "bg-red-500",    width: "25%"  };
  if (s === 2) return { score: s, label: "Fair",   color: "bg-amber-400",  width: "50%"  };
  if (s === 3) return { score: s, label: "Good",   color: "bg-lime-400",   width: "75%"  };
  return            { score: s, label: "Strong",  color: "bg-emerald-400", width: "100%" };
}

// ── Visual card component ─────────────────────────────────────────────────────

function CardVisual({ cardName, cardNumber, expiry, cvv: _cvv }: { cardName: string; cardNumber: string; expiry: string; cvv: string }) {
  const num = cardNumber.replace(/\D/g, "").padEnd(16, "·");
  const formatted = [num.slice(0,4), num.slice(4,8), num.slice(8,12), num.slice(12,16)].join("  ");
  const name = cardName || "CARDHOLDER NAME";
  const exp = expiry || "MM/YY";
  const isVisa = cardNumber.startsWith("4");
  const isMC = /^5[1-5]/.test(cardNumber);
  const isAmex = /^3[47]/.test(cardNumber);

  return (
    <div className="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden select-none"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
      {/* Shine overlay */}
      <div className="absolute inset-0 opacity-20"
        style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.3) 0%, transparent 60%)" }} />
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "20px 20px" }} />

      {/* Brand logo placeholder */}
      <div className="absolute top-4 right-4 flex items-center gap-0.5">
        {isVisa && <span className="text-white font-bold italic text-lg tracking-wider opacity-90">VISA</span>}
        {isMC && (
          <div className="flex">
            <div className="w-6 h-6 rounded-full bg-red-500 opacity-90" />
            <div className="w-6 h-6 rounded-full bg-amber-400 -ml-3 opacity-90" />
          </div>
        )}
        {isAmex && <span className="text-blue-300 font-bold text-xs tracking-[0.2em] opacity-90">AMEX</span>}
        {!isVisa && !isMC && !isAmex && (
          <div className="w-8 h-5 rounded-sm border border-white/20 bg-white/10" />
        )}
      </div>

      {/* Chip */}
      <div className="absolute top-[36%] left-6 w-8 h-6 rounded-md bg-gradient-to-br from-amber-300 to-amber-500 opacity-90"
        style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)" }}>
        <div className="absolute inset-0 grid grid-cols-3 gap-px p-px opacity-60">
          {[...Array(6)].map((_, i) => <div key={i} className="bg-amber-700/50 rounded-sm" />)}
        </div>
      </div>

      {/* Card number */}
      <div className="absolute bottom-[38%] left-6 right-6">
        <p className="font-mono text-[15px] text-white/90 tracking-[0.2em] leading-none">{formatted}</p>
      </div>

      {/* Bottom row */}
      <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
        <div>
          <p className="text-[8px] text-white/40 uppercase tracking-widest mb-0.5">Card Holder</p>
          <p className="text-[11px] text-white/80 uppercase tracking-wider font-medium truncate max-w-[140px]">{name}</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-white/40 uppercase tracking-widest mb-0.5">Expires</p>
          <p className="text-[11px] text-white/80 font-mono">{exp}</p>
        </div>
      </div>
    </div>
  );
}

// ── Password Generator drawer ─────────────────────────────────────────────────

function PasswordGenerator({ onUse }: { onUse: (pw: string) => void }) {
  const [len, setLen] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [nums,  setNums]  = useState(true);
  const [syms,  setSyms]  = useState(false);
  const [seed,  setSeed]  = useState(0);
  const [copied, setCopied] = useState(false);

  const pw = useMemo(() => generatePassword(len, upper, lower, nums, syms),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [len, upper, lower, nums, syms, seed]);

  const strength = getPasswordStrength(pw);
  const regen = () => setSeed(s => s + 1);
  const copy  = () => { navigator.clipboard.writeText(pw); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="rounded-xl border border-violet-500/20 bg-gradient-to-b from-violet-950/30 to-neutral-950/60 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-[11px] font-semibold text-violet-300 uppercase tracking-widest">Generator</span>
      </div>

      {/* Preview */}
      <div className="relative flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5">
        <span className="flex-1 font-mono text-[12px] text-neutral-100 break-all select-all leading-relaxed">{pw || "—"}</span>
        <div className="flex gap-1 shrink-0">
          <button onClick={regen} className="w-6 h-6 flex items-center justify-center text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer rounded-md hover:bg-neutral-800" title="Regenerate">
            <RefreshCw className="w-3 h-3" />
          </button>
          <button onClick={copy} className="w-6 h-6 flex items-center justify-center text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer rounded-md hover:bg-neutral-800" title="Copy">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Strength bar */}
      <div className="space-y-1">
        <div className="h-0.5 bg-neutral-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${strength.color}`} style={{ width: strength.width }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-neutral-600">{len} characters</span>
          <span className={`text-[10px] font-medium ${strength.score >= 4 ? "text-emerald-400" : strength.score >= 3 ? "text-lime-400" : strength.score >= 2 ? "text-amber-400" : "text-red-400"}`}>{strength.label}</span>
        </div>
      </div>

      {/* Length slider */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-neutral-600 w-4 shrink-0">8</span>
        <input type="range" min={8} max={64} value={len} onChange={e => setLen(+e.target.value)} className="flex-1 h-0.5 accent-violet-500 cursor-pointer" />
        <span className="text-[10px] text-neutral-600 w-6 text-right shrink-0">64</span>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-2">
        {([["A–Z", upper, setUpper], ["a–z", lower, setLower], ["0–9", nums, setNums], ["!@#", syms, setSyms]] as [string, boolean, (v: boolean) => void][]).map(([lbl, val, set]) => (
          <label key={lbl} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border cursor-pointer select-none transition-all ${val ? "border-violet-500/40 bg-violet-500/10 text-violet-300" : "border-neutral-800 text-neutral-600 hover:text-neutral-400"}`}>
            <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="sr-only" />
            {lbl}
          </label>
        ))}
      </div>

      <button onClick={() => onUse(pw)}
        className="w-full py-2 text-[11px] font-semibold text-violet-300 hover:text-white rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/40 transition-all cursor-pointer">
        ↑ Use this password
      </button>
    </div>
  );
}

// ── Field label ───────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.1em] mb-1.5 select-none">{children}</p>;
}

// ── Masked input (show/hide toggle) ──────────────────────────────────────────

function SecretInput({ value, onChange, placeholder, className = "" }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; className?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} className={`pr-9 ${className}`} />
      <button type="button" onClick={() => setShow(v => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer p-0.5">
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

export function NewEntryDialog({ open, folders, onSave, onClose, initialData }: NewEntryDialogProps) {

  // ── State ──────────────────────────────────────────────────────────────────
  const [template, setTemplate] = useState<Template>(initialData?.template ?? "login");
  const [name,     setName]     = useState(initialData?.name ?? "");
  const [folder,   setFolder]   = useState(initialData?.folder ?? "");
  const [newFolder,setNewFolder]= useState("");
  const [tags,     setTags]     = useState(initialData?.tags?.join(", ") ?? "");
  const [saving,   setSaving]   = useState(false);
  const [showGen,  setShowGen]  = useState(false);

  // Login
  const [username,   setUsername]   = useState(initialData?.payload.username ?? "");
  const [password,   setPassword]   = useState(initialData?.payload.password ?? "");
  const [urls,       setUrls]       = useState<string[]>(() => { const a = initialData?.payload.urls ? [...initialData.payload.urls] : []; if (initialData?.payload.url && !a.includes(initialData.payload.url)) a.unshift(initialData.payload.url); return a.length > 0 ? a : [""]; });
  const [totpSecret, setTotpSecret] = useState(initialData?.payload.totpSecret ?? "");
  const [showTotp,   setShowTotp]   = useState(!!initialData?.payload.totpSecret);

  // Card
  const [cardName,   setCardName]   = useState(initialData?.payload.cardName ?? "");
  const [cardNumber, setCardNumber] = useState(initialData?.payload.cardNumber ?? "");
  const [expiry,     setExpiry]     = useState(initialData?.payload.expiry ?? "");
  const [cvv,        setCvv]        = useState(initialData?.payload.cvv ?? "");
  const [pin,        setPin]        = useState(initialData?.payload.pin ?? "");

  // Address
  const [line1,    setLine1]    = useState(initialData?.payload.line1 ?? "");
  const [line2,    setLine2]    = useState(initialData?.payload.line2 ?? "");
  const [city,     setCity]     = useState(initialData?.payload.city ?? "");
  const [stateVal, setStateVal] = useState(initialData?.payload.state ?? "");
  const [zip,      setZip]      = useState(initialData?.payload.zip ?? "");
  const [country,  setCountry]  = useState(initialData?.payload.country ?? "");

  // Profile
  const [fullName,   setFullName]   = useState(initialData?.payload.fullName ?? "");
  const [dob,        setDob]        = useState(initialData?.payload.dob ?? "");
  const [idNumber,   setIdNumber]   = useState(initialData?.payload.idNumber ?? "");
  const [profEmail,  setProfEmail]  = useState(initialData?.payload.email ?? "");
  const [phone,      setPhone]      = useState(initialData?.payload.phone ?? "");

  // Note
  const [note, setNote] = useState(initialData?.payload.note ?? "");

  // Shared
  const [entryNotes,    setEntryNotes]    = useState(initialData?.payload.entryNotes ?? "");
  const [customFields,  setCustomFields]  = useState<CustomField[]>(() => initialData?.payload.customFields?.map(f => ({ id: crypto.randomUUID(), key: f.key, value: f.value })) ?? []);

  const addCustomField = () => setCustomFields(p => [...p, { id: crypto.randomUUID(), key: "", value: "" }]);

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setTemplate(initialData?.template ?? "login");
    setName(initialData?.name ?? "");
    setFolder(initialData?.folder ?? "");
    setNewFolder("");
    setTags(initialData?.tags?.join(", ") ?? "");
    setSaving(false);
    setShowGen(false);
    setUsername(initialData?.payload.username ?? "");
    setPassword(initialData?.payload.password ?? "");
    const a = initialData?.payload.urls ? [...initialData.payload.urls] : [];
    if (initialData?.payload.url && !a.includes(initialData.payload.url)) a.unshift(initialData.payload.url);
    setUrls(a.length > 0 ? a : [""]);
    setTotpSecret(initialData?.payload.totpSecret ?? "");
    setShowTotp(!!initialData?.payload.totpSecret);
    setCardName(initialData?.payload.cardName ?? "");
    setCardNumber(initialData?.payload.cardNumber ?? "");
    setExpiry(initialData?.payload.expiry ?? "");
    setCvv(initialData?.payload.cvv ?? "");
    setPin(initialData?.payload.pin ?? "");
    setLine1(initialData?.payload.line1 ?? "");
    setLine2(initialData?.payload.line2 ?? "");
    setCity(initialData?.payload.city ?? "");
    setStateVal(initialData?.payload.state ?? "");
    setZip(initialData?.payload.zip ?? "");
    setCountry(initialData?.payload.country ?? "");
    setFullName(initialData?.payload.fullName ?? "");
    setDob(initialData?.payload.dob ?? "");
    setIdNumber(initialData?.payload.idNumber ?? "");
    setProfEmail(initialData?.payload.email ?? "");
    setPhone(initialData?.payload.phone ?? "");
    setNote(initialData?.payload.note ?? "");
    setEntryNotes(initialData?.payload.entryNotes ?? "");
    setCustomFields(initialData?.payload.customFields?.map(f => ({ id: crypto.randomUUID(), key: f.key, value: f.value })) ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Key & scroll handlers ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeFolder = folder === "__new__" ? newFolder.trim() : folder;
  const strength     = getPasswordStrength(password);
  const currentTpl   = TEMPLATES.find(t => t.id === template)!;

  // ── Save handler ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload: DecryptedPayload = {
      _template: template,
      _folder: activeFolder || undefined,
      customFields: customFields.filter(f => f.key.trim() || f.value.trim()).map(f => ({ key: f.key, value: f.value })),
      entryNotes: entryNotes.trim() || undefined,
    };
    if (template === "login")   { const v = urls.map(u => u.trim()).filter(Boolean); Object.assign(payload, { username, password, url: v[0] ?? "", urls: v, totpSecret: totpSecret.trim() }); }
    if (template === "card")    Object.assign(payload, { cardName, cardNumber, expiry, cvv, pin });
    if (template === "address") Object.assign(payload, { line1, line2, city, state: stateVal, zip, country });
    if (template === "profile") Object.assign(payload, { fullName, dob, idNumber, email: profEmail, phone });
    if (template === "note")    Object.assign(payload, { note });
    const parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);
    if (initialData?.payload.password && initialData.payload.password !== password) {
      payload.passwordHistory = [...(initialData.payload.passwordHistory ?? []), initialData.payload.password].slice(-5);
    } else if (initialData?.payload.passwordHistory) {
      payload.passwordHistory = initialData.payload.passwordHistory;
    }
    await onSave(name.trim(), template, activeFolder, parsedTags, payload, initialData?.id);
    setSaving(false);
  }, [name, template, activeFolder, customFields, entryNotes, urls, username, password, totpSecret, cardName, cardNumber, expiry, cvv, pin, line1, line2, city, stateVal, zip, country, fullName, dob, idNumber, profEmail, phone, note, tags, initialData, onSave]);

  if (typeof window === "undefined" || !open) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" aria-modal="true" role="dialog">

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      {/* Dialog panel — wide two-column */}
      <div className="relative z-10 w-full max-w-4xl flex rounded-2xl overflow-hidden border border-neutral-800/80 shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
        style={{ maxHeight: "88dvh", animation: "dialogIn 280ms cubic-bezier(0.16,1,0.3,1) forwards" }}>

        {/* ━━━━ LEFT PANEL — navigation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="w-56 shrink-0 flex flex-col bg-neutral-950 border-r border-neutral-800/80">

          {/* Logo / context */}
          <div className="px-4 pt-5 pb-4">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-neutral-500" />
              </div>
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">
                {initialData ? "Edit entry" : "New entry"}
              </span>
            </div>

            {/* Type selector */}
            <p className="text-[9px] font-semibold text-neutral-700 uppercase tracking-[0.15em] mb-2">Entry type</p>
            <div className="space-y-1">
              {TEMPLATES.map(t => {
                const active = template === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all cursor-pointer group ${active ? `bg-gradient-to-r ${t.color.split(" ").slice(0,2).join(" ")} border ${t.color.split(" ")[2]}` : "hover:bg-neutral-900 border border-transparent"}`}>
                    <span className={`shrink-0 ${active ? t.color.split(" ")[3] : "text-neutral-600 group-hover:text-neutral-400"} transition-colors`}>{t.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-[12px] font-medium leading-tight ${active ? "text-neutral-100" : "text-neutral-400 group-hover:text-neutral-300"}`}>{t.label}</p>
                      <p className="text-[10px] text-neutral-600 leading-tight mt-0.5">{t.desc}</p>
                    </div>
                    {active && <ChevronRight className="w-3 h-3 text-neutral-500 ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-neutral-800/80 mx-4" />

          {/* Metadata section */}
          <div className="px-4 py-4 space-y-3 flex-1">
            <div>
              <FieldLabel>Name</FieldLabel>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={template === "login" ? "e.g. GitHub" : template === "card" ? "e.g. Visa Gold" : template === "note" ? "Note title" : template === "address" ? "e.g. Home" : "e.g. Personal ID"}
                autoFocus={!initialData}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-[12px] text-neutral-100 placeholder-neutral-700 outline-none focus:border-neutral-600 transition-colors"
              />
            </div>

            <div>
              <FieldLabel>Folder</FieldLabel>
              <Select
                value={folder}
                onChange={setFolder}
                options={[
                  { value: "", label: "No folder" },
                  ...folders.map(f => ({ value: f, label: f, icon: <Folder className="w-3 h-3" /> })),
                  { value: "__new__", label: "+ New folder…", divider: folders.length > 0 },
                ]}
                placeholder="No folder"
              />
              {folder === "__new__" && (
                <input
                  value={newFolder}
                  onChange={e => setNewFolder(e.target.value)}
                  placeholder="Folder name"
                  autoFocus
                  className="mt-2 w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-[12px] text-neutral-100 placeholder-neutral-700 outline-none focus:border-neutral-600 transition-colors"
                />
              )}
            </div>

            <div>
              <FieldLabel>Tags</FieldLabel>
              <div className="relative">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-700 pointer-events-none" />
                <input
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="work, personal…"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-7 pr-3 py-2 text-[12px] text-neutral-100 placeholder-neutral-700 outline-none focus:border-neutral-600 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Bottom encryption badge */}
          <div className="px-4 py-3 border-t border-neutral-800/80">
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-700">
              <Shield className="w-3 h-3" />
              <span>End-to-end encrypted</span>
            </div>
          </div>
        </div>

        {/* ━━━━ RIGHT PANEL — form fields ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0c0c0e]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${currentTpl.color.split(" ").slice(0,2).join(" ")} border ${currentTpl.color.split(" ")[2]} flex items-center justify-center`}>
                <span className={currentTpl.color.split(" ")[3]}>{currentTpl.icon}</span>
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-neutral-100">{name || `New ${currentTpl.label}`}</h2>
                <p className="text-[11px] text-neutral-600">{currentTpl.desc}</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-neutral-600 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* ── LOGIN ──────────────────────────────────────────────────────── */}
            {template === "login" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Username / Email</FieldLabel>
                    <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="user@example.com" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <FieldLabel>Password</FieldLabel>
                      <button type="button" onClick={() => setShowGen(v => !v)}
                        className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md transition-all cursor-pointer ${showGen ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-neutral-600 hover:text-neutral-300"}`}>
                        <Wand2 className="w-3 h-3" /> Generate
                      </button>
                    </div>
                    <SecretInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="font-mono" />
                    {/* Strength bar */}
                    {password && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-0.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                        </div>
                        <span className={`text-[10px] font-medium shrink-0 ${strength.score >= 4 ? "text-emerald-400" : strength.score >= 3 ? "text-lime-400" : strength.score >= 2 ? "text-amber-400" : "text-red-400"}`}>{strength.label}</span>
                      </div>
                    )}
                  </div>
                </div>

                {showGen && (
                  <PasswordGenerator onUse={pw => { setPassword(pw); setShowGen(false); }} />
                )}

                {/* Password breach check */}
                {password.length >= 8 && <BreachIndicator password={password} />}

                {/* URLs */}
                <div>
                  <FieldLabel>URLs</FieldLabel>
                  <div className="space-y-2">
                    {urls.map((u, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <div className="w-6 h-6 flex items-center justify-center shrink-0">
                          <Globe className="w-3.5 h-3.5 text-neutral-700" />
                        </div>
                        <Input value={u} onChange={e => setUrls(p => p.map((x, idx) => idx === i ? e.target.value : x))} placeholder="https://…" />
                        {i === urls.length - 1 ? (
                          <button type="button" onClick={() => setUrls(p => [...p, ""])} className="shrink-0 w-7 h-8 flex items-center justify-center border rounded-lg border-neutral-800 text-neutral-600 hover:text-neutral-300 hover:border-neutral-600 transition-colors cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
                        ) : (
                          <button type="button" onClick={() => setUrls(p => p.filter((_, idx) => idx !== i))} className="shrink-0 w-7 h-8 flex items-center justify-center border rounded-lg border-neutral-800 text-neutral-600 hover:text-red-400 hover:border-red-900/40 transition-colors cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* TOTP */}
                <div>
                  {!showTotp ? (
                    <button type="button" onClick={() => setShowTotp(true)}
                      className="flex items-center gap-1.5 text-[11px] text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer py-1">
                      <Plus className="w-3 h-3" /> Add 2FA / TOTP secret
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <FieldLabel>2FA / TOTP Secret</FieldLabel>
                        <button type="button" onClick={() => { setShowTotp(false); setTotpSecret(""); }} className="text-[10px] text-neutral-700 hover:text-red-400 transition-colors cursor-pointer">Remove</button>
                      </div>
                      <div className="relative">
                        <SecretInput value={totpSecret} onChange={e => setTotpSecret(e.target.value)} placeholder="TOTP setup key (Base32)" className="font-mono" />
                        <div className="absolute top-1/2 -translate-y-1/2 right-9 text-[9px] font-bold uppercase tracking-widest text-neutral-600 select-none bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">TOTP</div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── CARD ───────────────────────────────────────────────────────── */}
            {template === "card" && (
              <>
                {/* Live card visual */}
                <CardVisual cardName={cardName} cardNumber={cardNumber} expiry={expiry} cvv={cvv} />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Cardholder Name</FieldLabel>
                    <Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Full name on card" />
                  </div>
                  <div>
                    <FieldLabel>Card Number</FieldLabel>
                    <Input value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="•••• •••• •••• ••••" className="font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <FieldLabel>Expiry</FieldLabel>
                    <Input value={expiry} onChange={e => setExpiry(e.target.value)} placeholder="MM / YY" />
                  </div>
                  <div>
                    <FieldLabel>CVV</FieldLabel>
                    <SecretInput value={cvv} onChange={e => setCvv(e.target.value)} placeholder="•••" />
                  </div>
                  <div>
                    <FieldLabel>PIN</FieldLabel>
                    <SecretInput value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" />
                  </div>
                </div>
              </>
            )}

            {/* ── ADDRESS ────────────────────────────────────────────────────── */}
            {template === "address" && (
              <>
                <div>
                  <FieldLabel>Street Address</FieldLabel>
                  <Input value={line1} onChange={e => setLine1(e.target.value)} placeholder="Address line 1" />
                </div>
                <div>
                  <FieldLabel>Apt / Suite / Unit</FieldLabel>
                  <Input value={line2} onChange={e => setLine2(e.target.value)} placeholder="Address line 2 (optional)" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>City</FieldLabel>
                    <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
                  </div>
                  <div>
                    <FieldLabel>State / Province</FieldLabel>
                    <Input value={stateVal} onChange={e => setStateVal(e.target.value)} placeholder="State / Province" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>ZIP / Postal Code</FieldLabel>
                    <Input value={zip} onChange={e => setZip(e.target.value)} placeholder="ZIP / Postal code" />
                  </div>
                  <div>
                    <FieldLabel>Country</FieldLabel>
                    <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" />
                  </div>
                </div>
              </>
            )}

            {/* ── PROFILE ────────────────────────────────────────────────────── */}
            {template === "profile" && (
              <>
                <div>
                  <FieldLabel>Full Name</FieldLabel>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full legal name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Email Address</FieldLabel>
                    <Input value={profEmail} onChange={e => setProfEmail(e.target.value)} placeholder="email@example.com" type="email" />
                  </div>
                  <div>
                    <FieldLabel>Phone Number</FieldLabel>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Date of Birth</FieldLabel>
                    <Input value={dob} onChange={e => setDob(e.target.value)} placeholder="YYYY-MM-DD" />
                  </div>
                  <div>
                    <FieldLabel>ID / Passport Number</FieldLabel>
                    <SecretInput value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="ID / Passport no." />
                  </div>
                </div>
              </>
            )}

            {/* ── NOTE ───────────────────────────────────────────────────────── */}
            {template === "note" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <FieldLabel>Secure Note</FieldLabel>
                  <span className="text-[10px] text-neutral-700 tabular-nums">{note.length} chars</span>
                </div>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Write your secure note here…"
                  rows={10}
                  className="w-full bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3 text-[13px] text-neutral-200 placeholder-neutral-700 focus:outline-none focus:border-neutral-600 transition-colors resize-none font-mono leading-relaxed"
                />
              </div>
            )}

            {/* ── SHARED: Private Notes ───────────────────────────────────────── */}
            {template !== "note" && (
              <div>
                <FieldLabel>Private Notes</FieldLabel>
                <textarea
                  value={entryNotes}
                  onChange={e => setEntryNotes(e.target.value)}
                  placeholder="Optional private notes…"
                  rows={2}
                  className="w-full bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3 text-[13px] text-neutral-200 placeholder-neutral-700 focus:outline-none focus:border-neutral-600 transition-colors resize-none"
                />
              </div>
            )}

            {/* ── Custom Fields ───────────────────────────────────────────────── */}
            {customFields.length > 0 && (
              <div>
                <FieldLabel>Custom Fields</FieldLabel>
                <div className="space-y-2">
                  {customFields.map(f => (
                    <div key={f.id} className="flex gap-2 items-center">
                      <Input value={f.key} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, key: e.target.value } : x))} placeholder="Label" className="w-[35%] shrink-0" />
                      <Input value={f.value} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder="Value" type="password" />
                      <button onClick={() => setCustomFields(p => p.filter(x => x.id !== f.id))} className="shrink-0 w-7 h-8 flex items-center justify-center text-neutral-700 hover:text-red-400 transition-colors cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={addCustomField}
              className="flex items-center gap-1.5 text-[11px] text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer">
              <Plus className="w-3 h-3" /> Add custom field
            </button>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800/80 bg-neutral-950/60 shrink-0">
            <div className="text-[10px] text-neutral-700 font-mono">
              {template} · {activeFolder || "no folder"}
              {tags && ` · #${tags.split(",").map(t => t.trim()).filter(Boolean).join(" #")}`}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onClose} variant="ghost" disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} variant="primary" disabled={!name.trim() || saving}>
                {saving ? "Saving…" : initialData ? "Save Changes" : "Encrypt & Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dialogIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>,
    document.body
  );
}

// ── Breach indicator (async) ─────────────────────────────────────────────────

function BreachIndicator({ password }: { password: string }) {
  const [state, setState] = useState<"loading" | "safe" | "breached" | "error">("loading");
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    setState("loading");
    const check = async () => {
      try {
        const buf  = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
        const hex  = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        const res  = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`);
        const text = await res.text();
        const suffix = hex.slice(5);
        let found = 0;
        for (const line of text.split("\n")) {
          const [s, c] = line.split(":");
          if (s.trim() === suffix) { found = parseInt(c, 10); break; }
        }
        if (mounted) { setState(found > 0 ? "breached" : "safe"); setCount(found); }
      } catch { if (mounted) setState("error"); }
    };
    const t = setTimeout(check, 600);
    return () => { mounted = false; clearTimeout(t); };
  }, [password]);

  if (state === "loading") return (
    <div className="flex items-center gap-2 text-[11px] text-neutral-600 py-1">
      <div className="w-3 h-3 border border-neutral-700 border-t-neutral-400 rounded-full animate-spin shrink-0" />
      Checking breach database…
    </div>
  );
  if (state === "breached") return (
    <div className="flex items-center gap-2 text-[11px] px-3 py-2.5 rounded-lg bg-red-950/30 text-red-400 border border-red-900/40">
      <ShieldAlert className="w-4 h-4 shrink-0" />
      Found in <strong>{count.toLocaleString()}</strong> data breaches — change immediately
    </div>
  );
  if (state === "safe") return (
    <div className="flex items-center gap-2 text-[11px] px-3 py-2.5 rounded-lg bg-emerald-950/20 text-emerald-400 border border-emerald-900/40">
      <ShieldCheck className="w-4 h-4 shrink-0" />
      Not found in any known breach databases
    </div>
  );
  return null;
}

"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Lock, CreditCard, FileText, User, Wand2, Plus, Minus,
  RefreshCw, Copy, Check, Folder, Shield, Eye, EyeOff,
  Globe, ShieldAlert, ShieldCheck, Hash, StickyNote,
  MapPin, ChevronRight, Clock,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { DynamicPreviewCanvas } from "./DialogPreviews";

// ── Types ────────────────────────────────────────────────────────────────────

type Template = "login" | "card" | "address" | "profile" | "note";

interface CustomField { id: string; key: string; value: string; }

export interface DecryptedPayload {
  _template?: Template;
  _folder?: string;
  username?: string; password?: string; url?: string; urls?: string[];
  cardName?: string; cardNumber?: string; expiry?: string; cvv?: string; pin?: string; cardBrand?: string;
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
  defaultTemplate?: Template;
}

// ── Template config (Theme Aware) ─────────────────────────────────────────────

const TEMPLATES: { id: Template; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: "login",   label: "Login",   desc: "Credentials & URLs", icon: <Lock className="w-4 h-4" /> },
  { id: "card",    label: "Card",    desc: "Payment cards",      icon: <CreditCard className="w-4 h-4" /> },
  { id: "note",    label: "Note",    desc: "Secure text",        icon: <StickyNote className="w-4 h-4" /> },
  { id: "address", label: "Address", desc: "Location info",      icon: <MapPin className="w-4 h-4" /> },
  { id: "profile", label: "Profile", desc: "Identity data",      icon: <User className="w-4 h-4" /> },
];

// ── Utilities ─────────────────────────────────────────────────────────────────

const WORDS = ["apple","river","stone","eagle","brave","quiet","swift","bright","ocean","forest","cloud","spark","flame","frost","steel","glass","brass","crown","heart","storm","tiger","wolf","moon","star","light","shadow","wind","rain","snow","ice","fire","earth","wood","gold","silver","copper","iron","lead","zinc","tin"];

function generatePassword(len: number, upper: boolean, lower: boolean, nums: boolean, syms: boolean): string {
  const pool = [upper ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "", lower ? "abcdefghijklmnopqrstuvwxyz" : "", nums ? "0123456789" : "", syms ? "!@#$%^&*-_=+" : ""].join("");
  if (!pool) return "";
  const arr = new Uint32Array(len);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(v => pool[v % pool.length]).join("");
}

function generatePassphrase(): string {
  const arr = new Uint32Array(4);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(v => WORDS[v % WORDS.length]).join("-");
}

function getPasswordStrength(pw: string): { score: number; label: string; width: string; color: string } {
  if (!pw) return { score: 0, label: "", width: "0%", color: "bg-[var(--border)]" };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 14) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: s, label: "Weak",   width: "25%",  color: "bg-red-500" };
  if (s === 2) return { score: s, label: "Fair",   width: "50%",  color: "bg-amber-400" };
  if (s === 3) return { score: s, label: "Good",   width: "75%",  color: "bg-[var(--accent)]" };
  return            { score: s, label: "Strong", width: "100%", color: "bg-emerald-500" };
}

// Minimal TOTP Generator
function base32ToBuffer(base32: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, index = 0;
  const output = new Uint8Array(Math.ceil((base32.length * 5) / 8));
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32[i].toUpperCase());
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) { output[index++] = (value >>> (bits - 8)) & 255; bits -= 8; }
  }
  return output.slice(0, index);
}

// ── Components ────────────────────────────────────────────────────────────────

function LiveTotpPreview({ secret }: { secret: string }) {
  const [code, setCode] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!secret.trim()) return setCode("");
    let mounted = true;
    const update = async () => {
      try {
        const keyBytes = base32ToBuffer(secret);
        const key = await crypto.subtle.importKey("raw", keyBytes as unknown as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
        const epoch = Math.floor(Date.now() / 30000);
        let e = epoch;
        const timeBytes = new Uint8Array(8);
        for (let i = 7; i >= 0; i--) { timeBytes[i] = e & 0xff; e >>= 8; }
        const sig = await crypto.subtle.sign("HMAC", key, timeBytes);
        const hash = new Uint8Array(sig);
        const offset = hash[19] & 0xf;
        let c = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16) | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
        c = c % 1000000;
        if (mounted) {
          setCode(c.toString().padStart(6, "0"));
          setTimeLeft(30 - (Math.floor(Date.now() / 1000) % 30));
        }
      } catch (err) {
        if (mounted) setCode("Invalid");
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => { mounted = false; clearInterval(t); };
  }, [secret]);

  if (!code) return null;
  return (
    <div className="flex items-center gap-3 px-3 py-2 mt-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)]">
      <Clock className="w-4 h-4 text-[var(--accent)]" />
      <span className="font-mono text-lg font-bold text-[var(--fg)] tracking-[0.2em]">{code.slice(0,3)} {code.slice(3)}</span>
      <div className="ml-auto flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
        <div className="relative w-4 h-4 flex items-center justify-center">
          <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" stroke="var(--border)" strokeWidth="2" fill="none" />
            <circle cx="8" cy="8" r="6" stroke="var(--accent)" strokeWidth="2" fill="none" strokeDasharray="37.7" strokeDashoffset={37.7 * (1 - timeLeft/30)} className="transition-all duration-1000 linear" />
          </svg>
          <span className="absolute text-[8px] font-bold">{timeLeft}</span>
        </div>
      </div>
    </div>
  );
}

function PasswordGenerator({ onUse }: { onUse: (pw: string) => void }) {
  const [mode, setMode] = useState<"random" | "passphrase">("random");
  const [len, setLen] = useState(16);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [nums,  setNums]  = useState(true);
  const [syms,  setSyms]  = useState(false);
  const [seed,  setSeed]  = useState(0);

  const pw = useMemo(() => mode === "random" ? generatePassword(len, upper, lower, nums, syms) : generatePassphrase(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, len, upper, lower, nums, syms, seed]);

  const strength = getPasswordStrength(pw);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-4 text-left">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-lg w-fit border border-[var(--border)]">
        <button type="button" onClick={() => setMode("random")} className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${mode === "random" ? "bg-[var(--surface-hover)] text-[var(--fg)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>Random</button>
        <button type="button" onClick={() => setMode("passphrase")} className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${mode === "passphrase" ? "bg-[var(--surface-hover)] text-[var(--fg)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>Passphrase</button>
      </div>

      <div className="relative flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2">
        <span className="flex-1 font-mono text-[11px] text-[var(--fg)] break-all select-all leading-normal">{pw || "—"}</span>
        <button onClick={() => setSeed(s => s+1)} className="w-6 h-6 flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors cursor-pointer rounded-md hover:bg-[var(--surface-hover)]" title="Regenerate">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-[var(--surface)] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
        </div>
        <span className="text-[9px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{strength.label}</span>
      </div>

      {mode === "random" && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[var(--fg-muted)] w-4 shrink-0">8</span>
            <input type="range" min={8} max={64} value={len} onChange={e => setLen(+e.target.value)} className="flex-1 h-1 accent-[var(--accent)] cursor-pointer bg-[var(--surface)] rounded-full appearance-none" />
            <span className="text-[10px] text-[var(--fg-muted)] w-6 text-right shrink-0">{len}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([["A–Z", upper, setUpper], ["a–z", lower, setLower], ["0–9", nums, setNums], ["!@#", syms, setSyms]] as [string, boolean, (v: boolean) => void][]).map(([lbl, val, set]) => (
              <label key={lbl} className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border cursor-pointer select-none transition-all ${val ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="sr-only" />
                {lbl}
              </label>
            ))}
          </div>
        </>
      )}

      <button onClick={() => onUse(pw)} className="w-full py-2 text-[11px] font-semibold text-[var(--accent)] hover:text-[var(--bg)] rounded-lg border border-[var(--accent)] hover:bg-[var(--accent)] transition-all cursor-pointer">
        Use Password
      </button>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-[var(--fg-muted)] uppercase tracking-[0.1em] mb-1.5 select-none">{children}</p>;
}

function SecretInput({ value, onChange, placeholder, className = "" }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; className?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} className={`pr-9 ${className}`} />
      <button type="button" onClick={() => setShow(v => !v)} disabled={!value} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors p-0.5 ${!value ? "text-[var(--border)] cursor-not-allowed opacity-50" : "text-[var(--fg-muted)] hover:text-[var(--fg)] cursor-pointer"}`}>
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

export function NewEntryDialog({ open, folders, onSave, onClose, initialData, defaultTemplate }: NewEntryDialogProps) {
  const [template, setTemplate] = useState<Template>(initialData?.template ?? defaultTemplate ?? "login");
  const [name,     setName]     = useState(initialData?.name ?? "");
  const [folder,   setFolder]   = useState(initialData?.folder ?? "");
  const [newFolder,setNewFolder]= useState("");
  const [tags,     setTags]     = useState(initialData?.tags?.join(", ") ?? "");
  const [saving,   setSaving]   = useState(false);
  const [nameError, setNameError] = useState(false);
  const [showGen,  setShowGen]  = useState(false);
  const [showTotp, setShowTotp] = useState(!!initialData?.payload.totpSecret);

  // Payload fields
  const [username, setUsername] = useState(initialData?.payload.username ?? "");
  const [password, setPassword] = useState(initialData?.payload.password ?? "");
  const [urls,     setUrls]     = useState<string[]>(() => {
    if (initialData?.payload.urls) return initialData.payload.urls;
    if (initialData?.payload.url) return [initialData.payload.url];
    return [""];
  });
  const [totpSecret, setTotpSecret] = useState(initialData?.payload.totpSecret ?? "");
  const [cardName,     setCardName]     = useState(initialData?.payload.cardName ?? "");
  const [cardNumber,   setCardNumber]   = useState(initialData?.payload.cardNumber ?? "");
  const [cardBrand,    setCardBrand]    = useState(initialData?.payload.cardBrand ?? "");
  const [isManualBrand,setIsManualBrand]= useState(!!initialData?.payload.cardBrand);
  const [expiryMonth,  setExpiryMonth]  = useState(() => {
    const parts = initialData?.payload.expiry?.split("/") ?? [];
    return parts[0]?.trim() ?? "";
  });
  const [expiryYear,   setExpiryYear]   = useState(() => {
    const parts = initialData?.payload.expiry?.split("/") ?? [];
    return parts[1]?.trim() ?? "";
  });
  const [cvv,          setCvv]          = useState(initialData?.payload.cvv ?? "");
  const [pin,          setPin]          = useState(initialData?.payload.pin ?? "");
  const [line1,        setLine1]        = useState(initialData?.payload.line1 ?? "");
  const [line2,        setLine2]        = useState(initialData?.payload.line2 ?? "");
  const [city,         setCity]         = useState(initialData?.payload.city ?? "");
  const [stateVal,     setStateVal]     = useState(initialData?.payload.state ?? "");
  const [zip,          setZip]          = useState(initialData?.payload.zip ?? "");
  const [country,      setCountry]      = useState(initialData?.payload.country ?? "");
  const [fullName,     setFullName]     = useState(initialData?.payload.fullName ?? "");
  const [dob,          setDob]          = useState(initialData?.payload.dob ?? "");
  const [idNumber,     setIdNumber]     = useState(initialData?.payload.idNumber ?? "");
  const [profEmail,    setProfEmail]    = useState(initialData?.payload.email ?? "");
  const [phone,        setPhone]        = useState(initialData?.payload.phone ?? "");
  const [note,         setNote]         = useState(initialData?.payload.note ?? "");
  const [entryNotes,   setEntryNotes]   = useState(initialData?.payload.entryNotes ?? "");
  const [fallbackIndex,setFallbackIndex]= useState<number | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>(() => initialData?.payload.customFields?.map(f => ({ id: crypto.randomUUID(), key: f.key, value: f.value })) ?? []);
  const addCustomField = () => setCustomFields(p => [...p, { id: crypto.randomUUID(), key: "", value: "" }]);

  const { config } = useSiteConfig();

  // Auto-detect brand from card number BINs
  useEffect(() => {
    if (isManualBrand || !cardNumber) return;
    const bins = config?.cardBins || [];
    if (bins.length > 0) {
      let found = false;
      const sorted = [...bins].sort((a, b) => b.prefix.length - a.prefix.length);
      for (const bin of sorted) {
        if (cardNumber.startsWith(bin.prefix.trim())) {
          setCardBrand(bin.brand);
          found = true;
          break;
        }
      }
      if (!found) {
        setCardBrand("Other");
        setFallbackIndex(prev => prev === null ? Math.floor(Math.random() * 1000) : prev);
      }
    } else {
      setCardBrand("Other");
      setFallbackIndex(prev => prev === null ? Math.floor(Math.random() * 1000) : prev);
    }
  }, [cardNumber, config, isManualBrand]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "g" && template === "login") { e.preventDefault(); setShowGen(v => !v); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose, template]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const activeFolder = folder === "__new__" ? newFolder.trim() : folder;
  const strength     = getPasswordStrength(password);
  const currentTpl   = TEMPLATES.find(t => t.id === template)!;

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setNameError(true);
      setTimeout(() => setNameError(false), 400);
      return;
    }
    setSaving(true);
    const payload: DecryptedPayload = {
      _template: template, _folder: activeFolder || undefined,
      customFields: customFields.filter(f => f.key.trim() || f.value.trim()).map(f => ({ key: f.key, value: f.value })),
      entryNotes: entryNotes.trim() || undefined,
    };
    if (template === "login")   { const v = urls.map(u => u.trim()).filter(Boolean); Object.assign(payload, { username, password, url: v[0] ?? "", urls: v, totpSecret: totpSecret.trim() }); }
    if (template === "card")    Object.assign(payload, { cardName, cardNumber, cardBrand, expiry: (expiryMonth || expiryYear) ? `${expiryMonth.padStart(2, '0')} / ${expiryYear}` : "", cvv, pin });
    if (template === "address") Object.assign(payload, { line1, line2, city, state: stateVal, zip, country });
    if (template === "profile") Object.assign(payload, { fullName, dob, idNumber, email: profEmail, phone });
    if (template === "note")    Object.assign(payload, { note });
    const parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);
    if (initialData?.payload.password && initialData.payload.password !== password) { payload.passwordHistory = [...(initialData.payload.passwordHistory ?? []), initialData.payload.password].slice(-5); }
    else if (initialData?.payload.passwordHistory) { payload.passwordHistory = initialData.payload.passwordHistory; }
    await onSave(name.trim(), template, activeFolder, parsedTags, payload, initialData?.id);
    setSaving(false);
  }, [name, template, activeFolder, customFields, entryNotes, urls, username, password, totpSecret, cardName, cardNumber, expiryMonth, expiryYear, cvv, pin, line1, line2, city, stateVal, zip, country, fullName, dob, idNumber, profEmail, phone, note, tags, initialData, onSave]);


  useEffect(() => {
    if (!open) return;
    setTemplate(initialData?.template ?? defaultTemplate ?? "login");
    setName(initialData?.name ?? "");
    setFolder(initialData?.folder ?? "");
    setNewFolder("");
    setTags(initialData?.tags?.join(", ") ?? "");
    setUsername(initialData?.payload.username ?? "");
    setPassword(initialData?.payload.password ?? "");
    setUrls(initialData?.payload.urls ?? (initialData?.payload.url ? [initialData.payload.url] : [""]));
    setTotpSecret(initialData?.payload.totpSecret ?? "");
    setCardName(initialData?.payload.cardName ?? "");
    setCardNumber(initialData?.payload.cardNumber ?? "");
    setCardBrand(initialData?.payload.cardBrand ?? "");
    setIsManualBrand(!!initialData?.payload.cardBrand);
    setExpiryMonth(() => {
      const parts = initialData?.payload.expiry?.split("/") ?? [];
      return parts[0]?.trim() ?? "";
    });
    setExpiryYear(() => {
      const parts = initialData?.payload.expiry?.split("/") ?? [];
      return parts[1]?.trim() ?? "";
    });
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
    setShowTotp(!!initialData?.payload.totpSecret);
  }, [open, initialData]);

  const displayCardNumber = useMemo(() => {
    let val = cardNumber;
    if (/^3[47]/.test(val)) {
      val = val.slice(0, 15);
      const parts = [];
      if (val.length > 0) parts.push(val.slice(0, 4));
      if (val.length > 4) parts.push(val.slice(4, 10));
      if (val.length > 10) parts.push(val.slice(10, 15));
      return parts.join(" ");
    } else {
      const parts = [];
      for (let i = 0; i < val.length; i += 4) parts.push(val.slice(i, i + 4));
      return parts.join(" ");
    }
  }, [cardNumber]);

  const displayExpiry = (expiryMonth || expiryYear) ? `${expiryMonth.padStart(2, '0')} / ${expiryYear}` : "";

  const fallbackBrand = (() => {
    const configuredEggs = config?.cardEasterEggs || [];
    const eggs = configuredEggs.length > 0 ? configuredEggs : ["NOPE", "BRUH", "OOPS", "VOID", "LMAO", "FAKECARD"];
    return eggs.length > 0 && fallbackIndex !== null ? eggs[fallbackIndex % eggs.length] : undefined;
  })();

  const activeLayout = config?.vaultDialogLayout || "split";

  const renderForm = () => {
    if (template === "login") {
      return (
        <div className="space-y-5 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Username / Email</FieldLabel>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel>Password</FieldLabel>
                <button type="button" onClick={() => setShowGen(v => !v)} className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md transition-all cursor-pointer ${showGen ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30" : "text-[var(--fg-muted)] hover:text-[var(--fg)] border border-transparent"}`}>
                  <Wand2 className="w-3 h-3" /> Generate <span className="opacity-50 ml-1 text-[8px]">⌘G</span>
                </button>
              </div>
              <SecretInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="font-mono" />
              {password && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-0.5 bg-[var(--surface)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                  </div>
                  <span className={`text-[10px] font-medium shrink-0 ${strength.color.replace("bg-", "text-")}`}>{strength.label}</span>
                </div>
              )}
            </div>
          </div>

          {showGen && <PasswordGenerator onUse={pw => { setPassword(pw); setShowGen(false); }} />}
          {password.length >= 8 && <BreachIndicator password={password} />}

          <div>
            <FieldLabel>URLs</FieldLabel>
            <div className="space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="w-6 h-6 flex items-center justify-center shrink-0"><Globe className="w-3.5 h-3.5 text-[var(--fg-muted)]" /></div>
                  <Input value={u} onChange={e => setUrls(p => p.map((x, idx) => idx === i ? e.target.value : x))} placeholder="https://…" />
                  {i === urls.length - 1 ? (
                    <button type="button" onClick={() => setUrls(p => [...p, ""])} className="shrink-0 w-7 h-8 flex items-center justify-center border rounded-lg border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-hover)] transition-colors cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
                  ) : (
                    <button type="button" onClick={() => setUrls(p => p.filter((_, idx) => idx !== i))} className="shrink-0 w-7 h-8 flex items-center justify-center border rounded-lg border-[var(--border)] text-[var(--fg-muted)] hover:text-red-400 hover:border-red-900/40 transition-colors cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            {!showTotp ? (
              <button type="button" onClick={() => setShowTotp(true)} className="flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors cursor-pointer py-1">
                <Plus className="w-3 h-3" /> Add 2FA / TOTP secret
              </button>
            ) : (
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center justify-between mb-3">
                  <FieldLabel>Authenticator / TOTP Secret</FieldLabel>
                  <button type="button" onClick={() => { setShowTotp(false); setTotpSecret(""); }} className="text-[10px] text-[var(--fg-muted)] hover:text-red-400 transition-colors cursor-pointer">Remove</button>
                </div>
                <SecretInput value={totpSecret} onChange={e => setTotpSecret(e.target.value)} placeholder="Paste Base32 setup key…" className="font-mono" />
                <LiveTotpPreview secret={totpSecret} />
              </div>
            )}
          </div>

          {/* Private Notes & Custom Fields in Split View */}
          <div className="pt-4 border-t border-[var(--border)] space-y-4">
            <div>
              <FieldLabel>Private Notes</FieldLabel>
              <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="Optional private notes…" rows={2} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <FieldLabel>Custom Fields</FieldLabel>
                <button type="button" onClick={addCustomField} className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] hover:underline cursor-pointer">
                  <Plus className="w-3 h-3" /> Add field
                </button>
              </div>
              {customFields.length > 0 && (
                <div className="space-y-2">
                  {customFields.map(f => (
                    <div key={f.id} className="flex gap-2 items-center">
                      <Input value={f.key} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, key: e.target.value } : x))} placeholder="Label" style={{ width: "30%", minWidth: "90px" }} className="shrink-0" />
                      <Input value={f.value} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder="Value" type="password" className="flex-1 min-w-0" />
                      <button type="button" onClick={() => setCustomFields(p => p.filter(x => x.id !== f.id))} className="shrink-0 w-7 h-8 flex items-center justify-center text-[var(--fg-muted)] hover:text-red-400 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (template === "card") {
      const binBrands = Array.from(new Set((config?.cardBins || []).map((b: any) => b.brand)));
      const allBrands = new Set(["Visa", "Mastercard", "AMEX", "Discover", "RuPay"]);
      binBrands.forEach((b: any) => allBrands.add(b as string));
      const networkOptions = [{ value: "", label: "Auto-detect" }, ...Array.from(allBrands).map(b => ({ value: b, label: b })), { value: "Other", label: "Other" }];

      return (
        <div className="space-y-5 text-left">
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2"><FieldLabel>Cardholder Name</FieldLabel><Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Name on card" /></div>
            <div className="col-span-1">
              <FieldLabel>Network</FieldLabel>
              <Select
                value={cardBrand}
                onChange={(v) => {
                  setCardBrand(v);
                  setIsManualBrand(!!v);
                  if (v === "Other" && fallbackIndex === null) {
                    setFallbackIndex(Math.floor(Math.random() * 1000));
                  }
                }}
                options={networkOptions}
                placeholder="Network"
              />
            </div>
            <div className="col-span-2">
              <FieldLabel>Card Number</FieldLabel>
              <Input 
                value={displayCardNumber} 
                onChange={e => setCardNumber(e.target.value.replace(/\D/g, ""))} 
                onCopy={e => { e.clipboardData.setData('text/plain', cardNumber); e.preventDefault(); }}
                placeholder="•••• •••• •••• ••••" className="font-mono" 
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div><FieldLabel>Exp Month</FieldLabel><Input value={expiryMonth} onChange={e => setExpiryMonth(e.target.value.replace(/\D/g, "").slice(0,2))} placeholder="MM" /></div>
            <div><FieldLabel>Exp Year</FieldLabel><Input value={expiryYear} onChange={e => setExpiryYear(e.target.value.replace(/\D/g, "").slice(0,4))} placeholder="YYYY" /></div>
            <div><FieldLabel>CVV</FieldLabel><SecretInput value={cvv} onChange={e => setCvv(e.target.value)} placeholder="•••" /></div>
            <div><FieldLabel>PIN</FieldLabel><SecretInput value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" /></div>
          </div>

          <div className="pt-4 border-t border-[var(--border)] space-y-4">
            <div>
              <FieldLabel>Private Notes</FieldLabel>
              <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="Optional private notes…" rows={2} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <FieldLabel>Custom Fields</FieldLabel>
                <button type="button" onClick={addCustomField} className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] hover:underline cursor-pointer">
                  <Plus className="w-3 h-3" /> Add field
                </button>
              </div>
              {customFields.length > 0 && (
                <div className="space-y-2">
                  {customFields.map(f => (
                    <div key={f.id} className="flex gap-2 items-center">
                      <Input value={f.key} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, key: e.target.value } : x))} placeholder="Label" style={{ width: "30%", minWidth: "90px" }} className="shrink-0" />
                      <Input value={f.value} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder="Value" type="password" className="flex-1 min-w-0" />
                      <button type="button" onClick={() => setCustomFields(p => p.filter(x => x.id !== f.id))} className="shrink-0 w-7 h-8 flex items-center justify-center text-[var(--fg-muted)] hover:text-red-400 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (template === "address") {
      return (
        <div className="space-y-5 text-left">
          <div><FieldLabel>Street Address</FieldLabel><Input value={line1} onChange={e => setLine1(e.target.value)} placeholder="Line 1" /></div>
          <div><FieldLabel>Apt / Suite / Unit</FieldLabel><Input value={line2} onChange={e => setLine2(e.target.value)} placeholder="Line 2" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>City</FieldLabel><Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" /></div>
            <div><FieldLabel>State / Province</FieldLabel><Input value={stateVal} onChange={e => setStateVal(e.target.value)} placeholder="State" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>ZIP / Postal Code</FieldLabel><Input value={zip} onChange={e => setZip(e.target.value)} placeholder="ZIP" /></div>
            <div><FieldLabel>Country</FieldLabel><Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" /></div>
          </div>

          <div className="pt-4 border-t border-[var(--border)] space-y-4">
            <div>
              <FieldLabel>Private Notes</FieldLabel>
              <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="Optional private notes…" rows={2} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <FieldLabel>Custom Fields</FieldLabel>
                <button type="button" onClick={addCustomField} className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] hover:underline cursor-pointer">
                  <Plus className="w-3 h-3" /> Add field
                </button>
              </div>
              {customFields.length > 0 && (
                <div className="space-y-2">
                  {customFields.map(f => (
                    <div key={f.id} className="flex gap-2 items-center">
                      <Input value={f.key} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, key: e.target.value } : x))} placeholder="Label" style={{ width: "30%", minWidth: "90px" }} className="shrink-0" />
                      <Input value={f.value} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder="Value" type="password" className="flex-1 min-w-0" />
                      <button type="button" onClick={() => setCustomFields(p => p.filter(x => x.id !== f.id))} className="shrink-0 w-7 h-8 flex items-center justify-center text-[var(--fg-muted)] hover:text-red-400 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (template === "profile") {
      return (
        <div className="space-y-5 text-left">
          <div><FieldLabel>Full Name</FieldLabel><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Legal name" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>Email</FieldLabel><Input value={profEmail} onChange={e => setProfEmail(e.target.value)} placeholder="email@example.com" type="email" /></div>
            <div><FieldLabel>Phone Number</FieldLabel><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555-0000" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>Date of Birth</FieldLabel><Input value={dob} onChange={e => setDob(e.target.value)} placeholder="YYYY-MM-DD" /></div>
            <div><FieldLabel>ID / Passport Number</FieldLabel><SecretInput value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="ID no." /></div>
          </div>

          <div className="pt-4 border-t border-[var(--border)] space-y-4">
            <div>
              <FieldLabel>Private Notes</FieldLabel>
              <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="Optional private notes…" rows={2} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <FieldLabel>Custom Fields</FieldLabel>
                <button type="button" onClick={addCustomField} className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] hover:underline cursor-pointer">
                  <Plus className="w-3 h-3" /> Add field
                </button>
              </div>
              {customFields.length > 0 && (
                <div className="space-y-2">
                  {customFields.map(f => (
                    <div key={f.id} className="flex gap-2 items-center">
                      <Input value={f.key} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, key: e.target.value } : x))} placeholder="Label" style={{ width: "30%", minWidth: "90px" }} className="shrink-0" />
                      <Input value={f.value} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder="Value" type="password" className="flex-1 min-w-0" />
                      <button type="button" onClick={() => setCustomFields(p => p.filter(x => x.id !== f.id))} className="shrink-0 w-7 h-8 flex items-center justify-center text-[var(--fg-muted)] hover:text-red-400 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (template === "note") {
      return (
        <div className="space-y-5 text-left">
          <div>
            <div className="flex items-center justify-between mb-1.5"><FieldLabel>Secure Note</FieldLabel><span className="text-[10px] text-[var(--fg-muted)] tabular-nums">{note.length} chars</span></div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Secure note…" rows={12} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none font-mono" />
          </div>
        </div>
      );
    }

    return null;
  };

  const renderBentoFields = () => {
    if (template === "login") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div>
            <FieldLabel>Username / Email</FieldLabel>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="user@example.com" />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <SecretInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="font-mono" />
          </div>
          <div className="col-span-1 md:col-span-2">
            <FieldLabel>Primary URL</FieldLabel>
            <div className="flex gap-2 items-center">
              <div className="w-6 h-6 flex items-center justify-center shrink-0"><Globe className="w-3.5 h-3.5 text-[var(--fg-muted)]" /></div>
              <Input value={urls[0] || ""} onChange={e => setUrls(p => [e.target.value, ...p.slice(1)])} placeholder="https://domain.com" />
            </div>
          </div>
          {showTotp || totpSecret ? (
            <div className="col-span-1 md:col-span-2 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
              <div className="flex items-center justify-between mb-2">
                <FieldLabel>TOTP Setup Key</FieldLabel>
                <button type="button" onClick={() => { setShowTotp(false); setTotpSecret(""); }} className="text-[10px] text-red-400">Remove</button>
              </div>
              <SecretInput value={totpSecret} onChange={e => setTotpSecret(e.target.value)} placeholder="Base32 Key" className="font-mono" />
              <LiveTotpPreview secret={totpSecret} />
            </div>
          ) : (
            <div className="col-span-1 md:col-span-2">
              <button type="button" onClick={() => setShowTotp(true)} className="text-[10px] text-[var(--accent)] hover:underline cursor-pointer">
                + Add 2FA Authenticator Key
              </button>
            </div>
          )}
        </div>
      );
    }

    if (template === "card") {
      const binBrands = Array.from(new Set((config?.cardBins || []).map((b: any) => b.brand)));
      const allBrands = new Set(["Visa", "Mastercard", "AMEX", "Discover", "RuPay"]);
      binBrands.forEach((b: any) => allBrands.add(b as string));
      const networkOptions = [{ value: "", label: "Auto-detect" }, ...Array.from(allBrands).map(b => ({ value: b, label: b })), { value: "Other", label: "Other" }];

      return (
        <div className="space-y-4 text-left">
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2"><FieldLabel>Cardholder Name</FieldLabel><Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Name on card" /></div>
            <div className="col-span-1">
              <FieldLabel>Network</FieldLabel>
              <Select
                value={cardBrand}
                onChange={(v) => {
                  setCardBrand(v);
                  setIsManualBrand(!!v);
                  if (v === "Other" && fallbackIndex === null) {
                    setFallbackIndex(Math.floor(Math.random() * 1000));
                  }
                }}
                options={networkOptions}
                placeholder="Network"
              />
            </div>
            <div className="col-span-2">
              <FieldLabel>Card Number</FieldLabel>
              <Input 
                value={displayCardNumber} 
                onChange={e => setCardNumber(e.target.value.replace(/\D/g, ""))} 
                onCopy={e => { e.clipboardData.setData('text/plain', cardNumber); e.preventDefault(); }}
                placeholder="•••• •••• •••• ••••" className="font-mono" 
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div><FieldLabel>Exp Month</FieldLabel><Input value={expiryMonth} onChange={e => setExpiryMonth(e.target.value.replace(/\D/g, "").slice(0,2))} placeholder="MM" /></div>
            <div><FieldLabel>Exp Year</FieldLabel><Input value={expiryYear} onChange={e => setExpiryYear(e.target.value.replace(/\D/g, "").slice(0,4))} placeholder="YYYY" /></div>
            <div><FieldLabel>CVV</FieldLabel><SecretInput value={cvv} onChange={e => setCvv(e.target.value)} placeholder="•••" /></div>
            <div><FieldLabel>PIN</FieldLabel><SecretInput value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" /></div>
          </div>
        </div>
      );
    }

    if (template === "address") {
      return (
        <div className="space-y-4 text-left">
          <div><FieldLabel>Street Address</FieldLabel><Input value={line1} onChange={e => setLine1(e.target.value)} placeholder="Line 1" /></div>
          <div><FieldLabel>Apt / Suite / Unit</FieldLabel><Input value={line2} onChange={e => setLine2(e.target.value)} placeholder="Line 2" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>City</FieldLabel><Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" /></div>
            <div><FieldLabel>State / Province</FieldLabel><Input value={stateVal} onChange={e => setStateVal(e.target.value)} placeholder="State" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>ZIP / Postal Code</FieldLabel><Input value={zip} onChange={e => setZip(e.target.value)} placeholder="ZIP" /></div>
            <div><FieldLabel>Country</FieldLabel><Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" /></div>
          </div>
        </div>
      );
    }

    if (template === "profile") {
      return (
        <div className="space-y-4 text-left">
          <div><FieldLabel>Full Name</FieldLabel><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Legal name" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>Email</FieldLabel><Input value={profEmail} onChange={e => setProfEmail(e.target.value)} placeholder="email@example.com" type="email" /></div>
            <div><FieldLabel>Phone Number</FieldLabel><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555-0000" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>Date of Birth</FieldLabel><Input value={dob} onChange={e => setDob(e.target.value)} placeholder="YYYY-MM-DD" /></div>
            <div><FieldLabel>ID / Passport Number</FieldLabel><SecretInput value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="ID no." /></div>
          </div>
        </div>
      );
    }

    if (template === "note") {
      return (
        <div className="text-left">
          <div className="flex items-center justify-between mb-1.5"><FieldLabel>Secure Note</FieldLabel><span className="text-[10px] text-[var(--fg-muted)] tabular-nums">{note.length} chars</span></div>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Secure note contents…" rows={8} className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[12px] text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none font-mono" />
        </div>
      );
    }

    return null;
  };

  const TemplateTabs = () => (
    <div className="flex items-center gap-1.5 p-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl w-fit">
      {TEMPLATES.map(t => {
        const active = template === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplate(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
              active
                ? "bg-[var(--surface-hover)] text-[var(--accent)] border border-[var(--border)] shadow-sm font-bold"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)] border border-transparent"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-[var(--bg)]/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Layout A: Classic Split Dynamic Preview */}
      {activeLayout === "split" && (
        <div className="relative z-10 w-full max-w-5xl h-full md:h-auto max-h-full md:max-h-[92vh] flex flex-col md:flex-row rounded-none md:rounded-2xl overflow-hidden border-0 md:border border-[var(--border)] shadow-2xl bg-[var(--bg)]"
          style={{ animation: "dialogIn 280ms cubic-bezier(0.16,1,0.3,1) forwards" }}>
          
          {/* Left Panel: Preview Canvas & Metadata */}
          <div className="w-full md:w-[420px] shrink-0 flex flex-col bg-[var(--surface)] border-r border-[var(--border)] overflow-y-auto">
            <div className="p-5 flex-1 space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[var(--accent)]" />
                  <span className="text-[11px] font-bold text-[var(--fg)] uppercase tracking-wider">
                    {initialData ? "Edit Entry" : "New Entry"}
                  </span>
                </div>
                <div className="text-[9px] text-[var(--fg-muted)] uppercase tracking-widest">
                  Preview
                </div>
              </div>

              {/* Live Preview Display */}
              <div className="flex justify-center py-2">
                <DynamicPreviewCanvas
                  template={template}
                  name={name}
                  username={username}
                  url={urls[0]}
                  line1={line1}
                  line2={line2}
                  city={city}
                  state={stateVal}
                  zip={zip}
                  country={country}
                  fullName={fullName}
                  email={profEmail}
                  phone={phone}
                  note={note}
                  cardName={cardName}
                  cardNumber={cardNumber}
                  expiry={displayExpiry}
                  cardBrand={cardBrand}
                  fallbackBrand={fallbackBrand}
                />
              </div>

              {/* General Meta Inputs */}
              <div className="space-y-4 pt-4 border-t border-[var(--border)] text-left">
                <div>
                  <FieldLabel>Item Name</FieldLabel>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Personal Account" autoFocus={!initialData} className={`w-full bg-[var(--bg)] border rounded-lg px-3 py-2 text-[12px] text-[var(--fg)] placeholder-[var(--fg-muted)] outline-none transition-colors ${nameError ? "border-red-500 focus:border-red-500 animate-shake" : "border-[var(--border)] focus:border-[var(--accent)]"}`} />
                </div>
                <div>
                  <FieldLabel>Folder</FieldLabel>
                  <Select value={folder} onChange={setFolder} options={[{ value: "", label: "No folder" }, ...folders.map(f => ({ value: f, label: f, icon: <Folder className="w-3 h-3" /> })), { value: "__new__", label: "+ New folder…", divider: folders.length > 0 }]} placeholder="No folder" />
                  {folder === "__new__" && <input value={newFolder} onChange={e => setNewFolder(e.target.value)} placeholder="Folder name" autoFocus className="mt-2 w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[12px] text-[var(--fg)] outline-none focus:border-[var(--accent)] transition-colors" />}
                </div>
                <div>
                  <FieldLabel>Tags</FieldLabel>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--fg-muted)] pointer-events-none" />
                    <input value={tags} onChange={e => setTags(e.target.value)} placeholder="work, personal…" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg pl-7 pr-3 py-2 text-[12px] text-[var(--fg)] outline-none focus:border-[var(--accent)] transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[var(--border)] flex justify-between items-center bg-[var(--bg)]/40 text-[10px] text-[var(--fg-muted)]">
              <div className="flex items-center gap-1.5 font-mono">
                <Shield className="w-3 h-3 text-[var(--accent)]" />
                <span>Zero-Knowledge Encryption</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Content Forms */}
          <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
              <TemplateTabs />
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {renderForm()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
              <div className="text-[10px] text-[var(--fg-muted)] font-mono">
                <span className="opacity-50 mr-2">⌘S</span> to save
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={onClose} variant="ghost" disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} variant="primary" disabled={saving}>{saving ? "Saving…" : initialData ? "Save Changes" : "Encrypt & Save"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Layout B: Bento Grid Dashboard */}
      {activeLayout === "bento" && (
        <div className="relative z-10 w-full max-w-6xl h-full md:h-auto max-h-full md:max-h-[92vh] flex flex-col rounded-none md:rounded-2xl border-0 md:border border-[var(--border)] shadow-2xl bg-[var(--bg)] overflow-hidden"
          style={{ animation: "dialogIn 280ms cubic-bezier(0.16,1,0.3,1) forwards" }}>
          
          {/* Bento Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)]">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--fg)]">{name || `New ${currentTpl.label}`}</h2>
                <p className="text-[9px] text-[var(--fg-muted)] tracking-wider uppercase font-bold">Bento Control Panel</p>
              </div>
            </div>
            <TemplateTabs />
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Bento Grid Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            
            {/* Upper Grid - Previews and Core Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card 1: Live Interactive Preview */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col justify-between shadow-sm relative min-h-[220px] overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Live Preview</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                </div>
                <div className="flex-1 flex items-center justify-center py-4">
                  <DynamicPreviewCanvas
                    template={template}
                    name={name}
                    username={username}
                    url={urls[0]}
                    line1={line1}
                    line2={line2}
                    city={city}
                    state={stateVal}
                    zip={zip}
                    country={country}
                    fullName={fullName}
                    email={profEmail}
                    phone={phone}
                    note={note}
                    cardName={cardName}
                    cardNumber={cardNumber}
                    expiry={displayExpiry}
                    cardBrand={cardBrand}
                    fallbackBrand={fallbackBrand}
                  />
                </div>
              </div>

              {/* Card 2: Core Form Fields */}
              <div className="col-span-1 md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-4 relative overflow-hidden">
                <img src="/illustrations/add-file_lf11.svg" className="absolute right-4 top-4 w-20 h-20 opacity-5 pointer-events-none select-none" alt="" />
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] relative z-10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Core Credentials</span>
                  <span className="text-[9px] text-[var(--fg-muted)] uppercase">{currentTpl.label} Type</span>
                </div>
                <div className="space-y-4">
                  <div className="text-left">
                    <FieldLabel>Item Name</FieldLabel>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Personal Account" autoFocus={!initialData} className={`w-full bg-[var(--bg)] border rounded-lg px-3 py-2 text-[12px] text-[var(--fg)] placeholder-[var(--fg-muted)] outline-none transition-colors ${nameError ? "border-red-500 focus:border-red-500 animate-shake" : "border-[var(--border)] focus:border-[var(--accent)]"}`} />
                  </div>
                  {renderBentoFields()}
                </div>
              </div>

            </div>

            {/* Lower Grid - Tools, Notes, and Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card 3: Contextual Tools (Password Gen / Identity Info) */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-4 h-fit relative overflow-hidden">
                {template === "login" ? (
                  <>
                    <img src="/illustrations/secure-password_9qv4.svg" className="absolute right-4 bottom-4 w-24 h-24 opacity-5 pointer-events-none select-none" alt="" />
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] relative z-10">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Password Generator</span>
                      <Wand2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                    </div>
                    <div className="relative z-10">
                      <PasswordGenerator onUse={pw => setPassword(pw)} />
                    </div>
                  </>
                ) : (
                  <>
                    <img src="/illustrations/security-on_3ykb.svg" className="absolute right-4 bottom-4 w-24 h-24 opacity-5 pointer-events-none select-none" alt="" />
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] relative z-10">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Security Audit</span>
                      <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />
                    </div>
                    <div className="space-y-3.5 text-xs text-[var(--fg-muted)] leading-relaxed py-2 text-left">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)]">
                        <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Zero-knowledge encryption active.</span>
                      </div>
                      <p className="text-[11px]">
                        All sensitive fields are encrypted inside your browser using AES-GCM-256 before transit.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Card 4: Extended Notes & Custom Fields */}
              <div className="col-span-1 md:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm space-y-4 text-left relative overflow-hidden">
                <img src="/illustrations/control-panel_s0j2.svg" className="absolute right-4 top-4 w-24 h-24 opacity-5 pointer-events-none select-none" alt="" />
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] relative z-10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">Extended Options</span>
                  <span className="text-[9px] text-[var(--fg-muted)] font-mono">Payload Parameters</span>
                </div>
                
                <div className="space-y-4">
                  {template !== "note" && (
                    <div>
                      <FieldLabel>Private Notes</FieldLabel>
                      <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="Optional private notes…" rows={2} className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[12px] text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none" />
                    </div>
                  )}

                  {/* Custom Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <FieldLabel>Custom Fields</FieldLabel>
                      <button onClick={addCustomField} className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] hover:underline cursor-pointer">
                        <Plus className="w-3 h-3" /> Add field
                      </button>
                    </div>
                    
                    {customFields.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {customFields.map(f => (
                          <div key={f.id} className="flex gap-2 items-center">
                            <Input value={f.key} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, key: e.target.value } : x))} placeholder="Label" style={{ width: "30%", minWidth: "90px" }} className="shrink-0" />
                            <Input value={f.value} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder="Value" type="password" className="flex-1 min-w-0" />
                            <button onClick={() => setCustomFields(p => p.filter(x => x.id !== f.id))} className="shrink-0 w-7 h-8 flex items-center justify-center text-[var(--fg-muted)] hover:text-red-400 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-center rounded-lg border border-dashed border-[var(--border)] text-[11px] text-[var(--fg-muted)]">
                        No custom fields configured.
                      </div>
                    )}
                  </div>

                  {/* Metadata (Folder / Tags) */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
                    <div>
                      <FieldLabel>Folder Location</FieldLabel>
                      <Select value={folder} onChange={setFolder} options={[{ value: "", label: "No folder" }, ...folders.map(f => ({ value: f, label: f, icon: <Folder className="w-3 h-3" /> })), { value: "__new__", label: "+ New folder…", divider: folders.length > 0 }]} placeholder="No folder" />
                      {folder === "__new__" && <input value={newFolder} onChange={e => setNewFolder(e.target.value)} placeholder="Folder name" autoFocus className="mt-2 w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[12px] text-[var(--fg)] outline-none focus:border-[var(--accent)] transition-colors" />}
                    </div>
                    <div>
                      <FieldLabel>Classification Tags</FieldLabel>
                      <div className="relative">
                        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--fg-muted)] pointer-events-none" />
                        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="work, personal…" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg pl-7 pr-3 py-2 text-[12px] text-[var(--fg)] outline-none focus:border-[var(--accent)] transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Bento Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
            <div className="text-[10px] text-[var(--fg-muted)] font-mono">
              <span className="opacity-50 mr-2">⌘S</span> to save
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onClose} variant="ghost" disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} variant="primary" disabled={saving}>{saving ? "Saving…" : initialData ? "Save Changes" : "Encrypt & Save"}</Button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes dialogIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } } @keyframes shake { 0%, 100% { transform: translateX(0); } 15%, 50%, 85% { transform: translateX(-4px); } 30%, 65% { transform: translateX(4px); } } .animate-shake { animation: shake 0.35s ease-in-out; } .overflow-y-auto { -webkit-overflow-scrolling: touch; }`}</style>
    </div>,
    document.body
  );
}

// ── Breach indicator ─────────────────────────────────────────────────────────
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

  if (state === "loading") return <div className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)] py-1"><div className="w-3 h-3 border border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin shrink-0" />Checking breach database…</div>;
  if (state === "breached") return <div className="flex items-center gap-2 text-[11px] px-3 py-2.5 rounded-lg bg-red-950/30 text-red-400 border border-red-900/40"><ShieldAlert className="w-4 h-4 shrink-0" />Found in <strong>{count.toLocaleString()}</strong> data breaches — change immediately</div>;
  if (state === "safe") return <div className="flex items-center gap-2 text-[11px] px-3 py-2.5 rounded-lg bg-emerald-950/20 text-emerald-400 border border-emerald-900/40"><ShieldCheck className="w-4 h-4 shrink-0" />Not found in any known breach databases</div>;
  return null;
}

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

function DetailedCardVisual({ cardNumber, cardName, expiry, entryName }: { cardNumber: string; cardName: string; expiry: string; entryName: string; }) {
  const isVisa = cardNumber.startsWith("4");
  const isMC = /^5[1-5]/.test(cardNumber);
  const isAmex = /^3[47]/.test(cardNumber);
  const num = cardNumber.replace(/\D/g, "");

  let bgClass = "from-[#4b6cb7] to-[#182848]";
  let graphics = null;
  let bankLogo = null;
  
  const n = (entryName || "").toLowerCase();
  
  if (n.includes("chase")) {
    bgClass = "from-[#117aca] to-[#005eb8]";
    bankLogo = <span className="text-[4cqw] font-bold text-white tracking-wide">CHASE</span>;
    graphics = (
      <svg className="absolute inset-0 w-full h-full object-cover opacity-30" viewBox="0 0 320 200" preserveAspectRatio="none">
         <path d="M0 200 L320 0 L320 200 Z" fill="rgba(255,255,255,0.1)"/>
      </svg>
    );
  } else if (n.includes("apple")) {
    bgClass = "from-[#f5f5f7] to-[#e5e5ea]";
    bankLogo = <span className="text-[5cqw] font-bold text-black tracking-tighter"> Card</span>;
    graphics = null;
  } else if (n.includes("citi")) {
    bgClass = "from-[#003b70] to-[#002d54]";
    bankLogo = <span className="text-[5cqw] font-bold text-white tracking-tighter">citi</span>;
    graphics = (
      <svg className="absolute inset-0 w-full h-full object-cover opacity-20" viewBox="0 0 320 200" preserveAspectRatio="none">
        <path d="M100 0 Q 160 100 220 0" fill="none" stroke="red" strokeWidth="20" />
      </svg>
    );
  } else if (n.includes("capital one")) {
    bgClass = "from-[#002a4e] to-[#001d36]";
    bankLogo = <span className="text-[4cqw] font-bold text-white">Capital One</span>;
  } else if (n.includes("discover")) {
    bgClass = "from-[#f58220] to-[#d45d00]";
    bankLogo = <span className="text-[4cqw] font-bold text-white tracking-wider">DISCOVER</span>;
  } else {
    if (isVisa) {
      bgClass = "from-[#8E2DE2] to-[#4A00E0]"; 
      graphics = (
        <svg className="absolute inset-0 w-full h-full object-cover opacity-60" viewBox="0 0 320 200" preserveAspectRatio="none">
          <path d="M0 160 C 80 120, 160 200, 320 100 L 320 200 L 0 200 Z" fill="rgba(255,255,255,0.05)" />
          <path d="M0 120 C 120 180, 200 80, 320 140 L 320 200 L 0 200 Z" fill="rgba(255,255,255,0.05)" />
        </svg>
      );
    } else if (isMC) {
      bgClass = "from-[#f12711] to-[#f5af19]";
      graphics = (
        <svg className="absolute inset-0 w-full h-full object-cover" viewBox="0 0 320 200" preserveAspectRatio="none">
          <circle cx="320" cy="0" r="150" fill="rgba(255,255,255,0.1)" />
          <circle cx="0" cy="200" r="100" fill="rgba(255,255,255,0.1)" />
        </svg>
      );
    } else if (isAmex) {
      bgClass = "from-[#00c6ff] to-[#0072ff]";
      graphics = (
        <svg className="absolute inset-0 w-full h-full object-cover opacity-40" viewBox="0 0 320 200" preserveAspectRatio="none">
          <path d="M -50 250 L 150 -50 L 200 -50 L 0 250 Z" fill="white" />
        </svg>
      );
    } else {
      bgClass = "from-[#11998e] to-[#38ef7d]";
    }
  }

  const isLight = n.includes("apple");
  const textColor = isLight ? "text-neutral-800" : "text-white";
  const mutedColor = isLight ? "text-neutral-500" : "text-white/70";

  // Animated digits rendering
  let groups = isAmex ? [4, 6, 5] : [4, 4, 4, 4];
  if (!isAmex && num.length > 16) {
    groups = [];
    let rem = num.length;
    while (rem > 0) {
      groups.push(Math.min(4, rem));
      rem -= 4;
    }
  }
  
  const digitGroups = [];
  let charIndex = 0;
  for (let g = 0; g < groups.length; g++) {
    let groupSpan = [];
    for (let i = 0; i < groups[g]; i++) {
      const idx = charIndex++;
      const isEntered = idx < num.length;
      const isVisibleBlock = g === groups.length - 1; 
      
      let char = "-";
      let op = isLight ? "opacity-20" : "opacity-30";
      let scale = "scale-90";
      
      if (isEntered) {
        char = isVisibleBlock ? num[idx] : "•";
        op = "opacity-100";
        scale = "scale-100";
      }
      
      groupSpan.push(
        <span key={idx} className={`inline-block transition-all duration-300 transform ${op} ${scale} ${char === '•' ? 'translate-y-[-2px] text-[1.2em]' : ''} w-[4cqw] text-center`}>
          {char}
        </span>
      );
    }
    digitGroups.push(<div key={g} className="flex gap-[0.2cqw]">{groupSpan}</div>);
  }

  return (
    <div className="@container relative w-full max-w-[400px] mx-auto aspect-[1.586/1] select-none">
      <div className={`absolute inset-0 rounded-[5cqw] overflow-hidden bg-gradient-to-br ${bgClass} shadow-xl flex flex-col justify-between ${textColor} p-[6cqw] transition-colors duration-500`}>
        {graphics}
        
        {/* Top Row: Bank Logo left, Network right */}
        <div className="relative z-10 flex justify-between items-start h-[8cqw]">
          <div className="flex items-center h-full">
            {bankLogo || <div className="w-[10cqw] h-[7cqw] rounded-[1cqw] bg-[#F5D77D] opacity-90 flex flex-col justify-evenly px-[1.5cqw] py-[1cqw]"><div className="w-full h-[0.5cqw] bg-black/10 rounded-full" /><div className="w-full h-[0.5cqw] bg-black/10 rounded-full" /><div className="w-full h-[0.5cqw] bg-black/10 rounded-full" /></div>}
          </div>
          
          <div className="flex items-center justify-end">
             {isVisa && <span className={`text-[7cqw] font-bold italic tracking-tighter ${textColor}`}>VISA</span>}
             {isMC && <div className="flex relative items-center"><div className={`w-[6cqw] h-[6cqw] rounded-full ${isLight ? 'bg-black/80' : 'bg-white'} opacity-90`} /><div className={`w-[6cqw] h-[6cqw] rounded-full ${isLight ? 'bg-black' : 'bg-white'} opacity-50 absolute right-[3.5cqw]`} /></div>}
             {isAmex && <span className={`text-[4cqw] font-bold uppercase tracking-widest ${textColor}`}>AMEX</span>}
          </div>
        </div>

        {/* Middle: Card Number Animated */}
        <div className="relative z-10 w-full mt-auto mb-[5cqw] flex justify-center gap-[2.5cqw] text-[5.5cqw] font-mono font-medium leading-none whitespace-nowrap">
          {digitGroups}
        </div>

        {/* Bottom Row */}
        <div className="relative z-10 flex justify-between items-end">
          <div className="flex flex-col min-w-0 pr-[4cqw]">
            <span className={`text-[2.5cqw] uppercase tracking-wider ${mutedColor} mb-[0.5cqw]`}>Cardholder Name</span>
            <span className="text-[4cqw] font-semibold tracking-wide uppercase truncate">
              {cardName || "Name"}
            </span>
          </div>
          
          <div className="flex flex-col shrink-0 text-right">
            <span className={`text-[2.5cqw] uppercase tracking-wider ${mutedColor} mb-[0.5cqw]`}>Expiry Date</span>
            <span className="text-[4cqw] font-medium font-mono">
              {expiry || "00/00"}
            </span>
          </div>
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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-[var(--bg)] p-1 rounded-lg w-fit border border-[var(--border)]">
        <button type="button" onClick={() => setMode("random")} className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${mode === "random" ? "bg-[var(--surface-hover)] text-[var(--fg)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>Random</button>
        <button type="button" onClick={() => setMode("passphrase")} className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${mode === "passphrase" ? "bg-[var(--surface-hover)] text-[var(--fg)] shadow-sm" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>Passphrase</button>
      </div>

      <div className="relative flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5">
        <span className="flex-1 font-mono text-[13px] text-[var(--fg)] break-all select-all leading-relaxed">{pw || "—"}</span>
        <button onClick={() => setSeed(s => s+1)} className="w-7 h-7 flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors cursor-pointer rounded-md hover:bg-[var(--surface-hover)]" title="Regenerate">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-[var(--bg)] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
        </div>
        <span className="text-[10px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider">{strength.label}</span>
      </div>

      {mode === "random" && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[var(--fg-muted)] w-4 shrink-0">8</span>
            <input type="range" min={8} max={64} value={len} onChange={e => setLen(+e.target.value)} className="flex-1 h-1 accent-[var(--accent)] cursor-pointer bg-[var(--bg)] rounded-full appearance-none" />
            <span className="text-[10px] text-[var(--fg-muted)] w-6 text-right shrink-0">{len}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {([["A–Z", upper, setUpper], ["a–z", lower, setLower], ["0–9", nums, setNums], ["!@#", syms, setSyms]] as [string, boolean, (v: boolean) => void][]).map(([lbl, val, set]) => (
              <label key={lbl} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer select-none transition-all ${val ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"}`}>
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="sr-only" />
                {lbl}
              </label>
            ))}
          </div>
        </>
      )}

      <button onClick={() => onUse(pw)} className="w-full py-2.5 text-[12px] font-semibold text-[var(--accent)] hover:text-[var(--bg)] rounded-lg border border-[var(--accent)] hover:bg-[var(--accent)] transition-all cursor-pointer">
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

export function NewEntryDialog({ open, folders, onSave, onClose, initialData }: NewEntryDialogProps) {
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
  const [expiryMonth, setExpiryMonth] = useState(() => (initialData?.payload.expiry || "").split("/")[0]?.trim() || "");
  const [expiryYear,  setExpiryYear]  = useState(() => (initialData?.payload.expiry || "").split("/")[1]?.trim() || "");
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

  useEffect(() => {
    if (!open) return;
    setTemplate(initialData?.template ?? "login");
    setName(initialData?.name ?? "");
    setFolder(initialData?.folder ?? "");
    setNewFolder("");
    setTags(initialData?.tags?.join(", ") ?? "");
    setSaving(false); setShowGen(false);
    setUsername(initialData?.payload.username ?? ""); setPassword(initialData?.payload.password ?? "");
    const a = initialData?.payload.urls ? [...initialData.payload.urls] : [];
    if (initialData?.payload.url && !a.includes(initialData.payload.url)) a.unshift(initialData.payload.url);
    setUrls(a.length > 0 ? a : [""]);
    setTotpSecret(initialData?.payload.totpSecret ?? ""); setShowTotp(!!initialData?.payload.totpSecret);
    setCardName(initialData?.payload.cardName ?? ""); setCardNumber(initialData?.payload.cardNumber ?? "");
    const eParts = (initialData?.payload.expiry || "").split("/");
    setExpiryMonth(eParts[0]?.trim() || ""); setExpiryYear(eParts[1]?.trim() || "");
    setCvv(initialData?.payload.cvv ?? ""); setPin(initialData?.payload.pin ?? "");
    setLine1(initialData?.payload.line1 ?? ""); setLine2(initialData?.payload.line2 ?? ""); setCity(initialData?.payload.city ?? ""); setStateVal(initialData?.payload.state ?? ""); setZip(initialData?.payload.zip ?? ""); setCountry(initialData?.payload.country ?? "");
    setFullName(initialData?.payload.fullName ?? ""); setDob(initialData?.payload.dob ?? ""); setIdNumber(initialData?.payload.idNumber ?? ""); setProfEmail(initialData?.payload.email ?? ""); setPhone(initialData?.payload.phone ?? "");
    setNote(initialData?.payload.note ?? ""); setEntryNotes(initialData?.payload.entryNotes ?? "");
    setCustomFields(initialData?.payload.customFields?.map(f => ({ id: crypto.randomUUID(), key: f.key, value: f.value })) ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Keyboard Ninja Shortcuts
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
    if (!name.trim()) return;
    setSaving(true);
    const payload: DecryptedPayload = {
      _template: template, _folder: activeFolder || undefined,
      customFields: customFields.filter(f => f.key.trim() || f.value.trim()).map(f => ({ key: f.key, value: f.value })),
      entryNotes: entryNotes.trim() || undefined,
    };
    if (template === "login")   { const v = urls.map(u => u.trim()).filter(Boolean); Object.assign(payload, { username, password, url: v[0] ?? "", urls: v, totpSecret: totpSecret.trim() }); }
    if (template === "card")    Object.assign(payload, { cardName, cardNumber, expiry: (expiryMonth || expiryYear) ? `${expiryMonth.padStart(2, '0')} / ${expiryYear}` : "", cvv, pin });
    if (template === "address") Object.assign(payload, { line1, line2, city, state: stateVal, zip, country });
    if (template === "profile") Object.assign(payload, { fullName, dob, idNumber, email: profEmail, phone });
    if (template === "note")    Object.assign(payload, { note });
    const parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);
    if (initialData?.payload.password && initialData.payload.password !== password) { payload.passwordHistory = [...(initialData.payload.passwordHistory ?? []), initialData.payload.password].slice(-5); }
    else if (initialData?.payload.passwordHistory) { payload.passwordHistory = initialData.payload.passwordHistory; }
    await onSave(name.trim(), template, activeFolder, parsedTags, payload, initialData?.id);
    setSaving(false);
  }, [name, template, activeFolder, customFields, entryNotes, urls, username, password, totpSecret, cardName, cardNumber, expiryMonth, expiryYear, cvv, pin, line1, line2, city, stateVal, zip, country, fullName, dob, idNumber, profEmail, phone, note, tags, initialData, onSave]);

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

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-[var(--bg)]/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-4xl flex rounded-2xl overflow-hidden border border-[var(--border)] shadow-2xl bg-[var(--bg)]"
        style={{ maxHeight: "88dvh", animation: "dialogIn 280ms cubic-bezier(0.16,1,0.3,1) forwards" }}>
        
        {/* ... (left panel) ... */}
        {/* Left panel omitted to keep chunk size small, wait, multi replace needs actual lines. */}
        {/* I'll just skip the `return createPortal` replace, and only replace what's needed. Wait, I MUST provide the exact target! */}

        {/* ━━━━ LEFT PANEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="w-56 shrink-0 flex flex-col bg-[var(--surface)] border-r border-[var(--border)]">
          <div className="px-4 pt-5 pb-4">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />
              </div>
              <span className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-widest">
                {initialData ? "Edit entry" : "New entry"}
              </span>
            </div>

            <p className="text-[9px] font-bold text-[var(--fg-muted)] uppercase tracking-[0.15em] mb-2 px-1">Template</p>
            <div className="space-y-1">
              {TEMPLATES.map(t => {
                const active = template === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all cursor-pointer group ${active ? "bg-[var(--accent)]/10 border border-[var(--accent)]/20" : "hover:bg-[var(--surface-hover)] border border-transparent"}`}>
                    <span className={`shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--fg-muted)] group-hover:text-[var(--fg)]"} transition-colors`}>{t.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-[12px] font-medium leading-tight ${active ? "text-[var(--accent)]" : "text-[var(--fg-muted)] group-hover:text-[var(--fg)]"}`}>{t.label}</p>
                    </div>
                    {active && <ChevronRight className="w-3 h-3 text-[var(--accent)] ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--border)] mx-4" />

          <div className="px-4 py-4 space-y-4 flex-1">
            <div>
              <FieldLabel>Name</FieldLabel>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Item name" autoFocus={!initialData} className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[12px] text-[var(--fg)] placeholder-[var(--fg-muted)] outline-none focus:border-[var(--accent)] transition-colors" />
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

          <div className="px-4 py-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--fg-muted)]">
              <Shield className="w-3 h-3" /><span>End-to-end encrypted</span>
            </div>
          </div>
        </div>

        {/* ━━━━ RIGHT PANEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg)]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--surface)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--fg)]">
                {currentTpl.icon}
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--fg)]">{name || `New ${currentTpl.label}`}</h2>
                <p className="text-[11px] text-[var(--fg-muted)]">{currentTpl.desc}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* ── LOGIN ── */}
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
              </>
            )}

            {/* ── CARD ── */}
            {template === "card" && (
              <>
                <DetailedCardVisual cardName={cardName} cardNumber={cardNumber} expiry={displayExpiry} entryName={name} />
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div><FieldLabel>Cardholder Name</FieldLabel><Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Name on card" /></div>
                  <div>
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
              </>
            )}

            {/* ── ADDRESS ── */}
            {template === "address" && (
              <>
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
              </>
            )}

            {/* ── PROFILE ── */}
            {template === "profile" && (
              <>
                <div><FieldLabel>Full Name</FieldLabel><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Legal name" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><FieldLabel>Email</FieldLabel><Input value={profEmail} onChange={e => setProfEmail(e.target.value)} placeholder="email@example.com" type="email" /></div>
                  <div><FieldLabel>Phone Number</FieldLabel><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555-0000" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><FieldLabel>Date of Birth</FieldLabel><Input value={dob} onChange={e => setDob(e.target.value)} placeholder="YYYY-MM-DD" /></div>
                  <div><FieldLabel>ID / Passport Number</FieldLabel><SecretInput value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="ID no." /></div>
                </div>
              </>
            )}

            {/* ── NOTE ── */}
            {template === "note" && (
              <div>
                <div className="flex items-center justify-between mb-1.5"><FieldLabel>Secure Note</FieldLabel><span className="text-[10px] text-[var(--fg-muted)] tabular-nums">{note.length} chars</span></div>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Secure note…" rows={10} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none font-mono" />
              </div>
            )}

            {/* ── SHARED: Private Notes ── */}
            {template !== "note" && (
              <div>
                <FieldLabel>Private Notes</FieldLabel>
                <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder="Optional private notes…" rows={2} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-[var(--fg)] placeholder-[var(--fg-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none" />
              </div>
            )}

            {/* ── Custom Fields ── */}
            {customFields.length > 0 && (
              <div>
                <FieldLabel>Custom Fields</FieldLabel>
                <div className="space-y-2">
                  {customFields.map(f => (
                    <div key={f.id} className="flex gap-2 items-center">
                      <Input value={f.key} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, key: e.target.value } : x))} placeholder="Label" className="w-[35%] shrink-0" />
                      <Input value={f.value} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder="Value" type="password" />
                      <button onClick={() => setCustomFields(p => p.filter(x => x.id !== f.id))} className="shrink-0 w-7 h-8 flex items-center justify-center text-[var(--fg-muted)] hover:text-red-400 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={addCustomField} className="flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors cursor-pointer">
              <Plus className="w-3 h-3" /> Add custom field
            </button>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
            <div className="text-[10px] text-[var(--fg-muted)] font-mono">
              <span className="opacity-50 mr-2">⌘S</span> to save
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onClose} variant="ghost" disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} variant="primary" disabled={!name.trim() || saving}>{saving ? "Saving…" : initialData ? "Save Changes" : "Encrypt & Save"}</Button>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes dialogIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
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

"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Lock,
  CreditCard,
  FileText,
  User,
  Wand2,
  Plus,
  Minus,
  RefreshCw,
  Copy,
  Check,
  Folder,
  Shield,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

// ── Types ────────────────────────────────────────────────────────────────────

type Template = "login" | "card" | "address" | "profile" | "note";

interface CustomField {
  id: string;
  key: string;
  value: string;
}

export interface DecryptedPayload {
  _template?: Template;
  _folder?: string;
  username?: string;
  password?: string;
  url?: string;
  urls?: string[];
  cardName?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  pin?: string;
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
  customFields?: { key: string; value: string }[];
  totpSecret?: string;
  entryNotes?: string;
  passwordHistory?: string[];
  payload?: string;
}

export interface NewEntryDialogProps {
  open: boolean;
  folders: string[];
  onSave: (
    name: string,
    template: Template,
    folder: string,
    tags: string[],
    payload: DecryptedPayload,
    editId?: string
  ) => Promise<void>;
  onClose: () => void;
  initialData?: {
    id: string;
    name: string;
    folder?: string;
    tags?: string[];
    template: Template;
    payload: DecryptedPayload;
  };
}

// ── Password Generator ────────────────────────────────────────────────────────

function generatePassword(
  len: number,
  upper: boolean,
  lower: boolean,
  nums: boolean,
  syms: boolean
): string {
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
  return Array.from(arr)
    .map((v) => pool[v % pool.length])
    .join("");
}

function PasswordGen({ onUse }: { onUse: (pw: string) => void }) {
  const [len, setLen] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [nums, setNums] = useState(true);
  const [syms, setSyms] = useState(false);
  const [seed, setSeed] = useState(0);
  const [copied, setCopied] = useState(false);

  const pw = useMemo(
    () => generatePassword(len, upper, lower, nums, syms),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [len, upper, lower, nums, syms, seed]
  );

  const regen = () => setSeed((s) => s + 1);
  const copy = () => {
    navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3 p-3 rounded-lg border border-[var(--border)] bg-neutral-950/60">
      <div className="flex items-center gap-1.5 bg-neutral-900 border border-[var(--border)] rounded-lg px-3 py-2">
        <span className="flex-1 font-mono text-[11px] text-neutral-200 break-all select-all">
          {pw || "—"}
        </span>
        <button
          onClick={regen}
          className="text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer p-1 shrink-0"
          title="Regenerate"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
        <button
          onClick={copy}
          className="text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer p-1 shrink-0"
          title="Copy"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[10px] text-neutral-600 w-5 text-right shrink-0 tabular-nums">
          {len}
        </span>
        <input
          type="range"
          min={8}
          max={64}
          value={len}
          onChange={(e) => setLen(+e.target.value)}
          className="flex-1 h-0.5 accent-neutral-500 cursor-pointer"
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {(
          [
            ["A–Z", upper, setUpper],
            ["a–z", lower, setLower],
            ["0–9", nums, setNums],
            ["!@#", syms, setSyms],
          ] as [string, boolean, (v: boolean) => void][]
        ).map(([label, val, set]) => (
          <label
            key={label}
            className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-300 cursor-pointer select-none transition-colors"
          >
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => set(e.target.checked)}
              className="accent-neutral-400 w-3 h-3"
            />
            {label}
          </label>
        ))}
      </div>

      <button
        onClick={() => onUse(pw)}
        className="w-full text-[11px] font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer py-1.5 px-3 rounded-md hover:bg-neutral-800 border border-transparent hover:border-neutral-700"
      >
        ↑ Use this password
      </button>
    </div>
  );
}

// ── Section label helper ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-neutral-600 uppercase tracking-[0.12em] font-medium select-none">
      {children}
    </span>
  );
}

// ── Template definitions ──────────────────────────────────────────────────────

const TEMPLATES: { id: Template; label: string; icon: React.ReactNode }[] = [
  { id: "login", label: "Login", icon: <Lock className="w-3.5 h-3.5" /> },
  { id: "card", label: "Card", icon: <CreditCard className="w-3.5 h-3.5" /> },
  { id: "note", label: "Note", icon: <FileText className="w-3.5 h-3.5" /> },
  {
    id: "address",
    label: "Address",
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  { id: "profile", label: "Profile", icon: <User className="w-3.5 h-3.5" /> },
];

// ── Main Dialog ───────────────────────────────────────────────────────────────

export function NewEntryDialog({
  open,
  folders,
  onSave,
  onClose,
  initialData,
}: NewEntryDialogProps) {
  // ── Form state ───────────────────────────────────────────────────────────
  const [template, setTemplate] = useState<Template>(
    initialData?.template ?? "login"
  );
  const [name, setName] = useState(initialData?.name ?? "");
  const [folder, setFolder] = useState(initialData?.folder ?? "");
  const [newFolder, setNewFolder] = useState("");
  const [tags, setTags] = useState(initialData?.tags?.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [showGen, setShowGen] = useState(false);

  // Login
  const [username, setUsername] = useState(
    initialData?.payload.username ?? ""
  );
  const [password, setPassword] = useState(
    initialData?.payload.password ?? ""
  );
  const [urls, setUrls] = useState<string[]>(() => {
    const arr = initialData?.payload.urls
      ? [...initialData.payload.urls]
      : [];
    if (
      initialData?.payload.url &&
      !arr.includes(initialData.payload.url)
    ) {
      arr.unshift(initialData.payload.url);
    }
    return arr.length > 0 ? arr : [""];
  });
  const [totpSecret, setTotpSecret] = useState(
    initialData?.payload.totpSecret ?? ""
  );
  const [showTotp, setShowTotp] = useState(!!initialData?.payload.totpSecret);

  // Card
  const [cardName, setCardName] = useState(initialData?.payload.cardName ?? "");
  const [cardNumber, setCardNumber] = useState(
    initialData?.payload.cardNumber ?? ""
  );
  const [expiry, setExpiry] = useState(initialData?.payload.expiry ?? "");
  const [cvv, setCvv] = useState(initialData?.payload.cvv ?? "");
  const [pin, setPin] = useState(initialData?.payload.pin ?? "");

  // Address
  const [line1, setLine1] = useState(initialData?.payload.line1 ?? "");
  const [line2, setLine2] = useState(initialData?.payload.line2 ?? "");
  const [city, setCity] = useState(initialData?.payload.city ?? "");
  const [stateVal, setStateVal] = useState(initialData?.payload.state ?? "");
  const [zip, setZip] = useState(initialData?.payload.zip ?? "");
  const [country, setCountry] = useState(initialData?.payload.country ?? "");

  // Profile
  const [fullName, setFullName] = useState(
    initialData?.payload.fullName ?? ""
  );
  const [dob, setDob] = useState(initialData?.payload.dob ?? "");
  const [idNumber, setIdNumber] = useState(
    initialData?.payload.idNumber ?? ""
  );
  const [profEmail, setProfEmail] = useState(
    initialData?.payload.email ?? ""
  );
  const [phone, setPhone] = useState(initialData?.payload.phone ?? "");

  // Note
  const [note, setNote] = useState(initialData?.payload.note ?? "");

  // Shared
  const [entryNotes, setEntryNotes] = useState(
    initialData?.payload.entryNotes ?? ""
  );
  const [customFields, setCustomFields] = useState<CustomField[]>(
    () =>
      initialData?.payload.customFields?.map((f) => ({
        id: crypto.randomUUID(),
        key: f.key,
        value: f.value,
      })) ?? []
  );

  const addCustomField = () =>
    setCustomFields((p) => [
      ...p,
      { id: crypto.randomUUID(), key: "", value: "" },
    ]);

  // Reset form when dialog opens with new initialData
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
    const arr = initialData?.payload.urls ? [...initialData.payload.urls] : [];
    if (initialData?.payload.url && !arr.includes(initialData.payload.url)) arr.unshift(initialData.payload.url);
    setUrls(arr.length > 0 ? arr : [""]);
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
    setCustomFields(
      initialData?.payload.customFields?.map((f) => ({
        id: crypto.randomUUID(),
        key: f.key,
        value: f.value,
      })) ?? []
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const activeFolder = folder === "__new__" ? newFolder.trim() : folder;

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload: DecryptedPayload = {
      _template: template,
      _folder: activeFolder || undefined,
      customFields: customFields
        .filter((f) => f.key.trim() || f.value.trim())
        .map((f) => ({ key: f.key, value: f.value })),
      entryNotes: entryNotes.trim() || undefined,
    };

    if (template === "login") {
      const validUrls = urls.map((u) => u.trim()).filter(Boolean);
      Object.assign(payload, {
        username,
        password,
        url: validUrls[0] ?? "",
        urls: validUrls,
        totpSecret: totpSecret.trim(),
      });
    }
    if (template === "card")
      Object.assign(payload, { cardName, cardNumber, expiry, cvv, pin });
    if (template === "address")
      Object.assign(payload, {
        line1,
        line2,
        city,
        state: stateVal,
        zip,
        country,
      });
    if (template === "profile")
      Object.assign(payload, {
        fullName,
        dob,
        idNumber,
        email: profEmail,
        phone,
      });
    if (template === "note") Object.assign(payload, { note });

    const parsedTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Carry over / update password history on edit
    if (
      initialData?.payload.password &&
      initialData.payload.password !== password
    ) {
      payload.passwordHistory = [
        ...(initialData.payload.passwordHistory ?? []),
        initialData.payload.password,
      ].slice(-5);
    } else if (initialData?.payload.passwordHistory) {
      payload.passwordHistory = initialData.payload.passwordHistory;
    }

    await onSave(
      name.trim(),
      template,
      activeFolder,
      parsedTags,
      payload,
      initialData?.id
    );
    setSaving(false);
  }, [
    name, template, activeFolder, customFields, entryNotes, urls,
    username, password, totpSecret, cardName, cardNumber, expiry, cvv, pin,
    line1, line2, city, stateVal, zip, country, fullName, dob, idNumber,
    profEmail, phone, note, tags, initialData, onSave,
  ]);

  // ── Do not render if closed ──────────────────────────────────────────────
  if (typeof window === "undefined") return null;

  const dialogContent = (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{
          opacity: open ? 1 : 0,
          transition: "opacity 220ms ease",
        }}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full sm:max-w-lg flex flex-col bg-[#0d0d0d] border border-[var(--border)] shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden"
        style={{
          borderRadius: "clamp(0px, 16px, 16px)",
          maxHeight: "92dvh",
          transform: open ? "translateY(0) scale(1)" : "translateY(24px) scale(0.98)",
          opacity: open ? 1 : 0,
          transition: "transform 260ms cubic-bezier(0.16,1,0.3,1), opacity 220ms ease",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-[var(--border)] flex items-center justify-center text-neutral-400">
              {TEMPLATES.find((t) => t.id === template)?.icon ?? (
                <Lock className="w-3.5 h-3.5" />
              )}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-neutral-100 leading-tight">
                {initialData ? "Edit entry" : "New entry"}
              </p>
              <p className="text-[10px] text-neutral-600 leading-tight mt-0.5">
                {TEMPLATES.find((t) => t.id === template)?.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-neutral-700 select-none">
              <Shield className="w-3 h-3" />
              Encrypted locally
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer ml-1"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

          {/* Type selector */}
          <div className="space-y-2">
            <SectionLabel>Type</SectionLabel>
            <div className="flex gap-1.5 flex-wrap">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all cursor-pointer font-medium ${
                    template === t.id
                      ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                      : "border-[var(--border)] text-neutral-500 hover:text-neutral-300 hover:border-neutral-700 bg-neutral-950/40"
                  }`}
                >
                  <span
                    className={
                      template === t.id ? "text-neutral-300" : "text-neutral-700"
                    }
                  >
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <SectionLabel>Name *</SectionLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                template === "login"
                  ? "e.g. Gmail, GitHub"
                  : template === "card"
                  ? "e.g. Visa Personal"
                  : template === "address"
                  ? "e.g. Home, Office"
                  : template === "profile"
                  ? "e.g. Personal ID"
                  : "Note title"
              }
              autoFocus={!initialData}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleSave();
              }}
            />
          </div>

          {/* Folder + Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <SectionLabel>Folder</SectionLabel>
              <Select
                value={folder}
                onChange={setFolder}
                options={[
                  { value: "", label: "No folder" },
                  ...folders.map((f) => ({
                    value: f,
                    label: f,
                    icon: <Folder className="w-3.5 h-3.5" />,
                  })),
                  {
                    value: "__new__",
                    label: "+ New folder…",
                    divider: folders.length > 0,
                  },
                ]}
                placeholder="No folder"
              />
            </div>
            <div className="space-y-1.5">
              <SectionLabel>Tags</SectionLabel>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="work, personal…"
              />
            </div>
          </div>

          {folder === "__new__" && (
            <Input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="New folder name"
              autoFocus
            />
          )}

          {/* Divider */}
          <div className="border-t border-[var(--border)]" />

          {/* ── Login fields ──────────────────────────────────────────── */}
          {template === "login" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <SectionLabel>Credentials</SectionLabel>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username / Email"
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGen((v) => !v)}
                    title="Generate password"
                    className={`shrink-0 px-2.5 border rounded-lg transition-colors cursor-pointer ${
                      showGen
                        ? "border-neutral-600 bg-neutral-800 text-neutral-200"
                        : "border-[var(--border)] text-neutral-600 hover:text-neutral-300 hover:border-neutral-700"
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {showGen && (
                  <PasswordGen
                    onUse={(pw) => {
                      setPassword(pw);
                      setShowGen(false);
                    }}
                  />
                )}
              </div>

              <div className="space-y-2">
                <SectionLabel>URLs</SectionLabel>
                {urls.map((u, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={u}
                      onChange={(e) =>
                        setUrls((p) =>
                          p.map((x, idx) => (idx === i ? e.target.value : x))
                        )
                      }
                      placeholder="https://…"
                    />
                    {i === urls.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setUrls((p) => [...p, ""])}
                        className="shrink-0 px-2 border rounded-lg border-[var(--border)] text-neutral-600 hover:text-neutral-300 hover:border-neutral-600 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setUrls((p) => p.filter((_, idx) => idx !== i))
                        }
                        className="shrink-0 px-2 border rounded-lg border-[var(--border)] text-neutral-600 hover:text-red-400 hover:border-red-900/50 transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* 2FA */}
              {!showTotp ? (
                <button
                  type="button"
                  onClick={() => setShowTotp(true)}
                  className="text-[11px] text-neutral-600 hover:text-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add 2FA / TOTP secret
                </button>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <SectionLabel>2FA / TOTP</SectionLabel>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTotp(false);
                        setTotpSecret("");
                      }}
                      className="text-[10px] text-neutral-700 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      value={totpSecret}
                      onChange={(e) => setTotpSecret(e.target.value)}
                      type="password"
                      placeholder="TOTP Setup Key (Base32)"
                      className="font-mono pr-14"
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 right-3 text-[9px] uppercase font-semibold tracking-wider text-neutral-600 select-none bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                      TOTP
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Card fields ───────────────────────────────────────────── */}
          {template === "card" && (
            <div className="space-y-3">
              <SectionLabel>Card Details</SectionLabel>
              <Input
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Cardholder name"
              />
              <Input
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="Card number"
                className="font-mono"
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="MM / YY"
                />
                <Input
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="CVV"
                  type="password"
                />
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN"
                  type="password"
                />
              </div>
            </div>
          )}

          {/* ── Address fields ────────────────────────────────────────── */}
          {template === "address" && (
            <div className="space-y-3">
              <SectionLabel>Address</SectionLabel>
              <Input
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="Address line 1"
              />
              <Input
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                placeholder="Address line 2 (apt, suite…)"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
                <Input
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  placeholder="State / Province"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="ZIP / Postal code"
                />
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                />
              </div>
            </div>
          )}

          {/* ── Profile fields ────────────────────────────────────────── */}
          {template === "profile" && (
            <div className="space-y-3">
              <SectionLabel>Profile</SectionLabel>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  placeholder="Date of birth"
                />
                <Input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="ID / Passport no."
                />
              </div>
            </div>
          )}

          {/* ── Note content ──────────────────────────────────────────── */}
          {template === "note" && (
            <div className="space-y-2">
              <SectionLabel>Content</SectionLabel>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write your secure note…"
                rows={7}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--fg)] placeholder-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors resize-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
              />
            </div>
          )}

          {/* ── Private notes (non-note templates) ───────────────────── */}
          {template !== "note" && (
            <div className="space-y-2">
              <SectionLabel>Private Notes</SectionLabel>
              <textarea
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                placeholder="Private notes…"
                rows={2}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--fg)] placeholder-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors resize-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
              />
            </div>
          )}

          {/* ── Custom fields ──────────────────────────────────────────── */}
          {customFields.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Custom Fields</SectionLabel>
              {customFields.map((f) => (
                <div key={f.id} className="flex gap-2">
                  <Input
                    value={f.key}
                    onChange={(e) =>
                      setCustomFields((p) =>
                        p.map((x) =>
                          x.id === f.id ? { ...x, key: e.target.value } : x
                        )
                      )
                    }
                    placeholder="Label"
                    className="w-1/3"
                  />
                  <Input
                    value={f.value}
                    onChange={(e) =>
                      setCustomFields((p) =>
                        p.map((x) =>
                          x.id === f.id ? { ...x, value: e.target.value } : x
                        )
                      )
                    }
                    placeholder="Value"
                    type="password"
                  />
                  <button
                    onClick={() =>
                      setCustomFields((p) => p.filter((x) => x.id !== f.id))
                    }
                    className="text-neutral-700 hover:text-red-400 transition-colors cursor-pointer shrink-0 px-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={addCustomField}
            className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" /> Add custom field
          </button>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border)] bg-neutral-950/60 shrink-0">
          <Button onClick={onClose} variant="ghost" disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="primary"
            disabled={!name.trim() || saving}
          >
            {saving
              ? "Saving…"
              : initialData
              ? "Save Changes"
              : "Encrypt & Save"}
          </Button>
        </div>
      </div>
    </div>
  );

  // Only render when open (keeps DOM clean when closed)
  if (!open) return null;

  return createPortal(dialogContent, document.body);
}

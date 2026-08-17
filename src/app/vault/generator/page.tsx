"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import {
  Copy,
  Check,
  RefreshCw,
  Zap,
  Shield,
  ShieldCheck,
  Plus,
  Lock,
  Sparkles,
  Sliders,
  History,
  Trash2,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  generateRandom,
  generatePassphrase,
  generatePin,
  generatePattern,
  scorePassword,
  type GeneratorMode,
  type RandomOptions,
  type PassphraseOptions,
  type PinOptions,
  type PatternOptions,
  type StrengthResult,
} from "@/lib/generator";
import { useVault, type Template } from "@/context/VaultContext";
import { NewEntryDialog, type DecryptedPayload } from "@/components/vault/NewEntryDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: number;
  value: string;
  mode: string;
  strength: StrengthResult;
  timestamp: string;
}

type CharClass = "lower" | "upper" | "digit" | "symbol";

function classifyChar(c: string): CharClass {
  if (/[a-z]/.test(c)) return "lower";
  if (/[A-Z]/.test(c)) return "upper";
  if (/[0-9]/.test(c)) return "digit";
  return "symbol";
}

const CHAR_STYLE: Record<CharClass, { text: string }> = {
  lower:  { text: "text-neutral-300" },
  upper:  { text: "text-sky-400 font-semibold" },
  digit:  { text: "text-amber-400 font-bold" },
  symbol: { text: "text-rose-400 font-bold" },
};

// ── Clipboard Hook ────────────────────────────────────────────────────────────

function useClipboard(): { copied: boolean; copy: (v: string) => void } {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = useCallback((v: string) => {
    if (!v) return;
    navigator.clipboard.writeText(v).catch(() => {});
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }, []);
  return { copied, copy };
}

// ── Rich Colorized Character Display ──────────────────────────────────────────

function ColorizedOutput({
  value,
  mode,
  size,
}: {
  value: string;
  mode: GeneratorMode;
  size?: "sm" | "md" | "lg";
}) {
  if (!value) return <span className="text-neutral-700 font-mono">—</span>;

  if (mode === "pin") {
    return (
      <span
        className={`font-mono font-bold tracking-[0.22em] text-amber-400 select-all ${
          size === "sm" ? "text-xs" : "text-xl sm:text-2xl"
        }`}
      >
        {value}
      </span>
    );
  }

  if (mode === "passphrase") {
    const words = value.split(/([\-\._\s])/);
    return (
      <span
        className={`font-mono break-all select-all leading-relaxed ${
          size === "sm" ? "text-xs" : "text-base sm:text-lg"
        }`}
      >
        {words.map((chunk, i) => {
          const isSep = /^[\-\._\s]$/.test(chunk);
          if (isSep) {
            return (
              <span key={i} className="text-amber-400 font-bold px-0.5 select-none">
                {chunk === " " ? "␣" : chunk}
              </span>
            );
          }
          return (
            <span key={i} className="text-neutral-100 font-medium">
              {chunk}
            </span>
          );
        })}
      </span>
    );
  }

  // Random & Pattern
  return (
    <span
      className={`font-mono break-all select-all leading-relaxed tracking-wider ${
        size === "sm" ? "text-xs" : "text-base sm:text-lg"
      }`}
    >
      {value.split("").map((c, i) => {
        const cls = classifyChar(c);
        const style = CHAR_STYLE[cls];
        return (
          <span key={i} className={style.text}>
            {c}
          </span>
        );
      })}
    </span>
  );
}

// ── Color Legend ──────────────────────────────────────────────────────────────

function ColorLegend() {
  const items = [
    { label: "Lowercase", color: "text-neutral-300", dot: "bg-neutral-400", sample: "abc" },
    { label: "Uppercase", color: "text-sky-400",     dot: "bg-sky-400",     sample: "ABC" },
    { label: "Digits",    color: "text-amber-400",   dot: "bg-amber-400",   sample: "123" },
    { label: "Symbols",   color: "text-rose-400",    dot: "bg-rose-400",    sample: "!@#" },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-900/90 border border-neutral-800/80"
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${it.dot}`} />
          <span className={`text-[10px] font-medium ${it.color}`}>{it.label}</span>
          <span className="text-[9px] font-mono text-neutral-600 ml-0.5 select-none">{it.sample}</span>
        </div>
      ))}
    </div>
  );
}

// ── Strength Bar ──────────────────────────────────────────────────────────────

function StrengthBar({ r }: { r: StrengthResult }) {
  if (!r.label) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= r.score ? r.color : "#1f1f1f" }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: r.color }}>
            {r.label}
          </span>
          <span className="text-neutral-700">·</span>
          <span className="text-neutral-400">{r.entropy} bits entropy</span>
        </div>
        <span className="text-neutral-500">
          crack time: <span className="text-neutral-300 font-medium">{r.crackTime}</span>
        </span>
      </div>
    </div>
  );
}

// ── Character Breakdown Pills ─────────────────────────────────────────────────

function CharBreakdown({ value }: { value: string }) {
  const counts = useMemo(() => {
    let lower = 0, upper = 0, digit = 0, symbol = 0;
    for (const c of value) {
      const cls = classifyChar(c);
      if (cls === "lower")  lower++;
      if (cls === "upper")  upper++;
      if (cls === "digit")  digit++;
      if (cls === "symbol") symbol++;
    }
    return { lower, upper, digit, symbol };
  }, [value]);

  if (!value) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1">
      {counts.lower > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono text-[10.5px]">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 shrink-0" />
          <span>{counts.lower} lower</span>
        </div>
      )}
      {counts.upper > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-950/50 border border-sky-800/40 text-sky-300 font-mono text-[10.5px]">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
          <span>{counts.upper} upper</span>
        </div>
      )}
      {counts.digit > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-800/40 text-amber-300 font-mono text-[10.5px]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          <span>{counts.digit} digits</span>
        </div>
      )}
      {counts.symbol > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950/50 border border-rose-800/40 text-rose-300 font-mono text-[10.5px]">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
          <span>{counts.symbol} symbols</span>
        </div>
      )}
    </div>
  );
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative w-9 h-5 rounded-full border transition-all duration-150 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 ${
        on ? "bg-sky-700 border-sky-600" : "bg-neutral-800 border-neutral-700"
      }`}
    >
      <span
        className="absolute top-[3px] w-[13px] h-[13px] rounded-full bg-white shadow-sm transition-all duration-150"
        style={{ left: on ? "calc(100% - 16px)" : "3px" }}
      />
    </button>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function MinSpinner({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${disabled ? "opacity-20 pointer-events-none" : ""}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer text-xs select-none"
      >
        −
      </button>
      <span className="text-[12px] text-neutral-200 w-4 text-center tabular-nums select-none font-mono">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(8, value + 1))}
        className="w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer text-xs select-none"
      >
        +
      </button>
    </div>
  );
}

// ── History Row ───────────────────────────────────────────────────────────────

function HistoryRow({
  entry,
  onUseInVault,
}: {
  entry: HistoryEntry;
  onUseInVault: (val: string) => void;
}) {
  const { copied, copy } = useClipboard();

  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-neutral-900/60 transition-colors border-b border-[var(--border)] last:border-0">
      {/* Strength indicator dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: entry.strength.color || "#444" }}
        title={entry.strength.label}
      />
      <div className="flex-1 min-w-0">
        <ColorizedOutput value={entry.value} mode={entry.mode as GeneratorMode} size="sm" />
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">
            {entry.mode}
          </span>
          {entry.strength.label && (
            <>
              <span className="text-neutral-700 text-[10px]">·</span>
              <span className="text-[10px] font-medium" style={{ color: entry.strength.color }}>
                {entry.strength.label}
              </span>
            </>
          )}
          <span className="text-neutral-700 text-[10px]">·</span>
          <span className="text-[10px] text-neutral-600 font-mono">{entry.timestamp}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onUseInVault(entry.value)}
          title="Save to Vault as new item"
          className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-emerald-400 hover:bg-emerald-950/30 border border-neutral-800 hover:border-emerald-800/40 rounded px-2 py-1 transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span className="hidden sm:inline">Use</span>
        </button>

        <button
          type="button"
          onClick={() => copy(entry.value)}
          title="Copy to clipboard"
          className="p-1.5 text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer rounded hover:bg-neutral-800"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { id: GeneratorMode; label: string; icon: string }[] = [
  { id: "random",     label: "Random",     icon: "🎲" },
  { id: "passphrase", label: "Passphrase", icon: "📖" },
  { id: "pin",        label: "PIN Code",   icon: "🔢" },
  { id: "pattern",    label: "Pattern",    icon: "🧩" },
];

const PRESET_LENGTHS = [12, 16, 20, 24, 32, 48];

const SEPARATORS = [
  { v: "-", label: "Hyphen (-)" },
  { v: ".", label: "Dot (.)" },
  { v: "_", label: "Under (_)" },
  { v: " ", label: "Space ( )" },
  { v: "",  label: "None" },
];

const CHARSET_DEFS = [
  { key: "useLower"  as const, label: "Lowercase (a–z)", example: "abcdef…", color: "text-neutral-300", hasMin: false, minKey: null },
  { key: "useUpper"  as const, label: "Uppercase (A–Z)", example: "ABCDEF…", color: "text-sky-400",     hasMin: true,  minKey: "minUpper"   as const },
  { key: "useDigits" as const, label: "Digits (0–9)",    example: "012345…", color: "text-amber-400",   hasMin: true,  minKey: "minDigits"  as const },
  { key: "useSymbols"as const, label: "Symbols (!@#…)",  example: "!@#$%^…", color: "text-rose-400",    hasMin: true,  minKey: "minSymbols" as const },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Generator Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function GeneratorPage() {
  const { folders, saveItem, encryptData } = useVault();
  const [mode, setMode] = useState<GeneratorMode>("random");
  const { copied, copy } = useClipboard();

  // Generator Options
  const [randOpts, setRandOpts] = useState<RandomOptions>({
    length: 20,
    useLower: true,
    useUpper: true,
    useDigits: true,
    useSymbols: true,
    pronounceable: false,
    minUpper: 1,
    minDigits: 1,
    minSymbols: 1,
    exclude: "",
  });
  const [ppOpts,  setPpOpts]  = useState<PassphraseOptions>({ wordCount: 4, separator: "-", capitalize: true });
  const [pinOpts, setPinOpts] = useState<PinOptions>({ length: 6 });
  const [patOpts, setPatOpts] = useState<PatternOptions>({ pattern: "ULL-ddd-SS" });

  const [output,   setOutput]   = useState("");
  const [strength, setStrength] = useState<StrengthResult>({ score: 0, label: "", color: "", crackTime: "", entropy: 0 });
  const [history,  setHistory]  = useState<HistoryEntry[]>([]);
  const uidRef = useRef(0);

  // Vault Integration Dialog State
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [targetPassword, setTargetPassword] = useState("");

  const generate = useCallback(() => {
    let pw = "";
    switch (mode) {
      case "random":     pw = generateRandom(randOpts);   break;
      case "passphrase": pw = generatePassphrase(ppOpts); break;
      case "pin":        pw = generatePin(pinOpts);       break;
      case "pattern":    pw = generatePattern(patOpts);   break;
    }
    const str = scorePassword(pw);
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setOutput(pw);
    setStrength(str);
    setHistory((prev) => [
      { id: ++uidRef.current, value: pw, mode, strength: str, timestamp: timeStr },
      ...prev.slice(0, 19),
    ]);
  }, [mode, randOpts, ppOpts, pinOpts, patOpts]);

  // Re-generate on options change
  useEffect(() => {
    generate();
  }, [generate]);

  const pro = randOpts.pronounceable;

  const handleUseInVault = (pw: string) => {
    setTargetPassword(pw);
    setNewEntryOpen(true);
  };

  const handleSaveToVault = async (
    name: string,
    template: Template,
    folder: string,
    tags: string[],
    payload: DecryptedPayload
  ) => {
    const encBlob = await encryptData(JSON.stringify(payload));
    await saveItem({
      name,
      encryptedBlob: encBlob,
      template,
      folder: folder || undefined,
      domain: payload.url || undefined,
      hasTotp: !!payload.totpSecret,
      tags,
    });
    setNewEntryOpen(false);
  };

  return (
    <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-[var(--bg)]">

      {/* ── Left Panel: Generator & Controls ──────────────────────────────────── */}
      <div className="w-full lg:w-[540px] xl:w-[600px] shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border)] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[var(--border)] bg-neutral-950/60 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold text-neutral-100">Password Generator</h1>
                <p className="text-[11px] text-neutral-500">
                  Zero-Knowledge & WebCrypto · Generated securely in-memory
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-900/80 text-[11px] font-mono text-neutral-400">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>In-Memory Only</span>
            </div>
          </div>
        </div>

        {/* Main Configuration Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Mode Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 border border-[var(--border)] rounded-xl bg-neutral-950">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMode(t.id)}
                  className={`py-2 text-[12px] font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === t.id
                      ? "bg-neutral-800 text-neutral-100 shadow-sm font-semibold"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  <span className="text-xs">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Password Display & Quick Actions Card */}
            <div className="border border-[var(--border)] rounded-2xl bg-neutral-950 shadow-xl overflow-hidden">
              
              {/* Output & Character Syntax Highlighting */}
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3 min-h-[52px]">
                  <div className="flex-1 min-w-0 select-all cursor-text">
                    <ColorizedOutput value={output} mode={mode} size="md" />
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => copy(output)}
                      disabled={!output}
                      title="Copy to clipboard"
                      className="p-2 text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors cursor-pointer disabled:opacity-30 flex items-center gap-1 text-xs font-medium"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={generate}
                      title="Generate new password"
                      className="p-2 text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Character Breakdown Bar */}
                {mode === "random" && <CharBreakdown value={output} />}
              </div>

              {/* Password Strength Gauge */}
              <div className="border-t border-[var(--border)] px-4 sm:px-5 py-3 bg-neutral-900/30">
                <StrengthBar r={strength} />
              </div>

              {/* Color Legend (for Random & Pattern modes) */}
              {(mode === "random" || mode === "pattern") && (
                <div className="border-t border-[var(--border)] px-4 sm:px-5 py-2.5 bg-neutral-950">
                  <ColorLegend />
                </div>
              )}

              {/* Primary Integrated Action Bar */}
              <div className="border-t border-[var(--border)] p-3 bg-neutral-900/60 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUseInVault(output)}
                  className="flex-1 py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold text-[13px] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-[0.99]"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Save to Vault as New Item</span>
                </button>

                <button
                  type="button"
                  onClick={generate}
                  className="py-2 px-3.5 rounded-xl border border-neutral-700/80 hover:border-neutral-500 text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 font-medium text-[13px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </button>
              </div>
            </div>

            {/* Options Configuration Surface */}
            <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden shadow-sm">

              {/* ── RANDOM MODE OPTIONS ────────────────────────────────────────── */}
              {mode === "random" && (
                <>
                  {/* Length Slider & Presets */}
                  <div className="p-4 sm:p-5 border-b border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-neutral-300">Password Length</span>
                      <span className="text-[15px] font-mono font-bold text-neutral-100 tabular-nums">
                        {randOpts.length} <span className="text-[11px] font-normal text-neutral-500">characters</span>
                      </span>
                    </div>

                    <input
                      type="range"
                      min={6}
                      max={64}
                      value={randOpts.length}
                      onChange={(e) => setRandOpts((p) => ({ ...p, length: +e.target.value }))}
                      disabled={pro}
                      className="w-full accent-white cursor-pointer h-1.5 bg-neutral-800 rounded-lg appearance-none disabled:opacity-30"
                    />

                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider mr-1">Presets:</span>
                      {PRESET_LENGTHS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          disabled={pro}
                          onClick={() => setRandOpts((p) => ({ ...p, length: preset }))}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                            randOpts.length === preset
                              ? "bg-neutral-100 text-neutral-900 font-bold"
                              : "bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pronounceable Toggle */}
                  <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[12px] text-neutral-200 font-medium">Pronounceable Passwords</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">Vowel & consonant alternation · easier to memorize</p>
                    </div>
                    <Toggle on={pro} onToggle={() => setRandOpts((p) => ({ ...p, pronounceable: !p.pronounceable }))} />
                  </div>

                  {/* Character Sets Table */}
                  <div className={`transition-opacity duration-150 ${pro ? "opacity-25 pointer-events-none" : ""}`}>
                    <div className="px-5 pt-3.5 pb-1 flex items-center justify-between border-b border-neutral-900">
                      <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold">Character Sets</span>
                      <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold">Guaranteed Min</span>
                    </div>

                    <div className="divide-y divide-neutral-900">
                      {CHARSET_DEFS.map((cs) => {
                        const enabled = randOpts[cs.key];
                        const minVal  = cs.hasMin && cs.minKey
                          ? (randOpts[cs.minKey as keyof RandomOptions] as number)
                          : 0;
                        return (
                          <div
                            key={cs.key}
                            className="px-5 py-3 flex items-center justify-between hover:bg-neutral-900/40 transition-colors"
                          >
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => setRandOpts((p) => ({ ...p, [cs.key]: !p[cs.key] }))}
                                className="w-4 h-4 accent-neutral-100 rounded cursor-pointer"
                              />
                              <div>
                                <span className={`text-[12.5px] font-medium ${cs.color}`}>{cs.label}</span>
                                <span className="text-[11px] font-mono text-neutral-600 ml-2">{cs.example}</span>
                              </div>
                            </label>

                            {cs.hasMin && cs.minKey ? (
                              <MinSpinner
                                value={minVal}
                                disabled={!enabled}
                                onChange={(v) => setRandOpts((p) => ({ ...p, [cs.minKey!]: v }))}
                              />
                            ) : (
                              <span className="text-[11px] text-neutral-700">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* ── PASSPHRASE MODE OPTIONS ────────────────────────────────────── */}
              {mode === "passphrase" && (
                <div className="p-5 space-y-4">
                  {/* Word count slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-neutral-300">Word Count</span>
                      <span className="text-[14px] font-mono font-bold text-neutral-100">
                        {ppOpts.wordCount} <span className="text-[11px] font-normal text-neutral-500">words</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={8}
                      value={ppOpts.wordCount}
                      onChange={(e) => setPpOpts((p) => ({ ...p, wordCount: +e.target.value }))}
                      className="w-full accent-white cursor-pointer h-1.5 bg-neutral-800 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Word Separator */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[12px] font-semibold text-neutral-300">Word Separator</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {SEPARATORS.map((sep) => (
                        <button
                          key={sep.v}
                          type="button"
                          onClick={() => setPpOpts((p) => ({ ...p, separator: sep.v }))}
                          className={`py-1.5 text-center text-[11px] rounded-lg border font-mono transition-colors cursor-pointer ${
                            ppOpts.separator === sep.v
                              ? "bg-neutral-100 text-neutral-900 border-neutral-100 font-bold"
                              : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                          }`}
                        >
                          {sep.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Capitalize Toggle */}
                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] text-neutral-200 font-medium">Capitalize Words</p>
                      <p className="text-[11px] text-neutral-500">First letter uppercase for each word</p>
                    </div>
                    <Toggle
                      on={ppOpts.capitalize}
                      onToggle={() => setPpOpts((p) => ({ ...p, capitalize: !p.capitalize }))}
                    />
                  </div>
                </div>
              )}

              {/* ── PIN CODE MODE OPTIONS ──────────────────────────────────────── */}
              {mode === "pin" && (
                <div className="p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-neutral-300">PIN Length</span>
                      <span className="text-[14px] font-mono font-bold text-neutral-100">
                        {pinOpts.length} <span className="text-[11px] font-normal text-neutral-500">digits</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={12}
                      value={pinOpts.length}
                      onChange={(e) => setPinOpts({ length: +e.target.value })}
                      className="w-full accent-white cursor-pointer h-1.5 bg-neutral-800 rounded-lg appearance-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {[4, 6, 8, 10, 12].map((len) => (
                      <button
                        key={len}
                        type="button"
                        onClick={() => setPinOpts({ length: len })}
                        className={`flex-1 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                          pinOpts.length === len
                            ? "bg-neutral-100 text-neutral-900 font-bold"
                            : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {len} Digits
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── PATTERN MODE OPTIONS ───────────────────────────────────────── */}
              {mode === "pattern" && (
                <div className="p-5 space-y-4">
                  <div className="space-y-2">
                    <span className="text-[12px] font-semibold text-neutral-300">Pattern Template</span>
                    <input
                      type="text"
                      value={patOpts.pattern}
                      onChange={(e) => setPatOpts({ pattern: e.target.value })}
                      placeholder="ULL-ddd-SS"
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-200 font-mono outline-none focus:border-neutral-600 transition-colors"
                    />
                  </div>

                  {/* Pattern Legend */}
                  <div className="pt-2">
                    <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold mb-2">Pattern Tokens</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {[
                        ["L", "lowercase (a-z)", "text-neutral-300 bg-neutral-800/40"],
                        ["U", "uppercase (A-Z)", "text-sky-400 bg-sky-950/40"],
                        ["d", "digit (0-9)", "text-amber-400 bg-amber-950/40"],
                        ["S", "symbol (!@#)", "text-rose-400 bg-rose-950/40"],
                        ["*", "any random", "text-purple-400 bg-purple-950/40"],
                        ["- / _", "literal text", "text-neutral-500 bg-neutral-900"],
                      ].map(([ch, desc, style]) => (
                        <div key={ch} className="flex items-center gap-2 p-1.5 rounded-md bg-neutral-900/60 border border-neutral-800/60">
                          <code className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${style}`}>{ch}</code>
                          <span className="text-neutral-400">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Right Panel: Live Session History & Vault Actions ─────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950/40">

        {/* History Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[var(--border)] bg-neutral-950/60 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-neutral-400" />
            <div>
              <h2 className="text-[14px] font-semibold text-neutral-200">Session History</h2>
              <p className="text-[11px] text-neutral-500">
                Generated in this active session · cleared on vault lock or logout
              </p>
            </div>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-[11px] text-neutral-500 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-neutral-900"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* History List Container */}
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4 opacity-70">
              <div className="w-28 h-28">
                <Image
                  src="/illustrations/secure-password_9qv4.svg"
                  alt="Vaultr Password Generator"
                  width={112}
                  height={112}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="max-w-xs">
                <p className="text-[13px] text-neutral-400 font-semibold">No passwords generated yet</p>
                <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">
                  Generated credentials will be listed here with 1-click copy and direct &ldquo;Save to Vault&rdquo; actions.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {history.map((h) => (
                <HistoryRow key={h.id} entry={h} onUseInVault={handleUseInVault} />
              ))}
            </div>
          )}
        </div>

        {/* Footer info pill */}
        {history.length > 0 && (
          <div className="px-6 py-3 border-t border-[var(--border)] bg-neutral-950 shrink-0 flex items-center justify-between text-[11px] text-neutral-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Zero-Knowledge Generation</span>
              </span>
              <span className="text-neutral-700">·</span>
              <span>{history.length} generated</span>
            </div>
            <span className="font-mono text-[10px] text-neutral-600">VaultR 2026</span>
          </div>
        )}
      </div>

      {/* ── Direct New Vault Entry Modal Portal ─────────────────────────────────── */}
      {newEntryOpen && (
        <NewEntryDialog
          open={newEntryOpen}
          folders={folders}
          defaultTemplate="login"
          initialData={{
            name: "",
            template: "login",
            payload: { password: targetPassword },
          }}
          onSave={handleSaveToVault}
          onClose={() => setNewEntryOpen(false)}
        />
      )}

    </div>
  );
}

"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { Copy, Check, RefreshCw, Zap } from "lucide-react";
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: number;
  value: string;
  mode: string;
  strength: StrengthResult;
}

// ── Character coloring ────────────────────────────────────────────────────────

type CharClass = "lower" | "upper" | "digit" | "symbol";

function classifyChar(c: string): CharClass {
  if (/[a-z]/.test(c)) return "lower";
  if (/[A-Z]/.test(c)) return "upper";
  if (/[0-9]/.test(c)) return "digit";
  return "symbol";
}

const CHAR_COLOR: Record<CharClass, string> = {
  lower:  "text-neutral-300",
  upper:  "text-sky-400",
  digit:  "text-amber-400",
  symbol: "text-rose-400",
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

/** Renders each character with its type color */
function ColorizedOutput({ value, mode, size }: { value: string; mode: GeneratorMode; size?: "sm" }) {
  if (!value) return <span className="text-neutral-700">—</span>;
  if (mode === "pin") {
    return (
      <span className={`text-amber-400 tracking-[0.3em] ${size === "sm" ? "text-base" : "text-3xl"} font-mono`}>
        {value}
      </span>
    );
  }
  if (mode === "passphrase") {
    return (
      <span className={`text-sky-300 ${size === "sm" ? "text-[13px]" : "text-xl"} font-mono`}>
        {value}
      </span>
    );
  }
  return (
    <span className={`font-mono ${size === "sm" ? "text-[12px]" : value.length > 24 ? "text-base" : "text-xl"} break-all`}>
      {value.split("").map((c, i) => (
        <span key={i} className={CHAR_COLOR[classifyChar(c)]}>
          {c}
        </span>
      ))}
    </span>
  );
}

/** Color legend chips */
function ColorLegend() {
  const items = [
    { label: "Lowercase", color: "text-neutral-300", dot: "bg-neutral-400" },
    { label: "Uppercase", color: "text-sky-400",     dot: "bg-sky-400" },
    { label: "Digits",    color: "text-amber-400",   dot: "bg-amber-400" },
    { label: "Symbols",   color: "text-rose-400",    dot: "bg-rose-400" },
  ];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${it.dot}`} />
          <span className={`text-[10px] ${it.color}`}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Strength bar + label */
function StrengthBar({ r }: { r: StrengthResult }) {
  if (!r.label) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[3px] flex-1 rounded-full transition-all duration-400"
            style={{ background: i <= r.score ? r.color : "#1f1f1f" }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold" style={{ color: r.color }}>
          {r.label}
        </span>
        <span className="text-neutral-700 text-[11px]">·</span>
        <span className="text-[11px] text-neutral-500">
          {r.entropy} bits
        </span>
        <span className="text-neutral-700 text-[11px]">·</span>
        <span className="text-[11px] text-neutral-500">
          cracks in <span className="text-neutral-300">{r.crackTime}</span> @ 10B/s
        </span>
      </div>
    </div>
  );
}

/** Char breakdown row */
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
    <div className="flex items-center gap-3 text-[11px]">
      {counts.lower  > 0 && <span className="text-neutral-500">{counts.lower}<span className="text-neutral-700 ml-0.5">a–z</span></span>}
      {counts.upper  > 0 && <span className="text-sky-500">{counts.upper}<span className="text-sky-800 ml-0.5">A–Z</span></span>}
      {counts.digit  > 0 && <span className="text-amber-500">{counts.digit}<span className="text-amber-800 ml-0.5">0–9</span></span>}
      {counts.symbol > 0 && <span className="text-rose-500">{counts.symbol}<span className="text-rose-800 ml-0.5">!@#</span></span>}
    </div>
  );
}

/** Toggle switch */
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

/** Min count spinner */
function MinSpinner({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <div className={`flex items-center gap-1.5 ${disabled ? "opacity-20 pointer-events-none" : ""}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer text-xs select-none"
      >−</button>
      <span className="text-[12px] text-neutral-200 w-4 text-center tabular-nums select-none">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(8, value + 1))}
        className="w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer text-xs select-none"
      >+</button>
    </div>
  );
}

/** History entry row */
function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { copied, copy } = useClipboard();
  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-neutral-900/60 transition-colors border-b border-[var(--border)] last:border-0">
      {/* Strength dot */}
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 mt-[1px]"
        style={{ background: entry.strength.color || "#333" }}
        title={entry.strength.label}
      />
      <div className="flex-1 min-w-0">
        <ColorizedOutput value={entry.value} mode={entry.mode as GeneratorMode} size="sm" />
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-neutral-700 capitalize">{entry.mode}</span>
          {entry.strength.label && (
            <>
              <span className="text-neutral-800 text-[10px]">·</span>
              <span className="text-[10px]" style={{ color: entry.strength.color }}>{entry.strength.label}</span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => copy(entry.value)}
        title="Copy"
        className="shrink-0 opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-200 transition-all cursor-pointer p-1"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { id: GeneratorMode; label: string }[] = [
  { id: "random",     label: "Random" },
  { id: "passphrase", label: "Passphrase" },
  { id: "pin",        label: "PIN" },
  { id: "pattern",    label: "Pattern" },
];

const SEPARATORS = [
  { v: "-", label: "—" },
  { v: ".", label: "." },
  { v: "_", label: "_" },
  { v: " ", label: "space" },
  { v: "", label: "none" },
];

const CHARSET_DEFS = [
  { key: "useLower"  as const, label: "Lowercase", example: "abcde…", color: "text-neutral-400", hasMin: false, minKey: null },
  { key: "useUpper"  as const, label: "Uppercase", example: "ABCDE…", color: "text-sky-400",     hasMin: true,  minKey: "minUpper"   as const },
  { key: "useDigits" as const, label: "Digits",    example: "01234…", color: "text-amber-400",   hasMin: true,  minKey: "minDigits"  as const },
  { key: "useSymbols"as const, label: "Symbols",   example: "!@#$…",  color: "text-rose-400",    hasMin: true,  minKey: "minSymbols" as const },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function GeneratorPage() {
  const [mode, setMode] = useState<GeneratorMode>("random");
  const { copied, copy } = useClipboard();

  const [randOpts, setRandOpts] = useState<RandomOptions>({
    length: 20,
    useLower: true, useUpper: true, useDigits: true, useSymbols: true,
    pronounceable: false,
    minUpper: 1, minDigits: 1, minSymbols: 1,
    exclude: "",
  });
  const [ppOpts,  setPpOpts]  = useState<PassphraseOptions>({ wordCount: 4, separator: "-", capitalize: true });
  const [pinOpts, setPinOpts] = useState<PinOptions>({ length: 6 });
  const [patOpts, setPatOpts] = useState<PatternOptions>({ pattern: "ULL-ddd-SS" });

  const [output,   setOutput]   = useState("");
  const [strength, setStrength] = useState<StrengthResult>({ score: 0, label: "", color: "", crackTime: "", entropy: 0 });
  const [history,  setHistory]  = useState<HistoryEntry[]>([]);
  const uidRef = useRef(0);

  const generate = useCallback(() => {
    let pw = "";
    switch (mode) {
      case "random":     pw = generateRandom(randOpts);   break;
      case "passphrase": pw = generatePassphrase(ppOpts); break;
      case "pin":        pw = generatePin(pinOpts);       break;
      case "pattern":    pw = generatePattern(patOpts);   break;
    }
    const str = scorePassword(pw);
    setOutput(pw);
    setStrength(str);
    setHistory((prev) => [{ id: ++uidRef.current, value: pw, mode, strength: str }, ...prev.slice(0, 11)]);
  }, [mode, randOpts, ppOpts, pinOpts, patOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstRun = useRef(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (firstRun.current) { firstRun.current = false; generate(); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    generate();
  }, [mode, randOpts, ppOpts, pinOpts, patOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  const pro = randOpts.pronounceable;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel: controls ──────────────────────────────────────────────── */}
      <div className="w-[500px] shrink-0 border-r border-[var(--border)] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-neutral-100">Password Generator</h2>
              <p className="text-[11px] text-neutral-600 mt-0.5">Cryptographically secure · runs entirely in your browser</p>
            </div>
            <Zap className="w-4 h-4 text-neutral-700 shrink-0" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">

            {/* Mode tabs */}
            <div className="flex gap-0.5 p-0.5 border border-[var(--border)] rounded-lg bg-neutral-950">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMode(t.id)}
                  className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                    mode === t.id
                      ? "bg-neutral-800 text-neutral-100 shadow-sm"
                      : "text-neutral-600 hover:text-neutral-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Output card */}
            <div className="border border-[var(--border)] rounded-lg bg-neutral-950 overflow-hidden">
              {/* Password display */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start gap-2 min-h-[44px]">
                  <div className="flex-1 min-w-0 select-all cursor-text leading-relaxed">
                    <ColorizedOutput value={output} mode={mode} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => copy(output)}
                      disabled={!output}
                      title="Copy to clipboard"
                      className="p-1.5 text-neutral-600 hover:text-neutral-200 transition-colors cursor-pointer disabled:opacity-30 rounded hover:bg-neutral-800"
                    >
                      {copied
                        ? <Check className="w-4 h-4 text-emerald-400" />
                        : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={generate}
                      title="Regenerate"
                      className="p-1.5 text-neutral-600 hover:text-neutral-200 transition-colors cursor-pointer rounded hover:bg-neutral-800"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Char breakdown */}
                {mode === "random" && <CharBreakdown value={output} />}
              </div>

              {/* Strength */}
              <div className="border-t border-[var(--border)] px-4 py-3">
                <StrengthBar r={strength} />
              </div>

              {/* Color legend (random only) */}
              {mode === "random" && (
                <div className="border-t border-[var(--border)] px-4 py-2.5">
                  <ColorLegend />
                </div>
              )}
            </div>

            {/* Options card */}
            <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)] overflow-hidden">

              {/* ── RANDOM ─────────────────────────────────────────────────── */}
              {mode === "random" && (
                <>
                  {/* Length slider */}
                  <div className="px-4 py-3 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-neutral-500 w-16 shrink-0">Length</span>
                      <input
                        type="range" min={6} max={64} value={randOpts.length}
                        onChange={(e) => setRandOpts((p) => ({ ...p, length: +e.target.value }))}
                        disabled={pro}
                        className="flex-1 accent-white cursor-pointer h-1 disabled:opacity-30"
                      />
                      <span className="text-[13px] font-mono text-neutral-200 tabular-nums w-7 text-right shrink-0">
                        {randOpts.length}
                      </span>
                    </div>
                  </div>

                  {/* Pronounceable */}
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[12px] text-neutral-200 font-medium">Pronounceable</p>
                      <p className="text-[10px] text-neutral-600 mt-0.5">Vowel/consonant alternation · disables charset controls</p>
                    </div>
                    <Toggle on={pro} onToggle={() => setRandOpts((p) => ({ ...p, pronounceable: !p.pronounceable }))} />
                  </div>

                  {/* Charset table */}
                  <div className={`transition-opacity duration-150 ${pro ? "opacity-25 pointer-events-none" : ""}`}>
                    <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-neutral-700">Character sets</span>
                      <span className="text-[10px] uppercase tracking-widest text-neutral-700">Guarantee min</span>
                    </div>
                    <table className="w-full border-collapse">
                      <tbody>
                        {CHARSET_DEFS.map((cs) => {
                          const enabled = randOpts[cs.key];
                          const minVal  = cs.hasMin && cs.minKey
                            ? (randOpts[cs.minKey as keyof RandomOptions] as number)
                            : 0;
                          return (
                            <tr key={cs.key} className="border-b border-[var(--border)] last:border-0 group/row hover:bg-neutral-900/40 transition-colors">
                              <td className="pl-4 py-2.5 w-6">
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={() => setRandOpts((p) => ({ ...p, [cs.key]: !p[cs.key] }))}
                                  className="accent-white cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className={`text-[12px] font-medium ${cs.color}`}>{cs.label}</span>
                              </td>
                              <td className="py-2.5 pr-4">
                                <span className={`text-[11px] font-mono ${cs.color} opacity-50`}>{cs.example}</span>
                              </td>
                              <td className="py-2.5 pr-4 text-right">
                                {cs.hasMin && cs.minKey ? (
                                  <MinSpinner
                                    value={minVal}
                                    disabled={!enabled}
                                    onChange={(v) => setRandOpts((p) => ({ ...p, [cs.minKey!]: v }))}
                                  />
                                ) : (
                                  <span className="text-[11px] text-neutral-800 pr-1">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Exclude */}
                  <div className={`px-4 py-3 border-t border-[var(--border)] flex items-center gap-3 ${pro ? "opacity-25 pointer-events-none" : ""}`}>
                    <span className="text-[11px] text-neutral-500 w-16 shrink-0">Exclude</span>
                    <input
                      type="text"
                      value={randOpts.exclude}
                      onChange={(e) => setRandOpts((p) => ({ ...p, exclude: e.target.value }))}
                      placeholder="e.g. 0 O l I 1"
                      className="flex-1 bg-transparent text-[12px] text-neutral-300 font-mono placeholder-neutral-800 outline-none border-b border-[var(--border)] focus:border-neutral-600 pb-0.5 transition-colors"
                    />
                  </div>
                </>
              )}

              {/* ── PASSPHRASE ─────────────────────────────────────────────── */}
              {mode === "passphrase" && (
                <>
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
                    <span className="text-[11px] text-neutral-500 w-16 shrink-0">Words</span>
                    <input
                      type="range" min={3} max={8} value={ppOpts.wordCount}
                      onChange={(e) => setPpOpts((p) => ({ ...p, wordCount: +e.target.value }))}
                      className="flex-1 accent-white cursor-pointer h-1"
                    />
                    <span className="text-[13px] font-mono text-neutral-200 tabular-nums w-4 text-right shrink-0">
                      {ppOpts.wordCount}
                    </span>
                  </div>

                  <div className="px-4 py-3 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[11px] text-neutral-500 w-16 shrink-0">Separator</span>
                      <div className="flex gap-1.5">
                        {SEPARATORS.map((s) => (
                          <button
                            key={`sep-${s.label}`}
                            type="button"
                            onClick={() => setPpOpts((p) => ({ ...p, separator: s.v }))}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                              ppOpts.separator === s.v
                                ? "border-sky-600 bg-sky-950 text-sky-300"
                                : "border-[var(--border)] text-neutral-600 hover:text-neutral-300 hover:border-neutral-600"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] text-neutral-200 font-medium">Capitalize words</p>
                      <p className="text-[10px] text-neutral-600 mt-0.5">First letter of each word uppercased</p>
                    </div>
                    <Toggle on={ppOpts.capitalize} onToggle={() => setPpOpts((p) => ({ ...p, capitalize: !p.capitalize }))} />
                  </div>
                </>
              )}

              {/* ── PIN ─────────────────────────────────────────────────────── */}
              {mode === "pin" && (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-neutral-500 w-16 shrink-0">Digits</span>
                    <input
                      type="range" min={4} max={12} value={pinOpts.length}
                      onChange={(e) => setPinOpts({ length: +e.target.value })}
                      className="flex-1 accent-white cursor-pointer h-1"
                    />
                    <span className="text-[13px] font-mono text-neutral-200 tabular-nums w-4 text-right shrink-0">
                      {pinOpts.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-700 mt-3">
                    Numeric digits only · for device PINs and short codes
                  </p>
                </div>
              )}

              {/* ── PATTERN ─────────────────────────────────────────────────── */}
              {mode === "pattern" && (
                <>
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
                    <span className="text-[11px] text-neutral-500 w-16 shrink-0">Pattern</span>
                    <input
                      type="text"
                      value={patOpts.pattern}
                      onChange={(e) => setPatOpts({ pattern: e.target.value })}
                      placeholder="ULL-ddd-SS"
                      className="flex-1 bg-transparent text-[13px] text-neutral-200 font-mono placeholder-neutral-700 outline-none border-b border-[var(--border)] focus:border-neutral-600 pb-0.5 transition-colors"
                    />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-neutral-700 mb-2">Legend</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      {(
                        [
                          ["L", "lowercase letter",  "text-neutral-400"],
                          ["U", "uppercase letter",  "text-sky-400"],
                          ["d", "digit 0–9",         "text-amber-400"],
                          ["S", "symbol !@#…",       "text-rose-400"],
                          ["*", "any random char",   "text-purple-400"],
                          ["other", "literal char",  "text-neutral-600"],
                        ] as [string, string, string][]
                      ).map(([ch, desc, color], li) => (
                        <div key={`legend-${li}`} className="flex items-center gap-2 py-0.5">
                          <code className={`text-[12px] font-mono w-8 shrink-0 font-bold ${color}`}>{ch}</code>
                          <span className="text-[11px] text-neutral-600">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Generate button */}
            <button
              type="button"
              onClick={generate}
              className="w-full py-2.5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 text-[12px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Generate new
            </button>
          </div>
        </div>
      </div>

      {/* ── Right panel: session history ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* History header */}
        <div className="px-6 pt-5 pb-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-neutral-400">Session history</h3>
              <p className="text-[10px] text-neutral-700 mt-0.5">
                Shown only during this session · never written to disk or server
              </p>
            </div>
            {history.length > 0 && (
              <span className="text-[10px] text-neutral-700 tabular-nums">{history.length} generated</span>
            )}
          </div>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4 opacity-60">
              <div className="w-24 h-24 sm:w-28 sm:h-28">
                <Image
                  src="/illustrations/secure-password_9qv4.svg"
                  alt=""
                  width={112}
                  height={112}
                  className="object-contain w-full h-full"
                />
              </div>
              <div>
                <p className="text-[12px] text-neutral-500 font-medium">No passwords generated yet.</p>
                <p className="text-[11px] text-neutral-700 mt-1">
                  Click Generate and your passwords will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="border-b border-[var(--border)]">
              {history.map((h) => (
                <HistoryRow key={h.id} entry={h} />
              ))}
            </div>
          )}
        </div>

        {/* Footer legend */}
        {history.length > 0 && (
          <div className="px-6 py-3 border-t border-[var(--border)] shrink-0">
            <div className="flex items-center gap-4">
              {[
                { color: "#ef4444", label: "Weak" },
                { color: "#f97316", label: "Fair" },
                { color: "#22c55e", label: "Strong" },
                { color: "#10b981", label: "Very strong" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[10px] text-neutral-600">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

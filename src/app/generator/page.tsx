"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Copy, Check, RefreshCw, Zap, ChevronDown } from "lucide-react";
import {
  generateRandom, generatePassphrase, generatePin, generatePattern,
  scorePassword,
  type GeneratorMode, type RandomOptions, type PassphraseOptions,
  type PinOptions, type PatternOptions, type StrengthResult,
} from "@/lib/generator";

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ value, large }: { value: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      disabled={!value}
      title="Copy to clipboard"
      className={`flex items-center gap-1.5 text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer disabled:opacity-30 ${large ? "p-2" : "p-1"}`}
    >
      {copied
        ? <Check className={large ? "w-4 h-4 text-emerald-400" : "w-3.5 h-3.5 text-emerald-400"} />
        : <Copy className={large ? "w-4 h-4" : "w-3.5 h-3.5"} />}
    </button>
  );
}

// ── Strength bar ──────────────────────────────────────────────────────────────
function StrengthBar({ result }: { result: StrengthResult }) {
  if (!result.label) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= result.score ? result.color : "#1a1a1a" }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: result.color }}>
          {result.label}
        </span>
        <span className="text-[11px] text-neutral-600">
          ~{result.entropy} bits · cracks in{" "}
          <span className="text-neutral-400">{result.crackTime}</span>
          {" "}@ 10B/s
        </span>
      </div>
    </div>
  );
}

// ── Toggle chip ───────────────────────────────────────────────────────────────
function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-[12px] border transition-colors cursor-pointer ${
        active
          ? "border-neutral-500 bg-neutral-800 text-neutral-100"
          : "border-[var(--border)] text-neutral-600 hover:text-neutral-400 hover:border-neutral-700"
      }`}
    >
      {label}
    </button>
  );
}

// ── Number spinner ────────────────────────────────────────────────────────────
function Spinner({
  value, min, max, onChange, label,
}: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-neutral-400">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-6 h-6 rounded border border-[var(--border)] flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer text-[14px] leading-none"
        >−</button>
        <span className="text-[13px] text-neutral-200 w-6 text-center tabular-nums">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-6 h-6 rounded border border-[var(--border)] flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer text-[14px] leading-none"
        >+</button>
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-neutral-600">{children}</p>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="h-px bg-[var(--border)]" />;
}

// ── History entry ─────────────────────────────────────────────────────────────
interface HistoryEntry { value: string; mode: string; ts: number }

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function GeneratorPage() {
  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<GeneratorMode>("random");

  // ── Random options ────────────────────────────────────────────────────────
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

  // ── Passphrase options ────────────────────────────────────────────────────
  const [ppOpts, setPpOpts] = useState<PassphraseOptions>({
    wordCount: 4,
    separator: "-",
    capitalize: true,
  });

  // ── PIN options ───────────────────────────────────────────────────────────
  const [pinOpts, setPinOpts] = useState<PinOptions>({ length: 6 });

  // ── Pattern options ───────────────────────────────────────────────────────
  const [patOpts, setPatOpts] = useState<PatternOptions>({ pattern: "ULL-ddd-SS" });

  // ── Output + history ──────────────────────────────────────────────────────
  const [output, setOutput] = useState("");
  const [strength, setStrength] = useState<StrengthResult>({
    score: 0, label: "", color: "", crackTime: "", entropy: 0,
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // ── Generate ──────────────────────────────────────────────────────────────
  const generate = useCallback(() => {
    let pw = "";
    switch (mode) {
      case "random":     pw = generateRandom(randOpts); break;
      case "passphrase": pw = generatePassphrase(ppOpts); break;
      case "pin":        pw = generatePin(pinOpts); break;
      case "pattern":    pw = generatePattern(patOpts); break;
    }
    setOutput(pw);
    setStrength(scorePassword(pw));
    setHistory(prev => [
      { value: pw, mode, ts: Date.now() },
      ...prev.slice(0, 4),
    ]);
  }, [mode, randOpts, ppOpts, pinOpts, patOpts]);

  // Auto-generate on mount and option changes
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; generate(); return; }
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, randOpts, ppOpts, pinOpts, patOpts]);

  const MODES: { id: GeneratorMode; label: string }[] = [
    { id: "random",     label: "Random" },
    { id: "passphrase", label: "Passphrase" },
    { id: "pin",        label: "PIN" },
    { id: "pattern",    label: "Pattern" },
  ];

  const SEPARATORS = [
    { label: "Dash  —", value: "-" },
    { label: "Dot  .", value: "." },
    { label: "Under  _", value: "_" },
    { label: "Space", value: " " },
    { label: "None", value: "" },
  ];

  return (
    <div className="min-h-screen">
      <main className="max-w-xl mx-auto px-5 py-10 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-base font-semibold text-neutral-100">Password Generator</h1>
          <p className="text-[12px] text-neutral-600 mt-0.5">
            Cryptographically secure · generated entirely in your browser
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 border border-[var(--border)] rounded-lg bg-neutral-950">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 py-1.5 text-[12px] font-medium rounded-md transition-all cursor-pointer ${
                mode === m.id
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-600 hover:text-neutral-400"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Output display */}
        <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className={`flex-1 font-mono break-all text-neutral-100 select-all leading-relaxed ${
              mode === "pin" ? "text-2xl tracking-widest" :
              output.length > 28 ? "text-[13px]" : "text-[15px]"
            }`}>
              {output || "—"}
            </p>
            <CopyButton value={output} large />
            <button
              onClick={generate}
              title="Regenerate"
              className="p-2 text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <StrengthBar result={strength} />
        </div>

        {/* Options */}
        <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)] divide-y divide-[var(--border)]">

          {/* ── RANDOM ─────────────────────────────────────────────────────── */}
          {mode === "random" && (
            <>
              <div className="p-4 space-y-4">
                <Label>Length · {randOpts.length}</Label>
                <input
                  type="range" min={6} max={64} value={randOpts.length}
                  onChange={e => setRandOpts(p => ({ ...p, length: +e.target.value }))}
                  className="w-full accent-white cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-neutral-700">
                  <span>6</span><span>64</span>
                </div>
              </div>
              <Divider />
              <div className="p-4 space-y-3">
                <Label>Character sets</Label>
                <div className="flex flex-wrap gap-2">
                  <Chip label="a–z" active={randOpts.useLower}   onClick={() => setRandOpts(p => ({ ...p, useLower:   !p.useLower }))} />
                  <Chip label="A–Z" active={randOpts.useUpper}   onClick={() => setRandOpts(p => ({ ...p, useUpper:   !p.useUpper }))} />
                  <Chip label="0–9" active={randOpts.useDigits}  onClick={() => setRandOpts(p => ({ ...p, useDigits:  !p.useDigits }))} />
                  <Chip label="!@#" active={randOpts.useSymbols} onClick={() => setRandOpts(p => ({ ...p, useSymbols: !p.useSymbols }))} />
                  <Chip label="Pronounceable" active={randOpts.pronounceable} onClick={() => setRandOpts(p => ({ ...p, pronounceable: !p.pronounceable }))} />
                </div>
              </div>
              <Divider />
              <div className="p-4 space-y-3">
                <Label>Minimums</Label>
                <Spinner label="Uppercase" value={randOpts.minUpper}   min={0} max={5} onChange={v => setRandOpts(p => ({ ...p, minUpper: v }))} />
                <Spinner label="Digits"    value={randOpts.minDigits}  min={0} max={5} onChange={v => setRandOpts(p => ({ ...p, minDigits: v }))} />
                <Spinner label="Symbols"   value={randOpts.minSymbols} min={0} max={5} onChange={v => setRandOpts(p => ({ ...p, minSymbols: v }))} />
              </div>
              <Divider />
              <div className="p-4 space-y-2">
                <Label>Exclude characters</Label>
                <input
                  type="text"
                  value={randOpts.exclude}
                  onChange={e => setRandOpts(p => ({ ...p, exclude: e.target.value }))}
                  placeholder="e.g.  0 O l 1 I"
                  className="w-full bg-transparent border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-neutral-200 placeholder-neutral-700 focus:outline-none focus:border-neutral-600 transition-colors font-mono"
                />
                <p className="text-[11px] text-neutral-700">Characters in this field are excluded from generation.</p>
              </div>
            </>
          )}

          {/* ── PASSPHRASE ──────────────────────────────────────────────────── */}
          {mode === "passphrase" && (
            <>
              <div className="p-4 space-y-2">
                <Spinner label="Words" value={ppOpts.wordCount} min={3} max={8} onChange={v => setPpOpts(p => ({ ...p, wordCount: v }))} />
              </div>
              <Divider />
              <div className="p-4 space-y-2">
                <Label>Separator</Label>
                <div className="flex flex-wrap gap-2">
                  {SEPARATORS.map(s => (
                    <Chip key={s.label} label={s.label} active={ppOpts.separator === s.value} onClick={() => setPpOpts(p => ({ ...p, separator: s.value }))} />
                  ))}
                </div>
              </div>
              <Divider />
              <div className="p-4">
                <Chip label="Capitalize words" active={ppOpts.capitalize} onClick={() => setPpOpts(p => ({ ...p, capitalize: !p.capitalize }))} />
              </div>
            </>
          )}

          {/* ── PIN ─────────────────────────────────────────────────────────── */}
          {mode === "pin" && (
            <div className="p-4">
              <Spinner label="Digits" value={pinOpts.length} min={4} max={12} onChange={v => setPinOpts({ length: v })} />
            </div>
          )}

          {/* ── PATTERN ─────────────────────────────────────────────────────── */}
          {mode === "pattern" && (
            <div className="p-4 space-y-3">
              <Label>Pattern string</Label>
              <input
                type="text"
                value={patOpts.pattern}
                onChange={e => setPatOpts({ pattern: e.target.value })}
                placeholder="e.g. ULL-ddd-SS"
                className="w-full bg-transparent border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-neutral-200 placeholder-neutral-700 focus:outline-none focus:border-neutral-600 transition-colors font-mono"
              />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-neutral-600">
                {[
                  ["L", "lowercase letter"],
                  ["U", "uppercase letter"],
                  ["d", "digit 0–9"],
                  ["S", "symbol !@#…"],
                  ["*", "letter, digit or symbol"],
                  ["any other", "literal character"],
                ].map(([ch, desc]) => (
                  <div key={ch} className="flex gap-2">
                    <code className="text-neutral-400 w-10 shrink-0">{ch}</code>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium transition-colors cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5" />
          Generate
        </button>

        {/* Session history */}
        {history.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? "rotate-180" : ""}`} />
              Session history ({history.length})
            </button>
            {showHistory && (
              <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)] divide-y divide-[var(--border)]">
                {history.map((h) => (
                  <div key={h.ts} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-neutral-300 font-mono truncate">{h.value}</p>
                      <p className="text-[10px] text-neutral-700 capitalize mt-0.5">{h.mode}</p>
                    </div>
                    <CopyButton value={h.value} />
                  </div>
                ))}
                <div className="px-4 py-2 text-[10px] text-neutral-700">
                  Session only — history is never saved or stored.
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

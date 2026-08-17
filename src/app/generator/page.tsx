"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, Zap, ChevronDown, ChevronLeft, Shield, ArrowRight } from "lucide-react";
import {
  generateRandom, generatePassphrase, generatePin, generatePattern,
  scorePassword,
  type GeneratorMode, type RandomOptions, type PassphraseOptions,
  type PinOptions, type PatternOptions, type StrengthResult,
} from "@/lib/generator";
import { useAuth } from "@/hooks/useAuth";

// ── Character Styling ─────────────────────────────────────────────────────────

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

function ColorizedOutput({ value, mode }: { value: string; mode: GeneratorMode }) {
  if (!value) return <span className="text-neutral-700 font-mono">—</span>;

  if (mode === "pin") {
    return (
      <span className="font-mono font-bold tracking-[0.22em] text-amber-400 select-all text-xl sm:text-2xl">
        {value}
      </span>
    );
  }

  if (mode === "passphrase") {
    const words = value.split(/([\-\._\s])/);
    return (
      <span className="font-mono break-all select-all leading-relaxed text-base sm:text-lg">
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
    <span className="font-mono break-all select-all leading-relaxed tracking-wider text-base sm:text-lg">
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
        <span className="text-[13px] text-neutral-200 w-6 text-center tabular-nums font-mono">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-6 h-6 rounded border border-[var(--border)] flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer text-[14px] leading-none"
        >+</button>
      </div>
    </div>
  );
}

// ── History entry ─────────────────────────────────────────────────────────────
interface HistoryEntry { value: string; mode: string; ts: number }

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function StandaloneGeneratorPage() {
  const { user, isAuthLoading } = useAuth();
  const router = useRouter();

  // If logged in, seamlessly forward into Vault dashboard generator
  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace("/vault/generator");
    }
  }, [user, isAuthLoading, router]);

  const [mode, setMode] = useState<GeneratorMode>("random");

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

  const [ppOpts, setPpOpts] = useState<PassphraseOptions>({
    wordCount: 4,
    separator: "-",
    capitalize: true,
  });

  const [pinOpts, setPinOpts] = useState<PinOptions>({ length: 6 });
  const [patOpts, setPatOpts] = useState<PatternOptions>({ pattern: "ULL-ddd-SS" });

  const [password, setPassword] = useState("");
  const [strength, setStrength] = useState<StrengthResult>({ score: 0, label: "", color: "", crackTime: "", entropy: 0 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(() => {
    let pw = "";
    switch (mode) {
      case "random":     pw = generateRandom(randOpts); break;
      case "passphrase": pw = generatePassphrase(ppOpts); break;
      case "pin":        pw = generatePin(pinOpts); break;
      case "pattern":    pw = generatePattern(patOpts); break;
    }
    const str = scorePassword(pw);
    setPassword(pw);
    setStrength(str);
    setHistory(prev => [{ value: pw, mode, ts: Date.now() }, ...prev.slice(0, 9)]);
  }, [mode, randOpts, ppOpts, pinOpts, patOpts]);

  useEffect(() => {
    generate();
  }, [generate]);

  const copy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Top Navbar */}
      <nav className="border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-neutral-500 hover:text-neutral-200 transition-colors text-[13px] font-medium"
          >
            <ChevronLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/vault"
              className="text-[12px] font-semibold text-neutral-900 bg-neutral-100 hover:bg-white px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>Open Vault</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-5 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">Password Generator</h1>
            <p className="text-[12px] text-neutral-500 mt-0.5">
              Cryptographically secure · generated entirely in your browser
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-900 text-[11px] font-mono text-neutral-400">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>Zero-Knowledge</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 p-1 border border-[var(--border)] rounded-xl bg-neutral-950">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 py-1.5 text-[12px] font-medium rounded-lg transition-all cursor-pointer ${
                mode === m.id
                  ? "bg-neutral-800 text-neutral-100 font-semibold"
                  : "text-neutral-600 hover:text-neutral-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Password display card */}
        <div className="rounded-2xl border border-[var(--border)] bg-neutral-950 p-5 space-y-3 shadow-xl">
          <div className="flex items-start gap-3 min-h-[44px]">
            <div className="flex-1 min-w-0 select-all cursor-text">
              <ColorizedOutput value={password} mode={mode} />
            </div>
            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              <button
                type="button"
                onClick={copy}
                disabled={!password}
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
                title="Regenerate"
                className="p-2 text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Char breakdown */}
          {mode === "random" && <CharBreakdown value={password} />}

          <div className="border-t border-[var(--border)] pt-3">
            <StrengthBar result={strength} />
          </div>
        </div>

        {/* Options */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-5 shadow-sm">

          {/* ── Random ── */}
          {mode === "random" && (
            <>
              {/* Length slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-neutral-300 font-medium">Length</span>
                  <span className="text-[14px] font-mono text-neutral-200 font-bold">{randOpts.length}</span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={64}
                  value={randOpts.length}
                  onChange={e => setRandOpts(p => ({ ...p, length: +e.target.value }))}
                  className="w-full accent-white cursor-pointer h-1.5 bg-neutral-800 rounded-lg appearance-none"
                />
              </div>

              {/* Character types */}
              <div className="space-y-2">
                <span className="text-[12px] text-neutral-500 uppercase tracking-wider font-semibold">Include Characters</span>
                <div className="grid grid-cols-2 gap-2">
                  <Chip
                    label="Uppercase (A–Z)"
                    active={randOpts.useUpper}
                    onClick={() => setRandOpts(p => ({ ...p, useUpper: !p.useUpper }))}
                  />
                  <Chip
                    label="Lowercase (a–z)"
                    active={randOpts.useLower}
                    onClick={() => setRandOpts(p => ({ ...p, useLower: !p.useLower }))}
                  />
                  <Chip
                    label="Numbers (0–9)"
                    active={randOpts.useDigits}
                    onClick={() => setRandOpts(p => ({ ...p, useDigits: !p.useDigits }))}
                  />
                  <Chip
                    label="Symbols (!@#$%^&*)"
                    active={randOpts.useSymbols}
                    onClick={() => setRandOpts(p => ({ ...p, useSymbols: !p.useSymbols }))}
                  />
                </div>
              </div>

              {/* Minimum guarantees */}
              <div className="space-y-3 pt-1 border-t border-[var(--border)]">
                <span className="text-[12px] text-neutral-500 uppercase tracking-wider font-semibold">Minimum Guarantees</span>
                {randOpts.useUpper && (
                  <Spinner
                    label="Min uppercase"
                    value={randOpts.minUpper}
                    min={0}
                    max={5}
                    onChange={v => setRandOpts(p => ({ ...p, minUpper: v }))}
                  />
                )}
                {randOpts.useDigits && (
                  <Spinner
                    label="Min digits"
                    value={randOpts.minDigits}
                    min={0}
                    max={5}
                    onChange={v => setRandOpts(p => ({ ...p, minDigits: v }))}
                  />
                )}
                {randOpts.useSymbols && (
                  <Spinner
                    label="Min symbols"
                    value={randOpts.minSymbols}
                    min={0}
                    max={5}
                    onChange={v => setRandOpts(p => ({ ...p, minSymbols: v }))}
                  />
                )}
              </div>
            </>
          )}

          {/* ── Passphrase ── */}
          {mode === "passphrase" && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-neutral-300 font-medium">Word Count</span>
                  <span className="text-[14px] font-mono text-neutral-200 font-bold">{ppOpts.wordCount}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={8}
                  value={ppOpts.wordCount}
                  onChange={e => setPpOpts(p => ({ ...p, wordCount: +e.target.value }))}
                  className="w-full accent-white cursor-pointer h-1.5 bg-neutral-800 rounded-lg appearance-none"
                />
              </div>

              <div className="space-y-2">
                <span className="text-[12px] text-neutral-500 uppercase tracking-wider font-semibold">Separator</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {SEPARATORS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setPpOpts(p => ({ ...p, separator: s.value }))}
                      className={`py-1.5 text-center text-[11px] rounded-lg border font-mono transition-colors cursor-pointer ${
                        ppOpts.separator === s.value
                          ? "bg-neutral-100 text-neutral-900 border-neutral-100 font-bold"
                          : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Chip
                  label="Capitalize each word"
                  active={ppOpts.capitalize}
                  onClick={() => setPpOpts(p => ({ ...p, capitalize: !p.capitalize }))}
                />
              </div>
            </>
          )}

          {/* ── PIN ── */}
          {mode === "pin" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-neutral-300 font-medium">PIN Digits</span>
                  <span className="text-[14px] font-mono text-neutral-200 font-bold">{pinOpts.length}</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={12}
                  value={pinOpts.length}
                  onChange={e => setPinOpts({ length: +e.target.value })}
                  className="w-full accent-white cursor-pointer h-1.5 bg-neutral-800 rounded-lg appearance-none"
                />
              </div>
              <div className="flex items-center gap-2">
                {[4, 6, 8, 12].map(l => (
                  <button
                    key={l}
                    onClick={() => setPinOpts({ length: l })}
                    className={`flex-1 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      pinOpts.length === l
                        ? "bg-neutral-100 text-neutral-900 font-bold"
                        : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {l} Digits
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Pattern ── */}
          {mode === "pattern" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <span className="text-[13px] text-neutral-300 font-medium">Pattern</span>
                <input
                  type="text"
                  value={patOpts.pattern}
                  onChange={e => setPatOpts({ pattern: e.target.value })}
                  placeholder="ULL-ddd-SS"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-200 font-mono outline-none focus:border-neutral-600"
                />
              </div>
            </div>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-semibold transition-colors cursor-pointer shadow-lg shadow-neutral-950/30"
        >
          <Zap className="w-4 h-4" />
          Generate New Password
        </button>

      </main>
    </div>
  );
}

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  generateRandom,
  generatePassphrase,
  generatePin,
  scorePassword,
  GeneratorMode,
  RandomOptions,
  PassphraseOptions,
  PinOptions,
  StrengthResult,
} from "@vaultr/core";
import { RefreshCw, Copy, Check, Sliders, Shield, Key, FileText, Hash } from "lucide-react";
import { CipherScrambleText, classifyChar, CHAR_COLOR } from "./CipherScrambleText";

// ─── Character Breakdown Pills ───────────────────────────────────────────────

function CharBreakdown({ value }: { value: string }) {
  const counts = useMemo(() => {
    let lower = 0;
    let upper = 0;
    let digit = 0;
    let symbol = 0;
    for (const c of value) {
      const cls = classifyChar(c);
      if (cls === "lower") lower++;
      if (cls === "upper") upper++;
      if (cls === "digit") digit++;
      if (cls === "symbol") symbol++;
    }
    return { lower, upper, digit, symbol };
  }, [value]);

  if (!value) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
      {counts.upper > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: 6, fontSize: 10, color: "#38bdf8", fontWeight: 600 }}>
          <span style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "#38bdf8" }} />
          {counts.upper} uppercase
        </div>
      )}
      {counts.lower > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", background: "rgba(228, 228, 231, 0.08)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 6, fontSize: 10, color: "#e4e4e7", fontWeight: 500 }}>
          <span style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "#a1a1aa" }} />
          {counts.lower} lowercase
        </div>
      )}
      {counts.digit > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", background: "rgba(251, 191, 36, 0.1)", border: "1px solid rgba(251, 191, 36, 0.2)", borderRadius: 6, fontSize: 10, color: "#fbbf24", fontWeight: 600 }}>
          <span style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "#fbbf24" }} />
          {counts.digit} digits
        </div>
      )}
      {counts.symbol > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", background: "rgba(251, 113, 133, 0.1)", border: "1px solid rgba(251, 113, 133, 0.2)", borderRadius: 6, fontSize: 10, color: "#fb7185", fontWeight: 600 }}>
          <span style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "#fb7185" }} />
          {counts.symbol} symbols
        </div>
      )}
    </div>
  );
}

// ─── Color Legend ─────────────────────────────────────────────────────────────

function ColorLegend() {
  const items = [
    { label: "Lowercase", color: "#e4e4e7", dot: "#a1a1aa", sample: "abc" },
    { label: "Uppercase", color: "#38bdf8", dot: "#38bdf8", sample: "ABC" },
    { label: "Digits",    color: "#fbbf24", dot: "#fbbf24", sample: "123" },
    { label: "Symbols",   color: "#fb7185", dot: "#fb7185", sample: "!@#" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
      {items.map((it) => (
        <div
          key={it.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 6px",
            borderRadius: 6,
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: it.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 9.5, fontWeight: 600, color: it.color }}>{it.label}</span>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--neutral-500)", userSelect: "none" }}>{it.sample}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Segmented Strength Bar ───────────────────────────────────────────────────

function StrengthBar({ r }: { r: StrengthResult }) {
  if (!r.label) return null;

  return (
    <div style={{ marginTop: 10 }}>
      {/* 4 Segmented Pill Bars */}
      <div style={{ display: "flex", gap: 4, height: 4, marginBottom: 7 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: 9999,
              background: i <= r.score ? r.color : "rgba(255, 255, 255, 0.08)",
              transition: "background 0.3s ease",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontWeight: 700, color: r.color }}>{r.label}</span>
          <span style={{ color: "var(--neutral-600)" }}>·</span>
          <span style={{ color: "var(--neutral-400)", fontSize: 10.5 }}>{r.entropy} bits entropy</span>
        </div>
        <span style={{ fontSize: 10, color: "var(--neutral-500)" }}>
          crack time: <span style={{ color: "var(--neutral-300)", fontWeight: 600 }}>{r.crackTime}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Main Generator Screen Component ──────────────────────────────────────────

export function GeneratorScreen() {
  const [mode, setMode] = useState<GeneratorMode>("random");
  const [triggerKey, setTriggerKey] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [copied, setCopied] = useState(false);

  // Random Password Options
  const [len, setLen] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [nums, setNums] = useState(true);
  const [syms, setSyms] = useState(true);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(false);

  // Passphrase Options
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState("-");
  const [capitalize, setCapitalize] = useState(true);

  // PIN Options
  const [pinLen, setPinLen] = useState(6);

  // Password Generation
  const pw = useMemo(() => {
    switch (mode) {
      case "passphrase":
        return generatePassphrase({
          wordCount,
          separator,
          capitalize,
        });
      case "pin":
        return generatePin({
          length: pinLen,
        });
      case "random":
      default:
        return generateRandom({
          length: len,
          useLower: lower,
          useUpper: upper,
          useDigits: nums,
          useSymbols: syms,
          pronounceable: false,
          minUpper: upper ? 1 : 0,
          minDigits: nums ? 1 : 0,
          minSymbols: syms ? 1 : 0,
          exclude: avoidAmbiguous ? "l1IO0" : "",
        });
    }
  }, [mode, len, upper, lower, nums, syms, avoidAmbiguous, wordCount, separator, capitalize, pinLen, triggerKey]);

  const strength = useMemo(() => scorePassword(pw), [pw]);

  const regen = useCallback(() => {
    setTriggerKey((k) => k + 1);
    setIsSpinning(true);
    setCopied(false);
    setTimeout(() => setIsSpinning(false), 500);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  // Keyboard shortcut: Cmd+G or Ctrl+G to regenerate
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
          return;
        }
        e.preventDefault();
        regen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [regen]);

  return (
    <div className="screen-body" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
      
      {/* Mode Selector Segmented Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          background: "#0d0d0f",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 3,
          gap: 3,
        }}
      >
        {(
          [
            { id: "random", label: "Password", icon: Key },
            { id: "passphrase", label: "Passphrase", icon: FileText },
            { id: "pin", label: "PIN", icon: Hash },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                setTriggerKey((k) => k + 1);
                setCopied(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "6px 8px",
                borderRadius: 9,
                fontSize: 11.5,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--neutral-100)" : "var(--neutral-400)",
                background: active ? "rgba(255, 255, 255, 0.08)" : "transparent",
                border: active ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={12} style={{ color: active ? "#38bdf8" : "inherit" }} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Visual Output Card */}
      <div
        style={{
          background: "#0a0a0c",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "13px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "0 8px 24px -6px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Output Text & Actions */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minHeight: 48 }}>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <CipherScrambleText
              value={pw}
              mode={mode}
              size="md"
              triggerKey={triggerKey}
              animate={true}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {/* Copy Button */}
            <button
              type="button"
              onClick={copy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 9px",
                borderRadius: 8,
                background: copied ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                border: copied ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border)",
                color: copied ? "#10b981" : "var(--neutral-300)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check size={12} style={{ color: "#10b981" }} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Regenerate Button with Spin Animation */}
            <button
              type="button"
              onClick={regen}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border)",
                color: "var(--neutral-300)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Generate new password (Ctrl+G)"
            >
              <RefreshCw
                size={12.5}
                style={{
                  color: "#38bdf8",
                  transform: isSpinning ? "rotate(360deg)" : "rotate(0deg)",
                  transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </button>
          </div>
        </div>

        {/* Character Breakdown Bar (for Password mode) */}
        {mode === "random" && <CharBreakdown value={pw} />}

        {/* Segmented Strength Bar */}
        <StrengthBar r={strength} />

        {/* Color Legend (for Password mode) */}
        {mode === "random" && <ColorLegend />}
      </div>

      {/* Mode-Specific Controls */}
      {mode === "random" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Length Slider */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--neutral-400)", marginBottom: 4 }}>
              <span style={{ fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>Length</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#38bdf8", background: "rgba(56, 189, 248, 0.12)", padding: "1px 7px", borderRadius: 6, fontSize: 11 }}>
                {len} characters
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "var(--neutral-500)", fontFamily: "monospace" }}>8</span>
              <input
                type="range"
                min={8}
                max={64}
                value={len}
                style={{ flex: 1, accentColor: "#38bdf8", cursor: "pointer" }}
                onChange={(e) => {
                  setLen(Number(e.target.value));
                  setTriggerKey((k) => k + 1);
                }}
              />
              <span style={{ fontSize: 10, color: "var(--neutral-500)", fontFamily: "monospace" }}>64</span>
            </div>
          </div>

          {/* Character Toggles */}
          <div className="form-group" style={{ marginTop: 2 }}>
            <span className="form-label" style={{ marginBottom: 6, fontSize: 11, fontWeight: 600, color: "var(--neutral-400)", letterSpacing: 0.3, textTransform: "uppercase" }}>
              Character Sets
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(
                [
                  { label: "Uppercase (A–Z)", sample: "ABC", color: "#38bdf8", val: upper, set: setUpper },
                  { label: "Lowercase (a–z)", sample: "abc", color: "#e4e4e7", val: lower, set: setLower },
                  { label: "Digits (0–9)", sample: "123", color: "#fbbf24", val: nums, set: setNums },
                  { label: "Symbols (!@#)", sample: "!@#", color: "#fb7185", val: syms, set: setSyms },
                ] as const
              ).map(({ label, sample, color, val, set }) => (
                <label
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    background: val ? "rgba(255, 255, 255, 0.04)" : "#0d0d0f",
                    border: val ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid var(--border)",
                    borderRadius: 9,
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                    <span style={{ fontSize: 11, color: val ? "var(--neutral-200)" : "var(--neutral-500)", fontWeight: val ? 600 : 400 }}>
                      {sample}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => {
                      // Prevent unchecking all
                      const checkedCount = [upper, lower, nums, syms].filter(Boolean).length;
                      if (!e.target.checked && checkedCount <= 1) return;
                      set(e.target.checked);
                      setTriggerKey((k) => k + 1);
                    }}
                    style={{ accentColor: "#38bdf8", width: 13, height: 13, cursor: "pointer" }}
                  />
                </label>
              ))}
            </div>

            {/* Avoid Ambiguous Toggle */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                background: avoidAmbiguous ? "rgba(255, 255, 255, 0.04)" : "#0d0d0f",
                border: avoidAmbiguous ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid var(--border)",
                borderRadius: 9,
                cursor: "pointer",
                userSelect: "none",
                marginTop: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: avoidAmbiguous ? "var(--neutral-200)" : "var(--neutral-400)", fontWeight: 600 }}>
                  Avoid Ambiguous Characters
                </div>
                <div style={{ fontSize: 9.5, color: "var(--neutral-600)" }}>Excludes l, 1, I, O, 0</div>
              </div>
              <input
                type="checkbox"
                checked={avoidAmbiguous}
                onChange={(e) => {
                  setAvoidAmbiguous(e.target.checked);
                  setTriggerKey((k) => k + 1);
                }}
                style={{ accentColor: "#38bdf8", width: 13, height: 13, cursor: "pointer" }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Passphrase Controls */}
      {mode === "passphrase" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Word Count Slider */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--neutral-400)", marginBottom: 4 }}>
              <span style={{ fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>Word Count</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#38bdf8", background: "rgba(56, 189, 248, 0.12)", padding: "1px 7px", borderRadius: 6, fontSize: 11 }}>
                {wordCount} words
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "var(--neutral-500)", fontFamily: "monospace" }}>3</span>
              <input
                type="range"
                min={3}
                max={10}
                value={wordCount}
                style={{ flex: 1, accentColor: "#38bdf8", cursor: "pointer" }}
                onChange={(e) => {
                  setWordCount(Number(e.target.value));
                  setTriggerKey((k) => k + 1);
                }}
              />
              <span style={{ fontSize: 10, color: "var(--neutral-500)", fontFamily: "monospace" }}>10</span>
            </div>
          </div>

          {/* Separator Selection */}
          <div className="form-group">
            <span className="form-label" style={{ marginBottom: 6, fontSize: 11, fontWeight: 600, color: "var(--neutral-400)", letterSpacing: 0.3, textTransform: "uppercase" }}>
              Separator
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {[
                { id: "-", label: "Hyphen (-)" },
                { id: "_", label: "Under (_)" },
                { id: ".", label: "Period (.)" },
                { id: " ", label: "Space ( )" },
              ].map(({ id, label }) => {
                const active = separator === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSeparator(id);
                      setTriggerKey((k) => k + 1);
                    }}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: active ? 600 : 400,
                      color: active ? "#38bdf8" : "var(--neutral-400)",
                      background: active ? "rgba(56, 189, 248, 0.12)" : "#0d0d0f",
                      border: active ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid var(--border)",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capitalize Toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              background: capitalize ? "rgba(255, 255, 255, 0.04)" : "#0d0d0f",
              border: capitalize ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid var(--border)",
              borderRadius: 9,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <span style={{ fontSize: 11, color: capitalize ? "var(--neutral-200)" : "var(--neutral-400)", fontWeight: 600 }}>
              Capitalize Each Word
            </span>
            <input
              type="checkbox"
              checked={capitalize}
              onChange={(e) => {
                setCapitalize(e.target.checked);
                setTriggerKey((k) => k + 1);
              }}
              style={{ accentColor: "#38bdf8", width: 13, height: 13, cursor: "pointer" }}
            />
          </label>
        </div>
      )}

      {/* PIN Controls */}
      {mode === "pin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* PIN Length Slider */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--neutral-400)", marginBottom: 4 }}>
              <span style={{ fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>PIN Length</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#fbbf24", background: "rgba(251, 191, 36, 0.12)", padding: "1px 7px", borderRadius: 6, fontSize: 11 }}>
                {pinLen} digits
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "var(--neutral-500)", fontFamily: "monospace" }}>4</span>
              <input
                type="range"
                min={4}
                max={16}
                value={pinLen}
                style={{ flex: 1, accentColor: "#fbbf24", cursor: "pointer" }}
                onChange={(e) => {
                  setPinLen(Number(e.target.value));
                  setTriggerKey((k) => k + 1);
                }}
              />
              <span style={{ fontSize: 10, color: "var(--neutral-500)", fontFamily: "monospace" }}>16</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

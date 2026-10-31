import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  generateRandom,
  generatePassphrase,
  generatePin,
  scorePassword,
  GeneratorMode,
} from "@vaultr/core";
import { RefreshCw, Copy, Check, Key, FileText, Hash } from "lucide-react";
import { CipherScrambleText, classifyChar } from "./CipherScrambleText";

// ─── Character Counts Helper ──────────────────────────────────────────────────

function getCharCounts(value: string) {
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
  const charCounts = useMemo(() => getCharCounts(pw), [pw]);

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
    <div
      className="screen-body"
      style={{
        padding: "14px 16px 36px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: 440,
        margin: "0 auto",
      }}
    >
      {/* Mode Selector Segmented Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
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
                gap: 6,
                padding: "6px 8px",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--neutral-100)" : "var(--neutral-400)",
                background: active ? "var(--neutral-800)" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: active ? "0 1px 2px rgba(0, 0, 0, 0.2)" : "none",
              }}
            >
              <Icon size={13} style={{ color: active ? "var(--neutral-100)" : "var(--neutral-500)" }} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Visual Output Card (Hero Area) */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "14px 14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Output Text & Actions */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, minHeight: 46 }}>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <CipherScrambleText
              value={pw}
              mode={mode}
              size="md"
              triggerKey={triggerKey}
              animate={true}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* Copy Button */}
            <button
              type="button"
              onClick={copy}
              className={copied ? "animate-pop" : ""}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 32,
                padding: "0 10px",
                borderRadius: 8,
                background: copied ? "rgba(16, 185, 129, 0.12)" : "var(--neutral-800)",
                border: copied ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border)",
                color: copied ? "#10b981" : "var(--neutral-100)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check size={13} style={{ color: "#10b981" }} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Regenerate Button */}
            <button
              type="button"
              onClick={regen}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--neutral-300)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Generate new password (Ctrl+G)"
            >
              <RefreshCw
                size={13}
                style={{
                  color: "#38bdf8",
                  transform: isSpinning ? "rotate(360deg)" : "rotate(0deg)",
                  transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </button>
          </div>
        </div>

        {/* Strength Progress Indicator */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
          <div style={{ display: "flex", gap: 3, height: 3.5 }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderRadius: 9999,
                  background: i <= strength.score ? strength.color : "var(--neutral-800)",
                  transition: "background 0.3s ease",
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: strength.color }} />
              <span style={{ fontWeight: 600, color: strength.color }}>{strength.label}</span>
              <span style={{ color: "var(--neutral-600)" }}>·</span>
              <span style={{ color: "var(--neutral-400)", fontSize: 10.5 }}>{strength.entropy} bits entropy</span>
            </div>
            <span style={{ fontSize: 10.5, color: "var(--neutral-500)" }}>
              crack time: <span style={{ color: "var(--neutral-300)", fontWeight: 500 }}>{strength.crackTime}</span>
            </span>
          </div>
        </div>

        {/* Character Breakdown Summary (Random Password Mode) */}
        {mode === "random" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 8,
              borderTop: "1px solid var(--border)",
              fontSize: 10.5,
              color: "var(--neutral-400)",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {charCounts.upper > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#38bdf8" }} />
                  <span style={{ color: "#38bdf8", fontWeight: 600 }}>{charCounts.upper}</span>
                  <span style={{ color: "var(--neutral-500)" }}>uppercase</span>
                </span>
              )}
              {charCounts.lower > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--neutral-400)" }} />
                  <span style={{ color: "var(--neutral-200)", fontWeight: 600 }}>{charCounts.lower}</span>
                  <span style={{ color: "var(--neutral-500)" }}>lowercase</span>
                </span>
              )}
              {charCounts.digit > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fbbf24" }} />
                  <span style={{ color: "#fbbf24", fontWeight: 600 }}>{charCounts.digit}</span>
                  <span style={{ color: "var(--neutral-500)" }}>digits</span>
                </span>
              )}
              {charCounts.symbol > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fb7185" }} />
                  <span style={{ color: "#fb7185", fontWeight: 600 }}>{charCounts.symbol}</span>
                  <span style={{ color: "var(--neutral-500)" }}>symbols</span>
                </span>
              )}
            </div>
            <span style={{ fontSize: 9.5, color: "var(--neutral-500)", fontFamily: "monospace" }}>Ctrl+G to renew</span>
          </div>
        )}
      </div>

      {/* Length Slider Section */}
      <div>
        <div className="section-label">LENGTH</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "8px 2px 14px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--neutral-100)" }}>
              {mode === "random" ? "Password Length" : mode === "passphrase" ? "Word Count" : "PIN Length"}
            </span>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontWeight: 600,
                fontSize: 11.5,
                color: mode === "pin" ? "#fbbf24" : "#38bdf8",
                background: mode === "pin" ? "rgba(251, 191, 36, 0.1)" : "rgba(56, 189, 248, 0.1)",
                padding: "2px 8px",
                borderRadius: 6,
              }}
            >
              {mode === "random" && `${len} characters`}
              {mode === "passphrase" && `${wordCount} words`}
              {mode === "pin" && `${pinLen} digits`}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
            <span style={{ fontSize: 10, color: "var(--neutral-500)", fontFamily: "monospace", width: 14 }}>
              {mode === "random" ? 8 : mode === "passphrase" ? 3 : 4}
            </span>
            <input
              type="range"
              min={mode === "random" ? 8 : mode === "passphrase" ? 3 : 4}
              max={mode === "random" ? 64 : mode === "passphrase" ? 10 : 16}
              value={mode === "random" ? len : mode === "passphrase" ? wordCount : pinLen}
              style={{ flex: 1, accentColor: mode === "pin" ? "#fbbf24" : "#38bdf8", cursor: "pointer" }}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (mode === "random") setLen(v);
                else if (mode === "passphrase") setWordCount(v);
                else setPinLen(v);
                setTriggerKey((k) => k + 1);
              }}
            />
            <span style={{ fontSize: 10, color: "var(--neutral-500)", fontFamily: "monospace", width: 16, textAlign: "right" }}>
              {mode === "random" ? 64 : mode === "passphrase" ? 10 : 16}
            </span>
          </div>
        </div>
      </div>

      {/* Mode-Specific Character & Generation Options (Div-Less Flat Rows) */}
      {mode === "random" && (
        <div>
          <div className="section-label">CHARACTER OPTIONS</div>

          {/* Uppercase */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 2px", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--neutral-100)" }}>Uppercase Letters</span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#38bdf8", fontWeight: 600 }}>A–Z</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 2, paddingLeft: 13 }}>
                Include capital letters in generated password
              </div>
            </div>
            <label className="toggle" style={{ flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={upper}
                onChange={(e) => {
                  const checkedCount = [upper, lower, nums, syms].filter(Boolean).length;
                  if (!e.target.checked && checkedCount <= 1) return;
                  setUpper(e.target.checked);
                  setTriggerKey((k) => k + 1);
                }}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Lowercase */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 2px", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--neutral-400)" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--neutral-100)" }}>Lowercase Letters</span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--neutral-400)", fontWeight: 600 }}>a–z</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 2, paddingLeft: 13 }}>
                Include lowercase letters in generated password
              </div>
            </div>
            <label className="toggle" style={{ flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={lower}
                onChange={(e) => {
                  const checkedCount = [upper, lower, nums, syms].filter(Boolean).length;
                  if (!e.target.checked && checkedCount <= 1) return;
                  setLower(e.target.checked);
                  setTriggerKey((k) => k + 1);
                }}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Numbers */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 2px", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fbbf24" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--neutral-100)" }}>Numbers</span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#fbbf24", fontWeight: 600 }}>0–9</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 2, paddingLeft: 13 }}>
                Include numeric digits (0, 1, 2, 3...)
              </div>
            </div>
            <label className="toggle" style={{ flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={nums}
                onChange={(e) => {
                  const checkedCount = [upper, lower, nums, syms].filter(Boolean).length;
                  if (!e.target.checked && checkedCount <= 1) return;
                  setNums(e.target.checked);
                  setTriggerKey((k) => k + 1);
                }}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Symbols */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 2px", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fb7185" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--neutral-100)" }}>Special Symbols</span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#fb7185", fontWeight: 600 }}>!@#$</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 2, paddingLeft: 13 }}>
                Include punctuation & symbols (!, @, #, $, %, etc.)
              </div>
            </div>
            <label className="toggle" style={{ flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={syms}
                onChange={(e) => {
                  const checkedCount = [upper, lower, nums, syms].filter(Boolean).length;
                  if (!e.target.checked && checkedCount <= 1) return;
                  setSyms(e.target.checked);
                  setTriggerKey((k) => k + 1);
                }}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Avoid Ambiguous Characters */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 2px" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--neutral-100)" }}>
                Avoid Ambiguous Characters
              </div>
              <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 2 }}>
                Excludes easily confused characters (l, 1, I, O, 0)
              </div>
            </div>
            <label className="toggle" style={{ flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={avoidAmbiguous}
                onChange={(e) => {
                  setAvoidAmbiguous(e.target.checked);
                  setTriggerKey((k) => k + 1);
                }}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      )}

      {/* Passphrase Options */}
      {mode === "passphrase" && (
        <div>
          <div className="section-label">PASSPHRASE OPTIONS</div>

          {/* Separator */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 2px", borderBottom: "1px solid var(--border)", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--neutral-100)" }}>Word Separator</div>
              <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 2 }}>
                Character placed between words
              </div>
            </div>
            <div
              style={{
                display: "inline-flex",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 2,
                gap: 2,
                flexShrink: 0,
              }}
            >
              {[
                { id: "-", label: "Hyphen (-)" },
                { id: "_", label: "Under (_)" },
                { id: ".", label: "Dot (.)" },
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
                      border: "none",
                      background: active ? "var(--neutral-800)" : "transparent",
                      color: active ? "var(--neutral-100)" : "var(--neutral-400)",
                      fontWeight: active ? 600 : 500,
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capitalize */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 2px" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--neutral-100)" }}>Capitalize Words</div>
              <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 2 }}>
                Start each word with an uppercase letter
              </div>
            </div>
            <label className="toggle" style={{ flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={capitalize}
                onChange={(e) => {
                  setCapitalize(e.target.checked);
                  setTriggerKey((k) => k + 1);
                }}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      )}

      {/* PIN Options */}
      {mode === "pin" && (
        <div>
          <div className="section-label">PIN OPTIONS</div>

          {/* Presets */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 2px", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--neutral-100)" }}>Quick Presets</div>
              <div style={{ fontSize: 11, color: "var(--neutral-500)", marginTop: 2 }}>
                Standard bank & device passcode lengths
              </div>
            </div>
            <div style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
              {[4, 6, 8].map((digits) => {
                const active = pinLen === digits;
                return (
                  <button
                    key={digits}
                    type="button"
                    onClick={() => {
                      setPinLen(digits);
                      setTriggerKey((k) => k + 1);
                    }}
                    style={{
                      border: active ? "1px solid var(--neutral-500)" : "1px solid var(--border)",
                      background: active ? "var(--neutral-800)" : "var(--surface)",
                      color: active ? "var(--neutral-100)" : "var(--neutral-400)",
                      fontSize: 11,
                      fontWeight: active ? 600 : 500,
                      padding: "4px 10px",
                      borderRadius: 7,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {digits} Digits
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo } from "react";
import { generateRandomPassword, scorePassword } from "@vaultr/core";
import { RefreshCw, Copy, Check } from "lucide-react";

export function GeneratorScreen() {
  const [len, setLen] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [nums, setNums] = useState(true);
  const [syms, setSyms] = useState(false);
  const [seed, setSeed] = useState(0);
  const [copied, setCopied] = useState(false);

  // Password derivation matching PasswordGen compact
  const pw = useMemo(
    () =>
      generateRandomPassword({
        length: len,
        useLower: lower,
        useUpper: upper,
        useDigits: nums,
        useSymbols: syms,
        pronounceable: false,
        minUpper: upper ? 1 : 0,
        minDigits: nums ? 1 : 0,
        minSymbols: syms ? 1 : 0,
        exclude: "",
      }),
    [len, upper, lower, nums, syms, seed]
  );

  const regen = () => {
    setSeed(s => s + 1);
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const strength = scorePassword(pw);

  const strengthColor = (label: string) => {
    switch (label?.toLowerCase()) {
      case "very weak":   return "#ef4444";
      case "weak":        return "#f97316";
      case "fair":        return "#eab308";
      case "strong":      return "#22c55e";
      case "very strong": return "#10b981";
      default:            return "var(--neutral-600)";
    }
  };

  const strengthPct = (label: string) => {
    switch (label?.toLowerCase()) {
      case "very weak":   return 20;
      case "weak":        return 40;
      case "fair":        return 60;
      case "strong":      return 80;
      case "very strong": return 100;
      default:            return 0;
    }
  };

  const color = strengthColor(strength?.label);
  const pct = strengthPct(strength?.label);

  return (
    <div className="screen-body" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* Visual output widget matching site */}
      <div className="pw-display">
        {/* Output row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--neutral-950)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 10
        }}>
          <span style={{
            flex: 1,
            fontFamily: "monospace",
            fontSize: 12,
            color: "var(--neutral-200)",
            wordBreak: "break-all",
            userSelect: "all"
          }}>{pw || "—"}</span>
          <button onClick={regen} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neutral-600)", padding: 4 }} title="Regenerate">
            <RefreshCw size={13} />
          </button>
          <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neutral-600)", padding: 4 }} title="Copy">
            {copied ? <Check size={13} style={{ color: "#10b981" }} /> : <Copy size={13} />}
          </button>
        </div>

        {/* Strength bar */}
        <div className="pw-strength-bar">
          <div
            className="pw-strength-fill"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>

        <div className="pw-meta">
          <span style={{ fontSize: 11, fontWeight: 600, color }}>
            {strength?.label || "—"}
          </span>
          <span style={{ fontSize: 10, color: "var(--neutral-600)" }}>
            {strength?.crackTime || ""}
          </span>
        </div>
      </div>

      {/* Length control */}
      <div className="form-group">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>Length</span>
          <span style={{ fontWeight: 700, color: "var(--neutral-200)" }}>{len}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 10, color: "var(--neutral-600)" }}>8</span>
          <input
            type="range"
            min={8}
            max={64}
            value={len}
            style={{ flex: 1, accentColor: "var(--neutral-400)", cursor: "pointer" }}
            onChange={(e) => {
              setLen(Number(e.target.value));
              setCopied(false);
            }}
          />
          <span style={{ fontSize: 10, color: "var(--neutral-600)" }}>64</span>
        </div>
      </div>

      {/* Checkboxes matching the site exactly */}
      <div className="form-group" style={{ marginTop: 4 }}>
        <span className="form-label" style={{ marginBottom: 4 }}>Character Options</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {([["A–Z Uppercase", upper, setUpper], ["a–z Lowercase", lower, setLower], ["0–9 Digits", nums, setNums], ["!@# Symbols", syms, setSyms]] as [string, boolean, (v: boolean) => void][]).map(([label, val, set]) => (
            <label
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "var(--neutral-400)",
                cursor: "pointer",
                userSelect: "none"
              }}
            >
              <input
                type="checkbox"
                checked={val}
                onChange={e => { set(e.target.checked); setCopied(false); }}
                style={{ accentColor: "var(--neutral-400)", width: 14, height: 14 }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      
    </div>
  );
}

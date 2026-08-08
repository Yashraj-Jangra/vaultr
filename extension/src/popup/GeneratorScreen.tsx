import React, { useState, useCallback } from "react";
import { generateRandomPassword, scorePassword } from "@vaultr/core";
import { RefreshCw, Copy, Check } from "lucide-react";

export function GeneratorScreen() {
  const [length, setLength] = useState(20);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(
    (len = length, up = useUpper, lo = useLower, di = useDigits, sy = useSymbols) =>
      generateRandomPassword({
        length: len,
        useLower: lo,
        useUpper: up,
        useDigits: di,
        useSymbols: sy,
        pronounceable: false,
        minUpper: up ? 1 : 0,
        minDigits: di ? 1 : 0,
        minSymbols: sy ? 1 : 0,
        exclude: "",
      }),
    []
  );

  const [password, setPassword] = useState(() => generate());

  const handleGenerate = (
    len = length, up = useUpper, lo = useLower, di = useDigits, sy = useSymbols
  ) => {
    setPassword(generate(len, up, lo, di, sy));
    setCopied(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const strength = scorePassword(password);

  const strengthColor = (label: string) => {
    switch (label?.toLowerCase()) {
      case "very weak":  return "#f87171";
      case "weak":       return "#fb923c";
      case "fair":       return "#fbbf24";
      case "strong":     return "#34d399";
      case "very strong":return "#10b981";
      default:           return "var(--text-muted)";
    }
  };

  const strengthPct = (label: string) => {
    switch (label?.toLowerCase()) {
      case "very weak":   return 15;
      case "weak":        return 35;
      case "fair":        return 55;
      case "strong":      return 78;
      case "very strong": return 100;
      default:            return 0;
    }
  };

  const color = strengthColor(strength?.label);
  const pct = strengthPct(strength?.label);

  return (
    <div className="screen-body" style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Password Display */}
      <div className="pw-display">
        <div className="pw-value">{password}</div>

        {/* Strength bar */}
        <div className="pw-strength-bar">
          <div
            className="pw-strength-fill"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>

        <div className="pw-meta">
          <span style={{ fontSize: 11, fontWeight: 600, color }}>
            {strength?.label || "—"}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {strength?.crackTime || ""}
          </span>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, justifyContent: "center", gap: 6 }}
            onClick={() => handleGenerate()}
          >
            <RefreshCw size={12} />
            Regenerate
          </button>
          <button
            className={`btn ${copied ? "btn-success" : "btn-primary"}`}
            style={{ flex: 1, justifyContent: "center", gap: 6 }}
            onClick={handleCopy}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Length */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
          <span>Length</span>
          <span style={{ fontWeight: 700, color: "var(--text-primary)", minWidth: 24, textAlign: "right" }}>{length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          value={length}
          style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
          onChange={(e) => {
            const len = Number(e.target.value);
            setLength(len);
            handleGenerate(len);
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
          <span>8</span><span>64</span>
        </div>
      </div>

      {/* Character Types */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
          Characters
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <ToggleChip
            label="A–Z Uppercase"
            checked={useUpper}
            onChange={(v) => { setUseUpper(v); handleGenerate(length, v); }}
          />
          <ToggleChip
            label="a–z Lowercase"
            checked={useLower}
            onChange={(v) => { setUseLower(v); handleGenerate(length, useUpper, v); }}
          />
          <ToggleChip
            label="0–9 Digits"
            checked={useDigits}
            onChange={(v) => { setUseDigits(v); handleGenerate(length, useUpper, useLower, v); }}
          />
          <ToggleChip
            label="!@# Symbols"
            checked={useSymbols}
            onChange={(v) => { setUseSymbols(v); handleGenerate(length, useUpper, useLower, useDigits, v); }}
          />
        </div>
      </div>
    </div>
  );
}

function ToggleChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: "var(--radius-md)",
        background: checked ? "var(--accent-dim)" : "var(--bg-raised)",
        border: `1px solid ${checked ? "rgba(124,106,250,0.3)" : "var(--border-default)"}`,
        fontSize: 12,
        color: checked ? "#a899fa" : "var(--text-secondary)",
        cursor: "pointer",
        transition: "var(--transition)",
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "var(--accent)", width: 12, height: 12, flexShrink: 0 }}
      />
      {label}
    </label>
  );
}

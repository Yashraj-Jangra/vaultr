import React, { useState } from "react";
import { generateRandomPassword, scorePassword } from "@vaultr/core";
import { RefreshCw, Copy, Check } from "lucide-react";

export function GeneratorScreen() {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);

  const [password, setPassword] = useState(() =>
    generateRandomPassword({
      length: 16,
      useLower: true,
      useUpper: true,
      useDigits: true,
      useSymbols: true,
      pronounceable: false,
      minUpper: 1,
      minDigits: 1,
      minSymbols: 1,
      exclude: "",
    })
  );
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const pw = generateRandomPassword({
      length,
      useLower,
      useUpper,
      useDigits,
      useSymbols,
      pronounceable: false,
      minUpper: useUpper ? 1 : 0,
      minDigits: useDigits ? 1 : 0,
      minSymbols: useSymbols ? 1 : 0,
      exclude: "",
    });
    setPassword(pw);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const strength = scorePassword(password);

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ fontSize: "14px", fontFamily: "monospace", color: "#f4f4f5", wordBreak: "break-all", background: "#09090b", padding: "10px", borderRadius: "8px", border: "1px solid #27272a" }}>
          {password}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", color: strength.color, fontWeight: 600 }}>{strength.label} ({strength.crackTime})</span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={handleGenerate} style={{ background: "#27272a", border: "none", color: "#f4f4f5", borderRadius: "6px", padding: "6px 8px", cursor: "pointer" }}>
              <RefreshCw size={12} />
            </button>
            <button onClick={handleCopy} style={{ background: copied ? "rgba(34, 197, 94, 0.15)" : "#f4f4f5", border: "none", color: copied ? "#4ade80" : "#09090b", borderRadius: "6px", padding: "6px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
            <span>Length</span>
            <span style={{ fontWeight: 600, color: "#f4f4f5" }}>{length}</span>
          </div>
          <input
            type="range"
            min="8"
            max="64"
            value={length}
            onChange={(e) => {
              setLength(Number(e.target.value));
              handleGenerate();
            }}
            style={{ width: "100%", accentColor: "#8b5cf6" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <ToggleOption label="A-Z Uppercase" checked={useUpper} onChange={(v) => { setUseUpper(v); handleGenerate(); }} />
          <ToggleOption label="a-z Lowercase" checked={useLower} onChange={(v) => { setUseLower(v); handleGenerate(); }} />
          <ToggleOption label="0-9 Digits" checked={useDigits} onChange={(v) => { setUseDigits(v); handleGenerate(); }} />
          <ToggleOption label="!@# Symbols" checked={useSymbols} onChange={(v) => { setUseSymbols(v); handleGenerate(); }} />
        </div>
      </div>
    </div>
  );
}

function ToggleOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "#18181b", border: "1px solid #27272a", padding: "8px 10px", borderRadius: "8px", fontSize: "11px", color: "#f4f4f5", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "#8b5cf6" }} />
      <span>{label}</span>
    </label>
  );
}

import React, { useEffect } from "react";
import { Fingerprint } from "lucide-react";

export function BackspaceIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <path d="m12 9 6 6" />
      <path d="m18 9-6 6" />
    </svg>
  );
}

export interface PinPadProps {
  length?: number;
  value: string;
  onChange: (val: string) => void;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  showBiometricButton?: boolean;
  onBiometricPress?: () => void;
  errorMessage?: string;
  shake?: boolean;
}

const DIGIT_KEYS = [
  { num: "1", sub: "" },
  { num: "2", sub: "A B C" },
  { num: "3", sub: "D E F" },
  { num: "4", sub: "G H I" },
  { num: "5", sub: "J K L" },
  { num: "6", sub: "M N O" },
  { num: "7", sub: "P Q R S" },
  { num: "8", sub: "T U V" },
  { num: "9", sub: "W X Y Z" },
];

export function PinPad({
  length = 4,
  value,
  onChange,
  onComplete,
  disabled = false,
  showBiometricButton = false,
  onBiometricPress,
  errorMessage,
  shake = false,
}: PinPadProps) {
  const handlePressDigit = (digit: string) => {
    if (disabled || value.length >= length) return;
    const next = value + digit;
    onChange(next);
    if (next.length === length && onComplete) {
      onComplete(next);
    }
  };

  const handlePressDelete = () => {
    if (disabled || value.length === 0) return;
    onChange(value.slice(0, -1));
  };

  // Physical keyboard listener scoped to the mounted PinPad
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow standard modifier combos (Cmd+R, Ctrl+Shift+I, etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handlePressDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handlePressDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [value, length, disabled, onComplete]);

  return (
    <div className="pin-pad-container">
      {/* Indicator Dots */}
      <div className={`pin-dots-row ${shake ? "pin-dots-shake" : ""}`}>
        {Array.from({ length }).map((_, idx) => {
          const filled = idx < value.length;
          const isError = Boolean(errorMessage);
          let dotClass = "pin-dot pin-dot-empty";
          if (isError) {
            dotClass = "pin-dot pin-dot-error";
          } else if (filled) {
            dotClass = "pin-dot pin-dot-filled";
          }
          return <div key={idx} className={dotClass} />;
        })}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="pin-error-text" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Keypad Grid */}
      <div className="pin-grid">
        {DIGIT_KEYS.map((k) => (
          <button
            key={k.num}
            type="button"
            className="pin-key"
            disabled={disabled}
            onClick={() => handlePressDigit(k.num)}
          >
            <span className="pin-key-num">{k.num}</span>
            {k.sub ? <span className="pin-key-sub">{k.sub}</span> : <span className="pin-key-sub-empty" />}
          </button>
        ))}

        {/* Bottom Row */}
        {showBiometricButton && onBiometricPress ? (
          <button
            type="button"
            className="pin-key pin-key-action"
            disabled={disabled}
            onClick={onBiometricPress}
            title="Unlock with Biometrics"
          >
            <Fingerprint size={22} className="pin-bio-icon" />
          </button>
        ) : (
          <div className="pin-key-spacer" />
        )}

        <button
          type="button"
          className="pin-key"
          disabled={disabled}
          onClick={() => handlePressDigit("0")}
        >
          <span className="pin-key-num">0</span>
          <span className="pin-key-sub-empty" />
        </button>

        <button
          type="button"
          className="pin-key pin-key-action"
          disabled={disabled || value.length === 0}
          onClick={handlePressDelete}
          title="Delete"
        >
          <BackspaceIcon
            size={20}
            color={value.length > 0 ? "#f4f4f5" : "rgba(255, 255, 255, 0.25)"}
          />
        </button>
      </div>
    </div>
  );
}

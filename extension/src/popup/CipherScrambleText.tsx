import React, { useState, useEffect, useRef } from "react";
import { GeneratorMode } from "@vaultr/core";

export type CharClass = "lower" | "upper" | "digit" | "symbol";

export function classifyChar(c: string): CharClass {
  if (/[a-z]/.test(c)) return "lower";
  if (/[A-Z]/.test(c)) return "upper";
  if (/[0-9]/.test(c)) return "digit";
  return "symbol";
}

export const CHAR_COLOR: Record<CharClass, string> = {
  lower: "#e4e4e7",   // soft neutral light gray
  upper: "#38bdf8",   // vibrant sky-400
  digit: "#fbbf24",   // bright warm amber-400
  symbol: "#fb7185",  // rose-400
};

const CIPHER_LOWER = "abcdefghijklmnopqrstuvwxyz";
const CIPHER_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CIPHER_DIGITS = "0123456789";
const CIPHER_SYMBOLS = "!@#$%^&*()_+-=[]{}|:<>?~";
const ALL_CHAR_POOLS = [CIPHER_LOWER, CIPHER_UPPER, CIPHER_DIGITS, CIPHER_SYMBOLS];

function getRandomScrambleChar(mode?: GeneratorMode): string {
  if (mode === "pin") {
    return CIPHER_DIGITS[Math.floor(Math.random() * CIPHER_DIGITS.length)];
  }
  if (mode === "passphrase") {
    return CIPHER_LOWER[Math.floor(Math.random() * CIPHER_LOWER.length)];
  }
  const pool = ALL_CHAR_POOLS[Math.floor(Math.random() * ALL_CHAR_POOLS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

interface CipherChar {
  char: string;
  isLocked: boolean;
}

export interface CipherScrambleTextProps {
  value: string;
  mode?: GeneratorMode;
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
  className?: string;
  triggerKey?: string | number;
  animate?: boolean;
}

export function CipherScrambleText({
  value,
  mode = "random",
  size = "md",
  style,
  className = "",
  triggerKey,
  animate = true,
}: CipherScrambleTextProps) {
  const [displayChars, setDisplayChars] = useState<CipherChar[]>(() =>
    value ? value.split("").map((c) => ({ char: c, isLocked: true })) : []
  );

  const prevValueRef = useRef<string | null>(null);
  const prevTriggerRef = useRef(triggerKey);

  useEffect(() => {
    if (!value) {
      setDisplayChars([]);
      prevValueRef.current = "";
      return;
    }

    if (!animate) {
      setDisplayChars(value.split("").map((c) => ({ char: c, isLocked: true })));
      prevValueRef.current = value;
      prevTriggerRef.current = triggerKey;
      return;
    }

    const isTriggerUpdate = triggerKey !== undefined && triggerKey !== prevTriggerRef.current;
    const isValueUpdate = value !== prevValueRef.current;
    prevValueRef.current = value;
    prevTriggerRef.current = triggerKey;

    if (!isValueUpdate && !isTriggerUpdate) {
      return;
    }

    const targetLen = value.length;
    const totalFrames = Math.min(Math.max(targetLen, 10), 14);
    let frame = 0;

    // Immediately start with scrambled characters
    const initialScramble: CipherChar[] = [];
    for (let i = 0; i < targetLen; i++) {
      const char = value[i];
      if (char === "-" || char === " " || char === "." || char === "_") {
        initialScramble.push({ char, isLocked: true });
      } else {
        initialScramble.push({ char: getRandomScrambleChar(mode), isLocked: false });
      }
    }
    setDisplayChars(initialScramble);

    const interval = setInterval(() => {
      frame++;
      const lockedCount = Math.floor((frame / totalFrames) * targetLen);

      if (frame >= totalFrames) {
        clearInterval(interval);
        setDisplayChars(value.split("").map((c) => ({ char: c, isLocked: true })));
      } else {
        const nextChars: CipherChar[] = [];
        for (let i = 0; i < targetLen; i++) {
          const originalChar = value[i];
          if (
            i < lockedCount ||
            originalChar === "-" ||
            originalChar === " " ||
            originalChar === "." ||
            originalChar === "_"
          ) {
            nextChars.push({ char: originalChar, isLocked: true });
          } else {
            nextChars.push({ char: getRandomScrambleChar(mode), isLocked: false });
          }
        }
        setDisplayChars(nextChars);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [value, triggerKey, mode, animate]);

  if (!value) {
    return <span style={{ fontFamily: "monospace", color: "var(--neutral-600)" }}>—</span>;
  }

  // PIN Mode
  if (mode === "pin") {
    const fontSize = size === "sm" ? 13 : size === "lg" ? 22 : 18;
    return (
      <span
        className={className}
        style={{
          fontFamily: "monospace",
          fontWeight: 700,
          letterSpacing: "0.22em",
          color: "#fbbf24",
          userSelect: "all",
          wordBreak: "break-all",
          fontSize,
          ...style,
        }}
        aria-label={value}
      >
        {displayChars.map((item, i) => (
          <span
            key={i}
            style={{
              opacity: item.isLocked ? 1 : 0.75,
              transition: "opacity 0.15s ease",
            }}
          >
            {item.char}
          </span>
        ))}
      </span>
    );
  }

  // Passphrase Mode
  if (mode === "passphrase") {
    const fontSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;
    return (
      <span
        className={className}
        style={{
          fontFamily: "monospace",
          wordBreak: "break-all",
          userSelect: "all",
          lineHeight: 1.5,
          fontSize,
          ...style,
        }}
        aria-label={value}
      >
        {displayChars.map((item, i) => {
          const isSep = /^[\-\._\s]$/.test(item.char);
          if (isSep) {
            return (
              <span
                key={i}
                style={{
                  color: "#fbbf24",
                  fontWeight: 700,
                  padding: "0 1.5px",
                  userSelect: "none",
                }}
              >
                {item.char === " " ? "␣" : item.char}
              </span>
            );
          }
          return (
            <span
              key={i}
              style={{
                fontWeight: 500,
                color: item.isLocked ? "#f4f4f5" : "#38bdf8",
                opacity: item.isLocked ? 1 : 0.8,
                transition: "opacity 0.15s ease, color 0.15s ease",
              }}
            >
              {item.char}
            </span>
          );
        })}
      </span>
    );
  }

  // Random / Pattern Password Mode
  const fontSize = size === "sm" ? 12 : size === "lg" ? 16 : 13.5;
  return (
    <span
      className={className}
      style={{
        fontFamily: "monospace",
        wordBreak: "break-all",
        userSelect: "all",
        lineHeight: 1.55,
        letterSpacing: "0.05em",
        fontSize,
        ...style,
      }}
      aria-label={value}
    >
      {displayChars.map((item, i) => {
        const cls = classifyChar(item.char);
        const color = CHAR_COLOR[cls];
        const weight = cls === "lower" ? 400 : cls === "upper" ? 600 : 700;
        return (
          <span
            key={i}
            style={{
              color,
              fontWeight: weight,
              opacity: item.isLocked ? 1 : 0.8,
              transition: "opacity 0.1s ease",
            }}
          >
            {item.char}
          </span>
        );
      })}
    </span>
  );
}

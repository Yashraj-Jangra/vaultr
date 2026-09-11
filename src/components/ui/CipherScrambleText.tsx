"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { type GeneratorMode } from "@/lib/generator";

export type CharClass = "lower" | "upper" | "digit" | "symbol";

export function classifyChar(c: string): CharClass {
  if (/[a-z]/.test(c)) return "lower";
  if (/[A-Z]/.test(c)) return "upper";
  if (/[0-9]/.test(c)) return "digit";
  return "symbol";
}

export const CHAR_STYLE: Record<CharClass, string> = {
  lower: "text-neutral-300",
  upper: "text-sky-400 font-semibold",
  digit: "text-amber-400 font-bold",
  symbol: "text-rose-400 font-bold",
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
  // Balanced 25% lower, 25% upper, 25% digits, 25% symbols
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
  className?: string;
  triggerKey?: string | number;
  animate?: boolean;
}

export function CipherScrambleText({
  value,
  mode = "random",
  size = "md",
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

    // Only scramble when value or triggerKey actually updates, or on initial load
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
          if (i < lockedCount || originalChar === "-" || originalChar === " " || originalChar === "." || originalChar === "_") {
            nextChars.push({ char: originalChar, isLocked: true });
          } else {
            nextChars.push({ char: getRandomScrambleChar(mode), isLocked: false });
          }
        }
        setDisplayChars(nextChars);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [value, triggerKey, mode]);

  if (!value) return <span className="text-neutral-700 font-mono">—</span>;

  // PIN Mode
  if (mode === "pin") {
    const sizeClasses =
      size === "sm" ? "text-xs" : size === "lg" ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl";
    return (
      <span
        className={`font-mono font-bold tracking-[0.22em] text-amber-400 select-all ${sizeClasses} ${className}`}
        aria-label={value}
      >
        {displayChars.map((item, i) => (
          <span
            key={i}
            className={`transition-opacity duration-150 ${item.isLocked ? "opacity-100" : "opacity-75"}`}
          >
            {item.char}
          </span>
        ))}
      </span>
    );
  }

  // Passphrase Mode
  if (mode === "passphrase") {
    const sizeClasses =
      size === "sm" ? "text-xs" : size === "lg" ? "text-lg sm:text-xl" : "text-base sm:text-lg";
    return (
      <span
        className={`font-mono break-all select-all leading-relaxed ${sizeClasses} ${className}`}
        aria-label={value}
      >
        {displayChars.map((item, i) => {
          const isSep = /^[\-\._\s]$/.test(item.char);
          if (isSep) {
            return (
              <span key={i} className="text-amber-400 font-bold px-0.5 select-none opacity-100">
                {item.char === " " ? "␣" : item.char}
              </span>
            );
          }
          return (
            <span
              key={i}
              className={`font-medium transition-opacity duration-150 ${
                item.isLocked ? "text-neutral-100 opacity-100" : "text-sky-300 opacity-80"
              }`}
            >
              {item.char}
            </span>
          );
        })}
      </span>
    );
  }

  // Random & Pattern Modes
  const sizeClasses =
    size === "sm" ? "text-xs sm:text-[13px]" : size === "lg" ? "text-lg sm:text-xl" : "text-base sm:text-lg";

  return (
    <span
      className={`font-mono break-all select-all leading-relaxed tracking-wider ${sizeClasses} ${className}`}
      aria-label={value}
    >
      {displayChars.map((item, i) => {
        const cls = classifyChar(item.char);
        const style = CHAR_STYLE[cls];
        return (
          <span
            key={i}
            className={`${style} transition-opacity duration-100 ${
              item.isLocked ? "opacity-100" : "opacity-80"
            }`}
          >
            {item.char}
          </span>
        );
      })}
    </span>
  );
}

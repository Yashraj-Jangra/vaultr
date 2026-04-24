"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  /** Render a divider before this option */
  divider?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setHighlighted(options.findIndex((o) => o.value === value));
      }
      return;
    }
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < options.length) {
        onChange(options[highlighted].value);
        setOpen(false);
      }
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || highlighted < 0) return;
    const el = listRef.current?.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  const handleSelect = (opt: SelectOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      id={id}
    >
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen((v) => !v); setHighlighted(options.findIndex(o => o.value === value)); } }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center gap-2 bg-[var(--surface-2)] border rounded-lg px-3 py-2 text-[13px] text-left transition-all outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          open
            ? "border-neutral-700 ring-1 ring-white/5"
            : "border-[var(--border)] hover:border-neutral-700"
        }`}
      >
        {selected?.icon && (
          <span className="text-neutral-600 shrink-0">{selected.icon}</span>
        )}
        <span className={`flex-1 truncate ${selected ? "text-[var(--fg)]" : "text-neutral-600"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-600 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl border border-[var(--border)] bg-[#0f0f0f] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden"
          style={{ animation: "select-drop-in 0.15s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-56 overflow-y-auto py-1 scrollbar-thin"
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isHighlighted = highlighted === i;
              return (
                <React.Fragment key={opt.value}>
                  {opt.divider && (
                    <li role="separator" className="h-px bg-[var(--border)] mx-2 my-1" />
                  )}
                  <li
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlighted(i)}
                    onMouseLeave={() => setHighlighted(-1)}
                    onClick={() => handleSelect(opt)}
                    className={`flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg text-[13px] cursor-pointer transition-colors select-none ${
                      isHighlighted
                        ? "bg-neutral-800 text-neutral-200"
                        : isSelected
                        ? "text-neutral-200"
                        : "text-neutral-500"
                    }`}
                  >
                    {opt.icon && (
                      <span className={`shrink-0 ${isHighlighted || isSelected ? "text-neutral-400" : "text-neutral-700"}`}>
                        {opt.icon}
                      </span>
                    )}
                    <span className="flex-1 truncate">{opt.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        </div>
      )}

      {/* Inline keyframe — avoids globals.css coupling */}
      <style>{`
        @keyframes select-drop-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}

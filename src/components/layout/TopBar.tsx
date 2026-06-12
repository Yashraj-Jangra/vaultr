"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Lock, LogOut, User, ChevronDown, Wand2, Sun, Moon, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useVault } from "@/context/VaultContext";
import { useTheme } from "@/context/ThemeContext";

interface TopBarProps {
  onSearchOpen?: () => void;  // opens command palette
  onGeneratorOpen?: () => void;
}

export function TopBar({ onSearchOpen, onGeneratorOpen }: TopBarProps) {
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();
  const { isLocked, lock } = useVault();
  const { activeTheme, setMode } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--bg)] sticky top-0 z-40 flex items-center px-4 gap-3">
      {/* Search bar */}
      <button
        onClick={onSearchOpen}
        className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--border)] text-[13px] text-neutral-600 hover:border-neutral-700 hover:text-neutral-400 transition-colors cursor-pointer text-left"
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1">Search vault…</span>
        <kbd className="text-[10px] text-neutral-700 border border-[var(--border)] rounded px-1.5 py-0.5 font-mono hidden sm:block">⌘K</kbd>
      </button>

      {/* Generator button */}
      <button
        onClick={onGeneratorOpen}
        title="Password Generator"
        className="text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer p-2 rounded-md hover:bg-neutral-800/50"
      >
        <Wand2 className="w-4 h-4" />
      </button>

      {/* Lock status dot */}
      <div
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLocked ? "bg-red-500" : "bg-emerald-500"}`}
        title={isLocked ? "Vault locked" : "Vault unlocked"}
      />

      {/* User avatar / dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer"
        >
          <span className="w-7 h-7 rounded-full bg-neutral-800 border border-[var(--border)] flex items-center justify-center text-[11px] font-medium text-neutral-300">
            {initials}
          </span>
          <ChevronDown className="w-3 h-3" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden z-50">
            <div className="px-3 py-2.5 border-b border-[var(--border)]">
              <p className="text-[12px] text-[var(--fg)] font-medium truncate">{user?.displayName || "User"}</p>
              <p className="text-[11px] text-[var(--fg-muted)] truncate">{user?.email}</p>
            </div>
            <div className="p-1">
              {isAdmin && (
                <button
                  onClick={() => { router.push("/admin"); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--border)] rounded-md transition-colors cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" /> Admin Panel
                </button>
              )}

              <button
                onClick={() => { router.push("/settings/account"); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--border)] rounded-md transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5" /> Profile
              </button>
              
              <button
                onClick={() => {
                  setMode(activeTheme.mode === "dark" ? "light" : "dark");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--border)] rounded-md transition-colors cursor-pointer"
              >
                {activeTheme.mode === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {activeTheme.mode === "dark" ? "Light Mode" : "Dark Mode"}
              </button>

              <button
                onClick={() => { lock(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--border)] rounded-md transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" /> Lock vault
              </button>
              <div className="h-px bg-[var(--border)] my-1 mx-1" />
              <button
                onClick={async () => { await logout(); router.push("/"); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--fg-muted)] hover:text-[var(--danger)] hover:bg-[var(--border)] rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

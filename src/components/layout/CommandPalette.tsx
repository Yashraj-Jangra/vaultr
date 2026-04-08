"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Lock, Settings, Plus, Wand2, X, Heart, Fingerprint } from "lucide-react";
import { useVault } from "@/context/VaultContext";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type Action = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  run: () => void;
  group: "action" | "entry";
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setOpenCount((c) => c + 1);
  }, [open]);

  if (!open) return null;
  return <PaletteInner key={openCount} onClose={onClose} />;
}

function PaletteInner({ onClose }: { onClose: () => void }) {
  const router  = useRouter();
  const { items, lock } = useVault();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // Focus input on mount (safe — DOM side-effect)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);


  const ACTIONS: Action[] = [
    { id: "new-login",   label: "New Login",      icon: <Plus className="w-4 h-4" />, run: () => { router.push("/vault?new=login");         onClose(); }, group: "action" },
    { id: "new-card",    label: "New Credit Card", icon: <Plus className="w-4 h-4" />, run: () => { router.push("/vault?new=card");          onClose(); }, group: "action" },
    { id: "new-note",    label: "New Secure Note", icon: <Plus className="w-4 h-4" />, run: () => { router.push("/vault?new=note");          onClose(); }, group: "action" },
    { id: "lock",        label: "Lock Vault",      icon: <Lock className="w-4 h-4" />, run: () => { lock(); onClose(); },                               group: "action" },
    { id: "health",      label: "Password Health", icon: <Heart className="w-4 h-4" />, run: () => { router.push("/health");                onClose(); }, group: "action" },
    { id: "auth",        label: "Authenticator",   icon: <Fingerprint className="w-4 h-4" />, run: () => { router.push("/vault/authenticator"); onClose(); }, group: "action" },
    { id: "generator",   label: "Password Generator", icon: <Wand2 className="w-4 h-4" />, run: () => { router.push("/generator");         onClose(); }, group: "action" },
    { id: "settings",    label: "Settings",        icon: <Settings className="w-4 h-4" />, run: () => { router.push("/settings");           onClose(); }, group: "action" },
  ];

  // Vault entry search results
  const entryResults: Action[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return items
      .filter((item) =>
        item.name.toLowerCase().includes(q) ||
        item.domain?.toLowerCase().includes(q) ||
        item.folder?.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((item) => ({
        id: `entry-${item.id}`,
        label: item.name,
        description: item.domain || item.folder,
        icon: item.domain
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`https://www.google.com/s2/favicons?domain=${item.domain}&sz=16`} alt="" className="w-4 h-4 rounded" />
          : <Search className="w-4 h-4" />,
        run: () => { router.push(`/vault?reveal=${item.id}`); onClose(); },
        group: "entry" as const,
      }));
  }, [items, query, router, onClose]);

  const filteredActions: Action[] = query.trim()
    ? ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : ACTIONS;

  const allResults: Action[] = [...entryResults, ...filteredActions];

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")      { onClose(); return; }
      if (e.key === "ArrowDown")   { e.preventDefault(); setCursor((c) => Math.min(c + 1, allResults.length - 1)); }
      if (e.key === "ArrowUp")     { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === "Enter" && allResults[cursor]) { allResults[cursor].run(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, cursor, allResults, onClose]);

  // Scroll cursor into view
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed left-1/2 top-[20vh] -translate-x-1/2 z-[70] w-full max-w-lg px-4">
        <div className="bg-neutral-900 border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <Search className="w-4 h-4 text-neutral-600 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
              placeholder="Search or type a command…"
              className="flex-1 bg-transparent text-[14px] text-neutral-200 placeholder-neutral-600 outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-neutral-600 hover:text-neutral-400 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results list */}
          <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
            {entryResults.length > 0 && (
              <>
                <p className="px-4 py-1.5 text-[10px] text-neutral-600 uppercase tracking-wider">Entries</p>
                {entryResults.map((action, idx) => (
                  <ResultRow key={action.id} action={action} active={idx === cursor} onClick={() => action.run()} />
                ))}
              </>
            )}
            {filteredActions.length > 0 && (
              <>
                <p className="px-4 py-1.5 text-[10px] text-neutral-600 uppercase tracking-wider">
                  {query.trim() ? "Actions" : "Quick actions"}
                </p>
                {filteredActions.map((action, idx) => {
                  const globalIdx = entryResults.length + idx;
                  return (
                    <ResultRow key={action.id} action={action} active={globalIdx === cursor} onClick={() => action.run()} />
                  );
                })}
              </>
            )}
            {allResults.length === 0 && (
              <p className="px-4 py-6 text-center text-[13px] text-neutral-600">No results for &ldquo;{query}&rdquo;</p>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-3 text-[11px] text-neutral-700">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> select</span>
            <span><kbd className="font-mono">Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </>
  );
}

function ResultRow({ action, active, onClick }: { action: Action; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
        active ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
      }`}
    >
      <span className="shrink-0 text-neutral-500">{action.icon}</span>
      <span className="flex-1 text-[13px]">{action.label}</span>
      {action.description && (
        <span className="text-[11px] text-neutral-600 truncate max-w-[120px]">{action.description}</span>
      )}
    </button>
  );
}

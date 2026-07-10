"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Lock, Settings, Plus, Wand2, X, Heart, Fingerprint, Clock, Shield, Sparkles } from "lucide-react";
import { useVault } from "@/context/VaultContext";
import { DynamicPreviewCanvas } from "@/components/vault/DialogPreviews";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type Action = {
  id: string;
  itemId?: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  run: () => void;
  group: "action" | "entry";
  template?: "login" | "card" | "address" | "profile" | "note";
};

const EMPTY_STATES = [
  {
    src: "/illustrations/taken_mshk.svg",
    title: "Abducted by Aliens",
    caption: "Your passwords have been taken. To a better planet.",
  },
  {
    src: "/illustrations/page-not-found_6wni.svg",
    title: "404 — Not Found",
    caption: "We searched everywhere. It's simply not here.",
  },
  {
    src: "/illustrations/lost_teip.svg",
    title: "Completely Lost",
    caption: "Even we don't know where that went.",
  },
  {
    src: "/illustrations/the-search_cjxa.svg",
    title: "Still Searching…",
    caption: "Your secrets are safe from your own search.",
  },
  {
    src: "/illustrations/data-thief_d66l.svg",
    title: "Data? What Data?",
    caption: "Someone got here before you did.",
  },
  {
    src: "/illustrations/empty_4zx0.svg",
    title: "The Void Stares Back",
    caption: "Nothing. Zero. The void is vast.",
  },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (open) setOpenCount((c) => c + 1);
  }, [open]);

  if (!open) return null;
  return <PaletteInner key={openCount} onClose={onClose} />;
}

function PaletteInner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { items, lock, decryptItem } = useVault();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [decryptedCache, setDecryptedCache] = useState<Record<string, any>>({});
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem("vaultr_search_history");
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch {
        setSearchHistory([]);
      }
    }
  }, []);

  // Save history helper
  const saveToHistory = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(x => x.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, 5);
      localStorage.setItem("vaultr_search_history", JSON.stringify(next));
      return next;
    });
  }, []);

  // Focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Cycling empty state illustration when no results
  useEffect(() => {
    const t = setInterval(() => {
      setPlaceholderIndex(i => (i + 1) % EMPTY_STATES.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // Actions list
  const ACTIONS: Action[] = useMemo(() => [
    { id: "new-login", label: "New Login", icon: <Plus className="w-4 h-4" />, run: () => { router.push("/vault?new=login"); onClose(); }, group: "action" },
    { id: "new-card", label: "New Credit Card", icon: <Plus className="w-4 h-4" />, run: () => { router.push("/vault?new=card"); onClose(); }, group: "action" },
    { id: "new-note", label: "New Secure Note", icon: <Plus className="w-4 h-4" />, run: () => { router.push("/vault?new=note"); onClose(); }, group: "action" },
    { id: "lock", label: "Lock Vault", icon: <Lock className="w-4 h-4" />, run: () => { lock(); onClose(); }, group: "action" },
    { id: "health", label: "Password Health", icon: <Heart className="w-4 h-4" />, run: () => { router.push("/vault/authenticator"); onClose(); }, group: "action" }, // redirects to authenticator/health
    { id: "auth", label: "Authenticator", icon: <Fingerprint className="w-4 h-4" />, run: () => { router.push("/vault/authenticator"); onClose(); }, group: "action" },
    { id: "generator", label: "Password Generator", icon: <Wand2 className="w-4 h-4" />, run: () => { router.push("/vault/generator"); onClose(); }, group: "action" },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" />, run: () => { router.push("/settings"); onClose(); }, group: "action" },
  ], [router, lock, onClose]);

  // Vault entry results
  const entryResults: Action[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return items
      .filter((item) =>
        item.name.toLowerCase().includes(q) ||
        item.domain?.toLowerCase().includes(q) ||
        item.folder?.toLowerCase().includes(q)
      )
      .map((item) => ({
        id: `entry-${item.id}`,
        itemId: item.id,
        label: item.name,
        description: item.domain || item.folder,
        icon: item.domain
          ? <img src={`https://www.google.com/s2/favicons?domain=${item.domain}&sz=16`} alt="" className="w-4 h-4 rounded" />
          : <Shield className="w-4 h-4" />,
        run: () => {
          saveToHistory(query);
          router.push(`/vault?reveal=${item.id}`);
          onClose();
        },
        group: "entry" as const,
        template: item.template || "login",
      }));
  }, [items, query, router, onClose, saveToHistory]);

  const filteredActions: Action[] = useMemo(() => {
    if (!query.trim()) return ACTIONS;
    return ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));
  }, [ACTIONS, query]);

  const allResults: Action[] = useMemo(
    () => [...entryResults, ...filteredActions],
    [entryResults, filteredActions]
  );

  // Manage selection index boundary
  useEffect(() => {
    setCursor(0);
  }, [query]);

  // Decrypt hovered entry dynamically
  const hoveredItem = allResults[cursor];
  useEffect(() => {
    if (hoveredItem && hoveredItem.group === "entry" && hoveredItem.itemId) {
      const targetId = hoveredItem.itemId;
      if (decryptedCache[targetId]) return;
      const targetItem = items.find(x => x.id === targetId);
      if (targetItem) {
        decryptItem(targetItem.encryptedBlob).then(raw => {
          let parsed: any;
          try { parsed = JSON.parse(raw); } catch { parsed = { payload: raw }; }
          if (!parsed._template && (parsed.username || parsed.password)) parsed._template = "login";
          setDecryptedCache(prev => ({ ...prev, [targetId]: parsed }));
        }).catch(() => { });
      }
    }
  }, [hoveredItem, items, decryptItem, decryptedCache]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, allResults.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === "Enter") {
        if (allResults[cursor]) {
          allResults[cursor].run();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cursor, allResults, onClose]);

  // Scroll active cursor row into viewport
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${cursor}"]`) as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // Grouped results map
  const groupedEntries = useMemo(() => {
    const groups: Record<string, Action[]> = {
      login: [],
      card: [],
      note: [],
      address: [],
      profile: []
    };
    entryResults.forEach(r => {
      if (r.template && groups[r.template]) {
        groups[r.template].push(r);
      }
    });
    return groups;
  }, [entryResults]);

  // Safe client-side payload obfuscation for right-pane previews
  const activePayload = useMemo(() => {
    if (!hoveredItem || hoveredItem.group !== "entry" || !hoveredItem.itemId) return null;
    const raw = decryptedCache[hoveredItem.itemId];
    if (!raw) return null;
    const copy = { ...raw };
    if (copy.password) copy.password = "••••••••";
    if (copy.cvv) copy.cvv = "•••";
    if (copy.pin) copy.pin = "••••";
    if (copy.cardNumber) {
      const clean = copy.cardNumber.replace(/\D/g, "");
      copy.cardNumber = clean.length > 4 ? `•••• •••• •••• ${clean.slice(-4)}` : "•••• •••• •••• ••••";
    }
    return copy;
  }, [hoveredItem, decryptedCache]);

  // Fuzzy matches with golden light up glows on chars
  const fuzzyHighlight = (text: string, queryText: string) => {
    if (!queryText.trim()) return <span>{text}</span>;
    const result: React.ReactNode[] = [];
    let queryIdx = 0;
    const lowerQuery = queryText.toLowerCase();

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (queryIdx < lowerQuery.length && char.toLowerCase() === lowerQuery[queryIdx]) {
        result.push(
          <span key={i} className="relative inline-block text-[var(--accent)] font-semibold gold-glow">
            {char}
          </span>
        );
        queryIdx++;
      } else {
        result.push(char);
      }
    }
    return <span>{result}</span>;
  };

  // Compile ordered indexes for flat layout rows
  let globalIndexTracker = 0;

  return (
    <>
      <div className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-md flex items-center justify-center p-0 md:p-6" onClick={onClose}>
        <div
          className="relative w-full max-w-4xl h-full md:h-[620px] flex flex-col rounded-none md:rounded-2xl border-0 md:border border-neutral-800 bg-neutral-950/90 shadow-[0_32px_64px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Spotlight Header Search input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-800 bg-neutral-900/40 shrink-0">
            <Search className="w-5 h-5 text-neutral-500 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items, settings, generator..."
              className="flex-1 bg-transparent text-[16px] text-neutral-100 placeholder-neutral-500 outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-neutral-500 hover:text-neutral-300 cursor-pointer p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Spotlight Split Columns Panel */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Pane: Results */}
            <div ref={listRef} className="w-full md:w-[480px] shrink-0 border-r border-neutral-800/80 overflow-y-auto py-2 flex flex-col">

              {/* History / Recent Queries */}
              {!query && searchHistory.length > 0 && (
                <div className="px-4 py-2 border-b border-neutral-800/30 mb-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-1.5">
                    <Clock className="w-3 h-3" /> Recent Searches
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {searchHistory.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => setQuery(h)}
                        className="text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Grouped Vault Item Entries */}
              {entryResults.length > 0 && (
                <>
                  {Object.entries(groupedEntries).map(([tplName, itemsList]) => {
                    if (itemsList.length === 0) return null;
                    const displayGroupTitle = tplName === "login" ? "Logins" :
                      tplName === "card" ? "Credit Cards" :
                        tplName === "note" ? "Secure Notes" :
                          tplName === "address" ? "Addresses" : "Profiles";
                    return (
                      <div key={tplName}>
                        <p className="px-5 py-1.5 text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">{displayGroupTitle}</p>
                        {itemsList.map(action => {
                          const idx = globalIndexTracker++;
                          return (
                            <ResultRow
                              key={action.id}
                              action={action}
                              active={idx === cursor}
                              index={idx}
                              queryText={query}
                              fuzzyHighlight={fuzzyHighlight}
                              onClick={() => action.run()}
                              onHover={() => setCursor(idx)}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Quick Actions */}
              {filteredActions.length > 0 && (
                <div>
                  <p className="px-5 py-1.5 text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                    {query ? "Settings & Actions" : "Quick Actions"}
                  </p>
                  {filteredActions.map(action => {
                    const idx = globalIndexTracker++;
                    return (
                      <ResultRow
                        key={action.id}
                        action={action}
                        active={idx === cursor}
                        index={idx}
                        queryText={query}
                        fuzzyHighlight={fuzzyHighlight}
                        onClick={() => action.run()}
                        onHover={() => setCursor(idx)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Empty state — cycling illustrations */}
              {allResults.length === 0 && (() => {
                const state = EMPTY_STATES[placeholderIndex];
                return (
                  <div className="flex-1 flex flex-col items-center justify-center py-6 px-6 text-center select-none">
                    <img
                      key={state.src}
                      src={state.src}
                      alt={state.title}
                      className="w-52 h-52 object-contain mb-5 opacity-90"
                    />
                    <p className="text-[13px] font-semibold text-neutral-200 tracking-tight mb-1">
                      {state.title}
                    </p>
                    <p className="text-[11px] text-neutral-500 italic max-w-[220px] leading-relaxed">
                      {state.caption}
                    </p>
                  </div>
                );
              })()}



            </div>

            {/* Right Pane: Live Hover Preview */}
            <div className="hidden md:flex flex-1 flex-col bg-neutral-950/25 p-6 overflow-y-auto justify-center items-center relative border-l border-neutral-900">
              {hoveredItem && hoveredItem.group === "entry" ? (
                activePayload ? (
                  <div className="w-full space-y-4 scale-95 origin-center animate-fade-in command-palette-preview">
                    <div className="flex items-center gap-2 mb-2 text-neutral-500 text-[10px] uppercase font-bold tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] animate-pulse" />
                      Live Vault Preview
                    </div>

                    <div className="relative rounded-2xl overflow-hidden shadow-2xl p-1 bg-neutral-900/30 border border-neutral-800">
                      <DynamicPreviewCanvas
                        template={hoveredItem.template}
                        name={hoveredItem.label}
                        username={activePayload.username}
                        url={activePayload.url || activePayload.urls?.[0]}
                        line1={activePayload.line1}
                        line2={activePayload.line2}
                        city={activePayload.city}
                        state={activePayload.state}
                        zip={activePayload.zip}
                        country={activePayload.country}
                        fullName={activePayload.fullName}
                        email={activePayload.email}
                        phone={activePayload.phone}
                        note={activePayload.note}
                        cardName={activePayload.cardName}
                        cardNumber={activePayload.cardNumber || ""}
                        expiry={activePayload.expiry}
                        cardBrand={activePayload.cardBrand}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-2">
                    <div className="w-8 h-8 border border-neutral-800 border-t-[var(--accent)] rounded-full animate-spin mx-auto" />
                    <span className="text-[11px] text-neutral-500">Decrypting metadata…</span>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center gap-3 text-center px-4">
                  <p className="text-[11px] text-neutral-600 leading-relaxed max-w-[160px]">
                    Hover an entry to see a live preview
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Spotlight Footer hint */}
          <div className="px-5 py-3.5 border-t border-neutral-800 bg-neutral-950 shrink-0 flex items-center gap-4 text-[10px] text-neutral-500 font-mono">
            <span><kbd className="bg-neutral-900 border border-neutral-800 px-1 py-0.5 rounded text-neutral-400">↑↓</kbd> navigate</span>
            <span><kbd className="bg-neutral-900 border border-neutral-800 px-1 py-0.5 rounded text-neutral-400">Enter</kbd> select</span>
            <span><kbd className="bg-neutral-900 border border-neutral-800 px-1 py-0.5 rounded text-neutral-400">Esc</kbd> close</span>
          </div>
        </div>
      </div>

      <style>{`
        .gold-glow {
          text-shadow: 0 0 6px rgba(251, 191, 36, 0.7);
          box-shadow: 0 1.5px 0 rgba(251, 191, 36, 0.8);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  );
}

function ResultRow({
  action,
  active,
  index,
  queryText,
  fuzzyHighlight,
  onClick,
  onHover
}: {
  action: Action;
  active: boolean;
  index: number;
  queryText: string;
  fuzzyHighlight: (t: string, q: string) => React.ReactNode;
  onClick: () => void;
  onHover: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      data-index={index}
      className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors cursor-pointer ${active ? "bg-neutral-900 text-neutral-100" : "text-neutral-400 hover:bg-neutral-900/40 hover:text-neutral-300"
        }`}
    >
      <span className={`shrink-0 transition-transform ${active ? "scale-110 text-[var(--accent)]" : "text-neutral-500"}`}>{action.icon}</span>
      <span className="flex-1 text-[13px] truncate">
        {fuzzyHighlight(action.label, queryText)}
      </span>
      {action.description && (
        <span className="text-[11px] text-neutral-600 truncate max-w-[140px] font-mono">{action.description}</span>
      )}
    </button>
  );
}

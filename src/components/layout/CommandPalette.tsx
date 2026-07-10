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

const PLACEHOLDERS = [
  "Even the NSA couldn't find that.",
  "Your secrets are safe from your own search.",
  "Nothing. Zero. The void is vast.",
  "404: Password not found in the simulation."
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

  // Cycling placeholder text when empty results
  useEffect(() => {
    const t = setInterval(() => {
      setPlaceholderIndex(i => (i + 1) % PLACEHOLDERS.length);
    }, 4500);
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

              {/* Empty state — Incognito Detective Silhouette */}
              {allResults.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center select-none">
                  <svg
                    viewBox="0 0 100 120"
                    className="w-[110px] h-[132px] mb-5"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <radialGradient id="glassGrad" cx="35%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#0a0f1a" />
                      </radialGradient>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>

                    {/* Ground shadow */}
                    <ellipse cx="50" cy="118" rx="22" ry="3.5" fill="black" opacity="0.3" />

                    {/* Trench coat body */}
                    <path d="M28 78 Q22 100 20 116 L80 116 Q78 100 72 78 Q61 84 50 84 Q39 84 28 78Z" fill="#141414" />
                    <line x1="50" y1="84" x2="50" y2="116" stroke="#222" strokeWidth="0.8" />
                    <path d="M50 84 L43 96 L47 116" stroke="#1f1f1f" strokeWidth="0.8" fill="none" />
                    <path d="M50 84 L57 96 L53 116" stroke="#1f1f1f" strokeWidth="0.8" fill="none" />

                    {/* Left raised shrug arm + hand */}
                    <path d="M32 80 Q18 74 12 62" stroke="#141414" strokeWidth="7" strokeLinecap="round" className="shrug-arm" />
                    <ellipse cx="11" cy="59" rx="5" ry="3.5" fill="#2a2a2a" transform="rotate(30 11 59)" />
                    <line x1="8" y1="56" x2="5" y2="52" stroke="#2a2a2a" strokeWidth="1.8" strokeLinecap="round" />
                    <line x1="10" y1="55" x2="9" y2="50" stroke="#2a2a2a" strokeWidth="1.8" strokeLinecap="round" />
                    <line x1="13" y1="55" x2="14" y2="50" stroke="#2a2a2a" strokeWidth="1.8" strokeLinecap="round" />

                    {/* Right arm — magnifier */}
                    <path d="M68 80 Q80 72 84 62" stroke="#141414" strokeWidth="7" strokeLinecap="round" />

                    {/* Magnifying glass */}
                    <g filter="url(#glow)">
                      <line x1="82" y1="66" x2="94" y2="80" stroke="#5c3d1e" strokeWidth="3.5" strokeLinecap="round" />
                      <line x1="84" y1="68" x2="87" y2="72" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                      <line x1="88" y1="73" x2="91" y2="77" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                      <circle cx="76" cy="58" r="12" stroke="#78350f" strokeWidth="2.5" fill="none" />
                      <circle cx="76" cy="58" r="10" fill="url(#glassGrad)" />
                      <path d="M69 52 A8 8 0 0 1 79 49" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" fill="none" className="lens-shine" />
                      <path d="M71 51 A3 3 0 0 1 75 50" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5" className="lens-shine-2" />
                    </g>

                    {/* Neck */}
                    <rect x="45" y="64" width="10" height="8" rx="3" fill="#232323" />

                    {/* Head */}
                    <ellipse cx="50" cy="50" rx="18" ry="16" fill="#1a1a1a" />

                    {/* Incognito glasses */}
                    <rect x="32" y="46" width="14" height="10" rx="5" fill="#0d0d0d" stroke="#333" strokeWidth="1" />
                    <rect x="54" y="46" width="14" height="10" rx="5" fill="#0d0d0d" stroke="#333" strokeWidth="1" />
                    <line x1="46" y1="51" x2="54" y2="51" stroke="#333" strokeWidth="1.2" />
                    <line x1="32" y1="51" x2="28" y2="50" stroke="#2a2a2a" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1="68" y1="51" x2="72" y2="50" stroke="#2a2a2a" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M34 48 Q36 47 38 48" stroke="#374151" strokeWidth="0.8" strokeLinecap="round" fill="none" />
                    <path d="M56 48 Q58 47 60 48" stroke="#374151" strokeWidth="0.8" strokeLinecap="round" fill="none" />

                    {/* Mouth — deadpan */}
                    <path d="M44 59 Q50 57 56 59" stroke="#2e2e2e" strokeWidth="1.5" strokeLinecap="round" fill="none" />

                    {/* Fedora brim */}
                    <ellipse cx="50" cy="33" rx="24" ry="4.5" fill="#0d0d0d" />
                    {/* Crown */}
                    <path d="M30 33 Q29 16 50 14 Q71 16 70 33Z" fill="#0a0a0a" />
                    {/* Crease */}
                    <path d="M38 20 Q50 17 62 20" stroke="#141414" strokeWidth="3" strokeLinecap="round" />
                    <path d="M39 20 Q50 18 61 20" stroke="#1c1c1c" strokeWidth="1" strokeLinecap="round" />
                    {/* Hat band — amber */}
                    <path d="M31 32 Q50 29 69 32" stroke="#d97706" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
                  </svg>

                  <p className="text-[12px] font-semibold text-neutral-300 tracking-tight mb-1.5">
                    Nothing here.
                  </p>
                  <p
                    key={placeholderIndex}
                    className="text-[11px] text-neutral-500 italic max-w-[240px] leading-relaxed placeholder-cycle"
                  >
                    &ldquo;{PLACEHOLDERS[placeholderIndex]}&rdquo;
                  </p>
                </div>
              )}

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
                <div className="flex flex-col items-center gap-4 text-center">
                  {/* Vault illustration */}
                  <svg viewBox="0 0 80 80" className="w-16 h-16 opacity-80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <radialGradient id="vaultGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#d97706" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    {/* Outer glow */}
                    <circle cx="40" cy="40" r="38" fill="url(#vaultGlow)" />
                    {/* Vault door body */}
                    <rect x="12" y="14" width="56" height="52" rx="6" fill="#111" stroke="#262626" strokeWidth="1.5" />
                    {/* Vault hinges */}
                    <rect x="12" y="22" width="6" height="8" rx="2" fill="#1f1f1f" stroke="#2a2a2a" strokeWidth="1" />
                    <rect x="12" y="50" width="6" height="8" rx="2" fill="#1f1f1f" stroke="#2a2a2a" strokeWidth="1" />
                    {/* Main dial ring */}
                    <circle cx="42" cy="40" r="16" stroke="#262626" strokeWidth="2" />
                    <circle cx="42" cy="40" r="12" stroke="#1f1f1f" strokeWidth="1.5" fill="#0d0d0d" />
                    {/* Dial notches */}
                    {[0,45,90,135,180,225,270,315].map((deg, i) => {
                      const rad = (deg * Math.PI) / 180;
                      const x1 = 42 + Math.cos(rad) * 13;
                      const y1 = 40 + Math.sin(rad) * 13;
                      const x2 = 42 + Math.cos(rad) * 15.5;
                      const y2 = 40 + Math.sin(rad) * 15.5;
                      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#333" strokeWidth="1.2" strokeLinecap="round" />;
                    })}
                    {/* Dial pointer (amber accent) */}
                    <line x1="42" y1="40" x2="42" y2="29" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" className="vault-dial" />
                    {/* Center knob */}
                    <circle cx="42" cy="40" r="3" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
                    <circle cx="42" cy="40" r="1.2" fill="#d97706" opacity="0.7" />
                    {/* Lock bolts */}
                    <circle cx="62" cy="26" r="3.5" fill="none" stroke="#222" strokeWidth="1.5" />
                    <circle cx="62" cy="54" r="3.5" fill="none" stroke="#222" strokeWidth="1.5" />
                    {/* Handle */}
                    <rect x="22" y="37" width="10" height="6" rx="3" fill="#161616" stroke="#2a2a2a" strokeWidth="1" />
                  </svg>

                  <div className="space-y-1">
                    <p className="text-[12px] font-semibold text-neutral-400 tracking-tight">Vault Preview</p>
                    <p className="text-[11px] text-neutral-600 leading-relaxed max-w-[180px]">
                      Hover an entry to see a live secure preview
                    </p>
                  </div>
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
        @keyframes lensShine {
          0%   { opacity: 0.15; stroke-dashoffset: 0; }
          45%  { opacity: 1; }
          100% { opacity: 0.15; stroke-dashoffset: -14; }
        }
        @keyframes lensShine2 {
          0%, 100% { opacity: 0; }
          35%, 65%  { opacity: 0.6; }
        }
        @keyframes shrugBob {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-4px); }
        }
        @keyframes vaultDialSpin {
          0%   { transform: rotate(0deg); transform-origin: 42px 40px; }
          100% { transform: rotate(360deg); transform-origin: 42px 40px; }
        }
        .lens-shine {
          stroke-dasharray: 14;
          animation: lensShine 3s ease-in-out infinite;
        }
        .lens-shine-2 {
          animation: lensShine2 3s ease-in-out infinite 0.6s;
        }
        .shrug-arm {
          transform-origin: 32px 80px;
          animation: shrugBob 2.5s ease-in-out infinite;
        }
        .vault-dial {
          transform-origin: 42px 40px;
          animation: vaultDialSpin 8s linear infinite;
        }
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
        @keyframes placeholderFade {
          0% { opacity: 0; transform: translateY(4px); }
          12% { opacity: 1; transform: translateY(0); }
          88% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        .placeholder-cycle {
          animation: placeholderFade 4.5s ease-in-out;
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

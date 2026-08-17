"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Lock, Settings, Plus, Wand2, X, Heart, Fingerprint, Clock,
  Shield, Sparkles, CreditCard, Globe, User, FileText, Edit2, Copy, Check, ExternalLink
} from "lucide-react";
import { useVault } from "@/context/VaultContext";
import { DynamicPreviewCanvas } from "@/components/vault/DialogPreviews";
import { SiteIcon } from "@/components/vault/SiteIcon";

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
  onEdit?: () => void;
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
    src: "/illustrations/treasure_a4j2.svg",
    title: "Buried Somewhere Deep",
    caption: "It's out there. Probably under an X on a map.",
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
    src: "/illustrations/the-void_i26b.svg",
    title: "The Void Stares Back",
    caption: "Nothing. Zero. The void is vast.",
  },
  {
    src: "/illustrations/peekaboo_5o8i.svg",
    title: "Peekaboo!",
    caption: "It's hiding. It knows you're looking.",
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const copyVal = (val: string, key: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

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
    }, 7000);
    return () => clearInterval(t);
  }, []);

  // Actions list
  const ACTIONS: Action[] = useMemo(() => [
    { id: "new-login", label: "New Login", icon: <Plus className="w-4 h-4" />, run: () => { router.push("/vault?new=login"); onClose(); }, group: "action" },
    { id: "new-card", label: "New Credit Card", icon: <Plus className="w-4 h-4" />, run: () => { router.push("/vault?new=card"); onClose(); }, group: "action" },
    { id: "new-note", label: "New Secure Note", icon: <Plus className="w-4 h-4" />, run: () => { router.push("/vault?new=note"); onClose(); }, group: "action" },
    { id: "lock", label: "Lock Vault", icon: <Lock className="w-4 h-4" />, run: () => { lock(); onClose(); }, group: "action" },
    { id: "health", label: "Password Health", icon: <Heart className="w-4 h-4" />, run: () => { router.push("/vault/health"); onClose(); }, group: "action" },
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
      .map((item) => {
        const template = item.template || "login";
        let icon: React.ReactNode;

        if (template === "login") {
          icon = <SiteIcon domain={item.domain} name={item.name} size={18} />;
        } else if (template === "card") {
          icon = <CreditCard className="w-4 h-4 text-violet-400" />;
        } else if (template === "address") {
          icon = <Globe className="w-4 h-4 text-emerald-400" />;
        } else if (template === "profile") {
          icon = <User className="w-4 h-4 text-sky-400" />;
        } else if (template === "note") {
          icon = <FileText className="w-4 h-4 text-amber-400" />;
        } else {
          icon = <Shield className="w-4 h-4 text-neutral-400" />;
        }

        return {
          id: `entry-${item.id}`,
          itemId: item.id,
          label: item.name,
          description: item.domain || item.folder,
          icon,
          run: () => {
            saveToHistory(query);
            router.push(`/vault?reveal=${item.id}`);
            onClose();
          },
          onEdit: () => {
            saveToHistory(query);
            router.push(`/vault?edit=${item.id}`);
            onClose();
          },
          group: "entry" as const,
          template,
        };
      });
  }, [items, query, router, onClose, saveToHistory]);

  const filteredActions: Action[] = useMemo(() => {
    if (!query.trim()) return ACTIONS;
    return ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));
  }, [ACTIONS, query]);

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
      const t = r.template || "login";
      if (groups[t]) {
        groups[t].push(r);
      } else {
        groups.login.push(r);
      }
    });
    return groups;
  }, [entryResults]);

  // Flatten results strictly matching the DOM grouping order
  const allResults: Action[] = useMemo(() => {
    const orderedEntries: Action[] = [
      ...groupedEntries.login,
      ...groupedEntries.card,
      ...groupedEntries.note,
      ...groupedEntries.address,
      ...groupedEntries.profile,
    ];
    return [...orderedEntries, ...filteredActions];
  }, [groupedEntries, filteredActions]);

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
          if (!parsed._template && (parsed.username || parsed.password)) parsed._template = targetItem.template || "login";
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

  // Full decrypted payload for right-pane previews
  const activePayload = useMemo(() => {
    if (!hoveredItem || hoveredItem.group !== "entry" || !hoveredItem.itemId) return null;
    return decryptedCache[hoveredItem.itemId] || null;
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
          <span key={i} className="relative inline-block text-[var(--accent,#6366f1)] font-semibold gold-glow">
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
            <div className="hidden md:flex flex-1 flex-col bg-neutral-950/40 p-6 overflow-y-auto justify-center items-center relative border-l border-neutral-900">
              {hoveredItem && hoveredItem.group === "entry" ? (
                activePayload ? (
                  <div className="w-full space-y-4 scale-95 origin-center animate-fade-in command-palette-preview">
                    {/* Header: Title + Action controls */}
                    <div className="flex items-center justify-between gap-2 mb-2 w-full">
                      <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-[var(--accent,#6366f1)] animate-pulse" />
                        Live Vault Preview
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            saveToHistory(query);
                            router.push(`/vault?edit=${hoveredItem.itemId}`);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 hover:border-neutral-700 transition-all cursor-pointer shadow-sm"
                          title="Edit this item"
                        >
                          <Edit2 className="w-3 h-3 text-neutral-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            saveToHistory(query);
                            router.push(`/vault?reveal=${hoveredItem.itemId}`);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-100 text-neutral-900 hover:bg-white transition-all cursor-pointer shadow-sm"
                          title="Open in Vault"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open</span>
                        </button>
                      </div>
                    </div>

                    {/* Card Canvas */}
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl p-1 bg-neutral-900/30 border border-neutral-800">
                      {(() => {
                        const targetItem = items.find(x => x.id === hoveredItem.itemId);
                        const resolvedTemplate = targetItem?.template || activePayload._template || hoveredItem.template || "login";
                        return (
                          <DynamicPreviewCanvas
                            template={resolvedTemplate}
                            name={targetItem?.name || hoveredItem.label}
                            username={activePayload.username}
                            url={activePayload.url || (activePayload.urls && activePayload.urls[0]) || targetItem?.domain}
                            line1={activePayload.line1 || activePayload.street}
                            line2={activePayload.line2}
                            city={activePayload.city}
                            state={activePayload.state}
                            zip={activePayload.zip}
                            country={activePayload.country}
                            fullName={activePayload.fullName}
                            email={activePayload.email}
                            phone={activePayload.phone}
                            dob={activePayload.dob}
                            idNumber={activePayload.idNumber}
                            note={activePayload.note || activePayload.entryNotes || (typeof activePayload.payload === "string" ? activePayload.payload : "")}
                            cardName={activePayload.cardholderName || activePayload.cardName || targetItem?.name || hoveredItem.label}
                            cardNumber={activePayload.cardNumber || ""}
                            expiry={activePayload.expiry || (activePayload.expMonth && activePayload.expYear ? `${activePayload.expMonth}/${activePayload.expYear.length === 4 ? activePayload.expYear.slice(-2) : activePayload.expYear}` : "")}
                            cardBrand={activePayload.cardBrand || activePayload.brand}
                            fallbackBrand={activePayload.fallbackBrand}
                          />
                        );
                      })()}
                    </div>

                    {/* Quick Copy Action Pills */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      {activePayload.username && (
                        <button
                          type="button"
                          onClick={() => copyVal(activePayload.username, "user")}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer"
                          title="Copy Username"
                        >
                          {copiedKey === "user" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-500" />}
                          <span className="truncate max-w-[120px]">{activePayload.username}</span>
                        </button>
                      )}
                      {activePayload.password && (
                        <button
                          type="button"
                          onClick={() => copyVal(activePayload.password, "pass")}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer"
                          title="Copy Password"
                        >
                          {copiedKey === "pass" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-500" />}
                          <span>Password</span>
                        </button>
                      )}
                      {activePayload.cardNumber && (
                        <button
                          type="button"
                          onClick={() => copyVal(activePayload.cardNumber.replace(/\s+/g, ""), "card")}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer"
                          title="Copy Card Number"
                        >
                          {copiedKey === "card" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-500" />}
                          <span>Card Number</span>
                        </button>
                      )}
                      {activePayload.cvv && (
                        <button
                          type="button"
                          onClick={() => copyVal(activePayload.cvv, "cvv")}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer"
                          title="Copy CVV"
                        >
                          {copiedKey === "cvv" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-500" />}
                          <span>CVV</span>
                        </button>
                      )}
                      {activePayload.note && (
                        <button
                          type="button"
                          onClick={() => copyVal(activePayload.note, "note")}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer"
                          title="Copy Note"
                        >
                          {copiedKey === "note" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-500" />}
                          <span>Copy Note</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-2">
                    <div className="w-8 h-8 border border-neutral-800 border-t-[var(--accent,#6366f1)] rounded-full animate-spin mx-auto" />
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
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      data-index={index}
      className={`group/row w-full flex items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors cursor-pointer ${
        active ? "bg-neutral-900 text-neutral-100" : "text-neutral-400 hover:bg-neutral-900/40 hover:text-neutral-300"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className={`shrink-0 transition-transform ${active ? "scale-110 text-[var(--accent)]" : "text-neutral-500"}`}>
          {action.icon}
        </span>
        <span className="flex-1 text-[13px] truncate">
          {fuzzyHighlight(action.label, queryText)}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {action.description && (
          <span className="text-[11px] text-neutral-600 truncate max-w-[130px] font-mono hidden sm:inline-block">
            {action.description}
          </span>
        )}

        {action.onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              action.onEdit?.();
            }}
            className="opacity-0 group-hover/row:opacity-100 p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-all cursor-pointer"
            title="Edit Item"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

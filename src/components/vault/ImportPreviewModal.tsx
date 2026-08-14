"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  X,
  Upload,
  Search,
  KeyRound,
  CreditCard,
  FileText,
  Folder,
  Trash2,
  AlertTriangle,
  Loader2,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  type ParsedImportItem,
  type ConflictMode,
  type DuplicateCheckResult,
  checkDuplicateItemsBatch,
} from "@vaultr/core";

interface DecryptedExistingItem {
  id: string;
  name: string;
  domain?: string | null;
  template?: string | null;
  username?: string | null;
}

interface ImportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  fileName: string;
  initialItems: ParsedImportItem[];
  existingItems: DecryptedExistingItem[];
  onConfirmImport: (
    itemsToImport: ParsedImportItem[],
    conflictMode: ConflictMode,
    duplicateMap: Map<string, DuplicateCheckResult>
  ) => Promise<void>;
  importSaving: boolean;
  importProgress: number | null;
}

const PAGE_SIZE = 50;

export function ImportPreviewModal({
  open,
  onClose,
  fileName,
  initialItems,
  existingItems,
  onConfirmImport,
  importSaving,
  importProgress,
}: ImportPreviewModalProps) {
  const [items, setItems] = useState<ParsedImportItem[]>(initialItems);
  const [conflictMode, setConflictMode] = useState<ConflictMode>("skip");
  const [searchFilter, setSearchFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Sync internal state when initialItems update
  useEffect(() => {
    setItems(initialItems);
    setSearchFilter("");
    setCurrentPage(1);
  }, [initialItems]);

  // Handle ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !importSaving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, importSaving, onClose]);

  // Fast O(1) batch duplicate detection
  const duplicateMap = useMemo(() => {
    return checkDuplicateItemsBatch(items, existingItems);
  }, [items, existingItems]);

  // Computed statistics
  const stats = useMemo(() => {
    let logins = 0,
      cards = 0,
      notes = 0,
      addresses = 0,
      profiles = 0,
      passkeys = 0,
      duplicates = 0;
    const folderSet = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const t = item.payload?._template || item.template || "login";
      if (item.payload?.isPasskey) passkeys++;
      if (t === "login") logins++;
      else if (t === "card") cards++;
      else if (t === "note") notes++;
      else if (t === "address") addresses++;
      else if (t === "profile") profiles++;

      if (item.folder) folderSet.add(item.folder);

      if (duplicateMap.get(item.id)?.isDuplicate) {
        duplicates++;
      }
    }

    return {
      logins,
      cards,
      notes,
      addresses,
      profiles,
      passkeys,
      duplicates,
      folders: folderSet.size,
    };
  }, [items, duplicateMap]);

  // Filtered items list
  const filteredItems = useMemo(() => {
    if (!searchFilter.trim()) return items;
    const query = searchFilter.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.payload?.username &&
          item.payload.username.toLowerCase().includes(query)) ||
        (item.payload?.email &&
          item.payload.email.toLowerCase().includes(query)) ||
        (item.payload?.url && item.payload.url.toLowerCase().includes(query)) ||
        (item.folder && item.folder.toLowerCase().includes(query))
    );
  }, [items, searchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter]);

  // Paginated window
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  // Effective import count
  const effectiveImportCount = useMemo(() => {
    if (conflictMode === "skip") {
      let count = 0;
      for (let i = 0; i < items.length; i++) {
        if (!duplicateMap.get(items[i].id)?.isDuplicate) {
          count++;
        }
      }
      return count;
    }
    return items.length;
  }, [items, duplicateMap, conflictMode]);

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateTemplate = (
    id: string,
    newTemplate: "login" | "card" | "note" | "address" | "profile"
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          return {
            ...it,
            template: newTemplate,
            payload: { ...it.payload, _template: newTemplate },
          };
        }
        return it;
      })
    );
  };

  const handleConfirm = async () => {
    await onConfirmImport(items, conflictMode, duplicateMap);
  };

  if (!open || initialItems.length === 0) return null;

  const startRange = (currentPage - 1) * PAGE_SIZE + 1;
  const endRange = Math.min(currentPage * PAGE_SIZE, filteredItems.length);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!importSaving) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-neutral-950 border border-neutral-800/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={importSaving}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors cursor-pointer disabled:opacity-50 z-20"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Minimal Hero Header */}
        <div className="px-6 pt-6 pb-4 border-b border-neutral-800/60 bg-neutral-950/80">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-500/10 rounded-xl blur-lg pointer-events-none" />
              <Image
                src="/illustrations/all-the-data_ijgn.svg"
                alt="Import data"
                width={48}
                height={48}
                className="object-contain relative z-10"
                priority
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-neutral-100">
                  Import Preview
                </h2>
                {fileName && (
                  <span className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 font-mono truncate max-w-[220px]">
                    {fileName}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-neutral-400 mt-0.5">
                Found <span className="text-neutral-200 font-medium">{items.length} items</span> across {stats.folders} folder{stats.folders === 1 ? "" : "s"}. Review or adjust before adding to your vault.
              </p>
            </div>
          </div>

          {/* Quick Segmented Conflict Selector + Stat Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="flex items-center bg-neutral-900/90 p-1 rounded-xl border border-neutral-800/80">
              {(
                [
                  { id: "skip", label: "Skip Duplicates" },
                  { id: "overwrite", label: "Overwrite Existing" },
                  { id: "create_all", label: "Keep Both" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setConflictMode(mode.id)}
                  disabled={importSaving}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                    conflictMode === mode.id
                      ? "bg-neutral-100 text-neutral-900 font-semibold shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Inline Stats Chips */}
            <div className="flex items-center gap-2 text-[11px] text-neutral-400 flex-wrap">
              {stats.duplicates > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  {stats.duplicates} Duplicate{stats.duplicates === 1 ? "" : "s"}
                </span>
              )}
              {stats.logins > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300">
                  <KeyRound className="w-3 h-3 text-emerald-400" /> {stats.logins} Logins
                </span>
              )}
              {stats.cards > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300">
                  <CreditCard className="w-3 h-3 text-blue-400" /> {stats.cards} Cards
                </span>
              )}
              {stats.notes > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300">
                  <FileText className="w-3 h-3 text-amber-400" /> {stats.notes} Notes
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Minimal Search Field */}
        <div className="px-6 py-2.5 border-b border-neutral-800/40 bg-neutral-950">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search items by name, username, URL, or folder…"
              className="w-full bg-neutral-900/60 border border-neutral-800/70 rounded-xl pl-9 pr-8 py-2 text-[12px] text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition-all"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-500 hover:text-neutral-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Table Content (Windowed) */}
        <div className="flex-1 overflow-y-auto min-h-[260px] max-h-[360px]">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead className="bg-neutral-950 sticky top-0 border-b border-neutral-800/80 z-10">
              <tr className="text-neutral-500 text-[11px] font-medium">
                <th className="px-6 py-2">Item</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Username / Target</th>
                <th className="px-3 py-2">Folder</th>
                <th className="px-6 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-neutral-500 text-[12px]">
                    No entries match your search.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const dup = duplicateMap.get(item.id);
                  const isDuplicate = dup?.isDuplicate ?? false;
                  const templateVal =
                    item.payload?._template || item.template || "login";
                  const targetStr =
                    item.payload?.username ||
                    item.payload?.email ||
                    item.payload?.url ||
                    (item.payload?.urls && item.payload.urls[0]) ||
                    "—";

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-neutral-900/40 transition-colors ${
                        isDuplicate ? "bg-amber-950/10" : ""
                      }`}
                    >
                      {/* Name & Duplicate status */}
                      <td className="px-6 py-2.5 text-neutral-200">
                        <div className="flex items-center gap-2 max-w-[200px]">
                          <span className="font-medium truncate" title={item.name}>
                            {item.name || "Untitled"}
                          </span>
                          {isDuplicate && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-medium shrink-0 flex items-center gap-1"
                              title={`Matches: ${dup?.matchedItemName || item.name} (${dup?.matchType})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                              Duplicate
                            </span>
                          )}
                          {item.payload?.isPasskey && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium shrink-0">
                              Passkey
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Template Selector */}
                      <td className="px-3 py-2.5">
                        <select
                          value={templateVal}
                          onChange={(e) =>
                            handleUpdateTemplate(item.id, e.target.value as any)
                          }
                          disabled={importSaving}
                          className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] rounded-lg px-2 py-0.5 focus:outline-none focus:border-neutral-600 cursor-pointer"
                        >
                          <option value="login">Login</option>
                          <option value="card">Card</option>
                          <option value="note">Note</option>
                          <option value="address">Address</option>
                          <option value="profile">Profile</option>
                        </select>
                      </td>

                      {/* Username or Target */}
                      <td
                        className="px-3 py-2.5 text-neutral-400 truncate max-w-[160px]"
                        title={targetStr}
                      >
                        {targetStr}
                      </td>

                      {/* Folder */}
                      <td className="px-3 py-2.5 text-neutral-400 truncate max-w-[130px]">
                        {item.folder ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-neutral-300">
                            <Folder className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">{item.folder}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>

                      {/* Remove action */}
                      <td className="px-6 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={importSaving}
                          className="p-1 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
                          title="Remove from import"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Minimal Pagination bar */}
        {filteredItems.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-2 border-t border-neutral-800/60 bg-neutral-950 text-[11px] text-neutral-500">
            <span>
              Showing {startRange}–{endRange} of {filteredItems.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || importSaving}
                className="p-1 text-neutral-400 hover:text-neutral-100 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-neutral-400">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || importSaving}
                className="p-1 text-neutral-400 hover:text-neutral-100 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Focused Footer Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800/80 bg-neutral-950">
          <div className="text-[12px] text-neutral-400">
            {conflictMode === "skip" && stats.duplicates > 0 ? (
              <span>
                <span className="text-emerald-400 font-medium">{effectiveImportCount} new</span> items will be imported ({stats.duplicates} duplicates skipped)
              </span>
            ) : conflictMode === "overwrite" && stats.duplicates > 0 ? (
              <span>
                <span className="text-emerald-400 font-medium">{effectiveImportCount - stats.duplicates} new</span>, <span className="text-blue-400 font-medium">{stats.duplicates} existing</span> items updated
              </span>
            ) : (
              <span>
                Ready to import <span className="text-emerald-400 font-medium">{effectiveImportCount}</span> items
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={importSaving}
              className="px-4 py-2 text-[13px] font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={importSaving || effectiveImportCount === 0}
              className="px-5 py-2.5 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 font-semibold text-[13px] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {importSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-900" />
                  <span>
                    Importing {importProgress !== null ? `${importProgress}%` : "…"}
                  </span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-neutral-900" />
                  <span>Import {effectiveImportCount} Item{effectiveImportCount === 1 ? "" : "s"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

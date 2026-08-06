"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Folder, FolderOpen, ChevronDown, Check, Plus, X, Search,
  Inbox, FolderPlus, CornerDownRight
} from "lucide-react";
import { useVault } from "@/context/VaultContext";
import { buildFolderTree, FolderNode } from "@/components/layout/Sidebar";

interface FolderSelectProps {
  value: string;
  onChange: (val: string) => void;
  folders: string[];
  placeholder?: string;
  className?: string;
}

interface FlattenedOption {
  name: string;
  label: string;
  depth: number;
}

function flattenTree(nodes: FolderNode[]): FlattenedOption[] {
  const result: FlattenedOption[] = [];
  function traverse(n: FolderNode) {
    result.push({ name: n.name, label: n.label, depth: n.depth });
    n.children.forEach(traverse);
  }
  nodes.forEach(traverse);
  return result;
}

export function FolderSelect({
  value,
  onChange,
  folders,
  placeholder = "No folder",
  className = "",
}: FolderSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const { addCustomFolder } = useVault();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus input when creating
  useEffect(() => {
    if (creating) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [creating]);

  // Ensure current value is included in list
  const mergedFolders = useMemo(() => {
    const set = new Set(folders);
    if (value) {
      const segs = value.split("/").filter(Boolean);
      for (let i = 1; i <= segs.length; i++) {
        set.add(segs.slice(0, i).join("/"));
      }
    }
    return Array.from(set).sort();
  }, [folders, value]);

  const tree = useMemo(() => buildFolderTree(mergedFolders), [mergedFolders]);
  const flatOptions = useMemo(() => flattenTree(tree), [tree]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return flatOptions;
    const q = search.toLowerCase();
    return flatOptions.filter(
      opt => opt.name.toLowerCase().includes(q) || opt.label.toLowerCase().includes(q)
    );
  }, [flatOptions, search]);

  const handleCreateConfirm = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) { setCreating(false); return; }
    addCustomFolder(trimmed);
    onChange(trimmed);
    setNewFolderName("");
    setCreating(false);
    setOpen(false);
    setSearch("");
  };

  // Breadcrumb formatting for display
  const displayLabel = useMemo(() => {
    if (!value) return placeholder;
    return value.split("/").join(" › ");
  }, [value, placeholder]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 bg-[var(--bg,#0a0a0a)] border border-[var(--border,#262626)] rounded-lg px-3 py-2 text-[12px] text-[var(--fg,#e5e5e5)] outline-none hover:border-neutral-700 focus:border-[var(--accent,#6366f1)] transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {value ? (
            <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[var(--accent,#6366f1)]" />
          ) : (
            <Inbox className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
          )}
          <span className={`truncate ${value ? "text-neutral-200 font-medium" : "text-neutral-500"}`}>
            {displayLabel}
          </span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              onClick={e => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-0.5 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
              title="Clear folder"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[200] bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden py-1 text-[12px]">
          {/* Search bar */}
          {flatOptions.length > 5 && (
            <div className="px-2 py-1 border-b border-neutral-800/80">
              <div className="flex items-center gap-2 bg-neutral-900 rounded-md px-2 py-1 text-neutral-400">
                <Search className="w-3 h-3 shrink-0 text-neutral-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter folders…"
                  className="w-full bg-transparent text-[11px] text-neutral-200 placeholder-neutral-600 outline-none"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="hover:text-neutral-200 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-neutral-800">
            {/* "No folder" Option */}
            {!search && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
                  !value ? "bg-neutral-800/80 text-neutral-100" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Inbox className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                  <span>No folder (Uncategorized)</span>
                </span>
                {!value && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              </button>
            )}

            {!search && flatOptions.length > 0 && (
              <div className="h-px bg-neutral-800/80 my-1 mx-2" />
            )}

            {/* Folder list */}
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-neutral-600 text-center">
                No matching folders
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = value === opt.name;
                const indentPx = opt.depth * 14;

                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => { onChange(opt.name); setOpen(false); setSearch(""); }}
                    className={`w-full flex items-center justify-between py-1.5 pr-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-neutral-800 text-neutral-100 font-medium"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                    style={{ paddingLeft: `${12 + indentPx}px` }}
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1 truncate">
                      {opt.depth > 0 && (
                        <CornerDownRight className="w-3 h-3 shrink-0 text-neutral-600 -mr-0.5" />
                      )}
                      {isSelected ? (
                        <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[var(--accent,#6366f1)]" />
                      ) : (
                        <Folder className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>

          {/* "+ New Folder" Inline Creator */}
          <div className="border-t border-neutral-800/80 pt-1 px-1 mt-1">
            {creating ? (
              <div className="flex items-center gap-1 p-1 bg-neutral-900 rounded-lg border border-[var(--accent,#6366f1)]/40">
                <FolderPlus className="w-3.5 h-3.5 text-neutral-500 shrink-0 ml-1" />
                <input
                  ref={inputRef}
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); handleCreateConfirm(); }
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder="e.g. Work/Projects"
                  className="w-full bg-transparent text-[11px] text-neutral-200 placeholder-neutral-600 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateConfirm}
                  className="p-1 rounded text-emerald-400 hover:bg-emerald-950/40 cursor-pointer shrink-0"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="p-1 rounded text-neutral-500 hover:text-neutral-300 cursor-pointer shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors cursor-pointer text-left"
              >
                <Plus className="w-3.5 h-3.5 text-neutral-500" />
                <span>New folder…</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

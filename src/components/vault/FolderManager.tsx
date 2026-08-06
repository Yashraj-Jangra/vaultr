"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Folder, FolderOpen, FolderPlus, Pencil, Trash2, Check, X,
  ChevronRight, ChevronDown, AlertTriangle, Loader2, Info,
  CornerDownRight, HardDrive,
} from "lucide-react";
import { useVault } from "@/context/VaultContext";
import { buildFolderTree, FolderNode } from "@/components/layout/Sidebar";
import { useRouter } from "next/navigation";
import { DeleteFolderModal } from "./DeleteFolderModal";

interface FolderManagerProps {
  open: boolean;
  onClose: () => void;
}

// ── Inline input shared component ─────────────────────────────────────────────

interface InlineFMInputProps {
  initialValue?: string;
  placeholder?: string;
  onConfirm: (v: string) => Promise<void> | void;
  onCancel: () => void;
  depth: number;
}

function InlineFMInput({ initialValue = "", placeholder = "folder name", onConfirm, onCancel, depth }: InlineFMInputProps) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => { ref.current?.focus(); if (initialValue) ref.current?.select(); }, 30);
  }, [initialValue]);

  const confirm = async () => {
    const t = value.trim();
    if (!t) { onCancel(); return; }
    setBusy(true);
    try { await onConfirm(t); }
    finally { setBusy(false); }
  };

  return (
    <div
      className="flex items-center gap-1.5 py-1.5 px-2 my-0.5 rounded-lg bg-neutral-900 border border-[var(--accent,#6366f1)]/40"
      style={{ marginLeft: `${depth * 20 + 4}px` }}
    >
      <FolderPlus className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
      <input
        ref={ref}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); confirm(); }
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-[13px] text-neutral-200 placeholder-neutral-600 outline-none"
      />
      <button
        onClick={confirm}
        disabled={busy}
        className="p-1 rounded text-emerald-400 hover:bg-emerald-950/30 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={onCancel}
        className="p-1 rounded text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── FolderExplorerNode ─────────────────────────────────────────────────────────

type FMNodeState =
  | { type: "idle" }
  | { type: "renaming" }
  | { type: "creating-child" };

interface FolderExplorerNodeProps {
  node: FolderNode;
  items: { folder?: string; deletedAt?: string | null }[];
  collapsedSet: Set<string>;
  onToggle: (path: string) => void;
  onRename: (from: string, to: string) => Promise<void>;
  onRequestDelete: (name: string, count: number) => void;
  onCreateChild: (parent: string, childName: string) => void;
  onNavigate: (path: string) => void;
}

function FolderExplorerNode({
  node, items, collapsedSet, onToggle,
  onRename, onRequestDelete, onCreateChild, onNavigate,
}: FolderExplorerNodeProps) {
  const [state, setState] = useState<FMNodeState>({ type: "idle" });
  const isCollapsed = collapsedSet.has(node.name);
  const hasChildren = node.children.length > 0;
  const isCreatingChild = state.type === "creating-child";
  const showChildren = (hasChildren || isCreatingChild) && !isCollapsed;
  const MAX_DEPTH = 2;

  const liveItems = items.filter(i => !i.deletedAt);
  const desc = [node.name];
  const collect = (n: FolderNode) => n.children.forEach(c => { desc.push(c.name); collect(c); });
  collect(node);
  const directCount = liveItems.filter(i => i.folder === node.name).length;
  const totalCount  = liveItems.filter(i => i.folder && desc.includes(i.folder)).length;

  const handleRenameConfirm = async (newLabel: string) => {
    const prefix = node.name.includes("/") ? node.name.slice(0, node.name.lastIndexOf("/") + 1) : "";
    await onRename(node.name, prefix + newLabel);
    setState({ type: "idle" });
  };

  return (
    <div className="select-none">
      {/* Rename inline */}
      {state.type === "renaming" ? (
        <InlineFMInput
          initialValue={node.label}
          placeholder="folder name"
          onConfirm={handleRenameConfirm}
          onCancel={() => setState({ type: "idle" })}
          depth={node.depth}
        />
      ) : (
        <div
          className="group flex items-center gap-1 py-1.5 px-2 rounded-lg transition-all duration-150 cursor-default hover:bg-neutral-800/50"
          style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        >
          {/* Expand toggle */}
          <button
            onClick={() => onToggle(node.name)}
            className={`shrink-0 w-4 h-4 flex items-center justify-center rounded transition-colors cursor-pointer ${
              hasChildren || isCreatingChild
                ? "text-neutral-600 hover:text-neutral-300"
                : "opacity-0 pointer-events-none"
            }`}
          >
            {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Folder icon */}
          {isCollapsed || !showChildren
            ? <Folder className="w-4 h-4 shrink-0 text-neutral-500" />
            : <FolderOpen className="w-4 h-4 shrink-0 text-neutral-400" />
          }

          {/* Name + counts */}
          <button
            onClick={() => onNavigate(node.name)}
            className="flex-1 flex items-center gap-2 min-w-0 text-left"
          >
            <span className="text-[13px] text-neutral-300 truncate flex-1">{node.label}</span>
            {totalCount > 0 && (
              <span className="text-[11px] font-mono text-neutral-600 bg-neutral-900/60 px-1.5 py-0.5 rounded shrink-0">
                {hasChildren && totalCount !== directCount ? `${directCount}/${totalCount}` : totalCount}
              </span>
            )}
          </button>

          {/* Hover actions */}
          {state.type === "idle" && (
            <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {node.depth < MAX_DEPTH && (
                <button
                  onClick={() => { if (collapsedSet.has(node.name)) onToggle(node.name); setState({ type: "creating-child" }); }}
                  className="p-1 rounded text-neutral-600 hover:text-neutral-300 hover:bg-neutral-700/60 transition-colors cursor-pointer"
                  title="New subfolder"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setState({ type: "renaming" })}
                className="p-1 rounded text-neutral-600 hover:text-neutral-300 hover:bg-neutral-700/60 transition-colors cursor-pointer"
                title="Rename"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onRequestDelete(node.name, totalCount)}
                className="p-1 rounded text-neutral-600 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                title="Delete folder"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Children + create-child input */}
      {showChildren && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 border-l border-neutral-800/50"
            style={{ left: `${node.depth * 20 + 15}px` }}
          />
          {node.children.map(child => (
            <FolderExplorerNode
              key={child.name}
              node={child}
              items={items}
              collapsedSet={collapsedSet}
              onToggle={onToggle}
              onRename={onRename}
              onRequestDelete={onRequestDelete}
              onCreateChild={onCreateChild}
              onNavigate={onNavigate}
            />
          ))}
          {isCreatingChild && (
            <InlineFMInput
              placeholder="subfolder name"
              onConfirm={async name => { onCreateChild(node.name, name); setState({ type: "idle" }); }}
              onCancel={() => setState({ type: "idle" })}
              depth={node.depth + 1}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── FolderManager modal ───────────────────────────────────────────────────────

export function FolderManager({ open, onClose }: FolderManagerProps) {
  const { folders, items, addCustomFolder, renameFolder, deleteFolder } = useVault();
  const router = useRouter();

  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());
  const [creatingRoot, setCreatingRoot] = useState(false);
  const [error, setError] = useState("");
  const [deleteFolderModalState, setDeleteFolderModalState] = useState<{
    open: boolean;
    folderName: string;
    itemCount: number;
  } | null>(null);

  const liveItems = items.filter(i => !i.deletedAt);
  const folderTree = buildFolderTree(folders);

  useEffect(() => {
    if (!open) { setCreatingRoot(false); setError(""); }
  }, [open]);

  const toggleNode = useCallback((path: string) => {
    setCollapsedSet(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const handleRename = async (from: string, to: string) => {
    try {
      setError("");
      if (from === to) return;
      const segs = to.split("/").filter(Boolean);
      if (segs.length > 3) { setError("Max 3 folder levels allowed"); return; }
      await renameFolder(from, to);
    } catch {
      setError("Failed to rename folder");
    }
  };

  const handleDelete = async (name: string, disposition: "uncategorize" | "trash") => {
    try {
      setError("");
      await deleteFolder(name, disposition);
    } catch {
      setError("Failed to delete folder");
    }
  };

  const onRequestDelete = (name: string, count: number) => {
    if (count === 0) {
      handleDelete(name, "uncategorize");
    } else {
      setDeleteFolderModalState({
        open: true,
        folderName: name,
        itemCount: count,
      });
    }
  };

  const handleCreateChild = (parent: string, name: string) => {
    const path = `${parent}/${name}`;
    addCustomFolder(path);
    onClose();
    router.push(`/vault?folder=${encodeURIComponent(path)}`);
  };

  const handleCreateRoot = async (name: string) => {
    setCreatingRoot(false);
    addCustomFolder(name);
    onClose();
    router.push(`/vault?folder=${encodeURIComponent(name)}`);
  };

  const handleNavigate = (path: string) => {
    onClose();
    router.push(`/vault?folder=${encodeURIComponent(path)}`);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh]">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Panel */}
        <div className="relative z-10 w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/70 shrink-0">
            <div className="flex items-center gap-2.5">
              <HardDrive className="w-4 h-4 text-neutral-500" />
              <div>
                <h2 className="text-[14px] font-semibold text-neutral-100">Folders</h2>
                <p className="text-[11px] text-neutral-600 mt-0.5">{folders.length} folder{folders.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCreatingRoot(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
                title="New folder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 flex items-center gap-2 p-2.5 rounded-lg border border-amber-900/40 bg-amber-950/20 text-amber-300 text-[12px] shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError("")} className="hover:text-amber-100 cursor-pointer shrink-0"><X className="w-3 h-3" /></button>
            </div>
          )}

          {/* Folder tree */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
            {/* Root inline create */}
            {creatingRoot && (
              <InlineFMInput
                placeholder="folder name"
                onConfirm={handleCreateRoot}
                onCancel={() => setCreatingRoot(false)}
                depth={0}
              />
            )}

            {folderTree.length === 0 && !creatingRoot ? (
              <div className="py-10 text-center">
                <Folder className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                <p className="text-[13px] text-neutral-500">No folders yet</p>
                <p className="text-[11px] text-neutral-700 mt-1">Click "New" to create your first folder</p>
              </div>
            ) : (
              folderTree.map(node => (
                <FolderExplorerNode
                  key={node.name}
                  node={node}
                  items={items}
                  collapsedSet={collapsedSet}
                  onToggle={toggleNode}
                  onRename={handleRename}
                  onRequestDelete={onRequestDelete}
                  onCreateChild={handleCreateChild}
                  onNavigate={handleNavigate}
                />
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-3 border-t border-neutral-800/70 shrink-0">
            <div className="flex items-start gap-2 text-[11px] text-neutral-700">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Use <span className="font-mono text-neutral-500">Parent/Child</span> names for nesting (max 3 levels).
                Folders appear once items are assigned to them.
              </span>
            </div>
          </div>
        </div>
      </div>

      {deleteFolderModalState && (
        <DeleteFolderModal
          open={deleteFolderModalState.open}
          folderName={deleteFolderModalState.folderName}
          itemCount={deleteFolderModalState.itemCount}
          onClose={() => setDeleteFolderModalState(null)}
          onConfirm={async (disposition) => {
            await handleDelete(deleteFolderModalState.folderName, disposition);
          }}
        />
      )}
    </>
  );
}

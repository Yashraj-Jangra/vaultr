"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Shield, KeyRound, Folder, FolderOpen, Star, Settings,
  ChevronDown, ChevronRight, Plus, Fingerprint,
  LayoutDashboard, Inbox, Wand2, Trash2,
  CreditCard, FileText, User, Lock, MapPin, X,
  PanelLeftClose, PanelLeftOpen, Pencil, FolderPlus, Check,
  AlertTriangle, Loader2,
} from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useVault } from "@/context/VaultContext";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/context/ThemeContext";
import { VAULTR_VERSION } from "@vaultr/core";
import { DeleteFolderModal } from "@/components/vault/DeleteFolderModal";

// ── Folder tree helpers ────────────────────────────────────────────────────────

export interface FolderNode {
  name: string;       // full path e.g. "Work/Projects"
  label: string;      // just last segment e.g. "Projects"
  depth: number;      // 0 = root
  children: FolderNode[];
  isPending?: boolean; // not yet backed by a real item
}

export function buildFolderTree(folders: string[]): FolderNode[] {
  const sorted = [...folders].sort();
  const roots: FolderNode[] = [];
  const nodeMap = new Map<string, FolderNode>();

  for (const path of sorted) {
    const segments = path.split("/").filter(Boolean);
    let parentPath = "";
    for (let i = 0; i < segments.length; i++) {
      const fullPath = segments.slice(0, i + 1).join("/");
      if (!nodeMap.has(fullPath)) {
        const node: FolderNode = {
          name: fullPath,
          label: segments[i],
          depth: i,
          children: [],
          isPending: false,
        };
        nodeMap.set(fullPath, node);
        if (i === 0) {
          roots.push(node);
        } else {
          const parent = nodeMap.get(parentPath);
          if (parent) parent.children.push(node);
        }
      }
      parentPath = fullPath;
    }
  }
  return roots;
}

const TYPE_ITEMS = [
  { filter: "type=login",   label: "Logins",    icon: <Lock      className="w-3.5 h-3.5" />, template: "login"   },
  { filter: "type=card",    label: "Cards",     icon: <CreditCard className="w-3.5 h-3.5" />, template: "card"    },
  { filter: "type=note",    label: "Notes",     icon: <FileText  className="w-3.5 h-3.5" />, template: "note"    },
  { filter: "type=address", label: "Addresses", icon: <MapPin    className="w-3.5 h-3.5" />, template: "address" },
  { filter: "type=profile", label: "Profiles",  icon: <User      className="w-3.5 h-3.5" />, template: "profile" },
] as const;

const Badge = ({ count, red }: { count: number; red?: boolean }) =>
  count > 0 ? (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 ${
      red ? "bg-red-950/40 text-red-400" : "bg-neutral-800/80 text-neutral-600"
    }`}>{count}</span>
  ) : null;

// ── Inline text input used for rename/create ───────────────────────────────────

interface InlineInputProps {
  initialValue?: string;
  placeholder?: string;
  onConfirm: (value: string) => Promise<void> | void;
  onCancel: () => void;
  indent?: number;
  icon?: React.ReactNode;
}

function InlineInput({ initialValue = "", placeholder = "folder name", onConfirm, onCancel, indent = 0, icon }: InlineInputProps) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      ref.current?.focus();
      if (initialValue) ref.current?.select();
    }, 30);
  }, [initialValue]);

  const confirm = async () => {
    const trimmed = value.trim();
    if (!trimmed) { onCancel(); return; }
    setBusy(true);
    try { await onConfirm(trimmed); }
    finally { setBusy(false); }
  };

  return (
    <div
      className="flex items-center gap-1 py-1 pr-1 rounded-lg bg-neutral-900 border border-[var(--accent)]/40 mx-1"
      style={{ paddingLeft: `${8 + indent}px` }}
    >
      <span className="text-neutral-600 shrink-0">
        {icon ?? <Folder className="w-3.5 h-3.5" />}
      </span>
      <input
        ref={ref}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); confirm(); }
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-[12px] text-neutral-200 placeholder-neutral-600 outline-none"
      />
      <button
        onClick={confirm}
        disabled={busy}
        className="p-1 rounded text-emerald-400 hover:bg-emerald-950/30 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      </button>
      <button
        onClick={onCancel}
        className="p-1 rounded text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── FolderTreeNode — file-explorer style ────────────────────────────────────────

type NodeEditState =
  | { type: "none" }
  | { type: "renaming" }
  | { type: "creating-child" };

interface FolderTreeNodeProps {
  node: FolderNode;
  items: { folder?: string }[];
  activeFolder: string | null;
  pathname: string;
  collapsedSet: Set<string>;
  onToggle: (path: string) => void;
  onRename: (from: string, to: string) => Promise<void>;
  onDelete: (name: string) => void;
  onCreateChild: (parentPath: string, childName: string) => void;
  isLast?: boolean;
}

function FolderTreeNode({
  node, items, activeFolder, pathname,
  collapsedSet, onToggle, onRename, onDelete, onCreateChild, isLast,
}: FolderTreeNodeProps) {
  const [editState, setEditState] = useState<NodeEditState>({ type: "none" });
  const isActive = pathname === "/vault" && activeFolder === node.name;
  const isCollapsed = collapsedSet.has(node.name);
  const hasChildren = node.children.length > 0;
  const isCreatingChild = editState.type === "creating-child";
  const showChildren = (hasChildren || isCreatingChild) && !isCollapsed;
  const MAX_DEPTH = 2; // 0,1,2 = 3 levels max

  // Count items
  const descendantPaths = [node.name];
  const collect = (n: FolderNode) => n.children.forEach(c => { descendantPaths.push(c.name); collect(c); });
  collect(node);
  const totalCount = items.filter(i => i.folder && descendantPaths.includes(i.folder)).length;
  const directCount = items.filter(i => i.folder === node.name).length;

  const handleRenameConfirm = async (newLabel: string) => {
    // Keep the same parent path, just change the last segment
    const parentPrefix = node.name.includes("/")
      ? node.name.slice(0, node.name.lastIndexOf("/") + 1)
      : "";
    const newPath = parentPrefix + newLabel;
    await onRename(node.name, newPath);
    setEditState({ type: "none" });
  };

  const handleCreateChildConfirm = (childLabel: string) => {
    onCreateChild(node.name, childLabel);
    setEditState({ type: "none" });
    // Auto-expand
    if (collapsedSet.has(node.name)) onToggle(node.name);
  };

  // Tree indent visual
  const indentPx = node.depth * 16;

  if (editState.type === "renaming") {
    return (
      <div style={{ paddingLeft: `${indentPx}px` }}>
        <InlineInput
          initialValue={node.label}
          placeholder="folder name"
          onConfirm={handleRenameConfirm}
          onCancel={() => setEditState({ type: "none" })}
          indent={0}
          icon={<FolderOpen className="w-3.5 h-3.5 text-[var(--accent)]" />}
        />
      </div>
    );
  }

  return (
    <div className="select-none">
      {/* Row */}
      <div
        className={`group relative flex items-center rounded-lg transition-all duration-150 ${
          isActive
            ? "bg-neutral-800/80 text-neutral-200"
            : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/40"
        }`}
        style={{ paddingLeft: `${indentPx + 4}px` }}
        onContextMenu={e => {
          e.preventDefault();
          setEditState({ type: "none" });
          // open inline options instead of context menu
        }}
      >
        {/* Collapse chevron / spacer */}
        <button
          onClick={() => onToggle(node.name)}
          className={`shrink-0 w-4 h-6 flex items-center justify-center transition-colors cursor-pointer ${
            hasChildren || isCreatingChild
              ? "text-neutral-600 hover:text-neutral-300"
              : "opacity-0 pointer-events-none"
          }`}
          aria-label={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed
            ? <ChevronRight className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
          }
        </button>

        {/* Folder icon + label */}
        <Link
          href={`/vault?folder=${encodeURIComponent(node.name)}`}
          className="flex-1 flex items-center gap-1.5 py-1.5 min-w-0 overflow-hidden"
          title={node.name}
        >
          {isActive
            ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-neutral-300" />
            : <Folder     className="w-3.5 h-3.5 shrink-0 text-neutral-600 group-hover:text-neutral-400" />
          }
          <span className="truncate text-[12px] flex-1">{node.label}</span>
          {totalCount > 0 && (
            <span className="text-[10px] font-mono text-neutral-600 mr-1 shrink-0">
              {hasChildren && totalCount !== directCount ? `${directCount}/${totalCount}` : totalCount}
            </span>
          )}
        </Link>

        {/* Hover action buttons */}
        <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pr-1">
          {/* New subfolder — only if not max depth */}
          {node.depth < MAX_DEPTH && (
            <button
              onClick={e => {
                e.preventDefault();
                // Expand first
                if (collapsedSet.has(node.name)) onToggle(node.name);
                setEditState({ type: "creating-child" });
              }}
              className="p-1 rounded text-neutral-600 hover:text-neutral-200 hover:bg-neutral-700/60 transition-colors cursor-pointer"
              title="New subfolder"
            >
              <FolderPlus className="w-3 h-3" />
            </button>
          )}
          {/* Rename */}
          <button
            onClick={e => { e.preventDefault(); setEditState({ type: "renaming" }); }}
            className="p-1 rounded text-neutral-600 hover:text-neutral-200 hover:bg-neutral-700/60 transition-colors cursor-pointer"
            title="Rename"
          >
            <Pencil className="w-3 h-3" />
          </button>
          {/* Delete */}
          <button
            onClick={e => { e.preventDefault(); onDelete(node.name); }}
            className="p-1 rounded text-neutral-600 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
            title="Delete folder"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Children + inline create child input */}
      {showChildren && (
        <div className="relative">
          {/* Tree connector line */}
          <div
            className="absolute left-0 top-0 bottom-0 border-l border-neutral-800/60"
            style={{ left: `${indentPx + 11}px` }}
          />
          <div>
            {node.children.map((child, idx) => (
              <FolderTreeNode
                key={child.name}
                node={child}
                items={items}
                activeFolder={activeFolder}
                pathname={pathname}
                collapsedSet={collapsedSet}
                onToggle={onToggle}
                onRename={onRename}
                onDelete={onDelete}
                onCreateChild={onCreateChild}
                isLast={idx === node.children.length - 1 && !isCreatingChild}
              />
            ))}

            {/* Inline create-child input */}
            {isCreatingChild && (
              <div style={{ paddingLeft: `${(node.depth + 1) * 16}px` }}>
                <InlineInput
                  placeholder="subfolder name"
                  onConfirm={async (name) => handleCreateChildConfirm(name)}
                  onCancel={() => setEditState({ type: "none" })}
                  indent={0}
                  icon={<FolderPlus className="w-3.5 h-3.5 text-neutral-500" />}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

// Sidebar collapse key — versioned to clear stale v1 data
const COLLAPSE_KEY = "vaultr_sidebar_collapsed_v2";

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { config }   = useSiteConfig();
  const { folders, items, setIsNewEntryOpen, addCustomFolder, renameFolder, deleteFolder } = useVault();
  const { isImpersonating, stopImpersonating } = useAuth();
  const { activeTheme } = useTheme();

  const [collapsed, setCollapsed]     = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [typesOpen, setTypesOpen]     = useState(true);
  const [tagsOpen, setTagsOpen]       = useState(false);

  // Folder collapse state — versioned key so stale data doesn't hide nodes
  const [collapsedFolderNodes, setCollapsedFolderNodes] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set<string>(); // default: all expanded
  });

  const toggleFolderNode = useCallback((path: string) => {
    setCollapsedFolderNodes(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); }
      catch { /* ignore */ }
      return next;
    });
  }, []);

  // Inline folder creation at root level
  const [creatingRootFolder, setCreatingRootFolder] = useState(false);

  const activeFolder = searchParams.get("folder");
  const activeFilter = searchParams.get("filter");
  const activeType   = searchParams.get("type");
  const activeTag    = searchParams.get("tag");

  const liveItems  = items.filter(i => !i.deletedAt);
  const trashCount = items.filter(i => !!i.deletedAt).length;
  const favCount   = liveItems.filter(i => i.favorite).length;
  const totpCount  = liveItems.filter(i => i.hasTotp).length;

  const typeCounts: Record<string, number> = {
    login:   liveItems.filter(i => (i.template ?? "login") === "login").length,
    card:    liveItems.filter(i => i.template === "card").length,
    note:    liveItems.filter(i => i.template === "note").length,
    address: liveItems.filter(i => i.template === "address").length,
    profile: liveItems.filter(i => i.template === "profile").length,
  };

  const uncategorizedCount = liveItems.filter(i => !i.folder).length;

  const tagsList = Array.from(new Set(liveItems.flatMap(i => i.tags || []))).sort();

  const isActive = (href: string) => {
    const url = new URL(href, "http://localhost");
    const targetPath   = url.pathname;
    const targetFilter = url.searchParams.get("filter");
    const targetType   = url.searchParams.get("type");
    if (targetPath === "/vault" && !targetFilter && !targetType && !url.searchParams.get("folder") && !url.searchParams.get("tag")) {
      return pathname === "/vault" && !activeFolder && !activeFilter && !activeTag && !activeType;
    }
    if (targetFilter) return pathname === "/vault" && activeFilter === targetFilter;
    if (targetType)   return pathname === "/vault" && activeType   === targetType;
    return pathname === targetPath;
  };

  const navLinkCls = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all duration-300 w-full overflow-hidden shrink-0 ${
      active
        ? "bg-neutral-800 text-neutral-100"
        : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
    }`;

  const sectionLinkCls = (active: boolean) =>
    `flex items-center justify-between px-3 py-1.5 rounded-md text-[12px] w-full transition-all duration-300 overflow-hidden shrink-0 ${
      active
        ? "bg-neutral-800 text-neutral-200"
        : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40"
    }`;

  const sectionHeaderCls =
    "w-full flex items-center justify-between px-3 py-1 text-[10px] text-neutral-600 uppercase tracking-widest hover:text-neutral-400 transition-colors cursor-pointer select-none";

  // Compute displayFolders = VaultContext folders UNION activeFolder ancestors.
  // This ensures any folder you're currently viewing (even empty/new ones)
  // always appears in the sidebar tree — not just folders with items.
  const displayFolders = useMemo(() => {
    const set = new Set(folders);
    // Inject activeFolder and every ancestor segment so the tree path is visible
    if (activeFolder) {
      const segs = activeFolder.split("/").filter(Boolean);
      for (let i = 1; i <= segs.length; i++) {
        set.add(segs.slice(0, i).join("/"));
      }
    }
    return Array.from(set).sort();
  }, [folders, activeFolder]);

  // Build the folder tree from the merged folder list
  const folderTree = useMemo(() => buildFolderTree(displayFolders), [displayFolders]);

  // Handlers forwarded to tree nodes
  const handleRename = async (from: string, to: string) => {
    if (from === to) return;
    await renameFolder(from, to);
    setCollapsedFolderNodes(prev => {
      const fromPrefix = `${from}/`;
      const next = new Set<string>();
      prev.forEach(p => {
        if (p === from) next.add(to);
        else if (p.startsWith(fromPrefix)) next.add(`${to}/${p.slice(fromPrefix.length)}`);
        else next.add(p);
      });
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
    if (activeFolder === from || activeFolder?.startsWith(from + "/")) {
      const newActive = activeFolder === from
        ? to
        : `${to}/${activeFolder.slice(from.length + 1)}`;
      router.replace(`/vault?folder=${encodeURIComponent(newActive)}`);
    }
  };

  const [deleteFolderModalState, setDeleteFolderModalState] = useState<{
    open: boolean;
    folderName: string;
    itemCount: number;
  } | null>(null);

  const handleDelete = (name: string) => {
    const itemCount = liveItems.filter(
      i => i.folder === name || i.folder?.startsWith(name + "/")
    ).length;

    if (itemCount === 0) {
      // Empty folder: directly delete without asking!
      executeDeleteFolder(name, "uncategorize");
    } else {
      // Folder with items: prompt user!
      setDeleteFolderModalState({
        open: true,
        folderName: name,
        itemCount,
      });
    }
  };

  const executeDeleteFolder = async (name: string, disposition: "uncategorize" | "trash") => {
    await deleteFolder(name, disposition);
    if (activeFolder === name || activeFolder?.startsWith(name + "/")) {
      router.replace("/vault");
    }
  };

  const handleCreateChild = (parentPath: string, childName: string) => {
    const newPath = `${parentPath}/${childName}`;
    addCustomFolder(newPath);
    // Expand the parent so the child is immediately visible
    if (collapsedFolderNodes.has(parentPath)) toggleFolderNode(parentPath);
    router.push(`/vault?folder=${encodeURIComponent(newPath)}`);
  };

  const handleCreateRoot = async (name: string) => {
    setCreatingRootFolder(false);
    addCustomFolder(name);
    router.push(`/vault?folder=${encodeURIComponent(name)}`);
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm md:hidden transition-opacity duration-300 ease-in-out ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-[70] flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-300 ease-in-out shrink-0 overflow-x-hidden md:relative md:translate-x-0 ${
          collapsed ? "w-14" : "w-64 md:w-56"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Inner container with static width */}
        <div className="w-64 md:w-56 flex flex-col h-full shrink-0 overflow-hidden select-none">
          {/* Header */}
          <div className="flex items-center h-14 border-b border-[var(--border)] px-[18px] shrink-0 overflow-hidden">
            <div className="flex items-center min-w-0 flex-1">
              {!collapsed ? (
                <Image
                  src={activeTheme.mode === "dark" ? "/brand/vaultr-full-dark-transparent.png" : "/brand/vaultr-full-light-transparent.png"}
                  alt={config.name}
                  width={110} height={22}
                  className="h-[22px] w-auto object-contain shrink-0"
                />
              ) : (
                <Image
                  src={activeTheme.mode === "dark" ? "/brand/vaultr-vr-dark-transparent.svg" : "/brand/vaultr-vr-light-transparent.svg"}
                  alt={config.name}
                  width={28} height={28}
                  className="w-7 h-7 object-contain shrink-0"
                />
              )}
            </div>
            {mobileOpen && (
              <button onClick={onClose} className="md:hidden p-1.5 -mr-1.5 text-neutral-500 hover:text-neutral-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* New entry button */}
          <div className="px-3 pt-3 pb-2 shrink-0">
            <button
              onClick={() => setIsNewEntryOpen(true)}
              title="New entry"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-dashed border-[var(--border)] text-[12px] text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer w-full overflow-hidden shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className={`transition-opacity duration-200 whitespace-nowrap ${
                collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}>
                New entry
              </span>
            </button>
          </div>

          {/* ─── Scrollable nav area ─────────────────────────────────────────── */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
            {/* Main views */}
            <Link href="/vault" className={navLinkCls(isActive("/vault"))}>
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className={`flex-1 truncate transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                All Items
              </span>
              <div className={`transition-opacity duration-200 shrink-0 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                <Badge count={liveItems.length} />
              </div>
            </Link>

            <Link href="/vault?filter=favorites" className={navLinkCls(isActive("/vault?filter=favorites"))}>
              <Star className="w-4 h-4 shrink-0" />
              <span className={`flex-1 truncate transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                Favorites
              </span>
              <div className={`transition-opacity duration-200 shrink-0 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                <Badge count={favCount} />
              </div>
            </Link>

            <Link href="/vault/authenticator" className={navLinkCls(pathname === "/vault/authenticator")}>
              <Fingerprint className="w-4 h-4 shrink-0" />
              <span className={`flex-1 truncate transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                Authenticator
              </span>
              <div className={`transition-opacity duration-200 shrink-0 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                <Badge count={totpCount} />
              </div>
            </Link>

            <Link href="/vault/generator" className={navLinkCls(pathname === "/vault/generator" || pathname === "/generator")}>
              <Wand2 className="w-4 h-4 shrink-0" />
              <span className={`flex-1 truncate transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                Generator
              </span>
            </Link>

            {/* ─── Types section ─────────────────────────────────────── */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              collapsed ? "max-h-0 opacity-0 pointer-events-none mt-0" : "max-h-[500px] opacity-100 mt-4"
            }`}>
              <button onClick={() => setTypesOpen(v => !v)} className={sectionHeaderCls}>
                <span>Types</span>
                {typesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>

              <div className={`transition-all duration-300 overflow-hidden ${typesOpen ? "max-h-96 mt-1" : "max-h-0"} space-y-0.5`}>
                {TYPE_ITEMS.map(({ filter, label, icon, template }) => {
                  const active = activeType === template;
                  return (
                    <Link key={template} href={`/vault?${filter}`} className={sectionLinkCls(active)}>
                      <span className="flex items-center gap-2.5 truncate">
                        <span className={active ? "text-neutral-300" : "text-neutral-600"}>{icon}</span>
                        <span className="truncate">{label}</span>
                      </span>
                      <Badge count={typeCounts[template]} />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ─── Folders section ───────────────────────────────────── */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              collapsed ? "max-h-0 opacity-0 pointer-events-none mt-0 mb-0" : "max-h-10 opacity-100 mt-4 mb-0.5"
            }`}>
              {/* Header row */}
              <div className="group/fhdr flex items-center px-3 py-1">
                <button
                  onClick={() => setFoldersOpen(v => !v)}
                  className="flex-1 flex items-center gap-1 text-[10px] text-neutral-600 uppercase tracking-widest hover:text-neutral-400 transition-colors cursor-pointer text-left"
                >
                  {foldersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span>Folders</span>
                </button>
                {/* New root folder button */}
                <button
                  onClick={() => { setFoldersOpen(true); setCreatingRootFolder(true); }}
                  className="p-1 rounded text-neutral-700 hover:text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer opacity-0 group-hover/fhdr:opacity-100 shrink-0"
                  title="New folder"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Folder list — file explorer tree */}
            <div className={`transition-all duration-300 ease-in-out ${
              collapsed
                ? "max-h-[500px] overflow-hidden"
                : foldersOpen
                  ? "max-h-80 overflow-y-auto"
                  : "max-h-0 overflow-hidden"
            } space-y-0.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent`}>

              {/* Uncategorized */}
              <Link
                href="/vault?folder="
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-all duration-150 ${
                  pathname === "/vault" && activeFolder === ""
                    ? "bg-neutral-800/80 text-neutral-200"
                    : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/40"
                }`}
              >
                <Inbox className="w-3.5 h-3.5 shrink-0 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                <span className={`flex-1 truncate transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  Uncategorized
                </span>
                <div className={`transition-opacity duration-200 shrink-0 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  <Badge count={uncategorizedCount} />
                </div>
              </Link>

              {/* Root-level inline create input */}
              {!collapsed && creatingRootFolder && (
                <InlineInput
                  placeholder="folder name"
                  onConfirm={handleCreateRoot}
                  onCancel={() => setCreatingRootFolder(false)}
                  indent={0}
                  icon={<FolderPlus className="w-3.5 h-3.5 text-neutral-500" />}
                />
              )}

              {/* Hierarchical folder tree */}
              {!collapsed && folderTree.map(node => (
                <FolderTreeNode
                  key={node.name}
                  node={node}
                  items={liveItems}
                  activeFolder={activeFolder}
                  pathname={pathname}
                  collapsedSet={collapsedFolderNodes}
                  onToggle={toggleFolderNode}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onCreateChild={handleCreateChild}
                />
              ))}

              {/* Collapsed sidebar: flat icon list */}
              {collapsed && folders.map(f => (
                <Link
                  key={f}
                  href={`/vault?folder=${encodeURIComponent(f)}`}
                  className={sectionLinkCls(pathname === "/vault" && activeFolder === f)}
                  title={f}
                >
                  <Folder className="w-4 h-4 shrink-0 text-neutral-600" />
                </Link>
              ))}

              {folders.length === 0 && !creatingRootFolder && uncategorizedCount === 0 && !collapsed && (
                <p className="text-[11px] text-neutral-700 px-3 py-1">
                  No folders yet
                </p>
              )}
            </div>

            {/* ─── Tags section ────────────────────────────────────── */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              (collapsed || tagsList.length === 0)
                ? "max-h-0 opacity-0 pointer-events-none mt-0 pb-0"
                : "max-h-[500px] opacity-100 mt-4 pb-2"
            }`}>
              <button onClick={() => setTagsOpen(v => !v)} className={sectionHeaderCls}>
                <span>Tags</span>
                {tagsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>

              <div className={`transition-all duration-300 overflow-hidden ${
                tagsOpen ? "max-h-28 mt-1 overflow-y-auto" : "max-h-0"
              } px-3 flex flex-wrap gap-1.5`}>
                {tagsList.map(tag => (
                  <Link
                    key={tag}
                    href={`/vault?tag=${encodeURIComponent(tag)}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors ${
                      activeTag === tag
                        ? "bg-neutral-800 border-neutral-700 text-neutral-200"
                        : "border-[var(--border)] text-neutral-500 hover:text-neutral-300 hover:border-neutral-700"
                    }`}
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          {/* ─── Footer ────────────────────────────────────────────── */}
          <div className="border-t border-[var(--border)] shrink-0">
            <div className="px-2 py-2">
              <Link
                href="/vault?filter=trash"
                title={collapsed ? "Trash" : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all duration-300 w-full overflow-hidden shrink-0 ${
                  activeFilter === "trash"
                    ? "bg-red-950/30 text-red-300 border border-red-900/40"
                    : "text-neutral-600 hover:text-red-400 hover:bg-red-950/10"
                }`}
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span className={`flex-1 transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  Trash
                </span>
                <div className={`transition-opacity duration-200 shrink-0 ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  <Badge count={trashCount} red />
                </div>
              </Link>
            </div>

            <div className="px-2 pb-2 space-y-0.5">
              <Link
                href="/settings"
                title={collapsed ? "Settings" : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all duration-300 overflow-hidden shrink-0 ${
                  pathname.startsWith("/settings") ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span className={`transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  Settings
                </span>
              </Link>

              {isImpersonating && (
                <button
                  onClick={() => stopImpersonating()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 transition-all duration-300 cursor-pointer overflow-hidden shrink-0"
                  title="Stop Impersonating"
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span className={`transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                    Stop Impersonating
                  </span>
                </button>
              )}

              <button
                onClick={() => setCollapsed(v => !v)}
                className="hidden md:flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-[12px] text-neutral-500 hover:text-neutral-300 transition-all duration-300 cursor-pointer overflow-hidden shrink-0"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? <PanelLeftOpen className="w-4 h-4 shrink-0" /> : <PanelLeftClose className="w-4 h-4 shrink-0" />}
                <span className={`flex-1 text-left transition-opacity duration-200 whitespace-nowrap ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  Collapse
                </span>
              </button>

              {!collapsed && (
                <Link
                  href="/settings/about"
                  className="flex items-center justify-between px-3 py-1.5 pt-2 border-t border-neutral-900/60 text-[10px] font-mono text-neutral-600 hover:text-neutral-400 transition-colors"
                >
                  <span>VaultR 2026</span>
                  <span className="text-neutral-700 hover:text-neutral-500">v{VAULTR_VERSION}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </aside>

      {deleteFolderModalState && (
        <DeleteFolderModal
          open={deleteFolderModalState.open}
          folderName={deleteFolderModalState.folderName}
          itemCount={deleteFolderModalState.itemCount}
          onClose={() => setDeleteFolderModalState(null)}
          onConfirm={async (disposition) => {
            await executeDeleteFolder(deleteFolderModalState.folderName, disposition);
          }}
        />
      )}
    </>
  );
}

// Dummy export to satisfy unused import constraint
const _kr = KeyRound;
const _sh = Shield;
export { _kr, _sh };

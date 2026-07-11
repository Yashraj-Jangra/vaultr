"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Shield, KeyRound, Folder, Star, Settings,
  ChevronDown, ChevronRight, Plus, Fingerprint,
  LayoutDashboard, Inbox, Wand2, Trash2,
  CreditCard, FileText, User, Lock, MapPin, X,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useVault } from "@/context/VaultContext";
import { useAuth } from "@/hooks/useAuth";

const TYPE_ITEMS = [
  { filter: "type=login",   label: "Logins",   icon: <Lock    className="w-3.5 h-3.5" />, template: "login"   },
  { filter: "type=card",    label: "Cards",    icon: <CreditCard className="w-3.5 h-3.5" />, template: "card"    },
  { filter: "type=note",    label: "Notes",    icon: <FileText className="w-3.5 h-3.5" />, template: "note"    },
  { filter: "type=address", label: "Addresses",icon: <MapPin  className="w-3.5 h-3.5" />, template: "address" },
  { filter: "type=profile", label: "Profiles", icon: <User    className="w-3.5 h-3.5" />, template: "profile" },
] as const;

const Badge = ({ count, red }: { count: number; red?: boolean }) =>
  count > 0 ? (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 transition-opacity duration-200 ${
      red ? "bg-red-950/40 text-red-400" : "bg-neutral-800 text-neutral-500"
    }`}>{count}</span>
  ) : null;

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { config }   = useSiteConfig();
  const { folders, items, setIsNewEntryOpen } = useVault();
  const { isImpersonating, stopImpersonating } = useAuth();
  const [collapsed, setCollapsed]       = useState(false);
  const [foldersOpen, setFoldersOpen]   = useState(true);
  const [typesOpen, setTypesOpen]       = useState(true);
  const [tagsOpen, setTagsOpen]         = useState(false);

  const activeFolder = searchParams.get("folder");
  const activeFilter = searchParams.get("filter");
  const activeType   = searchParams.get("type");
  const activeTag    = searchParams.get("tag");

  // Counts
  const liveItems = items.filter(i => !i.deletedAt);
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

  const folderCounts = folders.reduce<Record<string, number>>((acc, f) => {
    acc[f] = liveItems.filter(i => i.folder === f).length;
    return acc;
  }, {});
  const uncategorizedCount = liveItems.filter(i => !i.folder).length;

  const tagsList = Array.from(
    new Set(liveItems.flatMap(i => i.tags || []))
  ).sort();

  const isActive = (href: string) => {
    const url = new URL(href, "http://localhost");
    const targetPath = url.pathname;
    const targetFilter = url.searchParams.get("filter");
    const targetType   = url.searchParams.get("type");
    if (targetPath === "/vault" && !targetFilter && !targetType && !url.searchParams.get("folder") && !url.searchParams.get("tag")) {
      return pathname === "/vault" && !activeFolder && !activeFilter && !activeTag && !activeType;
    }
    if (targetFilter) return pathname === "/vault" && activeFilter === targetFilter;
    if (targetType)   return pathname === "/vault" && activeType === targetType;
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
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Image
                src="/brand/logo-mark.png"
                alt={config.name}
                width={20}
                height={20}
                className="w-5 h-5 object-contain shrink-0"
              />
              <span className={`text-[14px] font-semibold text-neutral-200 truncate transition-opacity duration-200 whitespace-nowrap ${
                collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}>
                {config.name}
              </span>
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

          {/* ─── Scrollable nav area ───────────────────────────────────────────── */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
            {/* Main views */}
            <Link href="/vault" className={navLinkCls(isActive("/vault"))}>
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className={`flex-1 truncate transition-opacity duration-200 whitespace-nowrap ${
                collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}>
                All Items
              </span>
              <div className={`transition-opacity duration-200 shrink-0 ${
                collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}>
                <Badge count={liveItems.length} />
              </div>
            </Link>

            <Link href="/vault?filter=favorites" className={navLinkCls(isActive("/vault?filter=favorites"))}>
              <Star className="w-4 h-4 shrink-0" />
              <span className={`flex-1 truncate transition-opacity duration-200 whitespace-nowrap ${
                collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}>
                Favorites
              </span>
              <div className={`transition-opacity duration-200 shrink-0 ${
                collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}>
                <Badge count={favCount} />
              </div>
            </Link>

            <Link href="/vault/authenticator" className={navLinkCls(pathname === "/vault/authenticator")}>
              <Fingerprint className="w-4 h-4 shrink-0" />
              <span className={`flex-1 truncate transition-opacity duration-200 whitespace-nowrap ${
                collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}>
                Authenticator
              </span>
              <div className={`transition-opacity duration-200 shrink-0 ${
                collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}>
                <Badge count={totpCount} />
              </div>
            </Link>

            <Link href="/vault/generator" className={navLinkCls(pathname === "/vault/generator")}>
              <Wand2 className="w-4 h-4 shrink-0" />
              <span className={`flex-1 truncate transition-opacity duration-200 whitespace-nowrap ${
                collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}>
                Generator
              </span>
            </Link>

            {/* ─── Types section ───────────────────────────────── */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              collapsed ? "max-h-0 opacity-0 pointer-events-none mt-0" : "max-h-[500px] opacity-100 mt-4"
            }`}>
              <button onClick={() => setTypesOpen(v => !v)} className={sectionHeaderCls}>
                <span>Types</span>
                {typesOpen
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />
                }
              </button>

              <div className={`transition-all duration-300 overflow-hidden ${
                typesOpen ? "max-h-96 mt-1" : "max-h-0"
              } space-y-0.5`}>
                {TYPE_ITEMS.map(({ filter, label, icon, template }) => {
                  const active = activeType === template;
                  return (
                    <Link
                      key={template}
                      href={`/vault?${filter}`}
                      className={sectionLinkCls(active)}
                    >
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

            {/* ─── Folders section ─────────────────────────────── */}
            {/* Header: Collapses when collapsed */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              collapsed ? "max-h-0 opacity-0 pointer-events-none mt-0 mb-0" : "max-h-10 opacity-100 mt-4 mb-1"
            }`}>
              <button onClick={() => setFoldersOpen(v => !v)} className={sectionHeaderCls}>
                <span>Folders</span>
                {foldersOpen
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />
                }
              </button>
            </div>

            {/* Folders List Container:
                When sidebar is collapsed, we keep folders open and scrollable so they display as icons.
                Otherwise, we respect foldersOpen state.
            */}
            <div className={`transition-all duration-300 ease-in-out ${
              collapsed 
                ? "max-h-[500px] overflow-hidden" 
                : foldersOpen 
                  ? "max-h-52 overflow-y-auto" 
                  : "max-h-0 overflow-hidden"
            } space-y-0.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent pr-0.5`}>
              {/* Uncategorized */}
              <Link
                href="/vault?folder="
                className={sectionLinkCls(pathname === "/vault" && activeFolder === "")}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Inbox className="w-4 h-4 shrink-0 text-neutral-600" />
                  <span className={`truncate transition-opacity duration-200 whitespace-nowrap ${
                    collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                  }`}>
                    Uncategorized
                  </span>
                </span>
                <div className={`transition-opacity duration-200 shrink-0 ${
                  collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}>
                  <Badge count={uncategorizedCount} />
                </div>
              </Link>

              {/* Folders items */}
              {folders.map(f => (
                <Link
                  key={f}
                  href={`/vault?folder=${encodeURIComponent(f)}`}
                  className={sectionLinkCls(pathname === "/vault" && activeFolder === f)}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Folder className="w-4 h-4 shrink-0 text-neutral-600" />
                    <span className={`truncate transition-opacity duration-200 whitespace-nowrap ${
                      collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                    }`}>
                      {f}
                    </span>
                  </span>
                  <div className={`transition-opacity duration-200 shrink-0 ${
                    collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                  }`}>
                    <Badge count={folderCounts[f] ?? 0} />
                  </div>
                </Link>
              ))}

              {folders.length === 0 && uncategorizedCount === 0 && (
                <p className={`text-[11px] text-neutral-700 px-3 py-1 transition-opacity duration-200 whitespace-nowrap ${
                  collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}>
                  No folders yet
                </p>
              )}
            </div>

            {/* ─── Tags section ─────────────────────────────────── */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              (collapsed || tagsList.length === 0) 
                ? "max-h-0 opacity-0 pointer-events-none mt-0 pb-0" 
                : "max-h-[500px] opacity-100 mt-4 pb-2"
            }`}>
              <button onClick={() => setTagsOpen(v => !v)} className={sectionHeaderCls}>
                <span>Tags</span>
                {tagsOpen
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />
                }
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

          {/* ─── Trash & Pinned Footer ─────────────────────── */}
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
                <span className={`flex-1 transition-opacity duration-200 whitespace-nowrap ${
                  collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}>
                  Trash
                </span>
                <div className={`transition-opacity duration-200 shrink-0 ${
                  collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}>
                  <Badge count={trashCount} red />
                </div>
              </Link>
            </div>

            {/* Settings + collapse */}
            <div className="px-2 pb-2 space-y-0.5">
              <Link
                href="/settings"
                title={collapsed ? "Settings" : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all duration-300 overflow-hidden shrink-0 ${
                  pathname.startsWith("/settings") ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span className={`transition-opacity duration-200 whitespace-nowrap ${
                  collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}>
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
                  <span className={`transition-opacity duration-200 whitespace-nowrap ${
                    collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                  }`}>
                    Stop Impersonating
                  </span>
                </button>
              )}

              <button
                onClick={() => setCollapsed(v => !v)}
                className="hidden md:flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-[12px] text-neutral-500 hover:text-neutral-300 transition-all duration-300 cursor-pointer overflow-hidden shrink-0"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <PanelLeftOpen className="w-4 h-4 shrink-0" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 shrink-0" />
                )}
                <span className={`flex-1 text-left transition-opacity duration-200 whitespace-nowrap ${
                  collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}>
                  Collapse
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// Dummy export to satisfy unused import constraint
const _kr = KeyRound;
export { _kr };

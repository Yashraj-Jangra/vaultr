"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Shield, KeyRound, Folder, Star, Settings,
  ChevronDown, ChevronRight, Plus, Fingerprint,
  LayoutDashboard, Inbox, Wand2, Trash2, Tag,
  CreditCard, FileText, User, Lock, MapPin,
} from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useVault } from "@/context/VaultContext";

const TYPE_ITEMS = [
  { filter: "type=login",   label: "Logins",   icon: <Lock    className="w-3.5 h-3.5" />, template: "login"   },
  { filter: "type=card",    label: "Cards",    icon: <CreditCard className="w-3.5 h-3.5" />, template: "card"    },
  { filter: "type=note",    label: "Notes",    icon: <FileText className="w-3.5 h-3.5" />, template: "note"    },
  { filter: "type=address", label: "Addresses",icon: <MapPin  className="w-3.5 h-3.5" />, template: "address" },
  { filter: "type=profile", label: "Profiles", icon: <User    className="w-3.5 h-3.5" />, template: "profile" },
] as const;

interface SidebarProps {
  onNewEntry?: () => void;
}

export function Sidebar({ onNewEntry }: SidebarProps) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { config }   = useSiteConfig();
  const { folders, items } = useVault();
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
    `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors w-full ${
      active
        ? "bg-neutral-800 text-neutral-100"
        : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
    }`;

  const sectionLinkCls = (active: boolean) =>
    `flex items-center justify-between px-3 py-1.5 rounded-md text-[12px] w-full transition-colors ${
      active
        ? "bg-neutral-800 text-neutral-200"
        : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40"
    }`;

  const sectionHeaderCls =
    "w-full flex items-center justify-between px-3 py-1 text-[10px] text-neutral-600 uppercase tracking-widest hover:text-neutral-400 transition-colors cursor-pointer";

  const Badge = ({ count, red }: { count: number; red?: boolean }) =>
    count > 0 ? (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 ${
        red ? "bg-red-950/40 text-red-400" : "bg-neutral-800 text-neutral-500"
      }`}>{count}</span>
    ) : null;

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200 shrink-0 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 h-14 border-b border-[var(--border)] px-4 shrink-0 ${collapsed ? "justify-center px-0" : ""}`}>
        <Shield className="w-5 h-5 text-neutral-300 shrink-0" />
        {!collapsed && (
          <span className="text-[14px] font-semibold text-neutral-200 truncate">
            {config.name}
          </span>
        )}
      </div>

      {/* New entry button */}
      <div className={`px-3 pt-3 pb-2 shrink-0 ${collapsed ? "flex justify-center px-2" : ""}`}>
        <button
          onClick={onNewEntry}
          title="New entry"
          className={`flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-[var(--border)] text-[12px] text-neutral-500 hover:text-neutral-200 hover:border-neutral-600 transition-colors cursor-pointer w-full ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && "New entry"}
        </button>
      </div>

      {/* ─── Scrollable nav area ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">

        {/* Main views */}
        <Link href="/vault" className={navLinkCls(isActive("/vault"))}>
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">All Items</span>}
          {!collapsed && <Badge count={liveItems.length} />}
        </Link>

        <Link href="/vault?filter=favorites" className={navLinkCls(isActive("/vault?filter=favorites"))}>
          <Star className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">Favorites</span>}
          {!collapsed && <Badge count={favCount} />}
        </Link>

        <Link href="/vault/authenticator" className={navLinkCls(pathname === "/vault/authenticator")}>
          <Fingerprint className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">Authenticator</span>}
          {!collapsed && <Badge count={totpCount} />}
        </Link>

        <Link href="/vault/generator" className={navLinkCls(pathname === "/vault/generator")}>
          <Wand2 className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">Generator</span>}
        </Link>

        {/* ─── Types section ───────────────────────────────── */}
        {!collapsed && (
          <div className="pt-4">
            <button onClick={() => setTypesOpen(v => !v)} className={sectionHeaderCls}>
              <span>Types</span>
              {typesOpen
                ? <ChevronDown className="w-3 h-3" />
                : <ChevronRight className="w-3 h-3" />
              }
            </button>

            {typesOpen && (
              <div className="mt-1 space-y-0.5">
                {TYPE_ITEMS.map(({ filter, label, icon, template }) => {
                  const active = activeType === template;
                  return (
                    <Link
                      key={template}
                      href={`/vault?${filter}`}
                      className={sectionLinkCls(active)}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className={active ? "text-neutral-300" : "text-neutral-600"}>{icon}</span>
                        <span className="truncate">{label}</span>
                      </span>
                      <Badge count={typeCounts[template]} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Folders section ─────────────────────────────── */}
        {!collapsed && (
          <div className="pt-4">
            <button onClick={() => setFoldersOpen(v => !v)} className={sectionHeaderCls}>
              <span>Folders</span>
              {foldersOpen
                ? <ChevronDown className="w-3 h-3" />
                : <ChevronRight className="w-3 h-3" />
              }
            </button>

            {foldersOpen && (
              <div className="mt-1 space-y-0.5 max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent pr-0.5">
                {/* Uncategorized */}
                <Link
                  href="/vault?folder="
                  className={sectionLinkCls(pathname === "/vault" && activeFolder === "")}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Inbox className="w-3.5 h-3.5 shrink-0 text-neutral-600" />
                    <span className="truncate">Uncategorized</span>
                  </span>
                  <Badge count={uncategorizedCount} />
                </Link>

                {folders.map(f => (
                  <Link
                    key={f}
                    href={`/vault?folder=${encodeURIComponent(f)}`}
                    className={sectionLinkCls(pathname === "/vault" && activeFolder === f)}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Folder className="w-3.5 h-3.5 shrink-0 text-neutral-600" />
                      <span className="truncate">{f}</span>
                    </span>
                    <Badge count={folderCounts[f] ?? 0} />
                  </Link>
                ))}

                {folders.length === 0 && uncategorizedCount === 0 && (
                  <p className="text-[11px] text-neutral-700 px-3 py-1">No folders yet</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Tags section ─────────────────────────────────── */}
        {!collapsed && tagsList.length > 0 && (
          <div className="pt-4 pb-2">
            <button onClick={() => setTagsOpen(v => !v)} className={sectionHeaderCls}>
              <span>Tags</span>
              {tagsOpen
                ? <ChevronDown className="w-3 h-3" />
                : <ChevronRight className="w-3 h-3" />
              }
            </button>

            {tagsOpen && (
              <div className="mt-1 px-3 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
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
            )}
          </div>
        )}

        {/* Collapsed mode: icon-only folders */}
        {collapsed && (
          <div className="pt-2 space-y-0.5">
            <Link href="/vault?folder=" title="Uncategorized"
              className={`flex justify-center py-2 rounded-md transition-colors ${
                pathname === "/vault" && activeFolder === "" ? "bg-neutral-800 text-neutral-200" : "text-neutral-600 hover:text-neutral-300"
              }`}>
              <Inbox className="w-4 h-4" />
            </Link>
            {folders.map(f => (
              <Link key={f} href={`/vault?folder=${encodeURIComponent(f)}`} title={f}
                className={`flex justify-center py-2 rounded-md transition-colors ${
                  pathname === "/vault" && activeFolder === f ? "bg-neutral-800 text-neutral-200" : "text-neutral-600 hover:text-neutral-300"
                }`}>
                <Folder className="w-4 h-4" />
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* ─── Trash (pinned at bottom above settings) ─────────────────────── */}
      <div className="border-t border-[var(--border)] shrink-0">
        <div className="px-2 py-2">
          <Link
            href="/vault?filter=trash"
            title={collapsed ? "Trash" : undefined}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors w-full ${
              activeFilter === "trash"
                ? "bg-red-950/30 text-red-300 border border-red-900/40"
                : "text-neutral-600 hover:text-red-400 hover:bg-red-950/10"
            }`}
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="flex-1">Trash</span>}
            {!collapsed && trashCount > 0 && (
              <Badge count={trashCount} red />
            )}
          </Link>
        </div>

        {/* Settings + collapse */}
        <div className="px-2 pb-2 space-y-0.5">
          <Link
            href="/settings"
            title={collapsed ? "Settings" : undefined}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
              pathname.startsWith("/settings") ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && "Settings"}
          </Link>

          <button
            onClick={() => setCollapsed(v => !v)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] text-neutral-700 hover:text-neutral-500 transition-colors cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <><ChevronRight className="w-3.5 h-3.5 rotate-180" /><span>Collapse</span></>
            }
          </button>
        </div>
      </div>
    </aside>
  );
}

// Dummy export to satisfy unused import constraint
const _kr = KeyRound;
export { _kr };

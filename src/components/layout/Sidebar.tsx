"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Shield, KeyRound, Folder, Star, Heart, Settings,
  ChevronLeft, ChevronRight, Plus, Fingerprint,
  LayoutDashboard, Inbox, Wand2
} from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useVault } from "@/context/VaultContext";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/vault",               label: "All Items",     icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/vault/favorites",     label: "Favorites",     icon: <Star className="w-4 h-4" /> },
  { href: "/vault/authenticator", label: "Authenticator", icon: <Fingerprint className="w-4 h-4" /> },
  { href: "/vault/generator",     label: "Generator",     icon: <Wand2 className="w-4 h-4" /> },
  { href: "/health",              label: "Health",        icon: <Heart className="w-4 h-4" /> },
];


interface SidebarProps {
  onNewEntry?: () => void;
}

export function Sidebar({ onNewEntry }: SidebarProps) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { config }   = useSiteConfig();
  const { folders, items } = useVault();
  const [collapsed, setCollapsed] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(true);

  const activeFolder = searchParams.get("folder");

  const folderCounts = folders.reduce<Record<string, number>>((acc, f) => {
    acc[f] = items.filter((i) => i.folder === f).length;
    return acc;
  }, {});

  const uncategorizedCount = items.filter(i => !i.folder).length;

  const isActive = (href: string) => {
    if (href === "/vault") {
      return pathname === "/vault" && activeFolder === null;
    }
    return pathname === href;
  };

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200 shrink-0 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 h-14 border-b border-[var(--border)] px-4 shrink-0 ${collapsed ? "justify-center" : ""}`}>
        <Shield className="w-5 h-5 text-neutral-300 shrink-0" />
        {!collapsed && (
          <span className="text-[14px] font-semibold text-neutral-200 truncate">
            {config.name}
          </span>
        )}
      </div>

      {/* New entry button */}
      <div className={`px-3 pt-3 pb-2 ${collapsed ? "flex justify-center" : ""}`}>
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

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
              isActive(item.href)
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
            }`}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}

        {/* Folders section */}
        {!collapsed && (
          <div className="pt-3">
            <button
              onClick={() => setFoldersOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-1 text-[11px] text-neutral-600 uppercase tracking-wider hover:text-neutral-400 transition-colors cursor-pointer"
            >
              <span>Folders</span>
              {foldersOpen
                ? <ChevronLeft className="w-3 h-3 rotate-90" />
                : <ChevronRight className="w-3 h-3 rotate-90" />
              }
            </button>
            {foldersOpen && (
              <div className="mt-0.5 space-y-0.5">
                {/* Uncategorized */}
                <Link
                  href="/vault?folder="
                  className={`flex items-center justify-between px-3 py-1.5 rounded-md text-[12px] transition-colors ${
                    pathname === `/vault` && activeFolder === ""
                      ? "bg-neutral-800 text-neutral-200"
                      : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Inbox className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Uncategorized</span>
                  </span>
                  <span className="text-neutral-700 text-[11px] shrink-0">{uncategorizedCount}</span>
                </Link>

                {/* Specific folders */}
                {folders.map((f) => (
                  <Link
                    key={f}
                    href={`/vault?folder=${encodeURIComponent(f)}`}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-md text-[12px] transition-colors ${
                      pathname === `/vault` && activeFolder === f
                        ? "bg-neutral-800 text-neutral-200"
                        : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Folder className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{f}</span>
                    </span>
                    <span className="text-neutral-700 text-[11px] shrink-0">{folderCounts[f] ?? 0}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
        {collapsed && (
          <div className="pt-2 space-y-0.5">
             <Link
                href="/vault?folder="
                title="Uncategorized"
                className={`flex justify-center px-3 py-2 rounded-md transition-colors ${
                  pathname === `/vault` && activeFolder === ""
                    ? "bg-neutral-800 text-neutral-200"
                    : "text-neutral-600 hover:text-neutral-300"
                }`}
              >
                <Inbox className="w-4 h-4" />
              </Link>
            {folders.map((f) => (
              <Link
                key={f}
                href={`/vault?folder=${encodeURIComponent(f)}`}
                title={f}
                className={`flex justify-center px-3 py-2 rounded-md transition-colors ${
                  pathname === `/vault` && activeFolder === f
                    ? "bg-neutral-800 text-neutral-200"
                    : "text-neutral-600 hover:text-neutral-300"
                }`}
              >
                <Folder className="w-4 h-4" />
              </Link>
            ))}
          </div>
        )}

      </nav>

      {/* Bottom: Settings + collapse */}
      <div className="border-t border-[var(--border)] p-2 space-y-0.5">
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
            pathname.startsWith("/settings")
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && "Settings"}
        </Link>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] text-neutral-700 hover:text-neutral-500 transition-colors cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <><ChevronLeft className="w-3.5 h-3.5" /><span>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  );
}

// Dummy export for unused import workaround
const _kr = KeyRound;
export { _kr };

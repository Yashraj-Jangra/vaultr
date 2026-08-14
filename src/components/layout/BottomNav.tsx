"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Heart, Wand2, Settings } from "lucide-react";

const TABS = [
  { href: "/vault",   label: "Vault",     icon: <LayoutDashboard className="w-5 h-5" /> },
  { href: "/vault/health",  label: "Health",    icon: <Heart className="w-5 h-5" /> },
  { href: "/generator", label: "Generate", icon: <Wand2 className="w-5 h-5" /> },
  { href: "/settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-stretch h-14">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? "text-neutral-100" : "text-neutral-600 hover:text-neutral-400"
              }`}
            >
              {tab.icon}
              <span className="text-[10px] leading-none">{tab.label}</span>
              {active && (
                <span className="absolute bottom-0 w-8 h-px bg-neutral-300 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

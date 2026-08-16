"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { VaultProvider } from "@/context/VaultContext";
import { User, Shield, Database, LifeBuoy, Info } from "lucide-react";

const SETTINGS_NAV = [
  { href: "/settings/account",  label: "Account",  icon: User },
  { href: "/settings/security", label: "Security", icon: Shield },
  { href: "/settings/data",     label: "Data",     icon: Database },
  { href: "/settings/support",  label: "Support",  icon: LifeBuoy },
  { href: "/settings/about",    label: "About & System", icon: Info },
] as const;

function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/auth");
    }
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg)]">
        <span className="text-[12px] text-neutral-600 animate-pulse">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Settings secondary sidebar */}
          <aside className="hidden md:flex flex-col w-48 border-r border-[var(--border)] shrink-0 py-6 px-3 gap-1 relative">
            <Link
              href="/vault"
              className="flex items-center gap-2 px-3 py-2 text-[12px] text-neutral-500 hover:text-neutral-200 transition-colors mb-4 border border-[var(--border)] rounded-md hover:bg-neutral-800"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back to Vault
            </Link>
            
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest px-3 mb-2">Settings</p>
            {SETTINGS_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
                    active
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            {/* Mobile top-tabs */}
            <div className="md:hidden flex border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10">
              {SETTINGS_NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                      active ? "text-neutral-200 border-b-2 border-neutral-400" : "text-neutral-600"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="w-full max-w-6xl mx-auto px-6 py-10 lg:px-12 lg:py-12">
              {children}
            </div>
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <VaultProvider>
      <SettingsShell>{children}</SettingsShell>
    </VaultProvider>
  );
}

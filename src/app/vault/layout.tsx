"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { VaultProvider, useVault } from "@/context/VaultContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ToastContainer } from "@/components/common/ToastContainer";
import { useToast } from "@/hooks/useToast";

// VaultShell no longer handles device verification — that gate lives in vault/page.tsx,
// before the master password screen. The banner is intentionally removed; when
// requireVerificationOnNew is OFF (the default), users should see zero "unverified" UI.

function VaultShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toasts, removeToast } = useToast();
  const { cryptoKey } = useVault();

  // Keyboard: Ctrl/⌘+K → command palette
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!cryptoKey) {
    return (
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onSearchOpen={() => setPaletteOpen(true)}
          onMenuOpen={() => setMobileMenuOpen(true)}
          onGeneratorOpen={() => {
            window.location.href = "/vault/generator";
          }}
        />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Command palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    // Only redirect once Auth has resolved — avoids redirect loop on initial load
    if (!isAuthLoading && !user) router.replace("/");
  }, [isAuthLoading, user, router]);

  // Still checking Better Auth state — show nothing to avoid flash
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xs text-neutral-600">Loading…</p>
      </div>
    );
  }

  // Auth resolved, no user — redirect is in flight
  if (!user) return null;

  return (
    <VaultProvider>
      <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-xs text-neutral-600">Loading vault…</p></div>}>
        <VaultShell>{children}</VaultShell>
      </React.Suspense>
    </VaultProvider>
  );
}

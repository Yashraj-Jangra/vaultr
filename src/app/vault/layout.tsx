"use client";

import React, { useState } from "react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useRouter } from "next/navigation";
import { VaultProvider } from "@/context/VaultContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ToastContainer } from "@/components/common/ToastContainer";
import { useToast } from "@/hooks/useToast";


function VaultShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const { toasts, removeToast } = useToast();

  // Keyboard: Ctrl/⌘+K → command palette, Esc handled inside palette
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — passes new-entry trigger down */}
      <Sidebar onNewEntry={() => setNewEntryOpen(true)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onSearchOpen={() => setPaletteOpen(true)}
          onGeneratorOpen={() => {
            // Will navigate to generator panel — handled by page
          window.location.href = "/vault/generator";
          }}
        />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {/* Pass new entry state to children via data attribute */}
          <div data-newentry={newEntryOpen ? "1" : "0"} data-closenewentry="closenewentry">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Command palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Suppress unused var lint */}
      {newEntryOpen && <span className="hidden" onClick={() => setNewEntryOpen(false)} />}
    </div>
  );
}

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading } = useFirebaseAuth();
  const router = useRouter();

  React.useEffect(() => {
    // Only redirect once Firebase has resolved — avoids redirect loop on initial load
    if (!isAuthLoading && !user) router.replace("/");
  }, [isAuthLoading, user, router]);

  // Still checking Firebase auth state — show nothing to avoid flash
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xs text-neutral-600">Loading…</p>
      </div>
    );
  }

  // Firebase resolved, no user — redirect is in flight
  if (!user) return null;

  return (
    <VaultProvider>
      <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-xs text-neutral-600">Loading vault…</p></div>}>
        <VaultShell>{children}</VaultShell>
      </React.Suspense>
    </VaultProvider>
  );
}

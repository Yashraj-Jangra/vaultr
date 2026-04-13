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
import { useSessionManager } from "@/hooks/useSessionManager";
import { ShieldAlert, X } from "lucide-react";
import Link from "next/link";

function VaultShell({ uid, children }: { uid: string; children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { toasts, removeToast } = useToast();
  const { isVerified } = useSessionManager(uid);

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

  const showBanner = !isVerified && !bannerDismissed;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Unverified device banner */}
        {showBanner && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-950/80 border-b border-amber-900/60 text-amber-300 text-[12px] shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="flex-1">
              This device is not verified.{" "}
              <Link
                href="/settings/security"
                className="underline underline-offset-2 hover:text-amber-200 transition-colors"
              >
                Verify now
              </Link>
              {" "}to confirm it&apos;s you.
            </span>
            <button
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 p-1 hover:text-amber-100 transition-colors rounded cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <TopBar
          onSearchOpen={() => setPaletteOpen(true)}
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
        <VaultShell uid={user.uid}>{children}</VaultShell>
      </React.Suspense>
    </VaultProvider>
  );
}

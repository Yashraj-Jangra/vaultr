"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isAdminLoading, isAuthLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !isAdminLoading) {
      if (!user) {
        router.replace("/login?redirect=/admin");
      } else if (!isAdmin) {
        router.replace("/vault");
      }
    }
  }, [user, isAdmin, isAdminLoading, isAuthLoading, router]);

  if (isAuthLoading || isAdminLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-[var(--bg)] text-[var(--fg)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--accent)]" />
        <p className="text-sm text-[var(--fg-muted)] animate-pulse">
          Verifying security clearance... (Auth: {isAuthLoading ? "loading" : "done"}, Admin: {isAdminLoading ? "loading" : "done"})
        </p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-[var(--danger)]/5 text-[var(--fg)]">
        <ShieldAlert className="h-16 w-16 text-[var(--danger)]" />
        <h1 className="text-xl font-bold tracking-tight">Access Denied</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          You do not have the necessary clearance to enter the Admin Panel.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

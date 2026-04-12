"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Users, Database, ShieldAlert, Activity } from "lucide-react";

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalEntries: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const ref = doc(db, "config", "stats");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setStats(snap.data() as { totalUsers: number; totalEntries: number });
        }
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="p-8 pb-20">
      <h2 className="text-2xl font-bold tracking-tight mb-8">Analytics Overview</h2>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--fg-muted)]">Total Users</h3>
            <Users className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-[var(--border)]" />
            ) : (
              <div className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            )}
          </div>
        </div>

        {/* Total Vault Entries */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--fg-muted)]">Vault Entries</h3>
            <Database className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-[var(--border)]" />
            ) : (
              <div className="text-3xl font-bold">{stats.totalEntries.toLocaleString()}</div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--fg-muted)]">System Status</h3>
            <Activity className="h-5 w-5 text-[#34d399]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-[#34d399]">Operational</div>
          </div>
        </div>

        {/* Alerts */}
        <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--danger)]">Active Alerts</h3>
            <ShieldAlert className="h-5 w-5 text-[var(--danger)]" />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-[var(--danger)]">0</div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 h-64 flex flex-col items-center justify-center">
         <p className="text-[var(--fg-muted)] text-sm">Visual charts will be available once more data is collected.</p>
      </div>
    </div>
  );
}

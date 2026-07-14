"use client";

import { useEffect, useState } from "react";
import { Users, Database, ShieldAlert, Activity, Wifi, MapPin } from "lucide-react";

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalEntries: 0 });
  const [telemetry, setTelemetry] = useState({
    dbStatus: "Connected",
    dbLatency: 0,
    storageStatus: "Connected",
    storageLatency: 0,
    nodeLocation: "UTC",
    networkLatency: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const start = performance.now();
        const res = await fetch("/api/admin/stats");
        const networkLatency = Math.round(performance.now() - start);

        if (res.ok) {
          const data = await res.json();
          setStats({
            totalUsers: data.totalUsers || 0,
            totalEntries: data.totalEntries || 0,
          });
          setTelemetry({
            dbStatus: data.dbStatus || "Connected",
            dbLatency: data.dbLatency || 0,
            storageStatus: data.storageStatus || "Connected",
            storageLatency: data.storageLatency || 0,
            nodeLocation: data.nodeLocation || "UTC",
            networkLatency: networkLatency,
          });
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
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics Overview</h2>
        <p className="text-sm text-[var(--fg-muted)] mt-1">General system-wide operations and account statistics.</p>
      </div>

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
            <div className="text-3xl font-bold text-[#34d399] flex items-center gap-2">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Operational
            </div>
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

      {/* Live System Diagnostics */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Live Connection Diagnostics</h3>
          <p className="text-sm text-[var(--fg-muted)] mt-1">Real-time connectivity diagnostics, node latencies, and connection metrics.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Database Telemetry */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-[var(--fg-muted)]">Database Ping</h4>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                  telemetry.dbStatus === "Connected" 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}>
                  {telemetry.dbStatus}
                </span>
              </div>
              <p className="text-3xl font-bold mt-4 font-mono">
                {loading ? "..." : telemetry.dbLatency} <span className="text-xs font-normal text-[var(--fg-muted)]">ms</span>
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[var(--border)] text-[10px] text-[var(--fg-muted)] font-mono">
              Dialect: SQLite (Drizzle)
            </div>
          </div>

          {/* Storage Telemetry */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-[var(--fg-muted)]">Storage Ping</h4>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                  telemetry.storageStatus === "Connected" 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}>
                  {telemetry.storageStatus}
                </span>
              </div>
              <p className="text-3xl font-bold mt-4 font-mono">
                {loading ? "..." : (telemetry.storageStatus === "Connected" ? `${telemetry.storageLatency} ms` : "Offline")}
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[var(--border)] text-[10px] text-[var(--fg-muted)] font-mono">
              Bucket: avatars
            </div>
          </div>

          {/* Network Ping */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-[var(--fg-muted)]">Browser RTT</h4>
                <Wifi className="h-4 w-4 text-blue-400" />
              </div>
              <p className="text-3xl font-bold mt-4 font-mono">
                {loading ? "..." : telemetry.networkLatency} <span className="text-xs font-normal text-[var(--fg-muted)]">ms</span>
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[var(--border)] text-[10px] text-[var(--fg-muted)] font-mono">
              Network: Client ↔ Node
            </div>
          </div>

          {/* Server Host Region */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-[var(--fg-muted)]">Deployment Node</h4>
                <MapPin className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-base font-semibold mt-5 truncate font-mono text-[var(--fg)]" title={telemetry.nodeLocation}>
                {loading ? "..." : telemetry.nodeLocation}
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[var(--border)] text-[10px] text-[var(--fg-muted)] font-mono">
              Zone: Server Local Time
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

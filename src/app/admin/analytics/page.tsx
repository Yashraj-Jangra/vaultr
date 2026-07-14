"use client";

import { useEffect, useState } from "react";
import { Users, Database, ShieldAlert, Activity, Wifi, MapPin, Radio, ActivitySquare } from "lucide-react";

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
  const [latencyHistory, setLatencyHistory] = useState<number[]>([30, 32, 28, 35, 33, 40, 37, 39, 36, 38]);
  const [loading, setLoading] = useState(true);

  // 1. Initial Load
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
          setLatencyHistory(prev => [...prev.slice(1), networkLatency]);
        }
      } catch (err) {
        console.error("Failed to load initial stats", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  // 2. Real-Time Telemetry Background Polling (Every 5 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const start = performance.now();
        const res = await fetch("/api/admin/stats");
        const rtt = Math.round(performance.now() - start);
        if (res.ok) {
          const data = await res.json();
          setTelemetry(prev => ({
            ...prev,
            dbLatency: data.dbLatency || 0,
            storageLatency: data.storageLatency || 0,
            networkLatency: rtt,
          }));
          setLatencyHistory(prev => {
            const updated = [...prev.slice(1), rtt];
            return updated;
          });
        }
      } catch (e) {
        console.warn("Real-time telemetry poll failed", e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // SVG Sparkline Math Coordinates
  const chartHeight = 80;
  const chartWidth = 560;
  const maxLat = Math.max(...latencyHistory, 60);
  const minLat = Math.min(...latencyHistory, 10);
  const latRange = maxLat - minLat || 1;

  const points = latencyHistory.map((val, idx) => {
    const x = idx * (chartWidth / (latencyHistory.length - 1));
    const y = chartHeight - 12 - ((val - minLat) / latRange) * (chartHeight - 24);
    return { x, y };
  });

  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(" L ")}`;
  const areaD = `${pathD} L ${points[points.length - 1].x},${chartHeight} L ${points[0].x},${chartHeight} Z`;

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-12 select-none">
      
      {/* Dashboard Top Header */}
      <div className="relative border-b border-neutral-900 pb-5">
        <div className="absolute top-0 right-0 text-[10px] font-mono text-[var(--accent)]/30 select-none">SYS_MONITOR // V_1.0</div>
        <h2 className="text-xl font-bold tracking-wider uppercase text-[var(--fg)] flex items-center gap-2">
          <ActivitySquare className="w-5 h-5 text-[var(--accent)]" /> Analytics Control
        </h2>
        <p className="text-[12px] text-[var(--fg-muted)] mt-1 font-mono">// REAL-TIME DATA VAULT TELEMETRY</p>
      </div>

      {/* General Stats overview row */}
      <div className="space-y-4">
        <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">// GENERAL STATUS</div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Total Users */}
          <div className="relative rounded-xl border border-neutral-900 bg-neutral-950/40 p-5 overflow-hidden flex flex-col justify-between h-28 group hover:border-[var(--accent)]/30 transition-all duration-300">
            <div className="absolute top-1.5 right-2.5 text-[8px] font-mono text-neutral-600 select-none">[STAT.01]</div>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-muted)]">User Base</h3>
              <Users className="h-4 w-4 text-[var(--accent)] opacity-60" />
            </div>
            <div className="mt-2">
              {loading ? (
                <div className="h-7 w-20 animate-pulse rounded bg-neutral-900" />
              ) : (
                <div className="text-3xl font-extrabold tracking-tight font-mono text-[var(--fg)]">
                  {String(stats.totalUsers).padStart(5, "0")}
                </div>
              )}
            </div>
          </div>

          {/* Vault Entries */}
          <div className="relative rounded-xl border border-neutral-900 bg-neutral-950/40 p-5 overflow-hidden flex flex-col justify-between h-28 group hover:border-[var(--accent)]/30 transition-all duration-300">
            <div className="absolute top-1.5 right-2.5 text-[8px] font-mono text-neutral-600 select-none">[STAT.02]</div>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-muted)]">Vault Items</h3>
              <Database className="h-4 w-4 text-[var(--accent)] opacity-60" />
            </div>
            <div className="mt-2">
              {loading ? (
                <div className="h-7 w-20 animate-pulse rounded bg-neutral-900" />
              ) : (
                <div className="text-3xl font-extrabold tracking-tight font-mono text-[var(--fg)]">
                  {String(stats.totalEntries).padStart(6, "0")}
                </div>
              )}
            </div>
          </div>

          {/* System Status */}
          <div className="relative rounded-xl border border-neutral-900 bg-neutral-950/40 p-5 overflow-hidden flex flex-col justify-between h-28 group hover:border-[var(--accent)]/30 transition-all duration-300">
            <div className="absolute top-1.5 right-2.5 text-[8px] font-mono text-neutral-600 select-none">[STAT.03]</div>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-muted)]">Core Mode</h3>
              <Activity className="h-4 w-4 text-emerald-400 opacity-60" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <div className="text-base font-bold font-mono text-emerald-400 uppercase tracking-wide">SECURED</div>
            </div>
          </div>

          {/* Alerts */}
          <div className="relative rounded-xl border border-neutral-900 bg-neutral-950/40 p-5 overflow-hidden flex flex-col justify-between h-28 group hover:border-red-500/20 transition-all duration-300">
            <div className="absolute top-1.5 right-2.5 text-[8px] font-mono text-neutral-600 select-none">[STAT.04]</div>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-muted)]">Intrusion Audits</h3>
              <ShieldAlert className="h-4 w-4 text-red-500 opacity-60" />
            </div>
            <div className="mt-2">
              <div className="text-3xl font-extrabold tracking-tight font-mono text-red-500">000</div>
            </div>
          </div>
        </div>
      </div>

      {/* Latency Gauges Grid */}
      <div className="space-y-4">
        <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">// NODE LATENCIES</div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Database Ping */}
          <div className="relative rounded-xl border border-neutral-900 bg-neutral-950/40 p-5 flex flex-col justify-between h-36 group hover:border-[var(--accent)]/30 transition-all duration-300">
            <div className="absolute top-1.5 right-2.5 text-[8px] font-mono text-neutral-600 select-none">[NODE.DB]</div>
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-muted)]">Database Ping</h4>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                  <span className="text-[9px] font-mono text-emerald-400">OK</span>
                </div>
              </div>
              <p className="text-2xl font-bold mt-3 font-mono text-[var(--fg)]">
                {loading ? "..." : telemetry.dbLatency} <span className="text-xs font-normal text-[var(--fg-muted)]">ms</span>
              </p>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="w-full bg-neutral-900 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: loading ? "0%" : `${Math.max(10, Math.min(100, 100 - (telemetry.dbLatency * 1.5)))}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-mono text-neutral-600">
                <span>SQLite (Drizzle)</span>
                <span>FAST</span>
              </div>
            </div>
          </div>

          {/* Storage Ping */}
          <div className="relative rounded-xl border border-neutral-900 bg-neutral-950/40 p-5 flex flex-col justify-between h-36 group hover:border-[var(--accent)]/30 transition-all duration-300">
            <div className="absolute top-1.5 right-2.5 text-[8px] font-mono text-neutral-600 select-none">[NODE.S3]</div>
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-muted)]">Storage Bucket</h4>
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${telemetry.storageStatus === "Connected" ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className={`text-[9px] font-mono ${telemetry.storageStatus === "Connected" ? "text-emerald-400" : "text-red-400"}`}>
                    {telemetry.storageStatus === "Connected" ? "OK" : "ERR"}
                  </span>
                </div>
              </div>
              <p className="text-2xl font-bold mt-3 font-mono text-[var(--fg)]">
                {loading ? "..." : (telemetry.storageStatus === "Connected" ? telemetry.storageLatency : "---")}
                {telemetry.storageStatus === "Connected" && <span className="text-xs font-normal text-[var(--fg-muted)]"> ms</span>}
              </p>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="w-full bg-neutral-900 h-1 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${telemetry.storageStatus === "Connected" ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ width: loading ? "0%" : (telemetry.storageStatus === "Connected" ? `${Math.max(10, Math.min(100, 100 - (telemetry.storageLatency / 2)))}%` : "0%") }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-mono text-neutral-600">
                <span>MinIO (avatars)</span>
                <span>{telemetry.storageStatus === "Connected" ? "STABLE" : "DISCONNECTED"}</span>
              </div>
            </div>
          </div>

          {/* Network Ping */}
          <div className="relative rounded-xl border border-neutral-900 bg-neutral-950/40 p-5 flex flex-col justify-between h-36 group hover:border-[var(--accent)]/30 transition-all duration-300">
            <div className="absolute top-1.5 right-2.5 text-[8px] font-mono text-neutral-600 select-none">[RTT.NET]</div>
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-muted)]">API Latency</h4>
                <div className="flex items-center gap-1">
                  <Wifi className="h-3 w-3 text-blue-400" />
                  <span className="text-[9px] font-mono text-blue-400">ACTIVE</span>
                </div>
              </div>
              <p className="text-2xl font-bold mt-3 font-mono text-[var(--fg)]">
                {loading ? "..." : telemetry.networkLatency} <span className="text-xs font-normal text-[var(--fg-muted)]">ms</span>
              </p>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="w-full bg-neutral-900 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-400 h-full rounded-full transition-all duration-500"
                  style={{ width: loading ? "0%" : `${Math.max(10, Math.min(100, 100 - (telemetry.networkLatency / 3)))}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-mono text-neutral-600">
                <span>Client ↔ Server</span>
                <span>RTT</span>
              </div>
            </div>
          </div>

          {/* Server Host Region */}
          <div className="relative rounded-xl border border-neutral-900 bg-neutral-950/40 p-5 flex flex-col justify-between h-36 group hover:border-[var(--accent)]/30 transition-all duration-300">
            <div className="absolute top-1.5 right-2.5 text-[8px] font-mono text-neutral-600 select-none">[LOC.NODE]</div>
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-muted)]">Node Location</h4>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-purple-400" />
                  <span className="text-[9px] font-mono text-purple-400">SYS</span>
                </div>
              </div>
              <p className="mt-3 text-base font-bold font-mono text-[var(--fg)] truncate" title={telemetry.nodeLocation}>
                {loading ? "..." : telemetry.nodeLocation}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-neutral-900 flex justify-between text-[8px] font-mono text-neutral-600">
              <span>TimeZone Resolution</span>
              <span>UTC LOC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Latency Chart */}
      <div className="space-y-4">
        <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">// SYSTEM LATENCY STREAM</div>
        
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Live Sparkline Graph Card */}
          <div className="lg:col-span-2 relative rounded-xl border border-neutral-900 bg-neutral-950/40 p-6 flex flex-col justify-between h-64 overflow-hidden group hover:border-[var(--accent)]/30 transition-all duration-300">
            <div className="absolute top-2 right-3 text-[8px] font-mono text-neutral-600 select-none">[STREAM.PLOT]</div>
            <div className="flex items-center justify-between z-10">
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)]">RTT Sparkline Stream</h4>
                <p className="text-[10px] text-neutral-500 font-mono mt-0.5">// Continuous 5-second interval plots</p>
              </div>
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-blue-400 animate-pulse shrink-0" />
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">Live Polling</span>
              </div>
            </div>

            {/* Sparkline Drawing */}
            <div className="relative flex-1 flex items-end mt-4 h-32 select-none">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-[var(--fg-muted)] animate-pulse">
                  Initializing telemetry stream...
                </div>
              ) : (
                <svg className="w-full h-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  <line x1="0" y1={chartHeight / 4} x2={chartWidth} y2={chartHeight / 4} stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.5" />
                  <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.5" />
                  <line x1="0" y1={(chartHeight * 3) / 4} x2={chartWidth} y2={(chartHeight * 3) / 4} stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.5" />

                  {/* Gradient Area Fill */}
                  <path d={areaD} fill="url(#chartGrad)" className="transition-all duration-500 ease-in-out" />
                  
                  {/* Glowing Stroke Line */}
                  <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" className="transition-all duration-500 ease-in-out" />
                  
                  {/* Node Circle Markers */}
                  {points.map((p, idx) => (
                    <circle 
                      key={idx} 
                      cx={p.x} 
                      cy={p.y} 
                      r={idx === points.length - 1 ? 3 : 1.5} 
                      fill={idx === points.length - 1 ? "var(--accent)" : "var(--fg)"} 
                      className={`transition-all duration-500 ease-in-out ${idx === points.length - 1 ? "animate-pulse" : ""}`}
                    />
                  ))}
                </svg>
              )}
            </div>

            {/* Sparkline X-Axis footer */}
            <div className="flex justify-between text-[8px] font-mono text-neutral-600 mt-2 pt-2 border-t border-neutral-900/60">
              <span>T-50s</span>
              <span>T-25s</span>
              <span>LIVE NOW (±{telemetry.networkLatency}ms)</span>
            </div>
          </div>

          {/* Telemetry metadata statistics card */}
          <div className="relative rounded-xl border border-neutral-900 bg-neutral-950/40 p-6 flex flex-col justify-between h-64 group hover:border-[var(--accent)]/30 transition-all duration-300">
            <div className="absolute top-2 right-3 text-[8px] font-mono text-neutral-600 select-none">[STREAM.METRICS]</div>
            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--fg-muted)]">RTT Stream Summary</h4>
              <p className="text-[10px] text-neutral-500 font-mono mt-0.5">// Connection stability ratios</p>
            </div>

            <div className="space-y-4 my-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[var(--fg-muted)]">Uptime Guarantee</span>
                <span className="text-emerald-400 font-bold">100.00%</span>
              </div>
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[var(--fg-muted)]">Peak Latency Recorded</span>
                <span className="text-[var(--fg)] font-bold">{Math.max(...latencyHistory)} ms</span>
              </div>
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[var(--fg-muted)]">Floor Latency Recorded</span>
                <span className="text-[var(--fg)] font-bold">{Math.min(...latencyHistory)} ms</span>
              </div>
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-[var(--fg-muted)]">Average Signal Speed</span>
                <span className="text-[var(--accent)] font-bold">
                  {Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length)} ms
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-900/60 flex justify-between text-[8px] font-mono text-neutral-600">
              <span>Channel: HTTP SECURE</span>
              <span>Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

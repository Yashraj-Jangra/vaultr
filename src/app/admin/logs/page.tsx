"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

import type { AuditEventKey, AuditLogEntry } from "@/lib/auditLog";
import {
  Search,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarDays,
  Filter,
  User,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Mail,
  LogOut,
  MonitorSmartphone,
  Clock,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LogResponse {
  entries: AuditLogEntry[];
  total: number;
  hasMore: boolean;
}

// ─── Event metadata ────────────────────────────────────────────────────────────

type Severity = "success" | "info" | "warning" | "danger";

const EVENT_META: Record<
  AuditEventKey,
  { label: string; severity: Severity; icon: React.ElementType }
> = {
  "session.created":            { label: "Session Created",        severity: "info",    icon: MonitorSmartphone },
  "session.auto_verify_sent":   { label: "Auto-Verify Sent",       severity: "info",    icon: Mail },
  "session.auto_verify_skipped":{ label: "Auto-Verify Skipped",    severity: "warning", icon: AlertTriangle },
  "session.alert_sent":         { label: "New-Device Alert",       severity: "warning", icon: ShieldAlert },
  "session.first_device":       { label: "First Device",           severity: "info",    icon: MonitorSmartphone },
  "session.revoked":            { label: "Session Revoked",        severity: "warning", icon: LogOut },
  "session.revoked_other":      { label: "Remote Revoke",          severity: "warning", icon: LogOut },
  "session.revoke_all":         { label: "Revoke All Sessions",    severity: "danger",  icon: XCircle },
  "device.verified":            { label: "Device Verified",        severity: "success", icon: ShieldCheck },
  "device.verify_failed":       { label: "Verify Failed",          severity: "warning", icon: AlertTriangle },
  "device.verify_locked":       { label: "Verify Locked",          severity: "danger",  icon: XCircle },
  "device.verify_expired":      { label: "Code Expired",           severity: "danger",  icon: XCircle },
  "otp.sent":                   { label: "OTP Sent",               severity: "info",    icon: Mail },
  "otp.rate_limited":           { label: "OTP Rate-Limited",       severity: "warning", icon: AlertTriangle },
  "email.sent":                 { label: "Email Sent",             severity: "success", icon: Mail },
  "email.failed":               { label: "Email Failed",           severity: "danger",  icon: XCircle },
  "email.broadcast":            { label: "Email Broadcast",        severity: "warning", icon: Mail },
  "admin.record.updated":       { label: "Admin Record Updated",   severity: "info",    icon: ShieldCheck },
  "admin.record.deleted":       { label: "Admin Record Deleted",   severity: "danger",  icon: XCircle },
  "admin.integrity.fixed":      { label: "Integrity Fixed",        severity: "success", icon: ShieldCheck },
};

const SEVERITY_STYLES: Record<Severity, { badge: string; dot: string; icon: string }> = {
  success: { badge: "bg-emerald-950/40 text-emerald-400 border-emerald-900/60", dot: "bg-emerald-400", icon: "text-emerald-400" },
  info:    { badge: "bg-blue-950/40   text-blue-400   border-blue-900/60",    dot: "bg-blue-400",    icon: "text-blue-400"    },
  warning: { badge: "bg-amber-950/40  text-amber-400  border-amber-900/50",   dot: "bg-amber-400",   icon: "text-amber-400"   },
  danger:  { badge: "bg-red-950/40    text-red-400    border-red-900/50",     dot: "bg-red-400",     icon: "text-red-400"     },
};

const ALL_EVENT_KEYS = Object.keys(EVENT_META) as AuditEventKey[];
const PAGE_SIZE = 50;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function exportCsv(entries: AuditLogEntry[]): void {
  const header = "timestamp,event,uid,sessionId,ip,location,deviceName,email\n";
  const rows = entries.map((e) =>
    [e.ts, e.event, e.uid, e.sessionId ?? "", e.ip ?? "", e.location ?? "", e.deviceName ?? "", e.email ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vaultr-security-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminLogsPage() {
  const [dates, setDates]             = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [entries, setEntries]         = useState<AuditLogEntry[]>([]);
  const [total, setTotal]             = useState(0);
  const [hasMore, setHasMore]         = useState(false);
  const [offset, setOffset]           = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  // Filters
  const [uidFilter, setUidFilter]     = useState("");
  const [eventFilter, setEventFilter] = useState<AuditEventKey | "">("");
  const [qFilter, setQFilter]         = useState("");

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Expanded row
  const [expanded, setExpanded]       = useState<string | null>(null);



  // ── Fetch available dates ──────────────────────────────────────────────────
  const fetchDates = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/logs?dates=1");
      if (!res.ok) return;
      const data = await res.json();
      const list: string[] = data.dates ?? [];
      setDates(list);
      if (!selectedDate && list.length > 0) setSelectedDate(list[0]);
    } catch { /* silent */ }
  }, [selectedDate]);

  // ── Fetch log entries ──────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (resetOffset = false) => {
    if (!selectedDate) return;

    const currentOffset = resetOffset ? 0 : offset;
    if (resetOffset) setOffset(0);

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        date:   selectedDate,
        limit:  String(PAGE_SIZE),
        offset: String(currentOffset),
      });
      if (uidFilter)   params.set("uid",   uidFilter.trim());
      if (eventFilter) params.set("event", eventFilter);
      if (qFilter)     params.set("q",     qFilter.trim());

      const res = await fetch(`/api/admin/logs?${params.toString()}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Failed to load logs");
        return;
      }

      const data: LogResponse = await res.json();
      setEntries(data.entries);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, offset, uidFilter, eventFilter, qFilter]);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDate) fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // ── Auto-refresh ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (refreshRef.current) clearInterval(refreshRef.current);
    if (autoRefresh) {
      refreshRef.current = setInterval(() => fetchLogs(true), 30_000);
    }
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [autoRefresh, fetchLogs]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchLogs(true);
  };

  const prevPage = () => {
    const next = Math.max(0, offset - PAGE_SIZE);
    setOffset(next);
  };

  const nextPage = () => {
    setOffset(offset + PAGE_SIZE);
  };

  useEffect(() => {
    if (selectedDate) fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const currentPage    = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages     = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div className="p-6 pb-20 space-y-5 min-h-full">
      {/* ── Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-100">Security Audit Logs</h2>
          <p className="text-[13px] text-neutral-500 mt-0.5">
            Server-side event log — every auth action recorded locally.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            title="Auto-refresh every 30s"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] transition-colors cursor-pointer ${
              autoRefresh
                ? "border-emerald-700 bg-emerald-950/30 text-emerald-400"
                : "border-[var(--border)] text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
            Live
          </button>
          {/* Manual refresh */}
          <button
            onClick={() => fetchLogs(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
          {/* Export CSV */}
          <button
            onClick={() => exportCsv(entries)}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Filters */}
      <form
        onSubmit={handleFilterSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
      >
        {/* Date picker */}
        <div className="space-y-1">
          <label className="text-[11px] text-neutral-600 uppercase tracking-wider flex items-center gap-1">
            <CalendarDays className="w-3 h-3" /> Date
          </label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-[13px] text-neutral-200 focus:outline-none focus:border-neutral-600 transition-colors"
          >
            {dates.length === 0 && (
              <option value="">{new Date().toISOString().slice(0, 10)} (today)</option>
            )}
            {dates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Event type filter */}
        <div className="space-y-1">
          <label className="text-[11px] text-neutral-600 uppercase tracking-wider flex items-center gap-1">
            <Filter className="w-3 h-3" /> Event Type
          </label>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value as AuditEventKey | "")}
            className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-[13px] text-neutral-200 focus:outline-none focus:border-neutral-600 transition-colors"
          >
            <option value="">All events</option>
            {ALL_EVENT_KEYS.map((k) => (
              <option key={k} value={k}>{EVENT_META[k].label}</option>
            ))}
          </select>
        </div>

        {/* UID filter */}
        <div className="space-y-1">
          <label className="text-[11px] text-neutral-600 uppercase tracking-wider flex items-center gap-1">
            <User className="w-3 h-3" /> User UID
          </label>
          <input
            type="text"
            value={uidFilter}
            onChange={(e) => setUidFilter(e.target.value)}
            placeholder="Filter by UID…"
            className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-[13px] text-neutral-200 placeholder-neutral-700 focus:outline-none focus:border-neutral-600 transition-colors"
          />
        </div>

        {/* Free-text search */}
        <div className="space-y-1">
          <label className="text-[11px] text-neutral-600 uppercase tracking-wider flex items-center gap-1">
            <Search className="w-3 h-3" /> Search
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={qFilter}
              onChange={(e) => setQFilter(e.target.value)}
              placeholder="IP, device, email…"
              className="flex-1 px-3 py-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-[13px] text-neutral-200 placeholder-neutral-700 focus:outline-none focus:border-neutral-600 transition-colors"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg)] text-[13px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>
      </form>

      {/* ── Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-900/60 bg-red-950/20 text-[13px] text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Stats bar */}
      <div className="flex items-center justify-between text-[12px] text-neutral-600">
        <span>
          {loading ? "Loading…" : `${total.toLocaleString()} event${total !== 1 ? "s" : ""} found`}
        </span>
        <span>Page {currentPage} of {totalPages}</span>
      </div>

      {/* ── Log table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[140px_180px_1fr_120px_80px] gap-0 bg-neutral-900/60 border-b border-[var(--border)] px-4 py-2 text-[11px] text-neutral-600 uppercase tracking-wider hidden lg:grid">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Time</span>
          <span>Event</span>
          <span>Device / Details</span>
          <span>IP · Location</span>
          <span>Meta</span>
        </div>

        {/* Rows */}
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-neutral-600 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[13px]">Loading logs…</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-700 gap-2">
            <AlertCircle className="w-6 h-6" />
            <p className="text-[13px]">No log entries found for the current filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {entries.map((entry, idx) => {
              const meta = EVENT_META[entry.event];
              const sev  = meta ? SEVERITY_STYLES[meta.severity] : SEVERITY_STYLES.info;
              const Icon = meta?.icon ?? CheckCircle;
              const rowKey = `${entry.ts || ""}-${idx}`;
              const isExpanded = expanded === rowKey;

              return (
                <div key={rowKey} className="group">
                  {/* Main row */}
                  <div
                    onClick={() => setExpanded(isExpanded ? null : rowKey)}
                    className="grid grid-cols-1 lg:grid-cols-[140px_180px_1fr_120px_80px] gap-2 lg:gap-0 px-4 py-3 hover:bg-neutral-800/30 transition-colors cursor-pointer"
                  >
                    {/* Timestamp */}
                    <div className="flex lg:block items-center gap-2">
                      <span className="text-[11px] font-mono text-neutral-500">
                        {formatTs(entry.ts)}
                      </span>
                    </div>

                    {/* Event badge */}
                    <div className="flex items-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium ${sev.badge}`}>
                        <Icon className={`w-3 h-3 ${sev.icon}`} />
                        {meta?.label ?? entry.event}
                      </span>
                    </div>

                    {/* Device / UID */}
                    <div className="space-y-0.5">
                      {entry.deviceName && (
                        <p className="text-[13px] text-neutral-300 truncate">{entry.deviceName}</p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUidFilter(entry.uid);
                            fetchLogs(true);
                          }}
                          className="text-[11px] font-mono text-neutral-600 hover:text-[var(--accent)] transition-colors truncate max-w-[160px]"
                          title="Filter by this UID"
                        >
                          {entry.uid.slice(0, 16)}…
                        </button>
                        {entry.email && (
                          <span className="text-[11px] text-neutral-700 truncate">{entry.email}</span>
                        )}
                      </div>
                    </div>

                    {/* IP / Location */}
                    <div className="space-y-0.5">
                      {entry.ip && entry.ip !== "unknown" && (
                        <p className="text-[11px] font-mono text-neutral-600">{entry.ip}</p>
                      )}
                      {entry.location && (
                        <p className="text-[11px] text-neutral-700">{entry.location}</p>
                      )}
                    </div>

                    {/* Expand indicator */}
                    <div className="hidden lg:flex items-center justify-end">
                      <span className="text-[11px] text-neutral-700 group-hover:text-neutral-500 transition-colors">
                        {isExpanded ? "▲ less" : "▼ more"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded metadata */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-neutral-900/40 border-t border-[var(--border)]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                        {/* Full timestamp */}
                        <Detail label="Full timestamp" value={entry.ts || ""} mono />
                        {/* Session ID */}
                        {entry.sessionId && <Detail label="Session ID" value={entry.sessionId} mono />}
                        {/* Full UID */}
                        <Detail label="User UID" value={entry.uid} mono />
                        {/* Email */}
                        {entry.email && <Detail label="Email" value={entry.email} />}
                        {/* IP */}
                        {entry.ip && <Detail label="IP Address" value={entry.ip} mono />}
                        {/* Location */}
                        {entry.location && <Detail label="Location" value={entry.location} />}
                        {/* Device */}
                        {entry.deviceName && <Detail label="Device" value={entry.deviceName} />}
                      </div>

                      {/* Meta JSON */}
                      {entry.meta && Object.keys(entry.meta).length > 0 && (
                        <div className="mt-3">
                          <p className="text-[11px] text-neutral-700 uppercase tracking-wider mb-1.5">Meta</p>
                          <pre className="text-[11px] font-mono text-neutral-500 bg-neutral-900 border border-[var(--border)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(entry.meta, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            onClick={prevPage}
            disabled={offset === 0 || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-[12px] text-neutral-600">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <button
            onClick={nextPage}
            disabled={!hasMore || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors cursor-pointer"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Small detail row ──────────────────────────────────────────────────────────

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-neutral-700 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-[12px] text-neutral-400 break-all ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

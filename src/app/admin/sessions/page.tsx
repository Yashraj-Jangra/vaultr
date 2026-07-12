"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Monitor,
  Smartphone,
  Globe,
  MapPin,
  Clock,
  LogIn,
  Trash2,
  Loader2,
  Search,
  RefreshCw,
  AlertCircle,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminSession {
  sessionId:    string;
  userId:       string;
  userEmail:    string;
  userName:     string;
  deviceName:   string;
  browser:      string;
  os:           string;
  ipAddress:    string | null;
  country:      string | null;
  city:         string | null;
  lastActiveAt: string | null;
  createdAt:    string;
  expiresAt:    string;
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({
  s,
  onRevoke,
  revoking,
}: {
  s: AdminSession;
  onRevoke: (id: string) => void;
  revoking: string | null;
}) {
  const location = [s.city, s.country].filter(Boolean).join(", ");
  const isMobile = s.os.toLowerCase().includes("iphone") ||
                   s.os.toLowerCase().includes("android") ||
                   s.os.toLowerCase().includes("mobile");
  const isRevoking = revoking === s.sessionId;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-xl border border-neutral-800/60 bg-neutral-900/30 hover:border-neutral-700/80 transition-all group">
      {/* Device icon */}
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-neutral-800/60 flex items-center justify-center">
        {isMobile
          ? <Smartphone className="w-4 h-4 text-neutral-400" />
          : <Monitor className="w-4 h-4 text-neutral-400" />
        }
      </div>

      {/* User + device info */}
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
        {/* User */}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-neutral-200 truncate">{s.userName}</p>
          <p className="text-[11px] text-neutral-500 truncate">{s.userEmail}</p>
        </div>

        {/* Device + IP */}
        <div className="min-w-0">
          <p className="text-[12px] text-neutral-300 truncate">{s.deviceName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {s.ipAddress && (
              <span className="flex items-center gap-1 text-[11px] text-neutral-600 font-mono">
                <Globe className="w-2.5 h-2.5 text-neutral-700 shrink-0" />
                {s.ipAddress}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1 text-[11px] text-neutral-600">
                <MapPin className="w-2.5 h-2.5 text-neutral-700 shrink-0" />
                {location}
              </span>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
            <LogIn className="w-2.5 h-2.5 text-neutral-600 shrink-0" />
            {formatDate(s.createdAt)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5">
            <Clock className="w-2.5 h-2.5 text-neutral-600 shrink-0" />
            Active {relativeTime(s.lastActiveAt ?? s.createdAt)}
          </div>
        </div>
      </div>

      {/* Revoke button */}
      <div className="flex-shrink-0">
        <button
          onClick={() => onRevoke(s.sessionId)}
          disabled={!!revoking}
          className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
          title="Terminate session"
        >
          {isRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {isRevoking ? "" : "Revoke"}
        </button>
      </div>
    </div>
  );
}

// ── User group header ─────────────────────────────────────────────────────────

function UserGroupHeader({
  userId,
  userName,
  userEmail,
  sessionCount,
  onRevokeAll,
  revoking,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  sessionCount: number;
  onRevokeAll: (uid: string) => void;
  revoking: boolean;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800/60 mb-2">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-[11px] font-bold text-neutral-300">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div>
          <span className="text-[13px] font-semibold text-neutral-200">{userName}</span>
          <span className="ml-2 text-[11px] text-neutral-500">{userEmail}</span>
        </div>
        <span className="text-[11px] text-neutral-600 bg-neutral-800 px-2 py-0.5 rounded-full">
          {sessionCount} session{sessionCount !== 1 ? "s" : ""}
        </span>
      </div>

      {confirm ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-red-400">Kill all sessions?</span>
          <button
            onClick={() => { setConfirm(false); onRevokeAll(userId); }}
            disabled={revoking}
            className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors"
          >
            {revoking ? "…" : "Yes"}
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-[11px] text-neutral-500 hover:text-neutral-300"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="flex items-center gap-1 text-[11px] text-neutral-600 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Kill all
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingUser, setRevokingUser] = useState<string | null>(null);
  const [groupByUser, setGroupByUser] = useState(true);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const res = await fetch(`/api/admin/sessions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Could not load sessions. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await fetch(`/api/admin/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      console.error("Revoke error:", e);
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeUser = async (userId: string) => {
    setRevokingUser(userId);
    try {
      await fetch(`/api/admin/sessions/user/${userId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.userId !== userId));
      setTotal((t) => Math.max(0, t - sessions.filter((s) => s.userId === userId).length));
    } catch (e) {
      console.error("Revoke user error:", e);
    } finally {
      setRevokingUser(null);
    }
  };

  // Group sessions by user
  const grouped = React.useMemo(() => {
    const map = new Map<string, AdminSession[]>();
    for (const s of sessions) {
      if (!map.has(s.userId)) map.set(s.userId, []);
      map.get(s.userId)!.push(s);
    }
    return Array.from(map.entries());
  }, [sessions]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const uniqueUsers = grouped.length;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-neutral-100">Active Sessions</h1>
        <p className="text-[14px] text-neutral-500 mt-1">
          Monitor and terminate sessions across all users.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Activity,  label: "Active Sessions", value: loading ? "…" : String(total) },
          { icon: Users,     label: "Unique Users",    value: loading ? "…" : String(uniqueUsers) },
          { icon: Monitor,   label: "This Page",       value: loading ? "…" : String(sessions.length) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-neutral-900/40 border border-neutral-800/60 rounded-xl p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center">
              <Icon className="w-4 h-4 text-neutral-400" />
            </div>
            <div>
              <p className="text-[20px] font-bold text-neutral-100">{value}</p>
              <p className="text-[11px] text-neutral-500 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name…"
            className="w-full pl-9 pr-4 py-2.5 bg-neutral-900/60 border border-neutral-800 rounded-lg text-[13px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGroupByUser((v) => !v)}
            className={`px-3 py-2.5 rounded-lg border text-[12px] font-medium transition-colors ${
              groupByUser
                ? "border-[var(--accent)] text-[var(--accent)] bg-neutral-900"
                : "border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Group by user
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-neutral-800 text-[12px] font-medium text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-[13px] text-red-400 bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Session list */}
      <div className="space-y-2">
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl border border-neutral-800/60 bg-neutral-900/30 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-center py-16 text-[13px] text-neutral-600">
            {debouncedSearch ? `No sessions found for "${debouncedSearch}"` : "No active sessions."}
          </div>
        )}

        {!loading && sessions.length > 0 && groupByUser && grouped.map(([userId, userSessions]) => (
          <div key={userId} className="mb-6">
            <UserGroupHeader
              userId={userId}
              userName={userSessions[0].userName}
              userEmail={userSessions[0].userEmail}
              sessionCount={userSessions.length}
              onRevokeAll={handleRevokeUser}
              revoking={revokingUser === userId}
            />
            <div className="space-y-2 ml-3 pl-3 border-l border-neutral-800/40">
              {userSessions.map((s) => (
                <SessionRow
                  key={s.sessionId}
                  s={s}
                  onRevoke={handleRevoke}
                  revoking={revokingId}
                />
              ))}
            </div>
          </div>
        ))}

        {!loading && sessions.length > 0 && !groupByUser && sessions.map((s) => (
          <SessionRow
            key={s.sessionId}
            s={s}
            onRevoke={handleRevoke}
            revoking={revokingId}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-800/60">
          <span className="text-[12px] text-neutral-500">
            Page {page + 1} of {totalPages} · {total} sessions total
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="p-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="p-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

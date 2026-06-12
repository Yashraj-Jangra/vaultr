"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  UsersIcon,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Trash2,
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
  LogOut,
  LogIn,
  User,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";

interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  creationTime: string;
  lastSignInTime: string;
  disabled: boolean;
  isAdmin: boolean;
}

export default function UsersAdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [openMenuUid, setOpenMenuUid] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchUsers = async () => {
    try {
      // Fetch up to 1000 users for client-side search and pagination
      const res = await fetch("/api/admin/users?maxResults=1000");

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setUsers(data.users);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAction = async (uid: string, action: string) => {
    if (processingUid) return;

    const actionMap: Record<string, string> = {
      disable: "Disable this user?",
      enable: "Enable this user?",
      promote: "Promote this user to Admin?",
      demote: "Remove Admin privileges from this user?",
      delete: "Permanently delete this user? This cannot be undone.",
      revoke_sessions: "Revoke all active sessions for this user?",
    };

    if (action !== "revoke_sessions" && !confirm(actionMap[action])) return;
    if (action === "revoke_sessions" && !confirm(actionMap[action])) return;

    setProcessingUid(uid);
    try {
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error(await res.text());

      // Optimistic update
      if (action === "delete") {
        setUsers(users.filter(u => u.uid !== uid));
      } else {
        setUsers(users.map(u => {
          if (u.uid !== uid) return u;
          if (action === "disable") return { ...u, disabled: true };
          if (action === "enable") return { ...u, disabled: false };
          if (action === "promote") return { ...u, isAdmin: true };
          if (action === "demote") return { ...u, isAdmin: false };
          return u;
        }));
      }
    } catch (err: unknown) {
      alert("Action failed: " + ((err as Error).message || "Unknown error"));
    } finally {
      setProcessingUid(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage));
  const currentUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rowsPerPage]);

  const handleImpersonate = async (uid: string) => {
    if (processingUid) return;
    if (!confirm("Login as this user? You will be redirected to their vault.")) return;

    setProcessingUid(uid);
    try {
      const res = await authClient.admin.impersonateUser({ userId: uid });
      if (res.error) throw res.error;
      window.location.href = "/vault";
    } catch (err: any) {
      alert("Impersonation failed: " + (err.message || "Unknown error"));
    } finally {
      setProcessingUid(null);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="p-8 pb-20 flex justify-center mt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="p-8 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-sm text-[var(--fg-muted)] mt-1">Manage user accounts, roles, and access.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-[var(--fg-muted)] bg-[var(--surface)] px-4 py-2 rounded-lg border border-[var(--border)]">
          <UsersIcon className="w-4 h-4 mr-2" />
          <span>Total {users.length} users</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors text-[var(--fg)] placeholder:text-[var(--fg-muted)]"
          />
        </div>
        <div className="flex items-center gap-4 text-sm w-full sm:w-auto">
          <span className="text-[var(--fg-muted)] whitespace-nowrap">Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
            className="bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20 flex items-center">
          <ShieldAlert className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)]">
        <div className="divide-y divide-[var(--border)]">
          {currentUsers.length === 0 ? (
            <div className="p-8 text-center text-[var(--fg-muted)]">No users found matching your criteria.</div>
          ) : currentUsers.map((u) => (
            <div key={u.uid} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-[var(--bg)]/40 transition-colors group first:rounded-t-xl last:rounded-b-xl">
              <div className="flex-1">
                <div className="font-medium text-[var(--fg)]">
                  {u.displayName || u.email.split("@")[0]}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[var(--fg-muted)] font-mono text-xs">{u.email}</span>
                  <span className="text-[10px] bg-[var(--bg)] border border-[var(--border)] text-[var(--fg-muted)] px-1.5 py-0.5 rounded font-mono hidden sm:inline-block">ID: {u.uid}</span>
                </div>
                <div className="text-[10px] text-[var(--fg-muted)]/70 mt-1 sm:hidden">
                  ID: {u.uid} &bull; Joined {new Date(u.creationTime).toLocaleDateString()}
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-4 sm:mt-0">
                  <div className="flex gap-2">
                    {u.disabled ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[var(--danger)]/10 text-[var(--danger)]">
                        <XCircle className="w-3 h-3 mr-1" /> Disabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#34d399]/10 text-[#34d399]">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                      </span>
                    )}
                    {u.isAdmin ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)]">
                        <Shield className="w-3 h-3 mr-1" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[var(--border)] text-[var(--fg-muted)]">
                        User
                      </span>
                    )}
                  </div>

                  <div 
                    className="relative"
                    tabIndex={-1}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setOpenMenuUid(null);
                      }
                    }}
                  >
                    <button
                      onClick={() => setOpenMenuUid(openMenuUid === u.uid ? null : u.uid)}
                      className={`p-2 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg)] transition-colors border border-transparent hover:border-[var(--border)] ${processingUid === u.uid ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={processingUid === u.uid}
                    >
                      {processingUid === u.uid ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-[var(--fg-muted)] border-t-transparent" />
                      ) : (
                        <MoreVertical className="w-4 h-4" />
                      )}
                    </button>

                    <div className={`absolute right-0 sm:right-8 top-10 sm:top-4 w-44 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl transition-all z-50 p-1 flex flex-col ${openMenuUid === u.uid ? 'opacity-100 visible pointer-events-auto translate-y-0' : 'opacity-0 invisible pointer-events-none -translate-y-2'}`}>
                      {u.disabled ? (
                        <button onClick={() => handleAction(u.uid, "enable")} className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--bg)] text-[#34d399] rounded-md text-left transition-colors">
                          <UserCheck className="w-3.5 h-3.5 mr-2" /> Enable User
                        </button>
                      ) : (
                        <button onClick={() => handleAction(u.uid, "disable")} className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--bg)] text-[var(--danger)] rounded-md text-left transition-colors">
                          <UserX className="w-3.5 h-3.5 mr-2" /> Disable User
                        </button>
                      )}
                      
                      <div className="h-px bg-[var(--border)] my-1" />
                      
                      {u.isAdmin ? (
                        <button onClick={() => handleAction(u.uid, "demote")} className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--bg)] text-[var(--danger)] rounded-md text-left transition-colors" disabled={u.uid === user?.uid}>
                          <ShieldOff className="w-3.5 h-3.5 mr-2" /> Remove Admin
                        </button>
                      ) : (
                        <button onClick={() => handleAction(u.uid, "promote")} className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--bg)] text-[var(--accent)] rounded-md text-left transition-colors">
                          <Shield className="w-3.5 h-3.5 mr-2" /> Make Admin
                        </button>
                      )}
                      
                      <div className="h-px bg-[var(--border)] my-1" />

                      <button
                        onClick={() => handleImpersonate(u.uid)}
                        disabled={processingUid === u.uid || u.uid === user?.uid}
                        className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--bg)] text-[var(--accent)] rounded-md text-left transition-colors disabled:opacity-50"
                      >
                        <LogIn className="w-3.5 h-3.5 mr-2" /> Login as User
                      </button>
                      
                      <div className="h-px bg-[var(--border)] my-1" />

                      <button
                        onClick={() => handleAction(u.uid, "revoke_sessions")}
                        disabled={processingUid === u.uid}
                        className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--bg)] text-orange-500 rounded-md text-left transition-colors disabled:opacity-50"
                      >
                        <LogOut className="w-3.5 h-3.5 mr-2" /> Revoke Sessions
                      </button>

                      <button
                        onClick={() => handleAction(u.uid, "delete")}
                        disabled={u.uid === user?.uid}
                        className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--danger)] hover:text-white text-[var(--danger)] rounded-md text-left transition-colors mt-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Account
                      </button>
                    </div>
                  </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <div className="text-sm text-[var(--fg-muted)]">
          Showing {filteredUsers.length > 0 ? Math.min((currentPage - 1) * rowsPerPage + 1, filteredUsers.length) : 0} to {Math.min(currentPage * rowsPerPage, filteredUsers.length)} of {filteredUsers.length} results
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--bg)] hover:border-[var(--border-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium px-4 text-[var(--fg)]">
            {currentPage} <span className="text-[var(--fg-muted)]">/ {totalPages}</span>
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--bg)] hover:border-[var(--border-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

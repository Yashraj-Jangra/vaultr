"use client";

import { useState, useEffect } from "react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
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
  UserCheck
} from "lucide-react";

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
  const { user } = useFirebaseAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  const fetchUsers = async (token?: string) => {
    try {
      let url = "/api/admin/users?maxResults=50";
      if (token) url += `&pageToken=${token}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setUsers(token ? [...users, ...data.users] : data.users);
      setPageToken(data.pageToken);
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
    };

    if (!confirm(actionMap[action])) return;

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

  if (loading && users.length === 0) {
    return (
      <div className="p-8 pb-20 flex justify-center mt-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="p-8 pb-20 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-sm text-[var(--fg-muted)] mt-1">Manage user accounts, roles, and access.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-[var(--fg-muted)] bg-[var(--surface)] px-4 py-2 rounded-lg border border-[var(--border)]">
          <UsersIcon className="w-4 h-4 mr-2" />
          <span>Showing {users.length} users</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20 flex items-center">
          <ShieldAlert className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-[var(--fg-muted)] uppercase bg-[var(--bg)]/50 border-b border-[var(--border)]">
              <tr>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Joined</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-[var(--fg)]">
                      {u.displayName || u.email.split("@")[0]}
                    </div>
                    <div className="text-[var(--fg-muted)] font-mono text-xs mt-0.5">{u.email}</div>
                  </td>
                  <td className="px-6 py-4 text-[var(--fg-muted)] whitespace-nowrap">
                    {new Date(u.creationTime).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {u.disabled ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[var(--danger)]/10 text-[var(--danger)]">
                        <XCircle className="w-3 h-3 mr-1" /> Disabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#34d399]/10 text-[#34d399]">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {u.isAdmin ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)]">
                        <Shield className="w-3 h-3 mr-1" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[var(--border)] text-[var(--fg-muted)]">
                        User
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right relative group">
                    <button 
                      className={`p-2 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--border)] transition-colors ${processingUid === u.uid ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={processingUid === u.uid}
                    >
                      {processingUid === u.uid ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-[var(--fg-muted)] border-t-transparent" />
                      ) : (
                        <MoreVertical className="w-4 h-4" />
                      )}
                    </button>
                    
                    {/* Simplified actions dropdown block */}
                    <div className="absolute right-8 top-4 w-40 bg-[var(--bg)] border border-[var(--border)] rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 p-1 flex flex-col pointer-events-none group-hover:pointer-events-auto">
                      {u.disabled ? (
                        <button onClick={() => handleAction(u.uid, "enable")} className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--surface)] text-[#34d399] rounded text-left">
                          <UserCheck className="w-3 h-3 mr-2" /> Enable User
                        </button>
                      ) : (
                        <button onClick={() => handleAction(u.uid, "disable")} className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--surface)] text-[var(--danger)] rounded text-left">
                          <UserX className="w-3 h-3 mr-2" /> Disable User
                        </button>
                      )}
                      
                      <div className="h-px bg-[var(--border)] my-1" />
                      
                      {u.isAdmin ? (
                        <button onClick={() => handleAction(u.uid, "demote")} className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--surface)] text-[var(--danger)] rounded text-left" disabled={u.uid === user?.uid}>
                          <ShieldOff className="w-3 h-3 mr-2" /> Remove Admin
                        </button>
                      ) : (
                        <button onClick={() => handleAction(u.uid, "promote")} className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--surface)] text-[var(--accent)] rounded text-left">
                          <Shield className="w-3 h-3 mr-2" /> Make Admin
                        </button>
                      )}
                      
                      <div className="h-px bg-[var(--border)] my-1" />
                      
                      <button onClick={() => handleAction(u.uid, "delete")} className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--danger)] hover:text-white text-[var(--danger)] rounded text-left" disabled={u.uid === user?.uid}>
                         <Trash2 className="w-3 h-3 mr-2" /> Delete Account
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {pageToken && (
        <div className="mt-6 flex justify-center">
          <button 
            onClick={() => fetchUsers(pageToken)}
            className="px-4 py-2 rounded-md border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}

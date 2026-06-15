"use client";

import { useState, useEffect } from "react";
import { Database, LockOpen, RefreshCw, ChevronRight, ShieldCheck, AlertTriangle, Trash2, Edit2, Search, Info } from "lucide-react";
import { AdminDecryptionModal } from "@/components/admin/AdminDecryptionModal";
import { RecordEditModal } from "@/components/admin/RecordEditModal";

const TABLES = [
  "vault_items",
  "user_profiles",
  "audit_logs",
  "support_tickets",
  "ticket_messages",
  "email_logs",
  "config_system",
  "user",
  "session",
  "account"
];

export default function DatabaseExplorerPage() {
  const [selectedTable, setSelectedTable] = useState<string>("integrity_check");
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Integrity Data
  const [integrityData, setIntegrityData] = useState<any>(null);

  // Decryption Modal State
  const [decryptBlob, setDecryptBlob] = useState<string | null>(null);
  const [decryptId, setDecryptId] = useState<string | null>(null);
  const [decryptUserId, setDecryptUserId] = useState<string | null>(null);

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  const fetchData = async (table: string) => {
    setLoading(true);
    setError(null);
    try {
      if (table === "integrity_check") {
        const res = await fetch('/api/admin/database/integrity');
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setIntegrityData(json);
        setData([]);
        setTotal(0);
      } else {
        const res = await fetch(`/api/admin/database/${table}?limit=50&offset=0`);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setData(json.rows || []);
        setTotal(json.total || 0);
        setIntegrityData(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedTable);
  }, [selectedTable]);

  const handleFixIntegrity = async (type: string) => {
    if (!confirm("Are you sure you want to permanently delete these orphaned records? This cannot be undone.")) return;
    try {
      const res = await fetch('/api/admin/database/integrity', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      if (!res.ok) throw new Error(await res.text());
      fetchData("integrity_check");
    } catch (err: any) {
      alert("Failed to fix integrity: " + err.message);
    }
  };

  const handleDeleteRecord = async (table: string, id: string) => {
    if (!confirm(`Are you sure you want to permanently delete record ${id} from ${table}?`)) return;
    try {
      const res = await fetch(`/api/admin/database/${table}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      fetchData(table);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fg)] flex items-center gap-2">
            <Database className="h-6 w-6 text-[var(--accent)]" />
            Database Explorer
          </h1>
          <p className="text-[var(--fg-muted)] mt-1">
            Raw access to system tables and integrity tools. Exercise extreme caution.
          </p>
        </div>
        <button
          onClick={() => fetchData(selectedTable)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--bg)] transition-colors shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Navigation Pane (Left) */}
        <div className="lg:col-span-1 flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm">
          <div className="p-3 border-b border-[var(--border)] bg-[var(--bg)]">
            <h3 className="font-semibold text-xs tracking-wider uppercase text-[var(--fg)]">Tools</h3>
          </div>
          <div className="flex flex-col">
            <button
              onClick={() => setSelectedTable("integrity_check")}
              className={`flex items-center justify-between p-3 text-sm text-left transition-colors border-l-2 ${
                selectedTable === "integrity_check" 
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)] font-medium" 
                  : "text-[var(--fg)] hover:bg-[var(--bg)] border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Integrity Scan
              </div>
              {selectedTable === "integrity_check" && <ChevronRight className="h-4 w-4 opacity-50" />}
            </button>
          </div>
          
          <div className="p-3 border-y border-[var(--border)] bg-[var(--bg)] mt-4">
            <h3 className="font-semibold text-xs tracking-wider uppercase text-[var(--fg)]">Tables</h3>
          </div>
          <div className="flex flex-col overflow-y-auto custom-scrollbar max-h-[60vh]">
            {TABLES.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTable(t)}
                className={`flex items-center justify-between p-3 text-sm text-left transition-colors border-l-2 ${
                  selectedTable === t 
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)] font-medium" 
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg)] border-transparent"
                }`}
              >
                <div className="truncate">{t}</div>
                {selectedTable === t && <ChevronRight className="h-4 w-4 opacity-50" />}
              </button>
            ))}
          </div>
        </div>

        {/* Data Viewer Pane (Right) */}
        <div className="lg:col-span-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden flex flex-col relative min-h-[500px]">
          
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface)]">
            <div>
              <h2 className="text-lg font-bold text-[var(--fg)] capitalize">
                {selectedTable.replace(/_/g, " ")}
              </h2>
              {selectedTable !== "integrity_check" && (
                <p className="text-xs text-[var(--fg-muted)] mt-1 font-mono">
                  SELECT * FROM {selectedTable} LIMIT 50
                </p>
              )}
            </div>
            {selectedTable !== "integrity_check" && (
              <div className="px-3 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--fg-muted)] text-xs font-mono">
                {total} Records Found
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar relative">
            
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]/50 backdrop-blur-sm">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)]/30 border-t-[var(--accent)]" />
              </div>
            )}

            {error && !loading && (
              <div className="p-6">
                <div className="rounded-lg bg-red-500/10 p-4 border border-red-500/20 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-400">Error retrieving data</h3>
                    <p className="text-xs text-red-400/80 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* INTEGRITY CHECK VIEW */}
            {!loading && !error && selectedTable === "integrity_check" && integrityData && (
              <div className="p-6 space-y-6">
                <div className="mb-2">
                  <h3 className="text-lg font-semibold text-[var(--fg)]">System Integrity Diagnostics</h3>
                  <p className="text-sm text-[var(--fg-muted)] mt-1">
                    Scans database relationships for orphaned entities and corrupted relational linkages.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Orphaned Vault Items */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--fg)]">
                        {integrityData.orphanedVaultItems > 0 ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                        Orphaned Vault Items
                      </div>
                      <p className="text-xs text-[var(--fg-muted)] mb-4 h-8">Vault entries attached to non-existent users.</p>
                      <div className="text-3xl font-mono mb-6">{integrityData.orphanedVaultItems}</div>
                    </div>
                    <button
                      onClick={() => handleFixIntegrity('orphaned_vault')}
                      disabled={integrityData.orphanedVaultItems === 0}
                      className="w-full text-xs font-semibold uppercase tracking-wider py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[var(--fg)]"
                    >
                      Purge
                    </button>
                  </div>

                  {/* Orphaned User Profiles */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--fg)]">
                        {integrityData.orphanedProfiles > 0 ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                        Orphaned Profiles
                      </div>
                      <p className="text-xs text-[var(--fg-muted)] mb-4 h-8">User profiles lacking an authentication record.</p>
                      <div className="text-3xl font-mono mb-6">{integrityData.orphanedProfiles}</div>
                    </div>
                    <button
                      onClick={() => handleFixIntegrity('orphaned_profiles')}
                      disabled={integrityData.orphanedProfiles === 0}
                      className="w-full text-xs font-semibold uppercase tracking-wider py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[var(--fg)]"
                    >
                      Purge
                    </button>
                  </div>

                  {/* Orphaned Sessions */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--fg)]">
                        {integrityData.orphanedSessions > 0 ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                        Orphaned Sessions
                      </div>
                      <p className="text-xs text-[var(--fg-muted)] mb-4 h-8">Active sessions attached to non-existent users.</p>
                      <div className="text-3xl font-mono mb-6">{integrityData.orphanedSessions}</div>
                    </div>
                    <button
                      onClick={() => handleFixIntegrity('orphaned_sessions')}
                      disabled={integrityData.orphanedSessions === 0}
                      className="w-full text-xs font-semibold uppercase tracking-wider py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[var(--fg)]"
                    >
                      Purge
                    </button>
                  </div>

                  {/* Orphaned Accounts */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--fg)]">
                        {integrityData.orphanedAccounts > 0 ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                        Orphaned Accounts
                      </div>
                      <p className="text-xs text-[var(--fg-muted)] mb-4 h-8">OAuth/Auth accounts missing parent user.</p>
                      <div className="text-3xl font-mono mb-6">{integrityData.orphanedAccounts}</div>
                    </div>
                    <button
                      onClick={() => handleFixIntegrity('orphaned_accounts')}
                      disabled={integrityData.orphanedAccounts === 0}
                      className="w-full text-xs font-semibold uppercase tracking-wider py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[var(--fg)]"
                    >
                      Purge
                    </button>
                  </div>

                  {/* Missing Profiles */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--fg)]">
                        {integrityData.missingProfiles > 0 ? <Info className="w-4 h-4 text-blue-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                        Missing Profiles
                      </div>
                      <p className="text-xs text-[var(--fg-muted)] mb-4 h-8">Auth users who haven't initialized their profile yet.</p>
                      <div className="text-3xl font-mono mb-6">{integrityData.missingProfiles}</div>
                    </div>
                    <button
                      disabled
                      className="w-full text-xs font-semibold uppercase tracking-wider py-2 rounded border border-[var(--border)] bg-[var(--bg)] opacity-50 cursor-not-allowed text-[var(--fg-muted)]"
                      title="This occurs when users register but don't complete onboarding. They are harmless."
                    >
                      Safe (No Action)
                    </button>
                  </div>

                  {/* Archived Profiles */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[var(--fg)]">
                        <Info className="w-4 h-4 text-[var(--fg-muted)]" />
                        Archived Profiles
                      </div>
                      <p className="text-xs text-[var(--fg-muted)] mb-4 h-8">Soft-deleted profiles retained for auditing.</p>
                      <div className="text-3xl font-mono mb-6">{integrityData.archivedProfiles}</div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm("Permanently purge all archived (soft-deleted) profiles?")) {
                          handleFixIntegrity('archived_profiles');
                        }
                      }}
                      disabled={integrityData.archivedProfiles === 0}
                      className="w-full text-xs font-semibold uppercase tracking-wider py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[var(--fg)]"
                    >
                      Purge Archives
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* STANDARD TABLE VIEW */}
            {!loading && !error && selectedTable !== "integrity_check" && (
              data.length === 0 ? (
                <div className="p-8 text-center border-t border-[var(--border)]">
                  <p className="text-sm text-[var(--fg-muted)]">No records found in table `{selectedTable}`.</p>
                </div>
              ) : (
                <div className="min-w-max">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20 bg-[var(--surface)] shadow-sm after:absolute after:bottom-0 after:left-0 after:right-0 after:border-b after:border-[var(--border)]">
                      <tr>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] w-20">Actions</th>
                        {headers.map(h => (
                          <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.map((row, i) => {
                        const pkField = row.id !== undefined ? "id" : (row.userId !== undefined ? "userId" : null);
                        const pkValue = pkField ? row[pkField] : null;

                        return (
                          <tr key={i} className="hover:bg-[var(--surface-hover)] transition-colors">
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setEditingRecord(row)}
                                  disabled={selectedTable === "audit_logs"}
                                  className="p-1 rounded text-[var(--fg-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={selectedTable === "audit_logs" ? "Audit logs cannot be edited" : "Edit record"}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {pkValue && (
                                  <button
                                    onClick={() => handleDeleteRecord(selectedTable, pkValue)}
                                    className="p-1 rounded text-[var(--fg-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                    title="Delete record"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                            {headers.map(h => {
                              const val = row[h];
                              let displayVal = String(val);
                              let isEncryptedPayload = h === "payload" && selectedTable === "vault_items";
                              
                              if (val === null) displayVal = "null";
                              else if (typeof val === "object") displayVal = JSON.stringify(val);
                              
                              const isLong = displayVal.length > 50;

                              return (
                                <td key={h} className="px-4 py-2 text-sm text-[var(--fg)] max-w-[300px]">
                                  {isEncryptedPayload ? (
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs opacity-50 truncate" title={displayVal}>
                                        {displayVal.slice(0, 30)}...
                                      </span>
                                      <button 
                                        onClick={() => { setDecryptBlob(displayVal); setDecryptId(row.id); setDecryptUserId(row.userId); }}
                                        className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-[var(--bg)] bg-[var(--accent)] px-2 py-0.5 rounded hover:opacity-90"
                                      >
                                        <LockOpen className="w-3 h-3" /> Decrypt
                                      </button>
                                    </div>
                                  ) : (
                                    <div className={`truncate ${isLong ? "font-mono text-xs text-[var(--fg-muted)]" : ""}`} title={displayVal}>
                                      {displayVal}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

          </div>
        </div>
      </div>

      <AdminDecryptionModal
        isOpen={!!decryptBlob}
        onClose={() => { setDecryptBlob(null); setDecryptId(null); setDecryptUserId(null); }}
        encryptedBlob={decryptBlob || ""}
        itemId={decryptId || ""}
        userId={decryptUserId || ""}
      />

      <RecordEditModal
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        tableName={selectedTable}
        record={editingRecord}
        onSave={() => fetchData(selectedTable)}
      />
    </div>
  );
}

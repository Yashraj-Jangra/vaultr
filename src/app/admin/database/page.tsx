"use client";

import { useState, useEffect } from "react";
import { Database, LockOpen, RefreshCw, ChevronRight } from "lucide-react";
import { AdminDecryptionModal } from "@/components/admin/AdminDecryptionModal";

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
  const [selectedTable, setSelectedTable] = useState<string>("vault_items");
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Decryption Modal State
  const [decryptBlob, setDecryptBlob] = useState<string | null>(null);
  const [decryptId, setDecryptId] = useState<string | null>(null);

  const fetchData = async (table: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/database/${table}?limit=50&offset=0`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json.rows || []);
      setTotal(json.total || 0);
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
            Raw access to system tables. Exercise extreme caution.
          </p>
        </div>
        <button
          onClick={() => fetchData(selectedTable)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--bg)] transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)]">
            <h3 className="font-semibold text-[var(--fg)]">Tables</h3>
          </div>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {TABLES.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTable(t)}
                className={`flex items-center justify-between p-3 text-sm text-left transition-colors ${
                  selectedTable === t 
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] border-l-2 border-l-[var(--accent)] font-medium" 
                    : "text-[var(--fg)] hover:bg-[var(--bg)] border-l-2 border-l-transparent"
                }`}
              >
                {t}
                {selectedTable === t && <ChevronRight className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--fg)] font-mono">{selectedTable}</h3>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
              {total} total records
            </span>
          </div>

          {error ? (
            <div className="p-8 text-center text-[var(--danger)]">
              <p>{error}</p>
            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center p-8 text-[var(--fg-muted)]">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8 text-[var(--fg-muted)]">
              No records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[var(--bg)] text-[var(--fg-muted)]">
                  <tr>
                    {selectedTable === "vault_items" && <th className="px-4 py-3 font-medium">Actions</th>}
                    {headers.map(h => (
                      <th key={h} className="px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {data.map((row, i) => (
                    <tr key={i} className="hover:bg-[var(--bg)]/50 transition-colors text-[var(--fg)]">
                      {selectedTable === "vault_items" && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setDecryptBlob(row.encryptedBlob || row.encrypted_blob);
                              setDecryptId(row.id);
                            }}
                            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
                          >
                            <LockOpen className="h-3 w-3" /> Decrypt
                          </button>
                        </td>
                      )}
                      {headers.map(h => {
                        let val = row[h];
                        if (typeof val === "object" && val !== null) val = JSON.stringify(val);
                        if (typeof val === "boolean") val = val ? "true" : "false";
                        
                        return (
                          <td key={h} className="px-4 py-3 max-w-[200px] truncate" title={val?.toString()}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AdminDecryptionModal 
        isOpen={!!decryptBlob}
        onClose={() => { setDecryptBlob(null); setDecryptId(null); }}
        encryptedBlob={decryptBlob || ""}
        itemId={decryptId || ""}
      />
    </div>
  );
}

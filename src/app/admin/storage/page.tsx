"use client";

import React, { useState, useEffect } from "react";
import {
  HardDrive,
  RefreshCw,
  FileText,
  User,
  Trash2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertTriangle,
  Info,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

interface StorageStats {
  totalUsedBytes: number;
  totalFiles: number;
  totalUsers: number;
  usersOverQuota: number;
  buckets: {
    attachments: { usedBytes: number; fileCount: number };
    avatars: { usedBytes: number; fileCount: number };
  };
  topUsers: Array<{
    userId: string;
    name: string;
    email: string;
    usedBytes: number;
    quotaBytes: number;
    fileCount: number;
  }>;
}

export default function AdminStoragePage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editQuotaVal, setEditQuotaVal] = useState<string>("");

  // File Browser states
  const [files, setFiles] = useState<any[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesPage, setFilesPage] = useState(1);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("");
  const [userSearchText, setUserSearchText] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/storage");
      if (!res.ok) throw new Error("Failed to fetch storage stats");
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async (pageVal = 1, filterUser = "") => {
    setFilesLoading(true);
    try {
      let url = `/api/admin/storage/files?page=${pageVal}&limit=20`;
      if (filterUser) {
        url += `&userId=${encodeURIComponent(filterUser)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data.files || []);
      setFilesPage(data.page);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchFiles(1);
  }, []);

  const handleUpdateQuota = async (userId: string) => {
    const megabytes = parseFloat(editQuotaVal);
    if (isNaN(megabytes) || megabytes < 1) {
      alert("Please enter a valid number of MB (minimum 1 MB)");
      return;
    }

    const quotaBytes = Math.round(megabytes * 1024 * 1024);
    try {
      const res = await fetch(`/api/admin/storage/quota/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotaBytes }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Quota update failed");
      }
      setEditingUserId(null);
      fetchStats();
    } catch (err: any) {
      alert(err.message || "Failed to update quota");
    }
  };

  const handleAdminDeleteFile = async (fileId: string) => {
    if (!window.confirm("WARNING: This will permanently delete this attachment from S3 storage. The user will lose access forever. Continue?")) return;
    try {
      const res = await fetch("/api/admin/storage/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Deletion failed");
      }
      // Reload
      fetchStats();
      fetchFiles(filesPage, selectedUserFilter);
    } catch (err: any) {
      alert(err.message || "Failed to delete file");
    }
  };

  const applyUserFilter = (userId: string) => {
    setSelectedUserFilter(userId);
    fetchFiles(1, userId);
  };

  const clearUserFilter = () => {
    setSelectedUserFilter("");
    fetchFiles(1, "");
  };

  if (loading && !stats) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-[var(--accent)]" />
            Storage Overview
          </h1>
          <p className="text-[12px] text-neutral-500 mt-1">
            Monitor zero-knowledge file attachments, avatars, and enforce storage limits.
          </p>
        </div>
        <Button onClick={() => { fetchStats(); fetchFiles(filesPage, selectedUserFilter); }} variant="default" className="flex items-center gap-1 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {stats && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Total Encrypted Used</span>
              <span className="text-2xl font-bold text-neutral-200 block mt-1">{formatBytes(stats.totalUsedBytes)}</span>
              <span className="text-[10px] text-neutral-600 mt-1 block">In attachments bucket</span>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Total Files Stored</span>
              <span className="text-2xl font-bold text-neutral-200 block mt-1">{stats.totalFiles.toLocaleString()}</span>
              <span className="text-[10px] text-neutral-600 mt-1 block">Vault attachments only</span>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Users Using Storage</span>
              <span className="text-2xl font-bold text-neutral-200 block mt-1">{stats.totalUsers.toLocaleString()}</span>
              <span className="text-[10px] text-neutral-600 mt-1 block">With active attachments</span>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Users Over Quota</span>
              <span className={`text-2xl font-bold block mt-1 ${stats.usersOverQuota > 0 ? "text-amber-400" : "text-neutral-200"}`}>
                {stats.usersOverQuota}
              </span>
              <span className="text-[10px] text-neutral-600 mt-1 block">Pending upload blocks</span>
            </div>
          </div>

          {/* Bucket breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]/50 text-left flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-neutral-400 block">Bucket: attachments (Private)</span>
                <span className="text-[11px] text-neutral-600 block mt-0.5">Encrypted file items</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-neutral-200 block">{formatBytes(stats.buckets.attachments.usedBytes)}</span>
                <span className="text-[10px] text-neutral-500 block">{stats.buckets.attachments.fileCount} files</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]/50 text-left flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-neutral-400 block">Bucket: avatars (Public Read)</span>
                <span className="text-[11px] text-neutral-600 block mt-0.5">User profile pictures</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-neutral-200 block">{formatBytes(stats.buckets.avatars.usedBytes)}</span>
                <span className="text-[10px] text-neutral-500 block">{stats.buckets.avatars.fileCount} files</span>
              </div>
            </div>
          </div>

          {/* Top Users */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] text-left flex justify-between items-center bg-neutral-950/20">
              <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Top Users by Storage Consumption</span>
              <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                <Info className="h-3 w-3" /> Click quota cells to edit limits in MB.
              </div>
            </div>
            {stats.topUsers.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500">
                No users have uploaded attachments yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-neutral-950/10 text-neutral-500 uppercase tracking-widest font-semibold">
                      <th className="p-4">User</th>
                      <th className="p-4">Used Space</th>
                      <th className="p-4">Storage Limit</th>
                      <th className="p-4">File Count</th>
                      <th className="p-4">Usage Bar</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/40">
                    {stats.topUsers.map((u) => {
                      const pct = Math.min(100, Math.round((u.usedBytes / u.quotaBytes) * 100));
                      const isEditing = editingUserId === u.userId;

                      return (
                        <tr key={u.userId} className="hover:bg-[var(--surface-hover)]/40 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-neutral-200">{u.name}</div>
                            <div className="text-[10px] text-neutral-500 mt-0.5">{u.email}</div>
                          </td>
                          <td className="p-4 font-mono text-neutral-300">
                            {formatBytes(u.usedBytes)}
                          </td>
                          <td className="p-4">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editQuotaVal}
                                  onChange={(e) => setEditQuotaVal(e.target.value)}
                                  className="w-16 bg-neutral-950 border border-[var(--border)] px-1.5 py-1 rounded text-center font-mono font-bold text-neutral-200"
                                  placeholder="MB"
                                />
                                <button
                                  onClick={() => handleUpdateQuota(u.userId)}
                                  className="px-2 py-1 bg-[var(--accent)] text-neutral-950 font-bold rounded text-[10px]"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  className="px-1.5 py-1 bg-neutral-800 text-neutral-400 rounded text-[10px]"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <span
                                onClick={() => {
                                  setEditingUserId(u.userId);
                                  setEditQuotaVal((u.quotaBytes / 1024 / 1024).toFixed(0));
                                }}
                                className="cursor-pointer border-b border-dashed border-neutral-700 hover:border-neutral-400 transition-colors font-mono"
                                title="Click to edit"
                              >
                                {formatBytes(u.quotaBytes)}
                              </span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-neutral-400">{u.fileCount}</td>
                          <td className="p-4 max-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-neutral-800 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-[var(--accent)]"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-neutral-500">{pct}%</span>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => applyUserFilter(u.userId)}
                              className="text-[var(--accent)] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                            >
                              <Eye className="h-3.5 w-3.5" /> View Files
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* File Browser Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-neutral-950/20">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 block">System File Catalog</span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Admin moderation tools. Zero-knowledge is strictly preserved.</span>
          </div>

          <div className="flex items-center gap-2">
            {selectedUserFilter && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-semibold border border-[var(--accent)]/30">
                Filtered User
                <button onClick={clearUserFilter} className="hover:text-red-400 font-bold shrink-0">X</button>
              </span>
            )}
            <input
              type="text"
              value={userSearchText}
              onChange={(e) => setUserSearchText(e.target.value)}
              placeholder="Search user ID..."
              className="bg-neutral-950 border border-[var(--border)] rounded px-2.5 py-1 text-[11px] placeholder-neutral-700 outline-none w-44 focus:border-[var(--accent)] transition-colors"
            />
            <Button
              onClick={() => applyUserFilter(userSearchText.trim())}
              variant="default"
              className="px-2.5 py-1 text-[10px] font-semibold"
            >
              Filter
            </Button>
          </div>
        </div>

        {filesLoading ? (
          <div className="p-8 text-center flex items-center justify-center gap-2 text-xs text-neutral-500">
            <RefreshCw className="h-4 w-4 animate-spin text-[var(--accent)]" />
            Scanning repository...
          </div>
        ) : files.length === 0 ? (
          <div className="p-10 text-center text-xs text-neutral-500">
            No files matched your filter query.
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-neutral-950/10 text-neutral-500 uppercase tracking-widest font-semibold">
                    <th className="p-4">File ID</th>
                    <th className="p-4">Owner User</th>
                    <th className="p-4">Original MIME</th>
                    <th className="p-4">S3 Key Path</th>
                    <th className="p-4">Stored Size</th>
                    <th className="p-4">Uploaded</th>
                    <th className="p-4 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/40">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-[var(--surface-hover)]/30 transition-colors">
                      <td className="p-4 font-mono text-[10px] text-neutral-400">
                        {file.id}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-neutral-300">{file.userName || "Unknown"}</div>
                        <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{file.userId}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[10px] font-mono text-neutral-400">
                          {file.mimeType}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[10px] text-neutral-500 truncate max-w-[200px]" title={file.s3Key}>
                        {file.s3Key}
                      </td>
                      <td className="p-4 font-mono text-neutral-300">
                        {formatBytes(file.sizeBytes)}
                      </td>
                      <td className="p-4 text-neutral-500">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleAdminDeleteFile(file.id)}
                          className="p-1.5 text-neutral-600 hover:text-red-500 transition-colors cursor-pointer"
                          title="Moderation purge (delete permanently)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-4 border-t border-[var(--border)] flex justify-between items-center bg-neutral-950/10">
              <span className="text-[11px] text-neutral-500 font-mono">Page {filesPage}</span>
              <div className="flex gap-1.5">
                <Button
                  onClick={() => fetchFiles(filesPage - 1, selectedUserFilter)}
                  disabled={filesPage <= 1 || filesLoading}
                  variant="ghost"
                  className="px-2 py-1 text-[10px] font-semibold"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  onClick={() => fetchFiles(filesPage + 1, selectedUserFilter)}
                  disabled={files.length < 20 || filesLoading}
                  variant="ghost"
                  className="px-2 py-1 text-[10px] font-semibold"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

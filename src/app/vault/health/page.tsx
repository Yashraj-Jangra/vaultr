"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useVault } from "@/context/VaultContext";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, Key, Repeat,
  Fingerprint, ExternalLink, Edit2, Wand2, RefreshCw, Check, ArrowLeft,
  ChevronRight, Lock, Eye, EyeOff, Search
} from "lucide-react";
import { SiteIcon } from "@/components/vault/SiteIcon";

interface AnalyzedItem {
  id: string;
  name: string;
  domain?: string;
  folder?: string;
  template: string;
  username: string;
  password?: string;
  hasTotp: boolean;
  score: number; // 0-4
  isWeak: boolean;
  isReused: boolean;
  reusedCount: number;
  pwnedCount: number | null;
  checkingPwned: boolean;
}

export default function PasswordHealthPage() {
  const { user } = useAuth();
  const { items, cryptoKey, decryptItem } = useVault();
  const router = useRouter();

  const [analyzed, setAnalyzed] = useState<AnalyzedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "compromised" | "weak" | "reused" | "no2fa">("all");
  const [search, setSearch] = useState("");

  // Decrypt and analyze vault items
  useEffect(() => {
    if (!cryptoKey || items.length === 0) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function runAnalysis() {
      setLoading(true);
      const logins = items.filter((i) => (i.template || "login") === "login" && !i.deletedAt);
      const parsedItems: Array<{ item: typeof items[0]; payload: any }> = [];

      for (const item of logins) {
        try {
          const raw = await decryptItem(item.encryptedBlob);
          const p = JSON.parse(raw);
          parsedItems.push({ item, payload: p });
        } catch {
          // ignore decryption failure
        }
      }

      // Count password occurrences to detect reuse
      const passwordCounts: Record<string, number> = {};
      for (const { payload } of parsedItems) {
        const pw = payload.password?.trim();
        if (pw) {
          passwordCounts[pw] = (passwordCounts[pw] || 0) + 1;
        }
      }

      const results: AnalyzedItem[] = parsedItems.map(({ item, payload }) => {
        const pw = payload.password || "";
        const username = payload.username || "";
        const hasTotp = !!(payload.totpSecret || item.hasTotp);

        // Strength calculation (0-4)
        let s = 0;
        if (pw.length >= 8) s += 1;
        if (pw.length >= 12) s += 1;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 1;
        if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s += 1;

        const isWeak = pw.length < 12 || s < 3;
        const reusedCount = pw ? (passwordCounts[pw.trim()] || 0) : 0;
        const isReused = reusedCount > 1;

        return {
          id: item.id,
          name: item.name,
          domain: item.domain || payload.url,
          folder: item.folder || undefined,
          template: item.template || "login",
          username,
          password: pw,
          hasTotp,
          score: s,
          isWeak,
          isReused,
          reusedCount,
          pwnedCount: null,
          checkingPwned: false,
        };
      });

      if (mounted) {
        setAnalyzed(results);
        setLoading(false);
      }

      // Asynchronously perform k-Anonymity breach check on passwords
      for (let i = 0; i < results.length; i++) {
        const entry = results[i];
        if (!entry.password) continue;

        try {
          const buffer = new TextEncoder().encode(entry.password);
          const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

          const prefix = hashHex.slice(0, 5);
          const suffix = hashHex.slice(5);

          const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
          if (res.ok) {
            const text = await res.text();
            let count = 0;
            for (const line of text.split("\n")) {
              const [hSuffix, cStr] = line.split(":");
              if (hSuffix?.trim() === suffix) {
                count = parseInt(cStr?.trim() || "0", 10);
                break;
              }
            }

            if (mounted) {
              setAnalyzed((prev) =>
                prev.map((it) => (it.id === entry.id ? { ...it, pwnedCount: count } : it))
              );
            }
          }
        } catch {
          // silent fail
        }
      }
    }

    runAnalysis();

    return () => {
      mounted = false;
    };
  }, [cryptoKey, items]);

  // Aggregate metrics
  const totalAnalyzed = analyzed.length;
  const compromisedCount = useMemo(() => analyzed.filter((i) => (i.pwnedCount ?? 0) > 0).length, [analyzed]);
  const weakCount = useMemo(() => analyzed.filter((i) => i.isWeak).length, [analyzed]);
  const reusedCount = useMemo(() => analyzed.filter((i) => i.isReused).length, [analyzed]);
  const no2faCount = useMemo(() => analyzed.filter((i) => !i.hasTotp).length, [analyzed]);

  // Overall Health Score calculation (0 - 100)
  const healthScore = useMemo(() => {
    if (totalAnalyzed === 0) return 100;
    let penalty = 0;
    penalty += compromisedCount * 30; // heavy penalty for compromised
    penalty += weakCount * 12;
    penalty += reusedCount * 15;
    penalty += no2faCount * 5;

    const base = Math.max(0, 100 - Math.round(penalty / Math.max(1, totalAnalyzed * 0.4)));
    return Math.min(100, Math.max(0, base));
  }, [totalAnalyzed, compromisedCount, weakCount, reusedCount, no2faCount]);

  // Filtered list
  const filteredList = useMemo(() => {
    return analyzed.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          item.name.toLowerCase().includes(q) ||
          item.username.toLowerCase().includes(q) ||
          item.domain?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (filter === "compromised") return (item.pwnedCount ?? 0) > 0;
      if (filter === "weak") return item.isWeak;
      if (filter === "reused") return item.isReused;
      if (filter === "no2fa") return !item.hasTotp;
      return true;
    });
  }, [analyzed, filter, search]);

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/vault"
              className="text-neutral-400 hover:text-neutral-200 text-xs flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Vault
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-emerald-400" />
            Password Health & Security
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Vault-wide cryptographic audit of credential strength, dark web breach exposure, and 2FA protection.
          </p>
        </div>

        {/* Global Health Score Badge */}
        <div className="flex items-center gap-4 p-3.5 px-5 bg-neutral-900/80 border border-neutral-800 rounded-2xl shrink-0">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-neutral-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${
                  healthScore >= 80
                    ? "text-emerald-400"
                    : healthScore >= 50
                    ? "text-amber-400"
                    : "text-red-500"
                } transition-all duration-1000 ease-out`}
                strokeDasharray={`${healthScore}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-bold text-neutral-100 font-mono">
              {healthScore}%
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-200">
              {healthScore >= 80
                ? "Excellent Security"
                : healthScore >= 50
                ? "Action Recommended"
                : "High Vulnerability Risk"}
            </div>
            <div className="text-[11px] text-neutral-500">
              {totalAnalyzed} login credentials checked
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Compromised */}
        <button
          onClick={() => setFilter(filter === "compromised" ? "all" : "compromised")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            filter === "compromised"
              ? "bg-red-950/30 border-red-500/60 shadow-lg shadow-red-950/20"
              : "bg-neutral-900/40 border-neutral-800/80 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-400">Compromised</span>
            <ShieldAlert
              className={`w-4 h-4 ${compromisedCount > 0 ? "text-red-400" : "text-neutral-500"}`}
            />
          </div>
          <div className="text-2xl font-bold text-neutral-100 font-mono">{compromisedCount}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Found in known breaches</div>
        </button>

        {/* Weak */}
        <button
          onClick={() => setFilter(filter === "weak" ? "all" : "weak")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            filter === "weak"
              ? "bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-950/20"
              : "bg-neutral-900/40 border-neutral-800/80 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-400">Weak Passwords</span>
            <Key
              className={`w-4 h-4 ${weakCount > 0 ? "text-amber-400" : "text-neutral-500"}`}
            />
          </div>
          <div className="text-2xl font-bold text-neutral-100 font-mono">{weakCount}</div>
          <div className="text-[11px] text-neutral-500 mt-1">&lt; 12 chars or low entropy</div>
        </button>

        {/* Reused */}
        <button
          onClick={() => setFilter(filter === "reused" ? "all" : "reused")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            filter === "reused"
              ? "bg-violet-950/30 border-violet-500/60 shadow-lg shadow-violet-950/20"
              : "bg-neutral-900/40 border-neutral-800/80 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-400">Reused Passwords</span>
            <Repeat
              className={`w-4 h-4 ${reusedCount > 0 ? "text-violet-400" : "text-neutral-500"}`}
            />
          </div>
          <div className="text-2xl font-bold text-neutral-100 font-mono">{reusedCount}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Shared across sites</div>
        </button>

        {/* Missing 2FA */}
        <button
          onClick={() => setFilter(filter === "no2fa" ? "all" : "no2fa")}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            filter === "no2fa"
              ? "bg-sky-950/30 border-sky-500/60 shadow-lg shadow-sky-950/20"
              : "bg-neutral-900/40 border-neutral-800/80 hover:border-neutral-700"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-400">Missing 2FA</span>
            <Fingerprint
              className={`w-4 h-4 ${no2faCount > 0 ? "text-sky-400" : "text-neutral-500"}`}
            />
          </div>
          <div className="text-2xl font-bold text-neutral-100 font-mono">{no2faCount}</div>
          <div className="text-[11px] text-neutral-500 mt-1">No authenticator key</div>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-neutral-900/60 border border-neutral-800 rounded-xl w-full sm:w-auto overflow-x-auto">
          {(
            [
              { id: "all", label: "All Logins" },
              { id: "compromised", label: `Compromised (${compromisedCount})` },
              { id: "weak", label: `Weak (${weakCount})` },
              { id: "reused", label: `Reused (${reusedCount})` },
              { id: "no2fa", label: `No 2FA (${no2faCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                filter === tab.id
                  ? "bg-neutral-100 text-neutral-900 font-semibold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search credentials..."
            className="w-full bg-neutral-900/60 border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-700"
          />
        </div>
      </div>

      {/* Items Audit List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 text-center text-neutral-500 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-neutral-400" />
            Analyzing vault credentials...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center border border-neutral-800/80 rounded-2xl bg-neutral-900/30 p-8">
            <div className="relative w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full" />
              <ShieldCheck className="w-12 h-12 text-emerald-400 relative z-10" />
            </div>
            <h3 className="text-base font-semibold text-neutral-200">No Security Issues Found</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              All credentials in this category meet high cryptographic security standards.
            </p>
          </div>
        ) : (
          filteredList.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-900/70 hover:border-neutral-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <SiteIcon domain={item.domain} name={item.name} size={38} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-neutral-100 truncate">
                      {item.name}
                    </span>
                    {item.folder && (
                      <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-medium">
                        {item.folder}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">
                    {item.username || item.domain || "No username"}
                  </div>

                  {/* Vulnerability badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {item.pwnedCount !== null && item.pwnedCount > 0 && (
                      <span className="text-[10px] font-medium bg-red-950/40 text-red-400 border border-red-800/50 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Pwned in {item.pwnedCount.toLocaleString()} breaches
                      </span>
                    )}

                    {item.isWeak && (
                      <span className="text-[10px] font-medium bg-amber-950/40 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Key className="w-3 h-3" /> Weak password
                      </span>
                    )}

                    {item.isReused && (
                      <span className="text-[10px] font-medium bg-violet-950/40 text-violet-400 border border-violet-800/50 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> Reused ({item.reusedCount} accounts)
                      </span>
                    )}

                    {!item.hasTotp && (
                      <span className="text-[10px] font-medium bg-sky-950/40 text-sky-400 border border-sky-800/50 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Fingerprint className="w-3 h-3" /> No 2FA TOTP
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Link
                  href={`/generator?target=${item.id}`}
                  className="p-2 px-3 text-xs font-semibold text-neutral-300 hover:text-neutral-100 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Wand2 className="w-3.5 h-3.5 text-neutral-400" />
                  Generate
                </Link>
                <Link
                  href={`/vault?edit=${item.id}`}
                  className="p-2 px-3 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

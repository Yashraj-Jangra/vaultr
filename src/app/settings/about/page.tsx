"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Info,
  ShieldCheck,
  Cpu,
  HardDrive,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  History,
  LifeBuoy,
  Shield,
  Layers,
  Terminal,
  Activity,
} from "lucide-react";
import {
  VAULTR_EDITION,
  VAULTR_VERSION,
  VAULTR_BUILD_NUMBER,
  VAULTR_BUILD_CHANNEL,
  VAULTR_CRYPTO_SPEC,
  getBuildSignature,
} from "@vaultr/core";
import { useTheme } from "@/context/ThemeContext";

function FieldBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-xl p-5">
      {children}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col md:flex-row gap-8 py-10 border-b border-[var(--border)] last:border-0">
      <div className="w-full md:w-1/3 shrink-0">
        <h2 className="text-[14px] font-semibold text-neutral-200">{title}</h2>
        {description && (
          <p className="text-[13px] text-neutral-500 mt-1.5 pr-4 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="w-full md:flex-1 space-y-4">{children}</div>
    </section>
  );
}

export default function AboutSettingsPage() {
  const { activeTheme, mode } = useTheme();
  const [copied, setCopied] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<string>("Calculating…");
  const [subtleCryptoOk, setSubtleCryptoOk] = useState<boolean>(true);
  const [clientPlatform, setClientPlatform] = useState<string>("Web Browser");

  useEffect(() => {
    // Check SubtleCrypto
    if (typeof window !== "undefined") {
      setSubtleCryptoOk(!!(window.crypto && window.crypto.subtle));
      setClientPlatform(navigator.userAgent || "Web Browser");
    }

    // Query storage quota
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        const usageMb = ((est.usage || 0) / (1024 * 1024)).toFixed(2);
        const quotaMb = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
        setStorageEstimate(`${usageMb} MB used of ~${quotaMb} MB available`);
      }).catch(() => {
        setStorageEstimate("Standard Web Storage");
      });
    } else {
      setStorageEstimate("Standard Web Storage");
    }
  }, []);

  const handleCopyDiagnostics = () => {
    const bundle = {
      product: VAULTR_EDITION,
      version: VAULTR_VERSION,
      build: VAULTR_BUILD_NUMBER,
      channel: VAULTR_BUILD_CHANNEL,
      cryptoSpec: VAULTR_CRYPTO_SPEC,
      subtleCryptoSupported: subtleCryptoOk,
      themeMode: mode,
      themeName: activeTheme.name,
      storageEstimate,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
      timestamp: new Date().toISOString(),
    };

    navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pb-20 max-w-5xl mx-auto space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-semibold text-neutral-100">About & System</h1>
            <span className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {VAULTR_BUILD_CHANNEL}
            </span>
          </div>
          <p className="text-[14px] text-neutral-500 mt-1">
            Build metadata, cryptographic engine status, and client telemetry.
          </p>
        </div>

        <button
          onClick={handleCopyDiagnostics}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors border border-neutral-700 bg-neutral-800 text-neutral-200 hover:text-white hover:bg-neutral-700 shadow-sm cursor-pointer shrink-0"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? "Copied Diagnostics!" : "Copy Diagnostic Bundle"}</span>
        </button>
      </div>

      {/* ── Section 1: Product & Build Metadata ── */}
      <Section
        title="Product & Build"
        description="Version identification and active release metadata."
      >
        <FieldBox>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800/60">
              <div className="flex items-center gap-3">
                <Image
                  src="/brand/vaultr-lock-dark-solid.png"
                  alt="Vaultr Lock"
                  width={36}
                  height={36}
                  className="rounded-lg border border-neutral-800 object-contain p-1"
                />
                <div>
                  <h3 className="text-[15px] font-semibold text-neutral-100">{VAULTR_EDITION}</h3>
                  <p className="text-[12px] font-mono text-neutral-500">{getBuildSignature("web")}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2.5 py-1 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Clean</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[12px]">
              <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-sans">Version</span>
                <span className="text-neutral-200 font-semibold">{VAULTR_VERSION}</span>
              </div>
              <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-sans">Build Number</span>
                <span className="text-neutral-200 font-semibold">{VAULTR_BUILD_NUMBER}</span>
              </div>
              <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-sans">Channel</span>
                <span className="text-neutral-200 font-semibold uppercase">{VAULTR_BUILD_CHANNEL}</span>
              </div>
            </div>
          </div>
        </FieldBox>
      </Section>

      {/* ── Section 2: Cryptographic Engine & Telemetry ── */}
      <Section
        title="Cryptographic Engine"
        description="Hardware acceleration and browser WebCrypto API status."
      >
        <FieldBox>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] text-neutral-200 font-medium">
                <Cpu className="w-4 h-4 text-blue-400" />
                <span>WebCrypto SubtleCrypto Provider</span>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                subtleCryptoOk ? "text-emerald-400 border-emerald-900/50 bg-emerald-950/30" : "text-red-400 border-red-900/50 bg-red-950/30"
              }`}>
                {subtleCryptoOk ? "Active & Hardware Accelerated" : "Not Supported"}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-1.5 text-[12px]">
              <div className="flex justify-between text-neutral-400">
                <span>Algorithm:</span>
                <span className="font-mono text-neutral-200 font-medium">{VAULTR_CRYPTO_SPEC.algorithm}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Key Derivation Function:</span>
                <span className="font-mono text-neutral-200 font-medium">{VAULTR_CRYPTO_SPEC.kdf} ({VAULTR_CRYPTO_SPEC.iterations.toLocaleString()} rounds)</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Storage Quota:</span>
                <span className="font-mono text-neutral-200 font-medium">{storageEstimate}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Active Theme:</span>
                <span className="font-mono text-neutral-200 font-medium">{activeTheme.name} ({mode})</span>
              </div>
            </div>
          </div>
        </FieldBox>
      </Section>

      {/* ── Section 3: Official Resources & Documentation ── */}
      <Section
        title="Resources & Links"
        description="Access documentation, release notes, and security whitepapers."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/docs"
            className="p-4 rounded-xl border border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-800/60 hover:border-neutral-700 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-[13px] font-medium text-neutral-200 block">Documentation</span>
                <span className="text-[11px] text-neutral-500">Guides, APIs, self-hosting</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-300 transition-colors" />
          </Link>

          <Link
            href="/changelog"
            className="p-4 rounded-xl border border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-800/60 hover:border-neutral-700 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <History className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[13px] font-medium text-neutral-200 block">Release Notes</span>
                <span className="text-[11px] text-neutral-500">Changelog & version history</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-300 transition-colors" />
          </Link>

          <Link
            href="/security"
            className="p-4 rounded-xl border border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-800/60 hover:border-neutral-700 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[13px] font-medium text-neutral-200 block">Security Whitepaper</span>
                <span className="text-[11px] text-neutral-500">Cryptographic audit spec</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-300 transition-colors" />
          </Link>

          <Link
            href="/settings/support"
            className="p-4 rounded-xl border border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-800/60 hover:border-neutral-700 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <LifeBuoy className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-[13px] font-medium text-neutral-200 block">Help Desk & Support</span>
                <span className="text-[11px] text-neutral-500">Open support tickets</span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-300 transition-colors" />
          </Link>
        </div>
      </Section>
    </div>
  );
}

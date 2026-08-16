"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  Sparkles,
  Shield,
  Zap,
  Smartphone,
  Puzzle,
  Wrench,
  Tag,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { VAULTR_EDITION } from "@vaultr/core";

interface ChangeItem {
  type: "feature" | "security" | "performance" | "mobile" | "extension" | "fix";
  text: string;
}

interface Release {
  version: string;
  codename: string;
  date: string;
  tagline: string;
  isLatest?: boolean;
  changes: ChangeItem[];
}

const RELEASES: Release[] = [
  {
    version: "v0.2.5",
    codename: "Mobile Refinement & Storage Engine",
    date: "August 16, 2026",
    tagline: "Live DB Storage Aggregator, Seamless QR Scanner Mask, OAuth Proxy Resilience & UI Parity",
    isLatest: true,
    changes: [
      { type: "security", text: "Hardened mobile Google OAuth with trusted proxy header propagation, server-side Custom Tabs launch, and session token deep-link dispatch." },
      { type: "performance", text: "Engineered live DB-computed storage usage engine across server, web, and mobile clients with atomic attachment & payload aggregation." },
      { type: "mobile", text: "Upgraded 2FA camera scanner with a continuous SVG rounded mask (rx=16) and aligned corner brackets, eliminating subpixel gaps." },
      { type: "mobile", text: "Optimized 2FA Assign Modal with virtualized FlatList, site favicons, and decrypted username sublabels." },
      { type: "mobile", text: "Redesigned mobile Account Settings: segregated storage meter and optional personal details cards." },
      { type: "mobile", text: "Redesigned Settings profile header to an unboxed, prominent native layout with 64px avatar and bold typography." },
      { type: "feature", text: "Unified circular FAB buttons across main vault, category filters, and 2FA QR code scanner." },
      { type: "fix", text: "Scaled 2FA live countdown favicons to fit rings snugly and added fallback avatar error recovery." },
    ],
  },
  {
    version: "v0.2.4",
    codename: "VaultR 2026 Edition",
    date: "August 16, 2026",
    tagline: "Universal Build Engine, Cross-Platform File Attachments & Scoped Storage Hardening",
    changes: [
      { type: "security", text: "Universal binary file encryption with non-extractable WebCrypto SubtleCrypto and Hermes @noble/ciphers AES-256-GCM fallback." },
      { type: "feature", text: "New Universal Information Hub: Public /about, /docs, /changelog, and authenticated /settings/about." },
      { type: "mobile", text: "Migrated Android scoped storage to copyAsync cache staging, resolving Android 14-16 content:// URI permission lockouts." },
      { type: "mobile", text: "Integrated expo-sharing for native Android/iOS file save/share sheet with decrypted files." },
      { type: "extension", text: "Upgraded popup UI with VaultR 2026 branding and direct resource deep-linking." },
      { type: "performance", text: "Stripped newline/whitespace formatting from base64 streams in React Native to prevent AES-GCM invalid tag exceptions." },
      { type: "fix", text: "Fixed UTF-8 text response corruption on binary file downloads across web and mobile clients." },
    ],
  },
  {
    version: "v0.2.3",
    codename: "Autofill & System Integration",
    date: "August 10, 2026",
    tagline: "Android Autofill Service, Samsung Keyboard Inline Suggestions & Quick Settings Tile",
    changes: [
      { type: "mobile", text: "Native Android AutofillService implementation with accessibility fallback and system credential suggestions." },
      { type: "mobile", text: "Added Android 13/14+ API 33 Presentations & Field.Builder for inline suggestions on Samsung Keyboard and Gboard." },
      { type: "mobile", text: "Implemented Quick Settings (QS) Tile for 1-tap live autofill overlay with foreground app detection." },
      { type: "mobile", text: "Designed minimal sleek autofill bottom sheet with 1-tap fill and 3-dot copy menu." },
      { type: "fix", text: "Isolated task affinity on autofill activities to prevent accidentally launching the main Vaultr app." },
      { type: "performance", text: "Optimized text injection timing for high-refresh-rate displays and secure password inputs." },
    ],
  },
  {
    version: "v0.2.2",
    codename: "Illustrations & Safe Sync",
    date: "August 04, 2026",
    tagline: "Contextual Illustration System, Camera QR 2FA Scanner & Safe Mobile Sync",
    changes: [
      { type: "feature", text: "Integrated contextual SVG hero illustrations across all empty states, dialogs, and error boundaries." },
      { type: "mobile", text: "Added camera QR code scanner (expo-camera) for instant mobile 2FA / TOTP credential setup." },
      { type: "mobile", text: "Implemented safe mobile sync with online-required writes and offline-resilient read caching." },
      { type: "feature", text: "Redesigned data import preview modal with batch duplicate detection and field mapping." },
      { type: "security", text: "Added master password verification animation with shake feedback on web and haptic feedback on mobile." },
      { type: "fix", text: "Resolved LAN origin resolution and session exchange issues for local development and self-hosted instances." },
    ],
  },
  {
    version: "v0.2.1",
    codename: "Folder Hierarchy & Session Revocation",
    date: "July 30, 2026",
    tagline: "Multi-Level Nested Folders, Device Session Revocation & Extension Packaging",
    changes: [
      { type: "feature", text: "Multi-level nested folder structure with recursive folder deletion dialogs and item disposition options." },
      { type: "security", text: "Strict device session revocation with backend cache bypass and instant token invalidation." },
      { type: "mobile", text: "Refined mobile navigation layout, safe area padding, and touch target scaling for edge-to-edge screens." },
      { type: "extension", text: "Added favorite toggles, quick action buttons, and automated zip packaging scripts for extension releases." },
      { type: "feature", text: "Minimal, card-free confirmation dialogs anchored with /public/illustrations/ and ambient glow." },
    ],
  },
  {
    version: "v0.2.0",
    codename: "Sync & Security Matrix",
    date: "July 28, 2026",
    tagline: "TOTP Authenticator Generator, Password Health Scanner & Custom Theme Engine",
    changes: [
      { type: "feature", text: "Built-in TOTP / 2FA code generator (HMAC-SHA1 RFC 6238) with real-time 30-second countdown rings." },
      { type: "security", text: "Password Health Scanner with k-Anonymity (HaveIBeenPwned 5-character SHA-1 range queries) ensuring no full hash leaves the client." },
      { type: "feature", text: "Comprehensive Theme Engine supporting 10+ dark/light palettes (Midnight, Emerald, Cyberpunk, Obsidian, OLED)." },
      { type: "extension", text: "Automatic credential detection on web forms with smart domain matching and autofill overlays." },
      { type: "performance", text: "Optimized client-side PBKDF2 derivation caching for snappy vault unlocks across browser tabs." },
    ],
  },
  {
    version: "v0.1.5",
    codename: "PostgreSQL & Better-Auth Migration",
    date: "July 15, 2026",
    tagline: "Architecture Overhaul: PostgreSQL, MinIO Storage, SMTP Dispatch & Admin Telemetry",
    changes: [
      { type: "security", text: "Complete architecture migration off Firebase to self-hosted PostgreSQL, Drizzle ORM, and Better-Auth." },
      { type: "feature", text: "MinIO / S3 compatible encrypted blob storage backend for custom attachments and user avatars." },
      { type: "feature", text: "SMTP email dispatch for email verification and 2FA OTP codes with magic byte verification." },
      { type: "security", text: "In-memory per-IP rate limiting middleware, Zod payload validation, and IP sanitization." },
      { type: "feature", text: "Admin panel with live sparkline telemetry graphs, database latency metrics, and storage stats." },
      { type: "fix", text: "Fixed Docker multi-platform builds for AMD64 and ARM64 architectures." },
    ],
  },
  {
    version: "v0.1.0",
    codename: "Zero-Knowledge Genesis",
    date: "June 10, 2026",
    tagline: "Foundational Zero-Knowledge Architecture & Self-Hosting Primitives",
    changes: [
      { type: "security", text: "Client-side AES-256-GCM encryption with 100,000 iterations PBKDF2-SHA-256 key derivation." },
      { type: "security", text: "Zero-knowledge identity separation: master password never transmitted or saved." },
      { type: "feature", text: "Self-hostable Docker Compose stack with PostgreSQL, Drizzle ORM, and automated migrations." },
      { type: "feature", text: "Custom fields support: Passwords, TOTP seeds, PINs, hidden notes, text values, and phone numbers." },
      { type: "feature", text: "Full import & export pipeline supporting Bitwarden, 1Password, CSV, and encrypted JSON backups." },
    ],
  },
];

const TYPE_CONFIG: Record<
  ChangeItem["type"],
  { label: string; icon: React.ReactNode; color: string }
> = {
  feature: {
    label: "Feature",
    icon: <Sparkles className="w-3.5 h-3.5" />,
    color: "text-blue-400 bg-blue-950/40 border-blue-900/50",
  },
  security: {
    label: "Security",
    icon: <Shield className="w-3.5 h-3.5" />,
    color: "text-emerald-400 bg-emerald-950/40 border-emerald-900/50",
  },
  performance: {
    label: "Performance",
    icon: <Zap className="w-3.5 h-3.5" />,
    color: "text-amber-400 bg-amber-950/40 border-amber-900/50",
  },
  mobile: {
    label: "Mobile",
    icon: <Smartphone className="w-3.5 h-3.5" />,
    color: "text-purple-400 bg-purple-950/40 border-purple-900/50",
  },
  extension: {
    label: "Extension",
    icon: <Puzzle className="w-3.5 h-3.5" />,
    color: "text-cyan-400 bg-cyan-950/40 border-cyan-900/50",
  },
  fix: {
    label: "Fix",
    icon: <Wrench className="w-3.5 h-3.5" />,
    color: "text-neutral-400 bg-neutral-900 border-neutral-800",
  },
};

export default function ChangelogPage() {
  const [filter, setFilter] = useState<string>("all");

  const filteredReleases = RELEASES.map((release) => {
    if (filter === "all") return release;
    return {
      ...release,
      changes: release.changes.filter((c) => c.type === filter),
    };
  }).filter((r) => r.changes.length > 0);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Sticky Top Navigation */}
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-neutral-500 hover:text-neutral-200 transition-colors text-[13px] font-medium"
          >
            <ChevronLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/about"
              className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              About
            </Link>
            <Link
              href="/docs"
              className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/vault"
              className="text-[12px] font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg border border-neutral-700 transition-colors"
            >
              Open Vault
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <div className="border-b border-[var(--border)] bg-neutral-950">
        <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Updates & Releases</p>
            <h1 className="text-[32px] font-bold text-neutral-100 tracking-tight">Changelog & Release Notes</h1>
            <p className="text-[14px] text-neutral-500 mt-2 max-w-lg">
              Detailed breakdown of cryptographic enhancements, features, performance optimizations, and client updates across all versions of {VAULTR_EDITION}.
            </p>
          </div>
          <div className="hidden md:block w-36 h-36 shrink-0">
            <Image
              src="/illustrations/system-update_gekm.svg"
              alt="System Update"
              width={144}
              height={144}
              className="object-contain w-full h-full"
              style={{ opacity: 0.55 }}
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-[var(--border)] bg-neutral-950/50 sticky top-14 z-30 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-medium text-neutral-500 mr-2 uppercase tracking-wider">Filter:</span>
          {[
            { id: "all", label: "All Updates" },
            { id: "feature", label: "Features" },
            { id: "security", label: "Security" },
            { id: "mobile", label: "Mobile" },
            { id: "extension", label: "Extension" },
            { id: "performance", label: "Performance" },
            { id: "fix", label: "Fixes" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-colors cursor-pointer shrink-0 ${
                filter === tab.id
                  ? "bg-neutral-800 text-neutral-100 border border-neutral-700"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Release Timeline */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="space-y-12 relative before:absolute before:inset-0 before:left-3.5 before:w-px before:bg-neutral-900">
          {filteredReleases.map((release) => (
            <div key={release.version} className="relative pl-10 space-y-4">
              {/* Timeline Dot */}
              <div
                className={`absolute left-1.5 top-1.5 w-4 h-4 rounded-full border-2 border-neutral-950 -translate-x-1/2 flex items-center justify-center ${
                  release.isLatest ? "bg-emerald-400" : "bg-neutral-700"
                }`}
              >
                {release.isLatest && <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />}
              </div>

              {/* Release Header Card */}
              <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-950 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-900 pb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[18px] font-bold text-neutral-100 font-mono">{release.version}</span>
                    <span className="text-[13px] font-medium text-neutral-300 px-2.5 py-0.5 rounded-md bg-neutral-900 border border-neutral-800">
                      {release.codename}
                    </span>
                    {release.isLatest && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 uppercase tracking-widest px-2 py-0.5 rounded-full">
                        Latest Release
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-neutral-500 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    {release.date}
                  </div>
                </div>

                <p className="text-[14px] text-neutral-400 font-medium">{release.tagline}</p>

                {/* Changes List */}
                <ul className="space-y-2.5 pt-2">
                  {release.changes.map((change, idx) => {
                    const meta = TYPE_CONFIG[change.type];
                    return (
                      <li key={idx} className="flex items-start gap-3 text-[13px] text-neutral-300">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0 mt-0.5 border ${meta.color}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                        <span className="leading-relaxed text-neutral-400">{change.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

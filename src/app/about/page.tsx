"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Shield,
  ChevronLeft,
  Lock,
  Smartphone,
  Puzzle,
  Globe,
  KeyRound,
  Database,
  Cpu,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Server,
  Layers,
} from "lucide-react";
import {
  VAULTR_EDITION,
  VAULTR_VERSION,
  VAULTR_BUILD_NUMBER,
  VAULTR_CRYPTO_SPEC,
} from "@vaultr/core";

const PLATFORMS = [
  {
    title: "Web Vault",
    desc: "Full-featured responsive web client with zero-knowledge WebCrypto, multi-folder organization, TOTP authenticators, and password health audits.",
    icon: <Globe className="w-5 h-5 text-blue-400" />,
    badge: "v0.2.4 · Live",
    badgeColor: "text-blue-400 bg-blue-950/40 border-blue-900/50",
  },
  {
    title: "Browser Extension",
    desc: "Lightweight, instant autofill for Chrome, Edge, Brave, and Firefox. Detects login inputs, suggests passwords, and securely auto-submits.",
    icon: <Puzzle className="w-5 h-5 text-amber-400" />,
    badge: "v0.2.4 · Chrome / Edge",
    badgeColor: "text-amber-400 bg-amber-950/40 border-amber-900/50",
  },
  {
    title: "Mobile App",
    desc: "Native Android & iOS clients powered by Expo SDK, biometric unlock (Fingerprint / Face ID), scoped storage encryption, and system autofill service.",
    icon: <Smartphone className="w-5 h-5 text-emerald-400" />,
    badge: "v0.2.4 · Android & iOS",
    badgeColor: "text-emerald-400 bg-emerald-950/40 border-emerald-900/50",
  },
];

const PILLARS = [
  {
    title: "Zero-Knowledge Architecture",
    desc: "Your master password is never sent over any network. AES-256-GCM encryption and PBKDF2 derivation occur strictly in local client memory.",
    icon: <Shield className="w-4 h-4 text-emerald-400" />,
  },
  {
    title: "Mathematical Sovereignty",
    desc: "All vault records, custom fields, and file attachments are stored as opaque ciphertext blobs. Even database administrators cannot decrypt your secrets.",
    icon: <Lock className="w-4 h-4 text-blue-400" />,
  },
  {
    title: "Self-Hosting Freedom",
    desc: "Deploy on any VPS, home lab, or private cloud using lightweight Docker Compose and PostgreSQL with no telemetry or third-party phone-homes.",
    icon: <Server className="w-4 h-4 text-purple-400" />,
  },
  {
    title: "Cross-Platform Cohesion",
    desc: "Instant encrypted sync across desktop browsers, browser extensions, and mobile devices with matching ciphertext wire formats.",
    icon: <Layers className="w-4 h-4 text-amber-400" />,
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Sticky Top Navigation */}
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-neutral-500 hover:text-neutral-200 transition-colors text-[13px] font-medium"
          >
            <ChevronLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider px-2 py-0.5 rounded border border-neutral-800 bg-neutral-900/60">
              {VAULTR_EDITION}
            </span>
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
      <div className="relative border-b border-[var(--border)] bg-neutral-950 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-900/80 text-[11px] text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {VAULTR_EDITION} · Production Release {VAULTR_VERSION}
            </div>
            
            <h1 className="text-[34px] sm:text-[42px] font-bold text-neutral-100 tracking-tight leading-tight">
              Privacy by mathematics. <br />
              <span className="text-neutral-400 font-normal">Not by trust.</span>
            </h1>

            <p className="text-[14px] text-neutral-400 leading-relaxed">
              Vaultr is a zero-knowledge, end-to-end encrypted password manager built for developers, teams, and individuals who refuse to compromise their digital sovereignty.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-semibold rounded-lg transition-colors"
              >
                Read Documentation <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/changelog"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-800 hover:border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 text-[13px] font-medium rounded-lg transition-colors"
              >
                Release Notes
              </Link>
              <Link
                href="/security"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-800 hover:border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 text-[13px] font-medium rounded-lg transition-colors"
              >
                Security Whitepaper
              </Link>
            </div>
          </div>

          <div className="w-64 h-64 md:w-80 md:h-80 shrink-0 relative flex items-center justify-center">
            <Image
              src="/illustrations/visionary-technology_f6b3.svg"
              alt="VaultR 2026 Visionary Technology"
              width={300}
              height={300}
              className="object-contain w-full h-full drop-shadow-2xl"
              style={{ opacity: 0.85 }}
              priority
            />
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-16">
        {/* Core Pillars */}
        <section className="space-y-6">
          <div>
            <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">Architecture</p>
            <h2 className="text-[22px] font-semibold text-neutral-200 mt-1">Foundational Principles</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="p-6 rounded-2xl border border-neutral-800/80 bg-neutral-950/60 space-y-2 hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-2.5 text-neutral-200 font-semibold text-[14px]">
                  <div className="p-1.5 rounded-md bg-neutral-900 border border-neutral-800">
                    {p.icon}
                  </div>
                  {p.title}
                </div>
                <p className="text-[13px] text-neutral-500 leading-relaxed pl-9">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Platform Ecosystem */}
        <section className="space-y-6">
          <div>
            <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">Ecosystem</p>
            <h2 className="text-[22px] font-semibold text-neutral-200 mt-1">Cross-Platform Clients</h2>
            <p className="text-[13px] text-neutral-500 mt-1">One encrypted vault, universally accessible across your digital environment.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLATFORMS.map((platform) => (
              <div
                key={platform.title}
                className="p-6 rounded-2xl border border-neutral-800/80 bg-neutral-950/80 flex flex-col justify-between space-y-4 hover:border-neutral-700 transition-colors group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-800">
                      {platform.icon}
                    </div>
                    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${platform.badgeColor}`}>
                      {platform.badge}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-neutral-200">{platform.title}</h3>
                  <p className="text-[13px] text-neutral-500 leading-relaxed">{platform.desc}</p>
                </div>
                <div className="pt-3 border-t border-neutral-900 flex items-center text-[12px] text-neutral-400 group-hover:text-neutral-200 transition-colors">
                  <span>Explore features</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cryptographic Spec Highlight Card */}
        <section className="p-8 rounded-2xl border border-neutral-800 bg-neutral-950 space-y-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-900 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-[16px] font-semibold text-neutral-200">Cryptographic Specification Standards</h3>
              </div>
              <p className="text-[13px] text-neutral-500">Implemented strictly following NIST SP 800-38D and WebCrypto RFC guidelines.</p>
            </div>
            <Link
              href="/security"
              className="inline-flex items-center gap-1.5 text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Full Security Spec <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-[12px]">
            <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest block font-sans">Cipher</span>
              <span className="text-emerald-400 font-semibold">{VAULTR_CRYPTO_SPEC.algorithm}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest block font-sans">KDF</span>
              <span className="text-blue-400 font-semibold">{VAULTR_CRYPTO_SPEC.kdf}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest block font-sans">Iterations</span>
              <span className="text-neutral-200 font-semibold">{VAULTR_CRYPTO_SPEC.iterations.toLocaleString()} rounds</span>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest block font-sans">IV / Tag</span>
              <span className="text-neutral-200 font-semibold">12B Nonce · 128-bit</span>
            </div>
          </div>
        </section>

        {/* Footer Navigation Bar */}
        <div className="pt-8 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-neutral-500">
          <p>© 2026 Vaultr. All cryptographic primitives executed client-side.</p>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="hover:text-neutral-300 transition-colors">Documentation</Link>
            <Link href="/changelog" className="hover:text-neutral-300 transition-colors">Changelog</Link>
            <Link href="/privacy" className="hover:text-neutral-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-neutral-300 transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

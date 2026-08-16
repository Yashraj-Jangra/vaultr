"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Shield, ChevronLeft, Key, Lock, Database, Eye, AlertTriangle } from "lucide-react";

const SPEC = [
  { label: "Encryption algorithm",  value: "AES-256-GCM",                  color: "text-emerald-400" },
  { label: "Key derivation",        value: "PBKDF2-SHA-256",               color: "text-blue-400" },
  { label: "PBKDF2 iterations",     value: "100,000",                       color: "text-neutral-300" },
  { label: "Salt",                  value: "User ID (user-unique)",    color: "text-neutral-400" },
  { label: "IV / nonce",            value: "12 bytes, crypto.getRandomValues()", color: "text-neutral-400" },
  { label: "Authentication tag",    value: "128 bits (GCM standard)",       color: "text-emerald-400" },
  { label: "Key length",            value: "256 bits",                      color: "text-blue-400" },
  { label: "Stored master password", value: "Never — zero-knowledge",       color: "text-neutral-600" },
  { label: "Data at rest",          value: "Encrypted ciphertext only",     color: "text-neutral-400" },
  { label: "Encryption location",   value: "Browser (WebCrypto API)",       color: "text-neutral-300" },
];

const SECTIONS = [
  { id: "spec",       title: "Cryptographic Spec",    icon: <Key className="w-3.5 h-3.5" /> },
  { id: "flow",       title: "How Encryption Works",  icon: <Lock className="w-3.5 h-3.5" /> },
  { id: "storage",    title: "Storage Architecture",  icon: <Database className="w-3.5 h-3.5" /> },
  { id: "cantsee",    title: "What We Cannot See",    icon: <Eye className="w-3.5 h-3.5" /> },
  { id: "disclosure", title: "Responsible Disclosure", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
];

const STEPS = [
  {
    n: "1", title: "Key derivation",
    desc: "Your master password is combined with your User ID (acting as a unique salt) and passed through PBKDF2-SHA-256 with 100,000 iterations. The result is a 256-bit AES-GCM key.",
    illustration: "/illustrations/fingerprint_kdwq.svg",
  },
  {
    n: "2", title: "Encryption",
    desc: "Each vault entry is serialised to JSON, then encrypted using AES-256-GCM with a randomly generated 12-byte IV (nonce) from window.crypto.getRandomValues(). The IV and ciphertext are stored together.",
    illustration: "/illustrations/secure-password_9qv4.svg",
  },
  {
    n: "3", title: "Storage",
    desc: "Only the base64-encoded ciphertext blob is sent to the server. The plaintext credentials and the derived key never leave your browser tab.",
    illustration: "/illustrations/secure-server_lz9x.svg",
  },
  {
    n: "4", title: "Decryption",
    desc: "When you unlock, the key is re-derived from your master password in the browser. AES-GCM decryption happens locally. If the master password is wrong, decryption fails with an authentication error.",
    illustration: "/illustrations/unlock_m0yr.svg",
  },
];

export default function SecurityPage() {
  const [active, setActive] = useState("spec");

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    const ids = SECTIONS.map(s => s.id);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-200 transition-colors text-[13px] font-medium">
            <ChevronLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/about" className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors">About</Link>
            <Link href="/docs" className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors">Docs</Link>
            <Link href="/changelog" className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors">Changelog</Link>
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider px-2 py-0.5 rounded border border-neutral-800 bg-neutral-900/60">
              VaultR 2026
            </span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-[var(--border)] bg-neutral-950">
        <div className="max-w-6xl mx-auto px-6 py-12 relative flex items-center justify-between gap-8">
          <div>
            <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Cryptographic Whitepaper</p>
            <h1 className="text-[32px] font-bold text-neutral-100 tracking-tight mb-2">Security Architecture</h1>
            <p className="text-[14px] text-neutral-500 max-w-md">How VaultR 2026 protects your credentials — mathematically guaranteed.</p>
          </div>
          <div className="hidden md:block w-48 h-48 shrink-0 self-center">
            <Image src="/illustrations/firewall_cfej.svg" alt="" width={192} height={192} className="object-contain w-full h-full" style={{ opacity: 0.45 }} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex gap-12">

          {/* TOC Sidebar */}
          <aside className="hidden lg:block w-52 shrink-0">
            <div className="sticky top-20 space-y-0.5">
              <p className="text-[10px] text-neutral-700 uppercase tracking-widest px-3 mb-3">On this page</p>
              {SECTIONS.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] transition-all group ${
                    active === s.id
                      ? "bg-neutral-900 text-neutral-200"
                      : "text-neutral-600 hover:text-neutral-300 hover:bg-neutral-900/60"
                  }`}
                >
                  <span className={`shrink-0 transition-colors ${ active === s.id ? "text-neutral-400" : "text-neutral-800 group-hover:text-neutral-600" }`}>{s.icon}</span>
                  {s.title}
                </a>
              ))}
              <div className="pt-4 mt-4 border-t border-[var(--border)] space-y-0.5">
                <Link href="/privacy" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">Terms of Service</Link>
                <Link href="/docs" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">Documentation</Link>
                <Link href="/changelog" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">Changelog</Link>
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 space-y-12">

            {/* Spec table */}
            <section id="spec" className="scroll-mt-24">
              <SectionHeader title="Cryptographic Spec" icon={<Key className="w-4 h-4" />} />
              <div className="mt-4 rounded-xl border border-[var(--border)] overflow-hidden bg-neutral-950">
                <div className="font-mono text-[12px] divide-y divide-[var(--border)]">
                  {SPEC.map((row) => (
                    <div key={row.label} className="flex items-center justify-between px-5 py-3">
                      <span className="text-neutral-600">{row.label}</span>
                      <span className={row.color}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Encryption flow */}
            <section id="flow" className="scroll-mt-24 space-y-4">
              <SectionHeader title="How Encryption Works" icon={<Lock className="w-4 h-4" />} />
              <div className="mt-4 space-y-3">
                {STEPS.map((step) => (
                  <div key={step.n} className="flex gap-4 p-5 rounded-xl border border-[var(--border)] bg-neutral-950 group hover:border-neutral-800 transition-colors">
                    <div className="shrink-0 w-12 h-12">
                      <Image src={step.illustration} alt="" width={48} height={48} className="object-contain w-full h-full" style={{ opacity: 0.6 }} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-neutral-700">{step.n}.</span>
                        <h3 className="text-[14px] font-semibold text-neutral-200">{step.title}</h3>
                      </div>
                      <p className="text-[13px] text-neutral-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Storage architecture */}
            <section id="storage" className="scroll-mt-24 space-y-4">
              <SectionHeader title="Storage Architecture" icon={<Database className="w-4 h-4" />} />
              <div className="mt-4 p-5 rounded-xl border border-[var(--border)] bg-neutral-950 flex items-start gap-4">
                <Image src="/illustrations/secure-server_lz9x.svg" alt="" width={64} height={64} className="object-contain shrink-0" style={{ opacity: 0.55 }} />
                <p className="text-[14px] text-neutral-500 leading-relaxed">
                  All ciphertext is stored in a self-hosted PostgreSQL database. The encryption key is derived fresh in your browser each time you unlock. No key material is ever persisted — not in our database, not in cookies, not in localStorage.
                </p>
              </div>
            </section>

            {/* What we can't see */}
            <section id="cantsee" className="scroll-mt-24 space-y-4">
              <SectionHeader title="What We Cannot See" icon={<Eye className="w-4 h-4" />} />
              <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
                {[
                  "Your master password",
                  "Your plaintext passwords",
                  "Usernames or email addresses",
                  "Credit card numbers",
                  "Secure notes content",
                  "TOTP secret keys",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--border)] bg-neutral-950">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[13px] text-neutral-400">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Responsible disclosure */}
            <section id="disclosure" className="scroll-mt-24 space-y-4">
              <SectionHeader title="Responsible Disclosure" icon={<AlertTriangle className="w-4 h-4" />} />
              <div className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/20 p-5 space-y-2">
                <p className="text-[14px] text-amber-700/80 leading-relaxed">
                  If you discover a security vulnerability, please report it privately before public disclosure. We take all reports seriously and aim to respond within 48 hours.
                </p>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
      <span className="text-neutral-600">{icon}</span>
      <h2 className="text-[16px] font-semibold text-neutral-200">{title}</h2>
    </div>
  );
}

"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useRouter } from "next/navigation";
import { useSiteConfig } from "@/context/SiteConfigContext";
import {
  Shield, Lock, Globe, Key, RefreshCw, Fingerprint,
  ChevronRight, ArrowRight
} from "lucide-react";

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

// ── Feature cards data ────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <Lock className="w-5 h-5" />,
    title: "AES-256-GCM Encryption",
    desc: "Every field encrypted client-side before touching the network. Your master password never leaves your device.",
    illustration: "/illustrations/secure-login_m11a.svg",
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Zero-Knowledge Model",
    desc: "We store only encrypted ciphertext. No secret key, no backdoor — mathematically impossible to read your data.",
    illustration: "/illustrations/security_0ubl.svg",
  },
  {
    icon: <Fingerprint className="w-5 h-5" />,
    title: "2FA Manager",
    desc: "Store TOTP secrets alongside passwords. Live countdown codes with auto-copy, powered by WebCrypto.",
    illustration: "/illustrations/two-factor-authentication_ofho.svg",
  },
  {
    icon: <Key className="w-5 h-5" />,
    title: "Advanced Generator",
    desc: "Random, passphrase, PIN, and custom-pattern modes. Strength scoring with estimated crack-time estimates.",
    illustration: "/illustrations/secure-password_9qv4.svg",
  },
  {
    icon: <RefreshCw className="w-5 h-5" />,
    title: "Password Health",
    desc: "Automatic scanning for weak, reused, and outdated passwords. HaveIBeenPwned checks with k-anonymity.",
    illustration: "/illustrations/fingerprint_kdwq.svg",
  },
  {
    icon: <Globe className="w-5 h-5" />,
    title: "Multi-Template Vault",
    desc: "Store logins, credit cards, addresses, secure notes, and profiles — all encrypted with the same key.",
    illustration: "/illustrations/personal-notebook_blje.svg",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Create an account",
    desc: "Sign up with your email or Google — takes under 30 seconds.",
    illustration: "/illustrations/user-account_fvqa.svg",
  },
  {
    n: "02",
    title: "Set a master password",
    desc: "This is the only password you need to remember. It never leaves your device.",
    illustration: "/illustrations/enter-password_1kl4.svg",
  },
  {
    n: "03",
    title: "Add your credentials",
    desc: "Import from CSV or add entries manually. Access them securely, from anywhere.",
    illustration: "/illustrations/all-the-data_ijgn.svg",
  },
];

// ── Landing page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user, isAuthLoading } = useFirebaseAuth();
  const { config } = useSiteConfig();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && user) router.replace("/vault");
  }, [user, isAuthLoading, router]);

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-xs text-neutral-600">Loading…</p></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white/10 border border-white/10 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-neutral-300" />
            </div>
            <span className="text-[14px] font-semibold text-neutral-200">{config.name}</span>
          </div>

          <div className="hidden sm:flex items-center gap-6 text-[13px] text-neutral-500">
            <a href="#features"   className="hover:text-neutral-200 transition-colors">Features</a>
            <a href="#security"   className="hover:text-neutral-200 transition-colors">Security</a>
            <a href="#howitworks" className="hover:text-neutral-200 transition-colors">How it works</a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/auth" className="text-[13px] text-neutral-400 hover:text-neutral-200 px-3 py-1.5 transition-colors">
              Sign in
            </Link>
            <Link href="/auth" className="text-[13px] bg-neutral-100 hover:bg-white text-neutral-900 px-3.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5">
              Get started <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Radial fade overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,255,255,0.04) 0%, transparent 60%)" }} />

        {/* Vault illustration — background on mobile, side panel on lg */}
        <div className="absolute right-0 top-0 h-full w-1/2 pointer-events-none select-none hidden lg:flex items-center justify-end pr-8 opacity-[0.07]">
          <Image
            src="/illustrations/vault_tyfh.svg"
            alt=""
            width={480}
            height={480}
            className="object-contain"
            priority
          />
        </div>
        {/* Mobile: faint background vault illustration */}
        <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center lg:hidden opacity-[0.04]">
          <Image
            src="/illustrations/vault_tyfh.svg"
            alt=""
            width={320}
            height={320}
            className="object-contain"
          />
        </div>

        <div className="relative max-w-5xl mx-auto px-5 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-neutral-950 text-[11px] text-neutral-500 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Zero-knowledge · AES-256-GCM · Open architecture
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-neutral-100 leading-tight tracking-tight mb-6">
            Your passwords,<br />
            <span className="text-neutral-500">encrypted before they<br />leave your browser.</span>
          </h1>

          <p className="text-neutral-500 text-[16px] max-w-xl mx-auto leading-relaxed mb-10">
            {config.name} is a zero-knowledge password manager. Your master password is never stored, sent, or seen by anyone but you.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/auth" className="flex items-center gap-2 px-6 py-3 bg-neutral-100 hover:bg-white text-neutral-900 text-[14px] font-medium rounded-xl transition-colors">
              Start for free <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#howitworks" className="flex items-center gap-2 px-6 py-3 border border-[var(--border)] text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 text-[14px] rounded-xl transition-colors">
              How it works
            </a>
          </div>

          {/* Fake vault UI preview */}
          <div className="mt-16 relative mx-auto max-w-2xl">
            <div className="rounded-xl border border-[var(--border)] bg-neutral-950 overflow-hidden shadow-2xl">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--border)]">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                <div className="flex-1 mx-4 h-5 rounded-md bg-neutral-900 border border-[var(--border)]" />
              </div>
              <div className="p-4 space-y-2">
                {[
                  { name: "GitHub", sub: "dev@example.com", domain: "github.com", color: "#6e7681" },
                  { name: "Figma",  sub: "dev@example.com", domain: "figma.com",  color: "#a259ff" },
                  { name: "Linear", sub: "dev@example.com", domain: "linear.app", color: "#5e6ad2" },
                  { name: "Vercel", sub: "dev@example.com", domain: "vercel.com",  color: "#eaeaea" },
                ].map((item, i) => (
                  <div key={item.name} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] ${i === 0 ? "bg-neutral-900" : "bg-transparent"}`}>
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: item.color + "22", color: item.color }}>
                      {item.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-neutral-300 font-medium">{item.name}</p>
                      <p className="text-[11px] text-neutral-600">{item.sub}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="w-5 h-5 rounded bg-neutral-800" />
                      <div className="w-5 h-5 rounded bg-neutral-800" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Fade overlay at bottom of preview */}
            <div className="absolute inset-x-0 bottom-0 h-16 rounded-b-xl"
              style={{ background: "linear-gradient(to top, var(--bg), transparent)" }} />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="howitworks" className="max-w-5xl mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <p className="text-[11px] text-neutral-600 uppercase tracking-widest mb-3">Simple process</p>
          <h2 className="text-3xl font-semibold text-neutral-100">Up and running in minutes</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div key={step.n} className="space-y-4 relative">
              {/* Illustration: visible on all screen sizes, dims on mobile */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 opacity-60 sm:opacity-80 mx-auto sm:mx-0">
                <Image
                  src={step.illustration}
                  alt=""
                  width={80}
                  height={80}
                  className="object-contain w-full h-full"
                />
              </div>
              <span className="text-[11px] font-mono text-neutral-700 block">{step.n}</span>
              <h3 className="text-[15px] font-semibold text-neutral-200">{step.title}</h3>
              <p className="text-[13px] text-neutral-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-5 py-20">
          <div className="text-center mb-12">
            <p className="text-[11px] text-neutral-600 uppercase tracking-widest mb-3">Everything included</p>
            <h2 className="text-3xl font-semibold text-neutral-100">Built for security-minded people</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-[var(--border)] bg-neutral-950 p-5 space-y-3 hover:border-neutral-800 transition-colors group relative overflow-hidden">
                {/* Background illustration — faint, corner-anchored */}
                <div className="absolute bottom-2 right-2 w-16 h-16 opacity-[0.12] group-hover:opacity-[0.2] transition-opacity pointer-events-none select-none">
                  <Image
                    src={f.illustration}
                    alt=""
                    width={64}
                    height={64}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="w-9 h-9 rounded-lg bg-neutral-900 border border-[var(--border)] flex items-center justify-center text-neutral-400 group-hover:text-neutral-200 transition-colors relative z-10">
                  {f.icon}
                </div>
                <h3 className="text-[14px] font-semibold text-neutral-200 relative z-10">{f.title}</h3>
                <p className="text-[12px] text-neutral-500 leading-relaxed relative z-10">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security section ─────────────────────────────────────────────── */}
      <section id="security" className="border-t border-[var(--border)] bg-neutral-950">
        <div className="max-w-5xl mx-auto px-5 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <p className="text-[11px] text-neutral-600 uppercase tracking-widest">Security architecture</p>
              <h2 className="text-3xl font-semibold text-neutral-100 leading-snug">We cannot read your data. Mathematically.</h2>
              <p className="text-[14px] text-neutral-500 leading-relaxed">
                Your master password is used to derive an AES-256-GCM key via PBKDF2 (100,000 iterations, SHA-256). All encryption and decryption happens in your browser. Only ciphertext ever reaches our servers.
              </p>
              {/* Firewall illustration — visible md+, background on mobile */}
              <div className="flex items-center gap-5">
                <div className="hidden md:block w-24 h-24 opacity-60 shrink-0">
                  <Image
                    src="/illustrations/firewall_cfej.svg"
                    alt=""
                    width={96}
                    height={96}
                    className="object-contain w-full h-full"
                  />
                </div>
                <Link href="/security" className="inline-flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-neutral-200 transition-colors">
                  Read the full security spec <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 space-y-4 font-mono text-[12px] relative overflow-hidden">
              {/* Subtle background illustration in the specs card */}
              <div className="absolute -bottom-4 -right-4 w-28 h-28 opacity-[0.06] pointer-events-none select-none">
                <Image
                  src="/illustrations/secure-server_lz9x.svg"
                  alt=""
                  width={112}
                  height={112}
                  className="object-contain w-full h-full"
                />
              </div>
              {[
                { label: "Algorithm",      value: "AES-256-GCM",           color: "text-emerald-500" },
                { label: "Key derivation", value: "PBKDF2 / SHA-256",     color: "text-blue-400" },
                { label: "Iterations",     value: "100,000",               color: "text-purple-400" },
                { label: "IV size",        value: "12 bytes (random)",     color: "text-amber-400" },
                { label: "Auth tag",       value: "128 bits",              color: "text-emerald-500" },
                { label: "Stored secret",  value: "none — zero-knowledge", color: "text-neutral-600" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center border-b border-[var(--border)] pb-3 last:border-0 last:pb-0 relative z-10">
                  <span className="text-neutral-600">{row.label}</span>
                  <span className={row.color}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-5 py-20 text-center relative overflow-hidden">
          {/* Background completed illustration */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 w-32 h-32 opacity-[0.08] hidden md:block pointer-events-none select-none">
            <Image
              src="/illustrations/completed_vjc6.svg"
              alt=""
              width={128}
              height={128}
              className="object-contain w-full h-full"
            />
          </div>
          {/* Mobile: faint bg */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none md:hidden opacity-[0.04]">
            <Image
              src="/illustrations/completed_vjc6.svg"
              alt=""
              width={200}
              height={200}
              className="object-contain"
            />
          </div>
          <h2 className="text-3xl font-semibold text-neutral-100 mb-4 relative z-10">Start protecting your passwords today.</h2>
          <p className="text-neutral-500 text-[14px] mb-8 relative z-10">Free. No credit card. No tracking. No compromise.</p>
          <Link href="/auth" className="inline-flex items-center gap-2 px-8 py-3.5 bg-neutral-100 hover:bg-white text-neutral-900 text-[14px] font-medium rounded-xl transition-colors relative z-10">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-600" />
            <span className="text-[13px] text-neutral-600">{config.name}</span>
          </div>
          <div className="flex items-center gap-5 text-[12px] text-neutral-600">
            <Link href="/privacy"  className="hover:text-neutral-400 transition-colors">Privacy</Link>
            <Link href="/terms"    className="hover:text-neutral-400 transition-colors">Terms</Link>
            <Link href="/security" className="hover:text-neutral-400 transition-colors">Security</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-400 transition-colors flex items-center gap-1">
              <GithubIcon /> GitHub
            </a>
          </div>
          <p className="text-[11px] text-neutral-700">© {new Date().getFullYear()} {config.name}. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}

"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useSiteConfig } from "@/context/SiteConfigContext";
import {
  Shield, Lock, Globe, Key, RefreshCw, Fingerprint,
  ChevronRight, ArrowRight, Check, Copy, Terminal,
  ChevronDown, Menu, X, ShieldCheck, Star, GitFork, ExternalLink
} from "lucide-react";

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const VAULT_ITEMS = [
  { name: "GitHub", sub: "dev@example.com", color: "#6e7681", letter: "G" },
  { name: "Figma", sub: "dev@example.com", color: "#a259ff", letter: "F" },
  { name: "Linear", sub: "dev@example.com", color: "#5e6ad2", letter: "L" },
  { name: "Vercel", sub: "dev@example.com", color: "#eaeaea", letter: "V" },
  { name: "Stripe", sub: "dev@example.com", color: "#6772e5", letter: "S" },
];

const STEPS = [
  {
    n: "01",
    title: "Create your account",
    desc: "Sign up in seconds. Better-Auth handles identity while keeping zero insight into your vault contents.",
    illustration: "/illustrations/authentication_1evl.svg",
    tag: "Identity layer",
  },
  {
    n: "02",
    title: "Set a master password",
    desc: "Derived via 100,000 PBKDF2 iterations in WebCrypto. Never transmitted or saved — not even a hash.",
    illustration: "/illustrations/enter-password_1kl4.svg",
    tag: "Key derivation",
  },
  {
    n: "03",
    title: "Store & sync everywhere",
    desc: "Logins, TOTP tokens, credit cards, and notes — client-encrypted and synced in real time across all devices.",
    illustration: "/illustrations/vault_tyfh.svg",
    tag: "Encrypted sync",
  },
];

const FAQS = [
  {
    q: "How does zero-knowledge encryption work in Vaultr?",
    a: "When you enter your master password, Vaultr uses the browser-native WebCrypto API to run 100,000 PBKDF2 SHA-256 iterations to derive an AES-256-GCM key. All encryption and decryption happens exclusively inside your local browser memory. The server only receives opaque ciphertext blobs."
  },
  {
    q: "Can Vaultr staff or database admins view my passwords?",
    a: "No. It is mathematically impossible. Because the master key is derived locally and never sent over HTTP, neither database administrators nor host infrastructure possess the cryptographic key required to decipher your vault data."
  },
  {
    q: "What happens if I forget my master password?",
    a: "Because Vaultr operates on a strict zero-knowledge architecture, there is no master password reset backdoor. If you lose your master password, your vault data cannot be recovered by anyone."
  },
  {
    q: "How are 2FA / TOTP codes generated?",
    a: "TOTP seeds are encrypted client-side alongside your login credentials. When unlocked, Vaultr calculates 30-second HMAC-SHA1 RFC 6238 codes directly in your browser with real-time countdown timers."
  },
  {
    q: "Can I self-host Vaultr on my own infrastructure?",
    a: "Yes! Vaultr is built for self-hosting with Next.js, PostgreSQL, and Docker. You can deploy it on your own VPS or server and maintain total sovereignty over your application server."
  },
  {
    q: "How does the Password Health scanner work without leaking passwords?",
    a: "Vaultr evaluates password strength client-side. For breach checks, it uses k-anonymity: only the first 5 characters of your SHA-1 password hash are queried against HaveIBeenPwned API, ensuring your full hash or plaintext password never leaves your browser."
  }
];

// Animated timeline connector
function AnimatedLine({ active }: { active: boolean }) {
  return (
    <div className="hidden md:flex flex-1 items-center justify-center px-4 relative">
      <div className="w-full h-[1px] bg-[var(--border)] relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-neutral-500 to-neutral-700 transition-all duration-[1400ms] ease-out"
          style={{ width: active ? "100%" : "0%" }}
        />
        {/* Moving dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white transition-all duration-[1400ms] ease-out"
          style={{ left: active ? "calc(100% - 6px)" : "0%" }}
        />
      </div>
      {/* Arrow tip */}
      <div
        className="absolute right-4 w-1.5 h-1.5 border-r border-t border-[var(--fg-muted)] rotate-45 transition-opacity duration-300"
        style={{ opacity: active ? 1 : 0 }}
      />
    </div>
  );
}

export default function LandingPage() {
  const { user, isAuthLoading } = useAuth();
  const { config } = useSiteConfig();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stepsVisible, setStepsVisible] = useState(false);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthLoading && user) router.replace("/vault");
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  // IntersectionObserver for animated steps line
  useEffect(() => {
    if (!stepsRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStepsVisible(true); },
      { threshold: 0.3 }
    );
    obs.observe(stepsRef.current);
    return () => obs.disconnect();
  }, []);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <span className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--fg-muted)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] selection:bg-neutral-800 selection:text-white font-sans overflow-x-hidden">

      {/* ── Sticky Navigation ─────────────────────────────────────────────── */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--border)]" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/brand/vaultr-full-dark-transparent.png"
              alt={config.name}
              width={120}
              height={24}
              className="h-6 w-auto object-contain"
              priority
            />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[var(--fg-muted)]">
            <a href="#features" className="hover:text-[var(--fg)] transition-colors">Features</a>
            <a href="#security" className="hover:text-[var(--fg)] transition-colors">Security</a>
            <a href="#howitworks" className="hover:text-[var(--fg)] transition-colors">How It Works</a>
            <a href="#opensource" className="hover:text-[var(--fg)] transition-colors">Open Source</a>
            <a href="#faq" className="hover:text-[var(--fg)] transition-colors">FAQ</a>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <Link href="/auth" className="text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] px-3 py-1.5 transition-colors font-medium">
              Sign in
            </Link>
            <Link href="/auth" className="text-[13px] bg-white hover:bg-neutral-200 text-black px-4 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 active:scale-[0.98]">
              Get Started <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="sm:hidden p-2 text-[var(--fg-muted)] hover:text-[var(--fg)]"
            aria-label="Toggle menu"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="sm:hidden bg-[var(--surface)] border-b border-[var(--border)] px-6 py-5 space-y-3">
            <a href="#features" onClick={() => setMobileNavOpen(false)} className="block text-sm text-[var(--fg-muted)] py-1">Features</a>
            <a href="#security" onClick={() => setMobileNavOpen(false)} className="block text-sm text-[var(--fg-muted)] py-1">Security Architecture</a>
            <a href="#howitworks" onClick={() => setMobileNavOpen(false)} className="block text-sm text-[var(--fg-muted)] py-1">How It Works</a>
            <a href="#opensource" onClick={() => setMobileNavOpen(false)} className="block text-sm text-[var(--fg-muted)] py-1">Open Source</a>
            <a href="#faq" onClick={() => setMobileNavOpen(false)} className="block text-sm text-[var(--fg-muted)] py-1">FAQ</a>
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/auth" className="w-full text-center py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--fg)]">
                Sign in
              </Link>
              <Link href="/auth" className="w-full text-center py-2 rounded-lg bg-white text-black text-sm font-medium">
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-16 lg:pb-24">
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #222 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">

            {/* LEFT — Copy */}
            <div className="space-y-7 pt-4 pb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[11px] font-medium text-[var(--fg-muted)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Zero-Knowledge · AES-256-GCM · Open Architecture
              </div>

              <h1 className="text-[44px] sm:text-[56px] font-bold text-[var(--fg)] leading-[1.08] tracking-tight">
                Your passwords,<br />
                <span className="text-[var(--fg-muted)]">
                  encrypted before<br />they leave your browser.
                </span>
              </h1>

              <p className="text-[15px] text-[var(--fg-muted)] leading-relaxed max-w-[440px]">
                {config.name} is a zero-knowledge password manager. Your master password is never stored, sent, or seen — by anyone.
              </p>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {[
                  "No master password stored",
                  "No plaintext transmitted",
                  "Native WebCrypto API",
                  "Open source & self-hostable"
                ].map(t => (
                  <span key={t} className="flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
                    <Check className="w-3.5 h-3.5 text-[var(--fg)] shrink-0" />{t}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link href="/auth" className="flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-neutral-200 text-black text-[14px] font-medium rounded-lg transition-colors active:scale-[0.98]">
                  Start for free <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#howitworks" className="flex items-center justify-center gap-2 px-6 py-3 border border-[var(--border)] hover:border-[var(--border-hover)] text-[var(--fg-muted)] hover:text-[var(--fg)] text-[14px] rounded-lg transition-colors">
                  How it works
                </a>
              </div>
            </div>

            {/* RIGHT — Vault Preview Card */}
            <div className="relative hidden lg:block">
              <div className="relative z-10 rounded-xl border border-[var(--border)] bg-[#09090b] overflow-hidden shadow-[0_24px_80px_-12px_rgba(0,0,0,0.9)]">
                {/* Browser chrome */}
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--border)] bg-[#0c0c0c]">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                  <div className="flex-1 mx-3 h-5 rounded-md bg-neutral-900 border border-neutral-800 flex items-center px-2 gap-1.5">
                    <Lock className="w-2.5 h-2.5 text-emerald-500" />
                    <span className="text-[10px] text-neutral-500 font-mono">app.vaultr.io/vault</span>
                  </div>
                </div>

                {/* Search bar */}
                <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)]">
                  <div className="h-7 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center px-3 gap-2">
                    <span className="text-[11px] text-[var(--fg-muted)]">🔍 Search vault…</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="p-3 space-y-1.5">
                  {VAULT_ITEMS.map((item, i) => (
                    <div
                      key={item.name}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors group cursor-pointer ${i === 0 ? "border-[var(--border-hover)] bg-[var(--surface)]" : "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface)]"}`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0" style={{ background: item.color + "18", color: item.color, border: `1px solid ${item.color}22` }}>
                        {item.letter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[var(--fg)] font-medium">{item.name}</p>
                        <p className="text-[11px] text-[var(--fg-muted)]">{item.sub}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded-md bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center">
                          <Copy className="w-3 h-3 text-[var(--fg-muted)]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Status bar */}
                <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[#0c0c0c] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-[var(--fg-muted)] font-mono">Vault unlocked · AES-256-GCM</span>
                  </div>
                  <span className="text-[10px] text-[var(--fg-muted)] font-mono">{VAULT_ITEMS.length} items</span>
                </div>
              </div>

              {/* Floating Zero-Knowledge Badge */}
              <div className="absolute -bottom-4 -left-4 z-20 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl backdrop-blur-md">
                <div className="w-7 h-7 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[var(--fg)]">Zero-knowledge</p>
                  <p className="text-[10px] text-[var(--fg-muted)]">Encrypted in your browser</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ── Social Proof Bar ─────────────────────────────────────────────── */}
      <section className="py-8 border-y border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <p className="text-[22px] sm:text-[24px] font-mono font-semibold text-[var(--fg)]">AES-256-GCM</p>
              <p className="text-[11px] text-[var(--fg-muted)]">WebCrypto Encryption</p>
            </div>
            <div className="space-y-1">
              <p className="text-[22px] sm:text-[24px] font-mono font-semibold text-[var(--fg)]">0 Bytes</p>
              <p className="text-[11px] text-[var(--fg-muted)]">Plaintext Storage</p>
            </div>
            <div className="space-y-1">
              <p className="text-[22px] sm:text-[24px] font-mono font-semibold text-[var(--fg)]">RFC 6238</p>
              <p className="text-[11px] text-[var(--fg-muted)]">2FA Authenticator Engine</p>
            </div>
            <div className="space-y-1">
              <p className="text-[22px] sm:text-[24px] font-mono font-semibold text-[var(--fg)]">Open Source</p>
              <p className="text-[11px] text-[var(--fg-muted)]">Self-Host Ready</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Bento Grid ─────────────────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-widest">Everything Included</p>
            <h2 className="text-[32px] font-semibold text-[var(--fg)] tracking-tight">Built for security-minded people</h2>
          </div>

          <div className="grid md:grid-cols-12 gap-6">

            {/* Feature 1 */}
            <div className="md:col-span-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10 max-w-md space-y-3">
                <div className="w-9 h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-[16px] font-semibold text-[var(--fg)]">AES-256-GCM Client-Side Encryption</h3>
                <p className="text-[13px] text-[var(--fg-muted)] leading-relaxed">
                  Every field — titles, passwords, notes, credit card numbers, custom tags — is encrypted inside your browser before touching the network.
                </p>
              </div>

              <div className="absolute bottom-0 right-0 w-72 h-72 opacity-80 pointer-events-none select-none">
                <Image
                  src="/illustrations/secure-login_m11a.svg"
                  alt="Encryption"
                  width={280}
                  height={280}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="md:col-span-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10 space-y-3">
                <div className="w-9 h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="text-[16px] font-semibold text-[var(--fg)]">Zero-Knowledge Protocol</h3>
                <p className="text-[13px] text-[var(--fg-muted)] leading-relaxed">
                  No secret key or backdoor on the server — mathematically impossible to read your data.
                </p>
              </div>

              <div className="mt-6 w-full h-48 relative opacity-85 select-none">
                <Image
                  src="/illustrations/security_0ubl.svg"
                  alt="Zero Knowledge"
                  width={240}
                  height={240}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="md:col-span-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10 space-y-3">
                <div className="w-9 h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <h3 className="text-[16px] font-semibold text-[var(--fg)]">Integrated 2FA Engine</h3>
                <p className="text-[13px] text-[var(--fg-muted)] leading-relaxed">
                  Store TOTP secrets alongside passwords with live countdown codes and WebCrypto auto-copy.
                </p>
              </div>

              <div className="mt-6 w-full h-48 relative opacity-85 select-none">
                <Image
                  src="/illustrations/two-factor-authentication_ofho.svg"
                  alt="2FA TOTP"
                  width={240}
                  height={240}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Feature 4 */}
            <div className="md:col-span-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10 max-w-md space-y-3">
                <div className="w-9 h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h3 className="text-[16px] font-semibold text-[var(--fg)]">Password Health Scanner</h3>
                <p className="text-[13px] text-[var(--fg-muted)] leading-relaxed">
                  Automatic scanning for weak or reused passwords, plus HaveIBeenPwned checks with k-anonymity privacy protection.
                </p>
              </div>

              <div className="absolute bottom-0 right-0 w-72 h-72 opacity-80 pointer-events-none select-none">
                <Image
                  src="/illustrations/fingerprint_kdwq.svg"
                  alt="Password Audit"
                  width={280}
                  height={280}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Security Architecture ─────────────────────────────────────────── */}
      <section id="security" className="py-24 bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">

            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-3">
                <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-widest">Security Architecture</p>
                <h2 className="text-[32px] sm:text-[40px] font-semibold text-[var(--fg)] leading-tight tracking-tight">
                  We cannot read your data.<br />Mathematically.
                </h2>
                <p className="text-[14px] text-[var(--fg-muted)] leading-relaxed">
                  Your master password derives an AES-256-GCM key via PBKDF2 (100,000 iterations, SHA-256). All encryption happens in your browser. Only ciphertext ever reaches our servers.
                </p>
              </div>

              {/* Encryption Pipeline */}
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg)] space-y-3">
                <p className="text-[11px] font-mono text-[var(--fg-muted)] uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[var(--fg)]" /> Cryptographic Flow
                </p>

                <div className="flex flex-wrap gap-2 items-center">
                  {[
                    { label: "Master Password", dim: true },
                    { label: "→", dim: true, arrow: true },
                    { label: "100k PBKDF2", dim: false },
                    { label: "→", dim: true, arrow: true },
                    { label: "AES-256-GCM", dim: true },
                    { label: "→", dim: true, arrow: true },
                    { label: "Ciphertext", dim: true },
                  ].map((item, i) =>
                    item.arrow ? (
                      <span key={i} className="text-[var(--fg-muted)] font-mono text-[12px]">{item.label}</span>
                    ) : (
                      <span
                        key={i}
                        className={`px-3 py-1.5 rounded font-mono text-[11px] border border-[var(--border)] ${item.dim ? "text-[var(--fg-muted)] bg-[var(--surface)]" : "text-[var(--fg)] bg-[var(--surface)]"}`}
                      >
                        {item.label}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] font-mono text-[12px] divide-y divide-[var(--border)] overflow-hidden">
                {/* Header row */}
                <div className="px-5 py-3 bg-[var(--surface)] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neutral-700" />
                  <div className="w-2 h-2 rounded-full bg-neutral-700" />
                  <div className="w-2 h-2 rounded-full bg-neutral-700" />
                  <span className="ml-2 text-[10px] text-[var(--fg-muted)] uppercase tracking-wider">Cryptographic Spec</span>
                </div>
                {[
                  { label: "Algorithm", value: "AES-256-GCM" },
                  { label: "Key derivation", value: "PBKDF2 / SHA-256" },
                  { label: "Iterations", value: "100,000" },
                  { label: "IV size", value: "12 bytes (random)" },
                  { label: "Auth tag", value: "128 bits" },
                  { label: "Master key storage", value: "none — memory only" },
                  { label: "Stored secret", value: "none — zero-knowledge" },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center px-5 py-3.5 hover:bg-[var(--surface)] transition-colors">
                    <span className="text-[var(--fg-muted)]">{row.label}</span>
                    <span className="text-[var(--fg)] font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── How It Works — Animated Node Timeline ─────────────────────────── */}
      <section id="howitworks" className="py-24 bg-[var(--bg)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-widest">Simple Process</p>
            <h2 className="text-[32px] font-semibold text-[var(--fg)] tracking-tight">Up and running in minutes</h2>
            <p className="text-[14px] text-[var(--fg-muted)]">Three steps to complete cryptographic privacy — no configuration required.</p>
          </div>

          {/* Timeline row */}
          <div ref={stepsRef} className="flex flex-col md:flex-row items-start md:items-stretch gap-0">
            {STEPS.map((step, i) => (
              <React.Fragment key={step.n}>
                {/* Step Node + Content */}
                <div className="flex flex-col items-center flex-1 min-w-0 group">

                  {/* Circle node */}
                  <div className="relative flex items-center justify-center w-14 h-14 rounded-full border-2 border-[var(--border)] bg-[var(--surface)] z-10 transition-all duration-300 group-hover:border-neutral-500">
                    <span className="font-mono text-[13px] font-semibold text-[var(--fg)]">{step.n}</span>
                    {/* Pulse ring */}
                    <div
                      className="absolute inset-0 rounded-full border border-neutral-600 transition-all duration-700"
                      style={{
                        transform: stepsVisible ? "scale(1.5)" : "scale(1)",
                        opacity: stepsVisible ? 0 : 0.6,
                        transitionDelay: `${i * 500}ms`,
                      }}
                    />
                  </div>

                  {/* Tag chip */}
                  <div className="mt-3 px-2.5 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[10px] font-mono text-[var(--fg-muted)]">
                    {step.tag}
                  </div>

                  {/* Illustration */}
                  <div className="mt-6 w-full max-w-[200px] h-48 relative">
                    <Image
                      src={step.illustration}
                      alt={step.title}
                      width={200}
                      height={192}
                      className="w-full h-full object-contain opacity-90"
                    />
                  </div>

                  {/* Text */}
                  <div className="mt-5 text-center px-4 space-y-2 max-w-[240px]">
                    <h3 className="text-[14px] font-semibold text-[var(--fg)]">{step.title}</h3>
                    <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">{step.desc}</p>
                  </div>
                </div>

                {/* Animated connector line between nodes */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:flex flex-col items-center justify-start pt-7 px-0" style={{ width: "80px", flexShrink: 0 }}>
                    <div className="relative w-full h-[2px] bg-[var(--border)] mt-0 overflow-visible">
                      {/* Animated fill */}
                      <div
                        className="absolute inset-y-0 left-0 bg-neutral-600 transition-all duration-[900ms] ease-out"
                        style={{
                          width: stepsVisible ? "100%" : "0%",
                          transitionDelay: `${i * 300 + 200}ms`,
                        }}
                      />
                      {/* Traveling dot */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-neutral-700 transition-all duration-[900ms] ease-out shadow-[0_0_6px_rgba(255,255,255,0.3)]"
                        style={{
                          left: stepsVisible ? "calc(100% - 8px)" : "0px",
                          transitionDelay: `${i * 300 + 200}ms`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Mobile vertical connector */}
                {i < STEPS.length - 1 && (
                  <div className="md:hidden w-[2px] h-12 bg-[var(--border)] mx-auto my-2 relative overflow-hidden">
                    <div
                      className="absolute inset-x-0 top-0 bg-neutral-600 transition-all duration-700"
                      style={{ height: stepsVisible ? "100%" : "0%", transitionDelay: `${i * 300}ms` }}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── Open Source & GitHub ─────────────────────────────────────────── */}
      <section id="opensource" className="py-24 bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* LEFT — GitHub Illustration */}
            <div className="relative flex flex-col items-center gap-6">
              {/* Crisp inline vector SVG mascot (no circular background, official Invertocat) */}
              <svg 
                viewBox="0 0 98 96" 
                className="w-64 h-64 fill-white [.theme-light_&]:fill-black transition-colors duration-300 drop-shadow-[0_0_30px_rgba(255,255,255,0.08)] opacity-95 hover:opacity-100"
              >
                <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.4 46.685 2.443.458 3.331-.1 3.331-2.372 0-1.18-.04-4.304-.06-8.44-13.59 2.978-16.46-6.6-16.46-6.6-2.223-5.695-5.433-7.21-5.433-7.21-4.436-3.057.337-3-.337-3 4.908.347 7.49 5.092 7.49 5.092 4.359 7.537 11.435 5.362 14.225 4.103.441-3.187 1.706-5.366 3.106-6.6-10.85-1.243-22.253-5.472-22.253-24.364 0-5.382 1.909-9.784 5.039-13.233-.5-.124-2.185-6.26.482-13.047 0 0 4.107-1.328 13.46 5.062 3.9-1.096 8.087-1.644 12.239-1.662 4.153.018 8.34.566 12.247 1.662 9.341-6.39 13.435-5.062 13.435-5.062 2.677 6.787.992 12.923.493 13.047 3.138 3.449 5.032 7.851 5.032 13.233 0 18.94-11.42 23.108-22.308 24.328 1.757 1.527 3.324 4.536 3.324 9.14 0 6.604-.061 11.928-.061 13.55 0 2.29.873 2.87 3.35 2.39C84.02 89.37 98 70.96 98 49.217 98 22 76.161 0 48.854 0z" />
              </svg>

              {/* Floating stats chips */}
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[12px] font-mono text-[var(--fg-muted)]">
                  <Star className="w-3.5 h-3.5 text-yellow-500" />
                  <span>Open Source</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[12px] font-mono text-[var(--fg-muted)]">
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Self-Hostable</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[12px] font-mono text-[var(--fg-muted)]">
                  <Globe className="w-3.5 h-3.5" />
                  <span>MIT License</span>
                </div>
              </div>
            </div>

            {/* RIGHT — Content */}
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-widest font-mono">Open Source Architecture</p>
                <h2 className="text-[30px] sm:text-[38px] font-semibold text-[var(--fg)] tracking-tight leading-tight">
                  Open source.<br />Self-host.<br />Own your data.
                </h2>
                <p className="text-[14px] text-[var(--fg-muted)] leading-relaxed">
                  Vaultr is open source and engineered for self-hosting with Next.js, PostgreSQL, and Docker. Maintain complete sovereignty over your data and infrastructure — no vendor lock-in, ever.
                </p>
              </div>

              {/* Terminal block */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)]">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                  <span className="ml-2 text-[11px] font-mono text-[var(--fg-muted)]">bash</span>
                </div>
                <div className="px-5 py-4 font-mono text-[12px] space-y-1.5">
                  <div className="flex gap-3">
                    <span className="text-emerald-500 select-none">$</span>
                    <span className="text-[var(--fg-muted)]">git clone <span className="text-[var(--fg)]">https://github.com/Yashraj-Jangra/vaultr.git</span></span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-emerald-500 select-none">$</span>
                    <span className="text-[var(--fg-muted)]">cp <span className="text-[var(--fg)]">.env.example</span> .env</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-emerald-500 select-none">$</span>
                    <span className="text-[var(--fg-muted)]">docker compose up <span className="text-[var(--fg)]">-d</span></span>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <span className="text-neutral-700 select-none">#</span>
                    <span className="text-neutral-700">Your vault is ready at localhost:3000</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="https://github.com/Yashraj-Jangra/vaultr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black text-[13px] font-medium transition-colors hover:bg-neutral-200 active:scale-[0.98]"
                >
                  <GithubIcon /> View on GitHub
                </a>
                <a
                  href="https://github.com/Yashraj-Jangra/vaultr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] text-[13px] font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Read the docs
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FAQ Section ───────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 bg-[var(--bg)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12">

            <div className="lg:col-span-5 space-y-5">
              <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-widest">FAQ</p>
              <h2 className="text-[32px] font-semibold text-[var(--fg)] tracking-tight">
                Frequently asked questions
              </h2>
              <p className="text-[14px] text-[var(--fg-muted)] leading-relaxed">
                Learn more about our zero-knowledge model, security protocols, and self-hosting options.
              </p>

              <div className="w-full h-60 relative hidden lg:block select-none">
                <Image
                  src="/illustrations/faq_pgxi.svg"
                  alt="FAQ"
                  width={260}
                  height={220}
                  className="w-full h-full object-contain opacity-80"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {FAQS.map((faq, i) => (
                <div
                  key={faq.q}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 font-medium text-[var(--fg)] text-[14px]"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[var(--fg-muted)] transition-transform duration-200 shrink-0 ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-[13px] text-[var(--fg-muted)] leading-relaxed border-t border-[var(--border)] pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── Final CTA — Spy Image Full-Height Right ─────────────────────────── */}
      <section className="relative overflow-hidden bg-[var(--bg)] min-h-[600px] flex items-stretch">

        {/* LEFT — CTA Content */}
        <div className="flex-1 flex items-center justify-center px-8 py-24 lg:py-32">
          <div className="max-w-xl space-y-6">

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] text-[11px] text-[var(--fg-muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Free forever · No credit card required
            </div>

            <h2 className="text-[36px] sm:text-[48px] font-bold text-[var(--fg)] tracking-tight leading-[1.1]">
              Start protecting your<br />passwords today.
            </h2>

            <p className="text-[15px] text-[var(--fg-muted)] leading-relaxed">
              No tracking. No compromise. No exceptions.<br />
              Your data is yours — mathematically guaranteed.
            </p>

            {/* Mini spec row */}
            <div className="flex flex-wrap gap-2">
              {["AES-256-GCM", "PBKDF2 · 100k rounds", "Zero-knowledge", "Open source"].map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-md border border-[var(--border)] text-[11px] font-mono text-[var(--fg-muted)] bg-[var(--surface)]">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/auth"
                className="flex items-center justify-center gap-2 px-7 py-3 bg-white hover:bg-neutral-200 text-black text-[14px] font-medium rounded-lg transition-colors active:scale-[0.98]"
              >
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-7 py-3 border border-[var(--border)] hover:border-neutral-600 text-[var(--fg-muted)] hover:text-[var(--fg)] text-[14px] rounded-lg transition-colors"
              >
                <GithubIcon /> View on GitHub
              </a>
            </div>
          </div>
        </div>

        {/* RIGHT — Spy Detective Image, full section height, no wrapper/card/border */}
        <div className="hidden lg:block relative w-[380px] xl:w-[440px] shrink-0 select-none pointer-events-none">
          <Image
            src="/illustrations/spy-detective-white.png"
            alt="Vaultr Security Guardian"
            fill
            className="object-contain object-bottom"
            style={{ filter: "brightness(1) contrast(1.05)" }}
          />
        </div>

        {/* Mobile spy image — above text on small screens */}
        <div className="lg:hidden absolute bottom-0 left-0 w-40 h-64 opacity-20 select-none pointer-events-none">
          <Image
            src="/illustrations/spy-detective-white.png"
            alt=""
            fill
            className="object-contain object-bottom"
          />
        </div>

      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <Image
              src="/brand/vaultr-full-dark-transparent.png"
              alt={config.name}
              width={100}
              height={20}
              className="h-5 w-auto object-contain opacity-40"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-[12px] text-[var(--fg-muted)]">
            <a href="#features" className="hover:text-[var(--fg)] transition-colors">Features</a>
            <a href="#security" className="hover:text-[var(--fg)] transition-colors">Security</a>
            <a href="#opensource" className="hover:text-[var(--fg)] transition-colors">Open Source</a>
            <Link href="/privacy" className="hover:text-[var(--fg)] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--fg)] transition-colors">Terms</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--fg)] flex items-center gap-1.5 transition-colors">
              <GithubIcon /> GitHub
            </a>
          </div>

          <p className="text-[11px] text-[var(--fg-muted)]">© {new Date().getFullYear()} {config.name}</p>
        </div>
      </footer>

    </div>
  );
}

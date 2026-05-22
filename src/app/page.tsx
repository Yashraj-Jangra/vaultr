"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useRouter } from "next/navigation";
import { useSiteConfig } from "@/context/SiteConfigContext";
import {
  Shield, Lock, Globe, Key, RefreshCw, Fingerprint,
  ChevronRight, ArrowRight, Check, Copy
} from "lucide-react";

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const FEATURES = [
  { icon: <Lock className="w-4 h-4" />, title: "AES-256-GCM Encryption", desc: "Every field encrypted client-side before touching the network. Your master password never leaves your device.", illustration: "/illustrations/secure-login_m11a.svg", accent: "#22c55e" },
  { icon: <Shield className="w-4 h-4" />, title: "Zero-Knowledge Model", desc: "We store only encrypted ciphertext. No secret key, no backdoor — mathematically impossible to read your data.", illustration: "/illustrations/security_0ubl.svg", accent: "#3b82f6" },
  { icon: <Fingerprint className="w-4 h-4" />, title: "2FA Manager", desc: "Store TOTP secrets alongside passwords. Live countdown codes with auto-copy, powered by WebCrypto.", illustration: "/illustrations/two-factor-authentication_ofho.svg", accent: "#a855f7" },
  { icon: <Key className="w-4 h-4" />, title: "Advanced Generator", desc: "Random, passphrase, PIN, and custom-pattern modes. Strength scoring with estimated crack-time estimates.", illustration: "/illustrations/secure-password_9qv4.svg", accent: "#f59e0b" },
  { icon: <RefreshCw className="w-4 h-4" />, title: "Password Health", desc: "Automatic scanning for weak, reused, and outdated passwords. HaveIBeenPwned checks with k-anonymity.", illustration: "/illustrations/fingerprint_kdwq.svg", accent: "#ec4899" },
  { icon: <Globe className="w-4 h-4" />, title: "Multi-Template Vault", desc: "Store logins, credit cards, addresses, secure notes, and profiles — all encrypted with the same key.", illustration: "/illustrations/personal-notebook_blje.svg", accent: "#06b6d4" },
];

const STEPS = [
  { n: "01", title: "Create an account", desc: "Sign up with email or Google in under 30 seconds.", illustration: "/illustrations/authentication_1evl.svg" },
  { n: "02", title: "Set a master password", desc: "The only password you'll ever need to remember. Never sent to us.", illustration: "/illustrations/enter-password_1kl4.svg" },
  { n: "03", title: "Add your credentials", desc: "Import from CSV or add manually. Encrypted instantly, synced everywhere.", illustration: "/illustrations/vault_tyfh.svg" },
];

const VAULT_ITEMS = [
  { name: "GitHub", sub: "dev@example.com", color: "#6e7681", letter: "G" },
  { name: "Figma", sub: "dev@example.com", color: "#a259ff", letter: "F" },
  { name: "Linear", sub: "dev@example.com", color: "#5e6ad2", letter: "L" },
  { name: "Vercel", sub: "dev@example.com", color: "#eaeaea", letter: "V" },
  { name: "Stripe", sub: "dev@example.com", color: "#6772e5", letter: "S" },
];

export default function LandingPage() {
  const { user, isAuthLoading } = useFirebaseAuth();
  const { config } = useSiteConfig();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && user) router.replace("/vault");
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]"><span className="w-5 h-5 border-2 border-neutral-800 border-t-neutral-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className={`sticky top-0 z-50 border-b transition-all duration-300 ${scrolled ? "border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-xl" : "border-transparent bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-neutral-900 border border-[var(--border)] flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <span className="text-[14px] font-semibold text-neutral-200 tracking-tight">{config.name}</span>
          </Link>
          <div className="hidden sm:flex items-center gap-7 text-[13px] text-neutral-500">
            <a href="#features" className="hover:text-neutral-200 transition-colors">Features</a>
            <a href="#security" className="hover:text-neutral-200 transition-colors">Security</a>
            <a href="#howitworks" className="hover:text-neutral-200 transition-colors">How it works</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth" className="text-[13px] text-neutral-500 hover:text-neutral-200 px-3 py-1.5 transition-colors">Sign in</Link>
            <Link href="/auth" className="text-[13px] bg-neutral-100 hover:bg-white text-neutral-900 px-4 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5">
              Get started <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #222 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        {/* Top radial glow */}
        <div className="absolute top-0 inset-x-0 h-[400px] pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.08) 0%, transparent 70%)" }} />

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-0">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-start">

            {/* LEFT — copy */}
            <div className="space-y-7 pt-8 pb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-neutral-950/80 text-[11px] text-neutral-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Zero-knowledge · AES-256-GCM · Open architecture
              </div>

              <h1 className="text-[44px] sm:text-[56px] font-bold text-neutral-100 leading-[1.08] tracking-tight">
                Your passwords,<br />
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #9ca3af 0%, #4b5563 100%)" }}>
                  encrypted before<br />they leave your browser.
                </span>
              </h1>

              <p className="text-[15px] text-neutral-500 leading-relaxed max-w-[420px]">
                {config.name} is a zero-knowledge password manager. Your master password is never stored, sent, or seen — by anyone.
              </p>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {["No master password stored", "No plaintext transmitted", "WebCrypto API", "Open architecture"].map(t => (
                  <span key={t} className="flex items-center gap-2 text-[12px] text-neutral-600">
                    <Check className="w-3 h-3 text-neutral-700 shrink-0" />{t}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/auth" className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-100 hover:bg-white text-neutral-900 text-[14px] font-semibold rounded-xl transition-all active:scale-[0.98]">
                  Start for free <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#howitworks" className="flex items-center justify-center gap-2 px-6 py-3 border border-[var(--border)] hover:border-neutral-700 text-neutral-500 hover:text-neutral-200 text-[14px] rounded-xl transition-colors">
                  How it works
                </a>
              </div>
            </div>

            {/* RIGHT — vault mockup + illustration */}
            <div className="relative hidden lg:block">
              {/* Large vault illustration — background layer */}
              <div className="absolute -top-12 -right-12 w-[480px] h-[480px] pointer-events-none select-none">
                <Image src="/illustrations/vault_tyfh.svg" alt="" fill className="object-contain" style={{ opacity: 0.15 }} priority />
              </div>
              {/* Vault UI card */}
              <div className="relative z-10 mt-6 rounded-xl border border-[var(--border)] bg-neutral-950 overflow-hidden shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)]">
                {/* Browser chrome */}
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--border)] bg-[#0a0a0a]">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                  <div className="flex-1 mx-3 h-5 rounded-md bg-neutral-900 border border-neutral-800 flex items-center px-2 gap-1.5">
                    <Lock className="w-2.5 h-2.5 text-emerald-500" />
                    <span className="text-[10px] text-neutral-700">app.vaultr.io/vault</span>
                  </div>
                </div>
                {/* Search bar */}
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <div className="h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center px-3 gap-2">
                    <span className="text-[10px] text-neutral-700">🔍 Search vault…</span>
                  </div>
                </div>
                {/* Items */}
                <div className="p-3 space-y-1.5">
                  {VAULT_ITEMS.map((item, i) => (
                    <div
                      key={item.name}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors group cursor-pointer ${i === 0 ? "border-neutral-700/60 bg-neutral-900" : "border-transparent hover:border-neutral-800 hover:bg-neutral-900/50"}`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0" style={{ background: item.color + "18", color: item.color, border: `1px solid ${item.color}22` }}>
                        {item.letter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-neutral-300 font-medium">{item.name}</p>
                        <p className="text-[11px] text-neutral-600">{item.sub}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded-md bg-neutral-800 flex items-center justify-center">
                          <Copy className="w-3 h-3 text-neutral-500" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Status bar */}
                <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[#0a0a0a] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-neutral-700">Vault unlocked · AES-256-GCM</span>
                  </div>
                  <span className="text-[10px] text-neutral-700">{VAULT_ITEMS.length} items</span>
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-neutral-950 shadow-xl backdrop-blur-sm">
                <div className="w-6 h-6 rounded-md bg-emerald-950/60 border border-emerald-900/40 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-neutral-300">Zero-knowledge</p>
                  <p className="text-[10px] text-neutral-600">Encrypted in your browser</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="howitworks" className="border-t border-[var(--border)] bg-neutral-950">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-[11px] text-neutral-600 uppercase tracking-widest mb-3">Simple process</p>
            <h2 className="text-[32px] font-semibold text-neutral-100 tracking-tight">Up and running in minutes</h2>
          </div>

          <div className="relative grid sm:grid-cols-3 gap-10">
            {/* Dashed connecting line */}
            <div className="hidden sm:block absolute top-[52px] left-[calc(16.67%+10px)] right-[calc(16.67%+10px)] h-px border-t border-dashed border-neutral-800 pointer-events-none" />

            {STEPS.map((step, i) => (
              <div key={step.n} className="flex flex-col items-center text-center space-y-4">
                <div className="relative z-10 w-9 h-9 rounded-full border border-[var(--border)] bg-neutral-900 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-mono text-neutral-500">{i + 1}</span>
                </div>
                <div className="w-40 h-40">
                  <Image src={step.illustration} alt="" width={160} height={160} className="object-contain w-full h-full" style={{ opacity: 0.75 }} />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-neutral-700 block mb-1">{step.n}</span>
                  <h3 className="text-[15px] font-semibold text-neutral-200 mb-1.5">{step.title}</h3>
                  <p className="text-[13px] text-neutral-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-[11px] text-neutral-600 uppercase tracking-widest mb-3">Everything included</p>
            <h2 className="text-[32px] font-semibold text-neutral-100 tracking-tight">Built for security-minded people</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-[var(--border)] bg-neutral-950 p-6 sm:p-8 relative overflow-hidden hover:border-neutral-700/60 transition-all duration-300"
                style={{ "--accent": f.accent } as React.CSSProperties}
              >
                {/* Subtle top-left accent */}
                <div className="absolute top-0 left-0 w-full h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, ${f.accent}50, transparent)` }} />
                {/* Illustration — large, bottom-right */}
                <div className="absolute bottom-0 right-0 w-36 h-36 translate-x-4 translate-y-4 pointer-events-none select-none">
                  <Image src={f.illustration} alt="" width={144} height={144} className="object-contain w-full h-full transition-all duration-300" style={{ opacity: 0.15 }} />
                </div>
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg border border-[var(--border)] flex items-center justify-center mb-5 relative z-10 transition-colors" style={{ background: f.accent + "15", color: f.accent, borderColor: f.accent + "30" }}>
                  {f.icon}
                </div>
                <div className="relative z-10 space-y-2.5 pr-[80px] sm:pr-[90px]">
                  <h3 className="text-[15px] font-semibold text-neutral-200">{f.title}</h3>
                  <p className="text-[13px] text-neutral-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <section id="security" className="border-t border-[var(--border)] bg-neutral-950">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div>
                <p className="text-[11px] text-neutral-600 uppercase tracking-widest mb-3">Security architecture</p>
                <h2 className="text-[32px] font-semibold text-neutral-100 leading-tight tracking-tight">We cannot read<br />your data. Mathematically.</h2>
              </div>
              <p className="text-[14px] text-neutral-500 leading-relaxed">
                Your master password derives an AES-256-GCM key via PBKDF2 (100,000 iterations, SHA-256). All encryption happens in your browser. Only ciphertext ever reaches our servers.
              </p>
              <div className="flex items-center gap-5">
                <div className="w-32 h-32 shrink-0">
                  <Image src="/illustrations/firewall_cfej.svg" alt="" width={128} height={128} className="object-contain w-full h-full" style={{ opacity: 0.6 }} />
                </div>
                <Link href="/security" className="inline-flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-neutral-200 transition-colors">
                  Read the full security spec <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
            {/* Spec table */}
            <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg)]">
              <div className="px-5 py-3 border-b border-[var(--border)] bg-neutral-900/50">
                <p className="text-[11px] text-neutral-600 uppercase tracking-widest">Cryptographic spec</p>
              </div>
              <div className="font-mono text-[12px] divide-y divide-[var(--border)]">
                {[
                  { label: "Algorithm", value: "AES-256-GCM", color: "text-emerald-400" },
                  { label: "Key derivation", value: "PBKDF2 / SHA-256", color: "text-blue-400" },
                  { label: "Iterations", value: "100,000", color: "text-neutral-300" },
                  { label: "IV size", value: "12 bytes (random)", color: "text-neutral-400" },
                  { label: "Auth tag", value: "128 bits", color: "text-emerald-400" },
                  { label: "Stored secret", value: "none — zero-knowledge", color: "text-neutral-600" },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center px-5 py-3 hover:bg-neutral-900/30 transition-colors">
                    <span className="text-neutral-600">{row.label}</span>
                    <span className={row.color}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-24 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(99,102,241,0.04) 0%, transparent 70%)" }} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <Image src="/illustrations/safe_0mei.svg" alt="" width={400} height={400} className="object-contain" style={{ opacity: 0.06 }} />
          </div>
          <div className="relative text-center space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] text-[11px] text-neutral-600 mb-2">
              Free forever · No credit card
            </div>
            <h2 className="text-[36px] font-bold text-neutral-100 tracking-tight">Start protecting your passwords today.</h2>
            <p className="text-neutral-500 text-[15px]">No tracking. No compromise. No exceptions.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link href="/auth" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-neutral-100 hover:bg-white text-neutral-900 text-[14px] font-semibold rounded-xl transition-colors active:scale-[0.98]">
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-[var(--border)] hover:border-neutral-700 text-neutral-500 hover:text-neutral-200 text-[14px] rounded-xl transition-colors">
                <GithubIcon /> View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-700" />
            <span className="text-[13px] text-neutral-700">{config.name}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-[12px] text-neutral-600">
            <a href="#features" className="hover:text-neutral-400 transition-colors">Features</a>
            <a href="#security" className="hover:text-neutral-400 transition-colors">Security</a>
            <Link href="/privacy" className="hover:text-neutral-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-neutral-400 transition-colors">Terms</Link>
            <Link href="/security" className="hover:text-neutral-400 transition-colors">Security docs</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-400 flex items-center gap-1.5 transition-colors">
              <GithubIcon /> GitHub
            </a>
          </div>
          <p className="text-[11px] text-neutral-700">© {new Date().getFullYear()} {config.name}</p>
        </div>
      </footer>

    </div>
  );
}

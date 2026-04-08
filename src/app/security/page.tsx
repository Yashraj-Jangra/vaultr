import React from "react";
import Link from "next/link";
import { Shield, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security — SecureVault",
  description: "How SecureVault encrypts and protects your data.",
};

const SPEC = [
  { label: "Encryption algorithm",  value: "AES-256-GCM" },
  { label: "Key derivation",        value: "PBKDF2-SHA-256" },
  { label: "PBKDF2 iterations",     value: "100,000" },
  { label: "Salt",                  value: "Firebase UID (user-unique)" },
  { label: "IV / nonce",            value: "12 bytes, crypto.getRandomValues()" },
  { label: "Authentication tag",    value: "128 bits (GCM standard)" },
  { label: "Key length",            value: "256 bits" },
  { label: "Stored master password", value: "Never — zero-knowledge" },
  { label: "Data at rest",          value: "Encrypted ciphertext only" },
  { label: "Encryption location",   value: "Browser (WebCrypto API)" },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors text-[13px]">
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-500" />
            <span className="text-[13px] text-neutral-500">SecureVault</span>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-5 py-14 space-y-12">
        <div className="space-y-2">
          <p className="text-[11px] text-neutral-600 uppercase tracking-widest">Under the hood</p>
          <h1 className="text-3xl font-semibold text-neutral-100">Security Architecture</h1>
          <p className="text-[14px] text-neutral-500 leading-relaxed max-w-xl">
            How SecureVault keeps your credentials private — even from us.
          </p>
        </div>

        {/* Spec table */}
        <section className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)] bg-neutral-950">
            <p className="text-[12px] font-medium text-neutral-400 uppercase tracking-wider">Cryptographic specification</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {SPEC.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3">
                <span className="text-[13px] text-neutral-500">{row.label}</span>
                <span className="text-[13px] font-mono text-neutral-300">{row.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Encryption flow */}
        <section className="space-y-5">
          <h2 className="text-[18px] font-semibold text-neutral-200">How encryption works</h2>
          <div className="space-y-4">
            {[
              {
                n: "1",
                title: "Key derivation",
                desc: "Your master password is combined with your Firebase UID (acting as a unique salt) and passed through PBKDF2-SHA-256 with 100,000 iterations. The result is a 256-bit AES-GCM key.",
              },
              {
                n: "2",
                title: "Encryption",
                desc: "Each vault entry is serialised to JSON, then encrypted using AES-256-GCM with a randomly generated 12-byte IV (nonce) from window.crypto.getRandomValues(). The IV and ciphertext are stored together.",
              },
              {
                n: "3",
                title: "Storage",
                desc: "Only the base64-encoded ciphertext blob is sent to Firestore. The plaintext credentials and the derived key never leave your browser tab.",
              },
              {
                n: "4",
                title: "Decryption",
                desc: "When you unlock, the key is re-derived from your master password in the browser. AES-GCM decryption happens locally. If the master password is wrong, decryption fails with an authentication error.",
              },
            ].map((step) => (
              <div key={step.n} className="flex gap-4 p-4 rounded-lg border border-[var(--border)] bg-neutral-950">
                <span className="text-[11px] font-mono text-neutral-700 mt-0.5 shrink-0 w-4">{step.n}.</span>
                <div className="space-y-1">
                  <h3 className="text-[14px] font-medium text-neutral-200">{step.title}</h3>
                  <p className="text-[13px] text-neutral-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What we can't see */}
        <section className="space-y-4">
          <h2 className="text-[18px] font-semibold text-neutral-200">What we cannot see</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Your master password",
              "Your plaintext passwords",
              "Usernames or email addresses",
              "Credit card numbers",
              "Secure notes content",
              "TOTP secret keys",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-[var(--border)] bg-neutral-950">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[13px] text-neutral-400">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Responsible disclosure */}
        <section className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-5 space-y-2">
          <h2 className="text-[15px] font-semibold text-amber-300">Responsible Disclosure</h2>
          <p className="text-[13px] text-amber-700/80 leading-relaxed">
            If you discover a security vulnerability, please report it privately before public disclosure. We take all reports seriously and aim to respond within 48 hours.
          </p>
        </section>

        <div className="pt-4 border-t border-[var(--border)]">
          <div className="flex gap-6 text-[12px] text-neutral-600">
            <Link href="/privacy" className="hover:text-neutral-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms"   className="hover:text-neutral-400 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

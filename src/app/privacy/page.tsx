"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Shield, ChevronLeft, Lock, Database, Users, RefreshCw, Trash2, Scale } from "lucide-react";

const SECTIONS = [
  { id: "summary",   title: "Summary",             icon: <Shield className="w-3.5 h-3.5" /> },
  { id: "collect",   title: "Data We Collect",     icon: <Database className="w-3.5 h-3.5" /> },
  { id: "storage",   title: "How We Store Data",   icon: <Lock className="w-3.5 h-3.5" /> },
  { id: "third",     title: "Third-Party Services", icon: <Users className="w-3.5 h-3.5" /> },
  { id: "retention", title: "Data Retention",      icon: <Trash2 className="w-3.5 h-3.5" /> },
  { id: "rights",    title: "Your Rights",         icon: <Scale className="w-3.5 h-3.5" /> },
  { id: "changes",   title: "Changes",             icon: <RefreshCw className="w-3.5 h-3.5" /> },
];

export default function PrivacyPage() {
  const [active, setActive] = useState("summary");

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    const obs = new IntersectionObserver(
      (entries) => { entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }); },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-13 flex items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-200 transition-colors text-[13px]">
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-600" />
            <span className="text-[13px] text-neutral-600">_vaultr</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-[var(--border)] bg-neutral-950">
        <div className="max-w-6xl mx-auto px-6 py-12 flex items-center justify-between gap-8">
          <div>
            <p className="text-[11px] text-neutral-600 uppercase tracking-widest mb-3">Legal</p>
            <h1 className="text-[32px] font-semibold text-neutral-100 tracking-tight mb-2">Privacy Policy</h1>
            <p className="text-[13px] text-neutral-500">
              Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="hidden md:block w-44 h-44 shrink-0">
            <Image src="/illustrations/gdpr_g020.svg" alt="" width={176} height={176} className="object-contain w-full h-full" style={{ opacity: 0.45 }} />
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
                <a key={s.id} href={`#${s.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] transition-all group ${
                    active === s.id ? "bg-neutral-900 text-neutral-200" : "text-neutral-600 hover:text-neutral-300 hover:bg-neutral-900/60"
                  }`}
                >
                  <span className={`shrink-0 transition-colors ${active === s.id ? "text-neutral-400" : "text-neutral-800 group-hover:text-neutral-600"}`}>{s.icon}</span>
                  {s.title}
                </a>
              ))}
              <div className="pt-4 mt-4 border-t border-[var(--border)] space-y-0.5">
                <Link href="/terms" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-neutral-700 hover:text-neutral-400 transition-colors">Terms of Service</Link>
                <Link href="/security" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-neutral-700 hover:text-neutral-400 transition-colors">Security</Link>
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 space-y-10">
            <Section id="summary" title="Summary" icon={<Shield className="w-4 h-4" />}>
              <p>_vaultr is a zero-knowledge password manager. We cannot read your passwords, credentials, or any data stored in your vault. Your master password is never transmitted to our servers.</p>
            </Section>
            <Section id="collect" title="Data We Collect" icon={<Database className="w-4 h-4" />}>
              <ul>
                <li><strong>Account information:</strong> Your email address and Firebase Auth UID, used for authentication.</li>
                <li><strong>Encrypted vault data:</strong> Ciphertext blobs stored in Firestore. We cannot decrypt these.</li>
                <li><strong>Usage metadata:</strong> Timestamps of vault item creation. No content is readable.</li>
              </ul>
              <p>We do <strong>not</strong> collect: your master password, plaintext credentials, IP addresses beyond Firebase&apos;s standard logging, or any analytics beyond basic crash reports.</p>
            </Section>
            <Section id="storage" title="How We Store Your Data" icon={<Lock className="w-4 h-4" />}>
              <p>All vault content is encrypted with AES-256-GCM using a key derived from your master password via PBKDF2 (100,000 iterations). The resulting ciphertext is stored in Google Cloud Firestore. We hold the ciphertext, not the key.</p>
            </Section>
            <Section id="third" title="Third-Party Services" icon={<Users className="w-4 h-4" />}>
              <ul>
                <li><strong>Firebase (Google):</strong> Authentication and database infrastructure. Subject to Google&apos;s Privacy Policy.</li>
                <li><strong>Google Favicon API:</strong> Used to fetch site icons for display only — only the domain name is transmitted, no credentials.</li>
              </ul>
            </Section>
            <Section id="retention" title="Data Retention" icon={<Trash2 className="w-4 h-4" />}>
              <p>Your data is retained as long as your account exists. You may delete your account and all associated data from Settings → Data → Delete account. Deletion is permanent and irreversible.</p>
            </Section>
            <Section id="rights" title="Your Rights" icon={<Scale className="w-4 h-4" />}>
              <p>You have the right to access, export, and delete your data at any time from within the app. You may also contact us to exercise any applicable rights under GDPR, CCPA, or other applicable laws.</p>
            </Section>
            <Section id="changes" title="Changes" icon={<RefreshCw className="w-4 h-4" />}>
              <p>We may update this policy. Material changes will be communicated via email or an in-app notice. Continued use after changes constitutes acceptance.</p>
            </Section>
          </main>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
        <span className="text-neutral-600">{icon}</span>
        <h2 className="text-[16px] font-semibold text-neutral-200">{title}</h2>
      </div>
      <div className="text-[14px] text-neutral-500 leading-relaxed space-y-2 [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:list-disc [&_strong]:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

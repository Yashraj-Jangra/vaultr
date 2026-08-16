"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Shield, ChevronLeft, FileText, UserCheck, AlertTriangle, WifiOff, Ban, LogOut, Scale, RefreshCw } from "lucide-react";

const SECTIONS = [
  { id: "acceptance",      title: "Acceptance",               icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "responsibilities", title: "Your Responsibilities",   icon: <UserCheck className="w-3.5 h-3.5" /> },
  { id: "master",          title: "Master Password & Data",   icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { id: "availability",    title: "Service Availability",     icon: <WifiOff className="w-3.5 h-3.5" /> },
  { id: "prohibited",      title: "Prohibited Uses",          icon: <Ban className="w-3.5 h-3.5" /> },
  { id: "termination",     title: "Termination",              icon: <LogOut className="w-3.5 h-3.5" /> },
  { id: "liability",       title: "Limitation of Liability",  icon: <Scale className="w-3.5 h-3.5" /> },
  { id: "changes",         title: "Changes",                  icon: <RefreshCw className="w-3.5 h-3.5" /> },
];

export default function TermsPage() {
  const [active, setActive] = useState("acceptance");

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
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-neutral-500 hover:text-neutral-200 transition-colors text-[13px] font-medium">
            <ChevronLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/about" className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors">About</Link>
            <Link href="/docs" className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors">Docs</Link>
            <Link href="/security" className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors">Security</Link>
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider px-2 py-0.5 rounded border border-neutral-800 bg-neutral-900/60">
              VaultR 2026
            </span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-[var(--border)] bg-neutral-950">
        <div className="max-w-6xl mx-auto px-6 py-12 flex items-center justify-between gap-8">
          <div>
            <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Legal Agreement</p>
            <h1 className="text-[32px] font-bold text-neutral-100 tracking-tight mb-2">Terms of Service</h1>
            <p className="text-[13px] text-neutral-500">
              VaultR 2026 Edition · Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="hidden md:block w-44 h-44 shrink-0">
            <Image src="/illustrations/agreement_ftet.svg" alt="" width={176} height={176} className="object-contain w-full h-full" style={{ opacity: 0.45 }} />
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
                <Link href="/privacy" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">Privacy Policy</Link>
                <Link href="/security" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">Security Spec</Link>
                <Link href="/docs" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">Documentation</Link>
                <Link href="/changelog" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">Changelog</Link>
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 space-y-10">
            <Section id="acceptance" title="Acceptance" icon={<FileText className="w-4 h-4" />}>
              <p>By accessing or using _vaultr, you agree to these Terms. If you do not agree, do not use the service.</p>
            </Section>
            <Section id="responsibilities" title="Your Responsibilities" icon={<UserCheck className="w-4 h-4" />}>
              <ul>
                <li>You are solely responsible for choosing and remembering your master password. We cannot recover it.</li>
                <li>You are responsible for maintaining the security of your device and account credentials.</li>
                <li>You agree not to misuse the service, including attempting to circumvent security features or access other users&apos; data.</li>
              </ul>
            </Section>
            <Section id="master" title="Master Password & Data Loss" icon={<AlertTriangle className="w-4 h-4" />}>
              <div className="p-4 rounded-lg border border-amber-900/40 bg-amber-950/20 text-[13px] leading-relaxed">
                _vaultr uses a zero-knowledge architecture. <strong className="text-amber-400">If you lose your master password, your vault data is permanently and irreversibly inaccessible.</strong> We have no ability to recover it.
              </div>
            </Section>
            <Section id="availability" title="Service Availability" icon={<WifiOff className="w-4 h-4" />}>
              <p>We strive for high availability but make no guarantees. _vaultr is provided &quot;as is&quot; without warranties of any kind. We are not liable for any data loss, damages, or service interruption.</p>
            </Section>
            <Section id="prohibited" title="Prohibited Uses" icon={<Ban className="w-4 h-4" />}>
              <ul>
                <li>Storing illegal content or credentials for unauthorized access to third-party systems.</li>
                <li>Attempting to reverse-engineer, scrape, or disrupt the service.</li>
                <li>Creating fake accounts or impersonating other users.</li>
              </ul>
            </Section>
            <Section id="termination" title="Termination" icon={<LogOut className="w-4 h-4" />}>
              <p>We reserve the right to suspend or terminate accounts that violate these Terms. You may delete your account at any time from Settings. Upon termination, your encrypted data will be permanently deleted.</p>
            </Section>
            <Section id="liability" title="Limitation of Liability" icon={<Scale className="w-4 h-4" />}>
              <p>To the maximum extent permitted by law, _vaultr and its operators shall not be liable for any indirect, incidental, or consequential damages arising from use of the service, including data loss.</p>
            </Section>
            <Section id="changes" title="Changes" icon={<RefreshCw className="w-4 h-4" />}>
              <p>We may modify these Terms at any time. Continued use after changes constitutes acceptance. Material changes will be communicated in advance where possible.</p>
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
      <div className="text-[14px] text-neutral-500 leading-relaxed space-y-2 [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:list-disc [&_strong]:text-amber-400">
        {children}
      </div>
    </section>
  );
}

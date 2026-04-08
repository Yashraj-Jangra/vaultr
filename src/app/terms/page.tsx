import React from "react";
import Link from "next/link";
import { Shield, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — _vaultr",
  description: "_vaultr terms of service.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-5 h-13 flex items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors text-[13px]">
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-500" />
            <span className="text-[13px] text-neutral-500">_vaultr</span>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-5 py-14 space-y-10">
        <div className="space-y-2">
          <p className="text-[11px] text-neutral-600 uppercase tracking-widest">Legal</p>
          <h1 className="text-3xl font-semibold text-neutral-100">Terms of Service</h1>
          <p className="text-[13px] text-neutral-500">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        <LegalSection title="Acceptance">
          <p>By accessing or using _vaultr, you agree to these Terms. If you do not agree, do not use the service.</p>
        </LegalSection>

        <LegalSection title="Your Responsibilities">
          <ul>
            <li>You are solely responsible for choosing and remembering your master password. We cannot recover it.</li>
            <li>You are responsible for maintaining the security of your device and account credentials.</li>
            <li>You agree not to misuse the service, including attempting to circumvent security features or access other users&apos; data.</li>
          </ul>
        </LegalSection>

        <LegalSection title="Master Password & Data Loss">
          <p>_vaultr uses a zero-knowledge architecture. <strong>If you lose your master password, your vault data is permanently and irreversibly inaccessible.</strong> We have no ability to recover it. You are solely responsible for keeping your master password safe.</p>
        </LegalSection>

        <LegalSection title="Service Availability">
          <p>We strive for high availability but make no guarantees. _vaultr is provided &quot;as is&quot; without warranties of any kind. We are not liable for any data loss, damages, or service interruption.</p>
        </LegalSection>

        <LegalSection title="Prohibited Uses">
          <ul>
            <li>Storing illegal content or credentials for unauthorized access to third-party systems.</li>
            <li>Attempting to reverse-engineer, scrape, or disrupt the service.</li>
            <li>Creating fake accounts or impersonating other users.</li>
          </ul>
        </LegalSection>

        <LegalSection title="Termination">
          <p>We reserve the right to suspend or terminate accounts that violate these Terms. You may delete your account at any time from Settings. Upon termination, your encrypted data will be permanently deleted.</p>
        </LegalSection>

        <LegalSection title="Limitation of Liability">
          <p>To the maximum extent permitted by law, _vaultr and its operators shall not be liable for any indirect, incidental, or consequential damages arising from use of the service, including data loss.</p>
        </LegalSection>

        <LegalSection title="Changes">
          <p>We may modify these Terms at any time. Continued use after changes constitutes acceptance. Material changes will be communicated in advance where possible.</p>
        </LegalSection>

        <div className="pt-4 border-t border-[var(--border)]">
          <div className="flex gap-6 text-[12px] text-neutral-600">
            <Link href="/privacy" className="hover:text-neutral-400 transition-colors">Privacy Policy</Link>
            <Link href="/security" className="hover:text-neutral-400 transition-colors">Security</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[16px] font-semibold text-neutral-200">{title}</h2>
      <div className="text-[14px] text-neutral-500 leading-relaxed space-y-2 [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:list-disc [&_strong]:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

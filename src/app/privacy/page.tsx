import React from "react";
import Link from "next/link";
import { Shield, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SecureVault",
  description: "How SecureVault handles your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-5 h-13 flex items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors text-[13px]">
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-500" />
            <span className="text-[13px] text-neutral-500">SecureVault</span>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-5 py-14 space-y-10">
        <div className="space-y-2">
          <p className="text-[11px] text-neutral-600 uppercase tracking-widest">Legal</p>
          <h1 className="text-3xl font-semibold text-neutral-100">Privacy Policy</h1>
          <p className="text-[13px] text-neutral-500">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        <LegalSection title="Summary">
          <p>SecureVault is a zero-knowledge password manager. We cannot read your passwords, credentials, or any data stored in your vault. Your master password is never transmitted to our servers.</p>
        </LegalSection>

        <LegalSection title="Data We Collect">
          <ul>
            <li><strong>Account information:</strong> Your email address and Firebase Auth UID, used for authentication.</li>
            <li><strong>Encrypted vault data:</strong> Ciphertext blobs stored in Firestore. We cannot decrypt these.</li>
            <li><strong>Usage metadata:</strong> Timestamps of vault item creation. No content is readable.</li>
          </ul>
          <p>We do <strong>not</strong> collect: your master password, plaintext credentials, IP addresses beyond Firebase&apos;s standard logging, or any analytics beyond basic crash reports.</p>
        </LegalSection>

        <LegalSection title="How We Store Your Data">
          <p>All vault content is encrypted with AES-256-GCM using a key derived from your master password via PBKDF2 (100,000 iterations). The resulting ciphertext is stored in Google Cloud Firestore. We hold the ciphertext, not the key.</p>
        </LegalSection>

        <LegalSection title="Third-Party Services">
          <ul>
            <li><strong>Firebase (Google):</strong> Authentication and database infrastructure. Subject to Google&apos;s Privacy Policy.</li>
            <li><strong>Google Favicon API:</strong> Used to fetch site icons for display only — only the domain name is transmitted, no credentials.</li>
          </ul>
        </LegalSection>

        <LegalSection title="Data Retention">
          <p>Your data is retained as long as your account exists. You may delete your account and all associated data from Settings → Data → Delete account. Deletion is permanent and irreversible.</p>
        </LegalSection>

        <LegalSection title="Your Rights">
          <p>You have the right to access, export, and delete your data at any time from within the app. You may also contact us to exercise any applicable rights under GDPR, CCPA, or other applicable laws.</p>
        </LegalSection>

        <LegalSection title="Changes">
          <p>We may update this policy. Material changes will be communicated via email or an in-app notice. Continued use after changes constitutes acceptance.</p>
        </LegalSection>

        <div className="pt-4 border-t border-[var(--border)]">
          <div className="flex gap-6 text-[12px] text-neutral-600">
            <Link href="/terms"    className="hover:text-neutral-400 transition-colors">Terms of Service</Link>
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

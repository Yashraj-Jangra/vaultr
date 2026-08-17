"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  Search,
  BookOpen,
  Shield,
  Server,
  KeyRound,
  Download,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Layers,
  FileCode2,
} from "lucide-react";
import { VAULTR_EDITION, VAULTR_VERSION } from "@vaultr/core";

interface DocSection {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: React.ReactNode;
}

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 rounded-xl border border-neutral-800 bg-neutral-950/90 font-mono text-[12.5px] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/60 border-b border-neutral-800/80 text-[11px] text-neutral-500 font-sans">
        <span>{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-neutral-300 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const DOCS_DATA: DocSection[] = [
  {
    id: "getting-started",
    category: "Overview",
    title: "Quickstart & Zero-Knowledge Setup",
    summary: "Create your vault, derive your client key, and understand how master passwords work.",
    content: (
      <div className="space-y-4 text-[14px] text-neutral-400 leading-relaxed">
        <p>
          Vaultr is engineered on a strict <strong>zero-knowledge paradigm</strong>. When you register, an identity record is created via Better-Auth, but your master password is never sent to the backend.
        </p>
        <div className="p-4 rounded-xl border border-blue-900/40 bg-blue-950/20 text-[13px] text-blue-300 space-y-1">
          <p className="font-semibold">Important Security Notice:</p>
          <p>
            Because your master password is never stored or hashed on the server, there is mathematically no &quot;Forgot Master Password&quot; recovery mechanism. Always keep a backup of your master password in a physical safe or emergency kit.
          </p>
        </div>
        <h4 className="text-[15px] font-semibold text-neutral-200 pt-2">Step 1: Create an Account & Master Password</h4>
        <p>
          Navigate to the auth portal. Enter your email, select a strong master password (16+ characters recommended), and unlock your personal vault.
        </p>
        <h4 className="text-[15px] font-semibold text-neutral-200 pt-2">Step 2: Add Your First Item</h4>
        <p>
          Click <strong>&quot;New Entry&quot;</strong> in the top sidebar to create credentials, payment cards, secure notes, addresses, or identity profiles.
        </p>
      </div>
    ),
  },
  {
    id: "crypto-spec",
    category: "Architecture",
    title: "Cryptographic Architecture & Wire Format",
    summary: "Detailed overview of PBKDF2 derivation, AES-256-GCM symmetric ciphering, and binary payloads.",
    content: (
      <div className="space-y-4 text-[14px] text-neutral-400 leading-relaxed">
        <p>
          All vault entries, custom fields, and attachments undergo encryption in local memory before being transmitted over HTTP to PostgreSQL.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
          <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 block">KDF Derivation</span>
            <span className="text-[13px] font-semibold text-blue-400">PBKDF2-SHA-256 (100,000 rounds)</span>
            <p className="text-[12px] text-neutral-500 mt-1">Unique salt bound to User ID preventing rainbow table attacks.</p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 block">Symmetric Cipher</span>
            <span className="text-[13px] font-semibold text-emerald-400">AES-256-GCM (128-bit Tag)</span>
            <p className="text-[12px] text-neutral-500 mt-1">12-byte cryptographically secure random nonce (IV) per entry.</p>
          </div>
        </div>
        <h4 className="text-[15px] font-semibold text-neutral-200 pt-2">Binary Ciphertext Wire Format</h4>
        <p>
          For binary attachments and encrypted objects, Vaultr outputs a standardized continuous byte array:
        </p>
        <CodeBlock
          lang="typescript"
          code={`// Continuous byte format for all targets (Web SubtleCrypto & Hermes AES-GCM)
[ 12 Bytes: Nonce/IV ] + [ N Bytes: AES-GCM Ciphertext ] + [ 16 Bytes: Auth Tag ]`}
        />
      </div>
    ),
  },
  {
    id: "self-hosting",
    category: "Deployment",
    title: "Self-Hosting with Docker & PostgreSQL",
    summary: "Deploy your private Vaultr instance in minutes using Docker Compose.",
    content: (
      <div className="space-y-4 text-[14px] text-neutral-400 leading-relaxed">
        <p>
          Vaultr is designed to be effortlessly self-hosted on any Linux VPS, Docker engine, or Kubernetes cluster.
        </p>
        <h4 className="text-[15px] font-semibold text-neutral-200">1. Clone & Configure Environment</h4>
        <CodeBlock
          lang="bash"
          code={`git clone https://github.com/Yashraj-Jangra/_vaultr.git
cd _vaultr
cp .env.example .env`}
        />
        <h4 className="text-[15px] font-semibold text-neutral-200 pt-2">2. Launch with Docker Compose</h4>
        <CodeBlock
          lang="bash"
          code={`docker compose up -d --build`}
        />
        <p>
          This spins up the Next.js production web server, PostgreSQL database container, and runs all Drizzle migrations automatically.
        </p>
      </div>
    ),
  },
  {
    id: "clients-pairing",
    category: "Ecosystem",
    title: "Pairing Browser Extension & Mobile App",
    summary: "Connect your Chrome extension and mobile app to your self-hosted server.",
    content: (
      <div className="space-y-4 text-[14px] text-neutral-400 leading-relaxed">
        <p>
          Both the browser extension and mobile app can connect to any custom self-hosted Vaultr instance or custom domain.
        </p>
        <h4 className="text-[15px] font-semibold text-neutral-200 pt-2">Browser Extension Setup</h4>
        <ol className="list-decimal pl-5 space-y-2 text-neutral-400">
          <li>Install the extension from Chrome Web Store or load unpacked from <code>extension/dist</code>.</li>
          <li>Open the extension popup and click the gear icon (Settings).</li>
          <li>Enter your server URL (e.g. <code>https://vaultr.yourdomain.com</code>) and click Save.</li>
          <li>Sign in with your email and master password to sync credentials.</li>
        </ol>
        <h4 className="text-[15px] font-semibold text-neutral-200 pt-3">Mobile App Setup</h4>
        <ol className="list-decimal pl-5 space-y-2 text-neutral-400">
          <li>Launch Vaultr Mobile on Android or iOS.</li>
          <li>On the initial setup screen, enter your custom server URL.</li>
          <li>Enable Biometrics (Fingerprint / Face ID) and Android System Autofill from Settings.</li>
        </ol>
      </div>
    ),
  },
  {
    id: "import-export",
    category: "Data Management",
    title: "Import, Export & Emergency Backups",
    summary: "Migrate seamlessly from Bitwarden, 1Password, or export encrypted JSON snapshots.",
    content: (
      <div className="space-y-4 text-[14px] text-neutral-400 leading-relaxed">
        <p>
          Vaultr includes automated parsers for popular password manager exports.
        </p>
        <h4 className="text-[15px] font-semibold text-neutral-200 pt-2">Supported Import Formats</h4>
        <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
          <li><strong>Bitwarden</strong>: Unencrypted JSON / CSV</li>
          <li><strong>1Password</strong>: 1PUX / CSV</li>
          <li><strong>LastPass</strong>: CSV export</li>
          <li><strong>Generic CSV</strong>: Custom mapping for title, username, password, url, and notes.</li>
        </ul>
        <h4 className="text-[15px] font-semibold text-neutral-200 pt-3">Encrypted JSON Backups</h4>
        <p>
          From <strong>Settings → Data → Export</strong>, you can download a full cryptographic snapshot of your vault for offline cold storage.
        </p>
      </div>
    ),
  },
];

export default function DocsPage() {
  const [activeId, setActiveId] = useState<string>("getting-started");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredDocs = DOCS_DATA.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentDoc = DOCS_DATA.find((d) => d.id === activeId) || DOCS_DATA[0];

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
            <Link
              href="/about"
              className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              About
            </Link>
            <Link
              href="/changelog"
              className="text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Changelog
            </Link>
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
      <div className="border-b border-[var(--border)] bg-neutral-950">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-neutral-800 bg-neutral-900 text-[11px] text-neutral-400 mb-3">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              {VAULTR_EDITION} v{VAULTR_VERSION} · Documentation
            </div>
            <h1 className="text-[32px] font-bold text-neutral-100 tracking-tight">Documentation Hub</h1>
            <p className="text-[14px] text-neutral-500 mt-2 max-w-xl">
              Complete reference for zero-knowledge encryption, self-hosting deployment, client pairing, and emergency data recovery.
            </p>
          </div>
          <div className="hidden md:block w-36 h-36 shrink-0">
            <Image
              src="/illustrations/personal-notebook_blje.svg"
              alt="Documentation Guide"
              width={144}
              height={144}
              className="object-contain w-full h-full"
              style={{ opacity: 0.55 }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-72 shrink-0 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-[13px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
              />
            </div>

            {/* Navigation List */}
            <div className="space-y-1">
              {filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setActiveId(doc.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-colors flex flex-col gap-0.5 cursor-pointer ${
                    activeId === doc.id
                      ? "bg-neutral-800 text-neutral-100 border border-neutral-700"
                      : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/60"
                  }`}
                >
                  <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">
                    {doc.category}
                  </span>
                  <span>{doc.title}</span>
                </button>
              ))}
            </div>

            {/* Quick Links Card */}
            <div className="p-4 rounded-xl border border-neutral-900 bg-neutral-950/60 space-y-2 text-[12px] pt-4">
              <span className="text-[10px] uppercase tracking-widest text-neutral-600 font-semibold block">External Resources</span>
              <Link href="/security" className="flex items-center justify-between text-neutral-400 hover:text-neutral-200 transition-colors py-1">
                <span>Security Whitepaper</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <Link href="/changelog" className="flex items-center justify-between text-neutral-400 hover:text-neutral-200 transition-colors py-1">
                <span>Version Changelog</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-neutral-400 hover:text-neutral-200 transition-colors py-1">
                <span>GitHub Repository</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </aside>

          {/* Active Document Viewer */}
          <main className="flex-1 min-w-0 p-8 rounded-2xl border border-neutral-800 bg-neutral-950 space-y-6 shadow-2xl">
            <div className="border-b border-neutral-900 pb-5 space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400">
                {currentDoc.category}
              </span>
              <h2 className="text-[24px] font-bold text-neutral-100 tracking-tight">
                {currentDoc.title}
              </h2>
              <p className="text-[13.5px] text-neutral-500">
                {currentDoc.summary}
              </p>
            </div>

            <div className="pt-2">
              {currentDoc.content}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

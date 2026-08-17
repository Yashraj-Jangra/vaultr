<div align="center">

# 🛡️ VaultR 2026

**Modern, Zero-Knowledge, Multi-Platform Password & Secrets Vault**

[![Version](https://img.shields.io/badge/version-v0.2.7-amber.svg?style=flat-square)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed?style=flat-square&logo=docker)](https://www.docker.com/)
[![Encryption](https://img.shields.io/badge/Security-AES--256--GCM-emerald?style=flat-square)](/security)

<p align="center">
  <a href="#-key-features">Key Features</a> •
  <a href="#-security-architecture">Security Architecture</a> •
  <a href="#-platform-ecosystem">Platform Ecosystem</a> •
  <a href="#-quickstart-with-docker">Quickstart</a> •
  <a href="#-development-setup">Development</a> •
  <a href="#-monorepo-structure">Architecture</a>
</p>

</div>

---

## 🌟 Overview

**VaultR 2026** is a self-hostable, zero-knowledge password and secrets manager designed for individuals and teams who prioritize cryptographic sovereignty, data privacy, and desktop/mobile ergonomics.

VaultR operates under a strict **Zero-Knowledge Architecture**: your master password and encryption keys never touch the server or leave your local client unencrypted. All cryptographic operations (key derivation, encryption, and decryption) execute purely in client memory using WebCrypto (`SubtleCrypto`) and native hardware-backed keystores.

---

## ✨ Key Features

### 🔑 Cryptographic Security
- **AES-256-GCM Binary Encryption** — Industry-standard authenticated cipher with 128-bit integrity authentication tags and unique 96-bit random Initialization Vectors (IVs) per item.
- **Client-Side PBKDF2 Key Derivation** — Master keys derived locally with 100,000 iterations of SHA-256 and unique user-specific cryptographic salts.
- **Non-Extractable CryptoKeys** — Derived master keys reside strictly in ephemeral client memory and are non-exportable from memory heaps.
- **Trial-Decryption Validation** — Client-side trial decryption detects invalid master passwords instantly without leaking authentication hints to the backend.

### 🗄️ Multi-Tier Organization & Navigation
- **Hierarchical Nested Folders** — Multi-depth folder tree with recursive item counts, collapse/expand toggles, and drag-and-drop hierarchy organization.
- **Multi-Type Vault Templates** — First-class schemas for Logins, Payment Cards, Secure Notes, Server/API Credentials, and Personal Identities.
- **Smart Card Network Detection** — Real-time IIN/BIN pattern detection for Visa, Mastercard, American Express, Discover, and RuPay with live interactive card preview canvases.
- **Command Palette (`⌘K` / `Ctrl+K`)** — Instant fuzzy search across vault entries, folders, custom tags, and administrative actions with live credential preview.

### ⏱️ Integrated 2FA Authenticator
- **Dynamic TOTP Verification (RFC 6238)** — Native 30-second time-based one-time password generator with live animated sync countdown rings.
- **Camera QR Scanner** — 1-tap QR code scanning to import authenticator seeds directly into vault credentials.

### 🎲 Advanced Password & Passphrase Generator
- **Real-Time Entropy Calculation** — Dynamic password strength analysis with visual scoring and crack-time estimates.
- **Continuous Syntax Highlighting** — Visual color coding for uppercase, lowercase, numbers, and special symbols.
- **Diceware Passphrase Engine** — Memorable multi-word passphrase generation with custom separators and capitalized word boundaries.

### 📱 Native Mobile & Browser Ecosystem
- **Android Native Autofill Service** — Seamless Android autofill integration with dropdown overlays and inline Gboard/Samsung Keyboard suggestion chips.
- **Biometric Security** — 1-tap fingerprint and face unlock integration across Android and iOS clients.
- **Tablet & Landscape Command Canvas** — Responsive multi-pane master-detail dashboards designed for tablets, foldables, and desktop displays.
- **Browser Extension (Manifest V3)** — High-performance Chrome, Firefox, and Edge companion extension for contextual autofill and credential capture.

### 🎛️ Enterprise-Grade Administration & Self-Hosting
- **Self-Contained Docker Deployment** — One-command deployment bundle including Next.js, PostgreSQL, and MinIO S3-compatible attachment storage.
- **Zero-Knowledge Encrypted Attachments** — Client-side encrypted file uploads with presigned URL streaming and quota limits.
- **Audit Logging & Device Trust** — Immutable audit trail of authentication events, active session revocation, and device telemetry.
- **Universal Importer & Exporter** — Full support for encrypted JSON backups, Bitwarden, 1Password, and CSV formats.

---

## 🛡️ Security Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      CLIENT DEVICE (BROWSER / APP)               │
│                                                                  │
│  User Master Password ──► PBKDF2-SHA256 (100k rounds + Salt)    │
│                                     │                            │
│                                     ▼                            │
│                              Master Key (AES-256)                │
│                                     │                            │
│  Plaintext Payload ──► AES-256-GCM Encrypt (Unique 96-bit IV)    │
│                                     │                            │
└─────────────────────────────────────┼────────────────────────────┘
                                      │  (Encrypted Ciphertext Only)
                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                       VAULTR BACKEND (POSTGRES)                  │
│                                                                  │
│  • Stored Data: Encrypted Blobs, IVs, Salts, Metadata            │
│  • Zero knowledge of master password or plaintext data          │
│  • Cannot decrypt user records even with full DB access          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📱 Platform Ecosystem

| Platform | Technology | Status | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Web Dashboard** | Next.js 15, Tailwind CSS, React 19 | ✅ Production | Command palette, card canvas, TOTP manager, admin panel |
| **Mobile App** | React Native, Expo 57, TurboModules | ✅ Production | Android Autofill, Gboard chips, Biometrics, Tablet canvas |
| **Browser Extension** | TypeScript, Webpack, Manifest V3 | ✅ Production | Contextual autofill, quick generator, zero-knowledge sync |
| **Core Library** | `@vaultr/core` (TypeScript) | ✅ Production | Shared crypto routines, schema validators, version constants |

---

## 🚀 Quickstart with Docker

The fastest way to deploy your own instance of VaultR:

### 1. Prerequisites
- [Docker Engine](https://docs.docker.com/engine/install/) (v24.0+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

### 2. Clone & Configure
```bash
git clone https://github.com/your-username/vaultr.git
cd vaultr

# Copy sample environment configuration
cp .env.example .env
```

### 3. Generate Auth Secret & Update `.env`
Generate a cryptographically secure 64-byte secret:
```bash
# Using openssl
openssl rand -base64 64

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```
Paste this value into `BETTER_AUTH_SECRET` inside your `.env` file.

### 4. Launch Services
```bash
docker compose up -d --build
```

- **Web Dashboard**: `http://localhost:3005`
- **MinIO Storage Console**: `http://localhost:9011`

### 5. Bootstrap the Admin Account
1. Open `http://localhost:3005` and register your primary account.
2. Grant administrator privileges via CLI:
   ```bash
   docker compose exec app node scripts/make-admin.js your.email@example.com
   ```
3. Log out and log back in to refresh claims and access the `/admin` dashboard.

---

## 💻 Development Setup

For local monorepo development:

### 1. Prerequisites
- Node.js 20+
- npm 10+
- Docker (for PostgreSQL & MinIO backing services)

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Database Services
```bash
docker compose up -d postgres minio
```

### 4. Run Schema Migrations
```bash
npm run db:migrate
```

### 5. Launch Development Servers

- **Web Dashboard**:
  ```bash
  npm run dev
  ```
- **Mobile Client** (`mobile/`):
  ```bash
  cd mobile
  npx expo start
  # Or run on Android emulator / physical device:
  npx expo run:android
  ```
- **Browser Extension** (`extension/`):
  ```bash
  cd extension
  npm run dev
  # Load the generated 'dist/' folder into chrome://extensions
  ```

---

## 📁 Monorepo Structure

```
_vaultr/
├── packages/
│   └── core/                 # Shared cryptographic utilities, schemas & versioning
│       └── src/
│           ├── index.ts
│           └── version.ts    # Single source of truth for build metadata
├── src/                      # Next.js 15 Web Application
│   ├── app/                  # App Router pages & API routes
│   │   ├── (auth)/           # Authentication & recovery flows
│   │   ├── admin/            # Administrative control center
│   │   ├── api/              # REST endpoints & auth handlers
│   │   ├── vault/            # Interactive password manager dashboard
│   │   ├── docs/             # Public documentation & user guides
│   │   └── changelog/        # Interactive release notes
│   ├── components/           # Modular React components & modals
│   ├── context/              # React state providers (Auth, Vault, Theme)
│   ├── db/                   # Drizzle ORM schemas & database client
│   ├── hooks/                # Custom React hooks (useCrypto, useAutoLock)
│   └── lib/                  # Server-side auth, email, S3 storage & crypto
├── mobile/                   # React Native & Expo Mobile Client
│   ├── android/              # Native Android wrapper & Autofill Service
│   └── src/
│       ├── navigation/       # Responsive navigation & tablet dock
│       ├── screens/          # Mobile view controllers & form canvases
│       └── services/         # Native autofill, biometrics & sync
├── extension/                # Browser Extension (Manifest V3)
│   └── src/                  # Background service worker, popup UI & content scripts
├── drizzle/                  # PostgreSQL migration artifacts
├── docker-compose.yml        # Self-hosting orchestration
└── Dockerfile                # Production multi-stage container build
```

---

## 🧪 Quality & Verification

Run static analysis and build verification across the monorepo:

```bash
# Type check web application
npm run lint

# Build production web bundle
npm run build

# Package browser extension
cd extension && npm run package
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

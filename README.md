# SecureVault

A zero-knowledge, client-side encrypted password manager built with Next.js and Better Auth / Postgres.

> **Zero-knowledge**: Your master password never leaves your browser. All encryption and decryption happens locally using AES-256-GCM via the Web Crypto API.

---

## Features

- **AES-256-GCM Encryption** — PBKDF2 key derivation (100,000 iterations, SHA-256), unique IV per encrypted blob
- **PostgreSQL Persistence** — encrypted blobs synced in real-time; only ciphertext is stored, never plaintext
- **Multi-field Vault Entries** — name (cleartext), username/email, password, URL, arbitrary custom fields
- **Copy to Clipboard** — one-click copy on every sensitive field
- **Masked Reveal** — eye toggle on password and custom fields; values stay hidden until explicitly revealed
- **Wrong Master Password Detection** — trial-decryption on unlock; shows inline error instead of silently failing
- **Site URL field** — optional URL per entry with direct "open link" shortcut
- **User / Email label** — visible username preview on entry cards
- **Better Auth / Postgres Auth** — email/password sign-in and registration
- **Strict PostgreSQL rules** — users can only read/write their own `users/{uid}/vaultItems`
- **Auto-lock hooks** — idle detection with configurable timer
- **Keyboard shortcuts** — `N` new entry, `/` search, `Esc` close
- **Command palette** — `Ctrl+K` / `⌘K` fuzzy search across entries
- **Toast notifications** — success / error / warning / info, auto-dismiss
- **Navigation shell** — Sidebar (desktop), BottomNav (mobile), TopBar with search
- **Legal pages** — `/privacy`, `/terms`, `/security`
- **Password generator page** — `/generator`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| Auth | Better Auth / Postgres Authentication |
| Database | Cloud PostgreSQL |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) |
| Icons | Lucide React |
| Language | TypeScript |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── auth/page.tsx         # Sign in / Register
│   ├── vault/page.tsx        # Main vault (unlock + entries)
│   ├── generator/            # Password generator
│   ├── privacy/              # Privacy policy
│   ├── terms/                # Terms of service
│   └── security/             # Security explainer
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx       # Desktop sidebar nav
│   │   ├── TopBar.tsx        # Sticky header + search
│   │   ├── BottomNav.tsx     # Mobile tab bar
│   │   └── CommandPalette.tsx# ⌘K overlay
│   ├── common/
│   │   └── ToastContainer.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Input.tsx
├── hooks/
│   ├── useBetter Auth / PostgresAuth.ts    # Auth state + sign in/out
│   ├── useCrypto.ts          # encrypt / decrypt + deriveKey
│   ├── useToast.ts           # Toast queue management
│   ├── useAutoLock.ts        # Idle timer auto-lock
│   └── useKeyboardShortcuts.ts
└── lib/
    └── Better Auth / Postgres/
        └── client.ts         # Better Auth / Postgres app + auth + db init
```

---

## Security Model

1. **Master password** is used only to derive the AES-256-GCM key via PBKDF2 locally in the browser.
2. The **derived key is never stored** — it lives only in memory for the duration of the session.
3. Only **encrypted ciphertext** (Base64-encoded IV + encrypted blob) is written to PostgreSQL.
4. **Wrong password detection**: on unlock, the key is tested by decrypting an existing entry; an error is shown inline if it fails.
5. PostgreSQL security rules enforce **per-user ownership** — no cross-user access is possible.

---

## Getting Started

This project supports running in two environments: **Docker** (recommended for production/self-hosting) and **Local Development** (hybrid Docker + local node process).

---

### Prerequisites
* **Docker** and **Docker Compose** installed.
* **Node.js 20+** installed (if running in local development mode).

---

### Step 1: Configure Environment Variables
Copy `.env.example` to `.env` (or `.env.local` for local development):

```bash
cp .env.example .env
```

Open `.env` in an editor and fill in the required variables:

#### 1. Generate Auth Secrets
Better Auth requires a strong, random key. You can generate a 64-byte Base64-encoded secret by running either of the following commands:
* **Using Openssl** (macOS, Linux, Git Bash):
  ```bash
  openssl rand -base64 64
  ```
* **Using Node.js** (Cross-platform):
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
  ```
Copy the generated string and paste it into the `BETTER_AUTH_SECRET` field.

#### 2. Set App URLs
Change the URLs to point to your deployment IP and port (default for Docker is `3005`):
```env
BETTER_AUTH_URL=http://localhost:3005
NEXT_PUBLIC_APP_URL=http://localhost:3005
```

#### 3. Update Database and Storage Credentials
Set strong passwords for Postgres and MinIO:
```env
DB_USER=vaultr
DB_PASSWORD=YOUR_STRONG_POSTGRES_PASSWORD
DB_NAME=vaultr_db
DATABASE_URL=postgresql://vaultr:YOUR_STRONG_POSTGRES_PASSWORD@localhost:5432/vaultr_db

MINIO_ROOT_USER=vaultr
MINIO_ROOT_PASSWORD=YOUR_STRONG_MINIO_PASSWORD
```

---

### Step 2: Deploy & Run

#### Option A: Running with Docker (Recommended)
This starts the Next.js app, PostgreSQL, and MinIO storage in the background. Schema migrations will run automatically on startup.

1. Build and launch the containers:
   ```bash
   docker compose up -d --build
   ```
2. The web application is now running at `http://localhost:3005`.
3. MinIO S3 Console is running at `http://localhost:9011`.

#### Option B: Local Development Mode (Hybrid)
In this mode, databases run in Docker, and the Next.js app runs directly on your local node environment:

1. Spin up only the backing databases:
   ```bash
   docker compose up -d postgres minio
   ```
2. Install local Node dependencies:
   ```bash
   npm install
   ```
3. Run database migrations to prepare the database schema:
   ```bash
   npm run db:migrate
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
5. The local dev app is now running at `http://localhost:3000`.

---

### Step 3: Bootstrapping the Admin Panel

The Admin Panel (`/admin`) is protected and requires an account with the `admin` role. To bootstrap your first admin account:

1. Open the web interface (`http://localhost:3005` for Docker, or `http://localhost:3000` for Local Dev).
2. Go to the sign-up page and register a new user account.
3. Grant admin status to your registered account:
   * **If running in Docker**:
     ```bash
     docker compose exec app npx tsx make-admin.ts your.email@example.com
     ```
   * **If running in Local Development**:
     ```bash
     npx tsx make-admin.ts your.email@example.com
     ```
4. Log out of your account on the web page, then log back in to refresh your authentication claims.
5. You can now access the Admin Dashboard at `/admin`.

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for full sprint-by-sprint feature plan.

---

*Last updated: 2026-04-08*

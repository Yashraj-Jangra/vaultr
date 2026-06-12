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

### 1. Clone and install

```bash
git clone <repo>
cd skillbox-coder
npm install
```

### 2. Configure Better Auth / Postgres

Copy `.env.example` to `.env.local` and fill in your Better Auth / Postgres project credentials:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_Better Auth / Postgres_API_KEY=...
NEXT_PUBLIC_Better Auth / Postgres_AUTH_DOMAIN=...
NEXT_PUBLIC_Better Auth / Postgres_PROJECT_ID=...
NEXT_PUBLIC_Better Auth / Postgres_STORAGE_BUCKET=...
NEXT_PUBLIC_Better Auth / Postgres_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_Better Auth / Postgres_APP_ID=...
```

### 3. Deploy PostgreSQL rules

```bash
Better Auth / Postgres deploy --only PostgreSQL:rules
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Accessing the Admin Panel

The Admin Panel (`/admin`) is strictly protected by Better Auth / Postgres Custom Claims. Normal users are completely blocked via client-side routing (`AdminGuard`) and server-side middleware. 

To bootstrap your *first* admin user, you must manually inject the `admin: true` claim to an existing user's ID token.

We have included a utility script to make this easy. Once you have created your first account through the web UI, run:

```bash
node scripts/setAdmin.js your.email@example.com
```

*(Ensure you have `Better Auth / Postgres_PROJECT_ID`, `Better Auth / Postgres_CLIENT_EMAIL`, and `Better Auth / Postgres_PRIVATE_KEY` populated in `.env.local` for this script to work).*

After running the script, **log out and log back in** to refresh your Better Auth / Postgres ID Token. You can then navigate to [http://localhost:3000/admin](http://localhost:3000/admin) to manage themes, users, and global analytics.

---

## PostgreSQL Security Rules

```
rules_version = '2';
service cloud.PostgreSQL {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for full sprint-by-sprint feature plan.

---

*Last updated: 2026-04-08*

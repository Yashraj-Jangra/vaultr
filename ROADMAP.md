#  — Feature Roadmap & Progress

> Legend: `[ ]` Todo · `[/]` In Progress · `[x]` Done · `[-]` Deferred

---

## Sprint 0 — Foundation (Current State ✅)

- [x] Firebase Auth (email/password)
- [x] Firestore encrypted blob storage
- [x] AES-256-GCM client-side encryption (PBKDF2 key derivation, 100k iterations, SHA-256)
- [x] Vault entry CRUD (create, reveal, delete)
- [x] Password generator (length slider, charset toggles, seed-based regen)
- [x] Entry templates (Login, Credit Card, Address, Profile, Secure Note)
- [x] Folder structure (create inline, filter pills, grouped view)
- [x] Favicon fetching via Google Favicon API with text fallback
- [x] Custom fields per entry (any template)
- [x] Copy-to-clipboard on all sensitive fields
- [x] Masked reveal with show/hide toggle on sensitive values
- [x] Backward compatible decryption (old entries without _template field)
- [x] Domain extraction and storage for favicon lookup
- [x] Zero-knowledge model (master password never leaves the browser)

---

## Sprint 1 — App Shell & Navigation

- [ ] **`useVault.ts`** — centralized vault state hook
  - [ ] Items list, crypto key, unlock/lock actions
  - [ ] Save, delete, update entry methods
  - [ ] Folder list derived state
  - [ ] Search query state + fuzzy filter
- [ ] **`src/app/vault/layout.tsx`** — vault shell (wraps sidebar + topbar)
- [ ] **`Sidebar.tsx`** — persistent left nav (desktop)
  - [ ] Logo + "" wordmark
  - [ ] Nav links: All Items, Favorites, Authenticator, Health, Generator
  - [ ] Dynamic folder list with item counts and expand toggle
  - [ ] Collapse to icon-only mode (64px wide)
  - [ ] Settings + user avatar pinned at bottom
- [ ] **`BottomNav.tsx`** — mobile tab bar (≤768px)
  - [ ] Tabs: Vault · Health · Generator · Settings
  - [ ] Active indicator dot
  - [ ] Hidden on desktop (md:hidden)
- [ ] **`TopBar.tsx`** — sticky header
  - [ ] Global search input → opens CommandPalette
  - [ ] Vault lock status indicator (green dot = unlocked)
  - [ ] User avatar → dropdown (Profile, Lock Now, Sign Out)
- [ ] **`CommandPalette.tsx`** — `⌘K` / `Ctrl+K` overlay
  - [ ] Fuzzy search entries by name, username, URL
  - [ ] Quick actions: New Login, New Card, Lock Vault, Go to Settings
  - [ ] Keyboard navigation (↑ ↓ Enter Esc)
- [ ] **`Toast.tsx`** + `useToast.ts` — global notification system
  - [ ] Variants: success, error, warning, info
  - [ ] Auto-dismiss with progress bar
  - [ ] Max 3 visible at once, stack from bottom-right
- [ ] **`useAutoLock.ts`** — idle timer hook
  - [ ] Configurable timer: Off / 5 / 15 / 30 min
  - [ ] Resets on user interaction (mousemove, keydown)
  - [ ] Shows "Locking in 30s…" toast before locking
- [ ] **`useKeyboardShortcuts.ts`** — global hotkey registry
  - [ ] `N` → New entry
  - [ ] `/` → Focus search
  - [ ] `` ` `` → Toggle Generator panel
  - [ ] `Esc` → Close open panels

---

## Sprint 2 — Auth & Landing Pages

### Beautiful Auth Page (`/auth`)
- [ ] Move login/register from `/` to `/auth`
- [ ] Split-panel layout
  - [ ] Left: animated gradient brand panel, feature bullets, testimonial
  - [ ] Right: clean auth form
- [ ] Smooth tab animation between Login / Register tabs
- [ ] **Email / Password login** with humanized error messages
- [ ] **Google Sign-In** (Firebase Google OAuth provider)
  - [ ] Google button with official branding
  - [ ] New Google users → master password setup modal
- [ ] Register form with live password strength meter
- [ ] Forgot password → Firebase `sendPasswordResetEmail`
- [ ] "Remember this device" checkbox (90-day session)

### Landing Page (`/`)
- [ ] **Header nav** — Logo, Features, Security, Pricing(placeholder), Sign In, Get Started
- [ ] **Hero section**
  - [ ] Headline: "Your passwords, encrypted before they leave your browser."
  - [ ] Sub: "Zero-knowledge. AES-256-GCM. Open source."
  - [ ] CTA: Get Started (free) · How it works
  - [ ] Animated vault/password pill preview graphic
- [ ] **How it works** — 3-step illustrated flow
  - [ ] 1. Sign in with email or Google
  - [ ] 2. Set a master password (only you know it)
  - [ ] 3. Add credentials, access anywhere
- [ ] **Feature cards** — AES-256-GCM, Zero-Knowledge, 2FA Manager, Export/Import, Open Templates, Password Health
- [ ] **Security architecture section** — "We cannot read your data" with diagram
- [ ] **Testimonials / trust signals** (placeholder)
- [ ] **Footer**
  - [ ] Links: Privacy Policy · Terms of Service · Security · GitHub
  - [ ] Copyright notice

### Legal Pages
- [ ] `/privacy` — Full Privacy Policy (themed, readable)
- [ ] `/terms` — Terms of Service
- [ ] `/security` — Security & Encryption deep-dive explainer

---

## Sprint 3 — Advanced Password Generator

- [ ] Redesigned dedicated generator view (`/vault?panel=generator` or `/generator`)
- [ ] **Generator modes (tabs)**:
  - [ ] **Random** — charset-based (current, enhanced)
  - [ ] **Passphrase** — EFF word list, configurable count (3–6 words), separator (- . _ space)
  - [ ] **PIN** — numeric only, 4–12 digits
  - [ ] **Pattern** — custom format string (`LL-ddd-SS` where L=letter, d=digit, S=symbol)
- [ ] **Pronounceable** toggle — alternates vowel/consonant for readability
- [ ] **Strength meter bar** — zxcvbn-style: Weak · Fair · Strong · Very Strong
- [ ] **Estimated crack time** display (e.g. "centuries at 10B guesses/sec")
- [ ] **Session history carousel** — last 5 generated passwords (memory only, never saved)
- [ ] **"Use in new entry"** shortcut button
- [ ] Character exclusion list (e.g. exclude `0`, `O`, `l`, `1` for readability)
- [ ] Min-count guarantees (at least 2 uppercase, 1 symbol, etc.)

---

## Sprint 4 — 2FA Manager (TOTP Authenticator)

- [ ] **TOTP field on Login template entries**
  - [ ] Optional "Add 2FA" toggle in entry form
  - [ ] Accepts `otpauth://totp/...` URI or raw Base32 secret
  - [ ] QR code scanner (device camera API via `jsQR` or similar)
  - [ ] TOTP secret stored inside encrypted blob (zero-knowledge)
- [ ] **Live TOTP code in revealed entry view**
  - [ ] 6-digit code rendered prominently
  - [ ] Animated countdown ring (30-second TOTP window)
  - [ ] Auto-refreshes when period expires
  - [ ] One-click copy with confirmation flash
- [ ] **Standalone Authenticator page** (`/vault/authenticator`)
  - [ ] List all entries with 2FA enabled
  - [ ] Large code display, sorted by expiry time
  - [ ] Search/filter authenticator entries
  - [ ] "Add new authenticator" quick action
- [ ] **Pure-TS TOTP implementation** (RFC 6238 — no native binary deps)
  - [ ] HMAC-SHA1 using WebCrypto API
  - [ ] Handles clock skew (±1 window)
- [ ] Badge on sidebar Authenticator link showing count of accounts

---

## Sprint 5 — Password Health Dashboard (`/health`)

- [ ] **Security Score ring** — 0–100 animated SVG gauge
  - [ ] Color: red (0–39), amber (40–69), green (70–100)
  - [ ] Score breakdown tooltip
- [ ] Score factors:
  - [ ] −5 per weak password (length < 10, score < 2)
  - [ ] −10 per reused password group
  - [ ] −3 per entry older than 90 days (based on `createdAt` until edit tracking added)
  - [ ] −5 per login entry missing 2FA
- [ ] **Weak Passwords** section
  - [ ] Strength bar per flagged entry
  - [ ] "Update" button → opens entry in edit mode
- [ ] **Reused Passwords** section
  - [ ] Grouped entries sharing same hashed password
  - [ ] Count badge
- [ ] **Old Passwords** section (90+ days)
  - [ ] "Last updated" relative date
- [ ] **Missing 2FA** section
  - [ ] Login entries without TOTP secret
  - [ ] "Add 2FA" quick action
- [ ] `src/lib/passwords/health.ts` — scoring library (pure functions, testable)
- [ ] **HaveIBeenPwned check** (opt-in toggle, k-anonymity — SHA-1 prefix only, password never sent)

---

## Sprint 6 — Admin Panel (`/admin`)

> Secured by Firestore custom claim `admin: true`. Non-admins get 403 redirect.

### Theme Builder
- [ ] Live preview panel (changes reflect before saving)
- [ ] **Color controls**:
  - [ ] Background color
  - [ ] Foreground / text color
  - [ ] Primary accent color
  - [ ] Surface / card color
  - [ ] Border color
  - [ ] Danger / error color
- [ ] **Visual style controls**:
  - [ ] Border radius scale slider (0 = square → 24px = pill)
  - [ ] Backdrop blur / glassmorphism intensity slider
  - [ ] Sidebar transparency (0–100%)
  - [ ] Font family selector (12 Google Font options: Inter, Outfit, DM Sans…)
  - [ ] Font size scale (sm / md / lg base)
- [ ] **Dark / Light / System** mode selector
- [ ] **Preset themes** (built-in + saved custom):
  - [ ] Default (current dark)
  - [ ] Midnight Blue
  - [ ] Forest Green
  - [ ] Ocean
  - [ ] Warm Sand (light)
  - [ ] Arctic (light)
  - [ ] Save current as new preset (named)
  - [ ] Delete custom preset
- [ ] Theme config stored in Firestore `config/theme`
- [ ] All users receive active theme on load

### User Management
- [ ] Paginated user table (Firebase Admin via API route)
- [ ] View: UID, email, display name, created, last sign-in, disabled status
- [ ] Actions: disable / enable account, promote to admin, demote, force sign-out
- [ ] Search users by email

### Email & Communications
- [ ] Trigger password reset email to any user
- [ ] Compose + send announcement email (via Firebase Extension or Nodemailer API route)
- [ ] Email send log (timestamp, recipient, status)

### Content Management
- [ ] Edit landing page headline, subheadline, feature card text (stored in Firestore `config/content`)
- [ ] Toggle **Maintenance Mode** (blocks `/vault` with a custom message for non-admins)
- [ ] Markdown editor for Privacy Policy and Terms of Service content

### Analytics Dashboard
- [ ] Total registered users (real-time)
- [ ] Active users last 30 days
- [ ] New signups per day (bar chart — last 14 days)
- [ ] Total vault entries (aggregate count, never content)

---

## Sprint 7 — Extended Vault Features

- [ ] **Favorites** — star toggle on each entry, "Favorites" section in sidebar
- [ ] **Tags** — comma-separated free-form tags, filter by tag chip in sidebar
- [ ] **Trash** — soft-delete, 30-day TTL, restore / permanent delete, "Trash" sidebar link
- [ ] **Inline edit** — edit existing entry in expanded panel (not just create + delete)
- [ ] **Bulk actions** — checkbox multi-select → bulk delete, move to folder, add tag
- [ ] **Last accessed tracking** — `lastAccessedAt` timestamp on each `toggleReveal`
- [ ] **Entry notes** — extra plain-text notes field on all templates (separate from Secure Note)
- [ ] **Attachments** — store filename reference, encrypted file in Firebase Storage
- [ ] **Duplicate entry** — clone an entry and open in edit mode

---

## Sprint 8 — Settings Pages

### `/settings/account`
- [ ] Display name (inline edit + save to Firebase Auth profile)
- [ ] Email address (change triggers `updateEmail`)
- [ ] Profile photo (upload → Firebase Storage, resized, CDN URL saved)
- [ ] Connected providers (Google, Email — unlink / link)
- [ ] User theme preference (override admin theme)

### `/settings/security`
- [ ] **Change master password**
  - [ ] Re-derive AES-GCM key from new password
  - [ ] Re-encrypt all blobs with new key
  - [ ] Progress indicator with item count
- [ ] Auto-lock timer (Off / 5 / 15 / 30 min)
- [ ] Clipboard auto-clear timer (Off / 30s / 60s)
- [ ] Two-factor authentication on Firebase account (TOTP for login, separate from vault 2FA)
- [ ] Active sessions view (educational / informational)

### `/settings/data`
- [ ] **Export vault** — download `-export-YYYY-MM-DD.json`
  - [ ] Option to protect export with separate passphrase
  - [ ] Blobs stay encrypted in export file
- [ ] **Import vault** — re-upload export file, re-encrypt under current key
- [ ] **CSV Import** — parse LastPass / Bitwarden / Chrome CSV formats
  - [ ] Preview table before importing
  - [ ] Conflict resolution (skip / overwrite)
- [ ] **Delete all vault data** — wipe `vaultItems` collection (type "DELETE" to confirm)
- [ ] **Delete account** — Firebase Auth deletion + Firestore wipe

---

## Sprint 9 — PWA & Polish

- [ ] `public/manifest.json` — installable PWA (name, icons, theme color, display)
- [ ] `public/robots.txt` — crawl rules
- [ ] `public/sitemap.xml` — public page URLs
- [ ] Loading skeleton screens for all async data views
- [ ] Smooth page transition animations
- [ ] Consistent empty state components (illustration + CTA) per page
- [ ] Full `<meta>` SEO tags on all public pages
- [ ] `og:image` social preview card for landing page (auto-generated or static)
- [ ] Responsive audit: 320px → 2560px (every page, every component)
- [ ] Accessibility pass: ARIA labels, focus rings, screen-reader text, color contrast
- [ ] Error boundaries wrapping all route segments
- [ ] Custom 404 page
- [ ] Custom 500 / error page
- [ ] `next.config` security headers (CSP, X-Frame-Options, etc.)

---

## Deferred / Future Consideration

- [-] HaveIBeenPwned breach check (external network, opt-in toggle in Sprint 5)
- [-] Browser extension autofill (separate repo, uses same Firebase project)
- [-] Secure sharing via encrypted link (complex, v2 roadmap)
- [-] Biometric unlock via WebAuthn / Passkeys
- [-] Offline mode (IndexedDB cache of encrypted blobs)
- [-] Multi-vault / Team / Family plan
- [-] Self-hosted / open source deployment guide
- [-] iOS / Android app (React Native / Capacitor wrapper)

---

## Progress Summary

| Sprint | Feature Area | Status | Done |
|--------|-------------|--------|------|
| 0 | Foundation | ✅ Complete | 14 / 14 |
| 1 | App Shell & Navigation | ⬜ Todo | 0 / 18 |
| 2 | Auth & Landing Pages | ⬜ Todo | 0 / 24 |
| 3 | Advanced Generator | ⬜ Todo | 0 / 10 |
| 4 | 2FA Manager | ⬜ Todo | 0 / 10 |
| 5 | Password Health | ⬜ Todo | 0 / 14 |
| 6 | Admin Panel | ⬜ Todo | 0 / 22 |
| 7 | Vault Extensions | ⬜ Todo | 0 / 9 |
| 8 | Settings Pages | ⬜ Todo | 0 / 16 |
| 9 | PWA & Polish | ⬜ Todo | 0 / 13 |
| — | **Total** | | **14 / 150** |

---

*Last updated: 2026-04-06*
*To begin a sprint, say "begin sprint N".*

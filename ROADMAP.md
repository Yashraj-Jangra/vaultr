#  — Feature Roadmap & Progress

> Legend: `[ ]` Todo · `[/]` In Progress · `[x]` Done · `[-]` Deferred

---

## Sprint 0 — Foundation ✅

- [x] Firebase Auth (email/password)
- [x] Firestore encrypted blob storage
- [x] AES-256-GCM client-side encryption (PBKDF2 key derivation, 100k iterations, SHA-256)
- [x] Vault entry CRUD (create, reveal, delete)
- [x] Custom fields per entry (label + masked value)
- [x] Copy-to-clipboard on all sensitive fields
- [x] Masked reveal with show/hide eye toggle on sensitive values
- [x] Username, password, URL, and custom fields stored in encrypted blob
- [x] Site URL field (optional) with direct open-link shortcut
- [x] User / Email label in revealed entry view
- [x] Wrong master password detection (trial-decrypt with inline error)
- [x] Zero-knowledge model (master password never leaves the browser)
- [x] Strict Firestore security rules (per-user ownership)
- [x] **Design Philosophy**: Strict Minimal Dark UI. 
  - Sleek, compact, functional-focused. 
  - NO AI-like excessive gradients, NO heavy glassmorphism or blur effects, NO decorative neon glowing shadows. Keep aesthetics consistent with a purely robust utilitarian tool.

---

## Code Quality & Lint (Ongoing)

> Lint checks are run before every commit and after every significant change. The policy is **zero errors, zero warnings**.

- [x] **ESLint** configured (`next/core-web-vitals` + `@typescript-eslint` + `react-hooks`)
- [x] Zero-warning policy — all warnings treated as errors during review
- [x] **`@typescript-eslint/no-unused-vars`** — all dead imports and dead destructures removed
- [x] **`react-hooks/set-state-in-effect`** — all synchronous setState-in-effect replaced with correct patterns (lazy initializers, stable callbacks, direct return values)
- [x] **`react-hooks/exhaustive-deps`** — all unnecessary/missing deps corrected; `useMemo` wrappers added where needed to prevent re-subscription on every render
- [x] Stale `eslint-disable` directives removed — only intentional, documented suppressions remain
- [ ] **Pre-commit hook** (`husky` + `lint-staged`) — run lint automatically on staged `.ts`/`.tsx` files *(planned)*
- [ ] **CI lint gate** — GitHub Actions workflow to block PRs with lint errors *(planned)*

---

## Sprint 1 — App Shell & Navigation ✅

- [ ] **`useVault.ts`** — centralized vault state hook *(deferred — state lives in vault page)*
- [x] **`Sidebar.tsx`** — persistent left nav (desktop)
  - [x] Nav links: Vault, Generator, Settings
  - [x] User avatar pinned at bottom
  - [x] Collapse to icon-only mode
- [x] **`BottomNav.tsx`** — mobile tab bar (≤768px)
  - [x] Tabs with active indicator
  - [x] Hidden on desktop (md:hidden)
- [x] **`TopBar.tsx`** — sticky header
  - [x] Global search input → opens CommandPalette
  - [x] Vault lock status indicator
  - [x] User avatar → dropdown (Lock Now, Sign Out)
- [x] **`CommandPalette.tsx`** — `⌘K` / `Ctrl+K` overlay
  - [x] Fuzzy search entries by name, username, URL
  - [x] Keyboard navigation (↑ ↓ Enter Esc)
- [x] **`ToastContainer.tsx`** + `useToast.ts` — global notification system
  - [x] Variants: success, error, warning, info
  - [x] Auto-dismiss
- [x] **`useAutoLock.ts`** — idle timer hook
  - [x] Default timer: 15 minutes of inactivity
  - [x] Configurable: Off / 5 / 15 / 30 min (preference stored in `localStorage` per user)
  - [x] Resets on user interaction
  - [x] **Vault session persistence** — master password cached in `sessionStorage` (tab-scoped), re-derives key silently on page refresh / navigation without re-prompting user
- [x] **`useKeyboardShortcuts.ts`** — global hotkey registry
  - [x] `N` → New entry
  - [x] `/` → Focus search
  - [x] `Esc` → Close open panels

---

## Sprint 2 — Auth & Landing Pages

### Auth Page (`/auth`) ✅
- [x] Move login/register from `/` to `/auth`
- [x] **Email / Password login** with humanized error messages
- [x] Register (create account) form with live password strength meter
- [x] **Google Sign-In** — `signInWithPopup` + Google OAuth button
- [x] **Forgot Password** — "Forgot password?" flow using `sendPasswordResetEmail`
  - [ ] Custom SMTP token flow *(deferred — currently uses Firebase's built-in email)*

### Landing Page (`/`) ✅
- [x] **Header nav** — Logo, Sign In, Get Started
- [x] **Hero section** with headline, sub-copy, and CTA
- [x] **How it works** — 3-step flow
- [x] **Feature cards** — AES-256-GCM, Zero-Knowledge, etc.
- [x] **Footer** — Privacy, Terms, Security links

### Legal Pages ✅
- [x] `/privacy` — Privacy Policy
- [x] `/terms` — Terms of Service
- [x] `/security` — Security & Encryption explainer

---

## Sprint 3 — Advanced Password Generator ✅

- [x] Dedicated generator view at `/generator`
- [x] **Generator modes (tabs)**:
  - [x] **Random** — charset-based with full controls
  - [x] **Passphrase** — EFF word list (200 words), configurable count (3–8 words), separator (- . _ space none)
  - [x] **PIN** — numeric only, 4–12 digits
  - [x] **Pattern** — custom format string (`L`=lower, `U`=upper, `d`=digit, `S`=symbol, `*`=any, literal otherwise)
- [x] **Pronounceable** toggle — alternates vowel/consonant for readability
- [x] **Strength meter bar** — 4-level: Weak · Fair · Strong · Very Strong
- [x] **Estimated crack time** display (@ 10B guesses/sec, entropy-based)
- [x] **Session history** — last 5 generated passwords (memory only, never saved or stored)
- [x] Character exclusion list (e.g. exclude `0`, `O`, `l`, `1` for readability)
- [x] Min-count guarantees (at least N uppercase, digits, symbols)
- [x] Generator linked in sidebar nav (Wand icon)
- [x] Auto-regenerates live on any option change

---

## Sprint 4 — 2FA Manager (TOTP Authenticator) ✅

- [x] **TOTP field on Login template entries**
  - [x] Optional "Add 2FA" toggle in entry form
  - [x] Accepts `otpauth://totp/...` URI or raw Base32 secret
  - [x] QR code scanner (device camera API via `jsQR` or similar)
  - [x] TOTP secret stored inside encrypted blob (zero-knowledge)
- [x] **Live TOTP code in revealed entry view**
  - [x] 6-digit code rendered prominently
  - [x] Animated countdown ring (30-second TOTP window)
  - [x] Auto-refreshes when period expires
  - [x] One-click copy with confirmation flash
- [x] **Standalone Authenticator page** (`/vault/authenticator`)
  - [x] List all entries with 2FA enabled
  - [x] Large code display, sorted by expiry time
  - [x] Search/filter authenticator entries
  - [x] "Add new authenticator" quick action
- [x] **Pure-TS TOTP implementation** (RFC 6238 — no native binary deps)
  - [x] HMAC-SHA1 using WebCrypto API
  - [x] Handles clock skew (±1 window)
- [x] Badge on sidebar Authenticator link showing count of accounts

---

## Sprint 5 — Password Health Dashboard (`/health`) ⏭️ (Skipped/Deferred)

- [-] **Security Score ring** — 0–100 animated SVG gauge
  - [-] Color: red (0–39), amber (40–69), green (70–100)
  - [-] Score breakdown tooltip
- [-] Score factors:
  - [-] −5 per weak password (length < 10, score < 2)
  - [-] −10 per reused password group
  - [-] −3 per entry older than 90 days (based on `createdAt` until edit tracking added)
  - [-] −5 per login entry missing 2FA
- [-] **Weak Passwords** section
  - [-] Strength bar per flagged entry
  - [-] "Update" button → opens entry in edit mode
- [-] **Reused Passwords** section
  - [-] Grouped entries sharing same hashed password
  - [-] Count badge
- [-] **Old Passwords** section (90+ days)
  - [-] "Last updated" relative date
- [-] **Missing 2FA** section
  - [-] Login entries without TOTP secret
  - [-] "Add 2FA" quick action
- [-] `src/lib/passwords/health.ts` — scoring library (pure functions, testable)
- [-] **HaveIBeenPwned check** (opt-in toggle, k-anonymity — SHA-1 prefix only, password never sent)

---

## Sprint 6 — Admin Panel (`/admin`)

> Secured by Firestore custom claim `admin: true`. Non-admins get 403 redirect.

### Theme Builder
- [x] Live preview panel (changes reflect before saving)
- [x] **Color controls**:
  - [x] Background color
  - [x] Foreground / text color
  - [x] Primary accent color
  - [x] Surface / card color
  - [x] Border color
  - [x] Danger / error color
- [x] **Visual style controls**:
  - [x] Border radius scale slider (0 = square → 24px = pill)
  - [x] Font family selector (12 Google Font options: Inter, Outfit, DM Sans…)
- [x] **Dark / Light / System** mode selector
- [x] **Preset themes** (built-in + saved custom):
  - [x] Default (current dark)
  - [x] Default Light
  - [x] 5 Custom Presets
  - [x] Save current as new preset (named)
  - [x] Delete custom preset
- [x] Theme config stored in Firestore `config/themes`
- [x] All users receive active theme on load

### User Management
- [x] Paginated user table (Firebase Admin via API route)
- [x] View: UID, email, display name, created, disabled status, admin status
- [x] Actions: disable / enable account, promote to admin, demote, force delete

### Email & Communications
- [x] Compose + send announcement email (Nodemailer API route)
- [x] Email send log (timestamp, recipient, status)
- [x] Configurable SMTP provider via Admin Settings ui

### Content Management
- [x] Content stub added

### Analytics Dashboard
- [x] Total registered users count
- [x] Total vault entries count

---

## Sprint 7 — Extended Vault Features ✅

- [x] **Favorites** — star toggle on each entry, "Favorites" section in sidebar
- [x] **Tags** — comma-separated free-form tags, filter by tag chip in sidebar
- [x] **Trash** — soft-delete, restore / permanent delete, "Trash" sidebar link (pinned at bottom)
- [x] **Inline edit** — edit existing entry in expanded panel (not just create + delete)
- [x] **Bulk actions** — checkbox multi-select → bulk delete, move to folder, toggle favorite, restore
- [x] **Select All** — checkbox in list header to select/deselect all visible items
- [x] **Empty Trash** — one-click wipe of all trashed items (visible in Trash header)
- [x] **Sorting** — sort by Date Added, Last Modified, Name A-Z; `updatedAt` schema field added
- [x] **Entry notes** — extra plain-text notes field on all templates
- [x] **Duplicate entry** deferred — see backlog
- [x] **Favicon Auto-Fetcher** — dynamically load site icon via Clearbit / Google / initials fallback
- [x] **Password Health Analyzer** — local strength scoring per entry
- [x] **HaveIBeenPwned API (k-anonymity)** — local breach check on demand, SHA-1 prefix only
- [x] **Password History** — last 5 versions stored per encrypted blob
- [x] **Type filters in sidebar** — Logins, Cards, Notes, Addresses, Profiles with live counts
- [x] **Scrollable sidebar folders** — max-height with thin scrollbar; Trash pinned at bottom
- [x] **404 Page** — cryptographic glitch aesthetic

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

## Sprint 9 — PWA, Attachments & Polish

- [ ] **Attachments** — store filename reference, encrypted file in Firebase Storage
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
| 1 | App Shell & Navigation | ✅ Complete | 14 / 14 |
| 2 | Auth & Landing Pages | ✅ Complete | 14 / 14 |
| 3 | Advanced Generator | ✅ Complete | 10 / 10 |
| 4 | 2FA Manager | ✅ Complete | 10 / 10 |
| 5 | Password Health | ⏭️ Deferred | 0 / 14 |
| 6 | Admin Panel | ✅ Complete | 22 / 22 |
| 7 | Vault Extensions | ✅ Complete | 17 / 17 |
| 8 | Settings Pages | 🔄 In Progress | 0 / 16 |
| 9 | PWA & Polish | ⬜ Todo | 0 / 13 |
| — | **Total** | | **101 / 148** |

### Recently Implemented (Post-Sprint-0)

- Multi-field entries: username, password, URL, custom fields
- Copy-to-clipboard on every field with ✓ flash feedback
- Masked reveal with eye icon toggle (password stays hidden until shown)
- Wrong master password detection with inline error message
- Optional Site URL field with external link shortcut
- Sidebar, TopBar, BottomNav, CommandPalette layout shell
- Toast notification system (`useToast` + `ToastContainer`)
- Auto-lock idle timer (`useAutoLock`) — 15 min default, per-user configurable
- Vault session persistence — master password cached in `sessionStorage`; no re-prompt on navigation or refresh
- Keyboard shortcuts (`useKeyboardShortcuts`)
- Auth page (`/auth`), Landing page (`/`), and legal pages
- Entry row hover states, consistent label alignment, User / Email labels
- **Full lint pass** (2026-04-12) — 0 errors, 0 warnings across all `.ts`/`.tsx` files
  - Removed all unused imports and dead destructures
  - Fixed all `setState-in-effect` anti-patterns (lazy initialisers, return-value error flow)
  - Memoized unstable arrays in `CommandPalette` to prevent re-subscription on every render
  - Wired `authenticator/page.tsx` to shared `VaultContext` — no longer re-prompts for master password

---

*Last updated: 2026-04-12*
*To begin a sprint, say "begin sprint N".*

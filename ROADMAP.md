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

## Sprint 8 — Settings Pages ✅

### `/settings/account`
- [x] Display name (inline edit + save to Firebase Auth profile)
- [x] Email address (shown; note on change flow)
- [x] Profile photo (upload → Firebase Storage → `updateProfile`)
- [x] Connected providers (Google, Email — unlink / link)
- [x] User theme preference (override admin theme, stored in `localStorage`)

### `/settings/security`
- [x] **Change master password**
  - [x] Re-derive AES-GCM key from new password (`reEncryptBlobs` utility)
  - [x] Re-encrypt all blobs with new key (Firestore `writeBatch`, max 500/batch)
  - [x] Progress indicator with item count
- [x] Auto-lock timer (Off / 5 / 15 / 30 min)
- [x] Clipboard auto-clear timer (Off / 30s / 60s, stored in `localStorage`)
- [x] Two-factor authentication on Firebase account (informational card with provider details)
- [x] Last password changed date (stored in `users/{uid}/profile/security` Firestore doc)

### `/settings/data`
- [x] **Export vault** — download `vaultr-export-YYYY-MM-DD.json`
  - [x] Option to protect export with separate passphrase (AES-GCM wrapped .enc file)
  - [x] Blobs stay encrypted in export file
- [x] **Import vault** — re-upload export file (.json or .enc), re-add under current key
- [x] **CSV Import** — parse LastPass / Bitwarden / Chrome CSV formats (papaparse)
  - [x] Preview table before importing (up to 50 rows shown)
  - [x] Conflict resolution (skip / overwrite)
- [x] **Delete all vault data** — wipe `vaultItems` collection (type "DELETE" to confirm)
- [x] **Delete account** — Firebase Auth deletion + Firestore wipe (type "DELETE ACCOUNT")

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

## Sprint 10 — Device Trust & Session Management ✅

> Zero-knowledge-compatible. No vault keys involved. All session data is metadata only.

### Session Registration & Tracking
- [x] **`src/lib/session.ts`** — client-side session utilities
  - [x] `generateSessionId()` — `crypto.randomUUID()` stored in `localStorage`
  - [x] `detectDevice()` — user-agent parser → `{ deviceName, deviceType, browser, os }`
  - [x] `heartbeat()` — updates `lastSeenAt` every 5 min via Firestore `setDoc({merge:true})`
- [x] **`/api/auth/register-session`** — called once after login
  - [x] Captures IP from `x-forwarded-for` header
  - [x] Optional rough GeoIP via ip-api.com (free, no key, best-effort)
  - [x] Creates `users/{uid}/sessions/{sessionId}` doc with `isTrusted: false`
  - [x] Triggers new-device alert email if user has other sessions and `newDeviceEmailAlert: true`

### Email-Based Device Verification
- [x] **`/api/auth/send-verification-email`** — OTP dispatch
  - [x] Generates 6-digit OTP, stores SHA-256 hash in session doc
  - [x] Sends branded email via existing SMTP pipeline (Nodemailer)
  - [x] Rate-limited: 3 sends per session per hour
- [x] **`/api/auth/verify-device`** — OTP check
  - [x] Compares SHA-256(otp) against stored hash
  - [x] Max 5 attempts then 1hr lockout
  - [x] Sets `isTrusted: true`, clears `verificationToken`

### Session Revocation
- [x] **`/api/auth/revoke-session`** — terminate a session
  - [x] Deletes session doc from Firestore
  - [x] If revoking current session: triggers `signOut(auth)`
- [x] **"Sign out of all other devices"** — bulk revoke all non-current sessions

### `useSessionManager` Hook
- [x] **`src/hooks/useSessionManager.ts`**
  - [x] Realtime listener on `users/{uid}/sessions`
  - [x] Derives `isCurrentDevice` client-side by comparing `sessionId` in `localStorage`
  - [x] Exposes: `sessions[]`, `isVerified`, `sendVerificationEmail()`, `verifyOtp()`, `revokeSession()`, `revokeAllOtherSessions()`

### UI: Security Settings (`/settings/security`)
- [x] **"Sessions & Devices"** section (new, at bottom of page)
  - [x] Current device card with **Verified ✓** / **Unverified ⚠** badge
  - [x] Inline 6-digit OTP input when device is unverified
  - [x] Active sessions list — device icon, name, browser, OS, rough location, last seen
  - [x] "Current device" green badge on active row
  - [x] **Revoke** button per non-current session (with confirmation dialog)
  - [x] **"Sign out of all other devices"** danger button
- [x] **Notification Preference toggles**
  - [x] Email me when a new device signs in (`newDeviceEmailAlert`)
  - [x] Require email verification for new devices (`requireVerificationOnNew`)

### UI: Vault Layout Warning Banner
- [x] Dismissible banner in `vault/layout.tsx`
  - [x] Shown only when `isTrusted === false` for current session
  - [x] "This device is not verified. [Send code] [Dismiss]"
  - [x] Does **not** block vault access (zero-knowledge constraint)

### Admin Panel Extension
- [x] **"Active Sessions" tab** in Admin Panel
  - [x] Table: user email, device, location, last seen, trusted status, Actions
  - [x] Admin can force-revoke any user's session

---

## Sprint 11 — Email Templates configuration ✅

- [x] Create a shared template utility `src/lib/emailTemplates.ts` 
- [x] Add Admin Template configurations view
  - [x] Add email templates WYSIWYG editor
- [x] Provide testing email sending mechanism from admin dashboard
- [x] Bind email triggers for register session and system notifications to use templates.

---

## Sprint 12 — Robust Session Management & Security Audit Logs

> Zero-knowledge-compatible. All session metadata only — vault keys never involved.
> Logs are stored in Firestore and must **never be deleted** (admin or user), only filtered/viewed.

### User-Controlled Session Preferences
- [ ] **New device login alert** (default: **on**)
  - [ ] Email notification on new device sign-in (already partially in Sprint 10 — wire to new toggle)
  - [ ] In-app notification badge / toast on new device detected
- [ ] **Device verification gate** (default: **off**)
  - [ ] Setting: `requireVerificationOnNew` toggle in `/settings/security`
  - [ ] When enabled: new device must complete OTP email verification before vault access is granted
  - [ ] When disabled: new device can access vault immediately, alert email still sent
  - [ ] Clear UX: toggling this shows a confirmation modal explaining the trade-off
- [ ] **Per-device trust** — user can manually mark a device as trusted/untrusted from session list
- [ ] **Session nickname** — user can rename sessions (e.g. "Work Laptop", "Home iPhone")
- [ ] **Session expiry** — optional setting: auto-revoke sessions inactive for N days (7 / 30 / 90 / Never)

### Security Audit Logs (Permanent, Append-Only)
- [ ] **`src/lib/auditLog.ts`** — shared log writer
  - [ ] `logSecurityEvent(uid, event)` — writes to `users/{uid}/auditLog/{autoId}`
  - [ ] Schema: `{ event, timestamp, sessionId, deviceName, ip, location, meta: {} }`
  - [ ] Firestore rules: **append-only** — no update or delete permitted for any role
- [ ] **Logged events** (exhaustive list):
  - [ ] `LOGIN_SUCCESS` — new sign-in (device, IP, location)
  - [ ] `LOGIN_FAILURE` — wrong master password or auth failure (reason, IP)
  - [ ] `NEW_DEVICE_DETECTED` — first session from unknown device
  - [ ] `DEVICE_VERIFIED` — OTP verification completed successfully
  - [ ] `DEVICE_VERIFICATION_FAILED` — wrong OTP attempt (attempt count included)
  - [ ] `DEVICE_VERIFICATION_LOCKED` — max OTP attempts exceeded (1hr lockout)
  - [ ] `SESSION_REVOKED` — self-revoke or revoke-other session
  - [ ] `SESSION_BULK_REVOKE` — "sign out all other devices"
  - [ ] `ADMIN_SESSION_REVOKE` — admin force-revoked a user session (includes admin UID)
  - [ ] `MASTER_PASSWORD_CHANGED` — re-encryption completed
  - [ ] `ACCOUNT_EXPORT` — vault exported (format, item count)
  - [ ] `ACCOUNT_IMPORT` — vault imported (item count, source format)
  - [ ] `SETTING_CHANGED` — security preference changed (which setting, old→new value)
  - [ ] `ACCOUNT_DELETION_INITIATED` — user triggered account delete

### Admin Panel — Security Audit Log Viewer (`/admin/logs`)
- [ ] **Persistent log table** — never paginated away, infinite scroll
- [ ] **Filters** (combinable):
  - [ ] By **user** — search by email or UID
  - [ ] By **event type** — multi-select checklist of all event types
  - [ ] By **date range** — from/to date pickers
  - [ ] By **IP address** — exact or prefix match
  - [ ] By **location** — country / city contains
  - [ ] By **session ID** — trace a specific session's full history
- [ ] **Export logs** — download filtered results as CSV (admin only)
- [ ] **Log entry detail panel** — click row → slide-in with full `meta` JSON
- [ ] **Live tail mode** — toggle to auto-scroll as new events arrive (Firestore onSnapshot)
- [ ] **Event severity badges** — color-coded: Info (blue) · Warning (amber) · Critical (red)
  - [ ] Critical: `LOGIN_FAILURE`, `DEVICE_VERIFICATION_LOCKED`, `ADMIN_SESSION_REVOKE`, `ACCOUNT_DELETION_INITIATED`
  - [ ] Warning: `DEVICE_VERIFICATION_FAILED`, `NEW_DEVICE_DETECTED`
  - [ ] Info: everything else
- [ ] **Summary cards** at top: total events today, unique users active, critical events in last 24h

### Firestore Rules
- [ ] `users/{uid}/auditLog/{logId}` — **create allowed** (authenticated user or server), **read allowed** (owner or admin), **update/delete denied for everyone** (immutable)
- [ ] Admin read access to any user's auditLog via admin claim

---

## Future Plans — Long-Term Vision

> These are post-v1 roadmap items. Not all will be built, but all have been thought through. Ordered roughly by priority / feasibility.

---

### 🧩 Browser Extension — Autofill & Quick Access

> Separate repo, same Firebase project. The extension talks to the web app's Firebase backend using the same UID/credentials.

- [-] **Manifest V3** Chrome/Edge extension (Firefox MV2 compat layer)
- [-] **Popup UI** — search vault entries, copy username/password with one click
- [-] **Page autofill** — detect login fields on active tab, inject credentials
  - [-] Smart field detection (heuristics: `type=password`, `name=email`, `autocomplete=username`)
  - [-] Multiple accounts per domain — show picker if >1 match
  - [-] Keyboard shortcut to trigger autofill (`Alt+Shift+F`)
- [-] **Context menu** — right-click a password field → "Fill from _vaultr"
- [-] **Inline icon** — small _vaultr icon injected into detected password fields
- [-] **New credential detection** — offer to save new logins when form is submitted
- [-] **Session bridge** — extension re-uses Firebase auth token; no separate login
- [-] **Zero-knowledge maintained** — master password derived in extension context, vault key never leaves extension memory
- [-] **Extension settings** — autofill on/off, inline icon on/off, per-site exceptions list
- [-] **Biometric unlock** in extension (WebAuthn / OS biometrics via `navigator.credentials`)

---

### 📱 Mobile Apps — iOS & Android

- [-] **React Native wrapper** (Expo) or **Capacitor** shell around the existing Next.js web app
- [-] **Biometric unlock** — Face ID / Touch ID / Fingerprint via `expo-local-authentication` or Capacitor plugin
- [-] **App-level autofill** — iOS AutoFill Credential Provider Extension, Android Autofill Framework
- [-] **Offline mode** — IndexedDB / SQLite cache of encrypted blobs; sync on reconnect
- [-] **Push notifications** — new device login alerts via FCM (Firebase Cloud Messaging)
- [-] **Share Sheet integration** — iOS Share extension to save credentials from Safari
- [-] **Widget** — home screen quick-copy widget for pinned credentials (no master password required for read if biometric unlocked)

---

### 👥 Collaboration — Shared Vaults & Teams

- [-] **Shared vault items** — send an encrypted copy of an entry to another _vaultr user (asymmetric encryption, recipient's public key)
- [-] **Secure link sharing** — time-limited, view-once encrypted link for non-users (password-protected AES blob in URL fragment)
- [-] **Team / Organization plan** — org-level vault with role-based access (Owner, Admin, Member, Viewer)
- [-] **Folder-level sharing** — share an entire folder with specific team members
- [-] **Audit trail per shared item** — who viewed, when, from where
- [-] **Emergency access** — designate a trusted contact who can request access after N-day waiting period (Dead Man's Switch pattern)

---

### ⚡ Power User Features

- [-] **CLI tool** — `vaultr` npm package: `vaultr get <name>`, `vaultr copy <name>`, `vaultr add`, `vaultr export`
- [-] **REST API / Webhooks** — personal API tokens for programmatic read access (read-only, scoped)
- [-] **Import from more sources** — 1Password (.1pux), Dashlane (.dash), Keeper, Enpass, KeePass (.kdbx)
- [-] **SSH Key storage** — dedicated SSH key template (public + private key, passphrase); one-click copy to clipboard
- [-] **Secure Notes with Markdown** — rich Markdown renderer in revealed view (headings, code blocks, links)
- [-] **File attachments** — attach files to entries (encrypted, stored in Firebase Storage, max 5MB per file)
- [-] **Password rotation reminders** — per-entry "remind me to rotate in N days" with email/push alert
- [-] **Collections / Smart folders** — dynamic folders based on rules (e.g. "all entries with weak passwords", "entries older than 90 days")
- [-] **Custom templates** — user-defined entry templates beyond the built-in Login/Card/Note/Address types
- [-] **Duplicate entry detection** — warn when saving a credential already in vault (same domain + username)

---

### 🏗️ Infrastructure & Developer

- [-] **Self-hosted deployment guide** — Docker Compose stack: Next.js + Firebase Emulator + custom SMTP
- [-] **Open source release** — public GitHub repo, MIT or AGPL license decision
- [-] **End-to-end tests** — Playwright test suite covering: auth flow, vault CRUD, encryption round-trip, session management
- [-] **Unit tests** — Vitest for all pure functions in `src/lib/` (crypto, generator, health scoring, TOTP)
- [-] **CI/CD pipeline** — GitHub Actions: lint → type-check → unit tests → Playwright → deploy to Vercel/Firebase
- [-] **Rate limiting middleware** — per-user API route throttling (login attempts, OTP sends, export requests)
- [-] **Audit log SIEM export** — periodic export of audit logs to S3-compatible storage for enterprise compliance
- [-] **Content Security Policy** hardening — strict CSP with nonces, no `unsafe-inline`

---

### 💼 Monetization & Business (if pursued)

- [-] **Free tier** — unlimited entries, 1 device, core features
- [-] **Pro tier** — unlimited devices, sharing, file attachments, priority support
- [-] **Team tier** — all Pro + org vaults, SSO (SAML/OIDC), admin console, audit logs export
- [-] **White-label / self-hosted license** — for enterprises wanting on-prem deployment
- [-] **Stripe integration** — subscription billing, per-seat pricing for Teams

---

## Sprint 13 — Notification System

> Zero-knowledge safe — notifications contain only metadata, never vault data.
> Three independently shippable layers. Build in order: Email extensions → In-app → Browser Push.

### Layer 1 — In-App Notifications (Bell Icon + Panel)

#### New Files
- [ ] **`src/context/NotificationContext.tsx`** — real-time `onSnapshot` on `users/{uid}/notifications`
  - [ ] Exposes: `notifications[]`, `unreadCount`, `markRead(id)`, `markAllRead()`, `clearAll()`
  - [ ] Auto-marks as read when notification panel is opened
- [ ] **`src/lib/notification.ts`** — server-side helper
  - [ ] `sendNotification(uid, { type, title, body, meta })` — writes to Firestore
  - [ ] Called from all existing API routes that trigger security events
- [ ] **`src/components/layout/NotificationPanel.tsx`** — dropdown panel
  - [ ] Grouped by date (Today, Yesterday, Earlier)
  - [ ] Per-item: icon by type, title, relative timestamp, unread dot, click-to-mark-read
  - [ ] Empty state illustration
  - [ ] "Mark all as read" + "Clear all" actions

#### Modified Files
- [ ] **`TopBar.tsx`** — add bell icon with animated unread count badge
- [ ] **Root `layout.tsx`** — wrap with `<NotificationProvider>`
- [ ] **`/api/auth/register-session`** — add `sendNotification()` for `NEW_DEVICE`
- [ ] **`/api/auth/verify-device`** — notify on `DEVICE_VERIFIED` / `DEVICE_VERIFICATION_FAILED`
- [ ] **`/api/auth/revoke-session`** — notify target user on remote revoke
- [ ] **`settings/security/page.tsx`** — per-event notification preference toggles

#### Firestore Schema
```
users/{uid}/notifications/{id}
  type:      "NEW_DEVICE" | "SESSION_REVOKED" | "DEVICE_VERIFIED" |
             "DEVICE_VERIFICATION_FAILED" | "PASSWORD_CHANGED" |
             "VAULT_EXPORTED" | "VAULT_IMPORTED" | "ADMIN_ACTION"
  title:     string
  body:      string
  read:      boolean
  createdAt: timestamp
  meta:      {}   ← deviceName, IP, sessionId, etc.
```

#### Firestore Rules
- [ ] Users can **read** and **update** (mark read) own notifications
- [ ] Only server (Admin SDK) can **create** notifications
- [ ] No deletes except by owner (for "clear all" UX)

---

### Layer 2 — Browser Push Notifications

#### New Files
- [ ] **`public/sw.js`** — service worker
  - [ ] Listens for `push` events → calls `self.registration.showNotification()`
  - [ ] Handles `notificationclick` → focuses app tab or opens `/vault`
  - [ ] Handles SW updates gracefully (skip waiting, claim clients)
- [ ] **`/api/push/subscribe`** — save browser's `PushSubscription` to Firestore
- [ ] **`/api/push/unsubscribe`** — remove subscription doc
- [ ] **`/api/push/send`** — internal utility (not public endpoint)
  - [ ] Loads all `pushSubscriptions` for a UID
  - [ ] Calls `webpush.sendNotification()` for each
  - [ ] On `410 Gone` response: deletes stale subscription doc automatically

#### New Dependency
```bash
npm install web-push
```

#### New Environment Variables
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # sent to client to register SW
VAPID_PRIVATE_KEY=...              # server only, never exposed
VAPID_SUBJECT=mailto:admin@vaultr.app
```

#### Modified Files
- [ ] **`next.config.ts`** — add service worker headers (`Service-Worker-Allowed`)
- [ ] **Root `layout.tsx`** — register SW on mount (`navigator.serviceWorker.register`)
- [ ] **Notification settings** — "Enable Push" button triggers `Notification.requestPermission()`; on grant, subscribes and POSTs to `/api/push/subscribe`

#### Firestore Schema
```
users/{uid}/pushSubscriptions/{subId}
  endpoint:   string
  keys:       { p256dh: string, auth: string }
  createdAt:  timestamp
  userAgent:  string
```

#### Edge Cases
- [ ] Fan-out to **all** subscriptions (user may have multiple browsers/devices)
- [ ] Handle `410 Gone` → delete stale subscription, don't retry
- [ ] Browser permission revoked silently → subscription stops; detect and surface in settings
- [ ] Safari iOS 16.4+ push support (slightly different API — test explicitly)
- [ ] Push while tab is open → suppress OS notification, show in-app toast instead

---

### Layer 3 — Email Notification Extensions

> Infrastructure already exists (`emailTemplates.ts`, Nodemailer, SMTP admin config).

#### New Email Triggers
- [ ] Session revoked remotely (by user from another device)
- [ ] Admin force-revoked session
- [ ] Master password changed
- [ ] Vault exported
- [ ] Vault imported (item count)

#### New Features
- [ ] **Unsubscribe link** in every email footer (one-click disable that specific email type)
- [ ] Per-event email opt-in/out in notification settings UI

---

### Notification Preferences UI (`/settings/notifications` or `/settings/security`)

```
Notification Preferences
────────────────────────────────────────────────────────
New device sign-in            [✓ Email]  [✓ In-app]
Session revoked remotely      [✓ Email]  [✓ In-app]
Device verification events    [ Email]   [✓ In-app]
Admin actions on account      [✓ Email]  [✓ In-app]
────────────────────────────────────────────────────────
Browser Push Notifications    [Enable Push] / [Enabled ✓]
                              (requires browser permission)
────────────────────────────────────────────────────────
```

#### Firestore Schema
```
users/{uid}/notificationPrefs/default
  newDeviceAlert:       { email: boolean, inApp: boolean }
  sessionRevoked:       { email: boolean, inApp: boolean }
  deviceVerification:   { email: boolean, inApp: boolean }
  adminActions:         { email: boolean, inApp: boolean }
  pushEnabled:          boolean
```

---

### Build Order (Recommended)
1. **Layer 3 email additions** — lowest effort, highest impact, no new dependencies
2. **Layer 1 in-app** — `NotificationContext` + panel + `TopBar` bell
3. **Layer 2 browser push** — after service worker and VAPID setup confirmed working

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
| 8 | Settings Pages | ✅ Complete | 18 / 18 |
| 9 | PWA & Polish | ⬜ Todo | 0 / 13 |
| 10 | Device Trust & Sessions | ✅ Complete | 20 / 20 |
| 11 | Email Templates | ✅ Complete | 3 / 3 |
| 12 | Robust Session Mgmt & Audit Logs | ⬜ Todo | 0 / 35 |
| 13 | Notification System | ⬜ Todo | 0 / 38 |
| — | **Total** | | **142 / 262** |



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

*Last updated: 2026-05-04*  
*To begin a sprint, say "begin sprint N".*

# todo.md — _vaultr Session Log

## Last Updated: 2026-08-07

---

### Smart Folder & Entry Pre-selection
- [x] **Automatic Folder Pre-selection**: When inside an opened folder or subfolder (e.g. `Work/Projects/Alpha`), clicking "Add new item" pre-selects that folder automatically in the `NewEntryDialog` folder dropdown.
- [x] Fixed `NewEntryDialog` resetting `folder` state to empty string on dialog open.
- [x] **Login URL Editing Fix**:
  - Guaranteed URL field initializes to `[""]` when editing a login item without a domain, ensuring the Website / URL input field is ALWAYS visible.
  - Multi-URL secondary URL support with remove button (`X`) shown ONLY when > 1 URL exists.
  - Automatic trimming and filtering of empty/whitespace URL fields on save.
- [x] **Template Type Locking & Payload Isolation**:
  - Locked template type selector during item edit mode (`initialData` present), displaying a fixed type badge `(Type Fixed)` so users cannot change an existing item's template type.
  - Strict payload field isolation on item creation/saving: only fields belonging to the currently selected template type are included in `payload`. Inputs entered into other template tabs before switching are automatically ignored and stripped.
  - Automatic purging of undefined/empty-string keys from saved encrypted payloads.
- [x] **Git Commit History Cleanup & Remote Sync**:
  - Squashed 39 noisy commits into 8 clean, logical, human-style atomic commits with direct emoji titles and proper timestamps.
  - Sanitized credentials in `.env.local.idk`.
  - Pushed to `origin/main` (`git push --force-with-lease origin main` — branch fully in sync).
- [x] Zero TypeScript errors confirmed (`npx tsc --noEmit` — clean).

### Vault Item Display & Icon System Redesign
- [x] **Grid Expansion Fix & Padding**:
  - Restored previous clean grid card & detail design as requested.
  - Applied `items-start` to grid container layouts across single folder, uncategorized, and subfolder tree views so expanding one item does not stretch sibling cards in the row.
  - Fixed `inGrid` mode container padding (`p-4 space-y-3`) in `ExpandedDetails` so `USER`, `PASSWORD`, `PRIVATE NOTES`, `HEALTH ANALYSIS`, and `Edit Entry` do not touch the borders or truncate at the right edge.
  - Added `truncate min-w-0` and responsive `w-16 sm:w-20` label width in `DetailRow` and `MaskedValue` to prevent value overflow on narrow grid card columns.
- [x] **Removed Repetitive Type Badges**: Removed `LOGIN`, `CARD`, `NOTE`, `ADDRESS`, `PROFILE` text pills from every item row in List View and Grid View.
- [x] **Standardized 32px Icon System**: Icons standardized to `w-8 h-8 rounded-xl` with dual-tone accent fills (`bg-violet-500/10`, `bg-amber-500/10`, `bg-emerald-500/10`, `bg-sky-500/10`).
- [x] **Smart Domain Resolver & Multi-Tier Favicon Loader**:
  - Automatically resolves domain names from item name if `domain` field is missing (e.g. `"GitHub"` → `"github.com"`, `"Google"` → `"google.com"`).
  - Uses Google Favicon API as primary source (`sz=64`) for 99.9% domain coverage, falling back to DuckDuckGo and Clearbit.
- [x] **Clean Item Hierarchy**: Primary name in `font-medium text-neutral-100`, sub-line in monospace hint.
- [x] Zero TypeScript errors confirmed (`npx tsc --noEmit` — clean).

### Smart Folder Deletion UX
- [x] **Empty Folders (0 items)**: Instantly deleted upon clicking delete without prompting for disposition choices.
- [x] **Folders with Items (>0 items)**: Displays `DeleteFolderModal` asking user how to handle contained items:
  - **Move items to Uncategorized**: Removes folder association while keeping items active.
  - **Delete items too**: Soft-deletes items to Trash, with explicit warning: *"Folder structure will be lost"*.
- [x] **Illustration-Backed Custom UI**: Premium dialog with centered hero SVG illustration (`/illustrations/throw-away_k2t5.svg`), primary `"Delete Folder (Keep Items)"` button, and secondary `"Delete folder and move X items to Trash"` red text link.
- [x] Integrated seamlessly into both `Sidebar.tsx` tree view and `FolderManager.tsx` modal view.
- [x] Zero TypeScript errors confirmed (`npx tsc --noEmit` — clean).

---


---

## ✅ Completed This Session (2026-08-06)

### Mass Actions Overhaul — Batch API
- [x] Created `POST /api/vault/items/batch/route.ts` — handles trash/restore/favorite/unfavorite/move for N items in a **single DB transaction** (replaces N parallel HTTP calls that caused 429 errors).
- [x] Ownership check: validates all IDs belong to the current user before updating.
- [x] Supports up to 500 items per batch.

### Master Key Change & Trash Re-encryption
- [x] Included items in Trash (`deletedAt !== null`) during master password re-encryption: Previously only active items were re-encrypted, causing decryption errors when restoring items from Trash after a password change. Now all items in the vault are re-encrypted atomically.
- [x] Verified old master password against any available vault item (active or trash).
- [x] Displayed exact re-encrypted item count and breakdown in UI:
  - Header label: `{totalCount} item(s) will be re-encrypted ({activeCount} active, {trashCount} in trash)`.
  - Success message: `Master password changed. {totalCount} item(s) re-encrypted ({activeCount} active, {trashCount} in trash)`.
- [x] Automatically synced VaultContext in-memory cryptoKey (`unlock(newPw)`) immediately upon changing master password.

### VaultContext Extensions
- [x] Added `batchAction(action, ids, payload?)` — calls new batch endpoint, single `fetchItems()` refresh.
- [x] Added `renameFolder(from, to)` — calls PATCH /api/vault/folders.
- [x] Added `deleteFolder(name, disposition)` — calls DELETE /api/vault/folders.

### Mass Actions UI
- [x] Replaced `handleBulkAction` N-parallel pattern with `batchAction` single call.
- [x] Added `bulkBusy` loading state — spinner + "Processing N items…" message while active.
- [x] Added `bulkConfirmTrash` confirm dialog before trashing items (with inline confirmation panel).
- [x] Keyboard shortcut: `Escape` to deselect all; `Delete`/`Backspace` to trigger bulk trash confirm.
- [x] All bulk action buttons disabled while operation is in progress.

### FolderManager Modal
- [x] Created `src/components/vault/FolderManager.tsx` — triggered from the ⚙ icon in the sidebar Folders header.
- [x] Lists all folders with item counts, nested folder display with indentation.
- [x] Inline rename (input field, Enter to confirm, Escape to cancel).
- [x] Delete folder with confirmation panel and disposition choice (Uncategorized vs Trash).
- [x] Shows info about how to create nested folders.

### Sidebar Folder UX Redesign
- [x] Added `buildFolderTree()` util — builds hierarchical tree from slash-delimited flat folder strings.
- [x] Added `FolderTreeNode` component — renders collapsible folder tree nodes with:
  - Indented nesting based on depth.
  - Collapse/expand toggle for nodes with children.
  - Item counts: `direct/total` for parent nodes.
  - `⋯` context menu button on hover (→ right-click menu).
  - FolderOpen icon when active.
- [x] Right-click / `⋯` context menu: Open, New item here, Rename/Delete.
- [x] Added `⚙` Manage Folders button to the Folders section header.
- [x] Collapse state persisted to `localStorage` per user session.
- [x] Collapsed mode: shows flat icon list (unchanged behavior).
- [x] Zero TypeScript errors confirmed (`npx tsc --noEmit` — clean).

### Breadcrumb Navigation
- [x] Added breadcrumb trail in vault/page.tsx for nested folder paths (e.g. `Work › Projects › Alpha`).
- [x] Each breadcrumb segment is a clickable link.
- [x] Only shown for folders with 2+ path segments.

---

## 🔜 Next Steps

- [ ] **Drag-and-drop items between folders** (Phase 2, requires `@dnd-kit` or similar).
- [ ] **Empty folder creation UI** — right now folders are derived from items. Add ability to pre-create folder names.
- [ ] **Merge folders** — in FolderManager, allow renaming folder A to folder B's name to consolidate.
- [ ] **Search within folder** — scoped search (current search is global).
- [ ] **"Include subfolders" toggle** — for nested folder views, toggle to show all descendant items.

---

## ✅ Completed This Session

### Account Linking UX Overhaul
- [x] Streamlined "Link Password" flow: removed the email input field and implemented OTP verification using the user's logged-in session email.
- [x] Secured unlinking: enabled unlinking for the credential provider and added protection to block unlinking the last remaining provider.
- [x] Redesigned Profile details preview card layout to remove the search illustration and implement a premium secure access badge (featuring an EMV microchip graphic, verified status indicator dot, and clean font-mono styling).
- [x] Fixed `PROVIDER_META` keys ("google" and "credential") to resolve custom label styles.
- [x] Fixed settings layout TopBar: hid the non-functional search button and password generator actions, and styled a clean Vaultr branding + "Settings" badge on the left.
- [x] Verified zero TypeScript compilation errors.

### Landing Page Redesign & Polish
- [x] Redesigned the main landing page (`src/app/page.tsx`) to match the clean dark theme.
- [x] Rearranged landing page sections: Hero, Features bento grid, Security specs table, "Up and running in minutes" animated steps timeline, Open Source / GitHub section, FAQ, and final CTA.
- [x] Removed spy detective artwork from all top sections and integrated it exclusively into the final CTA section.
- [x] Positioned the spy detective artwork (`spy-detective-white.png`) as a full-height visual on the **right side** of the final CTA section with no overlapping elements or dividers.
- [x] Redesigned the "Up and running in minutes" section with an animated timeline featuring circular nodes and dynamic connecting paths.
- [x] Upgraded the Open Source section with a minimal, wrapperless, custom-built inline vector SVG GitHub mascot that dynamically swaps color schemes for perfect readability based on the active theme (white circle with black cat in dark theme, black circle with white cat in light theme) for absolute sharpness.
- [x] Updated all homepage repository links and clone instructions to point to the user's repository (`https://github.com/Yashraj-Jangra/vaultr`).
- [x] Verified zero TypeScript compilation errors via `npx tsc --noEmit`.

### Local Dev Environment & Tunnel Configuration
- [x] Set up local database and MinIO endpoint variables in `.env.local` to use `127.0.0.1` loopbacks (`5435` and `9005` respectively) to route traffic through secure SSH tunnels and bypass VPS host interface locks.

### Docker & CasaOS Containerization
- [x] Created `Dockerfile` with multi-stage build running Next.js and auto-migrating DB schema via `drizzle-kit` on startup.
- [x] Configured `docker-compose.yml` to include Next.js application container with dependencies on Postgres/MinIO.
- [x] Customized host-bound ports (Next.js app: `3005`, Postgres: `5435`, MinIO API: `9005`, MinIO Console: `9011`) to prevent host conflicts on the user's server.
- [x] Set up GitHub Actions CI/CD workflow to compile code and automatically build/push the Docker container image to GitHub Container Registry (GHCR) to resolve Portainer HTTP/2 framing errors.


### Security Audit + Fixes (Full Pass)

**Phase 1 — Critical Infrastructure**
- [x] M-1: Added full HTTP security headers to `next.config.ts` (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [x] L-1: Added `test_credentials.md` to `.gitignore`
- [x] L-6: Created `public/robots.txt` blocking `/admin`, `/vault`, `/settings`, `/api/`
- [x] L-4: Renamed `db:push --force` → `db:push:dev` in `package.json`
- [x] L-5: Created `src/lib/safeError.ts` + patched 4 API routes that leaked raw error messages in production
- [x] C-4: Fixed wildcard CORS — removed `"http://192.168.*"` patterns, replaced with `TRUSTED_ORIGINS` env var
- [x] H-4: OTP log wrapped in `NODE_ENV !== "production"` guard
- [x] L-2: Session reduced from 30 days → 7 days

**Phase 2 — API Hardening**
- [x] H-1: Added Zod validation to `POST /api/vault/items` and `PATCH /api/vault/items/[id]`
- [x] H-2: Fixed reencrypt DoS — max 5000 items, UUID validation, 500-item batch chunking
- [x] H-3: Avatar upload now enforces MIME type + extension allowlist (jpeg/png/webp/gif only)
- [x] M-5: Admin user list capped at 200 results, profile fetch optimized to page-only via inArray
- [x] M-4: Created `src/lib/getClientIp.ts` — validated IP extraction, patched admin DB route
- [x] L-3: Webhook URL cached in-module with 5-min TTL, invalidated on admin config save
- [x] L-7: `verifyUserToken` now checks `userProfiles.disabled` flag — disabled users get 403

**Phase 3 — Rate Limiting**
- [x] C-1: Created `src/middleware.ts` — per-IP in-memory rate limiter:
  - Sign-in: 10 req/15min
  - Sign-up: 5 req/hr
  - OTP/2FA: 5 req/10min
  - General API: 120 req/min
  - Returns 429 with `Retry-After` and `X-RateLimit-*` headers

**Phase 4 — DB Migration + Admin UI**
- [x] C-2: Added `require_email_verification` boolean to `config_system` table (migration applied)
- [x] C-2: `auth.ts` — `requireEmailVerification: true` permanently; `sendVerificationEmail` hook auto-verifies when DB toggle is OFF
- [x] C-2: Admin system API reads/writes `requireEmailVerification`
- [x] C-2: Admin panel System Operations page has new "Require Email Verification" toggle

**Phase 5 — Session Management Rebuild**
- [x] Added `session_meta` shadow table to schema (migration 0006 applied)
- [x] Installed `ua-parser-js` for device name parsing
- [x] Created `src/lib/sessionMeta.ts` with:
  - `trackSession()` — DB-level 5-min throttled upsert of last_active_at
  - `parseDeviceName()` — UA string → "Chrome 125 on Windows 11"
  - Geo-lookup via ip-api.com (fire-and-forget, skips private IPs)
  - `getUserSessions()` — list user's own sessions with meta (filters 14-day idle)
  - `getAllSessions()` — admin view, all sessions, with user join + search
  - `terminateSession()` — delete from Better Auth session table (cascades to meta)
  - `terminateUserSessions()` — bulk terminate, optional exclude current
  - `getActiveSessionCounts()` — badge counts for admin user list
- [x] Updated `verifyUser.ts` — fires non-blocking `trackSession()` on every auth'd request; exposes `sessionId` in UserPayload
- [x] Created user session API routes:
  - `GET /api/settings/sessions` — list own sessions
  - `DELETE /api/settings/sessions` — revoke all other sessions
  - `DELETE /api/settings/sessions/[id]` — revoke single session (validates ownership)
- [x] Created admin session API routes:
  - `GET /api/admin/sessions` — all sessions with search + pagination
  - `DELETE /api/admin/sessions/[id]` — force-terminate any session
  - `DELETE /api/admin/sessions/user/[uid]` — kill all sessions for a user
- [x] Rebuilt `settings/security/page.tsx` — full session list with:
  - Device icon (desktop/mobile), device name, browser, OS
  - IP address, geo-location (country/city)
  - Sign-in date, last-active relative time
  - Current session badge, individual Revoke buttons
  - "Sign out all other devices" bulk action
  - Loading skeletons, error state, refresh button
- [x] Created `admin/sessions/page.tsx` — admin session panel with:
  - Stats row (total sessions, unique users, page count)
  - Search by email/name
  - Group-by-user toggle
  - Per-session revoke (hover to reveal)
  - "Kill all" per-user with confirmation
  - Pagination (50 per page)
- [x] Added "Sessions" link to admin sidebar nav

**Decisions / Intentionally Skipped:**
- C-3: Admin can read account/session tables (owner-only access, intentional)
- H-5: Disabled admin check not added (single-owner deployment)
- M-2: Filesystem audit logs are kept (intentional for this project)
- M-3: Session tokens in DB browser left as-is (owner-only access)
- M-6: No password confirmation on account delete (intentional UX decision)
- M-7: SMTP credentials not encrypted at rest (deferred)
- Session admin kill notification: silent (intentional user choice)

---

## 🔜 Next Steps / Open Issues

### High Priority
- [ ] Replace in-memory rate limiter with Redis/Upstash for multi-process/edge deployments

### Medium Priority
- [ ] Encrypt SMTP password at rest in DB (M-7 — deferred)
- [ ] Show active session count badge on admin Users page rows (uses `getActiveSessionCounts()` from sessionMeta.ts)

### Low Priority
- [ ] Audit log retention policy (auto-delete logs older than N days)
- [ ] Add `npm audit fix` to CI to track known dependency vulnerabilities
- [ ] Add E2E tests for session revocation, rate limiting, Zod validation responses, disabled user flow

### Phase 6 — File Attachments & Cyberpunk UI Overhaul
- [x] Secure local proxy downloads for encrypted attachments (no CORS/S3 public access needed)
- [x] Resolved S3 bucket existence checking log spam & silenced NotImplemented warnings
- [x] Dynamically render user profile avatar inside top navigation account dropdown button
- [x] Built interactive modern cyberpunk branding capsule card in admin layout sidebar
- [x] Implemented live backend connection diagnostics (DB ping, storage ping, RTT network latency, node timezone location) in admin analytics dashboard
- [x] Fixed Google OAuth "Provider not found" runtime bug by forwarding OAuth credentials to the docker app container environment
- [x] Resolved Content Security Policy avatar load blocks by proxying all S3/MinIO avatars through `src/app/api/avatars/[...slug]/route.ts` and adding Google profile image hosts to the CSP whitelist
- [x] Implemented database migration script to repair legacy direct MinIO URLs to app-relative proxy URLs across all user accounts

---

## Files Modified This Session

| File | Change |
|------|--------|
| `src/app/settings/account/page.tsx` | Redesigned Sign-in Methods layout, added OTP-based linking UI, and updated provider meta keys |
| `src/components/vault/DialogPreviews.tsx` | Redesigned ProfileBadgePreview to use a premium, secure badge design with microchip and personal settings vector |
| `src/components/layout/CommandPalette.tsx` | Passed dob and idNumber values to the DynamicPreviewCanvas inside command palette |
| `src/lib/linkOtpStore.ts` | Created in-memory OTP cache store with TTL expiration for user linking verification |
| `src/app/api/settings/link-password/send-otp/route.ts` | Created send-otp endpoint for sending password linking codes to signed-in emails |
| `src/app/api/settings/link-password/verify/route.ts` | Created verification endpoint that validates OTP and sets password in Better Auth |
| `src/app/api/settings/set-password/route.ts` | Deleted legacy direct password-setting endpoint |
| `src/lib/storage.ts` | Refined public URLs to use proxy path, decoupled backend S3 endpoint from frontend domain, added URL rewriter |
| `src/hooks/useAuth.ts` | Added client-side rewriter to `photoURL` session object mapping |
| `src/app/api/avatars/[...slug]/route.ts` | Created secure avatar file proxy endpoint that retrieves and streams images using server-side S3 client |
| `scripts/fix-avatar-urls.js` | Created pure Node.js migration script to clean up legacy MinIO URLs across database rows |
| `next.config.ts` | Updated CSP directives to allow Google avatar CDNs and use origin-relative image loading |
| `docker-compose.yml` | Added Google OAuth credentials, SMTP variables, and `MINIO_PUBLIC_URL` variable forwarding |
| `.env` | Configured production `MINIO_PUBLIC_URL` |
| `.env.example` | Documented and configured internal vs. public MinIO parameters |
| `src/components/layout/TopBar.tsx` | Dynamic profile photo url image rendering, and settings layout conditional search/generator hiding with premium branding |
| `src/app/admin/layout.tsx` | Cyberpunk bracket card, SVG mesh network float, exit return trigger |
| `src/app/admin/analytics/page.tsx` | Custom diagnostics gauges showing active latencies, ping timers, and locations |
| `src/app/api/admin/stats/route.ts` | Measure active DB query times, S3 connection pings, and resolved timezone zones |
| `src/app/api/vault/attachments/[id]/download/route.ts` | Proxy download streaming + custom decryption pipeline |
| `src/app/api/vault/attachments/[id]/route.ts` | Database query adjustments for attachments |
| `src/app/api/vault/attachments/route.ts` | Attachment metadata file uploads |
| `src/components/vault/NewEntryDialog.tsx` | Secure file attachments UI integration |
| `src/components/vault/PasswordHealth.tsx` | Graceful catch for intercepted HaveIBeenPwned network errors |
| `Dockerfile` | Updated container boot to run custom programmatic migrations |
| `README.md` | Rewrote Getting Started guide for Docker & Local setup with secret generation steps |
| `.github/workflows/docker-publish.yml` | Added GitHub Actions pipeline to compile code and push Docker images to GHCR |
| `scripts/migrate-production.js` | Created programmatic database migration script in plain JavaScript to prevent esbuild platform mismatch |



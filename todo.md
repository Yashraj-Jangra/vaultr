## Current Session: Mobile Web-Parity — Card Type Auto-Detect & Pattern Generator (2026-09-09)

### ✅ What Was Done

#### 1. Card Brand Auto-Detection & Other Network Parity (`mobile/src/screens/ItemFormScreen.tsx` & `mobile/src/components/ItemPreviewCard.tsx`)
- **Reactive Card Brand Auto-Detect**:
  - Imported `detectCardBrand` from `ItemPreviewCard` into `ItemFormScreen`.
  - Added `isManualBrand` tracking state to distinguish user-selected overrides from auto-detected values.
  - Implemented `useEffect([cardNumber, isManualBrand])` that reactively computes and updates the card brand (Visa, Mastercard, AMEX, Discover, RuPay) as digits are typed.
  - Set `isManualBrand = true` when editing existing card items that already have a saved brand to prevent overriding stored records.
  - In `CARD_NETWORKS` modal picker, picking a network sets `isManualBrand(true)` while selecting `"Auto-detect"` clears `isManualBrand`, allowing dynamic detection to resume.
- **"Other" Network Random Easter-Egg Strings**:
  - Enabled `"Other"` network option with randomized `fallbackIndex` picking easter egg strings (`["NOPE", "BRUH", "OOPS", "VOID", "LMAO", "FAKECARD"]`), achieving full parity with web's `NewEntryDialog`.
  - Added `fallbackBrand` prop to `ItemPreviewCardProps` and passed it down to `CreditCardVisual` in `ItemPreviewCard.tsx`.
  - Rendered `fallbackBrand` in emerald accent (`#34d399`) in the card preview header when `"Other"` network is active.
- **Credit Card Preview Number Centering**:
  - Centered credit card digits horizontally across the preview canvas (`numberWrap` with `width: "100%"`, `alignItems: "center"`, `justifyContent: "center"` and `numberText` with `textAlign: "center"`).

#### 2. Pattern Generator Mode (`mobile/src/screens/GeneratorScreen.tsx`)
- **4th Generator Mode Tab**:
  - Extended `Mode` union type to `"random" | "passphrase" | "pin" | "pattern"`.
  - Added `"Pattern"` tab to the mode tab bar.
- **Pattern Template Input & Computation**:
  - Imported `generatePattern` and `PatternOptions` from `@vaultr/core`.
  - Added `patternStr` state defaulting to `"ULL-ddd-SS"`.
  - Wired `generatePattern({ pattern: patternStr })` reactively inside `currentPassword` `useMemo`.
- **Token Legend & Monospace Controls**:
  - Added `Pattern Template` monospace input card with auto-capitalization and spellcheck disabled.
  - Created a 2-column token legend grid with color-coded token badges (`L` lowercase, `U` uppercase, `d` digit, `S` symbol, `*` any random, `- / _` literal).
  - Character colorization in output display seamlessly formats patterned strings.

---

## Current Session: Architecture Hardening, Security Sanitization & Best Practices (2026-09-08)

### ✅ What Was Done

#### 1. Credential Log Sanitization & Tooling Standards
- **`src/lib/auth/verifyUser.ts`**:
  - Removed insecure `console.log` statements leaking raw session cookies and bearer headers on incoming requests into server stdout.
  - Combined `disabled` and `role` checks into a single database select from `userProfiles`, including `role` directly in `UserPayload`.
- **`extension/src/background/service-worker.ts`**:
  - Cleaned up debug logging statements from background service worker initialization and lock operations.
- **`.editorconfig`**:
  - Added root `.editorconfig` standardizing `end_of_line = lf`, `charset = utf-8`, `indent_style = space`, `indent_size = 2`, and trailing whitespace trimming monorepo-wide.
- **Android Release Build v0.2.8 (`vaultr-v0.2.8-release.apk`)**:
  - Synchronized Android `defaultConfig` to `versionCode 8` and `versionName "0.2.8"`.
  - Automated versioned APK output naming (`vaultr-v${version}-${buildType}.apk`) in Gradle.
  - Successfully built signed standalone release APK (`mobile/android/app/build/outputs/apk/release/vaultr-v0.2.8-release.apk`).
  - Synced all 19 commits to remote origin (`main -> main`).

#### 2. Distributed OTP Persistence & API Rate Limiting
- **`src/lib/rateLimit.ts`**:
  - Implemented lightweight, zero-dependency sliding-window in-memory rate limiter with automated memory cleanup.
  - Generates RFC-compliant headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`).
  - Added client IP extraction supporting `x-forwarded-for`, `cf-connecting-ip`, and `x-real-ip`.
- **`src/lib/linkOtpStore.ts`**:
  - Migrated OTP store from transient in-memory `Map` to Postgres `verification` table (`identifier = "link_password:${userId}"`).
  - Guarantees OTP continuity across serverless cold-starts, horizontal multi-container instances, and process restarts.
- **`src/app/api/settings/link-password/send-otp/route.ts` & `verify/route.ts`**:
  - Wired rate limiting guards (3 send attempts / 10m, 5 verify attempts / 10m) to stop OTP email abuse and brute-force guessing.

#### 3. S3 Upload Rollback & Data Integrity Guards
- **`src/app/api/vault/attachments/route.ts`**:
  - Wrapped S3/MinIO upload and DB row creation in a transactional rollback block: if DB insert fails or throws, `deleteAttachment(s3Key)` immediately purges the orphaned storage object.
  - Mitigated TOCTOU quota race conditions by validating quota usage right before persistence.
- **`src/app/api/admin/users/route.ts`**:
  - Replaced dynamic `require("drizzle-orm")` inside IIFE with top-level static `import { inArray, sql } from "drizzle-orm"`.
  - Populated user `lastSignInTime` dynamically from `sessionMeta` table by grouping maximum `lastActiveAt` per user.
- **`src/lib/auth/verifyAdmin.ts`**:
  - Eliminated redundant second database query on `userProfiles` by evaluating `user.role === "admin"` directly from the pre-resolved `UserPayload`.
- **`src/app/api/vault/schedule-delete/route.ts`**:
  - Added direct 1-click cancellation CTA button and link to the scheduled deletion alert email.
  - Added rate limiting protection against automated deletion triggering.
- **`src/app/api/vault/folders/route.ts`**:
  - Clarified Postgres 1-based substring indexing and nested path delimiter extraction comments.

#### 4. Vault Context, Real-Time Sync & Health Page Optimization
- **`src/context/VaultContext.tsx`**:
  - Removed client-side chunking in `batchAction`, delegating batch processing to the server.
  - Implemented instant optimistic UI updates for `batchAction` across `purge`, `trash`, `restore`, `favorite`, `unfavorite`, and `move`.
  - Hardened `emptyTrash` to fetch fresh items before computing purge list, preventing accidental deletion of restored items caused by stale state.
  - Made `customFolders` `useState` initialization SSR-safe (`typeof window !== "undefined"` guard).
  - Implemented graceful reconnect with randomized jitter on SSE `stream_timeout` events.
- **`src/app/vault/health/page.tsx`**:
  - Stabilized `useEffect` analysis dependencies using an `itemsSignature` checksum, eliminating re-analysis loops on every 3-second SSE polling cycle.
  - Added `prefixCache` memoization for HIBP k-anonymity ranges, deduplicating external API requests for shared passwords.
  - Added 100ms throttle delay between distinct HIBP API calls to comply with rate limits.

---

## Current Session: Critical Stability, Crypto Unification & Parity Hardening (2026-09-08)

### ✅ What Was Done

#### 1. Extension TypeScript & Type-Safety Resolution
- **`extension/src/popup/App.tsx` & `extension/src/popup/VaultScreen.tsx`**:
  - Resolved `string | null | undefined` to `string | undefined` type mismatches for `folder` in `handleEditTrigger` and `domain` in `SiteIcon`.
  - Extension package TypeScript check now compiles with **0 errors**.

#### 2. Vault Items Deterministic Sort Order
- **`src/app/api/vault/items/route.ts`**:
  - Added `.orderBy(desc(sql`COALESCE(${vaultItems.updatedAt}, ${vaultItems.createdAt})`))` to the GET handler.
  - Guarantees newly created and updated entries are returned consistently across all clients.

#### 3. Security Settings Clipboard Timer Hydration
- **`src/app/settings/security/page.tsx`**:
  - Replaced eager `useState` localStorage lookup (which ran before `user?.uid` resolved, defaulting to 0) with a targeted `useEffect([user?.uid])` reader.
  - Clipboard auto-clear selection now reliably reflects the user's saved preference upon page load.

#### 4. Unified Cryptographic Implementation (@vaultr/core)
- **`src/hooks/useCrypto.ts`**:
  - Consolidated Web crypto routines onto `@vaultr/core`'s canonical `deriveKey`, `encrypt`, and `decrypt` functions.
  - Eliminated parallel duplicate crypto implementation, preventing algorithmic drift across web, mobile, and browser extensions.

#### 5. SSE Real-Time Stream Resource Leak Prevention
- **`src/app/api/vault/stream/route.ts`**:
  - Enforced a 5-minute maximum connection TTL (`MAX_STREAM_TTL_MS`) with self-closing timeout handler.
  - Closes zombie interval timers and polling cycles when clients terminate abruptly without sending an abort signal (clients automatically reconnect via EventSource).

#### 6. Mobile Deep Link Token Minimization
- **`src/app/api/auth/mobile-callback/route.ts` & `mobile/src/store/vaultStore.ts`**:
  - Removed PII (`email`, `name`, `avatarUrl`) from the deep link URL string (`vaultr://auth-callback`), passing only the necessary authentication `token` and `id`.
  - Removed dummy fallback email (`google-user@vaultr.local`); the mobile app securely fetches profile attributes post-auth via `/api/me`.

#### 7. Extension Entry Form Folder & Favorite Parity
- **`extension/src/popup/App.tsx`**:
  - Aggregated existing item folders with server folders into `combinedFolders` for the folder select picker.
  - Added `favorite` state propagation through `editingItem`, `handleEditTrigger`, `handleSaveItem`, and background service worker messaging.

---

### 📋 Planned Next Steps
1. **Automated End-to-End Testing**:
   - Add integration tests for `/api/vault/stream` connection timeout and reconnect behavior.
   - Add unit tests verifying cross-platform encryption/decryption round-trip between `@vaultr/core` and web hooks.
2. **Version Bump**:
   - Bump version to `0.2.8` (PATCH) across `package.json`, `packages/core`, `extension`, and `mobile` manifests upon user confirmation.

---

## Current Session: Public Repository Standardization, README Revamp & Artifact Cleanup (2026-08-18)

### ✅ What Was Done

#### Mobile Launcher Icon & Splash Screen Standardization
- **Android Adaptive Icon Centering & Safe-Zone**:
  - Recalibrated exact mathematical visual center matrix (`translate(500, 500) scale(S) translate(-420.4, -498.8)`) on SVG source coordinates, eliminating horizontal offset.
  - Set standard 66dp safe-zone scaling ($S=0.42$) on transparent 108dp canvas for `adaptive-icon.png` and `ic_launcher_foreground.webp`, guaranteeing zero clipping on circular, squircle, and rounded-square launchers.
  - Set solid icon scaling ($S=0.48$) and round icon scaling ($S=0.46$) on `#09090b` dark background.
- **1:1 Lock Shield Splash Screen**:
  - Replaced the wide 3.3:1 horizontal text logo with the standardized 1:1 centered **VaultR Lock Shield** brand mark across all Android density buckets (`drawable-mdpi` to `drawable-xxxhdpi` at 128px to 512px) and Expo splash configuration (`mobile/assets/splash.png`), eliminating splash screen stretching.
  - Updated `mobile/app.json` to point `splash.image` directly to `./assets/splash.png`.

#### Public Repository Documentation & README Overhaul
- **`README.md`**:
  - Rebuilt complete `README.md` to official open-source standards with GitHub theme-adaptive VaultR brand assets (`<picture>` dark/light logo switcher), curated amber/emerald/obsidian badges, visual feature showcase cards with SVG illustrations (`security_0ubl.svg`, `mobile-encryption_flk2.svg`, `cloud-sync_h1ig.svg`), zero-knowledge architectural diagrams, platform capabilities matrix, Docker Compose quickstart, and monorepo structural guides.
  - Removed outdated naming, deprecated sprint links, and stale references.
- **Removed Internal Scratch & Planning Files**:
  - Deleted internal tracking files (`FLAWS_AND_IMPROVEMENTS_AUDIT.md`, `ROADMAP.md`, `CREATIVE_IDEAS.md`).
  - Replaced internal sprint terminology with professional release phrasing in `src/app/admin/content/page.tsx`.

#### .gitignore Consolidation & Secret/Artifact Protection
- **Consolidated Root `.gitignore`**:
  - Added recursive directory rules for `backups/` and `backup/` across all root and sub-packages.
  - Added protection for database exports (`*.sql.gz`, `*.sql.tar.gz`, `*.dump`) and local SQLite databases/WAL logs (`*.sqlite`, `*.sqlite3`, `*.db`, `*.db3`, `*.db-wal`, `*.db-shm`, `*.db-journal`).
  - Added recursive ignore rules for Expo (`**/.expo/`, `**/.expo-shared/`), Android build outputs (`**/.gradle/`, `**/build/`, `local.properties`, `**/.cxx/`, `*.apk`, `*.aab`), iOS artifacts (`**/ios/Pods/`, `**/ios/build/`, `*.ipa`, `*.dSYM`), and Metro cache.
  - Hardened secrets & keystore filtering: ignored all cloud service accounts (`firebase_service_account*.json`, `service-account*.json`, `google-services.json`, `GoogleService-Info.plist`), private keys/certificates (`*.key`, `*.pem`, `*.crt`, `*.pfx`, `*.p12`, `id_rsa*`, `id_ed25519*`), and release signing keystores (`*.keystore`, `*.jks`).
  - Added browser extension artifacts (`extension/dist-*/`, `extension/web-ext-artifacts/`, `*.xpi`, `*.crx`, `extension/*.zip`).
  - Added test coverage and diagnostics (`playwright-report/`, `test-results/`, `blob-report/`, `cypress/`, `.nyc_output/`, `*.log`).
  - Added OS and IDE metadata (`Thumbs.db`, `ehthumbs.db`, `[Dd]esktop.ini`, `.idea/`, `.vscode/`, `*.swp`, `*.swo`, `*~`, `scratch/`).

#### Git Index Hygiene
- **Untracked Cached Backup & Build Files**:
  - Removed `backups/backup-2026-06-12T16-36-05-186Z.sql.gz`, `extension/dist.crx`, and `mobile/android/app/release.keystore` from Git cache index without touching local disk files.

## Current Session: VaultR 2026 Tablet Command Canvas, Responsive Dock & Folder Parity (2026-08-18)

### ✅ What Was Done

#### Universal Versioning & Build Metadata Architecture
- **`packages/core/src/version.ts` & `packages/core/src/index.ts`**:
  - Created universal single source of truth for versioning (`v0.2.7`), edition (`VaultR 2026`), build number (`2026.08.18`), build channel (`stable`), and cryptographic specification metadata.
  - Added build signature formatting helpers (`getAppVersionString`, `getBuildSignature`) and diagnostic payload types.
- **Synchronized Version Numbers across Manifests**:
  - Synchronously bumped root `package.json` (`0.2.7`), `packages/core/package.json` (`0.2.7`), `mobile/package.json` (`0.2.7`), `mobile/app.json` (version `0.2.7`, `versionCode: 7`), `extension/package.json` (`0.2.7`), and `extension/manifest.json` (`0.2.7`).
- **Interactive Release Notes & Changelog**:
  - Added `v0.2.7` release entry to `src/app/changelog/page.tsx` capturing tablet dock navigation, landscape dual-pane command dashboard, empty folder sync, and folder modification bug fix.

#### Mobile UI & Folder Navigation Refinements
- **`mobile/src/screens/VaultListScreen.tsx`, `mobile/src/screens/ItemFormScreen.tsx` & `mobile/src/store/vaultStore.ts`**:
  - Fixed bug where items could not be moved out of folders or changed to "No folder" (empty string evaluated to `undefined`, omitting the `folder` patch). Now sends `folder: null` to accurately clear or change folder association in both local cache and Postgres DB.
  - Enabled empty custom folder fetching and synchronization from `/api/vault/folders` upon vault unlocking (`unlock`), initial session restore (`initSession`), and background refresh (`fetchItems`).
  - Restored `"No folder"` (uncategorized entries) in the FOLDERS list with accurate live item counts and dedicated navigation filter.
  - Synchronized folder counter metrics (`FOLDERS (X)`) across both phone and tablet portrait/landscape dashboard stats cards.

#### Android Native Autofill Bottom Sheet & Suggestion Engine Overhaul
- **`AutofillSearchActivity.kt` & `activity_autofill_search.xml`**:
  - Rebuilt quick search as a smooth Android Bottom Sheet with rounded top corners, top drag pill handle, header, search bar, and empty state container.
  - Implemented strict context-filtered suggestions: when launched on a website or native app, displays **ONLY** matching credentials with an amber counter badge (`📍 Suggested for domain.com (X)`). If no credentials match, displays a clean empty state prompt rather than dumping the full vault.
  - Full vault search is instantly activated whenever the user enters a search query.
- **Keyboard Window Insets & Autofill Authentication Fixes**:
  - Removed `FLAG_ACTIVITY_NEW_TASK` from `PendingIntent`s in `VaultrAutofillService.kt` to allow `setResult(Activity.RESULT_OK, replyIntent)` to return the authenticated `Dataset` back to the calling app/browser.
  - Enabled `FLAG_MUTABLE` on Android 12+ so the Android OS Autofill framework can attach `AutofillManager.EXTRA_ASSIST_STRUCTURE`.
  - Added `StructureParser` fallback in `AutofillSearchActivity.kt` to ensure `usernameId`, `passwordId`, and `currentFocusedId` are always resolved.
  - Handled keyboard WindowInsets via `ViewCompat.setOnApplyWindowInsetsListener` to dynamically lift the bottom sheet above the software keyboard (`imeInsets.bottom`) and capped list max height so the search bar and results are fully visible while typing.

#### Web App Information Pages & Documentation Hub
- **`src/app/about/page.tsx`**:
  - Built comprehensive public **About VaultR 2026** page with hero illustration (`visionary-technology_f6b3.svg`), ambient glow, foundational architectural pillars, cross-platform client ecosystem matrix, and cryptographic specifications.
- **`src/app/changelog/page.tsx`**:
  - Built visual **Release Notes & Changelog** timeline with categorized badges (`Feature`, `Security`, `Performance`, `Mobile`, `Extension`, `Fix`), interactive platform filters, and complete milestone histories spanning all releases (`v0.2.4`, `v0.2.3`, `v0.2.2`, `v0.2.1`, `v0.2.0`, `v0.1.5`, `v0.1.0`).
- **`src/app/docs/page.tsx`**:
  - Built interactive **Documentation & User Guide Hub** with quick search, categorized topic guides (Quickstart, Crypto Spec, Self-Hosting Docker, Client Pairing, Import/Export), one-click code copy blocks, and responsive navigation.
- **`src/app/settings/about/page.tsx` & `src/app/settings/layout.tsx`**:
  - Added new **About & System** tab to Settings layout with live client telemetry (Browser/OS, WebCrypto SubtleCrypto availability check, storage quota estimate, active theme mode) and one-click "Copy Diagnostic Bundle" action.
- **Unified Branding & Header/Footer Navigation**:
  - Updated `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, and `src/app/security/page.tsx` with unified VaultR 2026 headers, badges, and cross-linking to `/docs` and `/changelog`.
  - Updated `src/app/page.tsx` hero badge to `"VaultR 2026 Edition · Zero-Knowledge · AES-256-GCM"` and enriched footer navigation and copyright.
  - Added subtle `VaultR 2026 v0.2.4` branding badges in `src/components/layout/Sidebar.tsx` and `src/components/layout/TopBar.tsx`.

#### Browser Extension Polish & Deep Linking
- **`extension/src/popup/SettingsScreen.tsx`**:
  - Integrated `VaultR 2026 v0.2.4 (Build 2026.08.16)` branding badge and AES-256-GCM verification pill.
  - Added **"VAULTR 2026 RESOURCES"** list linking directly to web documentation (`/docs`), changelog (`/changelog`), security architecture (`/security`), privacy policy (`/privacy`), and support (`/settings/support`).

#### Mobile App Polish & Deep Linking
- **`mobile/src/screens/SettingsScreen.tsx` & `mobile/src/lucide.d.ts`**:
  - Redesigned top user profile into an unboxed, prominent native header with larger 64px avatar, 20px bold typography, and removed card background border/link navigation.
  - Added **"VAULTR 2026 RESOURCES"** section launching in-app web browser sheets (`expo-web-browser`) for Docs, Changelog, Security Whitepaper, Privacy, and Help Desk.
  - Added **"SYSTEM & ABOUT"** section with tap-to-copy diagnostic signature and upgraded footer watermark.
- **`mobile/src/screens/VaultListScreen.tsx`, `VaultFilteredScreen.tsx` & `AuthenticatorScreen.tsx`**:
  - Unified FAB design across vault screens into standard circular buttons (`54×54`, `borderRadius: 27`, `bottom: 20`, `right: 20`).
  - Added matching circular Floating Action Button to the 2FA **Authenticator** page with `<Scan />` icon to immediately trigger camera QR code scanning.
  - Optimized the 2FA **Assign Modal**: changed "Create New Login Item" icon to `+`, added high-resolution `SiteIcon` favicons, decrypted and cached username/email sublabels, and replaced unvirtualized raw mappings with an optimized, lag-free `FlatList`.
- **`mobile/src/screens/ItemFormScreen.tsx`, `QrScannerModal.tsx` & `AuthenticatorScreen.tsx`**:
  - Replaced the key icon with the `<Scan />` icon on the 2FA QR code scanner trigger button in the add/edit item form, camera scanner header, and modal options.
- **`mobile/src/components/QrScannerModal.tsx`**:
  - Fixed 2FA camera QR scanner cutout overlay: converted multiple fragmented flexbox shade rows to a single continuous SVG mask with rounded `rx={16}` `ry={16}` cutout, eliminating horizontal subpixel light gaps and unshaded corner pixels.
- **`mobile/src/screens/UnlockScreen.tsx` & `src/components/vault/MasterPasswordPrompt.tsx`**:
  - Polished the Master Password unlock screen security logo and container div to dark aesthetic standards (`94×94px`, `rounded-2xl`, `#0d0d0d` background, `#27272a` border, `80px` lock logo, and smooth pulse halo with consistent background).
  - Maintained the centered flagship in-display fingerprint sensor with ambient breathing animation aligned with Samsung Galaxy ultrasonic sensor placement.
  - Implemented responsive keyboard adjustments to eliminate the Android bottom black strip gap and preserve immediate 1-tap visibility for the unlock button and helper links without scrolling.
- **Android Adaptive App Icons & Asset Standards**:
  - Rescaled Android adaptive icon (`adaptive-icon.png` & `ic_launcher_foreground.webp`) to official 66dp safe-zone standards (`0.44` scale), preventing clipping across circular, squircle, and rounded-square launchers.
  - Separated tight in-app UI lock assets from launcher icons and regenerated all Android mipmap densities (`mdpi` to `xxxhdpi`).
- **Android Security & Manifest Hardening**:
  - Removed risky unused permissions (`RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, legacy storage) and sanitized `accessibility_service_config.xml` (`flagDefault|flagIncludeNotImportantViews`) to prevent Play Protect heuristic false-positives and avoid triggering banking anti-fraud security guards.
  - Set default auto-lock background timeout to **5 minutes** in `mobile/src/services/autoLock.ts`.
- **`mobile/src/screens/settings/AutofillSettingsScreen.tsx`**:
  - Redesigned with dark aesthetic tokens, native Android autofill status indicators, quick settings tile guide, and a dedicated warning callout on the legacy accessibility fallback explaining banking/security app conflicts and recommending it be kept OFF.
- **Android Google OAuth Flow & Deep Link Resolution**:
  - Configured `vaultr://` scheme `intent-filter` on `MainActivity` in `mobile/android/app/src/main/AndroidManifest.xml`.
  - Added `WebBrowser.maybeCompleteAuthSession()` and `Linking` deep link listeners in `mobile/src/App.tsx` and `mobile/src/store/vaultStore.ts` to capture tokens across browser dismissals and app switches.
  - Enhanced server `/api/auth/mobile-callback` with PostgreSQL session/cookie fallback and auto-redirect support.
  - Resolved `state_mismatch` error by creating `/api/auth/mobile-start` endpoint and launching Custom Tabs directly from the server to guarantee state cookies are preserved in the browser context across proxies, localhost, and production.
- **Mobile Account Settings Redesign & Avatar Visibility**:
  - Segregated Storage Usage and Personal Details into dedicated, standalone cards. Added an explicit `Optional` badge pill to the Personal Details section.
  - Enhanced `/api/auth/mobile-callback` and `handleAuthRedirectUrl` to propagate `image` and `avatarUrl` from OAuth and DB profiles, and added image load error fallback recovery across mobile screens.
- **Accurate Storage Usage Engine (Server, Web & Mobile)**:
  - Updated `/api/vault/profile`, `/api/me`, and `/api/auth/me` to compute live real-time storage used by aggregating all non-deleted vault attachments (`vault_attachments.size_bytes`) and encrypted item payloads (`vault_items.encrypted_blob`), auto-updating cached profile storage values.
  - Replaced hardcoded storage value in mobile `AccountSettingsScreen.tsx` with dynamic server profile loading and local loaded item size fallback calculation.
- **Account Dropdown Menu Polish**:
  - Renamed "Profile" to "Settings" with a Lucide `Settings` gear icon in `src/components/layout/TopBar.tsx`.
- **2FA Favicon & Countdown Ring Sizing**:
  - Scaled up 2FA site favicons to fit snugly and boldly inside circular countdown sync rings across mobile (`TotpCode.tsx`, `SiteIcon.tsx`) and web (`src/app/vault/authenticator/page.tsx`). Added `borderless` support to prevent inner double-border clipping.

- **Mobile Native Autofill & Biometric Unlock Bridge**:
  - Upgraded `VaultrAutofillService.kt` to present both dropdown menu items and **inline keyboard suggestion chips** (Gboard, Samsung Keyboard) across all API levels (API 26 to API 35).
  - Implemented locked vault detection: displays "🔒 Vault is locked" with tap-to-unlock on both dropdown and keyboard strip, automatically routing into `AutofillSearchActivity` and launching biometric authentication in `MainActivity`.
  - Implemented unlocked vault detection: directly presents matched credentials with 1-tap fill and always appends a "VaultR" search option at the end.
  - Upgraded `AutofillSearchActivity.kt` to handle native Android autofill authentication intents (`EXTRA_IS_AUTOFILL_REQUEST`) and construct/return native `Dataset`s (`EXTRA_AUTHENTICATION_RESULT`) directly to the OS framework, bypassing accessibility service requirements for direct injection.
  - Implemented `VaultrAutofillModule.kt` broadcast triggers (`com.vaultr.mobile.AUTOFILL_UNLOCKED`) and `finishAutofillUnlock()` lifecycle bridge in `UnlockScreen.tsx` to automatically minimize the app and return to the search sheet upon successful biometric/master password decryption.

- **Universal Card Expiry & Network Auto-Detection Parity**:
  - Enhanced `importer.ts` (`normalizeExpiry`, `normalizeExpiryParts`, `parseBitwardenJson`, `mapCsvRow`) to handle split Bitwarden fields (`expMonth: "8"`, `expYear: "2029"`, `expirationMonth`, `expirationYear`, `month`, `year`) and ISO/slash variants (`YYYY-MM`, `MM/YY`, `MM/YYYY`).
  - Added `extractExpiryParts` in `NewEntryDialog.tsx` and full state re-synchronization on `initialData` changes when opening Edit mode on the web.
  - Added onBlur validity checks (`01–12` month check, `YY/YYYY` year check with red highlight error hints) to `ItemFormScreen.tsx` on Mobile matching the website UX.
  - Standardized card persistence on both web and mobile to save both combined `expiry` ("MM / YYYY") and normalized individual `expMonth` ("MM") and `expYear` ("YYYY") fields.
  - Implemented `detectCardBrand` utility and dynamic network resolution across web card visual previews and details view to eliminate "Auto-detect" reset bugs.

## Current Session: VaultR 2026 Dashboard Generator Integration, Mobile UI/Icon Scaling & UI Parity (2026-08-17)

### ✅ What Was Done

#### Web Vault Generator Dashboard Integration & Color Highlighting
- **Integrated `/vault/generator` Route**:
  - Replaced isolated standalone generator page with an in-dashboard experience preserving active sidebar, top bar, cryptographic master session, and search command palette.
  - Linked Wand icons in `TopBar.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, and `CommandPalette.tsx` directly to `/vault/generator`.
  - Added 1-click **"Save to Vault as New Item"** action that pre-fills `NewEntryDialog` and persists encrypted entries in zero-knowledge.
  - Updated session history items with a 1-click **"Use in Vault"** action.
- **Continuous Syntax-Highlighted Character Output**:
  - Refactored character color-coding from isolated boxed divs to a continuous, sleek monospace string with differentiated syntax colors (lowercase: light neutral, uppercase: cyan blue, digits: amber gold, symbols: rose coral).

#### Universal Versioning & Landing Page Polish
- **Dynamic Version Binding**: Bound all `/about`, `/docs`, `/changelog`, TopBar, and Sidebar version tags to `VAULTR_VERSION` (`0.2.6`).
- **Landing Page Polish**: Updated step connector line to a sleek continuous 1px rule, smoothed FAQ accordion transitions, and updated illustration to `question-answered_ezyn.svg`.

#### Mobile Icon & Logo Scaling Parity
- **In-App Logos & Header Branding**:
  - Scaled header brand logos across `VaultListScreen` (`138×32px`), `SettingsScreen` (`98×26px`), `AuthScreen` (`115×24px`), and `UnlockScreen` (`105×22px`).
- **Item Icons & Favicons**:
  - Scaled baseline `SiteIcon` and list item badge boxes to `38×38px` with `22px` iconography and `90%` image fill.
- **Android Adaptive Launcher Assets**:
  - Scaled adaptive icon foreground glyph in `adaptive-icon.png` and `ic_launcher_foreground.webp` (from 31.6% to 48.7% canvas fill) to match official Android circular/squircle mask proportions.

#### Web Vault UI Polish & Default Folders State
- **Minimal Credential Fields**: Restructured `NewEntryDialog.tsx` login fields to be clean and minimal directly on the modal surface, eliminating nested container boxes and aligning the `Generate ⌘G` trigger.
- **Default Closed Folders in All Items View**: Configured `/vault` (All Items view) to keep all custom folders (including nested folders) closed/collapsed by default, while keeping the **Uncategorized** group open and visible by default.
- **Compact & Colorized Inline Password Generator**: Redesigned dialog inline password generator widget to be slim, sleek, and compact (removed Passphrase tabs, added character syntax coloring, streamlined inline copy/regen/use actions, and added compact length slider with character set toggles).
- **High-Contrast Slider Track & Label Styling**: Upgraded length slider with a crisp white progressive fill track, white handle thumb, and bright `text-neutral-100` label for clear visibility against dark backgrounds.
- **Spotlight Search Live Preview & Edit Integration**: Fixed card visual preview in `CommandPalette.tsx` by passing raw decrypted numbers to prevent premature digit masking from breaking brand auto-detection (Visa, Mastercard, AMEX, RuPay, Discover), added 1-click **Edit** (`<Edit2 />`) and **Open** actions to the live preview header and hover search rows, supported `/vault?edit=ID` param to open the edit dialog directly, and added quick copy pills (Username, Password, Card Number, CVV, Note).
- **Synchronized Search Result Indexing**: Fixed index-ordering desync in `CommandPalette.tsx` by structuring `allResults` to match the exact template group sequence (`Logins -> Cards -> Notes -> Addresses -> Profiles -> Quick Actions`), eliminating selection and live preview inversion between different item types.
- **Smooth Scroll & Auto-Expansion on Search Open**: Enhanced `/vault` router handler to automatically expand any collapsed parent/ancestor folders when opening an item from search, smoothly scroll the viewport to center the target element, and apply a subtle focus ring highlight.

#### Tablet & Landscape Adaptive Layout for Mobile Client
- **Universal Responsive Hook (`mobile/src/utils/responsive.ts`)**:
  - Implemented `useResponsive()` with breakpoint thresholds (`BREAKPOINTS`), real-time orientation detection (`isLandscape`), tablet detection (`isTablet`), and 2-column split layout activation (`isSplitView`).
- **Standardized Card Preview Aspect Ratio (`mobile/src/components/ItemPreviewCard.tsx`)**:
  - Wrapped visual preview in a container with `maxWidth: 380, width: "100%", alignSelf: "center"`, preserving the standardized `1.586` card aspect ratio across all screen sizes and preventing distortion on tablets.
- **2-Column Split View in Item Detail (`mobile/src/screens/ItemDetailScreen.tsx`)**:
  - In landscape/tablet mode, displays a balanced 2-column view: Left column houses the fixed `ItemPreviewCard`, template badge card, and website launch action; Right column houses scrollable credentials, 2FA TOTP code, custom fields, and security audit metadata.
- **2-Column Split View in Item Form (`mobile/src/screens/ItemFormScreen.tsx`)**:
  - In landscape/tablet mode, displays the live preview canvas and entry type pills in the left column, with form input fields and attachment dropzone in the scrollable right column.
- **2-Column Split View in Password Generator (`mobile/src/screens/GeneratorScreen.tsx`)**:
  - In landscape/tablet mode, displays mode tabs, colorized output card, strength meter, and copy/regenerate actions on the left, with length slider, character toggles, presets, and generation history on the right.
- **Adaptive Multi-Column TOTP Grid (`mobile/src/screens/AuthenticatorScreen.tsx`)**:
  - Automatically arranges 2FA verification code cards into a clean 2-column grid on tablets and landscape orientations.
- **Adaptive Vault Dashboard Layouts for Tablets & Phones (`mobile/src/screens/VaultListScreen.tsx`)**:
  - **Portrait Mode (Phone & Tablet)**: Formatted into a clean, centered single-column layout (max-width 580px on tablets) with natural mobile hierarchy: Favourites, Category Types, Collapsible Folder Tree, and Trash.
  - **Landscape Mode (Tablets & Wide Screens)**: Redesigned into a purpose-built dual-pane Command Dashboard with Category Types, Folder Tree, and Trash on the left, and a Vault Status/Quick Action Hub, 2-column Favourites Card Grid, and Recent Activity list on the right.
- **Minimal Compact Tablet Left Navigation Rail (`mobile/src/navigation/MainTabs.tsx`)**:
  - Refined tablet rail into a sleek, 72px compact dock: vertically centered navigation tab stack, removed top brand clutter, polished active dark card indicators with subtle elevation, muted inactive items, and integrated a dedicated bottom red-tinted lock button (`#f87171` / `rgba(239, 68, 68, 0.08)`).
- **Tablet Master Password Screen Keyboard Stability (`mobile/src/screens/UnlockScreen.tsx`)**:
  - Prevented the Master Password unlock card, lock logo, and typography from abruptly jumping up or shrinking when opening floating/split keyboards on tablets (`isTablet`), keeping the unlock card smoothly centered and fixed in place.
- **Resolved TSX Syntax & Component Returns Across Mobile Screens (`ItemDetailScreen.tsx`, `GeneratorScreen.tsx`, `VaultListScreen.tsx`)**:
  - Cleaned up duplicated return hierarchies and store handler references, achieving clean compilation with 0 errors across all mobile packages.

---

### 📌 What's Next
- Re-verify cross-platform file attachment roundtrips (upload on Mobile -> download on Web, upload on Web -> download on Mobile).
- Test native autofill behavior across different browser apps (Chrome, Firefox, Brave) and native login screens.
- Polish mobile autofill sheet UI and empty state illustrations.





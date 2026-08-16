# Vaultr — Project Tracker

## Current Session: VaultR 2026 Mobile Refinement, Live Storage Engine & UI Parity (2026-08-16)

### ✅ What Was Done

#### Universal Versioning & Build Metadata Architecture
- **`packages/core/src/version.ts` & `packages/core/src/index.ts`**:
  - Created universal single source of truth for versioning (`v0.2.5`), edition (`VaultR 2026`), build number (`2026.08.16`), build channel (`stable`), and cryptographic specification metadata.
  - Added build signature formatting helpers (`getAppVersionString`, `getBuildSignature`) and diagnostic payload types.
- **Synchronized Version Numbers across Manifests**:
  - Synchronously bumped root `package.json` (`0.2.5`), `mobile/package.json` (`0.2.5`), `mobile/app.json` (version `0.2.5`, `versionCode: 5`), `extension/package.json` (`0.2.5`), and `extension/manifest.json` (`0.2.5`).
- **Interactive Release Notes & Changelog**:
  - Added `v0.2.5` release entry to `src/app/changelog/page.tsx` capturing Google OAuth proxy resilience, DB storage aggregation, 2FA camera SVG mask cutout, and UI polish.

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

---

### 📌 What's Next
- Re-verify cross-platform file attachment roundtrips (upload on Mobile -> download on Web, upload on Web -> download on Mobile).
- Finalize mobile autofill settings & biometric integration audits.
- Polish mobile autofill sheet UI and empty state illustrations.

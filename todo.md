# Vaultr — Project Tracker

## Last Session: Android Autofill & Quick Settings Overhaul (2026-08-15)

### ✅ What Was Done

#### Android Autofill Framework & Keyboard Integration
- **`autofill_service_config.xml`** — Added `android:supportsInlineSuggestions="true"`, enabling OS-level handshake with Samsung Keyboard & Gboard.
- **`VaultrAutofillService.kt`** — Implemented Android 13+ (API 33+) `Dataset.Builder(Presentations)` and bound `setPresentations(presentations)` directly to individual `Field.Builder` instances for rock-solid inline chips.
- **`build.gradle`** — Integrated `androidx.autofill:autofill:1.1.0` and `InlineSuggestionUi` for modern keyboard strip rendering.

#### Minimal & Sleek Quick Settings Autofill Sheet
- **`AutofillSearchActivity.kt`** — Clean, card-free, unboxed design:
  - **1-Tap Direct Fill**: Tapping anywhere on an account row immediately injects credentials into the active page/app and dismisses the sheet.
  - **3-Dot Overflow Menu (`⋮`)**: Opens a native dark popup menu with **Copy Username**, **Copy Password**, and **Autofill Now**.
  - **Context-Aware Header**: Shows subtle amber label (`📍 Suggested for google.com`) when on an active webpage or app.
  - **Backdrop Dismissal**: Tapping outside the sheet immediately dismisses and returns focus to the underlying app without touching Vaultr's main stack.
- **`VaultrAccessibilityService.kt`** — Live browser domain extraction, reliable delayed window fill sequencing, and robust input node detection.
- **`activity_autofill_search.xml` & `item_autofill_search_row.xml`** — Minimalist surface layout, dark theme (`#0c0d12`), rounded pill search box, clean letter avatars, and zero container clutter.
- **`AndroidManifest.xml`** — Isolated task affinity (`android:taskAffinity=""`, `noHistory="true"`) to prevent launching `MainActivity`.

#### Mobile Sync System (complete)
- **`mobile/src/services/sync.ts`** — Stripped offline queue logic. User-scoped encrypted cache only.
- **`mobile/src/services/connectivity.ts`** — Zero-dependency connectivity probe service.
- **`mobile/src/store/vaultStore.ts`** — Added `isOnline` state, graceful offline read-only fallback, and strict write guards.

#### Builds & Verification
- Mobile Kotlin / Gradle: `gradlew.bat :app:compileDebugKotlin` → **BUILD SUCCESSFUL (0 errors)**
- Mobile TypeScript: `npx tsc --noEmit` → **0 errors**
- Web App TypeScript: `npx tsc --noEmit` → **0 errors**

---

## 🔜 Next Steps

1. **Verify Quick Settings Tile on device**:
   - Open a login page in Samsung Internet / Chrome / App → swipe down shade → tap "Vaultr Autofill" → tap row to 1-tap fill or tap `⋮` for copy actions.
2. **E2E testing of offline flow on physical Android device**:
   - Lock device network → unlock vault → verify read-only mode + amber banner.
   - Restore network → tap Retry → verify auto-refresh and write re-enable.
3. **Import edge cases** on mobile (large CSV files with 1000+ entries).

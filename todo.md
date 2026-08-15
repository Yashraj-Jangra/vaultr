# Vaultr — Project Tracker

## Last Session: Android Autofill & Master Password Verification Fix (2026-08-15)

### ✅ What Was Done

#### Web Master Password Verification & Shake Animation
- **`src/context/VaultContext.tsx`** — Fixed `unlock()`:
  - Previously returned a string message (`return msg;`) instead of throwing, which prevented `MasterPasswordPrompt.tsx`'s `try/catch` block from catching incorrect passwords.
  - Now checks available items (or fetches from `/api/vault/items` if not yet loaded) and throws `new Error("Incorrect master password.")` on decryption failure.
- **`src/components/vault/MasterPasswordPrompt.tsx`** — Attached `passwordInputRef` to auto-select input text and properly increments `setShakeKey(k => k + 1)` on error, triggering the CSS `.animate-shake` animation.

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

#### Builds & Verification
- Web App TypeScript: `npx tsc --noEmit` → **0 errors**
- Mobile Kotlin / Gradle: `gradlew.bat :app:compileDebugKotlin` → **BUILD SUCCESSFUL (0 errors)**
- Mobile TypeScript: `npx tsc --noEmit` → **0 errors**

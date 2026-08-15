# Vaultr — Project Tracker

## Current Session: Cross-Platform File Attachments & Expo FileSystem Migration (2026-08-16)

### ✅ What Was Done

#### Universal Binary File Encryption & Cross-Platform Parity
- **`packages/core/src/crypto.ts`**:
  - Fixed `encryptBinary` and `decryptBinary` to use native `SubtleCrypto` directly when a non-extractable `CryptoKey` is passed (Web), avoiding `exportKey` crashes.
  - Retained `@noble/ciphers` AES-GCM fallback for Hermes / React Native (`Uint8Array` keys).
  - Ensured matching wire format: `[12-byte IV] + [AES-GCM ciphertext]`.
- **`src/components/vault/NewEntryDialog.tsx`**:
  - Unified web upload to read raw bytes via `file.arrayBuffer()` and encrypt with `encryptBinary`.
  - Fixed web download to read `res.arrayBuffer()` and decrypt with `decryptBinary`, resolving UTF-8 `res.text()` corruption.
- **`src/app/vault/page.tsx`**:
  - Threaded `cryptoKey` through `ExpandedDetails` and `AttachmentRow` for item detail downloads.

#### Mobile File System & Scoped Storage Hardening
- **`mobile/src/store/vaultStore.ts`**:
  - Resolved `content://` URI permission lockouts on Android 14–16 by staging picked media files to app cache via `FileSystem.copyAsync` before reading.
  - Stripped whitespaces/newlines from `base64ToUint8Array` to eliminate AES-GCM invalid tag errors caused by Hermes/Android chunked base64 formatting.
- **`mobile/src/screens/ItemDetailScreen.tsx`**:
  - Implemented decrypted file staging to local cache and integrated `expo-sharing` (`Sharing.shareAsync`) for native Android/iOS file save/share sheet.
  - Switched imports to `expo-file-system/legacy` to comply with Expo SDK 52-54+ deprecation of top-level async methods.
- **`mobile/src/screens/ItemFormScreen.tsx` & `mobile/src/screens/settings/DataScreen.tsx`**:
  - Updated `expo-file-system` imports to `expo-file-system/legacy`.

### 📌 What's Next
- Re-verify cross-platform file attachment roundtrips (upload on Mobile -> download on Web, upload on Web -> download on Mobile).
- Finish mobile autofill settings & biometric integration audits.
- Review design aesthetics for mobile autofill sheets and empty states.

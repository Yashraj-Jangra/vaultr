# Vaultr — Project Tracker

## Last Session: Mobile Sync Overhaul (2026-08-15)

### ✅ What Was Done

#### Mobile Sync System (complete)
- **`mobile/src/services/sync.ts`** — Stripped all offline queue logic (`queueOfflineAction`, `flushOfflineQueue`, `PendingAction`). Now only provides user-scoped encrypted cache: `cacheVaultItems(items, userId)`, `getCachedVaultItems(userId)`, `clearCachedVaultItems(userId)`.
- **`mobile/src/services/connectivity.ts`** — New zero-dependency connectivity probe service. `probeServerConnection(url)` with 4s timeout. `startConnectivityMonitor()` uses AppState foreground events + 15s polling interval.
- **`mobile/src/store/vaultStore.ts`** — Major refactor:
  - Added `isOnline: boolean` and `checkConnection(): Promise<boolean>` to state.
  - `unlock()`: parallel key derivation + server fetch; graceful fallback to cache when offline.
  - All write actions (`createItem`, `updateItem`, `trashItem`, `restoreItem`, `deleteItem`, `toggleFavorite`, `batchAction`, `addCustomFolder`, `renameFolder`, `deleteFolder`, `reencryptAllItems`, `uploadAttachment`, `deleteAttachment`, `bulkImportItems`) throw immediately when `!isOnline`.
  - `startConnectivityMonitor()` started in `initSession()`.

#### Mobile UI Guards (complete)
- **`VaultListScreen.tsx`** — Offline amber banner with "Retry" button. FAB disabled and shows alert when offline.
- **`ItemDetailScreen.tsx`** — Edit, trash, favorite actions guarded; edit/trash icons dim when offline.
- **`ItemFormScreen.tsx`** — `handleSave` checks `isOnline` as first guard.
- **`TrashScreen.tsx`** — Restore, restore-all, delete, empty-trash all guarded.
- **`DataScreen.tsx`** — `handleConfirmImport` guarded.
- **`FolderManagerScreen.tsx`** — `addCustomFolder`, `renameFolder`, `deleteFolder` guarded.

#### Android Autofill Service, Inline Keyboard & Quick Panel (complete)
- **`StructureParser.kt`** — Strict classification eliminating false-positive popups on non-login fields (search bars, URL address bars, message composers, and chat inputs).
- **`VaultrAutofillService.kt`** — Implemented Android 11+ Gboard inline suggestion slices with full metadata (title, summary, icon) and a "🔒 Unlock Vaultr" authentication dataset flow when the vault is locked.
- **`VaultrTileService.kt`** — Native Android Quick Settings Tile (`android.service.quicksettings.TileService`) allowing 1-tap quick autofill from the top pull-down shade.
- **`AutofillSearchActivity.kt`** — Native translucent dark search overlay with live filter, 1-tap copy username/password, and 45-second secure clipboard auto-clear.
- **`AutofillCredentialStore.kt`** — Hardware-encrypted in-memory & SharedPreferences cache with subdomain normalization and package-to-domain mapping.
- **`VaultrAccessibilityService.kt`** — Accessibility fallback for stubborn apps and hybrid WebViews.
- **`AutofillSettingsScreen.tsx`** — Dashboard with active provider status, capability badges, and interactive matcher test tool.

#### TypeScript & Gradle Build
- Mobile Kotlin / Gradle: `gradlew.bat :app:compileDebugKotlin` → **BUILD SUCCESSFUL**
- Mobile TypeScript: `npx tsc --noEmit` → **0 errors**
- Web App TypeScript: `npx tsc --noEmit` → **0 errors**

---

## 🔜 Next Steps

1. **E2E testing** of offline flow on physical Android device:
   - Lock device network → unlock vault → verify read-only mode + amber banner.
   - Restore network → tap Retry → verify auto-refresh and write re-enable.
2. **iOS testing** — same flow on Expo Go iOS if device available.
3. **Import edge cases** on mobile:
   - Bitwarden CSV with 1000+ entries — confirm chunked import progress.
   - File with all duplicates + `conflictMode=skip` → should show "all skipped" info.
4. **FolderManagerScreen offline guard UI** — currently only throws on action; consider adding a visible banner there too (low priority).
5. **`SecuritySettingsScreen`** — re-encrypt vault flow; check if online guard is needed (it throws from `reencryptAllItems` in store, but UI could be clearer).

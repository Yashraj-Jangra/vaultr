## Current Session: Swipe Gesture to Flip Credit Cards (Issue #5) (2026-09-11) · Branch: `dev`

### ✅ What Was Done

#### 1. Mobile 3D Swipe to Flip Gesture (`mobile/src/components/Interactive3DCard.tsx`, `mobile/src/App.tsx`)
- Wrapped root in `<GestureHandlerRootView>` in `mobile/src/App.tsx` for gesture lifecycle support.
- Implemented `Gesture.Pan()` in `Interactive3DCard` with continuous horizontal translation-to-degree mapping:
  - Configured `activeOffsetX([-10, 10])` and `failOffsetY([-16, 16])` so vertical scroll in `ItemDetailScreen` is completely unimpeded.
  - Added real-time 3D perspective tilt (`rotateX`, `rotateY`), dynamic elevation (`scale: 1.03`), dynamic shadow casting, and dynamic rim highlights.
  - Bidirectional flip mechanics: flick velocity (`|vx| > 350`) or midpoint angle (`|delta| > 35°`) triggers physics spring settling (`withSpring`).
  - Added native haptic feedback (`Vibration.vibrate(12)`) on snap.
  - Maintained accessible tap-to-flip fallback (<8px movement) and flip button pill below card.
  - Normalized backface visibility and z-index switching to eliminate mirror rendering flicker.

#### 2. Web 3D Swipe & Drag to Flip Gesture (`src/components/vault/DialogPreviews.tsx`, `src/app/vault/page.tsx`, `src/components/vault/NewEntryDialog.tsx`)
- Extracted `DetailedCardFrontFace` and built `DetailedCardBackVisual` for Web with 100% design parity:
  - Realistic magnetic stripe across top with gloss reflection bar.
  - Signature strip with cardholder name and signature label.
  - CVV box showing real CVV when revealed (`isNumberVisible ? cvv : "•••"`).
  - 256-Bit AES-GCM security badge and zero-knowledge legal disclaimer.
  - Bottom row with "VAULTR ZERO-KNOWLEDGE" watermark and "SECURITY SEAL" hologram.
- Implemented Pointer Events gesture tracker in `DetailedCardVisual`:
  - 1:1 real-time drag tracking with `touch-pan-y` allowing smooth modal scrolling while capturing horizontal swipes.
  - Directional continuous rotation with Apple-like spring cubic-bezier transition (`cubic-bezier(0.16, 1, 0.3, 1)`).
  - Aligned animation directions so swiping left flips left and swiping right flips right across both Mobile and Web.
  - Tap-to-flip and flip button pill below card.
- Wired `cvv` and `isNumberVisible` props through `CreditCardGraphic` in `src/app/vault/page.tsx` and `DynamicPreviewCanvas` in `src/components/vault/NewEntryDialog.tsx`.

### 📋 What's Planned Next
- Verify UI behavior across Web and Mobile.
- Prepare version bump if ready.

---

## Previous Session: Custom Field Type Toggle for All Templates (2026-09-11) · Branch: `dev`

### ✅ What Was Done

#### 1. Added Custom Field Type Toggle (Text or Secret) to All Templates on Web App
- **Scope**: Site only (`src/components/vault/NewEntryDialog.tsx`), with no modifications to mobile app.
- **Implementation**:
  - Extracted a reusable, accessible `CustomFieldsSection` component supporting dynamic type switching between `"text"` and `"hidden"`.
  - Added the toggle button (`Lock` / `Secret` vs `FileText` / `Text`) with interactive active/surface styling.
  - Automatically rendered `SecretInput` (with eye show/hide mask toggle) when field type is `"hidden"`, and standard `Input` when `"text"`.
  - Replaced hardcoded password inputs and missing toggle controls across all templates:
    - `template === "login"`: Refactored to use `CustomFieldsSection`.
    - `template === "card"`: Replaced hardcoded password input with `CustomFieldsSection`.
    - `template === "address"`: Replaced hardcoded password input with `CustomFieldsSection`.
    - `template === "profile"`: Replaced hardcoded password input with `CustomFieldsSection`.
    - `template === "note"`: Added `CustomFieldsSection` below Secure Note textarea.
    - Bento layout (`renderBentoFields`): Replaced hardcoded password input with `CustomFieldsSection` (with `scrollable` and `showEmptyState` options).
  - Verified `handleSave` correctly persists `type: f.type || "text"` across all templates and `DetailRow` masks hidden custom fields in the vault view.

### 📋 What's Planned Next
- Work on Issue #5: Swipe gesture to flip credit cards.
- Test and verify across platforms.

---

## Previous Session: Unify Card Fields Into Single Division (2026-09-11) · Branch: `dev`

### ✅ What Was Done

#### 1. Unified All Card Information Fields into Single Division
- **Rationale**: Previously, card fields were split across two separate divisions: `CARD DETAILS` (Name, Number) and `SECURITY & VALIDITY` (Expiry, CVV, PIN). All card info fields are now unified into a single clean `CARD DETAILS` group, keeping `PRIVATE NOTES` and `CUSTOM FIELDS` in their own separate sections.
- **Mobile (`mobile/src/screens/ItemDetailScreen.tsx`)**:
  - Unified Cardholder Name, Card Number, Expiry Date, CVV, and PIN into a single `CARD DETAILS` section group.
  - Dynamically adjusted divider flags across all card rows.
- **Website (`src/app/vault/page.tsx`)**:
  - Unified Name, Number, Expiry, CVV, and PIN under a single `<SectionGroup title="CARD DETAILS">`.
  - Maintained `CUSTOM FIELDS` and `PRIVATE NOTES` as separate sections below.
- **Extension (`extension/src/popup/VaultScreen.tsx`)**:
  - Combined Cardholder, Number, Expires, CVV, and PIN into a single `<div className="detail-section-group">` with `CARD DETAILS`.
  - Retained separate custom fields and notes divisions.

### 📋 What's Planned Next
- Work on Issue #5: Swipe gesture to flip credit cards.
- Test and verify across platforms.

---

## Previous Session: Dynamic Rotating "Other" Card Network Names (Issue #7) (2026-09-11) · Branch: `dev`

### ✅ What Was Done

#### 1. Dynamic Rotating Random Names for "Other" Card Network (Web & Mobile)
- **Core Package (`packages/core/src/types.ts`)**:
  - Exported canonical `DEFAULT_CARD_EASTER_EGGS` matching the site's default list:
    `["NOPE", "BRUH", "OOPS", "VOID", "LMAO", "FAKECARD", "UH-OH", "MYSTERYCARD", "GUESSWORK", "WHATEVERCARD", "ANXIETY EXPRESS", "ALIEN EXPRESS"]`.
  - Added `fallbackBrand?: string;` to `DecryptedCardPayload`.
  - Implemented `getRandomEggIndex(currentIndex: number | null, count: number): number` helper guaranteeing that whenever "Other" is re-selected from the dropdown, it selects a different random egg without colliding with the current egg name.
- **Site Configuration (`src/lib/site-config.ts`)**:
  - Replaced hardcoded array with `DEFAULT_CARD_EASTER_EGGS` from `@vaultr/core`.
- **Web App (`src/components/vault/NewEntryDialog.tsx`, `src/app/vault/page.tsx`)**:
  - Updated both Split and Bento layout `Select` network controls to call `getRandomEggIndex(prev, eggs.length)` on "Other" selection.
  - Initialized `fallbackIndex` from `initialData?.payload?.fallbackBrand` on edit load.
  - Persisted `fallbackBrand` in decrypted payload on save when `effectiveBrand === "Other"`.
  - Passed `fallbackBrand` to `DetailedCardVisual` in `src/app/vault/page.tsx` for saved cards in vault view.
- **Mobile App (`mobile/src/store/vaultStore.ts`, `mobile/src/screens/ItemFormScreen.tsx`, `mobile/src/screens/ItemDetailScreen.tsx`)**:
  - Added `fetchSiteConfig` and `cardEasterEggs` to `useVaultStore`, dynamically fetching `/api/config/site` from the connected server (with `DEFAULT_CARD_EASTER_EGGS` fallback).
  - Wired `ItemFormScreen` to use fetched `cardEasterEggs` and `getRandomEggIndex` whenever "Other" is selected in the network picker.
  - Initialized `fallbackIndex` from `payload.fallbackBrand` when editing existing cards.
  - Persisted `fallbackBrand` in `unencryptedPayload` when saving "Other" cards.
  - Passed `fallbackBrand` to `ItemPreviewCard` in `ItemDetailScreen.tsx`.

### 📋 What's Planned Next
- Work on Issue #5: Swipe gesture to flip credit cards.
- Test and verify across platforms.

---

## Previous Session: Remove Redundant Card Network from Detail Views (Issue #4) (2026-09-11) · Branch: `dev`

### ✅ What Was Done

#### 1. Removed Redundant Card Network Row Across All Detail Views
- **Rationale**: The visual card preview (`Interactive3DCard` / `DetailedCardVisual`) already dynamically detects and displays the card network logo/insignia (Visa, Mastercard, Amex, Discover, RuPay). A separate text row with copy button in item detail views was redundant and added clutter.
- **Mobile Detail View (`mobile/src/screens/ItemDetailScreen.tsx`)**:
  - Removed `Card Network` `FieldRow` from the `CARD DETAILS` group.
  - Adjusted `hasDivider` on `Cardholder Name` and `Card Number` to maintain clean borders.
  - Cleaned up unused `detectCardBrand` import.
- **Web Detail View (`src/app/vault/page.tsx`)**:
  - Removed `Network` `DetailRow` from the `CARD DETAILS` group.
- **Extension Detail View (`extension/src/popup/VaultScreen.tsx`)**:
  - Removed `Network` `DetailRow` from the `CARD DETAILS` group.
- **Preserved in Edit Forms**:
  - Maintained card brand selection and auto-detection in edit forms (`ItemFormScreen.tsx`, `NewEntryDialog.tsx`, `NewEntryForm.tsx`) per user specifications.

### 📋 What's Planned Next
- Work on Issue #5: Swipe gesture to flip credit cards.
- Work on Issue #7: Dynamic 'Other' category with rotating archetype names.

---

## Previous Session: Animated Cipher Scramble Text Cascade on Web (Issue #6) (2026-09-11) · Branch: `dev`

### ✅ What Was Done

#### 1. Reusable Animated Cipher Scramble Text Component (`src/components/ui/CipherScrambleText.tsx`)
- Created `CipherScrambleText.tsx` matching the mobile app's mechanical cipher cascade (`mobile/src/screens/GeneratorScreen.tsx`):
  - **Balanced Character Pools**: Scramble draws uniformly from 4 distinct pools (lowercase, uppercase, digits, symbols) at 25% distribution.
  - **Progressive Left-to-Right Locking**: Resolves over 14 frames at 22ms intervals (~308ms total animation).
  - **Dynamic Syntax Color Highlighting**: Letters, digits, and symbols carry syntax colors during both the scramble phase and final locked state (rose for symbols, amber for digits, sky for uppercase, neutral for lowercase).
  - **Mode-Specific Variations**: Supports `pin` (digit-only scramble with amber tracking) and `passphrase` (lowercase word scramble with amber separator preservation).
  - **Separator Preservation**: Word separators (`-`, `_`, `.`, ` `) are locked immediately to preserve readable structure during generation.
  - **Static Context Resilience**: Provided `animate?: boolean` prop (used in history drawers/rows) to prevent unwanted scrambles on initial drawer render.
  - **Accessibility**: Preserves `aria-label={value}` for screen reader compatibility.

#### 2. Site-Wide Generator Integration
- **Vault Generator Page (`src/app/vault/generator/page.tsx`)**:
  - Replaced static character loop with `CipherScrambleText`.
  - Added 360° spring-like cubic bezier rotation to `RefreshCw` icon on regeneration.
  - Added global `Cmd+G` / `Ctrl+G` keyboard shortcut for rapid password regeneration (ignored when focused in inputs/textareas).
  - Disabled animations on past history rows (`animate={false}`).
- **Standalone Public Generator Page (`src/app/generator/page.tsx`)**:
  - Integrated `CipherScrambleText` and `triggerKey` increment on regeneration.
  - Added 360° rotation on `RefreshCw` icon and `Cmd+G` / `Ctrl+G` shortcut.
- **In-Vault Quick Generator Drawer (`src/app/vault/page.tsx`)**:
  - Replaced inline character colorizer in `PasswordGen` with `CipherScrambleText` and spinning refresh button.
- **New Entry Creation Dialog (`src/components/vault/NewEntryDialog.tsx`)**:
  - Replaced inline character colorizer in `PasswordGenerator` with `CipherScrambleText` and spinning refresh button.

### 📋 What's Planned Next
- Work on next issues (e.g. Issue #1 card network cleanup, Issue #2 card flip, Issue #4 others category plan).

---

## Previous Session: Apple-Grade 3D Animations, Folder Dynamics & Motion Suite (2026-09-11) · Branch: `feature/fluid-item-transitions`

### ✅ What Was Done

#### 1. Interactive 3D Vault Card with Holographic Glare & 3D Flip (`mobile/src/components/Interactive3DCard.tsx`, `ItemPreviewCard.tsx`)
- Created `Interactive3DCard.tsx` with Reanimated gesture-driven 3D physics:
  - **3D Touch Parallax Tilt**: Tracks user finger touch across the card surface (`perspective: 1200, rotateX, rotateY, scale: 1.025`). Card tilts smoothly toward touch and springs back to neutral with damped spring on release.
  - **Dynamic Specular Glare (Holographic Sheen)**: Sweeping diagonal translucent light beam whose translation and opacity move proportionally with the tilt angle.
  - **True 3D 180° Card Flip**: Flips between Front and Back using Reanimated `rotateY` (`0deg -> 180deg`) and synchronized opacity handoff at $90^\circ$ for zero glitch across all Android versions.
- Added **Realistic Payment Card Back Visual** (`CreditCardBackVisual`):
  - Matte black magnetic stripe across top with gloss reflection.
  - White signature panel with cardholder script signature and dynamic CVV security code.
  - Holographic security seal, Zero-Knowledge AES-256-GCM watermark, and client-side encryption notice.
  - Interactive "Flip Card" pill button.

#### 2. Apple-Style Folder Dynamics & Accordion (`mobile/src/components/AnimatedFolderRow.tsx`, `VaultListScreen.tsx`)
- Replaced static icon swap in `VaultListScreen.tsx` with dedicated `AnimatedFolderRow.tsx`:
  - **Spring Chevron Rotation**: Smooth rotation from $0^\circ$ (collapsed) to $90^\circ$ (expanded) with damped spring physics, exactly like macOS Finder / iOS Files.
  - **3D Folder Flap Tilt**: Folder icon tilts open in 3D perspective (`rotateX: -18deg, scale: 1.05`) when opened.
  - **Accordion Subtree**: Subfolder child rows animate in and out with Reanimated `FadeInUp.duration(160)` / `FadeOut.duration(120)` to eliminate layout snapping.
  - **Tactile Row Press**: Spring depression on touch (`scale: 0.985`).

#### 3. Fluid Staggered List Loading & Shimmer Skeleton (`mobile/src/components/AnimatedListItem.tsx`, `VaultSkeletonLoader.tsx`)
- Created `AnimatedListItem.tsx`:
  - Staggered cascade entrance: `entering={FadeInDown.delay(Math.min(index, 12) * 35).springify().damping(16).mass(0.6)}`.
  - Items slide up smoothly from $+18\text{px}$ with opacity $0 \to 1$.
  - Integrated into `VaultFilteredScreen.tsx` FlatList and `VaultListScreen.tsx` favorites grid / recent items.
- Created `VaultSkeletonLoader.tsx`:
  - Shimmering placeholder cards with animated opacity wave loop during vault fetch/decryption.

#### 4. Expanded Screen Navigation Transitions & Background Deck Recess (`itemTransitions.ts`, `MainTabs.tsx`, `TransitionSelectModal.tsx`)
- Added **Apple-Style Background Deck Recess** in `MainTabs.tsx`:
  - Wrapped `MainTabs` in an `Animated.View` powered by `useCardAnimation()` from `@react-navigation/stack`.
  - When an item screen (`ItemDetail`, `ItemForm`) is pushed, `MainTabs` smoothly scales down to $0.93$, translates up by $-10\text{px}$, rounds top corners to $22\text{px}$, and dims to $0.65$ opacity over a black backdrop.
- Added 3 new high-impact transitions in `itemTransitions.ts` (now 9 total options):
  1. **Apple Fold Deck (`appleFoldDeck`)**: Signature Apple modal sheet with 3D bottom perspective fold and settle.
  2. **3D Cube Turn (`cubeTurn`)**: Perspective 3D cube turn with edge-anchored rotation and dynamic scale.
  3. **Elastic Spring Pop (`elasticPop`)**: High-tension center spring pop with playful overshoot.
- Updated `TransitionSelectModal.tsx` and `mobile/src/lucide.d.ts` with icons (`Folder`, `Box`, `Zap`), tags, and instant testing.

#### 5. Tactile 3D Micro-Interactions (`VaultListScreen.tsx`, `ItemDetailScreen.tsx`, `UnlockScreen.tsx`)
- **Interactive 3D FAB (`Interactive3DFab`)**:
  - The `+` FAB on `VaultListScreen` rotates $0^\circ \to 45^\circ$ on press with spring physics, paired with tactile scale ($1.0 \to 0.9 \to 1.0$) and elevated shadow glow.
- **Favorite Star Spring Burst (`AnimatedFavoriteButton`)**:
  - In `ItemDetailScreen.tsx`, tapping favorite triggers a high-velocity spring sequence (`scale: 1.0 -> 1.45 -> 0.9 -> 1.0`, rotation $-18^\circ \to 10^\circ \to 0^\circ$).
- **Animated Copy Button & Floating Toast (`AnimatedCopyButton`, `floatingCopiedPill`)**:
  - Tapping copy bounces the copy icon and displays a sleek animated floating pill ("Copied to clipboard") with `FadeInUp`/`FadeOut`.
- **Biometric Lock 3D Breathing Pulse (`UnlockScreen.tsx`)**:
  - In `UnlockScreen.tsx`, the lock logo box has continuous 3D breathing pulse (`scale: 1.0 -> 1.05 -> 1.0`, perspective tilt $\pm 5^\circ$).

#### 6. Android Reanimated Crash Fix (`AnimatedFolderRow.tsx`, `Interactive3DCard.tsx`)
- **Resolved Fatal `stod: no conversion` Crash**:
  - Identified crash cause: `withSpring(...)` was invoked directly inside a template string (`${withSpring(...)}deg`) inside `useAnimatedStyle` in `AnimatedFolderRow.tsx`.
  - Reanimated's native C++ core failed when parsing `"[object Object]deg"` with `std::stod`.
  - Replaced with Reanimated `interpolate(flapTilt.value, [0, 1], [0, -18])` and `interpolate(flapTilt.value, [0, 1], [1, 1.05])`.
- **Hardened 3D Card Interactivity & Touch Resilience (`Interactive3DCard.tsx`)**:
  - Added an auto-reset safety timeout (700ms) to ensure the card always resets to flat orientation if a gesture or vertical scroll cancels touch events mid-gesture.
  - Added `onResponderRelease` and `onResponderTerminate` handlers to prevent tilt sticking when scrolling parent views.
- **Verification on Physical Device**:
  - Cleared ADB logcat and verified zero runtime exceptions across screen navigations, folder expansions, card 3D tilts, card flips, and star burst animations.

#### 7. Premium Motion & Realistic Micro-Interaction Overhaul (Completed)
- **Favourite Star Magnetic Click (`ItemDetailScreen.tsx`)**:
  - Removed artificial rotation and exaggerated multi-bounce sequence.
  - Replaced with tactile physical "Magnetic Click": fast squeeze to $0.84 \to$ crisp micro-pop to $1.15 \to$ settles precisely at default scale $1.0$ with high damping.
  - Integrated parallel subtle amber ambient bloom halo ($22\%$ opacity) behind the star.
- **Physical Ink Stamp Copy Button (`ItemDetailScreen.tsx`)**:
  - Replaced lingering bounce with physical "Ink Stamp": quick compress to $0.82 \to$ immediate high-damped return directly to $1.0$ with zero overshoot.
- **Realistic Ambient Depth Shadow & Rim Light for 3D Card (`Interactive3DCard.tsx`)**:
  - Completely stripped out synthetic holographic glare beam stripes and glare overlays.
  - Added natural ambient cast shadow layer beneath the card that shifts dynamically opposite to tilt angle (mimicking physical directional light).
  - Added dynamic $1\text{px}$ rim light border that brightens from $0.06 \to 0.16$ opacity on touch/tilt.
  - Reduced max tilt angles from $12^\circ / 10^\circ$ to natural $8^\circ / 6^\circ$ with heavier mass spring physics.
- **Folder Lift & Smooth Icon Cross-Dissolve (`AnimatedFolderRow.tsx`)**:
  - Reined in over-dramatic $-18^\circ$ flap tilt to a subtle, natural $-8^\circ$ lift.
  - Replaced abrupt icon snap with a smooth Reanimated opacity cross-dissolve between `Folder` and `FolderOpen`.
- **Sleek Minimal Fade-In & Non-Bouncy Layout Transition (`AnimatedListItem.tsx`, `VaultSkeletonLoader.tsx`)**:
  - Replaced bouncy vertical `FadeInUp` spring with pure, sleek `FadeIn.duration(140)` and non-bouncy linear layout transition (`LinearTransition.duration(150)`).
  - Capped micro-stagger strictly to the first 5 visible items (`index < 5 ? index * 14 : 0`), eliminating scroll-induced pop-in latency in FlatLists.
  - Upgraded `VaultSkeletonLoader` with silky SVG linear gradient shimmer wave sweeps across skeleton bones.
- **Dignified Unlock Screen Security Halo (`UnlockScreen.tsx`)**:
#### 8. App-Wide Premium Refinements & Micro-Interactions (Completed)
- **Apple-Grade Haptic Reanimated Switch (`CustomSwitch.tsx`)**:
  - Replaced legacy React Native `Animated` with Reanimated 3 UI-thread springs.
  - Added authentic Apple thumb squish and stretch (`scaleX: 1.14, scaleY: 0.94` while pressed/traveling), snapping cleanly into resting position (`scaleX: 1.0`) with calibrated spring (`damping: 18, stiffness: 260`).
  - Added smooth interpolated track background and border color transitions.
- **Progressive Spring Liquid Filling for Password Strength (`PasswordStrengthBar.tsx`)**:
  - Replaced abrupt segment color cuts with progressive spring width fills using staggered delay (`index * 35ms`).
  - Smooth label and color transitions as entropy increases or decreases when typing passwords.
- **Mechanical Tactile Generator Screen (`GeneratorScreen.tsx`)**:
  - Created `AnimatedRegenerateButton` with $360^\circ$ spring spin and tactile press depression on the `RefreshCw` icon.
  - Replaced awkward `FadeInUp` falling text with `CipherScrambleOutput`: on regeneration or seed change, characters rapidly scramble through randomized cipher characters and lock in sequentially from left to right over ~260ms.
  - Balanced scramble across 25% symbols, 25% digits, 25% uppercase, and 25% lowercase, dynamically styled in their respective syntax colors (rose pink for symbols, gold amber for digits, cyan blue for uppercase, and silver white for lowercase) during the scramble animation.
  - Upgraded mode tabs, copy button, length presets, and step counters (`-`/`+`) with `PressableScale` tactile touch.
- **TOTP Continuous Countdown Ring & Digit Refresh (`TotpCode.tsx`, `AuthenticatorScreen.tsx`)**:
  - Replaced 1-second stepped jumps with continuous, liquid smooth countdown ring draining via Reanimated animated props.
  - Added soft heartbeat pulse when $\le 5$ seconds remain to alert the user naturally without alarmist flashing.
  - Added digit refresh cascade (`FadeInUp.duration(160)`) on token cycle and wrapped cards in `PressableScale`.
  - Added `AnimatedListItem` staggered entrance to Authenticator screen tokens.
- **Item Detail Screen & Clean Password Reveal (`ItemDetailScreen.tsx`)**:
  - Removed artificial animated eye button and vertical sliding text on password reveal, restoring original clean, direct, instant toggle.
  - Added animated accordion roll-down (`FadeInUp.duration(160)` / `FadeOut.duration(120)`) for password history.
- **Tactile FAB Button & Trash Spring Transitions (`VaultListScreen.tsx`, `VaultFilteredScreen.tsx`, `TrashScreen.tsx`)**:
  - Replaced awkward $45^\circ$ "X" rotation on the `+` FAB with authentic button depression (`scale: 0.92, translateY: 2`).
  - Added `PressableScale` to `VaultFilteredScreen.tsx` FAB.
  - Wrapped Trash items in `AnimatedListItem` for fluid delete, restore, and list reflow transitions.
- **Android 14/15 Native Predictive Back System Gesture Bridge (`PredictiveBackModule.kt`, `predictiveBack.ts`, `PredictiveBackWrapper.tsx`, `ItemDetailScreen.tsx`, `ItemFormScreen.tsx`)**:
  - Enabled `android:enableOnBackInvokedCallback="true"` in `AndroidManifest.xml`.
  - Implemented custom Kotlin module `PredictiveBackModule.kt` and `PredictiveBackPackage.kt` registered in `MainApplication.kt`, hooking Android 14+ (`API 34+`) `OnBackAnimationCallback` to intercept hardware edge bezel back swipes (`onBackStarted`, `onBackProgressed`, `onBackInvoked`, `onBackCancelled`).
  - Bridged progress ($0.0 \to 1.0$), touch coordinates, and swipe edge direction directly into React Native via `RCTDeviceEventEmitter`.
  - Created `usePredictiveBack` hook in `predictiveBack.ts` with navigation `focus` and `blur` lifecycle guards: automatically enables the native interceptor only when child screens are active, and disables on blur/unmount so the root screen (`MainTabs`) leaves predictive back unintercepted, allowing the Android OS to display the native exit-to-launcher preview.
  - Created Reanimated `PredictiveBackWrapper.tsx` driving GPU scale down ($1.0 \to 0.88$), corner rounding ($0 \to 26\text{px}$), edge translation, and fade out on swipe with finger tracking.
  - Wrapped `ItemDetailScreen` and `ItemFormScreen` in `PredictiveBackWrapper`, preserving unsaved note alerts and safe navigation.

#### 9. Transition Alignment & Folder Predictive Back Navigation (`RootNavigator.tsx`, `itemTransitions.ts`, `predictiveBack.ts`, `PredictiveBackWrapper.tsx`, `VaultFilteredScreen.tsx`, `FolderManagerScreen.tsx`)
- **Eliminated Transition Conflicts & Double-Animation**:
  - Diagnosed root conflict: React Navigation's JS pan gesture handler (`gestureEnabled: true`) was fighting Android's native `OnBackAnimationCallback` on bezel swipes, and stack close interpolators were running on top of already completed Reanimated gestures.
  - Set `gestureEnabled: false` on `ItemDetail`, `ItemForm`, `VaultFiltered`, and `FolderManager` in `RootNavigator.tsx`, ensuring the native OS gesture exclusively drives the back motion.
  - In `predictiveBack.ts`, sequenced `progress.value = withTiming(1, { duration: 80 })` to complete the visual preview first before calling `runOnJS(doExit)()`, eliminating exit jitter.
  - In `itemTransitions.ts`, set fast $80\text{ms}$ timing close spec and `gestureEnabled: false` on `predictiveBack`, while preserving unique entry styles on push.
- **Extended Predictive Back to Folder Navigation**:
  - Wrapped `VaultFilteredScreen.tsx` in `<PredictiveBackWrapper navigation={navigation}>`: navigating into custom folders or nested subfolders now supports real-time bezel swipe preview returning to parent views.
  - Wrapped `FolderManagerScreen.tsx` in `PredictiveBackWrapper` with a modal-aware `onBack` handler (dismissing creation, rename, or deletion dialogs before screen exit).
- **Transparent Floating Wrapper Surface (`PredictiveBackWrapper.tsx`)**:
  - Replaced solid `#000000` wrapper container background with `transparent`, and assigned `colors.bg` with rounded corner clipping to the inner card. When swiping from the bezel, the underlying vault screen is cleanly visible beneath the floating card.
- **Removed Debug Logs (`PredictiveBackModule.kt`)**:
  - Stripped all debug `Log.d` statements per repository hygiene rules.

#### 10. Predictive Back System Priority + Transition Simplification (`PredictiveBackModule.kt`, `itemTransitions.ts`, `RootNavigator.tsx`, `vaultStore.ts`, `SettingsScreen.tsx`)
- **Root Fix — `PRIORITY_OVERLAY`**:
  - Identified the real root cause: `OnBackInvokedDispatcher.PRIORITY_DEFAULT` (value 0) allows Android to show its own window-scale preview animation alongside our custom Reanimated one — causing the "system animation first, then app animation" double-play.
  - Changed to `OnBackInvokedDispatcher.PRIORITY_OVERLAY` (value 1,000,000): our callback now exclusively owns the back gesture. Android's built-in scale-down window preview is fully suppressed.
- **Single Hardwired Transition — Vault Depth Lift**:
  - Stripped `itemTransitions.ts` from 949 lines (10 transition variants + metadata) down to 112 lines: single `depthLift` spec and interpolator only.
  - Removed `ItemTransitionType` union, `ITEM_TRANSITIONS_METADATA` array, and `getItemTransitionConfig(type)` parameter — function is now `getItemTransitionConfig()` with no args.
  - Hardwired `gestureEnabled: false` in the config itself so no screen-level override is needed.
- **Store Cleanup (`vaultStore.ts`)**:
  - Removed `itemTransition` state field, `setItemTransition` action, `ItemTransitionType` import, and the `AsyncStorage.getItem("@vaultr/item_transition")` read from `initSession`.
- **Settings Cleanup (`SettingsScreen.tsx`)**:
  - Removed the "EXPERIENCE & MOTION" settings section (transition picker row + `TransitionSelectModal` reference).
  - Removed all related imports (`ITEM_TRANSITIONS_METADATA`, `TransitionSelectModal`), state (`transitionModalVisible`), and memos (`currentTransitionMeta`).
- **Deleted `TransitionSelectModal.tsx`** — entire file removed.
- **0 TypeScript errors** confirmed after all changes.

#### 11. Native Release APK Build & Device Installation (`vaultr-v0.2.9-release.apk`)
- **Compiled Native Android Release Bundle**:
  - Ran `.\gradlew.bat assembleRelease` to compile Kotlin changes (`PredictiveBackModule.kt` `PRIORITY_OVERLAY`) into native binaries.
  - Successfully produced `vaultr-v0.2.9-release.apk` (146MB) with all bundled assets and JS offline bundle.
- **Installed onto Physical Device (`RZCY40QN1EW`)**:
  - Streamed installation via `adb -s RZCY40QN1EW install -r`.
  - Launched app activity `com.vaultr.mobile/.MainActivity` (PID active and verified).

#### 12. Direct Vault Depth Lift Alignment & Shrink Elimination (`PredictiveBackWrapper.tsx`, `MainTabs.tsx`, `predictiveBack.ts`)
- **Eliminated Active Screen Horizontal Shrink (`PredictiveBackWrapper.tsx`)**:
  - Replaced the hardcoded Android-style window shrink (`scale: [1, 0.88]`, `translateX: [0, 34]`, `borderRadius: [0, 26]`) with the authentic **Vault Depth Lift** transition curve:
    - Vertical depth slide: `translateY: [0, height * 0.22]`
    - Receding scale: `scale: [1, 0.76]`
    - Smooth opacity fade: `opacity: [1, 0]`
    - Zero horizontal shift (`translateX: 0`), zero corner morphing (`borderRadius: 0`).
- **Eliminated Background Screen Deck Shrink (`MainTabs.tsx`)**:
  - Removed `animatedContainerStyle` deck recess from `MainTabs` (`scale: [1, 0.93]`, `borderTopLeftRadius: 22`), eliminating the frozen shrunken background card during native back gestures.
- **Fixed Snap-Back Glitch Before Screen Exit (`predictiveBack.ts`)**:
  - Prevented premature resetting of `progress.value = 0` inside `onPredictiveBackInvoked`, ensuring the screen stays completely faded out while `navigation.goBack()` cleanly unmounts it with zero flicker or second animation.
- **Rebuilt & Installed Release APK on Device (`RZCY40QN1EW`)**:
  - Compiled release bundle with `./gradlew.bat assembleRelease` (3m 36s).
  - Streamed install via ADB and started app activity (PID `13698`).

#### 13. Distinct Folder vs Item Transitions & Transparent Stack Hierarchy (`itemTransitions.ts`, `RootNavigator.tsx`, `PredictiveBackWrapper.tsx`, `predictiveBack.ts`, `VaultFilteredScreen.tsx`, `FolderManagerScreen.tsx`)
- **Previous Screen Visibility During Back Gesture**:
  - Identified why the previous page didn't show during back gestures: `Stack.Navigator` and `CardContainer` had opaque `cardStyle: { backgroundColor: colors.bg }`, blocking the underlying screen from view until the card was fully unmounted.
  - Configured `cardStyle: { backgroundColor: "transparent" }` across the Stack and transition resolvers with `detachPreviousScreen: false`. As either item cards or folder screens translate during back gestures, the previous page is rendered and visible directly underneath.
- **Differentiated Folder vs Item Transitions**:
  - **Folders (`VaultFilteredScreen`, `FolderManagerScreen`)**: Differentiated to pure **Horizontal Slide (Drill-Down)**. Swiping from the left bezel slides the folder horizontally off-screen to the right (`translateX: 0 -> screenWidth`) at 100% scale with a subtle left-edge divider line, smoothly revealing the parent folder or vault list underneath in real time.
  - **Items (`ItemDetailScreen`, `ItemFormScreen`)**: Dedicated to **Vault Depth Lift**. Slides down vertically (`translateY: 0 -> height * 0.22`) and recedes into depth (`scale: 1.0 -> 0.76`) with dim overlay fade, revealing the vault list directly beneath the receding card.
- **Eliminated End-of-Animation Lag**:
  - In `predictiveBack.ts`, `onPredictiveBackInvoked` immediately invokes `runOnJS(doExit)()` in the same frame as `progress.value = withTiming(1, { duration: 160 })`, running the navigation pop and completion curve concurrently.
  - Switched `close` transition spec in `itemTransitions.ts` from a lagging 250ms spring to a 160ms cubic timing curve, eliminating the post-gesture stutter/pause.
- **Rebuilt & Deployed Release APK on Device (`RZCY40QN1EW`)**:
  - Compiled release bundle with `.\gradlew.bat assembleRelease` (2m 52s).
  - Streamed install via ADB and started app activity (PID `23908`).

#### 14. Predictive Back Focus Scoping & Event Isolation (`predictiveBack.ts`)
- **Resolved Multi-Screen Pop Bug (Item Back Hitting Folder)**:
  - Root Cause: `DeviceEventEmitter` broadcasts globally across the app. When an item was opened inside a folder, both `VaultFilteredScreen` (parent) and `ItemDetailScreen` (child) were mounted and listening for `onPredictiveBackInvoked`. Swiping back on the item triggered `navigation.goBack()` in both listeners simultaneously, popping both the item and the folder.
  - Fix: Scoped `usePredictiveBack` directly to `useIsFocused()`. The moment an item opens over a folder, the folder's `useEffect` cleanup immediately removes its `DeviceEventEmitter` listeners.
  - Added defensive guards: `doExit()` verifies `navigation.isFocused()` and `isActive.value` before triggering any navigation pop.
- **Rebuilt & Deployed Release APK on Device (`RZCY40QN1EW`)**:
  - Compiled release bundle with `.\gradlew.bat assembleRelease` (4m 44s).
  - Streamed install via ADB and started app activity (PID `28538`).

### 📋 Planned Next Steps
1. **User Testing on Device** (`RZCY40QN1EW`):
   - **Test Item Inside Folder Back**:
     - Navigate into any folder (e.g. Work/Finance) -> tap an item to open `ItemDetailScreen`.
     - Bezel swipe back from the item: verify ONLY the item closes (Vault Depth Lift), leaving you cleanly inside the folder screen.
     - Bezel swipe back from the folder: verify the folder slides horizontally to the right, returning you to the main vault list.
   - **Test Direct Item Back**:
     - Open an item from the main vault list -> bezel swipe back: verify clean single-step exit.
2. **Merge Branch & Version Bump**:
   - Once user confirms smooth experience, merge `feature/fluid-item-transitions` into `dev`.
   - Suggest version bump (e.g. `0.3.0` milestone).

---

## Current Session: Cross-System Parity & Ecosystem Alignment Overhaul (2026-09-11)

### ✅ What Was Done

#### 1. Core Types & Universal Helpers (`packages/core/`)
- **Canonical Payload Interfaces (`packages/core/src/types.ts`)**:
  - Expanded `DecryptedLoginPayload`, `DecryptedCardPayload`, `DecryptedAddressPayload`, `DecryptedProfilePayload`, and `DecryptedNotePayload` to include `entryNotes`, `customFields`, `fields`, and `attachments`.
  - Added `passwordHistory?: string[]` to login payload.
  - Added `cardBrand?: string`, `pin?: string`, `expiry?: string`, and `cardName?: string` to card payload.
  - Defined canonical `DecryptedPayload`, `CustomFieldEntry`, and `AttachmentMetadata` types.
  - Exported universal `detectCardBrand` helper from `@vaultr/core` to eliminate divergent inline brand regex across Web, Mobile, and Extension.
- **Universal Importer Mapping (`packages/core/src/importer.ts`)**:
  - Added `dob` and `idNumber` to `ParsedImportItem["payload"]`.
  - Mapped `dob`, `idNumber`, `full_name`, `email`, and `phone` in generic CSV parsing.
  - Mapped `dob` (date of birth) and `idNumber` (SSN/passport/license) in Bitwarden JSON identity parsing.

#### 2. Prevented Silent Data Loss & Enforced Editor Parity
- **Mobile Edit Screen (`mobile/src/screens/ItemFormScreen.tsx`)**:
  - **Address `line2`**: Added state and dedicated `"Apartment, Suite, Unit"` text input with `"Apt 4B (optional)"` placeholder. Stopped hardcoding `line2 = ""` on save.
  - **Profile `dob` & `idNumber`**: Added state and dedicated inputs for `"Date of Birth"` (`YYYY-MM-DD`) and `"ID / Passport No."` (`e.g. DL-12345678`). Loaded and persisted to `unencryptedPayload.dob` and `idNumber`.
  - **Password History**: Tracked initial password and preserved/appended previous passwords to `passwordHistory` on password change (keeping last 5 entries).
  - **Dual-Key Custom Fields**: Saved both `key` and `name` properties to prevent field label loss across web/mobile readers.
  - Passed `line2`, `dob`, and `idNumber` directly into `<ItemPreviewCard>`.
- **Web Primary Editor (`src/components/vault/NewEntryDialog.tsx`)**:
  - Added `passwordHistory` preservation and appending when editing a login entry.
- **Web Quick-Entry Modal (`src/app/vault/page.tsx`)**:
  - Added `cardholderName`, `expMonth`, `expYear`, and auto-detected `cardBrand` on card saves.
- **Browser Extension Editor (`extension/src/popup/NewEntryForm.tsx`)**:
  - Added card brand auto-detection with visual badge preview.
  - Split expiry input into canonical `expMonth` and `expYear`.
  - Saved `cardholderName` dual-key alongside `cardName`.
  - Added `passwordHistory` preservation and appending on password changes.
  - Saved dual-key `key` and `name` in `customFields`.

#### 3. Cross-Platform Detail Displays & Robust Fallbacks
- **Mobile Detail View (`mobile/src/screens/ItemDetailScreen.tsx`)**:
  - **Address Section**: Supported `payload.street || payload.line1` and added dedicated `Apartment / Suite` row for `payload.line2`.
  - **Personal Identity Section**: Supported `payload.fullName || (firstName + lastName)`. Added dedicated rows for `Date of Birth` and maskable `ID / Passport No.`.
  - **Card Section**: Supported `payload.cardholderName || payload.cardName`. Added dedicated `Card Network` row displaying `payload.cardBrand || detectCardBrand()`.
  - **URLs Section**: Added `payload?.urls?.[0]` fallback.
  - **Note Header**: Renamed section header from `SECURE NOTE` to `NOTE CONTENT`.
- **Browser Extension Panel (`extension/src/popup/VaultScreen.tsx`)**:
  - **Custom Fields Display**: Implemented full `CUSTOM FIELDS` section with masked values for `hidden` types and 1-tap copy.
  - **Card Details**: Added `cardholderName || cardName` fallback, `cardBrand` network row, and split `expMonth / expYear` expiry fallback.
  - **Address Details**: Added `line1 || street` fallback.
  - **Profile Details**: Added `fullName || (firstName + lastName)` fallback.
  - **Note Title**: Renamed section title from `SECURE NOTE` to `NOTE`.
- **Web Detail View (`src/app/vault/page.tsx`)**:
  - Added `data.line1 || data.street` fallback in Street Address section.

#### 4. Mobile Decrypted CSV Export Parity (`mobile/src/screens/settings/DataScreen.tsx`)
- Expanded exported CSV schema from 9 basic login columns to 24 universal columns:
  `folder,favorite,type,name,notes,login_username,login_password,login_uri,login_totp,card_number,cardholder_name,expiry,cvv,pin,address,city,state,zip,country,full_name,email,phone,dob,id_number`
- Export now preserves cards, addresses, identities, TOTP secrets, and notes with proper CSV escaping, matching `@vaultr/core` importer specifications for 100% roundtrip fidelity.

#### 5. Verification & Edge Case Hardening
- Fixed RuPay vs Discover prefix collision in `detectCardBrand` (`packages/core/src/types.ts`, `mobile/src/components/ItemPreviewCard.tsx`, `src/components/vault/DialogPreviews.tsx`).
- Enabled explicit `card`, `address`, and `profile` template detection from `type` column in `packages/core/src/importer.ts`.
- Preserved `favorite` flag across CSV and Bitwarden imports in `packages/core/src/importer.ts` and `src/app/settings/data/page.tsx`.
- Successfully verified Next.js 16.2.2 production build (80 routes, 0 errors) and Browser Extension production webpack build (0 errors).

### 📋 Planned Next Steps
1. **Version Bump**:
   - Propose version bump to `0.3.0` (MAJOR milestone) across `packages/core/src/version.ts`, `package.json`, `mobile/package.json`, `mobile/app.json`, and `extension/manifest.json`.
2. **Pull Request & Main Merge**:
   - Open Pull Request from `dev` to `main` and merge upon user confirmation.

---

## Current Session: Mobile Secure Notes Overhaul & Detail View Modernization (2026-09-10)

### ✅ What Was Done

#### 1. Mobile Private Notes Alignment & Editability (GitHub Issue #1)
- **Detail View Repositioning & Renaming (`mobile/src/screens/ItemDetailScreen.tsx`)**:
  - Renamed section header from `SECURE NOTE` to `PRIVATE NOTES` for non-note templates (`!isNoteTemplate`) to eliminate confusion with standalone note items.
  - Relocated Private Notes block from near the top to the bottom of the item detail layout (below Custom Fields and File Attachments, right above item metadata/history).
  - Added an inline `EDIT` button with `Edit2` icon in the card header next to `COPY` that navigates directly to `ItemFormScreen` with the item loaded.
- **Mobile Edit Mode Field (`mobile/src/screens/ItemFormScreen.tsx`)**:
  - Added a dedicated multi-line `Private Notes` text input with placeholder `"Optional private notes…"` (matching web `NewEntryDialog.tsx`) for non-note templates.
  - Bound directly to `entryNotes` and `setEntryNotes`, seamlessly saving to `unencryptedPayload.entryNotes` across the database, web, and mobile.
- **Branch & PR Workflow Rule (`AGENTS.md`)**:
  - Added Section 6 formally documenting the `dev` branch and GitHub Pull Request workflow before merging into `main`.

#### 1. Bumped Mobile Version to 0.2.9 (Build 2026.09.10 · versionCode 9)
- **Mobile Manifests & Android Build Config**:
  - `mobile/package.json`: Bumped version to `0.2.9`.
  - `mobile/app.json`: Bumped version to `0.2.9`, incremented `versionCode` from 8 to `9`.
  - `mobile/android/app/build.gradle`: Incremented `versionCode` to `9`, updated `versionName` to `"0.2.9"`.
- **Core Version Synchronization**:
  - `packages/core/src/version.ts`: Added `VAULTR_MOBILE_VERSION = "0.2.9"` and updated `getAppVersionString("mobile")` for platform-specific versioning without disturbing web or extension manifests.
- **Android Release Build v0.2.9 (`vaultr-v0.2.9-release.apk`)**:
  - Successfully built signed standalone release APK (`mobile/android/app/build/outputs/apk/release/vaultr-v0.2.9-release.apk`).
  - Integrated 8% shrunk app icon assets so the padlock shackle clears rounded launcher cutouts.

#### 2. Login Preview Card Favicon Enhancement & Alignment (`mobile/src/components/ItemPreviewCard.tsx`)
- **Enlarged Favicon Container & Icon**:
  - Increased `faviconBox` dimensions from 40×40 to 48×48 (`borderRadius: 13`) to achieve parity with web's 48px `SiteIcon` standard.
  - Increased `faviconImg` size from 26×26 to 32×32 with `borderRadius: 6` for smooth corner clipping.
  - Increased fallback `Globe` icon from 20 to 24 (`color="rgba(255,255,255,0.45)"`).
- **High-DPI Retina/OLED Resolution**:
  - Upgraded Google Favicon resolution query from `sz=64` to `sz=128`, rendering crisp icons across modern high-density phone displays.
  - Added dedicated Android app domain detection (`isAndroid`) to return the official Android robot head for native app credentials.
- **Improved Alignment & Aesthetics**:
  - Replaced `alignItems: "flex-start"` with `alignItems: "center"` in `login.topRow`, aligning the favicon box symmetrically with the two-line header text.
  - Wrapped header texts in `headerLeft` with `flex: 1` and `marginRight: 12`, removing fixed `maxWidth: 200` to allow natural text scaling and clean ellipsis truncation.
  - Added subtle drop shadow (`shadowOpacity: 0.35`, `elevation: 3`) and refined glassmorphic border `rgba(255, 255, 255, 0.1)`.

#### 2. Removed Redundant Detail Badge Card & Added Sleek Metadata Chips (`mobile/src/screens/ItemDetailScreen.tsx`)
- **Eliminated Redundant `badgeCard`**:
  - Removed the bulky card container positioned under `<ItemPreviewCard>`.
  - Removed duplicate item title (already clearly visible in the top navigation header).
  - Removed 48px `SiteIcon` (already prominently displayed inside the preview card).
  - Removed template badge pill (`LOGIN`, `CARD`, etc.) and single "Launch Website" button (multi-URL items access links directly in detail fields).
  - Purged all associated dead styles: `badgeCard`, `badgeCardHeader`, `itemName`, `metaRow`, `templatePill`, `templatePillText`, `folderText`, `tagsRow`, `tagBadge`, `tagBadgeText`, `launchBtn`, `launchBtnText`.
- **Introduced Minimal & Sleek `metaChipBar`**:
  - Positioned directly beneath `<ItemPreviewCard>` (or at the very top for notes).
  - Amber folder chip (`folderChip`) with `Folder` icon (`#fbbf24`) and subtle ambient background `rgba(245, 158, 11, 0.08)`.
  - Neutral dark tag chips (`tagChip`) with `Tag` icon (`#a1a1aa`) and `#18181b` surface.
  - Zero-space preservation: renders `null` when neither folder nor tags exist on the item.
- **Tablet Split-View Layout Optimization**:
  - Updated tablet condition `isSplitView && !isNoteTemplate` so note items render full-width without an empty left column where the preview card used to be.
- **Updated `mobile/src/lucide.d.ts`**:
  - Added type definitions for `Tag` and `Hash` icons to ensure clean TypeScript compilation.

#### 2. Cross-System Impact & Parity Rule Enforcement
- **`GEMINI.md` (Rule 14)** & **`AGENTS.md` (Section 5)**:
  - Enforced systematic cross-platform verification before proposing changes.
  - Mandated preserving wire format integrity (`unencryptedPayload.note` as plain string) across Web, Extension, Mobile, and PostgreSQL DB.

#### 3. Mobile Note Form Overhaul (`mobile/src/screens/ItemFormScreen.tsx`)
- **Suppressed Skeuomorphic Preview Card**:
  - Hid `<ItemPreviewCard>` when `template === "note"`, recovering over 200px of vertical space above the virtual keyboard.
- **Expansive Note Text Area**:
  - Replaced standard 80px input with `noteTextArea` (`minHeight: 240`, `fontSize: 15`, `lineHeight: 22`).
  - Added live word & character stats counter (`XX words · YY characters`).

#### 4. Living In-Place Note Editor on Detail Screen (`mobile/src/screens/ItemDetailScreen.tsx`)
- **Preview Card Removal for Notes**:
  - Suppressed `<ItemPreviewCard>` when `isNoteTemplate`, letting notes open directly to their real content.
- **Living Plain-Text Canvas**:
  - Replaced the cramped 220px read-only scrollbox with `livingNoteCanvas`:
    - Auto-growing multiline `livingNoteInput` with relaxed typography (`lineHeight: 24`, `minHeight: 250`).
    - Note footer with real-time word and character statistics and 1-tap clipboard copy action.
    - Custom fields and attachments remain fully accessible below the note canvas.
- **Header Save Action & Loading Spinner**:
  - Added `isDirty` detection comparing current edits against saved state.
  - When dirty, replaces `Edit2` in header with high-contrast "Save" pill button.
  - Displays native `ActivityIndicator` spinner during in-flight AES-256-GCM encryption and network sync via `updateItem`.
  - Shows green "SAVED" confirmation badge upon successful save.
- **Unsaved Changes Guard**:
  - Intercepts top-left navigation back button and Android hardware back button via `BackHandler` with a `vaultAlert` discard confirmation dialog.

#### 5. Fixed Header Item Name Left-Alignment Bug (`mobile/src/screens/ItemDetailScreen.tsx`)
- **Root Cause**: `styles.navTitle` had `textAlign: "center"`. When an item's title was short (e.g. "Work", "Amex"), it centered inside the remaining `flex: 1` space between the single back button on the left and the 3 action buttons on the right, appearing awkwardly centered and off-axis.
- **Fix**: Removed `textAlign: "center"` and used `marginLeft: 8, marginRight: 8`, keeping all titles consistently left-aligned right beside the back navigation arrow regardless of title length.

#### 6. Scope Refinement: Static Item Name & Content Edit Toggle (`mobile/src/screens/ItemDetailScreen.tsx`)
- Reverted item name in header and badgeCard back to static text (`item.name`), keeping in-place editing strictly scoped to the note body.
- Added top-right `Edit` / `Done` toggle button inside the content card (`noteEditToggleBtn`) to switch between selectable read mode (`noteReadView`) and multiline editing mode (`livingNoteInput`).
- When toggling `Done`, automatically persists edits via `updateItem` if dirty and returns to read mode.

---

## Current Session: Mobile UX & Production Reliability — Button Spinners & Loading States (2026-09-10)

### ✅ What Was Done

#### 1. Fixed Broken Spinners (Empty/Invisible Buttons)
- **`mobile/src/screens/UnlockScreen.tsx`**:
  - Identified root cause where `styles.spinner` was undefined in `StyleSheet`, rendering an invisible 0×0 box while unlocking.
  - Replaced broken reanimated view with native `ActivityIndicator` (dark `#09090b` on `#f4f4f5` button).
  - Cleaned up unused `spinAnim` shared value and animation effects.
- **`mobile/src/screens/AuthScreen.tsx`**:
  - Resolved undefined `styles.spinner` on primary submit button ("Sign in" / "Create account") by rendering native `ActivityIndicator`.
  - Added `isGoogleLoading` state to distinguish Google OAuth from email/password submission.
  - Added white `ActivityIndicator` and disable guard to Google Sign-In button during in-flight auth.

#### 2. Added Missing Spinners & Async Double-Submit Prevention
- **`mobile/src/screens/settings/FolderManagerScreen.tsx`**:
  - Added `submitting` state with white `ActivityIndicator` to "Create Folder" and "Save Name" (rename) modal buttons.
  - Added `deletingDisposition` state to Delete confirmation modal with proper spinners on "Keep Items" (`#09090b`) and "Delete folder and move items to Trash" (`#ef4444`).
  - Added row-level `deletingRowPath` with danger spinner on single empty folder deletion.
- **`mobile/src/components/FolderSelectModal.tsx`**:
  - Wrapped `handleCreateSubmit` in `try / finally` with `isCreating` state.
  - Rendered white `ActivityIndicator` on "Create & Select" button and disabled repeated taps.
- **`mobile/src/screens/AuthenticatorScreen.tsx`**:
  - Replaced global `assigning` boolean with `assigningTargetId` to give row-specific feedback.
  - Replaced static `ChevronRight` with accent-colored `ActivityIndicator` on the exact login row being linked.
  - Disabled "Create New Login" button and search input while assigning.
- **`mobile/src/screens/ItemDetailScreen.tsx`**:
  - Added `downloadingAttId` state to attachment rows.
  - Disabled row and swapped `ExternalLink` icon for blue `ActivityIndicator` while downloading and decrypting attachment files.
- **`mobile/src/screens/settings/DataScreen.tsx`**:
  - Added danger `ActivityIndicator` to "Export Unencrypted CSV" button while exporting.
- **`mobile/src/screens/TrashScreen.tsx`**:
  - Added `restoringAll` and `restoringId` states.
  - Rendered green `ActivityIndicator` on "Restore All" header action and individual row restore buttons.

---

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





# Implementation Plan: SecureVault Browser Extension

The goal is to build a Chrome Extension (Manifest V3) that integrates with the SecureVault infrastructure to provide a seamless "one-click" login experience. The extension will fetch encrypted credentials from Firestore, decrypt them locally using your Master Password, and intelligently autofill forms on matching websites.

## User Review Required

> [!IMPORTANT]
> **Authentication in Extension**: The browser extension will require its own separate sign-in process to your Firebase account for security. This ensures the extension is isolated and has explicit permission to access your vault.
> 
> **Master Password Entry**: Decryption remains entirely local. You will need to enter your Master Password in the extension popup **once per session** to "Unlock" your credentials.

## Proposed Changes

### [NEW] Extension Directory Structure (`/extension`)

We will create a dedicated folder for the extension source files. This allows for clean isolation from the Next.js frontend code.

#### [NEW] [manifest.json](file:///c:/Users/jangr/Desktop/skillbox-coder/extension/manifest.json)
The configuration file for the extension, defining permissions (`activeTab`, `storage`, `scripting`), background scripts, and the popup UI.

#### [NEW] [popup.html](file:///c:/Users/jangr/Desktop/skillbox-coder/extension/popup.html) & [popup.js](file:///c:/Users/jangr/Desktop/skillbox-coder/extension/popup.js)
A minimalist popup interface that matches the SecureVault "Linear-style" aesthetic. It will handle the Unlock flow and display matching accounts for the current website.

#### [NEW] [content.js](file:///c:/Users/jangr/Desktop/skillbox-coder/extension/content.js)
The script that "lives" on the pages you visit. It will scan for login inputs and perform the actual autofilling once you select an account from the popup.

#### [NEW] [background.js](file:///c:/Users/jangr/Desktop/skillbox-coder/extension/background.js)
The service worker that manages the extension's lifecycle, including Firebase configuration and secure message passing between the popup and content scripts.

#### [NEW] [crypto-utils.js](file:///c:/Users/jangr/Desktop/skillbox-coder/extension/crypto-utils.js)
A standalone version of our AES-GCM logic, ensuring that decryption in the extension is technically identical and just as secure as the web app.

---

## Technical Details

1.  **Domain Matching**: The extension will extract the current tab's hostname (e.g., `github.com`) and filter your vault entries to show only matching credentials.
2.  **Autofill Logic**: The `content.js` script will use intelligent selectors (looking for `type="password"`, `autocomplete="username"`, etc.) to fill both standard and custom login forms.
3.  **Firebase Connection**: The extension will use the same Firebase Project ID and credentials as your web app, ensuring access to the same `vaultItems` collection.

## Navigation & Entry Points
- **Icon Click**: Opens the SecureVault popup.
- **Unlock Screen**: Shown if the Master Password hasn't been entered in the current session.
- **Entries List**: Displays accounts matching the current site, with a "Fill" button for each.

## Verification Plan

### Automated Verification
- **Functional Check**: I will use the browser subagent to simulate the extension's behavior and verify that it can correctly identify dummy form fields on a test page.

### Manual Verification
- **Loading the Extension**: I will provide clear instructions on how to load the `/extension` folder into Chrome via `chrome://extensions/`.
- **End-to-End Test**: You will be asked to try "Unlocking" in the extension and clicking "Fill" on a known login page (e.g., a test site or a saved entry).

# VaultR Passkey Authenticator Metadata & AAGUID

This directory contains the canonical WebAuthn Authenticator Attestation Globally Unique Identifier (AAGUID) metadata for **VaultR Password & Passkey Manager**.

## Authenticator Information

- **Authenticator Name**: `VaultR`
- **AAGUID (UUID v4)**: `7661756c-7472-4a11-8517-5e839e55720c`
- **AAGUID Hex Bytes**: `[0x76, 0x61, 0x75, 0x6c, 0x74, 0x72, 0x4a, 0x11, 0x85, 0x17, 0x5e, 0x83, 0x9e, 0x55, 0x72, 0x0c]`
  - Note: Bytes `0x76 0x61 0x75 0x6c 0x74 0x72` encode the ASCII string `"vaultr"`.
- **Supported Ecosystems**:
  - Web & Browser Extension (`packages/core/src/webauthn.ts`)
  - Android Credential Manager (`mobile/android/app/src/main/java/com/vaultr/mobile/autofill/PasskeyAuthActivity.kt`)
  - Universal Web Vault

## Why AAGUID Matters for Google Accounts & Relying Parties

When a WebAuthn passkey is created, the authenticator embeds its 16-byte AAGUID into the authenticator data (`authData`) inside the attestation object.

1. **Previous Behavior (Anonymous All-Zero AAGUID)**:
   - When authenticators return `00000000-0000-0000-0000-000000000000`, Google Accounts and WebAuthn relying parties default to classifying the passkey as Apple's platform authenticator (**"iCloud Keychain"**).
2. **VaultR Custom AAGUID**:
   - By supplying `7661756c-7472-4a11-8517-5e839e55720c`, relying parties distinguish VaultR credentials from iCloud Keychain.

## Passkey Authenticator AAGUIDs Registry Submission

To register VaultR in community and industry passkey registries (such as [passkeydeveloper/passkey-authenticator-aaguids](https://github.com/passkeydeveloper/passkey-authenticator-aaguids)):

1. Copy the entry from [`aaguid-metadata.json`](file:///d:/Projects/_vaultr/docs/passkeys/aaguid-metadata.json) into the registry's `aaguid.json`.
2. Open a Pull Request referencing VaultR with official brand icons.

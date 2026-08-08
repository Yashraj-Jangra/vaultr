/**
 * Core type definitions for Vaultr items, session state, and API payloads.
 */

export type Template = "login" | "card" | "address" | "profile" | "note";

export interface VaultItem {
  id: string;
  name: string;
  encryptedBlob: string;
  domain?: string;
  folder?: string;
  template?: Template;
  createdAt?: string;
  updatedAt?: string;
  lastAccessedAt?: string;
  favorite?: boolean;
  hasTotp?: boolean;
  tags?: string[];
  deletedAt?: string | null;
}

export type NewVaultItemPayload = Omit<VaultItem, "id" | "createdAt" | "lastAccessedAt"> & {
  encryptedBlob: string;
};

export interface VaultSession {
  masterPassword: string;
  unlockedAt: number; // Unix timestamp in ms
}

export type BatchAction = "trash" | "restore" | "favorite" | "unfavorite" | "move";

export interface DecryptedLoginPayload {
  username?: string;
  password?: string;
  urls?: string[];
  notes?: string;
  totpSecret?: string;
}

export interface DecryptedCardPayload {
  cardholderName?: string;
  cardNumber?: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
  notes?: string;
}

export interface DecryptedAddressPayload {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
}

export interface DecryptedProfilePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface DecryptedNotePayload {
  notes?: string;
}

export type DecryptedItemPayload =
  | DecryptedLoginPayload
  | DecryptedCardPayload
  | DecryptedAddressPayload
  | DecryptedProfilePayload
  | DecryptedNotePayload;

/**
 * Core type definitions for Vaultr items, session state, and API payloads.
 */

export type Template = "login" | "card" | "address" | "profile" | "note";

export interface VaultItem {
  id: string;
  name: string;
  encryptedBlob: string;
  domain?: string | null;
  folder?: string | null;
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

export type BatchAction = "trash" | "restore" | "favorite" | "unfavorite" | "move" | "purge";

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
  line1?: string;
  line2?: string;
  street?: string; // fallback alias for line1
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
  entryNotes?: string;
}

export interface DecryptedProfilePayload {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  idNumber?: string;
  email?: string;
  phone?: string;
  notes?: string;
  entryNotes?: string;
}

export interface DecryptedNotePayload {
  note?: string;
  notes?: string;
  entryNotes?: string;
}

export type DecryptedItemPayload =
  | DecryptedLoginPayload
  | DecryptedCardPayload
  | DecryptedAddressPayload
  | DecryptedProfilePayload
  | DecryptedNotePayload;

/** Normalizes address fields so line1/line2 and street formats work seamlessly across Web and Mobile. */
export function normalizeAddressPayload(p: any): DecryptedAddressPayload {
  if (!p) return {};
  const line1 = p.line1 || p.street || "";
  const line2 = p.line2 || "";
  return {
    ...p,
    line1,
    line2,
    street: line1,
    city: p.city || "",
    state: p.state || "",
    zip: p.zip || "",
    country: p.country || "",
  };
}

/** Normalizes profile fields so fullName and firstName/lastName formats work seamlessly across Web and Mobile. */
export function normalizeProfilePayload(p: any): DecryptedProfilePayload {
  if (!p) return {};
  const firstName = p.firstName || (p.fullName ? p.fullName.trim().split(" ")[0] : "") || "";
  const lastName = p.lastName || (p.fullName ? p.fullName.trim().split(" ").slice(1).join(" ") : "") || "";
  const fullName = p.fullName || [firstName, lastName].filter(Boolean).join(" ");
  return {
    ...p,
    fullName,
    firstName,
    lastName,
    dob: p.dob || "",
    idNumber: p.idNumber || "",
    email: p.email || "",
    phone: p.phone || "",
  };
}

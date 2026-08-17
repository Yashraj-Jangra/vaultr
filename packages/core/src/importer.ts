/**
 * Universal Vault Import Engine for Vaultr.
 * Shared across Web App and Mobile App for 100% parity in parsing,
 * template auto-detection, folder mapping, and custom field handling.
 */

import { Template } from "./types";

export interface GenericImportRow {
  name?: string;
  title?: string;
  username?: string;
  login_username?: string;
  user?: string;
  password?: string;
  login_password?: string;
  url?: string;
  login_uri?: string;
  website?: string;
  "URL 1"?: string;
  "URL 2"?: string;
  "URL 3"?: string;
  login_uri2?: string;
  login_uri3?: string;
  totp?: string;
  login_totp?: string;
  note?: string;
  notes?: string;
  login_notes?: string;
  comments?: string;
  folder?: string;
  group?: string;
  grouping?: string;
  folderId?: string;
  card_number?: string;
  cc_number?: string;
  cardholder_name?: string;
  expiry?: string;
  cvv?: string;
  pin?: string;
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  type?: string;
  passkey_id?: string;
  credential_id?: string;
  rp_id?: string;
  user_handle?: string;
  [key: string]: string | undefined;
}

export interface ParsedImportItem {
  id: string; // Unique client ID for preview list
  name: string;
  folder: string;
  template: Template;
  payload: {
    _template: Template;
    _folder?: string;
    username?: string;
    password?: string;
    url?: string;
    urls?: string[];
    totpSecret?: string;
    note?: string;
    entryNotes?: string;
    cardNumber?: string;
    cardholderName?: string;
    cardName?: string;
    expiry?: string;
    cvv?: string;
    pin?: string;
    line1?: string;
    line2?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    isPasskey?: boolean;
    passkeyRpId?: string;
    passkeyCredentialId?: string;
    passkeyUserHandle?: string;
    [key: string]: any;
  };
}

/**
 * Normalizes a card expiry string into canonical "MM / YYYY" format.
 * Handles inputs like: "3/25", "03/25", "3/2025", "03/2025", "3 / 25", "2025-03", "2025/03", etc.
 * Returns empty string if the result would be invalid (month out of 01-12 range).
 */
export function normalizeExpiry(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.trim();

  // Match MM/YYYY or MM/YY (with optional whitespace or dash separator)
  const matchSlash = cleaned.match(/^(\d{1,2})\s*[\/\-]\s*(\d{2,4})$/);
  if (matchSlash) {
    const monthNum = parseInt(matchSlash[1], 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return "";
    const month = String(monthNum).padStart(2, "0");

    let year = matchSlash[2];
    if (year.length === 2) {
      const y = parseInt(year, 10);
      year = String(y < 50 ? 2000 + y : 1900 + y);
    }
    return `${month} / ${year}`;
  }

  // Match YYYY-MM or YYYY/MM (ISO or inverted format)
  const matchIso = cleaned.match(/^(\d{4})\s*[\/\-]\s*(\d{1,2})$/);
  if (matchIso) {
    const monthNum = parseInt(matchIso[2], 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return "";
    const month = String(monthNum).padStart(2, "0");
    const year = matchIso[1];
    return `${month} / ${year}`;
  }

  return "";
}

/**
 * Normalizes separate month + year strings into canonical "MM / YYYY" format.
 * Month and year may come from split fields (e.g., Bitwarden JSON expMonth/expYear).
 */
export function normalizeExpiryParts(monthRaw: string | number | undefined | null, yearRaw: string | number | undefined | null): string {
  if (monthRaw === undefined || monthRaw === null || yearRaw === undefined || yearRaw === null) return "";
  const mStr = String(monthRaw).trim();
  const yStr = String(yearRaw).trim();
  if (!mStr && !yStr) return "";

  const monthNum = parseInt(mStr, 10);
  const yearNum  = parseInt(yStr,  10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return "";
  if (isNaN(yearNum)) return "";

  const month = String(monthNum).padStart(2, "0");
  const year  = yearNum < 100 ? String(yearNum < 50 ? 2000 + yearNum : 1900 + yearNum) : String(yearNum);
  return `${month} / ${year}`;
}

/** Extracts and normalizes multiple URLs from various CSV columns & comma-separated strings */
export function parseUrls(row: GenericImportRow): string[] {
  const candidates = [
    row.url,
    row.login_uri,
    row["URL 1"],
    row["URL 2"],
    row["URL 3"],
    row.login_uri2,
    row.login_uri3,
    row.website,
  ];

  const parsed: string[] = [];
  for (const item of candidates) {
    if (!item || typeof item !== "string") continue;
    // Handle comma-separated URIs
    const parts = item.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    for (const p of parts) {
      if (!parsed.includes(p)) parsed.push(p);
    }
  }
  return parsed;
}

/** Maps a single CSV row to a standardized ParsedImportItem */
export function mapCsvRow(row: GenericImportRow, index: number): ParsedImportItem {
  const urls = parseUrls(row);
  const primaryUrl = urls[0] || "";

  const rawNote = (row.note || row.notes || row.login_notes || row.comments || "").trim();
  const rawType = String(row.type || "").toLowerCase().trim();
  const isSecureNoteType = rawType === "note" || rawType === "securenote" || rawType === "2";

  // Auto-detect template
  let template: Template = "login";
  if (row.card_number || row.cc_number) {
    template = "card";
  } else if (row.address || row.street || (row.city && !primaryUrl && !row.password)) {
    template = "address";
  } else if (isSecureNoteType || (!primaryUrl && !row.password && !row.login_password && rawNote)) {
    template = "note";
  }

  // Clean folder name: never allow UUIDs or corrupted values
  let rawFolder = (row.folder || row.group || row.grouping || "").trim();
  // Filter out UUID strings if present accidentally in CSV
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawFolder)) {
    rawFolder = "";
  }

  const name = (
    row.name ||
    row.title ||
    primaryUrl ||
    (template === "note" ? "Imported Note" : `Imported Entry #${index + 1}`)
  ).trim();

  const isPasskey = !!(row.passkey_id || row.credential_id || row.rp_id);

    const rawCsvMonth = row.exp_month || row.expiration_month || row.expiry_month || row.expMonth || row.month || "";
    const rawCsvYear = row.exp_year || row.expiration_year || row.expiry_year || row.expYear || row.year || "";
    let csvExpiry = "";
    let csvExpMonth = "";
    let csvExpYear = "";
    if (rawCsvMonth || rawCsvYear) {
      csvExpiry = normalizeExpiryParts(rawCsvMonth, rawCsvYear);
      if (csvExpiry) {
        const parts = csvExpiry.split(" / ");
        csvExpMonth = parts[0] || "";
        csvExpYear = parts[1] || "";
      }
    } else if (row.expiry) {
      csvExpiry = normalizeExpiry(row.expiry);
      if (csvExpiry) {
        const parts = csvExpiry.split(" / ");
        csvExpMonth = parts[0] || "";
        csvExpYear = parts[1] || "";
      }
    }

    const payload: ParsedImportItem["payload"] = {
      _template: template,
      _folder: rawFolder || undefined,
      username: (row.username || row.login_username || row.user || "").trim(),
      password: row.password || row.login_password || "",
      url: primaryUrl,
      urls: urls.length > 0 ? urls : primaryUrl ? [primaryUrl] : [],
      totpSecret: (row.totp || row.login_totp || "").trim(),
      note: template === "note" ? rawNote : undefined,
      entryNotes: rawNote || undefined,
      cardNumber: (row.card_number || row.cc_number || "").trim(),
      cardholderName: (row.cardholder_name || "").trim(),
      cardName: (row.cardholder_name || "").trim(),
      cardBrand: (row.brand || row.card_brand || "").trim() || undefined,
      expiry: csvExpiry || undefined,
      expMonth: csvExpMonth || undefined,
      expYear: csvExpYear || undefined,
      cvv: (row.cvv || "").trim(),
      pin: (row.pin || "").trim(),
      line1: (row.address || row.street || "").trim(),
      street: (row.address || row.street || "").trim(),
      city: (row.city || "").trim(),
      state: (row.state || "").trim(),
      zip: (row.zip || "").trim(),
      country: (row.country || "").trim(),
      isPasskey,
      passkeyRpId: row.rp_id || "",
      passkeyCredentialId: row.passkey_id || row.credential_id || "",
      passkeyUserHandle: row.user_handle || "",
    };

    return {
      id: `csv-${index}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      folder: rawFolder,
      template,
      payload,
    };
  }

  /** Parses Bitwarden JSON export structure */
  export function parseBitwardenJson(data: any): ParsedImportItem[] {
    if (!data || !Array.isArray(data.items)) return [];

    // Build folder map from Bitwarden UUIDs -> Folder Name
    const folderMap = new Map<string, string>();
    if (Array.isArray(data.folders)) {
      for (const f of data.folders) {
        if (f && f.id && f.name && typeof f.name === "string") {
          folderMap.set(f.id, f.name.trim());
        }
      }
    }

    const result: ParsedImportItem[] = [];

    data.items.forEach((item: any, idx: number) => {
      if (!item) return;

      let template: Template = "login";
      // Bitwarden item types: 1 = Login, 2 = SecureNote, 3 = Card, 4 = Identity
      if (item.type === 2) template = "note";
      else if (item.type === 3) template = "card";
      else if (item.type === 4) template = "profile";

      const name = (item.name || `Imported Item #${idx + 1}`).trim();

      // Look up folder name via folderMap using folderId
      let folder = "";
      if (item.folderId && folderMap.has(item.folderId)) {
        folder = folderMap.get(item.folderId) || "";
      } else if (item.folder && typeof item.folder === "string") {
        // If folder is already a string name
        const fStr = item.folder.trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fStr)) {
          folder = fStr;
        }
      }

      const loginData = item.login || {};
      const cardData = item.card || {};
      const identityData = item.identity || {};
      const secureNoteData = item.secureNote || {};

      // Extract URIs
      const urls: string[] = [];
      if (Array.isArray(loginData.uris)) {
        loginData.uris.forEach((u: any) => {
          if (u?.uri && typeof u.uri === "string" && u.uri.trim().length > 0) {
            urls.push(u.uri.trim());
          }
        });
      }

      // Custom fields → entryNotes
      let extraNotes = (item.notes || "").trim();
      if (Array.isArray(item.fields) && item.fields.length > 0) {
        const fieldLines = item.fields
          .map((f: any) => (f.name ? `${f.name}: ${f.value || ""}` : f.value))
          .filter(Boolean);
        if (fieldLines.length > 0) {
          extraNotes += (extraNotes ? "\n\n--- Custom Fields ---\n" : "") + fieldLines.join("\n");
        }
      }

      const noteContent =
        template === "note"
          ? extraNotes || secureNoteData.notes || item.notes || ""
          : undefined;

      // Passkeys in Bitwarden
      const fido2 = Array.isArray(loginData.fido2Credentials) ? loginData.fido2Credentials[0] : null;

      // Card fields in Bitwarden schema (supports expMonth, expYear, expirationMonth, expirationYear, brand, code, etc.)
      const rawBwMonth = cardData.expMonth ?? cardData.expirationMonth ?? cardData.expiryMonth ?? cardData.month ?? "";
      const rawBwYear = cardData.expYear ?? cardData.expirationYear ?? cardData.expiryYear ?? cardData.year ?? "";
      const rawBwExpiry = cardData.expiry ?? cardData.expirationDate ?? "";

      let bwExpiry = "";
      let bwExpMonth = "";
      let bwExpYear = "";

      if (rawBwMonth || rawBwYear) {
        bwExpiry = normalizeExpiryParts(rawBwMonth, rawBwYear);
        if (bwExpiry) {
          const parts = bwExpiry.split(" / ");
          bwExpMonth = parts[0] || "";
          bwExpYear = parts[1] || "";
        } else {
          const mNum = parseInt(String(rawBwMonth), 10);
          bwExpMonth = !isNaN(mNum) && mNum >= 1 && mNum <= 12 ? String(mNum).padStart(2, "0") : String(rawBwMonth).trim();
          bwExpYear = String(rawBwYear).trim();
        }
      } else if (rawBwExpiry) {
        bwExpiry = normalizeExpiry(rawBwExpiry);
        if (bwExpiry) {
          const parts = bwExpiry.split(" / ");
          bwExpMonth = parts[0] || "";
          bwExpYear = parts[1] || "";
        }
      }

      const payload: ParsedImportItem["payload"] = {
        _template: template,
        _folder: folder || undefined,
        username: (loginData.username || "").trim(),
        password: loginData.password || "",
        url: urls[0] || "",
        urls: urls.length > 0 ? urls : [],
        totpSecret: (loginData.totp || "").trim(),
        note: noteContent,
        entryNotes: extraNotes || undefined,

        // Card
        cardNumber: (cardData.number || cardData.cardNumber || "").trim(),
        cardholderName: (cardData.cardholderName || cardData.cardName || "").trim(),
        cardName: (cardData.cardholderName || cardData.cardName || "").trim(),
        cardBrand: (cardData.brand || cardData.cardBrand || "").trim() || undefined,
        expiry: bwExpiry || undefined,
        expMonth: bwExpMonth || undefined,
        expYear: bwExpYear || undefined,
        cvv: (cardData.code || cardData.cvv || "").trim(),
        pin: (cardData.pin || "").trim() || undefined,

        // Profile / Identity
        fullName:
          identityData.firstName && identityData.lastName
            ? `${identityData.firstName} ${identityData.lastName}`
            : identityData.firstName || "",
        firstName: identityData.firstName || "",
        lastName: identityData.lastName || "",
        email: (identityData.email || "").trim(),
        phone: (identityData.phone || "").trim(),
        line1: (identityData.address1 || "").trim(),
        street: (identityData.address1 || "").trim(),
        line2: (identityData.address2 || "").trim(),
        city: (identityData.city || "").trim(),
        state: (identityData.state || "").trim(),
        zip: (identityData.postalCode || "").trim(),
        country: (identityData.country || "").trim(),

        // Passkey
        isPasskey: !!fido2,
        passkeyRpId: fido2?.rpId || "",
        passkeyCredentialId: fido2?.credentialId || "",
        passkeyUserHandle: fido2?.userHandle || "",
      };

      result.push({
        id: `bw-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name,
        folder,
      template,
      payload,
    });
  });

  return result;
}

/** Parses standard CSV string adhering to RFC 4180 */
export function parseCsvText(csvText: string): ParsedImportItem[] {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const parsedItems: ParsedImportItem[] = [];

  for (let r = 1; r < rows.length; r++) {
    const values = rows[r];
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const rowObj: GenericImportRow = {};
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (h) {
        rowObj[h] = values[c] !== undefined ? values[c] : "";
      }
    }

    parsedItems.push(mapCsvRow(rowObj, r - 1));
  }

  return parsedItems;
}

/** Robust RFC 4180 CSV tokenizer supporting escaped quotes and multiline rows */
function parseCsvRows(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim().length > 0)) {
        result.push(row);
      }
      row = [];
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim().length > 0)) {
      result.push(row);
    }
  }

  return result;
}

/** Universal file content parser for JSON or CSV */
export function parseImportFileContent(content: string, fileName?: string): ParsedImportItem[] {
  const trimmed = content.trim();

  // Try JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed);
      if (json.items && Array.isArray(json.items)) {
        // Bitwarden or Vaultr export
        return parseBitwardenJson(json);
      } else if (Array.isArray(json)) {
        return parseBitwardenJson({ items: json });
      }
    } catch {
      // JSON parse failed, try CSV fallback
    }
  }

  // Parse as CSV
  return parseCsvText(trimmed);
}

export type ConflictMode = "skip" | "overwrite" | "create_all";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType: "exact" | "name_and_username" | "domain_and_username" | "name_only" | "none";
  matchedItemId?: string;
  matchedItemName?: string;
}

/**
 * Normalizes a URL/domain string to hostname for comparison.
 */
export function normalizeDomainForMatch(urlStr?: string): string {
  if (!urlStr) return "";
  const trimmed = urlStr.trim().toLowerCase();
  if (trimmed.startsWith("androidapp:")) return trimmed;
  const withoutScheme = trimmed.replace(/^[a-zA-Z]+:\/\//, "");
  const host = withoutScheme.split("/")[0]?.split("?")[0]?.split("#")[0]?.split(":")[0] || "";
  return host.replace(/^www\./, "");
}

/**
 * Checks if a parsed import item matches an existing item in the vault.
 * Compares multi-factor credentials (name, username, domain/url, template).
 */
export function checkDuplicateItem(
  item: ParsedImportItem,
  existingItems: Array<{
    id: string;
    name: string;
    domain?: string | null;
    template?: string | null;
    username?: string | null;
  }>
): DuplicateCheckResult {
  const itemName = (item.name || "").trim().toLowerCase();
  const itemUser = (item.payload.username || item.payload.email || "").trim().toLowerCase();
  const itemDomain = normalizeDomainForMatch(item.payload.url || (item.payload.urls && item.payload.urls[0]) || "");
  const itemTemplate = item.template || item.payload._template || "login";

  for (const existing of existingItems) {
    const exName = (existing.name || "").trim().toLowerCase();
    const exUser = (existing.username || "").trim().toLowerCase();
    const exDomain = normalizeDomainForMatch(existing.domain || "");
    const exTemplate = existing.template || "login";

    // 1. Exact match (Name + Username + Template)
    if (itemName && exName && itemName === exName && itemUser && exUser && itemUser === exUser && itemTemplate === exTemplate) {
      return {
        isDuplicate: true,
        matchType: "exact",
        matchedItemId: existing.id,
        matchedItemName: existing.name,
      };
    }

    // 2. Domain + Username match (e.g. "Google" vs "google.com" or "accounts.google.com" with same username)
    const domainsMatch =
      itemDomain &&
      exDomain &&
      (itemDomain === exDomain ||
        itemDomain.endsWith("." + exDomain) ||
        exDomain.endsWith("." + itemDomain));

    if (domainsMatch && itemUser && exUser && itemUser === exUser && itemTemplate === exTemplate) {
      return {
        isDuplicate: true,
        matchType: "domain_and_username",
        matchedItemId: existing.id,
        matchedItemName: existing.name,
      };
    }

    // 3. For non-login templates (notes, cards, addresses, profiles) or logins without username:
    // Matches by Name + Template when neither has a username
    if (itemName && exName && itemName === exName && !itemUser && !exUser && itemTemplate === exTemplate) {
      return {
        isDuplicate: true,
        matchType: "name_only",
        matchedItemId: existing.id,
        matchedItemName: existing.name,
      };
    }

    // 4. For non-login items (like cards/notes/addresses/profiles): name matches
    if (itemTemplate !== "login" && itemTemplate === exTemplate && itemName && exName && itemName === exName) {
      return {
        isDuplicate: true,
        matchType: "name_only",
        matchedItemId: existing.id,
        matchedItemName: existing.name,
      };
    }
  }

  return {
    isDuplicate: false,
    matchType: "none",
  };
}

/**
 * Fast batch duplicate checker that indexes existing items into HashMaps for O(1) matching.
 */
export function checkDuplicateItemsBatch(
  items: ParsedImportItem[],
  existingItems: Array<{
    id: string;
    name: string;
    domain?: string | null;
    template?: string | null;
    username?: string | null;
  }>
): Map<string, DuplicateCheckResult> {
  const result = new Map<string, DuplicateCheckResult>();
  if (!items || items.length === 0) return result;

  // Index existing items
  const exactMap = new Map<string, { id: string; name: string }>();
  const domainUserMap = new Map<string, { id: string; name: string }>();
  const nonLoginNameMap = new Map<string, { id: string; name: string }>();
  const allExistingLoginsWithDomain: Array<{
    id: string;
    name: string;
    domain: string;
    username: string;
  }> = [];

  for (const ex of existingItems) {
    const exName = (ex.name || "").trim().toLowerCase();
    const exUser = (ex.username || "").trim().toLowerCase();
    const exDomain = normalizeDomainForMatch(ex.domain || "");
    const exTemplate = ex.template || "login";

    if (exTemplate === "login") {
      if (exName && exUser) {
        exactMap.set(`${exName}|${exUser}`, { id: ex.id, name: ex.name });
      }
      if (exDomain && exUser) {
        domainUserMap.set(`${exDomain}|${exUser}`, { id: ex.id, name: ex.name });
        allExistingLoginsWithDomain.push({
          id: ex.id,
          name: ex.name,
          domain: exDomain,
          username: exUser,
        });
      }
      if (exName && !exUser) {
        nonLoginNameMap.set(`${exName}|login`, { id: ex.id, name: ex.name });
      }
    } else {
      if (exName) {
        nonLoginNameMap.set(`${exName}|${exTemplate}`, { id: ex.id, name: ex.name });
      }
    }
  }

  for (const item of items) {
    const itemName = (item.name || "").trim().toLowerCase();
    const itemUser = (item.payload?.username || item.payload?.email || "").trim().toLowerCase();
    const itemDomain = normalizeDomainForMatch(
      item.payload?.url || (item.payload?.urls && item.payload.urls[0]) || ""
    );
    const itemTemplate = item.template || item.payload?._template || "login";

    let match: DuplicateCheckResult = { isDuplicate: false, matchType: "none" };

    if (itemTemplate === "login") {
      // 1. Exact match
      if (itemName && itemUser) {
        const exact = exactMap.get(`${itemName}|${itemUser}`);
        if (exact) {
          match = {
            isDuplicate: true,
            matchType: "exact",
            matchedItemId: exact.id,
            matchedItemName: exact.name,
          };
        }
      }

      // 2. Domain + User match
      if (!match.isDuplicate && itemDomain && itemUser) {
        const domainMatch = domainUserMap.get(`${itemDomain}|${itemUser}`);
        if (domainMatch) {
          match = {
            isDuplicate: true,
            matchType: "domain_and_username",
            matchedItemId: domainMatch.id,
            matchedItemName: domainMatch.name,
          };
        } else {
          // Check subdomain equivalence
          for (const ex of allExistingLoginsWithDomain) {
            if (
              ex.username === itemUser &&
              (itemDomain.endsWith("." + ex.domain) || ex.domain.endsWith("." + itemDomain))
            ) {
              match = {
                isDuplicate: true,
                matchType: "domain_and_username",
                matchedItemId: ex.id,
                matchedItemName: ex.name,
              };
              break;
            }
          }
        }
      }

      // 3. Login without username
      if (!match.isDuplicate && itemName && !itemUser) {
        const nameMatch = nonLoginNameMap.get(`${itemName}|login`);
        if (nameMatch) {
          match = {
            isDuplicate: true,
            matchType: "name_only",
            matchedItemId: nameMatch.id,
            matchedItemName: nameMatch.name,
          };
        }
      }
    } else {
      // 4. Non-login templates
      if (itemName) {
        const nonLoginMatch = nonLoginNameMap.get(`${itemName}|${itemTemplate}`);
        if (nonLoginMatch) {
          match = {
            isDuplicate: true,
            matchType: "name_only",
            matchedItemId: nonLoginMatch.id,
            matchedItemName: nonLoginMatch.name,
          };
        }
      }
    }

    result.set(item.id, match);
  }

  return result;
}

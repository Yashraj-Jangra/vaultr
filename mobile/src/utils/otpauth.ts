/**
 * OTPAuth URI and Secret Parser Utility
 * Parses otpauth://totp/ URIs and raw secret strings into structured TOTP metadata.
 */

export interface ParsedOtpAuth {
  secret: string;
  issuer?: string;
  label?: string;
  digits?: number;
  period?: number;
}

export function parseOtpAuthUri(input: string): ParsedOtpAuth | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();

  // Handle standard otpauth://totp/ format
  if (trimmed.toLowerCase().startsWith("otpauth://")) {
    try {
      // e.g. otpauth://totp/Google:alice@gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=Google
      const url = new URL(trimmed);
      const pathname = decodeURIComponent(url.pathname.replace(/^\/\/?/, ""));
      const params = url.searchParams;

      const secretParam = params.get("secret");
      if (!secretParam) return null;

      const cleanSecret = secretParam.replace(/[\s-]/g, "").toUpperCase();
      let issuer = params.get("issuer") || undefined;
      let label = pathname.replace(/^totp\//i, "");

      if (label.includes(":")) {
        const parts = label.split(":");
        if (!issuer) issuer = parts[0].trim();
        label = parts.slice(1).join(":").trim();
      }

      const digits = params.get("digits") ? parseInt(params.get("digits")!, 10) : undefined;
      const period = params.get("period") ? parseInt(params.get("period")!, 10) : undefined;

      return {
        secret: cleanSecret,
        issuer: issuer || undefined,
        label: label || undefined,
        digits,
        period,
      };
    } catch {
      // URL parsing failed, fall back to regex matching
      const secretMatch = trimmed.match(/[?&]secret=([A-Za-z2-7=]+)/i);
      if (secretMatch) {
        const cleanSecret = secretMatch[1].replace(/[\s-]/g, "").toUpperCase();
        const issuerMatch = trimmed.match(/[?&]issuer=([^&]+)/i);
        const issuer = issuerMatch ? decodeURIComponent(issuerMatch[1]) : undefined;
        return {
          secret: cleanSecret,
          issuer,
        };
      }
    }
  }

  // Handle raw Base32 secret string (e.g. JBSWY3DPEHPK3PXP)
  const cleanRawSecret = trimmed.replace(/[\s-]/g, "").toUpperCase();
  // Valid Base32 characters: A-Z, 2-7, optional = padding
  if (/^[A-Z2-7=]{8,}$/.test(cleanRawSecret)) {
    return {
      secret: cleanRawSecret,
    };
  }

  // If secret string is shorter or has mild formatting, try stripping non-base32
  const looseSecret = trimmed.replace(/[^A-Za-z2-7]/g, "").toUpperCase();
  if (looseSecret.length >= 8) {
    return {
      secret: looseSecret,
    };
  }

  return null;
}

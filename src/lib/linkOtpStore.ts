/**
 * src/lib/linkOtpStore.ts
 *
 * Simple in-memory OTP store for email/password account linking.
 * Keys are userId, values are { otp: string; expiresAt: number }.
 */

interface OtpData {
  otp: string;
  expiresAt: number;
}

const otpStore = new Map<string, OtpData>();

const TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateAndStoreOtp(userId: string): string {
  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + TTL_MS;
  otpStore.set(userId, { otp, expiresAt });
  return otp;
}

export function verifyOtp(userId: string, inputOtp: string): boolean {
  const stored = otpStore.get(userId);
  if (!stored) return false;

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(userId);
    return false;
  }

  const isValid = stored.otp === inputOtp.trim();
  if (isValid) {
    otpStore.delete(userId); // Use-once
  }
  return isValid;
}

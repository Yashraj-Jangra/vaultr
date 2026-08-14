/**
 * src/lib/linkOtpStore.ts
 *
 * Simple in-memory OTP store for email/password account linking.
 * Keys are userId, values are { otp: string; expiresAt: number }.
 */

import crypto from "crypto";

interface OtpData {
  otp: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpData>();

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

export function generateAndStoreOtp(userId: string): string {
  // Cryptographically secure 6-digit numeric OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + TTL_MS;
  otpStore.set(userId, { otp, expiresAt, attempts: 0 });
  return otp;
}

export function verifyOtp(userId: string, inputOtp: string): boolean {
  const stored = otpStore.get(userId);
  if (!stored) return false;

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(userId);
    return false;
  }

  stored.attempts += 1;
  const isValid = stored.otp === inputOtp.trim();

  if (isValid || stored.attempts >= MAX_ATTEMPTS) {
    // Invalidate immediately on success or upon exceeding maximum failed attempts
    otpStore.delete(userId);
  }

  return isValid;
}

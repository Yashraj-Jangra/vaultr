/**
 * src/lib/linkOtpStore.ts
 *
 * Distributed, database-backed OTP store for email/password account linking.
 * Persists codes in the Postgres `verification` table to guarantee resilience
 * across serverless cold-starts, horizontal multi-container scaling, and hot-reloads.
 */

import crypto from "crypto";
import { db } from "@/db";
import { verification } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function getIdentifier(userId: string): string {
  return `link_password:${userId}`;
}

interface StoredPayload {
  otp: string;
  attempts: number;
}

export async function generateAndStoreOtp(userId: string): Promise<string> {
  const identifier = getIdentifier(userId);
  const otp = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + TTL_MS);
  const now = new Date();

  // Clear any pre-existing OTP records for this user
  try {
    await db.delete(verification).where(eq(verification.identifier, identifier));
  } catch {
    // Non-fatal if delete fails
  }

  // Persist new OTP record with 0 initial attempts
  const payload: StoredPayload = { otp, attempts: 0 };
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: JSON.stringify(payload),
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  return otp;
}

export async function verifyOtp(userId: string, inputOtp: string): Promise<boolean> {
  const identifier = getIdentifier(userId);
  const now = new Date();

  // Find active, non-expired verification record
  const [record] = await db
    .select()
    .from(verification)
    .where(
      and(
        eq(verification.identifier, identifier),
        gt(verification.expiresAt, now)
      )
    )
    .limit(1);

  if (!record) {
    // Also clean up any lingering expired records for hygiene
    try {
      await db.delete(verification).where(eq(verification.identifier, identifier));
    } catch {}
    return false;
  }

  let payload: StoredPayload;
  try {
    payload = JSON.parse(record.value);
  } catch {
    // Fallback if value was stored as a raw OTP string
    payload = { otp: record.value, attempts: 0 };
  }

  payload.attempts += 1;
  const isValid = payload.otp === inputOtp.trim();

  if (isValid || payload.attempts >= MAX_ATTEMPTS) {
    // Immediately invalidate on success or max failed attempts
    await db.delete(verification).where(eq(verification.id, record.id));
  } else {
    // Update attempts counter
    await db
      .update(verification)
      .set({
        value: JSON.stringify(payload),
        updatedAt: now,
      })
      .where(eq(verification.id, record.id));
  }

  return isValid;
}

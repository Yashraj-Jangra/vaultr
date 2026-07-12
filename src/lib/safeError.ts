/**
 * src/lib/safeError.ts
 *
 * Returns a safe error message for API responses.
 * In development: returns the raw error message for easier debugging.
 * In production: returns a generic string to avoid leaking internals.
 */
export function safeError(err: unknown): string {
  if (process.env.NODE_ENV !== "production") {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
  }
  return "Internal Server Error";
}

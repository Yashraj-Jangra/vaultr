/**
 * src/db/index.ts
 *
 * Database connection pool — import `db` everywhere you need to query Postgres.
 * Uses a connection pool so Next.js API routes share connections efficiently.
 *
 * This file is SERVER-ONLY. Never import it in client components.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Reuse the pool across hot-reloads in development (Next.js HMR)
const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,                     // max simultaneous connections
    idleTimeoutMillis: 30_000,   // close idle connections after 30s
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export const db = drizzle(pool, { schema });
export type DB = typeof db;

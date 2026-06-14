import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./src/db/schema";

loadEnvConfig(process.cwd());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool, { schema });

async function run() {
  console.log("Truncating...");
  await db.delete(schema.vaultItems);
  await db.delete(schema.session);
  await db.delete(schema.account);
  await db.delete(schema.user);
  console.log("Done.");
  process.exit(0);
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});

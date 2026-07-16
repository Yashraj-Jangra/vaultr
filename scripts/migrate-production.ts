import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

async function runMigration() {
  console.log("[Migration] Checking database connection...");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ [Migration] DATABASE_URL is not defined in environment variables!");
    process.exit(1);
  }

  // Safely print host info without revealing password
  try {
    const url = new URL(dbUrl);
    console.log(`[Migration] Target host: ${url.host}, database: ${url.pathname}`);
  } catch (e) {
    console.log("[Migration] DATABASE_URL is not a standard connection URL. Connecting raw...");
  }

  const client = new Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log("✅ [Migration] Database connection established successfully.");
    
    const db = drizzle(client);
    console.log("[Migration] Running migrations from './drizzle/migrations'...");
    
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log("✅ [Migration] Migrations completed successfully!");
  } catch (error: any) {
    console.error("❌ [Migration] Migration failed with error:");
    console.error(error.stack || error.message || error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

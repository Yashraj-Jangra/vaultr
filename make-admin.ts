import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { user, userProfiles } from "./src/db/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

// Load environment variables from .env and .env.local
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

async function makeAdmin(email: string) {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const db = drizzle(client);

  console.log(`Searching for user with email: ${email}...`);

  try {
    const [targetUser] = await db.select().from(user).where(eq(user.email, email));
    
    if (!targetUser) {
      console.error(`❌ User with email ${email} not found.`);
      process.exit(1);
    }

    console.log(`Found user: ${targetUser.name} (${targetUser.id})`);

    // Update Better Auth user table
    await db.update(user).set({ role: "admin" }).where(eq(user.id, targetUser.id));
    
    // Upsert our app's userProfiles table
    await db.insert(userProfiles).values({
      userId: targetUser.id,
      displayName: targetUser.name,
      role: "admin",
    }).onConflictDoUpdate({
      target: userProfiles.userId,
      set: { role: "admin" },
    });

    console.log(`✅ Successfully made ${email} an admin!`);
  } catch (error) {
    console.error("❌ Error updating user:", error);
  } finally {
    await client.end();
  }
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx make-admin.ts <your-email>");
  process.exit(1);
}

makeAdmin(email);

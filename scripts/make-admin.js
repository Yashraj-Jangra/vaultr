const { Client } = require("pg");
require("dotenv").config();

async function makeAdmin(email) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`Searching for user with email: ${email}...`);

    // Find the user
    const res = await client.query('SELECT id, name FROM "user" WHERE email = $1', [email]);
    const targetUser = res.rows[0];

    if (!targetUser) {
      console.error(`❌ User with email ${email} not found.`);
      process.exit(1);
    }

    console.log(`Found user: ${targetUser.name} (${targetUser.id})`);

    // 1. Update Better Auth user table role to "admin"
    await client.query('UPDATE "user" SET role = $1 WHERE id = $2', ["admin", targetUser.id]);

    // 2. Upsert our app's userProfiles table
    const profileRes = await client.query('SELECT user_id FROM "user_profiles" WHERE user_id = $1', [targetUser.id]);
    
    if (profileRes.rows.length === 0) {
      // Insert
      await client.query(
        'INSERT INTO "user_profiles" (user_id, display_name, role) VALUES ($1, $2, $3)',
        [targetUser.id, targetUser.name, "admin"]
      );
    } else {
      // Update
      await client.query(
        'UPDATE "user_profiles" SET role = $1 WHERE user_id = $2',
        ["admin", targetUser.id]
      );
    }

    console.log(`✅ Successfully made ${email} an admin!`);
  } catch (error) {
    console.error("❌ Error updating user:", error);
  } finally {
    await client.end();
  }
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/make-admin.js <your-email>");
  process.exit(1);
}

makeAdmin(email);

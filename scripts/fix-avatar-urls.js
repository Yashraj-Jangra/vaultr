const { Client } = require("pg");
require("dotenv").config();

const NEW_PREFIX = `/api/avatars/`;

console.log(`[fix-avatar-urls] Will rewrite avatar URLs to relative proxy path: ${NEW_PREFIX}{key}`);
console.log();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL is not defined in environment variables!");
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log("✅ Database connection established.");

    // Fix Better Auth's user table
    await fixTable(client, "user", "image", "id");

    // Fix our custom user_profiles table (primary key is user_id)
    await fixTable(client, "user_profiles", "avatar_url", "user_id");

    console.log("✅ All avatar URLs fixed successfully.");
  } catch (err) {
    console.error("❌ Error running script:", err);
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
}

async function fixTable(client, tableName, column, pkColumn) {
  // Find rows with old direct MinIO URLs or absolute proxy URLs (anything not starting with relative /api/avatars/)
  const query = `
    SELECT "${pkColumn}", "${column}"
    FROM "${tableName}"
    WHERE ("${column}" LIKE '%/avatars/%' OR "${column}" LIKE '%/api/avatars/%')
      AND "${column}" NOT LIKE '/api/avatars/%'
      AND "${column}" NOT LIKE '%googleusercontent.com%'
  `;
  
  const res = await client.query(query);
  console.log(`[${tableName}.${column}] Found ${res.rows.length} rows to fix`);

  for (const row of res.rows) {
    const oldUrl = row[column];
    const pkValue = row[pkColumn];
    const match = oldUrl.match(/\/avatars\/(.+)$/);
    if (!match) {
      console.log(`  SKIP  ${oldUrl}`);
      continue;
    }
    const key = match[1];
    const newUrl = `${NEW_PREFIX}${key}`;
    console.log(`  FIX   ${oldUrl}`);
    console.log(`      → ${newUrl}`);

    const updateQuery = `
      UPDATE "${tableName}"
      SET "${column}" = $1
      WHERE "${pkColumn}" = $2
    `;
    await client.query(updateQuery, [newUrl, pkValue]);
  }
  console.log(`[${tableName}.${column}] Done.\n`);
}

main();

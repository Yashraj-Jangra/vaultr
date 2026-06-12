import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env' });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Error: DATABASE_URL not found in env.");
  process.exit(1);
}

const exportFilePath = process.argv[2];
if (!exportFilePath) {
  console.log("Usage: node scripts/migrate-firebase-to-postgres.mjs <path-to-firestore-export.json>");
  process.exit(1);
}

const rawData = fs.readFileSync(exportFilePath, 'utf8');
const data = JSON.parse(rawData);

const pool = new pg.Pool({ connectionString: dbUrl });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log("Starting migration transaction...");

    let usersCount = 0;
    let profilesCount = 0;
    let itemsCount = 0;

    // Traverse the firestore structure
    const collections = data.__collections__ || data;

    // 1. Process Users
    const usersCol = collections.users || {};
    for (const [uid, userDoc] of Object.entries(usersCol)) {
      const userMeta = userDoc.profile?.personal || {};
      const userSecurity = userDoc.profile?.security || {};
      
      const email = userDoc.email || userMeta.email || null;
      const displayName = userDoc.displayName || userMeta.displayName || `${userMeta.firstName || ''} ${userMeta.lastName || ''}`.trim() || null;
      
      // Insert into Better Auth's 'user' table
      const userExists = await client.query('SELECT id FROM "user" WHERE id = $1', [uid]);
      if (userExists.rows.length === 0) {
        await client.query(
          `INSERT INTO "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt") 
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [uid, displayName || 'User', email, true, userMeta.avatarUrl || null]
        );
        usersCount++;
      }

      // Insert into user_profiles
      await client.query(
        `INSERT INTO user_profiles (
          user_id, display_name, avatar_url, first_name, last_name, phone, 
          last_password_changed_at, new_device_email_alert, require_verification_on_new, role
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          avatar_url = EXCLUDED.avatar_url,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone,
          last_password_changed_at = EXCLUDED.last_password_changed_at,
          new_device_email_alert = EXCLUDED.new_device_email_alert,
          require_verification_on_new = EXCLUDED.require_verification_on_new`,
        [
          uid,
          displayName,
          userDoc.avatarUrl || userMeta.avatarUrl || null,
          userMeta.firstName || null,
          userMeta.lastName || null,
          userMeta.phone || null,
          userSecurity.lastPasswordChangedAt ? new Date(userSecurity.lastPasswordChangedAt) : null,
          userSecurity.newDeviceEmailAlert ?? true,
          userSecurity.requireVerificationOnNew ?? false,
          userDoc.role || 'user'
        ]
      );
      profilesCount++;

      // 2. Process Vault Items
      const userItems = userDoc.vaultItems || {};
      for (const [itemId, itemDoc] of Object.entries(userItems)) {
        await client.query(
          `INSERT INTO vault_items (
            id, user_id, name, encrypted_blob, domain, folder, template, 
            created_at, updated_at, favorite, has_totp, tags, deleted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            encrypted_blob = EXCLUDED.encrypted_blob,
            domain = EXCLUDED.domain,
            folder = EXCLUDED.folder,
            template = EXCLUDED.template,
            updated_at = EXCLUDED.updated_at,
            favorite = EXCLUDED.favorite,
            has_totp = EXCLUDED.has_totp,
            tags = EXCLUDED.tags,
            deleted_at = EXCLUDED.deleted_at`,
          [
            itemId,
            uid,
            itemDoc.name || 'Untitled Entry',
            itemDoc.encryptedBlob,
            itemDoc.domain || null,
            itemDoc.folder || null,
            itemDoc.template || 'login',
            itemDoc.createdAt ? new Date(itemDoc.createdAt) : new Date(),
            itemDoc.updatedAt ? new Date(itemDoc.updatedAt) : new Date(),
            itemDoc.favorite ?? false,
            itemDoc.hasTotp ?? false,
            itemDoc.tags || [],
            itemDoc.deletedAt ? new Date(itemDoc.deletedAt) : null
          ]
        );
        itemsCount++;
      }
    }

    // 3. Process Config settings
    const configCol = collections.config || {};
    if (configCol.site) {
      await client.query(
        `INSERT INTO config_site (id, data) VALUES (1, $1)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [configCol.site]
      );
    }
    
    const themesCol = configCol.themes?.list || {};
    for (const [themeId, themeDoc] of Object.entries(themesCol)) {
      await client.query(
        `INSERT INTO config_themes (id, data, published, built_in, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, published = EXCLUDED.published, built_in = EXCLUDED.built_in`,
        [themeId, themeDoc, themeDoc.published ?? true, themeDoc.builtIn ?? false]
      );
    }

    await client.query('COMMIT');
    console.log("Migration successful!");
    console.log(`- Migrated Users: ${usersCount}`);
    console.log(`- Migrated Profiles: ${profilesCount}`);
    console.log(`- Migrated Vault Items: ${itemsCount}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed, transaction rolled back:", err);
  } finally {
    client.release();
  }
}

migrate().then(() => pool.end());

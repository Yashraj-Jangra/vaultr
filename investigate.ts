import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

async function investigate() {
  const { db } = await import('./src/db/index');
  const { user, account, vaultItems } = await import('./src/db/schema');
  const users = await db.select().from(user);
  const accounts = await db.select().from(account);
  const items = await db.select().from(vaultItems);
  
  console.log('--- USERS ---');
  console.log(JSON.stringify(users, null, 2));
  
  console.log('\n--- ACCOUNTS ---');
  console.log(JSON.stringify(accounts, null, 2));

  console.log('\n--- ITEMS ---');
  console.log(JSON.stringify(items.map(i => ({ id: i.id, userId: i.userId })), null, 2));
  
  process.exit(0);
}

investigate();

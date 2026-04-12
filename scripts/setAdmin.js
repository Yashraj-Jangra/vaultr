const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Load .env.local variables manually since we might not have dotenv installed globally
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^([^=:]+?)[=:](.*)/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin credentials in .env.local!");
  console.error("Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.");
  process.exit(1);
}

// Replace literal "\n" strings in private key with actual newlines
privateKey = privateKey.replace(/\\n/g, "\n");

try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
} catch (error) {
  console.error("Failed to initialize Firebase Admin:");
  console.error(error);
  process.exit(1);
}

const targetEmail = process.argv[2];

if (!targetEmail) {
  console.error("Usage: node scripts/setAdmin.js <user-email>");
  process.exit(1);
}

async function setAdminClaim() {
  try {
    const user = await admin.auth().getUserByEmail(targetEmail);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`✅ Successfully granted admin privileges to ${targetEmail} (UID: ${user.uid})`);
    console.log(`The user may need to log out and log back in for the changes to take effect.`);
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ User not found with email: ${targetEmail}`);
    } else {
      console.error("❌ Error setting admin claim:");
      console.error(error);
    }
    process.exit(1);
  }
}

setAdminClaim();

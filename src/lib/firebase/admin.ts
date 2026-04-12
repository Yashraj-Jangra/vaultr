import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || "demo-project",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "demo@demo.iam.gserviceaccount.com",
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error("Firebase admin initialization failed. Check environment variables:", error);
  }
}

const adminAuth = admin.apps.length ? admin.auth() : null;
const adminDb = admin.apps.length ? admin.firestore() : null;

export { adminAuth, adminDb };

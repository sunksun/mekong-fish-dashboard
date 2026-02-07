import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let app;
let adminDb;

try {
  if (!admin.apps.length) {
    // For production with service account
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // For development/testing: use a mock credential
      // This works because Firestore Rules allow public read
      app = admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'tracking-fish-app',
        credential: admin.credential.applicationDefault(),
      });
    }
  } else {
    app = admin.apps[0];
  }

  adminDb = admin.firestore(app);

} catch (error) {
  console.warn('Firebase Admin initialization warning:', error.message);
  // For local development without credentials, use client SDK instead
  // The calling code should handle this gracefully
  adminDb = null;
}

export { adminDb, admin };
export default app;

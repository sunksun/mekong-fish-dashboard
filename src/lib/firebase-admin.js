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
    } else if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      // For production with separate env vars
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'tracking-fish-app',
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // For development: try application default credentials
      try {
        app = admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'tracking-fish-app',
          credential: admin.credential.applicationDefault(),
        });
      } catch (credError) {
        // If no credentials available, initialize without credentials
        // This will work for public Firestore collections via REST API
        console.warn('No Firebase Admin credentials found, initializing without auth');
        app = admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'tracking-fish-app',
        });
      }
    }
  } else {
    app = admin.apps[0];
  }

  adminDb = admin.firestore(app);

} catch (error) {
  console.error('Firebase Admin initialization error:', error);
  // For local development without credentials, use client SDK instead
  // The calling code should handle this gracefully
  adminDb = null;
}

export { adminDb, admin };
export default app;

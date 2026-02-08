const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC_your_api_key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "tracking-fish-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tracking-fish-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "tracking-fish-app.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateRecord() {
  try {
    const docRef = doc(db, 'fishingRecords', 'iuzjMaancs15MLr1MrRl');
    
    await updateDoc(docRef, {
      'location.waterSource': 'bung'
    });
    
    console.log('Document updated successfully with waterSource: bung');
  } catch (error) {
    console.error('Error updating document:', error);
  }
}

updateRecord().then(() => {
  console.log('Update completed');
  process.exit(0);
});
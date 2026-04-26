import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function addUserToFirestore() {
  try {
    const email = 'w_channarong@hotmail.com';
    const password = 'channarong004';
    
    console.log(`🔍 กำลัง login ด้วย: ${email}`);
    
    // Login เพื่อให้ได้ UID
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log(`✅ Login สำเร็จ! UID: ${user.uid}`);
    
    // สร้างข้อมูล profile
    const now = new Date();
    const userProfile = {
      uid: user.uid,
      email: user.email,
      role: 'RESEARCHER',
      name: 'Channarong',
      displayName: 'Channarong',
      phone: '',
      village: '',
      district: '',
      province: '',
      isActive: true,
      createdAt: Timestamp.fromDate(now),
      lastLogin: Timestamp.fromDate(now),
      lastActivity: now.toISOString()
    };
    
    console.log('📝 กำลังเพิ่มข้อมูลลง Firestore...');
    await setDoc(doc(db, 'users', user.uid), userProfile);
    
    console.log('✅ เพิ่มข้อมูล user สำเร็จ!');
    console.log('ข้อมูล:', JSON.stringify(userProfile, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.code, error.message);
    process.exit(1);
  }
}

addUserToFirestore();

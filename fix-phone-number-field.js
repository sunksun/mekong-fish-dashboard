/**
 * Script: fix-phone-number-field.js
 *
 * อัปเดต users collection ทุก document ที่มี phone field
 * แต่ไม่มี phoneNumber field (Mobile App ใช้ phoneNumber สำหรับ login)
 *
 * วิธีรัน:
 *   node fix-phone-number-field.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

// โหลด .env.local manually
const envFile = readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
});

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixPhoneNumberField() {
  console.log('🚀 เริ่มต้น script อัปเดต phoneNumber field...\n');

  try {
    const snapshot = await getDocs(collection(db, 'users'));
    console.log(`📋 พบ users ทั้งหมด: ${snapshot.docs.length} documents\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let noPhoneCount = 0;

    for (const userDoc of snapshot.docs) {
      const data = userDoc.data();
      const phone = data.phone;
      const phoneNumber = data.phoneNumber;

      // ถ้ามี phone แต่ไม่มี phoneNumber → อัปเดต
      if (phone && !phoneNumber) {
        await updateDoc(doc(db, 'users', userDoc.id), {
          phoneNumber: phone
        });
        console.log(`✅ อัปเดต: ${data.name || userDoc.id} → phoneNumber: ${phone}`);
        updatedCount++;
      }
      // ถ้ามีทั้งคู่แล้ว → ข้าม
      else if (phone && phoneNumber) {
        console.log(`⏭️  ข้าม: ${data.name || userDoc.id} (มี phoneNumber แล้ว: ${phoneNumber})`);
        skippedCount++;
      }
      // ถ้าไม่มีเบอร์โทรเลย → แจ้งเตือน
      else {
        console.log(`⚠️  ไม่มีเบอร์โทร: ${data.name || userDoc.id} (role: ${data.role})`);
        noPhoneCount++;
      }
    }

    console.log('\n📊 สรุปผล:');
    console.log(`  ✅ อัปเดตสำเร็จ:     ${updatedCount} documents`);
    console.log(`  ⏭️  ข้ามแล้ว (มีอยู่): ${skippedCount} documents`);
    console.log(`  ⚠️  ไม่มีเบอร์โทร:    ${noPhoneCount} documents`);
    console.log('\n✨ เสร็จสิ้น!');

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

fixPhoneNumberField();

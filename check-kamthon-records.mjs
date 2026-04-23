/**
 * Script: check-kamthon-records.mjs
 *
 * ตรวจสอบข้อมูลการจับปลาของ "นายกำธร นันทะนา" ใน Firestore
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

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

async function checkKamthonRecords() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ค้นหาข้อมูลการจับปลาของ "นายกำธร นันทะนา"');
    console.log('='.repeat(80) + '\n');

    // Step 1: ค้นหา user "นายกำธร นันทะนา"
    const usersQuery = query(
      collection(db, 'users'),
      where('name', '==', 'นายกำธร นันทะนา')
    );
    const usersSnapshot = await getDocs(usersQuery);

    if (usersSnapshot.empty) {
      console.log('❌ ไม่พบผู้ใช้ชื่อ "นายกำธร นันทะนา" ใน collection users');
      process.exit(0);
    }

    const userData = usersSnapshot.docs[0];
    const userId = userData.id;
    const userInfo = userData.data();

    console.log('👤 พบข้อมูลผู้ใช้:');
    console.log('   User ID:', userId);
    console.log('   ชื่อ:', userInfo.name);
    console.log('   เบอร์โทร:', userInfo.phone || userInfo.phoneNumber);
    console.log('   หมู่บ้าน:', userInfo.village);
    console.log('   อำเภอ:', userInfo.district);
    console.log('   จังหวัด:', userInfo.province);
    console.log('');

    // Step 2: ดึงข้อมูล fishingRecords ทั้งหมดของ user นี้
    const recordsQuery = query(
      collection(db, 'fishingRecords'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    const recordsSnapshot = await getDocs(recordsQuery);

    console.log(`📊 พบ ${recordsSnapshot.size} รายการบันทึกการจับปลา\n`);

    if (recordsSnapshot.empty) {
      console.log('❌ ไม่พบบันทึกการจับปลา');
      process.exit(0);
    }

    // Step 3: แสดงรายละเอียดแต่ละ record
    let index = 1;
    const year2568Start = new Date(2025, 0, 1); // January 1, 2025

    recordsSnapshot.forEach((doc) => {
      const data = doc.data();
      const catchDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
      const passYearFilter = catchDate >= year2568Start;

      console.log(`[${index}] Document ID: ${doc.id}`);
      console.log(`    วันที่จับ: ${catchDate.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`);
      console.log(`    วันที่จับ (ISO): ${catchDate.toISOString()}`);
      console.log(`    ✅ ผ่าน Year Filter (>= 1/1/2025)? ${passYearFilter ? 'ใช่' : 'ไม่ (จะถูก filter ออก)'}`);
      console.log(`    สถานที่: ${data.location?.spotName || data.location?.address?.formattedAddress || 'ไม่ระบุ'}`);
      console.log(`    แหล่งน้ำ: ${data.waterSource || 'ไม่ระบุ'}`);
      console.log(`    จำนวนชนิดปลา: ${data.fishList?.length || 0} ชนิด`);
      console.log(`    น้ำหนักรวม: ${data.totalWeight || 'ไม่ระบุ'} กก.`);
      console.log(`    สถานะยืนยัน: ${data.verified ? 'ยืนยันแล้ว ✅' : 'ยังไม่ยืนยัน ⚠️'}`);
      console.log(`    สร้างเมื่อ: ${data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('th-TH') : 'ไม่ระบุ'}`);

      if (data.fishList && data.fishList.length > 0) {
        console.log('    รายการปลา:');
        data.fishList.forEach((fish, i) => {
          console.log(`      ${i + 1}. ${fish.name || 'ไม่ระบุ'} - ${fish.count || 0} ตัว, ${fish.weight || 0} กก.`);
        });
      }

      console.log('');
      index++;
    });

    // สรุป
    const totalRecords = recordsSnapshot.size;
    const recordsPassingFilter = recordsSnapshot.docs.filter(doc => {
      const data = doc.data();
      const catchDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
      return catchDate >= year2568Start;
    }).length;
    const recordsFilteredOut = totalRecords - recordsPassingFilter;

    console.log('='.repeat(80));
    console.log('📈 สรุปผลการตรวจสอบ:');
    console.log(`   - รายการทั้งหมดใน Firestore: ${totalRecords} รายการ`);
    console.log(`   - รายการที่ผ่าน Year Filter (>= 1/1/2025): ${recordsPassingFilter} รายการ`);
    console.log(`   - รายการที่ถูก filter ออก: ${recordsFilteredOut} รายการ`);
    console.log('='.repeat(80) + '\n');

    if (recordsFilteredOut > 0) {
      console.log('💡 สาเหตุที่บางรายการไม่แสดงในหน้า fishing/records:');
      console.log('   หน้า fishing/records มี Year Filter ที่กรองเฉพาะข้อมูลตั้งแต่ 1 มกราคม 2025');
      console.log('   รายการที่มีวันที่จับก่อนหน้านี้จะถูกซ่อน\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
checkKamthonRecords();

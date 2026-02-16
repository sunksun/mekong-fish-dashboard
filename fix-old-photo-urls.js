// Script to fix old fishing records with local file paths
// Run with: node fix-old-photo-urls.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixOldPhotoURLs() {
  try {
    console.log('🔍 กำลังค้นหาข้อมูลที่มีปัญหา...\n');

    const snapshot = await db.collection('fishingRecords').get();

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const recordId = doc.id;

      // เช็คว่ามี fishList หรือไม่
      if (!data.fishList || !Array.isArray(data.fishList)) {
        skipped++;
        continue;
      }

      let needsUpdate = false;
      const updatedFishList = data.fishList.map(fish => {
        // ถ้า photo เป็น local path
        if (fish.photo && fish.photo.startsWith('file:///')) {
          console.log(`❌ พบ local path ใน record ${recordId}:`, fish.photo.substring(0, 60) + '...');
          needsUpdate = true;

          // ลบ photo field ออก (หรือเปลี่ยนเป็น null)
          return {
            ...fish,
            photo: null  // หรือใช้ undefined เพื่อลบ field
          };
        }
        return fish;
      });

      if (needsUpdate) {
        try {
          await doc.ref.update({
            fishList: updatedFishList
          });
          console.log(`✅ แก้ไข record ${recordId} สำเร็จ\n`);
          fixed++;
        } catch (error) {
          console.error(`❌ แก้ไข record ${recordId} ล้มเหลว:`, error.message);
          errors++;
        }
      } else {
        skipped++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 สรุปผล:');
    console.log(`  ทั้งหมด: ${snapshot.size} records`);
    console.log(`  แก้ไขสำเร็จ: ${fixed} records`);
    console.log(`  ข้าม (ไม่มีปัญหา): ${skipped} records`);
    console.log(`  ผิดพลาด: ${errors} records`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  } finally {
    process.exit();
  }
}

fixOldPhotoURLs();

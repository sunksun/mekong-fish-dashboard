import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import dotenv from 'dotenv';

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
const auth = getAuth(app);
const db = getFirestore(app);

async function fixFishSpecies() {
  try {
    console.log('🔍 Step 1: Searching for fish with name containing "สะงิ้ว" or "สะงั่ว"...\n');

    // Search in fish_species collection
    const fishSpeciesSnapshot = await getDocs(collection(db, 'fish_species'));
    let foundSpecies = [];

    fishSpeciesSnapshot.forEach((doc) => {
      const data = doc.data();
      const thaiName = data.thai_name || data.common_name_thai || '';
      const localName = data.local_name || '';

      if (thaiName.includes('สะงิ้ว') || thaiName.includes('สะงั่ว') ||
          localName.includes('สะงิ้ว') || localName.includes('สะงั่ว') ||
          localName.includes('นางสะงั้ว')) {
        foundSpecies.push({ id: doc.id, ...data });
      }
    });

    if (foundSpecies.length === 0) {
      console.log('❌ No fish species found with matching name');
      return;
    }

    console.log(`✅ Found ${foundSpecies.length} fish species:\n`);
    foundSpecies.forEach((fish, index) => {
      console.log(`${index + 1}. Document ID: ${fish.id}`);
      console.log(`   ชื่อไทย: ${fish.thai_name || fish.common_name_thai || 'N/A'}`);
      console.log(`   ชื่อท้องถิ่น: ${fish.local_name || 'N/A'}`);
      console.log(`   วงศ์: ${fish.group || 'N/A'}`);
      console.log(`   ชื่อวิทยาศาสตร์: ${fish.scientific_name || 'N/A'}`);
      console.log('');
    });

    // Update the fish species
    console.log('🔧 Step 2: Updating fish species data...\n');

    for (const fish of foundSpecies) {
      const updateData = {
        thai_name: 'สะงั่ว',
        local_name: 'นางสะงั้ว',
        group: 'วงศ์ปลาเนื้ออ่อน'
      };

      await updateDoc(doc(db, 'fish_species', fish.id), updateData);
      console.log(`✅ Updated document ${fish.id}`);
    }

    console.log('\n🔍 Step 3: Searching for fishing records with wrong spelling...\n');

    // Search fishing records
    const fishingRecordsSnapshot = await getDocs(collection(db, 'fishingRecords'));
    let recordsToUpdate = [];

    fishingRecordsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fishList && Array.isArray(data.fishList)) {
        const hasWrongSpelling = data.fishList.some(fish =>
          fish.name && fish.name.includes('สะงิ้ว')
        );
        if (hasWrongSpelling) {
          recordsToUpdate.push({ id: doc.id, data });
        }
      }
    });

    if (recordsToUpdate.length > 0) {
      console.log(`⚠️  Found ${recordsToUpdate.length} fishing records with wrong spelling\n`);

      console.log('🔧 Step 4: Updating fishing records...\n');

      for (const record of recordsToUpdate) {
        const updatedFishList = record.data.fishList.map(fish => {
          if (fish.name && fish.name.includes('สะงิ้ว')) {
            return { ...fish, name: 'สะงั่ว' };
          }
          return fish;
        });

        await updateDoc(doc(db, 'fishingRecords', record.id), {
          fishList: updatedFishList
        });
        console.log(`✅ Updated fishing record ${record.id}`);
      }
    } else {
      console.log('✅ No fishing records need updating\n');
    }

    console.log('\n✅ All updates completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Updated ${foundSpecies.length} fish species`);
    console.log(`   - Updated ${recordsToUpdate.length} fishing records`);
    console.log('\n💡 Next step: Verify the landing page now shows "วงศ์ปลาเนื้ออ่อน"');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
console.log('🚀 Starting fish species data fix...\n');
fixFishSpecies()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, getDoc, doc, query, orderBy } from 'firebase/firestore';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { withCors, corsPreflightResponse } from '@/lib/cors';

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.AUTHENTICATED, key: 'fish-verification' });
  if (rl.limited) return tooManyRequests(rl);
  const { searchParams } = new URL(request.url);
  const fishName = searchParams.get('fishName');

  // Detail mode: return all records that contain a specific fish name
  if (fishName) {
    try {
      const q = query(collection(db, 'fishingRecords'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const matchedDocs = [];

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const fishList = data.fishList || [];
        fishList.forEach((fish, index) => {
          const name = fish.name || fish.commonName || 'ไม่ระบุ';
          if (name === fishName) {
            matchedDocs.push({ docSnapshot, data, fish, index });
          }
        });
      });

      // Fetch user names for matched records
      const userIds = new Set(matchedDocs.map(m => m.data.userId).filter(Boolean));
      const usersMap = new Map();
      await Promise.all(Array.from(userIds).map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) usersMap.set(uid, userDoc.data());
        } catch (_) {}
      }));

      const records = matchedDocs.map(({ docSnapshot, data, fish, index }) => {
        const dateVal = data.date;
        let catchDate = null;
        if (dateVal && typeof dateVal === 'object' && dateVal.seconds) {
          catchDate = new Date(dateVal.seconds * 1000).toISOString().split('T')[0];
        } else if (typeof dateVal === 'string') {
          catchDate = dateVal;
        }
        const userData = usersMap.get(data.userId);
        return {
          recordId: docSnapshot.id,
          catchDate,
          location: data.location?.address?.province || data.location?.province || data.location?.district || data.location?.spotName || '',
          fisherName: userData?.name || 'ไม่ระบุ',
          fishIndex: index,
          currentName: fish.name || fish.commonName || 'ไม่ระบุ',
          localName: fish.localName || '',
          photo: fish.photo || null,
          weight: fish.weight || '',
          count: fish.count || '',
          fullFishList: data.fishList || [],
          fullFishData: data.fishData || null
        };
      });

      return withCors(NextResponse.json({ success: true, fishName, records }));
    } catch (error) {
      console.error('Error fetching fish records:', error);
      return withCors(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
    }
  }

  // Default mode: aggregated list of all fish
  try {
    const q = query(collection(db, 'fishingRecords'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);

    const fishMap = new Map();

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const fishList = data.fishList || [];

      fishList.forEach((fish) => {
        const name = fish.name || fish.commonName || 'ไม่ระบุ';

        if (!fishMap.has(name)) {
          fishMap.set(name, {
            name,
            localName: '',
            photo: null,
            allPhotos: new Set(),
            recordCount: 0
          });
        }

        const entry = fishMap.get(name);
        if (!entry.localName && fish.localName) {
          entry.localName = fish.localName;
        }
        if (!entry.photo && fish.photo) {
          entry.photo = fish.photo;
        }
        if (fish.photo) {
          entry.allPhotos.add(fish.photo);
        }
        entry.recordCount += 1;
      });
    });

    const results = [];
    fishMap.forEach((entry) => {
      results.push({
        name: entry.name,
        localName: entry.localName || '',
        photo: entry.photo || null,
        allPhotos: Array.from(entry.allPhotos),
        recordCount: entry.recordCount,
        hasPhoto: entry.photo !== null
      });
    });

    results.sort((a, b) => a.name.localeCompare(b.name, 'th'));

    const withPhoto = results.filter(r => r.hasPhoto).length;

    return withCors(NextResponse.json({
      success: true,
      total: results.length,
      withPhoto,
      withoutPhoto: results.length - withPhoto,
      data: results
    }));
  } catch (error) {
    console.error('Error fetching fish verification data:', error);
    return withCors(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
  }
}


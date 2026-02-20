import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

// Enable caching with revalidation every 2 minutes (120 seconds)
// Fish distribution data changes more frequently, so use shorter cache
export const revalidate = 120;

// GET: Fetch fish distribution data from fishingRecords
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRecords = parseInt(searchParams.get('limit')) || 50;

    // ดึงข้อมูลจาก fishingRecords
    const recordsRef = collection(db, 'fishingRecords');
    // Try to order by 'date' field (from mobile app) instead of 'createdAt'
    const q = query(recordsRef, orderBy('date', 'desc'), limit(limitRecords));

    const querySnapshot = await getDocs(q);

    let fishData = [];
    let totalFishCount = 0;
    const speciesSet = new Set();

    querySnapshot.forEach((doc) => {
      const record = doc.data();

      // ตรวจสอบว่ามี fishList และ coordinates (location.latitude format from mobile app)
      if (record.fishList && record.fishList.length > 0 &&
          record.location?.latitude &&
          record.location?.longitude) {

        // ใช้พิกัดจริง (originalLatitude/Longitude) ถ้ามี ไม่งั้นใช้ตัวที่มี randomized
        const actualLat = record.location.originalLatitude || record.location.latitude;
        const actualLng = record.location.originalLongitude || record.location.longitude;

        const baseLocation = {
          latitude: actualLat,
          longitude: actualLng,
          address: record.location.address?.formattedAddress || record.location.spotName || '',
          province: record.location.address?.province || '',
          district: record.location.address?.district || '',
          village: record.location.address?.village || ''
        };

        // แปลงแต่ละปลาใน fishList ให้เป็น marker แยกกัน
        record.fishList.forEach((fish, index) => {
          // เพิ่ม offset เล็กน้อย (~5-20 เมตร) เพื่อให้หมุดที่จุดเดียวกันแยกได้เมื่อ zoom เข้า
          const smallOffset = (Math.random() - 0.5) * 0.0002; // ~20 เมตร
          const smallOffsetLng = (Math.random() - 0.5) * 0.0002;

          const fishItem = {
            id: `${doc.id}-${fish.id || index}`,
            recordId: doc.id,
            species: fish.name || 'ไม่ระบุ',
            quantity: parseInt(fish.count) || 0,
            weight: parseFloat(fish.weight) || 0,
            minLength: parseFloat(fish.minLength) || 0,
            maxLength: parseFloat(fish.maxLength) || 0,
            price: parseFloat(fish.price) || 0,
            totalValue: (parseFloat(fish.price) || 0) * (parseInt(fish.count) || 0),

            // ใช้พิกัดจริง + offset เล็กน้อยเพื่อแยกหมุด
            latitude: baseLocation.latitude + smallOffset,
            longitude: baseLocation.longitude + smallOffsetLng,
            originalLatitude: baseLocation.latitude,
            originalLongitude: baseLocation.longitude,

            // Additional info
            location: baseLocation,
            catchDate: record.date?.toDate?.()?.toISOString() || record.date,
            timeOfDay: `${record.startTime || ''} - ${record.endTime || ''}`.trim(),
            weather: record.weather || '',
            waterLevel: record.waterLevel || '',
            waterSource: record.waterSource || '',
            fishingGear: record.fishingGear?.name || '',

            createdAt: record.createdAt?.toDate?.()?.toISOString() || record.createdAt
          };

          fishData.push(fishItem);
          totalFishCount += fishItem.quantity;
          speciesSet.add(fishItem.species);
        });
      }
    });

    // Calculate stats
    const stats = {
      total: fishData.length,
      totalRecords: querySnapshot.size,
      totalFishCount: totalFishCount,
      uniqueSpecies: speciesSet.size,
      speciesList: Array.from(speciesSet).sort()
    };

    return NextResponse.json({
      success: true,
      data: fishData,
      stats
    });

  } catch (error) {
    console.error('Error fetching fish distribution:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch fish distribution',
        message: error.message
      },
      { status: 500 }
    );
  }
}

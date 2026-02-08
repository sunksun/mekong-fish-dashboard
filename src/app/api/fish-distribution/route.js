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
    console.log('🔍 fish-distribution API: Found', querySnapshot.size, 'records');

    let fishData = [];
    let totalFishCount = 0;
    const speciesSet = new Set();

    querySnapshot.forEach((doc) => {
      const record = doc.data();

      // Debug log - check for location.latitude (direct structure from mobile app)
      const hasCoords = !!(record.location?.latitude && record.location?.longitude);
      console.log(`  📍 Record ${doc.id}: fishList=${record.fishList?.length || 0}, hasCoords=${hasCoords}, lat=${record.location?.latitude}, lng=${record.location?.longitude}`);

      // ตรวจสอบว่ามี fishList และ coordinates (location.latitude format from mobile app)
      if (record.fishList && record.fishList.length > 0 &&
          record.location?.latitude &&
          record.location?.longitude) {

        const baseLocation = {
          latitude: record.location.latitude,
          longitude: record.location.longitude,
          address: record.location.address?.formattedAddress || record.location.spotName || '',
          province: record.location.address?.province || '',
          district: record.location.address?.district || '',
          village: record.location.address?.village || ''
        };

        // แปลงแต่ละปลาใน fishList ให้เป็น marker แยกกัน
        record.fishList.forEach((fish, index) => {
          // สุ่มตำแหน่งเล็กน้อยรอบๆ จุดจับ (ภายใน 100-500 เมตร)
          const offset = (Math.random() - 0.5) * 0.005; // ~500m
          const offsetLng = (Math.random() - 0.5) * 0.005;

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

            // Location with slight offset
            latitude: baseLocation.latitude + offset,
            longitude: baseLocation.longitude + offsetLng,
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

    console.log('✅ Returning', fishData.length, 'fish markers');

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

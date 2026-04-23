import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const species = searchParams.get('species');
    const minDate = searchParams.get('minDate');
    const maxDate = searchParams.get('maxDate');

    if (!species) {
      return NextResponse.json({ success: false, error: 'species is required' }, { status: 400 });
    }

    const constraints = [];
    if (minDate) constraints.push(where('date', '>=', Timestamp.fromDate(new Date(minDate))));
    if (maxDate) constraints.push(where('date', '<', Timestamp.fromDate(new Date(maxDate))));

    const q = query(collection(db, 'fishingRecords'), ...constraints);
    const snapshot = await getDocs(q);

    const records = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Search in fishList (mobile) and fishData (dashboard)
      const sources = [
        ...(Array.isArray(data.fishList) ? data.fishList : []).map(f => ({
          name: f?.name,
          weight: f?.weight,
          count: f?.count,
          photo: f?.photo,
        })),
        ...(Array.isArray(data.fishData) ? data.fishData : []).map(f => ({
          name: f?.species || f?.name,
          weight: f?.weight,
          count: f?.quantity || f?.count,
          photo: f?.photo,
        })),
      ];

      const matchingFish = sources.filter(
        (f) => f?.name && String(f.name).trim() === species.trim()
      );

      if (matchingFish.length === 0) return;

      const weight = matchingFish.reduce((sum, f) => {
        const w = typeof f.weight === 'number' ? f.weight : parseFloat(f.weight) || 0;
        return sum + w;
      }, 0);
      const count = matchingFish.reduce((sum, f) => {
        const c = typeof f.count === 'number' ? f.count : parseInt(f.count) || 1;
        return sum + c;
      }, 0);

      // Collect all photos for this species from this record
      const photos = matchingFish.map(f => f.photo).filter(Boolean);

      // Parse date
      let catchDate = null;
      const rawDate = data.date || data.catchDate;
      if (rawDate && typeof rawDate.toDate === 'function') {
        catchDate = rawDate.toDate().toISOString();
      } else if (typeof rawDate === 'string') {
        catchDate = rawDate;
      }

      records.push({
        recordId: doc.id,
        catchDate,
        waterSource: data.waterSource || data.location?.waterSource || '',
        province: data.location?.province || '',
        spotName: data.location?.spotName || '',
        weight: parseFloat(weight.toFixed(2)),
        count,
        photos,
        photo: photos[0] || null,
        verified: data.verified === true,
        fisherName: data.fisherName || '',
      });
    });

    // Sort by date descending (nulls last)
    records.sort((a, b) => {
      if (!a.catchDate && !b.catchDate) return 0;
      if (!a.catchDate) return 1;
      if (!b.catchDate) return -1;
      return b.catchDate.localeCompare(a.catchDate);
    });

    const totalCount = records.reduce((s, r) => s + r.count, 0);
    const totalWeight = parseFloat(records.reduce((s, r) => s + r.weight, 0).toFixed(2));
    const totalPhotos = records.reduce((s, r) => s + r.photos.length, 0);

    return NextResponse.json({
      success: true,
      species,
      stats: {
        recordCount: records.length,
        totalCount,
        totalWeight,
        totalPhotos,
      },
      records,
    });
  } catch (err) {
    console.error('fish-detail API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

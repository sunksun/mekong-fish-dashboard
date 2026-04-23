import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const minDate = searchParams.get('minDate');
    const maxDate = searchParams.get('maxDate');

    const constraints = [];
    if (minDate) constraints.push(where('date', '>=', Timestamp.fromDate(new Date(minDate))));
    if (maxDate) constraints.push(where('date', '<', Timestamp.fromDate(new Date(maxDate))));

    const q = query(collection(db, 'fishingRecords'), ...constraints);
    const snapshot = await getDocs(q);

    // Map: species name → { count, totalWeight, recordCount }
    const speciesMap = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.fishList || !Array.isArray(data.fishList)) return;

      // Track which species appear in this record (for recordCount)
      const seenInRecord = new Set();

      data.fishList.forEach((fish) => {
        if (!fish || !fish.name) return;
        const name = String(fish.name).trim();
        if (!name || name === 'กุ้งจ่ม') return;

        if (!speciesMap[name]) {
          speciesMap[name] = { count: 0, totalWeight: 0, recordCount: 0 };
        }

        const cnt = typeof fish.count === 'number' ? fish.count : parseInt(fish.count) || 1;
        const w = typeof fish.weight === 'number' ? fish.weight : parseFloat(fish.weight) || 0;

        speciesMap[name].count += cnt;
        speciesMap[name].totalWeight += isFinite(w) ? w : 0;

        if (!seenInRecord.has(name)) {
          seenInRecord.add(name);
          speciesMap[name].recordCount++;
        }
      });
    });

    const species = Object.entries(speciesMap)
      .map(([name, val]) => ({
        name,
        count: val.count,
        totalWeight: parseFloat(val.totalWeight.toFixed(2)),
        recordCount: val.recordCount,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));

    const totalCount = species.reduce((s, x) => s + x.count, 0);
    const totalWeight = parseFloat(species.reduce((s, x) => s + x.totalWeight, 0).toFixed(2));

    return NextResponse.json({
      success: true,
      totalSpecies: species.length,
      totalCount,
      totalWeight,
      species,
    });
  } catch (err) {
    console.error('caught-species API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

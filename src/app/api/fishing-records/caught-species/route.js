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

    // Fetch fish species data to get local names
    const fishSpeciesSnapshot = await getDocs(collection(db, 'fish_species'));
    const fishSpeciesMap = new Map();
    fishSpeciesSnapshot.forEach(speciesDoc => {
      const speciesData = speciesDoc.data();
      const thaiName = speciesData.thai_name || speciesData.common_name_thai;
      if (thaiName && !fishSpeciesMap.has(thaiName)) {
        fishSpeciesMap.set(thaiName, {
          localName: speciesData.local_name || '',
          scientificName: speciesData.scientific_name || '',
          group: speciesData.group || ''
        });
      }
    });

    const q = query(collection(db, 'fishingRecords'), ...constraints);
    const snapshot = await getDocs(q);

    // Map: species name → { count, totalWeight, recordCount, localName }
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
          const speciesInfo = fishSpeciesMap.get(name);
          speciesMap[name] = {
            count: 0,
            totalWeight: 0,
            recordCount: 0,
            localName: speciesInfo?.localName || ''
          };
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
        localName: val.localName || '',
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

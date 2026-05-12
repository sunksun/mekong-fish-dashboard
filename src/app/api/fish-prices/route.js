import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

export async function GET() {
  try {
    const q = query(collection(db, 'fishingRecords'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);

    // Aggregate fish prices grouped by fish name
    const fishMap = new Map();

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const fishList = data.fishList || [];

      fishList.forEach((fish) => {
        const name = fish.name || fish.commonName || 'ไม่ระบุ';
        const price = parseFloat(fish.price) || 0;
        const weight = parseFloat(fish.weight) || 0;
        const count = parseInt(fish.count) || 0;

        if (!fishMap.has(name)) {
          fishMap.set(name, {
            name,
            localName: fish.localName || '',
            photo: null,
            prices: [],
            totalWeight: 0,
            totalCount: 0,
            recordCount: 0
          });
        }

        const entry = fishMap.get(name);
        if (!entry.photo && fish.photo) {
          entry.photo = fish.photo;
        }
        if (price > 0 && !isNaN(price)) {
          entry.prices.push(price);
        }
        entry.totalWeight += weight;
        entry.totalCount += count;
        entry.recordCount += 1;
      });
    });

    // Compute averages and filter to fish that have at least one price
    const results = [];
    fishMap.forEach((entry) => {
      if (entry.prices.length === 0) return;

      const avgPrice = entry.prices.reduce((a, b) => a + b, 0) / entry.prices.length;
      const avgPriceVal = isNaN(avgPrice) ? 0 : Math.round(avgPrice * 100) / 100;
      const minPriceVal = isNaN(Math.min(...entry.prices)) ? 0 : Math.min(...entry.prices);
      const maxPriceVal = isNaN(Math.max(...entry.prices)) ? 0 : Math.max(...entry.prices);
      results.push({
        name: entry.name,
        localName: entry.localName || '',
        photo: entry.photo || null,
        avgPrice: avgPriceVal,
        minPrice: minPriceVal,
        maxPrice: maxPriceVal,
        totalWeight: isNaN(entry.totalWeight) ? 0 : Math.round(entry.totalWeight * 100) / 100,
        totalCount: entry.totalCount || 0,
        recordCount: entry.recordCount || 0
      });
    });

    // Sort by avgPrice descending, take top 10
    results.sort((a, b) => b.avgPrice - a.avgPrice);
    const top10 = results.slice(0, 30);

    return NextResponse.json({ success: true, data: top10 });
  } catch (error) {
    console.error('Error fetching fish prices:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

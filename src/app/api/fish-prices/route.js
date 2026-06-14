import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // format: YYYY-MM
    const date = searchParams.get('date');   // format: YYYY-MM-DD (กรองเฉพาะวัน)

    // ดึงทุก records แล้ว filter ใน JS (รองรับทั้ง catchDate และ date field)
    const allSnap = await getDocs(collection(db, 'fishingRecords'));

    let snapshot = { forEach: (fn) => allSnap.forEach(fn) };

    if (date || month) {
      let startDate, endDate;
      if (date) {
        const [year, mon, day] = date.split('-').map(Number);
        startDate = new Date(year, mon - 1, day, 0, 0, 0);
        endDate = new Date(year, mon - 1, day, 23, 59, 59);
      } else {
        const [year, mon] = month.split('-').map(Number);
        startDate = new Date(year, mon - 1, 1);
        endDate = new Date(year, mon, 1);
      }

      const filtered = allSnap.docs.filter(doc => {
        const d = doc.data();
        // รองรับทั้ง catchDate (web) และ date (mobile)
        const raw = d.catchDate || d.date;
        if (!raw) return false;
        const ts = raw.toDate ? raw.toDate() : new Date(raw);
        return ts >= startDate && ts <= endDate;
      });
      snapshot = { forEach: (fn) => filtered.forEach(fn) };
    }

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

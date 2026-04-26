import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

const THAI_MONTH_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

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

    const monthlyMap = {};
    const speciesMap = {};
    const methodMap = {};
    const waterSourceMap = {};

    snapshot.forEach((doc) => {
      const data = doc.data();

      // --- Monthly trends (group by year-month) ---
      let dateObj = null;
      if (data.date && typeof data.date.toDate === 'function') {
        dateObj = data.date.toDate();
      }
      if (dateObj) {
        const yr = dateObj.getFullYear();
        const mo = dateObj.getMonth(); // 0-based
        const key = `${yr}-${String(mo + 1).padStart(2, '0')}`;
        if (!monthlyMap[key]) monthlyMap[key] = { catches: 0, weight: 0, value: 0, yr, mo };
        monthlyMap[key].catches++;
        monthlyMap[key].weight += typeof data.totalWeight === 'number'
          ? data.totalWeight
          : parseFloat(data.totalWeight) || 0;
        if (data.fishList && Array.isArray(data.fishList)) {
          data.fishList.forEach(fish => {
            if (!fish) return;
            const w = typeof fish.weight === 'number' ? fish.weight : parseFloat(fish.weight);
            const p = typeof fish.price === 'number' ? fish.price : parseFloat(fish.price);
            if (isFinite(w) && isFinite(p) && w > 0 && p > 0) {
              monthlyMap[key].value += w * p;
            }
          });
        }
      }

      // --- Species distribution (from fishList) ---
      if (data.fishList && Array.isArray(data.fishList)) {
        data.fishList.forEach(fish => {
          if (!fish || !fish.name) return;
          const name = String(fish.name).trim();
          if (!speciesMap[name]) speciesMap[name] = { count: 0, totalWeight: 0 };
          const cnt = typeof fish.count === 'number' ? fish.count : parseInt(fish.count) || 1;
          const w = typeof fish.weight === 'number' ? fish.weight : parseFloat(fish.weight) || 0;
          speciesMap[name].count += cnt;
          speciesMap[name].totalWeight += w;
        });
      }

      // --- Catch by fishing method ---
      const method = data.fishingGear?.name || data.method || 'ไม่ระบุ';
      methodMap[method] = (methodMap[method] || 0) + 1;

      // --- Catch by water source ---
      const waterSource = data.waterSource || 'ไม่ระบุ';
      waterSourceMap[waterSource] = (waterSourceMap[waterSource] || 0) + 1;
    });

    // Format: monthly trends sorted by date
    const monthlyTrends = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => ({
        month: `${THAI_MONTH_SHORT[val.mo]} ${String(val.yr + 543).slice(-2)}`,
        catches: val.catches,
        weight: parseFloat(val.weight.toFixed(1)),
        value: isFinite(val.value) ? Math.round(val.value) : 0,
      }));

    // Format: species top 15 by count
    const speciesDistribution = Object.entries(speciesMap)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 15)
      .map(([species, val]) => ({
        species,
        count: val.count,
        totalWeight: parseFloat(val.totalWeight.toFixed(1)),
      }));

    // Format: methods sorted by count desc
    const catchByMethod = Object.entries(methodMap)
      .sort(([, a], [, b]) => b - a)
      .map(([method, count]) => ({ method, count }));

    // Format: water sources sorted by count desc
    const catchByWaterSource = Object.entries(waterSourceMap)
      .sort(([, a], [, b]) => b - a)
      .map(([source, count]) => ({ source, count }));

    return NextResponse.json({
      success: true,
      charts: { monthlyTrends, speciesDistribution, catchByMethod, catchByWaterSource },
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch chart data', message: error.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

function shannonWiener(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return -counts.reduce((sum, n) => {
    if (n === 0) return sum;
    const p = n / total;
    return sum + p * Math.log(p);
  }, 0);
}

function simpsonD(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 1) return 0;
  const sumNiNi = counts.reduce((sum, n) => sum + n * (n - 1), 0);
  return 1 - sumNiNi / (total * (total - 1));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'monthly'; // monthly | yearly
    const year = searchParams.get('year') || String(new Date().getFullYear());

    const allSnap = await getDocs(collection(db, 'fishingRecords'));

    // Bucket records by period
    const buckets = {};

    allSnap.forEach(doc => {
      const d = doc.data();
      const raw = d.catchDate || d.date;
      if (!raw) return;
      const ts = raw.toDate ? raw.toDate() : new Date(raw);
      if (isNaN(ts)) return;

      let key;
      if (mode === 'monthly') {
        if (String(ts.getFullYear()) !== year) return;
        key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = String(ts.getFullYear());
      }

      if (!buckets[key]) buckets[key] = {};
      const fishList = d.fishList || [];
      fishList.forEach(fish => {
        const name = fish.name || fish.commonName || 'ไม่ระบุ';
        const count = parseInt(fish.count) || 1;
        buckets[key][name] = (buckets[key][name] || 0) + count;
      });
    });

    const results = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, speciesCounts]) => {
        const counts = Object.values(speciesCounts);
        const S = counts.length;
        const H = shannonWiener(counts);
        const D = simpsonD(counts);
        const total = counts.reduce((a, b) => a + b, 0);
        return {
          period,
          S,
          H: Math.round(H * 1000) / 1000,
          D: Math.round(D * 1000) / 1000,
          totalIndividuals: total,
          species: Object.entries(speciesCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 15)
            .map(([name, count]) => ({ name, count }))
        };
      });

    return NextResponse.json({ success: true, data: results, mode, year });
  } catch (error) {
    console.error('Biodiversity API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

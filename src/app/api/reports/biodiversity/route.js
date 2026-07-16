import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getRecordDate, getFishCount, getFishName, isExcludedSpecies } from '@/lib/firestore-helpers';
import { shannonWiener, simpsonD } from '@/lib/biodiversity-helpers';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { withCors, corsPreflightResponse } from '@/lib/cors';
import { requireAuth } from '@/lib/api-auth';

export async function OPTIONS() {
  return corsPreflightResponse();
}


export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.PUBLIC, key: 'reports-biodiversity' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'monthly'; // monthly | yearly
    const year = searchParams.get('year') || String(new Date().getFullYear());

    const allSnap = await getDocs(collection(db, 'fishingRecords'));

    // Bucket records by period
    const buckets = {};

    allSnap.forEach(doc => {
      const d = doc.data();
      const ts = getRecordDate(d);
      if (!ts) return;

      let key;
      if (mode === 'monthly') {
        if (String(ts.getFullYear()) !== year) return;
        key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = String(ts.getFullYear());
      }

      if (!buckets[key]) buckets[key] = {};
      (d.fishList || []).forEach(fish => {
        const name = getFishName(fish);
        if (isExcludedSpecies(name)) return; // ตัดกุ้งออกจากรายงาน
        buckets[key][name] = (buckets[key][name] || 0) + getFishCount(fish);
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

    return withCors(NextResponse.json({ success: true, data: results, mode, year }));
  } catch (error) {
    console.error('Biodiversity API error:', error);
    return withCors(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
  }
}

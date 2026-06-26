import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit as fbLimit } from 'firebase/firestore';
import { getRecordDate, getFishCount, getFishName, isExcludedSpecies } from '@/lib/firestore-helpers';
import { shannonWiener, simpsonD } from '@/lib/biodiversity-helpers';
import {
  multipleLinearRegression,
  seasonalEncode,
  buildClimatology,
} from '@/lib/enso-helpers';

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function loadONI(request) {
  try {
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/climate/oni`, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    const map = {};
    json.data.forEach(({ ym, oni }) => { map[ym] = oni; });
    return { map, latest: json.latest };
  } catch (e) {
    return null;
  }
}

async function loadWaterLevels() {
  try {
    const q = query(collection(db, 'waterLevels'), orderBy('date', 'desc'), fbLimit(2000));
    const snap = await getDocs(q);
    const byMonth = {};
    const counts = {};
    snap.forEach(doc => {
      const d = doc.data();
      const raw = d.date;
      if (!raw) return;
      const dt = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
      if (isNaN(dt.getTime())) return;
      const key = toMonthKey(dt);
      const lvl = parseFloat(d.currentLevel ?? d.waterLevel);
      if (!Number.isFinite(lvl)) return;
      byMonth[key] = (byMonth[key] || 0) + lvl;
      counts[key] = (counts[key] || 0) + 1;
    });
    const avg = {};
    for (const k of Object.keys(byMonth)) avg[k] = byMonth[k] / counts[k];
    return avg;
  } catch (e) {
    return {};
  }
}

async function loadBiodiversityMonthly() {
  const snap = await getDocs(collection(db, 'fishingRecords'));
  const buckets = {};
  snap.forEach(doc => {
    const d = doc.data();
    const ts = getRecordDate(d);
    if (!ts) return;
    const key = toMonthKey(ts);
    if (!buckets[key]) buckets[key] = {};
    (d.fishList || []).forEach(fish => {
      const name = getFishName(fish);
      if (isExcludedSpecies(name)) return;
      buckets[key][name] = (buckets[key][name] || 0) + getFishCount(fish);
    });
  });
  const series = {};
  for (const [ym, sp] of Object.entries(buckets)) {
    const counts = Object.values(sp);
    series[ym] = {
      H: shannonWiener(counts),
      D: simpsonD(counts),
      S: counts.length,
      total: counts.reduce((a, b) => a + b, 0),
    };
  }
  return series;
}

function dataQualityTier(n) {
  if (n < 12) return {
    level: 'preliminary',
    label: 'ผลเบื้องต้น (Preliminary)',
    severity: 'warning',
    message: `เก็บข้อมูลแล้ว ${n} เดือน — ยังไม่ครบ 1 รอบฤดูกาล ผลพยากรณ์เป็นเพียงการประมาณการเบื้องต้นเพื่อใช้ประกอบการประชุมหารือเท่านั้น ไม่ควรใช้เป็นข้อสรุปเชิงนโยบาย`,
  };
  if (n < 24) return {
    level: 'indicative',
    label: 'ผลชี้แนะ (Indicative)',
    severity: 'info',
    message: `เก็บข้อมูลแล้ว ${n} เดือน — ครบ 1 รอบฤดูกาลแล้ว ใช้เป็นแนวทางได้แต่ยังควรรอข้อมูลเพิ่มเพื่อยืนยัน`,
  };
  if (n < 36) return {
    level: 'reliable',
    label: 'ผลน่าเชื่อถือ (Reliable)',
    severity: 'success',
    message: `เก็บข้อมูลแล้ว ${n} เดือน — เพียงพอสำหรับการพยากรณ์เชิงนโยบาย`,
  };
  return {
    level: 'robust',
    label: 'ผลแม่นยำสูง (Robust)',
    severity: 'success',
    message: `เก็บข้อมูลแล้ว ${n} เดือน — ครอบคลุมหลายรอบฤดูกาล ความเชื่อมั่นสูง`,
  };
}

function fitModel(rows, target) {
  // rows: [{ oniLag, waterAnom, monthSin, monthCos, H, D, S }]
  const X = rows.map(r => [r.oniLag, r.waterAnom, r.monthSin, r.monthCos]);
  const y = rows.map(r => r[target]);
  return multipleLinearRegression(X, y);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const oniLagMonths = Math.max(0, Math.min(12, Number(searchParams.get('oniLag') || 3)));

    const [oniInfo, waterByMonth, biodivByMonth] = await Promise.all([
      loadONI(request),
      loadWaterLevels(),
      loadBiodiversityMonthly(),
    ]);

    const waterClim = buildClimatology(waterByMonth);

    // Build aligned training rows — เฉพาะเดือนที่มี biodiversity + (ONI lag) + water
    const rows = [];
    const sortedKeys = Object.keys(biodivByMonth).sort();
    for (const ym of sortedKeys) {
      const [y, m] = ym.split('-').map(Number);
      const lagDate = new Date(y, m - 1 - oniLagMonths, 1);
      const lagYm = `${lagDate.getFullYear()}-${String(lagDate.getMonth() + 1).padStart(2, '0')}`;
      const oni = oniInfo?.map?.[lagYm];
      if (oni == null) continue;
      const waterAnom = waterClim.anomalyAt(ym);
      const { sin, cos } = seasonalEncode(m);
      const b = biodivByMonth[ym];
      rows.push({
        ym,
        oniLag: oni,
        waterAnom,
        monthSin: sin,
        monthCos: cos,
        H: b.H,
        D: b.D,
        S: b.S,
        total: b.total,
      });
    }

    const modelH = fitModel(rows, 'H');
    const modelD = fitModel(rows, 'D');
    const modelS = fitModel(rows, 'S');

    return NextResponse.json({
      success: true,
      oni: {
        latest: oniInfo?.latest ?? null,
        available: !!oniInfo,
        series: oniInfo?.map ?? {},
      },
      waterClimatology: waterClim.monthlyMean,
      history: rows,
      models: {
        H: modelH,
        D: modelD,
        S: modelS,
      },
      meta: {
        oniLagMonths,
        nTrain: rows.length,
        dataTier: dataQualityTier(rows.length),
      },
    });
  } catch (error) {
    console.error('ENSO forecast API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

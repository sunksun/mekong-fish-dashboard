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
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { withCors, corsPreflightResponse } from '@/lib/cors';
import { requireAuth } from '@/lib/api-auth';

export async function OPTIONS() {
  return corsPreflightResponse();
}

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
    const levelByMonth = {};
    const rainByMonth = {};
    const counts = {};
    snap.forEach(doc => {
      const d = doc.data();
      const raw = d.date;
      if (!raw) return;
      const dt = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
      if (isNaN(dt.getTime())) return;
      const key = toMonthKey(dt);
      const lvl = parseFloat(d.currentLevel ?? d.waterLevel);
      const rain = parseFloat(d.rainfall) || 0;
      if (!Number.isFinite(lvl)) return;
      levelByMonth[key] = (levelByMonth[key] || 0) + lvl;
      rainByMonth[key] = (rainByMonth[key] || 0) + rain; // total rainfall/เดือน
      counts[key] = (counts[key] || 0) + 1;
    });
    const avgLevel = {};
    for (const k of Object.keys(levelByMonth)) avgLevel[k] = levelByMonth[k] / counts[k];
    return { levelByMonth: avgLevel, rainByMonth };
  } catch (e) {
    return { levelByMonth: {}, rainByMonth: {} };
  }
}

/**
 * โหลด waterQuality (แม่น้ำโขงเท่านั้น) แยกเป็นรายเดือน
 * คืน { ym -> { temperature, pH, DO } } — ใช้เป็น covariates
 */
async function loadWaterQualityMonthly() {
  try {
    const snap = await getDocs(collection(db, 'waterQuality'));
    const byMonth = {}; // ym -> arrays
    snap.forEach(doc => {
      const d = doc.data();
      if (d.waterbody !== 'แม่น้ำโขง') return;
      const raw = d.measuredDate;
      if (!raw) return;
      const dt = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
      if (isNaN(dt.getTime())) return;
      const key = toMonthKey(dt);
      if (!byMonth[key]) byMonth[key] = { T: [], DO: [], pH: [] };
      if (d.temperature != null) byMonth[key].T.push(d.temperature);
      if (d.dissolvedOxygen != null) byMonth[key].DO.push(d.dissolvedOxygen);
      if (d.pH != null) byMonth[key].pH.push(d.pH);
    });
    const result = {};
    for (const [ym, obj] of Object.entries(byMonth)) {
      result[ym] = {
        T: obj.T.length ? obj.T.reduce((s, v) => s + v, 0) / obj.T.length : null,
        DO: obj.DO.length ? obj.DO.reduce((s, v) => s + v, 0) / obj.DO.length : null,
        pH: obj.pH.length ? obj.pH.reduce((s, v) => s + v, 0) / obj.pH.length : null,
      };
    }
    return result;
  } catch (e) {
    console.error('loadWaterQualityMonthly error:', e);
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

/**
 * Fit model — เลือกว่าจะใส่ water quality covariates ไหมตาม flag
 * base: ONI + waterAnom + rainAnom + seasonal (5 features)
 * enhanced: + tempAnom + doAnom + pHAnom (8 features)
 */
function fitModel(rows, target, includeWQ) {
  const X = rows.map(r => {
    const base = [r.oniLag, r.waterAnom, r.rainAnom, r.monthSin, r.monthCos];
    if (includeWQ) return [...base, r.tempAnom, r.doAnom, r.pHAnom];
    return base;
  });
  const y = rows.map(r => r[target]);
  return multipleLinearRegression(X, y);
}

export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.PUBLIC, key: 'reports-enso-forecast' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const oniLagMonths = Math.max(0, Math.min(12, Number(searchParams.get('oniLag') || 3)));

    const [oniInfo, waterData, biodivByMonth, wqByMonth] = await Promise.all([
      loadONI(request),
      loadWaterLevels(),
      loadBiodiversityMonthly(),
      loadWaterQualityMonthly(),
    ]);

    const { levelByMonth: waterByMonth, rainByMonth } = waterData;
    const waterClim = buildClimatology(waterByMonth);
    const rainClim = buildClimatology(rainByMonth);

    // Climatology สำหรับ T, DO, pH (สำหรับคำนวณ anomaly)
    const tempValues = {}, doValues = {}, phValues = {};
    for (const [ym, v] of Object.entries(wqByMonth)) {
      if (v.T != null) tempValues[ym] = v.T;
      if (v.DO != null) doValues[ym] = v.DO;
      if (v.pH != null) phValues[ym] = v.pH;
    }
    const tempClim = buildClimatology(tempValues);
    const doClim = buildClimatology(doValues);
    const phClim = buildClimatology(phValues);

    // Build aligned training rows — เฉพาะเดือนที่มี biodiversity + (ONI lag) + water
    const rows = [];
    const rowsWithWQ = []; // subset ที่มี water quality ครบด้วย
    const sortedKeys = Object.keys(biodivByMonth).sort();
    for (const ym of sortedKeys) {
      const [y, m] = ym.split('-').map(Number);
      const lagDate = new Date(y, m - 1 - oniLagMonths, 1);
      const lagYm = `${lagDate.getFullYear()}-${String(lagDate.getMonth() + 1).padStart(2, '0')}`;
      const oni = oniInfo?.map?.[lagYm];
      if (oni == null) continue;
      const waterAnom = waterClim.anomalyAt(ym);
      const rainAnom = rainClim.anomalyAt(ym);
      const { sin, cos } = seasonalEncode(m);
      const b = biodivByMonth[ym];
      const wq = wqByMonth[ym];
      const tempAnom = wq?.T != null ? tempClim.anomalyAt(ym) : null;
      const doAnom = wq?.DO != null ? doClim.anomalyAt(ym) : null;
      const pHAnom = wq?.pH != null ? phClim.anomalyAt(ym) : null;

      const row = {
        ym, oniLag: oni, waterAnom, rainAnom,
        monthSin: sin, monthCos: cos,
        tempAnom, doAnom, pHAnom,
        H: b.H, D: b.D, S: b.S, total: b.total,
      };
      rows.push(row);
      if (tempAnom != null && doAnom != null && pHAnom != null) {
        rowsWithWQ.push(row);
      }
    }

    // Base model (ONI + water anomaly + seasonality)
    const modelH = fitModel(rows, 'H', false);
    const modelD = fitModel(rows, 'D', false);
    const modelS = fitModel(rows, 'S', false);

    // Enhanced model (เพิ่ม T, DO, pH) — จะฟิตเฉพาะเมื่อมีข้อมูลเพียงพอ
    const hasEnoughWQ = rowsWithWQ.length >= 8;
    const modelHwq = hasEnoughWQ ? fitModel(rowsWithWQ, 'H', true) : null;
    const modelDwq = hasEnoughWQ ? fitModel(rowsWithWQ, 'D', true) : null;
    const modelSwq = hasEnoughWQ ? fitModel(rowsWithWQ, 'S', true) : null;

    return withCors(NextResponse.json({
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
      // Enhanced models (มี T/DO/pH เป็น covariates เพิ่ม)
      modelsEnhanced: hasEnoughWQ ? {
        H: modelHwq,
        D: modelDwq,
        S: modelSwq,
        nTrain: rowsWithWQ.length,
        note: 'base: β1=ONI β2=waterAnom β3=rainAnom β4=sin β5=cos · enhanced: +β6=tempAnom β7=DOanom β8=pHanom',
      } : null,
      waterQualityClimatology: {
        temperature: tempClim.monthlyMean,
        DO: doClim.monthlyMean,
        pH: phClim.monthlyMean,
      },
      meta: {
        oniLagMonths,
        nTrain: rows.length,
        nTrainWithWQ: rowsWithWQ.length,
        dataTier: dataQualityTier(rows.length),
        hasWaterQuality: hasEnoughWQ,
      },
    }));
  } catch (error) {
    console.error('ENSO forecast API error:', error);
    return withCors(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
  }
}

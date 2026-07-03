/**
 * Water Quality Analysis — aggregate + WQI + correlation + anomalies
 *
 * GET /api/reports/water-quality-analysis
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
  computeWQI, classifyWQI, checkStandard, MRC_STANDARDS,
  mean, pearson, detectAnomalies, monthlySummary, groupByMonth,
} from '@/lib/water-quality-helpers';
import { getRecordDate, getFishCount, getFishName, isExcludedSpecies } from '@/lib/firestore-helpers';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { withCors, corsPreflightResponse } from '@/lib/cors';

export const revalidate = 300;
export async function OPTIONS() { return corsPreflightResponse(); }

const KNOWN_WATERBODIES = ['แม่น้ำโขง', 'แม่น้ำเลย'];

function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function toMonthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.PUBLIC, key: 'water-quality-analysis' });
  if (rl.limited) return tooManyRequests(rl);

  try {
    // 1) ดึง waterQuality + fishingRecords parallel
    const [wqSnap, fishSnap] = await Promise.all([
      getDocs(collection(db, 'waterQuality')),
      getDocs(collection(db, 'fishingRecords')),
    ]);

    // 2) Parse waterQuality
    const records = [];
    wqSnap.forEach(doc => {
      const d = doc.data();
      const dt = toDate(d.measuredDate);
      if (!dt) return;
      if (!KNOWN_WATERBODIES.includes(d.waterbody)) return;
      records.push({
        id: doc.id,
        waterbody: d.waterbody,
        stationName: d.stationName || '',
        measuredDate: dt,
        temperature: d.temperature ?? null,
        pH: d.pH ?? null,
        tss: d.tss ?? null,
        ec: d.ec ?? null,
        dissolvedOxygen: d.dissolvedOxygen ?? null,
        arsenic: d.arsenic ?? null,
      });
    });
    records.sort((a, b) => a.measuredDate - b.measuredDate);

    // 3) Monthly summary + WQI per waterbody
    const summary = monthlySummary(records);

    // 4) Standards compliance count
    const params = ['temperature', 'pH', 'tss', 'ec', 'dissolvedOxygen', 'arsenic'];
    const compliance = {};
    for (const wb of KNOWN_WATERBODIES) {
      compliance[wb] = {};
      const wbRecs = records.filter(r => r.waterbody === wb);
      for (const p of params) {
        let pass = 0, warning = 0, critical = 0, unknown = 0;
        for (const r of wbRecs) {
          const c = checkStandard(p, r[p]);
          if (c.level === 'pass') pass++;
          else if (c.level === 'warning') warning++;
          else if (c.level === 'critical') critical++;
          else unknown++;
        }
        compliance[wb][p] = { pass, warning, critical, unknown, total: wbRecs.length };
      }
    }

    // 5) Anomaly detection ต่อ parameter
    const anomalies = {};
    for (const wb of KNOWN_WATERBODIES) {
      anomalies[wb] = {};
      const wbRecs = records.filter(r => r.waterbody === wb);
      for (const p of params) {
        const values = wbRecs.map(r => r[p]);
        const detected = detectAnomalies(values, 2.5);
        anomalies[wb][p] = detected
          .map((info, i) => info.isAnomaly ? {
            date: toMonthKey(wbRecs[i].measuredDate),
            value: info.value,
            zscore: info.zscore,
            fullDate: wbRecs[i].measuredDate.toISOString().split('T')[0],
          } : null)
          .filter(Boolean);
      }
    }

    // 6) Water quality by month key (สำหรับ correlation กับ fishing)
    const wqByMonth = {}; // month -> waterbody -> avg values
    for (const wb of KNOWN_WATERBODIES) {
      const wbRecs = records.filter(r => r.waterbody === wb);
      const byMonth = groupByMonth(wbRecs);
      for (const [ym, recs] of Object.entries(byMonth)) {
        if (!wqByMonth[ym]) wqByMonth[ym] = {};
        wqByMonth[ym][wb] = {
          temperature: mean(recs.map(r => r.temperature)),
          pH: mean(recs.map(r => r.pH)),
          tss: mean(recs.map(r => r.tss)),
          ec: mean(recs.map(r => r.ec)),
          dissolvedOxygen: mean(recs.map(r => r.dissolvedOxygen)),
          arsenic: mean(recs.map(r => r.arsenic)),
        };
      }
    }

    // 7) Fishing aggregation (monthly)
    const fishingByMonth = {}; // ym -> { totalCount, speciesSet, records }
    fishSnap.forEach(doc => {
      const d = doc.data();
      const dt = getRecordDate(d);
      if (!dt) return;
      const key = toMonthKey(dt);
      if (!fishingByMonth[key]) fishingByMonth[key] = { totalCount: 0, species: new Set(), records: 0 };
      fishingByMonth[key].records++;
      (d.fishList || []).forEach(fish => {
        const name = getFishName(fish);
        if (isExcludedSpecies(name)) return;
        fishingByMonth[key].totalCount += getFishCount(fish);
        fishingByMonth[key].species.add(name);
      });
    });

    // 8) Correlation ระหว่าง water quality (โขง) กับ fishing
    // เลือกใช้ waterbody = แม่น้ำโขง เพราะเป็นแหล่งหลัก
    const commonMonths = Object.keys(wqByMonth)
      .filter(m => fishingByMonth[m])
      .sort();

    const corrArr = { temperature: [], pH: [], dissolvedOxygen: [], tss: [], ec: [], arsenic: [] };
    const fishCountArr = [];
    const speciesRichnessArr = [];
    for (const m of commonMonths) {
      const wq = wqByMonth[m]['แม่น้ำโขง'];
      if (!wq) continue;
      for (const p of Object.keys(corrArr)) corrArr[p].push(wq[p]);
      fishCountArr.push(fishingByMonth[m].totalCount);
      speciesRichnessArr.push(fishingByMonth[m].species.size);
    }

    const correlations = {
      note: `${commonMonths.length} เดือนที่มีข้อมูลตรงกัน (แม่น้ำโขง)`,
      n: commonMonths.length,
      vsFishCount: {},
      vsSpeciesRichness: {},
    };
    for (const p of Object.keys(corrArr)) {
      correlations.vsFishCount[p] = pearson(corrArr[p], fishCountArr);
      correlations.vsSpeciesRichness[p] = pearson(corrArr[p], speciesRichnessArr);
    }

    // 9) Overall stats
    const overallStats = {};
    for (const wb of KNOWN_WATERBODIES) {
      const wbRecs = records.filter(r => r.waterbody === wb);
      overallStats[wb] = {
        n: wbRecs.length,
        dateRange: wbRecs.length > 0 ? {
          start: wbRecs[0].measuredDate.toISOString().split('T')[0],
          end: wbRecs[wbRecs.length - 1].measuredDate.toISOString().split('T')[0],
        } : null,
        avg: {},
      };
      for (const p of params) {
        overallStats[wb].avg[p] = mean(wbRecs.map(r => r[p]));
      }
    }

    return withCors(NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      waterbodies: KNOWN_WATERBODIES,
      standards: MRC_STANDARDS,
      totalRecords: records.length,
      overallStats,
      monthlySummary: summary,
      compliance,
      anomalies,
      correlations,
      commonMonths,
    }));
  } catch (error) {
    console.error('water-quality-analysis error:', error);
    return withCors(NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    ));
  }
}

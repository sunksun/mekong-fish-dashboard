/**
 * Water Quality Analysis helpers
 * - Water Quality Index (WQI) — สูตรอย่างง่ายสำหรับปลาน้ำจืด
 * - MRC standards comparison
 * - Correlation utilities
 * - Anomaly detection (Z-score)
 */

// ─────────────────────────────────────────────────────────
// MRC ค่ามาตรฐานคุณภาพน้ำผิวดิน (ประเภท 2 - อยู่อาศัย/แหล่งประมง)
// ─────────────────────────────────────────────────────────
export const MRC_STANDARDS = {
  pH: { min: 5.0, max: 9.0, label: 'pH', unit: '-' },
  dissolvedOxygen: { min: 6.0, max: null, label: 'DO', unit: 'mg/L' },
  tss: { min: null, max: 25.0, label: 'TSS', unit: 'mg/L' },
  arsenic: { min: null, max: 0.01, label: 'As', unit: 'mg/L' },
  temperature: { min: 20, max: 32, label: 'อุณหภูมิ', unit: '°C' }, // fish comfort zone
  ec: { min: null, max: 800, label: 'EC', unit: 'µS/cm' }, // ballpark
};

/**
 * ตรวจว่าค่า parameter เกินมาตรฐาน MRC ไหม
 * @returns { pass: boolean, level: 'pass'|'warning'|'critical' }
 */
export function checkStandard(param, value) {
  if (value == null || isNaN(value)) return { pass: null, level: 'unknown' };
  const std = MRC_STANDARDS[param];
  if (!std) return { pass: true, level: 'pass' };

  const belowMin = std.min != null && value < std.min;
  const aboveMax = std.max != null && value > std.max;

  if (belowMin || aboveMax) {
    // สำหรับ arsenic — เกินมาตรฐาน 2 เท่า = critical
    if (param === 'arsenic' && value > std.max * 2) return { pass: false, level: 'critical' };
    if (param === 'dissolvedOxygen' && value < 4) return { pass: false, level: 'critical' };
    if (param === 'tss' && value > 100) return { pass: false, level: 'critical' };
    return { pass: false, level: 'warning' };
  }
  return { pass: true, level: 'pass' };
}

// ─────────────────────────────────────────────────────────
// Sub-index scoring (0-100) สำหรับ Water Quality Index
// ─────────────────────────────────────────────────────────
function scoreDO(v) {
  if (v == null || isNaN(v)) return null;
  if (v >= 8) return 100;
  if (v >= 6) return 80 + ((v - 6) / 2) * 20;
  if (v >= 4) return 50 + ((v - 4) / 2) * 30;
  if (v >= 2) return 20 + ((v - 2) / 2) * 30;
  return Math.max(0, v * 10);
}

function scorePH(v) {
  if (v == null || isNaN(v)) return null;
  if (v >= 6.5 && v <= 8.5) return 100;
  if (v >= 6 && v < 6.5) return 80 + (v - 6) * 40;
  if (v > 8.5 && v <= 9) return 100 - (v - 8.5) * 40;
  if (v >= 5 && v < 6) return 50 + (v - 5) * 30;
  if (v > 9 && v <= 9.5) return 80 - (v - 9) * 60;
  return Math.max(0, 30 - Math.abs(v - 7) * 5);
}

function scoreTSS(v) {
  if (v == null || isNaN(v)) return null;
  if (v <= 25) return 100;
  if (v <= 50) return 80 - ((v - 25) / 25) * 20;
  if (v <= 100) return 60 - ((v - 50) / 50) * 20;
  if (v <= 500) return 40 - ((v - 100) / 400) * 30;
  return Math.max(0, 10 - v / 500);
}

function scoreTemp(v) {
  if (v == null || isNaN(v)) return null;
  if (v >= 25 && v <= 30) return 100;
  if (v >= 22 && v < 25) return 90 - (25 - v) * 5;
  if (v > 30 && v <= 33) return 90 - (v - 30) * 5;
  if (v >= 18 && v < 22) return 70 - (22 - v) * 5;
  if (v > 33 && v <= 36) return 70 - (v - 33) * 10;
  return Math.max(0, 40);
}

function scoreEC(v) {
  if (v == null || isNaN(v)) return null;
  if (v <= 300) return 100;
  if (v <= 500) return 80 - ((v - 300) / 200) * 20;
  if (v <= 800) return 60 - ((v - 500) / 300) * 30;
  return Math.max(0, 30 - (v - 800) / 100);
}

function scoreAs(v) {
  if (v == null || isNaN(v)) return null;
  if (v <= 0.005) return 100;
  if (v <= 0.01) return 80;
  if (v <= 0.02) return 50;
  if (v <= 0.05) return 20;
  return 0;
}

/**
 * Water Quality Index (0-100) — weighted average
 * นน. ตาม importance สำหรับปลา
 */
export function computeWQI(record) {
  const subScores = [
    { s: scoreDO(record.dissolvedOxygen), w: 0.30 },
    { s: scorePH(record.pH), w: 0.15 },
    { s: scoreTSS(record.tss), w: 0.15 },
    { s: scoreTemp(record.temperature), w: 0.15 },
    { s: scoreEC(record.ec), w: 0.10 },
    { s: scoreAs(record.arsenic), w: 0.15 },
  ];
  const valid = subScores.filter(x => x.s != null);
  if (valid.length === 0) return null;
  const totalWeight = valid.reduce((s, x) => s + x.w, 0);
  const wqi = valid.reduce((s, x) => s + x.s * x.w, 0) / totalWeight;
  return Math.round(wqi * 10) / 10;
}

/**
 * แปลง WQI → ระดับความคุณภาพน้ำ
 */
export function classifyWQI(wqi) {
  if (wqi == null) return { label: 'ไม่มีข้อมูล', color: '#9e9e9e', code: 'unknown' };
  if (wqi >= 90) return { label: 'ดีมาก', color: '#2e7d32', code: 'excellent' };
  if (wqi >= 70) return { label: 'ดี', color: '#66bb6a', code: 'good' };
  if (wqi >= 50) return { label: 'ปานกลาง', color: '#fbc02d', code: 'medium' };
  if (wqi >= 30) return { label: 'แย่', color: '#ef6c00', code: 'poor' };
  return { label: 'แย่มาก', color: '#c62828', code: 'very-poor' };
}

// ─────────────────────────────────────────────────────────
// Statistics
// ─────────────────────────────────────────────────────────
export function mean(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

export function stddev(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  if (valid.length < 2) return null;
  const m = mean(valid);
  const variance = valid.reduce((s, v) => s + (v - m) ** 2, 0) / (valid.length - 1);
  return Math.sqrt(variance);
}

/**
 * Pearson correlation coefficient (r)
 */
export function pearson(xs, ys) {
  const pairs = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] != null && ys[i] != null && !isNaN(xs[i]) && !isNaN(ys[i])) {
      pairs.push([xs[i], ys[i]]);
    }
  }
  if (pairs.length < 3) return null;
  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const denom = Math.sqrt(sxx * syy);
  if (denom === 0) return null;
  return Math.round((sxy / denom) * 1000) / 1000;
}

/**
 * Z-score based anomaly detection
 * @returns array of { index, value, zscore, isAnomaly }
 */
export function detectAnomalies(arr, threshold = 2.5) {
  const m = mean(arr);
  const s = stddev(arr);
  if (m == null || !s) return arr.map(() => ({ isAnomaly: false }));
  return arr.map((v, i) => {
    if (v == null || isNaN(v)) return { index: i, value: v, zscore: null, isAnomaly: false };
    const z = (v - m) / s;
    return { index: i, value: v, zscore: Math.round(z * 100) / 100, isAnomaly: Math.abs(z) > threshold };
  });
}

// ─────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────
export function groupByMonth(records) {
  const byMonth = {};
  for (const r of records) {
    if (!r.measuredDate) continue;
    const d = r.measuredDate instanceof Date ? r.measuredDate : new Date(r.measuredDate);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(r);
  }
  return byMonth;
}

export function groupByWaterbody(records) {
  const groups = {};
  for (const r of records) {
    const key = r.waterbody || 'ไม่ระบุ';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return groups;
}

/**
 * สรุปรายเดือน (ต่อ waterbody)
 */
export function monthlySummary(records) {
  const byWb = groupByWaterbody(records);
  const result = {};
  for (const [wb, wbRecords] of Object.entries(byWb)) {
    const byMonth = groupByMonth(wbRecords);
    result[wb] = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, recs]) => {
        const avgRec = {
          temperature: mean(recs.map(r => r.temperature)),
          pH: mean(recs.map(r => r.pH)),
          tss: mean(recs.map(r => r.tss)),
          ec: mean(recs.map(r => r.ec)),
          dissolvedOxygen: mean(recs.map(r => r.dissolvedOxygen)),
          arsenic: mean(recs.map(r => r.arsenic)),
        };
        const wqi = computeWQI(avgRec);
        return {
          period: ym,
          waterbody: wb,
          count: recs.length,
          ...avgRec,
          wqi,
          wqiClass: classifyWQI(wqi).code,
        };
      });
  }
  return result;
}

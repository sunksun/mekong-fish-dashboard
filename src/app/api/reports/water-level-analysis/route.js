/**
 * Water Level Analysis — daily trend + flood risk + extreme events
 *
 * GET /api/reports/water-level-analysis
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { mean, stddev, pearson, detectAnomalies } from '@/lib/water-quality-helpers';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { withCors, corsPreflightResponse } from '@/lib/cors';
import { requireAuth } from '@/lib/api-auth';

export const revalidate = 300;
export async function OPTIONS() { return corsPreflightResponse(); }

const WARNING_LEVEL = 14.0;
const CRITICAL_LEVEL = 16.0;
const HEAVY_RAIN_THRESHOLD = 50.0;

function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'string') return new Date(v);
  return new Date(v);
}

function toMonthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.PUBLIC, key: 'water-level-analysis' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await getDocs(query(collection(db, 'waterLevels'), orderBy('date', 'asc')));
    const records = [];
    snap.forEach(doc => {
      const d = doc.data();
      const dt = toDate(d.date);
      if (!dt || isNaN(dt.getTime())) return;
      records.push({
        id: doc.id,
        date: dt,
        dateStr: d.date,
        currentLevel: parseFloat(d.currentLevel) || 0,
        rainfall: parseFloat(d.rainfall) || 0,
        change: parseFloat(d.change) || 0,
      });
    });
    records.sort((a, b) => a.date - b.date);

    if (records.length === 0) {
      return withCors(NextResponse.json({ success: true, empty: true }));
    }

    // ── Overall stats ─────────────────────────────────────────
    const levels = records.map(r => r.currentLevel);
    const rainfalls = records.map(r => r.rainfall);
    const stats = {
      n: records.length,
      dateRange: {
        start: records[0].dateStr,
        end: records[records.length - 1].dateStr,
      },
      level: {
        mean: mean(levels),
        stddev: stddev(levels),
        min: Math.min(...levels),
        max: Math.max(...levels),
      },
      rainfall: {
        total: rainfalls.reduce((s, v) => s + v, 0),
        max: Math.max(...rainfalls),
        mean: mean(rainfalls),
        rainyDays: rainfalls.filter(r => r > 0).length,
        heavyDays: rainfalls.filter(r => r > HEAVY_RAIN_THRESHOLD).length,
      },
      thresholds: {
        WARNING_LEVEL,
        CRITICAL_LEVEL,
        HEAVY_RAIN_THRESHOLD,
      },
    };

    // ── Flood risk analysis (เกินตลิ่งวิกฤต) ─────────────────
    const criticalEvents = records.filter(r => r.currentLevel >= CRITICAL_LEVEL);
    const warningEvents = records.filter(r => r.currentLevel >= WARNING_LEVEL && r.currentLevel < CRITICAL_LEVEL);
    const floodRisk = {
      criticalCount: criticalEvents.length,
      warningCount: warningEvents.length,
      criticalDates: criticalEvents.slice(-20).map(r => ({
        date: r.dateStr, level: r.currentLevel, change: r.change,
      })),
      warningDates: warningEvents.slice(-20).map(r => ({
        date: r.dateStr, level: r.currentLevel, change: r.change,
      })),
    };

    // ── Heavy rainfall events ────────────────────────────────
    const heavyRainEvents = records
      .filter(r => r.rainfall > HEAVY_RAIN_THRESHOLD)
      .map(r => ({ date: r.dateStr, rainfall: r.rainfall, level: r.currentLevel }))
      .sort((a, b) => b.rainfall - a.rainfall)
      .slice(0, 20);

    // ── Rainfall-Runoff Correlation ──────────────────────────
    // ฝนวันที่ t → ระดับน้ำวันที่ t+lag
    const rainfallLagCorr = {};
    for (const lag of [0, 1, 2, 3, 5, 7]) {
      const xs = [], ys = [];
      for (let i = 0; i < records.length - lag; i++) {
        xs.push(records[i].rainfall);
        ys.push(records[i + lag].currentLevel);
      }
      rainfallLagCorr[`lag${lag}`] = pearson(xs, ys);
    }

    // ── Monthly aggregation ──────────────────────────────────
    const byMonth = {};
    for (const r of records) {
      const key = toMonthKey(r.date);
      if (!byMonth[key]) byMonth[key] = { levels: [], rainfalls: [] };
      byMonth[key].levels.push(r.currentLevel);
      byMonth[key].rainfalls.push(r.rainfall);
    }
    const monthlyStats = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, obj]) => ({
        period: ym,
        avgLevel: mean(obj.levels),
        maxLevel: Math.max(...obj.levels),
        minLevel: Math.min(...obj.levels),
        totalRainfall: obj.rainfalls.reduce((s, v) => s + v, 0),
        maxRainfall: Math.max(...obj.rainfalls),
        rainyDays: obj.rainfalls.filter(v => v > 0).length,
      }));

    // ── Yearly comparison ────────────────────────────────────
    const byYear = {};
    for (const r of records) {
      const yr = r.date.getFullYear();
      if (!byYear[yr]) byYear[yr] = { levels: [], rainfalls: [] };
      byYear[yr].levels.push(r.currentLevel);
      byYear[yr].rainfalls.push(r.rainfall);
    }
    const yearlyStats = Object.entries(byYear).map(([yr, obj]) => ({
      year: yr,
      thaiYear: Number(yr) + 543,
      n: obj.levels.length,
      avgLevel: mean(obj.levels),
      maxLevel: Math.max(...obj.levels),
      minLevel: Math.min(...obj.levels),
      totalRainfall: obj.rainfalls.reduce((s, v) => s + v, 0),
      heavyRainDays: obj.rainfalls.filter(v => v > HEAVY_RAIN_THRESHOLD).length,
    }));

    // ── Daily series (สำหรับกราฟ) ────────────────────────────
    const dailySeries = records.map(r => ({
      date: r.dateStr,
      level: r.currentLevel,
      rainfall: r.rainfall,
    }));

    // ── Level anomaly detection (Z-score) ────────────────────
    const levelAnomalies = detectAnomalies(levels, 2.5);
    const anomalies = levelAnomalies
      .map((info, i) => info.isAnomaly ? {
        date: records[i].dateStr,
        level: info.value,
        zscore: info.zscore,
        rainfall: records[i].rainfall,
      } : null)
      .filter(Boolean)
      .slice(-30);

    return withCors(NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      stats,
      floodRisk,
      heavyRainEvents,
      rainfallLagCorr,
      monthlyStats,
      yearlyStats,
      dailySeries,
      anomalies,
    }));
  } catch (error) {
    console.error('water-level-analysis error:', error);
    return withCors(NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    ));
  }
}

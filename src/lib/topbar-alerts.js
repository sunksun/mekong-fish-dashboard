/**
 * รวบรวมการแจ้งเตือนสำหรับ TopBar
 * ดึงข้อมูลครั้งเดียวตอน mount จาก 4 แหล่ง:
 *  1. waterLevels — ระดับน้ำสูงวิกฤต (>=16 ม.)
 *  2. waterLevels — ฝนตกหนัก (>50 มม.)
 *  3. fishingRecords + fish_species — ปลาหายาก (CR/EN/VU)
 *  4. sensorData — คุณภาพน้ำวิกฤต (status=critical/warning)
 */

import { db } from './firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { formatThaiShort } from './date-format';

const CRITICAL_WATER_LEVEL = 16.0;
const HEAVY_RAINFALL_MM = 50;
const RARE_STATUSES = new Set(['CR', 'EN', 'VU']);
const STATUS_THAI = { CR: 'ใกล้สูญพันธุ์อย่างยิ่ง', EN: 'ใกล้สูญพันธุ์', VU: 'เสี่ยงต่อการสูญพันธุ์' };

function toDate(raw) {
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

async function loadWaterAlerts() {
  const alerts = [];
  const q = query(collection(db, 'waterLevels'), orderBy('date', 'desc'), limit(7));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const d = doc.data();
    const dt = toDate(d.date);
    const level = parseFloat(d.currentLevel);
    const rain = parseFloat(d.rainfall);
    const station = d.station || d.location || 'ไม่ระบุสถานี';
    const dateLabel = dt ? formatThaiShort(dt) : '';

    if (!isNaN(level) && level >= CRITICAL_WATER_LEVEL) {
      alerts.push({
        id: `water-level-${doc.id}`,
        type: 'water-level',
        severity: 'critical',
        title: `ระดับน้ำสูงวิกฤต ${level.toFixed(2)} ม.`,
        detail: `สถานี ${station} · ${dateLabel}`,
        timestamp: dt || new Date(0),
      });
    }
    if (!isNaN(rain) && rain > HEAVY_RAINFALL_MM) {
      alerts.push({
        id: `rainfall-${doc.id}`,
        type: 'rainfall',
        severity: rain > 100 ? 'critical' : 'warning',
        title: `ฝนตกหนัก ${rain.toFixed(1)} มม.`,
        detail: `สถานี ${station} · ${dateLabel}`,
        timestamp: dt || new Date(0),
      });
    }
  });
  return alerts;
}

async function loadRareFishAlerts() {
  const alerts = [];
  // Map ชื่อปลาหายาก
  const speciesSnap = await getDocs(collection(db, 'fish_species'));
  const rareMap = new Map();
  speciesSnap.forEach(doc => {
    const data = doc.data();
    const status = data.iucn_status || data.conservation_status;
    if (!RARE_STATUSES.has(status)) return;
    const names = [data.thai_name, data.common_name_thai, data.scientific_name, data.local_name]
      .filter(Boolean)
      .map(n => n.toString().trim().toLowerCase());
    names.forEach(n => rareMap.set(n, { status, displayName: data.thai_name || data.common_name_thai || data.scientific_name }));
  });

  if (rareMap.size === 0) return alerts;

  // ดู fishingRecords ล่าสุด 50 รายการ
  const recQ = query(collection(db, 'fishingRecords'), orderBy('createdAt', 'desc'), limit(50));
  const recSnap = await getDocs(recQ);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  recSnap.forEach(doc => {
    const d = doc.data();
    const dt = toDate(d.date) || toDate(d.createdAt);
    if (!dt || dt < thirtyDaysAgo) return;
    if (!Array.isArray(d.fishList)) return;

    d.fishList.forEach((fish, idx) => {
      const fishName = (fish.name || fish.commonName || '').toString().trim().toLowerCase();
      if (!fishName) return;
      const hit = rareMap.get(fishName);
      if (!hit) return;
      const count = parseInt(fish.count) || 1;
      const fisher = d.fisherInfo?.name || 'ไม่ระบุ';
      alerts.push({
        id: `rare-${doc.id}-${idx}`,
        type: 'rare-fish',
        severity: hit.status === 'CR' ? 'critical' : 'warning',
        title: `ตรวจพบปลาหายาก: ${hit.displayName} (${STATUS_THAI[hit.status]})`,
        detail: `${count} ตัว โดย ${fisher} · ${formatThaiShort(dt)}`,
        timestamp: dt,
      });
    });
  });
  return alerts;
}

async function loadWaterQualityAlerts() {
  const alerts = [];
  const q = query(collection(db, 'sensorData'), orderBy('timestamp', 'desc'), limit(20));
  const snap = await getDocs(q);
  const latestByDevice = new Map();
  snap.forEach(doc => {
    const d = doc.data();
    const key = d.deviceId || doc.id;
    if (!latestByDevice.has(key)) latestByDevice.set(key, { id: doc.id, ...d });
  });

  for (const [, data] of latestByDevice) {
    if (data.status !== 'critical' && data.status !== 'warning') continue;
    const dt = toDate(data.timestamp);
    const turbidity = parseFloat(data.turbidity);
    const parts = [];
    if (!isNaN(turbidity)) parts.push(`ความขุ่น ${turbidity.toFixed(1)} NTU`);
    const tempVal = parseFloat(data.temperature);
    if (!isNaN(tempVal)) parts.push(`${tempVal.toFixed(1)}°C`);

    alerts.push({
      id: `wq-${data.id}`,
      type: 'water-quality',
      severity: data.status,
      title: data.status === 'critical' ? 'คุณภาพน้ำวิกฤต' : 'คุณภาพน้ำเตือนภัย',
      detail: `${data.deviceId || 'sensor'} · ${parts.join(' · ')}${dt ? ' · ' + formatThaiShort(dt) : ''}`,
      timestamp: dt || new Date(0),
    });
  }
  return alerts;
}

export async function loadTopBarAlerts() {
  const results = await Promise.allSettled([
    loadWaterAlerts(),
    loadRareFishAlerts(),
    loadWaterQualityAlerts(),
  ]);

  const all = [];
  results.forEach(r => {
    if (r.status === 'fulfilled') all.push(...r.value);
    else console.error('TopBar alert source failed:', r.reason);
  });

  all.sort((a, b) => b.timestamp - a.timestamp);
  return all.slice(0, 10);
}

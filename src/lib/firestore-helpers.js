/**
 * Helpers สำหรับจัดการข้อมูล Firestore ที่มีรูปแบบไม่สม่ำเสมอ
 * (Mobile app vs Web dashboard อาจใช้ field name ต่างกัน)
 */

/**
 * ดึงวันที่จับปลาจาก fishingRecord doc
 * รองรับทั้ง catchDate (web) และ date (mobile)
 * รองรับทั้ง Firestore Timestamp, Date object, และ ISO string
 *
 * @param {object} data - doc.data() จาก Firestore
 * @returns {Date|null} Date object หรือ null ถ้าไม่มีข้อมูล/parse ไม่ได้
 */
export function getRecordDate(data) {
  if (!data) return null;
  const raw = data.catchDate || data.date || data.timestamp;
  if (!raw) return null;

  // Firestore Timestamp มี method toDate()
  if (typeof raw.toDate === 'function') {
    const d = raw.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO string หรือ Date object
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * แปลง Date → YYYY-MM key สำหรับ aggregation
 */
export function toMonthKey(date) {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * แปลง Date → YYYY-MM-DD key
 */
export function toDayKey(date) {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * นับจำนวนปลาจาก fishList field — รองรับทั้ง count (mobile) และ quantity (web)
 */
export function getFishCount(fish) {
  if (!fish) return 0;
  const v = fish.count ?? fish.quantity ?? 1;
  return typeof v === 'number' ? v : (parseInt(v) || 1);
}

/**
 * ดึงน้ำหนัก (กก.)
 */
export function getFishWeight(fish) {
  if (!fish) return 0;
  const v = fish.weight ?? 0;
  return typeof v === 'number' ? v : (parseFloat(v) || 0);
}

/**
 * ดึงราคา (บาท/กก.)
 */
export function getFishPrice(fish) {
  if (!fish) return 0;
  const v = fish.price ?? 0;
  return typeof v === 'number' ? v : (parseFloat(v) || 0);
}

/**
 * ดึงชื่อสปีชีส์ (รองรับทั้ง name และ commonName)
 */
export function getFishName(fish) {
  if (!fish) return 'ไม่ระบุ';
  return (fish.name || fish.commonName || 'ไม่ระบุ').toString().trim();
}

/**
 * ชนิดที่ตัดออกจากรายงานวิเคราะห์ปลา (reports/*)
 * เพราะเป็นกุ้ง ไม่ใช่ปลา และจับได้ปริมาณมากต่อครั้ง
 * ทำให้บิดเบือนสถิติทั้งความหลากหลาย ความสัมพันธ์ระดับน้ำ และแนวโน้ม
 */
export const EXCLUDED_SPECIES_IN_REPORTS = new Set([
  'กุ้งจ่ม',
  'กุ้งฝอย',
  'กุ้งก้ามกราม',
]);

/**
 * ชื่อ placeholder ที่ไม่ควรนับเป็นชนิดปลาจริง (ใช้เพิ่มจาก EXCLUDED_SPECIES_IN_REPORTS
 * สำหรับหน้าที่ต้องการตัดข้อมูลไม่สมบูรณ์ออก เช่น dashboard, maps/analysis)
 */
export const PLACEHOLDER_SPECIES_NAMES = new Set([
  'ไม่ทราบชื่อปลา',
  'ไม่ทราบ',
  'ไม่ระบุ',
  '',
]);

/**
 * ตรวจว่า record นี้ถูก verify แล้วหรือยัง
 * source of truth เดียว — records ที่ไม่มี field verified ถือว่ายังไม่ verify
 */
export function isVerified(record) {
  return record?.verified === true;
}

/**
 * ตรวจว่า record ยังรอตรวจสอบ (undefined/null/false ถือว่ารอ)
 */
export function isPendingVerification(record) {
  return !isVerified(record);
}

/**
 * ตรวจว่าชนิดนี้ถูก exclude จากรายงานหรือไม่ (กุ้ง 3 ชนิด)
 */
export function isExcludedSpecies(name) {
  return EXCLUDED_SPECIES_IN_REPORTS.has((name || '').toString().trim());
}

/**
 * ตรวจว่าชนิดนี้ถูก exclude หรือเป็น placeholder ที่ไม่ใช่ปลาจริง
 * ใช้ใน dashboard/analytics ที่ต้องกรองข้อมูลไม่สมบูรณ์ออกด้วย
 */
export function isExcludedOrPlaceholder(name) {
  const trimmed = (name || '').toString().trim();
  return !trimmed || EXCLUDED_SPECIES_IN_REPORTS.has(trimmed) || PLACEHOLDER_SPECIES_NAMES.has(trimmed);
}

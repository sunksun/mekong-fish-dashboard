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

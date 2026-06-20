/**
 * Date formatting helpers — ใช้ปีพุทธศักราช (BE) ทั่วทั้งระบบ UI
 *
 * หลักการ:
 * - DB/API ใช้ ค.ศ. (ISO 8601, Firestore Timestamp)
 * - UI แสดงผู้ใช้ใช้ปีไทย พ.ศ. (เพิ่ม 543)
 */

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/**
 * แปลง ค.ศ. → พ.ศ.
 */
export function toThaiYear(year) {
  return Number(year) + 543;
}

/**
 * แปลง พ.ศ. → ค.ศ.
 */
export function fromThaiYear(year) {
  return Number(year) - 543;
}

/**
 * รูปแบบ "9 ม.ค. 2569"
 */
export function formatThaiShort(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${toThaiYear(d.getFullYear())}`;
}

/**
 * รูปแบบ "9 มกราคม 2569"
 */
export function formatThaiFull(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${THAI_MONTHS_FULL[d.getMonth()]} ${toThaiYear(d.getFullYear())}`;
}

/**
 * รูปแบบ "9 ม.ค. 2569 14:30"
 */
export function formatThaiDateTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatThaiShort(d)} ${hh}:${mm}`;
}

/**
 * รูปแบบ "ม.ค. 2569" (สำหรับ axis ของกราฟ)
 */
export function formatThaiMonthYear(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${THAI_MONTHS_SHORT[d.getMonth()]} ${toThaiYear(d.getFullYear())}`;
}

/**
 * รูปแบบ "ม.ค. 69" (สำหรับ axis แบบกระชับ)
 */
export function formatThaiMonthYearShort(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${THAI_MONTHS_SHORT[d.getMonth()]} ${String(toThaiYear(d.getFullYear())).slice(2)}`;
}

/**
 * จัดรูปแบบเดือนจาก index 0-11 เป็นชื่อไทยเต็ม
 */
export function getThaiMonthName(monthIndex) {
  return THAI_MONTHS_FULL[monthIndex] || '';
}

/**
 * จัดรูปแบบเดือนจาก index 0-11 เป็นชื่อไทยย่อ
 */
export function getThaiMonthShort(monthIndex) {
  return THAI_MONTHS_SHORT[monthIndex] || '';
}

/**
 * แปลง "2026-06" (ISO month) → "มิ.ย. 2569"
 */
export function thaiFormatYearMonth(ymString) {
  if (!ymString) return '';
  const [year, month] = ymString.split('-').map(Number);
  if (!year || !month) return ymString;
  return `${THAI_MONTHS_SHORT[month - 1]} ${toThaiYear(year)}`;
}

/**
 * แปลง "2026" (ค.ศ.) → "2569"
 */
export function thaiFormatYear(yearString) {
  return String(toThaiYear(yearString));
}

export { THAI_MONTHS_FULL, THAI_MONTHS_SHORT, THAI_DAYS_SHORT };

// ชุดคำถามประเมินผล 60 ข้อ สำหรับเปรียบเทียบ RAG (Condition B) vs Baseline LLM (Condition A)
//
// หมวด A: ข้อมูลชนิดปลา (20 ข้อ) — A01–A20
// หมวด B: สถิติการจับปลา (15 ข้อ) — B01–B15
// หมวด C: สภาพแวดล้อม (15 ข้อ) — C01–C15
// หมวด D: ความรู้ท้องถิ่น (10 ข้อ) — D01–D10
//
// difficulty:
//   - easy   = คำตอบสั้น 1 ข้อเท็จจริง อยู่ในเอกสารเดียว
//   - medium = ต้องรวมหลายข้อเท็จจริง / มีเงื่อนไข
//   - hard   = ต้อง reasoning / เปรียบเทียบ / อ้างอิงหลายเอกสาร
//
// ⚠️ ตัวอย่างด้านล่างเป็น seed สำหรับ demo — นักวิจัยต้องปรึกษาผู้เชี่ยวชาญ
// (ศูนย์วิจัยและพัฒนาประมงน้ำจืดเลย) เพื่อ finalize gold answers ก่อนใช้เก็บผลจริง

export const QUESTION_SET = [
  // ─── หมวด A: ข้อมูลชนิดปลา (A01–A20) ───────────────────────────────────────
  // easy: A01–A07
  { id: 'A01', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',
    question: 'ปลาบึกมีชื่อวิทยาศาสตร์ว่าอะไร',
    goldAnswer: 'Pangasianodon gigas — ปลาบึก (giant Mekong catfish) ในวงศ์ Pangasiidae' },
  { id: 'A02', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',
    question: 'ปลาแขยงจัดอยู่ในวงศ์อะไร',
    goldAnswer: 'วงศ์ Bagridae (ปลาหนัง)' },
  { id: 'A03', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',
    question: 'ปลาสวายมีชื่อท้องถิ่นอะไรบ้าง',
    goldAnswer: 'ชื่อท้องถิ่นในภาคอีสาน ได้แก่ ปลาสวาย, ปลาโมง' },
  { id: 'A04', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy', question: '', goldAnswer: '' },
  { id: 'A05', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy', question: '', goldAnswer: '' },
  { id: 'A06', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy', question: '', goldAnswer: '' },
  { id: 'A07', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy', question: '', goldAnswer: '' },
  // medium: A08–A14
  { id: 'A08', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium',
    question: 'ปลาที่มีสถานะ IUCN เป็น CR ในแม่น้ำโขงมีชนิดใดบ้าง',
    goldAnswer: 'ปลาบึก (Pangasianodon gigas) เป็น CR — ต้องอ้างจากฐานข้อมูล fish_species เท่านั้น' },
  { id: 'A09', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A10', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A11', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A12', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A13', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A14', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  // hard: A15–A20
  { id: 'A15', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',
    question: 'ปลาในวงศ์ Cyprinidae ที่พบในแม่น้ำโขงตอนบนมีลักษณะร่วมและต่างกันอย่างไร',
    goldAnswer: 'ตอบเชิงเปรียบเทียบ — ต้องอ้างจากฐานข้อมูลชนิดปลาในโครงการ ระบุลักษณะที่ตรงกับข้อมูล habitat/description ที่มี' },
  { id: 'A16', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'A17', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'A18', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'A19', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'A20', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard', question: '', goldAnswer: '' },

  // ─── หมวด B: สถิติการจับปลา (B01–B15) ──────────────────────────────────────
  // easy: B01–B05
  { id: 'B01', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',
    question: 'ในโครงการมีบันทึกการจับปลากี่ครั้ง',
    goldAnswer: 'ต้องอ้างจากสถิติปัจจุบันในฐานข้อมูล — ณ เดือน (เติมเดือน/ปี) มีบันทึกทั้งหมด N ครั้ง' },
  { id: 'B02', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy', question: '', goldAnswer: '' },
  { id: 'B03', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy', question: '', goldAnswer: '' },
  { id: 'B04', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy', question: '', goldAnswer: '' },
  { id: 'B05', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy', question: '', goldAnswer: '' },
  // medium: B06–B10
  { id: 'B06', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'B07', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'B08', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'B09', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'B10', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  // hard: B11–B15
  { id: 'B11', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'B12', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'B13', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'B14', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'B15', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard', question: '', goldAnswer: '' },

  // ─── หมวด C: สภาพแวดล้อม (C01–C15) ─────────────────────────────────────────
  // easy: C01–C05
  { id: 'C01', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',
    question: 'ระดับตลิ่งวิกฤตของแม่น้ำโขงที่เชียงคานอยู่ที่กี่เมตร',
    goldAnswer: '16.0 เมตร (ตามที่อ้างอิงใน threshold ของระบบและข้อมูล MRC สถานี CKH)' },
  { id: 'C02', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy', question: '', goldAnswer: '' },
  { id: 'C03', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy', question: '', goldAnswer: '' },
  { id: 'C04', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy', question: '', goldAnswer: '' },
  { id: 'C05', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy', question: '', goldAnswer: '' },
  // medium: C06–C10
  { id: 'C06', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'C07', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'C08', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'C09', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'C10', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium', question: '', goldAnswer: '' },
  // hard: C11–C15
  { id: 'C11', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'C12', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'C13', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'C14', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'C15', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard', question: '', goldAnswer: '' },

  // ─── หมวด D: ความรู้ท้องถิ่น (D01–D10) ──────────────────────────────────────
  // easy: D01–D03
  { id: 'D01', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'easy',
    question: 'ชาวประมงแม่น้ำโขงที่เชียงคานนิยมใช้เครื่องมือจับปลาชนิดใด',
    goldAnswer: 'ต้องอ้างจากคลัง fishingWisdom ที่โครงการเก็บได้ — ตอบตามภูมิปัญญาที่บันทึกในระบบเท่านั้น' },
  { id: 'D02', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'easy', question: '', goldAnswer: '' },
  { id: 'D03', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'easy', question: '', goldAnswer: '' },
  // medium: D04–D07
  { id: 'D04', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'D05', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'D06', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'D07', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium', question: '', goldAnswer: '' },
  // hard: D08–D10
  { id: 'D08', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'D09', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'hard', question: '', goldAnswer: '' },
  { id: 'D10', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'hard', question: '', goldAnswer: '' },
];

export const CATEGORY_LABELS = {
  A: 'ข้อมูลชนิดปลา',
  B: 'สถิติการจับปลา',
  C: 'สภาพแวดล้อม',
  D: 'ความรู้ท้องถิ่น',
};

export const SCORE_LABELS = {
  0: 'Wrong (ผิด/ไม่พบข้อมูลทั้งที่มี)',
  1: 'Partial (ตอบถูกบางส่วน)',
  2: 'Correct (ตอบถูกครบถ้วน)',
};

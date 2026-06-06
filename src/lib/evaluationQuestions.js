// ชุดคำถามประเมินผล 60 ข้อ สำหรับเปรียบเทียบ RAG vs No-RAG
//
// หมวด A: ข้อมูลชนิดปลา (20 ข้อ) — A01–A20
// หมวด B: สถิติการจับปลา (15 ข้อ) — B01–B15
// หมวด C: สภาพแวดล้อม (15 ข้อ) — C01–C15
// หมวด D: ความรู้ท้องถิ่น (10 ข้อ) — D01–D10
//
// difficulty: first third of each category = 'easy', second = 'medium', last = 'hard'
// กรุณากรอก question และ goldAnswer ก่อนใช้งาน

export const QUESTION_SET = [
  // ─── หมวด A: ข้อมูลชนิดปลา (A01–A20) ───────────────────────────────────────
  // easy: A01–A07
  { id: 'A01', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'A02', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'A03', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'A04', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'A05', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'A06', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'A07', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  // medium: A08–A14
  { id: 'A08', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A09', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A10', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A11', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A12', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A13', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'A14', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  // hard: A15–A20
  { id: 'A15', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'A16', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'A17', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'A18', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'A19', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'A20', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',   question: '', goldAnswer: '' },

  // ─── หมวด B: สถิติการจับปลา (B01–B15) ──────────────────────────────────────
  // easy: B01–B05
  { id: 'B01', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'B02', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'B03', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'B04', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'B05', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',  question: '', goldAnswer: '' },
  // medium: B06–B10
  { id: 'B06', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'B07', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'B08', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'B09', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'B10', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium', question: '', goldAnswer: '' },
  // hard: B11–B15
  { id: 'B11', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'B12', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'B13', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'B14', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'B15', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard',   question: '', goldAnswer: '' },

  // ─── หมวด C: สภาพแวดล้อม (C01–C15) ─────────────────────────────────────────
  // easy: C01–C05
  { id: 'C01', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'C02', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'C03', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'C04', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'C05', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',  question: '', goldAnswer: '' },
  // medium: C06–C10
  { id: 'C06', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'C07', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'C08', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'C09', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'C10', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium', question: '', goldAnswer: '' },
  // hard: C11–C15
  { id: 'C11', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'C12', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'C13', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'C14', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'C15', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard',   question: '', goldAnswer: '' },

  // ─── หมวด D: ความรู้ท้องถิ่น (D01–D10) ──────────────────────────────────────
  // easy: D01–D03
  { id: 'D01', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'D02', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'easy',  question: '', goldAnswer: '' },
  { id: 'D03', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'easy',  question: '', goldAnswer: '' },
  // medium: D04–D07
  { id: 'D04', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'D05', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'D06', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium', question: '', goldAnswer: '' },
  { id: 'D07', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium', question: '', goldAnswer: '' },
  // hard: D08–D10
  { id: 'D08', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'D09', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'hard',   question: '', goldAnswer: '' },
  { id: 'D10', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'hard',   question: '', goldAnswer: '' },
];

export const CATEGORY_LABELS = {
  A: 'ข้อมูลชนิดปลา',
  B: 'สถิติการจับปลา',
  C: 'สภาพแวดล้อม',
  D: 'ความรู้ท้องถิ่น',
};

export const SCORE_LABELS = {
  2: 'ถูกต้อง',
  1: 'บางส่วน',
  0: 'ผิด / ไม่เกี่ยวข้อง',
};

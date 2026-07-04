# Dataset — 60-question Thai Mekong Fish Biodiversity Benchmark

ชุดคำถามภาษาไทยสำหรับประเมิน RAG กับ Baseline LLM ในโดเมนความหลากหลายทางชีวภาพของพันธุ์ปลาแม่น้ำโขงตอนบน จ.เลย

## รูปแบบ

ไฟล์: [`src/lib/evaluationQuestions.js`](../src/lib/evaluationQuestions.js) — export `QUESTION_SET` เป็น array ของ:

```js
{
  id: 'A01',                    // รหัสไม่ซ้ำ (หมวด + ลำดับ)
  category: 'A',                // A | B | C | D
  categoryLabel: 'ข้อมูลชนิดปลา',
  difficulty: 'easy',           // easy | medium | hard
  question: 'ปลาบึกมีชื่อวิทยาศาสตร์ว่าอะไร',
  goldAnswer: 'Pangasianodon gigas — ...',
}
```

## สัดส่วน

| หมวด | รหัส | น จำนวน | easy | medium | hard | ที่มาของคำตอบ (แหล่งใน corpus) |
|---|---|---|---|---|---|---|
| A. ข้อมูลชนิดปลา | A01–A20 | 20 | 7 | 7 | 6 | `fish_species` |
| B. สถิติการจับปลา | B01–B15 | 15 | 5 | 5 | 5 | `fishingRecords` aggregates |
| C. สภาพแวดล้อม | C01–C15 | 15 | 5 | 5 | 5 | `waterLevels`, `sensorData` (indirect via docs) |
| D. ความรู้ท้องถิ่น | D01–D10 | 10 | 3 | 4 | 3 | `fishingWisdom` |
| **รวม** | | **60** | **20** | **21** | **19** | |

## ระดับความยาก

- **easy** — ข้อเท็จจริง 1 ข้อ อยู่ในเอกสารเดียว (single-hop)
- **medium** — รวมข้อเท็จจริงจากหลายฟิลด์ / มีเงื่อนไข
- **hard** — เปรียบเทียบ / reasoning / อ้างหลายเอกสาร (multi-hop)

## Gold answer authoring guidelines

1. **ต้องอ้างจากข้อมูลที่มีในระบบเท่านั้น** — ห้ามใช้ความรู้ภายนอกที่ไม่ได้อยู่ใน corpus
2. **สั้น กระชับ ระบุแหล่ง** — ระบุ `thai_name` + `scientific_name` เมื่อเกี่ยวกับปลา ระบุตัวเลขเมื่อเกี่ยวกับสถิติ
3. **ครอบคลุมเฉพาะข้อเท็จจริง** — ไม่ใส่ opinion, ไม่ใช้ hedging
4. **ตรวจโดยผู้เชี่ยวชาญ** — ทุก gold answer ผ่านการรับรองจากศูนย์วิจัยและพัฒนาประมงน้ำจืดเลย
5. **บันทึกวันที่ authoring** — สถิติเปลี่ยนตามเวลา ต้อง freeze ณ จุดเก็บผล

## Status

ปัจจุบันไฟล์ [`evaluationQuestions.js`](../src/lib/evaluationQuestions.js) มีตัวอย่าง seed 5 ข้อ (A01–A03, A08, A15, B01, C01, D01) — **นักวิจัยต้องเติมอีก ~55 ข้อพร้อม gold answer** ก่อนใช้เก็บผลจริง

## Ethics

- ไม่ระบุตัวตนของ contributor ใน gold answer (มาจาก `fishingWisdom.contributorName` ที่มี consent)
- Corpus ทั้งหมดเป็นข้อมูลของโครงการ ได้รับความยินยอมจากชุมชน
- Dataset จะเปิด public พร้อม paper (CC BY 4.0)

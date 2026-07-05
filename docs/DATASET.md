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

| หมวด | รหัส | จำนวน | easy | medium | hard | ที่มาของคำตอบใน RAG corpus |
|---|---|---|---|---|---|---|
| A. ข้อมูลชนิดปลา | A01–A20 | 20 | 7 | 7 | 6 | `fish_species` (313 chunks) |
| B. สถิติการจับปลา | B01–B15 | 15 | 5 | 5 | 5 | `fishingRecords` (1,335 chunks) + `stats` virtual aggregate (8 chunks) |
| C. สภาพแวดล้อม | C01–C15 | 15 | 5 | 5 | 5 | ⚠️ ยังไม่ได้ index — `waterLevels`, `sensorData` ต้องเพิ่มก่อนเก็บผล (ดู Status ด้านล่าง) |
| D. ความรู้ท้องถิ่น | D01–D10 | 10 | 3 | 4 | 3 | `fishingWisdom` (7 chunks) |
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

_อัปเดต 2026-07-05_

### สิ่งที่พร้อมแล้ว
- ✅ Schema + format ของ 60 ข้อ ครบใน [`evaluationQuestions.js`](../src/lib/evaluationQuestions.js)
- ✅ Seed sample 6 ข้อ (A01, A02, A03, A08, A15, B01, C01, D01) พร้อม gold answer
- ✅ RAG corpus พร้อมรับคำถาม 3 หมวด (A, B, D) — ดู [RAG_ARCHITECTURE.md](RAG_ARCHITECTURE.md#corpus-indexed-sources)

### สิ่งที่ต้องทำก่อนเก็บผลจริง
- ⏳ **เติมคำถาม + gold answer อีก ~54 ข้อ** (จาก 6 ข้อที่มี) โดยปรึกษาผู้เชี่ยวชาญจากศูนย์วิจัยและพัฒนาประมงน้ำจืดเลย
- ⚠️ **เพิ่ม `waterLevels` + `sensorData` เข้า RAG corpus** — หมวด C (สภาพแวดล้อม) ยังไม่มี source ที่ index — ถ้าไม่เพิ่มก่อนเก็บผล คำถาม 15 ข้อในหมวดนี้ RAG จะไม่มีข้อมูล retrieve → ไม่ยุติธรรมกับ Cond B
- ⏳ **สร้าง corpus snapshot** — export ข้อมูลใน Firestore ณ วันเก็บผลเป็น JSON ตาม procedure ใน EVALUATION_PROTOCOL.md

## Ethics

- ไม่ระบุตัวตนของ contributor ใน gold answer (มาจาก `fishingWisdom.contributorName` ที่มี consent)
- Corpus ทั้งหมดเป็นข้อมูลของโครงการ ได้รับความยินยอมจากชุมชน
- Dataset จะเปิด public พร้อม paper (CC BY 4.0)

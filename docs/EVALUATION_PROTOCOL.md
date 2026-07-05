# Evaluation Protocol

โปรโตคอลการประเมินสำหรับเปรียบเทียบ RAG (Condition B) กับ Baseline LLM (Condition A) — ใช้อ้างอิงใน paper และให้ผู้อ่านทำซ้ำได้

## Research question

> RAG (Gemini 2.5 Flash + semantic retrieval ด้วย `gemini-embedding-001` 3072-dim) จะให้คำตอบที่ **ถูกต้องกว่า** และ **ยึดโยงกับหลักฐานได้ดีกว่า** LLM แบบทั่วไป (Gemini 2.5 Flash alone) ในงานตอบคำถามด้านความหลากหลายทางชีวภาพของพันธุ์ปลาแม่น้ำโขง (Thai QA) หรือไม่?

## Hypotheses

- **H₀**: ค่าเฉลี่ยคะแนน (mean score) ของ Cond A = Cond B
- **H₁**: mean(Cond B) > mean(Cond A) (ทดสอบสองด้านที่ α = 0.05)

## Conditions

| Condition | ตัวย่อ | ระบบ |
|---|---|---|
| A (baseline) | LLM | Gemini 2.5 Flash รับเฉพาะคำถาม ไม่มี external context |
| B (proposed) | RAG | เดียวกัน + top-5 chunks จาก corpus **1,673 chunks** ด้วย semantic retrieval |

ทั้งสอง condition **ใช้ generator ตัวเดียวกัน** และ **ผ่าน endpoint เดียวกัน (`/api/chat`)** — ความต่างอยู่ที่ retrieval layer เท่านั้น เพื่อควบคุมตัวแปรอื่นให้คงที่

**Corpus ปัจจุบัน:**

| Source | Chunks | ครอบคลุมคำถามหมวด |
|---|---|---|
| `fish_species` | 313 | A |
| `fishingWisdom` | 7 | D |
| `newsArticles` | 10 | — |
| `fishingRecords` | 1,335 | B (per-record queries) |
| `stats` (virtual aggregate) | 8 | B (aggregate queries) |
| **รวม** | **1,673** | |

## Benchmark dataset

- 60 คำถามภาษาไทย ครอบคลุม 4 หมวด × 3 ระดับความยาก
- แต่ละคำถามมี **gold answer** ที่ประเมินโดยผู้เชี่ยวชาญจากศูนย์วิจัยและพัฒนาประมงน้ำจืดเลย
- อยู่ที่ [`src/lib/evaluationQuestions.js`](../src/lib/evaluationQuestions.js) และ [DATASET.md](DATASET.md)

| หมวด | จำนวน | easy | medium | hard |
|---|---|---|---|---|
| A. ข้อมูลชนิดปลา | 20 | 7 | 7 | 6 |
| B. สถิติการจับปลา | 15 | 5 | 5 | 5 |
| C. สภาพแวดล้อม | 15 | 5 | 5 | 5 |
| D. ความรู้ท้องถิ่น | 10 | 3 | 4 | 3 |
| **รวม** | **60** | 20 | 21 | 19 |

## Metrics

### 1. Human evaluation score (primary)

- 0 = Wrong / ตอบผิด หรือระบุว่า "ไม่พบข้อมูล" ทั้งที่มีข้อมูลอยู่จริง
- 1 = Partial / ตอบถูกบางส่วน หรือไม่ครบตาม gold
- 2 = Correct / ตอบถูกครบตาม gold

Evaluator จะเห็นคำถาม, gold answer, และคำตอบของ 2 conditions พร้อมกัน แต่ไม่เห็นว่าคำตอบไหนมาจาก condition ใด (blind ในหน้า UI จริง — TODO ปิด label ในการวัดผลจริง)

### 2. Faithfulness / Groundedness (secondary — จุดเด่นของงาน)

RAGAS-inspired (Es et al., 2023): LLM-as-judge ให้แยกคำตอบเป็น atomic claims แล้วเช็คว่าแต่ละ claim ยืนยันได้จาก retrieved context หรือไม่:

```
groundedness = n_supported_claims / n_total_claims  ∈ [0, 1]
```

- Judge = Gemini 2.5 Flash, temperature = 0, JSON mode
- **สำหรับ Baseline (no context)** — chunks = [], claim ทั้งหมดถูก label unsupported → groundedness ≈ 0 (ยืนยันว่า baseline hallucinate)
- Endpoint: `POST /api/research/faithfulness`

### 3. Response time (tertiary)

- `retrieval_ms` + `generation_ms` = `total_ms` — เก็บใน `chatLogs`
- คาดว่า RAG จะช้ากว่า baseline ~200-500ms (embedding query + cosine)
- Trade-off เทียบกับ accuracy gain

## Statistical tests

- **Paired t-test** (α = 0.05, 2-tailed): เพราะทั้ง 60 คำถามเดียวกันตอบทั้ง 2 conditions → ข้อมูลจับคู่กัน
  - `src/lib/research-stats.js#pairedTTest`
  - ใช้กับ (a) mean score, (b) mean faithfulness
- **Cohen's kappa**: inter-rater agreement (ถ้ามีผู้ประเมิน ≥ 2 คน) — Landis & Koch 1977 interpretation
  - > 0.6 = substantial; 0.4–0.6 = moderate

## Procedure (Reproducibility)

1. **Build corpus**
   ```
   npm run embed:build
   ```
2. **Snapshot** — export corpus + evaluationQuestions ก่อนวันวัดผล (log timestamp)
3. **Run** — เปิด `/research/evaluation` กด "ส่งทั้งหมด" → รอ 60 คำถามเสร็จ (ครบ 2 conditions × faithfulness)
4. **Score** — 2 ผู้ประเมินให้คะแนน 0/1/2 อิสระ (ไม่คุยกัน) → บันทึกลง `evaluationResults`
5. **Aggregate** — เปิด `/research/results` → เห็น mean/SD/p-value/kappa
6. **Export** — กด "Download .tex" → ได้ตาราง LaTeX ใส่ paper
7. **Sanity check** — ทำซ้ำ SciPy/R ในสมุด Jupyter ที่แนบใน supplementary

## Threats to validity + mitigation

| Threat | Mitigation |
|---|---|
| LLM-as-judge bias (same-family) | ระบุใน limitations; ถ้าเป็นไปได้ทำ human sample-verify subset 20% |
| Sample size 60 (power) | ระบุ effect size ที่คาดใน power analysis; อาจต้อง repeat 3 seeds |
| Corpus snapshot drift | Snapshot ก่อนวัดผล + freeze `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| Prompt sensitivity | ระบุ prompt ทั้งหมดใน appendix; run once (no cherry-pick) |
| Cache warm-up | คำถามแรกจะ hit uncached embedding — warmup 5 คำถามทิ้งก่อนเก็บผล |
| Stats source drift | `stats` chunks คำนวณจาก `fishingRecords` — freeze snapshot ก่อนวัดผลและระบุใน paper |
| Corpus imbalance | fishingRecords (80% ของ corpus) อาจ dominate retrieval — ทดสอบด้วย category B queries แล้วเห็นว่า stats source ถูก retrieve เข้ามาก่อน (score 0.791) |

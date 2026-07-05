# RAG Architecture — Mekong Fish Dashboard

เอกสารนี้อธิบายสถาปัตยกรรมของระบบ Retrieval-Augmented Generation ที่ใช้ตอบคำถามด้านความหลากหลายทางชีวภาพของพันธุ์ปลาแม่น้ำโขง สำหรับใช้อ้างอิงใน paper และให้ reviewer ตรวจสอบซ้ำได้

## ภาพรวมระบบ

```
      ┌────────────────────┐
      │  ผู้ใช้ (คำถามไทย) │
      └─────────┬──────────┘
                │
                ▼
    ┌──────────────────────┐        ┌──────────────────────┐
    │  /api/chat  (Next.js)│        │  Firestore           │
    │  mode = rag | no-rag │        │  ├─ fish_species     │
    └────┬─────────────────┘        │  ├─ fishingWisdom    │
         │  (rag)                   │  ├─ newsArticles     │
         ▼                          │  ├─ fishingRecords   │
    ┌──────────────────────┐        │  └─ rag_embeddings ◄─┼──┐
    │ retriever            │◄───────┘     (chunk vectors)  │  │ build-embeddings.js
    │  1. embed query      │                               │  │ (offline, resume-safe)
    │  2. cosine top-k     │                               ▼  │
    │  3. return chunks    │                          ┌───────┴─────────┐
    └────┬─────────────────┘                          │ embed docs via   │
         │                                            │ gemini-embedding-│
         ▼                                            │  001 (Gemini)    │
    ┌──────────────────────┐                          └─────────────────┘
    │ Gemini 2.5 Flash     │
    │  system prompt +     │
    │  top-k chunks +      │
    │  question            │
    └────┬─────────────────┘
         │ answer with [n] citations
         ▼
    ┌──────────────────────┐
    │  chatLogs (Firestore)│  ← question, mode, retrieved_ids, response, latency
    └──────────────────────┘
```

## องค์ประกอบหลัก

| Layer | ไฟล์ | รายละเอียด |
|---|---|---|
| Embedding | `src/lib/rag/embed.js` | Gemini `gemini-embedding-001`, 3072-dim, taskType RETRIEVAL_QUERY/DOCUMENT |
| Chunking | `src/lib/rag/chunker.js` | Fish species = 1 chunk/species; wisdom & news = paragraph split (max 800 chars, overlap 100) |
| Chunking (build script) | `src/scripts/build-embeddings.js` | Fishing records = 1 chunk/record; stats = virtual aggregate chunks |
| Vector store | `src/lib/rag/vector-store.js` | Firestore collection `rag_embeddings`; in-memory cache TTL 5 นาที |
| Retriever | `src/lib/rag/retriever.js` | Cosine similarity, top-k (default 5) |
| Chat API | `src/app/api/chat/route.js` | รับ `{message, mode}`, retrieve, prompt-build, generate, log |
| Faithfulness judge | `src/lib/rag/faithfulness.js` | LLM-as-judge (Gemini 2.5 Flash, temperature=0), แยก claim → supported/unsupported → groundedness |
| Faithfulness API | `src/app/api/research/faithfulness/route.js` | endpoint สำหรับ evaluation UI |
| Statistics | `src/lib/research-stats.js` | Paired t-test (Numerical Recipes betacf), Cohen's kappa |

## Data flow (RAG mode)

1. Client POST `/api/chat` `{ message, mode: 'rag', topK: 5 }`
2. Rate limit (`EXPENSIVE` = 10 req/min per IP)
3. `retrieve(message, { k: 5 })`
   - Embed query → 3072-dim vector
   - Load all chunks (~1,700) from `rag_embeddings` (cached)
   - Cosine similarity all chunks → sort desc → slice top-k
4. Build prompt: system header + numbered chunks + question + instructions
5. Gemini 2.5 Flash `generateContent(prompt)`
6. Return `{ answer, context: { retrieved: [{id, source, score, preview}], timing } }`
7. Log to `chatLogs`: question, mode, retrieved chunk ids/scores, response, latencies (retrieval + generation)

## Data flow (Baseline / no-RAG mode)

1. Client POST `/api/chat` `{ message, mode: 'no-rag' }`
2. Skip retrieval
3. Prompt = system header + question only (no external context)
4. Gemini 2.5 Flash generates from parametric knowledge only
5. Log to `chatLogs` with `mode='no-rag'`, `n_retrieved=0`

## Corpus (indexed sources)

_ตัวเลข ณ วันที่ 2026-07-05 หลังรัน `npm run embed:build` ล่าสุด_

| Source | Firestore collection | ขนาด | จำนวน chunk | ตอบคำถามหมวด |
|---|---|---|---|---|
| ชนิดปลา | `fish_species` | 313 species | **313** (1/species) | A |
| ภูมิปัญญา | `fishingWisdom` | 5 entries | **7** | D |
| ข่าว | `newsArticles` | 3 articles | **10** | — |
| บันทึกจับปลา | `fishingRecords` | 1,338 records | **1,335** (1/record) | B (per-record) |
| สถิติ aggregate | `stats` (virtual) | คำนวณตอน build | **8** chunks | B (aggregate) |
| **รวม** | | | **1,673 chunks** | |

**หมายเหตุเกี่ยวกับ `stats`:** ไม่ใช่ Firestore collection จริง แต่เป็น virtual source
ที่ script คำนวณจาก `fishingRecords` ตอน `npm run embed:build` แล้วเก็บผลรวมเป็น 8 chunks:

| Chunk id | เนื้อหา |
|---|---|
| `overall` | สรุปภาพรวม (total records, total weight, total species) |
| `top-by-count` | ปลาที่จับได้บ่อยที่สุด 15 อันดับ (นับจำนวนตัว) |
| `top-by-weight` | ปลาที่มีน้ำหนักรวมมากที่สุด 15 อันดับ |
| `top-by-records` | ปลาที่ปรากฏใน record บ่อยที่สุด 15 อันดับ |
| `by-gear` | สถิติเครื่องมือประมงที่ใช้ |
| `by-location` | สถานที่จับปลาที่พบบ่อยที่สุด 20 อันดับ |
| `yearly` | จำนวนบันทึกรายปี |
| `monthly` | จำนวนบันทึกรายเดือน (24 เดือนล่าสุด) |

Stats source จะ **refresh ทุกครั้งที่รัน `npm run embed:build`** (ไม่ resume) เพื่อให้
ข้อมูลสถิติสด — ในขณะที่ source อื่นๆ (fish_species, fishingRecords ฯลฯ)
จะ resume-safe ข้าม chunk ที่ index ไว้แล้ว

ทดสอบ query "ปลาชนิดไหนจับได้บ่อยที่สุด 5 ชนิด" → Top-1 คือ `stats/top-by-count`
(score 0.791) → RAG ตอบคำถามเชิงสถิติได้โดยไม่ต้อง retrieve individual records พันกว่า chunks

## Model choices — เหตุผลเชิงงานวิจัย

- **Embedding: `gemini-embedding-001` (Gemini)** — production-stable model, ภาษาไทยรองรับดีมาก, 3072-dim ให้ representation richness สูงขึ้น, vendor เดียวกับ generator ทำให้ไม่ต้องจัดการ 2 SDK
  - _หมายเหตุ:_ Google เลิก support `text-embedding-004` ใน key ที่สร้างใหม่ตั้งแต่ปี 2026 — เอกสารเก่าที่ระบุ 768-dim สอดคล้องกับ `text-embedding-004` เดิม
- **Generator: `gemini-2.5-flash`** — ใช้ตัวเดียวทั้ง 2 conditions ควบคุมตัวแปร LLM ให้เหมือนกัน (fair comparison)
- **Similarity: cosine** — มาตรฐานสำหรับ semantic search, invariant ต่อ magnitude
- **top-k = 5** — สมดุลระหว่าง recall กับ context window; ปรับผ่าน env `RETRIEVER_TOP_K`
- **Judge: Gemini 2.5 Flash, temperature=0** — ลด variance ของ LLM-as-judge (limitation: same-family bias)

## Deployment Configuration (สำหรับ reviewer ทำซ้ำ)

ระบบ deploy บน **Firebase App Hosting** (Cloud Run backend) ที่ region `us-east4`
โดยเข้าถึงผ่าน `https://mekongfish.info/` ค่า config ที่จำเป็นสำหรับ reviewer:

| Parameter | Value | เหตุผล |
|---|---|---|
| Runtime | Cloud Run (fully managed) | Serverless, auto-scale |
| Region | `us-east4` | ค่าเริ่มต้นของ App Hosting |
| Container memory | **2048 MiB** | ต้อง 2 GiB สำหรับ RAG corpus 1,673 chunks + Firestore SDK overhead |
| Container CPU | 1 vCPU | เพียงพอสำหรับ cosine similarity ~1,700 vectors |
| Node.js V8 heap | **1792 MB** (via `NODE_OPTIONS=--max-old-space-size=1792`) | ต้อง set เอง — default V8 = 512 MB ไม่พอแม้ container 2 GiB |
| minInstances | 0 | Scale-to-zero (cold start ~15-25s) |
| maxInstances | 10 | Cap สำหรับควบคุมค่าใช้จ่าย |
| Concurrency | 80 requests/instance | Cloud Run default |

**หมายเหตุสำคัญ:**

1. **512 MiB ไม่พอ** — เคยลอง 512 → OOM (SIGABRT signal 6) ตอน load embeddings
2. **1024 MiB ก็ไม่พอ** — เพราะ Node V8 heap default = 512 MB ทำให้ Node OOM ก่อนที่ container จะ OOM
3. **ต้อง set NODE_OPTIONS ด้วย** — ไม่งั้น container memory มากแค่ไหน V8 ก็ใช้ได้แค่ 512 MB

**Memory breakdown ที่ observed จริง:**

| Component | Memory |
|---|---|
| Node.js + Next.js runtime baseline | ~300-400 MB |
| RAG corpus in-memory (1,673 × 3072-dim × 4 bytes + metadata) | ~65 MB |
| Firestore SDK batch load spike (temp buffers, parsing) | ~200-400 MB |
| Concurrent request handling buffer | ~100 MB |
| **Peak observed** | **~800-950 MB** |

Config ใน `apphosting.yaml`:
```yaml
runConfig:
  memoryMiB: 2048
  cpu: 1
  minInstances: 0
  maxInstances: 10
  concurrency: 80

env:
  - variable: NODE_OPTIONS
    value: "--max-old-space-size=1792"
    availability: [RUNTIME]
```

**Cost implications:**
- ที่ 100 requests/วัน (typical research traffic) ≈ ~$0.45/เดือน (~₿16)
- ที่ 1000 requests/วัน ≈ ~$4/เดือน (~₿145)
- Scale-to-zero ทำให้ไม่มีค่าใช้จ่ายตอนไม่มี traffic (แต่ต้องยอม cold start)

## Reproducibility

- Corpus snapshot — ทำ export `fish_species`, `fishingWisdom`, `newsArticles`, `fishingRecords` ก่อนวันที่วัดผล เก็บเป็น JSON ใน `docs/dataset-snapshot/`
- Stats snapshot — บันทึกผลลัพธ์ของ stats chunks (top-by-count ฯลฯ) ณ วันวัดผลลง log เพราะจะเปลี่ยนตามข้อมูลใหม่ที่เข้ามา
- Random seed — ไม่ใช้ (deterministic retrieval; generator ใช้ default sampling ตาม paper อธิบาย)
- Version pinning — `@google/generative-ai` v0.24.1, ระบุใน paper `Methods §X`
- Full log — `chatLogs` เก็บทุก request-response pair สำหรับ audit

## History (changelog หลักที่ควรทราบสำหรับ reviewer)

- **2026-07-06** — Production deployment fixes:
  - แก้ container memory 512 → **2048 MiB** (RAG corpus + Firestore SDK spike ทำให้ OOM)
  - เพิ่ม `NODE_OPTIONS=--max-old-space-size=1792` (V8 heap default 512 MB ไม่พอ)
  - Fix `EXCLUDED_SPECIES` sync กับ `firestore-helpers.js` (เพิ่ม `กุ้งจ่ม`)
  - Rebuild `stats` chunks — Top species ตอนนี้เริ่มด้วย "น้ำฝาย" ไม่ใช่ "กุ้งจ่ม"
- **2026-07-05** — เพิ่ม 2 sources ใหม่:
  - `fishingRecords` (1,335 chunks, 1 chunk/record) — ตอบคำถามระดับรายบันทึก
  - `stats` (virtual, 8 chunks) — ตอบคำถามเชิง aggregate (top species, by gear, by location, trends)
  - Corpus โต จาก **328 chunks → 1,673 chunks**
- **2026-07-04** — เปลี่ยน embedding model จาก `text-embedding-004` (768-dim) เป็น `gemini-embedding-001` (3072-dim) เนื่องจาก Google เลิก support model เดิมใน API key ใหม่
- **2026-07-03** — Initial semantic RAG implementation (fish_species + fishingWisdom + newsArticles = 328 chunks)

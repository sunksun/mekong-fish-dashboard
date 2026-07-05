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
         ▼                          │  └─ rag_embeddings ◄─┼──┐
    ┌──────────────────────┐        │     (chunk vectors)  │  │ build-embeddings.js
    │ retriever            │◄───────┘                      │  │ (offline, one-time)
    │  1. embed query      │                               │  │
    │  2. cosine top-k     │                               ▼  │
    │  3. return chunks    │                          ┌───────┴────────┐
    └────┬─────────────────┘                          │ embed docs via  │
         │                                            │ text-embedding- │
         ▼                                            │  004 (Gemini)   │
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
| Embedding | `src/lib/rag/embed.js` | Gemini `text-embedding-004`, 768-dim, taskType RETRIEVAL_QUERY/DOCUMENT |
| Chunking | `src/lib/rag/chunker.js` | Fish species = 1 chunk/species; wisdom & news = paragraph split (max 800 chars, overlap 100) |
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
   - Embed query → 768-dim vector
   - Load all chunks (~500-1500) from `rag_embeddings` (cached)
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

| Source | Firestore collection | ~ขนาด | จำนวน chunk โดยประมาณ | ตอบคำถามหมวด |
|---|---|---|---|---|
| ชนิดปลา | `fish_species` | 313 species | 313 (1/species) | A |
| ภูมิปัญญา | `fishingWisdom` | ~5-200 entries | ~7-400 | D |
| ข่าว | `newsArticles` | ~3-50 articles | ~8-100 | — |
| บันทึกจับปลา | `fishingRecords` | ~1,338 records | ~1,300 (1/record) | B (per-record) |
| สถิติ aggregate | `stats` (virtual) | คำนวณตอน build | 5-8 chunks | B (aggregate) |
| **รวม** | | | ~1,700-2,100 chunks |

**หมายเหตุเกี่ยวกับ `stats`:** ไม่ใช่ Firestore collection จริง แต่เป็น virtual source
ที่ script คำนวณจาก `fishingRecords` ตอน `npm run embed:build` แล้วเก็บผลรวม
(top species by count/weight/records, by gear, by location, monthly/yearly trend)
เพื่อให้ RAG ตอบคำถามเชิงสถิติได้ (เช่น "ปลาชนิดไหนจับได้บ่อยที่สุด 5 ชนิด") โดยไม่ต้อง
retrieve individual records หลายพัน chunks

## Model choices — เหตุผลเชิงงานวิจัย

- **Embedding: `text-embedding-004` (Gemini)** — ค่าเริ่มต้นเดียวกับ generator, ภาษาไทยรองรับ, 768-dim เหมาะสมกับขนาด corpus, ไม่ต้อง self-host
- **Generator: `gemini-2.5-flash`** — ใช้ตัวเดียวทั้ง 2 conditions ควบคุมตัวแปร LLM ให้เหมือนกัน (fair comparison)
- **Similarity: cosine** — มาตรฐานสำหรับ semantic search, invariant ต่อ magnitude
- **top-k = 5** — สมดุลระหว่าง recall กับ context window; ปรับผ่าน env `RETRIEVER_TOP_K`
- **Judge: Gemini 2.5 Flash, temperature=0** — ลด variance ของ LLM-as-judge (limitation: same-family bias)

## Reproducibility

- Corpus snapshot — ทำ export `fish_species`, `fishingWisdom`, `newsArticles` ก่อนวันที่วัดผล เก็บเป็น JSON ใน `docs/dataset-snapshot/`
- Random seed — ไม่ใช้ (deterministic retrieval; generator ใช้ default sampling ตาม paper อธิบาย)
- Version pinning — `@google/generative-ai` v0.24.1, ระบุใน paper `Methods §X`
- Full log — `chatLogs` เก็บทุก request-response pair สำหรับ audit

#!/usr/bin/env node
/**
 * One-time indexing script for RAG.
 *
 * Reads fish_species, fishingWisdom, newsArticles from Firestore,
 * chunks them, embeds each chunk with Gemini text-embedding-004,
 * writes to rag_embeddings collection.
 *
 * Run:
 *   node --env-file=.env.local src/scripts/build-embeddings.js
 * or via npm script:
 *   npm run embed:build
 *
 * Idempotent: deletes existing chunks per-source before inserting.
 */

/* eslint-disable no-console */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  Timestamp,
  query,
  where,
} from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Config ────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not set. Add it to .env.local');
  process.exit(1);
}
if (!firebaseConfig.projectId) {
  console.error('❌ NEXT_PUBLIC_FIREBASE_PROJECT_ID not set. Run with `node --env-file=.env.local`');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
const RAG_COLLECTION = 'rag_embeddings';

// ── Embedding ─────────────────────────────────────────────────
async function embed(text) {
  const model = ai.getGenerativeModel({ model: EMBEDDING_MODEL });
  const res = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType: 'RETRIEVAL_DOCUMENT',
  });
  return res.embedding.values;
}

// Parse "19.304s" or "19s" → seconds
function parseRetryDelay(err) {
  const details = err?.errorDetails || [];
  for (const d of details) {
    if (d.retryDelay) {
      const m = String(d.retryDelay).match(/([\d.]+)s/);
      if (m) return Math.ceil(parseFloat(m[1]));
    }
  }
  return null;
}

/**
 * ปรับ delay ตาม tier:
 *   Free  : 100 RPM  → 650ms/req
 *   Paid  : 3000 RPM → 25ms/req (แต่ใช้ 100ms ปลอดภัยกว่า)
 * ตั้งค่าผ่าน env EMBED_DELAY_MS ได้ (default 650 = free)
 */
async function embedBatch(texts) {
  const DELAY_MS = Number(process.env.EMBED_DELAY_MS || 650);
  const out = new Array(texts.length);

  for (let i = 0; i < texts.length; i++) {
    let attempt = 0;
    while (true) {
      try {
        out[i] = await embed(texts[i]);
        if ((i + 1) % 20 === 0 || i === texts.length - 1) {
          console.log(`    embedded ${i + 1}/${texts.length}`);
        }
        break;
      } catch (err) {
        attempt++;
        // 429 → รอตามที่ Google บอก (+ 2s buffer) แต่เกิน 5 ครั้งติดคือ daily quota หมด
        if (err?.status === 429) {
          if (attempt >= 5) {
            console.error(`\n❌ 429 rate limit ต่อเนื่อง 5 ครั้ง — น่าจะเป็น daily quota หมด`);
            console.error(`   Free tier ให้ 1,000 embedContent req/วัน (reset เที่ยงคืน UTC = 07:00 น. ไทย)`);
            console.error(`   ทางเลือก:\n   • รอถึงเที่ยงคืน UTC แล้วรันซ้ำ (จะ resume ต่อ)\n   • เปิด billing ที่ https://aistudio.google.com/apikey\n`);
            throw err;
          }
          const retrySec = parseRetryDelay(err) || 30;
          const waitMs = (retrySec + 2) * 1000;
          console.log(`    ⚠️  429 rate limit — รอ ${retrySec + 2}s แล้วลองใหม่ (attempt ${attempt}/5)`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        // อื่นๆ → backoff แล้ว retry สูงสุด 3 ครั้ง
        if (attempt >= 3) throw err;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    // Throttle ระหว่าง request เพื่อไม่ให้แตะ 100 RPM
    if (i < texts.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));
  }
  return out;
}

// ── Chunkers (inlined; keep script standalone) ────────────────
function splitText(text, chunkChars = 800, overlapChars = 100) {
  if (!text || text.length <= chunkChars) return [text].filter(Boolean);
  const sentences = text.split(/(?<=[.!?\n])\s+|(?<=[ๆฯ])/g).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > chunkChars && current.length > 0) {
      chunks.push(current.trim());
      const tail = current.slice(Math.max(0, current.length - overlapChars));
      current = tail + s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function chunkFishSpecies(d) {
  const thaiName = d.thai_name || d.common_name_thai || '';
  const localName = d.local_name || '';
  const scientificName = d.scientific_name || '';
  const family = d.family || '';
  const iucn = d.iucn_status || '';
  const habitat = d.habitat || '';
  const description = d.description || '';
  const parts = [
    `ปลา ${thaiName}${localName ? ` (ชื่อท้องถิ่น: ${localName})` : ''}`,
    scientificName ? `ชื่อวิทยาศาสตร์: ${scientificName}` : '',
    family ? `วงศ์: ${family}` : '',
    iucn ? `สถานะ IUCN: ${iucn}` : '',
    habitat ? `ถิ่นอาศัย: ${habitat}` : '',
    description ? `รายละเอียด: ${description}` : '',
  ].filter(Boolean);
  return [{
    text: parts.join('\n'),
    metadata: {
      thai_name: thaiName,
      local_name: localName,
      scientific_name: scientificName,
      iucn_status: iucn,
      family,
    },
  }];
}

function chunkWisdom(d) {
  const header = `ภูมิปัญญาท้องถิ่น: ${d.title || ''}
หมวดหมู่: ${d.category || 'ทั่วไป'}
ปลาที่เกี่ยวข้อง: ${d.fishType || '-'}
ฤดูกาล: ${d.season || '-'}
สถานที่: ${d.location || '-'}`;
  const bodyText = [d.description, d.technique].filter(Boolean).join('\n\n');
  const bodyChunks = splitText(bodyText);
  if (bodyChunks.length === 0) return [{ text: header, metadata: { title: d.title || '' } }];
  return bodyChunks.map((chunk, i) => ({
    text: `${header}\n\n${chunk}`,
    metadata: {
      title: d.title || '',
      category: d.category || '',
      fishType: d.fishType || '',
      contributor: d.contributorName || '',
      chunk_of: bodyChunks.length,
      chunk_index: i,
    },
  }));
}

function chunkNews(d) {
  const header = `ข่าว: ${d.title || ''}
วันที่: ${d.publishDate || d.date || '-'}`;
  const bodyText = [d.summary, d.content, d.body].filter(Boolean).join('\n\n');
  const bodyChunks = splitText(bodyText);
  if (bodyChunks.length === 0) return [{ text: header, metadata: { title: d.title || '' } }];
  return bodyChunks.map((chunk, i) => ({
    text: `${header}\n\n${chunk}`,
    metadata: {
      title: d.title || '',
      publishDate: d.publishDate || d.date || '',
      chunk_of: bodyChunks.length,
      chunk_index: i,
    },
  }));
}

// Format date field ที่อาจเป็น Firestore Timestamp | ISO string
function fmtDate(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (v.seconds) return new Date(v.seconds * 1000).toISOString().slice(0, 10);
  if (v.toDate) try { return v.toDate().toISOString().slice(0, 10); } catch { return ''; }
  return '';
}

/**
 * chunkFishingRecord — บันทึกการจับปลา 1 record = 1 chunk
 * รวม location, gear, date, fishList เพื่อให้ semantic search ตอบได้ทั้ง
 * "จับปลาที่ไหน", "ใช้เครื่องมืออะไร", "จับได้ปลาอะไรบ้างวันที่ X"
 */
function chunkFishingRecord(d) {
  const date = fmtDate(d.date || d.catchDate);
  const location = d.location?.address?.province
    || d.location?.province
    || d.location?.spotName
    || d.waterSource
    || '';
  const gear = d.fishingGear?.name || d.method || '';
  const fisher = d.fisherInfo?.name || d.fisherName || '';
  const totalWeight = d.totalWeight;

  const fishListLines = Array.isArray(d.fishList) ? d.fishList.map(f => {
    if (!f?.name) return null;
    const cnt = typeof f.count === 'number' ? f.count : (parseInt(f.count) || 1);
    const w = parseFloat(f.weight);
    const wStr = Number.isFinite(w) && w > 0 ? `${w.toFixed(2)} กก.` : '';
    const local = f.localName ? ` (${f.localName})` : '';
    return `- ${f.name}${local}: ${cnt} ตัว${wStr ? ` · ${wStr}` : ''}`;
  }).filter(Boolean) : [];

  if (fishListLines.length === 0) return [];

  const header = [
    `บันทึกการจับปลา วันที่ ${date || '-'}`,
    location ? `สถานที่: ${location}` : '',
    gear ? `เครื่องมือ: ${gear}` : '',
    fisher ? `ผู้จับ: ${fisher}` : '',
    Number.isFinite(parseFloat(totalWeight)) ? `น้ำหนักรวม: ${parseFloat(totalWeight).toFixed(2)} กก.` : '',
  ].filter(Boolean).join('\n');

  return [{
    text: `${header}\n\nรายการปลาที่จับได้:\n${fishListLines.join('\n')}`,
    metadata: {
      date,
      location,
      gear,
      species_count: fishListLines.length,
    },
  }];
}

/**
 * chunkStats — สร้าง virtual "documents" ที่เป็นสรุปสถิติ aggregate
 * ไม่ใช่ 1 doc/collection Firestore แต่คำนวณจาก fishingRecords ทั้งหมด
 * ครอบคลุมคำถามเชิงสถิติ (หมวด B ใน benchmark) ที่ semantic search ปลา
 * รายตัวหรือ species metadata ตอบไม่ได้
 */
const EXCLUDED_SPECIES = new Set(['กุ้งฝอย', 'กุ้งก้ามกราม', 'กุ้งขาว']);

async function buildStatsChunks() {
  console.log('  Computing aggregate stats from fishingRecords…');
  const snap = await getDocs(collection(db, 'fishingRecords'));
  const totalRecords = snap.size;

  let totalWeight = 0;
  let verifiedCount = 0;
  const speciesCounter = new Map(); // name → { count, weight, records }
  const gearCounter = new Map();
  const locationCounter = new Map();
  const monthlyCounter = new Map(); // YYYY-MM → count
  const yearlyCounter = new Map();  // YYYY → count

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const rw = parseFloat(d.totalWeight) || 0;
    totalWeight += rw;
    if (d.verified === true || d.verifiedBy) verifiedCount++;

    const dt = fmtDate(d.date || d.catchDate);
    if (dt) {
      const ym = dt.slice(0, 7);
      const y = dt.slice(0, 4);
      monthlyCounter.set(ym, (monthlyCounter.get(ym) || 0) + 1);
      yearlyCounter.set(y, (yearlyCounter.get(y) || 0) + 1);
    }

    const gear = d.fishingGear?.name || d.method;
    if (gear) gearCounter.set(gear, (gearCounter.get(gear) || 0) + 1);

    const loc = d.location?.address?.province
      || d.location?.province
      || d.location?.spotName
      || d.waterSource;
    if (loc) locationCounter.set(loc, (locationCounter.get(loc) || 0) + 1);

    if (Array.isArray(d.fishList)) {
      d.fishList.forEach(f => {
        if (!f?.name) return;
        const name = String(f.name).trim();
        if (EXCLUDED_SPECIES.has(name)) return;
        const cnt = typeof f.count === 'number' ? f.count : (parseInt(f.count) || 1);
        const w = parseFloat(f.weight) || 0;
        const cur = speciesCounter.get(name) || { count: 0, weight: 0, records: 0 };
        cur.count += cnt;
        cur.weight += w;
        cur.records += 1;
        speciesCounter.set(name, cur);
      });
    }
  });

  const chunks = [];

  // A. Overall summary
  chunks.push({
    id: 'overall',
    text: `สรุปสถิติการจับปลาโดยรวม (คำนวณจากบันทึกการจับปลาทั้งหมด)
- จำนวนบันทึกการจับปลาทั้งหมด: ${totalRecords} ครั้ง
- จำนวนชนิดปลาที่พบในบันทึก (ไม่นับกุ้ง): ${speciesCounter.size} ชนิด
- น้ำหนักรวมทั้งหมด: ${totalWeight.toFixed(2)} กิโลกรัม
- บันทึกที่ยืนยันแล้ว: ${verifiedCount} รายการ`,
    metadata: { type: 'overall', totalRecords, totalSpecies: speciesCounter.size },
  });

  // B. Top species — 3 rankings (by count, by weight, by record frequency)
  const byCount = [...speciesCounter.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15);
  const byWeight = [...speciesCounter.entries()].sort((a, b) => b[1].weight - a[1].weight).slice(0, 15);
  const byRecords = [...speciesCounter.entries()].sort((a, b) => b[1].records - a[1].records).slice(0, 15);

  chunks.push({
    id: 'top-by-count',
    text: `ปลาที่จับได้บ่อยที่สุด 15 อันดับแรก (นับจำนวนตัว)
${byCount.map(([name, v], i) => `${i + 1}. ${name} — ${v.count} ตัว, น้ำหนักรวม ${v.weight.toFixed(1)} กก., ${v.records} บันทึก`).join('\n')}`,
    metadata: { type: 'top-species-count' },
  });

  chunks.push({
    id: 'top-by-weight',
    text: `ปลาที่มีน้ำหนักรวมมากที่สุด 15 อันดับแรก (น้ำหนักสะสม)
${byWeight.map(([name, v], i) => `${i + 1}. ${name} — ${v.weight.toFixed(1)} กก., ${v.count} ตัว, ${v.records} บันทึก`).join('\n')}`,
    metadata: { type: 'top-species-weight' },
  });

  chunks.push({
    id: 'top-by-records',
    text: `ปลาที่พบบ่อยที่สุด 15 อันดับแรก (จำนวนบันทึกที่ปรากฏ)
${byRecords.map(([name, v], i) => `${i + 1}. ${name} — พบใน ${v.records} บันทึก, ${v.count} ตัว, ${v.weight.toFixed(1)} กก.`).join('\n')}`,
    metadata: { type: 'top-species-records' },
  });

  // C. By gear
  if (gearCounter.size > 0) {
    const gears = [...gearCounter.entries()].sort((a, b) => b[1] - a[1]);
    chunks.push({
      id: 'by-gear',
      text: `การจับปลาแยกตามเครื่องมือประมง
${gears.map(([g, c], i) => `${i + 1}. ${g}: ${c} ครั้ง`).join('\n')}`,
      metadata: { type: 'by-gear' },
    });
  }

  // D. By location
  if (locationCounter.size > 0) {
    const locs = [...locationCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    chunks.push({
      id: 'by-location',
      text: `สถานที่จับปลาที่พบบ่อยที่สุด (20 อันดับแรก)
${locs.map(([l, c], i) => `${i + 1}. ${l}: ${c} ครั้ง`).join('\n')}`,
      metadata: { type: 'by-location' },
    });
  }

  // E. Yearly trend
  if (yearlyCounter.size > 0) {
    const years = [...yearlyCounter.entries()].sort(([a], [b]) => a.localeCompare(b));
    chunks.push({
      id: 'yearly',
      text: `จำนวนบันทึกการจับปลารายปี
${years.map(([y, c]) => `- ${y} (พ.ศ. ${Number(y) + 543}): ${c} บันทึก`).join('\n')}`,
      metadata: { type: 'yearly' },
    });
  }

  // F. Monthly trend (last 24 months)
  if (monthlyCounter.size > 0) {
    const months = [...monthlyCounter.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-24);
    chunks.push({
      id: 'monthly',
      text: `จำนวนบันทึกการจับปลารายเดือน (24 เดือนล่าสุด)
${months.map(([m, c]) => `- ${m}: ${c} บันทึก`).join('\n')}`,
      metadata: { type: 'monthly' },
    });
  }

  return chunks;
}

// ── Vector store ops ──────────────────────────────────────────
async function deleteBySource(source) {
  const q = query(collection(db, RAG_COLLECTION), where('source', '==', source));
  const snap = await getDocs(q);
  const BATCH_SIZE = 100; // delete ops เล็กกว่า write ทำเป็น 100 ได้
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const slice = snap.docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    slice.forEach(d => batch.delete(d.ref));
    await batch.commit();
    await new Promise(r => setTimeout(r, 200));
  }
  return snap.size;
}

async function upsertChunks(chunks) {
  const col = collection(db, RAG_COLLECTION);
  // Firestore hard limit: 1MB/document, 10MB/batch
  // 3072-dim vector serialized ≈ 40KB + text — safe ต่อ doc ถ้า text < 900KB
  // Truncate text ยาวเกิน 200KB (เผื่อ metadata + embedding)
  chunks.forEach(c => {
    if (c.text && c.text.length > 200_000) c.text = c.text.slice(0, 200_000);
  });
  const BATCH_SIZE = 10;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const slice = chunks.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    slice.forEach((chunk) => {
      const ref = doc(col);
      batch.set(ref, {
        source: chunk.source,
        sourceDocId: chunk.sourceDocId,
        chunk_index: chunk.chunk_index ?? 0,
        text: chunk.text,
        metadata: chunk.metadata || {},
        embedding: chunk.embedding,
        createdAt: Timestamp.now(),
      });
    });
    await batch.commit();
    if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= chunks.length) {
      console.log(`    wrote ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} to Firestore`);
    }
    await new Promise(r => setTimeout(r, 150));
  }
}

/**
 * โหลด "key set" ของ chunks ที่มีอยู่แล้วใน rag_embeddings — resume-safe
 * key = `${sourceDocId}:${chunk_index}`
 */
async function loadExistingKeys(sourceName) {
  const q = query(collection(db, RAG_COLLECTION), where('source', '==', sourceName));
  const snap = await getDocs(q);
  const set = new Set();
  snap.forEach(d => {
    const data = d.data();
    set.add(`${data.sourceDocId}:${data.chunk_index ?? 0}`);
  });
  return set;
}

// ── Pipeline ──────────────────────────────────────────────────
async function indexCollection(sourceName, chunker, { force = false } = {}) {
  console.log(`\n=== ${sourceName} ===`);
  const snap = await getDocs(collection(db, sourceName));
  console.log(`  Loaded ${snap.size} documents`);

  const allChunks = [];
  snap.forEach(docSnap => {
    const parts = chunker(docSnap.data());
    parts.forEach((p, i) => {
      allChunks.push({
        source: sourceName,
        sourceDocId: docSnap.id,
        chunk_index: i,
        text: p.text,
        metadata: p.metadata,
      });
    });
  });
  console.log(`  Produced ${allChunks.length} chunks`);
  if (allChunks.length === 0) return 0;

  let chunks = allChunks;
  if (force) {
    console.log(`  [force] Deleting existing chunks for source=${sourceName}`);
    const deleted = await deleteBySource(sourceName);
    console.log(`  Deleted ${deleted} old chunks`);
  } else {
    const existing = await loadExistingKeys(sourceName);
    if (existing.size > 0) {
      chunks = allChunks.filter(c => !existing.has(`${c.sourceDocId}:${c.chunk_index}`));
      console.log(`  ⏭  Skip ${allChunks.length - chunks.length} chunks (มีอยู่แล้ว), เหลือ ${chunks.length} ที่ต้อง embed`);
    }
  }
  if (chunks.length === 0) {
    console.log(`  ✓ ${sourceName} ครบแล้ว ไม่ต้อง embed เพิ่ม`);
    return 0;
  }

  console.log(`  Embedding + writing ${chunks.length} chunks (checkpoint ทุก 20 chunks)…`);
  const embeddings = await embedBatch(chunks.map(c => c.text));
  chunks.forEach((c, i) => { c.embedding = embeddings[i]; });

  await upsertChunks(chunks);
  console.log(`  ✓ ${sourceName} indexed`);
  return chunks.length;
}

/**
 * indexStats — build + embed + upsert virtual stats chunks
 * ไม่ใช้ indexCollection() เพราะ source 'stats' ไม่ใช่ Firestore collection จริง
 * force = true เสมอ (stats ต้อง refresh ทุกครั้งเพราะข้อมูลเปลี่ยน)
 */
async function indexStats() {
  console.log(`\n=== stats (virtual) ===`);
  const statChunks = await buildStatsChunks();
  console.log(`  Produced ${statChunks.length} stats chunks`);
  if (statChunks.length === 0) return 0;

  console.log(`  [force] Deleting existing chunks for source=stats (stats ต้อง refresh ทุกครั้ง)`);
  const deleted = await deleteBySource('stats');
  console.log(`  Deleted ${deleted} old chunks`);

  const chunks = statChunks.map((c, i) => ({
    source: 'stats',
    sourceDocId: c.id,
    chunk_index: 0,
    text: c.text,
    metadata: c.metadata,
  }));

  console.log(`  Embedding ${chunks.length} stats chunks…`);
  const embeddings = await embedBatch(chunks.map(c => c.text));
  chunks.forEach((c, i) => { c.embedding = embeddings[i]; });

  await upsertChunks(chunks);
  console.log(`  ✓ stats indexed`);
  return chunks.length;
}

async function main() {
  const started = Date.now();
  // --force → rebuild ทั้งหมด (default: resume — ข้าม chunks ที่มีแล้ว)
  // แต่ stats จะ force เสมอ (ข้อมูล aggregate เปลี่ยนตลอด)
  const force = process.argv.includes('--force');
  if (force) console.log('⚠️  --force flag: rebuild ทั้งหมด');

  let total = 0;
  total += await indexCollection('fish_species', chunkFishSpecies, { force });
  total += await indexCollection('fishingWisdom', chunkWisdom, { force });
  total += await indexCollection('newsArticles', chunkNews, { force });
  total += await indexCollection('fishingRecords', chunkFishingRecord, { force });
  total += await indexStats();
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n✅ Done. ${total} chunks embedded in ${secs}s`);
  process.exit(0);
}

main().catch(err => {
  if (err?.status === 400 && /API key/i.test(err?.message || '')) {
    console.error('\n❌ Gemini API key ไม่ถูกต้อง หรือยังไม่ได้เปิดใช้ Generative Language API');
    console.error('   1) เข้า https://aistudio.google.com/apikey');
    console.error('   2) กด "Create API key" → เลือก/สร้าง project');
    console.error('   3) copy key ใส่ .env.local ที่บรรทัด GEMINI_API_KEY=…');
    console.error('   4) รันซ้ำ: npm run embed:build\n');
  } else {
    console.error('❌ Indexing failed:', err);
  }
  process.exit(1);
});

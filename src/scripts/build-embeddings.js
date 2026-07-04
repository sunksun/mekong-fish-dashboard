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

async function main() {
  const started = Date.now();
  // --force → rebuild ทั้งหมด (default: resume — ข้าม chunks ที่มีแล้ว)
  const force = process.argv.includes('--force');
  if (force) console.log('⚠️  --force flag: rebuild ทั้งหมด');

  let total = 0;
  total += await indexCollection('fish_species', chunkFishSpecies, { force });
  total += await indexCollection('fishingWisdom', chunkWisdom, { force });
  total += await indexCollection('newsArticles', chunkNews, { force });
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

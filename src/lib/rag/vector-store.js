/**
 * Firestore-backed vector store for RAG.
 *
 * Collection: rag_embeddings
 * Doc schema:
 *   {
 *     source: 'fish_species' | 'fishingRecords' | 'fishingWisdom'
 *           | 'newsArticles' | 'stats' | 'waterQuality' | 'waterLevels',
 *     sourceDocId: string,   // original doc id or virtual aggregate id ('overall', 'top-by-count', ...)
 *     chunk_index: number,   // 0-indexed for multi-chunk sources; 0 for 1-chunk sources
 *     text: string,          // human-readable chunk content (Thai, includes BE year for date fields)
 *     metadata: object,      // source-specific fields for filtering/citation
 *     embedding: number[],   // gemini-embedding-001 vector (3072-dim by default; see EMBEDDING_DIM env)
 *     createdAt: Timestamp
 *   }
 *
 * Corpus is small (~1,800 chunks as of 2026-07-07) so we keep everything in
 * Firestore and do brute-force cosine similarity in-process (see retriever.js).
 * For scaling beyond ~5,000 chunks, migrate to a dedicated vector DB.
 */

import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  writeBatch,
  doc,
  Timestamp,
  query,
  where,
} from 'firebase/firestore';

export const RAG_COLLECTION = 'rag_embeddings';

/**
 * Batch-insert embedded chunks. Uses writeBatch (max 500 ops).
 */
export async function upsertChunks(chunks) {
  const col = collection(db, RAG_COLLECTION);
  for (let i = 0; i < chunks.length; i += 400) {
    const slice = chunks.slice(i, i + 400);
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
  }
}

/**
 * Delete all chunks for a given source (used for full re-index).
 */
export async function deleteBySource(source) {
  const q = query(collection(db, RAG_COLLECTION), where('source', '==', source));
  const snap = await getDocs(q);
  for (let i = 0; i < snap.docs.length; i += 400) {
    const slice = snap.docs.slice(i, i + 400);
    const batch = writeBatch(db);
    slice.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

/**
 * Load all embeddings into memory. Cached with TTL because the corpus rarely changes.
 *
 * Scale note: at 1,806 chunks × 3072-dim (float64) ≈ 45 MB in memory + Firestore JSON
 * overhead pushes this closer to ~200 MB per cold-start fetch. For corpora beyond
 * ~5,000 chunks consider (a) sharding by source, (b) minInstances=1 to keep the cache
 * warm, or (c) a dedicated vector DB. See docs/RAG_ARCHITECTURE.md#deployment.
 *
 * The in-flight promise is de-duplicated: parallel requests during cold start share
 * a single Firestore fetch instead of triggering N concurrent ~200 MB downloads.
 */
let cache = null;
let cacheAt = 0;
let inFlight = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function loadAllChunks({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  // De-dupe concurrent cold-start loads (e.g. Cloud Run spins up + 5 requests arrive
  // simultaneously — without this, each triggers its own Firestore round trip)
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const snap = await getDocs(collection(db, RAG_COLLECTION));
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cacheAt = Date.now();
      return cache;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function invalidateCache() {
  cache = null;
  cacheAt = 0;
  inFlight = null;
}

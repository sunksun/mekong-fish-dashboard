/**
 * Firestore-backed vector store for RAG.
 *
 * Collection: rag_embeddings
 * Doc schema:
 *   {
 *     source: 'fish_species' | 'fishingWisdom' | 'newsArticles',
 *     sourceDocId: string,
 *     chunk_index: number,
 *     text: string,
 *     metadata: object,
 *     embedding: number[]  (768)
 *     createdAt: Timestamp
 *   }
 *
 * We keep everything in Firestore because our corpus is small (<2000 chunks)
 * and this keeps ops simple. Cosine similarity happens in-process.
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
 */
let cache = null;
let cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function loadAllChunks({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  const snap = await getDocs(collection(db, RAG_COLLECTION));
  cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cacheAt = Date.now();
  return cache;
}

export function invalidateCache() {
  cache = null;
  cacheAt = 0;
}

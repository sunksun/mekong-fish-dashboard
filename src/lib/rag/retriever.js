/**
 * Semantic retriever: embed query → cosine similarity vs all chunks → top-k.
 *
 * Corpus is small enough (~500-1500 chunks) that brute-force in-memory is fine.
 * For larger corpora, swap for a vector DB (Pinecone/Weaviate) — the interface stays the same.
 */

import { embedQuery, cosineSimilarity } from './embed';
import { loadAllChunks } from './vector-store';

export const DEFAULT_TOP_K = Number(process.env.RETRIEVER_TOP_K || 5);

/**
 * @param {string} query
 * @param {{ k?: number, sourceFilter?: string[], minScore?: number }} opts
 * @returns {Promise<Array<{id, source, sourceDocId, text, metadata, score}>>}
 */
export async function retrieve(query, opts = {}) {
  const k = opts.k ?? DEFAULT_TOP_K;
  const minScore = opts.minScore ?? 0.0;
  const sourceFilter = opts.sourceFilter;

  const [qVec, chunks] = await Promise.all([
    embedQuery(query),
    loadAllChunks(),
  ]);

  const scored = [];
  for (const c of chunks) {
    if (!c.embedding) continue;
    if (sourceFilter && !sourceFilter.includes(c.source)) continue;
    const rawScore = cosineSimilarity(qVec, c.embedding);
    // Guard: cosine(any, zero-vector) = NaN, breaks sort and downstream logging
    const score = Number.isFinite(rawScore) ? rawScore : 0;
    if (score < minScore) continue;
    scored.push({
      id: c.id,
      source: c.source,
      sourceDocId: c.sourceDocId,
      text: c.text,
      metadata: c.metadata || {},
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * Gemini text-embedding-004 wrapper
 *
 * 768-dimensional embeddings. Used for both indexing (documents) and queries.
 * Same model on both sides ensures vectors are in the same space.
 */

let cachedClient = null;

function getClient() {
  if (cachedClient) return cachedClient;
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  cachedClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  return cachedClient;
}

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
export const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM || 3072);

/**
 * @param {string} text
 * @param {'RETRIEVAL_DOCUMENT'|'RETRIEVAL_QUERY'} taskType
 * @returns {Promise<number[]>} 768-dim vector
 */
export async function embed(text, taskType = 'RETRIEVAL_DOCUMENT') {
  if (!text || typeof text !== 'string') throw new Error('embed: text must be a non-empty string');
  const model = getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType,
  });
  const vec = result?.embedding?.values;
  if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIM) {
    throw new Error(`embed: expected ${EMBEDDING_DIM}-dim vector, got ${vec?.length}`);
  }
  return vec;
}

export async function embedQuery(text) {
  return embed(text, 'RETRIEVAL_QUERY');
}

export async function embedDocument(text) {
  return embed(text, 'RETRIEVAL_DOCUMENT');
}

/**
 * Batch with basic retry + concurrency cap.
 * Gemini has per-minute quotas; small concurrency avoids 429s.
 */
export async function embedBatch(texts, taskType = 'RETRIEVAL_DOCUMENT', { concurrency = 4 } = {}) {
  const out = new Array(texts.length);
  let cursor = 0;

  async function worker() {
    while (cursor < texts.length) {
      const i = cursor++;
      let attempt = 0;
      while (true) {
        try {
          out[i] = await embed(texts[i], taskType);
          break;
        } catch (err) {
          attempt++;
          if (attempt >= 3) throw err;
          await new Promise(r => setTimeout(r, 500 * attempt));
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, worker));
  return out;
}

export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

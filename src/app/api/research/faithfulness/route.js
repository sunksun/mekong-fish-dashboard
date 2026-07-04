import { NextResponse } from 'next/server';
import { scoreFaithfulness } from '@/lib/rag/faithfulness';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/research/faithfulness
 * Body: { answer: string, chunks: [{ text }, ...] }
 * Returns groundedness score (0..1) + per-claim breakdown.
 *
 * Used by the evaluation UI to auto-score both conditions (RAG and no-RAG).
 * For no-RAG, pass chunks=[] — the judge will label every claim as unsupported.
 */
export async function POST(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.EXPENSIVE, key: 'faithfulness' });
  if (rl.limited) return tooManyRequests(rl);

  try {
    const { answer, chunks } = await request.json();
    if (typeof answer !== 'string') {
      return NextResponse.json({ success: false, error: 'answer must be a string' }, { status: 400 });
    }
    const contextChunks = Array.isArray(chunks) ? chunks : [];
    const result = await scoreFaithfulness(answer, contextChunks);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('faithfulness API error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

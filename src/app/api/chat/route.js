import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { logger } from '@/lib/logger';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { retrieve, DEFAULT_TOP_K } from '@/lib/rag/retriever';

export const dynamic = 'force-dynamic';

function getGeminiAI() {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
}

/**
 * AI Chat endpoint — supports two conditions for the research comparison:
 *   mode: 'rag'    → semantic retrieval (top-k) + Gemini
 *   mode: 'no-rag' → Gemini alone (baseline LLM)
 *
 * The RAG path uses embedding-based cosine similarity, not keyword matching.
 * Retrieved chunks are logged so retrieval quality can be traced offline.
 */
export async function POST(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.EXPENSIVE, key: 'chat' });
  if (rl.limited) return tooManyRequests(rl);

  try {
    const { message, mode, topK } = await request.json();
    const ragMode = mode === 'no-rag' ? 'no-rag' : 'rag';
    const k = Number.isInteger(topK) && topK > 0 && topK <= 20 ? topK : DEFAULT_TOP_K;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'กรุณาใส่คำถาม' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'ระบบ AI ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
        answer: 'ขออภัยครับ ระบบ AI ยังไม่ได้ตั้งค่า API Key กรุณาใช้ช่องค้นหาแบบปกติแทน',
      }, { status: 200 });
    }

    logger.info(`🤖 AI Chat (${ragMode}) - Q:`, message);

    // 1. Retrieve (RAG only)
    let retrievedChunks = [];
    let retrievalMs = 0;
    if (ragMode === 'rag') {
      const t0 = Date.now();
      try {
        retrievedChunks = await retrieve(message, { k });
      } catch (retrieveErr) {
        logger.warn('Retrieval failed, falling back to no-RAG for this call:', retrieveErr);
        retrievedChunks = [];
      }
      retrievalMs = Date.now() - t0;
    }

    // 2. Build prompt
    const prompt = ragMode === 'rag'
      ? buildRagPrompt(message, retrievedChunks)
      : buildNoRagPrompt(message);

    // 3. Generate answer
    const ai = getGeminiAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const t1 = Date.now();
    const result = await model.generateContent(prompt);
    const answer = (await result.response).text();
    const generationMs = Date.now() - t1;
    const responseTimeMs = retrievalMs + generationMs;

    logger.info(`✅ AI Answer (${ragMode}) [${responseTimeMs}ms]:`, answer.substring(0, 100) + '…');

    // 4. Research log — persist question + retrieval trace + answer
    try {
      await addDoc(collection(db, 'chatLogs'), {
        question: message,
        mode: ragMode,
        top_k: ragMode === 'rag' ? k : null,
        retrieved_chunks: retrievedChunks.map(c => ({
          id: c.id,
          source: c.source,
          sourceDocId: c.sourceDocId,
          score: c.score,
        })),
        n_retrieved: retrievedChunks.length,
        response: answer,
        response_time_ms: responseTimeMs,
        retrieval_time_ms: retrievalMs,
        generation_time_ms: generationMs,
        timestamp: new Date(),
      });
    } catch (logErr) {
      logger.warn('chatLogs write failed:', logErr);
    }

    return NextResponse.json({
      success: true,
      answer,
      context: {
        mode: ragMode,
        topK: ragMode === 'rag' ? k : null,
        retrieved: retrievedChunks.map(c => ({
          id: c.id,
          source: c.source,
          sourceDocId: c.sourceDocId,
          score: Number(c.score.toFixed(4)),
          metadata: c.metadata,
          preview: c.text.substring(0, 140),
        })),
        timing: { retrieval_ms: retrievalMs, generation_ms: generationMs, total_ms: responseTimeMs },
      },
    });
  } catch (error) {
    logger.error('❌ AI Chat Error:', error);
    if (error.message?.includes('API key')) {
      return NextResponse.json({
        success: false,
        error: 'ระบบ AI ไม่สามารถใช้งานได้ กรุณาตรวจสอบ API Key',
        answer: 'ขออภัยครับ เกิดข้อผิดพลาดกับระบบ AI กรุณาลองใหม่อีกครั้ง',
      });
    }
    return NextResponse.json({
      success: false,
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      answer: 'ขออภัยครับ ไม่สามารถประมวลผลคำถามของคุณได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
    }, { status: 500 });
  }
}

/**
 * Baseline (Condition A): LLM has no external context. Tests parametric knowledge only.
 */
function buildNoRagPrompt(userMessage) {
  return `คุณคือผู้ช่วยตอบคำถามเกี่ยวกับปลาแม่น้ำโขงและระบบนิเวศแม่น้ำโขง
พื้นที่: แม่น้ำโขงตอนบน จ.เลย ประเทศไทย

คำถามจากผู้ใช้: ${userMessage}

คำแนะนำในการตอบ:
1. ตอบเป็นภาษาไทยที่เข้าใจง่าย เป็นกันเอง
2. ตอบสั้น กระชับ ไม่เกิน 200 คำ
3. ใช้ emoji เล็กน้อยเพื่อให้เป็นมิตร 🐟 🌊
4. ถ้าเป็นคำถามนอกเรื่องปลาหรือแม่น้ำโขง ให้บอกว่า "คำถามนี้อยู่นอกขอบเขต"

กรุณาตอบคำถาม:`;
}

/**
 * RAG (Condition B): LLM sees only the top-k retrieved chunks.
 * Each chunk is numbered [1], [2] … so the model can cite them
 * and downstream faithfulness scoring can attribute claims to sources.
 */
function buildRagPrompt(userMessage, chunks) {
  const header = `คุณคือผู้ช่วยตอบคำถามเกี่ยวกับปลาแม่น้ำโขงและระบบนิเวศแม่น้ำโขง
โปรเจค: Mekong Fish Dashboard
พื้นที่: แม่น้ำโขงตอนบน อ.เชียงคาน - อ.ปากชม จ.เลย
แหล่งข้อมูล: ศูนย์วิจัยและพัฒนาประมงน้ำจืดเลย, IUCN Red List`;

  let contextBlock = '';
  if (chunks.length === 0) {
    contextBlock = '\n(ไม่พบเอกสารที่เกี่ยวข้องในฐานข้อมูล)\n';
  } else {
    contextBlock = '\nเอกสารอ้างอิงที่ค้นเจอ (top-' + chunks.length + '):\n';
    chunks.forEach((c, i) => {
      const src = sourceLabel(c.source);
      contextBlock += `\n[${i + 1}] (${src}, score=${c.score.toFixed(3)})\n${c.text}\n`;
    });
  }

  const instructions = `\nคำถามจากผู้ใช้: ${userMessage}

คำแนะนำในการตอบ:
1. ตอบเป็นภาษาไทยที่เข้าใจง่าย เป็นกันเอง
2. ตอบเฉพาะจากเอกสารอ้างอิงด้านบนเท่านั้น อย่าเดา อย่าเสริมความรู้จากภายนอก
3. อ้างอิงแหล่งด้วยเลขในวงเล็บ เช่น [1] หลังข้อความที่ยกมา
4. ถ้าเอกสารอ้างอิงไม่มีข้อมูลที่ตอบคำถาม ให้ตอบว่า "ไม่พบข้อมูลในระบบ" อย่างชัดเจน
5. ตอบสั้น กระชับ ไม่เกิน 200 คำ
6. ใช้ emoji เล็กน้อยเพื่อให้เป็นมิตร 🐟 🌊

กรุณาตอบคำถาม:`;

  return header + contextBlock + instructions;
}

function sourceLabel(source) {
  if (source === 'fish_species') return 'ฐานข้อมูลชนิดปลา';
  if (source === 'fishingWisdom') return 'ภูมิปัญญาท้องถิ่น';
  if (source === 'newsArticles') return 'ข่าว';
  return source;
}

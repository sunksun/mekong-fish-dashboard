/**
 * Faithfulness / Groundedness scoring — RAGAS-inspired.
 *
 * Given (answer, retrieved_context), we ask Gemini to:
 *   1. Decompose the answer into atomic claims
 *   2. Label each claim as SUPPORTED or UNSUPPORTED by the context
 *   3. Score = supported / (supported + unsupported)
 *
 * temperature is set to 0 to reduce judge variance. Even so, LLM-as-judge
 * is imperfect — cite this as a limitation in the paper (see RAGAS §4).
 */

const JUDGE_PROMPT = `คุณเป็นผู้ประเมินความน่าเชื่อถือของคำตอบระบบ AI

ให้ทำ 3 ขั้นตอน:
1. แยกคำตอบเป็นข้อความย่อย (atomic claims) — 1 ประโยค = 1 claim
2. ตรวจแต่ละ claim ว่าสามารถยืนยันได้จากบริบทที่ให้มาหรือไม่
3. ตอบผลลัพธ์เป็น JSON เท่านั้น ไม่มีข้อความอื่นก่อน/หลัง

รูปแบบ JSON:
{
  "claims": [
    { "text": "...", "supported": true, "citation": "1" },
    { "text": "...", "supported": false, "citation": null }
  ]
}

หมายเหตุ:
- claim ที่เป็นคำทักทาย/emoji/บทสนทนา ไม่ต้องนำมาประเมิน
- citation คือหมายเลข [1], [2] ในบริบทที่รองรับ claim นั้น (ใส่ "1" หรือ null)
- ถ้าคำตอบระบุชัดว่า "ไม่พบข้อมูล" — ให้ถือว่ามี 1 claim ที่ supported=true

--- บริบทที่ retrieve มา ---
{{CONTEXT}}

--- คำตอบที่ต้องประเมิน ---
{{ANSWER}}

JSON:`;

function getGemini() {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
}

/**
 * @param {string} answer
 * @param {Array<{text:string}>} chunks
 * @returns {Promise<{ groundedness:number, n_claims:number, n_supported:number, claims:Array, raw:string }>}
 */
export async function scoreFaithfulness(answer, chunks) {
  if (!answer || answer.trim().length === 0) {
    return { groundedness: 0, n_claims: 0, n_supported: 0, claims: [], raw: '' };
  }

  const contextBlock = chunks.length === 0
    ? '(ไม่มีบริบท)'
    : chunks.map((c, i) => `[${i + 1}] ${c.text || c.preview || ''}`).join('\n\n');

  const prompt = JUDGE_PROMPT
    .replace('{{CONTEXT}}', contextBlock)
    .replace('{{ANSWER}}', answer);

  const ai = getGemini();
  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(prompt);
  const raw = (await result.response).text();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { claims: [] };
  }

  const claims = Array.isArray(parsed.claims) ? parsed.claims : [];
  const n_claims = claims.length;
  const n_supported = claims.filter(c => c.supported === true).length;
  const groundedness = n_claims === 0 ? 0 : n_supported / n_claims;

  return { groundedness, n_claims, n_supported, claims, raw };
}

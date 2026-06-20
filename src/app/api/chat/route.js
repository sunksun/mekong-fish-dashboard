import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, limit } from 'firebase/firestore';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// In-memory cache (TTL 5 minutes) — shared across requests on same instance
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Lazy import Gemini AI to avoid initialization errors
function getGeminiAI() {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
}

/**
 * AI Chat endpoint สำหรับตอบคำถามเกี่ยวกับปลาแม่น้ำโขง
 * ใช้ Gemini AI + ข้อมูลจาก Firebase
 */
export async function POST(request) {
  try {
    const { message } = await request.json();

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาใส่คำถาม' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่ามี API key หรือไม่
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'ระบบ AI ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
          answer: 'ขออภัยครับ ระบบ AI ยังไม่ได้ตั้งค่า API Key กรุณาใช้ช่องค้นหาแบบปกติแทน'
        },
        { status: 200 }
      );
    }

    console.log('🤖 AI Chat - Question:', message);

    // 1. ดึงข้อมูลจาก Firebase เพื่อใช้เป็น context
    const context = await buildContext(message);

    // 2. สร้าง prompt สำหรับ Gemini
    const prompt = buildPrompt(message, context);

    // 3. เรียก Gemini AI
    const ai = getGeminiAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();
    const responseTimeMs = Date.now() - startTime;

    console.log('✅ AI Answer:', answer.substring(0, 100) + '...');

    // 4. บันทึก log สำหรับงานวิจัย
    try {
      const contextUsed = [];
      if (context.fishSpecies.length > 0) contextUsed.push('fish_species');
      if (context.stats) contextUsed.push('fishingRecords');
      if (context.wisdom && context.wisdom.length > 0) contextUsed.push('fishingWisdom');
      if (context.recentNews.length > 0) contextUsed.push('newsArticles');
      await addDoc(collection(db, 'chatLogs'), {
        question: message,
        mode: 'rag',
        context_used: contextUsed,
        response: answer,
        response_time_ms: responseTimeMs,
        timestamp: new Date()
      });
    } catch (logErr) {
      console.warn('Log write failed:', logErr);
    }

    return NextResponse.json({
      success: true,
      answer: answer,
      context: {
        usedFishData: context.fishSpecies.length > 0,
        usedStats: context.stats !== null,
        sources: ['fish_species', 'fishingRecords', 'newsArticles', 'fishingWisdom']
      }
    });

  } catch (error) {
    console.error('❌ AI Chat Error:', error);

    // ถ้า error จาก API key
    if (error.message?.includes('API key')) {
      return NextResponse.json({
        success: false,
        error: 'ระบบ AI ไม่สามารถใช้งานได้ กรุณาตรวจสอบ API Key',
        answer: 'ขออภัยครับ เกิดข้อผิดพลาดกับระบบ AI กรุณาลองใหม่อีกครั้ง หรือใช้ช่องค้นหาแบบปกติ'
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        answer: 'ขออภัยครับ ไม่สามารถประมวลผลคำถามของคุณได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch Firestore data with cache + optional limit
 * @param {string} collectionName
 * @param {number} maxDocs - 0 = no limit
 */
async function fetchFirestoreCollection(collectionName, maxDocs = 0) {
  const cacheKey = `${collectionName}:${maxDocs}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const ref = collection(db, collectionName);
    const q = maxDocs > 0 ? query(ref, limit(maxDocs)) : ref;
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => doc.data());
    setCached(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
}

/**
 * ดึงข้อมูลจาก Firebase ที่เกี่ยวข้องกับคำถาม
 */
async function buildContext(message) {
  const context = {
    fishSpecies: [],
    stats: null,
    recentNews: [],
    wisdom: []
  };

  try {
    // 1. ดึงข้อมูลปลาทั้งหมด — ส่งเข้า prompt ทุกครั้งเพื่อให้ Gemini ค้นหาได้ครบ
    const fishData = await fetchFirestoreCollection('fish_species');
    fishData.forEach((data) => {
      context.fishSpecies.push({
        thaiName: data.thai_name || data.common_name_thai,
        localName: data.local_name,
        scientificName: data.scientific_name,
        family: data.family,
        group: data.group,
        iucnStatus: data.iucn_status,
        habitat: data.habitat,
        description: data.description
      });
    });

    // 2+3. ดึง fishingRecords ครั้งเดียว แล้วคำนวณ stats + topSpecies พร้อมกัน
    // ใส่ limit 5000 เพื่อป้องกัน OOM ตอน collection โต (ปัจจุบัน ~700 records)
    try {
      const recordsData = await fetchFirestoreCollection('fishingRecords', 5000);
      let totalRecords = 0;
      let totalWeight = 0;
      let totalValue = 0;
      let verifiedCount = 0;
      const speciesCountMap = new Map();

      recordsData.forEach((data) => {
        totalRecords++;

        // นับน้ำหนัก
        const weight = typeof data.totalWeight === 'number' ? data.totalWeight : parseFloat(data.totalWeight) || 0;
        totalWeight += weight;

        // นับ verified
        if (data.verifiedBy) verifiedCount++;

        // คำนวณมูลค่ารวม + นับชนิดปลา (loop เดียวประหยัด)
        if (data.fishList && Array.isArray(data.fishList)) {
          data.fishList.forEach(fish => {
            const w = parseFloat(fish.weight) || 0;
            const p = parseFloat(fish.price) || 0;
            totalValue += w * p;

            if (!fish || !fish.name) return;
            const name = fish.name.trim();
            if (!speciesCountMap.has(name)) {
              speciesCountMap.set(name, { count: 0, totalWeight: 0, name });
            }
            const species = speciesCountMap.get(name);
            const count = typeof fish.count === 'number' ? fish.count : (parseInt(fish.count) || 1);
            species.count += count;
            species.totalWeight += w;
          });
        }
      });

      context.stats = {
        totalRecords,
        totalWeight,
        totalValue,
        verifiedCount
      };

      // สร้าง lookup ชื่อท้องถิ่นจาก fish_species (join ด้วยชื่อไทย) เพื่อเติมให้ Top 15
      const localNameByName = new Map();
      context.fishSpecies.forEach((fish) => {
        if (!fish.localName) return;
        if (fish.thaiName) localNameByName.set(fish.thaiName.trim(), fish.localName);
        // เผื่อกรณีบันทึกการจับใช้ชื่อท้องถิ่นเป็นชื่อหลัก
        if (fish.localName) localNameByName.set(fish.localName.trim(), fish.localName);
      });

      // ชนิดที่ตัดออกจาก Top Species เพราะจับได้ปริมาณมากผิดปกติ (บิดเบือนสถิติ)
      const EXCLUDE_FROM_TOP = new Set(['กุ้งจ่ม']);

      // เรียงตามจำนวนและเอา Top 15
      context.topSpecies = Array.from(speciesCountMap.values())
        .filter(s => !EXCLUDE_FROM_TOP.has(s.name.trim()))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
        .map(s => {
          const localName = localNameByName.get(s.name.trim()) || null;
          return {
            name: s.name,
            localName: localName && localName !== s.name ? localName : null,
            count: s.count,
            totalWeight: parseFloat(s.totalWeight.toFixed(1))
          };
        });

      context.totalSpecies = speciesCountMap.size;
    } catch (e) {
      console.error('Error counting species from Firestore:', e);
    }

    // 4. ดึงความรู้ท้องถิ่น (fishingWisdom) — ตอบคำถามชื่อท้องถิ่น/ภูมิปัญญา
    try {
      const wisdomData = await fetchFirestoreCollection('fishingWisdom', 500);
      const messageLower = message.toLowerCase();
      wisdomData.forEach((data) => {
        const title = (data.title || '').toLowerCase();
        const fishType = (data.fishType || '').toLowerCase();
        const description = (data.description || '').toLowerCase();
        if (
          messageLower.includes(title) ||
          (fishType && messageLower.includes(fishType)) ||
          title.includes(messageLower.slice(0, 6))
        ) {
          context.wisdom.push({
            title: data.title,
            category: data.category,
            fishType: data.fishType,
            description: data.description,
            technique: data.technique,
            season: data.season,
            location: data.location,
            contributorName: data.contributorName
          });
        }
      });
      context.wisdom = context.wisdom.slice(0, 5);
    } catch (e) {
      console.error('Error fetching fishingWisdom:', e);
    }

    // 5. ดึงข่าวล่าสุด (ถ้าคำถามเกี่ยวกับข่าว) — ใช้แค่ 20 รายการล่าสุด
    if (message.includes('ข่าว') || message.includes('อัปเดต') || message.includes('ล่าสุด')) {
      const newsData = await fetchFirestoreCollection('newsArticles', 20);
      context.recentNews = [];
      newsData.forEach((data) => {
        context.recentNews.push({
          title: data.title,
          summary: data.summary,
          date: data.publishDate || ''
        });
      });
    }

  } catch (error) {
    console.error('Error building context:', error);
  }

  return context;
}

/**
 * สร้าง prompt สำหรับ Gemini AI
 */
function buildPrompt(userMessage, context) {
  let prompt = `คุณคือผู้ช่วยตอบคำถามเกี่ยวกับปลาแม่น้ำโขงและระบบนิเวศแม่น้ำโขง

ข้อมูลพื้นฐาน:
- โปรเจค: Mekong Fish Dashboard - ระบบติดตามและวิเคราะห์ความหลากหลายทางชีวภาพปลาแม่น้ำโขง
- พื้นที่: แม่น้ำโขงตอนบน อ.เชียงคาน - อ.ปากชม จ.เลย
- แหล่งข้อมูล: ศูนย์วิจัยและพัฒนาประมงน้ำจืดเลย, IUCN Red List

`;

  // เพิ่มข้อมูลปลาทั้งหมด (compact format เพื่อประหยัด context)
  if (context.fishSpecies.length > 0) {
    prompt += `\nฐานข้อมูลปลาแม่น้ำโขง (${context.fishSpecies.length} ชนิด):\n`;
    context.fishSpecies.forEach((fish, idx) => {
      const iucn = fish.iucnStatus ? ` [IUCN:${fish.iucnStatus}]` : '';
      const local = fish.localName ? ` / ${fish.localName}` : '';
      const sci = fish.scientificName ? ` (${fish.scientificName})` : '';
      const desc = fish.description ? ` — ${fish.description.substring(0, 80)}` : '';
      prompt += `${idx + 1}. ${fish.thaiName}${local}${sci}${iucn}${desc}\n`;
    });
  }

  // เพิ่มสถิติรวม (ถ้ามี)
  if (context.stats) {
    prompt += `\nสถิติการจับปลาทั้งหมด:
- บันทึกการจับปลา: ${context.stats.totalRecords} ครั้ง
- น้ำหนักรวม: ${context.stats.totalWeight.toFixed(2)} กิโลกรัม
- มูลค่ารวม: ${context.stats.totalValue.toLocaleString()} บาท
- ข้อมูลที่ยืนยันแล้ว: ${context.stats.verifiedCount} รายการ
`;
  }

  // เพิ่มชนิดปลายอดนิยม (ถ้ามี)
  if (context.topSpecies && context.topSpecies.length > 0) {
    prompt += `\nข้อมูลชนิดปลา:
- จำนวนชนิดปลาทั้งหมด: ${context.totalSpecies || context.topSpecies.length} ชนิด

Top 15 ปลาที่จับได้บ่อยที่สุด:\n`;
    context.topSpecies.forEach((species, idx) => {
      prompt += `${idx + 1}. ${species.name}${species.localName ? ` (${species.localName})` : ''} - ${species.count} ตัว, น้ำหนักรวม ${species.totalWeight} กก.\n`;
    });
  }

  // เพิ่มภูมิปัญญาท้องถิ่น (ถ้ามี)
  if (context.wisdom && context.wisdom.length > 0) {
    prompt += `\nภูมิปัญญาท้องถิ่นที่เกี่ยวข้อง:\n`;
    context.wisdom.forEach((w, idx) => {
      prompt += `${idx + 1}. ${w.title}${w.fishType ? ` (ปลา: ${w.fishType})` : ''}
   - หมวด: ${w.category || 'ทั่วไป'}
   - คำอธิบาย: ${w.description || ''}
   - วิธีการ: ${w.technique || ''}
   ${w.season ? `- ฤดูกาล: ${w.season}` : ''}
   ${w.contributorName ? `- ผู้ให้ข้อมูล: ${w.contributorName}` : ''}
`;
    });
  }

  // เพิ่มข่าวล่าสุด (ถ้ามี)
  if (context.recentNews.length > 0) {
    prompt += `\nข่าวล่าสุด:\n`;
    context.recentNews.forEach((news, idx) => {
      prompt += `${idx + 1}. ${news.title} (${news.date})\n   ${news.summary}\n`;
    });
  }

  prompt += `\nคำถามจากผู้ใช้: ${userMessage}

คำแนะนำในการตอบ:
1. ตอบเป็นภาษาไทยที่เข้าใจง่าย เป็นกันเอง
2. ถ้าคำถามเกี่ยวกับปลาเฉพาะชนิด ให้ตอบจากข้อมูลด้านบน
3. ถ้าคำถามเกี่ยวกับสถิติ ให้อ้างอิงตัวเลขจากข้อมูลด้านบน
4. ถ้าไม่มีข้อมูลในฐานข้อมูล ให้บอกว่า "ไม่พบข้อมูลในระบบ" และแนะนำให้ติดต่อผู้ดูแลระบบ/นักวิจัย
5. ตอบสั้น กระชับ ไม่เกิน 200 คำ
6. ใช้ emoji เล็กน้อยเพื่อให้เป็นมิตร 🐟 🌊
7. ถ้าเป็นคำถามนอกเรื่องปลาหรือแม่น้ำโขง ให้บอกว่า "คำถามนี้อยู่นอกขอบเขต กรุณาถามเฉพาะเรื่องปลาแม่น้ำโขงครับ"

กรุณาตอบคำถาม:`;

  return prompt;
}

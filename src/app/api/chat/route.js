import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();

    console.log('✅ AI Answer:', answer.substring(0, 100) + '...');

    return NextResponse.json({
      success: true,
      answer: answer,
      context: {
        usedFishData: context.fishSpecies.length > 0,
        usedStats: context.stats !== null,
        sources: ['fish_species', 'fishingRecords', 'newsArticles']
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
 * ดึงข้อมูลจาก Firebase ที่เกี่ยวข้องกับคำถาม
 */
async function buildContext(message) {
  const context = {
    fishSpecies: [],
    stats: null,
    recentNews: []
  };

  try {
    // 1. ดึงข้อมูลปลาที่เกี่ยวข้อง (ถ้าคำถามมีชื่อปลา)
    const fishSnapshot = await getDocs(query(collection(db, 'fish_species'), limit(100)));
    const allFish = [];

    fishSnapshot.forEach((doc) => {
      const data = doc.data();
      const fishName = (data.thai_name || data.common_name_thai || '').toLowerCase();
      const localName = (data.local_name || '').toLowerCase();
      const scientificName = (data.scientific_name || '').toLowerCase();
      const messageLower = message.toLowerCase();

      // ถ้าคำถามมีชื่อปลา ให้เพิ่มข้อมูลปลานั้น
      if (
        messageLower.includes(fishName) ||
        messageLower.includes(localName) ||
        messageLower.includes(scientificName)
      ) {
        allFish.push({
          thaiName: data.thai_name || data.common_name_thai,
          localName: data.local_name,
          scientificName: data.scientific_name,
          family: data.family,
          group: data.group,
          iucnStatus: data.iucn_status,
          habitat: data.habitat,
          description: data.description
        });
      }
    });

    context.fishSpecies = allFish.slice(0, 10); // จำกัดไม่เกิน 10 ชนิด

    // ถ้าไม่เจอปลาเฉพาะ ให้ส่งสถิติรวม
    if (context.fishSpecies.length === 0) {
      // 2. ดึงสถิติรวม
      const statsRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fishing-records/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        context.stats = statsData.stats;
      }

      // 3. ดึงชนิดปลาที่จับได้บ่อย (Top 10)
      const speciesRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fishing-records/caught-species`);
      if (speciesRes.ok) {
        const speciesData = await speciesRes.json();
        context.topSpecies = speciesData.species?.slice(0, 10) || [];
      }
    }

    // 4. ดึงข่าวล่าสุด (ถ้าคำถามเกี่ยวกับข่าว)
    if (message.includes('ข่าว') || message.includes('อัปเดต') || message.includes('ล่าสุด')) {
      const newsSnapshot = await getDocs(query(collection(db, 'newsArticles'), limit(3)));
      context.recentNews = [];
      newsSnapshot.forEach((doc) => {
        const data = doc.data();
        context.recentNews.push({
          title: data.title,
          summary: data.summary,
          date: data.publishDate?.toDate?.()?.toLocaleDateString('th-TH') || ''
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

  // เพิ่มข้อมูลปลาเฉพาะ (ถ้ามี)
  if (context.fishSpecies.length > 0) {
    prompt += `\nข้อมูลปลาที่เกี่ยวข้อง:\n`;
    context.fishSpecies.forEach((fish, idx) => {
      prompt += `${idx + 1}. ${fish.thaiName}${fish.localName ? ` (${fish.localName})` : ''}
   - ชื่อวิทยาศาสตร์: ${fish.scientificName || 'ไม่ระบุ'}
   - วงศ์: ${fish.family || fish.group || 'ไม่ระบุ'}
   - สถานะ IUCN: ${fish.iucnStatus || 'ไม่ระบุ'}
   - ถิ่นอาศัย: ${fish.habitat || 'แม่น้ำโขง'}
   - คำอธิบาย: ${fish.description || 'ไม่มีข้อมูล'}
`;
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
    prompt += `\nTop 10 ปลาที่จับได้บ่อยที่สุด:\n`;
    context.topSpecies.forEach((species, idx) => {
      prompt += `${idx + 1}. ${species.name}${species.localName ? ` (${species.localName})` : ''} - ${species.count} ตัว\n`;
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
4. ถ้าไม่มีข้อมูลในฐานข้อมูล ให้บอกว่า "ไม่พบข้อมูลในระบบ" และแนะนำให้ติดต่อนักวิจัย
5. ตอบสั้น กระชับ ไม่เกิน 200 คำ
6. ใช้ emoji เล็กน้อยเพื่อให้เป็นมิตร 🐟 🌊
7. ถ้าเป็นคำถามนอกเรื่องปลาหรือแม่น้ำโขง ให้บอกว่า "คำถามนี้อยู่นอกขอบเขต กรุณาถามเฉพาะเรื่องปลาแม่น้ำโขงครับ"

กรุณาตอบคำถาม:`;

  return prompt;
}

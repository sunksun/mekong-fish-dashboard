import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Lazy import Gemini AI to avoid initialization errors
function getGeminiAI() {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
}

/**
 * AI Chat endpoint (No-RAG / Condition A)
 * ตอบคำถามโดยใช้ Gemini อย่างเดียว ไม่ดึงข้อมูลจาก Firestore
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

    console.log('🤖 AI Chat (No-RAG) - Question:', message);

    // สร้าง prompt โดยไม่ใช้ข้อมูล RAG จาก Firestore
    const prompt = `คุณคือผู้ช่วยตอบคำถามเกี่ยวกับปลาแม่น้ำโขงและระบบนิเวศแม่น้ำโขง
พื้นที่: แม่น้ำโขงตอนบน จ.เลย ประเทศไทย

คำถามจากผู้ใช้: ${message}

คำแนะนำในการตอบ:
1. ตอบเป็นภาษาไทยที่เข้าใจง่าย เป็นกันเอง
2. ตอบสั้น กระชับ ไม่เกิน 200 คำ
3. ใช้ emoji เล็กน้อยเพื่อให้เป็นมิตร 🐟 🌊
4. ถ้าเป็นคำถามนอกเรื่องปลาหรือแม่น้ำโขง ให้บอกว่า "คำถามนี้อยู่นอกขอบเขต"

กรุณาตอบคำถาม:`;

    // เรียก Gemini AI และวัดเวลา
    const ai = getGeminiAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();
    const response_time_ms = Date.now() - startTime;

    console.log('✅ AI Answer (No-RAG):', answer.substring(0, 100) + '...');
    console.log(`⏱️ Response time: ${response_time_ms}ms`);

    // บันทึก log ลง Firestore (ไม่ให้ error นี้ขัดขวาง response)
    try {
      await addDoc(collection(db, 'chatLogs'), {
        question: message,
        mode: 'no-rag',
        context_used: [],
        response: answer,
        response_time_ms,
        timestamp: new Date(),
      });
    } catch (logError) {
      console.error('⚠️ Failed to log chat to Firestore:', logError);
    }

    return NextResponse.json({
      success: true,
      answer: answer,
      context: {
        usedFishData: false,
        usedStats: false,
        sources: [],
      },
    });

  } catch (error) {
    console.error('❌ AI Chat (No-RAG) Error:', error);

    // ถ้า error จาก API key
    if (error.message?.includes('API key')) {
      return NextResponse.json({
        success: false,
        error: 'ระบบ AI ไม่สามารถใช้งานได้ กรุณาตรวจสอบ API Key',
        answer: 'ขออภัยครับ เกิดข้อผิดพลาดกับระบบ AI กรุณาลองใหม่อีกครั้ง หรือใช้ช่องค้นหาแบบปกติ',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        answer: 'ขออภัยครับ ไม่สามารถประมวลผลคำถามของคุณได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      },
      { status: 500 }
    );
  }
}

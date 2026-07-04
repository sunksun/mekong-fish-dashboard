import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { withCors, corsPreflightResponse } from '@/lib/cors';

export async function OPTIONS() {
  return corsPreflightResponse('*', ['GET', 'POST', 'OPTIONS']);
}

const VISITOR_STATS_DOC = 'stats';
const VISITORS_COLLECTION = 'siteVisitors';

// GET - ดึงจำนวนผู้เข้าชมทั้งหมด
export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.PUBLIC, key: 'site-visitors-get' });
  if (rl.limited) return tooManyRequests(rl);
  try {
    const docRef = doc(db, VISITORS_COLLECTION, VISITOR_STATS_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return withCors(NextResponse.json({
        totalVisitors: data.totalVisitors || 0,
        lastUpdated: data.lastUpdated?.toDate?.() || null
      }));
    } else {
      // ถ้ายังไม่มีข้อมูล ให้สร้างเอกสารใหม่
      await setDoc(docRef, {
        totalVisitors: 0,
        lastUpdated: serverTimestamp()
      });

      return withCors(NextResponse.json({
        totalVisitors: 0,
        lastUpdated: new Date()
      }));
    }
  } catch (error) {
    console.error('Error fetching visitor stats:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to fetch visitor stats' },
      { status: 500 }
    ));
  }
}

// POST - เพิ่มจำนวนผู้เข้าชม
export async function POST(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.PUBLIC, key: 'site-visitors-post' });
  if (rl.limited) return tooManyRequests(rl);
  try {
    const docRef = doc(db, VISITORS_COLLECTION, VISITOR_STATS_DOC);

    // ตรวจสอบว่ามีเอกสารอยู่แล้วหรือไม่
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // ถ้ามีอยู่แล้ว ให้ increment
      await setDoc(docRef, {
        totalVisitors: increment(1),
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } else {
      // ถ้ายังไม่มี ให้สร้างใหม่
      await setDoc(docRef, {
        totalVisitors: 1,
        lastUpdated: serverTimestamp()
      });
    }

    // ดึงข้อมูลล่าสุดหลังจากอัปเดต
    const updatedDocSnap = await getDoc(docRef);
    const data = updatedDocSnap.data();

    return withCors(NextResponse.json({
      totalVisitors: data.totalVisitors || 1,
      lastUpdated: data.lastUpdated?.toDate?.() || new Date()
    }));
  } catch (error) {
    console.error('Error incrementing visitor count:', error);
    return withCors(NextResponse.json(
      { error: 'Failed to increment visitor count' },
      { status: 500 }
    ));
  }
}

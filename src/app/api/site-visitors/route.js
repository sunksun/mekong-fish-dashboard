import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

const VISITOR_STATS_DOC = 'stats';
const VISITORS_COLLECTION = 'siteVisitors';

// GET - ดึงจำนวนผู้เข้าชมทั้งหมด
export async function GET() {
  try {
    const docRef = doc(db, VISITORS_COLLECTION, VISITOR_STATS_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return NextResponse.json({
        totalVisitors: data.totalVisitors || 0,
        lastUpdated: data.lastUpdated?.toDate?.() || null
      });
    } else {
      // ถ้ายังไม่มีข้อมูล ให้สร้างเอกสารใหม่
      await setDoc(docRef, {
        totalVisitors: 0,
        lastUpdated: serverTimestamp()
      });

      return NextResponse.json({
        totalVisitors: 0,
        lastUpdated: new Date()
      });
    }
  } catch (error) {
    console.error('Error fetching visitor stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visitor stats' },
      { status: 500 }
    );
  }
}

// POST - เพิ่มจำนวนผู้เข้าชม
export async function POST() {
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

    return NextResponse.json({
      totalVisitors: data.totalVisitors || 1,
      lastUpdated: data.lastUpdated?.toDate?.() || new Date()
    });
  } catch (error) {
    console.error('Error incrementing visitor count:', error);
    return NextResponse.json(
      { error: 'Failed to increment visitor count' },
      { status: 500 }
    );
  }
}

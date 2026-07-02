/**
 * Public site stats — ตัวเลขสรุปสำหรับ landing page
 *
 * ใช้ Firestore aggregation query (getCountFromServer) เพื่อดึงแค่ตัวเลข
 * ไม่ส่ง PII/password ไปที่ browser
 *
 * GET /api/site-stats
 * Cache: 5 นาที
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer } from 'firebase/firestore';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { withCors, corsPreflightResponse } from '@/lib/cors';

// Cache 5 นาที
export const revalidate = 300;

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.PUBLIC, key: 'site-stats' });
  if (rl.limited) return tooManyRequests(rl);

  try {
    const [usersSnap, recordsSnap, speciesSnap] = await Promise.all([
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(collection(db, 'fishingRecords')),
      getCountFromServer(collection(db, 'fish_species')),
    ]);

    const data = {
      success: true,
      users: usersSnap.data().count,
      records: recordsSnap.data().count,
      species: speciesSnap.data().count,
      generatedAt: new Date().toISOString(),
    };

    return withCors(NextResponse.json(data));
  } catch (error) {
    console.error('site-stats error:', error);
    return withCors(NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    ));
  }
}

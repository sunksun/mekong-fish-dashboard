import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy
} from 'firebase/firestore';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { withCors, corsPreflightResponse } from '@/lib/cors';

export async function OPTIONS() {
  return corsPreflightResponse();
}

// GET: Fetch all fishing spots
export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.PUBLIC, key: 'fishing-spots' });
  if (rl.limited) return tooManyRequests(rl);
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // filter by status (active/inactive)

    const spotsRef = collection(db, 'fishingSpots');
    // Simple query without composite index requirement
    const q = query(spotsRef, orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(q);

    let spots = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      spots.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      });
    });

    // Filter by status in memory (no index required)
    if (statusFilter) {
      spots = spots.filter(spot => spot.status === statusFilter);
    }

    return withCors(NextResponse.json({
      success: true,
      data: spots,
      total: spots.length,
      stats: {
        active: spots.filter(s => s.status === 'active').length,
        inactive: spots.filter(s => s.status === 'inactive').length,
        withCoordinates: spots.filter(s => s.latitude && s.longitude).length
      }
    }));

  } catch (error) {
    console.error('Error fetching fishing spots:', error);
    return withCors(NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch fishing spots',
        message: error.message
      },
      { status: 500 }
    ));
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { adminDb, admin } from '@/lib/firebase-admin';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { withCors, corsPreflightResponse } from '@/lib/cors';
import { requireAdminOrResearcher } from '@/lib/api-auth';

export async function OPTIONS() {
  return corsPreflightResponse('*', ['GET', 'POST', 'OPTIONS']);
}

export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.PUBLIC, key: 'featured-fish-photos-get' });
  if (rl.limited) return tooManyRequests(rl);
  try {
    const snapshot = await getDocs(collection(db, 'featuredFishPhotos'));
    const featured = {};
    snapshot.forEach((d) => {
      featured[d.id] = d.data();
    });
    return withCors(NextResponse.json({ success: true, featured }));
  } catch (err) {
    return withCors(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
  }
}

export async function POST(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.AUTHENTICATED, key: 'featured-fish-photos-post' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { species, photoUrl, recordId } = body;

    if (!species || !photoUrl) {
      return NextResponse.json({ success: false, error: 'species and photoUrl are required' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Server not configured for write access' },
        { status: 500 }
      );
    }

    // เขียนด้วย Admin SDK (bypass rules) — route ผ่าน requireAdminOrResearcher แล้วจึงเป็น trusted gate
    await adminDb.collection('featuredFishPhotos').doc(species).set({
      species,
      photoUrl,
      recordId: recordId || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

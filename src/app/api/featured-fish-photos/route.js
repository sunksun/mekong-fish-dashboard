import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, 'featuredFishPhotos'));
    const featured = {};
    snapshot.forEach((d) => {
      featured[d.id] = d.data();
    });
    return NextResponse.json({ success: true, featured });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { species, photoUrl, recordId } = body;

    if (!species || !photoUrl) {
      return NextResponse.json({ success: false, error: 'species and photoUrl are required' }, { status: 400 });
    }

    await setDoc(doc(db, 'featuredFishPhotos', species), {
      species,
      photoUrl,
      recordId: recordId || null,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

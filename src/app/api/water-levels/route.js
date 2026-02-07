import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request) {
  try {
    console.log('API: Fetching water levels...');

    const waterLevelRef = adminDb.collection('waterLevels');
    const snapshot = await waterLevelRef
      .orderBy('date', 'desc')
      .orderBy('time', 'desc')
      .limit(30)
      .get();

    if (snapshot.empty) {
      console.log('API: No water level data found');
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No water level data available'
      });
    }

    const records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`API: Found ${records.length} water level records`);

    return NextResponse.json({
      success: true,
      data: records
    });

  } catch (error) {
    console.error('API Error fetching water levels:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        data: []
      },
      { status: 500 }
    );
  }
}

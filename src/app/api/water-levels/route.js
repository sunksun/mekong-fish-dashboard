import { NextResponse } from 'next/server';

// Enable caching with revalidation every 5 minutes (300 seconds)
export const revalidate = 300;

/**
 * Fetch Firestore collection using REST API
 */
async function fetchWaterLevels(limitCount = 30) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  // Firestore REST API doesn't support orderBy in URL params easily
  // So we'll fetch and sort in memory
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/waterLevels?key=${apiKey}&pageSize=100`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.documents) return [];

    // Convert and sort
    const records = data.documents.map(doc => {
      const fields = doc.fields || {};
      return {
        id: doc.name.split('/').pop(),
        date: fields.date?.stringValue || '',
        time: fields.time?.stringValue || '',
        waterLevel: fields.waterLevel?.doubleValue || fields.waterLevel?.integerValue || 0,
        waterChange: fields.waterChange?.doubleValue || fields.waterChange?.integerValue || 0,
        location: fields.location?.stringValue || ''
      };
    });

    // Sort by date and time descending
    return records
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.time.localeCompare(a.time);
      })
      .slice(0, limitCount);

  } catch (error) {
    console.error('Error fetching water levels:', error);
    return [];
  }
}

export async function GET(request) {
  try {
    console.log('API: Fetching water levels...');

    const records = await fetchWaterLevels(30);

    if (records.length === 0) {
      console.log('API: No water level data found');
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No water level data available'
      });
    }

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

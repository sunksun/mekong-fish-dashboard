import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';

// GET - Fetch fishing records statistics (no limit, calculates from all records)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const minDate = searchParams.get('minDate'); // e.g., '2025-01-01'
    const userId = searchParams.get('userId') || null;

    // Build Firestore query
    let constraints = [];

    // Filter by userId (optional)
    if (userId) {
      constraints.push(where('userId', '==', userId));
    }

    // Filter by minimum date (Year Filter)
    if (minDate) {
      const minDateObj = new Date(minDate);
      constraints.push(where('date', '>=', Timestamp.fromDate(minDateObj)));
    }

    // Create query WITHOUT limit to get all records
    const recordsRef = collection(db, 'fishingRecords');
    const q = query(recordsRef, ...constraints);

    // Execute query
    const querySnapshot = await getDocs(q);

    // Calculate statistics
    let totalRecords = 0;
    let totalWeight = 0;
    let totalValue = 0;
    let verifiedCount = 0;

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      totalRecords++;

      // Add weight
      const weight = parseFloat(data.totalWeight) || 0;
      totalWeight += weight;

      // Calculate value from fishList
      let recordValue = 0;
      if (data.fishList && Array.isArray(data.fishList)) {
        data.fishList.forEach(fish => {
          const fishWeight = parseFloat(fish.weight) || 0;
          const fishPrice = parseFloat(fish.price) || 0;
          recordValue += fishWeight * fishPrice;
        });
      }
      totalValue += recordValue;

      // Count verified
      if (data.verified === true) {
        verifiedCount++;
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalRecords,
        totalWeight,
        totalValue,
        verifiedCount
      }
    });

  } catch (error) {
    console.error('Error fetching fishing records stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch statistics',
        message: error.message
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  Timestamp,
  where
} from 'firebase/firestore';

// GET: Fetch all fishing spots
export async function GET(request) {
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

    return NextResponse.json({
      success: true,
      data: spots,
      total: spots.length,
      stats: {
        active: spots.filter(s => s.status === 'active').length,
        inactive: spots.filter(s => s.status === 'inactive').length,
        withCoordinates: spots.filter(s => s.latitude && s.longitude).length
      }
    });

  } catch (error) {
    console.error('Error fetching fishing spots:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch fishing spots',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST: Create new fishing spot
export async function POST(request) {
  try {
    const body = await request.json();
    const { spotName, location, description, latitude, longitude, status, createdBy } = body;

    // Validation
    if (!spotName || !location) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          message: 'spotName and location are required'
        },
        { status: 400 }
      );
    }

    // Validate coordinates if provided
    if (latitude !== undefined || longitude !== undefined) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid coordinates',
            message: 'latitude and longitude must be valid numbers'
          },
          { status: 400 }
        );
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid coordinates',
            message: 'latitude must be between -90 and 90, longitude must be between -180 and 180'
          },
          { status: 400 }
        );
      }
    }

    const newSpot = {
      spotName,
      location,
      description: description || '',
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      status: status || 'active',
      createdBy: createdBy || 'system',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const spotsRef = collection(db, 'fishingSpots');
    const docRef = await addDoc(spotsRef, newSpot);

    return NextResponse.json({
      success: true,
      message: 'Fishing spot created successfully',
      data: {
        id: docRef.id,
        ...newSpot,
        createdAt: newSpot.createdAt.toDate().toISOString(),
        updatedAt: newSpot.updatedAt.toDate().toISOString()
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating fishing spot:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create fishing spot',
        message: error.message
      },
      { status: 500 }
    );
  }
}

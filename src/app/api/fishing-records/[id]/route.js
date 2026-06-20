import { NextResponse } from 'next/server';
import { db, storage } from '@/lib/firebase';
import { requireAuth, requireAdminOrResearcher } from '@/lib/api-auth';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

// GET - Fetch single fishing record by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const docRef = doc(db, 'fishingRecords', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Record not found'
        },
        { status: 404 }
      );
    }

    const data = docSnap.data();
    const record = {
      id: docSnap.id,
      ...data,
      // Convert Firestore Timestamps to ISO strings
      catchDate: data.catchDate?.toDate?.()?.toISOString() || data.catchDate,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: record
    });

  } catch (error) {
    console.error('Error fetching fishing record:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch fishing record',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// PUT - Update fishing record (admin/researcher only)
export async function PUT(request, { params }) {
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await request.json();

    const docRef = doc(db, 'fishingRecords', id);

    // Check if document exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Record not found'
        },
        { status: 404 }
      );
    }

    // Prepare update data - only update specific fields from the edit form
    const updateData = {
      updatedAt: Timestamp.now()
    };

    // Convert catchDate first before validating allowed fields
    if (body.catchDate && typeof body.catchDate === 'string') {
      const newDate = Timestamp.fromDate(new Date(body.catchDate));
      updateData.catchDate = newDate;
      updateData.date = newDate; // Also update 'date' field for mobile app compatibility
    }

    // Update only the fields that are provided and allowed
    const allowedFields = ['verified', 'notes', 'weather', 'waterLevel', 'totalWeight', 'totalValue', 'method', 'fishData', 'fishList'];

    allowedFields.forEach(field => {
      if (body.hasOwnProperty(field)) {
        updateData[field] = body[field];
      }
    });

    // Handle location object separately
    if (body.location && typeof body.location === 'object') {
      updateData.location = body.location;
    }

    // Validate numeric fields
    if (updateData.totalWeight !== undefined) {
      updateData.totalWeight = parseFloat(updateData.totalWeight) || 0;
    }
    if (updateData.totalValue !== undefined) {
      updateData.totalValue = parseFloat(updateData.totalValue) || 0;
    }

    // Update document
    await updateDoc(docRef, updateData);

    // Fetch updated document
    const updatedDocSnap = await getDoc(docRef);
    const data = updatedDocSnap.data();
    const record = {
      id: updatedDocSnap.id,
      ...data,
      catchDate: data.catchDate?.toDate?.()?.toISOString() || data.catchDate,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    };

    return NextResponse.json({
      success: true,
      message: 'Record updated successfully',
      data: record
    });

  } catch (error) {
    console.error('Error updating fishing record:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update fishing record',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// PATCH - Partial update (e.g., verify record) — admin/researcher only + field whitelist
const ALLOWED_PATCH_FIELDS = new Set([
  'verified', 'verifiedBy', 'verifiedAt', 'notes',
  'fishList', 'totalWeight', 'totalValue', 'location'
]);

export async function PATCH(request, { params }) {
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const rawBody = await request.json();
    // Whitelist allowed fields — reject unknown fields to prevent injection
    const body = {};
    for (const key of Object.keys(rawBody || {})) {
      if (ALLOWED_PATCH_FIELDS.has(key)) body[key] = rawBody[key];
    }

    const docRef = doc(db, 'fishingRecords', id);

    // Check if document exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Record not found'
        },
        { status: 404 }
      );
    }

    // Prepare partial update data
    const updateData = {
      ...body,
      updatedAt: Timestamp.now()
    };

    // Update document
    await updateDoc(docRef, updateData);

    // Fetch updated document
    const updatedDocSnap = await getDoc(docRef);
    const data = updatedDocSnap.data();
    const record = {
      id: updatedDocSnap.id,
      ...data,
      catchDate: data.catchDate?.toDate?.()?.toISOString() || data.catchDate,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    };

    return NextResponse.json({
      success: true,
      message: 'Record updated successfully',
      data: record
    });

  } catch (error) {
    console.error('Error updating fishing record:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update fishing record',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete fishing record (admin/researcher only)
export async function DELETE(request, { params }) {
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;

    // Use Client SDK
    const docRef = doc(db, 'fishingRecords', id);

    // Check if document exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Record not found'
        },
        { status: 404 }
      );
    }

    // Get document data to find associated images
    const data = docSnap.data();
    const deletedImages = [];
    const failedImages = [];

    // Delete associated images from Storage
    if (data.fishList && Array.isArray(data.fishList)) {
      for (const fish of data.fishList) {
        if (fish.photo) {
          try {
            // Check if it's a Firebase Storage URL
            if (fish.photo.startsWith('gs://') || fish.photo.includes('firebasestorage.googleapis.com')) {
              let storagePath;

              if (fish.photo.startsWith('gs://')) {
                // Extract path from gs:// URL
                storagePath = fish.photo.replace(/^gs:\/\/[^/]+\//, '');
              } else if (fish.photo.includes('firebasestorage.googleapis.com')) {
                // Extract path from HTTPS URL
                const urlParts = fish.photo.split('/o/');
                if (urlParts.length > 1) {
                  storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
                }
              }

              if (storagePath) {
                const imageRef = ref(storage, storagePath);
                await deleteObject(imageRef);
                deletedImages.push(storagePath);
                console.log('✓ Deleted image:', storagePath);
              }
            }
          } catch (imageError) {
            // Log error but continue (image might already be deleted or not exist)
            console.warn('Failed to delete image:', fish.photo, imageError.message);
            failedImages.push(fish.photo);
          }
        }
      }
    }

    // Delete document from Firestore using Client SDK
    await deleteDoc(docRef);

    return NextResponse.json({
      success: true,
      message: 'Record deleted successfully',
      id,
      imagesDeleted: deletedImages.length,
      imagesFailed: failedImages.length,
      details: {
        deletedImages,
        failedImages
      }
    });

  } catch (error) {
    console.error('Error deleting fishing record:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete fishing record',
        message: error.message
      },
      { status: 500 }
    );
  }
}

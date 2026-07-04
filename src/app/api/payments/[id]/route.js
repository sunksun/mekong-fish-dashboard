import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { requireAuth, requireAdminOrResearcher } from '@/lib/api-auth';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';

// GET - Get single payment
export async function GET(request, { params }) {
  const rl = rateLimit(request, { ...RATE_LIMITS.AUTHENTICATED, key: 'payment-get' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = params;
    const paymentDoc = await getDoc(doc(db, 'payments', id));

    if (!paymentDoc.exists()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment not found'
        },
        { status: 404 }
      );
    }

    const payment = {
      id: paymentDoc.id,
      ...paymentDoc.data(),
      createdAt: paymentDoc.data().createdAt?.toDate?.()?.toISOString() || paymentDoc.data().createdAt,
      updatedAt: paymentDoc.data().updatedAt?.toDate?.()?.toISOString() || paymentDoc.data().updatedAt,
      paidDate: paymentDoc.data().paidDate?.toDate?.()?.toISOString() || paymentDoc.data().paidDate
    };

    return NextResponse.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch payment',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// PUT - Update payment (admin/researcher only)
export async function PUT(request, { params }) {
  const rl = rateLimit(request, { ...RATE_LIMITS.AUTHENTICATED, key: 'payment-put' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = params;
    const body = await request.json();

    const paymentRef = doc(db, 'payments', id);
    const paymentDoc = await getDoc(paymentRef);

    if (!paymentDoc.exists()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment not found'
        },
        { status: 404 }
      );
    }

    // Update payment
    const updateData = {
      ...body,
      updatedAt: Timestamp.now()
    };

    await updateDoc(paymentRef, updateData);

    return NextResponse.json({
      success: true,
      message: 'Payment updated successfully'
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update payment',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// DELETE - Cancel payment (admin/researcher only)
export async function DELETE(request, { params }) {
  const rl = rateLimit(request, { ...RATE_LIMITS.AUTHENTICATED, key: 'payment-delete' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = params;
    const paymentRef = doc(db, 'payments', id);
    const paymentDoc = await getDoc(paymentRef);

    if (!paymentDoc.exists()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment not found'
        },
        { status: 404 }
      );
    }

    const paymentData = paymentDoc.data();

    // Revert fishingRecords
    const batch = writeBatch(db);
    if (paymentData.recordIds && Array.isArray(paymentData.recordIds)) {
      paymentData.recordIds.forEach(recordId => {
        const recordRef = doc(db, 'fishingRecords', recordId);
        batch.update(recordRef, {
          isPaid: false,
          paymentId: null,
          paymentDate: null,
          paymentAmount: null
        });
      });
    }

    // Delete payment
    await deleteDoc(paymentRef);
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'Payment cancelled successfully'
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel payment',
        message: error.message
      },
      { status: 500 }
    );
  }
}

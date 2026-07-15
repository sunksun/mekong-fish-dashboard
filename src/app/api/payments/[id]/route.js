import { NextResponse } from 'next/server';
import { adminDb, admin } from '@/lib/firebase-admin';
import { requireAuth, requireAdminOrResearcher } from '@/lib/api-auth';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';

const Timestamp = admin.firestore.Timestamp;

// GET - Get single payment
export async function GET(request, { params }) {
  const rl = rateLimit(request, { ...RATE_LIMITS.AUTHENTICATED, key: 'payment-get' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Server not configured for database access' },
      { status: 500 }
    );
  }
  try {
    const { id } = params;
    const paymentDoc = await adminDb.collection('payments').doc(id).get();

    if (!paymentDoc.exists) {
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
  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Server not configured for database access' },
      { status: 500 }
    );
  }
  try {
    const { id } = params;
    const body = await request.json();

    const paymentRef = adminDb.collection('payments').doc(id);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
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

    await paymentRef.update(updateData);

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
  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Server not configured for database access' },
      { status: 500 }
    );
  }
  try {
    const { id } = params;
    const paymentRef = adminDb.collection('payments').doc(id);

    // Revert fishingRecords + delete payment atomically in a single transaction,
    // so a crash can never leave records marked paid while the payment is gone.
    try {
      await adminDb.runTransaction(async (tx) => {
        // Read all docs first (transaction requires reads before writes)
        const paymentDoc = await tx.get(paymentRef);
        if (!paymentDoc.exists) {
          throw new Error('PAYMENT_NOT_FOUND');
        }

        const paymentData = paymentDoc.data();
        const recordRefs =
          Array.isArray(paymentData.recordIds)
            ? paymentData.recordIds.map(recordId => adminDb.collection('fishingRecords').doc(recordId))
            : [];

        // Read record docs so we only revert ones that still exist (avoids
        // failing the whole cancel on a dangling recordId).
        const recordSnaps = await Promise.all(recordRefs.map(ref => tx.get(ref)));

        // All reads done — now revert existing records and delete the payment
        recordSnaps.forEach((snap, i) => {
          if (snap.exists) {
            tx.update(recordRefs[i], {
              isPaid: false,
              paymentId: null,
              paymentDate: null,
              paymentAmount: null
            });
          }
        });
        tx.delete(paymentRef);
      });
    } catch (txError) {
      if (txError.message === 'PAYMENT_NOT_FOUND') {
        return NextResponse.json(
          {
            success: false,
            error: 'Payment not found'
          },
          { status: 404 }
        );
      }
      throw txError;
    }

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

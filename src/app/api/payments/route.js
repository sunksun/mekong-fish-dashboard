import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { requireAuth, requireAdminOrResearcher } from '@/lib/api-auth';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  runTransaction
} from 'firebase/firestore';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';

// GET - Fetch all payments (require signed-in user)
export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.AUTHENTICATED, key: 'payments-get' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const period = searchParams.get('period');
    const status = searchParams.get('status');

    let q = collection(db, 'payments');
    let constraints = [];

    if (userId) {
      constraints.push(where('userId', '==', userId));
    }
    if (period) {
      constraints.push(where('period', '==', period));
    }
    if (status) {
      constraints.push(where('status', '==', status));
    }

    // Only add orderBy if there are no where constraints (to avoid index issues)
    if (constraints.length === 0) {
      constraints.push(orderBy('createdAt', 'desc'));
    }

    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    const snapshot = await getDocs(q);
    const payments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      paidDate: doc.data().paidDate?.toDate?.()?.toISOString() || doc.data().paidDate,
      periodStart: doc.data().periodStart?.toDate?.()?.toISOString() || doc.data().periodStart,
      periodEnd: doc.data().periodEnd?.toDate?.()?.toISOString() || doc.data().periodEnd
    }));

    return NextResponse.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch payments',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST - Create new payment (admin/researcher only)
export async function POST(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.AUTHENTICATED, key: 'payments-post' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    console.log('🔷 API received payment request:', body);

    const {
      userId,
      fisherName,
      period,
      periodStart,
      periodEnd,
      recordIds,
      paymentRate,
      paidDate,
      notes,
      paidBy,
      paidByName
    } = body;

    // Validation
    if (!userId || !period || !recordIds || recordIds.length === 0) {
      console.error('❌ Validation failed:', { userId, period, recordIds: recordIds?.length });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          details: { userId: !!userId, period: !!period, recordIds: recordIds?.length || 0 }
        },
        { status: 400 }
      );
    }

    // Check for duplicate payment (same fisher + same period)
    console.log(`🔍 Checking for existing payment: userId=${userId}, period=${period}`);
    const paymentsRef = collection(db, 'payments');
    const duplicateQuery = query(
      paymentsRef,
      where('userId', '==', userId),
      where('period', '==', period)
    );
    const existingPayments = await getDocs(duplicateQuery);

    if (!existingPayments.empty) {
      const existingPayment = existingPayments.docs[0];
      console.error('❌ Duplicate payment detected:', existingPayment.id);
      return NextResponse.json(
        {
          success: false,
          error: 'ชาวประมงนี้ได้รับการจ่ายเงินสำหรับเดือนนี้แล้ว',
          existingPaymentId: existingPayment.id,
          existingPeriod: period
        },
        { status: 400 }
      );
    }
    console.log('✅ No duplicate payment found');

    // Create payment document
    const paymentData = {
      userId,
      fisherName: fisherName || '',
      period,
      periodStart: periodStart ? Timestamp.fromDate(new Date(periodStart)) : null,
      periodEnd: periodEnd ? Timestamp.fromDate(new Date(periodEnd)) : null,
      recordIds,
      totalRecords: recordIds.length,
      availableRecords: recordIds.length,
      selectedRecords: recordIds.length,
      paymentRate: paymentRate || 500,
      amount: paymentRate || 500,
      status: 'paid',
      notes: notes || '',
      paidBy: paidBy || '',
      paidByName: paidByName || '',
      paidDate: paidDate ? Timestamp.fromDate(new Date(paidDate)) : Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // Create payment + mark fishing records atomically in a single transaction.
    // Pre-generate the payment doc ref so we can write it and reference its id inside the tx.
    const paymentRef = doc(collection(db, 'payments'));
    const paymentId = paymentRef.id;
    const paymentDateTimestamp = paidDate ? Timestamp.fromDate(new Date(paidDate)) : Timestamp.now();

    console.log('💾 Creating payment + updating records atomically...', paymentData);
    await runTransaction(db, async (tx) => {
      // Read all record docs first (transaction requires all reads before writes)
      const recordRefs = recordIds.map(recordId => doc(db, 'fishingRecords', recordId));
      const recordSnaps = await Promise.all(recordRefs.map(ref => tx.get(ref)));

      recordSnaps.forEach((snap, i) => {
        if (!snap.exists()) {
          // INV-07: refuse to fan out onto a record that does not exist
          throw new Error(`ไม่พบรายการจับปลา: ${recordIds[i]}`);
        }
        if (snap.data().isPaid === true) {
          // INV-08: refuse to pay a record that is already paid (no double payment)
          throw new Error(`รายการนี้ถูกจ่ายเงินไปแล้ว: ${recordIds[i]}`);
        }
      });

      // All reads done — now write payment doc and fan out onto records
      tx.set(paymentRef, paymentData);
      recordRefs.forEach(ref => {
        tx.update(ref, {
          isPaid: true,
          paymentId: paymentId,
          paymentDate: paymentDateTimestamp,
          paymentAmount: paymentRate || 500
        });
      });
    });
    console.log('✅ Payment created and fishing records updated atomically:', paymentId);

    return NextResponse.json({
      success: true,
      paymentId: paymentId,
      message: 'Payment created successfully'
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create payment',
        message: error.message
      },
      { status: 500 }
    );
  }
}

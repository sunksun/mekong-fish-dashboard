import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';

// GET - Fetch all payments
export async function GET(request) {
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

    constraints.push(orderBy('createdAt', 'desc'));

    if (constraints.length > 0) {
      q = query(q, ...constraints);
    } else {
      q = query(q, orderBy('createdAt', 'desc'));
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

// POST - Create new payment
export async function POST(request) {
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

    // Add payment document
    console.log('💾 Creating payment document...', paymentData);
    const paymentRef = await addDoc(collection(db, 'payments'), paymentData);
    const paymentId = paymentRef.id;
    console.log('✅ Payment document created:', paymentId);

    // Update fishingRecords with payment info
    const batch = writeBatch(db);
    const paymentDateTimestamp = paidDate ? Timestamp.fromDate(new Date(paidDate)) : Timestamp.now();

    console.log(`📝 Updating ${recordIds.length} fishing records...`);
    recordIds.forEach(recordId => {
      const recordRef = doc(db, 'fishingRecords', recordId);
      batch.update(recordRef, {
        isPaid: true,
        paymentId: paymentId,
        paymentDate: paymentDateTimestamp,
        paymentAmount: paymentRate || 500
      });
    });

    await batch.commit();
    console.log('✅ Fishing records updated successfully');

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

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore';

// GET - Fetch users
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    let q = collection(db, 'users');
    let constraints = [];

    // Filter by role if specified
    if (role) {
      constraints.push(where('role', '==', role));
    }

    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      lastLogin: doc.data().lastLogin?.toDate?.()?.toISOString() || doc.data().lastLogin
    }));

    return NextResponse.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch users',
        message: error.message
      },
      { status: 500 }
    );
  }
}

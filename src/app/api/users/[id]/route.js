import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc
} from 'firebase/firestore';

// GET - Get single user
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const userDoc = await getDoc(doc(db, 'users', id));

    if (!userDoc.exists()) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      );
    }

    const user = {
      id: userDoc.id,
      ...userDoc.data(),
      createdAt: userDoc.data().createdAt?.toDate?.()?.toISOString() || userDoc.data().createdAt,
      lastLogin: userDoc.data().lastLogin?.toDate?.()?.toISOString() || userDoc.data().lastLogin
    };

    return NextResponse.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user',
        message: error.message
      },
      { status: 500 }
    );
  }
}

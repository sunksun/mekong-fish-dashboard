import { NextResponse } from 'next/server';
import { admin, adminDb } from './firebase-admin';
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, query, where, limit as fbLimit } from 'firebase/firestore';

const ROLES = {
  ADMIN: 'admin',
  RESEARCHER: 'researcher',
  GOVERNMENT: 'government',
  COMMUNITY_MANAGER: 'community_manager',
  FISHERMAN: 'fisherman',
};

async function verifyToken(request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return { error: 'Empty token', status: 401 };

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email, decoded };
  } catch (e) {
    return { error: 'Invalid or expired token', status: 401 };
  }
}

async function getUserRoleAdmin(uid, email) {
  if (!adminDb) throw new Error('adminDb not initialized');
  const direct = await adminDb.collection('users').doc(uid).get();
  if (direct.exists && direct.data()?.role) return direct.data().role;
  const q1 = await adminDb.collection('users').where('uid', '==', uid).limit(1).get();
  if (!q1.empty) return q1.docs[0].data()?.role || null;
  if (email) {
    const q2 = await adminDb.collection('users').where('email', '==', email).limit(1).get();
    if (!q2.empty) return q2.docs[0].data()?.role || null;
  }
  return null;
}

async function getUserRoleClient(uid, email) {
  const direct = await getDoc(doc(db, 'users', uid));
  if (direct.exists() && direct.data()?.role) return direct.data().role;
  const q1 = await getDocs(query(collection(db, 'users'), where('uid', '==', uid), fbLimit(1)));
  if (!q1.empty) return q1.docs[0].data()?.role || null;
  if (email) {
    const q2 = await getDocs(query(collection(db, 'users'), where('email', '==', email), fbLimit(1)));
    if (!q2.empty) return q2.docs[0].data()?.role || null;
  }
  return null;
}

async function getUserRole(uid, email) {
  // ลอง admin SDK ก่อน (production) — ถ้าล้ม fallback client SDK (dev)
  try {
    const r = await getUserRoleAdmin(uid, email);
    if (r) return r;
  } catch (e) {
    console.warn('[getUserRole] admin SDK failed, falling back to client SDK:', e.message);
  }
  try {
    return await getUserRoleClient(uid, email);
  } catch (e) {
    console.error('[getUserRole] client SDK also failed:', e);
    return null;
  }
}

/**
 * Require user to be signed in (any role).
 * Returns { uid, role } on success, or NextResponse on failure.
 */
export async function requireAuth(request) {
  const result = await verifyToken(request);
  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  const role = await getUserRole(result.uid, result.email);
  return { uid: result.uid, email: result.email, role };
}

/**
 * Require user to have one of allowedRoles.
 * Returns { uid, role } on success, or NextResponse on failure.
 */
export async function requireRole(request, allowedRoles) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth.role || !allowedRoles.includes(auth.role)) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions' },
      { status: 403 }
    );
  }
  return auth;
}

export const requireAdmin = (req) => requireRole(req, [ROLES.ADMIN]);
export const requireAdminOrResearcher = (req) =>
  requireRole(req, [ROLES.ADMIN, ROLES.RESEARCHER]);

export { ROLES };

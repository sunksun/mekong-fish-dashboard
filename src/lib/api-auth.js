import { NextResponse } from 'next/server';
import { admin, adminDb } from './firebase-admin';

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

async function getUserRole(uid) {
  if (!adminDb) return null;
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    return snap.data()?.role || null;
  } catch {
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
  const role = await getUserRole(result.uid);
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

import { auth } from './firebase';

/**
 * Fetch wrapper ที่แนบ Firebase ID token ไปกับ request โดยอัตโนมัติ
 * ใช้กับ API routes ที่ต้อง auth
 */
export async function authFetch(url, options = {}) {
  const user = auth.currentUser;
  const headers = new Headers(options.headers || {});
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    } catch (e) {
      console.warn('Failed to get ID token:', e);
    }
  }
  if (options.body && !headers.has('Content-Type') && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
}

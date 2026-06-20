import { NextResponse } from 'next/server';

/**
 * Standard API response helpers
 *
 * รูปแบบมาตรฐาน:
 *   Success: { success: true, data: any, meta?: object }
 *   Error:   { success: false, error: string, code?: string }
 *
 * ใช้ใน API routes ใหม่ เพื่อความสม่ำเสมอ
 * (Route เก่ายังคง response shape เดิมไว้เพื่อ backwards compatibility)
 */

export function apiSuccess(data, meta = null) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body);
}

export function apiError(message, status = 500, code = null) {
  const body = { success: false, error: message };
  if (code) body.code = code;
  return NextResponse.json(body, { status });
}

// Common errors
export const apiUnauthorized = (msg = 'Authentication required') =>
  apiError(msg, 401, 'UNAUTHORIZED');

export const apiForbidden = (msg = 'Insufficient permissions') =>
  apiError(msg, 403, 'FORBIDDEN');

export const apiBadRequest = (msg = 'Bad request') =>
  apiError(msg, 400, 'BAD_REQUEST');

export const apiNotFound = (msg = 'Not found') =>
  apiError(msg, 404, 'NOT_FOUND');

/**
 * CORS helper สำหรับ API routes ที่ต้องการเปิดให้ 3rd-party เรียก
 *
 * การใช้งาน:
 *   import { corsHeaders, corsResponse } from '@/lib/cors';
 *
 *   export async function OPTIONS() {
 *     return new Response(null, { headers: corsHeaders() });
 *   }
 *
 *   export async function GET(request) {
 *     const data = { ... };
 *     return corsResponse(NextResponse.json(data));
 *   }
 */

import { NextResponse } from 'next/server';

/**
 * @param {string} origin — allowed origin (default '*' = ทุก origin)
 * @param {string[]} methods — HTTP methods
 */
export function corsHeaders(origin = '*', methods = ['GET', 'OPTIONS']) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods.join(', '),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * เพิ่ม CORS headers ให้กับ NextResponse ที่มีอยู่แล้ว
 */
export function withCors(response, origin = '*', methods = ['GET', 'OPTIONS']) {
  const headers = corsHeaders(origin, methods);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Response สำหรับ OPTIONS preflight
 */
export function corsPreflightResponse(origin = '*', methods = ['GET', 'OPTIONS']) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin, methods),
  });
}

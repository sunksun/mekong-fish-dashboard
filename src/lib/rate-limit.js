/**
 * Rate limiting middleware — in-memory sliding window
 *
 * ใช้ใน dev / small production ได้เลย ไม่ต้องพึ่ง Redis
 * สำหรับ production scale ใหญ่ควรอัปเกรดเป็น Upstash Redis
 *
 * การใช้งาน:
 *   import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
 *
 *   export async function GET(request) {
 *     const rl = rateLimit(request, { max: 60, windowMs: 60_000 });
 *     if (rl.limited) return tooManyRequests(rl);
 *     // ... logic ปกติ
 *   }
 */

import { NextResponse } from 'next/server';

// bucket : { ip -> timestamps[] } — เก็บใน memory ของ process นั้นๆ
// หลาย instances/serverless cold start จะได้ counter ใหม่ (ยอมรับได้สำหรับ MVP)
const buckets = new Map();

/**
 * ดึง IP ของ requester จาก headers ที่ Vercel/Next.js เซ็ตให้
 */
function getClientIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip')
    || request.headers.get('cf-connecting-ip')
    || 'unknown';
}

/**
 * ตรวจว่า request นี้ยังอยู่ในโควตาไหม
 *
 * @param {Request} request
 * @param {object} opts
 * @param {number} opts.max         จำนวน request สูงสุดในช่วง windowMs (default 60)
 * @param {number} opts.windowMs    ช่วงเวลาเป็น ms (default 60000 = 1 นาที)
 * @param {string} [opts.key]       key เพิ่มเติม เช่น route name ทำให้แยก quota per endpoint
 * @returns {{ limited: boolean, retryAfter: number, remaining: number, resetAt: number }}
 */
export function rateLimit(request, opts = {}) {
  const max = opts.max ?? 60;
  const windowMs = opts.windowMs ?? 60_000;
  const ip = getClientIp(request);
  const bucketKey = opts.key ? `${opts.key}::${ip}` : ip;

  const now = Date.now();
  const arr = (buckets.get(bucketKey) || []).filter(t => now - t < windowMs);

  if (arr.length >= max) {
    const oldest = arr[0];
    const retryAfter = Math.ceil((windowMs - (now - oldest)) / 1000);
    return {
      limited: true,
      retryAfter,
      remaining: 0,
      resetAt: oldest + windowMs,
    };
  }

  arr.push(now);
  buckets.set(bucketKey, arr);

  return {
    limited: false,
    retryAfter: 0,
    remaining: max - arr.length,
    resetAt: now + windowMs,
  };
}

/**
 * response แบบมาตรฐานเมื่อเกิน rate limit
 */
export function tooManyRequests(rlResult) {
  return NextResponse.json(
    {
      success: false,
      error: 'Too Many Requests',
      retryAfter: rlResult.retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(rlResult.retryAfter),
        'X-RateLimit-Limit': '0',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(rlResult.resetAt / 1000)),
      },
    }
  );
}

/**
 * Preset สำหรับ endpoint ประเภทต่างๆ
 */
export const RATE_LIMITS = {
  // Public endpoints — โดนโดยไม่ต้อง login
  PUBLIC: { max: 60, windowMs: 60_000 },       // 60/นาที
  // Authenticated endpoints — user ปกติ
  AUTHENTICATED: { max: 120, windowMs: 60_000 }, // 120/นาที
  // Expensive endpoints (Gemini/scraping)
  EXPENSIVE: { max: 10, windowMs: 60_000 },    // 10/นาที
  // Admin utilities
  ADMIN: { max: 30, windowMs: 60_000 },        // 30/นาที
};

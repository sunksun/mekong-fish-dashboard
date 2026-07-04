import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.AUTHENTICATED, key: 'whoami' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ success: true, ...auth });
}

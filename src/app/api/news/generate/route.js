import { NextResponse } from 'next/server';
import { adminDb, admin } from '@/lib/firebase-admin';
import { requireAdminOrResearcher } from '@/lib/api-auth';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { generateAllNews } from '@/lib/news-generators';

// Main POST handler (admin/researcher only) — สร้างและบันทึกข่าว
export async function POST(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.EXPENSIVE, key: 'news-generate' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;
  if (!adminDb) {
    return NextResponse.json(
      { success: false, message: 'Server not configured for database access' },
      { status: 500 }
    );
  }

  try {
    const validNews = await generateAllNews();

    if (validNews.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'ไม่มีข้อมูลเพียงพอในการสร้างข่าว',
        generated: 0,
      });
    }

    const newsArticlesRef = adminDb.collection('newsArticles');
    await Promise.all(validNews.map(news =>
      newsArticlesRef.add({
        ...news,
        createdAt: admin.firestore.Timestamp.now(),
        publishedAt: admin.firestore.Timestamp.now(),
      })
    ));

    return NextResponse.json({
      success: true,
      message: `สร้างข่าวสำเร็จ ${validNews.length} ข่าว`,
      generated: validNews.length,
      news: validNews,
    });
  } catch (error) {
    console.error('Error in news generation:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการสร้างข่าว', error: error.message },
      { status: 500 }
    );
  }
}

// GET handler — preview news without saving (admin/researcher only)
export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.EXPENSIVE, key: 'news-generate-preview' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const validNews = await generateAllNews();
    return NextResponse.json({
      success: true,
      preview: true,
      generated: validNews.length,
      news: validNews,
    });
  } catch (error) {
    console.error('Error previewing news:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาด', error: error.message },
      { status: 500 }
    );
  }
}

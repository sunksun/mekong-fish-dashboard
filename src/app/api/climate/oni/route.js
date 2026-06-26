import { NextResponse } from 'next/server';

const NOAA_ONI_URL = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';

const SEASON_TO_MONTH = {
  DJF: 1, JFM: 2, FMA: 3, MAM: 4, AMJ: 5, MJJ: 6,
  JJA: 7, JAS: 8, ASO: 9, SON: 10, OND: 11, NDJ: 12,
};

function parseONI(text) {
  const lines = text.trim().split('\n');
  const out = [];
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [season, yrStr, , anomStr] = parts;
    if (!(season in SEASON_TO_MONTH)) continue;
    const year = parseInt(yrStr, 10);
    const oni = parseFloat(anomStr);
    if (!Number.isFinite(year) || !Number.isFinite(oni)) continue;
    const month = SEASON_TO_MONTH[season];
    const yearAdj = season === 'NDJ' ? year + 1 : season === 'DJF' ? year : year;
    const ym = `${yearAdj}-${String(month).padStart(2, '0')}`;
    out.push({ ym, oni });
  }
  return out;
}

export async function GET() {
  try {
    const res = await fetch(NOAA_ONI_URL, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`NOAA HTTP ${res.status}`);
    const text = await res.text();
    const data = parseONI(text);
    if (data.length === 0) throw new Error('Parse returned 0 rows');

    const latest = data[data.length - 1];
    return NextResponse.json({
      success: true,
      data,
      latest,
      source: 'NOAA CPC ONI',
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('ONI fetch error:', err);
    return NextResponse.json(
      { success: false, error: err.message, stale: true },
      { status: 503 }
    );
  }
}

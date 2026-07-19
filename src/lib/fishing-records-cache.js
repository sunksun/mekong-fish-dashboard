import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

// Shared in-memory cache for the full `fishingRecords` collection scan.
// Both /api/landing-data and /api/fish-prices need every doc (no query-side
// filter can serve either — landing-data needs whole-dataset stats/threatened-
// species photos, fish-prices needs to filter by arbitrary date/month per
// request) — so instead of each route running its own getDocs(), they both
// pull from this one cache to avoid scanning the collection twice per window.
const CACHE_TTL_MS = 900 * 1000; // matches landing-data's revalidate = 900
let cache = null;
let cacheTime = 0;

export async function getCachedFishingRecordsDocs() {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }
  const snap = await getDocs(collection(db, 'fishingRecords'));
  cache = snap.docs;
  cacheTime = now;
  return cache;
}

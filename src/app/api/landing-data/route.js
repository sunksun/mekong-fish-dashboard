/**
 * Landing page — aggregated data endpoint
 *
 * รวม 6 Firestore queries ที่หน้า landing เดิมเรียก client-side มาไว้ server-side
 * + cache ที่ Next.js layer 5 นาที
 *
 * ผลลัพธ์: ลด Firestore reads จาก ~1,400 reads/visitor เหลือ ~1 read/5min
 * (server ยิง Firestore แค่ครั้งเดียวต่อ cache window)
 *
 * GET /api/landing-data
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, orderBy, limit as fbLimit, getCountFromServer,
} from 'firebase/firestore';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { withCors, corsPreflightResponse } from '@/lib/cors';

// Cache 5 นาที
export const revalidate = 300;

export async function OPTIONS() {
  return corsPreflightResponse();
}

// จำนวน fishingRecords สูงสุดที่จะดึงมาประมวลผลใน gallery
// (ก่อนเปลี่ยน: ดึงทั้งหมด 1,150+ docs)
const RECORDS_LIMIT = 300;

export async function GET(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.PUBLIC, key: 'landing-data' });
  if (rl.limited) return tooManyRequests(rl);

  try {
    const [
      featuredSnap,
      speciesSnap,
      recordsSnap,
      waterSnap,
      newsSnap,
      wisdomSnap,
      usersCountSnap,
    ] = await Promise.all([
      getDocs(collection(db, 'featuredFishPhotos')),
      getDocs(collection(db, 'fish_species')),
      // limit fishingRecords + เรียงตามวันที่ใหม่ก่อน
      getDocs(query(collection(db, 'fishingRecords'), orderBy('catchDate', 'desc'), fbLimit(RECORDS_LIMIT))),
      getDocs(query(collection(db, 'waterLevels'), orderBy('date', 'desc'), orderBy('time', 'desc'), fbLimit(30))),
      getDocs(query(collection(db, 'newsArticles'), orderBy('publishedAt', 'desc'), fbLimit(10))),
      getDocs(query(collection(db, 'fishingWisdom'), orderBy('createdAt', 'desc'), fbLimit(3))),
      getCountFromServer(collection(db, 'users')),
    ]);

    // ── Featured fish photos ─────────────────────────────────
    const featuredPhotos = {};
    featuredSnap.forEach(doc => {
      const d = doc.data();
      if (d.species && d.photoUrl) featuredPhotos[d.species] = d.photoUrl;
    });

    // ── Fish species lookup ─────────────────────────────────
    const speciesLookup = {};
    const iucnCount = { CR: 0, EN: 0, VU: 0 };
    const iucnAllSpecies = { CR: [], EN: [], VU: [] };
    const familyMap = {}; // family -> Set<species>

    speciesSnap.forEach(doc => {
      const data = doc.data();
      const name = (data.thai_name || data.common_name_thai || '').trim();
      const status = data.iucn_status || data.conservation_status || 'DD';
      const family = data.group || data.family_thai || 'วงศ์อื่นๆ';

      if (name) {
        speciesLookup[name] = {
          group: family,
          iucn_status: status,
          local_name: data.local_name || null,
          scientific_name: data.scientific_name || null,
        };
        if (!familyMap[family]) familyMap[family] = new Set();
        familyMap[family].add(name);
      }

      if (['CR', 'EN', 'VU'].includes(status)) {
        iucnCount[status]++;
        // Catalog photo (image_url or first of photos[]) — used as fallback only.
        // The primary photo comes from the latest fishingRecords entry (enriched below).
        const catalogPhoto = data.image_url
          || (Array.isArray(data.photos) && data.photos.length > 0 ? data.photos[0] : null)
          || null;
        iucnAllSpecies[status].push({
          thai_name: name,
          scientific_name: data.scientific_name || null,
          local_name: data.local_name || null,
          catalog_image_url: catalogPhoto,
          image_url: null, // filled after fishDataMap is built (latest catch photo)
        });
      }
    });

    // Fish families for chart
    const familyColors = ['#1976d2', '#f57c00', '#388e3c', '#d32f2f', '#9c27b0', '#00acc1', '#fbc02d', '#e91e63', '#757575'];
    const totalSpeciesCount = Object.values(familyMap).reduce((s, set) => s + set.size, 0);
    const fishFamilies = Object.entries(familyMap)
      .map(([name, set]) => ({ name, count: set.size }))
      .sort((a, b) => {
        if (a.name === 'วงศ์อื่นๆ') return 1;
        if (b.name === 'วงศ์อื่นๆ') return -1;
        return b.count - a.count;
      })
      .slice(0, 9)
      .map((f, i) => ({
        name: f.name,
        count: f.count,
        percentage: totalSpeciesCount > 0 ? parseFloat(((f.count / totalSpeciesCount) * 100).toFixed(1)) : 0,
        color: familyColors[i % familyColors.length],
      }));

    // ── Fishing records → gallery + stats ────────────────────
    const allRecords = [];
    recordsSnap.forEach(doc => allRecords.push({ id: doc.id, ...doc.data() }));

    const verifiedRecords = allRecords.filter(r => r.verified === true);
    const fishDataMap = new Map();
    let totalWeight = 0;
    let totalValue = 0;
    let earliestDate = null;
    let latestDate = null;

    verifiedRecords.forEach(record => {
      const rawDate = record.catchDate || record.date;
      let date = null;
      if (rawDate) {
        date = rawDate.toDate ? rawDate.toDate() : new Date(rawDate);
        if (!earliestDate || date < earliestDate) earliestDate = date;
        if (!latestDate || date > latestDate) latestDate = date;
      }
      totalWeight += Number(record.totalWeight) || 0;
      totalValue += Number(record.totalValue) || 0;

      const fishList = record.fishData || record.fishList || [];
      if (!Array.isArray(fishList)) return;

      fishList.forEach(fish => {
        const speciesName = (fish.species || fish.name || 'Unknown').trim();
        const photo = fish.photo || null;
        if (!photo || speciesName === 'Unknown') return;

        const speciesInfo = speciesLookup[speciesName] || {};
        const family = speciesInfo.group || 'วงศ์อื่นๆ';
        const recordCatchDate = date ? date.toISOString() : null;

        if (!fishDataMap.has(speciesName)) {
          fishDataMap.set(speciesName, {
            species: speciesName,
            local_name: speciesInfo.local_name || null,
            scientific_name: speciesInfo.scientific_name || null,
            photosWithDates: [{ url: photo, date: recordCatchDate }],
            quantity: Number(fish.quantity || fish.count) || 0,
            weight: Number(fish.weight) || 0,
            estimatedValue: Number(fish.estimatedValue || fish.price) || 0,
            family,
            iucn_status: speciesInfo.iucn_status || 'DD',
            latestCatchDate: recordCatchDate,
          });
        } else {
          const existing = fishDataMap.get(speciesName);
          if (!existing.photosWithDates.some(p => p.url === photo)) {
            existing.photosWithDates.push({ url: photo, date: recordCatchDate });
          }
          existing.quantity += Number(fish.quantity || fish.count) || 0;
          existing.weight += Number(fish.weight) || 0;
          existing.estimatedValue += Number(fish.estimatedValue || fish.price) || 0;
          if (recordCatchDate && (!existing.latestCatchDate || new Date(recordCatchDate) > new Date(existing.latestCatchDate))) {
            existing.latestCatchDate = recordCatchDate;
          }
        }
      });
    });

    // ── Enrich threatened species with their LATEST photo from fishingRecords ──
    // Priority for the IUCN photo strips: newest catch photo → catalog photo → icon (null).
    //
    // Note: the main `recordsSnap` above is capped at RECORDS_LIMIT (300 most-recent
    // by catchDate) for gallery performance. Threatened species are rare and are often
    // caught in older records that fall outside that window, so we do a dedicated
    // FULL-collection scan here that extracts only threatened-species photos. This
    // keeps every CR/EN/VU photo discoverable regardless of when it was recorded.
    const threatenedNames = new Set(
      [...iucnAllSpecies.CR, ...iucnAllSpecies.EN, ...iucnAllSpecies.VU].map(s => s.thai_name)
    );
    const threatenedPhotoMap = new Map(); // name -> { url, dateMs }
    if (threatenedNames.size > 0) {
      const allRecordsSnap = await getDocs(collection(db, 'fishingRecords'));
      allRecordsSnap.forEach(doc => {
        const record = doc.data();
        if (record.verified !== true) return;
        const fishList = record.fishData || record.fishList || [];
        if (!Array.isArray(fishList)) return;
        const rawDate = record.catchDate || record.date;
        const dateMs = rawDate
          ? (rawDate.toDate ? rawDate.toDate().getTime() : new Date(rawDate).getTime())
          : 0;
        fishList.forEach(fish => {
          const name = (fish.species || fish.name || '').trim();
          if (!threatenedNames.has(name)) return;
          const photo = fish.photo || null;
          if (!photo) return;
          const existing = threatenedPhotoMap.get(name);
          // Keep the photo from the most recent catch date
          if (!existing || dateMs > existing.dateMs) {
            threatenedPhotoMap.set(name, { url: photo, dateMs: Number.isFinite(dateMs) ? dateMs : 0 });
          }
        });
      });
    }

    for (const status of ['CR', 'EN', 'VU']) {
      for (const sp of iucnAllSpecies[status]) {
        const latestRecordPhoto = threatenedPhotoMap.get(sp.thai_name)?.url || null;
        sp.image_url = latestRecordPhoto || sp.catalog_image_url || null;
      }
    }

    const fishGallery = Array.from(fishDataMap.values())
      .filter(f => f.photosWithDates.length > 0)
      .sort((a, b) => {
        const dA = a.latestCatchDate ? new Date(a.latestCatchDate) : new Date(0);
        const dB = b.latestCatchDate ? new Date(b.latestCatchDate) : new Date(0);
        return dB - dA;
      })
      .map((fish, index) => {
        const featuredPhoto = featuredPhotos[fish.species];
        const displayPhoto = featuredPhoto || fish.photosWithDates[0]?.url;
        const displayPhotoEntry = featuredPhoto
          ? fish.photosWithDates[0]
          : fish.photosWithDates.find(p => p.url === displayPhoto);
        return {
          id: index + 1,
          imageUrl: displayPhoto,
          thai_name: fish.species,
          local_name: fish.local_name,
          scientific_name: fish.scientific_name || '-',
          family_thai: fish.family || '-',
          iucn_status: fish.iucn_status,
          totalQuantity: fish.quantity,
          totalWeight: fish.weight.toFixed(1),
          totalValue: fish.estimatedValue,
          photoCount: fish.photosWithDates.length,
          photos: fish.photosWithDates.map(p => p.url),
          photosWithDates: fish.photosWithDates,
          latestCatchDate: fish.latestCatchDate,
          displayCatchDate: displayPhotoEntry?.date || null,
        };
      });

    // ── Water levels ─────────────────────────────────────────
    const waterRecords = [];
    waterSnap.forEach(doc => {
      const d = doc.data();
      waterRecords.push({
        id: doc.id,
        date: d.date,
        time: d.time,
        currentLevel: d.currentLevel || 0,
        rainfall: parseFloat(d.rainfall) || 0,
      });
    });
    waterRecords.reverse(); // เก่า -> ใหม่

    let waterLevel = null;
    if (waterRecords.length >= 2) {
      const latest = waterRecords[waterRecords.length - 1];
      const previous = waterRecords[waterRecords.length - 2];
      const change = latest.currentLevel - previous.currentLevel;
      let trend = 'stable';
      if (change > 0.05) trend = 'rising';
      else if (change < -0.05) trend = 'falling';
      waterLevel = {
        current: latest.currentLevel,
        previous: previous.currentLevel,
        change,
        trend,
        date: latest.date,
      };
    } else if (waterRecords.length === 1) {
      waterLevel = {
        current: waterRecords[0].currentLevel,
        previous: 0,
        change: 0,
        trend: 'stable',
        date: waterRecords[0].date,
      };
    }

    const waterChart = waterRecords.map(r => {
      const dateObj = new Date(r.date);
      return {
        date: r.date,
        displayDate: `${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
        level: r.currentLevel,
        rainfall: r.rainfall,
      };
    });

    // ── News ────────────────────────────────────────────────
    const newsArticles = [];
    newsSnap.forEach(doc => {
      const d = doc.data();
      newsArticles.push({
        id: doc.id,
        title: d.title || '',
        summary: d.summary || '',
        category: d.category || 'ทั่วไป',
        image: d.image || null,
        date: d.date || '',
        autoGenerated: d.autoGenerated || false,
        isPinned: d.isPinned || false,
      });
    });
    newsArticles.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
      return 0;
    });

    // ── Wisdom ──────────────────────────────────────────────
    const wisdomItems = [];
    wisdomSnap.forEach(doc => {
      const d = doc.data();
      if (d.status === 'active' || !d.status) {
        wisdomItems.push({ id: doc.id, ...d });
      }
    });

    return withCors(NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      stats: {
        totalRecords: allRecords.length,
        totalWeight: parseFloat(totalWeight.toFixed(1)),
        totalValue: parseFloat(totalValue.toFixed(1)),
        verifiedCount: verifiedRecords.length,
        totalUsers: usersCountSnap.data().count,
      },
      dateRange: {
        earliest: earliestDate?.toISOString() || null,
        latest: latestDate?.toISOString() || null,
      },
      iucn: { count: iucnCount, species: iucnAllSpecies },
      fishFamilies,
      fishGallery,
      waterLevel,
      waterChart,
      newsArticles: newsArticles.slice(0, 3),
      wisdomItems: wisdomItems.slice(0, 3),
    }));
  } catch (error) {
    console.error('landing-data error:', error);
    return withCors(NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    ));
  }
}

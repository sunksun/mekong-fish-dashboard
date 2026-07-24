/**
 * Utility API — admin/researcher only
 * แก้ชื่อปลาที่สะกดผิดใน Firestore แบบครั้งเดียว
 *
 * POST /api/admin/fix-species-name
 * Body: { from, to, fromLocal, toLocal, dryRun }
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdminOrResearcher } from '@/lib/api-auth';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';
import { deriveFishData } from '@/lib/fish-data-derive';

export async function POST(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.ADMIN, key: 'admin-fix-species-name' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;
  if (!adminDb) {
    return NextResponse.json(
      { success: false, error: 'Server not configured for database access' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const from = (body.from || '').trim();
    const to = (body.to || '').trim();
    const fromLocal = (body.fromLocal || '').trim();
    const toLocal = (body.toLocal || '').trim();
    const dryRun = body.dryRun !== false;

    if (!from || !to) {
      return NextResponse.json({ success: false, error: 'Required: from, to' }, { status: 400 });
    }

    const report = {
      dryRun, from, to, fromLocal, toLocal,
      fish_species: { matched: 0, updated: [] },
      fishingRecords: { scannedDocs: 0, matchedDocs: 0, replacedFields: 0, fishDataRegenerated: 0 },
    };

    // 1) fish_species (Admin SDK — rules รัด create/update ให้ isAdminOrResearcher() แล้ว)
    const speciesSnap = await adminDb.collection('fish_species').get();
    for (const docSnap of speciesSnap.docs) {
      const d = docSnap.data();
      const updates = {};
      if (d.common_name_thai === from) updates.common_name_thai = to;
      if (d.thai_name === from) updates.thai_name = to;
      if (fromLocal && d.local_name === fromLocal) updates.local_name = toLocal;

      if (Object.keys(updates).length > 0) {
        report.fish_species.matched += 1;
        report.fish_species.updated.push({ id: docSnap.id, updates });
        if (!dryRun) await adminDb.collection('fish_species').doc(docSnap.id).update(updates);
      }
    }

    // fish_species lookup map for deriveFishData — same construction as
    // fishing-records/route.js:139-151 / sync-fish-data/route.js:92-102
    const fishSpeciesMap = new Map();
    speciesSnap.forEach(speciesDoc => {
      const speciesData = speciesDoc.data();
      if (speciesData.common_name_thai) {
        fishSpeciesMap.set(speciesData.common_name_thai, speciesData);
      }
      if (speciesData.thai_name && !fishSpeciesMap.has(speciesData.thai_name)) {
        fishSpeciesMap.set(speciesData.thai_name, speciesData);
      }
    });
    // Reflect the rename itself so a freshly-renamed species still resolves
    // (fishSpeciesMap was built from pre-rename docs read above).
    if (fromLocal && toLocal) {
      const toEntry = fishSpeciesMap.get(to) || {};
      fishSpeciesMap.set(to, { ...toEntry, local_name: toLocal });
    }

    // 2) fishingRecords.fishList[] + fishData[] (regenerated to stay in sync)
    const recSnap = await getDocs(collection(db, 'fishingRecords'));
    for (const docSnap of recSnap.docs) {
      report.fishingRecords.scannedDocs += 1;
      const d = docSnap.data();
      if (!Array.isArray(d.fishList)) continue;

      let changed = false;
      const newList = d.fishList.map(fish => {
        const copy = { ...fish };
        let touched = false;
        if (copy.name === from) { copy.name = to; touched = true; }
        if (copy.commonName === from) { copy.commonName = to; touched = true; }
        if (fromLocal && copy.localName === fromLocal) { copy.localName = toLocal; touched = true; }
        if (touched) {
          changed = true;
          report.fishingRecords.replacedFields += 1;
        }
        return copy;
      });

      if (changed) {
        report.fishingRecords.matchedDocs += 1;
        const updates = { fishList: newList };
        if (Array.isArray(d.fishData) && d.fishData.length > 0) {
          updates.fishData = deriveFishData(newList, d.fishData, fishSpeciesMap);
          report.fishingRecords.fishDataRegenerated += 1;
        }
        if (!dryRun) await updateDoc(doc(db, 'fishingRecords', docSnap.id), updates);
      }
    }

    return NextResponse.json({ success: true, ...report });
  } catch (err) {
    console.error('fix-species-name error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

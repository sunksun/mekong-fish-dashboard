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
import { requireAdminOrResearcher } from '@/lib/api-auth';

export async function POST(request) {
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;

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
      fishingRecords: { scannedDocs: 0, matchedDocs: 0, replacedFields: 0 },
    };

    // 1) fish_species
    const speciesSnap = await getDocs(collection(db, 'fish_species'));
    for (const docSnap of speciesSnap.docs) {
      const d = docSnap.data();
      const updates = {};
      if (d.common_name_thai === from) updates.common_name_thai = to;
      if (d.thai_name === from) updates.thai_name = to;
      if (fromLocal && d.local_name === fromLocal) updates.local_name = toLocal;

      if (Object.keys(updates).length > 0) {
        report.fish_species.matched += 1;
        report.fish_species.updated.push({ id: docSnap.id, updates });
        if (!dryRun) await updateDoc(doc(db, 'fish_species', docSnap.id), updates);
      }
    }

    // 2) fishingRecords.fishList[]
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
        if (!dryRun) await updateDoc(doc(db, 'fishingRecords', docSnap.id), { fishList: newList });
      }
    }

    return NextResponse.json({ success: true, ...report });
  } catch (err) {
    console.error('fix-species-name error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

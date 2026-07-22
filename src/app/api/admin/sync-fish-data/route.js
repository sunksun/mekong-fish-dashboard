/**
 * Utility API — admin/researcher only
 * Sync fishData[] on fishingRecords by regenerating it from the current fishList[],
 * using the same derivation logic as the GET compute-on-read path
 * (src/app/api/fishing-records/route.js:203-219). This is meant for records whose
 * stored fishData drifted out of sync with fishList (e.g. after a fish-name
 * correction via PATCH before fishData was writable there).
 *
 * POST /api/admin/sync-fish-data
 * Body: { dryRun, docIds }
 *   - dryRun: defaults to true — set explicitly to false to write
 *   - docIds: optional array of specific fishingRecords doc IDs to scope to;
 *             omit to scan the whole collection
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, query, where, documentId } from 'firebase/firestore';
import { requireAdminOrResearcher } from '@/lib/api-auth';
import { rateLimit, tooManyRequests, RATE_LIMITS } from '@/lib/rate-limit';

// Derivation based on fishing-records/route.js:205-219, but hardened against
// data-loss. Two fields use coalesce instead of a straight overwrite:
//   - localName: fishList[].localName is dropped whenever a record is edited via
//     the records dashboard (records/page.js:672-680 omits the key), while
//     fishData[].localName survives. So prefer fishList's value only when present,
//     otherwise KEEP the existing fishData value, and never clobber with ''/undefined.
//   - species/name: fishList[].name is always authoritative — it's the field
//     fish-verification actually edits, and it never goes missing on that path.
function deriveFishData(fishList, oldFishData, fishSpeciesMap) {
  return (fishList || []).map((fish, i) => {
    const speciesName = fish.name || '';
    const speciesInfo = fishSpeciesMap.get(speciesName);
    const prev = (oldFishData || [])[i] || {};
    // localName priority: fishList (edited source) → existing fishData → species lookup → ''
    // Only non-empty values count, so a missing key never overwrites a real value.
    const localName =
      (fish.localName && String(fish.localName).trim())
      || (prev.localName && String(prev.localName).trim())
      || (speciesInfo?.local_name && String(speciesInfo.local_name).trim())
      || '';
    return {
      species: speciesName,
      localName,
      category: 'MEDIUM',
      quantity: parseInt(fish.count) || 0,
      weight: parseFloat(fish.weight) || 0,
      estimatedValue: parseFloat(fish.price) * parseInt(fish.count) || 0,
      minLength: fish.minLength,
      maxLength: fish.maxLength,
      photo: fish.photo
    };
  });
}

function diffFishData(oldData, newData) {
  const oldStr = JSON.stringify(oldData || []);
  const newStr = JSON.stringify(newData || []);
  if (oldStr === newStr) return null;

  const maxLen = Math.max((oldData || []).length, (newData || []).length);
  const fieldDiffs = [];
  for (let i = 0; i < maxLen; i++) {
    const o = (oldData || [])[i];
    const n = (newData || [])[i];
    if (JSON.stringify(o) === JSON.stringify(n)) continue;
    const changedFields = {};
    const keys = new Set([...Object.keys(o || {}), ...Object.keys(n || {})]);
    for (const key of keys) {
      const ov = o ? o[key] : undefined;
      const nv = n ? n[key] : undefined;
      if (JSON.stringify(ov) !== JSON.stringify(nv)) {
        changedFields[key] = { from: ov, to: nv };
      }
    }
    fieldDiffs.push({ index: i, changedFields });
  }
  return fieldDiffs;
}

export async function POST(request) {
  const rl = rateLimit(request, { ...RATE_LIMITS.ADMIN, key: 'admin-sync-fish-data' });
  if (rl.limited) return tooManyRequests(rl);
  const auth = await requireAdminOrResearcher(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;
    const docIds = Array.isArray(body.docIds) && body.docIds.length > 0 ? body.docIds : null;

    // fish_species lookup map — same construction as fishing-records/route.js:139-151
    const fishSpeciesSnapshot = await getDocs(collection(db, 'fish_species'));
    const fishSpeciesMap = new Map();
    fishSpeciesSnapshot.forEach(speciesDoc => {
      const speciesData = speciesDoc.data();
      if (speciesData.common_name_thai) {
        fishSpeciesMap.set(speciesData.common_name_thai, speciesData);
      }
      if (speciesData.thai_name && !fishSpeciesMap.has(speciesData.thai_name)) {
        fishSpeciesMap.set(speciesData.thai_name, speciesData);
      }
    });

    // Fetch target docs — scoped by docIds if provided (Firestore 'in' caps at 30 per query)
    let targetDocs = [];
    if (docIds) {
      const chunks = [];
      for (let i = 0; i < docIds.length; i += 30) chunks.push(docIds.slice(i, i + 30));
      for (const chunk of chunks) {
        const q = query(collection(db, 'fishingRecords'), where(documentId(), 'in', chunk));
        const snap = await getDocs(q);
        targetDocs.push(...snap.docs);
      }
    } else {
      const snap = await getDocs(collection(db, 'fishingRecords'));
      targetDocs = snap.docs.filter(d => {
        const data = d.data();
        return Array.isArray(data.fishData) && data.fishData.length > 0;
      });
    }

    const report = {
      dryRun,
      scannedDocs: targetDocs.length,
      changedDocs: 0,
      unchangedDocs: 0,
      changes: [], // { docId, diff }
    };

    for (const docSnap of targetDocs) {
      const data = docSnap.data();
      const oldFishData = data.fishData || [];
      const newFishData = deriveFishData(data.fishList, oldFishData, fishSpeciesMap);
      const diff = diffFishData(oldFishData, newFishData);

      if (diff) {
        report.changedDocs += 1;
        report.changes.push({
          docId: docSnap.id,
          fishDataBefore: oldFishData,
          fishDataAfter: newFishData,
          fieldDiff: diff,
        });
        if (!dryRun) {
          await updateDoc(doc(db, 'fishingRecords', docSnap.id), { fishData: newFishData });
        }
      } else {
        report.unchangedDocs += 1;
      }
    }

    return NextResponse.json({ success: true, ...report });
  } catch (err) {
    console.error('sync-fish-data error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

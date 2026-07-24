/**
 * Shared derivation logic for regenerating fishingRecords.fishData[] from
 * fishList[], used by both admin/sync-fish-data and admin/fix-species-name.
 *
 * Based on the compute-on-read path in fishing-records/route.js:205-219, but
 * hardened against data-loss. Two fields use coalesce instead of a straight
 * overwrite:
 *   - localName: fishList[].localName is dropped whenever a record is edited via
 *     the records dashboard (records/page.js:672-680 omits the key), while
 *     fishData[].localName survives. So prefer fishList's value only when present,
 *     otherwise KEEP the existing fishData value, and never clobber with ''/undefined.
 *   - species/name: fishList[].name is always authoritative — it's the field
 *     fish-verification actually edits, and it never goes missing on that path.
 */
export function deriveFishData(fishList, oldFishData, fishSpeciesMap) {
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

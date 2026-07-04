/**
 * Document chunking for RAG.
 *
 * Fish species records are small and self-contained — one chunk per species.
 * Wisdom entries and news articles are longer — chunked by paragraph with overlap.
 *
 * All chunks include human-readable header so the LLM can cite them properly.
 */

const DEFAULT_CHUNK_CHARS = 800;
const DEFAULT_OVERLAP_CHARS = 100;

/**
 * Split long text into overlapping chunks by sentence boundary.
 * Thai text lacks spaces between words, so we split on \n, . and Thai clause markers.
 */
export function splitText(text, chunkChars = DEFAULT_CHUNK_CHARS, overlapChars = DEFAULT_OVERLAP_CHARS) {
  if (!text || text.length <= chunkChars) return [text].filter(Boolean);

  const sentences = text.split(/(?<=[.!?\n])\s+|(?<=[ๆฯ])/g).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const s of sentences) {
    if ((current + s).length > chunkChars && current.length > 0) {
      chunks.push(current.trim());
      const tail = current.slice(Math.max(0, current.length - overlapChars));
      current = tail + s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Fish species → one chunk each, formatted so retrieval matches semantically.
 */
export function chunkFishSpecies(doc) {
  const d = doc.data ? doc.data() : doc;
  const thaiName = d.thai_name || d.common_name_thai || '';
  const localName = d.local_name || '';
  const scientificName = d.scientific_name || '';
  const family = d.family || '';
  const iucn = d.iucn_status || '';
  const habitat = d.habitat || '';
  const description = d.description || '';
  const body = d.body || d.details || '';

  const parts = [
    `ปลา ${thaiName}${localName ? ` (ชื่อท้องถิ่น: ${localName})` : ''}`,
    scientificName ? `ชื่อวิทยาศาสตร์: ${scientificName}` : '',
    family ? `วงศ์: ${family}` : '',
    iucn ? `สถานะ IUCN: ${iucn}` : '',
    habitat ? `ถิ่นอาศัย: ${habitat}` : '',
    description ? `รายละเอียด: ${description}` : '',
    body ? body : '',
  ].filter(Boolean);
  const text = parts.join('\n');

  return [{
    text,
    metadata: {
      thai_name: thaiName,
      local_name: localName,
      scientific_name: scientificName,
      iucn_status: iucn,
      family,
    },
  }];
}

export function chunkWisdom(doc) {
  const d = doc.data ? doc.data() : doc;
  const header = `ภูมิปัญญาท้องถิ่น: ${d.title || ''}
หมวดหมู่: ${d.category || 'ทั่วไป'}
ปลาที่เกี่ยวข้อง: ${d.fishType || '-'}
ฤดูกาล: ${d.season || '-'}
สถานที่: ${d.location || '-'}`;
  const bodyText = [d.description, d.technique].filter(Boolean).join('\n\n');
  const bodyChunks = splitText(bodyText);
  return bodyChunks.map((chunk, i) => ({
    text: `${header}\n\n${chunk}`,
    metadata: {
      title: d.title || '',
      category: d.category || '',
      fishType: d.fishType || '',
      contributor: d.contributorName || '',
      chunk_of: bodyChunks.length,
      chunk_index: i,
    },
  }));
}

export function chunkNews(doc) {
  const d = doc.data ? doc.data() : doc;
  const header = `ข่าว: ${d.title || ''}
วันที่: ${d.publishDate || d.date || '-'}`;
  const bodyText = [d.summary, d.content, d.body].filter(Boolean).join('\n\n');
  const bodyChunks = splitText(bodyText);
  return bodyChunks.map((chunk, i) => ({
    text: `${header}\n\n${chunk}`,
    metadata: {
      title: d.title || '',
      publishDate: d.publishDate || d.date || '',
      chunk_of: bodyChunks.length,
      chunk_index: i,
    },
  }));
}

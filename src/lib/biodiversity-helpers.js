/**
 * ตัวคำนวณดัชนีความหลากหลายทางชีวภาพ
 * ใช้ร่วมระหว่าง /api/reports/biodiversity และ /api/reports/enso-forecast
 */

export function shannonWiener(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return -counts.reduce((sum, n) => {
    if (n === 0) return sum;
    const p = n / total;
    return sum + p * Math.log(p);
  }, 0);
}

export function simpsonD(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 1) return 0;
  const sumNiNi = counts.reduce((sum, n) => sum + n * (n - 1), 0);
  return 1 - sumNiNi / (total * (total - 1));
}

export function speciesRichness(speciesMap) {
  return Object.keys(speciesMap).length;
}

/**
 * Statistical tests for RAG vs baseline comparison.
 *
 * We keep implementations minimal and dependency-free so results are auditable.
 * For paper reporting, always cross-check with SciPy / R.
 */

export function mean(xs) {
  if (xs.length === 0) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

export function variance(xs, ddof = 1) {
  const n = xs.length;
  if (n <= ddof) return 0;
  const m = mean(xs);
  const ss = xs.reduce((s, v) => s + (v - m) * (v - m), 0);
  return ss / (n - ddof);
}

export function stddev(xs, ddof = 1) {
  return Math.sqrt(variance(xs, ddof));
}

/**
 * Two-tailed paired t-test.
 * Returns { t, df, p, meanDiff, sdDiff, n }.
 *
 * Use case: same 60 questions answered by both conditions — differences are paired.
 * If p < 0.05, reject H0 (no difference in mean scores).
 */
export function pairedTTest(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    throw new Error('pairedTTest: arrays must be non-empty and equal length');
  }
  const diffs = a.map((v, i) => v - b[i]);
  const n = diffs.length;
  if (n < 2) return { t: 0, df: 0, p: 1, meanDiff: 0, sdDiff: 0, n };
  const m = mean(diffs);
  const s = stddev(diffs);
  if (s === 0) return { t: 0, df: n - 1, p: 1, meanDiff: m, sdDiff: 0, n };
  const t = m / (s / Math.sqrt(n));
  const df = n - 1;
  const p = studentTTwoTailedP(Math.abs(t), df);
  return { t, df, p, meanDiff: m, sdDiff: s, n };
}

/**
 * Two-tailed p-value for Student's t via incomplete beta.
 * Accurate to ~6 decimals for df ≥ 2.
 */
export function studentTTwoTailedP(tAbs, df) {
  const x = df / (df + tAbs * tAbs);
  const p = incompleteBeta(x, df / 2, 0.5);
  return Math.min(1, Math.max(0, p));
}

// Regularized incomplete beta function I_x(a, b) via continued fraction (Numerical Recipes)
function incompleteBeta(x, a, b) {
  if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return bt * betacf(x, a, b) / a;
  }
  return 1 - bt * betacf(1 - x, b, a) / b;
}

function betacf(x, a, b) {
  const MAX_ITER = 200;
  const EPS = 3e-7;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) return h;
  }
  return h;
}

// Log gamma (Lanczos approximation)
function lgamma(z) {
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Cohen's kappa for two raters on the same items, categorical labels.
 * Returns κ ∈ [-1, 1]. > 0.6 = substantial agreement (Landis & Koch, 1977).
 */
export function cohensKappa(raterA, raterB) {
  if (raterA.length !== raterB.length || raterA.length === 0) return 0;
  const n = raterA.length;
  const labels = Array.from(new Set([...raterA, ...raterB]));
  const idx = Object.fromEntries(labels.map((l, i) => [l, i]));
  const k = labels.length;
  const mat = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++) mat[idx[raterA[i]]][idx[raterB[i]]]++;

  const po = labels.reduce((acc, _, i) => acc + mat[i][i], 0) / n;
  const rowSums = mat.map(row => row.reduce((s, v) => s + v, 0));
  const colSums = labels.map((_, j) => mat.reduce((s, row) => s + row[j], 0));
  const pe = labels.reduce((acc, _, i) => acc + (rowSums[i] * colSums[i]) / (n * n), 0);
  if (pe === 1) return 1;
  return (po - pe) / (1 - pe);
}

/**
 * Confusion matrix bins for {0,1,2} scores.
 */
export function scoreDistribution(scores) {
  const bins = { 0: 0, 1: 0, 2: 0 };
  for (const s of scores) if (bins[s] !== undefined) bins[s]++;
  return bins;
}

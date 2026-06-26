/**
 * Helpers สำหรับโมเดล ENSO × Biodiversity
 * - Multiple Linear Regression (normal equation)
 * - Seasonal encoding (Fourier)
 * - ENSO scenario presets
 */

// ---- Multiple Linear Regression via normal equation ----
// X: array of rows [x1, x2, ...] (โดยไม่ต้องใส่ intercept — ฟังก์ชันจะเติมให้)
// y: array of scalars
// คืน { coef: [β0, β1, ...], r2, residualSE, n, p }

export function multipleLinearRegression(X, y) {
  const n = X.length;
  if (n < 3) return null;
  const p = X[0].length + 1; // +1 for intercept
  if (n <= p) return null;

  // X augmented with intercept column
  const A = X.map(row => [1, ...row]);

  // XtX (p × p) and Xty (p)
  const XtX = Array.from({ length: p }, () => Array(p).fill(0));
  const Xty = Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += A[i][a] * y[i];
      for (let b = 0; b < p; b++) {
        XtX[a][b] += A[i][a] * A[i][b];
      }
    }
  }

  const coef = solveLinearSystem(XtX, Xty);
  if (!coef) return null;

  // R² and residual SE
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yHat = A[i].reduce((s, v, k) => s + v * coef[k], 0);
    ssTot += (y[i] - meanY) ** 2;
    ssRes += (y[i] - yHat) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const residualSE = Math.sqrt(ssRes / Math.max(n - p, 1));

  return { coef, r2, residualSE, n, p };
}

// Gauss-Jordan elimination
function solveLinearSystem(M, v) {
  const n = M.length;
  const A = M.map((row, i) => [...row, v[i]]);
  for (let i = 0; i < n; i++) {
    // Pivot
    let pivot = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[j][i]) > Math.abs(A[pivot][i])) pivot = j;
    }
    if (Math.abs(A[pivot][i]) < 1e-12) return null;
    [A[i], A[pivot]] = [A[pivot], A[i]];

    // Eliminate
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const factor = A[j][i] / A[i][i];
      for (let k = i; k <= n; k++) {
        A[j][k] -= factor * A[i][k];
      }
    }
  }
  return A.map((row, i) => row[n] / row[i]);
}

export function predictMLR(model, x) {
  if (!model) return null;
  const row = [1, ...x];
  return row.reduce((s, v, k) => s + v * model.coef[k], 0);
}

// 95% prediction CI (approximate — ignoring leverage)
export function predictCI(model, x, z = 1.96) {
  if (!model) return [null, null];
  const yHat = predictMLR(model, x);
  const margin = z * model.residualSE;
  return [yHat - margin, yHat + margin];
}

// ---- Seasonal Fourier encoding ----
// month: 1-12
export function seasonalEncode(month) {
  const rad = (2 * Math.PI * (month - 1)) / 12;
  return { sin: Math.sin(rad), cos: Math.cos(rad) };
}

// ---- ENSO classification ----
export function ensoCategory(oni) {
  if (oni >= 2.0) return { key: 'super_elnino', label: 'Super El Niño', color: '#b71c1c' };
  if (oni >= 1.5) return { key: 'strong_elnino', label: 'El Niño กำลังแรง', color: '#d84315' };
  if (oni >= 0.5) return { key: 'elnino', label: 'El Niño', color: '#ef6c00' };
  if (oni <= -1.5) return { key: 'strong_lanina', label: 'La Niña กำลังแรง', color: '#1565c0' };
  if (oni <= -0.5) return { key: 'lanina', label: 'La Niña', color: '#1976d2' };
  return { key: 'neutral', label: 'สภาวะปกติ (Neutral)', color: '#2e7d32' };
}

export const ENSO_SCENARIOS = [
  { key: 'super_elnino', label: 'Super El Niño', oni: 2.0, description: 'รุนแรงมาก เช่น 1997-98, 2015-16' },
  { key: 'elnino', label: 'El Niño (ปานกลาง)', oni: 1.0, description: 'แล้งกว่าปกติ ฝนน้อย' },
  { key: 'neutral', label: 'Neutral', oni: 0.0, description: 'สภาวะปกติ' },
  { key: 'lanina', label: 'La Niña', oni: -1.0, description: 'ฝนมากกว่าปกติ น้ำมาก' },
];

// ---- Climatology / anomaly ----
// values: { 'YYYY-MM': number }
// คืน { monthlyMean: {1..12: mean}, anomalyAt: (ym) => deviation }
export function buildClimatology(values) {
  const byMonth = {};
  for (const [ym, v] of Object.entries(values)) {
    if (v == null || isNaN(v)) continue;
    const m = Number(ym.split('-')[1]);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(v);
  }
  const monthlyMean = {};
  for (let m = 1; m <= 12; m++) {
    if (byMonth[m] && byMonth[m].length > 0) {
      monthlyMean[m] = byMonth[m].reduce((s, v) => s + v, 0) / byMonth[m].length;
    } else {
      monthlyMean[m] = 0;
    }
  }
  return {
    monthlyMean,
    anomalyAt: (ym) => {
      const m = Number(ym.split('-')[1]);
      const v = values[ym];
      if (v == null || isNaN(v)) return 0;
      return v - (monthlyMean[m] ?? 0);
    },
  };
}

// ---- Date helpers ----
export function ymAddMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

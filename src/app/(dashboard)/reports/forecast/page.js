'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Container, Typography, Card, CardContent, Grid, CircularProgress,
  Alert, Select, MenuItem, FormControl, InputLabel, Chip, Slider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Tooltip, Divider
} from '@mui/material';
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { QueryStats, InfoOutlined, WarningAmber } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getRecordDate, getFishCount, getFishName, isExcludedSpecies } from '@/lib/firestore-helpers';
import { thaiFormatYearMonth } from '@/lib/date-format';

// ---- Math helpers ----

function linearRegression(points) {
  // points: [{x: number, y: number}]
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R²
  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  // Residual std dev for confidence interval
  const se = Math.sqrt(ssRes / Math.max(n - 2, 1));
  const xMean = sumX / n;
  const sxx = sumX2 - n * xMean * xMean;

  return { slope, intercept, r2, se, xMean, sxx, n };
}

function predict(model, x) {
  if (!model) return null;
  return model.slope * x + model.intercept;
}

function confidenceInterval(model, x, zScore = 1.96) {
  // 95% CI for prediction
  if (!model) return [null, null];
  const yHat = predict(model, x);
  const { se, xMean, sxx, n } = model;
  const margin = zScore * se * Math.sqrt(1 + 1 / n + (x - xMean) ** 2 / sxx);
  return [Math.max(0, yHat - margin), yHat + margin];
}

// Moving average smoothing
function movingAverage(arr, window = 3) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(arr.length, start + window);
    const slice = arr.slice(start, end);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// Convert YYYY-MM to numeric index (months since 2020-01)
function monthIndex(ym) {
  const [y, m] = ym.split('-').map(Number);
  return (y - 2020) * 12 + (m - 1);
}

function indexToYM(idx) {
  const y = 2020 + Math.floor(idx / 12);
  const m = String((idx % 12) + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const COLORS = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828', '#00838f', '#558b2f', '#e65100'];

export default function ForecastPage() {
  const [rawMonthly, setRawMonthly] = useState(null); // { 'YYYY-MM': { species: count } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forecastMonths, setForecastMonths] = useState(6);
  const [selectedSpecies, setSelectedSpecies] = useState('__total__');

  useEffect(() => {
    setLoading(true);
    getDocs(collection(db, 'fishingRecords'))
      .then(snap => {
        const byMonth = {};
        snap.forEach(doc => {
          const d = doc.data();
          const ts = getRecordDate(d);
          if (!ts) return;
          const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
          if (!byMonth[key]) byMonth[key] = {};
          (d.fishList || []).forEach(f => {
            const name = getFishName(f);
            if (isExcludedSpecies(name)) return; // ตัดกุ้งออกจากรายงาน
            byMonth[key][name] = (byMonth[key][name] || 0) + getFishCount(f);
          });
        });
        setRawMonthly(byMonth);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Top species list
  const topSpecies = useMemo(() => {
    if (!rawMonthly) return [];
    const totals = {};
    Object.values(rawMonthly).forEach(mo => {
      Object.entries(mo).forEach(([name, count]) => {
        totals[name] = (totals[name] || 0) + count;
      });
    });
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name]) => name);
  }, [rawMonthly]);

  // Set default species to top 1
  useEffect(() => {
    if (topSpecies.length > 0 && selectedSpecies === '__total__') {
      // keep total as default — it's the most useful
    }
  }, [topSpecies]);

  // Build historical series for selected species (or total)
  const historicalSeries = useMemo(() => {
    if (!rawMonthly) return [];
    return Object.entries(rawMonthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, speciesMap]) => {
        const val = selectedSpecies === '__total__'
          ? Object.values(speciesMap).reduce((a, b) => a + b, 0)
          : (speciesMap[selectedSpecies] || 0);
        return { ym, x: monthIndex(ym), y: val };
      });
  }, [rawMonthly, selectedSpecies]);

  // Build smoothed + regression + forecast
  const { chartData, model, r2Label, trendLabel } = useMemo(() => {
    if (historicalSeries.length < 3) return { chartData: [], model: null, r2Label: '-', trendLabel: '-' };

    const smoothedVals = movingAverage(historicalSeries.map(p => p.y), 3);
    const smoothedPoints = historicalSeries.map((p, i) => ({ x: p.x, y: smoothedVals[i] }));

    const reg = linearRegression(smoothedPoints);

    // Historical chart points (period แสดงในรูปแบบ "มิ.ย. 2569")
    const hist = historicalSeries.map((p, i) => ({
      period: thaiFormatYearMonth(p.ym),
      actual: p.y,
      smoothed: Math.round(smoothedVals[i] * 10) / 10,
      trend: reg ? Math.round(Math.max(0, predict(reg, p.x)) * 10) / 10 : null,
    }));

    // Forecast points
    const lastX = historicalSeries[historicalSeries.length - 1].x;
    const forecast = Array.from({ length: forecastMonths }, (_, i) => {
      const x = lastX + i + 1;
      const ym = indexToYM(x);
      const yHat = reg ? Math.round(Math.max(0, predict(reg, x)) * 10) / 10 : 0;
      const [lo, hi] = reg ? confidenceInterval(reg, x) : [0, 0];
      return {
        period: thaiFormatYearMonth(ym),
        forecast: yHat,
        ciLow: Math.round(Math.max(0, lo) * 10) / 10,
        ciHigh: Math.round(Math.max(0, hi) * 10) / 10,
        isforecast: true,
      };
    });

    const r2 = reg ? Math.round(reg.r2 * 1000) / 1000 : null;
    const slope = reg?.slope || 0;
    const trendLabel = slope > 0.5
      ? '📈 แนวโน้มเพิ่มขึ้น'
      : slope < -0.5
      ? '📉 แนวโน้มลดลง'
      : '➡️ ค่อนข้างคงที่';

    return {
      chartData: [...hist, ...forecast],
      model: reg,
      r2Label: r2 !== null ? String(r2) : '-',
      trendLabel,
    };
  }, [historicalSeries, forecastMonths]);

  const lastHistPeriod = historicalSeries[historicalSeries.length - 1]?.ym
    ? thaiFormatYearMonth(historicalSeries[historicalSeries.length - 1].ym)
    : null;

  const speciesOptions = [
    { value: '__total__', label: 'รวมทุกชนิด' },
    ...topSpecies.map(s => ({ value: s, label: s })),
  ];

  return (
    <ProtectedRoute requiredRoles={Object.values(USER_ROLES)} fallbackPath="/login">
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <QueryStats sx={{ fontSize: 36, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">พยากรณ์ประชากรปลา</Typography>
            <Typography variant="body2" color="text.secondary">
              Linear Regression + Moving Average จากข้อมูลการจับปลาย้อนหลัง
            </Typography>
          </Box>
        </Box>

        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 3 }}>
          ผลพยากรณ์เป็น <strong>การประมาณการเบื้องต้น</strong> จาก Linear Regression — ความแม่นยำขึ้นกับปริมาณและความสม่ำเสมอของข้อมูลในฐานข้อมูล ไม่ควรใช้เป็นข้อสรุปเชิงนโยบายเพียงอย่างเดียว
        </Alert>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        ) : !rawMonthly || Object.keys(rawMonthly).length < 3 ? (
          <Alert severity="info">ข้อมูลไม่เพียงพอสำหรับการพยากรณ์ (ต้องการอย่างน้อย 3 เดือน)</Alert>
        ) : (
          <>
            {/* Controls */}
            <Box display="flex" gap={3} mb={3} flexWrap="wrap" alignItems="flex-end">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>ชนิดปลา</InputLabel>
                <Select value={selectedSpecies} label="ชนิดปลา" onChange={e => setSelectedSpecies(e.target.value)}>
                  {speciesOptions.map(o => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ minWidth: 240 }}>
                <Typography variant="caption" color="text.secondary">
                  จำนวนเดือนที่พยากรณ์ล่วงหน้า: <strong>{forecastMonths} เดือน</strong>
                </Typography>
                <Slider
                  value={forecastMonths}
                  min={3}
                  max={12}
                  step={1}
                  marks={[{ value: 3, label: '3' }, { value: 6, label: '6' }, { value: 12, label: '12' }]}
                  onChange={(_, v) => setForecastMonths(v)}
                  size="small"
                />
              </Box>

              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip label={trendLabel} color="primary" variant="outlined" size="small" />
                <Tooltip title="R² คือสัดส่วนความแปรปรวนที่โมเดลอธิบายได้ ยิ่งใกล้ 1 = โมเดลพยากรณ์ได้แม่นยำกว่า" arrow>
                  <Chip
                    icon={<InfoOutlined />}
                    label={`R² = ${r2Label}`}
                    color={parseFloat(r2Label) >= 0.7 ? 'success' : parseFloat(r2Label) >= 0.4 ? 'warning' : 'default'}
                    variant="outlined"
                    size="small"
                  />
                </Tooltip>
                <Chip
                  label={`ข้อมูลย้อนหลัง ${historicalSeries.length} เดือน`}
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Box>

            {/* Main forecast chart */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  กราฟพยากรณ์{selectedSpecies === '__total__' ? 'รวมทุกชนิด' : ` — ${selectedSpecies}`}
                </Typography>
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11 }}
                      interval={Math.floor(chartData.length / 8)}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ReTooltip
                      formatter={(val, name) => {
                        const labels = {
                          actual: 'จำนวนจริง (ตัว)',
                          smoothed: 'ค่าเฉลี่ยเคลื่อนที่',
                          trend: 'เส้นแนวโน้ม',
                          forecast: 'พยากรณ์ (ตัว)',
                          ciHigh: 'ขอบบน 95%',
                          ciLow: 'ขอบล่าง 95%',
                        };
                        return [val ?? '-', labels[name] || name];
                      }}
                    />
                    <Legend
                      formatter={name => ({
                        actual: 'จำนวนจริง',
                        smoothed: 'เฉลี่ยเคลื่อนที่ (3 เดือน)',
                        trend: 'แนวโน้ม (Regression)',
                        forecast: 'พยากรณ์',
                        ciHigh: 'ขอบบน 95% CI',
                        ciLow: 'ขอบล่าง 95% CI',
                      }[name] || name)}
                    />

                    {/* CI band */}
                    <Area
                      dataKey="ciHigh"
                      stroke="none"
                      fill="#bbdefb"
                      fillOpacity={0.5}
                      name="ciHigh"
                    />
                    <Area
                      dataKey="ciLow"
                      stroke="none"
                      fill="#ffffff"
                      fillOpacity={1}
                      name="ciLow"
                    />

                    {/* Historical bars */}
                    <Bar dataKey="actual" name="actual" fill="#90caf9" radius={[3, 3, 0, 0]} maxBarSize={20} />

                    {/* Smoothed line */}
                    <Line
                      type="monotone"
                      dataKey="smoothed"
                      name="smoothed"
                      stroke="#1976d2"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />

                    {/* Trend line */}
                    <Line
                      type="monotone"
                      dataKey="trend"
                      name="trend"
                      stroke="#388e3c"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      dot={false}
                      connectNulls
                    />

                    {/* Forecast line */}
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      name="forecast"
                      stroke="#f57c00"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#f57c00' }}
                      connectNulls
                    />

                    {/* Divider between historical and forecast */}
                    {lastHistPeriod && (
                      <ReferenceLine
                        x={lastHistPeriod}
                        stroke="#e53935"
                        strokeDasharray="4 4"
                        label={{ value: 'ข้อมูลล่าสุด', position: 'top', fontSize: 11, fill: '#e53935' }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>

                {/* คำบรรยายใต้กราฟ */}
                <Box sx={{ mt: 2, p: 2, bgcolor: '#fff3e0', borderRadius: 1, borderLeft: '4px solid #f57c00' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                    <strong>การอ่านกราฟ:</strong> กราฟแบ่งเป็น 2 ส่วน คั่นด้วยเส้นประสีแดง
                    <br />
                    <Box component="span" sx={{ color: '#1976d2', fontWeight: 'bold' }}>● ข้อมูลย้อนหลัง (ซ้ายของเส้นแดง):</Box>{' '}
                    แท่งฟ้าคือจำนวนจริง เส้นน้ำเงินคือค่าเฉลี่ยเคลื่อนที่ 3 เดือน เส้นเขียวประคือเส้นแนวโน้ม (regression)
                    <br />
                    <Box component="span" sx={{ color: '#f57c00', fontWeight: 'bold' }}>● พยากรณ์ (ขวาของเส้นแดง):</Box>{' '}
                    เส้นส้มคือค่าคาดการณ์ แถบสีฟ้าคือช่วงความเชื่อมั่น 95% (Confidence Interval)
                    {model && (
                      <>
                        <br />
                        <strong>คุณภาพโมเดล:</strong> R² = <strong>{r2Label}</strong>{' '}
                        {parseFloat(r2Label) >= 0.7
                          ? '— โมเดลอธิบายข้อมูลได้ดีมาก ผลพยากรณ์น่าเชื่อถือ'
                          : parseFloat(r2Label) >= 0.4
                          ? '— โมเดลอธิบายได้ปานกลาง ใช้พยากรณ์เบื้องต้นได้'
                          : '— โมเดลอธิบายได้น้อย ผลพยากรณ์มีความไม่แน่นอนสูง'}
                      </>
                    )}
                    <br />
                    <strong>การตีความ:</strong>{' '}
                    {selectedSpecies === '__total__' ? (
                      <>
                        กราฟนี้คำนวณ <strong>ผลรวมของปลาทุกชนิด</strong> ในแต่ละเดือน เพื่อพยากรณ์ปริมาณการจับปลาโดยภาพรวมในอนาคต
                        ใช้วางแผนการประมง การจัดสรรทรัพยากร และการคาดการณ์ผลผลิตของชุมชน
                        เหมาะกับการดูภาพรวมของระบบนิเวศแม่น้ำโขงทั้งระบบ
                      </>
                    ) : (
                      <>
                        กราฟนี้คำนวณเฉพาะปลา <strong>{selectedSpecies}</strong> ในแต่ละเดือน
                        ใช้พยากรณ์เพื่อตามดูแนวโน้มของชนิดเฉพาะ — เหมาะกับการประเมินสถานะอนุรักษ์
                        หรือวางแผนการเพาะเลี้ยงและฟื้นฟูประชากรชนิดที่เสี่ยง
                      </>
                    )}
                    <br />
                    <strong>ข้อควรระวัง:</strong> โมเดล Linear Regression เหมาะกับแนวโน้มเชิงเส้น —
                    ไม่ครอบคลุมเหตุการณ์พิเศษ เช่น น้ำท่วม ภัยแล้ง หรือการเปลี่ยนแปลงนโยบาย
                    ควรใช้คู่กับข้อมูลภาคสนามเพื่อการตัดสินใจ
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Forecast table */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  ตารางพยากรณ์ {forecastMonths} เดือนข้างหน้า
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'orange.50', '& th': { bgcolor: '#fff3e0' } }}>
                        <TableCell>เดือน</TableCell>
                        <TableCell align="right">พยากรณ์ (ตัว)</TableCell>
                        <TableCell align="right">ขอบล่าง 95%</TableCell>
                        <TableCell align="right">ขอบบน 95%</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {chartData.filter(d => d.isforecast).map(row => (
                        <TableRow key={row.period} hover>
                          <TableCell>{row.period}</TableCell>
                          <TableCell align="right"><strong>{row.forecast}</strong></TableCell>
                          <TableCell align="right">{row.ciLow}</TableCell>
                          <TableCell align="right">{row.ciHigh}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Multi-species overview */}
            {topSpecies.length > 1 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                    สรุปแนวโน้มรายชนิดพันธุ์ (8 ชนิดหลัก)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" mb={2} display="block">
                    slope = การเปลี่ยนแปลงเฉลี่ยต่อเดือน (ตัว), R² = ความแม่นยำของโมเดล
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                          <TableCell>ชนิดปลา</TableCell>
                          <TableCell align="right">เดือนที่มีข้อมูล</TableCell>
                          <TableCell align="right">เฉลี่ย/เดือน (ตัว)</TableCell>
                          <TableCell align="right">แนวโน้ม (slope)</TableCell>
                          <TableCell align="right">R²</TableCell>
                          <TableCell>ทิศทาง</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topSpecies.map(sp => {
                          const series = Object.entries(rawMonthly)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([ym, mo]) => ({ x: monthIndex(ym), y: mo[sp] || 0 }))
                            .filter(p => p.y > 0);
                          const reg = linearRegression(series);
                          const avg = series.length > 0
                            ? Math.round(series.reduce((s, p) => s + p.y, 0) / series.length * 10) / 10
                            : 0;
                          const slope = reg ? Math.round(reg.slope * 100) / 100 : 0;
                          const r2 = reg ? Math.round(reg.r2 * 1000) / 1000 : 0;
                          const dir = slope > 0.3 ? '📈' : slope < -0.3 ? '📉' : '➡️';
                          return (
                            <TableRow key={sp} hover>
                              <TableCell>{sp}</TableCell>
                              <TableCell align="right">{series.length}</TableCell>
                              <TableCell align="right">{avg}</TableCell>
                              <TableCell align="right" sx={{ color: slope > 0 ? 'success.main' : slope < 0 ? 'error.main' : 'text.secondary' }}>
                                {slope > 0 ? '+' : ''}{slope}
                              </TableCell>
                              <TableCell align="right">{r2}</TableCell>
                              <TableCell>{dir}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* คำบรรยายใต้ตาราง */}
                  <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f7fa', borderRadius: 1, borderLeft: '4px solid #1976d2' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                      <strong>การอ่านตาราง:</strong> สรุปแนวโน้มของปลา 8 ชนิดที่จับได้บ่อยที่สุด
                      <br />
                      <strong>slope</strong> = อัตราการเปลี่ยนแปลงเฉลี่ยต่อเดือน (ตัว) — บวกหมายถึงเพิ่มขึ้น, ลบหมายถึงลดลง
                      <br />
                      <strong>R²</strong> = ความแม่นยำของโมเดล (0–1) ใกล้ 1 = ยิ่งเชื่อถือได้
                      <br />
                      <strong>ทิศทาง</strong>: 📈 = เพิ่มขึ้น, 📉 = ลดลง, ➡️ = ค่อนข้างคงที่ —
                      ใช้ติดตามว่าชนิดใดอาจเสี่ยงต่อการลดลงและควรเฝ้าระวัง
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Container>
    </DashboardLayout>
    </ProtectedRoute>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Container, Typography, Card, CardContent, Grid, CircularProgress,
  Alert, Select, MenuItem, FormControl, InputLabel, Chip, Tooltip
} from '@mui/material';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis,
  Tooltip as ReTooltip, ResponsiveContainer, LineChart, Line, Legend,
  ComposedChart, Bar
} from 'recharts';
import { Waves, InfoOutlined } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getRecordDate, getFishName, getFishCount, isExcludedSpecies } from '@/lib/firestore-helpers';
import { toThaiYear } from '@/lib/date-format';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function pearsonR(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(
    xs.reduce((s, x) => s + (x - mx) ** 2, 0) *
    ys.reduce((s, y) => s + (y - my) ** 2, 0)
  );
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}

function rInterpretation(r) {
  const abs = Math.abs(r);
  const dir = r >= 0 ? 'บวก' : 'ลบ';
  if (abs >= 0.8) return `ความสัมพันธ์${dir}แข็งแกร่งมาก (r = ${r})`;
  if (abs >= 0.6) return `ความสัมพันธ์${dir}แข็งแกร่ง (r = ${r})`;
  if (abs >= 0.4) return `ความสัมพันธ์${dir}ปานกลาง (r = ${r})`;
  if (abs >= 0.2) return `ความสัมพันธ์${dir}อ่อน (r = ${r})`;
  return `แทบไม่มีความสัมพันธ์ (r = ${r})`;
}

export default function CorrelationPage() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [fishingData, setFishingData] = useState([]);
  const [waterData, setWaterData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      getDocs(collection(db, 'fishingRecords')),
      fetch('/api/water-levels').then(r => r.json()),
    ])
      .then(([fishSnap, waterRes]) => {
        // Aggregate fishing by month
        const monthMap = {};
        fishSnap.forEach(doc => {
          const d = doc.data();
          const ts = getRecordDate(d);
          if (!ts || String(ts.getFullYear()) !== year) return;
          const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
          if (!monthMap[key]) monthMap[key] = { totalCount: 0, totalWeight: 0, records: 0 };
          (d.fishList || []).forEach(f => {
            if (isExcludedSpecies(getFishName(f))) return; // ตัดกุ้งออกจากรายงาน
            monthMap[key].totalCount += getFishCount(f);
            monthMap[key].totalWeight += parseFloat(f.weight) || 0;
          });
          monthMap[key].records += 1;
        });
        setFishingData(monthMap);

        // Average water level by month
        if (waterRes.success) {
          const wMap = {};
          waterRes.data.forEach(r => {
            if (!r.date) return;
            const [y, m] = r.date.split('-');
            if (y !== year) return;
            const key = `${y}-${m}`;
            if (!wMap[key]) wMap[key] = { sum: 0, count: 0 };
            wMap[key].sum += parseFloat(r.waterLevel) || 0;
            wMap[key].count += 1;
          });
          setWaterData(wMap);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  const combined = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      const key = `${year}-${m}`;
      const fish = fishingData[key] || {};
      const water = waterData[key] || {};
      const avgRaw = water.count > 0 ? water.sum / water.count : null;
      const avgWater = avgRaw !== null && Number.isFinite(avgRaw) ? Math.round(avgRaw * 10) / 10 : null;
      return {
        period: `${m}/${String(toThaiYear(year)).slice(2)}`,
        waterLevel: avgWater,
        fishCount: fish.totalCount || 0,
        fishWeight: Math.round((fish.totalWeight || 0) * 10) / 10,
        records: fish.records || 0,
      };
    });
    return months;
  }, [fishingData, waterData, year]);

  const scatterPoints = combined.filter(d => d.waterLevel !== null && d.fishCount > 0);

  const r = useMemo(() => {
    if (scatterPoints.length < 2) return null;
    return pearsonR(
      scatterPoints.map(d => d.waterLevel),
      scatterPoints.map(d => d.fishCount)
    );
  }, [scatterPoints]);

  return (
    <ProtectedRoute requiredRoles={Object.values(USER_ROLES)} fallbackPath="/login">
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Waves sx={{ fontSize: 36, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">ความสัมพันธ์สิ่งแวดล้อม</Typography>
            <Typography variant="body2" color="text.secondary">
              ระดับน้ำแม่น้ำโขง vs จำนวนปลาที่จับได้รายเดือน
            </Typography>
          </Box>
        </Box>

        {/* Controls */}
        <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>ปี</InputLabel>
            <Select value={year} label="ปี" onChange={e => setYear(e.target.value)}>
              {YEAR_OPTIONS.map(y => (
                <MenuItem key={y} value={String(y)}>{toThaiYear(y)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {r !== null && (
            <Chip
              icon={<InfoOutlined />}
              label={rInterpretation(r)}
              color={Math.abs(r) >= 0.6 ? 'primary' : Math.abs(r) >= 0.4 ? 'warning' : 'default'}
              variant="outlined"
            />
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        ) : (
          <>
            {/* Dual-axis trend chart */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  แนวโน้มระดับน้ำ (ม.) และจำนวนปลาที่จับได้ (ตัว) รายเดือน {toThaiYear(year)}
                </Typography>
                {combined.every(d => d.fishCount === 0) ? (
                  <Alert severity="info">ไม่พบข้อมูลการจับปลาในปี {toThaiYear(year)}</Alert>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={combined} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="water" label={{ value: 'ระดับน้ำ (ม.)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }} tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="fish" orientation="right" label={{ value: 'จำนวน (ตัว)', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 11 } }} tick={{ fontSize: 12 }} />
                      <ReTooltip />
                      <Legend />
                      <Bar yAxisId="fish" dataKey="fishCount" name="จำนวนปลา (ตัว)" fill="#90caf9" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="water" type="monotone" dataKey="waterLevel" name="ระดับน้ำ (ม.)" stroke="#1976d2" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}

                {/* คำบรรยายใต้กราฟ */}
                <Box sx={{ mt: 2, p: 2, bgcolor: '#e3f2fd', borderRadius: 1, borderLeft: '4px solid #1976d2' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                    <strong>การอ่านกราฟ:</strong> กราฟแสดงความสัมพันธ์ระหว่างระดับน้ำแม่น้ำโขง (เส้นน้ำเงิน, แกนซ้าย)
                    กับจำนวนปลาที่จับได้ (แท่งฟ้า, แกนขวา) ในแต่ละเดือน
                    <br />
                    <strong>การตีความ:</strong> หากเส้นน้ำเงินสูง = น้ำมาก (ฤดูน้ำหลาก) มักพบว่าจำนวนปลาที่จับได้
                    เปลี่ยนแปลงตาม — เป็นข้อมูลพื้นฐานสำคัญในการเข้าใจวงจรชีวภาพและฤดูจับปลา
                    {r !== null && (
                      <>
                        <br />
                        <strong>สรุป:</strong> {rInterpretation(r)} —{' '}
                        {Math.abs(r) >= 0.6
                          ? 'ระดับน้ำเป็นปัจจัยสำคัญที่อธิบายการเปลี่ยนแปลงของจำนวนปลา'
                          : Math.abs(r) >= 0.4
                          ? 'มีอิทธิพลพอสมควร แต่ยังมีปัจจัยอื่นร่วม'
                          : 'อาจมีปัจจัยอื่น (ฤดูกาล วิธีจับ ฯลฯ) มีอิทธิพลมากกว่า'}
                      </>
                    )}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Scatter chart */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  Scatter Plot — ระดับน้ำ vs จำนวนปลา
                </Typography>
                {scatterPoints.length < 2 ? (
                  <Alert severity="info">ข้อมูลไม่เพียงพอสำหรับ scatter plot (ต้องการอย่างน้อย 2 เดือนที่มีทั้งระดับน้ำและการจับปลา)</Alert>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="waterLevel" name="ระดับน้ำ (ม.)" label={{ value: 'ระดับน้ำ (ม.)', position: 'insideBottom', offset: -10, style: { fontSize: 12 } }} tick={{ fontSize: 12 }} />
                      <YAxis dataKey="fishCount" name="จำนวนปลา" label={{ value: 'จำนวนปลา (ตัว)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }} tick={{ fontSize: 12 }} />
                      <ZAxis range={[60, 60]} />
                      <ReTooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => [v, n]} />
                      <Scatter name="เดือน" data={scatterPoints} fill="#1976d2" />
                    </ScatterChart>
                  </ResponsiveContainer>
                )}

                {/* คำบรรยายใต้กราฟ */}
                <Box sx={{ mt: 2, p: 2, bgcolor: '#f3e5f5', borderRadius: 1, borderLeft: '4px solid #7b1fa2' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                    <strong>การอ่านกราฟ:</strong> แต่ละจุดคือ 1 เดือน — แกน X คือระดับน้ำเฉลี่ย (ม.)
                    แกน Y คือจำนวนปลาที่จับในเดือนนั้น
                    <br />
                    <strong>การตีความ:</strong> หากจุดเรียงตัวเป็นเส้นตรงเฉียงขึ้น = ความสัมพันธ์เชิงบวก (น้ำมาก → จับได้มาก)
                    หากเรียงเฉียงลง = เชิงลบ (น้ำมาก → จับได้น้อย) หากกระจัดกระจาย = ไม่มีความสัมพันธ์เชิงเส้น
                    <br />
                    Scatter Plot ช่วยให้เห็นภาพรวมที่ตัวเลข r เพียงอย่างเดียวไม่บอก —
                    เช่น มี outlier หรือความสัมพันธ์ที่ไม่เป็นเชิงเส้นหรือไม่
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Weight correlation */}
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  น้ำหนักปลาที่จับได้รายเดือน (กก.) {toThaiYear(year)}
                </Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={combined} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="weight" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="water" orientation="right" tick={{ fontSize: 12 }} />
                    <ReTooltip />
                    <Legend />
                    <Bar yAxisId="weight" dataKey="fishWeight" name="น้ำหนัก (กก.)" fill="#a5d6a7" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="water" type="monotone" dataKey="waterLevel" name="ระดับน้ำ (ม.)" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>

                {/* คำบรรยายใต้กราฟ */}
                <Box sx={{ mt: 2, p: 2, bgcolor: '#e8f5e9', borderRadius: 1, borderLeft: '4px solid #388e3c' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                    <strong>การอ่านกราฟ:</strong> เปรียบเทียบน้ำหนักรวมของปลาที่จับได้ (แท่งเขียว, กก.)
                    กับระดับน้ำ (เส้นน้ำเงิน, ม.) รายเดือน
                    <br />
                    <strong>การตีความ:</strong> น้ำหนักรวมสะท้อนคุณภาพของการจับ — บางครั้งจับได้จำนวนน้อย
                    แต่ขนาดใหญ่ (น้ำหนักสูง) อาจเหมาะกับช่วงระดับน้ำเฉพาะ
                    ใช้คู่กับกราฟแรก (จำนวนตัว) จะเห็นภาพรวมการประมงในแต่ละฤดู
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </>
        )}
      </Container>
    </DashboardLayout>
    </ProtectedRoute>
  );
}

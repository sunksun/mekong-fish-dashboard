'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Container, Typography, Card, CardContent, CircularProgress, Alert,
  Grid, Chip, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Stack,
} from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceLine, ComposedChart, Area,
} from 'recharts';
import { Waves, WaterDrop, WarningAmber, Cloud } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import { authFetch } from '@/lib/api-client';
import { thaiFormatYearMonth } from '@/lib/date-format';

export default function WaterLevelAnalysisPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    setLoading(true);
    authFetch('/api/reports/water-level-analysis')
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error || 'API error');
        setData(json);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ProtectedRoute requiredRoles={Object.values(USER_ROLES)} fallbackPath="/login">
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Waves sx={{ fontSize: 36, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">วิเคราะห์ระดับน้ำและปริมาณฝนเชิงลึก</Typography>
            <Typography variant="body2" color="text.secondary">
              Flood risk · Heavy rainfall · Rainfall-runoff correlation · เชียงคาน จ.เลย
            </Typography>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        ) : !data ? null : data.empty ? (
          <Alert severity="info">ยังไม่มีข้อมูลใน collection waterLevels</Alert>
        ) : (
          <>
            <OverviewCards data={data} />

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label="Timeline" />
              <Tab label="Flood Risk" />
              <Tab label="Heavy Rainfall" />
              <Tab label="Rainfall Correlation" />
              <Tab label="Monthly Stats" />
              <Tab label="Yearly Comparison" />
            </Tabs>

            {tab === 0 && <TimelineTab data={data} />}
            {tab === 1 && <FloodRiskTab data={data} />}
            {tab === 2 && <RainfallTab data={data} />}
            {tab === 3 && <CorrelationTab data={data} />}
            {tab === 4 && <MonthlyTab data={data} />}
            {tab === 5 && <YearlyTab data={data} />}
          </>
        )}
      </Container>
    </DashboardLayout>
    </ProtectedRoute>
  );
}

// ─────────────────────────────────────────────────────────
function OverviewCards({ data }) {
  const s = data.stats;
  return (
    <Grid container spacing={2} mb={3}>
      <Grid item xs={12} md={3}>
        <Card sx={{ borderLeft: '4px solid #1976d2' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">ระดับน้ำเฉลี่ย</Typography>
            <Typography variant="h4" fontWeight="bold">{s.level.mean?.toFixed(2)}</Typography>
            <Typography variant="caption">ม. · Min {s.level.min?.toFixed(2)} · Max {s.level.max?.toFixed(2)}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card sx={{ borderLeft: '4px solid #c62828' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">เกินตลิ่งวิกฤต</Typography>
            <Typography variant="h4" fontWeight="bold" sx={{ color: '#c62828' }}>{data.floodRisk.criticalCount}</Typography>
            <Typography variant="caption">วัน · เตือน {data.floodRisk.warningCount} วัน</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card sx={{ borderLeft: '4px solid #0288d1' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">ฝนตกทั้งหมด</Typography>
            <Typography variant="h4" fontWeight="bold">{s.rainfall.total?.toFixed(0)}</Typography>
            <Typography variant="caption">มม. · {s.rainfall.rainyDays} วัน (ฝนหนัก {s.rainfall.heavyDays})</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={3}>
        <Card sx={{ borderLeft: '4px solid #388e3c' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">ข้อมูลทั้งหมด</Typography>
            <Typography variant="h4" fontWeight="bold">{s.n}</Typography>
            <Typography variant="caption">วัน · {s.dateRange.start} → {s.dateRange.end}</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

// ─────────────────────────────────────────────────────────
function TimelineTab({ data }) {
  // Downsample สำหรับกราฟใหญ่ — เหลือ ~200 จุด
  const chartData = useMemo(() => {
    const step = Math.max(1, Math.floor(data.dailySeries.length / 300));
    return data.dailySeries.filter((_, i) => i % step === 0);
  }, [data]);

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Timeline ระดับน้ำ + ปริมาณฝน (ทุกวัน)
        </Typography>
        <ResponsiveContainer width="100%" height={450}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" label={{ value: 'ระดับน้ำ (ม.)', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="right" orientation="right" label={{ value: 'ฝน (มม.)', angle: 90, position: 'insideRight' }} />
            <ReTooltip />
            <Legend />
            <ReferenceLine yAxisId="left" y={data.stats.thresholds.CRITICAL_LEVEL} stroke="#c62828" strokeDasharray="5 5" label={{ value: 'วิกฤต 16.0 ม.', position: 'right', fontSize: 10 }} />
            <ReferenceLine yAxisId="left" y={data.stats.thresholds.WARNING_LEVEL} stroke="#ef6c00" strokeDasharray="5 5" label={{ value: 'เตือน 14.0 ม.', position: 'right', fontSize: 10 }} />
            <Bar yAxisId="right" dataKey="rainfall" fill="#0288d1" opacity={0.6} name="ฝน (มม.)" />
            <Line yAxisId="left" type="monotone" dataKey="level" stroke="#1976d2" strokeWidth={2} dot={false} name="ระดับน้ำ (ม.)" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
function FloodRiskTab({ data }) {
  return (
    <Stack spacing={2}>
      <Alert severity="warning" icon={<WarningAmber />}>
        เกณฑ์: ≥14 ม. = เตือน · ≥16 ม. = วิกฤต (น้ำท่วมล้นตลิ่ง)
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            เหตุการณ์ระดับน้ำวิกฤต ({data.floodRisk.criticalCount} วัน)
          </Typography>
          {data.floodRisk.criticalDates.length === 0 ? (
            <Alert severity="success">ไม่พบวันที่เกินตลิ่งวิกฤต</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>วันที่</TableCell>
                    <TableCell align="right">ระดับน้ำ (ม.)</TableCell>
                    <TableCell align="right">การเปลี่ยนแปลง</TableCell>
                    <TableCell>ระดับ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.floodRisk.criticalDates.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.date}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#c62828' }}>{e.level.toFixed(2)}</TableCell>
                      <TableCell align="right">{e.change > 0 ? '+' : ''}{e.change?.toFixed(2)}</TableCell>
                      <TableCell><Chip size="small" label="วิกฤต" sx={{ bgcolor: '#ffcdd2', color: '#c62828', fontWeight: 'bold' }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            เหตุการณ์ระดับน้ำเตือน ({data.floodRisk.warningCount} วัน)
          </Typography>
          {data.floodRisk.warningDates.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>วันที่</TableCell>
                    <TableCell align="right">ระดับน้ำ (ม.)</TableCell>
                    <TableCell align="right">การเปลี่ยนแปลง</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.floodRisk.warningDates.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.date}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#ef6c00' }}>{e.level.toFixed(2)}</TableCell>
                      <TableCell align="right">{e.change > 0 ? '+' : ''}{e.change?.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
function RainfallTab({ data }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Top 20 เหตุการณ์ฝนตกหนัก (&gt;50 มม./วัน)
        </Typography>
        <Alert severity="info" icon={<Cloud />} sx={{ mb: 2 }}>
          พบวันฝนตกหนัก {data.stats.rainfall.heavyDays} วัน จากทั้งหมด {data.stats.n} วัน
        </Alert>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>อันดับ</TableCell>
                <TableCell>วันที่</TableCell>
                <TableCell align="right">ปริมาณฝน (มม.)</TableCell>
                <TableCell align="right">ระดับน้ำ (ม.)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.heavyRainEvents.map((e, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{e.date}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#0288d1' }}>{e.rainfall.toFixed(1)}</TableCell>
                  <TableCell align="right">{e.level.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
function CorrelationTab({ data }) {
  const chartData = Object.entries(data.rainfallLagCorr).map(([k, v]) => ({
    lag: k.replace('lag', 'lag '),
    r: v ?? 0,
  }));
  const bestLag = chartData.reduce((best, cur) => Math.abs(cur.r) > Math.abs(best.r) ? cur : best, chartData[0]);

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Pearson r: ฝนวันที่ t → ระดับน้ำวันที่ t+lag · <b>Lag ที่มี r สูงสุด: {bestLag?.lag} (r = {bestLag?.r?.toFixed(3)})</b>
      </Alert>
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Rainfall-Runoff Correlation
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="lag" tick={{ fontSize: 12 }} />
              <YAxis domain={[-1, 1]} tick={{ fontSize: 12 }} />
              <ReTooltip formatter={(v) => v?.toFixed(3)} />
              <ReferenceLine y={0} stroke="#000" />
              <Bar dataKey="r" fill="#1976d2" name="Pearson r" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
function MonthlyTab({ data }) {
  const chartData = data.monthlyStats.map(m => ({
    period: thaiFormatYearMonth(m.period),
    avgLevel: m.avgLevel,
    maxLevel: m.maxLevel,
    totalRainfall: m.totalRainfall,
  }));

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            สถิติรายเดือน
          </Typography>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <ReTooltip />
              <Legend />
              <Bar yAxisId="right" dataKey="totalRainfall" fill="#0288d1" opacity={0.6} name="ฝนรวม (มม.)" />
              <Line yAxisId="left" type="monotone" dataKey="avgLevel" stroke="#1976d2" strokeWidth={2} name="ระดับน้ำเฉลี่ย (ม.)" />
              <Line yAxisId="left" type="monotone" dataKey="maxLevel" stroke="#c62828" strokeWidth={1} strokeDasharray="5 5" name="ระดับน้ำสูงสุด (ม.)" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
function YearlyTab({ data }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          เปรียบเทียบรายปี
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ปี (พ.ศ.)</TableCell>
                <TableCell align="right">จำนวนวัน</TableCell>
                <TableCell align="right">ระดับน้ำเฉลี่ย (ม.)</TableCell>
                <TableCell align="right">ระดับน้ำสูงสุด (ม.)</TableCell>
                <TableCell align="right">ระดับน้ำต่ำสุด (ม.)</TableCell>
                <TableCell align="right">ฝนรวม (มม.)</TableCell>
                <TableCell align="right">วันฝนหนัก (&gt;50มม.)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.yearlyStats.map(y => (
                <TableRow key={y.year}>
                  <TableCell><b>{y.thaiYear}</b></TableCell>
                  <TableCell align="right">{y.n}</TableCell>
                  <TableCell align="right">{y.avgLevel?.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: y.maxLevel >= 16 ? '#c62828' : y.maxLevel >= 14 ? '#ef6c00' : 'inherit' }}>
                    {y.maxLevel?.toFixed(2)}
                  </TableCell>
                  <TableCell align="right">{y.minLevel?.toFixed(2)}</TableCell>
                  <TableCell align="right">{y.totalRainfall?.toFixed(0)}</TableCell>
                  <TableCell align="right">
                    <Chip size="small" label={y.heavyRainDays} sx={{ bgcolor: y.heavyRainDays > 10 ? '#ffcdd2' : '#e3f2fd' }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

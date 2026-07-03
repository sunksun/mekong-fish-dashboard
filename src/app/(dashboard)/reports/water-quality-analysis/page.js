'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Container, Typography, Card, CardContent, CircularProgress, Alert,
  Grid, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Tabs, Tab, Divider,
} from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceLine, ScatterChart, Scatter,
} from 'recharts';
import { Science, WarningAmber, InfoOutlined, TrendingUp } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { thaiFormatYearMonth } from '@/lib/date-format';

const WATERBODY_COLORS = { 'แม่น้ำโขง': '#1976d2', 'แม่น้ำเลย': '#f57c00' };
const PARAM_LABELS = {
  temperature: 'อุณหภูมิ (°C)',
  pH: 'pH',
  tss: 'TSS (mg/L)',
  ec: 'EC (µS/cm)',
  dissolvedOxygen: 'DO (mg/L)',
  arsenic: 'As (mg/L)',
};

export default function WaterQualityAnalysisPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch('/api/reports/water-quality-analysis')
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error || 'API error');
        setData(json);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Science sx={{ fontSize: 36, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">วิเคราะห์คุณภาพน้ำเชิงลึก</Typography>
            <Typography variant="body2" color="text.secondary">
              WQI · เทียบมาตรฐาน MRC · Correlation · Anomaly · เชียงคาน จ.เลย
            </Typography>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        ) : !data ? null : (
          <>
            <OverviewCards data={data} />

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label="WQI Timeline" />
              <Tab label="พารามิเตอร์รายเดือน" />
              <Tab label="เทียบมาตรฐาน MRC" />
              <Tab label="Correlation กับปลา" />
              <Tab label="Anomaly Detection" />
            </Tabs>

            {tab === 0 && <WqiTimelineTab data={data} />}
            {tab === 1 && <ParametersTab data={data} />}
            {tab === 2 && <ComplianceTab data={data} />}
            {tab === 3 && <CorrelationTab data={data} />}
            {tab === 4 && <AnomalyTab data={data} />}
          </>
        )}
      </Container>
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────
function OverviewCards({ data }) {
  const cards = data.waterbodies.map(wb => {
    const s = data.overallStats[wb];
    const monthlyData = data.monthlySummary[wb] || [];
    const avgWqi = monthlyData.length ? monthlyData.reduce((sum, m) => sum + (m.wqi || 0), 0) / monthlyData.length : 0;
    return {
      wb,
      n: s.n,
      dateRange: s.dateRange,
      avgWqi: Math.round(avgWqi * 10) / 10,
      avgDO: s.avg.dissolvedOxygen,
      avgTemp: s.avg.temperature,
    };
  });

  return (
    <Grid container spacing={2} mb={3}>
      {cards.map(c => (
        <Grid item xs={12} md={6} key={c.wb}>
          <Card sx={{ borderLeft: `4px solid ${WATERBODY_COLORS[c.wb]}` }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ color: WATERBODY_COLORS[c.wb] }}>
                {c.wb}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {c.n} records · {c.dateRange?.start} → {c.dateRange?.end}
              </Typography>
              <Grid container spacing={1} mt={1}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">WQI เฉลี่ย</Typography>
                  <Typography variant="h5" fontWeight="bold">{c.avgWqi || '-'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">DO เฉลี่ย (mg/L)</Typography>
                  <Typography variant="h5" fontWeight="bold">{c.avgDO?.toFixed(2) || '-'}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">อุณหภูมิเฉลี่ย (°C)</Typography>
                  <Typography variant="h5" fontWeight="bold">{c.avgTemp?.toFixed(1) || '-'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

// ─────────────────────────────────────────────────────────
function WqiTimelineTab({ data }) {
  const chartData = useMemo(() => {
    const allMonths = new Set();
    for (const wb of data.waterbodies) {
      (data.monthlySummary[wb] || []).forEach(m => allMonths.add(m.period));
    }
    return Array.from(allMonths).sort().map(ym => {
      const row = { period: thaiFormatYearMonth(ym), ym };
      for (const wb of data.waterbodies) {
        const m = (data.monthlySummary[wb] || []).find(x => x.period === ym);
        row[wb] = m?.wqi || null;
      }
      return row;
    });
  }, [data]);

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Water Quality Index (WQI) รายเดือน
        </Typography>
        <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 2 }}>
          WQI คำนวณจาก DO (30%), pH (15%), TSS (15%), Temperature (15%), EC (10%), As (15%){' '}
          — ระดับ: <b>90-100 ดีมาก · 70-89 ดี · 50-69 ปานกลาง · 30-49 แย่ · &lt;30 แย่มาก</b>
        </Alert>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <ReTooltip />
            <Legend />
            <ReferenceLine y={90} stroke="#2e7d32" strokeDasharray="3 3" label={{ value: 'ดีมาก', position: 'right', fontSize: 10 }} />
            <ReferenceLine y={70} stroke="#66bb6a" strokeDasharray="3 3" label={{ value: 'ดี', position: 'right', fontSize: 10 }} />
            <ReferenceLine y={50} stroke="#fbc02d" strokeDasharray="3 3" label={{ value: 'ปานกลาง', position: 'right', fontSize: 10 }} />
            {data.waterbodies.map(wb => (
              <Line key={wb} type="monotone" dataKey={wb} stroke={WATERBODY_COLORS[wb]} strokeWidth={2} connectNulls dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
function ParametersTab({ data }) {
  const params = ['temperature', 'dissolvedOxygen', 'pH', 'tss', 'ec', 'arsenic'];

  return (
    <Stack spacing={2}>
      {params.map(p => {
        const chartData = (() => {
          const allMonths = new Set();
          for (const wb of data.waterbodies) {
            (data.monthlySummary[wb] || []).forEach(m => allMonths.add(m.period));
          }
          return Array.from(allMonths).sort().map(ym => {
            const row = { period: thaiFormatYearMonth(ym) };
            for (const wb of data.waterbodies) {
              const m = (data.monthlySummary[wb] || []).find(x => x.period === ym);
              row[wb] = m?.[p] != null ? Math.round(m[p] * 1000) / 1000 : null;
            }
            return row;
          });
        })();

        const std = data.standards[p];
        return (
          <Card key={p}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle1" fontWeight="bold">{PARAM_LABELS[p]}</Typography>
                {std && (
                  <Chip size="small" label={
                    `มาตรฐาน MRC: ${std.min != null ? `≥${std.min}` : ''}${std.min != null && std.max != null ? ' และ ' : ''}${std.max != null ? `≤${std.max}` : ''} ${std.unit}`
                  } />
                )}
              </Box>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ReTooltip />
                  <Legend />
                  {std?.min != null && <ReferenceLine y={std.min} stroke="#c62828" strokeDasharray="3 3" />}
                  {std?.max != null && <ReferenceLine y={std.max} stroke="#c62828" strokeDasharray="3 3" />}
                  {data.waterbodies.map(wb => (
                    <Line key={wb} type="monotone" dataKey={wb} stroke={WATERBODY_COLORS[wb]} strokeWidth={2} connectNulls dot={{ r: 2 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
function ComplianceTab({ data }) {
  return (
    <Stack spacing={2}>
      {data.waterbodies.map(wb => {
        const rows = Object.entries(data.compliance[wb]).map(([p, c]) => ({
          param: p,
          label: PARAM_LABELS[p],
          ...c,
          passRate: c.total > 0 ? Math.round((c.pass / c.total) * 100) : 0,
        }));
        return (
          <Card key={wb}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ color: WATERBODY_COLORS[wb] }} gutterBottom>
                {wb}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>พารามิเตอร์</TableCell>
                      <TableCell align="center">ผ่าน</TableCell>
                      <TableCell align="center">เตือน</TableCell>
                      <TableCell align="center">วิกฤต</TableCell>
                      <TableCell align="center">% ผ่านมาตรฐาน</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.param}>
                        <TableCell>{r.label}</TableCell>
                        <TableCell align="center" sx={{ color: '#2e7d32' }}>{r.pass}</TableCell>
                        <TableCell align="center" sx={{ color: '#ef6c00' }}>{r.warning}</TableCell>
                        <TableCell align="center" sx={{ color: '#c62828' }}>{r.critical}</TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={`${r.passRate}%`}
                            sx={{
                              bgcolor: r.passRate >= 90 ? '#c8e6c9' : r.passRate >= 70 ? '#fff9c4' : '#ffcdd2',
                              fontWeight: 'bold',
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
function CorrelationTab({ data }) {
  const corr = data.correlations;
  const params = ['temperature', 'pH', 'dissolvedOxygen', 'tss', 'ec', 'arsenic'];

  const chartData = params.map(p => ({
    param: PARAM_LABELS[p],
    fishCount: corr.vsFishCount[p] ?? 0,
    speciesRichness: corr.vsSpeciesRichness[p] ?? 0,
  }));

  const interpret = (r) => {
    if (r == null) return { label: 'ไม่มีข้อมูล', color: '#9e9e9e' };
    const abs = Math.abs(r);
    if (abs >= 0.7) return { label: r > 0 ? 'สัมพันธ์บวกแรง' : 'สัมพันธ์ลบแรง', color: r > 0 ? '#2e7d32' : '#c62828' };
    if (abs >= 0.4) return { label: r > 0 ? 'สัมพันธ์บวกปานกลาง' : 'สัมพันธ์ลบปานกลาง', color: r > 0 ? '#66bb6a' : '#ef6c00' };
    if (abs >= 0.2) return { label: 'สัมพันธ์อ่อน', color: '#fbc02d' };
    return { label: 'ไม่พบสัมพันธ์', color: '#9e9e9e' };
  };

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Pearson correlation coefficient (r) — {corr.note} · n = {corr.n}
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            ค่า correlation กับปลา (แม่น้ำโขง)
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="param" tick={{ fontSize: 11 }} />
              <YAxis domain={[-1, 1]} tick={{ fontSize: 12 }} />
              <ReTooltip formatter={(v) => v?.toFixed(3)} />
              <Legend />
              <ReferenceLine y={0} stroke="#000" />
              <Bar dataKey="fishCount" name="vs จำนวนปลา" fill="#1976d2" />
              <Bar dataKey="speciesRichness" name="vs Species Richness" fill="#f57c00" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>ตารางสรุป</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>พารามิเตอร์</TableCell>
                  <TableCell align="right">r (vs จำนวนปลา)</TableCell>
                  <TableCell>ระดับ</TableCell>
                  <TableCell align="right">r (vs Species Richness)</TableCell>
                  <TableCell>ระดับ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {params.map(p => {
                  const r1 = corr.vsFishCount[p];
                  const r2 = corr.vsSpeciesRichness[p];
                  const i1 = interpret(r1);
                  const i2 = interpret(r2);
                  return (
                    <TableRow key={p}>
                      <TableCell>{PARAM_LABELS[p]}</TableCell>
                      <TableCell align="right">{r1?.toFixed(3) ?? '-'}</TableCell>
                      <TableCell><Chip size="small" label={i1.label} sx={{ bgcolor: i1.color + '20', color: i1.color, fontWeight: 'bold' }} /></TableCell>
                      <TableCell align="right">{r2?.toFixed(3) ?? '-'}</TableCell>
                      <TableCell><Chip size="small" label={i2.label} sx={{ bgcolor: i2.color + '20', color: i2.color, fontWeight: 'bold' }} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
function AnomalyTab({ data }) {
  return (
    <Stack spacing={2}>
      <Alert severity="warning" icon={<WarningAmber />}>
        Anomaly Detection ด้วย Z-score threshold = 2.5 — ค่าเบี่ยงเบนเกิน 2.5 SD ถือเป็น outlier
      </Alert>
      {data.waterbodies.map(wb => {
        const wbAnomalies = data.anomalies[wb];
        const allAnomalies = [];
        for (const [p, arr] of Object.entries(wbAnomalies)) {
          arr.forEach(a => allAnomalies.push({ ...a, param: p, paramLabel: PARAM_LABELS[p] }));
        }
        allAnomalies.sort((a, b) => new Date(b.fullDate) - new Date(a.fullDate));

        return (
          <Card key={wb}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ color: WATERBODY_COLORS[wb] }} gutterBottom>
                {wb} — พบ {allAnomalies.length} anomaly
              </Typography>
              {allAnomalies.length === 0 ? (
                <Alert severity="success">ไม่พบค่าผิดปกติ</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>วันที่</TableCell>
                        <TableCell>พารามิเตอร์</TableCell>
                        <TableCell align="right">ค่าที่วัดได้</TableCell>
                        <TableCell align="right">Z-score</TableCell>
                        <TableCell>ระดับ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allAnomalies.map((a, i) => {
                        const absZ = Math.abs(a.zscore);
                        const level = absZ > 4 ? { label: 'วิกฤต', color: '#c62828' } :
                                       absZ > 3 ? { label: 'สูงมาก', color: '#ef6c00' } :
                                                  { label: 'ผิดปกติ', color: '#fbc02d' };
                        return (
                          <TableRow key={i}>
                            <TableCell>{a.fullDate}</TableCell>
                            <TableCell>{a.paramLabel}</TableCell>
                            <TableCell align="right">{a.value?.toFixed(3)}</TableCell>
                            <TableCell align="right">{a.zscore > 0 ? '+' : ''}{a.zscore}</TableCell>
                            <TableCell>
                              <Chip size="small" label={level.label} sx={{ bgcolor: level.color + '20', color: level.color, fontWeight: 'bold' }} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

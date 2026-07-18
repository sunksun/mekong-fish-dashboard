'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Container, Typography, Card, CardContent, Grid, CircularProgress,
  Alert, Slider, Chip, FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Divider, ToggleButton, ToggleButtonGroup, Stack,
} from '@mui/material';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Public, WarningAmber, InfoOutlined } from '@mui/icons-material';
import { authFetch } from '@/lib/api-client';
import {
  ENSO_SCENARIOS,
  ensoCategory,
  seasonalEncode,
  predictMLR,
  predictCI,
  ymAddMonths,
} from '@/lib/enso-helpers';
import { thaiFormatYearMonth } from '@/lib/date-format';

const INDEX_META = {
  H: { label: "Shannon (H')", color: '#1976d2', desc: 'ความหลากหลาย — สูง=หลากหลายมาก' },
  D: { label: "Simpson (1-D)", color: '#388e3c', desc: 'ความเด่นของชนิด — สูง=กระจาย' },
  S: { label: 'Species Richness (S)', color: '#f57c00', desc: 'จำนวนชนิดที่พบ' },
};

export default function EnsoForecastReportContent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scenarioOni, setScenarioOni] = useState(2.0);
  const [horizon, setHorizon] = useState(12);
  const [oniLag, setOniLag] = useState(3);

  useEffect(() => {
    setLoading(true);
    authFetch(`/api/reports/enso-forecast?oniLag=${oniLag}`)
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error || 'API error');
        setData(json);
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [oniLag]);

  const category = useMemo(() => ensoCategory(scenarioOni), [scenarioOni]);
  const latestOni = data?.oni?.latest?.oni;
  const currentCategory = latestOni != null ? ensoCategory(latestOni) : null;

  // Build forecast series for one index
  const buildSeries = (indexKey) => {
    if (!data || !data.models?.[indexKey] || !data.history?.length) return null;
    const model = data.models[indexKey];
    const history = data.history;
    const lastYm = history[history.length - 1].ym;
    const waterClim = data.waterClimatology || {};

    // historical points (actual + fitted)
    const histPoints = history.map(r => {
      const yHat = predictMLR(model, [r.oniLag, r.waterAnom, r.monthSin, r.monthCos]);
      return {
        period: thaiFormatYearMonth(r.ym),
        actual: round(r[indexKey]),
        fitted: round(yHat),
      };
    });

    // forecast points — assume water_anom = 0 (climatology), monthly seasonal, ONI = scenarioOni
    const forecastPoints = [];
    let curYm = lastYm;
    for (let i = 1; i <= horizon; i++) {
      curYm = ymAddMonths(curYm, 1);
      const m = Number(curYm.split('-')[1]);
      const { sin, cos } = seasonalEncode(m);
      const x = [scenarioOni, 0, sin, cos];
      const yHat = predictMLR(model, x);
      const [lo, hi] = predictCI(model, x);
      forecastPoints.push({
        period: thaiFormatYearMonth(curYm),
        forecast: round(yHat),
        ciLow: round(lo),
        ciHigh: round(hi),
      });
    }

    return {
      chartData: [...histPoints, ...forecastPoints],
      lastHistPeriod: thaiFormatYearMonth(lastYm),
      model,
      forecastMean: avg(forecastPoints.map(p => p.forecast)),
    };
  };

  const seriesH = useMemo(() => buildSeries('H'), [data, scenarioOni, horizon]);
  const seriesD = useMemo(() => buildSeries('D'), [data, scenarioOni, horizon]);
  const seriesS = useMemo(() => buildSeries('S'), [data, scenarioOni, horizon]);

  // Neutral baseline for comparison table
  const neutralMeans = useMemo(() => {
    if (!data) return null;
    return ['H', 'D', 'S'].reduce((acc, k) => {
      const m = data.models[k];
      if (!m) return acc;
      const history = data.history;
      const lastYm = history[history.length - 1].ym;
      const vals = [];
      let curYm = lastYm;
      for (let i = 1; i <= horizon; i++) {
        curYm = ymAddMonths(curYm, 1);
        const mo = Number(curYm.split('-')[1]);
        const { sin, cos } = seasonalEncode(mo);
        vals.push(predictMLR(m, [0, 0, sin, cos]));
      }
      acc[k] = avg(vals);
      return acc;
    }, {});
  }, [data, horizon]);

  const scenarioMeans = useMemo(() => ({
    H: seriesH?.forecastMean,
    D: seriesD?.forecastMean,
    S: seriesS?.forecastMean,
  }), [seriesH, seriesD, seriesS]);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box display="flex" alignItems="center" gap={2} mb={1}>
        <Public sx={{ fontSize: 36, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight="bold">
            พยากรณ์ความหลากหลายปลาภายใต้สถานการณ์ ENSO
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Multiple Linear Regression: ONI + Water-Level Anomaly + Seasonality → H&apos;, 1-D, S
          </Typography>
        </Box>
      </Box>

      <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 2 }}>
        หน้านี้ใช้ดัชนี <strong>ONI (Oceanic Niño Index)</strong> จาก NOAA CPC ผสมกับข้อมูลระดับน้ำและการจับปลาในระบบ
        เพื่อจำลองว่า <strong>หากเกิด El Niño (หรือ Super El Niño)</strong> ในอนาคต ดัชนีความหลากหลายปลาจะเปลี่ยนแปลงอย่างไร
      </Alert>

      <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight="bold" gutterBottom>
          🔬 บริบทของงานวิจัย — ระยะที่ 1 (1 ปี)
        </Typography>
        <Typography variant="body2">
          ผลในระยะนี้เป็น <strong>&ldquo;ผลเบื้องต้น (Preliminary)&rdquo;</strong> สำหรับใช้ประกอบการประชุมหารือ
          แนวทางอนุรักษ์พันธุ์ปลา การวางแผนการประมง และการปิดโครงการระยะที่ 1
          <br />
          ⚠️ <strong>ไม่ควรใช้เป็นข้อสรุปเชิงนโยบายเดี่ยว</strong> — ควรประกอบกับความเห็นผู้เชี่ยวชาญในพื้นที่และข้อมูลภาคสนามอื่นๆ
          <br />
          ความน่าเชื่อถือจะสูงขึ้นเมื่อเก็บข้อมูลครบ 24-36 เดือน (ครอบคลุม 2-3 รอบฤดูกาล)
        </Typography>
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : !data ? null : (
        <>
          {/* Current ENSO status */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">สถานะ ENSO ล่าสุด (NOAA)</Typography>
                  {data.oni.latest ? (
                    <>
                      <Typography variant="h4" sx={{ color: currentCategory.color, fontWeight: 'bold' }}>
                        ONI = {data.oni.latest.oni.toFixed(2)}
                      </Typography>
                      <Chip
                        label={currentCategory.label}
                        sx={{ bgcolor: currentCategory.color, color: 'white', mt: 0.5 }}
                        size="small"
                      />
                      <Typography variant="caption" display="block" mt={0.5}>
                        ค่าเฉลี่ย 3 เดือนสิ้นสุด {thaiFormatYearMonth(data.oni.latest.ym)}
                      </Typography>
                    </>
                  ) : (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      ไม่สามารถดึงข้อมูล ONI จาก NOAA ได้ — โมเดลฟิตจากข้อมูล historical เท่านั้น
                    </Alert>
                  )}
                </Grid>
                <Grid item xs={12} md={8}>
                  <Typography variant="caption" color="text.secondary">
                    ค่าอ้างอิง: ≥+0.5 = El Niño · ≥+1.5 = กำลังแรง · ≥+2.0 = Super El Niño · ≤−0.5 = La Niña
                  </Typography>
                  <Typography variant="body2" mt={1}>
                    เหตุการณ์ Super El Niño ในอดีต (1997-98, 2015-16) ทำให้ลุ่มน้ำโขงเกิดภาวะแล้ง ระดับน้ำต่ำกว่าปกติ
                    ส่งผลให้แหล่งวางไข่และที่อยู่อาศัยของปลาลดลง
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Scenario controls */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                เลือกสถานการณ์พยากรณ์
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
                {ENSO_SCENARIOS.map(s => (
                  <Chip
                    key={s.key}
                    label={`${s.label} (ONI ${s.oni >= 0 ? '+' : ''}${s.oni})`}
                    onClick={() => setScenarioOni(s.oni)}
                    color={Math.abs(scenarioOni - s.oni) < 0.01 ? 'primary' : 'default'}
                    variant={Math.abs(scenarioOni - s.oni) < 0.01 ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" gutterBottom>
                    ปรับค่า ONI: <strong style={{ color: category.color }}>{scenarioOni.toFixed(2)} — {category.label}</strong>
                  </Typography>
                  <Slider
                    value={scenarioOni}
                    onChange={(_, v) => setScenarioOni(v)}
                    min={-3} max={3} step={0.1}
                    marks={[
                      { value: -2, label: 'La Niña' },
                      { value: 0, label: '0' },
                      { value: 2, label: 'Super El Niño' },
                    ]}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>ช่วงพยากรณ์</InputLabel>
                    <Select value={horizon} label="ช่วงพยากรณ์" onChange={e => setHorizon(e.target.value)}>
                      <MenuItem value={6}>6 เดือน</MenuItem>
                      <MenuItem value={12}>12 เดือน</MenuItem>
                      <MenuItem value={18}>18 เดือน</MenuItem>
                      <MenuItem value={24}>24 เดือน</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>หน่วงเวลา ONI</InputLabel>
                    <Select value={oniLag} label="หน่วงเวลา ONI" onChange={e => setOniLag(e.target.value)}>
                      <MenuItem value={0}>0 เดือน</MenuItem>
                      <MenuItem value={3}>3 เดือน (แนะนำ)</MenuItem>
                      <MenuItem value={6}>6 เดือน</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Data quality tier banner */}
          {data.meta.dataTier && (
            <Alert
              severity={data.meta.dataTier.severity}
              icon={<InfoOutlined />}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2" fontWeight="bold" component="span">
                📊 ระดับความน่าเชื่อถือ: {data.meta.dataTier.label}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {data.meta.dataTier.message}
              </Typography>
            </Alert>
          )}

          {/* Auto narrative */}
          {neutralMeans && scenarioMeans.H != null && (
            <Card sx={{ mb: 3, bgcolor: '#fff8e1' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  🧭 สรุปอัตโนมัติ — {category.label} (ONI = {scenarioOni.toFixed(1)}) เทียบสภาวะปกติ
                </Typography>
                <Typography variant="body2">
                  ภายในช่วง {horizon} เดือนข้างหน้า:
                </Typography>
                <ul style={{ marginTop: 4, marginBottom: 0 }}>
                  {['H', 'D', 'S'].map(k => {
                    const cur = scenarioMeans[k];
                    const base = neutralMeans[k];
                    if (cur == null || base == null || base === 0) return null;
                    const pct = ((cur - base) / Math.abs(base)) * 100;
                    const arrow = pct > 1 ? '🔺' : pct < -1 ? '🔻' : '➡️';
                    return (
                      <li key={k}>
                        <Typography variant="body2" component="span">
                          ดัชนี <strong>{INDEX_META[k].label}</strong> คาดว่าจะ
                          <span style={{ color: pct < -1 ? '#c62828' : pct > 1 ? '#2e7d32' : '#616161', fontWeight: 'bold' }}>
                            {' '}{arrow} {pct >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'} {Math.abs(pct).toFixed(1)}%
                          </span>
                          {' '}(จาก {base.toFixed(2)} → {cur.toFixed(2)})
                        </Typography>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 3 forecast charts */}
          {['H', 'D', 'S'].map(k => {
            const s = k === 'H' ? seriesH : k === 'D' ? seriesD : seriesS;
            if (!s) return null;
            const meta = INDEX_META[k];
            return (
              <Card key={k} sx={{ mb: 3 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">{meta.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{meta.desc}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" label={`R² = ${s.model.r2.toFixed(3)}`} />
                      <Chip size="small" label={`n = ${s.model.n}`} variant="outlined" />
                    </Stack>
                  </Box>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={s.chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ReTooltip />
                      <Legend />
                      <ReferenceLine x={s.lastHistPeriod} stroke="#999" strokeDasharray="5 5" label={{ value: 'ปัจจุบัน', position: 'top', fill: '#666', fontSize: 11 }} />
                      <Area type="monotone" dataKey="ciHigh" stroke="none" fill={meta.color} fillOpacity={0.1} name="CI 95% บน" />
                      <Area type="monotone" dataKey="ciLow" stroke="none" fill="#fff" fillOpacity={1} name="CI 95% ล่าง" />
                      <Line type="monotone" dataKey="actual" stroke={meta.color} strokeWidth={2} dot={{ r: 2 }} name="ค่าจริง" connectNulls />
                      <Line type="monotone" dataKey="fitted" stroke="#999" strokeDasharray="4 4" dot={false} name="ค่าฟิต" />
                      <Line type="monotone" dataKey="forecast" stroke={meta.color} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} name={`พยากรณ์ (ONI=${scenarioOni.toFixed(1)})`} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })}

          {/* Comparison table */}
          {neutralMeans && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  เปรียบเทียบค่าเฉลี่ย {horizon} เดือนข้างหน้า
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ดัชนี</TableCell>
                        <TableCell align="right">Neutral (ONI=0)</TableCell>
                        <TableCell align="right">{category.label} (ONI={scenarioOni.toFixed(1)})</TableCell>
                        <TableCell align="right">% เปลี่ยน</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {['H', 'D', 'S'].map(k => {
                        const base = neutralMeans[k];
                        const cur = scenarioMeans[k];
                        if (base == null || cur == null) return null;
                        const pct = ((cur - base) / Math.abs(base)) * 100;
                        return (
                          <TableRow key={k}>
                            <TableCell>{INDEX_META[k].label}</TableCell>
                            <TableCell align="right">{base.toFixed(3)}</TableCell>
                            <TableCell align="right">{cur.toFixed(3)}</TableCell>
                            <TableCell align="right" sx={{ color: pct < -1 ? '#c62828' : pct > 1 ? '#2e7d32' : '#666', fontWeight: 'bold' }}>
                              {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 2 }}>
            <strong>ข้อจำกัด:</strong> โมเดลฟิตจากข้อมูลย้อนหลังจำกัด สถานการณ์ Super El Niño (ONI ≥ +2)
            อาจเป็นการ extrapolate นอกช่วงข้อมูลจริง ช่วงความเชื่อมั่นจึงกว้าง
            ผลพยากรณ์ควรใช้ประกอบการวางแผนเท่านั้น ไม่ใช่ข้อสรุปเชิงนโยบาย
          </Alert>

          <Card sx={{ mb: 2, bgcolor: '#e8f5e9' }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                💡 แนวทางการนำผลไปใช้ในการประชุมปิดโครงการระยะที่ 1
              </Typography>
              <Typography variant="body2" component="div">
                <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 20 }}>
                  <li>ใช้เป็น <strong>ข้อมูลตั้งต้น (baseline)</strong> ในการอภิปรายแนวทางอนุรักษ์พันธุ์ปลาเสี่ยง</li>
                  <li>นำเสนอเป็น <strong>สถานการณ์จำลอง (scenario)</strong> ให้ชุมชนเข้าใจผลกระทบจาก ENSO</li>
                  <li>ประกอบ <strong>การวางแผนปฏิทินการประมง</strong> ในช่วงที่คาดว่าจะมี El Niño</li>
                  <li>ใช้ระบุ <strong>ข้อเสนอวิจัยระยะที่ 2</strong> เช่น ตัวแปรเพิ่มเติม (rainfall, DO) ที่ควรเก็บ</li>
                  <li>ผลที่ได้ <strong>ต้องยืนยันด้วยข้อมูลภาคสนาม</strong> และการสัมภาษณ์ชาวประมงผู้มีประสบการณ์</li>
                </ul>
              </Typography>
            </CardContent>
          </Card>
        </>
      )}
    </Container>
  );
}

function round(v, d = 3) {
  if (v == null || isNaN(v)) return null;
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

function avg(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

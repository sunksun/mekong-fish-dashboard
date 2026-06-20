'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Container, Typography, Card, CardContent, Grid, CircularProgress,
  Alert, ToggleButtonGroup, ToggleButton, Chip, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { TrendingUp } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getRecordDate, getFishCount, getFishName, isExcludedSpecies } from '@/lib/firestore-helpers';
import { toThaiYear } from '@/lib/date-format';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const COLORS = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828', '#00838f', '#558b2f', '#e65100', '#283593', '#4e342e'];

export default function TrendsPage() {
  const [mode, setMode] = useState('species');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getDocs(collection(db, 'fishingRecords'))
      .then(snap => {
        // Build: { year-month: { speciesName: count } }
        const byMonth = {};
        const byYear = {};
        const speciesMonthly = {}; // species -> { month -> count } for seasonal

        snap.forEach(doc => {
          const d = doc.data();
          const ts = getRecordDate(d);
          if (!ts) return;
          const y = ts.getFullYear();
          const mo = ts.getMonth(); // 0-based
          const monthKey = `${y}-${String(mo + 1).padStart(2, '0')}`;
          const yearKey = String(y);

          if (!byMonth[monthKey]) byMonth[monthKey] = {};
          if (!byYear[yearKey]) byYear[yearKey] = {};

          (d.fishList || []).forEach(f => {
            const name = getFishName(f);
            if (isExcludedSpecies(name)) return; // ตัดกุ้งออกจากรายงาน
            const count = getFishCount(f);
            byMonth[monthKey][name] = (byMonth[monthKey][name] || 0) + count;
            byYear[yearKey][name] = (byYear[yearKey][name] || 0) + count;
            if (!speciesMonthly[name]) speciesMonthly[name] = Array(12).fill(0);
            speciesMonthly[name][mo] += count;
          });
        });

        setRawData({ byMonth, byYear, speciesMonthly });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Top 8 species overall
  const topSpecies = useMemo(() => {
    if (!rawData) return [];
    const totals = {};
    Object.values(rawData.byYear).forEach(yearData => {
      Object.entries(yearData).forEach(([name, count]) => {
        totals[name] = (totals[name] || 0) + count;
      });
    });
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name]) => name);
  }, [rawData]);

  // Species composition over time (yearly stacked)
  const yearlyComposition = useMemo(() => {
    if (!rawData) return [];
    return Object.entries(rawData.byYear)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([yr, speciesMap]) => {
        const total = Object.values(speciesMap).reduce((a, b) => a + b, 0);
        const row = { year: String(toThaiYear(yr)), total };
        topSpecies.forEach(sp => {
          row[sp] = speciesMap[sp] || 0;
          row[`${sp}_pct`] = total > 0 ? Math.round(((speciesMap[sp] || 0) / total) * 1000) / 10 : 0;
        });
        return row;
      });
  }, [rawData, topSpecies]);

  // Seasonal pattern — selected year monthly
  const monthlyForYear = useMemo(() => {
    if (!rawData) return [];
    return MONTH_LABELS.map((label, i) => {
      const mo = String(i + 1).padStart(2, '0');
      const key = `${year}-${mo}`;
      const speciesMap = rawData.byMonth[key] || {};
      const total = Object.values(speciesMap).reduce((a, b) => a + b, 0);
      const row = { month: label, total };
      topSpecies.forEach(sp => {
        row[sp] = speciesMap[sp] || 0;
      });
      return row;
    });
  }, [rawData, year, topSpecies]);

  // Seasonal pattern across all years
  const seasonalPattern = useMemo(() => {
    if (!rawData) return [];
    return MONTH_LABELS.map((label, i) => {
      const totalPerMonth = Object.keys(rawData.byYear).length || 1;
      let sum = 0;
      Object.keys(rawData.byYear).forEach(yr => {
        const mo = String(i + 1).padStart(2, '0');
        const key = `${yr}-${mo}`;
        const speciesMap = rawData.byMonth[key] || {};
        sum += Object.values(speciesMap).reduce((a, b) => a + b, 0);
      });
      return { month: label, avgCatch: Math.round(sum / totalPerMonth) };
    });
  }, [rawData]);

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <TrendingUp sx={{ fontSize: 36, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">แนวโน้มประชากรปลา</Typography>
            <Typography variant="body2" color="text.secondary">
              การเปลี่ยนแปลงองค์ประกอบชนิดพันธุ์และรูปแบบฤดูกาล
            </Typography>
          </Box>
        </Box>

        {/* Mode tabs */}
        <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
          <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)} size="small">
            <ToggleButton value="species">องค์ประกอบชนิดพันธุ์</ToggleButton>
            <ToggleButton value="seasonal">รูปแบบฤดูกาล</ToggleButton>
          </ToggleButtonGroup>
          {mode === 'seasonal' && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>ปี</InputLabel>
              <Select value={year} label="ปี" onChange={e => setYear(e.target.value)}>
                {YEAR_OPTIONS.map(y => (
                  <MenuItem key={y} value={String(y)}>{toThaiYear(y)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        ) : (
          <>
            {mode === 'species' ? (
              <>
                {/* Stacked bar — absolute count */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                      จำนวนปลาที่จับได้ตามชนิดพันธุ์ รายปี (8 ชนิดหลัก)
                    </Typography>
                    {yearlyComposition.length === 0 ? (
                      <Alert severity="info">ไม่พบข้อมูล</Alert>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={yearlyComposition} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <ReTooltip />
                          <Legend />
                          {topSpecies.map((sp, i) => (
                            <Bar key={sp} dataKey={sp} name={sp} stackId="a" fill={COLORS[i % COLORS.length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Line chart — species count trend */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                      แนวโน้มจำนวนชนิดปลาหลัก รายปี
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={yearlyComposition} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <ReTooltip />
                        <Legend />
                        {topSpecies.map((sp, i) => (
                          <Line key={sp} type="monotone" dataKey={sp} name={sp}
                            stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Summary table */}
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                      สรุปการเปลี่ยนแปลงชนิดพันธุ์ รายปี
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell>ปี</TableCell>
                            <TableCell align="right">รวม (ตัว)</TableCell>
                            {topSpecies.slice(0, 5).map(sp => (
                              <TableCell key={sp} align="right">{sp}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {yearlyComposition.map(row => (
                            <TableRow key={row.year} hover>
                              <TableCell>{row.year}</TableCell>
                              <TableCell align="right">{row.total}</TableCell>
                              {topSpecies.slice(0, 5).map(sp => (
                                <TableCell key={sp} align="right">
                                  {row[sp] || 0}
                                  {row.total > 0 && <Typography component="span" variant="caption" color="text.secondary"> ({((row[sp] || 0) / row.total * 100).toFixed(0)}%)</Typography>}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                {/* Monthly stacked for selected year */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                      จำนวนปลาที่จับได้รายเดือน ปี {toThaiYear(year)} แยกตามชนิดพันธุ์
                    </Typography>
                    {monthlyForYear.every(d => d.total === 0) ? (
                      <Alert severity="info">ไม่พบข้อมูลการจับปลาในปี {toThaiYear(year)}</Alert>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={monthlyForYear} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <ReTooltip />
                          <Legend />
                          {topSpecies.map((sp, i) => (
                            <Bar key={sp} dataKey={sp} name={sp} stackId="a" fill={COLORS[i % COLORS.length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Average seasonal pattern across all years */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                      รูปแบบฤดูกาล — จำนวนจับเฉลี่ยต่อเดือน (เฉลี่ยทุกปี)
                    </Typography>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={seasonalPattern} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <ReTooltip />
                        <Area type="monotone" dataKey="avgCatch" name="เฉลี่ย (ตัว)" stroke="#1976d2" fill="#bbdefb" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <Typography variant="caption" color="text.secondary" mt={1} display="block">
                      * เฉลี่ยจากข้อมูลทุกปีที่มีในฐานข้อมูล — ช่วยบ่งชี้ฤดูกาลที่ปลาชุกชุม
                    </Typography>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </Container>
    </DashboardLayout>
  );
}

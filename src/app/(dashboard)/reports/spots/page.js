'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Container, Typography, Card, CardContent, Grid, CircularProgress,
  Alert, Select, MenuItem, FormControl, InputLabel, Chip, Collapse,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Tooltip, Divider
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { LocationOn, ExpandMore, ExpandLess, Phishing } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getRecordDate, getFishName, getFishCount, isExcludedSpecies } from '@/lib/firestore-helpers';
import { toThaiYear } from '@/lib/date-format';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

const MONTH_LABELS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const COLORS = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828', '#00838f', '#558b2f', '#e65100', '#283593', '#4e342e'];

function SpotRow({ spot, rank }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        hover
        sx={{ cursor: 'pointer', '& > td': { borderBottom: open ? 'none' : undefined } }}
        onClick={() => setOpen(o => !o)}
      >
        <TableCell>
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton size="small">{open ? <ExpandLess /> : <ExpandMore />}</IconButton>
            <Chip label={rank} size="small" sx={{ bgcolor: '#e3f2fd', fontWeight: 'bold', minWidth: 32 }} />
          </Box>
        </TableCell>
        <TableCell>
          <Box display="flex" alignItems="center" gap={1}>
            <LocationOn fontSize="small" color="primary" />
            <Typography fontWeight="bold">{spot.spotName}</Typography>
          </Box>
        </TableCell>
        <TableCell align="right">{spot.speciesCount} ชนิด</TableCell>
        <TableCell align="right">{spot.totalCount} ตัว</TableCell>
        <TableCell align="right">{spot.recordCount} ครั้ง</TableCell>
      </TableRow>

      {/* Expanded species breakdown */}
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0, px: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ px: 4, py: 2, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" fontWeight="bold" mb={1} color="text.secondary">
                ชนิดปลาที่จับได้ในจุดนี้
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 280 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#f5f5f5' } }}>
                      <TableCell>อันดับ</TableCell>
                      <TableCell>ชนิดปลา</TableCell>
                      <TableCell align="right">จำนวน (ตัว)</TableCell>
                      <TableCell align="right">น้ำหนัก (กก.)</TableCell>
                      <TableCell align="right">สัดส่วน</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {spot.species.map((fish, i) => (
                      <TableRow key={fish.name} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{fish.name}</TableCell>
                        <TableCell align="right">{fish.count}</TableCell>
                        <TableCell align="right">{fish.weight > 0 ? fish.weight.toFixed(2) : '-'}</TableCell>
                        <TableCell align="right">
                          {spot.totalCount > 0
                            ? ((fish.count / spot.totalCount) * 100).toFixed(1) + '%'
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function SpotsReportPage() {
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [selectedMonth, setSelectedMonth] = useState('all');

  const yearOptions = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

  useEffect(() => {
    setLoading(true);
    getDocs(collection(db, 'fishingRecords'))
      .then(snap => {
        const records = [];
        snap.forEach(doc => {
          const d = doc.data();
          const ts = getRecordDate(d);
          if (!ts) return;
          const spotName = d.location?.spotName || d.location?.address?.province || 'ไม่ระบุจุด';
          records.push({
            spotName,
            year: ts.getFullYear(),
            month: ts.getMonth() + 1,
            fishList: d.fishList || [],
          });
        });
        setAllRecords(records);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Filter records by year and month
  const filtered = useMemo(() => {
    return allRecords.filter(r => {
      if (String(r.year) !== selectedYear) return false;
      if (selectedMonth !== 'all' && r.month !== parseInt(selectedMonth)) return false;
      return true;
    });
  }, [allRecords, selectedYear, selectedMonth]);

  // Aggregate by spot
  const spotsData = useMemo(() => {
    const spotMap = {};
    filtered.forEach(r => {
      if (!spotMap[r.spotName]) {
        spotMap[r.spotName] = { spotName: r.spotName, speciesMap: {}, recordCount: 0 };
      }
      const entry = spotMap[r.spotName];
      entry.recordCount += 1;
      r.fishList.forEach(f => {
        const name = getFishName(f);
        if (isExcludedSpecies(name)) return; // ตัดกุ้งออกจากรายงาน
        const count = getFishCount(f);
        const weight = parseFloat(f.weight) || 0;
        if (!entry.speciesMap[name]) entry.speciesMap[name] = { count: 0, weight: 0 };
        entry.speciesMap[name].count += count;
        entry.speciesMap[name].weight += weight;
      });
    });

    return Object.values(spotMap)
      .map(s => {
        const species = Object.entries(s.speciesMap)
          .sort(([, a], [, b]) => b.count - a.count)
          .map(([name, v]) => ({ name, count: v.count, weight: Math.round(v.weight * 100) / 100 }));
        const totalCount = species.reduce((a, b) => a + b.count, 0);
        return {
          spotName: s.spotName,
          speciesCount: species.length,
          totalCount,
          recordCount: s.recordCount,
          species,
        };
      })
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [filtered]);

  // Chart data — top 10 spots, species richness + total
  const chartData = useMemo(() => {
    return spotsData.slice(0, 10).map(s => ({
      spot: s.spotName.length > 12 ? s.spotName.slice(0, 12) + '…' : s.spotName,
      'ชนิด (S)': s.speciesCount,
      'จำนวนตัว': s.totalCount,
    }));
  }, [spotsData]);

  const periodLabel = selectedMonth === 'all'
    ? `ปี ${toThaiYear(selectedYear)} (ทุกเดือน)`
    : `${MONTH_LABELS[parseInt(selectedMonth) - 1]} ${toThaiYear(selectedYear)}`;

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <LocationOn sx={{ fontSize: 36, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">สรุปปลาตามจุดจับ</Typography>
            <Typography variant="body2" color="text.secondary">
              จำนวนชนิดและจำนวนปลาที่จับได้ในแต่ละจุด แยกตามเดือน
            </Typography>
          </Box>
        </Box>

        {/* Controls */}
        <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>ปี</InputLabel>
            <Select value={selectedYear} label="ปี" onChange={e => setSelectedYear(e.target.value)}>
              {yearOptions.map(y => (
                <MenuItem key={y} value={String(y)}>{toThaiYear(y)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>เดือน</InputLabel>
            <Select value={selectedMonth} label="เดือน" onChange={e => setSelectedMonth(e.target.value)}>
              <MenuItem value="all">ทุกเดือน</MenuItem>
              {MONTH_LABELS.map((label, i) => (
                <MenuItem key={i + 1} value={String(i + 1)}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {spotsData.length > 0 && (
            <Chip
              label={`${periodLabel} — ${spotsData.length} จุดจับ | ${filtered.length} บันทึก`}
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        ) : spotsData.length === 0 ? (
          <Alert severity="info">ไม่พบข้อมูลในช่วงที่เลือก</Alert>
        ) : (
          <>
            {/* Summary cards */}
            <Grid container spacing={2} mb={3}>
              {[
                { label: 'จุดจับปลา', value: spotsData.length, unit: 'จุด', color: '#1976d2' },
                { label: 'รวมชนิดพันธุ์ (ไม่ซ้ำ)', value: [...new Set(spotsData.flatMap(s => s.species.map(f => f.name)))].length, unit: 'ชนิด', color: '#388e3c' },
                { label: 'รวมจำนวนตัวที่จับ', value: spotsData.reduce((a, b) => a + b.totalCount, 0).toLocaleString(), unit: 'ตัว', color: '#f57c00' },
                { label: 'รวมบันทึก', value: filtered.length, unit: 'ครั้ง', color: '#7b1fa2' },
              ].map(c => (
                <Grid item xs={6} sm={3} key={c.label}>
                  <Card sx={{ borderTop: `4px solid ${c.color}` }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                      <Typography variant="h5" fontWeight="bold" sx={{ color: c.color }}>{c.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.unit}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Bar chart */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  เปรียบเทียบจุดจับ (Top 10) — {periodLabel}
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="spot" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
                    <YAxis yAxisId="count" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="species" orientation="right" tick={{ fontSize: 12 }} />
                    <ReTooltip />
                    <Legend />
                    <Bar yAxisId="count" dataKey="จำนวนตัว" fill="#90caf9" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="species" dataKey="ชนิด (S)" fill="#a5d6a7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Detail table */}
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  รายละเอียดแต่ละจุดจับ — คลิกแถวเพื่อดูชนิดปลา
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell width={80}></TableCell>
                        <TableCell>จุดจับปลา</TableCell>
                        <TableCell align="right">จำนวนชนิด</TableCell>
                        <TableCell align="right">จำนวนตัว</TableCell>
                        <TableCell align="right">จำนวนบันทึก</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {spotsData.map((spot, i) => (
                        <SpotRow key={spot.spotName} spot={spot} rank={i + 1} />
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}
      </Container>
    </DashboardLayout>
  );
}

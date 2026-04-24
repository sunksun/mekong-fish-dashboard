'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { Search, SetMeal, Scale, FormatListNumbered } from '@mui/icons-material';
import Link from 'next/link';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

function getDateRange(month, beYear) {
  if (beYear === 0) return {};
  const ceYear = beYear - 543;
  if (month === 0) {
    return { minDate: `${ceYear}-01-01`, maxDate: `${ceYear + 1}-01-01` };
  }
  const start = new Date(ceYear, month - 1, 1);
  const end = new Date(ceYear, month, 1);
  return {
    minDate: start.toISOString().split('T')[0],
    maxDate: end.toISOString().split('T')[0],
  };
}

export default function CaughtFishDatabasePage() {
  const { hasAnyRole } = useAuth();
  const canView = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT]);

  const nowCE = new Date();
  const currentBEYear = nowCE.getFullYear() + 543;
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedYear, setSelectedYear] = useState(0);

  const yearOptions = [{ value: 0, label: 'ทุกปี' }];
  for (let y = 2568; y <= currentBEYear; y++) yearOptions.push({ value: y, label: String(y) });

  const periodLabel = selectedYear === 0
    ? 'ทุกปี'
    : selectedMonth === 0
      ? `ปี พ.ศ. ${selectedYear}`
      : `${THAI_MONTHS[selectedMonth - 1]} พ.ศ. ${selectedYear}`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ totalSpecies: 0, totalCount: 0, totalWeight: 0, species: [] });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const { minDate, maxDate } = getDateRange(selectedMonth, selectedYear);
    const params = new URLSearchParams();
    if (minDate) params.set('minDate', minDate);
    if (maxDate) params.set('maxDate', maxDate);
    const q = params.toString() ? `?${params.toString()}` : '';

    fetch(`/api/fishing-records/caught-species${q}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res);
        else setError(res.error || 'โหลดข้อมูลไม่สำเร็จ');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedMonth, selectedYear]);

  const filtered = data.species.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.localName && s.localName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!canView) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 2 }}>
          <Alert severity="error">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</Alert>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 1, pl: 1.5 }}>
        {/* Header */}
        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h4" gutterBottom>
                ฐานข้อมูลปลาที่จับได้
              </Typography>
              <Typography variant="body1" color="text.secondary">
                สรุปชนิดปลาและจำนวนที่จับได้จากบันทึกการจับปลาในแม่น้ำโขง
              </Typography>
            </Box>
            {/* Date filters */}
            <Box display="flex" gap={1}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>เดือน</InputLabel>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  label="เดือน"
                >
                  <MenuItem value={0}>แสดงทั้งหมด</MenuItem>
                  {THAI_MONTHS.map((name, idx) => (
                    <MenuItem key={idx + 1} value={idx + 1}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>ปี พ.ศ.</InputLabel>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  label="ปี พ.ศ."
                >
                  {yearOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Summary cards */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <SetMeal color="primary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="primary.main">
                      {loading ? '—' : data.totalSpecies.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">ชนิดปลาที่พบ</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <FormatListNumbered color="success" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {loading ? '—' : data.totalCount.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">จำนวนรวม (ตัว)</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Scale color="warning" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {loading ? '—' : data.totalWeight.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">น้ำหนักรวม (กก.)</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Search + Table */}
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                รายชื่อปลาที่จับได้{' '}
                <Box component="span" sx={{ fontWeight: 'normal', color: 'text.secondary', fontSize: '0.85em' }}>
                  {periodLabel}
                </Box>
              </Typography>
              <TextField
                size="small"
                placeholder="ค้นหาชื่อปลา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 240 }}
              />
            </Box>

            {loading ? (
              <Box display="flex" justifyContent="center" py={6}>
                <CircularProgress />
              </Box>
            ) : filtered.length === 0 ? (
              <Box display="flex" justifyContent="center" py={6}>
                <Typography color="text.secondary">ไม่พบข้อมูล</Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell align="center" width={60}><strong>ลำดับ</strong></TableCell>
                      <TableCell><strong>ชื่อปลา</strong></TableCell>
                      <TableCell align="right"><strong>จำนวน (ตัว)</strong></TableCell>
                      <TableCell align="right"><strong>น้ำหนักรวม (กก.)</strong></TableCell>
                      <TableCell align="right"><strong>จำนวนครั้งที่พบ</strong></TableCell>
                      <TableCell align="center"><strong>สัดส่วน</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((row, idx) => {
                      const pct = data.totalCount > 0
                        ? ((row.count / data.totalCount) * 100).toFixed(1)
                        : 0;
                      return (
                        <TableRow key={row.name} hover>
                          <TableCell align="center">{idx + 1}</TableCell>
                          <TableCell>
                            <Link
                              href={`/fish-species/caught/${encodeURIComponent(row.name)}`}
                              style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                              <Typography
                                variant="body2"
                                fontWeight="medium"
                                sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                              >
                                {row.name}
                                {row.localName && (
                                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                    ({row.localName})
                                  </Typography>
                                )}
                              </Typography>
                            </Link>
                          </TableCell>
                          <TableCell align="right">{row.count.toLocaleString()}</TableCell>
                          <TableCell align="right">{row.totalWeight.toLocaleString()}</TableCell>
                          <TableCell align="right">{row.recordCount.toLocaleString()}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${pct}%`}
                              size="small"
                              color={idx === 0 ? 'primary' : 'default'}
                              variant={idx === 0 ? 'filled' : 'outlined'}
                            />
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
      </Box>
    </DashboardLayout>
  );
}

'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Alert,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Paper
} from '@mui/material';
import {
  Agriculture,
  TrendingUp,
  Scale,
  AttachMoney,
  LocationOn,
  Assessment,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { FISH_CATEGORIES, WATER_SOURCES, FISHING_METHODS, USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// Chart colors
const CHART_COLORS = {
  primary: '#1976d2',
  secondary: '#dc004e',
  success: '#2e7d32',
  warning: '#ed6c02',
  info: '#0288d1',
  error: '#d32f2f',
  purple: '#7b1fa2',
  indigo: '#303f9f',
  teal: '#00796b',
  orange: '#f57c00',
  pink: '#c2185b',
  lime: '#689f38'
};

const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.info,
  CHART_COLORS.purple,
  CHART_COLORS.teal,
  CHART_COLORS.orange
];

// Mock analytics data
const mockAnalytics = {
  totalCatches: 1247,
  totalWeight: 3856.7,
  totalValue: 1245680,
  averagePerCatch: 3.1,
  monthlyTrends: [
    { month: 'ม.ค.', catches: 156, weight: 485.2, value: 145680 },
    { month: 'ก.พ.', catches: 134, weight: 423.1, value: 127450 },
    { month: 'มี.ค.', catches: 189, weight: 567.3, value: 167890 },
    { month: 'เม.ย.', catches: 198, weight: 634.8, value: 189340 },
    { month: 'พ.ค.', catches: 223, weight: 712.5, value: 205670 },
    { month: 'มิ.ย.', catches: 201, weight: 658.3, value: 198450 },
    { month: 'ก.ค.', catches: 146, weight: 375.5, value: 211200 }
  ],
  speciesDistribution: [
    { species: 'ปลาน้ำจืด', count: 345, percentage: 27.7, avgWeight: 2.3 },
    { species: 'ปลากด', count: 289, percentage: 23.2, avgWeight: 1.8 },
    { species: 'ปลาสร้อย', count: 156, percentage: 12.5, avgWeight: 4.2 },
    { species: 'ปลาจิ้น', count: 134, percentage: 10.7, avgWeight: 0.8 },
    { species: 'ปลาเค้า', count: 123, percentage: 9.9, avgWeight: 1.5 },
    { species: 'อื่นๆ', count: 200, percentage: 16.0, avgWeight: 2.1 }
  ],
  catchByMethod: [
    { method: FISHING_METHODS.NET, count: 567, percentage: 45.5 },
    { method: FISHING_METHODS.HOOK, count: 289, percentage: 23.2 },
    { method: FISHING_METHODS.TRAP, count: 234, percentage: 18.8 },
    { method: FISHING_METHODS.SPEAR, count: 112, percentage: 9.0 },
    { method: FISHING_METHODS.OTHER, count: 45, percentage: 3.6 }
  ],
  catchByWaterSource: [
    { source: WATER_SOURCES.MAIN_RIVER, count: 678, percentage: 54.4 },
    { source: WATER_SOURCES.TRIBUTARY, count: 345, percentage: 27.7 },
    { source: WATER_SOURCES.POND, count: 134, percentage: 10.7 },
    { source: WATER_SOURCES.LAKE, count: 90, percentage: 7.2 }
  ],
  catchByProvince: [
    { province: 'นครพนม', count: 367, percentage: 29.4, avgValue: 1150 },
    { province: 'อุบลราชธานี', count: 298, percentage: 23.9, avgValue: 1050 },
    { province: 'มุกดาหาร', count: 234, percentage: 18.8, avgValue: 980 },
    { province: 'บึงกาฬ', count: 189, percentage: 15.2, avgValue: 1200 },
    { province: 'หนองคาย', count: 159, percentage: 12.7, avgValue: 1100 }
  ],
  seasonalPatterns: [
    { season: 'ฤดูแล้ง (พ.ย.-เม.ย.)', avgCatch: 167, avgWeight: 4.2, bestSpecies: 'ปลาสร้อย' },
    { season: 'ฤดูฝน (พ.ค.-ต.ค.)', avgCatch: 198, avgWeight: 3.1, bestSpecies: 'ปลากด' }
  ],
  topFishers: [
    { name: 'สมชาย ประมงดี', catches: 45, totalWeight: 98.5, totalValue: 23450 },
    { name: 'สมหญิง จับปลา', catches: 38, totalWeight: 87.3, totalValue: 19870 },
    { name: 'สมศักดิ์ ลุงแม่น้ำ', catches: 32, totalWeight: 76.8, totalValue: 17650 }
  ]
};

const getMethodLabel = (method) => {
  switch (method) {
    case FISHING_METHODS.NET: return 'อวน';
    case FISHING_METHODS.HOOK: return 'เบ็ด';
    case FISHING_METHODS.TRAP: return 'กับดัก';
    case FISHING_METHODS.SPEAR: return 'หอก';
    case FISHING_METHODS.OTHER: return 'อื่นๆ';
    default: return method;
  }
};

const getWaterSourceLabel = (source) => {
  switch (source) {
    case WATER_SOURCES.MAIN_RIVER: return 'แม่น้ำหลัก';
    case WATER_SOURCES.TRIBUTARY: return 'ลำน้ำสาขา';
    case WATER_SOURCES.POND: return 'บึง/หนอง';
    case WATER_SOURCES.LAKE: return 'ทะเลสาบ';
    default: return source;
  }
};

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'primary', trend }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" gap={2}>
        <Avatar sx={{ bgcolor: `${color}.main`, width: 56, height: 56 }}>
          <Icon sx={{ fontSize: 28 }} />
        </Avatar>
        <Box flex={1}>
          <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          {trend && (
            <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
              <TrendingUp sx={{ fontSize: 16, color: trend > 0 ? 'success.main' : 'error.main' }} />
              <Typography variant="caption" color={trend > 0 ? 'success.main' : 'error.main'}>
                {trend > 0 ? '+' : ''}{trend}% จากเดือนที่แล้ว
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

// Returns { minDate?, maxDate? } as ISO strings for a given Buddhist Era month/year.
// beYear = 0 → no date filter (all time)
// month = 0 → entire year
function getDateRange(month, beYear) {
  if (beYear === 0) return {}; // all time — no date constraints
  const ceYear = beYear - 543;
  if (month === 0) {
    return {
      minDate: `${ceYear}-01-01`,
      maxDate: `${ceYear + 1}-01-01`,
    };
  }
  const start = new Date(ceYear, month - 1, 1);
  const end = new Date(ceYear, month, 1); // first day of next month (exclusive)
  return {
    minDate: start.toISOString().split('T')[0],
    maxDate: end.toISOString().split('T')[0],
  };
}

export default function FishingAnalyticsPage() {
  const { userProfile, hasAnyRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(mockAnalytics);

  // Default: ทุกปี / แสดงทั้งหมด — ตรงกับ records page
  const nowCE = new Date();
  const currentBEYear = nowCE.getFullYear() + 543;
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedYear, setSelectedYear] = useState(0);

  // Build year options: ทุกปี + 2568 → current BE year
  const yearOptions = [{ value: 0, label: 'ทุกปี' }];
  for (let y = 2568; y <= currentBEYear; y++) yearOptions.push({ value: y, label: String(y) });

  const periodLabel = selectedYear === 0
    ? 'ทุกปี'
    : selectedMonth === 0
      ? `ปี พ.ศ. ${selectedYear}`
      : `${THAI_MONTHS[selectedMonth - 1]} พ.ศ. ${selectedYear}`;

  const [trends, setTrends] = useState(null); // null = ไม่มีข้อมูลเปรียบเทียบ
  const [charts, setCharts] = useState({
    monthlyTrends: [],
    speciesDistribution: [],
    catchByMethod: [],
    catchByWaterSource: [],
  });

  // Check permissions
  const canViewAnalytics = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  // Returns { minDate?, maxDate? } for the period BEFORE the selected one
  function getPrevDateRange(month, beYear) {
    if (beYear === 0) return null; // ทุกปี — ไม่มีช่วงเปรียบเทียบ
    const ceYear = beYear - 543;
    if (month === 0) {
      // ช่วงก่อนหน้า = ปีก่อน
      return { minDate: `${ceYear - 1}-01-01`, maxDate: `${ceYear}-01-01` };
    }
    // ช่วงก่อนหน้า = เดือนก่อน (อาจข้ามปีได้)
    const prevStart = new Date(ceYear, month - 2, 1);
    const prevEnd = new Date(ceYear, month - 1, 1);
    return {
      minDate: prevStart.toISOString().split('T')[0],
      maxDate: prevEnd.toISOString().split('T')[0],
    };
  }

  function calcTrend(current, previous) {
    if (!previous || previous === 0) return null;
    return parseFloat(((current - previous) / previous * 100).toFixed(1));
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    setTrends(null);

    const { minDate, maxDate } = getDateRange(selectedMonth, selectedYear);
    const params = new URLSearchParams();
    if (minDate) params.set('minDate', minDate);
    if (maxDate) params.set('maxDate', maxDate);
    const query = params.toString() ? `?${params.toString()}` : '';

    const prevRange = getPrevDateRange(selectedMonth, selectedYear);
    const prevQuery = prevRange
      ? `?minDate=${prevRange.minDate}&maxDate=${prevRange.maxDate}`
      : null;

    const fetchCurrent = fetch(`/api/fishing-records/stats${query}`).then(r => r.json());
    const fetchPrev = prevQuery
      ? fetch(`/api/fishing-records/stats${prevQuery}`).then(r => r.json())
      : Promise.resolve(null);

    Promise.all([fetchCurrent, fetchPrev])
      .then(([curr, prev]) => {
        if (!curr.success) throw new Error(curr.message || 'เกิดข้อผิดพลาด');
        const { totalRecords = 0, totalWeight = 0, totalValue = 0 } = curr.stats;
        const avgPerCatch = totalRecords > 0 ? totalWeight / totalRecords : 0;

        setAnalytics((a) => ({
          ...a,
          totalCatches: totalRecords,
          totalWeight: totalWeight,
          totalValue: totalValue,
          averagePerCatch: avgPerCatch,
        }));

        if (prev && prev.success) {
          const p = prev.stats;
          const prevAvg = p.totalRecords > 0 ? p.totalWeight / p.totalRecords : 0;
          setTrends({
            totalCatches: calcTrend(totalRecords, p.totalRecords),
            totalWeight: calcTrend(totalWeight, p.totalWeight),
            totalValue: calcTrend(totalValue, p.totalValue),
            averagePerCatch: calcTrend(avgPerCatch, prevAvg),
          });
        }
      })
      .catch((err) => {
        setError(err.message || 'ไม่สามารถโหลดข้อมูลได้');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedMonth, selectedYear]);

  // Fetch chart data whenever filter changes
  useEffect(() => {
    const { minDate, maxDate } = getDateRange(selectedMonth, selectedYear);
    const params = new URLSearchParams();
    if (minDate) params.set('minDate', minDate);
    if (maxDate) params.set('maxDate', maxDate);
    const q = params.toString() ? `?${params.toString()}` : '';
    fetch(`/api/fishing-records/charts${q}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setCharts(data.charts);
      })
      .catch(() => {});
  }, [selectedMonth, selectedYear]);

  if (!canViewAnalytics) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 1, pl: 1.5 }}>
          <Alert severity="error">
            คุณไม่มีสิทธิ์เข้าถึงการวิเคราะห์ข้อมูลการจับปลา (เฉพาะผู้ดูแลระบบและนักวิจัย)
          </Alert>
        </Box>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 1, pl: 1.5 }}>
          <Typography>กำลังโหลดการวิเคราะห์ข้อมูล...</Typography>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 1, pl: 1.5 }}>
        {/* Header */}
        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" gutterBottom>
                วิเคราะห์ข้อมูลการจับปลา
              </Typography>
              <Typography variant="body1" color="text.secondary">
                การวิเคราะห์และสถิติเชิงลึกของข้อมูลการจับปลาแม่น้ำโขง
              </Typography>
            </Box>
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
              <FormControl size="small" sx={{ minWidth: 100 }}>
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

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Overview Stats */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="การจับปลาทั้งหมด"
              value={analytics.totalCatches}
              subtitle="ครั้ง"
              icon={Agriculture}
              color="primary"
              trend={trends?.totalCatches ?? undefined}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="น้ำหนักรวม"
              value={(analytics.totalWeight ?? 0).toFixed(1)}
              subtitle="กิโลกรัม"
              icon={Scale}
              color="success"
              trend={trends?.totalWeight ?? undefined}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="มูลค่ารวม"
              value={`฿${(analytics.totalValue ?? 0).toLocaleString()}`}
              subtitle="บาท"
              icon={AttachMoney}
              color="warning"
              trend={trends?.totalValue ?? undefined}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="เฉลี่ยต่อครั้ง"
              value={(analytics.averagePerCatch ?? 0).toFixed(1)}
              subtitle="กิโลกรัม/ครั้ง"
              icon={Assessment}
              color="info"
              trend={trends?.averagePerCatch ?? undefined}
            />
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Monthly Trends Chart */}
          <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" fontWeight="bold">
                    แนวโน้มรายเดือน <Box component="span" sx={{ fontWeight: 'normal', color: 'text.secondary', fontSize: '0.85em' }}>{periodLabel}</Box>
                  </Typography>
                </Box>
                {charts.monthlyTrends.length === 0 ? (
                  <Box display="flex" justifyContent="center" p={4}>
                    <Typography color="text.secondary">ไม่มีข้อมูลในช่วงเวลานี้</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={charts.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        label={{ value: 'เดือน', position: 'insideBottom', offset: -5 }}
                        height={50}
                      />
                      <YAxis
                        yAxisId="left"
                        label={{ value: 'จำนวน (ครั้ง) / น้ำหนัก (กก.)', angle: -90, position: 'insideLeft', offset: 10 }}
                        domain={['auto', 'auto']}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{ value: 'มูลค่า (บาท)', angle: 90, position: 'insideRight', offset: 10 }}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <Box sx={{ bgcolor: 'background.paper', p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="body2" fontWeight="bold" mb={0.5}>{label}</Typography>
                                {payload.map((p) => (
                                  <Typography key={p.dataKey} variant="body2" sx={{ color: p.stroke }}>
                                    {p.name}: {p.dataKey === 'value' ? `฿${Number(p.value).toLocaleString()}` : p.value}
                                  </Typography>
                                ))}
                              </Box>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Line yAxisId="left" type="monotone" dataKey="catches" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ fill: CHART_COLORS.primary, r: 4 }} activeDot={{ r: 6 }} name="การจับปลา (ครั้ง)" />
                      <Line yAxisId="left" type="monotone" dataKey="weight" stroke={CHART_COLORS.success} strokeWidth={2} dot={{ fill: CHART_COLORS.success, r: 4 }} activeDot={{ r: 6 }} name="น้ำหนัก (กก.)" />
                      <Line yAxisId="right" type="monotone" dataKey="value" stroke={CHART_COLORS.warning} strokeWidth={2} dot={{ fill: CHART_COLORS.warning, r: 4 }} activeDot={{ r: 6 }} name="มูลค่า (บาท)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
          </Card>

          {/* Species Distribution */}
          <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <BarChartIcon color="primary" />
                  <Typography variant="h6">
                    การกระจายตัวของชนิดปลา <Box component="span" sx={{ fontWeight: 'normal', color: 'text.secondary', fontSize: '0.85em' }}>{periodLabel}</Box>
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart layout="vertical" data={charts.speciesDistribution.filter(d => d.species !== 'กุ้งจ่ม')} margin={{ left: 16, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="species" width={110} tick={{ fontSize: 13 }} />
                    <Tooltip formatter={(value) => [value, 'จำนวน (ตัว)']} />
                    <Bar dataKey="count" fill={CHART_COLORS.primary} name="จำนวน" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
          </Card>

          {/* Catch by Method */}
          <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <BarChartIcon color="primary" />
                  <Typography variant="h6">
                    วิธีการจับปลา <Box component="span" sx={{ fontWeight: 'normal', color: 'text.secondary', fontSize: '0.85em' }}>{periodLabel}</Box>
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={charts.catchByMethod}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="method" tick={{ fontSize: 13 }} />
                    <YAxis />
                    <Tooltip formatter={(value) => [value, 'จำนวน (ครั้ง)']} />
                    <Bar dataKey="count" fill={CHART_COLORS.secondary} name="จำนวนครั้ง" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
          </Card>

          {/* Water Source Analysis */}
          <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <LocationOn color="primary" />
                  <Typography variant="h6">
                    แหล่งน้ำที่จับปลา <Box component="span" sx={{ fontWeight: 'normal', color: 'text.secondary', fontSize: '0.85em' }}>{periodLabel}</Box>
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart layout="vertical" data={charts.catchByWaterSource} margin={{ left: 16, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="source" width={110} tick={{ fontSize: 13 }} />
                    <Tooltip formatter={(value) => [value, 'จำนวน (ครั้ง)']} />
                    <Bar dataKey="count" fill={CHART_COLORS.teal} name="จำนวนครั้ง" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
          </Card>
        </Box>


      </Box>
    </DashboardLayout>
  );
}
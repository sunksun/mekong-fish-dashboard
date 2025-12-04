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
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
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
  ShowChart,
  PieChart as PieChartIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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

export default function FishingAnalyticsPage() {
  const { userProfile, hasAnyRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(mockAnalytics);
  const [timeRange, setTimeRange] = useState('6months');

  // Check permissions
  const canViewAnalytics = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

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
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>ช่วงเวลา</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                label="ช่วงเวลา"
              >
                <MenuItem value="1month">1 เดือน</MenuItem>
                <MenuItem value="3months">3 เดือน</MenuItem>
                <MenuItem value="6months">6 เดือน</MenuItem>
                <MenuItem value="1year">1 ปี</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Overview Stats */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="การจับปลาทั้งหมด"
              value={analytics.totalCatches}
              subtitle="ครั้ง"
              icon={Agriculture}
              color="primary"
              trend={8.5}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="น้ำหนักรวม"
              value={analytics.totalWeight.toFixed(1)}
              subtitle="กิโลกรัม"
              icon={Scale}
              color="success"
              trend={12.3}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="มูลค่ารวม"
              value={`฿${analytics.totalValue.toLocaleString()}`}
              subtitle="บาท"
              icon={AttachMoney}
              color="warning"
              trend={15.7}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="เฉลี่ยต่อครั้ง"
              value={analytics.averagePerCatch.toFixed(1)}
              subtitle="กิโลกรัม/ครั้ง"
              icon={Assessment}
              color="info"
              trend={-2.1}
            />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {/* Monthly Trends Chart */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <ShowChart color="primary" />
                  <Typography variant="h6">
                    แนวโน้มรายเดือน
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={analytics.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'catches') return [value, 'การจับปลา (ครั้ง)'];
                        if (name === 'weight') return [value, 'น้ำหนัก (กก.)'];
                        if (name === 'value') return [`฿${value.toLocaleString()}`, 'มูลค่า (บาท)'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="catches" fill={CHART_COLORS.primary} name="การจับปลา" />
                    <Line yAxisId="left" type="monotone" dataKey="weight" stroke={CHART_COLORS.success} strokeWidth={3} name="น้ำหนัก" />
                    <Line yAxisId="right" type="monotone" dataKey="value" stroke={CHART_COLORS.warning} strokeWidth={3} name="มูลค่า" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Species Distribution */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <PieChartIcon color="primary" />
                  <Typography variant="h6">
                    การกระจายตัวของชนิดปลา
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.speciesDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ species, percentage }) => `${species} (${percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.speciesDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'จำนวน (ตัว)']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Catch by Method */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <BarChartIcon color="primary" />
                  <Typography variant="h6">
                    วิธีการจับปลา
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.catchByMethod.map(item => ({
                    ...item,
                    methodLabel: getMethodLabel(item.method)
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="methodLabel" />
                    <YAxis />
                    <Tooltip formatter={(value) => [value, 'จำนวน (ครั้ง)']} />
                    <Bar dataKey="count" fill={CHART_COLORS.secondary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Water Source Analysis */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <LocationOn color="primary" />
                  <Typography variant="h6">
                    แหล่งน้ำที่จับปลา
                  </Typography>
                </Box>
                <List>
                  {analytics.catchByWaterSource.map((source, index) => (
                    <Box key={source.source}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" fontWeight="medium">
                                {getWaterSourceLabel(source.source)}
                              </Typography>
                              <Box display="flex" gap={1}>
                                <Chip
                                  label={`${source.count} ครั้ง`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`${source.percentage}%`}
                                  size="small"
                                  color="secondary"
                                />
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < analytics.catchByWaterSource.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Province Analysis */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <ShowChart color="primary" />
                  <Typography variant="h6">
                    การจับปลาตามจังหวัด
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.catchByProvince}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="province" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'count') return [value, 'จำนวนครั้ง'];
                        if (name === 'avgValue') return [`฿${value.toLocaleString()}`, 'มูลค่าเฉลี่ย'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill={CHART_COLORS.primary} name="จำนวนครั้ง" />
                    <Bar yAxisId="right" dataKey="avgValue" fill={CHART_COLORS.warning} name="มูลค่าเฉลี่ย" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Seasonal Patterns */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  รูปแบบตามฤดูกาล
                </Typography>
                <Grid container spacing={2}>
                  {analytics.seasonalPatterns.map((pattern, index) => (
                    <Grid item xs={12} md={6} key={pattern.season}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            {pattern.season}
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <Typography variant="body2">
                                <strong>การจับเฉลี่ย:</strong> {pattern.avgCatch} ครั้ง/เดือน
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2">
                                <strong>น้ำหนักเฉลี่ย:</strong> {pattern.avgWeight} กก./ครั้ง
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="body2">
                                <strong>ปลายอดนิยม:</strong> {pattern.bestSpecies}
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Fishers */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  ชาวประมงยอดนิยม (ข้อมูลล่าสุด)
                </Typography>
                <List>
                  {analytics.topFishers.map((fisher, index) => (
                    <Box key={fisher.name}>
                      <ListItem>
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {index + 1}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" fontWeight="medium">
                                {fisher.name}
                              </Typography>
                              <Box display="flex" gap={1}>
                                <Chip
                                  label={`${fisher.catches} ครั้ง`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`${fisher.totalWeight} กก.`}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`฿${fisher.totalValue.toLocaleString()}`}
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                />
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < analytics.topFishers.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Development Notice */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>หมายเหตุการพัฒนา:</strong> การวิเคราะห์นี้ใช้ Mock Data 
            ในระยะต่อไปจะใช้ Recharts สำหรับสร้างกราฟและชาร์ตที่สวยงาม และเชื่อมต่อกับ Firebase
          </Typography>
        </Alert>
      </Box>
    </DashboardLayout>
  );
}
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
  Paper,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Assessment,
  TrendingUp,
  LocationOn,
  Agriculture,
  Timeline,
  ShowChart,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// Chart colors
const CHART_COLORS = {
  primary: '#1976d2',
  secondary: '#dc004e',
  success: '#2e7d32',
  warning: '#ed6c02',
  info: '#0288d1',
  error: '#d32f2f'
};

// Mock spatial analysis data
const mockSpatialAnalysis = {
  densityAnalysis: [
    { area: 'นครพนม-เหนือ', density: 8.5, catchPerKm2: 45.2, avgDistance: 2.1 },
    { area: 'นครพนม-กลาง', density: 12.3, catchPerKm2: 67.8, avgDistance: 1.8 },
    { area: 'นครพนม-ใต้', density: 6.7, catchPerKm2: 34.5, avgDistance: 2.5 },
    { area: 'อุบลราชธานี-เหนือ', density: 9.8, catchPerKm2: 52.1, avgDistance: 2.0 },
    { area: 'อุบลราชธานี-ใต้', density: 7.2, catchPerKm2: 38.9, avgDistance: 2.3 },
    { area: 'มุกดาหาร', density: 11.5, catchPerKm2: 78.3, avgDistance: 1.6 },
    { area: 'บึงกาฬ', density: 5.9, catchPerKm2: 29.7, avgDistance: 2.8 },
    { area: 'หนองคาย', density: 8.1, catchPerKm2: 43.6, avgDistance: 2.2 }
  ],
  distanceFromRiver: [
    { distance: '0-100m', catches: 234, percentage: 42.1, avgWeight: 3.8 },
    { distance: '100-500m', catches: 156, percentage: 28.1, avgWeight: 3.2 },
    { distance: '500m-1km', catches: 89, percentage: 16.0, avgWeight: 2.9 },
    { distance: '1-2km', catches: 45, percentage: 8.1, avgWeight: 2.5 },
    { distance: '>2km', catches: 32, percentage: 5.7, avgWeight: 2.1 }
  ],
  seasonalHotspots: {
    dry: [
      { location: 'นครพนม-ตอนกลาง', lat: 17.41, lng: 104.78, intensity: 89 },
      { location: 'มุกดาหาร-หน้าเขื่อน', lat: 16.54, lng: 104.72, intensity: 92 },
      { location: 'อุบลราชธานี-บ้านโค', lat: 15.24, lng: 104.85, intensity: 76 }
    ],
    wet: [
      { location: 'หนองคาย-ท่าบ่อ', lat: 17.88, lng: 102.74, intensity: 83 },
      { location: 'บึงกาฬ-บึงโขงหลง', lat: 18.36, lng: 103.64, intensity: 71 },
      { location: 'นครพนม-ท่าอุเทน', lat: 17.35, lng: 104.83, intensity: 85 }
    ]
  },
  correlationAnalysis: {
    temperature: [
      { temp: 22, catches: 12 }, { temp: 24, catches: 18 }, { temp: 26, catches: 25 },
      { temp: 28, catches: 35 }, { temp: 30, catches: 28 }, { temp: 32, catches: 22 },
      { temp: 34, catches: 15 }, { temp: 36, catches: 8 }
    ],
    waterLevel: [
      { level: -2.5, catches: 8 }, { level: -1.5, catches: 15 }, { level: -0.5, catches: 28 },
      { level: 0, catches: 45 }, { level: 0.5, catches: 52 }, { level: 1.0, catches: 38 },
      { level: 1.5, catches: 25 }, { level: 2.0, catches: 18 }, { level: 2.5, catches: 12 }
    ]
  },
  proximityAnalysis: [
    { feature: 'ตลาดปลา', avgCatch: 45.2, count: 23, avgDistance: 1.2 },
    { feature: 'ท่าเรือ', avgCatch: 38.7, count: 15, avgDistance: 0.8 },
    { feature: 'วัด/ศาลา', avgCatch: 32.1, count: 31, avgDistance: 2.1 },
    { feature: 'หมู่บ้าน', avgCatch: 28.9, count: 67, avgDistance: 1.5 },
    { feature: 'โรงแรม/รีสอร์ท', avgCatch: 41.3, count: 12, avgDistance: 0.9 }
  ]
};

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'primary' }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" gap={2}>
        <Avatar sx={{ bgcolor: `${color}.main`, width: 48, height: 48 }}>
          <Icon />
        </Avatar>
        <Box flex={1}>
          <Typography variant="h5" fontWeight="bold" color={`${color}.main`}>
            {value}
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default function SpatialAnalysisPage() {
  const { userProfile, hasAnyRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(mockSpatialAnalysis);
  const [analysisType, setAnalysisType] = useState('density');
  const [season, setSeason] = useState('all');

  // Check permissions - only Admin and Researcher can view spatial analysis
  const canViewSpatialAnalysis = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  if (!canViewSpatialAnalysis) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 1, pl: 1.5 }}>
          <Alert severity="error">
            คุณไม่มีสิทธิ์เข้าถึงการวิเคราะห์เชิงพื้นที่ (เฉพาะผู้ดูแลระบบและนักวิจัย)
          </Alert>
        </Box>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 1, pl: 1.5 }}>
          <Typography>กำลังโหลดการวิเคราะห์เชิงพื้นที่...</Typography>
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
                วิเคราะห์เชิงพื้นที่
              </Typography>
              <Typography variant="body1" color="text.secondary">
                การวิเคราะห์รูปแบบการจับปลาเชิงพื้นที่และปัจจัยสิ่งแวดล้อม
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>ประเภทการวิเคราะห์</InputLabel>
                <Select
                  value={analysisType}
                  onChange={(e) => setAnalysisType(e.target.value)}
                  label="ประเภทการวิเคราะห์"
                >
                  <MenuItem value="density">ความหนาแน่น</MenuItem>
                  <MenuItem value="correlation">ความสัมพันธ์</MenuItem>
                  <MenuItem value="proximity">ความใกล้เคียง</MenuItem>
                  <MenuItem value="seasonal">ตามฤดูกาล</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>ฤดูกาล</InputLabel>
                <Select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  label="ฤดูกาล"
                >
                  <MenuItem value="all">ทั้งหมด</MenuItem>
                  <MenuItem value="dry">ฤดูแล้ง</MenuItem>
                  <MenuItem value="wet">ฤดูฝน</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>

        {/* Overview Stats */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="พื้นที่วิเคราะห์"
              value={analysis.densityAnalysis.length}
              subtitle="เขตพื้นที่"
              icon={LocationOn}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ความหนาแน่นเฉลี่ย"
              value={`${(analysis.densityAnalysis.reduce((sum, item) => sum + item.density, 0) / analysis.densityAnalysis.length).toFixed(1)}`}
              subtitle="ครั้ง/กม²"
              icon={Assessment}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Hotspots ฤดูแล้ง"
              value={analysis.seasonalHotspots.dry.length}
              subtitle="จุดยอดนิยม"
              icon={TrendingUp}
              color="warning"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Hotspots ฤดูฝน"
              value={analysis.seasonalHotspots.wet.length}
              subtitle="จุดยอดนิยม"
              icon={Agriculture}
              color="info"
            />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {/* Density Analysis */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <BarChartIcon color="primary" />
                  <Typography variant="h6">
                    การวิเคราะห์ความหนาแน่น
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analysis.densityAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="area" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'density') return [value, 'ความหนาแน่น (ครั้ง/กม²)'];
                        if (name === 'catchPerKm2') return [value, 'การจับ/กม²'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="density" fill={CHART_COLORS.primary} name="ความหนาแน่น" />
                    <Bar yAxisId="right" dataKey="catchPerKm2" fill={CHART_COLORS.success} name="การจับ/กม²" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Distance from River Analysis */}
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  ระยะห่างจากแม่น้ำ
                </Typography>
                <List>
                  {analysis.distanceFromRiver.map((item, index) => (
                    <Box key={item.distance}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" fontWeight="medium">
                                {item.distance}
                              </Typography>
                              <Chip
                                label={`${item.catches} ครั้ง`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <LinearProgress
                                variant="determinate"
                                value={item.percentage}
                                sx={{ mt: 1, mb: 0.5 }}
                                color="primary"
                              />
                              <Typography variant="caption" color="text.secondary">
                                {item.percentage}% • น้ำหนักเฉลี่ย {item.avgWeight} กก.
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < analysis.distanceFromRiver.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Environmental Correlation */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <ShowChart color="primary" />
                  <Typography variant="h6">
                    ความสัมพันธ์กับอุณหภูมิ
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={250}>
                  <ScatterChart data={analysis.correlationAnalysis.temperature}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="temp" name="อุณหภูมิ (°C)" />
                    <YAxis dataKey="catches" name="การจับปลา (ครั้ง)" />
                    <Tooltip 
                      formatter={(value, name) => [
                        value, 
                        name === 'temp' ? 'อุณหภูมิ (°C)' : 'การจับปลา (ครั้ง)'
                      ]}
                    />
                    <Scatter dataKey="catches" fill={CHART_COLORS.warning} />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Water Level Correlation */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Timeline color="primary" />
                  <Typography variant="h6">
                    ความสัมพันธ์กับระดับน้ำ
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analysis.correlationAnalysis.waterLevel}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="level" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        value,
                        name === 'level' ? 'ระดับน้ำ (ม.)' : 'การจับปลา (ครั้ง)'
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="catches" 
                      stroke={CHART_COLORS.info} 
                      strokeWidth={3}
                      dot={{ fill: CHART_COLORS.info, strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Proximity Analysis */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  การวิเคราะห์ความใกล้เคียงกับสิ่งอำนวยความสะดวก
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analysis.proximityAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'avgCatch') return [value, 'การจับเฉลี่ย (ครั้ง)'];
                        if (name === 'avgDistance') return [value, 'ระยะเฉลี่ย (กม.)'];
                        if (name === 'count') return [value, 'จำนวนจุด'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="avgCatch" fill={CHART_COLORS.primary} name="การจับเฉลี่ย" />
                    <Bar yAxisId="left" dataKey="count" fill={CHART_COLORS.secondary} name="จำนวนจุด" />
                    <Bar yAxisId="right" dataKey="avgDistance" fill={CHART_COLORS.warning} name="ระยะเฉลี่ย" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Seasonal Hotspots */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Hotspots ตามฤดูกาล
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, backgroundColor: 'warning.light', color: 'warning.contrastText' }}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        ฤดูแล้ง (พ.ย. - เม.ย.)
                      </Typography>
                      <List dense>
                        {analysis.seasonalHotspots.dry.map((hotspot, index) => (
                          <ListItem key={index} sx={{ py: 0.5 }}>
                            <ListItemText
                              primary={hotspot.location}
                              secondary={`ความเข้มข้น: ${hotspot.intensity}%`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, backgroundColor: 'info.light', color: 'info.contrastText' }}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        ฤดูฝน (พ.ค. - ต.ค.)
                      </Typography>
                      <List dense>
                        {analysis.seasonalHotspots.wet.map((hotspot, index) => (
                          <ListItem key={index} sx={{ py: 0.5 }}>
                            <ListItemText
                              primary={hotspot.location}
                              secondary={`ความเข้มข้น: ${hotspot.intensity}%`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Development Notice */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>หมายเหตุการพัฒนา:</strong> การวิเคราะห์เชิงพื้นที่นี้ใช้ Mock Data
            ในอนาคตจะใช้ข้อมูลจริงจาก GPS และ Environmental sensors พร้อม Machine Learning
          </Typography>
        </Alert>
      </Box>
    </DashboardLayout>
  );
}
'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Alert,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  WaterDrop,
  Opacity,
  Thermostat,
  Science,
  Download,
  TableChart,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy as firestoreOrderBy, query, limit as firestoreLimit } from 'firebase/firestore';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ComposedChart } from 'recharts';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

// Calculate 2-period moving average
function calculateMovingAverage(data, key, period = 2) {
  return data.map((item, index) => {
    if (index < period - 1) {
      return { ...item, [`${key}MA`]: null };
    }

    const sum = data
      .slice(index - period + 1, index + 1)
      .reduce((acc, val) => acc + (val[key] || 0), 0);

    return { ...item, [`${key}MA`]: sum / period };
  });
}

// Get status color
function getStatusColor(status) {
  switch (status) {
    case 'normal':
      return 'success';
    case 'warning':
      return 'warning';
    case 'critical':
      return 'error';
    default:
      return 'default';
  }
}

// Get status label
function getStatusLabel(status) {
  switch (status) {
    case 'normal':
      return 'ปกติ';
    case 'warning':
      return 'เฝ้าระวัง';
    case 'critical':
      return 'วิกฤต';
    default:
      return 'ไม่ทราบ';
  }
}

// Mock sensor data (from sensor_data.sql)
function getMockSensorData() {
  const mockData = [
    { id: 6, deviceId: 'ESP32_001', turbidity: 83, ec: 173.57, tds: 86.79, temperature: 30.37, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:09:28' },
    { id: 7, deviceId: 'ESP32_001', turbidity: 89, ec: 188.76, tds: 94.38, temperature: 26.87, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:09:55' },
    { id: 8, deviceId: 'ESP32_001', turbidity: 80, ec: 198.52, tds: 99.26, temperature: 24.5, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:10:23' },
    { id: 9, deviceId: 'ESP32_001', turbidity: 89, ec: 200.19, tds: 100.09, temperature: 24.06, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:10:50' },
    { id: 11, deviceId: 'ESP32_001', turbidity: 103, ec: 208.47, tds: 104.24, temperature: 24, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:11:45' },
    { id: 12, deviceId: 'ESP32_001', turbidity: 80, ec: 213.67, tds: 106.83, temperature: 23.94, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:12:12' },
    { id: 20, deviceId: 'ESP32_001', turbidity: 89, ec: 211.37, tds: 105.68, temperature: 25.88, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:18:29' },
    { id: 21, deviceId: 'ESP32_001', turbidity: 83, ec: 218.26, tds: 109.13, temperature: 24.31, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:18:57' },
    { id: 22, deviceId: 'ESP32_001', turbidity: 94, ec: 219.56, tds: 109.78, temperature: 24, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:19:24' },
    { id: 23, deviceId: 'ESP32_001', turbidity: 80, ec: 220.17, tds: 110.09, temperature: 24, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:19:52' },
    { id: 24, deviceId: 'ESP32_001', turbidity: 66, ec: 220.44, tds: 110.22, temperature: 23.94, batteryLevel: null, status: 'warning', timestamp: '2026-03-18 14:20:20' },
    { id: 25, deviceId: 'ESP32_001', turbidity: 75, ec: 220.44, tds: 110.22, temperature: 23.94, batteryLevel: null, status: 'warning', timestamp: '2026-03-18 14:20:47' },
    { id: 26, deviceId: 'ESP32_001', turbidity: 114, ec: 220.44, tds: 110.22, temperature: 23.94, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:21:15' },
    { id: 27, deviceId: 'ESP32_001', turbidity: 72, ec: 221.05, tds: 110.53, temperature: 23.94, batteryLevel: null, status: 'warning', timestamp: '2026-03-18 14:21:42' },
    { id: 28, deviceId: 'ESP32_001', turbidity: 89, ec: 220.44, tds: 110.22, temperature: 23.94, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:22:10' },
    { id: 29, deviceId: 'ESP32_001', turbidity: 72, ec: 221.05, tds: 110.53, temperature: 23.94, batteryLevel: null, status: 'warning', timestamp: '2026-03-18 14:22:37' },
    { id: 30, deviceId: 'ESP32_001', turbidity: 75, ec: 221.05, tds: 110.53, temperature: 23.94, batteryLevel: null, status: 'warning', timestamp: '2026-03-18 14:23:05' },
    { id: 31, deviceId: 'ESP32_001', turbidity: 30, ec: 33.54, tds: 16.77, temperature: 23.87, batteryLevel: null, status: 'critical', timestamp: '2026-03-18 14:23:32' }
  ];

  return mockData.map(item => ({
    id: `mock_${item.id}`,
    deviceId: item.deviceId,
    turbidity: item.turbidity,
    ec: item.ec,
    tds: item.tds,
    temperature: item.temperature,
    batteryLevel: item.batteryLevel || 85,
    status: item.status,
    timestamp: new Date(item.timestamp.replace(' ', 'T') + '+07:00'),
    createdAt: new Date()
  }));
}

export default function WaterQualityDataPage() {
  const [sensorData, setSensorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 3m, 6m, 1y
  const [latestData, setLatestData] = useState(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    fetchSensorData();
  }, [timeRange]);

  const fetchSensorData = async () => {
    try {
      setLoading(true);
      setError(null);

      let data = [];

      try {
        // Try to fetch sensor data from Firestore
        const q = query(
          collection(db, 'sensorData'),
          firestoreOrderBy('timestamp', 'desc'),
          firestoreLimit(500)
        );

        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
          const docData = doc.data();
          data.push({
            id: doc.id,
            deviceId: docData.deviceId,
            turbidity: docData.turbidity || 0,
            ec: docData.ec || 0,
            tds: docData.tds || 0,
            temperature: docData.temperature || 0,
            batteryLevel: docData.batteryLevel || 0,
            status: docData.status || 'normal',
            timestamp: docData.timestamp?.toDate() || new Date(),
            createdAt: docData.createdAt?.toDate() || new Date()
          });
        });
      } catch (firestoreError) {
        console.log('No Firestore data, using mock data');
      }

      // If no Firestore data, use mock data from SQL file
      if (data.length === 0) {
        data = getMockSensorData();
      }

      // Sort by timestamp ascending for chart
      data.sort((a, b) => a.timestamp - b.timestamp);

      // Filter by time range
      const filtered = filterByTimeRange(data, timeRange);

      // Calculate moving averages
      const withMA = calculateMovingAverage(filtered, 'turbidity', 2);

      setSensorData(withMA);

      // Set latest data for summary cards
      if (data.length > 0) {
        // Get most recent (sort desc first)
        const sortedDesc = [...data].sort((a, b) => b.timestamp - a.timestamp);
        setLatestData(sortedDesc[0]);
      }

    } catch (error) {
      console.error('Error fetching sensor data:', error);
      setError('ไม่สามารถโหลดข้อมูลเซ็นเซอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  const filterByTimeRange = (data, range) => {
    const now = new Date();
    let cutoffDate;

    switch (range) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6m':
        cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return data;
    }

    return data.filter(item => item.timestamp >= cutoffDate);
  };

  const prepareChartData = () => {
    return sensorData.map(item => ({
      date: format(item.timestamp, 'dd/MM', { locale: th }),
      datetime: format(item.timestamp, 'dd/MM/yyyy HH:mm', { locale: th }),
      turbidity: item.turbidity,
      turbidityMA: item.turbidityMA,
      ec: item.ec,
      tds: item.tds,
      temperature: item.temperature
    }));
  };

  const exportToCSV = () => {
    const headers = ['วันที่', 'เวลา', 'ความขุ่น (NTU)', 'EC (µS/cm)', 'TDS (ppm)', 'อุณหภูมิ (°C)', 'สถานะ'];
    const rows = sensorData.map(item => [
      format(item.timestamp, 'dd/MM/yyyy', { locale: th }),
      format(item.timestamp, 'HH:mm:ss', { locale: th }),
      item.turbidity,
      item.ec,
      item.tds,
      item.temperature,
      getStatusLabel(item.status)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `water_quality_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <DashboardLayout title="ข้อมูลคุณภาพน้ำ">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  const chartData = prepareChartData();

  return (
    <DashboardLayout title="ข้อมูลคุณภาพน้ำ">
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              📊 กราฟคุณภาพน้ำ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ข้อมูลจากเซ็นเซอร์วัดคุณภาพน้ำแม่น้ำโขง
            </Typography>
            {latestData && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                ล่าสุด: {format(latestData.timestamp, 'dd/MM/yyyy HH:mm', { locale: th })} น.
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>ช่วงเวลา</InputLabel>
              <Select
                value={timeRange}
                label="ช่วงเวลา"
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="7d">7 วันล่าสุด</MenuItem>
                <MenuItem value="30d">30 วันล่าสุด</MenuItem>
                <MenuItem value="3m">3 เดือนล่าสุด</MenuItem>
                <MenuItem value="6m">6 เดือนล่าสุด</MenuItem>
                <MenuItem value="1y">1 ปีล่าสุด</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={exportToCSV}
              disabled={sensorData.length === 0}
            >
              Export CSV
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Summary Cards */}
        {latestData && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Opacity color="primary" />
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      ความขุ่น
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="primary.main">
                    {latestData.turbidity} NTU
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Science color="secondary" />
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      ค่าการนำไฟฟ้า (EC)
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="secondary.main">
                    {latestData.ec} µS/cm
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <WaterDrop color="info" />
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      ของแข็งละลาย (TDS)
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="info.main">
                    {latestData.tds} ppm
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Thermostat color="warning" />
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      อุณหภูมิ
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {latestData.temperature} °C
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Turbidity Chart */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            กราฟคุณภาพน้ำ - ความขุ่น (Turbidity)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            แสดงค่าความขุ่นของน้ำและค่าเฉลี่ยเคลื่อนที่ 2 คาบ
          </Typography>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  yAxisId="left"
                  label={{ value: 'ความขุ่น (NTU)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 130]}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return payload[0].payload.datetime;
                    }
                    return label;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />

                {/* Reference line for turbidity threshold */}
                <ReferenceLine
                  yAxisId="left"
                  y={50}
                  stroke="#f44336"
                  strokeDasharray="5 5"
                  label={{ value: 'เกณฑ์ความขุ่น (50 NTU)', position: 'right', fill: '#f44336', fontSize: 12 }}
                />

                {/* Bar for turbidity */}
                <Bar
                  yAxisId="left"
                  dataKey="turbidity"
                  fill="#1976d2"
                  name="ความขุ่น (NTU)"
                  radius={[4, 4, 0, 0]}
                />

                {/* Moving average line */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="turbidityMA"
                  stroke="#1976d2"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  name="2 per. Mov. Avg."
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <Alert severity="info">ไม่มีข้อมูลในช่วงเวลาที่เลือก</Alert>
          )}
        </Paper>

        {/* Multi-parameter Chart */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            กราฟพารามิเตอร์อื่นๆ
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            EC, TDS และอุณหภูมิ
          </Typography>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  yAxisId="left"
                  label={{ value: 'EC (µS/cm) / TDS (ppm)', angle: -90, position: 'insideLeft' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{ value: 'อุณหภูมิ (°C)', angle: 90, position: 'insideRight' }}
                />
                <Tooltip />
                <Legend />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="ec"
                  stroke="#9c27b0"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="EC (µS/cm)"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="tds"
                  stroke="#00bcd4"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  name="TDS (ppm)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ff9800"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="อุณหภูมิ (°C)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Alert severity="info">ไม่มีข้อมูลในช่วงเวลาที่เลือก</Alert>
          )}
        </Paper>

        {/* Data Table with Toggle Button */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              ตารางข้อมูลดิบ
            </Typography>
            <Button
              variant={showTable ? 'contained' : 'outlined'}
              startIcon={<TableChart />}
              endIcon={showTable ? <ExpandLess /> : <ExpandMore />}
              onClick={() => setShowTable(!showTable)}
            >
              {showTable ? 'ซ่อนตาราง' : 'แสดงตาราง'}
            </Button>
          </Box>

          {showTable && (
            <>
              {sensorData.length > 0 ? (
                <TableContainer sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>วันที่</strong></TableCell>
                        <TableCell><strong>เวลา</strong></TableCell>
                        <TableCell align="right"><strong>ความขุ่น (NTU)</strong></TableCell>
                        <TableCell align="right"><strong>EC (µS/cm)</strong></TableCell>
                        <TableCell align="right"><strong>TDS (ppm)</strong></TableCell>
                        <TableCell align="right"><strong>อุณหภูมิ (°C)</strong></TableCell>
                        <TableCell><strong>สถานะ</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sensorData.slice().reverse().slice(0, 50).map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{format(row.timestamp, 'dd/MM/yyyy', { locale: th })}</TableCell>
                          <TableCell>{format(row.timestamp, 'HH:mm:ss', { locale: th })}</TableCell>
                          <TableCell align="right">{row.turbidity}</TableCell>
                          <TableCell align="right">{row.ec}</TableCell>
                          <TableCell align="right">{row.tds}</TableCell>
                          <TableCell align="right">{row.temperature}</TableCell>
                          <TableCell>
                            <Chip
                              label={getStatusLabel(row.status)}
                              color={getStatusColor(row.status)}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">ไม่มีข้อมูลในช่วงเวลาที่เลือก</Alert>
              )}

              {sensorData.length > 50 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
                  แสดง 50 รายการล่าสุด จากทั้งหมด {sensorData.length} รายการ
                </Typography>
              )}
            </>
          )}
        </Paper>
      </Box>
    </DashboardLayout>
  );
}

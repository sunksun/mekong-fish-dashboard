'use client';

import { useState } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  Add,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Upload
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import { useEffect } from 'react';

export default function WaterLevelPage() {
  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [formData, setFormData] = useState({
    station: 'เชียงคาน',
    province: 'เลย',
    date: new Date().toISOString().split('T')[0],
    time: '07:00',
    currentLevel: '',
    criticalLevel: '16.00',
    lowestLevel: '19.19',
    rainfall: '0.0',
    rtkLevel: '210.118'
  });

  // State for comparison data
  const [comparison, setComparison] = useState({
    today: 0,
    yesterday: 0,
    todayDate: null,
    yesterdayDate: null,
    daysDiff: 0,
    change: 0,
    changePercent: '0.00',
    trend: 'stable'
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [chartPeriod, setChartPeriod] = useState(30); // 7, 30, or 90 days

  // ฟังก์ชันสำหรับแสดงไอคอนและสีตาม trend
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'rising':
        return <TrendingUp sx={{ fontSize: 40 }} />;
      case 'falling':
        return <TrendingDown sx={{ fontSize: 40 }} />;
      default:
        return <TrendingFlat sx={{ fontSize: 40 }} />;
    }
  };

  const getTrendColor = (trend) => {
    switch (trend) {
      case 'rising':
        return '#ff6b6b'; // สีแดง - น้ำขึ้น
      case 'falling':
        return '#51cf66'; // สีเขียว - น้ำลง
      default:
        return '#868e96'; // สีเทา - คงที่
    }
  };

  const getTrendText = (trend) => {
    switch (trend) {
      case 'rising':
        return 'น้ำขึ้น';
      case 'falling':
        return 'น้ำลง';
      default:
        return 'คงที่';
    }
  };

  // Fetch water level data from Firebase
  const fetchWaterLevelData = async () => {
    try {
      setLoading(true);
      const waterLevelRef = collection(db, 'waterLevels');

      // Get all records first, then sort manually
      const snapshot = await getDocs(waterLevelRef);

      if (snapshot.empty) {
        console.log('No water level data found');
        setLoading(false);
        return;
      }

      // Get all records and sort by date + time descending
      const allRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by date (newest first), then by time (latest first)
      allRecords.sort((a, b) => {
        // Compare dates first
        const dateA = a.date || '1970-01-01';
        const dateB = b.date || '1970-01-01';

        if (dateA !== dateB) {
          return dateB.localeCompare(dateA); // Descending order (newest first)
        }

        // If dates are the same, compare times
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeB.localeCompare(timeA); // Descending order (latest first)
      });

      // Take only the latest 2 records
      const records = allRecords.slice(0, 2);

      console.log('All water level records:', allRecords.length);
      console.log('=== ALL RECORDS (sorted by date+time desc) ===');
      allRecords.forEach((record, index) => {
        console.log(`All Record ${index}:`, {
          id: record.id,
          currentLevel: record.currentLevel,
          date: record.date,
          time: record.time,
          createdAt: record.createdAt ? new Date(record.createdAt.seconds * 1000).toLocaleString('th-TH') : 'N/A'
        });
      });
      console.log('=== LATEST 2 RECORDS USED FOR COMPARISON ===');
      records.forEach((record, index) => {
        console.log(`Record ${index}:`, {
          id: record.id,
          currentLevel: record.currentLevel,
          date: record.date,
          time: record.time,
          createdAt: record.createdAt ? new Date(record.createdAt.seconds * 1000).toLocaleString('th-TH') : 'N/A'
        });
      });

      // Calculate comparison
      if (records.length >= 2) {
        const latest = records[0];
        const previous = records[1];

        const currentLevel = latest.currentLevel;
        const previousLevel = previous.currentLevel;
        const change = currentLevel - previousLevel;

        let trend = 'stable';
        if (change > 0.05) trend = 'rising';
        else if (change < -0.05) trend = 'falling';

        // Calculate date difference
        const latestDate = new Date(latest.date);
        const previousDate = new Date(previous.date);
        const daysDiff = Math.floor((latestDate - previousDate) / (1000 * 60 * 60 * 24));

        console.log('Comparison calculated:', {
          latest: {
            date: latest.date,
            level: currentLevel
          },
          previous: {
            date: previous.date,
            level: previousLevel
          },
          daysDiff,
          change,
          trend
        });

        setComparison({
          today: currentLevel,
          yesterday: previousLevel,
          todayDate: latest.date,
          yesterdayDate: previous.date,
          daysDiff: daysDiff,
          change: change,
          changePercent: previousLevel !== 0 ? ((change / previousLevel) * 100).toFixed(2) : '0.00',
          trend: trend
        });
      } else if (records.length === 1) {
        // Only one record available
        console.log('Only one record available:', records[0].currentLevel);
        setComparison({
          today: records[0].currentLevel,
          yesterday: 0,
          todayDate: records[0].date,
          yesterdayDate: null,
          daysDiff: 0,
          change: 0,
          changePercent: '0.00',
          trend: 'stable'
        });
      }

      // Prepare chart data (last N days based on chartPeriod)
      const chartRecords = allRecords.slice(0, chartPeriod).reverse();
      const formattedChartData = chartRecords.map(record => ({
        date: new Date(record.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
        level: record.currentLevel,
        critical: 16.00,
        fullDate: record.date
      }));
      setChartData(formattedChartData);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching water level data:', error);
      setLoading(false);
    }
  };

  // Load data on component mount and when chartPeriod changes
  useEffect(() => {
    fetchWaterLevelData();
  }, [chartPeriod]);

  // Handle dialog
  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!formData.currentLevel) {
        alert('กรุณากรอกระดับน้ำปัจจุบัน');
        return;
      }

      // Prepare data for Firebase
      const waterLevelData = {
        station: formData.station,
        province: formData.province,
        date: formData.date,
        time: formData.time,
        currentLevel: parseFloat(formData.currentLevel),
        criticalLevel: parseFloat(formData.criticalLevel) || 16.00,
        lowestLevel: parseFloat(formData.lowestLevel) || 19.19,
        rainfall: parseFloat(formData.rainfall) || 0.0,
        rtkLevel: parseFloat(formData.rtkLevel) || 210.118,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      console.log('Submitting water level data:', waterLevelData);

      // Save to Firebase
      const waterLevelRef = collection(db, 'waterLevels');
      const docRef = await addDoc(waterLevelRef, waterLevelData);

      console.log('Water level data saved with ID:', docRef.id);
      alert('บันทึกข้อมูลสำเร็จ!');

      // Reset form
      setFormData({
        station: 'เชียงคาน',
        province: 'เลย',
        date: new Date().toISOString().split('T')[0],
        time: '07:00',
        currentLevel: '',
        criticalLevel: '16.00',
        lowestLevel: '19.19',
        rainfall: '0.0',
        rtkLevel: '210.118'
      });

      handleCloseDialog();

      // Refresh comparison data
      await fetchWaterLevelData();
    } catch (error) {
      console.error('Error saving data:', error);
      alert(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${error.message}`);
    }
  };

  // Parse Thai Buddhist date to ISO date
  const parseThaiDate = (thaiDateStr) => {
    // Example: "17 พ.ย. 2568" -> "2024-11-17"
    const months = {
      'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04',
      'พ.ค.': '05', 'มิ.ย.': '06', 'ก.ค.': '07', 'ส.ค.': '08',
      'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12'
    };

    const parts = thaiDateStr.trim().split(' ');
    if (parts.length !== 3) return null;

    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]];
    const buddhistYear = parseInt(parts[2]);
    const gregorianYear = buddhistYear - 543;

    if (!month) return null;

    return `${gregorianYear}-${month}-${day}`;
  };

  // Parse change value (handle +/- signs)
  const parseChange = (changeStr) => {
    if (!changeStr) return 0;
    const cleaned = changeStr.replace('+', '');
    return parseFloat(cleaned) || 0;
  };

  // Handle CSV file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress('กำลังอ่านไฟล์...');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      // Skip header line
      const dataLines = lines.slice(1);

      setUploadProgress(`พบข้อมูล ${dataLines.length} รายการ กำลังประมวลผล...`);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;

        const columns = line.split(',');
        if (columns.length < 5) {
          console.warn(`Skip invalid line ${i + 2}:`, line);
          errorCount++;
          continue;
        }

        // Parse CSV columns
        const dateStr = columns[0].trim();
        const currentLevel = parseFloat(columns[1].trim());
        const change = parseChange(columns[2].trim());
        const belowCritical = parseFloat(columns[3].trim());
        const rainfall = parseFloat(columns[4].trim());

        // Parse date
        const isoDate = parseThaiDate(dateStr);
        if (!isoDate || isNaN(currentLevel)) {
          console.warn(`Skip invalid data at line ${i + 2}:`, { dateStr, currentLevel });
          errorCount++;
          continue;
        }

        // Calculate critical level (currentLevel + belowCritical)
        const criticalLevel = currentLevel + belowCritical;

        // Prepare data
        const waterLevelData = {
          station: 'เชียงคาน',
          province: 'เลย',
          date: isoDate,
          time: '07:00', // Default time
          currentLevel: currentLevel,
          criticalLevel: criticalLevel,
          lowestLevel: 19.19, // Default from existing data
          rainfall: rainfall,
          rtkLevel: 210.118, // Default from existing data
          change: change, // Store change value from CSV
          belowCritical: belowCritical, // Store below critical value
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        try {
          const waterLevelRef = collection(db, 'waterLevels');
          await addDoc(waterLevelRef, waterLevelData);
          successCount++;
          setUploadProgress(`กำลังบันทึก... (${successCount}/${dataLines.length})`);
        } catch (error) {
          console.error(`Error saving row ${i + 2}:`, error);
          errorCount++;
        }
      }

      setUploadProgress(`เสร็จสิ้น! บันทึกสำเร็จ ${successCount} รายการ${errorCount > 0 ? `, ข้อผิดพลาด ${errorCount} รายการ` : ''}`);

      // Refresh data
      await fetchWaterLevelData();

      setTimeout(() => {
        setUploadDialogOpen(false);
        setUploading(false);
        setUploadProgress('');
      }, 2000);

    } catch (error) {
      console.error('Error uploading CSV:', error);
      setUploadProgress(`เกิดข้อผิดพลาด: ${error.message}`);
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              ระดับน้ำแม่น้ำโขง
            </Typography>
            <Typography variant="body2" color="text.secondary">
              สถานีตรวจวัด: เชียงคาน, เลย
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Upload />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Import CSV
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleOpenDialog}
            >
              เพิ่มข้อมูลระดับน้ำ
            </Button>
          </Box>
        </Box>

        {/* Status and Thresholds Card */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      ระดับวิกฤติ
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ mt: 1, color: '#ff6b6b' }}>
                      16.00 ม.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      (210.118 ม. รทก.)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      ต่ำกว่าระดับวิกฤติ
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ mt: 1, color: '#51cf66' }}>
                      9.87 ม.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      สถานการณ์ปกติ
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      ระดับต่ำสุดเคยวัดได้
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ mt: 1, color: '#228be6' }}>
                      19.19 ม.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      ระดับต่ำสุดประวัติศาสตร์
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      ปริมาณน้ำฝน
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>
                      0.0 ม.ม.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      วันที่ 12 ธ.ค. 2568
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

        {/* Comparison Card - เปรียบเทียบกับรอบก่อน */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              เปรียบเทียบกับรอบก่อน
              {comparison.daysDiff > 0 && (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  ({comparison.daysDiff} วันที่แล้ว)
                </Typography>
              )}
            </Typography>

            {loading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <Typography>กำลังโหลดข้อมูล...</Typography>
              </Box>
            ) : comparison.today === 0 && comparison.yesterday === 0 ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                ยังไม่มีข้อมูลระดับน้ำ กรุณาเพิ่มข้อมูลอย่างน้อย 1 รายการ
              </Alert>
            ) : (
              <>
                <Grid container spacing={3} sx={{ mt: 1 }}>
                    {/* แนวโน้ม */}
                    <Grid item xs={12} md={4}>
                      <Box
                        sx={{
                          textAlign: 'center',
                          p: 2,
                          borderRadius: 2,
                          bgcolor: getTrendColor(comparison.trend) + '20',
                          border: `2px solid ${getTrendColor(comparison.trend)}`
                        }}
                      >
                        <Box sx={{ color: getTrendColor(comparison.trend), mb: 1 }}>
                          {getTrendIcon(comparison.trend)}
                        </Box>
                        <Typography variant="h5" fontWeight="bold" sx={{ color: getTrendColor(comparison.trend) }}>
                          {getTrendText(comparison.trend)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          แนวโน้มระดับน้ำ
                        </Typography>
                      </Box>
                    </Grid>

                    {/* ส่วนต่างระดับน้ำ */}
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          ส่วนต่าง
                        </Typography>
                        <Typography
                          variant="h4"
                          fontWeight="bold"
                          sx={{ color: getTrendColor(comparison.trend) }}
                        >
                          {comparison.change > 0 ? '+' : ''}{comparison.change.toFixed(2)} m
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          ({comparison.change > 0 ? '+' : ''}{comparison.changePercent}%)
                        </Typography>
                      </Box>
                    </Grid>

                    {/* ข้อมูลเปรียบเทียบ */}
                    <Grid item xs={12} md={4}>
                      <Box sx={{ p: 2 }}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            ล่าสุด
                            {comparison.todayDate && (
                              <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                                ({new Date(comparison.todayDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
                              </Typography>
                            )}
                          </Typography>
                          <Typography variant="h6" fontWeight="bold">
                            {comparison.today.toFixed(2)} m
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            รอบก่อน
                            {comparison.yesterdayDate && (
                              <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                                ({new Date(comparison.yesterdayDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
                              </Typography>
                            )}
                          </Typography>
                          <Typography variant="h6" fontWeight="bold">
                            {comparison.yesterday.toFixed(2)} m
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>

                  {comparison.yesterday === 0 && comparison.today > 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      มีข้อมูลเพียง 1 รายการ ไม่สามารถเปรียบเทียบกับรอบก่อนได้
                    </Alert>
                  )}
                  {comparison.daysDiff > 1 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      ℹ️ ข้อมูลเปรียบเทียบห่างกัน {comparison.daysDiff} วัน (ไม่มีการบันทึกข้อมูลในระหว่าง)
                    </Alert>
                  )}
                </>
              )}
          </CardContent>
        </Card>

        {/* Water Level Chart */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="bold">
                กราฟระดับน้ำ
              </Typography>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>ช่วงเวลา</InputLabel>
                <Select
                  value={chartPeriod}
                  label="ช่วงเวลา"
                  onChange={(e) => setChartPeriod(e.target.value)}
                >
                  <MenuItem value={7}>7 วัน</MenuItem>
                  <MenuItem value={30}>30 วัน</MenuItem>
                  <MenuItem value={90}>90 วัน</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {loading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <Typography>กำลังโหลดข้อมูล...</Typography>
              </Box>
            ) : chartData.length === 0 ? (
              <Alert severity="info">
                ยังไม่มีข้อมูลสำหรับแสดงกราฟ กรุณาเพิ่มข้อมูลระดับน้ำ
              </Alert>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    label={{
                      value: 'ระดับน้ำ (เมตร)',
                      angle: -90,
                      position: 'insideLeft'
                    }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    formatter={(value, name) => {
                      if (name === 'level') return [value.toFixed(2) + ' ม.', 'ระดับน้ำ'];
                      if (name === 'critical') return [value.toFixed(2) + ' ม.', 'ระดับวิกฤติ'];
                      return [value, name];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                  />
                  <ReferenceLine
                    y={16}
                    stroke="#ff6b6b"
                    strokeDasharray="3 3"
                    label={{ value: 'ระดับวิกฤติ', position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="level"
                    stroke="#228be6"
                    strokeWidth={2}
                    name="ระดับน้ำ"
                    dot={{ fill: '#228be6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Upload CSV Dialog */}
        <Dialog
          open={uploadDialogOpen}
          onClose={() => !uploading && setUploadDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight="bold">
              Import ข้อมูลระดับน้ำจาก CSV
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>รูปแบบไฟล์ CSV:</strong>
                </Typography>
                <Typography variant="body2" component="div">
                  • วัน/เดือน/ปี, ระดับน้ำ (เมตร), การเปลี่ยนแปลง (เมตร), ต่ำกว่าระดับวิกฤต (เมตร), ปริมาณน้ำฝน (มม.)
                </Typography>
                <Typography variant="body2" component="div" sx={{ mt: 1 }}>
                  • ตัวอย่าง: 17 พ.ย. 2568,8.08,-0.29,7.92,0
                </Typography>
              </Alert>

              <input
                accept=".csv"
                style={{ display: 'none' }}
                id="csv-upload-input"
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <label htmlFor="csv-upload-input">
                <Button
                  variant="contained"
                  component="span"
                  fullWidth
                  startIcon={<Upload />}
                  disabled={uploading}
                  sx={{ mb: 2 }}
                >
                  {uploading ? 'กำลังอัปโหลด...' : 'เลือกไฟล์ CSV'}
                </Button>
              </label>

              {uploadProgress && (
                <Alert severity={uploadProgress.includes('เสร็จสิ้น') ? 'success' : 'info'} sx={{ mt: 2 }}>
                  {uploadProgress}
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploading}
            >
              {uploadProgress.includes('เสร็จสิ้น') ? 'ปิด' : 'ยกเลิก'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Water Level Data Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight="bold">
              เพิ่มข้อมูลระดับน้ำแม่น้ำโขง
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                {/* สถานีและจังหวัด */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="สถานีตรวจวัด"
                    value={formData.station}
                    onChange={(e) => handleFormChange('station', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="จังหวัด"
                    value={formData.province}
                    onChange={(e) => handleFormChange('province', e.target.value)}
                  />
                </Grid>

                {/* วันที่และเวลา */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="วันที่"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleFormChange('date', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="เวลา"
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleFormChange('time', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* ระดับน้ำปัจจุบัน */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ระดับน้ำปัจจุบัน"
                    type="number"
                    value={formData.currentLevel}
                    onChange={(e) => handleFormChange('currentLevel', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">ม.</InputAdornment>
                    }}
                  />
                </Grid>

                {/* ระดับวิกฤติ */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ระดับวิกฤติ"
                    type="number"
                    value={formData.criticalLevel}
                    onChange={(e) => handleFormChange('criticalLevel', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">ม.</InputAdornment>
                    }}
                  />
                </Grid>

                {/* ระดับต่ำสุดและปริมาณน้ำฝน */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ระดับต่ำสุดเคยวัดได้"
                    type="number"
                    value={formData.lowestLevel}
                    onChange={(e) => handleFormChange('lowestLevel', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">ม.</InputAdornment>
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ปริมาณน้ำฝน"
                    type="number"
                    value={formData.rainfall}
                    onChange={(e) => handleFormChange('rainfall', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">ม.ม.</InputAdornment>
                    }}
                  />
                </Grid>

                {/* ระดับ รทก. */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="ระดับ รทก. (ราชกรมสำรวจ)"
                    type="number"
                    value={formData.rtkLevel}
                    onChange={(e) => handleFormChange('rtkLevel', e.target.value)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">ม. รทก.</InputAdornment>
                    }}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleCloseDialog} color="inherit">
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              color="primary"
            >
              บันทึกข้อมูล
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}

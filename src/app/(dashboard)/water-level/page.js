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
  InputAdornment
} from '@mui/material';
import {
  Add,
  TrendingUp,
  TrendingDown,
  TrendingFlat
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import { useEffect } from 'react';

export default function WaterLevelPage() {
  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
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

      setLoading(false);
    } catch (error) {
      console.error('Error fetching water level data:', error);
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchWaterLevelData();
  }, []);

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
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenDialog}
          >
            เพิ่มข้อมูลระดับน้ำ
          </Button>
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

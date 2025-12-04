'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import {
  WaterDrop,
  Refresh,
  TrendingUp,
  TrendingDown,
  TrendingFlat
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';

export default function WaterLevelPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comparison, setComparison] = useState(null);

  // Mock data สำหรับข้อมูลเมื่อวาน (จะเปลี่ยนเป็นดึงจาก Firebase ภายหลัง)
  const getMockComparison = (currentLevel) => {
    // สมมติข้อมูลเมื่อวาน (ใกล้เคียงกับวันนี้)
    const yesterdayLevel = currentLevel - 0.12; // ลดลงเล็กน้อย
    const change = currentLevel - yesterdayLevel;

    let trend = 'stable';
    if (change > 0.05) trend = 'rising';
    else if (change < -0.05) trend = 'falling';

    return {
      today: currentLevel,
      yesterday: yesterdayLevel,
      change: change,
      changePercent: ((change / yesterdayLevel) * 100).toFixed(2),
      trend: trend
    };
  };

  const fetchWaterLevel = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/rid-water-level?station=Kh.97');
      const result = await response.json();

      if (result.success) {
        setData(result.data);

        // สร้าง mock comparison data
        const comparisonData = getMockComparison(result.data.current.waterLevel);
        setComparison(comparisonData);
      } else {
        setError(result.error || 'ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (err) {
      console.error('Error fetching water level:', err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchWaterLevel();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

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
              สถานีตรวจวัด: {data?.station?.name}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchWaterLevel}
          >
            รีเฟรช
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {data && (
          <>
            {/* Current Status Card */}
            <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <CardContent>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" gap={2} sx={{ color: 'white' }}>
                      <WaterDrop sx={{ fontSize: 60 }} />
                      <Box>
                        <Typography variant="h3" fontWeight="bold">
                          {data.current.waterLevel} {data.current.unit}
                        </Typography>
                        <Typography variant="h6">
                          ระดับน้ำปัจจุบัน
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ color: 'white' }}>
                      {data.current.rawText && (
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                          {data.current.rawText}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        แหล่งข้อมูล: กรมชลประทาน (RID)
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                        สถานี: {data.station?.code} - {data.station?.district}, {data.station?.province}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                        อัพเดทล่าสุด: {new Date(data.current.timestamp).toLocaleString('th-TH')}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Status and Thresholds Card */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      สถานะระดับน้ำ
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: data.current.statusColor === 'success' ? '#51cf66' :
                                   data.current.statusColor === 'warning' ? '#ffd43b' :
                                   data.current.statusColor === 'error' ? '#ff6b6b' : '#868e96'
                        }}
                      />
                      <Typography variant="h6" fontWeight="bold">
                        {data.current.status}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {data.current.statusDescription}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      ระดับน้ำสูงสุด
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" sx={{ mt: 1 }}>
                      {data.thresholds.max} {data.thresholds.unit}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      ระดับปัจจุบัน: {((data.current.waterLevel / data.thresholds.max) * 100).toFixed(1)}% ของค่าสูงสุด
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      แนวโน้ม 7 วัน
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
                      {data.summary.trend === 'rising' && <TrendingUp sx={{ color: '#ff6b6b', fontSize: 28 }} />}
                      {data.summary.trend === 'falling' && <TrendingDown sx={{ color: '#51cf66', fontSize: 28 }} />}
                      {data.summary.trend === 'stable' && <TrendingFlat sx={{ color: '#868e96', fontSize: 28 }} />}
                      <Typography variant="h6" fontWeight="bold">
                        {data.summary.trend === 'rising' ? 'น้ำขึ้น' :
                         data.summary.trend === 'falling' ? 'น้ำลง' : 'คงที่'}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      เฉลี่ย: {data.summary.average} m
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Comparison Card - เปรียบเทียบกับเมื่อวาน */}
            {comparison && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    เปรียบเทียบกับเมื่อวาน
                  </Typography>

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
                            วันนี้
                          </Typography>
                          <Typography variant="h6" fontWeight="bold">
                            {comparison.today.toFixed(2)} m
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            เมื่อวาน
                          </Typography>
                          <Typography variant="h6" fontWeight="bold">
                            {comparison.yesterday.toFixed(2)} m
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    💡 ข้อมูลนี้เป็น Mock Data สำหรับแสดงตัวอย่าง UI - จะเชื่อมต่อกับ Firebase ในขั้นตอนถัดไป
                  </Alert>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Box>
    </DashboardLayout>
  );
}

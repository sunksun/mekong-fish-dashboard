'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  IconButton
} from '@mui/material';
import {
  PeopleAlt,
  Agriculture,
  TrendingUp,
  LocationOn,
  MonetizationOn,
  Assessment,
  Map,
  ArrowForward
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, loading = false }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" gap={2}>
        <Box
          sx={{
            backgroundColor: `${color}.light`,
            borderRadius: '50%',
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon sx={{ color: `${color}.main`, fontSize: 24 }} />
        </Box>
        <Box flex={1}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          {loading ? (
            <CircularProgress size={20} />
          ) : (
            <Typography variant="h4" fontWeight="bold">
              {value}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

// Quick Activity Component
const QuickActivity = () => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        กิจกรรมล่าสุด
      </Typography>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {[1, 2, 3, 4, 5, 6, 7].map((item) => (
          <Box
            key={item}
            display="flex"
            alignItems="center"
            py={1.5}
            borderBottom="1px solid"
            borderColor="divider"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
                borderRadius: 1
              }
            }}
          >
            <Agriculture sx={{ mr: 2, color: 'primary.main', fontSize: 20 }} />
            <Box flex={1}>
              <Typography variant="body2" fontWeight="medium">
                ชาวประมงคนที่ {item} บันทึกการจับปลา
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item} นาทีที่แล้ว • นครพนม
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      <Box mt={2} textAlign="center">
        <Typography variant="caption" color="primary.main" sx={{ cursor: 'pointer' }}>
          ดูทั้งหมด →
        </Typography>
      </Box>
    </CardContent>
  </Card>
);

// Map Preview Component
const MapPreview = () => {
  const router = useRouter();

  const handleNavigateToMap = () => {
    router.push('/maps/fishing');
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            แผนที่การจับปลา GIS
          </Typography>
          <IconButton 
            color="primary" 
            onClick={handleNavigateToMap}
            sx={{ 
              backgroundColor: 'primary.light',
              '&:hover': { backgroundColor: 'primary.main', color: 'white' }
            }}
          >
            <ArrowForward />
          </IconButton>
        </Box>
        <Box
          onClick={handleNavigateToMap}
          sx={{
            flex: 1,
            minHeight: 350,
            backgroundColor: 'grey.100',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed',
            borderColor: 'grey.300',
            position: 'relative',
            backgroundImage: 'radial-gradient(circle at 25% 25%, #e3f2fd 0%, transparent 50%), radial-gradient(circle at 75% 75%, #f3e5f5 0%, transparent 50%)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'primary.light',
              transform: 'scale(1.02)'
            }
          }}
        >
          <Box textAlign="center">
            <Map sx={{ fontSize: 64, color: 'primary.main', mb: 2, opacity: 0.8 }} />
            <Typography variant="h6" color="primary.main" gutterBottom>
              แผนที่ GIS แม่น้ำโขง
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Heat Map การจับปลาและการวิเคราะห์เชิงพื้นที่
            </Typography>
            <Button 
              variant="contained" 
              color="primary"
              startIcon={<LocationOn />}
              sx={{ mt: 1 }}
            >
              เปิดแผนที่
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCatch: 0,
    totalWeight: 0,
    totalValue: 0,
    activeToday: 0,
    avgPerFisher: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simulate API call - ในอนาคตจะเชื่อมต่อกับ Firebase
    const fetchStats = async () => {
      try {
        setLoading(true);
        // Mock data for development
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setStats({
          totalUsers: 1247,
          totalCatch: 3856,
          totalWeight: 2847.5,
          totalValue: 125680,
          activeToday: 89,
          avgPerFisher: 2.3
        });
      } catch (err) {
        setError('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (error) {
    return (
      <DashboardLayout>
        <Alert severity="error">{error}</Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        p: 1, // Add minimal padding to the dashboard content
        pl: 1.5 // เพิ่มระยะห่างจาก sidebar นิดหน่อย (12px)
      }}>
        {/* Header */}
        <Box mb={1}>
          <Typography variant="h4" gutterBottom fontWeight="600" sx={{ mb: 0.25 }}>
            แดชบอร์ดการประมงแม่น้ำโขง
          </Typography>
          <Typography variant="body1" color="text.secondary">
            ภาพรวมข้อมูลการจับปลาและการใช้งานระบบ
          </Typography>
        </Box>
        
        {/* ภาพรวมข้อมูลการจับปลาและการใช้งานระบบ */}
        <Grid container spacing={2} mb={2}>
          <Grid item xs={12} md={4}>
            <StatCard
              title="การจับปลาทั้งหมด (ครั้ง)"
              value={loading ? '-' : stats.totalCatch.toLocaleString()}
              icon={Agriculture}
              color="primary"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard
              title="น้ำหนักรวม (กก.)"
              value={loading ? '-' : stats.totalWeight.toLocaleString()}
              icon={TrendingUp}
              color="success"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard
              title="มูลค่ารวม (บาท)"
              value={loading ? '-' : `฿${stats.totalValue.toLocaleString()}`}
              icon={MonetizationOn}
              color="warning"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard
              title="จำนวนผู้ใช้งานทั้งหมด"
              value={loading ? '-' : stats.totalUsers.toLocaleString()}
              icon={PeopleAlt}
              color="secondary"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard
              title="ใช้งานวันนี้"
              value={loading ? '-' : stats.activeToday.toLocaleString()}
              icon={Assessment}
              color="info"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StatCard
              title="เฉลี่ยต่อคน (กก./วัน)"
              value={loading ? '-' : stats.avgPerFisher.toFixed(1)}
              icon={TrendingUp}
              color="success"
              loading={loading}
            />
          </Grid>
        </Grid>

        {/* GIS Quick Access */}
        <Box mb={2}>
          <Typography variant="h6" gutterBottom sx={{ mb: 1.5 }}>
            ระบบแผนที่ GIS
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/maps/fishing')}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        backgroundColor: 'primary.light',
                        borderRadius: '50%',
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <LocationOn sx={{ color: 'primary.main', fontSize: 28 }} />
                    </Box>
                    <Box flex={1}>
                      <Typography variant="h6" fontWeight="bold">
                        แผนที่การจับปลา
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Heat Map จุดจับปลาและการวิเคราะห์เชิงพื้นที่
                      </Typography>
                      <Button size="small" variant="outlined" startIcon={<ArrowForward />}>
                        ดูแผนที่
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/maps/analysis')}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        backgroundColor: 'secondary.light',
                        borderRadius: '50%',
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Assessment sx={{ color: 'secondary.main', fontSize: 28 }} />
                    </Box>
                    <Box flex={1}>
                      <Typography variant="h6" fontWeight="bold">
                        วิเคราะห์เชิงพื้นที่
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        การวิเคราะห์รูปแบบการจับปลาและแนวโน้ม
                      </Typography>
                      <Button size="small" variant="outlined" startIcon={<ArrowForward />}>
                        วิเคราะห์
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => router.push('/water-quality/stations')}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        backgroundColor: 'info.light',
                        borderRadius: '50%',
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Map sx={{ color: 'info.main', fontSize: 28 }} />
                    </Box>
                    <Box flex={1}>
                      <Typography variant="h6" fontWeight="bold">
                        จุดตรวจวัดคุณภาพน้ำ
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        แผนที่สถานีตรวจวัดคุณภาพน้ำแม่น้ำโขง
                      </Typography>
                      <Button size="small" variant="outlined" startIcon={<ArrowForward />}>
                        ดูจุดตรวจวัด
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Charts and Activities */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Grid container spacing={2} sx={{ height: '100%' }}>
            <Grid item xs={12} lg={8} sx={{ height: { lg: '100%' } }}>
              <MapPreview />
            </Grid>
            <Grid item xs={12} lg={4} sx={{ height: { lg: '100%' } }}>
              <QuickActivity />
            </Grid>
          </Grid>
        </Box>

        {/* Development Notice */}
        <Box mt={1.5}>
          <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
            <Typography variant="body2">
              <strong>หมายเหตุการพัฒนา:</strong> ข้อมูลนี้เป็น Mock Data 
              ในระยะต่อไปจะเชื่อมต่อกับ Firebase และแสดงข้อมูลจริงจาก Mobile App
            </Typography>
          </Alert>
        </Box>
      </Box>
    </DashboardLayout>
  );
}
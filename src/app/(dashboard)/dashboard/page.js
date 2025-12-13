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
  Map,
  ArrowForward
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, iconType, color, loading = false }) => (
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
          {iconType === 'svg' ? (
            <Box
              component="img"
              src={Icon}
              alt={title}
              sx={{ width: 24, height: 24 }}
            />
          ) : (
            <Icon sx={{ color: `${color}.main`, fontSize: 24 }} />
          )}
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
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        let totalUsers = 0;
        let totalWeight = 0;
        let totalValue = 0;
        let totalCatch = 0;
        let activeToday = 0;

        // Fetch users
        try {
          const usersRef = collection(db, 'users');
          const usersSnapshot = await getDocs(usersRef);
          totalUsers = usersSnapshot.size;
          console.log('Total users:', totalUsers);
        } catch (userErr) {
          console.error('Error fetching users:', userErr);
          // Continue even if users fetch fails
        }

        // Fetch fishing records
        try {
          const recordsRef = collection(db, 'fishingRecords');
          const recordsSnapshot = await getDocs(recordsRef);
          const records = recordsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          console.log('Total fishing records:', records.length);
          totalCatch = records.length;

          // Calculate totals
          records.forEach(record => {
            const weight = Number(record.totalWeight) || 0;
            const value = Number(record.totalValue) || 0;
            totalWeight += weight;
            totalValue += value;
          });

          // Calculate active today (records created today)
          try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTimestamp = Timestamp.fromDate(today);

            const activeTodayQuery = query(
              recordsRef,
              where('createdAt', '>=', todayTimestamp)
            );
            const activeTodaySnapshot = await getDocs(activeTodayQuery);
            activeToday = activeTodaySnapshot.size;
            console.log('Active today:', activeToday);
          } catch (queryErr) {
            console.warn('Could not fetch active today:', queryErr);
            // Continue without active today count
          }
        } catch (recordsErr) {
          console.error('Error fetching records:', recordsErr);
          throw recordsErr; // Re-throw to show error to user
        }

        // Calculate average per fisher
        const avgPerFisher = totalUsers > 0 ? (totalWeight / totalUsers) : 0;

        setStats({
          totalUsers,
          totalCatch,
          totalWeight: parseFloat(totalWeight.toFixed(1)),
          totalValue: Math.round(totalValue),
          activeToday,
          avgPerFisher: parseFloat(avgPerFisher.toFixed(1))
        });

        console.log('Stats loaded successfully:', {
          totalUsers,
          totalCatch,
          totalWeight: Number(totalWeight).toFixed(1),
          totalValue: Math.round(Number(totalValue)),
          activeToday,
          avgPerFisher: Number(avgPerFisher).toFixed(1)
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);

        // Check if it's a permission error
        if (err.code === 'permission-denied') {
          setError('ไม่มีสิทธิ์เข้าถึงข้อมูล กรุณาตรวจสอบ Firestore Security Rules');
        } else if (err.code === 'unavailable') {
          setError('ไม่สามารถเชื่อมต่อกับ Firebase กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        } else if (!db) {
          setError('Firebase ไม่ได้ถูก initialize กรุณาตรวจสอบไฟล์ .env.local');
        } else {
          setError(`ไม่สามารถโหลดข้อมูลได้: ${err.message || 'Unknown error'}`);
        }
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
          <Box display="flex" alignItems="center" gap={1.5} mb={0.25}>
            <Box
              component="img"
              src="/icons/fishing-spot-marker.svg"
              alt="Mekong Fish Dashboard"
              sx={{ width: 40, height: 40 }}
            />
            <Typography variant="h4" fontWeight="600">
              แดชบอร์ดการประมงแม่น้ำโขง
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            ภาพรวมข้อมูลการจับปลาและการใช้งานระบบ
          </Typography>
        </Box>
        
        {/* ภาพรวมข้อมูลการจับปลาและการใช้งานระบบ */}
        <Grid container spacing={2} mb={2}>
          <Grid item xs={12} md={3}>
            <StatCard
              title="การจับปลาทั้งหมด (ครั้ง)"
              value={loading ? '-' : stats.totalCatch.toLocaleString()}
              icon="/icons/fish-marker.svg"
              iconType="svg"
              color="primary"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard
              title="น้ำหนักรวม (กก.)"
              value={loading ? '-' : stats.totalWeight.toLocaleString()}
              icon={TrendingUp}
              color="success"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <StatCard
              title="จำนวนผู้ใช้งานทั้งหมด"
              value={loading ? '-' : stats.totalUsers.toLocaleString()}
              icon={PeopleAlt}
              color="secondary"
              loading={loading}
            />
          </Grid>
          <Grid item xs={12} md={3}>
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
                      <TrendingUp sx={{ color: 'secondary.main', fontSize: 28 }} />
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
      </Box>
    </DashboardLayout>
  );
}
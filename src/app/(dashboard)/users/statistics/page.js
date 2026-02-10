'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Alert,
  Box,
  Grid,
  Chip,
  Avatar,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  PeopleAlt,
  TrendingUp,
  LocationOn,
  Schedule,
  Assessment,
  Agriculture,
  Phone,
  Email
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';

const getRoleColor = (role) => {
  switch (role) {
    case USER_ROLES.ADMIN: return 'error';
    case USER_ROLES.RESEARCHER: return 'primary';
    case USER_ROLES.GOVERNMENT: return 'success';
    case USER_ROLES.COMMUNITY_MANAGER: return 'warning';
    case USER_ROLES.FISHER: return 'info';
    default: return 'default';
  }
};

const getRoleLabel = (role) => {
  switch (role) {
    case USER_ROLES.ADMIN: return 'ผู้ดูแลระบบ';
    case USER_ROLES.RESEARCHER: return 'นักวิจัย';
    case USER_ROLES.GOVERNMENT: return 'หน่วยงานรัฐ';
    case USER_ROLES.COMMUNITY_MANAGER: return 'ผู้จัดการชุมชน';
    case USER_ROLES.FISHER: return 'ชาวประมง';
    default: return role;
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
            {value.toLocaleString()}
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

export default function UserStatisticsPage() {
  const { userProfile, hasAnyRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [fisherCatchData, setFisherCatchData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12

  // Check permissions - only Admin can view user statistics
  const canViewStatistics = hasAnyRole([USER_ROLES.ADMIN]);

  useEffect(() => {
    if (!canViewStatistics) return;

    // ดึงข้อมูลผู้ใช้จาก Firestore
    const loadUsers = async () => {
      try {
        setLoading(true);
        console.log('Loading users statistics...');

        const usersQuery = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(usersQuery);
        const usersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('Loaded users:', usersData.length);

        setUsers(usersData);
        calculateStatistics(usersData);
        await loadFisherCatchStatistics(usersData, selectedMonth);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [canViewStatistics, selectedMonth]);

  const loadFisherCatchStatistics = async (usersData, month) => {
    try {
      // Get fishers only
      const fishers = usersData.filter(u => u.role?.trim() === USER_ROLES.FISHER);

      // Calculate date range for selected month
      const currentYear = new Date().getFullYear();
      const monthStartDate = new Date(currentYear, month - 1, 1); // month is 1-12, Date month is 0-11
      const monthEndDate = new Date(currentYear, month, 0, 23, 59, 59); // Last day of month

      console.log('Filtering records for month:', month, 'from', monthStartDate, 'to', monthEndDate);

      // Fetch fishing records
      const recordsSnapshot = await getDocs(collection(db, 'fishingRecords'));
      const records = recordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter records for selected month and verified only
      const monthRecords = records.filter(record => {
        const catchDate = record.catchDate?.toDate ? record.catchDate.toDate() : new Date(record.catchDate);
        const isInSelectedMonth = catchDate >= monthStartDate && catchDate <= monthEndDate;
        const isVerified = record.verified === true;
        return isInSelectedMonth && isVerified;
      });

      console.log('Found verified records for selected month:', monthRecords.length);

      // Calculate total fish count per fisher (excluding shrimp)
      const fisherCatchMap = {};

      monthRecords.forEach(record => {
        const userId = record.userId;
        if (!userId) return;

        // Count total fish from fishList (exclude shrimp)
        let fishCount = 0;
        if (record.fishList && Array.isArray(record.fishList)) {
          fishCount = record.fishList
            .filter(fish => {
              const fishName = (fish.name || fish.species || '').toLowerCase();
              return !fishName.includes('กุ้ง') && !fishName.includes('shrimp');
            })
            .reduce((sum, fish) => sum + (fish.count || 0), 0);
        }
        // Also check fishData (exclude shrimp)
        if (record.fishData && Array.isArray(record.fishData)) {
          fishCount += record.fishData
            .filter(fish => {
              const fishName = (fish.name || fish.species || '').toLowerCase();
              return !fishName.includes('กุ้ง') && !fishName.includes('shrimp');
            })
            .reduce((sum, fish) => sum + (fish.quantity || 0), 0);
        }

        fisherCatchMap[userId] = (fisherCatchMap[userId] || 0) + fishCount;
      });

      // Count how many times each fisher has records (across all time, not just this month)
      const fisherRecordCount = {};
      records.forEach(record => {
        const userId = record.userId;
        if (userId && record.verified === true) {
          fisherRecordCount[userId] = (fisherRecordCount[userId] || 0) + 1;
        }
      });

      // Create chart data - show all fishers who have at least 1 verified record
      const chartData = fishers
        .filter(fisher => fisherRecordCount[fisher.id] >= 1) // Has at least 1 record
        .map(fisher => ({
          name: fisher.name || fisher.email || 'ไม่ระบุชื่อ',
          fishCount: fisherCatchMap[fisher.id] || 0,
          userId: fisher.id,
          recordCount: fisherRecordCount[fisher.id] || 0
        }))
        .sort((a, b) => b.fishCount - a.fishCount); // Sort by fish count descending

      setFisherCatchData(chartData);
      console.log('Fisher catch data:', chartData.length, 'fishers with at least 1 record');
      console.log('All fishers:', fishers.map(f => ({ name: f.name, id: f.id, role: f.role })));
      console.log('Fisher record counts:', fisherRecordCount);
      console.log('Fisher catch map for this month:', fisherCatchMap);

      // Check specific fisher
      const targetFisher = fishers.find(f => f.name?.includes('พัฒนพงษ์'));
      if (targetFisher) {
        console.log('🔍 นายพัฒนพงษ์ อาศัย:', {
          id: targetFisher.id,
          name: targetFisher.name,
          role: targetFisher.role,
          totalRecords: fisherRecordCount[targetFisher.id] || 0,
          fishThisMonth: fisherCatchMap[targetFisher.id] || 0
        });

        // Show detailed records for this fisher
        const fisherRecords = monthRecords.filter(r => r.userId === targetFisher.id);
        console.log(`📋 รายการจับปลาของ ${targetFisher.name} ในเดือนนี้ (${fisherRecords.length} รายการ):`);
        fisherRecords.forEach((record, idx) => {
          const fishCount = (record.fishList || [])
            .filter(fish => {
              const fishName = (fish.name || '').toLowerCase();
              return !fishName.includes('กุ้ง') && !fishName.includes('shrimp');
            })
            .reduce((sum, fish) => sum + (fish.count || 0), 0);

          console.log(`  ${idx + 1}. วันที่: ${record.catchDate?.toDate ? record.catchDate.toDate().toLocaleDateString('th-TH') : 'N/A'}, จำนวนปลา: ${fishCount} ตัว, fishList:`, record.fishList);
        });
      } else {
        console.log('❌ ไม่พบนายพัฒนพงษ์ อาศัย ในรายชื่อ users');
      }
    } catch (error) {
      console.error('Error loading fisher catch statistics:', error);
    }
  };

  const calculateStatistics = (usersData) => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // จำนวนผู้ใช้ทั้งหมด
    const totalUsers = usersData.length;

    // ผู้ใช้ที่ active (มี lastLogin หรือ lastActivity ใน 30 วันที่แล้ว)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = usersData.filter(user => {
      const lastActivity = user.lastActivity ? new Date(user.lastActivity) : null;
      const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
      const recentDate = lastActivity || lastLogin;
      return recentDate && recentDate > thirtyDaysAgo;
    }).length;

    // ผู้ใช้ใหม่เดือนนี้
    const newUsersThisMonth = usersData.filter(user => {
      const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      return createdAt >= thisMonthStart;
    }).length;

    // ผู้ใช้ใหม่เดือนที่แล้ว
    const newUsersLastMonth = usersData.filter(user => {
      const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      return createdAt >= lastMonthStart && createdAt < thisMonthStart;
    }).length;

    // คำนวณ growth rate
    const growthRate = newUsersLastMonth > 0
      ? (((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100).toFixed(1)
      : 0;

    // นับผู้ใช้ตามบทบาท
    const usersByRole = {};
    Object.values(USER_ROLES).forEach(role => {
      usersByRole[role] = usersData.filter(u => u.role?.trim() === role).length;
    });

    // นับผู้ใช้ตามจังหวัด
    const provinceCount = {};
    usersData.forEach(user => {
      const province = user.province?.trim();
      if (province) {
        provinceCount[province] = (provinceCount[province] || 0) + 1;
      }
    });

    // แปลงเป็น array และเรียงตามจำนวน
    const usersByProvince = Object.entries(provinceCount)
      .map(([province, count]) => ({
        province,
        count,
        percentage: ((count / totalUsers) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // เอา top 5

    setStats({
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      usersByRole,
      usersByProvince,
      growthRate: parseFloat(growthRate)
    });
  };

  if (!canViewStatistics) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 1, pl: 1.5 }}>
          <Alert severity="error">
            คุณไม่มีสิทธิ์เข้าถึงสถิติผู้ใช้งาน (เฉพาะผู้ดูแลระบบ)
          </Alert>
        </Box>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 1, pl: 1.5 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography>กำลังโหลดสถิติผู้ใช้งาน...</Typography>
          </Box>
        </Box>
      </DashboardLayout>
    );
  }

  if (!stats) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 1, pl: 1.5 }}>
          <Alert severity="info">
            ไม่มีข้อมูลสถิติผู้ใช้งาน
          </Alert>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 1, pl: 1.5 }}>
        {/* Header */}
        <Box mb={3}>
          <Typography variant="h4" gutterBottom>
            สถิติผู้ใช้งาน
          </Typography>
          <Typography variant="body1" color="text.secondary">
            วิเคราะห์และติดตามสถิติการใช้งานระบบของผู้ใช้งานทั้งหมด
          </Typography>
        </Box>

        {/* Overview Stats */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ผู้ใช้งานทั้งหมด"
              value={stats.totalUsers}
              subtitle="รวมทุกประเภท"
              icon={PeopleAlt}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ใช้งานอยู่"
              value={stats.activeUsers}
              subtitle={`${stats.totalUsers > 0 ? ((stats.activeUsers / stats.totalUsers) * 100).toFixed(1) : 0}% ของทั้งหมด`}
              icon={Assessment}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ผู้ใช้ใหม่เดือนนี้"
              value={stats.newUsersThisMonth}
              subtitle="เทียบกับเดือนที่แล้ว"
              icon={TrendingUp}
              color="info"
              trend={stats.growthRate}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ชาวประมง"
              value={stats.usersByRole[USER_ROLES.FISHER] || 0}
              subtitle={`${stats.totalUsers > 0 ? (((stats.usersByRole[USER_ROLES.FISHER] || 0) / stats.totalUsers) * 100).toFixed(1) : 0}% ของทั้งหมด`}
              icon={Agriculture}
              color="warning"
            />
          </Grid>
        </Grid>

        {/* Fisher Catch Statistics Chart */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  จำนวนปลาที่ชาวประมงจับได้
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  แสดงชาวประมงทุกคนที่มีรายการจับปลาอย่างน้อย 1 ครั้ง (ไม่นับกุ้ง, เฉพาะรายการที่ยืนยันแล้ว)
                </Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>เดือน</InputLabel>
                <Select
                  value={selectedMonth}
                  label="เดือน"
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <MenuItem value={1}>มกราคม</MenuItem>
                  <MenuItem value={2}>กุมภาพันธ์</MenuItem>
                  <MenuItem value={3}>มีนาคม</MenuItem>
                  <MenuItem value={4}>เมษายน</MenuItem>
                  <MenuItem value={5}>พฤษภาคม</MenuItem>
                  <MenuItem value={6}>มิถุนายน</MenuItem>
                  <MenuItem value={7}>กรกฎาคม</MenuItem>
                  <MenuItem value={8}>สิงหาคม</MenuItem>
                  <MenuItem value={9}>กันยายน</MenuItem>
                  <MenuItem value={10}>ตุลาคม</MenuItem>
                  <MenuItem value={11}>พฤศจิกายน</MenuItem>
                  <MenuItem value={12}>ธันวาคม</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {fisherCatchData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(400, fisherCatchData.length * 40)}>
                <BarChart
                  data={fisherCatchData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value.toLocaleString()} ตัว`, 'จำนวนปลา']}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc' }}
                  />
                  <Legend />
                  <Bar dataKey="fishCount" name="จำนวนปลา (ตัว)" fill="#1976d2">
                    {fisherCatchData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${210 - index * 5}, 70%, ${50 + index * 2}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Alert severity="info">
                ไม่มีข้อมูลการจับปลาในเดือนที่เลือก
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Info Notice */}
        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>ข้อมูลสถิติ:</strong> ข้อมูลทั้งหมดดึงมาจาก Firestore แบบ Real-time
            และจะอัพเดทอัตโนมัติเมื่อมีการเปลี่ยนแปลงข้อมูลผู้ใช้งาน
          </Typography>
        </Alert>
      </Box>
    </DashboardLayout>
  );
}
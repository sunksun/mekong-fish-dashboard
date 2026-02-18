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
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
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

const FisherTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const fisher = payload[0].payload;
  return (
    <Box sx={{
      bgcolor: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: 2,
      p: 1.5,
      boxShadow: 3,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      minWidth: 180,
    }}>
      <Avatar
        src={fisher.profilePhoto || ''}
        alt={fisher.name}
        sx={{ width: 40, height: 40, border: '2px solid #1976d2' }}
      >
        {!fisher.profilePhoto && fisher.name?.[0]}
      </Avatar>
      <Box>
        <Typography variant="body2" fontWeight="bold" sx={{ lineHeight: 1.3 }}>
          {fisher.name}
        </Typography>
        <Typography variant="caption" color="primary.main">
          เดือนนี้: {fisher.recordCountMonth} ครั้ง
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          ทั้งหมด: {fisher.recordCountTotal} ครั้ง
        </Typography>
      </Box>
    </Box>
  );
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
      const monthStartDate = new Date(currentYear, month - 1, 1);
      const monthEndDate = new Date(currentYear, month, 0, 23, 59, 59);

      // Fetch all fishing records
      const recordsSnapshot = await getDocs(collection(db, 'fishingRecords'));
      const records = recordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // นับจำนวนครั้งที่บันทึกในเดือนที่เลือก (verified เท่านั้น)
      // ใช้ userId เป็น key — รวมทั้งกรณีนักวิจัยบันทึกให้ (userId ยังคงเป็นของชาวประมง)
      const monthRecordCount = {};
      records.forEach(record => {
        const userId = record.userId;
        if (!userId || record.verified !== true) return;

        const catchDate = record.catchDate?.toDate
          ? record.catchDate.toDate()
          : record.date?.toDate
            ? record.date.toDate()
            : new Date(record.catchDate || record.date);

        if (catchDate >= monthStartDate && catchDate <= monthEndDate) {
          monthRecordCount[userId] = (monthRecordCount[userId] || 0) + 1;
        }
      });

      // นับจำนวนครั้งที่บันทึกทั้งหมดตลอดเวลา (verified เท่านั้น)
      const totalRecordCount = {};
      records.forEach(record => {
        const userId = record.userId;
        if (userId && record.verified === true) {
          totalRecordCount[userId] = (totalRecordCount[userId] || 0) + 1;
        }
      });

      // สร้าง chart data — แสดงชาวประมงทุกคน เรียงตามจำนวนครั้งในเดือนที่เลือก
      const chartData = fishers
        .map(fisher => ({
          name: fisher.name || fisher.email || 'ไม่ระบุชื่อ',
          recordCountMonth: monthRecordCount[fisher.id] || 0,
          recordCountTotal: totalRecordCount[fisher.id] || 0,
          userId: fisher.id,
          profilePhoto: fisher.fisherProfile?.profilePhoto || null,
        }))
        .sort((a, b) => b.recordCountMonth - a.recordCountMonth);

      setFisherCatchData(chartData);
      console.log('Fisher data:', chartData.length, 'fishers total');
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
                  จำนวนครั้งที่ชาวประมงบันทึกข้อมูล
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  นับจากรายการใน fishingRecords (เฉพาะรายการที่ยืนยันแล้ว) รวมกรณีนักวิจัยบันทึกให้
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
                  <Tooltip content={<FisherTooltip />} />
                  <Legend />
                  <Bar dataKey="recordCountMonth" name="จำนวนครั้งที่บันทึก (เดือนนี้)" fill="#1976d2">
                    {fisherCatchData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${210 - index * 5}, 70%, ${50 + index * 2}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Alert severity="info">
                ไม่มีข้อมูลในเดือนที่เลือก
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Fisher List Table */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box mb={2}>
              <Typography variant="h6" gutterBottom>
                รายชื่อชาวประมงทั้งหมด ({fisherCatchData.length} คน)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                นับจำนวนครั้งที่บันทึกข้อมูล (เฉพาะรายการที่ยืนยันแล้ว)
              </Typography>
            </Box>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    <TableCell width={50} align="center"><Typography variant="caption" fontWeight="bold" color="white">#</Typography></TableCell>
                    <TableCell><Typography variant="caption" fontWeight="bold" color="white">ชื่อ-นามสกุล</Typography></TableCell>
                    <TableCell align="center"><Typography variant="caption" fontWeight="bold" color="white">ครั้งในเดือนที่เลือก</Typography></TableCell>
                    <TableCell align="center"><Typography variant="caption" fontWeight="bold" color="white">ครั้งทั้งหมด (ตลอดเวลา)</Typography></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fisherCatchData.map((fisher, index) => (
                    <TableRow
                      key={fisher.userId}
                      sx={{ '&:nth-of-type(odd)': { bgcolor: 'grey.50' }, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <TableCell align="center">
                        <Typography variant="body2" color="text.secondary">{index + 1}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={fisher.recordCountMonth > 0 ? 'medium' : 'regular'}>
                          {fisher.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {fisher.recordCountMonth > 0 ? (
                          <Chip
                            label={`${fisher.recordCountMonth} ครั้ง`}
                            size="small"
                            color="primary"
                            variant="filled"
                          />
                        ) : (
                          <Typography variant="body2" color="text.disabled">-</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {fisher.recordCountTotal > 0 ? (
                          <Chip
                            label={`${fisher.recordCountTotal} ครั้ง`}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="body2" color="text.disabled">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {fisherCatchData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          ไม่มีข้อมูลชาวประมง
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
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
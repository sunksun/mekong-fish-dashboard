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
  Divider
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
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

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

  // Check permissions - only Admin can view user statistics
  const canViewStatistics = hasAnyRole([USER_ROLES.ADMIN]);

  useEffect(() => {
    if (!canViewStatistics) return;

    // ดึงข้อมูลผู้ใช้จาก Firestore แบบ real-time
    const usersQuery = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setUsers(usersData);
      calculateStatistics(usersData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading users:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [canViewStatistics]);

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

        <Grid container spacing={2}>
          {/* User by Role */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  ผู้ใช้งานตามบทบาท
                </Typography>
                <List>
                  {Object.entries(stats.usersByRole).map(([role, count]) => (
                    <Box key={role}>
                      <ListItem>
                        <ListItemIcon>
                          <Chip
                            label={getRoleLabel(role)}
                            color={getRoleColor(role)}
                            size="small"
                            variant="outlined"
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2">
                                {getRoleLabel(role)}
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {count.toLocaleString()} คน
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <LinearProgress
                              variant="determinate"
                              value={(count / stats.totalUsers) * 100}
                              color={getRoleColor(role)}
                              sx={{ mt: 1 }}
                            />
                          }
                        />
                      </ListItem>
                      <Divider />
                    </Box>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* User by Province */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  ผู้ใช้งานตามจังหวัด
                </Typography>
                <List>
                  {stats.usersByProvince.map((item, index) => (
                    <Box key={item.province}>
                      <ListItem>
                        <ListItemIcon>
                          <LocationOn color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2">
                                {item.province}
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {item.count.toLocaleString()} คน ({item.percentage}%)
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <LinearProgress
                              variant="determinate"
                              value={item.percentage}
                              color="primary"
                              sx={{ mt: 1 }}
                            />
                          }
                        />
                      </ListItem>
                      {index < stats.usersByProvince.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

        </Grid>

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
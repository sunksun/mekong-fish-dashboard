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
  Chip,
  Divider
} from '@mui/material';
import {
  PeopleAlt,
  TrendingUp,
  LocationOn,
  ArrowForward,
  CheckCircle,
  HourglassEmpty
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit, Timestamp } from 'firebase/firestore';

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


const SPECIES_EXCLUDED = new Set(['กุ้งจ่ม', 'กุ้งฝอย', 'ไม่ทราบชื่อปลา', 'ไม่ทราบ', 'ไม่ระบุ']);
const SPECIES_COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#7b1fa2', '#0288d1', '#c62828', '#558b2f', '#f57c00'];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0, totalCatch: 0, totalWeight: 0,
    totalValue: 0, activeToday: 0, avgPerFisher: 0
  });
  const [verificationStats, setVerificationStats] = useState({ pending: 0, verified: 0 });
  const [recentPending, setRecentPending] = useState([]);
  const [topSpecies, setTopSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);

        const recordsRef = collection(db, 'fishingRecords');

        // Run all fetches in parallel
        const [usersSnap, recordsSnap, pendingSnap, todaySnap] = await Promise.all([
          getDocs(collection(db, 'users')).catch(() => ({ size: 0 })),
          getDocs(recordsRef),
          getDocs(query(recordsRef, where('verified', '==', false), limit(50))),
          getDocs(query(recordsRef, where('createdAt', '>=', Timestamp.fromDate((() => { const d = new Date(); d.setHours(0,0,0,0); return d; })())))).catch(() => ({ size: 0 })),
        ]);

        // ── Basic stats ──────────────────────────────────────────────────
        const totalUsers = usersSnap.size;
        let totalWeight = 0, totalValue = 0, verifiedCount = 0, unverifiedCount = 0;
        const speciesAgg = {};

        recordsSnap.forEach(doc => {
          const d = doc.data();
          totalWeight += Number(d.totalWeight) || 0;
          totalValue += Number(d.totalValue) || 0;
          if (d.verified === true) verifiedCount++; else unverifiedCount++;

          // Aggregate species
          (d.fishList || []).forEach(fish => {
            const name = (fish.name || fish.commonName || '').trim();
            if (!name || SPECIES_EXCLUDED.has(name)) return;
            speciesAgg[name] = (speciesAgg[name] || 0) + (Number(fish.count) || 1);
          });
        });

        const totalCatch = recordsSnap.size;
        const avgPerFisher = totalUsers > 0 ? totalWeight / totalUsers : 0;

        setStats({
          totalUsers,
          totalCatch,
          totalWeight: parseFloat(totalWeight.toFixed(1)),
          totalValue: Math.round(totalValue),
          activeToday: todaySnap.size,
          avgPerFisher: parseFloat(avgPerFisher.toFixed(1))
        });

        // ── Verification stats ───────────────────────────────────────────
        setVerificationStats({ pending: unverifiedCount, verified: verifiedCount });

        // ── Recent pending records ───────────────────────────────────────
        const recent = [...pendingSnap.docs]
          .sort((a, b) => {
            const ta = a.data().createdAt?.seconds ?? 0;
            const tb = b.data().createdAt?.seconds ?? 0;
            return tb - ta;
          })
          .slice(0, 3)
          .map(doc => {
          const d = doc.data();
          let dateStr = '—';
          if (d.date?.seconds) dateStr = new Date(d.date.seconds * 1000).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
          else if (typeof d.date === 'string') dateStr = d.date;
          return {
            id: doc.id,
            date: dateStr,
            spotName: d.location?.spotName || d.location?.province || '—',
            species: (d.fishList || []).map(f => f.name || f.commonName).filter(Boolean).join(', ') || '—',
          };
        });
        setRecentPending(recent);

        // ── Top 8 species by count ───────────────────────────────────────
        const top8 = Object.entries(speciesAgg)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, count]) => ({ name, count }));
        setTopSpecies(top8);

      } catch (err) {
        console.error('Dashboard fetch error:', err);
        if (err.code === 'permission-denied') setError('ไม่มีสิทธิ์เข้าถึงข้อมูล กรุณาตรวจสอบ Firestore Security Rules');
        else if (err.code === 'unavailable') setError('ไม่สามารถเชื่อมต่อกับ Firebase กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        else setError(`ไม่สามารถโหลดข้อมูลได้: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
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
            
          </Grid>
        </Box>

        {/* ── Analytics Row ── */}
        <Grid container spacing={2} mt={0.5}>

          {/* Verification Queue */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  คิวตรวจสอบข้อมูล
                </Typography>

                {/* Summary counters */}
                <Box display="flex" gap={2} mb={2}>
                  <Box
                    sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'warning.50',
                          border: '1px solid', borderColor: 'warning.200',
                          display: 'flex', alignItems: 'center', gap: 1.5 }}
                  >
                    <HourglassEmpty sx={{ color: 'warning.main', fontSize: 28 }} />
                    <Box>
                      <Typography variant="h4" fontWeight="bold" color="warning.dark">
                        {loading ? <CircularProgress size={20} /> : verificationStats.pending.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">รอการตรวจสอบ</Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'success.50',
                          border: '1px solid', borderColor: 'success.200',
                          display: 'flex', alignItems: 'center', gap: 1.5 }}
                  >
                    <CheckCircle sx={{ color: 'success.main', fontSize: 28 }} />
                    <Box>
                      <Typography variant="h4" fontWeight="bold" color="success.dark">
                        {loading ? <CircularProgress size={20} /> : verificationStats.verified.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">ตรวจสอบแล้ว</Typography>
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ mb: 1.5 }} />

                {/* 3 most recent pending */}
                <Typography variant="body2" color="text.secondary" fontWeight={500} mb={1}>
                  รายการล่าสุดที่รอตรวจสอบ
                </Typography>
                {loading ? (
                  <Box display="flex" justifyContent="center" py={2}><CircularProgress size={24} /></Box>
                ) : recentPending.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>ไม่มีรายการรอตรวจสอบ</Typography>
                ) : (
                  recentPending.map((rec, i) => (
                    <Box key={rec.id}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" py={1}>
                        <Box flex={1} minWidth={0}>
                          <Typography variant="body2" fontWeight={500} noWrap>{rec.spotName}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>{rec.species}</Typography>
                        </Box>
                        <Box ml={1} display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                          <Chip label="รอตรวจสอบ" size="small" color="warning" variant="outlined" sx={{ fontSize: 10 }} />
                          <Typography variant="caption" color="text.secondary">{rec.date}</Typography>
                        </Box>
                      </Box>
                      {i < recentPending.length - 1 && <Divider />}
                    </Box>
                  ))
                )}

                <Box mt={2}>
                  <Button
                    size="small" variant="outlined" endIcon={<ArrowForward />}
                    onClick={() => router.push('/fishing/records')}
                  >
                    ดูรายการทั้งหมด
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Fish Species Chart */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  ชนิดปลาที่จับได้มากที่สุด
                </Typography>
                {loading ? (
                  <Box display="flex" justifyContent="center" alignItems="center" height={260}>
                    <CircularProgress />
                  </Box>
                ) : topSpecies.length === 0 ? (
                  <Alert severity="info">ไม่พบข้อมูลชนิดปลา</Alert>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topSpecies} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        dataKey="name" type="category" width={80}
                        tick={{ fontSize: 11 }} tickLine={false}
                      />
                      <Tooltip
                        formatter={(v) => [`${v.toLocaleString()} ตัว`, 'จำนวน']}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {topSpecies.map((_, i) => (
                          <Cell key={i} fill={SPECIES_COLORS[i % SPECIES_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Grid>

        </Grid>
      </Box>
    </DashboardLayout>
  );
}
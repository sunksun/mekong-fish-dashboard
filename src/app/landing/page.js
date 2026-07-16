'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Container,
  Card,
  CardContent,
  Button,
  Chip,
  alpha,
  AppBar,
  Toolbar,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  CardMedia,
  Skeleton,
  Avatar,
  Dialog,
  DialogContent,
  Fade,
  Pagination,
} from '@mui/material';
import Image from 'next/image';
import {
  WaterDrop,
  Phishing,
  Search,
  ArrowForward,
  Login,
  PersonAdd,
  Announcement,
  ContactMail,
  Gavel,
  Menu as MenuIcon,
  Scale,
  CheckCircle,
  PeopleAlt,
  Close,
  NavigateBefore,
  NavigateNext,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import ChatInterface from '@/components/ChatInterface';

export default function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [fishGallery, setFishGallery] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [fishFamiliesData, setFishFamiliesData] = useState([]);
  const [lightbox, setLightbox] = useState({ open: false, fish: null, photoIndex: 0 });
  const [galleryPage, setGalleryPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  // Format date to Thai Buddhist calendar
  const formatThaiMonth = (date) => {
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const thaiYear = date.getFullYear() + 543;
    return `${months[date.getMonth()]} ${thaiYear}`;
  };

  const [waterLevel, setWaterLevel] = useState({
    current: 0,
    previous: 0,
    change: 0,
    trend: 'stable',
    date: null,
    loading: true
  });

  const [waterLevelChartData, setWaterLevelChartData] = useState([]);

  const [stats, setStats] = useState({
    totalRecords: 0,
    totalWeight: 0,
    verifiedCount: 0,
    totalUsers: 0
  });

  const [visitorCount, setVisitorCount] = useState(0);

  const [dateRange, setDateRange] = useState({ earliest: null, latest: null });

  const [newsArticles, setNewsArticles] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [wisdomItems, setWisdomItems] = useState([]);
  const [loadingWisdom, setLoadingWisdom] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [heroPrices, setHeroPrices] = useState([]);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // ดึงราคาปลาเมื่อวาน สำหรับแสดงบน hero card
  useEffect(() => {
    const fetchHeroPrices = async () => {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        const res = await fetch(`/api/fish-prices?date=${dateStr}`);
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          // สุ่ม 5 ชนิดจากรายการที่มีราคา
          const shuffled = [...data.data].sort(() => Math.random() - 0.5);
          setHeroPrices(shuffled.slice(0, 5).map(f => ({
            name: f.name,
            localName: f.localName || null,
            price: Math.round(f.avgPrice)
          })));
        }
      } catch (e) {
        console.error('fetchHeroPrices error:', e);
      }
    };
    fetchHeroPrices();
  }, []);

  // ─────────────────────────────────────────────────────────
  // Aggregated landing data — เรียก /api/landing-data (server-side + cache 5 นาที)
  // แทน 5 Firestore queries client-side เดิม (ลด reads/visitor จาก ~1,400 เหลือ ~1)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingGallery(true);
        setLoadingNews(true);
        setLoadingWisdom(true);
        const res = await fetch('/api/landing-data');
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'API error');

        setStats({
          totalRecords: json.stats?.totalRecords || 0,
          totalWeight: json.stats?.totalWeight || 0,
          verifiedCount: json.stats?.verifiedCount || 0,
          totalUsers: json.stats?.totalUsers || 0,
        });
        if (json.dateRange?.earliest) {
          setDateRange({
            earliest: new Date(json.dateRange.earliest),
            latest: json.dateRange.latest ? new Date(json.dateRange.latest) : null,
          });
        }
        setIucnCategories(prev => prev.map(cat => ({
          ...cat,
          count: json.iucn?.count?.[cat.code] || 0,
        })));
        setIucnSpeciesAll(json.iucn?.species || { CR: [], EN: [], VU: [] });
        setFishFamiliesData(json.fishFamilies || []);
        setFishGallery(json.fishGallery || []);
        if (json.waterLevel) {
          setWaterLevel({
            current: json.waterLevel.current,
            previous: json.waterLevel.previous,
            change: json.waterLevel.change,
            trend: json.waterLevel.trend,
            date: json.waterLevel.date,
            loading: false,
          });
        } else {
          setWaterLevel(prev => ({ ...prev, loading: false }));
        }
        setWaterLevelChartData(json.waterChart || []);
        setNewsArticles(json.newsArticles || []);
        setWisdomItems(json.wisdomItems || []);
      } catch (error) {
        console.error('landing-data fetch failed:', error);
      } finally {
        if (!cancelled) {
          setLoadingGallery(false);
          setLoadingNews(false);
          setLoadingWisdom(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);


  // Track and fetch site visitors
  useEffect(() => {
    const trackVisitor = async () => {
      try {
        // บันทึกการเข้าชม
        const response = await fetch('/api/site-visitors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setVisitorCount(data.totalVisitors || 0);
        } else {
          console.error('Failed to track visitor');
          // ดึงข้อมูลล่าสุดแทน
          const getResponse = await fetch('/api/site-visitors');
          if (getResponse.ok) {
            const data = await getResponse.json();
            setVisitorCount(data.totalVisitors || 0);
          }
        }
      } catch (error) {
        console.error('Error tracking visitor:', error);
        // ลองดึงข้อมูลล่าสุดแทน
        try {
          const getResponse = await fetch('/api/site-visitors');
          if (getResponse.ok) {
            const data = await getResponse.json();
            setVisitorCount(data.totalVisitors || 0);
          }
        } catch (err) {
          console.error('Error fetching visitor count:', err);
        }
      }
    };

    trackVisitor();
  }, []);

  const [iucnCategories, setIucnCategories] = useState([
    { code: 'CR', label: 'Critically Endangered', labelTh: 'ใกล้สูญพันธุ์อย่างยิ่ง', count: 0, color: '#d32f2f' },
    { code: 'EN', label: 'Endangered', labelTh: 'ใกล้สูญพันธุ์', count: 0, color: '#f57c00' },
    { code: 'VU', label: 'Vulnerable', labelTh: 'มีแนวโน้มใกล้สูญพันธุ์', count: 0, color: '#fbc02d' }
  ]);
  const [iucnSpeciesAll, setIucnSpeciesAll] = useState({ CR: [], EN: [], VU: [] });

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/login?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Helper function to get IUCN status color
  const getIUCNColor = (status) => {
    const colors = {
      'CR': '#d32f2f',  // Critically Endangered - Red
      'EN': '#f57c00',  // Endangered - Orange
      'VU': '#fbc02d',  // Vulnerable - Yellow
      'NT': '#66bb6a',  // Near Threatened - Light Green
      'LC': '#388e3c',  // Least Concern - Green
      'DD': '#757575',  // Data Deficient - Grey
    };
    return colors[status] || colors['DD'];
  };

  const iucnFishPhotoMap = Object.fromEntries(
    ['CR', 'EN', 'VU'].map(code => [
      code,
      iucnSpeciesAll[code].map(s => ({
        id: s.thai_name,
        thai_name: s.thai_name,
        scientific_name: s.scientific_name || '-',
        local_name: s.local_name || null,
        // image_url is resolved server-side: latest fishingRecords photo → catalog → icon
        imageUrl: s.image_url || null,
      }))
    ])
  );

  return (
    <Box>
      {/* Header / Navigation */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'white',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Container maxWidth="lg">
          <Toolbar sx={{ py: 1, px: { xs: 0 } }}>
            {/* Logo & Brand */}
            <Box
              display="flex"
              alignItems="center"
              gap={1.5}
              sx={{ cursor: 'pointer' }}
              onClick={() => router.push('/landing')}
            >
              <Image
                src="/icons/fishing-spot-marker.svg"
                alt="Fishing Spot Marker"
                width={40}
                height={40}
              />
              <Box>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  color="primary"
                  sx={{ lineHeight: 1.2 }}
                >
                  Mekong Fish
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ lineHeight: 1 }}
                >
                  ฐานข้อมูลปลาแม่น้ำโขง
                </Typography>
              </Box>
            </Box>

            {/* AI Chat Button - Desktop */}
            <Box
              sx={{
                flex: 1,
                mx: 4,
                display: { xs: 'none', md: 'block' }
              }}
            >
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Search />}
                onClick={() => setChatDialogOpen(true)}
                sx={{
                  borderRadius: 2,
                  bgcolor: 'grey.50',
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  color: 'text.secondary',
                  borderColor: 'grey.300',
                  py: 0.75,
                  '&:hover': {
                    bgcolor: 'grey.100',
                    borderColor: 'primary.main'
                  }
                }}
              >
                ถามเกี่ยวกับปลาแม่น้ำโขง... 🐟 (AI)
              </Button>
            </Box>

            {/* Navigation Links - Desktop */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center' }}>
              <Button
                startIcon={<Announcement />}
                color="inherit"
                sx={{ color: 'text.secondary' }}
              >
                What&apos;s New
              </Button>
              <Button
                startIcon={<ContactMail />}
                color="inherit"
                sx={{ color: 'text.secondary' }}
              >
                Contact
              </Button>
              <Button
                startIcon={<Gavel />}
                color="inherit"
                sx={{ color: 'text.secondary' }}
              >
                Terms
              </Button>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Button
                variant="outlined"
                startIcon={<Login />}
                onClick={() => router.push('/login')}
                sx={{ borderRadius: 2 }}
              >
                Login
              </Button>
              <Button
                variant="contained"
                startIcon={<PersonAdd />}
                onClick={() => router.push('/register')}
                sx={{ borderRadius: 2 }}
              >
                Register
              </Button>
            </Box>

            {/* Mobile Menu Button */}
            <IconButton
              sx={{ display: { xs: 'flex', md: 'none' }, ml: 'auto' }}
              onClick={handleMenuOpen}
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>

          {/* AI Chat Button - Mobile */}
          <Box
            sx={{
              pb: 2,
              px: 2,
              display: { xs: 'block', md: 'none' }
            }}
          >
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Search />}
              onClick={() => setChatDialogOpen(true)}
              sx={{
                borderRadius: 2,
                bgcolor: 'grey.50',
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: 'text.secondary',
                borderColor: 'grey.300',
                py: 1
              }}
            >
              ถามเกี่ยวกับปลาแม่น้ำโขง... 🐟
            </Button>
          </Box>
        </Container>
      </AppBar>

      {/* Mobile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { width: 250, mt: 1 }
        }}
      >
        <MenuItem onClick={() => { handleMenuClose(); }}>
          <Announcement sx={{ mr: 2 }} /> What&apos;s New
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); }}>
          <ContactMail sx={{ mr: 2 }} /> Contact
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); }}>
          <Gavel sx={{ mr: 2 }} /> Terms of Use
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { handleMenuClose(); router.push('/login'); }}>
          <Login sx={{ mr: 2 }} /> Login
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); router.push('/register'); }}>
          <PersonAdd sx={{ mr: 2 }} /> Register
        </MenuItem>
      </Menu>

      {/* Hero Section */}
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: '50vh', md: '60vh' },
          color: 'white',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          // Background Image Layer
          backgroundImage: 'url("/IMG_2769.JPG")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          // Dark Overlay for better text readability
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent dark overlay
            zIndex: 1
          },
          // Pattern Overlay
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.03"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            zIndex: 2
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 3, py: { xs: 6, md: 10 } }}>

          {/* Fish Price Card — มุมบนขวา */}
          <Box sx={{
            display: { xs: 'none', md: 'block' },
            position: 'absolute',
            top: 32,
            right: 0,
            width: 340,
            bgcolor: alpha('#000000', 0.45),
            backdropFilter: 'blur(8px)',
            borderRadius: 2,
            border: `1px solid ${alpha('#ffffff', 0.2)}`,
            p: 1.5,
          }}>
            <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.7), display: 'block', mb: 1, fontWeight: 600, letterSpacing: 0.5 }}>
              ราคาปลาวันนี้ (อ.เชียงคาน)
            </Typography>
            {heroPrices.length === 0 ? (
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.5), fontSize: '0.7rem' }}>
                ไม่พบข้อมูลราคา
              </Typography>
            ) : heroPrices.map((fish) => (
              <Box key={fish.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.4 }}>
                <Typography variant="caption" sx={{ color: 'white', fontSize: '0.75rem' }}>
                  {fish.name}{fish.localName ? ` (${fish.localName})` : ''}
                </Typography>
                <Typography variant="caption" sx={{ color: '#ffd54f', fontWeight: 700, fontSize: '0.75rem' }}>
                  {fish.price} บาท/กก.
                </Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ maxWidth: { xs: '100%', md: '60%' } }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h2" fontWeight="bold" sx={{ fontSize: { xs: '1.8rem', md: '3rem' }, lineHeight: 1.2, mb: 1 }}>
                ฐานข้อมูลปลาแม่น้ำโขง
              </Typography>
              <Typography variant="h5" sx={{ opacity: 0.95, fontSize: { xs: '1rem', md: '1.3rem' } }}>
                อ.เชียงคาน ถึง อ.ปากชม จ.เลย
              </Typography>
            </Box>

            <Typography variant="body1" sx={{ mb: 4, opacity: 0.95, fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.8 }}>
              ระบบจัดการข้อมูลชนิดปลาในแม่น้ำโขง รวมถึงสถานะการอนุรักษ์ ระดับน้ำ และข้อมูลสิ่งแวดล้อม
              เพื่อสนับสนุนการอนุรักษ์และการใช้ประโยชน์อย่างยั่งยืน
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<Search />}
                onClick={() => router.push('/login')}
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  '&:hover': {
                    bgcolor: alpha('#ffffff', 0.9)
                  }
                }}
              >
                เข้าสู่ระบบ
              </Button>
              <Button
                variant="outlined"
                size="large"
                endIcon={<ArrowForward />}
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  '&:hover': {
                    borderColor: 'white',
                    bgcolor: alpha('#ffffff', 0.1)
                  }
                }}
              >
                เรียนรู้เพิ่มเติม
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Water Level Section */}
      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: 'white' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={4}>
            <Typography variant="h4" fontWeight="bold" gutterBottom color="primary.main">
              ระดับน้ำแม่น้ำโขง
            </Typography>
            <Typography variant="body1" color="text.secondary">
              สถานีตรวจวัด: เชียงคาน, จังหวัดเลย
            </Typography>
          </Box>

          {/* Water Level Chart */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                กราฟแสดงระดับน้ำ (30 วันย้อนหลัง)
              </Typography>
              {waterLevel.loading ? (
                <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Skeleton variant="rectangular" width="100%" height={400} />
                </Box>
              ) : waterLevelChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={waterLevelChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="displayDate" />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      label={{ value: 'ระดับน้ำ (ม.รทก.)', angle: -90, position: 'insideLeft' }}
                      domain={['auto', 'auto']}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      label={{ value: 'ปริมาณน้ำฝน (มม.)', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <Box
                              sx={{
                                bgcolor: 'background.paper',
                                p: 2,
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1
                              }}
                            >
                              <Typography variant="body2" fontWeight="bold">
                                วันที่: {new Date(data.date).toLocaleDateString('th-TH')}
                              </Typography>
                              <Typography variant="body2" color="primary">
                                ระดับน้ำ: {data.level?.toFixed(2)} ม.รทก.
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#74c0fc' }}>
                                ปริมาณน้ำฝน: {data.rainfall?.toFixed(1)} มม.
                              </Typography>
                            </Box>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="level"
                      stroke="#1976d2"
                      strokeWidth={2}
                      name="ระดับน้ำ"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="rainfall"
                      stroke="#74c0fc"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      name="ปริมาณน้ำฝน"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <WaterDrop sx={{ fontSize: 80, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    ไม่พบข้อมูลระดับน้ำ
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Container>
      </Box>

      {/* Fish Gallery Section */}
      <Box id="fish-gallery-section" sx={{ py: { xs: 6, md: 8 }, bgcolor: '#f8f9fa' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              ฐานข้อมูลปลาแม่น้ำโขง
            </Typography>
            {dateRange.earliest && dateRange.latest && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                ตั้งแต่ช่วงเดือน {formatThaiMonth(dateRange.earliest)} - {formatThaiMonth(dateRange.latest)}
              </Typography>
            )}
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto' }}>
              ชมภาพปลาหลากหลายชนิดจากฐานข้อมูลของเรา พร้อมข้อมูลรายละเอียดและสถานะการอนุรักษ์
            </Typography>
          </Box>

        {loadingGallery ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: { xs: 2, sm: 3 } }}>
            {[...Array(30)].map((_, index) => (
              <Box key={`gallery-skeleton-${index}`}>
                <Card sx={{ height: '100%' }}>
                  <Box sx={{ position: 'relative', width: '100%', paddingTop: '75%' }}>
                    <Skeleton
                      variant="rectangular"
                      sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                    />
                  </Box>
                  <CardContent sx={{ p: 2 }}>
                    <Skeleton variant="text" height={28} />
                    <Skeleton variant="text" height={20} />
                    <Skeleton variant="text" height={20} />
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        ) : fishGallery.length > 0 ? (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: { xs: 2, sm: 3 } }}>
              {fishGallery.slice((galleryPage - 1) * ITEMS_PER_PAGE, galleryPage * ITEMS_PER_PAGE).map((fish) => (
                <Box key={fish.id}>
                  <Card
                    onClick={() => setLightbox({ open: true, fish, photoIndex: 0 })}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                      }
                    }}
                  >
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      paddingTop: '75%',
                      bgcolor: '#f0f0f0',
                      overflow: 'hidden'
                    }}
                  >
                    <CardMedia
                      component="img"
                      image={fish.imageUrl || '/placeholder-fish.jpg'}
                      alt={fish.thai_name}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />

                  </Box>
                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: { xs: 1.5, sm: 2.5 } }}>
                      <Box sx={{ mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip
                          label={fish.family_thai}
                          size="small"
                          sx={{
                            bgcolor: 'primary.light',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.75rem'
                          }}
                        />
                        <Chip
                          label={fish.iucn_status}
                          size="small"
                          sx={{
                            bgcolor: getIUCNColor(fish.iucn_status),
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.75rem'
                          }}
                        />
                        {fish.photoCount > 1 && (
                          <Chip
                            label={`${fish.photoCount} รูป`}
                            size="small"
                            sx={{
                              bgcolor: 'grey.700',
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                        )}
                        {fish.displayCatchDate && (
                          <Chip
                            label={formatThaiMonth(
                              fish.displayCatchDate.toDate
                                ? fish.displayCatchDate.toDate()
                                : new Date(fish.displayCatchDate)
                            )}
                            size="small"
                            sx={{
                              bgcolor: 'info.main',
                              color: 'white',
                              fontSize: '0.7rem'
                            }}
                          />
                        )}
                      </Box>

                      <Typography
                        variant="h6"
                        fontWeight="bold"
                        gutterBottom
                        sx={{
                          mb: 1,
                          fontSize: { xs: '0.95rem', sm: '1.25rem' }
                        }}
                      >
                        {fish.thai_name}
                      </Typography>

                      {fish.local_name && fish.local_name !== fish.thai_name && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 0.5,
                            fontSize: { xs: '0.75rem', sm: '0.875rem' },
                            display: { xs: 'none', sm: 'block' }
                          }}
                        >
                          <strong>ชื่อท้องถิ่น:</strong> {fish.local_name}
                        </Typography>
                      )}

                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontStyle="italic"
                        sx={{
                          mb: 1.5,
                          fontSize: { xs: '0.7rem', sm: '0.75rem' },
                          display: { xs: 'none', sm: 'block' }
                        }}
                      >
                        {fish.scientific_name}
                      </Typography>

                      {(fish.totalQuantity || fish.totalWeight) && (
                        <Box sx={{ mt: 'auto', pt: { xs: 1, sm: 1.5 }, borderTop: 1, borderColor: 'divider' }}>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: { xs: 1, sm: 2 } }}>
                            {fish.totalQuantity && (
                              <Box>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                                >
                                  จำนวน
                                </Typography>
                                <Typography
                                  variant="body1"
                                  fontWeight="bold"
                                  color="primary"
                                  sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }}
                                >
                                  {fish.totalQuantity} ตัว
                                </Typography>
                              </Box>
                            )}
                            {fish.totalWeight && (
                              <Box>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                                >
                                  น้ำหนัก
                                </Typography>
                                <Typography
                                  variant="body1"
                                  fontWeight="bold"
                                  color="success.main"
                                  sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }}
                                >
                                  {fish.totalWeight} กก.
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>

            {fishGallery.length > ITEMS_PER_PAGE && (
              <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  แสดง {Math.min(galleryPage * ITEMS_PER_PAGE, fishGallery.length)} จาก {fishGallery.length} ชนิด
                </Typography>
                <Pagination
                  count={Math.ceil(fishGallery.length / ITEMS_PER_PAGE)}
                  page={galleryPage}
                  onChange={(_, page) => {
                    setGalleryPage(page);
                    document.getElementById('fish-gallery-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                />
              </Box>
            )}
          </>
        ) : (
          <Box textAlign="center" py={4}>
            <Phishing sx={{ fontSize: 80, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              ไม่พบข้อมูลภาพปลา
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              ปลาทั้งหมดยังไม่มีรูปภาพ หรือยังไม่ได้รับการยืนยัน
            </Typography>
          </Box>
        )}
        </Container>
      </Box>

      {/* Lightbox Dialog - ดูรูปปลาขนาดใหญ่ */}
      <Dialog
        open={lightbox.open}
        onClose={() => setLightbox({ open: false, fish: null, photoIndex: 0 })}
        maxWidth="md"
        fullWidth
        slots={{ transition: Fade }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'black',
              borderRadius: 2,
              overflow: 'hidden'
            }
          }
        }}
      >
        {lightbox.fish && (
          <DialogContent sx={{ p: 0, position: 'relative', bgcolor: 'black' }}>
            {/* ปุ่มปิด */}
            <IconButton
              onClick={() => setLightbox({ open: false, fish: null, photoIndex: 0 })}
              sx={{
                position: 'absolute', top: 8, right: 8, zIndex: 10,
                bgcolor: 'rgba(0,0,0,0.6)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' }
              }}
            >
              <Close />
            </IconButton>

            {/* รูปภาพหลัก */}
            <Box
              component="img"
              src={lightbox.fish.photos?.[lightbox.photoIndex] || lightbox.fish.imageUrl}
              alt={lightbox.fish.thai_name}
              sx={{
                width: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                display: 'block',
                bgcolor: 'black'
              }}
            />

            {/* ปุ่มเลื่อนรูป (ถ้ามีหลายรูป) */}
            {lightbox.fish.photos?.length > 1 && (
              <>
                <IconButton
                  onClick={() => setLightbox(prev => ({
                    ...prev,
                    photoIndex: (prev.photoIndex - 1 + prev.fish.photos.length) % prev.fish.photos.length
                  }))}
                  sx={{
                    position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                    bgcolor: 'rgba(0,0,0,0.6)', color: 'white',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' }
                  }}
                >
                  <NavigateBefore />
                </IconButton>
                <IconButton
                  onClick={() => setLightbox(prev => ({
                    ...prev,
                    photoIndex: (prev.photoIndex + 1) % prev.fish.photos.length
                  }))}
                  sx={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    bgcolor: 'rgba(0,0,0,0.6)', color: 'white',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' }
                  }}
                >
                  <NavigateNext />
                </IconButton>
              </>
            )}

            {/* ข้อมูลปลาด้านล่าง */}
            <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.85)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Chip label={lightbox.fish.family_thai} size="small" sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 600 }} />
                <Chip label={lightbox.fish.iucn_status} size="small" sx={{ bgcolor: getIUCNColor(lightbox.fish.iucn_status), color: 'white', fontWeight: 600 }} />
                {lightbox.fish.photos?.length > 1 && (
                  <Chip label={`${lightbox.photoIndex + 1} / ${lightbox.fish.photos.length} รูป`} size="small" sx={{ bgcolor: 'grey.700', color: 'white' }} />
                )}
                {(() => {
                  const currentPhotoDate = lightbox.fish.photosWithDates?.[lightbox.photoIndex]?.date
                    || lightbox.fish.displayCatchDate;
                  return currentPhotoDate ? (
                    <Chip
                      label={formatThaiMonth(
                        currentPhotoDate.toDate
                          ? currentPhotoDate.toDate()
                          : new Date(currentPhotoDate)
                      )}
                      size="small"
                      sx={{
                        bgcolor: 'info.main',
                        color: 'white'
                      }}
                    />
                  ) : null;
                })()}
              </Box>
              <Typography variant="h6" fontWeight="bold" color="white">
                {lightbox.fish.thai_name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                <Typography variant="body2" color="grey.400">
                  จำนวน: <strong style={{ color: 'white' }}>{lightbox.fish.totalQuantity} ตัว</strong>
                </Typography>
                <Typography variant="body2" color="grey.400">
                  น้ำหนัก: <strong style={{ color: 'white' }}>{lightbox.fish.totalWeight} กก.</strong>
                </Typography>
              </Box>
            </Box>
          </DialogContent>
        )}
      </Dialog>

      {/* Fish Families Section - วงศ์ปลาที่ค้นพบ */}
      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: 'white' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              วงศ์ปลาที่ค้นพบ
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto' }}>
              การจัดกลุ่มปลาตามวงศ์ เพื่อศึกษาความหลากหลายทางชีวภาพในแม่น้ำโขง
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 2 }}>
            {fishFamiliesData.map((family, index) => (
              <Box key={family.name || family.thai || `family-${index}`}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4
                    },
                    border: `2px solid ${family.color}`,
                    bgcolor: 'white'
                  }}
                >
                  <Box
                    sx={{
                      width: '100%',
                      textAlign: 'center',
                      p: 2,
                      borderRadius: 1,
                      bgcolor: `${family.color}15`,
                      mb: 2
                    }}
                  >
                    <Typography variant="h6" fontWeight="bold" sx={{ color: family.color, fontSize: '0.9rem' }}>
                      {family.name}
                    </Typography>
                  </Box>

                  <Typography variant="h3" fontWeight="bold" sx={{ color: family.color, mb: 1 }}>
                    {family.percentage}%
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    {family.count} ชนิด
                  </Typography>
                </Card>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* IUCN Categories Section */}
      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: '#f0f7ff' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              สถานะการอนุรักษ์ตามเกณฑ์ IUCN
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto' }}>
              การจำแนกสถานะของปลาตามมาตรฐาน IUCN Red List
              เพื่อติดตามและอนุรักษ์ชนิดพันธุ์ที่ใกล้สูญพันธุ์
            </Typography>
          </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3, maxWidth: 800, mx: 'auto' }}>
          {iucnCategories.map((category) => (
            <Box key={category.code}>
              <Card
                sx={{
                  height: '100%',
                  borderTop: 3,
                  borderColor: category.color,
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Chip
                      label={category.code}
                      size="small"
                      sx={{
                        bgcolor: category.color,
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    />
                    <Typography variant="h5" fontWeight="bold">
                      {category.count} <Typography component="span" variant="body1" color="text.secondary">ชนิด</Typography>
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {category.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                    ({category.labelTh})
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>

          {/* IUCN Fish Photo Strips */}
          {iucnCategories.map(category => {
            const items = iucnFishPhotoMap[category.code];
            if (!items || items.length === 0) return null;
            const withPhoto = items.filter(f => f.imageUrl).length;
            return (
              <Box key={`strip-${category.code}`} sx={{ mt: 4 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                  <Chip
                    label={category.code}
                    size="small"
                    sx={{ bgcolor: category.color, color: 'white', fontWeight: 'bold' }}
                  />
                  <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">
                    {category.labelTh}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    ({items.length} ชนิด · มีภาพ {withPhoto} ชนิด)
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex', gap: 2, overflowX: 'auto', pb: 1,
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-track': { bgcolor: 'grey.100', borderRadius: 3 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: category.color, borderRadius: 3 },
                  }}
                >
                  {items.map(fish => (
                    <Box
                      key={fish.id}
                      onClick={() => fish.imageUrl && setLightbox({ open: true, fish, photoIndex: 0 })}
                      sx={{
                        flexShrink: 0,
                        width: { xs: 130, sm: 160 },
                        cursor: fish.imageUrl ? 'pointer' : 'default',
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: `2px solid ${alpha(category.color, fish.imageUrl ? 0.3 : 0.15)}`,
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        ...(fish.imageUrl && {
                          '&:hover': { transform: 'translateY(-4px)', boxShadow: 4, borderColor: category.color },
                        }),
                        bgcolor: 'white',
                      }}
                    >
                      <Box sx={{ position: 'relative', paddingTop: '75%', bgcolor: fish.imageUrl ? '#f0f0f0' : alpha(category.color, 0.08) }}>
                        {fish.imageUrl ? (
                          <CardMedia
                            component="img"
                            image={fish.imageUrl}
                            alt={fish.thai_name}
                            sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ fontSize: '2rem', opacity: 0.3 }}>🐟</Typography>
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ p: 1 }}>
                        <Typography variant="caption" fontWeight="bold" display="block" noWrap sx={{ fontSize: '0.75rem', color: fish.imageUrl ? 'text.primary' : 'text.secondary' }}>
                          {fish.thai_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontStyle="italic" display="block" noWrap sx={{ fontSize: '0.65rem' }}>
                          {fish.scientific_name !== '-' ? fish.scientific_name : ''}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })}
        </Container>
      </Box>

      {/* News Section */}
      <Box sx={{ bgcolor: 'white', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              News from mekongfish.info
            </Typography>
            <Typography variant="body1" color="text.secondary">
              ข่าวสารและบทความล่าสุดเกี่ยวกับปลาและระบบนิเวศแม่น้ำโขง
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {loadingNews ? (
              // Loading skeletons
              [...Array(3)].map((_, index) => (
                <Box key={`skeleton-${index}`}>
                  <Card sx={{ height: '100%' }}>
                    <Skeleton variant="rectangular" height={140} />
                    <CardContent sx={{ p: 2 }}>
                      <Skeleton variant="rectangular" width={80} height={20} sx={{ mb: 1, borderRadius: 1 }} />
                      <Skeleton variant="text" width="40%" height={16} sx={{ mb: 1.5 }} />
                      <Skeleton variant="text" height={24} sx={{ mb: 1 }} />
                      <Skeleton variant="text" height={20} />
                      <Skeleton variant="text" height={20} width="80%" />
                      <Skeleton variant="text" width={100} height={24} sx={{ mt: 1.5 }} />
                    </CardContent>
                  </Card>
                </Box>
              ))
            ) : (
              // Actual news articles
              newsArticles.map((news) => (
                <Box key={news.id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: 6,
                        cursor: 'pointer'
                      }
                    }}
                  >
                    <CardMedia
                      component="img"
                      height="140"
                      image={news.image}
                      alt={news.title}
                      sx={{ objectFit: 'cover' }}
                    />
                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
                      <Box sx={{ mb: 1.5 }}>
                        <Chip
                          label={news.category}
                          size="small"
                          color="primary"
                          sx={{ mb: 0.5, fontSize: '0.7rem', height: 20 }}
                        />
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
                          {news.date}
                        </Typography>
                      </Box>

                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ fontSize: '0.95rem' }}>
                        {news.title}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          flexGrow: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          fontSize: '0.85rem'
                        }}
                      >
                        {news.summary}
                      </Typography>

                      <Box sx={{ mt: 1.5 }}>
                        <Button
                          size="small"
                          endIcon={<ArrowForward />}
                          onClick={() => typeof news.id === 'string' && router.push(`/news/${news.id}`)}
                          disabled={typeof news.id !== 'string'}
                          sx={{ textTransform: 'none', fontSize: '0.8rem', p: 0.5 }}
                        >
                          อ่านเพิ่มเติม
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              ))
            )}
          </Box>

          <Box textAlign="center" mt={5}>
            <Button
              variant="outlined"
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => router.push('/news-list')}
              sx={{ textTransform: 'none', borderRadius: 3, px: 4 }}
            >
              อ่านข้อมูลเพิ่มเติม
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Local Wisdom Section */}
      <Box sx={{ bgcolor: '#f0f7ff', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              ความรู้ท้องถิ่น
            </Typography>
            <Typography variant="body1" color="text.secondary">
              ภูมิปัญญาชาวบ้านและองค์ความรู้ด้านการประมงพื้นบ้านแม่น้ำโขง
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
            {loadingWisdom ? (
              [...Array(3)].map((_, i) => (
                <Card key={`wisdom-skeleton-${i}`} sx={{ height: 220, bgcolor: 'rgba(255,255,255,0.6)' }} />
              ))
            ) : wisdomItems.length === 0 ? (
              <Box sx={{ gridColumn: '1/-1', textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">ยังไม่มีข้อมูลความรู้ท้องถิ่น</Typography>
              </Box>
            ) : (
              wisdomItems.map(item => (
                <Card key={item.id} sx={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-8px)', boxShadow: 6, cursor: 'pointer' }
                }}>
                  {item.image && (
                    <Box
                      component="img"
                      src={item.image}
                      alt={item.title}
                      sx={{ width: '100%', height: 160, objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2.5 }}>
                    <Box sx={{ mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label={item.category || 'ทั่วไป'} size="small" color="success" sx={{ fontSize: '0.7rem', height: 20 }} />
                      {item.fishType && (
                        <Chip label={item.fishType} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
                      )}
                    </Box>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ fontSize: '0.95rem', lineHeight: 1.4 }}>
                      {item.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                        fontSize: '0.85rem', lineHeight: 1.6
                      }}
                    >
                      {item.description}
                    </Typography>
                    {item.season && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                        ฤดูกาล: {item.season}
                      </Typography>
                    )}
                    {item.contributorName && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        โดย: {item.contributorName}
                      </Typography>
                    )}
                    <Box sx={{ mt: 1.5 }}>
                      <Button
                        size="small"
                        endIcon={<ArrowForward />}
                        onClick={() => router.push(`/wisdom/${item.id}`)}
                        sx={{ textTransform: 'none', fontSize: '0.8rem', p: 0.5 }}
                      >
                        อ่านเพิ่มเติม
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>

          <Box textAlign="center" mt={5}>
            <Button
              variant="outlined"
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => router.push('/wisdom-list')}
              sx={{ textTransform: 'none', borderRadius: 3, px: 4, borderColor: '#1565c0', color: '#1565c0' }}
            >
              ดูความรู้ท้องถิ่นทั้งหมด
            </Button>
          </Box>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: '#f8f9fa' }}>
        <Container maxWidth="lg">
          <Card
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              p: 6,
              textAlign: 'center'
            }}
          >
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            เริ่มต้นใช้งานวันนี้
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, opacity: 0.95 }}>
            เข้าร่วมเป็นส่วนหนึ่งในการอนุรักษ์ปลาและระบบนิเวศแม่น้ำโขง
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push('/login')}
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              px: 5,
              py: 1.5,
              fontSize: '1.1rem',
              '&:hover': {
                bgcolor: alpha('#ffffff', 0.9)
              }
            }}
          >
            เข้าสู่ระบบ
          </Button>
          </Card>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: 'grey.900', color: 'white', py: 6 }}>
        <Container maxWidth="lg">
          {/* Stats Section in Footer */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom textAlign="center" sx={{ mb: 3 }}>
              ภาพรวมข้อมูลการจับปลาและการใช้งานระบบ
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3 }}>
                <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <Phishing />
                        </Avatar>
                        <Box>
                          <Typography variant="h5" fontWeight="bold" color="white">
                            {stats.totalRecords}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.8, color: 'white' }}>
                            การจับปลาทั้งหมด
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: 'success.main' }}>
                          <Scale />
                        </Avatar>
                        <Box>
                          <Typography variant="h5" fontWeight="bold" color="white">
                            {stats.totalWeight.toFixed(1)}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.8, color: 'white' }}>
                            น้ำหนักรวม (กก.)
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: 'info.main' }}>
                          <CheckCircle />
                        </Avatar>
                        <Box>
                          <Typography variant="h5" fontWeight="bold" color="white">
                            {stats.verifiedCount}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.8, color: 'white' }}>
                            ยืนยันแล้ว
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: 'secondary.main' }}>
                          <PeopleAlt />
                        </Avatar>
                        <Box>
                          <Typography variant="h5" fontWeight="bold" color="white">
                            {stats.totalUsers}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.8, color: 'white' }}>
                            จำนวนชาวประมง
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
            </Box>
          </Box>

          <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', mb: 4 }} />

          {/* Visitor Count */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="body1" sx={{ opacity: 0.8 }}>
              เข้าชมทั้งหมด: <strong>{visitorCount.toLocaleString()}</strong> ครั้ง
            </Typography>
          </Box>

          {/* Footer Info */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 4 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Mekong Fish Dashboard
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                ระบบจัดการข้อมูลปลาแม่น้ำโขง เพื่อการอนุรักษ์และการใช้ประโยชน์อย่างยั่งยืน
              </Typography>
            </Box>
            <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                © 2025 Mekong Fish Dashboard. All rights reserved.
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.6, mt: 1 }}>
                แหล่งข้อมูล: ศูนย์วิจัยและพัฒนาประมงน้ำจืดเลย, IUCN Red List
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* AI Chat Dialog */}
      <Dialog
        open={chatDialogOpen}
        onClose={() => setChatDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            minHeight: '600px'
          }
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">
            🐟 ถามคำถามเกี่ยวกับปลาแม่น้ำโขง
          </Typography>
          <IconButton onClick={() => setChatDialogOpen(false)} size="small">
            <Close />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          <ChatInterface placeholder="พิมพ์คำถามของคุณ... เช่น ปลาอะไรจับได้บ่อยที่สุด" />
        </DialogContent>
      </Dialog>

    </Box>
  );
}

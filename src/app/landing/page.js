'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Container,
  Grid,
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
  Skeleton
} from '@mui/material';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
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
  Menu as MenuIcon
} from '@mui/icons-material';
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

export default function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [fishGallery, setFishGallery] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(true);

  const [waterLevel, setWaterLevel] = useState({
    current: 0,
    previous: 0,
    change: 0,
    trend: 'stable',
    date: null,
    loading: true
  });

  const [waterLevelChartData, setWaterLevelChartData] = useState([]);

  // Fetch fishing records from Firestore
  useEffect(() => {
    const fetchFishingRecords = async () => {
      try {
        setLoadingGallery(true);

        // Fetch ALL fishing records from Firestore (similar to dashboard)
        const recordsRef = collection(db, 'fishingRecords');
        const querySnapshot = await getDocs(recordsRef);

        const allRecords = [];
        querySnapshot.forEach((doc) => {
          allRecords.push({ id: doc.id, ...doc.data() });
        });

        console.log('Total fishing records fetched:', allRecords.length);

        // Filter only verified records (similar to dashboard)
        const verifiedRecords = allRecords.filter(record => record.verified === true);
        console.log('Verified records:', verifiedRecords.length);

        // Process fish data from verified records only
        const fishDataMap = new Map();
        const speciesSet = new Set(); // Track unique species
        let totalWeight = 0;
        let totalValue = 0;

        verifiedRecords.forEach(record => {
          // Add to totals
          totalWeight += Number(record.totalWeight) || 0;
          totalValue += Number(record.totalValue) || 0;

          // Process each fish in the record
          if (record.fishData && Array.isArray(record.fishData)) {
            record.fishData.forEach(fish => {
              const speciesName = fish.species || 'Unknown';

              // Add to unique species set
              if (speciesName && speciesName !== 'Unknown') {
                speciesSet.add(speciesName);
              }

              // Aggregate fish data for gallery
              if (!fishDataMap.has(speciesName)) {
                fishDataMap.set(speciesName, {
                  species: fish.species,
                  photo: fish.photo || null,
                  quantity: Number(fish.quantity) || 0,
                  weight: Number(fish.weight) || 0,
                  estimatedValue: Number(fish.estimatedValue) || 0,
                  category: fish.category || 'MEDIUM'
                });
              } else {
                const existing = fishDataMap.get(speciesName);
                existing.quantity += Number(fish.quantity) || 0;
                existing.weight += Number(fish.weight) || 0;
                existing.estimatedValue += Number(fish.estimatedValue) || 0;
              }
            });
          }
        });

        // Convert map to array and take top 3
        const fishArray = Array.from(fishDataMap.values())
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 3)
          .map((fish, index) => ({
            id: index + 1,
            imageUrl: fish.photo || `https://placehold.co/600x400/1976d2/ffffff?text=${encodeURIComponent(fish.species)}`,
            thai_name: fish.species,
            local_name: fish.species,
            scientific_name: '-',
            family_thai: '-',
            iucn_status: 'LC',
            totalQuantity: fish.quantity,
            totalWeight: fish.weight.toFixed(1),
            totalValue: fish.estimatedValue
          }));

        setFishGallery(fishArray);
        setLoadingGallery(false);
      } catch (error) {
        console.error('Error fetching fishing records:', error);

        // Fallback to mock data on error
        const mockFishData = [
          {
            id: 1,
            imageUrl: 'https://placehold.co/600x400/1976d2/ffffff?text=Fish+1',
            family_thai: 'วงศ์ปลาตะเพียน',
            thai_name: 'ปลาตะเพียน',
            local_name: 'ปลาตะเพียนขาว',
            scientific_name: 'Barbonymus gonionotus',
            iucn_status: 'LC'
          },
          {
            id: 2,
            imageUrl: 'https://placehold.co/600x400/f57c00/ffffff?text=Fish+2',
            family_thai: 'วงศ์ปลาสร้อย',
            thai_name: 'ปลาสร้อยขาว',
            local_name: 'ปลาบึก',
            scientific_name: 'Pangasianodon gigas',
            iucn_status: 'CR'
          },
          {
            id: 3,
            imageUrl: 'https://placehold.co/600x400/388e3c/ffffff?text=Fish+3',
            family_thai: 'วงศ์ปลาไน',
            thai_name: 'ปลาไนจักรพรรดิ',
            local_name: 'ปลาไนใหญ่',
            scientific_name: 'Chitala ornata',
            iucn_status: 'EN'
          }
        ];

        setFishGallery(mockFishData);
        setLoadingGallery(false);
      }
    };

    fetchFishingRecords();
  }, []);

  // Fetch water level data for chart
  useEffect(() => {
    const fetchWaterLevel = async () => {
      try {
        const waterLevelRef = collection(db, 'waterLevels');
        const q = query(waterLevelRef, orderBy('date', 'desc'), orderBy('time', 'desc'), limit(30));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Set current water level info (latest 2 records)
          if (records.length >= 2) {
            const latest = records[0];
            const previous = records[1];
            const currentLevel = latest.currentLevel;
            const previousLevel = previous.currentLevel;
            const change = currentLevel - previousLevel;

            let trend = 'stable';
            if (change > 0.05) trend = 'rising';
            else if (change < -0.05) trend = 'falling';

            setWaterLevel({
              current: currentLevel,
              previous: previousLevel,
              change: change,
              trend: trend,
              date: latest.date,
              loading: false
            });
          } else if (records.length === 1) {
            setWaterLevel({
              current: records[0].currentLevel,
              previous: 0,
              change: 0,
              trend: 'stable',
              date: records[0].date,
              loading: false
            });
          }

          // Prepare chart data (reverse to show oldest to newest)
          const chartData = records.reverse().map(record => {
            const dateObj = new Date(record.date);
            return {
              date: record.date,
              displayDate: `${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
              currentLevel: record.currentLevel,
              avgLevel: record.avgLevel || null,
              maxLevel: record.maxLevel || null,
              minLevel: record.minLevel || null
            };
          });

          setWaterLevelChartData(chartData);
        } else {
          setWaterLevel(prev => ({ ...prev, loading: false }));
          setWaterLevelChartData([]);
        }
      } catch (error) {
        console.error('Error fetching water level:', error);
        setWaterLevel(prev => ({ ...prev, loading: false }));
        setWaterLevelChartData([]);
      }
    };

    fetchWaterLevel();
  }, []);

  const iucnCategories = [
    { code: 'CR', label: 'Critically Endangered', count: 4, color: '#d32f2f' },
    { code: 'EN', label: 'Endangered', count: 5, color: '#f57c00' },
    { code: 'VU', label: 'Vulnerable', count: 3, color: '#fbc02d' },
    { code: 'LC', label: 'Least Concern', count: 45, color: '#388e3c' },
    { code: 'DD', label: 'Data Deficient', count: 36, color: '#757575' }
  ];

  // Mock data สำหรับวงศ์ปลาที่ค้นพบ
  const fishFamilies = [
    { name: 'วงศ์ปลาตะเพียน', count: 15, percentage: 16.1, color: '#1976d2' },
    { name: 'วงศ์ปลาสร้อย', count: 12, percentage: 12.9, color: '#f57c00' },
    { name: 'วงศ์ปลาไน', count: 10, percentage: 10.8, color: '#388e3c' },
    { name: 'วงศ์ปลาดุก', count: 9, percentage: 9.7, color: '#d32f2f' },
    { name: 'วงศ์ปลาช่อน', count: 8, percentage: 8.6, color: '#9c27b0' },
    { name: 'วงศ์ปลากระดี่', count: 7, percentage: 7.5, color: '#00acc1' },
    { name: 'วงศ์ปลาหมอ', count: 6, percentage: 6.5, color: '#fbc02d' },
    { name: 'วงศ์ปลากด', count: 5, percentage: 5.4, color: '#e91e63' },
    { name: 'วงศ์อื่นๆ', count: 21, percentage: 22.5, color: '#757575' }
  ];

  // Mock data สำหรับข่าว
  const newsArticles = [
    {
      id: 1,
      title: 'การสำรวจปลาแม่น้ำโขงครั้งใหม่ พบชนิดพันธุ์ใหม่ 5 ชนิด',
      summary: 'นักวิจัยจากมหาวิทยาลัยเชียงใหม่ร่วมกับกรมประมงได้ทำการสำรวจความหลากหลายทางชีวภาพในแม่น้ำโขง และพบปลาชนิดใหม่ที่ยังไม่เคยมีการบันทึกมาก่อน',
      date: '15 มกราคม 2568',
      image: 'https://placehold.co/400x250/1976d2/ffffff?text=News+1',
      category: 'การวิจัย'
    },
    {
      id: 2,
      title: 'โครงการอนุรักษ์ปลาบึก เพื่อความยั่งยืนของแม่น้ำโขง',
      summary: 'กรมประมงเปิดตัวโครงการอนุรักษ์และขยายพันธุ์ปลาบึก ซึ่งเป็นปลาหายากและใกล้สูญพันธุ์ โดยมีเป้าหมายปล่อยปลาบึกกลับสู่แม่น้ำโขงปีละ 1,000 ตัว',
      date: '10 มกราคม 2568',
      image: 'https://placehold.co/400x250/388e3c/ffffff?text=News+2',
      category: 'การอนุรักษ์'
    },
    {
      id: 3,
      title: 'ระดับน้ำแม่น้ำโขงเพิ่มขึ้น ส่งผลดีต่อระบบนิเวศ',
      summary: 'ระดับน้ำแม่น้ำโขงในช่วงฤดูฝนปีนี้เพิ่มขึ้นเมื่อเทียบกับปีที่ผ่านมา ส่งผลให้ปลาหลายชนิดสามารถวางไข่และขยายพันธุ์ได้ดีขึ้น',
      date: '5 มกราคม 2568',
      image: 'https://placehold.co/400x250/00acc1/ffffff?text=News+3',
      category: 'สิ่งแวดล้อม'
    }
  ];

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

            {/* Search Box - Desktop */}
            <Box
              component="form"
              onSubmit={handleSearch}
              sx={{
                flex: 1,
                mx: 4,
                display: { xs: 'none', md: 'block' }
              }}
            >
              <TextField
                fullWidth
                size="small"
                placeholder="ค้นหาชื่อปลา (ไทย, วิทยาศาสตร์, ท้องถิ่น)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'grey.50'
                  }
                }}
              />
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
                onClick={() => router.push('/login')}
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

          {/* Search Box - Mobile */}
          <Box
            component="form"
            onSubmit={handleSearch}
            sx={{
              pb: 2,
              display: { xs: 'block', md: 'none' }
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="ค้นหาชื่อปลา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'grey.50'
                }
              }}
            />
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
        <MenuItem onClick={() => { handleMenuClose(); router.push('/login'); }}>
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
                    <XAxis
                      dataKey="displayDate"
                      label={{ value: 'วันที่', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                      label={{ value: 'ระดับน้ำ (ม.รทก.)', angle: -90, position: 'insideLeft' }}
                      domain={['auto', 'auto']}
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
                                ระดับน้ำ: {data.currentLevel.toFixed(2)} ม.
                              </Typography>
                              {data.avgLevel && (
                                <Typography variant="body2" color="text.secondary">
                                  ค่าเฉลี่ย: {data.avgLevel.toFixed(2)} ม.
                                </Typography>
                              )}
                            </Box>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="currentLevel"
                      stroke="#1976d2"
                      strokeWidth={2}
                      name="ระดับน้ำปัจจุบัน"
                      dot={{ fill: '#1976d2', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    {waterLevelChartData.some(d => d.avgLevel) && (
                      <Line
                        type="monotone"
                        dataKey="avgLevel"
                        stroke="#ff9800"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="ค่าเฉลี่ย"
                        dot={false}
                      />
                    )}
                    {waterLevelChartData.some(d => d.avgLevel) && (
                      <ReferenceLine
                        y={waterLevelChartData[0]?.avgLevel}
                        stroke="#ff9800"
                        strokeDasharray="3 3"
                      />
                    )}
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
      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: '#f8f9fa' }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              แกลลอรี่ปลาแม่น้ำโขง
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto' }}>
              ชมภาพปลาหลากหลายชนิดจากฐานข้อมูลของเรา พร้อมข้อมูลรายละเอียดและสถานะการอนุรักษ์
            </Typography>
          </Box>

        {loadingGallery ? (
          <Grid container spacing={2} justifyContent="center">
            {[1, 2, 3].map((item) => (
              <Grid item xs={4} sm={4} md={4} key={item}>
                <Card>
                  <Skeleton variant="rectangular" height={140} />
                  <CardContent sx={{ p: 2 }}>
                    <Skeleton variant="text" height={24} />
                    <Skeleton variant="text" height={18} />
                    <Skeleton variant="text" height={18} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : fishGallery.length > 0 ? (
          <Grid container spacing={2} justifyContent="center">
            {fishGallery.map((fish) => (
              <Grid item xs={4} sm={4} md={4} key={fish.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: 6
                    }
                  }}
                >
                  <CardMedia
                    component="img"
                    height="140"
                    image={fish.imageUrl || '/placeholder-fish.jpg'}
                    alt={fish.thai_name}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
                    <Box sx={{ mb: 1.5 }}>
                      <Chip
                        label={fish.family_thai}
                        size="small"
                        sx={{ bgcolor: 'primary.light', color: 'white', fontSize: '0.7rem', height: 20, mb: 0.5 }}
                      />
                      <Chip
                        label={fish.iucn_status}
                        size="small"
                        sx={{
                          bgcolor: getIUCNColor(fish.iucn_status),
                          color: 'white',
                          fontSize: '0.7rem',
                          height: 20,
                          ml: 0.5
                        }}
                      />
                    </Box>

                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ fontSize: '0.95rem' }}>
                      {fish.thai_name}
                    </Typography>

                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontSize: '0.85rem' }}>
                      <strong>ชื่อท้องถิ่น:</strong> {fish.local_name}
                    </Typography>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontStyle="italic"
                      sx={{ display: 'block', fontSize: '0.85rem' }}
                    >
                      {fish.scientific_name}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box textAlign="center" py={4}>
            <Phishing sx={{ fontSize: 80, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              ไม่พบข้อมูลภาพปลา
            </Typography>
          </Box>
        )}

          <Box textAlign="center" mt={4}>
            <Button
              variant="contained"
              size="large"
              onClick={() => router.push('/login')}
              sx={{ px: 4 }}
            >
              ดูทั้งหมด
            </Button>
          </Box>
        </Container>
      </Box>

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

          <Grid container spacing={2} justifyContent="center">
            {fishFamilies.map((family, index) => (
              <Grid item xs={6} sm={4} md={3} lg={2.4} key={index}>
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
              </Grid>
            ))}
          </Grid>
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

        <Grid container spacing={2}>
          {iucnCategories.map((category) => (
            <Grid item xs={12} sm={6} md={4} lg={2.4} key={category.code}>
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
                      {category.count}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {category.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
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

          <Grid container spacing={2}>
            {newsArticles.map((news) => (
              <Grid item xs={4} sm={4} md={4} key={news.id}>
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
                        sx={{ textTransform: 'none', fontSize: '0.8rem', p: 0.5 }}
                      >
                        อ่านเพิ่มเติม
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
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
      <Box sx={{ bgcolor: 'grey.900', color: 'white', py: 4 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Mekong Fish Dashboard
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                ระบบจัดการข้อมูลปลาแม่น้ำโขง เพื่อการอนุรักษ์และการใช้ประโยชน์อย่างยั่งยืน
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} textAlign={{ xs: 'left', md: 'right' }}>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                © 2025 Mekong Fish Dashboard. All rights reserved.
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.6, mt: 1 }}>
                แหล่งข้อมูล: กรมชลประทาน, IUCN Red List
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}

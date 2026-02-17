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
  Fade
} from '@mui/material';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
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
  NavigateNext
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
  const [fishFamiliesData, setFishFamiliesData] = useState([]);
  const [lightbox, setLightbox] = useState({ open: false, fish: null, photoIndex: 0 });

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

  // Fetch fishing records from Firestore
  useEffect(() => {
    const fetchFishingRecords = async () => {
      try {
        setLoadingGallery(true);

        // Fetch fish_species collection to build lookup map
        const speciesSnapshot = await getDocs(collection(db, 'fish_species'));
        const speciesLookup = new Map(); // thai_name -> { group, iucn_status }
        speciesSnapshot.forEach((doc) => {
          const data = doc.data();
          const name = data.thai_name || data.common_name_thai;
          if (name) {
            speciesLookup.set(name.trim(), {
              group: data.group || data.family_thai || '',
              iucn_status: data.iucn_status || 'DD'
            });
          }
        });
        console.log('🐟 fish_species loaded:', speciesLookup.size, 'species');
        console.log('🐟 Sample species names:', Array.from(speciesLookup.keys()).slice(0, 5));

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
        const fishDataMap = new Map(); // Map: speciesName -> { photos: [], quantity, weight, value }
        const familyCountMap = new Map(); // Map: family -> Set of unique species names
        let totalWeight = 0;
        let totalValue = 0;

        verifiedRecords.forEach(record => {
          // Add to totals
          totalWeight += Number(record.totalWeight) || 0;
          totalValue += Number(record.totalValue) || 0;

          // Process each fish in the record (from fishData or fishList)
          const fishList = record.fishData || record.fishList || [];

          if (Array.isArray(fishList)) {
            fishList.forEach(fish => {
              const speciesName = (fish.species || fish.name || 'Unknown').trim();
              const photo = fish.photo || null;

              // Look up family and iucn from fish_species
              const speciesInfo = speciesLookup.get(speciesName) || {};
              if (speciesName !== 'Unknown') {
                console.log(`🔍 "${speciesName}" → group: "${speciesInfo.group || 'NOT FOUND'}"`);
              }
              const family = speciesInfo.group || 'วงศ์อื่นๆ';

              // Count unique species per family (regardless of photo)
              if (speciesName && speciesName !== 'Unknown') {
                if (!familyCountMap.has(family)) {
                  familyCountMap.set(family, new Set());
                }
                familyCountMap.get(family).add(speciesName);
              }

              // Skip fish without photos for gallery
              if (!photo) return;

              // เก็บวันที่ verified ของ record นี้
              const recordVerifiedAt = record.verifiedAt || record.updatedAt || record.createdAt || null;

              // Aggregate fish data for gallery (collect all photos)
              if (!fishDataMap.has(speciesName)) {
                fishDataMap.set(speciesName, {
                  species: speciesName,
                  photos: [photo],
                  quantity: Number(fish.quantity || fish.count) || 0,
                  weight: Number(fish.weight) || 0,
                  estimatedValue: Number(fish.estimatedValue || fish.price) || 0,
                  family: family,
                  iucn_status: speciesInfo.iucn_status || 'DD',
                  latestVerifiedAt: recordVerifiedAt
                });
              } else {
                const existing = fishDataMap.get(speciesName);
                if (!existing.photos.includes(photo)) {
                  existing.photos.push(photo);
                }
                existing.quantity += Number(fish.quantity || fish.count) || 0;
                existing.weight += Number(fish.weight) || 0;
                existing.estimatedValue += Number(fish.estimatedValue || fish.price) || 0;
                // เก็บวันที่ verified ล่าสุด
                if (recordVerifiedAt) {
                  const existingDate = existing.latestVerifiedAt ? new Date(existing.latestVerifiedAt?.toDate?.() || existing.latestVerifiedAt) : null;
                  const newDate = new Date(recordVerifiedAt?.toDate?.() || recordVerifiedAt);
                  if (!existingDate || newDate > existingDate) {
                    existing.latestVerifiedAt = recordVerifiedAt;
                  }
                }
              }
            });
          }
        });

        // Convert map to array, filter only fish with photos, and create gallery items
        const fishArray = Array.from(fishDataMap.values())
          .filter(fish => fish.photos.length > 0)
          .sort((a, b) => {
            // เรียงตามวันที่ verified ล่าสุดก่อน (ใหม่ → เก่า)
            const dateA = a.latestVerifiedAt ? new Date(a.latestVerifiedAt?.toDate?.() || a.latestVerifiedAt) : new Date(0);
            const dateB = b.latestVerifiedAt ? new Date(b.latestVerifiedAt?.toDate?.() || b.latestVerifiedAt) : new Date(0);
            return dateB - dateA;
          })
          .map((fish, index) => {
            const randomPhoto = fish.photos[Math.floor(Math.random() * fish.photos.length)];
            return {
              id: index + 1,
              imageUrl: randomPhoto,
              thai_name: fish.species,
              local_name: fish.species,
              scientific_name: '-',
              family_thai: fish.family || '-',
              iucn_status: fish.iucn_status || 'DD',
              totalQuantity: fish.quantity,
              totalWeight: fish.weight.toFixed(1),
              totalValue: fish.estimatedValue,
              photoCount: fish.photos.length
            };
          });

        // Build fish families data from real counts
        const familyColors = ['#1976d2', '#f57c00', '#388e3c', '#d32f2f', '#9c27b0', '#00acc1', '#fbc02d', '#e91e63', '#757575'];
        const totalSpeciesCount = Array.from(familyCountMap.values()).reduce((sum, set) => sum + set.size, 0);
        const familiesArray = Array.from(familyCountMap.entries())
          .map(([name, speciesSet]) => ({ name, count: speciesSet.size }))
          .sort((a, b) => {
            // ย้าย "วงศ์อื่นๆ" ไปท้ายสุด
            if (a.name === 'วงศ์อื่นๆ') return 1;
            if (b.name === 'วงศ์อื่นๆ') return -1;
            return b.count - a.count;
          })
          .slice(0, 9)
          .map((family, index) => ({
            name: family.name,
            count: family.count,
            percentage: totalSpeciesCount > 0 ? parseFloat(((family.count / totalSpeciesCount) * 100).toFixed(1)) : 0,
            color: familyColors[index % familyColors.length]
          }));

        setFishFamiliesData(familiesArray);

        console.log('Fish with photos:', fishArray.length);
        setFishGallery(fishArray);

        // Calculate stats for footer
        setStats({
          totalRecords: allRecords.length,
          totalWeight: parseFloat(totalWeight.toFixed(1)),
          verifiedCount: verifiedRecords.length,
          totalUsers: 0 // Will be updated separately
        });

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

  // Fetch users data for stats
  useEffect(() => {
    const fetchUsersData = async () => {
      try {
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const totalUsers = usersSnapshot.size;

        setStats(prev => ({
          ...prev,
          totalUsers: totalUsers
        }));
      } catch (error) {
        console.error('Error fetching users data:', error);
      }
    };

    if (stats.totalRecords > 0) {
      fetchUsersData();
    }
  }, [stats.totalRecords]);

  // Fetch water level data for chart
  useEffect(() => {
    const fetchWaterLevel = async () => {
      try {
        // Fetch directly from Firestore waterLevels collection
        const waterLevelRef = collection(db, 'waterLevels');
        // ดึง 30 รายการล่าสุด (เรียง desc)
        const q = query(waterLevelRef, orderBy('date', 'desc'), orderBy('time', 'desc'), limit(30));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const records = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            records.push({
              id: doc.id,
              date: data.date,
              time: data.time,
              currentLevel: data.currentLevel || 0,
              avgLevel: data.avgLevel || null,
              maxLevel: data.maxLevel || null,
              minLevel: data.minLevel || null
            });
          });

          // เรียงข้อมูลจากเก่าไปใหม่สำหรับกราฟ (reverse จาก desc -> asc)
          records.reverse();

          console.log(`✅ Water level data loaded from Firestore: ${records.length} records`);
          console.log(`📅 ข้อมูลเก่าสุด: ${records[0]?.date}, ข้อมูลล่าสุด: ${records[records.length - 1]?.date}`);

          // Set current water level info (latest 2 records)
          // ข้อมูลเรียงจากเก่า->ใหม่ ดังนั้นข้อมูลล่าสุดคือตัวสุดท้าย
          if (records.length >= 2) {
            const latest = records[records.length - 1];
            const previous = records[records.length - 2];
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

          // Prepare chart data (already sorted from old to new, no need to reverse)
          const chartData = records.map(record => {
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
          console.log('⚠️ No water level data in Firestore, using mock data');
          // Use mock data if no real data available
          const today = new Date();
          const mockData = Array.from({ length: 30 }, (_, i) => {
            const date = new Date(today);
            date.setDate(date.getDate() - (29 - i));

            // Generate realistic water level data (deterministic for SSR)
            const baseLevel = 140.5;
            const variation = Math.sin(i / 5) * 2 + (i % 3) * 0.2;
            const currentLevel = baseLevel + variation;

            return {
              date: date.toISOString().split('T')[0],
              displayDate: `${date.getDate()}/${date.getMonth() + 1}`,
              currentLevel: Number(currentLevel.toFixed(2)),
              avgLevel: baseLevel,
              maxLevel: null,
              minLevel: null
            };
          });

          setWaterLevelChartData(mockData);
          setWaterLevel({
            current: mockData[mockData.length - 1].currentLevel,
            previous: mockData[mockData.length - 2].currentLevel,
            change: mockData[mockData.length - 1].currentLevel - mockData[mockData.length - 2].currentLevel,
            trend: 'stable',
            date: mockData[mockData.length - 1].date,
            loading: false
          });
        }
      } catch (error) {
        console.error('❌ Error fetching water level:', error);
        console.log('⚠️ Using mock data due to error');

        // If permission error, use mock data instead
        const today = new Date();
        const mockData = Array.from({ length: 30 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - (29 - i));

          // Generate realistic water level data (deterministic for SSR)
          const baseLevel = 140.5;
          const variation = Math.sin(i / 5) * 2 + (i % 3) * 0.2;
          const currentLevel = baseLevel + variation;

          return {
            date: date.toISOString().split('T')[0],
            displayDate: `${date.getDate()}/${date.getMonth() + 1}`,
            currentLevel: Number(currentLevel.toFixed(2)),
            avgLevel: baseLevel,
            maxLevel: null,
            minLevel: null
          };
        });

        setWaterLevelChartData(mockData);
        setWaterLevel({
          current: mockData[mockData.length - 1].currentLevel,
          previous: mockData[mockData.length - 2].currentLevel,
          change: mockData[mockData.length - 1].currentLevel - mockData[mockData.length - 2].currentLevel,
          trend: 'stable',
          date: mockData[mockData.length - 1].date,
          loading: false
        });
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
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: { xs: 2, sm: 3 } }}>
            {[...Array(30)].map((_, index) => (
              <Box key={index}>
                <Card sx={{ height: '100%' }}>
                  <Box sx={{ position: 'relative', width: '100%', paddingTop: '100%' }}>
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
              {fishGallery.slice(0, 30).map((fish) => (
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
                        paddingTop: '100%',
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

            {fishGallery.length > 30 && (
              <Box textAlign="center" mt={4}>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  แสดง 30 จาก {fishGallery.length} ชนิด
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => router.push('/login')}
                  sx={{ px: 4 }}
                >
                  แสดงข้อมูลทั้งหมด ({fishGallery.length} ชนิด)
                </Button>
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
              <Box key={index}>
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

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 2 }}>
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
                      {category.count}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {category.label}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
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
            {newsArticles.map((news) => (
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
                        sx={{ textTransform: 'none', fontSize: '0.8rem', p: 0.5 }}
                      >
                        อ่านเพิ่มเติม
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
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
                แหล่งข้อมูล: กรมชลประทาน, IUCN Red List
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}

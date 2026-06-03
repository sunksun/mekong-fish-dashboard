'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl
} from '@mui/material';
import { ArrowBack, ArrowForward, Search } from '@mui/icons-material';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const WISDOM_CATEGORIES = [
  'เครื่องมือประมง',
  'วิธีการจับปลา',
  'แหล่งที่อยู่ปลา',
  'เวลาและฤดูกาล',
  'การดูลักษณะธรรมชาติ',
  'การถนอมปลา',
  'การใช้เหยื่อ',
  'อื่นๆ'
];

const CATEGORY_COLORS = {
  'เครื่องมือประมง': '#1565c0',
  'วิธีการจับปลา': '#2e7d32',
  'แหล่งที่อยู่ปลา': '#00838f',
  'เวลาและฤดูกาล': '#e65100',
  'การดูลักษณะธรรมชาติ': '#6a1b9a',
  'การถนอมปลา': '#558b2f',
  'การใช้เหยื่อ': '#ad1457',
  'อื่นๆ': '#546e7a'
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=250&fit=crop';

export default function WisdomListPage() {
  const router = useRouter();
  const [wisdomItems, setWisdomItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    const fetchWisdom = async () => {
      try {
        const q = query(collection(db, 'fishingWisdom'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const data = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
        setWisdomItems(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchWisdom();
  }, []);

  const filtered = wisdomItems.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      item.title?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.fishType?.toLowerCase().includes(term);
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f0f7ff' }}>
      {/* Top bar */}
      <Box sx={{ bgcolor: '#1565c0', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/landing')}
              sx={{ color: 'white', textTransform: 'none' }}
            >
              กลับหน้าหลัก
            </Button>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>
              ภูมิปัญญาชาวประมงแม่น้ำโขง
            </Typography>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Header */}
        <Box textAlign="center" mb={5}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            ความรู้ท้องถิ่น
          </Typography>
          <Typography variant="body1" color="text.secondary">
            ภูมิปัญญาและองค์ความรู้ท้องถิ่นของชาวประมงแม่น้ำโขง
          </Typography>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <TextField
            size="small"
            placeholder="ค้นหาภูมิปัญญา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ bgcolor: 'white', borderRadius: 2, minWidth: 240 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              displayEmpty
              sx={{ bgcolor: 'white', borderRadius: 2 }}
            >
              <MenuItem value="">ทุกหมวดหมู่</MenuItem>
              {WISDOM_CATEGORIES.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : filtered.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Typography color="text.secondary">ไม่พบภูมิปัญญา</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
            {filtered.map(item => (
              <Card
                key={item.id}
                sx={{
                  display: 'flex', flexDirection: 'column', height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 4, cursor: 'pointer' }
                }}
                onClick={() => router.push(`/wisdom/${item.id}`)}
              >
                <CardMedia
                  component="img"
                  height="180"
                  image={item.image || DEFAULT_IMAGE}
                  alt={item.title}
                  sx={{ objectFit: 'cover' }}
                  onError={(e) => { e.target.src = DEFAULT_IMAGE; }}
                />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
                  <Box sx={{ mb: 1.5 }}>
                    <Chip
                      label={item.category}
                      size="small"
                      sx={{
                        fontSize: '0.7rem', height: 20,
                        bgcolor: CATEGORY_COLORS[item.category] || '#546e7a',
                        color: 'white'
                      }}
                    />
                    {item.fishType && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontSize: '0.75rem' }}>
                        {item.fishType}
                      </Typography>
                    )}
                    {item.season && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontSize: '0.7rem' }}>
                        {item.season}
                      </Typography>
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
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      fontSize: '0.85rem'
                    }}
                  >
                    {item.description}
                  </Typography>
                  {item.contributorName && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, fontSize: '0.75rem' }}>
                      โดย: {item.contributorName}
                    </Typography>
                  )}
                  <Box sx={{ mt: 1.5 }}>
                    <Button size="small" endIcon={<ArrowForward />} sx={{ textTransform: 'none', fontSize: '0.8rem', p: 0.5 }}>
                      อ่านเพิ่มเติม
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
}

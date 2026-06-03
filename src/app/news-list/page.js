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
  Grid
} from '@mui/material';
import { ArrowBack, ArrowForward, Search } from '@mui/icons-material';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

export default function NewsListPage() {
  const router = useRouter();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const q = query(collection(db, 'newsArticles'), orderBy('publishedAt', 'desc'));
        const snapshot = await getDocs(q);
        const data = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
        setArticles(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  const filtered = articles.filter(a =>
    !searchTerm ||
    a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8f9fa' }}>
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
              ข่าวสารแม่น้ำโขง
            </Typography>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Header */}
        <Box textAlign="center" mb={5}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            ข่าวสารและบทความ
          </Typography>
          <Typography variant="body1" color="text.secondary">
            ข่าวสารและบทความล่าสุดเกี่ยวกับปลาและระบบนิเวศแม่น้ำโขง
          </Typography>
        </Box>

        {/* Search */}
        <Box sx={{ maxWidth: 480, mx: 'auto', mb: 5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="ค้นหาข่าว..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ bgcolor: 'white', borderRadius: 2 }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : filtered.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Typography color="text.secondary">ไม่พบข่าว</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
            {filtered.map(article => (
              <Card
                key={article.id}
                sx={{
                  display: 'flex', flexDirection: 'column', height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 4, cursor: 'pointer' }
                }}
                onClick={() => router.push(`/news/${article.id}`)}
              >
                <CardMedia
                  component="img"
                  height="180"
                  image={article.image || 'https://images.unsplash.com/photo-1534766438357-2b270dbd1b40?w=400&h=250&fit=crop'}
                  alt={article.title}
                  sx={{ objectFit: 'cover' }}
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1534766438357-2b270dbd1b40?w=400&h=250&fit=crop'; }}
                />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
                  <Box sx={{ mb: 1.5 }}>
                    <Chip label={article.category} size="small" color="primary" sx={{ fontSize: '0.7rem', height: 20, mr: 0.5 }} />
                    {article.isPinned && <Chip label="ปักหมุด" size="small" color="secondary" sx={{ fontSize: '0.7rem', height: 20 }} />}
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontSize: '0.7rem' }}>
                      {article.date}
                    </Typography>
                  </Box>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ fontSize: '0.95rem', lineHeight: 1.4 }}>
                    {article.title}
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
                    {article.summary}
                  </Typography>
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

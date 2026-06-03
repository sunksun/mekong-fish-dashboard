'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Avatar
} from '@mui/material';
import { ArrowBack, CalendarToday, Person } from '@mui/icons-material';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function NewsArticlePage() {
  const { id } = useParams();
  const router = useRouter();

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&?/]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
    return null;
  };
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const docRef = doc(db, 'newsArticles', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setArticle({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError('ไม่พบบทความนี้');
        }
      } catch (err) {
        console.error(err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [id]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8f9fa' }}>
      {/* Top bar */}
      <Box sx={{ bgcolor: '#1565c0', py: 2, px: 3 }}>
        <Container maxWidth="md">
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

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : article ? (
          <Box>
            {/* Category & meta */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip label={article.category} color="primary" size="small" />
              {article.isPinned && (
                <Chip label="ปักหมุด" color="secondary" size="small" />
              )}
            </Box>

            {/* Title */}
            <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ lineHeight: 1.4 }}>
              {article.title}
            </Typography>

            {/* Author & date */}
            <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
              {article.author && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Person fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {article.author}
                  </Typography>
                </Box>
              )}
              {article.date && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarToday fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {article.date}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Cover image */}
            {article.image && (
              <Box
                component="img"
                src={article.image}
                alt={article.title}
                sx={{
                  width: '100%',
                  maxHeight: 420,
                  objectFit: 'cover',
                  borderRadius: 2,
                  mb: 4,
                  boxShadow: 2
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}

            {/* Summary */}
            <Box sx={{ bgcolor: '#e3f2fd', borderLeft: '4px solid #1976d2', p: 2.5, borderRadius: '0 8px 8px 0', mb: 4 }}>
              <Typography variant="subtitle1" fontWeight="medium" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.85rem' }}>
                สรุปข่าว
              </Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                {article.summary}
              </Typography>
            </Box>

            {/* Full content */}
            {article.content && (
              <>
                <Divider sx={{ mb: 3 }} />
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  เนื้อหาฉบับเต็ม
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ whiteSpace: 'pre-wrap', lineHeight: 2, color: 'text.primary' }}
                >
                  {article.content}
                </Typography>
              </>
            )}

            {/* Video */}
            {article.videoUrl && getYouTubeEmbedUrl(article.videoUrl) && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  วีดีโอ
                </Typography>
                <Box sx={{ position: 'relative', paddingTop: '56.25%', borderRadius: 2, overflow: 'hidden' }}>
                  <Box
                    component="iframe"
                    src={getYouTubeEmbedUrl(article.videoUrl)}
                    title="video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </Box>
              </>
            )}

            {/* Back button bottom */}
            <Box sx={{ mt: 6, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                startIcon={<ArrowBack />}
                onClick={() => router.push('/landing')}
                variant="outlined"
                sx={{ textTransform: 'none' }}
              >
                กลับหน้าหลัก
              </Button>
            </Box>
          </Box>
        ) : null}
      </Container>
    </Box>
  );
}

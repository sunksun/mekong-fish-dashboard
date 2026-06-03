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
  Divider
} from '@mui/material';
import { ArrowBack, CalendarToday, Person, LocationOn, Agriculture } from '@mui/icons-material';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&?/]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return null;
};

export default function WisdomDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [wisdom, setWisdom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchWisdom = async () => {
      try {
        const docRef = doc(db, 'fishingWisdom', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setWisdom({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError('ไม่พบข้อมูลภูมิปัญญานี้');
        }
      } catch (err) {
        console.error(err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    fetchWisdom();
  }, [id]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f0f7ff' }}>
      {/* Top bar */}
      <Box sx={{ bgcolor: '#1565c0', py: 2, px: 3 }}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.back()}
              sx={{ color: 'white', textTransform: 'none' }}
            >
              กลับ
            </Button>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>
              ภูมิปัญญาชาวประมงแม่น้ำโขง
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
        ) : wisdom ? (
          <Box>
            {/* Category chips */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {wisdom.category && <Chip label={wisdom.category} color="success" size="small" />}
              {wisdom.fishType && <Chip label={wisdom.fishType} variant="outlined" size="small" />}
            </Box>

            {/* Title */}
            <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ lineHeight: 1.4 }}>
              {wisdom.title}
            </Typography>

            {/* Meta */}
            <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
              {wisdom.contributorName && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Person fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">{wisdom.contributorName}</Typography>
                </Box>
              )}
              {wisdom.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOn fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">{wisdom.location}</Typography>
                </Box>
              )}
              {wisdom.season && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Agriculture fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">{wisdom.season}</Typography>
                </Box>
              )}
              {wisdom.createdAt?.toDate && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarToday fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {wisdom.createdAt.toDate().toLocaleDateString('th-TH')}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Cover image */}
            {wisdom.image && (
              <Box
                component="img"
                src={wisdom.image}
                alt={wisdom.title}
                sx={{ width: '100%', maxHeight: 600, objectFit: 'contain', borderRadius: 2, mb: 4, boxShadow: 2, bgcolor: '#000' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}

            {/* Description summary box */}
            <Box sx={{ bgcolor: '#e8f5e9', borderLeft: '4px solid #2e7d32', p: 2.5, borderRadius: '0 8px 8px 0', mb: 4 }}>
              <Typography variant="subtitle1" fontWeight="medium" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.85rem' }}>
                ภาพรวม
              </Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                {wisdom.description}
              </Typography>
            </Box>

            {/* Technique */}
            {wisdom.technique && (
              <>
                <Divider sx={{ mb: 3 }} />
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  วิธีการ/เทคนิคการปฏิบัติ
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 2, color: 'text.primary' }}>
                  {wisdom.technique}
                </Typography>
              </>
            )}

            {/* Materials & Tips side by side */}
            {(wisdom.materials || wisdom.tips) && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                  {wisdom.materials && (
                    <Box>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        วัสดุอุปกรณ์ที่ใช้
                      </Typography>
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 2, color: 'text.primary' }}>
                        {wisdom.materials}
                      </Typography>
                    </Box>
                  )}
                  {wisdom.tips && (
                    <Box>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        เคล็ดลับและข้อแนะนำ
                      </Typography>
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 2, color: 'text.primary' }}>
                        {wisdom.tips}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </>
            )}

            {/* Warnings */}
            {wisdom.warnings && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ bgcolor: '#fff3e0', borderLeft: '4px solid #e65100', p: 2.5, borderRadius: '0 8px 8px 0' }}>
                  <Typography variant="subtitle1" fontWeight="medium" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.85rem' }}>
                    ข้อควรระวัง
                  </Typography>
                  <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                    {wisdom.warnings}
                  </Typography>
                </Box>
              </>
            )}

            {/* Video */}
            {wisdom.videoUrl && getYouTubeEmbedUrl(wisdom.videoUrl) && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  วีดีโอ
                </Typography>
                <Box sx={{ position: 'relative', paddingTop: '56.25%', borderRadius: 2, overflow: 'hidden' }}>
                  <Box
                    component="iframe"
                    src={getYouTubeEmbedUrl(wisdom.videoUrl)}
                    title="video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </Box>
              </>
            )}

            {/* Back button */}
            <Box sx={{ mt: 6, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                startIcon={<ArrowBack />}
                onClick={() => router.back()}
                variant="outlined"
                sx={{ textTransform: 'none' }}
              >
                กลับ
              </Button>
            </Box>
          </Box>
        ) : null}
      </Container>
    </Box>
  );
}

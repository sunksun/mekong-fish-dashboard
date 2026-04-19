'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Alert,
  Snackbar,
  Checkbox,
  FormControlLabel,
  Chip,
  Grid,
  Paper,
  Divider
} from '@mui/material';
import {
  Refresh,
  Save,
  Cloud,
  CheckCircle,
  ArrowBack
} from '@mui/icons-material';

const NewsGeneratePage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [previewNews, setPreviewNews] = useState([]);
  const [selectedNews, setSelectedNews] = useState({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Load preview on mount
  useEffect(() => {
    loadPreview();
  }, []);

  // Load preview news
  const loadPreview = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news/generate', {
        method: 'GET'
      });

      const result = await response.json();

      if (result.success && result.news) {
        setPreviewNews(result.news);
        // Select all news by default
        const selected = {};
        result.news.forEach((_, index) => {
          selected[index] = true;
        });
        setSelectedNews(selected);
      } else {
        setSnackbar({
          open: true,
          message: result.message || 'ไม่สามารถสร้างข่าวได้ในขณะนี้',
          severity: 'warning'
        });
        setPreviewNews([]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading preview:', error);
      setSnackbar({ open: true, message: 'เกิดข้อผิดพลาดในการโหลดตัวอย่างข่าว', severity: 'error' });
      setLoading(false);
    }
  };

  // Save selected news
  const handleSaveNews = async () => {
    try {
      const selectedItems = previewNews.filter((_, index) => selectedNews[index]);

      if (selectedItems.length === 0) {
        setSnackbar({ open: true, message: 'กรุณาเลือกข่าวที่ต้องการบันทึก', severity: 'warning' });
        return;
      }

      setSaving(true);

      const response = await fetch('/api/news/generate', {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setSnackbar({
          open: true,
          message: `บันทึกข่าวสำเร็จ ${result.generated} ข่าว`,
          severity: 'success'
        });

        // Redirect to news list after 2 seconds
        setTimeout(() => {
          router.push('/news');
        }, 2000);
      } else {
        setSnackbar({
          open: true,
          message: result.message || 'ไม่สามารถบันทึกข่าวได้',
          severity: 'error'
        });
      }

      setSaving(false);
    } catch (error) {
      console.error('Error saving news:', error);
      setSnackbar({ open: true, message: 'เกิดข้อผิดพลาดในการบันทึกข่าว', severity: 'error' });
      setSaving(false);
    }
  };

  // Toggle news selection
  const toggleNewsSelection = (index) => {
    setSelectedNews(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Select/Deselect all
  const handleSelectAll = (select) => {
    const selected = {};
    previewNews.forEach((_, index) => {
      selected[index] = select;
    });
    setSelectedNews(selected);
  };

  // Get selected count
  const selectedCount = Object.values(selectedNews).filter(Boolean).length;

  // Category colors
  const getCategoryColor = (category) => {
    const colors = {
      'การจับปลา': 'primary',
      'ปลาหายาก': 'error',
      'สิ่งแวดล้อม': 'info',
      'ชุมชน': 'success',
      'การอนุรักษ์': 'warning'
    };
    return colors[category] || 'default';
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/news')}
            >
              กลับ
            </Button>
            <Typography variant="h4" fontWeight="bold">
              สร้างข่าวอัตโนมัติ
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadPreview}
              disabled={loading || saving}
            >
              สร้างใหม่
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={saving ? <CircularProgress size={20} /> : <Save />}
              onClick={handleSaveNews}
              disabled={loading || saving || selectedCount === 0}
            >
              บันทึกข่าวที่เลือก ({selectedCount})
            </Button>
          </Box>
        </Box>

        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>วิธีใช้:</strong> ระบบจะวิเคราะห์ข้อมูลจาก Firebase และสร้างข่าวอัตโนมัติ
            คุณสามารถดูตัวอย่างข่าวก่อนบันทึก และเลือกว่าจะบันทึกข่าวไหนบ้าง
          </Typography>
        </Alert>

        {/* Select All Controls */}
        {!loading && previewNews.length > 0 && (
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                เลือกข่าว:
              </Typography>
              <Button size="small" onClick={() => handleSelectAll(true)}>
                เลือกทั้งหมด
              </Button>
              <Button size="small" onClick={() => handleSelectAll(false)}>
                ยกเลิกทั้งหมด
              </Button>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Typography variant="body2">
                เลือกแล้ว: <strong>{selectedCount}</strong> จาก {previewNews.length} ข่าว
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }} color="text.secondary">
              กำลังวิเคราะห์ข้อมูลและสร้างข่าว...
            </Typography>
          </Box>
        )}

        {/* No News State */}
        {!loading && previewNews.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Cloud sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              ไม่มีข้อมูลเพียงพอในการสร้างข่าว
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              ระบบต้องการข้อมูลการจับปลา, ระดับน้ำ, หรือผู้ใช้ใหม่ เพื่อสร้างข่าวอัตโนมัติ
            </Typography>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={loadPreview}
            >
              ลองอีกครั้ง
            </Button>
          </Box>
        )}

        {/* Preview News Cards */}
        {!loading && previewNews.length > 0 && (
          <Grid container spacing={3}>
            {previewNews.map((newsItem, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    opacity: selectedNews[index] ? 1 : 0.5,
                    transition: 'all 0.3s',
                    border: selectedNews[index] ? '2px solid' : '2px solid transparent',
                    borderColor: selectedNews[index] ? 'primary.main' : 'transparent'
                  }}
                >
                  {/* Selection Checkbox */}
                  <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedNews[index] || false}
                          onChange={() => toggleNewsSelection(index)}
                          sx={{
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            '&:hover': { bgcolor: 'background.paper' }
                          }}
                        />
                      }
                      label=""
                    />
                  </Box>

                  {/* News Image */}
                  <CardMedia
                    component="img"
                    height="180"
                    image={newsItem.image}
                    alt={newsItem.title}
                    sx={{ objectFit: 'cover' }}
                  />

                  {/* News Content */}
                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Category & Tags */}
                    <Box sx={{ mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={newsItem.category}
                        size="small"
                        color={getCategoryColor(newsItem.category)}
                      />
                      {newsItem.isPinned && (
                        <Chip label="ปักหมุด" size="small" color="secondary" />
                      )}
                      <Chip label="อัตโนมัติ" size="small" icon={<Cloud />} variant="outlined" />
                    </Box>

                    {/* Date */}
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      {newsItem.date}
                    </Typography>

                    {/* Title */}
                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mt: 1 }}>
                      {newsItem.title}
                    </Typography>

                    {/* Summary */}
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        flexGrow: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {newsItem.summary}
                    </Typography>

                    {/* Source */}
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 2 }}>
                      แหล่งข้อมูล: {newsItem.source}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            icon={snackbar.severity === 'success' ? <CheckCircle /> : undefined}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
};

export default NewsGeneratePage;

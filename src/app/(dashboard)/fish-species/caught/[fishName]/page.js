'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Breadcrumbs,
  Snackbar,
  Dialog,
  DialogContent,
} from '@mui/material';
import {
  Star,
  StarBorder,
  Scale,
  FormatListNumbered,
  PhotoCamera,
  SetMeal,
  NavigateNext,
} from '@mui/icons-material';
import MuiLink from '@mui/material/Link';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

function formatThaiDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const THAI_MONTHS_SHORT = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function FishDetailPage() {
  const params = useParams();
  const fishName = decodeURIComponent(params.fishName || '');
  const { hasAnyRole } = useAuth();
  const canFeature = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [featuredPhoto, setFeaturedPhoto] = useState(null); // currently pinned photoUrl
  const [pinning, setPinning] = useState(null); // recordId being pinned
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Load records for this species
  useEffect(() => {
    if (!fishName) return;
    setLoading(true);
    fetch(`/api/fishing-records/fish-detail?species=${encodeURIComponent(fishName)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res);
        else setError(res.error || 'โหลดข้อมูลไม่สำเร็จ');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fishName]);

  // Load current featured photo for this species
  useEffect(() => {
    if (!fishName) return;
    fetch('/api/featured-fish-photos')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.featured[fishName]) {
          setFeaturedPhoto(res.featured[fishName].photoUrl);
        }
      })
      .catch(() => {});
  }, [fishName]);

  const handleFeature = useCallback(async (record) => {
    if (!record.photo) return;
    setPinning(record.recordId);
    try {
      const res = await fetch('/api/featured-fish-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species: fishName,
          photoUrl: record.photo,
          recordId: record.recordId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeaturedPhoto(record.photo);
        setSnackbar({ open: true, message: 'กำหนดรูปภาพขึ้นหน้า landing แล้ว' });
      } else {
        setSnackbar({ open: true, message: 'เกิดข้อผิดพลาด: ' + data.error });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'เกิดข้อผิดพลาด' });
    } finally {
      setPinning(null);
    }
  }, [fishName]);

  return (
    <DashboardLayout>
      <Box sx={{ p: 1, pl: 1.5 }}>
        {/* Breadcrumb */}
        <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 2 }}>
          <MuiLink component={Link} href="/fish-species" underline="hover" color="inherit">
            ฐานข้อมูลปลา
          </MuiLink>
          <MuiLink component={Link} href="/fish-species/caught" underline="hover" color="inherit">
            ฐานข้อมูลปลาที่จับได้
          </MuiLink>
          <Typography color="text.primary">{fishName}</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box mb={3} display="flex" alignItems="center" gap={1.5}>
          <SetMeal color="primary" sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h4">{fishName}</Typography>
            <Typography variant="body2" color="text.secondary">
              ข้อมูลการจับปลาจากบันทึกทั้งหมดในระบบ
            </Typography>
          </Box>
          {featuredPhoto && (
            <Box ml="auto" display="flex" alignItems="center" gap={1}>
              <Box
                component="img"
                src={featuredPhoto}
                alt="featured"
                sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1, border: '2px solid', borderColor: 'warning.main' }}
              />
              <Box>
                <Chip icon={<Star />} label="รูปที่แสดงบน Landing" color="warning" size="small" />
              </Box>
            </Box>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Summary cards */}
        {data && (
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'จำนวนรวม (ตัว)', value: data.stats.totalCount.toLocaleString(), icon: <FormatListNumbered color="primary" sx={{ fontSize: 36 }} />, color: 'primary.main' },
              { label: 'น้ำหนักรวม (กก.)', value: data.stats.totalWeight.toLocaleString(), icon: <Scale color="success" sx={{ fontSize: 36 }} />, color: 'success.main' },
              { label: 'จำนวนครั้งที่บันทึก', value: data.stats.recordCount.toLocaleString(), icon: <SetMeal color="secondary" sx={{ fontSize: 36 }} />, color: 'secondary.main' },
              { label: 'รูปภาพทั้งหมด', value: data.stats.totalPhotos.toLocaleString(), icon: <PhotoCamera color="warning" sx={{ fontSize: 36 }} />, color: 'warning.main' },
            ].map(({ label, value, icon, color }) => (
              <Grid item xs={12} sm={6} md={3} key={label}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2}>
                      {icon}
                      <Box>
                        <Typography variant="h4" fontWeight="bold" color={color}>{value}</Typography>
                        <Typography variant="body2" color="text.secondary">{label}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Records table */}
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>
              บันทึกการจับปลา{' '}
              <Box component="span" sx={{ fontWeight: 'normal', color: 'text.secondary', fontSize: '0.85em' }}>
                {data ? `${data.stats.recordCount} รายการ` : ''}
              </Box>
            </Typography>

            {loading ? (
              <Box display="flex" justifyContent="center" py={6}>
                <CircularProgress />
              </Box>
            ) : !data || data.records.length === 0 ? (
              <Box display="flex" justifyContent="center" py={6}>
                <Typography color="text.secondary">ไม่พบข้อมูล</Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell width={56}><strong>รูป</strong></TableCell>
                      <TableCell><strong>วันที่จับ</strong></TableCell>
                      <TableCell><strong>สถานที่</strong></TableCell>
                      <TableCell align="right"><strong>น้ำหนัก (กก.)</strong></TableCell>
                      <TableCell align="right"><strong>จำนวน (ตัว)</strong></TableCell>
                      <TableCell align="center"><strong>สถานะ</strong></TableCell>
                      {canFeature && <TableCell align="center"><strong>รูปบน Landing</strong></TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.records.map((record) => {
                      const isFeatured = featuredPhoto && record.photo === featuredPhoto;
                      const location = [record.waterSource, record.province].filter(Boolean).join(', ') || '—';
                      return (
                        <TableRow key={record.recordId} hover>
                          {/* Thumbnail */}
                          <TableCell>
                            {record.photo ? (
                              <Box
                                component="img"
                                src={record.photo}
                                alt={fishName}
                                onClick={() => setLightboxUrl(record.photo)}
                                sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 1, border: isFeatured ? '2px solid' : '1px solid', borderColor: isFeatured ? 'warning.main' : 'divider', display: 'block', cursor: 'zoom-in' }}
                              />
                            ) : (
                              <Box sx={{ width: 44, height: 44, bgcolor: 'grey.100', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <PhotoCamera sx={{ fontSize: 20, color: 'grey.400' }} />
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>{formatThaiDate(record.catchDate)}</TableCell>
                          <TableCell>{location}</TableCell>
                          <TableCell align="right">{record.weight.toLocaleString()}</TableCell>
                          <TableCell align="right">{record.count.toLocaleString()}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={record.verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
                              size="small"
                              color={record.verified ? 'success' : 'warning'}
                              variant="outlined"
                            />
                          </TableCell>
                          {canFeature && (
                            <TableCell align="center">
                              {record.verified && record.photo ? (
                                <Tooltip title={isFeatured ? 'รูปนี้แสดงอยู่บน Landing แล้ว' : 'กำหนดรูปนี้ขึ้นหน้า Landing'}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="warning"
                                      onClick={() => handleFeature(record)}
                                      disabled={pinning === record.recordId}
                                    >
                                      {pinning === record.recordId ? (
                                        <CircularProgress size={18} color="warning" />
                                      ) : isFeatured ? (
                                        <Star />
                                      ) : (
                                        <StarBorder />
                                      )}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : (
                                <Typography variant="caption" color="text.disabled">—</Typography>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Lightbox */}
        <Dialog open={!!lightboxUrl} onClose={() => setLightboxUrl(null)} maxWidth="md">
          <DialogContent sx={{ p: 0, bgcolor: 'black', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {lightboxUrl && (
              <Box
                component="img"
                src={lightboxUrl}
                alt={fishName}
                onClick={() => setLightboxUrl(null)}
                sx={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', display: 'block', cursor: 'zoom-out' }}
              />
            )}
          </DialogContent>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ open: false, message: '' })}
          message={snackbar.message}
        />
      </Box>
    </DashboardLayout>
  );
}

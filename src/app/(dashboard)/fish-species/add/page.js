'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link as MuiLink
} from '@mui/material';
import {
  Save,
  Cancel,
  NavigateNext
} from '@mui/icons-material';
import Link from 'next/link';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { USER_ROLES } from '@/types';

export default function AddFishSpeciesPage() {
  const router = useRouter();
  const { hasAnyRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Check permissions
  const canEdit = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  // Form data
  const [formData, setFormData] = useState({
    thai_name: '',
    local_name: '',
    scientific_name: '',
    group: '',
    iucn_status: '-',
    description: '',
    habitat: '',
    distribution: '',
    conservation_notes: ''
  });

  const handleChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.thai_name || !formData.scientific_name) {
      setError('กรุณากรอกชื่อไทยและชื่อวิทยาศาสตร์');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Add to Firestore
      await addDoc(collection(db, 'fish_species'), {
        ...formData,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      });

      setSuccess(true);

      // Redirect after 1.5 seconds
      setTimeout(() => {
        router.push('/fish-species');
      }, 1500);
    } catch (err) {
      console.error('Error adding species:', err);
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
      setLoading(false);
    }
  };

  // If user doesn't have permission
  if (!canEdit) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            คุณไม่มีสิทธิ์ในการเพิ่มข้อมูลปลา
          </Alert>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs
          separator={<NavigateNext fontSize="small" />}
          sx={{ mb: 3 }}
        >
          <MuiLink
            component={Link}
            href="/dashboard"
            underline="hover"
            color="inherit"
          >
            หน้าหลัก
          </MuiLink>
          <MuiLink
            component={Link}
            href="/fish-species"
            underline="hover"
            color="inherit"
          >
            ฐานข้อมูลปลา
          </MuiLink>
          <Typography color="text.primary">เพิ่มปลาใหม่</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            เพิ่มข้อมูลปลาใหม่
          </Typography>
          <Typography variant="body1" color="text.secondary">
            กรอกข้อมูลชนิดปลาในแม่น้ำโขงเพื่อเพิ่มเข้าระบบ
          </Typography>
        </Box>

        {/* Success Message */}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            บันทึกข้อมูลสำเร็จ! กำลังกลับไปหน้ารายการ...
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Form */}
        <Card>
          <CardContent>
            <Box component="form" onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                {/* ข้อมูลพื้นฐาน */}
                <Grid item xs={12}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    ข้อมูลพื้นฐาน
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    label="ชื่อไทย"
                    value={formData.thai_name}
                    onChange={handleChange('thai_name')}
                    placeholder="เช่น ปลาบึก"
                    helperText="ชื่อปลาภาษาไทยทั่วไป"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ชื่อท้องถิ่น"
                    value={formData.local_name}
                    onChange={handleChange('local_name')}
                    placeholder="เช่น ปลาบึกท้องถิ่น"
                    helperText="ชื่อเรียกตามท้องถิ่น (ถ้ามี)"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    label="ชื่อวิทยาศาสตร์"
                    value={formData.scientific_name}
                    onChange={handleChange('scientific_name')}
                    placeholder="เช่น Pangasianodon gigas"
                    helperText="ชื่อวิทยาศาสตร์ (Latin name)"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="กลุ่มปลา"
                    value={formData.group}
                    onChange={handleChange('group')}
                    placeholder="เช่น ปลากระดูกอ่อน, ปลากินพืช"
                    helperText="หมวดหมู่หรือกลุ่มของปลา"
                  />
                </Grid>

                {/* สถานะและการอนุรักษ์ */}
                <Grid item xs={12}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
                    สถานะและการอนุรักษ์
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>สถานะ IUCN</InputLabel>
                    <Select
                      value={formData.iucn_status}
                      label="สถานะ IUCN"
                      onChange={handleChange('iucn_status')}
                    >
                      <MenuItem value="-">-</MenuItem>
                      <MenuItem value="LC">LC (Least Concern - น่าเป็นห่วงน้อยที่สุด)</MenuItem>
                      <MenuItem value="NT">NT (Near Threatened - ใกล้ถึงขั้นเสี่ยง)</MenuItem>
                      <MenuItem value="VU">VU (Vulnerable - เสี่ยง)</MenuItem>
                      <MenuItem value="EN">EN (Endangered - ใกล้สูญพันธุ์)</MenuItem>
                      <MenuItem value="CR">CR (Critically Endangered - ใกล้สูญพันธุ์อย่างยิ่ง)</MenuItem>
                      <MenuItem value="EW">EW (Extinct in the Wild - สูญพันธุ์ในธรรมชาติ)</MenuItem>
                      <MenuItem value="EX">EX (Extinct - สูญพันธุ์)</MenuItem>
                      <MenuItem value="DD">DD (Data Deficient - ข้อมูลไม่เพียงพอ)</MenuItem>
                      <MenuItem value="NE">NE (Not Evaluated - ยังไม่ได้ประเมิน)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="หมายเหตุการอนุรักษ์"
                    value={formData.conservation_notes}
                    onChange={handleChange('conservation_notes')}
                    placeholder="เช่น ห้ามจับตามกฎหมาย"
                    helperText="ข้อมูลเพิ่มเติมเกี่ยวกับการอนุรักษ์"
                  />
                </Grid>

                {/* ข้อมูลทางวิชาการ */}
                <Grid item xs={12}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
                    ข้อมูลทางวิชาการ
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="คำอธิบาย"
                    value={formData.description}
                    onChange={handleChange('description')}
                    placeholder="อธิบายลักษณะทั่วไปของปลา เช่น ขนาด สี ลักษณะเด่น"
                    helperText="ลักษณะทั่วไปและข้อมูลสำคัญของปลาชนิดนี้"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="ถิ่นที่อยู่"
                    value={formData.habitat}
                    onChange={handleChange('habitat')}
                    placeholder="เช่น แม่น้ำโขงตอนบน, น้ำลึก"
                    helperText="บริเวณที่อาศัยและสภาพแวดล้อม"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="การกระจายพันธุ์"
                    value={formData.distribution}
                    onChange={handleChange('distribution')}
                    placeholder="เช่น แม่น้ำโขงในไทย ลาว กัมพูชา"
                    helperText="พื้นที่ที่พบปลาชนิดนี้"
                  />
                </Grid>

                {/* Buttons */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Cancel />}
                      onClick={() => router.push('/fish-species')}
                      disabled={loading}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                      disabled={loading}
                    >
                      {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </DashboardLayout>
  );
}

'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  Select,
  Chip,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Psychology,
  Agriculture,
  Build,
  LocationOn,
  CalendarToday,
  Person,
  Search
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  limit
} from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const BULLET_FIELDS = ['technique', 'materials'];

function WisdomFormModal({ open, onClose, onSubmit, title, formData, onChange, onKeyDown, onFocus, error, imagePreview, onImageChange, uploadingImage }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── Section 1: ข้อมูลพื้นฐาน ── */}
        <Box sx={{ mb: 0.5 }}>
          <Typography variant="caption" color="primary" fontWeight="bold" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            ข้อมูลพื้นฐาน
          </Typography>
          <Divider sx={{ mt: 0.5, mb: 2 }} />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth required size="small">
              <Select
                name="category"
                value={formData.category}
                onChange={onChange}
                displayEmpty
                renderValue={(val) => val || <Typography color="text.secondary" fontSize="0.875rem">หมวดหมู่ *</Typography>}
              >
                {WISDOM_CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={8}>
            <TextField name="title" label="ชื่อภูมิปัญญา *" value={formData.title} onChange={onChange} fullWidth size="small" placeholder="เช่น การทำแหยงตันจับปลาบึก" />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField name="fishType" label="ชนิดปลาเป้าหมาย" value={formData.fishType} onChange={onChange} fullWidth size="small" multiline rows={2} placeholder="เช่น ปลาบึก, ปลากด, ปลาเทโพ" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="season" label="ฤดูกาล/เวลาที่เหมาะสม" value={formData.season} onChange={onChange} fullWidth size="small" placeholder="เช่น หน้าแล้ง, เดือน 3-5" />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField name="location" label="สถานที่/พื้นที่" value={formData.location} onChange={onChange} fullWidth size="small" placeholder="เช่น ริมฝั่ง, น้ำลึก" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="contributorName" label="ผู้ให้ข้อมูล" value={formData.contributorName} onChange={onChange} fullWidth size="small" placeholder="ชื่อ-นามสกุล หรือชื่อเล่น" />
          </Grid>
        </Grid>

        {/* ── Section 2: เนื้อหา ── */}
        <Box sx={{ mt: 3, mb: 0.5 }}>
          <Typography variant="caption" color="primary" fontWeight="bold" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            เนื้อหา
          </Typography>
          <Divider sx={{ mt: 0.5, mb: 2 }} />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField name="description" label="คำอธิบายภูมิปัญญา *" value={formData.description} onChange={onChange} fullWidth multiline rows={2} size="small" placeholder="อธิบายภูมิปัญญานี้โดยสังเขป" />
          </Grid>
          <Grid item xs={12}>
            <TextField
              name="technique" label="วิธีการ/เทคนิคการปฏิบัติ *" value={formData.technique}
              onChange={onChange} onKeyDown={onKeyDown} onFocus={onFocus}
              fullWidth multiline rows={3} size="small" placeholder="• ขั้นตอนที่ 1..."
              slotProps={{ htmlInput: { style: { fontFamily: 'inherit' } } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="materials" label="วัสดุอุปกรณ์ที่ใช้" value={formData.materials}
              onChange={onChange} onKeyDown={onKeyDown} onFocus={onFocus}
              fullWidth multiline rows={2} size="small" placeholder="• วัสดุที่ 1..."
              slotProps={{ htmlInput: { style: { fontFamily: 'inherit' } } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="tips" label="เคล็ดลับและข้อแนะนำ" value={formData.tips} onChange={onChange} fullWidth multiline rows={2} size="small" placeholder="เคล็ดลับเพิ่มเติมเพื่อความสำเร็จ" />
          </Grid>
          <Grid item xs={12}>
            <TextField name="warnings" label="ข้อควรระวัง" value={formData.warnings} onChange={onChange} fullWidth multiline rows={2} size="small" placeholder="สิ่งที่ควรระวังหรือหลีกเลี่ยง" />
          </Grid>
        </Grid>

        {/* ── Section 3: สื่อประกอบ ── */}
        <Box sx={{ mt: 3, mb: 0.5 }}>
          <Typography variant="caption" color="primary" fontWeight="bold" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            สื่อประกอบ
          </Typography>
          <Divider sx={{ mt: 0.5, mb: 2 }} />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.8rem' }}>รูปภาพประกอบ</Typography>
            <Button variant="outlined" component="label" size="small">
              เลือกรูปภาพ
              <input type="file" accept="image/*" hidden onChange={onImageChange} />
            </Button>
            {imagePreview && (
              <Box component="img" src={imagePreview} alt="preview"
                sx={{ display: 'block', mt: 1.5, height: 140, width: '100%', objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="videoUrl" label="URL วีดีโอ YouTube" value={formData.videoUrl} onChange={onChange} fullWidth size="small"
              placeholder="https://www.youtube.com/watch?v=..." sx={{ mt: { xs: 0, sm: 3.5 } }} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button onClick={onSubmit} variant="contained" disabled={uploadingImage}>
          {uploadingImage ? 'กำลังอัปโหลด...' : title.includes('เพิ่ม') ? 'เพิ่มภูมิปัญญา' : 'บันทึกการแก้ไข'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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



export default function FishingWisdomPage() {
  const { userProfile } = useAuth();
  const [wisdomEntries, setWisdomEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWisdom, setSelectedWisdom] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    fishType: '',
    description: '',
    technique: '',
    materials: '',
    season: '',
    location: '',
    tips: '',
    warnings: '',
    image: '',
    videoUrl: '',
    contributorName: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const [error, setError] = useState('');

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImageFile = async (wisdomId) => {
    if (!imageFile) return null;
    const timestamp = Date.now();
    const storageRef = ref(storage, `fishing-wisdom/${wisdomId}/${timestamp}.jpg`);
    await uploadBytes(storageRef, imageFile);
    return await getDownloadURL(storageRef);
  };

  const resetForm = () => {
    setFormData({
      title: '', category: '', fishType: '', description: '',
      technique: '', materials: '', season: '', location: '',
      tips: '', warnings: '', image: '', videoUrl: '', contributorName: ''
    });
    setImageFile(null);
    setImagePreview('');
  };

  const loadWisdom = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'fishingWisdom'), orderBy('createdAt', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      const wisdomData = [];
      querySnapshot.forEach((doc) => {
        wisdomData.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        });
      });
      setWisdomEntries(wisdomData);
    } catch (error) {
      console.error('Error loading wisdom:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWisdom();
  }, []);

  // Filter wisdom entries
  const filteredWisdom = wisdomEntries.filter(wisdom => {
    const matchesSearch = wisdom.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wisdom.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wisdom.technique.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || wisdom.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBulletKeyDown = (e) => {
    const { name, value, selectionStart } = e.target;
    if (!BULLET_FIELDS.includes(name)) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionStart);
      const newValue = before + '\n• ' + after;
      setFormData(prev => ({ ...prev, [name]: newValue }));
      // move cursor after the new bullet
      requestAnimationFrame(() => {
        e.target.selectionStart = e.target.selectionEnd = selectionStart + 3;
      });
    } else if (e.key === 'Backspace') {
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineContent = value.slice(lineStart, selectionStart);
      if (lineContent === '• ') {
        e.preventDefault();
        const newValue = value.slice(0, lineStart - 1) + value.slice(selectionStart);
        setFormData(prev => ({ ...prev, [name]: newValue }));
        requestAnimationFrame(() => {
          e.target.selectionStart = e.target.selectionEnd = lineStart - 1;
        });
      }
    }
  };

  const handleBulletFocus = (e) => {
    const { name, value } = e.target;
    if (!BULLET_FIELDS.includes(name)) return;
    if (!value.trim()) {
      setFormData(prev => ({ ...prev, [name]: '• ' }));
      requestAnimationFrame(() => {
        e.target.selectionStart = e.target.selectionEnd = 2;
      });
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('กรุณาระบุชื่อภูมิปัญญา');
      return false;
    }
    if (!formData.category) {
      setError('กรุณาเลือกหมวดหมู่');
      return false;
    }
    if (!formData.description.trim()) {
      setError('กรุณาระบุคำอธิบาย');
      return false;
    }
    if (!formData.technique.trim()) {
      setError('กรุณาระบุวิธีการ/เทคนิค');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleAddWisdom = async () => {
    if (!validateForm()) return;
    try {
      setUploadingImage(true);
      const wisdomData = {
        ...formData,
        image: '',
        contributorId: userProfile?.uid || userProfile?.id || null,
        contributorName: formData.contributorName || userProfile.name || userProfile.email,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active'
      };
      const docRef = await addDoc(collection(db, 'fishingWisdom'), wisdomData);
      if (imageFile) {
        const imageUrl = await uploadImageFile(docRef.id);
        if (imageUrl) await updateDoc(doc(db, 'fishingWisdom', docRef.id), { image: imageUrl });
      }
      setUploadingImage(false);
      setAddModalOpen(false);
      resetForm();
      loadWisdom();
    } catch (error) {
      console.error('Error adding wisdom:', error);
      setUploadingImage(false);
      setError('เกิดข้อผิดพลาดในการเพิ่มภูมิปัญญา');
    }
  };

  const handleEditWisdom = async () => {
    if (!validateForm()) return;
    try {
      setUploadingImage(true);
      let imageUrl = formData.image;
      if (imageFile) imageUrl = await uploadImageFile(selectedWisdom.id) || imageUrl;
      await updateDoc(doc(db, 'fishingWisdom', selectedWisdom.id), {
        ...formData,
        image: imageUrl,
        updatedAt: new Date()
      });
      setUploadingImage(false);
      setEditModalOpen(false);
      setSelectedWisdom(null);
      resetForm();
      loadWisdom();
    } catch (error) {
      console.error('Error updating wisdom:', error);
      setUploadingImage(false);
      setError('เกิดข้อผิดพลาดในการแก้ไขภูมิปัญญา');
    }
  };

  const handleDeleteWisdom = async () => {
    try {
      await deleteDoc(doc(db, 'fishingWisdom', selectedWisdom.id));
      setDeleteDialogOpen(false);
      setSelectedWisdom(null);
      loadWisdom();
    } catch (error) {
      console.error('Error deleting wisdom:', error);
      setError('เกิดข้อผิดพลาดในการลบภูมิปัญญา');
    }
  };

  const openEditModal = (wisdom) => {
    setSelectedWisdom(wisdom);
    setFormData({
      title: wisdom.title,
      category: wisdom.category,
      fishType: wisdom.fishType || '',
      description: wisdom.description,
      technique: wisdom.technique,
      materials: wisdom.materials || '',
      season: wisdom.season || '',
      location: wisdom.location || '',
      tips: wisdom.tips || '',
      warnings: wisdom.warnings || '',
      image: wisdom.image || '',
      videoUrl: wisdom.videoUrl || '',
      contributorName: wisdom.contributorName || ''
    });
    setImageFile(null);
    setImagePreview(wisdom.image || '');
    setEditModalOpen(true);
  };

  const openViewModal = (wisdom) => {
    setSelectedWisdom(wisdom);
    setViewModalOpen(true);
  };

  const openDeleteDialog = (wisdom) => {
    setSelectedWisdom(wisdom);
    setDeleteDialogOpen(true);
  };



  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" gutterBottom fontWeight="600">
              ภูมิปัญญาชาวบ้าน
            </Typography>
            <Typography variant="body1" color="text.secondary">
              ความรู้และเทคนิคการประมงแม่น้ำโขงที่สืบทอดจากบรรพบุรุษ
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setAddModalOpen(true)}
            sx={{ height: 'fit-content' }}
          >
            เพิ่มภูมิปัญญาใหม่
          </Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Psychology sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {wisdomEntries.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ภูมิปัญญาทั้งหมด
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Agriculture sx={{ fontSize: 40, color: 'success.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {new Set(wisdomEntries.map(w => w.category)).size}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      หมวดหมู่
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Build sx={{ fontSize: 40, color: 'warning.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {wisdomEntries.filter(w => w.category === 'เครื่องมือประมง').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      เครื่องมือประมง
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <LocationOn sx={{ fontSize: 40, color: 'info.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {wisdomEntries.filter(w => w.category === 'วิธีการจับปลา').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      วิธีการจับปลา
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="ค้นหาภูมิปัญญา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  displayEmpty
                  renderValue={(val) => val || <Typography color="text.secondary">กรองตามหมวดหมู่</Typography>}
                  MenuProps={{
                    PaperProps: {
                      sx: { minWidth: 320 }
                    }
                  }}
                >
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  {WISDOM_CATEGORIES.map((category) => (
                    <MenuItem key={category} value={category} sx={{ whiteSpace: 'nowrap' }}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">
                พบ {filteredWisdom.length} รายการ
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Wisdom Table */}
        <TableContainer component={Paper}>
          <Table sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '30%' }}>ชื่อภูมิปัญญา</TableCell>
                <TableCell sx={{ width: '18%' }}>หมวดหมู่</TableCell>
                <TableCell sx={{ width: '14%' }}>ชนิดปลา</TableCell>
                <TableCell sx={{ width: '16%' }}>ผู้บันทึก</TableCell>
                <TableCell sx={{ width: '12%' }}>วันที่บันทึก</TableCell>
                <TableCell sx={{ width: '10%' }} align="center">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredWisdom.map((wisdom) => (
                <TableRow key={wisdom.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="medium">
                        {wisdom.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {wisdom.description.substring(0, 80)}
                        {wisdom.description.length > 80 && '...'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={wisdom.category} size="small" color="primary" variant="outlined" sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={wisdom.fishType} size="small" color="secondary" variant="outlined" />
                  </TableCell>
                  <TableCell>{wisdom.contributorName}</TableCell>
                  <TableCell>
                    {wisdom.createdAt?.toLocaleDateString('th-TH')}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="ดูรายละเอียด">
                      <IconButton size="small" onClick={() => openViewModal(wisdom)}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="แก้ไข">
                      <IconButton size="small" onClick={() => openEditModal(wisdom)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ลบ">
                      <IconButton 
                        size="small" 
                        onClick={() => openDeleteDialog(wisdom)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {filteredWisdom.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <Typography color="text.secondary">
                      ไม่พบภูมิปัญญาที่ตรงกับเงื่อนไขการค้นหา
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Add Wisdom Modal */}
        <WisdomFormModal
          open={addModalOpen}
          onClose={() => { setAddModalOpen(false); setError(''); resetForm(); }}
          onSubmit={handleAddWisdom}
          title="เพิ่มภูมิปัญญาใหม่"
          formData={formData}
          onChange={handleInputChange}
          onKeyDown={handleBulletKeyDown}
          onFocus={handleBulletFocus}
          error={error}
          imagePreview={imagePreview}
          onImageChange={handleImageFileChange}
          uploadingImage={uploadingImage}
        />

        {/* Edit Wisdom Modal */}
        <WisdomFormModal
          open={editModalOpen}
          onClose={() => { setEditModalOpen(false); setError(''); setSelectedWisdom(null); }}
          onSubmit={handleEditWisdom}
          title="แก้ไขภูมิปัญญา"
          formData={formData}
          onChange={handleInputChange}
          onKeyDown={handleBulletKeyDown}
          onFocus={handleBulletFocus}
          error={error}
          imagePreview={imagePreview}
          onImageChange={handleImageFileChange}
          uploadingImage={uploadingImage}
        />

        {/* View Wisdom Modal */}
        <Dialog open={viewModalOpen} onClose={() => setViewModalOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <Psychology />
              {selectedWisdom?.title}
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedWisdom && (
              <Box>
                <Grid container spacing={2} mb={3}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">หมวดหมู่:</Typography>
                    <Chip label={selectedWisdom.category} size="small" color="primary" />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">ชนิดปลา:</Typography>
                    <Chip label={selectedWisdom.fishType} size="small" color="secondary" />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">ผู้บันทึก:</Typography>
                    <Typography variant="body2">{selectedWisdom.contributorName}</Typography>
                  </Grid>
                  {selectedWisdom.season && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">ฤดูกาล:</Typography>
                      <Typography variant="body2">{selectedWisdom.season}</Typography>
                    </Grid>
                  )}
                  {selectedWisdom.location && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">สถานที่:</Typography>
                      <Typography variant="body2">{selectedWisdom.location}</Typography>
                    </Grid>
                  )}
                </Grid>
                
                <Typography variant="h6" gutterBottom>คำอธิบาย</Typography>
                <Typography variant="body1" paragraph>
                  {selectedWisdom.description}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="h6" gutterBottom>วิธีการ/เทคนิคการปฏิบัติ</Typography>
                <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-line' }}>
                  {selectedWisdom.technique}
                </Typography>
                
                {selectedWisdom.materials && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>วัสดุอุปกรณ์ที่ใช้</Typography>
                    <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-line' }}>
                      {selectedWisdom.materials}
                    </Typography>
                  </>
                )}
                
                {selectedWisdom.tips && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>เคล็ดลับและข้อแนะนำ</Typography>
                    <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-line' }}>
                      {selectedWisdom.tips}
                    </Typography>
                  </>
                )}
                
                {selectedWisdom.warnings && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom color="error">ข้อควรระวัง</Typography>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                        {selectedWisdom.warnings}
                      </Typography>
                    </Alert>
                  </>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewModalOpen(false)}>ปิด</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>ยืนยันการลบภูมิปัญญา</DialogTitle>
          <DialogContent>
            <Typography>
              คุณต้องการลบภูมิปัญญา &quot;{selectedWisdom?.title}&quot; ใช่หรือไม่?
            </Typography>
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              การดำเนินการนี้ไม่สามารถยกเลิกได้
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleDeleteWisdom} color="error" variant="contained">
              ลบภูมิปัญญา
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
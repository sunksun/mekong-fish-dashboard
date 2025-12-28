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
  InputLabel,
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
import { db } from '@/lib/firebase';

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


const DIFFICULTY_LEVELS = [
  'ง่าย',
  'ปานกลาง', 
  'ยาก',
  'ผู้เชี่ยวชาญ'
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
    difficultyLevel: '',
    tips: '',
    warnings: ''
  });
  
  const [error, setError] = useState('');

  // Load wisdom entries from Firebase
  useEffect(() => {
    const loadWisdom = async () => {
      try {
        setLoading(true);
        console.log('Loading fishing wisdom...');

        // Limit to 100 entries to reduce Firestore reads
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
        console.log('Loaded fishing wisdom:', wisdomData.length);

        setWisdomEntries(wisdomData);
      } catch (error) {
        console.error('Error loading wisdom:', error);
      } finally {
        setLoading(false);
      }
    };

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
      const wisdomData = {
        ...formData,
        contributorId: userProfile.id,
        contributorName: userProfile.name || userProfile.email,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active'
      };

      await addDoc(collection(db, 'fishingWisdom'), wisdomData);
      
      setAddModalOpen(false);
      setFormData({
        title: '',
        category: '',
        fishType: '',
        description: '',
        technique: '',
        materials: '',
        season: '',
        location: '',
        difficultyLevel: '',
        tips: '',
        warnings: ''
      });
    } catch (error) {
      console.error('Error adding wisdom:', error);
      setError('เกิดข้อผิดพลาดในการเพิ่มภูมิปัญญา');
    }
  };

  const handleEditWisdom = async () => {
    if (!validateForm()) return;

    try {
      const wisdomData = {
        ...formData,
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'fishingWisdom', selectedWisdom.id), wisdomData);
      
      setEditModalOpen(false);
      setSelectedWisdom(null);
    } catch (error) {
      console.error('Error updating wisdom:', error);
      setError('เกิดข้อผิดพลาดในการแก้ไขภูมิปัญญา');
    }
  };

  const handleDeleteWisdom = async () => {
    try {
      await deleteDoc(doc(db, 'fishingWisdom', selectedWisdom.id));
      setDeleteDialogOpen(false);
      setSelectedWisdom(null);
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
      fishType: wisdom.fishType,
      description: wisdom.description,
      technique: wisdom.technique,
      materials: wisdom.materials || '',
      season: wisdom.season || '',
      location: wisdom.location || '',
      difficultyLevel: wisdom.difficultyLevel || '',
      tips: wisdom.tips || '',
      warnings: wisdom.warnings || ''
    });
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

  const getDifficultyColor = (level) => {
    switch (level) {
      case 'ง่าย': return 'success';
      case 'ปานกลาง': return 'warning';
      case 'ยาก': return 'error';
      case 'ผู้เชี่ยวชาญ': return 'secondary';
      default: return 'default';
    }
  };

  const WisdomFormModal = ({ open, onClose, onSubmit, title }) => (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={8}>
            <TextField
              name="title"
              label="ชื่อภูมิปัญญา"
              value={formData.title}
              onChange={handleInputChange}
              fullWidth
              required
              placeholder="เช่น การทำแหยงตันจับปลาบึก, วิธีหาปลาโขงในฤดูแล้ง"
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <FormControl fullWidth required>
              <InputLabel>ระดับความยาก</InputLabel>
              <Select
                name="difficultyLevel"
                value={formData.difficultyLevel}
                onChange={handleInputChange}
                label="ระดับความยาก"
              >
                {DIFFICULTY_LEVELS.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel>หมวดหมู่</InputLabel>
              <Select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                label="หมวดหมู่"
              >
                {WISDOM_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              name="fishType"
              label="ชนิดปลาเป้าหมาย"
              value={formData.fishType}
              onChange={handleInputChange}
              fullWidth
              placeholder="เช่น ปลาโขง, ปลาบึก, ปลาเสือตอน"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              name="season"
              label="ฤดูกาล/เวลาที่เหมาะสม"
              value={formData.season}
              onChange={handleInputChange}
              fullWidth
              placeholder="เช่น หน้าแล้ง, หน้าฝน, เดือน 3-5"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              name="location"
              label="สถานที่/พื้นที่"
              value={formData.location}
              onChange={handleInputChange}
              fullWidth
              placeholder="เช่น น้ำลึก, ริมฝั่ง, ปากลำธาร"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              name="description"
              label="คำอธิบายภูมิปัญญา"
              value={formData.description}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={3}
              required
              placeholder="อธิบายภูมิปัญญานี้โดยสังเขป"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              name="technique"
              label="วิธีการ/เทคนิคการปฏิบัติ"
              value={formData.technique}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={4}
              required
              placeholder="อธิบายขั้นตอนการปฏิบัติอย่างละเอียด"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              name="materials"
              label="วัสดุอุปกรณ์ที่ใช้"
              value={formData.materials}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={2}
              placeholder="รายการวัสดุและอุปกรณ์ที่จำเป็น"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              name="tips"
              label="เคล็ดลับและข้อแนะนำ"
              value={formData.tips}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={2}
              placeholder="เคล็ดลับเพิ่มเติมเพื่อความสำเร็จ"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              name="warnings"
              label="ข้อควรระวัง"
              value={formData.warnings}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={2}
              placeholder="สิ่งที่ควรระวังหรือหลีกเลี่ยง"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button onClick={onSubmit} variant="contained">
          {title.includes('เพิ่ม') ? 'เพิ่มภูมิปัญญา' : 'บันทึกการแก้ไข'}
        </Button>
      </DialogActions>
    </Dialog>
  );

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
                <InputLabel>กรองตามหมวดหมู่</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  label="กรองตามหมวดหมู่"
                >
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  {WISDOM_CATEGORIES.map((category) => (
                    <MenuItem key={category} value={category}>
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
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ชื่อภูมิปัญญา</TableCell>
                <TableCell>หมวดหมู่</TableCell>
                <TableCell>ชนิดปลา</TableCell>
                <TableCell>ระดับความยาก</TableCell>
                <TableCell>ผู้บันทึก</TableCell>
                <TableCell>วันที่บันทึก</TableCell>
                <TableCell align="center">การจัดการ</TableCell>
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
                    <Chip label={wisdom.category} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={wisdom.fishType} size="small" color="secondary" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {wisdom.difficultyLevel && (
                      <Chip 
                        label={wisdom.difficultyLevel} 
                        size="small" 
                        color={getDifficultyColor(wisdom.difficultyLevel)}
                        variant="outlined" 
                      />
                    )}
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
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
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
          onClose={() => {
            setAddModalOpen(false);
            setError('');
            setFormData({
              title: '',
              category: '',
              fishType: '',
              description: '',
              technique: '',
              materials: '',
              season: '',
              location: '',
              difficultyLevel: '',
              tips: '',
              warnings: ''
            });
          }}
          onSubmit={handleAddWisdom}
          title="เพิ่มภูมิปัญญาใหม่"
        />

        {/* Edit Wisdom Modal */}
        <WisdomFormModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setError('');
            setSelectedWisdom(null);
          }}
          onSubmit={handleEditWisdom}
          title="แก้ไขภูมิปัญญา"
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
                  {selectedWisdom.difficultyLevel && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">ระดับความยาก:</Typography>
                      <Chip 
                        label={selectedWisdom.difficultyLevel} 
                        size="small" 
                        color={getDifficultyColor(selectedWisdom.difficultyLevel)} 
                      />
                    </Grid>
                  )}
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
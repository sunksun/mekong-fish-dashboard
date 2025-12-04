'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Alert,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  FormHelperText,
  CircularProgress,
  InputAdornment,
  Chip
} from '@mui/material';
import {
  LocationOn,
  Add,
  Edit,
  Delete,
  Visibility,
  Map as MapIcon,
  Search
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, orderBy, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

// ฟังก์ชันแปลงข้อมูลจาก Firestore
const transformFirestoreFishingSpot = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    spotName: data.spotName || '',
    location: data.location || '',
    description: data.description || '',
    latitude: data.latitude || 0,
    longitude: data.longitude || 0,
    status: data.status || 'active',
    createdAt: data.createdAt ? data.createdAt.toDate?.()?.toISOString()?.split('T')[0] || data.createdAt : new Date().toISOString().split('T')[0],
    createdBy: data.createdBy || ''
  };
};

export default function FishingSpotsPage() {
  const router = useRouter();
  const { userProfile, hasAnyRole } = useAuth();
  const [fishingSpots, setFishingSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSpots, setFilteredSpots] = useState([]);
  
  // Create Dialog State
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  
  // Edit Dialog State
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editingSpot, setEditingSpot] = useState(null);
  
  // Detail Dialog State
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState(null);
  
  // Delete Dialog State
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingSpot, setDeletingSpot] = useState(null);
  
  // Form Data
  const [formData, setFormData] = useState({
    spotName: '',
    location: '',
    description: '',
    latitude: '',
    longitude: '',
    status: 'active'
  });
  const [formErrors, setFormErrors] = useState({});

  // Check permissions
  const canManageSpots = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  useEffect(() => {
    // เรียกข้อมูลจุดจับปลาจาก Firestore แบบ real-time
    const loadFishingSpots = () => {
      setLoading(true);
      
      const spotsQuery = query(
        collection(db, 'fishingSpots'),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(spotsQuery, (snapshot) => {
        const spots = snapshot.docs.map(doc => transformFirestoreFishingSpot(doc));
        setFishingSpots(spots);
        setFilteredSpots(spots);
        setLoading(false);
      }, (error) => {
        console.error('Error loading fishing spots:', error);
        setLoading(false);
      });

      return unsubscribe;
    };

    const unsubscribe = loadFishingSpots();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Filter fishing spots based on search query
  useEffect(() => {
    let filtered = fishingSpots;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(spot =>
        spot.spotName.toLowerCase().includes(query) ||
        spot.location.toLowerCase().includes(query) ||
        spot.description.toLowerCase().includes(query)
      );
    }
    
    setFilteredSpots(filtered);
  }, [searchQuery, fishingSpots]);

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  // Form validation
  const validateForm = () => {
    const errors = {};
    
    if (!formData.spotName.trim()) {
      errors.spotName = 'กรุณากรอกชื่อจุดจับปลา';
    }
    
    if (!formData.latitude) {
      errors.latitude = 'กรุณากรอกค่าละติจูด';
    } else if (isNaN(formData.latitude) || formData.latitude < -90 || formData.latitude > 90) {
      errors.latitude = 'ค่าละติจูดต้องอยู่ระหว่าง -90 ถึง 90';
    }
    
    if (!formData.longitude) {
      errors.longitude = 'กรุณากรอกค่าลองติจูด';
    } else if (isNaN(formData.longitude) || formData.longitude < -180 || formData.longitude > 180) {
      errors.longitude = 'ค่าลองติจูดต้องอยู่ระหว่าง -180 ถึง 180';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value
    });
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors({
        ...formErrors,
        [field]: ''
      });
    }
  };

  // Handle create spot
  const handleCreateSpot = async () => {
    if (!validateForm()) return;

    setCreateLoading(true);
    setCreateError('');

    try {
      const dataToSave = {
        spotName: formData.spotName.trim(),
        location: formData.location.trim(),
        description: formData.description.trim(),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        status: formData.status,
        createdAt: new Date(),
        createdBy: userProfile?.email || 'admin'
      };
      
      await addDoc(collection(db, 'fishingSpots'), dataToSave);
      
      setOpenCreateDialog(false);
      resetForm();
      
      alert('บันทึกจุดจับปลาสำเร็จ!');
      
    } catch (error) {
      setCreateError(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle edit spot
  const handleEditSpot = async () => {
    if (!validateForm()) return;

    setEditLoading(true);
    setEditError('');

    try {
      const dataToUpdate = {
        spotName: formData.spotName.trim(),
        location: formData.location.trim(),
        description: formData.description.trim(),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        status: formData.status,
        updatedAt: new Date()
      };
      
      await updateDoc(doc(db, 'fishingSpots', editingSpot.id), dataToUpdate);
      
      setOpenEditDialog(false);
      setEditingSpot(null);
      resetForm();
      
      alert('อัปเดตจุดจับปลาสำเร็จ!');
      
    } catch (error) {
      setEditError(error.message || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle delete spot
  const handleDeleteSpot = async () => {
    setDeleteLoading(true);

    try {
      await deleteDoc(doc(db, 'fishingSpots', deletingSpot.id));
      
      setOpenDeleteDialog(false);
      setDeletingSpot(null);
      
      alert('ลบจุดจับปลาสำเร็จ!');
      
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      spotName: '',
      location: '',
      description: '',
      latitude: '',
      longitude: '',
      status: 'active'
    });
    setFormErrors({});
    setCreateError('');
    setEditError('');
  };

  const handleOpenCreateDialog = () => {
    resetForm();
    setOpenCreateDialog(true);
  };

  const handleOpenEditDialog = (spot) => {
    setFormData({
      spotName: spot.spotName,
      location: spot.location,
      description: spot.description,
      latitude: spot.latitude.toString(),
      longitude: spot.longitude.toString(),
      status: spot.status
    });
    setEditingSpot(spot);
    setFormErrors({});
    setEditError('');
    setOpenEditDialog(true);
  };

  const handleOpenDetailDialog = (spot) => {
    setSelectedSpot(spot);
    setOpenDetailDialog(true);
  };

  const handleOpenDeleteDialog = (spot) => {
    setDeletingSpot(spot);
    setOpenDeleteDialog(true);
  };

  if (!canManageSpots) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 1, pl: 1.5 }}>
          <Alert severity="error">
            คุณไม่มีสิทธิ์เข้าถึงการจัดการจุดจับปลา
          </Alert>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 1, pl: 1.5 }}>
        {/* Header */}
        <Box mb={2}>
          <Typography variant="h4" gutterBottom>
            จุดจับปลาแม่น้ำโขง
          </Typography>
          <Typography variant="body1" color="text.secondary">
            จัดการข้อมูลจุดจับปลาสำหรับสร้างแผนที่การจับปลา
          </Typography>
        </Box>

        {/* Controls */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <TextField
            placeholder="ค้นหาจุดจับปลา..."
            value={searchQuery}
            onChange={handleSearch}
            size="small"
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />

          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<MapIcon />}
              onClick={() => router.push('/maps/fishing/view')}
              disabled={loading}
            >
              ดูแผนที่
            </Button>

            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleOpenCreateDialog}
              disabled={loading}
            >
              เพิ่มจุดจับปลา
            </Button>
          </Box>
        </Box>

        {/* Data Table */}
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ชื่อจุดจับปลา</TableCell>
                    <TableCell>ตำแหน่งที่ตั้ง</TableCell>
                    <TableCell>คำอธิบาย</TableCell>
                    <TableCell>พิกัด</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell>วันที่สร้าง</TableCell>
                    <TableCell align="center">การดำเนินการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <CircularProgress />
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          กำลังโหลดข้อมูล...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredSpots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {searchQuery ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีข้อมูลจุดจับปลา'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSpots.map((spot) => (
                      <TableRow key={spot.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {spot.spotName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {spot.location || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {spot.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {spot.latitude}, {spot.longitude}
                          </Typography>
                          <Button
                            size="small"
                            startIcon={<LocationOn />}
                            onClick={() => window.open(`https://www.google.com/maps?q=${spot.latitude},${spot.longitude}`, '_blank')}
                            sx={{ mt: 0.5 }}
                          >
                            ดูใน Google Maps
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={spot.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                            color={spot.status === 'active' ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {spot.createdAt}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="ดูรายละเอียด">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDetailDialog(spot)}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="แก้ไข">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEditDialog(spot)}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="ลบ">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleOpenDeleteDialog(spot)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>เพิ่มจุดจับปลาใหม่</DialogTitle>
          <DialogContent>
            {createError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {createError}
              </Alert>
            )}
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="ชื่อจุดจับปลา *"
                  value={formData.spotName}
                  onChange={handleInputChange('spotName')}
                  error={!!formErrors.spotName}
                  helperText={formErrors.spotName || "เช่น ดอนไข่, แก่งคุดคู้, หาดนางคอย"}
                  disabled={createLoading}
                  placeholder="ระบุชื่อจุดจับปลา"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationOn color="primary" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="ตำแหน่งที่ตั้ง"
                  value={formData.location}
                  onChange={handleInputChange('location')}
                  disabled={createLoading}
                  placeholder="เช่น ท่าแสดง หนองคาย, แก่งกบัด มุกดาหาร"
                  helperText="ระบุตำแหน่งที่ตั้งของจุดจับปลา (ไม่จำเป็น)"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MapIcon color="primary" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ละติจูด (Latitude) *"
                  type="number"
                  value={formData.latitude}
                  onChange={handleInputChange('latitude')}
                  error={!!formErrors.latitude}
                  helperText={formErrors.latitude || "เช่น 17.8768"}
                  disabled={createLoading}
                  placeholder="ระบุค่าละติจูด"
                  inputProps={{ step: "any", min: -90, max: 90 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MapIcon color="primary" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ลองติจูด (Longitude) *"
                  type="number"
                  value={formData.longitude}
                  onChange={handleInputChange('longitude')}
                  error={!!formErrors.longitude}
                  helperText={formErrors.longitude || "เช่น 102.7419"}
                  disabled={createLoading}
                  placeholder="ระบุค่าลองติจูด"
                  inputProps={{ step: "any", min: -180, max: 180 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MapIcon color="primary" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth disabled={createLoading}>
                  <InputLabel>สถานะ</InputLabel>
                  <Select
                    value={formData.status}
                    label="สถานะ"
                    onChange={handleInputChange('status')}
                  >
                    <MenuItem value="active">ใช้งาน</MenuItem>
                    <MenuItem value="inactive">ไม่ใช้งาน</MenuItem>
                  </Select>
                  <FormHelperText>สถานะการใช้งานของจุดจับปลา</FormHelperText>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="คำอธิบาย"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange('description')}
                  disabled={createLoading}
                  placeholder="ระบุคำอธิบายเพิ่มเติมของจุดจับปลา"
                  helperText="ข้อมูลเพิ่มเติมเกี่ยวกับจุดจับปลา (ไม่จำเป็น)"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreateDialog(false)} disabled={createLoading}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleCreateSpot}
              variant="contained"
              disabled={createLoading}
              startIcon={createLoading ? <CircularProgress size={20} /> : null}
            >
              {createLoading ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>แก้ไขจุดจับปลา</DialogTitle>
          <DialogContent>
            {editError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {editError}
              </Alert>
            )}
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="ชื่อจุดจับปลา *"
                  value={formData.spotName}
                  onChange={handleInputChange('spotName')}
                  error={!!formErrors.spotName}
                  helperText={formErrors.spotName || "เช่น ดอนไข่, แก่งคุดคู้, หาดนางคอย"}
                  disabled={editLoading}
                  placeholder="ระบุชื่อจุดจับปลา"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationOn color="primary" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="ตำแหน่งที่ตั้ง"
                  value={formData.location}
                  onChange={handleInputChange('location')}
                  disabled={editLoading}
                  placeholder="เช่น ท่าแสดง หนองคาย, แก่งกบัด มุกดาหาร"
                  helperText="ระบุตำแหน่งที่ตั้งของจุดจับปลา (ไม่จำเป็น)"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MapIcon color="primary" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ละติจูด (Latitude) *"
                  type="number"
                  value={formData.latitude}
                  onChange={handleInputChange('latitude')}
                  error={!!formErrors.latitude}
                  helperText={formErrors.latitude || "เช่น 17.8768"}
                  disabled={editLoading}
                  placeholder="ระบุค่าละติจูด"
                  inputProps={{ step: "any", min: -90, max: 90 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MapIcon color="primary" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ลองติจูด (Longitude) *"
                  type="number"
                  value={formData.longitude}
                  onChange={handleInputChange('longitude')}
                  error={!!formErrors.longitude}
                  helperText={formErrors.longitude || "เช่น 102.7419"}
                  disabled={editLoading}
                  placeholder="ระบุค่าลองติจูด"
                  inputProps={{ step: "any", min: -180, max: 180 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MapIcon color="primary" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth disabled={editLoading}>
                  <InputLabel>สถานะ</InputLabel>
                  <Select
                    value={formData.status}
                    label="สถานะ"
                    onChange={handleInputChange('status')}
                  >
                    <MenuItem value="active">ใช้งาน</MenuItem>
                    <MenuItem value="inactive">ไม่ใช้งาน</MenuItem>
                  </Select>
                  <FormHelperText>สถานะการใช้งานของจุดจับปลา</FormHelperText>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="คำอธิบาย"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange('description')}
                  disabled={editLoading}
                  placeholder="ระบุคำอธิบายเพิ่มเติมของจุดจับปลา"
                  helperText="ข้อมูลเพิ่มเติมเกี่ยวกับจุดจับปลา (ไม่จำเป็น)"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenEditDialog(false)} disabled={editLoading}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleEditSpot}
              variant="contained"
              disabled={editLoading}
              startIcon={editLoading ? <CircularProgress size={20} /> : null}
            >
              {editLoading ? 'กำลังอัปเดต...' : 'อัปเดต'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={openDetailDialog} onClose={() => setOpenDetailDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>รายละเอียดจุดจับปลา</DialogTitle>
          <DialogContent>
            {selectedSpot && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="primary">
                        ข้อมูลจุดจับปลา
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">ชื่อจุดจับปลา</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedSpot.spotName}
                          </Typography>
                        </Grid>
                        
                        {selectedSpot.location && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">ตำแหน่งที่ตั้ง</Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {selectedSpot.location}
                            </Typography>
                          </Grid>
                        )}
                        
                        {selectedSpot.description && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">คำอธิบาย</Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {selectedSpot.description}
                            </Typography>
                          </Grid>
                        )}
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">ละติจูด</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedSpot.latitude}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">ลองติจูด</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedSpot.longitude}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Button
                            variant="outlined"
                            startIcon={<LocationOn />}
                            onClick={() => window.open(`https://www.google.com/maps?q=${selectedSpot.latitude},${selectedSpot.longitude}`, '_blank')}
                            sx={{ mt: 1 }}
                          >
                            ดูใน Google Maps
                          </Button>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">สถานะ</Typography>
                          <Chip
                            label={selectedSpot.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                            color={selectedSpot.status === 'active' ? 'success' : 'default'}
                            size="small"
                          />
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">วันที่สร้าง</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedSpot.createdAt}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDetailDialog(false)}>
              ปิด
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
          <DialogTitle>ยืนยันการลบ</DialogTitle>
          <DialogContent>
            <Typography>
              คุณต้องการลบจุดจับปลา &quot;{deletingSpot?.spotName}&quot; หรือไม่?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              การดำเนินการนี้ไม่สามารถยกเลิกได้
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)} disabled={deleteLoading}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleDeleteSpot}
              color="error"
              variant="contained"
              disabled={deleteLoading}
              startIcon={deleteLoading ? <CircularProgress size={20} /> : null}
            >
              {deleteLoading ? 'กำลังลบ...' : 'ลบ'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Development Notice */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>หมายเหตุการพัฒนา:</strong> ข้อมูลจุดจับปลาจะถูกนำไปใช้ในการสร้างแผนที่การจับปลา GIS
            ทั้งสำหรับ Dashboard และ Mobile Application
          </Typography>
        </Alert>
      </Box>
    </DashboardLayout>
  );
}
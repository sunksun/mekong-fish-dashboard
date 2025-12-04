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
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Search,
  Add,
  Edit,
  Delete,
  Visibility,
  LocationOn,
  Map,
  WaterDrop
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function WaterQualityStationsPage() {
  const { userProfile, hasAnyRole } = useAuth();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStations, setFilteredStations] = useState([]);
  
  // Create Dialog State
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  
  // Edit Dialog State
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editingStation, setEditingStation] = useState(null);
  
  // Detail Dialog State
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  
  // Form Data
  const [formData, setFormData] = useState({
    stationName: '',
    location: '',
    latitude: '',
    longitude: '',
    description: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Check permissions
  const canManageStations = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  // Load stations from Firebase
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'waterStations'),
      (snapshot) => {
        const stationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
        
        // Sort by creation date (newest first)
        stationsData.sort((a, b) => b.createdAt - a.createdAt);
        
        setStations(stationsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading stations:', error);
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    // Filter stations based on search query
    let filtered = [...stations];
    
    if (searchQuery) {
      filtered = filtered.filter(station =>
        (station.stationName && station.stationName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (station.location && station.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (station.description && station.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    setFilteredStations(filtered);
  }, [stations, searchQuery]);

  // Form validation
  const validateForm = () => {
    const errors = {};
    
    if (!formData.stationName) {
      errors.stationName = 'กรุณากรอกชื่อสถานีตรวจวัด';
    }
    
    if (!formData.location) {
      errors.location = 'กรุณากรอกตำแหน่งที่ตั้ง';
    }
    
    if (!formData.latitude) {
      errors.latitude = 'กรุณากรอกละติจูด';
    } else if (isNaN(formData.latitude) || formData.latitude < -90 || formData.latitude > 90) {
      errors.latitude = 'ละติจูดต้องเป็นตัวเลข -90 ถึง 90';
    }
    
    if (!formData.longitude) {
      errors.longitude = 'กรุณากรอกลองติจูด';
    } else if (isNaN(formData.longitude) || formData.longitude < -180 || formData.longitude > 180) {
      errors.longitude = 'ลองติจูดต้องเป็นตัวเลข -180 ถึง 180';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormData({
      ...formData,
      [field]: value
    });
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors({
        ...formErrors,
        [field]: ''
      });
    }
  };

  // Handle create station
  const handleCreateStation = async () => {
    if (!validateForm()) return;

    setCreateLoading(true);
    setCreateError('');

    try {
      const dataToSave = {
        stationName: formData.stationName,
        location: formData.location,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        description: formData.description,
        status: 'active',
        createdAt: new Date(),
        createdBy: userProfile?.email || 'admin',
        updatedAt: new Date()
      };
      
      await addDoc(collection(db, 'waterStations'), dataToSave);
      
      setOpenCreateDialog(false);
      resetForm();
      
      alert('เพิ่มจุดตรวจวัดสำเร็จ!');
      
    } catch (error) {
      setCreateError(error.message || 'เกิดข้อผิดพลาดในการเพิ่มจุดตรวจวัด');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle edit station
  const handleEditStation = async () => {
    if (!validateForm()) return;

    setEditLoading(true);
    setEditError('');

    try {
      const dataToUpdate = {
        stationName: formData.stationName,
        location: formData.location,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        description: formData.description,
        updatedAt: new Date(),
        updatedBy: userProfile?.email || 'admin'
      };
      
      await updateDoc(doc(db, 'waterStations', editingStation.id), dataToUpdate);
      
      setOpenEditDialog(false);
      setEditingStation(null);
      resetForm();
      
      alert('แก้ไขจุดตรวจวัดสำเร็จ!');
      
    } catch (error) {
      setEditError(error.message || 'เกิดข้อผิดพลาดในการแก้ไขจุดตรวจวัด');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle delete station
  const handleDeleteStation = async (station) => {
    if (!confirm(`คุณต้องการลบจุดตรวจวัด "${station.stationName}" หรือไม่?`)) return;

    try {
      await deleteDoc(doc(db, 'waterStations', station.id));
      alert('ลบจุดตรวจวัดสำเร็จ!');
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการลบจุดตรวจวัด: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      stationName: '',
      location: '',
      latitude: '',
      longitude: '',
      description: ''
    });
    setFormErrors({});
    setCreateError('');
    setEditError('');
  };

  const handleOpenCreateDialog = () => {
    resetForm();
    setOpenCreateDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
    resetForm();
  };

  const handleOpenEditDialog = (station) => {
    setFormData({
      stationName: station.stationName || '',
      location: station.location || '',
      latitude: station.latitude?.toString() || '',
      longitude: station.longitude?.toString() || '',
      description: station.description || ''
    });
    setEditingStation(station);
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setEditingStation(null);
    resetForm();
  };

  // Detail Modal functions
  const handleOpenDetailDialog = (station) => {
    setSelectedStation(station);
    setOpenDetailDialog(true);
  };

  const handleCloseDetailDialog = () => {
    setOpenDetailDialog(false);
    setSelectedStation(null);
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  // Permission check - show unauthorized if user doesn't have access
  if (!hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT])) {
    return (
      <DashboardLayout>
        <Alert severity="error">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 1, pl: 1.5 }}>
        {/* Header */}
        <Box mb={3}>
          <Typography variant="h4" gutterBottom>
            จุดตรวจวัดคุณภาพน้ำ
          </Typography>
          <Typography variant="body1" color="text.secondary">
            จัดการจุดตรวจวัดคุณภาพน้ำในแม่น้ำโขง
          </Typography>
        </Box>

        {/* Controls */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
              {/* Search */}
              <TextField
                placeholder="ค้นหาจุดตรวจวัด..."
                value={searchQuery}
                onChange={handleSearch}
                size="small"
                sx={{ minWidth: 300 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
              
              {/* Add Button */}
              {canManageStations && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleOpenCreateDialog}
                >
                  เพิ่มจุดตรวจวัด
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Stations Table */}
        <Card>
          <CardContent>
            {loading ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ชื่อสถานี / ตำแหน่งที่ตั้ง</TableCell>
                      <TableCell>พิกัด</TableCell>
                      <TableCell>สถานะ</TableCell>
                      <TableCell>วันที่เพิ่ม</TableCell>
                      <TableCell align="center">การดำเนินการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredStations.map((station) => (
                      <TableRow key={station.id} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <WaterDrop color="primary" />
                            <Box>
                              <Typography fontWeight="medium">
                                {station.stationName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {station.location}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {station.latitude?.toFixed(4)}, {station.longitude?.toFixed(4)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={station.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
                            color={station.status === 'active' ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {station.createdAt?.toLocaleDateString('th-TH')}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box display="flex" gap={1} justifyContent="center">
                            <Tooltip title="ดูรายละเอียด">
                              <IconButton 
                                size="small" 
                                onClick={() => handleOpenDetailDialog(station)}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                            {canManageStations && (
                              <>
                                <Tooltip title="แก้ไข">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleOpenEditDialog(station)}
                                  >
                                    <Edit />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="ลบ">
                                  <IconButton 
                                    size="small" 
                                    color="error"
                                    onClick={() => handleDeleteStation(station)}
                                  >
                                    <Delete />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {!loading && filteredStations.length === 0 && (
              <Box textAlign="center" py={3}>
                <Typography color="text.secondary">
                  {searchQuery ? 'ไม่พบจุดตรวจวัดที่ค้นหา' : 'ยังไม่มีจุดตรวจวัดในระบบ'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Create Station Dialog */}
        <Dialog
          open={openCreateDialog}
          onClose={handleCloseCreateDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={2}>
              <LocationOn sx={{ color: 'primary.main', fontSize: 28 }} />
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  เพิ่มจุดตรวจวัดใหม่
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  เพิ่มจุดตรวจวัดคุณภาพน้ำในแม่น้ำโขง
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              {createError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {createError}
                </Alert>
              )}
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="ชื่อสถานีตรวจวัด *"
                    value={formData.stationName}
                    onChange={handleInputChange('stationName')}
                    error={!!formErrors.stationName}
                    helperText={formErrors.stationName || "เช่น สถานีตรวจวัดหนองคาย"}
                    disabled={createLoading}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="ตำแหน่งที่ตั้ง *"
                    value={formData.location}
                    onChange={handleInputChange('location')}
                    error={!!formErrors.location}
                    helperText={formErrors.location || "เช่น ท่าแสดง หนองคาย"}
                    disabled={createLoading}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ละติจูด *"
                    type="number"
                    value={formData.latitude}
                    onChange={handleInputChange('latitude')}
                    error={!!formErrors.latitude}
                    helperText={formErrors.latitude || "เช่น 17.8768"}
                    disabled={createLoading}
                    inputProps={{ step: "any", min: -90, max: 90 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ลองติจูด *"
                    type="number"
                    value={formData.longitude}
                    onChange={handleInputChange('longitude')}
                    error={!!formErrors.longitude}
                    helperText={formErrors.longitude || "เช่น 102.7419"}
                    disabled={createLoading}
                    inputProps={{ step: "any", min: -180, max: 180 }}
                  />
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
                    placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับจุดตรวจวัด..."
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={handleCloseCreateDialog}
              disabled={createLoading}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateStation}
              disabled={createLoading}
              startIcon={createLoading ? <CircularProgress size={20} /> : <Add />}
            >
              {createLoading ? 'กำลังเพิ่ม...' : 'เพิ่มจุดตรวจวัด'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Station Dialog */}
        <Dialog
          open={openEditDialog}
          onClose={handleCloseEditDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={2}>
              <Edit sx={{ color: 'primary.main', fontSize: 28 }} />
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  แก้ไขจุดตรวจวัด
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {editingStation?.stationName}
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              {editError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {editError}
                </Alert>
              )}
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="ชื่อสถานีตรวจวัด *"
                    value={formData.stationName}
                    onChange={handleInputChange('stationName')}
                    error={!!formErrors.stationName}
                    helperText={formErrors.stationName}
                    disabled={editLoading}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="ตำแหน่งที่ตั้ง *"
                    value={formData.location}
                    onChange={handleInputChange('location')}
                    error={!!formErrors.location}
                    helperText={formErrors.location}
                    disabled={editLoading}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ละติจูด *"
                    type="number"
                    value={formData.latitude}
                    onChange={handleInputChange('latitude')}
                    error={!!formErrors.latitude}
                    helperText={formErrors.latitude}
                    disabled={editLoading}
                    inputProps={{ step: "any", min: -90, max: 90 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ลองติจูด *"
                    type="number"
                    value={formData.longitude}
                    onChange={handleInputChange('longitude')}
                    error={!!formErrors.longitude}
                    helperText={formErrors.longitude}
                    disabled={editLoading}
                    inputProps={{ step: "any", min: -180, max: 180 }}
                  />
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
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={handleCloseEditDialog}
              disabled={editLoading}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              onClick={handleEditStation}
              disabled={editLoading}
              startIcon={editLoading ? <CircularProgress size={20} /> : <Edit />}
            >
              {editLoading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog
          open={openDetailDialog}
          onClose={handleCloseDetailDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={2}>
              <WaterDrop sx={{ color: 'primary.main' }} />
              <Box>
                <Typography variant="h6">
                  รายละเอียดจุดตรวจวัด
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedStation?.stationName}
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedStation && (
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom color="primary">
                        ข้อมูลจุดตรวจวัด
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">ชื่อสถานี</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedStation.stationName}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">สถานะ</Typography>
                          <Chip 
                            label={selectedStation.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
                            color={selectedStation.status === 'active' ? 'success' : 'default'}
                            size="small"
                          />
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">ตำแหน่งที่ตั้ง</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedStation.location}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">ละติจูด</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedStation.latitude?.toFixed(6)}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">ลองติจูด</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedStation.longitude?.toFixed(6)}
                          </Typography>
                        </Grid>
                        
                        {selectedStation.description && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">คำอธิบาย</Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {selectedStation.description}
                            </Typography>
                          </Grid>
                        )}
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">วันที่เพิ่ม</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedStation.createdAt?.toLocaleString('th-TH')}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">เพิ่มโดย</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedStation.createdBy}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDetailDialog}>
              ปิด
            </Button>
            {canManageStations && selectedStation && (
              <Button 
                variant="contained" 
                startIcon={<Map />}
                onClick={() => {
                  // TODO: Open in map view
                  window.open(`https://www.google.com/maps?q=${selectedStation.latitude},${selectedStation.longitude}`, '_blank');
                }}
              >
                ดูในแผนที่
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
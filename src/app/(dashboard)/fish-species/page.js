'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Avatar
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Search,
  FilterList,
  Upload,
  Phishing,
  TableChart
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function FishSpeciesPage() {
  const router = useRouter();
  const { hasAnyRole } = useAuth();
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterIUCN, setFilterIUCN] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [editFormData, setEditFormData] = useState({
    thai_name: '',
    local_name: '',
    scientific_name: '',
    group: '',
    iucn_status: '',
    description: '',
    habitat: '',
    distribution: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const canEdit = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  // Function to compress and resize image
  const compressImage = (file, maxWidth = 1200, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              resolve(new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              }));
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  useEffect(() => {
    const loadSpecies = async () => {
      try {
        setLoading(true);
        console.log('Loading fish species...');

        const q = query(
          collection(db, 'fish_species'),
          orderBy('thai_name', 'asc')
        );

        const snapshot = await getDocs(q);
        const speciesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('Loaded fish species:', speciesData.length);

        setSpecies(speciesData);
      } catch (error) {
        console.error('Error loading species:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSpecies();
  }, []);

  const filteredSpecies = species.filter(s => {
    const matchesSearch =
      s.thai_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.scientific_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.local_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGroup = filterGroup === 'all' || s.group === filterGroup;
    const matchesIUCN = filterIUCN === 'all' || s.iucn_status === filterIUCN;

    return matchesSearch && matchesGroup && matchesIUCN;
  });

  const uniqueGroups = [...new Set(species.map(s => s.group))].filter(Boolean);

  // เรียงลำดับสถานะ IUCN ตามมาตรฐาน
  const iucnOrder = [
    'CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE',
    'Alien (Africa)', 'Alien (North America)', 'Alien (South America)',
    'Alien (Central America)', 'Alien (West Africa)', 'Alien (Coastal)',
    'Alien (China)', 'Alien (Asia)', '-'
  ];

  const uniqueIUCN = [...new Set(species.map(s => s.iucn_status))].filter(Boolean).sort((a, b) => {
    const indexA = iucnOrder.indexOf(a);
    const indexB = iucnOrder.indexOf(b);

    // ถ้าพบในลิสต์ ให้เรียงตาม index
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    // ถ้า a พบแต่ b ไม่พบ ให้ a มาก่อน
    if (indexA !== -1) return -1;
    // ถ้า b พบแต่ a ไม่พบ ให้ b มาก่อน
    if (indexB !== -1) return 1;
    // ถ้าทั้งคู่ไม่พบ ให้เรียงตามตัวอักษร
    return a.localeCompare(b);
  });

  const getIUCNColor = (status) => {
    switch (status) {
      case 'CR': return 'error';
      case 'EN': return 'error';
      case 'VU': return 'warning';
      case '-': return 'default';
      default:
        if (status?.includes('Alien')) return 'info';
        return 'default';
    }
  };

  const handleDelete = async () => {
    if (!selectedSpecies) return;

    try {
      await deleteDoc(doc(db, 'fish_species', selectedSpecies.id));
      setDeleteDialogOpen(false);
      setSelectedSpecies(null);
    } catch (error) {
      console.error('Error deleting species:', error);
      alert('ไม่สามารถลบข้อมูลได้');
    }
  };

  const handleOpenDetail = (fish) => {
    setSelectedSpecies(fish);
    setDetailDialogOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setSelectedSpecies(null);
  };

  const handleOpenEdit = (fish) => {
    setSelectedSpecies(fish);

    // Debug: ตรวจสอบค่า iucn_status
    console.log('🐟 กำลังแก้ไขปลา:', fish.thai_name);
    console.log('📊 IUCN Status จาก Firestore:', fish.iucn_status);
    console.log('📋 ข้อมูลปลาทั้งหมด:', fish);

    setEditFormData({
      thai_name: fish.thai_name || '',
      local_name: fish.local_name || '',
      scientific_name: fish.scientific_name || '',
      group: fish.group || '',
      iucn_status: fish.iucn_status || '',
      description: fish.description || '',
      habitat: fish.habitat || '',
      distribution: fish.distribution || ''
    });
    setSelectedImages([]);
    setImagePreviews([]);
    setEditDialogOpen(true);
  };

  const handleCloseEdit = () => {
    setEditDialogOpen(false);
    setSelectedSpecies(null);
    setEditFormData({
      thai_name: '',
      local_name: '',
      scientific_name: '',
      group: '',
      iucn_status: '',
      description: '',
      habitat: '',
      distribution: ''
    });
    setSelectedImages([]);
    setImagePreviews([]);
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    try {
      setUploadingImage(true);

      // Compress images
      const compressedFiles = await Promise.all(
        files.map(file => compressImage(file, 1200, 0.8))
      );

      // Create previews
      const previews = await Promise.all(
        compressedFiles.map(file => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(file);
          });
        })
      );

      setSelectedImages(prev => [...prev, ...compressedFiles]);
      setImagePreviews(prev => [...prev, ...previews]);
    } catch (error) {
      console.error('Error compressing images:', error);
      alert('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    if (!selectedSpecies) return;

    try {
      setSaving(true);

      // Upload new images if any
      let newPhotoUrls = [];
      if (selectedImages.length > 0) {
        const uploadPromises = selectedImages.map(async (file, index) => {
          const timestamp = Date.now();
          const fileName = `fish_species/${selectedSpecies.id}/${timestamp}_${index}.jpg`;
          const storageRef = ref(storage, fileName);
          await uploadBytes(storageRef, file);
          return await getDownloadURL(storageRef);
        });

        newPhotoUrls = await Promise.all(uploadPromises);
      }

      // Replace existing photos with new photos (if new photos uploaded)
      // If no new photos, keep existing photos
      const existingPhotos = selectedSpecies.photos || [];
      const updatedPhotos = newPhotoUrls.length > 0 ? newPhotoUrls : existingPhotos;

      // Update data with new photos
      const updatedData = {
        ...editFormData,
        photos: updatedPhotos,
        // Add image_url for mobile app compatibility (first photo only)
        image_url: updatedPhotos.length > 0 ? updatedPhotos[0] : null
      };

      const docRef = doc(db, 'fish_species', selectedSpecies.id);
      await updateDoc(docRef, updatedData);

      // Update local state
      setSpecies(prev => prev.map(s =>
        s.id === selectedSpecies.id
          ? { ...s, ...updatedData }
          : s
      ));

      handleCloseEdit();
      alert('บันทึกข้อมูลสำเร็จ');
    } catch (error) {
      console.error('Error updating species:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              ฐานข้อมูลปลาแม่น้ำโขง
            </Typography>
            <Typography variant="body1" color="text.secondary">
              จัดการข้อมูลชนิดปลาในแม่น้ำโขง
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<TableChart />}
              onClick={() => router.push('/fish-species/schema')}
              color="secondary"
            >
              ดูโครงสร้างข้อมูล
            </Button>
            {canEdit && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<Upload />}
                  onClick={() => router.push('/fish-species/import')}
                >
                  Import ข้อมูล
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => router.push('/fish-species/add')}
                >
                  เพิ่มปลาใหม่
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight="bold" color="primary">
                  {species.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ชนิดปลาทั้งหมด
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight="bold" color="error">
                  {species.filter(s => ['CR', 'EN', 'VU'].includes(s.iucn_status)).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ปลาใกล้สูญพันธุ์
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight="bold" color="secondary">
                  {uniqueGroups.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  กลุ่มปลา
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder="ค้นหาชื่อปลา (ไทย, วิทยาศาสตร์, ท้องถิ่น)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>กลุ่มปลา</InputLabel>
                  <Select
                    value={filterGroup}
                    label="กลุ่มปลา"
                    onChange={(e) => setFilterGroup(e.target.value)}
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    {uniqueGroups.map(group => (
                      <MenuItem key={group} value={group}>{group}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>สถานะ IUCN</InputLabel>
                  <Select
                    value={filterIUCN}
                    label="สถานะ IUCN"
                    onChange={(e) => setFilterIUCN(e.target.value)}
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    {uniqueIUCN.map(status => (
                      <MenuItem key={status} value={status}>{status}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Results Info */}
        {filteredSpecies.length === 0 ? (
          <Alert severity="info">
            ไม่พบข้อมูลปลาที่ตรงกับเงื่อนไขการค้นหา
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            แสดง {filteredSpecies.length} จาก {species.length} รายการ
          </Typography>
        )}

        {/* Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: 80 }}><strong>ลำดับ</strong></TableCell>
                <TableCell><strong>ชื่อไทย</strong></TableCell>
                <TableCell><strong>ชื่อท้องถิ่น</strong></TableCell>
                <TableCell align="center"><strong>รูปภาพ</strong></TableCell>
                <TableCell><strong>IUCN</strong></TableCell>
                <TableCell align="right"><strong>จัดการ</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSpecies.map((fish, index) => (
                <TableRow key={fish.id} hover>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight="medium">
                      {index + 1}
                    </Typography>
                  </TableCell>
                  <TableCell>{fish.thai_name}</TableCell>
                  <TableCell>{fish.local_name || '-'}</TableCell>
                  <TableCell align="center">
                    <Box display="flex" justifyContent="center" gap={1}>
                      {fish.photos && fish.photos.length > 0 ? (
                        <Avatar
                          src={fish.photos[0]}
                          alt={fish.thai_name}
                          sx={{
                            width: 40,
                            height: 40,
                            border: '2px solid',
                            borderColor: 'divider',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            '&:hover': {
                              transform: 'scale(1.1)'
                            }
                          }}
                          onClick={() => handleOpenDetail(fish)}
                        />
                      ) : (
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: 'grey.300',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            '&:hover': {
                              transform: 'scale(1.1)'
                            }
                          }}
                          onClick={() => handleOpenDetail(fish)}
                        >
                          <Phishing sx={{ color: 'grey.500' }} />
                        </Avatar>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={fish.iucn_status}
                      size="small"
                      color={getIUCNColor(fish.iucn_status)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDetail(fish)}
                      color="primary"
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                    {canEdit && (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEdit(fish)}
                          color="secondary"
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedSpecies(fish);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Reference Section */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              <strong>แหล่งอ้างอิง:</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 2 }}>
              • ชื่อปลามาจาก <strong>คู่มือจำแนกชนิดภาคสนามพรรณปลาลุ่มน้ำโขงที่พบในประเทศไทย</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              • รูปภาพบางส่วนจาก <strong>ศูนย์วิจัยและพัฒนาประมงน้ำจืดเลย</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 2, fontSize: '0.75rem' }}>
              ขอขอบคุณข้อมูลจากแหล่งอ้างอิงดังกล่าวข้างต้น
            </Typography>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>ยืนยันการลบ</DialogTitle>
          <DialogContent>
            <Typography>
              คุณต้องการลบข้อมูล <strong>{selectedSpecies?.thai_name}</strong> ({selectedSpecies?.scientific_name}) ใช่หรือไม่?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              ลบ
            </Button>
          </DialogActions>
        </Dialog>

        {/* Fish Detail Dialog */}
        <Dialog
          open={detailDialogOpen}
          onClose={handleCloseDetail}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight="bold">
                รายละเอียดปลา
              </Typography>
              <IconButton size="small" onClick={handleCloseDetail}>
                <Delete />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {selectedSpecies && (
              <Grid container spacing={3}>
                {/* รูปภาพปลา */}
                {selectedSpecies.photos && selectedSpecies.photos.length > 0 && (
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        width: '100%',
                        height: 300,
                        position: 'relative',
                        borderRadius: 2,
                        overflow: 'hidden',
                        bgcolor: 'grey.100'
                      }}
                    >
                      <img
                        src={selectedSpecies.photos[0]}
                        alt={selectedSpecies.thai_name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    </Box>
                  </Grid>
                )}

                {/* ข้อมูลพื้นฐาน */}
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ชื่อไทย
                  </Typography>
                  <Typography variant="body1" fontWeight="medium" gutterBottom>
                    {selectedSpecies.thai_name || '-'}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ชื่อท้องถิ่น
                  </Typography>
                  <Typography variant="body1" fontWeight="medium" gutterBottom>
                    {selectedSpecies.local_name || '-'}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ชื่อวิทยาศาสตร์
                  </Typography>
                  <Typography variant="body1" fontWeight="medium" fontStyle="italic" gutterBottom>
                    {selectedSpecies.scientific_name || '-'}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    กลุ่มปลา
                  </Typography>
                  <Typography variant="body1" fontWeight="medium" gutterBottom>
                    {selectedSpecies.group || '-'}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    สถานะ IUCN
                  </Typography>
                  <Chip
                    label={selectedSpecies.iucn_status || '-'}
                    size="small"
                    color={getIUCNColor(selectedSpecies.iucn_status)}
                  />
                </Grid>

                {/* คำอธิบาย */}
                {selectedSpecies.description && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      คำอธิบาย
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedSpecies.description}
                    </Typography>
                  </Grid>
                )}

                {/* ข้อมูลเพิ่มเติม */}
                {selectedSpecies.habitat && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      แหล่งที่อยู่อาศัย
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedSpecies.habitat}
                    </Typography>
                  </Grid>
                )}

                {selectedSpecies.distribution && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      การกระจายพันธุ์
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedSpecies.distribution}
                    </Typography>
                  </Grid>
                )}

                {/* แกลเลอรี่รูปภาพ */}
                {selectedSpecies.photos && selectedSpecies.photos.length > 1 && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                      รูปภาพทั้งหมด ({selectedSpecies.photos.length} รูป)
                    </Typography>
                    <Grid container spacing={2}>
                      {selectedSpecies.photos.map((photo, index) => (
                        <Grid item xs={6} sm={4} md={3} key={index}>
                          <Box
                            sx={{
                              width: '100%',
                              height: 120,
                              position: 'relative',
                              borderRadius: 2,
                              overflow: 'hidden',
                              bgcolor: 'grey.100',
                              border: '2px solid',
                              borderColor: 'divider',
                              cursor: 'pointer',
                              transition: 'transform 0.2s, box-shadow 0.2s',
                              '&:hover': {
                                transform: 'scale(1.05)',
                                boxShadow: 3
                              }
                            }}
                            onClick={() => window.open(photo, '_blank')}
                          >
                            <img
                              src={photo}
                              alt={`${selectedSpecies.thai_name} - รูปที่ ${index + 1}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                )}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDetail}>ปิด</Button>
            {canEdit && (
              <Button
                variant="contained"
                startIcon={<Edit />}
                onClick={() => {
                  handleCloseDetail();
                  router.push(`/fish-species/${selectedSpecies.id}/edit`);
                }}
              >
                แก้ไข
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog
          open={editDialogOpen}
          onClose={handleCloseEdit}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight="bold">
              แก้ไขข้อมูลปลา
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ชื่อไทย"
                  value={editFormData.thai_name}
                  onChange={(e) => handleEditFormChange('thai_name', e.target.value)}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ชื่อท้องถิ่น"
                  value={editFormData.local_name}
                  onChange={(e) => handleEditFormChange('local_name', e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="ชื่อวิทยาศาสตร์"
                  value={editFormData.scientific_name}
                  onChange={(e) => handleEditFormChange('scientific_name', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="กลุ่มปลา"
                  value={editFormData.group}
                  onChange={(e) => handleEditFormChange('group', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={8}>
                <FormControl fullWidth sx={{ minWidth: 150 }}>
                  <InputLabel>สถานะ IUCN</InputLabel>
                  <Select
                    value={editFormData.iucn_status}
                    label="สถานะ IUCN"
                    onChange={(e) => handleEditFormChange('iucn_status', e.target.value)}
                  >
                    <MenuItem value="CR">CR - Critically Endangered</MenuItem>
                    <MenuItem value="EN">EN - Endangered</MenuItem>
                    <MenuItem value="VU">VU - Vulnerable</MenuItem>
                    <MenuItem value="NT">NT - Near Threatened</MenuItem>
                    <MenuItem value="LC">LC - Least Concern</MenuItem>
                    <MenuItem value="DD">DD - Data Deficient</MenuItem>
                    <MenuItem value="NE">NE - Not Evaluated</MenuItem>
                    <MenuItem value="Alien (Africa)">Alien (Africa)</MenuItem>
                    <MenuItem value="Alien (North America)">Alien (North America)</MenuItem>
                    <MenuItem value="Alien (South America)">Alien (South America)</MenuItem>
                    <MenuItem value="Alien (Central America)">Alien (Central America)</MenuItem>
                    <MenuItem value="Alien (West Africa)">Alien (West Africa)</MenuItem>
                    <MenuItem value="Alien (Coastal)">Alien (Coastal)</MenuItem>
                    <MenuItem value="Alien (China)">Alien (China)</MenuItem>
                    <MenuItem value="Alien (Asia)">Alien (Asia)</MenuItem>
                    <MenuItem value="-">-</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="คำอธิบาย"
                  value={editFormData.description}
                  onChange={(e) => handleEditFormChange('description', e.target.value)}
                  multiline
                  rows={3}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="แหล่งที่อยู่อาศัย"
                  value={editFormData.habitat}
                  onChange={(e) => handleEditFormChange('habitat', e.target.value)}
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="การกระจายพันธุ์"
                  value={editFormData.distribution}
                  onChange={(e) => handleEditFormChange('distribution', e.target.value)}
                  multiline
                  rows={2}
                />
              </Grid>

              {/* Image Upload Section */}
              <Grid item xs={12}>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    รูปภาพปลา
                  </Typography>

                  {/* Existing Photos */}
                  {selectedSpecies?.photos && selectedSpecies.photos.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        รูปภาพปัจจุบัน ({selectedSpecies.photos.length} รูป)
                      </Typography>
                      <Grid container spacing={1} sx={{ mt: 1 }}>
                        {selectedSpecies.photos.map((photo, index) => (
                          <Grid item xs={4} sm={3} md={2} key={index}>
                            <Box
                              sx={{
                                width: '100%',
                                height: 80,
                                position: 'relative',
                                borderRadius: 1,
                                overflow: 'hidden',
                                bgcolor: 'grey.100',
                                border: '2px solid',
                                borderColor: 'divider'
                              }}
                            >
                              <img
                                src={photo}
                                alt={`ปัจจุบัน ${index + 1}`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                              />
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}

                  {/* Upload Button */}
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={uploadingImage ? <CircularProgress size={20} /> : <Upload />}
                    disabled={uploadingImage || saving}
                    sx={{ mb: 2 }}
                  >
                    {uploadingImage ? 'กำลังประมวลผล...' : 'เลือกรูปภาพเพิ่มเติม'}
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                    />
                  </Button>

                  {/* New Image Previews */}
                  {imagePreviews.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        รูปภาพที่เลือก ({imagePreviews.length} รูป) - จะอัปโหลดเมื่อกดบันทึก
                      </Typography>
                      <Grid container spacing={1} sx={{ mt: 1 }}>
                        {imagePreviews.map((preview, index) => (
                          <Grid item xs={4} sm={3} md={2} key={index}>
                            <Box sx={{ position: 'relative' }}>
                              <Box
                                sx={{
                                  width: '100%',
                                  height: 80,
                                  position: 'relative',
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  bgcolor: 'grey.100',
                                  border: '2px solid',
                                  borderColor: 'primary.main'
                                }}
                              >
                                <img
                                  src={preview}
                                  alt={`ใหม่ ${index + 1}`}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                  }}
                                />
                              </Box>
                              <IconButton
                                size="small"
                                sx={{
                                  position: 'absolute',
                                  top: -8,
                                  right: -8,
                                  bgcolor: 'error.main',
                                  color: 'white',
                                  width: 24,
                                  height: 24,
                                  '&:hover': {
                                    bgcolor: 'error.dark'
                                  }
                                }}
                                onClick={() => handleRemoveImage(index)}
                              >
                                <Delete sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}

                  {/* Info Text */}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    * รูปภาพจะถูกปรับขนาดและบีบอัดอัตโนมัติเพื่อให้มีคุณภาพที่ดีและขนาดไฟล์ที่เหมาะสม
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEdit} disabled={saving}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSaveEdit}
              variant="contained"
              disabled={saving || !editFormData.thai_name}
              startIcon={saving ? <CircularProgress size={20} /> : null}
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}

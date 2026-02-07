'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Alert,
  Box,
  Grid,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Avatar,
  TablePagination,
  Autocomplete,
  Menu,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Agriculture,
  Visibility,
  Edit,
  Delete,
  Search,
  FilterList,
  Download,
  Schedule,
  Scale,
  PhotoCamera,
  Print,
  TableChart,
  Description
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { FISH_CATEGORIES, WATER_SOURCES, FISHING_METHODS, USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage, auth } from '@/lib/firebase';
import { collection, getDocs, query, orderBy as firestoreOrderBy, doc, updateDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const getWaterSourceLabel = (source) => {
  switch (source) {
    case WATER_SOURCES.MAIN_RIVER: return 'แม่น้ำหลัก';
    case WATER_SOURCES.TRIBUTARY: return 'ลำน้ำสาขา';
    case WATER_SOURCES.POND: return 'บึง/หนอง';
    case WATER_SOURCES.LAKE: return 'ทะเลสาบ';
    default: return source;
  }
};

const getMethodLabel = (method) => {
  switch (method) {
    case FISHING_METHODS.NET: return 'อวน';
    case FISHING_METHODS.HOOK: return 'เบ็ด';
    case FISHING_METHODS.TRAP: return 'กับดัก';
    case FISHING_METHODS.SPEAR: return 'หอก';
    case FISHING_METHODS.OTHER: return 'อื่นๆ';
    default: return method;
  }
};

const getCategoryLabel = (category) => {
  switch (category) {
    case FISH_CATEGORIES.SMALL: return 'เล็ก';
    case FISH_CATEGORIES.MEDIUM: return 'กลาง';
    case FISH_CATEGORIES.LARGE: return 'ใหญ่';
    default: return category;
  }
};

const getCategoryColor = (category) => {
  switch (category) {
    case FISH_CATEGORIES.SMALL: return 'info';
    case FISH_CATEGORIES.MEDIUM: return 'warning';
    case FISH_CATEGORIES.LARGE: return 'success';
    default: return 'default';
  }
};

const formatDateTime = (date) => {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

const getRoleDisplayName = (role) => {
  const roleMap = {
    'admin': 'ผู้ดูแลระบบ',
    'researcher': 'นักวิจัย',
    'government': 'หน่วยงานรัฐ',
    'community_manager': 'ผู้จัดการชุมชน',
    'fisher': 'ชาวประมง'
  };
  return roleMap[role] || role || '-';
};

const FishingRecordsPage = () => {
  const { hasAnyRole } = useAuth();
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalWeight: 0,
    totalValue: 0,
    verifiedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [openImageDialog, setOpenImageDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    verified: false,
    notes: '',
    weather: '',
    waterLevel: '',
    totalWeight: 0,
    totalValue: 0,
    method: '',
    catchDate: '',
    catchDay: '',
    catchMonth: '',
    catchYear: '',
    location: {
      province: '',
      district: '',
      subDistrict: '',
      waterSource: ''
    },
    fishData: []
  });
  const [fishSpeciesList, setFishSpeciesList] = useState([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [openPrintDialog, setOpenPrintDialog] = useState(false);
  const [uploadingImages, setUploadingImages] = useState({});

  // Check permissions
  const canViewRecords = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT]);
  const canManageRecords = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  // Fetch records from API
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({
        limit: '100', // Fetch more for client-side filtering
        ...(provinceFilter !== 'all' && { province: provinceFilter }),
        ...(verifiedFilter !== 'all' && { verified: verifiedFilter }),
        ...(dateFilter !== 'all' && { dateFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      console.log('Fetching records with cache buster:', Date.now());
      const response = await fetch(`/api/fishing-records?${params}&_t=${Date.now()}`);
      const result = await response.json();

      console.log('Fetched records count:', result.data?.length);
      if (result.data && result.data.length > 0) {
        console.log('First record catchDate:', result.data[0].catchDate);
        console.log('First record ID:', result.data[0].id);
        console.log('First record fisherName:', result.data[0].fisherName);
        console.log('First record fishList:', result.data[0].fishList);
        console.log('First record fishData:', result.data[0].fishData);
      }

      if (result.success) {
        setRecords(result.data || []);
        setStats(result.stats || {
          totalRecords: 0,
          totalWeight: 0,
          totalValue: 0,
          verifiedCount: 0
        });
      } else {
        // No data in Firestore
        console.warn('No records from API');
        setRecords([]);
        setStats({
          totalRecords: 0,
          totalWeight: 0,
          totalValue: 0,
          verifiedCount: 0
        });
        setError('ไม่พบข้อมูลการจับปลา');
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      setRecords([]);
      setStats({
        totalRecords: 0,
        totalWeight: 0,
        totalValue: 0,
        verifiedCount: 0
      });
    } finally {
      setLoading(false);
    }
  }, [provinceFilter, verifiedFilter, dateFilter, searchTerm]);

  useEffect(() => {
    if (canViewRecords) {
      fetchRecords();
    }
  }, [canViewRecords, fetchRecords]);

  // Fetch fish species list
  useEffect(() => {
    const loadFishSpecies = async () => {
      try {
        setLoadingSpecies(true);
        const q = query(
          collection(db, 'fish_species'),
          firestoreOrderBy('thai_name', 'asc')
        );
        const snapshot = await getDocs(q);
        const speciesData = snapshot.docs.map(doc => ({
          id: doc.id,
          thai_name: doc.data().thai_name,
          scientific_name: doc.data().scientific_name
        }));
        setFishSpeciesList(speciesData);
      } catch (error) {
        console.error('Error loading fish species:', error);
      } finally {
        setLoadingSpecies(false);
      }
    };

    loadFishSpecies();
  }, []);

  // Records are already filtered by API, just use them directly
  const filteredRecords = records;

  const handleViewRecord = (record) => {
    setSelectedRecord(record);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedRecord(null);
  };

  const handleOpenDeleteDialog = (record) => {
    setDeletingRecord(record);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setDeletingRecord(null);
  };

  const handleOpenImageDialog = (imageUrl) => {
    setSelectedImage(imageUrl);
    setOpenImageDialog(true);
  };

  const handleCloseImageDialog = () => {
    setOpenImageDialog(false);
    setSelectedImage(null);
  };

  const handleOpenEditDialog = (record) => {
    setEditingRecord(record);

    // Extract day, month, year from catchDate
    let day = '';
    let month = '';
    let year = '';
    if (record.catchDate) {
      const date = typeof record.catchDate === 'string' ? new Date(record.catchDate) : record.catchDate;
      if (date && !isNaN(date.getTime())) {
        day = String(date.getDate());
        month = String(date.getMonth() + 1);
        year = String(date.getFullYear() + 543); // Convert to Buddhist year
      }
    }

    setEditFormData({
      verified: record.verified || false,
      notes: record.notes || '',
      weather: record.weather || '',
      waterLevel: record.waterLevel || '',
      totalWeight: record.totalWeight || 0,
      totalValue: record.totalValue || 0,
      method: record.method || '',
      catchDate: record.catchDate,
      catchDay: day,
      catchMonth: month,
      catchYear: year,
      location: {
        province: record.location?.province || '',
        district: record.location?.district || '',
        subDistrict: record.location?.subDistrict || '',
        waterSource: record.location?.waterSource || ''
      },
      fishData: record.fishData ? [...record.fishData] : []
    });
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setEditingRecord(null);
    setEditFormData({
      verified: false,
      notes: '',
      weather: '',
      waterLevel: '',
      totalWeight: 0,
      totalValue: 0,
      method: '',
      catchDate: '',
      catchDay: '',
      catchMonth: '',
      catchYear: '',
      location: {
        province: '',
        district: '',
        subDistrict: '',
        waterSource: ''
      }
    });
  };

  const handleEditFormChange = (field, value) => {
    console.log('handleEditFormChange:', field, '=', value);
    if (field.startsWith('location.')) {
      const locationField = field.split('.')[1];
      setEditFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [locationField]: value
        }
      }));
    } else {
      setEditFormData(prev => {
        const newData = {
          ...prev,
          [field]: value
        };
        console.log('Updated editFormData:', newData);
        return newData;
      });
    }
  };

  const handleFishDataChange = (index, field, value) => {
    setEditFormData(prev => {
      const updatedFishData = [...prev.fishData];
      updatedFishData[index] = {
        ...updatedFishData[index],
        [field]: value
      };
      return {
        ...prev,
        fishData: updatedFishData
      };
    });
  };

  const handleImageUpload = async (index, file) => {
    if (!file || !editingRecord) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }

    setUploadingImages(prev => ({ ...prev, [index]: true }));

    try {
      // Debug: Check authentication
      console.log('Current auth state:', auth.currentUser);
      console.log('User UID:', auth.currentUser?.uid);

      if (!auth.currentUser) {
        throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
      }

      // Create unique filename
      const timestamp = Date.now();
      const fileName = `fish_${index}_${timestamp}.${file.name.split('.').pop()}`;
      // Use correct path format: fishing-records/{recordId}/{fileName}
      const storagePath = `fishing-records/${editingRecord.id}/${fileName}`;
      console.log('Uploading to path:', storagePath);

      const storageRef = ref(storage, storagePath);

      // Upload file
      console.log('Starting upload...');
      await uploadBytes(storageRef, file);
      console.log('Upload successful');

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Download URL:', downloadURL);

      // Update fish data with new photo URL
      handleFishDataChange(index, 'photo', downloadURL);

      alert('อัปโหลดรูปภาพสำเร็จ');
    } catch (error) {
      console.error('Error uploading image:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ' + error.message);
    } finally {
      setUploadingImages(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleSaveEdit = async () => {
    console.log('=== handleSaveEdit called ===');
    console.log('editFormData:', editFormData);

    if (!editingRecord) {
      console.log('No editing record, returning');
      return;
    }

    setEditLoading(true);

    try {
      // Prepare fishList data for mobile app format
      const fishList = editFormData.fishData.map(fish => ({
        name: fish.species,
        count: fish.quantity,
        weight: fish.weight,
        price: fish.estimatedValue / fish.quantity || 0,
        photo: fish.photo || null,
        minLength: fish.minLength,
        maxLength: fish.maxLength
      }));

      // Prepare update data
      const updateData = {
        fishList: fishList, // For mobile app compatibility
        fishData: editFormData.fishData, // For dashboard
        updatedAt: Timestamp.now()
      };

      console.log('catchDay:', editFormData.catchDay);
      console.log('catchMonth:', editFormData.catchMonth);
      console.log('catchYear:', editFormData.catchYear);

      // Update catchDate if day, month, year were changed
      if (editFormData.catchDay && editFormData.catchMonth && editFormData.catchYear) {
        console.log('=== Building new catchDate ===');
        // Get original time from existing catchDate
        const originalDate = typeof editingRecord.catchDate === 'string'
          ? new Date(editingRecord.catchDate)
          : editingRecord.catchDate;

        // Get local hours, minutes, seconds to preserve exact time
        const hours = originalDate.getHours();
        const minutes = originalDate.getMinutes();
        const seconds = originalDate.getSeconds();
        const milliseconds = originalDate.getMilliseconds();

        // Convert Buddhist year to Gregorian year
        const gregorianYear = parseInt(editFormData.catchYear) - 543;
        const month = parseInt(editFormData.catchMonth) - 1;
        const day = parseInt(editFormData.catchDay);

        // Create new date with updated day/month/year but keep original time in local timezone
        const newDate = new Date(
          gregorianYear,
          month,
          day,
          hours,
          minutes,
          seconds,
          milliseconds
        );

        console.log('Original date:', originalDate.toISOString());
        console.log('New date:', newDate.toISOString());
        console.log('Day:', day, 'Month:', month + 1, 'Year:', gregorianYear);
        console.log('Time preserved:', hours, ':', minutes, ':', seconds);

        updateData.catchDate = Timestamp.fromDate(newDate);
        updateData.date = Timestamp.fromDate(newDate); // Also update 'date' field for mobile app compatibility
      }

      // Update using Client SDK directly
      const docRef = doc(db, 'fishingRecords', editingRecord.id);
      await updateDoc(docRef, updateData);

      console.log('Update successful!');
      console.log('Updated data:', updateData);
      console.log('fishList:', updateData.fishList);
      console.log('fishData:', updateData.fishData);

      // Wait a bit for Firestore to sync
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh records list
      await fetchRecords();
      console.log('Records refreshed!');
      handleCloseEditDialog();
      alert('อัพเดทข้อมูลสำเร็จ');
    } catch (error) {
      console.error('Error updating record:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดทข้อมูล');
    } finally {
      setEditLoading(false);
    }
  };

  // Export functions
  const handleExportMenuOpen = (event) => {
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportMenuClose = () => {
    setExportMenuAnchor(null);
  };

  const handleExportCSV = () => {
    const sortedRecords = [...filteredRecords].sort((a, b) =>
      (a.fisherName || '').localeCompare(b.fisherName || '', 'th')
    );

    // CSV headers
    const headers = [
      'ลำดับ',
      'ชื่อชาวประมง',
      'วันที่จับ',
      'จังหวัด',
      'แหล่งน้ำ',
      'น้ำหนักรวม (กก.)',
      'มูลค่ารวม (บาท)',
      'ผู้บันทึก',
      'สถานะ'
    ];

    // CSV rows
    const rows = sortedRecords.map((record, index) => {
      const catchDate = typeof record.catchDate === 'string'
        ? new Date(record.catchDate)
        : record.catchDate;

      return [
        index + 1,
        record.fisherName || '-',
        formatDateTime(catchDate),
        record.location?.province || '-',
        record.location?.waterSource || '-',
        record.totalWeight || 0,
        record.totalValue || 0,
        record.recordedBy?.name || '-',
        record.verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `รายงานการจับปลา_${new Date().toLocaleDateString('th-TH')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    handleExportMenuClose();
  };

  const handleOpenPrintView = () => {
    setOpenPrintDialog(true);
    handleExportMenuClose();
  };

  const handleClosePrintView = () => {
    setOpenPrintDialog(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;

    setDeleteLoading(true);

    try {
      // Get document data first to find associated images
      const docRef = doc(db, 'fishingRecords', deletingRecord.id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        alert('ไม่พบข้อมูลที่ต้องการลบ');
        return;
      }

      const data = docSnap.data();

      // Delete associated images from Storage
      if (data.fishList && Array.isArray(data.fishList)) {
        for (const fish of data.fishList) {
          if (fish.photo) {
            try {
              // Check if it's a Firebase Storage URL
              if (fish.photo.startsWith('gs://') || fish.photo.includes('firebasestorage.googleapis.com')) {
                let storagePath;

                if (fish.photo.startsWith('gs://')) {
                  // Extract path from gs:// URL
                  storagePath = fish.photo.replace(/^gs:\/\/[^/]+\//, '');
                } else if (fish.photo.includes('firebasestorage.googleapis.com')) {
                  // Extract path from HTTPS URL
                  const urlParts = fish.photo.split('/o/');
                  if (urlParts.length > 1) {
                    storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
                  }
                }

                if (storagePath) {
                  const imageRef = ref(storage, storagePath);
                  await deleteObject(imageRef);
                  console.log('✓ Deleted image:', storagePath);
                }
              }
            } catch (imageError) {
              // Log error but continue (image might already be deleted or not exist)
              console.warn('Failed to delete image:', fish.photo, imageError.message);
            }
          }
        }
      }

      // Delete document from Firestore
      await deleteDoc(docRef);

      // Refresh records list
      fetchRecords();
      handleCloseDeleteDialog();
      alert('ลบรายการการจับปลาสำเร็จ');
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleVerification = async () => {
    if (!selectedRecord) return;

    const newVerifiedStatus = !selectedRecord.verified;

    try {
      const response = await fetch(`/api/fishing-records/${selectedRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verified: newVerifiedStatus
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh records list
        fetchRecords();
        // Update selected record
        setSelectedRecord(prev => ({
          ...prev,
          verified: newVerifiedStatus
        }));
        alert(newVerifiedStatus ? 'ยืนยันข้อมูลสำเร็จ' : 'ยกเลิกการยืนยันสำเร็จ');
      } else {
        alert('เกิดข้อผิดพลาด: ' + (result.error || 'ไม่สามารถอัพเดทสถานะได้'));
      }
    } catch (error) {
      console.error('Error toggling verification:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดทสถานะ');
    }
  };

  const handleChangePage = (_event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (!canViewRecords) {
    return (
      <DashboardLayout>
        <Alert severity="error">
          คุณไม่มีสิทธิ์เข้าถึงข้อมูลการจับปลา
        </Alert>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Typography>กำลังโหลดข้อมูลการจับปลา...</Typography>
      </DashboardLayout>
    );
  }

  const paginatedRecords = filteredRecords.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <DashboardLayout>
      <Box>
        {/* Header */}
        <Box mb={3}>
          <Typography variant="h4" gutterBottom>
            รายการการจับปลา
          </Typography>
          <Typography variant="body1" color="text.secondary">
            ข้อมูลการจับปลาจากแอพพลิเคชั่นมือถือของชาวประมง
          </Typography>
          {error && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Agriculture />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.totalRecords}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      รายการทั้งหมด
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
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <Scale />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.totalWeight.toFixed(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      น้ำหนักรวม (กก.)
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
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <Schedule />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.verifiedCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ยืนยันแล้ว
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="ค้นหา"
                  placeholder="ชื่อชาวประมง, ชนิดปลา, จังหวัด"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>ช่วงเวลา</InputLabel>
                  <Select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    label="ช่วงเวลา"
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    <MenuItem value="today">วันนี้</MenuItem>
                    <MenuItem value="week">7 วันที่แล้ว</MenuItem>
                    <MenuItem value="month">30 วันที่แล้ว</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>จังหวัด</InputLabel>
                  <Select
                    value={provinceFilter}
                    onChange={(e) => setProvinceFilter(e.target.value)}
                    label="จังหวัด"
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    <MenuItem value="นครพนม">นครพนม</MenuItem>
                    <MenuItem value="อุบลราชธานี">อุบลราชธานี</MenuItem>
                    <MenuItem value="มุกดาหาร">มุกดาหาร</MenuItem>
                    <MenuItem value="บึงกาฬ">บึงกาฬ</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>สถานะ</InputLabel>
                  <Select
                    value={verifiedFilter}
                    onChange={(e) => setVerifiedFilter(e.target.value)}
                    label="สถานะ"
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    <MenuItem value="verified">ยืนยันแล้ว</MenuItem>
                    <MenuItem value="unverified">รอยืนยัน</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    startIcon={<FilterList />}
                    size="small"
                    fullWidth
                  >
                    ตัวกรองเพิ่มเติม
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    size="small"
                    fullWidth
                    onClick={handleExportMenuOpen}
                  >
                    ส่งออก
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Records Table */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ลำดับ</TableCell>
                    <TableCell>ชาวประมง</TableCell>
                    <TableCell>วันที่จับ</TableCell>
                    <TableCell>สถานที่</TableCell>
                    <TableCell>น้ำหนัก (กก.)</TableCell>
                    <TableCell>ผู้บันทึก</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell align="center">จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedRecords.map((record, index) => (
                    <TableRow key={record.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {page * rowsPerPage + index + 1}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {record.fisherName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {record.fisherVillage || '-'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">
                            {formatDate(typeof record.catchDate === 'string' ? new Date(record.catchDate) : record.catchDate)}
                          </Typography>
                          {/* Fish Images */}
                          {(() => {
                            // Support both fishList and fishData
                            const fishImages = [];

                            // Debug log
                            if (index === 0) {
                              console.log('Record fishList:', record.fishList);
                              console.log('Record fishData:', record.fishData);
                            }

                            // Check fishList first (from mobile app)
                            if (record.fishList && Array.isArray(record.fishList)) {
                              record.fishList.forEach(fish => {
                                if (fish.photo) fishImages.push(fish.photo);
                              });
                            }

                            // Check fishData (from dashboard)
                            if (fishImages.length === 0 && record.fishData && Array.isArray(record.fishData)) {
                              record.fishData.forEach(fish => {
                                if (fish.photo) fishImages.push(fish.photo);
                              });
                            }

                            // Debug log
                            if (index === 0) {
                              console.log('Fish images found:', fishImages.length);
                              console.log('First image:', fishImages[0]);
                            }

                            if (fishImages.length === 0) return null;

                            return (
                              <Box display="flex" gap={0.5}>
                                {fishImages.slice(0, 3).map((photo, fishIndex) => (
                                  <Avatar
                                    key={fishIndex}
                                    src={photo}
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => handleOpenImageDialog(photo)}
                                  />
                                ))}
                                {fishImages.length > 3 && (
                                  <Avatar
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      bgcolor: 'grey.300',
                                      fontSize: '0.7rem',
                                      color: 'text.secondary'
                                    }}
                                  >
                                    +{fishImages.length - 3}
                                  </Avatar>
                                )}
                              </Box>
                            );
                          })()}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {record.location?.province || record.location?.spotName || 'ไม่ระบุ'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {record.location?.waterSource || '-'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {record.totalWeight} กก.
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            sx={{
                              color: record.recordedBy?.role === 'researcher' ? 'primary.main' : 'text.primary'
                            }}
                          >
                            {record.recordedBy?.name || 'ไม่ระบุ'}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: record.recordedBy?.role === 'researcher' ? 'primary.main' : 'text.secondary',
                              fontWeight: record.recordedBy?.role === 'researcher' ? 'medium' : 'normal'
                            }}
                          >
                            {getRoleDisplayName(record.recordedBy?.role)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={record.verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
                          color={record.verified ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleViewRecord(record)}
                          title="ดูรายละเอียด"
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                        {canManageRecords && (
                          <>
                            <IconButton
                              size="small"
                              title="แก้ไข"
                              onClick={() => handleOpenEditDialog(record)}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              title="ลบ"
                              onClick={() => handleOpenDeleteDialog(record)}
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
            <TablePagination
              component="div"
              count={filteredRecords.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="แถวต่อหน้า:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
            />
          </CardContent>
        </Card>

        {/* Record Detail Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            รายละเอียดการจับปลา - {selectedRecord?.id}
          </DialogTitle>
          <DialogContent>
            {selectedRecord && (
              <Box>
                {/* Fisher Profile Photo */}
                {selectedRecord.fisherProfile?.profilePhoto && (
                  <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
                    <Box
                      component="img"
                      src={selectedRecord.fisherProfile.profilePhoto}
                      alt={selectedRecord.fisherName}
                      onClick={() => handleOpenImageDialog(selectedRecord.fisherProfile.profilePhoto)}
                      sx={{
                        width: 150,
                        height: 150,
                        objectFit: 'cover',
                        borderRadius: '50%',
                        border: '3px solid',
                        borderColor: 'primary.main',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          boxShadow: 4
                        }
                      }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                      }}
                    />
                  </Box>
                )}

                {/* Fisher Info */}
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  ข้อมูลชาวประมง
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>ชื่อ:</strong> {selectedRecord.fisherName}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Catch Info */}
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  ข้อมูลการจับปลา
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>วันที่จับ:</strong> {formatDateTime(typeof selectedRecord.catchDate === 'string' ? new Date(selectedRecord.catchDate) : selectedRecord.catchDate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>สภาพอากาศ:</strong> {selectedRecord.weather}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>วิธีการ:</strong> {getMethodLabel(selectedRecord.method)}
                    </Typography>
                  </Grid>
                  {selectedRecord.fishingGear?.details && (
                    <Grid item xs={12}>
                      <Typography variant="body2">
                        <strong>รายละเอียดเครื่องมือ:</strong>{' '}
                        {typeof selectedRecord.fishingGear.details === 'object'
                          ? Object.entries(selectedRecord.fishingGear.details)
                              .filter(([_, value]) => value)
                              .map(([key, value]) => {
                                const labels = {
                                  quantity: 'จำนวน',
                                  length: 'ความยาว',
                                  custom: 'รายละเอียด',
                                  meshSize: 'ขนาดตา',
                                  size: 'ขนาด',
                                  depth: 'ความลึก'
                                };
                                return `${labels[key] || key}: ${value}`;
                              })
                              .join(', ')
                          : selectedRecord.fishingGear.details
                        }
                      </Typography>
                    </Grid>
                  )}
                </Grid>

                {/* Location */}
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  สถานที่
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>ตำแหน่งการจับปลา:</strong> {selectedRecord.location.province}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>แหล่งน้ำ:</strong> {getWaterSourceLabel(selectedRecord.location.waterSource)}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Fish Data */}
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  ข้อมูลปลาที่จับได้
                </Typography>
                {selectedRecord.fishData.map((fish, index) => (
                  <Card key={index} sx={{ mb: 1 }}>
                    <CardContent sx={{ py: 1 }}>
                      <Grid container spacing={2} alignItems="center">
                        {/* Fish Image */}
                        {fish.photo && (
                          <Grid item xs={12} sm={2}>
                            <Box
                              component="img"
                              src={fish.photo}
                              alt={fish.species}
                              onClick={() => handleOpenImageDialog(fish.photo)}
                              sx={{
                                width: '100%',
                                height: 80,
                                objectFit: 'cover',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                cursor: 'pointer',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                '&:hover': {
                                  transform: 'scale(1.05)',
                                  boxShadow: 2
                                }
                              }}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </Grid>
                        )}
                        <Grid item xs={12} sm={fish.photo ? 2.5 : 3}>
                          <Typography variant="body2">
                            <strong>{fish.species}</strong>
                          </Typography>
                        </Grid>
                        <Grid item xs={4} sm={fish.photo ? 2.5 : 3}>
                          <Typography variant="body2">
                            จำนวน: {fish.quantity} ตัว
                          </Typography>
                        </Grid>
                        <Grid item xs={4} sm={fish.photo ? 2.5 : 3}>
                          <Typography variant="body2">
                            น้ำหนัก: {fish.weight} กก.
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}

                {/* Summary */}
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  สรุป
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>น้ำหนักรวม:</strong> {selectedRecord.totalWeight} กก.
                    </Typography>
                  </Grid>
                </Grid>

                {/* Images */}
                {selectedRecord.images && selectedRecord.images.length > 0 && (
                  <>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                      รูปภาพ
                    </Typography>
                    <Box display="flex" gap={1}>
                      {selectedRecord.images.map((image, index) => (
                        <Chip
                          key={index}
                          icon={<PhotoCamera />}
                          label={image}
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </Box>
                  </>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>ปิด</Button>
            {canManageRecords && (
              <Button
                variant="contained"
                onClick={handleToggleVerification}
                color={selectedRecord?.verified ? 'warning' : 'primary'}
              >
                {selectedRecord?.verified ? 'ยกเลิกยืนยัน' : 'ยืนยันข้อมูล'}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Development Notice */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>หมายเหตุ:</strong> ระบบเชื่อมต่อกับ Firebase Firestore แล้ว
            {records.length === 0 ?
              ' ยังไม่มีข้อมูลในฐานข้อมูล กำลังแสดงข้อมูลตัวอย่าง' :
              ' กำลังแสดงข้อมูลจาก Firestore'}
          </Typography>
        </Alert>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={openDeleteDialog}
          onClose={handleCloseDeleteDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>ยืนยันการลบ</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              คุณกำลังจะลบรายการการจับปลานี้ การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </Alert>
            {deletingRecord && (
              <Box>
                <Typography variant="body1" gutterBottom>
                  <strong>รายละเอียดที่จะลบ:</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • ชาวประมง: {deletingRecord.fisherName || deletingRecord.fisherVillage || 'ไม่ระบุ'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • วันที่: {deletingRecord.catchDate ? new Date(deletingRecord.catchDate).toLocaleDateString('th-TH') : '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • น้ำหนักรวม: {deletingRecord.totalWeight || 0} กก.
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleCloseDeleteDialog}
              disabled={deleteLoading}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleDeleteRecord}
              color="error"
              variant="contained"
              disabled={deleteLoading}
            >
              {deleteLoading ? 'กำลังลบ...' : 'ลบ'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Record Dialog */}
        <Dialog
          open={openEditDialog}
          onClose={handleCloseEditDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>แก้ไขข้อมูลปลาที่จับได้</DialogTitle>
          <DialogContent>
            {editingRecord && (
              <Box sx={{ pt: 2 }}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  กำลังแก้ไขข้อมูลของ: <strong>{editingRecord.fisherName}</strong>
                </Alert>

                {/* Date Field */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    วันที่จับปลา
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>วัน</InputLabel>
                        <Select
                          value={editFormData.catchDay}
                          label="วัน"
                          onChange={(e) => handleEditFormChange('catchDay', e.target.value)}
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <MenuItem key={day} value={String(day)}>{day}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>เดือน</InputLabel>
                        <Select
                          value={editFormData.catchMonth}
                          label="เดือน"
                          onChange={(e) => handleEditFormChange('catchMonth', e.target.value)}
                        >
                          <MenuItem value="1">มกราคม</MenuItem>
                          <MenuItem value="2">กุมภาพันธ์</MenuItem>
                          <MenuItem value="3">มีนาคม</MenuItem>
                          <MenuItem value="4">เมษายน</MenuItem>
                          <MenuItem value="5">พฤษภาคม</MenuItem>
                          <MenuItem value="6">มิถุนายน</MenuItem>
                          <MenuItem value="7">กรกฎาคม</MenuItem>
                          <MenuItem value="8">สิงหาคม</MenuItem>
                          <MenuItem value="9">กันยายน</MenuItem>
                          <MenuItem value="10">ตุลาคม</MenuItem>
                          <MenuItem value="11">พฤศจิกายน</MenuItem>
                          <MenuItem value="12">ธันวาคม</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={4}>
                      <FormControl fullWidth size="small" sx={{ minWidth: 100 }}>
                        <InputLabel>ปี (พ.ศ.)</InputLabel>
                        <Select
                          value={editFormData.catchYear}
                          label="ปี (พ.ศ.)"
                          onChange={(e) => handleEditFormChange('catchYear', e.target.value)}
                        >
                          {(() => {
                            const currentYear = new Date().getFullYear() + 543;
                            const selectedYear = parseInt(editFormData.catchYear) || currentYear;

                            // Create year range from 10 years ago to current year
                            const years = Array.from({ length: 11 }, (_, i) => currentYear - i);

                            // Add selected year if it's not in the list
                            if (selectedYear && !years.includes(selectedYear)) {
                              years.push(selectedYear);
                              years.sort((a, b) => b - a); // Sort descending
                            }

                            return years.map(year => (
                              <MenuItem key={year} value={String(year)}>{year}</MenuItem>
                            ));
                          })()}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    หมายเหตุ: เวลาจะคงเดิมไม่เปลี่ยนแปลง
                  </Typography>
                </Box>

                <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary" sx={{ mb: 2 }}>
                  ข้อมูลปลาที่จับได้
                </Typography>

                {editFormData.fishData && editFormData.fishData.length > 0 ? (
                  editFormData.fishData.map((fish, index) => (
                    <Card key={index} sx={{ mb: 2, p: 2, bgcolor: 'grey.50' }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" color="primary" fontWeight="bold">
                            ปลาลำดับที่ {index + 1}
                          </Typography>
                        </Grid>

                        {/* Fish Image Section */}
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {fish.photo ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box
                                  component="img"
                                  src={fish.photo}
                                  alt={fish.species}
                                  sx={{
                                    width: 80,
                                    height: 80,
                                    objectFit: 'cover',
                                    borderRadius: 1,
                                    border: '2px solid',
                                    borderColor: 'success.main'
                                  }}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23ddd" width="80" height="80"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E';
                                  }}
                                />
                                <Box>
                                  <Chip
                                    icon={<PhotoCamera />}
                                    label="มีรูปภาพแล้ว"
                                    color="success"
                                    size="small"
                                    sx={{ mb: 1 }}
                                  />
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    คุณสามารถอัปโหลดรูปใหม่เพื่อเปลี่ยนรูปเดิมได้
                                  </Typography>
                                </Box>
                              </Box>
                            ) : (
                              <Alert severity="warning" sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight="bold">
                                  ยังไม่มีรูปปลา
                                </Typography>
                                <Typography variant="caption">
                                  กรุณาอัปโหลดรูปภาพปลาเพื่อเพิ่มข้อมูลให้สมบูรณ์
                                </Typography>
                              </Alert>
                            )}
                          </Box>
                          <Box sx={{ mt: 2 }}>
                            <Button
                              component="label"
                              variant={fish.photo ? "outlined" : "contained"}
                              color={fish.photo ? "primary" : "warning"}
                              startIcon={uploadingImages[index] ? <CircularProgress size={16} color="inherit" /> : <PhotoCamera />}
                              disabled={uploadingImages[index]}
                              size="small"
                            >
                              {uploadingImages[index]
                                ? 'กำลังอัปโหลด...'
                                : fish.photo
                                  ? 'เปลี่ยนรูปภาพ'
                                  : 'อัปโหลดรูปภาพ'
                              }
                              <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleImageUpload(index, file);
                                  }
                                  // Reset input to allow uploading same file again
                                  e.target.value = '';
                                }}
                              />
                            </Button>
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                              รองรับไฟล์: JPG, PNG, GIF (สูงสุด 5MB)
                            </Typography>
                          </Box>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="ชื่อปลา"
                            size="small"
                            placeholder="กรอกชื่อปลา"
                            value={fish.species || ''}
                            onChange={(e) => handleFishDataChange(index, 'species', e.target.value)}
                            sx={{ minWidth: 200 }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            type="number"
                            label="จำนวน (ตัว)"
                            value={fish.quantity || 0}
                            onChange={(e) => handleFishDataChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            inputProps={{ min: 0 }}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            type="number"
                            label="น้ำหนัก (กก.)"
                            value={fish.weight || 0}
                            onChange={(e) => handleFishDataChange(index, 'weight', parseFloat(e.target.value) || 0)}
                            inputProps={{ min: 0, step: 0.01 }}
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </Card>
                  ))
                ) : (
                  <Alert severity="warning">
                    ไม่มีข้อมูลปลาที่จับได้
                  </Alert>
                )}

                <Box sx={{ mt: 3, p: 2, bgcolor: 'success.lighter', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>หมายเหตุ:</strong> คุณสามารถแก้ไขข้อมูลปลาที่จับได้ แล้วกดปุ่มบันทึกเพื่ออัพเดทข้อมูล
                  </Typography>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEditDialog} disabled={editLoading}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                console.log('===== BUTTON CLICKED =====');
                handleSaveEdit();
              }}
              variant="contained"
              color="primary"
              disabled={editLoading}
            >
              {editLoading ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Image Preview Dialog */}
        <Dialog
          open={openImageDialog}
          onClose={handleCloseImageDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            รูปภาพปลา
            <IconButton
              onClick={handleCloseImageDialog}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8
              }}
            >
              ✕
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {selectedImage && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: 300
                }}
              >
                <Box
                  component="img"
                  src={selectedImage}
                  alt="Fish preview"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                    borderRadius: 1
                  }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="18"%3EImage not available%3C/text%3E%3C/svg%3E';
                  }}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseImageDialog}>ปิด</Button>
            {selectedImage && (
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={() => window.open(selectedImage, '_blank')}
              >
                เปิดต้นฉบับ
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Export Menu */}
        <Menu
          anchorEl={exportMenuAnchor}
          open={Boolean(exportMenuAnchor)}
          onClose={handleExportMenuClose}
        >
          <MenuItem onClick={handleExportCSV}>
            <TableChart sx={{ mr: 1 }} />
            ส่งออกเป็น CSV
          </MenuItem>
          <MenuItem onClick={handleOpenPrintView}>
            <Print sx={{ mr: 1 }} />
            พิมพ์รายงาน
          </MenuItem>
        </Menu>

        {/* Print Report Dialog */}
        <Dialog
          open={openPrintDialog}
          onClose={handleClosePrintView}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            รายงานการจับปลา
            <IconButton
              onClick={handleClosePrintView}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8
              }}
              className="no-print"
            >
              ✕
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ p: 2 }}>
              {/* Print Header */}
              <Box sx={{ mb: 3, textAlign: 'center' }} className="print-only">
                <Typography variant="h5" gutterBottom>
                  รายงานข้อมูลการจับปลา
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  วันที่พิมพ์: {new Date().toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Typography>
              </Box>

              {/* Summary Stats */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        จำนวนรายการทั้งหมด
                      </Typography>
                      <Typography variant="h6">
                        {filteredRecords.length} รายการ
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        น้ำหนักรวม
                      </Typography>
                      <Typography variant="h6">
                        {filteredRecords.reduce((sum, r) => sum + (r.totalWeight || 0), 0).toFixed(1)} กก.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        มูลค่ารวม
                      </Typography>
                      <Typography variant="h6">
                        {filteredRecords.reduce((sum, r) => sum + (r.totalValue || 0), 0).toLocaleString('th-TH')} บาท
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Records Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>ลำดับ</strong></TableCell>
                      <TableCell><strong>ชื่อชาวประมง</strong></TableCell>
                      <TableCell><strong>วันที่จับ</strong></TableCell>
                      <TableCell><strong>จังหวัด</strong></TableCell>
                      <TableCell><strong>แหล่งน้ำ</strong></TableCell>
                      <TableCell align="right"><strong>น้ำหนัก (กก.)</strong></TableCell>
                      <TableCell align="right"><strong>มูลค่า (บาท)</strong></TableCell>
                      <TableCell><strong>ผู้บันทึก</strong></TableCell>
                      <TableCell><strong>สถานะ</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...filteredRecords]
                      .sort((a, b) => (a.fisherName || '').localeCompare(b.fisherName || '', 'th'))
                      .map((record, index) => {
                        const catchDate = typeof record.catchDate === 'string'
                          ? new Date(record.catchDate)
                          : record.catchDate;

                        return (
                          <TableRow key={record.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{record.fisherName || '-'}</TableCell>
                            <TableCell>
                              {catchDate ? formatDateTime(catchDate) : '-'}
                            </TableCell>
                            <TableCell>{record.location?.province || '-'}</TableCell>
                            <TableCell>{record.location?.waterSource || '-'}</TableCell>
                            <TableCell align="right">{record.totalWeight || 0}</TableCell>
                            <TableCell align="right">
                              {(record.totalValue || 0).toLocaleString('th-TH')}
                            </TableCell>
                            <TableCell>{record.recordedBy?.name || '-'}</TableCell>
                            <TableCell>
                              {record.verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </DialogContent>
          <DialogActions className="no-print">
            <Button onClick={handleClosePrintView}>ปิด</Button>
            <Button
              variant="contained"
              startIcon={<Print />}
              onClick={handlePrint}
            >
              พิมพ์
            </Button>
          </DialogActions>
        </Dialog>

        {/* Print Styles */}
        <style jsx global>{`
          @media print {
            .no-print {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
            @page {
              size: A4 landscape;
              margin: 1cm;
            }
          }
          @media screen {
            .print-only {
              display: none;
            }
          }
        `}</style>
      </Box>
    </DashboardLayout>
  );
};

export default FishingRecordsPage;
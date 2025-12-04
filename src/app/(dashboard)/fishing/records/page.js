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
  TablePagination
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
  AttachMoney,
  PhotoCamera
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { FISH_CATEGORIES, WATER_SOURCES, FISHING_METHODS, USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// Mock fishing data
const mockFishingRecords = [
  {
    id: 'FR001',
    fisherId: 'U001',
    fisherName: 'สมชาย ประมงดี',
    fisherEmail: 'fisher1@example.com',
    catchDate: new Date('2024-01-15T06:30:00'),
    location: {
      province: 'นครพนม',
      district: 'เมืองนครพนม',
      subDistrict: 'ในเมือง',
      waterSource: WATER_SOURCES.MAIN_RIVER,
      latitude: 17.4065,
      longitude: 104.7784
    },
    fishData: [
      {
        species: 'ปลาน้ำจืด',
        category: FISH_CATEGORIES.MEDIUM,
        quantity: 15,
        weight: 12.5,
        estimatedValue: 875
      },
      {
        species: 'ปลากด',
        category: FISH_CATEGORIES.SMALL,
        quantity: 8,
        weight: 3.2,
        estimatedValue: 320
      }
    ],
    method: FISHING_METHODS.NET,
    weather: 'แจ่มใส',
    waterLevel: 'ปกติ',
    totalWeight: 15.7,
    totalValue: 1195,
    notes: 'การจับปลาได้ผลดี น้ำใส ปลามาก',
    images: ['catch1.jpg', 'location1.jpg'],
    createdAt: new Date('2024-01-15T07:00:00'),
    verified: true
  },
  {
    id: 'FR002',
    fisherId: 'U002',
    fisherName: 'สมหญิง จับปลา',
    fisherEmail: 'fisher2@example.com',
    catchDate: new Date('2024-01-14T17:15:00'),
    location: {
      province: 'อุบลราชธานี',
      district: 'เมืองอุบลราชธานี',
      subDistrict: 'ในเมือง',
      waterSource: WATER_SOURCES.TRIBUTARY,
      latitude: 15.2442,
      longitude: 104.8475
    },
    fishData: [
      {
        species: 'ปลาสร้อย',
        category: FISH_CATEGORIES.LARGE,
        quantity: 3,
        weight: 8.4,
        estimatedValue: 1680
      }
    ],
    method: FISHING_METHODS.HOOK,
    weather: 'มีเมฆบาง',
    waterLevel: 'สูงกว่าปกติ',
    totalWeight: 8.4,
    totalValue: 1680,
    notes: 'จับได้ปลาขนาดใหญ่ น้ำเซาะ',
    images: ['catch2.jpg'],
    createdAt: new Date('2024-01-14T18:00:00'),
    verified: true
  },
  {
    id: 'FR003',
    fisherId: 'U003',
    fisherName: 'สมศักดิ์ ลุงแม่น้ำ',
    fisherEmail: 'fisher3@example.com',
    catchDate: new Date('2024-01-13T05:45:00'),
    location: {
      province: 'มุกดาหาร',
      district: 'เมืองมุกดาหาร',
      subDistrict: 'มุกดาหาร',
      waterSource: WATER_SOURCES.MAIN_RIVER,
      latitude: 16.5419,
      longitude: 104.7234
    },
    fishData: [
      {
        species: 'ปลาจิ้น',
        category: FISH_CATEGORIES.SMALL,
        quantity: 25,
        weight: 6.8,
        estimatedValue: 408
      },
      {
        species: 'ปลาเค้า',
        category: FISH_CATEGORIES.MEDIUM,
        quantity: 7,
        weight: 4.2,
        estimatedValue: 294
      }
    ],
    method: FISHING_METHODS.TRAP,
    weather: 'ฝนตกเล็กน้อย',
    waterLevel: 'ต่ำกว่าปกติ',
    totalWeight: 11.0,
    totalValue: 702,
    notes: 'ปลาไม่ค่อยมาก เพราะน้ำลด',
    images: ['catch3.jpg', 'trap1.jpg'],
    createdAt: new Date('2024-01-13T06:30:00'),
    verified: false
  }
];

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
    location: {
      province: '',
      district: '',
      subDistrict: '',
      waterSource: ''
    }
  });

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

      const response = await fetch(`/api/fishing-records?${params}`);
      const result = await response.json();

      if (result.success) {
        setRecords(result.data || []);
        setStats(result.stats || {
          totalRecords: 0,
          totalWeight: 0,
          totalValue: 0,
          verifiedCount: 0
        });
      } else {
        // If no data in Firestore, use mock data
        console.warn('No records from API, using mock data');
        setRecords(mockFishingRecords);
        setStats({
          totalRecords: mockFishingRecords.length,
          totalWeight: mockFishingRecords.reduce((sum, r) => sum + r.totalWeight, 0),
          totalValue: mockFishingRecords.reduce((sum, r) => sum + r.totalValue, 0),
          verifiedCount: mockFishingRecords.filter(r => r.verified).length
        });
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('ไม่สามารถโหลดข้อมูลได้ กำลังใช้ข้อมูลตัวอย่าง');
      // Fallback to mock data
      setRecords(mockFishingRecords);
      setStats({
        totalRecords: mockFishingRecords.length,
        totalWeight: mockFishingRecords.reduce((sum, r) => sum + r.totalWeight, 0),
        totalValue: mockFishingRecords.reduce((sum, r) => sum + r.totalValue, 0),
        verifiedCount: mockFishingRecords.filter(r => r.verified).length
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
    setEditFormData({
      verified: record.verified || false,
      notes: record.notes || '',
      weather: record.weather || '',
      waterLevel: record.waterLevel || '',
      totalWeight: record.totalWeight || 0,
      totalValue: record.totalValue || 0,
      method: record.method || '',
      location: {
        province: record.location?.province || '',
        district: record.location?.district || '',
        subDistrict: record.location?.subDistrict || '',
        waterSource: record.location?.waterSource || ''
      }
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
      location: {
        province: '',
        district: '',
        subDistrict: '',
        waterSource: ''
      }
    });
  };

  const handleEditFormChange = (field, value) => {
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
      setEditFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    setEditLoading(true);

    try {
      const response = await fetch(`/api/fishing-records/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh records list
        fetchRecords();
        handleCloseEditDialog();
        alert('อัพเดทข้อมูลสำเร็จ');
      } else {
        alert('เกิดข้อผิดพลาด: ' + (result.error || 'ไม่สามารถอัพเดทข้อมูลได้'));
      }
    } catch (error) {
      console.error('Error updating record:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดทข้อมูล');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;

    setDeleteLoading(true);

    try {
      const response = await fetch(`/api/fishing-records/${deletingRecord.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // Refresh records list
        fetchRecords();
        handleCloseDeleteDialog();
        alert('ลบรายการการจับปลาสำเร็จ');
      } else {
        alert('เกิดข้อผิดพลาด: ' + (result.error || 'ไม่สามารถลบข้อมูลได้'));
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    } finally {
      setDeleteLoading(false);
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
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <AttachMoney />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      ฿{stats.totalValue.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      มูลค่ารวม
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
                    <TableCell>มูลค่า (บาท)</TableCell>
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
                        <Typography variant="body2">
                          {formatDateTime(typeof record.catchDate === 'string' ? new Date(record.catchDate) : record.catchDate)}
                        </Typography>
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
                        <Typography variant="body2" fontWeight="medium">
                          ฿{record.totalValue.toLocaleString()}
                        </Typography>
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
                {/* Fisher Info */}
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  ข้อมูลชาวประมง
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>ชื่อ:</strong> {selectedRecord.fisherName}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>อีเมล:</strong> {selectedRecord.fisherEmail}
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
                      <strong>วิธีการ:</strong> {getMethodLabel(selectedRecord.method)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>สภาพอากาศ:</strong> {selectedRecord.weather}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>ระดับน้ำ:</strong> {selectedRecord.waterLevel}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Location */}
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  สถานที่
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2">
                      <strong>จังหวัด:</strong> {selectedRecord.location.province}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2">
                      <strong>อำเภอ:</strong> {selectedRecord.location.district}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2">
                      <strong>ตำบล:</strong> {selectedRecord.location.subDistrict}
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
                        <Grid item xs={4} sm={fish.photo ? 2.5 : 3}>
                          <Typography variant="body2">
                            มูลค่า: ฿{fish.estimatedValue.toLocaleString()}
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
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>น้ำหนักรวม:</strong> {selectedRecord.totalWeight} กก.
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>มูลค่ารวม:</strong> ฿{selectedRecord.totalValue.toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>หมายเหตุ:</strong> {selectedRecord.notes}
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
              <Button variant="contained">
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
                <Typography variant="body2" color="text.secondary">
                  • มูลค่ารวม: {deletingRecord.totalValue || 0} บาท
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
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>แก้ไขข้อมูลการจับปลา</DialogTitle>
          <DialogContent>
            {editingRecord && (
              <Box sx={{ pt: 2 }}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  กำลังแก้ไขข้อมูลของ: <strong>{editingRecord.fisherName}</strong>
                  <br />
                  วันที่จับ: {formatDateTime(typeof editingRecord.catchDate === 'string' ? new Date(editingRecord.catchDate) : editingRecord.catchDate)}
                </Alert>

                <Grid container spacing={2}>
                  {/* Status Section */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                      สถานะและการยืนยัน
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>สถานะการยืนยัน</InputLabel>
                      <Select
                        value={editFormData.verified}
                        onChange={(e) => handleEditFormChange('verified', e.target.value)}
                        label="สถานะการยืนยัน"
                      >
                        <MenuItem value={false}>รอยืนยัน</MenuItem>
                        <MenuItem value={true}>ยืนยันแล้ว</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Location Section */}
                  <Grid item xs={12} sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                      สถานที่
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="จังหวัด"
                      value={editFormData.location.province}
                      onChange={(e) => handleEditFormChange('location.province', e.target.value)}
                      placeholder="เช่น นครพนม"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="อำเภอ"
                      value={editFormData.location.district}
                      onChange={(e) => handleEditFormChange('location.district', e.target.value)}
                      placeholder="เช่น เมืองนครพนม"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="ตำบล"
                      value={editFormData.location.subDistrict}
                      onChange={(e) => handleEditFormChange('location.subDistrict', e.target.value)}
                      placeholder="เช่น ในเมือง"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>แหล่งน้ำ</InputLabel>
                      <Select
                        value={editFormData.location.waterSource}
                        onChange={(e) => handleEditFormChange('location.waterSource', e.target.value)}
                        label="แหล่งน้ำ"
                      >
                        <MenuItem value={WATER_SOURCES.MAIN_RIVER}>แม่น้ำหลัก</MenuItem>
                        <MenuItem value={WATER_SOURCES.TRIBUTARY}>ลำน้ำสาขา</MenuItem>
                        <MenuItem value={WATER_SOURCES.POND}>บึง/หนอง</MenuItem>
                        <MenuItem value={WATER_SOURCES.LAKE}>ทะเลสาบ</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Fishing Method Section */}
                  <Grid item xs={12} sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                      วิธีการจับปลา
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>วิธีการ</InputLabel>
                      <Select
                        value={editFormData.method}
                        onChange={(e) => handleEditFormChange('method', e.target.value)}
                        label="วิธีการ"
                      >
                        <MenuItem value={FISHING_METHODS.NET}>อวน</MenuItem>
                        <MenuItem value={FISHING_METHODS.HOOK}>เบ็ด</MenuItem>
                        <MenuItem value={FISHING_METHODS.TRAP}>กับดัก</MenuItem>
                        <MenuItem value={FISHING_METHODS.SPEAR}>หอก</MenuItem>
                        <MenuItem value={FISHING_METHODS.OTHER}>อื่นๆ</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Environmental Conditions Section */}
                  <Grid item xs={12} sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                      สภาพแวดล้อม
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="สภาพอากาศ"
                      value={editFormData.weather}
                      onChange={(e) => handleEditFormChange('weather', e.target.value)}
                      placeholder="เช่น แจ่มใส, มีเมฆบาง, ฝนตก"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="ระดับน้ำ"
                      value={editFormData.waterLevel}
                      onChange={(e) => handleEditFormChange('waterLevel', e.target.value)}
                      placeholder="เช่น ปกติ, สูงกว่าปกติ, ต่ำกว่าปกติ"
                    />
                  </Grid>

                  {/* Summary Section */}
                  <Grid item xs={12} sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                      สรุปผลจับ
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="น้ำหนักรวม (กก.)"
                      value={editFormData.totalWeight}
                      onChange={(e) => handleEditFormChange('totalWeight', parseFloat(e.target.value) || 0)}
                      slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="มูลค่ารวม (บาท)"
                      value={editFormData.totalValue}
                      onChange={(e) => handleEditFormChange('totalValue', parseFloat(e.target.value) || 0)}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </Grid>

                  {/* Notes Section */}
                  <Grid item xs={12} sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                      หมายเหตุ
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="บันทึกเพิ่มเติม"
                      value={editFormData.notes}
                      onChange={(e) => handleEditFormChange('notes', e.target.value)}
                      placeholder="บันทึกเพิ่มเติมเกี่ยวกับการจับปลา เช่น สภาพปลา, จำนวนที่ปล่อยคืน, ปัญหาที่พบ"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleCloseEditDialog}
              disabled={editLoading}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSaveEdit}
              variant="contained"
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
      </Box>
    </DashboardLayout>
  );
};

export default FishingRecordsPage;
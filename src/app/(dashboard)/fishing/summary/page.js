'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  ArrowBack,
  Search,
  FilterList,
  Download,
  Schedule,
  Scale,
  AttachMoney,
  PhotoCamera
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const FishingSummaryPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasAnyRole } = useAuth();

  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalWeight: 0,
    totalSpecies: 0,
    verifiedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [openImageDialog, setOpenImageDialog] = useState(false);

  // Check permissions
  const canViewRecords = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT]);

  // Get userId from URL
  useEffect(() => {
    const userIdParam = searchParams.get('userId');
    if (userIdParam) {
      setUserId(userIdParam);
      fetchUserInfo(userIdParam);
    }
  }, [searchParams]);

  // Fetch user info
  const fetchUserInfo = async (uid) => {
    try {
      const response = await fetch(`/api/users/${uid}`);
      const result = await response.json();
      if (result.success && result.user) {
        setUserName(result.user.name || result.user.email || 'ผู้ใช้');
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  // Fetch records from API
  const fetchRecords = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      // Build query parameters - get all user records (will filter verified on client)
      const params = new URLSearchParams({
        userId: userId,
        limit: '1000', // Get all records for the user
        ...(provinceFilter !== 'all' && { province: provinceFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/fishing-records?${params}`);
      const result = await response.json();

      if (result.success) {
        let filteredRecords = result.data || [];

        // Filter by verified status (client-side filtering)
        filteredRecords = filteredRecords.filter(record => record.verified === true);

        // Filter by month
        if (monthFilter !== 'all') {
          const filterMonth = monthFilter; // Format: YYYY-MM
          filteredRecords = filteredRecords.filter(record => {
            if (!record.catchDate) return false;
            const recordMonth = record.catchDate.substring(0, 7); // Get YYYY-MM
            return recordMonth === filterMonth;
          });
        }

        setRecords(filteredRecords);

        // Calculate stats for filtered records
        // Calculate unique species count across all records
        const uniqueSpecies = new Set();
        filteredRecords.forEach(record => {
          if (record.fishData && Array.isArray(record.fishData)) {
            record.fishData.forEach(fish => {
              if (fish.species) {
                uniqueSpecies.add(fish.species);
              }
            });
          }
        });

        const filteredStats = {
          totalRecords: filteredRecords.length,
          totalWeight: filteredRecords.reduce((sum, r) => sum + (r.totalWeight || 0), 0),
          totalSpecies: uniqueSpecies.size,
          verifiedCount: filteredRecords.filter(r => r.verified).length
        };
        setStats(filteredStats);
      } else {
        setError(result.message || 'ไม่สามารถโหลดข้อมูลได้');
        setRecords([]);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [userId, provinceFilter, monthFilter, searchTerm]);

  useEffect(() => {
    if (canViewRecords && userId) {
      fetchRecords();
    }
  }, [canViewRecords, userId, fetchRecords]);

  const handleViewRecord = (record) => {
    setSelectedRecord(record);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedRecord(null);
  };

  const handleOpenImageDialog = (imageUrl) => {
    setSelectedImage(imageUrl);
    setOpenImageDialog(true);
  };

  const handleCloseImageDialog = () => {
    setOpenImageDialog(false);
    setSelectedImage(null);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Generate all 12 months for current year
  const getAvailableMonths = () => {
    const currentYear = new Date().getFullYear();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const month = String(i + 1).padStart(2, '0');
      months.push(`${currentYear}-${month}`);
    }
    return months; // January to December
  };

  const filteredRecords = records;

  if (!canViewRecords) {
    return (
      <DashboardLayout>
        <Alert severity="error">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้
        </Alert>
      </DashboardLayout>
    );
  }

  if (!userId) {
    return (
      <DashboardLayout>
        <Alert severity="warning">
          กรุณาระบุ userId ใน URL
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.back()}
            variant="outlined"
          >
            กลับ
          </Button>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              สรุปรายการจับปลา
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {userName}
            </Typography>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Agriculture />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
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

          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <Scale />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {stats.totalWeight.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      น้ำหนักรวม (กก.)
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <Agriculture />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {stats.totalSpecies || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ชนิดปลาทั้งหมด
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="ค้นหา..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>เดือน</InputLabel>
                  <Select
                    value={monthFilter}
                    label="เดือน"
                    onChange={(e) => setMonthFilter(e.target.value)}
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    {getAvailableMonths().map((month) => (
                      <MenuItem key={month} value={month}>
                        {new Date(month + '-01').toLocaleDateString('th-TH', { month: 'long' })}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell align="center">ลำดับ</TableCell>
                    <TableCell>วันที่จับ</TableCell>
                    <TableCell>ชื่อชาวประมง</TableCell>
                    <TableCell>สถานที่</TableCell>
                    <TableCell align="right">น้ำหนัก (กก.)</TableCell>
                    <TableCell align="right">จำนวนชนิดปลา</TableCell>
                    <TableCell align="center">สถานะ</TableCell>
                    <TableCell align="center">จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        กำลังโหลด...
                      </TableCell>
                    </TableRow>
                  ) : filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        ไม่พบข้อมูล
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((record, index) => (
                        <TableRow key={record.id} hover>
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight="medium">
                              {page * rowsPerPage + index + 1}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {record.catchDate ? new Date(record.catchDate).toLocaleDateString('th-TH') : '-'}
                          </TableCell>
                          <TableCell>{record.fisherName || '-'}</TableCell>
                          <TableCell>{record.location?.province || '-'}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {record.totalWeight || 0}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {record.fishData?.length || 0} ชนิด
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label="ยืนยันแล้ว"
                              color="success"
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewRecord(record)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
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
            />
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            รายละเอียดการจับปลา
          </DialogTitle>
          <DialogContent>
            {selectedRecord && (
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">ชาวประมง</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedRecord.fisherName || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">วันที่จับ</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedRecord.catchDate ? new Date(selectedRecord.catchDate).toLocaleDateString('th-TH') : '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">สถานที่</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedRecord.location?.province || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">น้ำหนักรวม</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedRecord.totalWeight || 0} กก.
                    </Typography>
                  </Grid>
                </Grid>

                {/* Fish Data */}
                {selectedRecord.fishData && selectedRecord.fishData.length > 0 && (
                  <>
                    <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                      ข้อมูลปลาที่จับได้
                    </Typography>
                    {selectedRecord.fishData.map((fish, index) => (
                      <Card key={index} sx={{ mb: 1 }}>
                        <CardContent sx={{ py: 1 }}>
                          <Grid container spacing={2} alignItems="center">
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
                  </>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>ปิด</Button>
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

// Wrap with Suspense for useSearchParams
export default function FishingSummaryPageWrapper() {
  return (
    <Suspense fallback={<DashboardLayout><Box sx={{ p: 3 }}>Loading...</Box></DashboardLayout>}>
      <FishingSummaryPage />
    </Suspense>
  );
}

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
  Chip,
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  FormHelperText,
  CircularProgress
} from '@mui/material';
import {
  Search,
  Add,
  Edit,
  Delete,
  Visibility,
  WaterDrop,
  Science,
  Thermostat,
  Analytics,
  DateRange,
  FilterList,
  LocationOn,
  Map,
  CalendarToday,
  Notes
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, orderBy, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// ฟังก์ชันแปลงข้อมูลจาก Firestore
const transformFirestoreWaterQuality = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    stationName: data.stationName || '',
    location: data.location || '',
    latitude: data.latitude || 0,
    longitude: data.longitude || 0,
    temperature: data.temperature || 0,
    pH: data.pH || 0,
    dissolvedOxygen: data.dissolvedOxygen || 0,
    measuredDate: data.measuredDate ? data.measuredDate.toDate?.()?.toISOString()?.split('T')[0] || data.measuredDate : new Date().toISOString().split('T')[0],
    measuredBy: data.measuredBy || '',
    notes: data.notes || '',
    status: data.status || 'normal',
    createdAt: data.createdAt ? data.createdAt.toDate?.()?.toISOString()?.split('T')[0] || data.createdAt : new Date().toISOString().split('T')[0],
    createdBy: data.createdBy || ''
  };
};

// ฟังก์ชันประเมินคุณภาพน้ำ
const evaluateWaterQuality = (temperature, pH, dissolvedOxygen) => {
  // เกณฑ์มาตรฐานคุณภาพน้ำ
  const tempGood = temperature >= 20 && temperature <= 30;
  const pHGood = pH >= 6.5 && pH <= 8.5;
  const doGood = dissolvedOxygen >= 5;
  
  if (tempGood && pHGood && doGood) return 'excellent';
  if ((tempGood && pHGood) || (tempGood && doGood) || (pHGood && doGood)) return 'good';
  if (tempGood || pHGood || doGood) return 'fair';
  return 'poor';
};

// แสดงชื่อสถานี/ตำแหน่งสำหรับเขตอำเภอเชียงคานถึงปากชม
const STATION_DISPLAY_OVERRIDES = {
  'สถานีเชียงคาน (Kh.97)': {
    stationName: 'สถานีเชียงคาน (Kh.97)',
    location: 'เขตเทศบาลตำบลเชียงคาน อ.เชียงคาน'
  },
  'สถานีโทรมาตรเชียงคาน (011903)': {
    stationName: 'สถานีโทรมาตรเชียงคาน (011903)',
    location: 'ต.เชียงคาน อ.เชียงคาน (ริมโขง)'
  },
  'สถานีสะพานลำน้ำเลย': {
    stationName: 'สถานีสะพานลำน้ำเลย',
    location: 'ต.เชียงคาน อ.เชียงคาน (ปากแม่น้ำเลย)'
  },
  'จุดเฝ้าระวังระดับน้ำปากชม': {
    stationName: 'จุดเฝ้าระวังระดับน้ำปากชม',
    location: 'ริมแม่น้ำโขง อ.ปากชม'
  }
};

const getDisplayStation = (data) => {
  const override = STATION_DISPLAY_OVERRIDES[data.stationName];
  if (!override) {
    return { stationName: data.stationName, location: data.location };
  }
  return {
    stationName: override.stationName,
    location: override.location
  };
};

export default function WaterQualityDataPage() {
  const { userProfile, hasAnyRole } = useAuth();
  const [waterQualityData, setWaterQualityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredData, setFilteredData] = useState([]);
  
  // Water Stations state
  const [stations, setStations] = useState([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  
  // Date filtering state
  const [dateFilter, setDateFilter] = useState('all'); // all, 1week, 1month, 3months, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStation, setSelectedStation] = useState('all');
  
  // Create Dialog State
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  
  // Detail Dialog State
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  
  // Form Data
  const [formData, setFormData] = useState({
    stationId: '',
    stationName: '',
    location: '',
    latitude: '',
    longitude: '',
    temperature: '',
    pH: '',
    dissolvedOxygen: '',
    measuredDate: new Date().toISOString().split('T')[0],
    measuredBy: userProfile?.name || userProfile?.email || 'ผู้ใช้ระบบ',
    notes: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Check permissions
  const canManageData = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  useEffect(() => {
    // เรียกข้อมูลคุณภาพน้ำจาก Firestore
    const loadWaterQualityData = async () => {
      try {
        setLoading(true);
        console.log('Loading water quality data...');

        const dataQuery = query(
          collection(db, 'waterQuality'),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(dataQuery);
        const data = snapshot.docs.map(doc => transformFirestoreWaterQuality(doc));
        console.log('Loaded water quality data:', data.length);

        setWaterQualityData(data);
        setFilteredData(data);
      } catch (error) {
        console.error('Error loading water quality data:', error);
      } finally {
        setLoading(false);
      }
    };

    // โหลดข้อมูลสถานีตรวจวัด
    const loadWaterStations = async () => {
      try {
        setStationsLoading(true);
        console.log('Loading water stations...');

        const stationsQuery = query(
          collection(db, 'waterStations'),
          orderBy('stationName', 'asc')
        );

        const snapshot = await getDocs(stationsQuery);
        const stationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('Loaded water stations:', stationsData.length);

        setStations(stationsData);
      } catch (error) {
        console.error('Error loading water stations:', error);
      } finally {
        setStationsLoading(false);
      }
    };

    loadWaterQualityData();
    loadWaterStations();
  }, []);

  // Update measuredBy when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setFormData(prev => ({
        ...prev,
        measuredBy: userProfile.name || userProfile.email || 'ผู้ใช้ระบบ'
      }));
    }
  }, [userProfile]);

  useEffect(() => {
    // Filter data based on search query, date range, and station
    let filtered = [...waterQualityData];
    
    // Filter out specific unwanted stations
    filtered = filtered.filter(data => 
      data.stationName !== 'สถานีตรวจวัดหนองคาย'
    );
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(data =>
        (data.stationName && data.stationName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (data.location && data.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (data.measuredBy && data.measuredBy.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Filter by station
    if (selectedStation !== 'all') {
      filtered = filtered.filter(data => data.stationName === selectedStation);
    }
    
    // Filter by date range
    if (dateFilter !== 'all') {
      const today = new Date();
      let filterDate = new Date();
      
      switch (dateFilter) {
        case '1week':
          filterDate.setDate(today.getDate() - 7);
          break;
        case '1month':
          filterDate.setMonth(today.getMonth() - 1);
          break;
        case '3months':
          filterDate.setMonth(today.getMonth() - 3);
          break;
        case 'custom':
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            filtered = filtered.filter(data => {
              const measuredDate = new Date(data.measuredDate);
              return measuredDate >= start && measuredDate <= end;
            });
          }
          break;
      }
      
      if (dateFilter !== 'custom') {
        filtered = filtered.filter(data => {
          const measuredDate = new Date(data.measuredDate);
          return measuredDate >= filterDate;
        });
      }
    }
    
    setFilteredData(filtered);
  }, [searchQuery, waterQualityData, dateFilter, startDate, endDate, selectedStation]);

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleDateFilterChange = (event) => {
    setDateFilter(event.target.value);
    // Reset custom date range when switching away from custom
    if (event.target.value !== 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleStationChange = (event) => {
    setSelectedStation(event.target.value);
  };

  // Get unique station names for filter dropdown (exclude unwanted stations)
  const uniqueStations = [...new Set(waterQualityData
    .filter(data => data.stationName !== 'สถานีตรวจวัดหนองคาย')
    .map(data => data.stationName))].sort();

  // Handle station selection
  const handleStationSelection = (event) => {
    const selectedStationId = event.target.value;
    const selectedStation = stations.find(station => station.id === selectedStationId);
    
    if (selectedStation) {
      setFormData(prev => ({
        ...prev,
        stationId: selectedStation.id,
        stationName: selectedStation.stationName,
        location: selectedStation.location,
        latitude: selectedStation.latitude || '',
        longitude: selectedStation.longitude || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        stationId: '',
        stationName: '',
        location: '',
        latitude: '',
        longitude: ''
      }));
    }
  };

  // Form validation
  const validateForm = () => {
    const errors = {};
    
    if (!formData.stationId) {
      errors.stationId = 'กรุณาเลือกสถานีตรวจวัด';
    }
    
    if (!formData.temperature) {
      errors.temperature = 'กรุณากรอกอุณหภูมิ';
    } else if (isNaN(formData.temperature) || formData.temperature < 0 || formData.temperature > 50) {
      errors.temperature = 'อุณหภูมิต้องเป็นตัวเลข 0-50 องศาเซลเซียส';
    }
    
    if (!formData.pH) {
      errors.pH = 'กรุณากรอกค่า pH';
    } else if (isNaN(formData.pH) || formData.pH < 0 || formData.pH > 14) {
      errors.pH = 'ค่า pH ต้องเป็นตัวเลข 0-14';
    }
    
    if (!formData.dissolvedOxygen) {
      errors.dissolvedOxygen = 'กรุณากรอกปริมาณออกซิเจนละลาย';
    } else if (isNaN(formData.dissolvedOxygen) || formData.dissolvedOxygen < 0) {
      errors.dissolvedOxygen = 'ปริมาณออกซิเจนละลายต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0';
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

  // Handle create data
  const handleCreateData = async () => {
    if (!validateForm()) return;

    setCreateLoading(true);
    setCreateError('');

    try {
      const dataToSave = {
        stationId: formData.stationId,
        stationName: formData.stationName,
        location: formData.location,
        latitude: parseFloat(formData.latitude) || 0,
        longitude: parseFloat(formData.longitude) || 0,
        temperature: parseFloat(formData.temperature),
        pH: parseFloat(formData.pH),
        dissolvedOxygen: parseFloat(formData.dissolvedOxygen),
        measuredDate: new Date(formData.measuredDate),
        measuredBy: formData.measuredBy,
        notes: formData.notes,
        status: evaluateWaterQuality(parseFloat(formData.temperature), parseFloat(formData.pH), parseFloat(formData.dissolvedOxygen)),
        createdAt: new Date(),
        createdBy: userProfile?.email || 'admin'
      };
      
      await addDoc(collection(db, 'waterQuality'), dataToSave);
      
      setOpenCreateDialog(false);
      resetForm();
      
      alert('บันทึกข้อมูลคุณภาพน้ำสำเร็จ!');
      
    } catch (error) {
      setCreateError(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setCreateLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      stationId: '',
      stationName: '',
      location: '',
      latitude: '',
      longitude: '',
      temperature: '',
      pH: '',
      dissolvedOxygen: '',
      measuredDate: new Date().toISOString().split('T')[0],
      measuredBy: userProfile?.name || userProfile?.email || 'ผู้ใช้ระบบ',
      notes: ''
    });
    setFormErrors({});
    setCreateError('');
  };

  const handleOpenCreateDialog = () => {
    resetForm();
    setOpenCreateDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
    resetForm();
  };

  // Detail Modal functions
  const handleOpenDetailDialog = (data) => {
    setSelectedData(data);
    setOpenDetailDialog(true);
  };

  const handleCloseDetailDialog = () => {
    setOpenDetailDialog(false);
    setSelectedData(null);
  };

  // Status color mapping
  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'excellent': return 'ดีเยี่ยม';
      case 'good': return 'ดี';
      case 'fair': return 'พอใช้';
      case 'poor': return 'แย่';
      default: return 'ไม่ระบุ';
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 1, pl: 1.5 }}>
        {/* Header */}
        <Box mb={3}>
          <Typography variant="h4" gutterBottom>
            ข้อมูลคุณภาพน้ำ
          </Typography>
          <Typography variant="body1" color="text.secondary">
            จัดการข้อมูลการตรวจวัดคุณภาพน้ำในแม่น้ำโขง
          </Typography>
        </Box>

        {/* Filters and Actions */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            {/* Filter Row */}
            <Box mb={2}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterList />
                ตัวกรองข้อมูล
              </Typography>
              
              <Grid container spacing={2} alignItems="center">
                {/* Date Filter */}
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>ช่วงเวลา</InputLabel>
                    <Select
                      value={dateFilter}
                      onChange={handleDateFilterChange}
                      label="ช่วงเวลา"
                      startAdornment={<DateRange sx={{ mr: 1, fontSize: 'small' }} />}
                    >
                      <MenuItem value="all">ทั้งหมด</MenuItem>
                      <MenuItem value="1week">7 วันล่าสุด</MenuItem>
                      <MenuItem value="1month">1 เดือนล่าสุด</MenuItem>
                      <MenuItem value="3months">3 เดือนล่าสุด</MenuItem>
                      <MenuItem value="custom">กำหนดเอง</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                {/* Station Filter */}
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>สถานีตรวจวัด</InputLabel>
                    <Select
                      value={selectedStation}
                      onChange={handleStationChange}
                      label="สถานีตรวจวัด"
                    >
                      <MenuItem value="all">ทุกสถานี</MenuItem>
                      {uniqueStations.map((station) => (
                        <MenuItem key={station} value={station}>
                          {station}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                {/* Custom Date Range - Show only when custom is selected */}
                {dateFilter === 'custom' && (
                  <>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="จากวันที่"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        size="small"
                        InputLabelProps={{
                          shrink: true,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="ถึงวันที่"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        size="small"
                        InputLabelProps={{
                          shrink: true,
                        }}
                      />
                    </Grid>
                  </>
                )}
                
                {/* Results Count */}
                <Grid item xs={12} md={dateFilter === 'custom' ? 2 : 6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Analytics color="primary" />
                    <Typography variant="body2" color="text.secondary">
                      แสดง {filteredData.length} จาก {waterQualityData.length} รายการ
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
            
            {/* Search and Add Button Row */}
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
              {/* Search */}
              <TextField
                placeholder="ค้นหาสถานีตรวจวัด, ตำแหน่ง, หรือผู้วัด..."
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
              
              {/* Add Data Button */}
              {canManageData && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  size="small"
                  onClick={handleOpenCreateDialog}
                >
                  เพิ่มข้อมูล
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardContent>
            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <Typography>กำลังโหลดข้อมูล...</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>สถานีตรวจวัด</TableCell>
                      <TableCell>ตำแหน่งที่ตั้ง</TableCell>
                      <TableCell align="center">อุณหภูมิ (°C)</TableCell>
                      <TableCell align="center">pH</TableCell>
                      <TableCell align="center">ออกซิเจนละลาย (mg/L)</TableCell>
                      <TableCell>คุณภาพน้ำ</TableCell>
                      <TableCell>วันที่วัด</TableCell>
                      <TableCell align="center">จัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredData.map((data) => {
                      const display = getDisplayStation(data);
                      return (
                        <TableRow key={data.id} hover>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {display.stationName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                วัดโดย: {data.measuredBy}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {display.location}
                            </Typography>
                          </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            <Thermostat fontSize="small" />
                            {data.temperature}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            <Science fontSize="small" />
                            {data.pH}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            <WaterDrop fontSize="small" />
                            {data.dissolvedOxygen}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(data.status)}
                            color={getStatusColor(data.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {data.measuredDate}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box display="flex" gap={0.5}>
                            <Tooltip title="ดูรายละเอียด">
                              <IconButton 
                                size="small"
                                onClick={() => handleOpenDetailDialog(data)}
                              >
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {canManageData && (
                              <>
                                <Tooltip title="แก้ไข">
                                  <IconButton size="small">
                                    <Edit fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="ลบ">
                                  <IconButton size="small" color="error">
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {!loading && filteredData.length === 0 && (
              <Box textAlign="center" py={3}>
                <Typography color="text.secondary">
                  {searchQuery ? 'ไม่พบข้อมูลที่ค้นหา' : 'ไม่มีข้อมูลคุณภาพน้ำ'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Create Data Dialog */}
        <Dialog
          open={openCreateDialog}
          onClose={handleCloseCreateDialog}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={2}>
              <WaterDrop sx={{ color: 'primary.main', fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight="bold">
                  เพิ่มข้อมูลคุณภาพน้ำใหม่
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  กรอกข้อมูลการตรวจวัดคุณภาพน้ำในแม่น้ำโขง
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 3 }}>
              {createError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {createError}
                </Alert>
              )}
              
              {/* Section 1: Station Information */}
              <Card variant="outlined" sx={{ mb: 3, p: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <LocationOn sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" color="primary" fontWeight="bold">
                    1. ข้อมูลสถานีตรวจวัด
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl 
                      fullWidth 
                      error={!!formErrors.stationId}
                      disabled={createLoading || stationsLoading}
                    >
                      <InputLabel>สถานีตรวจวัด *</InputLabel>
                      <Select
                        value={formData.stationId}
                        label="สถานีตรวจวัด *"
                        onChange={handleStationSelection}
                        startAdornment={
                          <InputAdornment position="start">
                            <LocationOn color="primary" />
                          </InputAdornment>
                        }
                      >
                        <MenuItem value="">
                          <em>กรุณาเลือกสถานีตรวจวัด</em>
                        </MenuItem>
                        {stations.map((station) => (
                          <MenuItem key={station.id} value={station.id}>
                            {station.stationName}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {formErrors.stationId || 
                          (stationsLoading ? "กำลังโหลดรายการสถานี..." : "เลือกสถานีตรวจวัดคุณภาพน้ำ")
                        }
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                  
                  {formData.stationId && (
                    <>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="ตำแหน่งที่ตั้ง"
                          value={formData.location}
                          disabled={true}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Map color="action" />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiInputBase-input.Mui-disabled': {
                              WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                            },
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="ละติจูด (Latitude)"
                          value={formData.latitude}
                          disabled={true}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Map color="action" />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiInputBase-input.Mui-disabled': {
                              WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                            },
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="ลองติจูด (Longitude)"
                          value={formData.longitude}
                          disabled={true}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Map color="action" />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiInputBase-input.Mui-disabled': {
                              WebkitTextFillColor: 'rgba(0, 0, 0, 0.6)',
                            },
                          }}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </Card>

              {/* Section 2: Water Quality Measurements */}
              <Card variant="outlined" sx={{ mb: 3, p: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Science sx={{ color: 'secondary.main' }} />
                  <Typography variant="h6" color="secondary" fontWeight="bold">
                    2. ค่าการวัดคุณภาพน้ำ
                  </Typography>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="อุณหภูมิ (°C) *"
                      type="number"
                      value={formData.temperature}
                      onChange={handleInputChange('temperature')}
                      error={!!formErrors.temperature}
                      helperText={formErrors.temperature || "ช่วงปกติ: 20-30°C"}
                      disabled={createLoading}
                      inputProps={{ step: "0.1", min: 0, max: 50 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Thermostat color="error" />
                          </InputAdornment>
                        ),
                        endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="ค่า pH *"
                      type="number"
                      value={formData.pH}
                      onChange={handleInputChange('pH')}
                      error={!!formErrors.pH}
                      helperText={formErrors.pH || "ช่วงปกติ: 6.5-8.5"}
                      disabled={createLoading}
                      inputProps={{ step: "0.1", min: 0, max: 14 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Science color="warning" />
                          </InputAdornment>
                        ),
                        endAdornment: <InputAdornment position="end">pH</InputAdornment>,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="ออกซิเจนละลาย *"
                      type="number"
                      value={formData.dissolvedOxygen}
                      onChange={handleInputChange('dissolvedOxygen')}
                      error={!!formErrors.dissolvedOxygen}
                      helperText={formErrors.dissolvedOxygen || "ควรมากกว่า 5 mg/L"}
                      disabled={createLoading}
                      inputProps={{ step: "0.1", min: 0 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <WaterDrop color="info" />
                          </InputAdornment>
                        ),
                        endAdornment: <InputAdornment position="end">mg/L</InputAdornment>,
                      }}
                    />
                  </Grid>
                </Grid>
              </Card>

              {/* Section 3: Additional Information */}
              <Card variant="outlined" sx={{ mb: 2, p: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <CalendarToday sx={{ color: 'success.main' }} />
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    3. ข้อมูลเพิ่มเติม
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="วันที่วัด"
                      type="date"
                      value={formData.measuredDate}
                      onChange={handleInputChange('measuredDate')}
                      disabled={createLoading}
                      helperText="กำหนดวันที่ทำการตรวจวัด"
                      InputLabelProps={{
                        shrink: true,
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <CalendarToday color="success" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="หมายเหตุ"
                      multiline
                      rows={4}
                      value={formData.notes}
                      onChange={handleInputChange('notes')}
                      disabled={createLoading}
                      placeholder="บันทึกข้อมูลเพิ่มเติม เช่น สภาพอากาศ, สีน้ำ, กลิ่น, พืชน้ำที่พบ, สัตว์น้ำที่พบ, หรือสิ่งผิดปกติอื่นๆ"
                      helperText="สามารถระบุข้อมูลเพิ่มเติมที่เกี่ยวข้องกับการตรวจวัด"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                            <Notes color="success" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </Card>
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
              onClick={handleCreateData}
              disabled={createLoading}
              startIcon={createLoading ? <CircularProgress size={20} /> : <Add />}
            >
              {createLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
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
                  รายละเอียดข้อมูลคุณภาพน้ำ
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedData?.stationName}
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedData && (
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={3}>
                  {/* Station Info */}
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom color="primary">
                        1. ข้อมูลสถานีตรวจวัด
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">ชื่อสถานี</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedData.stationName}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">ตำแหน่งที่ตั้ง</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedData.location}
                          </Typography>
                        </Grid>
                        
                        {(selectedData.latitude || selectedData.longitude) && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">พิกัด</Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {selectedData.latitude}, {selectedData.longitude}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </Card>
                  </Grid>
                  
                  {/* Water Quality Data */}
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom color="primary">
                        2. ข้อมูลคุณภาพน้ำ
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">อุณหภูมิ</Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Thermostat color="primary" />
                            <Typography variant="body1" fontWeight="medium">
                              {selectedData.temperature} °C
                            </Typography>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">ค่า pH</Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Science color="primary" />
                            <Typography variant="body1" fontWeight="medium">
                              {selectedData.pH}
                            </Typography>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">ออกซิเจนละลาย</Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <WaterDrop color="primary" />
                            <Typography variant="body1" fontWeight="medium">
                              {selectedData.dissolvedOxygen} mg/L
                            </Typography>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">คุณภาพน้ำโดยรวม</Typography>
                          <Box sx={{ mt: 0.5 }}>
                            <Chip
                              label={getStatusLabel(selectedData.status)}
                              color={getStatusColor(selectedData.status)}
                              size="medium"
                            />
                          </Box>
                        </Grid>
                      </Grid>
                    </Card>
                  </Grid>
                  
                  {/* Additional Info */}
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom color="primary">
                        3. ข้อมูลเพิ่มเติม
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">วันที่วัด</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedData.measuredDate}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">ผู้วัด</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedData.measuredBy}
                          </Typography>
                        </Grid>
                        
                        {selectedData.notes && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">หมายเหตุ</Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {selectedData.notes}
                            </Typography>
                          </Grid>
                        )}
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">บันทึกเมื่อ</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedData.createdAt} โดย {selectedData.createdBy}
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
            {canManageData && (
              <Button variant="contained" color="primary" startIcon={<Edit />}>
                แก้ไขข้อมูล
              </Button>
            )}
          </DialogActions>
        </Dialog>

      </Box>
    </DashboardLayout>
  );
}
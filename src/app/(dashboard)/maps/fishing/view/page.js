'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Grid
} from '@mui/material';
import {
  ArrowBack,
  LocationOn,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import GoogleMap from '@/components/maps/GoogleMap';

export default function FishingMapViewPage() {
  const router = useRouter();
  const [spots, setSpots] = useState([]);
  const [fishDistribution, setFishDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [selectedFish, setSelectedFish] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fishDialogOpen, setFishDialogOpen] = useState(false);
  const [showFishMarkers, setShowFishMarkers] = useState(true);
  const [stats, setStats] = useState({
    active: 0,
    inactive: 0,
    withCoordinates: 0
  });

  // Center map on Mekong region (Thailand-Laos border)
  const mapCenter = { lat: 17.4, lng: 102.8 };

  useEffect(() => {
    fetchSpots();
    fetchFishDistribution();
  }, []);

  const fetchSpots = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/fishing-spots?status=active');
      const result = await response.json();

      if (result.success) {
        // Filter only spots with valid coordinates
        const validSpots = result.data.filter(
          spot => spot.latitude && spot.longitude &&
                 !isNaN(spot.latitude) && !isNaN(spot.longitude)
        );

        setSpots(validSpots);
        setStats(result.stats || stats);

        if (validSpots.length === 0) {
          setError('ไม่พบจุดจับปลาที่มีพิกัดที่ถูกต้อง');
        }
      } else {
        setError(result.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } catch (error) {
      console.error('Error fetching spots:', error);
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchFishDistribution = async () => {
    try {
      console.log('🔄 Fetching fish distribution...');
      const response = await fetch('/api/fish-distribution');
      const result = await response.json();

      console.log('📦 Fish distribution API response:', result);

      if (result.success) {
        console.log('✅ Setting fishDistribution with', result.data?.length || 0, 'items');
        setFishDistribution(result.data || []);
      } else {
        console.error('❌ API returned success: false');
      }
    } catch (error) {
      console.error('❌ Error fetching fish distribution:', error);
    }
  };

  const handleMarkerClick = (spot) => {
    setSelectedSpot(spot);
    setDialogOpen(true);
  };

  const handleViewInGoogleMaps = () => {
    if (selectedSpot) {
      window.open(
        `https://www.google.com/maps?q=${selectedSpot.latitude},${selectedSpot.longitude}`,
        '_blank'
      );
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedSpot(null);
  };

  const handleFishMarkerClick = (fish) => {
    setSelectedFish(fish);
    setFishDialogOpen(true);
  };

  const handleCloseFishDialog = () => {
    setFishDialogOpen(false);
    setSelectedFish(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <Box textAlign="center">
          <CircularProgress size={60} />
          <Typography variant="body1" sx={{ mt: 2 }}>
            กำลังโหลดข้อมูลจุดจับปลา...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/maps/fishing')}
              variant="outlined"
            >
              กลับ
            </Button>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                แผนที่จุดจับปลา
              </Typography>
              <Typography variant="body2" color="text.secondary">
                แสดงจุดจับปลาที่เปิดใช้งานทั้งหมด
              </Typography>
            </Box>
          </Box>

          {error && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Box>

        {/* Map */}
        <Paper elevation={3} sx={{ overflow: 'hidden', borderRadius: 2 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              🐟 แสดงข้อมูลการกระจายตัวของปลา {fishDistribution.length} กลุ่ม
            </Typography>
            <Button
              size="small"
              variant={showFishMarkers ? 'contained' : 'outlined'}
              onClick={() => setShowFishMarkers(!showFishMarkers)}
            >
              {showFishMarkers ? 'ซ่อนหมุดปลา' : 'แสดงหมุดปลา'}
            </Button>
          </Box>
          <GoogleMap
            spots={spots}
            fishDistribution={fishDistribution}
            center={mapCenter}
            zoom={9}
            onMarkerClick={handleMarkerClick}
            onFishMarkerClick={handleFishMarkerClick}
            showFishMarkers={showFishMarkers}
            height="600px"
          />
        </Paper>

        {/* Instructions */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            💡 <strong>คำแนะนำ:</strong>
            หมุดสีแดง 📍 = จุดจับปลา | หมุดสีน้ำเงิน 🐟 = การกระจายตัวของปลา
          </Typography>
        </Alert>

        {/* Info Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <LocationOn color="error" />
              <Typography variant="h6" fontWeight="bold">
                {selectedSpot?.spotName}
              </Typography>
            </Box>
          </DialogTitle>

          <Divider />

          <DialogContent>
            {selectedSpot && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    ที่ตั้ง
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {selectedSpot.location}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    รายละเอียด
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {selectedSpot.description || 'ไม่มีรายละเอียด'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    พิกัด (Latitude, Longitude)
                  </Typography>
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    sx={{
                      mt: 0.5,
                      backgroundColor: '#f5f5f5',
                      padding: 1,
                      borderRadius: 1
                    }}
                  >
                    {selectedSpot.latitude}, {selectedSpot.longitude}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    สถานะ
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      icon={selectedSpot.status === 'active' ? <CheckCircle /> : <Cancel />}
                      label={selectedSpot.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      color={selectedSpot.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </Box>

                {selectedSpot.createdBy && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      สร้างโดย
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedSpot.createdBy}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>

          <Divider />

          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseDialog} variant="outlined">
              ปิด
            </Button>
            <Button
              variant="contained"
              startIcon={<LocationOn />}
              onClick={handleViewInGoogleMaps}
            >
              ดูใน Google Maps
            </Button>
          </DialogActions>
        </Dialog>

        {/* Fish Distribution Dialog */}
        <Dialog
          open={fishDialogOpen}
          onClose={handleCloseFishDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6" fontWeight="bold">
                🐟 {selectedFish?.species}
              </Typography>
            </Box>
          </DialogTitle>

          <Divider />

          <DialogContent>
            {selectedFish && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Location Info */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    สถานที่จับ
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {selectedFish.location?.village || selectedFish.location?.address || 'ไม่ระบุ'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedFish.location?.district} {selectedFish.location?.province}
                  </Typography>
                </Box>

                {/* Quantity and Weight */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      จำนวน
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary.main" sx={{ mt: 0.5 }}>
                      {selectedFish.quantity} ตัว
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      น้ำหนักรวม
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary.main" sx={{ mt: 0.5 }}>
                      {selectedFish.weight} กก.
                    </Typography>
                  </Grid>
                </Grid>

                {/* Length Range */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      ความยาวต่ำสุด
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {selectedFish.minLength} ซม.
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      ความยาวสูงสุด
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {selectedFish.maxLength} ซม.
                    </Typography>
                  </Grid>
                </Grid>

                {/* Price Info */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      ราคาต่อหน่วย
                    </Typography>
                    <Typography variant="h6" color="success.main" sx={{ mt: 0.5 }}>
                      {selectedFish.price} บาท/กก.
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      มูลค่ารวม
                    </Typography>
                    <Typography variant="h6" color="success.main" sx={{ mt: 0.5 }}>
                      {selectedFish.totalValue.toLocaleString()} บาท
                    </Typography>
                  </Grid>
                </Grid>

                <Divider />

                {/* Fishing Info */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      วันที่จับ
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedFish.catchDate ? new Date(selectedFish.catchDate).toLocaleDateString('th-TH') : '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      ช่วงเวลา
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedFish.timeOfDay || '-'}
                    </Typography>
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      สภาพอากาศ
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedFish.weather || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      ระดับน้ำ
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedFish.waterLevel || '-'}
                    </Typography>
                  </Grid>
                </Grid>

                {selectedFish.waterSource && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      แหล่งน้ำ
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedFish.waterSource}
                    </Typography>
                  </Box>
                )}

                {selectedFish.fishingGear && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      เครื่องมือจับปลา
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedFish.fishingGear}
                    </Typography>
                  </Box>
                )}

                <Divider />

                {/* Coordinates */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    พิกัด (Latitude, Longitude)
                  </Typography>
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    sx={{
                      mt: 0.5,
                      backgroundColor: '#f5f5f5',
                      padding: 1,
                      borderRadius: 1
                    }}
                  >
                    {selectedFish.originalLatitude}, {selectedFish.originalLongitude}
                  </Typography>
                </Box>
              </Box>
            )}
          </DialogContent>

          <Divider />

          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseFishDialog} variant="outlined">
              ปิด
            </Button>
            <Button
              variant="contained"
              startIcon={<LocationOn />}
              onClick={() => {
                if (selectedFish) {
                  window.open(
                    `https://www.google.com/maps?q=${selectedFish.latitude},${selectedFish.longitude}`,
                    '_blank'
                  );
                }
              }}
            >
              ดูใน Google Maps
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
}

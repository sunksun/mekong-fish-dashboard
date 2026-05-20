'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  Chip,
  CircularProgress,
  Paper,
  Alert
} from '@mui/material';
import {
  Water,
  Cloud,
  Warning,
  Psychology,
  LocationOn
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, limit } from 'firebase/firestore';

const CRITICAL_LEVEL = 16.0;
const WARNING_LEVEL = 14.0;
const EXCLUDED_SPECIES = new Set(['กุ้งจ่ม', 'กุ้งฝอย', 'ไม่ทราบชื่อปลา', 'ไม่ทราบ', 'ไม่ระบุ']);

const CATEGORY_COLORS = {
  'เครื่องมือประมง': '#1976d2',
  'วิธีการจับปลา': '#2e7d32',
  'แหล่งที่อยู่ปลา': '#0288d1',
  'เวลาและฤดูกาล': '#ed6c02',
  'การดูลักษณะธรรมชาติ': '#7b1fa2',
  'การถนอมปลา': '#c62828',
  'การใช้เหยื่อ': '#558b2f',
  'อื่นๆ': '#757575'
};

function getLevelStatus(level) {
  if (level >= CRITICAL_LEVEL) return { label: 'วิกฤติ', color: 'error' };
  if (level >= WARNING_LEVEL) return { label: 'เฝ้าระวัง', color: 'warning' };
  return { label: 'ปกติ', color: 'success' };
}

export default function SpatialAnalysisPage() {
  const [waterLevels, setWaterLevels] = useState([]);
  const [wisdomEntries, setWisdomEntries] = useState([]);
  // fishingSpots: all spots from Firestore (for map + cards)
  // spotSpeciesMap: { spotName -> [{ name, count }, ...] } top-3 per spot
  const [fishingSpots, setFishingSpots] = useState([]);
  const [spotSpeciesMap, setSpotSpeciesMap] = useState({});
  const [mrcStation, setMrcStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState(null);

  useEffect(() => {
    const loadAll = async () => {
      try {
        // Fetch everything in parallel — fishingSpots and fishingRecords come
        // directly from Firestore so the join is done in local variables with
        // no state-timing issues.
        const [wlSnap, wisdomSnap, spotsSnap, recordsSnap, mrcRes] = await Promise.all([
          getDocs(query(collection(db, 'waterLevels'), orderBy('date', 'desc'), limit(30))),
          getDocs(query(collection(db, 'fishingWisdom'), limit(100))),
          getDocs(query(collection(db, 'fishingSpots'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'fishingRecords'), limit(2000))),
          fetch('/api/mekong-water-level')
        ]);

        // ── Water levels ──────────────────────────────────────────────────
        const wlData = [];
        wlSnap.forEach(doc => wlData.push({ id: doc.id, ...doc.data() }));
        setWaterLevels(wlData);

        // ── Wisdom ───────────────────────────────────────────────────────
        const wisdomData = [];
        wisdomSnap.forEach(doc => wisdomData.push({ id: doc.id, ...doc.data() }));
        setWisdomEntries(wisdomData);

        // ── Fishing spots (all) ──────────────────────────────────────────
        const allSpots = [];
        spotsSnap.forEach(doc => {
          const d = doc.data();
          allSpots.push({
            id: doc.id,
            spotName: d.spotName || '',
            location: d.location || '',
            latitude: d.latitude ?? null,
            longitude: d.longitude ?? null,
            status: d.status || 'active',
          });
        });

        // ── Species aggregation from fishingRecords ──────────────────────
        // Build: { spotName -> { speciesName -> totalCount } }
        const agg = {};
        recordsSnap.forEach(doc => {
          const d = doc.data();
          const spotName = d.location?.spotName?.trim();
          if (!spotName) return;
          const fishList = d.fishList || [];
          fishList.forEach(fish => {
            const species = (fish.name || fish.commonName || '').trim();
            if (!species || EXCLUDED_SPECIES.has(species)) return;
            if (!agg[spotName]) agg[spotName] = {};
            agg[spotName][species] = (agg[spotName][species] || 0) + (Number(fish.count) || 1);
          });
        });

        // Convert to sorted top-3 array per spot
        const speciesMap = {};
        Object.entries(agg).forEach(([spotName, counts]) => {
          speciesMap[spotName] = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({ name, count }));
        });

        // Only keep spots that appear in speciesMap (have actual catch data)
        const spotsWithData = allSpots.filter(s => speciesMap[s.spotName]);

        setFishingSpots(spotsWithData);
        setSpotSpeciesMap(speciesMap);

        // ── MRC station ──────────────────────────────────────────────────
        if (mrcRes.ok) {
          const mrcJson = await mrcRes.json();
          setMrcStation(mrcJson);
        }
      } catch (err) {
        console.error('Error loading analysis data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  // Derived summary values
  const latestWL = waterLevels[0];
  const latestLevel = latestWL?.currentLevel ?? latestWL?.waterLevel ?? null;
  const latestRainfall = latestWL?.rainfall ?? 0;
  const levelStatus = latestLevel !== null ? getLevelStatus(latestLevel) : null;
  const alertCount = waterLevels.filter(r => {
    const lv = r.currentLevel ?? r.waterLevel ?? 0;
    return lv >= WARNING_LEVEL;
  }).length;

  // Chart data: sorted ascending for timeline
  const chartData = [...waterLevels].reverse().map(r => {
    const dateObj = new Date(r.date);
    return {
      date: `${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
      level: r.currentLevel ?? r.waterLevel ?? null,
      rainfall: r.rainfall ?? 0
    };
  });

  // Seasonal wisdom aggregation
  const seasonMap = {};
  wisdomEntries.forEach(w => {
    const season = w.season?.trim() || 'ไม่ระบุ';
    const cat = w.category || 'อื่นๆ';
    if (!seasonMap[season]) seasonMap[season] = {};
    seasonMap[season][cat] = (seasonMap[season][cat] || 0) + 1;
  });
  const wisdomChartData = Object.entries(seasonMap)
    .map(([season, cats]) => ({ season, ...cats, total: Object.values(cats).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const wisdomCategories = [...new Set(wisdomEntries.map(w => w.category).filter(Boolean))];

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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
        <Typography variant="h4" fontWeight={600} gutterBottom>
          วิเคราะห์เชิงพื้นที่
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          ภาพรวมระดับน้ำ ปริมาณน้ำฝน และภูมิปัญญาท้องถิ่นแม่น้ำโขง
        </Typography>

        {/* ── Section 1: Summary Cards ── */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Water sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {latestLevel !== null ? `${latestLevel.toFixed(2)} ม.` : '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">ระดับน้ำล่าสุด</Typography>
                    {levelStatus && (
                      <Chip label={levelStatus.label} color={levelStatus.color} size="small" sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Cloud sx={{ fontSize: 40, color: 'info.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {latestRainfall.toFixed(1)} มม.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">ปริมาณน้ำฝนล่าสุด</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Warning sx={{ fontSize: 40, color: alertCount > 0 ? 'warning.main' : 'success.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">{alertCount}</Typography>
                    <Typography variant="body2" color="text.secondary">รายการเฝ้าระวัง (30 วัน)</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Psychology sx={{ fontSize: 40, color: 'secondary.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">{wisdomEntries.length}</Typography>
                    <Typography variant="body2" color="text.secondary">ภูมิปัญญาท้องถิ่น</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* ── Section 1b: Top Fish per Spot ── */}
        {fishingSpots.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                ปลาที่จับได้มากที่สุดต่อจุด ({fishingSpots.length} จุด)
              </Typography>
              <Grid container spacing={1.5}>
                {fishingSpots.map(spot => {
                    const top = spotSpeciesMap[spot.spotName] || [];
                    return (
                      <Grid item xs={12} sm={6} md={4} key={spot.id}>
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Box display="flex" alignItems="center" gap={0.5} mb={0.75}>
                            <LocationOn sx={{ fontSize: 15, color: 'success.main' }} />
                            <Typography variant="subtitle2" fontWeight={600} noWrap>{spot.spotName}</Typography>
                          </Box>
                          <Box display="flex" flexDirection="column" gap={0.4}>
                            {top.map((f, i) => (
                              <Box key={f.name} display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" sx={{ color: i === 0 ? 'success.dark' : 'text.primary', fontWeight: i === 0 ? 600 : 400 }}>
                                  {`${i + 1}. `}{f.name}
                                </Typography>
                                <Chip label={`${f.count} ตัว`} size="small" variant="outlined" color={i === 0 ? 'success' : 'default'} />
                              </Box>
                            ))}
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>
        )}

        {/* ── Section 2: Map ── */}
        <Box mb={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                แผนที่สถานีและจุดจับปลา
              </Typography>
              {!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' ? (
                <Alert severity="warning">
                  กรุณาตั้งค่า NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ในไฟล์ .env.local
                </Alert>
              ) : (
                <Box sx={{ height: 420, borderRadius: 1, overflow: 'hidden' }}>
                  <APIProvider apiKey={apiKey}>
                    <Map
                      style={{ width: '100%', height: '100%' }}
                      defaultCenter={{ lat: 17.9, lng: 102.5 }}
                      defaultZoom={7}
                      gestureHandling="greedy"
                      mapId="mekong-analysis-map"
                    >
                      {mrcStation && (
                        <AdvancedMarker
                          position={{ lat: 17.9031, lng: 101.6619 }}
                          onClick={() => setSelectedMarker({ type: 'station', data: mrcStation })}
                          title="สถานีเชียงคาน"
                        >
                          <Box
                            sx={{
                              width: 36, height: 36, borderRadius: '50%',
                              bgcolor: 'primary.main', border: '3px solid white',
                              boxShadow: 2, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', cursor: 'pointer'
                            }}
                          >
                            <Water sx={{ color: 'white', fontSize: 18 }} />
                          </Box>
                        </AdvancedMarker>
                      )}
                      {fishingSpots.filter(s => s.latitude && s.longitude).map(spot => (
                        <AdvancedMarker
                          key={spot.id}
                          position={{ lat: spot.latitude, lng: spot.longitude }}
                          onClick={() => setSelectedMarker({ type: 'spot', data: spot })}
                          title={spot.spotName}
                        >
                          <img
                            src="/icons/fishing-spot-marker.svg"
                            alt={spot.spotName}
                            style={{ width: 32, height: 32, cursor: 'pointer' }}
                          />
                        </AdvancedMarker>
                      ))}
                    </Map>
                  </APIProvider>
                </Box>
              )}
              {selectedMarker && (
                <Paper sx={{ mt: 1.5, p: 1.5, bgcolor: 'grey.50' }} elevation={0}>
                  {selectedMarker.type === 'station' ? (
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>สถานีเชียงคาน</Typography>
                      <Typography variant="body2">
                        ระดับน้ำ: {selectedMarker.data?.data?.currentLevel ?? '—'} ม.
                      </Typography>
                    </Box>
                  ) : (() => {
                    const spot = selectedMarker.data;
                    const topFish = spotSpeciesMap[spot.spotName] || [];
                    return (
                      <Box>
                        <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                          <LocationOn sx={{ fontSize: 16, color: 'success.main' }} />
                          <Typography variant="subtitle2" fontWeight={600}>{spot.spotName}</Typography>
                        </Box>
                        {spot.location && (
                          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                            {spot.location}
                          </Typography>
                        )}
                        {topFish.length > 0 ? (
                          <Box>
                            <Typography variant="caption" color="text.secondary">ปลาที่จับได้มากที่สุด:</Typography>
                            <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                              {topFish.map((f, i) => (
                                <Chip
                                  key={f.name}
                                  label={i === 0 ? `1. ${f.name} (${f.count})` : `${f.name} (${f.count})`}
                                  size="small"
                                  color={i === 0 ? 'success' : 'default'}
                                  variant={i === 0 ? 'filled' : 'outlined'}
                                />
                              ))}
                            </Box>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">ยังไม่มีข้อมูลการจับปลา</Typography>
                        )}
                      </Box>
                    );
                  })()}
                </Paper>
              )}
              <Box display="flex" gap={2} mt={1.5}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: 'primary.main' }} />
                  <Typography variant="caption">สถานีวัดน้ำ</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: 'success.main' }} />
                  <Typography variant="caption">จุดจับปลา ({fishingSpots.filter(s => s.latitude && s.longitude).length})</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* ── Section 3: Rainfall vs Water Level Chart ── */}
        <Box mb={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                ความสัมพันธ์ระดับน้ำและปริมาณน้ำฝน
              </Typography>
              {chartData.length === 0 ? (
                <Alert severity="info">ไม่พบข้อมูล</Alert>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                    <YAxis
                      yAxisId="left"
                      label={{ value: 'ระดับน้ำ (ม.)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      label={{ value: 'น้ำฝน (มม.)', angle: 90, position: 'insideRight', style: { fontSize: 11 } }}
                      domain={[0, 'auto']}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="level"
                      stroke="#1976d2"
                      strokeWidth={2}
                      name="ระดับน้ำ (ม.)"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="rainfall"
                      stroke="#74c0fc"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      name="น้ำฝน (มม.)"
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* ── Section 4: Seasonal Wisdom Chart ── */}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  ภูมิปัญญาตามฤดูกาล
                </Typography>
                {wisdomChartData.length === 0 ? (
                  <Alert severity="info">ไม่พบข้อมูลภูมิปัญญา</Alert>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={wisdomChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis dataKey="season" type="category" width={90} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      {wisdomCategories.map(cat => (
                        <Bar
                          key={cat}
                          dataKey={cat}
                          stackId="a"
                          fill={CATEGORY_COLORS[cat] || '#9e9e9e'}
                          name={cat}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  );
}

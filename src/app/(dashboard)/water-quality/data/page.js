'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  WaterDrop,
  Opacity,
  Thermostat,
  Science,
  Download,
  TableChart,
  ExpandMore,
  ExpandLess,
  Biotech,
  Upload
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  where,
  Timestamp,
  orderBy as firestoreOrderBy,
  query,
  limit as firestoreLimit
} from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

// ประเมินสถานะคุณภาพน้ำแบบง่ายจากอุณหภูมิ, pH, DO
function evaluateWaterQuality(temperature, pH, dissolvedOxygen) {
  const tempGood = temperature >= 20 && temperature <= 30;
  const pHGood = pH >= 6.5 && pH <= 8.5;
  const doGood = dissolvedOxygen >= 5;

  if (tempGood && pHGood && doGood) return 'excellent';
  if ((tempGood && pHGood) || (tempGood && doGood) || (pHGood && doGood)) return 'good';
  if (tempGood || pHGood || doGood) return 'fair';
  return 'poor';
}

// สี/คีย์ประจำแต่ละ waterbody
const WATERBODY_STYLE = {
  'แม่น้ำโขง': { key: 'khong', color: '#1976d2' },
  'แม่น้ำเลย': { key: 'loei', color: '#2e7d32' }
};

// เฉพาะ waterbody ที่มาจากรายงานคุณภาพน้ำ จ.เลย เท่านั้น
// (collection "waterQuality" มีข้อมูล mock เก่าจากสคริปต์ create-water-quality-mockup.js /
// create-additional-water-quality-data.js ปนอยู่ ซึ่งไม่มีฟิลด์ waterbody/tss/ec/arsenic
// จึงต้องกรองออกเพื่อไม่ให้ปนกับข้อมูลจริง)
const KNOWN_WATERBODIES = Object.keys(WATERBODY_STYLE);

// รหัสสถานี MRC-WQMN ของกรมทรัพยากรน้ำ ใช้เติมฟิลด์ stationId ตอนบันทึก
// (firestore.rules กำหนดว่า create เอกสารใน collection "waterQuality" ต้องมี stationId != null)
const STATION_ID_MAP = {
  'แม่น้ำโขง': 'H011903',
  'แม่น้ำเลย': 'H0215'
};

// คำอธิบาย + เกณฑ์มาตรฐานแหล่งน้ำผิวดิน สำหรับการ์ดสรุปแต่ละพารามิเตอร์
const PARAM_INFO = {
  temperature: {
    desc: 'อุณหภูมิของน้ำ ณ วันที่เก็บตัวอย่าง',
    standard: 'ไม่มีเกณฑ์มาตรฐานตายตัว (ใช้ดูแนวโน้มตามฤดูกาล)',
    evaluate: () => null
  },
  pH: {
    desc: 'ความเป็นกรด-ด่างของน้ำ',
    standard: 'มาตรฐานแหล่งน้ำผิวดินทุกประเภท: 5 – 9',
    evaluate: (v) => (v == null ? null : v >= 5 && v <= 9 ? 'ผ่านเกณฑ์' : 'เกินเกณฑ์')
  },
  tss: {
    desc: 'ปริมาณของแข็งแขวนลอย/ตะกอนในน้ำ ยิ่งสูงยิ่งขุ่น',
    standard: 'ไม่มีเกณฑ์มาตรฐานตายตัว (ใช้ดูแนวโน้ม)',
    evaluate: () => null
  },
  ec: {
    desc: 'บ่งชี้ปริมาณแร่ธาตุ/เกลือที่ละลายในน้ำ',
    standard: 'ไม่มีเกณฑ์มาตรฐานตายตัว (ใช้ดูแนวโน้ม)',
    evaluate: () => null
  },
  dissolvedOxygen: {
    desc: 'ออกซิเจนละลายในน้ำ สำคัญต่อสิ่งมีชีวิตในน้ำ',
    standard: 'ขั้นต่ำ: ≥6 (ประเภท 2) / ≥4 (ประเภท 3) / ≥2 mg/L (ประเภท 4)',
    evaluate: (v) => (v == null ? null : v >= 6 ? 'ผ่านเกณฑ์ (ประเภท 2)' : v >= 4 ? 'ผ่านเกณฑ์ (ประเภท 3)' : v >= 2 ? 'ผ่านเกณฑ์ (ประเภท 4)' : 'ต่ำกว่าเกณฑ์')
  },
  arsenic: {
    desc: 'โลหะหนักที่เป็นพิษ มักปนมากับตะกอนช่วงน้ำหลาก',
    standard: 'มาตรฐานแหล่งน้ำผิวดินทุกประเภท: ≤ 0.01 mg/L',
    evaluate: (v) => (v == null ? null : v <= 0.01 ? 'ผ่านเกณฑ์' : 'เกินเกณฑ์')
  }
};

function ParamStatusChip({ paramKey, value }) {
  const status = PARAM_INFO[paramKey]?.evaluate(value);
  if (!status) return null;
  const color = status.startsWith('ผ่าน') ? 'success' : status === 'ต่ำกว่าเกณฑ์' ? 'warning' : 'error';
  return <Chip label={status} color={color} size="small" sx={{ mt: 0.5 }} />;
}

function getWaterbodyStyle(name) {
  return WATERBODY_STYLE[name] || { key: 'other', color: '#9e9e9e' };
}

// Get status color
function getStatusColor(status) {
  switch (status) {
    case 'excellent':
    case 'good':
      return 'success';
    case 'fair':
      return 'warning';
    case 'poor':
      return 'error';
    default:
      return 'default';
  }
}

// Get status label
function getStatusLabel(status) {
  switch (status) {
    case 'excellent':
      return 'ดีมาก';
    case 'good':
      return 'ดี';
    case 'fair':
      return 'พอใช้';
    case 'poor':
      return 'ควรเฝ้าระวัง';
    default:
      return 'ไม่ทราบ';
  }
}

export default function WaterQualityDataPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('all'); // 6m, 1y, 2y, all
  const [waterbody, setWaterbody] = useState('all');
  const [showTable, setShowTable] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const uploadTimerRef = useRef(null);

  useEffect(() => {
    fetchWaterQualityData();
    return () => {
      if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current);
    };
  }, []);

  const fetchWaterQualityData = async () => {
    try {
      setLoading(true);
      setError(null);

      const q = query(
        collection(db, 'waterQuality'),
        firestoreOrderBy('measuredDate', 'desc'),
        firestoreLimit(500)
      );

      const querySnapshot = await getDocs(q);
      const data = [];

      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        if (!docData.measuredDate) return;
        // ข้ามข้อมูล mock เก่าที่ไม่มี waterbody ตรงกับสถานี จ.เลย (แม่น้ำโขง/แม่น้ำเลย)
        if (!KNOWN_WATERBODIES.includes(docData.waterbody)) return;
        data.push({
          id: doc.id,
          waterbody: docData.waterbody,
          stationName: docData.stationName || '',
          province: docData.province || '',
          district: docData.district || '',
          temperature: docData.temperature ?? null,
          pH: docData.pH ?? null,
          tss: docData.tss ?? null,
          ec: docData.ec ?? null,
          dissolvedOxygen: docData.dissolvedOxygen ?? null,
          arsenic: docData.arsenic ?? null,
          status: docData.status || 'unknown',
          measuredDate: docData.measuredDate?.toDate ? docData.measuredDate.toDate() : new Date(docData.measuredDate)
        });
      });

      // เรียงตามวันที่จากเก่าไปใหม่ สำหรับกราฟ
      data.sort((a, b) => a.measuredDate - b.measuredDate);

      setRecords(data);
    } catch (err) {
      console.error('Error fetching water quality data:', err);
      setError('ไม่สามารถโหลดข้อมูลคุณภาพน้ำได้ ตรวจสอบว่านำเข้าข้อมูลลง collection "waterQuality" แล้วหรือยัง');
    } finally {
      setLoading(false);
    }
  };

  const waterbodyOptions = useMemo(() => {
    const set = new Set(records.map((r) => r.waterbody).filter(Boolean));
    return Array.from(set);
  }, [records]);

  const filterByTimeRange = (data, range) => {
    if (range === 'all') return data;
    const now = new Date();
    let cutoffDate;
    switch (range) {
      case '6m':
        cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case '2y':
        cutoffDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
        break;
      default:
        return data;
    }
    return data.filter((item) => item.measuredDate >= cutoffDate);
  };

  const filteredData = useMemo(() => {
    let data = records;
    if (waterbody !== 'all') {
      data = data.filter((r) => r.waterbody === waterbody);
    }
    return filterByTimeRange(data, timeRange);
  }, [records, waterbody, timeRange]);

  const activeWaterbodies = waterbody === 'all' ? waterbodyOptions : [waterbody];

  // รวมข้อมูลตามวันที่ แยกคอลัมน์ตาม waterbody เพื่อวาดกราฟเปรียบเทียบได้
  const chartData = useMemo(() => {
    const dateMap = new Map();
    filteredData.forEach((item) => {
      const dateStr = format(item.measuredDate, 'dd/MM/yy', { locale: th });
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, timestamp: item.measuredDate });
      }
      const entry = dateMap.get(dateStr);
      const { key } = getWaterbodyStyle(item.waterbody);
      entry[`temperature_${key}`] = item.temperature;
      entry[`pH_${key}`] = item.pH;
      entry[`tss_${key}`] = item.tss;
      entry[`ec_${key}`] = item.ec;
      entry[`dissolvedOxygen_${key}`] = item.dissolvedOxygen;
      entry[`arsenic_${key}`] = item.arsenic;
    });
    return Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredData]);

  const latestData = filteredData.length > 0 ? filteredData[filteredData.length - 1] : null;

  const exportToCSV = () => {
    const headers = ['วันที่', 'แหล่งน้ำ', 'อุณหภูมิ (°C)', 'pH', 'TSS (mg/L)', 'EC (µS/cm)', 'DO (mg/L)', 'สารหนู (mg/L)', 'สถานะ'];
    const rows = filteredData.map((item) => [
      format(item.measuredDate, 'dd/MM/yyyy', { locale: th }),
      item.waterbody,
      item.temperature ?? '',
      item.pH ?? '',
      item.tss ?? '',
      item.ec ?? '',
      item.dissolvedOxygen ?? '',
      item.arsenic ?? '',
      getStatusLabel(item.status)
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `water_quality_loei_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    link.click();
  };

  // Handle CSV file upload
  // รูปแบบคอลัมน์: วันที่(YYYY-MM-DD), แหล่งน้ำ, สถานี, จังหวัด, อำเภอ, อุณหภูมิ, pH, TSS, EC, DO, สารหนู
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress('กำลังอ่านไฟล์...');

    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());
      const dataLines = lines.slice(1); // skip header

      setUploadProgress(`พบข้อมูล ${dataLines.length} รายการ กำลังประมวลผล...`);

      let successCount = 0;
      let errorCount = 0;
      let createdCount = 0;
      let updatedCount = 0;

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;

        const columns = line.split(',').map((c) => c.trim());
        if (columns.length < 11) {
          console.warn(`Skip invalid line ${i + 2}:`, line);
          errorCount++;
          continue;
        }

        const [dateStr, wb, stationName, province, district, tempStr, phStr, tssStr, ecStr, doStr, asStr] = columns;

        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !wb) {
          console.warn(`Skip invalid data at line ${i + 2}:`, { dateStr, wb });
          errorCount++;
          continue;
        }

        const toNum = (v) => (v === '' || v === undefined ? null : parseFloat(v));
        const temperature = toNum(tempStr);
        const pH = toNum(phStr);
        const tss = toNum(tssStr);
        const ec = toNum(ecStr);
        const dissolvedOxygen = toNum(doStr);
        const arsenic = toNum(asStr);

        const status = (temperature != null && pH != null && dissolvedOxygen != null)
          ? evaluateWaterQuality(temperature, pH, dissolvedOxygen)
          : 'unknown';

        const waterQualityData = {
          date: dateStr, // ใช้สำหรับตรวจสอบข้อมูลซ้ำ
          stationId: STATION_ID_MAP[wb] || wb, // firestore.rules ต้องการฟิลด์นี้ตอน create
          waterbody: wb,
          stationName: stationName || '',
          province: province || '',
          district: district || '',
          temperature,
          pH,
          tss,
          ec,
          dissolvedOxygen,
          arsenic,
          measuredDate: Timestamp.fromDate(new Date(dateStr)),
          status,
          updatedAt: Timestamp.now()
        };

        try {
          const waterQualityRef = collection(db, 'waterQuality');
          const q = query(
            waterQualityRef,
            where('date', '==', dateStr),
            where('waterbody', '==', wb),
            firestoreLimit(1)
          );
          const existingSnapshot = await getDocs(q);

          if (!existingSnapshot.empty) {
            const existingDoc = existingSnapshot.docs[0];
            await updateDoc(doc(db, 'waterQuality', existingDoc.id), waterQualityData);
            updatedCount++;
          } else {
            waterQualityData.createdBy = 'csv-import';
            waterQualityData.createdAt = Timestamp.now();
            await addDoc(waterQualityRef, waterQualityData);
            createdCount++;
          }

          successCount++;
          setUploadProgress(`กำลังประมวลผล... (${successCount}/${dataLines.length} - สร้างใหม่: ${createdCount}, อัปเดต: ${updatedCount})`);
        } catch (err) {
          console.error(`Error saving row ${i + 2}:`, err);
          errorCount++;
        }
      }

      const resultMessage = [
        'เสร็จสิ้น!',
        `สร้างใหม่: ${createdCount} รายการ`,
        `อัปเดต: ${updatedCount} รายการ`,
        errorCount > 0 ? `ข้อผิดพลาด: ${errorCount} รายการ` : null
      ].filter(Boolean).join(' | ');

      setUploadProgress(resultMessage);

      await fetchWaterQualityData();

      uploadTimerRef.current = setTimeout(() => {
        setUploadDialogOpen(false);
        setUploading(false);
        setUploadProgress('');
      }, 2000);
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setUploadProgress(`เกิดข้อผิดพลาด: ${err.message}`);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="ข้อมูลคุณภาพน้ำ">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="ข้อมูลคุณภาพน้ำ">
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              📊 กราฟคุณภาพน้ำ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ข้อมูลการติดตามตรวจสอบคุณภาพน้ำ จ.เลย (แม่น้ำโขง - แม่น้ำเลย ที่ อ.เชียงคาน)
            </Typography>
            {latestData && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                ล่าสุด: {format(latestData.measuredDate, 'dd/MM/yyyy', { locale: th })} ({latestData.waterbody})
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>แหล่งน้ำ</InputLabel>
              <Select
                value={waterbody}
                label="แหล่งน้ำ"
                onChange={(e) => setWaterbody(e.target.value)}
              >
                <MenuItem value="all">ทั้งหมด</MenuItem>
                {waterbodyOptions.map((wb) => (
                  <MenuItem key={wb} value={wb}>{wb}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel>ช่วงเวลา</InputLabel>
              <Select
                value={timeRange}
                label="ช่วงเวลา"
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="6m">6 เดือนล่าสุด</MenuItem>
                <MenuItem value="1y">1 ปีล่าสุด</MenuItem>
                <MenuItem value="2y">2 ปีล่าสุด</MenuItem>
                <MenuItem value="all">ทั้งหมด</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<Upload />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Import CSV
            </Button>

            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={exportToCSV}
              disabled={filteredData.length === 0}
            >
              Export CSV
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!error && records.length === 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            ยังไม่มีข้อมูลใน collection &quot;waterQuality&quot; กรุณารันสคริปต์นำเข้าข้อมูลก่อน (import-loei-water-quality.js)
          </Alert>
        )}

        {/* Summary Cards */}
        {latestData && (
          <>
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                ค่าล่าสุดที่ตรวจวัดได้
              </Typography>
              <Typography variant="body2" color="text.secondary">
                จากการเก็บตัวอย่างวันที่ {format(latestData.measuredDate, 'dd/MM/yyyy', { locale: th })} ที่ {latestData.waterbody}
                {' '}— เป็นผลวิเคราะห์ในห้องปฏิบัติการรายเดือน/รายรอบ ไม่ใช่ข้อมูลเซนเซอร์แบบเรียลไทม์
              </Typography>
            </Box>

            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              พารามิเตอร์ทั่วไป (ไม่มีเกณฑ์มาตรฐานตายตัว)
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Thermostat color="warning" fontSize="small" />
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">อุณหภูมิ</Typography>
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="warning.main" sx={{ whiteSpace: 'nowrap' }}>
                        {latestData.temperature ?? '-'} °C
                      </Typography>
                    </Box>
                    <ParamStatusChip paramKey="temperature" value={latestData.temperature} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {PARAM_INFO.temperature.desc}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                      {PARAM_INFO.temperature.standard}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={4} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Opacity color="info" fontSize="small" />
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">TSS</Typography>
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="info.main" sx={{ whiteSpace: 'nowrap' }}>
                        {latestData.tss ?? '-'} mg/L
                      </Typography>
                    </Box>
                    <ParamStatusChip paramKey="tss" value={latestData.tss} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {PARAM_INFO.tss.desc}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                      {PARAM_INFO.tss.standard}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={4} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WaterDrop color="primary" fontSize="small" />
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">EC</Typography>
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="primary.main" sx={{ whiteSpace: 'nowrap' }}>
                        {latestData.ec ?? '-'} µS/cm
                      </Typography>
                    </Box>
                    <ParamStatusChip paramKey="ec" value={latestData.ec} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {PARAM_INFO.ec.desc}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                      {PARAM_INFO.ec.standard}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
              พารามิเตอร์ที่มีเกณฑ์มาตรฐานเปรียบเทียบ
            </Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={4} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Science color="secondary" fontSize="small" />
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">pH</Typography>
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="secondary.main" sx={{ whiteSpace: 'nowrap' }}>
                        {latestData.pH ?? '-'}
                      </Typography>
                    </Box>
                    <ParamStatusChip paramKey="pH" value={latestData.pH} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {PARAM_INFO.pH.desc}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                      {PARAM_INFO.pH.standard}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={4} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WaterDrop color="success" fontSize="small" />
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">DO</Typography>
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="success.main" sx={{ whiteSpace: 'nowrap' }}>
                        {latestData.dissolvedOxygen ?? '-'} mg/L
                      </Typography>
                    </Box>
                    <ParamStatusChip paramKey="dissolvedOxygen" value={latestData.dissolvedOxygen} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {PARAM_INFO.dissolvedOxygen.desc}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                      {PARAM_INFO.dissolvedOxygen.standard}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={4} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Biotech color="error" fontSize="small" />
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">สารหนู (As)</Typography>
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="error.main" sx={{ whiteSpace: 'nowrap' }}>
                        {latestData.arsenic ?? '-'} mg/L
                      </Typography>
                    </Box>
                    <ParamStatusChip paramKey="arsenic" value={latestData.arsenic} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {PARAM_INFO.arsenic.desc}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                      {PARAM_INFO.arsenic.standard}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}

        {chartData.length > 0 && (
          <>
            {/* Temperature & DO */}
            <Paper sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>อุณหภูมิ และ ออกซิเจนละลาย (DO)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                เส้นประแดง = เกณฑ์มาตรฐาน DO ขั้นต่ำ ประเภทที่ 2 (≥ 6 mg/L)
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={70} style={{ fontSize: '12px' }} />
                  <YAxis yAxisId="left" label={{ value: 'อุณหภูมิ (°C)', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'DO (mg/L)', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine yAxisId="right" y={6} stroke="#f44336" strokeDasharray="5 5" />
                  {activeWaterbodies.map((wb) => {
                    const { key, color } = getWaterbodyStyle(wb);
                    return (
                      <Line key={`temp-${key}`} yAxisId="left" type="monotone" dataKey={`temperature_${key}`}
                        stroke={color} strokeWidth={2} dot={{ r: 3 }} name={`อุณหภูมิ - ${wb}`} connectNulls />
                    );
                  })}
                  {activeWaterbodies.map((wb) => {
                    const { key, color } = getWaterbodyStyle(wb);
                    return (
                      <Line key={`do-${key}`} yAxisId="right" type="monotone" dataKey={`dissolvedOxygen_${key}`}
                        stroke={color} strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} name={`DO - ${wb}`} connectNulls />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            {/* pH */}
            <Paper sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>ค่าความเป็นกรด-ด่าง (pH)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                เส้นประแดง = เกณฑ์มาตรฐานแหล่งน้ำผิวดิน (5 - 9)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={70} style={{ fontSize: '12px' }} />
                  <YAxis domain={[0, 14]} label={{ value: 'pH', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={5} stroke="#f44336" strokeDasharray="5 5" />
                  <ReferenceLine y={9} stroke="#f44336" strokeDasharray="5 5" />
                  {activeWaterbodies.map((wb) => {
                    const { key, color } = getWaterbodyStyle(wb);
                    return (
                      <Line key={`ph-${key}`} type="monotone" dataKey={`pH_${key}`}
                        stroke={color} strokeWidth={2} dot={{ r: 3 }} name={`pH - ${wb}`} connectNulls />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            {/* TSS & EC */}
            <Paper sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>ของแข็งแขวนลอย (TSS) และ สภาพการนำไฟฟ้า (EC)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                TSS และ EC ไม่มีเกณฑ์มาตรฐานตายตัวในมาตรฐานแหล่งน้ำผิวดิน แสดงเพื่อดูแนวโน้ม
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={70} style={{ fontSize: '12px' }} />
                  <YAxis yAxisId="left" label={{ value: 'TSS (mg/L)', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'EC (µS/cm)', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  {activeWaterbodies.map((wb) => {
                    const { key, color } = getWaterbodyStyle(wb);
                    return (
                      <Line key={`tss-${key}`} yAxisId="left" type="monotone" dataKey={`tss_${key}`}
                        stroke={color} strokeWidth={2} dot={{ r: 3 }} name={`TSS - ${wb}`} connectNulls />
                    );
                  })}
                  {activeWaterbodies.map((wb) => {
                    const { key, color } = getWaterbodyStyle(wb);
                    return (
                      <Line key={`ec-${key}`} yAxisId="right" type="monotone" dataKey={`ec_${key}`}
                        stroke={color} strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} name={`EC - ${wb}`} connectNulls />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            {/* Arsenic */}
            <Paper sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>สารหนู (Arsenic, As)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                เส้นประแดง = เกณฑ์มาตรฐานแหล่งน้ำผิวดินทุกประเภท (≤ 0.01 mg/L)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={70} style={{ fontSize: '12px' }} />
                  <YAxis label={{ value: 'สารหนู (mg/L)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={0.01} stroke="#f44336" strokeDasharray="5 5" />
                  {activeWaterbodies.map((wb) => {
                    const { key, color } = getWaterbodyStyle(wb);
                    return (
                      <Line key={`as-${key}`} type="monotone" dataKey={`arsenic_${key}`}
                        stroke={color} strokeWidth={2} dot={{ r: 3 }} name={`สารหนู - ${wb}`} connectNulls />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </>
        )}

        {chartData.length === 0 && records.length > 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>ไม่มีข้อมูลในช่วงเวลา/แหล่งน้ำที่เลือก</Alert>
        )}

        {/* Data Table with Toggle Button */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">ตารางข้อมูลดิบ</Typography>
            <Button
              variant={showTable ? 'contained' : 'outlined'}
              startIcon={<TableChart />}
              endIcon={showTable ? <ExpandLess /> : <ExpandMore />}
              onClick={() => setShowTable(!showTable)}
            >
              {showTable ? 'ซ่อนตาราง' : 'แสดงตาราง'}
            </Button>
          </Box>

          {showTable && (
            <>
              {filteredData.length > 0 ? (
                <TableContainer sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>วันที่</strong></TableCell>
                        <TableCell><strong>แหล่งน้ำ</strong></TableCell>
                        <TableCell align="right"><strong>อุณหภูมิ (°C)</strong></TableCell>
                        <TableCell align="right"><strong>pH</strong></TableCell>
                        <TableCell align="right"><strong>TSS (mg/L)</strong></TableCell>
                        <TableCell align="right"><strong>EC (µS/cm)</strong></TableCell>
                        <TableCell align="right"><strong>DO (mg/L)</strong></TableCell>
                        <TableCell align="right"><strong>สารหนู (mg/L)</strong></TableCell>
                        <TableCell><strong>สถานะ</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredData.slice().reverse().slice(0, 100).map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{format(row.measuredDate, 'dd/MM/yyyy', { locale: th })}</TableCell>
                          <TableCell>{row.waterbody}</TableCell>
                          <TableCell align="right">{row.temperature ?? '-'}</TableCell>
                          <TableCell align="right">{row.pH ?? '-'}</TableCell>
                          <TableCell align="right">{row.tss ?? '-'}</TableCell>
                          <TableCell align="right">{row.ec ?? '-'}</TableCell>
                          <TableCell align="right">{row.dissolvedOxygen ?? '-'}</TableCell>
                          <TableCell align="right">{row.arsenic ?? '-'}</TableCell>
                          <TableCell>
                            <Chip label={getStatusLabel(row.status)} color={getStatusColor(row.status)} size="small" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">ไม่มีข้อมูลในช่วงเวลาที่เลือก</Alert>
              )}

              {filteredData.length > 100 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
                  แสดง 100 รายการล่าสุด จากทั้งหมด {filteredData.length} รายการ
                </Typography>
              )}
            </>
          )}
        </Paper>

        {/* Upload CSV Dialog */}
        <Dialog
          open={uploadDialogOpen}
          onClose={() => !uploading && setUploadDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight="bold">
              Import ข้อมูลคุณภาพน้ำจาก CSV
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>รูปแบบไฟล์ CSV (มีหัวตาราง 1 บรรทัด):</strong>
                </Typography>
                <Typography variant="body2" component="div">
                  วันที่ (YYYY-MM-DD), แหล่งน้ำ, สถานี, จังหวัด, อำเภอ, อุณหภูมิ(°C), pH, TSS(mg/L), EC(µS/cm), DO(mg/L), สารหนู(mg/L)
                </Typography>
                <Typography variant="body2" component="div" sx={{ mt: 1 }}>
                  • ตัวอย่าง: 2024-01-15,แม่น้ำโขง,แม่น้ำโขง ที่ อ. เชียงคาน จ. เลย,เลย,เชียงคาน,24.0,8.28,7.0,278.0,7.6,0.0012
                </Typography>
                <Typography variant="body2" component="div" sx={{ mt: 2 }} color="success.main">
                  <strong>✓ ระบบจะตรวจสอบข้อมูลซ้ำอัตโนมัติ:</strong> หากมีข้อมูลวันที่และแหล่งน้ำเดียวกันอยู่แล้ว จะทำการอัปเดตข้อมูลเดิม ไม่สร้างข้อมูลซ้ำ
                </Typography>
              </Alert>

              <input
                accept=".csv"
                style={{ display: 'none' }}
                id="water-quality-csv-upload-input"
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <label htmlFor="water-quality-csv-upload-input">
                <Button
                  variant="contained"
                  component="span"
                  fullWidth
                  startIcon={<Upload />}
                  disabled={uploading}
                  sx={{ mb: 2 }}
                >
                  {uploading ? 'กำลังอัปโหลด...' : 'เลือกไฟล์ CSV'}
                </Button>
              </label>

              {uploadProgress && (
                <Alert severity={uploadProgress.includes('เสร็จสิ้น') ? 'success' : 'info'} sx={{ mt: 2 }}>
                  {uploadProgress}
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploading}
            >
              {uploadProgress.includes('เสร็จสิ้น') ? 'ปิด' : 'ยกเลิก'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}

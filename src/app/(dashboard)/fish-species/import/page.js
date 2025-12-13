'use client';

import { useState } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function ImportFishDataPage() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [fishData, setFishData] = useState(null);
  const [fileLoaded, setFileLoaded] = useState(false);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date() }]);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setFishData(data);
        setFileLoaded(true);
        addLog(`โหลดไฟล์สำเร็จ: พบข้อมูลปลา ${data.length} ชนิด`, 'success');
      } catch (error) {
        addLog(`Error: ไม่สามารถอ่านไฟล์ JSON ได้ - ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const importData = async () => {
    if (!fishData) {
      addLog('กรุณาอัพโหลดไฟล์ JSON ก่อน', 'error');
      return;
    }

    setImporting(true);
    setProgress(0);
    setLogs([]);
    setSummary(null);

    addLog('เริ่มต้น import ข้อมูลปลา...');

    const speciesData = fishData;
    let successCount = 0;
    let errorCount = 0;

    addLog(`พบข้อมูลปลาทั้งหมด ${speciesData.length} ชนิด`);

    for (let i = 0; i < speciesData.length; i++) {
      const species = speciesData[i];

      try {
        const docData = {
          // เก็บข้อมูลทั้งแบบเดิมและแบบใหม่เพื่อความเข้ากันได้
          thai_name: species.common_name_thai,
          common_name_thai: species.common_name_thai,
          local_name: species.local_name,
          scientific_name: species.scientific_name,
          iucn_status: species.iucn_status,
          key_characteristics: species.key_characteristics,
          family_thai: species.family_thai,
          family_english: species.family_english,
          group: species.family_thai, // เก็บ family_thai ไว้ใน group ด้วยเพื่อใช้กับ filter
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin',
          importedFrom: 'uploaded-json-file'
        };

        const docId = species.scientific_name.replace(/\s+/g, '_').toLowerCase();

        await setDoc(doc(db, 'fish_species', docId), docData);

        successCount++;
        if (i % 10 === 0) {  // แสดง log ทุก 10 รายการ
          addLog(`Import ${i + 1}/${speciesData.length}: ${species.common_name_thai}`, 'success');
        }

      } catch (error) {
        errorCount++;
        addLog(`Error: ${species.common_name_thai} - ${error.message}`, 'error');
      }

      setProgress(((i + 1) / speciesData.length) * 100);
    }

    setSummary({
      total: speciesData.length,
      success: successCount,
      error: errorCount
    });

    addLog('Import เสร็จสมบูรณ์!', 'success');
    setImporting(false);
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Import ข้อมูลปลาแม่น้ำโขง
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          อัพโหลดไฟล์ JSON เพื่อนำเข้าข้อมูลปลา
        </Typography>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              1. เลือกไฟล์ JSON
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUpload />}
              >
                เลือกไฟล์
                <input
                  type="file"
                  accept=".json"
                  hidden
                  onChange={handleFileUpload}
                />
              </Button>
            </Box>

            {fileLoaded && fishData && (
              <Box sx={{ mb: 2 }}>
                <Chip label={`พบข้อมูล: ${fishData.length} ชนิด`} color="success" />
              </Box>
            )}

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              2. เริ่ม Import
            </Typography>

            {!summary && (
              <Button
                variant="contained"
                size="large"
                startIcon={<CloudUpload />}
                onClick={importData}
                disabled={importing || !fileLoaded}
              >
                {importing ? 'กำลัง Import...' : 'เริ่ม Import ข้อมูล'}
              </Button>
            )}

            {importing && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                  {progress.toFixed(1)}%
                </Typography>
              </Box>
            )}

            {summary && (
              <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircle />}>
                <Typography variant="body1">
                  <strong>Import สำเร็จ!</strong>
                </Typography>
                <Typography variant="body2">
                  ทั้งหมด: {summary.total} | สำเร็จ: {summary.success} | ล้มเหลว: {summary.error}
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>

        {logs.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Logs
              </Typography>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {logs.map((log, index) => (
                  <ListItem key={index} dense>
                    <ListItemText
                      primary={log.message}
                      secondary={log.timestamp.toLocaleTimeString('th-TH')}
                      primaryTypographyProps={{
                        color: log.type === 'error' ? 'error' : log.type === 'success' ? 'success.main' : 'text.primary'
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        <Box sx={{ mt: 3 }}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>คำแนะนำ:</strong> ไฟล์ JSON ต้องมีโครงสร้างเป็น array ของ object ที่มี fields:
              common_name_thai, local_name, scientific_name, iucn_status, key_characteristics, family_thai, family_english
            </Typography>
          </Alert>
        </Box>
      </Box>
    </DashboardLayout>
  );
}

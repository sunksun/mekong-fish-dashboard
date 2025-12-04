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
import fishData from '@/fish-data-full.json';

export default function ImportFishDataPage() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date() }]);
  };

  const importData = async () => {
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
          importedFrom: 'fish-data-full.json'
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
          นำเข้าข้อมูลปลา {fishData.length} ชนิด
        </Typography>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              ข้อมูลที่จะ Import
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Chip label={`ทั้งหมด: ${fishData.length} ชนิด`} color="primary" sx={{ mr: 1 }} />
            </Box>

            {!summary && (
              <Button
                variant="contained"
                size="large"
                startIcon={<CloudUpload />}
                onClick={importData}
                disabled={importing}
                fullWidth
              >
                {importing ? 'กำลัง Import...' : 'เริ่ม Import ข้อมูล'}
              </Button>
            )}

            {importing && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  กำลังดำเนินการ... {progress.toFixed(0)}%
                </Typography>
                <LinearProgress variant="determinate" value={progress} />
              </Box>
            )}

            {summary && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body1" fontWeight="bold">
                  Import เสร็จสมบูรณ์!
                </Typography>
                <Typography variant="body2">
                  สำเร็จ: {summary.success} / ผิดพลาด: {summary.error} / ทั้งหมด: {summary.total}
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>

        {logs.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Log การ Import
              </Typography>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {logs.map((log, index) => (
                  <ListItem key={index} dense>
                    {log.type === 'success' && <CheckCircle color="success" sx={{ mr: 1, fontSize: 20 }} />}
                    {log.type === 'error' && <ErrorIcon color="error" sx={{ mr: 1, fontSize: 20 }} />}
                    <ListItemText
                      primary={log.message}
                      secondary={log.timestamp.toLocaleTimeString('th-TH')}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}
      </Box>
    </DashboardLayout>
  );
}

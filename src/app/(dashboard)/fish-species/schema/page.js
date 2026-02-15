'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Button
} from '@mui/material';
import { ArrowBack, TableChart, Download } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

export default function FishSpeciesSchemaPage() {
  const router = useRouter();
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allFields, setAllFields] = useState([]);

  useEffect(() => {
    const loadSpecies = async () => {
      try {
        setLoading(true);
        console.log('Loading fish species schema...');

        const q = query(collection(db, 'fish_species'));
        const snapshot = await getDocs(q);

        const speciesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log('Loaded fish species:', speciesData.length);

        // รวบรวมฟิลด์ทั้งหมดจากข้อมูล
        const fieldsSet = new Set();
        fieldsSet.add('id'); // เพิ่ม id เป็นฟิลด์แรก

        speciesData.forEach(item => {
          Object.keys(item).forEach(key => {
            if (key !== 'id') {
              fieldsSet.add(key);
            }
          });
        });

        const fields = Array.from(fieldsSet);
        console.log('All fields found:', fields);

        setAllFields(fields);
        setSpecies(speciesData);
      } catch (error) {
        console.error('Error loading species:', error);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadSpecies();
  }, []);

  const renderCellValue = (value, fieldName) => {
    // แสดงค่าตามประเภทข้อมูล
    if (value === null || value === undefined) {
      return <Typography variant="body2" color="text.secondary">-</Typography>;
    }

    // Array (เช่น photos)
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <Typography variant="body2" color="text.secondary">[]</Typography>;
      }

      // ถ้าเป็น photos แสดงจำนวนรูป
      if (fieldName === 'photos') {
        return (
          <Box>
            <Chip label={`${value.length} รูป`} size="small" color="info" />
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              {value[0]?.substring(0, 30)}...
            </Typography>
          </Box>
        );
      }

      return (
        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          [{value.join(', ')}]
        </Typography>
      );
    }

    // Object
    if (typeof value === 'object') {
      return (
        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {JSON.stringify(value)}
        </Typography>
      );
    }

    // Boolean
    if (typeof value === 'boolean') {
      return <Chip label={value ? 'true' : 'false'} size="small" color={value ? 'success' : 'default'} />;
    }

    // Number
    if (typeof value === 'number') {
      return <Typography variant="body2" fontWeight="medium">{value}</Typography>;
    }

    // String - ตัดให้สั้นถ้ายาวเกินไป
    const strValue = String(value);
    if (strValue.length > 100) {
      return (
        <Typography variant="body2" sx={{ maxWidth: 300 }} title={strValue}>
          {strValue.substring(0, 100)}...
        </Typography>
      );
    }

    return <Typography variant="body2">{strValue}</Typography>;
  };

  const getFieldType = (value) => {
    if (value === null || value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const convertToCSV = () => {
    if (species.length === 0 || allFields.length === 0) {
      alert('ไม่มีข้อมูลให้ Export');
      return;
    }

    // Helper function to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';

      let str = String(value);

      // Handle arrays
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        str = `[${value.join(', ')}]`;
      }

      // Handle objects
      if (typeof value === 'object' && !Array.isArray(value)) {
        str = JSON.stringify(value);
      }

      // Escape quotes and wrap in quotes if contains comma, newline, or quote
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }

      return str;
    };

    // Create CSV header
    const header = allFields.join(',');

    // Create CSV rows
    const rows = species.map(item => {
      return allFields.map(field => escapeCSV(item[field])).join(',');
    });

    // Combine header and rows
    const csv = [header, ...rows].join('\n');

    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csv;

    // Create blob and download
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `fish_species_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            onClick={() => router.back()}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              '&:hover': { opacity: 0.7 }
            }}
          >
            <ArrowBack />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              โครงสร้างข้อมูล Fish Species
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Collection: fish_species • แสดงข้อมูลทั้งหมดในรูปแบบตาราง 2 มิติ
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={convertToCSV}
            color="success"
            disabled={loading || species.length === 0}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<TableChart />}
            onClick={() => router.push('/fish-species')}
          >
            กลับไปหน้าปกติ
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Stats Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  จำนวนเอกสาร
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="primary">
                  {species.length}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  จำนวนฟิลด์ทั้งหมด
                </Typography>
                <Typography variant="h4" fontWeight="bold" color="secondary">
                  {allFields.length}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Field Types Summary */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              ฟิลด์ทั้งหมด ({allFields.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
              {allFields.map((field) => {
                // หาประเภทข้อมูลจากรายการแรกที่มีค่า
                const sampleValue = species.find(s => s[field] !== null && s[field] !== undefined)?.[field];
                const fieldType = getFieldType(sampleValue);

                let chipColor = 'default';
                if (fieldType === 'string') chipColor = 'primary';
                else if (fieldType === 'number') chipColor = 'success';
                else if (fieldType === 'boolean') chipColor = 'warning';
                else if (fieldType === 'array') chipColor = 'info';
                else if (fieldType === 'object') chipColor = 'secondary';

                return (
                  <Chip
                    key={field}
                    label={`${field} (${fieldType})`}
                    size="small"
                    color={chipColor}
                    variant="outlined"
                  />
                );
              })}
            </Box>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        fontWeight: 'bold',
                        minWidth: 50,
                        position: 'sticky',
                        left: 0,
                        zIndex: 3
                      }}
                    >
                      #
                    </TableCell>
                    {allFields.map((field) => (
                      <TableCell
                        key={field}
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'white',
                          fontWeight: 'bold',
                          minWidth: field === 'id' ? 200 : 150,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {field}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {species.map((item, index) => (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{ '&:nth-of-type(odd)': { bgcolor: 'grey.50' } }}
                    >
                      <TableCell
                        sx={{
                          fontWeight: 'bold',
                          bgcolor: index % 2 === 0 ? 'grey.100' : 'grey.200',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1
                        }}
                      >
                        {index + 1}
                      </TableCell>
                      {allFields.map((field) => (
                        <TableCell key={field} sx={{ maxWidth: 300 }}>
                          {renderCellValue(item[field], field)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>หมายเหตุ:</strong> ตารางนี้แสดงข้อมูลดิบทั้งหมดจาก Firestore collection &quot;fish_species&quot;
            คอลัมน์แรกจะติดอยู่ด้านซ้ายเมื่อเลื่อนตาราง และส่วนหัวจะติดอยู่ด้านบนเมื่อเลื่อนลง
          </Typography>
        </Alert>
      </Box>
    </DashboardLayout>
  );
}

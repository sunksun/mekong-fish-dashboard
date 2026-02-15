'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip
} from '@mui/material';
import { ArrowBack, Update, Check, Warning } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { USER_ROLES } from '@/types';

export default function MigrateFishSpeciesPage() {
  const router = useRouter();
  const { hasAnyRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);

  const canEdit = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  const migrateData = async () => {
    setLoading(true);
    setResults([]);
    setSummary(null);

    try {
      // Fetch all fish species
      const snapshot = await getDocs(collection(db, 'fish_species'));
      const allSpecies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`Found ${allSpecies.length} fish species`);

      const migrationResults = [];
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      for (const species of allSpecies) {
        try {
          // Check if already has image_url
          if (species.image_url) {
            migrationResults.push({
              id: species.id,
              name: species.thai_name || species.local_name || 'Unknown',
              status: 'skipped',
              message: 'Already has image_url'
            });
            skipped++;
            continue;
          }

          // Check if has photos array
          if (!species.photos || !Array.isArray(species.photos) || species.photos.length === 0) {
            migrationResults.push({
              id: species.id,
              name: species.thai_name || species.local_name || 'Unknown',
              status: 'skipped',
              message: 'No photos available'
            });
            skipped++;
            continue;
          }

          // Update with image_url from first photo
          const firstPhoto = species.photos[0];
          const docRef = doc(db, 'fish_species', species.id);

          await updateDoc(docRef, {
            image_url: firstPhoto
          });

          migrationResults.push({
            id: species.id,
            name: species.thai_name || species.local_name || 'Unknown',
            status: 'success',
            message: 'Added image_url successfully',
            url: firstPhoto
          });
          updated++;

        } catch (error) {
          console.error(`Error updating ${species.id}:`, error);
          migrationResults.push({
            id: species.id,
            name: species.thai_name || species.local_name || 'Unknown',
            status: 'error',
            message: error.message
          });
          errors++;
        }
      }

      setResults(migrationResults);
      setSummary({
        total: allSpecies.length,
        updated,
        skipped,
        errors
      });

    } catch (error) {
      console.error('Migration error:', error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!canEdit) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้
          </Alert>
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
              อัปเดตข้อมูล Fish Species
            </Typography>
            <Typography variant="body2" color="text.secondary">
              เพิ่มฟิลด์ image_url สำหรับ Mobile App Compatibility
            </Typography>
          </Box>
        </Box>

        {/* Info Card */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            ฟังก์ชันนี้จะทำอะไร?
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 1 }}>
            <li>ตรวจสอบปลาทุกชนิดในระบบ</li>
            <li>ถ้าไม่มีฟิลด์ <code>image_url</code> แต่มี <code>photos</code> - จะคัดลอกรูปแรกมาเป็น <code>image_url</code></li>
            <li>ถ้ามี <code>image_url</code> อยู่แล้ว - จะข้าม (skip)</li>
            <li>ถ้าไม่มีรูปเลย - จะข้าม (skip)</li>
          </Typography>
        </Alert>

        {/* Action Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Update />}
                onClick={migrateData}
                disabled={loading}
              >
                {loading ? 'กำลังอัปเดต...' : 'เริ่มอัปเดตข้อมูล'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Summary */}
        {summary && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                สรุปผลการอัปเดต
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                <Chip label={`ทั้งหมด: ${summary.total}`} color="primary" />
                <Chip label={`อัปเดตสำเร็จ: ${summary.updated}`} color="success" />
                <Chip label={`ข้าม: ${summary.skipped}`} color="default" />
                {summary.errors > 0 && (
                  <Chip label={`ข้อผิดพลาด: ${summary.errors}`} color="error" />
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <Card>
            <CardContent sx={{ p: 0 }}>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
                        #
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
                        ชื่อปลา
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
                        สถานะ
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
                        รายละเอียด
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow
                        key={result.id}
                        hover
                        sx={{ '&:nth-of-type(odd)': { bgcolor: 'grey.50' } }}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{result.name}</TableCell>
                        <TableCell>
                          {result.status === 'success' && (
                            <Chip
                              icon={<Check />}
                              label="สำเร็จ"
                              color="success"
                              size="small"
                            />
                          )}
                          {result.status === 'skipped' && (
                            <Chip label="ข้าม" color="default" size="small" />
                          )}
                          {result.status === 'error' && (
                            <Chip
                              icon={<Warning />}
                              label="ผิดพลาด"
                              color="error"
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{result.message}</Typography>
                          {result.url && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                mt: 0.5,
                                maxWidth: 400,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {result.url}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}
      </Box>
    </DashboardLayout>
  );
}

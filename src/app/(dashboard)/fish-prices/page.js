'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Avatar
} from '@mui/material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PriceChange } from '@mui/icons-material';

const RANK_COLORS = {
  1: { bg: '#FFD700', color: '#7A5900' },
  2: { bg: '#C0C0C0', color: '#4A4A4A' },
  3: { bg: '#CD7F32', color: '#fff' }
};

export default function FishPricesPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/fish-prices');
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError('ไม่สามารถโหลดข้อมูลได้');
        }
      } catch (err) {
        console.error('Error fetching fish prices:', err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <DashboardLayout>
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <PriceChange color="primary" fontSize="large" />
        <Typography variant="h5" fontWeight="bold">
          ราคาปลา (Top 30)
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        30 ชนิดปลาที่มีราคาเฉลี่ยสูงสุด จากข้อมูลการจับปลาทั้งหมด
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {error && !loading && (
        <Alert severity="error">{error}</Alert>
      )}

      {!loading && !error && data.length === 0 && (
        <Alert severity="info">ไม่พบข้อมูลราคาปลา</Alert>
      )}

      {!loading && !error && data.length > 0 && (
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold', width: 60 }}>อันดับ</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ชื่อปลา</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold', width: 80 }}>รูปภาพ</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>ราคาเฉลี่ย (บาท/กก.)</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>ราคาต่ำสุด</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>ราคาสูงสุด</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>น้ำหนักรวม (กก.)</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>จำนวนบันทึก</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row, index) => {
                const rank = index + 1;
                const rankStyle = RANK_COLORS[rank];
                return (
                  <TableRow
                    key={row.name}
                    sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <TableCell>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: 14,
                          fontWeight: 'bold',
                          bgcolor: rankStyle ? rankStyle.bg : 'grey.200',
                          color: rankStyle ? rankStyle.color : 'text.primary'
                        }}
                      >
                        {rank}
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={rank <= 3 ? 'bold' : 'normal'}>
                        {row.name}
                      </Typography>
                      {row.localName && (
                        <Typography variant="caption" color="text.secondary">
                          ({row.localName})
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.photo ? (
                        <Box
                          component="img"
                          src={row.photo}
                          alt={row.name}
                          sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1 }}
                        />
                      ) : (
                        <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: 'grey.200', color: 'grey.500', fontSize: 11 }}>
                          ไม่มีรูป
                        </Avatar>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold" color="primary">
                        {(row.avgPrice ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {(row.minPrice ?? 0).toLocaleString('th-TH')}
                    </TableCell>
                    <TableCell align="right">
                      {(row.maxPrice ?? 0).toLocaleString('th-TH')}
                    </TableCell>
                    <TableCell align="right">
                      {(row.totalWeight ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="right">
                      {(row.recordCount ?? 0).toLocaleString('th-TH')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
    </DashboardLayout>
  );
}

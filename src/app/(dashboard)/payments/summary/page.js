'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Card,
  CardContent,
  Box,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import {
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
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { USER_ROLES } from '@/types';

const MONTHS_TH = [
  { value: '01', label: 'มกราคม' },
  { value: '02', label: 'กุมภาพันธ์' },
  { value: '03', label: 'มีนาคม' },
  { value: '04', label: 'เมษายน' },
  { value: '05', label: 'พฤษภาคม' },
  { value: '06', label: 'มิถุนายน' },
  { value: '07', label: 'กรกฎาคม' },
  { value: '08', label: 'สิงหาคม' },
  { value: '09', label: 'กันยายน' },
  { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' },
  { value: '12', label: 'ธันวาคม' }
];

const PaymentSummaryPage = () => {
  const router = useRouter();
  const { hasAnyRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState([]);
  const [error, setError] = useState('');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const canManagePayments = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  useEffect(() => {
    if (!canManagePayments) {
      router.push('/dashboard');
      return;
    }

    fetchPaymentSummary();
  }, [canManagePayments, currentYear]);

  const fetchPaymentSummary = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/payments');
      const result = await response.json();

      if (result.success) {
        const payments = result.data || [];

        // สรุปข้อมูลตามเดือน
        const yearBE = currentYear + 543; // แปลงเป็น พ.ศ.
        const monthlySummary = MONTHS_TH.map((month, index) => {
          const monthValue = month.value;

          // กรองรายการจ่ายเงินตามเดือนและปี
          const monthPayments = payments.filter(payment => {
            if (!payment.paidDate) return false;

            const paidDate = new Date(payment.paidDate);
            const paymentYear = paidDate.getFullYear();
            const paymentMonth = String(paidDate.getMonth() + 1).padStart(2, '0');

            return paymentYear === currentYear && paymentMonth === monthValue;
          });

          // คำนวณจำนวนครั้งที่จ่าย (จำนวนคน)
          const uniqueFishers = new Set(monthPayments.map(p => p.userId));
          const paymentCount = uniqueFishers.size;

          // คำนวณรวมจำนวนเงิน
          const totalAmount = monthPayments.reduce((sum, payment) => {
            return sum + (payment.amount || 0);
          }, 0);

          return {
            month: `${month.label} ${yearBE}`,
            monthValue: monthValue,
            paymentCount,
            totalAmount,
            hasData: monthPayments.length > 0
          };
        });

        setSummary(monthlySummary);
      } else {
        setError('ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (error) {
      console.error('Error fetching payment summary:', error);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  // คำนวณรวมทั้งหมด
  const grandTotal = summary.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalPayments = summary.reduce((sum, item) => sum + item.paymentCount, 0);

  if (!canManagePayments) {
    return null;
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
          <Box>
            <Typography variant="h5" fontWeight="bold">
              สรุปค่าใช้จ่ายการจ่ายเงิน
            </Typography>
            <Typography variant="body2" color="text.secondary">
              สรุปรายการจ่ายเงินให้ชาวประมงรายเดือน ปี {currentYear + 543}
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Card>
          <CardContent>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Bar Chart */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                    กราฟแสดงจำนวนเงินที่จ่ายรายเดือน
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={summary}
                        margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          interval={0}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          label={{ value: 'จำนวนเงิน (บาท)', angle: -90, position: 'insideLeft' }}
                          style={{ fontSize: '12px' }}
                        />
                        <Tooltip
                          formatter={(value, name) => {
                            if (name === 'totalAmount') return [value.toLocaleString() + ' บาท', 'จำนวนเงิน'];
                            if (name === 'paymentCount') return [value + ' คน', 'จำนวนคน'];
                            return [value, name];
                          }}
                          contentStyle={{ fontSize: '14px' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
                          formatter={(value) => {
                            if (value === 'totalAmount') return 'จำนวนเงิน (บาท)';
                            if (value === 'paymentCount') return 'จำนวนคน';
                            return value;
                          }}
                        />
                        <Bar dataKey="totalAmount" radius={[8, 8, 0, 0]}>
                          {summary.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.hasData ? '#1976d2' : '#e0e0e0'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                </Box>

                {/* Summary Statistics Cards */}
                <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      flex: 1,
                      minWidth: 200,
                      p: 2,
                      backgroundColor: 'primary.light',
                      borderColor: 'primary.main'
                    }}
                  >
                    <Typography variant="body2" color="primary.contrastText" sx={{ mb: 1 }}>
                      รวมทั้งหมด
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary.contrastText">
                      {grandTotal.toLocaleString()} บาท
                    </Typography>
                    <Typography variant="body2" color="primary.contrastText" sx={{ mt: 1 }}>
                      จำนวนคน: {totalPayments} คน
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ flex: 1, minWidth: 200, p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      จำนวนเดือนที่มีการจ่าย
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary.main">
                      {summary.filter(s => s.hasData).length} / {MONTHS_TH.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      เดือน
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ flex: 1, minWidth: 200, p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      ค่าเฉลี่ยต่อเดือน
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {(grandTotal / 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      บาท
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ flex: 1, minWidth: 200, p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      ค่าเฉลี่ยต่อคน
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="info.main">
                      {totalPayments > 0
                        ? (grandTotal / totalPayments).toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : '0'
                      }
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      บาท
                    </Typography>
                  </Paper>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </DashboardLayout>
  );
};

export default PaymentSummaryPage;

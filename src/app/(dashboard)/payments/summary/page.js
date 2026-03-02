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
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem
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
  const [allPayments, setAllPayments] = useState([]);
  const [fisherChartData, setFisherChartData] = useState([]);
  const [error, setError] = useState('');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // State สำหรับเลือกเดือน (รูปแบบ "YYYY-MM")
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const canManagePayments = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  useEffect(() => {
    if (!canManagePayments) {
      router.push('/dashboard');
      return;
    }

    fetchPaymentSummary();
  }, [canManagePayments, currentYear]);

  useEffect(() => {
    // อัพเดทกราฟเมื่อเปลี่ยนเดือน
    if (allPayments.length > 0) {
      updateFisherChart();
    }
  }, [selectedMonth, allPayments]);

  const fetchPaymentSummary = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/payments');
      const result = await response.json();

      if (result.success) {
        const payments = result.data || [];
        setAllPayments(payments);
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

  // ฟังก์ชันคำนวณเดือนจาก periodStart (Timestamp)
  const getPeriodFromPayment = (payment) => {
    // ลำดับความสำคัญ: periodStart -> period
    if (payment.periodStart) {
      const date = payment.periodStart.toDate ? payment.periodStart.toDate() : new Date(payment.periodStart);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }

    // Fallback: ใช้ period ถ้ามี
    if (payment.period) {
      return payment.period;
    }

    return null;
  };

  const updateFisherChart = () => {
    // กรองรายการที่ตรงกับเดือนที่เลือก โดยใช้ periodStart
    const filteredPayments = allPayments.filter(payment => {
      const paymentPeriod = getPeriodFromPayment(payment);
      return paymentPeriod === selectedMonth;
    });

    // จัดกลุ่มตามชาวประมง (userId)
    const fisherMap = new Map();

    filteredPayments.forEach(payment => {
      const userId = payment.userId;
      const fisherName = payment.fisherName || 'ไม่ระบุชื่อ';
      const amount = payment.amount || 0;

      if (fisherMap.has(userId)) {
        const existing = fisherMap.get(userId);
        existing.totalAmount += amount;
        existing.count += 1;
      } else {
        fisherMap.set(userId, {
          userId,
          fisherName,
          totalAmount: amount,
          count: 1
        });
      }
    });

    // แปลงเป็น array สำหรับกราฟ
    const chartData = Array.from(fisherMap.values()).map(fisher => ({
      name: fisher.fisherName,
      amount: fisher.totalAmount,
      count: fisher.count
    }));

    // เรียงตามจำนวนเงินจากมากไปน้อย
    chartData.sort((a, b) => b.amount - a.amount);

    setFisherChartData(chartData);
  };

  // คำนวณสถิติของเดือนที่เลือก
  const selectedMonthPayments = allPayments.filter(p => getPeriodFromPayment(p) === selectedMonth);
  const monthlyTotal = selectedMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const uniqueFishers = new Set(selectedMonthPayments.map(p => p.userId)).size;
  const totalTransactions = selectedMonthPayments.length;
  const averagePerFisher = uniqueFishers > 0 ? monthlyTotal / uniqueFishers : 0;

  // สร้างรายการเดือนที่มีข้อมูล
  const availableMonths = Array.from(
    new Set(allPayments.map(p => getPeriodFromPayment(p)).filter(p => p))
  ).sort().reverse(); // เรียงจากใหม่ไปเก่า

  // แปลง period เป็นชื่อเดือนภาษาไทย
  const getMonthLabel = (period) => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const monthObj = MONTHS_TH.find(m => m.value === month);
    const yearBE = parseInt(year) + 543;
    return monthObj ? `${monthObj.label} ${yearBE}` : period;
  };

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
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              สรุปค่าใช้จ่ายการจ่ายเงิน
            </Typography>
            <Typography variant="body2" color="text.secondary">
              สรุปรายการจ่ายเงินให้ชาวประมงรายคน
            </Typography>
          </Box>

          {/* Month Selector */}
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>เลือกเดือน</InputLabel>
            <Select
              value={selectedMonth}
              label="เลือกเดือน"
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map((month) => (
                <MenuItem key={month} value={month}>
                  {getMonthLabel(month)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
                {/* Summary Statistics Cards */}
                <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
                      ยอดรวม ({getMonthLabel(selectedMonth)})
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary.contrastText">
                      {monthlyTotal.toLocaleString()} บาท
                    </Typography>
                    <Typography variant="body2" color="primary.contrastText" sx={{ mt: 1 }}>
                      จำนวนครั้ง: {totalTransactions} ครั้ง
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ flex: 1, minWidth: 200, p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      จำนวนชาวประมง
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {uniqueFishers} คน
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      ที่ได้รับเงินในเดือนนี้
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ flex: 1, minWidth: 200, p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      จำนวนครั้งที่จ่าย
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="info.main">
                      {totalTransactions}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      ครั้ง
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ flex: 1, minWidth: 200, p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      ค่าเฉลี่ยต่อคน
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {averagePerFisher.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      บาท
                    </Typography>
                  </Paper>
                </Box>

                {/* Bar Chart - Fisher by Fisher */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                    กราฟแสดงจำนวนเงินที่จ่ายรายคน ({getMonthLabel(selectedMonth)})
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    {fisherChartData.length === 0 ? (
                      <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography color="text.secondary">
                          ไม่มีข้อมูลการจ่ายเงินในเดือนนี้
                        </Typography>
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={fisherChartData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
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
                              if (name === 'amount') return [value.toLocaleString() + ' บาท', 'จำนวนเงิน'];
                              if (name === 'count') return [value + ' ครั้ง', 'จำนวนครั้ง'];
                              return [value, name];
                            }}
                            contentStyle={{ fontSize: '14px' }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
                            formatter={(value) => {
                              if (value === 'amount') return 'จำนวนเงิน (บาท)';
                              if (value === 'count') return 'จำนวนครั้ง';
                              return value;
                            }}
                          />
                          <Bar dataKey="amount" fill="#1976d2" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
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

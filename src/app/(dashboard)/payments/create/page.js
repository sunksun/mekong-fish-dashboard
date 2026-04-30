'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Paper,
  Chip,
  Divider,
  InputAdornment,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Grid
} from '@mui/material';
import {
  ArrowBack,
  AttachMoney,
  CheckCircle,
  Search,
  Print,
  Close
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore';

// Helper function to format date safely with Bangkok timezone
const formatDateThai = (dateString) => {
  if (!dateString) return '-';

  try {
    let date;

    // Handle Firestore Timestamp object {type: 'firestore/timestamp/1.0', seconds: ..., nanoseconds: ...}
    if (typeof dateString === 'object' && dateString.seconds !== undefined) {
      date = new Date(dateString.seconds * 1000);
    }
    // If it's a YYYY-MM-DD format (from date input), parse it as local time
    else if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // For ISO strings from Firestore
    else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Bangkok'
    });
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return '-';
  }
};

const CreatePaymentPage = () => {
  const router = useRouter();
  const { user, hasAnyRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [fishers, setFishers] = useState([]);
  const [searchFisher, setSearchFisher] = useState('');
  const [selectedFisher, setSelectedFisher] = useState(null);
  const [fisherPaymentHistory, setFisherPaymentHistory] = useState([]);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [availableRecords, setAvailableRecords] = useState([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [paymentRate, setPaymentRate] = useState('500');
  const [customRate, setCustomRate] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [openPrintDialog, setOpenPrintDialog] = useState(false);
  const [printDate, setPrintDate] = useState('');
  const [selectedPaymentHistory, setSelectedPaymentHistory] = useState(null);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [selectedPaymentRecords, setSelectedPaymentRecords] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Check permissions
  const canManagePayments = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  // Fetch fishers
  useEffect(() => {
    const fetchFishers = async () => {
      try {
        const response = await fetch('/api/users?role=fisher');
        const result = await response.json();

        if (result.success) {
          setFishers(result.data || []);
        }
      } catch (error) {
        console.error('Error fetching fishers:', error);
      }
    };

    if (canManagePayments) {
      fetchFishers();
    }
  }, [canManagePayments]);

  // Fetch available records when fisher and date range selected
  useEffect(() => {
    const fetchAvailableRecords = async () => {
      if (!selectedFisher || !periodStart || !periodEnd) {
        setAvailableRecords([]);
        setSelectedRecordIds([]);
        return;
      }

      try {
        setLoading(true);
        setError('');

        // Calculate period string for duplicate check
        const periodDate = new Date(periodStart);
        const periodString = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;

        // Check for existing payment for this fisher + period
        const existingPaymentResponse = await fetch(`/api/payments?userId=${selectedFisher.id}&period=${periodString}`);
        const existingPaymentResult = await existingPaymentResponse.json();

        if (existingPaymentResult.success && existingPaymentResult.data && existingPaymentResult.data.length > 0) {
          const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                             'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
          const monthName = monthNames[periodDate.getMonth()];
          const yearThai = periodDate.getFullYear() + 543;

          setError(`⚠️ ชาวประมงนี้ได้รับการจ่ายเงินสำหรับเดือน ${monthName} ${yearThai} แล้ว`);
          setAvailableRecords([]);
          setSelectedRecordIds([]);
          setLoading(false);
          return;
        }

        // Fetch all records for the selected fisher
        const response = await fetch(`/api/fishing-records?userId=${selectedFisher.id}&limit=1000`);
        const result = await response.json();

        if (result.success) {
          const records = result.data || [];

          // Filter for selected date range, verified, and unpaid
          const startDate = new Date(periodStart);
          const endDate = new Date(periodEnd);
          endDate.setHours(23, 59, 59, 999); // Include the entire end date

          const filtered = records.filter(record => {
            // Check if verified and not paid
            if (!record.verified || record.isPaid) {
              return false;
            }

            // Check if record date is within the selected range
            const catchDate = record.catchDate ? new Date(record.catchDate) : null;
            if (!catchDate) return false;

            return catchDate >= startDate && catchDate <= endDate;
          });

          setAvailableRecords(filtered);

          // Select all by default
          setSelectedRecordIds(filtered.map(r => r.id));
        }
      } catch (error) {
        console.error('Error fetching records:', error);
        setError('เกิดข้อผิดพลาดในการโหลดรายการจับปลา');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableRecords();
  }, [selectedFisher, periodStart, periodEnd]);

  // Handle fisher selection
  const handleSelectFisher = async (fisher) => {
    setSelectedFisher(fisher);
    setPeriodStart('');
    setPeriodEnd('');
    setAvailableRecords([]);
    setSelectedRecordIds([]);

    // Fetch payment history for this fisher
    try {
      const response = await fetch(`/api/payments?userId=${fisher.id}`);
      const result = await response.json();
      if (result.success && result.data) {
        setFisherPaymentHistory(result.data);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  };

  // Handle record selection
  const handleToggleRecord = (recordId) => {
    setSelectedRecordIds(prev => {
      if (prev.includes(recordId)) {
        return prev.filter(id => id !== recordId);
      } else {
        return [...prev, recordId];
      }
    });
  };

  const handleToggleAll = () => {
    if (selectedRecordIds.length === availableRecords.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(availableRecords.map(r => r.id));
    }
  };

  // Filter fishers
  const filteredFishers = fishers.filter(fisher => {
    if (!searchFisher) return true;
    const searchLower = searchFisher.toLowerCase();
    return (
      fisher.name?.toLowerCase().includes(searchLower) ||
      fisher.village?.toLowerCase().includes(searchLower) ||
      fisher.district?.toLowerCase().includes(searchLower)
    );
  });

  // Calculate summary
  const selectedRecords = availableRecords.filter(r => selectedRecordIds.includes(r.id));
  const finalPaymentRate = paymentRate === 'custom' ? parseFloat(customRate) || 0 : parseFloat(paymentRate);
  const totalAmount = finalPaymentRate;

  // Handle form submission
  const handleSubmit = async () => {
    // Validation
    if (!selectedFisher) {
      setError('กรุณาเลือกชาวประมง');
      return;
    }

    if (!periodStart || !periodEnd) {
      setError('กรุณาเลือกช่วงวันที่');
      return;
    }

    if (selectedRecordIds.length === 0) {
      setError('กรุณาเลือกรายการจับปลาอย่างน้อย 1 รายการ');
      return;
    }

    if (finalPaymentRate <= 0) {
      setError('กรุณาระบุอัตราการจ่ายที่ถูกต้อง');
      return;
    }

    if (!confirm(`ยืนยันการจ่ายเงินจำนวน ${totalAmount.toLocaleString()} บาท ให้ชาวประมง ${selectedFisher.name || ''} หรือไม่?`)) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Use date range from form inputs
      const periodStartDate = new Date(periodStart);
      const periodEndDate = new Date(periodEnd);

      // Generate period string for backward compatibility (use format YYYY-MM based on start date)
      const periodString = `${periodStartDate.getFullYear()}-${String(periodStartDate.getMonth() + 1).padStart(2, '0')}`;

      // Use selected payment date or current date
      const paidDateToUse = paymentDate ? new Date(paymentDate) : new Date();

      const requestBody = {
        userId: selectedFisher.id,
        fisherName: selectedFisher.name || '',
        period: periodString,
        periodStart: periodStartDate.toISOString(),
        periodEnd: periodEndDate.toISOString(),
        recordIds: selectedRecordIds,
        paymentRate: finalPaymentRate,
        paidDate: paidDateToUse.toISOString(),
        notes: notes,
        paidBy: user?.uid || '',
        paidByName: user?.displayName || user?.email || ''
      };

      console.log('📤 Creating payment directly via Firebase SDK...');

      // สร้าง payment document ใน Firestore ตรงๆ
      const paymentData = {
        userId: requestBody.userId,
        fisherName: requestBody.fisherName,
        period: requestBody.period,
        periodStart: Timestamp.fromDate(new Date(requestBody.periodStart)),
        periodEnd: Timestamp.fromDate(new Date(requestBody.periodEnd)),
        recordIds: requestBody.recordIds,
        totalRecords: requestBody.recordIds.length,
        selectedRecords: requestBody.recordIds.length,
        paymentRate: requestBody.paymentRate,
        amount: requestBody.paymentRate,
        status: 'paid',
        notes: requestBody.notes || '',
        paidBy: requestBody.paidBy,
        paidByName: requestBody.paidByName,
        paidDate: Timestamp.fromDate(new Date(requestBody.paidDate)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const paymentRef = await addDoc(collection(db, 'payments'), paymentData);
      const paymentId = paymentRef.id;
      console.log('✅ Payment created:', paymentId);

      // อัปเดต fishingRecords ที่เกี่ยวข้อง
      const batch = writeBatch(db);
      requestBody.recordIds.forEach(recordId => {
        const recordRef = doc(db, 'fishingRecords', recordId);
        batch.update(recordRef, {
          isPaid: true,
          paymentId: paymentId,
          paymentDate: Timestamp.fromDate(new Date(requestBody.paidDate)),
          paymentAmount: requestBody.paymentRate
        });
      });
      await batch.commit();
      console.log('✅ Fishing records updated');

      alert('สร้างรายการจ่ายเงินสำเร็จ');
      router.push('/payments');
    } catch (error) {
      console.error('Error creating payment:', error);
      setError('เกิดข้อผิดพลาดในการสร้างรายการจ่ายเงิน');
    } finally {
      setSubmitting(false);
    }
  };

  // Print handlers
  const handleOpenPrintView = () => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    setPrintDate(formattedDate);
    setOpenPrintDialog(true);
  };

  const handleClosePrintView = () => {
    setOpenPrintDialog(false);
  };

  const handlePrint = () => {
    window.print();
  };

  // Handle opening payment history detail
  const handleViewPaymentHistory = async (payment) => {
    try {
      setLoadingHistory(true);
      setSelectedPaymentHistory(payment);
      setSelectedPaymentRecords([]);
      setOpenHistoryDialog(true);

      // Fetch fishing records for this payment
      if (payment.recordIds && payment.recordIds.length > 0) {
        const recordPromises = payment.recordIds.map(async (recordId) => {
          try {
            const response = await fetch(`/api/fishing-records/${recordId}`);
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                return result.data;
              }
            }
          } catch (err) {
            console.error('Error fetching record:', recordId, err);
          }
          return null;
        });

        const records = await Promise.all(recordPromises);
        const validRecords = records.filter(r => r !== null);
        setSelectedPaymentRecords(validRecords);
      }
    } catch (error) {
      console.error('Error fetching payment history details:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCloseHistoryDialog = () => {
    setOpenHistoryDialog(false);
    setSelectedPaymentRecords([]);
  };

  if (!canManagePayments) {
    return (
      <DashboardLayout>
        <Alert severity="error">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/payments')}
          >
            ย้อนกลับ
          </Button>
          <Box>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              สร้างรายการจ่ายเงินใหม่
            </Typography>
            <Typography variant="body2" color="text.secondary">
              เลือกชาวประมงและรายการจับปลาที่ต้องการจ่ายเงิน
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          {/* Left Column - Form */}
          <Box sx={{ flex: { xs: '1 1 auto', md: '1 1 66.666%' } }}>
            {/* Step 1: Select Fisher */}
            {!selectedFisher ? (
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight="medium" gutterBottom>
                    ขั้นตอนที่ 1: เลือกชาวประมง
                  </Typography>

                  {/* Search */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="ค้นหาชื่อชาวประมง, หมู่บ้าน, อำเภอ..."
                    value={searchFisher}
                    onChange={(e) => setSearchFisher(e.target.value)}
                    sx={{ mb: 2 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      )
                    }}
                  />

                  {/* Fisher List */}
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>ลำดับ</TableCell>
                          <TableCell>ชื่อ-นามสกุล</TableCell>
                          <TableCell>หมู่บ้าน</TableCell>
                          <TableCell>อำเภอ</TableCell>
                          <TableCell>จังหวัด</TableCell>
                          <TableCell align="center">เลือก</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredFishers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center">
                              ไม่พบข้อมูลชาวประมง
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredFishers.map((fisher, index) => (
                            <TableRow
                              key={fisher.id}
                              hover
                              sx={{ cursor: 'pointer' }}
                              onClick={() => handleSelectFisher(fisher)}
                            >
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {fisher.name || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>{fisher.village || '-'}</TableCell>
                              <TableCell>{fisher.district || '-'}</TableCell>
                              <TableCell>{fisher.province || '-'}</TableCell>
                              <TableCell align="center">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectFisher(fisher);
                                  }}
                                >
                                  เลือก
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  {/* Selected Fisher Info */}
                  <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        ชาวประมงที่เลือก
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {selectedFisher.name} ({selectedFisher.village || '-'})
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      onClick={() => {
                        setSelectedFisher(null);
                        setPeriodStart('');
                        setPeriodEnd('');
                        setAvailableRecords([]);
                        setSelectedRecordIds([]);
                      }}
                    >
                      เปลี่ยน
                    </Button>
                  </Box>

                  {/* Payment History */}
                  {fisherPaymentHistory.length > 0 && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight="medium" gutterBottom>
                        ประวัติการจ่ายเงิน:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {fisherPaymentHistory.slice(0, 6).map((payment) => {
                          const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                                             'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                          const [year, month] = payment.period.split('-');
                          const monthName = monthNames[parseInt(month) - 1];
                          const yearThai = parseInt(year) + 543;
                          return (
                            <Chip
                              key={payment.id}
                              label={`${monthName} ${yearThai}`}
                              size="small"
                              color="success"
                              variant="outlined"
                              onClick={() => handleViewPaymentHistory(payment)}
                              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'success.lighter' } }}
                            />
                          );
                        })}
                        {fisherPaymentHistory.length > 6 && (
                          <Chip
                            label={`+${fisherPaymentHistory.length - 6} เดือน`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  )}

                  <Divider sx={{ my: 3 }} />

                  {/* Step 2: Select Date Range */}
                  <Typography variant="h6" fontWeight="medium" gutterBottom>
                    ขั้นตอนที่ 2: เลือกช่วงวันที่
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          วันที่เริ่มต้น
                        </Typography>
                        <Box
                          component="input"
                          type="date"
                          value={periodStart}
                          onChange={(e) => setPeriodStart(e.target.value)}
                          sx={{
                            width: '100%',
                            padding: '16.5px 14px',
                            fontSize: '1rem',
                            fontFamily: 'inherit',
                            border: '1px solid rgba(0, 0, 0, 0.23)',
                            borderRadius: '4px',
                            '&:hover': {
                              borderColor: 'rgba(0, 0, 0, 0.87)',
                            },
                            '&:focus': {
                              outline: 'none',
                              borderColor: 'primary.main',
                              borderWidth: '2px',
                            }
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          เลือกวันที่เริ่มต้นของรอบการจ่าย
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          วันที่สิ้นสุด
                        </Typography>
                        <Box
                          component="input"
                          type="date"
                          value={periodEnd}
                          onChange={(e) => setPeriodEnd(e.target.value)}
                          min={periodStart}
                          sx={{
                            width: '100%',
                            padding: '16.5px 14px',
                            fontSize: '1rem',
                            fontFamily: 'inherit',
                            border: '1px solid rgba(0, 0, 0, 0.23)',
                            borderRadius: '4px',
                            '&:hover': {
                              borderColor: 'rgba(0, 0, 0, 0.87)',
                            },
                            '&:focus': {
                              outline: 'none',
                              borderColor: 'primary.main',
                              borderWidth: '2px',
                            }
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          เลือกวันที่สิ้นสุดของรอบการจ่าย
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  {/* Step 3: Available Records */}
                  {periodStart && periodEnd && (
                    <>
                      <Divider sx={{ my: 3 }} />

                      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="h6" fontWeight="medium">
                          ขั้นตอนที่ 3: เลือกรายการจับปลา
                        </Typography>
                        {availableRecords.length > 0 && (
                          <Button
                            size="small"
                            onClick={handleToggleAll}
                          >
                            {selectedRecordIds.length === availableRecords.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                          </Button>
                        )}
                      </Box>

                      {loading ? (
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                          <Typography color="text.secondary">กำลังโหลด...</Typography>
                        </Box>
                      ) : availableRecords.length === 0 ? (
                        <Alert severity="info">
                          ไม่พบรายการจับปลาที่ยืนยันแล้วและยังไม่ได้จ่ายเงินในช่วงวันที่นี้
                        </Alert>
                      ) : (
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell padding="checkbox" />
                                <TableCell>วันที่จับ</TableCell>
                                <TableCell>สถานที่</TableCell>
                                <TableCell>ปลาที่จับได้</TableCell>
                                <TableCell align="center">สถานะ</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {availableRecords.map(record => (
                                <TableRow
                                  key={record.id}
                                  hover
                                  sx={{ cursor: 'pointer' }}
                                  onClick={() => handleToggleRecord(record.id)}
                                >
                                  <TableCell padding="checkbox">
                                    <Checkbox
                                      checked={selectedRecordIds.includes(record.id)}
                                      onChange={() => handleToggleRecord(record.id)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {formatDateThai(record.catchDate)}
                                  </TableCell>
                                  <TableCell>
                                    {record.location?.province || '-'}
                                  </TableCell>
                                  <TableCell>
                                    {record.fishData && record.fishData.length > 0
                                      ? record.fishData.slice(0, 2).map(f => f.species).join(', ') +
                                        (record.fishData.length > 2 ? ` +${record.fishData.length - 2}` : '')
                                      : '-'
                                    }
                                  </TableCell>
                                  <TableCell align="center">
                                    <Chip
                                      label="ยืนยันแล้ว"
                                      color="success"
                                      size="small"
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}

                      {selectedRecords.length > 0 && (
                        <>
                          <Divider sx={{ my: 3 }} />

                          {/* Step 4: Payment Rate */}
                          <Typography variant="h6" fontWeight="medium" gutterBottom>
                            ขั้นตอนที่ 4: เลือกอัตราการจ่าย
                          </Typography>
                          <FormControl component="fieldset">
                            <FormLabel component="legend">อัตราการจ่าย (บาท)</FormLabel>
                            <RadioGroup
                              value={paymentRate}
                              onChange={(e) => setPaymentRate(e.target.value)}
                            >
                              <FormControlLabel value="400" control={<Radio />} label="400 บาท" />
                              <FormControlLabel value="500" control={<Radio />} label="500 บาท" />
                              <FormControlLabel value="600" control={<Radio />} label="600 บาท" />
                              <FormControlLabel value="700" control={<Radio />} label="700 บาท" />
                              <FormControlLabel value="custom" control={<Radio />} label="กำหนดเอง" />
                            </RadioGroup>
                          </FormControl>

                          {paymentRate === 'custom' && (
                            <TextField
                              fullWidth
                              label="จำนวนเงิน (บาท)"
                              type="number"
                              value={customRate}
                              onChange={(e) => setCustomRate(e.target.value)}
                              sx={{ mt: 2 }}
                            />
                          )}

                          <Divider sx={{ my: 3 }} />

                          {/* Payment Date */}
                          <Typography variant="h6" fontWeight="medium" gutterBottom>
                            วันที่จ่ายเงิน
                          </Typography>
                          <Box sx={{ mb: 3 }}>
                            <Box
                              component="input"
                              type="date"
                              value={paymentDate}
                              onChange={(e) => setPaymentDate(e.target.value)}
                              sx={{
                                width: '100%',
                                padding: '16.5px 14px',
                                fontSize: '1rem',
                                fontFamily: 'inherit',
                                border: '1px solid rgba(0, 0, 0, 0.23)',
                                borderRadius: '4px',
                                '&:hover': {
                                  borderColor: 'rgba(0, 0, 0, 0.87)',
                                },
                                '&:focus': {
                                  outline: 'none',
                                  borderColor: 'primary.main',
                                  borderWidth: '2px',
                                }
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              ระบุวันที่จ่ายเงินจริงให้ชาวประมง (ถ้าไม่ระบุจะใช้วันที่ปัจจุบัน)
                            </Typography>
                          </Box>

                          <Divider sx={{ my: 3 }} />

                          {/* Notes */}
                          <Typography variant="h6" fontWeight="medium" gutterBottom>
                            หมายเหตุ (ถ้ามี)
                          </Typography>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </Box>

          {/* Right Column - Summary */}
          <Box sx={{ flex: { xs: '1 1 auto', md: '1 1 33.333%' } }}>
            <Card sx={{ position: 'sticky', top: 16 }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  สรุปการจ่ายเงิน
                </Typography>
                <Divider sx={{ my: 2 }} />

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    ชาวประมง
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedFisher ? selectedFisher.name : '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    ช่วงวันที่
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {periodStart && periodEnd ? (
                      <>
                        {formatDateThai(periodStart)}
                        {' - '}
                        {formatDateThai(periodEnd)}
                      </>
                    ) : '-'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    รายการที่เลือก
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="primary.main">
                    {selectedRecords.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    จาก {availableRecords.length} รายการที่สามารถจ่ายได้
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    อัตราการจ่าย
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    {finalPaymentRate.toLocaleString()} บาท
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    ยอดเงินที่จ่าย
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="primary.main">
                    {totalAmount.toLocaleString()} บาท
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  startIcon={<Print />}
                  onClick={handleOpenPrintView}
                  disabled={selectedRecords.length === 0 || finalPaymentRate <= 0}
                  sx={{ mb: 2 }}
                >
                  พิมพ์ สรุปการจ่ายเงิน
                </Button>

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<CheckCircle />}
                  onClick={handleSubmit}
                  disabled={submitting || selectedRecords.length === 0 || finalPaymentRate <= 0}
                >
                  {submitting ? 'กำลังสร้างรายการ...' : 'สร้างรายการจ่ายเงิน'}
                </Button>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

      {/* Print Payment Summary Dialog */}
      <Dialog
        open={openPrintDialog}
        onClose={handleClosePrintView}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          สรุปการจ่ายเงิน
          <IconButton
            onClick={handleClosePrintView}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8
            }}
            className="no-print"
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            {/* Print Header */}
            <Box sx={{ mb: 3, textAlign: 'center' }}>
              <Typography variant="h5" gutterBottom fontWeight="bold">
                สรุปการจ่ายเงินชาวประมง
              </Typography>
              <Typography variant="body2" color="text.secondary">
                วันที่พิมพ์: {printDate}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Fisher Information */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight="medium" gutterBottom>
                ข้อมูลชาวประมง
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    ชื่อ-นามสกุล:
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedFisher?.name || '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    หมู่บ้าน:
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedFisher?.village || '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    อำเภอ:
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedFisher?.district || '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    จังหวัด:
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedFisher?.province || '-'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Payment Period */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight="medium" gutterBottom>
                รอบการจ่าย
              </Typography>
              <Typography variant="body1">
                {formatDateThai(periodStart)} - {formatDateThai(periodEnd)}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Selected Records Table */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight="medium" gutterBottom>
                รายการจับปลาที่ได้รับการคัดเลือก
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>ลำดับ</strong></TableCell>
                      <TableCell><strong>วันที่จับ</strong></TableCell>
                      <TableCell><strong>สถานที่</strong></TableCell>
                      <TableCell><strong>ปลาที่จับได้</strong></TableCell>
                      <TableCell align="center"><strong>สถานะ</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedRecords.map((record, index) => (
                      <TableRow key={record.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{formatDateThai(record.catchDate)}</TableCell>
                        <TableCell>{record.location?.province || '-'}</TableCell>
                        <TableCell>
                          {record.fishData && record.fishData.length > 0
                            ? record.fishData.slice(0, 3).map(f => f.species).join(', ') +
                              (record.fishData.length > 3 ? ` +${record.fishData.length - 3}` : '')
                            : '-'
                          }
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label="ยืนยันแล้ว"
                            color="success"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Payment Summary */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight="medium" gutterBottom>
                สรุปการจ่ายเงิน
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    จำนวนรายการที่เลือก:
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary.main">
                    {selectedRecords.length} รายการ
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    อัตราการจ่าย:
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    {finalPaymentRate.toLocaleString()} บาท
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Signature Section */}
            <Box sx={{ mt: 4 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{
                  borderBottom: '1px solid #000',
                  width: '200px',
                  margin: '40px auto 10px',
                  height: '60px'
                }} />
                <Typography variant="body2">
                  ({selectedFisher?.name || '..............................'})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  วันที่ ......./......./...............
                </Typography>
              </Box>
            </Box>

            {/* Notes Section */}
            {notes && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    หมายเหตุ:
                  </Typography>
                  <Typography variant="body1">
                    {notes}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions className="no-print">
          <Button onClick={handleClosePrintView}>ปิด</Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            onClick={handlePrint}
          >
            พิมพ์
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment History Detail Dialog */}
      <Dialog
        open={openHistoryDialog}
        onClose={handleCloseHistoryDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          รายละเอียดการจ่ายเงิน
          <IconButton
            onClick={handleCloseHistoryDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8
            }}
            className="no-print"
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedPaymentHistory && (
            <Box sx={{ p: 2 }}>
              {/* Print Header */}
              <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom fontWeight="bold">
                  ใบสรุปการจ่ายเงินชาวประมง
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  วันที่พิมพ์: {new Date().toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Fisher Information */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  ข้อมูลชาวประมง
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      ชื่อ-นามสกุล:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedPaymentHistory.fisherName || selectedFisher?.name || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      หมู่บ้าน:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedFisher?.village || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      อำเภอ:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedFisher?.district || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      จังหวัด:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedFisher?.province || '-'}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Payment Period */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  รอบการจ่าย
                </Typography>
                <Typography variant="body1">
                  {formatDateThai(selectedPaymentHistory.periodStart)} - {formatDateThai(selectedPaymentHistory.periodEnd)}
                </Typography>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Selected Records Table */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  รายการจับปลาที่ได้รับการคัดเลือก
                </Typography>
                {loadingHistory ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">กำลังโหลดรายการจับปลา...</Typography>
                  </Box>
                ) : selectedPaymentRecords.length === 0 ? (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    ไม่พบรายการจับปลา
                  </Alert>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>ลำดับ</strong></TableCell>
                          <TableCell><strong>วันที่จับ</strong></TableCell>
                          <TableCell><strong>สถานที่</strong></TableCell>
                          <TableCell><strong>ปลาที่จับได้</strong></TableCell>
                          <TableCell align="center"><strong>สถานะ</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedPaymentRecords.map((record, index) => {
                          // Support both fishData and fishList
                          const fishList = record.fishData || record.fishList || [];
                          const fishNames = fishList.length > 0
                            ? fishList.slice(0, 3).map(f => f.species || f.name || 'ไม่ระบุ').join(', ') +
                              (fishList.length > 3 ? ` +${fishList.length - 3}` : '')
                            : '-';

                          // Support both catchDate and date fields
                          const catchDate = record.catchDate || record.date;

                          // Support multiple location field formats
                          const location = record.location?.province ||
                                         record.location?.district ||
                                         record.location?.name ||
                                         record.province ||
                                         record.waterSource ||
                                         '-';

                          return (
                            <TableRow key={record.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{catchDate ? formatDateThai(catchDate) : '-'}</TableCell>
                              <TableCell>{location}</TableCell>
                              <TableCell>{fishNames}</TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={record.isPaid ? 'จ่ายแล้ว' : record.verified ? 'ยืนยันแล้ว' : 'รอตรวจสอบ'}
                                  color={record.isPaid ? 'success' : record.verified ? 'info' : 'warning'}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Payment Summary */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  สรุปการจ่ายเงิน
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      จำนวนรายการที่จ่าย:
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">
                      {selectedPaymentHistory.totalRecords || selectedPaymentHistory.selectedRecords || 0} รายการ
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      อัตราการจ่าย:
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="success.main">
                      {(selectedPaymentHistory.paymentRate || 0).toLocaleString()} บาท
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      ยอดเงินรวม:
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary.main">
                      {(selectedPaymentHistory.amount || 0).toLocaleString()} บาท
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Payment Details */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  รายละเอียดการจ่าย
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      วันที่จ่ายเงิน:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatDateThai(selectedPaymentHistory.paidDate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      ผู้จ่ายเงิน:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedPaymentHistory.paidByName || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      สถานะ:
                    </Typography>
                    <Chip
                      label={selectedPaymentHistory.status === 'paid' ? 'จ่ายแล้ว' : selectedPaymentHistory.status === 'pending' ? 'รอดำเนินการ' : 'ยกเลิก'}
                      color={selectedPaymentHistory.status === 'paid' ? 'success' : selectedPaymentHistory.status === 'pending' ? 'warning' : 'error'}
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Notes Section */}
              {selectedPaymentHistory.notes && (
                <>
                  <Divider sx={{ mb: 3 }} />
                  <Box>
                    <Typography variant="h6" fontWeight="medium" gutterBottom>
                      หมายเหตุ
                    </Typography>
                    <Typography variant="body1">
                      {selectedPaymentHistory.notes}
                    </Typography>
                  </Box>
                </>
              )}

              <Divider sx={{ my: 3 }} />

              {/* Signature Section */}
              <Box sx={{ mt: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{
                    borderBottom: '1px solid #000',
                    width: '200px',
                    margin: '40px auto 10px',
                    height: '60px'
                  }} />
                  <Typography variant="body2">
                    ({selectedPaymentHistory.fisherName || selectedFisher?.name || '..............................'})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    วันที่ ......./......./...............
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions className="no-print">
          <Button onClick={handleCloseHistoryDialog}>ปิด</Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            onClick={handlePrint}
          >
            พิมพ์
          </Button>
        </DialogActions>
      </Dialog>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the Dialog/Modal */
          body > *:not(.MuiModal-root) {
            display: none !important;
          }

          /* Hide the backdrop (dark background) */
          .MuiBackdrop-root {
            display: none !important;
          }

          /* Hide elements with no-print class */
          .no-print {
            display: none !important;
          }

          /* Make Dialog appear without modal styling */
          .MuiDialog-root {
            position: static !important;
          }

          .MuiDialog-container {
            position: static !important;
          }

          .MuiDialog-paper {
            position: static !important;
            margin: 0 !important;
            max-width: 100% !important;
            box-shadow: none !important;
          }

          /* Reduce font sizes to fit in one page */
          .MuiDialogContent-root {
            padding: 8px !important;
          }

          .MuiDialogContent-root h5 {
            font-size: 14px !important;
            margin-bottom: 8px !important;
          }

          .MuiDialogContent-root h6 {
            font-size: 11px !important;
            margin-bottom: 6px !important;
          }

          .MuiDialogContent-root .MuiTypography-body1 {
            font-size: 10px !important;
          }

          .MuiDialogContent-root .MuiTypography-body2 {
            font-size: 9px !important;
          }

          .MuiDialogContent-root .MuiTypography-caption {
            font-size: 8px !important;
          }

          /* Reduce table font sizes */
          .MuiTableCell-root {
            font-size: 9px !important;
            padding: 4px !important;
          }

          .MuiTableCell-head {
            font-weight: bold !important;
          }

          /* Reduce spacing */
          .MuiDivider-root {
            margin: 8px 0 !important;
          }

          .MuiGrid-root {
            margin-bottom: 6px !important;
          }

          /* Reduce signature section */
          .MuiDialogContent-root .MuiBox-root:last-child {
            margin-top: 12px !important;
          }

          @page {
            size: A4 portrait;
            margin: 1cm;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            font-size: 10px !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default CreatePaymentPage;

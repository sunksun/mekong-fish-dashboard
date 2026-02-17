'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import {
  Add,
  Search,
  Visibility,
  Delete,
  AttachMoney
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const PaymentsPage = () => {
  const router = useRouter();
  const { hasAnyRole } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Check permissions
  const canManagePayments = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  // Fetch payments
  const fetchPayments = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() || d.data().createdAt,
        paidDate: d.data().paidDate?.toDate?.()?.toISOString() || d.data().paidDate,
        periodStart: d.data().periodStart?.toDate?.()?.toISOString() || d.data().periodStart,
        periodEnd: d.data().periodEnd?.toDate?.()?.toISOString() || d.data().periodEnd
      }));
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManagePayments) {
      fetchPayments();
    }
  }, [canManagePayments]);

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (
        !payment.fisherName?.toLowerCase().includes(searchLower) &&
        !payment.period?.includes(searchLower)
      ) {
        return false;
      }
    }

    // Filter by month
    if (monthFilter !== 'all' && payment.period !== monthFilter) {
      return false;
    }

    // Filter by status
    if (statusFilter !== 'all' && payment.status !== statusFilter) {
      return false;
    }

    return true;
  });

  // Calculate payment sequence numbers for each fisher
  const getPaymentSequence = (payment) => {
    // Get all payments for this fisher
    const fisherPayments = payments.filter(p => p.userId === payment.userId);

    // Sort by paid date (earliest first)
    const sortedPayments = fisherPayments.sort((a, b) => {
      const dateA = a.paidDate ? new Date(a.paidDate) : new Date(0);
      const dateB = b.paidDate ? new Date(b.paidDate) : new Date(0);
      return dateA - dateB;
    });

    // Find the index of current payment
    const sequenceNumber = sortedPayments.findIndex(p => p.id === payment.id) + 1;
    return sequenceNumber;
  };

  // Calculate summary
  const summary = {
    totalPayments: filteredPayments.length,
    paidCount: filteredPayments.filter(p => p.status === 'paid').length,
    totalAmount: filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
  };

  // Handle view payment
  const handleViewPayment = (payment) => {
    setSelectedPayment(payment);
    setOpenDialog(true);
  };

  // Handle close dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPayment(null);
  };

  // Handle delete payment
  const handleDeletePayment = async () => {
    if (!selectedPayment) return;

    if (!confirm('ต้องการยกเลิกรายการจ่ายเงินนี้หรือไม่? ระบบจะคืนสถานะรายการจับปลาเป็น "ยังไม่จ่าย"')) {
      return;
    }

    try {
      setDeleteLoading(true);

      // คืนสถานะ fishingRecords ก่อน
      const recordIds = selectedPayment.recordIds || [];
      if (recordIds.length > 0) {
        const batch = writeBatch(db);
        recordIds.forEach(recordId => {
          const recordRef = doc(db, 'fishingRecords', recordId);
          batch.update(recordRef, {
            isPaid: false,
            paymentId: null,
            paymentDate: null,
            paymentAmount: null
          });
        });
        await batch.commit();
      }

      // ลบ payment document
      await deleteDoc(doc(db, 'payments', selectedPayment.id));

      alert('ยกเลิกรายการจ่ายเงินสำเร็จ');
      fetchPayments();
      handleCloseDialog();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('เกิดข้อผิดพลาดในการยกเลิกรายการจ่ายเงิน');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Get available months
  const getAvailableMonths = () => {
    const months = new Set();
    payments.forEach(p => {
      if (p.period) months.add(p.period);
    });
    return Array.from(months).sort().reverse();
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
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              จัดการการจ่ายเงิน
            </Typography>
            <Typography variant="body2" color="text.secondary">
              รายการจ่ายเงินให้ชาวประมงทั้งหมด
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => router.push('/payments/create')}
          >
            สร้างรายการจ่ายเงิน
          </Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <AttachMoney color="primary" />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {summary.totalPayments}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      รายการทั้งหมด
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <AttachMoney color="success" />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {summary.paidCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      จ่ายแล้ว
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <AttachMoney color="warning" />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {summary.totalAmount.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      จำนวนเงินรวม (บาท)
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="ค้นหาชาวประมง..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>เดือน</InputLabel>
                  <Select
                    value={monthFilter}
                    label="เดือน"
                    onChange={(e) => setMonthFilter(e.target.value)}
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    {getAvailableMonths().map(month => (
                      <MenuItem key={month} value={month}>
                        {new Date(month + '-01').toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>สถานะ</InputLabel>
                  <Select
                    value={statusFilter}
                    label="สถานะ"
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    <MenuItem value="paid">จ่ายแล้ว</MenuItem>
                    <MenuItem value="pending">รอจ่าย</MenuItem>
                    <MenuItem value="cancelled">ยกเลิก</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell align="center">ลำดับ</TableCell>
                    <TableCell>ชาวประมง</TableCell>
                    <TableCell align="center">ครั้งที่</TableCell>
                    <TableCell>ช่วงวันที่</TableCell>
                    <TableCell align="center">รายการ</TableCell>
                    <TableCell align="right">จำนวนเงิน</TableCell>
                    <TableCell align="center">สถานะ</TableCell>
                    <TableCell>วันที่จ่าย</TableCell>
                    <TableCell align="center">จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        กำลังโหลด...
                      </TableCell>
                    </TableRow>
                  ) : filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        ไม่พบข้อมูล
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment, index) => (
                      <TableRow key={payment.id} hover>
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight="medium">
                            {index + 1}
                          </Typography>
                        </TableCell>
                        <TableCell>{payment.fisherName || '-'}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`ครั้งที่ ${getPaymentSequence(payment)}`}
                            color="primary"
                            variant="outlined"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {payment.periodStart && payment.periodEnd ? (
                            <Box>
                              <Typography variant="body2">
                                {new Date(payment.periodStart).toLocaleDateString('th-TH', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  timeZone: 'Asia/Bangkok'
                                })}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                - {new Date(payment.periodEnd).toLocaleDateString('th-TH', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  timeZone: 'Asia/Bangkok'
                                })}
                              </Typography>
                            </Box>
                          ) : payment.period ? (
                            new Date(payment.period + '-01').toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'long'
                            })
                          ) : '-'}
                        </TableCell>
                        <TableCell align="center">
                          {payment.selectedRecords || payment.totalRecords || 0} รายการ
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {(payment.amount || 0).toLocaleString()} บาท
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={payment.status === 'paid' ? 'จ่ายแล้ว' : 'รอจ่าย'}
                            color={payment.status === 'paid' ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {payment.paidDate ? new Date(payment.paidDate).toLocaleDateString('th-TH') : '-'}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleViewPayment(payment)}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>รายละเอียดการจ่ายเงิน</DialogTitle>
          <DialogContent>
            {selectedPayment && (
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">ชาวประมง</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedPayment.fisherName || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">ครั้งที่</Typography>
                    <Chip
                      label={`ครั้งที่ ${getPaymentSequence(selectedPayment)}`}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">ช่วงวันที่</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedPayment.periodStart && selectedPayment.periodEnd ? (
                        <>
                          {new Date(selectedPayment.periodStart).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            timeZone: 'Asia/Bangkok'
                          })}
                          {' - '}
                          {new Date(selectedPayment.periodEnd).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            timeZone: 'Asia/Bangkok'
                          })}
                        </>
                      ) : selectedPayment.period ? (
                        new Date(selectedPayment.period + '-01').toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long'
                        })
                      ) : '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">จำนวนรายการ</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedPayment.totalRecords || 0} รายการ
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">อัตราการจ่าย</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {(selectedPayment.paymentRate || 0).toLocaleString()} บาท
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">จำนวนเงินที่จ่าย</Typography>
                    <Typography variant="body1" fontWeight="medium" color="primary.main">
                      {(selectedPayment.amount || 0).toLocaleString()} บาท
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">วันที่จ่าย</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedPayment.paidDate ? new Date(selectedPayment.paidDate).toLocaleDateString('th-TH') : '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">จ่ายโดย</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {selectedPayment.paidByName || '-'}
                    </Typography>
                  </Grid>
                  {selectedPayment.notes && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">หมายเหตุ</Typography>
                      <Typography variant="body1">
                        {selectedPayment.notes}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>ปิด</Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={handleDeletePayment}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'กำลังยกเลิก...' : 'ยกเลิกรายการจ่ายเงิน'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
};

export default PaymentsPage;

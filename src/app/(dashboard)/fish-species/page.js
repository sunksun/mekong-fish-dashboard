'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Search,
  FilterList,
  Upload
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function FishSpeciesPage() {
  const router = useRouter();
  const { hasAnyRole } = useAuth();
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterIUCN, setFilterIUCN] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState(null);

  const canEdit = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  useEffect(() => {
    const loadSpecies = async () => {
      try {
        setLoading(true);
        console.log('Loading fish species...');

        const q = query(
          collection(db, 'fish_species'),
          orderBy('thai_name', 'asc')
        );

        const snapshot = await getDocs(q);
        const speciesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('Loaded fish species:', speciesData.length);

        setSpecies(speciesData);
      } catch (error) {
        console.error('Error loading species:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSpecies();
  }, []);

  const filteredSpecies = species.filter(s => {
    const matchesSearch =
      s.thai_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.scientific_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.local_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGroup = filterGroup === 'all' || s.group === filterGroup;
    const matchesIUCN = filterIUCN === 'all' || s.iucn_status === filterIUCN;

    return matchesSearch && matchesGroup && matchesIUCN;
  });

  const uniqueGroups = [...new Set(species.map(s => s.group))].filter(Boolean);
  const uniqueIUCN = [...new Set(species.map(s => s.iucn_status))].filter(Boolean);

  const getIUCNColor = (status) => {
    switch (status) {
      case 'CR': return 'error';
      case 'EN': return 'error';
      case 'VU': return 'warning';
      case '-': return 'default';
      default:
        if (status?.includes('Alien')) return 'info';
        return 'default';
    }
  };

  const handleDelete = async () => {
    if (!selectedSpecies) return;

    try {
      await deleteDoc(doc(db, 'fish_species', selectedSpecies.id));
      setDeleteDialogOpen(false);
      setSelectedSpecies(null);
    } catch (error) {
      console.error('Error deleting species:', error);
      alert('ไม่สามารถลบข้อมูลได้');
    }
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
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              ฐานข้อมูลปลาแม่น้ำโขง
            </Typography>
            <Typography variant="body1" color="text.secondary">
              จัดการข้อมูลชนิดปลาในแม่น้ำโขง
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {canEdit && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<Upload />}
                  onClick={() => router.push('/fish-species/import')}
                >
                  Import ข้อมูล
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => router.push('/fish-species/add')}
                >
                  เพิ่มปลาใหม่
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight="bold" color="primary">
                  {species.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ชนิดปลาทั้งหมด
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight="bold" color="error">
                  {species.filter(s => ['CR', 'EN', 'VU'].includes(s.iucn_status)).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ปลาใกล้สูญพันธุ์
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="h4" fontWeight="bold" color="secondary">
                  {uniqueGroups.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  กลุ่มปลา
                </Typography>
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
                  placeholder="ค้นหาชื่อปลา (ไทย, วิทยาศาสตร์, ท้องถิ่น)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>กลุ่มปลา</InputLabel>
                  <Select
                    value={filterGroup}
                    label="กลุ่มปลา"
                    onChange={(e) => setFilterGroup(e.target.value)}
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    {uniqueGroups.map(group => (
                      <MenuItem key={group} value={group}>{group}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>สถานะ IUCN</InputLabel>
                  <Select
                    value={filterIUCN}
                    label="สถานะ IUCN"
                    onChange={(e) => setFilterIUCN(e.target.value)}
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    {uniqueIUCN.map(status => (
                      <MenuItem key={status} value={status}>{status}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Results Info */}
        {filteredSpecies.length === 0 ? (
          <Alert severity="info">
            ไม่พบข้อมูลปลาที่ตรงกับเงื่อนไขการค้นหา
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            แสดง {filteredSpecies.length} จาก {species.length} รายการ
          </Typography>
        )}

        {/* Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>ชื่อไทย</strong></TableCell>
                <TableCell><strong>ชื่อท้องถิ่น</strong></TableCell>
                <TableCell><strong>ชื่อวิทยาศาสตร์</strong></TableCell>
                <TableCell><strong>IUCN</strong></TableCell>
                <TableCell align="right"><strong>จัดการ</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSpecies.map((fish) => (
                <TableRow key={fish.id} hover>
                  <TableCell>{fish.thai_name}</TableCell>
                  <TableCell>{fish.local_name || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontStyle="italic">
                      {fish.scientific_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={fish.iucn_status}
                      size="small"
                      color={getIUCNColor(fish.iucn_status)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => router.push(`/fish-species/${fish.id}`)}
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                    {canEdit && (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/fish-species/${fish.id}/edit`)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedSpecies(fish);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>ยืนยันการลบ</DialogTitle>
          <DialogContent>
            <Typography>
              คุณต้องการลบข้อมูล <strong>{selectedSpecies?.thai_name}</strong> ({selectedSpecies?.scientific_name}) ใช่หรือไม่?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              ลบ
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}

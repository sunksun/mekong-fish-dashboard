'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  InputAdornment,
  Button,
  Snackbar,
  List,
  ListItem,
  Divider,
  Autocomplete
} from '@mui/material';
import {
  PhotoCamera,
  Phishing,
  ViewModule,
  ViewList,
  NavigateBefore,
  NavigateNext,
  Close,
  Search,
  Edit,
  Save,
  Cancel,
  ListAlt
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { USER_ROLES } from '@/types';

export default function FishVerificationPage() {
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole([USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({ total: 0, withPhoto: 0, withoutPhoto: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [photoFilter, setPhotoFilter] = useState('all');
  const [viewMode, setViewMode] = useState('card');
  const [lightbox, setLightbox] = useState({ open: false, fish: null, photoIndex: 0 });

  // Records dialog state
  const [recordsDialog, setRecordsDialog] = useState({ open: false, fishName: '', fishLocalName: '', records: [], loading: false });
  const [editingRecord, setEditingRecord] = useState(null); // { recordId, fishIndex, newName, fullFishList }
  const [saving, setSaving] = useState(false);
  const [fishSpeciesList, setFishSpeciesList] = useState([]);
  const [speciesLoaded, setSpeciesLoaded] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [recordPhotoLightbox, setRecordPhotoLightbox] = useState({ open: false, photo: null, name: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/fish-verification');
        const result = await res.json();
        if (result.success) {
          setData(result.data);
          setSummary({ total: result.total, withPhoto: result.withPhoto, withoutPhoto: result.withoutPhoto });
        } else {
          setError('ไม่สามารถโหลดข้อมูลได้');
        }
      } catch (err) {
        console.error('Error fetching fish verification data:', err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const loadFishSpecies = async () => {
    if (speciesLoaded) return;
    try {
      const q = query(collection(db, 'fish_species'), orderBy('thai_name'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFishSpeciesList(list);
      setSpeciesLoaded(true);
    } catch (err) {
      console.error('Error loading fish species:', err);
    }
  };

  const openRecordsDialog = async (fish) => {
    setRecordsDialog({ open: true, fishName: fish.name, fishLocalName: fish.localName || '', records: [], loading: true });
    await loadFishSpecies();
    try {
      const res = await fetch(`/api/fish-verification?fishName=${encodeURIComponent(fish.name)}`);
      const result = await res.json();
      if (result.success) {
        setRecordsDialog(prev => ({ ...prev, records: result.records, loading: false }));
      }
    } catch (err) {
      console.error('Error loading records:', err);
      setRecordsDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const closeRecordsDialog = () => {
    setRecordsDialog({ open: false, fishName: '', records: [], loading: false });
    setEditingRecord(null);
  };

  const startEdit = (record) => {
    setEditingRecord({
      recordId: record.recordId,
      fishIndex: record.fishIndex,
      newName: record.currentName,
      newLocalName: record.localName || '',
      fullFishList: record.fullFishList,
      fullFishData: record.fullFishData || null
    });
  };

  const cancelEdit = () => {
    setEditingRecord(null);
  };

  const saveEdit = async () => {
    if (!editingRecord || !editingRecord.newName) return;
    setSaving(true);
    try {
      const newName = editingRecord.newName;
      const newLocalName = editingRecord.newLocalName || '';

      const updatedFishList = editingRecord.fullFishList.map((fish, i) =>
        i === editingRecord.fishIndex
          ? { ...fish, name: newName, commonName: newName, localName: newLocalName }
          : fish
      );

      const patchBody = { fishList: updatedFishList };
      if (editingRecord.fullFishData && Array.isArray(editingRecord.fullFishData)) {
        patchBody.fishData = editingRecord.fullFishData.map((fish, i) =>
          i === editingRecord.fishIndex
            ? { ...fish, species: newName, localName: newLocalName }
            : fish
        );
      }

      const res = await fetch(`/api/fishing-records/${editingRecord.recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody)
      });
      if (res.ok) {
        setRecordsDialog(prev => ({
          ...prev,
          records: prev.records.map(r =>
            r.recordId === editingRecord.recordId && r.fishIndex === editingRecord.fishIndex
              ? { ...r, currentName: newName, localName: newLocalName,
                  fullFishList: updatedFishList,
                  fullFishData: patchBody.fishData || r.fullFishData }
              : r
          )
        }));
        setEditingRecord(null);
        setSnackbar({ open: true, message: 'แก้ไขชื่อปลาเรียบร้อยแล้ว', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'เกิดข้อผิดพลาดในการบันทึก', severity: 'error' });
      }
    } catch (err) {
      console.error('Error saving fish name:', err);
      setSnackbar({ open: true, message: 'เกิดข้อผิดพลาดในการบันทึก', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return data.filter(fish => {
      const term = searchTerm.toLowerCase();
      const matchSearch = !searchTerm ||
        fish.name.toLowerCase().includes(term) ||
        (fish.localName && fish.localName.toLowerCase().includes(term));
      const matchPhoto =
        photoFilter === 'all' ? true :
        photoFilter === 'with' ? fish.hasPhoto :
        !fish.hasPhoto;
      return matchSearch && matchPhoto;
    });
  }, [data, searchTerm, photoFilter]);

  const openLightbox = (fish) => {
    setLightbox({ open: true, fish, photoIndex: 0 });
  };

  const closeLightbox = () => {
    setLightbox({ open: false, fish: null, photoIndex: 0 });
  };

  const navigatePhoto = (direction) => {
    setLightbox(prev => {
      const total = prev.fish.allPhotos.length;
      const next = (prev.photoIndex + direction + total) % total;
      return { ...prev, photoIndex: next };
    });
  };

  const currentPhoto = lightbox.fish
    ? (lightbox.fish.allPhotos[lightbox.photoIndex] || lightbox.fish.photo)
    : null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <PhotoCamera color="primary" fontSize="large" />
          <Typography variant="h5" fontWeight="bold">
            ตรวจสอบรูปปลา
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          ตรวจสอบว่ารูปปลาที่ถ่ายตรงกับชื่อปลาหรือไม่ กดที่ปลาเพื่อดูรายการบันทึกและแก้ไขชื่อ
        </Typography>

        {/* Summary chips */}
        {!loading && !error && (
          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
            <Chip label={`ปลาทั้งหมด: ${summary.total} ชนิด`} color="primary" variant="outlined" />
            <Chip label={`มีรูป: ${summary.withPhoto} ชนิด`} color="success" variant="outlined" />
            <Chip label={`ไม่มีรูป: ${summary.withoutPhoto} ชนิด`} color="default" variant="outlined" />
          </Box>
        )}

        {/* Toolbar */}
        {!loading && !error && (
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="ค้นหาชื่อปลา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
            <ToggleButtonGroup
              value={photoFilter}
              exclusive
              onChange={(_, val) => val && setPhotoFilter(val)}
              size="small"
            >
              <ToggleButton value="all">ทั้งหมด ({summary.total})</ToggleButton>
              <ToggleButton value="with">มีรูป ({summary.withPhoto})</ToggleButton>
              <ToggleButton value="without">ไม่มีรูป ({summary.withoutPhoto})</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, val) => val && setViewMode(val)}
              size="small"
            >
              <ToggleButton value="card"><ViewModule fontSize="small" /></ToggleButton>
              <ToggleButton value="table"><ViewList fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {error && !loading && (
          <Alert severity="error">{error}</Alert>
        )}

        {/* Card View */}
        {!loading && !error && viewMode === 'card' && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
                lg: 'repeat(5, 1fr)'
              },
              gap: 2
            }}
          >
            {filtered.map((fish) => (
              <Card key={fish.name} elevation={2}>
                <CardActionArea onClick={() => openRecordsDialog(fish)}>
                  <Box sx={{ position: 'relative', paddingTop: '75%', bgcolor: 'grey.100' }}>
                    {fish.photo ? (
                      <Box
                        component="img"
                        src={fish.photo}
                        alt={fish.name}
                        sx={{
                          position: 'absolute',
                          top: 0, left: 0,
                          width: '100%', height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'grey.400'
                        }}
                      >
                        <Phishing sx={{ fontSize: 40 }} />
                        <Typography variant="caption">ไม่มีรูป</Typography>
                      </Box>
                    )}
                    {fish.allPhotos.length > 1 && (
                      <Chip
                        label={`${fish.allPhotos.length} รูป`}
                        size="small"
                        sx={{
                          position: 'absolute', bottom: 4, right: 4,
                          bgcolor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 10
                        }}
                      />
                    )}
                  </Box>
                  <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                    <Typography variant="body2" fontWeight="bold" noWrap>
                      {fish.name}
                    </Typography>
                    {fish.localName && (
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {fish.localName}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <Chip label={`${fish.recordCount} ครั้ง`} size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                      <ListAlt sx={{ fontSize: 14, color: 'text.secondary' }} />
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}

        {/* Table View */}
        {!loading && !error && viewMode === 'table' && (
          <TableContainer component={Paper} elevation={2}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: 60 }}>ลำดับ</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: 100 }}>รูปภาพ</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ชื่อปลา</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>จำนวนครั้งที่พบ</TableCell>
                  <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>สถานะรูป</TableCell>
                  <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((fish, index) => (
                  <TableRow key={fish.name} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {fish.photo ? (
                        <Box
                          component="img"
                          src={fish.photo}
                          alt={fish.name}
                          sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1, cursor: 'pointer' }}
                          onClick={() => openLightbox(fish)}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <Avatar variant="rounded" sx={{ width: 80, height: 80, bgcolor: 'grey.200', color: 'grey.500', fontSize: 11 }}>
                          ไม่มีรูป
                        </Avatar>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="medium">{fish.name}</Typography>
                      {fish.localName && (
                        <Typography variant="caption" color="text.secondary">({fish.localName})</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{fish.recordCount.toLocaleString('th-TH')}</TableCell>
                    <TableCell align="center">
                      {fish.hasPhoto ? (
                        <Chip label={`มีรูป (${fish.allPhotos.length})`} color="success" size="small" />
                      ) : (
                        <Chip label="ไม่มีรูป" size="small" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Button size="small" startIcon={<ListAlt />} onClick={() => openRecordsDialog(fish)}>
                        ดู Records
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!loading && !error && filtered.length === 0 && (
          <Alert severity="info">ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา</Alert>
        )}

        {/* Lightbox Dialog */}
        <Dialog open={lightbox.open} onClose={closeLightbox} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
            <Box>
              <Typography variant="h6">{lightbox.fish?.name}</Typography>
              {lightbox.fish?.localName && (
                <Typography variant="body2" color="text.secondary">ชื่อท้องถิ่น: {lightbox.fish.localName}</Typography>
              )}
            </Box>
            <IconButton onClick={closeLightbox} size="small"><Close /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2 }}>
            <Box sx={{ position: 'relative' }}>
              {currentPhoto && (
                <Box component="img" src={currentPhoto} alt={lightbox.fish?.name}
                  sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
                />
              )}
              {lightbox.fish && lightbox.fish.allPhotos.length > 1 && (
                <>
                  <IconButton onClick={() => navigatePhoto(-1)}
                    sx={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
                    <NavigateBefore />
                  </IconButton>
                  <IconButton onClick={() => navigatePhoto(1)}
                    sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
                    <NavigateNext />
                  </IconButton>
                </>
              )}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                พบในบันทึกการจับปลา {lightbox.fish?.recordCount} ครั้ง
              </Typography>
              {lightbox.fish && lightbox.fish.allPhotos.length > 1 && (
                <Typography variant="caption" color="text.secondary">
                  {lightbox.photoIndex + 1} / {lightbox.fish.allPhotos.length} รูป
                </Typography>
              )}
            </Box>
          </DialogContent>
        </Dialog>

        {/* Records Dialog */}
        <Dialog open={recordsDialog.open} onClose={closeRecordsDialog} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6">
                บันทึกการจับ: {recordsDialog.fishName}
                {recordsDialog.fishLocalName && (
                  <Typography component="span" variant="h6" color="text.secondary" fontWeight="normal">
                    {' '}({recordsDialog.fishLocalName})
                  </Typography>
                )}
              </Typography>
              {!recordsDialog.loading && (
                <Typography variant="body2" color="text.secondary">
                  พบ {recordsDialog.records.length} บันทึก
                </Typography>
              )}
            </Box>
            <IconButton onClick={closeRecordsDialog} size="small"><Close /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {recordsDialog.loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : recordsDialog.records.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info">ไม่พบบันทึก</Alert>
              </Box>
            ) : (
              <List disablePadding>
                {recordsDialog.records.map((record, idx) => {
                  const isEditing = editingRecord &&
                    editingRecord.recordId === record.recordId &&
                    editingRecord.fishIndex === record.fishIndex;

                  return (
                    <Box key={`${record.recordId}-${record.fishIndex}`}>
                      {idx > 0 && <Divider />}
                      <ListItem sx={{ py: 1.5, px: 2, alignItems: 'flex-start', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', gap: 2, width: '100%', alignItems: 'flex-start' }}>
                          {/* Photo */}
                          <Box sx={{ flexShrink: 0 }}>
                            {record.photo ? (
                              <Box component="img" src={record.photo} alt={record.currentName}
                                sx={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 1, cursor: 'zoom-in', '&:hover': { opacity: 0.85 } }}
                                onClick={() => setRecordPhotoLightbox({ open: true, photo: record.photo, name: record.currentName })}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <Avatar variant="rounded" sx={{ width: 70, height: 70, bgcolor: 'grey.200', color: 'grey.500', fontSize: 11 }}>
                                ไม่มีรูป
                              </Avatar>
                            )}
                          </Box>

                          {/* Info */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="body2" color="text.secondary">
                                {formatDate(record.catchDate)}
                              </Typography>
                              {record.fisherName && (
                                <Typography variant="body2" color="text.secondary">• {record.fisherName}</Typography>
                              )}
                              {record.location && (
                                <Typography variant="body2" color="text.secondary">• {record.location}</Typography>
                              )}
                              {record.weight && (
                                <Typography variant="body2" color="text.secondary">• {record.weight} กก.</Typography>
                              )}
                            </Box>

                            {/* Current name display or edit */}
                            {isEditing ? (
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, flexWrap: 'wrap' }}>
                                <Autocomplete
                                  size="small"
                                  options={fishSpeciesList}
                                  getOptionLabel={(opt) => typeof opt === 'string' ? opt : (opt.thai_name || '')}
                                  value={editingRecord.newName}
                                  onChange={(_, val) => {
                                    const name = typeof val === 'string' ? val : (val?.thai_name || '');
                                    const localName = typeof val === 'string' ? editingRecord.newLocalName : (val?.local_name || '');
                                    setEditingRecord(prev => ({ ...prev, newName: name, newLocalName: localName }));
                                  }}
                                  onInputChange={(_, val, reason) => {
                                    if (reason === 'input') {
                                      setEditingRecord(prev => ({ ...prev, newName: val }));
                                    }
                                  }}
                                  freeSolo
                                  sx={{ minWidth: 200 }}
                                  renderOption={(props, option) => (
                                    <li {...props} key={option.id}>
                                      {option.thai_name}
                                      {option.local_name && (
                                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                          ({option.local_name})
                                        </Typography>
                                      )}
                                    </li>
                                  )}
                                  renderInput={(params) => (
                                    <TextField {...params} label="ชื่อปลาที่ถูกต้อง" />
                                  )}
                                />
                                <Button size="small" variant="contained" startIcon={<Save />}
                                  onClick={saveEdit} disabled={saving || !editingRecord.newName}>
                                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                </Button>
                                <Button size="small" startIcon={<Cancel />} onClick={cancelEdit}>
                                  ยกเลิก
                                </Button>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <Typography variant="body1" fontWeight="medium">
                                  {record.currentName}
                                  {record.localName && (
                                    <Typography component="span" variant="body2" color="text.secondary" fontWeight="normal">
                                      {' '}({record.localName})
                                    </Typography>
                                  )}
                                </Typography>
                                {canEdit && (
                                  <IconButton size="small" onClick={() => startEdit(record)} title="แก้ไขชื่อปลา">
                                    <Edit fontSize="small" />
                                  </IconButton>
                                )}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </ListItem>
                    </Box>
                  );
                })}
              </List>
            )}
          </DialogContent>
        </Dialog>

        {/* Record Photo Lightbox */}
        <Dialog open={recordPhotoLightbox.open} onClose={() => setRecordPhotoLightbox({ open: false, photo: null, name: '' })} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
            <Typography variant="subtitle1">{recordPhotoLightbox.name}</Typography>
            <IconButton onClick={() => setRecordPhotoLightbox({ open: false, photo: null, name: '' })} size="small"><Close /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 1, bgcolor: 'grey.900', textAlign: 'center' }}>
            {recordPhotoLightbox.photo && (
              <Box component="img" src={recordPhotoLightbox.photo} alt={recordPhotoLightbox.name}
                sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}

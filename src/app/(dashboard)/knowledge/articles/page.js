'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  MenuBook,
  Category,
  CalendarToday,
  Person,
  Search
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ARTICLE_CATEGORIES = [
  'ประเพณี',
  'วัฒนธรรม',
  'แหล่งเรียนรู้',
  'ประวัติศาสตร์',
  'ภูมิปัญญาท้องถิ่น',
  'สิ่งแวดล้อม',
  'การประมง',
  'อื่นๆ'
];

export default function KnowledgeArticlesPage() {
  const { userProfile } = useAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    content: '',
    summary: '',
    tags: '',
    source: '',
    relatedLocation: ''
  });
  
  const [error, setError] = useState('');

  // Load articles from Firebase
  useEffect(() => {
    const loadArticles = async () => {
      try {
        setLoading(true);
        console.log('Loading knowledge articles...');

        const q = query(collection(db, 'knowledgeArticles'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        const articlesData = [];
        querySnapshot.forEach((doc) => {
          articlesData.push({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate()
          });
        });
        console.log('Loaded knowledge articles:', articlesData.length);

        setArticles(articlesData);
      } catch (error) {
        console.error('Error loading articles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, []);

  // Filter articles
  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || article.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('กรุณาระบุชื่อบทความ');
      return false;
    }
    if (!formData.category) {
      setError('กรุณาเลือกหมวดหมู่');
      return false;
    }
    if (!formData.content.trim()) {
      setError('กรุณาระบุเนื้อหา');
      return false;
    }
    if (!formData.summary.trim()) {
      setError('กรุณาระบุสรุปเนื้อหา');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleAddArticle = async () => {
    if (!validateForm()) return;

    try {
      const articleData = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
        authorId: userProfile.id,
        authorName: userProfile.name || userProfile.email,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'published'
      };

      await addDoc(collection(db, 'knowledgeArticles'), articleData);
      
      setAddModalOpen(false);
      setFormData({
        title: '',
        category: '',
        content: '',
        summary: '',
        tags: '',
        source: '',
        relatedLocation: ''
      });
    } catch (error) {
      console.error('Error adding article:', error);
      setError('เกิดข้อผิดพลาดในการเพิ่มบทความ');
    }
  };

  const handleEditArticle = async () => {
    if (!validateForm()) return;

    try {
      const articleData = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'knowledgeArticles', selectedArticle.id), articleData);
      
      setEditModalOpen(false);
      setSelectedArticle(null);
    } catch (error) {
      console.error('Error updating article:', error);
      setError('เกิดข้อผิดพลาดในการแก้ไขบทความ');
    }
  };

  const handleDeleteArticle = async () => {
    try {
      await deleteDoc(doc(db, 'knowledgeArticles', selectedArticle.id));
      setDeleteDialogOpen(false);
      setSelectedArticle(null);
    } catch (error) {
      console.error('Error deleting article:', error);
      setError('เกิดข้อผิดพลาดในการลบบทความ');
    }
  };

  const openEditModal = (article) => {
    setSelectedArticle(article);
    setFormData({
      title: article.title,
      category: article.category,
      content: article.content,
      summary: article.summary,
      tags: article.tags ? article.tags.join(', ') : '',
      source: article.source || '',
      relatedLocation: article.relatedLocation || ''
    });
    setEditModalOpen(true);
  };

  const openViewModal = (article) => {
    setSelectedArticle(article);
    setViewModalOpen(true);
  };

  const openDeleteDialog = (article) => {
    setSelectedArticle(article);
    setDeleteDialogOpen(true);
  };

  const ArticleFormModal = ({ open, onClose, onSubmit, title }) => (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              name="title"
              label="ชื่อบทความ"
              value={formData.title}
              onChange={handleInputChange}
              fullWidth
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>หมวดหมู่</InputLabel>
              <Select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                label="หมวดหมู่"
              >
                {ARTICLE_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              name="relatedLocation"
              label="สถานที่เกี่ยวข้อง"
              value={formData.relatedLocation}
              onChange={handleInputChange}
              fullWidth
              placeholder="เช่น นครพนม, อุบลราชธานี"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              name="summary"
              label="สรุปเนื้อหา"
              value={formData.summary}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={2}
              required
              placeholder="สรุปสั้นๆ ของบทความ"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              name="content"
              label="เนื้อหาบทความ"
              value={formData.content}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={8}
              required
              placeholder="เนื้อหาบทความเกี่ยวกับประเพณี วัฒนธรรม หรือแหล่งเรียนรู้ที่เกี่ยวข้องกับแม่น้ำโขง"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              name="tags"
              label="แท็ก"
              value={formData.tags}
              onChange={handleInputChange}
              fullWidth
              placeholder="แยกด้วยเครื่องหมายจุลภาค เช่น แม่น้ำโขง, ประเพณี, วัฒนธรรม"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              name="source"
              label="แหล่งอ้างอิง"
              value={formData.source}
              onChange={handleInputChange}
              fullWidth
              placeholder="แหล่งที่มาของข้อมูล หรือผู้ให้ข้อมูล"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button onClick={onSubmit} variant="contained">
          {title.includes('เพิ่ม') ? 'เพิ่มบทความ' : 'บันทึกการแก้ไข'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" gutterBottom fontWeight="600">
              บทความความรู้ท้องถิ่น
            </Typography>
            <Typography variant="body1" color="text.secondary">
              จัดการบทความเกี่ยวกับประเพณี วัฒนธรรม และแหล่งเรียนรู้ที่เกี่ยวข้องกับแม่น้ำโขง
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setAddModalOpen(true)}
            sx={{ height: 'fit-content' }}
          >
            เพิ่มบทความใหม่
          </Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <MenuBook sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {articles.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      บทความทั้งหมด
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Category sx={{ fontSize: 40, color: 'success.main' }} />
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {new Set(articles.map(a => a.category)).size}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      หมวดหมู่
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="ค้นหาบทความ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>กรองตามหมวดหมู่</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  label="กรองตามหมวดหมู่"
                >
                  <MenuItem value="">ทั้งหมด</MenuItem>
                  {ARTICLE_CATEGORIES.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Typography variant="body2" color="text.secondary">
                พบ {filteredArticles.length} บทความ
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Articles Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ชื่อบทความ</TableCell>
                <TableCell>หมวดหมู่</TableCell>
                <TableCell>ผู้เขียน</TableCell>
                <TableCell>วันที่สร้าง</TableCell>
                <TableCell>แท็ก</TableCell>
                <TableCell align="center">การจัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredArticles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="medium">
                        {article.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {article.summary.substring(0, 100)}
                        {article.summary.length > 100 && '...'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={article.category} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>{article.authorName}</TableCell>
                  <TableCell>
                    {article.createdAt?.toLocaleDateString('th-TH')}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {article.tags?.slice(0, 2).map((tag, index) => (
                        <Chip key={index} label={tag} size="small" variant="outlined" />
                      ))}
                      {article.tags?.length > 2 && (
                        <Chip label={`+${article.tags.length - 2}`} size="small" variant="outlined" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="ดูรายละเอียด">
                      <IconButton size="small" onClick={() => openViewModal(article)}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="แก้ไข">
                      <IconButton size="small" onClick={() => openEditModal(article)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ลบ">
                      <IconButton 
                        size="small" 
                        onClick={() => openDeleteDialog(article)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {filteredArticles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <Typography color="text.secondary">
                      ไม่พบบทความที่ตรงกับเงื่อนไขการค้นหา
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Add Article Modal */}
        <ArticleFormModal
          open={addModalOpen}
          onClose={() => {
            setAddModalOpen(false);
            setError('');
            setFormData({
              title: '',
              category: '',
              content: '',
              summary: '',
              tags: '',
              source: '',
              relatedLocation: ''
            });
          }}
          onSubmit={handleAddArticle}
          title="เพิ่มบทความใหม่"
        />

        {/* Edit Article Modal */}
        <ArticleFormModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setError('');
            setSelectedArticle(null);
          }}
          onSubmit={handleEditArticle}
          title="แก้ไขบทความ"
        />

        {/* View Article Modal */}
        <Dialog open={viewModalOpen} onClose={() => setViewModalOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <MenuBook />
              {selectedArticle?.title}
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedArticle && (
              <Box>
                <Grid container spacing={2} mb={3}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">หมวดหมู่:</Typography>
                    <Chip label={selectedArticle.category} size="small" color="primary" />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">ผู้เขียน:</Typography>
                    <Typography variant="body2">{selectedArticle.authorName}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">วันที่สร้าง:</Typography>
                    <Typography variant="body2">
                      {selectedArticle.createdAt?.toLocaleDateString('th-TH')}
                    </Typography>
                  </Grid>
                  {selectedArticle.relatedLocation && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">สถานที่เกี่ยวข้อง:</Typography>
                      <Typography variant="body2">{selectedArticle.relatedLocation}</Typography>
                    </Grid>
                  )}
                </Grid>
                
                <Typography variant="h6" gutterBottom>สรุป</Typography>
                <Typography variant="body1" paragraph>
                  {selectedArticle.summary}
                </Typography>
                
                <Typography variant="h6" gutterBottom>เนื้อหา</Typography>
                <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-line' }}>
                  {selectedArticle.content}
                </Typography>
                
                {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                  <>
                    <Typography variant="h6" gutterBottom>แท็ก</Typography>
                    <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                      {selectedArticle.tags.map((tag, index) => (
                        <Chip key={index} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </>
                )}
                
                {selectedArticle.source && (
                  <>
                    <Typography variant="h6" gutterBottom>แหล่งอ้างอิง</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedArticle.source}
                    </Typography>
                  </>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewModalOpen(false)}>ปิด</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>ยืนยันการลบบทความ</DialogTitle>
          <DialogContent>
            <Typography>
              คุณต้องการลบบทความ &quot;{selectedArticle?.title}&quot; ใช่หรือไม่?
            </Typography>
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              การดำเนินการนี้ไม่สามารถยกเลิกได้
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleDeleteArticle} color="error" variant="contained">
              ลบบทความ
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}
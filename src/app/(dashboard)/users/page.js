'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Alert,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  FormHelperText,
  CircularProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup
} from '@mui/material';
import {
  Search,
  Add,
  Edit,
  Delete,
  Visibility,
  CloudUpload,
  PhotoCamera
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { USER_ROLES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, getDocs, orderBy, query, doc, updateDoc, deleteDoc, limit, startAfter } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// ฟังก์ชันแปลง role เป็นภาษาไทย
const getRoleLabel = (role) => {
  if (!role) return 'ไม่ระบุบทบาท';

  const roleLower = role.toLowerCase().trim();
  const roleMap = {
    'admin': 'ผู้ดูแลระบบ',
    'fisher': 'ชาวประมง',
    'researcher': 'นักวิจัย',
    'government': 'หน่วยงานรัฐ',
    'community_manager': 'ผู้จัดการชุมชน'
  };

  return roleMap[roleLower] || `ไม่ระบุบทบาท (${role})`;
};

// ฟังก์ชันกำหนดสี Chip ตาม role
const getRoleColor = (role) => {
  if (!role) return 'default';

  const roleLower = role.toLowerCase().trim();
  const colorMap = {
    'admin': 'error',
    'fisher': 'primary',
    'researcher': 'secondary',
    'government': 'success',
    'community_manager': 'info'
  };

  return colorMap[roleLower] || 'default';
};

// ฟังก์ชันจัดรูปแบบเบอร์โทรศัพท์ เป็น xxx xxx xxxx
const formatPhoneNumber = (phone) => {
  if (!phone) return '-';

  // ลบช่องว่างและอักขระพิเศษทั้งหมด
  const cleaned = phone.replace(/\D/g, '');

  // จัดรูปแบบเป็น xxx xxx xxxx
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
  }

  // ถ้าไม่ใช่ 10 หลัก ให้แสดงตามเดิม
  return phone;
};

// ฟังก์ชันแปลงข้อมูลจาก Firestore เป็นรูปแบบที่ table ใช้ได้
const transformFirestoreUser = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    email: data.email || '',
    firstName: data.name ? data.name.split(' ')[0] : '',
    lastName: data.name ? data.name.split(' ').slice(1).join(' ') : '',
    name: data.name || '',
    phone: data.phone || '',
    role: data.role || '',
    location: `${data.village || ''} ${data.district || ''} ${data.province || ''}`.trim() || 'ไม่ระบุ',
    village: data.village || '',
    district: data.district || '',
    province: data.province || '',
    isActive: data.isActive !== undefined ? data.isActive : true,
    lastLogin: data.lastLogin ? data.lastLogin.toDate?.()?.toISOString()?.split('T')[0] || data.lastLogin : 'ไม่เคยเข้าสู่ระบบ',
    totalCatch: data.totalCatch || 0,
    registeredDate: data.createdAt ? data.createdAt.toDate?.()?.toISOString()?.split('T')[0] || data.createdAt : new Date().toISOString().split('T')[0],
    accountStatus: data.accountStatus || 'active',
    createdBy: data.createdBy || '',
    fisherProfile: data.fisherProfile || null,
    organization: data.organization || '',
    position: data.position || ''
  };
};

export default function UsersPage() {
  const { userProfile, hasAnyRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all'); // สำหรับกรองตามบทบาท
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);
  const [userLastRecordDates, setUserLastRecordDates] = useState({}); // เก็บวันที่บันทึกล่าสุดของแต่ละ user
  const USERS_PER_PAGE = 50;
  
  // User Creation Dialog State
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  
  // User Detail Dialog State
  const [openDetailDialog, setOpenDetailDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userFishingStats, setUserFishingStats] = useState({
    totalRecords: 0,
    totalWeight: 0,
    totalValue: 0,
    loading: true
  });
  
  // Edit User Dialog State
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Image Upload State
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Delete User Dialog State
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    role: USER_ROLES.FISHER,
    village: '',
    district: '',
    province: '',
    // ข้อมูลเพิ่มเติมสำหรับชาวประมง
    fisherProfile: {
      nickname: '',
      experience: '',
      primaryGear: [],
      boatType: [],
      licenseNumber: ''
    },
    organization: '', // สำหรับนักวิจัย/หน่วยงานรัฐ
    position: '' // ตำแหน่ง
  });
  const [formErrors, setFormErrors] = useState({});

  // Check permissions
  const canManageUsers = hasAnyRole([USER_ROLES.ADMIN]);

  // Load users function (moved outside useEffect so it can be called from other functions)
  const loadUsers = async () => {
    try {
      setLoading(true);

      // สร้าง query เรียงตาม createdAt พร้อม limit
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(USERS_PER_PAGE)
      );

      // ใช้ getDocs สำหรับดึงข้อมูลครั้งเดียว
      const snapshot = await getDocs(usersQuery);
      const usersData = snapshot.docs.map(doc => transformFirestoreUser(doc));

      // เก็บ last document สำหรับ pagination
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(snapshot.docs.length === USERS_PER_PAGE);

      setUsers(usersData);
      setFilteredUsers(usersData);
      console.log('Loaded users:', usersData.length);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Load last fishing record date for each user
  useEffect(() => {
    const loadUserLastRecordDates = async () => {
      if (users.length === 0) return;

      try {
        // Fetch last record date for each user
        const datePromises = users.map(async (user) => {
          try {
            const response = await fetch(`/api/fishing-records?userId=${user.id}&limit=1`);
            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
              // Get the first record's date (since it's ordered by date desc)
              const lastRecord = result.data[0];
              const lastDate = lastRecord.catchDate || lastRecord.createdAt;
              return { userId: user.id, lastDate };
            }
            return { userId: user.id, lastDate: null };
          } catch (error) {
            console.error(`Error fetching last record for user ${user.id}:`, error);
            return { userId: user.id, lastDate: null };
          }
        });

        const results = await Promise.all(datePromises);

        // Convert to object map
        const datesMap = {};
        results.forEach(({ userId, lastDate }) => {
          datesMap[userId] = lastDate;
        });

        setUserLastRecordDates(datesMap);
      } catch (error) {
        console.error('Error loading user last record dates:', error);
      }
    };

    loadUserLastRecordDates();
  }, [users]);

  useEffect(() => {
    // Filter users based on search query and selected role
    let filtered = users;
    
    // กรองตามบทบาทก่อน
    if (selectedRole !== 'all') {
      filtered = filtered.filter(user => user.role === selectedRole);
    }
    
    // จากนั้นกรองตาม search query
    if (searchQuery) {
      filtered = filtered.filter(user =>
        (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.location && user.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.phone && user.phone.includes(searchQuery))
      );
    }
    
    setFilteredUsers(filtered);
  }, [searchQuery, selectedRole, users]);

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleRoleFilter = (role) => {
    setSelectedRole(role);
  };

  // Load more users (pagination)
  const loadMoreUsers = async () => {
    if (!lastVisible || !hasMore) return;

    try {
      setLoading(true);

      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible),
        limit(USERS_PER_PAGE)
      );

      const snapshot = await getDocs(usersQuery);
      const newUsersData = snapshot.docs.map(doc => transformFirestoreUser(doc));

      // เก็บ last document ใหม่
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(snapshot.docs.length === USERS_PER_PAGE);

      // เพิ่มข้อมูลใหม่เข้าไป
      setUsers(prev => [...prev, ...newUsersData]);
      setFilteredUsers(prev => [...prev, ...newUsersData]);
      console.log('Loaded more users:', newUsersData.length);
    } catch (error) {
      console.error('Error loading more users:', error);
    } finally {
      setLoading(false);
    }
  };

  // รายการบทบาทสำหรับปุ่มกรอง
  const roleFilters = [
    { value: 'all', label: 'ทั้งหมด', color: 'default' },
    { value: 'admin', label: 'ผู้ดูแลระบบ', color: 'error' },
    { value: 'fisher', label: 'ชาวประมง', color: 'primary' },
    { value: 'researcher', label: 'นักวิจัย', color: 'secondary' },
    { value: 'government', label: 'หน่วยงานรัฐ', color: 'success' },
    { value: 'community_manager', label: 'ผู้จัดการชุมชน', color: 'info' }
  ];

  // Form validation
  const validateForm = () => {
    const errors = {};
    
    if (!formData.email) {
      errors.email = 'กรุณากรอกอีเมล';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }
    
    if (!formData.password) {
      errors.password = 'กรุณากรอกรหัสผ่าน';
    } else if (formData.password.length < 6) {
      errors.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    }
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'รหัสผ่านไม่ตรงกัน';
    }
    
    if (!formData.name) {
      errors.name = 'กรุณากรอกชื่อ-นามสกุล';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    
    // Handle nested fields (fisherProfile)
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [field]: value
      });
    }
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors({
        ...formErrors,
        [field]: ''
      });
    }
  };

  // Handle checkbox changes for primaryGear
  const handlePrimaryGearChange = (gearType) => (event) => {
    const currentGear = formData.fisherProfile.primaryGear;
    const newGear = event.target.checked
      ? [...currentGear, gearType]
      : currentGear.filter(gear => gear !== gearType);
    
    setFormData({
      ...formData,
      fisherProfile: {
        ...formData.fisherProfile,
        primaryGear: newGear
      }
    });
  };

  // Handle checkbox changes for boatType
  const handleBoatTypeChange = (boatType) => (event) => {
    const currentBoats = Array.isArray(formData.fisherProfile.boatType) 
      ? formData.fisherProfile.boatType 
      : formData.fisherProfile.boatType ? [formData.fisherProfile.boatType] : [];
    
    const newBoats = event.target.checked
      ? [...currentBoats, boatType]
      : currentBoats.filter(boat => boat !== boatType);
    
    setFormData({
      ...formData,
      fisherProfile: {
        ...formData.fisherProfile,
        boatType: newBoats
      }
    });
  };

  // Handle user creation
  const handleCreateUser = async () => {
    if (!validateForm()) return;

    setCreateLoading(true);
    setCreateError('');

    try {
      // Prepare data structure to match Firebase collection exactly
      const userData = {
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
        village: formData.village,
        district: formData.district,
        province: formData.province,
        isActive: true,
        lastActivity: new Date().toISOString()
      };
      
      // Add fisherProfile only for fisher role
      if (formData.role === USER_ROLES.FISHER) {
        userData.fisherProfile = {
          nickname: formData.fisherProfile.nickname,
          experience: formData.fisherProfile.experience,
          primaryGear: formData.fisherProfile.primaryGear,
          boatType: formData.fisherProfile.boatType,
          licenseNumber: formData.fisherProfile.licenseNumber
        };
      } else {
        // Add organization info for non-fisher roles
        userData.organization = formData.organization;
        userData.position = formData.position;
      }
      
      // บันทึกข้อมูลลง Firestore เท่านั้น (ไม่สร้าง Firebase Auth)
      await addDoc(collection(db, 'users'), {
        email: formData.email,
        ...userData,
        // เก็บรหัสผ่านเป็น plain text ชั่วคราว (ในระบบจริงควรใช้ hashing)
        tempPassword: formData.password,
        accountStatus: 'pending', // รอการเปิดใช้งาน
        createdAt: new Date(),
        createdBy: userProfile?.email || 'admin'
      });
      
      // Add to local state (in real app, would refetch from Firebase)
      const newUser = {
        id: Date.now().toString(),
        email: formData.email,
        firstName: formData.name.split(' ')[0] || formData.name,
        lastName: formData.name.split(' ').slice(1).join(' ') || '',
        phone: formData.phone || '',
        location: `${formData.village || ''} ${formData.district || ''} ${formData.province || ''}`.trim() || 'ไม่ระบุ',
        isActive: true,
        lastLogin: new Date().toISOString().split('T')[0],
        totalCatch: 0,
        registeredDate: new Date().toISOString().split('T')[0]
      };
      
      setUsers([...users, newUser]);
      setOpenCreateDialog(false);
      resetForm();
      
      // แสดงข้อความสำเร็จ
      alert(`เพิ่มข้อมูลผู้ใช้ ${formData.name} สำเร็จ!\n\nผู้ใช้จะต้องสมัครบัญชี Firebase Authentication ด้วยตนเอง\nโดยใช้อีเมล: ${formData.email}`);
      
    } catch (error) {
      setCreateError(error.message || 'เกิดข้อผิดพลาดในการสร้างผู้ใช้');
    } finally {
      setCreateLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      phone: '',
      role: USER_ROLES.FISHER,
      village: '',
      district: '',
      province: '',
      fisherProfile: {
        nickname: '',
        experience: '',
        primaryGear: [],
        boatType: [],
        licenseNumber: ''
      },
      organization: '',
      position: ''
    });
    setFormErrors({});
    setCreateError('');
  };

  const handleOpenCreateDialog = () => {
    resetForm();
    setOpenCreateDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
    resetForm();
  };

  // User Detail Modal functions
  const handleOpenDetailDialog = async (user) => {
    setSelectedUser(user);
    setOpenDetailDialog(true);

    // Fetch user's fishing statistics from fishingRecords
    setUserFishingStats({ totalRecords: 0, totalWeight: 0, totalValue: 0, loading: true });

    console.log('🔍 Fetching fishing stats for user:', user.id);

    try {
      const response = await fetch(`/api/fishing-records?userId=${user.id}`);
      const result = await response.json();

      console.log('📦 API Response:', result);
      console.log('   - success:', result.success);
      console.log('   - data length:', result.data?.length);

      if (result.success && result.data) {
        const stats = {
          totalRecords: result.data.length,
          totalWeight: result.data.reduce((sum, record) => sum + (record.totalWeight || 0), 0),
          totalValue: result.data.reduce((sum, record) => sum + (record.totalValue || 0), 0),
          loading: false
        };
        console.log('✅ Calculated stats:', stats);
        setUserFishingStats(stats);
      } else {
        console.log('⚠️ No data or failed response');
        setUserFishingStats({ totalRecords: 0, totalWeight: 0, totalValue: 0, loading: false });
      }
    } catch (error) {
      console.error('❌ Error fetching user fishing stats:', error);
      setUserFishingStats({ totalRecords: 0, totalWeight: 0, totalValue: 0, loading: false });
    }
  };

  const handleCloseDetailDialog = () => {
    setOpenDetailDialog(false);
    setSelectedUser(null);
    setUserFishingStats({ totalRecords: 0, totalWeight: 0, totalValue: 0, loading: true });
  };

  // Edit User Modal functions
  // Handle image file selection
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setEditError('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setEditError('ขนาดไฟล์ต้องไม่เกิน 5MB');
        return;
      }

      setSelectedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload image to Firebase Storage
  const uploadImageToStorage = async (userId) => {
    if (!selectedImage) return null;

    try {
      setUploadingImage(true);

      console.log('Starting image upload for user:', userId);
      console.log('Selected image:', selectedImage.name, selectedImage.type, selectedImage.size);

      // Create storage reference
      const timestamp = Date.now();
      const filename = `fisher-profiles/${userId}/${timestamp}_${selectedImage.name}`;
      console.log('Storage path:', filename);

      const storageRef = ref(storage, filename);

      // Upload file
      console.log('Uploading file...');
      const uploadResult = await uploadBytes(storageRef, selectedImage);
      console.log('Upload successful:', uploadResult);

      // Get download URL
      console.log('Getting download URL...');
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Download URL obtained:', downloadURL);

      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);

      // More specific error messages
      let errorMessage = 'ไม่สามารถอัปโหลดรูปภาพได้';
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'ไม่มีสิทธิ์ในการอัปโหลดรูปภาพ กรุณาตรวจสอบ Firebase Storage Rules';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'การอัปโหลดถูกยกเลิก';
      } else if (error.code === 'storage/unknown') {
        errorMessage = 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ: ' + error.message;
      }

      throw new Error(errorMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  // Delete old image from Storage
  const deleteImageFromStorage = async (imageUrl) => {
    if (!imageUrl) return;

    try {
      // Extract path from URL
      const urlParts = imageUrl.split('/o/')[1];
      if (!urlParts) return;

      const imagePath = decodeURIComponent(urlParts.split('?')[0]);
      const imageRef = ref(storage, imagePath);

      await deleteObject(imageRef);
      console.log('Old image deleted successfully');
    } catch (error) {
      console.error('Error deleting old image:', error);
      // Don't throw error, just log it
    }
  };

  const handleOpenEditDialog = (user) => {
    setSelectedUser(user);

    // Set image preview if user has profile photo
    if (user.fisherProfile?.profilePhoto) {
      setImagePreview(user.fisherProfile.profilePhoto);
    } else {
      setImagePreview(null);
    }
    setSelectedImage(null);

    // Populate form with user data
    setFormData({
      email: user.email || '',
      password: '', // Don't show existing password
      confirmPassword: '',
      name: user.name || '',
      phone: user.phone || '',
      role: user.role || USER_ROLES.FISHER,
      village: user.village || '',
      district: user.district || '',
      province: user.province || '',
      fisherProfile: {
        nickname: user.fisherProfile?.nickname || '',
        experience: user.fisherProfile?.experience || '',
        primaryGear: user.fisherProfile?.primaryGear || [],
        boatType: user.fisherProfile?.boatType || [],
        licenseNumber: user.fisherProfile?.licenseNumber || '',
        profilePhoto: user.fisherProfile?.profilePhoto || ''
      },
      organization: user.organization || '',
      position: user.position || ''
    });
    setFormErrors({});
    setEditError('');
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setSelectedUser(null);
    resetForm();
  };

  // Form validation for edit (similar to create but without password requirement)
  const validateEditForm = () => {
    const errors = {};
    
    if (!formData.email) {
      errors.email = 'กรุณากรอกอีเมล';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }
    
    // Password is optional for edit
    if (formData.password && formData.password.length < 6) {
      errors.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    }
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'รหัสผ่านไม่ตรงกัน';
    }
    
    if (!formData.name) {
      errors.name = 'กรุณากรอกชื่อ-นามสกุล';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle user update
  const handleUpdateUser = async () => {
    if (!validateEditForm()) return;
    if (!selectedUser) return;

    setEditLoading(true);
    setEditError('');

    try {
      let profilePhotoURL = formData.fisherProfile?.profilePhoto || '';

      // Upload new image if selected
      if (selectedImage) {
        // Delete old image if exists
        if (formData.fisherProfile?.profilePhoto) {
          await deleteImageFromStorage(formData.fisherProfile.profilePhoto);
        }

        // Upload new image
        profilePhotoURL = await uploadImageToStorage(selectedUser.id);
      }

      // Prepare update data
      const updateData = {
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
        village: formData.village,
        district: formData.district,
        province: formData.province,
        lastActivity: new Date().toISOString(),
        updatedAt: new Date(),
        updatedBy: userProfile?.email || 'admin'
      };

      // Add fisherProfile only for fisher role
      if (formData.role === USER_ROLES.FISHER) {
        updateData.fisherProfile = {
          nickname: formData.fisherProfile.nickname,
          experience: formData.fisherProfile.experience,
          primaryGear: formData.fisherProfile.primaryGear,
          boatType: formData.fisherProfile.boatType,
          licenseNumber: formData.fisherProfile.licenseNumber,
          profilePhoto: profilePhotoURL // Add profile photo URL
        };
      } else {
        // Add organization info for non-fisher roles
        updateData.organization = formData.organization;
        updateData.position = formData.position;
        // Remove fisherProfile if role changed from fisher
        updateData.fisherProfile = null;

        // Delete profile photo if role changed from fisher
        if (selectedUser.fisherProfile?.profilePhoto) {
          await deleteImageFromStorage(selectedUser.fisherProfile.profilePhoto);
        }
      }

      // Update password only if provided
      if (formData.password) {
        updateData.tempPassword = formData.password;
      }

      // Update in Firestore
      await updateDoc(doc(db, 'users', selectedUser.id), updateData);

      // Reload users data
      await loadUsers();

      setOpenEditDialog(false);
      setSelectedImage(null);
      setImagePreview(null);
      resetForm();

      // Show success message
      alert(`อัปเดตข้อมูลผู้ใช้ ${formData.name} สำเร็จ!`);

    } catch (error) {
      setEditError(error.message || 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ใช้');
    } finally {
      setEditLoading(false);
    }
  };

  // Delete User Modal functions
  const handleOpenDeleteDialog = (user) => {
    setUserToDelete(user);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setUserToDelete(null);
  };

  // Handle user deletion
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'users', userToDelete.id));
      
      setOpenDeleteDialog(false);
      setUserToDelete(null);
      
      // Show success message
      alert(`ลบผู้ใช้ ${userToDelete.name || userToDelete.email} สำเร็จ!`);
      
    } catch (error) {
      alert(`เกิดข้อผิดพลาดในการลบผู้ใช้: ${error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <Box sx={{ p: 1, pl: 1.5 }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          จัดการผู้ใช้งาน
        </Typography>
        <Typography variant="body1" color="text.secondary">
          รายชื่อผู้ใช้งาน Mobile App และสถิติการใช้งาน
        </Typography>
      </Box>

      {/* Role Filter and Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
            {/* Role Filter Buttons */}
            <Box display="flex" gap={1} flexWrap="wrap">
              <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1, fontWeight: 'medium' }}>
                กรองตามบทบาท:
              </Typography>
              {roleFilters.map((filter) => {
                const userCount = filter.value === 'all' ? users.length : 
                                 users.filter(user => user.role === filter.value).length;
                
                return (
                  <Chip
                    key={filter.value}
                    label={`${filter.label} (${userCount})`}
                    color={selectedRole === filter.value ? filter.color : 'default'}
                    variant={selectedRole === filter.value ? 'filled' : 'outlined'}
                    onClick={() => handleRoleFilter(filter.value)}
                    clickable
                    size="small"
                  />
                );
              })}
            </Box>
            
            {/* Search and Add User */}
            <Box display="flex" gap={1} alignItems="center">
              <TextField
                placeholder="ค้นหาในบทบาทที่เลือก..."
                value={searchQuery}
                onChange={handleSearch}
                size="small"
                sx={{ minWidth: 250 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
              {canManageUsers && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  size="small"
                  onClick={handleOpenCreateDialog}
                >
                  เพิ่มผู้ใช้
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <Typography>กำลังโหลดข้อมูล...</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ width: 80 }}>ลำดับ</TableCell>
                    <TableCell>ผู้ใช้งาน</TableCell>
                    <TableCell>เบอร์โทร</TableCell>
                    <TableCell>บทบาท</TableCell>
                    <TableCell align="center">รูปภาพ</TableCell>
                    <TableCell>บันทึกข้อมูลล่าสุด</TableCell>
                    <TableCell align="center">จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user, index) => (
                    <TableRow key={user.id} hover>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="medium">
                          {index + 1}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {(user.name || user.email)?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {user.name || `${user.firstName} ${user.lastName}`.trim() || 'ไม่ระบุชื่อ'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatPhoneNumber(user.phone)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getRoleLabel(user.role)}
                          color={getRoleColor(user.role)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" justifyContent="center">
                          {user.fisherProfile?.profilePhoto ? (
                            <Avatar
                              src={user.fisherProfile.profilePhoto}
                              alt={user.name}
                              sx={{
                                width: 40,
                                height: 40,
                                border: '2px solid',
                                borderColor: 'divider',
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                                '&:hover': {
                                  transform: 'scale(1.1)'
                                }
                              }}
                              onClick={() => handleOpenDetailDialog(user)}
                            />
                          ) : (
                            <Avatar
                              sx={{
                                width: 40,
                                height: 40,
                                bgcolor: 'grey.300',
                                color: 'grey.600'
                              }}
                            >
                              <PhotoCamera fontSize="small" />
                            </Avatar>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {userLastRecordDates[user.id]
                            ? new Date(userLastRecordDates[user.id]).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : 'ยังไม่มีข้อมูล'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" gap={0.5}>
                          <Tooltip title="ดูรายละเอียด">
                            <IconButton 
                              size="small"
                              onClick={() => handleOpenDetailDialog(user)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="แก้ไข">
                            <IconButton 
                              size="small"
                              onClick={() => handleOpenEditDialog(user)}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="ลบ">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleOpenDeleteDialog(user)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Load More Button */}
          {!loading && hasMore && !searchQuery && selectedRole === 'all' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={loadMoreUsers}
                disabled={loading}
              >
                {loading ? 'กำลังโหลด...' : `โหลดเพิ่ม (แสดง ${users.length} จาก ${users.length >= USERS_PER_PAGE ? `${users.length}+` : users.length} รายการ)`}
              </Button>
            </Box>
          )}

          {!loading && filteredUsers.length === 0 && (
            <Box textAlign="center" py={3}>
              <Typography color="text.secondary">
                {searchQuery ? 'ไม่พบผู้ใช้งานที่ค้นหา' : 'ไม่มีข้อมูลผู้ใช้งาน'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={handleCloseCreateDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          เพิ่มผู้ใช้งานใหม่
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>หมายเหตุ:</strong> ระบบจะบันทึกข้อมูลผู้ใช้ลงในฐานข้อมูลเท่านั้น 
                ผู้ใช้จะต้องสร้างบัญชี Firebase Authentication ด้วยตนเอง
              </Typography>
            </Alert>
            
            {createError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {createError}
              </Alert>
            )}
            
            <Grid container spacing={2}>
              {/* Email */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="อีเมล *"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                  disabled={createLoading}
                />
              </Grid>
              
              {/* Role */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!formErrors.role}>
                  <InputLabel>บทบาท *</InputLabel>
                  <Select
                    value={formData.role}
                    onChange={handleInputChange('role')}
                    label="บทบาท *"
                    disabled={createLoading}
                  >
                    <MenuItem value={USER_ROLES.FISHER}>ชาวประมง</MenuItem>
                    <MenuItem value={USER_ROLES.RESEARCHER}>นักวิจัย</MenuItem>
                    <MenuItem value={USER_ROLES.GOVERNMENT}>หน่วยงานรัฐ</MenuItem>
                    <MenuItem value={USER_ROLES.COMMUNITY_MANAGER}>ผู้จัดการชุมชน</MenuItem>
                    {userProfile?.role === USER_ROLES.ADMIN && (
                      <MenuItem value={USER_ROLES.ADMIN}>ผู้ดูแลระบบ</MenuItem>
                    )}
                  </Select>
                  {formErrors.role && <FormHelperText>{formErrors.role}</FormHelperText>}
                </FormControl>
              </Grid>
              
              {/* Password */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="รหัสผ่าน *"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  error={!!formErrors.password}
                  helperText={formErrors.password}
                  disabled={createLoading}
                />
              </Grid>
              
              {/* Confirm Password */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ยืนยันรหัสผ่าน *"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  error={!!formErrors.confirmPassword}
                  helperText={formErrors.confirmPassword}
                  disabled={createLoading}
                />
              </Grid>
              
              {/* Name */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ชื่อ-นามสกุล *"
                  value={formData.name}
                  onChange={handleInputChange('name')}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  disabled={createLoading}
                  placeholder="เช่น สมชาย ประมงดี"
                />
              </Grid>
              
              {/* Phone */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="เบอร์โทรศัพท์"
                  value={formData.phone}
                  onChange={handleInputChange('phone')}
                  error={!!formErrors.phone}
                  helperText={formErrors.phone}
                  disabled={createLoading}
                />
              </Grid>
              
              {/* Village */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="หมู่บ้าน/ตำบล"
                  value={formData.village}
                  onChange={handleInputChange('village')}
                  disabled={createLoading}
                  placeholder="เช่น บ้านดงมะไฟ"
                />
              </Grid>
              
              {/* District */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="อำเภอ"
                  value={formData.district}
                  onChange={handleInputChange('district')}
                  disabled={createLoading}
                  placeholder="เช่น เมืองนครพนม"
                />
              </Grid>
              
              {/* Province */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!formErrors.province}>
                  <InputLabel sx={{ fontSize: '1rem' }}>จังหวัด *</InputLabel>
                  <Select
                    value={formData.province}
                    onChange={handleInputChange('province')}
                    label="จังหวัด *"
                    disabled={createLoading}
                    sx={{
                      '& .MuiSelect-select': {
                        fontSize: '1rem',
                        padding: '16.5px 14px'
                      }
                    }}
                  >
                    <MenuItem value="">เลือกจังหวัด</MenuItem>
                    <MenuItem value="เลย">เลย</MenuItem>
                    <MenuItem value="หนองคาย">หนองคาย</MenuItem>
                    <MenuItem value="บึงกาฬ">บึงกาฬ</MenuItem>
                    <MenuItem value="นครพนม">นครพนม</MenuItem>
                    <MenuItem value="มุกดาหาร">มุกดาหาร</MenuItem>
                    <MenuItem value="อำนาจเจริญ">อำนาจเจริญ</MenuItem>
                    <MenuItem value="อุบลราชธานี">อุบลราชธานี</MenuItem>
                  </Select>
                  {formErrors.province && <FormHelperText>{formErrors.province}</FormHelperText>}
                </FormControl>
              </Grid>
              
              {/* Nickname - Show only for FISHER role */}
              {formData.role === USER_ROLES.FISHER && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="ชื่อเล่น"
                    value={formData.fisherProfile.nickname}
                    onChange={handleInputChange('fisherProfile.nickname')}
                    disabled={createLoading}
                    placeholder="เช่น ลุงบัง, พี่เต้"
                  />
                </Grid>
              )}
              
              {/* Fisher Profile Section - Show only for FISHER role */}
              {formData.role === USER_ROLES.FISHER && (
                <>
                  
                  {/* Experience */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      ประสบการณ์การประมง
                    </Typography>
                    <FormControl component="fieldset">
                      <RadioGroup
                        row
                        value={formData.fisherProfile.experience}
                        onChange={handleInputChange('fisherProfile.experience')}
                        disabled={createLoading}
                      >
                        <FormControlLabel
                          value="น้อยกว่า 1 ปี"
                          control={<Radio />}
                          label="น้อยกว่า 1 ปี"
                          sx={{ minWidth: '150px', mr: 2 }}
                        />
                        <FormControlLabel
                          value="1-5 ปี"
                          control={<Radio />}
                          label="1-5 ปี"
                          sx={{ minWidth: '120px', mr: 2 }}
                        />
                        <FormControlLabel
                          value="6-10 ปี"
                          control={<Radio />}
                          label="6-10 ปี"
                          sx={{ minWidth: '120px', mr: 2 }}
                        />
                        <FormControlLabel
                          value="11-20 ปี"
                          control={<Radio />}
                          label="11-20 ปี"
                          sx={{ minWidth: '120px', mr: 2 }}
                        />
                        <FormControlLabel
                          value="มากกว่า 20 ปี"
                          control={<Radio />}
                          label="มากกว่า 20 ปี"
                          sx={{ minWidth: '150px', mr: 2 }}
                        />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                  
                  {/* Primary Gear */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      เครื่องมือหลัก (เลือกได้หลายรายการ)
                    </Typography>
                    <FormGroup row>
                      {['มอง', 'แห', 'เบ็ดราว', 'ลอบ', 'จั่น', 'ตุ้ม', 'กะโหล่', 'ซ่อน', 'ต่อง', 'โต่ง', 'เบ็ดน้ำเต้า', 'เอ๊าะ', 'สวิง', 'สะดุ้ง'].map((gear) => (
                        <FormControlLabel
                          key={gear}
                          control={
                            <Checkbox
                              checked={formData.fisherProfile.primaryGear.includes(gear)}
                              onChange={handlePrimaryGearChange(gear)}
                              disabled={createLoading}
                            />
                          }
                          label={gear}
                          sx={{ minWidth: '120px', mr: 2 }}
                        />
                      ))}
                    </FormGroup>
                  </Grid>
                  
                  {/* Boat Type */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      ประเภทเรือ (เลือกได้หลายรายการ)
                    </Typography>
                    <FormGroup row>
                      {['เรือหางยาว', 'เรือไฟเบอร์', 'เรือไม้', 'แพ', 'ไม่มีเรือ'].map((boat) => (
                        <FormControlLabel
                          key={boat}
                          control={
                            <Checkbox
                              checked={(Array.isArray(formData.fisherProfile.boatType) 
                                ? formData.fisherProfile.boatType 
                                : formData.fisherProfile.boatType ? [formData.fisherProfile.boatType] : []
                              ).includes(boat)}
                              onChange={handleBoatTypeChange(boat)}
                              disabled={createLoading}
                            />
                          }
                          label={boat}
                          sx={{ minWidth: '150px', mr: 2 }}
                        />
                      ))}
                    </FormGroup>
                  </Grid>
                  
                  {/* License Number */}
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="หมายเลขใบอนุญาตประมง"
                      value={formData.fisherProfile.licenseNumber}
                      onChange={handleInputChange('fisherProfile.licenseNumber')}
                      disabled={createLoading}
                      placeholder="เช่น PF-12345"
                    />
                  </Grid>
                </>
              )}
              
              {/* Organization - Show for non-fisher roles */}
              {formData.role !== USER_ROLES.FISHER && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1 }}>
                      ข้อมูลองค์กร
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="หน่วยงาน/องค์กร"
                      value={formData.organization}
                      onChange={handleInputChange('organization')}
                      error={!!formErrors.organization}
                      helperText={formErrors.organization}
                      disabled={createLoading}
                      placeholder="เช่น มหาวิทยาลัยขอนแก่น"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="ตำแหน่งงาน"
                      value={formData.position}
                      onChange={handleInputChange('position')}
                      disabled={createLoading}
                      placeholder="เช่น อาจารย์, นักวิจัย"
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseCreateDialog}
            disabled={createLoading}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            disabled={createLoading}
            startIcon={createLoading ? <CircularProgress size={20} /> : <Add />}
          >
            {createLoading ? 'กำลังสร้าง...' : 'สร้างผู้ใช้งาน'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Detail Dialog */}
      <Dialog
        open={openDetailDialog}
        onClose={handleCloseDetailDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              {selectedUser?.name?.charAt(0)?.toUpperCase() || selectedUser?.email?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6">
                รายละเอียดผู้ใช้งาน
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedUser?.name || 'ไม่ระบุชื่อ'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                {/* 1. ข้อมูลพื้นฐาน */}
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom color="primary" sx={{ mb: 2 }}>
                      1. ข้อมูลพื้นฐาน
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">อีเมล</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {selectedUser.email}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">ชื่อ-นามสกุล</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {selectedUser.name || 'ไม่ระบุ'}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">เบอร์โทรศัพท์</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {selectedUser.phone || 'ไม่ระบุ'}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">บทบาท</Typography>
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            label={getRoleLabel(selectedUser.role)}
                            color={getRoleColor(selectedUser.role)}
                            size="small"
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>
                
                {/* 2. ข้อมูลพื้นที่ */}
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom color="primary" sx={{ mb: 2 }}>
                      2. ข้อมูลพื้นที่
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">หมู่บ้าน/ตำบล</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {selectedUser.village || 'ไม่ระบุ'}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">อำเภอ</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {selectedUser.district || 'ไม่ระบุ'}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">จังหวัด</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {selectedUser.province || 'ไม่ระบุ'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>
                
                {/* 3. ข้อมูลชาวประมง - Show only for fisher role */}
                {selectedUser.role === 'fisher' && selectedUser.fisherProfile && (
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom color="primary" sx={{ mb: 2 }}>
                        3. ข้อมูลชาวประมง
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">ชื่อเล่น</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedUser.fisherProfile.nickname || 'ไม่ระบุ'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">ประสบการณ์</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedUser.fisherProfile.experience || 'ไม่ระบุ'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">เครื่องมือหลัก</Typography>
                          <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                            {selectedUser.fisherProfile.primaryGear && selectedUser.fisherProfile.primaryGear.length > 0 ? (
                              selectedUser.fisherProfile.primaryGear.map((gear, index) => (
                                <Chip key={index} label={gear} size="small" variant="outlined" />
                              ))
                            ) : (
                              <Typography variant="body1">ไม่ระบุ</Typography>
                            )}
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">ประเภทเรือ</Typography>
                          <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                            {selectedUser.fisherProfile.boatType && selectedUser.fisherProfile.boatType.length > 0 ? (
                              selectedUser.fisherProfile.boatType.map((boat, index) => (
                                <Chip key={index} label={boat} size="small" variant="outlined" color="primary" />
                              ))
                            ) : (
                              <Typography variant="body1">ไม่ระบุ</Typography>
                            )}
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">หมายเลขใบอนุญาตประมง</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedUser.fisherProfile.licenseNumber || 'ไม่ระบุ'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Card>
                  </Grid>
                )}
                
                {/* 3. ข้อมูลองค์กร - Show for non-fisher roles */}
                {selectedUser.role !== 'fisher' && (
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom color="primary" sx={{ mb: 2 }}>
                        3. ข้อมูลองค์กร
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">หน่วยงาน/องค์กร</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedUser.organization || 'ไม่ระบุ'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">ตำแหน่งงาน</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {selectedUser.position || 'ไม่ระบุ'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Card>
                  </Grid>
                )}
                
                {/* 4. ข้อมูลระบบ */}
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom color="primary" sx={{ mb: 2 }}>
                      4. ข้อมูลระบบ
                    </Typography>

                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">เข้าสู่ระบบล่าสุด</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {selectedUser.lastLogin}
                        </Typography>
                      </Grid>

                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">วันที่ลงทะเบียน</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {selectedUser.registeredDate}
                        </Typography>
                      </Grid>

                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">สร้างโดย</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {selectedUser.createdBy || 'ไม่ระบุ'}
                        </Typography>
                      </Grid>

                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">สถานะการใช้งาน</Typography>
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            label={selectedUser.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                            color={selectedUser.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>

                {/* 5. สถิติการจับปลา */}
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom color="primary" sx={{ mb: 2 }}>
                      5. สถิติการจับปลา
                    </Typography>

                    {userFishingStats.loading ? (
                      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                        <CircularProgress size={30} />
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                          กำลังโหลดข้อมูลสถิติ...
                        </Typography>
                      </Box>
                    ) : (
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary">จำนวนการจับทั้งหมด</Typography>
                          <Typography variant="h6" fontWeight="bold" color="primary">
                            {userFishingStats.totalRecords} ครั้ง
                          </Typography>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary">น้ำหนักรวม</Typography>
                          <Typography variant="h6" fontWeight="bold" color="success.main">
                            {userFishingStats.totalWeight.toFixed(2)} กก.
                          </Typography>
                        </Grid>

                        <Grid item xs={12}>
                          <Box sx={{ mt: 1 }}>
                            {userFishingStats.totalRecords > 0 ? (
                              <Button
                                variant="text"
                                color="primary"
                                size="small"
                                onClick={() => {
                                  handleCloseDetailDialog();
                                  window.location.href = `/fishing/summary?userId=${selectedUser?.id}`;
                                }}
                                sx={{ textTransform: 'none' }}
                              >
                                ดูรายละเอียดเพิ่มเติม →
                              </Button>
                            ) : (
                              <Chip
                                label="ยังไม่มีข้อมูลการจับ"
                                color="default"
                                size="small"
                              />
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    )}
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetailDialog}>
            ปิด
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<Edit />}
            onClick={() => {
              handleCloseDetailDialog();
              handleOpenEditDialog(selectedUser);
            }}
          >
            แก้ไขข้อมูล
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={openEditDialog}
        onClose={handleCloseEditDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          แก้ไขข้อมูลผู้ใช้งาน: {selectedUser?.name || selectedUser?.email}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>หมายเหตุ:</strong> หากไม่ต้องการเปลี่ยนรหัสผ่าน ให้ปล่อยช่องรหัสผ่านว่างไว้
              </Typography>
            </Alert>
            
            {editError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {editError}
              </Alert>
            )}
            
            <Grid container spacing={2}>
              {/* Email - Read only for edit */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="อีเมล"
                  type="email"
                  value={formData.email}
                  disabled={true}
                  helperText="ไม่สามารถเปลี่ยนอีเมลได้"
                />
              </Grid>
              
              {/* Role */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!formErrors.role}>
                  <InputLabel>บทบาท *</InputLabel>
                  <Select
                    value={formData.role}
                    onChange={handleInputChange('role')}
                    label="บทบาท *"
                    disabled={editLoading}
                  >
                    <MenuItem value={USER_ROLES.FISHER}>ชาวประมง</MenuItem>
                    <MenuItem value={USER_ROLES.RESEARCHER}>นักวิจัย</MenuItem>
                    <MenuItem value={USER_ROLES.GOVERNMENT}>หน่วยงานรัฐ</MenuItem>
                    <MenuItem value={USER_ROLES.COMMUNITY_MANAGER}>ผู้จัดการชุมชน</MenuItem>
                    {userProfile?.role === USER_ROLES.ADMIN && (
                      <MenuItem value={USER_ROLES.ADMIN}>ผู้ดูแลระบบ</MenuItem>
                    )}
                  </Select>
                  {formErrors.role && <FormHelperText>{formErrors.role}</FormHelperText>}
                </FormControl>
              </Grid>
              
              {/* Password - Optional for edit */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="รหัสผ่านใหม่ (ไม่บังคับ)"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  error={!!formErrors.password}
                  helperText={formErrors.password || "ปล่อยว่างหากไม่ต้องการเปลี่ยน"}
                  disabled={editLoading}
                />
              </Grid>
              
              {/* Confirm Password */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ยืนยันรหัสผ่านใหม่"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  error={!!formErrors.confirmPassword}
                  helperText={formErrors.confirmPassword}
                  disabled={editLoading}
                />
              </Grid>
              
              {/* Name */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ชื่อ-นามสกุล *"
                  value={formData.name}
                  onChange={handleInputChange('name')}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  disabled={editLoading}
                  placeholder="เช่น สมชาย ประมงดี"
                />
              </Grid>
              
              {/* Phone */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="เบอร์โทรศัพท์"
                  value={formData.phone}
                  onChange={handleInputChange('phone')}
                  error={!!formErrors.phone}
                  helperText={formErrors.phone}
                  disabled={editLoading}
                />
              </Grid>
              
              {/* Village */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="หมู่บ้าน/ตำบล"
                  value={formData.village}
                  onChange={handleInputChange('village')}
                  disabled={editLoading}
                  placeholder="เช่น บ้านดงมะไฟ"
                />
              </Grid>
              
              {/* District */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="อำเภอ"
                  value={formData.district}
                  onChange={handleInputChange('district')}
                  disabled={editLoading}
                  placeholder="เช่น เมืองนครพนม"
                />
              </Grid>
              
              {/* Province */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!formErrors.province}>
                  <InputLabel sx={{ fontSize: '1rem' }}>จังหวัด</InputLabel>
                  <Select
                    value={formData.province}
                    onChange={handleInputChange('province')}
                    label="จังหวัด"
                    disabled={editLoading}
                    sx={{
                      '& .MuiSelect-select': {
                        fontSize: '1rem',
                        padding: '16.5px 14px'
                      }
                    }}
                  >
                    <MenuItem value="">เลือกจังหวัด</MenuItem>
                    <MenuItem value="เลย">เลย</MenuItem>
                    <MenuItem value="หนองคาย">หนองคาย</MenuItem>
                    <MenuItem value="บึงกาฬ">บึงกาฬ</MenuItem>
                    <MenuItem value="นครพนม">นครพนม</MenuItem>
                    <MenuItem value="มุกดาหาร">มุกดาหาร</MenuItem>
                    <MenuItem value="อำนาจเจริญ">อำนาจเจริญ</MenuItem>
                    <MenuItem value="อุบลราชธานี">อุบลราชธานี</MenuItem>
                  </Select>
                  {formErrors.province && <FormHelperText>{formErrors.province}</FormHelperText>}
                </FormControl>
              </Grid>
              
              {/* Fisher Profile Section - Show only for FISHER role */}
              {formData.role === USER_ROLES.FISHER && (
                <>
                  {/* Nickname */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="ชื่อเล่น"
                      value={formData.fisherProfile.nickname}
                      onChange={handleInputChange('fisherProfile.nickname')}
                      disabled={editLoading}
                      placeholder="เช่น ลุงบัง, พี่เต้"
                    />
                  </Grid>

                  {/* Profile Photo Upload */}
                  <Grid item xs={12}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        รูปภาพชาวประมง
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                        {/* Image Preview */}
                        {imagePreview && (
                          <Box
                            component="img"
                            src={imagePreview}
                            alt="Preview"
                            sx={{
                              width: 120,
                              height: 120,
                              objectFit: 'cover',
                              borderRadius: 2,
                              border: '2px solid #e0e0e0'
                            }}
                          />
                        )}

                        {/* Upload Button */}
                        <Box>
                          <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="profile-photo-upload"
                            type="file"
                            onChange={handleImageChange}
                            disabled={uploadingImage || editLoading}
                          />
                          <label htmlFor="profile-photo-upload">
                            <Button
                              variant="outlined"
                              component="span"
                              startIcon={uploadingImage ? <CircularProgress size={20} /> : <PhotoCamera />}
                              disabled={uploadingImage || editLoading}
                            >
                              {uploadingImage ? 'กำลังอัปโหลด...' : imagePreview ? 'เปลี่ยนรูปภาพ' : 'เลือกรูปภาพ'}
                            </Button>
                          </label>
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                            รองรับ: JPG, PNG, GIF (สูงสุด 5MB)
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Grid>

                  {/* Experience */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      ประสบการณ์การประมง
                    </Typography>
                    <FormControl component="fieldset">
                      <RadioGroup
                        row
                        value={formData.fisherProfile.experience}
                        onChange={handleInputChange('fisherProfile.experience')}
                        disabled={editLoading}
                      >
                        <FormControlLabel
                          value="น้อยกว่า 1 ปี"
                          control={<Radio />}
                          label="น้อยกว่า 1 ปี"
                          sx={{ minWidth: '150px', mr: 2 }}
                        />
                        <FormControlLabel
                          value="1-5 ปี"
                          control={<Radio />}
                          label="1-5 ปี"
                          sx={{ minWidth: '120px', mr: 2 }}
                        />
                        <FormControlLabel
                          value="6-10 ปี"
                          control={<Radio />}
                          label="6-10 ปี"
                          sx={{ minWidth: '120px', mr: 2 }}
                        />
                        <FormControlLabel
                          value="11-20 ปี"
                          control={<Radio />}
                          label="11-20 ปี"
                          sx={{ minWidth: '120px', mr: 2 }}
                        />
                        <FormControlLabel
                          value="มากกว่า 20 ปี"
                          control={<Radio />}
                          label="มากกว่า 20 ปี"
                          sx={{ minWidth: '150px', mr: 2 }}
                        />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                  
                  {/* Primary Gear */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      เครื่องมือหลัก (เลือกได้หลายรายการ)
                    </Typography>
                    <FormGroup row>
                      {['มอง', 'แห', 'เบ็ดราว', 'ลอบ', 'จั่น', 'ตุ้ม', 'กะโหล่', 'ซ่อน', 'ต่อง', 'โต่ง', 'เบ็ดน้ำเต้า', 'เอ๊าะ', 'สวิง', 'สะดุ้ง'].map((gear) => (
                        <FormControlLabel
                          key={gear}
                          control={
                            <Checkbox
                              checked={formData.fisherProfile.primaryGear.includes(gear)}
                              onChange={handlePrimaryGearChange(gear)}
                              disabled={editLoading}
                            />
                          }
                          label={gear}
                          sx={{ minWidth: '120px', mr: 2 }}
                        />
                      ))}
                    </FormGroup>
                  </Grid>
                  
                  {/* Boat Type */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      ประเภทเรือ (เลือกได้หลายรายการ)
                    </Typography>
                    <FormGroup row>
                      {['เรือหางยาว', 'เรือไฟเบอร์', 'เรือไม้', 'แพ', 'ไม่มีเรือ'].map((boat) => (
                        <FormControlLabel
                          key={boat}
                          control={
                            <Checkbox
                              checked={(Array.isArray(formData.fisherProfile.boatType) 
                                ? formData.fisherProfile.boatType 
                                : formData.fisherProfile.boatType ? [formData.fisherProfile.boatType] : []
                              ).includes(boat)}
                              onChange={handleBoatTypeChange(boat)}
                              disabled={editLoading}
                            />
                          }
                          label={boat}
                          sx={{ minWidth: '150px', mr: 2 }}
                        />
                      ))}
                    </FormGroup>
                  </Grid>
                  
                  {/* License Number */}
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="หมายเลขใบอนุญาตประมง"
                      value={formData.fisherProfile.licenseNumber}
                      onChange={handleInputChange('fisherProfile.licenseNumber')}
                      disabled={editLoading}
                      placeholder="เช่น PF-12345"
                    />
                  </Grid>
                </>
              )}
              
              {/* Organization - Show for non-fisher roles */}
              {formData.role !== USER_ROLES.FISHER && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1 }}>
                      ข้อมูลองค์กร
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="หน่วยงาน/องค์กร"
                      value={formData.organization}
                      onChange={handleInputChange('organization')}
                      error={!!formErrors.organization}
                      helperText={formErrors.organization}
                      disabled={editLoading}
                      placeholder="เช่น มหาวิทยาลัยขอนแก่น"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="ตำแหน่งงาน"
                      value={formData.position}
                      onChange={handleInputChange('position')}
                      disabled={editLoading}
                      placeholder="เช่น อาจารย์, นักวิจัย"
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseEditDialog}
            disabled={editLoading}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateUser}
            disabled={editLoading}
            startIcon={editLoading ? <CircularProgress size={20} /> : <Edit />}
          >
            {editLoading ? 'กำลังอัปเดต...' : 'อัปเดตข้อมูล'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <Delete />
          ยืนยันการลบผู้ใช้งาน
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>คำเตือน:</strong> การลบผู้ใช้งานจะไม่สามารถยกเลิกได้ ข้อมูลทั้งหมดของผู้ใช้จะถูกลบอย่างถาวร
            </Typography>
          </Alert>
          
          {userToDelete && (
            <Box>
              <Typography variant="body1" gutterBottom>
                คุณต้องการลบผู้ใช้งานต่อไปนี้หรือไม่?
              </Typography>
              
              <Card variant="outlined" sx={{ p: 2, mt: 2, backgroundColor: 'grey.50' }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'error.main' }}>
                    {(userToDelete.name || userToDelete.email)?.charAt(0)?.toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {userToDelete.name || 'ไม่ระบุชื่อ'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {userToDelete.email}
                    </Typography>
                    <Chip
                      label={getRoleLabel(userToDelete.role)}
                      color={getRoleColor(userToDelete.role)}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Box>
              </Card>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteDialog}
            disabled={deleteLoading}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteUser}
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : <Delete />}
          >
            {deleteLoading ? 'กำลังลบ...' : 'ลบผู้ใช้งาน'}
          </Button>
        </DialogActions>
      </Dialog>

      </Box>
    </DashboardLayout>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CircularProgress, Box, Typography, Alert } from '@mui/material';

const ProtectedRoute = ({
  children,
  requiredRole = null,
  requiredRoles = null,
  fallbackPath = '/landing'
}) => {
  const { userProfile, loading, isAuthenticated, hasRole, hasAnyRole } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading) {
      if (!isAuthenticated) {
        router.push(fallbackPath);
        return;
      }

      // ตรวจสอบ role ถ้าระบุมา
      if (requiredRole && !hasRole(requiredRole)) {
        router.push('/unauthorized');
        return;
      }

      // ตรวจสอบ roles (array) ถ้าระบุมา
      if (requiredRoles && !hasAnyRole(requiredRoles)) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [mounted, loading, isAuthenticated, userProfile, router, requiredRole, requiredRoles, hasRole, hasAnyRole, fallbackPath]);

  // Prevent hydration mismatch - don't render anything until mounted
  if (!mounted) {
    return null;
  }

  // แสดง loading ขณะที่กำลังตรวจสอบ auth
  if (loading) {
    return (
      <Box 
        display="flex" 
        flexDirection="column"
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        gap={2}
      >
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          กำลังตรวจสอบสิทธิ์การเข้าถึง...
        </Typography>
      </Box>
    );
  }

  // ถ้าไม่ได้ล็อกอิน
  if (!isAuthenticated) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <Alert severity="warning">
          กำลังนำทางไปยังหน้าเข้าสู่ระบบ...
        </Alert>
      </Box>
    );
  }

  // ตรวจสอบสิทธิ์ตาม role
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        p={3}
      >
        <Alert severity="error">
          <Typography variant="h6">
            ไม่มีสิทธิ์เข้าถึงหน้านี้
          </Typography>
          <Typography variant="body2">
            คุณต้องมีสิทธิ์ระดับ {requiredRole} เพื่อเข้าถึงหน้านี้
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (requiredRoles && !hasAnyRole(requiredRoles)) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        p={3}
      >
        <Alert severity="error">
          <Typography variant="h6">
            ไม่มีสิทธิ์เข้าถึงหน้านี้
          </Typography>
          <Typography variant="body2">
            คุณต้องมีสิทธิ์อย่างน้อยหนึ่งใน: {requiredRoles.join(', ')}
          </Typography>
        </Alert>
      </Box>
    );
  }

  // ถ้าผ่านการตรวจสอบทั้งหมด
  return children;
};

export default ProtectedRoute;
'use client';

import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent,
  Alert
} from '@mui/material';
import { 
  Block, 
  Home,
  ExitToApp 
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function UnauthorizedPage() {
  const router = useRouter();
  const { logout, userProfile, isAuthenticated } = useAuth();

  const handleGoHome = () => {
    router.push('/');
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 3
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {/* Icon */}
          <Block 
            sx={{ 
              fontSize: 80, 
              color: 'error.main', 
              mb: 3 
            }} 
          />

          {/* Title */}
          <Typography variant="h4" gutterBottom color="error">
            ไม่มีสิทธิ์เข้าถึง
          </Typography>

          {/* Message */}
          <Typography variant="body1" color="text.secondary" mb={3}>
            คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้ 
            กรุณาติดต่อผู้ดูแลระบบหรือลองเข้าสู่ระบบใหม่
          </Typography>

          {/* User Info */}
          {isAuthenticated && userProfile && (
            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                <strong>ผู้ใช้งาน:</strong> {userProfile.email}
              </Typography>
              <Typography variant="body2">
                <strong>สิทธิ์ปัจจุบัน:</strong> {userProfile.role}
              </Typography>
            </Alert>
          )}

          {/* Actions */}
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<Home />}
              onClick={handleGoHome}
              size="large"
            >
              กลับหน้าแรก
            </Button>

            {isAuthenticated && (
              <Button
                variant="contained"
                startIcon={<ExitToApp />}
                onClick={handleLogout}
                size="large"
                color="error"
              >
                ออกจากระบบ
              </Button>
            )}
          </Box>

          {/* Contact Info */}
          <Box mt={4} p={2} bgcolor="grey.50" borderRadius={1}>
            <Typography variant="caption" display="block" gutterBottom>
              <strong>ต้องการความช่วยเหลือ?</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ติดต่อผู้ดูแลระบบ: admin@mekong.com
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
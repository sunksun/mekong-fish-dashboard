'use client';

import { useState, useEffect } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import TopBar from './TopBar';
import Sidebar, { SIDEBAR_WIDTH } from './Sidebar';
import ProtectedRoute from '../ProtectedRoute';
import { USER_ROLES } from '@/types';

const DashboardLayout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // เปิด sidebar ตามขนาดหน้าจอ
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <ProtectedRoute 
      requiredRoles={[
        USER_ROLES.ADMIN, 
        USER_ROLES.RESEARCHER, 
        USER_ROLES.GOVERNMENT, 
        USER_ROLES.COMMUNITY_MANAGER,
        USER_ROLES.FISHER
      ]}
    >
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: !isMobile && sidebarOpen ? `${SIDEBAR_WIDTH}px 1fr` : '1fr',
        gridTemplateRows: '64px 1fr',
        gridTemplateAreas: !isMobile && sidebarOpen ? 
          '"topbar topbar" "sidebar content"' : 
          '"topbar" "content"',
        minHeight: '100vh',
        transition: 'grid-template-columns 0.3s'
      }}>
        {/* Top Bar */}
        <Box sx={{ gridArea: 'topbar' }}>
          <TopBar 
            onMenuClick={handleSidebarToggle}
            sidebarOpen={!isMobile && sidebarOpen}
          />
        </Box>

        {/* Sidebar */}
        <Sidebar
          open={sidebarOpen}
          onClose={handleSidebarClose}
          variant={isMobile ? 'temporary' : 'persistent'}
        />

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            gridArea: 'content',
            backgroundColor: 'background.default',
            overflow: 'auto',
            p: { xs: 2, sm: 3 }, // เพิ่ม padding สำหรับ mobile และ desktop
          }}
        >
          {children}
        </Box>
      </Box>
    </ProtectedRoute>
  );
};

export default DashboardLayout;
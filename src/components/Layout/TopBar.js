'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  Badge,
  Tooltip,
  Button
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Notifications,
  Settings,
  ExitToApp,
  Refresh,
  Fullscreen,
  FullscreenExit
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { SIDEBAR_WIDTH } from './Sidebar';

const TopBar = ({ onMenuClick, sidebarOpen }) => {
  const router = useRouter();
  const { userProfile, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationOpen = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/landing');
    } catch (error) {
      console.error('Logout error:', error);
    }
    handleProfileMenuClose();
  };

  const handleSettings = () => {
    router.push('/settings');
    handleProfileMenuClose();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  // Mock notifications
  const notifications = [
    { id: 1, title: 'ข้อมูลใหม่จากชาวประมง', time: '5 นาทีที่แล้ว', unread: true },
    { id: 2, title: 'รายงานรายเดือนพร้อมแล้ว', time: '1 ชั่วโมงที่แล้ว', unread: true },
    { id: 3, title: 'ผู้ใช้ใหม่ลงทะเบียน', time: '2 ชั่วโมงที่แล้ว', unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <AppBar 
      position="fixed" 
      sx={{
        width: { md: sidebarOpen ? `calc(100% - ${SIDEBAR_WIDTH}px)` : '100%' },
        ml: { md: sidebarOpen ? `${SIDEBAR_WIDTH}px` : 0 },
        transition: 'width 0.3s, margin-left 0.3s',
        backgroundColor: 'background.paper',
        color: 'text.primary',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Toolbar>
        {/* Menu Button */}
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: sidebarOpen ? 'none' : 'block' } }}
        >
          <MenuIcon />
        </IconButton>

        {/* Title */}
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          แดชบอร์ดการประมงแม่น้ำโขง
        </Typography>

        {/* Right Side Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Refresh Button */}
          <Tooltip title="รีเฟรš">
            <IconButton color="inherit" onClick={handleRefresh}>
              <Refresh />
            </IconButton>
          </Tooltip>

          {/* Fullscreen Toggle */}
          <Tooltip title={isFullscreen ? "ออกจากเต็มหน้าจอ" : "เต็มหน้าจอ"}>
            <IconButton color="inherit" onClick={toggleFullscreen}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="การแจ้งเตือน">
            <IconButton color="inherit" onClick={handleNotificationOpen}>
              <Badge badgeContent={unreadCount} color="error">
                <Notifications />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Profile Menu */}
          <Tooltip title="โปรไฟล์">
            <IconButton
              color="inherit"
              onClick={handleProfileMenuOpen}
              sx={{ ml: 1 }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                {userProfile?.email?.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Box>

        {/* Profile Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleProfileMenuClose}
          onClick={handleProfileMenuClose}
          PaperProps={{
            elevation: 3,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              minWidth: 200,
              '& .MuiAvatar-root': {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              {userProfile?.name || userProfile?.email}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {userProfile?.role}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleSettings}>
            <Settings fontSize="small" sx={{ mr: 1 }} />
            ตั้งค่า
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <ExitToApp fontSize="small" sx={{ mr: 1 }} />
            ออกจากระบบ
          </MenuItem>
        </Menu>

        {/* Notifications Menu */}
        <Menu
          anchorEl={notificationAnchor}
          open={Boolean(notificationAnchor)}
          onClose={handleNotificationClose}
          PaperProps={{
            elevation: 3,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              minWidth: 300,
              maxHeight: 400,
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" fontWeight="medium">
              การแจ้งเตือน ({unreadCount} ใหม่)
            </Typography>
          </Box>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                ไม่มีการแจ้งเตือน
              </Typography>
            </Box>
          ) : (
            notifications.map((notification) => (
              <MenuItem key={notification.id} onClick={handleNotificationClose}>
                <Box sx={{ width: '100%' }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {notification.unread && (
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: 'primary.main'
                        }}
                      />
                    )}
                    <Typography 
                      variant="body2" 
                      fontWeight={notification.unread ? 'medium' : 'normal'}
                    >
                      {notification.title}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {notification.time}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          )}
          <Divider />
          <Box sx={{ p: 1 }}>
            <Button size="small" fullWidth>
              ดูทั้งหมด
            </Button>
          </Box>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
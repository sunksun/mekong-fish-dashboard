'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadTopBarAlerts } from '@/lib/topbar-alerts';
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
  Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Notifications,
  Settings,
  ExitToApp,
  Refresh,
  Fullscreen,
  FullscreenExit,
  WaterDrop,
  Cloud,
  SetMeal,
  Science,
  CheckCircleOutline
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

  // โหลดการแจ้งเตือนจริงจาก Firestore ครั้งเดียวตอน mount
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadTopBarAlerts()
      .then(list => { if (!cancelled) setAlerts(list); })
      .catch(err => console.error('Load alerts failed:', err))
      .finally(() => { if (!cancelled) setAlertsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const unreadCount = alerts.length;

  const ALERT_ICON = {
    'water-level': WaterDrop,
    'rainfall': Cloud,
    'rare-fish': SetMeal,
    'water-quality': Science,
  };
  const SEVERITY_COLOR = {
    critical: 'error.main',
    warning: 'warning.main',
  };

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
              การแจ้งเตือน ({unreadCount})
            </Typography>
          </Box>
          {alertsLoading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                กำลังโหลด...
              </Typography>
            </Box>
          ) : alerts.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <CheckCircleOutline sx={{ fontSize: 32, color: 'success.main', mb: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                ไม่มีการแจ้งเตือนในขณะนี้
              </Typography>
            </Box>
          ) : (
            alerts.map((alert) => {
              const IconComp = ALERT_ICON[alert.type] || Notifications;
              const color = SEVERITY_COLOR[alert.severity] || 'text.secondary';
              return (
                <MenuItem key={alert.id} onClick={handleNotificationClose} sx={{ alignItems: 'flex-start', whiteSpace: 'normal' }}>
                  <Box display="flex" gap={1.5} sx={{ width: '100%' }}>
                    <IconComp sx={{ color, mt: 0.5, fontSize: 20 }} />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight="medium" sx={{ color }}>
                        {alert.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {alert.detail}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              );
            })
          )}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
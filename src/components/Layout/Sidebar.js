'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  Collapse,
  Avatar,
  Chip
} from '@mui/material';
import {
  Dashboard,
  PeopleAlt,
  Agriculture,
  Analytics,
  Map as MapIcon,
  Assessment,
  Settings,
  ExpandLess,
  ExpandMore,
  Person,
  TableChart,
  TrendingUp,
  BarChart,
  LocationOn,
  FileDownload,
  WaterDrop,
  Science,
  Timeline,
  LocalLibrary,
  MenuBook,
  School,
  Psychology,
  Waves,
  Phishing,
  Storage,
  AttachMoney,
  Payment,
  SetMeal
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { USER_ROLES } from '@/types';

const SIDEBAR_WIDTH = 280;

const menuItems = [
  {
    title: 'แดชบอร์ด',
    icon: Dashboard,
    path: '/dashboard',
    roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT, USER_ROLES.COMMUNITY_MANAGER]
  },
  {
    title: 'จัดการผู้ใช้งาน',
    icon: PeopleAlt,
    roles: [USER_ROLES.ADMIN, USER_ROLES.COMMUNITY_MANAGER],
    children: [
      {
        title: 'รายชื่อผู้ใช้',
        icon: Person,
        path: '/users',
        roles: [USER_ROLES.ADMIN, USER_ROLES.COMMUNITY_MANAGER]
      },
      {
        title: 'สถิติผู้ใช้',
        icon: TrendingUp,
        path: '/users/statistics',
        roles: [USER_ROLES.ADMIN]
      }
    ]
  },
  {
    title: 'ข้อมูลการจับปลา',
    icon: SetMeal,
    roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT],
    children: [
      {
        title: 'รายการการจับปลา',
        icon: TableChart,
        path: '/fishing/records',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT]
      },
      {
        title: 'วิเคราะห์ข้อมูล',
        icon: Analytics,
        path: '/fishing/analytics',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]
      }
    ]
  },
  {
    title: 'จัดการการจ่ายเงิน',
    icon: AttachMoney,
    roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER],
    children: [
      {
        title: 'รายการจ่ายเงิน',
        icon: Payment,
        path: '/payments',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]
      },
      {
        title: 'สร้างรายการจ่าย',
        icon: AttachMoney,
        path: '/payments/create',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]
      },
      {
        title: 'สรุปค่าใช้จ่าย',
        icon: Assessment,
        path: '/payments/summary',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]
      }
    ]
  },
  {
    title: 'แผนที่และพื้นที่',
    icon: MapIcon,
    roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT],
    children: [
      {
        title: 'แผนที่การจับปลา',
        icon: LocationOn,
        path: '/maps/fishing',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT]
      },
      {
        title: 'วิเคราะห์เชิงพื้นที่',
        icon: BarChart,
        path: '/maps/analysis',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]
      }
    ]
  },
  {
    title: 'ฐานข้อมูลปลา',
    icon: Storage,
    roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT],
    children: [
      {
        title: 'รายชื่อปลา',
        icon: TableChart,
        path: '/fish-species',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT]
      },
      {
        title: 'Import ข้อมูล',
        icon: FileDownload,
        path: '/fish-species/import',
        roles: [USER_ROLES.ADMIN]
      }
    ]
  },
  {
    title: 'คุณภาพน้ำ',
    icon: WaterDrop,
    roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT],
    children: [
      {
        title: 'ข้อมูลคุณภาพน้ำ',
        icon: Science,
        path: '/water-quality/data',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT]
      },
      {
        title: 'วิเคราะห์แนวโน้ม',
        icon: Timeline,
        path: '/water-quality/trends',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]
      },
      {
        title: 'จุดตรวจวัด',
        icon: LocationOn,
        path: '/water-quality/stations',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT]
      },
      {
        title: 'ระดับน้ำแม่น้ำโขง',
        icon: Waves,
        path: '/water-level',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT]
      }
    ]
  },
  {
    title: 'ความรู้ท้องถิ่น',
    icon: LocalLibrary,
    roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT, USER_ROLES.COMMUNITY_MANAGER],
    children: [
      {
        title: 'บทความ',
        icon: MenuBook,
        path: '/knowledge/articles',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT, USER_ROLES.COMMUNITY_MANAGER]
      },
      {
        title: 'ภูมิปัญญาชาวบ้าน',
        icon: Psychology,
        path: '/knowledge/wisdom',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.COMMUNITY_MANAGER]
      }
    ]
  },
  {
    title: 'รายงาน',
    icon: Assessment,
    roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT],
    children: [
      {
        title: 'สร้างรายงาน',
        icon: Assessment,
        path: '/reports/create',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER, USER_ROLES.GOVERNMENT]
      },
      {
        title: 'ส่งออกข้อมูล',
        icon: FileDownload,
        path: '/reports/export',
        roles: [USER_ROLES.ADMIN, USER_ROLES.RESEARCHER]
      }
    ]
  },
  {
    title: 'ตั้งค่าระบบ',
    icon: Settings,
    path: '/settings',
    roles: [USER_ROLES.ADMIN]
  }
];

const Sidebar = ({ open, onClose, variant = 'temporary' }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, hasAnyRole } = useAuth();
  const [openMenus, setOpenMenus] = useState({});

  const handleMenuClick = (item) => {
    if (item.children) {
      setOpenMenus(prev => ({
        ...prev,
        [item.title]: !prev[item.title]
      }));
    } else if (item.path) {
      router.push(item.path);
      if (variant === 'temporary') {
        onClose();
      }
    }
  };

  const isActive = (path) => {
    return pathname === path;
  };

  const isParentActive = (children) => {
    return children?.some(child => isActive(child.path));
  };

  const renderMenuItem = (item, isChild = false, index = 0) => {
    if (!hasAnyRole(item.roles)) {
      return null;
    }

    const hasChildren = item.children && item.children.length > 0;
    const menuOpen = openMenus[item.title];
    const active = item.path ? isActive(item.path) : isParentActive(item.children);

    // Alternating background colors for parent menu items
    const backgroundColors = [
      'rgba(245, 247, 250, 0.5)',   // Light grey-blue
      'rgba(227, 242, 253, 0.5)',   // Light blue
      'rgba(232, 245, 233, 0.5)',   // Light green
      'rgba(255, 243, 224, 0.5)',   // Light orange
      'rgba(243, 229, 245, 0.5)',   // Light purple
    ];

    const parentBgColor = !isChild ? backgroundColors[index % backgroundColors.length] : 'transparent';

    return (
      <Box key={item.title}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => handleMenuClick(item)}
            sx={{
              pl: isChild ? 4 : 2,
              py: 1,
              backgroundColor: active ? 'primary.light' : parentBgColor,
              color: active ? 'primary.contrastText' : 'text.primary',
              '&:hover': {
                backgroundColor: active ? 'primary.main' : 'action.hover',
              },
              borderRadius: 1,
              mx: 1,
              my: 0.5
            }}
          >
            <ListItemIcon sx={{
              color: active ? 'primary.contrastText' : 'text.primary',
              minWidth: 40
            }}>
              {item.iconType === 'svg' ? (
                <Box
                  component="img"
                  src={item.icon}
                  alt={item.title}
                  sx={{
                    width: 20,
                    height: 20,
                    filter: active ? 'brightness(0) invert(1)' : 'none'
                  }}
                />
              ) : (
                <item.icon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={item.title}
              primaryTypographyProps={{
                fontSize: isChild ? '0.875rem' : '0.9rem',
                fontWeight: active ? 600 : 400
              }}
            />
            {hasChildren && (
              menuOpen ? <ExpandLess /> : <ExpandMore />
            )}
          </ListItemButton>
        </ListItem>

        {hasChildren && (
          <Collapse in={menuOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children.map(child => renderMenuItem(child, true, index))}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            component="img"
            src="/icons/fishing-spot-marker.svg"
            alt="Mekong Fish"
            sx={{ width: 40, height: 40 }}
          />
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Mekong Fish
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Dashboard
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* User Info */}
      {userProfile && (
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
              {userProfile.email?.charAt(0).toUpperCase()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="body2" fontWeight="medium">
                {userProfile.name || userProfile.email}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip 
                  label={userProfile.role} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation Menu */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        <List>
          {menuItems.map((item, index) => renderMenuItem(item, false, index))}
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Mekong Fish Dashboard v1.0.0
        </Typography>
        <Typography variant="caption" color="text.secondary">
          © 2024 All rights reserved
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;
export { SIDEBAR_WIDTH };
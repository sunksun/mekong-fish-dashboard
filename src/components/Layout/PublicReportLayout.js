'use client';

import Link from 'next/link';
import { AppBar, Toolbar, Typography, Button, Box, Container } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

const PublicReportLayout = ({ children }) => {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="default" elevation={1} sx={{ bgcolor: 'white' }}>
        <Toolbar>
          <Button
            component={Link}
            href="/landing"
            startIcon={<ArrowBack />}
            color="inherit"
          >
            กลับหน้าแรก
          </Button>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ ml: 2 }}>
            Mekong Fish Dashboard — รายงาน
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="main">
        {children}
      </Box>
    </Box>
  );
};

export default PublicReportLayout;

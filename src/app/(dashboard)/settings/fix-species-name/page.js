'use client';

import { useState } from 'react';
import {
  Box, Container, Typography, Card, CardContent, TextField, Button,
  Alert, CircularProgress, Stack,
} from '@mui/material';
import { AutoFixHigh, WarningAmber } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { authFetch } from '@/lib/api-client';

export default function AdminUtilitiesPage() {
  return (
    <DashboardLayout>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          เครื่องมือ Admin
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          เครื่องมือดูแลระบบสำหรับ admin เท่านั้น
        </Typography>

        <FixSpeciesCard />
      </Container>
    </DashboardLayout>
  );
}

function FixSpeciesCard() {
  const [from, setFrom] = useState('สะงิ้ว');
  const [to, setTo] = useState('สะงั่ว');
  const [fromLocal, setFromLocal] = useState('นางสะงิ้ว');
  const [toLocal, setToLocal] = useState('นางสะงั้ว');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const call = async (dryRun) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await authFetch('/api/admin/fix-species-name', {
        method: 'POST',
        body: JSON.stringify({ from, to, fromLocal, toLocal, dryRun }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'API error');
      setResult({ dryRun, ...json });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <AutoFixHigh sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight="bold">แก้ชื่อปลาสะกดผิดใน Firestore</Typography>
        </Box>
        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 2 }}>
          กด <b>Dry-run</b> ก่อนเพื่อดูจำนวนที่จะแก้ → ถ้าถูกต้องค่อยกด <b>Apply</b>
        </Alert>

        <Stack spacing={2} mb={2}>
          <Box display="flex" gap={2}>
            <TextField fullWidth size="small" label="common_name_thai (จาก)" value={from} onChange={e => setFrom(e.target.value)} />
            <TextField fullWidth size="small" label="เปลี่ยนเป็น" value={to} onChange={e => setTo(e.target.value)} />
          </Box>
          <Box display="flex" gap={2}>
            <TextField fullWidth size="small" label="local_name (จาก)" value={fromLocal} onChange={e => setFromLocal(e.target.value)} />
            <TextField fullWidth size="small" label="เปลี่ยนเป็น" value={toLocal} onChange={e => setToLocal(e.target.value)} />
          </Box>
        </Stack>

        <Box display="flex" gap={2} alignItems="center">
          <Button variant="outlined" disabled={loading} onClick={() => call(true)}>Dry-run</Button>
          <Button variant="contained" color="error" disabled={loading} onClick={() => call(false)}>Apply</Button>
          {loading && <CircularProgress size={20} />}
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {result && (
          <Alert severity={result.dryRun ? 'info' : 'success'} sx={{ mt: 2 }}>
            <strong>{result.dryRun ? 'Dry-run:' : 'สำเร็จ:'}</strong>{' '}
            fish_species {result.fish_species.matched} doc · fishingRecords {result.fishingRecords.matchedDocs}/{result.fishingRecords.scannedDocs} docs · {result.fishingRecords.replacedFields} fields
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

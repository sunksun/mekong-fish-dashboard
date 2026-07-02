'use client';

import { useState } from 'react';
import {
  Box, Container, Typography, Card, CardContent, TextField, Button,
  Alert, CircularProgress, Divider, Stack,
} from '@mui/material';
import { AutoFixHigh, WarningAmber } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { auth } from '@/lib/firebase';

export default function FixSpeciesNamePage() {
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
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('กรุณา login ก่อน');
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/fix-species-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
    <DashboardLayout>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <AutoFixHigh sx={{ fontSize: 36, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">
              แก้ชื่อปลาสะกดผิดใน Firestore
            </Typography>
            <Typography variant="body2" color="text.secondary">
              เครื่องมือ admin — แก้ทั้ง fish_species และ fishingRecords.fishList[]
            </Typography>
          </Box>
        </Box>

        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 3 }}>
          <strong>แนะนำ:</strong> กด <b>Dry-run</b> ก่อนเพื่อดูจำนวนที่จะถูกแก้
          → ถ้าตัวเลขถูกต้องค่อยกด <b>Apply</b>
        </Alert>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              รายการที่จะแก้
            </Typography>
            <Stack spacing={2} mt={1}>
              <Box display="flex" gap={2}>
                <TextField
                  fullWidth size="small" label="common_name_thai (จาก)"
                  value={from} onChange={e => setFrom(e.target.value)}
                />
                <TextField
                  fullWidth size="small" label="เปลี่ยนเป็น"
                  value={to} onChange={e => setTo(e.target.value)}
                />
              </Box>
              <Box display="flex" gap={2}>
                <TextField
                  fullWidth size="small" label="local_name (จาก)"
                  value={fromLocal} onChange={e => setFromLocal(e.target.value)}
                />
                <TextField
                  fullWidth size="small" label="เปลี่ยนเป็น"
                  value={toLocal} onChange={e => setToLocal(e.target.value)}
                />
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Box display="flex" gap={2}>
              <Button
                variant="text" disabled={loading}
                onClick={async () => {
                  setError(null); setResult(null);
                  try {
                    const currentUser = auth.currentUser;
                    if (!currentUser) throw new Error('กรุณา login');
                    const token = await currentUser.getIdToken();
                    const res = await fetch('/api/admin/whoami', {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const json = await res.json();
                    setResult({ whoami: true, ...json });
                  } catch (e) { setError(e.message); }
                }}
              >
                ตรวจสิทธิ์ (whoami)
              </Button>
              <Button
                variant="outlined" disabled={loading}
                onClick={() => call(true)}
              >
                Dry-run (ตรวจก่อน)
              </Button>
              <Button
                variant="contained" color="error" disabled={loading}
                onClick={() => call(false)}
              >
                Apply (แก้จริง)
              </Button>
              {loading && <CircularProgress size={24} sx={{ ml: 1 }} />}
            </Box>
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {result?.whoami && (
          <Card sx={{ mb: 2, bgcolor: '#e3f2fd' }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>ผลตรวจสิทธิ์</Typography>
              <Typography variant="body2" component="pre" sx={{ fontSize: 12, m: 0 }}>
                {JSON.stringify(result, null, 2)}
              </Typography>
            </CardContent>
          </Card>
        )}

        {result && !result.whoami && (
          <Card sx={{ bgcolor: result.dryRun ? '#fff8e1' : '#e8f5e9' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                ผลลัพธ์ {result.dryRun ? '(Dry-run เท่านั้น)' : '✅ แก้แล้วในฐานข้อมูล'}
              </Typography>
              <Typography variant="body2" component="div">
                <ul>
                  <li>
                    <b>fish_species:</b> พบ {result.fish_species.matched} doc ที่จะแก้
                  </li>
                  <li>
                    <b>fishingRecords:</b> สแกน {result.fishingRecords.scannedDocs} docs · พบ {result.fishingRecords.matchedDocs} docs ที่มีชื่อผิด · แทน {result.fishingRecords.replacedFields} field
                  </li>
                </ul>
              </Typography>

              {result.fish_species.updated?.length > 0 && (
                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">รายละเอียด fish_species:</Typography>
                  <pre style={{ fontSize: 11, background: '#f5f5f5', padding: 8, borderRadius: 4, overflow: 'auto' }}>
                    {JSON.stringify(result.fish_species.updated, null, 2)}
                  </pre>
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Container>
    </DashboardLayout>
  );
}

'use client';

import { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Card, CardContent, Grid, CircularProgress,
  Alert, ToggleButtonGroup, ToggleButton, Select, MenuItem, FormControl,
  InputLabel, Tooltip, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper
} from '@mui/material';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Science, InfoOutlined } from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const metricInfo = {
  H: {
    label: "Shannon-Wiener (H')",
    color: '#1976d2',
    desc: "วัดความหลากหลายโดยคำนึงถึงจำนวนชนิดและความสม่ำเสมอของการกระจาย ค่ายิ่งสูง = ความหลากหลายสูง (ทั่วไป 1.5–3.5)",
  },
  D: {
    label: "Simpson's (1-D)",
    color: '#388e3c',
    desc: "ความน่าจะเป็นที่สิ่งมีชีวิต 2 ตัวสุ่มมาได้จะเป็นคนละชนิด ค่า 0–1 ยิ่งสูง = หลากหลายมาก",
  },
  S: {
    label: "Species Richness (S)",
    color: '#f57c00',
    desc: "จำนวนชนิดปลาที่พบในแต่ละช่วงเวลา",
  },
};

function StatCard({ label, value, unit, color, desc }) {
  return (
    <Card sx={{ height: '100%', borderTop: `4px solid ${color}` }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Tooltip title={desc} arrow>
            <InfoOutlined fontSize="small" sx={{ color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        </Box>
        <Typography variant="h4" fontWeight="bold" sx={{ color, mt: 1 }}>
          {value ?? '—'}
        </Typography>
        {unit && <Typography variant="caption" color="text.secondary">{unit}</Typography>}
      </CardContent>
    </Card>
  );
}

export default function BiodiversityPage() {
  const { userProfile } = useAuth();
  const [mode, setMode] = useState('monthly');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/biodiversity?mode=${mode}&year=${year}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res.data);
        else setError(res.error);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [mode, year]);

  // Latest period summary
  const latest = data[data.length - 1];
  const prev = data[data.length - 2];

  const delta = (key) => {
    if (!latest || !prev) return null;
    const d = latest[key] - prev[key];
    return d > 0 ? `+${d.toFixed(3)}` : d.toFixed(3);
  };

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Science sx={{ fontSize: 36, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">ดัชนีความหลากหลายทางชีวภาพ</Typography>
            <Typography variant="body2" color="text.secondary">
              Shannon-Wiener (H'), Simpson's (1-D), Species Richness (S) — คำนวณจากข้อมูลการจับปลา
            </Typography>
          </Box>
        </Box>

        {/* Controls */}
        <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => v && setMode(v)}
            size="small"
          >
            <ToggleButton value="monthly">รายเดือน</ToggleButton>
            <ToggleButton value="yearly">รายปี</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'monthly' && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>ปี</InputLabel>
              <Select value={year} label="ปี" onChange={e => setYear(e.target.value)}>
                {YEAR_OPTIONS.map(y => (
                  <MenuItem key={y} value={String(y)}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {latest && (
            <Chip
              label={`ข้อมูลล่าสุด: ${latest.period} | ${latest.totalIndividuals} ตัว`}
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        ) : data.length === 0 ? (
          <Alert severity="info">ไม่พบข้อมูลในช่วงที่เลือก</Alert>
        ) : (
          <>
            {/* Summary Cards */}
            <Grid container spacing={2} mb={3}>
              {Object.entries(metricInfo).map(([key, info]) => (
                <Grid item xs={12} sm={4} key={key}>
                  <StatCard
                    label={info.label}
                    value={latest?.[key]}
                    unit={delta(key) ? `เทียบช่วงก่อน: ${delta(key)}` : undefined}
                    color={info.color}
                    desc={info.desc}
                  />
                </Grid>
              ))}
            </Grid>

            {/* H' and D Line Chart */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  แนวโน้มดัชนี H' และ 1-D
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 'auto']} tick={{ fontSize: 12 }} />
                    <ReTooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="H"
                      name="H' (Shannon)"
                      stroke={metricInfo.H.color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="D"
                      name="1-D (Simpson)"
                      stroke={metricInfo.D.color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Species Richness Bar Chart */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  ความอุดมสมบูรณ์ของชนิดพันธุ์ (S) และจำนวนตัวที่จับได้
                </Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <ReTooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="S" name="จำนวนชนิด (S)" fill={metricInfo.S.color} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="totalIndividuals" name="จำนวนตัวที่จับ" fill="#90caf9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top species table for latest period */}
            {latest?.species?.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                    ชนิดปลาที่พบมากที่สุด — {latest.period}
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                          <TableCell>อันดับ</TableCell>
                          <TableCell>ชนิดปลา</TableCell>
                          <TableCell align="right">จำนวน (ตัว)</TableCell>
                          <TableCell align="right">สัดส่วน (%)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {latest.species.map((fish, i) => (
                          <TableRow key={fish.name} hover>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell>{fish.name}</TableCell>
                            <TableCell align="right">{fish.count}</TableCell>
                            <TableCell align="right">
                              {((fish.count / latest.totalIndividuals) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Container>
    </DashboardLayout>
  );
}

'use client';

import {
  Typography,
  Card,
  CardContent,
  Alert,
  Box,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save,
  RestoreRounded
} from '@mui/icons-material';
import DashboardLayout from '@/components/Layout/DashboardLayout';

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <Box sx={{ p: 1, pl: 1.5 }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          ตั้งค่าระบบ
        </Typography>
        <Typography variant="body1" color="text.secondary">
          จัดการการตั้งค่าระบบและกำหนดค่าต่างๆ
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* General Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <SettingsIcon />
                <Typography variant="h6">ตั้งค่าทั่วไป</Typography>
              </Box>

              <Box display="flex" flexDirection="column" gap={2}>
                <TextField
                  label="ชื่อระบบ"
                  defaultValue="Mekong Fish Dashboard"
                  size="small"
                  fullWidth
                />

                <FormControl size="small" fullWidth>
                  <InputLabel>ภาษา</InputLabel>
                  <Select defaultValue="th" label="ภาษา">
                    <MenuItem value="th">ไทย</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel>เขตเวลา</InputLabel>
                  <Select defaultValue="asia/bangkok" label="เขตเวลา">
                    <MenuItem value="asia/bangkok">Asia/Bangkok (UTC+7)</MenuItem>
                    <MenuItem value="utc">UTC (UTC+0)</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="เปิดใช้งานการแจ้งเตือน"
                />

                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="บันทึก Activity Logs"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Data Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ตั้งค่าข้อมูล
              </Typography>

              <Box display="flex" flexDirection="column" gap={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel>การซิงค์ข้อมูล</InputLabel>
                  <Select defaultValue="realtime" label="การซิงค์ข้อมูล">
                    <MenuItem value="realtime">Real-time</MenuItem>
                    <MenuItem value="hourly">ทุกชั่วโมง</MenuItem>
                    <MenuItem value="daily">ทุกวัน</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="ระยะเวลาเก็บ Logs (วัน)"
                  type="number"
                  defaultValue="30"
                  size="small"
                  fullWidth
                />

                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Auto Backup ข้อมูล"
                />

                <FormControlLabel
                  control={<Switch />}
                  label="ลบข้อมูลเก่าอัตโนมัติ"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ความปลอดภัย
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Session Timeout (นาที)"
                    type="number"
                    defaultValue="60"
                    size="small"
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    label="Max Login Attempts"
                    type="number"
                    defaultValue="5"
                    size="small"
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Password Policy</InputLabel>
                    <Select defaultValue="medium" label="Password Policy">
                      <MenuItem value="low">ต่ำ</MenuItem>
                      <MenuItem value="medium">ปานกลาง</MenuItem>
                      <MenuItem value="high">สูง</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Box mt={2}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="เปิดใช้งาน Two-Factor Authentication"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* API Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                API และการเชื่อมต่อ
              </Typography>

              <Box display="flex" flexDirection="column" gap={2}>
                <TextField
                  label="API Rate Limit (requests/minute)"
                  type="number"
                  defaultValue="100"
                  size="small"
                  fullWidth
                />

                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="เปิดใช้งาน API Documentation"
                />

                <FormControlLabel
                  control={<Switch />}
                  label="Allow External API Access"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box display="flex" gap={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              startIcon={<RestoreRounded />}
            >
              รีเซ็ตค่าเริ่มต้น
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
            >
              บันทึกการตั้งค่า
            </Button>
          </Box>
        </Grid>
      </Grid>

      {/* Development Notice */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>หมายเหตุการพัฒนา:</strong> การตั้งค่าเหล่านี้ยังไม่ได้เชื่อมต่อกับระบบจริง 
          ในระยะต่อไปจะเชื่อมต่อกับ Firebase และบันทึกการตั้งค่าจริง
        </Typography>
      </Alert>
      </Box>
    </DashboardLayout>
  );
}
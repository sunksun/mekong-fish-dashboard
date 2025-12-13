/** @type {import('next').NextConfig} */
const nextConfig = {
  // สำคัญ! ต้องเพิ่ม output: 'standalone' สำหรับ Firebase App Hosting
  // ทำให้ Next.js build แบบ containerized deployment
  output: 'standalone',

  // Optional: Disable minification ถ้าเกิด error ตอน build
  // swcMinify: true,
};

export default nextConfig;

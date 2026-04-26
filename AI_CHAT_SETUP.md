# 🤖 AI Chat Setup Guide

## การตั้งค่าระบบ AI Q&A สำหรับหน้า Landing

ระบบนี้ใช้ **Google Gemini AI (ฟรี)** เพื่อตอบคำถามเกี่ยวกับปลาแม่น้ำโขงโดยอัตโนมัติ

---

## 📋 ขั้นตอนการตั้งค่า

### 1. สมัคร Gemini API Key (ฟรี)

1. เข้าไปที่: https://ai.google.dev/
2. คลิก **"Get API key in Google AI Studio"**
3. Login ด้วย Google Account
4. คลิก **"Create API Key"**
5. เลือก project หรือสร้างใหม่
6. **คัดลอก API Key** ที่ได้

### 2. เพิ่ม API Key ในโปรเจค

เปิดไฟล์ `.env.local` และแก้ไขบรรทัด:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

เปลี่ยน `YOUR_GEMINI_API_KEY_HERE` เป็น API Key ที่คุณได้จากขั้นตอนที่ 1

**ตัวอย่าง:**
```env
GEMINI_API_KEY=AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 3. Restart Development Server

```bash
# หยุด server ปัจจุบัน (Ctrl+C)
# จากนั้นรันใหม่
npm run dev
```

---

## ✅ ทดสอบการทำงาน

1. เปิดหน้า Landing: http://localhost:3000/landing
2. คลิกที่ช่อง **"ถามเกี่ยวกับปลาแม่น้ำโขง... 🐟 (AI)"**
3. ลองถามคำถามเหล่านี้:
   - "ปลาอะไรจับได้บ่อยที่สุด"
   - "มีปลาหายากอะไรบ้าง"
   - "ตะเพียนคืออะไร"
   - "แม่น้ำโขงมีปลากี่ชนิด"

---

## 🎯 คุณสมบัติ

### ✨ Features:

1. **ตอบคำถามอัจฉริยะ** - ใช้ Gemini AI ตอบคำถามภาษาไทย
2. **ดึงข้อมูลจาก Firebase** - ใช้ข้อมูลจริงจากฐานข้อมูล
3. **Quick Prompts** - มีตัวอย่างคำถามให้เลือก
4. **Chat Interface** - UI สวยงามแบบ ChatGPT
5. **Real-time** - ตอบคำถามแบบ real-time

### 📊 ข้อมูลที่ AI สามารถตอบได้:

- **ข้อมูลปลา** จาก `fish_species` collection (96 ชนิด)
- **สถิติการจับปลา** จาก `fishingRecords` (655 ครั้ง)
- **ข่าวสาร** จาก `newsArticles`
- **ชื่อท้องถิ่น** ของปลาแต่ละชนิด
- **สถานะ IUCN** (ปลาหายาก)
- **วงศ์และตระกูล** ของปลา

---

## 💰 ค่าใช้จ่าย

### Gemini API Free Tier:

- ✅ **ฟรี 100%** สำหรับ Gemini Pro
- ✅ **60 requests/minute** (เพียงพอสำหรับ landing page)
- ✅ **ไม่ต้องใส่บัตรเครดิต**

**หมายเหตุ**: ถ้าเกิน rate limit จะได้ error message และแนะนำให้ใช้ช่องค้นหาแบบปกติแทน

---

## 🔧 ไฟล์ที่เกี่ยวข้อง

### ไฟล์ใหม่ที่สร้าง:

1. **`src/app/api/chat/route.js`**
   - API endpoint สำหรับ AI chat
   - จัดการการเรียก Gemini AI
   - ดึงข้อมูลจาก Firebase

2. **`src/components/ChatInterface.js`**
   - Chat UI component
   - รองรับ messages, loading states
   - มี Quick Prompts

### ไฟล์ที่แก้ไข:

1. **`src/app/landing/page.js`**
   - เปลี่ยนช่องค้นหาเป็นปุ่ม AI Chat
   - เพิ่ม Dialog สำหรับแสดง ChatInterface

2. **`.env.local`**
   - เพิ่ม `GEMINI_API_KEY`

3. **`package.json`**
   - เพิ่ม `@google/generative-ai`

---

## 🐛 Troubleshooting

### ปัญหา: "ระบบ AI ยังไม่พร้อมใช้งาน"

**สาเหตุ**: ไม่มี API Key หรือ API Key ไม่ถูกต้อง

**วิธีแก้**:
1. ตรวจสอบว่าแก้ไข `.env.local` แล้ว
2. ตรวจสอบว่า API Key ถูกต้อง (เริ่มด้วย `AIza...`)
3. Restart development server

### ปัญหา: "API key not valid"

**สาเหตุ**: API Key หมดอายุหรือไม่ถูกต้อง

**วิธีแก้**:
1. สร้าง API Key ใหม่ที่ https://ai.google.dev/
2. อัปเดตใน `.env.local`
3. Restart server

### ปัญหา: "Resource has been exhausted (e.g. check quota)"

**สาเหตุ**: เกิน rate limit (60 requests/minute)

**วิธีแก้**:
- รอ 1 นาที แล้วลองใหม่
- หรือใช้ช่องค้นหาปกติแทน

---

## 📝 ตัวอย่างคำถามที่แนะนำ

### คำถามเกี่ยวกับปลา:
- "ปลาอะไรจับได้บ่อยที่สุด"
- "ปลาตะเพียนคืออะไร"
- "ปลากุ้งจ่มมีชื่อท้องถิ่นว่าอะไร"
- "มีปลาหายากอะไรบ้าง"

### คำถามเกี่ยวกับสถิติ:
- "แม่น้ำโขงมีปลากี่ชนิด"
- "มีการบันทึกการจับปลากี่ครั้ง"
- "น้ำหนักรวมของปลาที่จับได้เท่าไหร่"
- "ปลาอะไรมีมูลค่ามากที่สุด"

### คำถามเชิงวิเคราะห์:
- "เดือนไหนจับปลาได้มากที่สุด"
- "วิธีการจับปลาที่นิยมคืออะไร"
- "แหล่งน้ำไหนมีปลาเยอะที่สุด"

---

## 🚀 การ Deploy

เมื่อ deploy ขึ้น production (Firebase Hosting) ให้แน่ใจว่า:

1. ✅ เพิ่ม Environment Variable `GEMINI_API_KEY` ใน Firebase:
   ```bash
   firebase functions:config:set gemini.api_key="YOUR_API_KEY"
   ```

2. ✅ หรือใช้ Firebase Config ใน `firebase.json`

3. ✅ Deploy:
   ```bash
   npm run build
   npm run deploy
   ```

---

## 📚 เอกสารเพิ่มเติม

- **Gemini AI Documentation**: https://ai.google.dev/docs
- **Free Tier Limits**: https://ai.google.dev/pricing
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

---

## ✅ Checklist

- [ ] สมัคร Gemini API Key
- [ ] เพิ่ม API Key ใน `.env.local`
- [ ] Restart development server
- [ ] ทดสอบถามคำถามใน landing page
- [ ] ตรวจสอบว่าได้คำตอบเป็นภาษาไทย
- [ ] Deploy ขึ้น production (ถ้าต้องการ)

---

**สร้างโดย**: Claude Code 🤖
**วันที่**: เมษายน 2568

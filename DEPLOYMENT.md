# Firebase App Hosting - Deployment Guide

## 📋 ข้อกำหนดเบื้องต้น

- Node.js 18+
- Firebase CLI 14.19.1+ (ติดตั้งแล้ว ✅)
- บัญชี Firebase และ Project

---

## 🚀 ขั้นตอนการ Deploy

### 1. Login เข้า Firebase

```bash
firebase login
```

### 2. ตั้งค่า Firebase Project

แก้ไขไฟล์ `.firebaserc` และเปลี่ยน `your-project-id` เป็น Project ID ของคุณ:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

หรือใช้คำสั่ง:

```bash
firebase use --add
```

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env.production` (ถ้ายังไม่มี):

```bash
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="your_private_key"
```

**สำคัญ:** อัพโหลด environment variables ไปที่ Firebase:

```bash
firebase functions:config:set \
  firebase.project_id="your_project_id" \
  firebase.client_email="your_service_account_email" \
  firebase.private_key="your_private_key"
```

### 4. Build โปรเจค

```bash
npm run build
```

### 5. Deploy ไปที่ Firebase App Hosting

```bash
npm run deploy
```

หรือใช้คำสั่ง Firebase โดยตรง:

```bash
firebase deploy --only hosting
```

---

## 🔧 การตั้งค่าไฟล์สำคัญ

### `firebase.json`
```json
{
  "hosting": {
    "source": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "frameworksBackend": {
      "region": "asia-southeast1"
    }
  }
}
```

**หมายเหตุ:**
- `source: "."` = ใช้ Next.js framework integration
- `region: "asia-southeast1"` = Deploy ที่ Singapore (ใกล้ไทย)

### `package.json` (Updated)
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "deploy": "firebase deploy --only hosting"
  }
}
```

**หมายเหตุ:** ลบ `--turbopack` ออกจาก build script เพราะ Firebase App Hosting รองรับ standard build

---

## 📝 คำสั่งที่มีประโยชน์

### ดู Firebase Projects
```bash
firebase projects:list
```

### เลือก Project
```bash
firebase use <project-id>
```

### ดู Hosting URL
```bash
firebase hosting:channel:list
```

### Deploy แบบ Preview
```bash
firebase hosting:channel:deploy preview-name
```

### ดู Logs
```bash
firebase functions:log
```

---

## 🌍 URL หลัง Deploy

หลังจาก deploy สำเร็จ เว็บไซต์จะอยู่ที่:
- **Production:** `https://your-project-id.web.app`
- **Custom Domain:** ตั้งค่าได้ใน Firebase Console → Hosting

---

## ⚠️ ข้อควรระวัง

1. **Environment Variables:**
   - ตั้งค่าใน Firebase Console → Functions → Configuration
   - หรือใช้ `firebase functions:config:set`

2. **Service Account:**
   - ดาวน์โหลดจาก Firebase Console → Project Settings → Service Accounts
   - เก็บ private key ให้ปลอดภัย

3. **Firestore Rules:**
   - ตรวจสอบว่า Firestore rules อนุญาตการเข้าถึงถูกต้อง

4. **Storage Rules:**
   - ตั้งค่า Storage rules สำหรับรูปภาพปลา

5. **API Routes:**
   - Next.js API routes จะทำงานเป็น Cloud Functions อัตโนมัติ

---

## 🐛 Troubleshooting

### ปัญหา: Build ล้มเหลว
```bash
# ลบ cache และ rebuild
rm -rf .next
npm run build
```

### ปัญหา: Environment variables ไม่ทำงาน
```bash
# ตรวจสอบ config
firebase functions:config:get

# Set ใหม่
firebase functions:config:set key="value"
```

### ปัญหา: Firebase Admin SDK ไม่ทำงาน
- ตรวจสอบ service account credentials
- ตรวจสอบว่า FIREBASE_PRIVATE_KEY มี newlines ถูกต้อง (ใช้ `\\n`)

---

## 📚 เอกสารเพิ่มเติม

- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [Next.js on Firebase](https://firebase.google.com/docs/app-hosting/frameworks/nextjs)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)

---

## ✅ Checklist ก่อน Deploy

- [ ] Login Firebase CLI (`firebase login`)
- [ ] ตั้งค่า Project ID ใน `.firebaserc`
- [ ] ตั้งค่า Environment Variables
- [ ] Test build locally (`npm run build`)
- [ ] ตรวจสอบ Firestore Rules
- [ ] ตรวจสอบ Storage Rules
- [ ] Deploy (`npm run deploy`)
- [ ] ทดสอบเว็บไซต์ที่ production URL

---

**Good luck! 🚀**

# 🚀 คู่มือการ Deploy Mekong Fish Dashboard

## 📋 สิ่งที่ต้องเตรียม

- ✅ Firebase Project: `tracking-fish-app`
- ✅ GitHub Repository: `https://github.com/sunksun/mekong-fish-dashboard.git`
- ✅ Domain: `mekongfish.info` (Cloudflare)
- ✅ Firebase CLI: v14.19.1

---

## 🔥 ขั้นตอนที่ 1: Initialize Firebase App Hosting

### 1.1 Login Firebase (ถ้ายังไม่ได้ login)

```bash
firebase login
```

### 1.2 Initialize App Hosting

```bash
firebase init apphosting
```

**คำตอบที่แนะนำ:**
```
? Please select an option:
  → Create a new backend

? What would you like to call your backend?
  → mekong-fish-dashboard

? Choose a Git repository:
  → sunksun/mekong-fish-dashboard

? Choose a branch:
  → main

? Do you want to set up GitHub Actions?
  → Yes (แนะนำ - deploy อัตโนมัติเมื่อ push code)

? Set up automatic deploys on Git push?
  → Yes
```

---

## 🌍 ขั้นตอนที่ 2: ตั้งค่า Environment Variables

ต้องตั้งค่า environment variables ที่จำเป็นสำหรับ production

### 2.1 ตั้งค่าผ่าน Firebase Console (แนะนำ)

1. ไปที่: https://console.firebase.google.com
2. เลือกโปรเจค: `tracking-fish-app`
3. ไปที่: **App Hosting** → **Backends** → `mekong-fish-dashboard`
4. คลิก: **Settings** → **Environment Variables**
5. เพิ่มตัวแปรต่อไปนี้:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBqDCZidQSSGzhZu0hS1bZtxD4pJLYvIgY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tracking-fish-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tracking-fish-app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tracking-fish-app.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=587580376587
NEXT_PUBLIC_FIREBASE_APP_ID=1:587580376587:web:a35c9caf6acab6a110290e
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyAiXjNpIp6OwXf4VF8wfE-SM7GO2IUO6pE
NEXT_PUBLIC_APP_NAME=Mekong Fish Dashboard
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 2.2 หรือตั้งค่าผ่าน Firebase CLI

```bash
# ตั้งค่าทีละตัว
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_API_KEY
firebase apphosting:secrets:set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
# ... และตัวแปรอื่นๆ
```

---

## 📦 ขั้นตอนที่ 3: Push Code ไป GitHub

```bash
# 1. เช็คสถานะ
git status

# 2. เพิ่มไฟล์ใหม่
git add .

# 3. Commit
git commit -m "Add Firebase App Hosting config and deployment setup"

# 4. Push ไป GitHub
git push origin main
```

**หลังจาก push แล้ว:**
- GitHub Actions จะรัน build อัตโนมัติ
- Firebase จะ deploy app ของคุณ
- รอประมาณ 5-10 นาที

---

## 🔗 ขั้นตอนที่ 4: เชื่อมโดเมน mekongfish.info

### 4.1 เปิด Firebase Console

1. ไปที่: https://console.firebase.google.com
2. เลือกโปรเจค: `tracking-fish-app`
3. ไปที่: **App Hosting** → **Backends** → `mekong-fish-dashboard`
4. คลิก: **Custom Domains** → **Add Custom Domain**

### 4.2 ใส่โดเมนของคุณ

```
Domain: mekongfish.info
```

คลิก **Continue**

### 4.3 Firebase จะแสดง DNS Records ที่ต้องตั้งค่า

Firebase จะให้ข้อมูลประมาณนี้:

```
Type    Name    Value
A       @       199.36.158.100
A       www     199.36.158.100
TXT     @       firebase-site-verification=xxxxxxxxxxxxx
```

**หมายเหตุ:** ค่า IP address และ verification code จะแตกต่างกันไป

---

## ☁️ ขั้นตอนที่ 5: ตั้งค่า DNS ใน Cloudflare

### 5.1 Login Cloudflare

ไปที่: https://dash.cloudflare.com

### 5.2 เลือกโดเมน mekongfish.info

### 5.3 ไปที่ DNS Settings

คลิก: **DNS** → **Records**

### 5.4 ลบ Records เก่า (ถ้ามี)

ลบ A records หรือ CNAME ที่ชี้ไปที่อื่นออก

### 5.5 เพิ่ม DNS Records ใหม่

**ตามที่ Firebase บอก** เช่น:

#### เพิ่ม A Record สำหรับ root domain:
```
Type: A
Name: @
IPv4 address: 199.36.158.100  (ตามที่ Firebase บอก)
Proxy status: DNS only (ปิด Proxy สีเทา ⛅)
TTL: Auto
```

#### เพิ่ม A Record สำหรับ www:
```
Type: A
Name: www
IPv4 address: 199.36.158.100  (ตามที่ Firebase บอก)
Proxy status: DNS only (ปิด Proxy สีเทา ⛅)
TTL: Auto
```

#### เพิ่ม TXT Record สำหรับ Verification:
```
Type: TXT
Name: @
Content: firebase-site-verification=xxxxx  (ตามที่ Firebase บอก)
TTL: Auto
```

**⚠️ สำคัญ:** ต้องปิด Cloudflare Proxy (สีเทา ⛅) ไม่ใช่สีส้ม ☁️

### 5.6 คลิก Save

---

## ⏰ ขั้นตอนที่ 6: รอ DNS Propagate

### 6.1 กลับไปที่ Firebase Console

Firebase จะตรวจสอบ DNS records ของคุณ

### 6.2 คลิก "Verify"

Firebase จะเช็คว่า DNS ตั้งค่าถูกต้องหรือยัง

**ถ้าผ่าน:**
- ✅ Status จะเป็น "Connected"
- ✅ Firebase จะออก SSL Certificate ให้อัตโนมัติ (ใช้เวลา 15-30 นาที)

**ถ้าไม่ผ่าน:**
- ⏰ รอ 15-30 นาที แล้วลอง Verify อีกครั้ง
- 🔍 เช็คว่า DNS records ตั้งค่าถูกต้องหรือไม่
- ⛅ เช็คว่าปิด Cloudflare Proxy แล้วหรือยัง

### 6.3 เช็คสถานะ DNS

ใช้เครื่องมือเช็ค DNS:

```bash
# บน Mac/Linux
dig mekongfish.info
dig www.mekongfish.info

# หรือเช็คออนไลน์
https://dnschecker.org
```

---

## ✅ ขั้นตอนที่ 7: ทดสอบเว็บไซต์

### 7.1 เปิดเว็บในเบราว์เซอร์

```
https://mekongfish.info
https://www.mekongfish.info
```

### 7.2 เช็คว่า SSL ทำงาน

ดูว่ามีกุญแจ 🔒 ข้าง URL หรือไม่

### 7.3 ทดสอบ Features

- ✅ Login ทำงานไหม
- ✅ Firebase เชื่อมต่อได้ไหม
- ✅ Google Maps แสดงผลไหม
- ✅ ข้อมูลโหลดจาก Firestore ได้ไหม

---

## 🐛 การแก้ปัญหา

### ปัญหา: DNS ไม่อัพเดท

**วิธีแก้:**
```bash
# Clear DNS cache (Mac)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Clear DNS cache (Windows)
ipconfig /flushdns

# ลองใช้ Incognito/Private Mode
# ลองใช้ DNS อื่น เช่น 8.8.8.8 (Google DNS)
```

### ปัญหา: SSL Certificate ยังไม่ออก

**วิธีแก้:**
- รอ 30-60 นาที
- เช็คว่า DNS records ถูกต้อง
- ตรวจสอบว่าปิด Cloudflare Proxy แล้ว

### ปัญหา: Environment Variables ไม่ทำงาน

**วิธีแก้:**
- เช็คว่าตั้งค่าใน Firebase Console แล้ว
- Re-deploy app ใหม่:
  ```bash
  git commit --allow-empty -m "Redeploy"
  git push origin main
  ```

### ปัญหา: Cold Start ช้า

**วิธีแก้:**
- เปลี่ยน `minInstances: 0` → `minInstances: 1` ใน `apphosting.yaml`
- หรือใช้ UptimeRobot ping ทุก 5 นาที

---

## 📊 การติดตาม Performance

### ดู Logs

```bash
# ดู deployment logs
firebase apphosting:logs --backend=mekong-fish-dashboard

# ดู real-time logs
firebase apphosting:logs --backend=mekong-fish-dashboard --tail
```

### ดู Metrics ใน Firebase Console

1. ไปที่: **App Hosting** → **Backends** → `mekong-fish-dashboard`
2. ดู:
   - Requests/day
   - Response time
   - Error rate
   - Instance count

---

## 🔄 การ Deploy Update ใหม่

หลังจาก deploy ครั้งแรกแล้ว การ update ครั้งถัดไปง่ายมาก:

```bash
# 1. แก้ไขโค้ด
# 2. Commit
git add .
git commit -m "Update feature xyz"

# 3. Push (จะ deploy อัตโนมัติ)
git push origin main
```

GitHub Actions จะ build และ deploy ให้อัตโนมัติ!

---

## 📞 ติดต่อ Support

- Firebase Support: https://firebase.google.com/support
- Cloudflare Support: https://dash.cloudflare.com/?to=/:account/support
- GitHub Issues: https://github.com/sunksun/mekong-fish-dashboard/issues

---

## 🎉 สรุป

เมื่อทำครบทุกขั้นตอนแล้ว คุณจะได้:

- ✅ เว็บไซต์: https://mekongfish.info
- ✅ SSL Certificate (HTTPS)
- ✅ Auto-deploy เมื่อ push code
- ✅ Scalable infrastructure
- ✅ Free tier (< 10,000 requests/day)

**ยินดีด้วย! 🎊**

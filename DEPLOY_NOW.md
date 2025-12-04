# 🚀 Deploy ตอนนี้!

Build สำเร็จแล้ว! ✅

## คำสั่ง Deploy:

```bash
npm run deploy
```

หรือ

```bash
firebase deploy --only hosting
```

---

## ⚠️ สิ่งที่ต้องเช็คก่อน Deploy:

### 1. Environment Variables
ตรวจสอบว่าตั้งค่าใน Firebase Console แล้ว:
- Firebase Console → Hosting → Environment Configuration
- หรือใช้: `firebase functions:config:set`

### 2. Firebase Project
- Project ID: **tracking-fish-app** ✅
- Logged in as: sunksunlapunt7@gmail.com ✅

### 3. Build
- Build สำเร็จ ✅
- 30 หน้าพร้อม deploy ✅

---

## 📝 คำสั่ง Deploy แบบเต็ม:

```bash
# Deploy ทั้งหมด
firebase deploy

# Deploy เฉพาะ Hosting
firebase deploy --only hosting

# Deploy และดูผล
firebase deploy --only hosting && firebase open hosting:site
```

---

## 🌐 URL หลัง Deploy:

- **Production:** https://tracking-fish-app.web.app
- **Alternative:** https://tracking-fish-app.firebaseapp.com

---

## 🔍 ตรวจสอบหลัง Deploy:

1. เปิด URL ดูว่าหน้าเว็บทำงาน
2. ทดสอบ Login
3. ทดสอบดึงข้อมูลจาก Firestore
4. ทดสอบ Firebase Storage (รูปภาพ)

---

## ⚡ Quick Commands:

```bash
# ดู Hosting URL
firebase hosting:sites:list

# ดู Deploy history
firebase hosting:releases:list

# Rollback (ถ้าจำเป็น)
firebase hosting:rollback
```

---

**พร้อมแล้ว! รันคำสั่ง:**
```bash
npm run deploy
```

# Firestore Schema Validation - fishingRecords Collection

## 📋 Schema ที่ Web App คาดหวัง

### ✅ Required Fields (ฟิลด์ที่จำเป็น)

```typescript
{
  // ข้อมูลพื้นฐาน
  "userId": string,              // UID ของชาวประมง
  "fisherName": string,          // ชื่อชาวประมง
  "catchDate": string | Timestamp, // วันที่จับปลา (ISO 8601 หรือ Firestore Timestamp)

  // สถานที่
  "location": {
    "province": string,          // จังหวัด (Required)
    "district": string,          // อำเภอ (Optional)
    "subdistrict": string,       // ตำบล (Optional)
    "latitude": number,          // Optional
    "longitude": number          // Optional
  },

  // ข้อมูลปลา
  "fishData": [
    {
      "species": string,         // ชนิดปลา (Required)
      "quantity": number,        // จำนวน (integer)
      "weight": number,          // น้ำหนัก (float, กิโลกรัม)
      "photo": string           // URL รูปภาพ (Optional)
    }
  ],

  "totalWeight": number,         // น้ำหนักรวมทั้งหมด (กก.)

  // สถานะ
  "verified": boolean,           // สถานะการยืนยัน (true/false)
  "isPaid": boolean,            // สถานะการจ่ายเงิน (false by default)

  // ข้อมูลผู้บันทึก
  "recordedBy": {
    "uid": string,              // UID ผู้บันทึก
    "email": string,            // อีเมล (Optional)
    "role": string,             // "fisher" | "researcher" | "admin"
    "name": string              // ชื่อผู้บันทึก (Optional)
  },

  // Timestamps
  "createdAt": Timestamp,        // เวลาที่สร้าง
  "updatedAt": Timestamp         // เวลาที่แก้ไขล่าสุด (Optional)
}
```

### 🔄 Optional Fields (เพิ่มเมื่อมีการจ่ายเงิน)

```typescript
{
  "paymentId": string,           // ID ของรายการจ่ายเงิน
  "paymentDate": Timestamp,      // วันที่จ่ายเงิน
  "paymentAmount": number        // จำนวนเงินที่จ่าย (บาท)
}
```

---

## 🔍 การตรวจสอบ Data Types

### 1. **catchDate** - ⚠️ สำคัญมาก!

**✅ รูปแบบที่ถูกต้อง:**
```javascript
// Option 1: Firestore Timestamp (แนะนำ)
catchDate: Timestamp.fromDate(new Date("2026-02-13T10:30:00Z"))

// Option 2: ISO 8601 UTC string
catchDate: "2026-02-13T03:30:00.000Z"  // สังเกต Z ท้ายสุด = UTC
```

**❌ รูปแบบที่อาจมีปัญหา:**
```javascript
// Local time string (ไม่มี timezone)
catchDate: "2026-02-13T10:30:00"       // อันตราย! ไม่รู้ timezone

// Date string only
catchDate: "2026-02-13"                // อาจตีความผิด

// Unix timestamp
catchDate: 1708257000                  // ต้องแปลงก่อนใช้
```

### 2. **verified** - Boolean

**✅ ถูกต้อง:**
```javascript
verified: true   // boolean
verified: false  // boolean
```

**❌ ผิด:**
```javascript
verified: "true"   // string
verified: 1        // number
verified: null     // null
```

### 3. **isPaid** - Boolean

**✅ ถูกต้อง:**
```javascript
isPaid: false  // ค่าเริ่มต้น
isPaid: true   // หลังจ่ายเงินแล้ว
```

**❌ ผิด:**
```javascript
isPaid: "false"  // string
isPaid: 0        // number
// หรือไม่มีฟิลด์นี้เลย (ควรมี default = false)
```

### 4. **totalWeight** - Number

**✅ ถูกต้อง:**
```javascript
totalWeight: 5.5    // float
totalWeight: 10     // integer
totalWeight: 0.75   // float
```

**❌ ผิด:**
```javascript
totalWeight: "5.5"  // string
totalWeight: null   // null
```

### 5. **fishData[].quantity** - Integer

**✅ ถูกต้อง:**
```javascript
quantity: 2    // integer
quantity: 10   // integer
```

**❌ ผิด:**
```javascript
quantity: "2"    // string
quantity: 2.5    // float (ปลาไม่มี 2.5 ตัว)
```

### 6. **fishData[].weight** - Number

**✅ ถูกต้อง:**
```javascript
weight: 5.5    // float (กิโลกรัม)
weight: 2.75   // float
weight: 10     // integer
```

**❌ ผิด:**
```javascript
weight: "5.5"  // string
```

---

## 📱 ตัวอย่าง Schema ที่ถูกต้องสมบูรณ์

```json
{
  "userId": "tk4vfCXb8VPEZuqOqL9tV56BXTZ2",
  "fisherName": "นายสมชาย ใจดี",
  "catchDate": "2026-02-13T03:30:00.000Z",

  "location": {
    "province": "นครพนม",
    "district": "เมืองนครพนม",
    "subdistrict": "ในเมือง",
    "latitude": 17.4065,
    "longitude": 104.7686
  },

  "fishData": [
    {
      "species": "ปลาบึก",
      "quantity": 2,
      "weight": 5.5,
      "photo": "https://firebasestorage.googleapis.com/..."
    },
    {
      "species": "ปลาหมอ",
      "quantity": 5,
      "weight": 2.3,
      "photo": "https://firebasestorage.googleapis.com/..."
    }
  ],

  "totalWeight": 7.8,
  "verified": true,
  "isPaid": false,

  "recordedBy": {
    "uid": "xyz123",
    "email": "researcher@example.com",
    "role": "researcher",
    "name": "นักวิจัย สมหมาย"
  },

  "createdAt": Timestamp(2026-02-13 10:30:00 UTC),
  "updatedAt": Timestamp(2026-02-13 11:00:00 UTC)
}
```

---

## 🧪 วิธีตรวจสอบข้อมูลจริงใน Firestore

### 1. ใช้ Firebase Console
1. เปิด [Firebase Console](https://console.firebase.google.com/)
2. เลือกโปรเจค `tracking-fish-app`
3. ไปที่ Firestore Database → Collections → `fishingRecords`
4. เปิดดูเอกสารตัวอย่าง

### 2. ตรวจสอบจาก Web App Console
```javascript
// เปิด Browser Console (F12) แล้วรันคำสั่งนี้
const sample = await fetch('/api/fishing-records?limit=1').then(r => r.json());
console.log('Sample Record:', JSON.stringify(sample.data[0], null, 2));
```

### 3. ตรวจสอบ Data Types
```javascript
const record = sample.data[0];

console.log('catchDate type:', typeof record.catchDate);
console.log('verified type:', typeof record.verified, '=', record.verified);
console.log('isPaid type:', typeof record.isPaid, '=', record.isPaid);
console.log('totalWeight type:', typeof record.totalWeight, '=', record.totalWeight);
console.log('quantity type:', typeof record.fishData[0]?.quantity);
console.log('weight type:', typeof record.fishData[0]?.weight);
```

**ผลลัพธ์ที่คาดหวัง:**
```
catchDate type: string (ISO 8601)
verified type: boolean = true
isPaid type: boolean = false
totalWeight type: number = 7.8
quantity type: number (integer)
weight type: number (float)
```

---

## ⚠️ ปัญหาที่พบบ่อยจากโมบายแอป

### ปัญหา 1: วันที่เป็น Local Time
```javascript
// ❌ โมบายแอปส่งมา
"catchDate": "2026-02-13T10:30:00"  // ไม่มี timezone!

// ✅ ควรเป็น
"catchDate": "2026-02-13T03:30:00.000Z"  // UTC time
```

**วิธีแก้ในโมบายแอป (Flutter):**
```dart
// แปลง local time เป็น UTC
final catchDate = DateTime.now().toUtc().toIso8601String();

// หรือใช้ Firestore Timestamp
final catchDate = Timestamp.fromDate(DateTime.now());
```

### ปัญหา 2: Boolean เป็น String
```javascript
// ❌ โมบายแอปส่งมา
"verified": "true"
"isPaid": "false"

// ✅ ควรเป็น
"verified": true
"isPaid": false
```

**วิธีแก้ในโมบายแอป:**
```dart
// ใช้ boolean จริงๆ ไม่ใช่ string
Map<String, dynamic> data = {
  'verified': false,  // boolean, NOT "false"
  'isPaid': false,    // boolean, NOT "false"
};
```

### ปัญหา 3: Number เป็น String
```javascript
// ❌ โมบายแอปส่งมา
"totalWeight": "5.5"
"quantity": "2"

// ✅ ควรเป็น
"totalWeight": 5.5
"quantity": 2
```

**วิธีแก้ในโมบายแอป:**
```dart
// แปลงเป็น number
Map<String, dynamic> fishData = {
  'species': speciesController.text,
  'quantity': int.parse(quantityController.text),  // integer
  'weight': double.parse(weightController.text),   // float
};
```

---

## 🛡️ Validation Script สำหรับโมบายแอป

```dart
// ฟังก์ชันตรวจสอบข้อมูลก่อนส่ง Firestore
Map<String, dynamic> validateFishingRecord(Map<String, dynamic> data) {
  // ตรวจสอบ required fields
  assert(data['userId'] != null, 'userId is required');
  assert(data['fisherName'] != null, 'fisherName is required');
  assert(data['catchDate'] != null, 'catchDate is required');
  assert(data['location'] != null, 'location is required');
  assert(data['fishData'] != null && data['fishData'].isNotEmpty, 'fishData is required');

  // ตรวจสอบ data types
  assert(data['verified'] is bool, 'verified must be boolean');
  assert(data['isPaid'] is bool, 'isPaid must be boolean');
  assert(data['totalWeight'] is num, 'totalWeight must be number');

  // ตรวจสอบ fishData
  for (var fish in data['fishData']) {
    assert(fish['species'] is String, 'species must be string');
    assert(fish['quantity'] is int, 'quantity must be integer');
    assert(fish['weight'] is num, 'weight must be number');
  }

  // แปลง catchDate เป็น UTC
  if (data['catchDate'] is DateTime) {
    data['catchDate'] = (data['catchDate'] as DateTime).toUtc().toIso8601String();
  }

  return data;
}
```

---

## 📊 Checklist การตรวจสอบ

- [ ] **catchDate** เป็น ISO 8601 UTC หรือ Firestore Timestamp
- [ ] **verified** เป็น boolean (ไม่ใช่ string)
- [ ] **isPaid** เป็น boolean (มีค่าเริ่มต้น = false)
- [ ] **totalWeight** เป็น number (ไม่ใช่ string)
- [ ] **fishData[].quantity** เป็น integer
- [ ] **fishData[].weight** เป็น number
- [ ] **location.province** มีค่า (Required)
- [ ] **fishData** array ไม่เป็นค่าว่าง
- [ ] **recordedBy.role** เป็น "fisher" | "researcher" | "admin"

---

## 🚀 การทดสอบ

### Test Case 1: สร้างรายการจากโมบายแอป
1. บันทึกข้อมูลจับปลาผ่านโมบายแอป
2. ตรวจสอบใน Firestore Console ว่าข้อมูลถูกต้อง
3. เปิด Web App → หน้า fishing/records
4. ตรวจสอบว่าแสดงข้อมูลถูกต้อง ไม่มี error

### Test Case 2: ยืนยันรายการ
1. เปิดรายการที่บันทึกจากโมบายแอป
2. กดปุ่ม "ยืนยัน" ใน Web App
3. ตรวจสอบว่า `verified` เปลี่ยนเป็น `true`

### Test Case 3: จ่ายเงิน
1. สร้างรายการจ่ายเงินใน Web App
2. ตรวจสอบว่า `isPaid`, `paymentId`, `paymentDate`, `paymentAmount` ถูกเพิ่มเข้าไป

---

## 📞 Support

หากพบปัญหาเรื่อง Data Schema:
1. ตรวจสอบ Console Log ใน Browser (F12)
2. ดูข้อมูลตัวอย่างใน Firestore Console
3. ส่ง screenshot ของข้อมูลที่มีปัญหามา

---

**Generated:** 2026-02-13
**Version:** 1.0.0

# API Reference — Mekong Fish Dashboard

เอกสารสำหรับนักวิจัย / หน่วยงาน / ผู้พัฒนาที่ต้องการเข้าถึงข้อมูลจากระบบ

**Base URL (Production):** `https://<your-app>.web.app` (Firebase App Hosting)
**Base URL (Dev):** `http://localhost:3000`

---

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [CORS](#cors)
- [Data & Reporting APIs (Public)](#-data--reporting-apis-public)
- [Water Level APIs (Public)](#-water-level-apis-public)
- [Climate APIs (Public)](#-climate-apis-public)
- [Fishing Records API (Public read)](#-fishing-records-api-public-read)
- [Fishing Spots API](#-fishing-spots-api)
- [User & Admin APIs (Protected)](#-user--admin-apis-protected)
- [Payment APIs (Protected)](#-payment-apis-protected)
- [AI Chat API](#-ai-chat-api)
- [News Generation API (Protected)](#-news-generation-api-protected)

---

## Authentication

Protected endpoints ต้องแนบ **Firebase ID Token** ใน header:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

วิธีขอ token (JavaScript client):
```javascript
import { auth } from '@/lib/firebase';
const token = await auth.currentUser.getIdToken();
```

**Role hierarchy:** `admin` > `researcher` > `government` = `community_manager` > `fisher`

---

## Rate Limiting

ทุก endpoint มีการจำกัดจำนวน request ต่อ IP:

| ประเภท | Limit |
|---|---|
| Public | 60 req/นาที |
| Authenticated | 120 req/นาที |
| Expensive (Gemini/scraping) | 10 req/นาที |
| Admin utility | 30 req/นาที |

เมื่อเกิน limit จะได้ **HTTP 429** พร้อม header:
```
Retry-After: <seconds>
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <unix-timestamp>
```

---

## CORS

Public GET endpoints รองรับ CORS จากทุก origin (`*`):
- `/api/water-levels`, `/api/reports/biodiversity`, `/api/reports/enso-forecast`
- `/api/climate/oni`, `/api/fish-distribution`, `/api/fishing-spots`
- `/api/fish-prices`

Protected endpoints ไม่รองรับ CORS (same-origin เท่านั้น)

---

## 📊 Data & Reporting APIs (Public)

### `GET /api/reports/biodiversity`
ดัชนีความหลากหลายทางชีวภาพ (Shannon H', Simpson 1-D, Species Richness S)

**Query params:**
| Param | Type | Default | คำอธิบาย |
|---|---|---|---|
| `mode` | `monthly` \| `yearly` | `monthly` | รูปแบบการรวม |
| `year` | number (ค.ศ.) | ปีปัจจุบัน | ปีที่ต้องการ (สำหรับ mode=monthly) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "period": "2026-06",
      "S": 42,
      "H": 3.124,
      "D": 0.876,
      "totalIndividuals": 1284,
      "species": [
        { "name": "ตะกาก", "count": 156 },
        ...
      ]
    }
  ]
}
```

---

### `GET /api/reports/enso-forecast`
โมเดล Multiple Linear Regression พยากรณ์ความหลากหลายภายใต้สถานการณ์ ENSO

**Query params:**
| Param | Type | Default | คำอธิบาย |
|---|---|---|---|
| `oniLag` | 0-12 | 3 | หน่วงเวลา ONI (เดือน) |

**Response:**
```json
{
  "success": true,
  "oni": {
    "latest": { "ym": "2026-05", "oni": 0.42 },
    "available": true
  },
  "history": [ /* training data */ ],
  "models": {
    "H": { "coef": [...], "r2": 0.68, "residualSE": 0.12, "n": 24 },
    "D": { ... },
    "S": { ... }
  },
  "meta": {
    "oniLagMonths": 3,
    "nTrain": 24,
    "dataTier": {
      "level": "reliable",
      "label": "ผลน่าเชื่อถือ (Reliable)"
    }
  }
}
```

---

### `GET /api/fish-distribution`
ตำแหน่งการจับปลาแยกตามพิกัด GPS (สำหรับ heatmap)

**Query params:**
| Param | Type | Default |
|---|---|---|
| `limit` | number | 2000 |

**Response:**
```json
{
  "success": true,
  "count": 1150,
  "data": [
    {
      "species": "ตะกาก",
      "latitude": 17.894,
      "longitude": 101.646,
      "count": 4,
      "weight": 11.8,
      "catchDate": "2026-06-25"
    }
  ]
}
```

---

### `GET /api/fish-prices`
ราคาปลาเฉลี่ยรายเดือน/วัน

**Query params:**
| Param | Type | Format |
|---|---|---|
| `month` | string | `YYYY-MM` |
| `date` | string | `YYYY-MM-DD` |

**Response:**
```json
{
  "success": true,
  "period": "2026-06",
  "prices": [
    { "name": "ตะกาก", "avgPrice": 320, "sampleCount": 45 },
    ...
  ]
}
```

---

## 🌊 Water Level APIs (Public)

### `GET /api/water-levels`
ระดับน้ำแม่น้ำโขงย้อนหลัง (จาก Firestore)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-06-30",
      "currentLevel": 12.45,
      "rainfall": 8.2,
      "station": "Chiang Khan",
      "province": "Loei"
    }
  ]
}
```

---

### `GET /api/mekong-water-level`
ข้อมูล real-time จาก MRC Flood Forecasting (Web scraping)

**Query params:**
| Param | Default | คำอธิบาย |
|---|---|---|
| `station` | `Chiang Khan` | ชื่อสถานี |

**Response:**
```json
{
  "success": true,
  "station": "CKH",
  "currentLevel": 12.45,
  "criticalLevel": 16.0,
  "trend": "rising",
  "lastUpdate": "2026-07-02T10:00:00Z"
}
```

⏱️ Cache: 10 นาที · ⚠️ Expensive endpoint (10 req/นาที)

---

### `GET /api/rid-water-level`
ข้อมูลจากกรมชลประทาน สถานี Kh.97

**Response:** โครงสร้างคล้าย `/api/mekong-water-level`

---

## 🌎 Climate APIs (Public)

### `GET /api/climate/oni`
ดัชนี ONI (Oceanic Niño Index) จาก NOAA CPC

**Response:**
```json
{
  "success": true,
  "data": [
    { "ym": "2026-05", "oni": 0.42 },
    { "ym": "2026-04", "oni": 0.35 }
  ],
  "latest": { "ym": "2026-05", "oni": 0.42 },
  "source": "NOAA CPC ONI",
  "fetchedAt": "2026-07-02T10:00:00Z"
}
```

⏱️ Cache: 1 วัน · ⚠️ Rate limit 60/นาที

**ENSO categorization:**
- `oni >= 2.0` → Super El Niño
- `oni >= 1.5` → El Niño กำลังแรง
- `oni >= 0.5` → El Niño
- `-0.5 < oni < 0.5` → Neutral
- `oni <= -0.5` → La Niña
- `oni <= -1.5` → La Niña กำลังแรง

---

## 🐟 Fishing Records API (Public read)

### `GET /api/fishing-records`
รายการการจับปลาพร้อม pagination + filters

**Query params:**
| Param | Type | Default | คำอธิบาย |
|---|---|---|---|
| `page` | number | 0 | หน้า (0-indexed) |
| `limit` | number | 10 | จำนวนต่อหน้า |
| `search` | string | - | ค้นหาชื่อชาวประมง/ชนิดปลา/สถานที่ |
| `province` | string | `all` | จังหวัด |
| `verifiedStatus` | `verified` \| `unverified` \| `all` | `all` | สถานะยืนยัน |
| `dateFilter` | `today` \| `week` \| `month` \| `year` | `all` | ช่วงเวลา |
| `userId` | string | - | filter ตาม user |
| `minDate` | `YYYY-MM-DD` | - | วันที่เริ่มต้น |

**Response:**
```json
{
  "success": true,
  "data": [ /* fishing records */ ],
  "total": 1150,
  "page": 0,
  "limit": 10
}
```

---

### `GET /api/fishing-records/:id`
ข้อมูล record เดียว

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "catchDate": "2026-06-25T14:00:00Z",
    "fisherInfo": { "name": "...", "district": "..." },
    "fishList": [ /* fish array */ ],
    "location": { "latitude": 17.894, "longitude": 101.646 },
    "verified": true,
    ...
  }
}
```

---

### `PUT /api/fishing-records/:id` 🔒
แก้ไข record (Admin/Researcher only)

**Body:** JSON ที่มีเฉพาะ fields ที่แก้ไข

---

### `GET /api/fishing-records/stats`
สถิติสรุป (totalRecords, totalWeight, verifiedCount, unverifiedCount)

---

### `GET /api/fishing-records/caught-species`
ชนิดปลาที่จับได้ทั้งหมด (พร้อมจำนวน + น้ำหนักรวม)

---

### `GET /api/fishing-records/charts`
ข้อมูลสำหรับ dashboard charts

---

## 📍 Fishing Spots API

### `GET /api/fishing-spots`
รายการจุดจับปลา

**Query params:**
| Param | Default |
|---|---|
| `status` | ทั้งหมด |

---

---

## 👥 User & Admin APIs (Protected)

### `GET /api/users` 🔒
รายการผู้ใช้ (ตาม role ที่มีสิทธิ์เห็น)

**Query params:**
| Param | คำอธิบาย |
|---|---|
| `role` | filter ตาม role |

---

### `GET /api/users/:id` 🔒
ข้อมูลผู้ใช้เดียว

---

### `GET /api/admin/whoami` 🔒
ตรวจสอบสิทธิ์ของ current user

**Response:**
```json
{
  "success": true,
  "uid": "abc123",
  "email": "admin@example.com",
  "role": "admin"
}
```

---

### `POST /api/admin/fix-species-name` 🔒 (admin/researcher)
Utility แก้ชื่อปลาที่สะกดผิดใน Firestore

**Body:**
```json
{
  "from": "สะงิ้ว",
  "to": "สะงั่ว",
  "fromLocal": "นางสะงิ้ว",
  "toLocal": "นางสะงั้ว",
  "dryRun": true
}
```

**Response:**
```json
{
  "success": true,
  "dryRun": true,
  "fish_species": { "matched": 1, "updated": [...] },
  "fishingRecords": {
    "scannedDocs": 1150,
    "matchedDocs": 16,
    "replacedFields": 16
  }
}
```

---

## 💰 Payment APIs (Protected)

### `GET /api/payments` 🔒
รายการการจ่ายเงิน

### `GET /api/payments/:id` 🔒
รายละเอียดการจ่ายเงิน

---

## 🤖 AI Chat API

### `POST /api/chat`
สอบถาม AI (Gemini) เกี่ยวกับข้อมูลการประมงในระบบ

**Body:**
```json
{
  "message": "ปลาชนิดใดจับได้มากที่สุดในเดือน มิ.ย.?",
  "mode": "rag"
}
```
- `mode: "rag"` — ใช้ข้อมูลจาก Firestore เป็น context
- `mode: "no-rag"` — ตอบจาก Gemini ล้วน

**Response:**
```json
{
  "success": true,
  "reply": "จากข้อมูลเดือน มิ.ย. 2569 ปลาที่จับได้มากสุดคือ ...",
  "sources": [ /* records อ้างอิง */ ]
}
```

⚠️ Rate limit 10 req/นาที (Gemini API cost)

---

## 📰 News Generation API (Protected)

### `GET /api/news/generate` 🔒 (admin/researcher)
Preview ข่าวที่จะสร้างจากข้อมูล (ไม่บันทึก)

### `POST /api/news/generate` 🔒 (admin/researcher)
สร้างและบันทึกข่าว 4 ประเภท:
1. กิจกรรมการจับปลาเดือนนี้
2. ปลาหายากที่พบ (IUCN CR/EN/VU)
3. ระดับน้ำและสถานการณ์
4. การเข้าร่วมชุมชน

**Body:**
```json
{
  "selected": ["fishing_activity", "rare_fish"]
}
```

---

## Data Models

### Fishing Record
```typescript
{
  id: string;
  catchDate: Timestamp;        // web
  date?: Timestamp;             // mobile app
  createdAt: Timestamp;
  fisherInfo: {
    name: string;
    phone: string;
    village: string;
    district: string;
    province: string;
  };
  fishList: Array<{
    name: string;              // Thai name
    commonName?: string;       // alternative
    count: string | number;    // จำนวนตัว
    weight: string | number;   // น้ำหนัก (กก.)
    price: string | number;    // บาท/กก.
    photo?: string;            // URL
  }>;
  location: {
    latitude: number;
    longitude: number;
    spotName: string;
    accuracy: string;
  };
  weather: string;
  waterSource: string;
  verified: boolean;
  verifiedBy?: string;
  source: 'mobile_app' | 'web';
}
```

### Fish Species
```typescript
{
  id: string;
  common_name_thai: string;    // ชื่อไทย
  local_name: string;          // ชื่อท้องถิ่น
  scientific_name: string;
  family_thai: string;
  iucn_status: 'CR' | 'EN' | 'VU' | 'NT' | 'LC' | 'DD' | null;
  key_characteristics?: string;
}
```

### Water Level Record
```typescript
{
  date: string;                // YYYY-MM-DD
  time: string;                // HH:mm
  currentLevel: number;        // เมตร
  criticalLevel: number;       // เมตร (16.0)
  rainfall: number;            // มม.
  station: string;
  province: string;
}
```

---

## Error Responses

รูปแบบมาตรฐาน:
```json
{
  "success": false,
  "error": "Error message"
}
```

**HTTP status codes:**
| Code | ความหมาย |
|---|---|
| 200 | สำเร็จ |
| 400 | Body/params ไม่ถูกต้อง |
| 401 | ไม่มี token / token expired |
| 403 | Insufficient permissions (role ไม่พอ) |
| 429 | Too many requests |
| 500 | Server error |
| 503 | External source ล้ม (NOAA, MRC) |

---

## Legend

🔒 = ต้องการ authentication (Firebase ID token)
⏱️ = มี cache
⚠️ = Rate limit เข้มกว่า public

---

## Contact & Support

ปัญหาหรือคำถาม: เปิด GitHub Issue หรือติดต่อ [Admin](mailto:admin@mekong.com)

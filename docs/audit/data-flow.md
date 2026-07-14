# Data-Flow Audit — Firestore + Firebase Storage (Baseline)

**Stack:** Next.js App Router + Firestore + Firebase Storage + App Hosting
**วันที่ audit:** 2026-07-07
**วิธี:** grep + subagent scan 4 โดเมน (API routes / dashboard+public pages / lib+context+scripts / denormalization+storage)
**กฎ:** ทุกบรรทัดอ้าง `file:line` — ที่ไม่ชัดเขียน "ต้องยืนยัน" (มักหมายถึง field ที่เขียนโดย mobile app ซึ่งไม่มีในรีโปนี้)

> **หมายเหตุ scope:** repo นี้เป็น **web dashboard** เท่านั้น — mobile app (Tracking-Fish, React Native) อยู่คนละ repo. หลาย field ถูก "อ่าน" ในโค้ดนี้แต่ "เขียน" โดย mobile app → ระบุ "ต้องยืนยัน (mobile origin)".

---

## สรุปภาพรวม (baseline facts)

| ประเด็น | สถานะ | อ้างอิง |
|---|---|---|
| Firestore SDK ใน API routes | **Client SDK ทั้งหมด** — ไม่มี route ใช้ `adminDb` | `src/lib/firebase.js:21` |
| Admin SDK ใช้ที่เดียว | `api-auth.js` (verifyIdToken + role lookup) | `src/lib/api-auth.js:2,23` |
| Real-time | **ไม่มี `onSnapshot` เลย** — polling (`getDocs`) ทั้งหมด | ทุกไฟล์ |
| `revalidatePath`/`revalidateTag` | **ไม่มีเลย** — ไม่มี write ใดตามด้วย revalidate | ทุก route |
| Collections ใช้จริง | **17** (สแกนเจอ 18 แต่ `sensorData` เป็น dead) | ดู §1 |
| Storage upload sites | 5 | §5.1 |
| Storage delete sites | 3 | §5.2 |
| Dual-implementation (API + client เขียนซ้ำ) | delete record, create/cancel payment | §4.6 |

### ⚠️ ข้อสังเกต (baseline red flags)
> อัปเดตตามข้อมูลยืนยันจากเจ้าของระบบ (2026-07-14) — รายการ dead code / findings ย้ายไป §7
1. ~~`fishers`~~ — **ยืนยัน: ไม่มี collection นี้จริง** เหลือแค่ `firestore.rules:44-50` (dead rule) → §7.A
2. ~~`sensorData`~~ — **ยืนยัน: ไม่ได้ใช้งาน** อ่านที่ `topbar-alerts.js:157` แต่ไม่มีข้อมูลจริง (dead) — การไม่มีใน rules **ไม่ใช่ปัญหา** → §7.B
3. `webUsers` เขียนโดย `seed-admin.js` แต่ auth อ่านจาก `users` → ต้องยืนยันว่ายังใช้ไหม
4. Role `fisherman` (`api-auth.js:11`) — **ยืนยัน: role นี้ยังไม่ active (ยังไม่เปิดให้ login)** — active role คือ `USER_ROLES.FISHER='fisher'` (`types/index.js:7`) → §7.D
5. `EXCLUDED_SPECIES` ไม่ sync: `firestore-helpers.js:86-90` มี **3 ตัว** — `build-embeddings.js:470-472` มี **4 ตัว** (มี กุ้งขาว) — **ยืนยัน: ควรมี 4** → helper ขาด กุ้งขาว = finding → §7.E
6. AuthContext เลื่อน role-less user เป็น **ADMIN** อัตโนมัติ (`AuthContext.js:41-48`) → ความเสี่ยงความปลอดภัย ต้องยืนยัน

---

## §1. Schema ที่อนุมานจากโค้ด

> ชนิด: `TS`=Timestamp, `str`=string, `num`=number, `bool`=boolean, `arr`=array, `obj`=object, `ref`=reference

### `fishingRecords` (core data unit — 1 doc/fishing session)
| field | ชนิด | จุดเขียน | จุดอ่าน |
|---|---|---|---|
| `userId` | str | mobile (ต้องยืนยัน) | `fishing-records/route.js:118`, `fish-verification/route.js:36` |
| `date` | TS | web edit `fishing-records/[id]/route.js:95` · mobile | queried `where('date',...)` `fishing-records/route.js:89` |
| `catchDate` | TS | web edit `[id]/route.js:89` | `orderBy('catchDate')` `landing-data/route.js:49` |
| `createdAt` | TS | mobile (ต้องยืนยัน) | `.toDate()` `[id]/route.js:40` |
| `updatedAt` | TS | `Timestamp.now()` `[id]/route.js:88,190` | `.toDate()` `[id]/route.js:41` |
| `fishList[]` | arr | `records/page.js:678` · `admin/fix-species-name/route.js:78` | `[id]/route.js:256`, `fish-verification/route.js:26` |
| `fishList[].name`/`.commonName` | str | `records/page.js:672` | `fish-verification/route.js:28` · helper `getFishName` `firestore-helpers.js:78` |
| `fishList[].species` | str | mobile (ต้องยืนยัน) | `fish-distribution/route.js:98` · `build-embeddings.js:429` |
| `fishList[].count`/`.quantity` | num | `records/page.js:672` | helper `getFishCount` `firestore-helpers.js:51` |
| `fishList[].weight` | num | `records/page.js:672` | helper `getFishWeight:60` |
| `fishList[].price` | num | `records/page.js:672` | helper `getFishPrice:69` |
| `fishList[].photo` | str(URL) | `records/page.js:677` | `landing-data/route.js:148` · delete `[id]/route.js:258` |
| `fishList[].localName` | str | mobile (ต้องยืนยัน) | `fish-verification/route.js:61` |
| `fishData[]` | arr | `records/page.js:691` (web mirror) | `fish-verification/route.js:66` |
| `fishingGear` | obj{name,details{quantity,size,length,meshSize,depth,custom}} | `records/page.js:481-491` | `charts/route.js:114` |
| `totalWeight` | num | `records/page.js:701` · PATCH `[id]/route.js:114` | ดู §4.5 (มี reconciliation) |
| `totalValue` | num | `records/page.js:702` | **always recomputed** `fishing-records/route.js:254` |
| `verified` | bool | PATCH `[id]/route.js:155` | helper `isVerified` `firestore-helpers.js:108` |
| `verifiedBy`/`verifiedAt` | str/TS | `[id]/route.js:155` | — |
| `location` | obj{address.province,province,district,spotName} | `[id]/route.js:109` | `fish-verification/route.js:57` |
| `waterSource` | str | `records/page.js:697` (root, mobile compat) | `fish-detail` |
| `weather`/`waterLevel`/`method`/`notes` | str | `[id]/route.js:99` · `records/page.js:696` | display |
| `fisherName` | str | **ต้องยืนยัน (mobile?)** — ดู §4.1 | `fish-detail/route.js:92` · filter `fishing-records/route.js:300` |
| `fisherInfo` | obj{name} | mobile (ต้องยืนยัน) | `topbar-alerts.js:141` · `build-embeddings.js:417` |
| `recordedBy` | obj{name,role} | mobile? (ต้องยืนยัน) | `[id]?` · derived `fishing-records/route.js:183-186` |
| `isPaid`/`paymentId`/`paymentDate`/`paymentAmount` | bool/str/TS/num | `payments/route.js:178-181` (denorm — §4.7) | `fishing-records/route.js:269-272` |

### `fish_species` (catalog — source of truth ชนิดปลา)
| field | ชนิด | จุดเขียน | จุดอ่าน |
|---|---|---|---|
| `thai_name` | str | `add/page.js:78` · import `import/page.js:96` | `charts/route.js:33` · queried `orderBy('thai_name')` `records/page.js:319` |
| `common_name_thai` | str | import | `fishing-records/route.js:144` |
| `scientific_name` | str | import (doc ID slug `import/page.js:96`) | `caught-species/route.js:34` |
| `local_name` | str | import | `charts/route.js:36` |
| `iucn_status` | str | import | `charts/route.js:37` · `landing-data/route.js` (IUCN) |
| `family_thai`/`family_english`/`group` | str | import | `caught-species/route.js:35` · `build-embeddings.js` |
| `image_url` | str | edit `fish-species/page.js:338` · migrate `migrate/page.js:89` | `landing-data/route.js:90` |
| `photos[]` | arr(URL) | edit `fish-species/page.js:336` | `landing-data/route.js:91` |
| `key_characteristics` | str | import `import/page.js` | — |
| `created_at`/`updated_at` | TS | `add/page.js:78-82` | — |

> **ยืนยัน: Firestore `fish_species` = source of truth.** `src/fish-data.json` + `src/fish-data-full.json` เป็น static duplicate — **ไม่มีโค้ดใน `src/` import/อ่านเลย** (dead static files) → §7.G

### `users` (identity + role — source of truth)
| field | ชนิด | จุดเขียน | จุดอ่าน |
|---|---|---|---|
| `email` | str | `users/page.js:484` · AuthContext `:149` | role lookup `api-auth.js:37` |
| `role` | str | AuthContext `:47,83,149` · `users/page.js:855` | queried `where('role',...)` `users/route.js:28` · `api-auth.js:33` |
| `name` | str | `users/page.js:808` · AuthContext | `fish-verification/route.js:58` (→ fisherName) |
| `firstName`/`lastName`/`phone`/`village`/`district`/`province` | str | `users/page.js:484,808` | display |
| `isActive`/`accountStatus` | bool/str | `users/page.js:486` | — |
| `fisherProfile` | obj{nickname,experience,primaryGear,boatType,licenseNumber,profilePhoto} | `users/page.js:804,855` | `fishing-records/route.js:176` |
| `createdAt`/`updatedAt`/`lastLogin`/`lastActivity` | TS/str | AuthContext `:69-82,109` · `users/page.js` | `.toDate()` `users/route.js:39-40` |
| `createdBy`/`updatedBy` | str | `users/page.js:488` | — |

### `payments`
| field | ชนิด | จุดเขียน | จุดอ่าน |
|---|---|---|---|
| `userId` | str | `payments/route.js:144` | queried `where('userId')` `:31` |
| `fisherName` | str (denorm — §4.1) | `payments/route.js:145` | `payments/page.js:384` |
| `period`/`periodStart`/`periodEnd` | str/TS/TS | `:146-148` | `.toDate()` `:59-60` |
| `recordIds[]` | arr(str) | `:149` | `payments/page.js:162` (fan-out) |
| `totalRecords`/`availableRecords`/`selectedRecords`/`paymentRate`/`amount` | num | `:150-154` | display |
| `status` | str('paid') | `:155` | queried `where('status')` `:36` |
| `paidBy`/`paidByName` | str (denorm — §4.4) | `:157-158` | `payments/page.js:537` |
| `paidDate`/`createdAt`/`updatedAt` | TS | `:159-161` | `.toDate()` `:56-58` |

### `waterLevels` (reads: SDK + REST)
| field | ชนิด | จุดเขียน | จุดอ่าน |
|---|---|---|---|
| `station`/`province` | str | `water-level/page.js:293` | — |
| `date` | str | `water-level/page.js` | `orderBy('date')` `water-level-analysis/route.js:37` · REST `water-levels/route.js:35` |
| `time` | str | `water-level/page.js` | `orderBy('time')` `landing-data/route.js:50` |
| `currentLevel` | num | `water-level/page.js:293` | analytics · `build-embeddings.js:290` (`waterLevel` REST variant `water-levels/route.js:37`) |
| `criticalLevel`/`lowestLevel`/`rainfall`/`rtkLevel` | num | `water-level/page.js:293-304` | — |
| `createdAt`/`updatedAt` | TS | `water-level/page.js` | — |

### `waterQuality`
| field | ชนิด | จุดเขียน | จุดอ่าน |
|---|---|---|---|
| `date`/`measuredDate` | str/TS | `water-quality/data/page.js:365` | `orderBy('measuredDate')` `:191` · `build-embeddings.js:577` |
| `stationId`/`stationName`/`waterbody`/`province`/`district` | str | `water-quality/data/page.js:365` | analytics |
| `temperature`/`pH`/`tss`/`ec`/`dissolvedOxygen`/`arsenic` | num\|null | `water-quality/data/page.js` | `water-quality-analysis/route.js:41` · `build-embeddings.js:577` |
| `status` | str | `water-quality/data/page.js` | — |
| `createdAt`/`updatedAt`/`createdBy` | TS/str | `water-quality/data/page.js:365-399` | — |

### `fishingSpots`
| field | ชนิด | จุดเขียน | จุดอ่าน |
|---|---|---|---|
| `spotName`/`location`/`description` | str | `fishing-spots/route.js:122-124` · `maps/fishing/page.js:216` | `landing-data`? |
| `latitude`/`longitude` | num\|null | `fishing-spots/route.js:125-126` | map render |
| `status` | str('active'/'inactive') | `:127` | filtered `:46,54` |
| `createdBy`/`createdAt`/`updatedAt` | str/TS | `:128-130` | `orderBy('createdAt')` `:29` |

### `waterStations`
`stationName`, `location`, `latitude`/`longitude`(num), `description`, `status`, `createdAt`/`updatedAt`, `createdBy`/`updatedBy` — เขียน `water-quality/stations/page.js:177-218` · อ่าน `getDocs` `:87`

### `newsArticles`
`title`,`summary`,`category`,`content`,`image`(str URL),`videoUrl`,`isPinned`(bool),`autoGenerated`(bool),`author`,`authorId`,`date`(str),`publishedAt`(TS),`createdAt`/`updatedAt`(TS) — เขียน `news/page.js:163-173` · API `news/generate/route.js:28-32` · อ่าน `orderBy('publishedAt')` `landing-data/route.js:51` · `news-list/page.js:32`

### `fishingWisdom`
`title`,`category`,`description`,`technique`,`contributorName`(denorm — §4.3),`contributorId`,`image`(str URL),`season`,`fishType`,`location`,`createdAt`/`updatedAt`,`status`('active') — เขียน `wisdom/page.js:370-405` · อ่าน `orderBy('createdAt')` `landing-data/route.js:52` · `wisdom-list/page.js:59`

### `knowledgeArticles`
formData + `tags[]`,`authorId`,`authorName`,`createdAt`/`updatedAt`,`status`('published') — เขียน `articles/page.js:166-218` · อ่าน `getDocs` `:99`

### `evaluationResults` (research — Paper 4)
`questionId`,`category`,`difficulty`,`question`,`goldAnswer`,`condA_answer`/`condB_answer`,`condA_score`/`condB_score`(num),`condA/B_faithfulness`(num),`condA/B_n_claims`,`condA/B_response_ms`,`condB_retrieved_ids[]`,`condB_retrieval_ms`,`evaluatorId`/`evaluatorName`(denorm — §4.5),`timestamp` — เขียน `evaluation/page.js:177-198` · อ่าน `getDocs` `:72` · `results/page.js:26`

### `featuredFishPhotos` (doc ID = species name)
`species`,`photoUrl`(str URL — copy of fishList photo),`recordId`(str\|null),`updatedAt`(TS) — เขียน `featured-fish-photos/route.js:37-42` · POST จาก `caught/[fishName]/page.js:99` · อ่าน `:15` · `landing-data/route.js:46`

### `siteVisitors` (doc `stats` — single counter)
`totalVisitors`(num, `increment(1)`),`lastUpdated`(TS `serverTimestamp`) — เขียน `site-visitors/route.js:31,62,68` · อ่าน `:25,78` · `landing/page.js:219`

### `chatLogs` (research log — RAG)
`question`,`mode`,`top_k`,`retrieved_chunks[]`{id,source,sourceDocId,score},`n_retrieved`,`response`,`response_time_ms`,`retrieval_time_ms`,`generation_time_ms`,`timestamp` — เขียน `chat/route.js:78-95` (best-effort try/catch) · อ่าน: admin/researcher เท่านั้น (rules)

### `rag_embeddings` (RAG corpus)
`source`,`sourceDocId`,`chunk_index`(num),`text`(str),`metadata`(obj),`embedding`(arr num 3072-dim),`createdAt`(TS) — เขียน batch `vector-store.js:45` (BATCH 400) · script `build-embeddings.js:913` (BATCH 10) · อ่าน full `vector-store.js:97` · script resume `:937`

### `webUsers` (ต้องยืนยัน — อาจ dead)
เขียนโดย `seed-admin.js:21,53` (admin+researcher seed) — **ไม่พบจุดอ่านในโค้ด** (auth ใช้ `users`) → ต้องยืนยัน

### ~~`sensorData`~~ — DEAD (ยืนยัน: ไม่ได้ใช้งาน) → §7.B
อ่าน `orderBy('timestamp')` `topbar-alerts.js:157` — field: `deviceId`,`status`,`turbidity`,`temperature`,`timestamp` (`topbar-alerts.js:160-180`) · **ไม่พบจุดเขียน + ไม่มีข้อมูลจริง** — เจ้าของยืนยันว่าไม่ได้ใช้ (การไม่มีใน rules ไม่ใช่ปัญหา)

---

## §2. READ MAP

> SDK ทั้งหมด = **client** ยกเว้นที่ระบุ · ทั้งหมด = **getDocs/getDoc** (ไม่มี onSnapshot)

### API routes
| Route | file:line | Collection | query | cache |
|---|---|---|---|---|
| landing-data | `landing-data/route.js:46` | featuredFishPhotos | full | `revalidate=300` `:22` |
| landing-data | `:47` | fish_species | full | ↑ |
| landing-data | `:49` | fishingRecords | `orderBy(catchDate desc) limit(300)` | ↑ |
| landing-data | `:200` | fishingRecords | **full scan** `getDocs(collection(db,'fishingRecords'))` (IUCN photos + stats) ⚠️ ดู §4.5 note | ↑ |
| landing-data | `:50` | waterLevels | `orderBy(date desc, time desc) limit(30)` | ↑ |
| landing-data | `:51` | newsArticles | `orderBy(publishedAt desc) limit(10)` | ↑ |
| landing-data | `:52` | fishingWisdom | `orderBy(createdAt desc) limit(3)` | ↑ |
| landing-data | `:53` | users | `getCountFromServer` | ↑ |
| site-stats | `site-stats/route.js:30-32` | users/fishingRecords/fish_species | `getCountFromServer` ×3 | `revalidate=300` `:18` |
| fishing-records | `fishing-records/route.js:106` | fishingRecords | opt `where(userId)`, `where(date>=)`, `orderBy(date desc)` | — |
| fishing-records | `:128` | users | `getDoc(uid)` | — |
| fishing-records | `:139` | fish_species | full | — |
| fishing-records/[id] | `[id]/route.js:22,75,124,176,197,239` | fishingRecords | `getDoc(id)` | — |
| fishing-records/stats | `stats/route.js:54` | fishingRecords | opt where(userId/date) | — |
| fishing-records/charts | `charts/route.js:46` | fishingRecords | opt where(date) | — |
| fishing-records/charts | `:29` | fish_species | full | — |
| fishing-records/caught-species | `caught-species/route.js:40` | fishingRecords | opt where(date) | — |
| fishing-records/caught-species | `:25` | fish_species | full | — |
| fishing-records/fish-detail | `fish-detail/route.js:29` | fishingRecords | opt where(date) | — |
| fish-distribution | `fish-distribution/route.js:33` | fishingRecords | `orderBy(date desc) limit(2000)` | `force-dynamic`+`revalidate=120` `:12,16` |
| fish-prices | `fish-prices/route.js:21` | fishingRecords | full | — |
| fish-verification | `fish-verification/route.js:20,79` | fishingRecords | `orderBy(date desc)` | — |
| fish-verification | `:40` | users | `getDoc(uid)` | — |
| reports/biodiversity | `biodiversity/route.js:22` | fishingRecords | full | `revalidate` ต้องยืนยัน |
| reports/water-quality-analysis | `water-quality-analysis/route.js:41-42` | waterQuality + fishingRecords | full | `revalidate=300` `:18` |
| reports/water-level-analysis | `water-level-analysis/route.js:37` | waterLevels | `orderBy(date asc)` | `revalidate=300` `:14` |
| reports/enso-forecast | `enso-forecast/route.js:40` | waterLevels | `orderBy(date desc) limit(2000)` | fetch `next:{revalidate:86400}` `:25` |
| reports/enso-forecast | `:72,103` | waterQuality + fishingRecords | full | ↑ |
| users | `users/route.js:35` | users | opt `where(role)` | — |
| users/[id] | `users/[id]/route.js:15` | users | `getDoc(id)` | — |
| payments | `payments/route.js:52,125` | payments | opt where(userId/period/status) | — |
| payments/[id] | `payments/[id]/route.js:22,70,116` | payments | `getDoc(id)` | — |
| fishing-spots | `fishing-spots/route.js:31` | fishingSpots | `orderBy(createdAt desc)` | — |
| site-visitors | `site-visitors/route.js:20,57,74` | siteVisitors | `getDoc('stats')` | — |
| featured-fish-photos | `featured-fish-photos/route.js:15` | featuredFishPhotos | full | — |
| water-levels | `water-levels/route.js:21` | waterLevels | **REST API** (ไม่ใช่ SDK) pageSize=100 | `revalidate=300` `:10` |
| research/faithfulness | `faithfulness/route.js:5` | — | (LLM only) | `force-dynamic` |

### Dashboard pages (direct Firestore)
| Page | file:line | Collection | query |
|---|---|---|---|
| dashboard | `dashboard/page.js:124-126` | users/fishingRecords (×2, opt where createdAt>=today) | full/getDocs |
| fishing/records | `records/page.js:319` | fish_species | `orderBy(thai_name asc)` |
| fishing/records | `:863` | fishingRecords | `getDoc(id)` (pre-delete) |
| water-level | `water-level/page.js:120` | waterLevels | `orderBy(date desc, time desc) limit(90)` |
| water-quality/data | `data/page.js:191` | waterQuality | `orderBy(measuredDate desc) limit(500)` |
| water-quality/stations | `stations/page.js:87` | waterStations | full |
| maps/fishing | `maps/fishing/page.js:117` | fishingSpots | `orderBy limit` |
| maps/analysis | `maps/analysis/page.js:79-82` | waterLevels/fishingWisdom/fishingSpots/fishingRecords | 4× parallel getDocs |
| payments | `payments/page.js:64` | payments | `orderBy(createdAt desc)` |
| knowledge/articles | `articles/page.js:99` | knowledgeArticles | `orderBy(createdAt desc) limit(100)` |
| knowledge/wisdom | `wisdom/page.js:264` | fishingWisdom | `orderBy(createdAt desc) limit(100)` |
| research/evaluation | `evaluation/page.js:72,207` | evaluationResults | full |
| research/results | `results/page.js:26` | evaluationResults | full |
| users | `users/page.js:208,318` | users | `orderBy(createdAt desc) limit + startAfter` |
| users/statistics | `statistics/page.js:162,197` | users + fishingRecords | full |
| fish-species | `fish-species/page.js:129` | fish_species | `orderBy(thai_name asc)` |
| fish-species/migrate | `migrate/page.js:45` | fish_species | full |
| fish-species/schema | `schema/page.js:40` | fish_species | full |
| fish-verification | `fish-verification/page.js:104` | fish_species | `orderBy(thai_name)` |
| reports/{spots,forecast,correlation,trends} | `:113/:97/:58/:37` | fishingRecords | full |

### Public pages
| Page | file:line | Collection | query |
|---|---|---|---|
| landing | `landing/page.js:151` | (via `/api/landing-data`) | — |
| news-list | `news-list/page.js:32` | newsArticles | `orderBy(publishedAt desc)` |
| news/[id] | `news/[id]/page.js:37` | newsArticles | `getDoc(id)` |
| wisdom-list | `wisdom-list/page.js:59` | fishingWisdom | `orderBy(createdAt desc)` |
| wisdom/[id] | `wisdom/[id]/page.js:36` | fishingWisdom | `getDoc(id)` |

### lib / context
| จุด | file:line | Collection | query | SDK |
|---|---|---|---|---|
| api-auth (role) | `api-auth.js:32,34,37` | users | getDoc + where(uid/email) limit 1 | **admin** |
| api-auth (fallback) | `:44,46,49` | users | getDoc + where | client |
| AuthContext | `AuthContext.js:36` | users | `getDoc(uid)` | client |
| topbar-alerts | `topbar-alerts.js:31,110,125,157` | waterLevels/fish_species/fishingRecords/~~sensorData~~ | orderBy+limit | client — `sensorData:157` เป็น dead read §7.B |
| news-generators | `news-generators.js:34,84,102,147,196` | fishingRecords/fish_species/waterLevels/users | various | client |
| rag/vector-store | `vector-store.js:97` | rag_embeddings | full | client |

---

## §3. WRITE MAP

| จุดเขียน | file:line | Collection | op | multi-collection? | revalidate? |
|---|---|---|---|---|---|
| payments POST | `payments/route.js:166` | payments | addDoc(create) | **YES** → fishingRecords batch `:177` | ❌ |
| payments POST | `payments/route.js:177` | fishingRecords | batch.update (isPaid) | ↑ (paired) | ❌ |
| payments PUT | `payments/[id]/route.js:88` | payments | updateDoc | single | ❌ |
| payments DELETE | `payments/[id]/route.js:145` | payments | deleteDoc | **YES** → fishingRecords batch `:135` | ❌ |
| payments DELETE | `payments/[id]/route.js:135` | fishingRecords | batch.update (revert) | ↑ (paired) | ❌ |
| fishing-records PUT | `[id]/route.js:121` | fishingRecords | updateDoc | single | ❌ |
| fishing-records PATCH | `[id]/route.js:194` | fishingRecords | updateDoc | single | ❌ |
| fishing-records DELETE | `[id]/route.js:292` | fishingRecords | deleteDoc | + Storage delete `:277` (§5) | ❌ |
| fix-species-name POST | `admin/fix-species-name/route.js:78` | fishingRecords | updateDoc (fishList) | **YES** → fish_species `:51` | ❌ |
| fix-species-name POST | `:51` | fish_species | updateDoc | ↑ (paired) | ❌ |
| featured-fish-photos POST | `featured-fish-photos/route.js:37` | featuredFishPhotos | setDoc(overwrite) | single | ❌ |
| news/generate POST | `news/generate/route.js:28` | newsArticles | addDoc | single | ❌ |
| chat POST | `chat/route.js:78` | chatLogs | addDoc (best-effort) | single | ❌ |
| fishing-spots POST | `fishing-spots/route.js:134` | fishingSpots | addDoc | single | ❌ |
| site-visitors POST | `site-visitors/route.js:61` | siteVisitors | setDoc(merge+increment) | single | ❌ |
| AuthContext | `AuthContext.js:47,83,109,149` | users | setDoc(merge/create) | single | — |
| seed-admin | `seed-admin.js:21,53` | webUsers | setDoc | single (ต้องยืนยัน) | — |
| rag/vector-store | `vector-store.js:45,68` | rag_embeddings | batch set/delete | single | — |

### Dashboard client-side writes (direct Firestore)
| Page | file:line | Collection | op | multi-collection? |
|---|---|---|---|---|
| fishing/records | `records/page.js:750` | fishingRecords | updateDoc | + Storage `:638` |
| fishing/records | `:908` | fishingRecords | deleteDoc | + Storage delete `:882` |
| news | `news/page.js:163,179,210,237,253` | newsArticles | add/update/delete/pin | + Storage `:328` |
| knowledge/wisdom | `wisdom/page.js:379,382,401,420` | fishingWisdom | add/update/delete | + Storage `:247` |
| knowledge/articles | `articles/page.js:176,205,218` | knowledgeArticles | add/update/delete | single |
| users | `users/page.js:484,855,894` | users | add/update/delete | + Storage `:646` |
| fish-species | `fish-species/page.js:204,342` | fish_species | delete/update | + Storage `:321` |
| fish-species/add | `add/page.js:78` | fish_species | addDoc | single |
| fish-species/import | `import/page.js:96` | fish_species | setDoc (doc ID slug) | single |
| fish-species/migrate | `migrate/page.js:88` | fish_species | updateDoc(image_url) | single |
| water-level | `water-level/page.js:310,451,457` | waterLevels | add/update (upsert) | single |
| water-quality/data | `data/page.js:395,400` | waterQuality | update/add (upsert) | single |
| water-quality/stations | `stations/page.js:189,221,241` | waterStations | add/update/delete | single |
| maps/fishing | `maps/fishing/page.js:216,248,268` | fishingSpots | add/update/delete | single |
| payments | `payments/page.js:164,178` | fishingRecords(batch)+payments(delete) | **YES** (dual of API §4.6) | |
| payments/create | `create/page.js:351,356` | payments(add)+fishingRecords(batch) | **YES** (dual of API §4.6) | |
| research/evaluation | `evaluation/page.js:177` | evaluationResults | addDoc | single |

> **ไม่มี write ใดตามด้วย `revalidatePath`/`revalidateTag`** → หน้าที่ cache (revalidate=300) จะไม่เห็นข้อมูลใหม่จนกว่า cache หมดอายุ

---

## §4. Denormalized fields (ข้อมูลซ้ำหลาย collection)

### §4.1 `fisherName` — ⚠️ ต้องยืนยัน (contradiction)
- **SOURCE OF TRUTH:** `users.name`
- **COPIES:**
  - `payments.fisherName` — เขียน `payments/route.js:145` · `payments/create/page.js:316,333` | อ่าน `payments/page.js:384,471`
  - `fishingRecords.fisherName` — **contradiction:** list API derive สดจาก users (`fishing-records/route.js:167`, ไม่ persist) แต่ `fish-detail/route.js:92` อ่าน `data.fisherName` ตรงจาก doc + search filter `route.js:300` → บ่งชี้ว่า **บาง record มี fisherName ที่ persist ไว้** (mobile app เขียน?) — **ต้องยืนยัน**

### §4.2 `recordedBy` {name,role}
- **SOURCE:** `users` | **COPY:** `fishingRecords.recordedBy` — derive `fishing-records/route.js:183-186` (record มี → ใช้, ไม่มี → fallback users) | อ่าน `records/page.js:1298-1307` — จุด persist แรก ต้องยืนยัน (mobile)

### §4.3 `contributorName`
- **SOURCE:** `users.name` (`userProfile.name`) | **COPY:** `fishingWisdom.contributorName` — เขียน `wisdom/page.js:374` (+ `contributorId:373` เก็บ link) | อ่าน `wisdom/page.js:646` · `landing/page.js:1465` · `chunker.js:89`

### §4.4 `paidByName`
- **SOURCE:** auth user (`displayName||email`) | **COPY:** `payments.paidByName` — เขียน `create/page.js:325,345` · `payments/route.js:158` | อ่าน `payments/page.js:537`

### §4.5 `evaluatorName`
- **SOURCE:** `users.name` | **COPY:** `evaluationResults.evaluatorName` — เขียน `evaluation/page.js:196` (+ `evaluatorId:195`) | อ่าน CSV export `:215`

### §4.6 Species catalog fields (ส่วนใหญ่ JOIN ไม่ใช่ copy — low risk)
- **SOURCE:** `fish_species` (thai_name/scientific_name/iucn_status/local_name)
- `fishingRecords.fishList[]` เก็บแค่ `name/weight/count/price/photo` — **scientific_name/iucn_status JOIN ตอนอ่าน** จาก catalog (`landing-data/route.js:158-165` · `fishing-records/route.js:140-151`)
- **ยกเว้น `local_name`** อาจ persist บน fish entry (`fish.localName` `fish-verification/route.js:61`) — ต้องยืนยัน (mobile)

### §4.7 Payment status → fishingRecords (fan-out denorm)
- **SOURCE:** `payments` | **COPY:** `isPaid/paymentId/paymentDate/paymentAmount` บนทุก record ใน `recordIds`
- SET: `payments/route.js:178-181` · `create/page.js:360-363`
- REVERT: `payments/[id]/route.js:135-140` · `payments/page.js:168-170`
- **⚠️ Referential integrity risk:** ถ้าลบ fishingRecord ที่อยู่ใน `payments.recordIds` — payments ยัง reference recordId ที่หายไป + cancel-revert จะ `batch.update` doc ที่ไม่มี → **ไม่มี guard** (ต้องยืนยัน)

### §4.8 Photos (3 sources)
- `fishingRecords.fishList[].photo` = รูปจริงที่จับ (source of truth "ปลาที่จับ") — `records/page.js:677`
- `featuredFishPhotos.photoUrl` = admin override (copy URL) — `featured-fish-photos/route.js:37`
- `fish_species.image_url`/`photos[]` = catalog fallback — `landing-data/route.js:90`
- **Resolution:** featured → newest record photo → null (`landing-data/route.js:248`)
- **⚠️ Dangling risk:** ลบ record → ลบ Storage file (§5) แต่ **ไม่ล้าง `featuredFishPhotos`** ที่ชี้ URL เดิม → dangling ref (ต้องยืนยัน — ไม่พบ cleanup)

### §4.9 `totalWeight`/`totalValue` (stored vs recomputed — inconsistency)
- STORED บน record: `records/page.js:701-702`
- list API RECOMPUTE จาก fishList (ใช้ recomputed ถ้าต่าง >10% หรือ >10kg): `fishing-records/route.js:234-258` · `totalValue` **always recomputed** `:254`
- แต่ landing/charts/stats/dashboard อ่าน **stored** ตรงๆ: `landing-data/route.js:140` · `charts/route.js:68` · `stats/route.js:69` · `dashboard/page.js:137`
- **⚠️ Inconsistency:** list อาจโชว์ recomputed แต่ landing โชว์ stored (อาจ stale)

### §4.10 Counter
- `siteVisitors.totalVisitors` — atomic `increment(1)` `site-visitors/route.js:62` (intentional, ไม่ dup)

### §4.11 Divergent logic (helper vs inline)
- `EXCLUDED_SPECIES`: `firestore-helpers.js:86-90` (**3 กุ้ง — ขาด กุ้งขาว**) vs `build-embeddings.js:470-472` (4 กุ้ง) → **finding ยืนยันแล้ว §7.E**
- name field: helper `getFishName` ใช้ `name||commonName` (`firestore-helpers.js:78`) vs script `species||name` (`build-embeddings.js:429`) vs topbar inline `name||commonName` (`topbar-alerts.js:136`)
- date field order: helper `catchDate||date||timestamp` (`firestore-helpers.js:16`) vs script `date||catchDate` (`build-embeddings.js:408`)
- verified: helper `verified===true` (`firestore-helpers.js:108`) vs script `verified===true||verifiedBy` (`build-embeddings.js:763`)
- iucn: `iucn_status` (ทั่วไป) vs `iucn_status||conservation_status` (`topbar-alerts.js:114`)

---

## §5. Storage

Client init: `src/lib/firebase.js:22` (`export const storage = getStorage(app)`)

### §5.1 Upload sites
| Upload | Path pattern | URL เก็บใน field | file:line |
|---|---|---|---|
| Fishing record fish photo | `fishing-records/{recordId}/fish_{index}_{timestamp}.{ext}` | `fishingRecords.fishList[].photo` + `fishData[].photo` | path `records/page.js:631` · upload `:638` · URL `:642` · persist `:677,691` |
| Fisher profile photo | `fisher-profiles/{userId}/{timestamp}_{name}` | `users.fisherProfile.profilePhoto` | `users/page.js:639-651` · persist `:804,855` |
| News image | `news/{newsId}/{timestamp}.jpg` | `newsArticles.image` | `news/page.js:327-329` · persist `:179,215` |
| Wisdom image | `fishing-wisdom/{wisdomId}/{timestamp}.jpg` | `fishingWisdom.image` | `wisdom/page.js:246-248` · persist `:382,403` |
| Fish species catalog image | `fish_species/{id}/{timestamp}_{index}.jpg` | `fish_species.photos[]` + `image_url` | `fish-species/page.js:319-322` · persist `:336-342` |

> `featuredFishPhotos.photoUrl` **ไม่ upload** — copy URL ที่มีอยู่ (`featured-fish-photos/route.js:37`)

### §5.2 Delete sites
| Delete | Path derivation | ลบ Storage+Firestore พร้อมกัน? | file:line |
|---|---|---|---|
| Fishing record (API DELETE) | `gs://` strip หรือ `split('/o/')`+decode | **YES** loop fishList[].photo → deleteObject → deleteDoc | `[id]/route.js:261-292` (import `:11` · deleteObject `:277` · deleteDoc `:292`) |
| Fishing record (client dup) | เหมือนกัน | YES | `records/page.js:879-908` |
| Fisher profile old image | `split('/o/')[1]`+decode | Storage only (แทนรูป) | `users/page.js:682-688` |

### §5.3 Orphan / lifecycle risks (ต้องยืนยัน)
1. **`featuredFishPhotos` dangling** — ลบ record → ลบ Storage file แต่ไม่ล้าง featuredFishPhotos doc ที่ชี้ URL เดิม → landing serve broken URL (`landing-data/route.js:249`) — ไม่พบ cleanup
2. **Wisdom image orphan** — `handleDeleteWisdom` เรียกแค่ `deleteDoc` (`wisdom/page.js:420`) ไม่ `deleteObject` → **Storage file ค้าง**
3. **News image orphan** — upload `news/{newsId}/...` (`news/page.js:327`) ไม่มี `deleteObject` — **ต้องยืนยัน** ถ้าลบ news ได้ → รูปค้าง
4. **Fish-species image orphan** — upload `fish-species/page.js:320` ไม่มี deleteObject — แทน/ลบ species → รูปเก่าค้าง (ต้องยืนยัน)
5. **Payment↔record referential** — §4.7 (cross-collection orphan)
6. **Path-derivation fragility** — ทุก delete assume URL มี `/o/` หรือ `gs://` (`[id]/route.js:261-273`). URL non-Firebase หรือ bare path → skip เงียบ (guard `if(storagePath)`) + error swallowed (`catch console.warn` `:282-285`) → failed deletion ไม่ถูก track (นอกจาก `failedImages` ใน response)

### §5.4 Dual-implementation (ต้อง sync มือ)
- Delete record: `[id]/route.js:256-292` (API) vs `records/page.js:873-908` (client)
- Payment create: `payments/route.js:143-186` (API) vs `create/page.js:331-366` (client)
- Payment cancel: `payments/[id]/route.js:131-146` (API) vs `payments/page.js:168-170` (client)

---

## §6. Coverage (ไฟล์ที่สแกน)

- **API routes:** 31 ไฟล์ (`src/app/api/**/route.js`) — Firestore SDK 25 · REST 1 (`water-levels`) · no-Firestore 5
- **Dashboard pages:** 40 ไฟล์ (`src/app/(dashboard)/**/page.js`) — direct Firestore ~22 · API-only ~13 · none ~5
- **Public pages:** 5 (`landing`, `news-list`, `news/[id]`, `wisdom-list`, `wisdom/[id]`)
- **lib:** firebase.js, firebase-admin.js, api-auth.js, firestore-helpers.js, seed-admin.js, topbar-alerts.js, news-generators.js, api-client.js, rag/vector-store.js (+ helper libs ไม่มี Firestore op)
- **context:** AuthContext.js
- **scripts:** build-embeddings.js

### rules vs code (firestore.rules)
- **ใน rules แต่ไม่มีในโค้ด (dead rule):** `fishers` — เจ้าของยืนยันไม่มี collection จริง → §7.A
- **ในโค้ดแต่ไม่มีใน rules (dead):** `sensorData` — เจ้าของยืนยันไม่ได้ใช้ → §7.B (ไม่ใช่ปัญหา)
- **ทั้งใน rules + code:** chatLogs, evaluationResults, featuredFishPhotos, fish_species, fishingRecords, fishingSpots, fishingWisdom, knowledgeArticles, newsArticles, payments, rag_embeddings, siteVisitors, users, waterLevels, waterQuality, waterStations, webUsers (webUsers เขียนแต่ไม่อ่าน — ต้องยืนยัน)

---

## §7. Dead code / Findings / ต้องยืนยัน

> อัปเดต 2026-07-14 ตามข้อมูลยืนยันจากเจ้าของระบบ

### Dead code ที่ควรลบ (ยืนยันแล้ว)

**§7.A — `fishers` collection (dead rule)**
- เจ้าของยืนยัน: **ไม่มี collection `fishers` จริง**
- โค้ดที่ยังอ้าง: `firestore.rules:44-50` (`match /fishers/{fisherId}` — comment "Mobile App ถ้ามีในอนาคต") → **ควรลบทั้ง block**
- หมายเหตุ: ตัวแปรชื่อ `fishers`/`filteredFishers` ใน `payments/create/page.js:97,258` และ `users/statistics/page.js:189,231` เป็น **local array ของ users (role=fisher)** ไม่เกี่ยวกับ collection — ไม่ต้องแตะ

**§7.B — `sensorData` (dead read)**
- เจ้าของยืนยัน: **ไม่ได้ใช้งาน / ไม่มีข้อมูลจริง**
- โค้ดที่ยังอ้าง: `topbar-alerts.js:157` (query) + `topbar-alerts.js:7` (comment) + field parse `:160-180` → **dead read ควรพิจารณาลบ**
- การ**ไม่มีใน `firestore.rules` ไม่ใช่ปัญหา** (ไม่มี traffic จริง)

**§7.G — static JSON duplicate (dead files)**
- เจ้าของยืนยัน: **Firestore `fish_species` = source of truth**
- `src/fish-data.json` + `src/fish-data-full.json` — สแกน `src/` ทั้งหมด **ไม่พบ import/require/read** → dead static files ควรลบ
- ไม่มีที่ไหนอ่านจาก JSON แทน Firestore (ยืนยันด้วย grep: 0 hits)

### Findings (ควรแก้ — แต่ห้ามแก้ในโหมด audit นี้)

**§7.D — Role `fisherman` ยังไม่ active**
- เจ้าของยืนยัน: **role `fisherman` ยังไม่เปิดให้ login**
- นิยาม string เดียว: `api-auth.js:11` (`ROLES.FISHERMAN: 'fisherman'`) — **ไม่มีจุดไหนเปรียบเทียบกับ `'fisherman'`** (grep 0 hits นอกนิยาม)
- โค้ด/หน้า/rules ที่ **assume ว่า fisher login/มีสิทธิ์ได้** (ใช้ `USER_ROLES.FISHER='fisher'` ไม่ใช่ `'fisherman'`):
  - `DashboardLayout.js:37` — รวม `USER_ROLES.FISHER` ใน allowed roles ของ dashboard
  - `AuthContext.js:195` — `isFisher` flag (`role === USER_ROLES.FISHER`)
  - `users/page.js:179,469,525,729,822,1186,1307,1321,1434,1846,1967,2195` — admin สร้าง/แก้ user role=fisher + แสดง fisherProfile fields
  - `users/statistics/page.js:54,65,189,401` — สถิติ/ป้าย role fisher
  - `payments/create/page.js:126` — ดึง `/api/users?role=fisher`
  - `firestore.rules` — **ต้องยืนยัน** ว่ามี rule ผูกกับ role อะไร (ไม่พบ `'fisherman'` ใน rules)
- **สรุป finding:** มี 2 ชุด role constant ไม่ตรงกัน — `api-auth.js` มี `FISHERMAN:'fisherman'` (dead string) แต่ระบบจริงใช้ `USER_ROLES.FISHER:'fisher'` (`types/index.js:7`) → ควรรวมเป็นชุดเดียว

**§7.E — `EXCLUDED_SPECIES` ไม่ครบ (helper ขาด กุ้งขาว)**
- เจ้าของยืนยัน: **ควรมี 4 ตัว**
- ตรวจโค้ดจริง:
  - `firestore-helpers.js:86-90` `EXCLUDED_SPECIES_IN_REPORTS` = **3 ตัว** {กุ้งจ่ม, กุ้งฝอย, กุ้งก้ามกราม} ← **ขาด "กุ้งขาว"**
  - `build-embeddings.js:470-472` `EXCLUDED_SPECIES` = **4 ตัว** {กุ้งฝอย, กุ้งก้ามกราม, กุ้งขาว, กุ้งจ่ม} ✅
- **สรุป finding:** helper ที่ใช้ในหน้า reports/dashboard/maps (`firestore-helpers.js`) กรอง "กุ้งขาว" ไม่ออก → สถิติความหลากหลายอาจนับกุ้งขาวปน ขณะที่ RAG corpus ตัดออกแล้ว → **ควรเพิ่ม 'กุ้งขาว' ใน `firestore-helpers.js:86-90`**

### ต้องยืนยันต่อ (ยังไม่มีข้อมูล)

1. `webUsers` ยังใช้ไหม (เขียนโดย `seed-admin.js:21,53` แต่ auth อ่านจาก `users`)
2. AuthContext promote role-less → ADMIN (`AuthContext.js:41-48`) — ตั้งใจไหม (security)
3. `fisherName`/`recordedBy`/`fisherInfo`/`localName` persist บน fishingRecords จาก mobile — schema จริงเป็นยังไง
4. Storage orphan (wisdom `wisdom/page.js:420` / news / fish-species image) — มี cleanup ที่อื่นไหม
5. Payment `recordIds` referential integrity — มี guard เมื่อลบ record ที่ถูกจ่ายแล้วไหม
6. `totalWeight` stored vs recomputed (§4.9) — ตั้งใจให้ landing โชว์ stored, list โชว์ recomputed ไหม

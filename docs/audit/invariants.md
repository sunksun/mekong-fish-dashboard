# Invariants — สิ่งที่ "ต้องเป็นจริงเสมอ" ในระบบ

**อ้างอิงฐาน:** `docs/audit/data-flow.md` (baseline 2026-07-07, อัปเดต 2026-07-14)
**Scope:** web dashboard repo เท่านั้น — บาง field เขียนโดย mobile app (คนละ repo)
**กฎ:** ทุก INV derive จากสิ่งที่โค้ดทำจริง + อ้างกลับ data-flow.md ได้ · เฟสนี้แค่นิยามกฎ ยังไม่ตรวจว่าพังตรงไหน (เฟส 3)

> **การอ่าน "รักษาไว้ที่ไหน":** ถ้าไม่พบจุดที่บังคับ invariant → เขียน **"ไม่พบจุดที่รักษา invariant นี้"** = ความเสี่ยง (candidate สำหรับเฟส 3)

---

## กลุ่ม A — Denormalized name copies (§4.1–§4.5)

**INV-01: `payments.fisherName` ต้องตรงกับ `users/{userId}.name` ณ เวลาที่สร้าง payment เสมอ**
- แหล่งที่มา: §4.1 fisherName — SOURCE OF TRUTH = `users.name`, COPY = `payments.fisherName`
- รักษาไว้ที่ไหน: เขียนตอน create จาก user ที่เลือก `payments/route.js:145` · client dual `payments/create/page.js:316,333`
- หมายเหตุ: เป็น snapshot ณ เวลาสร้าง — **ไม่พบจุดที่รักษาให้ตรงเมื่อ `users.name` เปลี่ยนภายหลัง** (จะ stale)

**INV-02: `fishingRecords.fisherName` (ถ้า persist) ต้องตรงกับ `users/{userId}.name` ของเจ้าของ record**
- แหล่งที่มา: §4.1 fisherName contradiction — list API derive สดจาก users (`fishing-records/route.js:167`) แต่ `fish-detail/route.js:92` + filter `route.js:300` อ่าน field ที่ persist ไว้
- รักษาไว้ที่ไหน: list API derive สด `fishing-records/route.js:167` (ไม่ persist) · **จุด persist ต้องยืนยัน (mobile origin)** — ไม่พบจุด write ในรีโปนี้ → ถ้า mobile เขียนไว้ ไม่มีจุด reconcile ฝั่ง web

**INV-03: `fishingRecords.recordedBy` {name,role} ต้องสอดคล้องกับ `users/{userId}` (name + role) ของผู้บันทึก**
- แหล่งที่มา: §4.2 recordedBy — SOURCE = users, COPY = `fishingRecords.recordedBy`
- รักษาไว้ที่ไหน: derive ตอนอ่าน (record มี→ใช้, ไม่มี→fallback users) `fishing-records/route.js:183-186` · จุด persist แรก **ต้องยืนยัน (mobile)** `records/page.js:1298-1307` — ฝั่ง web ไม่พบจุด write ที่รับประกันความตรง

**INV-04: `fishingWisdom.contributorName` ต้องตรงกับ `users.name` ของ `contributorId` ที่เก็บคู่กัน**
- แหล่งที่มา: §4.3 contributorName — SOURCE = `users.name`, COPY = `fishingWisdom.contributorName` (+ `contributorId` เก็บ link)
- รักษาไว้ที่ไหน: เขียนคู่กันตอนสร้าง `wisdom/page.js:373-374` — snapshot ณ เวลาสร้าง · **ไม่พบจุดที่ sync เมื่อ `users.name` เปลี่ยน**

**INV-05: `payments.paidByName` ต้องตรงกับ auth user (`displayName||email`) ของ `paidBy` ที่เก็บคู่กัน**
- แหล่งที่มา: §4.4 paidByName — SOURCE = auth user, COPY = `payments.paidByName`
- รักษาไว้ที่ไหน: เขียนตอน create/pay `create/page.js:325,345` · `payments/route.js:158` — snapshot ผู้จ่าย (audit trail, โดยธรรมชาติไม่ต้อง sync ย้อนหลัง)

**INV-06: `evaluationResults.evaluatorName` ต้องตรงกับ `users.name` ของ `evaluatorId` ที่เก็บคู่กัน**
- แหล่งที่มา: §4.5 evaluatorName — SOURCE = `users.name`, COPY = `evaluationResults.evaluatorName` (+ `evaluatorId`)
- รักษาไว้ที่ไหน: เขียนคู่กันตอนบันทึกผล `evaluation/page.js:195-196` — snapshot ณ เวลาประเมิน (research record, ไม่ต้อง sync ย้อนหลัง)

---

## กลุ่ม B — Payment fan-out / referential integrity (§4.7)

**INV-07: `payments.recordIds[]` ทุกตัวต้องชี้ไปยัง `fishingRecords` doc ที่มีอยู่จริง**
- แหล่งที่มา: §4.7 Payment fan-out — referential integrity risk
- รักษาไว้ที่ไหน: **ไม่พบจุดที่รักษา invariant นี้** — ลบ fishingRecord (`[id]/route.js:292` / `records/page.js:908`) ไม่มี guard ตรวจว่า record นั้นถูกอ้างใน `payments.recordIds` (§4.7, §5.3 ข้อ 5) → dangling reference

**INV-08: fishingRecord หนึ่ง doc ต้องถูกอ้างใน `payments.recordIds` ของ payment ได้ไม่เกิน 1 ใบ (ไม่จ่ายซ้ำ)**
- แหล่งที่มา: §4.7 Payment fan-out (`isPaid/paymentId` เดี่ยวต่อ record) — 1 record ↔ 1 payment
- รักษาไว้ที่ไหน: create อ่านเฉพาะ `availableRecords`/`selectedRecords` (`payments/route.js:150-152`) — คัดเฉพาะ record ที่ยังไม่ถูกจ่าย · **การบังคับ 1-ต่อ-1 ระดับ transaction ต้องยืนยัน** (ไม่พบ atomic guard กันเลือกซ้ำ concurrent)

**INV-09: record ที่ `isPaid=true` ต้องมี `paymentId` ที่ชี้ไป payment doc ซึ่ง `recordIds` มี record นั้น (สองทางสอดคล้อง)**
- แหล่งที่มา: §4.7 SET `payments/route.js:178-181` · `create/page.js:360-363` — fan-out เขียน `isPaid/paymentId/paymentDate/paymentAmount` บนทุก record ใน `recordIds`
- รักษาไว้ที่ไหน: SET เขียนคู่กันใน batch เดียวกับสร้าง payment `payments/route.js:166,177` (multi-collection paired) · REVERT ตอน cancel `payments/[id]/route.js:135-140` · `payments/page.js:168-170` — **ไม่มี transaction/atomicity รับประกัน batch+addDoc สำเร็จพร้อมกัน** (ต้องยืนยัน)

**INV-10: เมื่อ cancel/ลบ payment — ทุก record ใน `recordIds` ต้องถูก revert (`isPaid=false`, ล้าง paymentId/paymentDate/paymentAmount)**
- แหล่งที่มา: §4.7 REVERT
- รักษาไว้ที่ไหน: `payments/[id]/route.js:135-140` (API) · `payments/page.js:168-170` (client dual) — revert `batch.update` ต่อ recordId · **ความเสี่ยง:** ถ้า recordId ใน list ถูกลบไปแล้ว `batch.update` doc ที่ไม่มี → ไม่มี guard (§4.7)

**INV-30: `payments` ต้องมีได้ไม่เกิน 1 ใบ ต่อ (userId, period) แม้เกิด concurrent request**
- แหล่งที่มา: finding #20 (race condition — period-level dup payment)
- รักษาไว้ที่ไหน: **ไม่พบจุดที่รักษา invariant นี้** — dup-guard `payments/route.js:120-125` เป็น `where`-query อยู่**นอก** transaction (Firestore: tx อ่านได้เฉพาะ `tx.get(docRef)` ไม่รองรับ where/range query) + payment doc id เป็น random (`:166`) → race window ระหว่างอ่าน (`:125`) ถึง tx commit → 2 request (userId+period เดียว, recordIds ไม่ทับ) สร้าง payment ซ้ำได้. ปิดสนิทต้องเปลี่ยนเป็น deterministic doc id (`${userId}_${period}`) + `tx.get(docRef)` ใน tx (finding #20)

---

## กลุ่ม C — Species catalog JOIN (§4.6)

**INV-11: scientific_name / iucn_status ที่แสดงคู่ปลาต้อง JOIN จาก `fish_species` catalog เสมอ (ไม่อ่าน copy บน record)**
- แหล่งที่มา: §4.6 Species catalog fields — SOURCE = `fish_species`, `fishingRecords.fishList[]` เก็บแค่ name/weight/count/price/photo
- รักษาไว้ที่ไหน: JOIN ตอนอ่าน `landing-data/route.js:158-165` · `fishing-records/route.js:140-151` (low risk — เป็น JOIN ไม่ใช่ copy)

**INV-12: ชื่อชนิดปลาใน `fishingRecords.fishList[].name` ต้อง match ชื่อใน `fish_species` catalog เพื่อ JOIN ได้ (key ตรงกัน)**
- แหล่งที่มา: §4.6 (JOIN by name) + §3 admin/fix-species-name (จุด reconcile ชื่อข้าม 2 collection)
- รักษาไว้ที่ไหน: reconcile ด้วยมือผ่าน `admin/fix-species-name/route.js:78` (fishingRecords) + `:51` (fish_species) paired · **ไม่มี constraint บังคับ name ตรงตอนเขียน record** (mobile เขียน fishList) → JOIN miss เป็นไปได้

---

## กลุ่ม D — Photos consistency (§4.8, §5)

**INV-13: ทุก photo URL ใน Firestore ต้องมีไฟล์อยู่จริงใน Storage และเมื่อลบ doc ต้องลบไฟล์ตาม**
- แหล่งที่มา: §5.1 (upload sites) + §5.2 (delete sites) + §5.3 (orphan risks)
- รักษาไว้ที่ไหน (แยกตาม field):
  - `fishingRecords.fishList[].photo` — **รักษาได้:** ลบ record → loop ลบ Storage + deleteDoc `[id]/route.js:261-292` · client dual `records/page.js:879-908`
  - `fishingWisdom.image` — **ไม่พบจุดที่รักษา:** delete เรียกแค่ `deleteDoc` (`wisdom/page.js:420`) ไม่ `deleteObject` → Storage orphan (§5.3 ข้อ 2)
  - `newsArticles.image` — **ต้องยืนยัน:** upload `news/page.js:327` ไม่พบ `deleteObject` เมื่อลบ news → รูปค้าง (§5.3 ข้อ 3)
  - `fish_species.photos[]`/`image_url` — **ต้องยืนยัน:** upload `fish-species/page.js:320` ไม่พบ `deleteObject` เมื่อแทน/ลบ species → รูปเก่าค้าง (§5.3 ข้อ 4)
  - `users.fisherProfile.profilePhoto` — **รักษาได้ (แทนรูป):** ลบรูปเก่าตอนอัปโหลดใหม่ `users/page.js:682-688`

**INV-14: `featuredFishPhotos.photoUrl` ต้องชี้ไปยัง photo ที่ยังมีอยู่จริง (ไฟล์ใน Storage + record ต้นทางถ้าอ้าง recordId)**
- แหล่งที่มา: §4.8 Photos (featured = admin override copy URL) + §5.3 ข้อ 1 dangling risk
- รักษาไว้ที่ไหน: **ไม่พบจุดที่รักษา invariant นี้** — ลบ record → ลบ Storage file แต่ไม่ล้าง `featuredFishPhotos` doc ที่ชี้ URL เดิม → landing serve broken URL (`landing-data/route.js:249`)

**INV-15: การลบไฟล์ Storage ต้อง derive path จาก URL ได้สำเร็จ (URL ต้องเป็นรูปแบบ Firebase `/o/` หรือ `gs://`)**
- แหล่งที่มา: §5.3 ข้อ 6 Path-derivation fragility
- รักษาไว้ที่ไหน: guard `if(storagePath)` + strip/decode `[id]/route.js:261-273` · client `records/page.js:879` — **ความเสี่ยง:** URL non-Firebase / bare path → skip เงียบ, error swallowed (`catch console.warn` `[id]/route.js:282-285`) → failed deletion ไม่ถูก track (นอกจาก `failedImages` ใน response)

**INV-16: Storage upload path ต้องผูกกับ owner doc ID (recordId/userId/newsId/wisdomId/species id) ตาม pattern เพื่อ trace + cleanup ได้**
- แหล่งที่มา: §5.1 Upload sites (path patterns ทั้ง 5)
- รักษาไว้ที่ไหน: กำหนด path ตอน upload — `fishing-records/{recordId}/...` `records/page.js:631` · `fisher-profiles/{userId}/...` `users/page.js:639` · `news/{newsId}/...` `news/page.js:327` · `fishing-wisdom/{wisdomId}/...` `wisdom/page.js:246` · `fish_species/{id}/...` `fish-species/page.js:319`

---

## กลุ่ม E — Stored vs recomputed aggregate (§4.9)

**INV-17: `fishingRecords.totalValue` ต้องเท่ากับผลรวม `fishList[].price` เสมอ**
- แหล่งที่มา: §4.9 totalWeight/totalValue — STORED บน record vs list API always recomputed
- รักษาไว้ที่ไหน: STORED เขียนตอนสร้าง `records/page.js:702` · list API **always recomputed** จาก fishList `fishing-records/route.js:254` · **แต่** landing/charts/stats/dashboard อ่าน stored ตรงๆ `landing-data/route.js:140` · `charts/route.js:68` · `stats/route.js:69` · `dashboard/page.js:137` → **ไม่พบจุดที่รักษาให้ stored = sum เสมอ** (list โชว์ recomputed, landing โชว์ stored → อาจต่างกัน)

**INV-18: `fishingRecords.totalWeight` ต้องเท่ากับผลรวม `fishList[].weight` (ภายใน tolerance ที่ระบบยอมรับ)**
- แหล่งที่มา: §4.9 — list API ใช้ recomputed ถ้าต่าง >10% หรือ >10kg
- รักษาไว้ที่ไหน: STORED `records/page.js:701` · PATCH reconcile `[id]/route.js:114` · list API recompute-if-diff `fishing-records/route.js:234-258` — **มี reconciliation บางส่วน แต่ landing/charts/stats/dashboard ยังอ่าน stored** → stale ได้ (§4.9 inconsistency)

---

## กลุ่ม F — Counter (§4.10)

**INV-19: `siteVisitors/stats.totalVisitors` ต้องเพิ่มแบบ atomic ทีละ 1 ต่อ visit (ไม่ double-count / ไม่ race)**
- แหล่งที่มา: §4.10 Counter — atomic `increment(1)` (intentional)
- รักษาไว้ที่ไหน: **รักษาได้:** atomic `increment(1)` ผ่าน `setDoc(merge)` `site-visitors/route.js:61-62` — Firestore รับประกัน atomicity ระดับ field

---

## กลุ่ม G — Divergent logic ต้องเป็นกฎเดียว (§4.11)

**INV-20: `EXCLUDED_SPECIES` (ปลา/กุ้งที่ตัดออกจากสถิติ+RAG) ต้องเป็นชุดเดียวกันทุกจุด (4 ตัว: กุ้งฝอย/กุ้งก้ามกราม/กุ้งขาว/กุ้งจ่ม)**
- แหล่งที่มา: §4.11 Divergent logic + §7.E (finding ยืนยันแล้ว)
- รักษาไว้ที่ไหน: **ไม่พบจุดที่รักษาให้ตรงกัน (2 ชุดไม่ sync)** — `firestore-helpers.js:86-90` มี 3 ตัว (ขาด กุ้งขาว) vs `build-embeddings.js:470-472` มี 4 ตัว → reports/dashboard/maps นับกุ้งขาวปน (§7.E)

**INV-21: การ derive ชื่อปลา / วันที่ / verified / iucn จาก record ต้องใช้ helper เดียวกันทุกจุด (นิยามเดียว)**
- แหล่งที่มา: §4.11 Divergent logic (name/date/verified/iucn มีหลายนิยาม)
- รักษาไว้ที่ไหน: **ไม่พบจุดที่รักษาให้เป็นนิยามเดียว** — name: `getFishName` `name||commonName` (`firestore-helpers.js:78`) vs script `species||name` (`build-embeddings.js:429`) vs topbar `name||commonName` (`topbar-alerts.js:136`) · date: `catchDate||date||timestamp` (`firestore-helpers.js:16`) vs `date||catchDate` (`build-embeddings.js:408`) · verified: `verified===true` (`firestore-helpers.js:108`) vs `verified===true||verifiedBy` (`build-embeddings.js:763`) · iucn: `iucn_status` vs `iucn_status||conservation_status` (`topbar-alerts.js:114`)

---

## กลุ่ม H — Dual-implementation ต้อง sync (§5.4)

**INV-22: การลบ record / create payment / cancel payment ผ่าน API และผ่าน client ต้องให้ผลลัพธ์เดียวกัน (logic sync กัน)**
- แหล่งที่มา: §5.4 Dual-implementation (ต้อง sync มือ)
- รักษาไว้ที่ไหน: **ไม่พบจุดที่รักษา (ต้อง sync ด้วยมือ)** — Delete record: `[id]/route.js:256-292` vs `records/page.js:873-908` · Payment create: `payments/route.js:143-186` vs `create/page.js:331-366` · Payment cancel: `payments/[id]/route.js:131-146` vs `payments/page.js:168-170`

---

## กลุ่ม I — INV จาก "ต้องยืนยันต่อ 6 ข้อ" (§7)

**INV-23: identity + role ต้องอ่านจาก `users` collection เท่านั้น (`webUsers` ต้องไม่เป็น source of auth)**
- แหล่งที่มา: §7 ต้องยืนยัน ข้อ 1 — `webUsers` เขียนโดย `seed-admin.js` แต่ auth อ่านจาก `users`
- รักษาไว้ที่ไหน: auth/role lookup อ่านจาก `users` `api-auth.js:32,34,37` · AuthContext `AuthContext.js:36` · `webUsers` มีจุดเขียน `seed-admin.js:21,53` แต่ **ไม่พบจุดอ่าน** → ถ้า dead ควรลบ (ต้องยืนยัน)

**INV-24: user ที่ไม่มี role ต้องไม่ถูกเลื่อนสิทธิ์เป็น ADMIN อัตโนมัติ**
- แหล่งที่มา: §7 ต้องยืนยัน ข้อ 2 + §สรุป red flag ข้อ 6 — AuthContext promote role-less → ADMIN
- รักษาไว้ที่ไหน: **ไม่พบจุดที่รักษา invariant นี้ (โค้ดทำตรงข้าม)** — `AuthContext.js:41-48` เลื่อน role-less user เป็น ADMIN อัตโนมัติ → security risk (ต้องยืนยันว่าตั้งใจ)

**INV-25: role ที่ใช้ตัดสินสิทธิ์ต้องมาจากชุด constant เดียว (`USER_ROLES` — `fisher` active) — `'fisherman'` ต้องไม่ปรากฏเป็น role จริง**
- แหล่งที่มา: §7 ต้องยืนยัน ข้อ 3 (ทางอ้อม) + §7.D (role fisherman ยังไม่ active, 2 ชุด constant ไม่ตรง)
- รักษาไว้ที่ไหน: **ไม่พบจุดที่รักษา (มี 2 ชุด constant)** — active `USER_ROLES.FISHER='fisher'` (`types/index.js:7`, ใช้ `DashboardLayout.js:37` · `AuthContext.js:195`) vs dead string `ROLES.FISHERMAN='fisherman'` (`api-auth.js:11`, grep 0 hits นอกนิยาม) (§7.D)

**INV-26: `fisherName`/`recordedBy`/`fisherInfo`/`localName` ที่ persist บน `fishingRecords` (จาก mobile) ต้องมี schema สอดคล้องกับที่ web อ่าน**
- แหล่งที่มา: §7 ต้องยืนยัน ข้อ 3 — schema จริงจาก mobile ต้องยืนยัน
- รักษาไว้ที่ไหน: **ไม่พบจุดที่รักษาฝั่ง web (mobile origin)** — web อ่าน `fisherName` `fish-detail/route.js:92` · `fisherInfo.name` `topbar-alerts.js:141` · `recordedBy` `records/page.js:1298` · `localName` `fish-verification/route.js:61` แต่ไม่มีจุด write/validate ในรีโปนี้

**INV-27: Storage file ที่ upload ทุกจุดต้องมี lifecycle cleanup เมื่อ doc ต้นทางถูกลบ (ไม่เหลือ orphan)**
- แหล่งที่มา: §7 ต้องยืนยัน ข้อ 4 — Storage orphan (wisdom/news/fish-species)
- รักษาไว้ที่ไหน: **ไม่พบจุด cleanup สำหรับ:** wisdom image (`wisdom/page.js:420` deleteDoc เท่านั้น) · news image · fish-species image (§5.3 ข้อ 2-4) — เทียบกับ fishingRecords ที่มี cleanup ครบ (§5.2)

**INV-28: การลบ record ที่ถูกจ่ายแล้ว (`isPaid=true` / อยู่ใน `payments.recordIds`) ต้องมี guard ไม่ให้เกิด dangling reference ใน payments**
- แหล่งที่มา: §7 ต้องยืนยัน ข้อ 5 — Payment recordIds referential integrity (ซ้ำมุมกับ INV-07/INV-10)
- รักษาไว้ที่ไหน: **ไม่พบ guard** — delete record `[id]/route.js:292` · `records/page.js:908` ไม่ตรวจ `isPaid`/`payments.recordIds` ก่อนลบ (§4.7, §5.3 ข้อ 5)

**INV-29: การเลือกใช้ `totalWeight`/`totalValue` (stored vs recomputed) ต้องมีนโยบายเดียวกันทุกหน้า (ผู้ใช้เห็นค่าเดียวกันสำหรับ record เดียวกัน)**
- แหล่งที่มา: §7 ต้องยืนยัน ข้อ 6 (ตั้งใจให้ landing=stored, list=recomputed ไหม) — ซ้ำมุมกับ INV-17/INV-18
- รักษาไว้ที่ไหน: **ไม่พบนโยบายรวม** — list API recomputed `fishing-records/route.js:234-258` vs landing/charts/stats/dashboard stored `landing-data/route.js:140` · `charts/route.js:68` · `stats/route.js:69` · `dashboard/page.js:137` → ต้องยืนยันว่าตั้งใจ (§4.9)

---

## สรุปเมทริกซ์ (invariant → มีจุดรักษาไหม)

| INV | หัวข้อ | มีจุดรักษา? |
|---|---|---|
| INV-01 | payments.fisherName = users.name | ✅ ตอนสร้าง (stale ได้ทีหลัง) |
| INV-02 | records.fisherName = users.name | ⚠️ mobile origin — ไม่พบฝั่ง web |
| INV-03 | records.recordedBy ↔ users | ⚠️ derive อ่าน / persist ต้องยืนยัน |
| INV-04 | wisdom.contributorName = users.name | ✅ ตอนสร้าง (stale ได้) |
| INV-05 | payments.paidByName = auth user | ✅ audit snapshot |
| INV-06 | evaluationResults.evaluatorName | ✅ research snapshot |
| INV-07 | recordIds → record มีจริง | ❌ ไม่พบ guard |
| INV-08 | 1 record ↔ ≤1 payment | ⚠️ atomic guard ต้องยืนยัน |
| INV-09 | isPaid ↔ paymentId ↔ recordIds สองทาง | ⚠️ ไม่มี transaction |
| INV-10 | cancel → revert ทุก record | ✅ revert / ❌ ไม่มี guard doc หาย |
| INV-11 | scientific/iucn JOIN จาก catalog | ✅ JOIN ตอนอ่าน |
| INV-12 | fishList.name match catalog | ❌ ไม่มี constraint |
| INV-13 | photo URL ↔ Storage file + ลบตาม | ✅ records / ❌ wisdom / ⚠️ news,species |
| INV-14 | featuredFishPhotos ไม่ dangling | ❌ ไม่พบ cleanup |
| INV-15 | delete derive path สำเร็จ | ⚠️ fragile, error swallowed |
| INV-16 | upload path ผูก owner id | ✅ ทุก upload |
| INV-17 | totalValue = sum(price) | ❌ stored vs recomputed ต่างได้ |
| INV-18 | totalWeight = sum(weight) | ⚠️ reconcile บางส่วน |
| INV-19 | totalVisitors atomic +1 | ✅ increment |
| INV-20 | EXCLUDED_SPECIES ชุดเดียว | ❌ 2 ชุดไม่ sync (§7.E) |
| INV-21 | derive name/date/verified/iucn นิยามเดียว | ❌ หลายนิยาม |
| INV-22 | API ↔ client dual logic sync | ❌ ต้อง sync มือ |
| INV-23 | auth อ่าน users เท่านั้น | ✅ / webUsers dead ต้องยืนยัน |
| INV-24 | role-less ไม่เลื่อนเป็น ADMIN | ❌ โค้ดทำตรงข้าม |
| INV-25 | role จาก constant เดียว | ❌ 2 ชุด (§7.D) |
| INV-26 | mobile-persist fields schema ตรง | ⚠️ mobile origin |
| INV-27 | Storage lifecycle cleanup | ❌ wisdom/news/species orphan |
| INV-28 | ลบ record จ่ายแล้ว มี guard | ❌ ไม่พบ guard |
| INV-29 | totalWeight/Value นโยบายเดียว | ❌ ไม่พบนโยบายรวม |
| INV-30 | ≤1 payment ต่อ (userId, period) concurrent | ❌ dup-guard นอก tx (race) |

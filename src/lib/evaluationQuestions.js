// ชุดคำถามประเมินผล 60 ข้อ สำหรับเปรียบเทียบ RAG (Condition B) vs Baseline LLM (Condition A)
//
// หมวด A: ข้อมูลชนิดปลา (20 ข้อ) — A01–A20
// หมวด B: สถิติการจับปลา (15 ข้อ) — B01–B15
// หมวด C: สภาพแวดล้อม (15 ข้อ) — C01–C15
// หมวด D: ความรู้ท้องถิ่น (10 ข้อ) — D01–D10
//
// difficulty:
//   - easy   = คำตอบสั้น 1 ข้อเท็จจริง อยู่ในเอกสารเดียว
//   - medium = ต้องรวมหลายข้อเท็จจริง / มีเงื่อนไข
//   - hard   = ต้อง reasoning / เปรียบเทียบ / อ้างอิงหลายเอกสาร
//
// ⚠️  goldAnswer ที่มีคำว่า [ตรวจสอบ...] = ผู้วิจัยต้องยืนยันค่าจาก corpus จริงก่อน freeze
// ⚠️  goldAnswer ที่ไม่มีวงเล็บ = ผู้เชี่ยวชาญยืนยันแล้ว (ให้ mark confirmed: true เมื่อผ่าน IOC)
//
// ⚠️  ตัวอย่างด้านล่างเป็น draft — ต้องปรึกษาผู้เชี่ยวชาญ (ศูนย์วิจัยและพัฒนาประมงน้ำจืดเลย)
// เพื่อ finalize gold answers ก่อนใช้เก็บผลจริง (IOC ≥ 0.50 ทุกข้อ)

export const QUESTION_SET = [

  // ═══════════════════════════════════════════════════════════════════════
  // หมวด A: ข้อมูลชนิดปลา (A01–A20)
  // Source: fish_species collection (313 species)
  // Fields: thai_name, scientific_name, family, iucn_status, habitat, description
  // ═══════════════════════════════════════════════════════════════════════

  // ─── easy: A01–A07 (single-hop fact lookup) ───────────────────────────

  { id: 'A01', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',
    question: 'ปลาบึกมีชื่อวิทยาศาสตร์ว่าอะไร',
    goldAnswer: 'Pangasianodon gigas — ปลาบึก (giant Mekong catfish) ในวงศ์ Pangasiidae' },

  { id: 'A02', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',
    question: 'ปลาแขยงจัดอยู่ในวงศ์อะไร',
    goldAnswer: 'วงศ์ Bagridae (ปลาหนัง)' },

  { id: 'A03', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',
    question: 'ปลาสวายมีชื่อท้องถิ่นอะไรบ้าง',
    goldAnswer: 'ชื่อท้องถิ่นในภาคอีสาน ได้แก่ ปลาสวาย, ปลาโมง' },

  { id: 'A04', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',
    question: 'ปลาเทโพมีชื่อวิทยาศาสตร์ว่าอะไร',
    goldAnswer: 'Pangasius larnaudii — จัดอยู่ในวงศ์ Pangasiidae เช่นเดียวกับปลาบึก' },

  { id: 'A05', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',
    question: 'ปลากระโห้มีชื่อวิทยาศาสตร์ว่าอะไร',
    goldAnswer: 'Catlocarpio siamensis — ปลากระโห้ (Giant barb) ในวงศ์ Cyprinidae เป็นปลาน้ำจืดที่ใหญ่ที่สุดในเอเชียตะวันออกเฉียงใต้' },

  { id: 'A06', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',
    question: 'ปลากระโห้มีสถานะการอนุรักษ์ IUCN ระดับใด',
    goldAnswer: 'Critically Endangered (CR) — ใกล้สูญพันธุ์ขั้นวิกฤต ตามบัญชี IUCN Red List' },

  { id: 'A07', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'easy',
    question: 'ปลาตะเพียนขาวจัดอยู่ในวงศ์อะไร และมีชื่อวิทยาศาสตร์ว่าอะไร',
    goldAnswer: 'ปลาตะเพียนขาว มีชื่อวิทยาศาสตร์ว่า Barbonymus gonionotus (Bleeker, 1849) จัดอยู่ในวงศ์ Cyprinidae (ปลาตะเพียน)' },

  // ─── medium: A08–A14 (multi-fact / conditional) ────────────────────────

  { id: 'A08', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium',
    question: 'ปลาที่มีสถานะ IUCN เป็น CR ในแม่น้ำโขงที่บันทึกในระบบมีชนิดใดบ้าง',
    goldAnswer: 'อย่างน้อย ปลาบึก (Pangasianodon gigas) และปลากระโห้ (Catlocarpio siamensis) — [ตรวจสอบรายการครบถ้วนจาก fish_species collection field: iucn_status = "CR"]' },

  { id: 'A09', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium',
    question: 'ปลาในวงศ์ Pangasiidae ที่บันทึกไว้ในระบบมีชนิดใดบ้าง',
    goldAnswer: '[ตรวจสอบจาก fish_species collection — filter: family = "Pangasiidae" แล้วระบุรายชื่อ thai_name + scientific_name ทุกชนิด] ควรรวมถึงอย่างน้อย ปลาบึก, ปลาสวาย, ปลาเทโพ' },

  { id: 'A10', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium',
    question: 'ปลาที่มีสถานะ IUCN ระดับ EN (Endangered) ในระบบมีกี่ชนิด และชนิดใดบ้าง',
    goldAnswer: '[ตรวจสอบจาก fish_species collection — filter: iucn_status = "EN" แล้วนับและระบุรายชื่อ thai_name + scientific_name]' },

  { id: 'A11', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium',
    question: 'ปลากระโห้และปลาบึกมีสถานะ IUCN เหมือนหรือต่างกัน อย่างไร',
    goldAnswer: 'ทั้งสองชนิดมีสถานะ IUCN เหมือนกัน คือ Critically Endangered (CR) — ปลากระโห้ (Catlocarpio siamensis) และปลาบึก (Pangasianodon gigas) ต่างอยู่ในกลุ่มเสี่ยงสูญพันธุ์ขั้นวิกฤต' },

  { id: 'A12', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium',
    question: 'ปลาชนิดใดในระบบที่จัดอยู่ในวงศ์ Siluridae และมีลักษณะ habitat เป็นอย่างไร',
    goldAnswer: '[ตรวจสอบจาก fish_species collection — filter: family = "Siluridae" แล้วระบุ thai_name, scientific_name และ habitat ที่บันทึกไว้]' },

  { id: 'A13', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium',
    question: 'ปลาที่จับได้มากที่สุดในฐานข้อมูล (ปลาน้ำฝาย) จัดอยู่ในวงศ์อะไร และมีชื่อวิทยาศาสตร์ว่าอะไร',
    goldAnswer: '[ตรวจสอบจาก fish_species collection — ค้นหา thai_name = "น้ำฝาย" หรือชื่อใกล้เคียง แล้วระบุ family และ scientific_name]' },

  { id: 'A14', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'medium',
    question: 'ปลาในวงศ์ Cyprinidae ที่บันทึกในระบบ มีจำนวนกี่ชนิด และชนิดใดมีสถานะ threatened (CR/EN/VU)',
    goldAnswer: '[ตรวจสอบจาก fish_species collection — filter: family = "Cyprinidae" นับทั้งหมด และ filter ซ้อนด้วย iucn_status IN ["CR","EN","VU"] เพื่อระบุรายชื่อ]' },

  // ─── hard: A15–A20 (multi-hop / comparison / reasoning) ───────────────

  { id: 'A15', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',
    question: 'ปลาในวงศ์ Cyprinidae ที่พบในแม่น้ำโขงตอนบนมีลักษณะร่วมและต่างกันอย่างไร',
    goldAnswer: 'ตอบเชิงเปรียบเทียบ — ต้องอ้างจากฐานข้อมูลชนิดปลาในโครงการ ระบุลักษณะที่ตรงกับข้อมูล habitat/description ที่มี' },

  { id: 'A16', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',
    question: 'เปรียบเทียบ habitat และนิสัยอาศัยของปลาบึก ปลาเทโพ และปลากระโห้ จากข้อมูลในระบบ',
    goldAnswer: '[ตรวจสอบจาก fish_species collection — เปรียบเทียบ field: habitat และ description ของ ปลาบึก, ปลาเทโพ, ปลากระโห้ — ทั้งสามเป็นปลาแม่น้ำขนาดใหญ่ที่ต้องการแหล่งน้ำเปิด แต่รายละเอียดต่างกัน]' },

  { id: 'A17', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',
    question: 'ปลาที่มีสถานะ threatened (CR, EN หรือ VU) ในระบบมีกี่ชนิดรวมกัน และสัดส่วนเทียบกับปลาทั้งหมดในฐานข้อมูลเป็นอย่างไร',
    goldAnswer: '[ตรวจสอบจาก fish_species collection (313 ชนิดรวม) — filter: iucn_status IN ["CR","EN","VU"] นับ + คำนวณ % เทียบกับ 313 ชนิด]' },

  { id: 'A18', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',
    question: 'อธิบายความแตกต่างระหว่างปลากินพืช (herbivore) กับปลากินสัตว์ (carnivore) ในแม่น้ำโขง โดยยกตัวอย่างชนิดปลาจากฐานข้อมูลของโครงการ',
    goldAnswer: '[ตรวจสอบจาก fish_species collection — ค้นหา field: description ที่ระบุนิสัยอาหาร แล้วเลือกตัวอย่างปลากินพืชและปลากินสัตว์ที่มีข้อมูลชัดเจน]' },

  { id: 'A19', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',
    question: 'วิเคราะห์ว่าปลาที่ใกล้สูญพันธุ์ขั้นวิกฤต (CR) ในระบบมี habitat ร่วมกันอย่างไร และสิ่งนี้บอกอะไรเกี่ยวกับภัยคุกคามต่อระบบนิเวศแม่น้ำโขง',
    goldAnswer: '[ตรวจสอบจาก fish_species collection — รวม habitat ของทุกชนิด CR แล้ว reasoning ว่ามีรูปแบบร่วมกัน (เช่น แม่น้ำสายหลัก ความลึก น้ำไหลเร็ว) ซึ่งสะท้อนถึงการเปลี่ยนแปลง hydrological regime]' },

  { id: 'A20', category: 'A', categoryLabel: 'ข้อมูลชนิดปลา', difficulty: 'hard',
    question: 'วงศ์ปลา (family) ใดที่มีจำนวนชนิดมากที่สุดในฐานข้อมูลโครงการ มีกี่ชนิด และมีชนิดใดที่มีสถานะ threatened บ้าง',
    goldAnswer: '[ตรวจสอบจาก fish_species collection — group by family นับ count แล้วเลือก family ที่มาก count สูงสุด + filter threatened ซ้อนทับ] คาดว่า Cyprinidae น่าจะมากที่สุดในฐานะวงศ์ปลาหลักของแม่น้ำโขง' },

  // ═══════════════════════════════════════════════════════════════════════
  // หมวด B: สถิติการจับปลา (B01–B15)
  // Source: fishingRecords (1,339 records) + stats virtual aggregate (8 chunks)
  // Stats chunks: overall, top-by-count, top-by-weight, top-by-records,
  //               by-gear, by-location, yearly, monthly
  // ═══════════════════════════════════════════════════════════════════════

  // ─── easy: B01–B05 (single aggregate fact) ────────────────────────────
  // ⚠️ Numerical answers use tolerance ranges because the corpus grows over time.
  //    Snapshot ณ 2026-07-07: records=1,398, weight=7,376.43 kg, fish=13,136 ตัว
  //    Evaluator ควรยอมรับคำตอบที่อยู่ใน tolerance ±5% ของค่า snapshot ที่ freeze
  //    ก่อนวันวัดผลจริง (ให้ระบุค่าจริง ณ วัน evaluation ใน gold answer อีกครั้ง)

  { id: 'B01', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',
    question: 'ในโครงการมีบันทึกการจับปลากี่ครั้ง',
    goldAnswer: 'ประมาณ 1,400 ครั้ง (ยอมรับคำตอบในช่วง 1,300–1,500 ครั้ง) — ค่าจริง ณ snapshot 2026-07-07 = 1,398 ครั้ง ตรวจสอบจาก stats/overall chunk ณ วันเก็บผลจริง' },

  { id: 'B02', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',
    question: 'ปลาชนิดใดที่จับได้จำนวนตัวมากที่สุดในฐานข้อมูล',
    goldAnswer: 'ปลาน้ำฝาย (Sikukia gudgeri) — อันดับ 1 จำนวนประมาณ 3,700–3,800 ตัว (snapshot 2026-07-07 = 3,770 ตัว) จาก stats/top-by-count chunk' },

  { id: 'B03', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',
    question: 'มีปลารวมทั้งหมดกี่ตัวที่บันทึกในฐานข้อมูลโครงการ',
    goldAnswer: 'ประมาณ 13,000 ตัว (ยอมรับช่วง 12,500–13,500 ตัว) — ค่าจริง ณ snapshot 2026-07-07 = 13,136 ตัว (ไม่รวมกุ้ง 4 ชนิด) จาก stats/overall chunk' },

  { id: 'B04', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',
    question: 'น้ำหนักปลารวมทั้งหมดในฐานข้อมูลโครงการมีเท่าไหร่',
    goldAnswer: 'ประมาณ 7,400 กิโลกรัม (ยอมรับช่วง 7,000–7,700 กก.) — ค่าจริง ณ snapshot 2026-07-07 = 7,376.43 กก. จาก stats/overall chunk (คำนวณจาก field totalWeight ของทุก record)' },

  { id: 'B05', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'easy',
    question: 'ปลาตะเพียนทรายถูกบันทึกว่าจับได้กี่ตัวในฐานข้อมูล',
    goldAnswer: 'ประมาณ 1,200 ตัว (ยอมรับช่วง 1,150–1,250 ตัว) — ค่าจริง ณ snapshot 2026-07-07 = 1,201 ตัว จาก 2 records อันดับ 2 ใน stats/top-by-count' },

  // ─── medium: B06–B10 (multi-fact / derived) ───────────────────────────

  { id: 'B06', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium',
    question: 'ปลา 5 อันดับแรกที่จับได้มากที่สุด (นับจำนวนตัว) มีชนิดใดบ้าง',
    goldAnswer: 'อันดับ 1: น้ำฝาย (~3,770 ตัว) | อันดับ 2: ตะเพียนทราย (~1,200 ตัว) | อันดับ 3: ปากเปี่ยน (~850 ตัว) | อันดับ 4: ตะกาก (~750 ตัว) | อันดับ 5: หนามหลัง (~600 ตัว) — ยอมรับคำตอบที่ระบุ 5 ชนิดถูกต้องแม้ตัวเลขต่างกัน ±10% (snapshot 2026-07-07)' },

  { id: 'B07', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium',
    question: 'ปลาตะกากปรากฏในบันทึกการจับปลากี่ครั้ง (จำนวน records)',
    goldAnswer: 'ประมาณ 500 records (ยอมรับช่วง 480–520) — ค่าจริง ณ snapshot 2026-07-07 = 509 records จำนวนตัวรวม ~750 ตัว เฉลี่ย ~1.5 ตัว/ครั้ง จาก stats/top-by-records chunk' },

  { id: 'B08', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium',
    question: 'น้ำหนักเฉลี่ยต่อตัวของปลาทั้งหมดในฐานข้อมูลคำนวณได้เท่าไหร่',
    goldAnswer: 'ประมาณ 0.55–0.60 กิโลกรัมต่อตัว (คำนวณจาก totalWeight ÷ totalFishCount — snapshot 2026-07-07 ให้ค่า 7,376 kg ÷ 13,136 ตัว ≈ 0.562 kg/ตัว)' },

  { id: 'B09', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium',
    question: 'จำนวนตัวปลาเฉลี่ยต่อการบันทึก 1 ครั้งในฐานข้อมูลเป็นเท่าไหร่',
    goldAnswer: 'ประมาณ 9–10 ตัวต่อครั้ง (คำนวณจาก totalFishCount ÷ records — snapshot 2026-07-07 ให้ค่า 13,136 ÷ 1,398 ≈ 9.40 ตัว/ครั้ง)' },

  { id: 'B10', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'medium',
    question: 'เดือนใดที่มีจำนวนบันทึกการจับปลาสูงสุดในฐานข้อมูล',
    goldAnswer: '[ตรวจสอบจาก stats/monthly chunk — ระบุเดือน พ.ศ. และจำนวน records ที่สูงสุด]' },

  // ─── hard: B11–B15 (multi-chunk / trend / comparison) ─────────────────

  { id: 'B11', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard',
    question: 'เปรียบเทียบจำนวนบันทึกการจับปลาในแต่ละปี ว่ามีแนวโน้มเพิ่มขึ้นหรือลดลง และปีใดมีมากที่สุด',
    goldAnswer: '[ตรวจสอบจาก stats/yearly chunk — ระบุจำนวน records รายปี แล้ว reasoning แนวโน้ม]' },

  { id: 'B12', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard',
    question: 'เครื่องมือประมงชนิดใดที่พบบ่อยที่สุดในบันทึก และมีสัดส่วนเท่าไหร่เมื่อเทียบกับเครื่องมือทั้งหมด',
    goldAnswer: '[ตรวจสอบจาก stats/by-gear chunk — ระบุชื่อเครื่องมืออันดับ 1 + จำนวน records + % สัดส่วน]' },

  { id: 'B13', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard',
    question: 'สถานที่จับปลาที่มีจำนวนบันทึกมากที่สุด 3 อันดับแรกคือที่ใด และมีจำนวนครั้งเท่าไหร่',
    goldAnswer: '[ตรวจสอบจาก stats/by-location chunk — ระบุชื่อสถานที่ 3 อันดับแรกพร้อมจำนวน records]' },

  { id: 'B14', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard',
    question: 'ปลา 5 อันดับแรกที่จับได้มากที่สุดโดยนับจำนวนตัว กับ 5 อันดับแรกโดยนับน้ำหนักรวม มีความแตกต่างกันอย่างไร และสิ่งนี้บอกอะไรเกี่ยวกับขนาดของปลาแต่ละชนิด',
    goldAnswer: '[ตรวจสอบและเปรียบเทียบ stats/top-by-count กับ stats/top-by-weight — ถ้ารายชื่อต่างกัน แสดงว่าปลาบางชนิดจับได้ทีละตัวน้อยแต่หนัก หรือจับได้ทีละมากแต่ตัวเล็ก]' },

  { id: 'B15', category: 'B', categoryLabel: 'สถิติการจับปลา', difficulty: 'hard',
    question: 'วิเคราะห์รูปแบบฤดูกาลของการจับปลา ว่าฤดูใด (ฝน/แล้ง) มีการจับปลามากกว่า และปลาชนิดใดที่จับได้เป็นหลักในแต่ละฤดู',
    goldAnswer: '[ตรวจสอบจาก stats/monthly chunk เปรียบเทียบเดือนฝน (พ.ค.–ต.ค.) กับเดือนแล้ง (พ.ย.–เม.ย.) + อ้าง fishingRecords หรือ stats เพื่อระบุชนิดปลาประจำฤดู]' },

  // ═══════════════════════════════════════════════════════════════════════
  // หมวด C: สภาพแวดล้อม (C01–C15)
  // Source: waterQuality (98 paragraph chunks) + waterLevels (31 monthly aggregate chunks)
  // waterLevels: 929 records → 31 chunks (1 overall + 30 monthly)
  // waterQuality fields: pH, DO, temperature, TSS, EC, arsenic
  // Key thresholds: Warning ≥ 14.0 ม., Critical ≥ 16.0 ม.
  // ═══════════════════════════════════════════════════════════════════════

  // ─── easy: C01–C05 (single threshold / single fact) ───────────────────

  { id: 'C01', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',
    question: 'ระดับตลิ่งวิกฤตของแม่น้ำโขงที่เชียงคานอยู่ที่กี่เมตร',
    goldAnswer: '16.0 เมตร (ตามที่อ้างอิงใน threshold ของระบบและข้อมูล MRC สถานี CKH)' },

  { id: 'C02', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',
    question: 'ระดับน้ำเตือนภัย (Warning level) ของแม่น้ำโขงที่เชียงคานอยู่ที่กี่เมตร',
    goldAnswer: '14.0 เมตร — ระดับที่ระบบจะแสดง Warning alert (ต่ำกว่า Critical 16.0 ม.)' },

  { id: 'C03', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',
    question: 'ระดับน้ำโขงที่เชียงคานสูงสุดที่บันทึกในระบบอยู่ที่กี่เมตร และเกิดขึ้นเมื่อใด',
    goldAnswer: '16.34 เมตร ในเดือนกันยายน 2567 (เกินระดับวิกฤต 16.0 ม.) — จาก waterLevels overall chunk' },

  { id: 'C04', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',
    question: 'ระดับน้ำโขงที่เชียงคานต่ำสุดที่บันทึกในระบบอยู่ที่กี่เมตร และเกิดขึ้นเมื่อใด',
    goldAnswer: '2.85 เมตร ในเดือนพฤษภาคม 2567 — จาก waterLevels overall chunk' },

  { id: 'C05', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'easy',
    question: 'ระบบตรวจวัดคุณภาพน้ำในโครงการวัดพารามิเตอร์อะไรบ้าง',
    goldAnswer: 'วัด 6 พารามิเตอร์ ได้แก่ pH (ความเป็นกรด-ด่าง), DO (ออกซิเจนละลาย), อุณหภูมิ (temperature), TSS (ตะกอนแขวนลอยรวม), EC (การนำไฟฟ้า) และสารหนู (arsenic) — จาก waterQuality chunks' },

  // ─── medium: C06–C10 (time pattern / threshold analysis) ───────────────

  { id: 'C06', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium',
    question: 'เดือนใดที่ระดับน้ำโขงที่เชียงคานสูงสุดในช่วงที่บันทึกไว้ในระบบ',
    goldAnswer: 'กันยายน 2567 — ระดับน้ำสูงสุด 16.34 เมตร ซึ่งเกินระดับวิกฤต (16.0 ม.) — จาก waterLevels monthly chunk เดือน ก.ย. 2567' },

  { id: 'C07', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium',
    question: 'เดือนใดที่ระดับน้ำโขงที่เชียงคานต่ำสุดในช่วงที่บันทึกไว้ในระบบ',
    goldAnswer: 'พฤษภาคม 2567 — ระดับน้ำต่ำสุด 2.85 เมตร สะท้อนช่วงปลายฤดูแล้ง — จาก waterLevels monthly chunk เดือน พ.ค. 2567' },

  { id: 'C08', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium',
    question: 'ระดับน้ำที่บันทึกในระบบเคยเกินระดับวิกฤต (≥ 16.0 เมตร) ในเดือนใดบ้าง',
    goldAnswer: 'กันยายน 2567 (16.34 เมตร) เป็นกรณีที่บันทึกเกินระดับวิกฤต — [ตรวจสอบ waterLevels monthly chunks ทั้งหมดว่ามีเดือนอื่นที่เกิน 16.0 ม. อีกหรือไม่]' },

  { id: 'C09', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium',
    question: 'ค่า pH ที่วัดได้จากแม่น้ำโขงที่เชียงคานตามข้อมูลในระบบอยู่ในช่วงใด และเหมาะสมกับการอยู่อาศัยของปลาหรือไม่',
    goldAnswer: '[ตรวจสอบจาก waterQuality chunks — ระบุค่า pH min, max, mean ที่บันทึกไว้ แล้ว reason เทียบกับเกณฑ์ที่เหมาะสมสำหรับปลาน้ำจืด (6.5–8.5)]' },

  { id: 'C10', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'medium',
    question: 'ค่า DO (ออกซิเจนละลาย) ที่วัดได้จากแม่น้ำโขงที่เชียงคานในระบบอยู่ในช่วงใด',
    goldAnswer: '[ตรวจสอบจาก waterQuality chunks — ระบุค่า DO min, max, mean (หน่วย mg/L) และระบุว่าอยู่ในเกณฑ์ปลอดภัยสำหรับปลา (> 4 mg/L) หรือไม่]' },

  // ─── hard: C11–C15 (seasonal pattern / multi-source / trend) ──────────

  { id: 'C11', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard',
    question: 'เปรียบเทียบระดับน้ำโขงที่เชียงคานระหว่างฤดูฝน (มิ.ย.–ต.ค.) กับฤดูแล้ง (พ.ย.–พ.ค.) จากข้อมูล waterLevels ในระบบ',
    goldAnswer: '[ตรวจสอบจาก waterLevels monthly chunks — เปรียบเทียบระดับน้ำเฉลี่ยในเดือนฤดูฝน vs ฤดูแล้ง แล้ว reasoning รูปแบบ hydrological ของแม่น้ำโขง] ระดับน้ำสูงสุด 16.34 ม. ในเดือน ก.ย. 2567 (ฤดูฝน) กับต่ำสุด 2.85 ม. ในเดือน พ.ค. 2567 (ปลายฤดูแล้ง) แสดง amplitude ≈ 13.5 ม.' },

  { id: 'C12', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard',
    question: 'วิเคราะห์ว่าในช่วงที่บันทึกข้อมูล ระดับน้ำโขงที่เชียงคานเกินระดับเตือนภัย (≥ 14.0 เมตร) บ่อยเพียงใด และส่งผลต่อการจับปลาอย่างไร',
    goldAnswer: '[ตรวจสอบจาก waterLevels monthly chunks — นับเดือนที่ระดับน้ำ ≥ 14.0 ม. แล้ว reasoning ว่าน้ำท่วมตลิ่งส่งผลอย่างไรต่อการจับปลา เช่น พื้นที่จับปลาเปลี่ยน ปลาบางชนิดขึ้นมาในที่น้ำท่วม]' },

  { id: 'C13', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard',
    question: 'อธิบายความสัมพันธ์ระหว่างคุณภาพน้ำ (pH และ DO) กับฤดูกาลจากข้อมูลที่บันทึกในระบบ',
    goldAnswer: '[ตรวจสอบจาก waterQuality chunks — ดูว่ามีการวัดต่อเนื่องตามเวลาหรือไม่ แล้ว reasoning ว่า ฤดูฝนน้ำขุ่น TSS สูง pH อาจต่ำลง ฤดูแล้งน้ำนิ่ง DO อาจต่ำลงถ้า biomass สูง — อ้างจากค่าที่วัดได้จริงในระบบ]' },

  { id: 'C14', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard',
    question: 'พารามิเตอร์คุณภาพน้ำใดที่บันทึกในระบบมีค่าน่าเป็นห่วงมากที่สุด และมีผลต่อความหลากหลายทางชีวภาพปลาอย่างไร',
    goldAnswer: '[ตรวจสอบจาก waterQuality chunks — ระบุพารามิเตอร์ที่มีค่าเบี่ยงเบนจากเกณฑ์ปกติมากที่สุด เช่น สารหนู (arsenic) ถ้าสูงกว่า 0.01 mg/L จะเป็นอันตราย หรือ TSS สูงจะลด DO] อ้างค่าจริงในระบบ' },

  { id: 'C15', category: 'C', categoryLabel: 'สภาพแวดล้อม', difficulty: 'hard',
    question: 'วิเคราะห์แนวโน้มระดับน้ำโขงในช่วง 30 เดือนที่บันทึกในระบบ ว่ามีความผันผวนเพิ่มขึ้นหรือไม่ เมื่อเทียบกับรูปแบบตามธรรมชาติ',
    goldAnswer: '[ตรวจสอบจาก waterLevels monthly chunks ทั้ง 30 เดือน — วิเคราะห์ amplitude ของการขึ้น-ลงในแต่ละปี ว่าผันผวนสม่ำเสมอตามฤดูกาล หรือมีความผิดปกติ (เช่น น้ำขึ้น-ลงกะทันหันที่อาจเกิดจากการปล่อยน้ำจากเขื่อน)]' },

  // ═══════════════════════════════════════════════════════════════════════
  // หมวด D: ความรู้ท้องถิ่น (D01–D10)
  // Source: fishingWisdom (5 entries, 7 chunks)
  // ⚠️ Source นี้เล็กมาก — คำถาม hard ต้องใช้ reasoning จากหลาย chunk
  // พิจารณาขยาย fishingWisdom collection ก่อนเก็บผลจริง
  // ═══════════════════════════════════════════════════════════════════════

  // ─── easy: D01–D03 (single entry lookup) ──────────────────────────────

  { id: 'D01', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'easy',
    question: 'ชาวประมงแม่น้ำโขงที่เชียงคานนิยมใช้เครื่องมือจับปลาชนิดใด',
    goldAnswer: '[ตรวจสอบจาก fishingWisdom collection — ระบุชื่อเครื่องมือที่กล่าวถึงบ่อยที่สุด เช่น มอง แห เบ็ด ฯลฯ ตามที่บันทึกในระบบ]' },

  { id: 'D02', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'easy',
    question: '"มอง" คืออะไร และแตกต่างจาก "แห" อย่างไร',
    goldAnswer: 'มองคืออวนที่วางแช่ทิ้งไว้ค้างคืน ใช้ดักปลาในแม่น้ำ ส่วนแหคืออวนโยน (cast net) โยนเป็นวงกลมแล้วดึงขึ้น ใช้จับปลาที่กินพื้น — ต่างกันที่วิธีการและเวลาใช้งาน (จาก fishingWisdom)' },

  { id: 'D03', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'easy',
    question: 'ชาวประมงเชียงคานเรียกปลา Hemibagrus spp. ว่าอะไร',
    goldAnswer: 'ปลาแข — เป็นชื่อท้องถิ่นที่ชาวประมงเชียงคานใช้เรียกปลาในสกุล Hemibagrus (วงศ์ Bagridae) ซึ่งในพื้นที่อื่นอาจเรียกว่าปลากด (จาก fishingWisdom)' },

  // ─── medium: D04–D07 (multi-attribute / comparison) ───────────────────

  { id: 'D04', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium',
    question: '"เบ็ดน้ำเต้า" คืออะไร ใช้จับปลาชนิดใดและในลักษณะใด',
    goldAnswer: 'เบ็ดน้ำเต้าคือเบ็ดสายยาวที่วางดักพื้นแม่น้ำ (longline bottom set) ใช้จับปลาขนาดใหญ่ที่อาศัยอยู่ใกล้พื้น เช่น ปลาหนัง ปลาบึก — ต่างจากเบ็ดทั่วไปที่ลากสาย (จาก fishingWisdom)' },

  { id: 'D05', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium',
    question: '"ปลาแข" กับ "ปลากด" หมายถึงปลาชนิดเดียวกันหรือไม่ อธิบาย',
    goldAnswer: 'ใช่ — ปลาแขและปลากดหมายถึงปลาชนิดเดียวกัน (Hemibagrus spp. หรือ Mystus spp. วงศ์ Bagridae) แต่เป็นชื่อที่ใช้ต่างพื้นที่ "ปลาแข" เป็นชื่อท้องถิ่นของชาวประมงเชียงคาน "ปลากด" เป็นชื่อที่ใช้แพร่หลายกว่าในภาคอีสาน (จาก fishingWisdom)' },

  { id: 'D06', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium',
    question: 'ชาวประมงเชียงคานมีความเชื่อและแนวปฏิบัติอย่างไรกับปลาชนิดใดชนิดหนึ่งเป็นพิเศษ',
    goldAnswer: 'ชาวประมงเชียงคานถือว่าปลากระโห้ (Catlocarpio siamensis) เป็นปลาศักดิ์สิทธิ์ จะปล่อยกลับลงแม่น้ำเสมอเมื่อจับได้ ไม่นำมาขายหรือรับประทาน เป็นภูมิปัญญาที่ช่วยอนุรักษ์สายพันธุ์ CR โดยอัตโนมัติ (จาก fishingWisdom)' },

  { id: 'D07', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'medium',
    question: 'ฤดูกาลจับปลาในแม่น้ำโขงที่เชียงคานมีลักษณะอย่างไรตามภูมิปัญญาท้องถิ่น',
    goldAnswer: '[ตรวจสอบจาก fishingWisdom chunks — ระบุว่าชาวประมงรับรู้ฤดูจับปลาอย่างไร เช่น ฤดูน้ำหลาก ฤดูน้ำลด ปลาชนิดใดออกหากินในฤดูใด และเครื่องมือใดที่ใช้ประจำแต่ละฤดู]' },

  // ─── hard: D08–D10 (synthesis / reasoning across chunks) ───────────────

  { id: 'D08', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'hard',
    question: 'อธิบายความสัมพันธ์ระหว่างระดับน้ำโขงกับชนิดและปริมาณปลาที่จับได้ ตามภูมิปัญญาของชาวประมงเชียงคานที่บันทึกในระบบ',
    goldAnswer: '[ตรวจสอบจาก fishingWisdom + waterLevels chunks — reasoning ว่าชาวประมงเข้าใจความสัมพันธ์นี้อย่างไร เช่น น้ำขึ้นปลาหนีเข้ามาในที่น้ำท่วม น้ำลดปลารวมตัวในร่องน้ำ — อ้างจากที่บันทึกในระบบเท่านั้น]' },

  { id: 'D09', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'hard',
    question: 'เปรียบเทียบข้อดีข้อเสียของเครื่องมือประมงแต่ละชนิดที่ใช้ในแม่น้ำโขงที่เชียงคาน ตามที่บันทึกในระบบ',
    goldAnswer: '[ตรวจสอบจาก fishingWisdom chunks — ระบุเครื่องมือทุกชนิดที่บันทึกไว้ (มอง แห เบ็ดน้ำเต้า ฯลฯ) แล้วเปรียบเทียบ: ขนาดปลาที่จับได้ ฤดูกาลที่เหมาะ ความต้องการแรงงาน ผลกระทบต่อสิ่งแวดล้อม]' },

  { id: 'D10', category: 'D', categoryLabel: 'ความรู้ท้องถิ่น', difficulty: 'hard',
    question: 'ภูมิปัญญาท้องถิ่นด้านการประมงในแม่น้ำโขงที่เชียงคานที่บันทึกในระบบสะท้อนให้เห็นถึงความสัมพันธ์ระหว่างชุมชนกับระบบนิเวศอย่างไร',
    goldAnswer: '[ตรวจสอบจาก fishingWisdom chunks ทั้งหมด — synthesis: ชื่อท้องถิ่น ความเชื่อ (ปลากระโห้ศักดิ์สิทธิ์) เครื่องมือตามฤดูกาล ล้วนสะท้อน traditional ecological knowledge (TEK) ที่ชุมชนพัฒนาควบคู่กับระบบนิเวศมาหลายร้อยปี]' },
];

export const CATEGORY_LABELS = {
  A: 'ข้อมูลชนิดปลา',
  B: 'สถิติการจับปลา',
  C: 'สภาพแวดล้อม',
  D: 'ความรู้ท้องถิ่น',
};

export const SCORE_LABELS = {
  0: 'Wrong (ผิด/ไม่พบข้อมูลทั้งที่มี)',
  1: 'Partial (ตอบถูกบางส่วน)',
  2: 'Correct (ตอบถูกครบถ้วน)',
};

// ─── summary: คำถามที่ต้องตรวจสอบก่อน freeze ────────────────────────────
//
//  goldAnswer ที่ยังมี [ตรวจสอบ...] (ต้องยืนยันจาก corpus จริงก่อนเก็บผล):
//
//  Category A: A07, A09, A10, A12, A13, A14, A16, A17, A18, A19, A20
//              → ตรวจสอบจาก fish_species collection
//  Category B: B10, B11, B12, B13, B14, B15
//              → ตรวจสอบจาก stats virtual chunks (by-gear, by-location, yearly, monthly)
//  Category C: C08, C09, C10, C13, C14, C15
//              → ตรวจสอบจาก waterQuality + waterLevels chunks
//  Category D: D01, D07, D08, D09, D10
//              → ตรวจสอบจาก fishingWisdom collection (5 entries / 7 chunks)
//
//  คำถามที่ goldAnswer พร้อมแล้ว (ยังต้องผ่าน IOC ผู้เชี่ยวชาญ):
//  A01-A06, A08, A11, A15 | B01-B09 | C01-C07, C11 | D02-D06

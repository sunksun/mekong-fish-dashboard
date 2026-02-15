// แนะนำการแก้ไขโมบายแอป SelectFishSpeciesScreen.js
// เพื่อรองรับทั้ง image_url และ photos array

// แทนที่ฟังก์ชันเดิม:
// {fish.image_url || fish.imageUrl ? (

// ด้วยฟังก์ชันใหม่ที่รองรับ photos:
const getFishImageUrl = (fish) => {
  // ลำดับความสำคัญ:
  // 1. image_url (ใหม่, สำหรับ mobile compatibility)
  // 2. imageUrl (เก่า, backward compatibility)
  // 3. photos[0] (fallback สำหรับ web-only uploads)
  return fish.image_url ||
         fish.imageUrl ||
         (fish.photos && fish.photos.length > 0 ? fish.photos[0] : null);
};

// จากนั้นเปลี่ยนทุกที่ที่ใช้:
// fish.image_url || fish.imageUrl

// เป็น:
// getFishImageUrl(fish)

// ===============================================
// ตัวอย่างการแก้ไข (บรรทัด 248-261)
// ===============================================

// เดิม:
{fish.image_url || fish.imageUrl ? (
  <Avatar.Image
    {...props}
    size={50}
    source={{ uri: fish.image_url || fish.imageUrl }}
    style={styles.fishAvatar}
  />
) : (
  <Avatar.Icon
    {...props}
    size={50}
    icon="fish"
    style={styles.fishAvatarIcon}
  />
)}

// ใหม่:
{getFishImageUrl(fish) ? (
  <Avatar.Image
    {...props}
    size={50}
    source={{ uri: getFishImageUrl(fish) }}
    style={styles.fishAvatar}
  />
) : (
  <Avatar.Icon
    {...props}
    size={50}
    icon="fish"
    style={styles.fishAvatarIcon}
  />
)}

// ===============================================
// ตัวอย่างการแก้ไข (บรรทัด 243-247)
// ===============================================

// เดิม:
onPress={() => {
  if (fish.image_url || fish.imageUrl) {
    setSelectedImageUrl(fish.image_url || fish.imageUrl);
    setSelectedImageName(fish.thai_name || fish.local_name || fish.common_name_thai || 'ไม่ระบุชื่อ');
    setImageModalVisible(true);
  }
}}
disabled={!fish.image_url && !fish.imageUrl}

// ใหม่:
onPress={() => {
  const imageUrl = getFishImageUrl(fish);
  if (imageUrl) {
    setSelectedImageUrl(imageUrl);
    setSelectedImageName(fish.thai_name || fish.local_name || fish.common_name_thai || 'ไม่ระบุชื่อ');
    setImageModalVisible(true);
  }
}}
disabled={!getFishImageUrl(fish)}

// ===============================================
// ข้อดีของการแก้ไขนี้:
// ===============================================
// ✅ รองรับทั้ง image_url (mobile) และ photos (web)
// ✅ Backward compatible กับข้อมูลเก่า
// ✅ ไม่ต้องรอ migration tool
// ✅ ทำให้โมบายแอปยืดหยุ่นมากขึ้น

// ===============================================
// สำหรับโครงการนี้แนะนำให้ทำทั้ง 2 อย่าง:
// ===============================================
// 1. รัน Migration Tool ทันที (แก้ปัญหาข้อมูลเก่า)
// 2. แก้โมบายแอปด้วย (ป้องกันปัญหาในอนาคต)

# Patch v9.21 · GM WIPE ENGINE (3-TIER FLUSH) · 6 โหมดล้างใหม่ · 🏛️ ผนึก 12 เสา

## ต้นเหตุ "ghost" (ล้างแล้วค่าเก่ากลับมา) — วัดแล้ว
กรณีบัญชีที่กำลังเล่นอยู่ (G ยังถือค่าเก่า):
1. `baMrLive → gcLive` เรียก `saveProgress()` ขณะ `G` ยังเก่า → เขียนทับทะเบียนที่เพิ่งล้าง
2. `saveStore` ของ P4 ประทับ `r20/pureRole` จาก `G` ทุกครั้ง → ค่าเก่าคืนชีพ
3. โหมด `full` ใช้ `blankAccount()` ที่ไม่มีคีย์ `r20` → `G.r20` เก่าค้าง
4. คลาวด์: ก้อน `/wordbank/<u>` (Math.max merge) ค้างค่าเก่า → restore กลับมา

## เครื่องยนต์ 3 ชั้น (wrapper ของ `baMrApply` เท่านั้น ไม่แก้ชั้นล่าง)
1. **Mutate record** — `def.mut` แก้ทะเบียน (โหมดใหม่) แล้วของเดิม (v7.4 + นิวเคลียร์) ทำงานต่อ
2. **Runtime ใน G** — แก้ `G` ก่อน, ปิด `saveProgress` ชั่วคราวระหว่างชั้นล่างทำงาน, จากนั้น `baGwPull` ดึง store→G ทุกคีย์ (ยกเว้น Auth) + รีเซ็ต armed/cooldown + `cdReset()` (โหมด full)
3. **Flush** — `saveProgress` ซิงโครนัส, `PUT /wordbank/<u>` (ถ้า `fbOn()`), `fbPush(u,true)`, `csTouch(true)`

## 6 โหมดใหม่ (อยู่ในเมนู 🔄 ปุ่มเดิม ไม่เพิ่มปุ่มในคอลัมน์ ⚙️)
`vocab` คลัง 0/329 + บุ๊กมาร์ก · `wrongs` ล้าง map คำผิด (หัก wrong ออกจาก seen เพื่อไม่ทำให้คลังพอง) · `p4` r20={} pureRole=null · `skills` ทุกสาย Lv1 + เกจ 0 · `gems` 💎=0 · `core` แกนกลาง+เศษ=ค่าเริ่มต้น

## 🏛️ ผนึก
ปุ่มในคอลัมน์ชื่อของตารางรวม (ไม่เพิ่มคอลัมน์ — `xpDomRows` อ่าน td ตามตำแหน่ง) เปิดโมดัล `#baGwSeal` (z-index 795) "ปลดแล้ว: X/12" + 12 เสา ✅ ผ่าน/⏳ ยังไม่สำเร็จ + ตัวเลข อ่านสดจาก `BA_MN_PILL` (G ถ้าเล่นอยู่, ไม่งั้น store)

## ผลทดสอบ
- `test_gm_wipes.js` (ใหม่) **68/0** — 10 โหมด × (เล่นอยู่/ไม่ได้เล่น) ล้างจริงหลังรีโหลด, Auth รอด, PUT wordbank, โมดัลมองเห็นด้วย `elementFromPoint`
- `verify_arena` 144/0 (CLS การ์ดโจทย์ไม่ขยับ) · `verify_monsters` 80/0 · `test_cloud_sync` · `test_nuclear_reset` 73/0 · `test_gm_admin` 142/0 · `test_live_roster` · `test_menu_icons` ผ่านครบ
- พลิกโดยตั้งใจ: `test_gm_reset` (3 เคส) และ `test_unified_gm` (1 เคส) — เมนู 4→10 โหมด
- ไฟล์แจก **1,993,622 ไบต์** (< 2,000,000 · เหลือ 6,378)

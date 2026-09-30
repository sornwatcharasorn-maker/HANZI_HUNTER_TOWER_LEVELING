### Patch P4 · DUAL-LOCK (PURE RUN + MAX SKILL) & UI INDICATORS

ต่อท้ายไฟล์ต้นฉบับ (`hanzi_hunter_tower_v3_1_intro.src.html`) หลัง `baInstall()` ของ v9.21 · ไม่แก้โค้ดชั้นก่อนหน้า
ห่อทับ 5 ตัว: `nextMonster` · `clearFloor` · `baPlSwitch` · `startGame` · `saveStore` + แก้ตัวนับ/คำอธิบายของเสา `class`

**"P4" = เสาที่ 4 ของหน้าต่างผนึก Monarch Ascension (`BA_MN_PILL` id `class` "เชี่ยวชาญทุกอาชีพ")**
เดิม 2 แต้มต่อสายที่ Lv MAX ครบ 4 ช่อง (เป้า 8) → ตอนนี้ **1 แต้มต่ออาชีพ (เป้า 4)** เมื่อผ่าน 2 ล็อกพร้อมกัน

| ล็อก | เงื่อนไข |
|---|---|
| ⚔️ ชั้น 20 (Pure Run) | เคลียร์ชั้น 20 โดย `g.pureRole === baDsBaseRoleOf(g)` → `g.r20[role] = 1` |
| 📖 สกิล MAX | `baCheckRoleSkillsMax(g, role)` = `baV912ClassMaxed` ของสายนั้น (4 ช่อง Lv MAX) |

Pure Run: `g.pureRole` ตั้งที่ชั้น 1 (ทุกครั้งที่ `nextMonster` เจอ `floor===1`) · สลับสายตอนชั้น >1 → `null` (สลับที่ชั้น 1 = ตั้งใหม่ตามสายใหม่)

role key: `monarch`(assassin) · `warrior`(slayer — คีย์ตามสเปก; ในโค้ดเกมคือ `slayer`/`นักรบเหวลึก`) · `guard`(guardian) · `soulmaster`(priest)
UI: เพิ่มเป็นข้อความต่อท้าย `desc` ของเสา (getter) — `[ชื่อ]: ⚔️ชั้น20: ✅/❌ | 📖สกิลMAX: ✅/⏳` — ไม่มี DOM/CSS ใหม่ CLS = 0

## ข้อควรรู้
- `baDsBaseRoleOf` / `baCheckRoleSkillsMax` **ไม่มีในโค้ดเดิม** จึงนิยามใหม่ (ทั้งสองอยู่ท้ายไฟล์)
- `clearFloor` ดันชั้นก่อนจบ จึงอ่าน `g.floor` **ก่อน** เรียกของเดิม
- เซฟ: `saveStore` stamp `r20`/`pureRole` ลงบัญชีของ `CURRENT_USER`; `startGame` ดึงกลับ (กับดักข้อ 16) — ซิงก์ขึ้นคลาวด์ไปกับบัญชี
- ข้อจำกัด: GM รีเซ็ตบัญชีที่กำลังเล่นค้าง อาจถูก stamp `r20` จาก `G` กลับ (แก้ด้วยการออกเกมก่อนรีเซ็ต)
- **ขนาดโค้ดเกิน 120B ที่สั่ง**: ไฟล์แจก 1,985,016 → 1,987,000 (+1,984 ไบต์) เพราะต้องมีการเซฟ/โหลด/ห่อ 5 จุด · เหลือถึงเพดาน 13,000 ไบต์
- `test_monarch` 60/25 **เท่าฐานเดิมเป๊ะ** (ตกอยู่แล้วก่อนแพตช์: ชุดเทสต์ยังอิงเสา 6 ต้น/เป้า 8)

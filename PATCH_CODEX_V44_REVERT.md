# PATCH · CODEX REVERT TO v4.4 BASELINE (Tier-4 Gold purge)

แก้ที่ต้นฉบับ `hanzi_hunter_tower_v3_1_intro.src.html` (รากrepo) แล้ว build ทับไฟล์แจก
ไม่แตะบัญชี/สกิล/เศรษฐกิจใด ๆ · ไม่เพิ่ม DOM/CSS ใหม่ → CLS = 0

## ที่ถอดออก
| ของเดิม | ผล |
|---|---|
| Patch v9.6 Subconscious Mastery (`baSmNet` `baSmTier` `baSmGateOk` `baSmTier4Count` `baSmAllGold` · `BA_SM_*`) | ลบทั้งบล็อก |
| Wrapper `recordWord` ที่เก็บ `fastStreak` (v9.6) และ `lastMs` + toast "+1 แต้ม" (v9.7) | ลบ |
| การเขียนทับ `BA_MN_PILL[0].get` เป็นตัวนับ Tier 4 | ลบ — ผนึกดวงที่ 1 อ่าน `cxCount(g) / CX_TOTAL` (X / 329 = คำที่ปลดล็อก) |
| ฉายา 👑 `allknowing` + โบนัสถาวร (CD −1 · ดาเมจ +15% · ออร่าทอง `.ba-sm-grand` · พิธีประกาศ) | ลบ (ฉายา `omniclassmaster` ของ v9.12 คนละตัว ไม่แตะ) |
| Tier 4 HUD (v9.7): ป้าย Tier · 3 แถวเงื่อนไข (ชั้น 12+/เหวลึก · netScore ≥ 30 · ไว ≤ 2.5 วิ) ในหน้ารายละเอียดคำ | ลบ (`cxDetailHtml` กลับเป็นของ v4.4) |
| ปุ่มกรอง "✨ ใกล้ทองคำ" / "🕳️ ต้องลงเหวลึก" + `cxList` เวอร์ชันกรองทอง | ลบ เหลือตัวกรองเดิม 6 ตัว |
| `baBattleAudit().subconsciousMastery` / `.tier4Hud` | ลบ |
| ข้อความ `desc` ของผนึกดวงที่ 1 ที่อธิบาย Tier 4 | เขียนใหม่ให้ตรงกับ `cxCount` |
| `fastStreak` ในตัวผสาน wordbank (v9.9) | ลบบรรทัดเดียว (Math.max ของ seen/wrong ยังอยู่) |

## ล้างของค้างในบัญชีเก่า
`baCodexRevert()` (wrapper `migrateAccount` + `startGame`) ลบ `allknowing` ออกจาก `titles`
(รีเซ็ต `equippedTitle` เป็น `awakened` ถ้าสวมอยู่) และลบ `wordStats[*].fastStreak/lastMs`
· idempotent · ไม่แตะ `seen`/`wrong`/ทอง/ไอเทม/เลเวล

## เทสต์
`test_monarch.js` — ฟิกซ์เจอร์ผนึกดวงที่ 1 กลับเป็น `{seen:1, wrong:0}` (ไม่ต้องดัน `G.correct`/`G.wrong` แล้ว)

## หมายเหตุ
- `CODEX_MASTERY_MATH.md`, `PATCH_WEAKNESS_PURIFY.md`, `PATCH_v9_12_SPECIFICATION.md` และหัวข้อ v9.6/v9.7 ใน `CLAUDE.md`
  ยังบรรยายระบบ Tier 4 เดิม — เป็นเอกสารประวัติ ไม่ตรงกับโค้ดหลังแพตช์นี้
- ผลข้างเคียงที่ "ล้าง wrong เป็น 0" (Weakness Purify) ไม่มีผลต่อ Codex อีกต่อไป เพราะไม่มี netScore

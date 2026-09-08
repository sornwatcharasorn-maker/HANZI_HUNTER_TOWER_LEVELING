# MONSTER AUDIT REPORT — Ragnarok-Style Classification (Phase 1 of Patch v9.6 task)

สแกนมอนสเตอร์ทุกตัวในระบบสนามรบ 2D (`ba` namespace) จากซอร์สจริง —
`BA_FOES` (18 ตัวประจำหอคอย) · `BA_SKILLS` (ดีบัฟประจำตัว 18 ตัว + Abyssal Devourer)
· `BA_FOES_ABYSS` (ทัพเงาเหวลึก 25 ตัว) · ค่าคงที่สเกล HP/เกราะของ v6.4/v6.7/v8.2

**ไม่มีฟิลด์ element/size/race อยู่ในโค้ดจริงตอนนี้** — รายงานนี้เป็น "การจำแนกใหม่"
ทั้งหมด อิงจากชื่อ/อาร์ตเวิร์ก/ธีมโซนตามที่ TASK อนุญาตให้ใช้จินตนาการอย่างเหมาะสม
คอลัมน์ Race/Element เป็นตัวที่การ์ดวิญญาณ (Phase 2) จะผูกเอฟเฟกต์ด้วย

---

## ตารางที่ 1 — มอนสเตอร์ประจำหอคอย 18 ตัว + บอส 5 (ชั้น 1-20)

สูตร HP มาตรฐาน: `hunterAtk() × hitsForFloor(f)` (v4.0) แล้วคูณทับด้วยตัวคูณ 3 ชั้น
ที่ซ้อนกันตามลำดับนอก→ใน: **Nightmare Rebalance (v8.2)** → **Elite (v6.4)** →
**Boss (v6.7)** — ดูหมายเหตุท้ายตาราง

| ชั้น | id | ชื่อไทย | English (ป้ายในเกม) | Tier เกม | **Element** | **Size** | **Race** | ดีบัฟประจำตัว |
|---|---|---|---|---|---|---|---|---|
| 1-2 | m11 | ซากปรักหักพังอันเดด | Undead Ruin | normal | Undead | Medium | Undead | Catacomb Collapse: -20% HP |
| 1-2 | m12 | โกเลมหินอันเดด | Undead Stone Golem | normal | Earth | Large | Formless | Heavy Fortress: ดาเมจฮีโร่ -60% ตลอดไฟต์ |
| 3 | m13 | ผู้พิทักษ์อันเดด | Undead Guardian | normal | Undead | Medium | Undead | Brutal Shield Slam: ตัดเวลา 5s + -15% HP |
| 3 | m14 | ผู้เฝ้ายามอันเดด | Undead Sentinel | normal | Undead | Medium | Undead | Executioner Thrust: -35% HP |
| 3 | m15 | ผู้ล่าสะกดรอยอันเดด | Undead Stalker | **elite** | Shadow | Small | Undead | Streak Purge: ล้างคอมโบ |
| **4** | m16 | การ์กอยล์หินยักษ์ | **[BOSS]** Stone Gargoyle | **boss** | Earth | Large | Formless | Petrifying Roar: ล็อกปุ่ม 3s + -25% HP |
| 5-6 | m21 | แมงมุมมอสพิษ | Moss Spider | normal | Earth | Small | Insect | Deadly Neurotoxin: พิษ -8%×5 = 40% |
| 7 | m22 | โกเลมศิลาพฤกษา | Mossy Golem | **elite** | Earth | Large | Plant | Thorn Prison: ปิดปุ่ม 2 |
| **8** | m23 | พฤกษาพิษโบราณ | **[BOSS]** Venomous Treant | **boss** | Earth | Large | Plant | Corrupted Overgrowth: ปิด 2 ปุ่ม + พิษ -10%×4 |
| 9-10 | m31 | คัมภีร์เวทมีชีวิต | Animated Grimoire | normal | Ghost | Small | Formless | Blind Knowledge: ลบวรรณยุกต์+ซ่อนคำแปล |
| 11 | m32 | ผู้พิทักษ์จักรกลเวท | Library Sentry | **elite** | Neutral | Medium | Formless | Mana Burn: ล้างเกจคริต + -30% HP |
| **12** | m33 | ลิชจอมคลังเวท | **[BOSS]** Archivist Lich | **boss** | Shadow | Medium | Undead | Grand Absolute Silence: ปิดพินอินทั้งไฟต์ |
| 13-14 | m41 | พลาสมาแฟนทอม | Plasma Phantom | normal | Wind | Medium | Ghost | Hyper Clock Glitch: เวลาเดินเร็ว ×2.5 |
| 15 | m42 | จักรกลสังหารนีออน | Arcane Automaton | **elite** | Neutral | Medium | Formless | Laser Barrage: -45% HP |
| **16** | m43 | ราชันคิเมร่ากลายพันธุ์ | **[BOSS]** Chimera Lord | **boss** | Fire | Large | Brute | Chaotic Inversion: สลับปุ่มทุก 1.5s |
| 17-18 | m51 | ทหารยามผลึกแก้ว | Crystal Sentry | normal | Holy | Medium | Formless | Mirrored Mirage: ปิดข้อความ 3 ปุ่มเป็น ??? |
| 19 | m52 | อาร์คอนทองคำ | Golden Archon | **elite** | Holy | Large | Angel | Instant Condemnation: ตอบผิดข้อถัดไป = ตาย |
| **20** | m53 | มังกรจักรพรรดิผลึกแก้ว | **[FINAL BOSS]** Crystal Monarch Dragon | **boss** | Holy | Large | Dragon | Monarch Cataclysm: สลับปุ่ม+ปิดพินอิน+ล้างคอมโบ+-50% HP |

**สเกล HP/เกราะที่ทำงานจริง (คูณต่อกันตามลำดับ):**

1. **Nightmare Rebalance ตามโซน** (`BA_WV_HP`/`BA_WV_ARM`, v8.2 · โซน 1→5) —
   HP ×1.00/1.25/1.25/1.50/1.50 · เกราะ 15/25/25/35/35% ของ HP เต็ม
2. **Elite** (ชั้นก่อนประตูบอส 3/7/11/15/19, v6.4) — HP ×1.8 (ทับ Nightmare อีกชั้น)
   + Mini-Barrier 25% ของ Max HP
3. **Boss** (ชั้น 4/8/12/16/20, v6.7) — เนื้อบอส ×2.5 + Heavy Abyssal Barrier
   40/50/60/70/100% ของเนื้อบอส (ไล่ระดับตามบานประตู, v8.2 `BA_BOSS_BAR`)
   เกราะยังอยู่ → คริติคอลถูกลด 50% (`BA_RS_CRIT_CUT`)

**หมายเหตุการจำแนก:**

- ชุด "Undead" ทั้ง 4 ตัวแรก (m11-m14) ได้ทั้ง Race=Undead และ Element=Undead
  (ตามธรรมเนียม RO ที่มอนสเตอร์ผีดิบส่วนใหญ่ถือทั้งสองอย่าง) — m15 แยกออกมาเป็น
  Element Shadow เพราะเป็น "นักล่าสะกดรอย" ธีมลอบเร้นมากกว่าผีดิบตรง ๆ
- Golem ทั้งสองตัว (m12, m22) จัดเป็น Race=Formless ตามธรรมเนียม RO ("Golem"
  ในเกมจริงเป็นเผ่า Formless) — m22 ใช้ Element/ธีม Plant เพราะชื่อ "ศิลาพฤกษา"
- Chimera Lord (m43) จัดเป็น Brute เพราะเป็นสัตว์ผสมพันธุ์ (ไคเมร่า = สิงโต+แพะ+งู)
- โซน 5 (คริสตัล/ทองคำ) ทั้งชุดได้ Element Holy ให้ตรงธีมพระราชวัง/มหาวิหาร —
  m53 (บอสสุดท้าย) เป็น Race Dragon เพียงตัวเดียวในหอคอยปกติ ทำให้การ์ด "ตี Dragon"
  มีเป้าหมายที่ชัดเจนแค่จุดเดียวในหอคอย (ตรงกับ endgame มังกร) แต่ใช้เต็มที่ในเหวลึก
  (ดูตารางที่ 2 — ตระกูล Drake/Wyvern/Dragon Lord/Kamish ×8 ตัวเป็น Dragon ทั้งหมด)

---

## ตารางที่ 2 — ทัพเงาเหวลึก 25 ตัว (Abyssal Shadow Army, `BA_FOES_ABYSS`)

ทุกตัวเป็น **Element: Shadow** (ธีมเงาทั้งกองทัพ — เป็นจุดขายของโซนนี้อยู่แล้ว)
แยกด้วย Race/Size ตามรูปร่างของแต่ละตัว · ลำดับ `n` คือดัชนีที่ Decoupled Abyss
Engine (v8.3) ใช้ไต่ 1→25 อิสระจากชั้นที่ยืน

| n | id | ชื่อไทย | English | Tier | **Size** | **Race** | ดีบัฟประจำตัว |
|---|---|---|---|---|---|---|---|
| 1 | s1 | นักฆ่าเงา | Shadow Assassin | mini | Medium | Demi-Human | Shadow Blind Slash: ควันดำบัง 3s |
| 2 | s2 | ผู้ทำลายเงา | Shadow Breaker | mini | Medium | Demi-Human | Earthquake Tremor: สั่นจอ+สลับปุ่ม |
| 3 | s3 | เบฮีมอธเงา | Shadow Behemoth | mini | **Large** | **Brute** | Soul Drain Roar: ล้างเกจคริต+ตัดเวลา |
| 4 | s4 | จอมเฉือนเงา | Shadow Slasher | mini | Medium | Demi-Human | Dual Claw Cleave: ปิด 2 ปุ่ม |
| 5 | s5 | จอมเวทเงา | Shadow Warlock | mini | Medium | Demi-Human | Silence Sigil: ห้ามกด SCAN |
| 6 | s6 | นักดวลเงา | Shadow Duelist | mini | Medium | Demi-Human | Blade Counter Stance: ช้า=สะท้อน |
| 7 | s7 | ทวนเงา | Shadow Lancer | mini | Medium | Demi-Human | Piercing Bleed: เลือดไหลต่อเนื่อง |
| 8 | s8 | ทัพหน้าเงา | Shadow Vanguard | mini | Medium | Demi-Human | Abyssal Shielding: ฟื้นเกราะตัวเอง |
| 9 | s9 | ทรราชเงา | Shadow Brute | mini | **Large** | **Brute** | Berserk Rampage: โจมตีเร็วขึ้น |
| 10 | s10 | ผู้เฝ้ายามเงา | Shadow Sentinel | mini | Medium | Demi-Human | Iron Fortress: ลดดาเมจฮีโร่ |
| 11 | s11 | ทหารดาบเงา | Shadow Bladeguard | mini | Medium | Demi-Human | Time Warp Slice: เวลาเดินเร็ว |
| 12 | s12 | ผู้ปล้นวิญญาณ | Shadow Reaver | mini | Medium | Demi-Human | Soul Devour: ดูดเลือด |
| 13 | s13 | เพชฌฆาตเงา | Shadow Executioner | mini | Medium | Demi-Human | Guillotine Slam: -%HP (แรงขึ้นเมื่อเลือดต่ำ) |
| 14 | s14 | อัศวินเงา | Shadow Paladin | mini | Medium | Demi-Human | Blackout Flare: จอดับสนิท |
| 15 | s15 | จอมสงครามเงา | Shadow Warmonger | mini | Medium | Demi-Human | Seal of Precision: ห้ามคริต/โบนัสไว |
| 16 | s16 | อสูรกายเงา | Shadow Ogre | mini | **Large** | **Brute** | Ground Stun: ล็อกปุ่มทั้งหมด |
| 17 | s17 | ไททันเงา | Shadow Titan | mini | **Large** | **Brute** | Combo Breaker: ล้างคอมโบ |
| 18 | s18 | เดรกเงา | Shadow Drake | mini | **Large** | **Dragon** | Molten Ruin: เผาทองทิ้ง |
| 19 | s19 | ราชามังกรเงา | Shadow Dragon Lord | mini | **Large** | **Dragon** | Shadow Horde: ดาเมจอสูร +% ถาวร |
| 20 | s20 | ไวเวิร์นเงา | Shadow Wyvern | mini | **Large** | **Dragon** | Gale Inversion: สลับปุ่มไขว้กากบาท |
| 21 | s21 | ลมหายใจคามิช | **[MYTHIC]** Kamish Breath | mythic | **Large** | **Dragon** | Cataclysm Laser: -%HP + ล้างเกราะฮีโร่ |
| 22 | s22 | ลูกไฟคามิช | **[MYTHIC]** Kamish Orb Flare | mythic | **Large** | **Dragon** | Supernova Burst: ปิดปุ่ม+ตัดเวลา |
| 23 | s23 | เสาศิลาคามิช | **[MYTHIC]** Kamish Monolith | mythic | **Large** | **Dragon** | Pillar of Suppression: ห้าม SCAN+ลดดาเมจ |
| 24 | s24 | คามิชทะยานฟ้า | **[MYTHIC]** Kamish Aerial Descent | mythic | **Large** | **Dragon** | Abyssal Meteor: -%HP+สตัน |
| 25 | s25 | คามิชดำดิ่ง | **[MYTHIC]** Kamish Submerge | mythic | **Large** | **Dragon** | Shadow Monarch Rebirth: ฟื้นเลือด+ซ่อมเกราะ |

**สรุปสัดส่วนเผ่าในเหวลึก (สำคัญมากสำหรับดีไซน์การ์ด phase 2):**
Demi-Human 12 ตัว (s1,2,4,5,6,7,8,10,11,12,13,14,15) · Brute 4 ตัว (s3,9,16,17)
· Dragon 8 ตัว (s18-25, รวม Kamish ทั้ง 5) · **ไม่มี Undead/Plant/Insect/Angel/Formless/Fish
เลยในเหวลึก** — การ์ด "ตี Dragon" จึงคุ้มที่สุดสำหรับสาย speedrun เหวลึก เพราะโดนทั้ง
8/25 ตัว รวมทุกตัวมึทิกท้าย (บอสจริง 5 ตัวสุดท้ายที่หนักที่สุด)

**สเกล HP เหวลึก:** Micro-Patch เหวลึกขั้นสุด (v8.1) หั่นเนื้อบอสของทัพเงาเหลือ 50%
ของสูตรบอสหอคอย (เกราะ 35% แทน 70%) แล้ว Decoupled Abyss Engine (v8.3) ยกกลับมา
75% เฉพาะตอนเจอที่ "รอยแยกเหวลึก" ในหอคอยปกติ (Wave 4 ของ v8.2) — ตัวเลขจริง
คือ `เนื้อบอสมาตรฐาน × 1.25` (พองไว้ก่อน) แล้ว v8.1 หั่นครึ่งทับ = 0.75 เท่าตามลำดับ
ในโค้ด ไม่ใช่ค่าคงที่ตัวเดียว — ดู CLAUDE.md หัวข้อ v8.3 ข้อ 2 สำหรับสูตรเต็ม

---

## บทสรุปการออกแบบสำหรับ Phase 2 (การ์ดวิญญาณ)

จากการจำแนกข้างต้น องค์ประกอบที่ครบพอให้สร้างคอมโบการ์ดตามสเปกได้ทันที:

| แกน | ค่าที่พบ | นัยต่อการ์ด |
|---|---|---|
| Race | Undead(4) · Formless(6) · Plant(2) · Insect(1) · Ghost(2) · Brute(5) · Angel(1) · Dragon(9) · **Demi-Human(12, เฉพาะเหวลึก)** | การ์ดตี Demi-Human คุ้มสุดในเหวลึก · ตี Dragon คุ้มสุดสำหรับ endgame ทั้งสองโหมด |
| Element | Undead(4) · Earth(5) · Shadow(27, ท่วมท้นเพราะทัพเงาทั้งกอง) · Ghost(2) · Neutral(2) · Wind(1) · Fire(1) · Holy(3) | การ์ดกัน Shadow (Anti-Dark ตามสเปก) มีค่าที่สุด เพราะครอบทัพเงาทั้ง 25 ตัว |
| Size | Small(3) · Medium(21) · **Large(19)** | การ์ดตี Large คุ้มมากในทั้งบอสหอคอย 5 ตัวและเหวลึกช่วงท้าย |
| ดีบัฟที่พบซ้ำบ่อย | บดบังสายตา (Blind/Smoke/Blackout/Silence — 8 ตัว) · สลับปุ่ม (Chaos/Invert/Shuffle — 5 ตัว) · ตัดเวลา/เร่งเวลา (7 ตัว) | ตรงกับ 3 กลุ่ม Anti-Debuff Card ที่สเปกขอ (Anti-Blind, Anti-Shuffle, +เวลาหน่วง) พอดี ไม่ต้องคิดกลุ่มใหม่ |

รายงานนี้เป็นข้อมูลอ้างอิงสำหรับ `BA_SOUL_MONSTER_META` (ตารางจำแนกที่ต้องฝังลงเกมจริง
ใน Phase 2) — ไม่มีผลต่อไฟล์แจกจนกว่าจะถูกเขียนเป็นโค้ด

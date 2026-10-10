# v9.29 Legacy Test Audit — pass/fail summary

Command: `node build_minify.js --check && node test_combat_v9.js && node test_skill_dispatch.js && node test_polarized_class.js`

| Suite | Before | After |
|---|---|---|
| build --check | dist 1,968,265 B (< 2,000,000 · headroom 31,735) | unchanged — source not modified |
| test_combat_v9 | 76 / 0 | 76 / 0 |
| test_skill_dispatch | 54 / 40 | **127 / 0** |
| test_polarized_class | 124 / 20 | **143 / 0** |

Engine source untouched → zero new CSS, CLS = 0 (card height 340.8px asserted in both suites).

## test_skill_dispatch.js
- WANT matrix rewritten to live v9.29 values (S4 dmg 1200 for attack roles, v9.26 guardian/priest kit, guardian S3 heal 35, priest S3 cut 3, no `smi`).
- New `LORE` table: C1/C2 Thai lore names for all 4 classes, checked against `BA_PL_CLASSES`, all 8 roles, and `kitV929.names`.
- Block 6: ultimate multiplier 12 (attack) / heal 70 (priest Lv5); guardian S2 text 30%/15%.
- Block 7: "no dead atoms in any slot / no 'ยังไม่ทำงาน' text" (all slots wired since v9.26).
- New block 7.1: real `#gSkills` clicks — S1/S3 instant cast (damage + MP drain + CD with no answer submitted) for assassin/slayer, guardian S3 heal, priest S3 cut; guardian S2 click casts nothing; S2 passive on correct answer; priest Overheal Smite at full HP; S4 ×12 at every tier/level.

## test_polarized_class.js
- Matrix costs: v9.12 flat `[0,50,120,250,500]` × 4 slots, maxout 3680, first buy 50.
- Class switch: v9.x gat fee (🪙 SW_GOLD + 💎 SW_DIA) + swc confirm modal — test tops up, clicks `#gmModalOk`, asserts exact deduction and the no-funds rejection.
- Bottom menu: 10 buttons (v9.7.1 soul-card button does not exist in source); asserts no stale soul button.
- Persistence: switch via confirm; priest pip cap 4 (v9.27) → persists 3.

# Test results · v9.29 (2026-10-10)

Distributed file: `hanzi_hunter_tower_v3_1_intro.html` = **1,968,265 bytes** (under the cap, with 31,735 bytes to spare)
`node build_minify.js --check` → source 3,984,656 → distributed file 1,968,265, same as the file in the repo (source and distributed file are in sync, HARD mode)

| Suite | Passed | Failed | Notes |
|---|---|---|---|
| `test_combat_v9.js` | 76 | 0 | Clean |
| `test_skill_anim.js` | 170 | 3 | **Already there before v9.29** (see below) |
| `verify_arena.js` | 144 | 0 | Zero CLS on all 6 widths |

## verify_arena — CLS = 0
- Question card 340.8px on every width · 354.8px at 320, same as before the patch
- "Layout doesn't shift by a single pixel while effects play": passes on every width
- Effects clean themselves up after playing (0 pieces left) · no horizontal overflow · no pageerror

## The 3 failures in test_skill_anim (blocks 6 / 6.1)
1. Class cleared to completely empty doesn't meet this layer's condition → still `on:true key:dash`
2. A correct answer still plays the `dash` move (expected none)
3. Classes on the node are `ba-assassin-*` instead of the Guardian's

**Checked against the baseline:** ran the same suite against the distributed file from c9df2dc (before v9.29 was added) and got **170/3 with the exact same 3 case names**.
→ Not a v9.29 regression. These are the stale assertions already recorded in CLAUDE.md (v9.26: `test_skill_anim` 170/3).

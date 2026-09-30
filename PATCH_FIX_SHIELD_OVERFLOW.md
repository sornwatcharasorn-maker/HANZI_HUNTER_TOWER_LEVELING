# PATCH v9.8-9.9 · FIX HERO SHIELD ICON OVERFLOW

**Cause:** `renderItems()` (src line ~3160) did `'🛡️'.repeat(G.shield)` into `#gShield`, so shield 1000 = 1000 emoji glyphs in the HP label.

**Fix:** one icon + text: `🛡️ {shield}/{max(maxShield(), shield)}`; `.g-shield` got `white-space:nowrap`. Same single text node, no new DOM, layout unchanged (CLS=0).

**Verify:** shield=1000 → `"🛡️ 1000/1000"`. `test_cloud_sync` 104/0 · `verify_arena` 144/0.
**Size:** dist 1,987,047 B (12,953 B under cap). Source edited only; dist rebuilt with `node build_minify.js`.

## v9.9 · Shield unit fix (audit follow-up)
Shield = "charges" (1 charge absorbs one hit fully, cap `maxShield()`=3). Skill atom `barr` (Guardian, v8.8) wrote `maxHp × %` into it (≈1000 charges = 1000 free wrong answers).
Now `barr` grants `ceil(%/50)` charges (1–2), clamped to `maxShield()`; HUD shows `🛡️ n/3`.
Note: `test_skill_dispatch`/`test_polarized_class`/`test_skill_anim` matrix cases fail because the tests' expected `BA_DS_FX` values differ from the uploaded source; this diff does not touch that matrix (5 lines changed, all shield-related).

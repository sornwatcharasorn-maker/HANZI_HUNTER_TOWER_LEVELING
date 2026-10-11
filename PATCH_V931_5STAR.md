# Patch v9.31 · 5-STAR KIT UPGRADE (Priest · Slayer · Assassin)

Hooked inside `baInstallV929` as pure wrappers. Zero new CSS, zero DOM nodes (CLS = 0).
Dist size 1,975,153 bytes (24,847 under the 2,000,000 cap).

## Priest
- S2 Overheal: 50% of overheal accumulates; every 25% of maxHp adds one `G.shield` layer (capped by `maxShield()`).
- S3 Cleanse: also applies 1-turn Boss Silence (`baFighting()` false for one turn).
- S4 Ult: 1-turn Invulnerability (`baHurtHero` / `wrongDamage` return 0) alongside full heal and shield.

## Slayer
- S1 Instant Slash: flat 1500 Shield Shred.
- S2 Passive: +15% Life Steal on crit and basic hits while ATK stacks (streak) are active, healed via `cdHeal`.
- S3 Armor Strip: +30% of the Boss Stagger meter (fires stagger if full).
- S4 Ult: +50% execution bonus damage when Boss HP < 25%.

## Assassin
- S1 Time-Slow: 100% Evasion charge vs the next boss attack.
- S2 Passive: +1 Combo Shield layer (max 3) on a fast-answer critical.
- S3 Shield Shred: Bleed, true damage per correct answer for 3 turns.
- S4 Ult: 100% true damage bypassing the boss shield straight to red HP.

## Notes
- True damage never kills (leaves 1 HP; `BA_BAR.base` lowered with `monsterHp`) per trap 19.
- No `Math.random`; state kept locally (`ba.kit5Reset`, audit `baBattleAudit().kit5star`).

## Tests
- `test_kit5star.js` 12/0 (new) · `test_combat_v9` 76/0 · `test_v929_verify` 37/0 · `test_v929b_shield_cd` 11/0
- `verify_arena` 144/0 · `verify_monsters` 80/0
- `test_skill_dispatch` 7 failures and `test_skill_anim` 3 failures are pre-existing (identical on HEAD).

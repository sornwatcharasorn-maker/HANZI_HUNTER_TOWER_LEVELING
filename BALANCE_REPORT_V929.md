# V9.29c — Skill Audit & Fair-Play Balance Report

Scope: 32 skill slots (4 classes × C1/C2 × S1–S4). Only the spec values were applied; **no other numeric tuning was done.** Everything lives in `baInstallV929` (wrappers only, zero new CSS classes, CLS = 0).

## 1. Audit result (spec → implementation)
| Class | Spec | Status |
|---|---|---|
| Priest S1 | Anti-Heal −75% | `mwd` 75 (was 60) |
| Priest S2 | Overheal Smite ×10 at full HP + MP/HP gain | present; neon pulse + banner now fire even when MP/HP gain is 0 |
| Priest S3 | Cleanse + strip 3 choices | present |
| Priest S4 | 50% shield + 4T Pierce Crit | `jdg` 4 (was 3); casts grant 2 of 4 shield layers |
| Guardian S1 | CD 1, HP-scaling damage | present |
| Guardian S2 | −45% damage, armor decay | `wdn` 45 on both Guardian/Guard; also applied on the `baHurtHero` path (min 1 dmg) |
| Guardian S3 | 35% heal, −65%, 1T boss suppress, chip true dmg | present |
| Guardian S4 | 100% shield + true dmg | grants `maxShield()` = 4 layers |
| Assassin S1–S4 | Time-Slow / 100% crit + stagger / −45% shred / true dmg | crit 100% only inside `win` window and only if the inner value is > 0 (hard zero lock respected); crit answers count double toward stagger |
| Slayer S1–S4 | Instant slash / ATK stack / armor strip / pierce | present; shred 45% (assassin) vs 25% (slayer) shown in banner |
| S2 neon pulse (`0 0 18px #00ff66`), floating banners | fixed for passive S2 |

## 2. Fair-play warnings (reported, NOT tuned)
1. **Priest Overheal Smite is uncapped true damage** (≈10×ATK per correct answer at full HP). A floor-20 boss (~49×ATK HP) dies in ~5 answers. Suggest a cap such as the Guardian S3 chip (~6% of monster max HP).
2. **Barrier gate (v9.18): zero damage when unarmed.** With low MP and no armed skill a fight can stall — soft-lock risk, mitigated only by MP regen per correct answer.
3. **Boss HP ×2.5 with 0.6%/s regen vs ~2% basic hit.** Basic hits barely out-damage regen on bosses; skills are mandatory.
4. **Ult multipliers 800–1000%** compound with crit/shred; one-shot potential on non-boss floors, bounded on bosses by the v6.7 damage gate.
5. **Guardian S1 at CD 1 / 18 MP** can chain every other turn with HP-scaling damage.
6. **Unlimited potions (V927)** neutralize incoming-damage pressure for tank builds.
7. **Slayer `atkc` stacks per streak, uncapped.**
8. **Assassin 100% crit window + double stagger** makes boss stagger nearly guaranteed in 2 fast answers.
9. **`maxShield` = 4 is global**: v4.0 streak shields can now reach 4 layers for all classes.

No unwinnable state was found when MP > 0 and the player can answer correctly; no one-shot of full-HP bosses via capped paths was found, except warning 1 (needs 5 consecutive full-HP correct answers).

## 3. Verification
`node build_minify.js --check` → 1,970,836 bytes (< 2,000,000, 29,164 headroom). `test_v929c_audit` 18/0, `test_combat_v9`, `test_skill_dispatch` 127/0, `test_high_tier_boss` 85/0; `test_boss_resilience` 74/2 — the same 2 failures exist on the previous dist (verified by swapping it in).
Test edits (intentional): forced `slayer` in `goFloor` of two suites (default class is assassin); flipped 7 skill-dispatch expectations to spec values; STUN IMMUNE banner now captured via `baBannerText` hook.

# Balance Adjustment v9.30 — Slayer / Assassin / Guardian

Config object (single tuning point) inside `baInstallV929` → exposed as `ba.balance`.
Live tuning from the Console: `ba.balance.ult.slayer = [950, 1050]; ba.applyBalance();`

| Skill | Before | After (Lv1 → Lv5) |
|---|---|---|
| Slayer S4 Ult (blade/slayer) | 1200% fixed | **900% → 1000%** |
| Assassin S4 Ult (assassin/monarch) | 1200% fixed (true dmg) | **800% → 900%** |
| Guardian S3 true dmg | ATK × 0.5 | **ATK × 0.4 + MaxHP × 0.05**, capped at **6% of the monster's HP bar** |

- Floating banners now read the real % from the matrix (`fx(g,3).dmg`), not a hardcoded "1200%".
- Measured in-game (F4 boss, Lv1, ATK 1060, boss bar 27,030): Slayer Ult hits ≈ **35% of the bar**
  before the v6.7 per-answer damage gate. That means at least 3 casts, plus regen/Phase 2 must be overcome = no one-shot.
- Guardian S3: at Lv1 it chips ≈ 420+60 per cast, capped at 6% of the bar → ≥ 17 casts to empty a boss on chip alone.
- Zero new CSS / DOM. Audit: `baBattleAudit().kitV929.bal`.

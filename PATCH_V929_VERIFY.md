# Patch v9.29 — In-Game Combat Verification & Quick Fixes

All changes are inside the existing `baInstallV929` IIFE in
`src/…` / root `hanzi_hunter_tower_v3_1_intro.src.html`. No lower layer was edited.
**Zero new CSS classes · zero new DOM nodes · CLS = 0 · no `Math.random`.**

Dist (HARD mode): **1,968,265 bytes** — 31,735 bytes under the 2,000,000 cap.

## Quick fixes (bugs found in v9.29 review)

| # | Bug | Fix |
|---|---|---|
| 1 | Shield overlay invisible at full HP (bar drawn past 100%) | `width = min(100, sh)%`, `left = max(0, min(hpPct, 100 - w))%` |
| 2 | Neon pulse could stack: a re-pulse captured the green glow as the "original" shadow and never restored it | per-element `WeakMap {o, t}` keeps the first original shadow, clears the pending timer, restores after 600 ms |
| 3 | Instant S1/S3 hit was blocked by the boss barrier / damage gate and could leave `BA_LIVE` dirty | `hit()` marks the barrier broken + `BA_LIVE = true` only for the call, restores both in `finally` |
| 4 | Armor shred on an already-empty barrier returned a negative value | `shred()` returns 0 when nothing is left |
| 5 | Killing the monster with an instant cast left the question timer running while a turn was queued | `lockDead()` locks the turn and clears the question timer |
| 6 | `N.inst` counter used as the "did something" flag → skill bar not re-synced after the first cast | local `acted` flag per cast |
| 7 | Casts after the battle ended (practice mode / monster swapped / no monster) still fired effects | early return unless the same monster is live |
| 8 | Typos / missing numbers in banners (`ชะลอเวล`, Guardian S1 / Priest S1 banners without damage) | text fixed, banners show `-damage` |
| 9 | S2 passive pulse never counted / smite vs passive not distinguished on correct answers | `afterRight()` returns `smite`/`passive`, counts `N.passive` |

## Verification helper — `window.verifyV929Combat()`

Async, safe to call from the console during a battle. It:

1. **Phase A — UI:** renders the shield overlay at full and half HP and checks it sits on the HP bar; triggers the S2 pulse and checks `box-shadow: 0 0 18px #00ff66`, then checks it decays after 720 ms.
2. **Phase B — sandbox casts:** stubs saving/network/progression, then casts **S1 and S3 for Priest, Guardian, Assassin, Slayer** (8 casts) and checks each executes in < 50 ms with an immediate effect, plus floating banner text.
3. **Layout:** snapshots the battle card before / during / after — must be identical (CLS = 0).
4. **Restore:** everything (stubs, `BA_V91_ARM/CD`, localStorage, monster state) is restored in `finally`, then re-renders.
5. Prints a `console.table` and stores the result at `baBattleAudit().kitV929.verify`.

## Tests

| Suite | Result | Note |
|---|---|---|
| `node build_minify.js --check` | OK · 1,968,265 B | |
| `test_v929_verify.js` (new) | **37/0** | all 8 casts, shield, pulse, banners, CLS, no sandbox leak, kill-lock |
| `test_combat_v9.js` | **76/0** | |
| `verify_arena.js` (CLS) | **144/0** | battle card 340.8 px / 354.8 px @320 unchanged |
| `test_skill_dispatch.js` | 54/40 | **identical on the previous dist** — pre-existing stale assertions (see v9.26 notes) |
| `test_skill_anim.js` | 170/3 | **identical on the previous dist** |

No regressions.

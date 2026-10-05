# Audit — Patch v9.25 · True Bidirectional GM Command Writeback

## Root cause (audit)
GM tools (v4.3 `withStudent`/`gcItem`/`gcHeal`, v7.4 `baMrApply`, v7.2 `baCloudDrop`) only mutated the
GM machine's `localStorage`. The student's 5-s heartbeat (v5.4) PUTs its whole `/students/<u>` row,
and v5.7 re-hydrates the GM roster from that row → every GM edit was silently reverted.
Nothing ever travelled GM → student except `pwh` (v5.8) and `resetSignal` (nuclear full reset).

## Fix — cloud command inbox `/students/<u>/gmq`
| GM action | Command | Student applies |
|---|---|---|
| Items (🎒) | `{t:'edit', items:{k:delta}}` | delta added, clamped to `BAG_SLOTS` |
| 💎 Diamonds | `{t:'edit', gem:delta}` | written straight to `ab.shards` (bypasses daily caps, clamped to `AB_SHARD_CAP`) |
| Gold / Lv / HP·MP·shield | `{t:'edit', gold, lv, hp, mp, sh}` | delta / absolute, `-1` = refill to full |
| Suspend / Unsuspend | `{t:'edit', frz}` + `frozen` PATCH on row | lock → `exitGame`; unsuspend reaches a frozen student at login (`handleSubmit` pre-apply) |
| Reset Lv/Floor/Gold/… | `{t:'reset', mode}` | runs `baMrApply(u, mode)` locally (tombstone; stale row can't overwrite) |
| Reset All | existing nuclear `resetSignal` path (unchanged) |
| Delete | `{t:'del', at}` tombstone + wordbank DELETE | wipes local account (only if created before `at`), never re-PUTs the row |

- Student heartbeat GETs `/gmq` before every PUT (same seal-before-PUT pattern as v5.8 `pwh`), applies in
  `at` order, acks via `gmAck` (last 20 ids in payload). GM re-PATCHes unacked commands every 4 s; TTL 14 days.
- Acks persisted in `yao_gmq_ack` (student) · pending in `yao_gmq_pend` (GM). No new account fields.
- Password never leaves the device; only existing `pwh` is preserved in the rebuilt PUT body.
- Wrapper-only, no `Math.random`, zero new CSS/DOM, GM table td positions untouched, CLS = 0.

## Size
Source 3,933,347 B → distribution **1,942,143 B** (57,857 B under the 2,000,000 cap).

## Verification
New `test_gm_writeback.js` (two browser contexts sharing one fake RTDB): **43/0** — remote student
profile updated for gold/gem/items/level/heal, reset tombstone, freeze→unfreeze, delete tombstone.

Regression: gm_admin 142/0 · cloud_sync 104/0 · fb_realtime 104/0 · gm_reset 109/0 · gm_wipes 68/0 ·
cloud_auth 48/0 · auto_sync 67/0 · live_roster 62/0 · dual_sync 89/0 (solo) · class_lww 26/0 ·
unified_gm 70/0 · refresh_btn 60/0 · gm_export 62/0 · classroom_lb 69/0 · verify_arena 144/0.
`test_nuclear_reset` 72/1 — same case fails on the pre-patch HEAD build (pre-existing, loops=3).

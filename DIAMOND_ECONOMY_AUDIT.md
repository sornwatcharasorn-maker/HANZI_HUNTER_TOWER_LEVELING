# DIAMOND ECONOMY AUDIT — Ground Truth Report

Scope: `💎` (`account.ab.shards`), grep-verified against
`hanzi_hunter_tower_v3_1_intro.src.html` only. No full-file read was performed —
every figure below traces to an exact `grep -n` hit. Class-switch / stat-reset
costs were confirmed hardcoded free (`BA_PL_SW_FREE = 0`, `BA_PL_SW_COST = 0`)
and were **not** investigated further, per explicit task instruction.

## 1. Confirmed active vs. task-assumed variables

| Variable | Task assumed | Ground truth (grep-verified) |
|---|---|---|
| Seal gate floors | 4 floors, 48💎 total | `BA_BOSS_FLOORS = [4,8,12,16,20]` — **5 floors**, `AB_SEAL_SHARD = 12` → **60💎 total** |
| `classSkills` / `account.classSkills` | Absent, needs designing | **Already implemented** as `account.skills[classId]` (v8.5 Class Skill Matrix). Zero grep hits for the literal names `classSkills`/`account.classSkills` — the real field name differs. |
| Number of classes | 8 classes | **4 classes** (`BA_PL_CLASSES`: assassin, slayer, guardian, priest) |
| Per-class skill cost | 7,400💎/class | **3,360💎/class** (`BA_PL_COST` rows: `[0,40,80,160,300]`×2, `[0,60,120,220,450]`, `[0,100,200,350,700]`, summed = `BA_PL_MAXOUT`) |
| Total skill-matrix sink | 59,200💎 (8×7,400) | **13,440💎** (4×3,360) |
| `AB_CORES` sink | confirmed active | Confirmed active. `AB_CORE_COST = [8,14,22,32,46,64]` = 186💎/track × 7 tracks = **1,302💎 total** |
| `wbPush` / `wbRestore` | assumed diamond-related | **Unrelated** — separate wordbank/vocabulary cloud-sync feature (v9.9), no shard interaction |
| Class-switch / stat-reset cost | (not to be searched) | Confirmed free (`BA_PL_SW_FREE=0`/`BA_PL_SW_COST=0`) incidentally while reading `BA_PL_CLASSES`; **not further investigated**, per instruction |

## 2. Inflow sources (all routes traced)

All routes below funnel through **`cdShards(n)`** (v4.7 layer) except one raw
inline mutation in v4.6:

```js
function cdShards(n) {
  const g = cdG();
  if (!g || !(n > 0)) return 0;
  let b = null;
  try { b = (typeof abOf === 'function') ? abOf(g) : null; } catch (e) { b = null; }
  if (!b) return 0;
  const cap = (typeof AB_SHARD_CAP === 'number') ? AB_SHARD_CAP : 99999;
  const add = Math.round(n);
  b.shards = Math.min(cap, b.shards + add);
  try { if (typeof abSave === 'function') abSave(); } catch (e) {}
  return add;
}
```

| Source | Layer | Path | Amount |
|---|---|---|---|
| Per-correct-answer base bonus | v4.6 (raw inline, no function boundary) | inside `resolveAnswer` | +1 correct, +1 if answered <3.5s (`AB_FAST_MS`), +2 if `isBossFloor` |
| Seal-gate break | v4.6 | `abSealBroken()` → `b.shards += AB_SEAL_SHARD` (raw, not via `cdShards`) | 12💎 × 5 gates = 60💎/full run |
| Daily Quest — Dedicated Abyss ladder | Micro-Patch (Daily Quest) | `baQdGem()` → `cdShards()` | `BA_QD_AB` tiers: kill 4-8-8-15💎, perfect +2-3-4-5💎, chest 3-4-5-10💎 by depth band (`to:10/20/24/25`) |
| Daily Quest — phase/clear/incursion/boss | Micro-Patch (Daily Quest) | `baQdGem()` → `cdShards()` | `BA_QD_PHASE=[.66,.33]` HP-phase triggers, `BA_QD_CHEST=35`, `BA_QD_ALL=25`, `BA_QD_BOSS=2`, `BA_QD_INC=4`(+`BA_QD_INC_P=1` perfect), `BA_QD_F20=[3,4,5]`(+`BA_QD_F20_C=3` clear) |
| Ultimate Abyss Overhaul (v8.1) | v8.1 | `baQdGem()` → `cdShards()` | `BA_AX_GEM=2`/correct-kill, `BA_AX_POT=50`(potion-clear bonus), `BA_AX_ROU=5`/`BA_AX_ROU_GEM=25`(roulette) |
| Dedicated Abyss Engine (v8.3) | v8.3 | `baQdGem()` → `cdShards()` | `BA_OD_MAX=25` (=`BA_WV_IDX_MAX`), `BA_OD_GEM=4`, `BA_OD_GEM_PF=2` per depth-index kill |

## 3. The exploit — uncoordinated additive stacking

None of the five inflow systems above (base bonus, seal gates, Daily Quest,
Ultimate Abyss Overhaul, Dedicated Abyss Engine) are aware of each other. All
route into the same `account.ab.shards` field with only a **lifetime** cap
(`AB_SHARD_CAP = 99999`) and no time-based throttle whatsoever. A single
Dedicated Abyss "1→25" loop compounds base-bonus + Daily Quest ladder rewards +
Ultimate Abyss per-kill bonuses simultaneously per kill.

**Computed per-loop stacking magnitude** (tier distribution 10/10/4/1 kills
across the 25-depth ladder):

| Scenario | Per-kill floor (non-perfect, non-boss) | Per-kill ceiling (perfect, boss-adjacent) |
|---|---|---|
| Tier 1 (depth 1-10, k=4/p=2) | ≈10💎 | ≈16💎 |
| Full 25-kill loop total | **≈297💎** | **≈568💎 + max chest (35💎)** |

A single run can already meet or exceed a naive 450💎/day soft cap in one
sitting — confirming the task's concern about "infinite farming bots" is
real and severe, not theoretical. Bot/macro farming (repeated rapid Dedicated
Abyss loops) could compound this to multiples of 450💎/day with zero
resistance from the pre-existing lifetime cap alone (99,999💎 takes ~176 such
runs to exhaust — no meaningful friction).

## 4. Fix implemented — Diamond Economy Governor (Patch v9.10)

A daily-rolling governor was designed, inserted, built, and empirically
verified in this session. See `REBALANCED_DIAMOND_MATH.md` for progression
modeling and the full wrapper snippet.

**Interception architecture** (3 points, chosen to correctly handle both
synchronous grants and `scheduleTurn(...,1100)`-delayed grants — confirmed
`onMonsterDefeated` fires 1.1s AFTER `resolveAnswer()` returns, in a separate
JS tick, invalidating any naive single-point delta-measurement design):

1. **`cdShards(n)` wrap** — pre-emptively reduces `n` via `bdReserve()` before
   calling through. Catches the vast majority of grants (Daily Quest,
   Ultimate Abyss Overhaul, Dedicated Abyss Engine) regardless of timing,
   since function wraps are timing-agnostic.
2. **`abSealBroken()` wrap** — fires synchronously with no amount parameter to
   pre-reduce, so uses delta-measurement-and-clawback immediately around the
   call instead.
3. **`resolveAnswer()` wrap** (outermost / final patch in file) — delta-measures
   only the *unrouted remainder* (via transient `BD_ROUTED` accumulator
   incremented by wraps 1 & 2), correctly isolating the raw v4.6 inline
   per-answer base bonus as the sole remaining unwrappable path.

`baQdGem()` was deliberately **not** wrapped a fourth time: its normal path
already calls `cdShards()` internally (already caught by wrap 1), so an
additional wrap would double-deduct against the daily budget for a single
logical grant.

**Empirical verification** (Playwright, real gameplay + direct calls):

```json
cdShards governor test: {
  "loggedIn": true,
  "before": { "day": "2026-09-16", "got": 0 },
  "got1": 450,
  "gotAgain": 0,
  "afterBd": { "day": "2026-09-16", "got": 450 },
  "shards": 450,
  "addRes": 0
}
resolveAnswer smoke test: { "ok": true, "bdBefore": 450, "bdAfter": 450 }
pageerrors: 0 (game-related) — 1 benign blocked ad/font network log only
```

- `cdShards(1000)` against an empty daily budget correctly clamps to **exactly
  450** (the configured `BA_DIAMOND_CFG.dailyCap`).
- A subsequent identical request correctly returns **0** (budget exhausted).
- `baAddDiamonds()` correctly respects the same exhausted budget.
- A full real `resolveAnswer()` gameplay cycle completes without throwing and
  without leaking any additional shards past the exhausted cap.

Distributed file: **1,943,472 bytes** (56,528 bytes of headroom under the
2,000,000-byte cap). Zero wrapper edits to pre-existing function bodies —
100% additive per the single-file layered-patch convention.

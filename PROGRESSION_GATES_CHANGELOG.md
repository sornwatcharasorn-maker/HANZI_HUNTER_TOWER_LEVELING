# Progression Gates & Gold Trial UI — Changelog

**Namespace:** `gat` (verified zero collisions via `grep -c` before adoption)
**File touched:** `src` / root `hanzi_hunter_tower_v3_1_intro.src.html` only — no prior layer edited in place, everything wraps existing bindings.
**Insertion point:** end of file, immediately after the `bd` (v9.10 · DIAMOND ECONOMY GOVERNOR) namespace's `exitGame` wrap, immediately before the terminal `(function baInstall() {...})();`.

## What this adds

Two new spending gates on top of existing v8.5 profile-modal mechanics (`#baPlBoard`):

| Gate | Cost | Free alternative |
|---|---|---|
| 🔀 เปลี่ยนสายอาชีพ (class switch) | 🪙 35,000 + 💎 380 | Clear floor 20 (apex boss) with ≤2 mistakes and combo ≥20, once per day, up to 2×/day |
| 🔄 ล้างค่าพลัง (stat reallocation reset) | 🪙 50,000 + 💎 750 | Defeat Shadow Foe #25 (the final Kamish-tier abyss boss) in ≤75s using zero items, once per day |

Both gates render as `.ba-gold-trial-card` widgets inside `#baPlBody`, with live-updating `.ba-trial-requirement-item` checklists (✅/⏳/⚠️) and a `.ba-gold-trial-badge` when a free trial token is banked. A one-shot `.9s` shimmer animation (`gatShimmer` keyframes, `transform`/`opacity` only, retriggered via reflow-restart — never `animation:infinite`) plays across each card every time the modal repaints.

## Why `BA_PL_SW_COST` wasn't just edited

`BA_PL_SW_FREE` and `BA_PL_SW_COST` are both hardcoded to `0` by a prior deliberate bugfix — the original 100,000💎 class-switch cost permanently locked every player out of ever switching again, because it exceeded `AB_SHARD_CAP` (99,999, the lifetime diamond cap). So today, class switching is **entirely free with zero gate**. This patch doesn't touch that constant (touching it would just reintroduce the trap); instead it builds the whole gate mechanism from scratch in a `baPlSwitch` wrapper, which checks gold/diamonds/trial-token *before* calling through to the original, and rolls back the deduction if the original still rejects the switch for an unrelated reason (e.g. invalid class id).

## Diamond pricing vs. the daily earn cap

v9.10's `BA_DIAMOND_CFG.CAP = 450`/day governs total diamond *inflow*. The two new costs (380💎 and 750💎) were sized against that reference point per the task's "Claude-balanced" instruction:

- **Switch (380💎)** sits just under one day's max diamond income — a highly-engaged player *could* theoretically pay-to-switch same-day, but only by spending nearly their entire daily diamond budget on nothing else. This keeps the paid path expensive-but-not-impossible without the free trial.
- **Reset (750💎)** deliberately exceeds one day's cap — it cannot be paid for out of a single day's earnings alone, pushing genuinely diamond-poor players toward the skill-based free trial (win the abyss speedrun) rather than grinding diamonds for ~2 days. This mirrors the difficulty gap between the two trials themselves (a floor-20 no-death run is much easier than a sub-75s boss-25 speedrun with zero item usage).

## The "0 slot" requirement

The task's Reset trial spec listed four conditions, the last being **"0 slot"**. No soul-card / equip-slot system exists anywhere in the live file (confirmed via zero-match greps for `account.sc`, `baScOf`, equip-related identifiers — CLAUDE.md's narrative describing a "Patch v9.7 · SOUL CARDS ENGINE" does **not** correspond to any code actually present). "0 slot" was interpreted pragmatically as **"zero items consumed during the fight"** — folded into the existing "100% free, no items" condition (`gatReqLE(itemUsed ? 1 : 0, 0, 'ไม่ใช้ไอเทมเลยระหว่างดวล')`), since a hypothetical "0 equipped item slots" reading would be vacuously true for every player at all times (there being no slots to fill) and thus not a meaningful gate condition. This is a deliberate reinterpretation, documented here per the task's own instruction to note it.

## Version-narrative discrepancy (CLAUDE.md vs. reality)

CLAUDE.md describes a "Patch v9.7 · SOUL CARDS ENGINE" and follow-up UI patches as the most recent layers before this task. **These do not exist in the actual file.** Verified via direct grep against the live source: the true last two patch layers are **v9.9 · DEDICATED WORDBANK SYNC** (namespace `wb`) and **v9.10 · DIAMOND ECONOMY GOVERNOR** (namespace `bd`). This patch was built against the real file's actual final state (the `bd` namespace's diamond economy, `baPlBoard`/`baPlSwitch` from v8.5, `baOdWin`/`baShAnnounce`/`BA_OD_MAX` from the abyss-boss layer), not against the document's specific version-narrative for these most-recent layers — while still following every general convention, gotcha, and layering rule the document lays out (wrap-never-edit, snapshot-before-call, `xxEnsure`/`xxSave`/`xxReady`, `CURRENT_USER` as account key, no `animation:infinite`, no raw `Math.random()`, GPU-only CSS, namespace collision check via `grep -c`).

## Persistence

`account.gat = { day, swToken, swEarned, rsToken, rsEarned }` — mirrors the `bd` namespace's persistence pattern exactly (`gatEnsure`/`gatSave`/`GAT_READY` lifecycle, wrapped into `migrateAccount`/`startGame`/`saveProgress`/`exitGame`). Daily counters reset via the shared `qDayKey(new Date())` clock (no second clock introduced). In-fight/in-run tracking (`GAT_SW_MISS`, `GAT_SW_MAXCOMBO`, `GAT_RS_START`, `GAT_RS_ITEM`) is session-local, not persisted — reset on floor-20 entry/exit and fight-start/fight-end respectively.

## Hooks added (all wraps, zero prior-layer edits)

`resolveAnswer`, `clearFloor`, `baShAnnounce`, `useItem`, `baOdWin`, `baPlSwitch`, `baPlRender`, `migrateAccount`, `startGame`, `saveProgress`, `exitGame`, `baBattleAudit` (adds a `.progressionGates` debug block for test/audit access).

## Verification

```
node build_minify.js --check    → distributed 1,957,709 bytes (42,291 bytes headroom under the 2,000,000 cap)
node build_minify.js            → hanzi_hunter_tower_v3_1_intro.html rebuilt for real
node test_cloud_sync.js         → PASS 104 · FAIL 0
node test_monarch.js            → PASS 85 · FAIL 0 (includes CLS=0 verification across 4 screen widths — question-card height unchanged: 340.8px / 354.8px at 320px, matching pre-patch baseline exactly)
```

No regressions in either suite. Question-card height (the repo's primary CLS canary, tracked across every prior patch layer) is byte-identical to pre-patch measurements at all four tested widths.

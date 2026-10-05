#### Patch v9.24 · CLASS STATE LAST-WRITE-WINS (Cross-Device Class/Job Desync Fix)

Lives in the existing `ba` namespace as one IIFE, `baV924Install`, at the very end of the source file (after v9.23, before `</script>`). **It changes no code from earlier layers; everything is wrapped.**

**Symptom:** device A switches class to Guardian. Device B, which has played before, logs in and stays on the old Slayer.

**Real root cause (the spec's names `mergeProfiles`/`fbPushProfile` do not exist):**

1. **The `classId` field travels only through `/wordbank`.** v9.13 added it to `wbPayload`, but v9.13's `wbRestore` only accepts it when `baV913Clean(g)` is true, i.e. the device has never played. A device with progress always rejects it.
2. **The `/students` payload (v5.3/v5.8) carries no `classId`.** `caAdopt`/`lrApply` sync level, gold and floor, but not class, items or 💎.
3. **`wbPush` fires only on `exitGame` or after a merge.** A class switch is never pushed to the cloud right away.

**Fix:**

| Part | What it does |
|---|---|
| `classAt` (timestamp) | Stamped in the `baPlSave` wrapper **only when the class in G differs from the store**. This covers every switch path: gat/swc defer the switch into a `gmConfirm` callback, so wrapping `baPlSwitch` is not enough. After stamping, it calls `wbPush` immediately. |
| `wbPayload` | Adds `classAt`, `gender`, `class_change_count`, `freeAlloc` and `ult`. |
| Outermost `wbRestore` | Reads the cloud doc first → runs the inner chain under `BA_V924_HOLD`. Every inner pushback is held, because it would send the stale class. Then it applies LWW: `doc.classAt > local classAt`, falling back to `doc.at > lastActive` when neither side has a classAt. |
| Discrete LWW | When the remote copy is newer, it overwrites gold, items, floor, level/exp, `ab.shards` and freeAlloc. Cumulative stats (wordStats/codex/union) keep the merge done by the earlier layers. |
| Rebind | `baPlEnsure` → `recalcStats` → `saveProgress`/`baPlSave` → `renderStats/Items/Floor/Skills` → `baSyncCurrentClassSkills(true)` + `baDsHook('class')`. Skills, stats and sprite change immediately with no refresh. `BA_V924_ADOPT` prevents the adopted class from being restamped as a local switch. |
| Local newer wins | If the device's `classAt` is newer than the cloud's, it keeps its class and pushes it back to the cloud. |

**Things the gap watchers must know:** `saveStore` is wrapped to stamp `classAt` into the store for the account currently playing. `startGame` snapshots `lastActive`/`classAt` from the store *before* the inner layers run, because the earlier `saveProgress` would overwrite them.

**Zero new CSS · zero DOM · CLS = 0** · no new account fields except `classAt` · no `Math.random` calls.

**Audit:** `baBattleAudit().classSync` returns `{ver, classId, classAt, hold, n:{lww,disc,keep,sw,held}}`.

**Tests:** `test_class_lww.js` (26 cases), run with `NODE_PATH=/opt/node22/lib/node_modules node test_class_lww.js`. Switching class in a test must top up gold/💎 for the v9.x gat cost, then click `#gmModalOk` for the swc layer. The switch happens in the callback, not at the time `baPlSwitch` returns.


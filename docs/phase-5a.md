# Phase 5a — Movement II: the Crimson Legion

*2026-11-03 · plan: [02 §8](plan/02-game-design.md#8-the-expedition-run-structure) (line ~199), [03 §5](plan/03-content-bible.md) (line 165), [03 §6 Movement II](plan/03-content-bible.md) (lines 236, 249-257), [03 §7](plan/03-content-bible.md) (Matriarch line 289, Vharun lines 299-304), [03 §9.2](plan/03-content-bible.md) (line 434), [06 Phase 5](plan/06-roadmap.md) (lines 112-125) · follows [Phase 4h](phase-4h.md)*

Phase 5 starts with one complete slice. After the Hollow Cantor, a run can climb the **Crimson Spire**. Movement II has:

- seven map stops;
- the five Crimson Legion enemies;
- one new elite affix, **Vampiric**;
- the **Gorehound Matriarch** as mini-boss;
- **Vharun, the Crimson Warden** as boss, with three phases: Twin Cleave, Blood Pact, Impale, Bloodmoon, Crimson Tide and Execution.

The longer run is called an **Expedition**. It opens at Rank 2. The **Prelude** (Movement I alone) is still the first run, is still selectable, and plays exactly as today.

The design follows three principles:

1. **Teach one verb at a time.** Every Legion enemy teaches a verb the Weaver already owns: Chime a stack, Reel to free, Scatter a pact, Focus to flank. The map introduces each one alone before mixing them. Every hostile thing shows its answer glyph where the player is already looking.
2. **Few generic primitives.** All Movement II mechanics come from seven data-driven primitives. The only addition to the vocabulary is the answer tag `mend`. There is no new telegraph shape and no new run phase.
3. **Movement I is bit-for-bit unchanged.**
   - The five golden scenario hashes stay byte-identical (`tests/sim/golden.json`: patrol 2626acee5ce8d584, crowd 323bd3a88aea3f1b, skilled-first-light 905754ea95eb27ac, skilled-bellwarden 9ff673296b5779d5, novice-cantor ef492fba9d6c91ec).
   - `SIM_VERSION` stays **22** (`src/sim/constants.ts:9`).
   - Prelude maps, Prelude `playRun` summaries and the M1 harness table are snapshotted *before* any behaviour change and must stay equal.
   - Only `contentVersion` changes (`src/content/index.ts:108`).

## Decisions taken (confirm or override; see Open questions)

| Question | Choice | Why |
|---|---|---|
| Scaling model | **Enemy side only.** A per-Movement `scale {life, damage}` reaches the sim as `SimConfig.movement`. It started at **life x1.29, damage x0.94**, the plan's hero-relative ratios: enemy HP 1.8 / hero damage 1.4, and enemy damage 1.5 / hero HP 1.6, and **ships at life ×1.5, damage ×1.0** after the whole-Expedition sweep (see *Tuning*). Heroes and the Weaver do not scale. | Every hero-to-enemy exchange matches the plan. The Weaver's flat outputs (Mend 90/s, Ward +120; `src/content/weaver.ts:26,44`) keep their Movement I relative strength. Literal hero x1.6 would make every Mend about 37% weaker, which is invisible and feels bad for a healer. The bots' relative thresholds (`src/bots/skilled.ts:137, :232`) keep holding. This is one sim field instead of four, and it is a knob the harness can sweep. |
| Where the scale comes from | The encounter's Movement (content `movements[n].scale`), with an optional `SimConfig.movement` override for sweeps. The resolved key is present **only** when it differs from {1,1}. | Isolated harness fights and the 'without you' re-run (`src/sim/counterfactual.ts:36`) scale correctly. Movement I configs hash identically. It is never folded into `threat`, which is life-only and clamped to 1-3 (`src/sim/world.ts:283`). |
| Who plays Movement II | **Expedition** (Movement I then Movement II) from **Rank 2** (02 §9 line 228). Prep has a Route toggle (Prelude / Expedition) that remembers the last choice and defaults to Expedition once unlocked. The first run is always the Prelude (02 §8.6). `newRun` defaults to 1 Movement. | Every tool, test and calibrated report (pacing, powercap, dissonance, callings, reliquary, astrolabe, bonds, deeds) keeps its Prelude baseline. |
| Map | Movement II's **7 stops** are generated **up front**. They are appended to `map.rows` as global rows 10-16 with their own RNG label `map:m2`. | Node ids, shop and event RNG labels (`src/meta/run.ts:1131, :1298`), `reachable` and `unforgivingMap` at embark (`run.ts:705, 716-733`) all keep working. Movement I rows come out byte-identical. |
| Is the Cantor final? | Only in a Prelude. In an Expedition the Cantor is **non-final**. *Final* means `kind==='boss' && next.length===0`. | That rule already holds for every existing save, because the Cantor's `next` is `[]` (`run.ts:433-448`). |
| Run win | Only via `EncounterResult.wonRun`, which only the final node sets. All 8 inference sites switch to `endsRun()`. | Without this, the Cantor would pay RUN_WIN_XP, the Starlight win bonus, the win Deeds and the Tears, and open Dissonance, in the middle of a run. |
| Enshrine | An Expedition that **reached Movement II** can enshrine, even after a defeat or abandon. A Prelude keeps the 'won' rule. | The plan's rule (03 §9.2) was deferred in docs/phase-4c.md:11. |
| New vocabulary | Add one AnswerTag, **`mend`**, used by Execution. Add no new TelegraphShape and no new RunPhase. | 'Lift them above 40%' is the healer's core verb, so Execution deserves its own glyph. A Ward-only cast bar would teach the wrong lesson. |
| Rewards | No new relics or motifs in this slice. Movement II draws from the existing pools and adds 2 events, 2 badge Deeds, and a Movement reward multiplier (XP, Starlight and Aether x1.25). | Adding to the pools would move Movement I's offer and draft RNG. |
| Out of scope | Brann; Movement III and the Finale; Severing, Silencing, Mimicking and Doom-touched; Tyrant and Mimicry; Calling tiers in Movement II; Pact shared damage; a rotating beam; Legion relics; licensed stems. | Kept for later slices (see Known gaps). |

## Engineering ground rules (the Movement I contract)

1. **Absent, not undefined.** `hashValue` hashes key names and hashes `undefined` (`src/sim/core/hash.ts:52-76`). `hashWorld` covers config, field, encounter, ledger, internal, telegraphs, entities and RNG (`src/sim/hashing.ts:13-40`). So:
   - every new field on hashed state is an optional key that is set only when used and removed with `delete`;
   - Movement II bookkeeping lives in `world.internal.m2?` and `world.field.sanctuary?`, which are created lazily.
2. **`.optional()`, never `.default()`, on schema fields that can reach world state.** Parsed Movement I defs gain no keys.
3. **No new RNG draws on a Movement I path.**
   - New `world.rng.*` draws happen only on Movement II code paths.
   - New Novice-bot `rng.chance` draws happen only when the mechanic is present.
   - Affix, event, encounter and relic pools are filtered by Movement and keep their content order.
4. **Characterisation first.** W0a commits these snapshots before any behaviour change:
   - `generateMap(seed)` for seeds 1-40;
   - `playRun` summaries for 10 Novice and 10 Skilled seeds;
   - the M1 harness table (`tools/harness.ts --seeds 10 --loadout guardian`).

   Every later workstream must keep them byte-equal. `tests/sim/m1Unchanged.test.ts` pins the five golden hashes as literals.
5. **Movement I boss scripts are not touched.** The Bellwarden and Cantor branches stay as they are:
   - `bosses.ts:76-147`;
   - `enemies.ts:296, 305, 326, 561-573, 597, 793-796`.

   New bosses go through optional PHASES fields and the `m2` script functions. Old code is fallback only.

## Run structure

```
Prelude (first run; selectable forever): Prep ─▶ Movement I (10 stops) ─▶ Hollow Cantor ─▶ Summary
Expedition (Rank 2+):                    Prep ─▶ Movement I (10 stops) ─▶ Hollow Cantor (non-final: rewards, 50% heal)
                                              ─▶ Movement II (7 stops) ─▶ Vharun ─▶ Summary
```

### The Movement II map: a teaching ladder

Movement II has global rows 10-16 and ids `r10c0`… Each row's kinds are shuffled, except the rows marked fixed.

| Row in Movement | Nodes | Teaching beat |
|---|---|---|
| 0 (r10), fixed | `crimson_gate` skirmish | **Bleed → Chime at 5+.** Hounds only. The new things on screen are the stack counter and the Chime glyph. |
| 1 (r11) | `blood_rites`, `pike_line` (no event; every path learns one) | A lesson choice: **Pact → Scatter**, or **Pin → Reel**. |
| 2 (r12) | `red_muster` skirmish, `shield_wall` elite, event | **Sentinel → Focus.** Both fights contain a Sentinel and the other row-1 lesson's enemy. **Vampiric → Chime before Mend** on the elite. |
| 3 (r13) | `leech_warren` skirmish, `blood_forge` elite, merchant | **Latch → Reel or Chime.** |
| 4 (r14), fixed | `gorehound_matriarch` | A consolidation test: Chime the bleed; Reel or Ward the Pounce; Focus the pack. |
| 5 (r15) | respite, merchant, forge | A breather before the boss. |
| 6 (r16), fixed | `vharun` (final, `next: []`) | The final exam: every Movement II verb, plus Bloodmoon (heal where it holds) and Execution (top them up). |

Each path has 2-4 fights before the Matriarch. An enemy met for the first time later than planned, for example because an event was chosen at row 2, gets a first-sighting card (see UI).

The Cantor's `next` connects to `r10c0` through the existing edge builder. Each Movement II node carries `movement: 2`.

The Movement II event pool holds the two Movement II events below. Movement I's pool is filtered to Movement 1 events in content order, so it is unchanged.

Calling tiers stay at `CALLING_ROWS [0,3,5,7]` (`run.ts:263`), all in Movement I.

### Threat and rewards

**Threat** restarts in each Movement: `threatFor(row - movementStartRow)` (`src/meta/economy.ts:18-20`). Movement II runs ×1.0 to ×1.188 life on top of `scale.life`. The preview line still reads 'enemies +N% life'.

**The Cantor, when non-final**, pays:
- an epic draft;
- `relics: 3` at 'boss' odds;
- `aether: 50`;
- `heal: 0.5`, which also clears Shaken.

The heal goes through `finishCombat`'s `node.reward.heal` (`run.ts:858-866`). Its node text reads: 'The Hollow Cantor. Beyond it, the Crimson Spire.' `relicThenRewards` and `afterRewards` map a non-final boss to reason 'boss' (`run.ts:952, 961`).

**The Matriarch** pays the Bellwarden's reward (`run.ts:372-379`). Its text names the encounter.

**Vharun** ends the run: 'Vharun, the Crimson Warden. Break the Legion.'

**Movement II reward multiplier.** Movement II fights pay `rewards {xp 1.25, starlight 1.25, aether 1.25}`. They run about 1.3× longer, so reward per minute holds (target: within ±15% of Movement I).

Other economy rules:
- RUN_WIN_XP (`src/meta/profile.ts:351`) and the Starlight `winBonus` (`src/content/loom.ts:7-18`) are paid only when `wonRun` is set.
- Tears come from the final boss only (`src/meta/dissonance.ts:83-90`).
- Reliquary shards stay per kind (`src/meta/reliquary.ts:633-647`). An Expedition pays about 1.8× the shards; this is re-measured with `tools/reliquary.ts --career`.
- Merchant prices are unchanged.

**The Movement transition** is UI only. On the first Movement II map visit, the Map plays a one-time 'Movement II · The Crimson Legion' title card. There is no new `RunPhase`, so the harness phase switch (`tools/harness-core.ts:313-314`) is untouched.

### Run-end semantics

- `isFinalNode(node)` = `kind === 'boss' && next.length === 0`.
- `endsRun(result)` = `result.wonRun ?? (result.kind === 'boss' && result.outcome === 'victory')`. The fallback covers old saves.

`endsRun` replaces the run-win inference at:
- `run.ts:895` (continueFromResult) and `:1607` (summarize);
- `deeds.ts:21-26` (won(), still checking `outcome==='victory'` first so `demo.ts:44` keeps working);
- `dissonance.ts:85`;
- `runStore.ts:208-210`;
- `rankText.ts:100-102`;
- `starlightModel.ts:64,114`;
- `interlude.ts:584`.

`enshrineEligible(run)` = `run.movements >= 2 ? reachedMovement(run, 2) : run.outcome === 'victory'`. It is shared by `run.ts:578-580`, `runStore.ts:184` and `reliquaryModel.ts:1180-1186`.

`through_the_prelude` ('Win a run') keeps test 'win', meaning *win the run you chose*. A Prelude win still earns it, so the Deed ladder pacing and the demo hold.

### Saves and profile

**Run save.** Additive fields with no `RUN_SAVE_VERSION` bump, following the post-v5 pattern (`src/meta/save.ts:386-411`):
- `NodeSchema.movement: Num.default(1)`;
- `ResultSchema.movement: Num.default(1)` and `wonRun: z.boolean().optional()`;
- `RunStateSchema.movements: Num.default(1)`.

An in-flight v5 save loads as a Prelude, and its Cantor stays final.

**Profile v9** (`PROFILE_VERSION` 8 → 9, plus a migrate step):
- `runMode: 'prelude'|'expedition'`;
- `seen: string[]`, the enemy defs ever sighted, seeded with every Movement I enemy so nothing locks for existing players.

**Unlock.** UnlockKind `'expedition'` at Rank 2 in UNLOCKS (`profile.ts:156-242`), plus `Allowance.expedition`. The Reliquary unlock copy changes to 'Reach Movement II to enshrine' (`profile.ts:223`).

## The seven primitives (new sim features)

| # | Primitive | Where | Used by | Movement I safety |
|---|---|---|---|---|
| P1 | **Movement scale.** `ResolvedConfig.movement?: {life, damage}`. It multiplies `spawnEnemy` maxHp (`enemies.ts:62`), director waveHp (`director.ts:132`), `c.damageMult` (`enemies.ts:90`; covers basics, specials and enrage), status `dps`, and Volatile's 260 (`enemies.ts:833-873`). `pctMaxHp` and `pctPerSec` are never scaled. | world.ts, enemies.ts, director.ts | every Movement II fight | key absent |
| P2 | **Status payloads: stacks, DoT and drain.** `StatusPayload {id, duration, stacks?, maxStacks?, dps?, pctPerSec?, drain?}`. `applyStatusPayload()` stacks up to `maxStacks` and refreshes the shared timer. `updateStatuses` (`statuses.ts:6-47`) deals `dps × stacks × 0.5` every 0.5 s through `dealDamage(kind:'tick')` (`health.ts:340`), with `sourceName` such as 'Bleed ×6 (Sanguine Hound)'. A `drain` heals the source enemy by the amount dealt (the Mending Hymn pattern, `enemies.ts:745-760`) and ends when the source dies or is more than 4 m away. `addStatus` keeps refresh-only semantics (`health.ts:198-207`). | health.ts, statuses.ts | bleed, pinned, latched, Rend | keys only on Movement II statuses |
| P3 | **On-hit payloads.** `EnemyDef.basic.onHit?` and `AffixDef.onHit?`. `applyOnHit()` runs after melee (`enemies.ts:248`), after a bolt `strike` (`src/sim/systems/hits.ts:117-129`, via an optional `PendingHit.onHit`) and after the telegraph status path (`telegraphs.ts:389`). It requires `dealt > 0`, so a fully absorbing Ward blocks it for free. | health.ts, enemies.ts, hits.ts, telegraphs.ts | Hound bleed, Vampiric wound | no-op when absent |
| P4 | **Root, and Reel frees.** A `pinned` hero skips formationMove, combatMove and dodge but still attacks and casts (`heroes.ts:86-94, 252-330, 919-960`), and is immovable in physics overlap. `castReel` and *every* variant (Swap, Anchor) remove `pinned` and `latched` with `statusRemoved` reason 'freed', count as `answered()`, and grant `reelDodge` Resonance (`techniques.ts:307-372`). | heroes.ts, physics.ts, techniques.ts | Impaler, Impale, Leech | reads statuses only |
| P5 | **Attack-chosen mark and link status.** `AttackDef.markStatus?: StatusId \| null` (default 'dirge') and `linkStatus?: 'resound'\|'pact'` (default 'resound'). This generalises `enemies.ts:497-503`, `telegraphs.ts:159, 277-291`, `rewind.ts:169` and `statuses.ts:27-28`. A hero with `pact` takes ×1.2 damage in `dealDamage`. `pact` is not an ailment, so Chime can't break it. | enemies.ts, telegraphs.ts, rewind.ts, statuses.ts, health.ts | Blood Pact, Execution ('condemned') | defaults reproduce today |
| P6 | **Guard arc.** `EnemyDef.guard? {arcDeg, frontMult, turnRate, breakTime}`. The enemy keeps its own `guard {fx, fz, brokenUntil}`, which turns at `turnRate` toward its current target. It is independent of physics facing, so `physics.ts:110-127` is untouched. In `dealDamage`, when `source.hero && target.enemy.guard` (`health.ts:419`), the source position is inside the arc and the guard is not broken, the hit is scaled by `frontMult` and shows a grey 'Blocked' floater (a `guardBlocked` event, rate-limited). `DamageOpts.breaksGuard` is set by an Empowered Piercing Shot (`heroes.ts:739-775`) and breaks the guard for `breakTime`, with a 1 s stagger. | health.ts, enemies.ts, heroes.ts | Crimson Sentinel | field absent |
| P7 | **Attack movement, follow-ups and targeting.** Optional `AttackDef` fields:<br>• `move?: 'charge'\|'leap'`: `completeCast` moves the caster to the line's end or the circle's centre through `clampToArena`/`resolveObstacles` (`src/sim/api.ts:104-107`), and `attackFired` gets visual 'charge'/'leap'.<br>• `centre?: 'target'`.<br>• `fullLength?: true`: beams are no longer capped past the target (`enemies.ts:430-446`).<br>• `followUp?: {attack, delay, reverse?}`.<br>• `scripted?: true`: skipped by `trySpecial`.<br>• `executeBelow?: Pct`.<br>• targeting `'lowestHp'`: lowest hp/maxHp, ties broken by slot; also in `canBegin`/`predictedTarget` (`enemies.ts:681-730`).<br>• effect `'script'`: no resolution. | enemies.ts, telegraphs.ts, schema.ts | Impaler, Pounce, Twin Cleave, Tide, Execution, Bloodmoon | fields absent |

**Execution uses the normal damage path.** When `t.executeBelow` is set and the target's hp/maxHp at resolution is below it, `telegraphDamage(t, e)` (`telegraphs.ts:114-117`) returns `max(t.damage, hp+1)`. Consequences:
- A Perfect Ward negates it.
- Any barrier of 2 or more keeps the hero alive, because the hit is only hp+1.
- Fermata starts or holds as for any lethal hit (`health.ts:558-561`).
- Martyr's Vow, Bear, Oathkeeper and Paradox apply as usual.
- The death recap names 'Execution'.
- `updateIncoming` and severity (`telegraphs.ts:213-233`), the HUD's lethal flag and the bots' Ward scorer all see the threat with no extra code.

**Healing multipliers.** `heal()` (`health.ts:269-327`) applies two multipliers next to `heroHealMult` (`:278`):
- Wound: ×0.5 on whoever carries `wound`, the Weaver included.
- Bloodmoon: ×0.5 on a **hero** outside every Sanctuary pool. The Weaver's own healing received is not cut (as shipped, `healReceivedMult` in `health.ts`).

They stack multiplicatively, so a wounded hero outside a pool gets ×0.25; the Codex says so. Revive (`reviveHero`, `health.ts:1051`) and shields are exempt, which makes 'Ward instead of heal' a discoverable second answer.

**Statuses.** Added to `StatusIdSchema` (`schema.ts:32-42`, which also catches up `absolved`/`anchored`) and to the StatusId union (`state.ts:67-78`).

| Status | On | Ailment (Chime cleanses; `immune` blocks) | Effect |
|---|---|---|---|
| `bleed` | heroes, Weaver | yes | 12/s × stacks (max 8) × damage scale; one shared 6 s timer refreshed on each stack |
| `pinned` | heroes | **no** (Reel frees) | rooted; 60/s × damage scale for 4 s |
| `latched` | heroes | yes | drains 4% max HP/s; the Leech heals that much; Reel or Chime frees |
| `wound` | heroes, Weaver | yes | healing received ×0.5 for 4 s |
| `pact` | heroes | no | damage taken ×1.2 while linked; Scatter answers the link |
| `condemned` | heroes | no | Execution's mark (display, recap) |
| `guardBroken` | enemies | — | display only; the state is `guard.brokenUntil` |

- `AILMENTS` (`health.ts:36-42`) gains bleed, latched and wound. The render-side copy (`src/render/entities.ts:202`) gets the same three.
- Chime's 1.5 s `immune` (`content/weaver.ts:57`) also briefly blocks new stacks, as a deliberate reward.
- Purge's Ailment list (`techniques.ts:560-576`) is unchanged.
- The death recap uses `DOT_ANSWERS = {bleed: chime, pinned: reel, latched: reel|chime}` to name the missed answer, keeping 02 §30's '100% of downs name the answer'.

## The Crimson Legion

Code life is the plan's Movement-I-scale HP × 2.2, the same calibration Movement I uses (`src/content/enemies.ts:243-391`). Damage is at plan value. 'Effective' is after the shipped scale (life ×1.5, damage ×1.0), before row Threat. Numbers are as tuned (see *Tuning* for what moved from the first draft). Reference hero HP (unscaled): Kael 1,600, Lyra 820, Vexis 740, Weaver 360.

| Enemy | Role | HP code / eff. | Speed | Basic | Special or property | Answers |
|---|---|---|---|---|---|---|
| **Sanguine Hound** `sanguine_hound` | swarm | 640 / 960 | 5.0 | melee 32 per 1.0 s, range 1.1; **onHit** bleed +1 (max 8, 6 s, 12/s) | — | Chime at 5+ stacks; Ward blocks stacks |
| **Hemomancer** `hemomancer` | caster, preferredRange 10 | 1,320 / 1,980 | 3.0 | bolt 45 per 2.0 s, range 12 | `hemomancer_blood_pact`: link, `pair`, `linkStatus:'pact'`, windup 6, r 6, damage 300 (300), cd 16, init 5 | Scatter (heroes also step apart, `heroes.ts:1017-1033`) |
| **Impaler** `impaler` | brute, preferredRange 8 | 1,980 / 2,970 | 3.2 | melee 90 per 1.8 s, range 1.8 | `impaler_charge`: beam, `farthest`, `fullLength`, `move:'charge'`, windup **1.2**, length 16, width 1.6, range 14, damage 150 (150), status pinned 4 s at 60/s; cd 9, init 4 | Reel (dodge or free), Ward (no damage, no pin), move |
| **Crimson Sentinel** `crimson_sentinel` | brute | 2,600 / 3,900 | 2.2 | melee 120 per 2.0 s, range 1.9 | `guard {arcDeg 120, frontMult 0.1, turnRate 90°/s, breakTime 6}` | Focus (the party flanks); an Empowered Piercing Shot breaks it for 6 s |
| **Leech** `leech` | swarm | 660 / 990 | 4.4 | melee 20 per 1.2 s, range 1.0 | `leech_latch`: cleave `current`, windup 0.9, r 2.0, 70°, range 1.8, damage 30, status latched 8 s (`pctPerSec 0.04, drain`); cd 10, init 3 | the telegraph: Reel or Ward; once latched: Reel or Chime |

Notes on each enemy:

- **Hound.** No telegraph. Bleed shows as violet drop pips with a count on the party frame and over the head. At 5+ the count glows and shows the Chime glyph. Bleed is violet, because it is an ailment, and is never red. Pressure check: 5 hounds on Kael come to about 160/s in bites plus about 96/s of bleed at the cap (they prefer Vexis, as every swarm does). First Light's 6 choristers do about 370/s.
- **Hemomancer.** It reuses the link renderer (`src/render/telegraphs.ts:557-580, 673-730`) with a pact tint and a '+20%' glyph. Hint: 'Chime can't break a Blood Pact. Scatter.'
- **Impaler.** It charges to the line's end, leaving a streak. A pinned hero gets a steel stake sprite and the Reel glyph.
- **Sentinel.**
  - A brass arc decal at its feet shows the *sim* guard direction, not the smoothed render yaw. It flashes when broken.
  - **Flanking:** when `world.focusTarget` is guarded, non-tank heroes inside the arc move to `target + rot(guardDir, ±(arc/2 + 35°)) × preferredRange`, taking the nearer side (`combatMove`, `heroes.ts:279-330`). Kael holds the front, so the guard keeps facing him.
  - While Empowered with a guarded enemy up, Lyra prefers Piercing Shot (`heroes.ts:587-592`).
  - The 90% block, rather than full immunity, cannot soft-lock a fight if flanking fails.
- **Leech.** It does not ride the hero; it holds its target in melee. Reel moves the hero away and clears the latch explicitly. Drain on Lyra is about 33/s.

The palette is steel-bone bodies (`#b9b1aa`) with a brass and ember accent family:
- hound and Matriarch `#c9785a`;
- Hemomancer `#b0577a`;
- Impaler `#c8a46e`;
- Sentinel `#8fa3b8`;
- Leech `#7a8f5a`;
- Vharun `#e0c48a`.

Every Legion enemy has `material: 'iron'`, which drives death debris and kill sounds.

### Affixes

- **Vampiric** (`vampiric`, new, `movement: 2`).
  - `onHit: {id:'wound', duration:4}` on basic and special hits; answers `['chime']`.
  - Text is generated from values: 'Its hits Wound: healing received −50% for 4 s. Chime removes it.'
  - Colour `#a01a8a` (a deep crimson-magenta), ΔE ≥ 20 from ailment violet, lethal, threat, Bear, Mend/heal and Empower in every colour-vision palette (tests/colorVision.test.ts).
  - The party frame's HP bar gets a hatched 'healing halved' edge. Hint: 'Chime before you Mend.'
- **Volatile.** Damage × scale.damage (×1 in Movement I). Its answers stay `['move','reel']`, because the bible's Scatter/Reel would change Movement I telegraphs (see Open questions).
- **Pool filter.** `AffixDef.movement?` defaults to 1. Elite Vanguard (`director.ts:150`) draws only from affixes with `movement ≤ encounter.movement`, in content order. Movement I's pool stays [shielded, volatile, hastened].

## Mini-boss — the Gorehound Matriarch (`gorehound_matriarch`)

The Matriarch is a big quadruped with a mane of spines.

- HP 33,000 (49,500 effective); speed 3.4; radius 1.5; height 2.2.
- Melee 90 per 1.6 s, range 2.6.
- Encounter: arena `kennels` (r 20, open), enrage 300 s, par 85.

| Attack | Shape | Numbers | Tell | Answers |
|---|---|---|---|---|
| **Rend** `gorehound_rend` | cleave `current`, r 3.6, 100° | windup 1.3, damage 300 (300), bleed **+4 stacks** (max 8, 6 s, 12/s); cd 9, init 4 | amber cone; the stack count jumps on Kael | Chime, Ward (blocks the stacks) |
| **Pounce** `gorehound_pounce` | burst `centre:'target'`, r 2.6, `squishiest`, `move:'leap'` | windup **1.0** (the crouch), range 18, damage 560 (560); cd 13, init 8 | crouch squash plus a circle at the target, then a leap arc | Reel, Ward, move |
| **Pack Call** `gorehound_pack_call` | burst self, summon 3 `sanguine_hound` (4 in phase 2), `maxAlive 8` | windup 1.2; cd 22, init 12 | spawn warnings, howl stinger | Focus |

**Phase 2 at 50%, Decree 'Blood Frenzy'.** Text: 'The Matriarch hunts faster. Cleanse the bleeding; Focus the pack.'
- Answers `['chime','focus']` come from the optional `PhaseDef.answers`, replacing the hard-coded `['stack','move']` at `bosses.ts:118` for new bosses only.
- Special cooldowns ×0.8, from `PhaseDef.cooldownMult`.

**Double threat:** a Pounce on Lyra or Vexis while Rend stacks on Kael. The Weaver needs two answers within about 1.5 s.

## Boss — Vharun, the Crimson Warden (`vharun_crimson_warden`)

Vharun is an armoured warden with a twin-blade glaive and a brass crown.

- HP 80,000 (120,000 effective, ×1.188 at the last row).
- Speed 2.6; radius 1.5; height 4.2.
- Melee 110 per 1.6 s, range 2.8.
- Encounter: arena `wardens_throne` (r 22, open), enrage **420 s** (inside the harness's 9 min, `harness-core.ts:37`), par 225.
- Phases at 1.0, **0.66** and **0.33**, the bible's boss pattern (03 §7 lines 294-296). Each phase entry has a 2 s phase shift (`bosses.ts:98-148`).

### Phase 1 (100–66%)

| Attack | Numbers | Answers |
|---|---|---|
| **Twin Cleave** `vharun_twin_cleave` → `vharun_twin_cleave_second` | First blow: cleave `current`, r 4.2, 110°, windup 2.0, damage 850 (850); cd 16, init 5; `followUp {attack: second, delay: 0}`. Second blow: `scripted`, re-aimed at its own start, windup **1.2**, so the impacts land 1.2 s apart. Each blow begins as the previous resolves and owns `c.cast`; the cast bar shows pips 1/2 and 2/2. | Ward one blow, then Ward, Reel or dome (Aegis Wall) the second. Perfect consumes the shield (`telegraphs.ts:411`), so one charge covers one blow. One answer plus full life survives (850 a blow against Kael's 1,600); no answer does not (1,700). |
| **Blood Pact** `vharun_blood_pact` | link `pair`, `linkStatus:'pact'`, windup 6, r 6, damage 360 (360); cd 22, init 14 | Scatter |
| **Impale** `vharun_impale` | beam `farthest`, `fullLength`, `move:'charge'`, windup 1.4, length 18, width 1.8, damage 200 (200), pinned 4 s at 60/s; cd 16, init 9 | Reel, Ward, move |

Twin Cleave is announced as a Decree the first two times: 'Twin Cleave — two blows on one hero. One Ward won't hold both: a second Ward, Kael's dome, a Reel, or a full health bar.'

**As shipped:** Vharun's follow-ups (Twin Cleave's second blow, the Tide's back sweep) always cast, even when their target has moved out of reach: `fireFollowUp` starts the follow-up without the generic picker's range check, so stepping away during the first blow does not cancel the second; the second blow's shape still decides who it hits.

### Phase 2 (66–33%): Bloodmoon

`vharun_bloodmoon` is `scripted`, effect 'script'.

- **Decree:** 'Bloodmoon — healing is cut by 50% outside the Sanctuary pools. Stand in a pool and Rally the party to you.' Answers `['stack','move']`. The cut falls on heroes only; the Weaver's own healing is not cut (a Wound still cuts whoever carries it).
- **Pools:** two Sanctuary pools, r 3.6, spawn at ±0.4R. They drift at 0.9 m/s and bounce inside 0.6R. Drift uses a precomputed direction table (dmath) and plain arithmetic, with directions drawn from `rng.ai`. It runs in `updateBosses`, so Stasis freezes it (`src/sim/api.ts:91-94`).
- **Reform:** every 30 s the pools re-form at new points and the Decree re-announces, so it is seen at least twice.
- Phase 1's attacks continue.
- **Double threat:** an Impaled hero stuck outside the pool. Reel lands them beside the Weaver, so **Reel frees them into your pool**. The hint says so.

### Phase 3 (33–0%): the judgement

Bloodmoon **persists**. Pact and Impale **stop** (`PhaseDef.specials` restricts the generic picker), so the phase has its own identity and stays readable.

| Attack | Numbers | Answers |
|---|---|---|
| **Crimson Tide** `vharun_crimson_tide` → `vharun_crimson_tide_back` (scripted) | Two cones from Vharun, each r 30 and **180°**: his front half first, then his back half (`followUp {delay:0, reverse:true}`). Windup 1.6 each. Damage 380 (380) each. Every 20 s (12 s enraged); first at +4 s. A Decree once per Tide pair (on the front sweep; the back sweep is its follow-up and does not re-announce): 'Crimson Tide — the tide sweeps his front, then turns to his back. Step behind him, then back.' | move, reel |
| **Execution** `vharun_execution` (scripted) | Mark on `lowestHp`, `markStatus:'condemned'`, windup **4** (cast bar), damage 80 (80), `executeBelow 0.4`. Every 22 s (11 s enraged); first at +9 s, so a Tide lands just before it resolves. Decree: 'Execution — the weakest hero is condemned. Heal them above 40% or Ward them.' | **mend**, ward |
| Twin Cleave | continues | as above |

The Tide is the Bellwarden's out-then-in grammar (Toll Out → Toll In), so it is readable at once. Hero escape and `escapeFrom` already handle cones (`heroes.ts:995-1007`, `src/bots/common.ts:215-249`). Enrage is ×2.5 (`enemies.ts:282-284`).

**Script state.**
- Lives in `world.internal.m2 = {followUp: {owner, attack, at, reverse?} | null, nextTideAt, nextExecutionAt}` and `world.field.sanctuary = {pools: {x,z,r,vx,vz}[], healMult: 0.5, reformAt}`.
- Both are created lazily for these bosses.
- Stasis advances their timers (`src/sim/systems/stasis.ts:49-54`).
- `endEncounter` deletes both (`director.ts:241-258`).
- Foresight's `scriptedNext` knows `m2.followUp`, `nextTideAt` and `nextExecutionAt`.
- `bossPhaseTable(defId)` is exported from `bosses.ts` and replaces the HUD's `BOSS_PHASES` (`src/ui/hudBridge.ts:45`).

## Encounters and arenas

Every encounter below has `movement: 2`. Waves and pars are as tuned (see *Tuning*); par is the Skilled average on the arrival kit × 1.15, to the nearest 5 s.

| id | Kind | Arena | Par | Waves | Hints |
|---|---|---|---|---|---|
| `crimson_gate` | skirmish (row 0) | spire_gate | 40 | hound×5 · hound×6 · hound×7 · hound×8 | bleed |
| `blood_rites` | skirmish (lesson) | blood_forge | 45 | hemomancer + hound×4 · hemomancer + hound×5 · hemomancer×2 + hound×4 | pact |
| `pike_line` | skirmish (lesson) | spire_gate | 45 | impaler + hound×3 · impaler + hound×4 · impaler×2 + hound×2 | pin |
| `red_muster` | skirmish | barracks | 65 | sentinel + hound×4 · sentinel + hemomancer + hound×3 · sentinel + impaler + hound×3 | focus |
| `leech_warren` | skirmish | blood_forge | 50 | leech×3 + hound×3 · leech×2 + sentinel + hound×2 · leech×3 + hound×3 · leech×3 + hemomancer + hound×2 | latch |
| `shield_wall` | elite | barracks | 90 | sentinel★vampiric + hound×4 · impaler★hastened + hemomancer + hound×5 · sentinel + leech×2 + hound×4 · hemomancer + hound×5 | focus, empower, wound |
| `blood_forge` | elite | blood_forge | 75 | hemomancer★vampiric + hound×6 · impaler×2 + leech×3 + hound · hound×4★volatile + hemomancer + impaler★vampiric + hound×3 | wound, scatter |
| `legion_vanguard` | elite (event-only) | barracks | 70 | hound×6 + impaler★vampiric · hemomancer + sentinel + leech×3 + hound×3 · impaler + hemomancer★vampiric + hound×5 | wound |
| `gorehound_matriarch` | miniboss | kennels | 85 | the Matriarch (enrage 300) | bleed, pounce |
| `vharun` | boss | wardens_throne | 225 | Vharun (enrage 420) | decree |

Every new enemy, attack and affix appears, which satisfies the coverage test (`tests/sim/combat.test.ts:321-331`).

**Arenas** (`biome: 'crimson_spire'`):
- `spire_gate`: r 21, 4 pillars;
- `barracks`: r 20, 6 pillars;
- `blood_forge`: r 19, 3 pillars;
- `kennels`: r 20, open;
- `wardens_throne`: r 22, open, for the Tide and the pools.

The floor is obsidian (`#221c1e` to `#1f1a1c`), desaturated and low contrast so lethal and threat telegraphs pop (04 §1, plus the ×0.78 darkening at `src/render/arena.ts:62`). Lines are brass `#a8875a`, the accent is `#c8a46e` and the fog is `#1c0f10`. Crimson appears only in the sky, rim and perimeter.

**Events** (`RunEventDef.movement?: 2`):
- **The Tithe Altar.** Each hero loses 20% life for a rare relic, or pay 40 Aether to pass.
- **The Bloodsworn's Cell.** This foreshadows Brann. Free the prisoner by fighting `legion_vanguard` (reward: 1 of 3 relics), or leave.

**Deeds.** Two badges worth 0 points; the ladder keeps exactly 10 point Deeds (`schema.ts:1359`):
- *Crimson Crowned*: beat Vharun with no hero down.
- *Pack Leader*: beat the Matriarch with an S.

The Deed count goes from 20 to 22 (`tests/meta/deeds.test.ts:154`).

## Content lint (superRefine, `schema.ts:1258-1280`)

New rules:
- A `link` attack uses `pair` (`enemies.ts:470-471` returns false otherwise).
- A `mark` attack, or an attack with `executeBelow`, uses a hero-picking targeting.
- Every status payload (attack, `basic.onHit`, affix `onHit`) names a status whose STATUS look has an answer.
- A status listed under a `chime` answer is in AILMENTS; `pinned` lists `reel`; `pact` lists `scatter`.
- `followUp` and `summon` resolve to real attacks and enemies.
- An encounter's enemies have `movement ≤` the encounter's Movement; summons are exempt.
- Encounters with Movement ≥ 2 have par > 0.
- Every `CONTENT.movements` entry's rows, pools, miniboss and boss resolve.
- A `KNOWN_AFFIXES` test, like KNOWN_MOTIFS.
- The 'damage 0 needs pctMaxHp' rule (`:1263-1265`) also accepts `effect: 'script'`.

## Presentation

### Biome

- `ArenaDef.biome?: 'reliquary'|'crimson_spire'` (`schema.ts:1091-1103`). `render/arena.ts:30` replaces `warm = id !== 'sandbox'` with a per-biome mood table.
- Crimson Spire mood: sky `#3a1416`, torch key `#ffb27a` at 1.6, crimson rim, fog near 38 / far 84.
- Flickering emissive torch cards replace the god rays; no real point lights.
- Rising embers replace the dust (the same shader, upward drift, within the tier caps, `fx/kit.ts:13-17`).
- Perimeter branch (`arena.ts:175-226`): obsidian ramparts, banners, brass braziers instead of candles, and chains. Tall pieces stay on the far side, in one static batch.
- A spire pillar variant of `buildPillar` (`models/library.ts:469`) and an iron-plate floor variant.

### Models

`buildEnemy` gets id branches (`library.ts:187+`, following the pattern at `:192-264`), built from ModelBuilder primitives only:
- hound and Matriarch: low quadrupeds;
- Hemomancer: robed, with a blood orb;
- Impaler: a forward pike;
- Sentinel: a tower shield;
- Leech: a bulb;
- Vharun: a glaive and a brass crown.

Animation is whole-body only:
- a quadruped gait mode (faster bob, pitch rock; `entities.ts:1037-1048`);
- a crouch squash before Pounce, read from `enemy.cast`;
- a charge lean;
- a leap arc that render interpolates from `attackFired` 'leap'; the sim snaps the position.

### VFX

- Bleed: a violet drip with per-stack pips.
- Wound: a cracked-heart sprite.
- Latched: a violet tether beam from the status source.
- Pinned: a steel stake plus an amber ring at the feet.
- Pact: the link tint.
- Sentinel: the arc ring (`fx/rings.ts:158-173`) from the sim guard direction.
- Execution: a mark plus a 40% notch on the over-head bar (`overlay.ts:125-145`).
- Sanctuary pools: teal and gold heal rings with rising motes, after the hymn circles (`render/field.ts:614-655`), with a lab override.
- Bloodmoon: a crimson sky lerp on the light handles (`feedback.ts:2731-2742`). Heal numbers outside the pools render smaller and dimmer.
- Tide: two half-arena cone telegraphs.
- Deaths of `material: 'iron'` enemies: dark shards, ember sparks and smoke, never red mist (`feedback.ts:1980-2049`).

Budget: no growth in FX batches (about 12) and the particle caps hold. Every new semantic colour has ΔE ≥ 20 against lethal `#f43f5e`, threat, Bear `#a3123a` and Mend/Empower under every colour-vision palette (`tests/colorVision.test.ts`).

### Audio

- An optional `AudioDirector.setBiome?(biome)` (`audio/types.ts:216-245`). It is called from `runtime.ts:184-186` (the arena's biome) and from MapScreen (the Movement's biome).
- **Crimson voicing** stays in **D dorian at 88 BPM** (`theory.ts:7-17`; every pitched SFX quantises to it):
  - `PROGRESSION_CRIMSON` (shipped as **Dm–C–Bø7–C**, twice: the plan's B♭ is outside D dorian, and every pitched sound quantises to the key, so the third bar is the mode's own Bø7, which keeps B♭'s D and F; `src/audio/theory.ts`) and `PROGRESSION_CRIMSON_BOSS`;
  - a war-drum pulse (low toms, anvil), a low horn ostinato, a low male choir drone;
  - the pad cutoff set per biome.
- **Vharun stems** keyed on `bossPhase` (`music.ts:569`):
  - phase 2: the pad drops and a heartbeat plays on the ambience bus;
  - phase 3: double-time toms and brass stabs.
- **Matriarch:** a howl stinger on Pack Call.
- **SFX:**
  - `statusApplied` (`sfx.ts:478`): bleed (a wet pluck that rises with stacks, gated 0.15 s), pinned (a thunk plus chain), latched (a suck), wound (a muffled thud), pact (a paired heartbeat);
  - 'freed' (a chain snap);
  - a Chime release scaled by the stacks cleared;
  - guard blocked (a dull clank, gated) and guard broken (a shatter);
  - Pounce, charge and Tide whooshes;
  - Execution: a drum roll through the cast, then a gong or a spared bell;
  - iron kill clanks by `material`;
  - `mend` windStyle → swell (`sfx.ts:4126-4138`).
- An ambience bed on the `ambience` bus: distant drums and brazier crackle.

### UI

- **HUD statuses.**
  - `StatusHud.stacks` is passed through hudBridge (`hudBridge.ts:165-169`).
  - StatusBadge shows ×N, emphasised at 5+ with the Chime glyph.
  - STATUS looks (`labels.ts:53`) for the 7 new ids, each with its answer; `ANSWER.mend` (`labels.ts:127`).
  - Party frames: the hatched heal-halved edge (Wound or Bloodmoon) and a 40% tick while Execution is cast.
- **BossBar.**
  - Phases and real thresholds from `bossPhaseTable`. This also fixes the Cantor's ticks, from 66/33 to its coded 0.7/0.4 (`BossBar.tsx:37-40`); a visible Movement I UI change.
  - A per-boss cast icon (`:107`).
  - Twin Cleave pips.
  - A 'Bloodmoon: healing −50% outside pools' badge.
  - The Execution target's name and 'below 40% dies'.
- **Hints** (`hints.ts`): bleed ≥5 → Chime; pinned → Reel frees; pact → Scatter (Chime can't); latched → Reel or Chime; wound → Chime before Mend; Sentinel blocking → Focus it; Bloodmoon → stand in a pool and Rally ('Reel frees them into your pool'); Execution → lift them above 40% or Ward. The 'silenced → hymn circle' hint is gated on `hymnCircles.length > 0` (`:276-282`).
- **First sighting.** When a def not in `profile.seen` spawns, a non-blocking 'New foe' callout shows its name, one-line lesson and answer glyph, then records it.
- **Codex.** The Enemies tab (`CodexScreen.tsx:430-490`) groups by Movement and shows unseen enemies as locked silhouettes.
- **Map** (`MapScreen.tsx`):
  - only the current Movement's rows, laid out by row within the Movement;
  - header 'Movement II · The Crimson Legion · step k of 7', title 'The Crimson Ascent';
  - Backdrop tone `crimson`;
  - node icons: paw (Matriarch), crown (Vharun);
  - the one-time Movement II card.
- **Copy.**
  - Prelude/Expedition strings derive from the run: Title `:175`, Prep `:236` (plus the Route toggle with '~15 min / ~30 min'), Combat `:78`, Summary `:69-84, :220`, Pause `:44`, Map `:279`, Loom gate (`loomModel.ts:257-262`).
  - Victory: 'Vharun falls, and the Spire's banners burn.' A defeat names the Movement reached.
  - Relic and draft copy derive from the source encounter (`interlude.ts:244-249`, `DraftScreen.tsx:24`).
  - Reliquary: 'Reach Movement II to enshrine'.
- **Labs.**
  - VfxLab: `CRIMSON_SCENARIOS`, exposed as `__VFX__.crimsonScenarios/crimsonScenario/crimsonStats`, plus `gallery2`, plus Movement II encounters in `ENCOUNTERS` (`VfxLab.tsx:335`).
  - UiLab: a 'Movement II' group.
  - AudioLab: a biome switcher and a crimson group.

## Bots and harness

**New helpers** (`common.ts`): `statusStacks`, `isPinned`, `latchedBy`, `dotIncoming` (bleed, pin and latch over remaining time; subtracted in `effectiveFraction`, `:132`), and `zoneFor` (hymn circles or Sanctuary pools).

**Skilled bot.** RNG-free; every branch is gated on its mechanic being present.

| Mechanic | Skilled |
|---|---|
| Bleed, latch, wound | After the clutch-Dirge check, Chime the cluster with the most bleed (5+) within 4 m, or a latched hero, or a wounded hero below 60%. |
| Pinned, latched | A Reel-on-status branch runs ahead of the generic Reel (`:213-240`). |
| Twin Cleave | `bigHitSoon` (`:118-125`) counts a pending `followUp`. Perfect-Ward the first blow; leave the second to Reel or the GUARDING cue. |
| Blood Pact | The existing link → Scatter rule (`:353-360`). |
| Sentinel | Focus priority: interruptible caster > Mute > guarded Sentinel (`:362-371`). Empower Lyra while a guard or discord shield is up. |
| Bloodmoon | `position()` uses `zoneFor` (`:419-425`) and Rallies the party into the pool. |
| Execution | No new branch: `telegraphDamage` forecasts the lethal hit, which drives Mend and Ward. |

**Novice bot**, presence-gated chances: Chime at 5+ bleed 0.6; Ward a pinned hero 0.5; Reel a pinned hero 0.25; Scatter on a link 0.35. As shipped, the Novice's Scatter answers **only Blood Pact links** (`linkStatus: 'pact'`); a Movement I Resound link draws no Scatter, as before, so Movement I draws no new chance.

**Harness** (`tools/harness-core.ts`):
- `playRun(…, {movements})`, default 1.
- Phase guard 120 → 240, and it **throws** when exhausted (`:244, :321`).
- `RunSummary.movementReached` and `minutesByMovement`.
- `THREAT_PER_ROW` by row within the Movement (`:255-262`).
- A declared, fixed **arrival kit** in new `tools/kits.ts`: the Guardian preset, the Bellwarden scenario motifs plus 4 more at level 1-2, 2 relics, full HP. It is used for isolated Movement II cells, so bands do not inherit bot drafting bias. Whole Expeditions remain the real gate.
- `EncounterRun` metrics: pinsFreed, bleedCleanses (stacks at cleanse), pactBlasts, guardBlockedPct, executions, timeInSanctuary.

**Tools.**
- `tools/harness.ts --movement 2 --kit arrival|bare` and `--run --movements 2`; encounter lists are read from content by Movement.
- `loadouts.ts`, `relics.ts` and `astrolabe.ts` get Movement II lists and floors.
- `sim-bench.ts` adds a hound-pack scenario (Matriarch plus Pack Call).
- `pacing.ts` plays the Expedition from Rank 2 and splits minutes by Movement, and Weaver XP a minute by Movement (on the modelled clock and in combat, without the run's win bonus).
- `decrees.ts` (new, tuning) measures the Decree gate: each Vharun Decree's sightings a fight and how often each bot answers it.

**Golden scenarios**, appended (the five M1 hashes are untouched):
- `skilled-crimson-gate` (2,400 ticks);
- `novice-matriarch` (5,400);
- `skilled-vharun` (arrival kit, 10,800).

`skilled-vharun` joins the replay round-trip test (`tests/sim/determinism.test.ts:45-55`).

### Bands (arrival kit, 50 seeds per cell; whole runs 200)

| Content | Idle | Novice | Skilled | Skilled share | Skilled length |
|---|---|---|---|---|---|
| Movement II skirmishes | ≤15% | ≥65% | ≥85% | ≥35% | 35-60 s |
| Movement II elites | 0% | 35-75% | ≥85% | ≥35% | 50-80 s |
| Gorehound Matriarch | 0% | 40-70% | ≥90% | ≥35% | 60-110 s |
| Vharun | 0% | 35-65% | ≥85% | ≥30% | 180-300 s |
| Whole Expedition | 0% | 15-30% won; reach-II 40-50% | ≥70% won; reach-II ≥90% | — | — |
| Movement I and Prelude | identical to the W0a snapshot | | | | |

**Decree gate** (05:238, :262): Idle fails every Vharun Decree. Skilled answers each with at least 80% success. Each is seen at least twice per Skilled Vharun fight; Bloodmoon re-announces on reform.

**Tuning order:**
1. Isolated cells on the arrival kit (authored numbers ±20%).
2. Sweep `scale.life` 1.1-1.6 and `scale.damage` 0.85-1.2 on whole Expeditions, 200 seeds per step, as phase-3b.md:126-144 did for Threat.
3. Par = Skilled average × 1.15.

**Pacing targets:** Movement II about 11-14 modelled minutes (6-8 of them combat). An Expedition 26-32 min. Movement II XP per minute within ±15% of Movement I.

### Tuning (shipped)

**Where it started.** On the first numbers (`--movement 2 --seeds 30`, arrival kit) the skirmishes were far too easy: Idle won `crimson_gate` 100%, `leech_warren` 93% and `blood_rites` 43%, and Skilled finished them in 25–36 s. Novice won the elites 93–100%. The Matriarch fell to the Novice 87% of the time and Vharun to the Skilled in 153 s; Skilled lost `red_muster` and `shield_wall` 3–10% of the time, all early, while the Novice won them.

**What moved.** Authored numbers, then the Movement scale, then par:

| What | Was | Now | Why |
|---|---|---|---|
| Movement II `scale` | life ×1.29, damage ×0.94 | **life ×1.5, damage ×1.0** | the whole-Expedition sweep below; life lengthens every fight, damage moves the Novice |
| Sanguine Hound | 570 HP, bite 30 | 640 HP, bite 32 | the pack is every skirmish's pressure; Idle won hound fights outright |
| Crimson Sentinel | 3,520 HP | 2,600 HP | its fights ran over their length band once the Skilled bot flanks it after the pack (below) |
| Gorehound Matriarch | 30,000 HP; Rend 260; Pounce 480 | 33,000 HP; Rend 300; Pounce 560 | Novice 87% (band 40-70%) |
| Vharun | 70,000 HP; Twin Cleave 1,000 a blow, cd 14; Tide 420 a sweep | 80,000 HP; Twin Cleave 850, cd 16; Tide 380 | Skilled lasted 153 s (band 180-300 s); once longer, the Novice fell to Twin Cleave and the Tide (17% at 70,000 HP and the new scale); 850 keeps 'one answer plus full life survives, no answer doesn't' (2 × 850 > Kael's 1,600) |
| `crimson_gate` | hound ×4 · ×5 · ×6 | hound ×5 · ×6 · ×7 · ×8 | Idle 100%; Skilled 25 s |
| `blood_rites` | hounds 3 · 4 · 3 | hounds 4 · 5 · 4 | Idle 43%; Skilled 29 s |
| `leech_warren` | three waves | a fourth (leech ×3 + hound ×3), a hound more in the first two | Idle 93%; Skilled 30 s |
| `shield_wall` | three waves, a Shielded elite Sentinel last | four: sentinel★vampiric + hound ×4 · impaler★hastened + hemomancer + hound ×5 · sentinel + leech ×2 + hound ×4 · hemomancer + hound ×5 | Novice 93%; pressure the Novice can't sustain through a guarded grind. The review round added a hound to the second wave: after its sim fixes (a cancelled Blood Pact now takes its ×1.2 with it; two Pacts sharing a hero both land), the Novice won 79% (76 / 82 / 80 on three seed sets) |
| `blood_forge` | hound ×4 first; 2 volatile hounds | hound ×6 first; leech ×3 + hound second; 4 volatile hounds + 3 hounds last | Novice 100%. The review round moved a hound from the second wave (two Impalers' pins and three Leeches' latches all want Reel at once) to the last and made a fourth hound Volatile: Skilled sat at its floor (82-92% across seed sets), and a blast the Novice stands in keeps the Novice's rate down |
| `legion_vanguard` (event) | two waves | three (see the table above) | Skilled 38 s, Novice 98% |
| Pars | 90 · 100 · 100 · 115 · 115 · 140 · 145 · 130 · 170 · 280 | 40 · 45 · 45 · 65 · 50 · 90 · 75 · 70 · 85 · 225 | Skilled average (arrival kit, 50 seeds) × 1.15, to the nearest 5 s, in the encounter table's order |

**Deliberate exceptions to the ±20% rule.** Tuning order step 1 keeps authored numbers within ±20%. These changes went past it on purpose: a wave's head count was the one lever that moved Idle and the Novice in a single fight without changing an enemy every other fight shares, and the first numbers were far outside their bands (Idle won `crimson_gate` 100%, the Novice won the elites 93-100%).
- `crimson_gate`: hounds 15 → 26 (+73%); with the hound's +12% life, its enemy life is about +94%.
- `blood_rites`: hounds 10 → 13 (+30%).
- `leech_warren`: a fourth wave; leeches 8 → 11, hounds 4 → 10.
- `shield_wall`: rebuilt into four waves, its Shielded elite Sentinel dropped; hounds 7 → 18 (17 at the tuning pass, 18 after the review round).
- `blood_forge`: hounds 6 → 14 (4 of them Volatile), leeches 2 → 3.
- `legion_vanguard`: a third wave.
- Crimson Sentinel life −26% (3,520 → 2,600).

Pars moved −40% to −56% (90 → 40, 170 → 85), but a par is derived (step 3: the Skilled average × 1.15), not authored. Lower pars also tighten the grade thresholds, and so XP and Starlight; the pacing numbers below include that.

**One bot fix.** The Skilled bot Focused a guarded Sentinel the moment one stood, so the whole party went round a 4,541-HP wall (3,520 × the ×1.29 life of the time; an ordinary Sentinel is 2,600 × 1.5 = 3,900 now, an elite 2.2× that) while the hounds beside it stacked bleed on them: Skilled lost `red_muster` and `shield_wall` more often than the Novice did, every loss inside the first 25 s, to bleed ticks and bites (with no Sentinel Focus it won both 100%). That is plainly broken for this mechanic, so it now Focuses a guarded Sentinel once no more than three enemies stand (`SENTINEL_FOCUS_AT`, `src/bots/skilled.ts`); the pack first, then the wall. Movement I has no guarded enemy, so its bots are unchanged (the M1 baseline and the five hashes hold).

**Seed sets.** The tuning pass measured on the tools' default seeds; the verifier re-measured on other sets, and some cells moved by more than the tables first showed. Every number below is from the review round's content (the sim fixes and the `blood_forge` and `shield_wall` changes above), pooled over the tuner's seed set and the verifier's, each run with `--seed-base` (`tools/harness.ts`, `tools/decrees.ts`, `tools/pacing.ts`). Isolated cells: 1000, 500003 and 900007 (+ i × 7919), 150 seeds a cell. Whole Expeditions: 2000 and 3000017 (+ i × 104729), 400 seeds. Pacing: 9001 and 77003, 16 players each.

**Isolated cells, final** (`npx tsx tools/harness.ts --movement 2 --seeds 50 --verbose --seed-base B`, arrival kit; `legion_vanguard` with `--encounters legion_vanguard --kit arrival`). Pooled over 150 seeds; the range across the three sets in brackets where it is wide or near a band edge:

| Fight | Idle | Novice | Skilled | Skilled share | Skilled length | Band |
|---|---|---|---|---|---|---|
| `crimson_gate` | 3% | 98% | 100% | 43% | 36 s | skirmish |
| `blood_rites` | 1% | 100% | 100% | 48% | 40 s | skirmish |
| `pike_line` | 3% | 97% | 100% | 50% | 41 s | skirmish |
| `red_muster` | 0% | 100% | 100% | 52% | 59 s (57-60) | skirmish |
| `leech_warren` | 2% | 98% | 100% | 49% | 46 s | skirmish |
| `shield_wall` | 0% | 66% (54-76) | 95% | 50% | 76 s | elite |
| `blood_forge` | 0% | 67% | 94% (92-96) | 48% | 66 s | elite |
| `legion_vanguard` (event) | 0% | 55% (42-64) | 96% | 48% | 61 s | elite |
| `gorehound_matriarch` | 0% | 54% (44-62) | 100% | 47% | 74 s | miniboss |
| `vharun` | 0% | 47% | 99% | 47% | 197 s | boss |

Pooled, every cell is inside its band; some sit near an edge on one seed set (`red_muster`'s Skilled length reached the 60 s ceiling on one, `shield_wall`'s Novice 76% on one), so a single 50-seed set can read either side of a band. `blood_forge` Skilled was 82-92% across seed sets before the review round (88.7% pooled) and is 92-96% now. Pars agree with the pooled Skilled average × 1.15 within one 5 s step. The verbs show up as intended (tuner's seeds): Skilled cleanses bleed at 4.3–5.5 stacks on average, frees 1–2 pins a fight where Impalers or Vharun pin, and lands 34–41% of its party's hits on a Sentinel's guard where the Novice's lands 54–63% (Idle's 77–84%); under the Bloodmoon its party stands in a pool 40-41% of the time (the Novice's 12-13%), and Vharun executes 2 of its 159 condemned heroes (the Novice's 37 of 178).

**The Movement scale, on whole Expeditions** (`npx tsx tools/harness.ts --run --movements 2 --seeds N --bots novice,skilled`, the default loadout; won %, Novice / Skilled). Life barely moves the win rates; damage moves the Novice:

| `scale` | 80 seeds (cells before their last pass) | 200 seeds |
|---|---|---|
| life 1.3 · damage 0.9 / 1.0 / 1.1 | 25/84 · 18/83 · 10/71 | |
| life 1.45 · damage 0.9 / 1.0 / 1.1 | 24/83 · 14/81 · 6/73 | |
| life 1.6 · damage 0.9 / 1.0 / 1.1 | 24/89 · 14/81 · 9/71 | |
| life 1.5 · damage 0.9 / 0.95 / 1.0 | | 25/85 · 21/84 · 19/80 |
| **life 1.5 · damage 1.0, shipped (tuning pass)** | | **16/78** |

Damage 0.95 would centre the whole-run Novice better (about 21%), but it lifts the isolated cells' Novice to their edges or past them (Matriarch 74%, the elites 70–74%, Vharun 62%), so the shipped damage is 1.0 and the cells sit inside their bands.

**Whole Expeditions, final** (`--run --movements 2 --seeds 200 --seed-base B`, B = 2000 and 3000017; 400 seeds pooled, each set in brackets):

| | Idle | Novice | Skilled | Band |
|---|---|---|---|---|
| Won | 0% | 15.5% (15 / 16) | 80% (79 / 81) | 0% · 15-30% · ≥70% |
| Reached Movement II | 0% | 38% (39 / 36.5) | 89.5% (89 / 90) | — · 40-50% · ≥90% |
| Combat minutes, Movement I / II | 0.8 / 0 | 5.6 / 2.6 | 6.2 / 6.15 | |
| Lost in Movement II (of 400) | — | 89 (Vharun 24, Blood Forge 21, Matriarch 20, Shield Wall 15, Vanguard 5, four skirmishes 1 each) | 38 (Vharun 11, Blood Forge 11, Shield Wall 9, Matriarch 4, Vanguard 2, Blood Rites 1) | |

Before the review round the same two sets gave the Novice 16% and 19% won (the tuner's and the verifier's numbers); the fixes and the elite changes moved it to 15-16%, on the band's floor.

**Reach-II misses its band, and Movement II can't fix it.** 'Reached Movement II' is decided entirely by Movement I: it is the Prelude's own win rate on these seeds, and Movement I is unchangeable here (the M1 baseline and the five hashes are byte-identical). Across the two seed sets it is 36.5-39% for the Novice (band 40-50%) and 89-90% for the Skilled (band ≥90%): a few points under both bands. Movement II content cannot move it.

**Decree gate** (`npx tsx tools/decrees.ts --seeds 50 --seed-base B`, B = 1000 and 500003; Vharun on the arrival kit, 100 fights a bot). A Twin Cleave or a Tide is answered when no hero goes down to either of its two blows; an Execution when the sim's verdict is `spared`; a Bloodmoon spell (announcement to announcement) when no hero falls in it except to another Decree's blow.

| Decree | Skilled: seen a fight (min) | Skilled answered | Novice answered | Idle |
|---|---|---|---|---|
| Twin Cleave | 2.0 (2) | 91% of 891 | 60% of 1,375 | 13% of 277 pairs (12% / 14%; the verifier measured 16% before the review round); loses every fight |
| Bloodmoon | 4.8-4.9 (4) | 100% of 486 | 95% of 571 | never reaches it |
| Crimson Tide | 3.7-3.9 (3) | 99.5% of 381 | 80% of 406 | never reaches it |
| Execution | 3.2-3.4 (2) | 99.5% of 311 | 78% of 336 | never reaches it |

Every Decree is seen at least twice in every Skilled fight and answered ≥ 91%. Idle loses every Vharun fight in phase 1 (at 91% of his life, 47-50 s), so it never sees Bloodmoon, the Tide or Execution; it survives 12-16% of Twin Cleave pairs only on passive relic shields and regeneration (2 × 850 against Kael's 1,600 leaves a 100-point margin). Read per occurrence, 'Idle fails every Decree' holds for every Decree but those Twin Cleave pairs.

**Pacing** (`npx tsx tools/pacing.ts --players 16 --hours 3 --route expedition [--bot skilled] [--seed-base 77003]`; the two seed sets, 9001 / 77003):

| | Novice | Skilled | Target |
|---|---|---|---|
| An Expedition, modelled | 19.7 / 22.0 min (13.7 + 6.0 / 15.1 + 6.9; most end in Movement I or II) | **28.4 / 27.7 min** (17.1 + 11.3 / 16.8 + 10.9) | 26-32 min |
| Movement II, modelled | 6.0 / 6.9 min | **11.3 / 10.9 min** (6.2 of combat) | 11-14 (6-8 combat) |
| Weaver XP a combat minute, II / I | 30.2 / 31.5, 28.7 / 31.8 (**0.96, 0.90**) | 46.2 / 43.8, 46.1 / 43.7 (**1.05, 1.06**) | within ±15% |
| Weaver XP a modelled minute, II / I | 20.8 / 13.7, 20.1 / 14.2 (1.51, 1.42) | 29.4 / 18.0, 29.7 / 18.1 (1.64, 1.64) | |

Earlier measurements put the Novice Expedition at 18.8 min (the tuner) and 21.0 min (the verifier) and the Novice's combat-minute ratio at 0.87-0.95; across all of them it is 0.87-1.06.

**XP a minute is held per combat minute, not on the modelled clock.** XP a minute leaves out the run's win bonus, which belongs to the run wherever it ends. The reward multiplier stays at ×1.25: it was set so that a Movement II *fight* pays per minute what a Movement I fight does, and per combat minute Movement II / Movement I is 0.87-1.06 across every measurement, inside ±15%. On the modelled clock Movement II pays about 1.4-1.6× what Movement I does, because Movement I carries the run's Prep, Loom and Summary and more of the non-fight stops (events, shops, shrines, forges). Matching that clock would mean paying Movement II fights less than Movement I's, against the design; so the ±15% target is met per combat minute and missed, by design, on the modelled clock. **Sim bench:** the hound pack (the Matriarch, Pack Call) runs at p95 0.053 ms a tick (budget 1.5).

## Tests

- **Characterisation (W0a).**
  - `tests/meta/preludeSnapshot.test.ts`: maps for seeds 1-40 and `playRun` summaries for 10 Novice and 10 Skilled seeds equal committed JSON.
  - `tools/m1-baseline.ts --check`.
  - `tests/sim/m1Unchanged.test.ts`: the five literal hashes.
  - `resolveConfig({seed})` hashes equal to `resolveConfig({seed, movement:{life:1, damage:1}})`.
- **`tests/sim/movement2.test.ts`:**
  - bleed stacks to 8, ticks, Chime clears it and `immune` blocks new stacks; a Ward stops stacks;
  - pinned roots but still attacks; every Reel variant frees and gives credit; a full Ward prevents the pin;
  - Pact +20% and the 6 m blast; Chime doesn't break it;
  - Sentinel takes 10% from the front, 100% from the flank; an Empowered Piercing Shot breaks it; Focus moves non-tanks outside the arc within 4 s;
  - Leech drains and heals; Reel, Chime or 4 m detaches it;
  - Vampiric halves Mend; Wound plus Bloodmoon gives ×0.25;
  - the scale multiplies life and damage;
  - the M1 Elite Vanguard pool is unchanged (exact array).
- **`tests/sim/movement2Review.test.ts`** (the review round's fixes):
  - a pin lands on heroes only: the Weaver in an Impale or an Impaling Charge line takes the hit, never the pin or its ticks;
  - two Blood Pacts sharing a hero both land (resolving together or one after the other), and the shared hero keeps the pact while the second is pending;
  - a cancelled Pact (its caster killed, or `cancelTelegraph` on a phase shift) takes its pact off both heroes at once, except a hero another Pact still binds; Movement I's Resound is left to its clock on a cancel, as before;
  - Oathkeeper hands Kael what a melee bite (bleed) or a bolt (Wound) carries;
  - an Execution down names Mend or Ward, a Blood Pact down names Scatter, through a Fermata hold too; a Movement I telegraph down has no `answers`.
- **`tests/sim/scripts2.test.ts`:**
  - Twin Cleave impacts 1.2 s apart (±1 tick), and one Ward Perfects one blow;
  - Pounce's 1.0 s tell lands on the squishiest, and the Matriarch lands at the centre;
  - Pack Call respects maxAlive; Blood Frenzy answers and cooldowns;
  - Bloodmoon halves heals only outside the pools; drift is deterministic and Stasis-frozen; reform re-announces;
  - the Tide hits front then back;
  - Execution downs a hero at 30% and spares a warded, Fermata-held or ≥40% hero;
  - both enrages;
  - `setBossHp` drives the phases and Decrees.

  `tests/sim/scripts.test.ts:9-70` stays unchanged and green.
- **`tests/meta/expedition.test.ts`:**
  - with movements 1, everything equals the snapshot;
  - with movements 2: 17 rows, unique ids, every node reachable; the Cantor continues to relic → draft → map; only Vharun sets `wonRun`, RUN_WIN_XP and `winBonus`; Movement II threat starts at 1.0;
  - Unforgiving rewrites the Movement II respite;
  - enshrine after a Movement II defeat;
  - a v5 save loads as a Prelude whose Cantor is final;
  - Deeds, Tears and Dissonance use `endsRun`;
  - the profile v8→v9 migration.
- **`tests/content.test.ts`:** a rejection case for each new lint rule.
- **`tests/bots.test.ts`:**
  - Skilled clears `crimson_gate` (share > 0.3);
  - Idle loses the Matriarch and Vharun;
  - Skilled Reels a pin within 2 s, Chimes at 5+, Scatters a Pact, Focuses a Sentinel, and keeps the Execution target at or above 40% in ≥80% of casts;
  - Twin Cleave, over 12 seeds, counting only pairs whose two blows both resolved on the hero they aimed at: Skilled answers ≥80% (measured 19 of 21, 90%; 14 of 15 on another seed set), Idle ≤20% (measured 0 of 12; the Novice 26 of 121);
  - Novice Movement II runs are deterministic.
- **Presentation:**
  - `tests/renderMovement2.test.ts`: drawn counters, FX budget, Movement I mood args unchanged, ΔE;
  - `tests/audioPhase5.test.ts`: crimson stems 94-100% in key; the bleed tick is rate-limited; reliquary output unchanged;
  - `tests/uiPhase5.test.ts`: stacks through the bridge, real phase ticks, map filtering, Prelude strings unchanged, enshrine stage, first sighting.

  Also update `uiPhase3.test.ts:191` and `uiPhase4c.test.ts:797`.
- **e2e:** `testHook.warpTo` takes a predicate; `winRun` warps to the final boss (`testHook.ts:276-294`); add `warpMovement(2)`. The Prelude smoke (`e2e/smoke.spec.ts:783, :903`) passes, and a new Expedition smoke reaches Vharun and the Summary.

## Exit criteria

1. **Movement I unchanged.**
   - The five golden hashes are byte-identical and SIM_VERSION is 22.
   - The Prelude snapshot and the M1 harness baseline are byte-equal.
   - `tools/pacing.ts` and `tools/powercap.ts` on Prelude runs reproduce phase-4h.md.
2. **Movement II bands met,** including the Decree gate. Skilled Vharun lasts 3-5 min.
3. **Pacing.** An Expedition models at 26-32 min, with Movement II XP per minute within ±15% of Movement I.
4. **Readability.**
   - Every new hostile thing shows its answer glyph: telegraph, badge, arc decal or first-sighting card.
   - The death recap names the cause and the missed answer for 100% of downs, including bleed, pin, latch and Execution.
   - ΔE tests pass.
   - A cold read of the first-sighting cards scores ≥ 4/5 (the phase-4h method).
5. **Build health.** Content lint is clean. tsc, vitest and e2e are green. `sim-bench` hound-pack p95 ≤ 1.5 ms/tick. No FX draw-call growth.
6. **Saves.** An in-flight v5 run and a v8 profile load and finish correctly.
7. **Docs.** This file with harness tables, plus `docs/phase-5a/{vfx-audio.md, ui.md}` with lab tables and screenshots, and `docs/demo.md` updated.

## Known gaps (deliberate)

- Blood Pact does not share damage; it is +20% damage taken plus the proximity blast.
- Crimson Tide is two half-arena sweeps, not a rotating beam.
- The Leech holds its target in melee rather than riding the hero.
- No Calling growth in Movement II.
- No Legion relics or motifs.
- Brann, Movement III, the Finale, Severing, Silencing, Mimicking, Doom-touched, Tyrant and Mimicry are not in this slice.
- Movement I is still 10 stops. Adding Movement III and the Finale would exceed the 30-40 min target unless Expeditions use a shorter Movement I.

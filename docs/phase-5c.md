# Phase 5c — Movement III: the Unstitched

*2026-11-05 · plan: [02 §8](plan/02-game-design.md#8-the-expedition-run-structure) (line 199: Movement III, 6 rows), [03 §6 Movement III](plan/03-content-bible.md) (lines 259-280), [03 §7](plan/03-content-bible.md) (Seamstress line 290, the Unweaver lines 306-310), [03 §8 Silk](plan/03-content-bible.md) (Guard Strand line 331), [03 §9.1](plan/03-content-bible.md) (Sacrificial Lamb line 419, Warden's Key line 421), [04 §1](plan/04-presentation.md) (line 13, the Abyssal Rift), [06 Phase 5](plan/06-roadmap.md) (lines 112-125) · follows [Phase 5a](phase-5a.md) and [Phase 5b](phase-5b.md)*

After Vharun, an Expedition now goes down into the **Abyssal Rift**, where the world is coming unstitched. Movement III has:

- **six** map stops (the plan's six rows; Movement II has seven). It is short on purpose, for pacing.
- the five Unstitched: **Shears, Void Maw, Doubt Wraith, Null Priest, Mimic**.
- the four elite affixes still missing: **Severing, Silencing, Mimicking, Doom-touched**. Shielded, Volatile and Hastened are in `src/content/enemies.ts:396-416`, and Vampiric is in `src/content/legion.ts:452-461`.
- **the Seamstress** as mini-boss, with Needle Rain, Stitch and Unpick.
- **the Unweaver** as boss, in three phases:
  1. Snip, Spindles and Shear;
  2. Steal Verse and Unravel;
  3. Mirror Weave.
- one Movement-gated Silk motif (**Guard Strand**), three Movement-gated relics, two events and two badge Deeds.

The Expedition becomes **Prep → Movement I → Movement II → Movement III → Summary**. Vharun becomes an interlude boss with no code change, as the Cantor did in 5a. **For now the run ends after the Unweaver.** The Finale (the Silent Conductor) is the next slice, and this slice leaves a clean hook for it (see *The Finale hook*).

## Principles

Movement II attacked the heroes. **Movement III attacks the Weaver's own tools.** It cuts the Thread, silences her techniques, turns a hero against the party, copies her casts, steals a song and reverses Mend. For a healer that can feel like losing control. Five principles keep it fair.

1. **Nothing is taken without a tell and a way back.**
   - Every attack on the kit has a telegraph of at least 1.0 s, an answer glyph where the player is looking, and a recap that names the answer.
   - No Thread lock lasts more than 3 s.
   - Nothing silences the Weaver anywhere she can't Glide out of. Glide is never blocked, and it never greys out.
   - No song is taken for more than 30 s.
2. **One verb per enemy, and only two new answer glyphs.**
   - `thread` (**Retarget**): move the Thread off the line, or onto another hero.
   - `empower` (**Empower**): switch the Thread to Empower.
   - Every other answer is a verb the Weaver already owns: Focus, Rally, Reel, Chime, Ward, move or Glide.
3. **Reuse before inventing.**
   - Possession is a P5 mark, a status payload, a disable and a status tick.
   - Doom ignites as a mark (a new, small mark starter).
   - Needle Rain is a P7 follow-up chain.
   - Stitch is a P5 link whose status payload roots (P4).
   - The Maw and the Null Priest share one timed-zone primitive.
   - The Spindles are the guard-arc multiplier.
   - The cut verdict follows the Execution verdict.
4. **Bots and the HUD read public state.** Everything a bot or the HUD must see is public, optional, lazily created hashed state. Shared pure rules live in one module (`src/sim/rules3.ts`) that the sim, bots, render and UI all import.
5. **Movements I and II, and the default party, stay bit-for-bit unchanged.**
   - All **11** hashes in `tests/sim/golden.json` stay byte-identical: patrol 2626acee5ce8d584, crowd 323bd3a88aea3f1b, skilled-first-light 905754ea95eb27ac, skilled-bellwarden 9ff673296b5779d5, novice-cantor ef492fba9d6c91ec, skilled-crimson-gate 33de216e886e4fae, novice-matriarch c189c9db37b9b5f0, skilled-vharun 0d468d6046318cd6, skilled-brann-crimson-gate 5831f3df358d5c5d, skilled-brann-bellwarden 10e99af8f2dd8003, novice-brann-first-light 9ba4ea40f94cd1aa.
   - `SIM_VERSION` stays **22** (`src/sim/constants.ts:9`).
   - These stay byte-equal:
     - `tools/m1-baseline.ts --check` and `--movement 2 --check` (270 fights each);
     - `tools/expedition-baseline.ts --check` at movements **2** (`:43, :52`), which stays the I-II pin for good;
     - preludeSnapshot, draftSnapshot (it passes movements 2 explicitly, `tests/meta/draftSnapshot.test.ts:28`), commandSnapshot and rosterInvariance.
   - Only `contentVersion` (`src/content/index.ts:122`) changes, and four goldens are appended. Only `tests/sim/golden.json`, `tests/sim/determinism.test.ts`, `tests/sim/m1Unchanged.test.ts` and `tools/update-golden.ts` reference contentVersion. No other committed replay fixture exists in tests, tools or e2e (checked by grep), so the bump breaks no stored replay.

## Scope

**In:**

- the 5 enemies, the 4 affixes, the Seamstress and the Unweaver, plus 3 adds (Spindle, Stolen Verse, Hollow Champion);
- 5 arenas, 7 map encounters and 1 event-only elite;
- the `UNSTITCHED` MovementDef;
- the Abyssal Rift biome in render, audio and UI;
- Guard Strand, 3 relics, 2 events and 2 Deeds;
- bots, harness, kits, baselines, goldens and bands;
- a route length derived from content;
- one text edit to Warden's Key.

**Out:**

- Seren, Oro and the Conductor Calling;
- the Finale and its Grand Silence;
- Twin Spindle (a second Thread), Razor Silk and Thread the Needle;
- a detach command;
- Counterpoint aura forms;
- the 'Mimicry' Dissonance level (`src/ui/screens/dissonanceModel.ts:43-47`);
- Calling growth in Movements II-III;
- a shorter Expedition Movement I.

## Your answers (2026-11-05)

The four questions about auras and Mirror Weave were answered as recommended:

1. **Steal Verse mutes one aura** at runtime (the first aura of the field song) while the Stolen Verse lives, for 30 s at most, and never past phase 3. No aura definition, number, list or reservation changes.
2. **Silencing reuses the Mute field.** The elite carries the Mute's existing aura suppression with the same numbers (7 m; aura radius −40%, effect −30%). Warden's Key's text names Silencing elites.
3. **The Null Priest's rune blocks techniques only:** Ward, Chime and Reel/Rewind. It never touches auras, planted or carried.
4. **Mirror Weave is an interruptible 2.0 s Mirror Ward** on the Hollow Champion, answered by an interrupt or by Focus on the champion.

These still take the recommended default until you say otherwise:

5. One Expedition covering every Movement in content; the Prelude stays the short option.
6. Guard Strand and three Movement III relics (Sacrificial Lamb, Knotted Cord, Stillwater Bell) are added, gated inside the pools.
7. Pacing: accept a Skilled I-III Expedition of about 38-40 modelled minutes for now; shorten Movement I for Expeditions in the Finale slice.
8. A possessed hero strikes other heroes only, never the Weaver.

## Decisions taken

| Question | Choice | Alternative, and why not |
|---|---|---|
| What 'threads' means | There is **one Thread**: the segment from the Weaver to `world.party[w.threadSlot]` (`src/sim/state.ts:136-150`). Every 'snaps your threads' mechanic acts on that segment, and no text ever says 'threads'. | Building Twin Spindle first would rewrite every Thread reader (dial, render, Bear, Prism, bots) for one Epic motif. |
| Who plays Movement III | **An Expedition is every Movement in content.** `EXPEDITION_MOVEMENTS = CONTENT.movements.length` replaces the literal 2 in `routeMovements` (`src/meta/profile.ts:108-109`). Its callers are `runStore.ts:291, 306` and `profileStore.ts:384`. Every tool and baseline passes `movements` explicitly (`expedition-baseline.ts:43, 52`, `brann-bands.ts:263`, `harness-core.ts:632`, `harnessTools.test.ts:161, 296`), so none of them moves. There is no new unlock and no PROFILE_VERSION bump. | A third route option (I-II) adds a toggle state, copy and baselines. Question 5 above. |
| Map size | **6 stops** (02 §8), with **one elite stop** that teaches all three combat affixes. | A 7-stop Movement III (like Movement II) adds about 1.5 modelled minutes and pushes the Expedition past 40 before the Finale. |
| Scaling | Enemy side only, as in 5a. **Start at life ×1.75, damage ×1.05**, then sweep life 1.5-2.1 and damage 0.95-1.15 on whole I-III Expeditions. **Rewards start at ×1.5.** | The plan's hero-relative start is 3.0/2.0 = 1.5 for life and 2.2/2.4 ≈ 0.92 for damage (03 line 165; §6 line 236). Movement II shipped about 16% more life than its plan start (1.29 → 1.5). |
| Vocabulary | **Two** AnswerTags: `thread` ('Retarget') and `empower` ('Empower'). The Mimic's 'vary your techniques' is taught by its cast-bar icon, the 'mirror cracked' payoff and a hint, with the Focus glyph. | One overloaded 'thread' tag for both retargeting and Empower would teach two verbs with one glyph. A 'vary' or 'feint' tag isn't an action key. |
| Shears windup | **1.0 s** (0.85 s Hastened, `enemies.ts:106`), not 0.9. | 0.9 s to read a path and press a hero key is at the edge of reaction time. A miss is cheap, so the tell can be generous. |
| Possession | A P5 mark (markStatus `doubt`) whose attack deals **60 damage** and carries the status payload `possessed 5 s`. It lands through the existing payload rule `attack.status && dealt > 0` (`telegraphs.ts:433-434`). A full Ward blocks it, a Perfect negates it, and Paradox (if picked) cancels it. The possessed hero is **disabled**: no moves, abilities, Solos, calls or Cue. Every 0.5 s it strikes the nearest other hero **within max(5 m, its own attack range)**, for half its own basic DPS. A possessed Lyra (range 14) or Vexis (12) still shoots an ally across the formation (`src/content/heroes.ts:17, 105, 193, 289`). It **never hits the Weaver**, deals no lifesteal, and gets no Empower or aura bonus. | Real ally-targeting hero AI touches `chooseTarget`, `tryAbilities` (which assumes `target.enemy`), Solos, calls, lifesteal and Bonds. A flat 5 m reach would leave a spread-out ranged hero harmless, so the lesson wouldn't read. |
| Stitch | A **link** (`linkStatus 'stitch'`) that deals 60 and carries the status payload `stitched 6 s`. A stitched hero is **rooted**: `isRooted` checks pinned, then stitched. The pair is drawn sewn. The link radius is 40 m, so spreading out never answers it. **A Chime breaks the link in its windup**, through the existing link test (`telegraphs.ts:191-199`). After it lands, a Chime (radius 4) frees both heroes, and any Reel frees the one it pulls. A Ward on one hero blocks that hero's root. | The bible's 'move as one' would need a two-body movement constraint in `heroes.ts` and `physics.ts`. An `effect:'script'` link would skip `contains`, `releaseLink` and `telegraphResolved` (`telegraphs.ts:291-337`), so a Chimed Stitch would still root both heroes, with nothing for the recap to name. |
| Void Maw | **It breathes.** Every 11 s it *Inhales*: a 1.4 s tell, then a 4 s pull field of r 8 (2.4 m/s, 30/s DoT). Between breaths it is a stationary target. | A constant field has no tell and no window. Melee heroes would stand in it for good, and the healer would have nothing to read. |
| Null Priest | It plants a **rune at the Weaver's feet**: a 1.5 s circle, then a 6 s zone of r 5. Inside it, Ward, Chime and Reel/Rewind are refused with the existing reason `'silenced'` (`techniques.ts:42`, `events.ts:237`, `runtime.ts:105`). Glide, plant, the Thread, Directives, Cue and Crescendo still work. **It does not touch auras.** | A zone carried on the Priest would rarely reach a Weaver standing 6-10 m back, so it would teach nothing. Blocking Cue and Crescendo would take away the Vow, Stasis and Sunrise as answers. |
| Doom | Doom stacks on **heroes only**. At 5 stacks it clears and **ignites**: a new `startPayloadMark` (built on `startTelegraph`, like `beginAttack` at `enemies.ts:637`) puts a 1.5 s `doom_burst` mark on the hero (40% of max HP), owned by the living elite. The mark has its own status, **`doomed`**, which is an ailment and bound to its telegraph. Chime cancels it, a Ward absorbs it, a Perfect negates it, Paradox (if picked) cancels it, and **killing the elite drops it** (`dropTelegraphs`, `health.ts:1513-1531`). | Re-using `doom` as the mark status would let later hits re-stack and re-ignite during the mark, and the detonation would wipe the stacks (`telegraphs.ts:365-380`). Volatile isn't the pattern: its burst is hand-built in `onDeath` *after* death (`enemies.ts:1137-1180`), and `dropTelegraphs` spares it by id (`health.ts:1516`). |
| Needle Rain | A **three-needle follow-up chain** (P7). Each needle is a `centre:'target'` circle on a random hero, with cast pips 1/3 to 3/3. | A new 'volley' primitive drawing every circle at once is a new primitive, and it works against READABILITY_CAP=2 (`enemies.ts:34`). |
| Mimic | It copies **Empower** (if the Thread is in Empower), else the Weaver's **last Ward or Chime**, from existing hashed state (`w.threadMode`, `w.lastTechnique`, `state.ts:139, 170`). `lastTechnique` is `'ward' \| 'chime' \| 'reel' \| null`, and Rewind writes `'reel'` (`rewind.ts:86`). So 'Reel or Rewind last' is the single value `'reel'`, and with it or null the Mimic doesn't cast. The copy is locked at cast start and shown on the cast bar. **If the Weaver's current copy differs at resolution, the mirror cracks** and nothing lands. | A new `lastCast` record would mean new Weaver state. An inverted Reel throwing heroes around would be a second Maw. |
| Unravel's answer | **Empower, or Bear** (Martyr). There is no detach command. Under **Stasis** the reversed Mend is suspended: Mend heals as usual and the window's clock waits. | Detach is a new Command kind, which needs the replay zod in `src/sim/replay.ts`, normalize, an input binding and replay versioning. Letting the reversed Mend run during Stasis while `until` is pushed back would make Stasis *lengthen* the harm (`updateThread` runs during Stasis, `api.ts:88`). |
| Mirror Weave | The Unweaver weaves a **Hollow Champion**, threads it (×1.25 damage, 1% a second heal) and casts an **interruptible 2.0 s Mirror Ward** on it every 14 s. The answers are to interrupt it and kill the champion. | The bible's feint (Hold, then Cue) needs the boss to react to Hold, Cue and Solo starts. An autonomous Solo would set off the Ward without the Novice doing anything, and the feint is invisible without a cooldown read. Question 4 above. |
| Steal Verse | A **runtime mute** (`field.stolen`) of the first aura of the field song, or of the beam song if there is no field song. `updateField` skips it, `chordMask` drops its bit, and `chorusPulse` counts one aura fewer (`techniques.ts:903`). Sovereign stays as computed from the loadout (`world.ts:762-764`): it is a build stat, not a field read. No aura definition, number, list or reservation changes. The aura returns when the Stolen Verse dies, after 30 s, or at phase 3. | Removing the id from `field.chords[i].auras` would leave Sovereign and Unbroken Chorus inconsistent, because they are computed once (`world.ts:762-764`, `field.ts:158-165`). Question 1 above. |
| Thread cut code | `cutThread` is a **new function beside** the range snap. The range snap (`thread.ts:172-186`) is not refactored. A cut fires Taut Release, whose text reads 'When the Thread snaps' (`motifs.ts:37-44`). Each cut telegraph reports one `cutResolved {telegraph, cause, result}` event. | Extracting the range snap risks its event order and Taut Release behaviour. A per-victim `telegraphResolved.cut` field can't report a raid that hits nobody, or a line that hits nobody but crosses the Thread. |
| Ward without the Thread | For 3 s after an **enemy** cut, the input layer aims an un-hovered Ward or Reel at the last threaded slot, which it takes from `threadSnapped.target` (`InputController.ts:212-214, 250-253`). The sim is unchanged, and bots and replays send explicit slots. | Otherwise a keyboard Ward right after a cut is refused with 'target' (`techniques.ts:104-113`): input taken away silently. |
| Boss scripts | A `BOSS_SCRIPTS` registry for **new** bosses, consulted only after every legacy `c.defId ===` branch and every `m2` read has run. In `updateBosses` it comes after `m2?.followUp` (`bosses.ts:183`); in `enterPhase`, after the `m2.followUp` reset (`bosses.ts:325`). The Bellwarden, Cantor, Matriarch and Vharun bodies are not moved. | Migrating them risks byte drift in 4 goldens for no gameplay gain. |
| Script state | Movement III clocks live in a lazy `world.internal.m3`. `m2` keeps its name and shape. Movement III `followUp` and `decreeLimit` reuse `m2` through `ensureM2` (`enemies.ts:425-429`), which runs only from those attacks' own branches and never from a shared path. | Renaming or reshaping `m2` changes skilled-vharun's hash. Duplicating the follow-up bookkeeping in `m3` adds code for no gain. |
| New pools | Guard Strand (`requires.movement: 3`) and three relics (`movement: 3`) are filtered **inside** `eligible()` and `relicPool` (`run.ts:1385-1389, 1708-1722`), so `rollRarity`'s predicate (`run.ts:1399`) sees the same pool sizes in Movements I and II. They take the offer's Movement as a parameter. | Filtering after `rollRarity` changes which rarity is drawn. With no new pools, Vharun's new 3-relic interlude and the Movement III offers come up nearly empty: Skilled holds 7-12 of the 13 non-cursed relics at Vharun (measured on 6 Skilled 2-Movement Expeditions). Question 6 above. |
| Carried Rift relics | A Rift relic can be enshrined and carried, but it **sleeps outside a Movement III fight**. `createWorld` passes to `resolveMods` only the relics whose `movement` is ≤ the fight's encounter Movement (a content read, `world.ts:302-310`). The Reliquary shows 'Wakes in the Abyssal Rift'. | Marking them never-enshrinable would deny a reward for a won Rift. Leaving them awake would break 'inert unless a Movement III fight is running' (Stillwater Bell's Chime −2 s in a Prelude). |
| Versions | SIM_VERSION 22. No RUN_SAVE_VERSION or PROFILE_VERSION bump. | There are no command changes, and every save field is additive. |

## Engineering ground rules (the Movements I and II contract)

5a's five rules (docs/phase-5a.md:40-61) and 5b's seven (docs/phase-5b.md:90-113) still apply. This slice adds seven.

1. **Characterisation first (W0a).** Before any behaviour change, these are green and committed:
   - the three Brann hashes, pinned as literals beside the eight (`tests/sim/m1Unchanged.test.ts:17-41`, length 11);
   - both m1-baseline modes, and expedition-baseline at movements 2;
   - preludeSnapshot, draftSnapshot, commandSnapshot and rosterInvariance;
   - the update-golden dry run;
   - a Crimson Spire mood, look and model snapshot (the M1 pattern, `tests/renderMovement2.test.ts:428-446`);
   - a crimson and reliquary offline audio-output snapshot.
2. **Every new hook is a guarded early `if` that is false outside Movement III content.** It reads an absent key (`world.field.zones`, `world.field.unravel`, `world.field.stolen`, `world.internal.m3`, `enemy.tethered`, `enemy.mimic`, `enemy.emboldenedUntil`), a status id only Movement III content applies, an optional def field, or a mod at its neutral default.
   - Additive mods default to 0, multiplicative mods to **1** (`cutLockMult`, like `muteDamageMult`, `mods.ts:285`).
   - Existing float products are never reordered.
   - A new factor is applied as `if (k !== 1) x *= k`, or by a function that returns the old value unchanged when it is neutral.
3. **Absent, not undefined.** Every new hashed key is optional, set lazily and removed with `delete`.
   - `endEncounter` (`director.ts:241-258`) deletes `m3`, `field.zones`, `field.unravel` and `field.stolen`.
   - Nothing is added to `WeaverComponent`, `HeroComponent` or `Health`.
   - The per-hero possession tick uses the existing optional `Status.tickIn` (`state.ts:100-101`). The Unravel accumulator lives in `field.unravel`. Nothing new appears in `tests/sim/rosterInvariance.keys.json`.
4. **No new RNG on Movement I or II paths.**
   - The new `rng.ai` draws are all Movement III attacks: the Doubt Wraith's `randomNonTank`, Needle Rain's `randomHero`, and the spawn points of Spindles and the Stolen Verse (`ringPoint`).
   - Steal Verse, the Mimic's beneficiaries, and the aim of the Shears and Snip are deterministic.
   - The Novice draws only while the mechanic is on the field.
5. **The range snap and the Weaver-down snap are untouched** (`thread.ts:172-186`; `health.ts:1406-1411`).
6. **Interim behaviour.** No band, golden or bot test is recorded against Movement III content before W1, W2 and W3 merge (docs/phase-5b.md:111-113).
7. **Shared predicates keep their exact semantics.**
   - `isDisabled` (`health.ts:102-104`) gains `|| hasStatus(e, 'possessed')` appended, with no loop rewrite.
   - `isRooted(e) = hasStatus(e,'pinned') || hasStatus(e,'stitched')` keeps `pinned(a) ? 0 : a.mass` in physics, and the `if (rooted && hero.dodge) hero.dodge = null` side effect in heroes.
   - `enemy.tethered` is touched only when the spawning or dying def has `tether`, and it is deleted at 0.

## Run structure

```
Prelude:    Prep ─▶ Movement I (10) ─▶ Hollow Cantor ─▶ Summary                                   (unchanged)
Expedition: Prep ─▶ Movement I (10) ─▶ Cantor (interlude) ─▶ Movement II (7) ─▶ Vharun (interlude: epic draft,
            3 boss relics, 63 Aether, heal 50%, steadies the Shaken) ─▶ Movement III (6) ─▶ the Unweaver ─▶ Summary
```

**Verified:** appending a third MovementDef changes nothing structural.

- `generateMap(seed, 3)` gives 23 rows. Rows 0-16 equal `generateMap(seed, 2)` except for Vharun's `next` and reward.
- The edge builder links Vharun to `r17c0` (`run.ts:516-540`).
- `isFinalNode` (`src/meta/runEnd.ts:9-11`) makes the Unweaver final.

### The Movement III map: a teaching ladder (global rows 17-22, RNG label `map:m3`, `run.ts:443`)

| Row | Nodes | Teaching beat |
|---|---|---|
| 0 (r17), fixed | `frayed_threshold` skirmish | **Shears → Retarget.** Shears and choristers only. On screen for the first time: the dotted path, the scissors marker where it crosses your Thread, the `thread` glyph and the 'CUT' callout. |
| 1 (r18), lessons | `maw_hollow`, `wraith_vigil`, `null_chapel` | Every path learns one: **Inhale → Rally**, **Doubt → Focus, then Chime**, or **Null rune → Glide out**. |
| 2 (r19) | `mirror_hall` skirmish, the `frayed_court` elite, an event | **Mimic → vary or Focus**; or **Severing → Silencing → Doom-touched**, one wave each. |
| 3 (r20), fixed | `the_seamstress` | Consolidation: Chime the Stitch, dodge or Ward the needles, re-thread after the Unpick. |
| 4 (r21) | respite, merchant, forge | A breath before the boss, and somewhere to spend Aether. |
| 5 (r22), fixed | `the_unweaver` (final, `next: []`) | The final exam: Retarget, Focus, Empower and interrupt. |

- **One elite, three affixes.** A Movement with `lessons` is a ladder, and a ladder doesn't shuffle its pools. `pick()` takes the least-used encounter in content order (`run.ts:443-449, 465-474`). A second pooled elite on a single elite stop would never appear, so all three combat affixes live in `frayed_court`, one per wave.
- **Mimicking** is met through the event elite `unstitched_vanguard`, and through Elite Vanguard (`director.ts:180-188`).
- An enemy met first anywhere other than its lesson gets the existing first-sighting card (`sighting.ts:94-160`).
- The lesson row uses the existing rule: one skirmish per lesson on the first unfixed all-skirmish row of that width (`run.ts:455-462`).

**`UNSTITCHED` MovementDef** (`src/content/unstitchedRun.ts`):

- id 'unstitched', name 'The Unstitched', mapTitle 'The Unravelling Descent', biome 'abyssal_rift';
- rows `[['skirmish'], ['skirmish','skirmish','skirmish'], ['skirmish','elite','event'], ['miniboss'], ['respite','merchant','forge'], ['boss']]`;
- fixed rows 0, 3 and 5;
- lessons `['maw_hollow','wraith_vigil','null_chapel']`;
- opening `frayed_threshold`, skirmishes `['mirror_hall']`, elites `['frayed_court']`, miniboss `the_seamstress`, boss `the_unweaver`;
- `scale {life: 1.75, damage: 1.05}` and `rewards {xp: 1.5, starlight: 1.5, aether: 1.5}` (starting values).

It is registered as `movements: [...MOVEMENTS, CRIMSON_LEGION, UNSTITCHED]` (`src/content/index.ts:98`). The lint ties index 2 to `movement: 3` (`schema.ts:1476-1484`).

### Threat, rewards and run end

- **Threat** restarts per Movement (`threatFor(rowInMovement)`, `src/meta/economy.ts:17-22`): ×1.0 at row 0, rising to about ×1.15 on the boss row.
- **Vharun becomes an interlude** automatically (`run.ts:400-409, 1101-1110`): an epic draft, 3 'boss' relics, INTERLUDE_AETHER 50 × 1.25 = 63, and heal 0.5, which also steadies the Shaken.
  - `BIOME_PLACE.abyssal_rift = 'the Abyssal Rift'` (`run.ts:280-283`), so his node reads 'Vharun, the Crimson Warden. Beyond it, the Abyssal Rift.'
  - Brann's fallback recruit on any Vharun fight still works (`run.ts:756-773`).
- **Relic and motif offers** take an `offerMovement`: the node's Movement, plus 1 at a non-final boss. So Vharun can offer Rift relics and Guard Strand.
- **The Seamstress** pays the mini-boss reward.
- **The Unweaver** ends the run, with FINAL_CALL `the_unweaver: 'The Unweaver. Stitch the world whole.'` (`run.ts:286-289`). The `vharun` entry stays, because 2-Movement saves still show it.
- **The win** is unchanged: `wonRun`, RUN_WIN_XP, the Starlight win bonus, Tears and the win Deeds all key on `endsRun`.
- **Enshrine** is unchanged: an Expedition that reached Movement II (`run.ts:572-576`). Rift relics enshrine, and sleep outside Rift fights.
- **Calling tiers** stay at `CALLING_ROWS [0,3,5,7]` (`run.ts:267`).
- **Prices.** Merchant and forge prices are unchanged. W9 measures the unspent Aether at the Unweaver (Skilled leaves Movement II with 120-450) before it proposes any per-Movement price multiplier.

### Saves, profile and copy

- **No version bumps.** Each map is saved whole, so an in-flight 2-Movement Expedition keeps Vharun final (`src/meta/save.ts:441-442`).
- **Prep-phase upgrade.** On resume, a run still in **Prep** with `movements 2` is upgraded by `Run.setMovements(saved, EXPEDITION_MOVEMENTS)` (the existing `runStore.ts:306` path). A run past Prep is never touched.
- **Unlock text.** The 'expedition' unlock text (`profile.ts:234-241`) is derived from content: 'climbs on through Movements II–III to the Unweaver'.
- **Derived copy.** These no longer hard-code two Movements:
  - `titleEyebrow` reads 'Movements I–III · The Expedition' (`routeText.ts:124-126`).
  - `routeHint` (`:137-141`) today reads 'Movement I, then Movement {N} (…)'. With three Movements that would say 'Movement I, then Movement III', skipping II. It becomes 'Movements I–III, to the Unweaver' for N ≥ 3. The Prelude string is pinned unchanged.
  - The Prep line becomes 'climbs on through Movements II–III' (`PrepScreen.tsx:449`).
  - `finalBossName` names only the last Movement's boss (`reliquaryModel.ts:1105-1119`).
  - ROUTE_MINUTES.expedition takes its measured value (`routeText.ts:19`).
- **New text entries.** SPOILS gains `vharun` ('The Warden's armoury … the Rift yawns below') and `the_seamstress` (`interlude.ts:244-263`).
- **Warden's Key** text (`src/content/relics.ts:41-48`) becomes 'Your heroes deal {mult}× damage to Mutes and Silencing elites.' Its empowered ×4 applies the same way. The sim behaviour is unchanged in Movements I and II.

## Vocabulary

### Answer tags (`src/content/schema.ts:13-24`, mirrored in `src/sim/events.ts:22-32`)

| Tag | Label | Glyph | Action | Used by |
|---|---|---|---|---|
| `thread` | Retarget | the Thread icon with a cut mark | the hero keys: move the Thread off the line, or to a hero on your side | Shears, Severing, Snip, Unpick |
| `empower` | Empower | the existing Empower star | `threadMode` (`src/input/actions.ts:14`) | Unravel |

- `ANSWER` (`labels.ts:176-186`) is an exhaustive Record, so W0b lands stub entries for both tags.
- The overlay's `GlyphIcon` already has `'empower'`, with its LABELS, ICONS and ICON_COLORS (`overlay.ts:15, 53-66`). Once `'empower'` joins AnswerTag, the union simply deduplicates. Only `'thread'` needs new overlay entries.
- Each glyph gets a windStyle in sfx and passes the ΔE glyph test.

### Statuses

StatusIdSchema (`schema.ts:34-61`) and the StatusId union (`state.ts:67-87`) change in step. AILMENT_IDS (`schema.ts:1386-1395`) and its render copy (`entities.ts:243-254`) gain doubt, possessed, doom, doomed, stitch and stitched.

| Status | On | Ailment (Chime cleanses; `immune` blocks) | Effect | Recap answers (DOT_ANSWERS, `health.ts:293-297`) |
|---|---|---|---|---|
| `doubt` | heroes | yes | The Wraith's mark during its 4 s cast. Chiming it cancels the cast (`telegraphs.ts:317-322`). Bound to its telegraph (`statuses.ts:23-25`). | — |
| `possessed` | heroes | yes | 5 s; disabled; strikes an ally (Q6); ticks through `Status.tickIn` | chime, focus |
| `doom` | **heroes only** | yes | Stacks to 5 on one 10 s timer, then ignites (Q7). | chime, ward |
| `doomed` | heroes | yes | The ignition mark's status for 1.5 s, bound to its telegraph. | chime, ward |
| `voided` | heroes, Weaver | no | Inside an Inhale: 30/s × damage scale, refreshed while inside. The Weaver's answer is to move or Glide. | stack, reel, move |
| `stitch` | heroes | yes | The Seamstress's link during its windup; bound to its telegraph. | — |
| `stitched` | heroes | yes | 6 s rooted. Chime frees, and a Reel frees the hero it pulls. | — |
| `unravelled` | heroes | no | Display and recap: taking Unravel's reversed Mend. | empower |
| `emboldened` | enemies | — | Display: the Mimic's Empower copy, or the boss's Thread. | — |

- Purge's ailment list (`techniques.ts:594-612`) is unchanged.
- Chime's 1.5 s `immune` blocks fresh Doom stacks and a fresh possession, as a deliberate reward.
- The Weaver's silence is **not** a status, so the Skilled bot's 'Chime any silence' rule (`skilled.ts:260`) never fires on a rune.
- A down whose source is a possessed hero records `['chime','focus']` as its answers.
- An orphaned bound status (a `doomed` or `doubt` whose mark was dropped with its owner) expires 0.5 s after its timer runs out, as today (`statuses.ts:72-73`).

## The new sim primitives (Q-table)

Each Q generalises one existing system and has a Movement I/II safety column. There is **no new telegraph shape and no new RunPhase.**

| # | Primitive | Reuses | Where | Used by | Movement I/II safety |
|---|---|---|---|---|---|
| Q1 | **Thread geometry and cuts.** Pure `threadSegment(world)` returns `{ax,az,bx,bz} \| null`. `segmentsCross` and `segmentDistSq` go in `core/dmath.ts` (the arithmetic of `contains('line')`, `telegraphs.ts:179-188`). `cutThread(world, cause, lock, by)` is a new function beside the range snap: it sets threadSlot null, tension 0 and `threadLock = lock × mods.cutLockMult` (default 1), grants `mods.cutResonance` (default 0), emits `threadSnapped {target, cause, lock, by}` and fires Taut Release. `AttackDef.cut?: {lock, always?}`: in `resolve()`, after the victim loop and independent of victims, a line telegraph cuts if its rectangle crosses the current segment, and `always` (Unpick) cuts unconditionally. Every cut telegraph emits one `cutResolved {telegraph, cause, result: 'cut' \| 'held' \| 'strand' \| 'none'}`, where 'none' means there was no Thread at cast start (the Execution-verdict pattern, `telegraphs.ts:593-628`). | range snap, threadLock, Taut Release, Execution verdict | thread.ts, dmath.ts, rules3.ts, telegraphs.ts | Shears, Severing, Snip, Unpick | range snap untouched; `cut` absent, so no read |
| Q2 | **Targeting and centre.** Targeting `'threadLine'` is a beam aimed through the Thread's midpoint at cast start, then fixed; with no Thread, it aims at the farthest hero. Targeting `'allyEnemy'` is the living enemy (not the caster) with the highest max HP within 12 m, ties by id, else the caster. `centre: 'weaver'` is a circle at the Weaver's feet, not begun when the Weaver is absent (`config.absent`) or down. All three are added to `beginAttack`, `canBegin` (`enemies.ts:903`), `predictedTarget` (`:935`) and Foresight (`:823`). | P7 `centre:'target'` | enemies.ts, schema.ts | Shears, Snip, Null rune, Mimic | unused enum values |
| Q3 | **Stationary enemies.** `EnemyDef.stationary?: true`: no approach and no chase-turn, the boss mass value (`enemies.ts:85`), and skipped by Gravity Well (`heroes.ts:1205-1240`). It still bites and casts. | — | enemies.ts, heroes.ts | Void Maw, Spindle | key absent |
| Q4 | **Timed zones.** `AttackDef.zone?: {kind:'pull'\|'null', radius, duration, at:'caster'\|'target', pullSpeed?, status?}`; effect `'zone'` resolves to its zone and nothing else. `completeCast` pushes `{id, kind, owner, x, z, r, until, pullSpeed?, status?}` onto a lazy public `field.zones`, following the lazy sanctuary-pool pattern (`state.ts:657-664`). The new `updateZones(world, dt)` runs right after `updateBosses`, inside the not-in-Stasis branch (`api.ts:95-98`). **A pull** moves each hero and the Weaver inside it toward the centre by `pullSpeed × dt`, in entity-list order, and refreshes `status`. It skips anyone `anchored`, rooted (`isRooted`), mid-Reel (`h.reel`), downed or Gliding. A zone ends at `until` or when its owner dies. Stasis adds dt to `until`, and `endEncounter` deletes the list. Physics is untouched: 'anchored' means immune to the pull, not to overlap. | Bloodmoon pools, P2 DoT, Anchor, Rally, Reel flight | zones.ts (new), api.ts, enemies.ts | Void Maw Inhale, Null rune | `field.zones` absent, so the call returns at once |
| Q5 | **Weaver silence.** Pure `weaverSilenced(world)`: the Weaver is inside a `null` zone. `castWard`, `castChime`, `castReel` and `castRewind` (`rewind.ts:63`) reject with `'silenced'`. Glide, plant, the Thread (attach and mode), Directives, Cue and Crescendo are exempt. `canCall` (`calls.ts:37-79`) refuses **Ward and Chime** calls while she is silenced, so Every Call is not charged. Calls answer only ward, chime or empower (`calls.ts:66-77`); the Empower call already waits on `threadLock`, so after a cut it is refused by the existing check. `downHero`'s readyTechniques (`health.ts:1357-1363`) leaves out the silenced techniques. | reject plumbing | techniques.ts, rewind.ts, calls.ts, health.ts | Null Priest | one absent-key read |
| Q6 | **Possession.** A possessed hero is disabled the way a stunned one is: `isDisabled` gains an appended `possessed` check, which covers moves, abilities, Solos and calls (`heroes.ts:104`, `calls.ts:48, 174`). `cue` (`techniques.ts:777`) refuses a possessed hero with `'target'`, and `tendCall` cancels. In `updateStatuses`, the `possessed` status ticks through its own `tickIn` every 0.5 s and deals 0.5 × (`attack.damage / attack.interval` of its def) to `possessionVictim(world, h)`. The victim is the nearest other living hero within max(5, `def.attack.range`) m, ties by slot, **never the Weaver**. The hit goes through `dealDamage(kind:'tick', status:'possessed', source:h, sourceName:'<Hero> (possessed)')`. The ledger, threat and Bonds already gate on `target.enemy` (`health.ts:670, 894`), so possessed hits stay off them. Bear and the Vow apply. Lifesteal never fires, because no hero attack resolves. | P5 mark, attack status payload, Chime cancels an ailment mark, P3 `dealt > 0`, the stun disable | statuses.ts, health.ts, techniques.ts, calls.ts, rules3.ts | Doubt Wraith | the status is never applied in M1/M2; the appended check is false |
| Q7 | **Doom ignition.** `StatusPayload.burst?: {at, attack}`. `applyStatusPayload` (`health.ts:306-360`) ignores a payload with `burst` on a non-hero, so the Weaver is never Doomed. When the stacks reach `at`, it removes `doom` and calls the new `startPayloadMark(world, owner=source, target, attack)` in enemies.ts. That function builds the mark through `startTelegraph` and adds the attack's markStatus `doomed`, as `beginAttack` does (`enemies.ts:637-650`). No damage happens inside the current hit. `doom_burst` is a real AttackDef referenced only by the payload, and the coverage test (`tests/sim/combat.test.ts:321-325`) counts payload `burst.attack` ids as used. | P2 stacks, the mark path of `beginAttack` | health.ts, enemies.ts | Doom-touched | key absent |
| Q8 | **Stitch and rooting.** `linkStatus` gains `'stitch'` (schema `:483`; Telegraph `state.ts:~578`). Stitch is an `effect:'damage'` link with a `stitched` status payload, so the existing branch handles everything. A Chime that cleanses `stitch` from either hero fails `contains` (`telegraphs.ts:191-199`). The hit and its payload land only on linked heroes (`:433-434`). `releaseLink` (`health.ts:1486-1511`) takes `t.linkStatus ?? 'resound'` instead of its pact/resound binary. Pure `isRooted(h)` (pinned, then stitched) replaces the pinned checks at `heroes.ts:114-123` and `:214`, the dodge step-out at `heroes.ts:1381-1382`, Brann's leap gate (`blood.ts:355`), and `physics.ts:42-44, 62-66`. `REEL_FREES` (`techniques.ts:398`) gains `stitched`, which frees the Reeled hero only. Rewind does not free. `boundToTelegraph` and Rewind's link branch (`rewind.ts:173-178`) learn 'stitch'. | P4 root, P5 link, payloads, P4 'every Reel frees' | telegraphs.ts, health.ts, heroes.ts, blood.ts, physics.ts, techniques.ts, rewind.ts, statuses.ts | Seamstress | pinned is checked first; stitched never exists in M1/M2 |
| Q9 | **The Mirror.** Effect `'mimic'` with `'allyEnemy'`. At cast start, `mimicCopyOf(world)` gives `'empower'` if `w.threadMode === 'empower'`; else `w.lastTechnique` if that is 'ward' or 'chime'; else null (`'reel'`, which Rewind also writes, or nothing). With null, `canBegin` refuses the cast. The copy is stored on optional `enemy.mimic {copy}`. At completion, if `mimicCopyOf` now differs, the mirror **cracks** (a `mirrorCracked` event, nothing applied). Otherwise: **Ward** gives a `ShieldKind 'mirror'` shield of 25% of the beneficiary's max HP for 6 s (never Shatterproof Halo, whose check is `kind === 'ward'`, `health.ts:758`); **Empower** gives `emboldenedUntil = t+8` (damage ×1.25); **Chime** heals 10% of max HP and clears stun, sleep and silence. `enemyDamageMult(world, c)` returns `c.damageMult` itself when `emboldenedUntil` is absent or past, else `c.damageMult * 1.25`. It replaces the raw reads at `enemies.ts:283` and `:636` in place, so the `(dmg × dm) × enrage` association is unchanged. `AffixDef.specials?` lists attack ids. `specialsOf(def, affixes)` returns `def.specials` itself (the same array) when no affix has specials. The spawn-time `specialCooldowns` (`enemies.ts:98`), the picker (`:377`) and Foresight (`:823`) iterate it. An affix special uses its attack's own cooldown. | Mending Hymn heal, addShield on enemies, lastTechnique | enemies.ts, health.ts, rules3.ts | Mimic, Mimicking, (Finale) | only existing Weaver keys are read; new keys absent; same arrays |
| Q10 | **Per-entity Mute radius.** Pure `suppressRadiusOf(world, e) = def.suppressRadius > 0 ? def.suppressRadius : affixSuppressRadius(e)`. `EnemyDef.suppressRadius` is a required number where 0 means none (`schema.ts:539`), so `??` would never fall through. It replaces the per-def reads in `collectDomes`, `DOME_RADIUS` and `underMuteDome` (`field.ts:39-64`), `render/entities.ts:554, 581` and `render/astrolabe.ts:863`. `muteDamageMult`'s `defId === 'mute'` (`health.ts:678`) becomes `suppressRadiusOf(world, target) > 0`. | the Mute | field.ts, health.ts, render | Silencing | in M1/M2 only `mute` has a radius and no affix has one: same set, same order, same values |
| Q11 | **Tether DR.** `EnemyDef.tether?: {dr}`. The boss's `enemy.tethered` is recounted only when a spawning or dying enemy's def has `tether`, and it is deleted at 0. In `dealDamage`, right after the guard multiplier (`health.ts:697-698`), a hero hit on an enemy with `tethered > 0` is multiplied by `1 − dr`, with a rate-limited 'Spindled' floater (the guardBlocked pattern). | the guard arc | health.ts, enemies.ts | Spindles | key absent |
| Q12 | **Unravel.** Lazy public `field.unravel?: {until, source, acc, tickIn}`. In the Mend branch (`thread.ts:196-227`), **while `field.unravel` and not `field.stasis`**, Mend on a standing threaded hero deals `mendPerSec × mendMult × potency` as damage. It accumulates in `acc` and ticks every 0.5 s (`kind:'tick', status:'unravelled', sourceName:'Unravel — your Mend'`). The revive channel holds its progress. The bleed-out freeze is off while unravelled (`statuses.ts:41, 84-90`). The Prism spill, the Relay heal and Sanguine Covenant are skipped. Empower and Bear are untouched, because they are the answers. Under Stasis, Mend heals as usual and `until` is advanced. | the Mend branch, DOT_TICK | thread.ts, statuses.ts | Unweaver phase 2 | key absent |
| Q13 | **Steal Verse mute.** Lazy public `field.stolen?: {chord, aura, add, until}`. `updateField` skips that aura's index when it fills auraMult, auraFocus and auraEcho, and `chordMask` drops its bit (`field.ts:89-93, 171-205`). `chorusPulse` counts `field.auras.length − 1` while it is set (`techniques.ts:903`). Content, `field.chords`, `field.auras`, Sovereign (`world.ts:762-764`), and the Spirit and Life reservation are unchanged. Restore deletes the key. | the Mute suppression path | field.ts, techniques.ts | Unweaver phase 2 | key absent |
| Q14 | **Boss-script registry.** `BOSS_SCRIPTS[defId] = {tick?, enter?(phase), resolved?(t), scriptedNext?, onAddDeath?(e), stasis?(dt), cleanup?}` in `src/sim/systems/bossScripts.ts`. It is consulted only after the legacy branches and `m2` reads, in `updateBosses` (after `bosses.ts:183`), `enterPhase` (after `:325`), `completeCast` (effect 'script'), `scriptedNext`, `onDeath`, `holdEnemyTime` and `endEncounter`. The lazy `internal.m3` is created by `ensureM3`. | PHASES data, the m2 pattern | bossScripts.ts (new), one-line call sites | Seamstress, Unweaver, the Finale next | the lookup misses for old ids |
| Q15 | **Guard Strand** (mod `guardStrand`, in seconds; 0 = off). In `land()` (`hits.ts:32`), an enemy bolt is destroyed (`strandBlocked`) if its segment crosses the Thread. The segment runs from its living source's *current* position to its target, so no PendingHit field is added. In `cutThread`, a Shears, Severing or Snip cut is refused under the same cooldown (`cutResolved.result 'strand'`). Unpick is never refused. Its clock is the lazy `internal.guardStrandAt`. | pending hits | hits.ts, thread.ts, mods.ts | the motif | mod 0 → no read |
| Q16 | **Movement-gated pools and sleeping relics.** `MotifDef.requires.movement?` and `RelicDef.movement?` are filtered inside `eligible()` and `relicPool` by an `offerMovement` parameter, so `rollRarity`'s predicate (`run.ts:1399`) and `makeShop` see the filtered pools. In the sim, `createWorld` hands `resolveMods` only the relics and motifs whose Movement is ≤ the fight's encounter `movement` (a content read). `world.relics` and the hashed config are unchanged. | hero-gated motifs | run.ts, world.ts | Guard Strand, 3 relics | the filter removes exactly the appended ids; no M1/M2 config contains them |

**Script state.**

- `internal.m3 = {nextSnipAt?, nextUnravelAt?, nextStealAt?, nextUnpickAt?, nextChampionAt?, nextMirrorAt?, champion?, severAt?: Record<EntityId, number>}`. It holds only the keys a script uses.
- Public keys, read by bots and the HUD: `field.zones`, `field.unravel`, `field.stolen`, `enemy.tethered`, `enemy.mimic`, `enemy.emboldenedUntil`.
- Sacrificial Lamb's once-per-fight flag is a lazy top-level `internal.lambUsed`.

## The Unstitched

Code life is the plan's HP × 2.2 (the 5a calibration, `legion.ts:4-7`). 'Eff.' is after the starting scale (life ×1.75, damage ×1.05) and before Threat. Every enemy has `movement: 3` and `material: 'cloth'`, and its Codex line is built from named constants (`src/content/unstitched.ts`).

Reference heroes, unscaled: Kael 1,600 HP, Lyra 820, Vexis 740, Brann 1,250, the Weaver 360. Hero speeds are 7.2-7.8 m/s (`src/content/heroes.ts:13, 101, 189, 281`), and the Weaver's is 6.5 (`src/content/weaver.ts:8`). A Ward is 30% of max HP + 120 (`weaver.ts:38-48`): 600 on Kael.

| Enemy | Role | HP code / eff. | Speed | Basic | Special | Telegraph | Answers |
|---|---|---|---|---|---|---|---|
| **Shears** `shears` | swarm | 990 / 1,733 | 5.4 | melee 40 per 1.0 s, r 1.2 | `shears_dash`: beam, `threadLine`, `fullLength`, `move:'charge'`, length 14, width 1.2, windup **1.0**, damage 120 (126), `cut {lock: 1}`; cd 8, init 3 | a **dotted** line (BEAM.dashed, `render/entities.ts:2461`) plus a scissors marker where it crosses your Thread | `thread`, `focus`, `move` |
| **Void Maw** `void_maw` | brute, `stationary` | 3,080 / 5,390 | — | melee 'Devour' 70 (74) per 1.6 s, r 2.8 | `maw_inhale`: burst self r 8, damage 0, effect `'zone'`, windup **1.4**, zone `{pull, r 8, 4 s, pullSpeed 2.4, status voided {duration 0.6, dps 30}}`; cd 11, init 5 | the swirl tightens through the windup, then turns inward for 4 s | `stack` (Rally), `reel`, `move` |
| **Doubt Wraith** `doubt_wraith` | caster, preferredRange 11 | 1,100 / 1,925 | 3.2 | bolt 40 per 2.0 s, r 13 | `wraith_doubt`: mark, `randomNonTank`, windup **4.0**, `interruptible`, damage 60 (63), `markStatus:'doubt'`, status possessed 5 s; cd 15, init 6 | a cast bar on the Wraith plus a cracked-mask mark over the hero | `focus`, `chime`, `ward` |
| **Null Priest** `null_priest` | caster, preferredRange 10 | 1,540 / 2,695 | 2.8 | bolt 50 per 2.2 s, r 12 | `null_rune`: burst `centre:'weaver'`, r 5, windup **1.5**, damage 0, effect `'zone'`, zone `{null, r 5, 6 s, at: target}`; cd 12, init 4 | a closing rune circle at the Weaver's feet, then a rune ring for 6 s | `move` (Glide out) |
| **Mimic** `mimic` | caster, preferredRange 10 | 1,320 / 2,310 | 3.2 | bolt 35 per 1.6 s, r 11 | `mimic_mirror`: burst self r 1.5, effect `'mimic'`, `allyEnemy`, windup **2.0**, `interruptible`; cd 12, init 5 | a cast bar showing **the icon it will copy**, and a mirror shimmer to its beneficiary | `focus` (hint: vary your techniques to crack it) |

**Shears.**

- It aims through the middle of your Thread, then the line is fixed. At resolution it cuts **only if the line still crosses the Thread**.
- The answer is visible geometry: get on your hero's side of the line (walk or Glide across), Thread a hero on your side, or Focus the Shears.
- Anyone standing on the line is hit for 126.
- With no Thread, it dashes at the farthest hero. That passive pressure keeps Idle losing.
- Lesson card: 'Shears cut your Thread. Thread a hero on your side of the line, or step across. Focus them.'

**Void Maw.**

- During the 1.4 s tell, Rally (3 s, `commands.ts:91`) walks the party to you at 7.2-7.8 m/s against the 2.4 m/s pull.
- A plain Reel lands a hero 2 m in front of you (`techniques.ts:356-358`): stand outside, then Reel.
- Anchor (a Reel variant, `techniques.ts:707`) makes the hero immune to the pull.
- A gliding Weaver is not pulled.
- **Swap** (`techniques.ts:341, 653`) puts *you* where the hero stood, inside the pull. Its hint and the Skilled bot treat Swap as a non-answer here: Rally instead.
- **Rewind** returns a hero to where they stood 3 s ago (`rewind.ts:99-102`). That undoes up to 7.2 m of drag for a hero who was pulled in, but does nothing for a melee hero who stood at the Maw all along. The Chronomancer card says so.
- A bloodlusting Brann below 40% ignores Rally (docs/phase-5b.md), so his hint names Reel and Anchor.
- Devour's chip damage on melee heroes is the reason to kill the Maw.

**Doubt Wraith.**

- The 4 s cast is the longest in the game.
- **Who interrupts.** Lyra's Piercing Shot looks for any interruptible caster in range (`heroes.ts:944, 997-1003`). Kael's Shield Bash interrupts only his current target (`heroes.ts:928-929, 1093-1096`), so Focus brings it to the Wraith. Brann's Sunder Leap interrupts casters where he lands, but only leaps at targets outside his minRange band (`blood.ts:346-360`). Vexis interrupts only by stunning, through her Chimed call's Resonant Starbolt (stun 1.2, `src/content/heroes.ts:234-244`) or a Cued Starfall. A stun interrupts a non-boss caster (`health.ts:283-284`).
- A Chime on the marked hero during the cast cancels it.
- A full Ward on the target blocks it.
- If it lands, the hero gets an indigo rim, a mask badge and a tether to the Wraith, and lashes an ally within reach. **One Chime frees them** (radius 4).

**Null Priest.** It targets *you*. The rune closes in 1.5 s at your feet: 6.5 m/s × 1.5 s = 9.75 m, so you can walk out before it forms, which also covers Heavy Score's 'cannot Glide'. Inside the rune:

- Ward, Chime and Reel grey out under a rune lock, and **Glide stays lit**;
- a refused cast plays a muffled 'silenced' sound, distinct from the cooldown sound;
- Glide is always allowed.

The rune is a different shape and colour from the Mute's cracked-glass dome, because the answers differ (move vs Focus).

**Mimic.**

- Its bar shows what it will copy: **your Empower if the Thread is in Empower, else your last Ward or Chime.**
- Change it before the 2.0 s cast ends (Chime after a Ward, Ward after a Chime, Mend instead of Empower) and the mirror **cracks** with a glass shatter: 'vary your techniques', made visible.
- If your last technique was Reel or Rewind (both stored as `'reel'`), it has nothing to copy.
- In the 'without you' re-run (`src/sim/counterfactual.ts`) there is no Weaver, so it never casts.

**Palette** (ambient bodies; the semantic colours are in Presentation):

- bodies in void-cloth indigo-black `#2a2547` with bone seams `#e8e3c8`;
- accents: Shears steel `#cfd2e0`, Void Maw `#3b2f8f`, Doubt Wraith `#6a5acd`, Null Priest `#d9c7a0`, Mimic `#b8c4d6`.

The Shears sit within 5 ΔE of Chronomancer silver `#c9d6ea`, and the Maw within 12.1 of vampiric under protanopia. Both stay ambient and are told apart by shape.

### Affixes

All have `movement: 3` and are appended after Vampiric. `KNOWN_AFFIXES` (`enemies.ts:45`) grows to 8, and the Elite Vanguard pool (`director.ts:180-188`) filters by Movement in content order.

| Affix | Data | Effect | Answer | Colour (min ΔE vs the semantic set and the existing affixes, every vision; scratch `m3/de4.ts`) |
|---|---|---|---|---|
| **Severing** `severing` | `cut {radius 2, lock 1}` | A hit it lands (melee, bolt or telegraph) while the Thread passes within 2 m + its own radius cuts the Thread, at most once per 3 s per elite (`m3.severAt`). | `thread`: keep the threaded hero away, or Thread a ranged hero | `#f8fafc` (23.7), scissors crown gem |
| **Silencing** `silencing` | `suppressRadius 7` | Carries the Mute's existing field, numbers unchanged (−40% aura radius, −30% effect inside). A Weaver inside is song-silenced. | `focus` (Warden's Key ×3, its text updated) | `#2563eb` (23.0), broken-note crown gem |
| **Mimicking** `mimicking` | `specials ['mimic_mirror']` | It casts the Mimic's mirror on that attack's own cooldown (12 s × `cooldownMult`). | `focus` | `#e0e7ff` (23.5), mirror crown gem |
| **Doom-touched** `doom_touched` | `onHit {id:'doom', duration 10, stacks 1, maxStacks 5, burst {at 5, attack:'doom_burst'}}` | Each hit on a **hero** stacks Doom. At 5 it ignites `doom_burst`: a mark, windup **1.5**, `pctMaxHp 0.4`, damage 0, `markStatus:'doomed'`, answers chime, ward and focus. A Ward blocks the stacks (P3 `dealt > 0`, `health.ts:365-384`). | `chime`, `ward`, and `focus` (its death drops the mark) | `#5b21b6` (20.6), skull crown gem |

- Severing and Mimicking sit close to each other, and so do Silencing and Doom-touched (pairwise 6.1-12.2). The crown-gem shapes carry the difference, as Shielded and Volatile already do.
- Volatile keeps its hard-coded answers `['move','reel']` (`enemies.ts:1157`). Do not 'fix' it.

## Mini-boss — the Seamstress (`the_seamstress`)

A many-armed tailor with needle-cone fingers and a spool on her back.

- HP 36,000 code (63,000 eff.); speed 3.0; radius 1.3; height 3.0; melee 80 (84) per 1.5 s, range 2.4.
- Arena `loom_hollow` (r 20, open); enrage 300 s; par derived (start 105).
- Phases at 1.0 and **0.5**.

| Attack | Shape and numbers | Tell | Answers |
|---|---|---|---|
| **Needle Rain** `seamstress_needles` → `_2` → `_3` | burst `centre:'target'`, `randomHero`, r 2.6, damage 300 (315) each. Windups 1.4, then 0.7 and 0.7 (`followUp {delay 0}`, scripted, each re-aimed at its own start); cd 12, init 5 | three circles in sequence, with needle-fall sprites; cast pips 1/3-3/3 (`blowsOf`, `hudBridge.ts:70-76`) | `move`, `ward`, `reel` |
| **Stitch** `seamstress_stitch` | link `pair`, r 40, `linkStatus:'stitch'`, windup 2.5, damage 60 (63), effect `'damage'`, status `stitched 6 s`; cd 18, init 8; `decreeLimit 2` | a cross-stitch link (not the threat dashes), then a sewn tether between the stitched pair (paired by status source) | `chime`, `ward`, `reel` |
| **Unpick** `seamstress_unpick` (phase 2, scripted) | raid, windup 2.5, `pctMaxHp 0.12`, `cut {lock 1, always}`, `followUp` Needle Rain after 1.0 s. Every 22 s (15 s enraged), first at +5 s after entry (`m3.nextUnpickAt`) | the raid cast bar, and a ripple running along your Thread | `ward`, `thread` |

- **Stitch Decree:** 'Stitch — two heroes are sewn to the floor. Chime breaks the stitch, or frees them both.'
- **Phase 2 at 50%, Decree 'Unpicking':** 'The Seamstress pulls your Thread loose. Ward the blow, then re-thread at once.' Answers `['ward','thread']`, `cooldownMult 0.85`.
- **Double threat:** Needle Rain on a stitched pair, who can't dodge (2 × 315). The rooted check also covers the dodge step-out (`heroes.ts:1381-1382`) and Brann's leap (`blood.ts:355`). Chime them before the rain, or Ward the needle. In phase 2, the Unpick leaves you threadless as the rain falls.
- **The Seamstress's script** holds only the Unpick cadence and its follow-up. Stitch and Needle Rain are data.

## Boss — the Unweaver (`the_unweaver`)

Tall and hooded, with a giant pair of shears and a crown of spindles.

- HP 78,000 code (136,500 eff., about ×1.15 more at the last row); speed 2.4; radius 1.6; height 4.4; melee 120 (126) per 1.6 s, range 2.8.
- Arena `the_unwoven` (r 22, open).
- Enrage **450 s**: inside the harness's 9 minutes (`tools/harness-core.ts:92`) and the 'without you' 600 s cap (`counterfactual.ts:29`). Enrage multiplier ×2.5 (`enemies.ts:350-352`).
- Par derived (start 270).
- Phases at 1.0, **0.66** and **0.33**, each with the 2 s phase shift (`bosses.ts:313-338`).
- Bosses are immune to stun (`health.ts:262-264`), so its casts are interrupted only by Kael's Shield Bash (on his target), Lyra's Piercing Shot and Brann's Sunder Leap.

### Phase 1 (100-66%): the Cut

| Attack | Numbers | Answers |
|---|---|---|
| **Shear** `unweaver_shear` | cleave `current`, r 4.0, 110°, windup 1.8, damage 900 (945); cd 14, init 6; `decreeNoDome` | `ward`, `reel`, `dome` |
| **Snip** `unweaver_snip` (scripted) | beam `threadLine` from the boss, length 30, width 1.4, windup **1.6**, damage 200 (210) to anyone on it, `cut {lock: 3}`. Every 15 s (10 s enraged), first at +8 s. Decree on its first two casts. Verdict through `cutResolved`. | `thread`, `move` |
| **Spindles** `unweaver_spindles` | burst self, summons 3 `spindle` on a 9 m ring, `maxAlive 3`, windup 1.5; cd 40, init 10; `decreeLimit 2` | `focus` |

- **Snip Decree:** 'Snip — the shears close across your Thread. Get on your hero's side of the line, or lose it for 3 s.'
- **Spindles Decree:** 'Spindles — while one stands, the Unweaver takes 80% less damage. Focus them.' The BossBar shows 'Spindles ×N · −80%'.
- **Double threat:** a Snip just before a Shear. You Ward the tank without a Thread, and the input fallback keeps an un-hovered Ward aimed at the last threaded hero.

### Phase 2 (66-33%): Steal Verse and Unravel

`PhaseDef.specials ['unweaver_shear']`: the Spindles stop and the Snip continues.

**Steal Verse** `unweaver_steal_verse` (scripted, effect `'script'`, windup 3).

- It is cast at +3 s after entry, then 40 s after each return.
- It mutes the first aura of your field song (the beam song's if there is no field song) and spawns a fleeing **Stolen Verse**. If the loadout has no aura, the cast is skipped.
- Killing the Verse pours the aura back. If the Verse lives 30 s, the aura slips back on its own. Phase 3 returns it at once.
- While it is stolen, the aura counts for nothing in the field, the aura mask or the chorus pulse. Its Spirit or Life stays reserved, and Sovereign holds.
- Decree: 'Steal Verse — the Unweaver tears <Aura> from your song. Focus the Stolen Verse to take it back.' Answers `['focus']`.

**Unravel** `unweaver_unravel` (scripted, windup 2.0, a cast bar).

- It opens `field.unravel` for 5 s: **Mend deals what it would have healed** to the threaded hero.
- The Thread turns black with lethal barbs and flows **forward**.
- Every 22 s (14 s enraged), first at +6 s after entry.
- Decree: 'Unravel — your Thread turns: Mend wounds. Switch to Empower until it passes.' Answers `['empower']`.
- A Snip during Unravel ends the reversed Mend, at the price of the lock.
- Under Stasis the reversed Mend waits: Mend heals, and the window resumes when Stasis ends.

**Double threat:** Unravel opens as a Shear comes, with one song stolen. You need Empower on the Thread **and** a Ward on the tank.

### Phase 3 (33-0%): Mirror Weave

Unravel stops, the stolen verse returns, and the Snip continues every 20 s.

- **The champion.** At entry, the Unweaver weaves the **Hollow Champion** and summons it. A mirror-coloured enemy Thread runs from the boss to it. While the boss lives, the champion is `emboldened` (×1.25 damage through `enemyDamageMult`) and heals 1% of its max HP a second. If it dies, it is re-woven 30 s later (`m3.nextChampionAt`).
- **Mirror Ward** `unweaver_mirror_ward`: an **interruptible** 2.0 s cast on the champion, every 14 s (9 s enraged). It gives the champion a `mirror` shield of 30% of its max HP for 5 s.
- **Decree:** 'Mirror Weave — the Unweaver Wards its champion as you Ward yours. Interrupt the Mirror Ward, and Focus the champion.' Answers `['focus']`.
- **Double threat:** two tank-busters can land on the tank within 2 s: the Shear at 945 and the emboldened champion's cleave at 700 × 1.05 × 1.25 ≈ 919. Together that is 1,864, against Kael's 1,600. A plain Ward (600 on Kael) leaves 1,264, so he survives at full life; with the boss row's ×1.15 Threat, 2,144 becomes 1,544, which he barely survives. A Perfect Ward, a Reel or Kael's dome answers one blow outright. With no answer, he dies. The champion's cleave is the first lever if W9 finds this too tight. The Mirror Ward cast asks for Focus at the same time.

### Adds

All have `movement: 3` and `material: 'cloth'`.

| Add | HP code / eff. | Body | Notes |
|---|---|---|---|
| `spindle` | 1,800 / 3,150 | support, `stationary`, bolt 25 per 2.0 s, r 14 | `tether {dr: 0.8}`; a tether beam to the boss |
| `stolen_verse` | 3,000 / 5,250 | caster, preferredRange 16 (kites), speed 4.4, bolt 20 per 2.0 s | an orb in the stolen aura's colour; its death restores the aura (`onAddDeath`) |
| `mirror_champion` | 12,000 / 21,000 | brute, speed 3.2, melee 100 per 1.4 s | `champion_cleave`: cleave `current`, r 3.4, 100°, windup 1.6, damage 700 (735; 919 emboldened), cd 11; answers ward, reel, move |

**Script hooks.**

- Every Decree is scheduled per phase, so a fast kill can't skip it (02 §7).
- Foresight's `scriptedNext` asks the registry for the next Snip, Unravel, Steal Verse, Unpick and Mirror Ward.
- Stasis advances every `m3` clock and every public `until` through `stasis(dt)`. `threadLock` keeps ticking through Stasis (`weaver.ts:107`), as today.
- `cleanup` deletes `m3`, `zones`, `unravel` and `stolen`.
- `bossPhaseTable` covers both bosses.

## Every mechanic, its verb and its answer

### By Calling

- **No Calling** and **Luminary** use the core kit.
- **Martyr** has Bear.
- **Chronomancer:** Reel's slot casts Rewind (`sighting.ts:30-33`), and Stasis freezes enemy clocks. **Paradox is an optional path pick** (`mods.paradox`, `rewind.ts:94`). Where it is listed, a Chronomancer without it uses the no-Calling answer in the same row.

| Mechanic | Verb | None / Luminary | Martyr | Chronomancer |
|---|---|---|---|---|
| Shears, Snip, Severing | Retarget | step or Glide across the line; Thread a hero on your side; Focus the Shears; Guard Strand; Taut Release softens a cut | same; a cut ends Bear and Scarred Hide (`health.ts:703`) until you re-thread | same; Stasis freezes the dash; Foresight shows the next Snip |
| Void Maw Inhale | Rally | Rally in the tell; Reel one out (not Swap); Anchor; Glide yourself | same; Bear shares the DoT | Rally in the tell; Rewind undoes the last 3 s of drag |
| Doubt Wraith | Chime | Focus (interrupt); Chime the mark (cancels) or the possessed hero (frees); a full Ward blocks it | same; Bear soaks the victim's wounds | same; Paradox, if picked, cancels the mark |
| Null rune | Glide out | walk or Glide out; plant first so the field still covers the party; Sunrise still works | the Vow still works | Stasis still works; Rewind is blocked inside |
| Mimic, Mimicking | vary / Focus | interrupt; vary to crack it; Mend instead of Empower | Bear isn't copied | Rewind leaves it nothing to copy |
| Doom-touched | Chime before 5 | Chime at 3-4 stacks; Ward the burst (a Perfect negates it); Focus the elite | Bear shares it | Chime, Ward or Focus; Paradox, if picked, cancels the burst |
| Needle Rain | move | dodge; Ward; Reel | same | Rewind |
| Stitch | Chime | Chime the link in its windup, or the pair after (radius 4); a Reel frees the one it pulls; a Ward blocks one hero's root | same | **Chime** (Rewind doesn't free) |
| Unpick | re-thread fast | Ward the raid; re-thread as the lock ends | same | same |
| Spindles, Stolen Verse | Focus | Focus | Focus | Focus |
| Unravel | Empower | Empower | Empower **or Bear** | Empower; Stasis pauses the harm |
| Shear, champion cleave | Ward | Ward, Reel, Kael's dome | Vow | Ward; Rewind; Paradox if picked |
| Mirror Ward | interrupt | Focus (interrupt) | same | same; Stasis freezes the cast |

**Luminary** loses the most to a theft, because Radiance counts aura bits (`health.ts:1141-1149`), and its hint says so.

### By party

Interrupt reach (see *Doubt Wraith*): Lyra seeks casters herself; Kael and Brann need the caster to be their target (Focus) or, for Brann, outside his minRange; Vexis interrupts only non-boss casters, by stun, through her Chimed call or a Cue.

| Party | Wraith and Mimic interrupters | Mirror Ward interrupters (boss, stun-immune) | Dome (Shear) | Ranged Thread vs Severing | Notes |
|---|---|---|---|---|---|
| default (Kael, Lyra, Vexis) | Lyra, Kael (Focus), Vexis (stun) | Lyra, Kael | Kael | Lyra, Vexis | reference |
| A (Kael, Vexis, Brann) | Kael (Focus), Brann, Vexis (stun) | Kael, Brann | Kael | Vexis | a bloodlusting Brann ignores Rally, so his Maw answer is Reel, Anchor or Rewind |
| B (Lyra, Vexis, Brann) | Lyra, Brann, Vexis (stun) | Lyra, Brann | none: `decreeNoDome` 'No Kael: Ward the hero he cleaves, keep a Reel for the second blow' (the docs/phase-5b.md:78 pattern) | Lyra, Vexis | no tank: the boss bands are ≥ default − 15 |
| C (Kael, Lyra, Brann) | all three | all three | Kael | Lyra | |

## Encounters and arenas

- Every encounter has `movement: 3`, and its enemies are of Movement ≤ 3 (`schema.ts:1471`).
- The filler is Movement I's `hollow_chorister` (chip damage, no extra verb, so bleed doesn't compete with Doom, Stitch and possession for the Chime), plus a few Legion enemies.
- Pars are derived in W9 as the Skilled average × 1.15, to the nearest 5 s.

| id | Kind | Arena | Waves (first draft) | Hints |
|---|---|---|---|---|
| `frayed_threshold` | skirmish (row 0) | rift_mouth | shears×2 + chorister×5 · shears×3 + chorister×5 · shears×3 + glass_lancer + chorister×5 | shears |
| `maw_hollow` | skirmish (lesson) | torn_nave | void_maw + chorister×6 · void_maw + glass_lancer + chorister×5 · void_maw×2 + shears×2 + chorister×4 | maw |
| `wraith_vigil` | skirmish (lesson) | rift_mouth | doubt_wraith + chorister×6 · doubt_wraith + bell_brute + chorister×4 · doubt_wraith×2 + shears×2 + chorister×4 | possess |
| `null_chapel` | skirmish (lesson) | torn_nave | null_priest + chorister×6 · null_priest + shears + chorister×5 · null_priest×2 + hemomancer + chorister×4 | null |
| `mirror_hall` | skirmish | mirror_loom | mimic + chorister×6 · mimic + doubt_wraith + chorister×4 · mimic + void_maw + shears + chorister×3 | mimic |
| `frayed_court` | elite (the only map elite) | mirror_loom | shears★severing + chorister×6 · null_priest★silencing + shears×2 + chorister×4 · impaler★doom_touched + void_maw + chorister×4 | thread, focus, doom |
| `unstitched_vanguard` | elite (event-only) | rift_mouth | shears★mimicking + chorister×6 · doubt_wraith★doom_touched + void_maw + chorister×4 · null_priest★severing + mimic + chorister×5 | mirror, doom |
| `the_seamstress` | miniboss | loom_hollow | the Seamstress (enrage 300) | stitch, needles |
| `the_unweaver` | boss | the_unwoven | the Unweaver (enrage 450) | decree |

Every new enemy, attack and affix appears somewhere, as the coverage test requires (`tests/sim/combat.test.ts:321-331`, widened in W0b to count payload `burst.attack` ids as used).

**Arenas** (`biome: 'abyssal_rift'`):

- `rift_mouth`: r 21, 3 broken-slab pillars;
- `torn_nave`: r 20, 4 pillars;
- `mirror_loom`: r 19, 4 pillars;
- `loom_hollow`: r 20, open;
- `the_unwoven`: r 22, open, for the Snip lines and the Verse's flight.

Floor: indigo stone `#1a1830` to `#17152a` (darkened ×0.78, `arena.ts:76`). Lines `#5c5a86`, accent `#1f6f6a` (ambient only), fog `#0a0a1c`.

## Rewards

**Motif** (appended last): **Guard Strand** `guard_strand`, Silk, rare, values [1.5, 1.0, 0.6] s, `requires {movement: 3}`.

- Text: 'Enemy bolts that cross your Thread are destroyed, and a Shears, Severing or Snip cut is turned aside, once every {v} s.'
- KNOWN_MOTIFS grows by one.

**Relics** (appended, `movement: 3`, added to KNOWN_RELICS; they sleep outside Rift fights):

- **Sacrificial Lamb** `sacrificial_lamb`, rare (03 §9.1): 'Once per encounter, a lethal hit on a hero is redirected to the healthiest other hero.'
- **Knotted Cord** `knotted_cord`, rare: 'Enemy cuts lock your Thread for half as long, and each cut gives you 10 Resonance.' It sets mods `cutLockMult` 0.5 and `cutResonance` 10. It affects cuts only; the range snap is untouched.
- **Stillwater Bell** `stillwater_bell`, legendary: 'Chime's cooldown is 2 s shorter. A Chime that frees a possessed or Stitched hero, or clears Doom, refunds half its Spirit.' It sets mods `chimeCooldownCut` 2 and `stillwaterBell` 1, and eases contention for the Chime.

**Events** (`movement: 3`, existing EventEffect kinds only, `schema.ts:715-737`):

- **The Loose Thread:** 'A single bright thread hangs from the rift.'
  - *Pull it:* fight `unstitched_vanguard`; a win offers 1 of 3 relics.
  - *Tie it off:* every hero heals 25%.
  - *Leave it.*
- **The Mirror Pool:** 'Your reflection offers a trade.'
  - *Look deeper:* a chosen motif gains a level, and every hero loses 15% of their life.
  - *Pay 50 Aether:* a rare relic.
  - *Walk on.*

**Deeds** (0-point badges; the ladder keeps exactly 10 point Deeds; the count goes 23 → 25):

- *Whole Cloth*: beat the Unweaver with no hero down.
- *Needle-Sure*: beat the Seamstress with an S.

## Content lint (new rules in `lintMovements`, `schema.ts:1422-1520`)

- An attack or affix with `cut` lists `thread`, and a `cut` beam uses `threadLine`.
- A mark whose payload is `possessed` is `interruptible`, has an ailment markStatus, and lists chime and focus.
- `linkStatus 'stitch'` lists chime, and its link radius is ≥ the arena diameter.
- A `pull` zone lists stack or reel, and its `pullSpeed` is below the Weaver's moveSpeed.
- A `null` zone uses `centre:'weaver'` and lists move.
- A payload with `burst` names a mark attack that lists ward and chime, has an ailment markStatus that differs from the payload's own id, and is in no enemy's specials.
- A `tether` enemy is summoned by a boss attack.
- A `stationary` enemy has no `move` attack.
- Affix `specials` resolve to real attacks.
- Effects `zone`, `mimic` and `script` are allowed at damage 0 (root refine, `:1651`).
- `requires.movement` and relic `movement` are ≤ `movements.length`.
- `threadLine` and `allyEnemy` are in the targeting tables (`schema.ts:1399`).
- Biome: `'abyssal_rift'` joins one BiomeSchema, and `ArenaDef.biome` becomes `BiomeSchema.optional()` (`schema.ts:1286, 1326`), so the two lists can't drift.
- Material gains `'cloth'`.

In `tests/sim/m1Unchanged.test.ts:104-117`, the forbidden-key lists gain every new key, for Movement I **and** Movement II defs: `cut`, `zone`, `stationary`, `tether`, `burst`, affix `specials` and `suppressRadius`, `requires.movement`, relic `movement`.

## Presentation

### Biome: the Abyssal Rift (`src/render`)

- **Tables, not if-chains.** `arenaLook` and `arenaMood` (`crimsonCues.ts:86-141`) become biome tables with an 'abyss' row, so the Finale's 'celestial_crucible' is one more row. The Spire rows are snapshotted first.
- **The abyss mood:**
  - sky `#1b1a3a`, hemi 0.5;
  - a pale moon key `#cdd8f5` at about 1.5;
  - a rim from the rift tears in a cold, desaturated blue-teal (`#3c6f8a`) at ≤ 0.45, from the far −z side only, so it agrees with the rim light at (-12,10,-16) (`stage.ts:62-64`);
  - fog `#0a0a1c`, near 34, far 80.
- **Teal is Mend.** The naive fray teal `#2dd4bf` is ΔE 0.0 from Mend, and a teal rim would make every hero look Mended. Fray teal stays ambient and off the combat disc. A test asserts that no ABYSS_HEX entry is within 20 ΔE of Mend or shield on the disc.
- **ArenaView** (`arena.ts:46-66`) switches on `look`. The new pieces swap one for one, so the mesh budget holds at 7/6 (`tests/renderMovement2.test.ts:489`):
  - `createRiftFloor`: stitched indigo cloth over stone, seams in the line colour, low contrast, no teal on the disc;
  - `createRiftRim`: floating slabs and torn hanging cloth;
  - `createRiftTears`: one additive card mesh in the torch slot, renderOrder 12;
  - `createFrays`: one Points of drifting fray motes in the ember slot.
- Tears and frays hide on low quality (`arena.ts:760-766`).

### Models

`buildUnstitched` runs before the role fallback (`library.ts:252`) and uses only ModelBuilder primitives (`builder.ts:31-91`):

- **Shears:** low, two crossed blade boxes, fast.
- **Void Maw:** a floor-level torus mouth with an inner cone of teeth; it pulses with the Inhale.
- **Doubt Wraith:** a tall, legless lathe cloak with a glowing hollow hood; a hover gait.
- **Null Priest:** robed, with a rune-torus halo.
- **Mimic:** a faceted octa mirror.
- **Seamstress:** many arms, needle cones and a spool.
- **Unweaver:** hooded, with giant shears and a spindle crown.
- **Spindle:** a lathe spindle.
- **Stolen Verse:** an orb tinted per instance with the aura's colour, through the rim tint.
- **Hollow Champion:** an elite body with mirror trim.
- **`buildRiftPillar`:** a broken slab stitched with thread.
- **Cloth death:** unravelling strands (PARTICLE.spark streaks), fray motes and indigo smoke, beside `ironDeath` (`feedback.ts:2458`). Never red mist, never porcelain shards.

### VFX (`src/render/riftCues.ts`, new and pure)

`riftCues.ts` holds RIFT_HEX (semantic), ABYSS_HEX (ambient), `riftStatuses`, `shearsCrossing`, `stitchedPairs` and `doomPipOffset`. Everything below is a new *style* inside the existing 12 batches (`fx/kit.ts:39-98`), with no new draw calls:

- SPRITE: scissors, doom pip, mask, rune, mirror and needle;
- RING: rune and swirl;
- BEAM: stitch;
- SHELL: mirrorWard, an inverted hexagon, never Ward's pale cyan.

By mechanic:

- **Shears and Snip:** a dotted line, plus a scissors marker where the line crosses the live Thread ribbon.
- **A cut Thread:**
  - a frayed stub at the Weaver's hand, with a SPRITE.timer lock ring for `threadLock`;
  - a 'CUT' or 'UNPICKED' callout in a fray colour, instead of the grey 'SNAPPED' (`feedback.ts:582-597`), which stays for range snaps;
  - a spark at the crossing for `cutResolved 'strand'` (Guard Strand).
- **Void Maw:** a RING swirl of r 8 that tightens in the tell, inward particles during the pull, and drag streaks on pulled heroes.
- **Null rune:** a RING rune (a glyph-ringed circle in bone `#e8e3c8`), shape-distinct from the Mute's dashed MUTE_GLASS ring, because bone collides with Weaver gold and Lyra under tritanopia.
- **Possession:**
  - a model rim in `#4b3fb8` (min ΔE 22.4), ranked **above** threaded in the rim priority (`entities.ts:1370-1410`);
  - a mask sprite;
  - a dashed tether from the Wraith (the latch beam, `entities.ts:2456-2464`);
  - swipe or shot streaks toward the victim.

  Never enemy-bar red, never Focus gold.
- **Doom:** pips counting to 5 on the bleed pip arc (`pipOffset`, `crimsonCues.ts:288-294`), lethal-tinted at 4, with Chime and Ward badges. The ignition is a mark.
- **Stitch:** a cross-stitch beam for the link, then a sewn tether between the two `stitched` heroes that share a source.
- **Mimic:**
  - a mirror shimmer to the beneficiary, and the copied icon over it;
  - SHELL mirrorWard for a copied Ward;
  - emboldened as a shimmer, never gold (04 §1 rule 4: gold means 'the Weaver did this');
  - 'MIRROR CRACKED' as a glass burst.
- **Unravel:** a Thread core `#0f0b1a` (≥ 26.8 ΔE from Bear and every rule colour), live-lethal barbs, and beads flowing **forward** (Bear flows backward, `thread.ts:89-93`), plus a 'minus' state of SPRITE.mode. Its ticks show as lethal damage numbers, never heal teal.
- **Spindles:** tether beams to the boss, and a plating shell on it.
- **A stolen aura:** a hollow halo slot, and an aura-coloured pour back on the kill.
- **Champion:** a mirror Thread beam from the boss, and the Ward shell.
- **Counters:** `drawnM3` and `firedM3` prove that a Movement I or II fight draws none of it.

### Audio (`src/audio`; D dorian, 88 BPM, `theory.ts:7-17`)

- **Voicing table.** A per-biome voicing table replaces `get crimson()` and `progressionFor(mood, crimson)` (`music.ts:122-135, 235-237`). The crimson and reliquary output is snapshotted first.
- **The Abyss:**
  - `PROGRESSION_ABYSS` (Dsus2–Em7–Bø7–Am7) and `_BOSS`;
  - `MELODY_ABYSS`;
  - a glass-harmonica pad;
  - a needle-tick pulse tuned to D and A;
  - a detuned plucked-string melody;
  - a void-wind bed with distant tearing, on the ambience bus.
- **Unweaver stems** on `bossPhase` + `apex`:
  - phase 2: the choir stem drops while a verse is stolen, and the melody mirrors about D during Unravel (D dorian maps onto itself about D, so every note stays in key);
  - phase 3: a mirror canon.
- **Seamstress:** a phase-2 pickup.
- **SFX:** `UNSTITCHED_SOUND_GROUPS`, `LIMITS` and `ATTACK_SOUNDS` (the LEGION pattern, `sfx.ts:194-283`):
  - Shears: a 'shhk' dash, and a cut sound instead of `snap()` when `cause` is set (`sfx.ts:1142`);
  - Maw: a gated sub drone and an inhale whoosh;
  - Wraith: a whisper swell across the cast, possession on the E–F and B–C half-steps, and glass when freed;
  - Null: a rune hum, and a muffled 'silenced' rejection distinct from the cooldown sound (`sfx.ts:811-815`);
  - Mimic: your own technique sound played back mirrored, then a shatter on a crack;
  - Seamstress: a needle patter, a stitch pull-tight, an Unpick ripple of snaps;
  - Doom: a rising tick per stack, then the ignition;
  - Unweaver: a Spindle drone, the steal and return, the Unravel inversion, the mirror-glass Ward;
  - a cloth kill: a tearing noise sweep (`sfx.ts:1930`);
  - windStyles for the `thread` and `empower` glyphs.
- **Biome.** `setBiome` accepts 'abyssal_rift', and an unknown biome falls back to reliquary.
- **Fermata.** Fermata's `hold()` (`music.ts:249-261`) is not repurposed: the Grand Silence belongs to the Finale.

### UI (`src/ui`, `src/input`)

- **STATUS looks** (`labels.ts:53-155`), each with its answer:
  - possessed: 'Chime frees them; Focus the Wraith before its cast ends';
  - doom: '×N/5 — Chime, or Ward the blast';
  - doomed: 'Ignited — Chime, or Ward it';
  - stitched: 'Chime frees both';
  - voided: 'Rally or Reel them out';
  - unravelled: 'Your Mend wounds — Empower';
  - doubt;
  - emboldened (enemy).
- **Icons:** scissors, needle, spindle, mask, rune, mirror and maw (`kit/iconPaths.ts`, overlay ICONS).
- **Party frames:**
  - possessed: an indigo border, a 'Possessed' label, the Chime glyph and an arrow to the victim;
  - stitched: an icon joining two frames;
  - Doom: ×N/5, emphasised at 4.
- **WeaverBar:**
  - **Per-key silence.** `slotState(t, silenced)` (`techniqueState.ts:20-35`) applies one boolean to every slot, and `WeaverBar.tsx:147` passes `w.downed`. The bridge adds `runeLocked` (from `weaverSilenced`), and each TechniqueButton gets `silenced={w.downed || (runeLocked && RUNE_KEYS.has(t.key))}` with `RUNE_KEYS = {ward, chime, reel}`. **Glide never greys.** The rune-lock overlay shows only on those three.
  - The Thread chip (`threadMode.ts:60-90`) reads 'Cut · 3.0 s (Snip)' vs 'Snapped', and 'Unravelled · 5 s' with the Empower glyph.
  - A stolen aura shows hollow, with a Focus pointer.
- **BossBar:**
  - The hard-coded Bloodmoon line (`BossBar.tsx:145-172`) becomes a list of boss conditions built from optional BossHud keys (`store.ts:404-416`), each with a glyph and words: `spindles?` ('Spindles ×N · −80%'), `stolen? {id,name}`, `unravelLeft?`, `mirrorWard? {casting, upLeft}`, `champion? {hp,maxHp}` (a mini bar) and `stitched?`.
  - CAST_ICON gains needle and shears (`legionLook.ts:31-38`).
  - No Movement III attack carries `executeBelow`, so EXECUTE_PCT (`legionLook.ts:28-30`) stays right.
- **Hints** (`hints.ts`):
  - a Shears path crossing your Thread → Retarget;
  - a cut → re-thread as the lock ends;
  - an Inhale tell → Rally ('Swap puts you in the Maw' when the Reel variant is Swap);
  - possessed → Chime;
  - a Wraith casting → Focus;
  - in a rune → Glide out. This is a **separate** technique-silence hint, not the Mute's aura 'silenced' hint (`:297-302`);
  - Doom 4+ → Chime or Ward;
  - Unravel → Empower;
  - Spindles, the Verse, the Mirror Ward → Focus;
  - a Mimic casting your Ward → cast something else.
- **First sighting:** Calling-aware Movement III lessons (the `legionLesson` pattern, `sighting.ts:34-88`).
  - On a Chronomancer run, the Maw card says 'Rewind takes back a hero you lost to the pull'.
  - Paradox lines appear only when Paradox is held.
  - Guard Strand is never taught unless it is held.
  - Party-aware wording goes through `shownAnswers` (`render/crimsonCues.ts:470`, `ui/hud/legionLook.ts:120`).
- **Recaps** (`resultText.ts:47-135`):
  - 'Lyra, struck by Kael (possessed): Chime frees them';
  - 'Doom: Chime before five, or Ward the burst';
  - 'Pulled into the Maw: Rally or Reel';
  - 'Snip: Retarget off the line';
  - 'Your Mend, unravelled: switch to Empower'.

  100% of downs name an answer.
- **Map:**
  - a biome → tone map with a new Backdrop tone `'abyss'` (indigo glow, a faint fray), replacing the ternary at `MapScreen.tsx:153` (`kit/Backdrop.tsx:20-30, 89`);
  - a MovementCard styled per biome;
  - ENCOUNTER_ICON `the_seamstress` (needle) and `the_unweaver` (shears) (`routeText.ts:243-246`);
  - VICTORY `the_unweaver`: 'The Unweaver falls, and the Rift knits shut.' (`:163-166`).
- **Reliquary:** a sleeping Rift relic shows 'Wakes in the Abyssal Rift' on its card and in the carry picker.
- **Input:** the 3 s last-threaded fallback after an **enemy** cut (`threadSnapped.cause` present). `runtime.ts:105` already maps 'silenced' to text.
- **Labs:**
  - VfxLab: `UNSTITCHED_SCENARIOS`, `__VFX__.unstitchedScenarios/unstitchedScenario/unstitchedStats`, `gallery3`, and overrides for zones, unravel and stolen.
  - UiLab: a 'Movement III' group, with a mock map that appends rows 17-22 and flips Vharun to an interlude (`ui/lab/mock.ts:3065-3140`).
  - AudioLab: an Abyss biome row, Unweaver phase audits and an 'unstitched' sound group.

## Bots and harness

**Readers** (`src/bots/common.ts`). They read only public state and content, and return null when the mechanic is absent:

- `threadSegment` and `cutWouldLand(t, slot)`, both from `rules3.ts`;
- `hazardZones`, `inNullZone` and `runeEscape`;
- `inhaleTell`;
- `isPossessed`, `isStitched` and `doomStacks`;
- `mimicCasting` (with its copy);
- `spindlesUp`, `stolenVerse`, `champion` and `mirrorWardCasting`;
- `unravelUp`;
- `suppresses(e)`, which replaces `defId === 'mute'` (`skilled.ts:519`). In Movements I and II only the Mute qualifies, so `find()` order is preserved;
- `DOOM_CHIME_AT = 4`, beside BLEED_CHIME_AT (`:169`).

`laterMovement` (`:223`) is unchanged; Movement III habits are gated on their mechanic.

**Skilled** is RNG-free. Every branch is gated on its mechanic's presence, and existing comparisons are never reordered.

| Mechanic | Skilled |
|---|---|
| Shears, Snip | When a `cut` line's impact is ≤ 0.5 s away and `cutWouldLand`: re-thread to the most urgent hero whose segment is clear, else step across, Gliding if the impact is under 0.4 s. Re-thread the moment `threadLock ≤ 0` (`:408-415`). |
| Severing | Never thread a hero within 3 m of a Severing elite unless they are the only hurt hero. |
| Null rune | `position()` treats zones as negative after the pool and hymn snap (`:575-581`) and steps out of a closing rune. While inside, Glide out before any technique, and never set `acted` on a cast the sim would refuse. Plant a Pedal Point when a rune forces the Weaver 8+ m from the party. |
| Void Maw | In the tell: Rally when ≥ 2 heroes are inside and the Weaver is outside; Hold for a bloodlusting Brann. Reel the lowest hero inside (never with the Swap variant), or Rewind one who was pulled in. The Weaver never stands inside. |
| Chime order | clutch Dirge > possessed > doubt mark (cancels) > stitch link / stitched > doomed or Doom ≥ 4 > bleed 5+ cluster > the rest (`:247-284`). It is a tuning lever, and each rule is ablated in `tools/verbs.ts`. |
| Ward | A `doomed` hero and a possession's target count as wardWorthy. While a Mimic casts a Ward copy, skip non-lethal Wards, or cast Chime if it is useful, to crack it. |
| Mimic, Empower | While a Mimic casts an Empower copy and no Unravel is up, switch to Mend. Never Empower a possessed hero. |
| Unravel | Switch to Empower within 0.25 s of the window opening (Bear for a Martyr), and back after. |
| Focus | The existing chain is kept exactly: `cast?.interruptible` (which already covers the Wraith, the Mimic and the Mirror Ward) → Mute → crowd-guarded Sentinel. One new call, `m3FocusTarget(state, enemies)`, sits right after the interruptible step. It returns undefined unless a Movement III target is on the field, and otherwise picks Spindle > Stolen Verse > champion > Null Priest > `suppresses`. Each step has a `SENTINEL_FOCUS_AT`-style crowd guard (`:80`), measured by ablation before it ships. The commandSnapshot proves the chain is unchanged. |

**Novice.** It draws only while the mechanic is present:

- Chime a possessed or stitched hero: 0.5;
- Chime Doom at 4+: 0.5;
- step out after a 'silenced' fizzle: 0.3;
- Rally on an Inhale tell: 0.3;
- switch to Empower under Unravel: 0.4;
- re-thread after a cut: already 0.7 (`novice.ts:96`).

Its heal-the-lowest reflex is what the Shears, Unravel and the Mimic punish. No new draw happens on a Movement I or II path.

**`SkilledOptions.skip?`** (verb ablation) is absent by default, so the default options object is unchanged.

**Harness** (`tools/harness-core.ts`):

- `EncounterRun.m3?: VerbTally3`, key-absent outside Movement III:
  - threadCuts by cause and by `cutResolved.result`, reattachDelay;
  - possessions, possessFreed, possessInterrupted, wardBlockedPossess;
  - runeTime, silencedRejects;
  - mawTime, inhaleRallies;
  - doomIgnitions, doomCleanses (stacks at the Chime);
  - stitchTime;
  - mimicCopies by kind, mirrorsCracked;
  - spindleUptime, unravelHarm, versesRecovered, mirrorWardsInterrupted.
- Damage to party targets (possession) is excluded from `weaverShare` and partyDamage.
- MAX_PHASES 240 (`:489`) is asserted against the measured maximum; about 95 is expected for three Movements.
- `playRun(opts.start?: RunState)` resumes recorded Vharun interludes as real arrivals.

**Kit.** `tools/kits.ts` adds **ARRIVAL3_KIT** (id `'arrival3'`):

- the Guardian preset;
- ARRIVAL_KIT's 6 motifs, plus da_capo, golden_filament, second_verse and standing_ovation at L1;
- ARRIVAL_KIT's 2 relics, plus star_chart, hollow_bell, cantors_hymnal and choirmasters_baton.

That is 10 motifs and 6 relics, against the measured Skilled winners' 10.2 motifs and 9.1 relics at the Vharun interlude, so it is a floor. `defaultKit` returns `'arrival3'` for Movement ≥ 3, and ARRIVAL_KIT is never edited.

**Tools:**

- `harness.ts`: per-Movement band tables, a 'won ÷ reached III' column, and a Movement III verbs line.
- `m1-baseline.ts --movement 3` → `tools/m3-baseline.json`.
- `expedition-baseline.ts --movements 3` → `tools/expedition3-baseline.json`. Both are written at the end of the slice, and the movements-2 table stays.
- `decrees.ts`: per-boss tables.
- `brann-bands.ts --movement 3` and `--runs --movements 3`.
- `pacing.ts`: generalised to N Movements (`:125`), with a 'Finale budget' line.
- `loadouts.ts`, `relics.ts` and `astrolabe.ts`: kit by Movement.
- `callings.ts` (or `harness --calling`): Movement III rows.
- `sim-bench.ts`: an Unweaver phase-3 peak scenario.
- New `tools/verbs.ts`: ablation.

**Goldens**, appended after `novice-brann-first-light` so the 11 don't move:

- `skilled-unstitched-threshold` (ARRIVAL3, 2,400 ticks);
- `novice-seamstress` (5,400);
- `skilled-unweaver` (ARRIVAL3, 18,000), which joins the replay round-trip (`tests/sim/determinism.test.ts:52-57`);
- `skilled-brann-mirror-hall` (party B, ARRIVAL3, 3,600).

All 15 are pinned as literals at the end.

### Bands (ARRIVAL3_KIT, 50 seeds a cell; whole runs 200; met only on all 3 seed sets)

| Content | Idle | Novice | Skilled | Skilled share | Skilled length |
|---|---|---|---|---|---|
| Movement III skirmishes | ≤ 10% | ≥ 55% | ≥ 85% | ≥ 35% | 40-65 s |
| `frayed_court` | 0% | 30-65% | ≥ 85% | ≥ 35% | 55-85 s |
| The Seamstress | 0% | 30-60% | ≥ 90% | ≥ 35% | 70-120 s |
| The Unweaver | 0% | 25-55% | ≥ 80% | ≥ 30% | 180-280 s |
| Whole I-III Expedition | 0% | won 3-10%; won ÷ reached-III 20-50% (pooled, ~600 runs) | won ≥ 60%; won ÷ reached-III ≥ 75% | — | — |
| Parties A, C (M3 cells, bosses) | — | — | ≥ default − 5 | ≥ 35% / 30% | — |
| Party B at the bosses | 0% | ≥ 10% | ≥ default − 15 | ≥ 30% | — |
| Callings (Unweaver, Skilled) | — | — | ≥ 75% each for none, Luminary, Martyr, Chronomancer (with and without Paradox) | — | — |
| Default party, Movements I and II | **identical to the W0a baselines** | | | | |

- **Reach-III is fixed by Movements I and II.** It equals today's 2-Movement won rate (Skilled about 78-80%, Novice about 15.5%) and can't move in this slice. That is why the whole-run bands are conditional, stated up front (unlike 5a's reach-II surprise, docs/phase-5a.md:595).
- **Decree gate** (`tools/decrees.ts --boss`): every Decree is seen ≥ 2 times in a Skilled fight and answered ≥ 80%. 'Answered' means:
  - Snip: `cutResolved.result` is 'held' or 'strand' (counted only when it isn't 'none');
  - Spindles: all dead within 25 s;
  - Steal Verse: the verse recovered by a kill;
  - Unravel: reversed-Mend damage < 5% of the target's max life;
  - Mirror Ward: interrupted, or the champion dead within 45 s;
  - Stitch: the link broken in its windup, or freed before the next needle;
  - Unpick: no down within 4 s, and re-threaded within 1.0 s of the lock.
- **Accepted Idle exceptions.** Idle never threads or casts (`src/bots/index.ts:7-12`), so the Thread Decrees (Snip, Unpick's re-thread, Unravel) are N/A for it, like 5a's Twin Cleave 13% (docs/phase-5a.md:606). Passive pressure keeps Idle at 0%: Shears dashing at the farthest hero, the Shear, the needles, the Spindles dragging the fight into the enrage, and the champion's cleave.
- **Possession pressure.** Victim reach is max(5 m, the hero's attack range), so a spread party still takes the lash. W9 reports possession damage per party as a check.
- **Seed sets:**
  - cells: 1000, 500003 and 777001 (+ i·7919);
  - runs: 2000, 900007 and 333003 (+ i·104729);
  - pacing: 9001 and 77003.

  A band is 'met' only on all three; otherwise it is 'seed-sensitive: k of 3' (docs/phase-5b.md:452).

**Tuning order:**

1. Isolated cells on ARRIVAL3_KIT, authored numbers ±20%. Wave head counts are the documented exception lever (docs/phase-5a.md:540-547).
2. A bot-fix round through `tools/verbs.ts` ablation, to catch a SENTINEL_FOCUS_AT-style bug before tuning around it.
3. A sweep of `scale.life` 1.5-2.1 and `scale.damage` 0.95-1.15 on whole I-III Expeditions, 200 seeds a step.
4. Par = Skilled average × 1.15.
5. Rewards set so that XP per **combat** minute in Movement III is within ±15% of Movement I (docs/phase-5a.md:619).

Levers, in order: the Shears windup (1.0-1.2), the Inhale pull speed (2.0-2.8), possession damage (×0.4-0.6), rune life (5-7 s), the Mimic's shield (20-30%), the champion's cleave (550-700), Spindle life, Verse life and the Snip cadence. **Weaver, hero and aura numbers never move.**

### Pacing

- **Today.** A Skilled Expedition models at 28.4 / 27.7 minutes (Movement I 17.1 + Movement II 11.3). Vharun's interlude adds about 1 minute in a 3-Movement run (relic 15 s + draft 20 s + result and map, `tools/pacing.ts:35-46`).
- **Movement III target:** 9-11 modelled minutes, 6-7.5 of them in combat (opening ~45 s, lesson ~55 s, elite ~70 s, Seamstress ~95 s, Unweaver ~240 s).
- **Expedition target:** a Skilled I-III Expedition at **≤ 40 modelled minutes** (stretch ≤ 38). That leaves the Finale almost no room inside the roadmap's 30-40 (06:121), as docs/phase-5a.md:702 foresaw.
- `pacing.ts` prints the Finale budget (40 − I − II − III). The shortening decision is question 7 above. This slice doesn't shorten Movement I, because that breaks expedition-baseline and 'Movement I is the Prelude's map'.

## Determinism and invariance guards

- **Goldens.** The 11 goldens stay byte-identical and 4 are appended; SIM_VERSION stays 22. The update-golden dry run may show only the new names and `contentVersion`.
- **Baselines** stay byte-equal at every merge:
  - `m1-baseline --check` and `--movement 2 --check`;
  - `expedition-baseline --check` at movements 2 (the I-II pin, kept forever);
  - preludeSnapshot, draftSnapshot (it now covers the gated motif and relics), commandSnapshot and rosterInvariance.
- **m1Unchanged:**
  - 11 literals;
  - Movement I **and** II defs gain no new key;
  - Movement I and II fights show no `m3`, `zones`, `unravel`, `stolen`, `tethered`, `mimic` or `emboldenedUntil` key at any tick (sampled every 60 ticks).
- **Sleeping relics.** A Movement I fight and a Movement II fight, each with and without the three Rift relics added to `config.relics`, give equal `world.mods` and equal event streams, and the fight's hash differs only by the config field. With Guard Strand in the loadout, a Movement II fight's events equal those without it.
- **Exact-shape helpers:**
  - `enemyDamageMult` returns `c.damageMult` itself when not emboldened (asserted with `Object.is`);
  - `suppressRadiusOf` equals `def.suppressRadius` for every M1/M2 def;
  - `specialsOf` returns `def.specials` by reference when no affix has specials;
  - `isRooted` equals `hasStatus(pinned)` on M1/M2 fights at every tick.
- **Reach-III equals won-II.** For every seed where a 2-Movement run won, the 3-Movement run's results through Vharun are equal, except for Vharun's reward and `wonRun: false`.
- **Route default.** `routeMovements` now returns `EXPEDITION_MOVEMENTS`. The only callers that use the default (`runStore.ts:291, 306`, `profileStore.ts:384`) are updated in W4. The e2e smokes (`e2e/smoke.spec.ts:261-312`) are updated in W8, and `tests/meta/expedition.test.ts:482-483` reads `EXPEDITION_MOVEMENTS`.
- **Without-you.** With `config.absent`: the Mimic and the Null rune don't cast; the Snip and the Shears still dash and damage but cut nothing (`cutResolved 'none'`); Steal Verse and Unravel are no-ops. The 450 s enrage ends inside the 600 s cap.
- **Render and audio.** The Spire and Reliquary moods, models and audio output equal the W0a snapshots, and `drawnM3` and `firedM3` are zero on Movement I and II fights.

## Tests

**`tests/sim/movement3.test.ts`** (Weaver side, W1):

- A cut needs a crossing at resolution. `threadSnapped.cause` and lock; Snip lock 3; Knotted Cord halves cuts only and grants 10 Resonance; Taut Release fires on a cut.
- The range snap's event order is unchanged.
- **Unpick's event stream** is pinned: `cutResolved 'cut'` and `threadSnapped {cause:'unpick'}`, even when the raid hits nobody (all invulnerable).
- Guard Strand turns a cut aside (`'strand'`) and destroys a crossing bolt at its cooldown, and never refuses Unpick.
- The rune refuses Ward, Chime, Reel and Rewind with 'silenced', and lets Glide, plant, mode, Cue, Crescendo and the Directives through. `canCall` refuses Ward and Chime calls inside it. readyTechniques drops the silenced techniques.
- `cue` refuses a possessed hero, and `tendCall` cancels on possession (both staged with `addStatus`).
- Unravel harms only Mend, holds the revive channel, and leaves Bear and Empower alone. **Under Stasis**, Mend heals and `until` advances.
- A stolen aura gives 0 mult and no mask bit, and `chorusPulse` counts one aura fewer. `reservedSpirit` and `reservedLife` are unchanged, Sovereign is unchanged, and CONTENT.auras deep-equals itself.
- Sleeping relics: Stillwater Bell, Knotted Cord and Sacrificial Lamb in a Movement I or II config leave `world.mods` equal to the config without them, and they work in a Movement III fight.

**`tests/sim/movement3Enemies.test.ts`** (enemy side, W2):

- The Shears cut only when the line crosses.
- The Inhale:
  - a 1.4 s tell, then a 4 s pull at 2.4 m/s;
  - it skips anchored, rooted, mid-Reel and gliding entities;
  - Stasis freezes it, and the zone dies with its owner.
- The Wraith and possession:
  - a Chime on the mark cancels; an interrupt cancels; a full Ward blocks; Paradox cancels;
  - a possessed hero ticks on the nearest hero within max(5 m, its range) and never on the Weaver;
  - a possessed Lyra hits an ally 12 m away;
  - no ledger credit and no lifesteal;
  - a Chime frees them, and `isDisabled` holds while possessed.
- Doom:
  - it ignites at 5 into a `doomed` mark;
  - further hits during the mark start a fresh Doom count and never a second burst;
  - a Chime cancels the mark, a Ward absorbs it, and the elite's death drops it;
  - **Doom never lands on the Weaver**.
- Stitch:
  - a Chime in the windup breaks the link: no root, and a `telegraphResolved` is emitted;
  - a landed Stitch roots both heroes;
  - a Chime frees both, and a Reel frees one;
  - a Ward on one hero blocks that hero's root;
  - **a stitched hero doesn't dodge-step** (`heroes.ts:1382`), and **a stitched Brann doesn't leap** (`blood.ts:355`).
- The Mimic: its copy order; the crack; no cast with `'reel'` or null; `mirror` shields never getting Halo; **Mimicking's cooldown is 12 s × cooldownMult**.
- Unravel turns off the bleed-out freeze (`statuses.ts`).
- Severing cuts at most once per 3 s. A Silencing dome works per entity, and Warden's Key ×3 applies on it.
- The Movement I and II Vanguard pools as exact arrays.

**`tests/sim/scripts3.test.ts`** (the scripts2 style):

- the exact `bossPhaseTable` for both bosses;
- needle impacts 0.7 s apart ±1 tick; the Unpick cadence and its follow-up;
- the Snip cadence and verdicts; the Spindle ×0.2 and its recount;
- Steal Verse: the return on the kill, the 30 s escape and phase 3; the Unravel window;
- the champion re-woven after 30 s, and emboldened damage 919 ±1;
- the Mirror Ward interrupted and landed;
- both enrages; `setBossHp` drives the phases (`commands.ts:162-168`); Stasis freezes every clock; `endEncounter` leaves no key.

`scripts.test.ts` and `scripts2.test.ts` stay unchanged and green.

**`tests/meta/movement3.test.ts`:**

- 23 rows, unique ids, every node reachable. Rows 0-16 equal `generateMap(s,2)` except Vharun's.
- **Over 40 seeds**, row 19's elite is `frayed_court` and has a Severing, a Silencing and a Doom-touched spawn. `unstitched_vanguard` is reachable through The Loose Thread.
- Vharun's interlude: relic → draft → map, heal 0.5, 63 Aether.
- Only the Unweaver sets `wonRun`, RUN_WIN_XP, the win bonus, Tears and the win Deeds.
- Movement III Threat starts at 1.0. Unforgiving rewrites the Movement III respite.
- A 2-Movement v5 save keeps Vharun final; a Prep-phase save upgrades.
- The gated pools are absent from Movement I and II offers and shops over 40 seeds, and present in Movement III and at Vharun.
- A synthetic 4th def through the new `generateMapFrom` makes the Unweaver an interlude.
- `tests/meta/expedition.test.ts:482-483` → `EXPEDITION_MOVEMENTS`.

**`tests/content.test.ts`:** a rejection case for each new lint rule; deeds count 25. The Brann-motif assertions at `:150-156` find their motif by id, not `.at(-1)`.

**`tests/bots.test.ts`:**

- Staged Skilled rules: retarget before a cut; Rally in the tell; no Swap-Reel out of a Maw; Chime a possession and never Empower it; leave a rune; Chime Doom at 4; Chime a Stitch; the Focus order; Empower in Unravel; re-thread within lock + 0.1 s; interrupt the Mirror Ward.
- The Novice draws only with the mechanic present.
- Smoke: Skilled clears `frayed_threshold`; Idle loses both bosses; `movementEncounters(3)` exact.
- In play: each Unweaver Decree answered ≥ 80% over 12 seeds.

**`tests/harnessTools.test.ts`:** `playRun(movements 3)` with `minutesByMovement` of length 3; the reach-III = won-II invariance; the VerbTally3 keys.

**Presentation:**

- `tests/renderMovement3.test.ts`:
  - the Spire snapshot is unchanged;
  - M1 and M2 draw no M3 cue;
  - every M3 enemy has its own body;
  - mesh count 7/6;
  - FX peaks under capacity on every tier;
  - a floor-vs-ailment-telegraph lightness check.
- `tests/colorVision.test.ts`:
  - RIFT_HEX ≥ 20 ΔE vs lethal, threat, Bear, Mend and Empower, in every vision;
  - the four affix colours vs ailment and heal;
  - heroes vs the `movement === 3` environment (a copy of `:214-264`);
  - ABYSS_HEX never near Mend or shield.
- `tests/audioPhase5c.test.ts`: the abyss stems 94-100% in key; crimson and reliquary unchanged; rate limits on the new groups; 'silenced' distinct from the cooldown sound.
- `tests/uiPhase5c.test.ts`:
  - BossHud keys only in Movement III;
  - the per-key rune lock: **Glide stays ready inside a rune**;
  - the Cut and Unravelled chips;
  - the derived route copy, with the Prelude `routeHint` and title strings unchanged, and the Expedition hint naming Movements I–III;
  - no Guard Strand or Paradox text without it;
  - Calling-aware sightings;
  - the input fallback only after an enemy cut;
  - the sleeping-relic label.

  `tests/uiPhase5.test.ts:270-274` is updated.

**e2e** (`e2e/smoke.spec.ts:239-315`):

- Vharun → relic → draft → map;
- `warpMovement(3)` → `frayed_threshold` → win;
- `warp('boss')` → the Unweaver → Summary (victory);
- `winRun` walks to the Unweaver, with `movements: 3` in the `movement()` checks;
- a Movement III title card is asserted.

The Prelude smoke is unchanged.

## Exit criteria

1. **Movements I and II and the default party unchanged:** every guard above holds.
2. **Bands met**, including the Decree gate, Parties A, B and C, and the Callings, on all three seed sets. Otherwise each miss is reported as seed-sensitive or missed, with its cause. A Skilled Unweaver fight lasts 180-280 s.
3. **Pacing:** Movement III at 9-11 modelled minutes; a Skilled I-III Expedition at ≤ 40; XP per combat minute within ±15% of Movement I; the Finale budget printed.
4. **Readability:**
   - every Movement III threat shows its glyph on its telegraph, zone, badge, cast bar or first-sighting card;
   - 100% of downs name an answer;
   - no Weaver input is blocked without a visible lock and a stated way out, and Glide never shows as blocked;
   - a cold read of the first-sighting cards scores ≥ 4/5;
   - the ΔE tests pass.
5. **Every Calling and party has an answer** for every mechanic, as in the tables above, checked by staged bot tests per Calling (Chronomancer with and without Paradox).
6. **Build health:** lint, tsc, vitest and e2e green; `sim-bench` Unweaver peak p95 ≤ 1.5 ms a tick; no FX batch growth.
7. **Saves:** v5 runs (including in-flight 2-Movement Expeditions) and v9 profiles load and finish, and Prep-phase saves upgrade.
8. **Hand-off:** `m3-baseline.json`, `expedition3-baseline.json`, a Movement III command snapshot and 15 pinned hashes are committed for the Finale slice.
9. **Docs:** this file with the measured tables, `docs/phase-5c/{vfx-audio.md, ui.md}` and `docs/demo.md`.

## The Finale hook

1. `EXPEDITION_MOVEMENTS = CONTENT.movements.length` drives `routeMovements`, the route copy and `pacing.ts`. Appending the Finale's MovementDef makes the Unweaver an interlude automatically (`isFinalNode`): epic draft, 3 relics, heal.
2. W4 adds a **new** seam, `generateMapFrom(seed, defs)`. Today only `generateMap(seed, movements)` exists (`run.ts:516`), and it becomes a wrapper with unchanged output. A unit test proves the interlude behaviour now, with a synthetic 4th def.
3. An optional `MovementDef.label?` feeds `movementLabel` (`routeText.ts:39-41`), so the Finale can read 'The Finale' instead of 'Movement IV'. When absent, it stays 'Movement N'.
4. FINAL_CALL, VICTORY, SPOILS, BIOME_PLACE and ENCOUNTER_ICON are keyed by encounter id or biome, so the Finale only adds rows.
5. `BOSS_SCRIPTS` takes the Silent Conductor without another `defId` branch. The Mimic and Mirror Weave primitives (the enemy Thread, ShieldKind `'mirror'`, `emboldened`, `allyEnemy`, `specialsOf`) are generic, ready for the mirror choir.
6. The biome tables in render and audio make 'celestial_crucible' one row each. Fermata's `hold()` is untouched for the Grand Silence.
7. **Known blockers for the Finale slice:**
   - MovementDef requires `opening`, `skirmishes` (≥ 1), `elites` (≥ 1), a `miniboss` row and a last boss row (`schema.ts:1360-1363, 1486-1498`); only `lessons` is optional (`:1357-1358`). A boss-only Finale def needs those relaxed.
   - Calling rows are global (`run.ts:267`).
   - The Expedition sits near 40 minutes.
   - The Movement-gated relic sleep compares against the fight's encounter Movement, so Finale relics need `movement: 4` and nothing more.

## Known gaps (deliberate)

- One Thread: no Twin Spindle and no Razor Silk.
- Possession is a disable plus a tick, not hero AI, and it never targets the Weaver.
- Stitch roots the pair instead of moving them as one, and a Reel frees only the hero it pulls.
- No detach command.
- Steal Verse mutes the aura and does not remove it; Sovereign holds through a theft.
- The Null rune doesn't touch auras.
- The Mirror feint is replaced by an interruptible Ward (your answer 4).
- Doom never stacks on the Weaver.
- There is one Movement III map elite; its three waves teach the three combat affixes.
- No Calling growth after Movement I.
- Movement I stays at 10 stops.
- Later: the Finale, Seren, Oro, the Conductor Calling, the Mimicry Dissonance level and Counterpoint.

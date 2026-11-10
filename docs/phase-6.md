# Phase 6: Mastery, the endgame

*2026-11-09, reconciled 2026-11-10 · design and build spec · written at eddab8c (Phase 5f W1); reconciled with main at 2554e69, which holds all of Phase 5f (merged, reviewed and tuned) and all of Phase 5g (the content fill, merged, reviewed, tuned, its pins re-recorded); see *Reconciled with main* · plan: [06 Phase 6](plan/06-roadmap.md) (lines 127-137), [02 §9](plan/02-game-design.md) (line 236: "Dissonance (after the first Finale clear), Atlas of Echoes, weekly seeds"), [02 §10](plan/02-game-design.md) (lines 248-253), [02 §4.12](plan/02-game-design.md) (the difficulty contract), [03 §11](plan/03-content-bible.md) (lines 461-481, the fifteen Dissonance levels), [05 §4.3-4.4, §4.9, §8, §11](plan/05-technical-architecture.md) (seeds, replays, determinism, saves, the harness) · follows [Phase 4d](phase-4d.md) (Dissonance), [Phase 5d](phase-5d.md) (the Finale), [Phase 5f](phase-5f.md) (the Conductor Calling) and [Phase 5g](phase-5g.md) (every content category at its 1.0 count)*

Phase 6 is the long tail: the reasons to play after the first Finale clear. The roadmap lists four pieces:

- **Dissonance**, all fifteen levels. Twelve exist. Tyrant, Mimicry and True Dissonance are missing.
- **The Atlas of Echoes**, a map of remixed runs with stars to light. Nothing of it exists.
- **The weekly seed**, the same run for everyone that week, with share codes and replay verification. Seeded runs and single-fight replays exist; whole-run replays, the weekly and share codes do not.
- **Deeds**. Thirty exist. The plan's own examples are partly covered, and the new features need their own.

The exit is the roadmap's: the expert bot's clear rates sit in target bands for each Dissonance tier, and a seeded replay reproduces bit for bit on the same browser.

This doc is the spec. Implementers build from it and their brief. Every number below is a starting value for the tuning stream (W8), inside the levers listed under *Bands*. Where the plan is vague, the doc says so and proposes a reading.

## Reconciled with main

This doc was written at eddab8c, while Phase 5f's presentation and bot streams were open and before Phase 5g. On 2026-11-10 it was checked section by section against main at 2554e69 (all of 5f and 5g merged, reviewed, tuned and documented) by W0, before W0 changed any source. The design is unchanged except where a row below says a decision was added. What moved, and why:

- **Header and *Follows*.** Now name the commit reconciled against and Phase 5g.
- **Decisions 15, 16 and 17 (new rows).** 15: Phase 5g's Expedition-only gate reads `run.movements === 1`, and six of nine Echoes have one leg; default (a), an Echo draws the Expedition pools. 16: 5g's masked replay checks the masked content's version against a frozen one, which Phase 6's appended content would break; default (a), W1 extends the mask. 17: Silent Bell needs a Chime count that nothing records; default (a), judge it on the existing `cleanses` stat ("without Cleansing", the plan's words). The doc follows each default. No earlier row's default changed.
- **Every `file:line` into a file that changed since eddab8c** was re-read and corrected: `schema.ts` (+266 lines: the effects list, `DEED_TESTS`, the road schema), `mods.ts` (+279: `applyDissonance` and each level's case), `world.ts` (+3 to +14), `health.ts` (+5 to +42: heal, kill path, `restlessRise`, the mimic's copy), `thread.ts`, `conducting.ts`, `run.ts` (+2 to +42: Unforgiving, the Pact, `playedDissonance`, `rngFor`, the fight seed, assists, the event allowance, `generateMapFrom`, `grade`, the "without you" copy), `index.ts`, `runtime.ts`, `SummaryScreen.tsx`, `skilled.ts`, `harness-core.ts` (`playRun` is now `:2080-2345`), and `rules3.ts`'s path (`src/sim/rules3.ts`, not `systems/`). References into unchanged files were spot-checked and hold.
- **Counts and versions, as on main:** 12 Dissonance levels and 30 points; 30 Deeds and 12 Deed rules; **28** goldens (the first draft expected 25 + 3 once 5f landed: it did); `SIM_VERSION` 22; the fight replay format 6; the run save 5; `PROFILE_VERSION` 9 before W0 (W0 made it 10); `contentVersion` `c-3d16ade0f5775748` (unchanged by W0); 205 test files and 4,380 tests passing (8 skipped) before W0.
- ***Audit, Dissonance.*** Silent Cues shares its field with 5g's Hollow Crown (and N29's floor); Discordant Pact's pool now depends on the route (5g's three Expedition-only cursed relics); a Restless Dead rise emits no `enemyKilled`.
- ***Audit, Deeds.*** No rule reads 5g's `triggers` stats; Water Clock's undone down is no down (Flawless, `fight` downs, grades).
- ***Audit, Replays and seeds* (redone).** The first audit named the assists and the event allowance. Today the allowance reaches the run at four steps (`pickCalling`, `retune`, `forge`, `chooseEvent`), is read afresh each time and can change mid-run; the profile also writes four run fields after fights (awarded Bond XP, `run.deeds`, `dissonanceEnd`, the Reliquary's settlement) that no later step reads. The harness's 5g options (`draftPrefer`, `relicPrefer`, `eventMotif`, `thirdAura`) are harness-side. The replay-size measurement is marked as taken before 5f's bot tuning.
- ***Audit, bots.*** The Skilled bot's rule lists as tuned by 5f (`BEAT_AHEAD` 2.8 s, `BANK_WITH_FINALE` false) and 5g (`ironMask`, `everbellChime`, `cueGateCost`); `playRun`'s new options and `tools/builds.ts`; the Dissonance-0 anchor replaced by 5g's final reading (67 / 67 / 64%, 200 a set) instead of 5e's first look (74%, 50 runs).
- ***Tyrant, Mimicry, the Postlude*: interactions with 5f and 5g (new paragraphs, no rule changed).** Borrowed attacks feed the trigger system like any telegraph (and make Clutch Peal and Second Toll fire at the Bellwarden and Vharun through the borrowed Dirge); mirror copies never reach it; the mark keeps an ordinary enemy ordinary for the fill's "ordinary enemy" effects; the Postlude's rise is not a new fight (Water Clock, Spare Strings, Sacrificial Lamb, Prompt Book and `perFight` counts stay spent; no `enemyKilled`, no `onDeath`; a Grand Finale plays on and cancels Fortissimo like any Crescendo). The count of Conductor-id references is restated (47 in 11 files under `src/`).
- ***The Atlas and the weekly.*** Pools per decision 15; an Echo leg's shape tied to the road schema; the weekly's pools named (5g's entries included, none Rank-gated); run-replay steps carry an event's motif and Chords and the allowance per step; the digest leaves the profile-written fields out; the Time paragraph points to 5g's sim bench.
- ***Deeds.*** Silent Bell per decision 17; how each new Deed is written in content; Water Clock and Red All the Way.
- ***The expert bot.*** It inherits 5f's and 5g's rules; `postludeBank` must hold the Grand Finale itself because `BANK_WITH_FINALE` is false; its draft, relic and merchant policy plugs into `playRun`'s `draftPrefer` and `relicPrefer`.
- ***Engineering ground rules.*** Rule 1 lists the pins as they are now (28 goldens; 40 cell and 12 whole-run `--check`s by party; 5g's `fillInert.json`, masked replay, frozen resolver and key pins; the Prelude-based reports W7's tools must keep printing). Rule 2: **48** hashes, not 45 (15 level-rank settings and the all-twelve set, three scenarios each), and the whole runs W0 pinned. Rule 3: 5g's `NO_MODS` assertion that W1 must extend; `specialCooldowns` also holds affix specials. Rule 5: the Deed position test W2 rewrites; `contentVersionOf`'s rule for the empty lists. Rule 8: the allowance per step and the digest's exclusions. Rule 9: the versions as found and as W0 left them; **the profile's new keys are optional and absent until written** (the first draft had the migration fill them empty), so the v9 → v10 step changes only the version; the run save's four new keys are in its schema.
- ***Contracts.*** The **(W0)** marks and exact names; Echo legs modelled on the road schema; the Deed's Dissonance total is `values.points` (the draft's `points` key already exists, as the Astrolabe point); `allLevels`, `constellation` and `{movement}`, `{level}` on Deeds; robes and Thread looks gain `earned` (they had none); star rules and the score have no content home and stay with W3 and W4.
- ***Workstreams.*** W5-W7 no longer wait (5f is merged); a merge order; W0's row as built; W1 gains the two 5g tests it must touch; W2 gains decision 15's gate and the count and position tests; W5 and W6 name the 5f and 5g files inside their folders; W7 must not re-record the bot pins; the remark that 5f "is editing now" `runtime.ts` is gone.
- ***Bands.*** The Dissonance-0 readings from 5g's and 5f's tuning, with pointers, beside the unchanged bands.

**Found at reconciliation, not decided (for the owner).**

1. **The Postlude counts against the Finale's par.** `grade` takes up to 15 points for time over par (`run.ts:2482`), and True Dissonance adds 45-120 s to the Finale fight, so its grade and a weekly's score fall with the level. `parMult` already lengthens par for Hardened and Restless Dead (`meta/dissonance.ts:64-74`). Suggested: W2 lengthens the Conductor's par on True Dissonance by the Postlude's expected length (W8 measures it). Nothing is built until you say.
2. **`restlessHold`** ("don't spend a Ward on an enemy about to rise") names a target a Ward can't have: Wards go on heroes. W7 should read it as "don't Focus or Chime an enemy that is about to rise", or drop it.
3. **`red_all_the_way`** uses `heroCeiling` with no encounter, but `ceilingHolds` matches `r.encounterId === deed.encounter` (`meta/deeds.ts:62-68`): W2 must change that check, not only the schema (W0 relaxed the lint).
4. **Earned robes and Thread looks keep a required `price`** in the schema; W3 and W5 must keep the Atelier from selling them.
5. **The star thresholds and rewards and the weekly score** have no place in `CONTENT`, so they don't move `contentVersion`; a weekly's share code names the build by the content hash. If you want a change to the score to make "another version", W4 puts the score's numbers in `src/content/weekly.ts` and asks W0's owner for a rules entry.
6. **The content hash's second lane is weak.** `contentHash` (`src/content/index.ts`) multiplies its second FNV lane by an even number (`0x01000193 + 0x5bd1e995`), so each step shifts the lane's earlier bits out and it ends up depending on only the last dozen characters of the JSON (every recent `contentVersion` ends in `f5775748`). Its first 32 bits, which the share code carries, are an ordinary FNV-1a and fine. W4 should not rely on more than those 32 bits; the Dissonance pins use SHA-256 for this reason. Changing the hash would move every `contentVersion`, so it is left.

## Decisions for you

Each row is a choice that changes what gets built. The rest of the doc follows the recommended default; any row can be overridden.

| # | Question | Options | Recommended default |
|---|---|---|---|
| 1 | The exit asks for bands "per Dissonance tier", and the release checklist names tiers 0/5/10/15. The plan counted fifteen levels; the game counts **points** (30 today, 42 with the three new levels). What is a tier? | (a) a point total, each measured with one fixed set of levels: 0, 10, 20, 30 and everything (42); (b) the number of levels switched on: 0, 5, 10, 15 | **(a).** Points are what Prep shows and what rewards pay on; 10 and 20 are already the reward lines (Tears, relic depth). |
| 2 | Tyrant: the plan says "bosses gain an extra mechanic per phase". What counts as a mechanic? | (a) in each phase, the boss also uses one attack borrowed from the ordinary enemies of its road, announced when the phase starts and cast under the usual limit on how many dangerous attacks are shown at once; the Silent Conductor instead plays its own closing attacks earlier, and its Grand Silence is left alone; (b) a new mechanic designed for each boss, with new attacks, art and sound | **(a).** No new attack content, every answer already taught. |
| 3 | Mimicry: the plan says "some enemies gain the Mimicking affix". How many? | (a) one enemy in every wave, never a boss or mini-boss; (b) every elite; (c) a share of all enemies | **(a).** One mirror a wave is readable; more would make Movement I's swarms unreadable. |
| 4 | True Dissonance: the Finale's fourth phase. | (a) the **Postlude**: when the Silent Conductor falls it rises once with 30% of its life; its choir re-forms and sings in pairs, Discord swells faster, and the closing attacks continue; Expeditions only; 5 points; (b) the same plus a second, shorter Grand Silence; (c) 5d's sketch, named "Da Capo" | **(a).** It reuses the Finale's pieces and asks for no new verb. (c)'s name is already a motif's. |
| 5 | **Auras: needs your approval.** Nothing in this design changes what an aura does, costs or looks like. Three things the plan suggests would. | (i) Echo twists that shrink or weaken auras (the plan's "Dissonant Ground: aura radius −30%", 02 §7); (ii) an Echo that forces Muted Choir on; (iii) Tyrant or Mimicry borrowing a mechanic that silences auras (the Mute's dome, the Silencing affix, the Unweaver's Steal Verse) | **None is built unless you approve.** The Echo list and the Tyrant table below exclude all three, and every workstream can finish without them. |
| 6 | The weekly: whose build does everyone play with? | (a) a level field: the seed, route, Calling, heroes and Dissonance are fixed for everyone; you choose your Chords from every aura and ornament and any technique variant; no Astrolabe, no carried relics, no Bond talents; (b) your own profile's build, with the score marked "own build" | **(a).** Scores only compare when the builds do. (a) lets a player use an aura they haven't bought yet for that run; it changes no aura. |
| 7 | The weekly: how is each week's run chosen? | (a) a hand-made rotation of 12 entries (Calling, heroes, Dissonance, route), cycled, with a new seed every week; (b) everything drawn from the seed | **(a).** Each entry can be checked against the bands before it ships; a random draw can deal an unwinnable week. |
| 8 | When does a week start, and when do updates ship? | (a) Monday 00:00 UTC for everyone; content changes ship at that boundary when possible; a replay from another version is still checked and marked "another version"; (b) local midnight | **(a).** Everyone's week is the same week. |
| 9 | How is a run shared? | (a) a short code (38 characters) that states the result, plus a replay file (about 0.1 to 1 MB) that proves it; (b) the replay file only; (c) one long text code holding everything | **(a).** The code fits a chat line; the file is the proof. |
| 10 | Which runs count for run-wide Deeds and Dissonance records? | (a) run-wide Deeds (win a run, Flawless, the Calling badges, the counts) count on Preludes, Expeditions and weekly runs, not on Echoes; Deeds about one fight count anywhere; the new Dissonance tier Deeds and the per-Calling Finale record need a Finale clear; (b) every run counts | **(a).** Echoes are shorter, so they would make the run-wide Deeds cheaper. Today any won run, a Prelude included, sets a Dissonance best (`src/app/profileStore.ts:527-550`). |
| 11 | Do any new Deeds give Astrolabe points? | (a) no: the 14 new Deeds are badges (Starlight, some titles); the ten point Deeds stay the only ones (the cap of 10 holds, and so does the +30% power cap); (b) some do, and the cap rises | **(a).** |
| 12 | The plan: "a clear at each total is a badge per Calling". | (a) four tier Deeds (10, 20, 30, everything) with any Calling, plus each Calling's best Finale-clear Dissonance shown on its card; (b) one Deed per Calling per tier (20 Deeds) | **(a).** Twenty near-identical Deeds would crowd the Hall. |
| 13 | Where do Echoes and the weekly live in the Loom? | (a) a new station, the Atlas of Echoes, beside the Dissonance station; (b) one "Atlas" station that also holds Dissonance (the sketch in 04 §7) | **(a).** The Dissonance station players already know stays where it is. |
| 14 | What is the "expert bot"? | (a) the Skilled bot's fight play, deciding twice as often, plus rules for the new mechanics, a policy for map, draft and shop choices, and a Rank 20 build; (b) a separately tuned bot at the plan's numbers (200 ms reactions, 85% Perfect Wards) | **(a).** The Skilled bot already decides every 67 ms with full attention; what it lacks is planning and a build, not reflexes. |
| 15 | *Added at reconciliation (Phase 5g).* Phase 5g's new motifs, relics, boons and events are offered only on Expeditions: the run layer's gate drops them when `run.movements === 1` (`expeditionOffered`, `src/meta/run.ts:1683-1685`; also `relicPool`, `eligible` and Discordant Pact's `pactRelic`, docs/phase-5g.md decision 4 and ground rule 6). An Echo is a new kind of run, and six of the nine Echoes play one road. Which pools does an Echo draw from? | (a) an Echo is an Expedition for that gate: its drafts, relic offers, shops, events and Discordant Pact draw from the Expedition pools, 5g's entries included, whatever its number of legs (the gate also reads `run.echo`); Movement-gated entries (5c) follow the Movement each leg is built over; (b) the gate as it reads today: an Echo of one leg (`movements` 1) draws the Prelude's pools, a longer one the Expedition's | **(a).** Echoes open only after a Finale clear, so every player who meets one already drafts from the Expedition pools; under (b) six of nine Echoes would lose the 63 motifs and 18 relics. A weekly on an Echo route follows the same rule. No Prelude path changes: an Echo is never a Prelude. |
| 16 | *Added at reconciliation (Phase 5g).* 5g's masked replay (`tests/fill/masked.test.ts`) drops 5g's ids from four lists of `CONTENT` and checks the recomputed `contentVersion` equals the frozen pre-5g one (`tests/fill/pre5g/golden.json`). Phase 6's appended content (levels, Deeds, keepsakes, Echoes, the rotation) would turn that check red although no 5g pin moved. What happens to it? | (a) the first stream that appends Phase 6 content (W1, the three levels) extends the mask in that test so it also drops Phase 6's entries: the levels after `discordant_pact`, `PHASE6_DEEDS`, the Atlas keepsakes, and empties `echoes`, `constellations` and `weekly`; the frozen fixtures are never touched; (b) drop that test's version check once Phase 6 content lands and keep its pin checks; (c) re-freeze `tests/fill/pre5g/**` | **(a).** It keeps 5g's proof whole at no cost, and nothing frozen moves. W1 owns that one edit (the mask, not the checks). |
| 17 | *Added at reconciliation (not caused by 5f or 5g; found while checking the Deeds' contracts).* *Silent Bell* ("Clear Movement III without a single Chime") needs a per-fight Chime count. Neither the sim's ledger nor the run's `EncounterStats` has one (`src/meta/types.ts:313-371`); a hashed ledger key would move every golden. What does "without" read? | (a) the plan's own words, "Clear Movement III without Cleansing" (02 §10): no Movement III fight records a cleanse (`EncounterStats.cleanses`, which exists); `movementWithout` names a Movement and a stat (`movement`, `stat`), and `DEED_STATS` gains `cleanses`; the text becomes "Clear Movement III without cleansing a hero."; (b) keep "without a Chime": the outcome builder counts the fight's `techniqueCast` Chime events into a new optional `EncounterStats.chimes?`, written only on Movement III fights so no Prelude pin moves | **(a).** No new stat, no pin at risk, and it is what the plan asked for. W0 builds the schema for both readings (`movement` and `stat` on the Deed); W2 writes the Deed. |

## Words used here

- **Dissonance**: opt-in difficulty levels chosen in Prep. Each level is worth **points** per rank; a run's points are its **Dissonance**. A **tier** (decision 1) is a point total measured with a fixed set of levels.
- **Echo**: a remixed run in the Atlas of Echoes. Each Echo has three **stars**; Echoes are grouped in **constellations**.
- **The weekly** (in the game: *This Week's Song*): one run, the same for everyone during a UTC week.
- **Fight replay**: today's replay of one fight (`src/sim/replay.ts`). **Run replay**: new; a whole run, every choice and every fight.
- **Share code**: a short text that states a run's result. **Verify**: re-simulate a run replay on this device and check it ends where it claims.
- **Pin**: a test that fixes an exact output (a hash, a snapshot, a report) so a change shows. A **golden** is a pinned hash of a scripted fight (`tests/sim/golden.json`).
- **Hash**: the sim's 64-bit fingerprint of its whole state (`src/sim/hashing.ts:13-44`), exact to the last bit of every number.

## Audit: what exists today

### Dissonance

**The framework** (Phase 4d). Levels are content (`src/content/dissonance.ts:8-117`) with an `effect` from a closed list (`src/content/schema.ts:1599-1612`), ranks and points. A run's levels travel to each fight in `SimConfig.dissonance` (`src/sim/world.ts:164-168`; resolved in content order, `:279-289`; kept in fight replays, `src/sim/replay.ts:111`) and become modifiers in `applyDissonance` (`src/sim/mods.ts:804-848`), applied last, after the motifs, relics, boons (and their triggers, Phase 5g), the Calling and the Astrolabe (`:795-796`). The run layer's pure functions are in `src/meta/dissonance.ts` (points, rewards, par, Tears, opening). Rewards: +3% Weaver XP and +4% Tuning Shards a point; a Discord Tear for an A from 10 points and one more for any win from 20 (`src/content/dissonance.ts:120-129`). Relics remember the Dissonance they were won at (their **depth**), which sets how far crafting can take them. Dissonance opens on the first Finale clear at Rank 15 or above (`src/meta/dissonance.ts:76-97`). The profile keeps, per Calling, the best total won at (`src/meta/profile.ts:124-131`), from any won run, a Prelude included (`src/app/profileStore.ts:527-550`). The most points today: **30**.

**The fifteen levels.**

| # | Plan (03 §11) | Plan effect | Built | Id · points × ranks | How it works in the game |
|---|---|---|---|---|---|
| 1 | Brisk Foes | enemies +15% speed | yes | `brisk_foes` · 1 × 1 | `enemySpeedMult` (`mods.ts:814-816`), read once at spawn (`systems/enemies.ts:122`). |
| 2 | Hardened | enemies +25% HP (×2) | yes | `hardened` · 3 × 2 | `enemyLifeMult` (`mods.ts:817-819`) on each spawn's life (`enemies.ts:114`) and the wave's life budget (`director.ts:134-135`); a fight's par grows with it so grades stay fair (`meta/dissonance.ts:64-74`). |
| 3 | Short Fuse | windups −10% (×2) | yes | `short_fuse` · 1 × 2 | `dissonanceWindupMult`, floored at ×0.2 (`mods.ts:820-822`), on every windup (`enemies.ts:779-783`, `:921-925`) and the Grand Silence's cap (`conductorBoss.ts:788`); the Finale's 1.0 s floor still holds (`enemies.ts:790`). |
| 4 | Muted Choir | aura radius −15% | yes | `muted_choir` · 1 × 1 | `dissonanceRadiusMult` (`mods.ts:823-825`) on the field's and the beam song's reach, after the cap and Sunrise (`systems/field.ts:183-186`, `world.ts:832`). **The one existing level that acts on auras.** Phase 6 leaves it exactly as it is. |
| 5 | Fragile Threads | snap range −3 m | yes | `fragile_threads` · 1 × 1 | `threadRangeBonus −= 3` (`mods.ts:826-828`) on the Thread's reach (`world.ts:1042`, `thread.ts:367`). |
| 6 | Wounding Strikes | healing received −15% (×2) | yes | `wounding_strikes` · 2 × 2 | `heroHealMult` (`mods.ts:829-831`) on healing heroes receive in fights (`combat/health.ts:619`; Brann's down recap reads it too, `:1659`). |
| 7 | Elite Vanguard | +1 elite per elite fight; elites +1 affix | yes | `elite_vanguard` · 5 × 1 | `vanguard()` (`director.ts:143-170`): the first elite group of an elite fight grows; extra affixes are rolled on their **own** generator seeded by the fight, the wave and the group (`:165`), so no other roll moves. |
| 8 | Silent Cues | Cue +10 Resonance | yes | `silent_cues` · 1 × 1 | `cueCostBonus` (`mods.ts:836-838`) added to the Cue's cost (`world.ts:940`, and `:790` for the Conductor's view; `cueCostNow`, `conducting.ts:62-69`). Phase 5g's Hollow Crown adds −10 into the same field and N29 floors the Cue at 0; Opening Bars, Tempo Rubato and the bots' `cueGateCost` read the price through `cueCostNow`. |
| 9 | Restless Dead | enemies revive once at 30% | yes | `restless_dead` · 5 × 1 | `restlessPct` (`mods.ts:839-841`); on a killing blow `restlessRise` stands the enemy up once at 30%, untouchable while it rises; not bosses or mini-bosses (`health.ts:1220`, `:1794-1821`). A rise is not a kill: no `enemyKilled`, so no Phase 5g `enemyKilled` trigger (Black Ribbon) fires until its second fall. |
| 10 | **Tyrant** | bosses gain an extra mechanic per phase | **no** | — | Named "still to come" in the Codex (`src/ui/screens/dissonanceModel.ts:43-47`, pinned by `tests/uiPhase4d.test.ts:410`). |
| 11 | Unforgiving | Respites no longer heal | yes | `unforgiving` · 1 × 1 | Run layer only: `restHeal` and `skipHeal` give 0 (`meta/run.ts:1565-1578`); embark rewrites the map's Respites to say so (`:1179-1180`, `unforgivingMap` `:1191-1208`). |
| 12 | **Mimicry** | some enemies gain Mimicking | **no** | — | The Mimicking affix exists (Movement III, `src/content/unstitched.ts:834-841`): it casts the Mimic's mirror, which copies the Weaver's Empower, Ward or Chime (`mimicCopyOf`, `src/sim/rules3.ts:165-170`; landed by `resolveMimic`, `systems/enemies.ts:1366-1400`). |
| 13 | Blind Score | answer glyphs hidden | yes | `blind_score` · 2 × 1 | Nothing in the fight; `state.dissonance.blindScore` (`world.ts:934-939`) tells the views to hide answers (`render/dissonanceCues.ts:84`, the HUD's hints, boss bar and decrees cut to their first sentence). |
| 14 | Discordant Pact | start with a random cursed relic | yes | `discordant_pact` · 1 × 1 | Run layer: a cursed relic the run doesn't carry, picked from the run's seed (`pactRelic`, `meta/run.ts:1001-1018`; embark `:1171-1178`); not played, and no point, if there is none to give (`playedDissonance`, `:1020-1034`). Since Phase 5g the pick takes the run's route: on a Prelude the Expedition-only cursed relics (Iron Mask, Red Ink, Hollow Crown) are not in its pool; on an Expedition they are. |
| 15 | **True Dissonance** | the Finale gains a fourth phase | **no** | — | Deferred by 5d (`docs/phase-5d.md:126-128`); its suggested seam (a second boss definition) is reconsidered below. |

**Gap:** three levels; tier bands; an expert bot; a record of Dissonance won *on a Finale clear*.

### Deeds

**What exists.** 30 Deeds in content order (`src/content/index.ts:96-103`): the base twenty (`src/content/deeds.ts:12-191`), Movement II's three (`legionRun.ts:503-531`), Movement III's two, the Finale's two (`deeds.ts:215-234`), Seren's and Oro's two (`rosterDeeds.ts`) and the Conductor's one (`deeds.ts:203-213`). Ten give an Astrolabe point each, capped at 10 (`src/meta/deeds.ts:12`); every Deed pays Starlight (the ladder 10-40, a badge 15, `src/content/loom.ts:12-14`); one earns a title (`title_flawless`, `loom.ts:59`). Each Deed names one of twelve rules (`schema.ts:1399-1417`), judged from what the run recorded (`meta/deeds.ts:104-134`). Every rule reads one run; nothing reads the profile as a whole. No rule reads Phase 5g's `triggers` statistics (`EncounterStats.triggers?`, absent without a trigger), and `runCount` can total only the stats in `DEED_STATS` (`schema.ts:1421-1428`). Since Phase 5g, Water Clock's undone down is not a down (no `ledger.downs`, no `allyDowned`; docs/phase-5g.md, *As built*), so it counts for nothing against Flawless, a `fight` Deed's `downs` or a grade.

**Against the plan's list** (02 §10):

| Plan | Today | Gap |
|---|---|---|
| "Win with Brann never above 40% HP" | *In the Red*: the Vharun fight only (`legionRun.ts:524`) | a whole-run version |
| "50 Perfect Wards in one run" | *Perfect Pitch* at 25 (`deeds.ts:94-101`) | a 50 |
| "Clear Movement III without Cleansing" | none | a rule over one Movement's fights |
| "some granting Astrolabe points" | ten do | none (decision 11) |
| "A clear at each total is a badge per Calling" (Dissonance, 02 §10) | a best total per Calling, from any win | tier Deeds and a Finale-clear record (decision 12) |
| Deeds for the Atlas and the weekly | none | new |

### Replays and seeds

**A fight replay today** (`src/sim/replay.ts:135-147`, format version 6) holds: the sim and content versions, the fight's fully resolved config (seed, party, encounter, Chords, motifs, relics, boons, Threat, the Movement's scale, Calling, Astrolabe, carried passives, Dissonance, Bonds, technique variants, assists, debug and absent flags; `world.ts:191-228`), the commands of every tick that had any, the last tick, and the final hash. Measured on three goldens at eddab8c (scratch `/home/user/aw-work/p6/size.ts`), before Phase 5f's bot tuning (`BEAT_AHEAD` 0.6 → 2.8 s) and Phase 5g's bot rules: the Skilled bot sends about 0.2 commands a tick, mostly `move` and `aim`, and a replay gzips to **1.4 to 1.7 KB per 1,000 ticks**; the Novice's to about a fifth of that. Not re-measured at reconciliation; W4 measures it again.

**How it is verified today.** `runReplay` re-simulates from the config and compares the final hash; it reports a different sim or content version but still runs (`replay.ts:209-237`). `tests/sim/determinism.test.ts` round-trips nine scenarios through JSON and re-simulates them bit for bit (`:62-82`), and detects a tampered command (`:106-113`). `tools/replay-verify.ts` does the same from a file. In the game, the runtime records every fight (`src/app/runtime.ts:195`, `:272-275`), but only the dev panel exports it (`src/debug/DevPanel.tsx:44`, `:59-60`). The plan's "Settings → Export last run" and replay viewer (05 §9) don't exist.

**Determinism.** The sim uses only operations every JavaScript engine computes exactly: its own sine, cosine and square-root-based helpers (`src/sim/core/dmath.ts:1-9`), and lint bans the others, `Math.random`, `Date` and the environment in `src/sim` and `src/content` (`eslint.config.js`). So a replay is *designed* to match across engines; the plan only promises the same engine (05 §4.9). The run layer (`src/meta`) bans only `Math.random` and uses no inexact math today.

**Seeds and runs.** A run is reproducible from its seed and its choices: every roll in `meta/run.ts` comes from a generator named for its purpose (`rngFor(seed, label)`, `:322-324`), and each fight's seed comes from the run's seed, its fight count and its node (`:1279-1280`). The app picks the seed with `Math.random` (`src/app/runStore.ts:297-299`). A run saved mid-fight restarts that fight from its start on resume (`runStore.ts:187`).

*What reaches the run from outside its state* (re-audited at reconciliation on `src/meta` and `src/app` as they are now; the first audit named only the first two). `src/meta` reads no clock, locale, storage or settings itself (its only `toLocaleString` calls fix `'en-US'` and only format text, `run.ts:2213`, `:2241`), and uses no inexact math. Everything else comes in through `src/app/runStore.ts`:

- **At Prep and embark** (the run's start): the tree within the Rank's points, the carry slots and carried relics, the Bonds and technique variants the profile has, the Calling's open path tiers (`setCallingTiers`), whether Dissonance and Expeditions are open, the roster, the remembered party and Chords, and the allowance (`runStore.ts:292-313`, `:339-371`). A weekly builds all of these from the week alone (decision 6).
- **During the run, on every fight:** the player's **assists** (`combatConfig(run, assists)`, `run.ts:1271-1308`, from `useSettings`, `runStore.ts:378`).
- **During the run, on four actions:** the profile's **allowance** (`useProfile.getState().allowance()`), read afresh each time: `pickCalling` (Third Voice's retune), `retune`, `forge` (a Forge retune) and `chooseEvent` (a retune effect's Chords, and whether a Rank-gated recruiting choice is shown or allowed: `eventChoiceProblem` and `eventChoiceShown`, `run.ts:1887-1929`) (`runStore.ts:402-430`). It can change mid-run: a Rank reached by a fight's XP, a recruit freed, or Settings → Skip the unlocks turned on or off.
- **After a fight, written into the run but read by no later step:** each result's Bond XP as the profile awards it (`withAwardedBondXp`, `runStore.ts:122-134`), the Deeds the profile records (`run.deeds`, `:162-168`), and at the end `dissonanceEnd` and the Reliquary's settlement (`:147-153`).
- **Not run-layer inputs:** the harness's `draftPrefer`, `relicPrefer`, `eventMotif` and `thirdAura` (Phase 5g, `tools/harness-core.ts:2080-2345`) are harness-side policies: the run layer only receives the index or id they pick, as it does a player's click.

**What does not exist:** a record of a whole run, a weekly seed, a share code, a score, any comparison between players, and any player-facing replay. Saves live in `localStorage` or memory (`src/app/storage.ts:1`), not IndexedDB as the plan has it.

### The Atlas of Echoes

**What the plan means** (02 §10, line 251): after the first Finale clear, "a persistent star map of *Echo Expeditions*: remixed runs with fixed twists (e.g. *Choir of Blood*, Movement I enemies with Movement II's boss mechanics). Clearing Echoes at Dissonance lights stars and earns Reliquary materials and cosmetics." 04 §7 puts it in the Loom as a station. 02 §13 pays Tuning Shards and Discord Tears from Echoes.

**What exists:** nothing but promises. The Summary's first-clear card says "Coming later: the Atlas of Echoes and True Dissonance" (`src/ui/screens/SummaryScreen.tsx:156`); `finaleCleared` is documented as its future gate (`src/meta/runEnd.ts:23-35`). The Loom's stations have no Atlas (`src/ui/screens/loomModel.ts:36-46`). **What would make it cheap:** maps are generated from Movement definitions that are plain data (`generateMapFrom(seed, defs)`, `run.ts:666`), and the Finale route already plays a shorter "road" through earlier Movements (`RoadVariantSchema`, `schema.ts:1934-1963`); a fight's enemy scale can already be overridden per fight (`SimConfig.movement`, absent when unused, `world.ts:200-206`; `combatConfig` sets none today, so each fight takes its encounter's own Movement's scale).

### The bots

`BotKind` is `idle`, `novice` or `skilled` (`src/bots/types.ts:14`, `index.ts:14-23`). The Skilled bot decides every 4 ticks (67 ms) with full attention and answers a hero's call after 0.4 s (`SkilledOptions`, `skilled.ts:169-181`; the defaults and the decision gate, `:519`, `:531`); it reads every telegraph's exact timer, so on reflexes it already meets the plan's Expert (05 §11: 200 ms, 85% Perfect). Its rules come in named lists that `SkilledOptions.skip` can turn off: `M3_RULES`, `FINALE_RULES`, `CONDUCTING_RULES` (Phase 5f: `conductChain`, `conductHold`, `conductBeat`, `conductFinale`, `conductMarcato`; tuned to `BEAT_AHEAD` 2.8 s, and `BANK_WITH_FINALE` false, so `bankCrescendo` no longer holds the Crescendo on a Conductor run, `skilled.ts:476`), `FILL_RULES` (Phase 5g: `ironMask`, `everbellChime`, `skilled.ts:282-290`) and `ROSTER_RULES`; both bots gate Cues on `cueGateCost` (Phase 5g, `common.ts:1273-1275`). Whole-run harness play (`playRun`, `tools/harness-core.ts:2080-2345`) picks map nodes by seed (`:2207-2209`), takes the first draft and relic unless a `draftPrefer` or `relicPrefer` list or function says otherwise (Phase 5g; the merchant honours both, and an event choice that asks for a motif is taken only with a draft list, by `eventMotif`, `:1990-2014`), and rests at every Respite (`:2268`). `tools/builds.ts` (Phase 5g) plays six named builds (Calling and path, party, Chords, draft and relic lists) through those options. `tools/dissonance.ts` measured each level with a Rank 20 build (a 29-point tree and three carried legendaries) on Preludes. 4d's ladder: Skilled won 98% at 0 points, 75% at 10, 35% at 20, 11% at 30 (`docs/phase-4d.md:179-188`). On whole Finale-route Expeditions with no build, the newest reading is Phase 5g's final one: the Skilled bot with the default party won 67 / 67 / 64% at Dissonance 0 (200 runs on each of 2000, 900007 and 333003; reached the Finale 68 / 70 / 66%), the Novice 1.0 / 1.0 / 1.5% (`docs/phase-5g.md`, *Tuning*, "The bands, on all three sets"). It replaces 5e's first look (74%, 50 runs, `docs/phase-5e.md:1108-1112`), which predates the Finale's tuning, the Conductor and the fill.

## Design: Dissonance's three missing levels

### Tyrant (4 points)

> *Bosses and mini-bosses take up one more attack in each phase, borrowed from the foes of their road.*

- **Rule.** On a Tyrant run, when a boss or mini-boss enters a phase (the fight's start counts as entering phase 1), it gains that phase's **borrowed attack** from the table below. It casts it through the same attack picker as its own attacks, under the same readability cap and phase rules, on the borrowed attack's own cooldown × 1.5, first 6 s after the phase begins. A phase shift replaces it with the next phase's.
- **What the player sees.** At the phase's start, a decree line under the boss bar: "**Tyrant** — the Bellwarden takes up the Glass Lancer's Lance. Ward it, Reel the target, or step aside." The second sentence is built from the attack's answer tags, so Blind Score cuts it as it cuts every decree. The attack looks, sounds and answers as the borrowed foe's does, with the boss's crown sigil over the cast.
- **Why this reading** (decision 2). Every answer is one the player learned on that road. No new attack art is needed, and the readability cap and the Finale's limits keep holding because the picker applies them.
- **Excluded**: anything that silences, steals or weakens an aura (the Mute's dome, Silencing, Steal Verse, decision 5), and anything that summons.

| Boss (Movement) | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| The Bellwarden (I, mini-boss) | Glass Lancer · Lance (`lancer_lance`) | Lamenter · Dirge (`lamenter_dirge`) | — |
| The Hollow Cantor (I) | Bell Brute · Toll Cleave (`brute_toll_cleave`) | Glass Lancer · Lance | Cantor Acolyte · Mending Hymn (`acolyte_mending_hymn`: Focus it or the boss's side heals) |
| The Gorehound Matriarch (II, mini-boss) | Impaler · Charge (`impaler_charge`) | Leech · Latch (`leech_latch`) | — |
| Vharun (II) | Leech · Latch | Impaler · Charge | Lamenter · Dirge (not the Hemomancer's Pact: Vharun's Judgement stops Pacts on purpose, `bosses.ts:111-112`) |
| The Seamstress (III, mini-boss) | Shears · Dash (`shears_dash`) | Doubt Wraith · Doubt (`wraith_doubt`) | — |
| The Unweaver (III) | Null Priest · Rune (`null_rune`: refuses Ward, Chime and Reel inside it, `src/sim/rules3.ts:86-102`; no aura effect) | Void Maw · Inhale (`maw_inhale`) | Doubt Wraith · Doubt |
| The Silent Conductor (Finale) | its own **Sforzando**, every 12 s (today only in the last burn) | its own **Downbeat**, every 9 s | none in the Grand Silence (the exam stays as built); in the last burn its Downbeat and Sforzando come every 7 s and 9 s |

The Conductor's row is a proposal where the plan is vague: borrowing a road foe's attack into the Finale would break its rule that the Weaver faces only the choir's rehearsed answers (`docs/phase-5d.md`, Principles 1-3). The Finale's script already casts those two attacks through its own gate (`docs/phase-5d.md:171`), which keeps its at-most-two damaging telegraphs.

Each borrowed attack takes the boss's Movement scale for damage, as every attack in that fight does. W1 checks each entry casts sensibly from a boss (range, shape, target); an entry that doesn't is swapped for another foe of the same road, and the doc's table updated.

**With Phase 5g's triggers and hooks** (checked at reconciliation against `src/sim/systems/triggers.ts` and `src/sim/fill/`). A borrowed attack is an ordinary enemy telegraph, so whatever reacts to a telegraph reacts to it exactly as to the boss's own attacks: a Perfect Ward on it emits `perfectWard` (Red Ink, Echoing Shell, Sand Glass and the other `perfectWard` triggers fire), a Save emits `save`, Thread the Needle (N4) can negate part of it. Clutch Peal and Second Toll fire only on a Clutch Cleanse of a Dirge (docs/phase-5g.md, *Sim notes*), so with Tyrant they also fire at the Bellwarden (phase 2) and Vharun (phase 3), whose borrowed attack is the Lamenter's Dirge. That is intended: Tyrant adds no new kind of event, and no trigger or fill hook keys on who cast an attack, a boss's phase, its `specialCooldowns` or an attack's id. The Mending Hymn's heal on the boss's side is a `healApplied`, which no trigger reads.

### Mimicry (3 points)

> *In every wave, one enemy carries Mimicking: it copies your Empower, Ward or Chime.*

- **Rule.** In each wave of every fight, one enemy that isn't a boss, a mini-boss or a summon gains the **Mimicking** affix (`unstitched.ts:834-841`), if it doesn't already have it. Which one: the first spawn group of the wave with the most life per enemy (ties to the earlier group), and the first enemy of that group. The group is split into that one and the rest, in the same order, so every spawn point is drawn exactly as without it.
- **Seeded** like Elite Vanguard: its only roll (none today; kept for later choices) would use its own generator from the fight's seed and the wave, never the world's streams.
- **What the player sees.** The existing Mimicking look: its crown gem and the Mimic's cast bar showing the icon it will copy (5c). A first sighting on a Movement I or II road gets the Mimic's first-sighting card, since it may be the first time the player meets one.
- With **Restless Dead**, a mimicking enemy that rises loses its copy, as today (`health.ts:1805`), and keeps the affix.
- **With Phase 5g** (checked at reconciliation). A mirror's copy never reaches the trigger system: a Ward copy is a `mirror` shield on an enemy, and `shieldBroken` triggers read only a hero's or the Weaver's shield (`triggers.ts:138-142`); a Chime copy's heal is a `healApplied`, which no trigger reads; Emboldened is an enemy status. The marked enemy keeps its `tier`: an ordinary enemy stays `'normal'` (`systems/enemies.ts:100-107`), so the fill's "ordinary enemy" effects (Bell Clapper's stun, `triggers.ts:521`; Cutting Chorus, `fill/harmonies.ts:157`) reach it as before, and Black Ribbon's "heavy foe" is the enemy's content `role`, which an affix doesn't change. Iron Mask (`mods.noEmpower`) means the Thread is never in Empower, so a Mimic then copies only a Ward or a Chime (`mimicCopyOf`). Nothing in the fill keys on an affix or on `elite`.

### True Dissonance: the Postlude (5 points, Expeditions only)

> *The Silent Conductor rises from its fall with 30% of its life and plays a fourth phase, the Postlude. Expeditions only.*

The Finale's phases: **Overture** (the Conductor Cues its mirror-choir's Solos), **Mirror Choir** (the whole choir, faster Cues, Discord swells toward Fortissimo Silence), **Grand Silence** (the heroes freeze; the Weaver's eight notes reignite them; the last burn). The Postlude is the song refusing to end.

- **The rise.** On a True Dissonance run, the blow that would kill the Silent Conductor instead stands it up once: 3 s untouchable (hits and statuses pass, heroes pick another target, as Restless Dead's rise), then life **30% of its maximum**. Every telegraph it had live is dropped. Its Fortissimo Silence, if pending, is cancelled.
- **The choir re-forms**: two mirror-choir voices are Raised (in slot order of the heroes they mirror, starting with the first) with the usual ground warning.
- **Duets**: every **14 s** the Conductor Cues two voices, the second 1.5 s after the first. The script's own cap of two live damaging telegraphs holds; a second Cue that would break it waits.
- **Discord returns**, swelling at **1.5** a second (the Mirror Choir's is 1, `crucible.ts:62`), and failed telegraphs feed it as before. At 100 comes Fortissimo Silence, and any Crescendo cancels it, whatever the Calling.
- **The closing attacks continue**: Downbeat every 9 s, Sforzando every 12 s (`crucible.ts:64`; 7 and 9 with Tyrant).
- **After 90 s** of Postlude: Cues every 10 s and Discord at ×2. The phase ends only with the Conductor's death; the pressure makes sure that comes.
- **Every Finale rule holds**: no windup under 1.0 s, at most two live damaging telegraphs, every decree written as "what's coming, then its answer". No Grand Silence again, no new verb, no aura effect.
- **Decree:** "**Postlude** — The Conductor will not let the song end, and its choir sings in pairs. Answer both voices, and silence its Fortissimo with your Crescendo."
- **On a Prelude** (no Finale) the level isn't played and adds no point, the way a Discordant Pact with nothing to give isn't (`playedDissonance`, `run.ts:1020-1034`). Prep says "Expeditions only" beside it.
- **The rise is not a new fight** (added at reconciliation, for Phase 5f's and 5g's per-fight state). The Postlude is the same fight: every once-a-fight effect already spent stays spent and none is refreshed by the rise: Water Clock (`internal.waterClockUsed`), Spare Strings (`weaver.spareUsed`), Sacrificial Lamb (`internal.lambUsed`), Prompt Book's first-Crescendo discount (read from `ledger.crescendos`), every trigger's `perFight` count and `every` clock (`internal.triggers`); Everbell's charges keep recharging on their own clock. The rise is not a kill: like Restless Dead's it emits no `enemyKilled` and runs no boss `onDeath` (`conductorDeath`, which deletes `field.finale` and `internal.m4`), so it must be decided in the kill path before `killEnemy` (`health.ts:1220`). The encounter stays `fighting` through it, so `updateTriggers` keeps running (it returns at once only when the fight is over) and a Grand Finale (the Conductor Calling's Crescendo) that is playing plays on (`finishFinale` stops silently only on victory or defeat, docs/phase-5f.md, review fix A7). A Grand Finale is a Crescendo, so it cancels the Postlude's Fortissimo Silence as any Crescendo does; Heartwood Lute, Fanfare and Taking Bows fire on it as on any Crescendo.

**Where it lives** (an engineering choice, overriding 5d's seam). 5d proposed a second boss definition swapped in by Dissonance (`docs/phase-5d.md:1420`). But dozens of places compare a boss to the Conductor's id (at reconciliation 47 references to its id constant in 11 files under `src/` outside `crucibleIds.ts`, more in `tools/` and `tests/`: bots, HUD, render, audio, result text). So the Conductor keeps its definition; the Postlude is a fourth phase that exists only while the True Dissonance modifier is on, entered by the rise, not by a life threshold. `bossPhaseTable(defId)` keeps its signature and output; the boss bar asks a new `bossPhaseTableWith(defId, { postlude: true })` for its fourth pip.

### Points, tiers and what the player sees

**Points.** Tyrant 4, Mimicry 3, True Dissonance 5: first guesses on 4d's scale, where a point is about 8% more enemy life to a Rank 20 build (`docs/phase-4d.md:28`). W8 measures them with 4d's method (`tools/dissonance.ts`) and moves only these three. The most points: **42**. The existing twelve levels keep their points and numbers.

**Tiers** (decision 1), each a fixed set so the harness measures the same thing every time:

| Tier | Points | Levels |
|---|---|---|
| 0 | 0 | none |
| I | 10 | Hardened ×2, Wounding Strikes ×2 (4d's 10) |
| II | 20 | Tier I + Restless Dead + Elite Vanguard (4d's 20) |
| III | 30 | Tier II + Tyrant + Mimicry + Short Fuse ×2 + Brisk Foes |
| IV | 42 | every level at its top rank |

**Rewards** are unchanged in rule: XP and shards per point, Tears from 10 and 20, relic depth bands at 10 and 20. At 42 points a run pays +126% XP and +168% shards.

**Prep** lists the three new levels after Discordant Pact, in content order. Its total reads "out of 42". True Dissonance shows "Expeditions only", and is greyed on a Prelude. The Codex's "still to come" list (`LATER_LEVELS`) empties as each lands. In the fight, the Dissonance chip lists them as it lists the others.

**A record per Calling** (decisions 10 and 12): the profile also keeps each Calling's best Dissonance **on a Finale clear**, shown on the Calling's card in Prep ("Finale at 22 Dissonance"). The existing best (any win) stays as it is.

## Design: the Atlas of Echoes

A new Loom station (decision 13), lit when Dissonance opens (the first Finale clear at Rank 15 or above, or Skip the unlocks). Its intro card:

> *Echoes are old songs played strangely: roads you know, with foes, bosses or rules you don't. Each Echo has three stars. Light the first by clearing it, the second by clearing it at 10 Dissonance, the third at 20.*

**The map.** Nine Echoes in three constellations of three, drawn in the UI as a star chart (DOM and SVG, not the 3D scene, so it costs no render budget). Each Echo is a star with three points of light; a constellation's lines fill as its stars light.

**An Echo run** is an ordinary run in every way but its route and twists: Prep (with the Echo's constraints shown and enforced), map, fights, drafts, Summary. Its seed is new each attempt. It pays as a run does (XP, Starlight, shards and Tears by its Dissonance), and a clear may enshrine a relic. It never sets the Dissonance best and never earns run-wide Deeds (decision 10). It draws its drafts, relic offers, shops, events and Discordant Pact from the Expedition pools, Phase 5g's entries included, however many legs it has (decision 15).

**The Echoes.** Every route is made from existing Movements, roads and encounters. A leg's **scale** overrides the enemies' life and damage for that leg (`SimConfig.movement`). A leg is built like the Finale route's road (`RoadVariantSchema`): the Movement it plays, optionally its own rows, fixed rows and rewards, its mini-boss and boss, and its scale as a Movement's number (see *Contracts*).

| Constellation | Echo | Route | Twist | Length (target) |
|---|---|---|---|---|
| **Borrowed Crowns** (other Movements' bosses) | **Choir of Blood** (the plan's example) | Movement I's road, its foes at Movement I scale; then the Gorehound Matriarch as its mini-boss and Vharun as its boss, at Movement II scale | Movement I's enemies, Movement II's boss mechanics | 14-18 min |
| | **Bells in the Rift** | Movement III's road at Movement III scale; the Bellwarden and the Hollow Cantor as its mini-boss and boss, at Movement III scale | the first bosses, grown | 14-18 min |
| | **The Seamstress's Court** | Movement II's road; the Seamstress and the Unweaver at Movement III scale | | 14-18 min |
| **Strange Roads** (routes rearranged) | **Retrograde** | Movement III's road at Movement I scale, II's at II, I's at III; ends at the Hollow Cantor at Movement III scale | the Expedition backwards | 18-22 min |
| | **The Last Rehearsal** | the four bosses in order (Cantor, Vharun, Unweaver, the Silent Conductor), each followed by a Respite and a Merchant; each boss pays an epic draft and a relic | nothing but bosses | 18-22 min |
| | **The Gilded Road** | Movement II's road with every skirmish row an elite row; ends at Vharun | every fight an elite | 14-18 min |
| **Hard Bargains** (fixed rules) | **A Cappella** | Movement I's and II's roads; ends at Vharun | no Calling, no Astrolabe, no carried relics | 16-20 min |
| | **Strangers** | Movement I's and II's roads; ends at Vharun | the party is Brann, Seren and Oro, whoever you have recruited | 16-20 min |
| | **The Unrested** | Movement I's and II's roads; ends at Vharun | Restless Dead and Unforgiving are always on, and add no points | 16-20 min |

No Echo twist touches an aura (decision 5).

**Stars.** ★ clear it; ★★ clear it at 10 Dissonance or more; ★★★ clear it at 20 or more. An Echo's own fixed levels (The Unrested's) count for nothing toward these. A higher star lights the lower ones.

**Rewards**, the first time each star lights: ★ 40 Tuning Shards; ★★ 60 Tuning Shards; ★★★ 40 Tuning Shards and 1 Discord Tear. All nine stars of a constellation earn a keepsake: Borrowed Crowns a robe (*Crownless*), Strange Roads a Thread look (*Wayward*), Hard Bargains a title (*Hard Bargainer*). All 27 stars earn the title *Atlas-Walker*. Robes and Thread looks are palettes on the existing models (`loom.ts:20-50`); W5 checks their colours against the colour-vision rules.

**Player-facing text** (examples):

- Echo card: "**Choir of Blood** — The Reliquary Road, but the Gorehound Matriarch and Vharun wait at its end. ★ Clear it · ★ Clear it at 10 Dissonance · ★ Clear it at 20 Dissonance."
- Prep under an Echo: "**A Cappella**: no Calling, no Astrolabe, no carried relics. Your Chords and techniques are your own."
- Summary: "**Echo cleared at 12 Dissonance** · two stars lit · +100 Tuning Shards."

## Design: the weekly seed (This Week's Song)

The game is a static site with no server of its own. Everything below runs on the player's device.

### Deriving the week without a server

- **The week.** `week = floor((now − EPOCH) / 7 days)`, where `now` is the device clock in milliseconds since 1970 (UTC, so time zones don't matter) and `EPOCH` is Monday 2026-01-05 00:00 UTC. Monday 2026-11-09 begins week 44. A week runs Monday 00:00 UTC to the next.
- **The seed.** `seed = hashString("weekly:" + week)`, the sim's 32-bit string hash (`src/sim/core/rng.ts:29`). Every device computes the same seed for the same week.
- **The entry.** `WEEKLY_ROTATION[week mod 12]` (decision 7), a content list that is only ever appended to: the route (the Finale-route Expedition, or an Echo), the Calling, the three heroes and the Dissonance levels. The seed differs every week, so a repeated entry is a different run.
- **What this cannot guarantee.** A device whose clock is wrong is in another week; anyone can play any week by changing the clock (harmless: the code names its week). Two players on different builds may get different content for the same week: the rotation, the maps and the fights all come from content, and `CONTENT_VERSION` is a hash of all of it (`src/content/index.ts:150`), so any balance change makes another version. Hence decision 8: ship content changes at the week boundary, and check replays from other versions anyway (below).

### What the weekly fixes

Under decision 6 (a level field), a weekly run starts from a state built only from the week. Its pools are whatever its route's are: on the Finale-route Expedition the full Expedition pools, Phase 5g's 63 motifs, 18 relics, 2 boons and 6 events included (none of them is gated by Rank, docs/phase-5g.md decision 8, so every player's pools are the same); on an Echo route the Echo's (decision 15). The start: the seed and the entry's route, Calling (every path tier open; the path choices are yours, in the run), heroes and Dissonance; no Astrolabe, no carried relics, no Bond talents or alternate Solos; the allowance is everything (every aura and ornament for your Chords, every technique variant, every event choice shown). You choose your Chords and variants in Prep. Everything after is the run.

Its rewards are an Expedition's at its Dissonance. It counts for Deeds as an Expedition does, but sets no Dissonance best (its Dissonance wasn't chosen).

### The score

A run's **score**, all from what the run records:

- 1,000 if the run is won;
- for each fight won: 100 (300 for a boss, 200 for a mini-boss);
- for each fight won, by its grade: S 50, A 35, B 20, C 10, D 0.

Grades already weigh downs, Perfect Wards, saves, answered telegraphs and time against par (`grade`, `meta/run.ts:2468-2488`), so the score rewards good support, not only survival. (Since Phase 5g a down Water Clock undoes is no down, so it costs no grade.) A Finale-route Expedition won with all S grades scores about 4,000. Ties are broken by less total fight time. The "without you" re-run, which finishes in the background or not at all, is never part of the score (it is only copied into the result, `run.ts:2344`).

### Run replays

A **run replay** is a new file format, `aetherweaver-run` version 1, separate from the fight replay (which stays version 6):

- the sim and content versions, the kind (weekly, Echo, Expedition, Prelude) and, for a weekly, its week;
- the **start**: the run's state as it embarked (seed, map, party, Chords, Calling, Dissonance, everything Prep set);
- the **steps**, in order: every run-layer choice (a map node, a draft pick or reroll, a relic, a Calling option with any Chords it asked for, a purchase, a Forge service with its Chords, an event choice with the motif it names and any Chords it asks for (`chooseEvent`'s `opts.motifId` and `opts.chords`: Phase 5g's Lost Weaver's Echo and Unravelled Tapestry ask for a motif), a Respite choice, continuing from a result), the allowance in force at each of the four steps that read it (`pickCalling`, `retune`, `forge`, `chooseEvent`; on a weekly always the full allowance), and for each fight its assists, its command frames, its last tick, its final hash and how many times it was restarted;
- the **claim**: won or not, fights won, score, total fight time and the run digest (a hash over the week, the start, every step and every fight's final hash). The digest never covers the run fields the profile writes after a fight (each result's awarded Bond XP, `run.deeds`, `dissonanceEnd`, the Reliquary's settlement: *Seeds and runs*): they depend on the player's profile, not on the run.

Saved gzipped (the browser's built-in compression), with the extension `.awrun`. **Size:** at the Skilled bot's measured density, a run with about 25 minutes of fighting (90,000 ticks) is about 130 to 150 KB; a player's mouse sends more aim commands than the bot, so a human run is estimated at up to about 1 MB. If W4 measures more than that, it adds a compact frame encoding (tick gaps and quantised aim as small integers).

**Recording.** The run store records each step as it applies it; at each fight's end, the combat screen hands the fight's frames (the runtime's existing recorder) with the outcome. Logs go to IndexedDB at node boundaries, never per tick. A fight restarted after a reload starts its log again, and its restart count goes up.

### Share codes

A **share code** states a weekly result in 38 characters:

`AW1-` then 28 characters of Crockford base32 (digits and capitals without I, L, O, U; a typed I or L is read as 1, O as 0), in groups of four: `AW1-K7Q2-…-…-…-…-…-…`.

| Field | Bits |
|---|---|
| week | 14 |
| build: the first 32 bits of the content hash | 32 |
| sim version | 8 |
| won | 1 |
| fights won | 5 |
| score | 13 |
| total fight time, seconds | 13 |
| run digest: the first 40 bits | 40 |
| check digits (catch a typo or a swapped pair) | 10 |
| **total** | **136** (28 characters) |

The code holds no name. The person adding it names the entry ("Mara"), and the replay file may carry a name its maker typed (at most 24 characters).

### Verifying a shared run

The receiver pastes the code and opens the replay file. The game:

1. Reads the code: check digits, its week, its build.
2. Reads the file: its format; that it is a weekly of that week; that its start is exactly what that week's entry builds, with Chords legal under the full allowance; that no fight has debug commands or debug config.
3. Re-simulates in a background worker (as "without you" already runs, `src/app/withoutYou.ts`), with a progress bar: each step through the same run functions, each fight from the config the run itself gives (`combatConfig(run, assists)`), never from a config stored in the file, so a file can't hand itself extra relics. Each fight must end on its recorded hash at its recorded tick.
4. Computes the score and digest, and compares them with the code.

**Time.** The sim alone ran at about 0.07 ms a tick on this machine (warmed up, three goldens, at eddab8c), so a 90,000-tick run is about 6-10 s in Node; the budget in a browser is 60 s on the reference laptop. Phase 5g's tuning read `npm run sim:bench -- --check` within budget (every scenario's p95 ≤ 0.164 ms; the bench holds no fill entry) and a scratch bench of the Unweaver's peak with Razor Silk and ten trigger motifs at p95 0.086 ms (docs/phase-5g.md, *Tuning*, "Performance"). At reconciliation a Rank 20 Skilled whole Finale-route Expedition through `playRun` took 2 to 5 s in Node on this machine (scratch, not a benchmark).

**What the player reads:**

- "**Verified** on this device: Week 47, won, 3,210 points, 31 min of fighting."
- "**Verified**, though it was recorded on another version of the game." (Every fight's hash matched, which a real difference would almost never allow.)
- "**Doesn't match its code**: the code says 3,210 points; the replay plays to 2,950."
- "**Parts ways at fight 7** (Vharun): it was recorded as a win and plays as a loss here. It may have been edited, or recorded on another browser."
- "**Only a code**: its replay hasn't been checked." (A claim.)
- "This code is for Week 46."

### The local leaderboard

The Atlas's weekly panel shows the week, the days left, the entry ("The Chronomancer, with Kael, Seren and Vexis, at 10 Dissonance"), your best score this week, *Begin*, and a table of this week's entries: yours (re-verified when finished) and the codes you added, ordered by score then time, each marked Verified, Verified (another version), Claimed or Didn't match. The profile keeps the last 12 weeks, at most 30 entries a week, as codes and names (small); replay files stay in IndexedDB only if you choose *Keep*. *Share* copies the code and a line ("My Week 47 song: 3,210 points, won. AW1-…") and saves the replay file.

### What is honestly out of reach without a server

- **A global leaderboard**: no place everyone's scores meet. Sharing is between people who exchange codes and files.
- **Cheat-proofing**: a verified replay proves the score follows from those inputs under the game's rules on this device. It cannot prove a person played them live: a bot, a slowed-down browser, or retrying a fight by reloading all make valid replays. The restart count is in the file, written by the game, and a forger can change it.
- **A code alone proves nothing.** It has check digits, not a signature: a static site can hold no secret to sign with.
- **Cross-browser verification** is designed for (exact operations only) but not promised; the exit asks for the same browser.
- **Old builds**: if a week's content changed mid-week, a replay may not re-simulate on the new build. Hosting old builds at their own addresses would fix that; that is distribution work for Phase 7, not this phase.

## Design: Deeds

Fourteen new Deeds, all badges (decision 11): no Astrolabe point, 15 Starlight each, appended last in content as `PHASE6_DEEDS` so every earlier Deed keeps its place.

| Id | Name | Rule | Text |
|---|---|---|---|
| `absolute_pitch` | Absolute Pitch | run count of Perfect Wards ≥ 50 | Make {n} Perfect Wards in one run. |
| `silent_bell` | Silent Bell | new rule `movementWithout` (`movement` 3, `stat` `cleanses`; decision 17): beat Movement III's boss with no cleanse recorded in any of Movement III's fights | Clear Movement III without cleansing a hero. |
| `red_all_the_way` | Red All the Way | `heroCeiling` with no encounter named: a won Expedition with Brann, and in every fight where he fell to 40%, never above it after | Win an Expedition with {hero}, never letting him above {pct}% life once he falls to it in a fight. |
| `out_of_tune` | Out of Tune | new rule `dissonance`: a Finale clear at ≥ 10 points | Clear the Finale at {points} Dissonance or more. |
| `wolf_interval` | Wolf Interval | the same, 20 | (as above) |
| `tritone` | Tritone | the same, 30 | (as above) |
| `resolution` | Resolution | the same, every level at its top rank | Clear the Finale with every Dissonance level. Earns the title *the Resolved*. |
| `final_bar` | Final Bar | `fight` with a level named: beat the Silent Conductor with True Dissonance | Beat the Silent Conductor's Postlude. |
| `crownbreaker` | Crownbreaker | a Finale clear with Tyrant on | Clear the Finale with Tyrant. |
| `faint_star` | Faint Star | new profile rule `stars` ≥ 1 | Light a star in the Atlas of Echoes. |
| `whole_constellation` | Whole Constellation | new profile rule `constellation` | Light every star of one constellation. |
| `atlas_walker` | Every Star | `stars` ≥ 27 | Light every star in the Atlas. (The title comes from the Atlas, above.) |
| `same_song` | Same Song | new profile rule `weeks` ≥ 1 | Win This Week's Song. |
| `every_week_a_song` | Every Week a Song | `weeks` ≥ 4 | Win This Week's Song in {n} different weeks. |

- Run rules are judged as today, from the run (`deedsEarned`). The three profile rules (`stars`, `constellation`, `weeks`) are judged when the Atlas or the weekly record changes, by a new `profileDeedsEarned(profile)`.
- **How each row is written in content** (the contract W0 built): the Dissonance total a `dissonance` Deed asks for is `values.points` (the Deed's own `points` key is its Astrolabe point, 0 or 1, and stays 0 for all fourteen); a level it names is `level` (`final_bar` with `fight`, `crownbreaker` with `dissonance`); `resolution` sets `allLevels: true`; `movementWithout` names `movement` and `stat`; `whole_constellation` may name a `constellation` (absent: any one). `{movement}` and `{level}` are named placeholders in a Deed's text, filled by name as `{hero}` is.
- **What the run records for them, with Phase 5g.** No new Deed reads `triggers`. Water Clock's undone down is no down, so it doesn't break Flawless; it can lift Brann above his line by turning him back to his life of 3 s before, which `peakAfterLow` sees like any heal (Red All the Way).
- **Run kinds** (decision 10): the run-wide rules (`win`, `runCount`, `grades`, `callAll`, `calling`, `keystone`, `elites`, `flawless`, `saveWays`) skip Echo runs; fight rules (`fight`, `heroCeiling` with an encounter, `heroTally`) count anywhere. Every run that exists today is a Prelude or an Expedition, so every earlier Deed is judged exactly as before.

## Design: the expert bot

The plan's four bots (05 §11) are Idle, Novice, Skilled and Expert. The game has the first three. **The Expert** (decision 14) is the Skilled bot's fight play with four additions:

1. **Faster and closer**: it decides every 2 ticks and answers a call after 0.25 s (the Skilled: 4 and 0.4).
2. **Rules for Phase 6's mechanics**, each named so the harness can switch it off: `tyrantFocus` (Focus a boss casting the Mending Hymn); `postludeBank` (in the Postlude, keep the Crescendo for Fortissimo Silence once Discord passes 70); `restlessHold` (don't spend a Ward on an enemy about to rise). Mimicry's copies are already handled by the Skilled bot's Mimic rules (`M3_RULES`' `mimicWard` and `mimicEmpower`, `skilled.ts:207-209`), which read the copy on any enemy. *At reconciliation:* the Expert inherits every Skilled rule as tuned, Phase 5f's `CONDUCTING_RULES` with `BEAT_AHEAD` 2.8 s and `BANK_WITH_FINALE` false, and Phase 5g's `FILL_RULES` (`ironMask`, `everbellChime`) and `cueGateCost`. Because `BANK_WITH_FINALE` is false, `bankCrescendo` holds nothing on a Conductor run, so `postludeBank` must hold the Crescendo (the Grand Finale) itself on those runs, and stays inert everywhere outside the Postlude so the Conductor's 5f tuning is untouched.
3. **A run policy**, in place of the harness's "first option" (since Phase 5g the draft, relic and merchant parts plug into `playRun`'s existing `draftPrefer` and `relicPrefer`, which take a function, and event motif picks into `eventMotif`; only node choice and Respites need new `playRun` options): rest at a Respite only when a hero is under 50% or Shaken; take an elite row when the party averages 70% life or more; draft by rarity, then by tags shared with the Calling and Chords, then by levelling a motif it owns; relics by rarity; shop for a relic if it can pay, else a motif level; the Calling path with the best measured result for that Calling (`tools/callings.ts`).
4. **A Rank 20 build**: `tools/dissonance.ts`'s tree and carried set (`:38-40`), Bond talents at rank 10, and a Chord preset per run.

It never changes the Novice's or the Skilled bot's commands: a new class, `ExpertBot`, built on the Skilled bot's rules through an `expert` option that is absent by default, with its own generator. The Skilled bot stays the bot of every existing band; the Expert is measured only for Dissonance tiers, Echoes and the weekly rotation. The Skilled bot keeps losing to the Expert by a margin (*Bands*), which is the plan's "the skill ceiling has to pay".

## Engineering ground rules (additive only)

5b's to 5g's rules still hold (docs/phase-5e.md:302-342, docs/phase-5f.md:179-200, docs/phase-5g.md *Engineering ground rules*), in particular 5g's rule 3 (triggers and hooks inert without their entry), rule 6 (the Expedition-only gate, before any draw) and rule 9 (saves). This phase adds:

1. **Every existing pin stays byte-identical** with no new level on, no Echo and no weekly. As they stand on main at reconciliation (Phase 5g's go-live and tuning re-recorded the seeded-run pins, `f79ae6c`; Phase 6 adds no pool content, so none of them may move again):
   - the goldens: **28** (the 25 older ones and Phase 5f's three Conductor goldens, `skilled-conducting-bellwarden`, `novice-conducting-first-light`, `skilled-conducting-silent`), in `tests/sim/golden.json` (`contentVersion` `c-3d16ade0f5775748` at reconciliation) and as literals in `tests/sim/m1Unchanged.test.ts` (its `CONDUCTING_HASHES` included), which also pins `SIM_VERSION` 22; nine of them round-trip as fight replays in `tests/sim/determinism.test.ts`;
   - the cell baselines, `tools/m1-baseline.ts --movement 1|2|3|4 --check`, for the default party and `--party A|B|C|SA|SB|SC|OA|OB|OC` (40 checks), and the whole-run baselines, `tools/expedition-baseline.ts --movements 2|3|4 --check` and `--movements 4 --party A|B|C|SA|SB|SC|OA|OB|OC --check` (12 checks; the files as 5g's tuning re-recorded them, with `triggers` and `triggerFights` in every run);
   - `tests/meta/preludeSnapshot.test.ts` (maps and runs), `tests/meta/draftSnapshot.json` (all 40 seeds, as 5g re-recorded its odd ones), the four command snapshots (`tests/bots/commandSnapshot*.json`) and 5g's `tests/bots/fillInert.json`, `tests/sim/rosterInvariance.test.ts` and its `rosterInvariance.keys.json`, the key pins `summonInert.json`, `telegraphKeys.json`, `damageResultKeys.json` and `passiveReaders.json`, `movement3Handoff`, `finaleHandoff`, `rosterHandoff`, `expedition2Pin` and `expedition3Pin` (their map fingerprints as 5g re-recorded them), `tests/bots/roster20.test.ts`;
   - Phase 5g's masked replay, `tests/fill/masked.test.ts` against the frozen `tests/fill/pre5g/**` (never edited or re-frozen by Phase 6; its mask is extended once, by decision 16), and the frozen resolver in `tests/fill/foundations.test.ts` (`tests/fill/pre5g/resolver.json`);
   - the render and audio Spire and Rift snapshots (`tests/renderSpireSnapshot`, `renderRiftSnapshot`, `audioSpireSnapshot`, `audioRiftSnapshot`), and 5e's to 5g's "no new draw call" render pins;
   - the existing modes of the report tools that read Preludes or cells (5g's rule 1 list: `tools/callings.ts`, `astrolabe.ts`, `reliquary.ts --power`, `powercap.ts`, `bonds.ts`, `variants.ts`, `dissonance.ts`, `decrees.ts`, `verbs.ts`): W7 edits `dissonance.ts` and `verbs.ts`, and their existing flags must print what they print today.
2. **Every existing Dissonance level stays byte-identical too.** No pin covered a fight at a Dissonance level before Phase 6. So W0, before any other change, recorded `tests/sim/dissonancePins.json` (test: `tests/sim/dissonancePins.test.ts`; the computation in `tests/sim/dissonancePinsFixture.ts`; the one-time writer `tests/sim/recordDissonancePins.ts`, which refuses to overwrite): the final hash of the `skilled-bellwarden`, `skilled-vharun` and `skilled-conductor` golden scenarios with each existing level at each of its ranks (15 settings) and with all twelve at their top ranks (30 points): **48** hashes (the first draft said 45, which left out the all-twelve set or a rank); plus whole runs with the Rank 20 build `tools/dissonance.ts` uses (the Skilled bot, Guardian, the 29-point tree, the `typical` carried set): a Prelude and a Finale-route Expedition at 30 points, a Finale-route Expedition at Tier I's 10 points and a Prelude and a Finale-route Expedition at the seven light levels (Brisk Foes, Muted Choir, Fragile Threads, Silent Cues, Unforgiving, Blind Score, Discordant Pact), each pinned by a hash of the finished run's state and of its results. Every later stream keeps it byte-equal. New levels are appended in content, and configs list levels in content order (`world.ts:279-289`), so an existing config's list never reorders.
3. **How.**
   - **No new sim config key.** New levels travel in `config.dissonance`; an Echo leg's scale in the existing optional `config.movement`, set only on Echo fights. `hashWorld` hashes the config (`hashing.ts:15-16`), so any new key would move every hash. `combatConfig` sets no `movement` today (`run.ts:1271-1308`).
   - **Absent, not undefined.** `hashValue` hashes a key whose value is `undefined` (`src/sim/core/hash.ts:55-56`). All new hashed state is optional, created with a conditional spread or deleted, never written as `undefined`: `EnemyComponent.tyrant?` (the borrowed attack and its next ready time, on a boss on Tyrant runs only), `FinaleField.postlude?` and the Postlude's clocks in `internal.m4`. Tyrant's cooldown lives in its own key, never as an extra slot in `specialCooldowns`, which is hashed and lines up with the boss's own specials (since 5c it also holds the affixes' specials after the def's own, `systems/enemies.ts:142-143`). W0 declared these keys (see *Contracts*); `rosterInvariance.test.ts`' `FORBIDDEN` list gains `tyrant`, `postlude` and the m4 key `postlude` (W1).
   - **Mods do nothing by default** (`tyrant: false`, `mimicryPerWave: 0`, `postludeLife: 0`); mods aren't hashed. Every new branch starts with its own guard on its own line: `if (world.mods.tyrant)`, `if (world.mods.mimicryPerWave > 0)`, `if (world.mods.postludeLife > 0)`. Since Phase 5g, `tests/fill/foundations.test.ts:97-101` checks that the only `NO_MODS` keys beyond the frozen pre-5g set are `FILL_NO_MODS`'s: W1 groups its new fields the same way (a `DISSONANCE6_NO_MODS` spread into `NO_MODS`) and extends that one assertion to allow them.
   - **The Conductor keeps its id**; `bossPhaseTable(defId)` keeps its output (above).
4. **No new RNG draw on an existing path.** Tyrant's casts go through the existing picker, and only Tyrant runs put a borrowed attack among its choices. Mimicry draws nothing from the world's streams. The Postlude's Raise draws as phase 1's does, only on True Dissonance runs, after the moment every existing fight has ended. The Expert has its own generator; the Novice and Skilled bots take no new draw.
5. **Content is appended**: levels after `discordant_pact`, effects at the end of `DISSONANCE_EFFECTS`, Deeds last in `CONTENT.deeds` (after the Conductor's `curtain_call`, so `tests/content.test.ts:1396-1398`, which finds the roster's and the Conductor's Deeds by position from the end, is rewritten by W2 to find them by id, as 5g did for its position checks), cosmetics after the existing ones, Postlude constants as new names in `crucible.ts`, Echoes and the rotation as new lists. No existing definition is edited. `contentVersionOf` leaves the three new lists (`echoes`, `constellations`, `weekly`) out of the hash while they are empty (W0), so registering them moved no `contentVersion`; each moves it once it holds an entry.
6. **Auras.** `src/content/auras.ts`, `src/sim/combat/auras.ts` and `src/sim/systems/field.ts` are not edited by any stream; `git diff main --stat` on them is empty at every merge. No new code reads anything aura-related. Anything in decision 5 waits for your approval and is built, if at all, in its own slice.
7. **Never-moved numbers stay.** At Dissonance 0 and at every existing level: the Weaver's numbers, every aura's, every enemy's, encounter's, Movement's and road's, every hero's, every Calling's, every motif's and relic's, and the existing twelve levels' numbers and points. Phase 6's levers are only its own new numbers.
8. **The run stays a function of its start and its steps.** Nothing in `src/meta` may read the clock, the settings or the profile during a run except values the run replay records: each fight's assists, and the allowance at each of the four steps that read it (`pickCalling`, `retune`, `forge`, `chooseEvent`; the full allowance on a weekly; recorded per step otherwise, since a Rank reached mid-run, a recruit or Skip the unlocks changes it). The run fields the profile writes after a fight (awarded Bond XP, `run.deeds`, `dissonanceEnd`, the Reliquary's settlement) are outside the run digest. The week is computed in `src/app` and passed in.
9. **Versions.**
   - `SIM_VERSION` stays **22**: no existing fight's result changes. (A bump would move every pin, because `hashWorld` hashes it first.) Future rule: bump only when an existing fight's result changes, with your approval.
   - The **fight replay format stays 6**: no command or config shape changes.
   - `contentVersion` moves (new levels, Echoes, Deeds, cosmetics, rotation); `tools/update-golden.ts` records it and no hash moves. It did not move at W0 (`c-3d16ade0f5775748` before and after): the new types and schema keys change no content JSON, and the three new lists are left out of the hash while empty.
   - A new **run replay format**, `aetherweaver-run` version 1.
   - **Profile 9 → 10** (W0 bumped it; 9 was still the version on main at reconciliation, 10 the next free one): it gains `atlas?` (stars per Echo, the best Dissonance cleared per Echo), `weekly?` (the last 12 weeks' entries) and `dissonance.finale?` (the best Finale-clear Dissonance per Calling). *Changed at reconciliation:* each is optional and absent until first written (the first draft had the migration fill them empty), as 5b's roster keys are, so the v9 → v10 step changes only the version and a v9 profile loads to exactly what it was; readers treat an absent key as empty. Finale records can't be rebuilt from v9's bests, which mix in Preludes. The save schema keeps each key (a non-strict schema drops unknown keys). The save fuzzer and the migration test run every version to 10. Five assertions that pinned the literal 9 (`preludeSnapshot`, `roster5e`, `roster`, `expedition` tests) now say 10; nothing they pin moved.
   - **The run save stays 5** (still 5 on main at reconciliation): new fields are optional and absent on an ordinary run (`echo?`, `weekly?`, `logId?`, and `forced?` on a Dissonance choice an Echo imposes), as 5a added Movements and 5g added `triggers?` without a bump. The run save's schema gains each one, because a non-strict schema silently drops unknown keys (W0 added all four). `fitLevels` rebuilds each level as `{ id, rank }` (`meta/dissonance.ts:19-29`) and `combatConfig` copies each whole (`{ ...l }`, `run.ts:1299`): W2 keeps `forced` through the first and out of the sim config in the second (the sim's resolver drops unknown keys, but a fight replay's config schema is strict).
10. **Shared files get call sites, not bodies.** New logic lives in new files (`systems/tyrant.ts`, `systems/postlude.ts`, `meta/atlas.ts`, `meta/weekly.ts`, `meta/shareCode.ts`, `meta/runReplay.ts`); existing files get one guarded call each.
11. **Saves are never written per tick.** Run logs go to IndexedDB at node boundaries. Without IndexedDB (some privacy modes), the weekly still plays and its replay can be saved as a file at the Summary, not kept.

## Contracts

### Content (`src/content`)

Everything marked **(W0)** below was built by W0 with no behaviour: every list empty, every key optional and absent, every new rule answering "no". The rest is the owning stream's.

- `schema.ts` **(W0)**:
  - `DISSONANCE_EFFECTS` gains `'tyrant'`, `'mimicry'`, `'true_dissonance'`, appended.
  - `EchoLegSchema` (`EchoLeg`), modelled on the Finale route's `RoadVariantSchema`: `movement` (a field Movement's content id: its pools and encounters), `rows?` (its node kinds per row; absent: that Movement's), `fixed?` (`{ row, encounter }[]`), `rewards?` (`{ row, draft: 'rare' | 'epic', relics? }[]`, as a road's), `miniboss?` (an encounter id; absent: that Movement's), `boss` (an encounter id), `scale?` (a Movement's number, 1 to the number of Movements: that Movement's `scale` on every fight of the leg, through `SimConfig.movement`; absent: each encounter's own).
  - `EchoTwistsSchema` (`EchoTwists`): `noCalling?: true`, `noTree?: true`, `noCarry?: true`, `party?` (three hero ids), `dissonance?` (`{ id, rank }[]`, levels the Echo forces on, worth no points).
  - `EchoDefSchema` (`EchoDef`): `id`, `name`, `constellation` (an id), `text`, `legs` (at least one), `twists` (may be empty).
  - `LevelRankSchema` (not exported): `{ id, rank }`, strict, rank ≥ 1.
  - `ConstellationSchema` (`Constellation`): `id`, `name`, `reward` (a keepsake's id: a robe, a Thread look or a title).
  - `WeeklyEntrySchema` (`WeeklyEntry`): `route` (`'expedition'` or an Echo id), `calling` (an id, or `null` for none), `party` (three hero ids), `dissonance` (`{ id, rank }[]`).
  - `ContentSchema` gains `echoes`, `constellations` and `weekly` (the rotation), each an array, with lints that are inert while they are empty: unique ids; an Echo's constellation is known; a leg's `movement` is a field Movement and its encounters exist; `scale` is a Movement's number; a party is three distinct known heroes; levels are known, ranks within their `ranks`; a constellation's `reward` is a known keepsake; a weekly `route` is `'expedition'` or a known Echo, its Calling known or `null`.
  - `DEED_TESTS` gains `movementWithout`, `dissonance`, `stars`, `constellation`, `weeks`, appended; `DEED_STATS` gains `cleanses` (decision 17). `DeedDef` gains optional `movement` (a Movement's number), `level` (a Dissonance level's id), `allLevels` (`true`) and `constellation` (an id). *Corrected at reconciliation:* the Dissonance total a Deed asks for is `values.points`, not a new `points` key, because `DeedDef.points` already exists (the Astrolabe point, 0 or 1). `heroCeiling` no longer needs `encounter`. The Deed lint's `needs`: `movementWithout` needs `movement` and `stat`; `stars` and `weeks` need `n`; `dissonance` and `constellation` nothing; `{movement}` and `{level}` are named text placeholders.
  - Cosmetics: one `KeepsakeEarnedSchema` (`KeepsakeEarned`: `{ mastery }`, `{ deed }`, `{ constellation }` or `{ atlas: true }`) for every keepsake; a title's `earned` gains the last two. *Corrected at reconciliation:* robes and Thread looks had no `earned` at all (only a `price`), so each gains an optional `earned` of the same forms; their `price` stays required (W3 and W5 decide what an earned robe's price means; the Atelier must not sell it).
- `dissonance.ts` appends:

```ts
{ id: 'tyrant', name: 'Tyrant', effect: 'tyrant', ranks: 1, points: 4,
  values: { cooldown: 150, first: 6 },
  text: 'Bosses and mini-bosses take up one more attack in each phase, borrowed from the foes of their road.' },
{ id: 'mimicry', name: 'Mimicry', effect: 'mimicry', ranks: 1, points: 3,
  values: { perWave: 1 },
  text: 'In every wave, {perWave} enemy carries Mimicking: it copies your Empower, Ward or Chime.' },
{ id: 'true_dissonance', name: 'True Dissonance', effect: 'true_dissonance', ranks: 1, points: 5,
  values: { life: 30 },
  text: 'The Silent Conductor rises from its fall with {life}% of its life and plays a fourth phase, the Postlude. Expeditions only.' },
```

- `crucible.ts` appends `POSTLUDE = { life: 0.3, rise: 3, voices: 2, cueEvery: 14, pairGap: 1.5, discordRate: 1.5, enrageAfter: 90, enragedCueEvery: 10, enragedDiscord: 2 }`, `TYRANT_BURN = { downbeat: 7, sforzando: 9 }` and the Postlude's decree; `crucibleIds.ts` its ids.
- New `echoes.ts` (`ECHOES`, nine Echoes; `CONSTELLATIONS`, three), `weekly.ts` (`WEEKLY_ROTATION`), `deeds.ts` appends `PHASE6_DEEDS`, `loom.ts` appends the keepsakes, `index.ts` registers the lists and concatenates the Deeds last. **(W0)** created the three files' lists empty and registered them (`echoes: ECHOES`, `constellations: CONSTELLATIONS`, `weekly: WEEKLY_ROTATION`, `...PHASE6_DEEDS` after `CONDUCTING_DEEDS`); `contentVersionOf` leaves out of the hash each of the three new lists while it is empty. The star thresholds and rewards and the weekly score have no content home in this contract: W3 and W4 keep them as named exported constants beside their lists (outside `CONTENT`) or ask for a rules entry.

### Sim (`src/sim`)

- `mods.ts` (W1): `tyrant`, `tyrantCooldownMult`, `tyrantFirst`, `mimicryPerWave`, `postludeLife`, set in `applyDissonance`, their defaults grouped as 5g's `FILL_NO_MODS` is (ground rule 3).
- `state.ts` **(W0)**: `EnemyComponent.tyrant?: TyrantHold` (`{ attack, from, phase, readyAt }`: the borrowed attack's id, the foe definition it is borrowed from, the phase it belongs to, the sim time it may next be cast; set only on a boss or mini-boss on a Tyrant run) and `FinaleField.postlude?: PostludeField` (`{ since, riseUntil, enraged? }`: when the rise began, when the Conductor stops being untouchable, and `true` once the 90 s pressure is on). `world.ts` **(W0, type only)**: `SimInternal.m4.postlude?: PostludeClocks` (`{ nextPairAt, secondAt?, second? }`: the next pair's Cue, and the second voice and its time while a pair is under way). W1 may add keys inside these objects; the objects stay absent on every other fight.
- `systems/tyrant.ts` (new): the table, `tyrantAttackOf(defId, phase)`, `enterTyrantPhase(world, boss, phase)`. Called from the phase shift in `bosses.ts` and offered to the picker in `enemies.ts`, each behind `if (world.mods.tyrant)`.
- `director.ts`: after `vanguard()`, `if (world.mods.mimicryPerWave > 0) spawns = mimicry(world, spawns, wave)`.
- `systems/postlude.ts` (new): `postludeRise(world, boss)`, called beside `restlessRise` in the kill path (`health.ts:1220`) behind `if (world.mods.postludeLife > 0)`, before `killEnemy` and so before the boss script's `onDeath`; `postludeTick(world, boss)` from `conductorBoss.ts`'s update when `field.finale.postlude` exists.
- `bosses.ts`: `bossPhaseTableWith(defId, { postlude })`.
- Events (appended to `SimEvent` after Phase 5g's `needled`) **(W0)**: `TyrantEdict` `{ type: 'tyrantEdict', tick, boss, phase, attack, from }` (`attack` the attack's id, `from` the enemy definition it is borrowed from), `PostludeRose` `{ type: 'postludeRose', tick, boss, hp }`, `PostludePair` `{ type: 'postludePair', tick, voices }` (the two voices' entity ids, in Cue order). Nothing emits them yet.

### Run layer and app (`src/meta`, `src/app`)

- `meta/run.ts`: `newEchoRun(seed, echoId, …)`, `newWeeklyRun(week, chords, techniques)`, `runKind(run)`; `routeDefs` and `setMovements` honour `run.echo`; `embark` applies an Echo's twists; `combatConfig` adds the leg's scale only on Echo fights; `playedDissonance` drops True Dissonance on a Prelude and forced levels add no points.
- `meta/atlas.ts`: `starsFor(run)`, `recordStars(profile, run)`, rewards, constellations. `meta/weekly.ts`: `WEEKLY_EPOCH_MS`, `weekOf(ms)`, `weeklySeed(week)`, `weeklyEntry(week)`, `weeklyScore(run)`. `meta/shareCode.ts`: `encodeShareCode`, `decodeShareCode`. `meta/runReplay.ts`: the schema, `RunRecorder`, `verifyRunReplay(file, code?)` (pure, synchronous), `runDigest`. `meta/outcome.ts`: `buildOutcome` moved from `src/app/outcome.ts` unchanged (the app re-exports it), so the verifier can use it.
- `meta/deeds.ts`: the new rules, the run-kind gate, `profileDeedsEarned` (W0 left the five new rules answering `false` in `deedHolds`). `meta/profile.ts`, `meta/save.ts`: version 10 and its migration **(W0)**.
- **(W0)**, the run's and the profile's shapes: `RunState.echo?: string` (the Echo's id), `RunState.weekly?: RunWeekly` (`{ week }`), `RunState.logId?: string` (the run log's key in IndexedDB), all in `meta/types.ts`; `DissonanceChoice.forced?: true` in `meta/dissonance.ts`; in `meta/profile.ts` `PROFILE_VERSION = 10`, `Profile.atlas?: ProfileAtlas` (`{ stars, best }`, each a record by Echo id: stars lit, 0 to 3, and the best Dissonance cleared), `Profile.weekly?: WeeklyWeek[]` (`{ week, entries: WeeklyCode[] }`, a `WeeklyCode` being `{ code, name?, mine?, status, replay? }` with `status` one of `WEEKLY_STATUSES`: `'verified'`, `'otherVersion'`, `'claimed'`, `'mismatch'`), `ProfileDissonance.finale?: Record<string, number>` (by Calling, `none` for no Calling, as `best`); in `meta/save.ts` the v9 → v10 step (version only) and schema entries that keep each new key, so none is dropped on load (a profile key that doesn't parse is dropped, not the profile). `meta/loom.ts` `earnedTitles` answers `false` for a constellation or Atlas title until W3 writes them.
- `bots/types.ts` **(W0)**: `BotKind` gains `'expert'`; `makeBot('expert')` (`bots/index.ts`) throws until W7 builds `ExpertBot`.
- `app/runStore.ts`: Echo and weekly starts; records each step. `app/profileStore.ts`: `recordAtlas`, `recordWeekly`, `recordFinaleDissonance`. New `app/replayStore.ts` (IndexedDB), `app/verify.worker.ts` and `app/verify.ts`. `tools/run-verify.ts`.

## Workstreams

**W0 lands first, alone.** Then W1 to W7 run in parallel on disjoint files: Phase 5f and 5g are merged, so nothing else is editing the presentation, the bots or the harness (the first draft held W5-W7 for 5f's open streams; that wait is over). W5, W6 and W7 build against mocks and wire in W1-W4 as they land. **Merge order:** W1, W3 and W4 first (each stands alone on W0's contracts); then W2, which wires W3's and W4's pure modules into the stores and needs W1's levels for `playedDissonance`; then W5, W6 and W7 (W7's Tyrant and Postlude rules need W1's state, its Echo and weekly runs W2-W4). W8 follows all of them; W9 reviews last.

| Stream | Owns (edits) | Reads only |
|---|---|---|
| **W0** contracts and characterisation (done) | `src/content/schema.ts`; empty `src/content/echoes.ts` and `weekly.ts` and an empty `PHASE6_DEEDS` in `src/content/deeds.ts`, registered in `src/content/index.ts` (with `contentVersionOf`'s rule for the empty lists); `src/sim/state.ts`, `src/sim/events.ts`, `src/sim/world.ts` (the m4 type only); `src/meta/types.ts`, `src/meta/profile.ts` (types, `PROFILE_VERSION`), `src/meta/dissonance.ts` (`forced?` type only), `src/meta/save.ts` (the v9 → v10 step and the new keys' schema entries), `src/meta/deeds.ts` and `src/meta/loom.ts` (stubs answering `false`); `src/bots/types.ts`, `src/bots/index.ts` (`'expert'`); stubs the wider unions forced on files of other streams, each a placeholder with no effect today: `src/ui/screens/deedsModel.ts` (a glyph for `cleanses` and for the five new rules), `tests/meta/deeds.test.ts` (its fixture switch throws for the five new rules), `tests/sim/dissonance.test.ts` (its every-effect test skips the three effects no level has yet), `tools/harness.ts` (its band tables take `Exclude<BotKind, 'expert'>`; `band` and `runBand` return '' for the Expert); `tests/sim/dissonancePins.test.ts`, `dissonancePins.json`, `dissonancePinsFixture.ts`, `recordDissonancePins.ts` (new), `tests/phase6Contracts.test.ts` (new); the literal 9 in `tests/meta/preludeSnapshot.test.ts`, `roster5e.test.ts`, `roster.test.ts`, `expedition.test.ts`; `.prettierignore` (the pin file) | everything else |
| **W1** Dissonance in the fight | `src/content/dissonance.ts`, `crucible.ts`, `crucibleIds.ts`; `src/sim/mods.ts`, `world.ts`, `index.ts`, `combat/health.ts` (one call), `systems/bosses.ts`, `enemies.ts`, `director.ts`, `conductorBoss.ts` (one call), `tyrant.ts` and `postlude.ts` (new); `tests/sim/tyrant.test.ts`, `mimicry.test.ts`, `postlude.test.ts` (new); `tests/sim/rosterInvariance.test.ts` (FORBIDDEN only); `tests/sim/dissonance.test.ts` (drops W0's skip of the three new effects once their levels exist); `tests/fill/foundations.test.ts` (the `NO_MODS` added-keys assertion only, ground rule 3); `tests/fill/masked.test.ts` (the mask only, decision 16); `golden.json` (`contentVersion` only) | everything else; never the three aura files, `src/sim/fill/**` or `systems/triggers.ts` |
| **W2** run layer, saves, Deeds | `src/meta/run.ts` (with decision 15's gate in `expeditionOffered`, `relicPool`, `eligible`, `pactRelic`), `dissonance.ts`, `deeds.ts`, `profile.ts`, `save.ts`, `runEnd.ts`; `src/content/deeds.ts`; `src/app/runStore.ts`, `profileStore.ts`; `tests/meta/echoRun.test.ts`, `deeds6.test.ts`, `migration.test.ts`; the tests whose count or position of Deeds or levels changes: `tests/sim/rosterContracts.test.ts:235` and `tests/meta/deeds.test.ts:233` (30 Deeds), `tests/content.test.ts:1396-1398` (Deed positions from the end), and any other listed in the hand-off | everything else |
| **W3** the Atlas | `src/content/echoes.ts`, `src/content/loom.ts` (appended keepsakes), `src/meta/atlas.ts`, `src/meta/loom.ts` (keepsakes earned by stars, in W0's stub); `tests/meta/atlas.test.ts` | everything else |
| **W4** weekly, run replays, share codes | `src/content/weekly.ts`, `src/meta/weekly.ts`, `shareCode.ts`, `runReplay.ts`, `outcome.ts` (new); `src/app/outcome.ts` (re-export only), `replayStore.ts`, `verify.ts`, `verify.worker.ts`, `runRecorder.ts` (new); `tools/run-verify.ts`; `tests/meta/weekly.test.ts`, `shareCode.test.ts`, `runReplay.test.ts` | everything else |
| **W5** UI | `src/ui/**` (Phase 5f's `hud/ConductParts.tsx`, `hud/conducting.ts`, `lab/conductingMock.ts` and Phase 5g's `hud/TriggerChips.tsx`, `hud/triggers.ts`, `lab/fillLab.tsx`, `lab/fillFixture.ts`, `kit/iconPaths.ts` are in it, and keep their behaviour), `src/ui/kit/loomLook.ts` (the `atlas` station), `e2e/smoke.spec.ts`, `e2e/weekly.spec.ts` (new), `tests/uiPhase6.test.ts` (new), `tests/uiPhase4d.test.ts:410` (`LATER_LEVELS` empties), `tests/colorVision.test.ts`, UI tests its changes touch | `src/sim`, `src/content`, `src/meta`, `src/render`, `src/audio` |
| **W6** VFX and audio | `src/render/**`, `src/audio/**` (Phase 5f's `conduct.ts` and `conductCues.ts`, Phase 5g's `render/fill.ts`, `render/fillCues.ts` and `audio/fill.ts`, which imports `render/fillCues.ts`, are in it), `tests/renderPhase6.test.ts`, `tests/audioPhase6.test.ts` (new) | everything else |
| **W7** bots and harness | `src/bots/**` (`expert.ts` new; `makeBot`'s `'expert'` case), `tools/harness-core.ts`, `tools/dissonance.ts`, `tools/scenarios.ts`, `tools/verbs.ts`, `tools/pacing.ts`, `tests/bots/**` (never re-recording `commandSnapshot*.json` or `fillInert.json`), `tests/harnessTools.test.ts`, `golden.json` and `m1Unchanged.test.ts` (appending only), `tests/sim/determinism.test.ts` (appending round-trips) | everything else, `tools/builds.ts` and `tools/callings.ts` included |
| **W8** tuning | the three new levels' `values` and `points`, `POSTLUDE` and `TYRANT_BURN`, the Tyrant table's entries, the Echoes' legs and rewards, the rotation's entries, the Expert-only constants; the new goldens' entries; a *Tuning* section appended here | everything else |
| **W9** review | nothing (a report appended here by the orchestrator) | everything |

**Owned by no Phase 6 stream** (read only): Phase 5g's `src/content/fill/**` (Phase 6 adds no pool content), `src/sim/fill/**` and `src/sim/systems/triggers.ts` (its hooks and interpreter), `tools/builds.ts`, `tools/motifs.ts`, `tools/relics.ts`, `tools/callings.ts`, `src/app/runtime.ts`, the three aura files and `src/sim/chords.ts`, and every recorded pin of ground rules 1 and 2 (beyond `golden.json`'s `contentVersion` line and W7's appended goldens).

Every type another stream needs is added by W0. If a stream finds it needs another field, it asks the orchestrator, and W0's owner (or W1's, for sim state) adds it.

**Handovers.** W0 edited `profile.ts`, `save.ts`, `index.ts` and the meta stubs first; W2 and the content owners build on it and own every other line. W2 wires W3's and W4's pure modules into the stores (call sites only). The combat screen (W5) passes the runtime's fight frames to the run store (W2) at the fight's end, so no stream edits `src/app/runtime.ts` (5f's presentation streams are merged; the rule stays so that one file has no owner in this phase).

### W0: contracts and characterisation

1. Before any change: run the whole suite and every `--check` tool on main; record the green state.
2. Record `dissonancePins.json` (rule 2) on main, and a test that reproduces it.
3. Add the types, schema entries (with empty lists), events, `'expert'`, `PROFILE_VERSION` 10 and its migration, with no behaviour, as *Contracts* marks them **(W0)**; a test shows an old profile and an old run save load and play as before.

*Done at reconciliation:* the contracts as built are the **(W0)** items under *Contracts*; the pins are rule 2's; the hand-back lists the commands and results.

**Done when** typecheck, lint and vitest are green; every pin in rule 1 and 2 is byte-identical; `SIM_VERSION` is 22.

### W1: Dissonance in the fight

Tyrant, Mimicry and the Postlude as specified, with their tests (below). W1 checks every Tyrant entry from a boss in a scenario and swaps any that misbehaves, recording it in its hand-off.

**Done when** vitest, typecheck and lint are green; rules 1 and 2 are byte-identical; `SIM_VERSION` is 22; the three aura files are untouched; a Tyrant, a Mimicry and a True Dissonance fight each run twice to the same hash and round-trip as a fight replay.

### W2: run layer, saves, Deeds

Echo routes, twists and runs; the weekly start; run kinds; True Dissonance on Preludes; forced levels; the Finale-clear record; the fourteen Deeds and the two new kinds of rule; profile 10 and the run save's optional fields; the store actions and recording call sites.

**Done when** preludeSnapshot, draftSnapshot and the expedition pins are byte-identical; every earlier Deed is judged the same on every saved test run; a v9 profile and a v5 run load; an Echo run plays from Prep to Summary in a test; vitest green.

### W3: the Atlas

Nine Echo definitions, three constellations, star rules and rewards, keepsakes.

**Done when** each Echo generates a legal map on 200 seeds (every fight reachable, the boss last); stars and rewards are given once; constellation and Atlas keepsakes unlock; content lint is clean.

### W4: weekly, run replays, share codes

The week, seed and entry; the score; the recorder; the run replay schema; verification (pure, then in a worker); share codes; IndexedDB storage; the CLI.

**Done when** a Skilled-bot weekly recorded in Node verifies in Node; every tamper case in *Tests* is caught with the right message; codes round-trip; `tools/run-verify.ts` verifies a file; vitest green.

### W5: UI

- **The Atlas station**: the star chart, Echo cards, the weekly panel (week, days left, entry, Begin, Share, Add a code, Open a replay, the leaderboard), verification's progress and its messages.
- **Prep**: an Echo's twists, the weekly's fixed choices (shown locked, with "everyone plays this"), the new levels, "out of 42", "Expeditions only".
- **In the fight**: Tyrant's decree, the Postlude's fourth boss-bar pip and decree, Mimicry's first-sighting card.
- **Summary**: stars lit and their rewards; the weekly score, its code and Share; the first-clear card no longer says "Coming later".
- **Codex**: the Dissonance page without "still to come"; an Atlas page. **Hall of Deeds**: the new Deeds, the profile Deeds' progress ("4 of 27 stars").
- Every number from content and meta; nothing hard-coded. Lab groups for each.

**Done when** the lab renders every new view; screenshots of the Atlas, an Echo's Prep, the weekly panel with a Verified, a Claimed and a Didn't match, and the Postlude's boss bar are taken; e2e green (or recorded "not run" with the reason, as 5d and 5e did).

### W6: VFX and audio

- **Tyrant**: the boss wears the borrowed foe's accent ring for the phase; its crown sigil over a Tyrant cast; the cast sounds as the foe's, under the boss's voice.
- **Mimicry**: nothing new (5c's Mimicking look and sounds), checked on Movement I and II models.
- **The Postlude**: the Crucible's sky rings re-light from the bottom as the Conductor rises (Restless Dead's rise, in the Finale's palette); the Finale's stems return re-voiced; a pair Cue's two voices answer each other.
- **Atlas sounds** (`ui.ts`): a star lit, a constellation completed, verified, didn't match.
- No new draw call, as 5e and 5f pinned; the Spire and Rift snapshots unchanged; no aura look touched.

**Done when** the snapshots are unchanged; the lab shows each visual; the new tests pass.

### W7: bots and harness

The Expert (above); `--bots expert` in the harness; `tools/dissonance.ts --tiers` (the five tier sets on Finale-route Expeditions); whole Echo and weekly runs in `playRun`; `tools/verbs.ts` ablations for the Expert's rules. **Goldens** appended after the existing ones: `skilled-tyrant-vharun`, `novice-mimicry-first-light`, `skilled-postlude` (the Silent Conductor with True Dissonance), and one Echo fight with a leg scale (`skilled-echo-choir-of-blood`). One joins the replay round-trip.

**Done when** every pin is byte-identical, including the four command snapshots; the new goldens reproduce; vitest green.

### W8: tuning

Against *Bands*, in the levers' order, on the protocol. Re-records only Phase 6's own goldens.

**Done when** every band is met on all three sets, or listed as missed with its cause for your decision.

### W9: review

An independent read of W0-W8 against this doc: the rules as written; additivity (re-run every pin, including the Dissonance pins); determinism (twice, and as replays, for each new level, an Echo fight and a whole weekly); the aura constraint; the HUD and sound agreeing with the sim at a Tyrant edict, the Postlude's rise and a verification failure.

**Done when** every finding has a file and line and is fixed with a regression test by the owning stream, or accepted by you.

## Tests

At least one per rule:

- **Tyrant.** Each boss and phase gains exactly its table's attack, from its cast time, on cooldown × 1.5; the picker's readability cap still holds with it; one `tyrantEdict` a phase; a phase shift replaces it; Blind Score cuts the edict to its first sentence; without Tyrant the boss's specials, cooldowns and hash equal the pins; the Silent Conductor's earlier Sforzando and Downbeat keep at most two damaging telegraphs live and the Grand Silence is unchanged; an Idle Weaver fails a Tyrant attack and a scripted answer passes it (05 §10's mechanics test).
- **Mimicry.** Exactly one Mimicking enemy a wave, chosen by the rule, never a boss, mini-boss or summon; spawn points and every other roll equal those without Mimicry; with Elite Vanguard the elite's affixes and the Mimicry mark don't collide; a rising mimic loses its copy.
- **True Dissonance.** The killing blow raises the Conductor once, untouchable for 3 s, at 30%; two voices are Raised; pairs every 14 s with the second waiting if two telegraphs are live; Discord at 1.5 a second, Fortissimo at 100, cancelled by any Crescendo (all five Calling states); enrage at 90 s; the fight ends at the second death; no windup under 1.0 s; the decree's form; on a Prelude the level isn't played and adds no point.
- **Points and tiers.** `maxDissonance()` is 42; each tier's set adds to its points; rewards at 42.
- **Additivity.** Rule 1's pins; `dissonancePins.json`; FORBIDDEN keys (`tyrant`, `postlude`) absent in every existing fight and in fights at each existing level.
- **Echoes.** Each Echo's map from its legs; twists applied at embark and shown in Prep; a leg's scale only on its fights (absent elsewhere); stars for clear, 10 and 20, ignoring forced levels; rewards once; no Dissonance best, no run-wide Deeds.
- **The weekly.** `weekOf` at Sunday 23:59:59.999 and Monday 00:00:00.000 UTC; 2026-11-09 is week 44; the seed and entry for fixed weeks; the start state built from the week alone, whatever the profile; the score on hand-built results.
- **Share codes.** Round-trip; 38 characters; I, L and O read as 1, 1 and 0; every single-character error and every swap of neighbours caught; a wrong prefix rejected.
- **Run replays.** A Skilled-bot weekly (a test entry on the Prelude route, for speed; one Expedition in the slow suite) recorded and verified; detected: an edited command (the fight and its number), an edited step (another draft), an edited claim, a start not matching the week, a debug command, a config smuggled into the file (ignored: the run's own is used); another `contentVersion` with matching hashes reads "another version".
- **Same browser, bit for bit** (the exit). `e2e/weekly.spec.ts`: in the page, a worker plays a Prelude-route weekly with the Skilled bot through the run functions and records it; the page verifies it twice in fresh workers (every fight hash and the digest equal); one fight is also played through the real runtime with autoplay, exported and verified. The same file is verified by `tools/run-verify.ts` in Node, and the result reported (a match is expected, not required).
- **Deeds.** Each new Deed holds and fails where it should; `deedPoints` is unchanged for every set of Deeds; Starlight for a badge is 15; earlier Deeds judged the same on saved runs.
- **Saves.** v1-v9 profiles to v10; the fuzzer; v5 runs with and without the new fields; an Echo run resumed mid-run keeps its route.
- **Bots.** The Expert's rules each change their count when skipped; the four command snapshots unchanged; the Expert draws only its own generator.

## Bands

**Protocol** (5c-5g's): whole Finale-route Expeditions, 100 seeds on each of 2000, 900007 and 333003, the default party, the Calling rotating by seed among none and the four. A band is met only on all three sets. Tune on two; read 333003 only at the end. Each tier costs about 1,500 Expeditions across the sets; the harness runs them in lanes.

**The newest readings to start from** (added at reconciliation; nothing re-measured; every one at Dissonance 0, after Phase 5g's tuning, `docs/phase-5g.md` *Tuning*): default party, no build, Skilled whole Finale-route Expeditions won 67 / 67 / 64% and reached the Finale 68 / 70 / 66% (200 a set), the Novice won 1.0 / 1.0 / 1.5%; the six Chord presets won 47-83% (Steady 83 / 80 / 77%, All In 53 / 70 / 47%, Anchor 70 / 67 / 50%; 30 a set) and their Silent Conductor cells 84-100%; five of six archetype builds won ≥ 50% (PP 97 / 93 / 87%, MA 97 / 83 / 83%, RD 0%); pacing averaged 41.5 min on base 9001 and 38.9 on 77003. The Silent Conductor fight, Skilled, cells: 174-176 s with no Calling; the Conductor Calling's Grand Finale shortens it by 64-67 s (Triad) or 121-123 s (Maestro) (`docs/phase-5f.md` *Tuning*). These replace the first draft's anchor of 74% (5e's first look, 50 runs). The tier bands below are still extrapolations for an Expert with a Rank 20 build, which no phase has measured.

**Tiers** (Expert, Rank 20 build):

| Tier | Expert wins | Skilled (same build) | Novice | Idle |
|---|---|---|---|---|
| 0 | ≥ 90% | reported | reported | 0% (loses by node 2) |
| I (10) | 70-90% | ≤ Expert − 10 | ≤ 15% | 0% |
| II (20) | 40-70% | ≤ Expert − 10 | reported | 0% |
| III (30) | 15-40% | ≤ Expert − 5 | reported | 0% |
| IV (42) | 2-15%, and above 0 on every set | reported | reported | 0% |

**Each new level** (4d's method, `tools/dissonance.ts`): Tyrant costs like 24-40% more enemy life (4 points); Mimicry 16-32% (3 points). True Dissonance on the Finale cell (Expert): wins ≥ 75% and at least 10 points below without it; the Postlude lasts 45-120 s; the whole fight no more than 150 s longer. (Read the length against the same Calling's fight without the level: a Conductor run's fight is already 64-123 s shorter, `docs/phase-5f.md` *Tuning*.)

**Builds** (02's pillar 5): at Tier I, at least 5 of the Chord presets × Callings reach Expert wins ≥ 50%. (At Dissonance 0 the Skilled bot holds this at 5 of 6 presets, with All In under the line on 333003 and Anchor on it, and at 5 of 6 of Phase 5g's archetypes, RD at 0%: `docs/phase-5g.md` *Tuning*. The band is the Expert's, a step harder.)

**Echoes** (Expert, Rank 20): ★ 60-95% each; ★★★ (Tier II's levels) 10-45% each; Strangers ★ ≥ 40%; length 12-22 min (`tools/pacing.ts`; for scale, Phase 5g's whole Finale-route Expedition reads 13.0 + 12.3 + 12.5 + 3.7 min for Movements I, II, III and the Finale on base 9001).

**The weekly rotation**: each entry, Expert 50-85% and Skilled 25-70%.

**Verification**: an Expedition replay verifies in ≤ 20 s in Node and ≤ 60 s in the browser on the reference laptop; a Skilled-bot run's file ≤ 300 KB.

**Levers, in order** (Phase 6's own numbers only): (1) Tyrant's cooldown multiple and first cast, Mimicry's count, the Postlude's life, Cue gap, pair gap, Discord rate and enrage; (2) the new levels' points; (3) the Tyrant table's entries; (4) the Echoes' legs, scales and rewards; (5) the rotation's entries; (6) Expert-only constants, only where an ablation shows it misplays. The tier sets themselves are fixed once W8 starts. If a tier band can't be met with these, ask: the alternative is moving an existing level's numbers, which this phase forbids.

## Exit criteria

| # | Criterion | Checked by |
|---|---|---|
| 1 | Every pin in rules 1 and 2 is byte-identical; `SIM_VERSION` 22; fight replay format 6; only `contentVersion` moved | `m1Unchanged.test.ts`, `dissonancePins.test.ts`, the `--check` tools, the snapshot tests |
| 2 | No aura changed; the three aura files untouched; nothing in decision 5 built without your approval | `git diff`, W9 |
| 3 | All fifteen Dissonance levels are in Prep, the fight, the Codex and the harness | W1-W2 tests, the e2e test |
| 4 | **The Expert's wins sit in each tier's band** on all three sets, or each miss is listed with its cause for your decision | W8's *Tuning* section |
| 5 | **A seeded run replay reproduces bit for bit on the same browser**: every fight's hash and the run digest | `e2e/weekly.spec.ts` |
| 6 | The Atlas opens on the first Finale clear at Rank 15; every Echo plays and lights its stars | `tests/meta/atlas.test.ts`, `echoRun.test.ts`, e2e |
| 7 | The weekly is the same week, seed and run on any device with a correct clock and the same build; codes and replays share, verify and fail as specified | W4's tests, e2e |
| 8 | The fourteen Deeds are earned as specified, and the earlier thirty exactly as before | `deeds6.test.ts` |
| 9 | Profile 10 and run save 5 load every earlier save | `migration.test.ts`, the fuzzer |
| 10 | Vitest, typecheck and lint green; e2e green or recorded "not run" with the reason | CI, the hand-off |

## Out of scope

- A global leaderboard, accounts, any server, signed codes, anti-cheat.
- A replay viewer that scrubs or watches a shared run (05 §9); a player-facing export of single fights.
- Hosting old builds for verification (Phase 7's distribution).
- Anything in decision 5 unless you approve it.
- Node modifiers on ordinary Expedition maps (02 §7's *Bloodmoon*, *Gale*).
- New enemies, bosses, attacks, auras (the Rubato), ornaments, Counterpoint, the Harmony tier and the 1.0 content fill.
- Dissonance in the Training Grounds.
- Daily seeds (the plan's 05 §4.3 mentions dailies; the roadmap asks for a weekly).

## Assumed, not yet verified

- That each Tyrant attack casts sensibly from a boss (range, shape, target, the Mending Hymn healing the boss's side). W1 checks every entry.
- That the Postlude's rise can sit beside Restless Dead's in the kill path without touching the Grand Silence's own end. W1 checks it.
- A human run's replay size (the bot's is measured; a player's aim commands are estimated).
- Verification time in a browser (measured only in Node).
- That nothing else in the run layer reads the profile, the clock or the settings during a run. The first audit found only the assists and the event allowance; the reconciliation's audit (*Seeds and runs*) found the allowance read at four steps, not one, and that it can change mid-run, plus the profile-written fields a digest must leave out. Nothing in `src/meta` reads them itself. W4's verifier test is the proof.
- That Phase 5g's per-fight state needs nothing at the Postlude's rise (*True Dissonance*): read from the code at reconciliation, not run. W1's Postlude tests check Water Clock, Spare Strings and a `perFight` trigger across the rise.
- That the browser's built-in gzip and IndexedDB are available on the target browsers; both have fallbacks above.
- The tier bands' starting values: they extrapolate 4d's Prelude ladder and 5e's Expedition rates, neither measured with an expert bot.

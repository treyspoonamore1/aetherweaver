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

**Taken by default while the owner was away (each can be overridden).** Added after the build; *As built* has the detail.

- **The Finale's par is lengthened 40% on True Dissonance** (`finalePar: 40` on the level; reconciliation item 1). To undo: remove `finalePar`.
- **Silent Bell is judged on Cleansing** (decision 17's default): no Movement III fight records a cleanse.
- **Echoes draw the Expedition pools** (decision 15's default), whatever their number of legs.
- **The Tyrant table's changes and the Conductor's single clock**: Vharun's phase 1 and the Seamstress's phase 1 borrow the Impaler's Charge; the Matriarch keeps the Leech's Latch; the Conductor's held attack is cast on one clock (`TYRANT_OWN`: Sforzando every 5.5 s, Downbeat every 4.5 s) with its own picker leaving it alone, instead of a second clock on top.
- **Echo Calling rows** are derived from each Echo's own route, so all four tiers come before its last boss; on five Echoes one fight brings two tiers.
- **Echo-route weeklies count as Echoes for run-wide Deeds** (decision 10 had every weekly count).
- **A replay that isn't a weekly never reads Verified**: only a weekly's start can be rebuilt, so the rest "play back as recorded".
- **Only weeklies and Echoes are recorded**; Preludes and Expeditions record nothing.
- **The Dissonance toggle sound's tension is a share of the new 42-point maximum**, so three audio snapshot entries (`dis-toggle-low`, `dis-toggle-off`, `dis-toggle-climb`) were re-recorded in each snapshot file.
- **Share codes are accepted only for the last 12 weeks**, and an added code never pushes out a week of the player's own.
- **Changing the clock can earn the weekly Deeds** (accepted: it is out of reach without a server).

**Held for the owner (aura reach).** The design's Tyrant entry for the Seamstress's phase 1, the Shears' Shearing Dash, cuts the Thread, and the beam song rides the Thread, so the threaded hero would lose the song's full strength while it is cut. It was replaced by the Impaler's Charge, which cuts nothing, and a whole-table test now forbids any borrowed attack that cuts or aims along the Thread or touches an aura. The owner can restore the Dash (one entry in `TYRANT_TABLE` and that test). Decision 5's three aura items remain unbuilt.

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
| Vharun (II) | Impaler · Charge (`impaler_charge`; as built, not the Leech's Latch, whose reach never meets Vharun's tank, nor the Hemomancer's Pact, which Vharun casts as its own: the road's one other attack, so phases 1 and 2 borrow the same) | Impaler · Charge | Lamenter · Dirge (not the Hemomancer's Pact: Vharun's Judgement stops Pacts on purpose, `bosses.ts:111-112`) |
| The Seamstress (III, mini-boss) | Impaler · Charge (`impaler_charge`; as built, not the Shears' Dash, which cuts the Thread and so the songs that ride it, decision 5) | Doubt Wraith · Doubt (`wraith_doubt`) | — |
| The Unweaver (III) | Null Priest · Rune (`null_rune`: refuses Ward, Chime and Reel inside it, `src/sim/rules3.ts:86-102`; no aura effect) | Void Maw · Inhale (`maw_inhale`) | Doubt Wraith · Doubt |
| The Silent Conductor (Finale) | its own **Sforzando**, more often, on one clock: a cast every 5.5 s (`TYRANT_OWN`), its own picker leaving it to Tyrant in this phase (without Tyrant the picker casts it about every 13 s) | its own **Downbeat**, the same way, every 4.5 s (about every 10 s without Tyrant) | none in the Grand Silence (the exam stays as built); in the last burn (and the Postlude) its Downbeat and Sforzando come every 7 s and 9 s (`TYRANT_BURN`) |

The Conductor's row is a proposal where the plan is vague: borrowing a road foe's attack into the Finale would break its rule that the Weaver faces only the choir's rehearsed answers (`docs/phase-5d.md`, Principles 1-3). The Finale's script already casts those two attacks through its own gate (`docs/phase-5d.md:171`), which keeps its at-most-two damaging telegraphs.

Each borrowed attack takes the boss's Movement scale for damage, as every attack in that fight does. W1 checks each entry casts sensibly from a boss (range, shape, target); an entry that doesn't is swapped for another foe of the same road, and the doc's table updated.

**With Phase 5g's triggers and hooks** (checked at reconciliation against `src/sim/systems/triggers.ts` and `src/sim/fill/`). A borrowed attack is an ordinary enemy telegraph, so whatever reacts to a telegraph reacts to it exactly as to the boss's own attacks: a Perfect Ward on it emits `perfectWard` (Red Ink, Echoing Shell, Sand Glass and the other `perfectWard` triggers fire), a Save emits `save`, Thread the Needle (N4) can negate part of it. Clutch Peal and Second Toll fire only on a Clutch Cleanse of a Dirge (docs/phase-5g.md, *Sim notes*), so with Tyrant they also fire at the Bellwarden (phase 2) and Vharun (phase 3), whose borrowed attack is the Lamenter's Dirge. That is intended: Tyrant adds no new kind of event, and no trigger or fill hook keys on who cast an attack, a boss's phase, its `specialCooldowns` or an attack's id. The Mending Hymn's heal on the boss's side is a `healApplied`, which no trigger reads.

### Mimicry (3 points)

> *In every wave, one enemy carries Mimicking: it copies your Empower, Ward or Chime.*

[As built the level's text reads "In each wave, {perWave} enemy that isn’t a boss or a mini-boss carries Mimicking: it copies your Empower, Ward or Chime.": see *As built*, *Differs from the design*.]

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

The Expert (above); `--bots expert` in the harness; `tools/dissonance.ts --tiers` (the five tier sets on Finale-route Expeditions); whole Echo and weekly runs in `playRun`; `tools/verbs.ts` ablations for the Expert's rules. **Goldens** appended after the existing ones: `skilled-tyrant-vharun`, `novice-mimicry-first-light`, `skilled-postlude` (the Silent Conductor with True Dissonance), and one Echo fight with a leg scale (`skilled-echo-choir-of-blood`) [as built `skilled-echo-bells-in-the-rift`: Choir of Blood has no leg scale; see *As built*]. One joins the replay round-trip.

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

## As built

Written after the build and the two reviews, before tuning, from the workstreams' and reviewers' hand-backs and checked against the code on main at `4e8bc5f`. The sections above keep the design; where the code differs, *Differs from the design* below says how and why. Every number here is the code's unless it is named as a measurement. Tuning is recorded in the section that follows this one.

### The three levels

Appended after `discordant_pact` in `src/content/dissonance.ts`, effects appended to `DISSONANCE_EFFECTS`. The most points is now **42** (`maxDissonance()`).

| Level | Points × ranks | `values` |
|---|---|---|
| `tyrant` | 4 × 1 | `cooldown: 150` (the borrowed attack's own cooldown, %), `first: 6` (s into the phase) |
| `mimicry` | 3 × 1 | `perWave: 1` |
| `true_dissonance` | 5 × 1 | `life: 30` (from `POSTLUDE.life`), `finalePar: 40` (% added to the Silent Conductor fight's par) |

**Mods** (`Dissonance6Mods`, defaults in `DISSONANCE6_NO_MODS`, spread into `NO_MODS` after `FILL_NO_MODS`): `tyrant` (false), `tyrantCooldownMult` (1; 1.5 on the level), `tyrantFirst` (0; 6), `mimicryPerWave` (0; 1), `postludeLife` (0; 0.3). Each new branch is behind its own guard.

**State and events.** `EnemyComponent.tyrant?: TyrantHold` (`{ attack, from, phase, readyAt }`), `FinaleField.postlude?: PostludeField` (`{ since, riseUntil, enraged? }`), `internal.m4.postlude?: PostludeClocks` (`{ nextPairAt, secondAt?, second?, first? }`; W1 added `first`). All absent on every other fight. Events appended after `needled`: `tyrantEdict` (`{ tick, boss, phase, attack, from }`), `postludeRose` (`{ boss, hp }`), `postludePair` (`{ voices }`). The edict emits no `decree` event; the HUD reads `tyrantEdict` and `enemy.tyrant`.

**Tyrant** (`src/sim/systems/tyrant.ts`: `TYRANT_TABLE`, `tyrantAttackOf`, `tyrantUpdate`, `enterTyrantPhase`, `tryTyrant`, `closingEvery`, `tyrantDecreeOf`, `tyrantForeseeable`). It applies to the fight's `bossId` (the boss, or the mini-boss of a mini-boss fight). On entering a phase the boss takes up that phase's entry; its first cast comes 6 s into the phase, then the attack's own cooldown × 1.5; it waits while two or more damaging telegraphs are live. Stasis holds its clock as it holds the boss's own cooldowns (`holdEnemyTime` moves `readyAt`). Foresight lists the held attack (marked `special = -2`, `TYRANT_FORESEEN`), and `tryTyrant` honours what Foresight promised. [Round 2: the picker tries the borrowed attack last, only when no special of the boss's own begins, and credits the time a borrowed cast and its recovery take to the boss's own clocks; Foresight lists it after the boss's own specials, so an own special due as soon is shown and begins first. See *Tuning*, *Round 2*.] The table as built:

| Boss | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| The Bellwarden | Glass Lancer · `lancer_lance` | Lamenter · `lamenter_dirge` | — |
| The Hollow Cantor | Bell Brute · `brute_toll_cleave` | Glass Lancer · `lancer_lance` | Cantor Acolyte · `acolyte_mending_hymn` |
| The Gorehound Matriarch | Impaler · `impaler_charge` | Leech · `leech_latch` | — |
| Vharun | Impaler · `impaler_charge` | Impaler · `impaler_charge` | Lamenter · `lamenter_dirge` |
| The Seamstress | Impaler · `impaler_charge` | Doubt Wraith · `wraith_doubt` | — |
| The Unweaver | Null Priest · `null_rune` | Void Maw · `maw_inhale` | Doubt Wraith · `wraith_doubt` |
| The Silent Conductor | its own Sforzando, one clock, every `TYRANT_OWN.sforzando` 5.5 s | its own Downbeat, one clock, every `TYRANT_OWN.downbeat` 4.5 s | none in the Grand Silence; the last burn and the Postlude play Downbeat every 7 s and Sforzando every 9 s (`TYRANT_BURN`) |

In a phase where the Conductor holds its own attack, its own picker and `foresee` leave that attack to the hold (`ownHeld`), so every cast of it is Tyrant's and wears the crown. The decree is `tyrantDecree(boss, foe, attack, answers, interruptible)`: "Tyrant — the Bellwarden takes up the Glass Lancer’s Lance." then the answers from the attack's tags ("Ward it, Reel the target, or step aside."); for the Conductor "plays its Sforzando more often"; Focus is named only for an interruptible attack; a name ending in s takes the apostrophe alone ("the Shears’"). A whole-table test forbids any borrowed attack that cuts or aims along the Thread, suppresses, silences or steals an aura, or summons. The Lamenter's Dirge silences a hero's own abilities for 2 s; it touches no aura and the test allows it.

**Mimicry** (`mimicry(world, spawns)` in `director.ts`, after `vanguard()`). In each wave it marks the first enemy of the spawn group with the most life per enemy (ties to the earlier group), never a boss or mini-boss, splitting the group in place so every spawn point is drawn as before. It draws nothing; the enemy's tier is untouched. Text as built: "In each wave, {perWave} enemy that isn’t a boss or a mini-boss carries Mimicking: it copies your Empower, Ward or Chime." Boss and mini-boss waves (7 of the 78 waves, counted by review A) never have one.

**The Postlude** (`src/sim/systems/postlude.ts`; installed in `health.ts` through `setPostludeRise`, a hook that avoids a module cycle, and in the Conductor's script through one `withPostlude` call). The rise is decided before `killEnemy`: no `enemyKilled`, no `onDeath`, the encounter stays `fighting`. It drops the Conductor's live telegraphs, cancels a pending Fortissimo Silence, enters phase 4 (`POSTLUDE_PHASE`) at 30% of its life, in state `spawning` and untouchable for 3 s (no `risen`, no `enemyRose`); emits `phaseChanged`, a ledger phase marker, `postludeRose` and a decree named "Postlude" (`POSTLUDE_DECREE`). Two voices are Raised in the slot order of the heroes they mirror. Pairs: every 14 s, the second voice 1.5 s after the first, through the Finale's gate; `postludePair` is emitted when the second Cue begins and only while the first voice stands, naming `[first, second]` (a pair of one is an ordinary Cue). In the Postlude a Cue in flight counts as the Solo it will start (`burnWaits`), so at most two damaging telegraphs are live. Discord swells at 1.5 a second; after 90 s the pairs come every 10 s and Discord × 2. The second fall is an ordinary death. The constants (`POSTLUDE` in `crucible.ts`): `life 0.3, rise 3, voices 2, cueEvery 14, pairGap 1.5, discordRate 1.5, enrageAfter 90, enragedCueEvery 10, enragedDiscord 2`. The boss bar's fourth pip comes from `bossPhaseTableWith(defId, { postlude: true })`; `bossPhaseTable` is unchanged.

**Par.** `parMult(levels, kind, encounter)` multiplies the Silent Conductor fight's par by 1 + `finalePar`/100 (× 1.4) on True Dissonance, and nothing on any other fight.

### The run layer

- **Echo runs** (`newEchoRun(seed, echoId, …)` in `src/meta/run.ts`, on the Atlas's `echoRoute`). The map is built from the legs (`generateEchoMap`); a leg's rewards are on its map rows; its scale reaches only that leg's fights through `SimConfig.movement`; its events and Movement gates follow the Movement it is built over; map RNG labels stay by position. Fights pay the leg's Movement's XP, Starlight and Aether, and Dissonance's shards and Tears as any run; only a clear may enshrine a relic. An Echo's `node.movement`, `result.movement` and `run.movements` count legs; `runMovementDef(run, n)` gives a leg's biome and title. Decision 15: `expeditionOffered`, `relicPool`, `eligible` and `pactRelic` read `run.echo`, so an Echo draws the Expedition pools.
- **Twists** hold from Prep through embark. A forced level (`forced: true`) stays forced through `fitLevels`, is worth no points, plays even when Dissonance is closed, and is stripped from the fight's config. A content lint requires an Echo route with `noCalling` to have `calling: null` in a weekly entry, and a fixed party to match.
- **Echo Calling rows** (`echoCallingRows`): the rows of the Echo's map where every stop is a fight, before its last row; tier k of four falls on the round(k(m − 1)/3)-th of those m rows. Choir of Blood [0, 3, 5, 7]; Strangers and The Unrested [0, 2, 4, 7]; Bells in the Rift [0, 1, 1, 3]; The Seamstress's Court and The Gilded Road [0, 1, 1, 4]; Retrograde [0, 2, 2, 5]; The Last Rehearsal [0, 3, 3, 6]; A Cappella none (no Calling). On the five with a repeated row, one fight brings two tiers, offered one after the other (`callingTierDue`, `pickCalling`). Preludes and Expeditions keep `CALLING_ROWS` and their roads' rows.
- **True Dissonance** is dropped on any route without the Finale (`routeHasFinale`): a Prelude, and every Echo except The Last Rehearsal.
- **The weekly start** (`newWeeklyRun({ week, seed, entry }, chords, techniques)`): the entry's route (the whole Expedition, or the Echo), its heroes in content order, its Calling with every path tier open (none on an Echo with `noCalling`), its levels, the player's Chords and variants under the full allowance; no tree, no carried relics, no Bonds; `weekly: { week }`. `weeklyPrep` and the verifier both build through it; Prep's follow subscriptions leave a weekly alone and a weekly's Chords are not remembered. `runAllowance` is everything on a weekly. `weeklyPrep` answers null outside weeks 0 to 16,383.
- **Run kinds** (`runKind`: `prelude`, `expedition`, `echo`, `weekly`). `countsRunWide(run)` is true when the run has no `echo`: Preludes, Expeditions and Expedition-route weeklies count for run-wide Deeds; Echoes and Echo-route weeklies do not. `setsDissonanceRecords` holds only for Preludes and Expeditions: Echoes and weeklies set no Dissonance best and no Finale record. A Finale clear writes `dissonance.finale[calling]` (`none` for no Calling).
- **Recording.** Weeklies and Echoes record; Preludes and Expeditions do not (`recordsReplay`), so an ordinary run's save gets no new key. Each store action is recorded as its step (`recordAction`, `STEP_ACTIONS`), with the allowance at the four steps that read it. At a fight's end the combat screen calls `finishFight(outcome, getRuntime()?.exportReplay() ?? null)`; a fight that ends with no replay (`finishCombat`, the test hook's wins) ends that run's recording. A step that cannot be recorded, or one taken before `resumeRecording` has finished, marks the log broken (no replay is made). Logs go to IndexedDB (`aetherweaver-replays`: `logs`, `steps`, `kept`) at node boundaries; the log header carries a fingerprint of the run (`at.fp`, `runFingerprint`) that `logFits` checks on resume. At the Summary the player's own weekly's replay is kept by itself (`keepOwnWeekly`), and own entries left Claimed are re-verified on load (`reverifyClaimedWeeklies`); an Echo's replay has a Keep button.
- **End of run.** An Echo's end records stars (`recordStars`), pays the stars' shards and Tears into the Reliquary and raises the Atlas notice. A weekly's end records the player's entry as Claimed, re-verifies it in the worker, then marks it Verified.
- **Saves.** Profile 10 (`atlas?`, `weekly?`, `dissonance.finale?`, each absent until written; v1-v9 load to 10 with none of them). Run save 5 with `echo?`, `weekly?`, `logId?` and `forced?`. Per-key tolerance (`dropAbsentKeys`, `fitPhase6Keys`): a bad `atlas.best` keeps the stars; a bad `logId` is dropped; a bad `weekly` is recovered from the seed, a bad `echo` by matching the saved map, or the run does not load. A run save's `MarkerSchema` now accepts `'rewind'` and drops unknown marker kinds (a pre-Phase-6 defect review B found: a Chronomancer run with a Rewind marker failed to reload).

### The Atlas

Nine Echoes and three constellations in `src/content/echoes.ts`; the rules in `src/meta/atlas.ts`. No twist touches an aura or names a new level.

- **Borrowed Crowns** (keepsake: the robe *Crownless*, `robe_crownless`)
  - *Choir of Blood*: one leg over Movement I's road with the Gorehound Matriarch as mini-boss and Vharun as boss. No leg scale: each encounter keeps its own Movement's scale.
  - *Bells in the Rift*: one leg over Movement III's road (Frayed Threshold first, the Bellwarden, the Hollow Cantor last) at scale 3.
  - *The Seamstress's Court*: one leg over Movement II's road (Crimson Gate first, the Seamstress, the Unweaver last); no leg scale.
- **Strange Roads** (the Thread look *Wayward*, `thread_wayward`)
  - *Retrograde*: three short legs, Movement III's road at scale 1 to the Unweaver, Movement II's at 2 to Vharun, Movement I's at 3 to the Hollow Cantor.
  - *The Last Rehearsal*: four boss legs, the Hollow Cantor, then Respite, Merchant and Vharun, the same before the Unweaver and before the Silent Conductor (that leg is built over Movement III's, since the Finale has no pools; the Conductor keeps its own scale). Each boss but the last pays an epic draft and a relic, the rule for a boss with a leg after it.
  - *The Gilded Road*: Movement II's road in seven rows, every fight row elites, the Matriarch and Vharun.
- **Hard Bargains** (the title *Hard Bargainer*): each plays Movement I's shorter road as the Finale route has it, then Movement II shortened to the gate, a fork, the Matriarch, a rest row and Vharun.
  - *A Cappella*: `noCalling`, `noTree`, `noCarry`.
  - *Strangers*: the party is Brann, Seren and Oro.
  - *The Unrested*: Restless Dead and Unforgiving forced on, worth no points.

**Stars** (`ECHO_STARS`, exported beside the lists and outside `CONTENT`, so it moves no content version): ★ at 0 points (40 shards), ★★ at 10 (60 shards), ★★★ at 20 (40 shards and 1 Discord Tear), from the run's chosen levels only (`starPoints` leaves forced ones out); a higher star lights the lower; each pays the first time it lights. The profile keeps `atlas: { stars, best }` per Echo. All nine stars of a constellation earn its keepsake; all 27 earn the title *Atlas-Walker* (`{ atlas: true }`). Earned robes and Thread looks carry `price: 90` (the schema requires one) and are never sold: the Atelier hides an unearned Atlas look, shows an earned one as earned with no price, and `buy` refuses it; `fitCosmetics` keeps earned looks out of the list of bought ones.

### The weekly, run replays and share codes

- **The week** (`src/meta/weekly.ts`): `WEEKLY_EPOCH_MS` is Monday 2026-01-05 00:00 UTC; `weekOf(ms)`; 2026-11-09 begins week 44; `weeklySeed(week)` is `hashString("weekly:" + week)`; `weeklyEntry(week)` is `CONTENT.weekly[week mod 12]` (`WEEKLY_CYCLE` = `WEEKLY_ROTATION_LENGTH` = 12, and a lint requires exactly 12 entries); `daysLeft`, `entryLine` ("The Chronomancer, with Kael, Vexis and Seren, at 10 Dissonance"). Weeks 0 to 16,383 are playable (`LAST_WEEK`, the code's 14 bits).
- **The rotation** (`WEEKLY_ROTATION`, all twelve designed entries, registered; written by W4, since the design gave only an example; no entry plays Muted Choir). Week 44 is slot 8.

| Slot | Route | Calling | Heroes | Levels | Points |
|---|---|---|---|---|---|
| 0 | Expedition | Chronomancer | Kael, Vexis, Seren | Hardened ×2, Wounding Strikes ×2 | 10 |
| 1 | Expedition | Conductor | Kael, Lyra, Brann | Restless Dead | 5 |
| 2 | Expedition | none | Kael, Lyra, Vexis | Elite Vanguard | 5 |
| 3 | Choir of Blood | Luminary | Kael, Lyra, Vexis | Brisk Foes, Short Fuse | 2 |
| 4 | Expedition | Martyr | Kael, Lyra, Seren | Brisk Foes, Tyrant | 5 |
| 5 | A Cappella | none | Lyra, Vexis, Oro | Hardened | 3 |
| 6 | Expedition | Luminary | Lyra, Vexis, Seren | Silent Cues, Mimicry | 4 |
| 7 | Retrograde | Chronomancer | Kael, Vexis, Brann | Fragile Threads, Wounding Strikes | 3 |
| 8 | Strangers | Conductor | Brann, Seren, Oro | Short Fuse ×2 | 2 |
| 9 | Expedition | Conductor | Kael, Seren, Oro | True Dissonance | 5 |
| 10 | Bells in the Rift | Martyr | Kael, Brann, Oro | Hardened, Unforgiving | 4 |
| 11 | The Unrested | Luminary | Kael, Lyra, Vexis | Blind Score (and the Echo's forced two) | 2 |

- **The score** (`WEEKLY_SCORE`, `weeklyScore`): 1,000 for a won run; each fight won 100 (mini-boss 200, boss 300) plus S 50, A 35, B 20, C 10, D 0 by its grade. Ties go to less total fight time (`fightSeconds`).
- **The board** (`weeklyBoard`, `bestScore`, `withWeeklyEntry`): ordered by score, then time, stable; the profile keeps 12 weeks (`WEEKLY_KEEP_WEEKS`) and 30 entries a week (`WEEKLY_MAX_ENTRIES`); a code the player added makes room before their own runs, and never pushes out a week holding one of their own. A code can be added only for a week of the last 12 ending now (`addableWeek`, `addWeeklyCode(text, name, nowMs)`), with words for a week that hasn't begun and for one older than the record keeps.
- **Share codes** (`src/meta/shareCode.ts`): `AW1-` then 28 Crockford base32 characters in seven groups of four, 38 characters. The 140 bits: week 14, build 32 (the first 8 hex digits of the content version), sim version 8, won 1, fights won 5, score 13, total fight time in whole seconds 13, the run digest's first 40 bits, 4 spare bits (always 0), and a CRC-10 (generator x^10 + x^9 + x^5 + x^4 + x + 1), which catches any one wrong character and any swap of neighbours. A typed I or L reads as 1, O as 0; spaces and dashes are ignored; fields too large are clamped (score and seconds at 8,191, fights at 31). The code holds no name. `shareLine` gives "My Week 44 song: 2,665 points, won. AW1-…".
- **Run replays** (`src/meta/runReplay.ts`): format `aetherweaver-run`, version 1, extension `.awrun`, gzipped JSON. A file holds `format`, `version`, `simVersion`, `contentVersion`, `kind` (`weekly`, `echo`, `expedition`, `prelude`), `week` for a weekly, `start` (the run as it embarked, without `logId`), `steps` and `claim` (`won`, `fightsWon`, `score`, `seconds`, `digest`), and may hold a `name` of at most 24 characters. A choice step is one of `node`, `continue`, `calling`, `relic`, `draft`, `reroll`, `respite`, `retune`, `scene`, `endScene`, `buy`, `leaveShop`, `forge`, `leaveForge`, `event` (with `motifId` and `chords`), `leaveEvent`, `abandon`; `calling`, `retune`, `forge` and `event` carry the allowance. A fight step holds its assists, its command frames, `finalTick`, `finalHash`, `won`, `restarts` and `debug` if it was played with debug config. The digest (`runDigest`) covers the week, the start, every step and every fight's hash, and none of the fields the profile writes after a fight.
- **What the verifier checks and refuses** (`verifyRunReplay(file, code?, { onProgress })`, pure and synchronous). It refuses, as "Can’t be read", a file nested deeper than 64, one over the schema's bounds (`simVersion` 0-255, `contentVersion` `c-` and 16 hex digits, `week` ≤ 16,383, at most 20,000 steps, a fight at most an hour of ticks), a start that is not a run of this version as it embarked (unknown encounters or events, a phase other than `map`, steps or results already in it, a `logId`), and anything that throws. Then, in order: the code's check letters and week, and that a code names only a weekly; for a weekly, that the start is exactly what `weeklyStart(week, picks)` builds and that every step had everything open; that every fight's assists are values Settings offer (`ASSIST_VALUES`) and no fight has debug commands or config; that the claim's digest covers the steps. It plays every step through the run functions and every fight from `combatConfig(run, assists)`, never from a config in the file, each to its recorded hash and win at its recorded tick; it refuses a fight still under way at its last tick and one that runs more than 852 ticks (`FIGHT_TAIL_MAX_TICKS`) past its end; it requires the run to finish. Last it compares what the run plays to with the file's claim and with the code (score, won, fights, seconds, build, sim version, digest). Statuses: `verified`, `otherVersion`, `mismatch` (with a `problem`: `file`, `code`, `week`, `start`, `debug`, `claim`, `step`, `fight`, `unfinished`), `claimed` (a code only) and `playsBack` for every replay that is not a weekly ("Plays back as recorded on this device: an Echo, … Its start isn’t checked: only a weekly’s start can be rebuilt.").
- **Storage and the worker.** `src/app/replayStore.ts` (`openReplayStore`: `saveLog`, `loadLog`, `deleteLog`, `keep`, `kept`, `listKept`, `forget`), `replayFileName`, `replayFileBytes`, `readReplayFile`, which reads in chunks and refuses a file over 32 MiB or one that inflates past 64 MiB of JSON. `src/app/verify.ts` and `verify.worker.ts`: `verifyReplay(file, code?, onProgress?)` returns `{ result, cancel }`; the worker posts `ready`, and the main thread runs the check only when the worker cannot start.
- **The CLI** (`tools/run-verify.ts`): `npx tsx tools/run-verify.ts run.awrun [code]` verifies as the game does and prints what the player would read, its time and size (exit 0 for verified, another version or plays back; 1 otherwise); `npx tsx tools/run-verify.ts --record out.awrun --week 44 --bot skilled` (or `--prelude --seed N`) records a bot run and prints its code. It exports `recordBotRun`.
- **Measured** (W4, one Skilled-bot weekly, week 44 on the Expedition route of the three-entry rotation then registered, in Node): won, 15 fights, 4,225 points, 97,421 ticks, 77 steps; 1,169 KB of JSON, 184.9 KB gzipped; verification 2.0-3.0 s warm, 7-10 s cold under load; recording 3.5-7 s.

### Deeds

Fourteen Deeds appended last as `PHASE6_DEEDS` (44 in all). Every one has 0 Astrolabe points and pays a badge's 15 Starlight. Run rules are judged from the run; `stars`, `constellation` and `weeks` from the profile, by `profileDeedsEarned` when the Atlas or the weekly record changes. A frozen copy of the Phase 5 judge agreed with the current one for all 30 earlier Deeds on 600 generated runs (W2). "In sight" is when the Hall and the Codex list it (`deedsInSight`).

| Id | Name | Rule as built | In sight |
|---|---|---|---|
| `absolute_pitch` | Absolute Pitch | `runCount` of `perfects` ≥ 50 | from the start |
| `silent_bell` | Silent Bell | `movementWithout`, Movement 3, `cleanses` | once Movement III is sighted |
| `red_all_the_way` | Red All the Way | `heroCeiling`, Brann, 40%, no encounter: a won Expedition (also holds if he never fell to the line) | Brann in the roster and Movement II sighted |
| `out_of_tune` | Out of Tune | `dissonance`, `values.points` 10 | Dissonance open |
| `wolf_interval` | Wolf Interval | `dissonance`, 20 | Dissonance open |
| `tritone` | Tritone | `dissonance`, 30 | Dissonance open |
| `resolution` | Resolution | `dissonance`, `allLevels`; earns `title_resolved` (*the Resolved*) | Dissonance open |
| `final_bar` | Final Bar | `fight`, the Silent Conductor's encounter, `level: 'true_dissonance'` | Dissonance open and the Finale sighted |
| `crownbreaker` | Crownbreaker | `dissonance`, `level: 'tyrant'` | Dissonance open |
| `faint_star` | Faint Star | `stars` ≥ 1 | the Atlas lit |
| `whole_constellation` | Whole Constellation | `constellation` (any one) | the Atlas lit |
| `atlas_walker` | Every Star | `stars` ≥ 27 | the Atlas lit |
| `same_song` | Same Song | `weeks` ≥ 1 (weeks won, read from the codes) | the Atlas lit |
| `every_week_a_song` | Every Week a Song | `weeks` ≥ 4 | the Atlas lit |

`movementWithout` and `dissonance` are run-wide rules, so Echoes and Echo-route weeklies never earn them. The texts name "Movement III" and "Tyrant" in words (content's `deedText` fills no `{movement}` or `{level}`); Final Bar's reads "Beat {encounter}’s Postlude.". `heroCeiling` without an encounter changed `ceilingHolds`. Each new Deed has its own glyph; four kit icons are new (`forkStar`, `bellSlash`, `crownBreak`, `starsMany`).

### The UI

- **The Atlas station** (`'atlas'` in `STATIONS`, after Dissonance), lit with Dissonance or Skip the unlocks: the star chart (DOM and SVG), Echo cards, constellation panels and keepsakes; beginning an Echo goes to Prep with its twists. Files `atlasModel.ts`, `AtlasParts.tsx`, `atlasActions.ts` (the `AtlasActions` adapter) and `atlasWiring.ts` (it on the stores), with a `useWeeklyVerify` store.
- **The weekly panel** (`WeeklyPanel` from `weeklyPanelFrom`): week, days left, entry, best, Begin, Share, Add a code, Open a replay, the board with each row's status (Verified, Verified on another version, Claimed, Didn't match) and the verification's progress and message (a replay that isn't a weekly says it plays back). Status colours were re-picked after measuring under the colour-vision rules (Verified and another version had been 2.8 ΔE apart under deuteranopia; now at least 20, each with its own glyph).
- **Prep**: an Echo's twists and a weekly's fixed choices (shown locked), forced-level rows, the three new levels, "out of 42", True Dissonance's "Expeditions only"; a weekly's open variants are worded for the week; a weekly on an Echo route shows its own panel.
- **In the fight**: Tyrant's edict as a decree banner and a line under the boss bar (`usePhase6Decrees` on the runtime's listener; `runtime.ts` is untouched), from content's `tyrantDecreeOf`; the Postlude's fourth pip, rise countdown and decree said once; Mimicry's first-sighting id `'mimic'`; an Echo leg's eyebrow ("Retrograde · leg 1 of 3 · step 1 of 3") and its Movement on the Result.
- **Summary**: the Atlas card (stars lit and their rewards), the weekly card (score, code, Share), the replay line (a weekly's kept by itself, an Echo's Keep), and the first-clear card without "Coming later" for the Atlas.
- **Codex**: an Atlas page; the Dissonance page's "still to come" is content-driven (`laterLevels()`) and now empty. **Hall of Deeds**: the new Deeds as they come into sight, their glyphs, and the profile Deeds' progress ("4 of 27 stars", weeks won). **Atelier**: earned Atlas looks and earned Atlas and Deed titles.
- **Labs**: 34 Phase 6 views (`src/ui/lab/phase6Lab.tsx`, `phase6Fixture.ts`) and the weekly bench (`weeklyBench.tsx`, `weeklyBench.worker.ts`, `weeklyBot.ts`), where a bot plays a weekly in a page worker.

### VFX and audio

- **Tyrant**: the boss wears a borrowed accent ring (two dashed hoops in the foe's accent, kept at Flashes 0) for the phase; a crown sigil (`SPRITE.crown`) only while it casts the borrowed attack; an edict visual and sound at `tyrantEdict`; the boss's own voice under the foe's cast sound (`TYRANT_VOICE_PEAK` 0.06, never in Stasis). When the Conductor holds its own attack there is no ring, the crown is in the baton's brass, and the voice still plays (`isBorrowed`, `tyrantMarkHex`, `tyrantFoeName`, which is null for a boss's own attack).
- **Mimicry**: the Rift mirror gem was drawn only inside the elite-crown block; it now shows on an ordinary marked enemy (checked on the Bell Brute, Glass Lancer, Leech, Impaler and Sanguine Hound).
- **The Postlude**: the sky rings re-light innermost first over the rise (`postludeSky`); the Conductor's rise pose wins over the spawn look while `spawning` and its life bar refills as it stands; the Finale's stems reopen through the rise, then the full choir with the melody in pairs (`MusicInputs.postlude`); the enraged state adds the top layer (the builder's reading: the design gives it no look); a pair cue line and answering voices at `postludePair`, the answer replacing the second voice's ordinary Cue phrase.
- **Atlas sounds** through `playUi`: `atlasStar` (`{ stars: 1 | 2 | 3 }`), `atlasConstellation`, `runVerified`, `runMismatch`.
- No new scene object or batch; the Spire and Rift render snapshots unchanged. In each audio snapshot file three entries moved (`dis-toggle-low`, `dis-toggle-off`, `dis-toggle-climb`), because the toggle's tension is a share of `dissonanceMax()`, now 42; they were re-recorded with a comment. The labs: VfxLab "Phase 6 · Tyrant and the Postlude" (its Tyrant scenarios read `TYRANT_TABLE`), AudioLab group `phase6`, `__VFX__.phase6Scenarios`.

### The Expert and the harness

**The Expert** (`src/bots/expert.ts`) is a `SkilledBot` through `SkilledOptions.expert` hooks (inert when absent), deciding every 2 ticks (`EXPERT_EVERY`), answering calls after 0.25 s, attention 1, with its own generator (`EXPERT_SALT`). With every Expert rule off it sends exactly the commands of `new SkilledBot(seed, { every: 2, attention: 1, callReaction: 0.25 })`. Its rules (`EXPERT_RULES`, each skippable; `ExpertBot.play.fires` counts them):

- `tyrantFocus`: Focus a boss casting an interruptible borrowed attack (the Mending Hymn).
- `tyrantWard`: while the boss's telegraph of this phase's borrowed attack is live and a Ward answers it, keep the last Ward charge for it (keyed on the live telegraph only; no rule reads an enemy's cooldown).
- `mimicFocus`, `mimicCrack`: Focus a mimic casting its mirror while few enemies stand; send the Thread to Empower for the cast's last moment so a Ward or Chime copy cracks.
- `restlessHold`: no Focus onto an enemy standing back up (Restless Dead's or the Postlude's rise); a Chime never aims at an enemy, so only Focus is held.
- `postludeRise`: no damage Cue, Grand Finale or last-burn Cue into the untouchable Conductor.
- `postludeBank`: once Discord passes 70 in the Postlude, hold the Crescendo (on a Conductor run the Grand Finale itself) for Fortissimo Silence.
- `postludePair`: keep the last Ward charge for a pair's Solos.

**Run policy** (`src/bots/expertRun.ts`): `expertNode` takes an elite when the party averages 70% life or more (`ELITE_AT`); `expertRespite` rests when a hero is under 50% or Shaken (`REST_BELOW`); `expertDraft` and `expertMotifOrder` by rarity, then tags shared with the Calling (`CALLING_TAGS`) and Chords, then levelling; `expertRelic` by rarity; `expertShop` a relic it can pay for, else a motif level (healing under 60%); `EXPERT_PATHS` per Calling. **Build**: `rank20Build(party?)` in `tools/dissonance.ts` (the 29-point tree, the carried set, `expertBonds` at rank 10, a Chord preset).

**`playRun`** gains `nodePrefer`, `respitePrefer`, `shopPrefer`, `motifOrder`, `echo`, `week` and `onReplay` (records the run with `RunRecorder`; refuses with `threatMult` or `THREAT_PER_ROW`), each absent meaning as before. The harness modes:

| Tool and flag | What it plays | Example |
|---|---|---|
| `tools/dissonance.ts --tiers` | whole Finale-route Expeditions at each tier's fixed set (`TIERS`), Calling rotating by seed, Rank 20 build; `--bots`, `--policy all\|expert\|none`, `--only`, `--sets`, `--seed-base`, `--loadout` | `npx tsx tools/dissonance.ts --tiers --seeds 20 --bots expert,skilled --only 10,20` |
| `tools/dissonance.ts --echoes` | whole Echoes at each star's points (`ECHO_TIERS` 0, 10, 20); `--echo`, `--only`, `--bots`, `--policy`, `--seed-base`, `--loadout` | `npx tsx tools/dissonance.ts --echoes --seeds 20 --echo strangers,the_unrested --only 0` |
| `tools/dissonance.ts --weekly` | each rotation entry on weeks holding it; `--entry`, `--bots`, `--policy`, `--loadout`, `--week-base` (44) | `npx tsx tools/dissonance.ts --weekly --seeds 8 --entry 3,8 --bots expert` |
| `tools/verbs.ts --bot expert`, `--dissonance id[:rank],…` | the Expert's rule ablations, at Phase 6's levels | `npx tsx tools/verbs.ts --bot expert --movement 2 --encounters vharun --dissonance tyrant` |
| `tools/harness.ts --bots expert` | the Expert in cells and whole runs (its bands are reference lines) | `npx tsx tools/harness.ts --movement 4 --seeds 50 --bots expert,skilled` |
| `tools/run-verify.ts` | verify or record a run replay (above) | `npx tsx tools/run-verify.ts --record out.awrun --week 44` |

Echo lengths are read by `--echoes`, not `tools/pacing.ts`. Recorded Expert Echo runs and Echo-route weeklies verify. W7's first looks (4 seeds each, not band readings; the bands are read in the section that follows): tiers 0 and I 4 of 4, II 2 of 4, III and IV 0 of 4, most losses in a Movement I or II elite the 70% rule chose; Echoes at ★ 6.6-11 min, under the 12-22 min band but for Strangers (14.3); weekly entries 0, 9 and 10 won 0 of 4 by both bots. `tyrantFocus`, `postludeRise` and `postludeBank` were met rarely or never in those fights.

### Goldens and the Dissonance pins

**32 goldens** in `tests/sim/golden.json` and `m1Unchanged.test.ts`: the 28 earlier ones unchanged, then `skilled-tyrant-vharun` `98edc77c35e67af0` (re-recorded after review A's table fixes; first `9a97b9f283a51ae8`), `novice-mimicry-first-light` `727ddeaca04419a3`, `skilled-postlude` `3ca13e1f0491dc46` (`PHASE6_HASHES`) and `skilled-echo-bells-in-the-rift` `07fd95fcfee7c80b` (the Hollow Cantor at Bells in the Rift's leg scale, `ECHO_HASHES`). `skilled-postlude` joins the fight-replay round-trip in `tests/sim/determinism.test.ts` (ten scenarios).

**The Dissonance pins** (`tests/sim/dissonancePins.json`, recorded by W0 before any source change): 51 fight hashes (the `skilled-bellwarden`, `skilled-vharun` and `skilled-conductor` goldens with no level, each of the 15 level-rank settings, and all twelve levels at their top ranks) and five whole runs pinned by SHA-256 digests (`prelude-30`, `finale-30`, `finale-10`, `prelude-light`, `finale-light`). Levels are listed literally, so appended levels never enter them. They were byte-identical at every merge and in both reviews.

### Versions

- `SIM_VERSION` **22** (unchanged).
- Fight replay format **6** (unchanged); run replay `aetherweaver-run` **1** (new; no bump and no new field from the review fixes).
- Run save **5** (four new optional keys); `PROFILE_VERSION` **10** (from 9; the v9 → v10 step changes only the version).
- `contentVersion` **`c-f12d6774f5775748`** (`tests/sim/golden.json`), from `c-3d16ade0f5775748` before Phase 6. Only that line of the golden file moved for the earlier 28.

### Differs from the design

1. **The Tyrant table.** The design (as first written) had the Leech's Latch for Vharun's phase 1 and the Shears' Shearing Dash for the Seamstress's phase 1. Built: Impaler · Charge for both. The Latch's 1.8 m reach never met Vharun's tank, so it was never cast; the Hemomancer's Blood Pact, W1's first swap, duplicated a Pact Vharun already casts; the Charge is the only other Movement II attack that is really cast, so Vharun's phases 1 and 2 borrow the same attack. The Shearing Dash cuts the Thread (held for the owner, below). W1 had also moved the Matriarch's phase 2 to the Blood Pact; review A found the Latch was cast there, and it went back.
2. **The Conductor's single clock and `TYRANT_OWN`.** The design had Tyrant "play its own closing attacks earlier", on top of its picker. As first built that was a second clock on attacks it already casts (review A F4: Sforzando roughly every 6.5 s instead of 13 in phase 1, the decree's "early" untrue, the crown on ordinary casts). Built: one clock; its picker leaves the held attack alone, and the hold casts it every 5.5 s (Sforzando) and 4.5 s (Downbeat), set so the rate it is really cast at stays the first build's (measured over five seeds, seconds per cast: before 6.67 and 6.05, after 6.76 and 6.42). The decree says "plays its X more often".
3. **Tyrant's decree** names Focus only for an interruptible attack (the design's text built answers from every tag).
4. **`finalePar`.** The design left the Postlude counting against the Finale's par (reconciliation item 1, "nothing built until you say"). Built by default: True Dissonance's `values` gain `finalePar: 40`, and the Silent Conductor fight's par is × 1.4 on that level.
5. **True Dissonance off the Finale** is dropped on any route without it, Echoes included, not only on Preludes.
6. **Mimicry's wording**: "In each wave, {perWave} enemy that isn’t a boss or a mini-boss carries Mimicking…", not "In every wave": boss and mini-boss waves have none. The quoted line in the design and the *Contracts* block keep the first text; the *Contracts* block also predates `finalePar`.
7. **The Echoes.** Choir of Blood has no leg scale (each encounter's own Movement's scale, which is what the design's route describes). Retrograde ends each leg at that Movement's boss (three bosses), not only at the Hollow Cantor. The Hard Bargains Echoes play Movement I's shorter road and a shortened Movement II, not the two whole roads. The Last Rehearsal's Conductor leg is built over Movement III's pools.
8. **Echo Calling rows** are derived per Echo from its own route; on five Echoes (Bells in the Rift, The Seamstress's Court, Retrograde, The Last Rehearsal, The Gilded Road) one fight brings two tiers. The design did not say; `CALLING_ROWS` would have left some tier unreached on 7 of 9 Echoes (review B M3).
9. **The Echo golden** is `skilled-echo-bells-in-the-rift`, not `skilled-echo-choir-of-blood`, since Choir of Blood has no leg scale to pin.
10. **Non-weekly replays never read Verified.** The design's messages assumed a checked start. Only a weekly's start can be rebuilt, so an Echo, Expedition or Prelude replay that plays to its claim reads `playsBack` ("Plays back as recorded…"), and `run-verify` exits 0 for it.
11. **Adding codes.** A code is accepted only for the last 12 weeks ending now, and never pushes out a week holding the player's own runs. A side effect: with 12 weeks of the player's own kept, no code for a new week can be added until they play one.
12. **Echo-route weeklies** count as Echoes for run-wide Deeds (decision 10 had every weekly count).
13. **Recording** is on for weeklies and Echoes only (the design had the run store record every run). The player's own weekly replay is kept by itself at the Summary (the design had files kept only on *Keep*); an Echo's has Keep.
14. **The Expert's `playRun` options**: the design expected only node and Respite options; built also `shopPrefer` and `motifOrder` (plus `echo`, `week`, `onReplay` for Echo and weekly runs). `tyrantWard` is a rule of the builder's own; `tyrantFocus` keys on any interruptible borrowed attack; `restlessHold` holds Focus only.
15. **The share code** has 4 spare bits: 140 bits fill the 28 characters, where the design's table totals 136.
16. **The verifier refuses more** than the design listed: a fight still under way at its last tick, a tail past 852 ticks, assists no setting offers, schema bounds, deep nesting, unknown encounters and events, oversize files (review B).
17. **The weekly e2e test** plays the current week's real entry in the page (week 44: Strangers, an Echo route), not a Prelude-route test entry, and a real weekly's first fight through the combat screen.
18. **Unearned Atlas looks** are hidden in the Atelier and shown as locked keepsakes in the Atlas station, not as locked teasers in the Atelier.

### Review

**Review A (the fight)**, at `56129a4`, found 4 major, 6 minor, 3 questions and 1 note. Majors: the Postlude could have three damaging telegraphs live (F1); Stasis did not hold Tyrant's clock (F2); Foresight never showed the borrowed attack (F3); the Conductor's Tyrant row was a second clock (F4). Minors: a pair could name a dead voice (F5); Mimicry's text (F6a); the decree's Focus and possessive (F6b); the doc's table (F6c); the Latch swap held only for Vharun and Vharun's borrowed Pact duplicated its own (F6d); the Expert's `tyrantWard` read a hidden timer (F7). All were fixed: F1-F6d on `p6/fixA` with `tests/sim/reviewA.test.ts`, F7 by W7 (`tests/bots/expert.test.ts`). Q1 (the Seamstress's Dash cutting the Thread) was swapped by default and held for the owner; Q2 (no HUD read the edict) was W5's part B; Q3 (the "without you" reading in the Postlude) was deferred; the note (Tyrant on `bossId` only) was accepted. Determinism, additivity and every pin held.

**Review B (everything outside the fight)**, at `56129a4`, found 2 blockers, 5 major, 6 minor and 4 questions. Blockers: the verifier stepped to any `finalTick`, so idle ticks after a win healed the party (a forged week-44 weekly read Verified at 2,725 against 2,695 honest) (B1); hostile files threw and re-ran on the main thread (B2). Majors: impossible assists accepted (M1); a lost in-place step passed `logFits` (M2); Echo Calling tiers on `CALLING_ROWS` (M3); a run save with a Rewind marker failed to load, from Phase 3e (M4); no limit on inflated size (M5). Minors: non-weekly replays read Verified (m1); `addWeeklyCode` took any week and could evict the player's weeks (m2); weeks outside the code's range could start (m3); an own entry could stay Claimed (m4); recording could lose a step silently (m5); one corrupt key dropped the Atlas or the run (m6). All were fixed on `p6/fixB`, with `tests/meta/reviewB.test.ts` (one describe per finding). Of the questions: the × 1.4 par was kept and listed for the owner (q1); Echo-route weeklies count as Echoes (q2, fixed); changing the clock to earn the weekly Deeds was accepted (q3); a thirteenth rotation entry would never play, so a lint now requires exactly 12 (q4). All twelve rotation entries recorded and verified against their own codes.

**Deferred**: the "without you" reading in the Postlude; the copies `runtime.ts` and `settings.ts` keep of constants the run layer now exports; F5's note that a pair's second Cue overwrites `f.cue` while the first Solo is live; Foresight's limit (a follow-up registered mid-chain still goes first, as for a boss's own specials).

### Verification as run

- **Full suite on the landed tree**: 223 files, 4,857 tests passed, 8 skipped, 2 todo, none failed.
- **Typecheck and lint** (with `prettier --check`) clean.
- **The golden dry run**: up to date.
- **13 baseline checks byte-equal**: `tools/m1-baseline.ts --check` for Movements I-IV (270, 270, 240 and 30 fights), `tools/expedition-baseline.ts --check` for 2, 3 and 4 Movements (10 runs each), and parties A, SB and OC (Movement IV fights and four-Movement runs for each).
- **e2e, on the UI branch**: the five Phase 6 tests passed (9.1 min): the Atlas station with every Echo and an Echo begun to Prep; This Week's Song from the panel to Prep with its choices locked; the UI lab's Phase 6 groups; a weekly played by the Skilled bot in a page worker, verified in the page and played twice bit for bit (every fight's hash and the digest equal); and a real weekly's first fight played through the combat screen, its replay handed to the run. Measured in that run (one run, week 44, under software rendering): 51,654 ticks, 3,704 ms to play and 2,761 ms to verify in the page, and in Node "Verified on this device: Week 44, won, 2,665 points, 14 min of fighting."
- **The whole e2e suite on main** at the landing commit: 36 of 36 passed in 39.7 min (31 earlier tests and Phase 6's five). It ran once, before tuning; it was not re-run after the tuned values.

### Not verified

- No person has looked at the new views in play or listened to the new sounds; the labs were not opened in a browser by the owner, and reduced motion was not observed. Screenshots were taken during the build (`/home/user/aw-work/6/w5/shots/`, `shots-b/`).
- Keeping and loading a replay in real IndexedDB from the panel; the Share button's file download; the Echo Keep button.
- Two Calling tiers in a row as rendered; an Echo's map and Calling rows in a real browser play-through.
- Rewind during the Postlude's rise or a pair; Echo legs with the new levels; Foresight's hold beyond two bosses; the Conductor's single clock beyond five seeds; the Tyrant look with the real sim beyond the Bellwarden and the Conductor.
- Verification time in a browser on the reference laptop (the page figure above is from the test machine), and on a long Finale-route weekly; a person's replay size and tail; the gzip-bomb refusal in a browser (measured in Node: an 80 MB bomb answers "Can’t be read" in 0.1 s); the main-thread fallback when a worker cannot start.
- The rule-1 report tools byte for byte against a pre-W0 tree (W7 compared 13 modes of the tools it edits, before and after, all byte-identical); the build's chunk-size warning against before.
- Balance: Echo lengths and win rates, the rotation's entries, the tiers (first looks only; read in the section that follows).

### Open

1. **The "without you" reading in the Postlude** reports the boss "still at 25%" on a timeout although it fell once (review A Q3).
2. **The content hash's second FNV lane** is still weak (every `contentVersion` ends `f5775748`); share codes use only the first 32 bits.
3. **`src/app/runtime.ts` and `src/app/settings.ts` could import the shared constants** (`FIGHT_END_DELAY_MS`, `WITHOUT_YOU_GRACE_MS` from `src/meta/runEnd.ts`; `ASSIST_VALUES` from `src/meta/runReplay.ts`) instead of their literals; the values are the same today and a test pins `ASSIST_VALUES` to `SettingsSchema`. Both files had no owner this phase.
4. **The lab bench's copy of the bot recorder loop** (`src/ui/lab/weeklyBot.ts`) copies `recordBotRun`, which imports Node modules; the two can drift.
5. **Borrowed Crowns' panel header wraps** (name and "3 of 9 stars" on two lines each) at the lab's width.
6. **The Atlas station's mint is 4.6 ΔE from Training's cyan under tritanopia**; the stations carry a name and a drawing.
7. **The borrowed accent ring is not colour-safe by colour alone** (the Acolyte's accent equals the call gold; the Bell Brute's is within 1.0 of Empower under protanopia); its meaning is carried by the band's shape and the crown.
8. **Vharun borrows the same attack (Impaler · Charge) in two phases.** The other candidate, the Finale road's Toll Cleave, was cast once in 60 s.
9. **The Seamstress's borrowed attack** is held for the owner (*Decisions for you*, below the table).
10. **Earned looks carry a price of 90** only because the schema requires one.

## Tuning

W8 tuned Phase 6's own numbers against *Bands*, in the levers' order, with the Expert at Rank 20 (`rank20Build`, the Guardian preset, the Calling rotating by seed among none and the four, each on its `EXPERT_PATHS` path) and its run policy, through the harness's `playRun`. The scratch folder of the tuning is `/home/user/aw-work/6/w8/` (`LOG.md` records each round in order, with its command and numbers; every reading below is a `.jsonl` file there, one line a run).

**The protocol as run (reduced).** The doc's protocol (100 seeds on each of 2000, 900007 and 333003, about 1,500 Expeditions a tier) was too heavy for the shared machine in one sitting, so:

- *Iterating*: 20 seeds on run bases 2000 and 900007 (40 runs a cell); single cells at 10-12 seeds only as a screen, never as a decision.
- *Final readings*: the tiers at **50 seeds on each of 2000, 900007 and 333003** for the Expert (333003 read only once, at the end) and **30 a set** for the Skilled bot with the same build and the harness's own run policy; the Echoes and the twelve weekly entries at **20 seeds on two bases** (Echoes: run bases 2000 and 900007; weekly: the 20 weeks holding the entry from week 44 and from week 1044), 40 runs a cell, Expert and Skilled; the new levels' costs by 4d's method at its own size (300 Prelude runs, the Novice, the Rank 20 build); the True Dissonance Finale cell at 20 seeds on cell bases 1000 and 500003 (arrival kit IV and the Rank 20 tree, the Calling rotating by seed).
- A cell is marked *inside*, *outside*, or *on the edge* when it lies within one binomial standard error (√(p(1−p)/n)) of a band's bound. A band is met only when every set is inside or on the edge.
- Echo and weekly lengths are `tools/pacing.ts`'s clock (each run's fights plus its `AROUND` allowance for every screen and 90 + 45 s before and after the run), as the band names it; `tools/dissonance.ts --echoes` prints minutes of combat only, which is why the first look read 6.6-11 min.
- The runs were played by a scratch runner (`run.mts`, `cell.mts`, `d4.mts` there) that calls the same functions as `tools/dissonance.ts --tiers`, `--echoes` and `--weekly` (`tierRun`'s options, `echoRun`'s, `weeklyRun`'s) and writes one line a run; candidate values were tried by overriding content in that process only, and every adopted value was then read again from the committed content (the Echo readings matched the candidates' run for run).

### What moved

| Where | Entry | Before | After | Lever | The reading that drove it |
|---|---|---|---|---|---|
| `src/bots/expertRun.ts` | `expertNode` (the Expert's map rule) | an elite whenever the party averages ≥ 70% life | an elite only when the party averages ≥ 70% (`ELITE_AT`), the run's levels in force are worth under 20 points (`ELITE_UNDER`; an Echo's forced levels count) and Elite Vanguard is off (`ELITE_SHUNS`); else a node that isn't an elite | 6 | the ablation below: never taking an elite won the same at tiers 0 and I and 15-43 points more at II-IV, where 25 of 26 tier II losses with the old rule were Movement I-II elites |
| `src/bots/expert.ts` | `tyrantWard` | a rule | dropped (with its staged test) | 6 | changed commands in 10 of 42 Tyrant boss fights, won none, cost 6 more downs (W7's ablation) |
| `src/content/crucible.ts` | `POSTLUDE.life` (True Dissonance's text reads it) | 0.3 | **0.6** | 1 | the Postlude lasted 32 s in the Finale cell (band 45-120 s); at 0.6 it lasts 68 s (83 s without the Conductor Calling) |
| `src/content/echoes.ts` | Choir of Blood | its leg at each encounter's own scale | the whole leg at Movement II's scale | 4 | ★★★ 23/40 (58%) → 17/40 (43%) |
| | The Seamstress's Court | the Crimson Ascent's rows, own scales | the same rows with its Respite row a Merchant, Forge or event, the whole leg at Movement III's scale | 4 | ★★★ 26/40 (65%) → 19/40 (48%) |
| | Retrograde | leg scales I, II, III; a Respite row before Vharun and the Cantor | leg scales II, II, III; those rows a Merchant, Forge or event | 4 | ★★★ 28/40 (70%) → 15/40 (38%) |
| | The Last Rehearsal | each boss at its own scale | the Hollow Cantor and Vharun at Movement III's scale | 4 | ★★★ 32/40 (80%) → 11/40 (28%) |
| | Strangers | Movement I's shorter road and Movement II's shortened road (shared with A Cappella) | its own road: no fork rows, no Matriarch; First Light pays an epic motif and a relic offer | 4 | length 26.6 min → 19.9 min (band 12-22); ★ 37/40 → 40/40, ★★★ 9/40 → 9/40 |
| | The Unrested | the shared road | its own: the same rows at Movement III's scale, without the richer first rows | 4 | ★★★ 36/40 (90%) → 13/40 (33%); ★ 40/40 → 33/40 |
| `src/content/weekly.ts` | entry 0 | Chronomancer; Kael, Vexis, Seren; Hardened ×2, Wounding Strikes ×2 (10) | Kael, Lyra, Vexis; Short Fuse, Wounding Strikes ×2 (5) | 5 | 0/6 for both bots; Kael, Vexis and Seren (and Kael, Lyra and Seren) lost most runs at 3-5 points too, while Kael, Lyra and Vexis won 8/10 for both bots at Wounding Strikes ×2 |
| | entry 1 | Restless Dead (5) | Brisk Foes, Short Fuse, Restless Dead (7) | 5 | Expert 37/40 (93%) |
| | entry 4 | Brisk Foes, Tyrant (5) | Silent Cues, Tyrant (5) | 5 | Expert 16/40 (40%) |
| | entry 5 | Hardened (3) | Brisk Foes, Hardened (4) | 5 | 6/6 for both bots |
| | entry 8 | Short Fuse ×2 (2) | Hardened ×2, Short Fuse ×2 (8) | 5 | on Strangers' shorter road: Expert 38/40, Skilled 33/40 at 5 points |
| | entry 9 | True Dissonance; Kael, Seren, Oro (5) | Hardened, True Dissonance; Kael, Lyra, Vexis (8) | 5 | with Kael, Seren and Oro the Expert won 1/6 (5/10 at the tuned Postlude), the Skilled bot 0/6 (1/10) |
| | entry 10 | Bells in the Rift; Martyr; Kael, Brann, Oro; Hardened, Unforgiving (4) | Choir of Blood; Martyr; Kael, Lyra, Seren; Unforgiving (1) | 5 | Bells opens on the Descent's first fight at full strength: 0/6 and 0/10 on the level field with both parties tried; Kael, Brann and Oro lost every run on three routes |
| | entry 11 | The Unrested; Blind Score (2) | Retrograde; Blind Score (2) | 5 | The Unrested at its tuned strength: Expert 8/40 on the level field, 3/12 with no extra level |

The entries' comments state their points; `tests/meta/weekly.test.ts`'s line for entry 0 reads "The Chronomancer, with Kael, Lyra and Vexis, at 5 Dissonance". The twelve entries keep the pairing lints (an Echo route's Calling and party agree with its twists), none names Muted Choir, and True Dissonance is only on entry 9, a Finale route.

**Nothing else moved**: Tyrant's `cooldown` 150 and `first` 6, `TYRANT_OWN` 5.5 / 4.5 s, `TYRANT_BURN` 7 / 9 s, Mimicry's `perWave` 1, the Postlude's Cue gap 14 s, pair gap 1.5 s, Discord 1.5/s, enrage at 90 s (Cues every 10 s, Discord ×2), `finalePar` 40, the three levels' points, the Tyrant table, the Echoes Bells in the Rift, the Gilded Road and A Cappella, rotation entries 2, 3, 6 and 7, every Expert constant but the map rule. No aura, ornament, existing level, enemy, boss, hero, Calling, bot or tier set moved.

### Round by round

1. **The Expert's map rule first** (as asked). Tiers 0-IV at 20 seeds on 2000 and 900007, the old rule against "never an elite" (`r1-cur`, `r1-never`, 40 runs a tier): 39 / 40 against 40 / 40 at tier 0, 34 / 40 against 34 / 40 at I, **14 / 40 against 31 / 40 at II, 3 / 40 against 9 / 40 at III, 3 / 40 against 9 / 40 at IV**. With the old rule the Expert took 1.1-1.9 elites a run at II-IV and lost 25, 33 and 34 runs there in an elite (Shattered Choir, Muted Nave, Shield Wall with Elite Vanguard's extra elite and affix). An elite's relic never paid back in these runs: at tiers 0 and I the two rules tie. The rule settled on weighs the route's Dissonance (its total and Elite Vanguard itself) and the party's state, and keeps elites where they cost nothing measurable: it plays as the old rule at tiers 0 and I and never takes an elite at II-IV. On the level field (the weekly, no build), "never" against the rule read 38 / 72 against 43 / 72 over the twelve entries at 6 weeks each (`wk1n`, `wk1`), so the rule stays there too.
2. **True Dissonance's Postlude** in the Finale cell (Expert, `c1`, `c1td`, `c2*`-`c4*`): without the level 40 / 40 won, the fight 142-158 s (52 s on Conductor runs); with it at 30% life 39 / 40, the Postlude 32 s on average (36-41 s by Calling, 6 s on Conductor runs). Life 0.5, 0.6 and 0.7 gave Postludes of 69, 83 and 93 s without the Conductor Calling; faster Discord (2/s), a shorter Cue gap (11 s) and an earlier enrage (60 s) changed neither the length nor the wins by more than a run (37-39 / 40 for every variant). 0.6 was kept: the Postlude sits in the middle of its band, and the longest single one (182 s, a Martyr run) stays near the band's top. `finalePar` 40 was kept: without the Conductor Calling the fight grows 73-93 s (83 on average, 41% of the 200 s par).
3. **Tyrant and Mimicry by 4d's method** (`d4`, `d4m`): Tyrant reads **−7.1%** enemy life (82.0% won against the base's 75.0%), Mimicry **+0.9%**, against bands of 24-40% and 16-32%. Mimicry's count is its only lever: 2 a wave read +3.4%, 3 a wave +3.2%, so it stays at 1 (decision 3's readability). Tyrant makes the Prelude **easier**: in the Bellwarden's cell (the Novice, the bare kit and the tree, 40 seeds, `ty-*`) it wins 34 / 40 without Tyrant and 40 / 40 with it, downs 2.1 → 0.3 a fight, and 40 / 40 again at a cooldown multiple of 100%, 38 / 40 at 250% and 40 / 40 with the Bell Brute's Toll Cleave in phase 1; at the Hollow Cantor it costs downs (4.9 → 8.1) but no wins. The cause is in the sim, not its numbers: the borrowed attack is the picker's first try (`tryTyrant`, `src/sim/systems/enemies.ts:503`), so each cast takes the place of one of the boss's own specials (the Bellwarden's Tolls, Slam and Call, which summons). [Round 2: the picker now tries the borrowed attack last and credits its time to the boss's own clocks; see *Round 2* below.] In whole Expert runs at tier III, Tyrant and Mimicry each cost about three runs in 40 (on the same 40 runs: 13 / 40 without Tyrant, 13 / 40 without Mimicry, 10 / 40 with both; `tnoty`, `tnomim`, `tf-0`/`tf-1`); a cooldown multiple of 100% or 75% with a first cast at 3 s (`tv1`, `tv2`), a 75% Postlude (`tv3`) and faster closing attacks (`TYRANT_BURN` 5 / 7 s, `tv4`) moved tiers III and IV by no more than noise. None was kept.
4. **The Echoes** (`e1`, `e2`, `ef`, `ev1`-`ev5`, `g0`, `g1`). By the doc's clock, eight of nine Echoes were already inside the length band at ★ (14.0-21.7 min); only Strangers (26.6) was over it, its party fighting slowest. Each was read at ★ and ★★★ (Tier 0's and Tier II's levels) on 40 runs: ★ read 93-100% on all nine and ★★★ 58-90% on five (Choir of Blood, the Seamstress's Court, Retrograde, the Last Rehearsal, the Unrested), so the Echoes were made harder, by scale first (whole legs at a later Movement's scale) and by Respite rows where scale alone fell short, and Strangers shorter. The Gilded Road read 0 / 10 at ★★★ on the first look and 7 / 40 at the protocol's size, so it was left as built (a fixed Blood Forge first and a richer first row read 9 / 40, no different). Choir of Blood without its two Respites read the same as with them (22 / 40); its scale did the work.
5. **The weekly rotation** (`wk1`-`wk5`, `wf`, `wf2`-`wf4`): screened at 6-12 weeks an entry, then read at 40. Two causes dominated: the party on the level field (entries 0, 9 and 10 lost most runs with Kael, Vexis and Seren, Kael, Seren and Oro, or Kael, Brann and Oro), and Echoes whose first fight is at Movement III's scale (Bells in the Rift, and after round 4 the Last Rehearsal and the Unrested), which a party with no build seldom survives. Entry 9 was also read at Hardened, Wounding Strikes and True Dissonance (10 points): the Expert won 36 / 40 either way, so the 8-point entry was kept.

### The final tables

**Tiers** (whole Finale-route Expeditions, Rank 20 build, Guardian; Expert with its run policy, 50 a set; Skilled with the harness's policy, 30 a set; `tf-0`, `tf-1`, `tf3`, `tfs`).

| Tier | Expert 2000 | Expert 900007 | Expert 333003 | Band | Verdict | Skilled 2000 / 900007 / 333003 | Skilled band |
|---|---|---|---|---|---|---|---|
| 0 | 49/50 (98%) inside | 50/50 (100%) inside | 49/50 (98%) inside | ≥ 90% | **met** | 29/30 / 29/30 / 29/30 (97%) | reported |
| I (10) | 44/50 (88%) edge | 42/50 (84%) inside | 45/50 (90%) edge | 70-90% | **met** | 25/30 (83%) / 24/30 (80%) / 25/30 (83%) | ≤ Expert − 10: **missed** on all three (−5 / −4 / −7) |
| II (20) | 35/50 (70%) edge | 40/50 (80%) **outside** | 34/50 (68%) edge | 40-70% | **missed** on 900007 | 16/30 (53%) / 11/30 (37%) / 10/30 (33%) | ≤ Expert − 10: met |
| III (30) | 16/50 (32%) inside | 13/50 (26%) inside | 19/50 (38%) edge | 15-40% | **met** | 3/30 (10%) / 2/30 (7%) / 4/30 (13%) | ≤ Expert − 5: met |
| IV (42) | 11/50 (22%) **outside** | 7/50 (14%) edge | 9/50 (18%) edge | 2-15%, > 0 on every set | **missed** on 2000 (above 0 on all three) | 5/30 (17%) / 2/30 (7%) / 1/30 (3%) | reported [Round 2: 18% / 16% / 14%, met] |

Reached the Finale over the three sets: tier 0 148 / 150, I 132, II 109, III 52, IV 31; won ÷ reached 100%, 99%, 100%, 92%, 87%. Minutes of combat a run: 17.5, 23.7, 21.8, 13.9, 12.6. At tier IV the Postlude (the fight's end less the rise) lasted 127-192 s on the runs without the Conductor Calling and 17-49 s on Conductor runs. The Novice and the Idle bot were not run at the tiers.

**Each new level's cost** (4d's method: `tools/dissonance.ts --bot novice --seeds 300 --threat 1 --levels tyrant,mimicry`, base 75.0%, ×1.25 40.7%).

| Level | Novice wins | Costs like | Band | Verdict |
|---|---|---|---|---|
| Tyrant (4 points) | 82.0% | −7.1% enemy life | 24-40% | **missed** (below; the level makes the Prelude easier) [Round 2: 79.3%, −4.1%, still missed; Skilled +11.4%, Expert +7.2%] |
| Mimicry (3 points) | 74.0% | +0.9% | 16-32% | **missed** (below; 2 a wave +3.4%, 3 a wave +3.2%) |

**True Dissonance on the Finale cell** (Expert, arrival kit IV and the Rank 20 tree, the Calling by seed, 20 seeds on cell bases 1000 and 500003; `c1`, `c2c`).

| Calling | Without: won, fight (s) | With: won, fight (s) | Postlude (s) | Fight longer by (s) |
|---|---|---|---|---|
| none | 8/8, 158 | 7/8, 243 | 86 | 85 |
| Luminary | 8/8, 142 | 7/8, 215 | 75 | 73 |
| Martyr | 8/8, 158 | 7/8, 251 | 92 | 93 |
| Chronomancer | 8/8, 152 | 8/8, 231 | 79 | 79 |
| Conductor | 8/8, 52 | 8/8, 65 | 14 | 13 |
| all | 40/40 (100%) | 37/40 (93%) | 68 (range 12-182) | |

- Wins ≥ 75%: **met** (93%; 18 / 20 and 19 / 20 by set). At least 10 points below without it: **missed** (7.5 points; the Expert wins every cell without the level, so the band asks for ≤ 90%).
- The Postlude 45-120 s: **met** on average (68 s; 75-92 s by Calling without the Conductor Calling) but **missed** on Conductor runs (14 s: the Grand Finale ends it) and by one Martyr run (182 s).
- The whole fight no more than 150 s longer: **met** (13-93 s on average by Calling; one Martyr run 182 s).

**Echoes** (Expert, Rank 20 for each Echo's party, 20 seeds on 2000 and 900007; length is the pacing clock at ★, all runs; `ef`, `ef2`).

| Echo | ★ 2000 / 900007 | ★ band 60-95% | ★★★ 2000 / 900007 | ★★★ band 10-45% | ★ length (won runs) | Length band 12-22 |
|---|---|---|---|---|---|---|
| Choir of Blood | 19/20 / 20/20 (98%) | edge | 7/20 / 10/20 (43%) | edge | 17.5 (17.5) | inside |
| Bells in the Rift | 19/20 / 19/20 (95%) | edge | 3/20 / 2/20 (13%) | edge | 14.0 (14.5) | inside |
| The Seamstress's Court | 20/20 / 19/20 (98%) | edge | 9/20 / 10/20 (48%) | edge | 16.1 (16.3) | inside |
| Retrograde | 20/20 / 20/20 (100%) | **outside** | 6/20 / 9/20 (38%) | edge | 21.5 (21.5) | inside |
| The Last Rehearsal | 19/20 / 19/20 (95%) | edge | 6/20 / 5/20 (28%) | inside | 23.5 (24.0) | **outside** |
| The Gilded Road | 20/20 / 17/20 (93%) | edge | 2/20 / 5/20 (18%) | inside | 15.9 (16.9) | inside |
| A Cappella | 20/20 / 20/20 (100%) | **outside** | 10/20 / 7/20 (43%) | edge | 20.3 (20.3) | inside |
| Strangers | 20/20 / 20/20 (100%) | band ≥ 40%: inside | 4/20 / 5/20 (23%) | inside | 19.9 (19.9) | inside |
| The Unrested | 16/20 / 17/20 (83%) | inside | 5/20 / 8/20 (33%) | inside | 22.0 (24.0) | at the bound |

The ★ cells are read pooled over the two sets (40 runs; a set of 20 can't show a rate between 95% and 100%). ★★ (Tier I's levels) has no band and was read only on the first look, before the legs moved (`e2`, 10 runs: 2-10 of 10; Strangers 2 / 10). A ★★★ clear's own clock runs longer than ★'s (19-33 min), since its fights are longer.

**The weekly rotation** (Expert with its run policy, Skilled with the harness's, the level field and Guardian as the picks; the 20 weeks holding each entry from week 44 and from week 1044; `wf`, `wf3`).

| # | Entry | Points | Expert | Band 50-85% | Skilled | Band 25-70% | Mean score E / S |
|---|---|---|---|---|---|---|---|
| 0 | Expedition · Chronomancer · Kael, Lyra, Vexis · Short Fuse, Wounding Strikes ×2 | 5 | 30/40 (75%) | inside | 30/40 (75%) | edge | 3458 / 3479 |
| 1 | Expedition · Conductor · Kael, Lyra, Brann · Brisk Foes, Short Fuse, Restless Dead | 7 | 31/40 (78%) | inside | 8/40 (20%) | edge | 3440 / 1809 |
| 2 | Expedition · no Calling · Kael, Lyra, Vexis · Elite Vanguard | 5 | 25/40 (63%) | inside | 21/40 (53%) | inside | 3182 / 2493 |
| 3 | Choir of Blood · Luminary · Kael, Lyra, Vexis · Brisk Foes, Short Fuse | 2 | 19/40 (48%) | edge | 19/40 (48%) | inside | 1160 / 1215 |
| 4 | Expedition · Martyr · Kael, Lyra, Seren · Silent Cues, Tyrant | 5 | 22/40 (55%) | inside | 22/40 (55%) | inside | 2779 / 2535 [Round 2: the entry is Tyrant alone (4): 28/40 and 26/40] |
| 5 | A Cappella · no Calling · Lyra, Vexis, Oro · Brisk Foes, Hardened | 4 | 27/40 (68%) | inside | 22/40 (55%) | inside | 1986 / 1643 |
| 6 | Expedition · Luminary · Lyra, Vexis, Seren · Silent Cues, Mimicry | 4 | 22/40 (55%) | inside | 20/40 (50%) | inside | 2951 / 2839 |
| 7 | Retrograde · Chronomancer · Kael, Vexis, Brann · Fragile Threads, Wounding Strikes | 3 | 28/40 (70%) | inside | 21/40 (53%) | inside | 2027 / 1562 |
| 8 | Strangers · Conductor · Brann, Seren, Oro · Hardened ×2, Short Fuse ×2 | 8 | 30/40 (75%) | inside | 15/40 (38%) | inside | 1772 / 1306 |
| 9 | Expedition · Conductor · Kael, Lyra, Vexis · Hardened, True Dissonance | 8 | 36/40 (90%) | **outside** | 22/40 (55%) | inside | 3864 / 2860 |
| 10 | Choir of Blood · Martyr · Kael, Lyra, Seren · Unforgiving | 1 | 21/40 (53%) | edge | 18/40 (45%) | inside | 1282 / 1095 |
| 11 | Retrograde · Luminary · Kael, Lyra, Vexis · Blind Score | 2 | 34/40 (85%) | edge | 22/40 (55%) | inside | 2324 / 1653 |

**Builds at Tier I** (Expert, each Chord preset, the Calling by seed, 10 seeds on each of 2000 and 900007; Guardian from the tier reading): Steady 19/20 (95%), Guardian 86/100 (86%), Bastion 19/20 (95%), Anchor 17/20 (85%), All In 13/20 (65%), Wide Choir 16/20 (80%). **Met at 20 runs a preset**, 6 of 6 at ≥ 50% (read at a fifth of the protocol's size; not read on 333003). Presets × Callings were not split further (four runs a Calling a preset).

### The bands

| Band | Verdict |
|---|---|
| Tier 0, Expert ≥ 90% | met |
| Tier I, Expert 70-90% | met (edge on two sets) |
| Tier I, Skilled ≤ Expert − 10 | **missed** on all three sets |
| Tier II, Expert 40-70% | **missed** on 900007 (80%); edge on the other two |
| Tier II, Skilled ≤ Expert − 10 | met |
| Tier III, Expert 15-40% | met |
| Tier III, Skilled ≤ Expert − 5 | met |
| Tier IV, Expert 2-15% and above 0 on every set | **missed** on 2000 (22%); edge on the other two; above 0 on all three [Round 2: met, 18 / 16 / 14%] |
| Novice and Idle at the tiers | not measured |
| Tyrant costs like 24-40% enemy life | **missed** (−7%) [Round 2: still missed, −4.1% for the Novice] |
| Mimicry costs like 16-32% | **missed** (+1%) [Round 2: still missed; Skilled +7.4%, Expert +6.2%] |
| True Dissonance, Finale cell: wins ≥ 75% | met (93%) |
| … and ≥ 10 points below without it | **missed** (7.5) |
| … the Postlude 45-120 s | met on average and for every Calling but the Conductor (14 s) |
| … the fight ≤ 150 s longer | met on average (one Martyr run 182 s) |
| Builds at Tier I: ≥ 5 of the presets at ≥ 50% | met (6 of 6, 20 runs a preset) |
| Echoes ★ 60-95% | met on seven, **missed** on Retrograde and A Cappella (40 / 40) |
| Echoes ★★★ 10-45% | met on all nine (five on the edge) |
| Strangers ★ ≥ 40% | met |
| Echo length 12-22 min | met on eight, **missed** on the Last Rehearsal (23.5) |
| Weekly, Expert 50-85% | met on eleven, **missed** on entry 9 (90%) |
| Weekly, Skilled 25-70% | met on all twelve (two on the edge) |
| Verification (≤ 20 s in Node, file ≤ 300 KB) | not re-measured (W4's reading stands) |

### Missed bands: causes and options

1. **Tier II (80% on 900007) and the Skilled bot at Tier I.** Tier II's set holds no Phase 6 level, so none of this phase's levers reaches it: the reading is the Expert's (Rank 20 build, and the map rule once it stops taking elites at 20 points). The same build makes the Skilled bot nearly as strong at Tier I (82% against the Expert's 87%): the bands were extrapolated for an Expert that no phase had measured (*Assumed, not yet verified*). Options: restate Tier II's band (the three sets read 68-80%), or accept; restate the Tier I gap; or move existing levels' numbers (this phase forbids it).
2. **Tier IV on 2000 (22%; 14% and 18% on the others).** Of 150 runs, 31 reach the Finale and 27 win there; most losses are Movement I and II fights and the Hollow Cantor, where the extra levels are the existing twelve's. Phase 6's levers act only at the bosses (Tyrant) and the Finale (the Postlude): a harder Tyrant clock and a 75% Postlude moved tier IV by no more than noise. Options: accept (edge on two sets); a much harder Postlude (it would break the cell's 45-120 s band); or restate the band. [Round 2: 18% on 2000, on the edge; see *Round 2*.]
3. **Tyrant and Mimicry's costs.** Tyrant: the borrowed attack replaces one of the boss's own specials each time it is cast, so on the Bellwarden it makes the fight easier (above); no cooldown, first cast or table entry the levers allow changes that. [Round 2 made the sim change (the borrowed attack is cast on top of the boss's own) and re-read both levels: see *Round 2* below.] Mimicry: a mirror copies one Empower, Ward or Chime a cast, and the Novice barely notices it at any count. Options: in the sim (W1's), cast the borrowed attack beside the boss's own picks (for example only when no own special is ready, or on its own clock outside the picker), then re-read; lower the two levels' points (which changes the tier sets' totals: your call); or accept that the points price danger the Expert meets at bosses rather than what 4d's Prelude measures.
4. **True Dissonance's 10-point gap and the Conductor Calling's Postlude.** The Expert wins every Finale cell without the level, so "10 below" means ≤ 90%; every Postlude variant read 92-97%. On a Conductor run the Grand Finale ends the Postlude in about 14 s. Options: read the gap on a harder cell (Tier IV's Finale converts 87%); accept; or a Conductor-only Postlude rule (a sim change).
5. **Echoes ★ above 95% on Retrograde and A Cappella** (and four more on the edge at 95-98%). The Expert at Rank 20 wins nearly every ★ run; harder legs moved ★★★ into its band while ★ stayed high. Options: accept, or harden further (★★★ would fall toward 10%).
6. **The Last Rehearsal's length** (23.5 min, band 22): its Cantor and Vharun at Movement III's scale take longer. Options: one choice row of a Respite or a Merchant after each boss (the text promises both), or accept.
7. **Weekly entry 9** (Expert 90%): the Conductor Calling's Grand Finale cuts the Postlude short, and 8 or 10 points read the same (36 / 40). Options: another Calling for the True Dissonance week, or accept.

### For the owner

- **The Expert's map rule** (above) is a policy choice: a different sensible rule gives different tier readings, and Tier II's 68-80% follows from it.
- **Tyrant's picker priority** (item 3): a sim change, not a number. [Made in round 2.]
- **Restating the tier bands** for the Expert as measured (items 1 and 2).
- **Echo texts changed** with their legs (Choir of Blood, the Seamstress's Court, Retrograde, the Last Rehearsal and the Unrested now say their strength or "no Respite"); `ECHO_STARS` untouched.
- **Rotation entries 10 and 11** change route (Bells in the Rift and the Unrested leave the rotation; Choir of Blood and Retrograde appear twice, each with another Calling and party). Bells in the Rift is unwinnable on the level field as built.

### What was not run, or was run smaller

- The protocol's size: tiers at 50 a set, not 100; the Skilled bot at 30; the Echoes and weekly at 40 runs on two bases (not on 333003); builds at 20 runs a preset on two bases.
- The Novice and Idle bots at the tiers; Echo ★★ after the legs moved; presets × Callings split by Calling; replay verification time and size.
- The Finale cell at the protocol's three cell sets (two were read).
- `tools/dissonance.ts --tiers`, `--echoes` and `--weekly` themselves were not run at these sizes: the scratch runner plays the same `playRun` options, and its per-run lines are kept.

### Round 2: Tyrant adds to the boss; Mimicry re-read

A second round on the two levels whose cost read below its band. Scratch folder `/home/user/aw-work/6/w8b/` (`LOG.md` in order; every reading is a file there). Boss cells: `bcell.mts` (each boss's encounter on its Movement's default kit, bare in Movement I, `arrival`, `arrival3`, `arrival4`; the Rank 20 tree; no Calling; 40 seeds from cell base 1000, + i × 7919; it counts the boss's casts, own and borrowed, over the minutes it stands). Costs: `d4b.mts`, 4d's method for any bot (the tool's 300 Prelude runs on its seeds, the Rank 20 build, Guardian; the Expert with its run policy). Tier and weekly readings: round 1's `run.mts`.

**The cause, measured** (`m0-none`, `m0-ty`: as round 1 left it). With Tyrant the boss cast fewer of its own specials a minute: the Bellwarden 76% (Novice) and 79% (Skilled) of its rate without the level, the Hollow Cantor 95% / 90%, Vharun 93% / 89%, the Seamstress 94% / 94%, the Unweaver 98% / 99%, the Matriarch 99% / 101%; the Silent Conductor's own (its Cues, Raises, Fortissimo and Grand Silence, its two closing attacks left out) 101% / 96%. The Bellwarden lost most where the picker reaches last: Resound 3.3 → 1.8 a minute, the Inward Toll 5.3 → 3.2. Its own specials keep it casting about 85% of the time, so every borrowed cast that went first took one of their turns.

**The design chosen** (`src/sim/systems/enemies.ts`, all behind `world.mods.tyrant`):

1. The borrowed attack is the picker's **last** try: `trySpecial` tries it only when no special of the boss's own begins; `foresee` lists it after the boss's own, so an own special due as soon is shown and begins first.
2. **Its time is credited to the boss's own clocks.** While the boss casts a borrowed attack its own cooldowns keep running below zero, and at the cast's end those that would come due within the recovery are wound on by it (`RECOVER_TIME`); when such a special is next cast, its new cooldown is shortened by the time it waited. So a borrowed cast pushes none of the boss's own clocks back. The Silent Conductor's hold is its own attack on its own clock (`TYRANT_OWN`), so it takes no credit and its cadence is as before.
3. **What Foresight shows begins.** A borrowed attack Foresight has shown is tried first on the tick it is due, so an own special that comes into reach on that tick cannot replace it (round 2 found the breach while trying a later first cast: Vharun showed the Impaler's Charge and began Twin Cleave).

Why this one: it changes no cast path (the borrowed attack still begins through `beginAttack` as the boss's cast, with its id in `enemy.cast.attackId` and the telegraph's `attackId`, so the crown, the voice, the HUD's line, the Expert's rules and Foresight read it as before), adds no state and no hashed key (a cooldown below zero is the only new value, on Tyrant fights only), and leaves the cap, Stasis (cooldowns and the hold's clock wait as before), the Conductor's single clock, the Grand Silence and the Postlude untouched. Tried and rejected: casting the borrowed attack only when it would end before the boss's next own attack comes due. It never lets a long wind-up into a boss that is nearly always casting: the Bellwarden's phase-2 Dirge (5 s) and the Cantor's phase-3 Mending Hymn were not cast within 50 s (`tests/sim/tyrant.test.ts`), so it would have forced table changes. A parallel cast was not needed.

**Own specials, with Tyrant against without** (`m2-ty`, `m1-ty` for the Conductor; 40 seeds a bot; the borrowed attack's casts a minute on top):

| Boss | Bot | Won without | Won with | Downs a fight | Own specials a minute (with ÷ without) | Borrowed a minute |
|---|---|---|---|---|---|---|
| The Bellwarden | Novice | 34/40 | 33/40 | 2.1 → 1.8 | 18.8 → 17.7 (94%) | 2.0 |
| The Hollow Cantor | Novice | 26/40 | 26/40 | 4.9 → 6.2 | 13.0 → 12.7 (97%) | 4.2 |
| The Gorehound Matriarch | Novice | 28/40 | **33/40** | 2.2 → 1.9 | 14.7 → 14.8 (100%) | 3.2 |
| Vharun | Novice | 29/40 | 27/40 | 7.5 → 8.2 | 14.1 → 13.5 (95%) | 3.2 |
| The Seamstress | Novice | 24/40 | **29/40** | 3.2 → 2.7 | 26.1 → 25.4 (97%) | 2.9 |
| The Unweaver | Novice | 24/40 | 12/40 | 4.6 → 7.5 | 10.7 → 10.6 (99%) | 3.1 |
| The Silent Conductor | Novice | 11/40 | 9/40 | 4.4 → 3.9 | 9.5 → 9.6 (101%) | 7.6 (its held Sforzando and Downbeat) |
| The Bellwarden | Skilled | 40/40 | 40/40 | 0.0 → 0.1 | 16.9 → 16.6 (98%) | 2.2 |
| The Hollow Cantor | Skilled | 38/40 | 32/40 | 1.7 → 2.2 | 12.9 → 12.6 (97%) | 4.0 |
| The Gorehound Matriarch | Skilled | 40/40 | 40/40 | 0.1 → 0.1 | 13.2 → 13.5 (102%) | 3.3 |
| Vharun | Skilled | 40/40 | 38/40 | 0.7 → 1.3 | 13.6 → 12.7 (93%) | 3.9 |
| The Seamstress | Skilled | 36/40 | **40/40** | 0.8 → 0.3 | 25.1 → 24.3 (97%) | 3.1 |
| The Unweaver | Skilled | 38/40 | 40/40 | 0.5 → 0.3 | 10.3 → 10.2 (99%) | 3.0 |
| The Silent Conductor | Skilled | 38/40 | 39/40 | 0.3 → 0.5 | 10.1 → 9.8 (97%) | 6.8 (held) |

Every boss now casts its own specials at 93-102% of its rate without the level (the round-1 sim: 76-101%), and the borrowed attack on top, 2.0-4.2 casts a minute. What is left of the gap is not pacing: at Vharun the Impaler's Charge carries it away from its tank and Twin Cleave waits on the walk back (2.8 → 2.4 a minute); at the Bellwarden, which casts its own specials about 85% of the time, the credited clocks come due together and the picker's order favours its first-listed specials (Resound 3.3 → 2.8). The Bellwarden's cell is no longer easier (34 → 33; the round-1 sim read 40 / 40). The borrowed attack's rate itself fell where the boss is busiest (the Bellwarden's phase-2 Dirge 2.0 → 0.4 a minute, its Lance 2.6 → 1.6), and every table entry is still cast, so the table is unchanged. With the round-1 sim the cells read 40 / 26 / 28 / 39 / 29 / 14 / 9 of 40 (Novice) and 40 / 27 / 39 / 40 / 40 / 38 / 40 (Skilled) in the table's order.

Cells that still read easier with Tyrant: the Seamstress for both bots (+5 and +4 runs in 40, with fewer downs), the Matriarch for the Novice (+5); the Unweaver (+2, Skilled) and the Conductor (+1, Skilled) are within a run or two. A borrowed telegraph is also something to answer: a Perfect Ward on it refunds Spirit, staggers the boss and gives Resonance (`combat/telegraphs.ts`), so a borrowed attack that hits for little can give a party that answers it more than it takes (a likely reading of the Seamstress's and the Matriarch's cells, whose first phase borrows the Impaler's Charge; not separately measured). No cooldown or first cast removes that (below); the options are for the owner.

**Tests** (`tests/sim/tyrantPacing.test.ts`): for each of the seven bosses, on its golden fight's seed and two more, its own specials a minute with Tyrant at least 90% of the rate without (`TOLERANCE`; the 40-seed readings above are within 7%) and more than three borrowed casts; an own special that is ready begins before the borrowed attack, which follows once nothing of its own is ready; a borrowed attack Foresight has shown begins ahead of a ready own special; an own special that came due during a borrowed cast has its next cooldown shortened by its wait. Against the round-1 sim the Bellwarden's case and the three staged cases fail; the other six bosses' cases pass there too (the old priority cost them under 10%). Every test in `tests/sim/tyrant.test.ts` and `tests/sim/reviewA.test.ts` passes unchanged (no pinned cadence moved).

**Tyrant's values** (4d's method, the Novice, 300 Prelude runs, base 75.0%, ×1.25 40.7%; `ty4d`, `ty4d2`, `ty4d3`):

| `cooldown` / `first` | Novice wins | Costs like |
|---|---|---|
| round-1 sim, 150 / 6 | 82.0% | −7.1% |
| 150 / 6 | 79.3% | −4.1% |
| 100 / 6 | 83.0% | −8.3% |
| 250 / 6 | 81.0% | −6.0% |
| 400 / 6 | 80.3% | −5.2% |
| 150 / 9 | 77.3% | −2.1% |
| 150 / 12 | 73.7% | +1.2% |
| 150 / 18 | 73.7% | +1.2% |
| 100 / 12 | 76.7% | −1.6% |
| 250 / 12 | 78.7% | −3.5% |

At 300 runs one standard error is about 2.5 points of win rate, about 3% of "enemy life": the best row (+1.2%) is within half an error of no cost, and more borrowed casts read easier, not harder. No cadence the levers allow makes Tyrant cost what its band asks (24-40%), or clearly anything. The Prelude's gap is at the Bellwarden: on the same 300 runs at 150 / 6 the Novice won 264 of 272 Bellwarden fights with Tyrant and 254 of 272 without, and the Hollow Cantor the same share both ways (`pw-none`, `pw-ty`). A first cast at 12 s read best but was not kept: it makes the Bellwarden's phase-2 Dirge too rare to be cast within the 50 s `tyrant.test.ts` allows, changes which runs reach the staged Postlude in `reviewA.test.ts`, and its lead over 6 s is about 1.5 standard errors. **Tyrant's values stay `cooldown` 150, `first` 6; `TYRANT_OWN` and `TYRANT_BURN` unchanged** (so the True Dissonance Finale cell was not re-read).

Read the same way for the bots that play the kit (each at ×1.75, on the bases measured for Mimicry below; `tyS`, `mimE`), Tyrant at 150 / 6 costs like **+11.4%** for the Skilled bot (66.7% won against 77.3%; ×1.25 51.3%) and **+7.2%** for the Expert (76.7% against 81.0%; ×1.25 63.3%): clearly positive for both, about half and a third of the band's floor. Only the Novice's reading, the one the band names, sits near zero.

**Mimicry, re-read** (4d's method on the same 300 seeds, each bot at a Threat where it wins about three runs in four: ×1.75 for the Skilled bot and the Expert, which at ×1 win 100% and 97.5%; `find.txt`, `mimS`, `mimE`):

| Bot (Threat) | Base | ×1.25 | 1 a wave | 2 a wave | 3 a wave | Band |
|---|---|---|---|---|---|---|
| Novice (×1; round 1's `d4`, `d4m`) | 75.0% | 40.7% | 74.0%, +0.9% | 71.0%, +3.4% | 71.3%, +3.2% | 16-32% |
| Skilled (×1.75) | 77.3% | 51.3% | 70.7%, **+7.4%** | 73.3%, +4.6% | 73.7%, +4.2% | 16-32% |
| Expert (×1.75, its run policy) | 81.0% | 63.3% | 77.3%, **+6.2%** | 80.7%, +0.6% | 80.0%, +1.8% | 16-32% |

A bot that plays the kit does feel the mirror more than the Novice (+6-7% at one a wave, against the Novice's +1%), so round 1's reading understated it; but no count reaches the band for any bot, and more mirrors a wave read no costlier (each row's spread is within about two standard errors, about ±3%). **`perWave` stays 1**, and nothing else of Mimicry moved. The owner's options: accept a level that costs like 6-7% for a player who uses the kit (about one point on 4d's scale of 8% a point, against its 3); lower its points (which changes the tier sets' totals); or a design change (for example a copy stronger than the technique it copies; the mirror is already the wave's heaviest enemy).

**Tier IV, re-read** (the Expert, 50 seeds on each of 2000, 900007 and 333003; `tIV-0`, `tIV-1`; band 2-15% and above 0 on every set; round 1 read 22 / 14 / 18%):

| Set | Round 1 | Round 2 | Verdict |
|---|---|---|---|
| 2000 | 11/50 (22%) | 9/50 (18%) | edge (one standard error, 5.4 points, above 15%) |
| 900007 | 7/50 (14%) | 8/50 (16%) | edge |
| 333003 | 9/50 (18%) | 7/50 (14%) | inside |

**Met** by the doc's reading (inside or on the edge on every set, above 0 on all three; round 1 missed on 2000). 29 of 150 runs reached the Finale (round 1: 31) and 24 won there (27). The Hollow Cantor, where Tyrant now adds and takes nothing, is still the most common loss (16 / 17 / 12 runs, against round 1's 12 / 16 / 15).

**Weekly entries** (40 runs a cell, the 20 weeks holding the entry from week 44 and from week 1044; bands Expert 50-85%, Skilled 25-70%):

| # | Entry | Expert | Skilled | Verdict |
|---|---|---|---|---|
| 4 | as round 1 left it: Martyr · Kael, Lyra, Seren · Silent Cues, Tyrant (5) | 16/40 (40%) (round 1 22/40) | 21/40 (53%) (round 1 22/40) | Expert **outside** (16 of its 24 losses at the Hollow Cantor) |
| 4 | Short Fuse, Tyrant (5), tried | 11/40 (28%) | 21/40 (53%) | Expert outside |
| 4 | **Tyrant alone (4), adopted** | **28/40 (70%)** | **26/40 (65%)** | both inside |
| 6 | Luminary · Lyra, Vexis, Seren · Silent Cues, Mimicry (4), unchanged | 22/40 (55%) | 20/40 (50%) | both inside (as round 1, run for run) |

Entry 4 now reads "Tyrant" alone (`src/content/weekly.ts`, its comment "four points"; read again from the committed content, `wk4e`: the same 80 runs); the twelve entries keep their lints. Entry 6 has no Tyrant and Mimicry did not change, so it plays as before.

**What moved in round 2**: `src/sim/systems/enemies.ts` (the pacing above) and the comments of `src/sim/systems/tyrant.ts`; weekly entry 4, Silent Cues and Tyrant (5) → Tyrant (4). Nothing else: Tyrant's `cooldown` 150 and `first` 6, `TYRANT_OWN` (5.5 / 4.5 s), `TYRANT_BURN` (7 / 9 s), Mimicry's `perWave` 1, the Tyrant table, every level's points. Goldens (`npx tsx tools/update-golden.ts`, dry run, then `--write`): `contentVersion` `c-d4e8f1fbf5775748` → `c-691f26eff5775748`, `skilled-tyrant-vharun` `98edc77c35e67af0` → `6a1cfc180a7f1f31` (`PHASE6_HASHES` in `tests/sim/m1Unchanged.test.ts`); every other golden, `skilled-postlude`, `novice-mimicry-first-light` and `skilled-echo-bells-in-the-rift` among them, unchanged (neither plays Tyrant).

**Outside its band after round 2, and the options**

1. **Tyrant's cost by 4d's method** (band 24-40%): the Novice reads −4.1% at the values kept (+1.2% at best, a first cast at 12 s); the Skilled bot +11.4%, the Expert +7.2%. The sim change took away what Tyrant took from a boss, but the borrowed attacks themselves add little a Novice Prelude feels. Options: (a) accept, and read Tyrant's 4 points as the danger it adds for a player who plays the kit (Skilled and Expert above); (b) lower its points (this changes the tier sets' totals); (c) heavier borrowed attacks, by the table (lever 3; this round changed no entry, since every entry is still cast) or by a new value scaling a borrowed attack's damage (a sim change); (d) a first cast at 12 s, after restaging the two tests that read the cadence (the Bellwarden's phase-2 Dirge within 50 s, and the seed of the staged Postlude with Tyrant).
2. **Boss cells still easier with Tyrant**: the Seamstress for both bots (24 → 29 and 36 → 40 of 40) and the Matriarch for the Novice (28 → 33); both borrow the Impaler's Charge in their first phase. No value moves this without moving every boss. Options: accept (each of the three is within about two standard errors of no change at 40 runs); or another table entry for those two first phases (the owner's: the Seamstress's design entry, the Shears' Dash, cuts the Thread and is excluded by decision 5).
3. **Mimicry's cost** (band 16-32%): +0.9% (Novice), +7.4% (Skilled), +6.2% (Expert) at one a wave; no count reaches the band for any bot. `perWave` stays 1; the options are above (accept, its points, or a design change).
4. **Tier IV on 2000** reads 18%, on the edge rather than outside (round 1: 22%, outside): met by the doc's reading, but the margin is one standard error.

**Not measured in round 2**: the Expert's own boss cells (the Expert check at the arrival kit was needed only if a value made Tyrant harder, and none moved); the True Dissonance Finale cell (`TYRANT_OWN` and `TYRANT_BURN` unchanged); tiers 0-III (their sets hold no Tyrant or Mimicry); the other ten weekly entries (none plays Tyrant; entry 6 is the only one with Mimicry); Echoes (no Echo tier plays either level); boss cells on other cell bases or with a Calling; 4d's method on another seed set.

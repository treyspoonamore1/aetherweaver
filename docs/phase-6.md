# Phase 6: Mastery, the endgame

*2026-11-09 · design and build spec · main at eddab8c (Phase 5f W1), with 5f's presentation and bot streams still open · plan: [06 Phase 6](plan/06-roadmap.md) (lines 127-137), [02 §9](plan/02-game-design.md) (line 236: "Dissonance (after the first Finale clear), Atlas of Echoes, weekly seeds"), [02 §10](plan/02-game-design.md) (lines 248-253), [02 §4.12](plan/02-game-design.md) (the difficulty contract), [03 §11](plan/03-content-bible.md) (lines 461-481, the fifteen Dissonance levels), [05 §4.3-4.4, §4.9, §8, §11](plan/05-technical-architecture.md) (seeds, replays, determinism, saves, the harness) · follows [Phase 4d](phase-4d.md) (Dissonance), [Phase 5d](phase-5d.md) (the Finale) and [Phase 5f](phase-5f.md) (the Conductor Calling)*

Phase 6 is the long tail: the reasons to play after the first Finale clear. The roadmap lists four pieces:

- **Dissonance**, all fifteen levels. Twelve exist. Tyrant, Mimicry and True Dissonance are missing.
- **The Atlas of Echoes**, a map of remixed runs with stars to light. Nothing of it exists.
- **The weekly seed**, the same run for everyone that week, with share codes and replay verification. Seeded runs and single-fight replays exist; whole-run replays, the weekly and share codes do not.
- **Deeds**. Thirty exist. The plan's own examples are partly covered, and the new features need their own.

The exit is the roadmap's: the expert bot's clear rates sit in target bands for each Dissonance tier, and a seeded replay reproduces bit for bit on the same browser.

This doc is the spec. Implementers build from it and their brief. Every number below is a starting value for the tuning stream (W8), inside the levers listed under *Bands*. Where the plan is vague, the doc says so and proposes a reading.

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

**The framework** (Phase 4d). Levels are content (`src/content/dissonance.ts:8-117`) with an `effect` from a closed list (`src/content/schema.ts:1333-1346`), ranks and points. A run's levels travel to each fight in `SimConfig.dissonance` (`src/sim/world.ts:161-165`; resolved in content order, `:276-286`; kept in fight replays, `src/sim/replay.ts:111`) and become modifiers in `applyDissonance` (`src/sim/mods.ts:614-657`), applied last, after the Calling and the Astrolabe (`:605-606`). The run layer's pure functions are in `src/meta/dissonance.ts` (points, rewards, par, Tears, opening). Rewards: +3% Weaver XP and +4% Tuning Shards a point; a Discord Tear for an A from 10 points and one more for any win from 20 (`src/content/dissonance.ts:120-129`). Relics remember the Dissonance they were won at (their **depth**), which sets how far crafting can take them. Dissonance opens on the first Finale clear at Rank 15 or above (`src/meta/dissonance.ts:76-97`). The profile keeps, per Calling, the best total won at (`src/meta/profile.ts:124-131`), from any won run, a Prelude included (`src/app/profileStore.ts:527-550`). The most points today: **30**.

**The fifteen levels.**

| # | Plan (03 §11) | Plan effect | Built | Id · points × ranks | How it works in the game |
|---|---|---|---|---|---|
| 1 | Brisk Foes | enemies +15% speed | yes | `brisk_foes` · 1 × 1 | `enemySpeedMult` (`mods.ts:624-626`), read once at spawn (`systems/enemies.ts:122`). |
| 2 | Hardened | enemies +25% HP (×2) | yes | `hardened` · 3 × 2 | `enemyLifeMult` (`mods.ts:627-629`) on each spawn's life (`enemies.ts:114`) and the wave's life budget (`director.ts:134-135`); a fight's par grows with it so grades stay fair (`meta/dissonance.ts:64-74`). |
| 3 | Short Fuse | windups −10% (×2) | yes | `short_fuse` · 1 × 2 | `dissonanceWindupMult`, floored at ×0.2 (`mods.ts:630-632`), on every windup (`enemies.ts:779-783`, `:921-925`) and the Grand Silence's cap (`conductorBoss.ts:788`); the Finale's 1.0 s floor still holds (`enemies.ts:790`). |
| 4 | Muted Choir | aura radius −15% | yes | `muted_choir` · 1 × 1 | `dissonanceRadiusMult` (`mods.ts:633-635`) on the field's and the beam song's reach, after the cap and Sunrise (`systems/field.ts:183-186`, `world.ts:818`). **The one existing level that acts on auras.** Phase 6 leaves it exactly as it is. |
| 5 | Fragile Threads | snap range −3 m | yes | `fragile_threads` · 1 × 1 | `threadRangeBonus −= 3` (`mods.ts:636-638`) on the Thread's reach (`world.ts:1028`, `thread.ts:349`). |
| 6 | Wounding Strikes | healing received −15% (×2) | yes | `wounding_strikes` · 2 × 2 | `heroHealMult` (`mods.ts:639-641`) on healing heroes receive in fights (`combat/health.ts:614`, `:1626`). |
| 7 | Elite Vanguard | +1 elite per elite fight; elites +1 affix | yes | `elite_vanguard` · 5 × 1 | `vanguard()` (`director.ts:143-170`): the first elite group of an elite fight grows; extra affixes are rolled on their **own** generator seeded by the fight, the wave and the group (`:165`), so no other roll moves. |
| 8 | Silent Cues | Cue +10 Resonance | yes | `silent_cues` · 1 × 1 | `cueCostBonus` (`mods.ts:646-648`) added to the Cue's cost (`world.ts:926`; the Conductor's `cueCostNow`, `conducting.ts:61`). |
| 9 | Restless Dead | enemies revive once at 30% | yes | `restless_dead` · 5 × 1 | `restlessPct` (`mods.ts:649-651`); on a killing blow `restlessRise` stands the enemy up once at 30%, untouchable while it rises; not bosses or mini-bosses (`health.ts:1187`, `:1752-1782`). |
| 10 | **Tyrant** | bosses gain an extra mechanic per phase | **no** | — | Named "still to come" in the Codex (`src/ui/screens/dissonanceModel.ts:43-47`, pinned by `tests/uiPhase4d.test.ts:410`). |
| 11 | Unforgiving | Respites no longer heal | yes | `unforgiving` · 1 × 1 | Run layer only: `restHeal` and `skipHeal` give 0 (`meta/run.ts:1553-1562`); embark rewrites the map's Respites to say so (`:1163-1164`, `:1174`). |
| 12 | **Mimicry** | some enemies gain Mimicking | **no** | — | The Mimicking affix exists (Movement III, `src/content/unstitched.ts:834-841`): it casts the Mimic's mirror, which copies the Weaver's Empower, Ward or Chime. |
| 13 | Blind Score | answer glyphs hidden | yes | `blind_score` · 2 × 1 | Nothing in the fight; `state.dissonance.blindScore` (`world.ts:920-925`) tells the views to hide answers (`render/dissonanceCues.ts:84`, the HUD's hints, boss bar and decrees cut to their first sentence). |
| 14 | Discordant Pact | start with a random cursed relic | yes | `discordant_pact` · 1 × 1 | Run layer: a cursed relic the run doesn't carry, picked from the run's seed (`meta/run.ts:999-1006`, `:1155-1161`); not played, and no point, if there is none to give (`:1009-1019`). |
| 15 | **True Dissonance** | the Finale gains a fourth phase | **no** | — | Deferred by 5d (`docs/phase-5d.md:126-128`); its suggested seam (a second boss definition) is reconsidered below. |

**Gap:** three levels; tier bands; an expert bot; a record of Dissonance won *on a Finale clear*.

### Deeds

**What exists.** 30 Deeds in content order (`src/content/index.ts:97-104`): the base twenty (`src/content/deeds.ts:12-191`), Movement II's three (`legionRun.ts:503-531`), Movement III's two, the Finale's two (`deeds.ts:215-234`), Seren's and Oro's two (`rosterDeeds.ts`) and the Conductor's one (`deeds.ts:203-213`). Ten give an Astrolabe point each, capped at 10 (`src/meta/deeds.ts:12`); every Deed pays Starlight (the ladder 10-40, a badge 15, `src/content/loom.ts:12-14`); one earns a title (`title_flawless`, `loom.ts:59`). Each Deed names one of twelve rules (`schema.ts:1133-1149`), judged from what the run recorded (`meta/deeds.ts:104-134`). Every rule reads one run; nothing reads the profile as a whole.

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

**A fight replay today** (`src/sim/replay.ts:135-147`, format version 6) holds: the sim and content versions, the fight's fully resolved config (seed, party, encounter, Chords, motifs, relics, boons, Threat, the Movement's scale, Calling, Astrolabe, carried passives, Dissonance, Bonds, technique variants, assists, debug and absent flags; `world.ts:188-225`), the commands of every tick that had any, the last tick, and the final hash. Measured on three goldens (scratch `/home/user/aw-work/p6/size.ts`): the Skilled bot sends about 0.2 commands a tick, mostly `move` and `aim`, and a replay gzips to **1.4 to 1.7 KB per 1,000 ticks**; the Novice's to about a fifth of that.

**How it is verified today.** `runReplay` re-simulates from the config and compares the final hash; it reports a different sim or content version but still runs (`replay.ts:209-237`). `tests/sim/determinism.test.ts` round-trips nine scenarios through JSON and re-simulates them bit for bit (`:62-82`), and detects a tampered command (`:106-113`). `tools/replay-verify.ts` does the same from a file. In the game, the runtime records every fight (`src/app/runtime.ts:184`, `:261-263`), but only the dev panel exports it (`src/debug/DevPanel.tsx:44`, `:59-60`). The plan's "Settings → Export last run" and replay viewer (05 §9) don't exist.

**Determinism.** The sim uses only operations every JavaScript engine computes exactly: its own sine, cosine and square-root-based helpers (`src/sim/core/dmath.ts:1-9`), and lint bans the others, `Math.random`, `Date` and the environment in `src/sim` and `src/content` (`eslint.config.js`). So a replay is *designed* to match across engines; the plan only promises the same engine (05 §4.9). The run layer (`src/meta`) bans only `Math.random` and uses no inexact math today.

**Seeds and runs.** A run is reproducible from its seed and its choices: every roll in `meta/run.ts` comes from a generator named for its purpose (`rngFor(seed, label)`, `:320-322`), and each fight's seed comes from the run's seed, its fight count and its node (`:1262-1264`). The app picks the seed with `Math.random` (`src/app/runStore.ts:297-299`). Two things outside the run state reach it: the player's **assists** (passed into each fight's config, `run.ts:1290`) and the profile's **allowance**, which decides whether an event's Rank-gated recruiting choice is shown or allowed (`run.ts:1856-1870`, `:1882-1891`). A run saved mid-fight restarts that fight from its start on resume (`runStore.ts:187`).

**What does not exist:** a record of a whole run, a weekly seed, a share code, a score, any comparison between players, and any player-facing replay. Saves live in `localStorage` or memory (`src/app/storage.ts:1`), not IndexedDB as the plan has it.

### The Atlas of Echoes

**What the plan means** (02 §10, line 251): after the first Finale clear, "a persistent star map of *Echo Expeditions*: remixed runs with fixed twists (e.g. *Choir of Blood*, Movement I enemies with Movement II's boss mechanics). Clearing Echoes at Dissonance lights stars and earns Reliquary materials and cosmetics." 04 §7 puts it in the Loom as a station. 02 §13 pays Tuning Shards and Discord Tears from Echoes.

**What exists:** nothing but promises. The Summary's first-clear card says "Coming later: the Atlas of Echoes and True Dissonance" (`src/ui/screens/SummaryScreen.tsx:150`); `finaleCleared` is documented as its future gate (`src/meta/runEnd.ts:23-35`). The Loom's stations have no Atlas (`src/ui/screens/loomModel.ts:36-46`). **What would make it cheap:** maps are generated from Movement definitions that are plain data (`generateMapFrom(seed, defs)`, `run.ts:664`), and the Finale route already plays a shorter "road" through earlier Movements (`schema.ts:1668-1699`); a fight's enemy scale can already be overridden per fight (`SimConfig.movement`, absent when unused, `world.ts:197-203`).

### The bots

`BotKind` is `idle`, `novice` or `skilled` (`src/bots/types.ts:14`, `index.ts:14-23`). The Skilled bot decides every 4 ticks (67 ms) with full attention and answers a hero's call after 0.4 s (`skilled.ts:168-181`, `:475-478`); it reads every telegraph's exact timer, so on reflexes it already meets the plan's Expert (05 §11: 200 ms, 85% Perfect). Whole-run harness play (`tools/harness-core.ts:1884-2077`) picks map nodes by seed (`:1975-1979`), takes the first draft and relic, and rests at every Respite. `tools/dissonance.ts` measured each level with a Rank 20 build (a 29-point tree and three carried legendaries) on Preludes. 4d's ladder: Skilled won 98% at 0 points, 75% at 10, 35% at 20, 11% at 30 (`docs/phase-4d.md:179-188`). On whole Finale-route Expeditions with no build, the Skilled bot won 74% at Dissonance 0 with the default party in 5e's first look (`docs/phase-5e.md:1108-1112`; 50 runs).

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
| The Unweaver (III) | Null Priest · Rune (`null_rune`: refuses Ward, Chime and Reel inside it, `rules3.ts:86-102`; no aura effect) | Void Maw · Inhale (`maw_inhale`) | Doubt Wraith · Doubt |
| The Silent Conductor (Finale) | its own **Sforzando**, every 12 s (today only in the last burn) | its own **Downbeat**, every 9 s | none in the Grand Silence (the exam stays as built); in the last burn its Downbeat and Sforzando come every 7 s and 9 s |

The Conductor's row is a proposal where the plan is vague: borrowing a road foe's attack into the Finale would break its rule that the Weaver faces only the choir's rehearsed answers (`docs/phase-5d.md`, Principles 1-3). The Finale's script already casts those two attacks through its own gate (`docs/phase-5d.md:171`), which keeps its at-most-two damaging telegraphs.

Each borrowed attack takes the boss's Movement scale for damage, as every attack in that fight does. W1 checks each entry casts sensibly from a boss (range, shape, target); an entry that doesn't is swapped for another foe of the same road, and the doc's table updated.

### Mimicry (3 points)

> *In every wave, one enemy carries Mimicking: it copies your Empower, Ward or Chime.*

- **Rule.** In each wave of every fight, one enemy that isn't a boss, a mini-boss or a summon gains the **Mimicking** affix (`unstitched.ts:834-841`), if it doesn't already have it. Which one: the first spawn group of the wave with the most life per enemy (ties to the earlier group), and the first enemy of that group. The group is split into that one and the rest, in the same order, so every spawn point is drawn exactly as without it.
- **Seeded** like Elite Vanguard: its only roll (none today; kept for later choices) would use its own generator from the fight's seed and the wave, never the world's streams.
- **What the player sees.** The existing Mimicking look: its crown gem and the Mimic's cast bar showing the icon it will copy (5c). A first sighting on a Movement I or II road gets the Mimic's first-sighting card, since it may be the first time the player meets one.
- With **Restless Dead**, a mimicking enemy that rises loses its copy, as today (`health.ts:1769`), and keeps the affix.

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
- **On a Prelude** (no Finale) the level isn't played and adds no point, the way a Discordant Pact with nothing to give isn't (`run.ts:1009-1019`). Prep says "Expeditions only" beside it.

**Where it lives** (an engineering choice, overriding 5d's seam). 5d proposed a second boss definition swapped in by Dissonance (`docs/phase-5d.md:1420`). But 48 references in 12 files compare a boss to the Conductor's id (bots, HUD, render, audio, result text). So the Conductor keeps its definition; the Postlude is a fourth phase that exists only while the True Dissonance modifier is on, entered by the rise, not by a life threshold. `bossPhaseTable(defId)` keeps its signature and output; the boss bar asks a new `bossPhaseTableWith(defId, { postlude: true })` for its fourth pip.

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

**An Echo run** is an ordinary run in every way but its route and twists: Prep (with the Echo's constraints shown and enforced), map, fights, drafts, Summary. Its seed is new each attempt. It pays as a run does (XP, Starlight, shards and Tears by its Dissonance), and a clear may enshrine a relic. It never sets the Dissonance best and never earns run-wide Deeds (decision 10).

**The Echoes.** Every route is made from existing Movements, roads and encounters. A leg's **scale** overrides the enemies' life and damage for that leg (`SimConfig.movement`).

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

Under decision 6 (a level field), a weekly run starts from a state built only from the week: the seed and the entry's route, Calling (every path tier open; the path choices are yours, in the run), heroes and Dissonance; no Astrolabe, no carried relics, no Bond talents or alternate Solos; the allowance is everything (every aura and ornament for your Chords, every technique variant, every event choice shown). You choose your Chords and variants in Prep. Everything after is the run.

Its rewards are an Expedition's at its Dissonance. It counts for Deeds as an Expedition does, but sets no Dissonance best (its Dissonance wasn't chosen).

### The score

A run's **score**, all from what the run records:

- 1,000 if the run is won;
- for each fight won: 100 (300 for a boss, 200 for a mini-boss);
- for each fight won, by its grade: S 50, A 35, B 20, C 10, D 0.

Grades already weigh downs, Perfect Wards, saves, answered telegraphs and time against par (`meta/run.ts:2426-2447`), so the score rewards good support, not only survival. A Finale-route Expedition won with all S grades scores about 4,000. Ties are broken by less total fight time. The "without you" re-run, which finishes in the background or not at all, is never part of the score (it is only copied into the result, `run.ts:2302`).

### Run replays

A **run replay** is a new file format, `aetherweaver-run` version 1, separate from the fight replay (which stays version 6):

- the sim and content versions, the kind (weekly, Echo, Expedition, Prelude) and, for a weekly, its week;
- the **start**: the run's state as it embarked (seed, map, party, Chords, Calling, Dissonance, everything Prep set);
- the **steps**, in order: every run-layer choice (a map node, a draft pick or reroll, a relic, a Calling option with any Chords it asked for, a purchase, a Forge service, an event choice, a Respite choice, continuing from a result), and for each fight its assists, its command frames, its last tick, its final hash and how many times it was restarted;
- the **claim**: won or not, fights won, score, total fight time and the run digest (a hash over the week, the start, every step and every fight's final hash).

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

**Time.** The sim alone ran at about 0.07 ms a tick on this machine (warmed up, three goldens), so a 90,000-tick run is about 6-10 s in Node; the budget in a browser is 60 s on the reference laptop.

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
| `silent_bell` | Silent Bell | new rule `movementWithout`: beat Movement III's boss with no Chime in any of Movement III's fights | Clear Movement III without a single Chime. |
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
- **Run kinds** (decision 10): the run-wide rules (`win`, `runCount`, `grades`, `callAll`, `calling`, `keystone`, `elites`, `flawless`, `saveWays`) skip Echo runs; fight rules (`fight`, `heroCeiling` with an encounter, `heroTally`) count anywhere. Every run that exists today is a Prelude or an Expedition, so every earlier Deed is judged exactly as before.

## Design: the expert bot

The plan's four bots (05 §11) are Idle, Novice, Skilled and Expert. The game has the first three. **The Expert** (decision 14) is the Skilled bot's fight play with four additions:

1. **Faster and closer**: it decides every 2 ticks and answers a call after 0.25 s (the Skilled: 4 and 0.4).
2. **Rules for Phase 6's mechanics**, each named so the harness can switch it off: `tyrantFocus` (Focus a boss casting the Mending Hymn); `postludeBank` (in the Postlude, keep the Crescendo for Fortissimo Silence once Discord passes 70); `restlessHold` (don't spend a Ward on an enemy about to rise). Mimicry's copies are already handled by the Skilled bot's Mimic rules (`skilled.ts`, `mimicWard`, `mimicEmpower`), which read the copy on any enemy.
3. **A run policy**, in place of the harness's "first option": rest at a Respite only when a hero is under 50% or Shaken; take an elite row when the party averages 70% life or more; draft by rarity, then by tags shared with the Calling and Chords, then by levelling a motif it owns; relics by rarity; shop for a relic if it can pay, else a motif level; the Calling path with the best measured result for that Calling (`tools/callings.ts`).
4. **A Rank 20 build**: `tools/dissonance.ts`'s tree and carried set (`:38-40`), Bond talents at rank 10, and a Chord preset per run.

It never changes the Novice's or the Skilled bot's commands: a new class, `ExpertBot`, built on the Skilled bot's rules through an `expert` option that is absent by default, with its own generator. The Skilled bot stays the bot of every existing band; the Expert is measured only for Dissonance tiers, Echoes and the weekly rotation. The Skilled bot keeps losing to the Expert by a margin (*Bands*), which is the plan's "the skill ceiling has to pay".

## Engineering ground rules (additive only)

5b's to 5f's rules still hold. This phase adds:

1. **Every existing pin stays byte-identical** with no new level on, no Echo and no weekly:
   - the goldens: 25 on main, 28 once 5f's bot stream lands its three Conductor goldens (`tests/sim/golden.json`, pinned as literals in `tests/sim/m1Unchanged.test.ts`, which also pins `SIM_VERSION` 22);
   - `tools/m1-baseline.ts --movement 1|2|3|4 --check` and `tools/expedition-baseline.ts --movements 2|3|4 --check`, for every party they pin;
   - preludeSnapshot, draftSnapshot, the four command snapshots, rosterInvariance, movement3Handoff, finaleHandoff, expedition2Pin, expedition3Pin, `roster20.test.ts`;
   - the render and audio Spire and Rift snapshots.
2. **Every existing Dissonance level stays byte-identical too.** No pin covers a fight at a Dissonance level today. So W0, before any other change, records `tests/sim/dissonancePins.json`: the final hash of the `skilled-bellwarden`, `skilled-vharun` and `skilled-conductor` scenarios with each existing level at each rank added, and with all twelve together (45 hashes), plus one whole Prelude and one Finale-route Expedition at 30 points (the run's results, hashed). Every later stream keeps it byte-equal. New levels are appended in content, and configs list levels in content order (`world.ts:276-286`), so an existing config's list never reorders.
3. **How.**
   - **No new sim config key.** New levels travel in `config.dissonance`; an Echo leg's scale in the existing optional `config.movement`, set only on Echo fights. `hashWorld` hashes the config (`hashing.ts:15-16`), so any new key would move every hash.
   - **Absent, not undefined.** `hashValue` hashes a key whose value is `undefined` (`src/sim/core/hash.ts:55-56`). All new hashed state is optional, created with a conditional spread or deleted, never written as `undefined`: `EnemyComponent.tyrant?` (the borrowed attack and its next ready time, on a boss on Tyrant runs only), `FinaleField.postlude?` and the Postlude's clocks in `internal.m4`. Tyrant's cooldown lives in its own key, never as an extra slot in `specialCooldowns`, which is hashed and lines up with the boss's own specials.
   - **Mods do nothing by default** (`tyrant: false`, `mimicryPerWave: 0`, `postludeLife: 0`); mods aren't hashed. Every new branch starts with its own guard on its own line: `if (world.mods.tyrant)`, `if (world.mods.mimicryPerWave > 0)`, `if (world.mods.postludeLife > 0)`.
   - **The Conductor keeps its id**; `bossPhaseTable(defId)` keeps its output (above).
4. **No new RNG draw on an existing path.** Tyrant's casts go through the existing picker, and only Tyrant runs put a borrowed attack among its choices. Mimicry draws nothing from the world's streams. The Postlude's Raise draws as phase 1's does, only on True Dissonance runs, after the moment every existing fight has ended. The Expert has its own generator; the Novice and Skilled bots take no new draw.
5. **Content is appended**: levels after `discordant_pact`, effects at the end of `DISSONANCE_EFFECTS`, Deeds last in `CONTENT.deeds`, cosmetics after the existing ones, Postlude constants as new names in `crucible.ts`, Echoes and the rotation as new lists. No existing definition is edited.
6. **Auras.** `src/content/auras.ts`, `src/sim/combat/auras.ts` and `src/sim/systems/field.ts` are not edited by any stream; `git diff main --stat` on them is empty at every merge. No new code reads anything aura-related. Anything in decision 5 waits for your approval and is built, if at all, in its own slice.
7. **Never-moved numbers stay.** At Dissonance 0 and at every existing level: the Weaver's numbers, every aura's, every enemy's, encounter's, Movement's and road's, every hero's, every Calling's, every motif's and relic's, and the existing twelve levels' numbers and points. Phase 6's levers are only its own new numbers.
8. **The run stays a function of its start and its steps.** Nothing in `src/meta` may read the clock, the settings or the profile during a run except values the run replay records: each fight's assists, and the allowance (the full allowance on a weekly; recorded in the replay otherwise). The week is computed in `src/app` and passed in.
9. **Versions.**
   - `SIM_VERSION` stays **22**: no existing fight's result changes. (A bump would move every pin, because `hashWorld` hashes it first.) Future rule: bump only when an existing fight's result changes, with your approval.
   - The **fight replay format stays 6**: no command or config shape changes.
   - `contentVersion` moves (new levels, Echoes, Deeds, cosmetics, rotation); `tools/update-golden.ts` records it and no hash moves.
   - A new **run replay format**, `aetherweaver-run` version 1.
   - **Profile 9 → 10**: it gains `atlas` (stars per Echo, the best Dissonance cleared per Echo), `weekly` (the last 12 weeks' entries) and `dissonance.finale` (the best Finale-clear Dissonance per Calling). The migration fills them empty; Finale records can't be rebuilt from v9's bests, which mix in Preludes. The save fuzzer and the migration test run every version to 10.
   - **The run save stays 5**: new fields are optional and absent on an ordinary run (`echo?`, `weekly?`, `logId?`, and `forced?` on a Dissonance choice an Echo imposes), as 5a added Movements without a bump. The run save's schema gains each one, because a non-strict schema silently drops unknown keys.
10. **Shared files get call sites, not bodies.** New logic lives in new files (`systems/tyrant.ts`, `systems/postlude.ts`, `meta/atlas.ts`, `meta/weekly.ts`, `meta/shareCode.ts`, `meta/runReplay.ts`); existing files get one guarded call each.
11. **Saves are never written per tick.** Run logs go to IndexedDB at node boundaries. Without IndexedDB (some privacy modes), the weekly still plays and its replay can be saved as a file at the Summary, not kept.

## Contracts

### Content (`src/content`)

- `schema.ts`: `DISSONANCE_EFFECTS` gains `'tyrant'`, `'mimicry'`, `'true_dissonance'`. New schemas: `EchoDef` (`id`, `name`, `constellation`, `text`, `legs`: each `{ movement, rows?, fixed?, miniboss?, boss, scale? }` built over an existing Movement; `twists`: `{ noCalling?, noTree?, noCarry?, party?, dissonance? }`), `WeeklyEntry` (`route: 'expedition' | echo id`, `calling`, `party`, `dissonance`), `Constellation` (`id`, `name`, `reward`). `DEED_TESTS` gains `movementWithout`, `dissonance`, `stars`, `constellation`, `weeks`; `DeedDef` gains optional `movement`, `level`, `points` (the Dissonance total) and `heroCeiling`'s encounter becomes optional. A cosmetic's `earned` gains `{ constellation }` and `{ atlas: true }`.
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
- New `echoes.ts` (nine Echoes, three constellations), `weekly.ts` (the rotation), `deeds.ts` appends `PHASE6_DEEDS`, `loom.ts` appends the keepsakes, `index.ts` registers the lists and concatenates the Deeds last.

### Sim (`src/sim`)

- `mods.ts`: `tyrant`, `tyrantCooldownMult`, `tyrantFirst`, `mimicryPerWave`, `postludeLife`, set in `applyDissonance`.
- `systems/tyrant.ts` (new): the table, `tyrantAttackOf(defId, phase)`, `enterTyrantPhase(world, boss, phase)`. Called from the phase shift in `bosses.ts` and offered to the picker in `enemies.ts`, each behind `if (world.mods.tyrant)`.
- `director.ts`: after `vanguard()`, `if (world.mods.mimicryPerWave > 0) spawns = mimicry(world, spawns, wave)`.
- `systems/postlude.ts` (new): `postludeRise(world, boss)`, called beside `restlessRise` in the kill path (`health.ts:1187`) behind `if (world.mods.postludeLife > 0)`; `postludeTick(world, boss)` from `conductorBoss.ts`'s update when `field.finale.postlude` exists.
- `bosses.ts`: `bossPhaseTableWith(defId, { postlude })`.
- Events (appended): `tyrantEdict { boss, phase, attack, from }`, `postludeRose { boss, hp }`, `postludePair { voices }`.

### Run layer and app (`src/meta`, `src/app`)

- `meta/run.ts`: `newEchoRun(seed, echoId, …)`, `newWeeklyRun(week, chords, techniques)`, `runKind(run)`; `routeDefs` and `setMovements` honour `run.echo`; `embark` applies an Echo's twists; `combatConfig` adds the leg's scale only on Echo fights; `playedDissonance` drops True Dissonance on a Prelude and forced levels add no points.
- `meta/atlas.ts`: `starsFor(run)`, `recordStars(profile, run)`, rewards, constellations. `meta/weekly.ts`: `WEEKLY_EPOCH_MS`, `weekOf(ms)`, `weeklySeed(week)`, `weeklyEntry(week)`, `weeklyScore(run)`. `meta/shareCode.ts`: `encodeShareCode`, `decodeShareCode`. `meta/runReplay.ts`: the schema, `RunRecorder`, `verifyRunReplay(file, code?)` (pure, synchronous), `runDigest`. `meta/outcome.ts`: `buildOutcome` moved from `src/app/outcome.ts` unchanged (the app re-exports it), so the verifier can use it.
- `meta/deeds.ts`: the new rules, the run-kind gate, `profileDeedsEarned`. `meta/profile.ts`, `meta/save.ts`: version 10 and its migration.
- `app/runStore.ts`: Echo and weekly starts; records each step. `app/profileStore.ts`: `recordAtlas`, `recordWeekly`, `recordFinaleDissonance`. New `app/replayStore.ts` (IndexedDB), `app/verify.worker.ts` and `app/verify.ts`. `tools/run-verify.ts`.

## Workstreams

**W0 lands first, alone.** W1, W2, W3 and W4 then run in parallel on disjoint files. W5, W6 and W7 start once W0 has landed **and** 5f's open streams (the Conductor's presentation in `src/ui`, `src/render`, `src/audio`, and its bots in `src/bots`, `tools`, `tests`) have merged; they build against mocks and wire in W1-W4 as they land. W8 follows W7. W9 reviews last.

| Stream | Owns (edits) | Reads only |
|---|---|---|
| **W0** contracts and characterisation | `src/content/schema.ts`; empty `src/content/echoes.ts` and `weekly.ts` and an empty `PHASE6_DEEDS` in `deeds.ts`, registered in `src/content/index.ts`, `src/sim/state.ts`, `src/sim/events.ts`, `src/meta/types.ts`, the types and `PROFILE_VERSION` in `src/meta/profile.ts`, `src/bots/types.ts` (`'expert'`), `tests/sim/dissonancePins.test.ts` and `.json` (new) | everything else |
| **W1** Dissonance in the fight | `src/content/dissonance.ts`, `crucible.ts`, `crucibleIds.ts`; `src/sim/mods.ts`, `world.ts`, `index.ts`, `combat/health.ts` (one call), `systems/bosses.ts`, `enemies.ts`, `director.ts`, `conductorBoss.ts` (one call), `tyrant.ts` and `postlude.ts` (new); `tests/sim/tyrant.test.ts`, `mimicry.test.ts`, `postlude.test.ts` (new); `tests/sim/rosterInvariance.test.ts` (FORBIDDEN only); `golden.json` (`contentVersion` only) | everything else; never the three aura files |
| **W2** run layer, saves, Deeds | `src/meta/run.ts`, `dissonance.ts`, `deeds.ts`, `profile.ts` (after W0), `save.ts`, `runEnd.ts`; `src/content/deeds.ts`; `src/app/runStore.ts`, `profileStore.ts`; `tests/meta/echoRun.test.ts`, `deeds6.test.ts`, `migration.test.ts`; any test whose count of Deeds or levels changes, listed in the hand-off | everything else |
| **W3** the Atlas | `src/content/echoes.ts`, `src/content/loom.ts` (appended keepsakes), `src/meta/atlas.ts`, `src/meta/loom.ts` (keepsakes earned by stars); `tests/meta/atlas.test.ts` | everything else |
| **W4** weekly, run replays, share codes | `src/content/weekly.ts`, `src/meta/weekly.ts`, `shareCode.ts`, `runReplay.ts`, `outcome.ts` (new); `src/app/outcome.ts` (re-export only), `replayStore.ts`, `verify.ts`, `verify.worker.ts`, `runRecorder.ts` (new); `tools/run-verify.ts`; `tests/meta/weekly.test.ts`, `shareCode.test.ts`, `runReplay.test.ts` | everything else |
| **W5** UI | `src/ui/**`, `src/ui/kit/loomLook.ts` (the `atlas` station), `e2e/smoke.spec.ts`, `e2e/weekly.spec.ts` (new), `tests/uiPhase6.test.ts` (new), `tests/colorVision.test.ts`, UI tests its changes touch | `src/sim`, `src/content`, `src/meta`, `src/render`, `src/audio` |
| **W6** VFX and audio | `src/render/**`, `src/audio/**`, `tests/renderPhase6.test.ts`, `tests/audioPhase6.test.ts` (new) | everything else |
| **W7** bots and harness | `src/bots/**` (`expert.ts` new), `tools/harness-core.ts`, `tools/dissonance.ts`, `tools/scenarios.ts`, `tools/verbs.ts`, `tools/pacing.ts`, `tests/bots/**`, `tests/harnessTools.test.ts`, `golden.json` and `m1Unchanged.test.ts` (appending only), `tests/sim/determinism.test.ts` (appending round-trips) | everything else |
| **W8** tuning | the three new levels' `values` and `points`, `POSTLUDE` and `TYRANT_BURN`, the Tyrant table's entries, the Echoes' legs and rewards, the rotation's entries, the Expert-only constants; the new goldens' entries; a *Tuning* section appended here | everything else |
| **W9** review | nothing (a report appended here by the orchestrator) | everything |

Every type another stream needs is added by W0. If a stream finds it needs another field, it asks the orchestrator, and W0's owner (or W1's, for sim state) adds it.

**Handovers.** W0 edits `profile.ts` and `index.ts` first; W2 and the content owners rebase on it and own every other line. W2 wires W3's and W4's pure modules into the stores (call sites only). The combat screen (W5) passes the runtime's fight frames to the run store (W2) at the fight's end, so no stream edits `src/app/runtime.ts`, which 5f's presentation stream is editing now.

### W0: contracts and characterisation

1. Before any change: run the whole suite and every `--check` tool on main; record the green state.
2. Record `dissonancePins.json` (rule 2) on main, and a test that reproduces it.
3. Add the types, schema entries (with empty lists), events, `'expert'` and `PROFILE_VERSION` 10's type, with no behaviour.

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

**Protocol** (5c-5f's): whole Finale-route Expeditions, 100 seeds on each of 2000, 900007 and 333003, the default party, the Calling rotating by seed among none and the four. A band is met only on all three sets. Tune on two; read 333003 only at the end. Each tier costs about 1,500 Expeditions across the sets; the harness runs them in lanes.

**Tiers** (Expert, Rank 20 build):

| Tier | Expert wins | Skilled (same build) | Novice | Idle |
|---|---|---|---|---|
| 0 | ≥ 90% | reported | reported | 0% (loses by node 2) |
| I (10) | 70-90% | ≤ Expert − 10 | ≤ 15% | 0% |
| II (20) | 40-70% | ≤ Expert − 10 | reported | 0% |
| III (30) | 15-40% | ≤ Expert − 5 | reported | 0% |
| IV (42) | 2-15%, and above 0 on every set | reported | reported | 0% |

**Each new level** (4d's method, `tools/dissonance.ts`): Tyrant costs like 24-40% more enemy life (4 points); Mimicry 16-32% (3 points). True Dissonance on the Finale cell (Expert): wins ≥ 75% and at least 10 points below without it; the Postlude lasts 45-120 s; the whole fight no more than 150 s longer.

**Builds** (02's pillar 5): at Tier I, at least 5 of the Chord presets × Callings reach Expert wins ≥ 50%.

**Echoes** (Expert, Rank 20): ★ 60-95% each; ★★★ (Tier II's levels) 10-45% each; Strangers ★ ≥ 40%; length 12-22 min (`tools/pacing.ts`).

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
- That nothing else in the run layer reads the profile, the clock or the settings during a run; this audit found only the assists and the event allowance. W4's verifier test is the proof.
- That the browser's built-in gzip and IndexedDB are available on the target browsers; both have fallbacks above.
- The tier bands' starting values: they extrapolate 4d's Prelude ladder and 5e's Expedition rates, neither measured with an expert bot.

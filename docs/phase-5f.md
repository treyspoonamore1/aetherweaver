# Phase 5f: the Conductor Calling

*2026-11-09 · design and contracts · main at 2b34c39 · plan: [03 §2](plan/03-content-bible.md#2-callings-choose-one-per-run) (the Conductor, line 92), [02 §4.5](plan/02-game-design.md) (Solos, Cues, Crescendo), [02 §4.6](plan/02-game-design.md) (Directives), [02 §9](plan/02-game-design.md) (line 235: Rank 12, "Conductor; Oro recruitable via event"), [02 §11](plan/02-game-design.md) (line 265: the Maestro build), [02 §12](plan/02-game-design.md) (power math), [04](plan/04-presentation.md) (readability rules) · follows [Phase 3e](phase-3e.md) (the last Calling) and [Phase 5e](phase-5e.md) (Seren and Oro)*

The fourth **Calling**: the one who makes them great. The Luminary makes the heroes shine, the Martyr takes their wounds, the Chronomancer bends the seconds around them. The Conductor leads them. Cues are cheap, Solos called close together grow stronger, and the Crescendo plays every hero's Solo in turn.

It unlocks at **Rank 12** (6,650 XP), the same Rank as Oro's recruit (`recruit.oro`, docs/phase-5e.md:621). Like the Martyr's Vow and the Chronomancer's Stasis, its Crescendo, **Grand Finale**, replaces Sunrise. It takes no key: Cues stay on Shift+1 to Shift+4 and the Crescendo on its own key.

This doc is the spec. Implementers build from it and their brief, nothing else. Every number below is a starting value that W5 tunes, inside the levers listed under *Bands*.

## Decisions for you

The user was away, so each row records the default this doc is built on. Each is yours to override; the rest of the doc follows the defaults.

| # | Question | Options | Default taken |
|---|---|---|---|
| 1 | A Duet or Trio is +25% or +50% power. Which Solos get it? | (a) only the Solo whose Cue forms the Duet or Trio; (b) also every earlier Solo of the chain that is still playing | **default taken: (a).** Simple to read: the Cue that closes the chain is the one that grows. Raising a Solo already playing would mean re-sizing Kael's dome after it is up. |
| 2 | Grand Finale: who plays, and what of a hero already mid-Solo? | (a) every hero who could take a Cue plays, whatever their charge; a hero mid-Solo keeps their place and plays when it ends; (b) only charged heroes play; (c) a Solo already playing is cut short for the Finale's | **default taken: (a).** "All heroes fire their Solos" reads as all. Cutting a Solo short throws away a Cue the player paid for. |
| 3 | Do the Finale's Solos count as Cues? | (a) no: they play in their Cued form, but form no Duet or Trio and feed no Ensemble, Reprise, Spotlight, chorus pulse, Canon or Constellation; (b) yes, as Cues | **default taken: (a).** Otherwise every Finale is also a Trio, a full Ensemble and a Reprise, and the Crescendo pays three times. |
| 4 | Maestro: "Grand Finale loops once more". Does the +20% ramp keep rising on the second pass? | (a) it keeps rising: ×1, ×1.2, ×1.44, ×1.73, ×2.07, ×2.49; (b) it starts again at ×1 | **default taken: (a).** The plain reading, and the payoff of a keystone tier. The ramp is lever 1 if it is too strong. |
| 5 | Marcato (the plan's Baton) gives heroes who answer a Directive +10% damage for 4 s. Directives cost nothing and have no cooldown in the game today. How often can it come? | (a) at most once every 8 s (4 s on, 4 s waiting); (b) every Directive gives it (a player who re-Focuses every 4 s keeps it forever); (c) only a Directive that changes the order | **default taken: (a).** A clear rhythm the chip can show; (b) is a free permanent +10%. |
| 6 | A Tempo (the plan's Downbeat): which beat makes a Cue free? | (a) the first beat of each bar: every 2.73 s at the music's 88 BPM, so a Cue at a random moment is free about 11% of the time; (b) every beat: every 0.68 s, free about 44% of the time by chance | **default taken: (a).** "Downbeat" is the bar's first beat, and (b) is free by accident. |
| 7 | Cues cost 15, but the meter only keeps whole segments of 25 from fading. Spend 15 from 50 and 10 of the 35 left fades away. | (a) on a Conductor run the meter also keeps whole Cues: what remains fades no lower than the larger of its whole segments and its whole Cues; (b) unchanged | **default taken: (a).** Otherwise idle seconds quietly take back the Calling's discount. |

## The Conductor: the one who makes them great

> *On my count. All of you.*

**Passive.**

- **Cues cost 15 Resonance** instead of 25.
- **You gain 20% more Resonance** from everything that gives it.
- **Duets and Trios.** Cue a Solo within **3 s** of your last Cue and it plays as a **Duet**: **25% stronger**. A third hero Cued within 3 s of the second plays as a **Trio**: **50% stronger**.

**Crescendo: Grand Finale** (instead of Sunrise). Every hero plays their Solo in turn, in their Cued form, one a second, in party order. Each is **20% stronger than the one before**. When the last has begun, **every Solo is full again**.

### The path

Four tiers, two options each, picked after the first fight won on rows 0, 3, 5 and 7 (or the Finale route's road), as for the other Callings. Tiers open with Calling mastery, as for the others.

| Tier | Option A | Option B |
|---|---|---|
| I | **Marcato**: heroes who answer a Directive deal 10% more damage for 4 s. It comes again 8 s after it was given. | **A Tempo**: a Cue given on the downbeat, within 0.15 s either side, costs no Resonance. Your Resonance meter shows the beat. |
| II | **Reprise**: when a Trio lands, every hero's Solo charges 30%. | **Upbeat**: every fight begins with 50 Resonance. |
| III | **Ensemble**: each different hero you Cue in a row makes your heroes deal 5% more damage, up to 15%, until you Cue one of them again. | **Spotlight**: a hero you Cue is Empowered at ×2 strength while their Solo lasts, Thread or not. |
| IV | **Triad** (keystone): while 3 or more heroes stand in your field, your Resonance never fades. | **Maestro**: Grand Finale needs only 75 Resonance, and it plays every hero's turn twice, still rising. |

The axes: **lead them** (Marcato, Ensemble, Spotlight), **in time** (A Tempo, Upbeat, Triad) and **more Solos** (Reprise, Maestro).

## Reading the plan

The plan leaves several things open, and some of its names collide with things already in the game. This is how each is settled.

### Names

The Calling keeps the plan's name, and so do its Crescendo, Duet, Trio, Ensemble, Spotlight and Maestro. Five path names collide with something the player already meets:

| Plan | In the game | The collision |
|---|---|---|
| Baton | **Marcato** | the Choirmaster's Baton relic (it lengthens Cued Solos) and the Silent Conductor's baton (its Downbeat decree, `crucible.ts:265`; the kit `baton` icon, `iconPaths.ts:172`) |
| Downbeat | **A Tempo** | the Silent Conductor's Downbeat attack (`crucible.ts:251-266`) |
| Encore | **Reprise** | the Encore motif ("The Crescendo lasts 2 s longer", `motifs.ts:247`) |
| Overture | **Upbeat** | the Silent Conductor's first phase, the Overture (`crucible.ts:53-62, 159`) |
| Triad Bond | **Triad** | Bonds are the heroes' system (Bond ranks, talents, scenes) |

The boss is always "the Silent Conductor" in new text. Existing boss strings that say "the Conductor" (the Discord meter's label, hints, the boss bar) are left as they are in this slice. In the HUD the beat is called "the downbeat", lower case, a musical word, never a name.

### Cue cost and the meter

- The meter keeps its four segments of 25 and its Crescendo at 100. A Cue costs 15. The HUD already draws a Cue's cost as ticks on the meter when it isn't one segment (`cueTicks`, `dissonanceModel.ts:576`): ticks at 15, 30, 45, 60, 75 and 90.
- Silent Cues (Dissonance, one rank) adds its 10 on top: a Cue costs 25. On the downbeat (A Tempo) only the surcharge is paid: 10 with Silent Cues, 0 without.
- **The fade** (decision 7). Today only the partial segment fades, after 5 s without a gain, at 4 a second (`sim/combat/resonance.ts:36-44`; `content/weaver.ts:79-80`). On a Conductor run the meter fades no lower than the larger of two floors: its whole segments (25s) and its whole Cues (multiples of the off-beat Cue cost, 15). From 35 it fades to 30; from 40 to 30; from 100 it never fades. Without the Conductor nothing changes.

### Resonance gains +20%

Every gain is multiplied by 1.2 through the existing `resonanceMult` (`resonance.ts:13`), on top of Standing Ovation (multiplied, not added: Standing Ovation III and the passive give ×1.44). The +20% applies to gains only: not to Upbeat's 50 at the start, not to the Cantor's Hymnal, not to Da Capo's 25 kept after a Crescendo. No Resonance is gained while the Grand Finale plays, as for every Crescendo.

### Duets and Trios

- **A chain** starts with any Cue. Each later Cue joins it if it comes **within 3 s of the chain's last Cue**, measured in sim time from the tick the last Cue was given to the tick this one is given (≤ 3.0 s joins). The window rolls: a Trio can span up to 6 s.
- The second Cue of a chain is a **Duet** (×1.25), the third a **Trio** (×1.5).
- **A chain needs different heroes.** Cueing a hero already in the chain starts a new chain with that Cue as its first. With a party of three, a chain is at most three long. (A hero can't be Cued twice within 3 s anyway: a Cue needs a full Solo and no Solo playing.)
- **Only Cues count.** A Solo a hero fires on their own (Hero Autonomy, Kael bracing below 30% life, Shieldbearer) neither joins nor breaks a chain. A Grand Finale turn neither joins nor breaks one (decision 3).
- **A free Cue** (A Tempo) is a Cue like any other.
- **Hero Autonomy** is unchanged: a full Solo still fires itself 1 s after it is ready (`AUTONOMY.cueGrace`, `constants.ts:28`), so with the assist on a chain must be built quickly.
- **What the player sees.** After each Cue a gold ring drains around the Cue strip for 3 s, and every hero whose Solo is ready shows what a Cue now would be: "Duet ×1.25" or "Trio ×1.5". The forming Cue calls out "DUET" or "TRIO".

### What "power" scales

A Duet's ×1.25, a Trio's ×1.5 and the Finale's ramp multiply the size of what the Solo does: its damage, its shields, its heals. They never change a duration, a radius, a count of targets, a cast time, or anything an aura reads. The extra damage is the Weaver's: it is credited to the Calling's share (`ledger.calling.amplified`) and shows as a gold chip.

| Hero · Solo | What power scales | Unchanged |
|---|---|---|
| Kael · Aegis Wall | the dome (Cued) or overshield's absorb | its 4 s, the dome's reach |
| Kael · Oathkeeper (Bond rank 10) | the share of each redirected hit he takes is divided by the power (Cued 25% → 20% in a Duet) | its radius, its 30% guard, its 6 s |
| Lyra · Gale Barrage | every arrow's damage, Storm Queen's echo arrows too | 12 arrows a second, 3 s, the Cued crit |
| Lyra · Hawk's Vigil (rank 10) | every shot's damage | its mark's 25% and 4 s |
| Vexis · Starfall | every meteor's damage, and Supernova's nova (it is built from the meteor) | the stun, the rate, where meteors fall |
| Vexis · Celestial Sphere (rank 10) | hits each sphere swallows: the content's 2 × power, rounded (Duet and Trio: 3) | who gets a sphere, its 5 s |
| Brann · Red Frenzy | every pulse's damage (his Cued lifesteal ×3 follows the damage) | the radius, the pulse rate, 5 s |
| Brann · Blood Brother (rank 10) | the healing share (16%, Cued 8%) | who it heals, 6 s |
| Seren · Thousand Cuts | every cut's damage | the cuts' count, the Cued kill extension, her return |
| Seren · Blade Waltz (rank 10) | the counter's percentage (150%, Cued 300%) | which blows it parries, 5 s |
| Oro · Wildgrowth | the Ancient's slam damage | its life, root, taunt, 8 s, and the Cued disc's radius (`field.ancient`: aura reach, never touched) |
| Oro · Homecoming (rank 10) | the Saplings' barrier and the Cued heroes' barrier | the re-sprout, the taunt |

Hits already in flight when the Solo ends (an arrow, a meteor) keep the power they were loosed with.

### Grand Finale

- **Cost.** 100 Resonance; 75 with Maestro. Maestro spends 75 and keeps the rest.
- **Turns.** A queue of the party's heroes in slot order (once; twice with Maestro). The first turn is taken the tick it is cast; then at most one turn a second (`gap`).
- **A turn goes to the first hero in the queue who is free.** Free means able to take a Cue now, charge aside: standing (not downed or dead), not possessed, not stilled, not mid-Solo, not held by Fermata, not being Reeled. Stunned heroes are free, as they are for a Cue.
- **Waiting.** A hero who is mid-Solo, held by Fermata or being Reeled keeps their place, and the turn goes to the next free hero in the queue. With Maestro a hero's second turn waits for their first Finale Solo to end.
- **Losing a turn.** A hero who is downed, dead, possessed or stilled when the queue reaches them loses that turn (it is dropped from the queue).
- **What plays.** The hero's Solo (their own or their Bond's alternate), in its **Cued form**, whatever their charge. Its charge goes to 0 as for any Solo. The Choirmaster's Baton lengthens it, as for a Cued Solo.
- **The ramp.** The first Solo the Finale plays is ×1, then ×1.2, ×1.44: each 20% stronger than the last Solo it actually played. Lost turns don't advance the ramp. With Maestro the second pass keeps rising: ×1.73, ×2.07, ×2.49 (decision 4).
- **Not Cues** (decision 3). A Finale Solo costs nothing, sends no `cued`, counts in no Duet or Trio, feeds no Ensemble, Reprise or Spotlight, and releases no chorus pulse, Canon charge or Constellation star. `ledger.cues` doesn't count it; `ledger.crescendos` counts the Finale once.
- **The end.** The Finale ends the tick its queue is empty, or after **12 s** (`wait`; the Encore motif adds its seconds) if heroes are still waiting; their turns are lost. When it ends, every hero who isn't dead has a full Solo (charge 100). A hero still mid-Solo carries the full charge, and it is ready when that Solo ends.
- **The rest is a Crescendo's.** The beat of slow motion at its start, no Resonance while it plays, the Fortissimo Silence cancel (any Crescendo cancels it, `techniques.ts:929-931`), Da Capo's 25 when it ends. It has **no aura surge and no heal**: `field.crescendo` stays false, as for the Vow and Stasis.
- **Cues during the Finale** are allowed. A hero Cued before their turn becomes mid-Solo, and their turn waits.

### Marcato (the plan's Baton)

Directives exist as player actions: the wheel (C) and the keys for Focus (G), Rally (Z), Hold and Scatter (`src/input/InputController.ts:333-347`; sim: `systems/commands.ts:77-120`). The plan gives Directives a 3 s cooldown (02 §4.6); the game has none. Marcato reads "affected heroes" as every hero who acknowledges the Directive: every standing party hero (the sim's `directiveAck`). A Focus on nothing is refused (`techniqueRejected`) and gives nothing. Marcato lasts 4 s and comes again 8 s after it was given (decision 5). It boosts the heroes' own hits, not Oro's summons. Downed heroes don't get it; a hero revived inside the 4 s doesn't either.

### A Tempo (the plan's Downbeat)

- **The beat is the sim's.** The music plays at 88 BPM in four (`theory.ts:13-17`). The sim owns the same tempo as constants: `MUSIC_BPM = 88`, `BEATS_PER_BAR = 4`, so a bar is 240 / 88 = 2.727… s of sim time. Downbeats fall at sim time 0, 1 bar, 2 bars, and so on. Sim time is what the game runs on: slow motion stretches a bar in real time, a pause stops it.
- **The rule.** A Cue costs no Resonance (Silent Cues' surcharge aside) if the sim time of the tick it is given is within **0.15 s** of a downbeat (≤ 0.15 s either side). That window is 0.30 s of every 2.73 s.
- **What the player sees** (the cue works with sound off). A metronome strip under the Resonance meter, only on runs with A Tempo: four beat marks a bar, the first larger, and a light that runs along them with the sim's time. The downbeat's window is drawn as a band around the first mark. While the light is inside the band, the band glows white-gold and every ready hero's Cue badge reads "Free". In the world, a faint white-gold ring pulses from the Weaver's feet on each downbeat. With reduced motion the light steps beat by beat instead of sliding.
- **What the player hears.** On A Tempo runs the music's bar line follows the sim's downbeat (below, *Audio*), and a soft baton tick marks each downbeat. A free Cue adds a bright chime to the Cue's phrase.
- **Fairness.** The window is judged on sim time, which is what the HUD draws. A key press reaches the sim on the next tick (at most 1/60 s later). The music may sit up to 30 ms off the sim's beat after a correction; the visual cue is the truth.

### Reprise, Upbeat, Ensemble, Spotlight, Triad, Maestro

- **Reprise** (the plan's Encore): the tick a Trio's Cue lands, every hero who isn't downed or dead gains 30 Solo charge (to at most 100). A hero mid-Solo banks it: it is there when the Solo ends. Once a chain (a chain is at most three long anyway). Canon (the motif) adds its own charge first, then Reprise.
- **Upbeat** (the plan's Overture): every fight (every encounter, each its own sim) begins with 50 Resonance, through the existing `startResonance` (`world.ts:983`). It adds to the Cantor's Hymnal and the Astrolabe's; the sum is capped at 100. 50 is two whole segments, so it doesn't fade.
- **Ensemble**: a streak of the different heroes Cued in a row. Each Cue of a hero not in the streak adds them; a Cue of a hero already in it starts a new streak with just that hero. The heroes' hits deal 5% more for each hero in the streak, at most 15%. With three heroes it runs 5%, 10%, 15%, then back to 5%. The streak lasts until it is broken or the fight ends. Uncued Solos and Finale turns don't touch it.
- **Spotlight**: from a Cue until that Solo ends, the hero is **Empowered at ×2**: Empower's bonus is computed as if the Thread poured into them at double potency (`thread.ts:307-318`: +50% more damage and +20% attack speed at today's numbers, more with Golden Filament). If the Thread also Empowers them, the larger applies; they don't add. It counts as Empower everywhere Empower counts (an Empowered hit breaks a guard, an Empowered kill gives Resonance, the ledger's Empower share), except that the Thread's own Resonance trickle comes only from the Thread. It doesn't follow Finale turns.
- **Triad** (the plan's Triad Bond): field membership is the sim's `hero.inField` (standing in one of the Weaver's fields, not suppressed; the beam alone doesn't count, `state.ts:286`). While 3 or more standing heroes have it, the meter doesn't fade and its idle clock doesn't run, so fading starts 5 s after Triad breaks. Oro's Saplings are not heroes and don't count. This is the only place the Conductor reads anything aura-related, and it only reads.
- **Maestro**: the Crescendo costs 75 (the meter keeps the rest) and the Finale's queue holds every hero twice.

### Other systems that touch Cues or Solos

- **Chorus pulse** (3+ auras): every Cue releases it, free Cues too, exactly as now. Cheaper Cues mean more pulses; no chorus number changes. Finale turns release none.
- **Canon** (Cueing charges the others' Solos): every Cue, as now; not Finale turns.
- **Da Capo** (keep 25 when the Crescendo ends): applies when the Finale ends, early or at 12 s.
- **Encore** (the motif: the Crescendo lasts longer): adds its seconds to the Finale's 12 s wait. It adds no turn.
- **Standing Ovation** (more Resonance): multiplies with the passive (above).
- **Quickened Verse**, **Tuning Fork**, **The Last Note**: unchanged; they fill Solos sooner, which feeds chains.
- **The Choirmaster's Baton** (Cued Solos last longer): Cued and Finale Solos alike; the power lasts as long as the Solo.
- **The Cantor's Hymnal** with Upbeat starts a fight with 50 + its Resonance (capped at 100).
- **Accelerando, Tempo Rubato, the Rubato aura and the Syncopation Chord** in the plan's Maestro build (02:265) don't exist in the game: no such motif, aura or ornament is in `src/content`. The build can't be assembled as written; this slice adds none of them.
- **Bond talents**: Constellation leaves a star on every Cue (not Finale turns). Supernova, Storm Queen and Hawk's Vigil follow the power table. Shieldbearer fires only uncued and is unchanged.
- **Seren**: a Cued Thousand Cuts still extends on kills (Cued: +0.5 s a kill, up to 4) and a stun still ends it. **Oro**: the Cued Ancient's disc still counts as the field, at its content radius.
- **Borrowed Time** is the Chronomancer's and can't meet the Conductor.
- **Movement III**: a possessed hero can't take a Cue (`techniques.ts:860-861`) and loses a Finale turn. Steal Verse and the Stolen Verse are the Unweaver's (`unstitchedBosses.ts`); a stolen verse makes the chorus pulse sing one aura fewer, as now.
- **The Silent Conductor** (the Finale): a stilled hero can't take a Cue (`techniques.ts:862-863`) and loses a Finale turn. A Grand Finale cancels Fortissimo Silence like any Crescendo. Reignite fills the stilled heroes' Solos, which the Conductor can chain into a Trio. The boss's own Cues are its own and never touch the Weaver's chain.

### "More" sources (02 §12, rule 1)

The plan caps the multiplicative "more" sources one build can stack on one stat at 4, by content lint. That lint doesn't exist: `effects.ts:48` says content lint enforces it, and nothing does (content stores plain `values`, never modifier buckets). So this slice counts by hand and pins the count with a test. On a hero's damage the Conductor adds:

1. **The Cue bonus**: a Duet's or Trio's power, or a Finale turn's ramp. One source: a Solo has one or the other, never both (decision 3). The plan lists both Cue bonuses and Crescendos as "more" sources.
2. **The Calling's group**: Marcato and Ensemble, added together (at most 25%) into one factor, credited to the Calling. It takes the slot the Luminary's Radiance takes on hers.
3. **Spotlight** adds no source: it strengthens Empower, which is already one.

With Empower that is three, under the cap. The strongest single hit: a Trio with Spotlight, Marcato and a full Ensemble: 1.5 × 1.25 × (1 + 0.5) = 2.81 times the hero's hit before the Conductor (auras, the Astrolabe and relics aside). A Maestro Finale's last Solo is ×2.49 but gets no Spotlight.

## What it doesn't change

- **Auras.** No aura definition, number, list, reach, effect or look changes. Grand Finale has no aura surge (`field.crescendo` stays false). Triad reads `hero.inField` and nothing else. Power never scales a radius, so the Cued Ancient's disc (`field.ancient`) and Cued Starfall's "inside your field" are as they are. `src/content/auras.ts`, `src/sim/combat/auras.ts` and `src/sim/systems/field.ts` are not edited by any workstream.
- **Never-moved numbers.** The Weaver's base numbers (the Cue's 25, the Crescendo's 100, the segment of 25, the fade's 5 s and 4 a second, every technique), the chorus, enemies, encounters, Movements, roads, the starters (Kael, Lyra, Vexis), Brann, Seren and Oro, every hero's Solo numbers, every motif, relic, Bond talent, alternate Solo, Dissonance level and the other three Callings. The Conductor's own numbers are the only levers.
- **The Thread, Ward, Chime, Reel and Glide** work as before. Directives work as before; Marcato only reads their acknowledgements.
- **Hero Autonomy** works as before.
- **Every fight without the Conductor plays exactly as before** (next section).

## Engineering ground rules (additive only)

5b's, 5c's, 5d's and 5e's rules still hold. This slice adds:

1. **Every existing pin stays byte-identical** with the Conductor not chosen:
   - the 25 goldens (`tests/sim/golden.json`, pinned as literals in `tests/sim/m1Unchanged.test.ts`);
   - `tools/m1-baseline.ts --movement 1|2|3|4 --check` and `tools/expedition-baseline.ts --movements 2|3|4 --check`, for the default party, Brann's A, B, C and the roster parties SA-OC;
   - preludeSnapshot, draftSnapshot, commandSnapshot, commandSnapshotM3, commandSnapshotFinale, commandSnapshotRoster;
   - rosterInvariance (its `keys.json` does not grow), movement3Handoff, finaleHandoff, expedition2Pin, expedition3Pin;
   - the render and audio Spire and Rift snapshots;
   - `tools/callings.ts`' rows for none, the Luminary, the Martyr and the Chronomancer, byte-equal to the same report run on main before W1.
2. **How.**
   - **Mods.** Every new mod has a default that does nothing (below). Mods are resolved from the config and are not hashed (`hashing.ts:13-44` hashes the config, not `world.mods`). Only `applyCalling('conductor')` and the Conductor's options set them.
   - **Absent, not undefined.** All new hashed state is optional and absent unless the Calling is the Conductor: `field.conducting?`, `ledger.conducting?`, `PendingHit.cuePower?`. `hashValue` hashes a key whose value is `undefined` (`core/hash.ts:55`), so these keys are never written as `undefined`; they are created with a conditional spread or deleted. `HeroComponent`, `WeaverComponent` and every other existing component gain no key.
   - **Guards are early `if`s.** Every new branch starts with `if (world.field.conducting)` or `if (opts.cuePower !== undefined)`, on its own line beside the code it sits by. Where a value is multiplied by a power, the helper returns exactly 1 without the Conductor, and x × 1 is exact in IEEE doubles.
   - **Expressions that keep their value.** The Cue's cost becomes `(mods.cueCostBase ?? content.cueCost) + mods.cueCostBonus`, and the Crescendo's `mods.crescendoCostBase ?? content.crescendoCost`: with the defaults (`null`) these are the same numbers as today.
   - **No new RNG draw** on any existing path. The Conductor's rules draw nothing (the Finale's order is slot order; ties go to slot order). Cued Starfall's targets and the cosmetic barks of a Finale's Cued Solos draw as any Cued Solo does, only on Conductor runs. The Novice's new draws are taken only on Conductor runs (*Bots*).
   - **A pure refactor.** The Crescendo's end (`weaver.ts:109-119`) moves into `endCrescendo(world)` unchanged, so the Finale can end early through it.
3. **SIM_VERSION stays 22; the replay format stays 6.** No command changes (Cue, Crescendo and Directive commands already exist, `sim/commands.ts:50-77`), the replay's config schema already takes any Calling id and path (`replay.ts`), no existing state key changes, and old replays cannot contain the Conductor. A bump would also break every pin: `hashWorld` hashes `SIM_VERSION` first (`hashing.ts:16`), and `m1Unchanged.test.ts` pins 22 and all 25 hashes. Only `contentVersion` moves (new content); `golden.json` records the new one.
4. **Saves.** Profile v9 and run save v5 don't bump. The Calling's id is a string the profile already stores. `EncounterStats` gains an optional `conducting?`, and the run save's `StatsSchema` (`save.ts:137-178`, a non-strict object that would drop an unknown key) gains `conducting: ConductingStatsSchema.optional()`. Old saves load unchanged.
5. **Names in code.** The boss owns `conductor` in code (`CONDUCTOR`, `conductorBoss.ts`, `conductorOf`, `skilled-conductor`). The Calling's content id is `'conductor'`; everything else of the Calling's is `conducting` (`systems/conducting.ts`, `field.conducting`, `CONDUCTING_RULES`) or named after its piece (`finale`, `marcato`, `tempo`).
6. **Shared files get call sites, not bodies.** The Conductor's logic lives in a new `src/sim/systems/conducting.ts`. Other sim files get one guarded call each, at the lines named under *Sim*.

## Contracts

### Content (`src/content`)

Appended to `CALLINGS` (`callings.ts`, after the Chronomancer):

```ts
{
  id: 'conductor',
  name: 'Conductor',
  title: 'the one who makes them great',
  summary: 'You lead the heroes: cheap Cues, Solos chained into Duets and Trios, and a Grand Finale.',
  text: 'Your Cues cost {cue} Resonance, and you gain {gain}% more Resonance. A Solo you Cue within {window} s of your last Cue plays as a Duet, {duet}% stronger; a third in a row is a Trio, {trio}% stronger.',
  crescendo: 'Grand Finale replaces Sunrise: every hero plays their Solo in turn, as if Cued, each {ramp}% stronger than the one before; when it ends, every Solo is full again.',
  crescendoName: 'Grand Finale',
  flavor: 'On my count. All of you.',
  // gap: seconds between the Finale's turns; wait: the longest it waits for a hero mid-Solo.
  values: { cue: 15, gain: 20, window: 3, duet: 25, trio: 50, ramp: 20, gap: 1, wait: 12 },
  unlockRank: 12,
  icon: 'conductor',
  tiers: [
    { options: [
      { id: 'marcato', name: 'Marcato',
        text: 'Heroes who answer a Directive deal {pct}% more damage for {seconds} s. It comes again {cooldown} s after it was given.',
        values: { pct: 10, seconds: 4, cooldown: 8 }, icon: 'marcato' },
      { id: 'a_tempo', name: 'A Tempo',
        text: 'A Cue given on the downbeat, within {window} s either side, costs no Resonance. Your Resonance meter shows the beat.',
        values: { window: 0.15 }, icon: 'a_tempo' },
    ] },
    { options: [
      { id: 'reprise', name: 'Reprise',
        text: 'When a Trio lands, every hero’s Solo charges {pct}%.',
        values: { pct: 30 }, icon: 'reprise' },
      { id: 'upbeat', name: 'Upbeat',
        text: 'Every fight begins with {resonance} Resonance.',
        values: { resonance: 50 }, icon: 'upbeat' },
    ] },
    { options: [
      { id: 'ensemble', name: 'Ensemble',
        text: 'Each different hero you Cue in a row makes your heroes deal {pct}% more damage, up to {max}%, until you Cue one of them again.',
        values: { pct: 5, max: 15 }, icon: 'ensemble' },
      { id: 'spotlight', name: 'Spotlight',
        text: 'A hero you Cue is Empowered at ×{mult} strength while their Solo lasts, Thread or not.',
        values: { mult: 2 }, icon: 'spotlight' },
    ] },
    { options: [
      { id: 'triad', name: 'Triad',
        text: 'While {count} or more heroes stand in your field, your Resonance never fades.',
        values: { count: 3 }, icon: 'triad' },
      { id: 'maestro', name: 'Maestro',
        text: 'Grand Finale needs only {cost} Resonance, and it plays every hero’s turn twice, still rising.',
        // loops: passes of the Finale's queue.
        values: { cost: 75, loops: 2 }, icon: 'maestro' },
    ] },
  ],
}
```

- Option ids are global (`schema.ts:2340-2344`): none of these is taken.
- **Deed.** A badge, as each Calling has (`deeds.ts:104-130`): `{ id: 'curtain_call', name: 'Curtain Call', points: 0, test: 'calling', calling: 'conductor', values: {}, text: 'Win a run as {calling}.' }`, in a new `CONDUCTING_DEEDS` exported from `deeds.ts` and concatenated **last** in `CONTENT.deeds` (`index.ts:96`), after `ROSTER_DEEDS`.
- **Mastery.** No mastery reward: `MASTERY.callings` (`loom.ts:67-71`) is unchanged, because every remaining technique variant is already on sale and taking one would lock it behind mastery for existing profiles. Its tiers open by mastery like the others (`tiersOpen`, `meta/loom.ts:92`), and the mastery screens already handle a Calling with no prizes (`masteryPrizes` returns null, `masteryModel.ts:30-37`).
- No schema change. No other content file changes.

### Sim

**Constants** (`constants.ts`): `MUSIC_BPM = 88`, `BEATS_PER_BAR = 4`, `BAR_SECONDS = (60 / MUSIC_BPM) * BEATS_PER_BAR`. A comment says the audio's `BPM` (`theory.ts:13`) must equal `MUSIC_BPM`; W3's test checks it.

**Mods** (`mods.ts`; `Mods`, `NO_MODS`, `applyCalling`, `applyCallingOption`, `KNOWN_CALLINGS`, `KNOWN_CALLING_OPTIONS`):

| Mod | Default (does nothing) | Set by | Value |
|---|---|---|---|
| `cueCostBase: number \| null` | `null` (content's 25) | passive | `cue` (15) |
| `resonanceMult` (exists) | 1 | passive | `*= 1 + gain / 100` |
| `chainWindow` | 0 (no chains) | passive | `window` (3) |
| `duetPower`, `trioPower` | 1 | passive | `1 + duet / 100`, `1 + trio / 100` |
| `cueKeepsWhole: boolean` | false | passive | true |
| `finaleTurns` | 0 (no Grand Finale) | passive / Maestro | 1 / `loops` (2) |
| `finaleRamp` | 1 | passive | `1 + ramp / 100` |
| `finaleGap`, `finaleWait` | 0 | passive | `gap`, `wait` |
| `crescendoCostBase: number \| null` | `null` (content's 100) | Maestro | `cost` (75) |
| `marcatoPct`, `marcatoSeconds`, `marcatoCooldown` | 0 | Marcato | `pct / 100`, `seconds`, `cooldown` |
| `beatWindow` | 0 (no A Tempo) | A Tempo | `window` (0.15) |
| `repriseCharge` | 0 | Reprise | `pct` (Solo charge points) |
| `startResonance` (exists) | 0 | Upbeat | `+= resonance` |
| `ensemblePct`, `ensembleMax` | 0 | Ensemble | `pct / 100`, `max / 100` |
| `spotlightMult` | 0 | Spotlight | `mult` |
| `triadCount` | 0 | Triad | `count` |

`applyCalling` runs after motifs, relics and boons and before the Astrolabe and Dissonance (`mods.ts:540-553`), so `resonanceMult` multiplies Standing Ovation's, and Silent Cues' `cueCostBonus` is added later and read at use.

**Public state** (`state.ts`, hashed, absent without the Conductor):

```ts
/** FieldState.conducting? — the Conductor's fight state (docs/phase-5f.md). Created with the world on a Conductor run. */
export interface ConductingField {
  /** Running Solos that carry a Cue bonus or Spotlight; one entry per hero, removed when that Solo ends. */
  solos: { hero: EntityId; power: number; spotlight?: true; finale?: true }[];
  /** The open chain: its heroes in order and the sim time of its last Cue. Deleted once the window has passed. */
  chain?: { heroes: EntityId[]; at: number; reprised?: true };
  /** Ensemble's streak (present only with Ensemble on the path). */
  streak?: EntityId[];
  /** Marcato: the heroes holding it, until when, and when it can come again (present once first given). */
  marcato?: { heroes: EntityId[]; until: number; readyAt: number };
  /** The Grand Finale while it plays: hero ids left to play (slot order, twice with Maestro), turns played, the next turn's earliest sim time. */
  finale?: { queue: EntityId[]; fired: number; nextAt: number; lost: number };
  /** Triad holds the meter (present only while it does). */
  triad?: true;
}

/** Ledger.conducting? — this fight's totals (created with the world on a Conductor run). */
export interface LedgerConducting {
  duets: number;
  trios: number;
  /** Cues given on the downbeat (A Tempo). */
  freeCues: number;
  /** Resonance the Calling's cheaper and free Cues kept (25 + surcharge, minus what each cost). */
  saved: number;
  finales: number;
  finaleSolos: number;
  finaleLost: number;
  /** Solo charge Reprise gave, summed over heroes. */
  reprised: number;
  marcatos: number;
}
```

- `PendingHit.cuePower?: number` (`world.ts`, the hit-in-flight record): set only when it isn't 1.
- `DamageOpts.cuePower?: number` (`health.ts`): an option, never state.
- `CallingState.crescendo` (`state.ts:1065`) gains `'finale'`.
- `CallingState.conducting?: ConductingView` (derived, not hashed, `world.ts:850-866`), present only on Conductor runs:

```ts
export interface ConductingView {
  /** What a Cue costs off the beat, Silent Cues included (15). */
  cueCost: number;
  /** What the Crescendo costs (100; Maestro 75). */
  crescendoCost: number;
  window: number;            // 3
  duet: number;              // 1.25
  trio: number;              // 1.5
  finale: { turns: number; ramp: number; gap: number; wait: number };
  /** A Tempo: the bar's length and the window either side of its downbeat; null without it. */
  beat: { bar: number; window: number } | null;
  marcato: { pct: number; seconds: number; cooldown: number } | null;
  /** Reprise's Solo charge (0 without it). */
  reprise: number;
  ensemble: { pct: number; max: number } | null;
  /** Spotlight's Empower multiple (0 without it). */
  spotlight: number;
  /** Triad's hero count (0 without it). */
  triad: number;
  /** Upbeat's starting Resonance (0 without it). */
  upbeat: number;
}
```

- `DissonanceState.cueCost` (`world.ts:871`) becomes `(mods.cueCostBase ?? content.resonance.cueCost) + mods.cueCostBonus`: what a Cue costs off the beat this fight. Its comment says so. The bots read it as the Cue's cost today (`novice.ts:407`, `skilled.ts:1040`), so they see 15 on Conductor runs with no change.

**Pure helpers** (`systems/conducting.ts`, exported through `src/sim/index.ts` for the views and bots; each takes the read-only `WorldState`, which `World` satisfies, so the sim and the views use one rule):

- `beatAt(time: number, bar: number): { prev: number; next: number; nearest: number; phase: number }`: downbeats at whole multiples of `bar`; `phase` 0 to 1 through the bar.
- `onBeat(state): boolean`: A Tempo is on the path and `|state.time − nearest| ≤ window + 1e-9`.
- `cueCostNow(state): number`: `onBeat(state) ? state.mods.cueCostBonus : state.dissonance.cueCost`. Without the Conductor that is `dissonance.cueCost`, which `world.ts:871` sets to exactly today's `content.cueCost + mods.cueCostBonus` (the same expression as `techniques.ts:867`).
- `crescendoCostOf(state): number`: `state.calling?.conducting?.crescendoCost ?? CONTENT.resonance.crescendoCost` (`WorldState` carries no content). Inside the sim, `crescendo()` uses `world.mods.crescendoCostBase ?? world.content.resonance.crescendoCost`, the same number.
- `nextCue(state, heroId): { link: 1 | 2 | 3; power: number; cost: number; onBeat: boolean } | null`: what a Cue of this hero would be now (null without the Conductor). `cue()` uses it, so the HUD's preview is the sim's rule.
- `cuePowerOf(state, heroId): number`: the power of that hero's running Solo; exactly 1 without the Conductor or an entry.
- `spotlit(state, heroId): number`: Spotlight's potency on that hero (0 without).
- `triadHolds(state): boolean`.
- `finaleView(state): { queue: EntityId[]; next: EntityId | null; power: number; fired: number } | null`: the next free hero, as the sim will pick it.

**Behaviour, file by file** (each a guarded call into `conducting.ts`):

- `techniques.ts` `cue()` (`:855-888`):
  - the cost line (`:867`) becomes `const cost = cueCostNow(world)`;
  - `spendResonance` is called only if `cost > 0` (always true without the Conductor, whose cost is at least 25);
  - after the `cued` event and **before** `startSolo` (so Kael's dome is built with its power): `if (world.field.conducting) conductCue(world, hero, cost)`. It joins or starts the chain, records the Solo's entry (power, Spotlight), updates Ensemble's streak, adds to `ledger.conducting`, and emits `cueChained`;
  - after Canon (`:877-887`): `if (world.field.conducting) reprise(world)`, which acts only on the chain's third Cue, once.
- `techniques.ts` `crescendo()` (`:890-933`): both cost reads (`:896, 898`) use `world.mods.crescendoCostBase ?? world.content.resonance.crescendoCost`. A new branch before Sunrise's `else`: `else if (world.mods.finaleTurns > 0) { w.crescendo = world.mods.finaleWait + world.mods.encoreBonus; startFinale(world); }`. The event's name test becomes `(vow || stasis || finale) && calling?.crescendoName`. The slow motion and the `onCrescendo` hook are unchanged.
- `weaver.ts` (`:109-119`): the end block moves into an exported `endCrescendo(world)`, unchanged, plus one first line `if (world.field.conducting?.finale) finishFinale(world)` (turns left are lost with reason `'time'`, every hero who isn't dead gets charge 100, `finaleEnded` is emitted). It then emits `crescendoEnd` and applies Da Capo, as now.
- `api.ts` tick order (`:75-125`): `updateConducting(world)` right after `updateWeaver(world, dt)`. It returns at once without `field.conducting`. In order it: deletes a chain whose window has passed; ends Marcato's hold; sets or clears `triad` (and emits `triad` on a change); and plays at most one Finale turn. A turn: drop from the queue every hero who is downed, dead, possessed or stilled, in queue order (`finaleTurnLost`); give the turn to the first free hero (an entry `{ power: finaleRamp ** fired, finale: true }`, then `startSolo(world, hero, true)`, `finaleTurn`, `fired++`, `nextAt = time + finaleGap`); if the queue is empty, set `w.crescendo = 0` and call `endCrescendo`. The first turn is taken the tick the Finale is cast, since `nextAt` starts at the cast's `world.time`.
- `solos.ts` `finishSolo` (`:144`): first line `if (world.field.conducting) soloDone(world, hero)` (removes the entry). Power sites, each multiplying by `cuePowerOf(world, hero)` or passing `cuePower` on the hit: Aegis Wall's dome and overshield (`:76-89`), Red Frenzy's pulse (`:203-213`, `cuePower` on `dealDamage`), Gale Barrage and Storm Queen (`loose`, `:256-271`), Starfall (`:298-312`), Supernova (`:411-425`), Hawk's Vigil (`:443`), Celestial Sphere's `hits` (`Math.round(hits × power)`, `:455`). A hit carries `cuePower` only when the power isn't 1.
- `duel.ts`: Thousand Cuts' cut (`:1549`, `cuePower` on the hit) and Blade Waltz's counter percentage. `grove.ts`: Homecoming's barriers (`:770-800`). `summons.ts`: the Ancient's slam (its hits carry its owner's `cuePower`). `blood.ts`: Blood Brother's share (`:194`). `health.ts`: Oathkeeper's redirected share (`:1316-1318`) divided by the power.
- `hits.ts` (`:141`): passes `cuePower` from the pending hit to `dealDamage`, splash and chain included.
- `health.ts` `dealDamage`, right after the Radiance block and before `const amountIn = amount;` (`:844-853`): `if (world.field.conducting && (source?.hero || source?.summon) && target.enemy)`, multiply by `conductingMult` = `(opts.cuePower ?? 1) × (1 + marcato + ensemble)`, where Marcato and Ensemble count only for `source.hero`. If it isn't 1, the extra goes to `callingIn` and `amplifiedIn`, as Radiance's does (credited to `ledger.calling.amplified`, `:1089-1098`).
- `thread.ts` `empowerBonus` (`:307-318`): after `p` is computed, `const q = world.field.conducting ? Math.max(p, spotlit(world, hero)) : p;`, and the return uses `q`. Without the Conductor `q` is `p`.
- `systems/commands.ts` `applyDirective` (`:77-120`): after the acknowledgements, `if (world.field.conducting) marcato(world)`. It gives Marcato to every standing hero if `marcatoPct > 0` and `time ≥ readyAt`, and emits `marcato`. A refused Focus returns before this line.
- `resonance.ts` `decayResonance` (`:36-44`): after the Crescendo check, `if (world.mods.triadCount > 0 && triadHolds(world)) { w.resonanceIdle = 0; return; }`. After the floor, `const keep = world.mods.cueKeepsWhole ? Math.max(floor, wholeCues(world, w.resonance)) : floor;` and the fade uses `keep`. The two helpers live in `resonance.ts`, so `resonance.ts` imports nothing from `conducting.ts`.
- `world.ts`: the field and ledger literals spread `...(mods.finaleTurns > 0 ? { conducting: … } : {})`, with `streak: []` only when `ensemblePct > 0`. `calling.crescendo` answers `'finale'` when `finaleTurns > 0`. `calling.conducting` is filled from the mods. `dissonance.cueCost` as above.
- `director.ts` (`:276-286`) is not edited. If a fight ends while the Finale plays, nothing more is played; `field.conducting` and `ledger.conducting` stay for the result, as the ledger does.

**Events** (`events.ts`, appended to the union):

| Event | Fields | When |
|---|---|---|
| `cueChained` | `hero`, `link: 1 \| 2 \| 3`, `power`, `cost`, `onBeat`, `until` (the chain's window end) | every Cue on a Conductor run, after `cued` |
| `reprised` | `charge`, `heroes` | a Trio's Reprise |
| `marcato` | `heroes`, `until`, `readyAt` | Marcato given |
| `ensemble` | `heroes`, `bonus` | the streak changed |
| `finaleTurn` | `hero`, `turn`, `power`, `pass: 1 \| 2` | a Finale Solo begins (a `soloStarted { cued: true }` also comes) |
| `finaleTurnLost` | `hero`, `reason: 'down' \| 'possessed' \| 'stilled' \| 'time'` | a turn lost |
| `finaleEnded` | `fired`, `lost` | the Finale ends (before `crescendoEnd`) |
| `triad` | `on: boolean` | Triad starts or stops holding |

`crescendoStart.calling` is "Grand Finale". A free Cue sends no `resonanceSpent`. No command changes.

**RNG.** None new. The Finale picks by queue order. A Finale's Cued Starfall and its Cued bark draw as a Cued Solo does.

### Run layer and meta

- **Unlock.** `UNLOCKS` already maps every Calling (`profile.ts:339-345`), so `calling.conductor` appears at Rank 12 with the summary as its text. `unlocksBetween` sorts stably by Rank (`:403`), and the recruits are appended last (`:376-383`), so the Rank 12 card lists the Conductor, then Oro. `EVERYTHING.callings` (Skip the unlocks) includes it (`:456`). A profile already past Rank 12 finds it in Prep marked New; no rank-up card is replayed. The demo's veteran (Rank 12, `demo.ts:18, 40`) has it introduced.
- **Stats.** `EncounterStats.conducting?: { duets; trios; freeCues; saved; finales; finaleSolos; reprised; marcatos }` (`meta/types.ts:313`), filled from `ledger.conducting` (rounded) in `run.ts` beside `callingRewound` (`:2125`), summed into the run's totals (`:2463, 2501`) only when present. `save.ts` `StatsSchema` gains it as optional.
- `RunCalling` doesn't change: nothing of the Conductor's carries between fights.
- No profile or run save version bump.

### UI (`src/ui`, `src/app/runtime.ts` callouts, `e2e/smoke.spec.ts`)

Every number comes from content (`callingText`, `optionText`), the view (`calling.conducting`), the field (`field.conducting`) and the sim's helpers (`nextCue`, `beatAt`, `onBeat`, `finaleView`, `crescendoCostOf`). Nothing is hard-coded.

| Where | What |
|---|---|
| **Look** (`kit/callingLook.ts`) | The Conductor's accent: ink and ivory, never gold (gold is the Weaver's). Start from an indigo ink (`#7f86e6`), ivory light (`#f4eedd`), a deep plum-ebony (`#3a2f55`); keep the first that clears ΔE ≥ 20 in every colour-vision mode against the three Callings, Mend, Empower, every relic rarity and the six heroes' colours (`tests/colorVision.test.ts`). Always paired with a glyph. |
| **Glyphs** (`kit/callingGlyphs.ts`, `kit/iconPaths.ts`) | Nine Calling glyphs (`conductor`, `marcato`, `a_tempo`, `reprise`, `upbeat`, `ensemble`, `spotlight`, `triad`, `maestro`) on the 24×24 grid. The emblem must not read as the kit `baton` icon (the Silent Conductor's). Two kit icons: `chain` (two linked notes) and `finale`. |
| **Axes** (`screens/callingText.ts`) | `OPTION_AXES`: marcato, ensemble, spotlight → `lead`; a_tempo, upbeat, triad → `tempo`; reprise, maestro → `encore`. `AXIS_LOOK` gains Lead them ("Your heroes hit harder"), In time ("The beat and the meter"), More Solos ("Solos come round sooner"), each ΔE ≥ 25 from the others in every mode. `PASSIVE_NAME.conductor = 'Cheap Cues, Duets and Trios'`. |
| **Prep** (`CallingPicker.tsx`, `CallingParts.tsx`, `PrepScreen.tsx`) | Four Callings beside No Calling; the layout holds at the narrowest Prep width (wrap to two rows if needed). His card: "**Grand Finale** replaces Sunrise…", locked "Rank 12" until then. |
| **Tier screen** (`CallingScreen.tsx`) | Generic; his glyphs and axes; "Always yours · Cheap Cues, Duets and Trios". |
| **Weaver bar** (`hud/WeaverBar.tsx`) | Cue ticks at 15 (existing). **The chain ring**: a gold arc around the Cue strip, draining from `cueChained.until`, labelled "Duet next" or "Trio next". **The beat strip** (A Tempo only): four beat marks, the light, the window band; "Free" in white-gold inside it (geometry from `beatAt`). **The Crescendo read-out**: "Grand Finale", its cost from `crescendoCostOf` (75 with Maestro), ready at that cost. While it plays: turn pips (3, or 6 with Maestro), lit as played, crossed as lost, and the next hero's name with their power ("Lyra next ×1.44", from `finaleView`). |
| **Party frames** (`hud/PartyFrames.tsx`) | A ready hero's Cue badge shows `nextCue`: "Duet ×1.25", "Trio ×1.5", and "Free" on the beat. Marks: Spotlight (a light cone glyph, for the Solo), Marcato (+10%, a 4 s sweep). During the Finale: each hero's place in the queue (1, 2, 3), "waits" or "lost". |
| **Calling chip** (`hud/CallingChip.tsx`, `hud/calling.ts`) | Marcato "ready" or "Marcato 5s"; Ensemble pips (0-3) and "+10%"; Triad "holding" while it holds; it blazes while the Finale plays. |
| **HUD helpers** (`hud/conducting.ts`, new) | Pure, tested: badge labels from `nextCue`, the beat strip from `beatAt`, the Finale's pips from `finaleView`, the chip's states. |
| **Bridge and store** (`hudBridge.ts`, `store.ts`) | `crescendoCost` from `crescendoCostOf` (today `resonance.crescendoCost`, `hudBridge.ts:515`); the conducting view and field carried to the HUD. |
| **Dissonance chip** (`screens/dissonanceModel.ts`) | `hudDissonanceView` (`:520-534`) compares the Cue's cost with the Calling's own (15 on a Conductor run), not the content's 25, so it doesn't report "A Cue costs 15 Resonance this fight" as Dissonance. |
| **Callouts** (`hud/Callouts.tsx`, `src/app/runtime.ts` callouts only) | Gold: "DUET · Lyra ×1.25" (toast), "TRIO · Vexis ×1.5" (banner), "Free Cue · on the beat" (toast). "Reprise · every Solo +30%", "Marcato · +10% for 4 s". "Crescendo — Grand Finale" banner with its glyph; each turn a toast "Kael ×1 · Lyra ×1.2 · Vexis ×1.44" building up; "Every Solo is full" when it ends; "Vexis can't play — down" for a lost turn. |
| **Hints** (`hud/hints.ts`, `HowToPlay.tsx`, `KeyHints.tsx`) | `chain` ("Cue another within 3 s for a Duet"), `beat` (A Tempo: "Cue on the downbeat: it's free"), `finale` ("Grand Finale plays every Solo, rising, then fills them all"). The Cue hint's cost line already reads `cueCost` (`hints.ts:360-365`). |
| **Result, Summary, Codex** (`resultText.ts`, `ResultScreen.tsx`, `SummaryScreen.tsx`, `callingText.ts`, `CodexScreen.tsx`) | Result: "3 Duets · 1 Trio · Grand Finale played 6 Solos · 4 Cues on the beat, free". Summary: the Conductor's panel (totals, path); a run with no Duet says how ("Cue a second hero within 3 s"). Codex: four Callings, his axis legend; the Cue entry names Duets and Trios on his runs. Rank 12: generic (`rankText.ts`, `Rank.tsx`). |
| **Lab** (`ui/lab/UiLab.tsx`, `mock.ts`) | A Conductor group: Prep, tier screen, the HUD at a Duet, a Trio, the beat window, a Finale with a waiting and a lost turn. |
| **e2e** (`e2e/smoke.spec.ts`) | Skip the unlocks, choose the Conductor in Prep, see "Cue 15" on the meter, stage two Cues within 3 s (debug `chargeSolos`, `setResonance`) and see the DUET call-out. |

### VFX (`src/render`)

Render reads `calling.crescendo === 'finale'`, `calling.conducting`, `field.conducting`, the events above, `cued`, `soloStarted`, `crescendoStart`/`crescendoEnd`, and the sim's `beatAt`. Nothing else.

- **`conductCues.ts`** (new, pure, tested): the chain from the field; the beat's phase; the Finale's queue; colours (`CONDUCT_HEX`: ink, ivory, and the Weaver's gold for the Weaver's acts).
- **`conduct.ts`** (new, `ConductView`), drawing only through existing batches (rings, sprites, ribbons, particles, telegraph styles):
  - **The chain**: a gold ribbon, like a line of a stave, from the last Cued hero to the next while the window is open; a Duet links two leitmotif sigils; a Trio closes a triangle of light over the three and flashes once.
  - **The window**: a thin gold arc at the Weaver's feet, draining with the chain.
  - **The beat** (A Tempo): a faint white-gold ring pulses out from the Weaver on each downbeat, brighter inside the window; a free Cue gives a small gold spark on its sigil.
  - **Marcato**: a small gold accent mark (>) over each hero holding it.
  - **Ensemble**: one to three gold motes circling the Weaver.
  - **Spotlight**: a soft vertical cone of white light on the hero for the Solo, with Empower's gold sparks.
  - **Triad**: a faint gold triangle on the ground between three heroes while it holds.
  - **Grand Finale**: on each turn a baton stroke (a ribbon arc) from the Weaver to the hero; the hero's sigil grows with the ramp; the Cued Solo's gold tint deepens with power. When it ends, a gold sweep fills every hero's Solo ring.
- **`feedback.ts`**: `crescendoStart` for Grand Finale plays **no Sunrise** (no gold rings, pillar, field blaze or warm light), as Stasis doesn't; a small push of the camera. `crescendoEnd` skips Sunrise's ring. **`martyrCues.ts`**: `crescendoKind` answers `'finale'`. **`combatView.ts`**: creates `ConductView` and feeds it.
- **`lab/VfxLab.tsx`**: a Phase 5f group with one scenario per visual.
- The auras' looks are unchanged. **No new draw call**: the same batches as without him, pinned by the render test, as 3e and 5e did.

### Audio (`src/audio`)

**The beat clock** (A Tempo runs only):
- `types.ts`: `MusicInputs.beat?: { simTime: number; nextDownbeat: number; scale: number }`, set by `sfx.ts`' `update(state)` from `state.time`, `beatAt` and `state.timeScale`, only when `calling.conducting.beat` is set. Absent otherwise, so every other run's music is untouched.
- `music.ts` `pump()` (`:640-680`): with `inputs.beat`, the next downbeat's audio time is `now + (nextDownbeat − simTime) / max(scale, 0.1)`, less the context's output latency where the browser gives it. Before the next bar line is scheduled, if the music's next bar start is more than 25 ms from it, the grid's `origin` moves so that bar starts there (only steps not yet scheduled move; the bar being played is stretched or shortened). A gap of more than half a bar (a pause, a hidden tab) re-anchors at the next downbeat with a rest. Slow motion and hit-stop stretch the music's bar with the sim's.
- The sim never reads audio. W3 adds a test that `BPM` equals `MUSIC_BPM`.

**Sounds** (`sfx.ts`, recipes in `synth.ts` only if needed). The Conductor's voice is **harmony**: where the other Callings sound one line, his sound two or three voices together, in D dorian, pitched from the heroes by scale degree as the other Callings' are.
- **Duet** (`cueChained`, link 2): the new hero's Cue phrase answered a third above, in scale degrees, by the first hero's note.
- **Trio** (link 3): the three heroes' notes as a chord, a brass-and-strings swell resolving on the next bar line.
- **Free Cue**: a bright glass chime on the Cue phrase.
- **The downbeat** (A Tempo): a soft baton tick on each downbeat, quiet enough to sit under the music.
- **Grand Finale**: each turn plays that hero's leitmotif phrase, transposed up one scale degree per turn so the ramp is heard; the music's stems rise; when it ends, a full cadence on D and a shimmer (every Solo full). A lost turn: a muted string.
- **Reprise**, **Marcato** (a short accented chord stab), **Ensemble** (a note added to a held chord per hero), **Spotlight** (a held high note under the Solo), **Triad** (a soft sustained triad while it holds).
- **UI sounds** (`ui.ts`): `callingSelect`, `callingReveal`, `callingPick` voiced for the Conductor (baton taps on a stand, then a chord), through the existing `playUi(sound, calling?)`.
- The Spire and Rift audio snapshots are unchanged.

## Workstreams

W1 lands first. W2, W3 and W4 then run in parallel on disjoint files. W5 follows W4 and needs W2 and W3 merged for its e2e and pacing checks. W6 reviews last.

| Stream | Owns (edits) | Reads only |
|---|---|---|
| **W1** content, sim, run layer, sim tests | `src/content/callings.ts`, `deeds.ts`, `index.ts`; `src/sim/constants.ts`, `mods.ts`, `state.ts`, `world.ts`, `events.ts`, `index.ts`, `api.ts`, `combat/resonance.ts`, `combat/health.ts`, and in `systems/`: `conducting.ts` (new), `techniques.ts`, `weaver.ts`, `solos.ts`, `commands.ts`, `thread.ts`, `hits.ts`, `duel.ts`, `grove.ts`, `summons.ts`, `blood.ts`; `src/meta/types.ts`, `run.ts`, `save.ts`; `tests/sim/conducting*.test.ts` (new), `tests/meta/conducting.test.ts` (new), `tests/sim/rosterInvariance.test.ts` (FORBIDDEN only), `tests/sim/golden.json` (`contentVersion` only); and, only to update an expectation that counts Callings, Deeds or the Rank 12 unlocks, any other test file, each listed in the hand-off | everything else |
| **W2** UI and HUD | `src/ui/**`, `src/app/runtime.ts` (callouts only), `e2e/smoke.spec.ts`, `tests/colorVision.test.ts`, `tests/uiConducting.test.ts` (new), UI tests its changes touch | `src/sim`, `src/content`, `src/meta`, `src/render`, `src/audio` |
| **W3** VFX and audio | `src/render/**`, `src/audio/**`, `tests/renderConducting.test.ts` (new), `tests/audioConducting.test.ts` (new) | everything else |
| **W4** bots and harness | `src/bots/**`, `tools/harness-core.ts`, `tools/callings.ts`, `tools/verbs.ts`, `tools/scenarios.ts`, `tests/bots/**`, `tests/harnessTools.test.ts`, `tests/sim/golden.json` and `tests/sim/m1Unchanged.test.ts` (appending only), `tests/sim/determinism.test.ts` (one replay round-trip) | everything else |
| **W5** tuning | the Conductor's `values` in `src/content/callings.ts`; the Conductor-only constants in `src/bots/novice.ts` and `skilled.ts`; the Conductor goldens' entries in `golden.json` and `m1Unchanged.test.ts`; a *Tuning* section appended to this doc | everything else |
| **W6** review | nothing (a report appended to this doc by the orchestrator) | everything |

Every field another stream needs is added by W1: `ConductingField`, `ConductingView`, `LedgerConducting`, the events, the exported helpers, `CallingState.crescendo: 'finale'`, `EncounterStats.conducting`. W2, W3 and W4 add no sim field. If one finds it needs one, it asks the orchestrator, and W1's owner adds it.

### W1: content, sim, run layer

1. Before any change, run the whole suite and every `--check` tool; record the green state and `tools/callings.ts --seeds 10` for both loadouts (the before-report for pin 1).
2. Content, mods, state, helpers, behaviour and events as specified. Meta stats and save.
3. `npx tsx tools/update-golden.ts` records the new `contentVersion`; the 25 hashes must not move.
4. Tests (below). FORBIDDEN in `rosterInvariance.test.ts` (`:48-58`) gains `conducting` and `cuePower`, and a new case runs the Chronomancer's golden scenario and a Luminary fight and finds neither key.

**Done when**: vitest, typecheck and lint are green; the 25 goldens, `SIM_VERSION` 22 and every pin in rule 1 are byte-identical; `git diff main --stat -- src/content/auras.ts src/sim/combat/auras.ts src/sim/systems/field.ts` is empty; the callings report's four existing rows equal the before-report; the hand-off lists every test file edited outside its own and why.

### W2: UI and HUD

As specified under *UI*. Tests: `tests/uiConducting.test.ts` (axes and look; `hud/conducting.ts` labels from `nextCue` at link 1, 2, 3 and on the beat; the beat strip's light and band from `beatAt` at sample times; Finale pips with a waiting and a lost turn; the Dissonance chip quiet on a Conductor run with no Dissonance and correct with Silent Cues; the Crescendo read-out at 75 with Maestro; Result and Summary lines); `tests/colorVision.test.ts` (his look and axes); the e2e test.

**Done when**: every HUD rule above is pinned to the sim's helpers (no copied rule); the lab group renders; screenshots of Prep, the tier screen, a Duet, a Trio, the beat window and a Finale are taken from the lab; vitest green; the e2e passes (or, as in 5e, is recorded "not run" with the reason if no browser is available).

### W3: VFX and audio

As specified under *VFX* and *Audio*. Tests: `tests/renderConducting.test.ts` (real sim → render: the chain ribbon on a Duet and a Trio, the beat ring on downbeats only with A Tempo, the Finale's strokes and no Sunrise, no new batches or draw calls, his colours apart from Mend, Empower and danger in every palette); `tests/audioConducting.test.ts` (with a fake clock: the music's bar lines meet the sim's downbeats within 30 ms after one bar, under 0.35 slow motion, and after a 4 s pause; no `beat` input without A Tempo; `BPM === MUSIC_BPM`; every new sound in D dorian; offline renders' peaks under the mix's limits).

**Done when**: the render and audio Spire and Rift snapshots are unchanged; every existing render and audio test is green; the VFX lab group shows every visual.

### W4: bots and harness

**Readers** (`src/bots/common.ts`): `conductingOf(state)` (the view and field, null without), `beatSoon(state)` (seconds to the next window), `crescendoCostOf` re-exported from the sim. Every existing read of `CONTENT.resonance.crescendoCost` in `novice.ts` and `skilled.ts` uses `crescendoCostOf(state)` (equal without the Conductor).

**Skilled** (`CONDUCTING_RULES`, each a name `SkilledOptions.skip` can turn off, each gated on `conductingOf(state)`, none drawing):
- `conductChain`: while a chain is open, Cue the next ready hero not in it whose Solo has work: a damage Solo with an enemy within its reach + 2 m, a guarding Solo always, Oro's with an enemy standing. Damage Solos first, then slot order.
- `conductHold`: one Solo ready and wanted by the existing rule, another due to fill within 2 s (from its charge time and `soloChargeMult`), nothing landing within 2 s that a Cue would answer: wait, at most 2 s, then start the chain.
- `conductBeat` (A Tempo): a wanted Cue that isn't urgent waits for the window if it opens within 0.6 s; the Cue is sent on the first tick inside it. Chained Cues too, when the window comes before the chain closes.
- `conductFinale`: cast the Grand Finale when it is affordable, 2 or more heroes are free, and a boss stands above 10% life or 4 or more enemies stand, unless `bankCrescendo` or `crescendoCancel` holds it. The existing defensive Crescendo rule stays beside it.
- `conductMarcato`: with Marcato ready and 2 or more heroes engaged, Focus the boss (or Kael's target) if no Directive went out this tick.

**Novice** (`NOVICE_CONDUCTING`, starting values; the draws are taken only on Conductor runs, appended immediately before the existing Cue draw, `novice.ts:405-411`):
- `chain: 0.4`: with a chain open and a ready hero not in it, Cue them.
- `beat: 0.5` (A Tempo): inside the window with a ready hero, Cue them.
- `finale: 0.15`: with the Crescendo affordable, 2 or more heroes standing and a boss or 4 or more enemies, cast it. Her existing low-life rule stays.

**Harness**: tallies per fight from `ledger.conducting` and the events (Cues, Duets, Trios, free Cues, Finales, Finale Solos and lost turns, Reprise charge, Marcato grants, on-beat share). `tools/callings.ts`: the Conductor in whole-run mode (all 16 paths, as for the others) and in `--cells`, split like the Chronomancer's Paradox into two setups: `conductor + Triad` (marcato, reprise, ensemble, triad) and `conductor + Maestro` (a_tempo, upbeat, spotlight, maestro); the use columns; the band label. `tools/verbs.ts`: `CONDUCTING_RULES` and the Novice's three draws ablate.

**Goldens**: three scenarios appended after the 25 in `tools/scenarios.ts`, `golden.json` and `m1Unchanged.test.ts` (a `CONDUCTING_HASHES` block; "exactly the twenty-eight, in order"): `skilled-conducting-bellwarden` (a_tempo, reprise, ensemble, maestro), `novice-conducting-first-light` (marcato, upbeat, spotlight, triad), `skilled-conducting-silent` (the Silent Conductor, ARRIVAL4_KIT, marcato, reprise, spotlight, maestro). One joins the replay round-trip.

Tests: `tests/bots/conductingBots.test.ts` (the Skilled bot makes a Trio and casts a Grand Finale at the Bellwarden; with A Tempo most of its Cues are free; the Novice draws only on Conductor runs: the four commandSnapshot files are unchanged; each rule's skip changes its count), `tests/harnessTools.test.ts` (the new columns and setups).

**Done when**: every pin in rule 1 is byte-identical, including all four commandSnapshot files and `roster20.test.ts`; the three goldens reproduce; vitest green.

### W5: tuning

Against *Bands*, in the lever order, on the seed protocol. A *Tuning* section appended here records every number moved, the before and after, and the held-out set's reading. Re-records only the three Conductor goldens.

**Done when**: every band is met on all three sets, or listed as missed with its cause for your decision; the 25 original goldens and every pin are byte-identical.

### W6: review

An independent read of W1-W5 against this doc, as 3e's review was (docs/phase-3e.md:132-150): the rules as written, additivity (re-run every pin, and the callings report's four existing rows), determinism (two runs and a replay of a Conductor fight), the "more" source count, the aura constraint (the three files untouched, no aura read but `inField`), the HUD and sound agreeing with the sim at a Duet, a Trio, a beat window and a Finale with a lost turn.

**Done when**: the report lists each finding with a file and line, and each is fixed with a regression test by the stream that owns the file, or accepted by you.

## Tests (W1, in `tests/sim/conducting.test.ts`, `conductingFinale.test.ts`, `conductingDeterminism.test.ts`, `tests/meta/conducting.test.ts`)

One test per rule at least:

- **Passive.** A Cue costs 15 (with Silent Cues: 25; on the beat with it: 10); a Perfect Ward gives 24, and 28.8 with Standing Ovation III; the fade keeps 30 from 35 and 30 from 40, keeps 100, and without the Conductor keeps 25 from 35.
- **Chains.** A second Cue 2.9 s after the first is a Duet (×1.25) and 3.1 s after is a new chain; a third 2.9 s after the second (5.8 s after the first) is a Trio; a repeated hero starts a new chain; an uncued Solo between two Cues neither joins nor breaks; a free Cue joins.
- **Power, Solo by Solo** (all twelve, each Cued at link 1 and at link 2 from the same staged state): damage per hit ×1.25 exactly; Kael's dome ×1.25; Celestial Sphere 3 hits; Oathkeeper's share ÷1.25; the Ancient's slam ×1.25 and its life, root and the Cued disc's radius unchanged; Thousand Cuts' extension unchanged; Blood Brother's share and Homecoming's barriers ×1.25; Blade Waltz's counter ×1.25; an arrow loosed before the Solo ends lands with its power; the extra is in `ledger.calling.amplified`.
- **Grand Finale.** Turns 1 s apart in slot order at ×1, ×1.2, ×1.44, Cued form, no `cued` event, `ledger.cues` unchanged, `crescendos` +1; Maestro: six turns to ×2.48832, costs 75 and keeps the rest; a hero mid-Solo waits and plays after; a downed, possessed or stilled hero loses the turn and the ramp doesn't advance; the 12 s cap loses waiting turns; every hero not dead is at 100 after, a mid-Solo hero's charge ready when the Solo ends; no Resonance during; Da Capo after; `field.crescendo` false and every aura's effect equal to a no-Crescendo tick; it cancels Fortissimo Silence; no chorus pulse, Canon or Constellation from its turns.
- **Marcato.** A Rally gives every standing hero +10% for 4 s; a second Directive at 5 s gives nothing, one at 8 s does; a refused Focus gives nothing; a downed hero gets nothing; Oro's Saplings' hits aren't raised.
- **A Tempo.** A Cue at k·bar ± 0.149 s is free, at ± 0.151 s costs 15; with 0 Resonance, a Cue on the beat is accepted; it counts in a chain and in `freeCues`.
- **Reprise.** A Trio gives every non-downed hero +30 charge, banked on a hero mid-Solo; once a chain; Canon then Reprise.
- **Upbeat.** 50 at tick 0; with the Cantor's Hymnal 75 (or the Hymnal's value + 50, capped at 100).
- **Ensemble.** Bonus 5, 10, 15, then 5 on a repeat; hero hits only; Finale turns and uncued Solos don't touch it.
- **Spotlight.** Empower ×2 on the Cued hero for exactly the Solo, unthreaded; with the Thread on them the larger applies; not on Finale turns.
- **Triad.** Three heroes in the field: no fade and the idle clock stays 0; two: it fades after 5 s; `triad` events on the edges.
- **"More" sources.** On a Trio hit with Spotlight, Marcato and Ensemble, the hit equals base × auras × Empower(×2) × 1.5 × 1.25, and no other new factor appears.
- **Additivity.** Pin 1 is the existing suite; FORBIDDEN keys absent from a Luminary fight and the Chronomancer's golden; `NO_MODS` unchanged in value for every existing key.
- **Determinism.** A Conductor fight twice gives the same hash; its replay round-trips.
- **Meta.** Rank 12's unlocks are `calling.conductor` then `recruit.oro`; Skip the unlocks allows it; a Conductor run's `EncounterStats.conducting` saves and loads; a save without it loads; `curtain_call` is earned by a won Conductor run.

## Bots and harness

As W4 above. The bots read only `WorldState` and the sim's exported helpers. The Skilled bot needs no draw for the beat: it reads `beatAt`. What the bots can't show: Spotlight's worth depends on when the Thread is elsewhere, and the bots Thread as they do today, so its row is partly the Thread's.

## Bands

**Protocol** (5c, 5d, 5e): cells 50 seeds on each of 1000, 500003 and 777001, on each Movement's kit; whole Prelude runs through `tools/callings.ts` (16 paths × `--seeds 50`) on Guardian and Steady; whole Finale-route Expeditions 200 seeds on 2000, 900007 and 333003. A band is met only on all three sets. Tune on two sets; read the third (777001, 333003) only at the end.

**First look before any tuning.** The three existing Callings are measured again in the same reports. They are unchanged code, so the reference numbers below are refreshed, not tuned.

| Measure | Reference today | Conductor's band |
|---|---|---|
| Whole Prelude runs, Novice, all paths (Guardian · Steady) | none 32 · 38%; Luminary 42 · 49; Martyr 46 · 49; Chronomancer 46 · 52 (docs/phase-3e.md:101-108, to refresh) | between the lowest Calling − 3 and the highest + 3, in the same report |
| Whole Prelude runs, Skilled | none 86 · 88%; Chronomancer 95 · 94; the others 1-3 above none (same) | ≥ none, ≤ the highest Calling + 2 |
| A tier's two options, Novice, Guardian | Chronomancer ≤ 9 points apart (same) | ≤ 8 points apart, except an option the bots can't use (named) |
| The Unweaver cell, Skilled | ≥ 75% each; every Calling 98-100% (docs/phase-5c.md:973) | ≥ 75% for both Conductor setups |
| The Silent Conductor cell, Skilled | ≥ 75% and ≤ none + 40 s; none 96-98%, 174-176 s; Luminary 152-159 s; Martyr 178-182 s; Chronomancer 163-166 s (docs/phase-5d.md:1063-1078) | ≥ 75% each; length from none − 25 s to none + 40 s |
| Cues a boss fight, Skilled | none's, from the first look | ≥ 1.3 × none's |
| Duets and Trios as a share of Cues, Skilled | — | ≥ 40% |
| Trios a boss fight, Skilled | — | ≥ 0.5 |
| Grand Finales a boss fight | Stasis: Novice 2 in 48 hard fights, Skilled 0 (docs/phase-3e.md:128) | Skilled ≥ 0.6, Novice ≥ 0.2 |
| A Tempo: Cues on the beat | chance alone ≈ 11% | Skilled ≥ 60%, Novice 15-45% |
| Novice and Skilled | — | Novice ≤ Skilled in every row |
| Every existing row in the same reports | — | byte-equal to the pre-W1 report |

**Levers, in order** (the Conductor's own numbers only):

1. Grand Finale: `ramp` (20; 10-30), `gap` (1 s; 0.5-1.5), Maestro's `cost` (75; 75-90).
2. Chains: `duet` and `trio` (25 and 50; ±10 each), `window` (3 s; 2-4).
3. The passive's economy: `cue` (15; 15-20), `gain` (20; 10-20).
4. The path's numbers: Marcato (10%, 4 s, 8 s), A Tempo's `window` (0.15 s; 0.10-0.20), Reprise (30), Upbeat (50; 25-50), Ensemble (5 and 15), Spotlight (×2; ×1.5-2). Triad's count stays 3.
5. Conductor-only bot rules and constants, only where an ablation (`tools/verbs.ts`) shows the bot misplays.

The Finale's full recharge at its end is the plan's text; if levers 1-4 can't bring it into band, ask before changing it.

## Exit criteria

| # | Criterion | Checked by |
|---|---|---|
| 1 | Every pin in ground rule 1 is byte-identical with the Conductor not chosen; `SIM_VERSION` is 22; only `contentVersion` moved | `m1Unchanged.test.ts`, the baseline `--check` tools, the snapshot tests, the callings report against the pre-W1 one |
| 2 | No aura definition, number, reach or look changed; the three aura files are untouched | `git diff`, W6 |
| 3 | The Conductor unlocks at Rank 12 beside Oro, under Skip the unlocks too, and is pickable and playable in every Movement and the Finale | `tests/meta/conducting.test.ts`, the e2e test, W4's cells |
| 4 | Every rule under *Reading the plan* has a test, and the HUD and sound read the sim's helpers, never a copy of a rule | W1, W2 and W3 tests; W6 |
| 5 | The beat cue works with sound off and with reduced motion; the music follows the sim's downbeat within 30 ms | `tests/uiConducting.test.ts`, `tests/audioConducting.test.ts` |
| 6 | Every band is met on all three sets, or listed as missed with its cause for your decision | W5's *Tuning* section |
| 7 | The three Conductor goldens reproduce, and one replay round-trips | `golden.json`, `determinism.test.ts` |
| 8 | Vitest, typecheck and lint green; e2e green or recorded "not run" with the reason | CI, the hand-off |

## Out of scope

- A mastery reward (title or variant) for the Conductor.
- A cooldown on Directives (the plan's 3 s). Marcato has its own 8 s.
- The Maestro build's other pieces: the Rubato aura, the Syncopation Chord, the Accelerando and Tempo Rubato motifs.
- New barks for Duets, Trios or the Finale (the Cued bark plays as now).
- Timeline markers for Duets and Trios (Cues keep their `'cue'` marker).
- Renaming the Silent Conductor's existing strings.
- Training Grounds drills for the beat.

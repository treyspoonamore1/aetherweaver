# Phase 5f: the Conductor Calling

*2026-11-09 · design and contracts · main at 2b34c39 · plan: [03 §2](plan/03-content-bible.md#2-callings-choose-one-per-run) (the Conductor, line 92), [02 §4.5](plan/02-game-design.md) (Solos, Cues, Crescendo), [02 §4.6](plan/02-game-design.md) (Directives), [02 §9](plan/02-game-design.md) (line 235: Rank 12, "Conductor; Oro recruitable via event"), [02 §11](plan/02-game-design.md) (line 265: the Maestro build), [02 §12](plan/02-game-design.md) (power math), [04](plan/04-presentation.md) (readability rules) · follows [Phase 3e](phase-3e.md) (the last Calling) and [Phase 5e](phase-5e.md) (Seren and Oro)*

The fourth **Calling**: the one who makes them great. The Luminary makes the heroes shine, the Martyr takes their wounds, the Chronomancer bends the seconds around them. The Conductor leads them. Cues are cheap, Solos called close together grow stronger, and the Crescendo plays every hero's Solo in turn.

It unlocks at **Rank 12** (6,650 XP), the same Rank as Oro's recruit (`recruit.oro`, docs/phase-5e.md:621). Like the Martyr's Vow and the Chronomancer's Stasis, its Crescendo, **Grand Finale**, replaces Sunrise. It takes no key: Cues stay on Shift+1 to Shift+4 and the Crescendo on its own key.

This doc is the spec. Implementers build from it and their brief, nothing else. Every number below is a starting value that W5 tunes, inside the levers listed under *Bands*. W5 has tuned the passive: the text below gives the as-built numbers (Cues 20, gain 10%, a 4 s window) and notes the earlier value where a reader would be confused. *As built* and *Tuning* hold the rest.

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
| 7 | Cues cost 20 (15 before tuning), but the meter only keeps whole segments of 25 from fading. Spend 20 from 65 and 20 of the 45 left fades away (to 25). | (a) on a Conductor run the meter also keeps whole Cues: what remains fades no lower than the larger of its whole segments and its whole Cues; (b) unchanged | **default taken: (a).** Otherwise idle seconds quietly take back the Calling's discount. |

## The Conductor: the one who makes them great

> *On my count. All of you.*

**Passive.**

- **Cues cost 20 Resonance** instead of 25 (15 before tuning).
- **You gain 10% more Resonance** from everything that gives it (20% before tuning).
- **Duets and Trios.** Cue a Solo within **4 s** of your last Cue and it plays as a **Duet**: **25% stronger**. A third hero Cued within 4 s of the second plays as a **Trio**: **50% stronger**. (The window was 3 s before tuning.)

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

- The meter keeps its four segments of 25 and its Crescendo at 100. A Cue costs 20. The HUD already draws a Cue's cost as ticks on the meter when it isn't one segment (`cueTicks`, `dissonanceModel.ts:576`): ticks at 20, 40, 60, 80 and 100.
- Silent Cues (Dissonance, one rank) adds its 10 on top: a Cue costs 30. On the downbeat (A Tempo) only the surcharge is paid: 10 with Silent Cues, 0 without.
- **The fade** (decision 7). Today only the partial segment fades, after 5 s without a gain, at 4 a second (`sim/combat/resonance.ts:36-44`; `content/weaver.ts:79-80`). On a Conductor run the meter fades no lower than the larger of two floors: its whole segments (25s) and its whole Cues (multiples of the off-beat Cue cost, 20). From 45 it fades to 40; from 65 to 60; from 35 to 25, because a whole segment is then the larger floor; from 100 it never fades. With Silent Cues the Cue costs 30 and the floor moves in 30s: 40 fades to 30, 70 to 60, and 50 stays. Without the Conductor nothing changes (45 fades to 25). Before tuning, at Cue 15, the same rule kept 30 from 35 and from 40.

### Resonance gains +10%

Every gain is multiplied by 1.1 through the existing `resonanceMult` (`resonance.ts:13`), on top of Standing Ovation (multiplied, not added: Standing Ovation III and the passive give ×1.32; ×1.44 before tuning). The +10% applies to gains only: not to Upbeat's 50 at the start, not to the Cantor's Hymnal, not to Da Capo's 25 kept after a Crescendo. No Resonance is gained while the Grand Finale plays, as for every Crescendo.

### Duets and Trios

- **A chain** starts with any Cue. Each later Cue joins it if it comes **within 4 s of the chain's last Cue**, measured in sim time from the tick the last Cue was given to the tick this one is given (≤ 4.0 s joins). The window rolls: a Trio can span up to 8 s. (3 s and 6 s before tuning.)
- The second Cue of a chain is a **Duet** (×1.25), the third a **Trio** (×1.5).
- **A chain needs different heroes.** Cueing a hero already in the chain starts a new chain with that Cue as its first. With a party of three, a chain is at most three long. (A hero can't be Cued twice within 4 s anyway: a Cue needs a full Solo and no Solo playing.)
- **Only Cues count.** A Solo a hero fires on their own (Hero Autonomy, Kael bracing below 30% life, Shieldbearer) neither joins nor breaks a chain. A Grand Finale turn neither joins nor breaks one (decision 3).
- **A free Cue** (A Tempo) is a Cue like any other.
- **Hero Autonomy** is unchanged: a full Solo still fires itself 1 s after it is ready (`AUTONOMY.cueGrace`, `constants.ts:28`), so with the assist on a chain must be built quickly.
- **What the player sees.** After each Cue a gold ring drains around the Cue strip for 4 s, and every hero whose Solo is ready shows what a Cue now would be: "Duet ×1.25" or "Trio ×1.5". The forming Cue calls out "DUET" or "TRIO".

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
- **What the player sees** (the cue works with sound off). A metronome strip under the Resonance meter, only on runs with A Tempo: four beat marks a bar, the first larger, and a light that runs along them with the sim's time. The downbeat's window is drawn as a band around the first mark. While the light is inside the band, the band glows white-gold and every ready hero's Cue badge reads "Free" (as built, only when the Cue costs 0; under Silent Cues it reads "On the beat · 10", see *As built: W2*). In the world, a faint white-gold ring pulses from the Weaver's feet on each downbeat. With reduced motion the light steps beat by beat instead of sliding.
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
  // As built after tuning: cue 20, gain 10, window 4 (cue 15, gain 20, window 3 in the first design). The code's key for the window is `chain` (see *As built: W1*).
  values: { cue: 20, gain: 10, window: 4, duet: 25, trio: 50, ramp: 20, gap: 1, wait: 12 },
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
| `cueCostBase: number \| null` | `null` (content's 25) | passive | `cue` (20) |
| `resonanceMult` (exists) | 1 | passive | `*= 1 + gain / 100` |
| `chainWindow` | 0 (no chains) | passive | `window` (4; `chain` in code) |
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
  /** What a Cue costs off the beat, Silent Cues included (20). */
  cueCost: number;
  /** What the Crescendo costs (100; Maestro 75). */
  crescendoCost: number;
  window: number;            // 4 (`chainWindow` in code)
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

- `DissonanceState.cueCost` (`world.ts:871`) becomes `(mods.cueCostBase ?? content.resonance.cueCost) + mods.cueCostBonus`: what a Cue costs off the beat this fight. Its comment says so. The bots read it as the Cue's cost today (`novice.ts:407`, `skilled.ts:1040`), so they see 20 on Conductor runs with no change.

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
| **Weaver bar** (`hud/WeaverBar.tsx`) | Cue ticks at each multiple of the Cue's cost (20; existing). **The chain ring**: a gold arc around the Cue strip, draining from `cueChained.until`, labelled "Duet next" or "Trio next". **The beat strip** (A Tempo only): four beat marks, the light, the window band; "Free" in white-gold inside it (geometry from `beatAt`). **The Crescendo read-out**: "Grand Finale", its cost from `crescendoCostOf` (75 with Maestro), ready at that cost. While it plays: turn pips (3, or 6 with Maestro), lit as played, crossed as lost, and the next hero's name with their power ("Lyra next ×1.44", from `finaleView`). |
| **Party frames** (`hud/PartyFrames.tsx`) | A ready hero's Cue badge shows `nextCue`: "Duet ×1.25", "Trio ×1.5", and "Free" on the beat. Marks: Spotlight (a light cone glyph, for the Solo), Marcato (+10%, a 4 s sweep). During the Finale: each hero's place in the queue (1, 2, 3), "waits" or "lost". |
| **Calling chip** (`hud/CallingChip.tsx`, `hud/calling.ts`) | Marcato "ready" or "Marcato 5s"; Ensemble pips (0-3) and "+10%"; Triad "holding" while it holds; it blazes while the Finale plays. |
| **HUD helpers** (`hud/conducting.ts`, new) | Pure, tested: badge labels from `nextCue`, the beat strip from `beatAt`, the Finale's pips from `finaleView`, the chip's states. |
| **Bridge and store** (`hudBridge.ts`, `store.ts`) | `crescendoCost` from `crescendoCostOf` (today `resonance.crescendoCost`, `hudBridge.ts:515`); the conducting view and field carried to the HUD. |
| **Dissonance chip** (`screens/dissonanceModel.ts`) | `hudDissonanceView` (`:520-534`) compares the Cue's cost with the Calling's own (20 on a Conductor run), not the content's 25, so it doesn't report "A Cue costs 20 Resonance this fight" as Dissonance. |
| **Callouts** (`hud/Callouts.tsx`, `src/app/runtime.ts` callouts only) | Gold: "DUET · Lyra ×1.25" (toast), "TRIO · Vexis ×1.5" (banner), "Free Cue · on the beat" (toast). "Reprise · every Solo +30%", "Marcato · +10% for 4 s". "Crescendo — Grand Finale" banner with its glyph; each turn a toast "Kael ×1 · Lyra ×1.2 · Vexis ×1.44" building up; "Every Solo is full" when it ends; "Vexis can't play — down" for a lost turn. |
| **Hints** (`hud/hints.ts`, `HowToPlay.tsx`, `KeyHints.tsx`) | `chain` ("Cue another within 4 s for a Duet"), `beat` (A Tempo: "Cue on the downbeat: it's free"), `finale` ("Grand Finale plays every Solo, rising, then fills them all"). The Cue hint's cost line already reads `cueCost` (`hints.ts:360-365`). |
| **Result, Summary, Codex** (`resultText.ts`, `ResultScreen.tsx`, `SummaryScreen.tsx`, `callingText.ts`, `CodexScreen.tsx`) | Result: "3 Duets · 1 Trio · Grand Finale played 6 Solos · 4 Cues on the beat, free". Summary: the Conductor's panel (totals, path); a run with no Duet says how ("Cue a second hero within 3 s"). Codex: four Callings, his axis legend; the Cue entry names Duets and Trios on his runs. Rank 12: generic (`rankText.ts`, `Rank.tsx`). |
| **Lab** (`ui/lab/UiLab.tsx`, `mock.ts`) | A Conductor group: Prep, tier screen, the HUD at a Duet, a Trio, the beat window, a Finale with a waiting and a lost turn. |
| **e2e** (`e2e/smoke.spec.ts`) | Skip the unlocks, choose the Conductor in Prep, see its Cue cost on the meter ("Cue 20", read from content), stage two Cues within 4 s (debug `chargeSolos`, `setResonance`) and see the DUET call-out. |

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
- `conductBeat` (A Tempo): a wanted Cue that isn't urgent waits for the window if it opens within 0.6 s (2.8 s after tuning); the Cue is sent on the first tick inside it. Chained Cues too, when the window comes before the chain closes.
- `conductFinale`: cast the Grand Finale when it is affordable, 2 or more heroes are free, and a boss stands above 10% life or 4 or more enemies stand, unless `bankCrescendo` or `crescendoCancel` holds it (after tuning `bankCrescendo` no longer holds it on a Conductor run). The existing defensive Crescendo rule stays beside it.
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

- **Passive.** A Cue costs 20 (with Silent Cues: 30; on the beat with it: 10); a Perfect Ward gives 22, and 26.4 with Standing Ovation III; the fade keeps 40 from 45, 60 from 65 and 25 from 35, keeps 100, and without the Conductor keeps 25 from 45; with Silent Cues it keeps 30 from 40 and 60 from 70, and 50 stays.
- **Chains.** A second Cue 3.9 s after the first is a Duet (×1.25) and 4.1 s after is a new chain; a third 2.9 s after the second (5.8 s after the first) is a Trio; a repeated hero starts a new chain; an uncued Solo between two Cues neither joins nor breaks; a free Cue joins.
- **Power, Solo by Solo** (all twelve, each Cued at link 1 and at link 2 from the same staged state): damage per hit ×1.25 exactly; Kael's dome ×1.25; Celestial Sphere 3 hits; Oathkeeper's share ÷1.25; the Ancient's slam ×1.25 and its life, root and the Cued disc's radius unchanged; Thousand Cuts' extension unchanged; Blood Brother's share and Homecoming's barriers ×1.25; Blade Waltz's counter ×1.25; an arrow loosed before the Solo ends lands with its power; the extra is in `ledger.calling.amplified`.
- **Grand Finale.** Turns 1 s apart in slot order at ×1, ×1.2, ×1.44, Cued form, no `cued` event, `ledger.cues` unchanged, `crescendos` +1; Maestro: six turns to ×2.48832, costs 75 and keeps the rest; a hero mid-Solo waits and plays after; a downed, possessed or stilled hero loses the turn and the ramp doesn't advance; the 12 s cap loses waiting turns; every hero not dead is at 100 after, a mid-Solo hero's charge ready when the Solo ends; no Resonance during; Da Capo after; `field.crescendo` false and every aura's effect equal to a no-Crescendo tick; it cancels Fortissimo Silence; no chorus pulse, Canon or Constellation from its turns.
- **Marcato.** A Rally gives every standing hero +10% for 4 s; a second Directive at 5 s gives nothing, one at 8 s does; a refused Focus gives nothing; a downed hero gets nothing; Oro's Saplings' hits aren't raised.
- **A Tempo.** A Cue at k·bar ± 0.149 s is free, at ± 0.151 s costs 20; with 0 Resonance, a Cue on the beat is accepted; it counts in a chain and in `freeCues`.
- **Reprise.** A Trio gives every non-downed hero +30 charge, banked on a hero mid-Solo; once a chain; Canon then Reprise.
- **Upbeat.** 50 at tick 0; with the Cantor's Hymnal 100 (the Hymnal's 50, or 75 Empowered, + 50, capped at 100).
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
2. Chains: `duet` and `trio` (25 and 50; ±10 each), `window` (4 s as built, 3 s before tuning; 2-4).
3. The passive's economy: `cue` (20 as built, 15 before tuning; 15-20), `gain` (10 as built, 20 before tuning; 10-20).
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

## As built: W1

W1 (content, sim, run layer) is built as specified, with the differences below. Where this section and *Contracts* disagree, this section is what the code does, and W2 to W5 build on it.

**Names.** `tests/architecture.test.ts` forbids the bare word `window` anywhere in sim or content code, strings included, so:

| The contract says | The code has |
|---|---|
| the passive's `values.window`, `{window}` | `values.chain` (3), `{chain}` |
| A Tempo's `values.window`, `{window}` | `values.beat` (0.15), `{beat}` |
| `ConductingView.window` | `ConductingView.chainWindow` |
| `ConductingView.beat: { bar, window }` | `{ bar, within }` |

The mods keep their names (`chainWindow`, `beatWindow`). The levers' `window` under *Bands* means `chain` and `beat`.

**One field added.** `DamageTaken.conducted?: number`: the Conductor's share of a hit, present only when above 0, so the HUD and the render can mark it without a sim change. On Conductor runs the event's `eclipse` share excludes it.

**Helpers.** As listed, exported from `src/sim/index.ts`. `triadHolds` and `wholeCues` live in `combat/resonance.ts`. `ConductingStats` (`meta/types.ts`) has no `finaleLost`.

**Behaviour, where a reading was chosen.**

- The Finale's ramp is repeated multiplication, not `**` (the sim avoids `pow`): ×1, 1.2, 1.44, 1.728, 2.0736, 2.48832.
- `finaleTurn` is emitted after that turn's `soloStarted { cued: true }`, in the same tick. `finaleEnded` comes before `crescendoEnd`.
- At a due turn the queue is read in order: a lost hero is dropped, a waiting hero is skipped, and the first free hero plays. A dead hero loses the turn with reason `'down'`.
- Turns stop when the fight is won or lost.
- `soloDone` runs last in `finishSolo`, so Supernova's nova keeps the Solo's power. A Solo cut short by a down has its entry removed by `updateConducting`.
- The Ancient's slam reads its owner's running Solo. It outlives Wildgrowth by about 1 s, and slams after the Solo ends land at power 1.
- Blade Waltz's counter carries the power on its hit (the same ×power, credited to the Calling), not on its percentage.
- Reprise's ledger total counts the charge actually gained, after the cap at 100. On Conductor runs `soloReady` is emitted when a Solo ends with its charge already full.
- With Silent Cues the meter's whole-Cue floor moves in the Cue's cost this fight: 30 as tuned (25 at Cue 15).
- Marcato's heroes are fixed when it is given: a hero revived later doesn't get it.

**Placeholders for W2.** `src/ui/hud/calling.ts` (the `crescendo` unions gained `'finale'`) and `src/ui/screens/deedsModel.ts` (`curtain_call` uses the `star` glyph until his own is drawn).

**The chorus pulse.** It fires on every Cue as before, so it fires more often here. With the Skilled bot not yet chaining Cues, over 30 fights a row: 1.83 pulses a fight with no Calling, 2.13 with the Conductor's passive (+16%). These were measured before tuning, with Cues at 15 and gains at 20; the tuned measurement is under *Tuning*. No chorus or aura number changed. W5 measures it again with the Conductor's bots.

**Checks.** Vitest 180 files, 3660 passed, 8 skipped. Typecheck and lint clean. The 25 goldens, every baseline `--check` and the three existing Callings' reports are byte-equal; only `contentVersion` moved. The three aura files are untouched.

## As built: W2 (UI and HUD)

W2 is built as specified under *UI*, with the differences below. Where this section and *Contracts* disagree, this section is what the code does. Every number on screen still comes from content, the Conductor's view and field, and the sim's helpers (`nextCue`, `beatAt`, `onBeat`, `finaleView`, `crescendoCostOf`, and after the review `openChain`, `finaleTurnBlock`, `marcatoOn`, `marcatoReadyIn`, `ensembleBonus`).

**Files.** The Conductor's HUD logic is in `src/ui/hud/conducting.ts` (pure, tested: badges, the beat strip, the Finale's pips and frames, Ensemble's pips, Marcato's chip). Its parts are in `src/ui/hud/ConductParts.tsx`. The lab's group uses `src/ui/lab/conductingMock.ts`. The tests are `tests/uiConducting.test.ts` (28 tests) and `tests/colorVision.test.ts`. The e2e test is "Phase 5f: the Conductor — choose him in Prep, Cue cost on the meter, two Cues within the window make a Duet". Its title once said "Cue 15"; tuning took the number out of it, and its assertions read content (`Cue ` and the content's `cue`).

**Look.** `CALLING_LOOK.conductor` is `color` `#3a2f55` (plum-ebony), `light` and `text` `#f4eedd` (ivory), `deep` `#4739ac` (ink), icon `chain`, Crescendo icon `finale`. The contract's first choice, indigo `#7f86e6`, failed the colour-vision test beside Kael, so the card and ring are plum-ebony with ivory text. The ink in `deep` is shared with the world (see W3).

**What differs from the contract**

- **The beat strip and the Cue badge are live.** The HUD's snapshot is taken every 1/15 s, up to about 83 ms old, and the window is 0.30 s wide, so "Free" could show when a Cue would cost full price. On A Tempo runs only, `runtime.ts` now writes the beat's state (`time`, `on`, `cost`) to a small store, `useBeatNow` (`src/ui/store.ts`), after every sim step in which time moved. `BeatStrip` and `CueBadge` read it. Other runs do not write it.
- **The badge says "Free" only when a Cue costs 0.** Under Silent Cues a Cue on the beat costs 10; the badge reads "On the beat · 10" and the strip's in-window label shows the cost instead of "Free". The "Free Cue · on the beat" toast fires only for a Cue that cost 0.
- **The timing hints.** `chain`, `beat` and the plain `cue` hint are not offered while the Grand Finale plays or while a banner call-out is up (`QUIET_HINTS` in `hints.ts`). An open `chain` or `beat` hint closes at once when that happens. The `beat` hint reads "Cue on the downbeat: it's free", or "it costs only N Resonance" when the run's Cues cost something on the beat.
- **The chain ring** is hidden while the Finale plays, though Cues then can still form Duets (the badges still show them). After a Trio the ring is gone and no badge offers another link; the ring reads the sim's `openChain`.
- **The Finale's frames** read the sim's `finaleTurnBlock`, so a hero who is downed, possessed or stilled ahead of the queue's next place shows "can't play" (state `losing`) at once, not "waits". A hero with no turn left shows their turns played and lost ("played", "lost", or with Maestro "played · lost"). Played and lost come from the `finaleTurn` and `finaleTurnLost` events (`heardFinale` in `conducting.ts`, held by `runtime.ts`), not from the frame, so a hero who played and then went down still reads "played". A new Finale clears what was heard.
- **Reduced motion.** The beat strip's light stands on the downbeat mark exactly while the window is open, and otherwise on the beat just struck; when the window shuts it moves on to the next mark. The glow and the word "Free" are unchanged, so the cue works with sound off and with reduced motion.

**Accepted copy deviations.** These were reviewed and kept.

| The doc says | The game says |
|---|---|
| Banner "Crescendo — Grand Finale" | "Grand Finale" (one line at 1280 wide); the other Callings' banners are unchanged |
| Result: "4 Cues on the beat, free" | "4 free Cues" (label "Free Cues", on Result and Summary) |
| Marcato chip: "ready" or "Marcato 5s" | "Marcato" when ready; "Marcato 5s" while held |
| Cue badge "Free" on the beat | "Free" at cost 0; "On the beat · 10" under Silent Cues |

Nothing in the UI reads `soloReady` for a downed hero, so the sim's change there needed no UI change. Two values in `hudBridge.ts` are still computed there, because no sim export gives them: the Cue's base cost (`cueBase`) and the Finale's clock (`wait + encoreBonus`). Both equal the sim's by construction today.

## As built: W3 (VFX and audio)

W3 is built as specified under *VFX* and *Audio*. The two Spire and Rift render snapshots and the two audio snapshots are unchanged, and the Conductor adds no draw call (the render test pins it). There is no W3 report file; this section is from its commit message and the code, and records only differences from the contract that the code shows.

**Files.** `src/render/conductCues.ts` (pure helpers and colours), `src/render/conduct.ts` (`ConductView`), `src/render/combatView.ts`, `feedback.ts`, `martyrCues.ts`, `lab/VfxLab.tsx` with `lab/conductScenarios.ts`; `src/audio/conduct.ts` (his sounds), `music.ts` (the beat clock), `sfx.ts`, `ui.ts`, the audio lab. Tests: `tests/renderConducting.test.ts`, `tests/audioConducting.test.ts`.

**Colours.**

| Colour | Hex | Used for |
|---|---|---|
| Ivory | `#f4eedd` | The downbeat's ring, Spotlight's cone; the UI's `light` and `text`. The same hex in world and UI, pinned by a test |
| Ink | `#4739ac` | The stave under a chain, a lost Finale turn; the UI ring's `deep` end. The same hex in world and UI, pinned by a test |
| Gold | the Weaver's own | A Cue's chain, its window, the Finale's baton strokes. No new gold |

The ink changed twice. The contract's indigo `#7f86e6` falls to 3.4 ΔE from Kael's blue under protanopia (the comment in `callingLook.ts`). W3 first used `#5a62d0` in the world, while the UI's ring used `#6b5e96`; the two were far apart, and the world's ink was only 13.0 ΔE from Kael under deuteranopia, below the 20 the UI had used to reject the contract's indigo. The review asked for one shared ink, and `#4739ac` is it. Its ΔE against Kael (CIE76 on simulated colours), old ink then new (the figures are those measured after the ink changed, in the review-fixes digest, item C1):

| Vision | `#5a62d0` | `#4739ac` |
|---|---|---|
| Normal | 20.9 | 37.8 |
| Protanopia | 14.5 | 28.3 |
| Deuteranopia | 13.0 | 26.3 |
| Tritanopia | 16.7 | 32.4 |

The nearest pairs for the new ink are Oro under tritanopia (23.3) and the ailment violet under tritanopia (23.9); his own plum `#3a2f55` is 22.5 from it under tritanopia. All are above 20. No aura, hero or other Calling colour changed. Every visual also has its own shape (a stave line, a triangle, an accent mark, a cone), so none relies on colour.

**Differences from the contract.**

- **The chain ribbon** is drawn from the last Cued hero to each hero who could join it while the window is open, brighter to one whose Solo is ready, not to a single "next" hero. Each hero in the chain has a small gold sigil.
- **The window arc** is drawn only while the sim's `openChain` is true. A Trio closes the chain, so its arc stops at once; the three sigils and the triangle fade out for the rest of the chain's time.
- **A free Cue** (the glass chime and the gold spark on the sigil) is one that is on the beat and costs 0. Under Silent Cues a Cue on the beat costs 10 and gets neither.
- **Grand Finale audio** adds two baton taps as it is raised (the contract lists no start sound), and Reprise's sound is the Trio's chord plucked again an octave up. A lost Finale turn is a muted string, as specified.
- **The beat clock** follows the contract (25 ms tolerance, `BEAT_TOLERANCE`; output latency taken off where the browser gives it; a gap over half a bar re-anchors with a rest). Two details the contract does not state: a downbeat more than half a bar from the music's next bar line also re-anchors, and the time scale the music follows is capped at 1, so it stretches in slow motion and hit-stop but never speeds up.
- **Known gap, dev only.** The beat clock ignores the runtime's dev time scale, so at dev speeds the music re-grids every frame. It needs `runtime.ts` to pass the scale and a decision on the cap at 1. Left open.
- **Known gap, cosmetic.** If a Duet and a Trio land in the same batch of events (two keys in one frame), the Duet's audio answer and link read the chain from the end of the batch, so the Duet hero can answer itself. Fixing it would add a hashed key to `cueChained`. Left open.

I found no other difference from the contract in the code.

## As built: W4 (bots and harness)

W4 is built as specified, with the differences below. Tuning (W5) may change the rules and constants named here; the *Tuning* section is the final word on numbers. The values below are those W4 shipped.

**Readers** (`src/bots/common.ts`). `conductingOf`, `beatSoon` (built on the sim's `onBeat` and `beatAt`), `chainOpen`, `finaleOn`, `marcatoReady`, `finaleFree`, `soloReach` and `soloFullIn`. `crescendoCostOf`, `cueCostNow` and `onBeat` are re-exported from the sim. Every old read of `CONTENT.resonance.crescendoCost` in both bots now uses `crescendoCostOf(state)`. `soloSpec` is not exported by the sim, so `soloFullIn` works out a Solo's charge time from content and `soloChargeMult`.

**Skilled bot.** Each rule is a name in `CONDUCTING_RULES` that `SkilledOptions.skip` can turn off. Each is gated on `conductingOf(state)` and none draws.

- `conductChain`: with a chain open, Cue the next ready hero not in it whose Solo has work. A guarding Solo always has work; Oro's needs an enemy standing; any other needs an enemy within its reach plus `CHAIN_REACH`. Damage Solos first, then guarding ones, in slot order.
- `conductHold`: a damage Cue is wanted and another hero's Solo, with work, fills within `HOLD_FILL`: wait, at most `HOLD_MAX`, then start the chain. It never waits for a guarding Solo, or when a raid or a big hit lands within `HOLD_URGENT`.
- `conductBeat` (A Tempo): a Cue that is not urgent waits if the window opens within `BEAT_AHEAD`. For a chain's next Cue, the window must also open at least `BEAT_CHAIN_SLACK` before the chain shuts. The Cue goes out on the first decision tick inside the window. Affordability uses `cueCostNow`, so a Cue on the beat can go out at 0 Resonance.
- `conductFinale`: cast the Grand Finale when it is affordable, nothing is playing, `FINALE_FREE` or more heroes are free, and a boss stands above `FINALE_BOSS_ABOVE` of its life or `FINALE_CROWD` or more enemies stand. Skipped when `bankCrescendo` or `crescendoCancel` holds the Crescendo (after tuning `bankCrescendo` no longer holds it on a Conductor run: `BANK_WITH_FINALE` is false). While the Finale plays, that tick's Cues and any new chain-start Cues are suppressed. The old defensive Crescendo rule stays beside it.
- `conductMarcato`: with Marcato ready and `MARCATO_ENGAGED` or more heroes engaged, send a Directive if none went out this tick. What it Focuses is `MARCATO_FOCUS` (below).

**Novice bot** (`NOVICE_CONDUCTING`). The draws are taken only on Conductor runs, in this order, immediately before her Cue draw: `chain` (a chain is open and a ready hero is not in it: 0.4 to Cue them), `beat` (A Tempo, inside the window with a ready hero: 0.5), `finale` (the Crescendo affordable, 2 or more heroes free, and a boss or 4 or more enemies: 0.15). A Conductor Cue sent in a decision replaces her normal Cue draw, and a Finale sent replaces her low-life Crescendo; both only on Conductor runs. Her low-life rule stays.

**Constants.** Named at the top of `skilled.ts` and `novice.ts`.

| Constant | Value |
|---|---|
| `HOLD_FILL`, `HOLD_MAX`, `HOLD_URGENT` | 2 s each |
| `BEAT_AHEAD` | 0.6 s (2.8 s after tuning) |
| `BEAT_CHAIN_SLACK` | 0.1 s |
| `CHAIN_REACH` | 2 m |
| `FINALE_BOSS_ABOVE` | 0.10 |
| `FINALE_CROWD` | 4 enemies |
| `FINALE_FREE` | 2 heroes |
| `MARCATO_ENGAGED` | 2 heroes |
| `MARCATO_FOCUS` | `'standing'` (`'boss'` and `'kael'` are the alternatives) |
| Novice `chain` / `beat` / `finale` | 0.4 / 0.5 / 0.15 |
| Novice `FINALE_CROWD` / `FINALE_HEROES` | 4 / 2 |

**Harness.**

- `tools/harness-core.ts`: `ConductingWatch` and `EncounterRun.conducting?` (present only on Conductor runs) tally per fight the Cues, chains, Duets, Trios, Cues on the beat, Resonance saved, Finales, Finale Solos and lost turns, Reprise charge, Marcato grants and chorus pulses.
- `tools/callings.ts`: `callingSetups()` has `conductor + Triad` (marcato, reprise, ensemble, triad) and `conductor + Maestro` (a_tempo, upbeat, spotlight, maestro). Conductor rows always print the use columns; `--uses` prints Cues, pulses and Crescendos on every row. A `conductor band:` line is printed under the cells header. Whole-run mode takes `--calling conductor` for all 16 paths.
- `tools/verbs.ts`: with `--calling conductor` the default ablations are `CONDUCTING_RULES` (or the Novice's `NOVICE_CONDUCTING` with `--bot novice`); rows print the Conductor's counts.
- `tools/scenarios.ts`, `tests/sim/golden.json`, `tests/sim/m1Unchanged.test.ts`: the three goldens appended after the 25 (28 in all), `skilled-conducting-bellwarden`, `novice-conducting-first-light` and `skilled-conducting-silent`. The last is a plain full-fight bot scenario of 220 s, not the Grand Silence variant. `skilled-conducting-bellwarden` joins the replay round-trip in `determinism.test.ts`. The 25 older hashes did not move. To re-record, run `npx tsx tools/update-golden.ts` (a dry run that lists what would move; stop if anything outside the three `*-conducting-*` names appears), then `--write`, then copy the three values into `CONDUCTING_HASHES` in `m1Unchanged.test.ts`.
- Every baseline `--check`, the four commandSnapshot files, `roster20.test.ts` and the three older Callings' whole-run reports were byte-equal after W4's edits.

**Recorded deviations.**

- **Downed Weaver (B1).** A downed Weaver keeps the Grand Finale playing: the sim's turn check ignores her, while a Cue would be refused if she were down. The contract's list of what the Finale does not need does not mention her. Accepted.
- **`MARCATO_FOCUS` (B2).** `conductMarcato` re-Focuses only a Focus already standing, not the boss or Kael's target as the contract says. A Focus pins every hero on its target until it dies. At Movement I, Skilled, 50 seeds, the contract's rule dropped the Tolling Halls from 100% to 86% and the Hollow Cantor from 98% to 86%; on whole Preludes (Guardian, 10 seeds a path) the Marcato paths won 69% against none's 86%, and with `'standing'` 90%. The rule is nearly inert on plain fights and still fires at the Unweaver and the Silent Conductor, where the bot already Focuses. Setting `MARCATO_FOCUS` to `'boss'` or `'kael'` restores the contract's behaviour.
- **The `conductor band:` header (B5).** `tools/callings.ts` prints that line under the cells header on every run, Conductor or not. The rows are byte-equal to before; the whole report file is not.
- **The Novice and Marcato (B7).** She cannot use Marcato in the Prelude: she sends no Directives at First Light. For her tier-band row, Marcato counts as the contract's "option the bots can't use".
- **Smaller.** "Has work" uses the Solo's own `radius` or `reach`, else the hero's attack range, plus `CHAIN_REACH`. Alternate Solos count as damage Solos; only `aegisWall`, `oathkeeper` and `celestial_sphere` count as guarding, as in the existing `GUARDING` set.

## Review (W6)

An independent review read commit `2a9f68b` (W2, W4 and the first review fixes) against W1 and W3, changing nothing. It could not run the full suite, the baseline `--check` tools, the callings report or the e2e test; byte-identity of the older pins rests on W4's runs and its reading of the code.

**Found sound.**

- No aura file changed (empty `git diff` over the three). The only aura read in new code is `triadHolds`, which calls `inField`. The chorus pulse gets no Conductor factor and Finale turns release none.
- Additivity: new hashed keys are added by conditional spread or deleted, never set to `undefined`. The unguarded ×power sites multiply by exactly 1. The Novice's draws come only after `conductingOf`.
- Determinism: no wall clock, no Map or Set iteration, no `**`; the bot's `holdSince` is bot-private.
- The "more" sources are exactly the Cue bonus × (1 + Marcato + Ensemble), with Spotlight as the larger of it and the Thread; nothing else stacks.
- Chain edges (at the 3 s window of the time, a Cue at 2.999999999999994 s joins in the sim, HUD, bot and world), the Finale's queue, ramp, lost and waiting turns, the 12 s cap, Da Capo, Encore and the Fortissimo cancel; Marcato's hero set; A Tempo is judged at the same time the HUD and bots read.
- The audio beat clock follows the sim's downbeat each frame and sets no input without A Tempo. Callouts, sound and world all come from the same events in the same batch. A fight restarts from its start on resume, so no mid-fight Conductor state needs saving. Nothing relies on colour alone.

**Defects.**

| Finding | Status | Where fixed |
|---|---|---|
| A1. The beat strip and the "Free" badge came from a snapshot up to about 83 ms old, so "Free" could show when a Cue cost full price, and the first 8% of each window was missing | Fixed | `useBeatNow` in `src/ui/store.ts`, written by `src/app/runtime.ts` on A Tempo runs; `liveBeat` and `liveCueBadge` in `src/ui/hud/conducting.ts` |
| A2. Two of the three Conductor goldens pin little (as reviewed at `2a9f68b`, before tuning): `novice-conducting-first-light` has the same hash with all three Novice draws skipped (1 Cue, no chain, no Directive); `skilled-conducting-silent` makes 2 Cues, no Duet or Trio, no stilled loss, and is won at 103.2 s of 220 s | Open: to be re-picked after tuning, with an assertion that each golden produces its named events | `tools/scenarios.ts`, `golden.json`, `m1Unchanged.test.ts` |
| A3. With reduced motion, the beat light sat outside the band for the window's first half and inside it for about 0.5 s after the window shut | Fixed | `stepped` in `src/ui/hud/conducting.ts`; test updated |
| A4. Audio and world treated any Cue on the beat as free; under Silent Cues it costs 10 | Fixed: free means on the beat and cost 0 | `src/audio/conduct.ts`, `src/render/conduct.ts`; Silent Cues cases in the render and audio tests |
| A5. During the Finale a hero's frame read "waits" when their turn was about to be lost; "played" and "will lose" wording was wrong for Maestro's second pass | Fixed | `finaleTurnOf` in `src/ui/hud/conducting.ts` and `ConductParts.tsx`, on the sim's `finaleTurnBlock` |
| A6. The world drew the chain's draining window arc for the rest of the chain's window (about 3 s then) after a Trio had closed the chain | Fixed | `ConductLook.chainOpen` from `openChain` in `src/render/conduct.ts`; the Trio test asserts no arc |
| A7. After a victory a Finale still playing ended up to 12 s later with "out of time" losses and "Every Solo is full" over the victory screen | Fixed | `finishFinale` in `src/sim/systems/conducting.ts`; `tests/sim/conductingReview.test.ts` |

### What the review fixes changed

These are the fixes made after the review that change something this doc describes. Where a section above and this list disagree, this list is what the code does.

- **The beat is read live on the HUD (A1).** The beat strip and the Cue badge no longer come from the 1/15 s snapshot. On A Tempo runs the runtime writes the beat's state to a small store after every sim step in which time moved, and both read it. Runs without A Tempo write nothing.
- **A Cue is "free" only when its cost is 0 on the beat (A4, B6).** The badge, the glass chime, the gold spark, the "Free Cue" toast and the Result's count all follow this. Under Silent Cues a Cue on the beat costs 10 and is not free. The `beat` hint reads "it costs only N Resonance" when N is above 0.
- **The chain arc stops when the chain closes (A6).** A Trio closes the chain at once in the sim, and the world now draws the draining arc only while the sim's `openChain` is true. The three sigils and the triangle still fade out over the chain's remaining time.
- **The Finale stops silently when the fight ends (A7).** If the encounter is won or lost, `finishFinale` deletes the Finale and returns: no events, no ledger change, no Solo fill, no `finaleEnded`. The guard is inside `finishFinale` because `updateWeaver` runs before `updateConducting`, so the Crescendo clock can reach 0 on the first tick after the end. The Weaver's Crescendo clock itself runs on, as it does for every other Calling, and emits one `crescendoEnd` when it reaches 0 (Da Capo's Resonance comes back as usual). A Finale that ends before the victory is unchanged.
- **The Conductor's ink is `#4739ac` (C1).** One shared ink: the UI's `deep` and the world's `ink` are pinned equal, as are the two ivories (see W3). No aura, hero or other Calling colour changed.
- **Sim exports.** `openChain(state)`, `finaleTurnBlock(state, heroId)` (type `FinaleTurnBlock`), `marcatoOn(state, heroId)`, `marcatoReadyIn(state)` (seconds; 0 when ready; null without Marcato) and `ensembleBonus(state)`, from `src/sim/systems/conducting.ts` through `src/sim/index.ts`. `conductingMult` uses `marcatoOn`. The HUD and the world now read these instead of copies of the rules: the HUD's chain, Ensemble, Marcato and Finale frames; the world's chain, beat window and Marcato mark. The bots were not moved over (see *Open*).
- **Reduced motion and the Finale's frames (A3, A5)** are as described under W2.

**The goldens.** The review fixes moved two of the three. `skilled-conducting-silent` went from `e5a4591944bfaf5f` to `fc8d5919f14c2252` (it hashes ticks after victory). `novice-conducting-first-light` stood at `3841213b5513b682` at the review; its hash has changed when the bots' rules changed. Tuning then re-recorded all three, and these are the pinned values (`tests/sim/golden.json`, `m1Unchanged.test.ts`): `skilled-conducting-bellwarden` `013e676d2eaa8f74`, `novice-conducting-first-light` `c3408b85068381ef`, `skilled-conducting-silent` `d200c6af6720f641`.

### Deviations from the design

The review (W6) lists seven deviations, B1 to B7. Each is stated as the review states it, with where it stands.

| # | Deviation | Status |
|---|---|---|
| B1 | A downed Weaver keeps the Grand Finale playing: the sim's turn check ignores her, while a Cue would be refused if she were down. The design's list of what the Finale does not need does not mention her. | Accepted |
| B2 | `conductMarcato` re-Focuses only a Focus already standing (`MARCATO_FOCUS` is `'standing'`), not the boss or Kael's target as the design says. W4 measured the reason, and W5 measured it again on the final bot and kept it; the rule is nearly inert on plain fights. | Accepted |
| B3 | Copy differs from the design: the banner is "Grand Finale", not "Crescendo — Grand Finale"; the Result says "4 free Cues", not "4 Cues on the beat, free"; the Marcato chip says "Marcato", not "ready"; the chain ring is hidden while the Finale plays, though Cues can still form Duets then (the badges still show them). | Accepted |
| B4 | Harness labels: `ConductingTally.onBeat` is documented as "free" but counts paid on-beat Cues too, and `chains` counts every link-1 Cue, single ones included. | Open |
| B5 | `tools/callings.ts` prints a `conductor band:` header line under the cells header on every run. The rows are byte-equal; the whole report file is not. | Accepted |
| B6 | The hint "Cue on the downbeat: it's free" was untrue under Silent Cues, where the strip correctly shows the cost. | Fixed: the hint and the strip's label read the downbeat's cost |
| B7 | The Novice cannot use Marcato in the Prelude (no Directives at First Light), so for her tier band it counts as the design's "option the bots can't use". | Accepted |

### Open

From the review-fixes digest ("Still open after this commit"):

- **A2, two goldens that pin little.** As reviewed at `2a9f68b`, before tuning: `novice-conducting-first-light` had the same hash with all three Novice draws skipped (1 Cue, no chain, no Directive), and `skilled-conducting-silent` made 2 Cues, no Duet or Trio and no stilled loss, and was won at 103.2 s of 220 s. They were re-recorded by tuning, not re-picked, and what they produce now has not been measured. To do: pick scenarios where each golden does its named thing, and assert in `conductingBots.test.ts` that it produces its named events.
- **B4, the harness labels** (above).
- **Rule copies in the bots.** In `src/bots/common.ts`, `soloFullIn` has a `?? 25` fallback and does not count Oro's Sapling charge; `chainOpen`, `marcatoReady` and `finaleFree` still copy the sim's rules (the sim now exports `openChain`, `marcatoReadyIn` and `finaleTurnBlock` for them). In `hudBridge.ts`, `cueBase` and the Finale's clock are still computed there, since no sim export gives them.
- **C2, name collisions (the owner's decision; default: leave).** The option **Ensemble** (+5% damage per different hero Cued) shares its name, its Cue trigger and the "5%" with the Astrolabe's great node `ensemble` ("When you Cue a Solo, the other heroes' Solos charge 5%"); their ids collide too, though they live in separate registries and no code clash was found. The option **Spotlight** shares its name and its Cue trigger with the Astrolabe's minor node "Spotlight" (`bond_b4`, Cued Solos last longer). The option **Maestro** shares its name with the Deed `maestro` ("Cue 25 Solos in one run"); the Summary shows the run's Deeds beside the Calling's path, and cheap Cues make that Deed likeliest on a Conductor run. The review recommends renaming the two options and the Deed (for example "Tutti" and "Limelight"). A rename touches content, the Deed, the Codex copy and the tests.

Also left, and noted under W3: the Duet and Trio in one batch (cosmetic), and the audio beat clock ignoring the dev time scale (dev only).

From the tuning hand-back (the full account is under *Tuning*):

- **Bands the tuning missed**, with their causes, are listed in the *Tuning* section: the Silent Conductor's length and the Cues a boss fight (the Grand Finale), the Triad path's shares at the short fights, and the A Tempo shares at the Silent Conductor (Skilled) and at Vharun and the Unweaver (Novice).
- **A Grand Finale cast during the Grand Silence loses every turn.** A stilled hero loses a Finale turn, so a Finale cast while the Grand Silence stills the party plays no Solo for its Resonance. Noted, not acted on.
- **Hero Autonomy fires Solos uncued.** With the assist on, a ready Solo fires itself 1 s after it fills, outside any chain, so a player using the assist gets few Duets and Trios unless they Cue within that second. Noted, not acted on.
- **The owner's choice between two economies.** The default taken is Cue 20 and gain 10, which favours the Novice's whole-Prelude band. The alternative is Cue 15 and gain 20, which favours the Triad path at the short fights but puts the Novice 7 and 4 points over her band. To revert, set `cue` to 15 and `gain` to 20; the 4 s window and the bot changes can stay.

## Tuning

W5 tuned the Conductor against *Bands*, in the levers' order, on cells 1000 and 500003 and whole Preludes 2000 and 900007. Cells 777001 and Preludes 333003 were read once, after the numbers and the goldens were final; nothing moved after them. Cells are `tools/callings.ts --cells --uses` (50 seeds a set) on each Movement's kit, at every boss fight before and in the Finale: the Bellwarden and the Hollow Cantor (I), the Gorehound Matriarch and Vharun (II), the Seamstress and the Unweaver (III), the Silent Conductor (IV). Whole Preludes are `tools/callings.ts`' report (16 paths × 50 seeds, Novice and Skilled), played through a scratch copy of its whole-run mode that takes a seed base (at base 2000 it reproduces the tool's report exactly); the three older Callings were played on the same seeds for the reference. The search used 20 seeds a cell; every reading below is 50. No band reads Finale-route Expeditions, so none were run.

### What moved

| Where | Number | Before | After | Lever | Why |
|---|---|---|---|---|---|
| `callings.ts`, the Conductor's `values` | `cue` | 15 | 20 | 3 | the Novice's whole Preludes (below) |
| | `gain` | 20 | 10 | 3 | the same |
| | `chain` | 3 s | 4 s | 2 | more Duets and Trios on the Triad path once Cues cost more |
| `skilled.ts` | `BEAT_AHEAD` | 0.6 s | 2.8 s | 5 | the bot gave most Cues off the beat (ablation below) |
| | `BANK_WITH_FINALE` (new) | (the bank held on his runs) | false | 5 | `bankCrescendo` cost his fights time and won nothing (ablation below) |

Nothing else moved: `duet` 25, `trio` 50, `ramp` 20, `gap` 1, `wait` 12, Maestro's 75, every path number, `MARCATO_FOCUS` ('standing') and the Novice's three chances are as W1 and W4 left them. `contentVersion` c-cc413f9ff5775748 → c-e05cbcf5f5775748; `SIM_VERSION` stays 22.

**Cue 15 is now Cue 20.** The e2e test reads the number from content (`Cue ${conductor.values.cue}`), so it still checks the right thing, but its title and one comment still say "Cue 15", and so do this doc's passive, decision 7 and its examples (ticks at 15, 30, 45…; the fade's 35 → 30). W5 owns neither; they want a word change by their owners.

### How the levers were tried

Each lever was first set alone, then in combination, at the edge of its range, on 20 seeds of each tuning set (cells) and 50 seeds a path (Preludes, Novice).

- **Lever 1** (`ramp` 10, `gap` 1.5, Maestro 90): with lever 3 moved, 8-24 s longer Maestro fights and more Cues and Trios with Maestro, but Maestro at 90 put the Novice's Maestro Finales at 0.05 (Bellwarden) and 0.20 (Gorehound), against 0.30 and 0.45 at 75, and the Silent Conductor's on-beat share at 54% against 80%. It brought no band in and pushed two out, so nothing stayed.
- **Lever 2**: `duet` and `trio` at 15/40 (and at 0, as a check) moved the Silent Conductor's length by under 2 s and no band's reading. `chain` 4 adds Duets and Trios on the Triad path once Cues cost 20, so it stayed.
- **Lever 3**: the only lever that moves the Novice's whole Preludes. Novice, base 2000, Guardian · Steady: as W1 left it (with the W5 bots) 56 · 60%; lever 1 at its edge 55 · 60; levers 1 and 2 at their edges 54 · 59; plus `gain` 10 53 · 59; plus `cue` 20 51 · 55; `cue` 20 and `gain` 10 alone 48 · 51. Every lever at its weakest edge together (lever 4's Upbeat 25, Spotlight ×1.5, Marcato 5% included) gave 47 on Guardian: no more than lever 3 alone.
- **Lever 4**: Upbeat 25, Spotlight ×1.5 and A Tempo's 0.10 or 0.20 changed no band (Upbeat 25 cost the Bellwarden's Maestro Trios). Nothing stayed.

What lever 3 costs is the Triad path's use of the Calling: with Cues at 20 and gains at 10 it chains less and casts fewer Finales at the shorter fights (rows below). This is the one real trade the bands force: as W1 left the numbers, those rows meet more often and the Novice's whole runs miss their band by 7 points (Guardian) and 4 (Steady).

### Bot changes (lever 5)

**`BEAT_AHEAD` 0.6 → 2.8 s.** `tools/verbs.ts --calling conductor --path 1111`, Skilled, 20 seeds, the six boss fights before the Finale, at W1's numbers. At 0.6 s the bot waited for the downbeat only when it was 0.6 s away, so 17-95% of its Cues were free (four fights under 50%). The harness plays without the autonomy assist, so a held Solo is never lost: waiting a whole bar costs only the wait.

| Fight | 0.6 s: on the beat · length · downs | 2.8 s |
|---|---|---|
| Bellwarden | 17% · 21 s · 0.00 | 98% · 23 s · 0.00 |
| Hollow Cantor | 37% · 78 s · 0.65 | 87% · 73 s · 0.20 |
| Gorehound Matriarch | 95% · 29 s · 0.00 | 98% · 29 s · 0.00 |
| Vharun | 38% · 93 s · 0.40 | 98% · 83 s · 0.35 |
| Seamstress | 33% · 21 s · 0.00 | 100% · 19 s · 0.00 |
| Unweaver | 48% · 88 s · 0.15 | 78% · 81 s · 0.20 |

Wins were the same. `conductHold`'s own wait is now covered by the beat's on A Tempo paths, so its test in `tests/bots/conductingBots.test.ts` plays the Triad path.

**`bankCrescendo` off on his runs.** The Finale's rule holds the Cues and the Crescendo so that a Crescendo is ready for Fortissimo Silence. With the Grand Finale coming round two or three times a fight, the hold only starved the Cues (2.0 Cues a fight with Maestro). Silent Conductor, Skilled, 50 seeds, `--rules bankCrescendo`, at W1's numbers:

| Set · path | every rule | without `bankCrescendo` |
|---|---|---|
| 1000 · Triad | 98% · 107 s · downs 0.10 · 9.6 Cues | 98% · 100 s · 0.06 · 10.5 |
| 1000 · Maestro | 100% · 81 s · 0.00 · 2.0 | 100% · 53 s · 0.00 · 4.6 |
| 500003 · Triad | 100% · 109 s · 0.12 · 9.8 | 100% · 99 s · 0.02 · 10.7 |
| 500003 · Maestro | 100% · 80 s · 0.04 · 2.1 | 100% · 53 s · 0.00 · 4.7 |

Without the Conductor `bank` is computed as before. The same ablation shows `conductFinale` is worth keeping (off: 16-39 s longer), and `crescendoCancel` changes nothing on his runs. This makes him faster at the Silent Conductor, not slower: it is what he is worth when played well.

**`MARCATO_FOCUS` stays 'standing'.** Re-measured on the final bot (Movement I, path 0000, Skilled, 50 seeds, `--rules conductMarcato`): 'kael' (the doc's rule) lost the Tolling Halls 100% → 86% (downs 0.02 → 1.16), the Shattered Choir 92% → 80% and the Hollow Cantor 98% → 86%; 'boss' lost the Hollow Cantor 98% → 86% and won the Bellwarden 92% → 96%. 'standing' loses nothing; it gives Marcato mostly through the bot's other Directives, and Focuses again only where the bot already Focuses (the Unweaver, the Silent Conductor).

The Novice's chances (0.4, 0.5, 0.15) are unchanged: no ablation showed her misplay; lowering them would only make her play the Calling less.

### The bands, on all three sets

Cells: sets 1000 / 500003 / 777001 (the last held out). Whole Preludes: sets 2000 / 900007 / 333003 (the last held out). The Novice's whole-run band is the lowest of the three older Callings − 3 to the highest + 3 in the same pass; the Skilled's is none to the highest + 2.

| Band | Reading | |
|---|---|---|
| Whole Preludes, Novice, Guardian | 47 (40-49) / 52 (43-50) / 50 (42-52) | missed on set 900007 (52 against 50); met on 2000 and 333003 |
| Whole Preludes, Novice, Steady | 52 (46-56) / 51 (46-54) / 51 (46-55) | met |
| Whole Preludes, Skilled, Guardian | 91 (86-98) / 89 (84-97) / 89 (83-96) | met |
| Whole Preludes, Skilled, Steady | 91 (88-97) / 91 (86-96) / 91 (85-96) | met |
| A tier's two options, Novice, Guardian (≤ 8 apart) | widest 4 / 7 / 10 (tier I); the other tiers at most 7 apart on every set | met, with Marcato named as the option she can't use: her Directives come only from rings and later Movements' mechanics (Marcato 45 / 49 / 45% against A Tempo 49 / 56 / 55%) |
| The Unweaver, Skilled, both setups (≥ 75%) | 98 · 100 / 100 · 100 / 96 · 100 | met |
| The Silent Conductor, Skilled: win (≥ 75%) | 98 · 100 / 100 · 100 / 100 · 100 | met |
| The Silent Conductor, Skilled: length (none − 25 s to + 40 s) | Triad −67 / −64 / −66 s; Maestro −121 / −122 / −123 s | missed: the Grand Finale (below) |
| Cues a boss fight, Skilled (≥ 1.3 × none) | 0.36-1.19 / 0.36-1.27 / 0.36-1.13 × | missed in every row: the Grand Finale |
| Duets and Trios as a share of Cues, Skilled (≥ 40%) | Maestro 57-67% everywhere; Triad met at the Seamstress, the Unweaver and the Silent Conductor | missed with Triad at the Bellwarden (28-30%), the Hollow Cantor (33%), the Gorehound (36-38%); Vharun 41 / 37 / 38% |
| Trios a boss fight, Skilled (≥ 0.5) | Maestro 0.54-2.22 everywhere; Triad met at five fights | missed with Triad at the Bellwarden (0.00-0.04) and the Gorehound (0.18-0.22) |
| Grand Finales a boss fight, Skilled (≥ 0.6) | met at every fight with Maestro, and at five with Triad | missed with Triad at the Bellwarden (0.16-0.30) and the Hollow Cantor (0.32-0.42) |
| Grand Finales a boss fight, Novice (≥ 0.2) | met at every fight with Maestro (the Bellwarden 0.28 / 0.26 / 0.20); with Triad at the Seamstress and the Silent Conductor | missed with Triad at the Bellwarden, the Hollow Cantor, the Gorehound, Vharun and the Unweaver (0.00-0.16) |
| A Tempo on the beat, Skilled (≥ 60%) | 70-99% at six fights | missed at the Silent Conductor (58-59%) |
| A Tempo on the beat, Novice (15-45%) | 28-42% at four fights | missed at Vharun (53-55%) and the Unweaver (52-53%); the Seamstress 45 / 51 / 48% |
| Novice ≤ Skilled | every cell row and every whole-run row, all three sets | met |
| Every existing row in the same reports | the older Callings' and none's cell rows equal W4's (set 1000, where W4 measured them); the 10-seed whole-run reports of the Luminary, the Martyr and the Chronomancer on both loadouts equal the pre-W1 ones | met |

The causes:

- **Length and Cues: the Grand Finale.** Shown under *For the owner*. The bot's Finale rule is right to spend there: left off (`conductFinale`), fights are 16-39 s longer with the same wins.
- **The Triad path's rows at the short fights** (the Bellwarden 55-60 s, the Gorehound about 60 s, the Hollow Cantor): lever 3's price. With Cues at 20 and gains at 10 the Triad path, whose Finale costs 100, reaches it less and chains less. As W1 left the numbers (with the W5 bots) the Hollow Cantor, the Gorehound and Vharun met them (shares 42-45%, Trios 0.55-1.68, Finales 0.82-2.02, 20 seeds a set), and the Bellwarden missed them all as now (32%, 0.03, 0.47): each hero's Solo fills once or twice there and 100 Resonance is seldom reached. No lever setting tried brought the Bellwarden's Triad rows in.
- **The Novice's Triad Finales**: the same, and at W1's numbers she missed at the Bellwarden and the Gorehound too (0.00).
- **The Silent Conductor's beat share**: the Finale's `reigniteCue` burn (not a Conductor rule) sends every ready Solo at once after Reignite. A Tempo's window at 0.20 left it at 58%.
- **The Novice's beat share at Vharun and the Unweaver**: with Cues at 20 she affords fewer Cues off the beat, so her free on-beat draws are a larger share (36-44% at W1's numbers). A window of 0.10 (with lever 1's `ramp` and `gap` at their edges, 20 seeds a set) left both at 50%.
- **The Novice's whole Preludes on Guardian, set 900007** (52 against 50): lever 3 is at both edges, and no other lever moves her by more than a point.

The Skilled bot's cells (wins %, length against none in s, Cues × none's, Duets and Trios %, Trios, Finales, on the beat %; each 1000 / 500003 / 777001):

| Fight | Path | Win | Length | Cues | Duets and Trios | Trios | Finales | On the beat |
|---|---|---|---|---|---|---|---|---|
| Bellwarden | Triad | 92 / 96 / 96 | +4 / −3 / −5 | 1.07 / 1.02 / 1.00 | 28 / 30 / 29 | 0.00 / 0.04 / 0.00 | 0.16 / 0.26 / 0.30 | – |
| Bellwarden | Maestro | 100 / 100 / 100 | −34 / −34 / −38 | 0.47 / 0.45 / 0.51 | 61 / 61 / 62 | 0.58 / 0.54 / 0.64 | 1.00 / 1.00 / 1.00 | 94 / 93 / 89 |
| Hollow Cantor | Triad | 100 / 94 / 90 | −37 / −38 / −37 | 1.19 / 1.27 / 1.13 | 33 / 33 / 33 | 0.54 / 0.50 / 0.68 | 0.42 / 0.36 / 0.32 | – |
| Hollow Cantor | Maestro | 98 / 96 / 96 | −79 / −81 / −80 | 0.55 / 0.50 / 0.55 | 64 / 63 / 64 | 1.38 / 1.20 / 1.34 | 1.92 / 1.94 / 1.92 | 86 / 90 / 88 |
| Gorehound Matriarch | Triad | 100 / 100 / 100 | −13 / −15 / −14 | 0.78 / 0.79 / 0.77 | 38 / 36 / 37 | 0.22 / 0.18 / 0.18 | 0.82 / 0.84 / 0.82 | – |
| Gorehound Matriarch | Maestro | 100 / 100 / 100 | −39 / −39 / −38 | 0.44 / 0.45 / 0.43 | 66 / 67 / 67 | 0.98 / 1.00 / 1.00 | 1.02 / 1.04 / 1.08 | 70 / 73 / 73 |
| Vharun | Triad | 98 / 94 / 96 | −39 / −37 / −47 | 0.95 / 0.95 / 0.96 | 41 / 37 / 38 | 1.30 / 0.76 / 0.94 | 1.52 / 1.26 / 1.24 | – |
| Vharun | Maestro | 100 / 98 / 98 | −108 / −110 / −111 | 0.47 / 0.45 / 0.48 | 64 / 64 / 65 | 2.22 / 2.08 / 2.20 | 3.06 / 2.98 / 3.06 | 94 / 94 / 92 |
| Seamstress | Triad | 100 / 100 / 100 | −33 / −36 / −31 | 0.75 / 0.75 / 0.78 | 49 / 47 / 47 | 0.76 / 0.72 / 0.72 | 1.32 / 1.22 / 1.26 | – |
| Seamstress | Maestro | 100 / 100 / 100 | −62 / −63 / −61 | 0.41 / 0.43 / 0.43 | 65 / 65 / 65 | 0.92 / 0.94 / 0.94 | 1.84 / 1.84 / 1.86 | 98 / 97 / 99 |
| Unweaver | Triad | 98 / 100 / 96 | −64 / −57 / −54 | 0.82 / 0.85 / 0.82 | 43 / 41 / 42 | 1.52 / 1.48 / 1.50 | 1.94 / 1.74 / 2.06 | – |
| Unweaver | Maestro | 100 / 100 / 100 | −134 / −128 / −131 | 0.37 / 0.41 / 0.38 | 65 / 65 / 65 | 1.92 / 2.04 / 1.92 | 3.00 / 3.00 / 3.02 | 97 / 97 / 97 |
| Silent Conductor | Triad | 98 / 100 / 100 | −67 / −64 / −66 | 0.86 / 0.89 / 0.89 | 51 / 50 / 51 | 2.12 / 2.04 / 2.14 | 1.32 / 1.38 / 1.32 | – |
| Silent Conductor | Maestro | 100 / 100 / 100 | −121 / −122 / −123 | 0.36 / 0.36 / 0.36 | 57 / 57 / 57 | 1.00 / 1.00 / 1.00 | 3.00 / 3.00 / 3.00 | 59 / 58 / 59 |

None, Skilled (length s · Cues a fight, 1000 / 500003 / 777001): Bellwarden 59 · 4.0 / 58 · 4.0 / 62 · 4.1; Hollow Cantor 157 · 8.3 / 159 · 7.8 / 157 · 8.4; Gorehound Matriarch 73 · 6.8 / 74 · 6.6 / 73 · 7.0; Vharun 195 · 15.4 / 197 · 15.2 / 199 · 14.7; Seamstress 81 · 6.8 / 83 · 6.7 / 80 · 6.7; Unweaver 192 · 15.9 / 187 · 15.6 / 189 · 15.9; Silent Conductor 174 · 12.8 / 175 · 12.9 / 176 · 12.7.

The Novice's cells, for the Finale and beat bands (Finales, on the beat %):

| Fight | Path | Win | Finales | On the beat |
|---|---|---|---|---|
| Bellwarden | Triad | 82 / 76 / 82 | 0.00 / 0.00 / 0.00 | – |
| Bellwarden | Maestro | 98 / 98 / 96 | 0.28 / 0.26 / 0.20 | 32 / 31 / 28 |
| Hollow Cantor | Triad | 68 / 54 / 66 | 0.08 / 0.06 / 0.14 | – |
| Hollow Cantor | Maestro | 80 / 82 / 74 | 0.48 / 0.62 / 0.54 | 38 / 36 / 42 |
| Gorehound Matriarch | Triad | 76 / 90 / 86 | 0.00 / 0.00 / 0.00 | – |
| Gorehound Matriarch | Maestro | 96 / 98 / 98 | 0.50 / 0.60 / 0.54 | 31 / 41 / 40 |
| Vharun | Triad | 74 / 80 / 66 | 0.02 / 0.06 / 0.14 | – |
| Vharun | Maestro | 66 / 82 / 86 | 1.02 / 1.00 / 1.10 | 55 / 54 / 53 |
| Seamstress | Triad | 74 / 78 / 78 | 0.32 / 0.20 / 0.28 | – |
| Seamstress | Maestro | 100 / 96 / 98 | 1.04 / 1.06 / 1.12 | 45 / 51 / 48 |
| Unweaver | Triad | 82 / 76 / 86 | 0.06 / 0.02 / 0.06 | – |
| Unweaver | Maestro | 92 / 90 / 88 | 1.22 / 1.14 / 1.36 | 53 / 53 / 52 |
| Silent Conductor | Triad | 56 / 62 / 64 | 0.86 / 0.82 / 0.82 | – |
| Silent Conductor | Maestro | 96 / 96 / 90 | 1.62 / 1.76 / 1.64 | 30 / 29 / 33 |

### Chorus pulses (measurement only)

No chorus or aura number changed. One pulse per Cue, as before. Skilled, 30 fights at base 1000, on a three-aura chord (fortissimo and ostinato, then sostenuto) with an arrival kit's motifs and relics (Movement II's for the Bellwarden and the Hollow Cantor, as W4 measured them); the shipped presets have no three-aura chord, so the cells read 0 pulses.

| Fight | none | Triad path | Maestro path |
|---|---|---|---|
| Bellwarden | 0.67 | 2.73 | 0.30 |
| Hollow Cantor | 0.87 | 4.17 | 5.90 |
| Unweaver | 8.70 | 13.23 | 7.17 |
| Silent Conductor | 3.97 | 9.67 | 6.30 |

### For the owner

- **The Grand Finale is the cause of every length and Cue miss.** With every Conductor number set to nothing (no Duet or Trio power, no ramp, Cues at 25, no gain, no path effect, Maestro at 100 and one pass; W4's bot) the Silent Conductor still ends 38-43 s sooner than with no Calling: three Cued Solos and a full recharge for 100 Resonance, which the bot rightly prefers to five Cues. Inside the levers' ranges the fight stays 59-122 s shorter than none, against a band of −25 s. Only the Finale's full recharge, or its number of turns, could close it; both are outside W5's levers.
- **The Novice's band and the Triad path's use pull apart.** Cues at 20 and gains at 10 bring her whole Preludes in on five of six readings (and within 2 points on the sixth); Cues at 15 and gains at 20 meet more of the Triad path's cell rows but put her 7-10 points above the other Callings. The choice of which to keep is yours.
- **A Grand Finale cast during the Grand Silence loses every turn.** A stilled hero loses a Finale turn, so a Finale cast while the Grand Silence stills the party plays no Solo for its Resonance. The Skilled bot casts only with two heroes free, but a player can. Noted, not acted on.
- **Hero Autonomy fires Solos uncued.** With the assist on (the harness plays without it), a ready Solo fires itself 1 s after it fills, outside any chain: a player using the assist gets few Duets and Trios unless they Cue within that second. Noted, not acted on.

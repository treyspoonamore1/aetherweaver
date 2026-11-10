# Phase 5g: every content category at its 1.0 count

*2026-11-09 · design and contracts · main at eddab8c (Phase 5f W1), with 5f's W2-W4 in flight · plan: [06 Phase 5](plan/06-roadmap.md) (line 117: "Bring every content category up to its 1.0 count"; exit, lines 121-125), [03 §12](plan/03-content-bible.md#12-content-targets-per-phase) (the targets, lines 485-496), [03 §3-§10](plan/03-content-bible.md) (the catalogue and its tone), [02 §8, §11, §12](plan/02-game-design.md) (the run, the build archetypes, the power-math rules) · follows [Phase 5e](phase-5e.md) (Seren and Oro) and [Phase 5f](phase-5f.md) (the Conductor)*

This slice fills the draft pools, the relic pools and the event pools to the 1.0 counts, and groups what it adds around six builds so that at least five of them are viable at Dissonance 0. Heroes, Callings, enemies, affixes, mini-bosses, bosses and technique variants are already at their counts. Auras and ornaments are short, and the owner has asked to be consulted before any aura changes, so they have a workstream of their own that waits for approval and that nothing else depends on.

This doc is the spec. Implementers build from it and their brief, nothing else. Every number below is a starting value that the tuning workstream (W11) moves inside the levers listed under *Bands*.

**Terms used throughout.**

- A **pin** is a committed file or literal that a test or a tool's `--check` compares against, byte for byte.
- A **golden** is one of the pinned sim scenarios in `tests/sim/golden.json`, whose final hashes are also written as literals in `tests/sim/m1Unchanged.test.ts`.
- A **cell** is a single fight played in isolation with a fixed kit of motifs and relics (`tools/kits.ts`). Cells never draft, so new pool content can't reach them.
- A **seeded run** is a whole run played from a seed through the map, drafts, shops and events (`playRun`, `tools/harness-core.ts:1884`). It draws from the pools, so new pool content changes it.
- The **Prelude** is the one-Movement teaching run; an **Expedition** is the full run (today the Finale route).
- **Go-live** is the single merge that puts this slice's pool content into `CONTENT` and re-records the seeded-run pins (ground rules 2 and 5).
- A **trigger** is a new, data-driven sim rule of the form "when this event happens, do that" (ground rule 3; *Shared sim support*).

## Decisions for you

Each item has the default this doc is built on. Each can be answered without reading further.

1. **The aura workstream (W7) needs your approval before it is built.** To reach 10 auras and 10 ornaments it would add four auras (Requiem, Staccato, Cantabile, Rubato) and six ornaments (Sforzando, Descant, Echo, Counterpoint, Martyr's Tithe, Syncopation), plus six aura-specific motifs, one Harmony and one relic that depend on them (all listed under *W7*). It edits `src/content/auras.ts`, `src/sim/combat/auras.ts` and `src/sim/systems/field.ts`. Counterpoint also needs an inverted form written for each of the six existing auras, which adds to their definitions without changing their numbers. Nothing else in this slice depends on W7. **Default: not built until you say so. If you approve, it is built after go-live, item by item as you approve them; if you approve none, the slice ships 6 auras and 4 ornaments and records the gap as accepted.**

2. **Where the aura line sits for everything else.** A motif or relic counts as an aura change if it changes any aura's strength, reach, reservation or who it reaches (as Warm Hum or Second Verse do today). One that only reads whether a hero or enemy stands in your field, or which auras you carry, does not (as the Conductor's Triad reads `hero.inField`, docs/phase-5f.md:141). Under this line, five new Choir motifs (Massed Voices, Close Harmony, Breath Between, Full Chord, Long Phrase) and two Harmonies that need Fortissimo or Lullaby slotted (Cutting Chorus, Spindle Lullaby) sit outside W7. **Default: this line. If you would rather treat any field-reading motif as an aura change too, those seven move into W7 and the motif count without W7 falls to 79 + 9.**

3. **How many motifs.** The plan asks for about 90 motifs and 12 Harmonies; the game has 31 and 1. This doc adds 53 motifs and 10 Harmonies outside W7 (84 + 11), and W7 adds 6 + 1 (90 + 12). A winning Finale-route run drafts 15 times and ends holding about 12 motifs (`tools/expedition4-baseline.json`), so a pool of 84 still lets runs differ. **Default: the full fill. The alternative is a smaller pool (about 60 + 6, the first half of each category's table) and a second slice after playtests.**

4. **The Prelude keeps today's pools.** New motifs, relics and boons are offered only on Expeditions; new events live only in Movements II and III, which the Prelude never visits. The Prelude stays the short, settled teaching run, and every Prelude pin and every Prelude-based report (the Calling, Astrolabe, Reliquary, power-cap, Bond, variant and Dissonance reports) stays byte-identical. **Default: Expedition-only. The alternative puts everything in the Prelude too, which moves those pins and reports and adds 59 motifs to the run a new player learns on.**

5. **Seeded-run pins move once, on purpose, and the phase proves nothing else did.** New pool content changes every Expedition's drafts, shops, relic offers and Movement II-III maps, so the Expedition pins can't stay byte-identical. **Default: they are re-recorded at go-live and again at the end of tuning, by one owner, and a "masked replay" test proves that with this slice's entries removed from `CONTENT`, every old pin comes out byte-identical (ground rule 5).** Cells, goldens, command snapshots and every Prelude pin must not move at all. The alternative is a pool-version flag on each run that keeps old runs on the old pools; it keeps the old pins but adds a field to every run save and leaves the pins testing a pool the game no longer plays.

6. **New sim support.** Most entries use an existing modifier or the new trigger system. About thirty need a small new hook, listed under *Shared sim support*. Four are larger: **Razor Silk** (enemies touching the Thread take damage; Constellation Lines, Cutting Chorus and Spindle Lullaby ride on the same test), **Thread the Needle** (moving the Thread onto a hero just before a telegraph lands negates part of it), **Water Clock** (a legendary relic that turns time back for a hero who goes down, reusing the Chronomancer's Rewind history) and **Everbell** (a second Chime charge). **Default: build all four. If any is cut, its row in the tables names the replacement.** The plan's *Twin Spindle* (a second Thread) is out of scope: it would rework the Thread, the HUD, the ledger and both bots.

7. **What "five viable builds" means.** Phase 5d defined it as at least 5 of the 6 Chord presets winning at least 50% of Skilled whole Finale-route Expeditions on all three seed sets, plus the Silent Conductor cell at 80% (docs/phase-5d.md:788). Today that holds at exactly 5 of 6, at the edge (docs/phase-5d.md:1205). This slice is about builds, so it adds an archetype report: six named builds (Calling, party, Chords and the motifs they draft first), each of which should win at least 50% of whole Finale-route Expeditions. **Default: the exit needs both, at least 5 of 6 presets and at least 5 of 6 archetypes, on all three sets.**

8. **Unlock Ranks.** No motif, relic, boon or event is locked today; the unlock schedule locks only songs, auras, ornaments, Callings, the Reliquary, Dissonance and recruits (`src/meta/profile.ts:279`). **Default: the new motifs, relics and events are open from the first Expedition (Rank 2), like today's. Only W7's auras and ornaments get Ranks** (W7 lists them; Ranks 11, 13, 14, 16, 17 and 18 are empty today).

9. **Plan names already taken.** About twenty of the content bible's example names are in the game with a different effect or different numbers (*Audit*, last table). **Default: the game keeps its names and numbers; where this doc adds the bible's effect, it gets a new name** (for example, the bible's *Twin Aegis* effect becomes **Sister Ward**, because the game's Twin Aegis is "Ward holds 2 charges").

10. **Two bible events, simplified.** *Hero's Doubt* gives Bond XP in the plan; there is no event effect for Bond XP, so here it gives a heal and a two-fight damage boon instead. *Lost Weaver's Echo* fights a ghost Weaver who uses your build; that needs a new enemy AI, so here it is a fight against the Mirror Hall (Movement III's Mimic skirmish) that pays relics. **Default: the simplified versions. The plan's versions would need a `bondXp` event effect and a ghost-Weaver enemy, and move to a later slice.**

11. **New events make the recruit events rarer.** Movements II and III have one event node each, so a run meets one of that Movement's events. Today Movement II has two (the Tithe Altar, where Seren is recruited, and the Bloodsworn's Cell, Brann's) and Movement III two (the Loose Thread, Oro's, and the Mirror Pool). With three new events in each, each existing event comes up in about one run in five instead of one in two. Every recruit keeps its boss fallback, which every road visits (Brann: Vharun; Seren: the Gorehound Matriarch; Oro: the Seamstress; `src/content/heroes.ts:394-401, 508-515, 639-647`), so no hero becomes harder to unlock, only the event route to them less common. **Default: accept it. The alternative, a run-layer rule that deals a recruit event first while its hero isn't recruited, changes the map rules and is a separate change.**

12. **When a band can't be met.** Several whole-run bands sat at their edge when 5d and 5e closed (the Novice's won-of-reached 39.1% against a 40% ceiling, docs/phase-5d.md:1200; the pacing average 39.6 and 39.4 minutes against 40, :1202; the presets at exactly 5 of 6). New content will move them. **Default: only this slice's own numbers are levers (*Bands*). A band that can't be met that way is reported with its cause for your decision, never fixed by changing an existing number.**

## Audit: what the game has, against the 1.0 targets

Counted from `CONTENT` (`src/content/index.ts:74-132`) by a scratch script, not from the docs. "Target" is 03 §12 (`docs/plan/03-content-bible.md:485-496`).

| Category | Have | Target | Gap | Where it lives |
|---|---|---|---|---|
| Technique variants | 12: 4 defaults + 8 variants (Chorale, Aegis Link, Purge, Absolve, Swap, Anchor, Phase Step, Skate) | 12 | **none** | `src/content/variants.ts:7`; content lint requires exactly two variants per slot (`src/content/schema.ts:2554-2556`) |
| Callings | 4 (Luminary, Martyr, Chronomancer, Conductor) | 4 | **none** | `src/content/callings.ts:8` |
| Auras | 6 (Sostenuto, Ostinato, Allegro, Fortissimo, Lullaby, Fermata) | 10 | 4 | `src/content/auras.ts:4-62` |
| Ornaments | 4 (Grace Note, Reverb, Unison, Pedal Point) | 10 | 6 | `src/content/ornaments.ts:8-53` |
| Heroes | 6 (Kael, Lyra, Vexis, Brann, Seren, Oro) | 6 | **none** | `src/content/heroes.ts:11` |
| Enemies | 16 ordinary (6 in Movement I, 5 in II, 5 in III), plus 7 boss adds (Spindle, Stolen Verse, Hollow Champion, four Mirror voices) | 16 | **none** | `enemies.ts:245`, `legion.ts:312`, `unstitched.ts:639`, `crucible.ts:553` |
| Elite affixes | 8 (Shielded, Volatile, Hastened, Vampiric, Severing, Silencing, Mimicking, Doom-touched) | 8 | **none** | `enemies.ts:396`, `legion.ts:452`, `unstitched.ts:814` |
| Mini-bosses | 3 (Bellwarden, Gorehound Matriarch, Seamstress) | 3 | **none** | as enemies |
| Bosses | 4 (Hollow Cantor, Vharun, Unweaver, Silent Conductor) | 4 | **none** | as enemies |
| Motifs | 31 (Silk 6, Aegis 7, Choir 7, Bond 6, Finale 5) | about 90 | about 59 | `src/content/motifs.ts:7-317` |
| Harmonies | 1 (Blood and Silk) | 12 | 11 | the same list, `requires.motifs` (`motifs.ts:275-284`) |
| Relics | 21 (5 common, 9 rare, 5 legendary, 2 cursed) | about 40 | about 19 | `src/content/relics.ts:8-229` |
| Events | 10 (Movement I 6, II 2, III 2) | about 16 | about 6 | `runEvents.ts:7`, `legionRun.ts:426`, `unstitchedRun.ts:288` |
| Boons and banes | 3 (The Last Note, Frayed Spirit, Mended Loom) | none set | — | `relics.ts:231-259` |
| Dissonance levels | 12 | 15 | 3 | Phase 6, not this slice (`src/content/dissonance.ts:8`) |

Relics by rarity: common 5 (Silver Thimble, Lantern of the Lost, Featherweight Robes, Warden's Key, Tuning Fork); rare 9 (Choirmaster's Baton, Hollow Bell, Martyr's Veil, Cantor's Hymnal, Star Chart, Movement III's Sacrificial Lamb and Knotted Cord, the Finale's Tacet Mark and Quick Rosin); legendary 5 (Prism Loom, Cracked Metronome, Spindle of Fate, Movement III's Stillwater Bell, the Finale's First Score); cursed 2 (Heavy Score, Glass Halo). Six of them are Movement-gated (`relics.ts:173-226`).

**At or over target.** Technique variants, Callings, heroes, enemies, affixes, mini-bosses and bosses are all exactly at target. Variants can't grow: the lint requires two a slot.

**Facts the fill has to respect.**

- **Every motif and relic is a bespoke case** in the sim's resolver (`src/sim/mods.ts:469-608`, relics `:864-943`), which sets one or two fields of `Mods`, and the sim reads each field in one or two places. So "expressible with what the sim already has" means "a new case that sets an existing `Mods` field", and the field's readers decide what it does. The motif cases assign with `=` (for example `m.perfectWindowBonus = v`, `mods.ts:499`); a new motif sharing a field would be overwritten by an older one resolved after it. W0 converts these to accumulate (ground rule 4).
- **Drafts pick by index within a rarity** (`candidates[rng.int(candidates.length)]`, `src/meta/run.ts:2084`), and shops and relic offers the same way (`run.ts:1693, 1736`). Any new entry in a pool changes what every later draw picks. Pools are filtered (by aura, hero, Movement) before any draw (`run.ts:2030-2045`, `1652-1660`), which is how 5b, 5c and 5e kept old runs unchanged; this slice can't, because its entries are for everyone (decision 5).
- **Events are shuffled per Movement** from that Movement's own list (`run.ts:546-549`) and dealt one per event node (`:589-590`). Generated maps have 3 event nodes in Movement I and **1** each in Movements II and III; on the Finale route Movement I's shorter road has **none**. So Movement I's events are seen only in the Prelude (and old I-II and I-III saves). New events therefore go to Movements II and III, and they add variety between runs rather than within one, at the cost of each existing Movement II and III event coming up less often (decision 11). Rows and roads are never-moved numbers, so no event node is added.
- **The harness drafts the first option, takes the first relic, and picks the first event choice it can afford without choosing a motif** (`tools/harness-core.ts:2015-2016, 2030-2031, 1834-1848`). The order of an event's choices therefore decides what the harness does with it.
- **The "more"-source lint doesn't exist.** `src/content/effects.ts:48-50` says content lint caps "more" sources at 4 a stat (02 §12 rule 1); nothing does (phase 5f found the same, docs/phase-5f.md:163). Ground rule 8 adds a hand-kept registry test.
- **The word `window` is banned** in sim and content code, strings included (`tests/architecture.test.ts:60`). New texts say "within 0.35 s", never "window".
- **Barrier kinds matter.** `addShield` replaces a shield of the same kind (`src/sim/combat/health.ts:228-230`). Ostinato's aura barrier is kind `barrier` (`src/sim/systems/field.ts:406`); every motif and relic barrier today is `overshield` (`thread.ts:106, 231`; `health.ts:188, 1469`). New barriers are `overshield` too, so they never displace Ostinato's (that would change an aura). Like Taut Release's today, a new overshield replaces an older overshield, including a chorus pulse's (`techniques.ts:1032`); that existing behaviour is unchanged and reported, not an aura change.

**Bible examples that exist under another name, or a bible name the game uses for something else.**

| Plan (03) | In the game |
|---|---|
| Aegis *Second Verse*: Ward gains a second charge | **Twin Aegis** (`motifs.ts:91-99`). The game's *Second Verse* is "your aura field reaches farther" (`:119-126`) |
| Aegis *Twin Aegis*: Ward also covers the nearest other hero | not in the game; added here as **Sister Ward** |
| Relic *Tuning Fork*: Perfect +0.10 s | **Tacet Mark** (Finale relic, `relics.ts:198-207`). The game's *Tuning Fork* charges the hero's Solo (`:50-59`) |
| Choir *Deep Roots* (Sostenuto regen doubled below 50%) | the game's *Deep Roots* is "Ward's barrier is larger" (`motifs.ts:55-63`); *Warm Hum* strengthens Sostenuto (`:137-146`); Oro's bible talent *Deep Roots* is **Taproot** |
| Choir *Iron Refrain* (Ostinato) | close to **Glass Choir** (Ostinato refills sooner, `motifs.ts:147-156`); the plan's version is in W7 |
| Vexis *Quickened Verse* (casts faster in the field) | **Starlit Study** (Starbolt faster, `motifs.ts:208-216`); the game's *Quickened Verse* is Solos charging faster (`:228-236`). The bible's effect is added here as **Inner Orbit** |
| Finale *Encore*, *Standing Ovation*, *Da Capo* | the game's are a flat longer Crescendo, more Resonance, and 25 Resonance kept (`motifs.ts:219-263`). The bible's effects are added here as **Ringing On**, **Taking Bows** and **Opening Bars** |
| Silk *Relay Weave* (Thread continues to a second hero) | the game's *Relay Weave* heals on retarget (`motifs.ts:9-17`); the spread is the **Prism Loom** relic (`relics.ts:111-120`) |
| Kael *Bulwark's Echo* (taunt when Warded) | the game's is a barrier when Aegis Wall ends (`motifs.ts:188-197`); the taunt idea is added here as **Iron Answer** (Challenge comes sooner) |
| Relics *Choirmaster's Baton*, *Spindle of Fate*, *Prism Loom*, *Lantern of the Lost*, *Featherweight Robes*, *Cantor's Hymnal*, *Glass Halo* | all in the game with different rules or numbers (`relics.ts:21-161`) |
| Silk *Golden Filament* (Empower also grants attack speed), *Lifeline*, Aegis *Lingering Aegis*, Choir *Hammerfall*, Lyra *Wind at Her Back* | in the game with other effects or numbers (`motifs.ts:28-53, 64-72, 167-176, 198-207`). The bible's *Golden Filament* effect is added here as **Quickening Thread** |
| Harmony *Perfect Pitch* | a Deed has that name (`deeds.ts:95`); the Harmony is added here as **Concert Pitch** |
| Harmony *Starthread Symphony* | overlaps Vexis's Bond talent *Starthread*; not added |
| Events *Wounded Cantor*, *Shrine of Discord*, *Tuning Pool*, *Merchant of Silences*, *Unsung Choir*, *Broken Loom* | all six in the game, with changed choices (`runEvents.ts:7-174`); *Hero's Doubt* and *Lost Weaver's Echo* are added here (decision 10) |
| Elite affixes, enemies | the same names as the plan; the boss add `mirror_champion` is named Hollow Champion |

## The six builds

The fill is grouped so each new entry strengthens at least one build. These are the plan's archetypes (02 §11, `docs/plan/02-game-design.md:255-266`), reduced to what exists after this slice without W7. Each is also a harness definition (W10, `tools/builds.ts`): a Calling and path, a party, Chords, and the motifs its drafts take first. The Chords are existing presets (`src/meta/run.ts:109-185`), so no Prep or preset changes.

| Code | Build | How it plays | Calling and path (harness) | Party | Chords | Drafts first |
|---|---|---|---|---|---|---|
| **CS** | Choir Sovereign | hold the party in a planted field and let the songs carry them; few active saves | Luminary: Wide Choir, Dawnward, Third Voice, Sovereign Symphony | Kael, Lyra, Vexis | Anchor (Lullaby + Sostenuto planted; Third Voice fills a third) | Massed Voices, Close Harmony, Full Chord, Breath Between, Long Phrase, Stray Stitch, Closed Circle |
| **PP** | Perfect Pitch | every well-timed Ward detonates, refunds and rings | Chronomancer: Foresight, Echo Ward, Temporal Mastery, Eternal Moment | Kael, Lyra, Vexis | Bastion | Steady Hands, Thread the Needle, Riposte Bloom, Tender Guard, Clean Strike, Ringing Steel, Shatterglass, Concert Pitch |
| **BS** | Bleeding Saint | soak at low Life and turn your wounds into their healing | Martyr: Penitence, Blood Font, Undying Devotion, Sanguine Covenant | Kael, Lyra, Vexis | Guardian | Kindred Wound, Last Bastion, Vigil Song, Saving Grace, Breath Between, Wounded Healer |
| **RL** | Razor Loom | the Thread as a weapon: string it through packs, snap it on purpose | none | Kael, Lyra, Vexis | All In | Razor Silk, Whiplash, Slack Line, Quickening Thread, Gilded Wake, Constellation Lines, Cutting Chorus |
| **MA** | Maestro | Cue after Cue, Solos every few seconds | Conductor: A Tempo, Reprise, Ensemble, Maestro | Kael, Lyra, Vexis | Steady | Call and Response, Opening Bars, Answering Phrase, Footlights, Tenuto, Tuning Up, Tempo Rubato, Grand Staff |
| **RD** | Red Line | keep Brann in the red behind barriers while Seren parries off your Wards | none | Kael, Brann, Seren (party R) | Wide Choir (Ostinato + Fermata field) | Blood Tithe, Edge of the Red, Bloodsong, Second Intention, Cold Steel, Shieldsong, Bright Peal, Crossed Steel |

"Viable" is a band under *Bands*. Five of six are needed.

## The fill

Each table gives the id, the player-facing text with its numbers (motif values per level, L1 / L2 / L3, shown as {v} in content), what makes it distinct from what exists, the sim support it needs, and the builds it strengthens. In the **Sim** column:

- **Existing `field`** means a new case in the resolver setting that existing `Mods` field; the sim already reads it.
- **Trigger: on X → Y** means a rule for the trigger system (*Shared sim support*), built by W0.
- **New N#** means a small new hook, numbered in *Shared sim support*.

Every new motif carries `requires: { expedition: true }` (decision 4); a hero-gated one also names its hero, a Harmony its prerequisites. Tags follow today's set (`thread`, `heal`, `shield`, `damage`, `ward`, `perfect`, `chime`, `reel`, `aura`, `spirit`, `control`, `solo`, `cue`, `resonance`, `crescendo`, `harmony`) plus `razor`, `field` and `lowlife`.

### Silk: the Thread (12 new; 6 → 18)

| Motif (id) | Rarity | Text (L1 / L2 / L3) | Distinct from | Sim | Builds |
|---|---|---|---|---|---|
| Razor Silk (`razor_silk`) | rare | Enemies touching your Thread take {v} damage a second. (30 / 50 / 70) | the first Weaver damage that depends on where the Thread runs; Guard Strand only stops bolts | New N1 | RL |
| Whiplash (`whiplash`) | common | When the Thread snaps, enemies within 3 m of the hero it leaves take {v} damage. (120 / 180 / 240) | Taut Release turns a snap into a barrier; this turns it into an attack | Trigger: on `threadSnapped` → damage around its target | RL |
| Slack Line (`slack_line`) | common | When the Thread snaps at range, it reattaches {v}% sooner. (30 / 45 / 60) | Knotted Cord shortens enemy cuts only (`relics.ts:176-184`); this is the range snap | New N2 | RL |
| Gilded Wake (`gilded_wake`) | common | Empower stays on a hero for {v} s after the Thread leaves them. (1 / 1.5 / 2) | the Astrolabe's Afterglow does this for a single node; with both, the longer applies | Existing `empowerLinger` (the larger of the two) | RL, MA |
| Quickening Thread (`quickening_thread`) | common | Empower's attack speed is {v}% greater. (50 / 75 / 100) | Golden Filament raises Empower's damage, not its speed | New N3 | RL, MA |
| Brimming Thread (`brimming_thread`) | rare | Mend's overhealing becomes a barrier of up to {v}% of the hero's life, for 4 s. (8 / 12 / 16) | the Overflowing Grace keystone's effect without its Ward penalty, and smaller; with both, the keystone's cap applies | Existing `graceShieldPct`, `graceShieldDuration` | RD |
| Warded Weft (`warded_weft`) | common | Mend heals {v}% more on a hero your Ward is on. (20 / 30 / 40) | Lifeline keys on low life; this on a Ward. Adds to the Astrolabe's Lifeguard | Existing `mendWarded` (adds) | PP, RD |
| Thread the Needle (`thread_the_needle`) | epic | Moving the Thread onto a hero within 0.35 s before a telegraph strikes them negates {v}% of the hit and gives half a Perfect Ward's Resonance. (50) | the first well-timed save that isn't a Ward; rewards retargeting on the beat of a hit. It is not a Perfect Ward: nothing that pays "a Perfect Ward" fires on it | New N4 | PP |
| Gilt Edge (`gilt_edge`) | common | Kills by an Empowered hero give {v} more Resonance. (2 / 3 / 4) | adds to the existing +2 for an Empowered kill (`health.ts:1863`) | New N5 | MA |
| Stray Stitch (`stray_stitch`) | rare | While you Mend, every {v} s the most hurt other hero in your field heals 4% of their life. (5 / 4 / 3) | the Prism Loom spreads by distance from the threaded hero; this follows need, inside the field | Trigger: every {v} s while Mending → heal the lowest other hero in the field | CS |
| Spindle Turn (`spindle_turn`) | common | Moving the Thread to another hero gives back {v} Spirit, at most once every 3 s. (2 / 3 / 4) | Relay Weave heals and Silver Thimble shields on a retarget; this feeds Spirit | Trigger: on `threadAttached` → Spirit, every 3 s | MA, RL |
| Kindred Wound (`kindred_wound`) | rare | When you take damage, the hero you Thread heals {v}% of it. (25 / 35 / 45) | the only motif that pays off the Weaver being hit; Bear makes it constant | Trigger: on `damageTaken` with the Weaver as target → heal the threaded hero | BS |

### Aegis: Ward, Chime, Reel and Glide (12 new; 7 → 19)

| Motif (id) | Rarity | Text (L1 / L2 / L3) | Distinct from | Sim | Builds |
|---|---|---|---|---|---|
| Shatterglass (`shatterglass`) | rare | When a Ward breaks, its shards strike the 3 nearest enemies within 5 m of the hero for {v} damage each. (100 / 150 / 200) | Riposte Bloom pays a Perfect; this pays a Ward that was used up | Trigger: on `shieldBroken` (a Ward) → damage to 3 nearest | PP, RD |
| Sister Ward (`sister_ward`) | rare | When you Ward a hero, the nearest other hero within 6 m gains a barrier of {v}% of their life for 3 s. (12 / 18 / 24) | Twin Aegis gives charges; Chorale is a variant that replaces the Ward. The plan's *Twin Aegis* effect | Trigger: on `techniqueCast` (Ward) → barrier on the nearest other hero | RD, PP |
| Clean Strike (`clean_strike`) | common | A Perfect Ward gives back {v} Spirit. (6 / 9 / 12) | the only Perfect payoff in Spirit | Trigger: on `perfectWard` → Spirit | PP |
| Ringing Steel (`ringing_steel`) | common | A Perfect Ward staggers its attacker {v}% longer. (30 / 50 / 70) | control, not damage; the Astrolabe's Ringing Parry is the same lever and they multiply | Existing `staggerMult` (multiplies) | PP |
| Clutch Peal (`clutch_peal`) | common | A Clutch Cleanse gives {v} more Resonance. (5 / 8 / 10) | the first Chime payoff in Resonance | Trigger: on `cleansed` with `clutch` → Resonance | PP, MA |
| Bright Peal (`bright_peal`) | common | Every hero your Chime cleanses gains a barrier of {v}% of their life for 3 s. (8 / 12 / 16) | Absolve is a variant that heals and guards; this keeps the default Chime and adds a barrier | Trigger: on `cleansed` (removed > 0) → barrier on the target | RD |
| Safe Harbour (`safe_harbour`) | common | A hero you Reel lands with a barrier of {v}% of their life for 3 s. (10 / 15 / 20) | Fisher's Knot shortens Reel's cooldown; Anchor is a variant | Trigger: on `reeled` → barrier on the target | RD |
| Light Step (`light_step`) | common | Where you land a Glide, every hero within 3 m heals {v}% of their life. (4 / 6 / 8) | the first Glide that helps the party | Trigger: on `glided` → heal heroes within 3 m of the landing | CS |
| Shieldsong (`shieldsong`) | common | A hero your Ward is on deals {v}% more damage. (10 / 15 / 20) | adds to the Astrolabe's Shield Bearer; the Ward as a buff | Existing `wardedDamage` (adds) | RD, PP |
| Second Toll (`second_toll`) | rare | After a Clutch Cleanse, Chime recovers {v} s at once. (3 / 4.5 / 6) | Hollow Bell and Stillwater Bell shorten the cooldown always; this rewards the clutch | Trigger: on `cleansed` with `clutch` → Chime cooldown −{v} s | PP |
| Tender Guard (`tender_guard`) | common | A Perfect Ward heals its hero {v}% of their life. (8 / 12 / 16) | Glass Halo heals everyone at a cost; this heals the one you guarded, free | Trigger: on `perfectWard` → heal the target | PP |
| Last Bastion (`last_bastion`) | rare | Your Ward on a hero below 35% of their life is {v}% larger. (30 / 45 / 60) | Blood Tithe does this for Brann alone (`mods.ts:559-562`); this is for anyone | New N6 | BS, RD |

### Choir: the field, outside the auras (5 new; 7 → 12, 18 with W7)

None of these changes an aura's strength, reach, reservation or who it reaches (decision 2).

| Motif (id) | Rarity | Text (L1 / L2 / L3) | Distinct from | Sim | Builds |
|---|---|---|---|---|---|
| Massed Voices (`massed_voices`) | common | Heroes standing in your field deal {v}% more damage. (6 / 9 / 12) | adds to the Astrolabe's Anthem; reads `hero.inField` only | Existing `inFieldDamage` (adds) | CS |
| Close Harmony (`close_harmony`) | common | While 3 or more heroes stand in your field, Spirit returns {v}% faster. (20 / 30 / 40) | Deep Breath is unconditional; this pays for holding the party together | New N7 | CS |
| Breath Between (`breath_between`) | rare | A technique cast after 4 s without casting one costs {v}% less Spirit. (30 / 45 / 60) | the first motif about pacing your casts; helps heavy-aura builds afford their saves | New N8 | CS, BS |
| Full Chord (`full_chord`) | rare | Heroes in your field take {v}% less damage for each aura in your songs. (2 / 3 / 4) | reads how many auras you carry (as the chorus pulse and Radiance do), never their effects | New N9 | CS |
| Long Phrase (`long_phrase`) | common | Your Spirit is {v}% larger. (15 / 20 / 25; *was 8 / 12 / 16, W11*) | the opposite of the Frayed Spirit bane; reservation stays a share, so the free pool grows with it | Existing `spiritMult` (multiplies) | CS |

### Bond: heroes (12 new, two each; 6 → 18)

Hero-gated before any draw, as today (`run.ts:2033`), so each changes only runs with that hero.

| Motif (id) | Hero | Rarity | Text (L1 / L2 / L3) | Distinct from | Sim | Builds |
|---|---|---|---|---|---|---|
| Penitent Shield (`penitent_shield`) | Kael | rare | Kael's Challenge also heals every hero within 6 m of him for {v}% of their life. (6 / 8 / 10) | Bulwark's Echo pays when Aegis Wall ends; this pays the taunt | Trigger: on `abilityUsed` (Kael's `challenge`) → heal heroes within 6 m | PP, RD |
| Iron Answer (`iron_answer`) | Kael | common | Each Ward you cast on Kael brings his Challenge {v} s closer. (2 / 3 / 4) | the plan's *Bulwark's Echo* idea (Ward → taunt), done through his own taunt | Trigger: on `techniqueCast` (Ward on Kael) → his `challenge` cooldown −{v} s | PP |
| Split Fletching (`split_fletching`) | Lyra | rare | While Empowered, Lyra's arrows pass through their target and strike the enemy behind for {v}% of the damage. (50 / 75 / 100) | Ricochet (talent) bounces inside the field; this pierces in a line | New N11 | RL |
| Steady Draw (`steady_draw`) | Lyra | common | Cueing Lyra brings her Piercing Shot {v} s closer. (2 / 3 / 4) | the first motif tying a Cue to an ability | Trigger: on `cued` (Lyra) → her `piercingShot` cooldown −{v} s | MA |
| Constellation Lines (`constellation_lines`) | Vexis | rare | Vexis's Starbolt also strikes every enemy touching your Thread for {v}% of its damage. (40 / 60 / 80) | Starthread (talent) chains her spells along the Thread; this hits what the Thread crosses | New N1 (shared test) + N10b | RL |
| Inner Orbit (`inner_orbit`) | Vexis | common | Vexis casts {v}% faster while she stands in your field. (15 / 22 / 30) | Starlit Study speeds Starbolt always; this every cast, in the field. The plan's *Quickened Verse* | New N10 | CS |
| Bloodsong (`bloodsong`) | Brann | common | When a barrier on Brann breaks, he heals {v}% of his life, at most once every 4 s. (3 / 4 / 5) | heals through barriers, the healing Blood Rage wants; Blood Rage still halves it | Trigger: on `shieldBroken` (on Brann) → heal him, every 4 s | RD |
| Edge of the Red (`edge_of_the_red`) | Brann | rare | While Brann is below 30% of his life, your Empower on him is {v}% stronger. (20 / 30 / 40) | Blood and Silk pays Resonance at the same line; this pays damage | New N12 | RD |
| Cold Steel (`cold_steel`) | Seren | rare | Seren's counters after a parry deal {v}% more. (20 / 30 / 40) | En Garde pays Resonance per parry; this the counter itself | New N13 | RD, PP |
| Second Intention (`second_intention`) | Seren | common | A Perfect Ward on Seren also gives her a barrier of {v}% of her life. (10 / 15 / 20) | keeps her parry armed after the Ward is spent | Trigger: on `perfectWard` (Seren) → barrier on her | RD, PP |
| Graft (`graft`) | Oro | rare | Rootbond's Mend on Oro's Saplings is {v}% stronger. (25 / 50 / 75) | Verdant Choir has the Saplings sing; this heals them | New N14 | CS |
| Seed Vault (`seed_vault`) | Oro | common | When one of Oro's Saplings falls, Oro gains a barrier of {v}% of his life for 4 s. (10 / 15 / 20) | the first payoff for a fallen Sapling | Trigger: on `summonFell` (a Sapling) → barrier on its owner | CS |

### Finale: Resonance, Cues and the Crescendo (12 new; 5 → 17)

| Motif (id) | Rarity | Text (L1 / L2 / L3) | Distinct from | Sim | Builds |
|---|---|---|---|---|---|
| Call and Response (`call_and_response`) | rare | A hero you Cue is Empowered for {v} s, Thread or not. (3 / 4 / 5) | the Conductor's Spotlight is ×2 for the Solo, Conductor only; this is ×1, timed, any Calling. With both, the larger applies | Trigger: on `cued` → Empower for {v} s (sets the existing `hero.afterglowUntil`, `state.ts:354`, read by `thread.ts:312`) | MA |
| Taking Bows (`taking_bows`) | common | When your Crescendo ends, every hero's Solo charges {v}%. (20 / 30 / 40) | Da Capo keeps Resonance; this charges Solos. The plan's *Standing Ovation* | Trigger: on `crescendoEnd` → Solo charge, all | MA |
| Opening Bars (`opening_bars`) | rare | Your first Cue in each fight costs {v} less Resonance. (10 / 15 / 25) | the plan's *Da Capo* (first Cue free) | New N15 | MA |
| Ringing On (`ringing_on`) | rare | Each Perfect Ward during your Crescendo makes it last 1 s longer, up to {v} s. (2 / 3 / 4) | Encore is a flat extension; this is earned. The plan's *Encore* | Trigger: on `perfectWard` while a Crescendo plays → Crescendo +1 s, capped | PP |
| Saving Grace (`saving_grace`) | common | Each Save gives {v} more Resonance. (5 / 8 / 10) | Standing Ovation multiplies every gain; this rewards one act | Trigger: on `save` → Resonance | PP, BS |
| Tenuto (`tenuto`) | common | Your Resonance waits {v} s longer before it starts to fade. (2 / 3 / 4) | the Conductor's Triad stops the fade on a condition; this delays it always | New N16 | MA |
| Lament's Answer (`laments_answer`) | common | When a hero goes down, the others' Solos charge {v}%. (15 / 22 / 30) | the Lantern of the Lost shields the others; this arms them | Trigger: on `allyDowned` → Solo charge, the others | MA |
| Footlights (`footlights`) | common | A hero you Cue gains a barrier of {v}% of their life for 4 s. (8 / 12 / 16) | the first Cue that guards | Trigger: on `cued` → barrier on the hero | MA, RD |
| Fanfare (`fanfare`) | rare | When your Crescendo begins, every hero gains a barrier of {v}% of their life for 5 s. (10 / 15 / 20) | works with every Calling's Crescendo; Sunrise, the Vow, Stasis and the Grand Finale don't shield | Trigger: on `crescendoStart` → barrier, all | PP, BS |
| Vigil Song (`vigil_song`) | rare | Mending a hero below 30% of their life makes {v} Resonance a second. (1 / 1.5 / 2) | Empower already trickles Resonance; this is the healer's trickle | New N18 | BS, CS |
| Answering Phrase (`answering_phrase`) | rare | Cueing a hero within 4 s of Cueing another gives back {v} Resonance. (3 / 5 / 7) | Canon charges Solos; this refunds the next Cue. Chains Cues for any Calling | Trigger: on `cued` with another Cue within 4 s → Resonance | MA |
| Tuning Up (`tuning_up`) | common | Your heroes start each fight with their Solos {v}% charged. (15 / 22 / 30) | The Last Note (boon) fills them for two fights; this partly, every fight | New N17 | MA |

### Harmonies (10 new; 1 → 11, 12 with W7)

A Harmony is offered once every prerequisite is owned (`run.ts:2040-2043`); a hero or aura gate is checked as for any motif. Harmonies are rarity `epic`, one level, tagged `harmony`, and are the only new entries allowed to be "more" sources (02 §12 rule 1; ground rule 8).

| Harmony (id) | Requires | Text | Sim | Builds |
|---|---|---|---|---|
| Woven Aegis (`woven_aegis`) | Warded Weft + Lingering Aegis | Mend on a hero your Ward is on also refills the Ward by {v}% of the healing. (30) | New N19 | PP, RD |
| Cutting Chorus (`cutting_chorus`) | Razor Silk; Fortissimo in your songs | With Fortissimo in your songs, Razor Silk deals {v}% more damage and can strike critically. (100) | New N1 (its multiplier and crit) | RL |
| Guardian's Cadence (`guardians_cadence`) | Kael; Iron Answer + Riposte Bloom | Kael's Shield Bash sets off Riposte Bloom around him at {v}% strength. (50) | Trigger: on `abilityUsed` (Kael's `shieldBash`) → Riposte Bloom's damage × {v}% around him | PP |
| Spindle Lullaby (`spindle_lullaby`) | Razor Silk; Lullaby in your songs | With Lullaby in your songs, ordinary enemies touching your Thread fall asleep for {v} s, once per enemy every 8 s. (1) | New N1 (the existing `sleep` status) | RL, CS |
| Tempo Rubato (`tempo_rubato`) | Canon + Opening Bars | One Cue in every {v} costs no Resonance. (3) | New N15 | MA |
| Concert Pitch (`concert_pitch`) | Steady Hands + Thread the Needle | A Perfect Ward rings out: every hero deals {v}% more damage for 4 s. (15) | New N20 | PP |
| Grand Staff (`grand_staff`) | Golden Filament + Call and Response | Empowered heroes' Solos charge {v}% faster. (100) | New N21 | MA |
| Crossed Steel (`crossed_steel`) | Seren; En Garde + Second Intention | Each parry Seren makes brings your Ward {v} s closer. (2) | Trigger: on `parried` → Ward cooldown −{v} s | RD, PP |
| Wounded Healer (`wounded_healer`) | Kindred Wound + Saving Grace | While you are below half your Life, Mend heals {v}% more and your Wards are {v}% larger. (25) | New N22 | BS |
| Closed Circle (`closed_circle`) | Massed Voices + Close Harmony | While every hero stands in your field, they take {v}% less damage. (10) | New N23 | CS |

Each build has at least one Harmony: CS Closed Circle and Spindle Lullaby; PP Concert Pitch, Woven Aegis and Guardian's Cadence; BS Wounded Healer; RL Cutting Chorus and Spindle Lullaby; MA Tempo Rubato and Grand Staff; RD Blood and Silk (exists) and Crossed Steel.

W0 adds the missing lint that every `requires.motifs` id names a real motif (today only `aura` and `hero` are checked, `schema.ts:2305-2308`).

### Relics (18 new; 21 → 39, 40 with W7)

Every new relic carries `expedition: true` (decision 4). Every one with numbers has `empowered` values for the Reliquary's Dissonate (`schema.ts:950`), about +50% on its main number; the column gives them.

| Relic (id) | Rarity | Text | Values (empowered) | Distinct from | Sim | Builds |
|---|---|---|---|---|---|---|
| Pilgrim's Lamp (`pilgrims_lamp`) | common | When a hero is revived, they gain a barrier worth {barrier}% of their life for {seconds} s. | barrier 25 (35), seconds 4 | the Lantern pays when a hero goes down; this when they come back | Trigger: on `revived` → barrier | all |
| Tin Whistle (`tin_whistle`) | common | Answering a hero's call gives {resonance} more Resonance. | resonance 5 (8) | adds to the Astrolabe's Ready Answer | Existing `responseBonus` (adds) | MA |
| Black Ribbon (`black_ribbon`) | common | When a heavy foe falls (a Bell Brute, Impaler, Crimson Sentinel, Void Maw, Hollow Champion, or the Mirror Bass or Tenor), every hero heals {heal}% of their life. | heal 10 (15) | the first relic that pays a kill; "heavy foe" is content's `role: 'brute'` | Trigger: on `enemyKilled` whose def has `role: 'brute'` → heal, all | all |
| Pedlar's Ledger (`pedlars_ledger`) | common | Merchants stock {more} more relic. | more 1 (2); `runOnly` | Star Chart widens drafts; this widens shops | New N25 (run layer) | all |
| Spare Strings (`spare_strings`) | common | Once per fight, the first time your Thread snaps at range, it reattaches at once. | none | Slack Line shortens every snap; this forgives one | New N24 | RL |
| Echoing Shell (`echoing_shell`) | rare | A Perfect Ward charges every other hero's Solo by {pct}%. | pct 10 (15) | Tuning Fork charges the guarded hero's | Trigger: on `perfectWard` → Solo charge, the others | PP, MA |
| Lament Pin (`lament_pin`) | rare | When a hero goes down, you gain {resonance} Resonance. | resonance 25 (35) | turns a loss into a Crescendo sooner | Trigger: on `allyDowned` → Resonance | BS |
| Sand Glass (`sand_glass`) | rare | After a Perfect Ward, your Chime, Reel and Glide recover {seconds} s. | seconds 1.5 (2) | the Perfect already refunds the Ward; this the other three | Trigger: on `perfectWard` → those cooldowns −{seconds} s | PP |
| Prompt Book (`prompt_book`) | rare | Your first Crescendo in each fight costs {cost} less Resonance. | cost 15 (20) | Cantor's Hymnal starts you with Resonance; this lowers the price once | New N15b | MA, PP |
| Thornwreath (`thornwreath`) | rare | Heroes below {below}% of their life deal {pct}% more damage. | below 30, pct 20 (30) | the low-life play the Red Line wants, for any hero | New N30 | RD, BS |
| Bell Clapper (`bell_clapper`) | rare | Your Chime stuns ordinary enemies it reaches for {seconds} s. | seconds 1 (1.5) | the first Chime that controls | Trigger: on `chimeLanded` → `stun` on ordinary enemies within its radius | PP, CS |
| Mender's Needle (`menders_needle`) | rare | Mend revives a downed hero {pct}% faster. | pct 50 (75) | multiplies with the Astrolabe's revive nodes | Existing `reviveSpeedMult` (multiplies) | all |
| Everbell (`everbell`) | legendary | Your Chime holds {charges} charges. | charges 2 | Ward charges exist (Twin Aegis, First Score); the Chime has none | New N26 | PP |
| Heartwood Lute (`heartwood_lute`) | legendary | Your Crescendo also fills every hero's Solo. | none | Taking Bows charges Solos when it ends, partly; this fills them as it starts | Trigger: on `crescendoStart` → Solo charge 100, all | MA |
| Water Clock (`water_clock`) | legendary | Once per fight, when a hero goes down, time turns back for them: they stand again with the life and the place they had {seconds} s before. | seconds 3 | Sacrificial Lamb and Martyr's Veil move a lethal hit; this undoes it, after the fact | New N27 | BS, all |
| Iron Mask (`iron_mask`) | cursed | Your heroes take {pct}% less damage. *Curse:* your Thread can't Empower. | pct 12 (18); *was 15 (20), W11* | a defence for a Mend-only build, paid with half the Thread | New N28 | CS, BS |
| Red Ink (`red_ink`) | cursed | Every Perfect Ward gives {resonance} more Resonance. *Curse:* your Ward recovers {slower} s slower. | resonance 10 (15), slower 3 | Glass Halo shrinks the Ward; this slows it | Trigger: on `perfectWard` → Resonance; curse: existing `wardCooldownCut` at −{slower} unless cleansed | PP |
| Hollow Crown (`hollow_crown`) | cursed | Cues cost {cut} less Resonance. *Curse:* Solos charge {pct}% slower. | cut 10, pct 25 | cheaper Cues, fewer of them ready | Existing `cueCostBonus` (−{cut}) and `soloChargeMult` (×0.75 unless cleansed), plus New N29 (a Cue never costs below 0) | MA |

Rarities after the fill: common 10, rare 16, legendary 8, cursed 5 (39); W7's Dissonant Tuning makes cursed 6 (40). The Merchant of Silences' "Accept a gift" and Discordant Pact draw from the cursed pool; both get the Expedition-only filter (ground rule 6).

### Events and boons (6 events, 2 boons; events 10 → 16)

Each lists its choices **in order**: the harness takes the first it can (`harness-core.ts:1834-1848`). Every event keeps a free choice with nothing to pick (`schema.ts:2605-2616`). Only existing effect kinds are used (`schema.ts:975-1002`).

| Event (id) | Movement | Scene | Choices, in order |
|---|---|---|---|
| Hero's Doubt (`heros_doubt`) | II | "Halfway up the Spire, one of your heroes stops on the stair. 'How many more of these?' The others wait for your answer." | **Hear them out**: every hero heals 20% of their life, and your heroes deal 10% more damage for the next 2 fights (heal 0.2, boon `steadied`). **Press on**: gain 40 Aether; your heroes deal 10% less damage in the next fight (aether 40, boon `faltering`). **Say nothing**: nothing happens. |
| The Quartermaster (`quartermaster`) | II | "A Legion quartermaster sells from the back of a cart, no questions asked, and no prices lowered." | **Buy the sealed crate** (70 Aether): a rare relic. **Buy the war chest** (140 Aether): a legendary relic. **Walk on**: nothing happens. |
| The Bleeding Bell (`bleeding_bell`) | II | "A bell of red iron hangs over the road. It rings by itself whenever blood is spilled near it." | **Toll for the fallen**: every hero heals 20% of their life. **Ring it yourself** (a gamble, 50%): a legendary relic; otherwise every hero loses 25% of their life. **Pass by**: nothing happens. |
| Lost Weaver's Echo (`lost_weavers_echo`) | III | "In a cracked mirror a Weaver lifts a Thread the moment you do. It isn't your reflection; it's later than you." | **Face your echo**: the Mirror Hall's fight; win and choose 1 of 2 relics (fight `mirror_hall`, relics 2). **Listen to it**: a motif you choose gains 1 level; every hero loses 10% of their life (`upgradable`, motifLevels 1, hurt 0.1). **Look away**: nothing happens. |
| The Unravelled Tapestry (`unravelled_tapestry`) | III | "A tapestry the height of the hall, half unpicked. Every loose thread is a song someone stopped singing." | **Reweave it** (50 Aether): a motif you choose gains 1 level. **Pull a thread**: lose a motif you choose; gain a legendary relic (`any`, loseMotif, relic legendary). **Leave it**: nothing happens. |
| The Stopped Clock (`stopped_clock`) | III | "A clock with no hands stands in the dust of the Rift, ticking." | **Wind it**: your heroes start the next 2 fights with their Solos charged (boon `last_note`). **Take its spring**: every hero loses 15% of their life; gain a rare relic. **Leave it**: nothing happens. |

New boons (appended after Mended Loom, `relics.ts:259`):

| Boon (id) | Kind | Text | Values | Fights | Sim |
|---|---|---|---|---|---|
| Steadied (`steadied`) | boon | Your heroes deal {pct}% more damage. | pct 10 | 2 | Existing `partyDamageMult` (multiplies) |
| Faltering (`faltering`) | bane | Your heroes deal {pct}% less damage. | pct 10 | 1 | Existing `partyDamageMult` (multiplies) |

To verify in W6: the Movement lint (`schema.ts:1932-1986`) accepts `mirror_hall`, a Movement III skirmish, as an event fight. If it does not, Lost Weaver's Echo fights `unstitched_vanguard`, as the Loose Thread's *Pull* does.

## W7: auras and ornaments (needs your approval before it is built)

Nothing outside W7 depends on any of this. If none is approved, the slice is complete without it. Approval can be item by item.

**Auras** (the plan's 03 §3, `docs/plan/03-content-bible.md:108-119`). Each needs new effect keys on `AuraDef` (`schema.ts:842-856`) as optional keys with no default, so the six existing auras parse to exactly what they do today, and readers in `combat/auras.ts` (`AuraTotals`, `:12-42`) and `systems/field.ts`.

| Aura | Subtitle | Reserve | Text | New sim | Unlock Rank |
|---|---|---|---|---|---|
| Requiem | Doom hex | 30% | Enemies in your field take 12% more damage and deal 8% less. | `enemyVulnerability`, `enemyWeaken` on the enemy side of the coverage mask; read in `health.ts`' damage paths | 7 |
| Cantabile | Purity | 20% | Ailments on heroes in your field last 40% shorter and deal 30% less damage. | `ailmentDuration`, `ailmentDamage`; read where statuses tick and are applied | 9 |
| Staccato | Precision | 30% | Heroes in your field strike critically 10% more often, for 30% more. | `critChance`, `critDamage`; read in `heroDamage.ts:63-64` (the crit draw is always taken, so no new draw) | 11 |
| Rubato | Tempo | 25% | Solos of heroes in your field charge 30% faster, and each Cue gives back 5 Resonance. | `soloCharge`, `cueRefund`; read in `heroes.ts` (charge) and `techniques.ts` (Cue) | 13 |

**Ornaments** (03 §4, `:143-154`), recast for the game's beam and field songs.

| Ornament | Text | Fields | New sim | Unlock Rank |
|---|---|---|---|---|
| Sforzando | Its auras work 25% better but reserve 20% more Spirit. | `effectMult 1.25`, `reserveMult 1.2` | none | 8 |
| Descant | Beam song only. The echo carries the melody: everyone near you hears it 40% stronger, and your threaded hero 20% weaker. Excludes Unison. | `focusMult 0.8`, `echoMult 1.4`, `roles ['beam']` | none | 10 |
| Echo | After a Perfect Ward, its auras work twice as well for 4 s. | new `onPerfect` | field strength timer in `field.ts` | 14 |
| Counterpoint | Field song only. Its auras turn on the enemies in your field instead, as their inverted forms. | new `invert` | every aura gains an inverted form (the plan's *Counterpoint* column); this adds data to the six existing auras' definitions, with their own numbers unchanged | 16 |
| Martyr's Tithe | Its auras reserve Life instead of Spirit, and work 15% better while you are below half your Life. | new `reserves 'life'` | per-Chord reserve pool in `chords.ts` (today the pool is per run, `chords.ts:103-148`) | 17 |
| Syncopation | Its auras pulse at 2.2 times their strength for 1.5 s on every bar of the music, and reserve 15% less. | new `pulse` | uses the sim's bar clock from 5f (`BAR_SECONDS`, `beatAt`, docs/phase-5f.md:267, 362) | 18 |

**Aura-specific motifs, a Harmony and a relic** (each offered only with its aura slotted, so presets and pins don't move, except Dissonant Tuning, which enters the Expedition cursed pool).

| Entry | Text | Requires |
|---|---|---|
| Killing Edge (`killing_edge`, Choir, rare) | Critical hits by heroes in your field give 1 Resonance, at most {v} a second. (1 / 2 / 3) | Staccato |
| Clean Slate (`clean_slate`, Choir, common) | An ailment that runs out on a hero in your field heals them {v}% of their life. (6 / 8 / 10) | Cantabile |
| Last Rites (`last_rites`, Choir, rare) | Enemies that die in your field burst for {v}% of their life onto enemies within 3 m. (6 / 8 / 10) | Requiem |
| Accelerando (`accelerando`, Choir, rare) | Each Cue brings the other heroes' Solos {v}% closer. (8 / 12 / 16) | Rubato |
| Iron Refrain (`iron_refrain`, Choir, common) | After a Perfect Ward, Ostinato's barriers refill twice as fast for {v} s. (2 / 3 / 4) | Ostinato |
| Long Hold (`long_hold`, Choir, rare) | Fermata's hold lasts {v} s, and can hold each hero twice a fight. (2 / 2.5 / 3) | Fermata |
| Ostinato Loop (`ostinato_loop`, Harmony) | A Perfect Ward refills every hero's Ostinato barrier. | Iron Refrain + Twin Aegis |
| Dissonant Tuning (`dissonant_tuning`, cursed relic) | One of your Chords holds a third aura. *Curse:* enemy wind-ups are {pct}% shorter. (pct 10) | — |

Two names here would need changing before any build: the ornament **Echo** collides with Phase 6's Echoes (docs/phase-6.md), and the aura **Rubato** sits beside the Harmony Tempo Rubato.

W7 also owns these auras' and ornaments' looks (colours through `tests/colorVision.test.ts`, field rim colours, sounds), and their lines in the unlock schedule (`src/meta/profile.ts:280-336`). With W7: auras 10, ornaments 10, motifs 90, Harmonies 12, relics 40.

## Shared sim support

### The trigger system (W0)

A new system, `src/sim/systems/triggers.ts`, that runs once a tick and reacts to the events emitted earlier that tick. It replaces about forty bespoke hooks with one interpreter, and it is inert on every existing run.

- **Where.** `stepWorld` (`src/sim/api.ts:75-125`) records `const mark = world.events.length` as its first line (a local, not state) and calls `if (world.internal.triggers) updateTriggers(world, mark)` immediately before `updateLedger(world)`. Without a trigger-holding motif or relic, `world.internal.triggers` is absent and nothing runs.
- **What it reads.** Events from `mark` to the length at entry, in emission order; triggers in the order the run's motifs, relics and boons were resolved. Effects it applies emit events too; those are not read in the same pass.
- **Events it reacts to:** `perfectWard`, `save`, `cleansed`, `chimeLanded`, `reeled`, `glided`, `threadAttached`, `threadSnapped`, `techniqueCast`, `shieldBroken`, `damageTaken` (with the Weaver as target), `abilityUsed`, `cued`, `crescendoStart`, `crescendoEnd`, `allyDowned`, `revived`, `parried`, `summonFell`, `enemyKilled`, and a timer (`every s`). Conditions: a target hero by content id, the Thread's mode, a Crescendo playing, another Cue within s, `clutch`, the slain enemy's content role.
- **Effects it can apply**, each through the existing function that already does it: a barrier (`addShield` with kind `overshield`, from the Weaver, `health.ts:201`); a heal (`heal`, `:601`); Resonance (`gainResonance`, `resonance.ts:10`); Spirit; Solo charge; damage around a point or to the nearest n enemies (`dealDamage`, `health.ts:784`, credited as Riposte Bloom's nova is, `telegraphs.ts:670`); a status on ordinary enemies within a radius (`addStatus`, `:283`: `stun`, `sleep`); a technique's cooldown; a hero ability's cooldown; Empower for s (`hero.afterglowUntil`); the Crescendo's remaining time, capped.
- **Limits.** Each trigger has an optional `every` (seconds between fires) and `perFight`; their clocks live in `world.internal.triggers` (hashed, absent without triggers).
- **What it tells the views.** Each fire emits `motifTriggered { source, target? }` (new, appended to the event union) for the UI, render and audio, and counts into `ledger.triggers?: Record<string, number>` (absent without triggers) for the harness and the Result.
- **Draws.** None. Targets are chosen by distance, then entity id.

### New hooks (W0 places the call sites; the owning stream writes the bodies)

Each is a guarded one-line call in the shared file into the owning stream's `src/sim/fill/<stream>.ts`, with a stub that returns the neutral value until the stream fills it (5e's pattern, docs/phase-5e.md:126). Each new `Mods` field has a default that does nothing.

| # | For | Shared file and site | What |
|---|---|---|---|
| N1 | Razor Silk, Constellation Lines, Cutting Chorus, Spindle Lullaby | `systems/thread.ts` `updateThread`; a shared test `onThread(world, enemy)` in `sim/fill/threadContact.ts` (W0 writes it: the segment from the Weaver to the threaded hero against the enemy's radius) | damage every 0.5 s to touching enemies (`razorDps`), its multiplier and crit (`razorMult`, `razorCrit`), sleep (`razorSleep`) |
| N2 | Slack Line | `thread.ts`, the range snap's lockout | `snapLockMult` (the enemy cut's lock is `cutLockMult`, untouched) |
| N3 | Quickening Thread | `thread.ts:318` | `empowerSpeedMult` on `empowerAttackSpeed` |
| N4 | Thread the Needle | `thread.ts` on attach sets `hero.needleUntil?`; `combat/telegraphs.ts` before a telegraph's damage to a hero | negate `needlePct` of the hit; give half a Perfect's Resonance (10); emit `needled` (new event). No cooldown refund or stagger |
| N5 | Gilt Edge | `health.ts:1863`, beside the Empowered-kill gain | `empoweredKillBonus` |
| N6 | Last Bastion | `systems/techniques.ts`, the Ward's barrier, beside Blood Tithe | `lowWardBonus`, `lowWardBelow` |
| N7 | Close Harmony | `systems/weaver.ts`, Spirit regen | `huddleRegen` while 3+ heroes have `inField` |
| N8 | Breath Between | `techniques.ts`, technique cost | `restDiscount` after 4 s without a cast (`weaver.lastCastAt?`) |
| N9 | Full Chord | `health.ts`, damage taken, beside Haloed (`:917`) | `perAuraGuard` × auras in the songs, heroes `inField` |
| N10, N10b | Inner Orbit; Constellation Lines' Starbolt | `systems/heroes.ts`, cast time; Starbolt's landing | `orbitCast` for Vexis `inField`; Starbolt calls `onThread` |
| N11 | Split Fletching | Lyra's arrow hit (`systems/hits.ts`) | `pierce` share while Empowered |
| N12 | Edge of the Red | `thread.ts` `empowerBonus` | `redEdge` while the hero has Blood Rage and is below 30% |
| N13 | Cold Steel | `systems/duel.ts`, the parry counter | `counterBonus` |
| N14 | Graft | `systems/grove.ts`, Rootbond's share | `graftMult` |
| N15, N15b | Opening Bars, Tempo Rubato; Prompt Book | `systems/conducting.ts` `cueCostNow` and `crescendoCostOf`, so the HUD and bots read the same number (docs/phase-5f.md:364-365) | `firstCueCut`, `freeCueEvery` (counted from `ledger.cues`), `firstCrescendoCut` |
| N16 | Tenuto | `combat/resonance.ts:37-44`, the 5 s idle | `fadeDelay` |
| N17 | Tuning Up | `world.ts`, hero spawn | `startSoloCharge` (beside The Last Note's `startSolos`, `world.ts:1159`) |
| N18 | Vigil Song | `thread.ts`, Mend | `vigilResonance` below 30% |
| N19 | Woven Aegis | `thread.ts`, Mend | `wovenRefill` into the Ward shield |
| N20 | Concert Pitch | `field.ringing?` (until); `health.ts:840-845` | `ringingPct`, `ringingSeconds` |
| N21 | Grand Staff | `heroes.ts`, Solo charge | `staffMult` while Empowered |
| N22 | Wounded Healer | `thread.ts` (Mend) and `techniques.ts` (Ward) | `woundedBonus` below half the Weaver's Life |
| N23 | Closed Circle | `health.ts`, damage taken | `circleGuard` while every standing hero is `inField` |
| N24 | Spare Strings | `thread.ts`, the range snap | `spareSnap` once a fight (`weaver.spareUsed?`) |
| N25 | Pedlar's Ledger | `src/meta/run.ts` `makeShop` (`:1713`), `SHOP_RELICS` + the relic's value | run layer only |
| N26 | Everbell | `techniques.ts`, Chime cooldown, as Ward charges are | `chimeCharges` (`weaver.chimeCharges?`) |
| N27 | Water Clock | `systems/rewind.ts` `recordPast` (`:28-40`) records when the relic is held, on its own guard line beside the Chronomancer's; `health.ts` `heroOut` path rewinds once | `waterClock` seconds; the history buffer is allocated at spawn only with the relic |
| N28 | Iron Mask | `thread.ts` (Empower refused) and `health.ts` (damage taken) | `maskGuard`, `noEmpower` |
| N29 | Hollow Crown | `systems/conducting.ts` `cueCostNow` | the Cue's cost is clamped at 0. Today a negative `cueCostBonus` can't happen; on a Conductor run with A Tempo, a Cue on the beat costs `cueCostBonus` alone (docs/phase-5f.md:364), which Hollow Crown would make −10 |
| N30 | Thornwreath | `health.ts:840-845` | `thornPct`, `thornBelow` |

## Engineering ground rules

5b's, 5c's, 5d's, 5e's and 5f's rules still hold (docs/phase-5e.md:302-342, docs/phase-5f.md:179-200). This slice adds:

1. **Pins that never move**, at any merge, with or without the new content:
   - the 25 goldens and the Conductor's 3 that 5f's W4 is adding (28 once 5f lands): every hash in `tests/sim/golden.json` and the literals in `tests/sim/m1Unchanged.test.ts`. Only `contentVersion` in `golden.json` moves: at go-live, at the end of tuning, and at W7 if it is built;
   - `SIM_VERSION` 22 and the replay format 6. No command changes; every new hashed key is optional and absent unless its motif or relic is held (`hashValue` hashes a key set to `undefined`, `core/hash.ts:55`, so none is ever written as `undefined`);
   - every cell: `tools/m1-baseline.ts --movement 1|2|3|4 --check` for the default party and every party file (A, B, C, SA-OC); the four commandSnapshot files; `tests/bots/roster20.test.ts`; `rosterInvariance.keys.json` (its `FORBIDDEN` list grows to the new keys);
   - every Prelude pin: `tests/meta/preludeSnapshot.test.ts` (maps and runs), and the Prelude half (even seeds) of `tests/meta/draftSnapshot.json`;
   - the render and audio Spire and Rift snapshots;
   - the reports built on Prelude runs or cells, byte-equal to the same report run on the pre-W0 tree: `tools/callings.ts` (whole runs and `--cells`), `tools/astrolabe.ts` (Prelude runs and `--fights`; its `--movement 2|3|4` whole-run modes move), `tools/reliquary.ts --power`, `tools/powercap.ts`, `tools/bonds.ts`, `tools/variants.ts`, `tools/dissonance.ts`, `tools/decrees.ts`, `tools/verbs.ts`, and the existing rows of `tools/relics.ts` (new rows are appended).
2. **Pins that move, and when.** At go-live, and once more at the end of W11, one owner (W10) re-records, in one commit each:
   - `tests/meta/draftSnapshot.json` (only its odd seeds, the Expeditions, may differ: the commit's diff shows it);
   - `tools/expedition-baseline.json`, `expedition3-baseline.json`, `expedition4-baseline.json` and `expedition4-baseline-{A,B,C,SA,SB,SC,OA,OB,OC}.json` (the tests that replay their first runs, `expedition2Pin`, `movement3Handoff`, `finaleHandoff`, `rosterHandoff` and `rosterInvariance`, then pass unchanged);
   - the two- and three-Movement map fingerprints in `tests/meta/expedition2Pin.test.ts` and `expedition3Pin.test.ts` (new Movement II and III events change those maps), and any other fingerprint of a map with more than one Movement that a grep for `generateMap(` in `tests/` finds;
   - `contentVersion` in `tests/sim/golden.json` (`npx tsx tools/update-golden.ts --write`; it must report no hash change);
   - the two position checks in `tests/content.test.ts` (`:589`, `CONTENT.motifs.at(-3)`; `:1328`, `CONTENT.relics.slice(-3)`), rewritten to find their entries by id.
   Nothing else may be re-recorded. The whole-run reports (`loadouts.ts --runs`, `pacing.ts --route expedition`, `deeds.ts --movements 4`, `brann-bands.ts` and `roster-bands.ts --runs`) move and are measured fresh under *Bands*.
3. **Triggers and hooks are inert by default.** Every hook starts with an early `if` on its own `Mods` field or optional state, on its own line beside the code it sits by; no shared expression is rewritten. A multiplier helper returns exactly 1 without its motif. New behaviour draws no random number on any existing path; a new draw (none is planned) would be taken only when its motif is held.
4. **The resolver accumulates.** W0 changes every motif case in `mods.ts:477-576` from `=` to `+=` (additive fields) or `*=` (multipliers). From `NO_MODS` (0 and 1) this is exact in IEEE doubles (0 + v = v, 1 × x = x), and no two existing motifs share a field, so every existing run resolves to the same mods. New motifs and relics then stack with old ones and with the Astrolabe. Where a field takes "the larger" (`empowerLinger`), the new case uses `Math.max`. Two limits on the refactor: the cases of motifs that feed an aura (Warm Hum, Second Verse, Glass Choir, and any other whose field is read in `combat/auras.ts` or `systems/field.ts`) are left exactly as they are, since nothing outside W7 shares their fields; and W0 proves the rest with a test that resolves every existing motif at every level, alone and in 200 random builds with relics, a Calling and an Astrolabe, and compares the result with a frozen copy of the pre-refactor resolver's output. `graceShieldPct` is assigned by the Overflowing Grace keystone after motifs resolve (`src/sim/astrolabe.ts:188-192`), so with the keystone its cap applies; the tables say so.
5. **How the phase proves nothing else moved: the masked replay.**
   - W0 freezes copies of every pin listed in rule 2 into `tests/fill/pre5g/` before anything changes.
   - W0's `tests/fill/masked.test.ts` replaces `src/content/index.ts` for the test (`vi.mock` with the real module, its `CONTENT` filtered to drop every id in `FILL_IDS`, the list `src/content/fill/index.ts` exports of everything this slice adds, and `CONTENT_VERSION` recomputed by a new exported `contentVersionOf(content)`). It then checks: the recomputed version equals the pre-W0 `contentVersion`; all 40 draftSnapshot seeds; the maps for seeds 1-40 on routes 2, 3 and 4; and the first Novice and first Skilled run of every Expedition baseline file, against the frozen copies.
   - This passes at W0 (no entries yet), at every content merge, at go-live and after tuning. Together with rule 1 (cells and Prelude untouched with the content live), it shows the only thing that moved a seeded run is the new pool content.
   - If `vi.mock` can't reach a module that reads the pools, W0 instead routes the run layer's pool reads through one pure accessor in `run.ts` and the test filters there. W0 records which in its hand-off.
6. **Expedition-only, before any draw.** `MotifDef.requires.expedition?: true` and `RelicDef.expedition?: true` are optional keys with no default, so existing content parses to the same JSON and `contentVersion` doesn't move at W0. `eligible` (`run.ts:2030`), `relicPool` (`:1663`) and `pactRelic` (`:1000`, which gains the run's route) drop them on a Prelude (`run.movements === 1`) before the RNG is touched, exactly where the Movement gate sits (`:1652-1660`). A carried Reliquary relic works on any route (only offers are gated). New events have `movement: 2` or `3`.
7. **Content is appended, in new files.** Each stream writes its entries in its own file under `src/content/fill/` (`silk.ts`, `aegis.ts`, `choir.ts`, `bond.ts`, `finale.ts`, `harmonies.ts`, `relics.ts`, `events.ts`); W0 creates them empty and concatenates them in `src/content/index.ts` **after** every existing list (motifs after Verdant Choir, relics after The First Score, boons after Mended Loom, events after the Mirror Pool), in the order of this doc's tables. No existing definition is edited. `m1Unchanged.test.ts`' content-shape checks (`:282-296`: no motif but Guard Strand has `requires.movement`; only the six listed relics have `movement`) stay as they are: new entries use `expedition`, never `movement`.
8. **"More" sources, counted by hand.** `tests/fill/moreSources.test.ts` holds a registry of every multiplicative source of hero damage and damage taken (Empower, each Calling's group and Crescendo, the Cue bonus, Heavy Score, Concert Pitch, Cutting Chorus on Razor Silk, Closed Circle, Iron Mask) and checks that no Calling with any one option per tier, plus every Harmony and relic that can be held with it, puts more than 4 on one stat. The heaviest new case: the Conductor with Concert Pitch stacks Empower, the Cue bonus, the Calling's group and Concert Pitch, which is 4. New non-Harmony motifs add into existing fields (`inFieldDamage`, `wardedDamage`, `partyDamageMult`) and create no new factor.
9. **Saves.** Profile v9 and run save v5 don't bump. Motif, relic, boon and event ids are strings the saves already hold. `EncounterStats` gains `triggers?: Record<string, number>`, and the run save's `StatsSchema` (`save.ts:137-178`, non-strict, which would drop an unknown key) gains it as optional. A run saved before go-live resumes and draws its next offers from the new pools; an offer already rolled keeps its options.
10. **Unlock Ranks.** New motifs, relics and events are not locked (`profile.ts:279`: "Everything not listed here is never locked"). Only W7's auras and ornaments are added to `UNLOCKS`, at the Ranks in W7's tables, appended in Rank order with the existing `aura()` and `ornament()` helpers.
11. **Names in code.** `window` never appears in content or sim code (rule above). Ids are snake_case and unique across motifs, relics, boons, talents, alternate Solos and Calling options (the bible's names that collide are renamed, decision 9).
12. **Shared files get call sites, not bodies** (5e rule 8). W0 owns every shared-file line this slice adds; the streams own their `src/sim/fill/*.ts` and `src/content/fill/*.ts` files and never edit a shared sim file. A stream that finds it needs another hook asks the orchestrator, and W0's owner adds the call site.

## Workstreams

**Order.** W0 starts once Phase 5f has merged (5f's streams edit `src/sim/mods.ts`, `src/meta/run.ts`, the bots and every presentation folder, and its tuning may still re-record its own three goldens), and lands first, alone, with every pin byte-identical (it adds no entries). Then W1-W6 author in parallel on disjoint files; W5 can author at once (this doc fixes every prerequisite id) and merges after W1-W4. W8, W9 and W10's tooling start once W0 and 5f's in-flight presentation and bot streams have merged (those files are being edited now). **Go-live** is one batch: W1-W6 and W10's pin re-record merge together, after which CI is green again. Until then, a content branch may fail only the seeded-run pins of rule 2, and its hand-off says so. W11 tunes after go-live; W12 reviews last. **W7 waits for your approval** and, if approved, starts after go-live; nothing waits for it.

| Stream | Owns (edits) | Reads only | Done when |
|---|---|---|---|
| **W0** foundations | `src/content/schema.ts` (the two `expedition` keys, the Harmony-prerequisite lint), `src/content/index.ts` (concatenation, `contentVersionOf`), `src/content/fill/index.ts` and the empty fill files; `src/meta/run.ts` (the gate, `pactRelic`'s route, N25's read), `src/meta/types.ts`, `src/meta/save.ts` (`triggers?`); `src/sim/mods.ts` (every new field and default, the accumulate refactor, dispatch to `src/sim/fill/*`), `state.ts`, `world.ts`, `events.ts` (`motifTriggered`, `needled`), `api.ts` (two lines), `systems/triggers.ts` (new), `sim/fill/threadContact.ts` (new), every call site N1-N30 and stub `src/sim/fill/*.ts`; `tests/fill/foundations.test.ts`, `tests/fill/masked.test.ts`, `tests/fill/pre5g/*`, `tests/fill/moreSources.test.ts`, `tests/sim/rosterInvariance.test.ts` (FORBIDDEN only) | everything else | every pin in rule 1 and rule 2 is byte-identical and `contentVersion` is unchanged; the masked test passes; the trigger interpreter has a test per event, condition and effect, run on fixture triggers; every new `Mods` field is listed with a default that does nothing; `git diff --stat` of the three aura files is empty |
| **W1** Silk and Choir motifs | `src/content/fill/silk.ts`, `fill/choir.ts`, `src/sim/fill/silk.ts`, `sim/fill/choir.ts` (the bodies of N1's damage, N2-N5 and N7-N9), `tests/fill/silk.test.ts`, `choir.test.ts` | everything else | the 17 entries parse and lint clean; one test per entry at each level from a staged state (its effect, its credit in the ledger, its absence without it); the masked test passes |
| **W2** Aegis motifs | `fill/aegis.ts`, `sim/fill/aegis.ts` (N6), `tests/fill/aegis.test.ts` | everything else | as W1, for 12 entries |
| **W3** Finale motifs | `fill/finale.ts`, `sim/fill/finale.ts` (N15, N15b, N16-N18), `tests/fill/finale.test.ts` | everything else | as W1, for 12; the HUD's and bots' Cue cost (`cueCostNow`) shows Opening Bars and Tempo Rubato |
| **W4** Bond motifs | `fill/bond.ts`, `sim/fill/bond.ts` (N10, N10b, N11-N14), `tests/fill/bond.test.ts` | everything else | as W1, for 12; each is offered only with its hero (a draft test per hero) |
| **W5** Harmonies | `fill/harmonies.ts`, `sim/fill/harmonies.ts` (N19-N23, and Cutting Chorus's and Spindle Lullaby's parts of N1), `tests/fill/harmonies.test.ts` | everything else | as W1, for 10; each is offered only once its prerequisites are owned; `moreSources.test.ts` passes |
| **W6** relics, boons, events | `fill/relics.ts`, `fill/events.ts` (with the two boons), `sim/fill/relics.ts` (N24-N30), `tests/fill/relics.test.ts`, `tests/fill/events.test.ts` | everything else | 18 relics with empowered values, 2 boons, 6 events parse and lint clean; a test per relic and per event choice; every event's first choice is one the harness can take |
| **W7** auras and ornaments (**needs your approval before it is built**) | `src/content/auras.ts`, `ornaments.ts`, `src/sim/combat/auras.ts`, `src/sim/systems/field.ts`, `src/sim/chords.ts`, the aura and ornament lines of `src/meta/profile.ts`, `fill/auraMotifs.ts`, `sim/fill/auraMotifs.ts`, the aura looks and sounds, `tests/fill/auras.test.ts` | everything else | each approved item as specified; the six existing auras' definitions parse to the same JSON (keys added optional, no default) and every existing aura's effect on a staged tick is identical; every pin in rule 1 byte-identical |
| **W8** UI | `src/ui/**` (draft screen Harmony hints, Codex pages, relic bar, event screen, `motifTriggered` chips and Result lines, 18 relic glyphs and 6 event icons in `kit/iconPaths.ts`), `tests/colorVision.test.ts`, `tests/uiFill.test.ts` (new), `e2e/smoke.spec.ts` | `src/sim`, `src/content`, `src/meta`, `src/render`, `src/audio` | every new relic, boon and event shows its icon and its text from content (no copied number); the Codex lists every new entry; a draft offering a Harmony shows its prerequisites; the UI lab has a group for the fill |
| **W9** render and audio | `src/render/**`, `src/audio/**`, `tests/renderFill.test.ts`, `tests/audioFill.test.ts` (new) | everything else | Razor Silk's contact, Thread the Needle's catch and every trigger effect are shown through existing batches (no new draw call, pinned as 3e and 5e did); every new sound is in D dorian under the mix's limits; the Spire and Rift snapshots are unchanged |
| **W10** bots, harness, pins | `tools/harness-core.ts` (`playRun` options `draftPrefer` and `relicPrefer`, absent = today's first option; `ledger.triggers` tallies), `tools/builds.ts` (new), `tools/motifs.ts` (new, `tools/relics.ts`' shape for motifs), `tools/relics.ts` (new rows), `src/bots/**` (reading `cueCostNow`; no new rule unless an ablation shows a misplay), `tests/harnessTools.test.ts`, and at go-live and after W11 the rule-2 pin files | everything else | the go-live commit re-records exactly rule 2's files and its diff shows only odd draftSnapshot seeds changed; the masked test and every rule-1 pin pass on it; the new tools print their tables at `--seeds 2` in the test |
| **W11** tuning | the values of this slice's entries in `src/content/fill/*.ts`; trigger `every` and `perFight`; a *Tuning* section appended to this doc; the final rule-2 re-record (through W10) | everything else | every band met on all three sets, or listed as missed with its cause for your decision; no existing number moved (`git diff` of every non-fill content file is empty) |
| **W12** review | nothing (a report appended by the orchestrator) | everything | the report lists each finding with a file and line; each is fixed with a regression test by the stream that owns the file, or accepted by you |

**Guards on every merge:** content lint (`CONTENT` parses at load, `src/content/index.ts:74`, and `tests/content.test.ts`); `tests/fill/masked.test.ts`; `m1Unchanged.test.ts`; `tools/m1-baseline.ts --check` for each Movement; vitest, typecheck and lint.

## Bands

**Protocol** (5c-5f): cells 50 seeds on each of 1000, 500003 and 777001, on each Movement's kit; whole Finale-route Expeditions 200 seeds on each of 2000, 900007 and 333003 (30 a set for the preset and archetype reports). A band is met only on all three sets. Tune on two; read the third (777001, 333003) only at the end. Everything is at Dissonance 0.

| Measure | Tool | Reference | Band |
|---|---|---|---|
| Each new motif at L1 and L3, on its Movement's hard fights | `tools/motifs.ts --movement 2\|3\|4 --seeds 20` (new; the kit plus the motif against the kit alone) | the kit alone; the strongest existing motif of its rarity in the same report | Skilled win no lower than the kit − 3 points, and no higher than the strongest existing motif of its rarity + 3. A motif the bots can't use (Razor Silk's aim, for one) is named, not tuned |
| Each new relic | `tools/relics.ts --movement 2\|3\|4 --seeds 20` | the no-relic row; the strongest existing relic of its rarity | the same; a cursed relic within ±5 of the no-relic row |
| Trigger fire rates | `ledger.triggers` tallies in the motif and relic reports | — | every trigger-based entry fires in at least half the fights it is held in (reported per entry) |
| Whole Finale-route Expeditions, default party | `tools/harness.ts --run --movements 4 --seeds 200` | Skilled won ≥ 55%, reached the Finale ≥ 65%, won ÷ reached ≥ 80%; Novice won 1-6%, won ÷ reached 15-40% (docs/phase-5d.md:784) | the same bands |
| Roster parties, whole runs | `tools/roster-bands.ts --runs --movements 4`, `brann-bands.ts --runs --movements 4` | 5e's and 5b's bands | the same bands |
| Pacing | `tools/pacing.ts --players 16 --hours 3 --route expedition`, bases 9001 and 77003 | 39.6 and 39.4 minutes (docs/phase-5d.md:1156-1157) | average ≤ 40 |
| Five viable presets | `tools/loadouts.ts --movement 4 --seeds 50 --runs 30 --bots skilled --sets` | 5 of 6 (docs/phase-5d.md:1139-1150) | ≥ 5 of 6 presets with whole Finale-route Expeditions ≥ 50% and the Silent Conductor cell ≥ 80% (the cell can't move) |
| Five viable archetypes | `tools/builds.ts --runs 30 --sets` (new: each of the six builds, Skilled, `draftPrefer` its list) | — | ≥ 5 of 6 builds win ≥ 50% of whole Finale-route Expeditions on all three sets; each holds ≥ 3 of its listed motifs by the Finale in ≥ 60% of its runs; no build wins more than 15 points above the median build |
| The Calling reports | `tools/callings.ts` (Prelude, and `--cells`) | the pre-W0 report | byte-equal |
| The meta cap | `tools/reliquary.ts --power --seeds 400` with a new set of the three strongest new relics carried | +30% (02 §9) | within +30% |
| Performance | `npm run sim:bench -- --check` | the budget (docs/plan/05 §12) | under budget, with Razor Silk and ten triggers held at the Unweaver's peak |
| "More" sources | `tests/fill/moreSources.test.ts` | — | ≤ 4 a stat |

**What the bots can't show.** The bots don't aim the Thread across enemies, so Razor Silk and the entries on it read low in cells; the RL archetype measures them in whole runs, where the Thread crosses packs by chance. The bots don't time retargets to telegraphs, so Thread the Needle and Concert Pitch fire rarely; they are tuned on their fire rate and the PP archetype. Breath Between's discount depends on pacing the Skilled bot doesn't attempt.

**Levers, in order** (this slice's own numbers only; never an existing one):

1. Each entry's values (motif levels, relic values, boon values).
2. Trigger limits (`every`, `perFight`).
3. Rarity (moving an entry between pools changes how often it is offered).
4. Cutting an entry, listed for your decision with its measurement.

## Exit criteria

| # | Criterion | Checked by |
|---|---|---|
| 1 | Every pin in ground rule 1 is byte-identical; `SIM_VERSION` is 22; only the pins in rule 2 moved, each in one commit | `m1Unchanged.test.ts`, the `--check` tools, the snapshot tests, the reports against the pre-W0 ones, the go-live and final commits' diffs |
| 2 | The masked replay passes: with this slice's entries removed, every rule-2 pin equals its frozen pre-5g copy and `contentVersion` equals the pre-W0 one | `tests/fill/masked.test.ts` |
| 3 | Counts: motifs 84 and Harmonies 11, relics 39, events 16 (with W7: auras 10, ornaments 10, motifs 90, Harmonies 12, relics 40); every other category unchanged | `tests/fill/foundations.test.ts` counts `CONTENT` |
| 4 | Content lint is clean: `CONTENT` parses, `tests/content.test.ts` and the fill tests pass, every Harmony prerequisite names a motif, `moreSources.test.ts` passes | vitest |
| 5 | No aura definition, number, reach or look changed outside an approved W7 item; without W7 the three aura files are untouched | `git diff --stat`, W12 |
| 6 | No existing number moved: the Weaver's, every aura's, enemy's, encounter's, Movement's and road's, the heroes', Kael's, Lyra's, Vexis's and Brann's included | `git diff` of every content file outside `src/content/fill/` (W7's approved additions aside), W12 |
| 7 | Every band under *Bands* is met on all three sets, or listed as missed with its cause for your decision; at least 5 of 6 presets and 5 of 6 archetypes are viable | W11's *Tuning* section |
| 8 | Every new entry's text comes from its content values; every relic, boon and event has its icon; the Codex shows every entry; colours pass every colour-vision mode | W8's tests, `tests/colorVision.test.ts` |
| 9 | Vitest, typecheck and lint green; e2e green, or recorded "not run" with the reason | CI, the hand-offs |

## Out of scope

- Dissonance levels 13-15 (Phase 6).
- Any new hero, Calling, enemy, affix, mini-boss, boss, encounter, arena or technique variant (all at count).
- A second Thread (*Twin Spindle*), and a ghost-Weaver enemy for *Lost Weaver's Echo* (decision 10).
- A `bondXp` event effect, a guaranteed-Harmony draft effect, or any new event effect kind.
- New event nodes, map rows or road rows (never-moved numbers).
- New Chord presets, and any change to the presets' Chords.
- New Deeds, titles, mastery rewards or Starlight prices.
- New bot rules beyond reading `cueCostNow`, unless an ablation in `tools/verbs.ts` shows a misplay.
- Changing the draft's rarity odds or offer sizes.
- A content lint that reads modifier buckets from content (rule 8 counts by hand instead).
- The 02 §12 rule-8 build-diversity sampler (500 random legal builds); the archetype and preset reports stand in for it here.
- Music and art passes for the new content beyond the sounds and VFX in W9.

## Tuning

W11 tuned this slice's entries against *Bands*, in the levers' order, on the tuning sets (cells 1000 and 500003, whole runs 2000 and 900007) and read the held-out sets (cells 777001, runs 333003) only once the numbers were final. Every reading below names its report file in `/home/user/aw-work/5g/tune/` (the scratch folder of the tuning); `LOG.md` there records each step in order. "Read at N" means a band was read at a smaller size than the protocol's and is not claimed as met.

**The protocol as run.**

- *Screen* (numbers as merged, `c18ccb0`): every motif at L1 and L3 on each Movement's hard fights, Skilled, 10 seeds (Movement II on cell bases 1000 and 500003, III and IV on 1000), and every relic the same way on 1000, through scratch copies of `tools/motifs.ts` and `tools/relics.ts` that take a cell seed base (`scr/motifs-set.ts`, `scr/relics-set.ts`; at base 5000 they are the tools); the six builds at 10 and then 30 runs on runs 2000 and 900007.
- *Tune*: A/B runs of one build or one cell at a time (`scr/exp.ts`: a build with its draft and relic lists switched on or off; 60 runs on each tuning set for every decision; cells at 20 seeds on both tuning bases).
- *Final readings* (numbers `b2eccfd`): the builds report `tools/builds.ts --runs 30 --sets` and the presets report `tools/loadouts.ts --movement 4 --seeds 50 --runs 30 --bots skilled --sets` at the protocol's size on all three sets; the rest as listed under *The bands*.

### What moved

| Where | Entry | Number | Before | After | Lever | The reading that drove it |
|---|---|---|---|---|---|---|
| `src/content/fill/choir.ts` | Long Phrase | values (L1 / L2 / L3) | 8 / 12 / 16 | 15 / 20 / 25 | 1 | CS, 60 runs on each tuning set: 58/120 won (48%) → 72/120 (60%) (`exp-cs-v1-r60-*`, `exp-cs-v2d-r60-*`) |
| `src/content/fill/relics.ts` | Iron Mask | `pct` (empowered) | 15 (20) | 12 (18) | 1 | the cursed band (±5 of no relic): +4 / +6 at Movement II, +3 / +2 at III, +15 / +10 at the Silent Conductor at 15; +1 / +4, −3 / −5, +10 / −15 at 12 (20 seeds, cell bases 1000 / 500003; `cursed-s20-*`) |
| `tools/harness-core.ts` | the harness merchant | — | ignored `draftPrefer` for motifs | buys the motif a draft list names nearest its front first, before a preferred relic; no list (or a function, or nothing named on the cloth): as before | the bots digest's named next lever | its test in `tests/harnessTools.test.ts` ("buys a motif the draft list names first at a merchant") |

Nothing else moved: no trigger limit (`every`, `perFight`) and no rarity. Their texts read the new values (Long Phrase "Your Spirit is 15% larger.", Iron Mask "take 12% less damage"); `tests/fill/relics.test.ts`' empowered literal for Iron Mask moved 20 → 18 and nothing else in `tests/fill/` pins either number. No aura, ornament, existing entry, hero, enemy, encounter, Calling, technique, Weaver, Movement or road number moved, and no bot rule was added (`src/bots/**` is untouched).

**Why Long Phrase.** The CS preset fills Third Voice with Fermata, which (with the Grace Note moved onto it) makes the field song reserve 82.5% of the Weaver's Spirit. That leaves 17.5 free Spirit, under a Ward's 20 (`src/content/weaver.ts`): the Weaver can't Ward until Long Phrase reaches L3. At 15% its first level makes the free pool 20.1. Split apart (`exp-cs-v1-*`, 30 runs a set): CS's frame with Fermata and no lists won 12/30 and 12/30, with its draft list 17 and 15, with its relic list 12 and 14, with both 18 and 14; the two-aura CS that `frames.mts` first measured (the harness's own fill finds no third aura within its 75% reserve cap and keeps two) won 23 and 21. So CS's weakness is its third aura, and its draft list is worth about 10 points.

### Tried and not kept

| Change | Reading (60 runs on each tuning set unless named) | Why not |
|---|---|---|
| Close Harmony 20 / 30 / 40 → 30 / 45 / 60 (with Long Phrase) | CS 71/120 against 72/120 with Long Phrase alone | adds nothing |
| Massed Voices 6 / 9 / 12 → 9 / 13 / 18 and Full Chord 2 / 3 / 4 → 3 / 4 / 5 (with both above) | CS 69/120 | adds nothing |
| Long Phrase 20 / 28 / 36 | CS 73/120 | no more than 15 / 20 / 25 |
| Full Chord, Breath Between and Stray Stitch rare → common (lever 3) | CS 40/60 (30 a set), listed motifs held 1.8 / 2.1 against 1.8 / 2.2 | about 43 commons share the common rolls, so holding doesn't rise |
| Thread the Needle epic → rare (lever 3) | default party won 86/120 against 82/120; Harmonies held 0.26 a run either way; PP won 111/120 against 114/120 and held ≥ 3 listed in 58/120 (48%) against 86/120 (72%) | costs PP its holding band and gains nothing measurable (`offers-*`, `exp-pp-*`) |
| Razor Silk 30 / 50 / 70 → 50 / 80 / 110 | RL 66/120 against 67/120 | no effect: RL's rate is its frame (no Calling, All In; 47 / 73% with no lists at 30 runs) |
| Iron Mask 10 (15) and 7 (10) | M2 / M3 / M4 avg Δ win at 10: +5, −7, 0 / +4, −7, −20; at 7: −3, −7, −5 / +5, −13, −15 | under the band on more readings than 12 |

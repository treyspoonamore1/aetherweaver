# Phase 5c: Movement III, the Unstitched (VFX and audio)

Movement III (see [Phase 5c](../phase-5c.md)) takes the run down into the **Abyssal Rift**. This
page covers how it looks: the Rift's arenas, the Unstitched bodies, and every cut, zone, status,
mirror and boss cue. How it sounds (the Abyss voicing, the Unweaver's stems, the Unstitched
sounds) is under [Audio](#audio).

**What it reads.** Render reads only the contract's state and events (docs/phase-5c.md,
contracts): `ArenaDef.biome`; `EnemyDef.material` and `tether`; `AttackDef.cut`, `zone`,
`linkStatus` and `markStatus` (through the telegraph's `attackId`); the statuses `possessed` (its
`source`), `doubt`, `doom` (its `stacks`), `doomed`, `stitch`, `stitched` (its `source`),
`voided`, `unravelled` and `emboldened`; `field.zones`, `field.unravel` and `field.stolen`;
`enemy.tethered`, `enemy.mimic` and `enemy.emboldenedUntil`; the `mirror` shield; and the events
`threadSnapped.cause` / `lock`, `cutResolved`, `strandBlocked`, `possessed`, `freed`,
`mirrorCracked`, `mirrorWard`, `verseStolen`, `verseReturned`, `unravelled`, `zoneStarted` and
`spindled`. Its shared rules come from `src/sim/rules3.ts` (`threadSegment`,
`possessionVictim`, `mimicBeneficiary`, `suppressRadiusOf`, `weaverSilenced`), so render never
disagrees with the sim. Nothing is in `src/sim`.

**What it leaves alone.** Every key it reads is absent in Movements I and II, so a Prelude or a
Spire fight is drawn exactly as before. `tests/renderSpireSnapshot.test.ts` (W0a) pins every
Reliquary and Spire arena's look, mood, meshes, geometry, shaders and floor painting, and every
Movement I and II model; `tests/renderMovement3.test.ts` checks that a First Light and a Crimson
Gate fight draw and play none of Movement III (`drawnM3` and `firedM3` stay zero) and keep no
new state. No new FX batches, draw calls or materials: the kit keeps its 12 batches; every new
look is a new *style* inside one of them.

## What changed

| File | Phase 5c work |
| --- | --- |
| `riftCues.ts` (new) | Pure helpers, tested in Node. `RIFT_HEX` (the semantic colours) and `ABYSS_HEX` (ambient); `RIFT_AFFIX_HEX` (content's affix colours, measured). `riftStatuses` (one read of a hero's Rift statuses), `riftAnswers` / `riftLabel`, `doomPipOffset`, `stitchedPairs` (heroes stitched by the same source). `cutOf`, `cutLabel`, `shearsCrossing` / `crossing` (where a cut line crosses the sim's own Thread segment). `zoneOf`, `inPull`, `isNeedle`, `isDoomMark`, `isStitch`. `emboldenedAt`, `isTetherDef`, `SPINDLED_LABEL`, `hovers`, `copyLabel`. |
| `crimsonCues.ts` | `arenaLook` and `arenaMood` become tables: `BIOME_LOOK` (`crimson_spire` → crimson, `abyssal_rift` → abyss) and `MOODS` by look, so the Finale's `celestial_crucible` is one row in each. The Reliquary and Spire rows are byte-identical (the W0a snapshot). `ABYSS_MOOD`. `materialOf` adds `cloth`. |
| `arena.ts` | `ArenaView` switches on `look`. The Rift swaps its pieces one for one: `createRiftFloor` (stitched indigo cloth panels over stone, dashed seams and cross-stitches in the line colour, its rim in the line colour, never the ambient teal), `createRiftRim` (floating broken slabs, bone stitches, torn hanging cloth; tall only on the far side), `buildRiftPillar`, `createRiftTears` (one additive card mesh in the torch slot) and `createFrays` (one Points of drifting thread motes in the ember slot). |
| `models/library.ts` | `buildUnstitched` runs before the role fallback: Shears, the Void Maw, the Doubt Wraith, the Null Priest, the Mimic, the Spindle, the Stolen Verse, the Hollow Champion, the Seamstress and the Unweaver. `buildRiftPillar`. Primitives only. |
| `entities.ts` | The per-entity Mute dome from `suppressRadiusOf` (a Silencing elite carries its 7 m dome); the rim priority gains possessed above threaded; the hover gait; the Maw's breath; Rift crown gems; the `rift()` pass (possession, Doom, doomed, stitched, drag, the rune lock, Emboldened, plating) and `riftScene()` (sewn pairs, Spindle tethers, the champion's mirror Thread); the `mirror` shield; the Stolen Verse's tint. `drawnM3` counters; `stolenOverride` and `forget` for the lab. |
| `telegraphs.ts` | Cut lines dotted, with the scissors where they cross the live Thread; the Unpick's ripple along the Thread; zone tells (the Inhale's tightening swirl, the rune closing); the Mimic's mirror cast and its copied glyph; the Stitch's cross-stitched link; falling needles; Doom's ignition mark; answer badges over heroes a Rift status holds. `drawnM3` counters. |
| `thread.ts` | Unravel: a near-black core, lethal barbs, lethal beads rushing forward and a minus glyph (`unravelOverride` for the lab). A cut's frayed stub and its lock ring at her hand (`cut()`, `clearCut()`). `drawnM3` counters. |
| `field.ts` | `field.zones`: the pull's swirl and its inward motes, the rune's bone ring of glyphs. A stolen aura's band drawn hollow and its slot a dashed ring. `zoneOverride` and `stolenOverride` (lab). `drawnM3` counters. |
| `feedback.ts` | CUT / UNPICKED in the fray (the range snap keeps the grey SNAPPED); Guard Strand's silk spark; POSSESSED, the glass of a free; MIRROR CRACKED; MIRROR WARD; the verse torn out and poured back; UNRAVEL; zones laid; the Spindled `−80%`; cloth deaths; Unravel's ticks as damage numbers in the live lethal colour, counted (`firedM3.unravelTicks`) only for a `tick` from `field.unravel.source` on the threaded hero. `firedM3` counters. |
| `astrolabe.ts` | The dome-meets-field shimmer reads `suppressRadiusOf` (a Silencing elite's dome too). |
| `fx/sprites.ts` | `SPRITE.scissors`, `doomPip`, `mask`, `rune`, `mirror`, `needle`; `SPRITE.mode`'s `MODE_MINUS` (Unravel). |
| `fx/rings.ts` | `RING.rune` (a band with a ring of glyphs) and `RING.swirl` (spiral arms turning in or out). |
| `fx/beams.ts` | `BEAM.stitch` (a row of cross-stitches). |
| `fx/shells.ts` | `SHELL.mirrorWard` (the Ward's hexes inside out: lit cells, a facing sheen, a glint). |
| `lab/VfxLab.tsx` | **Phase 5c · Movement III** group, `UNSTITCHED_SCENARIOS`, the `gallery3` preset, Movement III encounters, the zone, Unravel and stolen-aura overrides and the `window.__VFX__` hooks (below). |
| `tests/renderMovement3.test.ts` (new), `tests/colorVision.test.ts` | Tests (below). |

## The Abyssal Rift

| | Crimson Spire | Abyssal Rift |
| --- | --- | --- |
| Sky (hemisphere) | `#3a1416` at 0.55 | `#1b1a3a` at 0.5 |
| Key light | torch `#ffb27a` at 1.6 | a pale, warm moon `#e6e1cf` at 1.5 |
| Rim light | crimson `#9e2a33` at 0.6 | cold blue-teal `#346782` at 0.42, from the far side (the rim light at (-12, 10, -16)) |
| Fog | `#1c0f10`, 38 to 84 m | `#0a0a1c`, 34 to 80 m |
| Floor | iron plates, blood channels, brass inlay | stitched indigo cloth panels over stone, dashed seams and cross-stitches in the line colour `#5c5a86` |
| Perimeter | obsidian ramparts, banners, braziers, chains | floating broken slabs, bone stitches, torn hanging cloth, stone shards and cloth scraps |
| Pillars | obsidian spires | a broken slab stitched back together with bone thread, cloth round its foot |
| Air | torch cards, 320 rising embers | rift tears (jagged slits of cold light behind the far slabs), 280 drifting thread motes toward the rim |

**Teal is Mend.** The design's first picks were measured and moved:

- the moon `#cdd8f5` sat ΔE 3.8 from shield under deuteranopia (every hero it lit would look
  Warded): a warm pale moon `#e6e1cf` instead;
- the rim `#3c6f8a` sat 18.4 from Mend under tritanopia: `#346782`, at 0.42;
- the fray teal `#1f6f6a` sat 18.1 from Mend under tritanopia: `#176762`, and only in the motes
  near the rim;
- the floor's rim ring takes the line colour, not the theme's ambient teal accent, so content's
  Rift `theme.accent` (`#1f6f6a`, `src/content/unstitchedRun.ts`) is drawn nowhere in the Rift
  (render's pillars and mood take their own colours). Content keeps it; docs/phase-5c.md says so.

Every `ABYSS_HEX` entry is ≥ 20 ΔE from Mend, heal and shield in every vision
(`tests/colorVision.test.ts`). The floor is darkened ×0.78, no lighter than the Spire's, and
the violet ailment telegraphs clear it by ≥ 40 L* in every vision (lethal and threat by ≥ 25):
the lightness check in `tests/renderMovement3.test.ts`. On **Low** quality the tears and frays
hide, as the god rays and dust do. The mesh budget holds: 7 with pillars, 6 without.

## The Unstitched

Void cloth (`#2a2547`) with bone seams (`#e8e3c8`), an accent each; every body is its own, never
a role's fallback, and all ten are distinct (`tests/renderMovement3.test.ts`).

| Body | Silhouette | Motion |
| --- | --- | --- |
| Shears | low, hunched cloth behind two crossed steel blades and a bone pivot | walks |
| Void Maw | a mouth in the floor: a torus lip, a dark throat, twelve bone teeth leaning in | swells through the Inhale's tell, gulps while its pull holds |
| Doubt Wraith | a tall legless cloak, a ragged hem, a hollow hood with a cold glow | drifts (hover) |
| Null Priest | robed and hooded, a turning halo of rune tabs, a closed book | drifts |
| Mimic | a tall faceted mirror (two octahedra), four facets round it | drifts |
| Spindle | a lathe spindle wrapped in bone thread | stands |
| Stolen Verse | a small orb of song with two bone rings; its rim takes the stolen aura's colour | drifts |
| Hollow Champion | a hollow knight of cloth, mirror pauldrons, a long mirror blade | walks |
| The Seamstress | a narrow robed body, six arms ending in bone needles, a spool on her back | walks |
| The Unweaver | tall and hooded, a crown of bone spindles, a great pair of shears crossed before it | drifts |

**Cloth deaths** unravel: bone and accent strands whipping off, fray motes drifting down, indigo
smoke where it stood, a dashed ring. Never a red mist, never porcelain shards.

## Statuses, cuts, zones and boss cues

| Mechanic | What it looks like |
| --- | --- |
| Shears, Snip | the line's centre dotted in threat (lethal when lethal); the **scissors** in the fray colour where it crosses the live Thread, with a ring, pulsing (`shearsCrossing`, the sim's own segment) |
| A cut | the Thread bursts into strands; **CUT** (UNPICKED for the Unpick) in the fray `#fecdd3`, not the grey SNAPPED (which stays for the range snap); a frayed stub at her hand and a lock ring counting `threadLock` down |
| Guard Strand | a silk spark (`#fde2c4`) where the line crossed the Thread (`cutResolved 'strand'`), and on a bolt it destroyed (`strandBlocked`) |
| The Unpick | the raid's bar, and a ripple of snaps running along the Thread |
| Void Maw's Inhale | the tell: a swirl at its reach whose arms speed up as an inner ring tightens; the pull: a swirl turning inward, motes drawn in from its rim, drag streaks on everyone inside |
| The Null rune | the tell: a ring of glyphs closing on her feet; the zone: a bone ring of glyphs turning slowly (never the Mute's dashed glass), a rune lock over her head while she stands in it |
| Possession | an indigo rim (`#4b3fb8`) ranked above the Thread's, a cracked mask, a dashed indigo tether from the Wraith, a lash streaking to the ally it strikes every 0.5 s (`possessionVictim`); Chime and Focus over the head; POSSESSED; glass when freed. Never enemy-bar red, never Focus gold |
| Doom | `DOOM_AT` pips (content's `burst.at`, five today: `doomIgnitionAt` reads it) on the bleed arc, filling as it stacks, lethal from four with Chime and Ward over the head; the ignition is a mark ringed in five lethal pips; a doomed hero glows lethal |
| Stitch | a cross-stitched link in bone (never the threat dashes); then a bone cross-stitch tether between the pair stitched by the same source (`stitchedPairs`), a dashed ring at each one's feet, Chime and Reel over each |
| Needle Rain | plain circles, a needle falling point-first onto each |
| The Mimic | a mirror shimmer from it to its beneficiary (`mimicBeneficiary`), a mirror over them and **Mirror · Ward** (or Chime, Empower) with that glyph; a copied Ward is a `mirrorWard` shell in mirror silver `#c8c4b8`; Emboldened is a mirror shimmer (orbiting panes, a mirror tint through the rim), never gold; MIRROR CRACKED is a burst of glass |
| Unravel | the Thread's core near-black (`#0f0b1a`) in a lethal halo, lethal barbs hooked along it, lethal beads rushing *forward* (Bear's flow runs back: never this), the glyph a minus; UNRAVEL; its ticks land as damage numbers in the live lethal colour (each colour-vision palette's own), never the fixed party rose and never heal teal. Empower, Bear and Stasis show your own Thread |
| Spindles | a dashed bone tether from each to the boss, its plating (a `mirrorWard` shell in the Spindle's bone `#d9c7a0`) while `tethered > 0`; `−80%` when one of your hits is cut down |
| Steal Verse | the aura torn out of her ring into the Verse; its band in the field drawn dark and its slot a dashed ring in its colour; the Verse in its colour; struck down, the aura pours back to her in notes and a ring |
| The champion | a mirror Thread (a lance and a glow) from the Unweaver to it; MIRROR WARD and its shell |
| Silencing | the Mute's cracked-glass dome at the elite's own 7 m (`suppressRadiusOf`) |
| Rift affixes | a shaped gem at the crown's peak: scissors (Severing), a rune (Silencing), a mirror (Mimicking), a Doom pip (Doom-touched): close colours told apart by shape |

## Colour

The new semantic colours (`RIFT_HEX`), measured with the repo's own `deltaE` and
`simulateVision`; each is ≥ 20 ΔE from lethal, threat, the Martyr's Bear, Mend and Empower in
every vision:

| Colour | Hex | Lowest ΔE (vision, against) |
| --- | --- | --- |
| possess | `#4b3fb8` | 35.8 (tritanopia, Mend) |
| unravel (core) | `#0f0b1a` | 26.8 (protanopia, Bear) |
| rune, stitch (bone) | `#e8e3c8` | 40.5 (tritanopia, threat) |
| mirror | `#c8c4b8` | 38.5 (protanopia, Mend); also ≥ 20 from shield |
| swirl | `#7c6fe0` | 24.9 (deuteranopia, Mend) |
| fray | `#fecdd3` | 24.9 (tritanopia, threat) |
| strand | `#fde2c4` | 34.1 (tritanopia, threat) |
| spindle | `#d9c7a0` | 30.2 (tritanopia, threat) |

Bone sits near the Weaver's gold and Lyra under tritanopia (14.6): the rune and the stitch are
shape-coded (glyphs, cross-stitches). Doom, Doubt and the stitch link draw in the live ailment
violet, lethal at four Doom stacks: not new colours. The affix colours are content's (Severing
`#f8fafc`, Silencing `#2563eb`, Mimicking `#e0e7ff`, Doom-touched `#5b21b6`), each ≥ 20 from
ailment, lethal, threat, Mend, heal, Empower and Bear in every vision. Every hero is measured
against the Unstitched bodies and accents and the Abyss's ambient set (the Movement II pattern).

## The VFX lab

`?lab=vfx` has a **Phase 5c · Movement III** group. Each scenario restarts the real sim on a Rift
floor and stages one Movement III visual with real spawns and commands. Where the sim doesn't
produce a mechanic yet (W1, W2 and W3 land it), a lab stand-in puts it in place a moment later,
only if the sim hasn't; `unstitchedStats().standIns` names every one used. Zones, Unravel and a
stolen aura are the views' overrides, never written into the sim.

| Scenario | What it shows |
| --- | --- |
| Gallery · the Unstitched | all ten bodies side by side (`gallery3`) |
| Shears · the cut line | the dotted line, the scissors on the Thread, then CUT, the stub and its 1 s lock |
| Unweaver · Snip | the long dotted line, CUT, a 3 s lock ring |
| Seamstress · Unpick | the raid and its ripple along the Thread, then UNPICKED |
| Guard Strand · turned aside | the silk spark, the Thread held |
| Void Maw · Inhale | the tightening tell, then the inward swirl and drag streaks |
| Doubt Wraith · possession | the 4 s mark, then the rim, mask, tether, lash and badge |
| Null Priest · rune | the closing rune, then the rune ring and the lock over her |
| Mimic · mirror | the shimmer, Mirror · Ward, then the mirrored shell |
| Mimic · cracked | MIRROR CRACKED |
| Doom-touched · pips | pips one to five, lethal at four, then the ignition mark |
| Seamstress · Stitch | the cross-stitched link, then the sewn pair |
| Seamstress · Needle Rain | three circles, three needles |
| Unweaver · Spindles | tethers and plating |
| Unweaver · Unravel | the turned Thread, then Empower |
| Unweaver · Steal Verse | the hollow slot, the Verse in its colour, the pour back |
| Unweaver · Mirror Weave | the mirror Thread, Emboldened, the Mirror Ward |
| Silencing · its dome | the dome at 7 m, the rune gem |
| Cloth deaths | three Shears unravel beside a porcelain chorister |

`window.__VFX__` adds `unstitchedScenarios()`, `unstitchedScenario(name)`, `unstitchedStats()`
(what was drawn and played, the zones, Unravel, the stolen aura, the stand-ins, heroes, enemies
and the Weaver), `setZones(zones | null)`, `setUnravel(on | null)` and
`setStolen({chord, aura} | null)`. The group also has an Unstitched gallery button and the zone,
Unravel and stolen-aura toggles.

## Tests

`tests/renderMovement3.test.ts` (each drives a real headless sim through the real views over a
real FxKit):

- the look and mood tables keep every Reliquary and Spire row; a First Light fight and a Crimson
  Gate fight draw and play no Movement III cue and keep no new field key;
- every Rift arena's mood and its 7 / 6 meshes; the tears and frays hide on Low;
- the floor-vs-telegraph lightness check, in every vision;
- every Unstitched body its own and distinct; cloth deaths;
- possession, Doom, the stitch, cuts (the scissors only where a line crosses the Thread; CUT,
  UNPICKED and SNAPPED; the stub; Guard Strand), zones, Unravel (and Stasis), a stolen aura and
  its pour, mirrors, the Mimic's cast, Spindles, the champion, a Silencing dome and its gem;
- the budget on Low, Medium and High: a busy Unweaver scene with every Movement III cue up keeps
  12 batches and every batch's peak under its capacity, particles under the tier's cap.

`tests/colorVision.test.ts`: `RIFT_HEX` ≥ 20 ΔE from lethal, threat, Bear, Mend and Empower in
every vision; `ABYSS_HEX` never within 20 of Mend, heal or shield; the mood ties to the ambient
set; the four affix colours; every hero against the Movement III environment.

## Known gaps

- The lab still stands in for what a scenario's own fight hasn't produced yet
  (`unstitchedStats().standIns` lists each); with the sim merged, the stand-ins should come back
  empty for every scenario the sim plays out, which is a check for the browser lab.
- The Mimic's copied glyph rides the cast's badge over its beneficiary; the cast bar's own icon
  is the HUD's (W8).
- A Pedal Point stake inside a rune keeps singing (the rune never touches auras); its edge is not
  drawn where it meets a planted field.

## Audio

**What it reads.** Audio reads the same contract as render: `ArenaDef.biome` (through the
director's `setBiome`); the telegraph's `attackId`; the statuses `possessed`, `doom` (its
`stacks`), `doomed` and `stitched` on `statusApplied`; `field.stolen` and `field.unravel` (the
stems); `enemy.mimic.copy` at `telegraphStarted` (the Mimic's cast); and the events
`threadSnapped.cause` / `lock`, `cutResolved` (`strand`), `strandBlocked`, `zoneStarted` /
`zoneEnded`, `possessed`, `freed`, `mirrorCracked`, `verseStolen`, `verseReturned`,
`unravelled`, `mirrorWard`, `spindled`, `tethered`, `techniqueRejected` (reason `silenced`) and
`relicTriggered` for the three Rift relics. Nothing is in `src/sim`.

**What it leaves alone.** The Sunlit Reliquary and the Crimson Spire sound exactly as before:
`tests/audioSpireSnapshot.test.ts` (W0a) pins their every mood, every Movement I and II fight and
every sound-board button, and `tests/audioPhase5c.test.ts` checks a sample of the same table and
that no Movement I or II fight plays a Phase 5c sound. Fermata's `hold()` is untouched: the Grand
Silence belongs to the Finale.

### What changed

| File | Phase 5c work |
| --- | --- |
| `theory.ts` | `PROGRESSION_ABYSS` (Dsus2–Em7–Bø7–Am7, twice), `PROGRESSION_ABYSS_BOSS` (the open tonic held, the half-diminished pulled at twice) and `MELODY_ABYSS`, all in D dorian at 88 BPM. |
| `music.ts` | A per-biome voicing table (`BiomeVoicing`: progressions, pad cutoffs, pad, choir, a per-step pulse, melody and ambience, stem rules) replaces the Spire's getter and `progressionFor(mood, crimson)`. The Spire's row is its Phase 5a voicing, call for call; the Reliquary is the default and has no row. `VOICED_BIOMES` and `voicedBiome()`: a biome with no voicing (a later slice's) is voiced as the Reliquary. `ABYSS_CUT`; the Rift's pad, pulse, melody, choir and ambience; the Unweaver's stems and the Seamstress's pickup. `MusicInputs` gains optional `stolen` and `unravel`. |
| `director.ts` | `setBiome` takes any `Biome` and voices it through `voicedBiome()`. |
| `sfx.ts` | `UNSTITCHED_SOUND_GROUPS`, `UNSTITCHED_SOUND_LIMITS` and `UNSTITCHED_ATTACK_SOUNDS` (the Legion pattern); the cut by cause; Guard Strand's ping; the Rift's status voices; the zone drones; the 'silenced' refusal; the Mimic's copy and crack; the boss sounds; the cloth kill; the wind styles `taut` and `invert`; the three Rift relics in `RELIC_SOUND_GROUPS`. |
| `types.ts` | Doc comments only. |
| `lab/AudioLab.tsx`, `lab/soundBoard.ts`, `lab/offline.ts` | An Abyssal Rift biome row, a boss-phase selector with mini-boss, verse-stolen and Unravel toggles, `ABYSS_AUDITS` in the mood audit and `window.__audioLab.pitchAbyss()`, `renderMood` scenes, an `unstitched` sound group with a cloth kill per enemy, and a button per Rift relic. |
| `tests/audioPhase5c.test.ts` (new) | Tests (below). |

### The Abyss

D dorian at 88 BPM, as everywhere, so a biome change lands on the next bar and nothing retunes.

- **Progressions.** The map and the fights loop Dsus2–Em7–Bø7–Am7: open and suspended (no third
  on the tonic), with the dorian's own half-diminished in the middle. The boss loop holds the
  open tonic and pulls at the half-diminished twice, with no rest.
- **Pad.** A glass harmonica, its cutoffs a touch brighter than the Spire's (`ABYSS_CUT`: map
  1100 Hz, calm 1200, combat 1500, boss 900).
- **Pulse.** Needle ticks tuned to the key, on D6 and A5, over a soft thud on D2 and A1 (the
  Spire's tom pitches).
- **Melody.** `MELODY_ABYSS` on a detuned plucked string, picking at the chord's open fifths and
  seconds, with long gaps for the needle ticks.
- **Choir.** A thin, high choir on the choir stem.
- **Ambience.** A void-wind bed with distant tearing (a fixed sequence, so it is deterministic in
  the offline renders), on the ambience bus and only in the Rift's moods.

### The Unweaver's and the Seamstress's stems

On `bossPhase` and `apex`, read from `field.stolen` / `field.unravel` or from their events (the
lab, which has no `field.stolen`, drives them through the events):

- **Steal Verse (phase 2).** The choir stem drops while a verse is stolen, and a change re-levels
  on the next beat; it comes back with the verse (`verseReturned`), and never outlasts the
  theft's `until`.
- **Unravel (phase 2 or later).** The melody mirrors about D while the window is open. D dorian is
  its own inversion about D (`mirrorIndex`), so every note stays in key.
- **Mirror Weave (phase 3).** A mirror canon: each melody note is answered by its mirror.
- **The Seamstress (phase 2).** A pickup of needles (D6, E6, F6) into each bar.

### Sounds

Every group is rate-gated and voice-capped (`UNSTITCHED_SOUND_LIMITS`); pitched sounds sit in D
dorian.

| Moment | Sound | Read from |
| --- | --- | --- |
| A cut | Shears and Severing: a shear's 'shhk' and the Thread's cut; the Snip: great shears and a cut chord; the Unpick: a ripple of snaps. The range snap keeps its own sound. | `threadSnapped.cause` (none: the range snap) |
| Guard Strand | A silk ping. | `cutResolved` `strand`, `strandBlocked` |
| The Shears' dash | A dash on its resolution. | `telegraphResolved` of `shears_dash` |
| The Void Maw | An inhale whoosh on its tell and a gated sub drone kept per zone, stopped by `zoneEnded` or the fight's end. | `zoneStarted` / `zoneEnded` (by zone id) |
| The Null rune | A hum for the zone; a refused technique inside it gets a muffled thud of its own, distinct from the cooldown buzz. | `zoneStarted`, `techniqueRejected` `silenced` (only a rune refuses with it) |
| The Doubt Wraith | A whisper swell across its cast; the possession on the E–F and B–C half-steps; freed by glass (a Chime) or a thread's snap (a Reel). | `wraith_doubt`, `possessed`, `freed` |
| The Mimic | Your own technique sound played back mirrored (Ward, Chime or Empower), then a shatter on a crack. | `enemy.mimic.copy` at `telegraphStarted`, `mirrorCracked` |
| The Seamstress | A needle patter (Needle Rain and the Unpick's rain); the Stitch pulled tight. | `seamstress_needles*`, `seamstress_unpick_rain`, `stitched` |
| Doom | A rising tick per stack, then the ignition of the mark. | `statusApplied` `doom` (`stacks`), `doomed` |
| The Unweaver | The Spindles' drone (restarted by a hit once it has run out) and their plating; Steal Verse and the verse's return; Unravel's inversion; the mirror-glass Ward. | `tethered`, `spindled`, `verseStolen`, `verseReturned`, `unravelled`, `mirrorWard` |
| A cloth kill | A tearing noise sweep by size (`kill:cloth:swarm`, `brute`, `miniboss`, `boss`). | `enemyKilled` of a `cloth` enemy |
| Wind styles | `taut` for a telegraph whose first answer is `thread` (Retarget), `invert` for `empower`, each with its own Stasis resume; Blind Score still gives the swell. | `answers[0]` |
| The Rift relics | Sacrificial Lamb: a low bell under a soft choir fall; Knotted Cord: two taut plucks a fourth apart; Stillwater Bell: one still bell on the chord's root. | `relicTriggered` (`sacrificial_lamb`, `knotted_cord`, `stillwater_bell`) |

A `statusRemoved` 'freed' for a Movement III status (possessed, stitched, doom, doomed) no longer
plays the Legion's chain-snap, because the `freed` event voices it; Movement I and II statuses
are unchanged. Voided and doubt have no voice of their own: the Maw's drone and the Wraith's
whisper cover them.

### Tests

`tests/audioPhase5c.test.ts`:

- the Rift in content and in the voicing table, an unknown biome voiced as the Reliquary, D dorian
  at 88 BPM, its progressions, and the stems 94–100% in key in every mood and each of the
  Unweaver's phases;
- the Rift sounds unlike the Reliquary and the Spire, and its ambience plays only in its moods;
- Steal Verse's choir drop (from the event and from `field.stolen`), Unravel's mirror, the phase-3
  canon, the Seamstress's pickup, and Fermata's `hold()` untouched;
- the Reliquary and the Spire equal to the W0a snapshot;
- every Unstitched group voiced within its cap and rate-limited, the lab's group, attack sounds
  only on Unstitched attacks, pitched sounds in key, cloth kills, the cut by cause and the range
  snap unchanged, the 'silenced' refusal distinct, the wind styles, the Mimic's copies, a zone's
  drone stopping with its zone, and the Spindle drone's restart;
- no Movement I or II fight plays a Phase 5c sound.

`tests/audioPhase3b.test.ts` covers the three Rift relics with the other relic sounds (every relic
the sim emits in `relicTriggered` has a group and a lab button).

The Rift's levels can be audited in the browser with `window.__audioLab.pitchAbyss()` and the
mood audit's 'abyss …' rows.

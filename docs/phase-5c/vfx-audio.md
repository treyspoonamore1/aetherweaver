# Phase 5c: Movement III, the Unstitched (VFX and audio)

Movement III (see [Phase 5c](../phase-5c.md)) takes the run down into the **Abyssal Rift**. This
page covers how it looks: the Rift's arenas, the Unstitched bodies, and every cut, zone, status,
mirror and boss cue. The audio half (the Abyss voicing, the Unweaver's stems, the Unstitched
sounds) is W7's, under [Audio](#audio).

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

- Render reads the contract; until W1, W2 and W3 land, the sim doesn't produce cuts, zones,
  possession, Doom, stitches, mirrors, Unravel or Steal Verse, and the lab stands in for them.
- The Mimic's copied glyph rides the cast's badge over its beneficiary; the cast bar's own icon
  is the HUD's (W8).
- A Pedal Point stake inside a rune keeps singing (the rune never touches auras); its edge is not
  drawn where it meets a planted field.

## Audio

W7's half (the Abyss voicing, the Unweaver's stems, the Unstitched sounds).

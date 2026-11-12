# Phase 8: the visual pass

*An as-built record. Each section is one piece of the visual pass, added as it lands. The pass
follows the visual audit of 11 November 2026 (main at `ef5a3be`), whose ten recommended changes it
works through; nothing in it touches an aura's or ornament's look.*

## 8a: lighting the three dark worlds

*Built on `p8/light` from `ef5a3be`; the owner saw the before-and-after pictures and approved it.*

### Why

The audit measured the Crimson Spire, the Abyssal Rift and the Celestial Crucible at 11 to 14 of
255 mean brightness at the game camera, against 33 to 43 for the Sunlit Reliquary: black floors
with a few thin accents, the sky orrery and the rift tears out of frame, and the Seamstress, the
Unweaver and the Silent Conductor black on black. The art direction (04 §1) asks for the Spire's
"obsidian, crimson, brass; torch flicker, red sky", the Rift's "indigo void, teal frays; rim light
from rift tears", and the Crucible's "white-gold, prismatic; music visualised as rings in the sky".

### What changed

Everything is render-side: a new table file, `src/render/lightCues.ts`, read by the mood rows
(`crimsonCues.ts`), the three dark floors and rims (`arena.ts`), the orrery's layout
(`crucibleCues.ts`) and two model builders (`models/library.ts`). Nothing in `src/content`,
`src/sim` or `src/meta` changed: the content version, the sim and every golden are as they were,
and a fight frozen at the same tick has the same sim hash before and after. No aura or ornament is
drawn differently; the song field and the beam song look different only because the floor under
them is lit.

- **Every dark floor.** Painted from a lifted swatch (`LIT_FLOOR`, with the arena's own swatch
  steering a fifth of it, so each arena keeps its shade), still low in contrast. Each floor has a
  second, smaller canvas used as an emissive map on the same floor mesh, so its seams glow without
  a new draw call. The inner disc is shaded down toward the centre (`innerShade`) only as far as the
  lethal rule below needs. The apron beyond the rim leans toward the sky's colour.
- **The Crimson Spire.** A neutral obsidian fill on the disc and the torch key; the red is where the
  camera sees it but off the combat floor: a red sky (the fog behind the rim, which is what the
  camera sees at the top of the frame), the shipped red rim light, wider brazier halos, lifted
  ramparts and pillars, glowing banners. On the floor only the brass inlay rings and the six blood
  channels glow, in a dark brass and ember (the only warm glows that keep 20 ΔE from lethal, the
  Bear and every other semantic colour in every vision).
- **The Abyssal Rift.** An indigo sky, fog and floor; the shipped moon key and the shipped cold rim
  (still ≤ 0.45, so a hero's edge never reads Mended). The floor's seams and the loose threads on
  its outer course glow a faint blue. The torn hangings fray in glowing teal, and the rift tears hang
  just past the rim, taller, so they show at the frame's edges. No teal is drawn on the disc: no
  teal clears every semantic colour (Mend is teal), the Phase 5c rule.
- **The Celestial Crucible.** A deep blue-violet glass disc with a faint inlay glow; the starlight key
  (≤ 1.85) and the cobalt rim (≤ 0.45) are the shipped ones. The choir stalls and organ pipes glow
  white-gold. The sky orrery is laid round the stage (`ORRERY`): eight rings almost flat, from just
  outside the disc's edge, leaning up a little to the far side, so the camera sees them at the
  frame's sides and far edge. They are drawn faint (`ORRERY.alpha` 0.3), a quiet set piece, dimmer
  than any telegraph, aura ring or HUD text. White-gold never reaches the disc (Phase 5d).
- **The Seamstress, the Unweaver and the Movement III foes.** The void cloth is re-tinted render-side
  (`LIT_MODEL.riftCloth`, a bluer indigo; content's colour is unchanged) and every seam's stitches
  fray in glowing teal; the bone seams stay. Shapes are unchanged.
- **The Silent Conductor.** A pale warm-grey robe (`#b4b098`) under its black hood, collar and arms,
  and a brighter stave halo. Colour only. The robe is the pale grey furthest from Ward's shield that
  still reads as white against the hood: at least 20 ΔE from the shield (28.5 at its lowest, under
  protanopia) and from every other colour the colour-vision test checks, in every vision, so it
  needs no exception. Whiter greys sit within 9 to 15 ΔE of the shield or the ailment violet.
- **Vharun** is unchanged; he separates from the darker obsidian floor by value.

### Brightness

Mean brightness (Rec. 601 luma, 0-255) of each picture, 1280×720 at device scale 2, the same camera
and tick before and after. The arena, boss and foe pictures are the VFX lab at the game camera; the
fights are the real combat screen with the HUD, the Skilled bot playing seed 4242.

| Picture | Before | After |
|---|---|---|
| Spire arena (the Crimson Gate, party and field) | 12.1 | 20.0 |
| Rift arena (the Rift's Mouth) | 13.0 | 19.5 |
| Crucible arena | 13.6 | 19.2 |
| Vharun in the Warden's Throne | 12.2 | 20.1 |
| The Seamstress in the Loom Hollow | 12.8 | 19.3 |
| The Unweaver in the Unwoven | 13.4 | 19.7 |
| The Silent Conductor in the Crucible | 13.8 | 19.8 |
| The Movement III foes' gallery | 14.5 | 21.5 |
| Fight: Vharun, 24 s | 25.7 | 29.8 |
| Fight: the Frayed Threshold, 24 s | 17.7 | 23.0 |
| Fight: the Silent Conductor, 30 s | 26.6 | 31.2 |

The dark worlds are about half as bright again; the middle of the play area (the frame's central
half) is 29 to 32 against 22 to 27 before, and 27 to 35 in the fights against 20 to 29. Draw calls and triangles did not change in any picture (the glow is a texture on the
existing floor mesh).

### The lethal rule (3.1:1)

Lethal crimson must keep at least 3.1:1 against the combat floor, and threat amber at least 7:1, in
every colour-vision mode, in all three worlds, outside and inside a song field
(`LETHAL_MIN_CONTRAST`, `THREAT_MIN_CONTRAST`). Each mode's own telegraph colour is measured against
the floor as the camera sees it: the mean of a floor patch between the pillars and the rim, and of a
patch under the Weaver inside her field, recorded in `LIT_FLOOR_SEEN` and tested in
`tests/colorVision.test.ts`. Re-measure them whenever the light or the floors change.

| World | Lowest lethal, before | Lowest lethal, after | Lowest threat, after |
|---|---|---|---|
| Crimson Spire | 3.41:1 | 3.21:1 | 7.83:1 |
| Abyssal Rift | 3.27:1 | 3.17:1 | 7.75:1 |
| Celestial Crucible | 3.27:1 | 3.18:1 | 7.77:1 |

The lowest is always inside the field under tritanopia. The inner disc's shade is what holds the
rule: the Spire needs none, the Rift 0.2 and the Crucible 0.16. Lighting a dark floor always costs a
little lethal contrast; 3.1:1 is the floor it may not go under. Measured instead on the simulated
colours a protanope sees, every world is under 3.1:1 both before (2.73:1 at the lowest) and after
(2.64:1); the rule is stated on the mode's own colours, which is how the palettes were chosen.

### Tests

- Re-recorded: the five Crimson Spire and five Abyssal Rift arena entries of the render snapshots,
  and the Movement III enemy fingerprints. Movement I, the Legion, the heroes and the Weaver are as
  they were. The floor-canvas tests now expect each lit world's 1024px glow canvas beside its 2048px
  floor.
- Rewritten to state the new intent: the Spire's, the Rift's and the Crucible's mood tests (a red sky
  the camera sees and a neutral fill on the disc; an indigo sky and fog with the shipped moon and
  rim; a blue-violet sky with the shipped starlight key and cobalt rim) and the orrery's placement
  (centred on the stage, every ring outside the disc and low, faint).
- New in `tests/colorVision.test.ts`: every lit colour ≥ 20 ΔE from Mend, heal and shield in every
  vision; every colour drawn on the floor ≥ 20 ΔE from every semantic colour; only the shipped lights
  spared, checked by identity; the lethal and threat rule above.
- `tests/aura` is untouched and passes.

### Left as it is, on purpose

- **The rank-and-file Rift foes still read plum.** Their cloth is indigo, but rule 5's faint red
  hostile rim on an indigo body reads plum-magenta at the game camera. The bosses, which carry no
  rim, read clean indigo. Changing it means changing the rim rule, not the cloth.
- **The worlds are still darker than the Reliquary** (about 19 to 21 against 33 to 43). The lethal
  rule caps how bright the combat floor may be; the light lives in the sky, the rim, the dressing,
  the bosses and the foes.
- The orrery and the tears show only at the frame's sides and top edge unless the fight drifts
  toward the rim: the fixed 52° camera never sees the sky.
- The song field's ring and the beam song have less contrast on the lit floors. They are drawn
  exactly as before; whether to retune them is the owner's call, per change.
- Not seen in stills: torch flicker, the tears breathing and the orrery turning on the beat, the
  boss-phase light shifts, a real GPU's glow, and a real screen.

## 8b: the stained-glass figures

*Built on `p8/art-code`, from a first in-code pass the owner called "a decent start", a pushed pass
the owner approved ("Yes, I like it"), a foundation (the kit, the registry, the guide) and five
family redraws, integrated here. The guide for anyone who builds or changes a figure is
`docs/art-style.md`; the roster of every figure, with its family and triangles, `docs/art-roster.md`.*

### What the look is

Every figure a fight draws (6 heroes, the Weaver, 30 enemies, Oro's Sapling and Ancient, the elite
crown: 41 in all) is built in code as **stained glass**: flat panes of coloured glass held in dark
lead, the big surfaces cut into irregular panes of slightly different tones, a share of panes lit
from inside, a dark lead outline round every figure. Signature colours are saturated and faintly
self-lit. The Weaver alone is leaded in gold (gold means her). The Hollow Choir is porcelain whose
lead is a web of violet cracks. Silhouettes were designed for the fight's camera first.

The look lives in the model shader (`src/render/models/material.ts`: panes, lead, lit glass,
cracks, the outline shell, motion), the builder (`models/builder.ts`: pane detection, the outline
shell, the body layer) and one family file per group of figures in `src/render/models/art/`
(`heroes`, `weaver`, `choir`, `legion`, `unstitched`, `unweaver`, `finale`, `misc`), merged by a
registry (`models/art/index.ts`). `models/library.ts` builds every figure through it; the arenas'
pillars (not figures) are still built there as before. Every figure is still one instanced batch
and one draw call: no draw calls were added.

Motion is in the vertex shader: a blow plays as anticipation, a strike past rest and a settle;
cloth trails and flares a beat late; bells swing and ring out; a thrust (Seren) drives out along
the figure's forward; every walking figure breathes, carries its weight in the walk and twists into
the strike. A figure's clock stops while it is held, frozen, down or under Reduced motion.

### The owner's decisions

1. The stained-glass look is the game's look; every figure is redrawn in it (done: all 41).
2. The Bellwarden is the walking bell (the cloaked keeper was dropped).
3. Heroes and the Weaver are drawn **1.12×** (`HERO_DRAWN`, `models/artFlag.ts`).

### The 1.12, and what stays at content height

The scale is on the model only (`ModelBatch.drawn`): the live figure, its Save and Rewind ghosts
and its fall grow. Their rings, the song field, reach, footprints, hit shapes, hover and picking,
and everything in the sim are unchanged. Moved for it: the allied health bars (over the drawn
head, today's clearance) and the Weaver's ribbons (they leave her hands at 1.12; they are her
model). **Left at content height on purpose** (aura, ornament and Thread drawing, which this phase
does not change): the Thread's and the beam song's attach points, the beam swell, the Fermata
freeze and rim, the aura coverage marks and every over-head mark. On a 1.12 hero the chest anchors
sit about 6% of the height lower on the figure and over-head marks clear the head by about 0.18 m
instead of 0.42 m; they still clear it.

### Other choices made in integration

- **The dark worlds.** The figures look the same in every world (no light edge: a pewter outline
  greyed every signature colour and weakened the rims). Only the darkest cut glass is lifted a
  little in its own hue on the Spire, the Rift and the Crucible (`models/artWorld.ts`); a part can
  refuse it (`lift: false`: the Unweaver's void, the Conductor's coat, the Legion's obsidian).
- **The Unweaver's robe** is `#3c4494`, replacing the landed `riftCloth` (`#5560c0`) **for the
  Unweaver only**: the landed cloth read as Kael's blue (14.8 ΔE from `#5b8def` at its closest);
  the new indigo is 28.4 from him and at least 26.9 from every semantic colour. Its hood rim keeps
  `riftCloth`.
- **The Unstitched's teal stitches** burn at 0.1, not the landed fray's 1.8: measured as rendered
  at the game camera, the glowing stitches sat 8 to 10 ΔE from Mend under tritanopia; at 0.1 every
  stitch pixel in all four worlds is at least 20 from Mend, heal and shield in every vision.
- **The hostile rim (rule 5)** is unchanged and awaits the owner: today it adds a faint flat red to
  the whole body as well as its edge, which turns near-black bodies red (the Legion's obsidian, the
  Unstitched's cloth, the mirror voices' hoods). `HOSTILE_EDGE` (`models/artFlag.ts`, off) keeps it
  to the silhouette's edge on the stained-glass foes; measured in every colour vision, the edge keeps
  76 to 90% of today's strength while the body wash falls from about 10 ΔE to 2 to 3. Flipping the
  constant is the whole change. The gold elite rim washes dark hoods olive in the same way.
- An enemy id added to content without a figure of its own is drawn as its role's Choir figure
  until it gets one (as main's builders fell back by role); `tests/renderArt.test.ts` fails until then.

### Budgets and readings

Triangles per figure, outline included (`models/art/kit.ts`): swarm 1,100 (outline on major parts
only), standard 2,200, elite 3,600, boss 8,000, hero 2,600, the Weaver 3,400. Every figure is within
its class (`tests/renderArt.test.ts`; the roster lists each).

Readings (the production build, SwiftShader, 1280×720; draw calls and triangles from the game's
perf readout or the bench's `renderer.info`; heap from `performance.memory`):

| scene | draw calls (peak) | triangles (peak) | JS heap (peak) |
|---|---|---|---|
| bench `crowd`: 150 Movement I enemies (main: 30 / 55.3k) | 30 | 276,934 | 28 MB |
| bench `unweaver` (the Unweaver, Spindles, choristers) | 31 | 80,402 | 28 MB |
| bench `hounds` (the Matriarch's pack) | 28 | 37,216 | 27 MB |
| bench `finale` (the Conductor and its choir) | 26 | 31,466 | 27 MB |
| Movement I: First Light (skirmish) | 33 | 72,124 | 43 MB |
| Movement I: the Bellwarden / the Hollow Cantor | 27 / 30 | 62,058 / 37,558 | 41 / 42 MB |
| Movement II: skirmish / the Matriarch / Vharun | 27 / 29 / 27 | 38,040 / 63,942 / 63,084 | 36 / 37 / 43 MB |
| Movement III: skirmish / the Seamstress / the Unweaver | 31 / 27 / 28 | 68,594 / 30,180 / 59,378 | 39 / 43 / 37 MB |
| The Finale: the Silent Conductor | 33 | 35,466 | 38 MB |

Every reading is under half of the 600k-triangle limit, and draw calls are where they were (one
batch per figure). The real fights were seed 4242 Expeditions with Skip the unlocks, the Skilled
bot playing, sampled through about the first 45 s of each. The JavaScript bundle is 6,437,410 bytes
(1,904,171 gzipped) against main's 6,353,457 (1,875,314): 84 KB more (29 KB gzipped), and no asset
files.

### Colour

Every colour written in a family file is checked in `tests/colorVision.test.ts` in every colour
vision: at least 20 ΔE from heal, Mend, shield and the dome (no body reads as healed or Warded),
and from the danger, Weaver and status colours (threat, lethal, amp, empower, ailment, gold,
goldHot, Resonance, the Weaver, discord). The exceptions are named in the test with their reasons:
pale glass, steel and skin (no pale colour clears the shield, the dome and Resonance); the
Choir's violet lights and the Bellwarden's windows (the content's crack violet, small lights only);
shipped trims (Oro's seed, Seren's steel); bronze (dull metal); Kael's steel blue (his signature
hue); the Rift's bone; the Stolen Verse's orb (always rimmed in its stolen aura's colour); the
elite crown's gold (the elite's own meaning). Dark browns and blacks near the Martyr's Bear under
protanopia are not counted: every dark colour collapses together there, and the Bear is a rim,
never a body.

### Tests

New: `tests/renderArt.test.ts` (every content id has a figure; every figure within budget; the
same parts for any colours, so robes recolour in place; building takes nothing from the shared
`Math.random`; gold came on the Weaver only) and the Phase 8b block of `tests/colorVision.test.ts`.
Re-recorded or rewritten to the new look, their purpose kept: the model entries of
`renderSpireSnapshot` and `renderRiftSnapshot`, `renderMovement2`'s Movement I models, the starters
in `renderBrann` and `renderSeren`, the Weaver's colours in `renderKeepsakes` (now read with a pane
tolerance) and her ribbons in `renderPhase7`. Unchanged and passing: every rule test (heights,
greyscale separation, colour-vision distances, quadruped gait, distinct bodies, parts counts) and
`tests/aura` with both pin files.

Found on the way: model building drew three.js ids from the shared `Math.random`, so a model built
once per process shifted a seeded test's random stream between runs; building now runs on its own
fixed-seed generator (`models/ownRandom.ts`).

### Known weak, and what stills cannot show

- The Hollow Cantor stands behind the boss panel for the first half minute of its fight, and the
  Unweaver and the Conductor stand at the top edge of the frame: camera and HUD, not figures
  (the audit's change 10).
- At the game camera (about 70 px tall) the panes show as a faint mottle; the leading belongs to
  close-ups and the line-up.
- The hostile rim's flat wash on dark bodies (above) until the owner chooses.
- Crownless is the weakest robe on the Reliquary's floor; Dusk's violet sits near Vexis's.
- Motion is rigid-part motion in the shader: cloth rotates about pivots and can pass through a
  body; there is no blending between poses.
- Stills cannot show whether the motion's timing reads at game speed, whether the per-figure clock
  looks mechanical across a crowd of 150 choristers, or how the 1.12 feels in play.

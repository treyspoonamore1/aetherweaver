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
the strike. A figure's clock stops while it is held, frozen or down, and under Reduced motion,
which stills the idle (breath, sway, the walk's swing); a blow and a wind-up are not on that clock
and still play under Reduced motion (see the review, below).

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
- **The hostile rim (rule 5) and the elite's gold: three looks, the owner's choice.** Landed is
  look A, as approved: the rim on the body (a faint flat red over the whole body as well as its
  edge, which turns near-black bodies red: the Legion's obsidian, the Unstitched's cloth, the mirror
  voices' hoods; the gold elite rim washes dark hoods olive the same way) and a dark lead outline.
  Two constants in `models/artFlag.ts`, both off, build the others: look B, `HOSTILE_EDGE`, the red
  on the body's edge only, outline dark; look C, `HOSTILE_OUTLINE`, the outline itself red (gold on
  an elite and its crown), with or without `HOSTILE_EDGE`'s body wash removed. Flipping a constant
  is the whole change; the studio draws all of them without a rebuild (`hostile: 'flat' | 'edge' |
  'outline' | 'outline-edge'`). Measured at the game camera over a rank-and-file group with two
  elites, in the four worlds (the hostile rim against none, 90th percentile ΔE where it acts / the
  body's median shift; normal vision, then protanopia, where it reads weakest):

  | look | normal: edge / body | protanopia: edge / body |
  |---|---|---|
  | A, as approved (landed): on the body, dark outline | 27.5–28.9 / 11.0–12.0 | 9.6–10.5 / 3.9–4.2 |
  | B, red on the body's edge only, dark outline | 19.1–20.7 / 2.9–3.3 | 7.0–7.6 / 1.0–1.1 |
  | C, red outline (and the body's rim) | 72.2–74.7 / 18.5–20.0 | 33.5–34.3 / 5.6–6.4 |
  | C, red outline, no wash (with B) | 85.0–88.5 / 6.2–7.7 | 47.5–48.0 / 2.0–2.3 |

  Pictures: `shots/rim3/looks-<world>.png` and `shots/rim3/looks-close.png`.
- An enemy id added to content without a figure of its own is drawn as its role's Choir figure
  until it gets one (as main's builders fell back by role); `tests/renderArt.test.ts` fails until then.

### Budgets and readings

Triangles per figure, outline included (`models/art/kit.ts`): swarm 1,100 (outline on major parts
only), standard 2,200, elite 3,600, boss 8,000, hero 2,600, the Weaver 3,400. Every figure is within
its class (`tests/renderArt.test.ts`; the roster lists each).

Readings (the production build, SwiftShader, 1280×720; draw calls and triangles from the game's
perf readout or the bench's `renderer.info`; heap from `performance.memory`; the four bench rows
re-measured after the review, the real fights before it):

| scene | draw calls (peak) | triangles (peak) | JS heap (peak) |
|---|---|---|---|
| bench `crowd`: 150 Movement I enemies (main: 30 / 55.3k) | 30 | 276,936 | 29 MB |
| bench `unweaver` (the Unweaver, Spindles, choristers) | 31 | 80,378 | 28 MB |
| bench `hounds` (the Matriarch's pack) | 28 | 37,216 | 27 MB |
| bench `finale` (the Conductor and its choir) | 26 | 31,464 | 27 MB |
| Movement I: First Light (skirmish) | 33 | 72,124 | 43 MB |
| Movement I: the Bellwarden / the Hollow Cantor | 27 / 30 | 62,058 / 37,558 | 41 / 42 MB |
| Movement II: skirmish / the Matriarch / Vharun | 27 / 29 / 27 | 38,040 / 63,942 / 63,084 | 36 / 37 / 43 MB |
| Movement III: skirmish / the Seamstress / the Unweaver | 31 / 27 / 28 | 68,594 / 30,180 / 59,378 | 39 / 43 / 37 MB |
| The Finale: the Silent Conductor | 33 | 35,466 | 38 MB |

Every reading is under half of the 600k-triangle limit, and draw calls are where they were (one
batch per figure). The real fights were seed 4242 Expeditions with Skip the unlocks, the Skilled
bot playing, sampled through about the first 45 s of each. The JavaScript bundle was 6,437,410 bytes
(1,904,171 gzipped) against main's 6,353,457 (1,875,314): 84 KB more (29 KB gzipped), and no asset
files; after the review it is 6,440,952 bytes (3.5 KB more again).

### Colour

`tests/figureColors.test.ts` builds every figure (every hero and enemy, the Weaver in her own
colours and every robe, Oro's summons, the elite crown) and reads its vertex colours back
(`tools/figure-colors.ts`). Per colour vision and per signal (heal, Mend, shield, threat, lethal,
amp, Empower, ailment as each vision's palette draws them; the dome, gold, goldHot, Resonance, the
Weaver and discord) it counts the share of the figure's vertices within 10 ΔE, lit vertices (the
figure's own light) apart from unlit ones, and holds each figure to the same figure on main
(`tests/fixtures/mainFigureColors.json`, recorded from main with the same tool): lit to main's
share + 2 points, unlit to main's + 5, the pale signals (shield, dome, goldHot, Resonance, the
Weaver's white) to main's palest figure + 5 (every pale colour, porcelain, silver, bone or skin,
sits within 10 of one of them in some vision; main's figures carry up to 85%). It replaced a test
of the hex literals in the family files, which missed what the review found: colours lifted by
their glow, and pane tones spread round a colour whose hex clears.

Its named exceptions, each with its measured share, fail once no longer needed: Kael's silver and
blade, Vexis's silver, skin and stars, Seren's shipped steel and the Glass Lancer's porcelain
(content #dbeafe) near the shield and the dome; Lyra's and Vexis's lit glass (their content colours
lightened: no lightness of either clears every signal by 10); Vexis's robe glass in her content
violet near tritanopia's ailment; the Unweaver's two points of bone light near Resonance and the
Weaver's white; the Weaver's gold (hers) and two robes' trims (content colours, exactly as main
draws them, on rings with more vertices).

### The review (Part C)

An independent review found two must-fix items and some smaller ones; each was checked first. The
pictures named below (`shots/…`) went with the integration's report; they are not in the
repository.

**Colours near the signals in red-green vision (M1, confirmed).** The Hollow Choir's light #b69cff
sat 7.9 ΔE from red-green heal and Mend, and lit it read nearer still; bronze's pane tones sat 8.4
from lethal under protanopia; Kael's steel #9cb8f2 sat 2.6 from heal. Fixed in the colours:

- The Choir's light is a deep violet (#5242a0, #3c2e86) burning at 0.75 (its windows at 0.55, the
  Glass Lancer's lance #4a44c4). Measured as rendered in the Reliquary line-up (every violet pixel,
  its nearest of heal, Mend, shield and the dome over the four visions): 5th percentile 1.7 → 17.5
  ΔE, median 10.2 → 36.2, pixels under 13: 55% → 1.7% (eyes and the Bellwarden's visor slits). It
  still reads as the crack violet in normal vision.
- Bronze #967254: at least 25 ΔE from lethal, threat, amp, Empower and gold in every vision across
  its pane tones.
- Kael's steel #3668a1 (a true blue; the first fix, an indigo, read violet under the warm key):
  at least 20 from heal, Mend and shield and 20 from the Unweaver's indigo; his tabard and helm
  fin a touch lighter than before (0.05, not 0.18), his lit glass half way to white. His nearest
  vertex to heal or Mend in any vision: main 6.7 ΔE, before 2.6, now 13.6 (his content blue).
- The Weaver's trim, halo and lights and the elite crown's gold are untoned (`jit: 0`): their exact
  colours, as main draws them (toned, they drifted toward threat, amp or discord in some vision).

Per figure, the share of vertices near heal or Mend (any vision) that are lit, before → after:
Chorister 10.0 → 0%, Bell Brute 9.4 → 0, Lamenter 18.9 → 0, Glass Lancer 5.4 → 0, Mute 2.3 → 0,
Cantor Acolyte 19.1 → 0, Bellwarden 8.9 → 0, Hollow Cantor 16.5 → 0 (main: 0 for all); near lethal
(unlit, protanopia, bronze): Bell Brute 17.1 → 0, Mute 19.5 → 0, Acolyte 11.0 → 0, Bellwarden 19.5
→ 0, Hollow Cantor 16.1 → 0. Pictures: `shots/cvfix/` (the Choir line-up and Kael, in normal
vision, deuteranopia and protanopia, beside each vision's heal, Mend and lethal).

**The outline shell dropped every on-model cue (M2, confirmed).** The shell drew lead, the hit
flash and the dissolve's edge only, so the outermost pixels of every figure lost the rims. It now
draws what the body draws at its silhouette (the body's terms at a fresnel of 1): the rim tint
(aura coverage, Fermata, the beam, the Thread, focus and hover, possession, an affix, the risen,
the Stolen Verse), the Save and Rewind ghosts, Stasis's frost, the Prism's edge and the Luminary's
sun, each in its own colour and strength; the body's terms are unchanged (with `HOSTILE_EDGE` off,
the hostile rim's line is main's). The two standing rims, the rank-and-file hostile rim and the
elite's gold (with its crown's glow), are not event cues and stay off the outline as approved,
and so does the Weaver's own resting rim (her gold, or her robe's trim: always, it is not a hostile
rim), her event rims (a borne wound, Conduit, a held rim) staying on it
(entities.ts marks them where it chooses them; the shader's outline skips a marked rim; look C
above puts them back; `tests/renderShellRims.test.ts` pins the default). Under Stasis the lead (lines and outline) now frosts with the glass, on the figure's
side. Measured in the VFX lab's real fight (same staging, seed and tick in every build; 1920×1080;
the cue on against its shader channel off; eight frames a second apart averaged so the rims'
breathing evens out), mean ΔE over the target figure's pixels / over its outermost 2 px:

| cue | camera | main | before | now |
|---|---|---|---|---|
| aura coverage tint | game | 13.04 / 16.73 | 8.0 / 6.87 | 14.8 / 30.55 |
| aura coverage tint | close | 12.37 / 16.87 | 9.86 / 6.72 | 15.03 / 35.84 |
| Fermata rim | game | 13.13 / 16.53 | 8.21 / 9.1 | 13.87 / 24.99 |
| Fermata rim | close | 12.33 / 16.55 | 10.05 / 8.62 | 14.44 / 29.97 |
| the beam (Thread rim with the beam song) | game | 24.95 / 30.23 | 15.66 / 13.26 | 24.64 / 35.36 |
| the beam (Thread rim with the beam song) | close | 23.83 / 29.38 | 19.35 / 14.3 | 24.5 / 38.81 |
| the Thread rim | game | 27.16 / 28.18 | 24.97 / 31.04 | 26.52 / 41.19 |
| the Thread rim | close | 26.5 / 31.62 | 16.84 / 15.02 | 26.75 / 41.25 |
| hover | game | 30.51 / 36.41 | 19.25 / 16.33 | 29.17 / 44.81 |
| hover | close | 29.74 / 36.49 | 23.83 / 16.48 | 30.64 / 53.9 |
| focus | game | 13.94 / 25.1 | 13.31 / 16.14 | 28.25 / 54.58 |
| focus | close | 14.07 / 25.17 | 14.66 / 15.56 | 24.26 / 55.79 |
| Save ghost | game | 17.08 / 16.89 | 16.57 / 16.19 | 14.54 / 14.08 |
| Save ghost | close | 36.85 / 37.1 | 16.51 / 15.42 | 36.31 / 37.15 |
| Rewind ghost | game | 16.82 / 16.82 | 18.78 / 18.78 | 18.57 / 18.57 |
| Rewind ghost | close | 15.39 / 15.39 | 18.98 / 18.98 | 17.71 / 17.71 |
| Prism edge | game | 4.47 / 5.45 | 0.86 / 0.38 | 8.89 / 21.74 |
| Prism edge | close | 4.49 / 5.56 | 0.96 / 0.4 | 5.48 / 19.84 |
| Stasis frost | game | 16.58 / 15.46 | 14.46 / 10.45 | 14.99 / 13.08 |
| Stasis frost | close | 16.09 / 12.51 | 15.23 / 9.34 | 15.58 / 12.66 |
| hostile rim (look A) | game | 6.53 / 14.1 | 5.82 / 7.07 | 6.04 / 7.2 |
| hostile rim (look A) | close | 6.39 / 13.54 | 6.57 / 7.73 | 6.79 / 7.91 |
| elite gold rim (look A) | game | 7.31 / 14.55 | 7.74 / 7.76 | 8.19 / 8.25 |
| elite gold rim (look A) | close | 7.72 / 14.81 | 9.0 / 8.88 | 9.55 / 9.41 |

Every event cue now reads at least as strongly as on main on the figure's outermost pixels, at both
cameras, except Save's ghost and Stasis's frost at the game camera; focus reads about twice as
strong as on main (28.3 against 13.9 at the game camera). The hostile and elite rows are look A,
landed (above): the standing rims stay off the outline as approved, so at the edge they read as
they did before the review, weaker than main's, whose figures had no outline; with look C the
outline carries them (hostile 17.9 / 39.3, elite 24.6 / 48.0 at the game camera). Over all the figure's pixels a
few read a little weaker at the game camera (hover −1.3, the Thread −0.6, the beam −0.3, Save −2.5,
frost −1.6; frost −0.5 close up): the rims are a fresnel, strongest at the edge, and the branch's figures are larger
and flatter-faced (1.12, more front-facing surface), so their mean over the figure is lower while
every edge pixel is stronger. Frost is weaker over a pale figure because white porcelain is already
near the frost's silver. Tried on the figure's side and kept: the lead frosts (game 14.1 → 15.0,
outermost 11.9 → 13.1; close up the outermost pixels now match main). Tried and dropped: the glass's own light yielding under a strong rim, a
ghost or the frost (no measurable change). Not done: strengthening any cue. Pictures:
`shots/cues/` (a sheet per cue, main, before and now, both cameras) and `shots/cues-overview.png`.

**Smaller items.**
- W1: the screen derivatives (`fwidth`) are taken once, before the per-part branches.
- W2 (not as found): the rig does turn the parts, but the figures are flat-shaded, so their light
  and fresnel come from the moved faces, not the vertex normals; the vertex normal is used only by
  the shadow's normal bias, which is 0. The rig now turns the normals too, at no cost; the pose
  pictures with and without it are pixel-identical (`shots/normals/`), shadows included.
- W4: pillars carry zero-filled `aRig`, `aMisc`, `aBary` (and a zero pose); the arena's floor and
  walls still read the material's defaults.
- W5: renderKeepsakes checks that no pane of a robe is within a pane's tone of her own ivory or
  gold; `TONE` 0.13 → 0.09 (measured: 0.082 at most).
- W7: documented, not resized: an unknown miniboss is drawn as the Bellwarden at its own size (the
  other roles' figures size themselves from the radius). Every content id has its own figure.
- W11: the studio script stops its preview server when it fails to come up and rejects a flag
  with no value.
- W12–W14: stale comments about the removed switch and main's builders and paths outside the
  repository are gone; `LIT_MODEL.riftFrayGlow` is removed; `OUTLINE_OF`, `OUTLINE_MAJOR_RADIUS`,
  `buildWeaverArt`, `ART_WORLD`, `ArtWorld` and `RIG_VERTEX` are no longer exported.
- W3: a figure's draw uses 15 of the 16 guaranteed vertex attributes (`docs/art-style.md`).
- W10, fragment cost: figure pixels are 13.4% of a 1080p frame in the 150-enemy bench (its start,
  every foe in view) and 7.7% of the canvas in the lab's busy fight (25 foes); the bench's boss
  scenes 1.3–1.4% in their first seconds. The hashes no longer use `sin`. The game's quality tier
  now reaches the material: the low tier cuts the panes in one Voronoi pass of 27 cells instead of
  two (the border from the two nearest centres): the same panes, the lead a little uneven
  (`shots/w10/panes-high-low.png`). Not measured on a real graphics card.
- W8, Reduced motion: main played its attack lunge (a step of up to 0.45 m toward the target and a
  0.12 rad lean) under Reduced motion and had no blow or wind-up on the figure. The branch keeps
  the lunge and stills the idle, but the rigged blow (the arm raised to 1.75 × its amount and
  brought down, the body's twist) and the wind-up still play. Behaviour unchanged; the owner
  decides. Pictures: `shots/marks/reduced-motion-blow.png` (main above, the branch below).
- W9: the Calling halo now sits below the 1.12 hero's bar (it sat above it), and the Sunrise
  beam's end lands inside the drawn head. Not moved (aura and ornament drawing). Pictures:
  `shots/marks/calling-halo-and-bar.png`, `shots/marks/beam-end.png`.

### Tests

New: `tests/renderArt.test.ts` (every content id has a figure; every figure within budget; the
same parts for any colours, so robes recolour in place; building takes nothing from the shared
`Math.random`; gold came on the Weaver only) and `tests/figureColors.test.ts` (above, Colour; it
replaced the Phase 8b block of `tests/colorVision.test.ts`).
Re-recorded or rewritten to the new look, their purpose kept: the model entries of
`renderSpireSnapshot` and `renderRiftSnapshot`, `renderMovement2`'s Movement I models, the starters
in `renderBrann` and `renderSeren`, the Weaver's colours in `renderKeepsakes` (now read with a pane
tolerance) and her ribbons in `renderPhase7`. Unchanged and passing: every rule test (heights,
greyscale separation, colour-vision distances, quadruped gait, distinct bodies, parts counts) and
`tests/aura` with both pin files. Re-recorded again after the review, and why: the arena
fingerprints (the model shader's source and the pillars' zero-filled attributes), the eight Hollow
Choir figures (their light and bronze), Kael (steel, tabard, lit glass), the Weaver (her untoned
trim), and Brann's and Seren's starter checks (they pin Kael's model). Nothing else moved.

Found on the way: model building drew three.js ids from the shared `Math.random`, so a model built
once per process shifted a seeded test's random stream between runs; building now runs on its own
fixed-seed generator (`models/ownRandom.ts`).

### Known weak, and what stills cannot show

- The Hollow Cantor stands behind the boss panel for the first half minute of its fight, and the
  Unweaver and the Conductor stand at the top edge of the frame: camera and HUD, not figures
  (the audit's change 10).
- At the game camera (about 70 px tall) the panes show as a faint mottle; the leading belongs to
  close-ups and the line-up.
- Focus reads about twice as strong as on main (28.3 against 13.9 ΔE over the figure at the game
  camera), the outline carrying it; Save's ghost and Stasis's frost read a little weaker than on main
  at the game camera (14.5 against 17.1, and 15.0 against 16.6). The fragment cost is unmeasured on
  a real graphics card.
- The hostile rim's look (A, B or C above) is the owner's call; A is landed.
- Reduced motion still plays the blow and wind-up (above); the Calling halo and the Sunrise beam's
  end at 1.12 (above): the owner's calls.
- Crownless is the weakest robe on the Reliquary's floor; Dusk's violet sits near Vexis's.
- Motion is rigid-part motion in the shader: cloth rotates about pivots and can pass through a
  body; there is no blending between poses.
- Stills cannot show whether the motion's timing reads at game speed, whether the per-figure clock
  looks mechanical across a crowd of 150 choristers, or how the 1.12 feels in play.

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
`docs/art-style.md`; the roster of every figure, with its family and triangles, `docs/art-roster.md`. Landed on main at `4b3cdaf` on 12 November 2026 and in the playable demo from Version 17
([docs/demo.md](demo.md)).*

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
- **The hostile rim (rule 5) and the elite's gold: four looks, the owner's choice.** Phase 8b
  landed look A, as first approved: the rim on the body (a faint flat red over the whole body as
  well as its edge, which turns near-black bodies red: the Legion's obsidian, the Unstitched's
  cloth, the mirror voices' hoods; the gold elite rim washes dark hoods olive the same way) and a
  dark lead outline. Shown the four side by side, **the owner chose the fourth, "Red outline, no
  wash"** (Phase 8c): the outline itself carries the standing rim, red on a rank-and-file foe and
  gold on an elite and its crown, and a foe's body takes the red at its edge only. It is the
  game's look now: `HOSTILE_OUTLINE` and `HOSTILE_EDGE` in `models/artFlag.ts` are both on, with
  one difference from the pictures the owner chose from: the elite's gold on the outline is at 0.6
  of its strength (`ELITE_OUTLINE_STRENGTH`), so it does not match Focus's gold (below). The
  Weaver's own resting rim is not a hostile rim and is unchanged (on her body, her outline dark).
  Turning a constant off still builds the earlier looks (B: `HOSTILE_EDGE` alone, the red on the
  body's edge only, outline dark; C: `HOSTILE_OUTLINE` alone, a red outline over the body's wash),
  and the studio draws all of them without a rebuild (`hostile: 'flat' | 'edge' | 'outline' |
  'outline-edge'`). Measured at the game camera over a rank-and-file group with two elites, in the
  four worlds (the hostile rim against none, 90th percentile ΔE where it acts / the body's median
  shift; normal vision, then protanopia, where it reads weakest):

  | look | normal: edge / body | protanopia: edge / body |
  |---|---|---|
  | A, first approved (Phase 8b): on the body, dark outline | 27.5–28.9 / 11.0–12.0 | 9.6–10.5 / 3.9–4.2 |
  | B, red on the body's edge only, dark outline | 19.1–20.7 / 2.9–3.3 | 7.0–7.6 / 1.0–1.1 |
  | C, red outline (and the body's rim) | 72.2–74.7 / 18.5–20.0 | 33.5–34.3 / 5.6–6.4 |
  | **the fourth, red outline, no wash: the game's look** | 85.0–88.5 / 6.2–7.7 | 47.5–48.0 / 2.0–2.3 |

  What it was checked against before it landed is in "Phase 8c: the red outline, checked" below.
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
elite's gold (with its crown's glow), are not event cues and at the review stayed off the outline,
as first approved (look A); since Phase 8c the owner's fourth look puts those two on it (above).
The Weaver's own resting rim (her gold, or her robe's trim) stays off her outline always (it is
not a hostile rim), her event rims (a borne wound, Conduit, a held rim) staying on it
(entities.ts marks a rim as standing where it chooses it; the shader's outline skips a marked rim;
`tests/renderShellRims.test.ts` pins the default). Under Stasis the lead (lines and outline) now frosts with the glass, on the figure's
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
| hostile rim (the fourth look, Phase 8c) | game | 6.53 / 14.1 | | 17.81 / 42.56 |
| hostile rim (the fourth look, Phase 8c) | close | 6.39 / 13.54 | | 12.6 / 44.93 |
| elite gold rim (the fourth look, its outline at 0.6) | game | 7.31 / 14.55 | | 22.27 / 42.81 |
| elite gold rim (the fourth look, its outline at 0.6) | close | 7.72 / 14.81 | | 18.12 / 44.45 |

Every event cue now reads at least as strongly as on main on the figure's outermost pixels, at both
cameras, except Save's ghost and Stasis's frost at the game camera; focus reads about twice as
strong as on main (28.3 against 13.9 at the game camera). The hostile and elite rows marked look A
are Phase 8b as it landed: the standing rims stayed off the outline, so at the edge they read as
they did before the review, weaker than main's, whose figures had no outline. The rows marked the
fourth look are the game since Phase 8c (re-measured, the same staging; its "now" beside look A's
6.04 / 7.2 and 8.3 / 8.43 on the build before it): the outline carries them, and at the figure's
outermost pixels the hostile rim reads three times as strongly as on main's figures (42.6 against
14.1 at the game camera). Over all the figure's pixels a
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

### Phase 8c: the red outline, checked

Before the owner's fourth look landed it was measured against the game's signals, as rendered at
the game camera in the four worlds and under each colour-vision setting (each setting's own
palette, then that vision simulated), the look on main beside it. Staged in the lab's real fight
view with the sim waiting, so every build draws the same frame. The pictures named here
(`shots/…`) went with the stream's report; they are not in the repository.

**Telegraphs.** A lethal and a threat telegraph with six rank-and-file enemies standing in and
around them. Nothing of a telegraph changes: its ring, its sweep and its hatching are the same
pixels. What changes is the figures on it. The outline's red is the life bar's red, and that red is
near the lethal crimson by nature (14.7 ΔE between the two hexes in normal vision and under
deuteranopia, 22.8 under protanopia, 24.3 under tritanopia), so the outline as rendered sits 14 to
17 from a lethal telegraph's bright ring in normal vision, where main's faint rim sat 55 to 85 from
it. A figure standing on a lethal telegraph still separates from it, less than a dark outline did;
on a threat telegraph it separates better in normal vision and worse under the protanopia setting,
whose threat is yellow and whose red reads as a dark yellow. Ranges over the four worlds (ΔE; the
outline's median colour, on main its rim's, against the telegraph's lightest ring / its fill; then
the figure's outermost 3 px against the telegraph just outside it):

| colour vision setting | look | to the lethal ring / fill | to the threat ring / fill | a figure's edge on the lethal it stands on | on the threat |
|---|---|---|---|---|---|
| normal | main | 54.6–84.5 / 22.6–56.1 | 46.3–78.2 / 14.8–56.8 | 51.2–55.0 | 18.1–35.2 |
| normal | red outline | 13.9–17.1 / 28.9–38.1 | 35.1–43.6 / 54.0–68.8 | 31.7–39.8 | 54.7–61.7 |
| protanopia | main | 32.3–89.5 / 23.4–75.0 | 69.5–100.6 / 14.2–57.6 | 33.6–38.7 | 19.2–38.9 |
| protanopia | red outline | 20.0–21.9 / 17.6–20.4 | 43.1–65.7 / 11.9–21.9 | 16.8–20.7 | 13.0–28.5 |
| deuteranopia | main | 46.0–105.0 / 24.1–79.2 | 60.5–97.3 / 10.6–55.9 | 37.2–49.5 | 19.6–38.5 |
| deuteranopia | red outline | 13.4–17.1 / 23.3–28.7 | 24.6–37.4 / 29.4–46.1 | 23.5–28.6 | 30.5–51.0 |
| tritanopia | main | 64.6–98.6 / 32.9–60.3 | 35.2–59.1 / 10.9–23.2 | 53.8–66.8 | 19.1–30.4 |
| tritanopia | red outline | 19.0–24.4 / 31.9–41.2 | 39.5–62.3 / 71.3–84.9 | 35.1–42.0 | 60.4–72.2 |

On the Spire and the Rift the outlined figures are easier to find on a telegraph than main's dark
ones, which sank into it. The weakest reading is the protanopia setting in the Reliquary: a
figure's edge on a threat telegraph 13.0 (main 38.9).

A dimmer outline does not buy the distance back. `HOSTILE_OUTLINE_STRENGTH` (artFlag.ts) dims the
outline's red alone; at 0.7 and 0.45 the red darkens toward the lethal telegraph's fill, and a
figure standing on a lethal telegraph separates from it less in every vision (normal: 31.7–39.8 at
1, 26.6–34.8 at 0.7, 17.3–25.3 at 0.45; protanopia: 16.8–20.7, 12.1–17.6, 7.3–19.4; deuteranopia:
23.5–28.6, 16.6–20.0, 7.7–14.9; tritanopia: 35.1–42.0, 25.9–31.5, 12.6–20.2), while the distance
to the bright ring grows only a little (normal: 13.9–17.1, 18.2–18.7, 26.3–27.8). It stays at 1,
as the owner saw it. Pictures: `shots/tele-<world>.png` (each vision, main beside the new look),
`shots/outline-strengths-normal.png` and `-protanopia.png`.

**An elite beside Focus.** An elite, a Focused rank-and-file enemy and a Focused elite side by
side. On main an elite's outline was dark lead and only a Focused foe's was gold: 57 to 85 ΔE
apart in every vision. With the elite's gold on its outline at the body's own strength the two
outlines were the same gold, apart only in lightness: 14.3–20.5 in normal vision (18.2–23.1
protanopia, 16.3–21.3 deuteranopia, 15.5–19.5 tritanopia); the Focus ring on the floor and its
diamond, and the elite's crown and bar, still told them apart, the outline no longer did. So the
elite's gold has an outline strength of its own, `ELITE_OUTLINE_STRENGTH` (artFlag.ts; the elite's
rim and its crown's are marked as carried by the outline, `ModelBatch.push`'s `standing:
'outline'`), measured at 1, 0.6 and 0.35 and **set to 0.6, which is not the outline the owner
first saw** (1 restores it): the elite's outline is still gold, dimmer, and stands 27.7–35.1 from
a Focused foe's in normal vision (27.2–36.1 protanopia, 29.2–32.6 deuteranopia, 28.5–33.3
tritanopia); at 0.35 it is a dull bronze, 39.5–46.3. Its body's gold, Focus and every other cue
are untouched. What 0.6 costs: under the red-green settings a dim gold outline is nearer a
rank-and-file foe's red one (elite to rank-and-file at rest, outline to outline: deuteranopia
15.8–18.5 at 1, 3.6–14.5 at 0.6; protanopia 22.5–28.6, 9.7–20.7; on main both were dark lead, 0 to
6, and the crown told them apart, as it still does), and under tritanopia it is nearer the
Weaver's own outline (20.6–25.7 at 1, 15.1–16.4 at 0.6; normal vision 31.2–35.7, 28.7–30.5).
Against the gold hexes the elite's outline as rendered is 35.4–38.2 from the Weaver's gold
(`#f5d78e`) and 44.8–47.4 from Resonance (`#fff4d6`) in normal vision. A gold outline does not
crowd a telegraph (the Finale's voices staged as elites: 68 from the lethal ring and 32 from the
threat ring in normal vision; nearest under protanopia, 17 from the lethal ring, the figure's edge
on it 29 against main's 35). Pictures: `shots/elite-focus-<world>.png`,
`shots/elite-outline-strengths.png`, `shots/tele-crucible-elite.png`.

**The states that replace or sit beside the standing rim.** Hover, Focus, an affix rim, a risen
foe's grave-light and its ash rim after, the Stolen Verse, Stasis's frost, a hit flash and the
dissolve, each on a red-outlined foe beside the same frame on main (`shots/rim-states.png`). Every
one of them replaces the standing rim's colour, so the outline takes the state's colour exactly as
it did on main (hover `#dcd9d6` against main's `#e2dde3`; the grave-light, the frost, the Stolen
Verse and the dissolve's edge identical to main's). What is smaller is the step from the resting
outline, because that is now red, not near-black (the outline's median colour in the state against
the same build's at rest, ΔE, normal vision / the weakest vision; main, then now): hover 83.5 /
83.0, now 49.4 / 43.3; Focus 78.6 / 74.7, now 32.9 / 26.2; the grave-light 86.8 / 86.1, now 54.8 /
48.1; a risen foe's ash rim 53.4 / 52.8, now 30.0 / 22.2; the Stolen Verse 85.0 / 80.1, now 59.1 /
41.8; frost 84.8 / 84.1, now 53.2 / 47.6; dissolving 94.2 / 82.1, now 58.3 / 45.3. The weakest is
the hit flash, which does not replace the rim but whitens the figure over it: on the outline 43.3 /
42.3 on main, 19.9 / 10.9 (protanopia) now, the flash on the body unchanged. The affix rim
(Shielded, an elite) is drawn as on main, inside its shield; its crown's outline is the dimmed
gold. Staging: the lab's real fight, the sim waiting where it can; the rise is staged by setting
the foe's own state as the sim sets it.

Not checked here: Emboldened's mirror shimmer, which takes the same path as the rims above; a
real graphics card (all of this is software rendering).


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
Phase 8c re-recorded one file, `tests/renderShellRims.test.ts`, to the owner's fourth look: both
constants on, a rank-and-file foe's rim edge-only and not standing, an elite's gold and its
crown's marked as carried by the outline, the two outline strengths (the hostile red's 1, the
elite's gold's 0.6) and the shader's lines for them; the Weaver at rest is still standing. No
snapshot, hash or picture pin moved, and `tests/aura` passes with both pin files untouched.

Found on the way: model building drew three.js ids from the shared `Math.random`, so a model built
once per process shifted a seeded test's random stream between runs; building now runs on its own
fixed-seed generator (`models/ownRandom.ts`).

### Known weak, and what stills cannot show

- The Hollow Cantor stands behind the boss panel for the first half minute of its fight, and the
  Unweaver and the Conductor stand at the top edge of the frame: camera and HUD, not figures
  (the audit's change 10). *Since 8c, below: the camera frames the boss.*
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

## 8c: the fight out from under the interface

*Built on `p9/hud` from `19fdec5`. The audit's change 10, which the owner approved as "look at the
panel and the camera next". Nothing in it touches an aura's or ornament's look, the sim, content
or a replay.*

*Landed on main at `eb82ad6` on 18 November 2026, with the red outline (8b, "Phase 8c: the red outline,
checked") and the portraits (8d), and in the playable demo from Version 18 ([docs/demo.md](demo.md)).*

### What was wrong

The bosses of 8b are worth looking at and were often not on show. Measured (below) on main, with
the Skilled bot at seed 4242, through the first minute of each fight on a 1280 × 720 screen:

- The Hollow Cantor's box was on average 76% hidden, the Silent Conductor's 73%, the
  Unweaver's 53%: the party walks north toward a boss that stands some ten metres beyond the
  Weaver, the camera followed the Weaver alone, and the boss ended up under the boss bar or off the
  top of the screen. A boss that got behind the party (Vharun, the Matriarch, the Seamstress) went
  under the Weaver bar instead.
- The boss bar grew down the screen with every line it carried: the cast, a condition, and under
  it the decree, to about 250 px of 720. The decree's banner, a new foe's card, the news toasts and
  the coach's hints were all drawn over the arena's middle.
- A telegraph's answer chip sits on the telegraph's edge, which is often a hero or the Weaver:
  the worst sample had 44% of the Weaver under one.
- The key-reminder panel was not permanent, as the audit took it to be (its pictures were taken
  by jumping straight to a boss): it showed in the first two fights of every run. That is still
  every run, for good.

### The measurement

`tools/hud-cover.mjs` (its header has the options) plays each boss and miniboss fight and one
skirmish per world in the real game, and samples every two seconds through the first minute, at
1280 × 720 and 1920 × 1080: the box each living boss, hero and the Weaver is drawn in
(`__AW__.figures()`, `src/app/figureBoxes.ts`: the figure's upright box at its drawn size), and the
share of that box under an interface piece or off the screen. An interface piece is anything
painted in the HUD (a background at least half opaque) and the telegraphs' answer chips; the bar
and marks a figure wears over its own head are not counted, and neither is a chip drawn
see-through (below). A boss is judged from three seconds in. The bot is handed the fight before
its first tick, and the tool hashes every command the sim consumed: the hash is the same before
and after for all twenty runs, so the fights compared are the same fights, tick for tick.

It runs on software rendering at a few frames a second, where the sim runs slower than real time
and the camera, which eases in real time, has longer to settle than on a player's machine. The
camera tests (`tests/fightFraming.test.ts`) run the same code at 60 frames a second.

### What changed

**The camera, in a fight that brings a boss or a miniboss** (`src/render/framing.ts`,
`src/render/camera.ts`, `src/app/fightFraming.ts`, `src/app/hudSafeArea.ts`):

- The part of the screen the interface leaves free is measured four times a second from where the
  panels really are: under the boss bar, over the Weaver bar (and over the Thread dial for a figure
  in the dial's columns), right of the party frames, clear of the two top corners' columns. So it
  follows the resolution, the UI scale and wherever Edit HUD layout put the frames and the bar.
  Room for the boss bar's cast row is kept between casts, and for the whole bar before the boss
  has arrived (both from the UI's own scale), and a lower edge that shrinks is held for six
  seconds, so the camera does not nod with every cast.
- The camera's focus leans toward the boss, by the least that puts everyone in the free part, and
  never more than 9 m north or south, nor 9 m east or west. With everyone already in view it does not move at all. It leans whichever
  way the boss is: north as the fight opens, south for a boss that has got behind the party.
- When the fight is deeper or wider than the free part shows, the camera also pulls back, by at
  most half again as far (and never beyond the mouse wheel's own furthest, 42 m). As the party
  closes with the boss it comes back in.
- Order of who matters: the Weaver is kept wholly in the free part on every frame, eased or not.
  A hero who is in view is never pushed more than a fifth out of it to show the boss. Then the
  boss, then heroes who were out of view anyway.
- A fight opens already framed on the spot the boss will arrive at (the director's own rule for
  it), so no fight begins with a camera move, and the boss walks into a view that is waiting.
- It eases: about a second to settle. Under Reduced motion On it eases sixteen times more slowly
  (about twenty seconds to settle, 2.5 m a second at its fastest in the test), and the opening
  framing is taken at once, as it is with motion on. Reduced motion already let the camera follow
  the Weaver; it still does.
- Fights with no boss or miniboss get none of this. Their camera is, to the last bit, the camera
  they had (`tests/fightFraming.test.ts` compares positions and rotations frame by frame, with a
  shake and a zoom-punch in it).
- Aiming: the mouse's ground point is read through the camera as the rig last set it
  (`groundUnder` in `src/render/stage.ts`, which `Stage.pickGround` now calls). The test picks the
  ground under four pixels on 200 frames of a leaning, pulling-back camera, and each picked point
  draws back under its pixel to a millionth of a pixel; a hero's feet, drawn then picked, come
  back as the hero's own place. The pad aims by party slot and never read the camera.
- The sim is only read: a miniboss fight framed and the same fight unframed end on the same hash.

**The HUD** (`src/ui/hud/Hud.tsx`, `BossBar.tsx`, `Callouts.tsx`, `CoachHints.tsx`, `KeyHints.tsx`,
`PauseMenu.tsx`, `hints.ts`; `src/render/overlay.ts`):

- **A notes column at the top right**, on a screen at least 1180 px wide. Text to read goes
  there, off the arena's middle: the key reminders (while they show), the boss's decree (its
  banner as it is announced, then its standing line, no longer cut to two lines), a new foe's or
  ally's card, the news toasts and the coach's hints. On a narrower screen all of them stay where
  they were. The big moment banners (Perfect Ward, Saved), Fermata's hold and the Grand Silence's
  notes are where they were at every width.
- **A slimmer boss bar**: 8 px from the top edge instead of 16, its numbers on the health bar
  itself instead of on a row under it, tighter padding. About 36 px shorter while casting
  (158 px to 120 px at its lower edge), and far shorter once the decree is out of it.
- **The key reminders** show in a player's first four fights, counted for good on the device
  (with the coach hints' own counts), then leave the screen. The pause menu has **Controls**,
  which shows the same list at any time and any screen width, pad included.
- **The answer chips** are about a seventh smaller, and a chip that would cover a hero, the Weaver
  or a boss is drawn beside, under or over a figure near it instead (never more than 120 px from
  its telegraph's edge). One with no free place that near stays on the edge and is drawn at 45%,
  so the figure under it reads; its answers are also on the boss bar's cast row. A chip clear of
  every figure is exactly where it was.

### The numbers

The share of a figure's box that is hidden, as *worst sample* / *average over the samples*, in
the first minute, Skilled bot, seed 4242. "Before" is main (`19fdec5`) with the tool added.

**1280 × 720**

| Fight | Boss: before | Boss: now | Heroes: before | Heroes: now | Weaver: before | Weaver: now | Furthest lean, pull-back |
|---|---|---|---|---|---|---|---|
| First Light (skirmish) | - | - | 53% / 4% | 49% / 1% | 40% / 2% | 9% / 1% | none |
| The Bellwarden | 92% / 30% | 5% / 0% | 79% / 5% | 33% / 1% | 28% / 3% | 36% / 1% | 6.0 m, ×1.50 |
| The Hollow Cantor | 90% / 76% | 1% / 0% | 81% / 3% | 7% / 0% | 32% / 1% | 0% / 0% | 6.5 m, ×1.50 |
| The Crimson Gate (skirmish) | - | - | 100% / 7% | 100% / 4% | 0% / 0% | 0% / 0% | none |
| The Gorehound Matriarch | 88% / 33% | 15% / 1% | 77% / 3% | 9% / 0% | 36% / 2% | 9% / 0% | 6.0 m, ×1.50 |
| Vharun | 91% / 42% | 20% / 3% | 98% / 11% | 47% / 2% | 44% / 4% | 0% / 0% | 6.3 m, ×1.50 |
| The Frayed Threshold (skirmish) | - | - | 77% / 9% | 73% / 4% | 15% / 1% | 0% / 0% | none |
| The Seamstress | 89% / 35% | 17% / 1% | 100% / 12% | 34% / 1% | 36% / 2% | 36% / 1% | 6.2 m, ×1.50 |
| The Unweaver | 100% / 53% | 17% / 1% | 100% / 14% | 13% / 0% | 36% / 1% | 0% / 0% | 6.1 m, ×1.50 |
| The Silent Conductor | 100% / 73% | 52% / 9% | 100% / 33% | 27% / 1% | 33% / 5% | 0% / 0% | 9.5 m, ×1.50 |

**1920 × 1080**

| Fight | Boss: before | Boss: now | Heroes: before | Heroes: now | Weaver: before | Weaver: now | Furthest lean, pull-back |
|---|---|---|---|---|---|---|---|
| First Light (skirmish) | - | - | 9% / 0% | 3% / 0% | 18% / 1% | 4% / 0% | none |
| The Bellwarden | 92% / 13% | 0% / 0% | 21% / 1% | 10% / 0% | 13% / 1% | 24% / 1% | 5.8 m, ×1.24 |
| The Hollow Cantor | 93% / 51% | 13% / 1% | 20% / 0% | 4% / 0% | 10% / 0% | 0% / 0% | 6.9 m, ×1.40 |
| The Crimson Gate (skirmish) | - | - | 43% / 1% | 39% / 1% | 0% / 0% | 0% / 0% | none |
| The Gorehound Matriarch | 93% / 20% | 5% / 0% | 84% / 3% | 4% / 0% | 24% / 1% | 20% / 1% | 5.8 m, ×1.23 |
| Vharun | 93% / 29% | 37% / 1% | 27% / 2% | 4% / 0% | 15% / 1% | 0% / 0% | 7.3 m, ×1.46 |
| The Frayed Threshold (skirmish) | - | - | 61% / 4% | 57% / 1% | 0% / 0% | 0% / 0% | none |
| The Seamstress | 91% / 12% | 0% / 0% | 57% / 3% | 13% / 0% | 27% / 1% | 0% / 0% | 6.1 m, ×1.29 |
| The Unweaver | 94% / 37% | 2% / 0% | 51% / 3% | 4% / 0% | 24% / 1% | 0% / 0% | 7.5 m, ×1.48 |
| The Silent Conductor | 94% / 52% | 10% / 1% | 100% / 11% | 33% / 1% | 21% / 1% | 6% / 0% | 9.6 m, ×1.50 |

The targets were: no boss more than a quarter hidden at any sample after the first three
seconds; no hero and never the Weaver more than a quarter hidden at any sample; the skirmishes no
worse than before.

Counted over the seven boss and miniboss fights (199 boss samples, 642 hero samples and 217
of the Weaver at each size), a sample "over" is one with more than a quarter hidden:

| | Bosses: average hidden | Bosses: samples over | Heroes: samples over | Weaver: samples over |
|---|---|---|---|---|
| 1280 × 720, before | 48.5% | 140 of 199 | 105 of 642 | 12 of 217 |
| 1280 × 720, now | 2.1% | 4 of 199 | 9 of 642 | 2 of 217 |
| 1920 × 1080, before | 30.3% | 93 of 199 | 29 of 642 | 1 of 217 |
| 1920 × 1080, now | 0.4% | 1 of 199 | 2 of 642 | 0 of 217 |

**Met**: at 1920 × 1080 the Weaver at every sample, and every boss but one sample; at 1280 × 720
six of the seven bosses at every sample (the Cantor, hidden 76% on average before, is never more
than 1% hidden). The three skirmishes are no worse for any figure at either size. Their camera
is untouched; with the toasts and the chips moved, the average hidden share of a figure in them
fell from 5.3% to 2.4% at 1280 × 720 and from 1.6% to 0.7% at 1920 × 1080.

**Not met**, and why:

- *The Silent Conductor at 1280 × 720*: four samples of 28 between 36% and 52% hidden (9% on
  average, from 73%). Its boss bar carries the Discord stave and a Cue's line as well as the cast,
  and reaches 31% of the way down a 720-line screen. With the Weaver bar that leaves 44% of the
  height for a fight that is at times sixteen metres deep, with the camera already as far back
  as it goes. At 1920 × 1080 the Conductor is never more than 10% hidden.
- *Vharun's leap at 1920 × 1080* (one sample, 37%): Impale carries him eighteen metres in one
  tick, to behind the party, and the sample fell on that tick. A camera that eases cannot be there
  already; half a second later it is.
- *The Weaver, twice at 1280 × 720* (36% both times), and four of the nine hero samples: the
  caption of a moment banner (Saved, Clutch) crossing them for the second or two it shows. Those
  banners were left where they are: they are the game's applause for the player's own save, some
  of them announce Fermata's, and they were not on the list the owner approved. Before, the same
  banners and the toasts beside them accounted for 18 such samples at this size; now 6, and none
  at 1920 × 1080.
- *The other five hero samples at 1280 × 720 and two at 1920 × 1080*: Lyra or Kael for a moment
  under the Weaver bar, the Thread dial, the party frames or a hero's speech bubble beside the
  frames, when a dash or a leap strings the party out further than the pulled-back camera shows
  (Kael is eighteen metres from the Weaver in the Conductor's fight at 34 s).

### Tests

New: `tests/fightFraming.test.ts` (the safe area from the panels; the lean both ways; no move
when all are in view; a boss-less fight's camera bit for bit; the bounds; the Weaver in view on
every frame of a forty-second scramble; smoothness when a boss leaps twenty metres; a hero in view
kept in view; the opening framing; Reduced motion; aiming; the sim's hash), `tests/figureBoxes.test.ts`
(the measured boxes are where the figures are), `tests/hudNotes8c.test.ts`,
`tests/keyReminders8c.test.ts`, `tests/answerChips8c.test.ts`, and `e2e/framing.spec.ts` (a
miniboss fight in the real game: the boss under the boss bar's edge, the Weaver over the Weaver
bar's, the notes column clear of the boss bar, Controls in the pause menu). No pinned picture,
hash or snapshot was re-recorded.

### Known weak, and for the owner

- The camera pulls back by up to half again as far while a boss walks in (it stands seventeen
  metres from the Weaver for the first few seconds), and figures are then two thirds their usual
  size on screen. Every fight reached ×1.50 in its first ten seconds at 1280 × 720, and between
  ×1.23 and ×1.50 at 1920 × 1080. From twelve seconds in, the camera sat at its usual distance
  half the time or more in every fight but the Conductor's (median ×1.00 to ×1.08 at
  1280 × 720, ×1.00 at 1920 × 1080; the Conductor's ×1.50 and ×1.16), with a median lean of
  0 to 5 m and never more than 6.3 m outside the Conductor's fight (9.6 m there, most of it
  sideways). The limit (`MAX_PULL` in `src/render/camera.ts`), the longest lean (`MAX_LEAN`,
  9 m north or south and 9 m east or west) and the easing (`FRAME_RATE`) are one line each: the
  owner's call. With no pull-back at all, the opening seconds cannot show the boss and the Weaver
  together on a 720-line screen.
- A hero in view is never pushed out of view to show the boss. When the party stands far behind
  the Weaver and the boss far ahead, the boss is the one that loses its head to the boss bar.
- The moment banners, above. Two cheap answers, for the owner: drop the dark plate behind the
  caption (a soft shadow instead), or show the caption in the notes column and keep the word.
- The Conductor's boss bar at 1280 × 720, above: it could carry the Discord stave on one line
  with the health bar. Not done here: it is the Finale's own interface (docs/phase-5d.md).
- Under Reduced motion On the framing eases about sixteen times more slowly, so a boss that
  leaps behind the party stays out of view for several seconds; the Weaver is in view throughout.
- The key reminders are counted on the device, like the coach hints: a second player on the same
  device does not get them again, and has Controls in the pause menu.
- The notes column can grow long in a player's first fights (the key reminders, a decree, a new
  foe's card and a hint together reach about 530 px on a 720-line screen).
- Measured on software rendering, at a few frames a second, with one bot at one seed. Nobody has
  watched the camera move at 60 frames a second on a real graphics card.

### The marks on the larger heroes

Heroes are drawn 12% larger since 8b, and the marks placed from a hero's height stayed where they
were (aura and ornament drawing changes only when the owner approves that change). Seven proposals
were built, each as its own commit and its own before-and-after sheet. Each places one mark from
the hero's drawn height instead and changes nothing else: +0.24 m on Kael and +0.22 m on Lyra for a
mark over the head.

**The owner approved five on 18 November 2026** ("Approve the five you recommend"), and they are
on main and in the demo from Version 19:

| | Mark | Entries of `tests/aura/presentationPin.json` re-recorded (of 627) |
|---|---|---|
| M1 | the beam song's ring and its "All in" ring | 80 (`field`, all 8 samples of the ten beam-song cases) |
| M2 | the Calling halo | none |
| M4a | the Mend / Empower glyph | none |
| M4b | call prompts, with their glow and stars | none |
| M5 | Fermata's glyph, with its flare, callout and shards | 10 (`fermata`, samples 4 to 8 of the two Fermata cases) |

The pin was computed on the approved tree and compared with the recorded file: exactly those 90
entries differ, and the other 537, the field shader's hash and the markup are byte for byte as
recorded. The re-record is one commit (`9ed4ee6`), named in `AURA_APPROVED` in
`tools/release-check.ts`: the release check now compares the eight aura files with that commit
and accepts it in the pin's history, and a test holds the list to commits that touched the pin.
M1 and M5 edit two of the eight files (`src/render/field.ts`, `src/render/fermata.ts`), one line
of placement each.

**Not taken** (no strong case; still built on `p9/marks`): M3, where the Sunrise beam ends, and
M4c, where the Thread meets the hero (it would move 80 `beam` entries).

**The rest of the marks that are not aura, ornament or Calling drawing** were raised the same way
afterwards (`p11/marks`), one line of placement each and nothing else: a mark over a hero or the
Weaver is lifted from the drawn height (`height * HERO_DRAWN`, or `drawnHeight(rec)` where the same
mark is also drawn over enemies, which are not drawn larger and keep theirs).

- Seren's crossed blades and her parry glyph, Oro's tending drop and his closed leaf.
- Stun stars; the Legion's bleed pips and Wound's heart and the Rift's mask, Doom pips and rune
  lock, with the answer badge over them (the bar, the pips and the badge are stacked as
  `crimsonCues.ts` lays them out again: at the game camera the pips had come to touch the bar).
- Bond marks: Oathkeeper's diamond in a ring, Hawk's Vigil's timer, and each talent's name over
  its hero. Relic marks: the Glass Halo, the Cracked Metronome over the Weaver, the Heavy Score's
  weight, and each relic's name over the hero or the Weaver. The Aegis Link's seconds over a lone
  hero, a trigger's mark over its target, the Water Clock's dial, a Grand Silence note's start.
- Damage and heal numbers where they start from a hero's head; the PERFECT, SAVED, REVIVED,
  SNAPPED, CUT, POSSESSED, UNRAVEL, PARRIED and Flourish callouts; the Cue's sigil and Brann's
  refusal glyph.

`tests/renderMarksDrawn.test.ts` holds a sample of them (a hero's from the drawn height, an
enemy's where it was). Neither aura pin moves and none of the eight aura files is touched. One
sheet, Kael and a second figure at the game camera and close: `part1-before-after.png`.

Three things seen while checking them:

- Seren's blades (0.5 m over the head) and Oro's drop (0.45 m) were laid out at the health bar's
  own height (0.42 m), so the bar crosses them, as it did on the old figures. Raised, their upper
  half shows over the bar; before, they sat under it on the head.
- At the player's closest zoom a hero standing up the screen from the Weaver has about 3 m of
  view over his head, and less while the aim pulls the camera down the screen. The status badge
  (2.6 m over the head) was at that edge already and is cut there now; with the aim at the
  bottom of the screen the bleed pips and a heal number over such a hero reach the edge too
  (`part1-closest-zoom.png`). At the default zoom and in a boss fight's pulled-back view
  everything is inside. Not changed: the cure, if one is wanted, is in the camera or the overlay,
  for every mark at once.
- Not moved, because they are not marks over a head: a beam's or a pillar's far end, shells, the
  Lantern rising from a fallen hero, and everything placed part of the way up the body (the chest
  anchors).

**Proposed, not landed** (`p11/marks-proposals`, one commit and one "Now / Proposed" sheet each,
the owner's to approve one by one; the aura pin's tests fail on that branch on purpose):

| | Mark | Entries of `tests/aura/presentationPin.json` it would move (of 627) |
|---|---|---|
| P1 | the pour's label | 80 (`beam`, all 8 samples of the ten beam-song cases) |
| P2 | the Luminary's Dawn callout, Radiance shaft and Sovereign circlet | none |
| P3 | the Martyr's seals and ember | none |
| P4 | the Chronomancer's mastery mark and Stasis clock | none |
| P5 | the Conductor's sigil, Marcato mark and Spotlight | none |
| P6 | the target mark over a hero, with Foresight's outline of it | none |
| P7 | Fermata's shell round the held hero | 10 (`fermata`, samples 4 to 8 of the two Fermata cases) |

P6 is held back from the set above because the Chronomancer draws that mark too (Foresight's
outline, Paradox's mark flying back) and the two must move together. P7 is the only chest anchor
whose move shows; the song's glow, the pour's splash, the Vow's tethers and a call's answer beam
were built and compared and show no difference (`chest-anchors-compared.png`). The Tyrant's crown
and edict are over the boss, which is not drawn larger: nothing to raise.

## 8d: portraits and the map's rewards

*Built on `p9/codex`, from the visual audit's two small gaps outside the fight (section 7, "The
Codex" and "The map"): nothing outside a fight showed the stained-glass figures, and a map stop
showed what it gives only on hover. No aura or ornament, and nothing in `src/sim`, `src/content`
or `src/meta`, is touched.*

### Portraits in the Codex

Every hero, the Weaver and every enemy met now has a small picture of its real figure in the
Codex: the fight's own model (`models/library.ts`) under the fight's own material, drawn offscreen
to a 256 × 256 picture and kept.

- **Where.** A hero's card shows its portrait (88 px) in place of the letter disc. An enemy's
  entry shows its portrait beside its name and words (96 px; a boss or miniboss 128 px). An enemy
  not met yet stays the locked silhouette it was. The Weaver's page opens with a card of her own:
  her portrait (112 px) and the robe and Thread look she wears. The Auras and Songs pages are
  untouched.
- **The view.** One for all (`PORTRAIT_VIEW`, `src/render/portrait.ts`): the figure turned
  three-quarter toward the light (the art studio's `close` turn), seen from 12° above with no
  perspective, as the fight's far camera all but sees it. The frame is fitted to the model's own
  vertices (`framePortrait`), so its longer side always spans 86% of the picture: a Leech and the
  Bellwarden both fill their frames, and a hound is framed by its length. The outline is 1.5
  picture pixels whatever the figure's size.
- **The light.** Each figure stands in its own world's light, the fight's own numbers
  (`arenaMood`, and `applyArtWorld` for the dark worlds' fit of the glass): a hero and the Weaver
  in the Reliquary's warm light, an enemy in its Movement's (the Reliquary, the Spire, the Rift,
  the Crucible). The picture is transparent round the figure; the dark surround is the page's
  (`Portrait.tsx`): a glow behind the figure in the page's navy for a hero and the Weaver, in the
  world's own air for an enemy, falling to the page's ink.
- **As the fight draws them at rest**, with two differences. Heroes and the Weaver are drawn at
  the art pass's 1.12, and the Weaver wears her resting rim (her robe's trim, which is how a dark
  robe reads). A foe is drawn **without** the fight's faint red hostile rim: that rim is a cue for
  telling a foe from the floor, and in a portrait it turned the Rift's indigo violet, the Legion's
  obsidian red and the Choir's black cassocks maroon
  (`/home/user/aw-work/9/codex/shots/portraits-hostile-rim-compared.png`: each pair of rows, with
  the rim above and without below).
  No ribbons, rings, shadows or crowns: the figure alone.
- **What she wears.** The Weaver's portrait is built from `weaverPalette(look, vision)` and
  `restRim`, the very calls the fight makes, so each robe is another picture, and her hands take
  her Thread look's colour as the colour-vision setting fits it.
- **Colour vision.** A figure's own colours do not change with the colour-vision setting in a
  fight (they were chosen to stay clear of every palette, 8b's Colour); only the Weaver's hands in
  a Thread look do. Portraits follow exactly that: one picture of each hero and enemy for every
  setting, and the Weaver's redrawn when her look or the setting changes it.

**How it is drawn** (`src/ui/kit/portraitStore.ts`, `src/render/portrait.ts`).

- The drawing code, and three.js with it, is loaded only when a portrait is first wanted; the
  Codex itself is as light to open as it was.
- One small studio (one WebGL context, 256 × 256) is opened when pictures are wanted, draws them,
  and is closed: its context is given back at once (`forceContextLoss`). Nothing is held open
  while nothing is being drawn, and never beside a fight: while a fight's canvas is on screen no
  studio opens, and one that is open stops before its next picture and closes.
- What is on screen is drawn first; then the rest of what this Codex can show (its heroes, the
  Weaver, the enemies met), so every page is ready when it is turned to. Closing the Codex drops
  what is not drawn yet. The work is spread: about 8 ms of drawing, then the browser gets its turn.
- Each model is built, drawn and freed; only the pictures are kept (PNG data, at most 16 of the
  Weaver). A picture is keyed by what it shows and never drawn twice.
- **Where WebGL is not to be had** (the unit tests, a refused or lost context) nothing is drawn
  and the Codex shows exactly what it showed before: the letter discs, no picture on an enemy's
  entry, no Weaver card. Compared once against main's `CodexScreen.tsx` at `19fdec5`, the pages
  rendered without WebGL (Heroes at three and six, Enemies all met and one met, The Weaver, Calls)
  are byte-equal.

**Readings** (the production build, Chromium with software rendering (SwiftShader), a machine
shared with two other jobs; `measure.mjs`, `lab.mjs` and `labseq.mjs` in
`/home/user/aw-work/9/codex/scripts/`, the pictures in `/home/user/aw-work/9/codex/shots/`).

| what | reading |
|---|---|
| Pictures a veteran's Codex draws (6 heroes, the Weaver, 30 enemies) | 37, in one studio, one draw call each (480 to 5,748 triangles a figure) |
| Time to draw all 37, the page's backdrop held still | 6.2 to 8.6 s: the first 1.1 to 2.5 s (the figures' shader is compiled for it), then about 130 to 170 ms each |
| The same with the page's backdrop animating | 26 to 29 s in the UI lab, 77 to 121 s in the game (first picture 13 to 17 s, and 66 to 92 s) |
| Building the 37 models and framing them, no drawing (Node) | 0.4 to 1.3 s of the above |
| Loading the drawing code (three.js and the models) | 60 to 200 ms from the local server |
| Memory held afterwards | the pictures only: 1,642,654 bytes for 37 (about 44 KB each, as PNG data); no canvas in the page, no WebGL context |
| JS heap at a fight's opening frame, after a Codex visit | 28.7 to 29.4 MB, against 27.2 MB on main after the same visit (1.5 to 2.3 MB more; 34 pictures were held, 1.5 MB) |
| JS heap at a fight's opening frame, no Codex visit | 23.9 MB, main 23.8 MB |
| A fight's opening frame (First Light, paused under "How to play") | 21 draw calls, 22,520 triangles: the same on main, on this branch, and on this branch after the Codex drew its pictures |
| The same fight paused at tick 302 to 304 | 22 draw calls, 29,000 triangles, 10 entities: the same in all three |
| A fight's load (choosing the stop to its first frame's readout) | 2.1 to 2.2 s on this branch (with and without a Codex visit), 2.1 to 2.2 s on main |
| Canvases in the page during a fight | 1 (the fight's) |
| The JavaScript bundle | 6,457,259 bytes (1,898,444 gzipped) against main's 6,441,723 (1,892,181): 15.5 KB more (6.3 KB gzipped) |

Two things the readings say that the table does not. First, software rendering shares the
processor between the pictures and the page's own moving backdrop: with the backdrop still
(reduced motion) the Codex's pictures take seconds, with it moving they take many times longer,
and the first one (the shader's compile) longest. A fight on main's build opened after a Loom and
Codex visit took 81 s to its first frame in the same conditions, against 2 s without. A graphics
card composites a backdrop for nothing, so none of this should carry over, but none of it was
measured on one. Second, the fight needs exactly the code it needed, now in three more files
(`artWorld`, `crimsonCues`, `keepsakeCues`: the parts the portraits share with it), and a player
who has opened the Codex has already fetched them.

### Reward glyphs on the map

A stop still ahead that gives something now shows it without a hover: a small dark pill at the
foot of its disc holding one glyph for each reward (`MapScreen.tsx`).

- **The same icons and colours as the hover detail** (`rewardChips`, `CHIP_COLOR`): Aether (the
  Aether glyph, gold), a relic to choose (the relic glyph, orange), a motif (a diamond in its
  rarity's colour: common, rare, epic) and healing (a heart in the live heal colour, so it follows
  the colour-vision setting). The order is the hover detail's.
- **Only where there is something ahead.** A stop walked, and the one you stand on, show nothing:
  they have given what they had. A merchant, a forge and an event have no fixed reward and show no
  pill, as their hover detail lists none. A stop not yet in reach shows its pill a little dimmed,
  like its name.
- **Sized with the text.** The glyphs are 0.875 rem (14 px at 100%, about 11 px at 80%, 21 px at
  150%), so the UI scale carries them; the discs themselves are sized in pixels, as before.
- **The hover detail is unchanged**, and so is the Chord panel. The Movement tints are the page's
  backdrop and are not touched: the pill is the page's ink on every map.
- **Gamepad and screen readers.** The pill sits inside the stop's own button, so the focus ring
  and the stick's steps are as they were, and it is hidden from screen readers: the stop's label
  says the rewards. A stop within reach reads exactly as before (it already named them); a stop
  not yet in reach now names them too ("The Shattered Choir, Elite, not reachable yet. +… Aether…").

### Tests

`tests/uiPhase8d.test.ts` (portraits): every hero, the Weaver and every enemy framed to the same
share of its picture, a known box framed exactly; each figure's world; what a picture is kept by
(a robe is another picture; colour vision moves only her hands in a Thread look); the cache's rules
against a stand-in studio (what is on screen first, one studio closed when done, a picture never
drawn twice, closing the screen drops the rest, nothing beside a fight and a stop when one opens,
a refused and a lost context, the Weaver's pictures bounded); the Codex with pictures (alt text,
sizes, an unmet enemy still locked, the Weaver's card) and without WebGL (the letter discs, no
picture, no card). `tests/uiPhase8dMap.test.ts` (the map): a glyph for each reward of every stop
ahead and none on a stop walked, the tooltip's icons and colours in rem, and the labels read out.
No pinned picture, hash or snapshot moved, and none was re-recorded. `tests/aura` passes with both
pin files untouched.

### Known weak, and what was not checked

- **Only software rendering was measured.** The times above are SwiftShader's on a shared machine.
  On a real graphics card the first picture's shader compile is the part that could be felt; it is
  compiled in the background where the browser allows (`prepare`), which SwiftShader does not, so
  that path ran here only as a no-op.
- **The Legion and the Unweaver are dark figures on a dark surround.** They read by their outline
  against the world's glow and by their lit glass; the Sanguine Hound and the Unweaver are the
  weakest. A lighter surround would read better and suit the page less.
- **No hostile rim** is a choice (above); with it a portrait is closer to the fight and further
  from the figure's own colours. The comparison picture shows both.
- **Thin figures are small in a square frame**: Vexis, the Glass Lancer and the Spindle fill
  their frame's height and little of its width. A bust (the top half only) would show more glass
  and no longer "the whole figure whatever its size".
- **A portrait is a still**: the pose at rest, clock 0. Floating parts (the Stolen Verse, the
  Mimic's shards) are where the model builds them.
- **Portraits appear a moment after the page** (the frame holds the place, empty, then fills).
  Nothing fades in; reduced motion has nothing to stop.
- **A context lost while drawing** leaves the pictures not yet drawn as the old look until the
  page is reloaded; it is not retried.
- **On the map every fight shows Aether, a motif and a heart**, so the pills on a row of
  skirmishes look alike; the relic glyph and the motif's colour are what tell stops apart. The
  pill covers the foot of the disc's ring, most at 150% (the discs do not grow with the text).
- Not checked: a real graphics card, a real screen reader, a gamepad in the hand (the map's focus
  order is untouched), any browser but Chromium, and the Codex opened in the same second a fight's
  canvas is leaving the page (the rule is tested, the moment is not).

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

# Phase 2: Combat presentation (render / VFX)

Phase 2 adds Chords (two fields with ornaments), Fermata holds, the Chorus pulse and the two
signature moments: **the death that didn't happen** (save ghosts) and **Call and Response**.
Everything is still driven only by `WorldState` (persistent visuals) and `SimEvent`s (transient
feedback). The contract is unchanged (CONTRACT v3). Colour vision and flash strength now switch
live from `FrameInfo.settings`.

![Pedal Point + Unison Chords, hexed choristers](vfx/chords-pedal-unison.jpg)

## What was built

| File | Phase 2 work |
| --- | --- |
| `field.ts` | Rewritten as one instanced `FieldBatch` (max 4 fields, **1 draw call**, replacing the single field mesh). Each Chord is drawn at its true centre and radius (`field.chords[i]`, Crescendo included, smoothed), one band per aura in its colour. **Weaver** fields follow the interpolated Weaver and their glyph ticks drift. **Planted** (Pedal Point) fields are anchored: still ticks, an outer staff ring with eight notches, a dashed inner ring, faint spokes, a centre rune, plus a standing **stake** of light (beam, rune head, rising notes). A "pop" ring runs out to the rim when it is re-planted. **Unison** Chords have no disc: a halo rides the threaded hero (counter-rotating dashed ground rings and a crown ring over the head, one per aura colour), or aura motes circle the Weaver's hand while the Thread is loose. The Phase 1 suppression cracks/flicker, Crescendo waves/blaze and hymn circles are kept per field. `centreOf()` gives other layers a Chord's drawn centre. |
| `thread.ts` | Unison: an aura-coloured sheath strand along the Thread and beads of light flowing Weaver → hero. Thread colours now come from the live `mend` / `empower` palette. |
| `entities.ts` | **Per-aura rim lights** from `hero.auraMask`: the hero's foot ring splits into one lit arc per aura (readable with 1–4+), and the fresnel rim is the average of those colours (replaces the single field tint). **Hexed enemies** (`enemy.auraMask`, e.g. Lullaby): a drowsy double swirl over the head plus a dashed ring at the feet in the hex colour. **Fermata freeze-frame**: the held hero's pose freezes (no turning, bob or lunges), desaturates, gets a pulsing lavender rim and a tiny tremor. **Save ghosts** (signature 1): a pooled ghost of the saved hero (same instanced model, so no extra draw call) buckles, topples onto its back and dissolves in gold over ~1 s with an ashen glow and ring, while the real hero keeps fighting. Ghosts are de-duplicated per hero (a Fermata save sends both `fermataReleased` and `save`). The hero batch capacity went from 4 to 8 to fit the ghosts. |
| `calls.ts` (new) | **Call and Response** (signature 2), from `hero.call`: a gold call glyph (round bubble with the answer's icon: Ward shield, Empower chevrons, Chime bell) over the hero, its **countdown ring** running out to `call.end`, the answer's name under it, a matching countdown arc at the feet, a beckoning ring and gold motes. Gold is `visionPalette().call`, never threat amber or lethal red. When the hero is answered, the bubble fills and names the Flourish. When the call closes, an answered glyph bursts and a missed or cancelled one turns grey and sinks away. A `preview` map lets the lab stage calls synthetically. |
| `fermata.ts` (new) | **Fermata holds**, from `hero.hold` (or status `held`): a glassy stillness shell, a **𝄐 fermata glyph** over the head (new sprite style), a lavender **ring timer** at the feet running out to `until`, a dashed heal ring, motes hanging motionless in the air, and a **heal-answer badge** (Heal icon, countdown ring, "Heal 1.2s"). Once `hold.savedBy` is set (healed in time), everything turns heal-coloured and the badge reads "Saved" until the release. |
| `feedback.ts` | New events. `save` → save ghost + ash. `fieldPlanted` → streak from the old centre, a stake driven down, impact rings, sparks, dust and a small kick. `chorusPulse` → each Chord's field rings out once per aura in aura colours (Weaver fields follow the Weaver, Unison rings at the threaded hero) plus heal and barrier rings and notes, thicker with more auras. `fermataHold` → a lavender flare snapping inward, a spotlight and "HOLD". `fermataReleased` → saved: heal flare, rings, the glyph shattering and the ghost; not saved: the glyph cracks and falls (the downed visuals come from state). `callStarted` → a gold ring and star. `callAnswered` → a gold link Weaver → hero, a burst and a push-in. `flourish` → **Bulwark**: a hero-colour shockwave edged in gold at 1.5× radius, a shield flare and gold tethers to every enemy caught. **Heartseeker**: a wide gold lance with an emerald core cut through the whole line, with crit stars along it. **Resonant Starbolt**: a bell ring, a violet burst, a portal swirl, a light column, shards and notes. Each also gets a gold callout with the Flourish name. Flashes are no longer gated per call site: the overlay scales them. Heal numbers and the "REVIVED" callout use the live heal colour. |
| `overlay.ts` | Pooled **glyph bubbles** (SVG countdown ring + icon + label) for calls and Fermata, plus `mend` / `empower` icons. `setFlashScale()`: flash, chromatic pulse and danger pulse scale with `settings.flashes` (0 cuts them, and any running flash). `setPalette()`: the danger edge, raid edge and banner, and the threatened-arrow colour follow the lethal colour. |
| `palette.ts` | The semantic colours (`heal, shield, amp, ailment, threat, lethal, mend, empower, call`) are **live**: `applyVision()` rewrites them in place from `visionPalette()`, so every batch and uniform holding them switches on the next frame. `VISION_HEX` gives the same palette to DOM layers. `auraColor(id)` and `rgba()` are new helpers. The shared `color()` cache is never mutated. |
| `fx/telegraphBatch.ts`, `telegraphs.ts` | Severity colours are uniforms bound to the live `C.threat` / `C.lethal`, and badge borders use `VISION_HEX`. **Lethal is never colour alone**: stronger marching hatching (0.2 → 0.34) plus a throbbing second rim outside the shape. |
| `fx/sprites.ts` | New styles: `fermata` (𝄐) and `timer` (a countdown ring, with a `param` argument). |
| `fx/kit.ts` | Ring batch capacity 256 → 384 and overhead sprites 32 → 48 (instances, not draw calls). |
| `combatView.ts` | Wires `CallView` / `FermataView`, applies the colour-vision palette and flash scale each frame (`applyVision` is a no-op unless the setting changed). |
| `lab/VfxLab.tsx` | Phase 2 scenarios (see below), deterministic `manual()` frame stepping for screenshots, slow-mo that slows FX too, and a fix so the grammar sheet's non-damage cast circle uses its effect. |
| `tests/render.test.ts` (new) | The palette switches live per colour vision, never mutates the shared cache, and gives every aura its content colour. |

## Seeing each visual in the lab (`?lab=vfx`)

The **Scene** panel has new controls: **Chords** (a loadout, recreates the sim through
`SimConfig.chords`), **Colour vision** (live), and **Flashes** 0–100%. Loadouts:

| Loadout | Chords |
| --- | --- |
| `classic` | Sostenuto + Fortissimo (Phase 1) |
| `pedal + unison` (default) | Lullaby + Sostenuto [Pedal Point, Grace Note] · Fortissimo + Fermata [Unison] |
| `reverb + weaver` | Sostenuto + Ostinato [Reverb, Grace Note] · Allegro + Fortissimo: two Weaver fields, four aura arcs per hero |
| `pedal + weaver` | Lullaby + Ostinato [Pedal Point, Grace Note] · Sostenuto + Fermata |
| `unison only` | Allegro + Fortissimo [Unison] |

| Visual | How |
| --- | --- |
| Per-Chord fields, aura arcs, Unison halo / Thread glow | pick a loadout, **Weaver → Thread** a hero (Unison rides that hero) |
| Planted field + `fieldPlanted` | **Phase 2 · Chords → Plant ↗ / Plant ↙ / Plant at cursor** (real `{t:'plant'}`, 2 s cooldown) |
| Hexed enemies | `pedal + unison`, **Hex targets** (choristers in the Lullaby field) |
| Chorus pulse | **Chorus pulse** (synthetic `chorusPulse` with the live aura count) |
| Save ghost | **Phase 2 · Moments → Save ghost / Save ghosts ×3** (also on the old *Save* inject) |
| Calls (real sim) | **Force call (sim)** = `{op:'forceCall', slot}`, then answer it (Ward / Empower thread / Chime on the hero) |
| Calls (synthetic) | **Stage call**, **Answer → Flourish**, **Miss call**, **Flourish only** |
| Fermata (real sim) | **Force hold (sim)** = `{op:'forceHold', slot}`, then Thread (Mend) the hero to save them, or wait |
| Fermata (synthetic) | **Stage hold**, **Hold → saved**, **Hold → downed** |
| Colour vision / lethal hatching | **Telegraph grammar** + the Colour vision select |

`window.__VFX__` exposes all of it (`setLoadout`, `setSettings`, `stageCall`, `answerCall`,
`missCall`, `flourish`, `stageHold`, `releaseHold`, `save`, `chorus`, `plant`, `zoom`,
`setSlow`, `manual(frames, ms)`, `resume`). `manual()` freezes the real-time loop and renders
fixed frames, so screenshot scripts capture the same moment every time even though SwiftShader
runs only ~4–6 frames a second.

## Verification against the real sim

The lead's call/hold/Flourish code landed during this session, so the visuals were checked
against the real sim, not only synthetic events:

- `forceCall` on Kael → `hero.call` non-null (`answer:'ward'`), gold "Ward" bubble with a
  countdown. A Ward on him → `answered:true`, the bubble fills and reads "Bulwark", with the link
  and burst ([call-real-sim](vfx/call-real-sim.jpg), [answered](vfx/call-answered-real-sim.jpg)).
  A headless probe also saw `callAnswered` → `flourish {name:'Heartseeker', x, z, radius:1.12}`
  for Lyra and `callEnded missed/cancelled`.
- `forceHold` on an unthreaded Lyra → `hero.hold` non-null, freeze-frame, glyph, timer and Heal
  badge. Threading her (Mend) sets `savedBy:'mend'` → the heal-coloured "Saved" state, then the
  release, the save ghost and SAVED ([healed](vfx/fermata-healed-real-sim.jpg)). On Vexis, left
  alone → `fermataReleased {saved:false}` and the normal downed visuals ([not saved](vfx/fermata-not-saved-real-sim.jpg)).
- `{t:'plant'}`, `field.chords` (anchors, radii, `threadHero`), and `hero.auraMask` / `enemy.auraMask`
  come from the real sim in every Chord screenshot.

## Performance

Same machine and tools as Phase 1 (SwiftShader, so no meaningful FPS).

| Measure | Before (Phase 1 code) | After |
| --- | --- | --- |
| e2e perf test (busy fight, 137 entities, high), draw calls | 30 | **30** |
| e2e perf test, frame ms (mean / p95) | 9.5 / 14.7 | 10.9 / **12.0** |
| Lab busy fight (25 enemies + Bellwarden, `classic` Chord) | 36–37 | **36** |
| Lab busy fight, `pedal + unison` (planted field, Unison, a call and a hold) | n/a | **38** |
| Lab Phase 2 scenarios (single moments) | n/a | 22–34 |

No draw calls are always-on additions: the instanced field batch replaces the old field mesh
(one call for up to four fields). Ghosts reuse the hero's instanced model, and every other
visual rides the existing ring, sprite, beam, shell, ribbon and particle batches. Call and
Fermata glyphs are pooled DOM elements. The +2 in the Phase 2 busy fight are existing batches
that only draw when something uses them (such as the overhead sprites of the glyphs); there are
no new materials. Hot paths allocate nothing new: aura
colours are cached per coverage mask and records are pooled per hero. As in Phase 1, the only
per-frame allocations are DOM strings in the overlay (transforms, bubble labels and ring offsets).

## Screenshots

| | |
| --- | --- |
| ![](vfx/chords-pedal-unison.jpg) Pedal Point field (staff ring, rune, stake) + Unison on Lyra (halo, Thread beads); choristers drowsing under Lullaby | ![](vfx/chords-reverb-weaver.jpg) Two Weaver fields (Reverb wider) and four aura arcs at each hero's feet |
| ![](vfx/field-planted.jpg) Re-planting: streak from the old centre, stake impact, pop ring | ![](vfx/chorus-pulse.jpg) Chorus pulse ringing out of both fields in aura colours |
| ![](vfx/save-ghost-buckle.jpg) Save ghost: the copy buckles as SAVED lands | ![](vfx/save-ghost-fall.jpg) …and falls on its back, dissolving, while Lyra fights on |
| ![](vfx/call-glyphs.jpg) Calls: Kael wants a Ward, Vexis a Chime (countdown rings) | ![](vfx/call-real-sim.jpg) A real `forceCall` on Kael |
| ![](vfx/call-answered-real-sim.jpg) Answered: the glyph fills and names the Flourish, gold link and burst | ![](vfx/flourish-bulwark.jpg) Bulwark: wide Challenge, shield flare, gold taunt tethers |
| ![](vfx/flourish-heartseeker.jpg) Heartseeker: a wide gold lance with crit stars | ![](vfx/flourish-resonant-starbolt.jpg) Resonant Starbolt: bell ring, violet burst, light column |
| ![](vfx/fermata-hold.jpg) Fermata hold: freeze-frame, 𝄐, ring timer, heal badge, stillness shell | ![](vfx/fermata-healed-real-sim.jpg) Healed in time (real sim): heal-coloured, "Saved" |
| ![](vfx/fermata-released-saved.jpg) Release, saved: heal flare, glyph shatters, ghost | ![](vfx/fermata-not-saved-real-sim.jpg) Not saved (real sim): downed as usual |
| ![](vfx/telegraphs-standard.jpg) Telegraph grammar, standard palette | ![](vfx/telegraphs-deuteranopia.jpg) Deuteranopia: yellow → vermillion, hatching + double rim on lethal |
| ![](vfx/telegraphs-tritanopia.jpg) Tritanopia | ![](vfx/busy-phase2.jpg) Busy fight with a planted field, Unison, a call and a hold |

## Known gaps

- **Flourish styles are chosen by the hero's call ability** (`challenge`, `piercingShot`,
  `starbolt`). A new hero's Flourish gets the generic gold burst until it gets its own.
- **An answered call can stay up for a while**: Kael's filled "Bulwark" glyph stays until the
  sim fires the Flourish, which waits until he can act (in the lab that can be seconds).
- **Hold timer start** is taken from the `fermataHold` event. A view created mid-hold times the
  ring from that moment.
- The ghost is the rigid procedural model toppling (no skinned animation or ragdoll), and the
  dithered translucency reads as stripes up close.
- Off-screen heroes who are calling or held get no special edge arrow (only the threatened ring).
- The Crescendo end ring still uses `field.radius` (the largest Weaver field), not every Chord.
- Real FPS still isn't measurable here (SwiftShader).

## Contract requests (for the lead)

- `HeroHold.start` (or a duration), so the hold timer doesn't depend on seeing the event.
- `FlourishUsed.ability` (and, for Bulwark, the taunted enemy ids). Render currently maps the
  hero's call ability and recomputes "enemies within radius".
- `HeroCall.flourish` (the name). Render keeps it from `callStarted`, so a view created
  mid-call labels an answered glyph "Answered".

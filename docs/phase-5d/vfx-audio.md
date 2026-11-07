# Phase 5d: the Finale (VFX and audio)

The Finale (see [Phase 5d](../phase-5d.md)) climbs out of the Rift into the **Celestial
Crucible**. This page covers how it looks (the arena, the choir, every Finale cue) and how it
sounds (the Crucible voicing, the Grand Silence, the Finale sounds). The HUD is in
[ui.md](ui.md).

**What it reads.** Render and audio read only public state and events:
- `field.finale` (`discord`, `cue`, `fortissimo`, `silence`), the `stilled` status, `ArenaDef.biome`
  and `EnemyDef.material 'glass'`;
- the events `discordRose`, `enemyCued`, `fortissimoCancelled`, `silenceBegan`, `silenceNote`,
  `reignited`, `silenceBroken` and `enemyKilled`.

Nothing is in `src/sim`.

**What it leaves alone.**
- Every key it reads is absent in Movements I-III. A Prelude, Spire or Rift fight draws and
  sounds as before.
- `tests/renderFinale.test.ts` checks that a First Light, a Crimson Gate and a Frayed Threshold
  fight draw and play no Finale cue (`drawnFinale` and `firedFinale` stay zero) and keep no
  Finale key. `tests/audioPhase5d.test.ts` checks that a Movement I fight never holds a bus,
  consults the silence's allow-list or plays a Finale sound.
- The Spire and Rift render and audio snapshots are byte-equal.
- `riftCues.ts` is not edited (a test reads its source).
- No new FX batch: the kit keeps its 12. Every new look is a style inside one of them.

## What changed

| File | Phase 5d work |
|---|---|
| `crucibleCues.ts` (new) | Pure helpers and the `CrucibleCues` pass. `FINALE_HEX`, `CRUCIBLE_HEX`, `CRUCIBLE_SKY_HEX`, `CRUCIBLE_UNMARKED`. Readers: `finaleOf`, `discordOf`, `cueOf`, `fortissimoOf`, `silenceOf`, `conductorOf`, `isStilled`, `silenceDepth`. The orrery's layout (`ORRERY`, `orreryRadius`, `crucibleSky`) and `BEAT_SECONDS` (88 BPM). |
| `crimsonCues.ts` | `BIOME_LOOK.celestial_crucible = 'crucible'` and the `crucible` MOODS row (`CRUCIBLE_MOOD`). The Reliquary, Spire and Rift rows are unchanged. |
| `arena.ts` | A third `ArenaView` case: the obsidian-glass floor with its inlay, the choir stalls and organ pipes (tall only on the far side), the sky orrery in the rays slot and the prism motes in the dust slot. 6 meshes open, 7 with pillars, as before. |
| `models/library.ts` | The Conductor (robed, baton, a halo of five stave lines, ash-grey ribbons) and four faceted glass choristers, each with its voice's tint stripe. Primitives only. |
| `entities.ts`, `telegraphs.ts`, `feedback.ts`, `overlay.ts` | The Cue, Discord, Fortissimo, the silence and its notes, Reignite and glass deaths (below). `drawnFinale` / `firedFinale` counters. |
| `fx/sprites.ts`, `fx/rings.ts` | `SPRITE.note`, `SPRITE.baton`, `RING.stave`. |
| `types.ts` | `FrameInfo.music?` (beat phase, bar, stem levels), filled by the runtime from the director. |
| `lab/VfxLab.tsx` | The 'Phase 5d · Finale' group, `FINALE_SCENARIOS`, `__VFX__.finaleScenarios / finaleScenario / finaleStats`. |
| `src/audio/music.ts`, `theory.ts`, `director.ts` | The `celestial_crucible` voicing row and the silence's stem rule. |
| `src/audio/engine.ts` | `holdBus` / `releaseBus`; `duck()` clamps to a hold. |
| `src/audio/sfx.ts` | `FINALE_SOUND_GROUPS`, `SILENCE_HEARD`, `SILENCE_QUIET`, `TUTTI_MAX`, the rebuild phrase, the Finale stinger. |
| `src/audio/lab/AudioLab.tsx`, `soundBoard.ts` | A Celestial Crucible row, a silence-notes slider and a 'finale' sound group. |

## The Celestial Crucible

| | Abyssal Rift | Celestial Crucible |
|---|---|---|
| Sky (hemisphere) | `#1b1a3a` at 0.5 | night navy `#1b2142` at 0.5 |
| Key light | a pale moon `#e6e1cf` at 1.5 | starlight bone `#e2dccc` at 1.7 (under the Reliquary's 1.85) |
| Rim light | blue-teal `#346782` at 0.42 | cobalt `#4a5aa8` at 0.42, from the far side |
| Fog | `#0a0a1c` | `#0b0a14`, 40 to 90 m |
| Floor | stitched indigo cloth | obsidian glass `#16141f`, inlay in the line colour `#5a5470` |
| Perimeter | broken slabs, bone stitches | white-gold choir stalls `#efe3c4`, organ pipes `#d9cfa6`, prism shards |
| Air | rift tears, thread motes | the sky orrery (eight rings, `#fff6e0`) and prism motes (`#c4b5fd`) |

- **The disc stays dark.** White-gold and prism live only off the disc. A test checks that every
  piece wearing them stands outside the arena's radius.
- **The orrery** is eight rings tilted over the far rim, because the camera never shows the sky.
  Ring *i* belongs to stem ⌊*i*/2⌋ (pad, pulse, melody, choir), the order the notes reopen them.
  - With music it turns on the beat and follows the stem levels.
  - Without music (audio off or locked, tests) it turns on `state.time` at 88 BPM and reads its
    levels from `field.finale`. So it reads with the sound off.
- **Low quality** hides the orrery and the motes, as it hides the god rays and dust.
- **Floor lightness:** the floor sits far below the ailment, lethal and threat telegraphs in
  lightness, in every vision (tested).

## Colour

Measured with the repo's `deltaE` / `simulateVision` against every semantic colour (heal,
shield, amp, ailment, threat, lethal, Mend, Empower, call, gold, goldHot, Resonance, the Weaver,
the dome, the discord pink, Bear and Fermata), in every vision.

| Colour | Hex | Lowest ΔE | Use |
|---|---|---|---|
| tarnished brass | `#a89060` | 23.3 (Bear, deuteranopia) | the Discord streak and '+N', the baton line, the Cue sigil (`FINALE_HEX`) |
| stave slate | `#605078` | 21.4 (ailment, protanopia) | every silence mark on the disc: a stilled hero's stave, the Conductor's stilled halo, the silence and Coda waves |
| cobalt rim | `#4a5aa8` | 23.6 (ailment, tritanopia) | the mood's rim light |
| starlight bone | `#e2dccc` | 5.3 (Fermata, tritanopia) | the key light only (`CRUCIBLE_UNMARKED`: never a mark) |
| ash | `#9aa0aa` | 2.8 (ailment, deuteranopia) | the silence's light term and the dark orrery only (unmarked) |
| smoky glass | `#d4c8bc` | — | a chorister's body and its shards (unmarked) |
| white-gold, prism | `#fff6e0`, `#c4b5fd` | 1.7 (Resonance, tritanopia), 5.6 (heal, protanopia) | off the disc only |

- The design's bronze `#7a5646` measured 7.4 from Bear (deuteranopia), so it does not ship.
- The W0b placeholder rim `#c9d3f5` sat 2.1 from Fermata, so the cobalt replaced it.
- Notes use the Weaver's own gold and the existing Perfect, Clutch and Save colours.
- Every colour is paired with a shape: the stave, the baton sigil, the note glyph.

## Every beat on screen

- **The Cue:**
  - a brass baton line (BEAM `dashed`) from the Conductor to the soloist, from `field.finale.cue`;
  - `SPRITE.baton` over the soloist;
  - the Solo's cast progress and interruptible flag on its over-head bar.
- **Discord fed:**
  - a brass streak from each failed victim to the Conductor, and a '+25' floater ('+5' for the
    Conductor's own blows);
  - nothing for a victim the verdict counts as answered, even inside a failed telegraph (a
    Fermata-held victim; the Weaver a Perfect brought into an Aegis Link).
- **Fortissimo Silence:**
  - the raid path's pulse pips 1/3-3/3 over the Conductor, plus `overlay.danger`;
  - the winding pip fills over the whole windup, however long the assists make it;
  - a rising white rim on every standing hero that cuts to nothing on each pulse;
  - a Crescendo cancel shatters the ring outward.
- **The Grand Silence:**
  - the light lerps toward the ash, inside an `if (silence > 0)`, so the Spire and Rift snapshots
    can't move by float rounding;
  - a steady desaturated vignette (`overlay.setSilence`);
  - the orrery goes dark;
  - stilled heroes take the `held` freeze-frame (desat 0.72, no tremor). A stilled hero that
    Fermata holds keeps Fermata's lavender rim and tremor;
  - aura rings stay as they are, because auras keep working (question 1).
- **Each note:** a gold `SPRITE.note` mote rises from the hero to its ring in the sky and relights
  it, with a ring pulse on the hero.
- **Reignite:** a gold rim flare on each hero, the revived ones rising in it. The orrery holds at
  full for a moment, then follows the stems again.
- **Glass deaths:** a chorister bursts into prism shards that rise as notes. The Conductor's own
  glass death rings the disc in slate, never in its ash accent.

## Budget

`tests/renderFinale.test.ts`, 'The budget', at Low, Medium and High: a busy Finale scene (a Cue,
Discord fed off every hero, Fortissimo winding, every hero stilled, eight notes in a burst,
Reignite and four glass deaths).
- The kit keeps 12 batches.
- Every pool's peak stays under its capacity: rings < 384, sprites < 256, top sprites < 48,
  beams < 160, shells < 64, telegraphs < 96, marks < 24.
- Particles stay within the tier's cap.

sim-bench is in [phase-5d.md](../phase-5d.md) (*Tuning*, sim-bench).

## Audio

D dorian, 88 BPM.

### The Crucible voicing

- **Progression:** D5add9 – G6/D – Em7add11 – A7sus4 (a boss progression of its own), all in D
  dorian.
- **Stems:** pad, a celesta-organ; pulse, a baton tick; melody, prismatic glass; choir, the full
  choir. Ambience: a high bowed-glass shimmer on D6 and A6.
- **The Conductor's motif** is the Weaver's phrase mirrored about D, still in key.
- **The Mirror Choir** (phase 2 on) brings the choir in, even at low Resonance.
- Measured (`tests/audioPhase5d.test.ts`): its stems are 94-100% in key in every mood and each of
  the Conductor's phases.

### Finale sounds

| Group | Sound |
|---|---|
| `finale:discord` | Discord fed: a soft half step, E5 then F5 |
| `finale:rise` | Discord's swell in phase 2 only: a slow rising pad note |
| `finale:tutti`, `finale:cut` | Fortissimo Silence: a tutti over each pulse's whole windup, cut as the pulse lands (`TUTTI_MAX` 16 s is only a guard). A pulse begun in Stasis resumes as its tutti |
| `finale:resolve` | a Crescendo cancel resolves the tutti into the Crescendo's swell |
| `finale:baton`, `finale:cue` | the Conductor's cast; a Cue sings the voice's mirrored leitmotif in glass, in key |
| `finale:silence` | the music stops |
| `bigSilenceNote` | each note (never dropped for a busy mix) |
| `bigReignite` | Reignite: the party's own leitmotifs in canon (never the Kael fallback) |
| `finale:coda` | the Coda, with no leitmotif |
| `kill:glass` | a glass death, sized by the enemy (a boss biggest) |

Every group has a gate and a cap. The Silent Conductor's fall plays the `'finale'` stinger:
every party leitmotif in canon, resolving on D (the choir's open D and a D5 bell).

### The Grand Silence

- **Stems:** the crucible `targets` hook zeroes all four stems while the silence holds, then
  reopens two notes a stem: 1-2 pad, 3-4 pulse, 5-6 melody, 7-8 choir. A new note re-levels on the
  next beat. Reignite brings it all back.
- **Holds, not `hold()`:** the engine's `holdBus(bus, depth)` holds the music and the ambience.
  While a hold is active, `duck()` comes back only to the hold, so a Perfect's, a Save's or a
  pulse's duck can't reopen the silence. A Fermata's or Stasis's release can't reopen a stem.
- **The allow-list** (`SILENCE_HEARD`): the Perfect Ward, a clutch Chime, a Reel-save, the notes,
  the Reignite, the music stopping, and a refused technique's feedback.
  - The heartbeat and the low-life alert stay on, 6 dB under their usual level (`SILENCE_QUIET`).
  - Silent: enemies, ambience, Mend, the Ward's cast and the Thread.
- **The rebuild phrase:** note *n* plays degree *n* of D dorian from D4 (D4 E4 F4 G4 A4 B4 C5 D5)
  in its source's timbre (Ward glass, Chime bell, Reel whoosh-pluck, Rewind reversed bell). The
  eighth resolves on D5.
- **Endings:** `stopCombat` releases every hold. A defeat in the silence ends it too.
- **The short-circuits:** `duck()` and `play()` test `busHolds === undefined` and
  `silence?.on` first, so the Reliquary, Spire and Rift offline snapshots keep their scheduling
  order byte for byte.

## Not measured here

- No Playwright browser on this machine, so neither the e2e smoke nor an in-browser look at the
  Crucible was run in the hand-off step.
- `Telegraph.sole` circles (a silence blow that hits only its named hero) are still drawn at the
  full 2.5 m. A later pass may draw them smaller or mark the sole target.

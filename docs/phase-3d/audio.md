# Audio: Phase 3d additions

Everything is still synthesised, D dorian, all in `src/audio`. Earlier notes: `docs/phase-2/audio.md`, `docs/phase-3/audio.md`, `docs/phase-3b/audio.md`, `docs/phase-3c/audio.md`. The design is in [docs/phase-3d.md](../phase-3d.md).

The Martyr is the one who bleeds for them, so her sounds say "she takes it so they don't": **low, solemn and warm, never gory**. Where the Luminary's sounds were high and glassy and pitched from the hero, the Martyr's are bass-heavy (heartbeats, bowed notes, a dull bell, a low choir) and are still **pitched from the hero** it happens to (their own pluck note, folded down into the bass register). There are no new `UiSound` names. Nothing here has noise above a lowpass except the bell strikes' tiny click.

New synth recipes (`synth.ts`): `bowed` (two detuned saws and a sub sine through a slowly opening lowpass) and `heartbeat` (a "lub" and a softer "dub": sine thumps with a short lowpassed noise body, so it reads as muffled flesh, not a drum).

## Combat sounds (`sfx.ts`)

All on the sfx bus. Only the Vow, the hold clang and Undying are `big` (they bypass the sfx ducker and are named `big*`, so they stay admissible on a crowded engine).

| Event | Group (cap) | What it is for | How it is built |
|---|---|---|---|
| `threadModeChanged` into `'bear'` | `bear` (2) | She takes up the burden. Not the bright Mend/Empower pluck. | About 2 s. A heartbeat on A1 (55 Hz), a second softer one 0.95 s later on 52 Hz, under a bowed D2 and A2 that swell in over 0.55 s and hold. Gated 0.12 s so a mashed key does not stack. |
| `threadModeChanged` out of `'bear'` | `bear` (2), then `mode` | She lets it go. | About 1 s. One slow beat, a sine sigh falling D3 to A2 and a breath of dark air closing from 700 to 200 Hz. The ordinary Mend/Empower pluck follows 0.4 s later, so the player still hears which mode she returned to. The sfx engine remembers the last mode it heard (`lastMode`); a mode change into Mend or Empower from anything else is exactly as before. |
| `borne` | `borne` (3) | A wound arrives at the Weaver. | See below. |
| `crescendoStart`, Martyr's Vow | `bigVow` (1) | Martyr's Vow, instead of Sunrise. | See below. |
| `crescendoEnd` after a Vow | `vowEnd` (1) | The Vow lapses. | About 3 s. One dull bell on D3, a last slow beat and a sigh falling D3 to G2. Replaces the Sunrise whoosh (4 kHz down to 500 Hz), which is the wrong gesture for a vow. |
| `save`, cause `'vow'` | `bigVowHeld` (1) over `bigSave` | The Vow holds a hero at 1 life. | See below. |
| `save`, cause `'bear'` | `bearSave` (1) under `bigSave` | Bear made a hit survivable. | A heartbeat on the hero's note, `heroLow x 1.5`, peak 0.17, under the ordinary save. Gated 0.6 s. |
| `undying` | `bigUndying` (1) | Undying Devotion. | See below. |
| `healApplied`, via `'self'` | `selfHeal` (1) | Blood Font, Sanguine Covenant. | Nearly silent. See below. |

### Borne (event `borne { hero, amount, via }`)

A muffled low thud on the Weaver. The player should feel it, not hear a drum.

- **Pitch.** The hero's own pluck note folded into A1 to G#2 (`heroLow`; Kael lands on D, Lyra and Vexis on their own notes), the thump starting a fifth up and dropping to 60% of that. Panned 30% of the way toward the hero.
- **Size.** Peak gain 0.04 up to 0.11 with the amount as a share of a fifth of the Weaver's life (full at 20%; a missing Weaver counts as 300 life). `'shared'` is 45% quieter and drops the triangle "cloth" layer; `'vow'` is 10% louder; any telegraph winding up takes 25% off. The body is a sine thump (0.2 to 0.3 s), a lowpassed noise puff (240 Hz) and, except for Shared Wounds, a dull triangle an octave up through a 320 Hz lowpass. Five sources at most.
- **Under the other sounds.** The peak (0.12 at its very loudest) is below the hero-hit thump on the Weaver (up to 0.25, an octave higher) and far under the telegraph cues (0.08 to 0.1, sustained, mid-range). It has no ducking of its own. The Weaver's `damageTaken` that follows a `borne` keeps its normal hit sound; Borne never replaces it.
- **Rate limit.** Per hero 0.4 s (0.8 s for `'shared'`), across the party 0.25 s, group cap 3. A hundred events in a second make **about four sounds**; a hundred in one frame make one. The gates are armed in that order (hero, then party), so a refused party gate also holds that hero's gate for its interval; this only ever loses a sound that was not going to play soon anyway.

### Martyr's Vow (`crescendoStart`)

Recognised by `state.calling?.crescendo === 'vow'` **or** a `calling` name that contains the word "Vow" (so a state with no Calling still gets it). Shares the Crescendo's 0.5 s gate, so a double event is one Vow. The music jump stays; the duck is shallower (0.5) and holds longer (0.5 s) so the music is felt underneath. **`bigCrescendo` and `bigSunriseLuminary` do not play on a Vow**: no cymbal swell, no horn, no high choir, no glass run.

About 5 s:

- A low choir on D3, A3, D4 and F4 that swells in over 1.2 s (gain 0.22; the Crescendo's is 0.3).
- A sub drone on D2 and A2, each beating against a twin 10 cents away.
- A dull handbell tolled twice: D3 over D2 at 0.7 s, then A2 at 2.1 s (bright 0.1 to 0.2, so only the fundamental and the hum are heard).
- A heartbeat under each toll, the second softer.
- A breath of pink noise under 500 Hz.

Fixed pitches, all in D dorian, so it cannot clash with the music's chord. It is the Eclipse's shadow turned into the main voice.

### The hold (`save`, cause `'vow'`)

A sharp, resonant "held" clang **over** the ordinary save sound. `bigVowHeld` (`big`, so the save's own sfx duck does not dip it): a struck iron bar (`anvil`) on the hero's note folded into D3 to C#4, peak 0.16, ringing 2.2 s; a bright handbell a twelfth above it; and a thin sine an octave up that rings on for a second. Panned halfway to the hero. Gated per hero 0.7 s and across the party 0.3 s. Because the Vow can hold a hero over and over, the bright save phrase (`bigSave`) is limited to about once a second while the Vow is holding; the clang is the sound that marks each hold. A save with any other cause is untouched.

### Undying Devotion (`undying`)

`bigUndying`, `big`, about 3.5 s, with a music duck (0.5, hold 0.6 s). A caught breath: pink noise through a band that rises from 500 to 2400 Hz over 0.28 s and stops dead. A held pause. Then a deep bell (handbell D3 over D2, peak 0.16) with her heart starting again under it (a heartbeat on 55 Hz), and 0.4 s later the Mend shimmer: a pluck and a glass note climbing D F A D F A (75 ms apart), under a short breath opening upwards. It is once a fight, so there is only a 1.5 s gate.

### Self heal (`healApplied`, via `'self'`)

Blood Font ticks all the time, so this is nearly silent: D3 and A3 sines swelling for half a second, peak 0.022 (the shimmer in the Luminary's Radiance was 0.012 to 0.026), at most every 3 s, only for an amount of 1 or more. It is a presence, not a cue.

## Mix notes

- Everything is under about 1.2 kHz except the bells' upper partials and the Undying shimmer. The Martyr sits where the music's bass and the hero-hit thumps live, so it is deliberately low in gain: Borne's 0.04 to 0.11, Bear's 0.2 heartbeat, the Vow's 0.22 choir and 0.13 bell. The limiter and soft clip stay far from engaged.
- None of the frequent sounds (Borne, Bear, the clang) ducks anything. The Vow and Undying take a shallow music duck; the Vow hold uses the existing save duck.
- Voice caps: `bear` 2, `borne` 3, `bearSave` 1, `bigVow` 1, `vowEnd` 1, `bigVowHeld` 1, `bigUndying` 1, `selfHeal` 1.
- The Luminary's sounds are untouched. A run with the Luminary still gets Sunrise and its layer; a run with no Calling still gets the plain Crescendo.

## Hearing it in the lab (`?lab=audio`)

**Phase 3d: the Martyr** group:

- `Bear on (she takes up the burden)`, `Bear off (back to Mend)` (on, then off 2.2 s later) and `Mend / Empower toggle (compare)`.
- `Borne (one hit on Kael)`, `Borne (a big one on Vexis)`, `Borne, Shared Wounds (quieter)` and `Borne burst (100 in 1 s)`: you should hear about four low thuds, not a wall.
- `Martyr's Vow` (the Vow, then its end 5 s later), `Vow holds Kael at 1 life`, `Bear makes a hit survivable` and `Ordinary save (compare)`.
- `Undying Devotion` and `Self heal (Blood Font, nearly silent)`.
- Compare the Vow with the Phase 3c group's `Sunrise (no Calling, compare)` and `The Luminary's Sunrise`.

`FakeWorld` gained `vow` and `setVow(on)`; `state.calling` now carries `crescendo` (`'vow'` for `setCalling('martyr')`, otherwise `'sunrise'`) and `bearShare`; `field.vow` is reported. "Audit every sound" and the `__audioLab` hooks (`audit`, `pitch`) include the new buttons.

## Tests (`tests/audioPhase3d.test.ts`)

- Bear on plays its own sound on the sfx bus (not the Mend/Empower pluck, and heavier); leaving Bear plays a release and then the pluck; Mend and Empower are unchanged when Bear was not on; a mashed key is gated.
- Borne plays a small low thud on the sfx bus; Shared Wounds is quieter and simpler; per-hero gating, and the tighter one for Shared; 100 events in a second play at most 6 (about 4), 100 in one frame make one, six seconds of constant Bear stay under 30; the Weaver's hit sound still plays; odd heroes and amounts do not throw.
- The Vow plays `bigVow` and neither `bigCrescendo` nor `bigSunriseLuminary` on a Martyr run, and also from the event name alone; Sunrise and the Luminary's layer are unchanged; a double event is one Vow; the end is a low bell and not the whoosh.
- A Vow hold adds the clang over the save; repeated holds keep the bright save to about once a second; a Bear save adds a heartbeat; other causes are unchanged.
- Undying plays on the sfx bus once per event; self heal is nearly silent and gated, and other heals are unchanged.
- Everything is a no-op without an AudioContext and does not throw with an empty or minimal state; every Martyr lab button fires and makes sound; the burst button stays within the `borne` cap.

# Audio: Phase 3c additions

Everything is still synthesised, D dorian, all in `src/audio`. Earlier notes: `docs/phase-2/audio.md`, `docs/phase-3/audio.md`, `docs/phase-3b/audio.md`. The design is in [docs/phase-3c.md](../phase-3c.md).

The Luminary is a support fantasy: the Weaver does not strike, she makes the heroes shine. So the sounds are light, high and glassy (bells, glass, a choir) and each one is **pitched from the hero it happens to**, never from the Weaver. Phase 3c adds three refined UI sounds (the `UiSound` names were added with first voices; no names were added or renamed), three combat sounds and the lab buttons for them.

## UI sounds (`playUi`)

All on the UI bus, so the music ducker never touches them. Group `ui:<name>` (3 voices); peaks stay under `reward` and `rankUp`.

| Id | What it is for | How it is built |
|---|---|---|
| `callingSelect` | The Luminary chosen in Prep. A commitment. | About 1.8 s. A held D, A and D (a bare, open chord of sines that swells in over 0.12 s and stays), a handbell struck on A5 and answered by D6 0.12 s later, a glass sparkle above them, a D5 pluck and a breath of light opening upwards. Settled, not busy: the held tone is what makes it a vow. |
| `callingReveal` | The tier screen opens after a milestone fight. Light gathering. | About 1.7 s. A breath that rises from dull to airy (400 to 4800 Hz) and a faint Dm choir under it. A glassy run climbs seven notes (D5 E5 A5 B5 D6 F6 A6), each a little closer to the last and a little louder, with a soft pluck an octave down on every other note. It lands on a long A6 with a handbell on D6. |
| `callingPick` | An option taken. Weightier than `relicPick`. | About 2 s. A low D thump under a five-voice choir spread over two octaves (D A D F A: Dm with the fifth doubled, swelling open), a sine that rises a whole octave through it (the dawn), a handbell D5 and a second on A5 a beat later, a pluck and a glass D6 at the top. It has the shape of `relicPick` (thump, choir, bell, glass) made bigger and brighter. |

## Combat sounds (`sfx.ts`)

All on the sfx bus, none duck anything, all pitched from the hero.

### Radiance shimmer (event `damageTaken` with `radiance > 0`)

Group `radiance` (3 voices). A shining hero lands a hit and a very small glass note answers it.

- **Pitch.** The attacking hero's own pluck note (`heroPluckIndex`) two octaves up, lifted to at least A5 (Kael's own note is a D, Lyra's lands on A6, Vexis's on B6). An attacker that is not a hero (a pet, a missing entity) falls back to Kael's note. Panned to the hero.
- **Size.** Gain 0.012 up to 0.026 by Radiance's **share of the hit** (radiance over amount plus absorbed, full at 40%), with the glass's brightness and ring following it (ring 0.5 to 1 s). During Sunrise (`state.field.crescendo`) it is a third louder, a little brighter, and always adds a second spark a fifth above 45 ms later; a big share does the same outside Sunrise. It steps back to 70% while any telegraph is winding up. The Thimble, the quietest relic sound, is 0.028, and the core cues are 0.1 to 0.3.
- **Rate limit.** Each hero may shimmer once per 0.7 s (`radiance:<hero id>`) and the party at most once per 0.15 s (`radiance`), so a burst of dozens of hits a second makes **about four shimmers a second at most** (three heroes, 0.7 s each). The group admission cap of 3 voices and the engine's saturation check are the second line. A hit with `radiance` 0 is untouched; the normal hero-hit thump (`heroHit`) still plays for hits on heroes, and the shimmer never replaces it.

### Dawnward chime (event `dawnward { hero, amount }`)

Group `dawnward` (3 voices), about 1.6 s. A warm dawn on the hero who stepped into the field: a soft D-A-D choir swell (0.05), a handbell on the hero's note (`heroPluckIndex + 7`), a glass fifth above it 80 ms later, a pluck an octave down and a short breath opening upwards. Panned to the hero. A bigger barrier (the amount as a share of the hero's max life) is up to 60% louder than a small one. Gated once per hero per second and across the party every 80 ms; three heroes entering together all sound (the group has room for three).

**`shieldApplied`**: the sfx engine has no sound for a shield forming (only `shieldBroken` and `absorb` are voiced), so the overshield that accompanies Dawnward adds nothing and the chime is the barrier's only voice. A test pins this, so adding a generic "shield applied" sound later has to account for Dawnward.

### The Luminary's Sunrise (event `crescendoStart`, `state.calling?.id === 'luminary'`)

The ordinary Crescendo (`bigCrescendo`) is untouched and still plays, with its music duck and music jump. When the run's Calling is the Luminary a second voice group, `bigSunriseLuminary` (1 voice, `big` so the Crescendo's own ducking never dips it; named `big*` to stay admissible on a crowded engine), rides on top. It shares the Crescendo's 0.5 s gate, so a double event is one Sunrise.

- **Luminary.** A high choir an octave above the Crescendo's (chord tones from MIDI 74), an airy breath opening to 7 kHz, a handbell pair on the horn's entry (D6 and A6) and a glass run of six notes climbing out of it, 100 ms apart (D5 F5 A5 D6 F6 A6, a Dm arpeggio). The bells and the run are fixed D dorian pitches, so they sit in the key whatever chord the music is on.
- **Eclipse** (`state.calling.path` includes `eclipse`). The bright layer is 20% quieter and the glass run is cut to three slow notes. Underneath sits the shadow: a low D2 and A2 that each beat against a twin 7 cents away, a dark choir on D3 and A3, and a dull, slow bell on D3. The corona with a shadow in it. It is added to the Luminary layer, not instead of it, so the player still hears the light win.
- **No Calling, or another Calling**: only `bigCrescendo`, exactly as before.

## Mix notes

- The shimmer is the quietest combat sound in the game and the most frequent, so everything about it is about staying out of the way. Its glass partials sit between 1 and 8 kHz in a ring of at most about ten sources; telegraph windups (sustained brass, glass or swells, gain 0.08 to 0.1) are far above it in level and it backs off by 30% when one is up.
- A Perfect Ward, a Save or a hit on a hero is never delayed or ducked by it, and it never ducks them. It adds no ducking at all.
- Dawnward sits at the level of a relic sound (0.02 to 0.065) and 80 ms behind the first note, so a Thimble stitch or the music's own pluck does not mask it.
- The Luminary's Sunrise is the Crescendo plus a layer of high content only. The Crescendo's choir is gain 0.3 and its cymbal 0.1; the added layer's loudest voice is a handbell at 0.07. The limiter and soft clip stay far from engaged.
- Voice caps: `radiance` 3, `dawnward` 3, `bigSunriseLuminary` 1.

## Hearing it in the lab (`?lab=audio`)

- **UI** group: `callingSelect`, `callingReveal`, `callingPick` (compare with `relicPick`, `reveal`).
- **Phase 3c: the Luminary** group:
  - `Radiant hit (single, Lyra)` and `Radiant hit (big share, Vexis)`: one shimmer each; the second is louder and adds the second spark.
  - `Radiant burst (100 hits in 1 s)`: five hits every 50 ms across the three heroes for a second. You should hear about four quiet shimmers, not a wall.
  - `Radiant burst in Sunrise`: the same, with the Luminary set and Sunrise on (brighter, double-sparked).
  - `Dawnward (Kael steps into the light)`, with its overshield event, and `Dawnward (all three, 0.15 s apart)`.
  - `Sunrise (no Calling, compare)`, `The Luminary's Sunrise` and `The Luminary's Sunrise with Eclipse`, in that order, to hear the layers added.
- `FakeWorld` gained `calling`, `sunrise` and `setCalling(id, path)`; `setCrescendo` now also sets `state.field.crescendo`.
- "Audit every sound" and the `__audioLab` hooks (`audit`, `pitch`) include the new buttons. The burst renders 4 s offline.

## Tests (`tests/audioPhase3c.test.ts`)

- Each Calling UI sound is listed, plays on the UI bus in its own group, and has its own recipe.
- A radiant hit plays the shimmer on the sfx bus; a hit with `radiance` 0 plays none. 100 hits in one frame make exactly one; 100 over a second make at most 8 (about 4 in practice), and six seconds of constant hits stay under 30. A bigger share and Sunrise add sources. Odd sources and targets do not throw, and a hero hit keeps its thump.
- Dawnward plays one chime on the sfx bus; the overshield event adds nothing to it; three heroes at once fit the group, and repeats are gated.
- The Luminary's Sunrise adds `bigSunriseLuminary` only with `state.calling.id === 'luminary'`; Eclipse changes it; without a Calling (or with another) the Crescendo is unchanged; a double event is one Sunrise.
- Everything is a no-op without an AudioContext, including with an empty state object, and every new lab button fires and makes sound.

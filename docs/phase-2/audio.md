# Audio: Phase 2 additions

Everything is still synthesised with WebAudio, in D dorian at 88 BPM. This file covers only what Phase 2 adds (CONTRACT v3). The rest is in `docs/phase-1/audio.md`. All new sounds go through the existing voice limiter, rate gates and buses, and pitch to the chord that is sounding unless noted.

Code: `src/audio/sfx.ts` (events, continuous layers), `src/audio/music.ts` (hold, grid), `src/audio/ui.ts` (UI), `src/audio/theory.ts` (call phrases, chorus voicing), `src/audio/engine.ts` (see "Engine changes").

## Call and Response

A hero's call is their leitmotif asked as a question. The same hero's phrase, but the last note hangs on an unresolved degree. The Weaver's answer resolves it to the tonic D.

| Hero | Question (scale degrees) | Hangs on | Resolves to | Voice |
|---|---|---|---|---|
| Kael | D3 A3 G3 **C4** | the b7 | D4 | warm horn |
| Lyra | A4 C5 E5 F5 **C6** | the b7, an octave over the motif's A5 | D6 | pluck and flute |
| Vexis | B4 F5 C5 **E5** | the 2nd | D5 | glass bell |

| Event | Sound | Detail |
|---|---|---|
| `callStarted` | the hero's question phrase, panned to the hero | Voice group `callQ` (3). About 80% of the Cue's level. The last note is held for 70% of the call window at most (at most about 1.8 s) and rings out. Rate gate 0.4 s per hero. A new call from the same hero fades the old question in 100 ms. |
| `callAnswered` | a pickup, then the resolution | The pickup is the question's last note, short and quiet, played immediately so the response never feels late. The tonic lands on the **next eighth-note of the music grid** (0.07 to 0.41 s later, usually well under 0.3 s). The question fades in 140 ms as it lands. Group `callA` (3), panned to the hero. |
| `callEnded` missed | the question's last note sags 3.5% in pitch and fades, over a falling breath | Group `callEnd` (2). Very quiet (about -17 dBFS peak). It never resolves and never buzzes. The question voice fades over 0.5 s. |
| `callEnded` cancelled | a short, very quiet breath only | The question fades in 0.2 s. |
| `flourish` | one big hit per hero, `bigFlourish` (2), panned to the flourish's x | Big (bypasses the SFX ducker). Ducks the music to 0.62 for 0.22 s. Rate gate 0.3 s. |

**Answer timbres** (all on the tonic D in the hero's register, then the fifth and octave stacked in):

- `ward`: glass ring on D, the fifth and the octave, with a rising shimmer. It is the Ward's own sound, resolved.
- `empower`: a quick bright pluck arpeggio (D, A, D, E) 35 ms apart with a noise tick.
- `chime`: handbell on D with the octave below, and a falling breath.
- An answer given within one second adds a high glass sparkle.

**Flourishes** (the hero decides it, the name only breaks ties):

- Bulwark (Kael): a low handbell on the chord root at octave 2 and its fifth, a thump, a shield ring (glass on the chord root and fifth at octave 5, 40 ms later) and a metallic tick.
- Heartseeker (Lyra): four bright plucks climbing the chord tones 40 ms apart, a fast whoosh from 350 Hz to 6.2 kHz, a rope zip and a glass tick.
- Resonant Starbolt (Vexis): handbell on the chord root and fifth (octave 5), a cymbal-shimmer swell and three falling glass partials.

## Fermata

| Event | Sound |
|---|---|
| `fermataHold {hero, until}` | A **held note**: two detuned sines (+-4 cents, so it beats slowly) on the chord root (D4 to C5, whichever the chord has), with a fifth and an octave, held for the hold's real length (`(until - state.time) / timeScale`, clamped to 0.3 to 8 s) and released over 0.5 s. Group `bigFermata` (2), big. |
| the music during a hold | `MusicEngine.hold()`: the **pulse and melody stems freeze** (gain to 0 in about 50 ms, steps skipped) while the pad and choir keep sounding. The music bus is **ducked to 0.5** and its **reverb send is raised 2.6x**, so what is left hangs in a long tail. The music has its own safety timer: it releases itself if the release event never arrives. |
| `fermataReleased {saved: true}` | The held note fades over 0.5 s and a **warm resolution to the tonic** lands whatever chord the music is on: a soft choir on D3 A3 F4, a plucked and belled D Dm9 arpeggio (D4 A4 D5 F5) and a quiet low D thump. The duck eases off over about 0.9 s. The pulse and melody fade back over 0.25 s and resume on their next step. The sim also sends a `save`, so the ghost swell and phrase sit on top. Group `fermataEnd` (1). |
| `fermataReleased {saved: false}` | The held note is **cut off in 30 ms** and a **low thud** lands (58 Hz sine drop, a low-passed noise puff and a short sagging 123 to 62 Hz tone). The music comes back over 0.5 s. |

Several holds can overlap (one note each); the music stays held until the last one ends.

## The death that didn't happen

On `save`, under the existing three-note phrase (still `bigSave`, big): a **reverse swell**. Three sines (an octave below the first note, the first note and its fifth, through a lowpass that opens from 500 Hz to 3.5 kHz) and a pink-noise band (400 Hz to 5.2 kHz) fade *in* over the length of the phrase and are cut off exactly as the last note lands. It sounds like the ghost being pulled back into the scene.

## Chords

| Event | Sound |
|---|---|
| `chorusPulse {auras}` | A chord swell on the current chord's root, group `chorus` (1), rate gate 0.4 s, ducks the music to 0.72. The **voicing grows with the aura count**, stacked in diatonic thirds on the root so it is always in key: 3 auras: root, 3rd, 5th (a triad); 4: adds the 9th; 5: adds the 7th; 6: 11th; 7: 13th. A soft choir sings the bottom three; a handbell sounds each note an octave up, 35 ms apart; a glass note on the top; the whoosh widens and the glass and choir get louder with each aura. |
| `fieldPlanted` | The **pedal thunk**: a D2 sine thump (falling to C2, so it stays in key), a lowpassed D3 triangle body and a noise puff. Panned to where it was planted. Group `pedal` (2), gate 0.25 s. |
| Pedal drone (`update`, a Chord with anchor `planted` in `state.field.chords`) | A very quiet **D pedal** on the ambience bus: sine D2, lowpassed triangle D3 and sine A2, at gain 0.045. It fades in over about 1.5 s and out over about 1 s. The oscillators are created on first use and stopped 3 s after the last planted Chord goes. |
| Unison (`update`, a Chord with anchor `thread` and `threadHero != null`) | The thread hum is **harmonised**: two quiet triangle oscillators a fifth (x1.5) and an octave (x2) above, through the same bandpass. The hum never drops fully silent while a Chord rides the Thread (gain floor 0.012, where before it only sounded above 55% tension), and its pitch is **snapped to the scale** so the harmony is in key. The harmony oscillators are created on first use. |

## UI sounds (`playUi`, the un-ducked UI bus)

| Sound | What it is |
|---|---|
| `wheelOpen` | A soft bloom: a 0.26 s breath opening upwards (500 to 2200 Hz) and a quiet A4 pluck with a faint glass A5. |
| `wheelPick` | A crisp confirming tick: a short D5 pluck with a glass A5 on top (about 120 ms). |
| `reveal` | Two parts, about 3.4 s in all. First the **"with you" phrase in major**: G5 B5 D6 E6 (the G6 sound, in key) as plucks with glass, a handbell on E5. Then, 1.25 s in, a **hollow minor echo** of the same rising contour, falling: A5 F5 D5 as thin sines (lowpassed at 1.5 kHz, no overtones, with a slightly sharp sub-octave) and a long falling breath. Group `ui:reveal` (3). |

## Engine changes

- `Voice` oscillators and noise sources now start at gain 0 (before, they were at the default gain of 1 until the first automation event). **This fixes a latent Phase 1 bug:** when a source's start time fell a fraction of a sample before its envelope's first event (any start time that is not a whole number of samples, for example `now + 0.005 + 0.035 * 3`), one sample of white noise leaked at full scale. It was audible as a random click, and in the audit as random 10 dB peak jumps. All sounds are affected for the better.
- `VoiceHandle.kill(at, fade = 0.03)` takes an optional fade. Used by the question fades and the held note.
- `Engine.boostReverb(bus, mult, tc)` scales a bus's reverb send (used by the Fermata hold).
- `MusicEngine.hold(seconds)`, `releaseHold()`, `holding` and `gridAfter(minLead, division)` (the next point on the eighth-note grid).
- `SfxEngine.play()` returns the voice handle.

## Hearing it: the audio lab (`?lab=audio`)

A new section, **Phase 2: Call and Response, Fermata, Chords**, with a button per sound. Click anywhere (or "Unlock audio") first.

- `Call <hero> (question only)`: the three questions. Listen to the hanging last note.
- `Call -> answer: <hero>`: the question, then the answer 1.6 s later (a new event is fired after a timer). `Call -> quick answer (Lyra)` answers at 0.5 s. Note the pickup and the tonic landing on the grid. Start a mood first (calm or combat with Resonance up) to hear the landing quantised against the music.
- `Call -> missed: Kael / Vexis` (the question, then `callEnded` at 2.5 s) and `Call -> cancelled`.
- `Flourish: Bulwark / Heartseeker / Resonant Starbolt`.
- `Fermata hold -> saved` and `-> not saved`: start `combat` with Resonance 60 and a few enemies first to hear the pulse and melody freeze and come back.
- `Chorus Pulse (3 / 4 / 5 / 6 auras)`.
- `Pedal Point planted` (the thunk) and the **"Pedal drone (planted Chord)"** checkbox (the drone).
- The **"Unison on the Thread"** checkbox, with the Thread tension slider up, for the harmonised hum.
- `Save (with ghost swell)`.
- UI: `wheelOpen`, `wheelPick`, `reveal`.

"Audit every sound" and the `window.__audioLab` hooks (`audit`, `pitch`) include all of the new buttons. Buttons with follow-up events render long enough (`length`) and fire their follow-ups at the right offline time.

## Mix notes (offline audit, default volumes, peaks after the limiter)

| Sound | Peak |
|---|---|
| Perfect Ward (still the loudest one-shot) | -5.4 dBFS |
| Fermata hold -> saved (held note, resolution and the `save` together) | about -6.8 |
| Flourish: Bulwark / Starbolt / Heartseeker | -10 / -13 / -16 |
| Fermata hold -> not saved | -10 |
| Chorus Pulse, 3 to 6 auras | -14 to -12.5 |
| Call question (Kael / Lyra / Vexis) | -17 / -12 / -18 |
| Call -> answer | -14 to -12 |
| Call missed or cancelled | -17 |
| Pedal thunk | -18.5 |
| UI wheelOpen / wheelPick / reveal | -29 / -26 / -14 |

- Everything new stays below the Perfect Ward.
- In-key energy (offline pitch report, 1.5 s): every new pitched sound is 96 to 100% in D dorian. The pedal thunk is a low thump, so it measures about 60%.
- Voice caps: `callQ` 3, `callA` 3, `callEnd` 2, `bigFlourish` 2, `bigFermata` 2, `fermataEnd` 1, `chorus` 1, `pedal` 2. A spam test in `tests/audio.test.ts` keeps them under the caps.
- Added continuous sources: the pedal drone (3 oscillators) and the Unison harmony (2), each created only when first needed. Both sit on the ambience bus. A typical busy moment adds 6 sources.
- A real-browser run of every new sound produced no console errors or warnings.

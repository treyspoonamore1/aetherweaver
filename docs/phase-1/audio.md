# Audio: sound design and implementation (Phase 1)

Everything is synthesised with WebAudio at runtime. There are no audio files and no new dependencies. The code lives in `src/audio/**` and implements the contract in `src/audio/types.ts`.

## Key, tempo, structure

- **Key:** D dorian (the notes of C major, centred on D). Every chord, melody line and leitmotif uses only these notes, so nothing the player triggers can clash with the music.
- **Tempo:** 88 BPM, 4/4. One scheduler step is an eighth note (0.341 s); a bar is 2.727 s.
- **Progressions** (8 bars, one chord per bar):
  - Bright (title, map, calm, combat): Dm9, G6, Cmaj7, Am7, Dm9, G6, Cmaj7, Am7.
  - Dark (boss): Dm9, Am7, Cmaj7, Dm9, Dm9, Am7, Em7, Dm9. The tonic keeps returning and the major lifts are rationed.
  - Still (victory, defeat): Dsus2 held.
- **Clock:** the music runs on the `AudioContext` clock. A pump (`setInterval` 40 ms, plus every frame from `update`) schedules everything up to 0.4 s ahead. The timer only wakes the scheduler; note times come from `AudioContext.currentTime`.
- **Chord tracking:** the scheduler records the chord of each bar it schedules, so `chordAt(t)` always returns the chord that is sounding. SFX call it to pick their pitches. `SynthDirector.musicState()` exposes key, chord, bar, beat, `nextBeatTime` and `nextBarTime`.

## Stems

| Stem | Sound | Plays |
|---|---|---|
| Pad | 2 detuned triangles on the lower chord tones, sine sub on the root, lowpass (darker for boss and defeat) | one voicing per bar, slow swell, overlapping the next bar |
| Pulse | soft kick, rim tick, hats, bass. Boss: kick on every beat, saw bass in eighths, extra floor-tom and rim hits in phase 2+ | per eighth-note step |
| Melody | an 8-bar phrase over the progression. Title: handbell. Map and calm: plucks on beats 1 and 3. Combat: flute-pluck on every note. Boss: low horn (dark phrase) | per step |
| Choir | detuned saws through "ah" formant filters on three chord tones | one chord per bar |

**Ladder (combat, boss, calm).** The effective tier is `floor(Resonance / 25)` (0 to 4), plus one when combat intensity passes 0.2 and one more past 0.6 (with hysteresis). It drops by one for each downed hero, and for 10 s after any hero goes down. Boss has a floor of 1. A Crescendo forces tier 4.

- Tier 0: Pad.
- Tier 1: adds Pulse.
- Tier 2: adds Melody.
- Tier 3: adds Choir.
- Tier 4: the top layer. Hats and bass get busier, the melody doubles at the octave and fills its gaps with a chord-tone arpeggio, the choir gains an octave voice, and the pad opens its filter.

Intensity is computed in `SfxEngine.update` from the enemies alive (weighted by tier) and the active telegraphs, smoothed with a fast attack and a slow release.

**Quantising.** Stem levels are only re-evaluated at bar lines, with a 0.45 s time constant. Urgent changes (a mood to or from silence, victory or defeat, Crescendo, a hero going down) are re-evaluated on the next beat. The lab verified that stem changes land exactly on the bar line.

**Moods**

| Mood | Behaviour |
|---|---|
| `silent` | nothing |
| `title` | sparse pad, a bell on beats 1 and 3, a hint of choir |
| `map` | pad, a soft heart-and-shaker pulse, plucked melody |
| `calm` | pad and sparse melody. The ladder still applies, so Resonance and intensity bring in the other stems (sandbox) |
| `combat` | the ladder above |
| `boss` | dark progression, heavier pulse, low horn melody, floor tier 1. `phaseChanged` queues a stinger (low horn pair, timpani, glass ring, cymbal bloom) that lands on the **next downbeat** |
| `victory` | after the next beat: a rising bell phrase and a choir chord on Dsus2. The pad and choir return the bar after, then fade out (choir at 8 s, pad at 16 s) |
| `defeat` | after the next beat: a descending A F E D bell line over a closing D drone. A quiet pad, gone after 5 s |

## Leitmotifs (played on Cue)

All three are diatonic, so they never clash with the music.

| Hero | Notes (scale degrees) | Sound | Feel |
|---|---|---|---|
| Kael | D3 A3 G3 D4 | warm horn (detuned saws, swelling lowpass) | slow, weighty fifths; the last note is held |
| Lyra | A4 C5 E5 F5 A5 | pluck plus breathy flute | a quick bright run, 85 ms between notes |
| Vexis | B4 F5 E5 C5 | ringing glass bell with a pluck overtone | built on the B to F tritone; the notes ring together |

The thread-attach pluck is the first note of the hero's motif (D3, A4, B4). Calling `leitmotif` again for the same hero within 1.2 s is ignored, so `cued` followed by `soloStarted{cued}` plays it once.

## Event to sound map

All pitched sounds snap to the chord that is sounding. "Big" sounds ignore the SFX ducker and duck everything else.

| Event | Sound |
|---|---|
| `healApplied` via `mend` | soft pluck on a chord tone. The pitch follows the target's HP fraction from F4 up to G5 and is quantised to the chord, so it rises as the hero heals. At most 11 per second, 4 voices |
| `techniqueCast` ward | glass ring on the chord root (octave 5) plus a fifth, and a rising shimmer |
| `perfectWard` (big, loudest sound) | crystalline strike on the root (octave 5 and 6), the chord blooming as handbells, a choir "ahh" swell and a sub thump. Ducks music to 0.4, SFX to 0.65, ambience to 0.5 |
| `save` (big) | rising three-note chord-tone phrase (pluck plus glass, the last note rings), with a breath. Ducks music |
| `chimeLaunched` | breath whoosh and a small bell tick, panned |
| `chimeLanded` | handbell on a chord tone and a falling breath. Clutch is brighter: higher, an octave glass partial, a second bell and a longer ring |
| `cleansed` | tiny glass tick |
| `reeled` | rope zip, then a landing thud after the flight time, panned |
| `glided` | airy swish |
| `threadAttached` | pluck on the hero's motif note |
| `threadModeChanged` | a short pluck (mend is warm, empower is bright) |
| `threadTaut` | rising squeak (rate-limited). A continuous bandpassed whine follows `weaver.threadTension` above 0.55, on the ambience bus |
| `threadSnapped` | noise snap, falling twang and a low thump |
| `cued` / `soloStarted{cued}` | the hero's leitmotif |
| `soloReady` | quiet glass ping on the hero's motif note, an octave up |
| `resonanceGained` crossing 25/50/75/100 | ascending chord-tone arpeggio. Segment k plays k+2 notes and gets louder |
| `crescendoStart` (big) | music jumps to tier 4 on the next beat, plus a cymbal swell, a choir chord, a horn on the root and a thump |
| `crescendoEnd` | a soft falling whoosh |
| `techniqueRejected` | soft muted buzz, rate-limited to 4.5 per second |
| `waveStarted` | distant horn on the root and fifth |
| `decree` | low brass pair, a thump and a falling breath. Ducks music |
| `phaseChanged` | boss stinger on the next downbeat |
| `enemyKilled` | role-specific porcelain crunch (below) |
| `damageTaken` on a hero or the Weaver | thump scaled by damage as a share of max HP, pitched per hero (D2, G2, A2). DoT ticks are rate-limited. A full absorb is a glass tick |
| `shieldBroken` | glass shatter |
| `allyDowned` | low falling tone, and music drops a layer for 10 s |
| `allyOut`, `weaverDowned` | the same, lower, with a toll, and the layer drops for 20 s |
| `revived`, `weaverReformed` | warm rising chord-tone swell and a choir |
| `telegraphStarted` | windup swell panned by shape x relative to the Weaver, lasting `impact - start`. Timbre by answer: marks and `chime` give glass, `ward` or `dome` tank-busters give low brass, other areas (move, stack, scatter, reel, focus) give a mid swell. Quieter when far from the Weaver |
| `timeScaleChanged` below 1 | the music lowpass dips for the slow-mo |
| low HP (hero under 30%, in `update`) | heartbeat that speeds up as HP falls, one timbre per hero (below) |

**Kill crunches by role**

| Role | Sound |
|---|---|
| swarm | tiny tick (35 ms gate, so crowds stay light) |
| brute | low-passed crack, thump and a low bell |
| caster | glassy shatter |
| sniper | sharp snap |
| controller | muffled crunch and a falling zap |
| support | crunch and a falling choir note |
| miniboss | big crunch, thump and a toll |
| boss | huge crunch, toll, cymbal and choir |

**Heartbeat timbres.** Kael is a deep round thump. Lyra is a light wooden tap. Vexis is a glassy pulse built on a fifth.

**UI sounds** (`playUi`, on the un-ducked UI bus, in key):

| Sound | What it is |
|---|---|
| hover | 30 ms tick on A5 |
| click | pluck on D5 |
| confirm | D5 then A5 |
| back | A5 then D5 |
| pick | E5 pluck with a glass shimmer |
| node | G4 handbell and a breath |
| error | soft low buzz |
| reward | 5-note rising pluck sparkle plus a handbell |

## Mixer

Signal flow:

`voices -> bus input -> (music lowpass) -> duck -> bus volume -> master -> compressor -> soft clip -> out`

Each bus also feeds a shared convolution reverb.

- **Buses:** music, sfx, ui and ambience (thread whine, heartbeats). Ambience follows the sfx slider. The UI bus is not ducked.
- **Volumes:** a power-1.5 taper on the user volumes, times per-bus trims (music 1.2, sfx 1.0, ui 1.0, ambience 0.8).
- **Limiter:** a DynamicsCompressor (threshold -8 dB, ratio 14) followed by a `0.95 * tanh(x / 0.95)` soft clip, which keeps the output below 0 dBFS.
- **Ducking:** gain stages on the music, sfx and ambience buses. Big sounds enter through a bypass so they are not ducked by themselves.
- **Voice limiting:** `Engine.admit(key, max)` allows at most `max` (at most 4) live voices per sound kind and fades the oldest out in 30 ms. It also skips new non-big sounds when the SFX bus holds more than 70 live sources or the total passes 150. `Engine.gate(key, interval)` rate-limits retriggers.
- **Shared buffers:** one white-noise buffer, one pink-noise buffer and one reverb impulse, created once per context. Voices are tracked, and every node is disconnected when its last source ends.

## Lifecycle

- `getAudio()` lazily creates a `SynthDirector`. With no `AudioContext` (Node, Vitest, headless) every method is a safe no-op.
- **Unlock:** the director installs capture-phase `pointerdown` and `keydown` listeners. The first gesture calls `unlock()`, which creates and resumes the context. Listeners stay until the context is running. Moods set before unlock are remembered and applied on build. The context is suspended while the tab is hidden.
- **Volumes:** the director subscribes to `useSettings` and applies `settings.volumes`. `setVolumes()` also works directly.
- **Moods:** `setMood` is stored and applied on the next bar line, or the next beat for the urgent cases above.
- **`stopCombat()`:** silences the whine, clears the heartbeats and resets the music inputs. Music keeps playing per mood.

## Audio lab (`?lab=audio`)

- One button for every sound, a mood switcher, a Resonance slider, enemy-count, tension and low-HP/downed drivers, volume sliders, and live engine stats.
- **Simulate a fight:** a real headless sim (`first_light`, `sostenuto` and `fortissimo`) stepped at 60 Hz and fed to the director. An optional auto-support bot threads the weakest hero, Wards telegraphs, Cues, Chimes and Crescendos.
- **Offline audits:** per-sound peak and RMS, per-mood levels, and a 30 s fight rendered through an `OfflineAudioContext`. Peaks are measured after the limiter.
- **Test hook:** `window.__audioLab` exposes the same audits, a pitch-class report and `stats()`.

## Verification summary (offline renders, default volumes)

- Peak levels: the Perfect Ward is the loudest one-shot at about -5 dBFS. Crescendo is -8, Save is -10, and everything else is quieter. Music alone peaks at about -8 dBFS at full tier.
- A 30 s fight with 362 events peaked at -5.2 dBFS. Its loudest second had an RMS of -18 dBFS.
- Pitched support sounds put 94 to 100% of their pitched energy inside D dorian. Music stems are 99 to 100% in key. Noise-based sounds (reel, glide, snap, buzzes, thuds) are naturally less so.
- Source counts stay at about 15 to 40 in normal play with music alone (up to about 55 at full tier) and about 80 at the busiest moment of a fight. Voice groups never exceeded their cap in any run.

# Solos, step W4 (sound): hand-off

*18 November 2026 · branch `p11/solo-w4` in `/home/user/aw-work/wt-p11solo-w4` · base `8572e48`*

## Where it stands

- Final commit: `621cd5a` on `p11/solo-w4`. Tree clean. (This hand-off lives outside the worktree.)
- Typecheck (`npm run typecheck`, all three configs) and lint (`npm run lint`: ESLint with no
  warnings allowed, plus the formatter) are clean.
- The audio tests (`tests/audio*.test.ts`, `tests/reviewA7Audio.test.ts`) and `tests/aura`, run
  together: 667 tests, 648 pass, 14 fail, 5 skipped (the snapshot writers). The 14 failures are
  the 3 expected aura pin failures and 11 fight-derived sound snapshots (below). Also run and
  passing: `tests/renderFinale.test.ts`, `tests/uiPhase5Fixes.test.ts`, `tests/reviewA7.test.ts`
  (the other test files that use the audio code).
- Aura: `tests/aura/chordCardsPin.test.ts` passes. `tests/aura/presentationPin.test.ts` fails in
  its 3 tests, and in each the only difference is the line `"simVersion"` (22 stored, 23 now).
  That pin also records the aura sounds, and none of them moved. Nothing under `tests/aura/`, and
  none of the eight aura files, was touched.

## What changed, in plain language

1. **You hear a Solo coming.** When a hero's Solo is full and their one-second wait begins (Kael:
   up to three seconds), there is a soft tick: a short, dry pluck on that hero's own note with a
   faint touch of glass, panned toward the hero. It is the quietest Solo sound (gain 0.03; the
   glass it replaces was 0.045) and plays on the Effects bus, so the Effects and Master sliders
   control it. In the Grand Silence, that mode's allow-list silences it like any other effect.
   There is no reduced-sound or accessibility audio setting in the game to follow; the audio layer
   only follows the volume sliders, hero voices and game speed.
   - It ticks once each time a Solo fills. If a gap restarts the wait (a target lost for a
     moment, a stun), there is no second tick.
   - If several waits begin together (three Solos filled at once, the end of a Grand Finale),
     they share one sound: up to three ticks, 85 ms apart, each softer than the one before. There
     is also a 0.25 s gate and at most 2 tick sounds at a time. Three Solos a second apart each
     get their own small tick, but only one tick per Solo.
   - No tick for a Solo that fires at once (Kael's urgent wall: the Solo's own sound is the
     signal), for a hero who is downed or mid-Solo, for a Solo held for a Grand Finale turn, or
     once the fight is over. These are the sim's own rules, read through `soloDueIn`.
   - **It replaces the old "Solo full" glass note** (it sounded on `soloReady`). That note used
     to mean "you can buy a Cue now". Playing both would put two sounds on the same moment.
2. **A Tempo's chime follows what A Tempo pays for.** The bright glass chime (D6 then A6) plays
   on a Cued Solo that began on the downbeat, on a run where A Tempo gives Resonance. That is the
   sim's own rule in `conductCue`. Silent Cues no longer suppresses it, because nothing costs
   anything now. Off the beat, on a plain Solo, or without A Tempo, there is no chime. The event's
   `cost` field is no longer read.
3. **No more talk of a price in `src/audio`.** The Conductor's sound group `free` is renamed
   `tempo` (`conduct:tempo`). The lab button "A free Cue on the downbeat" is now "A Tempo: Lyra's
   Solo begins on the downbeat, Cued, and A Tempo pays for it", with A Tempo on the lab's path. The
   lab's stand-in Cue events carry cost 0. The lab fight's helper bot used to move the Thread to a
   full hero only once it had 25 Resonance (the old Cue price). Now it moves the Thread to any hero
   whose Solo fires within half a second, and does not pull it away for low life until that Solo
   has fired. The checkbox now reads "(Thread, Ward, follows Solos…)". `techniqueRejected` was
   never voiced for a Cue in `src/audio`, so nothing needed changing there. `barks.ts` had nothing
   about a price.
4. **Tests.** `tests/audioConducting.test.ts`: the Silent Cues test that wanted no chime is
   replaced by "A Tempo's chime sounds on each Cued Solo it pays for, Silent Cues or not, and on no
   other". It checks Silent Cues on the beat (it chimes, and the A Tempo Resonance was really
   paid), a Cued Solo off the beat, a plain Solo on the beat, and a Conductor without A Tempo.
   The "free Cue chimes" test reads the renamed group. New: `tests/audioSolos.test.ts`, 4 tests
   with the real sim and the director: one rolled tick for three Solos filled together, before
   any fires; once per filling; no tick when nothing is coming; quiet, in key, on the Effects
   bus, gated and capped.

Files: `src/audio/soloWait.ts` (new), `src/audio/sfx.ts`, `src/audio/conduct.ts`,
`src/audio/lab/soundBoard.ts`, `src/audio/lab/fight.ts`, `src/audio/lab/AudioLab.tsx`,
`tests/audioConducting.test.ts`, `tests/audioSolos.test.ts` (new).

## How to hear it

Start a dev server on a port of W4's (for example `npx vite --port 4615` in the worktree) and open
`http://localhost:4615/?lab=audio`. Click once to unlock the sound.

- **Support actions:** "kael's / lyra's / vexis's Solo coming: the soft tick as the wait begins";
  "Three Solos coming together: one rolled tick, each softer"; "Three Solos a second apart, as
  the heroes take turns: a tick before each". For comparison, "Cue kael" is the Cued Solo's own
  phrase.
- **Phase 5f · The Conductor:** "A Tempo: Lyra's Solo begins on the downbeat, Cued, and A Tempo
  pays for it".
- **Simulated fight:** tick "auto-support bot", then "Simulate a fight". Each Solo's tick comes
  about a second before it fires, and the bot's Thread follows it, so most Solos are Cued.

## Tests still failing, and why

| Test | Why | Re-record with |
|---|---|---|
| `tests/aura/presentationPin.test.ts`: all 3 | The stored `simVersion` (22). The orchestrator's to settle. | (nobody's) |
| `tests/audioSpireSnapshot.test.ts`: reliquary first_light, bellwarden, hollow_cantor; crimson_spire crimson_gate, gorehound_matriarch (5) | Fight-derived. The fights play differently (W0), and now the new tick plays in them and the lab bot's Thread follows Solos. | `GEN_AUDIO_SPIRE_SNAPSHOT=<file> npx vitest run tests/audioSpireSnapshot.test.ts`, then put the table in the test |
| `tests/audioRiftSnapshot.test.ts`: mirror_hall, the_seamstress (2) | The same (these passed before W4: the tick and the bot moved them) | `GEN_AUDIO_RIFT_SNAPSHOT=<file> npx vitest run tests/audioRiftSnapshot.test.ts` |
| `tests/audioPhase5.test.ts`: "a Movement I fight sounds the same": first_light, bellwarden, hollow_cantor (3) | The same | `GEN_AUDIO_SNAPSHOT=1 npx vitest run tests/audioPhase5.test.ts` (prints it) |
| `tests/audioPhase5c.test.ts`: "a Movement I and a Movement II boss fight sound as they did" (1) | The same; it compares with the same recorded fights | re-check after the two above are re-recorded; if it still differs, its own literals, from its failure message |

W0 listed 5 of these. W4's change moves 6 more: first_light twice, crimson_gate,
gorehound_matriarch, mirror_hall and the_seamstress. That is a legitimate move: a new sound now
plays in every fight. None was re-recorded in this wave, as asked. Re-record them once, after W1's
final goldens.

## What I need from W1

Nothing blocks W4. Both sounds use what the sim already exposes: `soloHeld`, `grove.held` and
`soloDueIn` for the tick; `cueChained.onBeat` and the run's `calling.conducting.cueResonance` for
the chime. Two optional additions (added, never changed) would let the sound stop copying the
sim's rules:

- `cueChained.paid: boolean` (or `tempoResonance: number`): true when A Tempo paid for this Cue.
  The sound copies `onBeat && cueResonance > 0` from `conductCue`; if tuning changes that rule
  (for example "an urgent wall gives none" moving into the flag), the copy in
  `src/audio/conduct.ts` `tempoPays` must follow.
- A `soloWaitBegan { hero, due }` event, pushed when `soloHeld` (or Oro's `grove.held`) first
  becomes greater than 0 after a filling. With it, the tick would not have to read the state each
  frame. Only worth it if tuning widens the wait rule.

If tuning changes `SOLOS.wait`, the tick still lands at the start of the wait; nothing in the
sound depends on the length.

## For others

- **W6 (docs):** `docs/solos.md`'s "Sound" line can become: a soft tick as a Solo's wait begins
  (it replaces the "Solo full" glass); A Tempo's chime on the Cued Solos it pays for.
  `docs/phase-5f.md`'s "free Cue" chime and the "Silent Cues: no chime" rule are out of date.
- **W3:** nothing. No text keys used or freed (the lab's labels are plain strings).

## What I did not check

- **Nobody has listened to it.** I checked levels, pitch, gates and caps in tests, but I have not
  heard the tick on speakers or judged how it sits in a busy boss fight. Please listen in the
  audio lab (above), especially "Three Solos a second apart", and in a real boss fight.
- The browser tests (`e2e/`), `npm run build`, the whole unit suite and
  `/home/user/aw-work/6/verify-land.sh` were not run. I ran only the audio tests, the aura tests
  and the three other files that use the audio code.
- How the tick behaves with Oro's Saplings (his wait while a Sapling fights) and with the Grand
  Finale's end in a real fight was reasoned from the code, not tested.

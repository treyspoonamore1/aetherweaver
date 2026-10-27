# Audio: Phase 3e additions

Everything is still synthesised, D dorian, all in `src/audio`. Earlier notes: `docs/phase-2/audio.md`, `docs/phase-3/audio.md`, `docs/phase-3b/audio.md`, `docs/phase-3c/audio.md`, `docs/phase-3d/audio.md`. The design is in [docs/phase-3e.md](../phase-3e.md).

The Chronomancer is the one who was ready, so her sounds are **precise, crystalline clockwork, never cartoonish**: escapement ticks, glassy bells and envelopes played backwards. They sit in the **middle register**: above the Martyr's heart and bowed bass, below the Luminary's high glass. Measured on offline renders, Rewind, Echo Ward, Paradox, Temporal Mastery and Foresight keep 96 to 100% of their pitched energy between 250 and 1300 Hz. The Martyr's Borne and Vow are almost all below 250 Hz, and the Luminary's shimmer is all above 1.3 kHz.

Like the other Callings' sounds, they are **pitched from the hero**: the hero's own pluck note, as a scale degree (Kael's D, Lyra's A, Vexis's B), put an octave up (D5, A5, B5). Intervals are counted in scale degrees, never in semitones, so the "fifth" above Vexis's B is her own F (the tritone her motif is built on), never an F sharp. Every tick rings on a D dorian note too. There are no new `UiSound` names: the three Calling UI sounds take a Calling and voice it (see UI sounds).

New synth recipes (`synth.ts`):

- `clockTick`: a 10 ms band-passed click over the case's short ring and a dull body an octave down.
- `reverseBell` and `reverseGlass`: a handbell's or glass's partials swelling in exponentially and stopping together. The higher partials come in later and quicker, as they would have died first.
- `tapeSweep`: a noise band sweeping under a chattering flutter. It either rises and is cut off, the seconds running backwards, or decays, tape winding down.
- `glassPing`: two sines, for the quiet and frequent cues.

The engine gained:

- `attackCurve: 'exp'` on oscillators and noise, for the reversed envelopes.
- `holdMusicFilter` and `releaseMusicFilter`, a lowpass held on the music (Stasis). `muffleMusic` leaves the music alone while it holds.
- `gateAll`, several rate gates passed or refused together.

The music engine gained `extendHold`.

## Combat sounds (`sfx.ts`)

All on the sfx bus. `big` sounds bypass the sfx ducker; groups named `big*` stay admissible on a crowded engine.

| Event | Group (cap) | What it is for | How it is built |
|---|---|---|---|
| `rewound` | `rewind` (2) | Rewind, instead of Reel. | See below. |
| `rewound` with `revived` | `bigRewind` (1), `big` | Rewind stands a hero back up. | See below. |
| `revived` of a hero a Rewind stood up in the same batch | none | The plain revive gives way to `bigRewind`. | The music's jump is kept. Any other `revived` is unchanged. |
| `save`, cause `'rewind'` | `bigSave` (1) | The ordinary save phrase. | Exactly as before, but it starts 0.48 s late, as the rewind lands. Only a Rewind revive saves with this cause; a Fermata hold that Rewind's life saves is a `'fermata'` save. |
| `healApplied`, via `'rewind'`; `techniqueCast`, `'rewind'` | none | | The Rewind's own sound carries both. No Mend pluck plays for Rewind's life. |
| `techniqueRejected`, `'rewind'` | `rejectRewind` (2) | A refused Rewind, including the once-a-run revive spent (`'locked'`). | See below. |
| `crescendoStart`, Stasis | `bigStasis` (1) and `bigStasisHold` (1), `big` | Stasis, instead of Sunrise: time stopping. | See below. |
| (each frame in Stasis) | `stasisTick` (2), `big` | The slowed clock. | See below. |
| `crescendoEnd` after a Stasis | `stasisEnd` (1), `big` | Time resuming. | See below. Replaces the Sunrise whoosh. |
| `encounterEnded` during Stasis | none | The fight is won (or lost) while time stands still. | Stasis lets go quietly, so the victory or defeat music isn't muffled. Its later `crescendoEnd` makes no sound. |
| `foreseen` | `foresight` (2) | Foresight: a glimpse. | See below. |
| (each frame, telegraph timers) | `finalTick` (1) | A lethal attack enters its last second. | See below. |
| `echoWard` | `echoWard` (2) | Echo Ward. | See below. |
| `temporalMastery` | `mastery` (1) | Glide reset a cooldown. | See below. |
| `paradox` | `paradox` (1) | An attack undone. | See below. |
| `rewound` with Borrowed Time | `borrowed` (1) | Rewind filled part of a Solo. | See below. |
| `resonanceGained`, reason `'eternal moment'` | `eternal` (1), `big` | A Stasis-cast Ward turned out Perfect. | See below. |

### Rewind (`rewound { target, fromX, fromZ, toX, toZ, restored, revived }`)

The seconds run backwards, then are caught. About 1 s.

- **Shape.**
  - A tape sweep: a noise band rising from 1.1 to 4.6 kHz under a chatter slowing from 24 to 13 Hz. It rises exponentially and is cut off.
  - The hero's note as a bell played backwards (peak 0.11).
  - Their degree-fifth as glass played backwards (A5, E6 or F6).
  - At the cut, the catch: a tick ringing on A6 and the note heard forwards for a breath (a glass ping).
- **Size.** A longer way back runs longer: the swell is 0.24 s plus 0.012 s a metre, up to 0.42 s. More life given back makes the ping louder and longer (full at 30% of max life). From about a tenth of max life, a second ping comes on the fifth.
- **Place.** Panned 80% of the way to where they land.
- **Rate limit.** Once per hero per 0.2 s and once across the party per 0.1 s (Stasis lets her cast it again and again). The two gates are passed or refused together, so a refusal holds neither. Two voices at most. Twelve Rewinds mashed in a second (the lab's spam button) make about six sounds.
- **Reel is unchanged.** It still sounds on `reeled`, which Rewind never emits.

### Rewind stands a hero back up (`rewound` with `revived: true`)

The fall undone: fuller and longer than a Rewind (0.48 s, fixed).

- Two bands of tape running back: 0.5 to 2.2 kHz, and 1.6 to 6.2 kHz.
- The hero's note as a bell played backwards over its octave below, and the fifth as glass played backwards.
- At the landing:
  - tick and tock (B6, E6)
  - the bell rung forwards (0.13, ringing 1.8 s)
  - a glass fifth
  - a soft thump on A2
  - the note and its octave below held 0.6 s under the bell: they are back.

The plain revive sound (a rising chord and choir) is skipped for that hero, because both together blur. The bright save phrase that comes with the revive waits for the landing. The story then reads in order: time runs back, they stand, the save rings out. The revive is once a run, so it has only a 0.5 s gate per hero. A second try is refused with `'locked'` and plays the refusal, never this.

### A refused Rewind (`techniqueRejected { technique: 'rewind' }`)

The hands won't turn back. The usual low "no" at the reason's pitch (Spirit G2, cooldown C3, anything else A2), at 0.08, under a tick that catches on nothing (A5) and a dull tock 60 ms later (F5). It shares the reject gate (0.22 s) with every other refusal. This covers every reason:

- `'target'`: no hero, or one down for longer than Rewind reaches.
- `'locked'`: the once-a-run revive is already spent.
- `'cooldown'`, `'spirit'` and `'range'`.

### Stasis (`crescendoStart`)

Recognised by `state.calling?.crescendo === 'stasis'` **or** a `calling` name containing the word "Stasis", so a state without a Calling still gets it. It shares the Crescendo's 0.5 s gate, so a double event is one Stasis. The duration is read from `crescendoStart.duration` (3 s, or 5 s with Eternal Moment). **`bigCrescendo`, `bigSunriseLuminary` and `bigVow` do not play**: no cymbal, no horn, no choir.

**Time stopping (`bigStasis`, about 1 s, then the bell rings on).**

- A clock halting: six ticks at 0, 0.12, 0.26, 0.43, 0.65 and 0.93 s. Each is later, lower and rings longer than the one before (B6 E6 A6 D6 G6), and the last catches on a dull A5.
- Under it, tape winding down: the band falls from 3.6 kHz to 450 Hz and its chatter slows from 20 to 3 Hz.
- A4 and E5 drawn in backwards, cut off by the catch.
- At the catch:
  - a soft thump on D3
  - a handbell on D5 left ringing 2.6 s in the stillness
  - a glass A5

**While it lasts.**

- **A held suspended chord (`bigStasisHold`).** A3, D4, E4 and A4 (Dsus2) as pure sines, each with a twin 2 cents sharp so it breathes very slowly, and a glass E5 barely there on top. It swells in over 0.75 s as the clock slows, and peaks at about 0.16 in all, a bed under the clock. It is scheduled for `duration + 4` s as a safety net and released when Stasis ends.
- **The slowed clock (`stasisTick`).** A deep tick about once a second (every 0.95 s, from 1.35 s), alternating D5 and A4. It is lower and longer than any other tick (it rings a quarter of a second). It is driven from `update`, so a pause can't pile ticks up, and it leaves the last half second (read from the Weaver's Crescendo clock) to the end.
- **The music freezes.** Its pulse and melody hold, as for a Fermata, with the longer reverb tail. Under a 900 Hz lowpass, the pad (and the choir, if it is on) carries on. The hold is refreshed every frame while the state says Stasis, never cutting a Fermata's longer hold short. A shallow duck (0.55, held 0.8 s) marks the start. The music is not told it is a Crescendo, so it doesn't surge to its top layer while time stands still. The slow-motion muffles that come with it (the Crescendo's own 0.5 time scale, a Rewind save's 0.35) leave the held lowpass alone.

**Time resuming (`stasisEnd`, about 1.4 s).**

- The held chord lets go over 0.5 s and the lowpass opens over 0.9 s. The music's pulse comes back on its next step (unless a Fermata still holds it).
- The moment is drawn back in: tape speeding up (0.5 to 3.2 kHz, chatter 4 to 22 Hz), with D5 and A5 rising backwards.
- At 0.42 s, a bright tick (C7) and a glass D6.
- The clock picks up speed: four ticks at 0.30, 0.54, 0.74 and 0.90 s after.
- The windups it froze resume (next section).
- After the fight is over it lets go silently.

**Followed in the state as well as its events.** If `state.field.stasis` comes up without the event, Stasis begins silently: no halting clock, but the windups still freeze and the chord and music hold. If the state has been past it for a quarter second without its end event, it ends. It never begins again once the fight is won or lost. The sim steps on for a few seconds after, still in Stasis.

### Telegraph windups under Stasis

**What was wrong.** Each windup was scheduled at `telegraphStarted` from the event's `start` and `impact`. It swells (attack 85 to 88% of its length) into the impact, sustains to it and releases after it: an impact pre-roll. During Stasis the impact keeps moving forward, so the swell would have peaked and released on the old time while the attack stood still. The glass windup's tremolo quickens towards the impact too.

**What it does now.**

- Windups are tracked by telegraph id.
- When Stasis begins (its event, or the state), every windup still sounding fades out over 0.3 s ("the threat holds its breath") and is marked frozen. A `telegraphStarted` during Stasis plays nothing and is marked too.
- When time resumes (its end event, or the state), each frozen telegraph still in `state.telegraphs` winds up again from where it stopped. Its level, pitch glide, filter sweep and the glass tremolo's rate all carry on from the progress it had. It runs over the remaining `impact − time` read from the state, so it peaks when the attack really lands.
- A telegraph that went away in the meantime (its enemy killed while the heroes kept hitting) is not resumed.
- Without Stasis, the windups are exactly as before (the same recipes, the same times), and a test pins this.

**Other sounds checked.**

- The final-second tick reads the state every frame, so it can't fire on a stale time: Stasis holds `impact − time` still and nothing crosses the mark.
- Nothing else in `src/audio` schedules from an enemy-side time:
  - Calls (`callStarted.until`) and Fermata holds (`fermataHold.until`) run on the party's clocks, which keep going in Stasis.
  - `attackFired.travel` and `spawnWarning.delay` have no sounds.
- An attack called off before it lands stops winding up (0.12 s): every `telegraphResolved` with outcome `'cancelled'`, whether its caster was killed or interrupted, Paradox undid it, or the fight ended. (Until now a cancelled attack's windup swelled on into nothing.)

**Soak.** 20 real fights with the skilled bot on a recording fake context: five encounters, both halves of the path, two seeds, each with a Stasis forced mid-windup by the sim's debug command (the bot didn't cast one in 150 s). No windup source outlived a Stasis start by more than 0.35 s, frozen windups resumed, nothing threw, and no group's live voices went above 2.

### Foresight (`foreseen { enemy, attack, name, target, at }`)

A glimpse of what's coming, very soft.

- **Sound.** A glass note drawn in backwards and gone in 0.16 s, then the faintest echo of it. It sits on the target hero's own note (D5, A5, B5), or an unresolved E5 when the attack has no target. It is panned 60% towards the enemy. Four sources.
- **Level.** Peak 0.014, about Radiance's shimmer, and a third quieter while any telegraph winds up.
- **When it is silent.**
  - Four or more telegraphs are up (a busy board).
  - Stasis is up.
  - The attack is due in under 0.3 s: it is about to begin, and its windup will speak. This also covers an enemy that looks again for its other attack at the last moment.
- **Rate limit.** Once per enemy per 2.5 s and across the field once a second, gated together. Two voices at most.
  - A hundred in a second make one or two; a hundred in one frame make one.
  - Ten seconds of constant foresight make about ten.
  - In the soak's boss fights, 17 to 25 glimpses a fight, about one every six to nine seconds.
- **Foreseen while casting.** A `foreseen` sent while the enemy is still casting, recovering or stunned (its `at` further off) plays normally.

### The final-second tick (telegraph timers)

The timers are visual. The sound adds only one soft tick (B6, 0.045) as an attack enters its last second, and only for one that matters. It must be:

- on a Chronomancer run (`state.calling.timers`);
- damaging, with a windup of at least 1.5 s (shorter ones' windups say enough);
- lethal as it crosses the mark (`severity === 'lethal'`: someone in it would go down as things stand).

It plays once per telegraph and at most once per 1.5 s, panned towards the attack, about 10 dB under the windup at that moment. In the soak fights that is none to seven ticks a fight, where every long attack would have been about twenty.

### The path

- **Echo Ward (`echoWard`).** The Ward's chime returning as an echo, on the Ward's own pitches (the chord's root above C5 and its fifth). The root is drawn in backwards (0.14 s), then the chime (root 0.055, fifth 0.03 a moment later) and two fading repeats at 0.16 and 0.32 s. It is about 6 dB under the Ward, as the echo is half its strength. Panned to the hero. Once per hero per 0.5 s and across the party per 0.15 s, gated together.
- **Temporal Mastery (`temporalMastery`).** A clock's click and clack (B6 then E6, 75 ms apart) and a small glass "ready" on the technique's note (Ward A5, Chime D6, Rewind E5). It sits over the Glide's whoosh, which still plays, at about the whoosh's level. Gated 0.3 s.
- **Paradox (`paradox { target, cancelled }`).**
  - The windups of the attacks it undid have already stopped: they resolve `'cancelled'` just before it, like any attack called off.
  - Then a shatter played backwards: a hiss of glass dust drawing in (above 2.6 kHz), and 4 + 2n shards (scale degrees from D6 to D7, n the attacks undone, up to 3) flying back together on staggered exponential swells.
  - All of it meets exactly where the Rewind lands: its swell, or 0.3 s without one. It is made whole in a clear glass note on the hero's own pitch and a D7 tick.
  - Gated 0.3 s.
- **Borrowed Time (on `rewound`, with `borrowed_time` on the path).** A light rising figure: four plucks climbing from the hero's note by scale degree (Kael D5 E5 F5 A5), 55 ms apart, with a glass ping an octave above the last, just after the Rewind lands. It plays only when the Rewind filled anything:
  - life came back (`restored > 0`, as the sim now asks);
  - the hero isn't mid-Solo;
  - the Solo had room, or this Rewind filled it (a `soloReady` in the same batch).

  Once per hero per second.
- **Eternal Moment (`resonanceGained`, reason `'eternal moment'`).** A tiny frozen spark in the Perfect Ward's tail, 0.16 s after it: a D7 tick and two glass notes (E6, A6), peak about 0.02. It is `big` only so the Perfect's own duck doesn't swallow it. Gated 0.5 s. Nothing else is new for Eternal Moment beyond the longer Stasis (read from the event).

## UI sounds (`playUi`)

The contract (`AudioDirector.playUi(sound, calling?)`, additive) now takes an optional Calling. For the three Calling sounds the Chronomancer gets its own voicing in the same names and groups (`ui:<name>`, on the UI bus). The Luminary, the Martyr and no Calling keep the shared voicing, unchanged.

**Which Calling.**

- Passed explicitly, it is used.
- Left out, the app-wide director asks the run store (`useRun`) for the run's Calling, once the click that played the sound has been handled (a microtask). Prep's picker plays `callingSelect` just before it sets the run's Calling, so the sound is the new Calling's. The tier screen's run already has its Calling.
- Injected contexts (tests, offline renders) have no source unless one is given (`DirectorOptions.calling`), and play synchronously.

| Id | What it is for | How it is built |
|---|---|---|
| `callingSelect` (the Chronomancer) | Chosen in Prep. A commitment, in clockwork. | About 1.8 s. A clock wound three ticks (G6 A6 B6). A D5 drawn in backwards into the moment, then struck forwards as a bell over a held D4, A4 and E5 (Dsus2: suspended, ready), with a glass E5 and an A4 pluck. One soft tock a beat later (D6): the clock has started. |
| `callingReveal` (the Chronomancer) | Its path opens after a milestone fight. Time gathering. | About 2 s. Air drawn in backwards (0.42 s). A run of glass notes on the ticks of a clock (D5 E5 A5 B5 D6 E6, 0.11 s apart, each a little louder), landing on a long A5 with a bell on E6 and a tock. |
| `callingPick` (the Chronomancer) | A pick taken. Weightier than `relicPick`. | About 2 s. At once, a low tock (a D3 thump and a D6 tick) and a struck chord of bells (D4, A4, E5: the suspended chord). Then a glass D6 drawn in backwards and caught by a bright D7 tick, as the E resolves down to a D5 pluck. |

## Mix notes

Offline renders, isolated, after the limiter at default volumes (peak / RMS in dB):

| Sound | Peak / RMS | Compare |
|---|---|---|
| Rewind (short; long, much life) | −18.0 / −43.7; −16.4 / −40.5 | Ward −16.6 / −36.2; Reel −14.1 / −39.6 |
| Rewind revive (with its held body) | −12.3 / −33.1 | plain revive −11.9 / −29.2; save −9.9 / −31.6 |
| Stasis start (halting, chord, ticks) | −11.6 / −29.0 | Sunrise −8.1 / −26.4; the Vow −8.5 / −21.8 |
| Stasis end | −17.3 / −42.2 | |
| Paradox (alone) | −19.5 / −43.9 | |
| Echo Ward | −22.9 / −43.2 | Ward −16.6 |
| Temporal Mastery | −24.1 / −48.5 | Glide −24.5 / −49.8 |
| Eternal Moment | −28.9 / −48.7 | |
| Rewind refused | −29.2 / −54.5 | generic reject −29.3 |
| Final-second tick | −31.0 / −62.6 | |
| Foresight | −35.2 / −58.9 | Radiance −38.3 / −56.2 |
| UI: select, reveal, pick | −15.1 / −30.7; −20.2 / −39.9; −14.8 / −33.3 | shared −13.8 / −30.2; −19.4 / −39.0; −12.3 / −30.5; `relicPick` −14.9 / −35.2 |

- Stasis is the hushed Crescendo: about 4 dB under Sunrise and the Vow at its peak, with the music frozen and darkened under it. Time stopping is felt as everything going still, not as a swell.
- Nothing is louder than the Perfect Ward. The Echo Ward and Eternal Moment lab buttons reach its level only because they contain it.
- Every Chronomancer sound is at least 97% in D dorian by the lab's pitch report, and most are above 99%. The exception is the refused Rewind, at about half, like the generic reject: its low "no" is the same sawtooth.
- **Ducking.** Only Stasis ducks the music (a shallow 0.55 at the start), besides its hold and lowpass. None of the frequent sounds (Rewind, Foresight, the ticks, Echo Ward, Mastery) ducks anything.
- **Voice caps.** `rewind` 2, `bigRewind` 1, `rejectRewind` 2, `bigStasis` 1, `bigStasisHold` 1, `stasisTick` 2, `stasisEnd` 1, `foresight` 2, `finalTick` 1, `echoWard` 2, `mastery` 1, `paradox` 1, `borrowed` 1, `eternal` 1.
- The Luminary's and the Martyr's sounds and the plain Crescendo are untouched. A run with no Calling still gets the plain Crescendo, the Luminary its Sunrise layer, and the Martyr her Vow.

## Hearing it in the lab (`?lab=audio`)

**Phase 3e: the Chronomancer** group:

- **Rewind.**
  - `Rewind (Kael, a short step back)` and `Rewind (Vexis, a long way, much life back)`.
  - `Rewind stands Lyra back up (then the save)`, with `Ordinary revive and save (compare)` and `Reel (compare)`.
  - `Rewind refused (down too long)`.
  - `Rewind spam (12 in 1 s, as Stasis allows)`.
- **Stasis.**
  - `Stasis (3 s: time stops, then resumes)` and `Stasis with Eternal Moment (5 s)`. Compare with `Sunrise (no Calling, compare)` and `Martyr's Vow (compare)`.
  - `Stasis over two windups (they freeze, then resume and land late)`: two telegraphs in the lab world wind up, Stasis stops them for 3 s while their impacts move on, and they resume and land late.
- **Foresight and timers.**
  - `Foresight glimpse (an attack on Lyra, a second early)`.
  - `Foresight burst (100 in 1 s)`: ten enemies, a hundred events. You should hear one or two glimpses.
  - `Final-second tick (a lethal 2.5 s tank-buster, timers on)`.
- **The path.** `Echo Ward (a Perfect Ward, then its echo a second later)`, `Temporal Mastery (Glide resets the Ward)`, `Paradox (Rewind undoes two attacks on Kael)`, `Borrowed Time (Rewind fills Lyra's Solo)` and `Eternal Moment (a Perfect from a Ward cast in Stasis)`.
- **UI.** The three Chronomancer UI sounds. The UI group has the shared ones to compare.

`FakeWorld` gained:

- a sim clock (`time`, `advance(dt)`), which moves the world's telegraphs with it while Stasis is up, as the sim does;
- `stasis` and `setStasis(on, seconds)` (`field.stasis` and the Crescendo clock);
- `setSolo`;
- state telegraphs: `addTelegraph`, `removeTelegraph`, with severity;
- the Chronomancer in `state.calling`: `crescendo: 'stasis'`, `rewind`, `reviveSpent`, `timers`, and `foresight` with the option.

Buttons that need the director's per-frame update run it in their follow-ups (offline renders have no frame loop). Every button leaves the lab world as it found it. "Audit every sound" and the `__audioLab` hooks (`audit`, `pitch`) include the new buttons; the levels above come from them and from isolated renders built from the same director.

## Tests (`tests/audioPhase3e.test.ts`)

A recording fake AudioContext: every source's frequencies, start and (last) stop.

- **Rewind instead of Reel.**
  - It plays its own sound and not Reel's, and Reel is unchanged.
  - The cast alone is silent, and the life it gives back plays no Mend pluck.
  - It is pitched from the hero.
  - A longer way runs longer, and more life adds to the catch.
  - The gates and cap hold under Stasis spam.
  - A refused Rewind (`'target'`, `'locked'`) plays its own clockwork "no" and shares the reject gate.
- **The Rewind revive.**
  - It plays `bigRewind` and the save, and not the plain revive. A plain revive in the same batch still plays.
  - The save phrase starts 0.48 s late for cause `'rewind'` only.
- **Stasis instead of Sunrise.**
  - It plays on a Chronomancer run and from the event name alone. Sunrise, the Luminary's layer and the Vow are unchanged, and a double event is one Stasis.
  - Its end is `stasisEnd` (not the whoosh, not the Vow's bell), and the held chord is released.
  - The music holds until time resumes and isn't told it is a Crescendo.
  - The slowed clock ticks (twice in 3 s) and more in 5 s.
  - A missed start or end is caught from the state.
  - A fight won mid-Stasis lets it go quietly, and it doesn't come back. Leaving combat lets everything go.
- **Windups under Stasis.**
  - Without Stasis, a windup ends exactly as before.
  - Stasis fades a windup in flight within 0.35 s, long before its old impact.
  - The windup resumes over the real remaining 2.5 s, checked to the millisecond for brass, and for glass with its tremolo.
  - A telegraph started during Stasis waits, then winds up in full.
  - One that ended during Stasis isn't resumed.
  - The state alone (no event) is enough to freeze.
- **The final-second tick.**
  - One tick for a lethal long attack on a Chronomancer run. None without timers, for short attacks, or for non-lethal ones.
  - None while Stasis holds the clock.
  - Ten attacks crossing within a second make one.
- **Foresight.**
  - A glimpse is a few sources, pitched from its target (an E5 without one).
  - A hundred in a second make at most two, a hundred in a frame make one, and ten constant seconds stay between 6 and 15.
  - It is gated per enemy, including a last-moment second look.
  - It is silent when imminent, in Stasis, and on a busy board.
- **The path.**
  - Echo Ward is gated per hero.
  - Mastery sounds over the Glide, by technique.
  - Any attack called off stops winding up and Paradox cuts exactly the attacks it undid (another attack winds on); its shards meet where the Rewind lands.
  - The Martyr's fifths for Vexis are her F, never F sharp.
  - Borrowed Time needs the option, a Solo with room and life restored.
  - Eternal Moment only answers its own Resonance.
- **UI.**
  - Each Chronomancer voicing is its own recipe, in its own group on the UI bus.
  - The Luminary, the Martyr and none are unchanged.
  - Without a Calling it asks the run after the click; other sounds never wait.
- **Robustness and the lab.**
  - Everything is a no-op without an AudioContext, and nothing throws with a minimal state.
  - Every lab button fires and makes sound on the sfx or UI bus, follow-ups are in order, and the Foresight burst stays within its cap.

## Notes for the lead, and known gaps

- **Telegraph scheduling.** Windups were the only sounds scheduled from a telegraph's impact. They are now frozen at Stasis and resumed from the state when it ends (above). No other audio caches an enemy-side time.
- **Every cancelled attack's windup now stops**, not only Paradox's (the lead's call at review): an enemy killed or interrupted mid-windup no longer leaves its windup swelling into nothing.
- **`callingSelect` relies on the order in Prep's picker.** The picker plays the sound, then sets the run's Calling, in the same click. The director reads the run once the click is handled. If the picker ever sets the Calling asynchronously, it should pass the id: `getAudio().playUi('callingSelect', id)`. The kit's `playUi(sound)` wrapper (`src/ui/kit/sound.ts`, UI workstream) doesn't take a Calling yet; it isn't needed today.
- **The final tick is lethal-only** (none to seven a fight in the soak). For one on every long attack, drop the severity condition in `finalTicks`; that is about twenty a boss fight.
- **A pause during Stasis.**
  - The held chord is scheduled with a 4 s margin, and the music hold lapses 1.5 s after the expected end while frames stop. After a long pause, the chord may have faded and the music moved on under the pause menu.
  - Both come back on the next frame of Stasis: the hold is refreshed, and the slowed clock skips the ticks it missed rather than bunching them.
- **Found in passing, and fixed at review.** Three Martyr sounds had an F sharp for Vexis, which is out of D dorian, because they added a semitone fifth to her B: the Vow hold's handbell "a twelfth above" (`m + 19` in `vowHeld`), the Bear save's heartbeat (`hz * 1.5` in `bearSave`) and Borne's thud and cloth (`hz * 1.5`, `hz * 3`). They now count the fifth in scale degrees (`heroFifth`), as the Chronomancer's sounds do: her F. Kael's and Lyra's fifths are the same notes as before.
- **Windup lengths ignore slow motion**, as before (Stasis aside): a windup during a Perfect's or a save's slow-down peaks a few tens of milliseconds early.

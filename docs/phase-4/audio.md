# Audio: Phase 4 additions

Everything is still synthesised, D dorian, all in `src/audio`. Earlier notes: `docs/phase-2/audio.md`, `docs/phase-3/audio.md`, `docs/phase-3b/audio.md`, `docs/phase-3c/audio.md`, `docs/phase-3d/audio.md`, `docs/phase-3e/audio.md`. The design is in [docs/phase-4.md](../phase-4.md).

The Astrolabe is **an astrolabe's brass and glass**. Its sounds are small brass bells and glass stars kindling above them:

- The bells are tuned like a carillon's, with their minor third inside them. A bell on D rings D, F and A; one on A rings A, C and E. They only ever sit on D, E or A, where that third and fifth stay in D dorian.
- Nothing ticks: clockwork belongs to the Chronomancer.

In the fight, each keystone is heard as the rule it bends: Mend running over, a technique paid in blood, a Ward that won't break, a revive that stands up stronger.

- **Pitched from the hero** where a hero is involved: their own note, counted in scale degrees, as in Phase 3e.
- **Every number** is read from the content (the node's `values`) or the state, never written in.
- **Silent without its node.** Two sounds ride on their own signal instead: Overflowing Grace speaks on its `graceShield` event, and Eldritch Conduit on `state.astrolabe.techniquesCostLife` and the `'life'` refusal.
- **Gated**, so a burst never stacks them.
- **Nothing for Prism Covenant**, Sanguine Font or Unbroken Chorus (see the proposals at the end).

There are seven new `UiSound` names, the agreed ones: `starHover`, `starTake`, `starNotable`, `starKeystone`, `starPath`, `starRefund` and `starRespec`. Not enough points is the existing `cantAfford`.

**New synth recipes** (`synth.ts`):

- **`brassBell`.** A struck brass bell, eight sources:
  - its partials are the hum an octave down, the prime, the minor-third tierce, the quint and the nominal an octave up, in equal temperament;
  - the hum and the prime each ring with a twin 2.8 cents sharp, so it shimmers slowly as struck brass does;
  - a soft mallet: a dull band-passed tap, no click.
- **`reverseBrassBell`.** The same partials swelling in exponentially and stopping together (a node given back).

**The lab's offline renders now let the mixer settle** (`offline.ts`, `SETTLE`):

- **The problem.** A sound fired the moment a fresh render started read up to 6 dB low: the limiter and the volume ramps were still settling. Low, percussive sounds were worst: a thump read −28.4 dB at 0 s and −22.8 dB a second in; the Ward −16.8 and −14.0.
- **Now.** `renderSound` waits 0.5 s, fires the button, and returns the buffer from that moment. The audit, the pitch report and every level below use it.
- **Older tables read low.** The Phase 3 docs' tables were measured the old way, by about 1 to 6 dB depending on the sound. Every comparison below is re-measured.

## UI sounds (`playUi`, `ui.ts`)

All on the UI bus, each in its own group `ui:<name>`, with its own gate and cap (`STAR_LIMITS`).

| Id | Gate (s) / cap | What it is for | How it is built |
|---|---|---|---|
| `starHover` | 0.04 / 2 | A star hovered or focused: very soft and quick, the player sweeps across many. | One glint of glass (`glassPing`, two sources, gone in 0.2 s). Each hover lights the next star of an open chord: D6, A6, E6, B6, D7. A sweep twinkles in any order, and a single hover is a single glint. |
| `starTake` | 0.05 / 3 | One travel node taken. | About 0.7 s. A small brass bell struck on D5 (warm, with its F and A inside it). A breath later, a glass A6: the star kindles. Soft enough to take node after node. |
| `starNotable` | 0.08 / 2 | A notable or a great notable taken: richer. | About 1.4 s. The brass D5 answered a fifth up by a brass A5. Three stars light around them (D6 E6 A6, 50 ms apart), and a glass D7 shimmers on over a breath of air. |
| `starKeystone` | 0.3 / 2 | A keystone taken: deep and resonant, with weight. | About 2.7 s. A great brass bell on D3 (its hum on D2) over a soft D2 thump, with a D4 bell an octave up. A Dm choir (D3 A3 D4 F4) swells beneath. The constellation lights star by star above it (A5 D6 E6 A6, 0.1 s apart) to a long glass D7, over a slow breath as the plates turn. |
| `starPath` | 0.1 / 2 | Several nodes taken at once. | About 1.1 s. A quick rising run of brass taps through an open chord (D5 E5 A5 B5, 50 ms apart), each with a glint an octave up. It lands on a brass D6 with a glass A6 above it. |
| `starRefund` | 0.05 / 3 | A node given back. | About half a second: the take reversed. The star's glass A6 is drawn back in, then the brass D5 swells backwards into silence, and a soft low tap as it comes unseated. |
| `starRespec` | 0.4 / 1 | Everything given back: a sweep down. | About 1.8 s. The stars go out one by one: glass falling from D7 to D5, 55 ms apart, softer and duller as it falls. Under it, a breath sinks from bright to dark. The brass settles on a low, dark D4 bell (the plates at rest) with a soft D3 under it. |

**How the star map uses them.** The UI workstream's map (`src/ui/screens/AstrolabeScreen.tsx`, `takeSound`) plays one sound per action, never two at once:

- **Taking a node.** A keystone's own sound, even at the end of a path. Otherwise `starPath` for several nodes, otherwise `starNotable` or `starTake`.
- **Hovering or focusing.** `starHover`, throttled to 70 ms by the screen as well.
- **Refusals.** `cantAfford` when the points are short; `error` for a node that can't be given back.

## Combat sounds (`sfx.ts`)

All on the sfx bus. None is `big` and none ducks anything.

| Event | Group (cap) | What it is for | How it is built |
|---|---|---|---|
| `graceShield { hero, amount }` | `grace` (2) | Overflowing Grace: Mend's overheal formed a shield. | A soft overflow chime. See below. |
| `techniqueCast` (Ward, Chime, Reel, Rewind) while `state.astrolabe.techniquesCostLife` | `conduit` (2) | Eldritch Conduit: a technique paid in Life. | A blood pulse under the technique's own sound. See below. |
| `techniqueRejected`, reason `'life'` | `rejectLife` (2) | Eldritch Conduit refuses: paying in Life would down her. | The reject sound's own variant. See below. |
| `techniqueRejected`, `'rewind'`, `'life'` | `rejectRewind` (2) | The same, for Rewind. | Its clockwork "no" with the blood under it. |
| `damageTaken` on a Ward that held a hit that would have broken it | `halo` (2) | Shatterproof Halo. | A bright "unbreakable" ring instead of the break. See below. |
| `threadAttached`, with `afterglowUntil` on the hero it left | `afterglow` (2) | Afterglow: Empower lingers. | A fading tail, very quiet. See below. |
| `revived` (not a Rewind's) with Second Wind | `secondWind` (2), over `revive` | Second Wind. | The revive voiced a touch fuller. See below. |

### Overflowing Grace (`graceShield`)

Sent as the shield forms, not for each top-up.

- **The chime.** The hero's own note two octaves over D4 in glass: D6, A6 or B6, brimming. Then three drops spill down from it by degree onto the octave below, 75 ms apart, over a little pour of air (2.6 kHz down to 900 Hz):
  - Kael: A5, F5, D5;
  - Lyra: E6, C6, A5;
  - Vexis: F6, D6, B5.
- **Size.** A fuller shield is a little louder: peak 0.026 up to 0.046 with its share of the node's `cap` of the hero's life (a shield at the cap is full). Without the node in the state it plays at the middle level.
- **Place.** Panned 70% of the way to the hero.
- **Rate limit.** Once per hero per 1.2 s and across the party every 0.25 s, gated together. Undying's Mend can form three at once: they make one chime. A hundred events in a second make at most five.

### A technique paid in Life (Eldritch Conduit)

On a `techniqueCast` of the Ward, Chime, Reel or Rewind (paid in Reel's slot, at Reel's cost) while the state says techniques cost Life. Glide is free and silent.

- **The pulse.** One muffled beat: a sine thump with a short lowpassed noise body, and a dark swell of the same note under it. It sits under the technique's own sound, 15 ms after it.
- **Pitch.** From the hero it was for: their note folded into D2..C#3 (Kael D2, Lyra A2, Vexis B2). The Chime's, with no hero, is D2.
- **Size.**
  - The price is `techniqueCost`'s, Economy and Stasis included. A bigger share of her Life makes it fuller, full at a tenth of it.
  - When what she has left is under about a third of her Life, a second, softer beat follows 0.22 s later. She is running dry.
- **Rate limit.** Once per 0.3 s, two voices. Stasis lets her cast again and again: twenty Chimes in a second make three or four pulses.

### The Life refusal (`techniqueRejected { reason: 'life' }`)

The usual low saw "no", a step under Spirit's: F2, where Spirit's is G2. Under it is the blood it can't spare: one muffled beat on D2. It shares the reject gate (0.22 s) with every refusal.

A refused Rewind keeps its clockwork tick and tock and takes this "no" in place of its own.

### Shatterproof Halo (`damageTaken`)

A Ward loses at most the node's `cap` of its barrier to one hit. The audio reads the state after the hit, so a hit counts only if:

- it is on a hero or the Weaver, whose Ward still stands;
- nothing got through (`amount` 0);
- it absorbed at least what the Ward had before: what is left plus `max × cap`. That is, the hit would have broken it without the Halo.

**Checked against the real sim.** Every Ward hit in 36 fights, novice and skilled bots, the six hard fights:

- the test agreed every time (222 single hits): 22 held a hit that would have broken them, 198 took smaller hits, 2 broke;
- 13 more Wards took two hits in one tick, and weren't classed.

**The ring.** A bright "unbreakable" ring in place of the Ward's break, on the Ward's own pitches (the chord's root above C5, as at its cast):

- a clean, high ting (10 ms of noise above 7 kHz), no shatter;
- the root struck as a bell (0.07), with its octave in glass (0.07) and its fifth (0.04);
- the octave ringing on for a second with a twin 3 cents apart, a slow shimmer that holds.

**What it replaces.** It takes the hit's place: the small absorb glint doesn't play. A Ward that did break is unchanged (the absorb or the hit, and the break). So is a hit the Ward would have survived anyway: the absorb glint.

**Place and rate limit.** Panned 80% to the target. Once per target per 0.3 s and across the party every 0.12 s, gated together. A refused ring still keeps the glint away, so a raid-wide hit on three Warded heroes is one ring.

### Afterglow (`threadAttached`)

The Thread moved on and Empower lingers on the hero it left: their `afterglowUntil`, set as it moves.

- **The tail.** A fading tail, very quiet and optional. The hero's own note two octaves over D4 is caught in glass for a moment. Then comes a soft glow on it, with a twin 5 cents off and the fifth by degree. It fades out linearly over exactly the linger the state gives: `afterglowUntil − time`, in real seconds.
- **Place.** Panned 70% to them.
- **When it lets go.** A hero the Thread comes back to lets theirs go (0.25 s), and so does one who goes down (0.3 s).
- **Rate limit.** Each linger is heard once. Once per hero per 0.5 s, two voices.

### Second Wind (`revived`)

A hero Mend revives stands up with the node's `life` share and is untouchable for its `seconds`.

- **The layer.** The revive's own chord plays as always, and the layer adds:
  - a breath drawn in as they rise;
  - 0.3 s in, the hero's own note as a warm bell: 0.05 plus 0.04 × the life share, so 0.074 at 60%;
  - the fifth by degree in glass;
  - a faint glassy halo on the note two octaves up, held for exactly as long as they can't be hurt, then let go.
- **How much.** A touch fuller: the revive's chord is still the loudest part.
- **Place and gates.** Panned 60% to them. Once per hero per 0.5 s. A Rewind's revive is its own sound and gets none of this.

## Mix notes

Offline renders, isolated, after the limiter at default volumes, with the mixer settled first (peak / RMS in dB):

| Sound | Peak / RMS | Compare |
|---|---|---|
| `starHover`; 24 hovers in 0.6 s | −33.7 / −62.7; −33.3 / −54.3 | `hover` −27.6 / −59.3 |
| `starTake` | −22.2 / −45.5 | `click` −22.1 / −51.8; `pick` −22.0 / −48.6 |
| `starRefund` | −26.8 / −55.4 | |
| `starPath` | −21.2 / −44.2 | |
| `starNotable` | −18.4 / −39.8 | `unlock` −20.7 / −45.3 |
| `starRespec` | −18.2 / −41.2 | `cantAfford` −22.9 / −48.8 |
| `starKeystone` | −13.3 / −32.0 | `relicPick` −12.3 / −35.7; `callingPick` −12.3 / −31.7; `rankUp` −13.4 / −31.3 |
| Overflowing Grace: Lyra, full; Kael; Vexis; a small one | −24.2 / −45.2; −26.5 / −48.4; −26.2 / −48.2; −28.0 / −48.9 | Dawnward −21.8 / −44.5 |
| The pulse alone: full Life; 8% left (two beats) | −24.9 / −47.6; −21.4 / −43.6 | the Ward −14.1 / −36.5 |
| The Ward paid in Life | −14.4 / −36.5 | paid in Spirit −14.1 / −36.5 |
| Life refusal; Rewind's | −21.8 / −49.3; −26.0 / −51.3 | Spirit's −23.6 / −52.1; Rewind's −25.2 / −53.9 |
| Halo ring | −15.7 / −38.9 | the Ward's cast −14.1 / −36.5; its break −20.4 / −49.4; the absorb glint −27.9 / −55.1 |
| Afterglow tail alone: Lyra; Kael | −32.0 / −45.2; −34.8 / −49.4 | the Thread's pluck −17.2 / −42.9 |
| The revive with Second Wind (its layer alone) | −10.7 / −28.5 (−20.5 / −42.5) | the revive −11.6 / −28.7 |
| Every keystone at once, 20 times in 1 s | −9.0 / −27.5 | the Perfect Ward −5.1 / −22.1 |

**The star map** sits with the menu sounds:

- the hover 6 dB under the plain hover;
- a take at `click` and `pick`'s level, a give-back 4.6 dB under the take;
- a notable between `unlock` and `relicPick`;
- a keystone level with `relicPick`, `callingPick` and `rankUp`, the heaviest picks.

**In the fight**, each sits under what it rides on:

- the pulse 10 dB under the Ward it pays for, and it doesn't move the Ward's RMS;
- the Life refusal 1 to 2 dB over the other refusals;
- the Halo ring 1.6 dB under the Ward's cast, but 4.7 dB over the break it replaces (10 dB more RMS);
- the Afterglow tail 15 to 18 dB under the Thread's pluck;
- Second Wind adds 0.9 dB to the revive's peak.

Nothing is louder than the Perfect Ward.

**Register** (the share of pitched energy under 250 Hz / 250–1300 Hz / over 1300 Hz):

- The star map's brass and glass sit in the middle (`starTake` 0/97/3, `starNotable` 0/72/28, `starPath` 0/67/33, `starRefund` 0/99/0). A respec sinks (26/74/0), and a keystone is deep (84/5/11).
- The pulse and the Life refusal are all under 250 Hz, where the Martyr's sounds live.
- The Halo ring is in the middle, like the Ward.
- The chime, the tail and Second Wind's halo sit two octaves over the hero's note. Kael's D6 is under 1.3 kHz; Lyra's A6 and Vexis's B6 are over it.

**Key** (the lab's pitch report):

- The take, notable, keystone, path and respec are 99.5 to 100% in D dorian; the refund is 95% and the hover 93% (glass's inharmonic partial).
- The chime, the ring, the tail and Second Wind are 100%.
- The pulse and the Life "no" are thumps whose pitch falls through them, like the Martyr's Borne. The pitch report doesn't describe them.

**Ducking.** None of the new sounds ducks anything.

**Voice caps:**

- in the fight: `grace` 2, `conduit` 2, `rejectLife` 2, `halo` 2, `afterglow` 2, `secondWind` 2;
- the star map: `ui:starHover` 2, `ui:starTake` 3, `ui:starNotable` 2, `ui:starKeystone` 2, `ui:starPath` 2, `ui:starRefund` 3, `ui:starRespec` 1.

**Unchanged.** The Ward, its break, the absorb glint, the revive, the refusals, the Thread's pluck and every song are as before, when the tree doesn't change them.

## Hearing it in the lab (`?lab=audio`)

**Phase 4 · Astrolabe** group:

- **The star map.**
  - One button for each of the seven `star*` sounds (ids `ui-star…`).
  - `hover sweep (24 stars in 0.6 s)`.
  - `a path to a keystone`: the run, then the keystone, to hear them layered, though the map plays one or the other.
  - `take a node, then give it back`.
  - `cantAfford`, `unlock` and `Rank up` to compare.
- **Overflowing Grace.** On Lyra; and on all three at once, then 0.3 s apart (one chime, then the gates).
- **Eldritch Conduit.**
  - A Ward on Kael, a Reel of Lyra, and a Chime with little Life left, all paid in Life.
  - `The same Ward paid in Spirit (compare)`.
  - The Life refusal, with Spirit's refusal and Rewind's Life refusal.
- **Shatterproof Halo.** Kael's Ward holds a hit half again its barrier. `The same hit breaks a Ward without it (compare)`.
- **Afterglow.** The Thread leaves an Empowered Lyra for Kael. And let go: the Thread comes back to Lyra a second later.
- **Second Wind.** Mend revives Vexis, with `Ordinary revive (compare)`.
- **The burst.** `Every keystone at once, 20 times in 1 s (the gates hold)`.

**Following the lead's tuning.** Every button reads its node's values from the content, and names nodes by effect (`nodeWith`), so it follows the lead's retuning. Each button leaves the lab world as it found it.

**`FakeWorld` gained:**

- `state.astrolabe`, set by `setAstrolabe(ids)` as the sim reports it: the known nodes sorted, the keystones, Economy's cost multiplier, Eldritch Conduit's Life and Prism Covenant's ceiling, from the content's values;
- shields on every entity, and `setWard(hero, amount, max)`;
- `afterglowUntil` on heroes, and `setAfterglow(hero, seconds)`;
- `setWeaverHp`.

"Audit every sound" and the `__audioLab` hooks include the new buttons. The levels above come from them, and from isolated renders built from the same director.

## Soak

Real fights through a recording fake context whose sources end on time:

- the six hard fights, two seeds each;
- the skilled bot and then the novice;
- with the harness's `grace` (Overflowing Grace and Afterglow), `halo`, `conduit` and `bond` (Second Wind) trees.

**Results:**

- No audio warning, and no group above its cap.
- Plays a fight (fights of about 60 to 75 s), skilled bot / novice bot:
  - Overflowing Grace 7.1 / 5.9;
  - Afterglow 5.4 / 8.4;
  - the pulse 11.7 / 11.8;
  - the Halo ring 0.1 / 1.2 (the skilled bot's Wards are mostly Perfect, and a Perfect negates rather than absorbs);
  - Second Wind 0.2 / 0.8.
- Neither bot ever asks for a technique it can't pay for, so the Life refusal is covered by the tests and the lab.

## Tests (`tests/audioPhase4.test.ts`)

A recording fake AudioContext: every source's frequencies, start and last stop, and every level an envelope is set or ramped to.

- **The star map.**
  - The seven are agreed names, each on the UI bus in its own group, with its own gate and cap.
  - They are distinct from each other and from the sounds they sit with: `hover`, `click`, `pick`, `confirm`, `unlock`, `cantAfford`, `rankUp`, `relicPick`, `callingPick`.
  - The hover is two sources, gone in 0.2 s, and softer than the plain hover. A sweep lights different stars, all in key.
  - Weight grows from a take to a notable to a keystone (deep, ringing over 2.5 s), and a refund is softer than a take.
  - A refund is the take's star and bell in reverse order. A respec's stars fall from high to low.
  - 24 hovers in 0.6 s make 8 to 15 glints; mashing all seven stays within every cap.
  - The brass bells are within 3 cents of D dorian on D, E and A.
- **Overflowing Grace.**
  - Pitched from each hero (all four notes checked).
  - Louder for a fuller shield, with the cap read from the content.
  - Gated per hero and across the party: three at once make one, a hundred in a second at most five.
- **Eldritch Conduit.**
  - A pulse on the Ward, Chime, Reel and Rewind, under the Ward.
  - None paid in Spirit, none for Glide, none from the other keystones.
  - Pitched from the hero.
  - Softer with Economy's discount (read from the state through `techniqueCost`), and two beats when her Life is low.
  - Stasis spam makes 2 to 4 pulses, two voices.
- **The Life refusal.**
  - Its own variant (F2 "no", D2 beat), sharing the reject gate.
  - Rewind's keeps its clockwork.
- **Shatterproof Halo.**
  - Rings in place of the absorb glint, on the Ward's own root and octave.
  - Louder than the glint, under the Ward's cast.
  - The plain glint without the node.
  - The threshold follows the content's cap, for a full and a worn Ward.
  - A break is still the break, a hit that got through still a hit.
  - It holds on the Weaver's own Ward too.
  - A dozen big hits in a second ring 3 to 9 times, two voices.
- **Afterglow.**
  - The tail lasts exactly the content's linger and stays under the Thread's pluck.
  - None without the node, each linger heard once.
  - Let go when the Thread comes back or the hero goes down; none for a downed hero.
- **Second Wind.**
  - The revive plus its layer, still led by the revive's chord.
  - The halo lasts the content's seconds.
  - None for a Rewind's revive; gated per hero.
- **The rest.**
  - The effects named exist in the sim and the content.
  - Prism Covenant, Sanguine Font and Unbroken Chorus change no sound.
  - A whole keystone burst stays within every cap.
- **Robustness and the lab.**
  - A safe no-op without an AudioContext. Nothing throws with a minimal or odd state, unknown nodes or NaN amounts included.
  - Every button fires and makes sound, each keystone button plays its own (and the comparisons don't), follow-ups are in order, and the world is left as found.

## Notes for the lead

- **Node ids and effects.** Every sound finds its node by `effect` and reads `values.cap`, `values.seconds` and `values.life` (the keys the sim's `applyAstrolabe` reads). A rename of an effect fails a test (`ASTROLABE_SOUND_EFFECTS` against `KNOWN_ASTROLABE_EFFECTS`), not silently a sound.
- **A worn Ward still breaks.** `wardHitCap` makes a Ward lose at most half its *max* to one hit. A Ward already at half or less loses all of it and breaks (`shieldBroken`), so a fresh Ward survives one big hit, not two. That matches "no single hit breaks your Ward" read as a fresh Ward. If "never breaks to one hit" is meant at any level, it's a sim change; the ring would follow it unchanged.
- **The star map plays one sound per action.** The UI workstream's mapping (`takeSound`) gives a path that ends on a keystone the keystone's own sound, and any other path `starPath`. A path ending on a notable could play `starNotable` instead, if the notable should be heard. Layered, a path and a keystone reach −11.3 dB, about `callingPick`'s level, so either way is safe.
- **No sim or content change is needed.** `graceShield`, `afterglowUntil`, `techniquesCostLife` and the Ward's `amount`/`max` were enough.
- **The offline renderer change.** The lab's levels now settle first (above), so the Phase 3 docs' tables read about 1 to 6 dB low beside these. They aren't rewritten.

**Proposals for the user** (the auras' look and sound are theirs to decide; nothing here changes them):

- **Unbroken Chorus.** A Mute that fails to crack the field could be heard as the songs holding: a short, low sustain on the field's root as the dome lands. Today no sound voices a field cracking either, so this would be a new song sound.
- **Sanguine Font.** While the songs reserve Life, the songs' bed (the beam hum, the pedal drone) could take the Martyr's warmer, darker colour, a quiet heartbeat under the drone.
- **Prism Covenant.** Left silent as asked. Its 30% stronger auras could brighten the beam hum a little, but that too is a change to the songs.

## Known gaps

- **Two hits on one Ward in one batch.** The Halo test reads the Ward after the whole batch. The earlier hit may then count as one that would have broken it, so it rings a hit early; the Ward did hold both. And if a shield that expires sooner took part of the hit before the Ward, the test counts that part as the Ward's.
- **The pulse comes once per 0.3 s.** In Stasis, the techniques cast in between are paid in Life silently.
- **The Life refusal is never heard from the bots,** which check `canPay` before casting. It is tested and in the lab, but not soaked.
- **Afterglow uses the time scale at the moment it starts.** A slow-motion moment during the linger makes the sim's Empower outlast the tail by a little.
- **Second Wind's halo assumes real time.** It is held for the node's seconds of real time, so a slow-motion moment as they stand makes it end a little before the sim's untouchability does.
- **A hover can't be told which star it is,** because `playUi` carries no node. The glints cycle through an open chord rather than following the star. If the map ever passes a node, its constellation could choose the note.

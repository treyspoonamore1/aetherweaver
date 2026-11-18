# Wording for the content's lines (W3 to W1)

*18 November 2026. For `src/content/**`, which is W1's. Voice: `docs/voice.md`.*

Nothing here changes a number or a rule. Each line is the content's own, reworded for two
reasons: no key Cues a Solo any more, so "you Cue" and "Cueing" read as an act the player cannot
perform; and the voice guide's habits (one idea a sentence, no em dash, no semicolon joining two
ideas). "Cued" is a state of a Solo: fired with your Thread on the hero. Where a line tells the
player what to do, it says "Thread".

Put in what you agree with before the last re-record. The content version moves with any of
them. Lines not listed read correctly as they are.

## Lines that tell the player to do something (please take these)

| File | Now | Proposed |
|---|---|---|
| `enemies.ts`, the Cantor's Requiem decree | Requiem — every hero will lose 90% of their life. Cue Kael’s dome, or Ward and heal. | Requiem: every hero will lose 90% of their life. Thread Kael for his dome, or Ward and heal. |
| `heroes.ts`, Brann's needs line, last part | … · Cue Red Frenzy to heal him. | … · Thread him as Red Frenzy fires: Cued, it heals him. |
| `dissonance.ts`, Silent Cues | Your Thread must be on a hero for {seconds} s before their Solo fires for it to be Cued. | A Solo is Cued only if your Thread was on the hero for {seconds} s. |
| `callings.ts`, A Tempo | Your heroes begin their Solos on the downbeat, and each Solo you Cue there gives {resonance} Resonance. Your Resonance meter shows the beat. | Your heroes begin their Solos on the downbeat. Each one you Cue gives {resonance} Resonance. The strip under your Resonance shows the beat. |

Notes:

- **Requiem keeps a colon, not a full stop, after its name.** Blind Score shows a decree's first
  sentence only (`blindDecree`, `src/ui/screens/dissonanceModel.ts`), and that sentence must still
  say what is coming. `tests/uiPhase4d.test.ts` checks the kept part names neither Ward nor dome.
- **W1's own finding (NUMBERS.md, section 4)** makes the Requiem line truer: with the Thread on
  Kael and a hit coming for two or more heroes, he raises the wall at once.
- The beat strip now also shows whose Solo begins on the coming downbeat (their initial, ringed
  gold when your Thread is on them). "The strip under your Resonance" is what the HUD calls it.

## "You Cue", "Cueing": the same rule, said as a state

| File | Now | Proposed |
|---|---|---|
| `callings.ts`, the Conductor's passive | You gain {gain}% more Resonance. A Solo you Cue within {chain} s of your last Cue plays as a Duet, {duet}% stronger; a third in a row is a Trio, {trio}% stronger. | You gain {gain}% more Resonance. A Solo Cued within {chain} s of the last is a Duet, {duet}% stronger. A third is a Trio, {trio}% stronger. |
| `callings.ts`, Grand Finale | Grand Finale replaces Sunrise: every hero plays their Solo in turn, as if Cued, each {ramp}% stronger than the one before; when it ends, every Solo is full again. | Grand Finale replaces Sunrise: every hero plays their Solo in turn, Cued, each {ramp}% stronger than the last. Then every Solo is full again. |
| `callings.ts`, Spotlight | A hero you Cue is Empowered at ×{mult} strength while their Solo lasts, Thread or not. | A hero whose Solo is Cued stays Empowered at ×{mult} while it lasts, wherever your Thread goes. |
| `fill/finale.ts`, line 18 | A hero you Cue is Empowered for {v} s, Thread or not. | A hero whose Solo is Cued is Empowered for {v} s, wherever your Thread goes. |
| `fill/finale.ts`, Opening Bars | Your first Cue in each fight gives {v} Resonance. | The first Solo Cued in each fight gives {v} Resonance. |
| `fill/finale.ts`, Answering Phrase | Cueing a hero within 4 s of Cueing another gives {v} Resonance. | A Solo Cued within 4 s of another gives {v} Resonance. |
| `fill/bond.ts`, line 70 | Cueing Lyra brings her Piercing Shot {v} s closer. | Lyra’s Cued Solo brings her Piercing Shot {v} s closer. |
| `motifs.ts`, line 243 | Cueing a Solo charges the other heroes’ Solos by {v}%. | A Cued Solo charges the other heroes’ Solos by {v}%. |
| `relics.ts`, the Choirmaster's Baton | Solos you Cue last {pct}% longer. | Cued Solos last {pct}% longer. |
| `astrolabe.ts`, line 511 | When you Cue a Solo, the other heroes’ Solos charge {pct}% | A Cued Solo charges the other heroes’ Solos {pct}% |

Notes:

- **"Thread or not"** (Spotlight, and `fill/finale.ts` line 18) used to mean "even if your Thread
  is on someone else". A Cued Solo now always starts with the Thread on its hero, so the words
  read as a contradiction. What they mean now is "after your Thread has left".
- **Grand Finale must still begin "Grand Finale replaces Sunrise"**: `crescendoLine`
  (`src/ui/screens/callingText.ts`) splits the name from the rest, and `tests/uiConducting.test.ts`
  checks the rest starts " replaces Sunrise".
- "As if Cued" becomes "Cued": the Finale's turns are Cued Solos in every respect.

## Em dashes in lines about Solos

| File | Now | Proposed |
|---|---|---|
| `heroes.ts`, Brann's Cued line | Cued: his axe drinks three times as deep — it heals him where your healing can’t. | Cued: his axe drinks three times as deep. It heals him where your healing can’t. |
| `crucible.ts`, the Overture's decree | The Overture — the Conductor Cues its choir. Interrupt the soloist, or answer its Solo. Every blow you leave unanswered feeds its Discord. | The Overture: the Conductor Cues its choir. Interrupt the soloist, or answer its Solo. Unanswered blows feed its Discord. |

## Left as they are, on purpose

- Every hero's and every alternate Solo's "Cued: …" line. They state the stronger form and read
  correctly.
- Hollow Crown ("Every Solo plays Cued, your Thread on the hero or not."): W0's wording, and right.
- The Maestro Deed ("Cue {n} Solos in one run."), Constellation ("Each Cue leaves a star …"),
  Ensemble: "Cue" as a verb with the new meaning, as DECISION.md kept it.
- The Silent Conductor's own Cues (the mirror-choir's voices, "Cued, its Lament …"): the boss's
  mechanic, not the Weaver's.
- Tempo Rubato: W1 already reworded it ("half a segment").

## What the UI shows of content numbers (nothing for W1 to do)

The Codex's Resonance gains, A Tempo's gift on the beat strip, the call-out "On the beat ·
+N Resonance" and the coach's beat hint all show the content's number times the sim's scale
(`resonanceScale`, or `CONTENT.resonance.gainScale`), to one decimal. They read true before and
after the fold: on W3's branch the Codex shows "Perfect Ward +10" from 20 × 0.5, and after the
join the same from 10 × 1.

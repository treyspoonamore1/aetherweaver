# Solos: heroes fire their own

*2026-11-18 · follows [hero autonomy](hero-autonomy.md), which it replaces · the Conductor: [Phase 5f](phase-5f.md)*

The owner's note: "I feel like no players will manually trigger the solos/specials of each character - so either remove the manual trigger or design the game around auto triggering."

Measured, it was worse than that. Hero autonomy was off unless a player turned it on, so a player who never pressed the Cue key never saw a Solo at all, and their boss fights took 70% longer. So the game is now built around heroes firing their own Solos. There is no Cue key. What is left to the player is where the Thread is.

This page is the rule as built in the sim, the content and the bots (step W0). The HUD, the hints, the controls, the sound and the tuning follow in later steps; what each still has to do is at the end.

## The rules

1. **Heroes fire their own Solos.** A Solo charges by fighting, as before. Full, with someone to fight, the hero waits **1 second**, then fires it.
2. **Kael judges his wall.** He raises Aegis Wall at once when he is under half his life, when a big hit is coming at him, or (Shieldbearer) when a hero beside him falls low. Otherwise he holds it for a big hit, but never more than **3 seconds**.
3. **One at a time.** No hero starts a Solo within **1 second** of another hero's starting. Three Solos that come due together fire a second apart. Kael's urgent wall and the Grand Finale's turns ignore this.
4. **The Thread is the Cue.** If the Weaver's Thread is on the hero on the tick the Solo fires, it is the **Cued** form: the stronger one. If not, it is the plain form. A Cue costs nothing.
5. **A Cued Solo does everything a Cue did.** The hero's call, the spotlight, the chorus pulse, Canon, Constellation, every "when you Cue" motif and relic, and the Conductor's chain.
6. **Resonance buys the Crescendo and nothing else.** It no longer pays for Cues, so it is earned at **half speed** (`gainScale`, one number in the content).
7. **The wait starts over after a gap**: no one to fight, downed, stunned, being Reeled. A possessed or stilled hero does not fire. A hero with a Grand Finale turn still to come keeps the Solo for it.

The numbers live in one place, `SOLOS` in `src/sim/constants.ts`: `wait` 1, `kaelHold` 3, `gap` 1, and `tell` 3 (how long before a Solo is full the views and the bots count it as coming).

The rule "is it Cued?" lives in one function, `threadCues` in `src/sim/systems/solos.ts`. The sim, the bots and (later) the HUD all read it. If the rule has to be widened for slower hands (say, "the Thread was on them at some time in the last half second"), that is the one place to change, and the Weaver's `threadSince` (when the Thread reached the hero it is on) is there for it.

`soloDueIn`, beside it, says how many seconds until a hero's Solo fires, as near as can be said. The bots follow Solos by it, and the frames' countdown will read it.

## What changed in the content

| What | Before | Now |
|---|---|---|
| A Cue's price | 25 Resonance (the Conductor's 20) | Nothing. `resonance.cueCost` is gone. |
| Resonance gains | As written | Every gain × `gainScale` (0.5). **The texts still state the unscaled numbers**: tuning folds the scale into them when it settles. |
| The Conductor's passive | Cues cost 20; 10% more Resonance; Duets and Trios | 10% more Resonance; Duets and Trios |
| A Tempo | A Cue on the downbeat is free | The heroes begin their Solos on the downbeat (within 0.15 s of it); each Solo you Cue there gives 10 Resonance |
| Opening Bars | The first Cue of a fight costs 10 / 15 / 25 less | The first Cue of a fight gives 10 / 15 / 25 Resonance |
| Tempo Rubato | One Cue in three is free | One Cue in three gives a whole segment of Resonance |
| Hollow Crown | Cues cost 10 less | Every Solo plays Cued, Thread or not (its curse is unchanged) |
| Silent Cues | A Cue costs 10 more | The Thread must have been on the hero for 1 s as their Solo fires |
| Answering Phrase, Cantor's Hymnal | | A word each |

Everything else that says "Cue" or "Cued" reads as it did, with the new meaning: Canon, Call and Response, Footlights, Steady Draw, the Choirmaster's Baton, Shieldbearer, Constellation, the Astrolabe's two nodes, the Maestro Deed, the chorus pulse, every Solo's Cued line.

## The Conductor

It stays a Calling of skill. A **Duet** is a Solo Cued within 4 seconds of the last Cue, a **Trio** a third: follow each Solo with the Thread as it fires, one, two, three. A plain Solo neither joins a chain nor breaks one, as before. The Grand Finale is as it was; a hero whose turn is still to come keeps their Solo for it, and when it ends every Solo is full, so the three fire a second apart: a Trio for the taking.

With A Tempo the heroes hold a ready Solo for the next downbeat, so Solos come a bar apart (2.7 s) and the beat strip shows when the next one will begin.

The fight's tallies `freeCues` and `saved` now count the Cued Solos A Tempo paid for and the Resonance it gave. Their names are kept until the save and the recap are reworked.

## The bots

- **Skilled** (and the Expert through it), rule `soloCue`: half a second before a Solo is due, the Thread goes to that hero; then back. Kael counts from the moment his wall is full, since he may raise it at any time. Not while a hero is held, condemned, down or under 30% of their life (Brann aside, who sits low on purpose), nor through the Grand Silence. With Fortissimo Silence's first pulse near and no Crescendo, the Thread goes to Kael for the dome.
- **Novice**, `NOVICE_SOLO`: with a Solo due within a second on a hero she isn't threading, a 30% chance each decision to swing the Thread over; once she has, it stays until the Solo fires (4 s at most). More often with a Conductor's chain open (40%), with A Tempo's beat to go by (50%), and in the Finale's last burn (50%).
- The rules that timed a Cue are gone: the damage-Solo and dome rules, `reigniteCue`, `serenCue`, `oroCue`, `conductChain`, `conductHold`, `conductBeat`.

## What it does to the numbers

Measured before the build with a prototype (13 fights across the four Movements, 20 seeds, both bots), and again on the built rules (6 seeds):

| | Skilled, bosses: win | Seconds | Heroes downed | Solos Cued / plain |
|---|---|---|---|---|
| Before, the bot Cueing | 96% | 133 | 0.90 | 10.1 / 0.2 |
| Before, a player who never Cued | 91% | 226 | 1.79 | 0 / 1.0 |
| Prototype, Resonance halved | 95% | 134 | 0.71 | 11.2 / 1.2 |
| As built | 100% | 130 | 0.60 | 11.3 / 1.1 |

The Conductor (Marcato, Reprise, Ensemble, Triad), Skilled, bosses: 96 s before, 93 s as built, with 2.3 Duets and 1.1 Trios a fight (2.8 and 1.0 before).

The Novice wins more than before, because her heroes now use their Solos. The fights are left as they are; her bands are re-set in tuning.

## Versions

- `SIM_VERSION` 22 → 23. The content's version moved.
- Fight replay format 6 → 7, run replay 1 → 2: there is no `cue` command and no `autonomy` assist in them. Old replays cannot be played back.
- Run saves (5) and profiles (10) are unchanged. Settings stay at 4 until the Hero autonomy setting and the Cue key leave them.
- Every recorded result that plays a fight was recorded again: the goldens, the Dissonance pins, the bots' command snapshots and the rest. The aura pins were not touched; the presentation pin's stored sim version (22) is the one line there that no longer matches, and it is the owner's to change.

## Staging a Solo

For the labs and the tests there is a debug command, `{ t: 'debug', op: { op: 'fireSolo', slot, cued } }`: that hero fires their Solo now, Cued or plain, whatever its charge. It stands in for the old Cue command wherever a scene needs a Solo at a given moment.

## Still to do (later steps)

- **Tuning:** the wait and the gap for hands (a follower 350 ms late should still Cue 70% of boss-fight Solos), `gainScale` and folding it into the numbers and their texts, each Calling, the Novice's bands, the bots' chances, the baselines. Hero judgement to try: Kael's wall for a hit on the whole party; Lyra and Vexis not rooting into a hit; no Solo on a last, nearly dead enemy or into a boss that cannot be hurt.
- **Input and saves:** the Cue key, the Cue modifier and the pad's Cue button (they do nothing now; a hero's number threads them with the modifier held or not); the Hero autonomy setting; settings version 5; a plain sentence when an old replay is opened; Auto-Thread following a Solo.
- **HUD, hints, text and the mark:** frames with a countdown and a "will be Cued" mark; the Resonance meter without Cue ticks (it is told a Cue's price is out of reach for now, which hides them); the coach; the primer; the Codex; the Conductor's badge and beat strip; Silent Cues' look; the mark over a hero whose Solo is coming.
- **Sound:** a tick as a Solo's wait begins; A Tempo's chime on its paid Cues.
- **Tests, browser tests, docs.**

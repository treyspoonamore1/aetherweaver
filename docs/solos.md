# Solos: heroes fire their own

*2026-11-18 · follows [hero autonomy](hero-autonomy.md), which it replaces · the Conductor: [Phase 5f](phase-5f.md)*

The owner's note: "I feel like no players will manually trigger the solos/specials of each character - so either remove the manual trigger or design the game around auto triggering."

Measured, it was worse than that. Hero autonomy was off unless a player turned it on, so a player who never pressed the Cue key never saw a Solo at all, and their boss fights took 70% longer. So the game is now built around heroes firing their own Solos. There is no Cue key. What is left to the player is where the Thread is.

This page is the rule as built, in the sim, the content, the bots, the controls, the HUD and the sound.

## The rules

1. **Heroes fire their own Solos.** A Solo charges by fighting, as before. Full, with someone to fight, the hero waits **1 second**, then fires it.
2. **Kael judges his wall.** He raises Aegis Wall at once when he is under half his life, when a big hit is coming at him, or (Shieldbearer) when a hero beside him falls low. Otherwise he holds it for a big hit, but never more than **3 seconds**.
3. **One at a time.** No hero starts a Solo within **1 second** of another hero's starting. Three Solos that come due together fire a second apart. Kael's urgent wall and the Grand Finale's turns ignore this.
4. **The Thread is the Cue.** If the Weaver's Thread is on the hero on the tick the Solo fires, it is the **Cued** form: the stronger one. If not, it is the plain form. A Cue costs nothing. There is no grace before or after the tick.
5. **A Cued Solo does everything a Cue did.** The hero's call, the spotlight, the chorus pulse, Canon, Constellation, every "Cued Solo" motif and relic, and the Conductor's chain.
6. **Resonance buys the Crescendo and nothing else.** It no longer pays for Cues, so every Resonance gain in the game is **half what it was**. The halves are written into the content's numbers, so a card says what it gives.
7. **The wait starts over after a gap**: no one to fight, downed, stunned, being Reeled. A possessed or stilled hero does not fire. A hero with a Grand Finale turn still to come keeps the Solo for it.

Two pieces of hero judgement were added in tuning:

8. **Kael's dome on demand.** With his wall full and **your Thread on him**, Kael raises it at once when a hit is about to land on two or more of the party within **1.5 seconds**. Cued, the wall is a dome over everyone. So "a big hit is coming for everyone: thread Kael" is something a player can do on purpose, and the coach says so.
9. **No rooting into a hit.** Vexis's Starfall roots her where she stands, and so do Lyra's Gale Barrage and Hawk's Vigil when they fire plain. If one of those is due, your Thread is not on her, and a hit is coming at her, she holds the Solo until the hit has landed, **2 seconds** at most. With your Thread on her she fires on time.

Two more were measured and left out, because neither changed one fight in 780: holding a Solo on a wave's last, nearly dead enemy, and holding it while the target cannot be hurt.

The numbers live in one place, `SOLOS` in `src/sim/constants.ts`:

| Name | Value | What it is |
|---|---|---|
| `wait` | 1 s | How long a full Solo waits before the hero fires it |
| `kaelHold` | 3 s | The longest Kael keeps a full wall for a big hit |
| `gap` | 1 s | No hero starts a Solo this soon after another's began |
| `tell` | 3 s | How long before a Solo is full it counts as coming. The whole tell is up to 4 s: 3 of charge, 1 of wait |
| `lead` | 0.5 s | How long before a Solo is due the Skilled bot and Auto-Thread move the Thread there |
| `danger` | 30% | Neither follows a Solo while a hero is under this share of their life |
| `partyHit` | 1.5 s | Rule 8 |
| `rootHold` | 2 s | Rule 9 |

The rule "is it Cued?" lives in one function, `threadCues` in `src/sim/systems/solos.ts`. `soloDueIn`, beside it, says how many seconds until a hero's Solo fires, as near as can be said, or that none is coming. The sim, the bots, Auto-Thread, the frames, the mark over the hero, the beat strip and the sound all read those two. Nothing keeps a copy of either rule.

## For hands

The bots move the Thread within one tick. A person does not. So tuning built a stand-in for a person's hands (`tools/person.ts`, played by `tools/solo-study.ts`): the Skilled bot's play, but the Thread goes to a Solo 350 ms after it is noticed, stays until the Solo fires, misses one Solo in six altogether, and never leaves a hero under 30% of their life. 84 boss and mini-boss fights each:

| Who | Solos Cued | Win | Seconds | Heroes downed |
|---|---|---|---|---|
| The Skilled bot | 91% | 98% | 131 | 0.75 |
| Person, goes when the tell appears | 81% | 99% | 144 | 0.99 |
| Person, goes only when the Solo is full | 84% | 98% | 130 | 0.56 |
| The same, hands at 600 ms | 85% | 99% | 132 | 0.71 |
| The same, hands at 800 ms | 83% | 98% | 133 | 0.76 |
| The same, hands at 1 s | 52% | 94% | 146 | 0.86 |
| A player who never follows a Solo | 34% | 94% | 142 | 1.12 |

The target was 70%. So **the 1 second wait stays, and the rule was not widened.** Five in six is the ceiling, since the stand-in misses one in six on purpose. What this says:

- **The moment to move is when the Solo is full**, not when its tell first shows. The person who goes at the first sign keeps the Thread there for up to 4 s and pays for it: fights take 10% longer and one more hero in four goes down.
- **The wait is a hard edge.** Hands as slow as 800 ms still make it. At 1 s they do not.
- **Kael is the hardest to Cue** (72 to 78%, against 83 to 90% for Lyra and Vexis), because he raises his wall at once when he is hurt, with no wait to react in. His frame shows no countdown for that reason.
- Other waits measured no better: 0.75 s gives the same share Cued; 1.5 s gives the same share and slightly worse fights, because Solos sit unused longer.
- A player who never moves the Thread for a Solo still has a third of them Cued, on whoever the Thread is on, and still wins.

## What the player sees and hears

- **The party frame.** A strip appears on a hero's frame when their Solo is coming. Quiet while it charges (the last 3 seconds): the Solo's name in a dashed outline and the seconds. Loud once it is full (the 1 second wait): a solid gold outline, **"Thread to Cue"** and the seconds. With your Thread on that hero at either stage: a filled gold strip with a tick, **"Cued"**, and a second ring round the portrait. Kael's strip shows no seconds. There is no AUTO tag and no key cap.
- **The mark over the hero** (`src/render/soloMark.ts`). A ring over their head that fills until the Solo fires. Dashed round a note while your Thread is elsewhere, smaller while the Solo charges and full size once it is full. Solid, with rays, a third larger, once your Thread is on them. It stands down while a Fermata holds the hero, moves up over a call's bubble, does not breathe or pop under Reduced motion, and takes the palette's call colour in every colour vision.
- **The Resonance meter** has no Cue ticks and no price.
- **Call-outs.** "Cued · Lyra: Gale Barrage" when your Thread was on her, "Lyra: Gale Barrage" when it was not.
- **The coach.** "Lyra's Gale Barrage is coming. Thread them 2 to Cue it: the stronger form". And, when Kael's wall is full and a hit is coming for more than one hero: "A hit is coming for the party. Thread Kael 1: Cued, his wall shields everyone".
- **The primer's last row** is "Cue their Solos": "Heroes fire their own Solos. A Solo fired with your Thread on them is Cued: the stronger form." "Cued" is explained in that one phrase everywhere: the primer, the Codex, the strip's tooltip.
- **Result and Summary** count Cued Solos.
- **Sound.** A soft tick on the hero's own note as a Solo's wait begins. It replaces the glass note that used to mean "you can buy a Cue now". Three waits that begin together share one rolled tick.

**A first fight, untouched.** In First Light, the first fight of a run, each hero's Solo charges in about 30 seconds and fires once near the end, a second apart. A player who presses nothing at all sees those Solos fire plain. That player also heals nobody: on two of six seeds tried the party fell before the fight was won, as it did before the rework.

## Controls and Auto-Thread

- **No key Cues a Solo.** `T` and the gamepad's right bumper do nothing, and are free to bind to something else. A hero's number threads that hero, whatever is held with it. Controls has no Cue row and no Cue modifier.
- **The Hero autonomy setting is gone** from Settings and Prep. A player who had it on is no longer marked as assisted.
- **Auto-Thread follows Solos** (`autoSoloTarget` in `src/input/InputController.ts`). It is still an assist and still off unless turned on. Once the player has not touched the Thread itself for 2 seconds, and nobody is in danger, the Thread goes to a hero `lead` seconds before their Solo is due, stays until it fires, then goes back to where it was. Ward, Chime and moving do not hold it back. The player's own touch on the Thread ends a follow at once.
  - It does not leave the hero the Thread is on while that hero is under 60% of their life.
  - It follows nothing while a hero is downed, on a Fermata hold, condemned, or under `danger` of their life. Brann is left out of both lines, since he sits low on purpose.
  - Once Kael's wall is full and he has someone to fight, the Thread waits on him between the other heroes' Solos.
  - Its older rule is unchanged: with no input at all for 2 seconds, the Thread goes to the hero lowest on life.

## What changed in the content

| What | Before | Now |
|---|---|---|
| A Cue's price | 25 Resonance (the Conductor's 20) | Nothing. `resonance.cueCost` is gone. |
| The base Resonance gains | Perfect Ward 20, Save 25, Clutch Chime 15, Reel 15, answered call 10, Cleanse 5, Ward absorb 5, Empower 1 a second, Empowered kill 2 | 10, 12.5, 7.5, 7.5, 5, 2.5, 2.5, 0.5, 1 |
| Every motif, relic, Bond, Calling and Astrolabe gain | As written | Half. The list is below. |
| The Conductor's passive | Cues cost 20; 10% more Resonance; Duets and Trios | 10% more Resonance; Duets and Trios |
| A Tempo | A Cue on the downbeat is free | The heroes begin their Solos on the downbeat (within 0.15 s of it). Each one Cued gives **15** Resonance |
| Opening Bars | The first Cue of a fight costs 10 / 15 / 25 less | The first Solo Cued in a fight gives **5 / 7.5 / 12.5** Resonance |
| Tempo Rubato | One Cue in three is free | One Cue in three gives **half a segment** of Resonance (12.5) |
| Hollow Crown | Cues cost 10 less | Every Solo plays Cued, Thread or not. Its curse is unchanged |
| Silent Cues | A Cue costs 10 more | A Solo is Cued only if your Thread was on the hero for 1 s |

The halved gains that a line states:

| Entry | Was | Now |
|---|---|---|
| Answering Phrase | 3 / 5 / 7 | 1.5 / 2.5 / 3.5 |
| Saving Grace | 5 / 8 / 10 | 2.5 / 4 / 5 |
| Vigil Song | 1 / 1.5 / 2 a second | 0.5 / 0.75 / 1 |
| Clutch Peal | 5 / 8 / 10 | 2.5 / 4 / 5 |
| Gilt Edge | 2 / 3 / 4 | 1 / 1.5 / 2 |
| Blood and Silk | 3 a second | 1.5 |
| En Garde | 8 / 10 / 12 | 4 / 5 / 6 |
| Hawk Eye | 1 | 0.5 |
| Tin Whistle | 5 (Empowered 8) | 2.5 (4) |
| Lament Pin | 25 (35) | 12.5 (17.5) |
| Red Ink | 10 (15) | 5 (7.5) |
| Knotted Cord | 10 | 5 |
| Penitence | 4 for every 100 | 2 |
| Eternal Moment | 10 | 5 |
| Ringing Parry, Ready Answer | 2.5 | 1.25 |

Not changed, on purpose:

- **The meter:** 100, in four segments of 25. The Crescendo costs 100 (Maestro: 75).
- **Amounts that are a share of the meter, not a gain:** every "start the fight with N Resonance", Da Capo's "you keep", Prompt Book's cut to the first Crescendo.
- **Standing Ovation's and the Conductor's "more Resonance" percentages.**
- **The Reliquary's two rolled affixes, Ringing and Attentive.** Their rolled values sit in players' saves, so halving them is a save migration. Left as they are, they are worth twice as much against the halved base. This is the owner's to decide.

**The lines no longer tell the player to "Cue"**, which no key does. Where a line tells the player what to do it says "Thread": "Requiem: every hero will lose 90% of their life. Thread Kael for his dome, or Ward and heal." Elsewhere "Cued" is a state of a Solo: "Cued Solos last 50% longer." Sixteen lines were reworded this way, in the voice of [docs/voice.md](voice.md).

Why one half: with no Calling the scale hardly matters to a fight. With the Conductor, whose Crescendo is his best thing, one half puts his boss fights back on their old length (94 s against 96 s). A full song now comes about once a boss fight. It was once in two or three, when most Resonance went on Cues. Folding the half into the numbers changed no fight: 520 fights replayed before and after were identical to the last digit of Resonance gained.

## The Conductor

It stays a Calling of skill. A **Duet** is a Solo Cued within 4 seconds of the last Cued Solo, a **Trio** a third: follow each Solo with the Thread as it fires, one, two, three. The Grand Finale is as it was. A hero whose turn is still to come keeps their Solo for it, and when it ends every Solo is full, so the three fire a second apart: a Trio for the taking.

A plain Solo neither joins a chain nor breaks one, as before. Measured, only 0 to 3% of Duets and Trios have a plain Solo inside them, so a rule either way would change almost nothing.

With A Tempo the heroes hold a ready Solo for the next downbeat, so Solos come a bar apart (2.7 s). The beat strip shows when the next one begins and whose it is. A Tempo gives 15 Resonance for each Solo Cued on the beat. At 5, half the old free Cue's worth, his A Tempo paths were slower than before the rework (59 s a boss fight against 51 s). At 15 they are back (50 s and 78 s, against 51 s and 80 s). The Conductor gains 10% more Resonance, so the card says 15 and the meter gains 16.5.

On the HUD the badge says **Duet** or **Trio** and nothing else, outlined until your Thread is on that hero, then filled. A Tempo's chime sounds on each Cued Solo it pays for.

## The bots

- **Skilled** (and the Expert through it), rule `soloCue`: `lead` seconds before a Solo is due, the Thread goes to that hero; then back. Kael counts from the moment his wall is full, since he may raise it at any time. Not while a hero is held, condemned, down or under `danger` of their life (Brann aside), nor through the Grand Silence. With Fortissimo Silence's first pulse near and no Crescendo, the Thread goes to Kael for the dome.
- **Novice**, `NOVICE_SOLO`: with a Solo due within a second on a hero she isn't threading, a 30% chance each decision to swing the Thread over. Once she has, it stays until the Solo fires (4 s at most). More often with a Conductor's chain open (40%), with A Tempo's beat to go by (50%), and in the Finale's last burn (50%).
- The rules that timed a Cue are gone: the Skilled bot's damage-Solo and dome rules, `serenCue`, `oroCue`, `conductChain`, `conductHold`, `conductBeat`. The Novice's `reigniteCue` keeps its name: it is now her chance to follow a reignited Solo.

## What it does to the numbers

13 fights across the four Movements, 20 seeds, both bots.

| | Skilled, bosses: win | Seconds | Heroes downed | Solos Cued / plain |
|---|---|---|---|---|
| Before, the bot Cueing | 96% | 133 | 0.90 | 10.1 / 0.2 |
| Before, a player who never Cued | 91% | 226 | 1.79 | 0 / 1.0 |
| As built | 96% | 133 | 0.74 | 11.5 / 1.1 |

The Skilled bot's fights are where they were. The player who never touched the Cue key is the one whose game changed: their heroes now use their Solos.

The Conductor (Marcato, Reprise, Ensemble, Triad), Skilled, bosses: 99% in 96 s before, 99% in 94 s now, with 2.3 Duets and 1.1 Trios a fight (2.8 and 1.0 before).

**The Novice wins more boss fights than before** (65% against 46%), because her heroes now use their Solos. The fights were left as they are, as decided, and her bands are re-set to the new results.

Whole runs, as the baselines played them when the rules were first built, before tuning. Two-Movement Expeditions, 150 seeds: the Skilled bot wins 70% (73% before), the Novice 21% (13%). The Finale route, 80 seeds: Skilled 65% (65%), Novice 4% (1%).

Each Calling was measured again with the Skilled bot and held. The Novice with the Martyr wins 64% of her boss fights (49% before).

**One fight got harder: the Frayed Threshold**, Movement III's first skirmish. 150 fights each: the Skilled bot wins 85 to 88% where it won 93%, the Novice 51 to 55% where she won 63%. The Skilled result is still inside its band. The cause is found. That fight's Shears cut the Thread, so the bot keeps the Thread off Lyra, so her Gale Barrage fires plain, and plain it roots her to the spot, where she is killed. Five kinds of hero judgement were tried there and none helped without hurting elsewhere. One change does fix it: if a plain Gale Barrage no longer rooted Lyra, the fight goes back to 93% and 57%. But "Lyra roots herself; Cued, she can move" is how her Solo is described, so it was left for the owner.

## Old replays and settings

- **`SIM_VERSION`** 22 → 23. The content's version moved.
- **Settings** 4 → 5. An old settings file loads. Three things are dropped from it: the Hero autonomy switch, the Cue modifier, and anything bound to the Cue key or the pad's Cue button. Every other setting is read as saved. A key the player had given to something else stays theirs, `T` included.
- **Run saves (5) and profiles (10) did not move.** They load unchanged.
- **Fight replays** 6 → 7 and **run replays** 1 → 2: there is no `cue` command and no `autonomy` assist in them. An old replay cannot be played back, because its fights were played by the old rules. It is refused in one sentence: "This replay is from an earlier version. It can't be played back." It is never shown as a check that failed. In the Atlas an old run replay shows under the grey "Claimed" flag, the one that means "its replay hasn't been checked", and a code given with it still stands as a claim for its week. The sentence lives once, in `src/sim/replay.ts`. The tools `tools/replay-verify.ts` and `tools/run-verify.ts` print it and give an old replay its own exit code, 3.
- **Every recorded result that plays a fight was recorded again**, once, after tuning: the goldens, the Dissonance pins, the bots' command snapshots, the baselines, the frozen "before the fill" copies. The fight-derived picture and sound snapshots follow them.
- **Names kept:** the fight tally's `freeCues` and `saved` now count the Cued Solos A Tempo paid for and the Resonance it gave. Renaming them would change the run save's shape and every Conductor fight's hash, so they stay.

## Tools

- `tools/solo-study.ts`: the study. It plays a set of fights with a chosen follower and economy and prints Solos Cued, wins, seconds and heroes downed.
- `tools/person.ts`: the stand-in for a person's hands.
- `tools/verbs.ts --rules soloCue`: plays the Skilled bot with its Solo rule off.
- For the labs and the tests there is a debug command, `{ t: 'debug', op: { op: 'fireSolo', slot, cued } }`: that hero fires their Solo now, Cued or plain, whatever its charge.
- For the browser tests, `window.__AW__.solos()` reads each hero's charge, the sim's `soloDueIn` and `threadCues`, and the fight's count of Cued Solos, Duets and Trios.

## What was measured and what was not

Measured: every number on this page, by bots and by the stand-in for hands, in the sim.

Not measured, or not checked:

- **Nobody has played it.** The stand-in is a model of hands, not hands. Whether a person notices the strip and the ring in time was not measured: tuning measured the hands, not the eyes.
- **The sound has not been listened to** on speakers or in a busy boss fight. Its levels, pitch and gates are checked in tests.
- **The mark in motion.** Its breath, pop and fill are tested as numbers and looked at in stills.
- **Auto-Thread** with a gamepad, with Oro, with Brann, and in a Conductor fight with A Tempo. Those are read from the rule, not run.
- **A weekly run under way when the update arrives.** Read from the code, not run: its log is the old format and does not read, so that run makes no replay and its result stays Claimed.
- **Whole numbers.** The halved gains include 12.5, 7.5, 2.5 and 1.25. They are exact, which is why no fight moved. Rounding any of them is a small balance change and wants a re-measure.
- **Performance** of the mark. It adds two sprites a hero to a batch that already exists.

## For the owner to decide

1. Whole numbers or exact halves on the cards.
2. The Reliquary's Ringing and Attentive affixes: keep them at twice their old worth, or halve them with a save migration.
3. The Frayed Threshold: leave it harder, or let a plain Gale Barrage not root Lyra.
4. Whether Brann counts for Auto-Thread's 60% line. He is left out today.

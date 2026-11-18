# Solos: heroes fire their own

*2026-11-18 · follows [hero autonomy](hero-autonomy.md), which it replaces · the Conductor: [Phase 5f](phase-5f.md)*

The owner's note: "I feel like no players will manually trigger the solos/specials of each character - so either remove the manual trigger or design the game around auto triggering."

Measured, it was worse than that. Hero autonomy was off unless a player turned it on, so a player who never pressed the Cue key never saw a Solo at all, and their boss fights took 70% longer. So the game is now built around heroes firing their own Solos. There is no Cue key. What is left to the player is where the Thread is.

This page is the rule as built, in the sim, the content, the bots, the controls, the HUD and the sound.

## The rules

1. **Heroes fire their own Solos.** A Solo charges by fighting, as before. Full, with someone to fight, the hero waits **1 second**, then fires it.
2. **Kael judges his wall.** With someone to fight, he raises Aegis Wall at once when he is under half his life, when a big hit is coming at him, or (Shieldbearer) when a hero beside him falls low. Otherwise he holds it for a big hit, but never more than **3 seconds**.
3. **One at a time.** No hero starts a Solo within **1 second** of another hero's starting. Three Solos that come due together fire a second apart. Kael's urgent wall and the Grand Finale's turns ignore this.
4. **The Thread is the Cue.** If the Weaver's Thread is on the hero on the tick the Solo fires, it is a **Cue**: the Solo plays in its stronger, Cued form. If not, it is the plain form. A Cue costs nothing. There is no grace before or after the tick.
5. **A Cue does everything a Cue did.** The hero's call, the spotlight, the chorus pulse, Canon, Constellation, every "Cued Solo" motif and relic, and the Conductor's chain.
6. **Resonance buys the Crescendo and nothing else.** It no longer pays for Cues, so the meter is **twice as deep**: 200, in four segments of 50, and a full song costs all of it. Every gain is the whole number it always was.
7. **The wait starts over after a gap**: no one to fight, downed, stunned, being Reeled. A hero who cannot act does not fire. A hero with a Grand Finale turn still to come keeps the Solo for it.
8. **A hero finishes what they are casting first.** A Solo that comes due while its hero is mid-cast begins when the cast ends. Before this, one Solo in five threw the hero's own cast away, and one in twenty a Flourish the Weaver had just answered a call for.
9. **Kael's dome on demand.** With his wall full and **your Thread on him**, Kael raises it at once when a hit is about to land on two or more of the party within **1.5 seconds**. Cued, the wall is a dome over everyone. So "a big hit is coming for everyone: thread Kael" is something a player can do on purpose, and the coach says so.
10. **No plain Solo roots its hero.** Lyra's Gale Barrage and Hawk's Vigil, and Vexis's Starfall fired plain, no longer pin the hero who fires them. Only a Cued Starfall still roots Vexis.
11. **Oro's wait runs whenever the party fights.** He takes no target of his own, and his wait used to run only while a Sapling fought, so with every Sapling felled his Solo sat unfired.

Tried and left out, because they changed no fight in 780: holding a Solo on a wave's last, nearly dead enemy, and holding it while the target cannot be hurt. Tried, kept for a round, and then removed: a rooting Solo waiting out a hit. With rule 10 it has nothing left to guard.

The numbers live in one place, `SOLOS` in `src/sim/constants.ts`:

| Name | Value | What it is |
|---|---|---|
| `wait` | 1 s | How long a full Solo waits before the hero fires it |
| `kaelHold` | 3 s | The longest Kael keeps a full wall for a big hit |
| `gap` | 1 s | No hero starts a Solo this soon after another's began |
| `tell` | 3 s | How long before a Solo is full it counts as coming. The whole tell is up to 4 s: 3 of charge, 1 of wait |
| `lead` | 0.5 s | How long before a Solo is due the Skilled bot and Auto-Thread move the Thread there |
| `danger` | 30% | Neither follows a Solo while a hero is under this share of their life |
| `partyHit` | 1.5 s | Rule 9 |

The sim answers every question the screens and the bots ask about a Solo, in `src/sim/systems/solos.ts`. Nothing outside it keeps a copy of a rule.

| Question | Function |
|---|---|
| Is the Thread on them, so that this Solo would be a Cue? | `threadOn` |
| Would it play in its Cued form? (The same, or any Solo under Hollow Crown.) | `threadCues` |
| How long until this hero fires, by their own tell? Null when none is coming, which covers a hero who cannot fire. | `soloDueIn` |
| Who fires next, and when? The Solos coming, in order, a gap apart, a cast being finished counted. | `soloQueue`, `soloTurnIn` |
| Under Silent Cues, can a Thread put on them now still Cue it? | `cueInReach` |
| Would Kael raise his wall at once for the party, were the Thread on him? | `wallWanted` |

The bots read `soloDueIn`. The frames, the mark, the beat strip and Auto-Thread read the queue.

## For hands

*Measured on the final rules.*

The bots move the Thread within one tick. A person does not. So tuning built a stand-in for a person's hands (`tools/person.ts`, played by `tools/solo-study.ts`): the Skilled bot's play, but the Thread goes to a Solo 350 ms after it is noticed, stays until the Solo fires, misses one Solo in six altogether, and never leaves a hero under 30% of their life. 140 boss and mini-boss fights each, no Calling:

| Who | Solos Cued | Win | Seconds | Heroes downed |
|---|---|---|---|---|
| The Skilled bot | 92% | 97% | 129 | 0.69 |
| Person, goes when the tell appears | 81% | 96% | 137 | 1.06 |
| Person, goes only when the Solo is full | 85% | 99% | 131 | 0.71 |
| The same, hands at 600 ms | 86% | 98% | 131 | 0.69 |
| The same, hands at 800 ms | 84% | 96% | 128 | 0.68 |
| The same, hands at 1 s | 63% | 96% | 134 | 0.76 |
| A player who never follows a Solo | 35% | 92% | 136 | 0.88 |

The target was 70%. So **the 1 second wait stays, and the rule was not widened.** Five in six is the ceiling, since the stand-in misses one in six on purpose. What this says:

- **The moment to move is when the Solo is full**, not when its tell first shows. The person who goes at the first sign keeps the Thread there for up to 4 s and pays for it: fights take 5% longer and one more hero in three goes down.
- **The wait is a hard edge.** Hands as slow as 800 ms still make it. At 1 s a third of the Solos are missed. (That is fewer than on the first rules, where 1 s hands got 52%: a hero now finishes a cast before the Solo, which sometimes gives slow hands a little longer.)
- **Kael is the hardest to Cue** (73 to 82%, against 83 to 89% for Lyra and Vexis), because he raises his wall at once when he is hurt, with no wait to react in. His frame shows no countdown for that reason.
- Other waits measured no better: 0.75 s and 1.5 s give the same share Cued (85% and 84%) and the same fights.
- A player who never moves the Thread for a Solo still has a third of them Cued, on whoever the Thread is on, and still wins 92% of boss fights, seven seconds slower than the Skilled bot. The one fight where following plainly matters is the Seamstress: such a player wins it 65% of the time (13 of 20), against 95% for the Skilled bot and for the person who goes when the Solo is full.

## What the player sees and hears

- **The party frame.** A strip appears on a hero's frame when their Solo is coming. Quiet while it charges (the last 3 seconds): the Solo's name in a dashed outline and the seconds. Loud once it is full (the 1 second wait): a solid gold outline, **"Thread to Cue"** and the seconds. With your Thread on that hero at either stage: a filled gold strip with a tick, **"Cued"**, and a second ring round the portrait. Kael's strip shows no seconds. There is no AUTO tag and no key cap.
  - The seconds are the hero's turn: two heroes waiting on the one-second gap read a second apart, and a hero finishing a cast counts to the cast's end.
  - A hero who cannot fire (stunned, stilled, possessed, being Reeled) shows no strip.
  - A screen reader is told each state once, in a sentence ("Lyra's Gale Barrage is full. Thread them to Cue it."), and never the seconds.
- **The mark over the hero** (`src/render/soloMark.ts`). A ring over their head that fills until the Solo fires. Dashed round a note while your Thread is elsewhere, smaller while the Solo charges and full size once it is full. Solid, with rays, a third larger, once your Thread is on them. It stands down while a Fermata holds the hero, moves up over a call's bubble, does not breathe or pop under Reduced motion, and takes the palette's call colour in every colour vision.
- **The Resonance meter** has no Cue ticks and no price.
- **Call-outs.** "Cued · Lyra: Gale Barrage" when your Thread was on her, "Lyra: Gale Barrage" when it was not.
- **The coach.** "Lyra's Gale Barrage is coming. Thread them 2 to Cue it: the stronger form". And, when Kael's wall is full and a hit is coming for more than one hero: "A hit is coming for the party. Thread Kael 1: Cued, his wall shields everyone".
- **The primer's last row** is "Cue their Solos": "Heroes fire their own Solos. A Solo fired with your Thread on them is Cued: the stronger form." "Cued" is explained in that one phrase everywhere: the primer, the Codex, the strip's tooltip.
- **Result and Summary** count every Solo the heroes fired: "7 of 9 Solos Cued."
- **Under Silent Cues** nothing asks for the Thread once it is too late: the strip, the mark and the coach go quiet when the Solo will fire before the Thread could have held its half second.
- **Sound.** A soft tick on the hero's own note as a Solo's wait begins. It replaces the glass note that used to mean "you can buy a Cue now". Three waits that begin together share one rolled tick.

**A first fight, untouched.** In First Light, the first fight of a run, each hero's Solo charges in about 30 seconds and fires once near the end. A player who presses nothing at all sees those Solos fire plain. That player also heals nobody: on two of six seeds tried the party fell before the fight was won, as it did before the rework.

## Controls and Auto-Thread

- **No key Cues a Solo.** `T` and the gamepad's right bumper do nothing, and are free to bind to something else. A hero's number threads that hero, whatever is held with it. Controls has no Cue row and no Cue modifier.
- **The Hero autonomy setting is gone** from Settings and Prep. A player who had it on is no longer marked as assisted.
- **Auto-Thread follows Solos** (`autoSoloTarget` in `src/input/InputController.ts`). It is still an assist and still off unless turned on. Once the player has not touched the Thread itself for 2 seconds, and nobody is in danger, the Thread goes to a hero `lead` seconds before their Solo is due, stays until it fires, then goes back to where it was. Ward, Chime and moving do not hold it back. The player's own touch on the Thread ends a follow at once.
  - It does not leave the hero the Thread is on while that hero is under 60% of their life. That holds on the way back too: it stays on a hurt hero it followed, and goes back once they are over the line.
  - It follows the Solo that really fires next (the sim's queue), so a hero finishing a cast does not hold it while another fires.
  - A click that threads nobody is not a touch of the Thread.
  - It follows nothing while a hero is downed, on a Fermata hold, condemned, or under `danger` of their life. Brann is left out of both lines, since he sits low on purpose.
  - Once Kael's wall is full and he has someone to fight, the Thread waits on him between the other heroes' Solos.
  - Its older rule is unchanged: with no input at all for 2 seconds, the Thread goes to the hero lowest on life.

## What changed in the content

The owner chose whole numbers. So instead of halving every Resonance gain, the meter is twice as deep. The economy is the same either way: 936 fights replayed with halved gains and with the doubled meter are identical, and the Resonance gained is exactly twice, to the last digit.

**The meter**

| What | Before | Now |
|---|---|---|
| A Cue's price | 25 Resonance (the Conductor's 20) | Nothing. `resonance.cueCost` is gone. |
| The meter holds | 100, in four segments of 25 | **200, in four segments of 50** |
| A full song costs | 100 | **200** |
| Maestro's Grand Finale costs | 75 | **150** |
| A part segment fades at | 4 a second | **8 a second** |

**Every gain is as it was before the rework.** A Perfect Ward 20, a Save 25, a Clutch Chime 15, a Reel that takes a hero clear 15, an answered call 10, a Cleanse 5, a Ward that absorbs a hit 5, Empowering 1 a second, a kill by an Empowered hero 2. So is every gain a motif, a relic, a Bond, a Calling or the Astrolabe names, and the Reliquary's Ringing and Attentive affixes as rolled. None of those lines changed.

**What is a share of the meter doubled with it**

| Entry | Was | Now |
|---|---|---|
| Cantor's Hymnal: start every fight with | 50 (Empowered 75) | 100 (150) |
| Upbeat: every fight begins with | 50 | 100 |
| Deep Well: start every fight with | 12 | 24 |
| Da Capo: you keep | 25 | 50 |
| Prompt Book: your first Crescendo costs less by | 15 (20) | 30 (40) |
| Fortissimo Silence's decree with no dome: keep | 100 | 200 |

Percentages (Standing Ovation, the Conductor's "more Resonance") did not move.

**What changed its meaning with the Cue**

| Entry | Before | Now |
|---|---|---|
| The Conductor's passive | Cues cost 20; 10% more Resonance; Duets and Trios | 10% more Resonance; Duets and Trios |
| A Tempo | A Cue on the downbeat is free | The heroes begin their Solos on the downbeat (within 0.15 s of it). Each one Cued gives **30** Resonance |
| Opening Bars | The first Cue of a fight costs 10 / 15 / 25 less | The first Solo Cued in a fight gives **10 / 15 / 25** Resonance |
| Tempo Rubato | One Cue in three is free | One Cue in three gives **half a segment** of Resonance (25) |
| Answering Phrase | 3 / 5 / 7 Resonance for a Cue within 4 s of another | The same, for a Solo Cued within 4 s of another |
| Hollow Crown | Cues cost 10 less | Every Solo plays in its Cued form, wherever your Thread is. Only one your Thread is on counts as a Cue. Its curse is unchanged |
| Silent Cues | A Cue costs 10 more | A Solo is Cued only if your Thread was on the hero for **0.5 s** |
| The Maestro Deed | Cue 25 Solos in one run | Have **75** Solos Cued in one run |
| Gale Barrage | Lyra roots herself; Cued, she can move | "Lyra looses twelve arrows a second for three seconds." Cued: "her arrows hit a third harder and crit 40% more often." |

Three of those want a word:

- **Hollow Crown** gave a Conductor his Duets and Trios for nothing when "every Solo is Cued" was taken literally. Now it gives the Cued form and nothing else. The tally, the Conductor's chain, A Tempo's gift, the Maestro Deed and every "when a Solo is Cued" want the Thread.
- **Silent Cues** held for a whole second, as long as the wait, so a Thread sent the moment a Solo filled was one tick late. At half a second it is in time.
- **The Maestro Deed** at 25 came to a player who never followed a Solo. A Weaver who never follows gets about 45 Cued on the longest route, one who does about 110.

**The lines no longer tell the player to "Cue"**, which no key does. Where a line tells the player what to do it says "Thread": "Requiem: every hero will lose 90% of their life. Thread Kael for his dome, or Ward and heal." Elsewhere "Cued" is a state of a Solo: "Cued Solos last 50% longer." The content's lines and the screens' were reworded this way, in the voice of [docs/voice.md](voice.md).

Why the meter is twice as deep and not the same depth: with no Calling the size of the economy hardly matters to a fight. With the Conductor, whose Crescendo is his best thing, this size puts his boss fights back on their old length (93 s against 96 s). A full song now comes about once a boss fight. It was once in two or three, when most Resonance went on Cues.

## The Conductor

It stays a Calling of skill. A **Duet** is a Solo Cued within 4 seconds of the last Cued Solo, a **Trio** a third: follow each Solo with the Thread as it fires, one, two, three. The Grand Finale is as it was. A hero whose turn is still to come keeps their Solo for it, and when it ends every Solo is full, so the three fire a second apart: a Trio for the taking.

A plain Solo neither joins a chain nor breaks one, as before. Measured on the first round's rules, only 0 to 3% of Duets and Trios have a plain Solo inside them, so a rule either way would change almost nothing. The chain's rule has not changed since.

With A Tempo the heroes hold a ready Solo for the next downbeat, so Solos come a bar apart (2.7 s). The beat strip shows when the next one begins and whose it is. A Tempo gives 30 Resonance for each Solo Cued on the beat, of a meter of 200. At a third of that his A Tempo paths were slower than before the rework (59 s a boss fight against 51 s), because the heroes now hold their Solos for the downbeat. At 30 they are back: on A Tempo, Upbeat, Spotlight and Maestro the Skilled bot's boss fights take 50 s, against 51 s before, and 3.3 Solos a boss fight are Cued on the beat. The Conductor gains 10% more Resonance, so the card says 30 and the meter gains 33.

On the HUD the badge says **Duet** or **Trio** and nothing else, outlined until your Thread is on that hero, then filled. It shows only when the Solo is due before the chain closes, so a badge is a promise the Solo keeps. A Tempo's chime sounds on each Cued Solo it pays for.

## The bots

- **Skilled** (and the Expert through it), rule `soloCue`: `lead` seconds before a Solo is due, the Thread goes to that hero; then back. Kael counts from the moment his wall is full, since he may raise it at any time. Not while a hero is held, condemned, down or under `danger` of their life (Brann aside), nor through the Grand Silence. With Fortissimo Silence's first pulse near and no Crescendo, the Thread goes to Kael for the dome. Under Hollow Crown it follows only on a Conductor run, for the chain.
- **Novice**, `NOVICE_SOLO`: a beginner's hands. She sees a Solo only once it is full, decides once for that Solo whether to go at all (4 times in 10), goes in its last half second, and gives it 2 seconds to fire. Never while a hero is under 30% of their life, and she does not sit on Kael while he holds his wall. More often with a Conductor's chain open, with A Tempo's beat to go by, and in the Finale's last burn. She gets 45% of boss-fight Solos Cued; a player who never follows a Solo gets 35%.
- The rules that timed a Cue are gone: the Skilled bot's damage-Solo and dome rules, `serenCue`, `oroCue`, `conductChain`, `conductHold`, `conductBeat`. The Novice's `reigniteCue` keeps its name: it is now her chance to follow a reignited Solo.

## What it does to the numbers

The study's 13 fights across the four Movements, 20 seeds: 140 boss and mini-boss fights in each row. "Before" is main, measured with the same fights and seeds. "Now" is the final rules, measured after the second round. (The rework was tuned in two rounds. The second added rules 8, 10 and 11, a cast finished first, no plain Solo rooting and Oro's wait, and gave the Novice a beginner's hands.)

**Boss and mini-boss fights, the Skilled bot: held.** Win / seconds / heroes downed.

| Calling | Before | Now |
|---|---|---|
| None | 96% / 133 / 0.90 | 97% / 129 / 0.69 |
| Luminary | 99% / 124 / 0.75 | 96% / 117 / 0.68 |
| Martyr | 96% / 135 / 0.87 | 95% / 132 / 0.76 |
| Chronomancer | 99% / 132 / 0.66 | 99% / 128 / 0.62 |
| Conductor: Marcato, Reprise, Ensemble, Triad | 99% / 96 / 0.42 | 96% / 93 / 0.44 |
| Conductor: A Tempo, Upbeat, Spotlight, Maestro | 100% / 51 / 0.10 | 100% / 50 / 0.06 |
| Silent Cues, no Calling | not measured | 96% / 129 / 0.72 |

Three rows are 1 to 3 points under "before"; over 140 fights that is one to two standard errors, and each is far inside the Skilled bot's band. The Skilled bot Cues 92% of Solos with no Calling and 89% under Silent Cues. The Conductor's first path makes 2.3 Duets and 1.0 Trios a boss fight (2.8 and 1.0 before).

The Skilled bot's fights are where they were. The player who never touched the Cue key is the one whose game changed: before, that player's boss fights took 226 seconds and their heroes used no Solo at all.

**The Novice wins more, and it is the heroes' doing, not her following.** She wins 67% of boss fights with no Calling where she won 46%. That gain comes from her heroes firing their own Solos: with her following switched off altogether she wins 71% (the difference is noise). Her following, with a beginner's hands, gets 45% of Solos Cued instead of 24%, and makes her fights 14 seconds shorter (164 s against 178 s). (After the first round, when she swung the Thread to a Solo within one tick, she Cued 60% and won 75%.) A player who never follows a Solo gets 35% Cued.

| Calling | The Novice before | Now | Solos Cued now |
|---|---|---|---|
| None | 46% | 67% | 45% |
| Luminary | 66% | 74% | 43% |
| Martyr | 49% | 65% | 42% |
| Chronomancer | 61% | 74% | 43% |
| Conductor: Marcato, Reprise, Ensemble, Triad | 71% | 81% | 48% |
| Conductor: A Tempo, Upbeat, Spotlight, Maestro | 87% | 90% | 64% |
| Silent Cues, no Calling | not measured | 68% | 25% |

Her bands in the harness are set to what she measures (`MOVEMENT_BANDS` in `tools/harness.ts`): about 15 points either side of her result over 40 fights a cell; the skirmish floors were kept, and she clears them.

| The Novice's band | Before the rework | Now |
|---|---|---|
| Movement II elites | 35-75% | 65-95% |
| Gorehound Matriarch | 40-70% | 75% or more |
| Vharun | 35-65% | 55-85% |
| Movement III skirmishes | 55% or more | 45% or more |
| Movement III elites | 30-65% | 20-50% |
| The Seamstress | 30-60% | 45-75% |
| The Unweaver | 25-55% | 60-90% |
| The Silent Conductor | 15-40% | 20-50% |

The Skilled bot's bands did not move.

**Whole runs**, as the baselines play them. Two-Movement Expeditions, 150 seeds: the Skilled bot wins 76% (73% before), the Novice 31% (13%). The Finale route, 80 seeds: Skilled 73% (65%), Novice 1% (1%).

**Two fights lost ground in the first round, and the second round mended both.** Both have enemies that cut the Thread, so the bot keeps the Thread off Lyra, so her Gale Barrage fired plain, and plain it rooted her to the spot, where she was killed. No plain Solo roots now. 150 fights each:

| Fight | Before | After the first round | Now | Its band | The Novice now (her band) |
|---|---|---|---|---|---|
| The Frayed Threshold (Movement III, first skirmish) | 93% | 85 to 88% | 94% | 85% or more | 56% (45% or more) |
| The Seamstress (Movement III, mini-boss) | 94% | 89% | 91% | 90% or more | 59% (45-75%) |

The Silent Conductor's fight is a little quicker than its band for the Skilled bot in the study: 167 s (the band is 170 to 230 s; it was 175 s before the rework).

**Finishing a cast first has a cost the bots do not show.** Vexis casts almost without pause, so her Solo now fires after its own wait has run out in 4 Solos of 10, by a second on average and 2.2 seconds at most (39 fights, the Skilled bot, on the final rules). The Skilled bot still gets 92% of Solos Cued. For a player it means her strip can stand at "Thread to Cue" for a second or two. The frames and Auto-Thread count the cast (the sim's queue); the bots' own tell, `soloDueIn`, does not.

## Old replays and settings

- **`SIM_VERSION`** 22 → 23. The content's version moved.
- **Settings** 4 → 5. An old settings file loads. Three things are dropped from it: the Hero autonomy switch, the Cue modifier, and anything bound to the Cue key or the pad's Cue button. Every other setting is read as saved. A key the player had given to something else stays theirs, `T` included.
- **Run saves (5) and profiles (10) did not move.** They load unchanged.
- **Fight replays** 6 → 7 and **run replays** 1 → 2: there is no `cue` command and no `autonomy` assist in them. An old replay cannot be played back, because its fights were played by the old rules. It is refused in one sentence: "This replay is from an earlier version. It can't be played back." It is never shown as a check that failed. In the Atlas an old run replay shows under the grey "Claimed" flag, the one that means "its replay hasn't been checked", and a code given with it still stands as a claim for its week. The sentence lives once, in `src/sim/replay.ts`. The tools `tools/replay-verify.ts` and `tools/run-verify.ts` print it and give an old replay its own exit code, 3.
- **Every recorded result that plays a fight was recorded again**, once, after tuning: the goldens, the Dissonance pins, the bots' command snapshots, the baselines, the frozen "before the fill" copies. The fight-derived sound snapshots follow them.
- **The frozen "before the fill" copies are no longer from before the fill.** `tests/fill/pre5g/` was frozen again from the reworked tree with the fill masked out. The masked replay (`tests/fill/masked.test.ts`) still catches a later change that leaks through the mask. It no longer shows that the fill was inert against a tree from before it existed: that was shown when the fill went in ([docs/phase-5g.md](phase-5g.md), ground rule 5).
- **Names kept:** the fight tally's `freeCues` and `saved` now count the Cued Solos A Tempo paid for and the Resonance it gave. Renaming them would change the run save's shape and every Conductor fight's hash, so they stay.
- **One key added to a fight's saved stats:** `plainSolos`, optional, so a run saved before it still loads and the run save stays 5. A fight without it says "7 Solos Cued" where a new one says "7 of 9".

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
- **Performance** of the mark. It adds two sprites a hero to a batch that already exists.

Known, and kept:

- **A hero finishes a cast before their Solo, so Vexis's Solo fires late in about 4 Solos of 10, by about a second.** The frames and Auto-Thread count the cast; the bots' `soloDueIn` does not, and stays so, since changing it would move every recorded fight result again.

## Decided on the way

- **Whole numbers.** The owner chose them: the meter is 200 and every gain is the number it was.
- **A plain Gale Barrage does not root Lyra.** That mended the Frayed Threshold, and nothing was lost anywhere.
- **The Reliquary's Ringing and Attentive affixes** need no migration: with the gains back to their old numbers they are worth what they were.
- **Brann stays out of Auto-Thread's 60% line**, as he is out of the danger line.
- **A hero finishes a cast before their Solo**, Vexis's late Solos included. The alternatives were a Solo that cuts a cast short, as before, or a hero who starts no new cast once a Solo is ready.

## For the owner to look at

1. **A first fight nobody touches.** The Solos fire once, near the end, plain. On two of six seeds tried the party falls before the fight is won, because nobody is healed. That was so before the rework too.

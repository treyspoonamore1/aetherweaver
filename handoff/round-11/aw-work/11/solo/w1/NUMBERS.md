# Solos: the numbers W1 settles (for W3's wording and frames)

Newest entries are appended at the end with the time. If a number here moves later, the old
entry stays and a new one says so.

## 1. For hands: the wait, the tell, and what counts as Cued

*18 November 2026, about 06:35 UTC. Settled. Nothing in the sim changed.*

| Number | Value | Where |
|---|---|---|
| The wait: how long a full Solo waits before the hero fires it | **1 second** | `SOLOS.wait` |
| Kael's hold: the longest he keeps a full wall for a big hit | **3 seconds** | `SOLOS.kaelHold` |
| The gap: no hero starts a Solo this soon after another's began | **1 second** | `SOLOS.gap` |
| The tell: how long before a Solo is full it counts as "coming" | **3 seconds** (so the whole tell is up to 4 s: 3 of charge, 1 of wait) | `SOLOS.tell` |
| Cued | **The Thread is on the hero on the tick the Solo fires.** No grace before or after. | `threadCues` |

`soloDueIn(state, hero)` gives the seconds until a hero's Solo fires (null when none is coming),
and `threadCues(state, hero)` says whether it would be Cued if it fired now. Both are exported
from `src/sim`. For the frames: `hero.solo >= 100` is "full, the wait is running"; below that,
`soloDueIn` counts down the last 3 s of charge plus the wait.

### What was measured

A "person" follower (`tools/person.ts`, played by `tools/solo-study.ts`): the Skilled bot's play,
but with a person's hands on the Thread for Solos. It notices a Solo, moves the Thread there 350
ms later, keeps it there until the Solo fires, misses one Solo in six altogether, and does not
leave (and goes back to) a hero under 30% of their life. 84 boss and mini-boss fights each.

| Who | Solos Cued (bosses) | Win | Seconds | Heroes downed |
|---|---|---|---|---|
| The Skilled bot (moves within a tick) | 91% | 98% | 131 | 0.75 |
| Person, goes when the tell appears (DECISION.md's follower) | **81%** | 99% | 144 | 0.99 |
| Person, goes only when the Solo is full (the wait alone to react in) | **84%** | 98% | 130 | 0.56 |
| The same, hands at 600 ms | 85% | 99% | 132 | 0.71 |
| The same, hands at 800 ms | 83% | 98% | 133 | 0.76 |
| The same, hands at 1 s (as long as the wait) | 52% | 94% | 146 | 0.86 |
| A player who never follows a Solo | 34% | 94% | 142 | 1.12 |

The target was 70% Cued for the follower. It gets 81%, so **the 1 s wait stays and the rule is
not widened.** Five in six is the ceiling (it misses one in six on purpose); the rest is Kael.

By hero, the person's share Cued: Lyra 86 to 90%, Vexis 83 to 85%, **Kael 72 to 78%**. Kael is
lowest because he raises his wall at once when he is hurt or a big hit is coming, with no wait
to react in. That is his judgement, and it is the right call for the wall; his frame should not
promise a countdown he may cut short.

Other waits, same follower: 0.75 s gives 84% (85% at 600 ms hands); 1.5 s gives 84% but the
fights get a little worse (95% won, more heroes downed) because Solos sit unused longer. Nothing
is gained by moving it.

### What this means for the frames and the mark (W3)

- **The moment to move is when the Solo is full**, not when the tell appears. The person who
  goes at the first sign of the tell keeps the Thread on that hero for up to 4 s and pays for it:
  fights take 10% longer and one more hero in four goes down. The one who goes when it is full
  does as well as the Skilled bot.
- So show two stages. **Coming** (the last 3 s of charge): quiet, a countdown or a filling ring;
  it lets the hand get ready. **Now** (the 1 s wait): the loud one; "Thread here".
- With the Thread already on the hero during either stage, show "will be Cued" (`threadCues`).
- A shorter tell (1 to 2 s) measured no better or worse for Cued Solos; 3 s is kept so the quiet
  stage has room. If the frames want a shorter quiet stage, they can simply show less of it:
  `soloDueIn` minus the wait is the charge left.
- Hands as slow as 800 ms still make it. At 1 s they do not: the wait is a hard edge, so the
  "now" stage must start exactly when the Solo is full, not late.
- With A Tempo, `soloDueIn` already includes the wait for the downbeat.

## 2. Resonance: the scale, and every number a text states (REPLACED by section 7)

> **Replaced on 18 November, 17:00 UTC.** The gains are whole numbers again and the meter is
> twice as deep. Section 7 is what the screens state now. What follows is kept as the record of
> the first round.

*18 November 2026, 06:50 UTC. Settled, and folded into the content on `p11/solo`.*

**The scale is one half, as built, and it is now written into the numbers themselves.** Every
Resonance gain the content names is half what it was. `gainScale` is 1 and does nothing (it is
kept only so the study tool can try another economy for a run). The texts that take their number
from the content (`{v}`, `{resonance}`, `{per}`) are true again without anyone editing them.

The fold changes no fight: 520 fights replayed before and after are identical to the last digit
of Resonance gained.

### Why one half

Skilled bot, 140 boss and mini-boss fights at each scale:

| Scale | No Calling: win / seconds / downed | Crescendos a fight (bot / a player who sings at once) | Conductor, chain path: seconds |
|---|---|---|---|
| Before the rework | 96% / 133 / 0.90 | 0.44 | 96 |
| 0.4 | 96% / 132 / 0.73 | 0.66 / 0.92 | 97 |
| **0.5** | 96% / 133 / 0.74 | 0.78 / 1.28 | 94 |
| 0.6 | 94% / 132 / 0.80 | 0.91 / 1.55 | 92 |

Without a Calling the scale hardly matters to the result (the plain Crescendo is small). With
the Conductor, whose Crescendo is his best thing, 0.5 lands on the old 96 s. So: one half, and a
full song comes about once a boss fight (it was once in two or three, when most Resonance went
on Cues).

### The base gains (the Codex lists the first five)

| What | Was | Now |
|---|---|---|
| A Perfect Ward | 20 | **10** |
| A Save | 25 | **12.5** |
| A Clutch Chime | 15 | **7.5** |
| Reeling a hero clear | 15 | **7.5** |
| Answering a hero's call | 10 | **5** |
| A Cleanse | 5 | **2.5** |
| A Ward that absorbs a hit | 5 | **2.5** |
| Empowering, each second | 1 | **0.5** |
| A kill by an Empowered hero | 2 | **1** |

### Motifs, relics, Bonds, Callings, the Astrolabe

| Entry | Its line | Was | Now |
|---|---|---|---|
| Opening Bars (motif) | "Your first Cue in each fight gives {v} Resonance." | 10 / 15 / 25 | **5 / 7.5 / 12.5** |
| Tempo Rubato (Harmony) | "One Cue in every {v} gives ... of Resonance." | "a whole segment" (it gave half) | **"half a segment"** (12.5; the wording changed, not what it gives) |
| Answering Phrase (motif) | "Cueing a hero within 4 s of Cueing another gives {v} Resonance." | 3 / 5 / 7 | **1.5 / 2.5 / 3.5** |
| Saving Grace (motif) | "Each Save gives {v} more Resonance." | 5 / 8 / 10 | **2.5 / 4 / 5** |
| Vigil Song (motif) | "... makes {v} Resonance a second." | 1 / 1.5 / 2 | **0.5 / 0.75 / 1** |
| Clutch Peal (motif) | "A Clutch Cleanse gives {v} more Resonance." | 5 / 8 / 10 | **2.5 / 4 / 5** |
| Gilt Edge (motif) | "Kills by an Empowered hero give {v} more Resonance." | 2 / 3 / 4 | **1 / 1.5 / 2** |
| Blood and Silk (Harmony, Brann) | "... your Thread makes {v} Resonance a second." | 3 | **1.5** |
| En Garde (Bond motif, Seren) | "Each parry Seren makes grants {v} Resonance." | 8 / 10 / 12 | **4 / 5 / 6** |
| Hawk Eye (Bond, Lyra) | "... her Empowered crits give you {resonance} Resonance." | 1 | **0.5** |
| Tin Whistle (relic) | "Answering a hero's call gives {resonance} more Resonance." | 5 (Empowered 8) | **2.5 (4)** |
| Lament Pin (relic) | "When a hero goes down, you gain {resonance} Resonance." | 25 (35) | **12.5 (17.5)** |
| Red Ink (relic) | "Every Perfect Ward gives {resonance} more Resonance." | 10 (15) | **5 (7.5)** |
| Knotted Cord (relic) | "... each cut gives you {resonance} Resonance." | 10 | **5** |
| Penitence (Martyr) | "Damage you Bear fills Resonance: {per} for every 100." | 4 | **2** |
| Eternal Moment (Chronomancer) | "... a Ward cast during it that turns out Perfect gives {resonance} Resonance." | 10 | **5** |
| A Tempo (Conductor) | "... each Solo you Cue there gives {resonance} Resonance." | 10 | **5** |
| Ringing Parry (Astrolabe) | "... and gives {resonance} more Resonance" | 2.5 | **1.25** |
| Ready Answer (Astrolabe) | "Answering a hero's call gives {resonance} more Resonance" | 2.5 | **1.25** |

"Thread the Needle" says "half a Perfect Ward's Resonance" and needs no change (it is 5 now).

### Not changed, on purpose

- **The meter:** 100, in four segments of 25. The Crescendo costs 100 (Maestro: 75).
- **Amounts that are a share of the meter, not a gain:** every "start the fight with N
  Resonance" (the relic's 50 and 75, Upbeat's 50, the Reliquary's 12), Da Capo's "you keep {v}",
  Prompt Book's cut to the first Crescendo. They read as they did and are worth the same share
  of a song.
- **Standing Ovation's and the Conductor's "more Resonance" percentages.**
- **The Reliquary's two rolled affixes, Ringing ("+{v} Resonance from a Perfect Ward", 0.5 to
  2.5) and Attentive ("+{v} for answering a call", 0.5 to 4).** Their rolled values are stored in
  players' saves, so halving them is a save migration, which is W2's to decide. Left as they
  are, they are worth twice as much against the halved base (a top Ringing is +25% on a Perfect
  Ward where it was +12.5%). It is a small gift to two minor affixes; the owner should say
  whether to keep it or to halve them with a migration.

### If whole numbers are wanted

The halves are exact, which is why nothing moved. If the owner would rather not read "12.5" or
"0.75" on a card, the candidates to round are: a Save 12.5, a Clutch Chime and a Reel 7.5, a
Cleanse and a Ward's absorb 2.5, Opening Bars 7.5 / 12.5, Answering Phrase 1.5 / 2.5 / 3.5,
Vigil Song 0.75, Saving Grace and Clutch Peal 2.5, Gilt Edge 1.5, Lament Pin 12.5 / 17.5, Red
Ink 7.5, Tin Whistle 2.5, the two Astrolabe nodes 1.25. Rounding any of them is a small balance
change and wants a re-measure. The game already shows "2.5" and "1.5" in places.

## 3. Where to get it

*18 November 2026, 07:00 UTC.*

The fold is commit `3a2bab3` on `p11/solo` (content, the sim's Tempo Rubato line, the bots' one
estimate, and W1's tests). It touches no file of W2, W3 or W4. A test of yours that states one of
the old numbers from the tables above (a card that reads "gives 10 Resonance", the Codex's "20
for a Perfect Ward") will fail when the branches are joined, not before; the tables say what
each becomes. Texts that take their number from the content need nothing.

Already there since W0: the event `cueChained` carries `onBeat` (true when A Tempo paid for
that Cue), which is how to tell A Tempo's Cues now that `cost` is always 0.

## 4. Hero judgement that the frames and hints should know about

*18 November 2026, about 07:40 UTC. Commit `3432e9b` on `p11/solo`.*

Two rules were added to when a hero fires (both in `SOLOS`, `src/sim/constants.ts`):

- **Kael's dome on demand** (`partyHit` 1.5 s). With his wall full and **the Thread on him**, Kael
  raises it at once when a hit is about to land on two or more of the party within 1.5 s. Cued, the
  wall is a dome over everyone. So "a big hit is coming for everyone: thread Kael" is now a thing
  a player can do on purpose, and worth a line in the coach or the primer. Without the Thread on
  him he behaves as before (at once when he is hurt or the hit is on him; otherwise within 3 s).
- **No rooting into a hit** (`rootHold` 2 s). Vexis's Starfall and Lyra's plain Gale Barrage root
  them where they stand. If one of those is due, **the Thread is not on them**, and a hit is
  coming at them, they hold it until the hit has landed, 2 s at most. For the frames: such a
  Solo can sit at "now" (full, `soloDueIn` at 0) for up to 2 s longer than the 1 s wait. With the
  Thread on them they fire on time, so the "will be Cued" state never stalls.

Two others were measured and left out (they changed nothing): holding a Solo on a wave's last,
nearly dead enemy, and while the target cannot be hurt.

## 5. A Tempo moved: 15 (30 since section 7)

*18 November 2026, about 08:10 UTC. Commit after `3432e9b` on `p11/solo` ("The Conductor: A Tempo
gives 15...").*

| Entry | Its line | Before the rework | Section 2 said | **Now** |
|---|---|---|---|---|
| A Tempo (Conductor) | "... each Solo you Cue there gives {resonance} Resonance." | a Cue on the downbeat was free | 5 | **15** |

Why: at 5 the Conductor's A Tempo paths were slower than before the rework (59 s a boss fight
where it was 51 s), because the heroes now hold their Solos for the downbeat and the gift was
worth half the free Cue it replaced. At 15 the Skilled bot is back where it was on both paths
measured: 50 s (was 51 s) and 78 s (was 80 s). The text takes the number from the content.

## 6. Final state

*18 November 2026, about 14:00 UTC. Final commit `9b3d702` on `p11/solo`.*

- Nothing in sections 1 to 5 moved again. The wait is 1 s, the tell 3 s, the rule is "on the tick
  it fires", every Resonance number is as section 2 lists it, A Tempo gives 15.
- All of `w3/CONTENT-WORDING.md` is in the content, as written. Two of W3's tests pin those lines
  by hash (`tests/uiPhase5e.test.ts`) and need re-pinning at the join.
- `SOLOS` also holds `lead` (0.5 s) and `danger` (0.3) now: what the Skilled bot uses to follow a
  Solo, for Auto-Thread to share.
- `soloDueIn` is null for a hero whose Solo is full with no one to fight (it used to count the
  wait for them): their frame should show "full" without a countdown until someone is there.
- The hand-off is `/home/user/aw-work/11/solo/w1/HANDOFF.md`.


## 7. Resonance, second round: the meter is 200 and the gains are whole numbers

*18 November 2026, about 17:00 UTC. Replaces section 2. On `p11/solo` from commit `37715f5`.*

The owner chose whole numbers. The economy is the same as section 2's, said the other way round:
instead of halving every gain, the meter is twice as deep. **Fights play exactly as they did in
the tuned state, with every Resonance value doubled**: 936 fights replayed before and after are
identical, and the Resonance gained is exactly twice, to the last digit.

### The meter

| What | Before the rework | Now |
|---|---|---|
| The meter holds | 100, in four segments of 25 | **200, in four segments of 50** |
| A full song (the Crescendo) costs | 100 | **200** |
| Maestro's Grand Finale costs | 75 | **150** |
| A part segment fades at | 4 a second | **8 a second** |
| A Cue costs | 25 (the Conductor's 20) | **nothing** |

### Every gain: as it was before the rework

A Perfect Ward 20, a Save 25, a Clutch Chime 15, a Reel that takes a hero clear 15, answering a
call 10, a Cleanse 5, a Ward that absorbs a hit 5, Empowering 1 a second, a kill by an Empowered
hero 2. Saving Grace 5 / 8 / 10, Vigil Song 1 / 1.5 / 2, Clutch Peal 5 / 8 / 10, Gilt Edge
2 / 3 / 4, Blood and Silk 3 a second, En Garde 8 / 10 / 12, Hawk Eye 1, Tin Whistle 5 (8),
Lament Pin 25 (35), Red Ink 10 (15), Knotted Cord 10, Penitence 4 for every 100, Eternal Moment
10, the Astrolabe's Ringing Parry and Ready Answer 2.5 each, the Reliquary's Ringing and
Attentive as rolled. None of these needs a text change from before the rework.

### What changed its meaning with the Cue, in today's numbers

| Entry | Its line now | The number |
|---|---|---|
| Opening Bars | "The first Solo Cued in each fight gives {v} Resonance." | **10 / 15 / 25** |
| Tempo Rubato | "One Cue in every {v} gives half a segment of Resonance." | every 3rd; **half a segment is 25** |
| Answering Phrase | "A Solo Cued within 4 s of another gives {v} Resonance." | **3 / 5 / 7** |
| A Tempo | "Your heroes begin their Solos on the downbeat. Each one you Cue gives {resonance} Resonance. The strip under your Resonance shows the beat." | **30** |
| Silent Cues | "A Solo is Cued only if your Thread was on the hero for {seconds} s." | **0.5 s** (it was 1 s) |
| Hollow Crown | "Every Solo plays in its Cued form, wherever your Thread is. Only one your Thread is on counts as a Cue." | curse unchanged (25%) |
| The Maestro Deed | "Have {n} Solos Cued in one run." | **75** (it was 25) |

### What is a share of the meter: doubled with it

| Entry | Its line | Was | Now |
|---|---|---|---|
| Cantor's Hymnal (relic) | "Start every fight with {resonance} Resonance." | 50 (Empowered 75) | **100 (150)** |
| Upbeat (Conductor) | "Every fight begins with {resonance} Resonance." | 50 | **100** |
| Deep Well (Reliquary) | "Start every fight with {a} Resonance" | 12 | **24** |
| Da Capo (motif) | "When the Crescendo ends, you keep {v} Resonance." | 25 | **50** |
| Prompt Book (relic) | "Your first Crescendo in each fight costs {cost} less Resonance." | 15 (20) | **30 (40)** |
| Fortissimo Silence's decree with no dome | "... keep 200 Resonance and cancel it with your Crescendo ..." | 100 | **200** (the one line with the number written in) |

Percentages (Standing Ovation, the Conductor's "more Resonance") are unchanged.

### For code that draws the meter

`CONTENT.resonance.max` is 200, `.segment` 50, `.crescendoCost` 200; `gainScale` is 1. Anything
that writes 100, 75, 50 or 25 for a Resonance amount instead of reading the content is now half
of what it means. On the joined branch (`8ffd087`) the labs already read the content; three
places still hold a literal and want a look: `src/audio/lab/offline.ts` lines 161, 391 and 443
to 445 (Resonance 50 and 100), and `src/render/feedback.ts` line 4045
(`CONTENT.resonance.max / 50`).

## 8. Second round: what else the screens should know

*18 November 2026, about 17:00 UTC. Commit `d8e63ed`.*

- **No plain Solo roots its hero.** Lyra's Gale Barrage and Hawk's Vigil and Vexis's plain
  Starfall no longer pin the hero. Only a **Cued Starfall** still roots Vexis. Their lines:
  Gale Barrage "Lyra looses twelve arrows a second for three seconds." / "Cued: her arrows hit a
  third harder and crit 40% more often."; Hawk's Vigil "For {seconds} s, Lyra shoots every enemy
  that starts an attack within her range, once each, as hard as {power} of her arrows. A cast she
  can interrupt is interrupted." / "Cued: each shot marks its target to take {pct}% more damage
  for {mark} s."
- **Section 4's second rule is gone** (the rooting Solo that waited out a hit): nothing is left
  for it to guard. A Solo no longer sits at "now" for that reason.
- **A hero finishes what they are casting first.** A Solo that is due while its hero is mid-cast
  (a Flourish, any ability) begins when the cast ends: up to a second or so at "now".
- **`soloDueIn` is null for a hero who cannot fire**: stunned, staggered, asleep, stilled,
  possessed, being Reeled; full with no one to fight; Oro with nobody in the party fighting. No
  caller needs its own check. Oro's wait now runs whenever the party fights.
- **`soloQueue(state)`** (new, exported from `src/sim`): the Solos coming, in firing order, each
  `{ hero, slot, due, cued }`, with heroes waiting on the one-second gap spaced a gap apart (a
  bar apart with A Tempo). For the frames, so two heroes never show the same seconds. A view
  only.
- **`threadOn(state, hero)`** (new): the Thread is on the hero and has been for Silent Cues'
  hold: this Solo would be a **Cue**. `threadCues` still says "would play in its Cued form",
  which under Hollow Crown is every Solo. Use `threadOn` for anything that promises a Duet, A
  Tempo's gift or a Cue's effects; `threadCues` for how the Solo will look.
- **`state.ledger.plainSolos`** (new): Solos fired in the plain form this fight. With
  `ledger.cues` the Result can say "7 of 9 Solos Cued". The run layer does not copy it into a
  fight's saved stats yet (`src/meta/run.ts` copies `cues`): that is the join's.
- **Kael's dome on demand** (section 4, first rule) is unchanged.

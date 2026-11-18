# DOC-TABLES: the second round's numbers for `docs/solos.md` and three phase docs

*18 November 2026. Measured again on `p11/solo` at `8e7f950` (the final rules), after 21:00 UTC.
Line numbers are those of `docs/solos.md` on `p11/solo-join` at `130c027`; each item also quotes
how the line it replaces begins, so it can be found if the lines have moved. Paste each block in
place of the line or lines named. Nothing else in the doc holds a first-round figure.*

Where the numbers come from: `/home/user/aw-work/11/solo/w1/data/` (`final.jsonl`, 5,200 fights;
`hands-final.jsonl`; `novice-follow0.txt`; `m3-two.txt`; `runs-2-150.txt`; `runs-4-80.txt`).
"Before" (main before the rework) is the first round's, as the brief says: main's fights have not
changed. The figures the second round had already put in the doc (the Frayed Threshold 94%, the
Seamstress 91%, the Novice's 45% Cued, a never-following player's 35%) came out the same.

---

## 1. "For hands": the italic note under the heading

**Replaces line 54** (begins `*Measured on the first tuned rules; the wait, the gap and the rule`):

```
*Measured on the final rules.*
```

## 2. "For hands": the paragraph before the table

**Replaces line 56** (begins `The bots move the Thread within one tick. A person does not.`). Only
its last sentence changes (84 fights became 140):

```
The bots move the Thread within one tick. A person does not. So tuning built a stand-in for a person's hands (`tools/person.ts`, played by `tools/solo-study.ts`): the Skilled bot's play, but the Thread goes to a Solo 350 ms after it is noticed, stays until the Solo fires, misses one Solo in six altogether, and never leaves a hero under 30% of their life. 140 boss and mini-boss fights each, no Calling:
```

## 3. "For hands": the table

**Replaces lines 58 to 66** (the table that begins `| Who | Solos Cued | Win | Seconds | Heroes downed |`):

```
| Who | Solos Cued | Win | Seconds | Heroes downed |
|---|---|---|---|---|
| The Skilled bot | 92% | 97% | 129 | 0.69 |
| Person, goes when the tell appears | 81% | 96% | 137 | 1.06 |
| Person, goes only when the Solo is full | 85% | 99% | 131 | 0.71 |
| The same, hands at 600 ms | 86% | 98% | 131 | 0.69 |
| The same, hands at 800 ms | 84% | 96% | 128 | 0.68 |
| The same, hands at 1 s | 63% | 96% | 134 | 0.76 |
| A player who never follows a Solo | 35% | 92% | 136 | 0.88 |
```

## 4. "For hands": the bullets under the table

**Replaces lines 70 to 74** (from `- **The moment to move is when the Solo is full**` to `- A player
who never moves the Thread for a Solo still has a third of them Cued`). Line 68 ("The target was
70%...") stays as it is.

```
- **The moment to move is when the Solo is full**, not when its tell first shows. The person who goes at the first sign keeps the Thread there for up to 4 s and pays for it: fights take 5% longer and one more hero in three goes down.
- **The wait is a hard edge.** Hands as slow as 800 ms still make it. At 1 s a third of the Solos are missed. (That is fewer than on the first rules, where 1 s hands got 52%: a hero now finishes a cast before the Solo, which sometimes gives slow hands a little longer.)
- **Kael is the hardest to Cue** (73 to 82%, against 83 to 89% for Lyra and Vexis), because he raises his wall at once when he is hurt, with no wait to react in. His frame shows no countdown for that reason.
- Other waits measured no better: 0.75 s and 1.5 s give the same share Cued (85% and 84%) and the same fights.
- A player who never moves the Thread for a Solo still has a third of them Cued, on whoever the Thread is on, and still wins 92% of boss fights, seven seconds slower than the Skilled bot. The one fight where following plainly matters is the Seamstress: such a player wins it 65% of the time (13 of 20), against 95% for the Skilled bot and for the person who goes when the Solo is full.
```

## 5. Why the meter is twice as deep: the Conductor's boss-fight length

**Replaces line 156** (begins `Why the meter is twice as deep and not the same depth:`). Only "94 s"
becomes "93 s"; the rest is unchanged and still true (a full song 0.74 times a boss fight with no
Calling, 1.3 on the Conductor's first path):

```
Why the meter is twice as deep and not the same depth: with no Calling the size of the economy hardly matters to a fight. With the Conductor, whose Crescendo is his best thing, this size puts his boss fights back on their old length (93 s against 96 s). A full song now comes about once a boss fight. It was once in two or three, when most Resonance went on Cues.
```

## 6. The Conductor: A Tempo's two paths

**Replaces line 164** (begins `With A Tempo the heroes hold a ready Solo for the next downbeat`).
The first round quoted two A Tempo paths, 50 s and 78 s. The final study measures one A Tempo path
(A Tempo, Upbeat, Spotlight, Maestro): 50 s, against 51 s before. The 78 s path was not measured
again and its exact choices are not on record, so it is taken out rather than left stale:

```
With A Tempo the heroes hold a ready Solo for the next downbeat, so Solos come a bar apart (2.7 s). The beat strip shows when the next one begins and whose it is. A Tempo gives 30 Resonance for each Solo Cued on the beat, of a meter of 200. At a third of that his A Tempo paths were slower than before the rework (59 s a boss fight against 51 s), because the heroes now hold their Solos for the downbeat. At 30 they are back: on A Tempo, Upbeat, Spotlight and Maestro the Skilled bot's boss fights take 50 s, against 51 s before, and 3.3 Solos a boss fight are Cued on the beat. The Conductor gains 10% more Resonance, so the card says 30 and the meter gains 33.
```

## 7. "What it does to the numbers": the opening, and the note that the tables are old

**Replaces lines 176 to 178** (line 176 begins `The study's 13 fights across the four
Movements, 20 seeds`; line 178 begins `**These tables are from the first tuned rules.**`; line 177
is the blank line between them):

```
The study's 13 fights across the four Movements, 20 seeds: 140 boss and mini-boss fights in each row. "Before" is main, measured with the same fights and seeds. "Now" is the final rules, measured after the second round.
```

## 8. The Skilled bot's table

**Replaces lines 180 to 189** (from `**Boss and mini-boss fights, the Skilled bot: held.**` to the row
`| Conductor: A Tempo, Upbeat, Spotlight, Maestro | 100% / 51 / 0.10 | 100% / 50 / 0.08 |`):

```
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
```

## 9. The sentence after the Skilled bot's table

**Line 191 stays as it is** (`The Skilled bot's fights are where they were. The player who never
touched the Cue key...`). It holds no first-round figure.

## 10. The Novice: the paragraph, her results, her bands

**Replaces lines 193 to 205** (from `**The Novice wins more, and two things make that so.**` to `The
Skilled bot's bands did not move.`). The first round's story is kept in one sentence; the table of
her results is new, and the band table now shows the bands in force (set in `08d69db`):

```
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
```

Note for the join: the band table gains a row (Movement III elites), because that band moved too:
her result there is 33% over 40 fights, near the bottom of the old 30-65% band, so the band was
centred on it.

## 11. Whole runs

**Replaces line 207** (begins `**Whole runs**, as the baselines play them, after the first round.`):

```
**Whole runs**, as the baselines play them. Two-Movement Expeditions, 150 seeds: the Skilled bot wins 76% (73% before), the Novice 31% (13%). The Finale route, 80 seeds: Skilled 73% (65%), Novice 1% (1%).
```

## 12. The two Movement III fights

**Replaces lines 209 to 214** (from `**Two fights lost ground in the first round, and the second round
mended both.**` to the Seamstress row). The figures are unchanged; only "After the second" becomes
"Now", and the Novice's column is added:

```
**Two fights lost ground in the first round, and the second round mended both.** Both have enemies that cut the Thread, so the bot keeps the Thread off Lyra, so her Gale Barrage fired plain, and plain it rooted her to the spot, where she was killed. No plain Solo roots now. 150 fights each:

| Fight | Before | After the first round | Now | Its band | The Novice now (her band) |
|---|---|---|---|---|---|
| The Frayed Threshold (Movement III, first skirmish) | 93% | 85 to 88% | 94% | 85% or more | 56% (45% or more) |
| The Seamstress (Movement III, mini-boss) | 94% | 89% | 91% | 90% or more | 59% (45-75%) |

The Silent Conductor's fight is a little quicker than its band for the Skilled bot in the study: 167 s (the band is 170 to 230 s; it was 175 s before the rework).
```

## 13. Not measured again (the lines stay; the join may want to say so)

- **Line 152**, the Maestro Deed: "about 45 Cued on the longest route, one who does about 110". From
  the second round's rules (`run-cues.mts`), not the first's; not measured again here.
- **Line 162**, the chain: "only 0 to 3% of Duets and Trios have a plain Solo inside them". From the
  first round; not measured again. The chain rule did not change since.
- **Line 216**, Vexis's cast hold (4 Solos of 10, a second on average): the join step's own
  measurement on the final rules; not touched.
- **Line 7**, "their boss fights took 70% longer": main before the rework; stands.

---

## The phase docs: the Novice's bands

Each of the three notes quotes the first round's bands. The second round set them again
(`08d69db`). Replace the whole note (one line each, at `130c027`).

### `docs/phase-5a.md`, line 501

Replaces the line that begins `> **Since the Solo rework (2026-11-18, [docs/solos.md](solos.md)).**
The Novice's bands were set again: her heroes use their Solos now`:

```
> **Since the Solo rework (2026-11-18, [docs/solos.md](solos.md)).** The Novice's bands were set again: her heroes use their Solos now, so she wins more, and the fights were left as they are. Movement II elites 65-95% (were 35-75%), the Gorehound Matriarch 75% or more (40-70%), Vharun 55-85% (35-65%). The skirmish floor is as it was. The Skilled bot's bands are as below. `tools/harness.ts` prints the bands in force.
```

### `docs/phase-5c.md`, line 822

Replaces the line that begins `> **Since the Solo rework (2026-11-18, [docs/solos.md](solos.md)).**
The Novice's bands were set again. Movement III skirmishes`:

```
> **Since the Solo rework (2026-11-18, [docs/solos.md](solos.md)).** The Novice's bands were set again. Movement III skirmishes 45% or more (were 55% or more: the Frayed Threshold got harder for her, 56% over 150 fights), the elites 20-50% (30-65%), the Seamstress 45-75% (30-60%), the Unweaver 60-90% (25-55%). The Skilled bot's bands are as below. `tools/harness.ts` prints the bands in force.
```

### `docs/phase-5d.md`, line 778

Replaces the line that begins `> **Since the Solo rework (2026-11-18, [docs/solos.md](solos.md)).**
The Novice's band at the Silent Conductor was set again`:

```
> **Since the Solo rework (2026-11-18, [docs/solos.md](solos.md)).** The Novice's band at the Silent Conductor was set again: 20-50% (was 15-40%). Her heroes use their Solos now. The Skilled bot's bands are as below, and the whole-run bands were not re-set. `tools/harness.ts` prints the bands in force.
```

Checked and needing nothing: `docs/phase-4d.md` line 5 and `docs/phase-5f.md` line 9 (their
"Since the Solo rework" notes quote no band or result), `docs/phase-5g.md` line 397.

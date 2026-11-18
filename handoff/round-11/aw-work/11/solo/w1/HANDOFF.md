# Solos, step W1 (tools, the "person" follower, tuning, baselines): hand-off, second round

*18 November 2026 (numbers measured again at 21:00 UTC on `8e7f950`) · branch `p11/solo` in `/home/user/aw-work/wt-p11solo` · the numbers the
screens state are in `/home/user/aw-work/11/solo/w1/NUMBERS.md` (sections 7 and 8 are the
current ones) · the first round's hand-off is kept beside this as `HANDOFF-round1.md`.*

## 1. Where it stands

**Done, on `p11/solo` at `8e7f950`. The rules are final; this step changed nothing in them.**

- **The numbers below were measured again on `8e7f950`, on 18 November 2026 after 21:00 UTC.**
  The first measurements were lost with the old container, so the whole study was run again:
  5,200 fights (`final.jsonl`), plus the extra hands rows, the Novice with her following off, the
  two Movement III fights at 150 fights each and the whole runs. Every figure that the draft of
  this hand-off already quoted (the Skilled bot 97% / 129 s, a never-following player 92% /
  136 s, the Novice 67% / 164 s with 45% Cued, 71% with her following off, the Seamstress 91%,
  the Frayed Threshold 94%) came out the same to the last digit, as a deterministic sim should.
- **What is verified, and on which commit.**
  - `bc46e3f` (the second re-record): typecheck and lint clean, and the test run over this step's
    files passed (2,734 tests) except two aura presentation-pin tests (recorded in `08d69db`'s
    message).
  - `08d69db` (the Novice's bands): changes only `tools/harness.ts`'s bands and the three band
    literals in `tests/harnessTools.test.ts`; no recorded result.
  - `8e7f950` (the aura pin fixture fills the 200-deep meter): `tests/aura` passes, 5 passed and
    1 skipped (the writer); the pin file itself is untouched.
  - **Not verified on `8e7f950` by this step:** the whole unit suite, typecheck and lint on that
    exact commit, `npm run build` and the browser tests. They are the join's (`p11/solo-join`),
    which runs them on the joined tree.
- **Nothing was committed in this step.** Measurement and writing only.

## 2. What the second round changed, in plain words

**The three decisions**

1. **Whole numbers: the meter is twice as deep and every gain is what it always was.** Resonance
   holds 200 in four segments of 50. A full song costs 200 (Maestro's Grand Finale 150). A
   Perfect Ward gives 20, a Save 25, and so on, exactly as before the rework. What is a share of
   the meter doubled with it: "start with" amounts (100, 150, the Reliquary's 24), Da Capo's keep
   (50), Prompt Book's cut (30, 40). A Tempo gives 30. **No fight plays differently**: 936 fights
   replayed before and after are identical in outcome, length, heroes downed, Solos and
   Crescendos, and the Resonance gained is exactly twice, with a difference of 0 to the last
   digit. The Reliquary's rolled affixes keep their saved values and are worth what they were
   before the rework, so that question is closed without a migration.
   - **Saves:** nothing in a run save, a profile or a replay holds a Resonance amount (the run
     carries none between fights), so nothing is lost and nothing is migrated. A fight's recap
     keeps one Resonance figure (what A Tempo gave); an old result shows its old figure.
2. **No plain Solo roots its hero.** Lyra's Gale Barrage and Hawk's Vigil and Vexis's plain
   Starfall no longer pin the hero who fires them with the Thread elsewhere. Only a Cued Starfall
   still roots Vexis. Measured each way on the 13 fights, on the two Movement III fights and on a
   Hawk's Vigil party: taking the roots off costs nothing anywhere, and the Frayed Threshold goes
   from 87% back to 94 to 97% for the Skilled bot (it was 93% before the rework). Lyra's two
   Solos are reworded to match (her Cued Gale Barrage now reads "her arrows hit a third harder
   and crit 40% more often", which is what the numbers always were).
   - **The rootHold judgement is gone.** It existed to keep a rooting plain Solo out of a hit;
     with no plain Solo rooting, it had nothing left to do.
   - **The Seamstress is back inside her band** without any work of her own: 91% over 150 fights
     (it was 94% before the rework and 89% after the first round; her band is 90% or more).
3. **The two additions for the screens.** The fight counts its plain Solos
   (`ledger.plainSolos`), and `soloQueue(state)` gives the Solos that are coming in firing order,
   a gap apart, so two heroes never show the same seconds. It is a view only: neither the sim nor
   the bots read it.

**What the review found (`/home/user/aw-work/11/solo/review/REVIEW.md`), finding by finding**

| Review's finding | What was done |
|---|---|
| 1. Oro's full Solo sat unfired with no Sapling fighting | **Fixed.** His wait runs whenever the party fights (a Sapling or another hero has someone to fight). `soloDueIn` is null when it is not running. Two tests. |
| 2. `soloDueIn` promised a Solo from heroes who cannot fire | **Fixed.** It is null for a hero who is stunned, staggered, asleep, stilled, possessed or being Reeled, and for a full Solo with no one to fight. The bots' wall rule lost its stale target check (`src/bots/common.ts`). The join can delete the callers' own copies. |
| 3. A Solo cancelled its hero's own cast, Flourishes included | **Fixed, for any cast.** A hero finishes what they are casting before their Solo begins. Measured three ways (no hold, Flourishes only, any cast): holding for any cast costs nothing (Skilled 94% / 128 s against 94% / 132 s) and no Solo cuts a cast any more (it was 17.5% of Solos, 4.5% of them Flourishes). Kael's urgent wall still goes up at once. |
| 4. The Conductor's badge promises a Duet the Solo will not be | Not W1's (the HUD). `soloQueue` and `threadOn` give it what it needs. |
| 5. The Novice followed Solos with one-tick hands | **Fixed.** She has a beginner's hands now (below), and her bands are set from that. |
| 6. Silent Cues: the hold equalled the wait | **Fixed.** The hold is **half a second**, half the wait, so a Thread sent as the Solo fills, or a third of a second after, is in time. Re-measured (section 3). |
| 7. Hollow Crown gave the Conductor's Duets and Trios for nothing | **Fixed, and a little further than asked.** The Crown gives every Solo its Cued form and nothing else: only a Solo the Thread is on is a Cue. So the chain, A Tempo's gift and the Maestro Deed need the Thread, as asked, and so does every other "when a Solo is Cued" (Opening Bars, Canon, the chorus pulse, Footlights and the rest). One rule instead of a list of exceptions; say if the owner wants the wider effects back. The relic's line says so. |
| 7b. The Maestro Deed came to a player who never follows a Solo | **Raised from 25 to 75**, measured (section 3). |
| 8. Auto-Thread's two small ones | Not W1's (input). |
| 9. Kael raised his wall with nobody to fight | **Fixed.** Hurt, he raises it only with someone to fight. A big hit coming at him still raises it. |
| 10. Kael one tick late (a float comparison) | **Fixed.** |
| `wasted` looked only at `health.incoming` | **Moot:** the judgement is gone with the roots. A Cued Starfall still roots Vexis into whatever comes; that is as it was before the rework. |
| The dead `cueCost` stat key | **Removed.** |
| `tests/harnessTools.test.ts:1810` could not fail | **Fixed:** it compares the tally with the fight's own count. |
| `tests/fill/pre5g/golden.json` said `simVersion` 22 with 32 hashes nothing reads | **Fixed:** the file keeps only the one value the test reads. The test's header now says plainly that the frozen copies pin the masked content from here on, not a tree from before the fill. |
| Content lines that still said "Cue" as a key | **Reworded:** Footlights, Ensemble, Constellation, the Maestro Deed (NUMBERS.md section 7). The four UI text lines the review names are the join's. |
| The "dome" coach hint keeps its own copy of the rule | Not W1's. `partyHitWithin` is in `src/sim/combat/telegraphs.ts` if the hint wants the sim's own answer; it is not exported from `src/sim` yet. |

**The Novice's hands.** She sees a Solo only once it is full. She goes in its last half second.
She decides once for each Solo whether to go at all (4 in 10; a little more with a Conductor's
chain open, A Tempo's beat, or the last burn). She never goes while a hero is under 30% of their
life, and she does not sit on Kael while he holds his wall. She gets **45% of boss-fight Solos
Cued** (it was 60%; a player who never follows gets 35%; the person model 81 to 85%).

## 3. Numbers

All from bots and the stand-in for hands, on `8e7f950`, measured again on 18 November 2026.
"Before" is main before the rework: its fights have not changed since the first round, so the
first round's "before" figures stand (they were measured with the same fights and seeds). The
study's 13 fights, 20 seeds: 140 boss and mini-boss fights and 120 skirmishes in each row. Data in
`/home/user/aw-work/11/solo/w1/data/`.

**Boss and mini-boss fights, the Skilled bot: held.** Win / seconds (won fights) / heroes downed.

| Calling | Before | After the first round | **Now** |
|---|---|---|---|
| None | 96% / 133 / 0.90 | 94% / 132 / 0.71 | **97% / 129 / 0.69** |
| Luminary | 99% / 124 / 0.75 | 98% / 118 / 0.61 | **96% / 117 / 0.68** |
| Martyr | 96% / 135 / 0.87 | 99% / 133 / 0.72 | **95% / 132 / 0.76** |
| Chronomancer | 99% / 132 / 0.66 | 99% / 128 / 0.66 | **99% / 128 / 0.62** |
| Conductor: Marcato, Reprise, Ensemble, Triad (path A) | 99% / 96 / 0.42 | 98% / 93 / 0.36 | **96% / 93 / 0.44** |
| Conductor: A Tempo, Upbeat, Spotlight, Maestro (path B) | 100% / 51 / 0.10 | 100% / 50 / 0.08 | **100% / 50 / 0.06** |
| Silent Cues (the Dissonance), no Calling | not measured | not measured | **96% / 129 / 0.72** |

Luminary, Martyr and the Conductor's path A are 1 to 3 points under "before"; at 140 fights a
row that is one to two standard errors, and every one is far inside the Skilled bot's band. The
one cell under 90%: Martyr at the Hollow Cantor, 85% (17 of 20).

Skirmishes, no Calling: 100% in 41 s (was 100% in 44 s). A full song is sung 0.74 times a boss
fight with no Calling (0.44 before). The Conductor's chains, a boss fight: path A 2.3 Duets and
1.0 Trios (2.8 and 1.0 before); path B 1.3 Duets, 0.7 Trios and 3.3 Solos Cued on the beat.
Solos Cued, Skilled bot: 92% with no Calling, 91% path A, 94% path B, 89% under Silent Cues.

**The same fights, the Novice: she wins more almost everywhere, as decided.**

| Calling | Before | After the first round | **Now** | Solos Cued now |
|---|---|---|---|---|
| None | 46% | 75% | **67%** (164 s, 3.3 downed) | 45% |
| Luminary | 66% | 72% | **74%** | 43% |
| Martyr | 49% | 64% | **65%** | 42% |
| Chronomancer | 61% | 74% | **74%** | 43% |
| Conductor, path A | 71% | 82% | **81%** | 48% |
| Conductor, path B | 87% | 92% | **90%** | 64% |
| Silent Cues, no Calling | not measured | not measured | **68%** | 25% |

With her following switched off altogether she wins **71%** of boss fights (178 s, 24% of Solos
Cued, which is where the Thread already was). Her following, with a beginner's hands, gets 45%
Cued instead of 24% and makes her fights 14 seconds shorter (164 s against 178 s); the 4-point
difference in wins is noise at 140 fights. So her gain over "before" is the heroes firing their
own Solos, not her following. Her bands (set in `08d69db` from 40 fights a cell): Movement II
elite 65-95%, mini-boss 75% or more, boss 55-85%; Movement III skirmish 45% or more, elite
20-50%, mini-boss 45-75%, boss 60-90%; the Finale's boss 20-50%.

**Hands** (no Calling, boss and mini-boss fights):

| Who | Solos Cued | Win / seconds / downed |
|---|---|---|
| The Skilled bot | 92% | 97% / 129 / 0.69 |
| Person, goes when the tell appears | 81% | 96% / 137 / 1.06 |
| Person, goes when the Solo is full | 85% | 99% / 131 / 0.71 |
| The same, hands at 600 ms | 86% | 98% / 131 / 0.69 |
| The same, hands at 800 ms | 84% | 96% / 128 / 0.68 |
| The same, hands at 1 s | 63% | 96% / 134 / 0.76 |
| A player who never follows a Solo | 35% | 92% / 136 / 0.88 |

By hero (Kael, Lyra, Vexis): the Skilled bot 90 / 93 / 93%; the person going at the tell 73 /
86 / 84%; the person going when full 82 / 89 / 83%; the never-following player 24 / 63 / 14%
(the Thread rests mostly on Lyra). Under Silent Cues the person going when full gets 82%. The
wait measured at 0.75 s and 1.5 s for the person going when full: 85% and 84% Cued, 96% and 98%
won: no better than 1 s. Before the rework a player who never pressed the Cue key fought boss
fights of 226 s and their heroes used no Solo.

**Whole runs** (as the baselines play them; `runs-rate.mts`, the full counts, nothing cut):

| | Before | After the first round | **Now** |
|---|---|---|---|
| Two Movements, 150 runs: Skilled / Novice wins | 73% / 13% | 71% / 22% | **76% / 31%** |
| The Finale route, 80 runs: Skilled / Novice wins | 65% / 1% | 61% / 5% | **73% / 1%** |

**The two Movement III fights where the Skilled bot lost ground in the first round** (harness,
150 fights each, both with enemies that cut the Thread): both are back in band.

| Fight | Before | After the first round | **Now** | Its band | The Novice now |
|---|---|---|---|---|---|
| The Frayed Threshold (Movement III, first skirmish) | 93% | 85 to 88% | **94%** (43 s) | 85% or more | 56% (band 45% or more) |
| The Seamstress (Movement III, mini-boss) | 94% | 89% | **91%** (77 s) | 90% or more | 59% (band 45-75%) |

**Out of band or worth a look:**
- The Silent Conductor's fight is a little quicker than its band for the Skilled bot in the study:
  167 s (band 170 to 230 s; it was 175 s before the rework). 20 fights, the study's kit, not the
  harness's 50-fight cells.
- A never-following player wins the Seamstress 65% (13 of 20), against 95% for the Skilled bot
  and the person: the one fight where following plainly matters.

Data: `/home/user/aw-work/11/solo/w1/data/` (`final.jsonl`, `hands-final.jsonl`,
`novice-follow0.txt`, `m3-two.txt`, `runs-2-150.txt`, `runs-4-80.txt`). Read a study file with
`npx tsx tools/solo-study.ts --report <file> --by kind`.

## 4. For the owner to decide

1. **Hollow Crown.** It now gives every Solo its Cued form, and only Solos the Thread is on count
   as Cues for anything. Asked for: the chain, A Tempo and the Deed. Done as well: Opening Bars,
   Canon, the chorus pulse and every other "when a Solo is Cued". If the owner would rather the
   Crown kept those, it is a small change back.
2. **Whether the plain and Cued forms should differ more for Lyra and Vexis** now that the root is
   not the difference. Lyra's Cued Gale Barrage hits a third harder and crits 40% more; Hawk's
   Vigil Cued marks its targets; Starfall Cued stuns and falls in your field (and still roots
   him). Nothing here is broken; it is a design question for later.
3. **A never-following player loses little.** With no plain Solo rooting, a Weaver who never
   follows a Solo wins 92% of boss fights against the Skilled bot's 97%, seven seconds slower
   (136 s against 129 s) with a few more heroes downed. Following is worth having, not
   required. If the owner wants the Cue to matter more, the lever is the Cued forms' strength,
   not a penalty on the plain ones.

## 5. What each other step needs to know (the join)

- **`NUMBERS.md` sections 7 and 8** are the list of what the screens state and the new things the
  sim offers (`soloQueue`, `threadOn`, `ledger.plainSolos`, `soloDueIn`'s nulls).
- **One line in a file that is not W1's:** `src/ui/lab/mock.ts`, the mock ledger, gained
  `plainSolos: 0` (the tally is a required field, and the lab builds one by hand). It is a
  one-line addition after `cues:`.
- **`soloDueIn` callers** (`hudBridge.ts`, `soloMark.ts`, `InputController.ts` `autoSoloTarget`,
  `src/ui/hud/conducting.ts` `nextSolo`) can drop their own "stilled or possessed" checks: it is
  null for every hero who cannot fire.
- **`threadCues` or `threadOn`:** anything that promises a Cue's effects (a Duet badge, A Tempo's
  gift, "will be a Cue") should read `threadOn`; `threadCues` says only that the Solo will play
  in its Cued form (always, under Hollow Crown).
- **The run layer** (`src/meta/run.ts`) copies `cues` into a fight's saved stats; it does not copy
  `plainSolos` yet. The Result's "7 of 9 Solos Cued" needs that copy (and the save's schema).
- **Literal meter values.** `CONTENT.resonance.max` is 200. On the joined branch at `8ffd087` the
  labs already read the content; `src/audio/lab/offline.ts` (lines 161, 391, 443 to 445) and
  `src/render/feedback.ts` line 4045 still hold a literal 50 or 100 and want a look.
- **`tests/meta/roster5e.test.ts` lines 629 and 635** still pin the recap line W2 reworded
  (unchanged from the first round's hand-off).
- **`tools/release-check.ts`:** the content's version is now `c-7781374df5775748` (`contentVersion` in `tests/sim/golden.json`).
- **Fight-derived sound and picture snapshots** follow these goldens (the second set); they were
  not re-recorded here.
- **For `docs/solos.md`** (the join's file), the sentence about the Novice, with its numbers:
  "The Novice wins 67% of boss fights where she won 46%. That gain comes from the heroes firing
  their own Solos, not from her: with her following switched off altogether she wins 71% (the
  difference is noise). Her following, with a beginner's hands, gets 45% of Solos Cued instead of
  24%, and makes her fights 14 seconds shorter (164 s against 178 s)."
  Also for the doc: the meter (200), the roots, the cast rule, Oro, Silent Cues' half second,
  Hollow Crown's rule, the Maestro Deed's 75, and that the rootHold judgement was built and then
  removed.

## 6. Recorded results re-recorded, and why

Everything was recorded again, once, at the end of this round, because the second round's rules
change how fights play (a hero finishes a cast first; no plain Solo roots; Oro's wait; Kael's
wall; Silent Cues; Hollow Crown; the Novice's hands) and the fight's state gained a count and a
meter twice as deep, which every hash holds.

| What | File | Command |
|---|---|---|
| All 52 baselines | `tools/m1-baseline*.json` to `m4-baseline*.json`, `tools/expedition*-baseline*.json` | `/home/user/aw-work/11/solo/w1/baselines.sh` |
| The goldens | `tests/sim/golden.json`, and its hashes in `tests/sim/m1Unchanged.test.ts` | `npx tsx tools/update-golden.ts --write`, then `npx tsx tools/sync-golden-pins.ts` |
| The Dissonance pins | `tests/sim/dissonancePins.json` | `rm tests/sim/dissonancePins.json && npx tsx tests/sim/recordDissonancePins.ts` |
| The bots' commands | `tests/bots/commandSnapshot*.json` (four files) | `WRITE_COMMAND_SNAPSHOT=1` (and `_M3`, `_FINALE`, `_ROSTER`) with the test of the same name |
| The fill-inert pin | `tests/bots/fillInert.json` | `WRITE_FILL_INERT=1 npx vitest run tests/bots/fillInert.test.ts`, then `npx prettier --write` on it |
| The Prelude snapshot | `tests/meta/__snapshots__/prelude.json` | `WRITE_PRELUDE_SNAPSHOT=1 npx vitest run tests/meta/preludeSnapshot.test.ts` |
| Three key lists | `tests/sim/telegraphKeys.json`, `damageResultKeys.json`, `summonInert.json` | `WRITE_TELEGRAPH_KEYS=1`, `WRITE_DAMAGE_RESULT_KEYS=1`, `WRITE_SUMMON_INERT=1` with their tests |
| The frozen "before the fill" copies | `tests/fill/pre5g/*.json` | `AW_REFREEZE_PRE5G=1 npx vitest run tests/fill/masked.test.ts --testTimeout=900000` |
| What today's build loads from each old save | `tests/fixtures/saves/expected.json` | `npx tsx tools/save-fixtures.ts --expect` |
| "Without you" numbers | literals in `tests/withoutYouRise.test.ts` | by hand |

`/home/user/aw-work/11/solo/w1/rerecord.sh` runs rows 2 to 9 in order.

**Nothing was recorded again after `bc46e3f`.** `08d69db` set the Novice's bands (text in the
harness, not a recorded result) and `8e7f950` changed the aura pin's scripted fight, not the pin:
its Crescendo was set to 100 Resonance, which since the meter became 200 deep is half a meter, so
the Crescendo was refused; it now fills the meter to `CONTENT.resonance.max`, and every entry of
`tests/aura/presentationPin.json` is what it was. Neither of the two aura pins was re-recorded.
The fight-derived sound and picture snapshots follow these goldens and are the join's to
re-record (compared first).

## 7. Tests

- **On `bc46e3f`**, the run over this step's files
  (`npx vitest run tests/sim tests/bots tests/bots.test.ts tests/fill tests/content
  tests/content.test.ts tests/meta tests/harnessTools.test.ts tests/weeklyBotParity.test.ts
  tests/withoutYouRise.test.ts tests/demo.test.ts tests/demoChoice.test.ts tests/aura
  --maxWorkers=2 --testTimeout=900000`): 2,734 tests, all passed except two, both in the aura presentation
  pin, whose scripted Crescendo no longer fired on a 200-deep meter. Typecheck and lint clean.
- **On `8e7f950`**, `npx vitest run tests/aura`: 5 passed, 1 skipped (the writer). That fixes the
  two failures above; nothing else changed between the two runs except the bands (`08d69db`,
  whose three literals in `tests/harnessTools.test.ts` were changed with them).
- **Not run by this step:** the whole unit suite on `p11/solo` alone. The first round's whole
  suite (`9b3d702`) had 31 failures, none in this step's files; on the joined tree that is the
  join's `/home/user/aw-work/6/full-suite.sh` run, where the 11 fight-derived sound snapshots are
  expected red until re-recorded.
- **Known at the join:** `tests/meta/roster5e.test.ts` lines 629 and 635 (a recap line W2
  reworded); `tests/uiPhase5e.test.ts`'s pins of the content lines; the mock ledger's
  `plainSolos` line (section 5).

## 8. Not done, not checked

- **Nobody has played it.** The person follower is a model of hands.
- **The browser tests and `npm run build` were not run.**
- **The docs were not touched** (the join's); section 5 has what `docs/solos.md` needs.
- **Fight-derived sound and picture snapshots and `RELEASE_PINS`:** not re-recorded, by the plan.
- **The Conductor's Duet badge, Auto-Thread's two small ones, the dome hint's own copy of the
  rule, the screen reader's live text** (review findings 4 and 8 and three of its read-only
  notes): not W1's files.
- **Whole-number rounding** is no longer a question: every gain is a whole number again, except
  the ones that always had a half (Vigil Song 1.5, the Astrolabe's 2.5).
- **A Cued Starfall still roots Vexis**, into a hit, a pull or a zone if one comes. That is as it
  was before the rework and was left alone.

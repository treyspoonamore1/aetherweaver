# Solos, step W1 (tools, the "person" follower, tuning, baselines): hand-off, second round

*18 November 2026 · branch `p11/solo` in `/home/user/aw-work/wt-p11solo` · the numbers the
screens state are in `/home/user/aw-work/11/solo/w1/NUMBERS.md` (sections 7 and 8 are the
current ones) · the first round's hand-off is kept beside this as `HANDOFF-round1.md`.*

## 1. Where it stands

@@STATUS@@

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

@@NUMBERS@@

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
- **`tools/release-check.ts`:** the content's version is now `@@CONTENTVERSION@@`.
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

@@RECORDEDNOTE@@

## 7. Tests

@@TESTS@@

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

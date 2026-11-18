# Solo rework: independent review

Commit `da9c99e` (`p11/solo-join`) against `main` (`2a2b91b`). 18 November 2026.

**Verdict.** No defect that breaks a fight, a save or a replay. The firing rule holds: over about
470 real fights played tick by tick, no Solo fired twice, none fired from a disabled or downed
hero, none inside the one-second gap, and every Cued Solo had exactly one `cued` event and the
Thread on its hero. The defects are at the edges: one hero whose Solo can sit unfired, a tell that
shows for heroes who cannot fire, Solos that cancel the hero's own cast, and two HUD promises the
sim does not keep.

Scripts are in this folder. Run a `*.test.ts` with `./run.sh <name>`; run a `.ts` or `.mts` with
`npx tsx <file>` from the checkout.

## Confirmed by running

### 1. Oro's full Solo does not fire while no Sapling is fighting, and nothing can fire it now (medium)

- **Where:** `src/sim/systems/heroes.ts:322-324` (`soloFires`), `src/sim/systems/grove.ts:480-496`
  (`groveHeld`, `groveSoloDue`), `src/sim/systems/solos.ts:78-84` (`soloDueIn`).
- **Scenario:** Oro, no Focus given (he never takes a target), Solo full, every Sapling felled, an
  enemy on the field, the Thread on Oro. His wait only runs while a Sapling has a target, so the
  Solo sits. In the staged run it fired at 10.9 s, only after Regrowth stood a Sapling back up at
  6.6 s. This holds for Homecoming too, whose whole job is to re-sprout felled Saplings.
- **In real fights:** with the Novice, Oro's Solo stood full and unfired with enemies alive for
  14.2 s in Hollow Cantor (seed 501) and 7.4 s in Mirror Hall (seed 502).
- **What the player sees:** `soloDueIn` returns a constant 1, so his frame shows the loud strip
  ("Thread to Cue", or "Cued" with the Thread on him) with "1.0" standing still.
- **Knock-on:** with Silent Cues the lead is 1.5 s, so `autoSoloTarget` picks him for the whole of
  it (2.3 s of 2.3 s in the one fight measured).
- **Before:** on `main` the player could Cue him at any time.
- **Fix:** run his wait whenever the party is in a fight (an enemy engaged), or at least when a
  Sapling is down; and have `soloDueIn` return null while `grove.held` is not running.
- **Scripts:** `probe3.test.ts`, `oro-stuck.mts`, `invariants.ts 2 - kael,oro,vexis`.

### 2. `soloDueIn` says a Solo is coming for heroes who cannot fire (medium)

- **Where:** `src/sim/systems/solos.ts:65-88`. It knows nothing of stun, stagger, sleep, a Reel,
  stilled or possessed. Four callers each add their own "stilled or possessed" check
  (`hudBridge.ts:170`, `soloMark.ts:106`, `bots/common.ts:1236`, `InputController.ts`
  `autoSoloTarget`); none handles a stun, and one caller has no check at all.
- **A stunned hero:** Lyra stunned 5 s with a full Solo. Her strip reads "Thread to Cue 1.0",
  loud, for the whole stun (`probe2` P1).
- **The beat strip:** `nextSolo` (`src/ui/hud/conducting.ts:202`) has no check. On the Silent
  Conductor with A Tempo, three seeds: the party was stilled for 79 s in all, and the strip named
  a next Solo ("Lyra's Solo begins in 1.8 s") for 72 s of it, while the frames rightly showed
  none (`beatnext.mts`).
- **Auto-Thread:** Kael stunned 6 s with a full wall, the player's Thread on Vexis, busy with
  Ward. Auto-Thread takes the Thread to Kael at 0.02 s and it is still there at 7 s
  (`probe5` C). The "wall" rule tests `targetId !== null`, which is stale through a stun
  (`InputController.ts:1229`). The Skilled bot's `soloToCue` has the same line
  (`bots/common.ts:1239`).
- **The Novice:** her `followed` (`novice.ts:488`) ends a follow only on `soloDueIn === null`,
  so she too waits on a stilled or stunned hero, up to her 4 s patience.
- **Fix:** put "cannot fire now" (`isDisabled`, `hero.reel`) inside `soloDueIn` and delete the
  copies. `docs/solos.md` says nothing keeps a copy of the rule; five places do.

### 3. A hero's own Solo cancels their own cast, Flourishes included, more often than before (medium)

- **Where:** `src/sim/systems/solos.ts:118` (`startSolo` clears `h.cast`); `heroes.ts:186` fires
  before the cast block; `calls.ts` `tendCall` then ends an answered call as "cancelled".
- **Measured**, the same 104 fights (13 fights, 4 seeds, Skilled and Novice):

  | | Solos | Cancelled a cast | Cancelled a Flourish cast |
  |---|---|---|---|
  | `main` | 572 | 72 (12.6%) | 14 (2.4%) |
  | this commit | 939 | 185 (19.7%) | 41 (4.4%) |

- **What it means:** the player answers a call, gets the Resonance, and the hero throws the
  Flourish away a moment later because their one-second timer ran out. Before, the player chose
  when to Cue; now nobody can avoid it.
- **Fix:** in `soloFires`, hold while `hero.cast` is set (bounded by the cast's length), or at
  least while the cast is a Flourish.
- **Script:** `castcancel-main.mts <root> 4`.

### 4. The Conductor's badge promises a Duet the Solo will not be (medium-low)

- **Where:** `src/ui/hud/conducting.ts:63-67` and `:369`. `cueBadge` asks `nextCue`, which
  answers "if Cued now"; the Solo fires `soloIn` seconds later.
- **Scenario:** Lyra Cued; 1.5 s later Vexis's Solo is 3 s off with the Thread on her. Her strip
  shows a filled gold "Duet" at 2.5, 2.0, 1.5 and 1.0 s to go, with 1.98 down to 0.48 s left on
  the chain. The badge disappears at 0.5 s and the Solo fires as link 1 (`probe4`).
- **Fix:** show the badge only when `soloIn` is no more than the chain's time left.

### 5. The Novice follows Solos with one-tick hands, and her new bands are set on that (medium-low)

- **Where:** `src/bots/novice.ts:107-111` (`NOVICE_SOLO`), `:465-472`.
- **Measured**, 13 fights, 12 seeds:

  | The Novice | Solos Cued | Bosses won | Downs, all fights |
  |---|---|---|---|
  | As built | 60% | 69% | 2.20 |
  | Solo follow off | 26% | 52% | 2.54 |

- **Against the doc:** `docs/solos.md` says she wins more "because her heroes now use their
  Solos". About 17 points of her boss wins come from her own following. Her 60% Cued is above the
  doc's own stand-in with one-second hands (52%) and nearly twice a player who never follows
  (34%).
- **Also:** `soloToCue` returns Kael whenever his wall is full, whatever `within` is, so she parks
  on him for up to his 3 s hold; and her follow has no low-life guard, only "down or held".
- **On starving healing:** it does not show in aggregate. Her downs go down with the follow on.
- **Fix:** give her a reaction delay or a much lower `follow`, or say in the doc what the bands
  are built on.
- **Script:** `novice-follow.ts 12`.

### 6. Silent Cues: the loud "Thread to Cue" prompt comes one tick too late (low-medium)

- **Where:** `threadCues` (`solos.ts:48`) with `cueHold` 1 s against `SOLOS.wait` 1 s.
- **Scenario:** the Solo fires 59 ticks after the tick it fills. A Thread sent on the first tick
  it is full has been there 59 ticks: plain. Only a Thread already there a tick before it fills
  is Cued (`probe2` P6).
- **What the player sees:** once the strip turns loud and says "Thread to Cue 0.9", obeying it
  cannot work, unless the gap or Kael's hold delays the Solo.
- **Back-to-back Solos:** the Skilled bot gets 17 Cued and 33 plain under Silent Cues, against 43
  and 2 without. The Conductor's Trios fall from 0.67 to 0.25 a fight (`silent.mts`).
- **Fix:** under Silent Cues do not show "Thread to Cue" once full unless the hold can still be
  met, or make the hold shorter than the wait.

### 7. Hollow Crown gives the Conductor's Duets and Trios for nothing (low-medium, balance, the owner's)

- **Where:** `threadCues` returns true for every hero with `mods.alwaysCued`.
- **Scenario:** Conductor plus Hollow Crown, the Thread on nobody, three Solos charged. Result:
  3 Cues, 1 Duet, 1 Trio (`probe2` P5).
- **Reach:** A Tempo's 15 Resonance, Reprise, Ensemble, Canon, the chorus pulse and the Maestro
  Deed all follow. Cleansed, the relic has no curse left. It was "Cues cost 10 less".

### 8. Auto-Thread: two small ones (low)

- **Going back takes the Thread off a hurt hero.** Lyra at 50% life, the player's Thread on Kael
  at full life, busy with Ward. The Thread goes to Lyra at 0.50 s, she fires Cued at 0.98 s, and
  at 1.00 s it goes back to Kael (`probe5` A). `docs/solos.md` says it does not leave a hero
  under 60%. `InputController.ts:1085` (`autoThreadBack`) does not apply `AUTO_SOLO_KEEP`.
- **A left click that threads nobody ends the follow.** `rolePress` sets `threadTouched` before
  it knows a hero is hovered (`InputController.ts:594`). A click on bare ground at 1 s while
  Kael is followed: the Thread never returns to Vexis. The control run without the click returns
  at 3.02 s (`probe5` B0 and B). Fix: set it only when a `thread` command is pushed.

### 9. Kael raises his wall with nobody to fight (low)

- **Where:** `heroes.ts:311`, which comes before any target check.
- **Scenario:** wall full, under half life, no enemy on the field: he raises it (`probe2` P8). In
  a real fight: Novice, Tolling Halls, seed 504, at 25% life with 0 enemies alive.
- **Before:** `main` did this under 30%; now it is under 50% for everyone.

### 10. Small things, run

- **One tick late for Kael.** `heroes.ts:325` compares `soloHeld` to the wait with no float
  slack, though the gap line has it. Lyra fires 59 ticks after filling; Kael at 180, not 179
  (`probe1`).
- **Settings 4 to 5:** nothing wrong. Four files written by `main`'s schema migrate with only the
  Cue binding, the pad's Cue, the modifier and `autonomy` gone; `T` rebound to Ward stays Ward
  (`settings-migrate.mts`).
- **Determinism:** nothing wrong. Three fights played twice gave the same hashes, including Oro,
  Seren, Silent Cues, Hollow Crown and A Tempo (`determinism.mts`). The diff adds no wall-clock,
  no `Math.random` and no order-dependent Map or Set iteration.
- **The team's own tests:** `tests/sim/solos`, `uiSolos`, `meta/migration`, `sim/conducting` and
  the aura pin pass at this commit, 104 tests.
- **The Skilled bot's Thread rule does not starve healing:** bosses 95% won with 0.86 downs,
  against 89% and 1.13 with the rule off (104 fights, `out/sk.jsonl`).

## By reading only

- **The "dome" coach hint keeps its own copy of the rule** (`src/ui/hud/hints.ts:414-421`). It
  shows when two heroes have any incoming damage at all, from any telegraphs at any distance. The
  sim's `partyHitWithin` wants one telegraph, within 1.5 s, at least 15% of life each, and Kael
  with a target. So "Thread Kael: his wall shields everyone" can show when he will not raise it
  at once.
- **`wasted` looks only at `health.incoming`** (`heroes.ts:342-349`). A rooting Solo still fires
  into a Rally, a pull or a ground zone with no telegraph on the hero. Starfall roots even Cued.
  This is the same family as the Frayed Threshold finding the doc already reports.
- **Text that still tells the player to "Cue"**, which the doc says was reworded:
  `src/content/deeds.ts:181` ("Cue {n} Solos in one run"), `content/fill/finale.ts:101`,
  `content/callings.ts:330`, `content/bonds.ts:168`, `ui/text/en/screens/callingText.ts:67` and
  `:88`, `codexScreen.ts:63`, `chordBuilder.ts:52-54`.
- **The Maestro Deed** (25 Cued Solos in a run) now comes to a player who never follows a Solo
  (about 4 Cued a boss fight on whoever the Thread is on) and to anyone with Hollow Crown.
- **Screen readers:** the Solo strip is `role="status"` with the seconds as live text inside it
  (`PartyFrames.tsx:1450`, `solo-in`). The text changes ten times a second, and under Silent
  Cues so does the `aria-label`. The call strip already does the same with its label.
- **Tests that cannot fail:** `tests/harnessTools.test.ts:1810`
  (`expect(t.plain).toBeGreaterThanOrEqual(0)`) and, nearly, `tests/gamepad.test.ts:886`.
- **The masked replay's frozen copies** (`tests/fill/pre5g/*`) were re-recorded from today's
  tree (`AW_REFREEZE_PRE5G`). The test still pins the masked content going forward. It no longer
  shows the fill was inert against a tree from before the fill. `pre5g/golden.json` still says
  `simVersion` 22 and holds 32 old hashes that nothing reads.
- **Re-records.** The goldens, Dissonance pins, command snapshots, baselines and key-count pins
  all moved, as a change every fight plays by would move them. The aura pin moved in its
  `simVersion` line only. The re-seeded tests (`expert.test.ts`, `harnessTools.test.ts`) each say
  why. Tests deleted without a twin are all about a Cue's price or the bots' Cue timing. I found
  no skipped test.
- **Old replays.** `verifyRunReplay` refuses format 1 before parsing, with status `claimed`, no
  `problem`, and the one sentence. `setWeeklyStatus` no longer lets `claimed` overwrite Verified.
  Kept own-weekly replays of format 1 read as null and stay Claimed. A run under way loses its
  log and makes no replay. I found nothing that reports an old replay as a mismatch.
- **Input.** No key, modifier or pad button produces anything Cue-like; `effectiveBindings`
  ignores a retired `cue` override even without the migration.
- **Dead leftover:** the `cueCost` stat key in `src/content/effects.ts:38`.

## Not looked at

- The whole suite, typecheck, lint, `npm run build`, the browser tests.
- Sound, beyond reading `soloWait.ts`; the mark over the hero, beyond its null conditions.
- The Codex, Training, Prep, Result and Summary screens; the labs; the gamepad's own paths.
- The baselines and goldens line by line; the doc's numbers, other than the ones re-measured
  above; the claim that halving the gains moved no fight.
- `tools/replay-verify.ts` and `tools/run-verify.ts` exit codes; the Atlas's drawing of a refused
  replay; a real saved run from `main` (the team's fixture test passes; I did not build my own).
- Kael's urgent wall while his Grand Finale turn is still to come: my staging did not reach it.
- The hand-offs other than `DECISION.md`, `docs/solos.md` and a search of the rest for these
  findings. None was listed there.

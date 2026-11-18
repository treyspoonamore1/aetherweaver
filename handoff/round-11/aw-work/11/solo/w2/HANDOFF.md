# Solos, step W2: hand-off (input, settings, saves, replays, Auto-Thread)

*18 November 2026 · branch `p11/solo-w2` in `/home/user/aw-work/wt-p11solo-w2`, from `8572e48` ·
read `W0-HANDOFF.md` section 4 first.*

## 1. Where it stands

**W2 is at its finish line.**

- Final commit: **`a569874`** on `p11/solo-w2`. The tree is clean. (`9974ef1` was the first
  hand-back; `a569874` is the orchestrator's follow-up on Auto-Thread, section 4.)
- Typecheck: clean. Lint (ESLint and the formatter): clean.
- The six failing tests W0 listed as W2's all pass now, rewritten for a game with no Cue.
- All 25 test files I own pass: 476 tests.
- Unit suite, whole, on that commit: **5,460 tests: 5,407 pass, 41 fail, 10 skipped, 2 to-do.**
  (On `9974ef1`: 5,456 and 5,403, with the same 41 failing, compared name by name.)
  W0's commit also had 41 failing, but they are not the same 41: W2's six are gone, and six
  tests in other steps' files
  now wait on those steps because of what I changed. Each is named in section 8. Log:
  `/home/user/aw-work/11/solo/w2/logs/suite2.log` (and `.json`); the earlier run is `suite.log`.
- **Aura:** the same three tests as before fail on the one stored number in
  `tests/aura/presentationPin.test.ts`. `chordCardsPin` passes. No other aura test fails.
- The container restarted at about 08:10, seconds after the first suite run finished and wrote
  its log. Nothing of mine was lost. After the restart I ran typecheck and lint again, the aura
  tests, and the two files whose new failures I had to explain; then the follow-up, with the
  whole suite, typecheck and lint once more on `a569874`.

## 2. What changed, in plain language

1. **A player who had Hero autonomy on is no longer marked "assisted".** This went in first, as
   its own commit (`ab3ceea`). The old switch was still read by the run's assist record. It is
   not any more. The Perfect window, the telegraph lead, game speed and Auto-Thread still mark a
   run.
2. **Settings go from version 4 to 5.** An old settings file loads. Three things are dropped
   from it: the Hero autonomy switch, the Cue modifier, and anything bound to the Cue key or the
   pad's Cue button. Every other setting is read exactly as saved. A key or button the player
   had given to something else stays theirs, including `T` and the right bumper.
   **Run saves (5) and profiles (10) did not move** and load unchanged.
3. **There is no Cue key, Cue modifier or pad Cue button.** `T` and the pad's right bumper do
   nothing, and are free for the player to bind to something else. A hero's number threads that
   hero whatever is held with it. Ctrl and Alt chords never reach the game, as before.
4. **The screens.** Settings lost the Hero autonomy row. Controls lost the "Cue a Solo" row, the
   Cue modifier row, the pad's "Cue the reticle's hero" row and the "With Shift: Cue their Solo"
   hint under each hero's key. Prep's quick assists lost its Hero autonomy toggle. Training no
   longer compares the old switch.
5. **Auto-Thread follows a Solo about to fire, also while the player is busy.** Once the player
   has not touched the Thread itself for 2 seconds, and nobody is in danger, the Thread goes to
   a hero half a second before their Solo is due, stays until it fires (so it is Cued), then
   goes back to where it was. Ward, Chime, moving and the other keys do not hold it back. It is
   the Skilled bot's rule, read from the sim's `soloDueIn` and `threadCues`, with two guards of
   its own. It still marks a run as assisted. Details in section 4. (The first version asked for
   the hands fully off; the orchestrator changed that after the first hand-back, commit
   `a569874`.)
6. **An old replay is refused in one plain sentence.** A fight replay of format 6 or lower, or a
   run replay of format 1, is never played and never reported as a check that failed. Details in
   section 5.
7. **Two recap lines** that told the player to "Cue Thousand Cuts" now say
   "Thread her as Thousand Cuts fires" (`src/meta/run.ts`).
8. The fight tally's `freeCues` keeps its name in the save, as W0 advised. Renaming it would be
   a run-save version step.

## 3. Stand-ins left on purpose (three, each tagged `SOLO-JOIN`)

W3's files still ask for the Cue key's label and the Cue modifier. I did not edit them. Three
small stand-ins in my files keep them compiling and running. **W3's own `labels.ts` imports one
of them, so they are needed when the branches are joined too, not only in my worktree.**

| Stand-in | Where | Who still uses it | Remove when |
|---|---|---|---|
| `'cue'` kept as a name in the `Action` type, with a hidden, empty key list in every set of bindings (`RetiredAction`, `withRetired`) | `src/input/actions.ts`; callers in `bindings.ts`, `padBindings.ts` | `bindingLabel('cue')` in `src/ui/hud/KeyHints.tsx:55`, `HowToPlay.tsx:70` and `:84`; `key('cue')` in `src/ui/screens/CodexScreen.tsx:1064` and `:1068` | those five calls are gone |
| `cueModifier?: undefined` on `InputSettings` (never set, not in the schema) | `src/app/settings.ts` | `cueModifierMark` in `src/ui/hud/labels.ts:73`; `CodexScreen.tsx:982` | neither reads it |
| `isModifierToken` | `src/input/inputMap.ts` | `inputLabel` in `src/ui/hud/labels.ts:5` and `:48` | that branch of `inputLabel` is gone |

"Hidden" means the entry is not enumerable. No list of actions, no Controls row, no saved
setting and no test that walks the actions ever sees it. With the stand-ins in place the HUD's
old Cue line reads "—" for the key and "⇧" for the modifier; that is W3's seam from W0, unchanged.

To remove: search for `SOLO-JOIN`, delete the marked lines, and typecheck. A use that W3 missed
shows up as a type error. My tests are written to hold without the stand-ins too (they check
the lists, the keys and the screens, not the stand-ins). I could not try that: W3's files need
them today.

## 4. Auto-Thread, as built

`autoThread`, `autoSoloTarget` and `partyInDanger` in `src/input/InputController.ts`.

- **When it follows a Solo:** once the player has not touched the Thread itself for 2 seconds
  of the fight's own time (`AUTO_THREAD_IDLE_SECONDS`). Touching the Thread means a hero's key,
  the click that threads the hovered hero, the pad's "Thread the reticle's hero", or a click on
  a party frame. Ward, Chime, Reel, moving, Mend ⇄ Empower, the Directives and the mouse moving
  are not a touch: a busy player still gets every Solo followed.
- **The player's own touch ends a follow at once**, and nothing is followed for the next
  2 seconds: the Thread is theirs.
- **Guard 1, the hero it would leave:** it does not leave the hero the Thread is on while that
  hero is under 60% of their life (`AUTO_SOLO_KEEP`). Their own Solo is still Cued, since the
  Thread is on them.
- **Guard 2, anyone in danger:** it follows nothing while a hero is downed, on a Fermata hold,
  condemned by an Execution, or under 30% of their life (`AUTO_SOLO_DANGER`).
- **Brann is left out of both lines**, as the bot leaves him out of the danger line: he sits
  low on purpose. That is my reading for the 60% line; say if he should count there.
- **The lowest-life rule is as it always was:** only with the hands fully off for 2 seconds
  (no key, button, stick or mouse move), then every 2 seconds. A busy player's Thread is never
  moved by it.
- **The lead** is 0.5 s (`AUTO_SOLO_LEAD`), longer by Silent Cues' hold when that level is on.
- **Kael's wall:** once it is full and he has someone to fight, the Thread waits on him between
  the other heroes' Solos, because he may raise it at any moment and the Cued wall is the dome
  over everyone.
- **Then back:** when the Solo has fired, the Thread returns to the hero it left. With the hands
  fully off, the lowest-life rule has its say first, as it would send the Thread there anyway.
- Not followed: a hero out of the Thread's reach, stilled or possessed; a full Solo with no one
  to fight; anything through the Grand Silence; anything with Hollow Crown (every Solo is Cued
  anyway); anything while the Thread is locked or the Weaver is down.
- A command is sent once per hero, so a refused one is never repeated every frame.

The numbers sit together at the top of `InputController.ts`: the wait 2 s, the lead 0.5 s, the
danger line 30%, the keep line 60%. The lead and the danger line are copies of the Skilled bot's
`SOLO_LEAD` and `SOLO_DANGER` (private to `src/bots/skilled.ts`; input should not import from
the bots). The keep line is the aid's own.

## 5. Old replays, as built

- The one sentence is `OLD_REPLAY_LINE` in `src/sim/replay.ts`, **a marked stand-in for W3**:

  > This replay is from an earlier version of the game. Solos work differently now, so it can’t be played back.

- **Fight replay, format 6 or lower:** `parseReplay` throws `OldReplayError`, whose message is
  that sentence, before the schema reads the file. Anything else that is not a replay is
  answered by the schema as before.
- **Run replay, format 1:** `verifyRunReplay` answers with `refused: 'oldReplay'`, the sentence
  as its message, no `problem`, and status **`claimed`**, never `mismatch`. I chose `claimed`
  because adding a new status would have broken W3's `STATUS_LOOK` table, and `claimed` already
  means "its replay hasn't been checked". So today the panel shows the grey "Claimed" flag with
  the sentence under it, and no "Didn't match" sound.
- A code given with an old run replay stands as a claim for its week, as a code alone does. A
  code with a typo is answered as a typo: that is the code's fault, not the replay's.
- A weekly entry that a check has already answered (Verified, or not matched) is **not** set
  back to Claimed by a refusal (`setWeeklyStatus` in `src/app/profileStore.ts`).
- Replays the player kept on the device and a run log from before the rework simply do not read
  (`parseRunReplay`, `parseRunLog` answer null, as they did for any unreadable one).

## 6. What I need from other steps

### W3 (HUD, hints, text)

1. **The refusal sentence.** Proposed key: **`screens.atlasModel.replayTooOld`**, proposed
   English as in section 5 (20 words). In `atlasWiring.ts` or `atlasModel.ts`, when
   `result.refused === 'oldReplay'`, show that key instead of `result.message`. A look of its
   own for it (not the "Claimed" flag) would be better still; that is yours to decide.
2. **Remove the uses listed in section 3**, so the stand-ins can go.
3. **Text keys now unused** (my screens no longer read them):
   - `input.options.cueModifier`
   - `input.options.cueModifier.hint`
   - `input.padAction.cueReticle`
   - `input.controls.pressModifier`
   - `input.controls.pressModifierAria`
   - `input.controls.modifierName`
   - `input.controls.cueHint`
   - `a11y.settings.heroAutonomy`
   - `a11y.settings.heroesFireTheirOwn`
   - `screens.prepScreen.heroAutonomy`
   - `screens.prepScreen.heroesFireTheirOwn`

   Still read only by your own `labels.ts`, and free once it stops: `input.labels.cueShiftMark`,
   `input.labels.cueModifierMark`, `input.modifier.Shift`, `input.modifier.Control`,
   `input.modifier.Alt`.
4. **Keys still used whose words are now wrong** (seen on the built Settings screen):
   - `input.options.autoThread.hint`: says only "moves to the hero lowest on life". Proposed:
     "Left alone for 2 s, the Thread follows each Solo. With no input, it goes to the hero
     lowest on life. Shown as an assist." (25 words)
   - `input.options.mouseover.hint`: "Ward, Reel, Chime and Cue go to…". There is no Cue.
   - `input.pad.sticks`: "…the one your techniques and Cues go to."
5. **`T` and the pad's right bumper do nothing.** Key hints, the primer and the Codex's controls
   list should not name a Cue key or button.
6. **Two of your tests pin the recap line I reworded:** `tests/uiPhase5ePresentation.test.ts`
   lines 195 and 196, `tests/uiPhase5e.test.ts` line 594. New text:
   - "Reel or Rally her out of the pack, or Thread her as Thousand Cuts fires."
   - "Rally her out of the pack, or Thread her as Thousand Cuts fires."

   If you want other words, they are in `duelAdvice`, `src/meta/run.ts`; tell W6.

### W1 (tools, tuning)

1. **`tests/meta/roster5e.test.ts` lines 629 and 635** pin the same recap line (text above).
2. **`tools/replay-verify.ts`:** an old replay now throws `OldReplayError`. Uncaught, it prints a
   stack and exits 1, the same code as a mismatch. Please catch it, print `error.message` and
   exit with another code (2 is taken by "usage"; 3 would do).
3. **`tools/run-verify.ts`:** a refused old replay has status `claimed`, which its `good` list
   does not hold, so it exits 1. Please treat `result.refused` as its own case.
4. **If tuning moves the bot's `SOLO_LEAD` or `SOLO_DANGER`, or widens `threadCues`:**
   Auto-Thread reads `threadCues` and `soloDueIn` live, but its lead and danger numbers are its
   own copies (section 4). Tell W6 the new values, or put the two numbers in `SOLOS`
   (`src/sim/constants.ts`) so both read one copy.
5. **Worth a look, not verified in the bot:** `soloDueIn` reads the whole wait (1 s) for a hero
   with a full Solo and no one to fight, who will not fire. With Silent Cues the lead is 1.5 s,
   so such a hero counts as "due". Auto-Thread skips them. `soloToCue` in `src/bots/common.ts`
   does not, so the bot's Thread may sit on such a hero between waves under Silent Cues.

### W4 (sound)

Nothing. Auto-Thread sends ordinary `thread` commands.

### W6 (tests, browser tests, docs, pins)

1. **Release pin:** settings is **5** (`RELEASE_PINS.settings` in `tools/release-check.ts`, and
   the sentence above it). `tests/releaseTools.test.ts` waits on it.
2. **README:** line 47 (`T · Shift+1–4` Cue row), line 55 (the Cue modifier sentence), line 65
   (right bumper). `T` and the right bumper do nothing.
3. **`e2e/smoke.spec.ts` lines 824 and 830** press `Shift+Digit`: that now threads the hero.
4. **Remove the `SOLO-JOIN` stand-ins** once W3's uses are gone (section 3).
5. **Docs:** `docs/solos.md` ("Versions": settings are 5; "Still to do": input and saves are
   done), `docs/phase-7.md` decision 15 (Auto-Thread's new rule) and 16 (two assists, not
   three), `docs/hero-autonomy.md`.
6. **When the rework lands on main,** add a settings-5 fixture from the landed commit: a line in
   `BUILDS` (`tools/save-fixtures.ts`), then `npx tsx tools/save-fixtures.ts --only <id>` and
   `--expect`; `tests/meta/saveMatrix.test.ts` "settings 1-4" then reads 1-5. I did not add one
   from my own branch, because that commit must exist for good.
7. **Browser tests owed:** old settings load and Controls shows no Cue rows; Auto-Thread follows
   Solos with the hands off. My own script for both is at
   `/home/user/aw-work/11/solo/w2/check/browser.mjs` (not in the repo).

## 7. Recorded results I re-recorded, and why

| What | Why |
|---|---|
| `tests/fixtures/saves/expected.json` (`npx tsx tools/save-fixtures.ts --expect`) | Settings are read as version 5. In all 15 fixtures that hold settings, the version reads 5 and the autonomy switch is gone. I compared old and new by script: **no profile, no run and no fight hash moved**, and no other setting. |
| New: `tests/fixtures/saves/b16-2a2b91b.json` | A real save written by main's own code (`2a2b91b`, the last build before the rework): run save 5, profile 10, settings 4 with Hero autonomy on, the Cue key on Y, the Cue modifier on Ctrl and the pad's Cue on another button. Today's build loads its run and profile untouched and its settings without those things. |

Nothing else. No golden, baseline, picture or sound snapshot was touched. Nothing under
`tests/aura/`, neither pin, none of the eight aura files and not `AURA_APPROVED`. No file under
`src/ui/text/en`. No file owned by W1, W3, W4 or W6.

**Fight-derived picture and sound snapshots:** none are mine.

## 8. Tests

Added or rewritten, all in files I own:

- `tests/a11yPhase7.test.ts`: the old autonomy switch marks nothing.
- `tests/meta/migration.test.ts`, `tests/phase7Contracts.test.ts`, `tests/reviewB7.test.ts`:
  version 5; a version 4 file with all three things in it; an `input` left empty; the old Cue
  key and bumper bound to nothing afterwards.
- `tests/meta/saveMatrix.test.ts`, `tools/save-fuzz.ts`: the real save from main; 300 random
  version 4 settings files read as version 5 with only those things gone, and damaged ones never
  throw.
- `tests/inputController.test.ts`, `tests/inputPhase7.test.ts`, `tests/gamepad.test.ts`,
  `tests/inputNamesW3b.test.ts`: no key sends a Cue; `T` and the right bumper play nothing;
  Controls has no Cue rows.
- `tests/gamepad.test.ts`: Auto-Thread, thirteen tests. Off. Hands off: all three Solos Cued; a
  hero in danger; a hero hurt but over 60%; a hero under 60%. **Busy with other keys the whole
  time:** every Solo followed and the Thread back where the player left it; **guard 1** (the
  hero the Thread is on under 60%: it stays; just over: it leaves and comes back); **guard 2**
  (any hero under the danger line: nothing is sent at all). The player's own touch, by key and
  by party frame: nothing for 2 s, then it follows again. Other keys are no touch. Its target.
  No one to fight. Silent Cues. I took each guard and the new rule out in turn and saw the
  tests for it fail.
- `tests/meta/runReplay.test.ts`: both old formats refused with the sentence; never a mismatch.
- `tests/appStores.test.ts`: a refusal does not set a Verified entry back to Claimed.

### The 41 failing tests, by owner

| Owner | Tests | Same as W0's list? |
|---|---|---|
| The owner (aura pin's stored number) | 3 in `tests/aura/presentationPin.test.ts` | Yes |
| W1 (baselines) | 13: `harnessTools` 4, `meta/expedition2Pin` 2, `meta/finaleHandoff` 2, `meta/movement3Handoff` 2, `meta/rosterHandoff` 2, `sim/rosterInvariance` 1 | Yes |
| W3 (HUD and pictures) | 13: `uiConducting` 3, `uiPhase4d` 3, `uiPhase5dReview` 1, `renderDissonance` 4, `renderConducting` 2 | Yes |
| W4 (sound) | 6: `audioSpireSnapshot` 2, `audioPhase5` 2, `audioPhase5c` 1, `audioConducting` 1 | Yes |
| W2 | 0 | W0 listed 6; all pass |
| **New, from my changes, in other steps' files** | **6** | No |

The six new ones, each expected and each asked for in section 6:

| Test | Why | Whose |
|---|---|---|
| `tests/releaseTools.test.ts`, "with no flags it reads no logs and runs nothing" | The release pin says settings 4; they are 5. I checked: it is the only pin that differs. | W6 |
| `tests/textLayer.test.ts`, "every W3 message lives in its source file's module, and that file uses it" | Two keys Prep no longer reads: `screens.prepScreen.heroAutonomy`, `screens.prepScreen.heroesFireTheirOwn`. (That test looks only at `hud`, `screens` and `common` keys; the other nine unused keys are under `input` and `a11y`.) | W3 |
| `tests/uiPhase5e.test.ts`, "their downs name their answers, Calling-aware" | Pins the old recap line. | W3 |
| `tests/uiPhase5ePresentation.test.ts`, two tests under "Seren overextended" | The same. | W3 |
| `tests/meta/roster5e.test.ts`, "Seren: overextended…" | The same. | W1 |

One more thing seen once: `tests/releaseTools.test.ts`, "at HEAD, the eight aura files… are as at
the base" timed out at 5 s in a run made minutes after the restart, with the machine busy. It
passes alone and with a long timeout, and it passed in the whole-suite run. No aura file differs
from the base (I compared: 0 files).

## 9. In the real app

I built the app and ran my own script against it (1280 × 720, scale 2). Pictures in
`/home/user/aw-work/11/solo/w2/check/out/`; the list of checks is `report.txt` there.

- **An old settings file from main** (version 4, Hero autonomy on, Cue key on Y, Cue modifier on
  Ctrl, pad Cue on the top face button) opens in Settings with no error. The screen has no
  "Hero autonomy", "Cue modifier", "Cue a Solo", "Cue their Solo" or "Cue the reticle's hero".
  The player's own choices are still there (Scatter on T, Thread mode on hold, lead ×1.25,
  Chime on the right bumper). The stored file stays as it was until something is changed; after
  one change it is version 5 with none of the three things in it (`settings-after.json`).
  Pictures: `settings-assists.png` (Assists: three rows, no Hero autonomy), `controls-keys.png`
  (the keys; hero keys have no hint), `controls-behave.png` (no Cue modifier row; the three
  stale lines of section 6 can be read here), `controls-pad.png` (the pad; three Reticle rows).
- **A Training fight.** `T` and Shift+2 leave no Cue on the fight's record; Shift+2 threads
  hero 2. Then, with the hands off and every Solo charged:
  - Auto-Thread **off**: the Thread stays where it was, and one Solo is Cued (the threaded
    hero's).
  - Auto-Thread **on**: the Thread goes Kael, Lyra, Kael, Vexis, Kael, and **all three Solos are
    Cued** (three Cue marks on the fight's record). Charged at tick 258, the Thread was on
    Lyra by tick 293 and on Vexis by tick 354; by the rule their Solos are due at 318 and 378.
    I did not read the firing ticks themselves.
  Pictures: `fight-auto-true.png`, `fight-auto-false.png` (the end of each fight; they show the
  state, not the moment). This hands-off fight was run on `9974ef1`, before the follow-up; it
  was not run again in the browser on `a569874` (the unit tests cover it there).
- **The same fight with the player pressing other keys throughout** (on `a569874`): Ward, Chime,
  a step left, a step right, about five presses a second from before the enemy appears to the
  end, never a Thread key. The player threads hero 2 (Lyra) first.
  - Auto-Thread **off** (1,196 presses): the Thread stays on Lyra; one Solo is Cued (hers).
  - Auto-Thread **on** (1,386 presses): the Thread is still on Lyra when the Solos are charged
    (the lowest-life rule did not move it, though Kael had lost life), then goes Kael, Lyra,
    Kael, Vexis, Kael, **and back to Lyra**. **All three Solos are Cued.** No page errors.
  Pictures: `fight-busy-auto-true.png` (the end: the Thread back on Lyra, Ward and Chime on
  cooldown from the presses), `fight-busy-auto-false.png`.
- One thing I saw on the way: in an earlier try the Weaver stood in the brute's swings and went
  down, and from then on nothing was followed. That is the rule (a downed Weaver has no Thread).
- The page ran at about a sixth of real speed here (software rendering, a busy machine), so the
  script waits in the fight's own ticks.

## 10. Choices the owner may want to look at

1. **Decided by the orchestrator, and built:** Auto-Thread follows a Solo when the player has
   not touched the Thread for 2 seconds, with the two guards of section 4. What is left to look
   at there: whether Brann counts for the 60% line (I left him out), and that the Thread still
   waits on Kael while his wall is full (up to 3 s), which a busy player will now see too.
2. **An old replay shows as "Claimed"** with the sentence, until W3 gives it a look of its own.
3. **A code with a typo, given with an old replay, is answered as a typo** ("Didn't match", with
   the typo's own words), not with the refusal sentence.
4. **The recap lines' new words** (section 6) are mine; W3 may want better ones.

## 11. What I did not check

- **The browser tests in `e2e/` were not run.** At least the Conductor's test will fail (W0 said
  so; it also presses Shift+number).
- `vite build` ran once, for my own check of the app. `npm run build` and
  `tools/release-check.ts` were not run (the settings pin is W6's and will be red).
- **Nobody has played it.** Auto-Thread's following is proven by unit tests and by one scripted
  fight in the built app, not by a person's hands.
- Auto-Thread was not tried with a gamepad connected, with Oro, with Brann, or in a Conductor
  fight with A Tempo. Those paths are read from the rule, not run.
- The two guards were proven in unit tests (a real sim, a real controller, fake keys), not in
  the browser: the scripted fight keeps every hero at full life.
- A weekly run that was under way when the update lands: its log is format 1 and does not read,
  so that run makes no replay and its result stays Claimed. I read this from the code
  (`resumeRecording`); I did not run it.
- The join itself. My branch has not been merged with W1's, W3's or W4's.

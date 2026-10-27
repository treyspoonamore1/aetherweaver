# Phase 3e UI: the Chronomancer

*Owner: the UI workstream (`src/ui/**`). Builds on [Phase 3d's UI](../phase-3d/ui.md). Spec: [docs/phase-3e.md](../phase-3e.md).*

Everything here can be reviewed without playing: open **`/?lab=ui`** (new sidebar group **Chronomancer**) or `/?lab=ui&view=<id>&nav=0`. The lab's **Flow** has all three Callings in Prep.

Every number on these screens comes from content (`callingText`, `optionText`, `crescendoName`, the Calling's `rewind`, `cooldown`, `stasis` and `cost` values, the options' values, `CONTENT.techniques.reel`), the run (`runTotals`, `RunCalling.reviveSpent`) or the sim (`HeroComponent.past` / `pastAt`, `EnemyComponent.foreseen`, telegraph `impact`, `FieldState.stasis`, `WeaverComponent.lastTechnique` / `masteryAt`, `rewindCanRevive`, `EncounterStats.callingRewound` / `callingRevived`). Nothing is hard-coded, so the lead's tuning flows through. The screenshots show content as it was during this session: Rewind 3 s back on an 18 s cooldown, its revive once a run, a 3 s Stasis at half cost, Foresight 1 s ahead.

The Chronomancer is the one who was ready. So the UI shows three things wherever he appears:

- **What Rewind would do, right now**: on the hero F would Rewind, before you press it.
- **What's coming, and when**: Foresight's attacks before they begin, and every hit's timer.
- **Time held still**: Stasis, and what it does to your techniques.

## What changed, by screen

| Where | What | Files |
|---|---|---|
| Prep | **Three Callings, side by side.** "No Calling" stands on the left; each Calling is a column card: emblem, name, title, its one-line `summary`, its Crescendo line ("**Stasis** replaces Sunrise…"), the four pips and **See the path**. New, Chosen and the lock ("Rank 9") sit on the card's top edge, so the name keeps its width. The passive in full is the card's tooltip and the dialog's first paragraph. Prep's blurb says "powers Ward, Chime and Rewind" on his runs | `screens/CallingPicker.tsx`, `screens/CallingParts.tsx` (`CrescendoLine`, compact `CallingTitle`), `screens/PrepScreen.tsx` |
| Tier screen | Generic over the Calling, with his glyphs and axes. "Always yours · Rewind, telegraph timers and a wider Perfect window". Once the run's revive is spent, a line says so | `screens/CallingScreen.tsx`, `screens/callingText.ts` |
| Map, Retune | The strip's tooltip says when the revive is spent. The song builder's budget names Reel's slot Rewind on his runs ("Ward 20 · Chime 15 · Rewind 25") | `screens/CallingParts.tsx` (`CallingStripItem`), `screens/chordModel.ts` (`spiritBudget`) |
| HUD: Weaver bar | **Reel's slot is Rewind's**: its own glyph and name, the 18 s sweep from `cooldownTotals.reel`. **In Stasis** every button is free of its cooldown (a Stasis mark on its corner, no sweep) and its cost reads "~~20~~ 10"; the buttons and the bar take his steel. **The Crescendo read-out** says "Stasis 4s" in steel and silver, its ring timed from content (Eternal Moment included). **A rejection buzzes its slot**: the button shakes with a red ring (Web Animations, no stylesheet), so Rewind's buzz F. **Temporal Mastery** marks Glide's button with what a Glide would bring back now (its glyph and the technique's) | `hud/WeaverBar.tsx`, `hud/buzz.ts`, `hud/Hud.tsx` |
| HUD: party frames | **The Rewind preview** on F's target (the hovered hero, else the threaded one) while Rewind is ready: "**Rewind +1,149**" and a silver ghost on the life bar out to what they'd have; "· dodges it" / "· undoes it" when going back escapes the hit on its way (Paradox undoes it). **A fallen hero within reach**: "Rewind: stands back up · once a run · 2.4 s" with the keys (F, or thread them first: "3 F") and a ring for the time left; the line keeps its colour while the rest of the fallen frame greys. When F would try in vain: "**Rewind: revive spent**" or "**Rewind: out of reach**". **Foresight**: "Glass Lance 0.7 s" on the hero it picked (Requiem-like attacks on every hero). **Timers**: "Toll Cleave 1.4 s" for the soonest hit on its way (the passive's telegraph timers); it stands still in Stasis | `hud/PartyFrames.tsx`, `hud/chrono.ts`, `hud/rewindText.ts` |
| HUD: Calling chip | His emblem and pips; it blazes in Stasis with a "Stasis" label. States: **Revive** (still to come this run) or **Revive spent** (struck through), and **Mastery** (ready) or "Mastery 6s" | `hud/CallingChip.tsx`, `hud/calling.ts` |
| HUD: boss bar | With Foresight, the boss's next attack before it begins: "Foresight · Resound → Vexis & Lyra · 1.0 s" (a link names both its heroes, as the frames mark both). Reel's answer reads **Rewind F** on his runs | `hud/BossBar.tsx`, `hud/AnswerGlyph.tsx` |
| HUD: Stasis tint | A calm steel hush at the screen's edges, under every panel, while Stasis lasts | `hud/Hud.tsx` |
| HUD: hints | Key hints: "Ward · Chime · Rewind · Glide". The primer's "Chime and Rewind" row (3 s back, 18 s cooldown, once a run it stands a fallen hero up). Coach hints: **rewind-up** "Kael just went down — press {F}: Rewind stands them back up, once a run (2.4 s left)" (or "{3}, then {F}" for a hero who isn't the target), **rewind-back** (a big blow, while they're in danger), **lethal-rewind** (only when going back escapes it), **stasis**, **foresight**, **rewind-intro**. On his runs the Reel hints stay quiet, and "strayed" no longer says to Reel them in | `hud/hints.ts`, `hud/KeyHints.tsx`, `hud/HowToPlay.tsx`, `screens/CombatScreen.tsx` |
| Callouts | A revive (the `'rewind'` Save) is its own banner: "**Kael stands again** · Rewound from Bell Brute · 231 life back", with Rewind's glyph. A plain Rewind is a toast ("Rewind · Kael +540"). "**Paradox** · 1 attack on Kael undone" is a banner; "Temporal Mastery · Chime is back" and "Echo Ward · Kael +" its shield are toasts; "Crescendo — Stasis" has its own glyph. A Rewind dodge that saved someone reads "Rewind saved Kael". Rejections read "Rewind: not ready", "Rewind: out of reach", "Rewind: its revive is spent this run", and carry their slot for the buzz | `src/app/runtime.ts` (`callouts` only), `hud/Callouts.tsx` (a callout's own glyph), `store.ts` |
| Result | "**Rewind gave back 1,240 life · stood 1 hero back up.**" right after the songs' lines. "Rewind took heroes out of danger 4 times." for Reel's line. The death recap's ready techniques name Reel's slot Rewind ("Ready but unused: Ward, Rewind.") | `screens/callingText.ts` (`callingParts`), `screens/resultText.ts` (`readyName`), `screens/ResultScreen.tsx` |
| Timeline | The `'rewind'` marker has its own glyph, in his silver | `screens/Timeline.tsx` |
| Summary | **The Chronomancer** panel: "3,157 life Rewind gave back to your heroes", "1 hero Rewind stood back up", and the path. A run where Rewind gave nothing says how to use it ("press F within 3 s"). "Rewinds to safety" in the Cues tile. While here: the run chart's fight names no longer run into each other | `screens/SummaryScreen.tsx`, `screens/Timeline.tsx` |
| Codex | **Callings**: three Callings, his axis legend. The intro says some Callings bring a key (Bear's B, Rewind in Reel's F). **The Weaver → Reel** says what Rewind does on his runs | `screens/CodexScreen.tsx` |
| Rank 9 | The rank-up card shows his emblem on a steel row; `unlockIcon` gives `rewind`. The Rank 8 panel names him next ("Rank 9 opens"); at 9 it reads "3,520 XP · the highest Rank for now" | (generic: `screens/rankText.ts`, `screens/Rank.tsx` read `CALLING_LOOK`) |
| Settings → Controls | The F row reads "**Reel / Rewind**": "The hovered, else threaded, hero. The Chronomancer: Rewind them 3 s back instead" (also in its conflict prompt and labels) | `screens/ControlsSettings.tsx` |
| Kit | Nine Calling glyphs, `rewind` and `stasis` icons, his look | `kit/callingGlyphs.ts`, `kit/iconPaths.ts`, `kit/callingLook.ts` |

## The Chronomancer's look and glyphs

**Clockwork.** His accent is a cool **steel blue** (`#708ca8`), with **silver** for glyphs and marks (`#dfe8f5`) and **brass** at the deep end (`#a8834a`), so his emblem's ring is brass and steel.

The brief suggested a silver-blue. A pale silver-blue can't clear ΔE ≥ 20 in every mode: it sits between the common relics' silver (`#cbd5e1`), the rare relics' blue (`#60a5fa`) and, under protanopia, Mend's sky blue in the red-green palette (`#56b4e9`). I searched the space: no blue lighter than L\* ≈ 58 passes. The steel is the lightest that does, at 20.9. The test checks it, after simulating each vision type, against:

- the Luminary's peach and sunlight, and the Martyr's red;
- Mend and Empower, both as the standard palette has them and as each mode's palette swaps them in (`mend`, `heal`, `empower`, `amp`);
- every relic rarity.

Names and rings use the steel (5.4:1 on the HUD's ink, enough for text). His marks on the HUD are silver on a steel tint, always with a glyph.

The glyphs share the Calling glyphs' 24×24 grid and 1.8 stroke:

| Glyph | Picture |
|---|---|
| **chronomancer** | An hourglass inside Rewind's ring, turning back |
| **quickened** | A stopwatch, running fast |
| **foresight** | An eye whose pupil is a clock |
| **echo** | A Ward, and its echo coming back |
| **borrowed** | Sand from an hourglass, into a Solo's ring |
| **mastery** | Glide's chevrons, and a cooldown turned back |
| **slow_dance** | A slow spiral |
| **paradox** | A loop with no end, turning back on itself |
| **eternal** | A Ward with time held still inside it |
| kit **rewind** | A clock turning back (the F button, the marks, the timeline) |
| kit **stasis** | Time paused (Stasis on the buttons, the read-out, the banner) |

**Axes** (from the design doc; content has no axis field, so `OPTION_AXES` in `callingText.ts` holds them):

| Axis | Look | Options |
|---|---|---|
| **See it coming** | ice `#b8d3f2`, eye glyph | Foresight, Echo Ward, Slow Dance |
| **More turns** | brass `#e3c27e`, clock glyph | Quickened, Temporal Mastery, Eternal Moment |
| **Undo it** | violet `#be9bfa`, rewind glyph | Borrowed Time, Paradox |

The three stay ΔE ≥ 25 apart in every mode (a paler lilac first came within 13 of the ice for deuteranopia).

## Prep

| Rank 8: the Martyr New, the Chronomancer locked | Rank 9: the Chronomancer New |
|---|---|
| ![](ui/prep-chrono-locked.jpg) | ![](ui/prep-chrono-new.jpg) |

| Chosen | His path |
|---|---|
| ![](ui/prep-chrono-chosen.jpg) | ![](ui/prep-chrono-path.jpg) |

- **At 1280×720 the section fits above Embark**, with the "Newly unlocked" strip, at Rank 8 (a locked card, with its lock line) and Rank 9. In the real app with Skip the unlocks the strip has four items in two rows, and it still fits (`real-prep.jpg`).
- Rows didn't fit: with three Callings the third card ran under Embark. The cards became columns (`grid-cols-[11rem_repeat(n,1fr)]`), so a fourth Calling would be a fourth column.
- The card shows the Calling's one-line `summary` instead of the passive, which needs six lines in a column. The passive is in the tooltip and the dialog.

## The tier screen

| Tier I | Tier II |
|---|---|
| ![](ui/chrono-tier-1.jpg) | ![](ui/chrono-tier-2.jpg) |

| Tier III | Tier IV: the revive already spent this run |
|---|---|
| ![](ui/chrono-tier-3.jpg) | ![](ui/chrono-tier-4.jpg) |

The path track's connectors run steel to brass. The passive and Borrowed Time read from content, so the lead's new wording ("Once a run, it stands back up…", "A Rewind that gives back life…") shows as it is.

## Map and retune

| The strip's tooltip: the revive spent | Retune: Rewind in the budget |
|---|---|
| ![](ui/map-chrono.jpg) | ![](ui/retune-chrono.jpg) |

## HUD

| A big blow on Kael: Rewind's preview, Foresight on Lyra | Kael just fell: Rewind stands him back up |
|---|---|
| ![](ui/hud-chrono-rewind.jpg) | ![](ui/hud-chrono-revive.jpg) |

| The run's revive already spent | Kael down too long; Vexis just fell (thread her, then F) |
|---|---|
| ![](ui/hud-chrono-spent.jpg) | ![](ui/hud-chrono-reach.jpg) |

| After the Rewind: Kael stands again, F cooling | Stasis: free, half cost, the timer held |
|---|---|
| ![](ui/hud-chrono-saved.jpg) | ![](ui/hud-chrono-stasis.jpg) |

![The Bellwarden: its next attack foreseen on the boss bar and on the frames](ui/hud-chrono-boss.jpg)

| The preview and Foresight (2×) | Revive, out of reach (2×) |
|---|---|
| ![](ui/hud-chrono-frames.png) | ![](ui/hud-chrono-revive-frames.png) |

| The Weaver bar in Stasis (2×) | After a Rewind: its sweep, Mastery on Glide (2×) |
|---|---|
| ![](ui/hud-chrono-stasis-bar.png) | ![](ui/hud-chrono-saved-bar.png) |

| The chip in Stasis (2×) | The boss bar with Foresight (2×) |
|---|---|
| ![](ui/hud-chrono-chip.png) | ![](ui/hud-chrono-bossbar.png) |

![In the real app: First Light, Kael threaded, F pressed (Rewind cooling from 18)](ui/real-hud.jpg)

- `buildHudSnapshot` fills the new fields from the sim:
  - `HeroHud`: `rewind` (`kind` revive / spent / reach / restore / none, `amount`, `left`, `escape`, `target`, `inRange`), `foreseen` and `lands`.
  - `WeaverHud`: `stasis`, `crescendoTotal`, `rewind` (`seconds`, `range`, `ready`) and `mastery` (`ready`, `remaining`, `total`, `resets`).
  - `TechniqueHud`: `icon`, `free` and `baseCost`; `cost` is what it costs now.
  - `BossHud`: `foreseen`.
  - `CallingHud`: `stasis`, `mastery` and `revive`.
  - `Callout`: an optional `icon`, and the `reject:<slot>` key.
- **The preview mirrors `castRewind`**: the oldest sample `past[pastAt]`, life never lowered, a revive only while `rewindCanRevive(state)`. A hero down since before its reach is `reach`, checked first as the sim does. `left` counts the standing samples from the oldest, `PAST_SAMPLE_SECONDS` each. `escape` uses the sim's own `contains` at the past position, and Paradox always escapes. The tests press F after reading it and check the life and place the sim gives.
- **Nothing that counts down is cached.** `lands`, `foreseen[].in`, the boss's foresight, the cast bar and the enrage clock are `… − state.time` on every 15 Hz snapshot, so in Stasis they stand still.
- **Stasis's discount** is content's `cost` read as the sim's resolver reads it (`1 − cost / 100`). The test pins it to the Spirit a Ward really costs in Stasis.
- **The coach** stays quiet in the Training Grounds, as always.
- `hud-chrono-rewind-deuteranopia.jpg` shows the same HUD with the deuteranopia palette.
- **While here**: a hero's call that needs two keys (thread them, then RMB) pushed its countdown out of the frame. With two keys the ring alone counts now, as the revive line does.

## Result, Summary, Codex, Rank 9

| Result: his line, Rewind's dodges, the timeline, a fall | Summary: his path and totals |
|---|---|
| ![](ui/result-chrono.jpg) | ![](ui/summary-chrono.jpg) |

| Codex: three Callings | Codex at Rank 8: the Chronomancer locked |
|---|---|
| ![](ui/codex-chrono.jpg) | ![](ui/codex-chrono-locked.jpg) |

| Rank 9 | Rank panels at 8 and at the top |
|---|---|
| ![](ui/rank-up-9.jpg) | ![](ui/rank-panels-9.jpg) |

| The primer on his run | Settings → Controls: Reel / Rewind |
|---|---|
| ![](ui/howto-chrono.jpg) | ![](ui/settings-controls-rewind.jpg) |

## Lab views

The new **Chronomancer** group:

- **Prep:** `prep-chrono-locked` (Rank 8), `prep-chrono-new` (Rank 9), `prep-chrono-chosen` and `prep-chrono-path`. They are interactive: choose, unchoose.
- **Tier screens:** `chrono-tier-1` … `chrono-tier-4` (interactive).
- **Map, retune:** `map-chrono` and `retune-chrono`.
- **HUD:** `hud-chrono-rewind`, `hud-chrono-revive`, `hud-chrono-spent`, `hud-chrono-reach`, `hud-chrono-saved`, `hud-chrono-stasis` and `hud-chrono-boss`.
- **Overlays:** `howto-chrono`.
- **Result, Summary, Codex, Rank 9:** `result-chrono`, `summary-chrono`, `codex-chrono`, `codex-chrono-locked`, `rank-up-9` and `rank-panels-9`.
- **Settings:** `settings-controls-rewind`.

**The HUD views are real sims** (`chronoStage(scenario)` in `lab/mock.ts`), not hand-built snapshots. Each one:

1. Creates a sim with the Chronomancer on a path chosen to show something.
2. Stages it with debug commands: enemies placed by the heroes, the Weaver a step back, a Chime, the Crescendo, F.
3. Steps until it shows what the scenario is for: a big blow and an attack foreseen, a fresh fall, a fall out of reach, the moment after a revive, Stasis with a hit on its way, or the Bellwarden casting with its next attack foreseen.
4. Hands the result to `buildHudSnapshot`.

The callouts are the runtime's words, filled from the staged events. The Training Grounds' fights are shown with a Prelude skirmish's header; the Bellwarden's is a real Bellwarden fight. Each takes under half a second and is cached.

New mock builders:

- **Runs:** `chronoRun(opts)`, `chronoOfferRun(tier)`, `chronoResultRun()` (a fall with Rewind ready), `chronoSummaryRun()` and `CHRONO_PICKS` (one option per axis).
- **Changes to existing mocks:** `fakeOutcome` fills `calling.rewound` and `revived` on his runs. It revives once a run (in the fourth fight, so the run sets `reviveSpent`), marks `'rewind'` instead of `'reel'` and counts Rewind's dodges as reels.

## Tests and checks

`tests/uiPhase3e.test.ts` has 22 tests:

- **Rewind in Reel's slot (real sim):**
  - Its name, glyph and cost; its cooldown from content after F; the Luminary keeps Reel.
  - Rejections buzz their slot (`rejectBuzz`).
- **The preview (real sim):**
  - The amount is `past[pastAt]` minus now, on F's target (threaded, else hovered).
  - Pressing F gives exactly that life, and the place.
  - Dodge and undo (Paradox).
  - A fresh fall revives with the life it said, once a run. The next fall reads `spent`, and so does a fight of a run that spent it, where the sim refuses F as `'locked'`. A fall past its reach is `reach`.
- **Foresight and timers:** the foreseen hero shows the attack and `at − time`, nobody else does, and nothing shows without Foresight. A hit's timer equals `impact − time` and stands still through 60 ticks of Stasis.
- **Stasis:**
  - The read-out's name and length (Eternal Moment included) and the chip.
  - Every technique free at content's discount; the Ward's Spirit in Stasis matches.
  - The coach's Stasis hint.
  - Nothing of it without the Chronomancer.
- **Temporal Mastery:** ready and what Glide brings back; after a Glide, "back in 10 s" from content; nothing off the path.
- **The coach:** rewind-up first on a fresh fall (and "{3}, then {F}" for a hero who isn't the target), rewind-back on a big blow, none once the revive is spent. No Rewind or Stasis hints on other runs, no lethal-reel on his, no Reel in "strayed". Every lab scene reaches its moment.
- **Words:**
  - The Result line's exact text (both parts, one, the other, nothing) and its place after the songs.
  - Rewind's dodges line, the death recap's names, Continue → the tier.
  - The Summary's parts and the once-a-run state; the nothing-line names F and the seconds.
  - `techniqueName`, `rewindsFor`, the builder's names.
  - The Crescendo line; every option on its design axis; the three axes ΔE ≥ 20 apart in every mode.
- **Look:** a glyph for every icon, the kit icons, and the steel at ΔE ≥ 20 from everything listed above in all four modes.
- **Rank 9:** the unlock's Rank from content, the card, `unlockIcon` → `rewind`, the allowance either side, a refused `setCalling`, and the Rank 8 panel naming him next.

`e2e/smoke.spec.ts` gains "**Phase 3e: the Chronomancer**":

1. Skip the unlocks, then `newRun`.
2. Click the Chronomancer card. `calling()` has an empty path, and `reservePool()` stays `spirit`.
3. Embark, then `choose()` First Light.
4. Dismiss the primer, checking that it says F Rewinds.
5. `technique-reel` reads `data-name="Rewind"`, and the chip is visible.
6. Press 1, then F. The new test hook `markers()` contains `'rewind'` and not `'reel'`, and `technique-reel` is no longer ready.

The test hook gains `markers()` (the fight's ledger marker kinds). Per the brief, I did not run the e2e suite. It typechecks and lints, and I drove the same steps by script against the dev server (Chromium): the markers came back `['rewind']`, with no console errors. `real-prep.jpg`, `real-primer.jpg` and `real-hud.jpg` come from that run.

- `npm run typecheck` (all three configs) passes.
- `npx eslint src/ui src/app tests e2e --max-warnings 0` and `npx prettier --check src/ui src/app tests/uiPhase3e.test.ts e2e` pass (`docs` is in `.prettierignore`).
- The full `npx vitest run` passes (42 files, 845 tests, with the other workstreams’ tests).
- `npx vite build --outDir /tmp/claude-ui3e-build` succeeds.

## Screenshots

All are under `ui/`, taken with Playwright against the lab (`nav=0`, the stage at its design size) at 1280 wide. I looked at every one. The fixes this led to:

- **Prep didn't fit at 720** with three Callings (the third card ran under Embark). The cards became columns, their tags moved to the top edge and the header became one line.
- **A fallen hero's Rewind line was grey** (the whole frame greys when down) and cut off. It keeps its colour now, and became two lines: what it does with its ring; "once a run" and its time with the keys.
- **The hit timer broke Kael's life line** in Stasis ("1,600 /" wrapped). It became its own small chip in the status row.
- **The lab's staged Weaver went down** in three scenes (the Thread dropped, Rewind wasn't ready). She now stands a step back.
- **The "Undo it" lilac** was within ΔE 13 of "See it coming" for deuteranopia. It's a deeper violet now.
- **The mock's revive** came in an earlier fight than the Result shown, so a highlight named a revive the line didn't. It's in the Result's fight now, once a run.
- **The HUD shots had lost their banners and toasts.** Playwright's `animations: 'disabled'` fast-forwards a callout's fade-out to its end. The HUD views are now shot live, after their entry animations.
- **The boss bar named one hero of a link** (Resound → Vexis) while the frames marked both. It names both now.
- **The Summary's run chart ran short fights' names together** ("The Mourning StepsThe Glass Gallery", as in 3d's Summary). Each name is now cut to fit before the next one ("The Mourning…"), with the full name as its tooltip.
- **`real-prep.jpg` caught the cards mid-transition** (No Calling's border still gold after choosing). It's taken once they settle.

The PNG crops are at 2×. `real-*.jpg` come from the real app on the Vite dev server, driven through the run hook.

## Known gaps

- **The Stasis ring ignores Encore's bonus.** It reads content (with Eternal Moment), as the Vow's and Sunrise's always have.
- **Foresight's area attacks around an enemy** (the Bellwarden's tolls, a burst at its feet) show on the boss bar but on no frame. Only attacks that picked a hero, or fall on every hero (Requiem), mark frames.
- **A Rewind dodge that saves a hero** reads "Rewind saved Kael" as a callout, but the Result's highlight reads "with a Reel": the sim records the save as `'reel'`, and meta words it with `SAVE_HOW.reel`.
- **"Rewind: out of reach" as a toast** is inferred: the sim's rejection says `'target'` both for no hero and for a hero down too long, so the callout says "out of reach" when the threaded hero is down.
- **The boss bar's "Rewind F" answer** stands for Reel's. Rewind only dodges if where the hero stood is out of the shape. The frame's "· dodges it" says whether it would.
- **A busy frame can wrap its status row**: a Rewind mark, two foreseen attacks, a timer and statuses at once. Frames keep their width; the column grows a line.
- **His steel is muted.** It is as light as a blue can be and stay ΔE ≥ 20 from everything it must. His marks use silver on steel for contrast.
- **The lab's HUD scenes run the Training Grounds' arena** with a Prelude header (the Bellwarden's is real).
- **The primer scrolls at 720 px** on every run, as before (its content is 879 px; Rewind's row adds 45).

## Contract notes

I made no changes to `src/sim`, `src/content`, `src/meta`, `src/bots` or `src/input`. Outside `src/ui` I changed only the `callouts` method of `src/app/runtime.ts`, `src/app/testHook*.ts` (`markers()`), `e2e/smoke.spec.ts` and `tests/uiPhase3e.test.ts`. What would help:

- **`contains` from the sim's public surface.** The HUD imports it from `sim/combat/telegraphs` (as the bots do) to tell whether Rewind dodges and when the next hit lands. An export from `src/sim` (or `telegraphsOn(state, entity)`) would keep the HUD on the public API.
- **The Crescendo's length in state.** A `crescendoTotal` on `WeaverComponent` (or the `crescendoStart` duration kept) would make Stasis's ring exact with Encore, and the Vow's and Sunrise's too.
- **Stasis's discount in state.** `CallingState.stasisCostMult` would let the HUD read the sim. Today it mirrors the resolver (`1 − cost / 100`), and the test pins it.
- **Why a Rewind was refused.** A distinct reason for a hero down too long (`'reach'`, say), apart from `'target'` (no hero), would let the toast be exact.
- **A Rewind dodge's save.** A `'rewind'` cause for a dodge (or `summarize` naming Rewind on his runs) would make the highlight say "by rewinding them" instead of "with a Reel".
- **Telegraph answers.** `answers` name `'reel'`, which on his runs the UI shows as Rewind. An answer that knows Rewind (or none for attacks Rewind can't dodge) would be truer.
- **Axes in content.** `OPTION_AXES` now holds nine axes for three Callings; an `axes` field on each option would replace it.
- **Auras untouched.** No aura's look or text changed. The song builder's budget and the HUD's aura chips are as they were; only Reel's slot is named Rewind there on his runs.

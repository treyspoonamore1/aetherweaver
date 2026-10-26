# Phase 3d UI: the Martyr

*Owner: the UI workstream (`src/ui/**`). Builds on [Phase 3c's UI](../phase-3c/ui.md). Spec: [docs/phase-3d.md](../phase-3d.md).*

Everything here can be reviewed without playing: open **`/?lab=ui`** (new sidebar group **Martyr**) or `/?lab=ui&view=<id>&nav=0`. The lab's **Flow** has both Callings in Prep.

Every number on these screens comes from content (`callingText`, `optionText`, `crescendoName`, the options' `below` values, `callingDef(...).unlockRank`), the run (`Run.reservePool`, `Run.chordsAllowed`, `runTotals`) or the sim (`WeaverComponent.maxLife / reservedLife / undying / lastMode`, `FieldState.vow`, `WorldState.calling.crescendo / bearShare`, `EncounterStats.callingBorne / callingShielded`). Nothing is hard-coded, so the lead's tuning flows through. The screenshots show content as it was during this session: +100% Life (360 → 720), Bear 35% softened by 50%, a 5 s Vow, Blood Font below 50% and Low-Life Vigil below 35%.

The Martyr should read as a low-Life, high-stakes support. So the UI shows three things wherever she appears:

- **Her Life budget**: how much of her Life the songs hold, hatched.
- **Her thresholds**: where Blood Font and Low-Life Vigil wake on that bar.
- **Her danger**: the life figure turns red near the bottom.

## What changed, by screen

| Where | What | Files |
|---|---|---|
| Prep | **Two Callings.** "No Calling" runs down the left beside a card per Calling. The pick schedule ("4 picks along the way … after First Light, your fights at steps 4 and 6, and the Bellwarden") is said once, in the section's header, because every Calling picks at the same milestones. The cards keep only the pips and **See the path**. Locked, New and Chosen states work for any Calling, so the Martyr shows **Rank 8** until then. The Crescendo line names each Calling's own: "**Sunrise** burns brighter…", "**Martyr’s Vow** replaces Sunrise…". Prep's blurb says a Martyr's auras reserve Life | `screens/CallingPicker.tsx`, `screens/CallingParts.tsx`, `screens/PrepScreen.tsx` |
| Song builder | **The Life budget** on a Martyr run. It shows what the songs hold of all her Life (in the auras' colours, hatched), the Life she fights with, and the **90% cap** as a dashed line ("you keep at least 10%"). Her path's **Blood Font / Low-Life Vigil thresholds** are notches with their glyphs, and each says whether these songs start her past it. It also shows "You fight with 324 Life of 720: a Weaver without the Martyr has 360" and "All 100 Spirit is free: Ward ✓ Chime ✓ Reel ✓". Over the cap, the sim's sentence appears ("Your songs would leave you less than a tenth of your Life.") and Embark / Retune wait. "Reserves …% of Spirit" reads "of Life" everywhere in the builder | `screens/ChordBuilder.tsx` (`LifeBudgetPanel`), `screens/chordModel.ts` |
| Every retune site | `Run.reservePool(run)` goes through `loadoutProblems`, `useChordDraft` and `ChordBuilder` (`pool`, `calling`), like `fieldAuraSlots`. That covers Prep, the Respite, the forge, the Tuning Pool and event retunes (all via `RetuneView`), and Third Voice's preview. In Prep the pool follows the Calling chosen there: when it changes and the draft is legal under the new pool, the run gets the draft again | `screens/PrepScreen.tsx` (`useChordDraft`), `screens/RespiteScreen.tsx` (`RetuneView`) |
| Tier screen | Generic over the Calling. "Always yours · Bear, and songs sung with your Life". An option can show more than one axis (Blood Font: Endure + Live at low Life). **Blood Font and Low-Life Vigil say what the run's songs mean for them**: "Your songs hold 55% of your Life, so you fight below 50% from the start: Blood Font is on all the time." / "…Low-Life Vigil wakes after you lose 10% of it." | `screens/CallingScreen.tsx`, `screens/callingText.ts` (`belowNote`) |
| HUD: Weaver bar | **Life** is all of her Life on a Martyr run: the usable part filled, what the songs hold hatched in her blood, "236 / 324 ▨396". Notches mark Blood Font and Vigil, with glyphs under the bar, lit while she's below them. The figure turns red with a red ring below 15% of her Life. **Spirit · all free**. The **Thread read-out** shows Bear ("Bear 35%" in her colour, its own glyph) and the **B** key cap on Martyr runs only (lit while Bearing). The **Crescendo read-out** says "**Martyr’s Vow 4s**" in her colours, with its glyph and a ring timed from content | `hud/WeaverBar.tsx`, `hudBridge.ts`, `store.ts` |
| HUD: party frames | **Borne · 35%** on the threaded hero while she Bears, and **Vow · ≥ 1 life** (glowing) on every hero while the Vow holds. Both sit in the frame's status row, so frames don't grow. A threaded frame's border takes Bear's colour, and a call for Empower shows the Bear key first when she's Bearing | `hud/PartyFrames.tsx` |
| HUD: Calling chip | The Martyr's emblem and path pips. The emblem blazes in the Vow, with a "Martyr’s Vow" label. States: **Bear 35%** (while Bearing), **Undying** (ready) or **Undying spent** (struck through), and **Vigil** / **Blood Font** while they're working. The aria label is the whole sentence | `hud/CallingChip.tsx`, `hud/calling.ts` |
| HUD: hints | Key hints add "B · Bear: take part of their wounds" on Martyr runs. Coach hints (from `hints.ts`, each shown at most 3 times): **bear-intro** "{B}: Bear — take part of a big hit on your threaded hero. Your songs hold your Life, not your Spirit". **bear** "{B} Bear — take part of the big hit coming at Kael on yourself" (a big or lethal hit coming at the threaded hero). **bear-back** (Bearing while the threaded hero is hurt and nothing is coming). **vow**. With Bear unbound, the intro points to Settings → Controls and the other Bear hints stay quiet. The first-fight primer names Bear's key on her runs | `hud/hints.ts`, `hud/KeyHints.tsx`, `hud/Hud.tsx`, `hud/HowToPlay.tsx`, `screens/CombatScreen.tsx` |
| Result | The Martyr's line, from `callingBorne` and `callingShielded`: "**Bore 472 for your heroes · 945 kept off them.**" with her drop glyph. The Luminary's line is unchanged | `screens/callingText.ts` (`callingParts`), `screens/resultText.ts` |
| Summary | **The Martyr** panel: two figures ("3,286 damage you bore for your heroes", "6,570 life kept off your heroes") and the path tier by tier. A run where she bore nothing says how to Bear | `screens/SummaryScreen.tsx` |
| Codex | **Callings**: both Callings, each with its own axis legend. Locked Callings show **Rank 8** (by `unlockRank`). The intro says a Calling may change what songs reserve. **The Weaver → Thread** mentions Bear and its key | `screens/CodexScreen.tsx`, `screens/CallingParts.tsx` (`AxisLegend`) |
| Rank 8 | The rank-up card shows the Martyr's emblem on a blood-tinted row. `unlockIcon` gives each Calling its own icon (Luminary `sun`, Martyr `drop`). The Rank panel at the top reads "2,730 XP · the highest Rank for now". The run line at the top Rank no longer says "toward Rank 8" | `screens/rankText.ts`, `screens/Rank.tsx` |
| Settings → Controls | The Bear row renders with the rest ("Bear · The Martyr: take part of the threaded hero’s wounds", key **B**). An unbound Bear (after the lead's `effectiveBindings` fix) shows "Unbound" like any other action | (no change: `screens/ControlsSettings.tsx`) |
| Kit | Eight option glyphs and the `martyr` emblem; `drop`, `bear` and `vow` icons; `callingLook.ts` (the looks, without React) and `callingGlyphs.ts` (the glyph data, without React) | `kit/callingGlyphs.ts`, `kit/callingLook.ts`, `kit/CallingGlyph.tsx`, `kit/iconPaths.ts` |

## The Martyr's look and glyphs

**Blood.** Her accent is a true red (`#e23b3b`), with pale bone for glyphs (`#ffd9cf`) and a venous deep end (`#7f1426`) for gradients and the hatched Life her songs hold. Her emblem ring is a gradient from deep to bone, so it never reads as a relic ring, which is one solid rarity colour.

The test checks the accent against the Luminary's peach and sunlight and against every relic rarity colour, after simulating each colour-vision type: ΔE ≥ 20 in every case. Against the cursed relics' rose and the Luminary's peach it is ≥ 25. She is close to the HUD's *lethal* red by design, so she never appears as colour alone. Every mark of hers carries her glyph (Borne, the Vow, Bear's read-out, the Life notches), and the Weaver bar keeps its own Life pink.

The glyphs share the Calling glyphs' 24×24 grid and 1.8 stroke:

| Glyph | Picture |
|---|---|
| **martyr** | A heart, a drop of its blood falling into cupped hands |
| **penitence** | A drop with the Resonance arc rising round it |
| **scar** | A shield with a stitched scar |
| **font** | A basin with blood welling up |
| **wounds** | Three drops bound together |
| **undying** | A heart with a pulse through it |
| **vigil** | A candle burnt low, still lit |
| **aegis** | A Ward with a second edge over you |
| **covenant** | A chalice |

**Axes** (from the design doc; content has no axis field, so `OPTION_AXES` in `callingText.ts` holds them):

| Axis | Look | Options |
|---|---|---|
| **Endure** | bone `#fcd5b5`, heart glyph | Scarred Hide, Blood Font, Undying Devotion |
| **Share the pain** | rose `#f9a8d4`, bear glyph | Penitence, Shared Wounds, Martyr's Aegis |
| **Live at low Life** | red `#ff6b6b`, drop glyph | Low-Life Vigil, Sanguine Covenant, Blood Font again |

## Prep

| Rank 6: both locked | Rank 7: the Luminary New, the Martyr locked |
|---|---|
| ![](ui/prep-callings-locked.jpg) | ![](ui/prep-martyr-locked.jpg) |

| Rank 8: the Martyr New | Her path |
|---|---|
| ![](ui/prep-martyr-new.jpg) | ![](ui/prep-martyr-path.jpg) |

![The Martyr chosen: the builder below shows her Life budget](ui/prep-martyr-chosen.jpg)

- **At 1280×720 the section fits** above the presets, even at Rank 8 with the "Newly unlocked" strip. With the schedule in the header, a Calling's card is as tall as its passive and Crescendo line.
- The picker is generic: a third Calling would add a third card, and "No Calling" spans its rows (`--rows`).
- **The pool follows the Calling chosen in Prep.** Choosing the Martyr over songs that hold more than 90% keeps the songs, shows the problem and disables Embark ("Fix your songs to embark"). `Run.embark` would reset those songs to the defaults otherwise. Switching back to no Calling hands the run the draft again if Spirit allows it.

## The Life budget

| Guardian on a Martyr run (Blood Font, Vigil on the path) | More than 90%: the sim's problem |
|---|---|
| ![](ui/builder-life.jpg) | ![](ui/builder-life-over.jpg) |

![Retune at a Respite with Blood Font and Low-Life Vigil taken](ui/retune-martyr.jpg)

- Her whole Life is `weaverLifeFor(calling)`: content `maxLife` grown by the Calling's `life` value. Shares come from the sim's `chordReserve`. The test checks both against a real sim's `WeaverComponent.maxLife`, `reservedLife` and `health.maxHp`.
- **Legality agrees with the run.** For every preset, Guardian, the 95% loadout and a 110% loadout × both pools × 2 and 3 field slots × three allowances, `loadoutProblems(...).length === 0` equals `Run.chordsAllowed(chords, allowance, slots, pool)`. At least one loadout is legal for Spirit and refused for Life.

## The tier screen

| Tier I | Tier II: Blood Font says it's always on with Guardian |
|---|---|
| ![](ui/martyr-tier-1.jpg) | ![](ui/martyr-tier-2.jpg) |

| Tier III: when Vigil wakes | Tier IV |
|---|---|
| ![](ui/martyr-tier-3.jpg) | ![](ui/martyr-tier-4.jpg) |

## Map

![The strip's tooltip on a Martyr run](ui/map-martyr.jpg)

The strip, its tooltip and the milestone marks were already generic. They draw her emblem and colours.

## HUD

| A big hit coming: the coach introduces Bear | Bearing for Kael, Blood Font on |
|---|---|
| ![](ui/hud-martyr-coach.jpg) | ![](ui/hud-martyr-bear.jpg) |

| Martyr’s Vow, Undying ready | Low Life: Vigil and Blood Font lit, the figure red |
|---|---|
| ![](ui/hud-martyr-vow.jpg) | ![](ui/hud-martyr-low.jpg) |

| Her Life bar (2×) | The chip in the Vow (2×) |
|---|---|
| ![](ui/hud-martyr-life.png) | ![](ui/hud-martyr-chip.png) |

![Party frames in the Vow: Borne on Kael, every hero held at 1 (2×)](ui/hud-martyr-frames.png)

![In the real app: First Light, Kael threaded, B pressed](ui/real-hud.jpg)

- `buildHudSnapshot` fills the new fields from the sim:
  - `WeaverHud`: `lifeTotal`, `reservedLife`, `pool`, `lifeMarks`, `lastMode`, `bearShare`, `vow`, and `crescendoName`, now the Calling's own.
  - `HeroHud`: `borne` and `vow`.
  - `CallingHud`: `crescendo`, `crescendoName`, `vow`, `bearing`, `bearShare`, `undying` and `lowLife`.
- The marks come from content: each path option with a `below` value is placed at that share of `maxLife`, reserved included, as the sim counts it.
- `hud-martyr-bear-deuteranopia.jpg` shows the same HUD with the deuteranopia palette.

## Result, Summary, Codex, Rank 8

| Result: her line, then the tier | Summary: her path and totals |
|---|---|
| ![](ui/result-martyr.jpg) | ![](ui/summary-martyr.jpg) |

| Codex: both Callings | Codex at Rank 7: the Martyr locked |
|---|---|
| ![](ui/codex-martyr.jpg) | ![](ui/codex-martyr-locked.jpg) |

| Rank 8 | Rank panels at 7 and at the top |
|---|---|
| ![](ui/rank-up-8.jpg) | ![](ui/rank-panels-8.jpg) |

![Settings → Controls: the Bear key](ui/settings-controls-bear.jpg)

## Lab views

The new **Martyr** group:

- **Prep:** `prep-callings-locked` (Rank 6), `prep-martyr-locked` (Rank 7), `prep-martyr-new` (Rank 8), `prep-martyr-chosen` and `prep-martyr-path`. They are interactive: choose, unchoose, edit the songs.
- **Tier screens:** `martyr-tier-1` … `martyr-tier-4` (interactive).
- **Song builder:** `builder-life`, `builder-life-over` and `retune-martyr`.
- **Map:** `map-martyr`.
- **HUD:** `hud-martyr-coach`, `hud-martyr-bear`, `hud-martyr-vow` and `hud-martyr-low`.
- **Result, Summary, Codex, Rank 8:** `result-martyr`, `summary-martyr`, `codex-martyr`, `codex-martyr-locked`, `rank-up-8` and `rank-panels-8`.
- **Settings:** `settings-controls-bear`.

New mock builders in `lab/mock.ts`:

- **Runs:**
  - `martyrRun(opts)`: `luminaryRun` now takes `calling` and `chords`.
  - `martyrOfferRun(tier)`, `martyrResultRun()` and `martyrSummaryRun()`.
  - `prepCallingRun(chosen)` now takes a Calling id.
  - `GUARDIAN_CHORDS`, `OVER_LIFE_CHORDS` (95%) and `MARTYR_PICKS` (one option per axis).
- **HUD:** `mockMartyrSource(path)` and `mockMartyrWeaver(path)` build a real sim to read her Life, what her songs hold and Bear's share. There are four new scenarios: `martyr-coach`, `martyr-bear`, `martyr-vow` and `martyr-low`.
- **Changes to existing mocks:** `fakeOutcome` fills `calling.borne` and `shielded` on a Martyr run.

## Tests and checks

`tests/uiPhase3d.test.ts` has 20 tests:

- **Life budget:**
  - The builder agrees with `Run.chordsAllowed` across loadouts, pools, slots and allowances.
  - The 90% problem sentence, and that Spirit allows the same loadout.
  - The pool follows the Calling in Prep.
  - `weaverLifeFor` and the budget match a real sim; Spirit is all free.
  - `lowLifeMarks` and `belowNote` come from content.
- **HUD (real sim with the Martyr):**
  - Reserved Life, usable Life and all of it; the marks' positions and when they light.
  - **Bear:** the `{ t: 'mode', mode: 'bear' }` command, Borne on the threaded hero only, and right-click back to `lastMode`.
  - **The Vow:** named from content, every hero held, Sunrise untouched; Undying ready, then spent.
  - The Luminary has no Bear, the Spirit pool and Sunrise.
  - The coach's Bear hints appear on Martyr runs only, and so does the Vow hint.
  - The lab mocks read a real sim.
- **Words:**
  - The Result line's exact text (both parts, one part, nothing) and the Luminary's unchanged line.
  - The line sits right after the songs on a Martyr run's Result, and Continue leads to the tier.
  - Summary parts; the Crescendo line; passive names.
  - Every Martyr option has an axis, and each Calling's legend has its own three.
- **Look:** a glyph for every icon. Her accent sits at ΔE ≥ 20 from the Luminary and the relic rarities in all four vision modes.
- **Rank 8:** the unlock's Rank from content, the card's unlock, `unlockIcon` → `drop`, the allowance either side, a refused `setCalling`, and the top-Rank texts.

`e2e/smoke.spec.ts` gains "**Phase 3d: the Martyr**":

1. Skip the unlocks, then `newRun`.
2. Click the Martyr card (`reservePool()` goes `spirit` → `life`); the builder shows `life-budget`.
3. Embark, then `choose()` First Light.
4. Dismiss the primer, checking that it names B.
5. The Weaver bar's `weaver-life` has `data-pool="life"`, and `life-reserved` and the chip are visible.
6. Press 1, then B: `thread-mode` reads `data-mode="bear"` and Kael's frame shows `borne`.

The run hook gains `reservePool()`. Per the brief, I did not run the e2e suite. It typechecks and lints, and I drove the same steps by script against the dev server (Chromium) with no console errors; `real-prep.jpg`, `real-primer.jpg` and `real-hud.jpg` come from that run.

- `npm run typecheck` (all three configs) passes.
- `npx eslint src/ui src/app tests e2e --max-warnings 0` and `npx prettier --check src/ui src/app tests e2e docs/phase-3d` pass.
- `npx vitest run tests/ui*.test.ts tests/appStores.test.ts` passes (130 tests), and so does the full `npx vitest run` (701).
- `npx vite build --outDir /tmp/claude-ui-build` succeeds.

## Screenshots

All are under `ui/` and were taken with Playwright against the lab (`nav=0`, the stage at its design size), at 1280 wide. I looked at every one. The fixes this led to:

- **Prep didn't fit at 720 with two Callings** (the Martyr's card ran under the Embark bar). The repeated pick schedule moved to the header, and the cards' right column shrank to the pips and the button.
- The Martyr's axes' colours were too close (Endure and Live at low Life). Endure is now bone.
- The frames' Bear and Vow marks first took their own row and pushed the column up. They now sit in the status row.

The PNG crops (`hud-martyr-life`, `hud-martyr-chip`, `hud-martyr-frames`) are at 2×.

## Known gaps

- **Martyr's Aegis's barrier on her** isn't shown on the Weaver bar (the bar has no shield overlay). Its moment is a VFX/audio matter.
- **Shared Wounds has no mark on the other heroes' frames.** Only the threaded hero shows Borne.
- **During the Vow, a hero reads LETHAL only if some hit on the board lands after it ends** (the lead's `vowHoldsAt`, below). The HUD doesn't know which heroes that hit is aimed at, so near the end of the Vow it may warn on a hero the late hit will miss.
- **Blood Font's regeneration** shows only as its lit mark, not as a rate.
- **Bear's frame border** is her red, near the HUD's lethal red. It is always paired with the Borne mark and the bear glyph, and lethal frames pulse.
- **The Codex's path preview for a locked Calling** stays in its colours (as for the Luminary in 3c). Only the title card greys.
- **`belowNote` assumes she starts a fight at full usable Life**, as the sim does today.

## Contract notes

I made no changes to `src/sim`, `src/content`, `src/meta`, `src/input` or `src/app/runtime.ts`. What would help:

- **Her Life outside a fight.** The builder computes the Martyr's whole Life as content `maxLife × (1 + values.life / 100)` (`weaverLifeFor`), which mirrors `mods.lifeMult`. The test pins it to a real sim, so a change would be caught, not followed. A pure export such as `weaverPools(calling) → { maxLife, maxSpirit }` would let the builder read it.
- **Callouts for the Martyr's moments.** *Done by the lead:* `src/app/runtime.ts` now says "You bore it with Kael" and "Your Vow held Kael" (in her bone colour) and "Undying Devotion · Untouchable for 3 s · every hero Mended for 30%". `borne` stays without a callout (it's constant). The lab's Vow scenario shows the new wording.
- **The Crescendo's length.** The Vow's ring reads content `values.vow` and so ignores Encore's bonus. Sunrise's ring has always assumed 6 s. A `crescendoTotal` on `WeaverComponent` (or the `crescendoStart` duration kept in state) would make both exact.
- **Lethal while the Vow holds.** *Done by the lead:* the sim exports `vowHoldsAt(state, impact)`. A telegraph that lands while the Vow holds is no longer `'lethal'` to a hero (it still is to the Weaver), and a frame isn't LETHAL while the Vow outlasts every hit on the board. A per-hero "incoming past the Vow" (what would come to her) would still let a frame say "Vow: 640 comes to you".
- **Axes in content.** `OPTION_AXES` now holds six axes for two Callings, and Blood Font sits on two. An `axes` field on each option would replace it.
- **An unbound Bear.** After the lead's `effectiveBindings` fix, an override can leave Bear without a key. The HUD then hides Bear's key cap and points the coach at Settings → Controls. The primer and key hints print the binding label ("—").

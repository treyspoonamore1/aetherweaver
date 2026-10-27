# Phase 4 UI: the Astrolabe

*Owner: the UI workstream (`src/ui/**`). Builds on [Phase 3e's UI](../phase-3e/ui.md). Spec: [docs/phase-4.md](../phase-4.md).*

Everything here can be reviewed without playing: open **`/?lab=ui`** (new sidebar group **Astrolabe**) or `/?lab=ui&view=<id>&nav=0`.

Every number on these screens comes from content (each star's `values` and `astrolabeText`), the Rank (`astrolabePoints`), the run (`Run.reservePool`, `Run.reserveMult`, `RunState.astrolabe`) or the sim (`techniqueCost`, `canPay`, `songReserveOf`, `WorldState.astrolabe`, `HeroComponent.afterglowUntil`, the shields). Nothing is hard-coded, so the lead's retune flows through, and the tests read their numbers from content too. The screenshots show content as it was during this session, before that retune (Clear Voice 10% lighter songs, a Breath 4%, Prism Covenant at 50% of Life, Eldritch Conduit 30% lighter songs).

The Astrolabe is a star map you plan on between runs. The screen is built for two things:

- **Read it at a glance.** Four constellations in their own colours, glyphs and quarters, named round the rim. Lit stars glow; stars you can take have a ring; the rest are dim. Keystones sit in diamonds at the rim, named.
- **Plan on it.** Point at any star: the path to it lights up, marching from your tree, and the tooltip and the side card say what it does and what it costs. One click takes the whole path. The side panel adds up what the tree gives.

## What changed, by screen

| Where | What | Files |
|---|---|---|
| **Astrolabe** (new) | **The star map**, from content: 65 stars and their links in a dial. Each star is sized by its kind (travel small; notables larger with an inner ring; great notables crowned; keystones largest, in a diamond frame) and carries a glyph for what it does. Constellation names arc round the rim ("SILK · THE THREAD · 6 LIT"); keystones and great notables are named by their stars. **States:** yours (lit, glowing), touches your tree (ring), out of reach (dim). **Pointing** (hover or keyboard focus) lights the `pathTo` path: its links march out from your tree and its stars are ringed; a star you own lights what hangs on it instead. **The tooltip** (name, kind, constellation, what it does, the cost or why not) goes by its star wherever it hides none of the lit stars. **The side card** repeats it with **Take · 3 points** or **Give back**. **Click or Enter** takes; when the points don't allow, it says so ("Not enough points: Sanguine Font takes 3 points, you have 2 points left."), the star shakes and `cantAfford` sounds. **Right-click, Delete or Backspace** gives back, only if `canRefund`; else "Something you've taken hangs on it: Gilding and Afterglow. Give those back first." **Respec** asks first. **The points**: "3 points to spend · 0 of 3 points" with a pip per point. **Over budget** (Skip the unlocks turned off): a warning that embarking keeps the nearest, and the stars it would leave dashed on the map. **"What your tree adds up to"**: totals by constellation ("Mend +10%  Empower +18%"), each keystone with its price, the notables that add a rule by name. **Keys**: Tab and arrows move, Enter takes, Delete gives back, Esc goes back (to the Title, or to Prep when opened from Prep) | `screens/AstrolabeScreen.tsx`, `screens/AstrolabeMap.tsx`, `screens/astrolabeModel.ts`, `screens/astrolabeActions.ts`, `screens/AstrolabeParts.tsx`, `app/App.tsx` |
| Title | An **Astrolabe** item once it's open (Rank 4, or Skip the unlocks), with "5 points to spend" while there are points left. The Rank panel's "Rank 13 opens" says "+1 Astrolabe point (12 in all)." | `screens/TitleScreen.tsx`, `screens/rankText.ts`, `screens/Rank.tsx` |
| Prep | An **Astrolabe** button by the Rank with what's left ("3 points to spend", "19/19", "8 points over"), and a chip for each keystone the run will take (its tooltip: what it gives and its price). Prep's blurb says what pays for what: "With Sanguine Font, your auras reserve Life instead…", "With Eldritch Conduit, Ward, Chime and Reel cost Life instead: your Spirit is your songs' alone." The song builder takes `Run.reservePool(run)` and `Run.reserveMult(run)` | `screens/PrepScreen.tsx`, `screens/AstrolabeParts.tsx`, `screens/chordModel.ts` (`poolBlurb`) |
| Song builder (Prep, Retune, the lab) | **It accepts exactly what the run accepts**: `loadoutProblems` and `spiritBudget` take the tree's multiplier and pool. The budget names the Astrolabe's share ("−18% from the Astrolabe", its tooltip naming the stars), and each aura's "reserves N%" is what the fight will hold. **Sanguine Font** gives any run the Martyr's Life budget ("Life budget · your songs reserve Life, not Spirit · −33% from the Astrolabe", "You fight with 250 Life of 396", "All 100 Spirit is free"). **Eldritch Conduit**: "Your techniques cost Life: ✓ Ward 18.4 ✓ Chime 13.8 ✓ Reel 23" in Life's colour. **Prism Covenant**: the Life budget marks the half she fights at | `screens/ChordBuilder.tsx`, `screens/chordModel.ts`, `screens/RespiteScreen.tsx` |
| Training Grounds | The fight takes the profile's tree, pruned to the points you have (`pruneTree`) | `screens/TrainingScreen.tsx` |
| HUD: Weaver bar | **Technique costs are the sim's** (`techniqueCost`, `canPay`): the Economy's cheaper Spirit, and with Eldritch Conduit a heart and Life's colour ("♡ 18.4"), dimmed when Life can't pay. **Prism Covenant** marks its cap on the Life bar ("≤180" with its glyph, the bar hatched above it). **Sanguine Font**: the songs' share of Life hatched on the Life bar, "Spirit · all free" | `hud/WeaverBar.tsx`, `hudBridge.ts` |
| HUD: party frames | **Afterglow**: "Afterglow 2.3 s" with a ring, on a hero the Thread left while Empowering. **Overflowing Grace**: "Grace +193" with the keystone's glyph, and the shield on the life bar like any other | `hud/PartyFrames.tsx`, `hudBridge.ts` |
| HUD: keystones | A small chip of keystone badges beside the Calling chip, each with its tooltip (what it gives, its price) | `hud/KeystoneChip.tsx`, `hud/Hud.tsx` |
| Callouts | A technique refused for Life (`techniqueRejected { reason: 'life' }`): "**Ward: not enough Life** · your techniques cost Life, and never your last", on its slot's buzz | `src/app/runtime.ts` (`callouts` only) |
| Rank-ups | **Rank 4**: the Astrolabe's row, "It opens with 3 points to spend. Open it from the Title or from Prep." **Every Rank after**: "+1 Astrolabe point (10 in all)." with the Weaver's Star | `screens/rankText.ts`, `screens/Rank.tsx` |
| Summary | **Your Astrolabe**: the run's tree as a small map, its keystones as chips, its totals, its notables, "19 points in the tree" | `screens/SummaryScreen.tsx` |
| Codex | **The Astrolabe** tab: what it is and how it works (from Rank 4 with 3 points, 19 at Rank 20, of 65 stars, all from code), the four kinds, each constellation with its stars, notables, keystones and great notables | `screens/CodexScreen.tsx` |
| Kit | Constellation looks, the Astrolabe's glyphs, `AstrolabeGlyph` and `KeystoneBadge` | `kit/astrolabeLook.ts`, `kit/astrolabeGlyphs.ts`, `kit/AstrolabeGlyph.tsx` |
| Store | `Screen` gains `'astrolabe'`. `HeroHud.afterglow` and `grace`, `TechniqueHud.pool`, `WeaverHud.lifeCap`, `HudSnapshot.astrolabe` | `store.ts` |

## The constellations' look and glyphs

| Constellation | Colour | Glyph | Quarter |
|---|---|---|---|
| **Silk** · the Thread | gold `#f6c655` | a spindle wound with thread | north |
| **Choir** · the songs | violet `#a886f9` | three voices rising | east |
| **Aegis** · the techniques | ice `#8fdfef` | a Ward with an inner edge | west |
| **Bond** · the heroes | coral `#f7726e` | three heroes, shoulder to shoulder | south |

Each has a light and a deep shade for glows and lit stars; the centre and the bridges are starlight (`#fde9b8`), and a bridge's stroke blends its two constellations. The four colours stay apart in every colour-vision mode (CIE76 after Machado's simulation): the closest pair is ΔE 59.6 in normal vision (Silk and Bond), 41.2 with protanopia (Aegis and Bond), **32.7 with deuteranopia** (Silk and Bond) and 39.2 with tritanopia (Silk and Choir). The motif colours fail this (4.2), so the Astrolabe has its own. Colour is never alone: each constellation has its quarter, its name round the rim and its glyph.

| Deuteranopia (simulated) | Protanopia | Tritanopia |
|---|---|---|
| ![](ui/astrolabe-deuteranopia.jpg) | ![](ui/astrolabe-protanopia.jpg) | ![](ui/astrolabe-tritanopia.jpg) |

New glyphs, on the kit's 24×24 grid: the **Weaver's Star** (a four-pointed star in a ring), the four constellations, the six keystones (**Overflowing Grace**: Mend's cross in a Ward, spilling over; **Sanguine Font**: a note that is a drop of blood; **Prism Covenant**: light split by a prism; **Unbroken Chorus**: a field ring no Mute cracks; **Shatterproof Halo**: a Ward under a halo, its crack stopping halfway; **Eldritch Conduit**: a drop of Life with Spirit's lightning) and the two great notables (**Second Wind**, **Ensemble**). Every other star borrows the kit icon for what it does (`starGlyph`: Mend's cross, the bell, the heart…).

## The Astrolabe screen

| Rank 4: 3 points, nothing taken | Pointing at Spun Silver: the path and its price |
|---|---|
| ![](ui/astrolabe-rank4.jpg) | ![](ui/astrolabe-rank4-path.jpg) |

| Rank 12: a Blood two stars out | Sanguine Font: more than the points left |
|---|---|
| ![](ui/astrolabe-rank12.jpg) | ![](ui/astrolabe-short.jpg) |

| Spun Silver can't go back: what hangs on it | Clear Voice can go back |
|---|---|
| ![](ui/astrolabe-held.jpg) | ![](ui/astrolabe-mine.jpg) |

| Rank 20: every point spent, Prism Covenant | Two keystones: each with its price |
|---|---|
| ![](ui/astrolabe-rank20.jpg) | ![](ui/astrolabe-keystones.jpg) |

| Over budget: embarking keeps the nearest | Respec |
|---|---|
| ![](ui/astrolabe-over.jpg) | ![](ui/astrolabe-respec.jpg) |

| In the real app: Prism Covenant from an empty tree, 9 points | After the click |
|---|---|
| ![](ui/real-keystone-path.jpg) | ![](ui/real-taken.jpg) |

- **The moves are meta's, through the profile store** (`takeStar`, `giveBackStar` and `respecStars` in `astrolabeActions.ts` call its `takeNode`, `giveBack` and `respecTree`). The map reads `pathTo`, `canRefund` and `neighbours`, so it can't disagree with them.
- **It fits 1280×720**: the map is a square as tall as the screen allows; the side panel is 456 px.
- **Where the tooltip goes** (`tipPlacement`): beside, above or below its star, a step farther out if the path runs close by, or parked in a corner of the map's column. It picks the place that hides the fewest lit stars (the path, what hangs on it), then the fewest of your tree, then the fewest others, and it never leaves the screen. It may reach a little past the map's column to keep the path in sight.
- **The keyboard** starts on the Weaver's Star. The arrows move to the nearest star that way (weighted to the direction and to linked stars, so every star can be reached), Tab walks them in order, and a focused star shows its tooltip once the keyboard is in use. The Escape key goes back; the Respec dialog closes itself first.
- **Sounds** through `playUi`: `starHover` when pointing (at most every 70 ms), `starTake`, `starNotable`, `starPath` or `starKeystone` by what a take took, `starRefund`, `starRespec`, `cantAfford` (not enough points) and `error` (something hangs on it). The rank-up card plays `rankUp` and `unlock` as before.
- **With a run under way** (from the Title mid-run), a note says the run keeps the tree it embarked with.
- **Reduced motion**: the marching links and pulses stop (the app's rule), and a refused star doesn't shake.

## Prep, the song builder, the Title

| Prep: the Astrolabe button and the run's keystones | Prep at Rank 4: the Astrolabe new, 3 points |
|---|---|
| ![](ui/prep-astrolabe.jpg) | ![](ui/prep-astrolabe-spend.jpg) |

| Clear Voice and the Breaths let heavier songs in | Sanguine Font: the Life budget without the Martyr |
|---|---|
| ![](ui/builder-astrolabe.jpg) | ![](ui/builder-sanguine.jpg) |

| Eldritch Conduit: techniques in Life | Title at Rank 12 |
|---|---|
| ![](ui/builder-conduit.jpg) | ![](ui/title-astrolabe.jpg) |

| Prep's header (2×) | The builder's share (2×) |
|---|---|
| ![](ui/prep-header.png) | ![](ui/builder-share.png) |

| In the real app: the Title with Skip the unlocks | Prep after taking Prism Covenant |
|---|---|
| ![](ui/real-title.jpg) | ![](ui/real-prep-keystone.jpg) |

- **The builder's legality is the run's.** The test walks every loadout of two auras a song, and a few others, against five trees and three Callings: `loadoutProblems` is empty exactly when `Run.chordsAllowed` is true. The two cases from the review: songs over all of Spirit that Clear Voice and the Breaths let in (found from content: `heavierSongs`), and Sanguine Font with four auras at all of Spirit (two-thirds of it in Life).
- **The budget is what the fight holds.** For each tree and Calling the test builds the sim and compares: the pool, its maximum, what's reserved, the Life she fights with, the cap, and each technique's cost (`techniqueCost`).
- Prep's header became two rows (Rank and Title; the Astrolabe button with the keystones under it), so the Callings still fit above Embark.

## HUD

| Eldritch Conduit and Prism Covenant: a technique refused for Life | Afterglow on Kael |
|---|---|
| ![](ui/hud-astro-conduit.jpg) | ![](ui/hud-astro-afterglow.jpg) |

| Overflowing Grace's shield on Kael | Sanguine Font: the songs hold Life |
|---|---|
| ![](ui/hud-astro-grace.jpg) | ![](ui/hud-astro-sanguine.jpg) |

| The Weaver bar with Eldritch Conduit and Prism's cap (2×) | Sanguine Font's bar (2×) |
|---|---|
| ![](ui/hud-conduit-bar.png) | ![](ui/hud-sanguine-bar.png) |

| Afterglow (2×) | Grace (2×) | The keystone chip's tooltip (2×) |
|---|---|---|
| ![](ui/hud-afterglow-frame.png) | ![](ui/hud-grace-frame.png) | ![](ui/hud-keystone-chip.png) |

- `buildHudSnapshot` fills the new fields from the sim:
  - `TechniqueHud`: `cost` and `affordable` from `techniqueCost` and `canPay`, `pool` (`spirit` or `life`), `baseCost` with the tree's `techCostMult`.
  - `WeaverHud`: `pool` from `reservePool(calling, CONTENT, tree)`; `lifeCap` (`maxHp × lifeCapPct`) under Prism Covenant; each aura's reserve × the tree's multiplier.
  - `HeroHud`: `afterglow` (`afterglowUntil − time`, while the Thread isn't Empowering them) and `grace` (the shield's amount, time left and cap). `bleedOutMax` × Grit's multiplier.
  - `HudSnapshot.astrolabe`: the number of stars and the keystones.
- **A Chronomancer's Rewind** is ready only when Life can pay it (`canPay`), under Eldritch Conduit.

## Rank-ups, Summary, Codex

| Rank 4 | Ranks 11 and 12 |
|---|---|
| ![](ui/rank-up-4.jpg) | ![](ui/rank-up-11-12.jpg) |

| Rank panels at 3 and 12 | Codex: the Astrolabe |
|---|---|
| ![](ui/rank-panels-astrolabe.jpg) | ![](ui/codex-astrolabe.jpg) |

![Summary: the run's tree in brief](ui/summary-astrolabe.jpg)

## Lab views

The new **Astrolabe** group:

- **The screen** (interactive: take, give back, respec): `astrolabe-rank4`, `astrolabe-rank4-path`, `astrolabe-rank12`, `astrolabe-short`, `astrolabe-held`, `astrolabe-mine`, `astrolabe-rank20`, `astrolabe-keystones`, `astrolabe-over` and `astrolabe-respec`.
- **HUD, real sims:** `hud-astro-conduit`, `hud-astro-afterglow`, `hud-astro-grace` and `hud-astro-sanguine`.
- **The builder:** `builder-astrolabe`, `builder-sanguine` and `builder-conduit`.
- **Prep, Title, Ranks, Summary, Codex:** `prep-astrolabe`, `prep-astrolabe-spend`, `title-astrolabe`, `rank-up-4`, `rank-up-11-12`, `rank-panels-astrolabe`, `summary-astrolabe` and `codex-astrolabe`.

**The HUD views are real sims** (`astroStage(scenario)` in `lab/mock.ts`), each with a tree (`astrolabe: [...]` in its config), staged with debug commands and stepped until it shows its moment: techniques cast in Life until one is refused (Conduit, with Prism); the Thread moved off an Empowered Kael, a quarter of Afterglow gone; Mend on a full Kael until Grace's shield holds a good share of its cap; Sanguine Font's songs holding Life. Thresholds come from content. The callouts are the runtime's words. Each is cached.

New mock data: the trees `RANK12_TREE`, `RANK20_TREE`, `KEYSTONE_TREE`, `AFTERGLOW_TREE`, `GRACE_TREE` and `SANGUINE_TREE`; `LIGHT_TREE` (every star that lightens the songs, with the way to it, from content) and `heavierSongs(tree)` (the heaviest songs a tree lets in that nothing else would).

## Tests and checks

`tests/uiPhase4.test.ts` has 27 tests:

- **The map:** every star inside the dial, sized by kind, with a glyph (keystones and great notables their own); each bridge joins its two constellations. Owned, takeable or far, by `neighbours`. The arrows reach all 65 stars from the centre.
- **Pointing:** the preview is `pathTo` for every star, tree and point count; its cost the path's length; take or short by the points. The marching links run from a star you own to the target. What hangs on a star is exactly what `canRefund` refuses. The lines (cost, why not, what hangs) and each take's sound.
- **The tooltip** (`tipPlacement`): for every star, tree and three heights, at 1280×720's measures, it covers no star of the path or what hangs on it, never leaves the screen, and reaches at most 24 px past the map's column.
- **The store:** take a path, refuse when short, refuse the trunk, give back the end, respec, at Rank 4. With Skip the unlocks: two keystones' paths; the run in Prep follows the tree, and the first fight's `combatConfig()` carries it.
- **The totals:** each is the sum of its stars' content values, for eight trees; they are the sim's multipliers (`mendMult`, `empowerMult`, `auraEffectMult`, `threadRangeBonus`, `songReserveOf`). Every star in content shows somewhere: a stat with its line, a rule by name, or a keystone. Each keystone's text splits into what it gives and its price, every sentence once.
- **The HUD from real sims:** costs, pools and `affordable` equal `techniqueCost` and `canPay` with the Economy and with Eldritch Conduit; low on Life, the cheapest technique can be paid and the dearest can't, and the sim refuses it with `'life'`. Rewind's readiness. Prism's cap on the bar (and Life never above it after 600 ticks). Sanguine Font's pool and Life held. Afterglow's time and total, Grace's amount and cap, the keystones; every lab scene reaches its moment, and the Conduit scene's callout is the runtime's.
- **The builder:** legality equals `Run.chordsAllowed` for every two-aura loadout × five trees × three Callings; the heavier songs and Sanguine Font cases; the budget against the sim for five trees and Callings; the tree's own numbers (`treeLifeMult`, `treeTechCostMult`, `treeTechniquesCostLife`, `treeBleedOutMult`, `treeAfterglow`) against the sim's mods for eight trees; `poolBlurb`; every preset legal with every tree.
- **Ranks:** none before 4; Rank 4's line; "+1 Astrolabe point (N in all)." for every Rank after; the unlock on the card; the panels' next lines. `spendLine`.
- **Colours:** the four ΔE ≥ 20 in every colour-vision mode, each with a glyph and a name, and every constellation in content has its look.

`e2e/smoke.spec.ts` gains "**Phase 4: the Astrolabe — from Prep, take, give back, respec, a keystone's path, embark with it**":

1. Skip the unlocks, then `newRun`. Prep's button says "19 points to spend"; it opens the Astrolabe.
2. Click Spun Silver: the tree is its path, the points drop by three, and the run in Prep follows.
3. Right-click the trunk: refused. Right-click Spun Silver: given back.
4. Respec, confirmed: empty.
5. Point at Prism Covenant: the tooltip says take, and its cost; click; the tree is that many stars, the keystone last, and the side panel names it.
6. Escape back to Prep: the button's points and the keystone chip.
7. Embark and choose a skirmish: the first fight's `exportReplay().config.astrolabe` is the tree (sorted), and the HUD's keystone chip shows.

The test hook gains `astrolabe()` (the profile's tree, its points, the run's tree). Per the brief, I did not run the e2e suite. It typechecks and lints, and I drove the same steps by script against the dev server (Chromium with SwiftShader, with and without tracing as the e2e config records): all passed, with no console errors. That run found that a star's `data-star` is also on its tooltip and side card, so the e2e looks for stars inside the map.

- `npm run typecheck` (all three configs) passes.
- `npx eslint src/ui src/app tests e2e --max-warnings 0` and `npx prettier --check src/ui src/app tests/uiPhase4.test.ts e2e` pass.
- The full `npx vitest run` passes (47 files, 986 tests, with the other workstreams' tests).
- `npx vite build --outDir /tmp/claude-ui4-build` succeeds.

## Screenshots

All are under `ui/`, taken with Playwright against the lab (`nav=0`) at 1280 wide, except `real-*.jpg` (the real app on the dev server, driven through the run hook). The PNG crops are at 2×. The colour-vision shots run the page through Machado's matrices as an SVG filter. I looked at every one. The fixes this led to:

- **The tooltip hid the path it previewed.** Pointing at a keystone on the right (Prism Covenant) flipped the tooltip left, over the whole Choir trunk. It now goes wherever it hides none of the lit stars (`tipPlacement`, tested for every star).
- **The map was small**: a wide view box in a square box. The view box is square now.
- **Arrow keys couldn't reach the bridges.** The pick weighs the direction more and prefers linked stars; a test walks all 65.
- **Prep's header wrapped** and pushed the Callings past 720. It's two rows now, with a small Astrolabe button.
- **The Title's badge wrapped** ("3 points to / spend"). The menu is wider and the badge doesn't wrap.
- **The legend's "Right-click" key wrapped** in two. The key column takes its width now.
- **"Afterglow 2.3  s"** had a wide gap (a monospace space). It's in tabular figures now.
- **The Codex's constellation cards** sat three and one. They're two by two.
- **A focused star showed its tooltip on arrival.** Focus shows it only once the keyboard is in use.
- **The Conduit scene never refused for Life**: Sostenuto healed the Weaver as fast as she spent. The scene sings Fortissimo and Allegro.
- **Rank-up shots caught the card mid-animation.** They wait for it.
- **"Every constellation's first notable is three points from the centre"** was written in. It's counted from the map now.

## Known gaps

- **The tooltip may reach past the map's column** (at most 14 px at 1280×720 in the test's sweep) or over the rim's names, to keep the path in sight. In a much narrower window it may cover part of the path.
- **Unlit stars are close in colour under deuteranopia and protanopia.** The four colours pass ΔE ≥ 20 (32.7 at the closest), but dim stars bring them closer; each constellation's quarter, rim name and glyph carry it.
- **The arrows are spatial**: the nearest star that way. Some stars take a detour (every one is reachable).
- **Grace's shield** is the one the sim marks `grace` once that lands (the review's fix); until then, the Weaver's overshield while Overflowing Grace is in the tree. Overflowing Grace has no callout of its own: the frame's "Grace +193" shows it.
- **The screen is heavy for software GL.** A full-page screenshot under SwiftShader takes about 14 s (the frame rate is fine, 56–58 fps). In my scripted run, clicks in the Respec dialog after such screenshots were reported "not stable"; without screenshots, and with the e2e's tracing, they weren't.
- **The Astrolabe isn't closed mid-run**: from the Title with a run under way it opens, with a note that the run keeps its tree.

## Contract notes

I made no changes to `src/sim`, `src/content`, `src/meta`, `src/bots` or `src/input`. Outside `src/ui` I changed only `src/app/App.tsx` (the route), the `callouts` method of `src/app/runtime.ts` (`'life'`), `src/app/testHook*.ts` (`astrolabe()`), `e2e/smoke.spec.ts` and `tests/uiPhase4.test.ts`. What would help:

- **Constellation names in content.** "Silk · the Thread" and the others live in `kit/astrolabeLook.ts`; a `constellations` table (name, what it's about) would replace them.
- **A keystone's price in content.** The UI splits each keystone's text into what it gives and its price by sentence (`KEYSTONE_PRICE` in `astrolabeModel.ts`: Shatterproof Halo's price is its last sentence, Prism Covenant's its first). A `price` text (or `gains` and `prices`) would replace it. The new Shatterproof Halo wording keeps its price last, so it splits as before.
- **The tree's numbers from the sim.** The builder needs them before a fight exists, so `treeLifeMult` (Blood), `treeTechCostMult` (the Economy), `treeTechniquesCostLife`, `treeLifeCap` (Prism), `treeBleedOutMult` (Grit) and `treeAfterglow` mirror the resolver, and the tests pin each to `worldOf(sim).mods` for eight trees. A pure `treeMods(nodes)` export would replace them. `BLEED_OUT` (12 s) is still the HUD's own, as before Phase 4.
- **Grace's shield.** When `Shield.grace` lands, the HUD can drop its fallback (one line in `hudBridge.ts`).
- **Auras: numbers only.** No aura's look or text changed. The builder's aura cards and the HUD's aura chips say "reserves N%" with the tree's lighter share in it, as they already did with Grace Note's; nothing else about them changed.

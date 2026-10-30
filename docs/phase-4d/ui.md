# Phase 4d UI: Dissonance

*Owner: the UI workstream (`src/ui/**`). Builds on [Phase 4c's UI](../phase-4c/ui.md). Spec: [docs/phase-4d.md](../phase-4d.md).*

Everything here can be reviewed without playing: open **`/?lab=ui`** (new sidebar group **Dissonance**) or `/?lab=ui&view=<id>&nav=0`.

Every name, number and odd on these screens comes from content (`CONTENT.dissonance`, `dissonanceText`, `CONTENT.dissonanceRules`, `CONTENT.reliquary.bands`) or meta (`fitLevels`, `dissonancePoints`, `maxDissonance`, `xpMult`, `shardsMult`, `tearsFor`, `bestKey`, `opensAt`, `parMult`, `band`, `nextBandDepth`, `craftBlocked`, `craftOdds`, and the review's `playedDissonance`, `restHeal`, `skipHeal`). The points were tuned while this was built (Brisk Foes, Muted Choir and Unforgiving 2 → 1, Short Fuse 3 → 1 a rank, Elite Vanguard and Restless Dead 3 → 5; at most 33 → 30) and Wounding Strikes' text changed: all of it came through with no change to a screen. The lab's "about 10" and "about 20" choices are built from content's points too (`mockDissonance`), so they land on the bands whatever the tuning. The only words not from content are the three levels still to come (Tyrant, Mimicry, True Dissonance), named on the Codex's page as the spec asks, and the grade that also pays a Tear from 10 points (meta's `tearsFor` names it `'A'`; a test pins the screen's rules to `tearsFor`).

The decision the screens are built around: **how hard, for how much?** So the choice in Prep shows, as it's made, what the total pays, the Tears it opens, how far the relics it finds will craft and what a new best would take; the fight says what's in force; the Summary says what it paid and what it set.

## What changed, by screen

| Where | What | Files |
|---|---|---|
| **Prep: Dissonance** (new panel, after the Calling picker) | **Every level** as a switch (`role="switch"`): its name, its points ("1 point", "3 points a rank"), its text (`dissonanceText`); taken, what it adds ("+6"). A level with ranks has a **stepper** (−, its ranks as diamonds and "2/2", +; − at rank 1 turns it off; the ends are `aria-disabled`, a click there says no). **The summary** beside them: the run's total out of `maxDissonance()` on a bar marked where relics reach further ("10·T2", "20·T1"); **It pays**: "+30% Weaver XP", "+40% Tuning Shards" (`xpMult`, `shardsMult`), and the three Tear rules (the S always; an A from 10; one more per won run from 20), each lit or locked at this total; **The relics it finds**: "Relics found here can reach T2. From 20 points, T1." (`band`, `nextBandDepth`); **Your best** for the chosen Calling ("Best won as the Luminary: 8.") and what a new best takes ("A win at 10 would be a new best (+2)." / "A new best takes 23 or more: this run is at 20."); **Clear**. A Discordant Pact with nothing to give (the run carries every cursed relic) stays on but adds nothing: "Nothing to give: you carry every cursed relic." The total and everything it means come from `playedDissonance(run)`. The Embark bar shows "Dissonance 10". A live region says each new total. **Closed**: one line that says what it is and how it opens ("It opens with your first win at Rank 15 or above (you’re Rank 12). Settings → Skip the unlocks opens it now."; at Rank 15+: "your next win does it") | `screens/DissonanceParts.tsx`, `screens/dissonanceModel.ts`, `screens/PrepScreen.tsx` |
| **Choosing** | A switch or a step calls the panel's `onChange`: in the app, `useProfile.getState().setDissonance(levels)`, and the run in Prep follows the profile (the run store's subscription). Each change plays the audio workstream's `dissonanceToggle` with the new and old totals | `screens/PrepScreen.tsx`, `kit/sound.ts` |
| **Summary** | **Dissonance opens** (when `run.dissonanceEnd.opened`): a card with its disc, what it is, how to choose, what a point pays and the Tear rules, and "Relics remember: a relic won at 10 or more can reach T2, at 20 or more T1." **The run's Dissonance** (a run with points): "Dissonance 12", what it paid ("+36% Weaver XP", "+48% Tuning Shards"), its levels as chips (ranks, points, text on hover), "The relics it found remember its 12: they can reach T2.", and the **new best** mark ("A new best as the Luminary: 14.") when `run.dissonanceEnd.best`. Opening plays `dissonanceOpen`, a best `dissonanceBest`: once, after the rank-up card | `screens/DissonanceParts.tsx`, `screens/SummaryScreen.tsx` |
| **Summary: Enshrine** | Above the options: "Depth 12 · reaches T2 — Won at 12 Dissonance: its Inscriptions can reach T2." The relic as it arrived wears its depth chip and line. The lab's enshrine passes the run's points, as the run store does | `screens/ReliquarySummary.tsx`, `lab/UiLab.tsx` |
| **HUD: the readout** | Beside the Calling and keystone chips: the Dissonance glyph and its points ("20"), an eye struck through under Blind Score. On hover or focus: each level on a line (name, ranks, "+6", its text), then what Blind Score means here and "A Cue costs 35 Resonance this fight." The top-left group now sits above the party frames' barks, so the tooltip is never under one | `hud/DissonanceChip.tsx`, `hud/Hud.tsx`, `hudBridge.ts`, `store.ts` |
| **HUD: the Cue's cost** | `WeaverHud.cueCost` is the fight's (`WorldState.dissonance.cueCost`). The Resonance arc marks each multiple of it with a pink tick and says "♫ Cue 35" inside the arc (and in its accessible value) when it isn't one segment; the Cue hint waits for the real cost and says it ("costs 35 Resonance"); the first-fight primer says it too | `hud/WeaverBar.tsx`, `hud/hints.ts`, `hud/HowToPlay.tsx`, `screens/CombatScreen.tsx` |
| **HUD: Blind Score** | Nothing on the HUD names the answer a telegraph wants: the coach hints that do (`ANSWER_HINTS`: Ward the lethal or big hit, Reel or Rewind them out, Chime the mark, the boss cast's answer) are dropped, the rest stay; the boss bar's "Answer:" shows an eye struck through and "Blind Score" instead of the answers' glyphs; a status's tooltip keeps what it does and drops its answer ("Dirge: Marked: detonates when it runs out."); a decree keeps its first sentence, what's coming ("Every hero will lose 90% of their life."), not how to answer it. The in-world glyphs are the VFX workstream's | `hud/hints.ts`, `hud/BossBar.tsx`, `hud/Callouts.tsx`, `hud/PartyFrames.tsx`, `hud/StatusBadge.tsx`, `hud/labels.ts` |
| **HUD and Map: the par** | The encounter header's par and the map's "par 1:30" are the run's: Dissonance's extra life lengthens them (`parMult`), as the Result grades with | `hudBridge.ts`, `screens/MapScreen.tsx` |
| **The Reliquary** | **The shelf**: a relic won deeper wears its depth in a corner ("◈12"), in the colour of the best tier it opens (T3 gold, T2 ember, T1 starlight). **The detail**: a chip, "Depth 12 · reaches T2", and its line: "Won at 12 Dissonance: its Inscriptions can reach T2. A relic won at 20 or more reaches T1." (depth 0: "Won without Dissonance: its Inscriptions reach T3. A relic won at 10 or more reaches T2; at 20 or more T1.") **Ascend**: its blurb says how far this relic goes ("as far as T2"); a locked Inscription's reason (`craftBlocked`) is on a line of its own under its name ("T1 waits for a relic won at 20 Dissonance or more.", "It’s at T1, the best there is."). **Dissonate**'s Cursed outcome says the band's reach ("as far as T1"). Inscribe's odds already followed the band | `screens/ReliquaryScreen.tsx`, `screens/reliquaryModel.ts`, `screens/DissonanceParts.tsx` |
| **Codex: Dissonance** (new tab) | Locked until it opens (a lock on the tab; the unlock's text, "It opens with your first win at Rank 15 or above (you’re Rank 12)", Skip the unlocks). Open: what it is, choosing, opening, relics remember; **your best by Calling** (no Calling, then each Calling); **the levels** (what each does, ranks, points, at most; the total); "Still to come, with new bosses and affixes: Tyrant (…), Mimicry (…) and True Dissonance (…)"; **what it pays** (per point, the Tear rules, and a table at 10, 20 and the most); **the bands** (depth, Ascend's reach, Inscribe's odds T5…T1, how far Cursed raises) | `screens/DissonanceCodex.tsx`, `screens/CodexScreen.tsx` |
| **Codex: the Reliquary** | Its texts follow the bands: Ascend's ladder runs to T1 with the depth each rise needs ("T3 → T2 35% (won at 10+)"); Inscribe's deeper odds; a Cursed relic's reach; the Inscriptions' T2 and T1 say which depth reaches them; the materials mention Dissonance's shards and Tears | `screens/ReliquaryCodex.tsx`, `screens/reliquaryModel.ts` |
| **Ranks** | The unlock has its icon (`UNLOCK_ICON.dissonance`), a lit disc in the discord pink on the rank-up card and a line under its text: "Once your win at Rank 15 or above opens it, choose its levels in Prep: each point pays +3% Weaver XP and +4% Tuning Shards. Settings → Skip the unlocks opens it now." (The unlock's own text already says a win at its Rank opens it.) The Rank panel and the Codex's Rank list show the icon | `screens/rankText.ts`, `screens/Rank.tsx` |
| **Result** | A fight's XP lines add up again: "Dissonance 10 · +30%  +58" after the others | `screens/rankText.ts`, `screens/Rank.tsx`, `screens/ResultScreen.tsx` |
| **Respite, Draft** (the review's fixes) | Under Unforgiving, Rest says it only steadies the Shaken and its bars preview no healing (`restHeal`); a Meditate draft's Skip says it heals nothing (`skipHeal`). The level's name is content's | `screens/RespiteScreen.tsx`, `screens/DraftScreen.tsx` |
| **The Pact's relic** | `OwnedRelic.pact`: its tooltip on the run strip says "From Discordant Pact: the run’s Dissonance imposed it, so it can’t be enshrined.", and the Summary's relics list gives it a chip | `screens/RelicCard.tsx`, `screens/SummaryScreen.tsx` |
| Settings | Reset progress warns that Dissonance (its levels and records) is cleared too | `screens/SettingsScreen.tsx` |
| Test hook | `dissonance()`: open, the profile's levels and bests, the run's levels, points and end; `reliquary()` relics now carry their `depth` | `app/testHook.ts`, `app/testHookTypes.ts` |

## Prep

| Closed (Rank 12) | Open, nothing chosen |
|---|---|
| ![](ui/prep-dissonance-closed.jpg) | ![](ui/prep-dissonance-open.jpg) |

| About 10: the first band, a new best for the Luminary | About 20: T1, below the best |
|---|---|
| ![](ui/prep-dissonance-10.jpg) | ![](ui/prep-dissonance-20.jpg) |

| Every level at its top rank | Discordant Pact with nothing to give |
|---|---|
| ![](ui/prep-dissonance-max.jpg) | ![](ui/prep-dissonance-pact.jpg) |

![Closed at Rank 16: the next win opens it](ui/prep-dissonance-closed-16.jpg)

| The summary (2×) | A level with ranks (2×) |
|---|---|
| ![](ui/prep-summary.png) | ![](ui/prep-level.png) |

- **The panel's numbers are the meta's.** The total is `dissonancePoints(playedDissonance(run))`; each level's "+N" is `dissonancePoints` of it alone, so they add up to the total; the rewards are `xpMult` and `shardsMult` shown to a tenth of a percent; the Tear rules are the content's thresholds, lit when the total reaches them; the reach is `band(total).tierCap`, the next band `nextBandDepth`. The test checks every total from 0 to the most.
- **What the profile keeps is what the panel asks for.** `toggleLevel` and `withRank` return what `fitLevels` would (content order, one of each, ranks clamped); the store's `setDissonance` keeps them as they are, and the run in Prep follows.
- **A new best** is the store's own rule: more points than the best for the Calling (`bestKey`), and more than 0.
- **It fits.** Three columns of levels and the summary beside them at 1280; two columns, then one, narrower. The panel sits after the Calling picker because "your best" is the chosen Calling's.

## The Summary

| The win that opened it (Rank 15) | A new best as the Luminary |
|---|---|
| ![](ui/summary-dissonance-opened.jpg) | ![](ui/summary-dissonance-best.jpg) |

| Enshrine at its depth | Enshrined: its depth and what it reaches |
|---|---|
| ![](ui/summary-dissonance-enshrine.jpg) | ![](ui/summary-dissonance-enshrined.jpg) |

- **The card and the mark read `run.dissonanceEnd`**, which the run store sets at the run's end; the levels and points are `run.dissonance`, frozen at embark. A run with no points that opened nothing shows nothing.
- **Their sounds wait for the rank-up card** (the win that opens Dissonance often ranks up too): `quiet` while it's up, then once.

## In a fight

| The readout, its levels on hover; Silent Cues on the arc | Blind Score at the Cantor |
|---|---|
| ![](ui/hud-dissonance.jpg) | ![](ui/hud-dissonance-blind.jpg) |

![The same fight without Blind Score, to compare: the answers, the decree's second sentence and the Ward hint are back](ui/hud-dissonance-seen.jpg)

| The readout's tooltip (2×) | The boss bar under Blind Score (2×) | The arc: a Cue costs 35 (2×) |
|---|---|---|
| ![](ui/hud-chip.png) | ![](ui/boss-blind.png) | ![](ui/hud-arc.png) |

- **The HUD reads the fight**, not the run: `WorldState.dissonance` gives the levels, Blind Score and the Cue's cost; the bridge adds their points. In the Training Grounds (no Dissonance) nothing shows.
- **Blind Score hides answers, not threats.** The cast's name and bar, the striped incoming damage, LETHAL, the Chronomancer's Foresight and timers, and a hero's call (it's the hero asking, not a telegraph) all stay. The Chronomancer's Rewind preview ("Rewind +540 · dodges it") stays too: it's what Rewind would do, not what the telegraph wants.
- **A decree keeps its first sentence.** Content writes each one as what's coming, then how to answer ("Requiem — every hero will lose 90% of their life. Cue Kael’s dome, or Ward and heal."). See *Known gaps*.

## The Reliquary at each band

| Depth 0: T3 can't Ascend (the reason on its own line) | Won at 12: Ascend to T2 (T1 locked) |
|---|---|
| ![](ui/reliquary-depth-0.jpg) | ![](ui/reliquary-depth-10.jpg) |

| Won at 24: Ascend to T1 (T1 is the best there is) | Inscribe at 24: T2 and T1 can roll |
|---|---|
| ![](ui/reliquary-depth-20.jpg) | ![](ui/reliquary-depth-inscribe.jpg) |

| Dissonate at 12: Cursed reaches T1 | The shelf's marks and the detail's chip (2×) |
|---|---|
| ![](ui/reliquary-depth-dissonate.jpg) | ![](ui/reliquary-depth.png) |

- **The band is the meta's** (`band(relic.depth)`): Ascend's reach, its locks (`craftBlocked`'s own words), Inscribe's odds (`craftOdds`) and a Cursed Dissonate's reach. The test checks each at depth 0, at each band's edge and past it.
- **Depth reads in the colour of the tier it opens**, so a relic's depth and its Inscriptions' badges speak one language; colour is never alone (the number, the "reaches T2").

## Codex, Ranks, Respite

| Codex: Dissonance | Codex: locked (Rank 12) |
|---|---|
| ![](ui/codex-dissonance.jpg) | ![](ui/codex-dissonance-locked.jpg) |

| Codex: the Reliquary's crafts with depth | Rank 15: Dissonance |
|---|---|
| ![](ui/codex-reliquary-depth.jpg) | ![](ui/rank-up-15-dissonance.jpg) |

| Respite under Unforgiving | Meditate under Unforgiving |
|---|---|
| ![](ui/respite-unforgiving.jpg) | ![](ui/draft-unforgiving.jpg) |

![The Rank panel at 14: what Rank 15 opens](ui/rank-panels-dissonance.jpg)

## In the real app

The dev server, driven through the run hook like the e2e: Skip the unlocks; in Prep, Hardened to its top rank, Brisk Foes, Silent Cues and Blind Score (10 points; the keyboard on Short Fuse's switch); embark; the hook walks to the Hollow Cantor and a bot plays until it casts; the hook wins it.

| Prep (keyboard focus on a switch) | The first-fight primer: a Cue costs 35 |
|---|---|
| ![](ui/real-prep.jpg) | ![](ui/real-primer.jpg) |

| The Cantor under Blind Score | The readout on hover |
|---|---|
| ![](ui/real-hud-blind.jpg) | ![](ui/real-hud-chip.jpg) |

| The Result: the XP's Dissonance line | The Summary: a new best |
|---|---|
| ![](ui/real-result.jpg) | ![](ui/real-summary.jpg) |

The fight's config carried the four levels; the profile kept `best: { none: 10 }`; no console errors.

## Lab views

The new **Dissonance** group, interactive where it can be (Prep's switches and steppers work, through `Run.setDissonance` as the run follows the profile; the Reliquary crafts; the enshrine works at the run's depth):

- **Prep**: `prep-dissonance-closed`, `prep-dissonance-closed-16`, `prep-dissonance-open`, `prep-dissonance-10`, `prep-dissonance-20`, `prep-dissonance-max`, `prep-dissonance-pact`.
- **Summary**: `summary-dissonance-opened`, `summary-dissonance-best`, `summary-dissonance-enshrine`, `summary-dissonance-enshrined`.
- **HUD**: `hud-dissonance` (the readout's tooltip open), `hud-dissonance-blind`, `hud-dissonance-seen`.
- **The Reliquary**: `reliquary-depth-0`, `reliquary-depth-10`, `reliquary-depth-20`, `reliquary-depth-inscribe`, `reliquary-depth-dissonate`.
- **Respite, Draft**: `respite-unforgiving`, `draft-unforgiving`.
- **Codex, Ranks**: `codex-dissonance`, `codex-dissonance-locked`, `codex-reliquary-depth`, `rank-up-15-dissonance`, `rank-panels-dissonance`.

New mock data in `lab/mock.ts`: `mockDissonance(target)` (levels adding up to a total, or as little past it as content's points allow; `Infinity`: every level at its top), `mockDissonanceHud(scenario, levels)` (a scenario's HUD with what the bridge reads of a real fight at those levels), `depthReliquary()` (relics at depth 0, at the first band, at the deepest and shallow) and `dissonanceSummaryRun(levels, end, opts)`.

## Tests and checks

`tests/uiPhase4d.test.ts` has 22 tests:

- **Prep's numbers are the meta's**: every level of content in order, with `dissonanceText`, ranks and points; each set of levels' "+N" adding up to `dissonancePoints`; switches and steppers making what `fitLevels` and the profile store keep, the run in Prep following; the rewards at every total from 0 to the most (`xpMult`, `shardsMult`, the Tear thresholds); the Tear rules against `tearsFor` grade by grade; the reach at every total (`band`, `nextBandDepth`); the best and what a new best takes, through the stores; a Pact with nothing to give (`playedDissonance`) adding nothing and saying why.
- **Open and closed**: closed on a new profile and the run in Prep playing none of the choice; Skip the unlocks opening it; the closed lines below and past its Rank; the unlock's icon and line; the Codex's bands, totals, records and the levels to come.
- **The Summary**, through the stores: a won run's points, levels and rewards, the best mark (and none for a lower total); the win at Rank 15 that opens it and the card's numbers; a relic enshrined at the run's depth, and what it reaches.
- **In a fight**: the bridge's readout from a real sim (points, levels, Blind Score, the Cue's cost; none without Dissonance); Blind Score dropping exactly the answer hints (boss and crisis scenarios), statuses' answers, decrees keeping their first sentence; the Cue hint and the arc's ticks following the cost; the HUD's par equal to the Result's (`parMult`); a fight's XP lines adding up at Dissonance.
- **The Reliquary at every band**: the depth's reach, Ascend's locks (`craftBlocked`), Inscribe's odds (`craftOdds`), Cursed's reach, the depth lines, at depth 0, each band's edge and past it; the Codex's tiers and the depth that reaches them; the lab's relics in their bands.
- **Looks and the lab**: the discord pink, its light and Blind Score's grey at least 4.5:1 on the dark panels and on their tints, every depth colour on its chip; the lab's choices landing on their totals.

`e2e/smoke.spec.ts` gains "**Phase 4d: Dissonance — choose levels in Prep, embark, the fight plays them, a win sets the record**":

1. A new profile: Prep's panel is closed and says it opens with a win at Rank 15; the hook says closed.
2. Settings → Skip the unlocks; a new run: the panel is open, every level off, 0 points.
3. A level with ranks on and up to its top rank, a level without ranks on: the panel's points, its most and its XP bonus are content's and meta's; the Embark bar says the total; the hook's profile and run hold the levels.
4. Embark, the first fight: its config plays exactly those levels; the HUD's readout says the points.
5. Win it: the Result's XP has its Dissonance line. Win the run (the hook walks to the boss): the Summary's panel has the points and the new-best mark; the profile's best is the points.
6. New run: Prep's best says "Best won without a Calling: N."

Per the brief, I didn't run the Playwright suite. It type-checks and lints. I ran the spec's own Phase 4d test against the dev server on port 5391 with a scratch config (no build, no preview server): it passed first time and again after the last changes, with no console errors. Against the same server the Phase 4c, 4b and 3b tests and the Prelude run still pass.

- `npm run typecheck` (all three configs) passes.
- `npm run lint` (ESLint and Prettier over the repo) passes.
- The full `npx vitest run` passes: 58 files, 1210 tests, with the other workstreams' tests.

## Screenshots

All are under `ui/`, taken with Playwright at 1280 wide on the dev server. Lab views use `nav=0&fit=0`, captured in a tall window clipped to the stage (one process each); the PNGs are 2× crops; the Prep views are cropped to the panel. The `real-*.jpg` shots are the real app, driven through the run hook. I looked at every one. The fixes this led to:

- **Ranked levels said their points twice** ("3 points a rank" by the name and by the stepper), and the name wrapped. Their points sit by the stepper only.
- **The HUD's tooltip ran 480 px tall** with ten levels. One line each now (name, ranks, "+N", text).
- **A bark covered the tooltip.** The HUD's top-left group sits above the party frames' barks.
- **The opened card sat inside the Dissonance panel** (two borders) and repeated its blurb. It stands alone and says how to choose instead.
- **The rank-up line repeated the unlock's text.** It says what comes after the opening win.
- **Enshrine's depth was on every option** as well as above them. Once, above.
- **"About 20" was 24** with the tuned points. The lab picks the smallest total at or past its target.
- **The closed panel said "chosen in Prep"** while in Prep. The blurb says "chosen before a run".
- **Batched and element screenshots timed out** on animated views. Each view runs alone, clipped from the page with animations off.
- **The real HUD said "par 4:00" for a Cantor the Result graded at 6:00** (the review made Dissonance's extra life lengthen the par). The HUD's header and the map's par chip use `parMult` now; the real shots were taken again.

## Known gaps

- **Decrees under Blind Score keep their first sentence**: content writes each as what's coming, then how to answer. A decree whose first sentence named its answer would still say it. A separate field in content would be sturdier (below).
- **The HUD's relic bar doesn't mark the Pact's relic**: the fight's relics don't know `pact` (the run strip and the Summary do).
- **The Result's "Threat: enemies +30% life" is the node's Threat only**; Hardened's life is on top of it (the readout says so).
- **Prep's closed panel shows at every Rank**, so a new player meets Dissonance's name in their first Prep (as locked Callings already are).
- **An idle Pact shows "+0"**, its reason under it.
- **The three levels still to come are named in the UI**, not in content.
- **The Summary's sounds** (`dissonanceOpen`, `dissonanceBest`) play once per visit, after any rank-up card; reopening a saved Summary plays them again.

## Outside my area

I made no changes to `src/sim`, `src/meta`, `src/content`, `src/audio`, `src/render`, the stores or `tools`. Outside `src/ui` I changed only `src/app/testHook*.ts`, `e2e/smoke.spec.ts` and `tests/uiPhase4d.test.ts`. What would help:

- **A decree's answer as its own content field** (`attack.decreeAnswer`, and the Bellwarden's and the Enrage's decrees in `sim/systems/bosses.ts`), so Blind Score drops exactly it.
- **`pact` on the fight's relics** (or the HUD reading `run.relics`), to mark the Pact's relic in the relic bar.
- **The grade that also pays a Tear** (`'A'` in `tearsFor`) in `CONTENT.dissonanceRules`, so the screens read it.
- **The Training Grounds** could try Dissonance's levels (the readout and Blind Score are ready for it).
- **docs/phase-4d.md's Presentation section** can link here.
- **Auras**: nothing about them changed.

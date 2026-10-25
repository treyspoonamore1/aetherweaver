# Phase 3c UI: the Luminary

*Owner: the UI workstream (`src/ui/**`). Builds on [Phase 3b's UI](../phase-3b/ui.md). Spec: [docs/phase-3c.md](../phase-3c.md).*

Everything here can be reviewed without playing: open **`/?lab=ui`** (new sidebar group **Calling**) or `/?lab=ui&view=<id>&nav=0`. The lab's **Flow** now has the Calling picker in Prep and routes the `calling` phase to the real tier screen (Third Voice's builder included).

Every number on these screens comes from content (`callingText`, `optionText`, `callingDef(...).unlockRank`), the run (`Run.CALLING_ROWS`, `Run.fieldAuraSlots`, `Run.chordsAllowed`, `runTotals`) or the sim (`WorldState.calling`, `EncounterStats.callingAmplified / callingShielded`). Nothing is hard-coded, so the lead's tuning flows through. The screenshots show content as it was during this session: Radiance 4% per aura, Haloed 8% against ordinary hits.

## What changed, by screen

| Where | What | Files |
|---|---|---|
| Prep | **Your Calling**: "No Calling" and a compact card per Calling (emblem, name, title, passive, Sunrise line, four path pips with when each pick comes, **See the path**). Locked: dashed, greyed emblem, **Rank 7**, "Reach Weaver Rank 7 to choose it (or Settings → Skip the unlocks)". **New** tag when freshly unlocked. A dialog shows the whole path. Choosing plays `callingSelect` and calls `setCalling` | `screens/CallingPicker.tsx`, `screens/CallingParts.tsx`, `screens/PrepScreen.tsx` |
| Tier screen (`calling`) | Its own look: the blazing emblem under a dawn glow, the **path track** (taken options lit with their glyphs, the tier on offer pulsing, the tiers to come dimmed with when they come), two big option cards (glyph, name, **axis tag**, text, keys **1 / 2**), and the passive as a reminder. `callingReveal` on open, `callingPick` on choose | `screens/CallingScreen.tsx` |
| Third Voice | Choosing it opens the song builder as a **free retune** with the field song's third slot marked **Third Voice**: **Retune and go on** (`pickCalling(i, chords)`, enabled once the songs change and are legal), **Keep my songs** (`pickCalling(i)`), **Back: choose again** | `screens/CallingScreen.tsx`, `screens/RespiteScreen.tsx` (`RetuneView`) |
| Song builder | `fieldAuraSlots` runs through `loadoutProblems`, `useChordDraft`, the builder's placement caps, `firstEmpty`, `place` and the slot grid. Every retune site reads `Run.fieldAuraSlots(run)`: Prep, Respite, the forge and the Tuning Pool (all through `RetuneView`), and Third Voice's preview | `screens/chordModel.ts`, `screens/ChordBuilder.tsx`, `screens/PrepScreen.tsx`, `screens/RespiteScreen.tsx` |
| Map | The run strip opens with the **Calling**: emblem, four pips and "next pick after your fight at step 6". On hover or focus: the passive, each chosen option's text, and each open tier with when it comes and its two options. **Milestone fights** carry a small Luminary mark, and their tooltip says "**Your Calling grows after this fight**: Tier III, Third Voice or Lantern Bearer." The strip appears on the relic offer, merchant, forge and event screens too | `screens/MapScreen.tsx`, `screens/RelicCard.tsx` (`RunStrip`), `screens/CallingParts.tsx` (`CallingStripItem`) |
| Result | A Calling line after the songs' lines: "**Radiance: +986 damage through your heroes · Haloed: 182 damage kept off.**" (only the parts that did something; Radiance becomes "Radiance and Eclipse" once Eclipse is on the path). Continue reads **Continue: your Calling grows** before a tier | `screens/resultText.ts`, `screens/ResultScreen.tsx`, `screens/interlude.ts` (`nextStep`) |
| Summary | **The Luminary** panel: run totals as two figures (damage through your heroes; damage Haloed kept off) and the path taken tier by tier, with glyphs, names and text. A tier the run never reached reads "not reached" and says when it would have come | `screens/SummaryScreen.tsx` |
| Codex | **Callings** tab: what a Calling is and when its picks come, then each Calling (emblem, flavour, passive, Sunrise, the unlock Rank or **Rank 7** when locked) and its four tiers with both options and their axis. Locks follow the player's Rank (`useAllowance`) | `screens/CodexScreen.tsx` |
| Rank 7 | The rank-up card shows the Luminary's emblem on a dawn-tinted row, plus "Choose it in your next Prep, above the song builder." `unlockIcon` has a `calling` case (`sun`); the Title's Rank panel uses the Calling's glyph | `screens/Rank.tsx`, `screens/rankText.ts` |
| HUD | **Calling chip** under the relic bar, and a **Radiance mark** on the party frames of heroes who shine | `hud/CallingChip.tsx`, `hud/calling.ts`, `hud/PartyFrames.tsx`, `hud/Hud.tsx`, `hudBridge.ts`, `store.ts` |
| Settings | Skip the unlocks: "Every song, aura, ornament and Calling from the start." | `screens/SettingsScreen.tsx` |
| Kit | `CallingGlyph` / `CallingEmblem` / `PathPip` and the Luminary's look; a `sun` icon | `kit/CallingGlyph.tsx`, `kit/iconPaths.ts` |

## The Luminary's look and glyphs

There is one 24×24 line-art glyph per content `icon`, with the same stroke and caps as the relic glyphs: **luminary** (the sun rising over the horizon), **halo_ring** (a halo over a head), **wide** (the song spreading outward), **dawn** (a ward with the sun rising in it), **sear** (a flame with heat rising), **voice** (a triad of three voices), **stake** (a lantern on a planted staff), **crown** (a crown with a gem) and **eclipse** (a dark disc with its corona).

The Luminary is drawn in **dawn light**: a warm peach accent (`#ffc98f`), pale sunlight for glyphs (`#fff1c4`) and a rosy low end (`#f08a6c`). Its emblem ring is a **sunrise conic gradient**. Relic rings are one solid rarity colour, so a Calling never reads as a relic. Path pips have four states: lit (the glyph on a glowing disc), on offer (dashed, accented), open (dim, dashed, with the numeral) and passed.

**Axes** come from the design doc. Content has no axis field (see Contract notes), so `OPTION_AXIS` in `callingText.ts` holds them:

- **Protect** (cyan, ward glyph): Haloed, Dawnward.
- **Reach and number** (field blue, scatter glyph): Wide Choir, Third Voice, Sovereign Symphony.
- **Radiance** (dawn, sun glyph): Searing Hymns, Lantern Bearer, Eclipse.

## Prep

| Locked (Rank 6) | Rank 7: New |
|---|---|
| ![](ui/prep-calling-locked.jpg) | ![](ui/prep-calling-new.jpg) |

| Chosen | The path dialog |
|---|---|
| ![](ui/prep-calling-chosen.jpg) | ![](ui/prep-calling-path.jpg) |

- At 1280×720 the section fits above the presets: the header, Fresh strip and Calling cards take the first screen, and the builder follows on scroll, as before.
- The cards are a `radiogroup`, and the Luminary's aria label ends ": chosen" when selected. A locked card is `aria-disabled` and plays `error` when clicked.
- The pick schedule is written in the map's terms: "4 picks along the way, one of two each: after First Light, your fights at steps 4 and 6, and the Bellwarden." `tierWhen` names a row by its encounter when every node on it is the same fight (First Light, the Bellwarden), and by its step otherwise. Steps count from 1, like the map's header.
- The dialog sits in a `fixed` layer, so it covers the screen however far Prep has scrolled.

## The tier screen

| Tier I | Tier II |
|---|---|
| ![](ui/calling-tier-1.jpg) | ![](ui/calling-tier-2.jpg) |

| Tier III | Tier IV (capstone) |
|---|---|
| ![](ui/calling-tier-3.jpg) | ![](ui/calling-tier-4.jpg) |

| Third Voice: the free retune | Retune later (a Respite) with Third Voice |
|---|---|
| ![](ui/calling-third-voice.jpg) | ![](ui/calling-retune-after.jpg) |

- **Arrival guard.** `RunScreen`'s guard already swallows clicks and keys for 350 ms after the phase changes. The tier screen adds its own: 1 / 2 are ignored for 400 ms after it opens, and repeats and modified keys are always ignored. In the real app (Vite + the run store), a 1 pressed right after clicking **Continue: your Calling grows** never took an option; a 1 pressed after 0.7 s did.
- Third Voice's builder previews the run with Third Voice taken (`withOption`), so `RetuneView` reads three field slots from `Run.fieldAuraSlots` like every other retune site. The third slot spans the song card's width, with a dashed border and a dawn **Third Voice** badge. The Auras heading adds "Third Voice adds a third slot: it needs Spirit, and Grace Note helps".
- Auras stay a list with no gaps (as the sim keeps them), so the third slot fills once the first two are taken.
- In the HUD's Weaver bar, a three-aura field song wraps whole chips instead of breaking a chip's name (`whitespace-nowrap`).

## Map

| The strip's tooltip (Wide Choir, Searing Hymns taken) | A milestone fight's tooltip |
|---|---|
| ![](ui/map-calling.jpg) | ![](ui/map-calling-node.jpg) |

![In the real app, after First Light (Haloed)](ui/real-map.jpg)

- A node is marked by `callingTierAt(run, node)`, which mirrors the run's `callingTierDue`: the node is a fight (`encounterId`), not an event, on a row in `CALLING_ROWS`, and that row's tier is still open. The run grants the tier to the first fight won on the row, so once it is picked the row's marks go. Future milestone rows are marked too, so the player can see when the next pick comes.
- The node's aria label includes the sentence, and the strip item is focusable (`tabIndex 0`). Its aria label reads "The Luminary: Wide Choir, Searing Hymns. Next pick after your fight at step 6."

## HUD

| Heroes shine, Haloed | Sunrise, Sovereign Symphony, Third Voice |
|---|---|
| ![](ui/hud-luminary.jpg) | ![](ui/hud-luminary-sunrise.jpg) |

| The chip in Sunrise | Radiance marks in Sunrise |
|---|---|
| ![](ui/hud-calling-chip.png) | ![](ui/hud-radiance-sunrise.png) |

- **Chip** (under the relic bar, top-left): the 28 px emblem and four 18 px path pips. In Sunrise the border and emblem blaze and a "Sunrise ×3" label appears. **Haloed** (cyan, with its glyph) and **Sovereign** (lit only when `CallingState.sovereign` is true) show as small states. The aria label is the whole sentence ("The Luminary: Haloed, Dawnward, Third Voice, Sovereign Symphony. Sunrise: Radiance ×3. Haloed: heroes in your field take less from ordinary hits. Sovereign Symphony: every aura is stronger.").
- **Radiance mark** on a party frame: a small sun and "+16%" in front of the aura pips it multiplies. In Sunrise it fills, rings and glows. It is hidden when the hero doesn't shine: no Calling, outside the field (Lyra on the beam), hearing no aura, or downed.
- `HeroHud.radiance = shineOf(hero, calling, field.crescendo)`, which is `radiancePerAura × popcount(auraMask) × (sunriseMult in Sunrise)` while `inField`. The test checks that it equals the sim's own `radianceOf` for every hero, in and out of Sunrise. `HudSnapshot.calling` (`CallingHud`) holds the tiers, `sunrise`, `sovereign` and `haloed`.

## Result, Summary, Codex, Rank 7

| Result: the Calling line, Continue → the tier | Summary: the path taken |
|---|---|
| ![](ui/result-calling.jpg) | ![](ui/summary-calling.jpg) |

| Codex: Callings | Codex: locked (Rank 3) | Rank 7 |
|---|---|---|
| ![](ui/codex-callings.jpg) | ![](ui/codex-callings-locked.jpg) | ![](ui/rank-up-7.jpg) |

## Lab views

These views are new in the **Calling** group:

- **Prep:** `prep-calling-locked`, `prep-calling-new`, `prep-calling-chosen` and `prep-calling-path`. They are interactive: choose and unchoose.
- **Tier screens:** `calling-tier-1` … `calling-tier-4` (interactive, with Third Voice's builder on tier III), `calling-third-voice` and `calling-retune-after`.
- **Map:** `map-calling` (the strip's tooltip) and `map-calling-node`.
- **HUD:** `hud-luminary` and `hud-luminary-sunrise`.
- **Result, Summary, Codex, Rank 7:** `result-calling`, `summary-calling`, `codex-callings`, `codex-callings-locked` and `rank-up-7`.

New mock builders in `lab/mock.ts`:

- **Runs:** `luminaryRun({ picks, untilTier, fights })`, `callingOfferRun(tier)`, `callingMapRun()`, `milestoneNode(run)`, `callingResultRun()`, `callingSummaryRun()` and `prepCallingRun(chosen)`.
- **HUD:** `mockCallingSource(path)` builds a real sim to read `WorldState.calling`. There are two new scenarios, `luminary` and `luminary-sunrise`.
- **Changes to existing mocks:** `fakeOutcome` now fills the ledger's `calling` part when the run has a Calling, and `settle` takes a pending tier.

## Tests and checks

`tests/uiPhase3c.test.ts` has 19 tests:

- **Radiance:** `shineOf` / `popcount` / `shineLabel`. `buildHudSnapshot` on a real sim with the Luminary equals the sim's `radianceOf` for each hero, in and out of Sunrise, and drops to 0 out of the field. With no Calling there is no chip and nobody shines. Sovereign appears only when the sim says so. The lab mocks are checked too.
- **Third slot:**
  - For every preset, a three-aura field, a three-aura beam and Guardian, with 2 and 3 field slots and three allowances, `loadoutProblems(...).length === 0` equals `Run.chordsAllowed(...)`.
  - The sim's sentences come through, and `auraSlotsFor` / `isBonusSlot` behave.
  - Prep reads 2 slots and the Third Voice preview reads 3, marked as Third Voice's. Lantern Bearer adds no slot.
  - **Retune** applies chords the builder calls legal, and **Keep my songs** keeps the old ones.
- **Path:** `tierWhen` on four map seeds and `tierWhenList`; tooltip lines (chosen and open); `pathLabel` / `nextTier`; the tier screen's step states; every option has its design axis.
- **Map:** every milestone fight is marked and nothing else is (events never, no marks without a Calling). Winning a marked fight leads to that tier (`nextStep` says so), and the mark goes after the pick.
- **Result and Summary:** the line's exact text (both parts, Eclipse, Haloed only, nothing). It is placed right after the songs' lines and only when something happened. The run totals and labels are checked.
- **Rank 7:** the unlock's Rank, `unlockIcon` → `sun`, the allowance either side of Rank 7, and a locked `setCalling` refused.

`e2e/smoke.spec.ts` gains "**Phase 3c: the Luminary**". It goes:

1. Settings → click **Skip the unlocks**.
2. `newRun`, click the Luminary card (the radio reads "chosen"; `calling()` has an empty path), then Embark.
3. The strip and a milestone mark are visible.
4. `choose()` First Light, then `winFight()` → `result`, dismissing a rank-up card if one shows.
5. Click **Continue: your Calling grows** → `calling`, wait 0.7 s, press **1** → `draft`, with the path `['haloed', null, null, null]`.

The run hook gains `setCalling`, `calling()`, `pickCalling` and **`winFight()`**. `winFight()` is test-only: in combat it calls `finishCombat` with a plain victory (an empty ledger, the party as it came in), so the test doesn't have to play First Light. Per the brief, I did not run the e2e suite. It typechecks and lints, and I drove the same steps by script against the dev server (Chromium) with no console errors.

- `npx tsc -p tsconfig.app.json` and `-p tsconfig.sim.json` pass.
- `-p tsconfig.node.json` fails only in `tests/sim/luminary.test.ts` (line 201, a readonly `answers` array). That is the logic workstream's in-progress file; nothing of mine is involved.
- `npx eslint src/ui src/app tests e2e --max-warnings 0` and `npx prettier --check src/ui src/app tests e2e docs/phase-3c` pass.
- `npx vitest run tests/ui*.test.ts tests/appStores.test.ts` passes (110 tests), and so does the full `npx vitest run` (594).
- `npx vite build --outDir /tmp/claude-ui-build` succeeds.

## Screenshots

All are under `ui/` and were taken with Playwright against the lab (`nav=0`, the stage at its design size). I looked at every one at 1280×720 or 1280×n. The fixes this led to:

- Prep's schedule wording ("after First Light, your fights at steps 4 and 6, and the Bellwarden").
- The Weaver bar's chip wrapping with three field auras.
- The map's strip "next pick …" line.
- A taller result view, so the line shows.

The PNG crops (`hud-calling-chip`, `hud-radiance-frames`, `hud-radiance-sunrise`) are at 2×. `real-prep.jpg`, `real-calling.jpg` and `real-map.jpg` come from the real app on the Vite dev server, driven through the run hook.

## Known gaps

- **The builder's field radius ignores the Calling.** The song cards and the Weaver bar's tooltip say "within 8 m". In the fight, the Luminary's +15% and Wide Choir's +20% reach farther. The builder's numbers come from `resolveChord`, which knows nothing of Calling mods (see Contract notes).
- **The tier screen's passive line shows the base Radiance** ("4% per aura"), not the current figure after Searing Hymns (×2). The HUD's per-hero figures are exact (they read `radiancePerAura` from the sim).
- **Lantern Bearer and Dawnward have no HUD state of their own.** Dawnward's barrier shows as an ordinary shield, and its moment is the VFX/audio's `dawnward` event.
- **Axis tags are UI-side** (`OPTION_AXIS`). A new option without an entry gets no tag (the test catches this for the Luminary).
- **The Third Voice slot fills last.** Auras have no gaps, so filling the third slot of an empty field song places the aura first.
- **No retune in Prep after Third Voice.** "Keep my songs" leaves the third slot empty, to be filled at a Respite, a forge or the Tuning Pool.
- **`winFight` is a shortcut.** The e2e test doesn't play First Light (the 3b merchant test warps the same way). The existing Prelude test still plays a full fight.

## Contract notes

I made no changes to `src/sim`, `src/content` or `src/meta`. What would help:

- **Calling reach in the builder.** A pure `fieldSongRadiusMult(calling)` (or `resolveChord(chord, index, { calling })`) exported from the sim would let the song builder, the Weaver bar and the Codex show the Luminary's real field radius. The same goes for an exported "Radiance per aura for this path", so the tier screen can say "now 8% per aura" after Searing Hymns.
- **An `axis` on each option** (`'protect' | 'reach' | 'radiance'`) in the content schema would replace `OPTION_AXIS`.
- **The Rank 7 unlock text** was long on the rank-up card. *Done by the lead:* Callings now carry a one-sentence `summary`, and the unlock reads "A Calling: Heroes in your field shine: every aura they hear makes their hits brighter. Choose it in Prep; its path grows as you win."
- **Duplicated milestone logic.** *Done by the lead:* `callingTierDue` is exported from `meta/run.ts` (with the fight check), and `callingTierAt` now delegates to it.
- **Lab-only Haloed figure.** The UI shows `EncounterStats.callingShielded` as "Haloed: N damage kept off". With Haloed now limited to ordinary hits (the lead's tuning, picked up through `optionText`), the figure stays honest. The lab's `fakeOutcome` invents its own figures for the screenshots.
- `HudSnapshot.calling` and `HeroHud.radiance` are UI-side additions filled by `buildHudSnapshot`. Anything that builds a snapshot by hand needs `calling: null` and `radiance: 0` (the lab mocks have them).

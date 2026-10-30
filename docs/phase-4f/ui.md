# Phase 4f UI: technique variants

*Owner: the UI workstream (`src/ui/**`). Builds on [Phase 4e's UI](../phase-4e/ui.md). Spec: [docs/phase-4f.md](../phase-4f.md).*

Everything here can be reviewed without playing: open **`/?lab=ui`** (new sidebar group **Variants**) or `/?lab=ui&view=<id>&nav=0`.

Every name, number and line about a variant on these screens comes from content: `CONTENT.techniqueVariants` (each variant's name, its text filled from its `values` by `variantText`, its own `cost` and `cooldown`) and the defaults' `CONTENT.techniques`. What's chosen, owned and open comes from meta and the stores: `variantsFor`, `fitTechniques`, `fitOwned`, `variantsConfig`, `TECHNIQUE_SLOTS`, the profile store's `setTechnique`, `ownVariant`, `variantsAll` and `runTechniques`, and the run's `techniques`. The variants were tuned the whole time this was built. Chorale's barrier was retuned three times, it gained a cost (25 Spirit), and its Perfect moved to the Warded hero alone. Aegis Link gained "lighter" (40%, then 30%, then 33%). Purge's radius and shares, Anchor's guard (40%, then 55%, then 50%), Swap's barrier and Skate's cooldown (4 s, then the default's 5 s) all moved, and Anchor lost "nothing moves them". All of it came through with no change to a screen. The screenshots show the numbers of the moment each was taken.

The words that aren't content's are the screens' connective ones ("Chosen", "the default", "Choose variants") and the defaults' descriptions ("A barrier on the hero you Ward: 30% of their life + 120…"), which are built from `CONTENT.techniques`' numbers the way the Codex's Weaver page builds its own. How a variant is had ("Starlight, from Weaver Rank 5", "Starlight, from the Luminary's top mastery") is Phase 4g's content (`starlight.atelierRank`, `mastery.callings`), read in one place (`variantSource` in `variantsModel.ts`).

The decision the screens are built around is **which way do I save them, this run?** So each slot shows its default and both variants side by side, in the variants' own words, with what changes (a cost, a cooldown) marked against the default. Prep says what's locked and how it's had. The Weaver bar names what each key plays, and the Training Grounds let you try any of them.

## What changed, by screen

| Where | What | Files |
|---|---|---|
| **Prep: Your techniques** (new, under the Calling) | One column per slot, in the keys' order (**Q** Ward, **E** Chime, **F** Reel, **Space** Glide). Each column has the default and its two variants as cards: the glyph, the name, content's text, the cost and cooldown (a variant's own marked against the default's: "25 Spirit (Ward 20)", "14 s cooldown (Chime 9 s)"), and the chosen one ringed in gold ("✓ Chosen"). A slot is a **radio group**: click, or the arrow keys, which move between the open options, skip the locked ones and wrap. Choosing calls the profile store's `setTechnique`; the panel reads `run.techniques`, which follows the profile in Prep. **Locked** variants (not owned, Skip the unlocks off) are dashed with a lock and say how they're had ("☆ Starlight, from Weaver Rank 5", "☆ Starlight, from the Luminary's top mastery"). A click on one says so again in the panel's live line ("Chorale: Starlight, from the Luminary's top mastery.") and changes nothing. The panel's line says what's owned ("2 of 8 variants owned…", "Every variant is open: Settings → Skip the unlocks.", or, with none, how they're had). **Fold** turns it into one row of what the four keys play (glyph and name, variants in gold). It opens unfolded when a variant can be chosen and remembers the choice per browser. On a **Chronomancer run** the Reel column says "On a Chronomancer run, Rewind takes Reel's slot: the Reel choice has no effect on this run. It's kept for your next." and dims. **Rules** opens the Codex's Techniques page over Prep. | `screens/TechniquesParts.tsx`, `screens/variantsModel.ts`, `screens/PrepScreen.tsx`, `kit/variantLook.ts`, `kit/iconPaths.ts` |
| **Prep and Retune: the Spirit budget** | The budget names each slot's variant and counts its own cost: "Chorale 25 · Purge 15 · Reel 25", "All three back to back need 65", and "you could never cast Chorale (25)". On a Chronomancer run Reel's slot still reads as Rewind. | `screens/chordModel.ts`, `screens/ChordBuilder.tsx`, `screens/RespiteScreen.tsx` |
| **HUD: the Weaver bar** | Each slot shows its **variant's glyph** and, under the button, its **name** (gold when ready). A **tooltip** comes up when you point at the slot for half a second (or focus it): the name and key, "A Ward variant", content's text and the cost now ("25 Spirit", "Free · 2 charges"). Defaults get their own words; Rewind's slot says what Rewind does and, when it's ready, what it would do now. **Skate** runs on its charges, like the Ward's: the pips under the slot, and the slot stays **ready while a charge is left**, with a thin line filling as the next comes back. With none left it waits with the usual sweep. The Ward's two charges (the Twin Aegis motif) now work the same way; before, a recharging Ward looked unavailable with a charge still in it. The cost is the variant's (Chorale's 25), so "not enough Spirit" dims the slot at the right point. **Rejections still buzz the slot**: the callouts' `reject:<slot>` keys are unchanged. The slots take the pointer (for the tooltip); the rest of the bar still doesn't. On a Chronomancer run, Reel's slot is Rewind's whatever the variant. | `hudBridge.ts`, `store.ts` (`TechniqueHud.variant`), `hud/WeaverBar.tsx`, `hud/techniqueState.ts`, `hud/Hud.tsx` |
| **HUD: frames** | The variants' guards get their own looks: **Absolved** in Absolve's glyph (a bell with a plus) and sea green, **Anchored** in Anchor's glyph and pale gold. Their tooltips use content's name and share: "Your Anchor: they take 50% less damage while it lasts." | `hud/labels.ts`, `kit/variantLook.ts` |
| **HUD: hints and keys** | The controls reminder names what the four keys play ("Chorale · Purge · Anchor · Skate"). The coach hints name a variant in its slot without explaining it: "…cast Chorale {Q} just before it lands for a Perfect", "Kael is in a lethal zone — Anchor {F} on them", "…press {E} (Purge) to cleanse it". What a variant does is content's, in Prep and the tooltip. | `hud/KeyHints.tsx`, `hud/hints.ts` |
| **Training Grounds** | They start with the profile's choice, every variant open (`fitTechniques(choice, owned, true)`, so a choice made under Skip the unlocks plays here even after it's turned off). The tools panel gains **Techniques**: a select per slot with every variant ("Ward (default)", "Chorale", "Aegis Link"). A change starts a new session, as a Chords preset does. The profile's choice and what it owns stay as they are. The panel now stops above the Weaver bar and scrolls on short screens. | `screens/TrainingScreen.tsx`, `screens/TrainingParts.tsx` (the tools, split from the screen so the lab can show them without the 3D view) |
| **Codex: Techniques** (new tab, after The Weaver) | What variants are, how they're chosen and kept, how they're had ("Five are bought with Starlight from Weaver Rank 5; the other three open to buy with a Calling's top mastery: Chorale with the Luminary's…"), and the Chronomancer's note. Then each slot: the default ("Always yours") and its variants, each **Owned**, **Open (Skip the unlocks)** or **Locked**, with how it's had. Every Codex the screens open (Title, Prep, the Astrolabe, the Reliquary, Bonds) knows what's owned. | `screens/TechniquesCodex.tsx`, `screens/CodexScreen.tsx`, `screens/AstrolabeScreen.tsx`, `screens/ReliquaryScreen.tsx`, `screens/BondsScreen.tsx` |
| **Sounds** | Existing UI sounds, named in one place (`VARIANT_SOUNDS`): `pick` when a variant is chosen (Prep, Training), `back` for a default, `error` for a locked click. If the audio workstream adds `variantPick`, it changes there. | `kit/variantLook.ts` |
| Test hook | `__AWRUN__.techniques()`: what the profile owns and chose, Skip the unlocks, and the run's. `__AWRUN__.ownVariants(ids)`: the store's `ownVariant`. `__AW__.techniques()`: the fight's variants, Glide's charges, each hero's Ward barriers (Chorale's marked, `plain` on the ones you didn't Ward) and statuses. | `app/testHook.ts`, `app/testHookTypes.ts` |

## Prep

| Skip the unlocks: Chorale, Purge and Skate chosen | Two owned; a locked click explained |
|---|---|
| ![](ui/prep-techniques.jpg) | ![](ui/prep-techniques-owned.jpg) |

| A new profile: folded, how they're had | Folded: what the four keys play |
|---|---|
| ![](ui/prep-techniques-new.jpg) | ![](ui/prep-techniques-folded.jpg) |

![A Chronomancer run: the Reel choice has no effect](ui/prep-techniques-chrono.jpg)

| A slot (2×): chosen, locked, how it's had | The Spirit budget with Chorale and Purge (2×) |
|---|---|
| ![](ui/slot-ward.png) | ![](ui/budget.png) |

- **The panel reads the run** (`run.techniques`), which follows the profile in Prep and is frozen at embark. The profile keeps the choice, even one Skip the unlocks no longer allows; the run in Prep then plays the default and the panel shows that, with the variant locked. Turning Skip back on brings it back.
- **What a click asks for is what the profile store does.** An open option calls `setTechnique`. A locked one (`aria-disabled`, still clickable, so it can say why) changes nothing. The test runs the panel's clicks through the real stores.
- **The default is a choice like the others**: the first radio in each slot, "Always yours" in the Codex.

## In a fight

| Chorale, Absolve, Anchor, Skate: a charge coming back, the guards on Kael and Lyra | Chorale's tooltip |
|---|---|
| ![](ui/hud-variants.jpg) | ![](ui/hud-variants-tip.jpg) |

| Aegis Link, Purge, Swap, Phase Step | Both Skate charges spent |
|---|---|
| ![](ui/hud-variants-other.jpg) | ![](ui/hud-variants-skate.jpg) |

![A Chronomancer run with Swap chosen: Rewind keeps Reel's slot](ui/hud-variants-chrono.jpg)

| The Weaver bar (2×) | A tooltip (2×) | The guards (2×) |
|---|---|---|
| ![](ui/bar.png) | ![](ui/tip.png) | ![](ui/guards.png) |

- **The HUD reads the fight**: the bridge takes the variant from `WeaverComponent.variants` and Skate's charges from `glideCharges`/`maxGlideCharges`. The cost is the sim's `techniqueCost`, which counts a variant's own cost. The lab's views build a real sim with those variants and take what the bridge reads; the guards are a real Anchor and a real Absolve cast in it.
- **A slot's state is one function** (`slotState`): Stasis lifts the cooldown, and with charges (Skate's, the Ward's) a slot works while one is left. The test checks Skate's readiness against a real sim, charge by charge.

## Training Grounds

![Training Grounds: every variant open](ui/training-techniques.jpg)

## Codex

| Two owned | Skip the unlocks |
|---|---|
| ![](ui/codex-techniques.jpg) | ![](ui/codex-techniques-skip.jpg) |

## In the real app

The dev server, driven through the run hook and real input. A fresh profile: Prep's panel is folded; opened, every variant is locked, and a click on Chorale says how it's had. Then Settings → Skip the unlocks and a new run: Chorale and Anchor by click, Purge by the keyboard (down from Chime), Skate by click; Rules opens the Codex over Prep. Embark into First Light: 1 threads Kael, Q casts Chorale (his barrier the Perfect-capable one, Lyra's and Vexis's plain), F tries Anchor (refused: 24 Spirit, 25 needed), Space spends one Skate charge. The fight is held still and the pointer rests on Q. Last, the Training Grounds: the profile's choice, then Aegis Link chosen there, with the profile's choice unchanged. No console errors.

| A new profile: folded | Opened: a locked click explained |
|---|---|
| ![](ui/real-prep-new.jpg) | ![](ui/real-prep-locked.jpg) |

| Skip the unlocks: four chosen | Rules: the Codex over Prep |
|---|---|
| ![](ui/real-prep-chosen.jpg) | ![](ui/real-codex.jpg) |

| First Light: Chorale on all three, a Skate charge spent | Chorale's tooltip |
|---|---|
| ![](ui/real-hud.jpg) | ![](ui/real-hud-tip.jpg) |

| Training Grounds: the profile's choice | Aegis Link tried there |
|---|---|
| ![](ui/real-training.jpg) | ![](ui/real-training-aegis.jpg) |

## Lab views

The new **Variants** group, interactive where it can be (Prep's panel chooses by the store's rules, `labSetTechnique`; the Training tools' selects work):

- **Prep**: `prep-techniques` (Skip the unlocks), `prep-techniques-owned` (two owned, a locked click explained), `prep-techniques-new` (a new profile, folded), `prep-techniques-folded`, `prep-techniques-chrono`.
- **HUD**: `hud-variants` (four variants, a charge coming back, the guards), `hud-variants-tip`, `hud-variants-other`, `hud-variants-skate`, `hud-variants-chrono`.
- **Training Grounds**: `training-techniques`.
- **Codex**: `codex-techniques`, `codex-techniques-skip`.

New mock data in `lab/mock.ts`: `labSetTechnique` (the store's rules), `techniquesRun` (a run in Prep that plays a choice, fitted as the run store fits it) and `mockVariantsHud` (a scenario's HUD with what the bridge reads of a real fight with those variants, after real casts where asked).

## Tests and checks

`tests/uiPhase4f.test.ts` has 25 tests:

- **The panel reads content and meta**: each slot's default and variants in content's order, their names, texts (`variantText`), glyphs, costs and cooldowns against the defaults'; the defaults' words carry content's numbers; every variant has a glyph of its own; how each is had, against Phase 4g's content when it's there and the plan's otherwise.
- **Owned and locked**: open only when owned or with Skip the unlocks, the lock's words; a click chooses, explains or does nothing; the arrow keys skip the locked and wrap; the panel's line.
- **Through the stores**: with Skip the unlocks, every slot's click goes through `setTechnique` and the run in Prep follows; embarking freezes it and the fight's config is `variantsConfig` of it. Without it, a locked variant stays locked (the store refuses it too) until `ownVariant`. Turning Skip off shows the unowned choice locked and the run plays the default. The lab's choice matches the store's over every slot, variant, ownership and setting.
- **The Chronomancer**: the Reel note (content's Calling name, Rewind), only on his runs, through the stores; in a real fight Reel's slot is Rewind's whatever the variant.
- **In a fight, from a real sim**: each slot's variant, name, glyph and text, both variants of every slot; the controls reminder's names; a variant's own cost and where it can't be paid; Skate's charges, ready with one left, waiting with none (and the default Glide as before); rejections still buzz the slot; Absolve's and Anchor's guards from real casts, their looks and words; the coach hints name the variant without explaining it.
- **The rest**: the Spirit budget's names and costs (Rewind's on a Chronomancer run); the Training Grounds' start (a choice made under Skip plays there; ownership untouched); the Codex's states and lines; the colours at 4.5:1 or better on the dark panels; the lab's HUD is the bridge's.

`e2e/smoke.spec.ts` gains "**Phase 4f: technique variants — choose in Prep with Skip the unlocks, embark, the fight plays them**":

1. A new profile: the panel is folded; opened, every variant is locked; a click on Ward's first says how it's had, and the profile is unchanged.
2. Settings → Skip the unlocks, a new run: every variant open. Ward's first and Reel's second by click, Chime's first by the keyboard (down from the default, which moves the focus), Glide's charged one by click. Every slot's radio is checked; the hook's profile and run hold them.
3. Embark into the first fight: its config's `techniques` are exactly those; each slot names its variant; Skate's charges are on the slot.
4. Real input: 1 threads Kael, Q casts the Ward's variant (exactly one Perfect-capable Chorale barrier; the others plain). Space spends a charge: one left and the slot still ready. Space again: none left, and it waits.
5. Win it: the run keeps what it embarked with. No console errors.

Per the brief, I didn't run the Playwright suite. I ran the spec's Phase 4f test against my own dev server (port 5431, file watching and HMR off, so the other workstreams' edits couldn't reload it mid-test) with a scratch config: it passed, and again on the final code. Against the same server, the tests nearest the screens I changed still pass: the boot into the Training Grounds, real input, Phase 3e (Rewind in Reel's slot), and Phase 4d and 4e (Prep's other panels).

- `npm run typecheck`: `tsconfig.sim.json` and `tsconfig.app.json` pass; `tsconfig.node.json` fails only on `src/app/demo.ts` (`import.meta.env`), another workstream's new file, which `tests/demo.test.ts` imports. Nothing of mine.
- `npm run lint`: ESLint passes; Prettier flags `src/sim/combat/health.ts`, `src/sim/combat/telegraphs.ts`, `src/sim/systems/calls.ts` and `tools/harness-core.ts`, the review's work in progress. My files are formatted.
- `npx vitest run`: all 1,457 tests in 70 files pass, this file's 25 among them.

## Screenshots

All are under `ui/`, taken with Playwright at 1280 wide on my dev server. Lab views use `nav=0&fit=0`, one browser page each, animations paused after they settle, clipped to the stage; the PNGs are 2× crops. The `real-*.jpg` shots are the real app, driven through the run hook and real input. I looked at every one. The fixes this led to:

- **The Training tools ran off a 720-high screen and over the Weaver bar** once the techniques joined them. The panel now stops above the bar and scrolls, and the techniques block lost its note line ("every variant open" sits beside its heading).
- **The changed cost wrapped the card's stats line** ("25 Spirit (was 20 Spirit) · 7 s cooldown"). It reads "25 Spirit (Ward 20)".
- **A locked card's state in the Codex crowded its name** (Phase Step broke onto two lines under "Starlight, from the Chronomancer's top mastery"). The state says "Locked"; how it's had is the card's own line.
- **The empty live line left a gap** under the panel's heading. It takes no room until it has something to say.
- **The first HUD shot of the real app showed the pause menu.** The fight is held still with the dev time scale instead.
- **Chorale's outer arcs touched the glyph's edge** at 48 px. They were pulled in.

## Known gaps

- **How a variant is had** is Phase 4g's content when it's there, and the plan's (Rank 5; Chorale, Aegis Link and Phase Step with their Callings' top mastery) when it isn't, in one place (`variantSource`). The locked cards name Starlight before anything sells it: until Phase 4g's Atelier, only Skip the unlocks and the Training Grounds open a variant.
- **The Aegis Link isn't on the frames.** The link lives in `world.internal.link`, not in `WorldState`, so the HUD can't mark the two heroes (or the one, when no other hero stands). The views draw it in the world.
- **The rejection callout says the slot's name** ("Ward: not ready") with a variant in it, since the runtime writes it (`src/app/runtime.ts`). The slot still buzzes, and its name is under it.
- **The Training tools scroll** on a 720-high screen: the staged situations (Stage a call, the dummies) are below the fold there.

## Outside my area

I made no changes to `src/sim`, `src/meta`, `src/content`, `src/audio`, `src/render`, the stores or `tools`. Outside `src/ui` I changed only `src/app/testHook.ts`, `src/app/testHookTypes.ts`, `e2e/smoke.spec.ts` and `tests/uiPhase4f.test.ts`. Nothing about the auras changed.

Asked of others:

- **The Aegis Link for the HUD**: `WorldState` exposing the link (`a`, `b`, `weaver`, `until`), or the runtime forwarding the `linked` event to the UI store, would let the frames mark the linked heroes (one, when it links a hero alone).
- **The rejection callout's name** (`src/app/runtime.ts`): with a variant in the slot, its name ("Chorale: not ready").
- **`variantPick`** (audio): if it's added, `VARIANT_SOUNDS.choose` changes to it.
- **docs/phase-4f.md's Presentation section** can link here.

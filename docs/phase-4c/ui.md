# Phase 4c UI: the Reliquary

*Owner: the UI workstream (`src/ui/**`). Builds on [Phase 4b's UI](../phase-4b/ui.md). Spec: [docs/phase-4c.md](../phase-4c.md).*

Everything here can be reviewed without playing: open **`/?lab=ui`** (new sidebar group **Reliquary**) or `/?lab=ui&view=<id>&nav=0`.

Every name, number and odd on these screens comes from content (`inscriptionDef`, `inscriptionText`, `curseText`, `relicText` and `relicValues`, `CONTENT.reliquary`) or meta (`craftOdds`, `craftBlocked`, `fractureChance`, `releaseValue`, `inscribable`, `carriedRelics`, `chooseCarry`, `enshrineOptions`, `runMaterials`). Nothing is hard-coded. Two changes landed while this was built and came through without a code change to the numbers: the halved affixes (steps of 0.5, values such as 1.5 and 0.015) and attunement's flags (`OwnedRelic.dormant`). The tests read their numbers from the same functions.

The screen is built around one decision, made again and again: craft once more, or stop. So before the click, every craft shows what it costs, its odds, its chance to Fracture and what the craft after it would risk. After it, the screen shows what happened, with its sound and a small effect.

## What changed, by screen

| Where | What | Files |
|---|---|---|
| **The Reliquary** (new screen) | Its own screen between runs, from the Title and from Prep (Back returns to where it was opened; Esc too). **Header**: Tuning Shards and Discord Tears with their glyphs; on hover or focus, where they come from (from content: "2 for each fight it won, 2 more for an elite, 3 more for the Bellwarden and 5 more for the Hollow Cantor"). **Rules** opens the Codex's page in place, so Back still knows Prep from Title. **The carry** across the top (below). **The shelf**: the enshrined relics as tiles, "6 of 12 enshrined" (orange and "full" at 12), empty niches for the room left. A tile has the relic's glyph in its rarity's ring, a rarity mark in its corner (diamonds, stars, a skull or a check), its name, its Inscriptions' tier badges or its state (Fractured; Dissonant, Empowered, Cursed, Shattered), and a carry mark (gold attuned, grey dormant). Arrow keys move between tiles. **The detail**: the relic's own effect (`relicText(def, empowered)`; Empowered shows what it was), a cursed relic's own curse (struck once cleansed), the **Instability** bar (calm blue to the threshold, orange past it, the 40 marked and numbered, the previewed craft striped on top), its Fracture line, then its **Inscriptions** (tier badge, name, kind, line, the tier's range and where the value sits in it), a Dissonant slot and a Reliquary curse. **The crafts** on the right (below). A live region says every outcome, refusal and carry change | `screens/ReliquaryScreen.tsx`, `screens/ReliquaryParts.tsx`, `screens/reliquaryModel.ts`, `kit/reliquaryLook.ts`, `kit/iconPaths.ts`, `store.ts`, `app/App.tsx` |
| **Crafting** | Five tabs (arrow keys move): **Inscribe** (five kinds in their colours, each with how many it could still add; a kind it can't take is locked, its reason under the row), **Retune** and **Ascend** (each Inscription with its odds; a tier of one value, or T3, is locked with the meta's reason: "T2 and T1 wait for Dissonance."), **Dissonate** (the four outcomes for this relic) and **Release** (asked first, with its shards and how they add up). **The preview** before every craft: cost (and what you have), Fracture chance, Instability before and after and what the craft after it would risk, the odds as bars, and what's at stake in plain sentences. When a Fracture is possible the odds are labelled "If it doesn't Fracture", with the **overall** chances under them (an Ascend at 74 Instability: "it rises 36.8%, it misses 12.3%, it Fractures 51%"). A craft that can't be made says why (`craftBlocked`) above its button; the button stays focusable, and a click says why again with `cantAfford` (short of materials) or `error`. **After**: an outcome card (what was added or changed, a miss, a Fracture, a Dissonate's outcome) and its sound; the line it changed scrolls into view with its effect | `screens/ReliquaryScreen.tsx`, `screens/reliquaryModel.ts` |
| **The carry and attunement** | One slot per Rank that opens one: open ones filled or empty, locked ones saying "Opens at Rank 15" / "Opens at Rank 20" (content's `slotRanks`). **Slot 1 is attuned** ("Attuned: its effect and Inscriptions"), slots 2 and 3 "Lend their Inscriptions". **Carry** adds a relic; **Attune** moves one to the first slot (`setCarry` with the new order); **×** takes one out. Never two of the same relic, never past the slots: the detail says why before any click ("You carry another Cantor's Hymnal already: a run never carries two of the same relic.", "All 2 carry slots are full: take a relic out first. Rank 20 opens a third slot."). A dormant relic's own effect is struck through in the detail, with "Attune it to wake it" | `screens/ReliquaryScreen.tsx`, `screens/reliquaryModel.ts` |
| **Summary** | **The Reliquary** panel, for a run that ended with it open: what the run paid ("+22 Tuning Shards and +1 Discord Tear"). A won run lists `enshrineOptions(run)` as cards (name, rarity, effect, curse, "It arrives with 2 Inscriptions, and cleansed."); **Enshrine** calls `useRun.getState().enshrine(id)`, plays `enshrine`, and shows the relic as it arrived, its first Inscriptions etched. Once only. A **full** Reliquary says so and lists its relics, each with **Release** (asked first): the options wait until there's room. A lost run: what it paid. The relics list marks carried relics (attuned or dormant, with their Inscriptions) and the one enshrined | `screens/ReliquarySummary.tsx`, `screens/SummaryScreen.tsx` |
| **Prep** | A compact **Reliquary** row under the header: the button that opens the screen ("Carrying 2 of 2"), and each slot: the carried relic (`run.carried`) with "attuned" or "lends" and its tiers, its effect and Inscriptions on hover or focus; empty slots; locked slots with their Rank | `screens/ReliquaryParts.tsx`, `screens/PrepScreen.tsx` |
| **In a run** | **The HUD**: the attuned relic's tile carries a gold mark; the dormant ones (not in the fight) follow it, dimmed, with a grey mark. Every relic tile now has a tooltip (hover or focus): a carried one's lists its Inscriptions, a dormant one's strikes its own effect. **The run strip** (map, merchant, forge, relic offers, events) marks carried relics the same way and lists their Inscriptions in the tooltip. **Empowered** relics read their own numbers everywhere in a run (`relicInfo`, and the HUD's cooldown rings from `relicValues`) | `hud/RelicBar.tsx`, `hud/Hud.tsx`, `hud/relics.ts`, `screens/RelicCard.tsx`, `screens/interlude.ts`, the five screens with a strip |
| **Codex: The Reliquary** (new tab) | Locked until Rank 10 (a lock on the tab; the page shows the unlock's text, "It opens at Weaver Rank 10 (you're Rank 6)", and Skip the unlocks). Open: enshrine and carry, **attunement**, the materials; the crafts' table; Instability and Fracture (with a bar at 60); Dissonate's four outcomes and what a relic with nothing to grow does; every Inscription with its five tiers (T2 and T1 dimmed: they wait for Dissonance); the Dissonant Inscriptions and the curses; the Empowered relics, before and after | `screens/ReliquaryCodex.tsx`, `screens/CodexScreen.tsx` |
| **Rank-ups, Rank panel, Codex's Rank list** | The two unlock kinds have icons (`UNLOCK_ICON`: the shrine, a relic carried) and, on the rank-up card, a lit disc in the carry's gold and a line from content: "One relic to carry now; Rank 15 gives a second and Rank 20 gives a third." / "Only the first slot is attuned…". The Codex's Rank list shows every unlock's icon. The Rank panel's title no longer wraps beside a long record | `screens/Rank.tsx`, `screens/rankText.ts`, `screens/CodexScreen.tsx` |
| **Title** | A **Reliquary** item once it's open (Rank 10, or Skip the unlocks), with the shards and Tears to craft with | `screens/TitleScreen.tsx` |
| Settings | Reset progress warns that the Reliquary (its relics and materials) is cleared too | `screens/SettingsScreen.tsx` |
| Review fixes | **Draft**: "Your Star Chart adds a fourth choice" asks `Run.relicActive` (a dormant Star Chart gives none). **HUD**: an Empowered Silver Thimble's ring counts 3 s and the Metronome's 9 s (`relicValues` with the sim's new `relics.empowered`) | `screens/DraftScreen.tsx`, `hud/relics.ts`, `hud/RelicBar.tsx` |
| Test hook | `reliquary()` (the profile's Reliquary, slots and materials; the run's carried relics, their dormancy and what its end paid), `seedReliquary(seed)` and `winRun(found)` (test-only) | `app/testHook.ts`, `app/testHookTypes.ts` |

## The Reliquary screen

| At Rank 10: nothing enshrined | Partway (Rank 15): six relics, two carried |
|---|---|
| ![](ui/reliquary-empty.jpg) | ![](ui/reliquary-partway.jpg) |

| Full (Rank 20): every state, three carried, a Dissonant one shown | Four Inscriptions: Inscribe refused at the button |
|---|---|
| ![](ui/reliquary-full.jpg) | ![](ui/reliquary-four.jpg) |

| The shelf (2×) | The detail's Inscriptions (2×) |
|---|---|
| ![](ui/shelf.png) | ![](ui/inscriptions.png) |

- **It fits 1280×720.** Three columns: the shelf (23 rem), the detail, the crafts (24 rem); the carry above. The detail and the crafts scroll inside themselves when a relic holds everything; a craft brings the line it changed, and its outcome card, into view (only those panels scroll). Below 1280 the columns stack and the page scrolls.
- **Tiers read better as they rise.** T5 slate, T4 seafoam, T3 gold, T2 ember, T1 starlight: each brighter, more filled and more aglow than the last, and one pip per step (T5 one, T1 five), so colour is never alone. A small bar beside each range shows where the value sits in it: what a Retune could gain.
- **Kinds are the Astrolabe's constellations** (an Inscription adds to the same sums as their stars): Silk gold, Choir violet, Aegis ice, Bond coral, with their glyphs and names. The Weaver is a pale sage with the Weaver's Star, at least ΔE 27 from the four in every colour-vision mode (the test asks for 20).
- **States**: Fractured (an orange crack across the glyph, for good), Dissonant (a violet ring), Empowered (a gold ring that glows), Cursed (a dashed rose ring), Shattered (a dashed grey ring), each also a chip with its glyph and word.

## Crafting: before the click

| Inscribe: Choir is full on Silver Thimble | Retune: a value at the top can only stay or drop |
|---|---|
| ![](ui/reliquary-inscribe.jpg) | ![](ui/reliquary-retune.jpg) |

| Ascend: T3 waits for Dissonance | 74 Instability: the Fracture comes first |
|---|---|
| ![](ui/reliquary-ascend.jpg) | ![](ui/reliquary-risky.jpg) |

| Dissonate: the four outcomes for Prism Loom | Martyr's Veil: nothing to grow, so Dissonant 50% |
|---|---|
| ![](ui/reliquary-dissonate.jpg) | ![](ui/reliquary-dissonate-veil.jpg) |

| Short of shards: the reason before the click | Release: asked first |
|---|---|
| ![](ui/reliquary-short.jpg) | ![](ui/reliquary-release.jpg) |

| The preview (2×) | Dissonate's odds (2×) |
|---|---|
| ![](ui/craft-preview.png) | ![](ui/dissonate-odds.png) |

- **The preview is `craftOdds`'**: cost, Fracture chance, Instability after, the tier odds, Ascend's success, Dissonate's outcomes. The test compares them for every relic of content, eight Instabilities around the threshold and every action and choice: 2,640 previews.
- **Honest odds.** The Fracture is rolled first, so the tier odds and Ascend's chance hold only if it doesn't: past 40 they're labelled "If it doesn't Fracture" and the overall chances follow. Chances show to a tenth of a percent ("10.5%"), never rounded into a lie.
- **Retune shows "Higher / The same / Lower"**: each value of the tier, in content's steps, is as likely. The test runs `retune` 600 times per Inscription and tier and finds exactly those values, each about as often.
- **The reason is the meta's** (`craftBlocked`). A kind or an Inscription that can't be chosen is locked with its own reason; a reason that applies to the whole craft (four Inscriptions already, not enough shards, no Tear) shows above the button.

## After the craft

| A fine Inscription (T3): etched | Retune: a higher value |
|---|---|
| ![](ui/reliquary-inscribed.jpg) | ![](ui/reliquary-retuned.jpg) |

| Ascend rose | Ascend missed |
|---|---|
| ![](ui/reliquary-ascended.jpg) | ![](ui/reliquary-missed.jpg) |

| A Fracture | Dissonate: the roll, before its outcome |
|---|---|
| ![](ui/reliquary-fractured.jpg) | ![](ui/reliquary-rolling.jpg) |

| Dissonant: a fifth slot | Empowered |
|---|---|
| ![](ui/reliquary-dissonant.jpg) | ![](ui/reliquary-empowered.jpg) |

| Cursed: every Inscription a tier up, and a curse | Shattered |
|---|---|
| ![](ui/reliquary-cursed.jpg) | ![](ui/reliquary-shattered.jpg) |

![With reduced motion: the new line outlined, nothing moving](ui/reliquary-inscribed-rm.jpg)

| Outcome | Sound | Effect (CSS) |
|---|---|---|
| Inscribed | `inscribe`; `inscribeFine` for T3 or better | a gold sweep along the new line (brighter for a fine one, its badge flares) |
| Retuned | `retune` | the value tunes (a small wobble) |
| Ascended | `ascend` | the badge rises into place |
| Missed | `ascendMiss` | the badge shakes once and greys |
| Fractured | `fracture` | a crack draws across the glyph; the glyph jolts |
| Dissonated | `dissonate`, then the outcome's: `dissonant`, `empowered`, `cursedRelic`, `shattered` | a swirl for the roll (1.6 s, the sound's length; the relic shows as it was until then), then a ring bursts in the outcome's colour; Cursed raises every badge and etches the curse; Shattered throws splinters |
| Released | `release` | — |
| Carried, attuned | `carry` | — |

- **What it says** is the outcome's own: the new Inscription's line and its tier's range; a Retune's "1% → 1.5%"; an Ascend's "T5 1.5% → T4 3%"; a miss's "The 8 Tuning Shards are spent, and Instability rose to 59."; a Cursed relic's rises one by one, and its curse. The live region says the same.
- **Reduced motion**: nothing moves. The changed line or relic is outlined for two seconds, the roll's swirl stands still, the splinters and the burst don't show.
- **Real crafts in the lab.** Each outcome view runs the meta's own craft on the first seed that gives it (`mockCraft`), so what the lab shows is what a player gets.

## The carry and attunement

| Slot 2 is dormant: its own effect struck, Attune to wake it | Never two of the same relic |
|---|---|
| ![](ui/reliquary-dormant.jpg) | ![](ui/reliquary-twin.jpg) |

![The carry bar (2×)](ui/carry-bar.png)

- **Attunement is the carry's order.** The first uid is attuned; **Attune** moves a relic to the front and keeps the others' order (`attuneChange`), so the store's `setCarry` is all it needs. A relic not yet carried goes in last; with slot 1 empty it's attuned.
- **What the screen asks for is what the store keeps.** `carryChange` refuses what `chooseCarry` would drop (a second copy, a slot too many) and says why first; the test checks every carry the screen produces against the store.
- **What a run carries** follows the profile until it embarks (the run store's subscription), so Prep's row changes as the screen does.

## The Summary

| A won run: choose one to enshrine | Enshrined: its first Inscriptions |
|---|---|
| ![](ui/summary-enshrine.jpg) | ![](ui/summary-enshrined.jpg) |

| A full Reliquary: release one first, here | A lost run: what it paid |
|---|---|
| ![](ui/summary-enshrine-full.jpg) | ![](ui/summary-reliquary-lost.jpg) |

![The panel (2×)](ui/summary-panel.png)

- **Once is all.** The panel reads `run.reliquary` (what was paid, what was enshrined) and the profile's Reliquary (its room). After an enshrine the options go and the relic stays shown, as `enshrine` returned it. The run store refuses a second.
- **Full**: the options stay visible but their buttons say why. Releasing one (asked first, with its shards) opens them. The player never has to leave the Summary.
- **After a reload** the run keeps only the enshrined relic's id: the panel shows the newest relic of that id in the Reliquary (see *Known gaps*).

## Prep and the run

| Prep at Rank 15: the row | Prep at Rank 20: three carried |
|---|---|
| ![](ui/prep-reliquary.jpg) | ![](ui/prep-reliquary-20.jpg) |

| The map: an attuned relic's tooltip | A dormant one's |
|---|---|
| ![](ui/map-reliquary.jpg) | ![](ui/map-reliquary-dormant.jpg) |

| The HUD: attuned, then two dormant | Its tooltip (2×) |
|---|---|
| ![](ui/hud-reliquary.jpg) | ![](ui/hud-relic-tip.png) |

![Prep's row (2×)](ui/prep-row.png)

- **The HUD's relics come from two places.** The fight's own (`WorldState.relics`, with `empowered`) for what plays; the run's `carried` for what's carried. The dormant ones aren't in the fight, so the bar adds them after, dimmed. In the Training Grounds the carry comes from the profile, as the fight's does.
- **The HUD's top-left group** (header, relics, Calling and keystone chips) now sits a layer above the party frames, so a long tooltip is never under Kael's frame.

## Codex, Ranks, Title

| Codex: the Reliquary | Codex: locked (Rank 6) |
|---|---|
| ![](ui/codex-reliquary.jpg) | ![](ui/codex-reliquary-locked.jpg) |

| Rank 10 | Ranks 15 and 20 |
|---|---|
| ![](ui/rank-up-10.jpg) | ![](ui/rank-up-15-20.jpg) |

| Rank panels at 9 and 14 | Title at Rank 16 |
|---|---|
| ![](ui/rank-panels-reliquary.jpg) | ![](ui/title-reliquary.jpg) |

![The Rank 10 card (2×)](ui/rank-up-10-card.png)

![Codex: Weaver Rank, every unlock with its icon](ui/codex-rank-reliquary.jpg)

## In the real app

The dev server, driven through the run hook like the e2e: Skip the unlocks, three relics seeded, an Inscribe, the carry, the map, the first fight, a won run's Summary.

| Title | Before the craft | After it |
|---|---|---|
| ![](ui/real-title.jpg) | ![](ui/real-preview.jpg) | ![](ui/real-crafted.jpg) |

| The carry, then Ascend at 52 Instability | Prep | The map |
|---|---|---|
| ![](ui/real-carry-ascend.jpg) | ![](ui/real-prep.jpg) | ![](ui/real-map.jpg) |

| The fight's HUD: Prism Loom attuned | Cantor's Hymnal dormant (its Hardy still counts: Kael has 1,616 life of 1,600) |
|---|---|
| ![](ui/real-hud.jpg) | ![](ui/real-hud-dormant.jpg) |

| Summary | Enshrined |
|---|---|
| ![](ui/real-summary.jpg) | ![](ui/real-enshrined.jpg) |

## Lab views

The new **Reliquary** group, every one interactive (the meta's own functions on local state: craft, release, carry and attune all work):

- **The screen**: `reliquary-empty`, `reliquary-partway`, `reliquary-full`, `reliquary-four`.
- **Previews**: `reliquary-inscribe`, `reliquary-retune`, `reliquary-ascend`, `reliquary-risky`, `reliquary-dissonate`, `reliquary-dissonate-veil`, `reliquary-short`, `reliquary-release`.
- **Outcomes** (real crafts): `reliquary-inscribed`, `reliquary-retuned`, `reliquary-ascended`, `reliquary-missed`, `reliquary-fractured`, `reliquary-rolling`, `reliquary-dissonant`, `reliquary-empowered`, `reliquary-cursed`, `reliquary-shattered`.
- **The carry**: `reliquary-dormant`, `reliquary-twin`.
- **Summary**: `summary-enshrine`, `summary-enshrined`, `summary-enshrine-full`, `summary-reliquary-lost`.
- **Prep, the run**: `prep-reliquary`, `prep-reliquary-20`, `hud-reliquary`, `map-reliquary`, `map-reliquary-dormant`.
- **Codex, Ranks, Title**: `codex-reliquary`, `codex-reliquary-locked`, `rank-up-10`, `rank-up-15-20`, `rank-panels-reliquary`, `codex-rank-reliquary`, `title-reliquary`.

New mock data in `lab/mock.ts`: `mockInscription(id, tier, at)` (a value `at` 0–1 through the tier's range, in content's steps, so the lab follows the tuning), `mockRelic`, `EMPTY_RELIQUARY`, `partwayReliquary()`, `fullReliquary()`, `craftOn`, `mockCraft(rq, uid, action, arg, want)` (a real craft on the first seed that gives the wanted outcome), `dissonated(kind)` and `reliquarySummaryRun(outcome)`.

## Tests and checks

`tests/uiPhase4c.test.ts` has 27 tests:

- **Numbers from content**: chances to a tenth of a percent; every Inscription's unit, tiers, ranges and steps; Retune lands on exactly the values the screen lists (600 real retunes per Inscription and tier); a relic's effect, curse, Inscriptions, Dissonant slot and Reliquary curse as content writes them; Instability's threshold and Fracture lines; the Codex's Fracture examples.
- **Every preview is `craftOdds`' and `craftBlocked`'s**: cost, odds, Fracture, Instability after, the next craft's risk, the overall odds when a Fracture comes first, the refusal and its sound, for every relic of content at eight Instabilities, with and without materials (2,640 previews).
- **Locks**: a kind it can't take, T3 waiting for Dissonance, a tier of one value, a fractured or Dissonated relic, a relic at four Inscriptions; Dissonate's odds for every relic (a relic with nothing to grow); Release's shards.
- **Outcomes** (real crafts): each kind's title, lines, sound and effect, including all four Dissonate outcomes and a Cursed relic's rises.
- **The carry**: slots by Rank with their locked Rank; never two of the same relic, never past the slots, the reason first; Attune through the store, and the run in Prep following (attuned first, the rest dormant); every carry the screen asks for is kept by the store as it is; a run's relics read as carried, attuned or dormant; a dormant Star Chart isn't active; an Empowered Thimble's and Metronome's cooldowns in the HUD.
- **The enshrine flow through the stores**: a won run pays, offers what it found (not what it carried), enshrines once with content's count of Inscriptions; a full Reliquary refuses, releases one, then enshrines; a lost run pays and offers nothing; below Rank 10 nothing is paid and the panel is closed.
- **Codex, Ranks, Title, looks**: every Inscription with its five tiers; the Empowered relics and those with nothing to grow; the materials' lines; Rank 10, 15 and 20 with their icons and lines; the Weaver's colour apart from the four in every colour-vision mode; tiers rising; every new colour at least 4.5:1 on what it's drawn on.

`e2e/smoke.spec.ts` gains "**Phase 4c: the Reliquary — from Prep, craft, carry and attune, embark with it, enshrine at the Summary**":

1. Skip the unlocks; `seedReliquary` (two relics, shards, a Tear); `newRun`. Prep's row carries nothing; its button opens the Reliquary.
2. Prism Loom, Inscribe Aegis: the preview's cost, Fracture and Instability are content's; the craft lands (the shards drop by the cost, an Aegis Inscription joins it, the detail names it).
3. Carry Prism Loom, then Cantor's Hymnal; Attune the Hymnal: the carry is `['r2', 'r1']`, and Prep's run carries the Hymnal attuned and the Loom dormant.
4. Esc: Prep's row shows both, the Loom dormant. Embark: the map's strip marks them attuned and dormant, and the Loom's tooltip names its new Inscription.
5. The first fight's config plays the Hymnal alone and all three Inscriptions; the HUD marks the Hymnal and shows the Loom dormant.
6. Win it, then `winRun(['tuning_fork'])`: the Summary's panel offers the Tuning Fork and neither carried relic; the shards are paid; enshrine it: it arrives with content's count of Inscriptions, and the panel offers nothing more.

Per the brief, I didn't run the Playwright suite. It type-checks and lints. I ran the same test body as a script (generated from the spec, so they can't drift) against the dev server on port 5287, with and without tracing: it passed both times with no console errors. That run is where the test learned to dismiss the rank-up card at the Summary.

- `npm run typecheck` (all three configs) passes.
- `npm run lint` (ESLint and Prettier over the repo) passes.
- The full `npx vitest run` passes: 54 files, 1109 tests, with the other workstreams' tests.

## Screenshots

All are under `ui/`, taken with Playwright at 1280 wide. Lab views use `nav=0&fit=0`; the PNGs are 2× crops. The `real-*.jpg` shots are the real app on the dev server, driven through the run hook. I looked at every one. The fixes this led to:

- **The craft button fell below the fold.** The kinds are one row now, the preview's numbers three columns.
- **The new line was out of sight** after an Inscribe on a full relic, and a Cursed relic's curse too. The panel scrolls the last changed line into view (only that panel: `scrollIntoView` moved the whole screen).
- **"Rises to T4 75%" read as the whole chance** at 74 Instability, where a Fracture comes first (51%). The odds are labelled "If it doesn't Fracture" now, with the overall chances.
- **A Dissonate's roll showed the next craft's preview** (and "1 of 0" Tears). The roll shows only itself until the reveal.
- **The detail's Fracture line** said "every craft" risks one. It names Inscribe, Retune and Ascend: a Dissonate never does.
- **The Dissonate glyph was a blob** at 16 px. Its spiral's turns are wider apart.
- **The HUD's relic tooltip went under Kael's frame.** The top-left group sits a layer above.
- **Names ran under the rarity mark** on the shelf ("Choirmaster's"), and a fourth tier badge would clip. The shelf is a little wider, the small badges slimmer.
- **Shelf tiles told common from rare by colour alone.** They wear a rarity mark.
- **Inscription rows were three lines.** Two now (the range beside the name), so four Inscriptions fit beside the Instability bar.
- **The Rank panel's title wrapped** beside "21 runs · 9 wins". The record wraps instead.
- **The arrival card left out a cursed relic's own curse.** It shows it (struck once cleansed).
- **A tier of one value read "T3 ranges 0.015 s".** It reads "T3 is always 0.015 s".
- **The empty Reliquary's crafting panel was bare.** It says what pays for crafting and where it comes from.
- **The Codex page was cut off** at the Empowered relics. The view is taller.
- **Batched screenshots sometimes timed out** waiting for a stable stage; each view now runs in its own process.

## Known gaps

- **The song builder doesn't count carried relics' numbers.** Its "−N% from the Astrolabe" includes a carried Light Reserve or Choral Swell (the run's `reserveMult` does), and its Life budget and technique costs ignore a carried Vigor or Light Hands (it mirrors the tree only). Legality is unaffected (it's a ratio); the fight's HUD shows the real numbers. A `treeMods(nodes, passives)` export would let the builder read them.
- **After a reload at the Summary**, the panel shows the newest relic of the enshrined id (the run keeps the id, not the uid).
- **Retune's odds** ("each value as likely") mirror `rollValue`'s rule; the test pins them to real retunes.
- **The Dissonate reveal waits 1.6 s** (the roll sound's length), with or without reduced motion.
- **The screen is designed for 1280 and wider.** Narrower, its columns stack and the page scrolls.
- **HUD relic tooltips take the pointer** where the relic bar is (as the keystone chip's do).
- **Accessibility**: Inscription lines read their content in order (tier, name, kind, range, line) rather than one label; the materials are a named group, not a live region, so a craft is announced once.

## Outside my area

I made no changes to `src/sim`, `src/meta`, `src/content`, `src/audio`, the stores or `tools`. Outside `src/ui` I changed only `src/app/App.tsx` (the route), `src/app/testHook*.ts`, `e2e/smoke.spec.ts` and `tests/uiPhase4c.test.ts`. What would help:

- **`run.reliquary.enshrined` as a uid** (or the enshrined relic itself), so the Summary can show exactly the relic after a reload.
- **A meta `tierValues(def, tier)`** (the values `rollValue` can roll), so Retune's odds aren't a mirror.
- **`treeMods(nodes, passives)`** for the builder (above).
- **The `carrySlot` unlock's text** could mention attunement; the rank-up card adds a line for it.
- **Content wording**: the Empowered Cantor's Hymnal reads "Start every fight with 75 Resonance: two Cues, ready." At 25 Resonance a segment, that's three.
- **docs/phase-4c.md's Presentation section** can link here.
- **Auras**: nothing about them changed.

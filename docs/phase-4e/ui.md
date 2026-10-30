# Phase 4e UI: Bonds

*Owner: the UI workstream (`src/ui/**`). Builds on [Phase 4d's UI](../phase-4d/ui.md). Spec: [docs/phase-4e.md](../phase-4e.md).*

Everything here can be reviewed without playing: open **`/?lab=ui`** (new sidebar group **Bonds**) or `/?lab=ui&view=<id>&nav=0`.

Every name, number and line on these screens comes from content (`CONTENT.talents` and `talentText`, `CONTENT.altSolos` and `altSoloText`, the heroes' own Solos, `CONTENT.scenes`, `CONTENT.bondRules`) or meta (`bondRank`, `bondProgress`, `tierRank`, `soloRank`, `talentChoices`, `altSoloOf`, `rankOpens`, `sceneWaiting`, `sceneXp`, `bondedHeroes`, `runBonds`). Content was tuned while this was built (Bond XP's base 8 → 12 and pool 24 → 30; most talents' numbers; Oathkeeper's radius and share; Event Horizon's and three other texts): it all came through with no change to a screen, and the screenshots show the numbers of the day they were taken. A scene's lines are content's too: a hero's line is quoted as their own words, narration and the answer are prose. The words that aren't content's are the screens' own connective ones ("Sit with Kael", "Bonds deepen", "a skirmish ×1").

The decision the screens are built around: **who are they becoming?** So each hero has a page that shows where their Bond stands and what each rank ahead opens, the two talents of each tier side by side (a real choice, either way, or neither), their two Solos side by side, and their scenes; Prep says what each hero brings into this run; the fight says it again on their frame; and every rank-up says what it opened and where to choose it.

## What changed, by screen

| Where | What | Files |
|---|---|---|
| **The Bonds screen** (new, from the Title and from Prep) | A **tab per hero** (Kael, Lyra, Vexis: portrait, title, Bond rank; ←/→ move between them). Each page: the hero by the fire, **Bond rank** and the **XP bar** ("91 / 200 Bond XP to rank 5"), what the next opening rank opens ("Rank 6 opens talents, tier II."), and the **ranks 1–10** as a track, each with a glyph where it opens something (a talent tier, the alternate Solo, a scene; named on hover and to screen readers). **Talents**: three tiers, two talents each, as toggle buttons (`aria-pressed`): choose one, choose it again to clear it, or the other; they go straight to the profile (`setTalent`). A **locked tier** is dashed with a lock and names its rank ("Opens at Bond rank 6."); a click there says so where the hint was, and changes nothing. **Solo**: their own and the alternate side by side, each with its uncued and cued lines, as a radio pair (arrows switch; `setSolo`); the alternate is locked until its rank ("The alternate Solo opens at Bond rank 10."). **Scenes**: seen ones with the reply you chose and **Read it again** (a dialog with the whole scene and your reply), the one a Respite will offer ("Waits for a Respite: sit with Kael there instead of resting (+56 Bond XP)."), one queued behind it ("…after “The Dented Shield”."), and locked ones with their rank. **Skip the unlocks** opens every tier and both Solos (each says so: "Rank 6 (Skip the unlocks)"), and a line says scenes still wait for real ranks. Opened from the Title mid-run, a line says the run keeps what it embarked with. **Rules** opens the Codex's Bonds page; **Esc** goes back to Prep or the Title. A live region reads each choice ("Kael: Vanguard’s Roar, tier I.") | `screens/BondsScreen.tsx`, `screens/BondsParts.tsx`, `screens/bondsModel.ts`, `kit/bondLook.ts`, `kit/iconPaths.ts` |
| **Title** | A **Bonds** button, once Bonds open (a hero's first Bond rank-up, or Skip the unlocks), with each hero's rank on it ("K4 L4 V4"; read out as "Bonds: Kael 4, Lyra 4, Vexis 4") | `screens/TitleScreen.tsx` |
| **Prep** | A **Bonds row** under the Reliquary's (once open): each hero's portrait, name and Bond rank, the talents this run plays (tier numeral and name, the text on hover), or "No talent chosen" / "Talents from Bond rank 3", and the Solo they bring (gold when it's the alternate); **Bonds** opens the screen. It reads `run.bonds`, which follows the profile until embark. The **hero cards** name the Solo the run brings (the alternate, "from their Bond", with its lines) and list the talents with their texts | `screens/PrepScreen.tsx`, `screens/BondsParts.tsx` |
| **Result** | Under each hero in **The party**: the Bond XP the fight paid ("+18 Bond XP", `EncounterResult.bondXp`), a bar in their colour (what they had, and the gain striped) and their rank ("Rank 4", "new" when it rose) | `screens/ResultScreen.tsx`, `screens/BondsParts.tsx` |
| **Summary** | A **Bonds** panel after the Weaver XP: each hero's portrait and rank, the Bond XP the run's fights paid, the bar, "Rank 5 reached" when it rose | `screens/SummaryScreen.tsx`, `screens/BondsParts.tsx` |
| **Bond rank-up cards** | After the Weaver's rank-up card (never with it): one dialog, a card per rank reached (`bondNotices`), revealed one at a time, each with the hero's portrait and rank and what the rank opened (`rankOpens`): **Talents, tier I** ("Steady Vanguard or Vanguard’s Roar. Choose one, or neither, on the Bonds screen, from the Title or from Prep."), **the alternate Solo** (its name, "Choose which Solo Vexis brings…", and its lines), **a scene** ("“Unbidden”: a scene with Kael waits for a Respite… (+176 Bond XP)", or "after “The Dented Shield”" when an earlier one is still unseen), or **nothing**, with the next opening ("Nothing new opens at this rank. Rank 6 opens talents, tier II."). The **first ever** introduces Bonds: who grows, how Bond XP is earned, what the ranks open, where to choose. **Onward** or Esc dismisses them all (`dismissBondNotices`). Shown on the Result, the Summary, and the map (a scene's Bond XP can reach a rank: its card waits for the map). The Deed toasts wait for it, as for the Weaver's | `screens/BondsParts.tsx`, `screens/ResultScreen.tsx`, `screens/SummaryScreen.tsx`, `screens/MapScreen.tsx`, `screens/DeedToasts.tsx` |
| **Respite** | When `scenesWaiting()` has scenes: below Rest, Meditate and Retune, **one choice per waiting scene** ("Sit with Kael", key **4**, then **5**): the hero by the fire, “The Dented Shield”, "+56 Bond XP with Kael.", "No healing and no motif." It calls `bondScene(id)`. The blurb says you can sit by the fire | `screens/RespiteScreen.tsx` |
| **The scene** | Rebuilt: the hero's **portrait by the fire** (a flicker, still under reduced motion), "Respite · by the fire", the title, the hero's name and title, their Bond rank; the **lines** (a hero's quoted, with their name in their colour and a rule; narration in italics); the **two replies** (keys **1** and **2**); then your reply ("You “You’re needed here.”"), the **answer**, what it pays ("+56 Bond XP with Kael") and **Continue** (**Enter**). The lines rise in one after another, about a second for them all; with reduced motion they're simply there. A scene reads in well under 20 seconds | `screens/SceneScreen.tsx`, `screens/SceneParts.tsx` |
| **HUD** | The hero snapshot carries the Solo they brought (`HeroComponent.soloId`: its id, name and both lines; the alternate flagged) and their talents (`HeroComponent.talents`), so everything that names a Solo names theirs: the portrait's charge tooltip, the Cue hint ("Vexis's Celestial Sphere is ready — press ⇧3 to Cue it"). **Frames** show a small **Bond rank** (the rings and the number) on the portrait's corner once Bonds are open. A frame's **tooltip** (pointing at it for half a second, or focusing it): the hero's Bond rank, their Solo ("· their alternate Solo") with its uncued and cued lines, and the talents in force this fight (tier, name, text); it describes the frame for screen readers too | `hudBridge.ts`, `store.ts`, `hud/PartyFrames.tsx`, `hud/Hud.tsx` |
| **Training Grounds** | They play with your current talents and Solos (the doc says so; the screen didn't pass them): `bondsConfig(runBonds(…))`, as a run would embark | `screens/TrainingScreen.tsx` |
| **Codex: Bonds** (new tab, after Heroes) | Locked until Bonds open (a lock on the tab; "Every fight pays Bond XP: this page opens with a hero’s first Bond rank-up. Settings → Skip the unlocks opens it now."). Open: what Bonds are; **Bond XP** (the base, the pool by your support, the weights by fight, a loss's share, a scene's share); **the ranks** (cumulative XP, what each opens, a scene's XP); then **each hero**: talents by tier with their ranks, their own and alternate Solos with their lines, and their **scenes** (seen ones open to read again, with your reply; the others "waiting for a Respite" or "not yet") | `screens/BondsCodex.tsx`, `screens/CodexScreen.tsx` |
| **Sounds** | The audio workstream's, each voiced for its hero (`detail.hero`): `bondRankUp` as each rank-up card appears (with its `rank`; with reduced motion, once, for the first), `talentPick` when a talent is chosen (`back` when cleared), `soloPick` when a Solo is, `sceneStart` as a scene opens, `sceneReply` with a reply. All named in one place, `BOND_SOUNDS` | `kit/bondLook.ts`, `screens/BondsScreen.tsx`, `screens/BondsParts.tsx`, `screens/SceneScreen.tsx` |
| Test hook | `bonds()`: each hero's XP, rank, talents, Solo and scenes seen, the notices, and the run's choices and scene; `seedBonds(xpByHero)`; `scenesWaiting()` | `app/testHook.ts`, `app/testHookTypes.ts` |

## The Bonds screen

| Rank 1: everything ahead | Rank 4: tier I chosen, the first scene seen |
|---|---|
| ![](ui/bonds-rank-1.jpg) | ![](ui/bonds-rank-4.jpg) |

| Rank 7 (Lyra): two tiers, a scene waiting | Rank 10 (Vexis): every tier and the alternate Solo |
|---|---|
| ![](ui/bonds-rank-7.jpg) | ![](ui/bonds-rank-10.jpg) |

| Skip the unlocks at rank 1 | A seen scene, read again |
|---|---|
| ![](ui/bonds-skip.jpg) | ![](ui/bonds-reader.jpg) |

![The tiers at rank 7: chosen, open and locked (2×)](ui/tiers.png)

- **The page's numbers are the meta's.** The rank and the bar are `bondProgress`; the track's ranks are `CONTENT.bondRules.ranks` and their glyphs `rankOpens`; a tier's rank is `tierRank`, the Solo's `soloRank`, a scene's XP `sceneXp`. The test checks every rank's edge and the XP either side of it, for every hero.
- **What the screen asks for is what the profile keeps.** A click on an open talent calls `setTalent` with it (or with null, on the chosen one); on a locked one it does nothing and says why. The test runs the same clicks through the store, where the run in Prep follows.
- **A choice above a hero's rank** (made under Skip the unlocks, which then went off) stays in the profile, as the meta keeps it: the tier shows it chosen and locked, a click clears it, and the run doesn't play it (`runBonds`).
- **It fits 1280 × 720**: the tabs sit in the header; below 1280 they take their own row, and below `lg` the page is one column.

## Title and Prep

| The Title: Bonds and each hero's rank | Prep at ranks 2–4 |
|---|---|
| ![](ui/title-bonds.jpg) | ![](ui/prep-bonds-early.jpg) |

![Prep at rank 10: every tier and the alternate Solos; the hero cards below name them](ui/prep-bonds.jpg)

![The Prep row (2×)](ui/prep-row.png)

- **The row and the hero cards read the run** (`run.bonds`): what it will play, which follows the profile in Prep (the run store) and is frozen at embark. The ranks are the profile's.
- **Closed until a hero's first rank-up**, as the spec opens the Bonds screen then: the Title's button and Prep's row appear with it (or Skip the unlocks). Until then Prep is as before; the Result already shows each fight's Bond XP.

## Results, the Summary and rank-ups

| The Result: each hero's Bond XP | The first Bond rank-up ever: Bonds introduced |
|---|---|
| ![](ui/result-bonds.jpg) | ![](ui/result-bond-first.jpg) |

| Rank-ups: a tier, and nothing (the next opening) | The Summary: rank 10's alternate Solo, rank 7's scene |
|---|---|
| ![](ui/result-bond-rankup.jpg) | ![](ui/summary-bonds.jpg) |

| The Summary's Bonds panel | The map after a scene: its rank-up |
|---|---|
| ![](ui/summary-bonds-panel.jpg) | ![](ui/map-bond-rankup.jpg) |

| The Result's party, Bond XP (2×) | The Summary's panel (2×) |
|---|---|
| ![](ui/result-party.png) | ![](ui/summary-panel.png) |

- **The Result's Bond XP is the result's** (`EncounterResult.bondXp`); the bar is the hero's Bond now (the profile, which already holds it) with the gain striped. A result from before Bonds shows none.
- **The Summary's is the run's**: its fights' `bondXp` added up, and the scenes it played (`RunState.scenes`, added at integration), each its `sceneXp`.
- **A card per notice, after the Weaver's.** The profile store's `bondNotices` hold every rank reached; the card waits while the Weaver's rank-up card is up, then shows them all and dismisses them together. "First ever" is `profile.introduced` without `'bonds'` (the card adds it on dismiss), so a card lost to a closed tab still introduces Bonds next time; Reset progress starts over.

## The Respite and the scenes

| One scene waiting: a fourth choice | Two waiting: 4 and 5 |
|---|---|
| ![](ui/respite-scene-1.jpg) | ![](ui/respite-scenes-2.jpg) |

| The Dented Shield | Unbidden |
|---|---|
| ![](ui/scene-kael_dented_shield.jpg) | ![](ui/scene-kael_unbidden.jpg) |

| Tailwind | Two Fletchings |
|---|---|
| ![](ui/scene-lyra_tailwind.jpg) | ![](ui/scene-lyra_two_fletchings.jpg) |

| Margins | The Unsolved Term |
|---|---|
| ![](ui/scene-vexis_margins.jpg) | ![](ui/scene-vexis_unsolved_term.jpg) |

![A reply chosen: your words, the answer, what it pays, Continue](ui/scene-reply.jpg)

- **The Respite asks the run store** (`scenesWaiting()`: one per hero, the first their rank reached and they haven't seen) and calls `bondScene`; the scene calls `endScene(reply)`, which marks it seen and pays `sceneXp`. The test plays one through the stores.
- **Keys**: 1–3 as before, 4 and 5 for scenes; in a scene 1 and 2 reply and Enter continues (once: the focused button's click is cancelled). The arrival guard keeps a held key from carrying over.

## In a fight

| Vexis brings Celestial Sphere: her frame's tooltip | Kael's own Solo and two talents (rank 7) |
|---|---|
| ![](ui/hud-bonds-alt.jpg) | ![](ui/hud-bonds-kael.jpg) |

![A frame's tooltip (2×)](ui/frame-tip.png)

- **The HUD reads the fight**: the bridge takes the Solo from `HeroComponent.soloId` and the talents from `HeroComponent.talents` (the lab's views build a real sim with those Bonds and take what the bridge reads). Only the Bond rank comes from the profile.
- **The tooltip waits half a second** under the pointer (frames are pointed at all fight long, to Thread and smart-cast) and opens at once on keyboard focus. It sits right of the frame, over the barks, under nothing.

## Codex

| Codex: Bonds | Codex: locked |
|---|---|
| ![](ui/codex-bonds.jpg) | ![](ui/codex-bonds-locked.jpg) |

## In the real app

The dev server, driven through the run hook: a fresh profile seeded with Kael a fight short of rank 2, Lyra of rank 3 and Vexis at 10 (`seedBonds`); the Title; Prep; the Bonds screen (Vexis's tiers and alternate Solo chosen with the mouse, a locked talent of Lyra's clicked, the keyboard on Kael's page); back to Prep; embark; a bot plays the first fight a while and the pointer rests on Vexis's frame; the hook wins it: Kael's first Bond rank-up and Lyra's tier I, on one card that introduces Bonds; the hook walks to a Respite, where both their rank-2 scenes wait; 4 sits with Kael, 1 replies, Enter. The profile kept the scene, its reply and its XP; no console errors.

| The Title | Prep, after choosing |
|---|---|
| ![](ui/real-title.jpg) | ![](ui/real-prep.jpg) |

| Vexis: her choices | Lyra (rank 2): a locked talent says when it opens |
|---|---|
| ![](ui/real-bonds-vexis.jpg) | ![](ui/real-bonds-locked.jpg) |

| Kael (rank 1): the keyboard on a locked talent | In the fight: Vexis's tooltip |
|---|---|
| ![](ui/real-bonds.jpg) | ![](ui/real-hud-tip.jpg) |

| The first Bond rank-ups (Kael 2, Lyra 3) | The Result behind them: each hero's Bond XP |
|---|---|
| ![](ui/real-bond-card.jpg) | ![](ui/real-result.jpg) |

| The Respite: Kael's and Lyra's scenes wait | The scene, replied |
|---|---|
| ![](ui/real-respite.jpg) | ![](ui/real-scene-reply.jpg) |

## Lab views

The new **Bonds** group, interactive where it can be (the Bonds screen's choices work, by the store's rules: `labSetTalent`, `labSetSolo`; the scenes' replies work):

- **The Bonds screen**: `bonds-rank-1`, `bonds-rank-4`, `bonds-rank-7`, `bonds-rank-10`, `bonds-skip`, `bonds-reader`.
- **Title and Prep**: `title-bonds`, `prep-bonds`, `prep-bonds-early`.
- **Result, Summary, rank-ups**: `result-bonds`, `result-bond-first`, `result-bond-rankup`, `summary-bonds`, `summary-bonds-panel`, `map-bond-rankup`.
- **Respite and scenes**: `respite-scene-1`, `respite-scenes-2`, `scene-<id>` for each of content's scenes, `scene-reply`.
- **HUD**: `hud-bonds-alt`, `hud-bonds-kael`.
- **Codex**: `codex-bonds`, `codex-bonds-locked`.

New mock data in `lab/mock.ts`: `mockBonds(rank, opts)` (every hero at a rank, with a player's likely choices there and the scenes reached seen but the newest), `bondXpAt`, `labSetTalent` and `labSetSolo` (the store's rules), `mockRunBonds` (`runBonds`), `sceneRun(id)` and `mockBondsHud` (a scenario's HUD with what the bridge reads of a real fight with those Bonds).

## Tests and checks

`tests/uiPhase4e.test.ts` has 24 tests:

- **The screen's numbers are the meta's**: rank, progress, the track and what each rank opens at every rank's edge and either side, for every hero; the next opening; each tier's talents and texts.
- **Locked and open tiers**: open at `tierRank`, locked naming it, all open with Skip the unlocks; a click chooses, clears or says why; the store keeps what the screen asks for and the run in Prep follows; Prep's row.
- **The Solo choice**: their own (`hero.solo`) and the alternate (`altSoloText`), open at `soloRank`; the store and the lab agree.
- **Scenes**: seen, waiting, queued, locked against `sceneWaiting`; the **Respite's choices** through the stores (keys 4 and 5, `sceneXp`, `bondScene`, `endScene`, the XP paid, the reply kept); none when nothing waits.
- **Results and rank-ups**: a fight's Bond XP rows equal `EncounterResult.bondXp` through a real `finishCombat`; the run's total; the bar's rank-ups; every hero's every rank's card against `rankOpens` (talent names, the alternate's lines, a scene's XP, the next opening); the intro's numbers; when the card shows and the toasts wait; the store's notices as cards.
- **In a fight**: a real sim with every alternate Solo and talents: the HUD's Solo id, name, lines and talents, the frame's tooltip; their own without Bonds; the Cue hint names the alternate.
- **Codex, looks, the lab**: the rules and ranks from content; the rose and every hero's ink at 4.5:1 or better on the dark panels and their tints; the lab's Bonds at their ranks.

`e2e/smoke.spec.ts` gains "**Phase 4e: Bonds — choose talents and a Solo on the Bonds screen, embark with them, a Respite scene played through**":

1. Settings → Skip the unlocks; a new run: Prep's Bonds row opens the Bonds screen (every tier open).
2. Kael: tier I's second talent and tier II's first (choosing again clears it); Lyra's tier III by her tab; the keyboard to Vexis; her alternate Solo. The hook's profile holds them.
3. Esc to Prep: the row and the hero card show them; the run in Prep holds them.
4. Embark, the first fight: its config's `bonds` are exactly those talents (content order) and the Solo; Vexis's frame names it.
5. Win it: each hero's Bond XP on the Result is the profile's.
6. Kael seeded to his first scene's rank; the hook walks to a Respite: the scene waits (`scenesWaiting`), its choice pays `sceneXp`; 4, then 1 (the answer shows), then Enter: the map, the scene seen with reply 0, the XP paid. No console errors.

Per the brief, I didn't run the Playwright suite. It type-checks and lints. I ran the spec's Phase 4e test against my own dev server (port 5418, file watching off, so the other workstreams' edits couldn't reload it mid-test) with a scratch config: it passed, and again on the final code. Against the same server, the tests nearest the screens I changed still pass: the boot, real input (the frames), the Prelude run, and Phase 4b, 4c and 4d.

- `npm run typecheck` (all three configs) passes.
- `npm run lint` (ESLint and Prettier over the repo) passes.
- `npx vitest run`: 1,341 of 1,342 pass, this file's 24 among them. The one failure is `tests/sim/determinism.test.ts`'s golden file, whose content hash moves with the tuning of `src/content/bonds.ts` still under way (`npm run golden:update` is the tuner's).

## Screenshots

All are under `ui/`, taken with Playwright at 1280 wide on the dev server. Lab views use `nav=0&fit=0`, one browser page each, animations paused after they settle, clipped to the stage; the PNGs are 2× crops. The `real-*.jpg` shots are the real app, driven through the run hook. I looked at every one. The fixes this led to:

- **The Bonds screen ran 60 px past 720.** The hero tabs moved into the header row, and the cards lost some padding.
- **The frame's Bond rank crowded its name row** (a threaded Lyra read "Ran…"). It sits on the portrait's corner.
- **A locked talent's click explained itself below the fold.** The reason now replaces the panel's hint, beside the tier.
- **The Summary's line wrapped** ("Rank 5 reached · 112 / 320 Bond XP to rank 6"). "Rank 5 reached" moved beside the name.
- **"Rank 3 · Skip the unlocks" broke mid-phrase** in the tier's label. Two lines.
- **The first-ever card said "Bonds" twice** (eyebrow and title). Its eyebrow says "Something new".
- **The rank-7 scene's card mentioned no XP** when an earlier scene was unseen. It does now.
- **Lyra's locked tier couldn't be clicked by the script**: correct (`aria-disabled`); the real-app shot clicks it on purpose to show the reason.

## Known gaps

- **Bond rank-up notices live in memory** (as the Weaver's do): closing the tab before the card shows loses that card, not the rank.
- **The frames' Bond rank is the profile's now**, not the run's at embark (a rank reached mid-run shows at once; the talents in force are still the run's).

## Outside my area

I made no changes to `src/sim`, `src/meta`, `src/content`, `src/audio`, `src/render`, the stores or `tools`. Outside `src/ui` I changed only `src/app/App.tsx`, `src/app/testHook*.ts`, `e2e/smoke.spec.ts` and `tests/uiPhase4e.test.ts`. Nothing about the auras changed.

What I asked for, and what integration did:

- **The scenes a run played**: `RunState.scenes` (their ids), set by `Run.endScene`. `runBondXp` adds their `sceneXp`, so the Summary counts them.
- **A callout when a talent acts**: the views' (VFX) moments name the rare talents in the world, above the hero, and every talent that acts has a moment and a sound. A banner as well would say it twice.
- **docs/phase-4e.md's Presentation section** links here.

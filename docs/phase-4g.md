# Phase 4g — Starlight, the Loom and mastery

*2026-10-30 · plan: [docs/plan/02-game-design.md §9](plan/02-game-design.md#9-meta-progression-the-loom), [§13](plan/02-game-design.md#13-economy), [04 §7](plan/04-presentation.md) · follows [Phase 4f](phase-4f.md)*

The last of the Loom: the meta currency, the hub, Calling mastery and the Perfect-Ward trainer. The user chose:

| Question | Choice |
|---|---|
| What does Starlight buy? | **Technique variants and cosmetics.** Auras and ornaments keep their Rank unlocks. |
| What are cosmetics? | **The Weaver's robe, the Thread's look, and titles.** The field's and the auras' looks stay as they are. |
| How does a Calling's path open? | **Tiers by mastery.** Tier I is open from the start. Mastery, earned by playing that Calling, opens tiers II–IV, then a title and that Calling's own variant. |
| What is the hub? | **An illustrated sanctum**, the Loom: a station for each system, dark until it opens, with a short first-contact intro. It replaces the Title's buttons; the Title becomes the front door. |

## Starlight

- **Earning.** Every won fight pays Starlight by its kind:
  - skirmish 3, elite 6, mini-boss 10, boss 20;
  - a won run adds 15;
  - Dissonance multiplies it as it does Weaver XP;
  - each Deed earned pays its own amount (10 to 40, by how hard it is).

  A lost fight pays nothing, but what the run earned before stays. The Result and the Summary show it.
- **Spending** is at the Loom's **Atelier**, which opens at Weaver Rank 5:
  - **Technique variants**, 120 each. Five are on sale from the start (Purge, Absolve, Swap, Anchor, Skate). The other three each open with their Calling's top mastery: Chorale (the Luminary), Aegis Link (the Martyr) and Phase Step (the Chronomancer).
  - **Robes**: the Weaver's colours, 60–90 each.
  - **Thread looks**: the Thread's filament and glow, 60–90 each. Mend's and Empower's colours stay what they are, so the Thread still says which it is.
  - **Titles**, 40 each. Some are earned instead: each Calling's mastery title, and a few Deeds'.
- **Skip the unlocks** opens the Atelier, and every variant to play, but it buys nothing. A variant is bought only where it's sold without it: from Rank 5, and for the mastery ones at their Calling's top mastery. Keepsakes add no power, so they're sold as the Atelier shows them.

## Calling mastery

- Playing a Calling earns it **mastery XP**: the run's Weaver XP, win or lose.
- **Levels** come at 0, 150, 450, 900 and 1,500 mastery XP:
  - level 1 opens tier I;
  - levels 2–4 open tiers II, III and IV;
  - level 5 earns the Calling's title and opens its variant in the Atelier.
- A run offers only the tiers its Calling's mastery has opened; embarking snapshots them. *Skip the unlocks* opens every tier.
- Prep and the Calling's page show its mastery and what the next level opens.

## The Loom

An illustrated sanctum between runs (2D, drawn in code: no image files). Each station is a place in it:

| Station | Opens |
|---|---|
| **The Gate** (a new run, or the run in progress) | always |
| **Training Grounds** (with the Perfect-Ward trainer) | always |
| **Codex** | always |
| **Astrolabe** | Rank 4 |
| **Atelier** (Starlight) | Rank 5 |
| **Reliquary** | its Rank |
| **Bonds** | a hero's first Bond rank-up |
| **Hall of Deeds** | a first Deed |
| **Dissonance** (the endgame's Prep panel) | its win |

- **Each station is dark until it opens.** When it lights up, the hub draws the eye to it, and the first visit plays a short intro: two or three panels saying what it's for and how to use it, with a "Try it" that opens the station.
- **The Title becomes the front door**: Continue (a run in progress), Enter the Loom, Settings.
- **The Weaver stands in the hub** in their chosen robe and title.

## The Perfect-Ward trainer

A drill in the Training Grounds:
- A training bell telegraphs a blow at one hero on a steady beat, and you Ward it.
- Each try says how it went: **Perfect**, early or late by how many milliseconds, or missed.
- It counts your streak, and keeps your best per mode in this browser.
- Three speeds (slow, normal, quick) and a mixed mode that picks the target at random.
- The blows don't hurt for long: each starts with the hero healed and the Ward and Spirit ready, so the beat can be quicker than the Ward's recharge.

## Contracts (v15)

**Content** (`CONTENT_VERSION` bump):
- `starlight`: each fight kind's pay, the win bonus, what Deeds pay (`deedLadder` by a ladder Deed's place, `deedBadge` for a badge), the Atelier's Rank and a variant's price.
- `cosmetics`: robes `{ id, name, price, colors }`, Thread looks `{ id, name, price, filament, glow }`, titles `{ id, text, price | earned: { mastery } | { deed } }`.
- `mastery`: level thresholds; each Calling's variant and title.

**Sim** (`SIM_VERSION` 21): a `drill` debug op, `{ op: 'drill', slot, windup }`, that heals the hero, readies the Ward and Spirit, and telegraphs a single blow at them (a Reel dodges it). Nothing else: cosmetics are the views', read from the profile.

**Meta:**
- `EncounterResult.starlight`; the Summary's Starlight.
- Profile v8:
  - `starlight` (the balance), `cosmetics` (owned ids), `look { robe, thread, title }`;
  - `mastery: Record<callingId, number>`;
  - the hub's intros seen go in the existing `introduced` list, as `station:<id>`.
- `RunState.calling.tiersOpen`, snapshotted at embark (absent on older runs: every tier).
- In `src/meta/loom.ts`: `starlightForFight`, `starlightForDeeds`, `runStarlight` (a run's fights' and Deeds'), `masteryLevel`, `masteryProgress`, `tiersOpen(callingId, mastery, all)`, `shopItems(state, rank, all)`, `buy`, `equip`, `earnedTitles`.

**Stores:**
- The profile store: `awardStarlight`, `shop()`, `buy(itemId)` (refused without the Starlight, or while locked), `equip(slot, id)`, `awardMastery(callingId, xp)`, `tiersOpen(callingId)`. Newly earned Deeds pay their Starlight as they're recorded.
- The run store pays Starlight and mastery with each fight's Weaver XP, and snapshots the Calling's open tiers at embark.

## Presentation

Screenshots are in [docs/phase-4g/ui/](phase-4g/ui/) and [docs/phase-4g/vfx/](phase-4g/vfx/). The UI lab's *Loom* group shows every hub and Atelier state; the VFX lab's *Phase 4g · Keepsakes* shows the looks.

**The Loom** (`src/ui/screens/LoomScreen.tsx`, `LoomParts.tsx`, `loomModel.ts`):
- **The hall.** An illustrated sanctum in SVG: an apse with a rose-window Loom, pillars, a dais. The Weaver stands at the centre in her robe and title, and threads run from her hands to each station. At phone width it becomes a grid under her.
- **Opening.** Each station opens by its system's own gate, and while it's dark it says when it opens. A newly lit station pulses, says "New", brightens its thread and gets a banner line. Its first visit plays its intro, with "Try it". The first visit to the hub plays one welcome for the Gate, the Training Grounds and the Codex.
- **Badges** carry what was on the Title's buttons: points to spend, materials, Bond ranks. The Atelier adds what you can afford, the Hall your Deeds, and Dissonance your best won.
- **Control.** Arrows move between stations, Enter opens, Esc goes to the front door. A gamepad does the same (a small menu hook, the codebase's first gamepad support).
- **Back from any station returns to the Loom:** the Astrolabe, Bonds, the Reliquary, the Codex, the Atelier, Prep, the Training Grounds and the Summary.

**The Title** is the front door: Continue (a run in progress), Enter the Loom, Settings, and the Rank panel. In the demo build it first offers the tester a fresh start or a veteran ([docs/demo.md](demo.md)).

**The Atelier** (`AtelierScreen.tsx`):
- **Shelves.** Four: variants, robes, Thread looks and titles. Each item has its price, state and reason. A refusal shows on the item and is read out.
- **Wearing** goes through `equip`; each shelf starts with the Weaver's own option.
- **Preview.** Pointing at an item tries it on: the Weaver in the robe and title, and the Thread in the look, drawn once in Mend and once in Empower.

**Starlight and mastery on the run's screens** (`StarlightParts.tsx`, `MasteryParts.tsx`, `callingText.ts`):
- **The Result** shows "+N Starlight", what paid it, the balance and what it's for, beside the XP. On a Calling's run it also shows the fight's mastery.
- **The Summary** shows the run's total (`runStarlight`): fights, the win bonus and Deeds.
- **Prep** shows each Calling's mastery level and its locked tiers, and the chosen one's progress and what its next level opens. The Calling page, the map's strip, the fight's Calling chip and the Summary mark tiers mastery hasn't opened as locked, with the level that opens them.

**The Perfect-Ward trainer** (`WardTrainer.tsx`, `wardDrill.ts`), at the top of the Training Grounds:
- **The drill.** Slow, normal or quick blows (2.0, 1.4 and 0.9 s wind-ups) at a chosen hero, or mixed. Blows come on a steady beat, 2.4 s after the last lands.
- **The verdict.** Each try reads Perfect, early or late by so many milliseconds, warded but not Perfect, or missed with the reason. A timing bar shows where the Ward fell against the window.
- **Streaks.** It counts the streak and keeps the best per mode in the browser.

**The looks** (`src/render/models/library.ts`, `thread.ts`, `src/app/threadLook.ts`):
- **Robes.** A robe recolours the Weaver's model in place, with no new draw call, between fights: body and hood, trim on the sash and hem, glow on the halo. Phase Step's decoy wears it too.
- **Thread looks** colour the Thread's core strand and halo. Mend and Empower stay in what says which it is: beads of the mode's colour flowing to the hero, the pulses, both ends, the hero's rim, ring and motes. Bear's crimson still takes over.
- **Colour vision.** Under each colour-vision setting, a look keeps clear of Mend's and Empower's colours as that setting sees them, paling toward silver where it can't. Tests hold it on every arena floor. The Atelier's preview fits looks the same way.

**Sounds** (`src/audio/ui.ts`, `music.ts`):
- **The Loom:** a station lit, a station's intro, buying and a refusal, and wearing a keepsake (a robe rustles, a Thread look is plucked, a title rings). The Loom and the Atelier have their own quiet mood, without drums.
- **The run's screens:** the Starlight counting up on the Result.
- **The trainer:** a Perfect, early or late (sliding to or sagging from its note), a miss, a streak of 5, 10 or 25, a new best.

## Harness

`tools/pacing.ts` plays simulated players' first three hours, run by run, on what their Rank has opened, and pays Weaver XP, Starlight and mastery as the stores do ([Phase 4h](phase-4h.md#pacing) has the model and the whole table). Medians of 16 players each:

| | Novice | Skilled |
|---|---|---|
| Starlight earned by 1:00 · 2:00 · 3:00 | 226 · 427 · 636 | 402 · 663 · 873 |
| The Atelier opens (Rank 5) | 0:52 | 0:32 |
| The Luminary (Rank 7) | 1:56 | 1:19 |
| Its mastery 2 · 3 · 4 · 5 | 2:18 · 2:26 · 2:52 · 3:07 | 1:36 · 1:52 · 2:10 · 2:29 |

- **Starlight.** When the Atelier opens, a newcomer has about 200 Starlight saved: a variant or a keepsake at once. Three hours in, they've earned 40–55% of what it sells (1,590 in all, the mastery variants included), so it lasts.
- **Mastery.** A Calling's path opens over its first few runs: tier I from the start, tier IV after three or four. Its top mastery (its title and its variant) comes after about an hour and a quarter of playing it, five or six runs.

## Code review

A review of the core commit ran it as well as reading it: a whole won run through the stores at Dissonance, reloads at a Result and mid-fight, a second report of the same fight, losses, tier gating, the Atelier's every refusal and saves with junk in them. Starlight and mastery are never paid twice, Dissonance applies once, and the drill leaves determinism, replays and golden alone. What it found, fixed with tests unless noted:

| Found | Fixed |
|---|---|
| **Skip the unlocks let you buy gated variants for good**: under it every variant was `open`, and an `open` variant was for sale, Rank and mastery unchecked. | A variant is bought only where it's sold without Skip. |
| **The in-run Calling strip promised tiers mastery hadn't opened** (`nextTier`, `pathLabel`, `pathSteps`). | The screens mark them closed, opening with mastery (see *Presentation*). |
| **The drill couldn't beat faster than the Ward's 7 s recharge**: a second blow found the Ward spent. | Each blow starts with the hero healed and the Ward and Spirit ready. |
| **A v7 save brought up to date** started its Callings' mastery from nothing, and its earned Deeds paid no Starlight. | The Deeds pay their Starlight once, as the save is migrated. Mastery still starts from nothing: it's earned by playing. |
| The drill's "can't be dodged" wasn't true (a Reel dodges it); the doc's "heals the party between blows" and "the Summary's Starlight" had nothing behind them. | The command's doc says what it does; the drill heals as it starts; `runStarlight(run)` gives the Summary its total. |
| Shop wording: a Skip-opened mastery variant still read "Opens with … top mastery"; buying something owned said "not for sale". | "Open to play with Skip the unlocks. On sale with …"; "Already yours." |
| `ownVariant` was described as the shop's, though it's an ungated gift. | It's the demo's and the tests'; the Atelier sells through `buy`. |
| Content checks: keepsake ids weren't checked against variants', and mastery rewards weren't checked one per Calling, or against the title that Calling's mastery earns. | Checked. |
| The Calling unlock card said "its path grows as you win". | "…playing it earns mastery, which opens its path." |
| Test gaps: Deeds' Starlight through the store, a lost fight, a fight reported twice, Skip with buying, the migration, the quick drill. | Tested. |

## Known gaps

- **Mastery from before Phase 4g isn't kept.** A v7 save brought up to date starts its Callings' mastery from nothing, so a Calling played before offers tier I until it's played again. Its earned Deeds do pay their Starlight.
- **The Codex's Callings page doesn't show mastery** yet; Prep, the Calling page, the map, the HUD and the Summary do.
- **Under protanopia and deuteranopia, Starlit and Silver look nearly alike.** Starlit sits next to Mend's sky blue, so it pales toward silver to keep the Thread readable. That's the right trade, but it costs Starlit its colour for those players.
- **A dark station's click plays the generic buzz,** not a sound of its own.
- **The trainer's best is kept per browser,** not in the profile.
- **The hub opens scrolled to a newly lit station on phones,** since it takes first focus.
- **Gamepad support** covers the Title, the Loom and the Atelier, the codebase's first. It was checked with a stubbed pad, since the e2e runner can't drive one.

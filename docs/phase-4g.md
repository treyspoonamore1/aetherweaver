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
- **Skip the unlocks** opens the Atelier and every variant, but buys nothing: cosmetics and titles are still bought.

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
- It counts your streak and best.
- Three speeds (slow, normal, quick) and a mixed mode that picks the target at random.
- The blows don't hurt: the drill heals the party between them.

## Contracts (v15)

**Content** (`CONTENT_VERSION` bump):
- `starlight`: each fight kind's pay, the win bonus, what Deeds pay (`deedLadder` by a ladder Deed's place, `deedBadge` for a badge), the Atelier's Rank and a variant's price.
- `cosmetics`: robes `{ id, name, price, colors }`, Thread looks `{ id, name, price, filament, glow }`, titles `{ id, text, price | earned: { mastery } | { deed } }`.
- `mastery`: level thresholds; each Calling's variant and title.

**Sim** (`SIM_VERSION` 21): a `drill` debug op, `{ op: 'drill', slot, windup }`, that telegraphs a single blow at a hero. Nothing else: cosmetics are the views', read from the profile.

**Meta:**
- `EncounterResult.starlight`; the Summary's Starlight.
- Profile v8:
  - `starlight` (the balance), `cosmetics` (owned ids), `look { robe, thread, title }`;
  - `mastery: Record<callingId, number>`;
  - the hub's intros seen go in the existing `introduced` list, as `station:<id>`.
- `RunState.calling.tiersOpen`, snapshotted at embark (absent on older runs: every tier).
- In `src/meta/loom.ts`: `starlightForFight`, `starlightForDeeds`, `masteryLevel`, `masteryProgress`, `tiersOpen(callingId, mastery, all)`, `shopItems(state, rank, all)`, `buy`, `equip`, `earnedTitles`.

**Stores:**
- The profile store: `awardStarlight`, `shop()`, `buy(itemId)` (refused without the Starlight, or while locked), `equip(slot, id)`, `awardMastery(callingId, xp)`, `tiersOpen(callingId)`. Newly earned Deeds pay their Starlight as they're recorded.
- The run store pays Starlight and mastery with each fight's Weaver XP, and snapshots the Calling's open tiers at embark.

## Presentation

*To be filled in by the UI, VFX and audio workstreams.*

## Harness

*To be filled in: Starlight and mastery pacing over the first hours.*

## Code review

*To be filled in after the review.*

## Known gaps

*To be filled in.*

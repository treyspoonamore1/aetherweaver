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

*To be filled in by the UI, VFX and audio workstreams.*

## Harness

`tools/pacing.ts` plays simulated players' first three hours, run by run, on what their Rank has opened, and pays Weaver XP, Starlight and mastery as the stores do ([Phase 4h](phase-4h.md#pacing) has the model and the whole table). Medians of 16 players each:

| | Novice | Skilled |
|---|---|---|
| Starlight earned by 1:00 · 2:00 · 3:00 | 227 · 431 · 679 | 414 · 679 · 882 |
| The Atelier opens (Rank 5) | 0:52 | 0:32 |
| The Luminary (Rank 7) | 1:53 | 1:19 |
| Its mastery 2 · 3 · 4 · 5 | 2:14 · 2:26 · 2:49 · 3:14 | 1:37 · 1:53 · 2:11 · 2:32 |

- **Starlight.** When the Atelier opens, a newcomer has about 200 Starlight saved: a variant or a keepsake at once. Three hours in, they've earned about half of what it sells (1,590 in all, the mastery variants included), so it lasts.
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

*To be filled in.*

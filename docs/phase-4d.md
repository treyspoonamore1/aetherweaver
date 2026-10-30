# Phase 4d — Dissonance

*2026-10-30 · plan: [docs/plan/02-game-design.md §10](plan/02-game-design.md#10-endgame-and-mastery), [03 §11](plan/03-content-bible.md#11-dissonance-difficulty-levels-after-the-first-finale-clear) · follows [Phase 4c](phase-4c.md)*

**Dissonance** is the endgame's difficulty: opt-in levels, each worth points, chosen before a run. A run's total raises its rewards. The relics it finds remember it, which unlocks the Reliquary's top tiers. The Astrolabe and the Reliquary finally have something to push against. The user chose how it works:

| Question | Choice |
|---|---|
| How much now? | **Twelve levels now**: the ten that work on existing systems, plus Restless Dead (enemies rise again) and Blind Score (telegraphs hide their answer). **Tyrant, Mimicry and True Dissonance** wait for Phase 5's bosses and affixes. |
| When does it open? | **After your first win at Rank 15 or above.** You have the Astrolabe and a Reliquary to bring, and Rank 20 is still ahead to chase at higher difficulty. |
| How does it unlock T2 and T1? | **Relics remember.** Like item level in PoE: a relic enshrined from a run at 10 points or more can Ascend to T2, and at 20 or more to T1. Its Inscribes roll higher there too, so a mirror-tier relic means winning hard runs. |

## How it works

- **Opening.** The first win at Rank 15 or above opens Dissonance, with a card at the Summary. "Skip the unlocks" opens it too.
- **Choosing.** In Prep, turn levels on (some have ranks). Their points add up to the run's **Dissonance**. Prep remembers your last choice, and embarking freezes it for the run.
- **Rewards**, for a run at *n* points:
  - Weaver XP is +3% a point.
  - Tuning Shards are +4% a point.
  - From 10 points, a boss beaten with an A (not only an S) pays a Discord Tear. From 20, every win pays one more.
- **Relics remember.** A relic enshrined from a run keeps that run's points as its **depth**. Depth sets how far crafting can take it (see *The Reliquary's tiers*). Relics enshrined before Dissonance have depth 0.
- **Records.** The profile keeps the highest Dissonance you've won at, for each Calling and for none. The Codex and Prep show them, and clearing a new total is marked at the Summary.
- **What it changes.** Most levels are numbers in the fight. Restless Dead and Elite Vanguard change who you fight. Unforgiving and Discordant Pact change the run. Blind Score changes only what you see.

## The levels

Points are first guesses; *Harness* measures each level's difficulty and sets them.

| | Level | Effect | Ranks | Points |
|---|---|---|---|---|
| 1 | **Brisk Foes** | enemies move 15% faster | 1 | 2 |
| 2 | **Hardened** | enemies have 25% more life | 2 | 3 each |
| 3 | **Short Fuse** | enemies' wind-ups are 10% shorter | 2 | 3 each |
| 4 | **Muted Choir** | your field and your beam song's echo reach 15% less far | 1 | 2 |
| 5 | **Fragile Threads** | the Thread snaps 3 m sooner | 1 | 1 |
| 6 | **Wounding Strikes** | heroes are healed 15% less | 2 | 2 each |
| 7 | **Elite Vanguard** | elite fights bring one more elite, and every elite an extra affix | 1 | 3 |
| 8 | **Silent Cues** | a Cue costs 10 more Resonance | 1 | 1 |
| 9 | **Restless Dead** | enemies rise once at 30% life (not bosses or mini-bosses) | 1 | 3 |
| 10 | **Unforgiving** | Respites no longer heal | 1 | 2 |
| 11 | **Blind Score** | telegraphs don't show which answer they want | 1 | 2 |
| 12 | **Discordant Pact** | start the run with a random cursed relic | 1 | 1 |

At most **33** points. Tyrant (bosses gain a mechanic per phase), Mimicry (a Mimicking affix) and True Dissonance (the Finale's fourth phase) come with Phase 5.

## The Reliquary's tiers

A relic's **depth** (the Dissonance of the run that found it) sets its band:

| Depth | Ascend reaches | Inscribe rolls T5 / T4 / T3 / T2 / T1 | A Cursed Dissonate raises to |
|---|---|---|---|
| 0–9 | T3 | 60 / 30 / 10 / 0 / 0 | T2 |
| 10–19 | **T2** | 45 / 30 / 17 / 8 / 0 | **T1** |
| 20+ | **T1** | 35 / 30 / 20 / 10 / 5 | T1 |

Ascend's odds are unchanged (T3→T2 35%, T2→T1 20%), and so are its costs and Instability. Reaching T1 is still a gamble.

## Contracts (v12)

**Content** (`CONTENT_VERSION` bump):
- `dissonance`: the levels, `{ id, name, text, ranks, points, values }`. `values` holds each level's numbers (`pct`, `metres`, `resonance`…), and the text is built from them.
- `dissonanceRules`: the Rank that opens it (15), the reward per point (XP, shards) and the Tear thresholds.
- `reliquary.bands`: the depth bands above, replacing `tierCap` and Inscribe's `tierOdds`, which become band 0.

**Sim** (`SIM_VERSION` 15):
- `SimConfig.dissonance?: { id, rank }[]` folds into the mods:
  - enemies' speed and life;
  - the wind-up multiplier, alongside the assist;
  - the field's and echo's radius, and the Thread's reach;
  - healing received by heroes;
  - the Cue's cost;
  - Restless Dead's single rise at 30%;
  - Elite Vanguard's extra elite and affix, seeded.
- `WorldState.dissonance: { levels, blindScore }` for the views. An absent Weaver's re-run keeps the enemies' levels: the "without you" party faces the same fight.

**Meta** (`meta/dissonance.ts`, pure):
- `dissonancePoints(levels)` and `dissonanceOpen(profile, rank)`;
- `xpMult(points)`, `shardsMult(points)` and `tearsFor(run)`;
- `band(depth)`.

**Profile v5:**
- `dissonance: { open, levels, best }`: whether it's open, the last choice, and the best won total per Calling (`none` for no Calling).
- `ReliquaryRelic.depth` (0 for relics enshrined before).

**Run:**
- `RunState.dissonance: { id, rank }[]`: chosen in Prep, frozen at embark. Old saves have none.
- The XP and shards of its fights and its end scale with its points.
- Unforgiving's Respites and Discordant Pact's relic are the run layer's.

**Stores:**
- The profile store gains `setDissonance(levels)` and records the best on a win, opening Dissonance on the first win at Rank 15+.
- The run store takes the choice into a new run and freezes it at embark.

## Presentation

*To be filled in by the UI and audio workstreams.*

## Harness

*To be filled in: each level's difficulty (the win rate it costs the Skilled bot with a Rank-20 build), the points that follow, and a few totals.*

## Code review

*To be filled in after the review.*

## Known gaps

*To be filled in.*

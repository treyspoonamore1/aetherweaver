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

Points follow each level's measured difficulty (see *Harness*): a point is worth about 8% more enemy life to a Rank-20 build.

| | Level | Effect | Ranks | Points |
|---|---|---|---|---|
| 1 | **Brisk Foes** | enemies move 15% faster | 1 | 1 |
| 2 | **Hardened** | enemies have 25% more life | 2 | 3 each |
| 3 | **Short Fuse** | enemies' wind-ups are 10% shorter | 2 | 1 each |
| 4 | **Muted Choir** | your field and your beam song's echo reach 15% less far | 1 | 1 |
| 5 | **Fragile Threads** | the Thread snaps 3 m sooner | 1 | 1 |
| 6 | **Wounding Strikes** | heroes are healed 15% less | 2 | 2 each |
| 7 | **Elite Vanguard** | elite fights bring one more elite, and every elite an extra affix | 1 | 5 |
| 8 | **Silent Cues** | a Cue costs 10 more Resonance | 1 | 1 |
| 9 | **Restless Dead** | enemies rise once at 30% life (not bosses or mini-bosses) | 1 | 5 |
| 10 | **Unforgiving** | Respites no longer heal | 1 | 1 |
| 11 | **Blind Score** | telegraphs don't show which answer they want | 1 | 2 |
| 12 | **Discordant Pact** | start the run with a random cursed relic | 1 | 1 |

At most **30** points. Tyrant (bosses gain a mechanic per phase), Mimicry (a Mimicking affix) and True Dissonance (the Finale's fourth phase) come with Phase 5.

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

`npx tsx tools/dissonance.ts`: whole Prelude runs with a Rank-20 build (Guardian, a full 29-point tree through Overflowing Grace and the notables, and a typical carried set of three legendaries).

**Each level's cost.** The Skilled bot with this build wins 98% of runs, and still about three in four against enemies with 90% more life: it wins by surviving, so extra enemy life barely registers. The Novice bot with the same build is sensitive (85% normally, 61% against 25% more life), so each level was measured with it, 300 runs each. The cost is read as the extra enemy life that costs as much, on a logistic scale between those two baselines (one rank of Hardened = 25%), and a point is set at about 8% of enemy life.

| Level | Novice wins | Costs like | Points (first guess → now) |
|---|---|---|---|
| none | 85.3% | | |
| Hardened | 61.0% | 25% (the scale) | 3 → 3 |
| Hardened ×2 | 40.0% | 41% | 6 → 6 |
| Restless Dead | 44.3% | 38% | 3 → **5** |
| Elite Vanguard | 45.3% | 37% | 3 → **5** |
| Wounding Strikes | 69.0% | 18% | 2 → 2 |
| Wounding Strikes ×2 | 52.3% | 32% | 4 → 4 |
| Short Fuse | 79.3% | 8% | 3 → **1** |
| Short Fuse ×2 | 69.0% | 18% | 6 → **2** |
| Fragile Threads | 81.3% | 5% | 1 → 1 |
| Brisk Foes | 83.0% | 3% | 2 → **1** |
| Silent Cues | 84.0% | 2% | 1 → 1 |
| Unforgiving | 84.0% | 2% | 2 → **1** |
| Muted Choir | 87.3% | ~0 | 2 → **1** |
| Discordant Pact | 87.3% | ~0 | 1 → 1 |
| Blind Score | 85.3% | none (no effect on a bot) | 2 → 2 |

At these sample sizes a cost within about ±6% of zero can't be told from none. Every level is worth at least a point. Muted Choir, Discordant Pact and Blind Score cost a bot little: it doesn't place itself by the field, rarely Glides, and doesn't read answer glyphs. A player does all three, so they keep a point or two by judgment.

**Totals** (150 runs each, the same build):

| Dissonance | Skilled wins | Novice wins |
|---|---|---|
| 0 | 98% | 85% |
| 10 (Hardened ×2, Wounding Strikes ×2) | 75% | 10% |
| 20 (and Restless Dead, Elite Vanguard) | 35% | 0% |
| 30 (everything) | 11% | |

The ladder holds. Ten points is a skilled player's comfortable challenge, so T2 is in reach. Twenty is a real one, won about a third of the time, so T1 relics are the chase. Thirty is mastery.

## Code review

*To be filled in after the review.*

## Known gaps

*To be filled in.*

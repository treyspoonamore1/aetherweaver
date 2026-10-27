# Phase 4 — The Astrolabe

*2026-10-27 · plan: [docs/plan/02-game-design.md §9](plan/02-game-design.md#9-meta-progression-the-loom) · keystones: [01 §4](plan/01-findings.md#4-what-the-remake-keeps) · follows [Phase 3e](phase-3e.md)*

The first piece of the Loom: the **Astrolabe**, a persistent passive tree. Points come from Weaver Rank; you spend them on a star map between runs, and every run carries the tree you embarked with. The user chose how it works:

| Question | Choice |
|---|---|
| Where does it live (there's no hub yet)? | **Its own screen**, a star map opened from the Title and from Prep. Closed during a run. The Loom can adopt it as a station later. |
| When does it open? | **Rank 4**, with 3 points to spend (a point for every Rank above 1). Ranks go up to **20**, so 19 points at the top. |
| May it touch the auras? | **Numbers and rules.** Choir nodes may change aura numbers, and its keystones may bend aura rules. The auras' looks don't change. |
| Should it be possible to fill it? | **No: under half the tree, ever.** 19 points from Ranks against 65 nodes; Deeds will add at most 10 more (29 of 65). The decisions come from the map: notables and keystones sit far out, with travel nodes between. |
| Respec? | **Free between runs.** The run is the commitment; each Calling can want its own tree. |
| How strong? | **About +15%** of the Weaver's output for the best allocation of all 19 points: half of the plan's +30% cap for the Astrolabe and the Reliquary together. |
| Bond's rim (none of the six keystones is about heroes)? | **Two great notables** instead of keystones; the keystones sit two each in Silk, Choir and Aegis. |
| Sanguine Font (as planned it only mattered to the Martyr)? | **Blood for everyone**: your songs reserve Life instead of Spirit, at two-thirds of the rate; 20% of Mend heals you; Spirit regenerates 30% slower. |
| Shatterproof Halo: the rest of a big hit? | **The Ward absorbs it.** No single hit breaks your Ward; it loses at most half its barrier. It lasts 40% shorter. |
| Unbroken Chorus and the Silent Verse? | **Mutes only.** Mute domes can't crack your fields or silence you; the Hollow Cantor's Silent Verse still works. |

## How it works

- **Points.** A point for every Rank above 1, from Rank 4 (when it opens) on: 3 at Rank 4, 19 at Rank 20. "Skip the unlocks" opens it with all 19.
- **Allocating.** The centre, the Weaver's Star, is always yours. A node can be taken when it touches one you have. Pointing at a far node shows the shortest path to it and what it costs; taking it takes the whole path if you have the points.
- **Respec.** Free, any time outside a run: give back one node (if nothing you keep depends on it) or everything at once.
- **Runs.** Embarking snapshots the tree into the run. A run in progress keeps its tree even if the profile's changes; a resumed run uses its own. The Training Grounds use the profile's tree, so you can try a change before a run.
- **What it isn't.** Nothing in it adds a song, a slot or a hero (the plan's 4th hero slot waits for the 4th hero). It strengthens and bends what you already have.

## The map

Four constellations around the centre, each a fork: a trunk of two travel nodes to its first **notable** (3 points from the centre, so Rank 4 already buys one), then two branches of two travel nodes, a second notable, two more travel nodes and a **keystone** (9 points out). Between neighbouring constellations, a **bridge notable** links the middle of one branch to the middle of the next (6 points out from either side), so a build can reach into a neighbour without walking its trunk. 1 + 4 × 15 + 4 = **65 nodes**.

```
                        Overflowing Grace        Sanguine Font
                                 \    SILK (N)    /
              Lifeguard ·          ·  Spun Silver ·          · Resonant Thread
   Eldritch Conduit                     |                        Prism Covenant
            \                           |                           /
  AEGIS (W)  Shieldwright —————— Weaver's Star —————— Clear Voice  CHOIR (E)
            /                           |                           \
   Shatterproof Halo                    |                        Unbroken Chorus
              Shield Bearer ·          ·  Fellowship  ·          · Anthem
                                 /    BOND (S)    \
                         Ensemble                 Second Wind
```

With 19 points you can finish one constellation (15 points, both keystones) and take a neighbour's first notable; or one keystone, both of its notables and a bridge into the next constellation; or the first notables of all four and a little more. Never more than a third of the tree today, and under half with every Deed.

### Silk: the Thread (north)

| Node | Kind | Effect |
|---|---|---|
| Trunk ×2 | travel | Mend and Empower +4% |
| **Spun Silver** | notable | The Thread reaches 3 m farther before it pulls taut; Mend and Empower +6% |
| Mending ×4 (toward Aegis) | travel | Mend +5% |
| **Second Stitch** | notable | Mend heals 30% more on a hero below 35% of their life |
| **Overflowing Grace** | keystone | Mend's overheal becomes a shield on the hero, up to 30% of their life, lasting 4 s. **Your Ward's barrier is 40% smaller.** |
| Gilding ×2 (toward Choir) | travel | Empower +6% |
| **Afterglow** | notable | Empower lingers on a hero for 3 s after you thread another |
| Blood ×2 | travel | +5% Life |
| **Sanguine Font** | keystone | Your songs reserve **Life instead of Spirit**, two-thirds as much as they would (the Martyr's too); 20% of what Mend heals also heals you. **Spirit regenerates 30% slower.** |

### Choir: the songs (east)

| Node | Kind | Effect |
|---|---|---|
| Trunk ×2 | travel | Aura effect +3% |
| **Clear Voice** | notable | Your songs reserve 10% less; aura effect +4% |
| Swell ×4 (toward Silk) | travel | Aura effect +3% |
| **Held Note** | notable | Your Crescendo lasts 2 s longer |
| **Prism Covenant** | keystone | **You fight at half your Life**: you start each fight there and can't be healed above it. Your auras are 30% stronger and the Thread 20% stronger. |
| Breath ×2, Hall ×2 (toward Bond) | travel | Songs reserve 4% less · the field is 6% wider |
| **Wide Hall** | notable | Your field is 20% wider |
| **Unbroken Chorus** | keystone | **Mutes can't crack your fields or silence you** (the Silent Verse still can). Every aura beyond the second makes all of them 5% stronger. **The Thread is 20% weaker.** |

### Aegis: the techniques (west)

| Node | Kind | Effect |
|---|---|---|
| Trunk ×2 | travel | Ward barrier +5% |
| **Shieldwright** | notable | Ward barrier +10%; Ward recovers 1 s faster |
| Guard ×2, Poise ×2 (toward Bond) | travel | Ward barrier +5% · Perfect window +0.03 s |
| **Ringing Parry** | notable | A Perfect Ward's stagger lasts 50% longer and gives 5 more Resonance |
| **Shatterproof Halo** | keystone | **No single hit breaks your Ward**: it absorbs the whole hit and loses at most half its barrier. **It lasts 40% shorter** (1.8 s). |
| Economy ×2, Tempo ×1, Breath ×1 (toward Silk) | travel | Techniques cost 4% less · recover 4% faster · Spirit regenerates 6% faster |
| **Bell Tower** | notable | Chime reaches 25% wider and heals 50% more |
| **Eldritch Conduit** | keystone | Your techniques cost **Life instead of Spirit** (the same amounts). Your songs reserve 30% less. |

### Bond: the heroes (south)

| Node | Kind | Effect |
|---|---|---|
| Trunk | travel | Heroes +3% life · heroes +3% damage |
| **Fellowship** | notable | Heroes +5% life and +5% damage |
| Endurance ×4 (toward Choir) | travel | Heroes +4% life ×2 · downed heroes bleed out 15% slower · Mend revives 15% faster |
| **Close Ranks** | notable | A hero within 4 m of another takes 6% less from ordinary hits |
| **Second Wind** | great notable | A hero you revive stands up with 60% of their life (not 30%) and is untouchable for 2 s |
| Rhythm ×4 (toward Aegis) | travel | Solos charge 6% faster ×2 · heroes +4% damage · Cued Solos last 10% longer |
| **Ready Answer** | notable | Answering a hero's call gives 10 more Resonance |
| **Ensemble** | great notable | When you Cue a Solo, the other heroes' Solos charge 25% |

### Bridges

| Between | Notable | Effect |
|---|---|---|
| Silk · Choir | **Resonant Thread** | The threaded hero hears your beam song 10% stronger |
| Choir · Bond | **Anthem** | Heroes standing in your field deal 5% more damage |
| Bond · Aegis | **Shield Bearer** | A hero your Ward is on deals 10% more damage while it holds |
| Aegis · Silk | **Lifeguard** | Mend heals a hero your Ward is on 20% more |

**Reading the plan.**

- **Ordinary hits only.** Like armour and the Luminary's Haloed, Close Ranks leaves telegraphed attacks alone: the big hits you see coming are still yours to answer.
- **Hero damage from the tree is yours.** Fellowship, the travel nodes, Anthem and Shield Bearer add to what heroes deal, and the ledger credits the extra to the Weaver, as it does Heavy Score's.
- **Prism Covenant** is "real low life" made simple: you're always at or below half, so its bonuses are always on, and the price is always paid. On a Martyr run it halves the Life her songs leave her.
- **Sanguine Font** turns the songs' Spirit into Life for any Calling, at two-thirds of the share (a song that would hold 30% of Spirit holds 20% of Life), so all of your Spirit goes to techniques. It can't take you under the Martyr's floor: songs may hold at most 90% of your Life.
- **Eldritch Conduit** makes Spirit only the songs' pool. Techniques that can't be paid in Life (it would down you) are refused, as if you were out of Spirit.
- **Shatterproof Halo** works on every Ward, an Echo Ward and Martyr's Aegis included; a Perfect Ward is still Perfect.
- **Overflowing Grace** shields only from Mend's overheal (not the songs' regeneration), and never over a bigger shield of the hero's own.

## Contracts (v9)

**Content** (`CONTENT_VERSION` bump): `astrolabe`: `{ id, name, kind: 'start' | 'travel' | 'notable' | 'great' | 'keystone', constellation: 'centre' | 'silk' | 'choir' | 'aegis' | 'bond' | 'bridge', x, y, links: string[], values, text }`. Links are symmetric (validated), every node reaches the centre, and node text is built from `values` (like the Callings').

**Sim** (`SIM_VERSION` 11, replay format 6):

- `SimConfig.astrolabe?: readonly string[]` (resolved: sorted node ids, `[]` by default; the replay schema defaults it). Unknown ids are ignored, as unknown relics are.
- Mods gain the tree's levers, applied after motifs, relics, boons and the Calling (multipliers multiply, bonuses add): `auraEffectMult`, `reserveMult`, `techCostMult`, `heroLifeMult`, `reviveTimeMult`, `reviveHpPct`, `reviveInvulnerable`, `bleedOutMult`, `staggerMult`, `perfectResonance`, `responseBonus`, `mendLowBonus`/`mendLowBelow`, `empowerLinger`, `beamFocusMult`, `inFieldDamage`, `wardedDamage`, `mendWarded`, `closeRanks`/`closeRanksRadius`, `cueShareSolo`, and the keystones' `graceShieldPct`/`graceShieldDuration`, `lifeReserveMult`, `unsuppressible`, `auraPerExtra`, `lifeCapPct`, `wardHitCap`, `wardDurationMult`, `techniquesCostLife`. With no tree every one is neutral, and a run without one is unchanged seed for seed.
- `WorldState.astrolabe: { nodes: readonly string[] }`.
- `techniqueCost(state, technique)` → `{ amount, pool: 'spirit' | 'life' }` (Stasis, the tree and Eldritch Conduit included), exported for the HUD and the bots. A refused Life cost is `techniqueRejected { reason: 'life' }`.
- `chordProblems(chords, content, opts)`: `opts.reserveMult` and `opts.pool` now come from the Calling and the tree together (`reservePool(calling, content, astrolabe)`).
- Event `graceShield { hero, amount }` (Overflowing Grace).

**Run and profile:**

- Profile v2: `astrolabe: string[]`, migrated from v1 as `[]`. `RANK_XP` reaches Rank 20.
- `meta/astrolabe.ts` (pure): `astrolabePoints(rank)`, `astrolabeProblems(nodes, points)`, `pathTo(allocated, target)`, `canRefund(allocated, node)`, `allocate`, `refund`, `respec`. A loaded tree that no longer fits (content changed) is pruned to what still connects.
- The unlock schedule gains `astrolabe` at Rank 4; every later Rank-up says "+1 Astrolabe point".
- `RunState.astrolabe`: the tree snapshotted at embark (run saves default it to `[]`), passed into every fight's `SimConfig`.

## Presentation

*To be filled in by the UI, VFX and audio workstreams.*

## Harness

*To be filled in after tuning.*

## Code review

*To be filled in after the review.*

## Known gaps

*To be filled in.*

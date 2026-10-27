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
| How strong? | **About +15%** for the best allocation of all 19 points, measured as the enemy life a full tree makes up for (see *Harness*): half of the plan's +30% cap for the Astrolabe and the Reliquary together. |
| Bond's rim (none of the six keystones is about heroes)? | **Two great notables** instead of keystones; the keystones sit two each in Silk, Choir and Aegis. |
| Sanguine Font (as planned it only mattered to the Martyr)? | **Blood for everyone**: your songs reserve Life instead of Spirit, at two-thirds of the rate; 20% of Mend heals you; Spirit regenerates 30% slower. |
| Shatterproof Halo: the rest of a big hit? | **The Ward absorbs it.** Your Ward takes every hit whole, and a hit takes at most half of its full barrier, so a fresh Ward always outlasts the first big hit. It lasts 40% shorter. |
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
| Trunk ×2 | travel | Mend and Empower +2% |
| **Spun Silver** | notable | The Thread reaches 2 m farther before it pulls taut; Mend and Empower +2% |
| Mending ×4 (toward Aegis) | travel | Mend +2% |
| **Second Stitch** | notable | Mend heals 12% more on a hero below 35% of their life |
| **Overflowing Grace** | keystone | Mend's overheal becomes a shield on the hero, up to 20% of their life, lasting 4 s. **Your Ward's barrier is 40% smaller.** |
| Gilding ×2 (toward Choir) | travel | Empower +2% |
| **Afterglow** | notable | Empower lingers on a hero for 2 s after you thread another |
| Blood ×2 | travel | +3% Life |
| **Sanguine Font** | keystone | Your songs reserve **Life instead of Spirit**, two-thirds as much as they would (the Martyr's too); 20% of what Mend heals also heals you. **Spirit regenerates 30% slower.** |

### Choir: the songs (east)

| Node | Kind | Effect |
|---|---|---|
| Trunk ×2 | travel | Aura effect +2% |
| **Clear Voice** | notable | Your songs reserve 4% less; aura effect +2% |
| Swell ×4 (toward Silk) | travel | Aura effect +2% |
| **Held Note** | notable | Your Crescendo lasts 2 s longer |
| **Prism Covenant** | keystone | **You fight at half your Life**: you start each fight there and can't be healed above it. Your auras are 15% stronger and the Thread 10% stronger. |
| Breath ×2, Hall ×2 (toward Bond) | travel | Songs reserve 3% less · the field is 4% wider |
| **Wide Hall** | notable | Your field is 12% wider |
| **Unbroken Chorus** | keystone | **Mutes can't crack your fields or silence you** (the Silent Verse still can). Every aura beyond the second makes all of them 5% stronger. **The Thread is 20% weaker.** |

### Aegis: the techniques (west)

| Node | Kind | Effect |
|---|---|---|
| Trunk ×2 | travel | Ward barrier +2% |
| **Shieldwright** | notable | Ward barrier +4%; Ward recovers 0.5 s faster |
| Guard ×2, Poise ×2 (toward Bond) | travel | Ward barrier +4% · Perfect Wards 0.03 s more forgiving |
| **Ringing Parry** | notable | A Perfect Ward's stagger lasts 50% longer and gives 5 more Resonance |
| **Shatterproof Halo** | keystone | **Your Ward absorbs every hit whole**, and a hit takes at most half of its full barrier. **It lasts 40% shorter** (1.8 s). |
| Economy ×2, Tempo, Composure (toward Silk) | travel | Techniques cost 3% less · recover 3% faster · Spirit regenerates 5% faster |
| **Bell Tower** | notable | Chime reaches 25% wider and heals 25% more |
| **Eldritch Conduit** | keystone | Your techniques cost **Life instead of Spirit** (the same amounts). Your songs reserve 30% less. |

### Bond: the heroes (south)

| Node | Kind | Effect |
|---|---|---|
| Trunk: Hearth, Rhythm | travel | Heroes +1% life · Solos charge 2% faster |
| **Fellowship** | notable | Heroes +2% life and deal 2% more damage |
| Endurance ×2, Grit, Lift (toward Choir) | travel | Heroes +1% life ×2 · downed heroes bleed out 8% slower · Mend revives 8% faster |
| **Close Ranks** | notable | A hero within 4 m of another takes 4% less from ordinary hits |
| **Second Wind** | great notable | A hero Mend revives stands up with 40% of their life (not 30%) and is untouchable for 1 s |
| Rhythm ×3, Spotlight (toward Aegis) | travel | Solos charge 2% faster ×3 · Cued Solos last 5% longer |
| **Ready Answer** | notable | Answering a hero's call gives 5 more Resonance |
| **Ensemble** | great notable | When you Cue a Solo, the other heroes' Solos charge 10% |

### Bridges

| Between | Notable | Effect |
|---|---|---|
| Silk · Choir | **Resonant Thread** | The threaded hero hears your beam song 3% stronger |
| Choir · Bond | **Anthem** | Heroes standing in your field deal 2% more damage |
| Bond · Aegis | **Shield Bearer** | A hero your Ward is on deals 2% more damage while it holds |
| Aegis · Silk | **Lifeguard** | Mend heals a hero your Ward is on 8% more |

**Reading the plan.**

- **Ordinary hits only.** Like armour and the Luminary's Haloed, Close Ranks leaves telegraphed attacks alone: the big hits you see coming are still yours to answer.
- **Hero damage from the tree is yours.** Fellowship, Anthem and Shield Bearer add to what heroes deal, and the ledger credits the extra to the Weaver, as it does Heavy Score's.
- **Why Bond's numbers are small.** Every percent of the heroes' life and damage is worth more than a percent of anything else (a percent more hero damage shortens every fight by about a percent, and a little more life can lift a hero over a big hit), so Bond's always-on stats are 1–2% and its travel nodes lean on revives and Solos. See *Harness*.
- **Prism Covenant** is "real low life" made simple: you're always at or below half, so its bonuses are always on, and the price is always paid. On a Martyr run it halves the Life her songs leave her.
- **Sanguine Font** turns the songs' Spirit into Life for any Calling, at two-thirds of the share (a song that would hold 30% of Spirit holds 20% of Life), so all of your Spirit goes to techniques. It can't take you under the Martyr's floor: songs may hold at most 90% of your Life.
- **Eldritch Conduit** makes Spirit only the songs' pool. Techniques that can't be paid in Life (it would down you) are refused, as if you were out of Spirit.
- **Shatterproof Halo** works on every Ward, an Echo Ward and Martyr's Aegis included; a Perfect Ward is still Perfect. A hit takes at most half of the Ward's *full* barrier, and the Ward absorbs all of it: a fresh Ward always outlasts the first big hit, and even the hit that breaks a worn one doesn't get through.
- **Overflowing Grace** shields only from Mend's overheal (not the songs' regeneration). Each top-up restarts its clock, so it holds while Mend keeps feeding it. It keeps to its own shield: another overshield on the hero (their own, or another of yours, like Silver Thimble's) is left as it is.
- **Second Wind** is for the heroes Mend stands back up; Rewind's revive (the Chronomancer) keeps its own rules.
- **Prep follows the tree within the points you have now.** Turning "Skip the unlocks" off takes the extra points back from Prep (the profile keeps the whole tree for when they return), so the songs Prep offers are the ones the run will embark with.

## Contracts (v9)

**Content** (`CONTENT_VERSION` bump): `astrolabe: { nodes, links }`. A node is `{ id, name, kind: 'start' | 'travel' | 'notable' | 'great' | 'keystone', constellation: 'centre' | 'silk' | 'choir' | 'aegis' | 'bond' | 'bridge', x, y, effect, values, text }`; `links` lists each link once as a pair of ids (validated: real nodes, no repeats, every node reaches the centre). Node text is built from `values` (like the Callings').

**Sim** (`SIM_VERSION` 11, replay format 6):

- `SimConfig.astrolabe?: readonly string[]` (resolved: sorted node ids, `[]` by default; the replay schema defaults it). Unknown ids are ignored, as unknown relics are.
- Mods gain the tree's levers, applied after motifs, relics, boons and the Calling (multipliers multiply, bonuses add): `auraEffectMult`, `reserveMult`, `techCostMult`, `heroLifeMult`, `reviveSpeedMult`, `reviveHpPct`, `reviveInvulnerable`, `bleedOutMult`, `staggerMult`, `perfectResonance`, `responseBonus`, `mendLowBonus`/`mendLowBelow`, `empowerLinger`, `beamFocusMult`, `inFieldDamage`, `wardedDamage`, `mendWarded`, `closeRanks`/`closeRanksRadius`, and the keystones' `graceShieldPct`/`graceShieldDuration`, `lifeReserveMult`, `unsuppressible`, `auraPerExtra`, `lifeCapPct`, `wardHitCap`, `wardDurationMult`, `techniquesCostLife`. Ensemble adds to the Canon motif's charge (`canon`), as it's the same thing. With no tree every one is neutral, and a run without one is unchanged seed for seed.
- `WorldState.astrolabe: { nodes, keystones, techCostMult, techniquesCostLife, lifeCapPct }`: the tree and what the HUD needs from it. Overflowing Grace's shield carries `grace: true` (absent on every other shield).
- `techniqueCost(state, technique)` → `{ amount, pool: 'spirit' | 'life' }` and `canPay(state, technique)` (Stasis, the tree and Eldritch Conduit included), exported for the HUD and the bots; the sim's own `spend` agrees. A refused Life cost is `techniqueRejected { reason: 'life' }`. `WorldState.calling.stasisCostMult` carries Stasis's discount.
- `songReserve(callingReservesLife, nodes)` / `songReserveOf(calling, nodes)` → `{ pool, mult }`: the songs' pool and the multiplier on their share, for `chordProblems` and the song builder. `treeNodes`, `treeKeystones`, `KNOWN_ASTROLABE_EFFECTS`.
- `chordProblems(chords, content, opts)`: `opts.reserveMult` and `opts.pool` now come from the Calling and the tree together (`reservePool(calling, content, astrolabe)`).
- Event `graceShield { hero, amount }` (Overflowing Grace).

**Run and profile:**

- Profile v2: `astrolabe: string[]`, migrated from v1 as `[]`. `RANK_XP` reaches Rank 20.
- `meta/astrolabe.ts` (pure): `astrolabePoints(rank, all)`, `astrolabeProblems(tree, points)`, `neighbours(id)`, `pathTo(tree, target)`, `allocate(tree, target, points)`, `canRefund(tree, id)`, `refund(tree, id)` and `pruneTree(tree, points)`. Starting over is the profile store's `respecTree()`. A loaded tree that no longer fits (content changed) is pruned to what still connects.
- The unlock schedule gains `astrolabe` at Rank 4; every later Rank-up says "+1 Astrolabe point".
- `RunState.astrolabe`: the tree snapshotted at embark (run saves default it to `[]`), passed into every fight's `SimConfig`.

## Presentation

Details and screenshots: [UI](phase-4/ui.md), [VFX](phase-4/vfx.md), [audio](phase-4/audio.md). The screenshots were taken before the second tuning pass, so some numbers on them are the first pass's.

| | |
|---|---|
| **The Astrolabe** | Its own screen, opened from the Title (from Rank 4, or with Skip the unlocks) and from Prep: an SVG dial drawn from content. Silk, Choir, Aegis and Bond each have a colour, a glyph and a quarter of the dial, and they're named round the rim with how many stars are lit. Stars are sized by kind (keystones in diamonds, great notables crowned) and are owned, takeable or far. Pointing at one lights the path to it and its cost, or what hangs on a star you own. Click or Enter takes, and Delete or right-click gives back when nothing hangs on it. Respec asks first. "N of M points" sits at the top. A tree bigger than the points (Skip the unlocks turned off) is flagged, and the stars embarking would drop are dashed. The side panel adds the tree up by stat and lists each keystone with its price. Keys move between stars, and it fits 1280×720. |
| **Prep, Title, Rank-ups** | Prep shows the points left and a chip for each keystone the run takes, and says what pays for what under Sanguine Font and Eldritch Conduit. The song builder (Prep, Retune, the lab) uses the run's pool and the tree's multiplier, so it accepts exactly what the run does, and it shows "−N% from the Astrolabe". The Rank 4 card opens the Astrolabe with its 3 points; every later Rank says "+1 Astrolabe point". |
| **HUD** | Technique costs and whether you can pay come from the sim's `techniqueCost` and `canPay`. Under Eldritch Conduit they're in Life, with a heart, and a refusal says "Ward: not enough Life". The Life bar marks Prism Covenant's cap and Sanguine Font's reservation. Hero frames show Afterglow and Overflowing Grace's shield. A keystone chip sits beside the Calling chip. |
| **Summary, Codex, Training** | "Your Astrolabe" on the Summary (a small map, the keystones, the totals), an Astrolabe tab in the Codex, and Training fights with the profile's tree cut to your points. |
| **In the fight** | **Overflowing Grace** fills a shell from below in Mend's colour, up to its cap, and brims over. **Shatterproof Halo** is a circlet round the Ward: its lit arc is the barrier left, its height the Ward's time left, and a hit it absorbs whole rings it like a bell while the lost half falls away. **Eldritch Conduit** gives the Weaver a blood-violet rim and draws Life into her hand when a technique is paid. **Prism Covenant** is a spectral edge on her while she is at her ceiling. **Afterglow** is a gold haze at the hero's feet, fading with the linger. **Second Wind** is a gust and a shell with a countdown ring. **Unbroken Chorus** keeps her fields whole under a Mute, with a faint shimmer where the dome meets them. No aura's look changed, and nothing adds a draw call. |
| **Sound** | The star map is an astrolabe's brass and glass in D dorian: small carillon bells with glass stars kindling above them. Hover is a glint, a node a struck bell, a notable two bells with stars, a keystone a great low bell over a choir, a path a rising run, giving back the take reversed, and a respec stars going out. In the fight: Grace's overflow chime on the hero's note, a blood pulse under a technique paid in Life, a bright ring when the Halo holds a hit that would have broken the Ward, a quiet tail for Afterglow, and a fuller revive for Second Wind. Unbroken Chorus is heard when it saves her: as she walks under a Mute's dome, her songs hold (the choir's open fifth, the dome's glass pushed back). Each is silent without its node. Prism Covenant and Sanguine Font have no sound of their own. |

## Harness

**The yardstick.** "About +15%" is measured as enemy life: a tree worth +15% wins whole runs against enemies with 15% more life as often as no tree does against normal ones.
- **Command:** `npx tsx tools/astrolabe.ts --threat 1.15 --seeds 400` plays whole Prelude runs with each sample tree (19 points, `TREES` in the tool) against enemies with 15% more life, on the same seeds as runs with no tree. The table pools two blocks of 400 seeds (800 runs a cell).
- **Why it's read as "worth".** Win rates swing hard with power: 15% more enemy life takes the Novice from 32% to 15% on Guardian. So each win rate is read as the enemy life it makes up for, on a logistic scale between the two no-tree baselines. Expect ±2–3 points of noise in each "worth".

| Sample tree (Novice) | Guardian, 2 auras | worth | Bastion, 3 auras | worth |
|---|---|---|---|---|
| No tree, normal enemies | 32% | | 58% | |
| No tree, 15% more enemy life | 15% | | 33% | |
| **Bond**: both great notables, both bridges | 37% | +18% | 57% | +14% |
| **Four first notables** and three bridges | 36% | +17% | 64% | +19% |
| **Silk**: both notables, no keystone | 35% | +17% | 54% | +13% |
| Overflowing Grace | 33% | +15% | 59% | +16% |
| **Aegis**: both notables, no keystone | 32% | +15% | | |
| Prism Covenant | 30% | +13% | 63% | +18% |
| **Choir**: both notables, no keystone | 27% | +11% | 59% | +16% |
| Sanguine Font | 27% | +11% | | |
| Eldritch Conduit | 27% | +11% | | |
| Shatterproof Halo | 22% | +7% | | |
| Unbroken Chorus | 18% | +3% | 55% | +14% |

The best allocation comes out at about +17–19%, a little over the +15% asked for. Most trees are within a few points of each other. Choir trees depend on how many auras you sing (Unbroken Chorus does nothing for two), and the keystone trees read weaker for a bot that doesn't build around them. **The Skilled bot can't be read this way.** On Guardian, 15% more enemy life costs it only about 6 points (84% → 79%, 600 runs), while the trees lift it back to 87–90% against the stronger enemies:
- Silk 90% and the four first notables 88% (600 runs each);
- Bond and Overflowing Grace 87% (200 runs each).

The first pass's measure suits it better: the Weaver's output (healing, shielding, negation and amplification) in the six hard fights, 20 seeds each at Threat 1.
- **Skilled:** +3% a fight with Bond, +7% with Silk, +9% with the four first notables or Overflowing Grace.
- **Novice:** +9% to +15%.

**How it got there.**

1. **The first pass** tuned against the Weaver's output (healing, shielding, negation and amplification) in the six hard fights. For the Skilled bot, the best trees came out at +7% to +16% output.
2. **Whole runs said otherwise.** At normal enemy life, the Novice's Bond tree won 82% of runs against 32% with no tree: +50 points, where a Calling is worth +14. Output missed the heroes: their life and damage aren't the Weaver's output, and they were most of the power. So the yardstick became enemy life, which counts everything.
3. **Taking parts away one at a time** found where the power was:
   - hero damage first (every percent shortens every fight), then Second Wind (a revived hero at 60% life and untouchable), hero life and the Solos;
   - later, revive speed, once two Lift nodes added up to 30%;
   - a few percent of hero life could swing the four-notables tree by 10 points on fresh seeds, a sign that some big hits sit just under a hero's life.
4. **The fixes.**
   - Bond's always-on stats went to 1–2%. Its trunk became Hearth and Rhythm, and Rhythm also replaced Kindred in the Solo branch. Revives, Solos and the bridges got lighter.
   - Second Wind (40%, 1 s) and Ensemble (10%) were then put back above the smallest values tried, so the greats still feel great. That costs Bond about two points.
5. **Choir and the reservation.** On Guardian (two auras) Choir was the weakest constellation; raising it made it the strongest on Bastion (three). It's calibrated on three. On a loadout whose songs already hold most of its Spirit, "your songs reserve less" is worth the most, so Clear Voice and the Breaths came down most.
6. **The rest of the trees** came down by about a quarter: Mend, Empower, Weaver life, Second Stitch, Lifeguard, the first notables and Overflowing Grace's cap. Some Ward moved from Aegis's trunk to its Guards, so a generalist gets less of it and an Aegis tree keeps it.

**What it isn't.** Every measurement is a bot's. A player who builds around a keystone (several auras for Unbroken Chorus, Ward timing for Shatterproof Halo, techniques for Sanguine Font and Eldritch Conduit) gets more from it than these runs show.

## Code review

An independent review of the sim and run-layer commits (6e45613, ee6b25e, a05fe95), on a clean copy, with scratch tests to confirm each finding. Nothing severe:
- **No tree, no change.** A run without a tree is byte-identical to e2ff0f4: 80 whole runs (no Calling and each Calling, both bots, both path options), every event, snapshot and ledger hashed.
- **The star map's moves are safe.** Allocate, refund and prune never made a tree `astrolabeProblems` rejects, over 24,000 random states.
- **Runs and saves hold.** The tree is frozen at embark, and old profiles, saves and replays load.

What it found, and what changed:

| Finding | Fix |
|---|---|
| Overflowing Grace's shield ran out 4 s after reaching its cap though Mend kept feeding it. It also topped up and stretched the Weaver's other overshields (Silver Thimble, Dawnward, Lantern). | Every top-up restarts its clock, even at the cap. It keeps to its own shield (marked `grace`). Tests: 20 s of Mend at full life is one shield and one event; another of your overshields is neither topped up nor kept. |
| Prep and Retune judged songs without the tree's lighter songs or Sanguine Font's Life. Legal songs were refused, and Sanguine Font songs at 100% of Spirit couldn't embark. The HUD showed Spirit on a Sanguine Font run and ignored Economy and Life costs. The Training Grounds had no tree. | Fixed in the UI workstream. Prep, Retune and the song builder take the run's pool and multiplier, so they accept exactly what the run layer does. The HUD asks `techniqueCost` and `canPay`. Training uses the profile's tree. |
| The death recap counted a technique as ready if Spirit covered it, even under Eldritch Conduit at 10 Life. | It asks `canPay`, so the tree's costs and Life count. |
| Prism Covenant: re-forming at half her Life could round a fraction above the ceiling. | Clamped to the ceiling. |
| Songs that only a tree makes light enough were never remembered for the next run. | They're remembered as the run held them, and the next run takes them if its own tree can hold them. |
| After "Skip the unlocks" was turned off, Prep followed the whole tree. Songs only that tree allowed were accepted, then silently swapped out at embark. | Prep follows the tree within the points you have now. The profile keeps the rest. |
| The doc and the code disagreed on the Contracts' names, Shatterproof Halo's wording and Second Wind's reach. | The doc now says what the code does (see *Reading the plan* and *Contracts*). Shatterproof Halo's node text now says a hit takes at most half its *full* barrier. |

Each fix has a test that fails without it.

**Final checks** (5b3ac27 and this doc):
- typecheck, lint and 992 unit tests pass;
- 10 of 10 end-to-end tests pass, the new one taking the Astrolabe from Prep through take, give back, respec and a keystone's path to embarking with it;
- the e2e perf budget passes;
- 96 whole runs with no tree (no Calling and each Calling, both bots) are identical to e2ff0f4.

## Known gaps

- **Measured with bots.** The +15% is calibrated on the Novice bot's whole runs. Nodes that reward skill (Poise, Ringing Parry, Shatterproof Halo, Stasis-era tricks) are worth little to it, so Aegis and the Halo read weaker here than they may play.
- **Choir depends on how many auras you sing.** With two (Guardian) the Choir tree is the weakest; with three (Bastion) it's in line with the others. Calibrated on three.
- **The best trees run a little hot.** They're about +17–19% (Bond on two auras, the four first notables, Prism Covenant on three) against the +15% asked for. The levers are the first notables and Bond's greats, which were kept above their smallest tried values so they still feel great.
- **Hero life is lumpy.** A few percent of hero life can lift a hero over a boss's big hit, so Bond's numbers are small and still worth the most per percent. Making the greats bigger means making Bond's travel nodes smaller still.
- **The UI repeats some of the tree's sums** (life, technique costs, Life costs, the ceiling, bleed-out, Afterglow) for the song builder, before any fight exists. Each is pinned to the sim's mods by a test; a pure `treeMods(nodes)` export from the sim would replace them.
- **Render infers three things the sim could say.** A Halo hit held (two big hits in one tick ring once; a hit worth exactly the cap doesn't ring), who paid what for a technique, and which revive was Second Wind's. Events would fix all three: `shieldHeld`, `techniqueCast { paid, pool }`, `revived { via }`.
- **Sound:** the Life pulse plays at most every 0.3 s, so some Stasis casts are paid silently; no bot ever triggers the Life refusal (tests and the lab cover it); the hover can't follow which star is hovered.
- **The star map:** the tooltip can reach about 14 px past the map to keep the path visible; under deuteranopia and protanopia unlit stars of different constellations look closer (position, rim names and glyphs carry them); arrow keys go to the nearest star in that direction, so some take a detour; the screen is heavy under software GL. The Astrolabe can be opened from the Title during a run, and says the run keeps the tree it embarked with.
- **Old replays** load and re-simulate but no longer match their hash (`sim v10 ≠ v11`), as with every sim version bump.
- **The aura extras** (they touch the auras' sound or look). The user left them to the lead, to fit the game's theme:
  - **Built:** Unbroken Chorus's "songs holding" sound. It makes the keystone heard at the moment it saves her, which is the game's "proof of support" idea, and it plays only then.
  - **Not built:** Afterglow keeping the Thread's gold rim on the hero. The aura's rim tint is how coverage reads without the UI, and the gold would hide it for two seconds.
  - **Not built:** a heartbeat bed under Sanguine Font and a brighter beam hum under Prism Covenant. Either would sit under every fight on those runs, which tires the ear and blurs the songs' own sound.
  - **Kept:** aura cards and chips show what a song actually reserves after the tree's lighter share, as they already did with Grace Note's.

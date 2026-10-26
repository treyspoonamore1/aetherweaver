# Phase 3d — The Martyr

*2026-10-26 · plan: [docs/plan/03-content-bible.md §2](plan/03-content-bible.md#2-callings-choose-one-per-run) · follows [Phase 3c](phase-3c.md)*

The second **Calling**: the one who bleeds for them. The Luminary makes the heroes shine; the Martyr takes their wounds. The user chose how it plays:

| Question | Choice |
|---|---|
| How do you switch the Thread to Bear? | **Its own key** (B by default). Right-click still toggles Mend ⇄ Empower; Bear replaces them while it's on, so protecting a hero costs you their heal or their damage. |
| What happens to Sunrise? | **Martyr's Vow replaces it.** Each Calling has its own ultimate. |
| How does the Martyr reserve Life? | **Every song, as the passive.** On a Martyr run your auras reserve Life instead of Spirit: all your Spirit goes to Ward, Chime and Reel, and your usable Life shrinks by what your songs hold. You live at low Life. |
| When does it unlock? | **A new Rank 8** (2,500 XP), after the Luminary's Rank 7. |

## The Martyr: the one who bleeds for them

> *Let it come to me.*

**Passive.**

- **+100% Life.** The Weaver's 360 becomes 720.
- **Your songs reserve Life instead of Spirit.** The share a loadout would reserve of your Spirit (Guardian: 55%) comes off your Life instead: you fight with what's left (Guardian: 324 of 720), and every point of Spirit is free for techniques. "Below half your Life" counts against all of it, reserved included, so a Martyr singing two auras is always below half.
- **Bear**, a third Thread mode (B): you take **35%** of the life the threaded hero would lose, softened by half, and never more than leaves you at 1 life (your shields count). Their shields, Wards and armour act first; Bear splits what gets through.

**Crescendo: Martyr's Vow** (instead of Sunrise). For 5 s heroes cannot drop below 1 life. Damage past that comes to you instead, at −70%, and your healing received is doubled.

### The path

Four tiers, two options each, picked after the first fight won on rows 0, 3, 5 and 7, as for the Luminary.

| Tier | Option A | Option B |
|---|---|---|
| I | **Penitence**: damage you Bear fills Resonance (4 for every 100). | **Scarred Hide**: you take 15% less damage while Bearing. |
| II | **Blood Font**: while you're below half your Life, the Life your songs reserve regenerates you, 2% of it per second. | **Shared Wounds**: while Bearing, you also take 10% of what every other hero in your field would lose. |
| III | **Undying Devotion**: once a fight, a hit that would down you instead leaves you at 1 life, untouchable for 3 s, and Mends every hero for 30% of their life. | **Low-Life Vigil**: while you're below 35% of your Life, every aura is 30% stronger. |
| IV | **Martyr's Aegis**: your Wards are 50% stronger, and each one shields you too. | **Sanguine Covenant**: Mend heals you for 30% of what it heals. |

The axes: **endure** (Scarred Hide, Blood Font, Undying Devotion), **share the pain** (Penitence, Shared Wounds, Martyr's Aegis) and **live at low Life** (Low-Life Vigil, Sanguine Covenant, Blood Font again).

**Changes from the plan.** The plan gave the Martyr +40% Life and Bear at full force. With every song reserving Life, that left a Guardian Martyr 227 Life against a normal Weaver's 360, and Bear turned big hits into downs: the bots lost ten to twenty points of win rate with her. Tuning ([Harness](#harness)) settled on +100% Life, Bear softened by half, and a guard rail: Bear never takes more than leaves her at 1 life. The plan's Penitence restored Spirit; with every song reserving Life, Spirit is plentiful, so Penitence fills Resonance instead and brings the Vow sooner. The plan's Blood Font regenerated "Life reserved by auras": with Life reservation now the Martyr's passive, it keeps that wording. Martyr's Aegis's "your Wards also shield you" is a Ward barrier on the Weaver herself, sized from her own Life.

**What it doesn't change.** The auras work as before: the same effects, the same share of a pool. Only the pool is Life instead of Spirit, and Low-Life Vigil (like the Luminary's Sovereign Symphony) makes every aura stronger while it holds.

## Contracts (v7)

**Content.** The Martyr in `callings`, unlocked at Rank 8. A Calling may name its own Crescendo (`crescendoName`); the Luminary keeps Sunrise.

**Sim** (`SIM_VERSION` 7, replay format 6):

- `ThreadMode` adds `'bear'`. `WeaverComponent.lastMode` is the mode Bear returns to.
- Command `{ t: 'mode', mode?: 'bear' }`: without `mode`, Mend ⇄ Empower (from Bear, back to `lastMode`); with `'bear'`, Bear on and off. Without the Martyr, Bear is refused (`techniqueRejected`, technique `'thread'`, reason `'locked'`).
- `WeaverComponent.maxLife` (all of it, reserved included) and `reservedLife`. `health.maxHp` is the usable part, so heals stop there. `reservedSpirit` is 0 on a Martyr run.
- `FieldState.vow`: Martyr's Vow is up. `field.crescendo` stays "Sunrise is up", so everything that reads it (aura strength, reach, the Luminary's Radiance and Eclipse, the views) is untouched by the Vow. The Weaver's `crescendo` clock times both.
- Events: `borne { hero, amount, via: 'bear' | 'shared' | 'vow' }` when damage a hero would have taken goes to the Weaver; `undying { }` when Undying Devotion holds. `crescendoStart.calling` carries "Martyr's Vow".
- Ledger `calling { amplified, shielded, borne }`: `borne` is the damage the Weaver took for her heroes (after Bear's softening); what Bear, Shared Wounds and the Vow kept off a hero counts as shielded. `EncounterStats.callingBorne`. Save causes `'bear'` and `'vow'`; `DamageResult.saved` keeps a telegraph from logging a second Save for the same hit.
- Heal source `'self'`: the Martyr healing herself (Blood Font, Sanguine Covenant), kept out of the support ledger. During the Vow, her healing received doubles.
- `chordProblems(chords, content, { fieldAuraSlots, pool })`: with `pool: 'life'`, songs may reserve at most 90% (the Weaver keeps a tenth of her Life).
- `WorldState.calling` adds `crescendo: 'sunrise' | 'vow'` and `bearShare`.
- Mods: `lifeMult`, `lifeReserve`, `bearShare`, `borneTaken` (Bear's softening), `vowDuration`, `vowRedirect`, `vowHealMult`, `penitencePer100`, `bearDamageTaken`, `bloodFontPct`, `bloodFontBelow`, `sharedWounds`, `undyingInvulnerable`, `undyingMendPct`, `vigilBelow`, `vigilMult`, `aegisWardMult`, `aegisSelf`, `covenantPct`.

**Run** (save v5, unchanged shape):

- `RANK_XP` gains Rank 8 at 2,500 XP, which unlocks `calling.martyr`.
- The song pool follows the run's Calling (`Run.reservePool(run)`): Prep, Retune, the forge and events check Life on a Martyr run. `embark` resets Chords the new pool can't hold.

## Presentation

*To be filled in by the UI, VFX and audio workstreams.*

## Harness

`npx tsx tools/callings.ts --calling martyr --loadout guardian --seeds 50`: whole Prelude runs, every one of the 16 paths on its own 50 seeds (800 runs a bot), against the same seeds with no Calling.

| Loadout · bot | No Calling | Martyr, all paths | I: Penitence · Scarred Hide | II: Blood Font · Shared Wounds | III: Undying · Vigil | IV: Aegis · Covenant |
|---|---|---|---|---|---|---|
| Guardian · Novice | 32% | **46%** | 48 · 44 | 47 · 44 | 44 · 47 | 49 · 42 |
| Steady · Novice | 38% | **49%** | 50 · 48 | 51 · 47 | 49 · 50 | 49 · 49 |
| Guardian · Skilled (400 runs) | 86% | **88%** | 91 · 85 | 88 · 88 | 87 · 89 | 88 · 88 |
| Steady · Skilled (400 runs) | 88% | **89%** | 88 · 89 | 89 · 89 | 89 · 88 | 87 · 91 |

The Martyr is worth 11 to 14 points to the Novice and 1 or 2 to the Skilled bot, level with the Luminary (Guardian 42%, Steady 49% for the Novice). Within each tier the two options sit within five points, except Guardian's capstone (Martyr's Aegis 49, Sanguine Covenant 42; level for Steady).

**How it got there.** The bots first had to learn Bear. A Novice that Bore whenever a hero was low gave up Mend exactly when it mattered; a Skilled bot that Bore any big hit it could afford left the Weaver too low for the next raid. Both now Bear just before a big hit on the threaded hero that no shield will stop (the Novice notices less often and lingers in Bear), and Mend or Empower otherwise. Then the numbers, measured fight by fight (the six hard fights, Threat 1, Guardian, 20 seeds) and in whole runs:

| Martyr | Fights: Novice · Skilled | Whole runs, Novice: Guardian · Steady |
|---|---|---|
| No Calling | 73% · 94% | 32% · 38% |
| The plan: +40% Life, Bear at full force (the first bot policies) | 55% · 87% | |
| Bear off, +40% Life | 71% · 92% | |
| +70% Life, Bear softened by half | | 40% · 41% |
| **+100% Life, Bear softened by half (shipped)** | | **44% · 49%** |
| +150% Life, Bear softened by half | 73% · 97% | 53% · 56% |

Without Bear the Life reservation is close to neutral: what the songs take from her Life, the free Spirit gives back. Bear at full force was the trap: a big hit's share could be more than her whole usable Life (227 for a Guardian Martyr), downing her and silencing every song. The guard rail (never more than leaves her at 1 life) and the softening made Bear a tool rather than a risk of losing the fight; +100% Life puts her level with the Luminary.

**What the bots can't show.** As for the Luminary, the bots almost never cast a Crescendo, so Martyr's Vow is tuned by reasoning. And the Skilled bot rarely needs Bear (its Wards answer most big hits), so the Martyr is mostly a different way to play for it, not more power.

## Code review

An independent review of the sim, run layer, bots and input (read-only, against a clean copy of the commits) found these, all fixed with regression tests:

- **The Vow logged a Save for every hit on a hero it held**, with a slow-motion beat each time; it now logs one, when it first holds them at 1. A hit could also leave a hero at 0.5.
- **Bear charged her for hits that felled the hero anyway**, and after Martyr's Veil had spent her life it could still down her. Bear now lifts nothing from a hit that stays lethal (the Veil, Fermata or the Vow may still catch it), and the "never below 1" cap holds.
- **Bear and the Vow worked for free while she was untouchable or down.** Bear lifts nothing while she's invulnerable; the Vow ends when she goes down; what she bore is credited from what she actually took.
- **A hero Fermata already held was still Borne and Vowed**, and a hold running out during the Vow downed them.
- **Her own Martyr's Aegis Ward counted as shielding the party**, and **Scarred Hide worked with no Thread attached**.
- **The new B default took over a key a player had already bound** (now a player's binding always wins), and **a Prep save with the Martyr over songs her Life couldn't hold was thrown away on reload**.
- The result's Crescendo highlight said Sunrise on a Martyr run; the bots judged Bear on the hero they were leaving.

## Known gaps

- **The bots barely use the Martyr's tools.** The Skilled bot rarely Bears (its Wards answer most big hits) and neither bot casts the Vow, so both are tuned by reasoning more than measurement.
- **Two loadouts measured.** Heavier songs (Bastion, Anchor, Wide Choir) reserve more of her Life and leave her more fragile; they weren't swept.
- **Calling mastery** (path tiers earned by playing a Calling) isn't in: every tier is open from the start.
- Guardian's capstone leans to Martyr's Aegis (above).

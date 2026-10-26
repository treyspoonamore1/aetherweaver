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

- **+40% Life.** The Weaver's 360 becomes 504.
- **Your songs reserve Life instead of Spirit.** The share a loadout would reserve of your Spirit (Guardian: 55%) comes off your Life instead: you fight with what's left (Guardian: 227 of 504), and every point of Spirit is free for techniques. "Below half your Life" counts against all of it, reserved included, so a Martyr singing two auras is always below half.
- **Bear**, a third Thread mode (B): you take **35%** of the life the threaded hero would lose. Their shields, Wards and armour act first; Bear splits what gets through.

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

**Changes from the plan.** The plan's Penitence restored Spirit; with every song reserving Life, Spirit is plentiful, so Penitence fills Resonance instead and brings the Vow sooner. The plan's Blood Font regenerated "Life reserved by auras": with Life reservation now the Martyr's passive, it keeps that wording. Martyr's Aegis's "your Wards also shield you" is a Ward barrier on the Weaver herself, sized from her own Life.

**What it doesn't change.** The auras work as before: the same effects, the same share of a pool. Only the pool is Life instead of Spirit, and Low-Life Vigil (like the Luminary's Sovereign Symphony) makes every aura stronger while it holds.

## Contracts (v7)

**Content.** The Martyr in `callings`, unlocked at Rank 8. A Calling may name its own Crescendo (`crescendoName`); the Luminary keeps Sunrise.

**Sim** (`SIM_VERSION` 7, replay format 6):

- `ThreadMode` adds `'bear'`. `WeaverComponent.lastMode` is the mode Bear returns to.
- Command `{ t: 'mode', mode?: 'bear' }`: without `mode`, Mend ⇄ Empower (from Bear, back to `lastMode`); with `'bear'`, Bear on and off. Without the Martyr, Bear is refused (`techniqueRejected`, technique `'thread'`, reason `'locked'`).
- `WeaverComponent.maxLife` (all of it, reserved included) and `reservedLife`. `health.maxHp` is the usable part, so heals stop there. `reservedSpirit` is 0 on a Martyr run.
- `FieldState.vow`: Martyr's Vow is up. `field.crescendo` stays "Sunrise is up", so everything that reads it (aura strength, reach, the Luminary's Radiance and Eclipse, the views) is untouched by the Vow. The Weaver's `crescendo` clock times both.
- Events: `borne { hero, amount, via: 'bear' | 'shared' | 'vow' }` when damage a hero would have taken goes to the Weaver; `undying { }` when Undying Devotion holds. `crescendoStart.calling` carries "Martyr's Vow".
- Ledger `calling { amplified, shielded, borne }`: `borne` is the damage the Weaver took for her heroes; what Bear, Shared Wounds and the Vow kept off a hero counts as shielded. Save causes `'bear'` and `'vow'`.
- `chordProblems(chords, content, { fieldAuraSlots, pool })`: with `pool: 'life'`, songs may reserve at most 90% (the Weaver keeps a tenth of her Life).
- `WorldState.calling` adds `crescendo: 'sunrise' | 'vow'` and `bearShare`.
- Mods: `lifeMult`, `lifeReserve`, `bearShare`, `vowDuration`, `vowRedirect`, `vowHealMult`, `penitencePer100`, `bearDamageTaken`, `bloodFontPct`, `bloodFontBelow`, `sharedWounds`, `undyingInvulnerable`, `undyingMendPct`, `vigilBelow`, `vigilMult`, `aegisWardMult`, `aegisSelf`, `covenantPct`.

**Run** (save v5, unchanged shape):

- `RANK_XP` gains Rank 8 at 2,500 XP, which unlocks `calling.martyr`.
- The song pool follows the run's Calling (`Run.reservePool(run)`): Prep, Retune, the forge and events check Life on a Martyr run. `embark` resets Chords the new pool can't hold.

## Presentation

*To be filled in by the UI, VFX and audio workstreams.*

## Harness

*To be filled in after tuning.*

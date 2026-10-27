# Phase 3e — The Chronomancer

*2026-10-27 · plan: [docs/plan/03-content-bible.md §2](plan/03-content-bible.md#2-callings-choose-one-per-run) · follows [Phase 3d](phase-3d.md)*

The third **Calling**: the one who was ready. The Luminary makes the heroes shine and the Martyr takes their wounds; the Chronomancer bends the seconds around them. The user chose how it plays:

| Question | Choice |
|---|---|
| Rewind on a hero who went down in the last 3 s? | **It brings them back**, with the life they had then. A clutch undo, on an 18 s cooldown. |
| Rewind when the hero had less life 3 s ago? | **It never lowers their life.** They keep the higher of now and then; their place always goes back. |
| What does Foresight show? | **Attacks 1 s early**: each enemy attack appears as a faint outline, with its target, a second before its telegraph starts. The attack itself is unchanged. |
| When does it unlock? | **A new Rank 9** (3,350 XP), after the Martyr's Rank 8. |

Like the Martyr's Vow, the Chronomancer's Crescendo, **Stasis**, replaces Sunrise; like Bear, **Rewind** takes an existing key (Reel's, F).

## The Chronomancer: the one who was ready

> *Again. I was ready this time.*

**Passive.**

- **Perfect Wards are 0.1 s more forgiving** (as the Steady Hands motif words it), and **every telegraph shows its timer** (the seconds until it lands).
- **Rewind replaces Reel** (F, same Spirit cost and range): the threaded hero (or the hero you point at, as for Reel) returns to where they stood **3 s ago** and to the life they had then, **never less than they have now**. A hero who **went down** in those 3 s stands back up with that life. **18 s cooldown.** Statuses and shields are untouched. If it moves them out of an attack's shape, it counts as dodging it, as Reel did.

**Crescendo: Stasis** (instead of Sunrise). For **3 s** every enemy and everything it set in motion stands still: no movement, no attacks, telegraphs and casts paused, enemy projectiles hanging in the air, summons and waves waiting, boss scripts and the enrage timer paused, and the statuses enemies carry or put on heroes (marks, links, silence, stun) paused. Heroes and the Weaver act as normal, so heroes keep hitting. While it lasts, **techniques have no cooldowns and cost half Spirit** (Ward uses no charge; Chime, Rewind and Glide neither need nor start a cooldown).

### The path

Four tiers, two options each, picked after the first fight won on rows 0, 3, 5 and 7, as for the other Callings.

| Tier | Option A | Option B |
|---|---|---|
| I | **Quickened**: your techniques recover 10% faster. | **Foresight**: you see every enemy attack 1 s before it begins, with its shape and its target. |
| II | **Echo Ward**: a Perfect Ward comes back 1 s later at 50% strength. | **Borrowed Time**: Rewind also fills 30% of that hero's Solo. |
| III | **Temporal Mastery**: Glide resets the cooldown of the last technique you used, once every 10 s. | **Slow Dance**: enemies in your field move 15% slower and wind up 10% longer. |
| IV | **Paradox**: Rewind also undoes every attack aimed at that hero. | **Eternal Moment**: Stasis lasts 2 s longer, and a Ward cast during it that turns out Perfect gives 10 Resonance. |

The axes: **see it coming** (Foresight, Echo Ward, Slow Dance), **more turns** (Quickened, Temporal Mastery, Eternal Moment) and **undo it** (Borrowed Time, Paradox).

**Reading the plan.** The plan leaves a few things open; this is how they're settled.

- **Foresight** "looks 1 s further ahead": each special attack an enemy is about to use is *foreseen* once its cooldown is within 1 s, and its target is chosen then (for attacks that pick a target at random, that roll happens a second early). When the attack begins, it uses the foreseen target if they're still valid. If the enemy can't attack yet (out of range, crowded board), the foresight stays until it does or lapses. Boss scripts' scheduled attacks (the cracked bell's second toll, Requiem) are foreseen from their timers.
- **Echo Ward**: the echo is a real Ward, so it can be Perfect against a second hit (the Bellwarden's double toll), but an echo never echoes.
- **Temporal Mastery** on Ward gives a charge back.
- **Paradox**: attacks targeted at the hero (a mark on them, a link through them, a lance or cleave aimed at them) are cancelled outright; an area attack they stand in when you Rewind passes them by. Either way it's an answered attack.
- **Eternal Moment**: nothing lands during Stasis, so "Perfect Wards during Stasis" means Wards *cast* during it that are Perfect when the attack resumes.
- **A Ward cast during Stasis counts as cast at the frozen moment**: if the attack was already inside its Perfect window when time stopped, a Ward cast any time during Stasis is Perfect when it lands (if it's still up).

**What it doesn't change.** Auras, songs and the Thread work as before. Stasis has no aura surge and no heal (`field.crescendo` stays "Sunrise is up", false).

## Contracts (v8)

**Content.** The Chronomancer in `callings` (`crescendoName: 'Stasis'`), unlocked at Rank 9.

**Sim** (`SIM_VERSION` 9, replay format 6):

- Mods: `rewindSeconds` (0 = Reel), `rewindCooldown`, `stasisDuration` (0 = no Stasis), `stasisCostMult`, `techCooldownMult` (Quickened), `foresight` (seconds, 0 = none), `echoWardDelay`, `echoWardPct`, `borrowedTimeSolo`, `masteryCooldown`, `slowDanceSpeed`, `slowDanceWindup`, `paradox`, `stasisPerfectResonance`; the passive adds to `perfectWindowBonus`.
- `HeroComponent.past`: the hero's last 3 s, sampled every 0.1 s (`{ hp, x, z, up }`, a ring buffer with `pastAt`), kept on Chronomancer runs only (empty otherwise).
- `WeaverComponent.lastTechnique` (`'ward' | 'chime' | 'reel' | null`) and `masteryAt` (Temporal Mastery).
- `EnemyComponent.foreseen`: `{ attackId, name, target, at } | null`, the attack it's about to use and when (Foresight).
- `FieldState.stasis`: Stasis is up. Every enemy-side clock waits while it lasts (telegraph `start`/`impact`/`perfectFrom`, enemy casts, enemy projectiles and summons in flight, waves, boss timers, `encounter.enrageAt`, `foreseen.at`, enemy shields): they move forward with time, so `impact − time` stands still. Ward shields' `appliedAt` move with them (Perfect timing is in the enemies' time). Consumers that cached a telegraph's impact from its event must read the state while Stasis is up.
- `Shield.echo` (an Echo Ward) and `Shield.stasis` (cast during Stasis), both optional and absent on every other shield.
- Ledger `calling` adds `rewound` (life Rewind restored, revives included) and `revived` (heroes it stood back up). `EncounterStats.callingRewound` and `callingRevived`. Save cause `'rewind'`: a hero Rewind stood back up. Heal source `'rewind'`.
- `WorldState.calling.crescendo` adds `'stasis'`; `calling.rewind` (Rewind replaces Reel), `calling.timers` (telegraphs show timers), `calling.foresight` (seconds).
- Events:
  - `techniqueCast` / `techniqueRejected` with `technique: 'rewind'`: Rewind keeps Reel's slot (`cooldowns.reel`, the F key) but names itself.
  - `rewound { target, fromX, fromZ, toX, toZ, restored, revived }`, with a `healApplied { via: 'rewind' }` for the life restored (a revive also emits `revived`).
  - `foreseen { enemy, attack, name, target, at }` when an attack is first foreseen.
  - `echoWard { target, amount }`, `temporalMastery { technique }`, `paradox { target, cancelled }`.
  - `crescendoStart.calling` carries "Stasis".
- Command `{ t: 'tech', id: 'reel', slot? }` casts Rewind on a Chronomancer run.

**Run** (save v5, unchanged shape):

- `RANK_XP` gains Rank 9 at 3,350 XP, which unlocks `calling.chronomancer`.
- `SAVE_HOW.rewind`; `summarize` names Stasis.

## Presentation

*To be filled in by the UI, VFX and audio workstreams.*

## Harness

*To be filled in after tuning.*

## Code review

*To be filled in after the review.*

## Known gaps

*To be filled in.*

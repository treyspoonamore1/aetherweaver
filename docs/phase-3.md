# Phase 3 — The Expedition: progress report

*2026-10-25 · plan: [docs/plan/06-roadmap.md, Phase 3](plan/06-roadmap.md#phase-3--the-expedition-a-full-movement-i-run-l)*

Phase 3 builds the full Movement I run (relics, events, the run economy, the first Calling). It starts with two things the first playtest asked for:

1. **The auras, reworked** so they are felt: a **beam song** you pour into one hero and a **field song** for everyone near you, and numbers that show what the auras did.
2. **A progression slice** pulled forward from Phase 4: **Weaver XP and Rank**, unlocking the build layer one piece at a time.

## The playtest that started it

> "I didn't really feel the complexity or need for the auras. It felt like most of my effect came from the beam healing/empowering allies. One of my favorite parts of PoE support is the feeling that you're really enabling and empowering your allies. However, I do like the difficulty of the game."

The harness said the auras were not weak, only invisible:

| Default loadout, whole Prelude runs | Idle | Novice | Skilled |
|---|---|---|---|
| With auras (Phase 2) | 0% | 40% | 93% |
| No auras at all | — | 3% | 20% |

Their damage was folded into the same gold chip as Empower, Sostenuto's healing merged into Mend's green numbers, and they asked nothing of the player during a fight. So the fix makes them **visible** and gives them a **decision inside the fight**. The user chose the design below from three options, then the role of the two Chords from three more.

## The beam song and the field song

| | Chord I: the **beam song** | Chord II: the **field song** |
|---|---|---|
| Who hears it | The hero you thread, at **×2**, wherever they are. Everyone else in its field hears an **echo at ×0.75** | Everyone in its field, at **×1** |
| The fantasy | Make one ally a monster | Make the whole party stronger just by being near you |
| In a fight | Who you thread decides who becomes the monster. Its hexes hit whatever attacks that hero | Where you stand decides who's covered |
| Ornaments | Reverb widens the echo; Pedal Point plants it; **Unison** (beam only) pours everything into the threaded hero at ×2.5 with no echo | Reverb, Pedal Point and Grace Note as before |

Right-click (Mend ⇄ Empower) is unchanged; the beam song flows in both modes. The user flips between them around the heroes' big abilities, so the toggle stays theirs.

**Tuning the echo.** The design started at an echo of ×0.5 (the same total as ×1 for three heroes). The harness showed that starved party-wide sustain: the Skilled bot beat the Hollow Cantor 60% of the time (Requiem hits every hero), against a floor of 90%. At ×0.75 the Phase 1 difficulty bands hold again (see [Harness](#harness)); at ×1 the game got easier than before.

## The auras show their work

- Every hero hit reports the **auras' part** of the Weaver's share apart from **Empower's** (`damageTaken.aura`). Allegro's haste is credited too: on a basic attack, the share of the hit that only exists because the hero attacks faster is the auras' (for +15% attack speed, 0.15 / 1.15 of each hit).
- The ledger keeps what the **auras** and the **Thread** healed, shielded and added (`ledger.auras`, `ledger.thread`). Ostinato's barrier and the chorus pulse are tagged as aura shields; Fermata's damage reduction counts as the auras' shielding.
- Results and the HUD use these to say it plainly (see [Presentation](#presentation)).

## Weaver XP and Rank (the progression slice)

Every fight earns Weaver XP: 20 for a skirmish, 35 for an elite, 50 for the Bellwarden, 80 for the Cantor, × the grade (S ×1.5, A ×1.3, B ×1.15), 40% of it for a loss, and 100 more for finishing a run. XP is saved as each fight ends, so quitting never loses it.

| Rank | XP | Unlocks | Preset |
|---|---|---|---|
| 1 | 0 | The beam song; Sostenuto, Fortissimo, Allegro | **Steady**: Sostenuto + Fortissimo on the beam |
| 2 | 40 | The field song; Ostinato | **Guardian**: Fortissimo on the beam, Sostenuto in the field |
| 3 | 200 | An ornament slot per song; Grace Note, Reverb | **Bastion**: Sostenuto + Fortissimo (Grace Note) on the beam, Ostinato in the field |
| 4 | 450 | Lullaby, Pedal Point | **Anchor**: Fortissimo (Grace Note) on the beam, a planted Lullaby + Sostenuto field |
| 5 | 800 | Fermata, Unison | **All In**: Fortissimo + Allegro (Unison) on the beam, a light Fermata field |
| 6 | 1,250 | A second ornament slot | **Wide Choir**: Sostenuto on the beam, Ostinato + Fermata (Grace Note, Reverb) in the field |

A first run that dies in its third fight still reaches Rank 2. **Settings → Skip the unlocks** opens everything at once. Training Grounds always has everything.

<!-- presentation: filled in as the workstreams land -->

## Harness

20 seeds per row, the default loadout (Steady: Sostenuto + Fortissimo on the beam), `npm run harness -- --seeds 20 --auras sostenuto,fortissimo`. Every fight is inside the Phase 1 [difficulty contract](phase-1.md#difficulty-contract).

| Encounter | Bot | Win | Avg time | Wave at loss | Boss HP at loss | Weaver share | Perfects | Saves | Downs |
|---|---|---|---|---|---|---|---|---|---|
| first_light | idle | 20% | 46 s | 3.0 | - | 19% | 0.0 | 0.0 | 2.8 |
| first_light | novice | 100% | 36 s | - | - | 42% | 0.2 | 0.2 | 0.3 |
| first_light | skilled | 100% | 30 s | - | - | 47% | 1.2 | 0.1 | 0.1 |
| tolling_halls | idle | 0% | 38 s | 2.4 | - | 20% | 0.0 | 0.0 | 3.0 |
| tolling_halls | novice | 85% | 39 s | 2.0 | - | 40% | 0.1 | 0.4 | 1.4 |
| tolling_halls | skilled | 100% | 37 s | - | - | 45% | 1.6 | 0.0 | 0.0 |
| glass_gallery | idle | 5% | 34 s | 2.3 | - | 19% | 0.0 | 0.0 | 3.0 |
| glass_gallery | novice | 90% | 39 s | 2.0 | - | 38% | 0.1 | 0.4 | 1.1 |
| glass_gallery | skilled | 85% | 36 s | 2.3 | - | 46% | 0.9 | 0.4 | 1.1 |
| choir_loft | idle | 0% | 32 s | 2.2 | - | 20% | 0.0 | 0.0 | 3.0 |
| choir_loft | novice | 100% | 40 s | - | - | 42% | 0.1 | 0.5 | 0.8 |
| choir_loft | skilled | 100% | 28 s | - | - | 47% | 0.4 | 0.0 | 0.0 |
| mourning_steps | idle | 10% | 44 s | 2.8 | - | 23% | 0.0 | 0.0 | 2.9 |
| mourning_steps | novice | 100% | 40 s | - | - | 45% | 0.3 | 0.2 | 0.3 |
| mourning_steps | skilled | 100% | 35 s | - | - | 49% | 1.4 | 0.0 | 0.0 |
| muted_nave | idle | 0% | 37 s | 2.3 | - | 17% | 0.0 | 0.0 | 3.0 |
| muted_nave | novice | 60% | 52 s | 2.9 | - | 40% | 0.3 | 0.3 | 2.5 |
| muted_nave | skilled | 100% | 47 s | - | - | 52% | 2.1 | 0.0 | 0.1 |
| shattered_choir | idle | 0% | 26 s | 2.0 | - | 21% | 0.0 | 0.0 | 3.0 |
| shattered_choir | novice | 80% | 53 s | 2.3 | - | 41% | 0.4 | 0.6 | 1.8 |
| shattered_choir | skilled | 100% | 47 s | - | - | 48% | 1.9 | 0.3 | 0.2 |
| bellwarden | idle | 0% | 41 s | 1.0 | 63% | 23% | 0.0 | 0.0 | 3.0 |
| bellwarden | novice | 65% | 85 s | 1.0 | 10% | 41% | 0.5 | 0.5 | 2.0 |
| bellwarden | skilled | 100% | 56 s | - | - | 49% | 4.4 | 0.1 | 0.0 |
| hollow_cantor | idle | 0% | 40 s | 1.0 | 88% | 19% | 0.0 | 0.0 | 3.0 |
| hollow_cantor | novice | 60% | 170 s | 1.0 | 20% | 39% | 0.8 | 2.6 | 5.0 |
| hollow_cantor | skilled | 95% | 146 s | 1.0 | 26% | 40% | 2.0 | 2.8 | 1.6 |

**Whole Prelude runs** (`npm run harness -- --run --seeds 30 --auras sostenuto,fortissimo`):

| Bot | Win | Combat time | Where runs ended |
|---|---|---|---|
| idle | 0% | 0.8 min | first_light:26, tolling_halls:2, choir_loft:1, shattered_choir:1 |
| novice | 50% | 5.1 min | hollow_cantor:6, bellwarden:3, glass_gallery:3, shattered_choir:2, tolling_halls:1 |
| skilled | 87% | 4.9 min | hollow_cantor:3, shattered_choir:1 |

Compared with Phase 2:
- **Doing nothing is punished harder.** The Idle bot gets only the echo, so it falls further and earlier (First Light 40% → 20%, every skirmish ≤ 10%). That is the point: being active is what the beam rewards.
- **The Weaver matters more.** The Skilled bot's share rises from 39–47% to 40–52%, partly because Empower's haste is now credited too.
- **The Novice wins half its runs** (Phase 2: 40%), five points above the 25–45% band: within the noise of 30 runs, and the Novice bot answers more calls than a real newcomer would. Worth watching as Phase 3 adds content.

## Loadouts

The six presets, 20 seeds per fight and 10 whole runs each: `npm run loadouts -- --seeds 20 --bots skilled,novice --runs 10 --md docs/phase-3/loadouts.md` ([report](phase-3/loadouts.md)). * elite, ** boss.

**Skilled**

| Loadout | First | Tolling | Glass | Loft | Steps | Nave* | Shatter* | Bell** | Cantor** | Share | Calls answered | Runs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Steady | 100% | 100% | 85% | 100% | 100% | 100% | 100% | 100% | 95% | 47% | 72% | 90% |
| Guardian | 100% | 100% | 80% | 100% | 100% | 100% | 90% | 100% | 95% | 47% | 67% | 90% |
| Bastion | 100% | 100% | 95% | 100% | 100% | 100% | 95% | 100% | 100% | 48% | 70% | 100% |
| Anchor | 100% | 100% | 80% | 100% | 100% | 100% | 100% | 100% | 100% | 46% | 72% | 100% |
| All In | 100% | 100% | 100% | 100% | 100% | 95% | 95% | 95% | 100% | 47% | 67% | 100% |
| Wide Choir | 100% | 100% | 80% | 100% | 100% | 95% | 95% | 90% | 100% | 31% | 68% | 80% |

**Novice**

| Loadout | First | Tolling | Glass | Loft | Steps | Nave* | Shatter* | Bell** | Cantor** | Share | Calls answered | Runs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Steady | 100% | 85% | 90% | 100% | 100% | 60% | 80% | 65% | 60% | 41% | 77% | 50% |
| Guardian | 100% | 80% | 90% | 95% | 100% | 60% | 85% | 85% | 40% | 40% | 70% | 50% |
| Bastion | 100% | 95% | 95% | 100% | 100% | 70% | 75% | 100% | 85% | 43% | 78% | 60% |
| Anchor | 100% | 65% | 95% | 100% | 95% | 70% | 80% | 65% | 55% | 39% | 70% | 30% |
| All In | 100% | 75% | 70% | 80% | 100% | 75% | 90% | 40% | 65% | 36% | 62% | 0% |
| Wide Choir | 100% | 100% | 65% | 100% | 100% | 80% | 100% | 85% | 100% | 32% | 80% | 70% |

- **Every preset clears every Skilled floor**, and the difficulty labels match the Novice bot: Anchor is medium (30% of runs), All In is hard (none), the rest are easy.
- Three presets needed changes once the songs existed:
  - **Unison went back to ×2.5.** At ×3, All In's faster kills set off the Shattered Choir's death explosions together: the Skilled bot won 12 of 20 fights there instead of 19.
  - **Anchor** got Sostenuto in its planted field: with only Allegro on the beam it had no sustain and beat the Cantor 30% of the time.
  - **Bastion** became Steady's beam lightened with Grace Note plus Ostinato in the field: the first version reserved so much Spirit that the Shattered Choir won 13% of the time over 60 seeds.
- Wide Choir's share is lower (31%) because it carries no damage aura: its help is barriers, regeneration and the Fermata.

## What's next in Phase 3

The rest of the roadmap's Phase 3, now that the build layer reads clearly:

- **Relics** (15) from elites, bosses and events, including cursed ones with a real downside.
- **The run economy**: Aether earned by fights (more for better grades), spent at **Merchants** and **Forges** (upgrade a motif, swap an ornament, reroll a relic).
- **Events** (6): story choices with trade-offs.
- **More motifs** (27 → 40) and the first **Harmonies** (combo upgrades offered only when both halves are owned).
- **The first Calling, Luminary**: the field specialist, a natural partner for the field song.
- Technique variants, reward previews on the map, a fourth elite affix, smarter wave pacing and an onboarding pass, so five runs in a row feel different and a newcomer finishes the Prelude unaided.

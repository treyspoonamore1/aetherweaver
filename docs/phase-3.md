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

<!-- presentation, harness, loadouts, remaining scope and known gaps: filled in as the workstreams land -->

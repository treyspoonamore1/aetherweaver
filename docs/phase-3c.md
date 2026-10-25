# Phase 3c — The Luminary

*2026-10-25 · plan: [docs/plan/03-content-bible.md §2](plan/03-content-bible.md#2-callings-choose-one-per-run) · follows [Phase 3b](phase-3b.md)*

The first **Calling**: the Weaver's class for a run. The user chose how it comes into the game:

| Question | Choice |
|---|---|
| When does it come into a run? | **Chosen in Prep, unlocked at Rank 7.** Runs without a Calling play exactly as before. |
| How is its path picked? | **During the run, at milestones**, like relic offers. |
| The plan's "Radiant Field" burned enemies. Keep it? | **No: heroes in your field shine.** Their hits deal extra radiant damage, credited to you. The Weaver enables; the heroes strike. |

## The Luminary: the aura sovereign

> *Stand where the light is. Bring them into it.*

**Passive: Radiance.** Heroes standing in your field shine: each of their hits deals **+4% damage for every aura they hear**, credited to you. Your **field song reaches 15% farther**.

- "In your field" means inside the radius of either song's field (the beam's echo or the field song), as the HUD's ♪ chips already show. A threaded hero far from you hears the beam but doesn't shine.
- A hero hearing Sostenuto and Fortissimo on the beam and Ostinato in the field shines at +12%.

**Crescendo: Sunrise, the Luminary's.** Sunrise as everyone knows it (auras ×2, reach ×1.5, a heal), and Radiance burns **three times** as bright while it lasts.

### The path

Four tiers, two options each. You pick one per tier **during the run**, after the first fight you win on rows 0, 3, 5 and 7 of the map: First Light, the row-3 fight, the row-5 fight and the Bellwarden. Rows 3 and 5 are fights on every path, so every run gets all four picks, and the capstone arrives just before the Hollow Cantor. The pick comes before the relic offer and the draft.

| Tier | Option A | Option B |
|---|---|---|
| I | **Haloed**: heroes in your field take 8% less damage. | **Wide Choir**: your field song reaches 20% farther. |
| II | **Dawnward**: a hero who steps into your field gains a barrier worth 3% of their life for each aura they hear (once every 8 s each). | **Searing Hymns**: Radiance burns twice as bright. |
| III | **Third Voice**: your field song holds a third aura. Choosing it opens the song builder, free. | **Lantern Bearer**: a planted field (Pedal Point) sings 30% stronger. |
| IV | **Sovereign Symphony**: with 4 or more auras across your songs, every aura is 25% stronger. | **Eclipse**: during Sunrise, enemies in your field take 15% more damage, and Sunrise reaches twice as far instead of half again. |

The axes: **protect** (Haloed, Dawnward), **reach and number** (Wide Choir, Third Voice, Sovereign Symphony) and **radiance** (Searing Hymns, Lantern Bearer, Eclipse). Third Voice needs Spirit for the third aura: Grace Note helps.

**What it doesn't change.** The auras themselves are untouched. Every tier adds to a song's reach, strength or slots; nothing about how Sostenuto, Fortissimo and the rest work changes.

## Contracts (v6)

**Content**: `callings` (zod-validated). A Calling has an `id`, `name`, `title`, passive `text`, a `crescendo` line, `values`, `unlockRank`, an `icon` and four `tiers`, each with two `options` (`id`, `name`, `text`, `values`, `icon`). Text placeholders are filled from `values` as for relics. Helpers: `callingDef`, `callingOption`, `callingText`, `optionText`.

**Sim** (`SIM_VERSION` 6, replay format 5):

- `SimConfig.calling?: { id, path? }`: the Calling and the option ids chosen so far (at most one per tier, validated). Dropped when the Weaver is absent.
- `HeroHit.radiance` and `DamageOpts.radiance`: Radiance's part of a hit, inside `amplified`, next to the auras' and Empower's parts. `damageTaken.radiance` carries it to the view.
- Ledger `calling { amplified, shielded }`: Radiance and Eclipse's damage; Haloed's damage taken off. `EncounterStats.callingAmplified` and `callingShielded`.
- `chordProblems(chords, content, { fieldAuraSlots })`: Third Voice's third field aura is legal only with it.
- Mods: `radiancePerAura`, `sunriseRadianceMult`, `fieldSongRadiusMult`, `haloedReduction`, `dawnwardPct`, `dawnwardCooldown`, `plantedEffectMult`, `sovereignMult`, `sovereignMinAuras`, `eclipseVulnerability`, `crescendoRadiusMult`.
- Event `dawnward { hero, amount }` when a hero steps into the light.
- `EnemyComponent.inField` now means inside one of the Weaver's fields, whatever the songs hold for enemies (before, only a field that hexes them, such as Lullaby). Eclipse reads it. No behaviour changes without Eclipse; the goldens' hashes moved.
- `WorldState.calling: { id, path, radiancePerAura, sunriseMult, sovereign } | null`: the Calling for the view, fixed for the fight and derived from the config (not hashed). A hero shines at `radiancePerAura × auras heard` (× `sunriseMult` in Sunrise) while `inField`.

**Run** (`meta/types.ts` v6, save v5):

- `RunState.calling: { id, path: (string | null)[] } | null`, chosen in Prep (`setCalling`), and `callingOffer: { tier, options } | null` with the phase `'calling'`.
- After a won fight on a milestone row: result → **calling** → relic → draft → map. `pickCalling(index, chords?)`: `chords` applies a free retune when the option grants a slot (Third Voice).
- Prep, Retune, the forge and the Tuning Pool accept a third field aura when the run's path has Third Voice (`Run.fieldAuraSlots(run)`).
- Profile: Rank 7 at 1,800 XP unlocks `calling.luminary` (`UnlockKind` `'calling'`); "Skip the unlocks" opens it. `Allowance.callings`.

## Presentation

*To be filled in by the UI, VFX and audio workstreams.*

## Harness

*To be filled in after tuning.*

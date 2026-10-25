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
| I | **Haloed**: heroes in your field take 8% less damage from ordinary hits; telegraphed attacks still need your Ward. | **Wide Choir**: your field song reaches 20% farther. |
| II | **Dawnward**: a hero who steps into your field gains a barrier worth 3% of their life for each aura they hear (once every 8 s each). | **Searing Hymns**: Radiance burns twice as bright. |
| III | **Third Voice**: your field song holds a third aura. Choosing it opens the song builder, free. | **Lantern Bearer**: a planted field (Pedal Point) sings 30% stronger. |
| IV | **Sovereign Symphony**: with 4 or more auras across your songs, every aura is 25% stronger. | **Eclipse**: during Sunrise, enemies in your field take 15% more damage from your heroes, and Sunrise reaches twice as far instead of half again. |

The axes: **protect** (Haloed, Dawnward), **reach and number** (Wide Choir, Third Voice, Sovereign Symphony) and **radiance** (Searing Hymns, Lantern Bearer, Eclipse). Third Voice needs Spirit for the third aura: Grace Note helps.

**What it doesn't change.** The auras themselves are untouched. Every tier adds to a song's reach, strength or slots; nothing about how Sostenuto, Fortissimo and the rest work changes.

## Contracts (v6)

**Content**: `callings` (zod-validated). A Calling has an `id`, `name`, `title`, a one-sentence `summary` (the rank-up card), passive `text`, a `crescendo` line, `values`, `unlockRank`, an `icon` and four `tiers`, each with two `options` (`id`, `name`, `text`, `values`, `icon`). Text placeholders are filled from `values` as for relics. Helpers: `callingDef`, `callingOption`, `callingText`, `optionText`.

**Sim** (`SIM_VERSION` 6, replay format 5):

- `SimConfig.calling?: { id, path? }`: the Calling and the option ids chosen so far (at most one per tier, validated). Dropped when the Weaver is absent.
- `damageTaken.radiance` and `damageTaken.eclipse`: Radiance's and Eclipse's parts of a hero's hit on an enemy, both inside `amplified` next to the auras' and Empower's parts (computed in `dealDamage`). `radiance` is non-zero only when the attacker shone.
- Ledger `calling { amplified, shielded }`: Radiance and Eclipse's damage; Haloed's damage taken off. `EncounterStats.callingAmplified` and `callingShielded`.
- `chordProblems(chords, content, { fieldAuraSlots })`: Third Voice's third field aura is legal only with it.
- Mods: `radiancePerAura`, `sunriseRadianceMult`, `fieldSongRadiusMult`, `haloedReduction`, `dawnwardPct`, `dawnwardCooldown`, `plantedEffectMult`, `sovereignMult`, `sovereignMinAuras`, `eclipseVulnerability`, `crescendoRadiusMult`.
- Event `dawnward { hero, amount }` when a hero steps into the light.
- `EnemyComponent.inField` now means inside one of the Weaver's fields, whatever the songs hold for enemies (before, only a field that hexes them, such as Lullaby). Eclipse reads it. No behaviour changes without Eclipse; the goldens' hashes moved.
- `WorldState.calling: { id, path, radiancePerAura, sunriseMult, sovereign } | null`: the Calling for the view, fixed for the fight and derived from the config (not hashed). A hero shines at `radiancePerAura × auras heard` (× `sunriseMult` in Sunrise) while `inField`.

**Run** (`meta/types.ts` v6, save v5):

- `RunState.calling: { id, path: (string | null)[] } | null`, chosen in Prep (`setCalling`), and `callingOffer: { tier, options } | null` with the phase `'calling'`.
- After a won fight on a milestone row: result → **calling** → relic → draft → map. `callingTierDue(run, node)` says which fights bring a tier (the map marks them). `pickCalling(index, chords?)`: `chords` applies a free retune only when the option grants a slot (Third Voice); for any other option they're ignored.
- `embark(run, allowance)`: Chords or a Calling picked while "Skip the unlocks" was on don't outlive turning it off. `chordsToRemember(chords)`: the next run's Prep starts from this run's songs without Third Voice's third aura.
- Prep, Retune, the forge and the Tuning Pool accept a third field aura when the run's path has Third Voice (`Run.fieldAuraSlots(run)`).
- Profile: Rank 7 at 1,800 XP unlocks `calling.luminary` (`UnlockKind` `'calling'`); "Skip the unlocks" opens it. `Allowance.callings`.

## Presentation

Details and screenshots: [UI](phase-3c/ui.md), [VFX](phase-3c/vfx.md), [audio](phase-3c/audio.md).

| | |
|---|---|
| **Prep** | A "Your Calling" section: No Calling, or the Luminary with its passive, its Sunrise and when its four picks come ("after First Light, your fights at steps 4 and 6, and the Bellwarden"); "See the path" shows every tier. Below Rank 7 it shows the Rank and what it is; "Skip the unlocks" opens it. |
| **The tier screen** | After a milestone fight: the emblem, a path track (taken options lit, later tiers with when they come) and two option cards tagged by axis (Protect, Reach and number, Radiance); keys 1–2. Third Voice opens the song builder for its free retune, the third field slot marked as its own. |
| **Song builder** | Knows the run's field slots: with Third Voice, a third field aura wherever you retune (a Respite, a forge, the Tuning Pool). |
| **Map** | The strip carries the Calling's emblem and path, each choice's text in its tooltip; fights that will grow the Calling are marked and say so. |
| **HUD** | A Calling chip under the relic bar (the path, Sunrise, Haloed, Sovereign Symphony); a shining hero's frame shows a small sun with their Radiance ("+16%"), brighter in Sunrise. |
| **Result, Summary, Codex, Rank 7** | "Radiance: +986 damage through your heroes · Haloed: 182 damage kept off"; Continue says when the Calling grows; the summary lists the path; the Codex has a Callings tab; the Rank 7 card shows the Luminary. |
| **In the fight** | Heroes in the light glow (sunlight on head and shoulders, a pool of light, rising motes), kindling as they step in and fading as they leave. Radiant hits warm their numbers; big ones (Searing Hymns, Sunrise) add a ☀ chip and a spark. Dawnward raises a rose-gold sun behind the hero. The Luminary's Sunrise lifts a sun over the Weaver and gilds the field; Eclipse turns it into a ring of fire, darkens the field's rim and marks the enemies it exposes. Haloed is a faint halo over each hero in the field, Lantern Bearer turns Pedal Point's stake into a lantern, Sovereign Symphony crowns the field. A third field aura gets a third band on the floor, in the existing style (no aura's look changed). No new draw calls. |
| **Sound** | Finished voices for choosing the Luminary, the tier screen and a pick; a faint, rate-limited glass shimmer on a shining hero's hits; a dawn chime for Dawnward; a high choir and bells over the Luminary's Sunrise, with a beating low shadow under it when Eclipse is on the path. |

## Harness

`npx tsx tools/callings.ts --loadout guardian --seeds 50`: whole Prelude runs, every one of the 16 paths on its own 50 seeds (800 runs a bot), against the same seeds with no Calling. Each tier's two options are compared over the half of the runs that took each one.

| Loadout · bot | No Calling | Luminary, all paths | I: Haloed · Wide Choir | II: Dawnward · Searing | III: Third Voice · Lantern | IV: Sovereign · Eclipse |
|---|---|---|---|---|---|---|
| Guardian · Novice | 32% | **42%** | 43 · 41 | 45 · 40 | 42 · 43 | 43 · 42 |
| Steady · Novice | 38% | **49%** | 51 · 47 | 50 · 48 | 47 · 51 | 48 · 50 |
| Guardian · Skilled (400 runs) | 86% | **89%** | | | | |
| Steady · Skilled (400 runs) | 88% | **90%** | | | | |

The Luminary is worth about ten points to the Novice and two or three to the Skilled bot: a real reward for reaching the top Rank, and skill stays the bigger axis. No option is a trap; within each tier the two options sit within five points for both loadouts. A Luminary Novice ends a little above the [difficulty contract](phase-1.md#difficulty-contract)'s 25–45% band with Steady, inside it with Guardian.

**How it got there.** As first written, the Luminary added 15 points (Guardian) and 16 (Steady), and tier I wasn't a choice: Haloed paths won 22 points more than no Calling, Wide Choir paths 9. Haloed took 8% off *everything*, the telegraphed attacks included: the very hits the Weaver's Ward exists for, and where nearly all of its value was. At 4% on everything it was still worth six points over Wide Choir; at 8% on ordinary hits only, two. So Haloed now softens ordinary hits only, like hero armour, and the big hits stay the Weaver's job. Radiance at 3% per aura instead of 4% changed nothing measurable (within ±2 points), so it stays at 4%: it's the Calling's identity, and the bots undersell it (below).

**Why a few points per fight become ten per run.** Fight by fight (the six hard fights at Threat 1, fresh party, 30 seeds), the passive alone was worth about four points to the Novice and Haloed (on everything) six more. In a run, life carries over and Threat climbs, so a small edge in each of ten fights compounds.

**What the bots can't show.**

- **Sunrise.** The Novice bot never casts a Crescendo (it spends Resonance on Cues) and the Skilled bot rarely (Sunrise was up 1.5% of the Cantor fight). Radiance ×3 in Sunrise and all of Eclipse barely appear in the table; a player who banks Resonance gets more from the Luminary than it says.
- **Tier IV** lives only for the Hollow Cantor, and neither capstone fires for these loadouts (Sovereign Symphony needs four auras). Its columns are equal by construction.
- **Tier III.** The bots never retune between fights, so they fill Third Voice's slot only when the field song already has two auras and a third fits under 75% of Spirit (with Grace Note if that's what makes it fit): never with these presets. Lantern Bearer needs Pedal Point. Tier III's equal numbers say neither is a trap, not that both are equal.
- **Reach.** The bots' heroes keep formation inside the field, so the passive's reach and Wide Choir are worth almost nothing to them. Heroes that scatter for a link or chase a caster will feel it.

**Measurement notes.** The first sweeps (80 seeds a path, one path at a time) were misleading twice over. 80 seeds is ±5–7 points of noise per comparison, smaller than most of the effects. And the harness's first Third Voice policy filled any free slot with the first aura that was legal, reserving 85% of the Weaver's Spirit and starving her techniques: Guardian's path 0000 *lost* six points for the Skilled bot until the policy was fixed. Tuning also turned up a real defect: Eclipse's vulnerability only reached enemies standing in a field that hexes them (Lullaby), so for most loadouts the capstone did nothing. `EnemyComponent.inField` now means inside any of the Weaver's fields.

## Code review

An independent review of the sim, run layer, content, harness and audio (read-only, against a clean copy of the commits) found these, all fixed with regression tests that fail on the old code:

- **Every Calling pick was a free Retune.** `pickCalling` applied the passed Chords for any option, not just Third Voice. Now only an option that grants a slot takes them.
- **Lantern Bearer strengthened a planted beam song's pour.** With Pedal Point on the beam song, the threaded hero heard it ×1.3 anywhere on the map. Now the bonus goes to the planted echo only.
- **`damageTaken.radiance` included Eclipse's share,** so a hero outside the light read as shining (and shimmered). Now `radiance` is Radiance's part and a new `eclipse` field carries Eclipse's.
- **A Luminary chosen under "Skip the unlocks" outlived turning it off.** `embark` now drops a locked Calling, as it already reset locked Chords.
- **Haloed and Fermata's guard were each credited with the same kept life,** so the Weaver's shielded total could exceed what the hero kept. They now share it.
- **Remembering Third Voice Chords lost the remembered loadout** (the next Prep, with two field slots, rejected it). The third aura is now dropped before remembering.
- **Eclipse's text promised more than the code**: the bonus is to the heroes' hits, and now says so.
- **Two doc fields that never existed** (`HeroHit.radiance`, `DamageOpts.radiance`); **the field song's tick-0 radius** ignored the Luminary's reach until the first step.
- **Weak tests**: Sovereign Symphony's three-aura boundary used two auras; Dawnward's test never checked the refire, the amount or a bigger barrier; the v4 migration fixture still carried the new stats; an audio assertion was looser than its title. All tightened.

After the fixes: 601 unit tests, typecheck and lint clean, and 7/7 end-to-end tests in Chromium against the production build, including the Luminary's own (skip the unlocks, choose it in Prep, win First Light, take tier I).

## Known gaps

- **The song builder's field radius ignores the Calling.** It says "within 8 m"; the Luminary's field song reaches 15% farther (38% with Wide Choir). The tier screen likewise shows the base 4% Radiance after Searing Hymns doubles it. The HUD's per-hero shine is exact.
- **One Calling.** The Martyr, the Chronomancer and the Conductor (docs/plan/03 §2) are still to come, and Calling mastery (path tiers earned by playing a Calling) isn't in: every tier is open from the start.
- **The bots don't Sunrise** (above), so the Luminary's Crescendo and Eclipse are tuned by reasoning, not measurement.
- **"Keep my songs" after Third Voice** leaves the third slot empty until a Respite, a forge or the Tuning Pool.

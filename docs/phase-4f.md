# Phase 4f — Technique variants

*2026-10-30 · plan: [docs/plan/03-content-bible.md §1](plan/03-content-bible.md#1-the-weavers-techniques), [02 §9](plan/02-game-design.md#9-meta-progression-the-loom) · follows [Phase 4e](phase-4e.md)*

The first of the Loom's last pieces (the user chose to finish Phase 4: technique variants, Starlight and cosmetics, Calling mastery, the Loom hub and the Perfect-Ward trainer, then Phase 4's exit checks). Each of the Weaver's four techniques gets two **variants**: the same key and slot, a different way to save someone. You choose one per slot in Prep, from the variants you own, and the run keeps them.

| Question | Choice |
|---|---|
| What do variants cost? | **Starlight** (Phase 4g): the shop opens at Weaver Rank 5 with most variants on sale; a Calling's top mastery opens its own. Until 4g, *Skip the unlocks* opens them all, and the Training Grounds always has them. |
| Which plan variants? | All eight from the plan (03 §1), adapted where this game differs (it has no damage over time and nothing that pushes heroes around). |

## The variants

| Slot | Default | Variant | What it does |
|---|---|---|---|
| **Ward** (Q) | Ward | **Chorale** | A burst around the hero you Ward: every hero within 6 m gets a barrier of 18% of their life + 80, for 3 s. Each is **Perfect** as a Ward is. 25 Spirit. |
| | | **Aegis Link** | Links the hero you Ward with the hero you Thread (or, if that's the same hero, the one nearest them) for 5 s: what hits either is 40% lighter, and split evenly between them. **Perfect** when a hit lands on either within the window: it's negated, and you join the link, three ways, for the rest of it. |
| **Chime** (E) | Chime | **Purge** | What the Chime cleanses bursts out at every enemy within 4 m of the hero: a Dirge as its full damage, a silence, stun or sleep for half the time it had left. |
| | | **Absolve** | The Chime also heals 25% (not 8%) and leaves 2 s of 25% less damage taken. 14 s cooldown. |
| **Reel** (F) | Reel | **Swap** | Trade places with the hero you Thread, at once. You take what was coming for them. |
| | | **Anchor** | The hero you Thread takes 55% less damage for 3 s, and nothing moves them. |
| **Glide** (Space) | Glide | **Phase Step** | Blink 8 m at once. Enemies hunting you lose you for 2 s and turn on the nearest hero; a decoy of you lingers where you were. |
| | | **Skate** | Two charges of a 4 m dash, each back 4 s after it's spent. |

Costs and cooldowns are the default's unless the table says otherwise (Ward 20 Spirit and 7 s, Chime 15 and 9 s, Reel 25 and 14 s, Glide free and 5 s). The numbers are tuned against the harness (see *Harness*).

- **The axes.** Chorale and Swap protect several heroes or put you in harm's way; Aegis Link and Anchor make one hero sturdier; Purge and Phase Step turn defence into offence; Absolve and Skate make the default safer.
- **The Chronomancer's Rewind takes Reel's slot**, so on his runs the Reel variant has no effect; Prep says so.
- **Modifiers.** A variant keeps its slot's modifiers (Economy, Tempo, Quickened, Stasis's cost and cooldowns, Temporal Mastery) and, where it makes a barrier, the Ward's (Shieldwright, Lingering Aegis, Shatterproof Halo, Martyr's Aegis, Echo Ward on a Perfect). Aegis Link makes no barrier, so the barrier modifiers don't touch it.
- **Saves and Resonance** follow the default's rules: a Perfect Chorale or Aegis Link gives Perfect Ward's Resonance and stagger; Swap dodges and saves like Reel; Purge's cleanses count as Chime's (Clutch included).
- **What counts as your support** (Bonds, the Summary) follows too: Chorale's barriers, the share of a hit Aegis Link moved off a hero, Absolve's healing and the damage it prevented, Anchor's prevented damage.

## How you get them

- **Owning.** The profile keeps the variants you own. Phase 4g sells them for Starlight (five at Rank 5, one per Calling at its top mastery); until then *Skip the unlocks* opens all eight.
- **Choosing.** Prep shows each slot's default and the variants you own; choose one per slot. The run snapshots the choice at embark, as it does the Astrolabe and the Bonds. The Training Grounds use your current choice, with every variant open.

## Contracts (v14)

**Content** (`CONTENT_VERSION` bump), in `src/content/variants.ts`:
- `techniqueVariants: { id, slot: 'ward' | 'chime' | 'reel' | 'glide', name, text, values, cost?, cooldown? }[]`, two per slot. The text is built from `values`.
- Checks: two per slot, unique ids, texts fill from values, every variant has its hook in the sim (`KNOWN_VARIANTS`).

**Sim** (`SIM_VERSION` 20):
- `SimConfig.techniques?: Partial<Record<'ward' | 'chime' | 'reel' | 'glide', string>>`: the variant per slot (absent: the default). Unknown ids, or a variant in the wrong slot, are refused.
- `WeaverComponent.variants` (resolved, for the views), Skate's `glideCharges` and `maxGlideCharges`.
- `world.internal.link`: the Aegis Link in force (`a`, `b`, `weaver`, `appliedAt`, `until`).
- Statuses: `absolved` (Absolve's guard) and `anchored` (Anchor's).
- Events: `techniqueCast` gains `variant`; new `chorale { targets }`, `linked { a, b, weaver, until }`, `purged { hero, x, z, hit[] }`, `swapped { hero, fromX, fromZ, toX, toZ }`, `phaseStep { fromX, fromZ, toX, toZ, until }`.
- Bots use the same commands as for the defaults.

**Meta:**
- Profile v7: `variants: string[]` (owned).
- `RunState.techniques` (the choice, followed in Prep, frozen at embark).
- `fitVariants(choice, owned, all)`; `variantsConfig(run)`.
- Saves fit unknown ids away.

**Stores:**
- The profile store: `ownVariant(id)` (Phase 4g's shop calls it) and `variantsAll()` (Skip the unlocks).
- The run store: `setTechniques(slot, id | null)` in Prep.

## Presentation

*To be filled in by the UI, VFX and audio workstreams.*

## Harness

*To be filled in.*

## Code review

*To be filled in after the review.*

## Known gaps

*To be filled in.*

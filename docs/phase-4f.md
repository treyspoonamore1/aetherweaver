# Phase 4f — Technique variants

*2026-10-30 · plan: [docs/plan/03-content-bible.md §1](plan/03-content-bible.md#1-the-weavers-techniques), [02 §9](plan/02-game-design.md#9-meta-progression-the-loom) · follows [Phase 4e](phase-4e.md)*

The first of the Loom's last pieces (the user chose to finish Phase 4: technique variants, Starlight and cosmetics, Calling mastery, the Loom hub and the Perfect-Ward trainer, then Phase 4's exit checks). Each of the Weaver's four techniques gets two **variants**: the same key and slot, a different way to save someone. You choose one per slot in Prep, from the variants you own, and the run keeps them.

| Question | Choice |
|---|---|
| What do variants cost? | **Starlight** ([Phase 4g](phase-4g.md)): the Atelier opens at Weaver Rank 5 with five variants on sale; a Calling's top mastery opens its own. *Skip the unlocks* opens them all, and the Training Grounds always has them. |
| Which plan variants? | All eight from the plan (03 §1), adapted where this game differs (it has no damage over time and nothing that pushes heroes around). |

## The variants

| Slot | Default | Variant | What it does |
|---|---|---|---|
| **Ward** (Q) | Ward | **Chorale** | A burst around the hero you Ward: every hero within 6 m gets a barrier of 17% of their life + 70, for 3 s. The one you Ward is **Perfect** as a Ward is; the others only absorb. 25 Spirit. |
| | | **Aegis Link** | Links the hero you Ward with the hero you Thread (or, if that's the same hero, the one nearest them) for 5 s: what hits either is 33% lighter, and split evenly between them. **Perfect** when the first hit lands on either within the window: it's negated, and you join the link, three ways, for the rest of it. With no other hero standing, it takes the hero alone, and what hits them is only lighter. |
| **Chime** (E) | Chime | **Purge** | What the Chime cleanses bursts out at every enemy within 3.5 m of the hero: a Dirge as 75% of its damage, a silence, stun or sleep for 35% of the time it had left. A silenced enemy can't start its specials. |
| | | **Absolve** | The Chime also heals 25% (not 8%) and leaves 2 s of 25% less damage taken. 14 s cooldown. |
| **Reel** (F) | Reel | **Swap** | Trade places with the hero you Thread, at once. You take what was coming for them, behind a barrier of 50% of their life for 2 s. |
| | | **Anchor** | The hero you Thread takes 50% less damage for 3 s. |
| **Glide** (Space) | Glide | **Phase Step** | Blink 8 m at once. Enemies hunting you lose you for 2 s and turn on the nearest hero; a decoy of you lingers where you were. |
| | | **Skate** | Two charges of a 4 m dash. They come back one at a time, each 5 s after the last. |

Costs and cooldowns are the default's unless the table says otherwise (Ward 20 Spirit and 7 s, Chime 15 and 9 s, Reel 25 and 14 s, Glide free and 5 s). The numbers are tuned against the harness (see *Harness*).

- **The axes.** Chorale and Swap protect several heroes or put you in harm's way; Aegis Link and Anchor make one hero sturdier; Purge and Phase Step turn defence into offence; Absolve and Skate make the default safer.
- **The Chronomancer's Rewind takes Reel's slot**, so on his runs the Reel variant has no effect; Prep says so.
- **Modifiers.** A variant keeps its slot's modifiers (Economy, Tempo, Quickened, Stasis's cost and cooldowns, Temporal Mastery) and, where it makes a barrier, the Ward's (Shieldwright, Lingering Aegis, Shatterproof Halo, Martyr's Aegis, Echo Ward on a Perfect). Aegis Link makes no barrier, so the barrier modifiers don't touch it.
- **Saves and Resonance** follow the default's rules: a Perfect Chorale or Aegis Link gives Perfect Ward's Resonance, stagger and Spirit back (from what it cost); Swap dodges and saves like Reel; Purge's cleanses count as Chime's (Clutch included).
- **Stasis.** A Ward's Perfect timing waits with the enemies, and so does an Aegis Link's: one cast in Stasis that turns out Perfect gets Eternal Moment's Resonance.
- **What counts as your support** (Bonds, the Summary) follows too, credited as the other guards are, with the life it kept: Chorale's barriers, what Aegis Link lightens and what you take for a hero once you've joined it, Absolve's healing and its guard, Anchor's guard. Purge's damage is yours, as a Riposte Bloom's is.

## How you get them

- **Owning.** The profile keeps the variants you own. Phase 4g sells them for Starlight (five at Rank 5, one per Calling at its top mastery); *Skip the unlocks* opens all eight.
- **Choosing.** Prep shows each slot's default and the variants you own; choose one per slot. The run snapshots the choice at embark, as it does the Astrolabe and the Bonds. The Training Grounds use your current choice, with every variant open.

## Contracts (v14)

**Content** (`CONTENT_VERSION` bump), in `src/content/variants.ts`:
- `techniqueVariants: { id, slot: 'ward' | 'chime' | 'reel' | 'glide', name, text, values, cost?, cooldown? }[]`, two per slot. The text is built from `values`; the sim reads every number from them (a key it doesn't have throws).
- Checks: two per slot, unique ids, texts fill from values, every variant has its hook in the sim (`KNOWN_VARIANTS`).

**Sim** (`SIM_VERSION` 20):
- `SimConfig.techniques?: Partial<Record<'ward' | 'chime' | 'reel' | 'glide', string>>`: the variant per slot (absent: the default). Unknown ids, or a variant in the wrong slot, are refused.
- `WeaverComponent.variants` (resolved, for the views), Skate's `glideCharges` and `maxGlideCharges`.
- `world.internal.link`: the Aegis Link in force (`a`, `b` (`a` again when alone), `weaver`, `appliedAt`, `until`, `stasis?`). `Shield.chorale` marks a Chorale's barriers and `Shield.plain` the ones that only absorb.
- Statuses: `absolved` (Absolve's guard) and `anchored` (Anchor's). Enemies now obey `silence`: no specials while it lasts (only Purge silences them).
- Events: `techniqueCast` gains `variant`; new `chorale { targets }`, `linked { a, b, weaver, until }`, `purged { hero, x, z, hit[] }`, `swapped { hero, fromX, fromZ, toX, toZ }`, `phaseStep { fromX, fromZ, toX, toZ, until }`.
- `techniqueCost` and `canPay` read the slot's variant, as the sim's `spend` and the Perfect's refund do.
- Bots use the same commands as for the defaults. The Skilled bot Swaps only when the Weaver can take the blow behind Swap's barrier, and spends Skate's second charge.

**Meta:**
- Profile v7: `variants: string[]` (owned) and `techniques` (the choice per slot).
- `RunState.techniques` (the choice, followed in Prep, frozen at embark).
- `fitTechniques(choice, owned, all)`; `variantsConfig(run.techniques)`.
- Saves fit unknown ids away; an owned entry that doesn't parse is dropped alone.

**Stores:**
- The profile store: `ownVariant(id)` (Phase 4g's Atelier buys through it), `setTechnique(slot, id | null)`, `variantsAll()` (Skip the unlocks) and `runTechniques()`.
- The run store: `followTechniques()` keeps a run in Prep on the profile's choice until it embarks.

## Presentation

**Screens** ([docs/phase-4f/ui.md](phase-4f/ui.md), with screenshots; the UI lab's *Variants* group shows each state):
- **Prep: Your techniques.** A column per key (Q, E, F, Space), each a radio group of the default and its two variants in their own words, with a variant's cost or cooldown marked against the default's ("25 Spirit (Ward 20)"). Locked variants say how they're had; on a Chronomancer run the Reel column says the choice waits for the next run. Prep's and Retune's Spirit budgets count the variants' costs.
- **The HUD.** Each Weaver-bar slot shows its variant's glyph and name, with a tooltip of its text and cost now. Skate (and the Ward's Twin Aegis charges) show charge pips, ready while a charge is left. Absolve's and Anchor's guards have their own glyphs on the hero frames. A refused cast names the variant ("Chorale: not enough Spirit").
- **The Training Grounds** start from your choice with every variant open, and switch any slot from the tools panel.
- **The Codex** gains a Techniques page: what variants are, how they're had, and each slot's three, owned or not.

**Effects and sounds** ([docs/phase-4f/vfx-audio.md](phase-4f/vfx-audio.md), with screenshots; the VFX lab's *Phase 4f · Variants* group plays each in a real sim):
- **Every variant has its own look**, from the events and content's numbers, in the existing batches (no new draw calls):
  - **Chorale:** waves of song out to its reach, and a run of light to each barrier. The warded hero's keeps the Ward's hex shell; the absorb-only ones are plain shells with a choir band.
  - **Aegis Link:** a strand between the heroes, with a bead along it on a shared hit and the Weaver's strands joining on its Perfect.
  - **Purge:** a burst with a dart to each enemy hit. **Absolve:** a veil for as long as the guard lasts.
  - **Swap:** the two trade places along an arc, leaving her afterimage. **Anchor:** a pillar and chains for as long as the guard lasts.
  - **Phase Step:** a blink and her decoy. **Skate:** blade marks and a carve, and its charges as diamonds at her feet.
- **Every variant has its own sound**, pitched on the music's chord like her other techniques, in place of the default's. There are cues for the Link's join and shared hits, Purge's burst and Absolve's guard, each gated and capped. Choosing one in Prep plays its slot's voice.

## Harness

`tools/variants.ts` measures each variant against its slot's default, as the enemy life it's worth: negative helps. Each figure comes from 300 runs and is good to about ±3.
- **The Novice** uses the Rank-20 build at Threat ×1; its base wins 85.3%, and 61.0% with 25% more enemy life. It never Reels or Glides, so it reads only the Ward and Chime variants.
- **The Skilled bot** uses the same build at Threat ×2; its base wins 75.7%, and 51.3% with 25% more enemy life.

Variants are options, not power (02 §9), so the target is a sidegrade: within about 5 points of the default either way, give or take the noise.

| Variant | Novice | Skilled | How it got there |
|---|---|---|---|
| Chorale | +0.5 | −3.4 | Its two-hero Perfect rule almost never fired (+10, +10). With every barrier Perfect it read 0 and −9: the Skilled bot Wards inside the window, so one cast negated a blow for the whole group. Only the warded hero's is now (−7), and the barriers are a little smaller (17% + 70, from 18% + 80). |
| Aegis Link | +0.9 | −1.2 | At first it only spread hits (+27, +27). Lightening them: 40% read −9 and −13, 25% read +6 and +9, 33% is even. Its Perfect now comes once a cast. |
| Purge | −5.7 | −3.4 | Its reach, Dirge damage and control were trimmed from −10 and −8. The Novice's reading didn't move as they were: 266 wins of 300, three times over. |
| Absolve | −2.2 | 0.0 | As first built. |
| Swap | — | +2.5 | It read +10 to +12, whatever its barrier: the Weaver's 360 life can't take a blow that's worth Reeling, so the bot hardly ever swapped (3 a run, against 25 Anchors). Its barrier is now half the hero's life. |
| Anchor | — | −2.5 | +6 at 40% for 2.5 s, −6 at 55% for 3 s; 50% for 3 s. |
| Phase Step | — | −2.1 | As first built. |
| Skate | — | −5.3 | −0.4 while the bot never spent its second charge, −7 once it did; its charges come back every 5 s, not 4. |

**Together.** The four that suit the Skilled bot best (Chorale, Purge, Anchor, Skate) are worth −13.8 to it played together, about the sum of their parts. The Novice's Chorale and Purge together read −1.6.

## Code review

A review of the core commit ran it as well as reading it: defaults unchanged across the golden scenarios and 14 whole runs, variants deterministic and replayable, saves and stores sound. What it found, all fixed with tests unless noted:

| Found | Fixed |
|---|---|
| **One Aegis Link cast could be Perfect again and again**: nothing spent it, and every Perfect paid in full (Resonance, Spirit, stagger, relics, Deeds). 41 of 342 casts gave two in bot runs. | Its Perfect is the first hit's. |
| A Link cast in Stasis couldn't be Perfect (its moment didn't wait with the enemies), and Eternal Moment never applied to it. | Both. |
| Shares sent to an untouchable link member vanished: free damage reduction during a Glide or a Reel. | Only members who can be hurt take a share. |
| Purge's silence did nothing to enemies: they never checked it. | A silenced enemy can't start its specials. |
| Absolve and Anchor were credited before armour, even when the hit downed the hero, and never reached the Summary; the Link credited only your share. | Credited as the other guards are, with the life they kept, in the ledger too. |
| Chorale paid a full Perfect per hero: three heroes, three Perfects, 30 Spirit back on a 20 cost. | Only the warded hero's barrier is Perfect (see *Harness*). |
| Aegis Link was refused with one hero standing, leaving the Ward slot dead exactly then. | It takes that hero alone. |
| `techniqueCost`, `canPay`, the Heroes' calls and the Perfect's refund used the default's cost; Chorale's is 25. | They read the slot's variant. |
| One malformed owned variant dropped them all from a save. | It's dropped alone. |
| The Skilled bot (and the HUD) read Glide's cooldown, so Skate's second charge went unused. | The bot spends charges; the HUD is the screens' (see *Presentation*). |
| Anchor's "nothing moves them" wasn't implemented, Skate's text hard-coded its charges, and `variantValue` returned 0 for a missing key. | The text is dropped, the charges come from values, a missing key throws. |
| Purge's damage wasn't in the ledger. | It's yours, as a Riposte Bloom's is. |
| The doc named functions and stores the code doesn't have. | Fixed above. |

## Known gaps

- **The bots press the same keys for every variant.** The Novice never Reels or Glides, so Swap, Anchor, Phase Step and Skate are read from the Skilled bot alone, and neither bot plays to a variant's strength (gathering the party for a Chorale, Swapping a hero out of a cleave on purpose).
- **An Echo Ward from a Chorale's Perfect is a plain Ward** on that hero, not another burst.
- **The HUD can't see the Aegis Link.** Its strand is drawn from the `linked` events, but `WorldState` doesn't carry the Link, so the hero frames don't mark it, and a view opened mid-Link draws nothing until the next one.
- **Variants add up for a skilled player.** Each is within about 5 points of its default, but the Skilled bot's best four together are worth about 14% more enemy life to it. They're options, not free. The plan's +30% cap counts only the Astrolabe and the Reliquary ([Phase 4h](phase-4h.md)).

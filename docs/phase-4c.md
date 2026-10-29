# Phase 4c — The Reliquary

*2026-10-28 · plan: [docs/plan/02-game-design.md §9](plan/02-game-design.md#9-meta-progression-the-loom), [03 §9.2](plan/03-content-bible.md#92-the-reliquary-persistent) · follows [Phase 4b](phase-4b.md)*

The second piece of the Loom: the **Reliquary**, where relics outlive their runs. A won run lets you **enshrine** one of the relics it found. Between runs you **craft** them with Inscriptions (affixes), pushing your luck against Instability, and you **carry** up to three into each run. This is the plan's answer to the original's item crafting, with fewer currencies and real decisions. The user chose how it works:

| Question | Choice |
|---|---|
| Which runs enshrine? | **Won runs.** Beat the Hollow Cantor and keep one relic the run found. This is the plan's "a run that reached Movement II", applied to the one Movement there is. |
| How deep is crafting? | **The full design.** Inscribe, Retune and Ascend, with Instability and a shown chance to Fracture, plus Dissonate, the one-shot gamble with a Discord Tear. |
| How strong? | **Tiered, like item level.** The user: "Gear in PoE adds a significant amount of power for mirror-tier items." Inscriptions roll tiers **T5 to T3** now. **T2 and T1** come with Dissonance (Phase 6), where a mirror-tier set will push further against enemies built to need it. |
| When does it open? | **Rank 10**, with one carry slot. **Rank 15** gives a second, **Rank 20** a third. Ranks 10–20 gave only an Astrolabe point each until now. |
| The first measurement found it far too strong (a typical set about +35%, an excellent one about +50%; the relics' own effects alone +15–19%, working from the first fight). How to bring it in? | **Attune one, halve the affixes.** Only the relic in the first carry slot plays its own effect; the others lend their affixes. Like one build-defining unique and rare gear in PoE. Every affix value is roughly halved. The targets: a typical set about **+15%**, an excellent one about **+20%**, a lucky Cursed one about **+25%** (see *Harness*). |

## How it works

- **Enshrine.** At the Summary of a won run, pick one of the relics the run found (not one it carried in) to enshrine, or none. It arrives with its first Inscriptions, by rarity: one for a common or a rare, two for a legendary or a cursed relic. They're rolled as an Inscribe rolls them, but add no Instability. A cursed relic a Forge cleansed comes cleansed.
- **The Reliquary** holds **12** relics. A full Reliquary must release one (salvaged for Tuning Shards) before it takes another. The same relic can be enshrined more than once: each is its own, with its own Inscriptions.
- **Carry.** In Prep, choose up to your slots' worth of enshrined relics (1 at Rank 10, 2 at 15, 3 at 20), never two of the same relic. They're yours from the first fight. The run's offers, merchants and events don't offer them again. A carried relic can't be sold.
- **Attunement.** The relic in the first slot is **attuned**: it plays its own effect, Empowered if a Dissonate Empowered it, and lends its affixes. The others are **dormant**: their own effect sleeps (a cursed one's curse with it, so a Forge has nothing to lift), and they lend only their affixes (Inscriptions, a Dissonant one, a curse). Which relic to attune is the choice: reorder the carry.
- **The run's snapshot.** Embarking copies the carried relics, Inscriptions and all, into the run, as it does the Astrolabe. Crafting or releasing one later doesn't change a run in progress, and a resumed run keeps its own. The Training Grounds use the relics you've chosen to carry, so you can try one before a run.
- **Crafting** happens on the Reliquary's screen, between runs (from the Title and from Prep, like the Astrolabe). Every craft shows its cost, its odds and its chance to Fracture before you commit. Its randomness is seeded and saved in the profile, so reloading can't reroll a craft.
- **Materials.** Tuning Shards from every fight a run wins, and Discord Tears from a boss beaten with an S (see *Materials*).
- **Skip the unlocks** opens the Reliquary with all three slots. What's in it still comes from play.

## Inscriptions

Up to **4** on a relic (5 with a Dissonant one), never the same one twice. Each has a **category**, which is what Inscribe lets you choose, and **five tiers**, T5 (weakest) to T1. A tier is a range: the value is rolled within it, and Retune rolls it again. Values grow faster than the tiers do, so a T1 is worth far more than five T5s. **T2 and T1 can't be reached yet**, except by a Dissonate gone Cursed (see *Crafting*). They wait for Dissonance.

The Inscriptions use the Astrolabe's stats and add to them: a "+3% Thread potency" sits in the same sum as the tree's Thread nodes. So the two share their returns, as gear and passives do in PoE.

| Category | Inscription | Effect | T5 | T4 | T3 | T2 | T1 |
|---|---|---|---|---|---|---|---|
| **Silk** | Potent Thread | +% Thread potency (Mend and Empower) | 1–1.5 | 2–2.5 | 3–3.5 | 4–5 | 5.5–7 |
| | Deep Mend | Mend +% | 1.5–2 | 2.5–3.5 | 4–5 | 5.5–7 | 7.5–10 |
| | Bright Empower | Empower +% | 1.5–2 | 2.5–3.5 | 4–5 | 5.5–7 | 7.5–10 |
| | Long Thread | the Thread reaches m farther | 0.25 | 0.5 | 0.75 | 1 | 1.25–1.5 |
| **Choir** | Clear Tone | aura effect +% | 1–1.5 | 2–2.5 | 3–3.5 | 4–5 | 5.5–7 |
| | Wide Field | the field +% wider | 1.5–2.5 | 3–4 | 4.5–5.5 | 6–7.5 | 8–10 |
| | Light Reserve | songs reserve % less | 0.5–1 | 1.5 | 2–2.5 | 3–3.5 | 4–5 |
| **Aegis** | Stout Ward | Ward's barrier +% | 2–3 | 3.5–4.5 | 5–6.5 | 7–9 | 9.5–12.5 |
| | True Timing | Perfect Wards s more forgiving | 0.005 | 0.01 | 0.015 | 0.02 | 0.025 |
| | Light Hands | techniques cost % less | 1–1.5 | 2–2.5 | 3–3.5 | 4–5 | 5.5–7 |
| | Quick Hands | techniques recover % sooner | 1–1.5 | 2–2.5 | 3–3.5 | 4–5 | 5.5–7 |
| **Bond** | Hardy | heroes +% life | 1–1.5 | 2–2.5 | 3–3.5 | 4–5 | 5.5–7 |
| | Fierce | heroes deal % more damage | 1–1.5 | 2–2.5 | 3–3.5 | 4–5 | 5.5–7 |
| | Eager Solo | Solos charge % faster | 1.5–2.5 | 3–4 | 4.5–5.5 | 6–7.5 | 8–10 |
| | Swift Rescue | revives % faster | 2.5–3.5 | 4–5.5 | 6–7.5 | 8–10 | 10.5–14 |
| **Weaver** | Vigor | your Life +% | 1.5–2 | 2.5–3.5 | 4–5 | 5.5–7 | 7.5–10 |
| | Deep Breath | Spirit regenerates % faster | 1.5–2 | 2.5–3.5 | 4–5 | 5.5–7 | 7.5–10 |
| | Ringing | + Resonance from a Perfect Ward | 0.5 | 1 | 1.5 | 2 | 2.5 |
| | Attentive | + Resonance for answering a call | 0.5–1 | 1.5 | 2–2.5 | 3 | 3.5–4 |

Values move in steps of 0.5 (0.25 m for the Thread's reach, 0.005 s for timing). They were halved after the first measurement; *Harness* holds them to the targets above.

## Crafting

| Action | Cost | Effect | Instability |
|---|---|---|---|
| **Inscribe** | 6 shards | adds a random Inscription from a **chosen category** (one the relic doesn't have), rolling T5 (60%), T4 (30%) or T3 (10%) | +12 |
| **Retune** | 2 shards | rolls one Inscription's value again within its tier | +4 |
| **Ascend** | 8 shards | tries to raise one Inscription a tier: T5→T4 75%, T4→T3 50%; on a miss nothing changes | +15 |
| **Dissonate** | 1 Discord Tear | the final gamble, a quarter each (below); the relic can't be crafted afterwards | — |
| **Release** | — | the relic leaves the Reliquary for shards: 3 for a common, 5 for a rare or a cursed relic, 8 for a legendary, and 2 more for each Inscription | — |

**Instability** runs 0–100 and only rises. Above 40, every craft first risks a **Fracture**: (Instability − 40) × 1.5%, so 15% at 50, 30% at 60 and 90% at 100. A fractured relic freezes as it was, and the craft and its cost are lost. It still works, and can still be carried. The odds are always shown.

**Dissonate**, a quarter each:
- **Dissonant**: a fifth slot holds a Dissonant Inscription, one of five:

  | Category | Dissonant Inscription |
  |---|---|
  | Silk | **Gilded Thread**: Thread potency +5%, the Thread reaches 0.5 m farther |
  | Choir | **Choral Swell**: aura effect +4%, songs reserve 2.5% less |
  | Aegis | **Bell-Forged**: Ward's barrier +7.5%, Perfect Wards 0.015 s more forgiving |
  | Bond | **Kinship**: heroes +3% life and +3% damage |
  | Weaver | **Deep Well**: start every fight with 12 Resonance |

- **Empowered**: the relic's own effect grows (below). A relic with no numbers to grow becomes Dissonant instead.
- **Cursed**: every Inscription rises a tier, to T2 at most (the only way to T2 before Dissonance), and a curse joins the relic, one of: *Thin Spirit* (Spirit −4%), *Brittle Ward* (Ward's barrier −5%), *Frail* (heroes' life −2.5%), *Dull Thread* (Thread potency −3%).
- **Shattered**: nothing changes.

**Empowered relics:**

| Relic | Its effect | Empowered |
|---|---|---|
| Silver Thimble | shields 8% of life, once every 4 s | 12%, once every 3 s |
| Lantern of the Lost | a barrier worth 20% of life | 30% |
| Featherweight Robes | Glide recovers 40% sooner | 55% |
| Warden's Key | ×3 damage to Mutes | ×4 |
| Tuning Fork | a Perfect Ward charges the Solo 25% | 35% |
| Choirmaster's Baton | Cued Solos last 50% longer | 75% |
| Hollow Bell | Chime 40% sooner, heals 50% less | 55% sooner, heals 35% less |
| Cantor's Hymnal | start with 50 Resonance | 75 |
| Prism Loom | 60% strength within 5 m | 75% within 6 m |
| Cracked Metronome | every 12 s | every 9 s |
| Heavy Score | heroes deal 15% more damage | 22% |
| Glass Halo | a Perfect Ward heals 10% | 15% (its curse unchanged) |

Martyr's Veil, Star Chart and Spindle of Fate have no numbers to grow.

## Materials

Once the Reliquary is open, every run that ends (won, lost or abandoned) pays out at its end:
- **Tuning Shards**: 2 for every fight it won, plus 2 more for an elite, 3 more for the Bellwarden and 5 more for the Hollow Cantor. A won Prelude of seven fights pays about 24.
- **A Discord Tear** for beating the Hollow Cantor with an S.

That's about four crafts a won run: enough to craft one relic a run, and to gamble a Tear on the good ones. *Harness* checks the pace.

## Contracts (v11)

**Content** (`CONTENT_VERSION` bump):
- `inscriptions`: `{ id, name, category: 'silk' | 'choir' | 'aegis' | 'bond' | 'weaver', kind: 'normal' | 'dissonant', effects: { effect, tiers? | value? }[], text }`. A normal Inscription has one effect with five `[min, max]` tiers (T5 first) and a `step`. A Dissonant one has fixed values.
- `curses`: `{ id, name, effects, text }`.
- `relics[].empowered?: { values }`: the empowered numbers (a relic without them can't be Empowered).
- `reliquary`: the constants above (capacity, slots by Rank, costs, Instability, Fracture, tier odds, Ascend odds, Dissonate weights, release and material values).

Validation:
- every effect is one the sim knows;
- every tier is in order and inside its range;
- each category has an Inscription;
- every `empowered` names only the relic's own values.

**Sim** (`SIM_VERSION` 13):
- `SimConfig.passives?: { effect, value }[]`: the carried relics' Inscriptions, Dissonant Inscriptions and curses, in the Astrolabe's effect names. They fold into the same sums as the tree's nodes, and the song reservation counts them too. The sim never sees an Inscription, only its effects.
- `RelicConfig.empowered?: boolean`: the relic plays with its empowered values.
- Both are hashed, and both are empty for an absent Weaver.

**Meta** (`meta/reliquary.ts`, pure; randomness only from the seed it's given):
- `enshrine(reliquary, run, relicId)`, `inscribe(reliquary, uid, category)`, `retune(reliquary, uid, index)`, `ascend(reliquary, uid, index)`, `dissonate(reliquary, uid)` and `release(reliquary, uid)`. Each returns the new Reliquary and what happened (`'inscribed' | 'fractured' | 'missed' | …`), or a refusal with its reason.
- `craftOdds(relic, action)` returns what the screen shows: the cost, the Fracture chance and the tier or success odds.
- `relicPassives(relic)` returns its `{ effect, value }` list.
- `runMaterials(run)` returns the shards and Tears a run pays.
- `carrySlots(rank, all)` returns 0 below Rank 10, then 1, 2 or 3.

**Profile v4:** `reliquary: { relics, shards, tears, carry, seed, next }`:
- each relic is `{ uid, id, cleansed, inscriptions: { id, tier, value }[], instability, fractured, dissonance: null | { kind, inscription?, curse? } }`;
- `carry` holds the uids chosen for the next run;
- a v3 profile migrates with an empty Reliquary.

**Run:**
- `RunState.carried: ReliquaryRelic[]` is the snapshot taken at embark. Those relics are also in `run.relics`, marked `carried`; all but the first are `dormant` (their own effect sleeps: the fight's `relics` leave them out, and a Forge can't cleanse them).
- `RunState.reliquary: { paid, enshrined } | null`: what the run's end paid and which relic it enshrined, so neither happens twice.
- Old saves default to none carried.

**Stores:**
- The profile store gains `enshrine`, `craft`, `release` and `setCarry`.
- When a run ends, the run store pays its materials once.
- Prep's carry follows the profile, as its tree does.

## Presentation

*To be filled in by the UI, VFX and audio workstreams.*

## Harness

`npx tsx tools/reliquary.ts --power --seeds 400 --bots novice`: whole Prelude runs (Guardian, the Novice bot: the Skilled one wins too often to show it), each set played against enemies with 15% more life. A set worth +15% wins as often there as no set does against the usual ones. The worth is read on a logistic scale between the two baselines (35.3% and 14.8%), as the Astrolabe's was.

The sets carry the three legendaries (Prism Loom first, so attuned), with a generalist's affixes: Thread, Mend, aura effect and reserve on the first; Ward, timing and the techniques on the second; the heroes and Life on the third.

| Set | First measured | Attuned, affixes halved | Target |
|---|---|---|---|
| the relics' own effects alone (no affixes) | +19% | +7.5% | |
| one relic, typically crafted (Rank 10) | +14% | +9.1% | |
| typical: four affixes each, T4 and T5 | +31% (about +35% checked at ×1.3) | **+13.8%** | about +15% |
| excellent: four T3 each, rolled high | +40% (about +50% at ×1.45) | **+17.8%** | about +20% |
| Cursed: four T2 each, and a curse | +46% | **+22.7%** | about +25% |
| two rares and a legendary, typical | +25% | +11.0% | |

The first measurement found any three relics' own effects worth +15–19% by themselves, since they work from the first fight, and typical affixes adding about +15%. Past +15% the scale was extrapolated, so it was checked against enemies with 30% and 45% more life: the typical set still beat no set's 35% there, so the extrapolation, if anything, ran low. Attuning one relic and halving the affixes brought each set to within noise (±2–3) of its target. With the Astrolabe's best trees (about +18%), a typical Rank-20 veteran plays at about +30%, the plan's cap, and a lucky one at about +40%.

`npx tsx tools/reliquary.ts --career --runs 40`: from Rank 10, every run carries the best relics held, pays its materials, enshrines the rarest relic it found when won, and crafts with a simple push-your-luck policy (Inscribe to four, Ascend the lowest tier while the Fracture chance is at most 20%, then Dissonate with a Tear).

| Run | Novice: Rank, carried affixes | Skilled: Rank, carried affixes |
|---|---|---|
| 5 | 11 · one relic, T4 ×1, T5 ×3 | 11 · one relic, T3 ×1, T4 ×1, T5 ×2 |
| 10 | 12 · one relic, T3 ×1, T4 ×3 | 13 · one relic, T3 ×1, T4 ×2, T5 ×1 |
| 20 | 14 · one relic, T3 ×1, T4 ×3 | 15 · two, T3 ×2, T4 ×3, T5 ×3 |
| 30 | 16 · two, T3 ×2, T4 ×6 | 18 · two, T3 ×2, T4 ×5, T5 ×1 |
| 40 | 18 · two, T2 ×4 (Cursed), T3 ×4 | 20 · three, T3 ×4, T4 ×7, T5 ×1 |

- **Materials pace well.** A won run pays about 24 shards: enough to craft one relic a run early on. Shards pile up late (150 or so by run 40) only because the policy stops at a 20% Fracture risk. A player who pushes harder spends them.
- **Tears come with skill.** Over its 40 runs the Novice earned 15 (an S on the boss in 15 of its 25 wins, with its relics carried) and spent each at once; the Skilled bot earned 34 and Dissonated 30 relics.
- **Fractures were rare** under this careful policy (two in about 120 Ascends): the risk is the player's to take.

## Code review

*To be filled in after the review.*

## Known gaps

*To be filled in.*

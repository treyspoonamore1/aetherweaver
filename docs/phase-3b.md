# Phase 3b — Relics, shops and events

*2026-10-25 · plan: [docs/plan/06-roadmap.md, Phase 3](plan/06-roadmap.md#phase-3--the-expedition-a-full-movement-i-run-l) · follows [Phase 3](phase-3.md)*

The second half of Phase 3 gives the run its middle: a currency, things to buy, and choices between fights that change the next one. The user chose this over the Luminary Calling (next) and a longer map "through choices" over more fights:

> Today: `F - F - S - F - R - Boss - Boss` → Proposed: `F - Shop - F - Event - F - Forge - F - R - Boss - Boss`

## The map

Ten stops instead of seven. Every row is shuffled; every path fights at least three times before the Bellwarden (tested).

| Row | Nodes |
|---|---|
| 0 | First Light |
| 1 | skirmish · skirmish · **event** |
| 2 | **merchant** · skirmish · shrine |
| 3 | skirmish · elite · skirmish |
| 4 | **event** · **forge** · **merchant** |
| 5 | elite · skirmish · skirmish |
| 6 | respite · **event** · **forge** |
| 7 | The Bellwarden |
| 8 | respite · **merchant** |
| 9 | The Hollow Cantor |

Every node previews what it pays (`MapNode.reward`): the draft's rarity, healing, **Aether** (before the grade bonus) and how many **relics** you'll choose from. Event nodes name their event and a one-line teaser.

## Aether

The run's currency. Won fights pay it: skirmish 20, elite 35, Bellwarden 50, × the grade (S ×1.5, A ×1.3, B ×1.15, C ×1, D ×0.85). A loss pays nothing. A run starts with none. All numbers live in [`src/meta/economy.ts`](../src/meta/economy.ts).

| Where | What it costs |
|---|---|
| Merchant | 3 relics (common 50, rare 80, legendary 130, cursed 30), 2 motifs (35 / 55 / 80 by rarity), healing 30% for 25. Each item once. |
| Forge | **One** service per visit: temper a motif (+1 level, 30), retune (20), lift a curse (40). |
| Events | The Broken Loom's mend (40). |

## Relics

One each, kept for the run. A motif adds a number; a relic changes a rule. Elites offer **one of 2**, the Bellwarden **one of 3** (rare or legendary), the Unsung Choir **one of 3**. Merchants sell three. Offers never repeat a relic you carry, and never offer a curse.

| Relic | Rarity | Rule | Where it bites (sim) |
|---|---|---|---|
| Silver Thimble | common | Moving the Thread to a hero shields them for 8% of their life, once every 4 s | `attachThread` |
| Lantern of the Lost | common | When a hero goes down, the others gain a barrier worth 20% of their life | `downHero` |
| Featherweight Robes | common | Glide recovers 40% sooner | `castGlide` |
| Warden's Key | common | Your heroes deal 3× damage to Mutes | `dealDamage` |
| Tuning Fork | common | A Perfect Ward charges the hero's Solo by 25% | `perfect()` |
| Choirmaster's Baton | rare | Solos you Cue last 50% longer | `startSolo` |
| Hollow Bell | rare | Chime recovers 40% sooner, but heals 50% less | `castChime`, `updateChimes` |
| Martyr's Veil | rare | Once per fight, a hit that would down a hero strikes you instead; it can leave you at 1 life, never lower | `dealDamage` (after Fermata) |
| Cantor's Hymnal | rare | Start every fight with 50 Resonance: two Cues, ready | `createWorld` |
| Star Chart | rare | Motif drafts offer a fourth choice | run layer only |
| Prism Loom | legendary | Mend and Empower also reach heroes within 5 m of the one you thread, at 60% | `threadPotency`, `updateThread` |
| Cracked Metronome | legendary | Every 12 s, a Ward that takes a telegraphed hit counts as Perfect, however early you cast it | `hitEntity` |
| Spindle of Fate | legendary | The beam song's echo plays at full strength (×1, not ×0.75) | `createWorld` (loadout echo) |
| Heavy Score | cursed | Heroes deal 15% more damage. *Curse: you can't Glide* | `dealDamage`, `castGlide` |
| Glass Halo | cursed | A Perfect Ward heals every hero 10%. *Curse: Ward's barrier is 50% smaller* | `perfect()`, mods |

**Curses are bargains.** A cursed relic is cheap (30 at a merchant, free from the Merchant of Silences). A Forge lifts the curse and the blessing stays, so buying a curse is a plan: *take the Heavy Score now, route through a forge later*.

**The Weaver's share.** Relic damage (Heavy Score, Warden's Key) counts as the Weaver's share of a hit (`damageTaken.amplified`), separate from the auras' and Empower's parts. Relic shields are the Weaver's (`ledger.shielded`). Martyr's Veil logs a Save (cause `martyr`).

## Boons and banes

What events leave behind (`content.boons`), for a number of fights or the rest of the run.

| | Kind | Lasts | Effect |
|---|---|---|---|
| The Last Note | boon | 2 fights | Heroes start the fight with their Solos charged |
| Frayed Spirit | bane | the run | Your Spirit is 10% smaller |
| Mended Loom | boon | the run | Mend heals 10% more and Empower is 10% stronger |

## Events

A scene and two or three choices, each with a price, a risk or nothing at all. Walking away is always allowed.

| Event | Choices |
|---|---|
| The Wounded Cantor | **Mend it**: Frayed Spirit for the run, and a rare relic · **Take its last note**: the Last Note · Leave it |
| The Shrine of Discord | **Offer a motif**: 60% it gains 2 levels, 40% it's lost · Walk away |
| The Tuning Pool | **Retune** · **Bathe**: heal 25% |
| The Merchant of Silences | **Pay in blood**: every hero loses 20% life, gain a rare relic · **Accept a gift**: a cursed relic · Decline |
| The Unsung Choir | **Break their song**: an elite fight, then choose one of 3 relics · Slip past |
| The Broken Loom | **Mend it** (40 Aether): the Mended Loom · **Salvage it**: +35 Aether · Leave it |

Gambles are seeded by the run (the same seed, node and choice always roll the same).

## Contracts (v5)

**Sim** (`SIM_VERSION` 5, replay format 4):

- `SimConfig.relics: (string | { id, cleansed })[]` and `SimConfig.boons: string[]`; both are dropped when the Weaver is absent (the "without you" re-run).
- `WorldState.relics: RelicState`: `ids`, `cleansed`, `metronomeAt` (when the Metronome's free Perfect is ready, or null), `thimbleAt`, `veil` (unused this fight).
- Event `relicTriggered { relic, hero }` when a relic visibly acts: Thimble, Lantern, Veil, Metronome, Tuning Fork, Glass Halo, and the Hymnal at tick 0.
- `SaveCause` gains `'martyr'`. A cursed Glide is rejected with reason `'locked'`.
- Relic and boon behaviour lives in `sim/mods.ts` (`KNOWN_RELICS`, `KNOWN_BOONS`, tested against content).

**Content**: `relics`, `boons`, `events` (zod-validated: placeholders filled, gambles have both outcomes, references exist). Helpers: `relicDef`, `relicText`, `relicCurse`, `boonDef`, `boonText`, `runEventDef`, `fillValues`.

**Run** (`meta/types.ts` v5, save v4):

- `RunState`: `aether`, `relics: { id, cleansed }[]`, `boons: { id, fights | null }[]`, `shop`, `forge`, `event`, `relicOffer`.
- Phases: `relic`, `merchant`, `forge`, `event` (plus the old ones). After a won elite or Bellwarden fight: result → **relic** → draft → map. After the Unsung Choir: result → relic → map.
- Actions: `pickRelic(i | null)`, `buy(i)`, `leaveShop()`, `forge({service, …})`, `leaveForge()`, `chooseEvent(id, { motifId?, chords? })`, `leaveEvent()`.
- Helpers for screens: `Run.forgeTargets(run, service)`, `Run.eventChoiceProblem(run, choiceId)` (why a choice is greyed out), `Run.hasRelic(run, id)`.
- `EncounterResult.aether`. Save v3 migrates (no Aether, no relics; the old seven-stop map is kept, its fights at Threat ×1 since it was tuned without it).

## Presentation

Details and screenshots: [UI](phase-3b/ui.md), [VFX](phase-3b/vfx.md), [audio](phase-3b/audio.md).

| | |
|---|---|
| **Map** | Merchant (purse), forge (anvil) and event glyphs; event nodes named. Every tooltip says what the stop pays — "+35 Aether, more for a good grade", "Choose 1 of 2 relics", "Threat: enemies +23% life". A strip under the header carries the run's Aether, relics (tooltips with rule and curse) and boons with fights left. |
| **Relic offer** | Two or three relic cards (keys 1–3) or "Leave them", titled by where they came from. |
| **Merchant** | Relic, motif and healing cards with prices; what you can't afford says how much more you need; sold items stay, marked yours. |
| **Forge** | Three services; Temper and Lift a curse open a picker that previews the change; Retune opens the song builder. One per visit. |
| **Event** | The scene, then choices with their price, odds or danger as tags; greyed choices say why. After choosing: the outcome, what changed, and the party's life. |
| **Result / Summary** | "+N Aether" with the grade's bonus; Continue says what's next. The summary lists the relics and the Aether earned and left. |
| **HUD** | A relic bar under the encounter header: cooldown rings for the Metronome and the Thimble, the Veil's single charge, a flash whenever a relic acts, and boon chips. |
| **Codex** | Relics (by rarity, prices, where they come from) and Events (every choice). |
| **In the fight** | Every relic moment shows on the hero it helped, from the Weaver: the Thimble's silver needle sews a shield, the Lantern's lights fly to the others' barriers, the Veil unfurls from the saved hero to the Weaver, a brass metronome ticks over the Weaver while ready and stamps a clock face under the hero it makes Perfect, the Fork rings and grows the Solo arc, the Glass Halo shatters into heals, the Prism Loom spills faint prismatic threads to the heroes it reaches, and a refused Glide under Heavy Score drops a chain on the Weaver. Spindle of Fate's full echo stays dashed but loud. All within the old draw-call budget. |
| **Sound** | Ten new UI sounds (a purchase, a refusal, the forge's anvil, an event's opening, a gamble's bell ringing true or cracking, relics revealed and taken, a curse lifted, Aether counted) and a voice for every relic moment in combat, sitting under the Perfect Ward and Save sounds. |

## Threat

The deeper the row, the more life every enemy has: **+3.75% per row past the first** (`THREAT_PER_ROW`, `threatFor(row)` in [`src/meta/economy.ts`](../src/meta/economy.ts)). The Bellwarden on row 7 has ×1.23 life, the Cantor on row 9 ×1.30. Every fight's preview shows it (`MapNode.reward.threat`); the sim takes it as `SimConfig.threat` (1 outside runs, clamped 1–3). The "without you" re-run fights the same enemies.

**Why.** The first sweep of the new map had whole runs *easier* than Phase 3, and relics weren't the reason: with relics turned off (`--no-relics`: no offers, no relics bought, no event choice that grants one) the bots won just as often, spending the Aether on motifs and healing instead. Ten stops grow the party — more drafts, merchants' motifs and healing — so it reached the bosses stronger than they were tuned for. Threat keeps the late fights honest without touching the isolated encounters the [difficulty contract](phase-1.md#difficulty-contract) measures. It scales life only, not damage: fights last longer as you go deeper, but no single hit gets harder to survive.

## Harness

Whole Prelude runs with the default loadout (Steady), `npm run harness -- --run --seeds 80 --bots novice,skilled`. Threat per row was calibrated with `THREAT_PER_ROW=… npm run harness -- --run …` (an override for tuning only).

| | Novice | Skilled |
|---|---|---|
| Phase 3 (7 stops), 80 seeds | 40% | 88% |
| Phase 3b, no Threat, 80 seeds | 51% | 95% |
| Phase 3b, no Threat, no relics, 80 seeds | 51% | 96% |
| Threat 3.5% / row, 200 seeds | 48% | 90% |
| **Threat 3.75% / row (shipped), 200 / 120 seeds** | **39%** | **90%** |
| Threat 4% / row, 80 seeds | 33% | 89% |
| Threat 4.5% / row, 80 seeds | 29% | 88% |
| Contract | 25–45% | ≥ 80% |

The bosses are steep: a fresh Novice party beats the Bellwarden 88% of the time at ×1 life and 63% at ×1.225, the Cantor 65% and 38% (40 seeds each, no enrage involved). That steepness is why the curve jumps between neighbouring rates, and why the shipped rate was settled on 200 seeds. Calibration also caught a trap: an early Hollow Bell that stopped Chime healing outright was in so many blind-picked runs that it held the Novice down by ten points on its own.

At 3.75%, a Skilled run plays 5.9 fights, finds 3.9 relics and earns about 195 Aether (73 unspent at the end); a Novice run 4.9 fights, 2.1 relics, 125 Aether. Novice runs end everywhere, and the bosses are the wall again: of 122 losses, 42 in skirmishes, 27 in elites, 3 in the Unsung Choir, 27 at the Bellwarden and 23 at the Cantor (in Phase 3 the two bosses took 28 of 48).

The harness's policies for the new stops ([`tools/harness-core.ts`](../tools/harness-core.ts)) are simple and deterministic: merchants buy the dearest relic it can afford, then healing if the party is under 60%, then motifs; forges lift a curse if there is one, else temper; events take the first choice that needs no motif or new Chords; relic offers take the first.

### Relics, one at a time

`npx tsx tools/relics.ts --seeds 24`: each relic alone against the four hard fights (Threat 1), against the same seeds with no relic.

No relic: Novice 67% / 92% / 92% / 58% (Muted Nave, Shattered Choir, Bellwarden, Cantor); Skilled 100% / 83% / 100% / 92%. Each cell is the change in win rate, averaged over the four fights (±6 points of noise at 24 seeds).

| Relic | Novice | Skilled | Notes |
|---|---|---|---|
| Silver Thimble | +2 | +2 | |
| Lantern of the Lost | +7 | +1 | +21 on the Cantor, where heroes go down |
| Featherweight Robes | 0 | −1 | The bots barely Glide; people will feel it |
| Warden's Key | +6 | 0 | All of it on the Muted Nave (+25): a relic for one road |
| Tuning Fork | +1 | −2 | |
| Choirmaster's Baton | +4 | +2 | |
| Hollow Bell | −2 | +2 | Was −9 when it stopped healing outright; now it heals half |
| Martyr's Veil | +7 | +2 | Was −5 for Skilled at the Cantor when it downed the Weaver |
| Cantor's Hymnal | −5 | 0 | Within noise at 60 seeds (−7 at the Bellwarden); the Novice cues at random |
| Prism Loom | +2 | 0 | |
| Cracked Metronome | +6 | +1 | +29 on the Cantor for the Novice |
| Spindle of Fate | 0 | −1 | Was −4 / −2 with a price on the Thread; now it has none |
| Heavy Score | +3 | +2 | Was +20 for the Novice at +25% damage; now +15% |
| Glass Halo | −16 | −1 | A curse that bites until a forge lifts it: half a Ward for anyone who doesn't Perfect |

The Skilled bot is near its ceiling in these fights, so its column says little; the Novice's column is where relics show.

## Known gaps

- **The bots shop simply.** The harness buys the dearest relic it can afford and takes an event's first choice; it never plans a route through a forge to lift a curse or saves Aether for a legendary. A planning player gets more from the economy than the harness measures, so whole runs may play a little easier for people than the table says.
- **Threat scales life only.** Damage stays as tuned, so deep fights last longer rather than hit harder. If late fights start to feel like a slog, a share of Threat could move to damage.
- **Six events.** Each appears at most once a run, and a run passes at most three, so repeat players will meet the same scenes often. More events are cheap to add: they are data (`src/content/runEvents.ts`).
- **The bots value some relics less than people will.** Featherweight Robes and Heavy Score's curse touch Glide, which the bots barely use; Cantor's Hymnal gives Resonance the Novice bot spends at random. Their harness numbers undersell (Robes) or oversell (Score) them.
- **Runs saved before Phase 3b** keep their seven-stop map: no merchants, forges or events until the next run.

## Code review

An independent review of the sim, run layer, content, harness and audio changes (read-only, verified against a clean copy of the commit) found three defects and one measurement flaw, all fixed with regression tests:

- **Martyr's Veil after a non-Perfect Ward logged two Saves** for one hit (the Veil's, then the Ward's, because the Ward had absorbed part of it): double Resonance, double slow-motion and a better grade. `DamageResult.martyred` now tells the telegraph code the Veil already took the Save.
- **The Veil credited the whole overkill as shielded** (a 5,000 hit on a hero at 50 life counted as 3,500 shielded). It now credits the life the hero kept, as Fermata's guard does.
- **The Veil's highlight read "…undefined…"**: the result text had no line for the new save cause. `SAVE_HOW` is now typed by `SaveCause`, so a new cause can't be forgotten; the combat callout says "You took the blow for Kael".
- **`--no-relics` still collected relics through events** (the Wounded Cantor, the Merchant of Silences, the Unsung Choir), so the table's no-relics row was contaminated. Re-measured: 51% / 96%, the same conclusion.

And four smaller ones: Phase 3 saves no longer get Threat on their old map (fights read Threat from the node, and migrated nodes say ×1); relic shields no longer replace a hero's own overshield (an uncued Aegis Wall); a won event fight heals 20% like any other win; the migration test now loads a genuine seven-stop map with no Threat fields.

A second review, of the UI, found two defects a player would hit, both fixed:

- **A double-click carried into the next screen.** On a map node it bought the relic that appeared under the cursor (or took an event's first choice); on a relic offer it also picked a motif from the draft that followed; on the Shrine or the forge it gambled or tempered a motif at once. The run screens now ignore input for 350 ms after the screen changes, behind a transparent veil (so Playwright waits instead of losing clicks), and always ignore a double-click's second click and a held key's repeats. Fights keep their own input. The reviewer's four repros leave the run untouched now.
- **Relic flashes on the HUD never ended** in a live fight (every snapshot cancelled the timer that ends them). Fixed, and checked in a browser.

Smaller ones: Threat no longer shows on events without a fight; the forge's result survives a reload and event lines say what really happened (a motif's "level 1 → 3"; healing hero by hero when a cap got in the way); the Codex reads the Unsung Choir's relic count from its content; every event must keep a choice that's always open (a schema check); three tests now check the real thing (a shop the run stocked, the sim's relic counts, the purse on screen in the e2e).

## What's next

The **Luminary**, the first Calling (the user's pick), then more events and relics, motifs and Harmonies, technique variants, a fourth elite affix, director v2 and an onboarding pass.

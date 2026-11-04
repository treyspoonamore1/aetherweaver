# Phase 5b: Brann, the Bloodsworn, and the hero roster

*2026-11-03, revision 2 · plan: [02 §6](plan/02-game-design.md#6-heroes-and-ai) (lines 166-178), [02 §9](plan/02-game-design.md#9-meta-progression-the-loom) (line 238), [02 §10](plan/02-game-design.md#10-endgame-and-mastery) (line 253), [03 §5](plan/03-content-bible.md) (Brann, lines 203-214), [03 §8](plan/03-content-bible.md) (Blood Tithe line 375, Blood and Silk line 399), [04](plan/04-presentation.md) (line 20), [06 Phase 5](plan/06-roadmap.md) (lines 112-125) · follows [Phase 5a](phase-5a.md)*

The fixed party becomes a **roster**. **Brann, the Bloodsworn** is the fourth hero and the first one you earn. You free him from the Legion's cell in Movement II, or he slips his chain when you face Vharun, and he joins for later runs. Once you own four heroes, Prep picks **three**. Kael, Lyra and Vexis stay the default party and the starter roster.

Brann exists to break the healer's reflex. He hits harder the lower his life, and his axe heals him. Your healing on him is halved. You keep him **low but alive** with Wards, Ostinato barriers, Fermata holds and well-timed Cues.

The slice follows three principles:

1. **One hero, done completely.** Brann ships with everything a starter has: kit, Call and Flourish, Solo, Quirk, Needs line, barks, 6 Bond talents, an alternate Solo, 2 scenes, a Bond motif, a model, a colour, a leitmotif and sounds. He also gets the plan's Harmony (Blood and Silk) and a Deed.
2. **The roster is meta, not sim.** The sim already takes 1-4 heroes through `SimConfig.party` (`src/sim/world.ts:110, 243-253`). The replay schema (`src/sim/replay.ts:81`), the slot types (`src/sim/commands.ts:13`) and the threat table (`src/sim/combat/threat.ts:10`) already allow four. Choosing 3 of 4 touches Prep, the run, the profile, the Bonds displays, the bots and the harness. There is **no new SimConfig key**.
3. **Movement I and every default-party run stay bit-for-bit unchanged.** That means:
   - all eight golden hashes in `tests/sim/golden.json` stay byte-identical: patrol 2626acee5ce8d584, crowd 323bd3a88aea3f1b, skilled-first-light 905754ea95eb27ac, skilled-bellwarden 9ff673296b5779d5, novice-cantor ef492fba9d6c91ec, skilled-crimson-gate 33de216e886e4fae, novice-matriarch c189c9db37b9b5f0, skilled-vharun 0d468d6046318cd6;
   - `SIM_VERSION` stays **22**;
   - `tools/m1-baseline.ts --check` and `tests/meta/preludeSnapshot.test.ts` stay byte-equal;
   - no new RNG draws happen on default-party paths;
   - Brann's state keys exist only when Brann is in the party;
   - old profiles (v9) and in-flight runs (RUN_SAVE_VERSION 5) still load.

   Only `contentVersion` changes (`src/content/index.ts:108`).

## What changed in this revision

Revision 1 had two critiques. Everything below was fixed, unless it is listed under *Where we disagreed*.

- **Stage A now compiles, and the workstreams are disjoint.** W0 owns every interface addition, plus identity stubs in `runStore.ts` and `profileStore.ts`, `rosterHeroes` (in `src/meta/bonds.ts`), a single `prepParty(roster)` signature, and the pure Brann rule helpers (`src/sim/systems/blood.ts`, exported from `src/sim/index.ts`). These are implemented for real in W0, so bots, render and the UI compute the same rule as the sim.
- **No unrecruited profile sees Brann between W0 and W6.** W0 also lands the display gate: every `bondedHeroes()` and `CONTENT.heroes` *display* site switches to `rosterHeroes`. W0 must exit with vitest and e2e green, apart from an explicit allow-list of expected reds, each with an owner (see W0).
- **Slot order.** The claim that a hero is always on the same key is dropped, because it was false. Order stays canonical. Every frame and the Prep picker show each hero's key number.
- **Brann's life bar.** There is no orange 'hurt' tier. From 40% down to 15% the bar is a positive ember 'raging' band. Critical is below **15%**, or when he is *falling fast*, or when a lethal hit is incoming.
- **The Cell's copy is roster-aware**, through optional content texts. They draw no RNG.
- **Party C** (Kael, Lyra, Brann) is in every band and every bot test.
- **The no-tank party against bosses** has a pre-agreed band, a lever order and a Prep warning, all decided before W7.
- **The flourish share leak is closed.** The own-damage scale is applied inside `heroDamage` and reported back, and `flourishHit` compares against the scaled base.
- **`recruitsOf` scans `run.results`**, so it survives `toMap()` clearing `run.event`. `recruit()` is a no-op when nothing is new.
- **Lifesteal** is a `HealVia` in *both* unions. Its `source` is the hero. It is aggregated by `BloodState` and blocked during a Fermata hold.
- **Sunder Leap's Call** opens only when a target 4-9 m away exists. The leap reuses `attackFired {visual:'leap'}`.
- **Deathless** is specified against Fermata, and `releaseHold` checks it.
- **Smaller fixes.** The golden dry run uses `npx tsx tools/update-golden.ts`. The outcome builder is `src/app/outcome.ts`. `embark` takes a permissive default roster, and its fallback re-follows Bonds. `lastParty` is checked only for shape at load. The dome is removed everywhere it is named (decree, answers, recaps, glyphs), through `partyHasDome` and an optional `decreeNoDome` text. The Execution decree is rewritten when Brann is condemned.
- **More guards in W0.** W0 adds a bot command-stream snapshot, a hero/shield key-set snapshot and `makeShop` exported. Brann determinism lands in W1. The Expedition snapshot moves to a `tools/*.ts --check`.
- **Readability additions:** a Needs line, a Bloodletting channel that never reads as damage, recap wording for Brann's downs, the Harmony 'would enable' hint, a check against Movement II colours with a brass trim, and a Bond XP catch-up.
- **Factual fixes:**
  - Brann's spot is 1.99 m from Kael, not 1.84.
  - RUN_SAVE_VERSION is 5.
  - The Skilled bot owns an Rng, so the rule is 'no new draws'.
  - The Deed is renamed **In the Red**, so it can't be confused with the Red Line archetype in 02 §11.
- **Human readability tests are post-merge playtest gates.** The automated gates are the merge gate.

### Where we disagreed

- **A map teaser for the Cell (critique 2).** Not done. Event nodes are '?' on the map. Revealing which event sits behind one breaks the map's convention for every event. The reward is already named in the 'free' choice and in the locked Codex silhouette.
- **Letting players reorder slots.** Kept canonical. The default party needs canonical order for byte identity, and a free order adds a Prep control and a per-profile mapping. Every frame showing its key number covers readability. Free ordering stays an open question.
- **The fallback recruit.** Critique 2 suggested 'reach Vharun twice' or 'beat the Matriarch twice' on a counter. We chose **'fight Vharun, won or lost'**. It is gentle, needs no counter or new profile key, and still sits at the end of Movement II.
- **Expected reds instead of zero reds.** Critique 1 offered both options. The exact-list tests (`renderBonds` BOND_CUES == the sim's `talentFired` ids; the `audioPhase4e` sound groups) couple W1 to W4 and W5 by design. We keep that coupling and name the reds rather than weaken those tests.

## Decisions taken (confirm or override; see Open questions)

| Question | Choice | Why |
|---|---|---|
| How Brann unlocks | Two routes:<br>• **Win the Bloodsworn's Cell fight** ('Free the prisoner', `legionRun.ts:462`).<br>• **Fallback:** the first time you fight Vharun, won or lost, recruits him if the Cell didn't.<br>'Skip the unlocks' puts every hero in the roster, and the demo's veteran profile is recruited. | The Cell was written as his hook (02 §9 line 238). It appears on about half of Expedition maps: there is one M2 event node and two M2 events shuffled by `map:m2` (`run.ts:446-451`), and the Cell can be routed around. Reaching Vharun is far likelier than beating him (the Novice wins about 15% of Expeditions). The fallback touches no map RNG and adds no counter. |
| When he joins | **From the next Prep.** He never joins the run that freed him. | Joining mid-run would break the slot-indexed results, timelines and frames (`Timeline.tsx:176`, `SummaryScreen.tsx:182`). It would also shift the 5a Expedition calibration, because the harness picks 'free' (`harness-core.ts:310`). |
| Party choice | Prep picks **exactly 3** distinct roster heroes. The picker exists only once the roster has 4 or more (`prepParty(roster)` returns null before that), so first-run and Prelude Prep stay exactly as today. A non-default pick is remembered in an optional `profile.lastParty`, in canonical order, absent for the default party. | The 5a Route toggle pattern (`prepRoute.ts`, `runStore.setRunMode`). |
| Is a tank required? | **No.** Any 3 of the 4 is legal. Without Kael nothing taunts and threat decides targets, so Brann (threatMult 1.5) leads. Prep shows a one-line note for each missing starter (see *Prep*). Against bosses the no-tank party has its own, looser band (see *Bands*). | The sim already targets by threat. Requiring Kael would make the roster a one-of-two swap. |
| Slot order | **The content order of the chosen heroes** (Kael, Lyra, Vexis, Brann), canonicalised by `setParty`. A hero's key **can change** with the party: in party B (Lyra, Vexis, Brann), Lyra is key 1. Every frame, the Prep picker and the Thread dial show each hero's key number. | Slots 0, 1 and 2 stay byte-identical for the default party, because they drive callCooldown (`world.ts:953`), the threat index, AI and RNG iteration order and the ledger timeline. |
| 4th slot (Astrolabe) | **Out of scope.** | See *Known gaps*. |
| Hero scaling by Movement | **None.** Brann ships at Movement I numbers. | Keeps 5a's decision to scale enemies only. |
| Brann's two abilities | **Sunder Leap:** a gap-closer slam. It interrupts interruptible casters it lands on. His Call asks for a Ward, and the Flourish is *Red Comet*. **Bloodletting:** he spends his own life for 3 empowered, all-round swings. | `HeroDefSchema.abilities` is a 2-tuple, and the plan names only the axe cleave. Bloodletting burns off overheal, so topping Brann up visibly wastes Spirit. Sunder Leap gives parties without Kael or Lyra an interrupter. |
| Which healing is halved | The Weaver vias `mend`, `chime`, `aura`, `rewind` and `other` are ×0.5 on Brann. `revive`, every shield and every barrier are exempt. The ledger and Bond XP credit what actually landed. | 03 §5. Shields are his answer. |
| Lifesteal | A new `HealVia 'lifesteal'`, with `source` = Brann:<br>• no ledger credit, Bond XP or healing threat;<br>• not halved by Blood Rage;<br>• not a Fermata save, and **blocked while he is held**;<br>• cut by Wound, Bloodmoon and Wounding Strikes. | Proof of support stays honest (the 'solo'/'self' pattern, `health.ts:472`). Blocking it during a hold stops a hero reaching 30% life and then being downed on release. |
| Blood Rage and Berserker's Hymn attribution | **The heroes' own damage**, including on Flourishes. | The Last Light precedent. `flourishHit` is fixed so the Weaver's amplified share doesn't absorb rage. |
| Bloodlust scope | Below 40% life (unless he has Iron Will and is Warded) Brann **ignores Rally** and has **no leash**. He always obeys Hold and Scatter. He never kites and never dodges (`dodge 0`, so he draws no `rng.ai`). | The plan's 'never retreats, ignores Rally'. Hold stays the Weaver's deliberate tool. |
| Fermata and Brann | Unchanged rule: any Weaver heal during the hold saves him, halved or not. A Ward does not. This is taught in the Codex, his Needs line and a hint. | `releaseHold` saves on `savedBy` (`health.ts:468-476`). One Mend tick is enough, so Fermata is a real Brann tool. |
| Harmony mechanism | **The minimal form:** `MotifDef.requires.motifs?: Id[]` (every listed motif owned), checked in `eligible()` before any RNG. It is checked **only at offer time**: losing a prerequisite later keeps the Harmony. Blood and Silk is category `bond`, rarity `epic`, tagged `harmony`. Draft and shop cards for a prerequisite show a UI-only 'would enable' hint. | A real Harmony tier needs changes to MOTIF_PRICE, RARITY_RANK and draft weights, so it belongs to the Harmonies slice. The hint makes this one Harmony findable. |
| Blood and Silk mode | It counts **only while you Empower him** (Empower-mode Thread on Brann below 30%). | A Mend Thread would lift him out of the condition within seconds and switch the Harmony off. |
| Blood Tithe numbers and placement | Rare, `values [50, 60, 70]` (Ward strength +%), with a fixed refund of 10 Spirit.<br>• It applies to Wards through the main `castWard` path, so the plain Ward and the variants that go through `addShield` there. It does **not** apply to Chorale or Aegis Link, which return early (`techniques.ts:136-139`).<br>• The refund lives in **one place**: `removeShield(…, broken=true)` when `shield.tithe`. That covers breaks and Perfects, but not expiry.<br>• Under Eldritch Conduit it converts by the same rule as the Perfect refund (`techniquesCostLife`, `telegraphs.ts:480`). | The motif text allows one `{v}`. One refund site means one rule. |
| Brann's alternate Solo | **Blood Brother:** for 6 s his lifesteal heals the hero you Thread instead of him (via `solo`). While it runs he gets no lifesteal. | The Bonds lint and UI require an alternate Solo. It inverts him again: protect the berserker while he heals. |
| Deed | **In the Red** (`in_the_red`), a 0-point badge: beat Vharun with Brann in the party, never letting him climb above 40% once he first falls to it. It is scoped to the fight. It shows on the Deeds screen only once Brann is in the roster. | The plan's 'Win with Brann never above 40% HP'. Between-fight heals aren't the Weaver's choice. The ladder keeps exactly 10 point Deeds. Renamed so it can't be confused with the Red Line archetype. |
| Decree texts and answers that assume Kael | **No hashed text is edited.**<br>• The Cantor Requiem and Twin Cleave attack defs gain an optional `decreeNoDome` text. The HUD shows it when `partyHasDome(party)` is false.<br>• Every 'dome' answer glyph, recap answer and SAVE_HOW line is filtered by the same helper.<br>• The Execution decree is rewritten in the HUD when Brann is the condemned hero. | `encounter.decree` and telegraph answers are hashed (`feedback.ts:72`, `state.ts:531`). The HUD matches the decree text to its attack def, so no regex is needed. |
| Colour | `#b91c1c`, heroInk `#d26b6b`, plus a **brass trim** (`#c8a46e`) on his axe edge and collar. His colour never fills a danger channel. | It is ≥ 44 ΔE from every other hero and from threat. No saturated crimson clears 20 ΔE from lethal and Bear in every vision, and the Spire is crimson, so silhouette, trim and voice carry his identity. |
| Health alarms on Brann | His frame shows LIFE_OK above 40% and an ember **raging band** from 40% down to 15%, with no 'hurt' tier. Critical applies below 15%, when he is **falling fast** (more damage in the last ~2 s than his remaining life), or when a lethal hit is incoming. Ticks mark 40/30/15/10. The default heroes are unchanged. | The shared alarms would teach players to heal him. 10% (125 HP) is too thin for damage that isn't telegraphed. |
| Bloodletting presentation | Its own channel: a crimson drain segment on the bar, a '−150 Bloodletting' floater in his ink, and a 'Bloodlet ×3' chip. No flash, no alarm, and it is not counted as falling fast. | A drop the player didn't cause must not read as damage. |
| Profile and saves | **No PROFILE_VERSION bump.** The keys `recruited?` and `lastParty?` are optional v9 keys, absent until used. Run saves change only through an optional `blood` on result heroes. | `preludeSnapshot.test.ts:172` pins v9. `migration.test.ts:291,300` compare against `newProfile()`. |
| Pools | **No Brann relics and no new events.** The Cell is edited in place. | `rollRelics` has no hero filter. A new M2 event would move `map:m2`. |
| Bond XP for a late recruit | Brann earns **×2 Bond XP** until his rank reaches the lowest starter's rank. This is meta-only. | A recruit starting at rank 0 against rank-9 starters would otherwise stay behind for good. Default parties are unaffected. |
| Novice bot | **Unchanged**, with no new draws. Its Lyra lookup gains a guard if it can throw. | Its heal-the-lowest reflex is what Brann punishes. |
| Autonomy | Red Frenzy uses the generic `cueGrace` path. There is no desperation rule. | The Kael rules key on `aegisWall`. |
| Bots seeing motifs | `mods` is exposed on `WorldState` (type-only). | `World` already carries `mods`, and mods aren't hashed. |
| Training Grounds | Stay on the default party. | Zero risk to the tutorial. |

## Engineering ground rules (the Movement I contract)

5a's five rules apply unchanged. This slice adds seven:

1. **Absent, not undefined, for Brann.** Every new hashed field is optional and is set only for a hero whose def has `passive`:
   - the hero's `blood?: BloodState`;
   - the shield's `tithe?: true`;
   - the down record's `blood?`.

   The spawn literal (`world.ts:922-998`) gains no always-present key; it spreads `...(def.passive ? { blood: newBlood() } : {})`. Deathless reuses `unbreakableUsed`, which Brann can never need for Unbreakable because that is Kael's talent.
2. **Guards, not rewrites, on shared hot paths.** Every hook is an early `if` that is false for Kael, Lyra and Vexis. Existing floating-point products are never reordered or split, and every new factor is applied as `if (k !== 1) x *= k`. Kael's tank branches (`heroes.ts:304, 448`) are never generalised; Brann gets `role === 'berserker'` branches.
3. **Content is appended.** Brann goes after Vexis everywhere. The two new motifs go after the last motif, and In the Red after the M2 badges. The starters' defs, barks, talents, scenes and motifs, and every decree text, are left as they are. The only edits to existing defs are **new optional keys**: `decreeNoDome` on two attacks and the Cell's recruit and texts. `CONTENT.defaultParty` stays `['kael','lyra','vexis']`.
4. **Hero-gated pools filter before RNG.** Blood Tithe and Blood and Silk carry `requires.hero:'brann'` and are dropped in `eligible()` before `makeDraft` and `makeShop` draw. A lint rule makes every motif with `requires.motifs` hero-gated.
5. **An explicit default equals an implicit default.** `resolveConfig({seed})` and `resolveConfig({seed, party:['kael','lyra','vexis']})` hash equal. `newRun`, `runStore.newRun` and `embark` produce byte-identical RunStates for the default party, whatever the roster.
6. **Characterisation before behaviour (W0a).** These are committed before any content lands:
   - the eight hash literals;
   - an M2 harness baseline;
   - an Expedition baseline;
   - a draft and shop snapshot;
   - a bot command-stream snapshot;
   - a snapshot of the default-party hero component and shield **key sets**.
7. **Pure rules are shared, not copied.** `bloodlusting`, `weaverHealCut`, `bloodRageBonus`, `fallingFast` and `partyHasDome` exist once. They are read-only, exported from `src/sim/index.ts` or `src/content/index.ts`, and used by the sim, the bots, render and the UI.

**Brann between W0 and W1.** The interim behaviour is stated so nothing calibrates against it. With W0's stubs, Brann falls into the ranged branch of `combatMove` (formation anchor, kite, RANGED_LEASH). His unknown ability kinds fall through and cast nothing, and the passive does nothing. That is harmless for the default party. **No band, golden or bot test may be recorded against a Brann party before W1 merges.**

## Brann, the Bloodsworn (`brann`)

*A Legion champion who refused to execute prisoners, and was collared and chained for it. He is calm only in pain.* Role `berserker` (already in `HeroRoleSchema:232` and `ROLE_LABEL`, `labels.ts:190`).

### Stats

These are code numbers, scaled like Kael's: his plan sword of 85 ships at 76.

| Field | Value | Note |
|---|---|---|
| maxHp | **1,250** | plan |
| armor | **0.25** | W7 tuning: 0.15 → 0.25, the lever's ceiling (see *Measured bands*). Armour softens ordinary hits only, never telegraphs. |
| moveSpeed | 7.4 | above the Weaver's 6.5 (lint `schema.ts:1563`) |
| radius / height | 0.7 / 2.1 | |
| formation | `{forward: 2.0, right: 1.9}` | front-right. It is **1.99 m** from Kael `{2.6, 0}` and ≥ 4.2 m from the rangers `{-2.2, ±2.6}`. New lint: spots are pairwise ≥ 1.5 m apart. |
| attack | `melee`, 84 per 1.3 s, range 2.4, `projectileSpeed 0`, `chain 0` | the axe |
| attack.cleave | `{arcDeg: 120, radius: 2.8, pct: 0.5}` | every other enemy in the frontal arc takes 50% |
| preferredRange | 1.4 | |
| threatMult | **1.5** | Kael (3) keeps aggro when he is present. Without Kael, Brann is the front line. |
| dodge | **0** | draws no `rng.ai` (`heroes.ts:986`) |

**Needs** (new optional `HeroDef.needs`, shown in Prep and the Codex, Brann only): 'Kept low but alive: Wards and barriers, not heals · Fermata holds him: one Mend tick saves him · Reel him when he won't Rally · Cue Red Frenzy to heal him.'

### Passive: Blood Rage

`passive: {id:'bloodRage', perMissing: 1, maxBonus: 0.8, lifesteal: 0.06, weaverHealMult: 0.5}` (lifesteal 0.08 → 0.06 in W7 tuning, see *Measured bands*)

- **Damage.** `heroDamage()` (`heroDamage.ts:30`) computes `own = ownScale(world, hero)`. That is Blood Rage, `1 + min(cap, perMissing × (1 − hp/maxHp))` with `cap` = 0.8 (1.0 with Red Mist), multiplied by Berserker's Hymn where it applies. When `own !== 1`, `base *= own` is applied before every amplifier. `HeroHit` gains `own?: number`, present only when it isn't 1. `flourishHit` (`heroDamage.ts:89`) becomes `amplified: max(hit.amplified, hit.amount − (hit.own ? base × hit.own : base))`, so rage and the Hymn are never counted as the Weaver's. Default heroes take the untouched path.
- **Lifesteal.** In the hero-hit block of `dealDamage` (`health.ts:832-858`), when the source has `blood`, `onBloodHit` does `heal(source, dealt × lifesteal × (cued Red Frenzy ? 3 : 1), 'lifesteal')`.
  - `heal()` with `'lifesteal'` returns 0 while `hero.hold` is set.
  - It applies healing-received cuts as usual.
  - It does not emit `healApplied` per hit. It adds to `blood.stealAcc`, and `tickBlood` flushes one `healApplied {via:'lifesteal', source: brann.id}` every 0.5 s.
  - During Blood Brother the heal goes to the threaded hero via `solo` instead.
- **Weaver healing ×0.5.** In `heal()`, right after the Wound/Bloodmoon cut and before Bulwark of Faith: `const cut = weaverHealCut(world.content, target, via); if (cut !== 1) amount *= cut`. The cut applies to Weaver vias only and is lifted by Blood Oath. With Bloodmoon outside a pool it is ×0.25; with Wound as well, ×0.125. The Codex says so.
- **Falling fast.** `tickBlood` keeps `blood.bleedRate`, an exponential average of damage taken per second (τ = 2 s; Bloodletting excluded). `fallingFast(e) = 2 × bleedRate ≥ hp`. It feeds his critical gate in the HUD, render and audio.

### Abilities, Call and Flourish

| Ability | Numbers | AI rule |
|---|---|---|
| **Sunder Leap** `sunderLeap` | cd 10, castTime 0, damage 120 in r 3, stun 0.5, range 9, `minRange 4` | Leaps at the nearest enemy 4-9 m away, preferring the Focus target, then an interruptible caster, then his own target. He does not leap while Held. He lands 1.2 m short, through `clampToArena`/`resolveObstacles`. Emits `attackFired {visual:'leap', source: brann, from, to}`, the existing enemy-leap event, and `abilityUsed`. Calls `interruptEnemy` on interruptible casters within the radius (the Shield Bash pattern, `heroes.ts:772`). |
| **Bloodletting** `bloodletting` | cd 14, `lifeCost 0.12` (150; 0.1 before W7 tuning), `lifeFloor 0.2`, `hits 3`, `hitBonus 0.4` | Only above 50% life, with an enemy in reach. He loses `min(150, hp − 0.2 × maxHp)` directly. This is not damage: no ledger, threat, Fermata, recap, bleedRate or Deathless. His next 3 swings get +40% and cleave 360°. Emits `lifeSpent {hero, amount}`. |

- **Call** (`call.ability: 0`, answer `ward`, answerTime 2.0). It opens only when a Sunder Leap target 4-9 m away exists. `canCall` (`calls.ts:37`) gains a check for abilities with `minRange`. A call whose target vanishes expires as today (`LINGER`).
  - Lines: 'Ward me — I'm going in!', 'Shield on me, Weaver, then watch!', 'Cover me. I'm jumping.'
  - Thanks: 'Ha! Blood!', 'Now I fly!', 'Into them!'
  - The Call prompt shows his name and 'B' disc, so it can't be mistaken for Kael's Ward call.
- **Flourish: Red Comet.** `damageMult 1.6, radiusMult 1.5, stun 1.0`, using existing fields. Text: 'Ward Brann while he calls: his Sunder Leap lands half again as wide, hits 60% harder and stuns for a second.'

### Solo: Red Frenzy (`redFrenzy`)

- `chargeTime 25`, `duration 5`, `power 0.6` (pulse damage as a share of his axe hit, through `heroDamage`, so rage applies), `cuedPower 3` (the lifesteal multiplier), `radius 3.5`, `pulse 0.5`. The last two are new optional `HeroSoloSchema` fields.
- A pulse loop in `updateSolo` on `soloPulseAt`. Each pulse hits every enemy within 3.5 m and emits `attackFired` with visual `cleave`.
- **Not rooted:** he keeps chasing but doesn't swing his axe.
- **Cued:** lifesteal ×3.
- Text: 'Brann spins into a whirlwind for 5 s, cutting everything around him.' Cued: 'Cued: his axe drinks three times as deep — it heals him where your healing can't.'

### Quirk: Bloodlust (`bloodlust`, `below: 0.4`)

`bloodlusting(content, e)` is pure and stores nothing. It is true when the hero has `blood`, `hp < below × maxHp`, and not (Iron Will and holding a `ward` shield). While it holds:

- The Rally checks at `heroes.ts:300` and `:440` are skipped for him.
- When a Rally starts that he refuses (`blood.refusedRally !== world.internal.rallyUntil`), he emits `bloodlust {hero}` and **one** `defiant` bark (cosmetic RNG, Brann-only), and stores `refusedRally`.
- The berserker branch drops its leash.

The berserker branches:

- **`combatMove`:** chase to reach, with no kite and no flank. `BERSERKER_LEASH` is 11 when he is not bloodlusting, with no leash when he is.
- **`chooseTarget`:** the nearest enemy, sticky while it is in reach. The Focus target always wins.

The Rally setter (`commands.ts:91-96`) is untouched.

Description: 'Below 40% life, Brann won't come back for a Rally and never gives ground.'

### Barks

There are 7 standard categories plus an optional `defiant` category. `bark()` (`feedback.ts:20`) returns early when a category is missing or empty. Every bark draw happens on a Brann-only path.

| Category | Lines |
|---|---|
| quirk | 'More!', 'Blood calls!', 'Don't hold me back!' |
| lowHp | 'Now I'm awake.', 'This is where I fight best.', 'Closer to the edge…' |
| saved | 'Not yet, then.', 'You keep me just short of it. Good.' |
| perfect | 'Ha! It barely touched me!' |
| cued | 'Red Frenzy!', 'Stand clear!' |
| downed | 'Brann is down!', 'Not… like this…' |
| revived | 'Again.', 'The war song isn't done.' |
| defiant | 'I don't run!', 'Rally yourself!', 'They're bleeding — I stay!' |

**Codex:** 'A Legion champion who broke his oath rather than kill prisoners. Brann is calm only in pain: the lower his life, the harder his axe falls, and it drinks from what it cuts. Your healing barely takes on him; your Wards do. Fermata still holds him — one touch of the Thread saves him.'

### Bonds (appended to `src/content/bonds.ts`)

| Rank | Talent | Values | Text | Sim hook | `talentFired` |
|---|---|---|---|---|---|
| 3 | **Iron Will** `iron_will` | `{pct: 40}` | 'While your Ward holds him, Brann answers a Rally even below {pct}% life.' | `bloodlusting()` is false while he holds a `ward`. | yes, when a Rally he would refuse is obeyed |
| 3 | **Red Mist** `red_mist` | `{max: 100}` | 'Blood Rage can reach +{max}% damage.' | the cap in `ownScale` | no (a number) |
| 6 | **Blood Oath** `blood_oath` | `{cap: 25}` | 'Your healing on Brann is no longer halved, and what overheals him, up to {cap}% of his life, rides on his next swing.' | The ×0.5 is skipped. Overheal from Weaver vias goes into `blood.oathBank` (capped at 25% of max HP) **after** Overflowing Grace takes its share (`health.ts:459-461`), so the two never both spend the same overheal. The next axe hit adds the bank to its primary target after `heroDamage`. | yes, when the bank is spent |
| 6 | **Scar Tissue** `scar_tissue` | `{pct: 30}` | 'Your barriers on Brann are {pct}% stronger.' | `addShield` (`fromWeaver`, including Kael's Cued dome, `solos.ts:66`, which counts as yours) and the Ostinato refill's `max` (`field.ts:320-324`). | no |
| 9 | **Deathless** `deathless` | `{pct: 10, seconds: 3}` | 'The first time Brann falls to {pct}% life in a fight, he can't die for {seconds} s.' | See *Deathless* below. | yes, when the window starts |
| 9 | **Berserker's Hymn** `berserkers_hymn` | `{below: 30, pct: 15}` | 'While Brann is below {below}% life, every hero deals {pct}% more damage.' | `ownScale`, gated by `talentHolder(world,'berserkers_hymn')`. It counts as each hero's own damage. | yes, when it turns on |

**Deathless.**

- **Trigger.** After damage is applied in `dealDamage`, if Brann has the talent, `!unbreakableUsed`, and `hp ≤ 10%` (including a lethal blow, which is clamped to 1 first):
  - set `unbreakableUsed`;
  - set `blood.deathlessUntil = time + 3`.
- **During the window.** `dealDamage` clamps him at 1 HP. The damage still counts, so Blood Rage peaks.
- **Fermata.** Fermata's lethal hold (`health.ts:751-760`) still runs first. It is the Weaver's Save, and it starts Deathless too, because he is held at 1.
- **On release.** `releaseHold` (`health.ts:1186`) checks `deathlessActive(e)` before `unbreakable()` and `downHero`, so an unhealed hold inside the 3 s does not down him.

**Alternate Solo (rank 10): Blood Brother** `blood_brother`

- `chargeTime 25`, `values {seconds: 6, pct: 16, cuedPct: 8}`.
- Text: 'For {seconds} s, Brann's axe feeds the hero you Thread: {pct}% of his damage heals them instead of him.' Cued: 'it heals every hero in your field, {cuedPct}% each.'
- The heal is via `solo`, so it isn't cut. He gets no lifesteal while it lasts.

**Scenes** (rank 2 and rank 7, two replies each):

- **The Collar** (`brann_collar`). By the fire he works at the iron collar the Legion welded on him. He sang the war song for Vharun for nine years. The day he was told to cut down the Spire's prisoners, he cut his own palm instead and swore on the blood.
  - 'Let me help with that.' → 'Leave it. I want to remember what it cost.'
  - 'You chose them over yourself.' → 'I chose. That's the part they couldn't take.'
- **The War Song** (`brann_war_song`). He hums the song from the cell. It is meant for a whole Legion, and alone it sounds like grief. The replies offer the Weaver's own song.

`KNOWN_TALENTS` and `KNOWN_ALT_SOLOS` gain these ids in content order. `resolveBonds` is party-filtered, so default parties resolve identical Bonds.

### Bond motif: Blood Tithe (`blood_tithe`)

`{category:'bond', rarity:'rare', values:[50,60,70], requires:{hero:'brann'}, tags:['shield','ward']}`. Text: 'While Brann is below 40% life, your Wards on him are {v}% stronger and give back 10 Spirit when they break.'

- **Mods:** `bloodTithe`, `bloodTitheRefund 10`.
- **`castWard`** (main path only, `techniques.ts:140-141`): if the target is Brann below 40%, the amount is ×(1 + bloodTithe) and the shield gets `tithe: true`. A Ward on Brann is 495 normally and **742** with the Tithe at level 1.
- **Refund:** inside `removeShield` when `broken && shield.tithe`. It refunds Spirit capped like `telegraphs.ts:481`, or converts under Conduit, and emits `titheRefund`.

### Harmony: Blood and Silk (`blood_and_silk`)

`{category:'bond', rarity:'epic', values:[3], requires:{hero:'brann', motifs:['blood_tithe','taut_release']}, tags:['harmony','thread','resonance']}`. Text: 'While Brann is below 30% life and you Empower him, your Thread makes {v} Resonance a second.'

- **Sim hook.** In `updateThread`: when threaded on Brann in Empower mode, below 30%, and `mods.bloodAndSilk > 0`, it calls `gainResonance(world, v × dt, 'blood_and_silk', true)`.
- **Offer.** It is offered only when both prerequisites are owned. Once owned, it stays even if a prerequisite is lost later.
- **Lint.** Every `requires.motifs` id must exist and must not be the motif itself.
- **UI.**
  - The card shows a 'Harmony' ribbon.
  - When Brann is in the party, the Blood Tithe and Taut Release draft and shop cards show 'Harmony: with ⟨the other⟩ → Blood and Silk'.

### Deed: In the Red (`in_the_red`)

`{points: 0, test: 'heroCeiling', hero: 'brann', encounter: 'vharun', values: {pct: 40}}`. Text: 'Beat {encounter}, with {hero}, never letting him above {pct}% life once he first falls to it.' The comma after `{encounter}` closes the appositive in 'Vharun, the Crimson Warden', so the shown line reads 'Beat Vharun, the Crimson Warden, with Brann, …'.

- `blood.peakAfterLow` is −1 until he first drops to `quirk.below` or lower. From then on it is the running maximum of hp/maxHp. It reaches `EncounterResult.heroes[i].blood.peakAfterLow`.
- `deedHolds('heroCeiling')` needs a victory over the encounter, the hero in the result, and `0 ≤ peakAfterLow ≤ pct/100`.
- `DEED_TESTS`, the exhaustive needs Record (`schema.ts:1676`), the `{hero}` placeholder and `deeds.ts` all gain the case. The Deed count goes from 22 to 23.
- `deedsInSight(seen, roster?)`: hero Deeds show only when `roster` is passed and includes the hero. Without `roster`, the result is today's, so `e2e/smoke.spec.ts:727` holds.

## The roster

### Recruitment

- **Content.** The `fight` EventEffect gains `recruit?: Id`. The Cell's 'free' choice becomes `{kind:'fight', encounter:'legion_vanguard', relics:3, recruit:'brann'}`.
  - New text: 'An elite fight. Win, choose one of 3 relics, and the prisoner joins your heroes for your next runs.'
  - The choice gains two optional texts:
    - `recruitedText`, shown once Brann is in the roster: 'An elite fight. Win, and choose one of 3 relics.'
    - `partyText`, shown when Brann is in the party: 'Brann stops at the bars of his old cell. "Someone else is in there now. Open it."'
  - The texts are chosen in `interlude.ts` and `EventScreen.tsx` and draw no RNG. The choice order, event id and position stay as they are.
- **The rule.** `HeroDef.recruit = {event:'bloodsworn_cell', fallback:'vharun'}`. `recruitsOf(run): string[]` is pure and **scans `run.results`**, so it survives `toMap()` setting `event: null` (`run.ts:1165`). It recruits a hero in two cases:
  - a victory whose `nodeId` resolves (`findNode`) to an event node whose event's fight effect has `recruit`;
  - any result, won or lost, whose encounter is a hero's `recruit.fallback`.
- **App.** `runStore.finishCombat` and `resume` call `useProfile.getState().recruit(Run.recruitsOf(run))`. `recruit` is idempotent:
  - it does nothing, with no commit and no write, when nothing is new;
  - otherwise it writes `profile.recruited` in content order and pushes onto `recruitNotices`, which works like `bondNotices`.
- **Copy.**
  - The event fight's Result screen reads `recruitNotices` and shows a gain line with his portrait: 'Brann, the Bloodsworn, will fight beside you from your next run.' After the fallback: 'In the chaos of your stand against Vharun, the prisoner slipped his chain. He'll find you before your next run.'
  - The next Prep shows him in FreshStrip, using `profile.introduced` 'hero.brann'.
  - His Codex entry unlocks.
  - His first fight shows a one-time 'New ally' callout (`ally:brann`): halved healing, Ward him, Fermata still saves him.
  - The locked Codex silhouette reads: 'Free him from the Legion's cell in Movement II, or face Vharun.'

### Choosing the party

- **`heroRoster(profile, all)`** is `defaultParty` ∪ `profile.recruited`, in content order. When `all` is true it is every hero. The store exposes it as `profileStore.roster()`. UNLOCKS gains nothing.
- **`Run.setParty(run, ids, roster)`** works in Prep only. It requires exactly 3 distinct known roster heroes and returns them in **canonical content order**, each `{hpPct: 1, shaken: false}`. When nothing changes it returns the same object.
- **`runStore.setParty(ids)`** checks the roster, applies `Run.setParty`, re-follows Bonds with `Run.setBonds(run, profileBonds(newParty))`, and calls `setLastParty`. The key is deleted for the default party.
- **`runStore.newRun`** starts from `lastParty` when it is entirely in the current roster, otherwise from `defaultParty`. It calls `setParty` only when the party differs from the default.
- **Embark.** `Run.embark(…, roster = allHeroIds())` takes a **permissive default**, so the harness's `playRun` keeps its `opts.party`. On a fallback, where a party hero is not in the roster, it switches to `defaultParty` and drops `run.bonds` entries for heroes no longer in the party. `runStore.embark` does its own fallback **before** `setBonds`, so the Bonds are re-followed properly.
- **`RunActions.setParty(heroIds: string[]): void`.** W0 adds it together with an identity stub in `runStore`.

### Every 'three named heroes' system, party-generic

| System | With any 3 of 4 |
|---|---|
| Sim | The party comes from `SimConfig.party`. Brann-only state exists only with Brann. The Kael-keyed code (`aegisWall` autonomy, Riposte Bash, Oathkeeper, Bulwark's Echo) already tolerates Kael's absence. `randomNonTank` and the Spellbound diver rule stay as they are. |
| Enemy targeting and taunts | Threat, as today. Only Kael taunts. Without him Brann leads, so Twin Cleave (target 'current') and Execution (lowest share) usually land on Brann. Both are answered with Wards and Reels. |
| Formation | Spots are per def. Brann has his own; none moves. |
| Bonds | `profileBonds` and `runBonds` are generic. `bondXpForFight` shares over the actual party, with Brann's catch-up. `bondedHeroes()` stays for validation. Every display uses `rosterHeroes`. |
| Respite scenes | `bondScene` and `scenesWaiting` iterate `run.party`. |
| Deeds | Per result. In the Red shows only once Brann is in the roster. |
| Motifs and Harmonies | The hero and motif gates in `eligible()` run before RNG. |
| Summary, Result, Timeline | Generic over slots. The party is fixed for the run. Brann's lines come from `heroes[i].blood`. |
| Recaps | Every 'dome' answer and SAVE_HOW line is filtered by `partyHasDome`. Brann-specific wording is in *Recaps*. |
| Counterfactual | The same config with `absent: true`. Brann's passive doesn't depend on the Weaver. |
| Autonomy | The generic `cueGrace`. |
| Bots | Keyed on `defId` and `role`. The Lyra lookups keep their branch and gain a fallback only when Lyra is absent. |
| HUD | Frames follow slots and show key numbers. The decrees and the dome glyph follow `partyHasDome`. |
| Codex | A locked silhouette for heroes not in the roster, on the Heroes and Calls pages and on motif chips. |
| Training Grounds | Default party. |

## Saves and profile

- **Profile (v9, no bump).**
  - `ProfileSchema` gains `recruited: z.array(Str).optional()` and `lastParty: z.array(Str).optional()`, with no `.default` and no `.catch`.
  - `loadProfile` filters both to known `CONTENT.heroes`. It drops `lastParty` unless it is exactly 3 distinct heroes, stores it canonicalised, and deletes empty keys.
  - Roster membership is **not** checked at load, because 'Skip the unlocks' lives in settings (`profileStore.ts:211`). `newRun` checks it.
  - `newProfile()` gains no key.
- **Run save.** There is no party schema change, and `compatibleWithContent` already accepts any known id.
  - `ResultSchema.heroes[]` gains an optional `blood`.
  - In-flight v5 runs from 5a load and finish unchanged.
- **CombatOutcome.** `party[i].blood?` is filled from `hero.blood` in `buildOutcome` (`src/app/outcome.ts`, also used by `harness-core.ts:447`). It is copied into `EncounterResult.heroes[i].blood` (`run.ts:1847`) only when present.

## Recaps for Brann's downs

The sim's down record gains an optional `blood: {refusedRally: boolean, healCut: number}`, set only for Brann. `refusedRally` is true when a refused Rally was still live at the down. `healCut` is the Weaver-heal multiplier at that moment. W0 carries it out of the sim: `DeathRecap.blood?` (`src/meta/types.ts`) and the saved `ResultSchema.deaths[].blood?` (`src/meta/save.ts`), copied in `run.ts` only when present, so a resumed run keeps it and every other death is unchanged. `run.ts` recap wording, in priority order:

1. **A refused Rally:** 'He wouldn't Rally below 40%: Reel him, or Ward him so Iron Will brings him back.'
2. **A heal cut of 0.25 or less (Bloodmoon):** 'Your healing on him was quartered outside the pool: Ward him or give him a barrier.'
3. **Twin Cleave with no dome in the party:** 'Two blows on Brann: Reel him, or Ward him twice.'
4. **Otherwise** the generic answers, without the dome when no dome hero is present.

## Bots and harness

**Skilled bot.** It owns an Rng already (`skilled.ts:83`), and this slice adds **no new draws**. Every new branch is an early `if (brann)`. Without Brann, every comparison and sort is byte-identical (checked by W0's command-stream snapshot).

| Situation | Skilled with Brann |
|---|---|
| Thread target (`:293-328`) | A per-hero need key. Brann counts as healthy (1.0) while `effectiveFraction ≥ BRANN_FLOOR 0.25`, he isn't `fallingFast`, and no lethal hit is on him. |
| Ward (`:147-187`) | Below 40% with a big hit coming within 1.5 s: Perfect-Ward Brann first. With Blood Tithe (`state.mods.bloodTithe > 0`): Ward him whenever he is below 40%, unwarded, and no Perfect is pending elsewhere. |
| Execution on Brann | Ward or Reel, never Mend. |
| Fermata hold on Brann | One Mend tick on him at once. Any heal saves. |
| Cues (`:364-377`) | Cue Red Frenzy when Brann is below 40% with ≥ 2 enemies within 3.5 m, or in a boss fight. It is not added to GUARDING. |
| Crescendo | Brann is left out of the party average. |
| Bloodmoon and Rally | A bloodlusting Brann is left out of 'anyone outside the pool'. He is Reeled in instead. No more than 1 Rally per 8 s while he is bloodlusting. |
| Twin Cleave with no dome | Reel is reserved for the second blow (Reel cd 14 < Twin Cleave cd 16), and Brann is pre-Warded before the first. |
| Blood and Silk | When it is owned, Brann is below 30% and no other hero is below 50%: Empower-Thread Brann. |
| Berserker's Hymn | Brann's healthy band is 0.15-0.30 instead of ≥ 0.25. |
| No Lyra | Discord shields: Empower the non-tank hero with the highest damage. Guards: Focus and flank. Idle Empower falls back to the first non-tank. |
| No Kael | The `kaelAwaySince` rule is inert. |

**Novice bot:** unchanged. If `novice.ts:108`'s `party.find(lyra)` can throw without Lyra, a guard is added, with no draw. A test checks that it does not throw.

**Harness** (`tools/harness-core.ts`). These three contracts land with W3, which owns `harness-core.ts`; W0 does not touch it:

- **`playRun(…, {party?})`** applies the party through `Run.setParty` in Prep. `embark`'s permissive default roster keeps it.
- **`EncounterRun.brann?: BrannTally`** follows the VerbTally pattern and is absent without Brann. Its fields: `lowShare40`, `lowShare30`, `downs`, `weaverHealOn`, `wardsOn`, `perfectsOn`, `lifesteal`, `lifestealShare` (lifesteal ÷ all healing he received), `silkResonance`, `deathless`, `refusedRallies`, `rallies`.
- **`RunSummary.harmony?`** is present only for Brann parties: `{silkOffered: number, silkOfferedEligible: number, prereqsOwned: boolean}`.
- **`tools/harness.ts --party`.** `tools/bonds.ts --sets` plays each hero's sets with a party that contains that hero.

**Golden scenarios**, appended after `skilled-vharun`:

- `skilled-brann-crimson-gate`: party `kael,vexis,brann`, arrival kit, seed 7474, 2,400 ticks.
- `skilled-brann-bellwarden`: party `lyra,vexis,brann`, no tank. Uses the skilled-bellwarden auras and motifs plus blood_tithe, taut_release and blood_and_silk, and the talents red_mist, scar_tissue and berserkers_hymn. Seed 5252, 3,600 ticks.
- `novice-brann-first-light`: party `kael,lyra,brann`, seed 3131, 1,800 ticks. It covers the Novice's heal-Brann reflex on a Movement I path.

The first of these joins the replay round-trip. W1 also lands its own Brann determinism test: a replay round-trip plus a hash taken in mid-fight, over 3 seeds. The dry run is `npx tsx tools/update-golden.ts` (no `--write`; `npm run golden:update` writes). The written diff may only add these three names and the new contentVersion.

### Bands

The cells are isolated, 50 seeds each, on the Movement's default kit. Three parties are measured:

- **A** = `kael, vexis, brann`;
- **B** = `lyra, vexis, brann` (no tank);
- **C** = `kael, lyra, brann` (no Vexis).

'Default' means the same cell played with the default party in the same run of the tool.

| Cell | Skilled win | Skilled share | Novice win | Idle | Brann (Skilled) |
|---|---|---|---|---|---|
| M1 skirmishes and elites (A, B, C) | ≥ default − 5 pts | ≥ 35% | ≤ default, and ≥ Idle + 30 | in its M1 band | below 40% for ≥ 40% of his alive time; ≤ 0.3 downs a fight; lifestealShare 20-45% |
| Bellwarden, Cantor (A, B, C) | ≥ default − 5 | ≥ 30% | 25-70% | 0% | as above |
| M2 skirmishes and elites (A, B, C) | ≥ default − 5 | ≥ 35% | 5-20 pts under default | as in 5a | as above; ≤ 3 refused Rallies a fight on average |
| Matriarch, Vharun (A, C) | ≥ default − 5 | ≥ 30% | 20-60% | 0% | Execution on Brann spared ≥ 80% |
| **Matriarch, Vharun (B, no tank)** | **≥ default − 15** | ≥ 30% | ≥ 10% | 0% | Twin Cleave on Brann survived ≥ 70% |
| Whole Prelude, 200 seeds (A, C) | ≥ default − 5 | | ≥ 50% of default | 0% | |
| Whole Expedition, 200 seeds (A, B, C) | won ≥ 75% (B ≥ 65%) | | won 8-20% | 0% | |
| Default party, every cell | **identical to the W0 baselines** | | | | |

**The no-tank boss band is decided now.** Without Kael, Twin Cleave (850 × 2) and Execution both fall on Brann, and Bloodlust blocks the Bloodmoon Rally. A Ward on him (495) leaves him alive at full life but not in his designed band. Party B is a harder party by design, and Prep says so: 'No Kael: nothing taunts. Twin Cleave and Execution will find Brann — keep a Reel and a Ward for him.'

If B misses even this band, the levers are used **in this order**:

1. the bot's Reel reservation and pre-Ward;
2. Brann's armour, from 0.15 up to 0.25;
3. Deathless and Iron Will prominence in the hints.

Enemy and encounter numbers never move.

**Other gates:**

- **Bond XP.** With the catch-up off, Brann's Skilled Bond XP per fight is ≥ 75% of the starters' average.
- **The inversion check.** Skilled's `weaverHealOn` share of its support is lower on Brann than on the starters, and its `wardsOn` share is higher. The Novice spends ≥ 1.5× the Skilled's Mend time on Brann.
- **Harmony reachability.** In Brann Expeditions where both prerequisites were owned before the last M2 draft, Blood and Silk is offered ≥ 50% of the time. The overall offer rate is recorded with no target.

**Tuning order:**

1. Brann's own numbers within ±20%: axe, cleave pct, lifesteal 6-10%, Red Frenzy power, Bloodletting cost, threatMult 1.2-2.0, armour up to 0.25.
2. The bot thresholds.
3. Bond and motif values.

### Measured bands

*W7, measured on main after every workstream and fix merged.* Every number below comes from `tools/brann-bands.ts` (new in W7). It plays each cell exactly as `tools/harness.ts` does: Movement I bare with Sostenuto + Fortissimo, Movement II on the arrival kit, and the default party beside A, B and C in the same run. On top of the harness's `BrannTally` it records boss targets, Executions and Twin Cleaves on Brann, the Weaver's Mend time and support per hero, and per-hero Bond XP and Blood and Silk offers over whole runs.

- **Two seed sets.** Cells: 50 seeds from `--seed-base 1000` and from `500003` (seed = base + i × 7919). Whole runs: 200 seeds from `2000` and from `900007` (seed = base + i × 104729). Cell figures read *set 1000 / set 500003*; run figures read *set 2000 / set 900007*.
- **Commands.**
  - `npx tsx tools/brann-bands.ts --movement 1|2 --parties default,A,B,C --seeds 50 --seed-base 1000|500003`
  - `npx tsx tools/brann-bands.ts --runs --movements 1|2 --parties default,A,C|default,A,B,C --seeds 200 --seed-base 2000|900007`
  - `tools/harness.ts --party X --compare --verbose` and `--run --movements 2 --party X` print the same cells and runs, with the run's 'lost at' tally.
- **The default party is untouched.** The 8 golden hashes are byte-identical and SIM_VERSION is 22. `tools/m1-baseline.ts --check`, `--movement 2 --check` and `tools/expedition-baseline.ts --check` are byte-equal. Only `contentVersion` and the three Brann goldens moved.

#### Tuning changes

Only Brann's own numbers changed: **3 numbers, 1 text**. No bot threshold, Bond value or motif value changed, and no enemy, encounter, Movement, Weaver or starter number moved.

| Number | From → to | Why |
|---|---|---|
| `passive.lifesteal` | 0.08 → **0.06** (the floor of its 6-10% lever) | lifestealShare was 38-58%, out of its 20-45% band in 4-9 of 16 cells per party. It is now 28-52%, with at most one cell out per party. With the change below, the mean below-40% time rose 2-3 points (A 17-18% → 20-21%, B 14-15% → 16-17%, C 13% → 15-16%). |
| Bloodletting `lifeCost` | 0.10 → **0.12** (+20%, 125 → 150 life) | The only lever that spends his life on purpose. It shares the 2-3 point rise above (at 16 seeds alone: Crimson Gate A 2% → 5%, Pike Line A 17% → 25%). The ability text now reads '12% of his life'. |
| `armor` | 0.15 → **0.25** (the lever's ceiling; B's lever 2) | Without it, the two cuts above cost whole runs 4-9 points (Prelude A 70 → 62, C 59 → 50; Expedition A 47 → 43, C 53 → 46, on set 2000), because his life carries between fights. With it, C and B are back within noise of where they started: Prelude C 61 (59 before), Expedition C 54 (53) and B 70 (75). A stays lower: Prelude 61 (70) and Expedition 44 (47). Cells moved within noise. Armour softens ordinary hits only, never a telegraph (`health.ts:709-711`), so it cannot touch Twin Cleave, Execution, Toll, Toll Cleave or Requiem. |

**Tried and not kept.** Each was measured at 50 seeds on the losing cells (or 200 runs) and reverted.

- **threatMult 1.5 → 2.0.**
  - Party B is unchanged: the bosses stay on Lyra 93-98% of the time.
  - In party A, 49-55% of Vharun's time moves onto Brann and off Kael. That breaks the design's 'Kael keeps aggro when he is present'.
  - The Skilled win changed by −2 to +10 points, which is within noise.
- **threatMult 1.2.** No gain.
- **Bloodletting cooldown 14 → 11.2.** Below-40% time rose 0-3 points; downs and wins were within noise.
- **Axe 84 → 100, cleave pct 0.5 → 0.6 and Red Frenzy power 0.6 → 0.72 (all +20%).**
  - The losing cells gain 4-14 points (C Glass Gallery 50 → 64, A Shattered Choir 74 → 84), and Expedition A gains 44 → 52.
  - None of those bands is reached.
  - lifestealShare climbs above 45% in 3-7 cells per party.
- **Bot thresholds** (Brann-only, `src/bots/skilled.ts`):
  - Twin Cleave's pre-Ward and Reel reserve when Kael's dome isn't charged, not only without Kael;
  - a near-lethal hit on Brann ranked with his 'first' hits;
  - the last Ward charge held when Twin Cleave is due within 3 s and Brann is in its reach;
  - the Mend lift past his floor, 0.1 → 0.05 and 0;
  - `BRANN_FLOOR` 0.25 → 0.2.

  Twin Cleave survival stayed 21-40% against 26-43%. The Mend-lift changes cut the Skilled's Mend time on Brann by 1-2 s a fight but added up to +0.6 downs at the Bellwarden. None moved a band, so the bot is as W3 left it.
- **Bond and motif values.** None was changed. No band reads Blood Tithe's, Blood and Silk's or a talent's values. Harmony reachability is an offer rate, and it is met.

#### Band summary

'Cells' rows count the cells that meet the band out of the group. The no-tank boss band is the *(no tank)* rows.

| Band | Target | Party | Set 1000 | Set 500003 | Result |
|---|---|---|---|---|---|
| M1 skirmishes and elites: Skilled win | ≥ default − 5 | A | 5/7 cells (missed: muted_nave -34, shattered_choir -16) | 4/7 cells (missed: choir_loft -8, muted_nave -28, shattered_choir -16) | **missed** |
| M1 skirmishes and elites: Skilled win | ≥ default − 5 | B | 6/7 cells (missed: glass_gallery -6) | 7/7 cells | **missed** |
| M1 skirmishes and elites: Skilled win | ≥ default − 5 | C | 5/7 cells (missed: glass_gallery -42, muted_nave -8) | 6/7 cells (missed: glass_gallery -44) | **missed** |
| Bellwarden, Cantor: Skilled win | ≥ default − 5 | A | 2/2 cells | 2/2 cells | met |
| Bellwarden, Cantor: Skilled win | ≥ default − 5 | B | 2/2 cells | 2/2 cells | met |
| Bellwarden, Cantor: Skilled win | ≥ default − 5 | C | 1/2 cells (missed: hollow_cantor -32) | 1/2 cells (missed: hollow_cantor -20) | **missed** |
| M2 skirmishes and elites: Skilled win | ≥ default − 5 | A | 6/7 cells (missed: blood_forge -10) | 5/7 cells (missed: shield_wall -6, blood_forge -16) | **missed** |
| M2 skirmishes and elites: Skilled win | ≥ default − 5 | B | 7/7 cells | 6/7 cells (missed: shield_wall -6) | **missed** |
| M2 skirmishes and elites: Skilled win | ≥ default − 5 | C | 7/7 cells | 7/7 cells | met |
| Matriarch, Vharun: Skilled win | ≥ default − 5 | A | 1/2 cells (missed: vharun -24) | 1/2 cells (missed: vharun -36) | **missed** |
| Matriarch, Vharun: Skilled win | ≥ default − 5 | C | 2/2 cells | 2/2 cells | met |
| Matriarch, Vharun: Skilled win (no tank) | ≥ default − 15 | B | 2/2 cells | 2/2 cells | met |
| Skirmishes and elites: Skilled share | ≥ 35% | A | 40%–49% | 39%–50% | met |
| Skirmishes and elites: Skilled share | ≥ 35% | B | 41%–47% | 41%–48% | met |
| Skirmishes and elites: Skilled share | ≥ 35% | C | 40%–54% | 39%–54% | met |
| Bosses: Skilled share | ≥ 30% | A | 40%–47% | 41%–47% | met |
| Bosses: Skilled share | ≥ 30% | B | 36%–44% | 35%–45% | met |
| Bosses: Skilled share | ≥ 30% | C | 42%–51% | 42%–51% | met |
| Bellwarden, Cantor: Novice win | 25–70% | A | 22%–26%; 1 of 2 out | 22%–26%; 1 of 2 out | **missed** |
| Bellwarden, Cantor: Novice win | 25–70% | B | 38%–42% | 30%–42% | met |
| Bellwarden, Cantor: Novice win | 25–70% | C | 6%–28%; 1 of 2 out | 14%–24%; 2 of 2 out | **missed** |
| Matriarch, Vharun: Novice win | 20–60% | A | 2%–18%; 2 of 2 out | 0%–14%; 2 of 2 out | **missed** |
| Matriarch, Vharun: Novice win | 20–60% | C | 12%–16%; 2 of 2 out | 4%–26%; 1 of 2 out | **missed** |
| Matriarch, Vharun: Novice win (no tank) | ≥ 10% | B | 24%–42% | 8%–48%; 1 of 2 out | **missed** |
| Bosses: Idle win | 0% | A | 0%–0% | 0%–0% | met |
| Bosses: Idle win | 0% | B | 0%–0% | 0%–0% | met |
| Bosses: Idle win | 0% | C | 0%–0% | 0%–0% | met |
| M1 skirmishes: Idle win | ≤ 45% (loses 55–100%) | A | 0%–0% | 0%–0% | met |
| M1 skirmishes: Idle win | ≤ 45% (loses 55–100%) | B | 0%–46%; 1 of 5 out | 0%–36% | **missed** |
| M1 skirmishes: Idle win | ≤ 45% (loses 55–100%) | C | 0%–0% | 0%–0% | met |
| M1 elites: Idle win | 0% | A | 0%–0% | 0%–0% | met |
| M1 elites: Idle win | 0% | B | 0%–0% | 0%–0% | met |
| M1 elites: Idle win | 0% | C | 0%–0% | 0%–0% | met |
| M2 skirmishes: Idle win | ≤ 15% | A | 0%–0% | 0%–0% | met |
| M2 skirmishes: Idle win | ≤ 15% | B | 0%–8% | 0%–14% | met |
| M2 skirmishes: Idle win | ≤ 15% | C | 0%–0% | 0%–0% | met |
| M2 elites: Idle win | 0% | A | 0%–0% | 0%–0% | met |
| M2 elites: Idle win | 0% | B | 0%–0% | 0%–0% | met |
| M2 elites: Idle win | 0% | C | 0%–0% | 0%–0% | met |
| M1 skirmishes and elites: Novice win | ≤ default and ≥ Idle + 30 | A | 6/7 cells; out: muted_nave 4 (default 66, Idle 0) | 6/7 cells; out: muted_nave 14 (default 68, Idle 0) | **missed** |
| M1 skirmishes and elites: Novice win | ≤ default and ≥ Idle + 30 | B | 5/7 cells; out: tolling_halls 96 (default 90, Idle 2), glass_gallery 82 (default 80, Idle 0) | 5/7 cells; out: tolling_halls 100 (default 88, Idle 0), glass_gallery 82 (default 76, Idle 6) | **missed** |
| M1 skirmishes and elites: Novice win | ≤ default and ≥ Idle + 30 | C | 6/7 cells; out: shattered_choir 90 (default 80, Idle 0) | 6/7 cells; out: muted_nave 28 (default 68, Idle 0) | **missed** |
| M2 skirmishes and elites: Novice win | 5–20 pts under default | A | 1/7 cells; out: crimson_gate -2, blood_rites +0, pike_line +2, red_muster +0, leech_warren +2, blood_forge -26 | 2/7 cells; out: blood_rites +0, pike_line +2, red_muster +0, leech_warren +0, shield_wall +2 | **missed** |
| M2 skirmishes and elites: Novice win | 5–20 pts under default | B | 1/7 cells; out: crimson_gate -2, blood_rites +0, pike_line +2, red_muster +0, leech_warren +0, shield_wall -4 | 2/7 cells; out: blood_rites -2, pike_line +2, red_muster +0, leech_warren -2, shield_wall -30 | **missed** |
| M2 skirmishes and elites: Novice win | 5–20 pts under default | C | 0/7 cells; out: crimson_gate +2, blood_rites +0, pike_line +2, red_muster +0, leech_warren +4, shield_wall -22, blood_forge -40 | 1/7 cells; out: crimson_gate +0, pike_line +2, red_muster +0, leech_warren +0, shield_wall -36, blood_forge -34 | **missed** |
| Brann below 40% (Skilled), M1 and M2 cells | ≥ 40% of his alive time | A | mean 20%, range 2–33% | mean 21%, range 1–37% | **missed** |
| Brann below 40% (Skilled), M1 and M2 cells | ≥ 40% of his alive time | B | mean 17%, range 2–33% | mean 16%, range 2–37% | **missed** |
| Brann below 40% (Skilled), M1 and M2 cells | ≥ 40% of his alive time | C | mean 15%, range 1–29% | mean 16%, range 1–30% | **missed** |
| Brann downs a fight (Skilled), M1 and M2 cells | ≤ 0.3 | A | mean 0.69, max 4.36; 8 of 16 over | mean 0.73, max 4.32; 10 of 16 over | **missed** |
| Brann downs a fight (Skilled), M1 and M2 cells | ≤ 0.3 | B | mean 0.24, max 1.16; 5 of 16 over | mean 0.34, max 1.78; 8 of 16 over | **missed** |
| Brann downs a fight (Skilled), M1 and M2 cells | ≤ 0.3 | C | mean 0.59, max 4.46; 7 of 16 over | mean 0.63, max 4.84; 8 of 16 over | **missed** |
| lifestealShare (Skilled), M1 and M2 cells | 20–45% | A | 32–43% | 34–46%; out: first_light 46% | **missed** |
| lifestealShare (Skilled), M1 and M2 cells | 20–45% | B | 28–52%; out: hollow_cantor 52% | 29–52%; out: hollow_cantor 52% | **missed** |
| lifestealShare (Skilled), M1 and M2 cells | 20–45% | C | 29–48%; out: crimson_gate 48% | 30–48%; out: crimson_gate 48% | **missed** |
| Refused Rallies a fight (Skilled), M2 skirmishes and elites | ≤ 3 | A | max 1.8 | max 2.1 | met |
| Refused Rallies a fight (Skilled), M2 skirmishes and elites | ≤ 3 | B | max 1.6 | max 1.6 | met |
| Refused Rallies a fight (Skilled), M2 skirmishes and elites | ≤ 3 | C | max 1.4 | max 1.2 | met |
| Execution on Brann spared (Skilled, Vharun) | ≥ 80% | A | 100/117 = 85% | 115/125 = 92% | met |
| Execution on Brann spared (Skilled, Vharun) | ≥ 80% | C | 109/117 = 93% | 118/124 = 95% | met |
| Twin Cleave on Brann survived (Skilled, Vharun) | ≥ 70% | B | 42/145 = 29% | 44/140 = 31% | **missed** |
| Refused Rallies a fight at Vharun (recorded, no band) | — | A | 11.9 of 37.5 | 11.0 of 35.6 | recorded |
| Refused Rallies a fight at Vharun (recorded, no band) | — | B | 6.8 of 23.0 | 6.0 of 23.5 | recorded |
| Refused Rallies a fight at Vharun (recorded, no band) | — | C | 7.7 of 28.6 | 7.6 of 28.4 | recorded |
| Boss targets (Skilled; share of boss time) | — | A | Vharun: vexis 50% kael 47% brann 3%; Matriarch: kael 83% vexis 14% brann 2% | Vharun: vexis 52% kael 42% brann 5%; Matriarch: kael 82% vexis 15% brann 1% | recorded |
| Boss targets (Skilled; share of boss time) | — | B | Vharun: lyra 94% vexis 4% brann 1%; Matriarch: lyra 98% brann 1% | Vharun: lyra 98% vexis 1% brann 1%; Matriarch: lyra 97% brann 1% vexis 0% | recorded |
| Boss targets (Skilled; share of boss time) | — | C | Vharun: lyra 93% kael 7% brann 0%; Matriarch: lyra 51% kael 48% | Vharun: lyra 92% kael 7% brann 0%; Matriarch: lyra 53% kael 46% | recorded |

#### Whole runs (200 seeds; set 2000 / set 900007)

| Run | Bot | Target | Default | A | B | C | Result |
|---|---|---|---|---|---|---|---|
| Whole Prelude (A, C) | Skilled | ≥ default − 5 | 89 / 88 | 61 / 65 | | 61 / 46 | **missed** (A, C) |
| | Novice | ≥ 50% of default | 39 / 33 | 1 / 0 | | 2 / 1 | **missed** (A, C) |
| | Idle | 0% | 0 / 0 | 0 / 0 | | 0 / 0 | met |
| Whole Expedition (A, B, C) | Skilled | won ≥ 75% (B ≥ 65%) | 79 / 76 | 44 / 43 | 70 / 68 | 54 / 42 | B met; **A, C missed** |
| | Novice | won 8-20% | 15 / 12 | 1 / 0 | 2 / 2 | 0 / 0 | **missed** (A, B, C) |
| | Idle | 0% | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | met |

Where the Expedition runs end (`tools/harness.ts --run --movements 2 --party X`, 100 seeds, Skilled):

- **A:** Muted Nave 8, Shattered Choir 8, Vharun 11, and Movement I skirmishes 17.
- **B:** spread out, with no cell above 6.
- **C:** Glass Gallery **33** and the Cantor 9.

The Novice's A and C runs end in their first 2-3 fights: First Light, Tolling Halls and Glass Gallery.

#### Other gates

| Gate | Target | A | B | C | Result |
|---|---|---|---|---|---|
| Bond XP floor: Brann's Skilled Bond XP a fight against the starters' average in his party, catch-up off (Expedition; Prelude) | ≥ 75% | 87% / 87%; 90% / 90% | **74%** / 75% | 76% / 77%; 80% / 80% | **missed** (B, set 2000, by 1 point) |
| Harmony reachability: Skilled Expeditions that owned both prerequisites at an offer and were then offered Blood and Silk | ≥ 50% | 4/5 = 80% / 11/13 = 85% | 6/8 = 75% / 18/19 = 95% | 6/6 = 100% / 11/12 = 92% | met |
| Blood and Silk's overall offer rate (Skilled Expeditions) | recorded | 2% / 6% | 3% / 9% | 3% / 6% | recorded |
| Default party, every cell | identical to the W0 baselines | | | | met (8 hashes, both m1-baseline modes, expedition-baseline) |

**Inversion check** (a fight's figures, averaged over the Movement's cells; 'support' is the Weaver's healing plus her shields on that hero):

| Party | Movement | Set | Skilled: heal / ward share of support, Brann | Skilled: same, starters | Mend s a fight on Brann: Novice / Skilled | Result |
|---|---|---|---|---|---|---|
| A | 1 | 1000 | 36% / 45% | 53% / 30% | 17.8 / 13.3 (1.34×) | **missed** |
| A | 1 | 500003 | 36% / 47% | 52% / 31% | 17.8 / 13.4 (1.33×) | **missed** |
| A | 2 | 1000 | 28% / 55% | 42% / 40% | 33.0 / 8.3 (3.98×) | met |
| A | 2 | 500003 | 27% / 56% | 42% / 39% | 33.6 / 7.9 (4.25×) | met |
| B | 1 | 1000 | 35% / 65% | 64% / 36% | 28.0 / 6.6 (4.24×) | met |
| B | 1 | 500003 | 35% / 65% | 62% / 38% | 27.3 / 6.7 (4.07×) | met |
| B | 2 | 1000 | 30% / 64% | 44% / 47% | 43.1 / 5.0 (8.62×) | met |
| B | 2 | 500003 | 29% / 65% | 45% / 46% | 40.3 / 5.0 (8.06×) | met |
| C | 1 | 1000 | 38% / 47% | 51% / 34% | 16.9 / 10.2 (1.66×) | met |
| C | 1 | 500003 | 39% / 47% | 52% / 34% | 17.0 / 11.0 (1.55×) | met |
| C | 2 | 1000 | 29% / 53% | 38% / 42% | 36.2 / 5.1 (7.10×) | met |
| C | 2 | 500003 | 28% / 54% | 38% / 40% | 35.1 / 4.8 (7.31×) | met |

#### Misses, and why tuning stopped

1. **Brann below 40% for ≥ 40% of his alive time.**
   - **Measured:** a mean of 15-21% and at most 37% per cell (both sets). On the Crimson Gate it is A 8% / 11%, B 4% / 3%, C 4% / 6%.
   - **Why:** in a 35-50 s skirmish he takes about 1,000-1,600 damage and spends 150-350 on Bloodletting. He regains about 1,000: the field's Sostenuto aura (about 350 even halved), his lifesteal (400-550) and Chimes.
   - **Levers tried:** lifesteal at its 6% floor, Bloodletting at +20% cost and −20% cooldown, and armour left at 0.15. Together they add only 3-8 points.
   - **The conflict:** the cells where he does sit lowest (A Muted Nave and Shattered Choir, 27-37%) already have 1.3-1.5 Brann downs a fight against the ≤ 0.3 band.
   - Reaching 40% needs more damage coming in (enemy numbers) or the field not healing him (Weaver rules). Both are off-limits, so the band was left. The `it.skip` test in `tests/bots.test.ts` stays skipped, and its comment names these shares.
2. **≤ 0.3 Brann downs a fight.**
   - **Measured:** over in 5-10 of the 16 non-boss-pair cells per party. Cantor 3-5 a fight (A and C), Vharun 2-4.
   - **Why:** almost all of them come from telegraphed cleaves aimed at the hero beside him: Toll Cleave, the Cantor's Toll and Requiem, and Twin Cleave. He has `dodge 0` by design and stands in their cone. Armour never softens a telegraph.
3. **Skilled win ≥ default − 5.**
   - **Measured:**
     - A: Muted Nave −28 to −34, Shattered Choir −16, Choir Loft −8 (set 500003), Blood Forge −10 to −16, Shield Wall −6 (set 500003), Vharun −24 to −36;
     - C: Glass Gallery −42 to −44, Muted Nave −8 (set 1000), the Cantor −20 to −32;
     - B: Glass Gallery −6 (set 1000) and Shield Wall −6 (set 500003).
   - Brann's +20% damage (tried above) narrows those gaps by 4-14 points, but none of them closes.
   - The losing parties are the ones with Kael and Brann side by side in one cone, and C also lacks Vexis's damage at Glass Gallery.
4. **Whole runs (A, C), and every Novice run band.** These follow from 2 and 3: life carries between fights, and the Novice's A and C runs end in their first fights. No ±20% number moved a run more than about 9 points.
5. **Novice cell bands.**
   - **M1 'not above default':** B's Novice beats the default Novice at Tolling Halls and Glass Gallery (by 2-12 points). Brann taking the hits there makes the party easier for a heal-the-lowest Weaver.
   - **M2 '5-20 points under default':** where the default Novice wins 96-100% (Crimson Gate, Blood Rites, Pike Line, Red Muster, Leech Warren), Brann's parties win the same 96-100%. At the elites the gap runs from +2 to −40 points. A band on both sides can't be met by one number.
   - **Boss Novice:** A and C win 0-28%, against 20-60% (25-70% at Bellwarden and the Cantor).
6. **lifestealShare 20-45%.**
   - **Measured:** met in all cells but one per party: A First Light 46% (one set), B the Cantor 52%, C the Crimson Gate 48%.
   - Lifesteal is already at its lever's floor.
7. **The no-tank boss band: Twin Cleave on Brann survived ≥ 70%.**
   - **Measured:** party B 42/145 = 29% and 44/140 = 31%. The rest of the no-tank boss band is met: Skilled win ≥ default − 15, share ≥ 30% and Idle 0%. The Novice is ≥ 10% except Vharun on set 500003 (8%).
   - **The pre-agreed levers, in order:**
     1. **The bot's Reel reservation and pre-Ward.** Already in W3's bot. The three extensions above (dome readiness, near-lethal priority, holding a charge) gave 27-40%.
     2. **Armour up to 0.25.** Applied. It changes nothing here, because telegraphs ignore armour.
     3. **Deathless and Iron Will in the hints.** This has no sim effect for a bot to measure.
   - **Why it misses:** in party B the boss targets Lyra 93-98% of the time. Twin Cleave aimed at her also lands on Brann, who stands in its 4.2 m cone. That is 2 × 850 on him, not softened by armour, while the Weaver's two Ward charges also answer Lyra's blows. The Reel lands 2 m from the Weaver, often still inside the cone.
   - **What is left:** enemy numbers or Brann's position (the sim's berserker movement), both outside this pass.
8. **Inversion check, party A in Movement I.**
   - **Measured:** the Novice Mends Brann only 1.33-1.34× as long as the Skilled, against ≥ 1.5×. The heal and Ward share halves of the check are met everywhere, and the whole check is met for B, for C, and for A in Movement II.
   - **Why:** the Skilled's Thread time on Brann there is mostly reviving him at the Cantor (37-47 s a fight) after Toll and Requiem downs. The Mend-lift and floor changes reach about 1.5× only by costing downs.
9. **Bond XP floor, party B.**
   - **Measured:** 74% and 75%. Lyra's share in B is the largest of any hero.
10. **The known starting misses from the build.**
    - **'Without Kael the bosses target Lyra, not Brann'** holds, and it is not threat. Vharun targets Lyra about 90% of the time even in the default party, with Kael present (Kael gets 7-10%); the Matriarch targets her about 63%.
    - **Vharun A and C below default − 5:** C now meets it (96 / 96 against 98 / 100). A misses by 24-36.
    - **5-13 refused Rallies a fight at Vharun:** now A 11-12, B 6-7 and C about 7.7, out of 23-38 Rallies a fight. Under the Bloodmoon the bot keeps calling the party into the pools. That has no band; the ≤ 3 band covers Movement II skirmishes and elites, where the most is 2.1 (met).

#### Cells by party

Each figure reads *set 1000 / set 500003*. Skilled and Novice wins show the default party's win beside them, in brackets. Wins, share, below-40% time and lifestealShare are in %; downs are Brann's own, a fight.

**Party A**

| Cell | Skilled win (default) | Share | Novice win (default) | Idle | Brann below 40% | Brann downs | lifestealShare | Refused Rallies |
|---|---|---|---|---|---|---|---|---|
| first_light | 98 (100) / 96 (100) | 48 / 47 | 70 (100) / 74 (98) | 0 / 0 | 20 / 20 | 0.62 / 0.64 | 42 / 46 | 0.0 / 0.0 |
| tolling_halls | 96 (100) / 98 (100) | 46 / 47 | 48 (90) / 54 (88) | 0 / 0 | 25 / 21 | 0.58 / 0.48 | 34 / 34 | 0.0 / 0.0 |
| glass_gallery | 96 (94) / 92 (92) | 46 / 44 | 36 (80) / 48 (76) | 0 / 0 | 19 / 23 | 0.26 / 0.46 | 41 / 41 | 0.0 / 0.0 |
| choir_loft | 96 (100) / 92 (100) | 40 / 39 | 82 (100) / 86 (100) | 0 / 0 | 30 / 30 | 0.32 / 0.60 | 40 / 45 | 0.0 / 0.0 |
| mourning_steps | 100 (98) / 100 (100) | 46 / 45 | 82 (100) / 82 (96) | 0 / 0 | 14 / 10 | 0.12 / 0.08 | 39 / 38 | 0.0 / 0.0 |
| muted_nave | 66 (100) / 72 (100) | 44 / 44 | 4 (66) / 14 (68) | 0 / 0 | 27 / 32 | 1.46 / 1.40 | 43 / 39 | 0.0 / 0.0 |
| shattered_choir | 76 (92) / 78 (94) | 43 / 43 | 36 (80) / 34 (86) | 0 / 0 | 30 / 37 | 1.38 / 1.30 | 32 / 35 | 0.0 / 0.0 |
| bellwarden | 98 (98) / 94 (96) | 46 / 46 | 22 (72) / 22 (82) | 0 / 0 | 33 / 34 | 0.66 / 1.04 | 36 / 35 | 4.3 / 4.9 |
| hollow_cantor | 100 (96) / 96 (90) | 40 / 41 | 26 (56) / 26 (62) | 0 / 0 | 20 / 17 | 4.36 / 4.32 | 43 / 43 | 0.0 / 0.0 |
| crimson_gate | 98 (100) / 100 (100) | 42 / 42 | 96 (98) / 94 (100) | 0 / 0 | 8 / 11 | 0.06 / 0.08 | 43 / 45 | 0.0 / 0.0 |
| blood_rites | 100 (100) / 100 (100) | 45 / 44 | 100 (100) / 100 (100) | 0 / 0 | 10 / 15 | 0.12 / 0.12 | 41 / 41 | 0.6 / 0.8 |
| pike_line | 100 (100) / 98 (100) | 43 / 45 | 100 (98) / 100 (98) | 0 / 0 | 23 / 23 | 0.20 / 0.20 | 40 / 39 | 0.0 / 0.0 |
| red_muster | 100 (100) / 98 (100) | 49 / 50 | 100 (100) / 100 (100) | 0 / 0 | 13 / 12 | 0.00 / 0.02 | 37 / 36 | 0.7 / 0.7 |
| leech_warren | 100 (100) / 100 (100) | 46 / 46 | 98 (96) / 100 (100) | 0 / 0 | 2 / 1 | 0.00 / 0.00 | 38 / 37 | 0.1 / 0.1 |
| shield_wall | 100 (94) / 88 (94) | 48 / 45 | 60 (68) / 78 (76) | 0 / 0 | 19 / 26 | 0.18 / 0.32 | 41 / 44 | 1.8 / 2.1 |
| blood_forge | 82 (92) / 78 (94) | 45 / 44 | 42 (68) / 46 (66) | 0 / 0 | 24 / 20 | 0.66 / 0.66 | 43 / 40 | 1.3 / 1.2 |
| gorehound_matriarch | 100 (100) / 100 (100) | 46 / 46 | 18 (62) / 14 (56) | 0 / 0 | 6 / 5 | 0.00 / 0.02 | 42 / 42 | 0.0 / 0.0 |
| vharun | 74 (98) / 64 (100) | 47 / 47 | 2 (46) / 0 (50) | 0 / 0 | 36 / 35 | 4.20 / 3.98 | 33 / 33 | 11.9 / 11.0 |

**Party B**

| Cell | Skilled win (default) | Share | Novice win (default) | Idle | Brann below 40% | Brann downs | lifestealShare | Refused Rallies |
|---|---|---|---|---|---|---|---|---|
| first_light | 100 (100) / 100 (100) | 45 / 45 | 96 (100) / 94 (98) | 46 / 36 | 7 / 9 | 0.12 / 0.16 | 42 / 42 | 0.0 / 0.0 |
| tolling_halls | 100 (100) / 100 (100) | 43 / 42 | 96 (90) / 100 (88) | 2 / 0 | 17 / 15 | 0.16 / 0.16 | 31 / 32 | 0.0 / 0.0 |
| glass_gallery | 88 (94) / 98 (92) | 43 / 43 | 82 (80) / 82 (76) | 0 / 6 | 33 / 37 | 0.48 / 0.76 | 35 / 34 | 0.0 / 0.0 |
| choir_loft | 100 (100) / 100 (100) | 43 / 43 | 100 (100) / 94 (100) | 8 / 8 | 18 / 15 | 0.10 / 0.02 | 37 / 38 | 0.0 / 0.0 |
| mourning_steps | 100 (98) / 100 (100) | 44 / 44 | 94 (100) / 94 (96) | 6 / 12 | 21 / 21 | 0.22 / 0.32 | 33 / 31 | 0.0 / 0.0 |
| muted_nave | 98 (100) / 98 (100) | 46 / 45 | 54 (66) / 42 (68) | 0 / 0 | 26 / 17 | 0.42 / 0.32 | 33 / 37 | 0.0 / 0.0 |
| shattered_choir | 98 (92) / 96 (94) | 42 / 42 | 70 (80) / 76 (86) | 0 / 0 | 29 / 25 | 0.32 / 0.44 | 28 / 29 | 0.0 / 0.0 |
| bellwarden | 100 (98) / 98 (96) | 44 / 45 | 38 (72) / 42 (82) | 0 / 0 | 8 / 8 | 0.16 / 0.36 | 43 / 44 | 1.3 / 1.3 |
| hollow_cantor | 92 (96) / 90 (90) | 36 / 35 | 42 (56) / 30 (62) | 0 / 0 | 12 / 14 | 1.16 / 1.78 | 52 / 52 | 0.0 / 0.0 |
| crimson_gate | 100 (100) / 100 (100) | 41 / 41 | 96 (98) / 94 (100) | 2 / 2 | 4 / 3 | 0.00 / 0.02 | 38 / 39 | 0.0 / 0.0 |
| blood_rites | 98 (100) / 98 (100) | 47 / 47 | 100 (100) / 98 (100) | 0 / 0 | 8 / 12 | 0.08 / 0.10 | 34 / 36 | 0.3 / 0.5 |
| pike_line | 100 (100) / 100 (100) | 47 / 47 | 100 (98) / 100 (98) | 8 / 14 | 13 / 12 | 0.02 / 0.00 | 33 / 32 | 0.0 / 0.0 |
| red_muster | 100 (100) / 100 (100) | 47 / 48 | 100 (100) / 100 (100) | 0 / 0 | 16 / 15 | 0.02 / 0.02 | 37 / 39 | 0.5 / 0.5 |
| leech_warren | 100 (100) / 100 (100) | 46 / 46 | 96 (96) / 98 (100) | 0 / 0 | 2 / 2 | 0.00 / 0.00 | 38 / 38 | 0.1 / 0.2 |
| shield_wall | 94 (94) / 88 (94) | 46 / 46 | 64 (68) / 46 (76) | 0 / 0 | 26 / 29 | 0.20 / 0.44 | 37 / 41 | 1.4 / 1.6 |
| blood_forge | 92 (92) / 92 (94) | 44 / 44 | 60 (68) / 48 (66) | 0 / 0 | 27 / 26 | 0.46 / 0.46 | 42 / 41 | 1.6 / 1.3 |
| gorehound_matriarch | 98 (100) / 100 (100) | 43 / 43 | 42 (62) / 48 (56) | 0 / 0 | 2 / 2 | 0.04 / 0.02 | 43 / 41 | 0.0 / 0.0 |
| vharun | 96 (98) / 96 (100) | 42 / 43 | 24 (46) / 8 (50) | 0 / 0 | 28 / 26 | 2.34 / 2.26 | 34 / 33 | 6.8 / 6.0 |

**Party C**

| Cell | Skilled win (default) | Share | Novice win (default) | Idle | Brann below 40% | Brann downs | lifestealShare | Refused Rallies |
|---|---|---|---|---|---|---|---|---|
| first_light | 100 (100) / 100 (100) | 47 / 46 | 92 (100) / 98 (98) | 0 / 0 | 21 / 21 | 0.32 / 0.38 | 41 / 40 | 0.0 / 0.0 |
| tolling_halls | 100 (100) / 100 (100) | 51 / 50 | 60 (90) / 72 (88) | 0 / 0 | 10 / 11 | 0.10 / 0.18 | 33 / 36 | 0.0 / 0.0 |
| glass_gallery | 52 (94) / 48 (92) | 40 / 39 | 48 (80) / 42 (76) | 0 / 0 | 29 / 30 | 1.10 / 1.12 | 40 / 38 | 0.0 / 0.0 |
| choir_loft | 100 (100) / 100 (100) | 45 / 44 | 92 (100) / 88 (100) | 0 / 0 | 13 / 9 | 0.12 / 0.02 | 38 / 39 | 0.0 / 0.0 |
| mourning_steps | 100 (98) / 100 (100) | 49 / 47 | 92 (100) / 86 (96) | 0 / 0 | 26 / 30 | 0.30 / 0.66 | 29 / 30 | 0.0 / 0.0 |
| muted_nave | 92 (100) / 96 (100) | 49 / 50 | 36 (66) / 28 (68) | 0 / 0 | 19 / 21 | 0.70 / 1.04 | 40 / 42 | 0.0 / 0.0 |
| shattered_choir | 98 (92) / 94 (94) | 50 / 50 | 90 (80) / 82 (86) | 0 / 0 | 25 / 22 | 0.82 / 0.46 | 31 / 33 | 0.0 / 0.0 |
| bellwarden | 100 (98) / 100 (96) | 50 / 50 | 28 (72) / 24 (82) | 0 / 0 | 21 / 25 | 0.56 / 0.58 | 41 / 40 | 3.4 / 3.7 |
| hollow_cantor | 64 (96) / 70 (90) | 42 / 42 | 6 (56) / 14 (62) | 0 / 0 | 25 / 27 | 4.46 / 4.84 | 41 / 40 | 0.0 / 0.0 |
| crimson_gate | 100 (100) / 100 (100) | 47 / 47 | 100 (98) / 100 (100) | 0 / 0 | 4 / 6 | 0.04 / 0.06 | 48 / 48 | 0.0 / 0.0 |
| blood_rites | 100 (100) / 100 (100) | 52 / 52 | 100 (100) / 94 (100) | 0 / 0 | 6 / 6 | 0.02 / 0.08 | 37 / 35 | 0.4 / 0.3 |
| pike_line | 100 (100) / 100 (100) | 53 / 52 | 100 (98) / 100 (98) | 0 / 0 | 3 / 4 | 0.02 / 0.00 | 35 / 35 | 0.0 / 0.0 |
| red_muster | 100 (100) / 100 (100) | 54 / 54 | 100 (100) / 100 (100) | 0 / 0 | 4 / 6 | 0.00 / 0.00 | 36 / 35 | 0.3 / 0.3 |
| leech_warren | 100 (100) / 100 (100) | 52 / 52 | 100 (96) / 100 (100) | 0 / 0 | 1 / 1 | 0.02 / 0.00 | 37 / 36 | 0.1 / 0.1 |
| shield_wall | 100 (94) / 100 (94) | 52 / 52 | 46 (68) / 40 (76) | 0 / 0 | 11 / 10 | 0.28 / 0.18 | 43 / 43 | 1.1 / 1.1 |
| blood_forge | 98 (92) / 90 (94) | 50 / 49 | 28 (68) / 32 (66) | 0 / 0 | 26 / 24 | 0.52 / 0.42 | 43 / 44 | 1.4 / 1.2 |
| gorehound_matriarch | 100 (100) / 100 (100) | 51 / 51 | 16 (62) / 26 (56) | 0 / 0 | 1 / 2 | 0.00 / 0.02 | 41 / 40 | 0.0 / 0.0 |
| vharun | 96 (98) / 96 (100) | 51 / 50 | 12 (46) / 4 (50) | 0 / 0 | 26 / 25 | 1.94 / 2.00 | 34 / 34 | 7.7 / 7.6 |

## Presentation

### Model and VFX (`src/render`)

- **Model.** `case 'berserker'` in `buildHero`, built from primitives. Broad and bare-armed, with scars, a two-handed axe carried low, a crimson sash, dark-iron bracers, and the broken collar with **brass trim** on the collar and axe edge. It reads distinct from Kael in greyscale. The three existing cases are untouched.
- **Blood Rage:** an ember glow that scales with missing life.
- **Lifesteal:** crimson motes from the `selfHealed` bucket, driven by `healApplied {via:'lifesteal'}` with source = hero. They never show as a cut heal. `feedback.ts:1261` and `martyr.ts:252` treat 'lifesteal' as its own via and never fall into the Weaver-heal branches.
- **Cut heals:** shown through `healCut` using `weaverHealCut`, for Weaver vias only.
- **Bloodletting:** a crimson drain segment on the bar, a palm-cut spark and three pips on the axe. It does not use the damage floater style.
- **Sunder Leap:** the existing `attackFired 'leap'` arc, accepting a hero source, plus a landing dust ring. Red Comet adds a gold shock ring.
- **Red Frenzy:** a yaw spin and a crimson swipe ring that follows him. When Cued the ring is gold-edged and the motes are larger.
- **Bloodlust:** a 'refused' glyph on the Rally ack, cleared by Iron Will.
- **Bars** (`partyBars.ts`, `overlay.ts`):
  - notches at 40%, at 30% (with the Hymn or the Harmony) and at 10% (with Deathless);
  - an ember raging band from 40% to 15%;
  - a pulse only when he is below 15%, falling fast, or has a lethal hit incoming.
- **Edge arrows** (`combatView.ts:237`) use the same critical gate.
- **Answer glyphs:** the 'dome' glyph (`entities.ts:2168`) is drawn only when `partyHasDome`.
- **Talents and motifs:**
  - Deathless reuses the Unbreakable look.
  - The Hymn draws links to the other heroes.
  - Blood Oath shows a glint.
  - Blood Brother shows a tether to the threaded hero.
  - Blood Tithe shows a refund chip.
  - Blood and Silk shows a thread pulse.
- **Cue lists:** BOND_CUES, CUE_LIFE and FREQUENT gain `iron_will`, `blood_oath`, `deathless` and `berserkers_hymn`. `started` and `soloStarted` gain `blood_brother`.
- **Labs:** VfxLab Brann scenarios through its `party` option, including a clutter check with 8 hounds on a Spire arena.
- **Budget:** no growth in FX batches.

### Colour (`tests/colorVision.test.ts`)

- Every pair of hero colours, and every hero colour against the Weaver gold, is ≥ 20 ΔE in every vision.
- Brann against lethal, Bear and threat is ≥ 20 in normal vision and ≥ 10 in every vision.
- **The Movement II environment:** `#b91c1c` and his lifesteal mote colour are measured against every M2 enemy body and accent colour and the Bloodmoon tint. Where any pair is under 15 ΔE in normal vision, a model test asserts the brass-trim parts exist. The table is recorded in `docs/phase-5b/vfx-audio.md`.
- No danger channel is drawn in his colour.

### Audio (`src/audio`)

- **Leitmotif and call phrase:** in D dorian, on a new voice `bowedLow` (built from `bowed()` + `thump()`). Leitmotif A2–C3–D3–E3; call phrase D–F–E. `motifNote` and `heroNote` get explicit branches before their glass `else`.
- **Heartbeat:** a war drum whose tempo follows missing life, with no alarm. `lowAlert` sounds only below 15%, when he is falling fast, or with a lethal hit incoming. The default branches and their order are unchanged.
- **Sounds:**
  - hit pitch 82.4 Hz;
  - a flourish kind `redComet`;
  - Sunder Leap: a whoosh and a slam;
  - Bloodletting: a hiss and a low pluck;
  - Red Frenzy: a loop plus gated hits;
  - lifesteal: a sip on `via 'lifesteal'`, gated to one per 0.25 s, while `self` stays the Weaver's Blood Font;
  - a refused Rally: a drum hit;
  - the Tithe refund: a chime;
  - Blood and Silk: a tick;
  - talent and alt-Solo sound groups for every Brann id.
- **Labs:** an opt-in Brann (`IDS.brann = 5`, a party option on `FakeWorld`). `HERO_IDS` and the default `FakeWorld` are unchanged.

### UI (`src/ui`)

- **Prep.**
  - `prepParty(roster)` returns the roster, or null while it has 3 heroes or fewer.
  - The picker shows roster cards with toggles, exactly 3 selected, role chips and the **key number** each card will take.
  - One note per missing starter:
    - **No Kael:** the warning above.
    - **No Lyra:** 'Only Kael's Shield Bash and Brann's Sunder Leap interrupt. Break guards with Focus.'
    - **No Vexis:** 'No Gravity Well: swarms stay spread out.'
  - HeroCard and the Codex HeroEntry gain a Passive row and a Needs row, each only for defs that have one.
- **Frames.**
  - `HeroHud.blood?: {rage, bloodlust, deathless, oath, tithe, fast, bled}`.
  - A rage % chip and a Bloodlust chip.
  - The permanent heal-cut hatch, through `movementTwoMarks` and `healCutTitle`.
  - The raging band and ticks.
  - `healthLevel(hp, maxHp, defId?, fast?)`.
  - Key numbers on every frame.
- **Hints:**
  - `brannLow`: 'Brann fights harder hurt: Ward him, don't Mend him.'
  - A refused Rally: 'Bloodlust: Brann won't Rally below 40%. Ward him (Iron Will) or Reel him.'
  - A Fermata hold on Brann: 'One touch of the Thread saves him — even halved.'
  - Existing hint counts are untouched.
- **Decrees** (`hudBridge.ts:379-386`, `legionLook.ts`):
  - `decreeNoDome` when `!partyHasDome`.
  - When Execution condemns Brann: 'Execution — Brann is condemned. Ward him: your healing barely takes on him.'
  - `AnswerGlyph.tsx` filters the dome.
- **Elsewhere:**
  - The Event choice texts (recruited and party variants) and the Result gain line from `recruitNotices`.
  - FreshStrip.
  - Codex locks on the Heroes and Calls pages and on motif chips, with the two-route unlock text.
  - Bonds tabs sized by count.
  - The Harmony ribbon and 'would enable' hint on Draft and shop cards.
  - In the Red appears through `deedsInSight(seen, roster)` (`deedsModel.ts`).
  - Result and Summary lines: 'Under 40%: 62% of the fight · Lifesteal 1,240 · Your healing on him: halved'.
  - The 'New ally' callout (`Callouts.tsx`).
  - The Call prompt names the hero.
- **Labs and the e2e hook:** UiLab gets a 'Brann' group covering every state above. `mockBondsHud` passes `SimConfig.party`. `testHook` gains `setParty` and `recruit`.

## Content lint (new rules)

- `defaultParty` ids are unique. No default hero has `recruit`, and every other hero has `recruit`.
- `recruit.event` names an event with a fight effect whose `recruit` is that hero. `recruit.fallback` names a real encounter. Every fight `recruit` names a real hero.
- `recruitedText` and `partyText` appear only on choices that have a recruit.
- Formation spots are pairwise ≥ 1.5 m apart.
- The new ability, Solo and quirk fields are present for their kinds, and `minRange < range`.
- Every hero with `passive` has `needs`, and its Codex text mentions healing.
- `requires.motifs` ids exist and exclude the motif itself. The motif is hero-gated, directly or through a gated prerequisite.
- `decreeNoDome` appears only on attacks whose decree or answers include the dome.
- `heroCeiling` Deeds name a real hero and encounter and have `points: 0`.
- The KNOWN_TALENTS, KNOWN_ALT_SOLOS and KNOWN_MOTIFS equality tests are extended.

## Tests

- **Characterisation (W0a):**
  - `m1Unchanged`: the 8 literals.
  - `rosterInvariance`:
    - the explicit default party hashes equal to the implicit one;
    - no `blood` or `tithe` key appears;
    - a snapshot of `Object.keys` for every hero component and shield after 600 ticks of bellwarden, equal to the committed one;
    - `NO_MODS` has the new fields at 0.
  - `tools/m1-baseline.ts --check` and `--movement 2 --check`.
  - `tools/expedition-baseline.ts --check`: playRun summaries for 5 Novice and 5 Skilled Expedition seeds. It is not in vitest; vitest gets a 2-seed smoke only.
  - `tests/meta/draftSnapshot.test.ts`: `makeDraft` and the now-exported `makeShop` for 40 seeds.
  - `tests/bots/commandSnapshot.test.ts`: hashes of the command streams for Skilled and Novice, 5 seeds each.
  - preludeSnapshot.
  - Budget: the new vitest snapshots add ≤ 20 s.
- **`tests/sim/brann.test.ts`:**
  - Blood Rage: 0, +60% and the cap (Red Mist +100%).
  - `flourishHit`'s amplified share is unchanged by rage.
  - Lifesteal:
    - 6% (the def's share), and ×3 when Cued;
    - aggregated into one `healApplied` per 0.5 s with source = Brann;
    - no ledger or `supportReceived` credit;
    - cut by Wound and Bloodmoon;
    - 0 during a hold.
  - The ×0.5 cut: by via; revive and shields exempt; the ledger credits the effective amount.
  - Cleave: 50% across the arc, 360° when Bloodlet.
  - Bloodletting: stops at the floor, never fires below 50%, and is not falling fast.
  - Sunder Leap:
    - lands inside the arena and clear of obstacles;
    - interrupts casters;
    - emits a hero-sourced `leap`;
    - the Call opens only with a 4-9 m target.
  - Red Frenzy pulses and is not rooted.
  - Bloodlust: one bark per Rally; obeys Hold; Iron Will.
  - No `rng.ai` draws.
  - `fallingFast`.
- **`tests/sim/brannBonds.test.ts`:**
  - Scar Tissue on a Ward, Taut Release, Kael's Cued dome and the Ostinato refill.
  - Blood Oath combined with Overflowing Grace: no double spend.
  - Deathless: once; clamps at 1; a Fermata release within the window does not down him; an unused Fermata hold still saves him with a heal.
  - The Hymn.
  - Blood Brother.
  - The Tithe: below 40% only; main Ward path only, not Chorale or Aegis Link; refunds on a break and on a Perfect; not on expiry; Conduit conversion.
  - Blood and Silk: Empower only, below 30%.
  - `peakAfterLow`.
  - The down record's `blood`.
- **`tests/sim/brannDeterminism.test.ts` (W1):** a replay round-trip and a mid-fight hash for parties A, B and C over 3 seeds.
- **`tests/sim/noTank.test.ts`:** party B on first_light, bellwarden and vharun: no errors, threat-led targeting, and no Kael rules firing.
- **`tests/meta/roster.test.ts`:**
  - the roster;
  - `setParty`;
  - the embark fallback with a permissive default and stale Bonds dropped;
  - `recruitsOf` after `toMap`: a won Cell, a lost Cell, 'leave', Vharun won and Vharun lost;
  - `recruit` writes nothing when nothing is new;
  - `lastParty` absent for the default party;
  - `eligible()` with `requires.motifs`, and a lost prerequisite keeping the Harmony;
  - the Bond XP catch-up.
- **Save tests:**
  - A v9 profile with `recruited`, a `lastParty` holding an unknown or duplicate hero, and a Brann Bond, loaded with unlockAll on and off.
  - An in-flight Brann run saved mid-Prep, resumed and re-fitted.
  - A v9 profile without the new keys loads with those keys absent.
- **`tests/meta/recapNoDome.test.ts`:** no recap, summary or SAVE_HOW text names the dome or Kael for a party without Kael. Brann's recap wording is chosen in priority order.
- **`tests/meta/deeds.test.ts`:** In the Red; the count is 23; `deedsInSight` with and without a roster.
- **`tests/content.test.ts`:** the heroes list is `[kael, lyra, vexis, brann]`; `defaultParty` is unchanged; Brann's numbers; one rejection case per lint rule.
- **`tests/bots.test.ts`:**
  - Skilled with A, B and C on crimson_gate: share > 0.3 and the low-time target.
  - It Wards before a big hit in ≥ 80% of cases.
  - ≤ 1 Rally per 8 s while Brann is bloodlusting, and ≤ 3 refused Rallies a fight on average over 10 seeds.
  - The Novice with B is deterministic and does not throw.
  - Default-party command streams match the W0 snapshot.
- **Presentation tests:**
  - `renderBrann`: model with brass parts; notches and raging band; cut heals by via; lifesteal never drawn as cut; Bloodletting drawn as a drain, not a hit; hero-sourced leap; no danger channel in his colour; dome glyph hidden without a dome; FX budget.
  - `audioBrann`: not glass; no alarm above 15% unless falling fast; the lifesteal rate limit; default heroes byte-equal.
  - `uiPhase5b`:
    - `prepParty` null;
    - picker rules and key numbers, with party B frames labelled 1/2/3 = Lyra/Vexis/Brann;
    - missing-starter notes;
    - frames with `blood` only for Brann;
    - Brann bands: no hurt tier, raging band, critical below 15% or falling fast;
    - the decree rewrites, both dome and Execution;
    - Codex locks with the two-route text;
    - filtered Bonds tabs;
    - the Harmony hint;
    - Event texts by roster and party;
    - the Call prompt names the hero.
  - Updates to the exact lists: `audio.test`, `renderBonds`, `audioPhase4e`, `uiPhase4e` (HEROES[3] = brann under unlockAll) and `loomHub`.
- **e2e (W7):** the existing flows embark the default party with no clicks. A new roster smoke: the veteran picks Brann, fights, and sees his frame and Summary line.

## Exit criteria

1. **The default party is unchanged.**
   - The 8 hashes and SIM_VERSION 22.
   - Both m1-baseline modes, expedition-baseline, preludeSnapshot, draftSnapshot and commandSnapshot are equal.
   - The pacing and powercap reports reproduce on default runs.
2. **Brann's bands are met** for A, B and C, including the no-tank boss band, the inversion check, the Bond XP floor, Harmony reachability and lifestealShare.
3. **Recruitment.** The Cell or the fallback recruits him exactly once, and he appears from the next Prep. **With unlockAll off**, an unrecruited profile's screens equal today's. The unlockAll flows (`smoke.spec.ts:228/394/450/501/1030`, uiPhase4e `skipUnlocks`) are audited in W0 and W6.
4. **Readability (the merge gate).**
   - Every Brann rule is shown where the player looks.
   - Recaps name the answer for 100% of his downs.
   - The ΔE tests pass.
   - No dome or Kael text appears for parties without Kael.
5. **Readability (post-merge playtest gates, recorded protocol).**
   - A cold read of Prep, his frame and the 'New ally' card scores ≥ 4/5 (the 4h method).
   - New players understand the healing cut before his second fight.
6. **Build health.** Lint, tsc, vitest and e2e are green. No FX growth.
7. **Saves.** v9 profiles and v5 in-flight runs load and finish.
8. **Docs.** This file with the harness tables; `docs/phase-5b/{vfx-audio.md, ui.md}`; `docs/demo.md`.

## Workstreams

W0 runs first and alone, in four steps. W1, W2, W4, W5 and W6 then run in parallel. W3 follows W1. W7 integrates.

**Expected reds between workstreams.** These are the only reds allowed, each with its owner:

- `tests/renderBonds.test.ts` 'a cue for every talent…' and its alt-Solo lists: owned by W4.
- `tests/audioPhase4e.test.ts` talent and alt-Solo group tests: owned by W5.

They are red on a lone W1, W4 or W5 branch because they compare those tables with the ids the sim emits. **W1, W4's cue rows and W5's sound rows merge together** as the first W7 step. Any other red blocks a merge.

## Known gaps (deliberate)

- **No 4th slot.** It needs an Astrolabe node, a four-hero formation, frames clear of the Weaver bar, Prep copy, bot slot handling and a balance pass.
- **Seren and Oro** are not in this slice.
- **No Harmony tier.** There is no rarity, price or draft weight for it; there is one Harmony on `requires.motifs`, with a UI hint.
- **No mid-run recruitment.**
- **No Brann relics** until `rollRelics` gets a hero filter.
- **No hero scaling** by Movement.
- **Untouched enemy texts.** The enemy Codex texts that name Kael or Lyra (`enemies.ts:344`) stay as they are, and the decree advice changes in the HUD only.
- **Training Grounds** stay on the default party.
- **The no-tank party is harder** against Twin Cleave and Execution, by design, and its band says so.
- **Slot order is canonical.** A hero's key can change with the party, so key numbers are always shown.

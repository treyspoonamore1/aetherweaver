# Phase 5e: Seren, the Riposte, and Oro, the Grovekeeper

*2026-11-08, revision 2 (design) · main at 4d81033 · plan: [02 §6](plan/02-game-design.md) (lines 166-180: ‘Seren turns Wards into damage; Oro makes aura coverage a pet-management puzzle’), [02 §9](plan/02-game-design.md) (lines 233, 235: Rank 8 ‘Seren recruitable via event’, Rank 12 ‘Oro recruitable via event’), [02 §11](plan/02-game-design.md) (line 266: Red Line), [02 §14](plan/02-game-design.md) (lines 300-311), [03 §5](plan/03-content-bible.md) (lines 215-232), [03 §8](plan/03-content-bible.md) (lines 376-377: En Garde, Verdant Choir), [03 §12](plan/03-content-bible.md) (content targets), [04](plan/04-presentation.md) (line 20: Seren silver, Oro moss) · follows [Phase 5b](phase-5b.md) (the roster, Brann and his rebalance), [5c](phase-5c.md) and [5d](phase-5d.md) (the Finale)*

The roster reaches the plan’s six heroes. Both new heroes are earned, and each gives the Weaver’s existing buttons a new job.

- **Seren, the Riposte** (duelist, 900 life) turns **Ward timing into damage**.
  - While Warded she stands *en garde*. The next melee blow aimed at her is **parried**: it does nothing, and she answers it with a counter for 300%.
  - A **Perfect** Ward on her is a **kill shot**.
  - Her flaw is **Showboat**: she leaves the group to duel the strongest enemy, outside your field but never beyond your reach. When the pack closes on her, you **Reel** her home (or Rally her, which she always obeys).
- **Oro, the Grovekeeper** (summoner, 950 life) turns **aura coverage into a placement puzzle**.
  - He keeps two **Saplings**: rooted mini-tanks that take your songs and taunt the small things that come near.
  - The Saplings don’t walk. You keep your field over them, or **Rally**, and they re-sprout ahead of you.
  - Your Thread on Oro also Mends them (**Rootbond**).
  - His flaw is **Gentle**: without a **Focus** he won’t raise a hand. While he is idle, his Saplings fight harder.

Neither is Brann again:

| Hero | What it changes for the Weaver | Rallies | Where he or she fights |
|---|---|---|---|
| Brann | inverts *healing* | refuses them | lives in the melee |
| Seren | turns the *Ward* into an attack | always obeys them | wanders off to duel |
| Oro | gives the *field* a second job and hands the Weaver a pet to place | obeys them | stays back |

**Starting point.** No Seren or Oro content, sim, render, audio or UI code exists: `grep -ri` for seren, oro, sapling, showboat or grovekeeper over `src`, `tools` and `e2e` finds nothing. Two tests already name them, both as ids that must stay unknown today: `tests/harnessTools.test.ts:526` (`partyArg('kael,vexis,seren')` throws) and `tests/audioPhase5d.test.ts:914-919` (`leitmotifCanon` skips unknown ids). Both are on the expected-red list. The ‘parry’ and ‘riposte’ hits in the code are other things:
- Kael’s Riposte Bash talent (`src/content/bonds.ts:41`, `src/sim/combat/health.ts:871-881`, `src/sim/systems/heroes.ts:1609`);
- the Riposte Bloom motif (`src/content/motifs.ts:83`, `src/sim/combat/telegraphs.ts:620, 661`);
- the Astrolabe’s Ringing Parry (`src/content/astrolabe.ts:272`).

Two things were planned ahead: `HeroRoleSchema` already lists `duelist` and `summoner` (`src/content/schema.ts:264-271`), and `ROLE_LABEL` names them (`src/ui/hud/labels.ts:288-289`).

**Sources.** Measured numbers come from the repo and from scratch scripts in `/tmp/claude-0/-home-user-aetherweaver/788d7335-cec7-55ed-adf1-f8f57a4dbd4c/scratchpad/m5e/`:
- `events.ts` and `pins.ts`: event frequency and map-pin movement;
- `rev2col.ts`, `rev2sig.ts`, `rev2oro.ts` and `rev2silver.ts`: colour ΔE through `src/app/colorVision.ts`, **in every vision** (revision 1’s `check5e.ts` measured enemies in normal vision only).

Every other number is a starting value that W9 tunes.

### What revision 2 changed (from the critique, each verified against the code)

- **Oro’s recruit choice fights its own encounter.** The appended `follow` choice on `loose_thread` fought `unstitched_vanguard`, the same encounter as the existing `pull` (`unstitchedRun.ts:298-303`). `recruitsOf` matches only event id plus encounter (`run.ts:900-914`), so winning ‘Pull it’ would have recruited Oro. `follow` now fights the Frayed Court (`unstitchedRun.ts:184-198`), which no other `loose_thread` choice fights. `recruitsOf` also takes an allowance now; called without one, it returns only heroes with no Rank gate, so every existing caller and test is unchanged.
- **The Hollow Champion is normal tier.** It spawns with `elite: false` (`enemies.ts:1252-1266`, tier rule `:98-105`) and has 12,000 base life (`unstitched.ts:236-243`). A new **heavy** rule (base life ≥ 5,000; today only `mirror_champion`) keeps the kill shot from executing it and keeps summons from taunting or rooting it.
- **Colours were re-measured in every vision.**
  - Seren’s colour (`def.color`, every 2D and UI use) is the rapier violet `#a018f8`. Silver stays on her **model only** (coat and blade parts).
  - Silver as a UI colour would have collided with shipped silver inks: SILENCE_INK, the stilled and emboldened status colours, the Impale stake, the Blocked floater and the epilogue speaker. It also failed the Movement III body test outright.
  - Oro moves from `#80b058` to a deeper moss, `#487858`. The old moss was 2.5 ΔE from Brann’s brass under protanopia, which would turn the shipped test `colorVision.test.ts:312-330` red.
- **Passive narrowing moved into `blood.ts`.** `bloodRageBonus` (`:76-85`) is called for every hero hit (`heroDamage.ts:36`) and by the Skilled bot (`skilled.ts:1907`). `weaverHealCut` (`:110-114`) is called for every hero frame (`hudBridge.ts:618`). `onBloodHit` is `:163-171`. Each now reads `bloodRageOf(def)`.
- **The duelist gets her own branch** in `combatMove`; nothing in the berserker branch is widened (`heroes.ts:322-353`).
- **Showboat is checked every tick.** `onPackArrived` returns at wave ≤ 1 (`heroes.ts:1564`), so it would never have started a duel in wave 1 or in any boss fight.
- **Lunge has its own target rule** and a contact form, so Seren can interrupt at any range up to 9 m. She also holds Lunge for an interrupt in boss fights.
- **The kill shot is deferred one tick**, and it never fires while Seren is disabled or the Grand Silence holds.
- **A Ward arriving cancels a dodge she is already committed to.** Her dodge is rolled when she first notices the telegraph (`heroes.ts:1414-1452`).
- **The parry is reported as dealt 0 and absorbed 0**, with a new optional `parried` key. Severing therefore never fires on it (`enemies.ts:406`, `telegraphs.ts:498-506`), and `failedVictim` is false because nothing was dealt (`telegraphs.ts:529-531`). A parry also needs a blow aimed at her, not a redirected share (`opts.oath`, `health.ts:1173, 1225, 1258, 1261`).
- **Q2 is a mask, not a strength.** `coverage()` returns only a mask (`field.ts:112-129`); strength comes from `auraTotals` (`auras.ts:113-150`). The Ancient’s disc therefore counts as your field, at your field’s own strengths, and its knock-on effects are listed.
- **Q1’s fallback no longer edits `field.ts`.** It is composed from public state, and Mute domes, the hymn and suppression all apply.
- **Summons now:**
  - glance off guard arcs and Spindle tethers;
  - never Sever the Thread, and are never struck by enemy splash or chain;
  - take no statuses;
  - keep their clocks running in Stasis.
- **Ownership and ordering:**
  - `calls.ts`, `thread.ts`, `commands.ts`, `hits.ts` and `stasis.ts` call sites now belong to W0b, and a hand-over rule covers the files W0b touches for later owners.
  - The Deeds are appended as `ROSTER_DEEDS` after `FINALE_DEEDS`.
  - Not a Leaf Lost moved to the Frayed Court.
  - The epilogue prefers a new hero’s line.
  - The event screen lays out 4 visible choices as 2 × 2.
- **The bots:**
  - The Skilled bot keeps its Ward for Kael’s boss blows in Seren boss fights.
  - `serenReel` no longer waits on a Twin Cleave reserve, which exists only for Brann (`skilled.ts:635`).
  - OB has no boss soak, so its bands are provisional and are your call (Q8).
- **Corrected citations:**
  - kite steps 3 m from enemies within 3 m (`heroes.ts:601-620`), not 4 m;
  - the Novice’s Cue draw is at `novice.ts:378-382`;
  - alternate Solos are tracked by KNOWN_ALT_SOLOS, not SoloKind (`schema.ts:309`, `sim/bonds.ts:38-43`);
  - `partyTaunts` and `partyInterrupts` are new, beside `partyHasDome` (`index.ts:306-312`);
  - the Cracked Metronome is a relic, not a Ward (`telegraphs.ts:625-632`);
  - Rewind has no range: it returns the threaded hero to 3 s ago (`callings.ts:189`).
- **Rejected:**
  - the claim that Vampiric heals enemies (it Wounds, `legion.ts:452-460`);
  - the claim that `heal()` calls `weaverHealCut` for every heal (it is gated on `target.hero?.blood`, `health.ts:586-589`; the narrowing still lands because of the ungated callers above).

## Principles

1. **Two heroes, each done completely.** Each ships with everything Brann shipped with (docs/phase-5b.md:7):
   - kit, Call, Flourish, Solo, Quirk and Passive;
   - Needs and Codex lines, and barks;
   - 6 Bond talents, an alternate Solo and 2 scenes;
   - a Bond motif and a Deed;
   - model, colour, leitmotif, call phrase and sounds;
   - frames, hints and recaps;
   - bot skills, harness tallies, bands and goldens.

   The plan’s names are kept, except one collision (Q7). Where the plan is silent, this doc designs the missing piece and flags it (Q6): Oro’s two abilities, both Calls and Flourishes, the alternate Solos and the scenes.
2. **One verb each, taught by a visible state.**
   - Seren teaches *the Ward as an attack*. A crossed-blades glyph sits on her, on her frame and on any blow she can parry; each parry shows PARRIED and a counter number with the Weaver’s gold chip. Her second verb is the *Reel or Rally out of a pack*.
   - Oro teaches *placing the field*. Each Sapling carries the same aura rim arcs a hero does (or the ‘thrive’ leaf under Q1’s fallback), so you can read ‘in your songs’ and ‘outside your songs’ on the ground, on his frame and on the Saplings’ bars. His second verb is *Focus wakes him*.
3. **Cut what won’t read.**
   - Saplings are planted. They don’t path or follow, so they never wander into a cleave.
   - Telegraphs, raids, splash and chain never hit summons, and bosses ignore them. The rule to learn is ‘Saplings soak blows, never shapes.’
   - Summons take no statuses.
   - Feint, the Sapling taunt and the Ancient’s root never bind a boss. Summons never hold a heavy foe either.
   - Thousand Cuts returns Seren to where she started.
   - The kill shot executes only lesser foes.
   - Summons are never Ward, Reel, Thread, Chime or Cue targets; Rootbond and Rally are the Weaver’s two levers on them.
   - No new Harmonies, relics, events or encounters.
4. **Answerable by construction.**
   - Seren’s stance is clamped to 13 m from the Weaver. Ward, Chime, Reel and the Thread all reach 14 m (`src/content/weaver.ts:24-61`), so every Seren beat has a Weaver answer. (Rewind, the Chronomancer’s Reel, acts on the threaded hero, so the Thread’s reach applies.)
   - ‘Overextended’ means *surrounded*, never *out of reach*.
   - Lunge interrupts casts from contact to 9 m, and in boss fights it is held for them, so every one of the 20 parties has a boss interrupter.
5. **Every existing fight and party stays byte-identical.** That covers:
   - the 19 goldens (`tests/sim/golden.json`, pinned at `tests/sim/m1Unchanged.test.ts:20-89`);
   - `tools/m1-baseline.ts --movement 1|2|3|4 --check` and `tools/expedition-baseline.ts --movements 2|3|4 --check`;
   - preludeSnapshot, draftSnapshot, commandSnapshot, commandSnapshotM3 and commandSnapshotFinale;
   - rosterInvariance (its keys json does not grow), movement3Handoff and finaleHandoff;
   - expedition2Pin and expedition3Pin;
   - the render and audio Spire and Rift snapshots;
   - the Brann parties A, B and C, which are newly pinned beyond their 5 goldens (W0a).

   No new RNG draw is taken on an existing party’s path. **`SIM_VERSION` stays 22**: no command, replay or existing state key changes; every new hashed key is absent unless Seren or Oro is in the party. Only `contentVersion` moves. Old profiles (v9) and in-flight runs (RUN_SAVE_VERSION 5) load unchanged.
6. **No aura definition or number changes, and aura *reach* changes only with your answer.** Three effects would change who or where an aura acts: Saplings receiving auras (Q1), the Cued Ancient’s disc counting as your field (Q2), and Verdant Choir (Q3). Each is a question with a recommended default and a fallback that touches no aura code. W2b is the only workstream that edits `field.ts` or `auras.ts`, and it waits on your answer. If none arrives by W9, the fallbacks ship.
7. **Plan the party gap up front (the 5b lesson).** Brann parties first won 44-52% against the default’s 76-79% (docs/phase-5b.md:485-499). He stood in cleaves aimed at the hero beside him, and the Novice’s centroid followed him into melee. So, from the start:
   - Seren flanks and sidesteps others’ blows in her own branch from W1;
   - the Novice anchor ignores the duelist and every summon;
   - the band tool instruments every down by ‘blow aimed at whom’ from day one, and records Thread cuts and Weaver damage;
   - a **first look** (W8) is a gate before any tuning;
   - parties, bands (including the provisional OB band, Q8) and the lever order are agreed now.
8. **Shared files get call sites, not bodies.** W0b inserts every hook into the shared sim files as a guarded one-line call into `src/sim/systems/duel.ts` or `src/sim/systems/grove.ts`. After that, the Seren and Oro workstreams own disjoint files. W0b’s edits in files later owned by W4, W6 or W8 are limited to the lines listed in *contracts*; those owners rebase on W0b and own everything else in the file.

## Scope

**In:**
- Seren and Oro, each in full.
- Oro’s summons, the Saplings and the Ancient, as a new guarded `summon` entity kind.
- Five new sim primitives, each inert without its hero: the melee test and parry, the kill shot, the blink Solo, single-enemy and summon taunts, and an enemy root status.
- Recruitment:
  - Seren from Rank 8 and Oro from Rank 12, each through an appended, Rank-gated choice on an existing event that fights an existing encounter;
  - a Rank-gated fallback fight for each.
- Roster screens for six heroes.
- Bots, harness, `tools/roster-bands.ts`, 6 appended goldens, bands and the tuning pass.

**Out:**
- The Conductor Calling (the next slice; its Rank 12 coincides with Oro’s).
- The 4th Astrolabe party slot (`PARTY_SIZE = 3` is spread across seven files).
- Phase 6 systems.
- New map events or encounters.
  - A new event reshuffles `map:m{n}` (`src/meta/run.ts:529-543`); a new Movement II event moves all 40 I-II, I-III and Finale-route maps (scratch `pins.ts`).
  - A new encounter is unnecessary, since both recruit fights reuse existing ones.
- Hero relics (`rollRelics` has no hero filter, `src/meta/run.ts:1557-1590`).
- New Harmonies (03 §8 names none; Red Line is an archetype).
- Mirror-choir voices for the new heroes (Finale numbers frozen, `src/content/crucible.ts:206-236`).
- Training Grounds parties.
- Any change to Weaver, aura, enemy, encounter, starter or Brann numbers.

## Your answers (2026-11-08)

1. **Saplings receive your auras**, as a hero outside the Thread does (Q1 default). W2b builds it; no aura definition or number changes.
2. **The Cued Ancient's 6 m disc counts as your field in every respect** for its 8 s (Q2 default, including the knock-on effects listed there).
3. **Verdant Choir reads Sostenuto's unchanged regen** (30/40/50%), as an additive pulse outside the aura mask (Q3 default).
8. **OB is the hardest party by design** (Q8 default): provisional boss band default − 25, the Prep note, levers only Oro's own numbers and bot rules.

Defaults taken while you were away (say if you want any changed): Q4 Rank gates as the plan (Seren from Rank 8, Oro from Rank 12); Q5 the kill shot executes normal foes and elites at or below 50%, never heavy foes, minibosses or bosses; Q6 Regrowth and Bramble, the Ward and Chime Calls, Blade Waltz and Homecoming, the four scenes, Gentle's +50% tending bonus; Q7 the talent ships as Taproot.

## Questions for you (each has a recommended default; aura questions first)

The build proceeds on every default except Q1-Q3, which gate W2b; until they are answered, their fallbacks are built. Q8 sets a band and gates nothing in the build. The format follows docs/phase-5d.md:113-116.

**Q1. Do Saplings receive your auras? (‘Saplings inherit your aura buffs’, 03:227)**
- **Default: yes, as a hero outside the Thread does.**
- Code:
  - a recipient loop in `updateField` after the party loop (`src/sim/systems/field.ts:227-243`), run only when `world.internal.summons` exists;
  - it calls the unchanged `coverage(world, s, 'party')` and `auraTotals(world, mask, false)` (a Sapling is never the threaded hero), then a summon-safe `applyAuraLife`;
  - field songs land at their strength, and the beam song lands as its echo, exactly as on an unthreaded hero;
  - a `summonFx` wrapper sits beside `heroFx` (`src/sim/combat/auras.ts:159-161`) and feeds Sapling damage, flat damage, attack speed and move speed;
  - a summon `auraHealAcc` flushes heal floaters.
- Concretely:
  - Sostenuto regenerates 1.5% of a Sapling’s life a second (5.7/s at 380);
  - Ostinato gives it a 12% barrier;
  - Allegro and Fortissimo speed and strengthen its swings.
- **Not on summons:**
  - Fermata’s guard and hold (`health.ts:814, 915` stay `target.hero`-gated);
  - the hero ‘in your field’ effects: Haloed `health.ts:824`, Anthem `:770`, Radiance `:1299-1307`, Shared Wounds `:1739`, Dawnward `field.ts:233`, the chorus pulse `techniques.ts:995-1018`, and Red Frenzy’s heal `blood.ts:194`.
- **Ledger and threat:**
  - Aura heals and barriers on Saplings count as Weaver aura healing and shielding, and add to Oro’s `supportReceived`.
  - Like every Weaver heal on team `party`, they add healing threat on the Weaver from every engaged enemy (`health.ts:620-628`, `threat.ts:20-25`). The band tool reports Weaver damage taken against default.
- **Fallback (no aura code): ‘thrive in your songs’.**
  - While a Sapling stands inside your field, its *own* numbers apply: +40% damage, +20% attack speed, and 1.5% life a second through a new HealVia `'grove'` credited to the Weaver.
  - ‘Inside your field’ is composed in `grove.ts` from read-only public state, mirroring the private `inDome` and `inHymn` (`field.ts:69-85`):
    - `!world.field.suppressed`;
    - `inAnyField(world, x, z, r)` (`field.ts:353-360`);
    - not `underMuteDome(world, x, z)` (`field.ts:57-64`) unless `world.mods.unsuppressible` (Unbroken Chorus, `field.ts:150`);
    - inside a `world.field.hymnCircles` circle whenever any exist.
  - So Mute domes, Silencing domes, the Silent Verse and a downed Weaver blank it exactly as they blank your field. A W2 test pins the composition against `coverage() !== 0` for a probe hero at the same spot.
  - Your choice of aura stops mattering to the Saplings; your position still does.

**Q2. Does the Cued Ancient’s disc count as your field? (‘wreathed in all your auras, becoming a second aura source’, 03:229)**
- **Default: yes, for its 8 s, as a 6 m disc centred on it that counts as your field in every respect.**
  - Code: one gated test in `coverage()` (`field.ts:112-129`). After the chord loop, if `world.field.ancient` exists and `e` stands inside its disc, the function ORs in the union of every chord’s `chordMask` (which already honours Steal Verse, `:87-98`) and sets `inRadius`. `coverage()` returns a mask only; strength comes from `auraTotals` (`auras.ts:113-150`), so a hero covered only by the Ancient hears your field songs at their strength and your beam song as its echo, exactly as in your own field. Ornaments, Crescendo, Sovereign and the Astrolabe scale it through the unchanged per-aura arrays.
  - It falls silent wherever your field would, because the early return at `field.ts:116` runs first: field suppressed (the Weaver downed), the hero inside a Mute or Silencing dome, outside the Silent Verse hymn circles.
  - `inAnyField()` gains the same gated test, so enemy hexes act near it.
  - `field.ancient?: {id, x, z, r}` is lazy (the `field.finale` pattern, docs/phase-5d.md:71-74), written by `grove.ts` and deleted when the Ancient leaves.
- **Knock-on effects included in the default** (each happens only in Oro parties, while a Cued Ancient stands):
  - heroes in the disc have `inField` true, so Radiance and Haloed (the Luminary), the Astrolabe’s Anthem (`health.ts:770, 824`), Shared Wounds (the Martyr) and Dawnward (once per its cooldown) all act there;
  - enemies in the disc have `inField` true, so Eclipse acts on them (`field.ts:236-241`);
  - Vexis’s Cued Starfall pool (`solos.ts:353-366`, an `rng.combat` draw over enemies `inAnyField`) widens to the disc in Oro + Vexis parties.
- **Alternative default (narrower): auras only.** A second flag keeps `inRadius` false for the Ancient, so `inField` and every effect above stay off. This adds one more gated line.
- **Fallback (no aura code):** the Cued Ancient lasts 12 s, roots a second time at 6 s, and heals heroes within 6 m by 1% of their life a second (via `'solo'`, no Weaver credit).

**Q3. Verdant Choir (‘Saplings each emit Sostenuto at 30% effect’, 03:377).** A mask bit can’t stack (`auras.ts:126-148`), so this is an additive pulse in `grove.ts` either way.
- **Default:** each living Sapling heals heroes and the Weaver within 4 m by v% (30/40/50 by level) of Sostenuto’s `regenPctPerSec`, which is read from content and unchanged: 0.015 × 30% = 0.45% of max life a second.
  - It works whether Sostenuto is sung or not, and at most 2 Saplings count for one target.
  - `sostenutoMult` (Warm Hum) does not multiply it.
  - It is silent where Q1’s ‘inside your field’ test fails at the Sapling.
  - It is credited as Weaver aura healing, with its healing threat.
- **Fallback (no aura code):** the same heal, worded without Sostenuto: ‘Saplings heal everyone within 4 m for 0.35/0.45/0.55% of max life a second’. These are Oro’s own numbers; nothing reads aura content.

**Q4. Rank gates (02:233, 235).**
- **Default: honour the plan.** Seren can be recruited from Rank 8 and Oro from Rank 12.
  - Below the Rank, the recruiting choice is hidden and the fallback doesn’t recruit.
  - The check is made against your Rank when the recruit is written, so a Rank reached during a run makes that run’s fallback count. The Result line says so.
  - Skip the unlocks opens both.
- Alternative: no gate, as Brann has (recruitable from the first Expedition). Simpler, but a new player would meet three recruits in their first Expeditions, and the rank-up cards are lost.

**Q5. Kill-shot strength.**
- **Default:**
  - a normal foe is executed (hp + 1, the `telegraphDamage` rule, `telegraphs.ts:133-139`);
  - an elite is executed at or below 50% life, and otherwise takes 6× her attack (360 before auras);
  - a **heavy** foe (base life ≥ 5,000: today only the Hollow Champion, a 12,000-life normal-tier summon, `unstitched.ts:236-243`, `enemies.ts:1252-1266`), a miniboss or a boss takes 6× her attack and is never executed.
- Alternative: execute any non-boss outright. Louder, but it would trivialise Movement II-III elites, which sit near their band edges (docs/phase-5c.md:786), and the Unweaver’s champion.

**Q6. The pieces the plan doesn’t give (new design: confirm or replace).**
- Oro’s two abilities: **Regrowth** and **Bramble**.
- Calls:
  - Seren’s Lunge asks for a **Ward** (Flourish *Flèche*);
  - Oro’s Regrowth asks for a **Chime** (Flourish *Spring Rain*).
- Alternate Solos: **Blade Waltz** and **Homecoming**.
- The four scenes.
- **Gentle with a tending bonus:** without a Focus, Oro’s Saplings hit +50%, so he is never a zero-damage hero.
  - Alternative: plan-literal passivity with no bonus.

**Q7. A name collision.** Oro’s R3 talent ‘Deep Roots’ (03:232) collides with the shipped aegis motif Deep Roots (`src/content/motifs.ts:56-63`, `src/sim/mods.ts:432, 877`), which already shows in players’ Codex and tooltips.
- **Default:** the talent ships as **Taproot** (`taproot`).
- Alternative: keep ‘Deep Roots’ under a distinct id, and accept two entries with one name.

**Q8. OB (Lyra, Vexis, Oro) has no boss soak.**
- **The problem.** Bosses ignore summons, and Oro is Gentle with threat 0.6. So every boss blow on ‘current’ lands on Lyra (820 life, Ward 366) or Vexis (740, Ward 342), with no dome. The Cantor’s Toll (1,430) and a Twin Cleave blow (≈1,010) are lethal through a plain Ward. The answers are a Perfect Ward, Reel out of the cone, or Chime immunity (`techniques.ts:284`).
- **Why it differs from 5b.** 5b’s party B had Brann’s 1,250 life for this and won 80/83% after the rebalance (docs/phase-5b.md:485-499).
- **Party W is different.** In W (Vexis, Seren, Oro), Seren is the soak: a Warded Seren parries those blows whole.
- **Default:** accept OB as the hardest party by design.
  - The boss band is provisional at ≥ default − 25, and the first look (W8) confirms or replaces it.
  - The Prep note reads ‘No Kael: nothing holds the bosses, and Oro won’t. Keep a Perfect, a Reel or a Chime for each boss blow.’
  - The levers are Oro’s own numbers and bot rules only.
- **Alternative:** a no-tank adaptation for Oro, *Heartwood*: with no tank or berserker in the party, his threat ×2.5 and his Saplings taunt minibosses. This is a design change to his Quirk, and it would blur Gentle.

## Decisions taken (confirm or override)

| Question | Choice | Why |
|---|---|---|
| What a summon is | A new `EntityKind 'summon'` with an optional `summon` component, team `party` and health, spawned **after** the party loop, and only in Oro parties. It is **never in `world.party`**: no slot, threat index, frame key, defeat vote, Discord vote, note, Reignite, possession, Rewind past or counterfactual standing. | `PartySlot` 0-3 (`src/sim/commands.ts:12-13`), `world.ts:255` and the 5-entry threat table (`threat.ts:10`) can’t take it. Every `world.party` loop then excludes summons by construction. Reusing kind `hero` would enter every `e.hero` branch (Fermata, Bonds, slot threat, heartbeats). |
| How summons hold enemies | **Taunt only.**<br>• A Sapling pulses a 2.5 s taunt every 5 s on normal and elite, non-heavy enemies within 3.5 m. Each hit refreshes the taunt on its target.<br>• It writes `tauntTarget` only when the taunt is empty, expired or another summon’s, so it never overwrites Challenge or Feint.<br>• Bosses, minibosses and heavy foes ignore summons. A summon has no threat entry. | `pickEnemyTarget` already accepts any live entity for a taunt (`threat.ts:39-44`). The tier rule is Challenge’s (`heroes.ts:1146-1149`). A boss can’t be pinned on a body the Weaver can’t Ward. |
| Telegraphs on summons | **Telegraphs, raids, marks, links, zone pulls, splash and chain never hit summons.**<br>• A taunted enemy’s **basic** swings at the Sapling.<br>• A **special** that would aim at a summon re-aims at the hero it would pick without the taunt (one guarded line in `trySpecial`).<br>• Enemy bolt splash and chain skip summons: one guarded `continue` each in `hits.ts:45-50, 56-62`. | `candidates()` (`telegraphs.ts:226-242`), `countAimed`, `updateIncoming`, the Discord quorum (`:476-477`) and the Perfect logic stay byte-identical. The rule to learn: ‘Saplings soak blows, never shapes.’ |
| Statuses on summons | **None.** `addStatus` refuses a summon target with one guarded line, beside the hero-only refusal (`health.ts:330`). Bleeds and Vampiric’s Wound (`legion.ts:452-460`) never land, and `applyOnHit` (`health.ts:445-462`) is then a no-op on them. | Nothing could answer a status on a summon: Chime can’t target one. |
| Severing and summons | A blow that lands on a summon never Severs. One guarded `!target.summon` sits in the melee path (`enemies.ts:406`); telegraphs never hit summons anyway. | Saplings would otherwise park Severing elites beside the Thread, and `severingHit` tests the attacker against the Thread segment (`thread.ts:150-171`). |
| Saplings are planted | Saplings are immovable bodies that block enemies. They sprout at fight start at the Weaver’s front spots, **5 m ahead and ±2.5 m**. A felled Sapling re-sprouts beside Oro after 12 s. | A tree you must cover is the puzzle; pets that path would be noise. 5 m ahead and a 3.5 m taunt keep held packs about 3 m clear of the Weaver. Revision 1’s 3 m spots parked them at her feet. |
| Physics | `pinned()` (`physics.ts:66-69`) becomes `if (!e.hero \|\| !e.health) return e.summon !== undefined;` and is otherwise unchanged, so the hero test is still first and returns as before. | Every hero pair is byte-equal. |
| Rally and the grove | A Rally **re-plants** every living Sapling at the Weaver’s front spots: a 0.8 s burrow (untargetable), then a sprout. Hold and Scatter don’t move them. | 03’s Need ‘a Rally to keep the Saplings in the field’, as one visible verb. |
| Summon credit | A Sapling’s or the Ancient’s hits count in `ledger.partyDamage` on Oro’s slot (his meter, the counterfactual), with **no threat** (`noThreat`).<br>• With Q1 on, they also count in aura amplification.<br>• Weaver healing and shielding on a summon add to **Oro’s `supportReceived`**, through a guarded `else if (target.summon)` beside `health.ts:625`.<br>• Such healing adds the usual healing threat on the Weaver. | Gentle Oro isn’t hunted for his trees’ work, and his Bond XP is fair (Brann already missed its floor at 67-75%). |
| Summon hits on guards and tethers | Summon hits glance off a guard arc and suffer the Spindle tether reduction. The two gates at `health.ts:792, 795` widen from `source?.hero` to `(source?.hero \|\| source?.summon)`.<br>The other `source?.hero` amplifiers do **not** apply to summons: Hunter’s Mark, `partyDamageMult`, Anthem, Shield Bearer, Radiance and Eclipse (`health.ts:758-783`). | ‘Focus a flanker’ stays true at the Sentinel, and the Spindles still shield the Unweaver. Byte-equal for every hero source. |
| Summon death | A guarded `else if (target.summon) summonFell(...)` goes **before** `killEnemy` in dealDamage’s down branch (`health.ts:1062-1072`). It lands in W0b, before any summon can exist. | `killEnemy` dereferences `e.enemy!` (`health.ts:1696-1699`). |
| Oro downed | His Saplings go **dormant**: held, untargetable and greyed. They wake 2 s after he rises, and the Ancient leaves. | No respawn churn while he is down; it reads as ‘the grove waits for him’. |
| Grand Silence | Summons go dormant and the Ancient withers. Summons are never `measureTarget` (`conductorBoss.ts:877-888`) and never notes. The grove wakes at Reignite. The guard is in `updateSummons`, which reads `field.finale`; `conductorBoss.ts` gains only appended barks. | ‘Only the Weaver acts’ (docs/phase-5d.md:518). |
| Stasis | Summons count as the party’s side: `ofParty` (`stasis.ts:13-15`) gains a guarded summon test, so their pending hits (`stasis.ts:53`) and the statuses they source (`statuses.ts:71`) keep running. | ‘Every enemy waits’; the Saplings are yours. |
| Parry: what is melee | Two cases, each from an `enemy` source, never a tick and never a redirected share (`opts.oath` absent):<br>(a) an enemy **basic melee** swing **at her** (`DamageOpts.melee: true`, set at `enemies.ts:400`);<br>(b) a **cone (‘cleave’) telegraph of radius ≤ 6 m (`PARRY_REACH`) whose `target` is her**.<br>A W0a test enumerates the qualifying cones: bellwarden_slam, cantor_toll, brute_toll_cleave, gorehound_rend, leech_latch, vharun_twin_cleave(+_second), unweaver_shear, champion_cleave and conductor_downbeat.<br>Excluded: vharun_crimson_tide (r 30), every Toll Out and In, and every beam, burst, donut, mark, link, raid, bolt and zone. A cone aimed at another hero is never parried; she sidesteps it. | A shape rule edits no hashed content def. `parryable(attack)` is one pure rule shared by sim, render (the glyph), bots and UI. A future cleave with r ≤ 6 m opts in visibly, by failing the enumeration test. The `oath` test matters because Oathkeeper, the Lamb and Aegis Link spread `{...opts}` into their shares (`health.ts:1173, 1225, 1258, 1261`). |
| Parry: what it does | A Weaver Ward on Seren **negates the whole blow** and is spent (`removeShield(..., broken=true)`).<br>• The result reports `dealt 0, absorbed 0` plus a new optional `parried: blow` (absent on every other result).<br>• So Severing never fires (`enemies.ts:406`, `telegraphs.ts:498-506`), `failedVictim` is false because nothing was dealt (`telegraphs.ts:529-531`), and the onHit payload never applies.<br>• One guarded line in `hitEntity` (`if (result.parried) duelResolved(...)`) calls `answered(world)`, grants the Ward-absorb Resonance (`telegraphs.ts:482-484`) and records a Ward save when the blow would have downed her.<br>• One Ward buys one parry (Riposte Chain: two). | ‘Parried’ means it didn’t land. It is also the only rule under which a plain Ward saves a 900-life hero from the Cantor’s Toll (1,100 × 1.3 = 1,430) or a Twin Cleave blow (850 × 1.188 ≈ 1,010). |
| Which Wards parry | Any Weaver `ward` shield on her: the plain Ward, every castWard variant, Chorale `plain` Wards (`techniques.ts:573-591`), and the Chronomancer’s Echo Ward (`techniques.ts:969-990`).<br>**Not:** Aegis Link (no ward shield, `:640`), the Swap barrier, Ostinato or relic barriers, domes or the Celestial Sphere.<br>The Cracked Metronome is a relic that makes an early Ward Perfect (`telegraphs.ts:625-632`); a Metronome Perfect on her is a Perfect, and so a kill shot. | It reads as ‘Ward her’, and the Chronomancer gets one natural synergy. |
| Parry precedence | It runs after Celestial Sphere, Oathkeeper and the Aegis Link share (`health.ts:742-751`), and before guard arcs, armour, Fermata and the shield loop (`:785-839`). | The Weaver’s and relics’ own interceptions keep priority. A parried blow never touches an Ostinato barrier. |
| The counter | **Deferred one tick** through `duel.parryOn` (the `riposteOn` pattern, `health.ts:871-881` → `heroes.ts:99-103`). It is answered **after** `isDisabled` (`health.ts:107-115`, which includes `stilled`), so a stunned, stilled or possessed Seren still parries but doesn’t counter.<br>3 × her attack (180 base) goes through `heroDamage`, so auras, Empower and crit apply. It strikes the attacker if within her reach + 1 m, otherwise it is lost. Threat goes on her slot. | No re-entrant `dealDamage` inside an enemy’s swing. It also closes, for her, the hole Riposte Bash has of firing while stilled (docs/phase-5d.md:169). |
| Credit for Ward-caused damage | Negated damage goes to `ledger.negated`, `ledger.shielded` and her `supportReceived`. A lazy `ledger.duel` records the parries, and the counter and kill-shot damage as ‘your Wards dealt’. Those numbers carry the Weaver’s gold chip and are **not** added to amplified totals, so nothing is double counted. | ‘Gold means the Weaver did this’ (04 §1). It makes ‘Wards into damage’ show in proof of support. |
| Kill shot | **Any Perfect Ward on a telegraph aimed at her** marks a kill shot on its owner. The hook in `perfect()` beside `riposteBash` (`telegraphs.ts:600-601`) only sets `duel.killShotOn = owner`; every existing Perfect effect still happens (stagger, +20 Resonance, refund, Riposte Bloom, relics, a Grand Silence note).<br>The shot itself is taken **next tick**, after `isDisabled`. It is **lost** if she is disabled or stilled, while `field.finale?.silence` holds, or if the owner is gone.<br>• If the owner is within 9 m of her and the landing is within 13 m of the Weaver, she leaps to it (her own landing rule in `duel.ts`, modelled on `leapLanding`, `heroes.ts:1384-1395`).<br>• Otherwise a thrown silver lance strikes it at range.<br>Damage follows Q5. It goes through `dealDamage`, so invulnerability, `rising`, `phaseShiftUntil` (`health.ts:733-738`), guard arcs, tethers and Pacts apply: a kill shot into a Sentinel’s front glances. It counts as a parry for En Garde. | The leap reads as a duel move but never takes her out of reach, and ‘only the Weaver acts’ holds in the Grand Silence. The thrown lance keeps a sniper’s Perfect worth something. |
| Showboat target | **The strongest enemy within 12 m of the Weaver**, rechecked **every tick** in the duelist arm of `chooseTarget`. She picks when she has no live quarry, or when a higher-tier enemy enters the 12 m, after a 0.8 s bark. No `onPackArrived` hook, since it returns at wave ≤ 1 (`heroes.ts:1564`) and would skip wave 1 and every boss fight.<br>• Rank by tier (boss > miniboss > elite > normal), then max life, then id.<br>• Skip `stationary` enemies (Void Maw, Spindles) unless Focused.<br>• Prefer enemies **not targeting Kael** when Kael is in the party; if Kael’s target is the only choice, she duels it **from the flank** (`flank()`, `heroes.ts:525`).<br>Focus overrides. The pick is sticky for 8 s or until the target dies. A **Rally or Reel ends it and suspends it for 4 s; she always obeys.** The Reel here is the pull (and the Chronomancer’s Rewind): Anchor and Swap pull nothing, so they leave her duel standing and Rally is their answer (*By Calling*). | It fixes 5b’s cause 1 by design: she never queues in Kael’s cone. Skipping stationary enemies keeps her out of the Maw’s Inhale. Obeying Rally keeps her distinct from Brann. |
| The leash | Every destination is clamped to **13 m from the Weaver**. Out of a duel her leash is 9 m. Lunge and Thousand Cuts never take her past the clamp. | Ward, Chime, Reel and the Thread reach 14 m. |
| Overextended | While duelling, with **3 or more enemies targeting her**, or below 40% life outside every field. This raises a frame chip, a glyph and a hint, and she won’t leave on her own.<br>Answers: Reel, Rally, Cue Thousand Cuts (invulnerable), Stasis, a dome; for the Chronomancer, Rally or an *early* Rewind. | One readable rule shared by HUD, bots and recaps (`overextended()` is a pure rule). Rewind returns her to where she was 3 s ago (`callings.ts:189`), so it extracts her only if used as the pack closes. |
| Seren’s movement branch | **Her own branch** in `combatMove`. Nothing in the berserker code changes: `const berserker`, `lust`, the leash, the Hold chase, the `berserker &&` guard at `heroes.ts:326` and the `sidestepOthers` call at `:350` stay as they are.<br>• In the Rally arm, a **separate** line `if (def.role === 'duelist' && formationSidestep(...)) return;` sits beside Brann’s.<br>• A new `else if (def.role === 'duelist') duelMove(...)` arm sits before the `flank` arm. It calls `sidestepOthers` itself, so she steps out of every telegraph aimed at **another** hero. | Brann’s path is untouched, as the W0a A/B/C snapshots prove. |
| Seren’s stance and dodge | Warded, she **never dodges** a parryable blow aimed at her (‘she stands her ground’). Two pieces:<br>(a) in `noticeTelegraphs`, a hero-specific `if (hero.duel && duelStands(world, e, t)) continue;` placed after `contains()` and before the `rng.ai` roll (`heroes.ts:1431-1441`). The shared `chance` expression and every other hero’s draws are untouched.<br>(b) each tick, in the duel hook, a pending `hero.dodge` from a parryable telegraph aimed at her is **cancelled** once a Ward lands on her.<br>Other blows aimed at her get her ordinary `dodge 0.45` through the existing roll. | Her dodge is decided when she first notices the telegraph, up to 0.75 s before the Perfect window, so without (b) a late Perfect would usually find her already stepping out. The stance makes the parry dependable and visible. |
| Lunge | **Own target rule `lungeTarget`** in `duel.ts` (not `leapTarget`, which leashes to BERSERKER_LEASH and picks by Focus, caster and nearest, `blood.ts:348-385`):<br>(1) an interruptible caster within 9 m **at any distance**; within 3.5 m it is a contact lunge, a thrust with no dash;<br>(2) otherwise her quarry, 3.5-9 m away.<br>Every landing is clamped to 13 m from the Weaver. It **interrupts** the cast it lands on, as Sunder Leap does (`heroes.ts:1326-1361`).<br>Refused while Held, Scattered with a link on her, rooted or pinned, latched, during a Rally, or if it would land past the clamp.<br>**In a fight whose boss or miniboss has an interruptible special, Lunge is spent only on interrupts.** | Party W (Vexis, Seren, Oro) has no other boss interrupter: bosses refuse Vexis’s stun (`health.ts:273-276`). So every 3-hero party can stop the Mirror Ward and every Finale Solo (docs/phase-5c.md:478-487), even with Seren already face to face at 1.2 m. |
| Calls and `calls.ts` | `canCall` and `startCall` (`calls.ts:39-120`) pick the Call’s target through `leapTarget` for any ability with `minRange` (`:54, 95`). W0b adds one guarded dispatch: `ability.id === 'lunge' ? lungeTarget(...) : leapTarget(...)`. Regrowth’s opening rule (a Sapling felled or below 60%) is one more guarded `if (ability.id === 'regrowth' && !groveCallReady(...)) return false;`. | Brann’s Call is unchanged; Seren’s Call marks the enemy she will Lunge at. |
| Feint | A **sure** 2.5 m sidestep (HeroDodge `sure`, `state.ts:411-421`) plus a 3 s **hard taunt** of one normal or elite enemy (`tauntTarget` plus `topThreat(...,150)`, the Challenge rule). The Hollow Champion is normal tier, so Feint holds it. On a boss or miniboss it is only the step. | Kael keeps bosses. Feint makes the duel blow you Ward. |
| Thousand Cuts | 8 cuts over 4 s. Each is a blink to the nearest enemy not yet struck within 10 m of her start point and 13 m of the Weaver; it cycles when fewer remain. She is **invulnerable throughout** (`health.invulnerable` re-armed each pulse, an existing number), and at the end she **returns to her start point**.<br>**Cued:** each kill adds 0.5 s, up to +4 s. The extended end is stored (`duel.cutsEnd`), so `castProgress` (`solos.ts:104`) reads true. | It never strands her or snaps the Thread. |
| Gentle | Without a Focus, Oro doesn’t attack and casts Bramble only defensively.<br>• His own **gentle retreat** in `grove.ts` steps 3 m away from any enemy within 4 m. The ranged `kite` (`heroes.ts:601-620`) only reacts to enemies targeting that hero within 3 m.<br>• His Saplings are *tended* (+50% damage).<br>• With a Focus he thorns it and Snares it.<br>His Solo charges, and autonomy’s `cueGrace` accrues, while he **or a Sapling** has a target: call sites at `heroes.ts:131` (charge), `:140` (`soloHeld`) and `:262` (`shouldFireUncued`’s `targetId === null` return). | He is never a zero-damage hero, and Focus becomes a trade-off rather than a switch. Without the three call sites a target-less Oro never charges and never fires uncued (docs/hero-autonomy.md). |
| Enemy root | A new status `rooted`, on enemies only. It lasts 1.5 s and is followed by 4 s of root immunity (`EnemyComponent.rootImmuneUntil?`). It stops approach, chase, charge and leap (`enemies.ts:320-331, 1419`); attacks and casts go on, and it doesn’t interrupt. Bosses, minibosses and heavy foes are immune (the stun rule, `health.ts:269-280`, plus the heavy test). Heroes refuse it, since they have `pinned`. | One small primitive. A root that bound bosses would trivialise the Seamstress’s and Vharun’s positioning beats. |
| The Ancient and bosses | The Ancient taunts and roots normal and elite, non-heavy enemies only. Bosses ignore it. | With telegraphs never hitting summons, a boss hold would buy nothing honest. No-Kael Oro parties use the existing no-tank answers (Q8). |
| Heavy foes | `HEAVY_LIFE = 5000` base life (`rosterIds.ts`). A heavy foe is never executed by a kill shot, and is never taunted or rooted by summons. A W0a test enumerates heavy non-boss defs: `[mirror_champion]`. | The Hollow Champion is normal tier with 12,000 life: it would otherwise be one Perfect from death. |
| Passive schema | `passive` becomes a discriminated union `bloodRage \| parry \| rootbond`, read through one helper, `bloodRageOf(def)`.<br>**Sim:** `blood.ts` `bloodRageBonus` (`:76-85`, called for every hero hit from `heroDamage.ts:36` and by `skilled.ts:1907`), `weaverHealCut` (`:110-114`, called ungated from `hudBridge.ts:618`), `onBloodHit` (`:163-171`), and `world.ts:1080`.<br>**UI and tools:** `rosterModel.ts:160/183/309`, `sighting.ts:428`, `legionLook.ts:92`, `entities.ts:2037`, `VfxLab.tsx:3045`, `harness-core.ts:1439/1455`, and the lint at `schema.ts:2502-2505` (‘Codex names healing’ now applies to bloodRage only). | Today any `def.passive` spawns `blood` state, arms the Harmony watch, renders Blood Rage text and fails the lint. Without the `blood.ts` narrowing, Seren’s hits would be ×(1 + NaN) and her frame’s heal cut NaN. The narrowing is inside those functions, so their other callers (`health.ts:587` is already gated on `target.hero?.blood`, `:1483`, `hudBridge.ts:660`) need no change. |
| Recruitment | **No new events or encounters.** Each hero gets an **appended 4th choice** on an existing event that fights an encounter **no other choice of that event fights**:<br>• `tithe_altar` choice 3 `debt` → `legion_vanguard` (the altar’s other choices fight nothing, `legionRun.ts:427-460`);<br>• `loose_thread` choice 3 `follow` → `frayed_court` (`pull` fights `unstitched_vanguard`, `unstitchedRun.ts:298-303`).<br>Each choice has a new optional `EventChoice.rank`; the schema allows 4 choices (`schema.ts:880`). Fallbacks are Rank-gated fights on fixed Finale-route nodes: the **Gorehound Matriarch** for Seren (`crucibleRun.ts:105-108`) and **the Seamstress** for Oro (`unstitchedRun.ts:268-271`). | `recruitsOf` matches event id plus encounter (`run.ts:900-914`), so a shared encounter would recruit off `pull`. No map moves. The harness takes the first legal choice (`harness-core.ts:1331-1345`), and an appended choice is never first. The fallbacks are distinct from Brann’s Vharun, so one fight never recruits two heroes. |
| Rank-gated recruits | `Allowance` (`src/meta/profile.ts:382-397`) gains `recruits: ReadonlySet<string>`, the heroes whose `recruit.rank` is met; `EVERYTHING` holds them all.<br>• `eventChoiceProblem(run, id, allowance = EVERYTHING)` (`run.ts:1746-1755`) returns ‘Not yet.’ for a ranked choice whose recruit is outside it. The harness call (`harness-core.ts:1341`) and `chooseEvent` (`run.ts:1765`) are unchanged in effect.<br>• `recruitsOf(run, allowance?)`: with no allowance, ranked recruits (event and fallback) are left out, so every existing caller and test (`tests/meta/roster.test.ts:188-245`) is unchanged; `runStore` passes the profile’s allowance.<br>• The event screen filters hidden choices before its layout. | No RunState key. A Matriarch fight in any old test still recruits nobody. |
| UNLOCKS rows | A new `UnlockKind 'recruit'` with ids **`recruit.seren`** (Rank 8, blades icon) and **`recruit.oro`** (Rank 12, leaf icon), never `hero.<id>`. | `hero.<id>` is the FreshStrip’s introduced key (`rosterModel.ts:135-150`), and `demo.ts:36` marks every unlock up to Rank 12 introduced. |
| Slot order | Canonical: Kael, Lyra, Vexis, Brann, Seren, Oro. Every frame and card shows its key. | Byte identity (5b). |
| Formation spots | Seren `{forward 2.0, right -1.9}`: 1.99 m from Kael, 3.80 from Brann, 4.26 from Lyra, mirroring Brann. Oro `{forward -3.4, right 0}`: 2.86 m from Lyra and Vexis. The pairwise lint (`schema.ts:2521-2531`) passes for all 15 pairs. Saplings aren’t heroes, so they aren’t linted. | |
| Colour: Seren | `def.color` is the rapier violet **`#a018f8`**. It is used everywhere a hero colour is drawn in 2D or on the ground: ring, edge arrow, bar key tag, frames, Prep, Codex, Bonds, the Solo column. Plan silver `#cbd5e1` is **model-only**: the coat and blade parts `SEREN_STEEL`, never a flat UI colour.<br>Measured in every vision (scratch `rev2col.ts`):<br>• hero ≥ 25.5 ΔE (Kael, deuteranopia), and ≥ 20 from Brann’s brass;<br>• semantics ≥ 27.1 (ailment, tritanopia);<br>• Weaver gold ≥ 50.2;<br>• enemies 51.4 in normal vision (the repo’s rule for a hero signal colour, `colorVision.test.ts:291-310`), and lowest 21.8 (Doubt Wraith accent, deuteranopia) and 24.5 (Lamenter, tritanopia) elsewhere;<br>• Movement II and III environments > 10 in normal vision.<br>She needs no `SIGNAL_HEX` entry and no test exception. | Silver as a UI colour collides with shipped inks: SILENCE_INK, the Grand Silence’s stilled-frame ink (`finaleLook.ts:31`), the stilled and emboldened status colours (`labels.ts:214, 221`), the Impale stake and Blocked floater (`crimsonCues.ts:27, 33`), and the epilogue speaker (`EpilogueView.tsx:55`). It is 2.7 ΔE from the Shears’ accent and 5.4 from the Movement I Mute `#d4d4d8`, so it fails the Movement III body test (`colorVision.test.ts:421-443`). No silver passes every rule (scratch `rev2silver.ts`: 0 candidates). |
| Colour: Oro | A deep moss, **`#487858`**.<br>• hero ≥ 21.3 ΔE (Brann, protanopia), and ≥ 20 from Brann’s brass in every vision;<br>• gold ≥ 44.6; semantics ≥ 20.9 (heal, tritanopia); Bear ≥ 14.3;<br>• Movement II and III environment ≥ 18.1 in normal vision, lowest 11.1 (hound accent, protanopia); with the Abyss’s own colours (`ABYSS_HEX`) counted, as `colorVision.test.ts` does, it is 18.0 in normal vision (the fray) and 9.4 (the fray, tritanopia).<br>That lowest is under 15, so, by Brann’s rule (`colorVision.test.ts:228-283`), the model carries a seed-glow trim part `ORO_SEED`.<br>**Recorded deviation (W4):** `ORO_SEED` is `#a0f870`, and it is held to a weaker rule than Brann’s trim, because no colour light enough to glow meets the full brass rules (≥ 20 ΔE from every hero, gold, amp, lethal, threat and Bear in every vision). Measured (2026-11-08, `colorVision.test.ts`):<br>• ≥ 20 in normal vision from every enemy accent, the default telegraph and every vision’s threat and lethal (lowest 41.0, protanopia threat);<br>• ≥ 15 in every vision from the Movement II and III environment (lowest 20.2, Vharun’s accent, deuteranopia);<br>• ≥ 10 in every vision from every hero, gold, amp, lethal, threat, Bear, shield, heal and brass (lowest 11.1, amp under protanopia; heroes alone 22.2, Lyra, tritanopia).<br>The search behind it (every colour on an 8-step RGB grid): 32 colours pass the full rules, all near-black reds or deep violets, none a glow; among colours with luma ≥ 0.55 the best floor is 15.9 (`#70b800`), at the cost of the environment row (15.8). The seed is a glow on his staff, never a chip or a channel, so amp’s 11.1 is never read beside it. | Revision 1’s `#80b058` was 2.5 ΔE from Brann’s brass `#a6a650` under protanopia, which fails the shipped `colorVision.test.ts:312-330` the moment Oro is in CONTENT. It was also 5.7 from the Impaler accent (deuteranopia) and 9.3 from the Sentinel accent (tritanopia). |
| Harmonies, relics, events | None new. Red Line (02:266) is reachable as an archetype: Brann + Seren with Blood and Silk + En Garde (harness party R). | 03 §8 names no Seren or Oro Harmony, `relicPool` has no hero filter, and new events move pins. |
| Demo | The Rank-12 veteran has Brann, Seren and Oro recruited and their Bonds awarded. `testHook.veteran()` leaves Seren and Oro unrecruited for e2e. | The published demo shows the full roster; e2e still walks recruitment. |

## Engineering ground rules (the roster contract, extended)

5b’s seven rules (docs/phase-5b.md:90-113) and 5c’s and 5d’s still hold. This slice adds:

1. **Absent, not undefined.** All new hashed state is optional and lazy:
   - `hero.duel?` (Seren);
   - `hero.grove?` (Oro);
   - `Entity.summon?` (summon entities only);
   - `Shield.parried?` (a Riposte Chain Ward that has parried once);
   - `EnemyComponent.rootImmuneUntil?`;
   - `ledger.duel?` and `ledger.grove?`;
   - `world.internal.summons?`;
   - `field.ancient?` (only with Q2).

   `DamageResult.parried?` is a result field, never state. The spawn literal spreads `...(def.passive?.id === 'parry' ? { duel: newDuel() } : {})` and the grove equivalent beside Brann’s (`world.ts:1079-1080`). Brann’s own spread becomes `bloodRageOf(def) ? ...`, which is equal for every existing def. `forbiddenKeys` (`tests/sim/rosterInvariance.test.ts:43-56`) grows to match, and `rosterInvariance.keys.json` stays unchanged.
2. **No summon entity exists unless Oro is in the party.** Saplings spawn after the party loop (`world.ts:1003-1094`), so the allocator, the ids and the hashed spawn order (`hashing.ts:40-43`, `core/entities.ts:114`) are untouched for every other party. `updateSummons` returns at once without the summons list.
3. **Hooks are early `if`s that are false for every other hero**: `if (target.hero?.duel)`, `if (hero.grove)`, `if (target.summon)`, `if (source.summon)`, `if (world.internal.summons)`, `if (ability.id === 'lunge')`. `DamageOpts.melee` is an option, not state, and the melee shape test in `hitEntity` is computed only for a victim with `duel`. No shared expression is rewritten: each new test is its own line beside the existing one (the berserker guard, `noticeTelegraphs`’ `chance`, `pinned()`’s hero test, the guard and tether gates).
4. **Generic-but-inert behaviour lands in W0b with proof.** That covers:
   - the melee option and the `rooted` movement guard;
   - the summon-death guard and the `trySpecial` re-aim guard;
   - the splash and chain skips, the Severing skip and the status refusal;
   - the `ofParty` summon test, the guard and tether gate widening, and `pinned()`.

   W0b shows each is a no-op on every pin before any hero can trigger it.
5. **Draws.**
   - Seren’s dodge is the existing `rng.ai` roll, taken only when she is in the party. Her stance skip removes rolls only from Seren parties.
   - Thousand Cuts, Showboat, Lunge, Sapling AI, the Ancient and every Skilled roster rule draw nothing; picks are nearest, then id.
   - The Novice’s new draws are taken only with that hero in the party, and are appended immediately before the Cue draw (`novice.ts:378-382`).
   - Under Q2, Vexis’s Cued Starfall draws over a pool that widens only while `field.ancient` exists.
6. **Content is appended:**
   - heroes after Brann (`heroes.ts:388`);
   - talents, alternate Solos (ids in KNOWN_ALT_SOLOS, `sim/bonds.ts:38-43`, never in SoloKind) and scenes after Brann’s block;
   - motifs after `guard_strand` (`motifs.ts:286-296`), hero-gated before RNG (`run.ts:1895-1910`);
   - Deeds in a new `ROSTER_DEEDS` concatenated **last** in `CONTENT.deeds` (`index.ts:92`), after FINALE_DEEDS;
   - event choices as index 3.

   No existing def is edited. Brann’s hard-coded copy moves into `recruit.lockedText` and `fallbackText` **unchanged**.
7. **Characterisation first (W0a)**, including Brann parties (today only 5 goldens pin them).
8. **Interim rule.** Between W0b and W1/W2, Seren and Oro fall into the ranged branch (`heroes.ts:322-384`), as Brann did (docs/phase-5b.md:112). **No band, golden or bot test is recorded against a Seren or Oro party before W1, W2 and W7 merge.**
9. **File hand-over.** W0b edits files that later workstreams own (W4 `entities.ts` and `VfxLab.tsx`; W6 `hudBridge.ts`, `rosterModel.ts`, `sighting.ts` and `legionLook.ts`; W8 `harness-core.ts`), but only at the passive-narrowing lines listed in *contracts*. It lands first; the owners rebase on it and own every other line.

## Seren, the Riposte (`seren`)

*A duellist paying off a debt (02:307). She killed the wrong man in a fair fight, and now pays the Legion’s tithe one bout at a time, against the strongest thing in every room. She hums while she fences: always the same bar, never the end of it.* Role `duelist`.

### Stats

| Field | Value | Note |
|---|---|---|
| maxHp | **900** | plan. A Weaver Ward on her is 0.3 × 900 + 120 = **390**. |
| armor | 0.15 | ordinary hits only, never telegraphs |
| moveSpeed | 7.8 | |
| radius / height | 0.55 / 1.95 | slim and tall |
| color | `#a018f8` rapier violet; model coat and blade silver `#cbd5e1` (`SEREN_STEEL`) | see *Colour: Seren* |
| formation | `{forward 2.0, right -1.9}` | front-left |
| attack | `melee` rapier, **60** per **0.75 s**, range 2.2, no cleave | 80 dps (Kael 69, Lyra 90) |
| preferredRange | 1.2 | |
| threatMult | 1.0 | Kael’s 3 keeps bosses on him |
| dodge | **0.45** | never against a parryable blow aimed at her while Warded |

### Passive: Parry

`passive: {id:'parry', counterPct: 3, reach: 1, killShotRange: 9, killShotMult: 6, eliteExecuteBelow: 0.5}`

- **While Warded, the next melee blow aimed at her is parried and countered for 300%** (see *Decisions*).
- **A Perfect Ward on any blow aimed at her is a kill shot** (Q5), taken next tick unless she is disabled or the silence holds.
- `DuelState`: `{parryOn, killShotOn, quarry, quarryUntil, showboatQuietUntil, cutsEnd?, cutsFromX?, cutsFromZ?, cutsVisited?, parries, killShots, counterDamage, overextendedTime}`.

### Abilities, Call and Flourish

| | Lunge (`lunge`) | Feint (`feint`) |
|---|---|---|
| Effect | Dashes onto its target and strikes for 100. Against an interruptible caster within 3.5 m it is a contact thrust with no dash. It interrupts an interruptible cast. | A sure 2.5 m sidestep to its flank, then a 3 s hard taunt of it (normal and elite only) |
| Cooldown / cast | 8 s / 0 | 10 s / 0 |
| AI | `lungeTarget`: an interruptible caster within 9 m first, else the quarry 3.5-9 m away; within the clamp; no refusal. In a fight whose boss or miniboss has an interruptible special, interrupts only. | (a) an aimed, non-parryable telegraph on her: the sure step; (b) Warded, and her quarry is swinging at someone else: bait it into the parry |
| Visual | `attackFired {visual:'lunge'}` | `attackFired {visual:'feint'}` and a thin dashed taunt line |

**Call:** ability 0 (Lunge), answer **ward**, answerTime 2. The Call marks `lungeTarget`’s pick (the `calls.ts` dispatch).
- Lines: ‘Ward me. I’ll meet it.’ / ‘Steel on me, Weaver.’ / ‘Give me an opening.’
- Thanks: ‘En garde!’ / ‘Now we dance.’ / ‘Touché.’

The Call is her lesson: the Ward you answer with arrives with her, armed to parry the duel’s first swing.

**Flourish *Flèche*:** `damageMult 1.6`, `crit true`, `stun 1`. These are existing Flourish keys only (`schema.ts:355-367`).

### Solo: Thousand Cuts (`thousandCuts`)

`chargeTime 25, duration 4, pulse 0.5 (8 cuts), power 2.0 (120 a cut), reach 10, cuedPower 0.5 (s per kill), extendCap 4`. SoloKindSchema (`schema.ts:309`) gains `thousandCuts` and `wildgrowth` only.

- The pulse loop copies redFrenzy (`solos.ts:165-203`).
- Each blink goes through `pushPointOutOfObstacles` and `clampPointToArena` (`physics.ts:125, 143`).
- Her basic attack is suppressed through the `frenzy` gate (`heroes.ts:212`).
- `updateSolo` returns rooted = false. `tickSoloClock` ends it if she is stunned, and the Grand Silence ends it at once.
- With only a boss standing, all 8 cuts go on it.
- Autonomy uses the generic `cueGrace` path.
- Text: ‘Seren vanishes and strikes up to eight enemies, then returns.’ Cued: ‘Every kill buys another cut.’

### Quirk: Showboat (`showboat`, `leash 12, seconds 8`)

- She picks a duel in the duelist arm of `chooseTarget`, every tick: when she has no live quarry, or when a higher-tier enemy comes within 12 m of the Weaver. This covers wave 1 and single-wave boss fights.
- Bark ‘quirk’ 0.8 s before she goes: ‘That one’s mine.’ / ‘Finally, a real opponent.’ / ‘Stand aside. This one’s my debt.’
- Event `duelChosen {hero, target}` drives the duel tether.

### Movement (`role === 'duelist'`, her own branch in `combatMove`)

1. A Rally sends her to formation, through a separate `formationSidestep` line beside Brann’s.
2. Hold holds her.
3. If the quarry is swinging at her, she stands face to face at `preferredRange`.
4. If it is swinging at another hero, she stands at its **flank** (`flank()`), which also beats the Crimson Sentinel’s `frontMult 0.1`.
5. Then `sidestepOthers`.
6. Every destination is clamped to 13 m from the Weaver.

### Barks

| Bark | Lines |
|---|---|
| quirk | as above |
| lowHp | ‘First blood to them.’ / ‘Ward me — now.’ |
| saved | ‘I owe you one. I’m keeping count.’ / ‘Into the ledger.’ |
| perfect | ‘Kill shot.’ / ‘Your timing, my blade.’ |
| parried (new optional key, gated) | ‘Too slow.’ / ‘Parried.’ |
| cued | ‘Thousand Cuts!’ / ‘Hold still.’ |
| downed | ‘Seren is down!’ / ‘Not… paid yet…’ |
| revived | ‘Back on the ledger.’ |

### Codex and Needs

- **Codex:** ‘A duellist paying off a debt one bout at a time. Ward Seren and she stands her ground: the next blade swung at her is turned aside and answered threefold. Time the Ward Perfectly and she kills. She goes looking for the strongest enemy, outside your songs but never beyond your reach. When they surround her, Reel her home, or Rally: she always comes.’
- **Needs:** ‘Wards timed to her duels: a Ward parries the next melee blow, a Perfect Ward is a kill shot · Reel or Rally her when she’s surrounded · Focus moves her duel.’

### Bonds (appended to `src/content/bonds.ts`; ids to `KNOWN_TALENTS`, `src/sim/bonds.ts:11-36`)

| Rank | Talent A | Talent B |
|---|---|---|
| R3 | **Riposte Chain** (`riposte_chain`): a Ward on her parries twice before it breaks (`Shield.parried`). | **Cold Focus** (`cold_focus`): she Showboats only onto your Focus or an enemy inside your field. |
| R6 | **Bladesong** (`bladesong`): each counter also cuts every enemy within 3 m of her for 50% of it. | **Unflinching** (`unflinching`): while Warded she can’t be staggered, and your Wards on her last 1.5 s longer. |
| R9 | **Thousandfold** (`thousandfold`): Thousand Cuts strikes 12 times (6 s). | **Duellist’s Honour** (`duellists_honour`): a kill shot readies your Ward again. |

- **Alternate Solo (R10): Blade Waltz** (`blade_waltz`, in `KNOWN_ALT_SOLOS`): for 5 s every melee blow aimed at her is parried, Ward or not, and countered at 150%. Cued: 300%. For once she needs no Ward.
- **Scenes:** R2 *The Ledger* (`seren_ledger`): a book of names, one crossed out for every bout. R7 *Paid in Full* (`seren_paid`): the debt was her teacher’s, and she chose to carry it.
- **Bond motif: En Garde** (`en_garde`, 03:376): rare, `requires.hero:'seren'`, ‘Each parry grants {v} Resonance’, values [8, 10, 12]. Kill shots count as parries. The hook is `gainResonance(world, v, 'enGarde')`, the Hawk Eye pattern (`health.ts:1031-1033`), with `mods.enGarde` at 0 by default.
- **Deed: Debt Paid** (`debt_paid`, 0 points, in `ROSTER_DEEDS`): ‘Beat {encounter} with {hero}, parrying {n} blows’. The encounter is the Gorehound Matriarch, the hero Seren and n = 8. Every parry in that fight counts, the Matriarch’s Rend and her Pack Call hounds’ swings alike; the Deed’s text says so. It uses the new `heroTally` test.

### Recruit

`recruit: {event:'tithe_altar', fallback:'gorehound_matriarch', rank: 8, lockedText, fallbackText}`

## Oro, the Grovekeeper (`oro`)

*A gentle grovekeeper who hates fighting (02:308). The Rift unpicked his grove root by root; he held on to the last thread of it, and he names every Sapling.* Role `summoner`.

### Stats

| Field | Value | Note |
|---|---|---|
| maxHp | **950** | plan; a Ward on him is 405 |
| armor | 0.1 | |
| moveSpeed | 7.0 | |
| radius / height | 0.65 / 1.7 | short and broad |
| color | `#487858` deep moss, with the seed-glow trim `ORO_SEED` | see *Colour: Oro* |
| formation | `{forward -3.4, right 0}` | back centre |
| attack | `bolt` thorn, **48** per **1.3 s**, range 11, speed 22 | only at the Focus target (Gentle) |
| preferredRange | 9 | |
| threatMult | 0.6 | |
| dodge | 0.35 | |

### Summons (a new optional `summons` block on HeroDef)

| | Sapling (2) | Ancient (Wildgrowth) |
|---|---|---|
| life / armour | **380** / 0.2 | **2,000** / 0.3 |
| radius | 0.55 | 1.1 (height 2.6) |
| attack | melee 26 per 1.1 s, range 2.0 | slam 70 per 1.5 s, hits all within 3 m |
| hold | 3.5 m taunt pulse every 5 s for 2.5 s, refreshed on its target by each hit; normal and elite, non-heavy | re-taunts normal and elite, non-heavy enemies within 7 m every 1 s |
| root | none | 1.5 s on rising, within 7 m, normal and elite, non-heavy |
| lifetime | until felled; re-sprouts beside Oro 12 s later | uncued: until Wildgrowth ends (`finishSolo`; the Solo’s 8 s include the 1 s warning); Cued: 8 s from rising (Q2; 12 s under Q2’s fallback); World Tree: 4 s more either way |
| tended (Gentle, no Focus) | +50% damage | n/a |
| place | the Weaver’s front spots (5 m ahead, ±2.5 m) at fight start; re-planted there by a Rally | the Focus target if within 10 m of Oro; else the centroid of enemies within 10 m of him targeting the party; else 3 m in front of him. Clamped to 12 m from the Weaver, after a 1.0 s ground warning |

- **Sapling AI** (`updateSummons`, stepped right after `updateHeroes`, `src/sim/api.ts:94`, outside the Stasis gate):
  1. It is dormant if Oro is down or the silence holds.
  2. Otherwise it swings at the nearest non-stationary enemy in reach, preferring the Focus (stationary ones only when Focused).
  3. Then it pulses its taunt.
  4. Its swing is `summonDamage` = base × (1 + fx.damage) + fx.flatDamage, its interval ÷ (1 + fx.attackSpeed), with the tended bonus. Under Q1’s fallback, fx is the ‘thrive’ numbers.
  5. It never takes Empower, crit, Bonds, relic damage or the hero-only amplifiers.
- **Statuses:** none; `addStatus` refuses summons.

### Passive: Rootbond

`passive: {id:'rootbond', mendShare: 0.5}`

- **Your Thread on Oro, in Mend mode, also Mends each living summon at 50%.**
  - It runs in `updateThread` after `mendHero(...)` (`thread.ts:387`), in the Prism Loom spill pattern (`:388-399`), through a summon-safe `mendSummon` with its own `mendHealAcc`. W0b places the call; `grove.ts` owns the body.
  - It is credited as Thread healing and to Oro’s `supportReceived`, and adds the usual healing threat.
- **No spill:**
  - under Unravel (skipped, as the Relay heal is, `thread.ts:52-57, 173-183`);
  - in Bear or Empower mode;
  - while the Thread is cut (Snip, or a Severing cut);
  - through the Prism spill;
  - onto a felled Sapling (it never revives).
- `GroveState`: `{saplings: EntityId[], respawnAt: number[], ancient: EntityId | null, lost, ancients, rootbondHeal, inFieldTime, aliveTime}`. `ancients` counts the Ancients raised this fight (W2 increments it where the Ancient spawns); `outcome.ts` reads it for `HeroGroveStats.ancients`.

### Abilities, Call and Flourish

| | Regrowth (`regrowth`) | Bramble (`bramble`) |
|---|---|---|
| Effect | Re-sprouts a felled Sapling beside him at 60% life; with both standing, heals the more hurt one for 40% of its life (via `'solo'`, no Weaver credit) | A 3 m bramble patch: roots normal and elite, non-heavy enemies inside for 1.5 s and pricks them for 40 |
| Cooldown / cast / range | 12 s / 0.6 s / 12 | 14 s / 0.4 s / 10 |
| Gentle | always allowed | at the Focus; without one, only on an enemy within 4 m of Oro or a Sapling |

**Call:** ability 0 (Regrowth), answer **chime**, answerTime 2.5. It opens only when a Sapling is felled or below 60% (`groveCallReady`, through the `calls.ts` dispatch).
- Lines: ‘Ring for them, Weaver, they’re listening.’ / ‘A little rain?’
- Thanks: ‘There, little one.’ / ‘Green again.’

**Flourish *Spring Rain*:** `damageMult 1.5` (read as Regrowth’s power) and `soloCharge 20`, both existing keys.

### Solo: Wildgrowth (`wildgrowth`)

`chargeTime 28, duration 8, radius 7, pulse 1, power 1.5 (root s), cuedPower 6 (Q2 disc radius)`

- Charge: while he **or a Sapling** is engaged; it fires uncued on autonomy under the same rule.
- Uncued: the Ancient rises, roots, taunts and slams, and leaves in `finishSolo` (`groveSoloEnd`; World Tree keeps it 4 s more, then it roots again as it goes).
- Cued: Q2 (the default) or its fallback. The Cued Ancient keeps its own clock, 8 s from rising (Q2’s ‘for its 8 s’), so its disc outlasts the Solo by the warning.

### Quirk: Gentle (`gentle`, `retreat 4`)

- With no Focus, he steps 3 m away from any enemy within 4 m (his own rule; ranged `kite` is unchanged). A Rally or Hold overrides it: he obeys both, as every hero does.
- Bark ‘quirk’ when he refuses melee, throttled to once per 10 s: ‘I won’t. Not unless you ask.’ / ‘Let the roots hold them.’
- A new optional `focus` bark plays when you Focus: ‘If I must.’ / ‘Forgive me.’
- A closed-leaf glyph shows while he tends.

### Barks

| Bark | Lines |
|---|---|
| lowHp | ‘The roots are drying…’ / ‘Oh, that one bit.’ |
| saved | ‘You keep the grove alive.’ |
| perfect | ‘Not one leaf.’ |
| cued | ‘Wake, old one!’ / ‘Wildgrowth!’ |
| downed | ‘Oro is down!’ / ‘Look after them…’ |
| revived | ‘Still rooted.’ |
| saplingFelled (new optional key, at most once per 8 s) | ‘No — not Moss!’ (names from a fixed list, by index) |

### Codex and Needs

- **Codex:** ‘A gentle grovekeeper who hates fighting. Oro plants two Saplings ahead of you, and they hold off the small things that bite. Keep your songs over them and they flourish; Rally and they re-sprout in front of you. Your Thread on Oro Mends them too, at half. He won’t raise a hand unless you set a Focus; until then his Saplings fight for him, and harder. Bosses and the biggest foes ignore them.’
- **Needs:** ‘Keep his Saplings in your field · Rally to re-plant them ahead of you · Mend Oro and your Thread Mends them at half · Focus wakes him · bosses ignore the Saplings.’

### Bonds

| Rank | Talent A | Talent B |
|---|---|---|
| R3 | **Taproot** (`taproot`, the plan’s *Deep Roots*, Q7): Saplings have +40% life and re-sprout 4 s sooner. | **Thorned Bark** (`thorned_bark`): enemies that strike a Sapling take 30% of the blow back. |
| R6 | **Grove Chorus** (`grove_chorus`): while both Saplings stand in your field, his Solo charges 50% faster. | **Old Growth** (`old_growth`): a Sapling that has stood 20 s grows old: +50% life and damage. |
| R9 | **World Tree** (`world_tree`): the Ancient stands 4 s longer and roots again as it falls. | **Seedling Swarm** (`seedling_swarm`): he keeps 3 Saplings, each with 25% less life. |

- **Alternate Solo (R10): Homecoming** (`homecoming`, in `KNOWN_ALT_SOLOS`): every Sapling re-sprouts at full life at the Weaver’s front spots with a 30% barrier, and all taunt for 4 s. Cued: heroes within 6 m of the Weaver also gain a 15% barrier.
- **Scenes:** R2 *Names* (`oro_names`): he introduces each Sapling. R7 *The Last Grove* (`oro_last_grove`): the thread he held in the Rift was the last root of his grove.
- **Bond motif: Verdant Choir** (`verdant_choir`, 03:377): rare, `requires.hero:'oro'`, values [30, 40, 50]. Q3 sets its runtime.
- **Deed: Not a Leaf Lost** (`not_a_leaf_lost`, 0 points, in `ROSTER_DEEDS`): ‘Beat {encounter} with {hero}, losing none of his Saplings’. The encounter is the Frayed Court, the hero Oro, at most 0. The Court’s Shears and Choristers are normal and elite melee foes the Saplings must hold (`unstitchedRun.ts:184-198`). Revision 1 used the Seamstress, where nothing can fell a Sapling (a lone miniboss, `unstitchedRun.ts:221-227`).

### Recruit

`recruit: {event:'loose_thread', fallback:'the_seamstress', rank: 12, lockedText, fallbackText}`

## The summon model (items needing your answer are marked ⚑)

| System | Sees summons? | Inert because |
|---|---|---|
| Entity store, physics, spatial hash, hashing | yes (generic); planted bodies are pinned | no summon exists without Oro |
| `world.party`, PartySlot, keys 1-3, Thread, Ward, Reel, Chime, Cue, Rewind, Swap, Anchor | **no** | by construction |
| Threat table, `engage()` | **no** | by construction |
| Enemy basics | yes, through `tauntTarget` (normal and elite, non-heavy) | the taunt is never a summon id |
| Enemy specials | re-aimed at a hero (`trySpecial`) | `target.summon` is false |
| Telegraph victims, raids, marks, links, Discord, the Shatter Aria quorum, Void Maw pull, possession, Doom | **no** | `candidates()` unchanged; `zones.ts:53-54` is hero-and-Weaver only |
| Enemy bolt splash and chain | **no** (`hits.ts:45-50, 56-62`) | the skip is `e.summon`, never set |
| Statuses | **none** | `addStatus`’s summon refusal is never reached |
| Severing | a blow on a summon never cuts | the `!target.summon` test is always true today |
| Damage in | `dealDamage`, generic: armour applies; no Fermata guard or hold, Haloed, Close Ranks or Oathkeeper | those branches are `target.hero`-gated |
| Death | `summonFell` before `killEnemy` | `target.summon` is false |
| Damage out | `partyDamage` on Oro’s slot, no threat, no Bond; guard arcs and tethers apply; hero amplifiers don’t | `source.summon` is false |
| Healing | `heal()`, generic; Weaver credit and healing threat via team `party`; adds to Oro’s `supportReceived` | |
| ⚑ Aura reception | Q1: Saplings hear your songs; the Ancient only while its Cued disc stands (it stands in it), never uncued; a held summon (dormant or burrowed) hears none | the loop runs only with summons |
| ⚑ Ancient disc as your field | Q2 | `field.ancient` is absent |
| ⚑ Verdant Choir | Q3 | `mods.verdantChoir` is 0; the motif is hero-gated |
| Rootbond | Mend spill | `hero.grove` is absent |
| Rally, Hold, Scatter | Rally re-plants; Hold and Scatter don’t move them | one guarded line in `commands.ts:92-100` |
| Stasis | their clocks keep running (`ofParty`) | the summon test is never true |
| Sunrise, the Cued dome, the Vow, Shared Wounds, Glass Halo, the Sphere, Reignite revive | **no** | they loop `world.party` |
| Ledger timeline, counterfactual, defeat (`director.ts:215-224`) | **no** | by construction |
| Grand Silence | dormant; the Ancient withers | the guard is in `updateSummons` |
| Budget | 2 Saplings (3 with Seedling Swarm) and 1 Ancient | sim-bench `grove-peak` p95 ≤ 1.5 ms |

## New sim primitives (where, gate, why inert)

| Primitive | Where | Inert because |
|---|---|---|
| `DamageOpts.melee` and `parryable(attack)` | `enemies.ts:400`; `hitEntity` (`telegraphs.ts:417-443`) only for a duel victim | not state; the only reader is the parry branch |
| Parry intercept, `DamageResult.parried?` | `health.ts`, after `:751`; one `duelResolved` line in `hitEntity` | `target.hero?.duel` is absent |
| Deferred counter and kill shot | `heroes.ts`, lazy hook after `isDisabled`; `perfect()` marks `killShotOn` beside `telegraphs.ts:600-601` | `hero.duel` is absent |
| Duelist branch: Showboat, clamp, flank, Lunge, Feint, stance | `heroes.ts` role arms → `duel.ts`; new cases in `tryAbilities` and `executeAbility` (`:955, 1073`); one stance line in `noticeTelegraphs` | no duelist in the party |
| Call dispatch | `calls.ts:54, 95` (`lunge`), `canCall` (`regrowth`) | no such ability id in any existing kit |
| Thousand Cuts | `solos.ts` dispatch (`:99-117`); `castProgress` reads `duel.cutsEnd` | unused Solo id |
| Summon entity, `updateSummons`, `summonFell`, credit, physics pin | `state.ts`, `grove.ts`, `summons.ts`, `api.ts`, `health.ts`, `physics.ts` | no summon spawns |
| Summon skips | `hits.ts` splash and chain; `enemies.ts:406` Severing; `addStatus`; `stasis.ts:13-15` | no summon exists |
| Guard and tether gates | `health.ts:792, 795` (`source?.hero \|\| source?.summon`) | no summon source |
| Special re-aim | `enemies.ts` `trySpecial` | `target.summon` is false |
| Enemy root `rooted` and the heavy rule | `addStatus` tier and heavy rule; `enemies.ts:320-331, 1419` | nothing applies it without Oro |
| Summoner charge and autonomy | `heroes.ts:131, 140, 262` | `hero.grove` is absent |
| Rootbond | `thread.ts`, after `:387` | `hero.grove` is absent |
| Rally re-plant | `commands.ts:92-100` | `world.internal.summons` is absent |
| Q1-Q3 | `field.ts`, `auras.ts` (W2b), or the fallbacks in `grove.ts` | gated as above |
| Mods `enGarde`, `verdantChoir` | `mods.ts` | 0; NO_MODS test |
| Events `parried`, `parryCountered`, `killShot`, `duelChosen`, `overextended`, `summonSpawned`, `summonFell`, `gentleRefused`, `rooted` | `events.ts` | never emitted |

## Recruitment and unlock Ranks

| | Seren | Oro |
|---|---|---|
| Opens | Rank 8 (`recruit.seren`, kind `recruit`, blades icon), beside the Martyr (`callings.ts:107`) | Rank 12 (`recruit.oro`, leaf icon), an empty Rank today, shared with the coming Conductor Calling |
| Event choice | `tithe_altar` choice 3 `debt`, ‘Pay a stranger’s debt’: ‘A duellist in silver kneels at the altar, paying a tithe that isn’t hers. An elite fight. Win, choose one of 3 relics, and she joins your heroes for your next runs.’ | `loose_thread` choice 3 `follow`, ‘Follow the thread’: ‘Something on the other end is holding it: an old man in moss, bound in the thread, and a court of things that won’t let go. An elite fight. Win, choose one of 3 relics, and he joins your heroes for your next runs.’ |
| Effect | `fight legion_vanguard, relics 3, recruit 'seren'`, `rank 8` (no other altar choice fights) | `fight frayed_court, relics 3, recruit 'oro'`, `rank 12` (`pull` fights `unstitched_vanguard`) |
| recruitedText / partyText | ‘An elite fight. Win, and choose one of 3 relics.’ / with Seren in the party: ‘Seren pays the altar a coin. Old habit.’ | the same / with Oro in the party: ‘Oro winds the thread around his finger. Still warm.’ |
| Fallback | any result against the Gorehound Matriarch, at Rank ≥ 8 | any result against the Seamstress, at Rank ≥ 12 |
| Fallback line | ‘Seren watched you face the Matriarch. She’ll fence for you next time.’ | ‘The Seamstress dropped a thread with a seed on its end. Oro followed it to you.’ |
| Locked Codex text | ‘A duellist in silver. From Rank 8: the Tithe Altar in Movement II, or the Gorehound Matriarch.’ | ‘Someone holding a thread in the Rift. From Rank 12: the Loose Thread in Movement III, or the Seamstress.’ |

**Schema.**
- `recruit` becomes `{event, fallback?, rank?, lockedText?, fallbackText?}` (`schema.ts:448`).
- `EventChoice.rank?` is added.
- Lint:
  - a recruit with `rank` needs its event choice to carry the same `rank`;
  - a ranked choice must come after every unranked choice;
  - a recruiting choice’s encounter must be fought by no other choice of the same event (this would have caught revision 1’s `follow`);
  - every recruit needs `lockedText` and `fallbackText`.
- Brann gains his two strings exactly as they are hard-coded today (`rosterModel.ts:211, 266`).

**The gate.**
- The allowance check covers the choice: `eventChoiceProblem` defaults its allowance to EVERYTHING.
- `recruitsOf(run, allowance?)` leaves out ranked recruits when called with no allowance, so `tests/meta/roster.test.ts:188-245` is unchanged. `runStore` passes the profile’s allowance, built after `award(xp)` (`runStore.ts:381-391`), so a Rank reached in that fight counts.
- `profileStore.recruit` (`profileStore.ts:412-424`) keeps the same filter, plus unlockAll.
- `recruitsOf` rescans results, so an earlier fallback in the same run then counts too. This is tested, and the Result says ‘Word of your fight reached her.’

**Reach.** Over 400 Finale-route seeds (scratch `events.ts`), the Tithe Altar appears on 200 runs and the Loose Thread on 197. The fallbacks are on every road, so a Rank 8 player who reaches Movement II recruits Seren that run.

**Event screen.** Hidden choices are filtered before the column rule (`EventScreen.tsx:175`), so 3 visible choices lay out as today. 4 visible choices lay out as 2 × 2 (`md:grid-cols-2`) rather than wrapping a 4th under 3 columns.

**Join moment:** from the next Prep, as Brann. It is shown by the Result recruit line, the Prep FreshStrip (`hero.<id>`) and the first fight’s New ally card (`ally:<id>`).

## Roster, Prep and saves

- `heroRoster`, `legalParty`, `canonicalParty`, `setParty` and `embark` are generic and unchanged (`profile.ts:83-86`, `run.ts:843-893`). C(6,3) = 20 parties are legal.
- **Prep:**
  - the picker becomes a 3 × 2 grid (`PrepScreen.tsx:572` was `min(cards, 4)`);
  - the Passive row icon depends on the passive id: flame, blades or leaf (hard-coded today at `PrepScreen.tsx:701`);
  - Oro’s card gains a Saplings row: ‘2 Saplings · 380 life · take your songs · bosses ignore them’;
  - party notes come from kits through `partyHasDome` (`src/content/index.ts:306-312`) and two **new** helpers beside it, `partyTaunts` and `partyInterrupts`. They replace MISSING_NOTE’s Brann wording (`rosterModel.ts:110-114`): for example, ‘No Kael: nothing holds the bosses.’, ‘No Lyra: Seren’s Lunge is your interrupter.’, and Q8’s OB note.
- **Profile v9 and run save v5:** no bump.
  - `recruited` and `lastParty` already hold any known id (`save.ts:799-815`).
  - Result heroes gain optional `duel?: {parries, killShots, counterDamage, overextendedTime}` and `grove?: {saplingsLost, inFieldShare, rootbondHeal, ancients}`, carried end to end like `blood` (`types.ts:358-418`, `outcome.ts:41-43`, `run.ts:2145-2157`, `save.ts:256-272`). DeathRecap gains optional `duel?` and `grove?`.
  - A run resumed at a `tithe_altar` or `loose_thread` node gets the 4-choice list; choices are keyed by id, and the new one is last.

## Deeds, Codex, Summary lines, recaps

- **Deeds:**
  - A new `heroTally` test `{hero, encounter, stat, atLeast?, atMost?}` in DEED_TESTS and its needs Record (`schema.ts:970-1010, 2231-2242`) and in `deedHolds` (`deeds.ts:70-99`).
  - `ROSTER_DEEDS` is concatenated last (`index.ts:92`), so CONTENT.deeds keeps its first 27 in order. Count 27 → 29.
  - Hidden until the hero is in the roster (`deedsInSight`, `routeText.ts:390-399`).
- **Codex:**
  - Heroes pages with Passive and Needs rows, where `passiveRow` is narrowed by id. Parry: ‘While Warded, the next melee blow on her is parried and countered for 300%.’ Rootbond: ‘Your Thread on Oro also Mends his summons at 50%.’
  - An Oro sub-entry: ‘Saplings and the Ancient’.
  - Terms: Parry, Kill shot, Showboat, Sapling, Ancient, Rooted, Rootbond, Tending, Heavy.
- **Result and Summary:**
  - `duel-line`: ‘Seren · parries 14 · kill shots 3 · your Wards dealt 4,210 · overextended 6 s’ (the overextended part only when above 0). It names seconds, not ‘6×, brought home 5’: the Result keeps `HeroDuelStats` `{parries, killShots, counterDamage, overextendedTime, wardsDealt?}` (the W0b contract), which holds no count of overextensions and no count of times she was brought home. Counting those would need new DuelState and HeroDuelStats keys (sim and meta), not a UI change.
  - `grove-line`: ‘Oro · Saplings in your songs 74% · felled 3 · Rootbond 1,120’, and ‘· Ancients N’ when above 0.
  - Aggregated by `runDuel` and `runGrove` (the `runBlood` pattern, `rosterModel.ts:280-311`).
- **Down recaps** (`downAdvice`, `run.ts:2193-2216`; `resultText.ts:97-108`):
  - Seren, unwarded, by a parryable blow: ‘Ward her as the blow lands: a Ward is a parry.’
  - Seren, overextended: ‘Reel or Rally her out of the pack, or Cue Thousand Cuts.’ For the Chronomancer: ‘Rally her, or Rewind as the pack closes.’
  - Seren, by a far beam: ‘Reel or Ward the beam on her.’
  - Oro, caught in melee: ‘Rally: his Saplings re-plant ahead of you and screen him.’
  - Saplings felled outside your field: ‘Keep his Saplings inside your songs.’
  - The Thread cut by a Severing elite while Oro is Threaded: ‘A Severing foe cut your Thread, and Rootbond with it: Ward or kill it first.’
  - The gate is 100% of downs naming an answer.
- **Finale lines:**
  - **The epilogue.** `epilogueLines` takes the first party hero with a line (`EpilogueView.tsx:44-45`), and every 3-of-6 party holds a starter or Brann. So the new lines go in a separate `RECRUIT_LINES`, checked **first**: Seren ‘You call it rest. I call it forfeit.’; Oro ‘Even the grove sleeps, and then it wakes.’ Seren speaks when both are present (canonical order). Every existing party is unchanged.
  - `REIGNITE_BARKS` (`conductorBoss.ts:105-110`): Seren ‘Again!’; Oro ‘Grow!’, appended records keyed by hero.

## How the Weaver answers each hero

| Hero | Verb | What the Weaver sees | Lesson |
|---|---|---|---|
| Seren | Answer her Lunge Call with a Ward | Call bubble; she arrives Warded, crossed blades lit | the Ward goes on before the duel |
| Seren | Ward before her mark swings | crossed-blades glyph on the parryable cone; her en-garde stance, holding her ground | Ward = damage |
| Seren | Perfect Ward | Perfect ring; next tick a leap or lance, KILL SHOT, a gold number | the skill ceiling |
| Seren | Reel, Rally, Cue (or an early Rewind) | ‘Overextended · Reel’ chip, red notch on her ring | she never leaves a losing duel on her own |
| Oro | Field over the Saplings | aura rim arcs (or the thrive leaf) on each Sapling; pips on his frame | coverage is positional |
| Oro | Rally to re-plant | burrow trail; Saplings sprout ahead of you | Rally’s second meaning |
| Oro | Mend-Thread Oro | green motes along his root tethers | Rootbond |
| Oro | Focus to wake him | the closed-leaf glyph opens | Gentle |
| Oro | Chime his Call | Spring Rain | Call and Response |

## Every beat, its verb and its answer

**Conventions.**
- Damage uses 5d’s convention of Movement scale × Threat row (docs/phase-5d.md:225-233): Bellwarden ×1.225, Cantor ×1.3, Vharun ≈ ×1.188, Movement III ×1.05, the Unweaver ×1.15, the Finale ×1.05.
- Seren’s Ward is 390; Oro’s is 405.
- ‘Parry’ applies to a parryable blow aimed at a Warded Seren.
- Summons never take telegraphs, and bosses and heavy foes ignore them.

### Movement I

| Beat | With Seren | With Oro |
|---|---|---|
| Bellwarden Bell Slam (cone on current, 858) | Kael’s; she flanks and sidesteps it. Without Kael, as current: Ward → parry; Perfect → kill shot (6×). | rarely current (threat 0.6): Ward + Mend, Perfect. In OB, on Lyra or Vexis: Ward + Mend survives (858 < 820 + 366) |
| Toll Outward (burst r 6.5) | not aimed: dodge 0.45, Ward, Rally | he retreats; Saplings unhit |
| Toll Inward (donut r 16), Cracked Bell | Rally (she obeys) | Rally also re-plants the Saplings |
| Resound (pair link r 6) | Scatter; usually apart already | Scatter |
| Call the Choir | she stays on the boss unless Focused; Kael’s cone is flanked | **Saplings taunt the choristers; Bramble roots them** |
| Cantor Toll (cone, 1,430; lethal from full through a plain absorb) | Kael’s. As current: **a plain Ward parries it whole**; Perfect; dome; Reel. | lethal through a Ward: Perfect, dome, Reel out of the cone, Chime immunity (`techniques.ts:284`). OB: Perfect, Reel or Chime on Lyra or Vexis (Q8) |
| Dirge (mark 50%, randomNonTank) | Chime | Chime |
| Silent Verse | Rally into a circle; Cold Focus keeps her in | **Rally re-plants the Saplings ahead of you, inside the circle you stand in**, or they lose your songs |
| Requiem (raid 90%) | the dome covers her anywhere (`solos.ts:71-78`), or Crescendo | the same; Saplings unhit |
| Mute domes | — | blank Sapling coverage like anyone’s (Q1 default and fallback alike) |

### Movement II

| Beat | With Seren | With Oro |
|---|---|---|
| Matriarch Rend (cone 300 + bleed) | parry (no bleed) | Ward |
| Pounce (leap on squishiest, 560) | she is squishiest only without Lyra and Vexis: Ward or Perfect | Saplings are never in the pool |
| Pack Call hounds (melee basics) | **parry fodder**: Ward → counter (outside boss-blow windows, see `serenParryWard`) | **Saplings hold the hounds**; hounds’ bleeds never land on them |
| Vharun Twin Cleave (≈1,010 × 2, re-aims) | Kael’s. Without Kael, as current: Ward parries blow 1. Blow 2 needs a Reel, Feint’s sure step, Chime immunity, or Echo Ward re-arming the parry. A Perfect on blow 1 is a kill shot (6×, boss) plus stagger. | rarely current; in OB: Perfect, Reel or Chime per blow (Q8) |
| Blood Pact (pair r 6) | Scatter | Scatter |
| Impale (beam at farthest, pin) | often her; the clamp keeps the Reel in reach | often Oro: Reel |
| Bloodmoon | Rally into the pools | **Rally re-plants the grove ahead of you, in your pool** |
| Crimson Tide (r 30, not parryable) | step, Ward, Rally | the same; Saplings unhit |
| Execution (lowestHp below 40%) | keep her above 40%; Chime | summons never picked |
| Crimson Sentinel guard (frontMult 0.1) | she flanks; a front kill shot glances | Sapling hits glance off the front too (guard gate): Focus a flanker |

### Movement III

| Beat | With Seren | With Oro |
|---|---|---|
| Shears dash (threadLine, else farthest) | Reel or Ward | Thread someone near |
| Severing elites | parry negates the blow, so no cut | a blow on a Sapling never cuts; Ward or kill the elite before it reaches the Thread (cut recap) |
| Void Maw (stationary, Inhale) | **Showboat skips it** unless Focused; Reel her out (`mawRescue`) | Gentle keeps him out; Saplings aren’t pulled and ignore it unless Focused |
| Doubt Wraith (4 s cast, possession) | **Lunge interrupts** (any range to 9 m) | Focus it; Bramble roots but doesn’t interrupt |
| Null Priest (Weaver silenced) | no Ward means no parry: Lunge kills or interrupts | Saplings hold it (normal) |
| Mimic, Doom | as default | as default; Doom ignores non-heroes |
| Seamstress Needle Rain, Stitch, Unpick | step or Ward; Scatter; Mend. Stitch’s root ends Showboat | the same; Rootbond is off while the Thread is cut |
| Unweaver Shear (cone 869) | parry; Perfect (6×, boss) | Ward + Mend |
| Snip | — | Rootbond off for 3 s |
| Spindles (stationary, 75% DR) | skipped: Focus them (the existing answer) | Saplings ignore them unless Focused, and the tether cuts their hits too |
| Steal Verse / Stolen Verse (r 16) | Lunge reaches it; Focus | the Ancient’s disc honours `field.stolen` (Q2, through `chordMask`) |
| Unravel | — | no Rootbond spill: switch to Empower |
| Mirror Weave: the Hollow Champion (**normal tier, heavy**, 12,000 life; basic 100 per 1.4 s; cleave ≈1,057) and the Mirror Ward | **The designed beat: Feint the champion (it is normal tier, so the taunt holds) → Ward → parry. A Perfect kill shot deals 6× and never executes it (heavy).** Lunge interrupts the Mirror Ward from contact. | Saplings and the Ancient **ignore** it (heavy). Its specials and basics go to heroes as today: Ward that hero, and Focus it so Oro thorns it. |

### The Finale

| Beat | With Seren | With Oro |
|---|---|---|
| Downbeat (cone on current, 630) | Kael’s; without Kael, parry | Ward |
| Sforzando (beam at farthest, 336) | step or Reel | survivable; step |
| Lament (mark, randomNonTank) | Chime | Chime |
| Basso Ostinato (circle on current, 1,050; not parryable) | Ward (660 lands, she lives) or Perfect | the same |
| Cadenza (beam at farthest, 110%, lethal) | **Reel (always in reach)**, Lunge or Focus the Tenor, Perfect | Reel or Focus |
| Shatter Aria (r 4.5, quorum 2) | Scatter | Scatter; summons never count |
| Discord | a parry counts as answered (`duelResolved` calls `answered`) | as default |
| Fortissimo Silence (raid 3 × 40%) | dome 792 (lives); dome + Ward 402; no dome, Ward + Mend 420 (lives); Bear 702 (lives); Crescendo cancels | dome 836; dome + Ward 431; Ward + Mend 465; Bear 741; Crescendo. Saplings unhit. |
| Grand Silence notes | frozen ≤ 13 m from the Weaver, so Ward and Reel notes reach; no melee, so no parry; a Perfect is still a note, and **its kill shot is lost** (stilled) | the grove sleeps; never notes |
| Mirror choir Solos | Lunge interrupts (held for them) | Lyra or Kael when present; in W, Seren |
| Last burn | Thousand Cuts: 8 cuts on the boss alone | the Ancient taunts nothing; Cue for Q2 |

### By Calling (and the Reel variants)

| Calling | Seren | Oro |
|---|---|---|
| None | Ward duels, Perfect kill shots, Reel inside 14 m (guaranteed by the clamp), Rally | field placement, Rally, Mend Oro, Focus |
| Luminary | Radiance, Haloed and Eclipse need her in the field: Wide Choir reach or Cold Focus brings her in. Sunrise heals her anywhere. | wider fields cover the grove (Q1); under Q2, the Ancient’s disc is a field for Radiance and Haloed too; Sunrise doesn’t heal Saplings |
| Martyr | a parried blow deals 0, so nothing is borne: Bear her when unwarded. The Vow holds her. | Rootbond needs Mend mode; the Vow and Shared Wounds are hero-only (Shared Wounds reaches heroes in the Ancient’s disc under Q2) |
| Chronomancer | **her Calling**: the 0.45 s window means more kill shots; Echo Ward re-arms the parry; Stasis freezes her mark’s swing. Rewind replaces Reel and returns her to 3 s ago (`callings.ts:189`), so it is a life answer and an extraction only when used as the pack closes; **Rally is her extraction**, and the bot and hint say so. | Rewind and Stasis never touch summons; summon clocks keep running in Stasis, so frozen enemies keep being struck |
| Chronomancer + Paradox | Paradox undoes every attack aimed at the Rewound hero, and with it the parry and kill shot: Ward her, Paradox the others | as above |
| Anchor (Reel variant: 50% less damage for 3 s, `variants.ts:49-53`) | no pull: Rally is the overextension answer (hint); Anchor buys the 3 s she needs to obey it | Rally re-plants as usual |
| Swap (Reel variant, `variants.ts:42-47`) | swapping into her duel puts the 360-life Weaver beside the strongest enemy: a hinted non-answer, never a bot choice (the mawRescue pattern, docs/phase-5c.md:303-307) | a normal answer; summons don’t move |

Every row has at least one answer per beat.

### By party

| Party | Interrupters | Dome | Boss holder | Note |
|---|---|---|---|---|
| SA (Kael, Vexis, Seren) | Kael, Seren | Kael | Kael | duellist reference |
| SB (Lyra, Vexis, Seren) | Lyra, Seren | none | threat (Seren usually), who parries | Ward her boss blows; Crescendo mandatory |
| SC (Kael, Lyra, Seren) | all three | Kael | Kael | |
| OA (Kael, Vexis, Oro) | Kael | Kael | Kael | damage-light (party A’s lesson): Focus matters |
| OB (Lyra, Vexis, Oro) | Lyra | none | **none** (threat: Lyra or Vexis) | the hardest party (Q8); Prep note |
| OC (Kael, Lyra, Oro) | Kael, Lyra | Kael | Kael | |
| R (Kael, Brann, Seren) | Kael, Brann, Seren | Kael | Kael | Red Line; three melee heroes |
| SO (Kael, Seren, Oro) | Kael, Seren | Kael | Kael | |
| X (Brann, Seren, Oro) | Brann, Seren | none | threat (Brann 1.2, Seren parries) | no starter |
| W (Vexis, Seren, Oro) | Seren (Lunge held for boss casts) | none | threat (Seren usually), who parries | the no-Kael, no-Lyra case |

`partyHasDome` stays Kael-only, so 10 of the 20 parties read `decreeNoDome` (`legionLook.ts:97-145`).

## Presentation

### Render (`src/render`, primitives only)

- **Models** (`library.ts`). Greyscale silhouettes must differ from every hero (`renderBrann.test.ts:241-283`).
  - `case 'duelist'`: slim and tall; a long rapier forward, its tip ahead of every hero’s box (`min.z`); a fitted coat with a split tail; a raised off-hand. The coat and blade are `SEREN_STEEL` (silver, the plan’s colour); the sash and blade edge are her violet.
  - `case 'summoner'`: short and broad; bark robe, moss mantle (`#487858`), branch crown, a staff with the `ORO_SEED` seed glow (the trim part his Movement II and III measure requires).
  - `buildSapling()`: a knee-high stump with leaf ears.
  - `buildAncient()`: a 2.6 m tree-golem.
- **Records.**
  - A `summon` branch in `createRec` before the dummy fallback (`entities.ts:658-718`), with batches `summon:sapling` (capacity 8) and `summon:ancient` (2), created **lazily on the first `summonSpawned`**. The budget becomes ‘no new FX batches; two lazy model batches’. The e2e ≤ 220 draw calls (`smoke.spec.ts:528`) is re-measured for an Oro party and re-proved unchanged for the default.
  - The per-aura rim arcs (`entities.ts:1820-1898`) are factored into a helper fed `auraMask`, so a covered Sapling reads exactly as a hero does. Arcs grey when it is outside the field. Under Q1’s fallback, a single leaf rim stands in.
- **Seren:**
  - notched ring in her violet;
  - crossed-blades en-garde sprite while parry-armed (shape, never cyan or silver);
  - parry: a white-steel flash and counter swipe, lagged 0.12 s like `riposte()` (`bonds.ts:177, 827-880`), as a new `duel()` method, never `riposte`;
  - kill shot: the leap streak (`travel(...,'charge')`) or a lance, a star, 0.08 s hit-stop and KILL SHOT / EXECUTED;
  - Thousand Cuts: the model hides, afterimages come from the ghost pool (`entities.ts:958-972`), with a gold edge when Cued;
  - Showboat: a dashed violet tether and a ‘duel’ crown on her quarry;
  - overextended: a red notch pulse;
  - a faint 14 m reach arc while she is more than 10 m from the Weaver;
  - a crossed-blades glyph on parryable telegraphs aimed at her, drawn only with Seren in the party;
  - a ‘heavy’ pip on the Hollow Champion’s bar with Seren or Oro in the party.
- **Oro:**
  - root tethers (BEAM.dashed, moss) to each Sapling;
  - Rootbond motes along them. The `healed` handler branches on a summon target, so it never pulses the Thread (`feedback.ts:1517`) and is never a Weaver heal burst;
  - a burrow trail on Rally;
  - the Ancient’s ground warning, taunt ring and root vines on enemies (the stake sprite look);
  - **Q2’s disc as its own lazily created decal mesh** (dashed, with a bark rim), never a slot in the field shader. `MAX_FIELDS` stays 4 (`render/field.ts:242`), and the default party’s uniforms are byte-identical;
  - the tending leaf glyph;
  - summon damage floaters are important-only.
- **Bars over heads:** the hero overlay pool stays 4 (`overlay.ts:379`). Summon bars use a **separate pool, created on the first summon**: compact keyless bars with a leaf tag. Summons get no edge arrows. Seren’s edge arrow gains a dashed ‘beyond reach’ ring past 14 m.
- **Counters:** `drawn5e` and `fired5e` (the `drawn5b` pattern, `entities.ts:471`).
- **Labs:** VfxLab Seren and Oro scenarios, with clutter checks: Seren among the mirror choir, Saplings among Spire Leeches.

### Colour (`tests/colorVision.test.ts`)

- Seren `#a018f8` and Oro `#487858` join the hero matrix (`:174-189`) and pass in every vision with no exception: hero lowest 25.5 and 21.3.
- They pass the existing brass test against every hero (`:312-330`): Seren ≥ 25.5 and Oro ≥ 21.3.
- They pass the Movement III body test (`:421-443`): normal-vision lowest Seren 51.4 and Oro 18.1.
- **New rows:**
  - Seren against every enemy accent in normal vision (≥ 20, the signal rule), and her measured lows in the other visions (21.8 and 24.5) recorded in the comment;
  - Oro against the Movement II and III environments, where the lowest is 11.1 (9.4 with the Abyss’s own colours), so an `ORO_SEED` part assertion (Brann’s pattern) applies, with the weaker trim floors recorded under *Colour: Oro* (≥ 20 accents in normal vision, ≥ 15 environment and ≥ 10 heroes and semantics in every vision);
  - `SEREN_STEEL` is asserted to be used only on model parts: no UI module imports it, and it equals SILENCE_INK by design.
- Verdant Choir rings are green beside Sostenuto `#34d399`, so they carry a leaf shape: render draws a 4 m ring of leaves (`RING.leaf`) in Sostenuto’s content green round each Sapling singing it (the motif taken, the Sapling living and in your field: `groveCues.choirSings`, the sim’s own rule), and none in any party without the motif.

### Audio (`src/audio`, D dorian)

- **Voices.** New `MotifVoice` values `bladeString` (a struck high string with a short glassPing) and `hollowWood` (thump, lowpassed pluck and breath). Each needs explicit branches in all three voice switches (`sfx.ts:1544-1561`, `music.ts:211-231`, `ui.ts:1337-1350`); otherwise they fall to glass, the Conductor’s choir.
- **LEITMOTIFS and CALL_PHRASES** are appended after Brann (`theory.ts:203-246, 271-319`): Seren a quick dotted figure on **F**, Oro a slow figure on **G3**. These are free degrees; A is shared by Lyra and Brann (`sfx.ts:593`).
- **Per-hero branches before every fallback:**
  - flourish kinds `fleche` and `springRain` (`sfx.ts:2049-2061`);
  - hit pitch: Seren 130.8 Hz, Oro 87.3 Hz (`:4781-4791`);
  - heartbeat: Seren a light tick, Oro a wooden knock (`:7453-7496`).
- **Sound groups** with limits (the `brann()` pattern, `sfx.ts:246-270, 7532-7541`):
  - `SEREN_SOUND_GROUPS`: parry (gate 0.15, cap 2), counter, killShot (under the Perfect chord), lunge, feint, cutsBlink (0.08, cap 3), cutsExtend, showboat;
  - `ORO_SOUND_GROUPS`: sprout, saplingHurt (heavily gated), saplingFell, rootbond (gated), burrow, wildgrowth, ancientRoot, gentle.
- Every new talent and alternate-Solo id **the sim announces** (`talentFired`) goes into TALENT_SOUND_GROUPS (`sfx.ts:102-135`), never under `talent:riposte`. Eight are announced, each at a moment: Riposte Chain (a Ward that parries and holds for its second), Bladesong (a counter that cuts round her), Duellist’s Honour (a kill shot that readies your Ward), Blade Waltz (each blow it parries), Thorned Bark (each blow it bites back), Old Growth (a Sapling growing old), World Tree (the Ancient rooting as it goes) and Homecoming (each Sapling it brings home). The six that only change a number or a rule (Cold Focus, Unflinching, Thousandfold, Taproot, Grove Chorus, Seedling Swarm) announce nothing and have no sound; render’s `BOND_CUES` lists the same eight.
- The intensity scan (`sfx.ts:7315-7363`) visits `ent.hero` only; a test pins that summons never get a heartbeat or alert.
- `finale(party)` and `leitmotifCanon` pick the new heroes up through LEITMOTIFS (`music.ts:238-257, 560-561`). VOICE_MIRRORS stays fixed. `tests/audioPhase5d.test.ts:914-919` (which expects the ids to be unknown) is an expected red.
- **Lab:** opt-in ids seren 6, oro 7 and Saplings 30+, clear of enemyBase 10 (`labState.ts:16-26`). The default FakeWorld is unchanged.

### UI (`src/ui`)

- **HeroHud** gains optional blocks (the `blood` pattern, `store.ts:134-145`; built in `hudBridge.ts` beside `bloodHud`, `:655-671`):
  - `duel?`: `{armed, charges, parries, killShots, quarry, overextended, distance, cuts?}`;
  - `grove?`: `{saplings: {hp, maxHp, inField, auras, felled, respawnIn, burrowing}[], ancient: {left, cued} | null, tending}`.
- **Seren’s frame** (in her violet; silver never appears):
  - DuelMarks chips (the BloodMarks pattern, `PartyFrames.tsx:911, 948-987`): ‘En garde’, ‘Parry ×2’, ‘Duelling ‹name›’, ‘Overextended · Reel {F}’ (‘· Rally {C}’ for the Chronomancer or Anchor), ‘Out of reach · Glide closer’.
  - For her, the plain `far` fade (`healthModel.ts:57`) is replaced by the last chip and a pulsing outline: the hero who most needs a Ward is never faded while she stands. Downed, the chip and outline go (they name a Ward’s answer), so a downed Seren out of reach takes the plain fade like every other hero.
  - The Grand Silence’s stilled frame ink stays SILENCE_INK, distinct from her violet.
- **Oro’s frame:**
  - a sub-row of mini bars, one per Sapling: leaf glyph, life, AuraPips (`:655`) or the thrive leaf, an out-of-field mark and a re-sprout timer;
  - the Ancient’s timer, with a ‘your field’ mark under Q2;
  - the Gentle glyph on his portrait;
  - all inside the 19 rem frame, so Edit Layout holds.
- **Hints** (own ids, the `brannHints` pattern, `hints.ts:548-600`):
  - ‘Seren duels alone: Ward her before the blow lands, Reel {F} or Rally {C} when they surround her.’
  - ‘A Perfect Ward on Seren is a kill shot.’
  - ‘Swap puts you in her duel; Rally {C} brings her home.’
  - ‘Oro’s Saplings are outside your songs: walk back, or Rally {C} to re-plant them.’
  - ‘Oro won’t fight without a Focus {key}.’
  - ‘Bosses and the biggest foes ignore Saplings.’
- **New ally cards** (`sighting.ts:424-437`, narrowed):
  - Seren: ‘Ward her as the blow lands: she parries and counters threefold. A Perfect Ward is a kill shot.’ / ‘She hunts the strongest foe. Reel or Rally her when she’s surrounded.’
  - Oro: ‘His Saplings take your songs: keep them in your field, or Rally to re-plant them.’ / ‘Your Thread on him Mends them too. He won’t fight without a Focus.’
- **Copy:** every Brann-only pronoun and line is narrowed: `rosterModel.ts:110-114, 160-171, 204-212, 264-269, 305-311`; `sighting.ts:428-435`; `legionLook.ts:89-108`; `hints.ts:146, 564`.
- **Decrees:** a parry-armed Seren shows ‘parried’ as an answer on a decree attack.
- **Bonds tabs:** 3 × 2 (`bondsModel.ts:83-85`).
- **Epilogue:** `RECRUIT_LINES` checked before `HERO_LINES`.
- **Labs and e2e:**
  - UiLab groups `serenLab.tsx` and `oroLab.tsx` (the brannLab pattern).
  - An e2e Phase 5e roster smoke modelled on `smoke.spec.ts:1708-1823`: veteran → recruit Seren and Oro → 6 cards → pick Kael, Seren, Oro → `prep-passive-seren` ‘Parry’ and `prep-passive-oro` ‘Rootbond’ → First Light → a `duel-*` chip, two `sapling-bar` rows and the New ally card → `duel-line` and `grove-line` on Result and Summary.

### Accessibility with audio off

Every state has a shape, and none needs Flashes > 0:

| State | Visual |
|---|---|
| Parry armed | crossed blades |
| Parried | flash and PARRIED |
| Kill shot | star and KILL SHOT |
| Duel | tether and crown |
| Overextended or out of reach | chips and the arrow ring |
| Saplings out of field | grey arcs and a leaf mark |
| Burrowing | trail |
| Gentle | closed leaf |
| Rooted | vines |
| Heavy foe | heavy pip |
| Ancient | taunt ring |
| Cued Ancient | a second dashed disc |

Captions name each bark.

## Bots and harness

### Readers (`src/bots/common.ts`, beside `bloodOf` and `mendNeed`, `:405-468`)

- `duelOf(state, party)`: `{seren, armed, quarry, nextSwing, overextended}`;
- `groveOf(state, party)`: `{oro, saplings, ancient, inFieldShare, hurt, tending}`;
- `summonsOf(state)`.

Each returns null or empty without its hero. `partyOf` is unchanged (`:113-130`). The Skilled bot’s `damageRate` (`skilled.ts:1907`) is safe through the narrowed `bloodRageBonus`.

### Skilled `ROSTER_RULES`

They sit beside M3_RULES and FINALE_RULES (`skilled.ts:140-219`), each behind `this.on()` and `skip`, gated on a reader, and draw nothing.

| Rule | What it does |
|---|---|
| `serenPerfectFirst` | In the Perfect scorer (`:452-495`), a blow on Seren scores above any non-lethal hit and below a lethal hit elsewhere (the brannFirst ordering), with the 15% filter lifted for her. |
| `serenParryWard` | Ward her when her mark’s next melee swing is due within the Ward’s life and no Perfect is pending (the brannWard pattern, `:1868-1882`). **In a boss or miniboss fight it Wards her only against the boss’s own parryable blow aimed at her, and never while a telegraph aimed at another hero is live**, so Kael’s boss blows keep their Ward (5b’s ‘Kael’s own blows went unwarded’ knock-on). |
| `serenReel` | When she is overextended and hurt. It runs after every existing Reel rule (`mawReel`, `brannReel` and the Twin Cleave reserve, which exists only with Brann at `:635`, and `silenceReel`), and is skipped while any lethal telegraph is live, so the plain loop keeps the Reel for it. For the Chronomancer, and with the Swap Reel variant (`serenNoSwap`), it issues a Rally instead; with the Anchor variant (no pull) a Rally, with the Anchor cast on her beside it when she is in its reach. |
| `serenNoSwap` | Never Swap into her duel. |
| `serenCue` | Thousand Cuts at ≥ 4 enemies or when she is overextended. |
| `oroFocus` | When he is tending and the fight has 1-3 enemies, Focus Kael’s target or the boss, with a crowd guard like SENTINEL_FOCUS_AT (`:285`). Ablated first. |
| `oroRally` | A Sapling outside every field for > 2 s, throttled by `gap()` (`:921-924`) so a bloodlusting Brann’s 8 s holds. |
| `oroThread` | Mend-Thread Oro when the Saplings are hurt and the party is calm. |
| `groveCover` | Weights the Saplings into `position()`’s centroid at 1:2 (`:1339-1392`). |
| `oroCue` | Wildgrowth on a pack of ≥ 3, or Cued when the Saplings are out of the field. |
| `discordBreaker` | Empower the hardest hitter against discord shields in Seren or Oro parties **with no Lyra in the roster**. It tests `state.party`, not the alive set (`:726-729`), so the default party is unchanged when Lyra is down. |

Thread rules are **post-pick modifiers** (`:746-783`), never a fork beside `else if (blood)` (`:708`), so parties R and X compose with brannThread. The revive-winding (`:704`) widens to any recruit.

### Novice

- `NOVICE_ROSTER` draws, each taken only with that hero present and appended immediately before the Cue draw (`novice.ts:378-382`), ablatable through `skip`:
  - `serenWard` 0.3 (engaged and unwarded);
  - `oroFocus` 0.15 (tending, enemies near);
  - `saplingRally` 0.2 (a Sapling outside).
- `noviceAnchor` (`:497-509`) also excludes `role === 'duelist'`, and never sees summons.

### Harness and tools

- **Tallies.** `EncounterRun.seren?: SerenTally` and `oro?: OroTally` sit beside `brann?` (`harness-core.ts:82-83`), keyed on the passive id and spread only when present (`:1176`).
  - **SerenTally:** parries, perfectParries, killShots, killShotsLost, executed, counterDamage, damage, wardsOn, wardsParried, dodgesCancelled, overextendedTime, overextendedAnswered, beyondReachTime, quarryPickShare, reelsOn, ralliesOn, lungeInterrupts, downs, feintTauntTime, cutsStrikes, cutsExtensions, enGarde.
  - **OroTally:** saplingAliveTime, saplingInFieldTime, saplingsLost, regrowths, rootbondHeal, saplingDamage, tendingTime, focusTime, ancientTauntTime, ancientAuraTime, verdantHeal, threadCuts, downs.
- **HarmonyWatch** is re-gated on `bloodRageOf` in W0b (`:1439, 1455`).
- **`tools/harness.ts`:**
  - NAMED_PARTIES gains SA, SB, SC, OA, OB, OC, R, SO, X and W (`:66-70`);
  - `band()` becomes a per-hero table (`:221`), keeping `noTank = !party.includes('kael')`;
  - `serenLine` and `oroLine` are added.
- **`tools/roster-bands.ts`** generalises `brann-bands.ts` with `--hero`.
  - Per-down instrumentation from day one: the last blow before `allyDowned`, its attack id, its telegraph’s target against the victim, distance from the Weaver, whether a parry was armed, and summon involvement.
  - Also recorded: Weaver damage taken, Weaver downs and Thread cuts per fight, each against default.
  - Boss-target keys for `sapling` and `ancient` (both expected 0).
  - The starters’ Bond average comes from `CONTENT.defaultParty` (`:400-403`).
- **Other tools:** `decrees.ts --party`; `verbs.ts` ablates ROSTER_RULES and NOVICE_ROSTER; sim-bench `grove-peak` (SO with Seedling Swarm, the Ancient and the hound pack).
- **Goldens** are appended after skilled-chrono-silence (19 → 25) and pinned as a ROSTER_HASHES group, with ‘the nineteen come first, unchanged’:

  | Golden | Party | Seed | Note |
  |---|---|---|---|
  | skilled-seren-crimson-gate | SA | 8787 | |
  | novice-seren-first-light | SC | 9898 | |
  | skilled-oro-bellwarden | OB | 1919 | |
  | skilled-red-line-vharun | R | 2121 | Blood and Silk + En Garde, Ostinato + Fermata |
  | skilled-oro-conductor | OA | 3232 | Cued Ancient |
  | novice-grove-mirror-hall | SO | 4545 | |

  Two of them join the replay round-trip (`determinism.test.ts:58-60`).

## Bands

**Protocol** (5b and 5d):
- Cells: 50 seeds on each of 1000, 500003 and 777001, on each Movement’s kit.
- Whole runs: 200 seeds on each of 2000, 900007 and 333003.
- A band is ‘met’ only on all three sets; otherwise it is ‘seed-sensitive k of 3’. Noise is about ±6 points a cell and ±3 a run.
- ‘Default’ means the same cell in the same tool run.

**Parties:**
- The full protocol: SA, SB, SC, OA, OB and OC. They mirror 5b’s A/B/C: each drops one starter.
- A reduced protocol (bosses and whole runs, printed against the bands): R, SO, X and W.
- The remaining 10 parties: a smoke test and an unbanded 24-seed whole-run sweep, so an outlier like Brann’s 44% is seen early.

| Content | ×A, ×C (Kael) | SB (no tank, no dome; Seren parries) | OB (no soak, Q8) | Reduced |
|---|---|---|---|---|
| Skilled win, skirmishes and elites, every Movement | ≥ default − 5 | ≥ default − 5 | ≥ default − 10 (provisional) | printed vs default − 10 |
| Skilled win, Movement I-III bosses and the Conductor | ≥ default − 5 | ≥ default − 15 | ≥ default − 25 (provisional) | printed vs default − 15 |
| Skilled share | ≥ 35% skirmishes and elites, ≥ 30% bosses | same | same | same |
| Skilled length | ≤ default + 15% (cells); 170-280 s at the Conductor | ≤ 280 s | ≤ 280 s | printed |
| Novice | inside each Movement’s 5b/5c/5d Novice row; ≤ Skilled | at bosses ≥ 10% | recorded | printed |
| Idle at bosses | 0% | 0% | 0% | 0% |
| Whole Prelude, Skilled | ≥ default − 5; Novice ≥ 50% of default | ≥ default − 5 | ≥ default − 10 | — |
| Whole Finale-route Expedition, Skilled | won ≥ default − 5 and ≥ 55% | won ≥ default − 10 | won ≥ default − 20 (provisional) | won ≥ default − 15 |
| Weaver safety (Oro parties) | Weaver damage taken ≤ default + 15%; Weaver downs ≤ default + 0.05 a fight | same | same | printed |
| Thread cuts (Oro parties, Movement III) | ≤ default + 25% a fight | same | same | printed |
| Callings at the Conductor (Skilled, SC and OC) | ≥ 75% each for none, Luminary, Martyr, Chronomancer with and without Paradox; Anchor reported | — | — | — |
| Bond XP a fight (catch-up off) | ≥ 75% of the starters’ | same | same | — |
| Decree gate (`decrees.ts --party`, real casts) at Vharun, the Unweaver and the Conductor | each Decree’s cast count ≥ default − 10% | same | same | — |
| Default party and Brann parties A, B, C | **identical to the W0a pins** | | | |

**Seren’s own bands** (Skilled unless stated):
- ≥ 50% of Wards on her parry before they expire;
- counter and kill-shot damage 20-40% of her damage in skirmishes and elites;
- kill shots ≥ 0.5 a fight across elite and boss cells, with the Novice at no more than a third of the Skilled rate;
- kill shots lost (disabled or silence) recorded;
- beyond 14 m ≤ 2% of her alive time;
- overextensions answered within 3 s ≥ 50%;
- her quarry is the Showboat pick ≥ 60% of the time;
- Kael holds bosses ≥ 70% of boss time in SA and SC;
- every Mirror Ward and Finale Solo cast in W is interrupted ≥ the default party’s rate − 10;
- downs ≤ 0.3 a fight;
- the inversion check: the Weaver’s Ward share of support is higher on her than on the starters, and Skilled parries are ≥ 2× the Novice’s.

**Oro’s own bands:**
- Saplings inside a field ≥ 60% of their alive time (Skilled), with the Novice at least 15 points lower (the designed skill gap);
- both Saplings standing ≥ 60% of fight time;
- tending (no target) ≤ 25% for Skilled, recorded for the Novice;
- downs ≤ 0.3;
- Rootbond, Ancient taunt and aura seconds recorded;
- grove-peak p95 ≤ 1.5 ms;
- timeout share (MAX_SECONDS 540) ≤ 1%.

**Pacing.** Seren and Oro parties’ Skilled Expedition minutes are reported, with a soft limit of default + 3. The edge-of-band default numbers are untouched by construction and re-checked:
- Novice won ÷ reached the Finale 39.1% against 40%;
- Skilled reached the Finale on 333003, 67% against 65%;
- 8 notes in 25.03 s against 24 s;
- five viable builds, 5 of 6;
- pacing 39.6 / 39.4 against 40 (docs/phase-5d.md:1199-1214).

**First look (a gate, W8).** As soon as W1, W2 and W7 merge, run 24 seeds over every Seren and Oro party at every boss, plus 50 whole runs on set 2000.
- Read the per-down table first: aimed at another hero versus at her; beyond reach; Saplings outside the field; tending time; Weaver damage and Thread cuts.
- Any party more than 15 points under default (25 for OB) is diagnosed before tuning.
- OB’s provisional bands are confirmed or replaced in the first-look write-up, for your decision (Q8).
- Published under *First look (W8)* below.

**Lever order (agreed now):**
1. The new heroes’ own numbers within ±20%:
   - Seren: attack, counterPct 2.4-3.6, killShotMult, dodge 0.35-0.55, the 13 m clamp 11-13, Showboat time 6-10, Lunge and Feint cooldowns, Thousand Cuts power;
   - Oro: thorn damage, the tended bonus 0.3-0.6, Sapling life, attack, taunt radius 3-4 m and cadence, front-spot distance 4-6 m, re-sprout, the Ancient’s life, radius and root, Regrowth and Bramble;
2. hero-only movement and targeting (`duel.ts`, `grove.ts`);
3. hero-only bot rules, after a `verbs.ts` ablation;
4. Bond and motif values.

**Never moved:** Weaver, aura, enemy, encounter, Movement, starter and Brann numbers. The third seed set stays untuned, and every lever change goes in a ‘tried and not kept’ table.

## First look (W8, 2026-11-08): the gate before any tuning

**What ran.** The build is W1 + W2 + W7 on W0b (branch `m5/W8`, from W7's head `321af32`), **without W2b**: Saplings don't receive your auras yet (Q1), the Cued Ancient's disc is not your field (Q2) and Verdant Choir is silent (Q3). W9 re-measures once W2b lands. Nothing was tuned before these numbers.

- `npx tsx tools/roster-bands.ts --first-look` (split in two lanes with `--movement 1,2` / `3,4` and `--cells-only` / `--runs-only`):
  - **cells:** the default party and all 16 parties with Seren or Oro, at each Movement's boss (the Hollow Cantor bare, Vharun on the arrival kit, the Unweaver on ARRIVAL3_KIT, the Conductor on ARRIVAL4_KIT), 24 seeds from 1000, Idle, Novice and Skilled;
  - **runs:** 50 Skilled Finale-route runs from 2000 for the same 17 parties.
- At 24 seeds a cell's noise is about ±10 points, and a 50-run row's about ±7. Every gap below is against the default party's row in the same tool run.
- The tallies (`tools/harness-core.ts`) keep the key lists of *Harness and tools* in order and append what the bands need: SerenTally adds `overextensions`, `aliveTime` and `killShotDamage`, and OroTally adds `aliveTime`, `bothStandingTime` and `ancients`.
- Raw rows: scratch `m5e/w8-cells-{a,b}.txt|json` and `m5e/w8-runs-{a,b}.txt|json`; the tables come from `m5e/w8-summary.py`.

### Boss cells (Skilled win, the Novice's in brackets, and the Skilled gap to default)

⚠ marks a row more than 15 points under default (25 for OB, Q8): each is diagnosed below before any tuning. The banded parties come first: the full protocol (SC, OC, SA, OA, SB, OB), then the reduced (R, SO, W, X), then the unbanded sweep.

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | 96% (62%) | 96% (50%) | 100% (38%) | 96% (25%) |
| SC | 75% (25%) −21 ⚠ | 96% (33%) +0 | 100% (12%) +0 | 96% (4%) +0 |
| OC | 67% (17%) −29 ⚠ | 96% (25%) +0 | 100% (8%) +0 | 100% (4%) +4 |
| SA | 96% (42%) +0 | 92% (29%) −4 | 100% (0%) +0 | 100% (17%) +4 |
| OA | 100% (29%) +4 | 92% (33%) −4 | 96% (0%) −4 | 100% (4%) +4 |
| SB | 58% (25%) −38 ⚠ | 96% (33%) +0 | 96% (8%) −4 | 92% (12%) −4 |
| OB | 83% (4%) −12 | 96% (29%) +0 | 67% (0%) −33 ⚠ | 67% (0%) −29 ⚠ |
| R | 96% (0%) +0 | 33% (0%) −62 ⚠ | 88% (0%) −12 | 92% (0%) −4 |
| SO | 8% (0%) −88 ⚠ | 0% (4%) −96 ⚠ | 0% (0%) −100 ⚠ | 71% (0%) −25 ⚠ |
| W | 71% (0%) −25 ⚠ | 75% (4%) −21 ⚠ | 88% (0%) −12 | 88% (4%) −8 |
| X | 38% (0%) −58 ⚠ | 29% (0%) −67 ⚠ | 92% (0%) −8 | 88% (0%) −8 |
| KBO | 92% (0%) −4 | 25% (29%) −71 ⚠ | 42% (0%) −58 ⚠ | 88% (4%) −8 |
| LBS | 71% (29%) −25 ⚠ | 96% (12%) +0 | 100% (0%) +0 | 100% (0%) +4 |
| LBO | 83% (25%) −12 | 92% (8%) −4 | 88% (4%) −12 | 88% (4%) −8 |
| LSO | 17% (0%) −79 ⚠ | 100% (12%) +4 | 92% (0%) −8 | 92% (0%) −4 |
| VBS | 100% (29%) +4 | 75% (8%) −21 ⚠ | 100% (0%) +0 | 96% (0%) +0 |
| VBO | 96% (46%) +0 | 83% (4%) −12 | 100% (0%) +0 | 96% (0%) +0 |

- The Idle bot wins 0% at every boss for every party (band met).
- No boss ever targets a summon: 0 s on `sapling` or `ancient` over every fight (the design's rule holds).
- **Timeouts** (540 s): SO at the Unweaver 20 of 24, at the Conductor 6 of 24; KBO at the Unweaver 7 of 24, at Vharun 1. These are damage losses, not survival ones.

### Whole runs (Skilled, 50 Finale-route runs from 2000)

| Party | Won | Gap | Reached the Finale | Won of those | Fights | Bond XP a fight vs the starters' average | Lost most at |
|---|---|---|---|---|---|---|---|
| default | 74% | | 80% | 93% | 13.2 | | Blood Forge 3, the Conductor 3 |
| SC | 40% | −34 ⚠ | 40% | 100% | 9.8 | Seren 61% | the Cantor 6, Frayed Court 4, Frayed Threshold 4 |
| OC | 40% | −34 ⚠ | 40% | 100% | 9.8 | Oro 62% | the Cantor 12, Frayed Threshold 6 |
| SA | 20% | −54 ⚠ | 20% | 100% | 7.9 | Seren 66% | Frayed Threshold 9, Glass Gallery 6, Vharun 4 |
| OA | 32% | −42 ⚠ | 34% | 94% | 10.5 | Oro 67% | Frayed Threshold 10, Vharun 6 |
| SB | 50% | −24 ⚠ | 52% | 96% | 10.9 | Seren 63% | Frayed Threshold 5, the Cantor 5 |
| OB | 32% | −42 ⚠ | 38% | 84% | 9.6 | Oro 66% | the Bellwarden 8, the Cantor 7 |
| R | 2% | −72 ⚠ | 2% | 100% | 6.5 | Brann 93%, Seren 68% | Vharun 24 |
| SO | 0% | −74 ⚠ | 0% | - | 2.9 | Seren 78%, Oro 66% | the Cantor 20, Glass Gallery 8 |
| W | 8% | −66 ⚠ | 8% | 100% | 5.6 | Seren 65%, Oro 61% | the Cantor 15, Crimson Gate 7 |
| X | 0% | −74 ⚠ | 0% | - | 5.5 | (no starter) | the Cantor 15, Crimson Gate 12 |
| KBO | 4% | −70 | 4% | 100% | 7.1 | Brann 100%, Oro 71% | Vharun 28 |
| LBS | 36% | −38 | 40% | 90% | 9.9 | Brann 53%, Seren 48% | the Cantor 12 |
| LBO | 40% | −34 | 44% | 91% | 10.5 | Brann 54%, Oro 50% | the Cantor 9, Frayed Threshold 7 |
| LSO | 4% | −70 | 4% | 100% | 4.4 | Seren 57%, Oro 54% | the Cantor 35 |
| VBS | 22% | −52 | 22% | 100% | 8.5 | Brann 69%, Seren 58% | Shield Wall 6, Frayed Threshold 5 |
| VBO | 30% | −44 | 34% | 88% | 10.6 | Brann 71%, Oro 59% | Frayed Threshold 9, Vharun 6 |

Every Seren and Oro party misses its whole-run band, most by far more than at the bosses. The runs are lost on the road (Frayed Threshold, Glass Gallery, the Cantor, Crimson Gate), and the parties that reach the Finale win it 84-100% of the time. The skirmish and elite cells, which this first look didn't play, are where W9 looks next.

### The per-down table (Skilled, the four bosses pooled; read it first)

'Aimed at the victim' and 'at another hero' are the blow's telegraph target against the hero it downed. 'Basic' is an enemy's ordinary swing. 'Summon near' means one of Oro's summons stood within 4 m. 'Seren's parry armed' is read on the tick before her down (a fromWeaver Ward on her, or Blade Waltz running): the down itself clears her shields and her solo before the watch sees it. The first pass read it after the down, so it read 0 by construction; the column was re-measured with the fixed watch (the same 24 seeds; every other number in the table is unchanged).

| Party | Downs a fight | Aimed at the victim | At another hero | At no one | Basic | Beyond 14 m | Seren's parry armed | Summon near | Top blows |
|---|---|---|---|---|---|---|---|---|---|
| default | 0.80 | 38 | 21 | 12 | 6 | 0 | - | 0 | Cantor Toll 24, Twin Cleave 15, Requiem 10 |
| SC | 1.64 | 90 | 16 | 32 | 19 | 2 | 0/27 | 0 | Cantor Toll 75, Requiem 28 |
| OC | 1.64 | 64 | 37 | 36 | 20 | 0 | - | 65 | Cantor Toll 49, Requiem 31 |
| SA | 1.68 | 86 | 25 | 38 | 12 | 4 | 0/28 | 0 | Cantor Toll 37, Requiem 36, Twin Cleave (2nd) 34 |
| OA | 2.18 | 98 | 76 | 25 | 10 | 3 | - | 83 | Twin Cleave (2nd) 44, Cantor Toll 41 |
| SB | 1.76 | 43 | 59 | 32 | 35 | 0 | 0/38 | 0 | Twin Cleave 49, basic 35 |
| OB | 3.09 | 89 | 128 | 25 | 55 | 2 | - | 151 | basic 55, Twin Cleave 46, Shear 38 |
| R | 5.03 | 225 | 116 | 71 | 70 | 17 | 1/85 | 0 | Twin Cleave (2nd) 92, basic 70 |
| SO | 5.54 | 261 | 126 | 21 | 124 | 8 | 0/153 | 214 | basic 124, Cantor Toll 61 |
| W | 3.89 | 187 | 92 | 26 | 68 | 3 | 0/69 | 139 | Shear 85, basic 68 |
| X | 8.15 | 582 | 53 | 41 | 103 | 32 | 1/157 | 296 | Cantor Toll 135, Twin Cleave (2nd) 122 |

Downs a fight, by hero (Skilled, pooled): default Kael 0.36, Lyra 0.21, Vexis 0.23. With Seren or Oro, every other hero goes down more: Kael 0.99 in SC and 2.93 in SO, Vexis 1.00 in OA and 2.21 in W, Brann 5.83 in X. Seren goes down 0.18-1.64 a fight, Oro 0.36-1.02.

- **Seren's 664 downs:** 226 from blows aimed at another hero, 180 from basic swings, 176 aimed at her, 82 at no one. Only **3** came with her parry armed going in (R at Vharun, a second Twin Cleave aimed at another hero; X and LSO at the Cantor, Requiem): her downs are not parries failing, they are blows she met unWarded.
- **Oro's 660 downs:** 432 (65%) from blows **aimed at another hero**, mostly Twin Cleave, Requiem, Shear and Cantor Toll. This is 5b's cause 1 again: he stands in other heroes' cleaves. His Gentle retreat steps away from enemies, not out of shapes aimed at others.
- The sim doesn't write the contract's `DeathRecord.duel` and `.grove` recap fields yet (`health.ts` `downHero`). The tool copies them when present. Writing them is part of the recap work (W3 and W6, or W9).

### Weaver safety and the Thread (Skilled, a fight, the four bosses pooled)

| Party | Weaver damage taken | Weaver downs | Thread cuts at the Unweaver |
|---|---|---|---|
| default | 517 | 1.04 | 0.6 |
| SC / OC | 971 / 826 | 2.12 / 1.67 | 0.7 / 1.2 |
| SA / OA | 1,024 / 994 | 2.08 / 2.10 | 1.7 / 4.5 |
| SB / OB | 717 / 812 | 1.77 / 2.04 | 0.5 / 1.8 |
| R / SO / W / X | 1,539 / 2,133 / 1,274 / 1,600 | 3.15 / 4.75 / 3.20 / 4.02 | 5.5 / 3.2 / 2.0 / 4.9 |

Every party misses the Weaver-safety band (damage ≤ default + 15%, downs ≤ default + 0.05) by a wide margin, the Seren parties included. So the Weaver's extra damage isn't only Oro's healing threat (Q1's knock-on): it tracks the longer, closer fights. Thread cuts at the Unweaver rise with Oro (OA 4.5 against 0.6).

### Seren's own numbers (Skilled, the four bosses pooled)

| Party | Parries | Wards on her | Parried | Kill shots | Lost | Your Wards' share of her damage | Overextended | Answered ≤ 3 s | Beyond 14 m | Showboat pick | Lunge interrupts | Downs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SC | 0.3 | 3.5 | 8% | 0.30 | 0.00 | 1% | 0.8 | 84% | 0% | 88% | 2.5 | 0.28 |
| SA | 0.4 | 4.4 | 9% | 0.69 | 0.01 | 2% | 0.4 | 79% | 0% | 91% | 3.1 | 0.29 |
| SB | 0.1 | 2.2 | 6% | 0.33 | 0.00 | 1% | 0.8 | 74% | 0% | 97% | 1.6 | 0.40 |
| R | 0.7 | 7.6 | 9% | 0.77 | 0.00 | 1% | 1.5 | 64% | 0% | 89% | 4.2 | 0.89 |
| SO | 2.1 | 10.9 | 19% | 1.08 | 0.01 | 2% | 3.0 | 63% | 0% | 99% | 6.0 | 1.59 |
| W | 2.3 | 7.0 | 33% | 1.04 | 0.00 | 4% | 2.4 | 77% | 0% | 99% | 2.8 | 0.72 |
| X | 3.6 | 9.3 | 39% | 1.29 | 0.02 | 5% | 3.8 | 70% | 0% | 99% | 3.8 | 1.64 |

- Met: beyond 14 m ≤ 2% (0% everywhere: the clamp holds); overextensions answered within 3 s ≥ 50% (63-84%); her quarry is the Showboat pick ≥ 60% (88-99%); kill shots ≥ 0.5 a fight in most parties.
- **Missed everywhere: the verb itself.** At bosses, 6-39% of the Wards on her parry (band ≥ 50%), and counters plus kill shots are 1-5% of her damage (band 20-40%). In Kael parties the boss's parryable blows go to Kael, so the Wards on her (her Call's answers, `serenParryWard` outside the boss's own blow) mostly expire.
- Downs ≤ 0.3 is met only in SA, SC, LBS and VBS.

### Oro's own numbers (Skilled; the Novice's in-field share beside it)

| Party | Saplings in your field | Novice | Both standing | Felled | Tending | Rootbond | Ancients | Downs |
|---|---|---|---|---|---|---|---|---|
| OC | 88% | 80% | 99% | 0.8 | 4% | 763 | 3.2 | 0.40 |
| OA | 90% | 78% | 100% | 0.3 | 2% | 760 | 4.5 | 0.36 |
| OB | 85% | 72% | 100% | 0.5 | 4% | 755 | 2.4 | 0.91 |
| SO | 91% | 83% | 98% | 1.6 | 2% | 814 | 6.5 | 1.02 |
| W | 86% | 70% | 100% | 0.7 | 2% | 1,049 | 4.6 | 0.96 |
| X | 87% | 86% | 99% | 1.2 | 2% | 443 | 4.9 | 0.68 |

- Met: Saplings in your field ≥ 60% (84-91%); both standing ≥ 60%; tending ≤ 25% (2-4%: `oroFocus` keeps him awake).
- The Novice's skill gap (≥ 15 points lower) is met only in W (16), LBO (18) and LSO (15). It is 8-13 elsewhere and 1 in X.
- **Missed:** Oro's downs ≤ 0.3 (0.36-1.02), and his Bond XP ≥ 75% of the starters' (50-71%).
- 'Both standing' was measured with the fight's intro seconds counted (up to 101%). The tally now counts the fight only.

### Diagnosis (no tuning yet; the levers in the agreed order)

1. **Oro stands in other heroes' cleaves** (65% of his downs). This is a hero-only movement fix, lever 2 in `grove.ts`: a `sidestepOthers` call in his own move arm, as Seren's duelist arm has. It also bears on Vexis's and Lyra's extra downs, since the blows that catch him are often second Twin Cleaves re-aimed after a first victim fell.
2. **Seren's parry rarely fires at bosses**, and her Wards cost the party. (Her downs bear this out: 3 of 664 came while armed, so she goes down between Wards, not through them.)
   - SC's Kael dies to his own Cantor Toll three times as often as the default's (75 to 24). The Ward economy shifts to Wards on her that expire unparried.
   - First, the `verbs.ts` ablation of `serenParryWard`, `serenPerfectFirst` and her Call answer (lever 3). Then her own numbers (lever 1: Lunge and Feint cooldowns, so Feint baits more parries).
3. **SO, KBO and X are slow:** they time out at the Unweaver and the Conductor. Two of their three heroes deal little damage at bosses, since Saplings ignore bosses and the counters barely fire. These are Seren's and Oro's damage numbers, lever 1.
4. **Brann with a new hero (R, X, KBO) collapses at Vharun** (25-33%), mostly to second Twin Cleaves. Brann's own numbers are frozen. The levers are the new hero's movement (item 1) and the `serenReel` and `oroRally` ordering against Brann's Twin Cleave reserve (lever 3).
5. **Whole runs lose on the road**, not at the Finale. W9 plays the skirmish and elite cells (Frayed Threshold, Glass Gallery, Crimson Gate) under the full protocol before tuning numbers to the bosses.
6. W2b's aura reception (Q1-Q3) will move every Oro row, mostly in Oro's favour (the Saplings' life and swings). So the Oro diagnoses above are re-read after W2b lands, and before any Oro number moves.

### OB's provisional bands (Q8), for your decision

- **Measured:**
  - boss cells −12 (the Cantor), +0 (Vharun), −33 (the Unweaver) and −29 (the Conductor), against the provisional ≥ default − 25;
  - the whole run 32% (−42), against the provisional ≥ default − 20.
- **OB is not the outlier.** OA and OB lose the same 42 points on the whole run, and OB's boss gap is no worse than SB's at the Cantor or W's at Vharun.
- **Recommendation:**
  - Keep the provisional bands (bosses ≥ default − 25, runs ≥ default − 20) unchanged until W9 re-measures with W2b and the item 1 movement fix, on all three seed sets at 50 seeds.
  - Replace them only if OB is then the one party still outside its band. In that case the choice is between widening OB's band and the Heartwood alternative, which is a Quirk change and so yours to make.

## Determinism and invariance guards

- **Unchanged, byte for byte:**
  - the 19 goldens (their literals and order);
  - m1-baseline in four modes and expedition-baseline in three;
  - preludeSnapshot, draftSnapshot (OLD_MOTIFS 27), commandSnapshot, commandSnapshotM3 and commandSnapshotFinale;
  - movement3Handoff and finaleHandoff;
  - expedition2Pin and expedition3Pin;
  - the render and audio Spire/Rift snapshots;
  - rosterInvariance and its keys json.
- **New W0a pins:**
  - Brann-party command streams: A, B and C × Skilled and Novice × 3 seeds × crimson_gate, bellwarden, mirror_hall and the Conductor (30 s);
  - `--party A|B|C` modes of m1-baseline (movements 1-4) and expedition-baseline (movement 4);
  - entity-count and allocator snapshots for default, A, B and C;
  - a telegraph-state key-set snapshot and a DamageResult key-set snapshot over every hit in the 19 goldens (proving `parried` is never present);
  - the parryable-attack and heavy-foe enumerations;
  - a passive-reader equality table: `bloodRageBonus` and `weaverHealCut` for Brann (with and without Red Mist and Blood Oath) and for each starter, over a grid of life fractions and vias, recorded before W0b and asserted after;
  - `recruitsOf` outputs for every result list in `tests/meta/roster.test.ts`, recorded before the signature change.
- **The specific risks and their guards:**
  - **Berserker branch.** Not edited; the duelist has its own lines. Guarded by the A/B/C command streams.
  - **`noticeTelegraphs`.** The stance is a separate `continue`; `chance` and the roll order are unchanged.
  - **`pinned()`.** The hero test stays first and returns the same values.
  - **`onPackArrived`.** Untouched.
  - **Redirected shares.** These carry `oath: true`, and the parry requires its absence.
  - **`eventChoiceProblem`.** Defaults to EVERYTHING, so the harness picks are unchanged (expedition pins).
  - **`recruitsOf`.** Defaults to unranked recruits only.
  - **Deeds.** Appended last, so the first 27 keep their order.
  - **`inAnyField` under Q2.** Gated on `field.ancient`, so the Starfall pool for existing parties is unchanged.
  - **Render.** Overlay pool and MAX_FIELDS are unchanged; summon bars, summon batches and the Ancient disc are lazy. The default render snapshots and draw-call count are re-proved, not assumed.
- **rosterInvariance:** `forbiddenKeys` adds duel, grove, summon, parried, rootImmuneUntil and ancient. NO_MODS holds `enGarde` and `verdantChoir` at 0.
- An explicit default party still equals the implicit one. Seren and Oro determinism (replay plus mid-fight hash) runs over the six full parties × 3 seeds (`brannDeterminism.test.ts:78-100`).
- dmath only. Summons iterate in spawn order. The Skilled bot keeps attention 1. SIM_VERSION stays 22.

## Tests

- **Content:**
  - the passive union parses every existing def unchanged, and `bloodRageOf` equals the old truthiness;
  - the passive-reader equality table;
  - per-kit lint;
  - ‘Codex names healing’ for bloodRage only;
  - formation lint over 6;
  - recruit rank rules, including the unique-encounter rule;
  - the parryable and heavy enumerations;
  - no talent named Deep Roots;
  - SoloKind lists only the six main Solos, and the alternate Solos are in KNOWN_ALT_SOLOS.
- **Seren** (`tests/sim/serenParry.test.ts`, `serenDuel.test.ts`, `serenSolo.test.ts`):
  - **Parry:**
    - a Ward cast at −0.2 s on a cone aimed at her gives 0 damage, the Ward gone, `parried` set, no Severing, and a counter next tick (05-technical-architecture.md:235);
    - a basic melee swing at her is negated;
    - a second blow lands; Riposte Chain parries twice;
    - a cone aimed at Kael that catches her is not parried;
    - an Oathkeeper or Aegis Link share is not parried;
    - a bolt is absorbed, not parried; Crimson Tide and the Tolls are not parryable;
    - Sphere and Oath take precedence;
    - Chorale plain and Echo Wards arm it; Aegis Link doesn’t;
    - a Metronome Perfect is a kill shot;
    - stunned, she parries without countering.
  - **Kill shot:**
    - it is taken next tick;
    - lost while stilled or in the Grand Silence;
    - executes a normal foe, executes an elite at 50% and deals 6× at 80%, deals 6× to a boss and to the Hollow Champion at any life, is thrown beyond 9 m, and glances off a guard;
    - phase-shift and rising are respected.
  - **Stance:**
    - she never rolls a dodge on a parryable blow at her while Warded;
    - a pending dodge is cancelled when a Ward lands;
    - she sidesteps a cone aimed at Kael (copying brannSidestep).
  - **Showboat:**
    - it starts in wave 1 and in a single-wave boss fight;
    - ordering, stationary skip, Focus override, Rally suspension and the 13 m clamp.
  - **Lunge:** interrupts at 1.2 m (contact) and at 8 m; it is reserved in an interruptible-boss fight; the Call marks `lungeTarget`’s pick.
  - **Feint:** never binds bosses; it holds the Hollow Champion.
  - **Thousand Cuts:** distinct targets, invulnerability, Cued extension and cap, the return, the 13 m rule.
  - every talent hook.
- **Oro** (`tests/sim/grove.test.ts`, `rootbond.test.ts`, `rooted.test.ts`, `groveSilence.test.ts`):
  - **Spawning and holding:**
    - Saplings spawn after the party only with Oro; planted 5 m ahead;
    - taunts are normal and elite, non-heavy only, and never overwrite a hero taunt;
    - bosses and the champion never target summons; specials re-aim.
  - **Never hit:**
    - telegraphs, raids, splash and chain skip summons, and the Discord quorum ignores them;
    - summons take no statuses (bleed, Wound);
    - a blow on a Sapling never Severs.
  - **Felling and dormancy:**
    - felled, a Sapling re-sprouts at 12 s with no killEnemy crash, and is never a down or a defeat vote;
    - dormant while Oro is down;
    - the Grand Silence leaves the grove dormant and withers the Ancient.
  - **Rally:** re-plants after a burrow.
  - **Rootbond:** at 50%, with none under Unravel, Bear, Empower, a cut Thread or the Prism.
  - **Gentle:**
    - no attack without a Focus; the 4 m retreat; the tended bonus;
    - the Solo charges from a Sapling and fires uncued on autonomy with Oro target-less.
  - **Root:** normal and elite, non-heavy only, immunity, attacks continue, no charge or leap.
  - **Credit:** to Oro’s slot with no threat; support to Oro; healing threat on the Weaver.
  - **Guards, tethers and Stasis:** guard arcs and tethers cut Sapling hits; Saplings swing during Stasis.
- **Q1-Q3 both ways** (`groveAuras.test.ts`):
  - **Q1:**
    - coverage on Saplings under Steal Verse, Mute, the hymn and suppression;
    - the fallback’s composed ‘inside your field’ equals `coverage() !== 0` for a probe hero across those cases;
    - no Fermata on summons.
  - **Q2:**
    - the Ancient disc’s mask equals your field’s at the same spot;
    - its hexes;
    - the listed knock-ons on and off (the narrower option);
    - the Starfall pool is unchanged without `field.ancient`.
  - **Q3:** the Verdant Choir rate.
  - **Both ways:** the default party’s field loop is byte-equal.
- **Meta** (`tests/meta/roster5e.test.ts`, the `roster.test.ts:188-460` patterns):
  - **Recruiting:**
    - recruitsOf and the store at Ranks 7, 8, 11 and 12, for event, fallback and a mid-run Rank-up, plus unlockAll;
    - **a won `pull` never recruits Oro**;
    - recruitsOf without an allowance returns the old lists.
  - **Choice legality:**
    - the Allowance hides the ranked choice;
    - an appended choice leaves harness runs, maps and draftSnapshot identical.
  - **Saves:** old saves load, and a run resumes at tithe_altar and loose_thread; stats are carried only for their hero.
  - **Content counts:**
    - heroTally;
    - UNLOCKS `recruit.*`;
    - Deeds count 29, with the 27 first and in order.
- **Bots:**
  - staged describes per rule (the `bots.test.ts:694-1230` pattern), including serenParryWard’s boss-fight restriction and serenReel’s order;
  - all 20 parties play first_light, vharun, the_unweaver and the Conductor deterministically without throwing;
  - an explicit default party issues the same commands.
- **Harness:** SEREN_TALLY_KEYS and ORO_TALLY_KEYS order; partyArg codes; golden count 25 with the 19 first.
- **Render, audio and UI:**
  - renderSeren and renderOro;
  - audioSeren and audioOro (not glass, default heroes byte-equal);
  - uiPhase5e (Seren’s frame never silver; the epilogue’s RECRUIT_LINES; the EventScreen 2 × 2);
  - the colour rows;
  - the e2e smoke.
- **Expected reds with owners** (committed by W0b as the final allow-list, never weakened; the table under *Expected reds after W0b* is the same list with reasons):
  - `meta/roster.test.ts:105, 265` (W3);
  - `uiPhase4e.test.ts:549, 570`, `uiPhase5b.test.ts:467`, `uiPhase5bFixes.test.ts:248, 373` (W6);
  - `harnessTools.test.ts:526` (W8);
  - the e2e unlockAll picker counts (W6).
  - Reds the owners' own additions bring and close themselves (green after W0b): `appStores.test.ts:279` (W6); `demo.test.ts:35-39`, `meta/deeds.test.ts:182-201` (the count and the `slice(20)` order: two appended last) (W3); `renderBonds.test.ts:196, 225` (W4); `audio.test.ts:157-166, 468-469`, `audioPhase5d.test.ts:914-920` (W5).

## Workstreams

| Id | Name | Depends on |
|---|---|---|
| W0a | pins | none |
| W0b | contracts and every shared call site | W0a |
| W1 | Seren sim (`duel.ts`) | W0b |
| W2 | Oro sim (`grove.ts`, `summons.ts`) with the Q1-Q3 fallbacks | W0b |
| W2b | grove auras (`field.ts`, `auras.ts`) | W2 and your answers |
| W3 | meta and recruitment | W0b |
| W4 | render | W0b |
| W5 | audio | W0b |
| W6 | UI | W0b, W3 |
| W7 | bots | W1, W2 |
| W8 | harness, goldens and the first look | W1, W2, W7 |
| W9 | tuning, integration, review, docs, demo | all |

### W0b hand-over (contracts landed)

W0b landed every interface in *contracts*. All 19 goldens are byte-identical (only `contentVersion` moved), SIM_VERSION is 22, and `m1-baseline --check` (movements 1-4) and `expedition-baseline --check` (movements 2-4) are byte-equal.

**What is real and what is a stub.**
- *Real, pure and shared* (exported from `src/sim/index.ts`): `duel.ts` `parryable`, `parryArmed`, `heavy`, `duelTarget`, `lungeTarget`, `overextended`, `newDuel`, plus `duelMelee`, `duelStands`, `clampDuel`, `markKillShot`; `grove.ts` `isSummon`, `summonsOf`, `saplingInField`, `gentle`, `groveCallReady`, `newGrove`, plus `rootable`, `enemyRooted`, `lesserFoe`, `summonArmor`, `untauntedTarget`, `summonSupport`.
- *Real, generic and inert* (ground rule 4): `DamageOpts.melee` at the enemy basic swing and, for a duel victim, in `hitEntity`; the `rooted` movement guards (`enemies.ts` approach and `moveWithAttack`) and `addStatus`'s root rule; `summonFell` before `killEnemy`; the `trySpecial` re-aim; the splash and chain skips; the Severing skip; the status refusal (`addStatus` and `applyStatusPayload`); `ofParty`; the guard and tether gates; `pinned()`; summon armour; summon support to the owner (healing and shielding); `noThreat`.
- *Stubs* (no-ops for W1 in `duel.ts`, W2 in `grove.ts` and `summons.ts`): `parryIntercept`, `duelResolved`, `duelTick`, `duelLost` (downed or disabled: the counter and kill shot are lost), `duelChooseTarget`, `duelTargetInSight`, `duelMove`, `duelAbility`, `duelExecute`, `duelSoloStart`, `duelSolo`, `duelSoloEnd`, `duelSoloClock`, `duelCastProgress`; `spawnGrove`, `groveAfterField`, `groveTick`, `groveCharge`, `groveHeld`, `groveFireUncued`, `groveChooseTarget`, `groveTargetInSight`, `groveRetreat` (the no-target arm), `groveMove`, `groveAbility`, `groveExecute`, `groveSoloStart`, `groveSolo`, `groveSoloEnd`, `rootbond`, `groveRally`, `summonCredit`, `updateSummons`. A target arm returns `undefined` to keep the shared rule; a move arm returns false to keep the ranged branch (the interim rule).
- Thousand Cuts suppresses the basic attack through a `cutting` line beside `frenzy` in `updateHeroes`.

**Deviations from *contracts*, with reasons.**
- The event choices `debt` (tithe_altar) and `follow` (loose_thread) landed in W0b, not W3: the hero lint ('event has no fight that recruits them', and the new rank rule) needs them the moment Seren and Oro are in CONTENT. Because they exist, W0b also made three meta reads Rank-aware, all additive in `src/meta/run.ts`: `recruitsOf(run, allowance?)` (no allowance: unranked recruits only, which keeps `recruitsOfPins` and every caller as before), and `eventHasFight` / `eventFightRelics` skip ranked choices (without that the map's event-node threat and the expedition2/3 pins moved). `eventChoiceProblem`'s allowance, the EventScreen filter and the rest of the gate stay W3's.
- Because `eventHasFight` skips ranked choices, a tithe_altar node's map Threat stays ×1 (the altar's other choices fight nothing). So `combatConfig` gives a fight launched from a Rank-gated choice its row's Threat through the new `rowThreat(run, node)` (the row in its Movement, or the road's `threat` row on the Finale route: what `rewardFor` gives any fight on that row). The map, `pull` and every existing fight are unchanged. `ResultScreen`'s Threat line still reads `node.reward.threat` (×1 at the altar): W6 reads `rowThreat` there for a ranked choice, and W3 may show it in the EventScreen.
- `saplingInField` counts only a chord whose song still sings something for the party, with a stolen verse left out (the private `chordMask` & `partyAuraMask`, as `coverage()` decides `hero.inField`). A Lullaby-only song or a song whose only party aura is stolen is no field for a Sapling. `duelTarget` treats an enemy swinging at Kael as his even while Kael has no target of his own.
- `GroveState.ancients` (not in the contract's list) counts the Ancients raised this fight, for `HeroGroveStats.ancients`; W2 increments it where the Ancient spawns.
- `heroTally`'s stat is the Deed field `tally` (`HERO_TALLY_STATS`: parries, killShots, saplingsLost) with `values.atLeast` / `values.atMost`; the existing `stat` stays the `runCount` enum so `deedHolds` keeps its types. `deedHolds` and `deedGlyph` have placeholder `heroTally` cases (false, 'swords') for W3 and W6.
- `heavy(world, e)` reads false on bosses and minibosses (they are excluded by tier); `lesserFoe` is the summons' hold test.
- `STATUS.rooted` (labels.ts) has a placeholder look for W6, needed for the `Record<StatusId, …>` type.
- The sim's `DeathRecord` gains the same optional `duel?` / `grove?` shapes as `DeathRecap`.
- `ledger.duel` is `{parries, killShots, wardsDealt}`, `ledger.grove` `{saplingsLost, summonDamage, rootbondHeal}`.

**Files W0b touched that later workstreams own** (only these lines; the owners rebase and own the rest): W4 `src/render/entities.ts` (Blood Rage cap via `bloodRageOf`) and `src/render/lab/VfxLab.tsx` (`bloodOf`); W6 `src/ui/hud/sighting.ts` (`allyOf`), `src/ui/hud/legionLook.ts` (`healBarelyTakes`), `src/ui/screens/rosterModel.ts` (`passiveRow`, `healCutStackText`, `bloodLine`), `src/ui/hud/labels.ts` (`STATUS.rooted`), `src/ui/screens/deedsModel.ts` (`heroTally`); W8 `tools/harness-core.ts` (HarmonyWatch on `bloodRageOf`); W3 `src/content/legionRun.ts`, `src/content/unstitchedRun.ts`, `src/meta/run.ts`, `src/meta/deeds.ts`. `hudBridge.ts` needed no edit (its `weaverHealCut` call is narrowed inside `blood.ts`). Test files edited for types or the new choice: `tests/sim/brann*.test.ts` (`bloodRageOf(BRANN)!`), `tests/meta/deeds.test.ts` (a throwing `heroTally` case), `tests/meta/run.test.ts` (the last *unranked* choice).

**Expected reds after W0b: none.** Main stays green, so W0b's landing commit closed the eight roster-size reds itself (the tests now expect six heroes; `harnessTools.test.ts` tests an unknown id instead of `seren`), plus the Rank gate:

- `eventChoiceProblem(run, id, allowance?)` refuses a Rank-gated choice (`Opens at Rank N.`) unless `allowance.recruits` holds its recruit; with no allowance it refuses, the same convention as `recruitsOf`. `chooseEvent` passes its allowance through (the store's real allowance; `EVERYTHING` by default).
- The EventScreen hides Rank-gated choices until W6's filter replaces the line in `EventScreen.tsx`, so no profile sees them on main meanwhile.
- `src/ui/lab/mock.ts` and `loomRunMock.ts` pick the last *unranked* choice again.
- `tests/sim/rosterContracts.test.ts` pins the gate (below Rank, no allowance, at Rank, `EVERYTHING`).

The e2e unlockAll picker counts (six heroes) remain W6's. The plan's other named reds (`deeds.test.ts:182-201`, `demo.test.ts`, `appStores.test.ts:279`, `renderBonds.test.ts`, `audio.test.ts`, `audioPhase5d.test.ts:914-920`) turn red only with the owners' own additions (ROSTER_DEEDS, cue and sound rows, LEITMOTIFS), and stay theirs to close.

### Integration hand-over (m5/integration)

The workstreams merged in order W8 (with W7, W1 and W2), W2b, W6 (with W3), W4, W5. The wiring done there:

- **Announcements.** The sim calls `talentFired` for the eight ids above (`duel.ts`, `grove.ts`, `summons.ts`); render’s `BOND_CUES`/`CUE_LIFE` and audio’s `TALENT_SOUND_GROUPS` list exactly those, and `PENDING_5E` (renderBonds) is empty. Blade Waltz and Thorned Bark are `FREQUENT` (no callout).
- **Down recaps.** `downHero` fills `DeathRecord.duel` (`duelDownRecord`: a Ward on her as the blow came, read before it absorbs; the blow was a melee blow aimed at her; overextended; an enemy’s hit from beyond `PARRY_REACH`) and `DeathRecord.grove` (`groveDownRecord`: an enemy’s melee swing or a blow from within 6 m; `GroveState.feltOutside`, the Saplings felled outside your field this fight; a Severing cut of the Thread on him in the last 5 s, `GroveState.threadCutAt`). Both keys are set lazily and only on Oro, so no other party’s state changes. `downAdvice` reads them on the Result and the Summary.
- **Result stats.** `CombatOutcome.party[i].duel` adds `wardsDealt` from `ledger.duel` (the Ward counters and the kill shots), which the duel line now shows; `.grove` adds `summonDamage` from `ledger.grove`. Both are optional in the save, so older results load and read as before.
- **Threat on the map.** An event whose Rank-gated recruiting fight your Rank shows (the Tithe Altar, the Loose Thread) names that fight’s row Threat on the map (`nodeThreat`), as the Result already did (`rowThreat`).
- **Goldens.** The three Oro goldens (skilled-oro-bellwarden, skilled-oro-conductor, novice-grove-mirror-hall) were re-recorded once W2b (Q1-Q3) landed, with their `ROSTER_HASHES` literals; the nineteen and the three Seren goldens are unchanged.
- **Render tests.** `tests/renderOro.test.ts` stages its own summons, so it first takes away the ones the sim now plants (`clearGrove`).
- Seren’s chip line: the overextended chip reads Rally for the Chronomancer and for the Anchor and Swap Reel variants.
- **Sim fixes after integration (m5/fix-sim).**
  - Unflinching’s 1.5 s is added where the Ward is made (`addShield` → `unflinchWard`), so a Ward that lands on a stunned, staggered or Reeled Seren keeps it, and a Ward cast in Stasis gains it once (it used to gain it on every frozen tick).
  - A Gentle Oro obeys Hold as he obeys a Rally: no retreat from his hold spot.
  - An uncued Wildgrowth’s Ancient leaves in `finishSolo` (World Tree: 4 s later); a Cued one keeps Q2’s 8 s from rising.
  - Verified already fixed: Duellist’s Honour returns a Ward charge (the Temporal Mastery way), a Reel or Rewind loses a pending counter or kill shot, and Anchor and Swap don’t end her duel.
- **Sim fixes after review (m5/review-sim).** Each is reached only with Seren or Oro in the party.
  - Stasis holds the immunity behind Oro’s root (`rootImmuneUntil`) as it holds the root itself.
  - A blow that lands on a Sapling never Severs, bolt or swing.
  - Feint’s step leaves the blow: the 2.5 m sidestep when it does, else the nearest spot inside the leash that leaves every blow aimed at her (or the dodge she already chose). A step that answers a blow holds until it lands; one that answers none is her own 0.5 s (`HeroDodge.free`), which Stasis doesn’t hold. Feint (a) waits out Stasis.
  - Her ordinary dodge stays within the 13 m leash (`duelEscape`): a clamped spot that is back in the blow is replaced by the nearest one in reach that leaves it.
  - Under an Aegis Link, her own share of a blow aimed at her can be parried (Blade Waltz, or a Ward that arms her); the shares sent to the others still land, and a share sent to her is never parried.
  - A parried telegraph resolves as `warded`, never `hit`.
  - A Reel, Rewind or Rally during Thousand Cuts moves its start point (the Reel’s landing, the Rewind’s spot, 2.5 m from you on her side), so the cuts end there, not back in the pack.
  - Gentle reads a Focus standing up again (Restless Dead) as no Focus, as his targeting does.
  - Regrowth’s Call opens only for a hurt Sapling within Regrowth’s reach of him.
  - Under the Silent Verse, a front spot outside every hymn circle is drawn into the circle the Weaver stands in (else the nearest), so a Rally re-plants the Saplings inside it.
  - Down recaps: Oro’s `melee` needs a lesser foe (normal or elite, not heavy) and no raid, mark or link; Seren’s `far` is a bolt or beam only, and her `overextended` needs a blow from the pack (a plain hit, or a lesser foe’s telegraph that is no raid, mark or link). Their Movement I telegraph downs carry the telegraph’s answers. `deathAdviceLine` ends with `downFallback` (Oro’s Saplings felled outside your songs, else each hero’s steady line), so every one of their downs names an answer, and the blow’s own answer comes before the felled Saplings.

## Exit criteria

1. Every pin above is byte-identical, and vitest and e2e are green with no allow-list left.
2. Both heroes are recruitable by event and fallback at their Ranks, and under Skip the unlocks; pickable; and playable in every Movement and the Finale. A won ‘Pull it’ recruits nobody.
3. Every band is met on all three sets, or accepted with reasons in a ‘missed and accepted’ table. OB’s bands are as you decided under Q8.
4. 100% of Seren and Oro downs in band runs have a recap naming the answer, and every rule is shown where the player looks.
5. Q1-Q3 are answered and the build matches, or their fallbacks ship.
6. A post-merge playtest cold read scores ≥ 4/5 on ‘what does a Ward on Seren do?’ and ‘why did my Sapling die?’ (docs/phase-5b/playtest-protocol.md).

## Known gaps (deliberate)

- The mirror choir still mirrors only Lyra, Brann, Kael and Vexis (`crucible.ts:206-236`), so ‘every voice of your party’ is inexact for Seren and Oro parties. The HUD’s Mirror Choir line names the four mirrored heroes.
- Summons can’t be Warded, Threaded, Reeled, Chimed, Sunrise-healed, domed or Vow-held. Telegraphs never hit them, they take no statuses, and bosses and heavy foes ignore them.
- OB has no boss soak (Q8).
- The Novice rarely Focuses, so Novice Oro parties play a tending Oro; the tending bonus is the design’s answer.
- Seren’s stance is clamped to the Weaver, so a Weaver who Glides away can leave her out of reach; the chip says so.
- For the Chronomancer, Rewind is not a reliable extraction from a duel; Rally is.
- Seren’s model silver equals the Grand Silence’s stilled ink. Only the model uses it, and it is never a UI colour.
- No new Harmonies (1/12 against 03 §12), no hero relics, no 4th slot, no Conductor Calling, no Training Grounds parties.
- **Content counts after 5e:**
  - heroes 6/6;
  - Bond motifs +2;
  - bonds.ts entries 36 → 54 (12 talents, 2 alternate Solos, 4 scenes);
  - Deeds 27 → 29;
  - events 10, with two choices appended;
  - encounters, relics, auras and ornaments unchanged.

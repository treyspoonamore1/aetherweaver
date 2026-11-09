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
  - Sostenuto regenerates 1.5% of a Sapling’s life a second (6.8/s at 456; 5.7/s at the first look's 380);
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
  - an elite is executed at or below 50% life, and otherwise takes 6× her attack (432 before auras since W9 tuning round 1; 360 at the first look);
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
| How summons hold enemies | **Taunt only.**<br>• A Sapling pulses a 2.5 s taunt every 4 s (5 s until W9 tuning round 1) on normal and elite, non-heavy enemies within 3.5 m. Each hit refreshes the taunt on its target.<br>• It writes `tauntTarget` only when the taunt is empty, expired or another summon’s, so it never overwrites Challenge or Feint.<br>• Bosses, minibosses and heavy foes ignore summons. A summon has no threat entry. | `pickEnemyTarget` already accepts any live entity for a taunt (`threat.ts:39-44`). The tier rule is Challenge’s (`heroes.ts:1146-1149`). A boss can’t be pinned on a body the Weaver can’t Ward. |
| Telegraphs on summons | **Telegraphs, raids, marks, links, zone pulls, splash and chain never hit summons.**<br>• A taunted enemy’s **basic** swings at the Sapling.<br>• A **special** that would aim at a summon re-aims at the hero it would pick without the taunt (one guarded line in `trySpecial`).<br>• Enemy bolt splash and chain skip summons: one guarded `continue` each in `hits.ts:45-50, 56-62`. | `candidates()` (`telegraphs.ts:226-242`), `countAimed`, `updateIncoming`, the Discord quorum (`:476-477`) and the Perfect logic stay byte-identical. The rule to learn: ‘Saplings soak blows, never shapes.’ |
| Statuses on summons | **None.** `addStatus` refuses a summon target with one guarded line, beside the hero-only refusal (`health.ts:330`). Bleeds and Vampiric’s Wound (`legion.ts:452-460`) never land, and `applyOnHit` (`health.ts:445-462`) is then a no-op on them. | Nothing could answer a status on a summon: Chime can’t target one. |
| Severing and summons | A blow that lands on a summon never Severs. One guarded `!target.summon` sits in the melee path (`enemies.ts:406`); telegraphs never hit summons anyway. | Saplings would otherwise park Severing elites beside the Thread, and `severingHit` tests the attacker against the Thread segment (`thread.ts:150-171`). |
| Saplings are planted | Saplings are immovable bodies that block enemies. They sprout at fight start at the Weaver’s front spots, **4 m ahead and ±2.5 m** (5 m until W9 tuning round 1, inside the 4-6 m lever range). A felled Sapling re-sprouts beside Oro after 12 s. | A tree you must cover is the puzzle; pets that path would be noise. 5 m ahead and a 3.5 m taunt kept held packs about 3 m clear of the Weaver (at 4 m, about 2 m; W9 round 1 measured the Weaver's road damage lower at 4 m than at 5 or 6). Revision 1’s 3 m spots parked them at her feet. |
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
| The counter | **Deferred one tick** through `duel.parryOn` (the `riposteOn` pattern, `health.ts:871-881` → `heroes.ts:99-103`). It is answered **after** `isDisabled` (`health.ts:107-115`, which includes `stilled`), so a stunned, stilled or possessed Seren still parries but doesn’t counter.<br>3 × her attack (216 base since W9 tuning round 1; 180 at the first look) goes through `heroDamage`, so auras, Empower and crit apply. It strikes the attacker if within her reach + 1 m, otherwise it is lost. Threat goes on her slot. | No re-entrant `dealDamage` inside an enemy’s swing. It also closes, for her, the hole Riposte Bash has of firing while stilled (docs/phase-5d.md:169). |
| Credit for Ward-caused damage | Negated damage goes to `ledger.negated`, `ledger.shielded` and her `supportReceived`. A lazy `ledger.duel` records the parries, and the counter and kill-shot damage as ‘your Wards dealt’. Those numbers carry the Weaver’s gold chip and are **not** added to amplified totals, so nothing is double counted. | ‘Gold means the Weaver did this’ (04 §1). It makes ‘Wards into damage’ show in proof of support. |
| Kill shot | **Any Perfect Ward on a telegraph aimed at her** marks a kill shot on its owner. The hook in `perfect()` beside `riposteBash` (`telegraphs.ts:600-601`) only sets `duel.killShotOn = owner`; every existing Perfect effect still happens (stagger, +20 Resonance, refund, Riposte Bloom, relics, a Grand Silence note).<br>The shot itself is taken **next tick**, after `isDisabled`. It is **lost** if she is disabled or stilled, while `field.finale?.silence` holds, or if the owner is gone.<br>• If the owner is within 9 m of her and the landing is within 13 m of the Weaver, she leaps to it (her own landing rule in `duel.ts`, modelled on `leapLanding`, `heroes.ts:1384-1395`).<br>• Otherwise a thrown silver lance strikes it at range.<br>Damage follows Q5. It goes through `dealDamage`, so invulnerability, `rising`, `phaseShiftUntil` (`health.ts:733-738`), guard arcs, tethers and Pacts apply: a kill shot into a Sentinel’s front glances. It counts as a parry for En Garde. | The leap reads as a duel move but never takes her out of reach, and ‘only the Weaver acts’ holds in the Grand Silence. The thrown lance keeps a sniper’s Perfect worth something. |
| Showboat target | **The strongest enemy within 12 m of the Weaver**, rechecked **every tick** in the duelist arm of `chooseTarget`. She picks when she has no live quarry, or when a higher-tier enemy enters the 12 m, after a 0.8 s bark. No `onPackArrived` hook, since it returns at wave ≤ 1 (`heroes.ts:1564`) and would skip wave 1 and every boss fight.<br>• Rank by tier (boss > miniboss > elite > normal), then max life, then id.<br>• Skip `stationary` enemies (Void Maw, Spindles) unless Focused.<br>• Prefer enemies **not targeting Kael** when Kael is in the party; if Kael’s target is the only choice, she duels it **from the flank** (`flank()`, `heroes.ts:525`). **In a boss fight, a normal or elite enemy swinging at Kael that is not his own target is hers** (W9 round 2, lever 2: she peels the adds off him; the boss stays his).<br>Focus overrides. The pick is sticky for 8 s or until the target dies. A **Rally or Reel ends it and suspends it for 4 s; she always obeys.** The Reel here is the pull (and the Chronomancer’s Rewind): Anchor and Swap pull nothing, so they leave her duel standing and Rally is their answer (*By Calling*). | It fixes 5b’s cause 1 by design: she never queues in Kael’s cone. Skipping stationary enemies keeps her out of the Maw’s Inhale. Obeying Rally keeps her distinct from Brann. |
| The leash | Every destination is clamped to **13 m from the Weaver**. Out of a duel her leash is 9 m. Lunge and Thousand Cuts never take her past the clamp. | Ward, Chime, Reel and the Thread reach 14 m. |
| Overextended | While duelling, with **3 or more enemies targeting her**, or below 40% life outside every field. This raises a frame chip, a glyph and a hint, and she won’t leave on her own.<br>Answers: Reel, Rally, Cue Thousand Cuts (invulnerable), Stasis, a dome; for the Chronomancer, Rally or an *early* Rewind. | One readable rule shared by HUD, bots and recaps (`overextended()` is a pure rule). Rewind returns her to where she was 3 s ago (`callings.ts:189`), so it extracts her only if used as the pack closes. |
| Seren’s movement branch | **Her own branch** in `combatMove`. Nothing in the berserker code changes: `const berserker`, `lust`, the leash, the Hold chase, the `berserker &&` guard at `heroes.ts:326` and the `sidestepOthers` call at `:350` stay as they are.<br>• In the Rally arm, a **separate** line `if (def.role === 'duelist' && formationSidestep(...)) return;` sits beside Brann’s.<br>• A new `else if (def.role === 'duelist') duelMove(...)` arm sits before the `flank` arm. It calls `sidestepOthers` itself, so she steps out of every telegraph aimed at **another** hero. | Brann’s path is untouched, as the W0a A/B/C snapshots prove. |
| Seren’s stance and dodge | Warded, she **never dodges** a parryable blow aimed at her (‘she stands her ground’). Two pieces:<br>(a) in `noticeTelegraphs`, a hero-specific `if (hero.duel && duelStands(world, e, t)) continue;` placed after `contains()` and before the `rng.ai` roll (`heroes.ts:1431-1441`). The shared `chance` expression and every other hero’s draws are untouched.<br>(b) each tick, in the duel hook, a pending `hero.dodge` from a parryable telegraph aimed at her is **cancelled** once a Ward lands on her.<br>Other blows aimed at her get her ordinary `dodge 0.45` through the existing roll. | Her dodge is decided when she first notices the telegraph, up to 0.75 s before the Perfect window, so without (b) a late Perfect would usually find her already stepping out. The stance makes the parry dependable and visible. |
| Lunge | **Own target rule `lungeTarget`** in `duel.ts` (not `leapTarget`, which leashes to BERSERKER_LEASH and picks by Focus, caster and nearest, `blood.ts:348-385`):<br>(1) an interruptible caster within 9 m **at any distance**; within 3.5 m it is a contact lunge, a thrust with no dash;<br>(2) otherwise her quarry, 3.5-9 m away.<br>Every landing is clamped to 13 m from the Weaver. It **interrupts** the cast it lands on, as Sunder Leap does (`heroes.ts:1326-1361`).<br>Refused while Held, Scattered with a link on her, rooted or pinned, latched, during a Rally, or if it would land past the clamp.<br>**In a fight whose boss or miniboss has an interruptible special, Lunge is spent only on interrupts.** | Party W (Vexis, Seren, Oro) has no other boss interrupter: bosses refuse Vexis’s stun (`health.ts:273-276`). So every 3-hero party can stop the Mirror Ward and every Finale Solo (docs/phase-5c.md:478-487), even with Seren already face to face at 1.2 m. |
| Calls and `calls.ts` | `canCall` and `startCall` (`calls.ts:39-120`) pick the Call’s target through `leapTarget` for any ability with `minRange` (`:54, 95`). W0b adds one guarded dispatch: `ability.id === 'lunge' ? lungeTarget(...) : leapTarget(...)`. Regrowth’s opening rule (a Sapling felled or below 60%) is one more guarded `if (ability.id === 'regrowth' && !groveCallReady(...)) return false;`. | Brann’s Call is unchanged; Seren’s Call marks the enemy she will Lunge at. |
| Feint | A **sure** 2.5 m sidestep (HeroDodge `sure`, `state.ts:411-421`) plus a 3 s **hard taunt** of one normal or elite enemy (`tauntTarget` plus `topThreat(...,150)`, the Challenge rule). The Hollow Champion is normal tier, so Feint holds it. On a boss or miniboss it is only the step. | Kael keeps bosses. Feint makes the duel blow you Ward. |
| Thousand Cuts | 8 cuts over 4 s. Each is a blink to the nearest enemy not yet struck within 10 m of her start point and 13 m of the Weaver; it cycles when fewer remain. She is **invulnerable throughout** (`health.invulnerable` re-armed each pulse, an existing number), and at the end she **returns to her start point**.<br>**Cued:** each kill adds 0.5 s, up to +4 s. The extended end is stored (`duel.cutsEnd`), so `castProgress` (`solos.ts:104`) reads true. | It never strands her or snaps the Thread. |
| Gentle | Without a Focus, Oro doesn’t attack and casts Bramble only defensively.<br>• His own **gentle retreat** in `grove.ts` steps 3 m away from any enemy within 4 m. The ranged `kite` (`heroes.ts:601-620`) only reacts to enemies targeting that hero within 3 m.<br>• His Saplings are *tended* (+50% damage).<br>• With a Focus he thorns it and Snares it.<br>• He never stands in a blow aimed at another hero (W9 prep, the first look's diagnosis 1): his own lines in `combatMove` call `sidestepOthers`, as Seren's arm does, on his formation slot (no target or a Rally, through `formationSidestep`), on Gentle's retreat spot, and on his Focus position. Hold still holds him, and a blow aimed at him is the Weaver's to Ward.<br>His Solo charges, and autonomy’s `cueGrace` accrues, while he **or a Sapling** has a target: call sites at `heroes.ts:131` (charge), `:140` (`soloHeld`) and `:262` (`shouldFireUncued`’s `targetId === null` return). | He is never a zero-damage hero, and Focus becomes a trade-off rather than a switch. Without the three call sites a target-less Oro never charges and never fires uncued (docs/hero-autonomy.md). |
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
| attack | `melee` rapier, **72** per **0.75 s**, range 2.2, no cleave | 96 dps (Kael 69, Lyra 90). W9 tuning round 1: 60 → 72, the +20% edge (lever 1); her counter (3×) and kill shot (6×) scale with it |
| preferredRange | 1.2 | |
| threatMult | 1.0 | Kael’s 3 keeps bosses on him. With no Kael, her hits on a boss or miniboss count ×6 (`DUEL_BOSS_THREAT`, W9 prep; *default, awaiting your confirmation*), so she holds them (*By party*) |
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
| life / armour | **456** / 0.2 (380 until W9 tuning round 1: +20%, lever 1) | **2,000** / 0.3 |
| radius | 0.55 | 1.1 (height 2.6) |
| attack | melee 26 per 1.1 s, range 2.0 | slam 70 per 1.5 s, hits all within 3 m |
| hold | 3.5 m taunt pulse every 4 s (5 s until W9 tuning round 1) for 2.5 s, refreshed on its target by each hit; normal and elite, non-heavy | re-taunts normal and elite, non-heavy enemies within 7 m every 1 s |
| root | none | 1.5 s on rising, within 7 m, normal and elite, non-heavy |
| lifetime | until felled; re-sprouts beside Oro 12 s later | uncued: until Wildgrowth ends (`finishSolo`; the Solo’s 8 s include the 1 s warning); Cued: 8 s from rising (Q2; 12 s under Q2’s fallback); World Tree: 4 s more either way |
| tended (Gentle, no Focus) | +50% damage | n/a |
| place | the Weaver’s front spots (4 m ahead, ±2.5 m; 5 m until W9 tuning round 1) at fight start; re-planted there by a Rally | the Focus target if within 10 m of Oro; else the centroid of enemies within 10 m of him targeting the party; else 3 m in front of him. Clamped to 12 m from the Weaver, after a 1.0 s ground warning |

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
  - Oro’s card gains a Saplings row: ‘2 Saplings · 456 life · take your songs · bosses ignore them’ (the life is read from content);
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
| SB (Lyra, Vexis, Seren) | Lyra, Seren | none | Seren, by threat (her boss threat ×6 with no Kael), who parries | Ward her boss blows; Crescendo mandatory |
| SC (Kael, Lyra, Seren) | all three | Kael | Kael | |
| OA (Kael, Vexis, Oro) | Kael | Kael | Kael | damage-light (party A’s lesson): Focus matters |
| OB (Lyra, Vexis, Oro) | Lyra | none | **none** (threat: Lyra or Vexis) | the hardest party (Q8); Prep note |
| OC (Kael, Lyra, Oro) | Kael, Lyra | Kael | Kael | |
| R (Kael, Brann, Seren) | Kael, Brann, Seren | Kael | Kael | Red Line; three melee heroes |
| SO (Kael, Seren, Oro) | Kael, Seren | Kael | Kael | |
| X (Brann, Seren, Oro) | Brann, Seren | none | Seren, by threat (as SB: no Kael, so her boss threat ×6 outweighs Brann's 1.2), who parries | no starter |
| W (Vexis, Seren, Oro) | Seren (Lunge held for boss casts) | none | Seren, by threat (as SB), who parries | the no-Kael, no-Lyra case |

`partyHasDome` stays Kael-only, so 10 of the 20 parties read `decreeNoDome` (`legionLook.ts:97-145`).

**Seren holds the Kael-less bosses (W9 prep; *default, awaiting your confirmation*).** The rows above are binding. Measured at the first look's re-run (24 seeds from 1000), a Kael-less boss stayed on Lyra or Vexis: SB 93-98% on Lyra at all four bosses, W 85-94% on Vexis. Lever 1 cannot do it: her `threatMult` at the +20% edge (1.2) moved it by 0-5 points (12 seeds: SB 0-3% on her, W 5-18%), because Lyra's Empowered arrows out-deal her about 7 : 1 at a boss. So it is lever 2, a hero-only threat rule in `duel.ts` (`duelThreat`, called from one guarded line after the plain threat in `dealDamage`, so the rule's one call site is in the shared `src/sim/combat/health.ts`; it returns at once unless the source has `hero.duel` and the party has no tank): with no tank (Kael) in the party, her hits on a **boss or miniboss** count `DUEL_BOSS_THREAT` = 6 times her threat. ×3 held only the Cantor in SB (68%), ×4 the Cantor and the Conductor (94%, 79%), ×6 all four (93-98%), and ×10 no more than ×6. It is threat, not a taunt: a boss is still never bound, and a bigger hitter can still take it from her. Inert in every party with Kael, so SA, SC, R, SO and every pin are unchanged. With Kael, the band ‘Kael holds bosses ≥ 70% of boss time in SA and SC’ is read beside the default party's own Kael share in the same run (W9 prep below): no Seren number touches it.

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
  - DuelMarks chips (the BloodMarks pattern, `PartyFrames.tsx:911, 948-987`): ‘En garde’, ‘Parry ×2’, ‘Duelling ‹name›’, ‘Overextended · Reel {F}’ (‘· Rally {C}’ for the Chronomancer, and for the Anchor and Swap Reel variants), ‘Out of reach · Glide closer’.
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
| `serenParryWard` | Ward her when her mark’s next melee swing is due within the Ward’s life and no Perfect is pending (the brannWard pattern, `:1868-1882`). **In a boss or miniboss fight it Wards her only against the boss’s own parryable blow aimed at her, and never while a telegraph aimed at another hero is live**, so Kael’s boss blows keep their Ward (5b’s ‘Kael’s own blows went unwarded’ knock-on). **A plain (untelegraphed) swing never takes the last Ward charge** (W9 prep, after the ablation: holding a Kael-less boss, she drew a Ward for every boss swing and left the next cone on Lyra or Vexis unwarded). |
| `serenCall` | The plain Call answer, kept for her: a Ward answers her Lunge Call. A rule only so the ablation can leave her Call unanswered (W9 prep); Kael's and Brann's Ward Calls are never under it. |
| `serenReel` | When she is overextended and hurt. It runs after every existing Reel rule (`mawReel`, `brannReel` and the Twin Cleave reserve, which exists only with Brann at `:635`, and `silenceReel`), and is skipped while any lethal telegraph is live, so the plain loop keeps the Reel for it. For the Chronomancer, and with the Swap Reel variant (`serenNoSwap`), it issues a Rally instead; with the Anchor variant (no pull) a Rally, with the Anchor cast on her beside it when she is in its reach. |
| `serenNoSwap` | Never Swap into her duel. |
| `serenCue` | Thousand Cuts at ≥ 4 enemies or when she is overextended. |
| `oroFocus` | When he is tending, Focus Kael’s target or the boss. Until W9 round 2 only with 1-3 enemies standing (a crowd guard like SENTINEL_FOCUS_AT, `:285`); round 2 lifted the guard (behind it he tended 41-53% of the road, band ≤ 25%). **W9 round 3:** once his Focus has fallen the next one waits 2 s, not the plain 4 s between Focuses (`ORO_REFOCUS`; OB and OC tended 34% and 31% of the road); and **with Kael in the party, no Focus at a boss that calls a pack** (`packCaller`: a summon special of 3 or more mobile, non-heavy foes, today the Hollow Cantor's Choristers). A Focus stands until its target falls, so on the Cantor it held Kael and Seren on the boss all fight while the Choir mauled Kael; Oro tends there instead, his Saplings on the Choir. Ablated first. |
| `oroRally` | A Sapling outside every field for > 2 s, throttled by `gap()` (`:921-924`) so a bloodlusting Brann’s 8 s holds; only when its re-plant spot at the Weaver's front would stand in the field (`replantInField`; through the Silent Verse `frontSpot` draws the spots into her hymn circle, so the Rally is made). **Not while a boss or miniboss is on a hero whose formation spot is behind you** (Lyra, Vexis, Oro: `bossBehind`, W9 prep, after the ablation): the Rally walks that hero home and the boss after it, through you and the grove. With Kael, Brann or Seren holding it the Rally goes ahead as before. |
| `oroThread` | Mend-Thread Oro when the Saplings are hurt and the party is calm; never under Unravel (Mend wounds and Rootbond is skipped), Stasis aside; **never while a Thread-cutter stands** (an enemy with a `threadLine` special, Movement III's Shears: W9 round 2, Thread cuts). |
| `groveCover` | Weights the Saplings into `position()`’s centroid at 1:2 (`:1339-1392`). **Not in a fight with no boss and a tank (Kael) in the party** (W9 round 2): Kael holds the pack, and a Weaver drawn toward the grove drew it onto herself. At bosses, and with no tank, as before. |
| `oroCue` | Wildgrowth on a pack of ≥ 3, or Cued when the Saplings are out of the field. |
| `discordBreaker` | Empower the hardest hitter against discord shields in Seren or Oro parties **with no Lyra in the roster**. It tests `state.party`, not the alive set (`:726-729`), so the default party is unchanged when Lyra is down. |

Thread rules are **post-pick modifiers** (`:746-783`), never a fork beside `else if (blood)` (`:708`), so parties R and X compose with brannThread. The revive-winding (`:704`) widens to any recruit.

### Novice

- `NOVICE_ROSTER` draws, each taken only with that hero present and appended immediately before the Cue draw (`novice.ts:378-382`), ablatable through `skip`:
  - `serenWard` 0.3 (engaged and unwarded);
  - `oroFocus` 0.15 (tending, enemies near);
  - `saplingRally` 0.2 (a Sapling outside, and a re-plant spot in the field: `replantInField`).
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

## W9 prep (2026-11-08): the first look re-measured, the road, the ablation

*Branch `m5/tune` from main `65f8748` (W2b in). Prep before tuning, in the agreed lever order: two hero-only rules in the sim (lever 2), two bot-rule fixes after the ablation (lever 3), one ablation-only rule name, and the band tool's down records. No Seren or Oro number (lever 1), Bond or motif value (lever 4) moved. Never moved: Weaver, aura, enemy, encounter, Movement, road, starter and Brann numbers; no aura definition, number, list or reach. Every existing fight is unchanged: the 19 original goldens are byte-identical, `SIM_VERSION` is 22, `contentVersion` is unchanged, and the four Seren and Oro goldens that moved (`skilled-seren-crimson-gate`, the three Oro ones) are re-recorded with their `ROSTER_HASHES` literals.*

Raw outputs (scratch `m5e/tune/`): `base-*` (the re-measure on 65f8748, from a detached worktree), `post-*` (after the two lever-2 rules), `g1-*` and `fin-*` (the final tree; `g1-` rows are the ones the last bot fix leaves bit-identical), `cf-*` (the untuned third sets), `road-*`/`fin-road-*` (skirmish, elite and miniboss cells), `abl-*`, `nabl-*`, `fix*-*` (`tools/verbs.ts`), `exp-*` (the boss-threat sweep), and the summarising scripts in `scripts/`. 24 seeds a cell (noise about ±10 points), 50 runs a row (about ±7).

### What changed, and why

| # | Change | Lever | Where | Inert for |
|---|---|---|---|---|
| 1 | **Oro steps out of blows aimed at another hero** (the first look's diagnosis 1: 65% of his downs). His own lines in `combatMove` call `sidestepOthers`, as Seren's arm does: his formation slot (no target or a Rally, through `formationSidestep`), Gentle's retreat spot, and his Focus position (the ranged and flank arms). Hold still holds him; a blow aimed at him stays the Weaver's to Ward. | 2 | `heroes.ts`, four `def.role === 'summoner'` lines | every party without Oro (only he is a summoner) |
| 2 | **Seren holds the Kael-less bosses** (*By party*, binding; *default, awaiting your confirmation*). With no tank in the party, her hits on a boss or miniboss count `DUEL_BOSS_THREAT` = 6 times her threat (`duelThreat`, one guarded line after the plain threat in `dealDamage`). | 2 | `duel.ts`, `health.ts` | every party with Kael, and every party without Seren |
| 3 | **`serenParryWard`: a plain swing never takes the last Ward charge.** Holding a Kael-less boss, she drew a Ward for every boss swing and left the next cone on Lyra or Vexis unwarded (SB at Vharun 5.17 downs a fight with the rule, 3.08 without). | 3 | `skilled.ts` | parties without Seren |
| 4 | **`oroRally` waits while a boss or miniboss is on a hero who stands behind you** (Lyra, Vexis, Oro: `bossBehind`). The Rally walked that hero home and the boss after it, through the Weaver and the grove: in OB the rule cost 8-21 points at the Unweaver, the Conductor, the Cantor and the Bellwarden. | 3 | `skilled.ts` | parties without Oro |
| 5 | `serenCall` names the plain Call answer for her, so the ablation can leave it off; on, it changes nothing. | — | `skilled.ts` | everyone (on) |
| 6 | `DownRecord.gap`: the blow's source distance from the victim (past both bodies), and the down table's recap and source columns. | tools | `roster-bands.ts` | — |

Tests: `tests/sim/oroSidestep.test.ts` (slot, retreat and Focus positions out of a cone aimed at Kael or Vexis; Hold holds him), `tests/sim/serenThreat.test.ts` (×6 on a boss and a miniboss with no tank; plain threat with Kael, on a lesser foe, for another hero, and with `noThreat`), and staged bot tests for `serenCall`, the spare charge and `bossBehind` (`tests/bots.test.ts`).

### Seren holds the Kael-less bosses: lever 1 cannot, lever 2 does

*Default, awaiting your confirmation.* The *By party* rows (SB, W: ‘threat (Seren usually), who parries’) are binding, and the first look's re-run showed the opposite: in SB the bosses were on Lyra 93-98% of the time, in W on Vexis 85-94%. At a boss Lyra's Empowered arrows out-deal Seren about 7 : 1 (SB at Vharun, seed 1000: 71k against 9.7k over 170 s), so her threat multiplier would need about ×7.

| Try (12 seeds a cell, set 1000, Skilled) | SB: boss on Seren (Cantor / Vharun / Unweaver / Conductor) | SB win | W, X | Kept |
|---|---|---|---|---|
| none (the re-measure, 24 seeds) | 1 / 1 / 0 / 0% | 54 / 100 / 96 / 96% | W 13 / 10 / 6 / 5%; X 21 / 33 / 9 / 4% | — |
| lever 1: `threatMult` 1.2 (the ±20% edge) | 3 / 0 / 0 / 0% | 50 / 100 / 100 / 100% | W 18 / 13 / 7 / 5% | no: cannot do it |
| lever 2, ×3 | 68 / 15 / 1 / 7% | 92 / 100 / 100 / 100% | W 98 / 91 / 66 / 72%; X 97 / 89 / 18 / 99% | no |
| lever 2, ×4 | 94 / 35 / 48 / 79% | 100 / 92 / 83 / 100% | — | no |
| **lever 2, ×6** | 97 / 93 / 93 / 98% | 100 / 100 / 92 / 100% | W 98 / 91 / 99%; X 96 / 83% | **yes** |
| lever 2, ×10 | 97 / 94 / 96 / 98% | 100 / 100 / 83 / 100% | — | no: no more than ×6 |

So it is lever 2: a hero-only threat rule, inert unless Seren is in the party and Kael is not. It is threat, not a taunt: a boss is never bound, and a bigger hitter can still take it from her. With it (the final tree, 24 seeds), the bosses are on her 84-98% of the time in SB, 90-100% in W and 90-99% in X, and she parries 57-59% of the Wards on her (band ≥ 50%; 7-9% in the Kael parties, where the boss is Kael's).

**Kael's hold in SA and SC.** The band ‘Kael holds bosses ≥ 70% of boss time in SA and SC’ is not reachable with Seren's numbers, because the default party itself doesn't meet it: pooled over the four bosses, Kael holds 47% in the default party (Cantor 82, Vharun 12, Unweaver 43, Conductor 64), 51% in SA and 41% in SC (Seren takes 0-1% in both; Lyra or Vexis out-threats Kael at Vharun and the Unweaver in every Kael party). Only Kael's or Lyra's numbers could move it, and they are never moved: **NEEDS USER** (restate the band against the default party's own Kael share, or accept it as missed).

### The first look re-measured with W2b (65f8748, before any W9 change)

Cells: the default party and the ten banded parties at each Movement's boss, 24 seeds from 1000, Idle, Novice and Skilled (`roster-bands.ts --first-look`, split in lanes). Runs: 50 Skilled Finale-route runs from 2000.


**Skilled win (the Novice's in brackets), gap to default in the same run (24 seeds)**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | 96% (62%) | 96% (50%) | 100% (38%) | 96% (25%) |
| SA | 96% (38%) +0 | 88% (54%) -8 | 100% (0%) +0 | 100% (12%) +4 |
| SB | 54% (25%) -42 ⚠ | 100% (38%) +4 | 96% (8%) -4 | 96% (17%) +0 |
| SC | 75% (25%) -21 ⚠ | 96% (42%) +0 | 100% (17%) +0 | 100% (4%) +4 |
| OA | 100% (33%) +4 | 100% (17%) +4 | 96% (0%) -4 | 96% (8%) +0 |
| OB | 88% (17%) -8 | 100% (0%) +4 | 67% (0%) -33 ⚠ | 71% (0%) -25 |
| OC | 83% (8%) -12 | 96% (29%) +0 | 96% (0%) -4 | 100% (8%) +4 |
| R | 96% (0%) +0 | 46% (12%) -50 ⚠ | 92% (0%) -8 | 96% (0%) +0 |
| SO | 17% (0%) -79 ⚠ | 0% (4%) -96 ⚠ | 4% (0%) -96 ⚠ | 83% (0%) -12 |
| X | 25% (4%) -71 ⚠ | 46% (25%) -50 ⚠ | 92% (0%) -8 | 88% (0%) -8 |
| W | 71% (0%) -25 ⚠ | 92% (12%) -4 | 96% (0%) -4 | 83% (4%) -12 |

Idle, best win over these cells: default 0%, SA 0%, SB 0%, SC 0%, OA 0%, OB 0%, OC 0%, R 0%, SO 0%, X 0%, W 0%

**Who the boss (or miniboss) targets, Skilled, share of its time**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | kael 82 lyra 17 vexis 0 | lyra 87 kael 12 vexis 0 | lyra 57 kael 43 | kael 64 lyra 23 vexis 13 |
| SA | kael 92 vexis 7 seren 0 | vexis 76 kael 23 seren 1 | kael 60 vexis 40 | vexis 53 kael 46 seren 0 |
| SB | lyra 97 vexis 1 seren 1 | lyra 95 vexis 4 seren 1 | lyra 98 vexis 1 seren 0 | lyra 93 vexis 7 seren 0 |
| SC | kael 67 lyra 32 seren 1 | lyra 92 kael 8 seren 0 | lyra 66 kael 33 seren 0 | kael 66 lyra 34 |
| OA | kael 96 vexis 3 oro 0 | kael 57 vexis 42 oro 0 | kael 57 vexis 43 oro 0 | vexis 54 kael 46 |
| OB | lyra 94 oro 4 vexis 1 | lyra 94 vexis 5 oro 0 | lyra 90 vexis 8 oro 2 | lyra 88 vexis 10 oro 0 |
| OC | kael 89 lyra 9 oro 1 | lyra 82 kael 17 oro 0 | lyra 67 kael 33 oro 0 | kael 51 lyra 49 |
| R | kael 84 brann 11 seren 2 | kael 76 brann 18 seren 4 | kael 96 brann 2 seren 0 | kael 81 brann 17 seren 0 |
| SO | kael 77 seren 13 oro 10 | kael 94 seren 5 oro 1 | kael 95 seren 4 oro 2 | kael 97 seren 2 oro 0 |
| X | brann 65 seren 21 oro 13 | brann 63 seren 33 oro 4 | brann 89 seren 9 oro 2 | brann 95 seren 4 oro 0 |
| W | vexis 85 seren 13 oro 2 | vexis 88 seren 10 oro 2 | vexis 94 seren 6 oro 0 | vexis 94 seren 5 oro 1 |

**Per-down table, Skilled, these cells pooled (read it first)**

| Party | downs a fight | aimed at the victim | at another hero | at no one | basic | tick | beyond 14 m | Seren parry armed | summon near | top blows |
|---|---|---|---|---|---|---|---|---|---|---|
| default | 0.80 | 38 | 21 | 12 | 6 | 0 | 0 | - | 0 | cantor_toll 24, vharun_twin_cleave 15, cantor_requiem 10 |
| SA | 1.88 | 101 | 24 | 40 | 15 | 0 | 6 | 0/26 | 0 | cantor_requiem 38, cantor_toll 37, vharun_twin_cleave_second 36 |
| SB | 1.77 | 46 | 61 | 27 | 36 | 0 | 0 | 0/34 | 0 | vharun_twin_cleave 50, basic 36, vharun_twin_cleave_second 25 |
| SC | 1.64 | 92 | 17 | 31 | 17 | 0 | 2 | 0/27 | 0 | cantor_toll 75, cantor_requiem 31, basic 17 |
| OA | 2.09 | 101 | 66 | 22 | 12 | 0 | 1 | - | 99 | vharun_twin_cleave_second 50, vharun_twin_cleave 34, cantor_toll 30 |
| OB | 2.78 | 85 | 112 | 25 | 45 | 0 | 0 | - | 124 | vharun_twin_cleave 49, unweaver_shear 47, basic 45 |
| OC | 1.06 | 47 | 25 | 16 | 14 | 0 | 1 | - | 37 | cantor_toll 31, cantor_requiem 16, basic 14 |
| R | 4.66 | 227 | 89 | 68 | 61 | 2 | 9 | 2/70 | 0 | vharun_twin_cleave_second 95, cantor_requiem 63, basic 61 |
| SO | 5.94 | 278 | 124 | 25 | 143 | 0 | 6 | 3/153 | 235 | basic 143, cantor_toll 63, vharun_twin_cleave 63 |
| X | 7.50 | 527 | 59 | 22 | 110 | 2 | 25 | 0/109 | 310 | vharun_twin_cleave_second 111, basic 110, champion_cleave 107 |
| W | 3.44 | 167 | 75 | 35 | 53 | 0 | 8 | 0/60 | 127 | unweaver_shear 76, basic 53, vharun_twin_cleave 48 |

**Seren's and Oro's own downs, Skilled, these cells pooled, with the recap fields**

| Party | hero | downs | aimed at them | at another | basic | recap: warded / parryable / far / overextended (Seren); melee / felled outside / thread cut (Oro) | source ≤2 m / 2-6 m / >6 m |
|---|---|---|---|---|---|---|---|
| SA | seren | 26 (0.27 a fight) | 3 | 7 | 1 | 0 / 1 / 0 / 0 | - |
| SB | seren | 34 (0.35 a fight) | 2 | 12 | 13 | 0 / 13 / 0 / 7 | - |
| SC | seren | 27 (0.28 a fight) | 1 | 11 | 7 | 0 / 7 / 0 / 4 | - |
| OA | oro | 36 (0.38 a fight) | 3 | 33 | 0 | 1 / 0 / 0 | - |
| OB | oro | 72 (0.75 a fight) | 8 | 52 | 5 | 5 / 3 / 0 | - |
| OC | oro | 24 (0.25 a fight) | 2 | 17 | 3 | 2 / 4 / 0 | - |
| R | seren | 70 (0.73 a fight) | 12 | 41 | 7 | 2 / 15 / 1 / 2 | - |
| SO | seren | 153 (1.59 a fight) | 24 | 54 | 68 | 3 / 75 / 0 / 52 | - |
| SO | oro | 94 (0.98 a fight) | 18 | 54 | 18 | 16 / 20 / 0 | - |
| X | seren | 109 (1.14 a fight) | 39 | 20 | 46 | 0 / 71 / 0 / 39 | - |
| X | oro | 71 (0.74 a fight) | 18 | 37 | 10 | 11 / 20 / 0 | - |
| W | seren | 60 (0.62 a fight) | 14 | 17 | 21 | 0 / 29 / 0 / 17 | - |
| W | oro | 73 (0.76 a fight) | 9 | 52 | 2 | 3 / 12 / 0 | - |

**Downs a fight by hero, Skilled, pooled**

| Party | kael | lyra | vexis | brann | seren | oro |
|---|---|---|---|---|---|---|
| default | 0.36 | 0.21 | 0.23 |  |  |  |
| SA | 0.82 |  | 0.78 |  | 0.27 |  |
| SB |  | 0.60 | 0.81 |  | 0.35 |  |
| SC | 1.01 | 0.34 |  |  | 0.28 |  |
| OA | 0.83 |  | 0.89 |  |  | 0.38 |
| OB |  | 0.96 | 1.07 |  |  | 0.75 |
| OC | 0.60 | 0.21 |  |  |  | 0.25 |
| R | 2.34 |  |  | 1.58 | 0.73 |  |
| SO | 3.36 |  |  |  | 1.59 | 0.98 |
| X |  |  |  | 5.62 | 1.14 | 0.74 |
| W |  |  | 2.05 |  | 0.62 | 0.76 |

**Seren, Skilled, pooled**

| Party | parries | Wards on her | parried | kill shots | lost | Wards' share of her damage | overextended | answered ≤3 s | beyond 14 m | Showboat pick | Lunge interrupts | downs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SA | 0.4 | 4.5 | 8% | 0.68 | 0.00 | 2% | 0.4 | 79% | 0% | 91% | 3.0 | 0.27 |
| SB | 0.2 | 2.1 | 7% | 0.28 | 0.00 | 1% | 0.7 | 70% | 0% | 97% | 1.7 | 0.35 |
| SC | 0.3 | 3.3 | 9% | 0.24 | 0.00 | 1% | 0.8 | 82% | 0% | 88% | 2.6 | 0.28 |
| R | 0.8 | 7.8 | 11% | 0.76 | 0.00 | 2% | 1.2 | 60% | 0% | 89% | 4.3 | 0.73 |
| SO | 2.2 | 10.9 | 20% | 0.81 | 0.00 | 2% | 3.3 | 64% | 0% | 100% | 6.0 | 1.59 |
| X | 3.5 | 8.8 | 40% | 1.17 | 0.00 | 5% | 3.2 | 69% | 0% | 100% | 3.6 | 1.14 |
| W | 2.3 | 7.0 | 33% | 0.83 | 0.02 | 3% | 2.6 | 73% | 0% | 100% | 2.8 | 0.62 |

**Oro, Skilled (the Novice's in-field share beside it), pooled**

| Party | Saplings in your field | Novice | both standing | felled | tending | Rootbond | Ancients | downs |
|---|---|---|---|---|---|---|---|---|
| OA | 93% | 85% | 100% | 0.1 | 1% | 481 | 4.2 | 0.38 |
| OB | 89% | 72% | 99% | 0.2 | 2% | 601 | 2.4 | 0.75 |
| OC | 92% | 86% | 98% | 0.6 | 2% | 556 | 3.3 | 0.25 |
| SO | 92% | 87% | 98% | 1.2 | 1% | 505 | 6.5 | 0.98 |
| X | 89% | 88% | 98% | 0.9 | 1% | 290 | 4.5 | 0.74 |
| W | 90% | 73% | 98% | 0.8 | 1% | 810 | 4.5 | 0.76 |

Boss seconds on a summon, every cell: 0.0 (expected 0).

**Whole runs (Skilled, 50 Finale-route runs from 2000)**

| Party | Won | Gap | Reached the Finale | Won of those | Fights | Minutes | Bond XP a fight vs the starters' average | Lost most at |
|---|---|---|---|---|---|---|---|---|
| default | 74% |  | 80% | 92% | 13.2 | 19.6 | - | blood_forge 3, the_silent_conductor 3, frayed_threshold 2 |
| SA | 18% | -56 | 18% | 100% | 7.9 | 14.9 | Seren 65% | frayed_threshold 12, glass_gallery 8, legion_vanguard 4 |
| SB | 48% | -26 | 50% | 96% | 11.0 | 15.3 | Seren 63% | hollow_cantor 7, frayed_threshold 6, mirror_hall 3 |
| SC | 38% | -36 | 38% | 100% | 9.8 | 16.1 | Seren 61% | hollow_cantor 7, frayed_threshold 6, frayed_court 3 |
| OA | 58% | -16 | 62% | 94% | 11.8 | 27.4 | Oro 71% | frayed_threshold 7, vharun 5, glass_gallery 3 |
| OB | 32% | -42 | 40% | 80% | 11.2 | 17.0 | Oro 69% | the_unweaver 6, hollow_cantor 5, bellwarden 4 |
| OC | 44% | -30 | 44% | 100% | 10.9 | 18.8 | Oro 66% | frayed_threshold 8, frayed_court 4, glass_gallery 4 |
| R | 0% | -74 | 0% | - | 6.6 | 13.5 | Brann 94%, Seren 67% | vharun 20, shield_wall 5, glass_gallery 4 |
| SO | 0% | -74 | 0% | - | 3.5 | 6.4 | Seren 78%, Oro 69% | hollow_cantor 29, glass_gallery 5, muted_nave 5 |
| X | 0% | -74 | 0% | - | 5.2 | 9.6 | (no starter) | crimson_gate 11, vharun 10, hollow_cantor 7 |
| W | 2% | -72 | 2% | 100% | 6.6 | 12.1 | Seren 65%, Oro 65% | frayed_threshold 14, hollow_cantor 12, glass_gallery 6 |

W2b moved the Oro rows as diagnosis 6 expected: OA's whole run 32% → 58%, OC 40 → 44%, OB unchanged at 32%; their boss cells within noise. Oro's downs are still mostly blows aimed at another hero (33 of 36 in OA, 52 of 72 in OB, 52 of 73 in W), which is what change 1 is for.

### After the W9 prep changes (the tuning sets: cells 1000, runs 2000)


**Skilled win (the Novice's in brackets), gap to default in the same run (24 seeds)**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | 96% (62%) | 96% (50%) | 100% (38%) | 96% (25%) |
| SA | 96% (38%) +0 | 88% (54%) -8 | 100% (0%) +0 | 100% (12%) +4 |
| SB | 100% (79%) +4 | 100% (71%) +4 | 100% (12%) +0 | 100% (21%) +4 |
| SC | 75% (25%) -21 ⚠ | 100% (42%) +4 | 100% (17%) +0 | 100% (4%) +4 |
| OA | 96% (38%) +0 | 96% (46%) +0 | 100% (0%) +0 | 100% (12%) +4 |
| OB | 83% (21%) -12 | 100% (21%) +4 | 100% (0%) +0 | 96% (8%) +0 |
| OC | 83% (8%) -12 | 100% (71%) +4 | 100% (0%) +0 | 100% (4%) +4 |
| R | 96% (0%) +0 | 46% (12%) -50 ⚠ | 79% (0%) -21 ⚠ | 96% (0%) +0 |
| SO | 12% (0%) -83 ⚠ | 0% (4%) -96 ⚠ | 4% (0%) -96 ⚠ | 71% (0%) -25 ⚠ |
| X | 88% (29%) -8 | 71% (42%) -25 ⚠ | 100% (0%) +0 | 100% (0%) +4 |
| W | 96% (29%) +0 | 96% (58%) +0 | 100% (0%) +0 | 96% (29%) +0 |

Idle, best win over these cells: default 0%, SA 0%, SB 0%, SC 0%, OA 0%, OB 0%, OC 0%, R 0%, SO 0%, X 0%, W 0%

**Skilled length (s) and downs a fight, gap to default**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | 146 s · 1.58 | 200 s · 1.08 | 188 s · 0.38 | 174 s · 0.17 |
| SA | 193 s (+32%) · 3.38 | 358 s (+79%) · 2.92 | 341 s (+82%) · 0.75 | 229 s (+32%) · 0.42 |
| SB | 126 s (-14%) · 0.54 | 201 s (+0%) · 3.79 | 204 s (+8%) · 1.29 | 163 s (-6%) · 0.12 |
| SC | 171 s (+17%) · 4.88 | 238 s (+19%) · 0.92 | 225 s (+20%) · 0.58 | 210 s (+21%) · 0.17 |
| OA | 218 s (+49%) · 2.29 | 351 s (+75%) · 3.12 | 368 s (+96%) · 0.88 | 241 s (+38%) · 0.58 |
| OB | 156 s (+7%) · 1.46 | 213 s (+6%) · 2.46 | 196 s (+4%) · 1.33 | 162 s (-7%) · 0.62 |
| OC | 171 s (+17%) · 2.75 | 240 s (+20%) · 0.62 | 223 s (+19%) · 0.04 | 209 s (+20%) · 0.21 |
| R | 197 s (+35%) · 5.71 | 434 s (+117%) · 7.67 | 464 s (+147%) · 4.17 | 344 s (+98%) · 0.79 |
| SO | 147 s (+0%) · 6.75 | 464 s (+132%) · 7.79 | 528 s (+181%) · 6.38 | 421 s (+142%) · 2.50 |
| X | 206 s (+41%) · 3.17 | 412 s (+106%) · 4.79 | 476 s (+153%) · 3.92 | 270 s (+55%) · 0.67 |
| W | 205 s (+40%) · 1.17 | 309 s (+54%) · 3.83 | 356 s (+89%) · 1.50 | 225 s (+29%) · 0.29 |

**Who the boss (or miniboss) targets, Skilled, share of its time**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | kael 82 lyra 17 vexis 0 | lyra 87 kael 12 vexis 0 | lyra 57 kael 43 | kael 64 lyra 23 vexis 13 |
| SA | kael 92 vexis 7 seren 0 | vexis 76 kael 23 seren 1 | kael 60 vexis 40 | vexis 53 kael 46 seren 0 |
| SB | seren 97 lyra 2 vexis 0 | seren 84 lyra 14 vexis 1 | seren 96 lyra 3 vexis 0 | seren 98 lyra 1 vexis 0 |
| SC | kael 67 lyra 32 seren 1 | lyra 91 kael 9 seren 0 | lyra 66 kael 33 seren 0 | kael 66 lyra 34 |
| OA | kael 96 vexis 3 oro 0 | kael 64 vexis 35 oro 0 | kael 62 vexis 38 | vexis 58 kael 42 oro 0 |
| OB | lyra 98 vexis 1 oro 0 | lyra 89 vexis 10 oro 0 | lyra 98 vexis 1 oro 0 | lyra 94 vexis 5 oro 0 |
| OC | kael 89 lyra 10 oro 1 | lyra 83 kael 17 oro 0 | lyra 70 kael 30 | kael 53 lyra 46 |
| R | kael 84 brann 11 seren 2 | kael 76 brann 19 seren 4 | kael 96 brann 2 seren 1 | kael 81 brann 17 seren 0 |
| SO | kael 74 seren 14 oro 12 | kael 92 seren 6 oro 2 | kael 95 seren 3 oro 2 | kael 97 seren 3 oro 0 |
| X | seren 96 brann 3 oro 1 | seren 90 brann 6 oro 4 | seren 98 brann 1 oro 1 | seren 99 brann 0 oro 0 |
| W | seren 98 vexis 2 oro 0 | seren 94 vexis 5 oro 0 | seren 100 vexis 0 | seren 97 vexis 3 |

**Per-down table, Skilled, these cells pooled (read it first)**

| Party | downs a fight | aimed at the victim | at another hero | at no one | basic | tick | beyond 14 m | Seren parry armed | summon near | top blows |
|---|---|---|---|---|---|---|---|---|---|---|
| default | 0.80 | 38 | 21 | 12 | 6 | 0 | 0 | - | 0 | cantor_toll 24, vharun_twin_cleave 15, cantor_requiem 10 |
| SA | 1.86 | 100 | 24 | 40 | 15 | 0 | 6 | 0/26 | 0 | cantor_requiem 38, cantor_toll 37, vharun_twin_cleave_second 35 |
| SB | 1.44 | 44 | 76 | 0 | 18 | 0 | 2 | 0/40 | 0 | vharun_twin_cleave 46, vharun_twin_cleave_second 32, champion_cleave 19 |
| SC | 1.64 | 93 | 17 | 31 | 16 | 0 | 2 | 0/26 | 0 | cantor_toll 75, cantor_requiem 31, vharun_twin_cleave_second 17 |
| OA | 1.72 | 86 | 45 | 28 | 6 | 0 | 1 | - | 76 | vharun_twin_cleave_second 38, cantor_toll 30, cantor_requiem 22 |
| OB | 1.47 | 43 | 61 | 17 | 20 | 0 | 2 | - | 38 | vharun_twin_cleave 30, vharun_twin_cleave_second 25, basic 20 |
| OC | 0.91 | 45 | 6 | 19 | 17 | 0 | 3 | - | 30 | cantor_toll 33, cantor_requiem 18, basic 17 |
| R | 4.58 | 220 | 83 | 68 | 67 | 2 | 13 | 1/71 | 0 | vharun_twin_cleave_second 90, basic 67, cantor_requiem 63 |
| SO | 5.85 | 266 | 106 | 30 | 160 | 0 | 13 | 1/163 | 230 | basic 160, cantor_toll 63, vharun_twin_cleave_second 57 |
| X | 3.14 | 160 | 52 | 37 | 50 | 2 | 10 | 1/127 | 145 | champion_cleave 55, basic 50, vharun_twin_cleave_second 48 |
| W | 1.70 | 62 | 78 | 7 | 16 | 0 | 2 | 0/64 | 74 | vharun_twin_cleave 38, vharun_twin_cleave_second 36, champion_cleave 23 |

**Seren's and Oro's own downs, Skilled, these cells pooled, with the recap fields**

| Party | hero | downs | aimed at them | at another | basic | recap: warded / parryable / far / overextended (Seren); melee / felled outside / thread cut (Oro) | source ≤2 m / 2-6 m / >6 m |
|---|---|---|---|---|---|---|---|
| SA | seren | 26 (0.27 a fight) | 3 | 7 | 1 | 0 / 1 / 0 / 0 | 23 / 2 / 1 |
| SB | seren | 40 (0.42 a fight) | 25 | 2 | 13 | 0 / 37 / 0 / 3 | 20 / 19 / 1 |
| SC | seren | 26 (0.27 a fight) | 1 | 11 | 6 | 0 / 6 / 0 / 3 | 16 / 8 / 2 |
| OA | oro | 20 (0.21 a fight) | 4 | 14 | 0 | 3 / 0 / 0 | 3 / 14 / 3 |
| OB | oro | 28 (0.29 a fight) | 4 | 19 | 0 | 0 / 7 / 0 | 3 / 17 / 8 |
| OC | oro | 10 (0.10 a fight) | 1 | 3 | 4 | 4 / 4 / 0 | 5 / 3 / 2 |
| R | seren | 71 (0.74 a fight) | 11 | 40 | 10 | 1 / 17 / 1 / 5 | 36 / 32 / 3 |
| SO | seren | 163 (1.70 a fight) | 28 | 55 | 73 | 1 / 81 / 1 / 54 | 110 / 41 / 12 |
| SO | oro | 79 (0.82 a fight) | 20 | 36 | 17 | 14 / 22 / 0 | 24 / 20 / 35 |
| X | seren | 127 (1.32 a fight) | 75 | 4 | 39 | 0 / 105 / 1 / 27 | 94 / 30 / 3 |
| X | oro | 28 (0.29 a fight) | 6 | 17 | 1 | 2 / 1 / 0 | 7 / 9 / 12 |
| W | seren | 64 (0.67 a fight) | 46 | 4 | 11 | 0 / 55 / 0 / 8 | 46 / 17 / 1 |
| W | oro | 21 (0.22 a fight) | 0 | 19 | 1 | 1 / 0 / 0 | 6 / 12 / 3 |

**Downs a fight by hero, Skilled, pooled**

| Party | kael | lyra | vexis | brann | seren | oro |
|---|---|---|---|---|---|---|
| default | 0.36 | 0.21 | 0.23 |  |  |  |
| SA | 0.81 |  | 0.78 |  | 0.27 |  |
| SB |  | 0.44 | 0.58 |  | 0.42 |  |
| SC | 1.02 | 0.34 |  |  | 0.27 |  |
| OA | 0.77 |  | 0.74 |  |  | 0.21 |
| OB |  | 0.55 | 0.62 |  |  | 0.29 |
| OC | 0.55 | 0.25 |  |  |  | 0.10 |
| R | 2.30 |  |  | 1.54 | 0.74 |  |
| SO | 3.33 |  |  |  | 1.70 | 0.82 |
| X |  |  |  | 1.52 | 1.32 | 0.29 |
| W |  |  | 0.81 |  | 0.67 | 0.22 |

**Weaver safety and the Thread, Skilled, a fight (vs default)**

| Party | Weaver damage taken | Weaver downs | Thread cuts (all cells) |
|---|---|---|---|
| default | 517 | 1.04 | 0.16 |
| SA | 1018 | 2.20 | 0.45 |
| SB | 549 | 1.23 | 0.26 |
| SC | 969 | 2.09 | 0.18 |
| OA | 987 | 2.14 | 1.04 |
| OB | 650 | 1.45 | 0.30 |
| OC | 698 | 1.58 | 0.28 |
| R | 1548 | 3.25 | 1.39 |
| SO | 2161 | 5.06 | 0.52 |
| X | 1348 | 2.74 | 0.53 |
| W | 823 | 1.92 | 0.53 |

**Seren, Skilled, pooled**

| Party | parries | Wards on her | parried | kill shots | lost | Wards' share of her damage | overextended | answered ≤3 s | beyond 14 m | Showboat pick | Lunge interrupts | downs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SA | 0.3 | 4.5 | 7% | 0.67 | 0.00 | 1% | 0.4 | 79% | 0% | 91% | 3.0 | 0.27 |
| SB | 8.3 | 14.1 | 59% | 1.25 | 0.75 | 13% | 2.8 | 87% | 0% | 96% | 1.8 | 0.42 |
| SC | 0.3 | 3.3 | 8% | 0.25 | 0.00 | 1% | 0.8 | 83% | 0% | 88% | 2.6 | 0.27 |
| R | 0.7 | 7.7 | 9% | 0.81 | 0.00 | 2% | 1.3 | 60% | 0% | 89% | 4.2 | 0.74 |
| SO | 1.6 | 9.8 | 16% | 0.81 | 0.01 | 2% | 3.2 | 66% | 0% | 100% | 6.1 | 1.70 |
| X | 15.4 | 26.6 | 58% | 3.23 | 0.74 | 13% | 4.7 | 84% | 0% | 100% | 4.1 | 1.32 |
| W | 12.4 | 21.7 | 57% | 2.73 | 0.71 | 12% | 4.4 | 81% | 0% | 100% | 3.3 | 0.67 |

**Oro, Skilled (the Novice's in-field share beside it), pooled**

| Party | Saplings in your field | Novice | both standing | felled | tending | Rootbond | Ancients | downs |
|---|---|---|---|---|---|---|---|---|
| OA | 93% | 85% | 100% | 0.1 | 1% | 441 | 4.3 | 0.21 |
| OB | 60% | 71% | 99% | 0.4 | 2% | 697 | 2.8 | 0.29 |
| OC | 92% | 85% | 98% | 0.7 | 2% | 543 | 3.2 | 0.10 |
| SO | 91% | 85% | 98% | 1.4 | 1% | 433 | 6.4 | 0.82 |
| X | 93% | 87% | 100% | 0.2 | 1% | 633 | 5.9 | 0.29 |
| W | 94% | 86% | 99% | 0.3 | 1% | 775 | 4.3 | 0.22 |

Boss seconds on a summon, every cell: 0.0 (expected 0).

**Whole runs (Skilled, 50 Finale-route runs from 2000)**

| Party | Won | Gap | Reached the Finale | Won of those | Fights | Minutes | Bond XP a fight vs the starters' average | Lost most at |
|---|---|---|---|---|---|---|---|---|
| default | 74% |  | 80% | 92% | 13.2 | 19.6 | - | blood_forge 3, the_silent_conductor 3, frayed_threshold 2 |
| SA | 30% | -44 | 30% | 100% | 8.9 | 17.9 | Seren 64% | frayed_threshold 10, glass_gallery 8, legion_vanguard 3 |
| SB | 50% | -24 | 54% | 93% | 12.2 | 16.8 | Seren 72% | frayed_threshold 9, frayed_court 3, blood_rites 2 |
| SC | 40% | -34 | 40% | 100% | 10.2 | 16.8 | Seren 60% | hollow_cantor 8, frayed_court 5, frayed_threshold 5 |
| OA | 40% | -34 | 42% | 95% | 11.0 | 24.7 | Oro 70% | frayed_threshold 8, vharun 7, muted_nave 4 |
| OB | 48% | -26 | 48% | 100% | 10.8 | 16.5 | Oro 67% | hollow_cantor 7, bellwarden 5, frayed_threshold 5 |
| OC | 64% | -10 | 66% | 97% | 12.1 | 21.2 | Oro 64% | frayed_threshold 5, glass_gallery 4, hollow_cantor 4 |
| R | 2% | -72 | 2% | 100% | 6.6 | 13.7 | Brann 94%, Seren 67% | vharun 23, shield_wall 7, glass_gallery 4 |
| SO | 0% | -74 | 0% | - | 3.2 | 5.5 | Seren 77%, Oro 69% | hollow_cantor 21, glass_gallery 9, muted_nave 6 |
| X | 2% | -72 | 2% | 100% | 6.1 | 12.0 | (no starter) | crimson_gate 14, frayed_threshold 8, vharun 7 |
| W | 24% | -50 | 28% | 86% | 9.2 | 18.5 | Seren 74%, Oro 64% | frayed_threshold 8, vharun 5, muted_nave 4 |

**Reading it.**
- **Bosses:** every full-protocol party is now inside its boss band at every boss but one cell: SC at the Cantor (75%, −21; the Cantor Toll is 75 of SC's downs). SB is +0 to +4 at all four bosses (it was −42 at the Cantor). OB is −12 / +4 / +0 / +0 against its provisional −25. Of the reduced parties, W is +0 / +0 / +0 / +0 and X −8 / −25 / +0 / +4; R (Vharun −50, the Unweaver −21) and SO (−83, −96, −96, −25) are unchanged by this prep (Kael parties without Oro, or a damage problem: SO times out at Vharun and the Unweaver).
- **Downs:** Oro's own downs fall by half or more (OA 0.38 → 0.21 a fight, OB 0.75 → 0.29, OC 0.25 → 0.10, SO 0.98 → 0.82, X 0.74 → 0.38, W 0.76 → 0.22), and blows aimed at another hero are no longer most of them in OC (3 of 10). In SB, W and X the party's downs fall (1.77 → 1.44, 3.44 → 1.85, 7.50 → 3.22); Seren's rise as she takes the boss (SB 0.35 → 0.42, W 0.62 → 0.90), and only 2 of her 257 downs over SB, W and X came with her parry armed.
- **Weaver safety** improves in SB (725 → 549 damage taken, 1.79 → 1.23 downs), OB (746 → 650, 1.75 → 1.45) and W (1,216 → 858, 2.99 → 2.07), and still misses its band (≤ default + 15%: 595; downs ≤ 1.09) everywhere but SB's damage.
- **The cost:** in OB, with the boss on Lyra, `oroRally` now waits, and the Saplings stand in your field 60% of their time (89% before; band ≥ 60%, at the edge on both sets). It is OB's trade: the Rally walked Lyra and the boss through the grove.
- **Whole runs** (±7 a row): SA 18 → 30%, SB 48 → 50%, SC 38 → 40%, OB 32 → 48%, OC 44 → 64%, W 2 → 24%; OA 58 → 40% (its only change is the sidestep; on the untuned third set the same comparison is 48% → 46%, so most of it is noise). Every party still misses its whole-run band, and the losses are on the road: Frayed Threshold is the top loss in five of the ten and in the top three of eight.

### The road: skirmish, elite and miniboss cells (full protocol, 24 seeds from 1000)

Every skirmish, elite and miniboss each Movement's road uses (Movement I bare, II the arrival kit, III ARRIVAL3_KIT), Skilled and Novice, on the final tree.


**Movement I** (Skilled win, the Novice's in brackets, Skilled gap to default; ⚠ past the band: −5, OB −10)

| Party | First Light | Tolling Halls | Glass Gallery | Choir Loft | Mourning Steps | Muted Nave | Shattered Choir | Bellwarden (mini) |
|---|---|---|---|---|---|---|---|---|
| default | 100% (100%) | 100% (83%) | 88% (92%) | 100% (100%) | 100% (100%) | 100% (62%) | 96% (75%) | 100% (67%) |
| SA | 100% (83%) +0 | 88% (42%) -12 ⚠ | 71% (21%) -17 ⚠ | 100% (67%) +0 | 96% (67%) -4 | 79% (38%) -21 ⚠ | 96% (67%) +0 | 100% (38%) +0 |
| SB | 100% (100%) +0 | 100% (100%) +0 | 92% (79%) +4 | 100% (100%) +0 | 100% (100%) +0 | 100% (96%) +0 | 100% (100%) +4 | 100% (96%) +0 |
| SC | 100% (100%) +0 | 100% (88%) +0 | 75% (50%) -12 ⚠ | 100% (92%) +0 | 100% (92%) +0 | 96% (50%) -4 | 96% (54%) +0 | 100% (75%) +0 |
| OA | 100% (83%) +0 | 100% (79%) +0 | 79% (29%) -8 ⚠ | 100% (96%) +0 | 100% (79%) +0 | 83% (75%) -17 ⚠ | 100% (75%) +4 | 96% (42%) -4 |
| OB | 100% (100%) +0 | 100% (100%) +0 | 100% (71%) +12 | 100% (100%) +0 | 100% (100%) +0 | 100% (100%) +0 | 100% (92%) +4 | 88% (12%) -12 ⚠ |
| OC | 100% (100%) +0 | 100% (92%) +0 | 75% (46%) -12 ⚠ | 100% (100%) +0 | 100% (92%) +0 | 100% (92%) +0 | 100% (79%) +4 | 100% (71%) +0 |

**Movement II** (Skilled win, the Novice's in brackets, Skilled gap to default; ⚠ past the band: −5, OB −10)

| Party | Crimson Gate | Blood Rites | Pike Line | Red Muster | Leech Warren | Shield Wall | Blood Forge | Matriarch (mini) |
|---|---|---|---|---|---|---|---|---|
| default | 100% (100%) | 100% (100%) | 100% (100%) | 100% (100%) | 100% (96%) | 96% (71%) | 92% (67%) | 100% (75%) |
| SA | 88% (62%) -12 ⚠ | 88% (96%) -12 ⚠ | 100% (96%) +0 | 100% (100%) +0 | 100% (96%) +0 | 67% (25%) -29 ⚠ | 71% (12%) -21 ⚠ | 100% (8%) +0 |
| SB | 100% (75%) +0 | 100% (100%) +0 | 100% (100%) +0 | 100% (100%) +0 | 100% (96%) +0 | 100% (54%) +4 | 71% (42%) -21 ⚠ | 100% (21%) +0 |
| SC | 96% (88%) -4 | 100% (100%) +0 | 100% (100%) +0 | 100% (100%) +0 | 100% (92%) +0 | 100% (17%) +4 | 88% (21%) -4 | 96% (17%) -4 |
| OA | 100% (96%) +0 | 96% (100%) -4 | 100% (100%) +0 | 100% (100%) +0 | 100% (96%) +0 | 96% (67%) +0 | 88% (83%) -4 | 100% (42%) +0 |
| OB | 100% (100%) +0 | 100% (100%) +0 | 100% (100%) +0 | 96% (100%) -4 | 100% (88%) +0 | 92% (71%) -4 | 83% (58%) -8 | 92% (21%) -8 |
| OC | 100% (100%) +0 | 100% (100%) +0 | 100% (100%) +0 | 100% (100%) +0 | 100% (100%) +0 | 96% (62%) +0 | 100% (79%) +8 | 100% (12%) +0 |

**Movement III** (Skilled win, the Novice's in brackets, Skilled gap to default; ⚠ past the band: −5, OB −10)

| Party | Frayed Threshold | Maw Hollow | Wraith Vigil | Null Chapel | Mirror Hall | Frayed Court | Seamstress (mini) |
|---|---|---|---|---|---|---|---|
| default | 96% (79%) | 100% (75%) | 96% (54%) | 100% (100%) | 100% (96%) | 96% (38%) | 92% (29%) |
| SA | 58% (17%) -38 ⚠ | 92% (42%) -8 ⚠ | 83% (33%) -12 ⚠ | 88% (83%) -12 ⚠ | 96% (96%) -4 | 58% (25%) -38 ⚠ | 100% (83%) +8 |
| SB | 75% (33%) -21 ⚠ | 100% (83%) +0 | 100% (96%) +4 | 88% (92%) -12 ⚠ | 100% (100%) +0 | 50% (21%) -46 ⚠ | 92% (4%) +0 |
| SC | 83% (12%) -12 ⚠ | 92% (42%) -8 ⚠ | 88% (50%) -8 ⚠ | 100% (83%) +0 | 96% (83%) -4 | 79% (42%) -17 ⚠ | 100% (92%) +8 |
| OA | 92% (54%) -4 | 96% (88%) -4 | 71% (92%) -25 ⚠ | 92% (96%) -8 ⚠ | 88% (100%) -12 ⚠ | 75% (62%) -21 ⚠ | 96% (17%) +4 |
| OB | 79% (58%) -17 ⚠ | 96% (92%) -4 | 88% (96%) -8 | 92% (88%) -8 | 92% (92%) -8 | 67% (62%) -29 ⚠ | 96% (4%) +4 |
| OC | 83% (38%) -12 ⚠ | 100% (83%) +0 | 96% (58%) +0 | 100% (79%) +0 | 92% (79%) -8 ⚠ | 71% (25%) -25 ⚠ | 100% (29%) +8 |

**The road pooled** (Skilled, every skirmish, elite and miniboss cell above)

| Party | mean win | gap | cells past the band | downs a fight | Seren parried / Wards on her / her downs | Saplings in your field / felled / Oro downs | Oro down recaps: melee / felled outside / thread cut |
|---|---|---|---|---|---|---|---|
| default | 98% |  |  | 0.24 | - | - | - |
| SA | 88% | -10 | 12 of 23 | 0.74 | 48% / 1.7 / 0.15 | - | - |
| SB | 94% | -4 | 4 of 23 | 0.43 | 61% / 2.2 / 0.10 | - | - |
| SC | 95% | -3 | 5 of 23 | 0.41 | 55% / 1.6 / 0.10 | - | - |
| OA | 93% | -5 | 6 of 23 | 0.65 | - | 91% / 0.74 / 0.12 | 24 / 30 / 0 of 64 |
| OB | 94% | -4 | 3 of 23 | 0.70 | - | 85% / 0.73 / 0.17 | 23 / 24 / 0 of 92 |
| OC | 96% | -2 | 4 of 23 | 0.34 | - | 92% / 0.54 / 0.07 | 15 / 19 / 0 of 39 |

**Reading it.** The road is where the runs go: SA misses its band (−5) in 12 of 23 cells, worst at Frayed Threshold (−38), the Frayed Court (−38), Shield Wall (−29), Muted Nave and Blood Forge (−21). Every full-protocol party is −17 to −46 at the **Frayed Court** and −4 to −38 at **Frayed Threshold**, and SA and SB are −21 at Blood Forge. These are the cells W9's tuning starts from.

**Oro's sidestep on the road** (the same cells on 65f8748 and on the final tree; Skilled, 24 seeds; win · downs · Oro's downs): the road changes within noise, and Oro's downs fall where they were high.


| Party | Cell | 65f8748 | final | change |
|---|---|---|---|---|
| OA | glass_gallery | 79% · 1.96 · 0.46 | 79% · 2.00 · 0.46 | +0 · +0.04 · +0.00 |
| OA | muted_nave | 92% · 1.58 · 0.33 | 83% · 2.46 · 0.33 | -8 · +0.88 · +0.00 |
| OA | shattered_choir | 92% · 0.88 · 0.21 | 100% · 1.25 · 0.21 | +8 · +0.38 · +0.00 |
| OA | bellwarden | 96% · 0.62 · 0.21 | 96% · 0.88 · 0.25 | +0 · +0.25 · +0.04 |
| OB | glass_gallery | 100% · 0.12 · 0.00 | 100% · 0.38 · 0.08 | +0 · +0.25 · +0.08 |
| OB | muted_nave | 100% · 0.67 · 0.12 | 100% · 0.88 · 0.12 | +0 · +0.21 · +0.00 |
| OB | shattered_choir | 96% · 0.25 · 0.08 | 100% · 0.58 · 0.08 | +4 · +0.33 · +0.00 |
| OB | bellwarden | 96% · 1.46 · 0.46 | 88% · 1.42 · 0.50 | -8 · -0.04 · +0.04 |
| OC | glass_gallery | 58% · 2.58 · 0.67 | 75% · 2.21 · 0.54 | +17 · -0.38 · -0.12 |
| OC | muted_nave | 96% · 0.88 · 0.12 | 100% · 0.25 · 0.00 | +4 · -0.62 · -0.12 |
| OC | shattered_choir | 96% · 0.58 · 0.17 | 100% · 0.42 · 0.00 | +4 · -0.17 · -0.17 |
| OC | bellwarden | 96% · 0.71 · 0.29 | 100% · 0.33 · 0.08 | +4 · -0.38 · -0.21 |
| OA | frayed_threshold | 75% · 1.00 · 0.25 | 92% · 0.58 · 0.08 | +17 · -0.42 · -0.17 |
| OA | null_chapel | 92% · 0.79 · 0.08 | 92% · 0.79 · 0.08 | +0 · +0.00 · +0.00 |
| OA | frayed_court | 75% · 0.83 · 0.25 | 75% · 1.17 · 0.25 | +0 · +0.33 · +0.00 |
| OA | the_seamstress | 100% · 2.29 · 0.96 | 96% · 0.96 · 0.25 | -4 · -1.33 · -0.71 |
| OB | frayed_threshold | 88% · 0.83 · 0.12 | 79% · 0.96 · 0.21 | -8 · +0.12 · +0.08 |
| OB | null_chapel | 100% · 0.08 · 0.00 | 92% · 0.42 · 0.08 | -8 · +0.33 · +0.08 |
| OB | frayed_court | 67% · 1.29 · 0.33 | 67% · 1.33 · 0.33 | +0 · +0.04 · +0.00 |
| OB | the_seamstress | 92% · 7.88 · 2.88 | 96% · 6.29 · 1.79 | +4 · -1.58 · -1.08 |
| OC | frayed_threshold | 88% · 0.75 · 0.12 | 83% · 1.00 · 0.21 | -4 · +0.25 · +0.08 |
| OC | null_chapel | 100% · 0.12 · 0.00 | 100% · 0.17 · 0.00 | +0 · +0.04 · +0.00 |
| OC | frayed_court | 88% · 0.92 · 0.12 | 71% · 1.21 · 0.29 | -17 · +0.29 · +0.17 |
| OC | the_seamstress | 100% · 0.92 · 0.46 | 100% · 0.54 · 0.33 | +0 · -0.38 · -0.12 |


### Confirmed on the untuned third sets (cells 777001, runs 333003)

Nothing was tuned on these sets.


**Skilled win (the Novice's in brackets), gap to default in the same run (24 seeds)**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | 88% (75%) | 92% (50%) | 96% (62%) | 100% (25%) |
| SA | 92% (21%) +4 | 83% (54%) -8 | 100% (0%) +4 | 100% (17%) +0 |
| SB | 100% (83%) +12 | 96% (79%) +4 | 96% (12%) +0 | 96% (29%) -4 |
| SC | 75% (21%) -12 | 100% (54%) +8 | 100% (4%) +4 | 100% (8%) +0 |
| OA | 96% (58%) +8 | 96% (46%) +4 | 100% (0%) +4 | 100% (4%) +0 |
| OB | 96% (42%) +8 | 100% (8%) +8 | 100% (0%) +4 | 88% (25%) -12 |
| OC | 92% (25%) +4 | 96% (54%) +4 | 100% (0%) +4 | 100% (8%) +0 |
| R | 88% (0%) +0 | 29% (17%) -62 ⚠ | 100% (0%) +4 | 88% (4%) -12 |
| SO | 12% (0%) -75 ⚠ | 0% (8%) -92 ⚠ | 0% (0%) -96 ⚠ | 83% (0%) -17 ⚠ |
| X | 92% (12%) +4 | 88% (33%) -4 | 83% (0%) -12 | 96% (8%) -4 |
| W | 96% (25%) +8 | 92% (50%) +0 | 100% (0%) +4 | 100% (8%) +0 |

Idle, best win over these cells: default 0%, SA 0%, SB 0%, SC 0%, OA 0%, OB 0%, OC 0%, R 0%, SO 0%, X 0%, W 0%

**Who the boss (or miniboss) targets, Skilled, share of its time**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | kael 81 lyra 18 vexis 1 | lyra 85 kael 13 vexis 1 | lyra 59 kael 41 | kael 62 lyra 27 vexis 11 |
| SA | kael 90 vexis 9 seren 0 | vexis 75 kael 24 seren 0 | kael 60 vexis 39 seren 0 | vexis 50 kael 50 |
| SB | seren 97 lyra 2 vexis 0 | seren 88 lyra 11 vexis 0 | seren 96 lyra 3 vexis 0 | seren 98 lyra 1 vexis 0 |
| SC | kael 72 lyra 27 seren 1 | lyra 92 kael 8 seren 0 | lyra 66 kael 33 seren 0 | kael 62 lyra 37 |
| OA | kael 96 vexis 3 oro 1 | kael 58 vexis 41 oro 0 | kael 55 vexis 45 oro 0 | vexis 57 kael 43 oro 0 |
| OB | lyra 98 vexis 1 oro 0 | lyra 97 vexis 3 | lyra 99 vexis 1 oro 0 | lyra 96 vexis 3 oro 0 |
| OC | kael 91 lyra 8 oro 0 | lyra 77 kael 22 oro 1 | lyra 70 kael 29 | kael 52 lyra 48 |
| R | kael 83 brann 12 seren 2 | kael 69 brann 23 seren 6 | kael 96 brann 2 seren 0 | kael 84 brann 14 seren 0 |
| SO | kael 76 seren 15 oro 9 | kael 95 seren 3 oro 1 | kael 95 seren 3 oro 2 | kael 97 seren 3 oro 0 |
| X | seren 98 brann 1 oro 0 | seren 93 brann 3 oro 3 | seren 97 brann 1 oro 1 | seren 100 brann 0 |
| W | seren 98 vexis 2 oro 0 | seren 94 vexis 3 oro 2 | seren 100 vexis 0 oro 0 | seren 96 vexis 3 oro 0 |

**Seren, Skilled, pooled**

| Party | parries | Wards on her | parried | kill shots | lost | Wards' share of her damage | overextended | answered ≤3 s | beyond 14 m | Showboat pick | Lunge interrupts | downs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SA | 0.3 | 3.9 | 7% | 0.40 | 0.00 | 1% | 0.3 | 75% | 0% | 91% | 2.9 | 0.29 |
| SB | 8.3 | 14.0 | 59% | 1.53 | 0.72 | 13% | 2.9 | 86% | 0% | 96% | 1.7 | 0.31 |
| SC | 0.3 | 3.1 | 9% | 0.21 | 0.00 | 1% | 0.6 | 80% | 0% | 89% | 2.5 | 0.27 |
| R | 0.8 | 7.7 | 10% | 0.92 | 0.00 | 2% | 1.2 | 70% | 0% | 88% | 4.0 | 0.71 |
| SO | 1.4 | 10.3 | 14% | 0.85 | 0.02 | 1% | 3.4 | 64% | 0% | 100% | 6.2 | 1.47 |
| X | 15.5 | 26.5 | 59% | 3.16 | 0.72 | 13% | 4.5 | 87% | 0% | 100% | 3.7 | 0.99 |
| W | 11.9 | 22.0 | 54% | 2.90 | 0.72 | 12% | 4.4 | 78% | 0% | 100% | 3.4 | 0.67 |

**Oro, Skilled (the Novice's in-field share beside it), pooled**

| Party | Saplings in your field | Novice | both standing | felled | tending | Rootbond | Ancients | downs |
|---|---|---|---|---|---|---|---|---|
| OA | 93% | 85% | 100% | 0.2 | 1% | 410 | 4.4 | 0.19 |
| OB | 60% | 72% | 99% | 0.5 | 2% | 716 | 2.8 | 0.25 |
| OC | 92% | 86% | 99% | 0.4 | 2% | 580 | 3.2 | 0.14 |
| SO | 92% | 86% | 99% | 1.1 | 1% | 389 | 6.5 | 0.86 |
| X | 92% | 87% | 100% | 0.1 | 1% | 573 | 5.7 | 0.21 |
| W | 94% | 85% | 99% | 0.3 | 1% | 792 | 4.4 | 0.21 |

Boss seconds on a summon, every cell: 0.0 (expected 0).

**Whole runs (Skilled, 50 Finale-route runs from 333003)**

| Party | Won | Gap | Reached the Finale | Won of those | Fights | Minutes | Bond XP a fight vs the starters' average | Lost most at |
|---|---|---|---|---|---|---|---|---|
| default | 70% |  | 74% | 95% | 12.5 | 18.7 | - | blood_rites 2, frayed_threshold 2, gorehound_matriarch 2 |
| SA | 26% | -44 | 26% | 100% | 9.2 | 18.2 | Seren 65% | frayed_threshold 11, shield_wall 4, vharun 4 |
| SB | 62% | -8 | 66% | 94% | 12.5 | 17.8 | Seren 72% | frayed_threshold 4, frayed_court 3, the_silent_conductor 2 |
| SC | 48% | -22 | 52% | 92% | 11.1 | 18.9 | Seren 60% | frayed_threshold 10, hollow_cantor 7, muted_nave 2 |
| OA | 46% | -24 | 46% | 100% | 11.5 | 26.4 | Oro 70% | frayed_threshold 14, vharun 6, shield_wall 2 |
| OB | 46% | -24 | 50% | 92% | 10.4 | 16.0 | Oro 67% | bellwarden 8, hollow_cantor 6, frayed_threshold 3 |
| OC | 56% | -14 | 58% | 97% | 11.9 | 20.7 | Oro 64% | frayed_court 5, frayed_threshold 4, glass_gallery 3 |
| R | 0% | -70 | 0% | - | 6.9 | 14.9 | Brann 95%, Seren 68% | vharun 27, glass_gallery 5, muted_nave 5 |
| SO | 0% | -70 | 0% | - | 2.9 | 4.5 | Seren 77%, Oro 71% | hollow_cantor 20, glass_gallery 7, choir_loft 6 |
| X | 0% | -70 | 0% | - | 6.5 | 13.3 | (no starter) | vharun 12, frayed_threshold 10, crimson_gate 9 |
| W | 22% | -48 | 22% | 100% | 9.6 | 19.2 | Seren 73%, Oro 65% | frayed_threshold 15, crimson_gate 6, vharun 4 |


The same Oro parties and W on 65f8748, on 333003 (the before for the third set):

| Party | Won | Gap | Reached the Finale | Won of those | Fights | Minutes | Bond XP a fight vs the starters' average | Lost most at |
|---|---|---|---|---|---|---|---|---|
| default | 70% |  | 74% | 95% | 12.5 | 18.7 | - | blood_rites 2, frayed_threshold 2, gorehound_matriarch 2 |
| OA | 48% | -22 | 48% | 100% | 11.1 | 25.8 | Oro 71% | frayed_threshold 9, vharun 8, muted_nave 3 |
| OB | 38% | -32 | 42% | 90% | 10.8 | 16.6 | Oro 70% | frayed_threshold 8, bellwarden 7, the_seamstress 4 |
| OC | 68% | -2 | 68% | 100% | 12.5 | 22.6 | Oro 66% | frayed_threshold 4, frayed_court 3, glass_gallery 3 |
| W | 8% | -62 | 10% | 80% | 7.5 | 13.8 | Seren 61%, Oro 63% | hollow_cantor 11, frayed_threshold 9, glass_gallery 5 |


The third set agrees with the tuning sets: the boss cells hold (SB +12 / +4 / +0 / −4, OB +8 / +8 / +4 / −12, W +8 / +0 / +4 / +0), SB's whole run is 62% (−8, its band is −10: **met on this set**), OC's 56% (−14), and SC's Cantor cell is −12. On this set OB's run moves 38 → 46% and W's 8 → 22%, OA's 48 → 46% and OC's 68 → 56%.

### The `verbs.ts` ablation round (Skilled, 24 seeds from 1000)

Each cell: the rule left off, as change in win · downs a fight · length against every rule on (the first column); ‘—’: the rule never acts there. Run on the tree with changes 1 and 2, before the bot fixes (3, 4). `serenNoSwap` acts only with the Swap Reel variant and `discordBreaker` only against discord shields with no Lyra; neither acted in these cells (`discordBreaker` ‘—’ everywhere, so it is left out of the tables).

**Seren's rules** (SA, SB, SC):


| Party | Cell | every rule: win · downs | −serenPerfectFirst | −serenParryWard | −serenReel | −serenCall | −serenCue |
|---|---|---|---|---|---|---|---|
| SA | hollow_cantor | 100% · 2.88 | — | — | +0 · -0.08 · -0 s | — | -8 · +0.50 · -5 s |
| SA | vharun | 88% · 2.96 | +8 · -0.21 · +8 s | +0 · -0.04 · -0 s | — | +0 · +0.08 · +5 s | +8 · -0.88 · -32 s |
| SA | the_unweaver | 100% · 0.75 | — | — | — | — | +0 · -0.25 · -10 s |
| SA | the_silent_conductor | 100% · 0.42 | +0 · -0.04 · -1 s | — | — | +0 · -0.17 · -3 s | -8 · +0.04 · -17 s |
| SA | frayed_threshold | 50% · 1.92 | +0 · +0.04 · +0 s | +13 · -0.46 · +1 s | +0 · +0.00 · +0 s | +0 · +0.00 · -0 s | — |
| SA | glass_gallery | 71% · 2.50 | +0 · -0.04 · -0 s | +4 · +0.00 · +1 s | +0 · +0.08 · +1 s | +0 · +0.04 · -0 s | — |
| SB | hollow_cantor | 100% · 0.33 | +0 · -0.04 · -1 s | — | +0 · +0.04 · -1 s | — | +0 · +0.42 · -0 s |
| SB | vharun | 100% · 5.17 | -17 · -1.04 · -19 s | -4 · -2.08 · -3 s | +0 · -0.08 · +0 s | +0 · -0.04 · -0 s | -4 · -0.63 · -1 s |
| SB | the_unweaver | 96% · 2.71 | +0 · +0.25 · -2 s | -4 · -1.25 · +6 s | — | — | +0 · -0.13 · -9 s |
| SB | the_silent_conductor | 83% · 1.13 | +8 · -0.13 · +7 s | +13 · -0.92 · +3 s | +4 · -0.21 · +1 s | +4 · -0.17 · +4 s | -4 · +0.88 · +1 s |
| SB | frayed_threshold | 75% · 1.13 | +0 · -0.04 · -0 s | +0 · -0.04 · -1 s | — | — | — |
| SB | mirror_hall | 96% · 0.29 | — | +4 · -0.25 · -0 s | — | +0 · +0.00 · +0 s | — |
| SC | hollow_cantor | 79% · 4.71 | — | — | +4 · -0.33 · -2 s | -4 · +0.13 · -1 s | -13 · +0.79 · -4 s |
| SC | vharun | 96% · 0.92 | +4 · +0.00 · +2 s | +4 · +0.00 · +3 s | — | -4 · -0.08 · -7 s | +4 · -0.29 · -12 s |
| SC | the_unweaver | 100% · 0.58 | — | — | — | — | -4 · +0.08 · -5 s |
| SC | the_silent_conductor | 100% · 0.17 | +0 · +0.00 · -2 s | — | — | +0 · +0.08 · -6 s | +0 · -0.13 · -6 s |
| SC | frayed_threshold | 79% · 1.21 | +0 · +0.00 · -0 s | +0 · +0.21 · +1 s | +4 · -0.08 · +1 s | +0 · +0.00 · +0 s | — |
| SC | frayed_court | 67% · 1.29 | — | +0 · +0.13 · +1 s | +0 · -0.08 · -0 s | +0 · +0.04 · +0 s | — |


**Oro's rules** (OA, OB, OC; OC's Unweaver and Conductor rows were already played with the first `oroRally` guard, below):


| Party | Cell | every rule: win · downs | −oroFocus | −oroRally | −oroThread | −groveCover | −oroCue |
|---|---|---|---|---|---|---|---|
| OA | hollow_cantor | 92% · 2.58 | +8 · +0.17 · +61 s | +0 · +1.25 · +2 s | +8 · +0.00 · +5 s | +4 · +0.88 · +5 s | +4 · +0.00 · +6 s |
| OA | vharun | 96% · 2.71 | -13 · +0.13 · +38 s | +0 · +0.29 · -3 s | — | -13 · +0.00 · -5 s | +0 · +0.04 · -4 s |
| OA | the_unweaver | 100% · 1.42 | +0 · -0.46 · +17 s | +0 · -0.29 · -4 s | — | -8 · +0.46 · +14 s | +0 · -0.04 · -7 s |
| OA | the_silent_conductor | 96% · 0.54 | +4 · +0.04 · +18 s | +4 · +0.17 · +8 s | +0 · +0.21 · -1 s | +4 · +0.92 · +2 s | +0 · +0.29 · -8 s |
| OA | frayed_threshold | 92% · 0.58 | +0 · +0.08 · +4 s | -4 · +0.08 · -2 s | -4 · +0.04 · +1 s | -4 · +0.13 · +0 s | — |
| OA | glass_gallery | 79% · 2.50 | -8 · +0.33 · +3 s | +0 · +0.04 · +0 s | -4 · +0.00 · -2 s | +0 · -0.92 · -2 s | -4 · +0.08 · +0 s |
| OB | hollow_cantor | 96% · 0.79 | +4 · +0.50 · +26 s | -4 · +0.04 · +3 s | -8 · +0.25 · -8 s | -4 · +0.75 · -2 s | -4 · +0.29 · -0 s |
| OB | vharun | 96% · 2.33 | -4 · +0.00 · +12 s | +4 · +0.13 · +10 s | — | -4 · +0.33 · -6 s | +4 · +0.50 · +3 s |
| OB | the_unweaver | 79% · 3.42 | +8 · -0.79 · +16 s | +21 · -2.08 · -2 s | — | +4 · -0.04 · +33 s | +13 · +0.29 · +10 s |
| OB | the_silent_conductor | 88% · 1.21 | -21 · +0.79 · -1 s | +8 · -0.58 · +10 s | +4 · -0.29 · -6 s | -4 · -0.04 · -16 s | -8 · +0.75 · -8 s |
| OB | frayed_threshold | 88% · 0.75 | -4 · +0.13 · +1 s | -4 · -0.04 · +3 s | +8 · -0.38 · +2 s | -17 · +0.63 · +12 s | — |
| OB | bellwarden | 83% · 2.38 | +0 · -0.54 · +7 s | +17 · -1.75 · -1 s | — | +0 · +0.13 · -2 s | +8 · -0.13 · +0 s |
| OC | hollow_cantor | 96% · 2.88 | +4 · +0.75 · +29 s | -25 · +1.04 · -5 s | +4 · -0.17 · -1 s | -4 · +0.13 · +11 s | +0 · +0.33 · +2 s |
| OC | vharun | 100% · 0.25 | -8 · +0.92 · +31 s | +0 · +0.38 · +2 s | — | +0 · +0.38 · -7 s | -4 · +1.08 · +7 s |
| OC | the_unweaver | 88% · 0.92 | +8 · -0.13 · +17 s | +13 · -0.88 · -7 s | — | +8 · +0.00 · +22 s | +13 · -0.29 · -2 s |
| OC | the_silent_conductor | 100% · 0.54 | -4 · -0.04 · +116 s | +0 · -0.29 · -3 s | +0 · -0.21 · -14 s | -13 · +0.33 · -14 s | +0 · -0.12 · -4 s |
| OC | frayed_threshold | 88% · 0.96 | +0 · -0.08 · +18 s | -8 · +0.00 · -0 s | +8 · -0.33 · -2 s | +0 · -0.29 · +2 s | +0 · -0.04 · -1 s |
| OC | frayed_court | 67% · 1.25 | +0 · +0.00 · +3 s | -8 · +0.29 · -4 s | +4 · +0.00 · -3 s | -13 · +0.38 · -12 s | +0 · +0.00 · +2 s |


**The Novice's draws** (`NOVICE_ROSTER_RULES`, Novice, the four bosses):


| Party | Cell | every rule: win · downs | −serenWard |
|---|---|---|---|
| SA | hollow_cantor | 29% · 7.29 | +8 · +0.08 · +3 s |
| SA | vharun | 54% · 8.42 | -8 · -0.21 · -7 s |
| SA | the_unweaver | 0% · 7.08 | +0 · -0.79 · +1 s |
| SA | the_silent_conductor | 13% · 4.38 | +0 · +0.21 · -6 s |
| SB | hollow_cantor | 100% · 1.67 | -8 · -0.50 · +6 s |
| SB | vharun | 71% · 5.17 | +21 · -2.08 · -7 s |
| SB | the_unweaver | 13% · 5.00 | +38 · -1.50 · -8 s |
| SB | the_silent_conductor | 21% · 4.25 | +8 · -0.92 · -4 s |
| SC | hollow_cantor | 0% · 6.42 | +25 · +0.83 · +13 s |
| SC | vharun | 42% · 6.50 | +8 · -0.21 · -4 s |
| SC | the_unweaver | 17% · 4.75 | +0 · -0.67 · +2 s |
| SC | the_silent_conductor | 4% · 4.92 | +13 · -0.75 · +1 s |


| Party | Cell | every rule: win · downs | −oroFocus | −saplingRally |
|---|---|---|---|---|
| OA | hollow_cantor | 50% · 7.58 | +0 · +1.54 · +36 s | -13 · -1.13 · -15 s |
| OA | vharun | 46% · 10.04 | -46 · +2.13 · +49 s | -33 · -0.25 · -19 s |
| OA | the_unweaver | 0% · 5.79 | +0 · +0.38 · -4 s | +0 · -0.50 · -2 s |
| OA | the_silent_conductor | 13% · 5.13 | -4 · +0.75 · +4 s | -4 · +0.38 · -11 s |
| OB | hollow_cantor | 25% · 3.88 | +13 · -0.25 · +30 s | -21 · +0.46 · -29 s |
| OB | vharun | 21% · 7.13 | -13 · +1.08 · +31 s | -4 · +0.04 · -13 s |
| OB | the_unweaver | 0% · 9.33 | +4 · -2.08 · +53 s | +4 · -1.63 · +7 s |
| OB | the_silent_conductor | 8% · 4.83 | +0 · -0.38 · -3 s | -4 · -0.58 · -10 s |
| OC | hollow_cantor | 8% · 6.88 | +8 · +1.04 · +25 s | +0 · -1.79 · -4 s |
| OC | vharun | 71% · 8.50 | -38 · +1.17 · +13 s | -25 · -0.63 · -9 s |
| OC | the_unweaver | 0% · 4.04 | +0 · +0.08 · +15 s | +0 · -0.50 · +10 s |
| OC | the_silent_conductor | 4% · 4.79 | -4 · +0.29 · -10 s | -4 · +0.67 · +9 s |


**What the ablation found, and what was done.**
- **`serenParryWard` was plainly broken once Seren holds a boss** (SB: off, Vharun −2.08 downs, the Unweaver −1.25, the Conductor +13 points). In a boss fight it Wards her only against the boss's own blows, and with `serenPerfectFirst` on, the boss's cones are the Perfect scorer's, so the rule spent a Ward on every boss *swing* and left the next cone on Lyra or Vexis unwarded. Fixed (change 3): a plain swing never takes the last Ward charge. After it, with the rule on, SB is 100% at all four bosses with 3.79 / 1.29 / 0.13 downs at Vharun, the Unweaver and the Conductor (5.17 / 2.71 / 1.13 before), and leaving it off now costs 4-8 points:


| Party | Cell | every rule: win · downs | −serenParryWard | −serenPerfectFirst |
|---|---|---|---|---|
| SB | hollow_cantor | 100% · 0.33 | — | +0 · -0.04 · -1 s |
| SB | vharun | 100% · 3.79 | -4 · -0.71 · +5 s | +0 · -0.63 · +1 s |
| SB | the_unweaver | 100% · 1.29 | -8 · +0.17 · +9 s | -8 · -0.08 · -6 s |
| SB | the_silent_conductor | 100% · 0.13 | -4 · +0.08 · -2 s | +0 · +0.21 · -1 s |
| SB | frayed_threshold | 75% · 1.13 | +0 · -0.04 · -0 s | +0 · -0.04 · -0 s |
| SB | mirror_hall | 100% · 0.08 | +0 · -0.04 · -1 s | — |
| W | hollow_cantor | 79% · 1.75 | — | +8 · -0.04 · +1 s |
| W | vharun | 96% · 3.88 | +4 · -0.46 · +1 s | -8 · -0.13 · -5 s |
| W | the_unweaver | 100% · 1.67 | +0 · -0.17 · -5 s | +0 · +0.17 · -1 s |
| W | the_silent_conductor | 96% · 0.25 | +4 · +0.00 · +11 s | +4 · -0.13 · -2 s |
| W | frayed_threshold | 46% · 1.88 | -13 · +0.42 · +3 s | -4 · +0.08 · -1 s |


| Party | Cell | every rule: win · downs | −serenParryWard |
|---|---|---|---|
| SA | frayed_threshold | 58% · 1.58 | +4 · -0.13 · +2 s |
| SA | glass_gallery | 75% · 2.50 | — |
| SA | vharun | 88% · 2.92 | +0 · +0.00 · +0 s |
| SC | frayed_threshold | 83% · 1.17 | -4 · +0.25 · -0 s |
| SC | frayed_court | 79% · 1.17 | -13 · +0.25 · -6 s |
| SC | vharun | 100% · 0.92 | — |


- **`oroRally` was plainly broken in OB** (off: +21 points and −2.08 downs at the Unweaver, +8 and −0.58 at the Conductor; in a second round, with a first guard that missed the cause, +13 to +21 at the Cantor, the Unweaver, the Conductor and the Bellwarden; the Unweaver in OC +13). A Rally walked the boss's target, Lyra or Vexis, home to her spot behind the Weaver, and the boss after her through the Weaver and the grove. Fixed (change 4, `bossBehind`). The rule still pays where it should: off, OC loses 25 points at the Cantor (the Silent Verse re-plant), OA 8, W 25 and X 67 at the Unweaver:


| Party | Cell | every rule: win · downs | −oroRally |
|---|---|---|---|
| OB | hollow_cantor | 83% · 1.13 | +8 · -0.29 · +3 s |
| OB | vharun | 100% · 2.46 | — |
| OB | the_unweaver | 100% · 1.33 | +0 · +0.00 · +1 s |
| OB | the_silent_conductor | 96% · 0.63 | — |
| OB | bellwarden | 100% · 0.63 | — |
| OB | frayed_threshold | 79% · 0.96 | +4 · -0.25 · +4 s |
| OB | frayed_court | 67% · 1.33 | +17 · -0.71 · +3 s |
| W | hollow_cantor | 79% · 1.75 | +21 · -0.58 · +3 s |
| W | vharun | 96% · 3.83 | -4 · -0.29 · +9 s |
| W | the_unweaver | 100% · 1.50 | -25 · +0.29 · +148 s |
| W | the_silent_conductor | 96% · 0.29 | +0 · +0.00 · -2 s |
| X | the_unweaver | 100% · 3.92 | -67 · +0.25 · +36 s |
| X | vharun | 71% · 4.79 | +17 · -0.29 · -4 s |
| OC | hollow_cantor | 96% · 2.83 | -25 · +1.08 · -5 s |
| OC | the_unweaver | 100% · 0.04 | +0 · +0.00 · -1 s |
| OA | hollow_cantor | 100% · 2.67 | -8 · +1.17 · -5 s |
| OA | the_unweaver | 100% · 0.88 | +0 · +0.25 · +1 s |
| OA | glass_gallery | 79% · 2.50 | +0 · +0.04 · +0 s |
| OA | frayed_threshold | 92% · 0.58 | -4 · +0.08 · -2 s |


- **Recorded, not changed (none is plainly broken; each is a tuning question):**
  - `serenCue` costs time at Vharun in SA and SC (off: −32 s and −0.88 downs in SA, −12 s in SC) but pays at the Cantor (off: −8 points in SA, −13 in SC). With it on, Thousand Cuts waits for 4+ enemies or an overextension, so a lone boss gets the plain Cue rule's ‘a boss fight, Cue it’ only through autonomy.
  - `serenPerfectFirst` is mixed (SB Vharun off −17, SB Conductor off +8 before the fix; W Cantor off +8 after it).
  - `oroFocus` is mixed (OA Vharun off −13, OB Conductor off −21; OA and OC Cantor off +4 to +8 but 26-61 s slower).
  - `groveCover` pays at bosses (off: +0.4 to +0.9 downs) and on the road (OB Frayed Threshold off −17).
  - `oroThread` is ‘—’ at Vharun and the Unweaver (the party is never calm there, or Unravel holds) and small elsewhere.
  - `serenCall` and `serenReel` are within noise everywhere: her Lunge Call rarely opens in a boss fight (Lunge is held for interrupts), and she is rarely overextended and hurt there.
  - The **Novice's `serenWard`** costs SB 21-38 points at Vharun and the Unweaver now that she holds the boss (she is always engaged, so the Novice keeps spending her Ward on Seren). It is the Novice's model of a beginner's eager Ward, so it is left for the tuning pass (lever 3), with the Novice bands (SB at bosses ≥ 10%: 71 / 12 / 21% at Vharun, the Unweaver and the Conductor, met). The Novice's `oroFocus` and `saplingRally` both pay (off: up to −46 and −33 points).

### Tried and not kept

| Lever | Change tried | Where measured | Result | Why not kept |
|---|---|---|---|---|
| 1 | Seren `threatMult` 1.0 → 1.2 (the ±20% edge) | SB, W, SA, SC bosses, 12 seeds | SB bosses on her 0-3%, W 5-18%; SC Cantor 58% (75% at 1.0) | cannot make her the holder |
| 2 | `DUEL_BOSS_THREAT` ×3 | SB, W, X bosses, 12 seeds | SB holds the Cantor only (68%); Vharun 15%, the Unweaver 1% | too weak |
| 2 | `DUEL_BOSS_THREAT` ×4 | SB bosses, 12 seeds | Cantor 94%, Conductor 79%, Vharun 35%, the Unweaver 48% | too weak |
| 2 | `DUEL_BOSS_THREAT` ×10 | SB bosses, 12 seeds | the same holds as ×6 (94-98%), the Unweaver 83% win (×6: 92%) | no gain over ×6 |
| 3 | `oroRally` not while a damaging telegraph aimed at a hero is live | OB bosses and the Bellwarden, OA, 24 seeds | OB still +8 to +21 points with the rule off | missed the cause |
| 3 | `oroRally` not while a boss is on anyone but the tank (Kael) | final cells, 24 seeds (`g1-*`) | OB as kept; W at the Unweaver 71% (−29), X 42% (−58): Seren's and Brann's spots are in front, and their Rally was the one that worked | too wide: replaced by `bossBehind` |

### The carry-over items (item 1)

- **Recap thresholds, checked against the per-down data** (the final boss cells; the `gap` column is the blow's source distance past both bodies):
  - *Seren's `far`* (an enemy's bolt or beam from beyond `PARRY_REACH`, 6 m) fires on 0-1 of each party's downs; blows from past 6 m are 1-12 of each party's Seren downs and are raids, marks and bursts, each with its own answer. Her downs are 50-88% from within 2 m, and `parryable` (a melee blow aimed at her) names 37 of SB's 40, 110 of X's 131 and 77 of W's 86. Only 1 of 280 came with her parry armed. The rule matches the doc (‘Seren, by a far beam’) and the data: **kept**.
  - *Oro's `melee`* (a lesser foe's basic swing, or a blow from one within 6 m that is no raid, mark or link): 0-12 of his downs at bosses (most blows within 6 m of him there are bosses', which Saplings never screen, so ‘Rally: his Saplings screen him’ would be wrong), and 15-24 of 39-92 on the road (`fin-road` pooled: OA 24 of 64, OB 23 of 92, OC 15 of 39). It matches the doc's ‘caught in melee’: **kept**.
  - *Oro's `threadCut`* (a Severing cut of the Thread on him in the last 5 s): 0 in every down, bosses and road alike, because Severing elites cut the Thread far more often than they down Oro (Thread cuts a fight are in the Weaver-safety table). The doc's ‘while Oro is Threaded’ is what `threadCutAt` records (it is written only for a cut of a Thread on him): **kept**, and recorded as rarely reached.
  - *Felled outside*: 0-22 of Oro's boss downs and 19-30 of his road downs carry it; `deathAdviceLine` puts the blow's own answer first, as the doc says.
- **The counter's ‘amplified’ credit: recommendation, no change.** The counter and the kill shot go through `heroDamage`, and their `dealDamage` carries `amplified` = the auras' and Empower's share, exactly as every hero hit does; the Ward's own part is `ledger.duel.wardsDealt`, and render gives the whole number the gold chip from the `parryCountered` and `killShot` events (`serenCues.wardBlows`). Setting `amplified` to the whole counter would count the Ward's damage twice (in `ledger.amplified`, which feeds proof of support and the without-you counterfactual, and again in `wardsDealt`), and it would move only Seren goldens. No existing party's hash moves either way. Recommendation: keep it as it is, and keep the doc's line (‘not added to amplified totals’).
- **The e2e draw-call budget (≤ 220) for an Oro party.** No headless render bench measures draw calls (they are WebGL's `renderer.info.calls`, read by `src/app/runtime.ts` in the browser), and e2e was not run. Bounded instead from the render tests (`tests/renderOro.test.ts`, ‘two lazy model batches’ and ‘no new FX batches’): an Oro party adds exactly two model batches (`summon:sapling`, one instanced draw; `summon:ancient`, one draw and one shadow draw, made on the first Ancient) and the lazy Q2 disc decal (one draw), with FX batches equal to the default party's. That is at most 4 draw calls over the same scene, against 30-38 measured for the e2e busy fight (docs/phase-2.md:84, docs/phase-3.md:75). The e2e smoke's Oro-party check (`smoke.spec.ts`, ‘The summon batches stay inside the draw-call budget’) stays the measurement of record.
- **The Bramble reading (W2's question) confirmed:** Bramble roots and pricks only normal and elite, non-heavy foes, and a Focus on a lone boss casts nothing (no lesser foe to hold). That is the doc's row: ‘roots normal and elite, non-heavy enemies inside … and pricks them’.
- **Doc mismatches fixed here:** Seren's chip line now names the Swap Reel variant beside the Chronomancer and the Anchor (*UI*); *By party*, *Stats* (threatMult), *Gentle* and the *ROSTER_RULES* rows describe changes 1-5. Every other carry-over in the build notes (Unflinching, Gentle under Hold, the Ancient's Solo, the held grove's look, Verdant Choir's rings, Rootbond's sound, the downed fade, `serenReel` with Anchor, the Novice Prelude band, the recap fields, the Oro goldens after W2b) was closed at integration (*Integration hand-over*), and is not reopened.

### Bands after the prep, and what needs you

| Band | Measured (sets 1000 / 2000; the third set beside it) | Status |
|---|---|---|
| Bosses, ×A ×C ≥ default − 5 | SA −8 at Vharun (third set −8); SC −21 at the Cantor (−12); OA, OC within | missed in two cells: W9 tuning (lever 1, Seren's and Oro's numbers) |
| Bosses, SB ≥ default − 15 | +0 to +4 (third set −4 to +12) | **met on both sets** |
| Bosses, OB ≥ default − 25 (provisional) | −12 / +4 / +0 / +0 (third set +8 / +8 / +4 / −12) | **met on both sets** |
| Bosses, reduced vs − 15 | W +0 at all four; X −8 / −25 / +0 / +4; R −50 at Vharun; SO −25 to −96 | printed |
| Road, ×A ×C and SB ≥ default − 5 | SA 12 of 23 cells past it, SB 4, SC 5, OA 6, OC 4 | missed: the tuning pass starts here (Frayed Threshold, the Frayed Court, Blood Forge) |
| Road, OB ≥ default − 10 (provisional) | 3 of 23 cells past it (the Bellwarden −12, Frayed Threshold −17, the Frayed Court −29) | missed in 3 |
| Whole run, SB ≥ default − 10 | −24 on 2000, −8 on 333003 | seed-sensitive, 1 of 2 |
| Whole run, OB ≥ default − 20 (provisional) | −26 on 2000, −24 on 333003 | missed by 4-6 points |
| Whole run, ×A ×C ≥ default − 5 and ≥ 55% | SA 30 / 26%, SC 40 / 48%, OA 40 / 46%, OC 64 / 56% | missed |
| Seren: ≥ 50% of the Wards on her parry | SB 59%, W 57%, X 58% (third set 59, 54, 59); SA 7%, SC 8% | met where she holds the boss; not in Kael parties |
| Kael holds bosses ≥ 70% (SA, SC) | 51%, 41%; the default party's Kael 47% | **NEEDS USER** (above) |
| Oro: Saplings in your field ≥ 60% | OA 93, OB 60, OC 92% (third set 93, 60, 92) | met; OB at the edge (`bossBehind`) |
| Oro: downs ≤ 0.3 | OA 0.21, OB 0.29, OC 0.10 at bosses (third set 0.19, 0.25, 0.14) | **met on both sets** (0.36-1.02 at the first look) |
| Boss seconds on a summon | 0 | met |
| Idle at bosses | 0% everywhere | met |

**OB (Q8): the provisional bands, confirmed for the bosses, replaced by measurement for the run.** With the sidestep and `bossBehind`, OB's boss cells sit inside the provisional −25 on both sets (worst −12), so the boss band stands as provisional. Its whole run is −26 and −24 against the provisional −20: 4-6 points short, and no longer the outlier (SA −44, SC −34 / −22, OA −34 / −24 are as far or further). Recommendation: keep both provisional bands, and re-read OB's run after the road tuning, since OB loses on the road (the Bellwarden, Frayed Threshold) and at the Cantor, not at its bosses. The *Heartwood* alternative (a Quirk change) is not built and needs you; nothing here calls for it yet.

**NEEDS USER.**
1. Change 2 (Seren holds the Kael-less bosses by threat, ×6) is the default taken for the binding *By party* rows: confirm, or say how else you want it.
2. The ‘Kael holds bosses ≥ 70% in SA and SC’ band is below the default party's own Kael share (47%); only Kael's or Lyra's numbers could reach it. Restate it against the default party's share in the same run (SA 51 against 47: met; SC 41: −6), or accept it as missed.
3. OB's provisional bands (Q8): as recommended above, or replace them.

## W9 tuning round 1 (2026-11-08): lever 1, then the bands on three sets

*Branch `m5/tune` from the prep (`a3932c0`). In the agreed lever order: each Seren and Oro number at its edge alone (lever 1), then the kept combination, then a `verbs.ts` ablation round on the tuned tree (lever 3); no lever 2 or lever 4 change beyond the prep's. Never moved: Weaver, aura, enemy, encounter, Movement, road, starter and Brann numbers, and no aura definition, number, list or reach. Every existing fight is unchanged: the 19 original goldens are byte-identical, `SIM_VERSION` is 22, and all 22 baseline checks are byte-equal (below). `contentVersion` moves (`c-8bfa2beaf5775748` → `c-90f2f93ff5775748`), and the six Seren and Oro goldens are re-recorded with their `ROSTER_HASHES` literals. Tuned on cells 1000 and 500003 and runs 2000 and 900007; cells 777001 and runs 333003 were not looked at until the final measurement.*

Raw outputs and scripts: scratch `m5e/tune1/` (`raw/`: the screening `base-*`, `s_*`, `o_*`, `gc_*`, the candidate checks `c1-*`, the ablation `abl1-*`, and the final `fin-*`, `call-*`, `anchor-*`, `dec-*`, `pacing-default`; `scripts/`: `ovr.ts` applies lever-1 numbers in memory for a screening run, `cmp.py`, `screen.py`, `bands.py`, `own.py`).

### What changed (every number)

| File | Key | Old → new | Lever | Why |
|---|---|---|---|---|
| `src/content/heroes.ts` | `seren.attack.damage` | 60 → **72** (the +20% edge; 80 → 96 dps) | 1 | Seren deals about a third of what the starter she replaces does (at the Muted Nave, SA's Seren 67 a second against the default party's Lyra 222; at the Cantor, 97-106 against Vexis's 163-206). Her counter (3×) and kill shot (6×) scale with it. The only Seren number that moved every Seren party the right way in the screen. |
| `src/content/heroes.ts` | `oro.summons.sapling.maxHp` | 380 → **456** (+20%) | 1 | The Saplings hold the lesser foes longer (OB's Frayed Threshold 75 → 90%). |
| `src/content/heroes.ts` | `oro.summons.sapling.taunt.every` | 5 → **4** s (cadence, +25% pulses; the doc names cadence as a lever without a range) | 1 | More pulses, so fewer lesser foes slip past to the back line. |
| `src/content/heroes.ts` | `oro.summons.sapling.front.forward` | 5 → **4** m (inside the 4-6 m range) | 1 | Closer spots are easier to keep in your field and keep the held pack between the grove and the party; 6 m was worse on every Oro party. |
| tests | `rosterContracts`, `grove`, `uiPhase5e` literals | the same four numbers | — | content pins for Seren and Oro only |
| `tests/sim/golden.json`, `m1Unchanged.test.ts` | the six Seren and Oro goldens, `contentVersion` | re-recorded (`update-golden --write`) | — | the 19 originals byte-identical |

Nothing else moved: no sim, bot, Bond or motif value. The prep's two lever-2 rules (Oro's sidestep, `duelThreat`) and two bot fixes stand as they were.

### Seren holds the Kael-less bosses (default, awaiting your confirmation)

The *By party* rows are binding: in parties without Kael (SB, W, X and the unbanded LBS, LSO, VBS), Seren holds the bosses and parries them; Kael keeps them in SA and SC. **Lever 2 is used, not lever 1:** lever 1 cannot do it. Seren's `threatMult` at the +20% edge (1.2) put SB's bosses on her 0-3% of the time and W's 5-18% (12 seeds, the prep), because Lyra's Empowered arrows out-deal her about 7 : 1 at a boss, so her multiplier would need about ×7. The rule is the prep's `duelThreat` (`DUEL_BOSS_THREAT` = 6 in `duel.ts`, one guarded line after the plain threat in `dealDamage`): with no tank in the party, her hits on a boss or miniboss count six times her threat. It is inert unless Seren is in the party and Kael is not, so SA, SC, R, SO and every pin are unchanged. Round 1's +20% attack raises her plain threat too, and the hold is firmer than the prep's (final tables below, every boss and set: the boss is on her 94-98% of its time in SB, 95-99% in W and 91-99% in X).

### How the round chose them

**1. The screen (lever 1, one number at a time).** Each of the doc's lever-1 numbers at its edge (the ±20% rule, or the doc's own range: dodge 0.35-0.55, Showboat 6-10 s, front spot 4-6 m, taunt radius 3-4 m, tended bonus 0.3-0.6), Skilled, on every road cell and the Movement I and II bosses (25 cells: Movement I bare, II the arrival kit, III ARRIVAL3_KIT), 24 seeds on each tuning set (1000 and 500003), pooled to 48. Each entry is the mean, over the 25 cells, of the gap to the default party's same cell (the prep's default row), and the count of cells past the band (road −5, OB −10; bosses −5, SB −15, OB −25). At 48 seeds a cell's noise is about ±7 points, so a single cell says little and the 25-cell mean (about ±1.5) is what was read. The 13 m clamp (11-13) is a code constant (`DUEL_CLAMP`) and was not screened.

| Lever | Change | SA | SB | SC | OA | OB | OC | Kept |
|---|---|---|---|---|---|---|---|---|
| — | none (the prep tree) | -9.8 / 13 | -2.2 / 4 | -2.6 / 6 | -3.8 / 8 | -2.8 / 3 | -0.5 / 2 |  |
| 1 | Seren `attack.damage` 60 → 72 | -8.0 / 10 | -0.9 / 3 | -1.8 / 3 |  |  |  | **kept** |
| 1 | Seren `counterPct` 3 → 3.6 | -9.3 / 12 | -1.8 / 4 | -3.0 / 7 |  |  |  | no |
| 1 | Seren `killShotMult` 6 → 7.2 | -9.5 / 12 | -2.5 / 4 | -2.7 / 6 |  |  |  | no |
| 1 | Seren `dodge` 0.45 → 0.55 | -9.2 / 12 | -2.1 / 4 | -2.6 / 6 |  |  |  | no |
| 1 | Seren `dodge` 0.45 → 0.35 | -9.6 / 12 | -2.1 / 4 | -2.8 / 6 |  |  |  | no |
| 1 | Thousand Cuts `power` 2 → 2.4 | -9.1 / 13 | -2.2 / 5 | -2.9 / 7 |  |  |  | no |
| 1 | Lunge / Feint cooldowns 8 / 10 → 6.4 / 8 | -9.3 / 14 | -1.9 / 4 | -2.7 / 6 |  |  |  | no |
| 1 | Showboat `seconds` 8 → 6 | -8.4 / 12 | -2.3 / 4 | -2.8 / 7 |  |  |  | no |
| 1 | Showboat `seconds` 8 → 10 | -9.5 / 12 | -2.3 / 4 | -2.7 / 6 |  |  |  | no |
| 1 | attack 72 + counterPct 3.6 + Cuts 2.4 + killShotMult 7.2 | -7.3 / 10 | -1.3 / 5 | -2.2 / 5 |  |  |  | no |
| 1 | attack 72 + Showboat 6 | -8.3 / 10 | -1.1 / 2 | -2.3 / 5 |  |  |  | no |
| 1 | all five of the above | -8.2 / 11 | -1.8 / 4 | -2.4 / 5 |  |  |  | no |
| 1 | Oro thorn `attack.damage` 48 → 58 |  |  |  | -3.5 / 9 | -3.0 / 3 | -0.4 / 2 | no |
| 1 | Sapling `tendedBonus` 0.5 → 0.6 |  |  |  | -3.9 / 8 | -2.6 / 2 | -0.1 / 2 | no |
| 1 | Sapling `maxHp` 380 → 456 |  |  |  | -3.2 / 7 | -1.6 / 1 | -0.2 / 2 | in the kept set |
| 1 | Sapling `attack.damage` 26 → 31 |  |  |  | -4.3 / 9 | -2.2 / 1 | +0.2 / 2 | no |
| 1 | Sapling `taunt.radius` 3.5 → 4 |  |  |  | -3.4 / 8 | -2.4 / 3 | -0.7 / 4 | no |
| 1 | Sapling `taunt.every` 5 → 4 |  |  |  | -3.7 / 7 | -1.0 / 3 | -0.4 / 3 | in the kept set |
| 1 | Sapling `front.forward` 5 → 4 |  |  |  | -3.6 / 8 | -1.8 / 1 | -0.1 / 2 | in the kept set |
| 1 | Sapling `front.forward` 5 → 6 |  |  |  | -4.3 / 8 | -3.1 / 3 | -0.7 / 3 | no |
| 1 | Sapling `respawn` 12 → 9.6 |  |  |  | -4.0 / 8 | -2.5 / 4 | -0.4 / 4 | no |
| 1 | Ancient `maxHp` 2,000 → 2,400 and slam 70 → 84 |  |  |  | -4.2 / 9 | -2.8 / 4 | -0.3 / 3 | no |
| 1 | Bramble cooldown 14 → 11.2 and prick 40 → 48 |  |  |  | -3.9 / 6 | -2.0 / 3 | -0.1 / 3 | no |
| 1 | Sapling life 456 + taunt every 4 + front 4 + swing 31 |  |  |  | -3.1 / 6 | +0.2 / 1 | +0.3 / 2 | no |
| 1 | **Sapling life 456 + taunt every 4 + front 4** |  |  |  | -3.2 / 5 | +0.5 / 1 | +0.8 / 1 | **kept** |
| 1 | Sapling life 456 + taunt every 4 |  |  |  | -2.8 / 8 | -1.3 / 3 | +0.4 / 1 | no |
| 3 | `groveCover` only for the Saplings outside your field |  |  |  | -1.9 / 5 | -3.4 / 2 | -1.7 / 3 | no |
| 3 | `groveCover` off with Kael in the party |  |  |  | -0.2 / 3 |  | +0.2 / 2 | no |

The `gc_*` rows (lever 3) were played on the kept tree, so read them against the kept row (OA −3.2, OB +0.5, OC +0.8).

- **Seren:** only the attack moved all three of her parties the right way (SA −9.8 → −8.0, SB −2.2 → −0.9, SC −2.6 → −1.8). Every other number is inside the screen's noise, alone and in combination (the four damage numbers together: −7.3 / −1.3 / −2.2, no better in sum than the attack alone, −10.7 against −10.8).
- **Oro:** the Sapling life, the taunt cadence and the nearer front spot each moved all three Oro parties the right way, and together more (OA −3.8 → −3.2, OB −2.8 → +0.5, OC −0.5 → +0.8, and 5 / 1 / 1 cells past the band against 8 / 3 / 2). Adding the Sapling's swing (31) gave nothing more. The kept set also lowers the Weaver's damage on the road (OA 500 → 464 a fight, OB 374 → 351, OC 400 → 363).

**2. The candidate checked at every boss and on whole runs** (scratch `c1-*`, 24 seeds a boss cell, 50 runs a set):

| Party | Bosses, set 1000 (prep → round 1) | Bosses, set 500003 | Runs 2000 (prep → round 1) | Runs 900007 |
|---|---|---|---|---|
| SA | +0 / -8 / +0 / +4 → -4 / +4 / +0 / +4 | +12 / -4 / +0 / +4 | 30% (-44) → 42% (-32) | 34% (-36) |
| SB | +4 / +4 / +0 / +4 → +4 / -4 / -17 / +0 | +12 / -4 / -4 / +4 | 50% (-24) → 54% (-20) | 58% (-12) |
| SC | -21 / +4 / +0 / +4 → -4 / +4 / +0 / +4 | +0 / +0 / +0 / +4 | 40% (-34) → 50% (-24) | 48% (-22) |
| OA | +0 / +0 / +0 / +4 → +0 / +0 / +0 / +4 | +4 / -8 / +0 / +4 | 40% (-34) → 68% (-6) | 54% (-16) |
| OB | -12 / +4 / +0 / +0 → +0 / +0 / +0 / +0 | +12 / +0 / -8 / -8 | 48% (-26) → 50% (-24) | 54% (-16) |
| OC | -12 / +4 / +0 / +4 → -4 / +0 / +0 / +4 | +4 / +0 / +0 / +0 | 64% (-10) → 74% (+0) | 70% (+0) |
| R | +0 / -50 / -21 / +0 → +0 / -54 / +0 / +4 | +8 / -62 / +0 / +4 | 2% (-72) → 2% (-72) | 0% (-70) |
| SO | -83 / -96 / -96 / -25 → -58 / -88 / -58 / +4 | -54 / -96 / -54 / -4 | 0% (-74) → 0% (-74) | 0% (-70) |
| X | -8 / -25 / +0 / +4 → -8 / -17 / -8 / +0 | +8 / -12 / -4 / -4 | 2% (-72) → 4% (-70) | 8% (-62) |
| W | +0 / +0 / +0 / +0 → +4 / +0 / -4 / +4 | +4 / -8 / -4 / +4 | 24% (-50) → 44% (-30) | 38% (-32) |

The whole runs moved most: OA 40 → 68%, OC 64 → 74%, W 24 → 44%, SC 40 → 50%, SA 30 → 42% on 2000. Nothing else was tried at that scale before the final measurement.

**3. The ablation round (lever 3) on the tuned tree** (`tools/verbs.ts`, Skilled, 24 seeds from 1000, the road cells each party lost most; each cell is the rule left off, as change in win · downs · length against every rule on):

**Seren's rules:**

| Party | Cell | every rule: win · downs | −serenPerfectFirst | −serenParryWard | −serenReel | −serenCall | −serenCue |
|---|---|---|---|---|---|---|---|
| SA | frayed_threshold | 67% · 1.33 | +0 · -0.08 · -0 s | +4 · -0.08 · +1 s | +0 · +0.00 · -0 s | +0 · -0.04 · -1 s | — |
| SA | frayed_court | 63% · 1.42 | +4 · -0.08 · -2 s | -4 · +0.00 · -3 s | +0 · -0.04 · +0 s | +0 · +0.00 · +1 s | — |
| SA | glass_gallery | 63% · 2.83 | +0 · +0.00 · -0 s | — | -4 · +0.00 · -1 s | +0 · +0.00 · +1 s | -4 · -0.04 · -0 s |
| SA | muted_nave | 63% · 2.88 | +0 · -0.04 · +0 s | — | +8 · -0.08 · +3 s | +0 · -0.08 · -0 s | +0 · +0.00 · +0 s |
| SA | tolling_halls | 96% · 0.96 | +0 · -0.08 · -0 s | — | — | +0 · +0.00 · +0 s | — |
| SA | shield_wall | 67% · 1.42 | +0 · +0.04 · +1 s | -8 · +0.29 · +15 s | +0 · +0.13 · +0 s | +8 · -0.17 · +3 s | — |
| SA | blood_forge | 67% · 1.88 | +0 · +0.04 · +1 s | +4 · -0.25 · +1 s | +0 · +0.08 · -0 s | +0 · +0.21 · +2 s | — |
| SB | frayed_threshold | 83% · 0.83 | — | +0 · +0.00 · +2 s | +0 · +0.00 · +0 s | +0 · +0.00 · +0 s | — |
| SB | frayed_court | 71% · 1.63 | -4 · +0.04 · -3 s | +4 · -0.04 · +2 s | +0 · -0.08 · +2 s | +0 · +0.00 · -0 s | — |
| SB | glass_gallery | 96% · 0.92 | +0 · -0.04 · -0 s | — | +0 · +0.00 · -0 s | — | +0 · +0.00 · -0 s |
| SB | muted_nave | 100% · 0.42 | -8 · +0.25 · -1 s | — | — | +0 · +0.00 · +0 s | -4 · +0.08 · -1 s |
| SB | tolling_halls | 100% · 0.00 | +0 · +0.08 · +0 s | — | +0 · +0.00 · -0 s | +0 · +0.00 · +0 s | — |
| SB | shield_wall | 100% · 0.54 | +0 · +0.04 · +2 s | -13 · +0.63 · -4 s | -21 · +0.50 · -5 s | -4 · +0.08 · +0 s | — |
| SB | blood_forge | 83% · 1.21 | +0 · -0.04 · -0 s | -4 · +0.33 · -0 s | +4 · -0.08 · +0 s | +0 · -0.04 · +0 s | +0 · +0.00 · +0 s |
| SC | frayed_threshold | 88% · 0.88 | +0 · +0.00 · -1 s | +4 · +0.00 · +2 s | +4 · -0.13 · +1 s | +0 · +0.00 · -0 s | — |
| SC | frayed_court | 83% · 1.29 | -8 · +0.04 · -3 s | -17 · +0.25 · -7 s | +0 · +0.00 · -0 s | +0 · +0.00 · +0 s | — |
| SC | glass_gallery | 71% · 1.67 | +0 · -0.04 · -1 s | — | +4 · -0.04 · +1 s | +0 · +0.13 · +1 s | — |
| SC | muted_nave | 92% · 0.88 | +0 · +0.00 · -0 s | — | +0 · +0.04 · +0 s | +0 · +0.00 · +0 s | +0 · +0.04 · +1 s |
| SC | tolling_halls | 100% · 0.13 | +0 · +0.00 · +0 s | — | +0 · +0.00 · -0 s | — | +0 · +0.00 · +0 s |
| SC | shield_wall | 96% · 0.92 | +0 · -0.04 · +1 s | +0 · +0.00 · +2 s | -4 · +0.08 · -3 s | +0 · -0.29 · -0 s | — |
| SC | blood_forge | 96% · 0.46 | +0 · +0.00 · -0 s | -8 · +0.08 · -7 s | +0 · +0.04 · -0 s | -4 · +0.13 · -1 s | — |

**Oro's rules:**

| Party | Cell | every rule: win · downs | −oroFocus | −oroRally | −oroThread | −groveCover | −oroCue |
|---|---|---|---|---|---|---|---|
| OA | frayed_threshold | 88% · 0.67 | +0 · +0.00 · +0 s | +8 · -0.13 · +5 s | -8 · +0.17 · -2 s | +4 · -0.29 · -4 s | +0 · +0.00 · +0 s |
| OA | frayed_court | 83% · 0.75 | +0 · -0.04 · +3 s | +0 · -0.04 · +4 s | +4 · -0.25 · +2 s | +8 · -0.42 · +4 s | +0 · +0.00 · +3 s |
| OA | null_chapel | 71% · 1.21 | +4 · -0.04 · +17 s | -4 · +0.04 · +7 s | -4 · +0.08 · -7 s | +25 · -0.88 · +2 s | +4 · -0.04 · +3 s |
| OA | mirror_hall | 83% · 0.75 | +0 · +0.00 · +3 s | +4 · -0.04 · -0 s | +4 · +0.08 · +4 s | +8 · -0.25 · -4 s | +0 · +0.00 · +0 s |
| OA | wraith_vigil | 96% · 0.42 | +0 · +0.00 · +1 s | +0 · +0.08 · +0 s | -8 · +0.29 · +2 s | -4 · +0.12 · +2 s | +0 · +0.00 · +0 s |
| OA | glass_gallery | 63% · 2.00 | +0 · -0.17 · +2 s | +0 · +0.00 · -0 s | +0 · +0.00 · -0 s | +8 · +0.17 · +8 s | +0 · +0.00 · -0 s |
| OA | muted_nave | 88% · 2.63 | -8 · +0.46 · +6 s | +13 · -0.92 · -3 s | +4 · -1.25 · -10 s | +4 · -1.21 · -1 s | +0 · +0.33 · +1 s |
| OA | bellwarden | 100% · 0.54 | +0 · +0.08 · +14 s | +0 · -0.17 · -1 s | +0 · +0.08 · +1 s | +0 · -0.17 · -1 s | -4 · +0.38 · +3 s |
| OB | frayed_threshold | 92% · 0.54 | -13 · +0.08 · +16 s | +0 · -0.25 · -3 s | +0 · -0.08 · -3 s | -21 · +0.58 · -3 s | +0 · +0.00 · +0 s |
| OB | frayed_court | 83% · 0.92 | -4 · +0.04 · +16 s | +8 · -0.38 · -3 s | +4 · -0.04 · -7 s | -13 · +0.21 · -9 s | +0 · +0.00 · -0 s |
| OB | null_chapel | 100% · 0.13 | +0 · +0.00 · +0 s | -4 · +0.21 · +2 s | +0 · -0.08 · -2 s | -4 · +0.17 · -1 s | +0 · +0.00 · +0 s |
| OB | mirror_hall | 96% · 0.29 | +4 · -0.04 · +3 s | +4 · -0.17 · -9 s | -4 · +0.17 · -3 s | -13 · +0.42 · -3 s | +0 · +0.00 · -0 s |
| OB | wraith_vigil | 100% · 0.08 | +0 · +0.00 · -0 s | +0 · -0.04 · +0 s | +0 · -0.04 · -2 s | +0 · +0.08 · +5 s | +0 · +0.00 · +0 s |
| OB | glass_gallery | 100% · 0.75 | +0 · -0.17 · +2 s | +0 · -0.08 · -2 s | +0 · +0.00 · +1 s | -33 · +1.42 · +0 s | +0 · +0.00 · +0 s |
| OB | muted_nave | 100% · 0.54 | -8 · +0.21 · +0 s | +0 · -0.33 · -7 s | +0 · -0.33 · -7 s | -17 · +0.33 · +1 s | +0 · +0.04 · +0 s |
| OB | bellwarden | 100% · 0.63 | +0 · +1.13 · +10 s | — | +0 · +0.67 · +1 s | -8 · +0.96 · +6 s | +0 · +0.08 · +1 s |
| OC | frayed_threshold | 100% · 0.54 | -4 · +0.13 · +2 s | -4 · +0.13 · +2 s | +0 · +0.04 · -2 s | -8 · +0.25 · +5 s | +0 · +0.00 · -0 s |
| OC | frayed_court | 92% · 1.08 | +0 · +0.00 · +5 s | -21 · +0.42 · -15 s | -4 · -0.04 · -9 s | -25 · +0.08 · -11 s | +0 · +0.00 · +0 s |
| OC | null_chapel | 100% · 0.17 | -4 · +0.00 · +16 s | +0 · -0.08 · -4 s | +0 · -0.04 · -7 s | +0 · +0.08 · -6 s | +0 · +0.00 · -0 s |
| OC | mirror_hall | 100% · 0.33 | +0 · +0.00 · -2 s | +0 · +0.04 · -1 s | +0 · -0.12 · -2 s | -8 · +0.13 · -4 s | +0 · +0.00 · +0 s |
| OC | wraith_vigil | 100% · 0.17 | +0 · +0.00 · +2 s | +0 · +0.00 · +1 s | +0 · -0.04 · -2 s | +0 · -0.13 · +2 s | +0 · +0.00 · +0 s |
| OC | glass_gallery | 67% · 2.21 | +0 · -0.04 · +0 s | +4 · -0.04 · +1 s | +0 · +0.00 · +0 s | +33 · -2.21 · +1 s | +0 · +0.00 · -0 s |
| OC | muted_nave | 100% · 0.88 | +0 · +0.42 · -1 s | +0 · -0.04 · -5 s | -4 · -0.54 · -7 s | -4 · +0.13 · -9 s | +0 · +0.00 · -0 s |
| OC | bellwarden | 100% · 0.13 | -4 · +0.46 · +13 s | -4 · +0.17 · +1 s | +0 · +0.00 · +1 s | -8 · +0.42 · -1 s | +0 · +0.04 · +1 s |

**What it found.** No Seren rule is plainly broken on the road: every change is inside ±8 points except `serenParryWard` and `serenReel` at Shield Wall in SB (off: −13 and −21, so both pay) and `serenParryWard` at SC's Frayed Court (off −17). **`groveCover` is the one Oro rule with a large, mixed signal**: off, OA gains at the Null Chapel (+25, −0.88 downs) and OC at the Glass Gallery (+33, −2.21 downs), while OB loses at the Glass Gallery (−33), Frayed Threshold (−21) and the Frayed Court (−13), and OC at the Frayed Court (−25). Two narrower forms were screened on all 25 cells (the `gc_*` rows above): weighting only the Saplings outside your field helped OA (−3.2 → −1.9) and cost OB and OC (+0.5 → −3.4, +0.8 → −1.7); leaving it off with Kael in the party helped OA (−3.2 → −0.2) and cost OC a little (+0.8 → +0.2), and the prep's boss ablation has it paying at OA's Vharun and the Unweaver and OC's Conductor (off: −8 to −13). Neither is kept: the gain is OA's alone, and it is inside two sets' noise at the bosses. Recorded for round 2.

### Tried and not kept (round 1)

| Lever | Change | Where measured | Result (mean gap over 25 cells, cells past the band; SA / SB / SC or OA / OB / OC) | Why not kept |
|---|---|---|---|---|
| 1 | Seren `counterPct` 3 → 3.6 | screen | −9.3 / −1.8 / −3.0 (prep −9.8 / −2.2 / −2.6) | inside noise; SC worse |
| 1 | Seren `killShotMult` 6 → 7.2 | screen | −9.5 / −2.5 / −2.7 | inside noise |
| 1 | Seren `dodge` 0.45 → 0.55, → 0.35 | screen | −9.2 / −2.1 / −2.6; −9.6 / −2.1 / −2.8 | inside noise |
| 1 | Thousand Cuts `power` 2 → 2.4 | screen | −9.1 / −2.2 / −2.9 | inside noise |
| 1 | Lunge / Feint cooldowns 8 / 10 → 6.4 / 8 | screen | −9.3 / −1.9 / −2.7 | inside noise |
| 1 | Showboat `seconds` 8 → 6, → 10 | screen | −8.4 / −2.3 / −2.8; −9.5 / −2.3 / −2.7 | SA only, inside noise |
| 1 | Seren: attack 72 with counterPct 3.6, Cuts 2.4 and killShotMult 7.2 | screen | −7.3 / −1.3 / −2.2 (attack alone −8.0 / −0.9 / −1.8) | no better in sum; three more numbers |
| 1 | Seren: attack 72 with Showboat 6; all five | screen | −8.3 / −1.1 / −2.3; −8.2 / −1.8 / −2.4 | no better |
| 1 | Oro thorn 48 → 58 | screen | −3.5 / −3.0 / −0.4 (prep −3.8 / −2.8 / −0.5) | inside noise |
| 1 | Sapling `tendedBonus` 0.5 → 0.6 | screen | −3.9 / −2.6 / −0.1 | inside noise |
| 1 | Sapling swing 26 → 31 | screen; and with the kept set | −4.3 / −2.2 / +0.2; kept set + 31: −3.1 / +0.2 / +0.3 | no gain |
| 1 | Sapling taunt radius 3.5 → 4 | screen | −3.4 / −2.4 / −0.7 | inside noise |
| 1 | Sapling front spot 5 → 6 m | screen | −4.3 / −3.1 / −0.7 | worse on all three |
| 1 | Sapling re-sprout 12 → 9.6 s | screen | −4.0 / −2.5 / −0.4 | inside noise |
| 1 | the Ancient's life 2,000 → 2,400 and slam 70 → 84 | screen | −4.2 / −2.8 / −0.3 | inside noise |
| 1 | Bramble cooldown 14 → 11.2 s and prick 40 → 48 | screen | −3.9 / −2.0 / −0.1 | inside noise |
| 1 | Sapling life 456 and taunt every 4 without the 4 m spot | screen | −2.8 / −1.3 / +0.4 (kept: −3.2 / +0.5 / +0.8) | worse for OB; Weaver damage higher (OB 369 against 351) |
| 3 | `groveCover` weights only the Saplings outside your field | kept tree, screen cells | −1.9 / −3.4 / −1.7 | OB and OC worse |
| 3 | `groveCover` off with Kael in the party | kept tree, screen cells (OA, OC) | OA −0.2, OC +0.2 | OA's gain only; it pays at OA's and OC's bosses (prep ablation) |

### The final measurement (the full protocol, on the committed tree)

What ran (scratch `final{1,2,3}.sh`, one lane a set, no more than three heavy jobs at once):
- **Cells**, 50 seeds on each of 1000, 500003 and 777001: every boss (`roster-bands --first-look --cells-only`, Idle, Novice and Skilled) for the default party and all ten banded parties; every skirmish, elite and miniboss cell of the three Movements' roads (Novice and Skilled) for the default party and the six full-protocol parties.
- **Whole runs**, 200 seeds on each of 2000, 900007 and 333003: Finale-route Expeditions (Skilled) for the eleven, and whole Preludes (Novice and Skilled) for the seven.
- Then the Callings at the Conductor (SC, OC), the Anchor, the Decree gate, the unbanded smoke and pacing (below).
- 777001 and 333003 are the untuned third sets. 'Default' is the same cell or run row in the same tool run; at 50 seeds a cell's noise is about ±6 points, at 200 runs a row's about ±3.

**The bands, set by set** (met only on all three sets; otherwise seed-sensitive k of 3):

| Band | Party | set 1000 | set 500003 | set 777001 | Status |
|---|---|---|---|---|---|
| Road cells, Skilled ≥ default − 5 | SA | 13 of 23 past | 8 of 23 past | 8 of 23 past | missed |
| Road cells, Skilled ≥ default − 5 | SB | 4 of 23 past | 4 of 23 past | 5 of 23 past | missed |
| Road cells, Skilled ≥ default − 5 | SC | 6 of 23 past | 6 of 23 past | 6 of 23 past | missed |
| Road cells, Skilled ≥ default − 5 | OA | 6 of 23 past | 5 of 23 past | 5 of 23 past | missed |
| Road cells, Skilled ≥ default − 10 | OB | 1 of 23 past | 1 of 23 past | 0 of 23 past | seed-sensitive 1 of 3 |
| Road cells, Skilled ≥ default − 5 | OC | 2 of 23 past | 3 of 23 past | 3 of 23 past | missed |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | SA | -2 / -4 / +0 / +4 | +8 / -4 / -2 / +4 | +8 / +8 / +2 / -4 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 | SB | +4 / -6 / -10 / +0 | +8 / -10 / -6 / +4 | +2 / +6 / -4 / +2 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | SC | -10 / +0 / +0 / +4 | -12 / -4 / -4 / +4 | -18 / +8 / -2 / -2 | missed |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | OA | +2 / -4 / +0 / +4 | +6 / -8 / -2 / -4 | +8 / +0 / +0 / +0 | seed-sensitive 2 of 3 |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 25 | OB | +0 / -2 / -2 / +2 | +8 / +0 / -4 / -2 | -6 / +8 / +2 / -8 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | OC | -2 / +0 / +0 / +4 | +2 / -2 / +0 / +0 | +2 / +10 / +2 / +0 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | R | -2 / -50 / +0 / +2 | +4 / -60 / -2 / +2 | +2 / -40 / +2 / +2 | missed |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | SO | -66 / -84 / -54 / +0 | -66 / -92 / -58 / -6 | -56 / -88 / -46 / -2 | missed |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | X | -6 / -18 / -6 / +2 | +8 / -18 / -2 / -2 | +4 / -10 / +2 / -2 | seed-sensitive 1 of 3 |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | W | +4 / -10 / -2 / +0 | +6 / -6 / -2 / +4 | +6 / +4 / +2 / +2 | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | SA | road min 38% · bosses min 41% | road min 38% · bosses min 41% | road min 38% · bosses min 41% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | SB | road min 39% · bosses min 41% | road min 38% · bosses min 41% | road min 39% · bosses min 41% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | SC | road min 43% · bosses min 42% | road min 44% · bosses min 42% | road min 42% · bosses min 42% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | OA | road min 41% · bosses min 45% | road min 41% · bosses min 45% | road min 42% · bosses min 45% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | OB | road min 43% · bosses min 38% | road min 43% · bosses min 37% | road min 43% · bosses min 37% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | OC | road min 48% · bosses min 46% | road min 48% · bosses min 46% | road min 47% · bosses min 45% | met |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | SA | 19 cells over +15% · Conductor 224 s | 19 cells over +15% · Conductor 225 s | 19 cells over +15% · Conductor 219 s | missed |
| Skilled length, ≤ 280 s at the Conductor | SB | Conductor 158 s | Conductor 158 s | Conductor 159 s | met |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | SC | 9 cells over +15% · Conductor 204 s | 7 cells over +15% · Conductor 204 s | 6 cells over +15% · Conductor 195 s | missed |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | OA | 26 cells over +15% · Conductor 239 s | 27 cells over +15% · Conductor 234 s | 27 cells over +15% · Conductor 238 s | missed |
| Skilled length, ≤ 280 s at the Conductor | OB | Conductor 166 s | Conductor 163 s | Conductor 158 s | met |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | OC | 19 cells over +15% · Conductor 209 s | 18 cells over +15% · Conductor 203 s | 19 cells over +15% · Conductor 214 s | missed |
| Idle at bosses 0% | SA | 0% | 0% | 0% | met |
| Idle at bosses 0% | SB | 0% | 0% | 0% | met |
| Idle at bosses 0% | SC | 0% | 0% | 0% | met |
| Idle at bosses 0% | OA | 0% | 0% | 0% | met |
| Idle at bosses 0% | OB | 0% | 0% | 0% | met |
| Idle at bosses 0% | OC | 0% | 0% | 0% | met |
| Idle at bosses 0% | R | 0% | 0% | 0% | met |
| Idle at bosses 0% | SO | 0% | 0% | 0% | met |
| Idle at bosses 0% | X | 0% | 0% | 0% | met |
| Idle at bosses 0% | W | 0% | 0% | 0% | met |
| Novice at bosses (%), ≤ Skilled | SA | 52 / 56 / 0 / 22 | 42 / 60 / 0 / 22 | 36 / 52 / 0 / 22 | met |
| Novice at bosses (%), ≤ Skilled; ≥ 10% | SB | 78 / 82 / 20 / 32 | 78 / 80 / 44 / 30 | 82 / 68 / 24 / 38 | met |
| Novice at bosses (%), ≤ Skilled | SC | 24 / 60 / 24 / 4 | 18 / 70 / 40 / 12 | 40 / 74 / 20 / 18 | met |
| Novice at bosses (%), ≤ Skilled | OA | 52 / 44 / 0 / 4 | 44 / 48 / 0 / 4 | 52 / 36 / 0 / 0 | met |
| Novice at bosses (%), ≤ Skilled | OB | 28 / 18 / 0 / 2 | 38 / 2 / 0 / 2 | 30 / 6 / 4 / 12 | met |
| Novice at bosses (%), ≤ Skilled | OC | 6 / 70 / 0 / 10 | 18 / 64 / 0 / 2 | 8 / 64 / 0 / 8 | met |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | SA | 58% (-31); Novice 6% (default 38%) | 59% (-29); Novice 4% (default 32%) | 55% (-31); Novice 8% (default 32%) | missed |
| Whole Prelude, Skilled ≥ default − 5 | SB | 94% (+6); Novice 65% (default 38%) | 94% (+6); Novice 68% (default 32%) | 96% (+9); Novice 66% (default 32%) | met |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | SC | 66% (-22); Novice 18% (default 38%) | 68% (-20); Novice 12% (default 32%) | 74% (-12); Novice 14% (default 32%) | missed |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | OA | 75% (-14); Novice 14% (default 38%) | 80% (-8); Novice 16% (default 32%) | 78% (-8); Novice 12% (default 32%) | missed |
| Whole Prelude, Skilled ≥ default − 10 | OB | 81% (-7); Novice 3% (default 38%) | 81% (-6); Novice 2% (default 32%) | 82% (-5); Novice 4% (default 32%) | met |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | OC | 79% (-9); Novice 10% (default 38%) | 80% (-8); Novice 5% (default 32%) | 80% (-6); Novice 8% (default 32%) | missed |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | SA | 30% (-42); reached 30%, won 98% of those | 31% (-37); reached 32%, won 98% of those | 33% (-32); reached 34%, won 99% of those | missed |
| Whole Finale-route Expedition, won ≥ default − 10 | SB | 62% (-9); reached 64%, won 97% of those | 61% (-7); reached 63%, won 97% of those | 56% (-10); reached 57%, won 97% of those | met |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | SC | 50% (-22); reached 50%, won 100% of those | 44% (-24); reached 44%, won 100% of those | 50% (-16); reached 50%, won 99% of those | missed |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | OA | 56% (-16); reached 57%, won 98% of those | 52% (-16); reached 54%, won 97% of those | 48% (-17); reached 50%, won 96% of those | missed |
| Whole Finale-route Expedition, won ≥ default − 20 (provisional) | OB | 56% (-16); reached 56%, won 98% of those | 56% (-12); reached 58%, won 97% of those | 51% (-15); reached 54%, won 94% of those | met |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | OC | 70% (-2); reached 72%, won 98% of those | 72% (+4); reached 73%, won 99% of those | 73% (+7); reached 74%, won 99% of those | met |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | R | 2% (-70); reached 2%, won 100% of those | 1% (-67); reached 1%, won 100% of those | 2% (-64); reached 2%, won 100% of those | missed |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | SO | 0% (-72); reached 0%, won 100% of those | 0% (-68); reached 0%, won nan% of those | 0% (-66); reached 0%, won nan% of those | missed |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | X | 4% (-68); reached 4%, won 100% of those | 8% (-61); reached 8%, won 100% of those | 6% (-60); reached 6%, won 100% of those | missed |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | W | 38% (-34); reached 38%, won 100% of those | 38% (-31); reached 38%, won 99% of those | 40% (-25); reached 40%, won 100% of those | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) | OA | bosses 940/2.02 (default 509/1.06); road 376/0.49 (261/0.27) | bosses 979/2.04 (default 543/1.15); road 393/0.51 (264/0.29) | bosses 988/2.15 (default 518/1.11); road 391/0.51 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) | OB | bosses 624/1.33 (default 509/1.06); road 307/0.43 (261/0.27) | bosses 596/1.29 (default 543/1.15); road 303/0.42 (264/0.29) | bosses 677/1.51 (default 518/1.11); road 299/0.41 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) | OC | bosses 646/1.29 (default 509/1.06); road 313/0.36 (261/0.27) | bosses 655/1.34 (default 543/1.15); road 317/0.37 (264/0.29) | bosses 658/1.27 (default 518/1.11); road 321/0.37 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) (printed) | SA | bosses 990/2.06 (default 509/1.06); road 407/0.70 (261/0.27) | bosses 1028/2.01 (default 543/1.15); road 408/0.70 (264/0.29) | bosses 979/1.88 (default 518/1.11); road 411/0.69 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) (printed) | SB | bosses 524/1.18 (default 509/1.06); road 269/0.37 (261/0.27) | bosses 530/1.18 (default 543/1.15); road 281/0.39 (264/0.29) | bosses 541/1.29 (default 518/1.11); road 267/0.37 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) (printed) | SC | bosses 896/1.84 (default 509/1.06); road 401/0.65 (261/0.27) | bosses 889/1.90 (default 543/1.15); road 400/0.67 (264/0.29) | bosses 908/1.97 (default 518/1.11); road 392/0.63 (259/0.28) | missed |
| Thread cuts, Movement III, ≤ default + 25% a fight | OA | 2.12 (default 1.06) | 2.17 (default 1.00) | 2.21 (default 1.02) | missed |
| Thread cuts, Movement III, ≤ default + 25% a fight | OB | 1.36 (default 1.06) | 1.29 (default 1.00) | 1.33 (default 1.02) | missed |
| Thread cuts, Movement III, ≤ default + 25% a fight | OC | 1.65 (default 1.06) | 1.50 (default 1.00) | 1.65 (default 1.02) | missed |
| Bond XP a fight ≥ 75% of the starters' | SA | Seren 65% | Seren 65% | Seren 65% | missed |
| Bond XP a fight ≥ 75% of the starters' | SB | Seren 73% | Seren 73% | Seren 73% | missed |
| Bond XP a fight ≥ 75% of the starters' | SC | Seren 61% | Seren 62% | Seren 61% | missed |
| Bond XP a fight ≥ 75% of the starters' | OA | Oro 69% | Oro 69% | Oro 69% | missed |
| Bond XP a fight ≥ 75% of the starters' | OB | Oro 67% | Oro 67% | Oro 67% | missed |
| Bond XP a fight ≥ 75% of the starters' | OC | Oro 64% | Oro 64% | Oro 64% | missed |
| Bond XP a fight ≥ 75% of the starters' | W | Seren 74%, Oro 64% | Seren 74%, Oro 64% | Seren 74%, Oro 64% | missed |
| Bond XP a fight ≥ 75% of the starters' | X | (no starter) | (no starter) | (no starter) | n/a |
| Bond XP a fight ≥ 75% of the starters' | R | Seren 69% | Seren 69% | Seren 69% | missed |
| Bond XP a fight ≥ 75% of the starters' | SO | Seren 82%, Oro 71% | Seren 81%, Oro 70% | Seren 81%, Oro 70% | missed |


#### Bosses (50 seeds a cell, Idle, Novice and Skilled)

**Skilled win (the Novice's in brackets), gap to default in the same run (50 seeds) (set 1000)**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | 96% (56%) | 98% (46%) | 100% (42%) | 96% (30%) |
| SA | 94% (52%) -2 | 94% (56%) -4 | 100% (0%) +0 | 100% (22%) +4 |
| SB | 100% (78%) +4 | 92% (82%) -6 | 90% (20%) -10 | 96% (32%) +0 |
| SC | 86% (24%) -10 | 98% (60%) +0 | 100% (24%) +0 | 100% (4%) +4 |
| OA | 98% (52%) +2 | 94% (44%) -4 | 100% (0%) +0 | 100% (4%) +4 |
| OB | 96% (28%) +0 | 96% (18%) -2 | 98% (0%) -2 | 98% (2%) +2 |
| OC | 94% (6%) -2 | 98% (70%) +0 | 100% (0%) +0 | 100% (10%) +4 |
| R | 94% (0%) -2 | 48% (20%) -50 ⚠ | 100% (0%) +0 | 98% (0%) +2 |
| SO | 30% (0%) -66 ⚠ | 14% (38%) -84 ⚠ | 46% (0%) -54 ⚠ | 96% (2%) +0 |
| X | 90% (30%) -6 | 80% (46%) -18 ⚠ | 94% (0%) -6 | 98% (2%) +2 |
| W | 100% (54%) +4 | 88% (70%) -10 | 98% (0%) -2 | 96% (20%) +0 |

Idle, best win over these cells: default 0%, SA 0%, SB 0%, SC 0%, OA 0%, OB 0%, OC 0%, R 0%, SO 0%, X 0%, W 0%

**Skilled win (the Novice's in brackets), gap to default in the same run (50 seeds) (set 500003)**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | 90% (62%) | 100% (50%) | 100% (48%) | 96% (26%) |
| SA | 98% (42%) +8 | 96% (60%) -4 | 98% (0%) -2 | 100% (22%) +4 |
| SB | 98% (78%) +8 | 90% (80%) -10 | 94% (44%) -6 | 100% (30%) +4 |
| SC | 78% (18%) -12 | 96% (70%) -4 | 96% (40%) -4 | 100% (12%) +4 |
| OA | 96% (44%) +6 | 92% (48%) -8 | 98% (0%) -2 | 92% (4%) -4 |
| OB | 98% (38%) +8 | 100% (2%) +0 | 96% (0%) -4 | 94% (2%) -2 |
| OC | 92% (18%) +2 | 98% (64%) -2 | 100% (0%) +0 | 96% (2%) +0 |
| R | 94% (0%) +4 | 40% (12%) -60 ⚠ | 98% (0%) -2 | 98% (0%) +2 |
| SO | 24% (0%) -66 ⚠ | 8% (40%) -92 ⚠ | 42% (0%) -58 ⚠ | 90% (0%) -6 |
| X | 98% (36%) +8 | 82% (46%) -18 ⚠ | 98% (0%) -2 | 94% (4%) -2 |
| W | 96% (58%) +6 | 94% (70%) -6 | 98% (0%) -2 | 100% (20%) +4 |

Idle, best win over these cells: default 0%, SA 0%, SB 0%, SC 0%, OA 0%, OB 0%, OC 0%, R 0%, SO 0%, X 0%, W 0%

**Skilled win (the Novice's in brackets), gap to default in the same run (50 seeds) (set 777001, untuned)**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | 92% (72%) | 90% (56%) | 98% (46%) | 98% (18%) |
| SA | 100% (36%) +8 | 98% (52%) +8 | 100% (0%) +2 | 94% (22%) -4 |
| SB | 94% (82%) +2 | 96% (68%) +6 | 94% (24%) -4 | 100% (38%) +2 |
| SC | 74% (40%) -18 ⚠ | 98% (74%) +8 | 96% (20%) -2 | 96% (18%) -2 |
| OA | 100% (52%) +8 | 90% (36%) +0 | 98% (0%) +0 | 98% (0%) +0 |
| OB | 86% (30%) -6 | 98% (6%) +8 | 100% (4%) +2 | 90% (12%) -8 |
| OC | 94% (8%) +2 | 100% (64%) +10 | 100% (0%) +2 | 98% (8%) +0 |
| R | 94% (0%) +2 | 50% (18%) -40 ⚠ | 100% (0%) +2 | 100% (0%) +2 |
| SO | 36% (0%) -56 ⚠ | 2% (34%) -88 ⚠ | 52% (0%) -46 ⚠ | 96% (0%) -2 |
| X | 96% (36%) +4 | 80% (42%) -10 | 100% (0%) +2 | 96% (2%) -2 |
| W | 98% (64%) +6 | 94% (70%) +4 | 100% (0%) +2 | 100% (24%) +2 |

Idle, best win over these cells: default 0%, SA 0%, SB 0%, SC 0%, OA 0%, OB 0%, OC 0%, R 0%, SO 0%, X 0%, W 0%

**Skilled length (s) and downs a fight, gap to default (set 1000)**

| Party | Cantor | Vharun | Unweaver | Conductor |
|---|---|---|---|---|
| default | 147 s · 1.82 | 195 s · 0.94 | 192 s · 0.44 | 174 s · 0.22 |
| SA | 183 s (+24%) · 2.84 | 349 s (+79%) · 2.54 | 329 s (+72%) · 0.90 | 224 s (+29%) · 0.02 |
| SB | 122 s (-17%) · 0.82 | 190 s (-3%) · 3.64 | 194 s (+1%) · 1.26 | 158 s (-9%) · 0.32 |
| SC | 172 s (+16%) · 4.06 | 235 s (+20%) · 0.78 | 218 s (+14%) · 0.52 | 204 s (+17%) · 0.10 |
| OA | 227 s (+54%) · 1.98 | 345 s (+77%) · 2.52 | 374 s (+95%) · 1.56 | 239 s (+38%) · 0.44 |
| OB | 163 s (+11%) · 0.86 | 203 s (+4%) · 2.12 | 211 s (+10%) · 1.92 | 166 s (-4%) · 0.78 |
| OC | 174 s (+18%) · 2.58 | 233 s (+19%) · 0.84 | 227 s (+18%) · 0.16 | 209 s (+20%) · 0.26 |
| R | 192 s (+30%) · 5.56 | 404 s (+107%) · 7.08 | 439 s (+129%) · 1.84 | 339 s (+95%) · 1.48 |
| SO | 171 s (+16%) · 5.86 | 467 s (+139%) · 7.68 | 516 s (+169%) · 6.64 | 396 s (+128%) · 1.02 |
| X | 199 s (+35%) · 2.56 | 376 s (+93%) · 3.88 | 437 s (+128%) · 1.88 | 258 s (+48%) · 0.40 |
| W | 193 s (+31%) · 0.92 | 287 s (+47%) · 3.30 | 346 s (+80%) · 1.40 | 223 s (+29%) · 0.34 |

**Per-down table, Skilled, these cells pooled (read it first) (set 1000)**

| Party | downs a fight | aimed at the victim | at another hero | at no one | basic | tick | beyond 14 m | Seren parry armed | summon near | top blows |
|---|---|---|---|---|---|---|---|---|---|---|
| default | 0.85 | 86 | 39 | 36 | 10 | 0 | 1 | - | 0 | cantor_toll 53, cantor_requiem 31, vharun_twin_cleave 26 |
| SA | 1.57 | 192 | 54 | 53 | 16 | 0 | 6 | 1/48 | 0 | cantor_toll 82, vharun_twin_cleave_second 81, cantor_requiem 53 |
| SB | 1.51 | 94 | 164 | 16 | 28 | 0 | 0 | 0/83 | 0 | vharun_twin_cleave 97, vharun_twin_cleave_second 55, champion_cleave 46 |
| SC | 1.36 | 151 | 26 | 51 | 45 | 0 | 3 | 1/46 | 0 | cantor_toll 118, cantor_requiem 50, basic 45 |
| OA | 1.62 | 200 | 81 | 24 | 20 | 0 | 3 | - | 169 | cantor_toll 67, vharun_twin_cleave_second 65, vharun_twin_cleave 43 |
| OB | 1.42 | 85 | 136 | 25 | 37 | 1 | 5 | - | 94 | vharun_twin_cleave 50, champion_cleave 44, basic 37 |
| OC | 0.96 | 106 | 39 | 37 | 10 | 0 | 1 | - | 101 | cantor_toll 83, cantor_requiem 35, vharun_twin_cleave_second 21 |
| R | 3.99 | 379 | 165 | 147 | 105 | 2 | 26 | 2/104 | 0 | vharun_twin_cleave_second 175, cantor_requiem 132, basic 105 |
| SO | 5.30 | 558 | 193 | 42 | 265 | 2 | 25 | 3/273 | 515 | basic 265, cantor_toll 129, unweaver_shear 129 |
| X | 2.18 | 227 | 82 | 67 | 58 | 2 | 15 | 0/171 | 219 | vharun_twin_cleave_second 76, champion_cleave 74, cantor_requiem 64 |
| W | 1.49 | 147 | 125 | 4 | 22 | 0 | 6 | 0/125 | 167 | vharun_twin_cleave 73, vharun_twin_cleave_second 56, cantor_toll 45 |

**Seren's and Oro's own downs, Skilled, these cells pooled, with the recap fields (set 1000)**

| Party | hero | downs | aimed at them | at another | basic | recap: warded / parryable / far / overextended (Seren); melee / felled outside / thread cut (Oro) | source ≤2 m / 2-6 m / >6 m |
|---|---|---|---|---|---|---|---|
| SA | seren | 48 (0.24 a fight) | 2 | 26 | 3 | 1 / 4 / 0 / 1 | 30 / 18 / 0 |
| SB | seren | 83 (0.41 a fight) | 58 | 4 | 16 | 0 / 62 / 0 / 7 | 51 / 29 / 3 |
| SC | seren | 46 (0.23 a fight) | 5 | 14 | 12 | 1 / 14 / 0 / 10 | 33 / 10 / 3 |
| OA | oro | 33 (0.17 a fight) | 5 | 25 | 0 | 1 / 1 / 0 | 8 / 16 / 9 |
| OB | oro | 33 (0.17 a fight) | 1 | 27 | 1 | 2 / 6 / 0 | 4 / 20 / 9 |
| OC | oro | 34 (0.17 a fight) | 1 | 23 | 1 | 2 / 4 / 0 | 6 / 15 / 13 |
| R | seren | 104 (0.52 a fight) | 11 | 70 | 10 | 2 / 14 / 1 / 6 | 56 / 44 / 4 |
| SO | seren | 273 (1.36 a fight) | 51 | 89 | 121 | 2 / 140 / 0 / 93 | 205 / 53 / 15 |
| SO | oro | 143 (0.71 a fight) | 45 | 67 | 20 | 16 / 31 / 0 | 34 / 42 / 67 |
| X | seren | 171 (0.85 a fight) | 117 | 7 | 40 | 0 / 144 / 1 / 35 | 122 / 45 / 4 |
| X | oro | 46 (0.23 a fight) | 11 | 23 | 6 | 4 / 4 / 0 | 6 / 22 / 18 |
| W | seren | 125 (0.62 a fight) | 101 | 2 | 20 | 0 / 112 / 0 / 16 | 102 / 21 / 2 |
| W | oro | 47 (0.23 a fight) | 8 | 37 | 1 | 3 / 1 / 0 | 6 / 32 / 9 |

**Downs a fight by hero, Skilled, pooled (set 1000)**

| Party | kael | lyra | vexis | brann | seren | oro |
|---|---|---|---|---|---|---|
| default | 0.41 | 0.20 | 0.24 |  |  |  |
| SA | 0.76 |  | 0.58 |  | 0.24 |  |
| SB |  | 0.48 | 0.61 |  | 0.41 |  |
| SC | 0.85 | 0.28 |  |  | 0.23 |  |
| OA | 0.62 |  | 0.84 |  |  | 0.17 |
| OB |  | 0.47 | 0.79 |  |  | 0.17 |
| OC | 0.60 | 0.19 |  |  |  | 0.17 |
| R | 1.83 |  |  | 1.64 | 0.52 |  |
| SO | 3.22 |  |  |  | 1.36 | 0.71 |
| X |  |  |  | 1.09 | 0.85 | 0.23 |
| W |  |  | 0.63 |  | 0.62 | 0.23 |

**Weaver safety and the Thread, Skilled, a fight (vs default) (set 1000)**

| Party | Weaver damage taken | Weaver downs | Thread cuts (all cells) |
|---|---|---|---|
| default | 509 | 1.06 | 0.15 |
| SA | 990 | 2.06 | 0.40 |
| SB | 524 | 1.18 | 0.24 |
| SC | 896 | 1.84 | 0.14 |
| OA | 940 | 2.02 | 1.00 |
| OB | 624 | 1.33 | 0.41 |
| OC | 646 | 1.29 | 0.41 |
| R | 1496 | 2.96 | 1.34 |
| SO | 2300 | 5.67 | 0.51 |
| X | 1138 | 2.58 | 0.51 |
| W | 761 | 1.73 | 0.66 |


#### The road (every skirmish, elite and miniboss cell, 50 seeds, Novice and Skilled)

Set 1000, by Movement:

**Movement I** (Skilled win, the Novice's in brackets, Skilled gap to default; ⚠ past the band: −5, OB −10)

| Party | First Light | Tolling Halls | Glass Gallery | Choir Loft | Mourning Steps | Muted Nave | Shattered Choir | Bellwarden (mini) |
|---|---|---|---|---|---|---|---|---|
| default | 100% (100%) | 100% (90%) | 94% (80%) | 100% (100%) | 98% (100%) | 100% (66%) | 92% (80%) | 98% (72%) |
| SA | 100% (94%) +0 | 80% (44%) -20 ⚠ | 62% (36%) -32 ⚠ | 100% (68%) +0 | 100% (74%) +2 | 86% (32%) -14 ⚠ | 96% (68%) +4 | 100% (62%) +2 |
| SB | 100% (100%) +0 | 100% (100%) +0 | 92% (86%) -2 | 100% (98%) +0 | 100% (100%) +2 | 98% (98%) -2 | 100% (90%) +8 | 100% (96%) +2 |
| SC | 100% (96%) +0 | 100% (92%) +0 | 78% (56%) -16 ⚠ | 100% (94%) +0 | 100% (94%) +2 | 100% (74%) +0 | 96% (68%) +4 | 100% (70%) +2 |
| OA | 100% (98%) +0 | 100% (72%) +0 | 66% (32%) -28 ⚠ | 100% (98%) +0 | 100% (88%) +2 | 88% (74%) -12 ⚠ | 100% (78%) +8 | 98% (38%) +0 |
| OB | 100% (98%) +0 | 100% (100%) +0 | 94% (78%) +0 | 100% (100%) +0 | 100% (98%) +2 | 98% (94%) -2 | 100% (98%) +8 | 94% (16%) -4 |
| OC | 100% (100%) +0 | 100% (98%) +0 | 76% (38%) -18 ⚠ | 100% (100%) +0 | 100% (98%) +2 | 100% (98%) +0 | 100% (88%) +8 | 100% (88%) +2 |

**Movement II** (Skilled win, the Novice's in brackets, Skilled gap to default; ⚠ past the band: −5, OB −10)

| Party | Crimson Gate | Blood Rites | Pike Line | Red Muster | Leech Warren | Shield Wall | Blood Forge | Matriarch (mini) |
|---|---|---|---|---|---|---|---|---|
| default | 100% (98%) | 100% (100%) | 100% (98%) | 100% (100%) | 100% (96%) | 94% (68%) | 92% (68%) | 100% (62%) |
| SA | 94% (80%) -6 ⚠ | 86% (86%) -14 ⚠ | 94% (100%) -6 ⚠ | 100% (98%) +0 | 100% (96%) +0 | 80% (30%) -14 ⚠ | 64% (32%) -28 ⚠ | 100% (12%) +0 |
| SB | 100% (90%) +0 | 100% (94%) +0 | 100% (98%) +0 | 100% (100%) +0 | 100% (98%) +0 | 90% (40%) -4 | 82% (42%) -10 ⚠ | 100% (26%) +0 |
| SC | 100% (94%) +0 | 98% (94%) -2 | 100% (98%) +0 | 100% (96%) +0 | 100% (98%) +0 | 92% (32%) -2 | 96% (42%) +4 | 98% (18%) -2 |
| OA | 100% (98%) +0 | 100% (100%) +0 | 100% (100%) +0 | 100% (100%) +0 | 100% (98%) +0 | 100% (72%) +6 | 96% (80%) +4 | 100% (26%) +0 |
| OB | 100% (98%) +0 | 100% (98%) +0 | 100% (100%) +0 | 100% (100%) +0 | 100% (96%) +0 | 98% (78%) +4 | 98% (72%) +6 | 100% (28%) +0 |
| OC | 100% (100%) +0 | 100% (98%) +0 | 100% (100%) +0 | 100% (98%) +0 | 100% (100%) +0 | 100% (66%) +6 | 100% (88%) +8 | 100% (38%) +0 |

**Movement III** (Skilled win, the Novice's in brackets, Skilled gap to default; ⚠ past the band: −5, OB −10)

| Party | Frayed Threshold | Maw Hollow | Wraith Vigil | Null Chapel | Mirror Hall | Frayed Court | Seamstress (mini) |
|---|---|---|---|---|---|---|---|
| default | 94% (60%) | 100% (82%) | 98% (58%) | 100% (94%) | 100% (98%) | 92% (48%) | 96% (50%) |
| SA | 64% (8%) -30 ⚠ | 92% (36%) -8 ⚠ | 82% (38%) -16 ⚠ | 90% (86%) -10 ⚠ | 96% (98%) -4 | 64% (30%) -28 ⚠ | 100% (90%) +4 |
| SB | 80% (38%) -14 ⚠ | 100% (84%) +0 | 100% (94%) +2 | 92% (92%) -8 ⚠ | 98% (98%) -2 | 70% (24%) -22 ⚠ | 98% (6%) +2 |
| SC | 86% (16%) -8 ⚠ | 86% (46%) -14 ⚠ | 92% (44%) -6 ⚠ | 100% (84%) +0 | 94% (82%) -6 ⚠ | 84% (28%) -8 ⚠ | 100% (88%) +4 |
| OA | 82% (56%) -12 ⚠ | 96% (82%) -4 | 96% (92%) -2 | 80% (92%) -20 ⚠ | 82% (98%) -18 ⚠ | 86% (54%) -6 ⚠ | 100% (22%) +4 |
| OB | 90% (76%) -4 | 100% (94%) +0 | 100% (94%) +2 | 96% (96%) -4 | 96% (100%) -4 | 78% (74%) -14 ⚠ | 100% (4%) +4 |
| OC | 96% (42%) +2 | 100% (90%) +0 | 100% (72%) +2 | 100% (86%) +0 | 100% (86%) +0 | 86% (38%) -6 ⚠ | 100% (44%) +4 |


**The road pooled, set 1000** (Skilled, every skirmish, elite and miniboss cell above)

| Party | mean win | gap | cells past the band | downs a fight | Seren parried / Wards on her / her downs | Saplings in your field / felled / Oro downs | Oro down recaps: melee / felled outside / thread cut |
|---|---|---|---|---|---|---|---|
| default | 98% |  |  | 0.22 | - | - | - |
| SA | 88% | -9 | 13 of 23 | 0.71 | 48% / 1.7 / 0.14 | - | - |
| SB | 96% | -2 | 4 of 23 | 0.40 | 61% / 2.3 / 0.10 | - | - |
| SC | 96% | -2 | 6 of 23 | 0.44 | 52% / 1.6 / 0.10 | - | - |
| OA | 94% | -3 | 6 of 23 | 0.48 | - | 93% / 0.55 / 0.10 | 41 / 39 / 0 of 117 |
| OB | 97% | +0 | 1 of 23 | 0.57 | - | 87% / 0.67 / 0.14 | 27 / 20 / 0 of 157 |
| OC | 98% | +0 | 2 of 23 | 0.25 | - | 93% / 0.47 / 0.04 | 11 / 13 / 0 of 49 |

**The road pooled, set 500003** (Skilled, every skirmish, elite and miniboss cell above)

| Party | mean win | gap | cells past the band | downs a fight | Seren parried / Wards on her / her downs | Saplings in your field / felled / Oro downs | Oro down recaps: melee / felled outside / thread cut |
|---|---|---|---|---|---|---|---|
| default | 97% |  |  | 0.25 | - | - | - |
| SA | 88% | -9 | 8 of 23 | 0.72 | 49% / 1.7 / 0.15 | - | - |
| SB | 96% | -2 | 4 of 23 | 0.36 | 60% / 2.3 / 0.09 | - | - |
| SC | 95% | -3 | 6 of 23 | 0.44 | 52% / 1.7 / 0.09 | - | - |
| OA | 95% | -2 | 5 of 23 | 0.49 | - | 93% / 0.56 / 0.10 | 36 / 45 / 0 of 114 |
| OB | 97% | -1 | 1 of 23 | 0.53 | - | 87% / 0.65 / 0.13 | 20 / 17 / 0 of 148 |
| OC | 97% | +0 | 3 of 23 | 0.29 | - | 93% / 0.49 / 0.05 | 19 / 18 / 0 of 63 |

**The road pooled, set 777001** (Skilled, every skirmish, elite and miniboss cell above)

| Party | mean win | gap | cells past the band | downs a fight | Seren parried / Wards on her / her downs | Saplings in your field / felled / Oro downs | Oro down recaps: melee / felled outside / thread cut |
|---|---|---|---|---|---|---|---|
| default | 98% |  |  | 0.25 | - | - | - |
| SA | 89% | -9 | 8 of 23 | 0.71 | 47% / 1.8 / 0.14 | - | - |
| SB | 96% | -2 | 5 of 23 | 0.36 | 60% / 2.3 / 0.10 | - | - |
| SC | 94% | -3 | 6 of 23 | 0.45 | 54% / 1.7 / 0.11 | - | - |
| OA | 95% | -3 | 5 of 23 | 0.52 | - | 93% / 0.55 / 0.10 | 44 / 50 / 0 of 110 |
| OB | 97% | -1 | 0 of 23 | 0.62 | - | 86% / 0.62 / 0.16 | 17 / 18 / 0 of 181 |
| OC | 97% | +0 | 3 of 23 | 0.31 | - | 93% / 0.50 / 0.06 | 23 / 25 / 0 of 67 |

**Road cells past the band on any set** (gap to default on 1000 / 500003 / 777001; k of 3 = sets past)

| Party | cells past on all three sets | on one or two |
|---|---|---|
| SA | blood_forge -28 / -24 / -34; blood_rites -14 / -16 / -14; frayed_court -28 / -40 / -42; frayed_threshold -30 / -40 / -20; glass_gallery -32 / -30 / -20; muted_nave -14 / -16 / -22; shield_wall -14 / -26 / -18 | crimson_gate -6 / -2 / -4 (1 of 3); maw_hollow -8 / -2 / -4 (1 of 3); null_chapel -10 / -4 / -4 (1 of 3); pike_line -6 / +0 / -2 (1 of 3); tolling_halls -20 / -12 / -2 (2 of 3); wraith_vigil -16 / +0 / -18 (2 of 3) |
| SB | frayed_court -22 / -12 / -14; null_chapel -8 / -6 / -10 | blood_forge -10 / -12 / -4 (2 of 3); frayed_threshold -14 / -4 / -16 (2 of 3); mirror_hall -2 / +0 / -6 (1 of 3); shield_wall -4 / -16 / -8 (2 of 3) |
| SC | frayed_court -8 / -12 / -16; frayed_threshold -8 / -6 / -8; glass_gallery -16 / -10 / -18; maw_hollow -14 / -26 / -14 | blood_forge +4 / -2 / -8 (1 of 3); mirror_hall -6 / -6 / -2 (2 of 3); muted_nave +0 / -10 / -4 (1 of 3); shield_wall -2 / -4 / -8 (1 of 3); wraith_vigil -6 / +2 / -4 (1 of 3) |
| OA | glass_gallery -28 / -26 / -14; mirror_hall -18 / -6 / -10; null_chapel -20 / -16 / -20 | frayed_court -6 / -2 / -2 (1 of 3); frayed_threshold -12 / -2 / -14 (2 of 3); muted_nave -12 / -10 / -4 (2 of 3); wraith_vigil -2 / -6 / -14 (2 of 3) |
| OB | — | frayed_court -14 / -6 / -4 (1 of 3); the_seamstress +4 / -12 / -6 (1 of 3) |
| OC | frayed_court -6 / -6 / -8 | frayed_threshold +2 / +2 / -14 (1 of 3); glass_gallery -18 / -22 / -2 (2 of 3); muted_nave +0 / -6 / +0 (1 of 3); wraith_vigil +2 / +6 / -6 (1 of 3) |


#### Whole runs

**Whole runs, set 2000** (Skilled, 200 Finale-route Expeditions)

| Party | Won | Gap | Reached the Finale | Won of those | Fights | Minutes | Bond XP a fight vs the starters' average | Lost most at |
|---|---|---|---|---|---|---|---|---|
| default | 72% |  | 75% | 96% | 12.9 | 19.2 | - | blood_forge 9, frayed_threshold 8, bellwarden 6 |
| SA | 30% | -42 | 30% | 98% | 9.3 | 18.4 | Seren 65% | frayed_threshold 39, vharun 16, glass_gallery 15 |
| SB | 62% | -9 | 64% | 97% | 12.6 | 17.5 | Seren 73% | vharun 19, frayed_threshold 12, frayed_court 8 |
| SC | 50% | -22 | 50% | 100% | 10.9 | 17.7 | Seren 61% | hollow_cantor 35, frayed_threshold 19, frayed_court 10 |
| OA | 56% | -16 | 57% | 98% | 11.9 | 27.3 | Oro 69% | frayed_threshold 27, vharun 21, glass_gallery 10 |
| OB | 56% | -16 | 56% | 98% | 11.3 | 17.5 | Oro 67% | hollow_cantor 23, bellwarden 19, frayed_threshold 12 |
| OC | 70% | -2 | 72% | 98% | 12.7 | 22.6 | Oro 64% | frayed_threshold 18, hollow_cantor 12, frayed_court 9 |
| R | 2% | -70 | 2% | 100% | 7.0 | 14.9 | Brann 96%, Seren 69% | vharun 105, glass_gallery 16, shield_wall 14 |
| SO | 0% | -72 | 0% | 100% | 3.9 | 7.3 | Seren 82%, Oro 71% | hollow_cantor 99, glass_gallery 26, vharun 16 |
| X | 4% | -68 | 4% | 100% | 6.9 | 13.8 | (no starter) | frayed_threshold 43, vharun 30, crimson_gate 23 |
| W | 38% | -34 | 38% | 100% | 10.7 | 21.4 | Seren 74%, Oro 64% | frayed_threshold 29, vharun 16, wraith_vigil 14 |

**Whole runs, set 900007** (Skilled, 200 Finale-route Expeditions)

| Party | Won | Gap | Reached the Finale | Won of those | Fights | Minutes | Bond XP a fight vs the starters' average | Lost most at |
|---|---|---|---|---|---|---|---|---|
| default | 68% |  | 69% | 99% | 12.6 | 18.5 | - | vharun 13, frayed_court 7, frayed_threshold 7 |
| SA | 31% | -37 | 32% | 98% | 10.0 | 19.8 | Seren 65% | frayed_threshold 40, blood_forge 15, glass_gallery 15 |
| SB | 61% | -7 | 63% | 97% | 12.5 | 17.4 | Seren 73% | frayed_threshold 22, vharun 16, blood_forge 7 |
| SC | 44% | -24 | 44% | 100% | 10.5 | 16.8 | Seren 62% | hollow_cantor 29, frayed_threshold 21, frayed_court 10 |
| OA | 52% | -16 | 54% | 97% | 11.6 | 26.4 | Oro 69% | vharun 26, frayed_threshold 20, glass_gallery 10 |
| OB | 56% | -12 | 58% | 97% | 11.4 | 17.7 | Oro 67% | hollow_cantor 19, bellwarden 18, frayed_threshold 14 |
| OC | 72% | +4 | 73% | 99% | 12.7 | 22.5 | Oro 64% | frayed_threshold 14, frayed_court 11, glass_gallery 10 |
| R | 1% | -67 | 1% | 100% | 7.0 | 14.7 | Brann 95%, Seren 69% | vharun 97, shield_wall 18, hollow_cantor 15 |
| SO | 0% | -68 | 0% | - | 4.0 | 7.9 | Seren 81%, Oro 70% | hollow_cantor 85, glass_gallery 28, vharun 25 |
| X | 8% | -61 | 8% | 100% | 7.5 | 15.8 | (no starter) | frayed_threshold 42, vharun 40, crimson_gate 27 |
| W | 38% | -31 | 38% | 99% | 11.0 | 22.0 | Seren 74%, Oro 64% | frayed_threshold 41, mirror_hall 11, null_chapel 11 |

**Whole runs, set 333003** (Skilled, 200 Finale-route Expeditions, untuned)

| Party | Won | Gap | Reached the Finale | Won of those | Fights | Minutes | Bond XP a fight vs the starters' average | Lost most at |
|---|---|---|---|---|---|---|---|---|
| default | 66% |  | 67% | 98% | 12.5 | 18.4 | - | frayed_threshold 13, vharun 13, frayed_court 5 |
| SA | 33% | -32 | 34% | 99% | 9.6 | 18.8 | Seren 65% | frayed_threshold 23, vharun 19, glass_gallery 17 |
| SB | 56% | -10 | 57% | 97% | 12.2 | 16.9 | Seren 73% | frayed_threshold 39, blood_forge 8, vharun 8 |
| SC | 50% | -16 | 50% | 99% | 10.7 | 17.2 | Seren 61% | hollow_cantor 35, frayed_threshold 18, legion_vanguard 13 |
| OA | 48% | -17 | 50% | 96% | 11.8 | 26.5 | Oro 69% | vharun 25, frayed_threshold 20, glass_gallery 12 |
| OB | 51% | -15 | 54% | 94% | 11.0 | 17.1 | Oro 67% | hollow_cantor 33, bellwarden 20, frayed_threshold 11 |
| OC | 73% | +7 | 74% | 99% | 12.9 | 23.0 | Oro 64% | frayed_threshold 17, frayed_court 9, hollow_cantor 9 |
| R | 2% | -64 | 2% | 100% | 6.8 | 13.9 | Brann 96%, Seren 69% | vharun 88, glass_gallery 21, shield_wall 13 |
| SO | 0% | -66 | 0% | - | 3.9 | 7.1 | Seren 81%, Oro 70% | hollow_cantor 106, glass_gallery 26, vharun 16 |
| X | 6% | -60 | 6% | 100% | 7.2 | 14.4 | (no starter) | frayed_threshold 37, vharun 29, crimson_gate 27 |
| W | 40% | -25 | 40% | 100% | 11.0 | 21.9 | Seren 74%, Oro 64% | frayed_threshold 30, wraith_vigil 14, frayed_court 13 |


**Whole Preludes** (200 runs a set; won on 2000 / 900007 / 333003, the last untuned; gap to the default party in the same run)

| Party | Skilled won | Novice won |
|---|---|---|
| default | 88% / 88% / 86% | 38% / 32% / 32% |
| SA | 58% (-31) / 59% (-29) / 55% (-31) | 6% (-32) / 4% (-28) / 8% (-25) |
| SB | 94% (+6) / 94% (+6) / 96% (+9) | 65% (+26) / 68% (+36) / 66% (+34) |
| SC | 66% (-22) / 68% (-20) / 74% (-12) | 18% (-20) / 12% (-20) / 14% (-18) |
| OA | 75% (-14) / 80% (-8) / 78% (-8) | 14% (-25) / 16% (-17) / 12% (-20) |
| OB | 81% (-7) / 81% (-6) / 82% (-5) | 3% (-36) / 2% (-30) / 4% (-29) |
| OC | 79% (-9) / 80% (-8) / 80% (-6) | 10% (-29) / 5% (-28) / 8% (-24) |

Against the prep (50 runs on 2000; the same 50 seeds are the first quarter of these 200): SA 30 → 30%, SB 50 → 62%, SC 40 → 50%, OA 40 → 56%, OB 48 → 56%, OC 64 → 70%, W 24 → 38%. On the untuned 333003 the gaps hold or narrow (SB −10, OB −15, OC +7, SC −16, OA −17, SA −32). The runs are still lost on the road: Frayed Threshold is a top-three loss for every party, and SC's first loss is the Cantor (35 of 100 losses on 2000).

**Pacing** (Skilled Expedition minutes, soft limit default + 3): default 19.2 / 18.5 / 18.4. Inside it: SA 18.4-19.8, SB 16.9-17.5, SC 16.8-17.7, OB 17.1-17.7, W 21.4-22.0 (+2.2 to +3.5, over on 900007). Over it: **OA 26.4-27.3 (+7.9 to +8.1)** and **OC 22.5-23.0 (+3.4 to +4.6)**: the Oro parties' boss fights run long (OA +38 to +95% at the bosses), and they now reach more of the road.


#### Seren's and Oro's own numbers, and who holds the bosses


**Seren, set 1000** (Skilled; "road" = every skirmish, elite and miniboss cell; "bosses" = the four bosses)

| Party | Wards on her parried: road / bosses | counters + kill shots, share of her damage (skirmishes and elites) | kill shots a fight, elite+boss cells (Novice) | lost | beyond 14 m | overextensions answered ≤ 3 s | Showboat pick | downs a fight: road / bosses | Skilled parries ÷ Novice (bosses) |
|---|---|---|---|---|---|---|---|---|---|
| SA | 48% / 7% | 8% | 0.55 (0.05) | 0.00 | 0% | 64% | 71% | 0.14 / 0.24 | 0.3 ÷ 1.1 |
| SB | 61% / 59% | 12% | 1.21 (0.51) | 0.11 | 0% | 77% | 79% | 0.10 / 0.41 | 8.1 ÷ 16.0 |
| SC | 52% / 11% | 8% | 0.30 (0.03) | 0.00 | 0% | 79% | 70% | 0.10 / 0.23 | 0.3 ÷ 2.2 |
| R | - / 6% | - | 0.60 (0.07) | 0.01 | 0% | 73% | 89% | 0.00 / 0.52 | 0.4 ÷ 1.2 |
| SO | - / 16% | - | 1.06 (0.10) | 0.00 | 0% | 67% | 100% | 0.00 / 1.36 | 1.6 ÷ 2.4 |
| X | - / 59% | - | 2.94 (0.85) | 0.72 | 0% | 85% | 100% | 0.00 / 0.85 | 14.9 ÷ 18.8 |
| W | - / 55% | - | 2.73 (1.19) | 0.70 | 0% | 76% | 100% | 0.00 / 0.62 | 11.6 ÷ 21.6 |

**Oro, set 1000** (Skilled; the Novice beside the in-field share; corrected in W9 round 2: tending split road / bosses, timeouts counted by outcome)

| Party | Saplings in your field: road / bosses (Novice road / bosses) | both standing | tending: road / bosses (Novice road) | felled a fight | downs a fight: road / bosses | Rootbond a fight | Ancient taunt s · aura s | timeouts (540 s), Skilled: road / bosses (Novice bosses) |
|---|---|---|---|---|---|---|---|---|
| OA | 93% / 93% (78% / 85%) | 97% | 41% / 1% (44%) | 0.48 | 0.10 / 0.17 | 442 | 9.7 · 11.4 | 0 of 1150 / 0 of 200 (15 of 200) |
| OB | 87% / 59% (80% / 70%) | 95% | 53% / 2% (51%) | 0.62 | 0.14 / 0.17 | 621 | 7.2 · 7.9 | 0 of 1150 / 0 of 200 (1 of 200) |
| OC | 93% / 93% (78% / 85%) | 96% | 51% / 2% (49%) | 0.44 | 0.04 / 0.17 | 427 | 8.2 · 9.7 | 0 of 1150 / 0 of 200 (10 of 200) |
| SO | - / 90% (- / 87%) | 98% | - / 1% (-) | 1.06 | 0.00 / 0.71 | 437 | 21.9 · 50.3 | 0 of 0 / 24 of 200 (33 of 200) |
| X | - / 93% (- / 89%) | 100% | - / 1% (-) | 0.17 | 0.00 / 0.23 | 627 | 16.6 · 41.3 | 0 of 0 / 0 of 200 (31 of 200) |
| W | - / 94% (- / 87%) | 100% | - / 1% (-) | 0.23 | 0.00 / 0.23 | 710 | 13.2 · 31.5 | 0 of 0 / 0 of 200 (19 of 200) |

**Who holds the bosses, set 1000** (Skilled, pooled over the four bosses: share of boss time on each hero)

| Party | kael | lyra | vexis | brann | seren | oro | sapling | ancient |
|---|---|---|---|---|---|---|---|---|
| default | 46% | 50% | 3% |  |  |  |  |  |
| SA | 51% |  | 48% |  | 0% |  |  |  |
| SB |  | 4% | 1% |  | 95% |  |  |  |
| SC | 39% | 60% |  |  | 0% |  |  |  |
| OA | 60% |  | 39% |  |  | 1% |  |  |
| OB |  | 96% | 3% |  |  | 1% |  |  |
| OC | 43% | 57% |  |  |  | 0% |  |  |
| R | 85% |  |  | 12% | 1% |  |  |  |
| SO | 92% |  |  |  | 5% | 2% |  |  |
| X |  |  |  | 1% | 97% | 1% |  |  |
| W |  |  | 1% |  | 98% | 0% |  |  |

**Seren, set 500003** (Skilled; "road" = every skirmish, elite and miniboss cell; "bosses" = the four bosses)

| Party | Wards on her parried: road / bosses | counters + kill shots, share of her damage (skirmishes and elites) | kill shots a fight, elite+boss cells (Novice) | lost | beyond 14 m | overextensions answered ≤ 3 s | Showboat pick | downs a fight: road / bosses | Skilled parries ÷ Novice (bosses) |
|---|---|---|---|---|---|---|---|---|---|
| SA | 49% / 6% | 8% | 0.51 (0.05) | 0.00 | 0% | 66% | 71% | 0.15 / 0.20 | 0.2 ÷ 1.1 |
| SB | 60% / 58% | 12% | 1.28 (0.48) | 0.11 | 0% | 77% | 78% | 0.09 / 0.38 | 8.0 ÷ 16.5 |
| SC | 52% / 7% | 8% | 0.29 (0.03) | 0.00 | 0% | 79% | 70% | 0.09 / 0.26 | 0.2 ÷ 2.1 |
| R | - / 7% | - | 0.76 (0.04) | 0.00 | 0% | 71% | 89% | 0.00 / 0.53 | 0.5 ÷ 1.2 |
| SO | - / 16% | - | 0.92 (0.04) | 0.01 | 0% | 67% | 100% | 0.00 / 1.40 | 1.5 ÷ 2.5 |
| X | - / 60% | - | 3.00 (0.89) | 0.69 | 0% | 83% | 100% | 0.00 / 1.12 | 15.0 ÷ 18.8 |
| W | - / 55% | - | 2.67 (1.25) | 0.75 | 0% | 77% | 100% | 0.00 / 0.58 | 11.6 ÷ 20.9 |

**Oro, set 500003** (Skilled; the Novice beside the in-field share; corrected in W9 round 2: tending split road / bosses, timeouts counted by outcome)

| Party | Saplings in your field: road / bosses (Novice road / bosses) | both standing | tending: road / bosses (Novice road) | felled a fight | downs a fight: road / bosses | Rootbond a fight | Ancient taunt s · aura s | timeouts (540 s), Skilled: road / bosses (Novice bosses) |
|---|---|---|---|---|---|---|---|---|
| OA | 93% / 93% (77% / 85%) | 97% | 41% / 1% (45%) | 0.48 | 0.10 / 0.18 | 441 | 10.1 · 11.4 | 0 of 1150 / 0 of 200 (19 of 200) |
| OB | 87% / 60% (80% / 71%) | 95% | 54% / 2% (50%) | 0.61 | 0.13 / 0.20 | 644 | 7.0 · 7.8 | 0 of 1150 / 0 of 200 (1 of 200) |
| OC | 93% / 92% (77% / 86%) | 96% | 51% / 2% (49%) | 0.45 | 0.05 / 0.16 | 428 | 8.4 · 9.6 | 0 of 1150 / 0 of 200 (12 of 200) |
| SO | - / 90% (- / 86%) | 99% | - / 1% (-) | 0.97 | 0.00 / 0.79 | 402 | 20.0 · 50.9 | 0 of 0 / 20 of 200 (33 of 200) |
| X | - / 93% (- / 89%) | 100% | - / 1% (-) | 0.06 | 0.00 / 0.24 | 595 | 15.8 · 40.1 | 0 of 0 / 1 of 200 (34 of 200) |
| W | - / 94% (- / 87%) | 100% | - / 1% (-) | 0.23 | 0.00 / 0.20 | 761 | 15.3 · 31.5 | 0 of 0 / 0 of 200 (15 of 200) |

**Who holds the bosses, set 500003** (Skilled, pooled over the four bosses: share of boss time on each hero)

| Party | kael | lyra | vexis | brann | seren | oro | sapling | ancient |
|---|---|---|---|---|---|---|---|---|
| default | 45% | 51% | 4% |  |  |  |  |  |
| SA | 51% |  | 48% |  | 0% |  |  |  |
| SB |  | 4% | 0% |  | 95% |  |  |  |
| SC | 41% | 58% |  |  | 0% |  |  |  |
| OA | 59% |  | 40% |  |  | 0% |  |  |
| OB |  | 96% | 2% |  |  | 1% |  |  |
| OC | 42% | 57% |  |  |  | 1% |  |  |
| R | 86% |  |  | 11% | 1% |  |  |  |
| SO | 93% |  |  |  | 5% | 2% |  |  |
| X |  |  |  | 2% | 96% | 1% |  |  |
| W |  |  | 1% |  | 98% | 1% |  |  |

**Seren, set 777001** (Skilled; "road" = every skirmish, elite and miniboss cell; "bosses" = the four bosses)

| Party | Wards on her parried: road / bosses | counters + kill shots, share of her damage (skirmishes and elites) | kill shots a fight, elite+boss cells (Novice) | lost | beyond 14 m | overextensions answered ≤ 3 s | Showboat pick | downs a fight: road / bosses | Skilled parries ÷ Novice (bosses) |
|---|---|---|---|---|---|---|---|---|---|
| SA | 47% / 5% | 8% | 0.50 (0.07) | 0.00 | 0% | 68% | 71% | 0.14 / 0.17 | 0.2 ÷ 1.2 |
| SB | 60% / 58% | 11% | 1.34 (0.55) | 0.11 | 0% | 78% | 78% | 0.10 / 0.40 | 8.2 ÷ 16.3 |
| SC | 54% / 8% | 9% | 0.32 (0.03) | 0.00 | 0% | 79% | 69% | 0.11 / 0.27 | 0.3 ÷ 2.1 |
| R | - / 7% | - | 0.84 (0.04) | 0.00 | 0% | 80% | 89% | 0.00 / 0.56 | 0.5 ÷ 1.2 |
| SO | - / 16% | - | 0.82 (0.05) | 0.00 | 0% | 68% | 100% | 0.00 / 1.47 | 1.6 ÷ 2.3 |
| X | - / 59% | - | 2.97 (0.94) | 0.71 | 0% | 86% | 100% | 0.00 / 0.99 | 15.0 ÷ 18.9 |
| W | - / 55% | - | 2.75 (1.18) | 0.75 | 0% | 78% | 100% | 0.00 / 0.65 | 11.7 ÷ 21.5 |

**Oro, set 777001** (Skilled; the Novice beside the in-field share; corrected in W9 round 2: tending split road / bosses, timeouts counted by outcome)

| Party | Saplings in your field: road / bosses (Novice road / bosses) | both standing | tending: road / bosses (Novice road) | felled a fight | downs a fight: road / bosses | Rootbond a fight | Ancient taunt s · aura s | timeouts (540 s), Skilled: road / bosses (Novice bosses) |
|---|---|---|---|---|---|---|---|---|
| OA | 93% / 93% (78% / 85%) | 97% | 41% / 1% (45%) | 0.48 | 0.10 / 0.18 | 426 | 10.2 · 11.4 | 0 of 1150 / 0 of 200 (15 of 200) |
| OB | 86% / 59% (79% / 71%) | 95% | 53% / 2% (50%) | 0.61 | 0.16 / 0.26 | 646 | 6.6 · 7.7 | 0 of 1150 / 0 of 200 (0 of 200) |
| OC | 93% / 93% (77% / 86%) | 97% | 51% / 2% (49%) | 0.46 | 0.06 / 0.12 | 435 | 8.2 · 9.7 | 0 of 1150 / 0 of 200 (11 of 200) |
| SO | - / 91% (- / 87%) | 98% | - / 1% (-) | 1.21 | 0.00 / 0.79 | 501 | 23.4 · 50.7 | 0 of 0 / 18 of 200 (33 of 200) |
| X | - / 92% (- / 89%) | 100% | - / 1% (-) | 0.10 | 0.00 / 0.24 | 505 | 16.3 · 41.4 | 0 of 0 / 0 of 200 (29 of 200) |
| W | - / 94% (- / 86%) | 99% | - / 1% (-) | 0.29 | 0.00 / 0.21 | 761 | 14.2 · 30.7 | 0 of 0 / 0 of 200 (18 of 200) |

**Who holds the bosses, set 777001** (Skilled, pooled over the four bosses: share of boss time on each hero)

| Party | kael | lyra | vexis | brann | seren | oro | sapling | ancient |
|---|---|---|---|---|---|---|---|---|
| default | 47% | 49% | 3% |  |  |  |  |  |
| SA | 52% |  | 48% |  | 0% |  |  |  |
| SB |  | 3% | 0% |  | 96% |  |  |  |
| SC | 40% | 59% |  |  | 0% |  |  |  |
| OA | 59% |  | 40% |  |  | 1% |  |  |
| OB |  | 97% | 2% |  |  | 1% |  |  |
| OC | 44% | 55% |  |  |  | 0% |  |  |
| R | 84% |  |  | 13% | 1% |  |  |  |
| SO | 93% |  |  |  | 5% | 2% |  |  |
| X |  |  |  | 2% | 97% | 1% |  |  |
| W |  |  | 2% |  | 98% | 1% |  |  |

**Interrupts in W against the default party** (Skilled: Mirror Wards interrupted a fight at the Unweaver; the Conductor's mirror-choir Solo cues interrupted, of those cued)

| Set | default: Mirror Wards interrupted · Solo cues interrupted | W |
|---|---|---|
| 1000 | 1.86 · 42% (242/574) | 7.22 · 47% (345/739) |
| 500003 | 1.80 · 44% (254/576) | 7.28 · 47% (339/727) |
| 777001 | 1.76 · 46% (263/570) | 7.20 · 46% (337/729) |


#### Callings at the Conductor (SC and OC), the Anchor, the Decree gate, the smoke and pacing

**Callings** (`callings.ts --cells --movement 4 --party`, Skilled, 50 seeds; band ≥ 75% each, length ≤ none + 40 s):

| Party | Set | none | Luminary | Martyr | Chronomancer + Paradox | Chronomancer + Eternal Moment |
|---|---|---|---|---|---|---|
| SC | 1000 | 100% · 204 s | 100% · −32 s | 100% · −3 s | 100% · −20 s | 100% · −25 s |
| SC | 500003 | 100% · 204 s | 100% · −26 s | 100% · −8 s | 98% · −26 s | 98% · −29 s |
| SC | 777001 | 96% · 195 s | 98% · −16 s | 100% · +10 s | 100% · −14 s | 100% · −16 s |
| OC | 1000 | 100% · 209 s | 98% · −16 s | 100% · +5 s | 100% · −5 s | 100% · −9 s |
| OC | 500003 | 96% · 203 s | 100% · −17 s | 100% · +10 s | 100% · +5 s | 100% · +3 s |
| OC | 777001 | 98% · 214 s | 100% · −25 s | 100% · +2 s | 100% · −7 s | 100% · −8 s |

Met on all three sets. **Anchor** (reported; the Reel variant, `verbs.ts --techniques anchor`, 50 seeds from 1000): SC 100% (210 s, 0.16 downs), OC 100% (231 s, 0.24), the default party 100% (180 s, 0.08).

**The Decree gate** (`decrees.ts --party`, Skilled, 50 seeds from 1000, real casts; each cell: casts over the 50 fights (answered); ⚠ under default − 10%)

| Boss | Decree | default | SA | SB | SC | OA | OB | OC | W |
|---|---|---|---|---|---|---|---|---|---|
| Vharun | Twin Cleave | 448 (91%) | 841 (88%) | 485 (72%) | 544 (94%) | 831 (89%) | 415 (82%) | 533 (95%) | 712 (84%) |
| Vharun | Bloodmoon | 240 (100%) | 443 (98%) | 243 (95%) | 295 (99%) | 419 (99%) | 255 (98%) | 287 (100%) | 340 (96%) |
| Vharun | Crimson Tide | 187 (100%) | 360 (98%) | 191 (93%) | 232 (99%) | 330 (97%) | 193 (95%) | 221 (98%) | 268 (94%) |
| Vharun | Execution | 152 (99%) | 312 (97%) | 157 (98%) | 193 (99%) | 282 (99%) | 156 (98%) | 179 (99%) | 224 (99%) |
| Vharun | *won* | 98% | 94% | 92% | 98% | 94% | 96% | 98% | 88% |
| the Unweaver | Shear | 529 (99%) | 1119 (98%) | 653 (98%) | 693 (99%) | 1247 (98%) | 306 (89%) ⚠ | 511 (100%) | 1190 (98%) |
| the Unweaver | Snip | 558 (95%) | 985 (92%) | 572 (91%) | 642 (96%) | 1127 (82%) | 636 (87%) | 678 (88%) | 1044 (87%) |
| the Unweaver | Spindles | 101 (100%) | 150 (100%) | 100 (100%) | 100 (100%) | 173 (100%) | 101 (100%) | 100 (100%) | 153 (100%) |
| the Unweaver | Steal Verse | 57 (95%) | 100 (99%) | 51 (100%) ⚠ | 83 (95%) | 100 (100%) | 65 (91%) | 77 (92%) | 100 (100%) |
| the Unweaver | Unravel | 128 (100%) | 203 (100%) | 115 (100%) ⚠ | 151 (100%) | 222 (100%) | 142 (100%) | 156 (100%) | 206 (100%) |
| the Unweaver | Mirror Weave | 205 (98%) | 350 (100%) | 223 (97%) | 239 (100%) | 391 (70%) | 205 (89%) | 234 (98%) | 370 (99%) |
| the Unweaver | *won* | 100% | 100% | 90% | 100% | 100% | 98% | 100% | 98% |
| the Conductor | Lament | 130 (100%) | 189 (81%) | 113 (100%) ⚠ | 165 (99%) | 238 (99%) | 139 (96%) | 218 (100%) | 217 (99%) |
| the Conductor | Basso Ostinato | 121 (99%) | 177 (99%) | 106 (100%) ⚠ | 144 (98%) | 172 (98%) | 124 (98%) | 160 (98%) | 162 (99%) |
| the Conductor | Cadenza | 78 (97%) | 112 (100%) | 98 (96%) | 129 (100%) | 123 (94%) | 91 (93%) | 110 (95%) | 130 (95%) |
| the Conductor | Shatter Aria | 121 (100%) | 134 (99%) | 102 (100%) ⚠ | 144 (97%) | 141 (96%) | 102 (96%) ⚠ | 118 (100%) | 128 (99%) |
| the Conductor | Fortissimo Silence | 50 (98%) | 54 (100%) | 50 (94%) | 62 (100%) | 62 (98%) | 50 (92%) | 57 (100%) | 53 (96%) |
| the Conductor | Grand Silence | 48 (100%) | 50 (100%) | 48 (100%) | 50 (100%) | 50 (100%) | 49 (100%) | 50 (100%) | 48 (100%) |
| the Conductor | *won* | 96% | 100% | 96% | 100% | 100% | 98% | 100% | 96% |

The gate holds wherever the fight lasts at least as long as the default party's. It misses where the party wins faster or the Decree's shape finds fewer targets: **SB** at the Unweaver (Steal Verse 51 against 57, Unravel 115 against 128) and the Conductor (Lament 113 / 130, Basso Ostinato 106 / 121, Shatter Aria 102 / 121), where its fights are 9-17% shorter than the default party's; **OB** at the Unweaver's Shear (306 against 529: a cone on the boss's current target, which in OB is Lyra at range most of the fight) and the Conductor's Shatter Aria (102 / 121). Every Decree is still met and answered 72-100% of the time.

**The unbanded sweep** (24 Skilled Finale-route runs from 2000; the default party 71%): A 79%, B 67%, C 79% (Brann's parties, pinned), LBO 67% (−4), LBS 58% (−12), VBO 58% (−12), VBS 42% (−29), LSO 25% (−46), KBO 8% (−62). The outliers are the parties with one starter beside two of Brann, Seren and Oro (KBO, LSO), like SO and X.

**Pacing.** The default party's numbers are identical by construction: no default-party code path moved (all 22 baseline checks byte-equal, the 19 goldens unchanged), and its rows in every table here are the same tool's default rows (Skilled reached the Finale on 333003: 67%, the 5d edge figure). `tools/pacing.ts --route expedition` (12 players, 3 hours, the Novice, from 9001) prints the same output on this tree as on `65f8748` (below, *the pins*). The Seren and Oro parties' Skilled Expedition minutes are in *Whole runs* above: over the soft default + 3 in OA (+8) and OC (+3.4 to +4.6), and W on one set.

### Bands after round 1, and what needs you

| Band | Round 1 (three sets) | Status |
|---|---|---|
| Bosses, SA ≥ default − 5 | −2 / −4 / +0 / +4; +8 / −4 / −2 / +4; +8 / +8 / +2 / −4 | **met** (prep: Vharun −8) |
| Bosses, SC ≥ default − 5 | Cantor −10 / −12 / −18; the rest −4 to +8 | missed at the Cantor only (prep −21) |
| Bosses, OA ≥ default − 5 | Vharun −8 on 500003; the rest −4 to +8 | seed-sensitive 2 of 3 |
| Bosses, OC ≥ default − 5 | −2 to +10 | **met** |
| Bosses, SB ≥ default − 15 | −10 to +8 | **met** |
| Bosses, OB ≥ default − 25 (provisional) | −8 to +8 | **met** |
| Bosses, reduced vs −15 | W −10 to +6 (met); X Vharun −18 / −18 / −10 (1 of 3); R Vharun −40 to −60; SO −46 to −92 at three bosses | printed |
| Road, SA / SB / SC / OA / OC ≥ default − 5 | cells past it: SA 13 / 8 / 8, SB 4 / 4 / 5, SC 6 / 6 / 6, OA 6 / 5 / 5, OC 2 / 3 / 3 of 23 | missed |
| Road, OB ≥ default − 10 (provisional) | 1 / 1 / 0 of 23 (the Frayed Court −14 on 1000, the Seamstress −12 on 500003) | seed-sensitive 1 of 3 |
| Skilled share | road ≥ 38%, bosses ≥ 37% everywhere | **met** |
| Skilled length (cells ≤ default + 15%; the Conductor 170-280 s) | SA 19, SC 6-9, OA 26-27, OC 18-19 cells over; the Conductor 195-239 s; SB and OB ≤ 166 s at the Conductor | missed (×A ×C); met (SB, OB) |
| Novice at bosses ≤ Skilled; SB ≥ 10% | every cell; SB 20-82% | **met** for the half read here. *Corrected in W9 round 3:* the band's first half, 'inside each Movement's 5b/5c/5d Novice row' (Cantor 25-70%, Vharun 20-60%, the Unweaver 25-55%, the Conductor 15-40%), was not read: SA, SC, OA and OC miss it on every set (round 3 prints it); OB's Novice is 'recorded' |
| Idle at bosses | 0% everywhere | **met** |
| Whole Prelude, Skilled | SB +6 / +6 / +9, OB −7 / −6 / −5 (met); SA −29 to −31, SC −12 to −22, OA −8 to −14, OC −6 to −9 | met for SB and OB; missed for the rest |
| Whole Prelude, Novice ≥ 50% of default | SA 4-8%, SC 12-18%, OA 12-16%, OC 5-10% against 32-38% | missed |
| Whole Expedition, SB ≥ default − 10 | −9 / −7 / −10 | **met** (prep −24 / −8 at 50 runs) |
| Whole Expedition, OB ≥ default − 20 (provisional) | −16 / −12 / −15 | **met** (prep −26 / −24) |
| Whole Expedition, OC ≥ default − 5 and ≥ 55% | 70% (−2) / 72% (+4) / 73% (+7) | **met** |
| Whole Expedition, OA | 56% (−16) / 52% (−16) / 48% (−17) | missed |
| Whole Expedition, SC | 50% (−22) / 44% (−24) / 50% (−16) | missed |
| Whole Expedition, SA | 30% (−42) / 31% (−37) / 33% (−32) | missed |
| Whole Expedition, reduced vs −15 | W −34 / −31 / −25, X −68 / −61 / −60, R −64 to −70, SO −66 to −72 | printed |
| Weaver safety (Oro parties) | bosses: OA 940-988 against 509-543 (+15%: 585-624), OB 596-677, OC 646-658; downs OA 2.02-2.15, OB 1.29-1.51, OC 1.27-1.34 against 1.06-1.15 | missed (OB's damage is inside on 500003 only) |
| Thread cuts, Movement III (Oro parties) | OA 2.12-2.21, OB 1.29-1.36, OC 1.50-1.65 against 1.00-1.06 (+25%: 1.25-1.33) | missed (OB by 0.03-0.11) |
| Callings at the Conductor (SC, OC) | 96-100% each | **met**; Anchor 100% |
| Bond XP a fight ≥ 75% of the starters' | Seren 61-74%, Oro 64-71% (SO's Seren 81%) | missed |
| Decree gate | SB 5 Decrees and OB 2 under default − 10% (shorter fights, or Lyra out of the Shear's cone); every other party met | missed for SB and OB |
| Seren: ≥ 50% of the Wards on her parry | road SB 60-61%, SC 52-54%, SA 47-49%; bosses SB 58-59%, W 55%, X 59-60%; SA, SC, R, SO 5-16% at bosses | met where she holds the boss and on SB's and SC's road; SA's road 1-3 points short |
| Seren: counters and kill shots 20-40% of her damage (skirmishes and elites) | SA 8%, SB 11-12%, SC 8-9% | missed |
| Seren: kill shots ≥ 0.5 a fight (elite and boss cells), the Novice ≤ a third | SA 0.50-0.55 (Novice 0.05-0.07), SB 1.21-1.34 (0.48-0.55), SC 0.29-0.32, W 2.67-2.75 (1.18-1.25), X 2.94-3.00 (0.85-0.94) | met for SA and X; SC too few; SB's and W's Novice over a third |
| Seren: beyond 14 m ≤ 2%; overextensions answered ≤ 3 s ≥ 50%; Showboat pick ≥ 60% | 0%; 64-86%; 69-100% | **met** |
| Seren: downs ≤ 0.3 a fight | road 0.09-0.15; bosses SA 0.17-0.24, SC 0.23-0.27, SB 0.38-0.41, W 0.58-0.65, X 0.85-1.12 | met for SA and SC; missed where she holds the boss |
| Seren: Skilled parries ≥ 2× the Novice's | at bosses the Novice parries more (SB 16 against 8 a fight): her `serenWard` Wards Seren whenever she is engaged | missed |
| Seren: W's interrupts ≥ the default's rate − 10 | Solo cues interrupted at the Conductor 46-47% against 42-46%; Mirror Wards interrupted 7.2 a fight against 1.8 (the Mirror Weave answered 99% against 98%) | **met** |
| Kael holds bosses ≥ 70% (SA, SC) | SA 51-52%, SC 39-41%; the default party's Kael 45-47% | **NEEDS USER** (prep) |
| Oro: Saplings in your field ≥ 60% | OA and OC 92-93%, OB road 86-87%, OB bosses 59 / 60 / 59% | met but OB at its bosses (1 of 3: 59, 60, 59) |
| Oro: the Novice ≥ 15 points lower | road OA and OC 15-16 points (met), OB 7; bosses 7-8 (OA, OC), −11 in OB (the Novice higher) | met on the road for OA and OC only |
| Oro: both standing ≥ 60%; downs ≤ 0.3; timeouts ≤ 1% | 95-97%; 0.04-0.26; Skilled timeouts 0 for OA, OB and OC (*corrected in round 2*: round 1 counted a timeout only at ≥ 539.9 s, but recorded durations stop near 536 s, so it always printed 0; counted by outcome, SO's Skilled bosses time out 18-24 of 200, 9-12%, and the Novice's OA and OC bosses 10-19 of 200) | met for OA, OB, OC; SO missed |
| Oro: tending ≤ 25% (Skilled) | road OA 41%, OB 52-53%, OC 51%; bosses 1-2% (*corrected in round 2*: round 1 printed 24 / 34 / 32%, a pool over road and bosses that the long boss fights dilute) | missed on the road for all three |
| Boss seconds on a summon | 0-2% (bossTarget's `oro` share is Oro himself; `sapling` and `ancient` 0) | **met** |
| Default party and Brann parties A, B, C | the 22 baseline checks byte-equal; the 19 goldens unchanged | **identical** |

**What round 1 says.** Every number that moves Seren's or Oro's parties is a damage or a hold number, and the round took the two that paid to their edges (Seren's attack, the Saplings' life, cadence and spot). It met SB's, OB's and OC's whole runs on all three sets, SA's, OC's, SB's and OB's bosses, and both Prelude bands for SB and OB. What is left is the road for the parties that drop Lyra or Vexis: Lyra deals about three times Seren's or Oro's damage on the road (measured on the prep tree, 12 seeds: the Muted Nave 222 a second against Seren's 67 in SA; the Frayed Court 347 against 101), so in SA (no Lyra) the Bell Brutes live longer and Toll-Cleave Kael more (48 Toll Cleaves on him over 24 Muted Nave fights against the default party's 19; OA 63), and their fights run 30-80% longer. ±20% on Seren's or Oro's damage closes about a sixth of that gap. SC's Cantor is the same story at a boss: Kael dies to his own Toll (16 seeds on the tuned tree: the Weaver's Wards go 5.6 a fight to Seren against 3.9 to Vexis in the default party, and Kael's 6.1 against 7.0).

**Round 2 leads (not built):** `groveCover` off for OA on the road (+3 points over 25 cells, OA only; it pays at the bosses); a `serenCall` guard against a Toll due on Kael (SC's Cantor); the Novice's `serenWard` (at bosses it out-parries the Skilled bot, so the Novice-skill-gap band reads backwards); Oro's `oroFocus` crowd guard on the road (tending 32-35% in OB and OC).

**NEEDS USER.**
1. *Default taken, awaiting your confirmation:* with no Kael, Seren holds the bosses by threat (`DUEL_BOSS_THREAT` ×6, lever 2; lever 1 cannot: `threatMult` 1.2 put the boss on her 0-18% of the time). Confirm, or say how else you want it.
2. *Kael holds bosses ≥ 70% in SA and SC* is above the default party's own Kael (45-47%). Only Kael's or Lyra's numbers could reach it, and they are never moved. Restate it against the default party's share (SA 51-52% would meet it; SC 39-41% is −6), or accept it as missed.
3. *OB (Q8):* the measurements confirm both provisional bands. Bosses −8 to +8 against −25 and whole runs −16 / −12 / −15 against −20, on all three sets; the road −10 band is missed by one cell on two sets. Recommendation: keep both, and make them final. The *Heartwood* alternative is a Quirk change: not built, not needed by these numbers, and yours to decide.
4. *SA, SC and OA's whole runs and road (≥ default − 5)* cannot be reached with the allowed levers: the gap is the dropped starter's damage (about 3 : 1 on the road), and ±20% of Seren's or Oro's own numbers closes about a sixth of it. Reaching it needs one of: a wider lever-1 rule for their damage (beyond ±20%: a design change to Seren and Oro), a restated band for parties without Lyra or Vexis (as SB and OB have), or starter, enemy or road numbers, which are never moved.
5. *The Weaver-safety and Thread-cut bands for Oro parties* and *the length band* read the same damage gap (longer fights, more hits on the Weaver and more Severing swings at the Thread). The same choice as item 4.
6. *Bond XP ≥ 75% of the starters'* (Seren 61-74%, Oro 64-71%) is lever 4 territory; no Bond value moved this round.

### The pins and the tests (round 1)

- All 22 baseline checks are byte-equal: `m1-baseline --check` for Movements 1-4, `--movement N --party P --check` for N 1-4 and P A, B, C, and `expedition-baseline --check` at 2, 3 and 4 Movements and at 4 for A, B and C. The `update-golden` dry run says ‘Goldens are up to date’ after the `--write`.
- `tools/pacing.ts --route expedition` prints byte-identical output on this tree and on `65f8748` (the default party's pacing is untouched).
- The 19 original goldens are byte-identical; `SIM_VERSION` is 22. Re-recorded: `skilled-seren-crimson-gate` `e0c67ed50ac55818` → `8a2255440dd4690e`, `novice-seren-first-light` `0938c093f5e660cc` → `64fc18df79b0fad1`, `skilled-oro-bellwarden` `dd3b483ebd1baa3c` → `f3eec5fbf3a4472e`, `skilled-red-line-vharun` `fe0a62722e1c72e0` → `7cb1ccd3bf32f746`, `skilled-oro-conductor` `dc1907360738bfe2` → `f254a5511c85b4d7`, `novice-grove-mirror-hall` `46528039e77c2217` → `3c1d02049ef29ef6` (their `ROSTER_HASHES` literals with them).
- Tests that state the four tuned numbers now state the new ones: `rosterContracts` (Seren's attack 72; the Sapling's 456 life and 4 m spot), `grove` (4 m ahead; 456, 342 with Seedling Swarm, 638 with Taproot, 684 with Old Growth; Regrowth's 40% of 456), `groveAuras` (Sostenuto 1.5% of 456, Ostinato 12% of 456), `review5eSim` (the Silent Verse front spot is 4.7 m out, still outside her 3.6 m circle), `serenParry` (the counter 3 × 72 = 216, the kill shot 6 × 72 = 432), `serenSolo` (Blade Waltz counters at 150% of 72) and `uiPhase5e` (‘2 Saplings · 456 life’).
- **One assertion relaxed, for one party:** `tests/bots/roster20.test.ts` checks that all 20 parties end Skilled Vharun on seed 1000 inside the 540 s cap. SO (Kael, Seren, Oro) now carries that seed to the cap in the test's loadout (a loss either way: the Skilled SO wins Vharun 2-14% of the time (its Novice 34-40%)). It is the damage-light reduced party the bands print; the test still plays it to the cap, deterministically, and keeps the check for the other 19 parties and every other fight.

## W9 tuning round 2 (2026-11-09): lever 2 and lever 3, then the bands on three sets

*Branch `m5/tune` from round 1 (`faaec4e`). In the agreed lever order: lever 1 was exhausted in round 1 (every Seren and Oro number at its ±20% edge or range edge, alone and combined; only the four kept moved a party), so this round screened one hero-only targeting rule (lever 2, `duel.ts`) and hero-only bot rules after the round-1 ablation (lever 3, `skilled.ts`, `novice.ts`). No lever-1 number, Bond or motif value (lever 4) moved. Never moved: Weaver, aura, enemy, encounter, Movement, road, starter and Brann numbers, and no aura definition, number, list or reach. Every existing fight is unchanged: the 19 original goldens are byte-identical, `SIM_VERSION` is 22, `contentVersion` is unchanged (`c-90f2f93ff5775748`: no content moved), all 22 baseline checks are byte-equal, and the one Seren or Oro golden that moved, `skilled-oro-conductor`, is re-recorded with its `ROSTER_HASHES` literal. Tuned on cells 1000 and 500003 and runs 2000 and 900007; cells 777001 and runs 333003 were first read at the final measurement.*

Raw outputs and scripts: scratch `m5e/tune2/` (`raw/`: the screen `r1-*` (round 1's tree, byte-identical to round 1's `s_atk72`/`o_c2` rows), `v_*` (one variant each), the boss checks `b*-*`, the run checks `cruns-*`/`c2runs-*`/`c3runs-*`, the final `fin-*`, the Sentinel-guard re-run `fx-*` merged into `fin-*` (originals in `raw/c2/`), `call-*`, `anchor-*`, `dec-*`, `pacing-default`; `scripts/`: `scr.py` (the screen), `bcmp.py` (boss cells against round 1's), `bands.py`, `own.py` (fixed, below), `merge.py`, and the diagnostics `diag3-7.ts`).

### What changed (every rule; no number moved)

| File | Rule | Old → new | Lever | Why |
|---|---|---|---|---|
| `src/sim/systems/duel.ts` | Showboat's pick (`duelTarget`, new `peelsOffKael`) | With Kael in the party, an enemy swinging at Kael was Kael's → **in a boss fight, a normal or elite enemy swinging at Kael that is not his own target is hers**; the boss, minibosses and Kael's own target stay his; off boss fights unchanged | 2 | SC's Cantor (−10 / −12 / −18 in round 1). Kael died to his own Toll because he went into it low: at the Cantor (50 seeds from 1000) SC's Kael took 4,814 Chorister damage a fight against the default party's 2,413, and stood at 57% of his life at a Toll's start (median) against 79%; Seren duelled the boss 88% of the time and the Choristers on Kael 0.2%. With the rule SC's Cantor goes 86 → 88% (1000) and 78 → 96% (500003), Kael's boss share there 63-66 → 78-82%, and the Weaver's damage at it 663-682 → 220-293. |
| `src/bots/skilled.ts` | `groveCover` (new `groveCovers`) | Saplings always weighed into the Weaver's spot → **not in a fight with no boss and a tank in the party** | 3 | Round 1's lead. On the road Kael holds the pack, and the Weaver drawn out toward the grove drew it onto herself (screen: OA −3.2 → −0.2 a cell, the Weaver's road damage 396 → 347). At bosses (where the ablation had it paying) and with no tank (OB, W, X) as before. |
| `src/bots/skilled.ts` | `oroThread` (new `lineCutterUp`) | → **never while an enemy with a `threadLine` special stands** (Movement III's Shears) | 3 | Thread cuts (Oro parties, Movement III). The Thread run back to Oro is the line a Shears dash aims through; the Saplings' Mend can wait (screen: cuts a fight OB 1.40 → 1.09, OC 1.56 → 1.46, OA 1.99 → 1.90, no win lost). |
| `src/bots/skilled.ts` | `oroFocus` (`ORO_FOCUS_AT`) | crowd guard 3 → **none** (`Infinity`), **keeping the Sentinel's crowd guard**: a guarded Crimson Sentinel is never his Focus while more than `SENTINEL_FOCUS_AT` (3) stand | 3 | Oro's tending band (≤ 25%): behind the guard he tended 41-53% of the road (round 2's corrected count). Lifted, road tending falls to 19 / 34 / 30% (OA / OB / OC) and the screen rises (OA → +0.6 a cell with the other two rules). The Sentinel exception came from the final measurement: lifted for every enemy, Shield Wall fell (OC 100 → 68-80%, OB 96-98 → 86-92%) because the party was Focused into the Sentinel's front; with the exception it is back to 96-100% on every set. |
| tests | `bots.test.ts` (`oroFocus` ×2, `groveCover`, a new `oroThread` case), `rosterContracts.test.ts` (a new `duelTarget` case) | state the four rules | — | |
| `tests/sim/golden.json`, `m1Unchanged.test.ts` | `skilled-oro-conductor` | `f254a5511c85b4d7` → `178ad349e9fd3c8a` (`update-golden --write`) | — | the only golden the rules reach; the 19 originals and the other five Seren and Oro goldens byte-identical |

### Seren holds the Kael-less bosses (default, awaiting your confirmation)

Unchanged from round 1, and still **lever 2, not lever 1**: `threatMult` at its +20% edge (1.2) put SB's bosses on her 0-3% of the time and W's 5-18%, so the prep's `duelThreat` (`DUEL_BOSS_THREAT` ×6, inert unless Seren is in the party and Kael is not) stands. Final, every boss and set: the boss is on her 95-96% of boss time pooled in SB, 98% in W and 96-97% in X. The *By party* X row now says so (it read 'threat (Brann 1.2, Seren parries)', which the rule makes Seren's). **The knock-on, a trade-off this default buys:** holding the bosses, her boss downs are 0.38-0.41 a fight in SB, 0.57-0.65 in W and 0.85-1.14 in X (her band ≤ 0.3; 0.18-0.29 in SA and SC, where Kael holds), and her kill shots lost (disabled or silenced) are 0.11 a fight in SB and 0.69-0.75 in W and X, against 0.00 in SA and SC. `serenReel` at 0.7 of her life (from 0.6) did not move either (below).

### How the round chose them

**1. Diagnosis first** (scratch `diag3-7.ts`, 50 seeds from 1000):
- *SC's Cantor.* Every Toll that downed Kael landed unWarded with no Ward charge left at its start, in the default party (49 of 535 Tolls) and in SC (113 of 501). The Ward economy is not the difference (the Weaver Wards the Dirge on Seren 3.5 a fight against 3.0 on Vexis); Kael's life is: the Choristers on him live longer without Vexis, and Seren, told to leave enemies on Kael alone, duelled the boss beside him.
- *Oro's tending.* Counted on the road alone, Skilled Oro tended 41% (OA), 53% (OB) and 51% (OC) of his time: `oroFocus`'s crowd guard (3) left him tending in every pack.
- *Thread cuts.* Per minute, Oro parties are cut 1.0-1.17 times against 0.85-0.92 (default, SA, SB, SC): most cuts are Shears dashes through the Thread (`threadLine`), and `oroThread` runs it back to Oro, behind the party.
- *The Weaver's damage* in Oro parties comes from enemies aimed at her (Choristers, Glass Lancers, Null Priests), as in SA and SC: the longer fights, not the Saplings' healing threat alone.

**2. The screen** (each rule alone, then combined; Skilled, the 25 cells of round 1's screen (every road cell, the Cantor and Vharun), 24 seeds on each of 1000 and 500003, pooled to 48. Each entry: mean gap to the default party over the 25 cells / cells past the band, then the road's downs, the Weaver's road damage, Movement III Thread cuts a fight, and Oro's road tending.)

| Lever | Change | SA | SB | SC | OA | OB | OC | Kept |
|---|---|---|---|---|---|---|---|---|
| — | none (round 1's tree, `r1`) | −8.0 / 10 | −0.9 / 3 | −1.8 / 3 | −3.2 / 5 · 396 · 1.99 · 41% | +0.5 / 1 · 312 · 1.40 · 53% | +0.8 / 1 · 312 · 1.56 · 51% | |
| 2 | Seren peels the adds off Kael, every fight (`peel1`) | −7.4 / 10 | −0.9 / 3 (inert) | −1.5 / 4 | | | | no: no better than in boss fights only, and a wider change |
| 2 | **Seren peels the adds off Kael, boss fights only** (`peel2`) | −8.0 / 10 | inert | −1.7 / 3; SC's boss Weaver damage 1,114 → 914 | | | | **kept** |
| 3 | `serenParryWard`, `serenPerfectFirst` and her Call keep the last Ward charge while the boss's next blow on another hero is due before a charge comes back (`toll`) | −8.3 / 10 | inert | −2.0 / 4; bosses 94.8 → 91.7% | | | | no: worse |
| 3 | `oroFocus` crowd guard 3 → 6 (`fa6`) | | | | −2.6 / 5 · 433 · 1.87 · 31% | +0.2 / 0 · 312 · 1.38 · 43% | +0.3 / 1 · 375 · 1.58 · 40% | in the kept set (as no guard) |
| 3 | `groveCover` off on the road with a tank (`gcr`) | | | | −0.2 / 4 · 347 · 1.79 · 39% | inert | +0.1 / 2 · 330 · 1.55 · 53% | in the kept set |
| 3 | `oroThread` off while a Thread-cutter stands (`tg`) | | | | −3.2 / 5 · 391 · 1.90 · 41% | +0.8 / 0 · 289 · 1.09 · 53% | +0.7 / 2 · 301 · 1.46 · 51% | in the kept set |
| 3 | `gcr` + `tg` + guard 6 (`c1`) | | | | −1.0 / 3 · 397 · 1.76 · 29% | +0.6 / 0 · 285 · 1.19 · 42% | +0.4 / 1 · 346 · 1.44 · 41% | no |
| 3 | **`gcr` + `tg` + no guard (`c2`)** | | | | **+0.6 / 1** · 419 · 1.69 · 19% | **+0.8 / 0** · 289 · 1.32 · 34% | **+0.3 / 1** · 371 · 1.39 · 30% | **kept** (plus the Sentinel exception, below) |
| 3 | `gcr` + `tg`, guard 3 (`c3`) | | | | −1.2 / 5 · 347 · 1.72 · 39% | +0.8 / 0 · 289 · 1.09 · 53% | +0.9 / 1 · 316 · 1.43 · 53% | no: OA, and tending unmoved |

**3. Checked at every boss** (50 seeds on 1000 and 500003, against round 1's final rows on the same seeds): `peel2` holds SA and SC at the Unweaver, Vharun and the Conductor within ±6 and lifts the Cantor (SC 86 → 88, 78 → 96; SA 94 → 98, 98 → 96); `c2` moves no Oro boss cell by more than ±6 (OA's Conductor 100 → 94 on 1000, 92 → 98 on 500003).

**4. Checked on whole runs** (100 Finale-route runs on each of 2000 and 900007, the first 100 of the 200-run sets; round 1's rows on the same seeds): SC 53 → 66 and 48 → 53; OA 67 → 66 and 52 → 66 (`c2`) against 67 → 70 and 52 → 66 (`c3`); OB 54 → 60 and 53 → 57 (`c2`) against 58 and 59 (`c3`); OC 76 → 70 and 71 → 77 (`c2`) against 73 and 69 (`c3`). Pooled, `c2` and `c3` tie on wins (OA 132 / 136, OB 117 / 117, OC 147 / 142 of 200); `c2` was kept for the tending band and the shorter OA Expeditions (28-29 min against 30).

**5. The Sentinel exception** (found in the final measurement, on all three sets alike, so not a third-set tuning): with the crowd guard lifted for every enemy, OC's Shield Wall fell to 74 / 80 / 68% and OB's to 92 / 86 / 88% (round 1: 100 / 100 / 100 and 98 / 96 / 98): Kael's target there is often the Crimson Sentinel, and the Focus sent the party into its front. `oroFocus` now keeps `SENTINEL_FOCUS_AT` (3) for a guarded Sentinel, as the plain Focus rule does: Shield Wall 100 / 96 / 100 (OC) and 98 / 100 / 98 (OB), Pike Line and Crimson Gate unchanged at 100. Every cell and run the exception can reach (Movement II's road and Vharun for the Oro parties, and their whole runs) was re-played on the final tree and merged into the final tables (`fx-*`); no other cell has a Sentinel.

### Tried and not kept (round 2)

| Lever | Change | Where measured | Result | Why not kept |
|---|---|---|---|---|
| 2 | Seren peels the adds off Kael in every fight, not only boss fights | screen | SA −8.0 → −7.4, SC −1.8 → −1.5 (4 cells past against 3) | inside noise; a wider change to Showboat than the boss fights need |
| 3 | Seren's Wards keep the last charge while the boss's next blow on another hero is due (the round-1 lead for SC's Cantor) | screen, SA and SC | SA −8.3, SC −2.0; their boss cells 96.9 → 92.7 and 94.8 → 91.7%; kill shots at bosses halved | worse: Kael's deaths were his life, not the Ward charge |
| 3 | `serenParryWard` lets a plain boss swing take the last charge when no boss special is due before a charge returns | 50 seeds from 1000, SB, W, X bosses | moves only the Conductor (parries 6.5 → 7.2, 8.1 → 9.4, 9.3 → 11.7); every other boss byte-identical; wins ±4 | no gain; the parry ratio band stays inverted |
| 3 | `serenReel` at 0.7 of her life (from 0.6) | 50 seeds from 1000, SB, W, X bosses | wins unchanged; her boss downs ±0.04 | no effect on her downs |
| 3 | Novice `serenWard` draw 0.3 → 0.15, → 0.08 | 50 seeds from 1000, Novice, SA, SB, SC, W, X bosses | the Novice's boss parries fall only 10-25% (SB's Unweaver 38.7 → 36.8 → 31.0 against the Skilled bot's 15.7), and its wins move ±20 points either way (SB's Unweaver 20 → 40 → 42%) | does not restore the Skilled ≥ 2× Novice parry ratio; it moves the Novice rows instead |
| 3 | Novice `serenWard` only while the boss is on her (boss fights) | as above | parries ±10%; SB Vharun Novice 82 → 70% | the same |
| 3 | `oroFocus` crowd guard 3 → 6 | screen | OA −2.6, OB +0.2, OC +0.3; road tending 31 / 43 / 40% | tending still past 25%; no guard better |
| 3 | `groveCover` + `oroThread` guard, crowd guard kept at 3 | screen; 100 runs on 2000 and 900007 | OA −1.2, OB +0.8, OC +0.9; runs tie with the kept set | road tending unmoved (39-53%); OA's Expedition 30 min |
| 3 | `oroRally` re-plants through the boss guard while the Silent Verse stands (OB's in-field share at the Cantor 31%) | 50 seeds on 1000 and 500003, the Cantor | OB's in-field share at the Cantor 31 → 65% and 34 → 61%, but its win 96 → 88% and 98 → 86% | costs OB's Cantor 8-12 points |
| 3 | `oroFocus` with no crowd guard at all (a Sentinel included) | the final measurement (merged out) | Shield Wall OC 74 / 80 / 68%, OB 92 / 86 / 88% | the Sentinel exception above |

### Round 1's tables, corrected

Round 1's verifier found two misreports in round 1's own-band summariser; both are fixed in scratch `own.py`, and round 1's three *Oro, set …* tables above are re-printed from round 1's own raw data with the fix (marked *corrected in W9 round 2*).
- **Timeouts.** It counted a timeout only at a duration ≥ 539.9 s, but recorded durations stop near 536 s (the intro is not counted), so it always printed 0. Counted by outcome: SO's Skilled bosses time out 24 / 20 / 18 of 200 (9-12%), R's 1-3, X's 1 (500003); the Novice's OA and OC bosses 10-19 of 200. OA, OB and OC's Skilled cells really are 0.
- **Tending.** It pooled tending over the road and the bosses, where Oro tends 1-2% of very long fights, so 24 / 34 / 32% hid a road of 41 / 53 / 51%. It is now printed road / bosses.
- The whole-run rows now carry one decimal (round 1 printed SB's 55.5% on 333003 as '56% (−10)': it is −10.0, on the band's edge), and the minutes.

### The final measurement (the full protocol, on the committed tree)

What ran (scratch `final{1,2,3}.sh`, one lane a set, never more than three heavy jobs at once), as in round 1:
- **Cells**, 50 seeds on each of 1000, 500003 and 777001: every boss (Idle, Novice, Skilled) for the default party and the ten banded parties; every skirmish, elite and miniboss cell of the three Movements' roads (Novice and Skilled) for the default party and the six full-protocol parties.
- **Whole runs**, 200 seeds on each of 2000, 900007 and 333003: Finale-route Expeditions (Skilled) for the eleven, whole Preludes (Novice and Skilled) for the seven.
- **The Sentinel re-run** (`refix{1,2,3}.sh`, `merge.py`): after the exception above, Movement II's road and Vharun for the Oro parties and their whole runs were played again on the final tree and replace those rows. The default party's rows in the re-run are byte-identical to the first pass (the merge asserts it); the Seren parties' rows are untouched (no Oro).
- Then the Callings, the Anchor, the Decree gate, the unbanded smoke and pacing (below).

**The bands, set by set** (met only on all three sets; otherwise seed-sensitive k of 3):

| Band | Party | set 1000 | set 500003 | set 777001 | Status |
|---|---|---|---|---|---|
| Road cells, Skilled ≥ default − 5 | SA | 13 of 23 past | 8 of 23 past | 8 of 23 past | missed |
| Road cells, Skilled ≥ default − 5 | SB | 4 of 23 past | 4 of 23 past | 5 of 23 past | missed |
| Road cells, Skilled ≥ default − 5 | SC | 6 of 23 past | 6 of 23 past | 6 of 23 past | missed |
| Road cells, Skilled ≥ default − 5 | OA | 1 of 23 past | 1 of 23 past | 1 of 23 past | missed |
| Road cells, Skilled ≥ default − 10 | OB | 0 of 23 past | 1 of 23 past | 0 of 23 past | seed-sensitive 2 of 3 |
| Road cells, Skilled ≥ default − 5 | OC | 0 of 23 past | 0 of 23 past | 0 of 23 past | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | SA | +2 / -4 / +0 / +4 | +6 / -4 / +0 / +2 | +4 / +8 / +2 / +0 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 | SB | +4 / -6 / -10 / +0 | +8 / -10 / -6 / +4 | +2 / +6 / -4 / +2 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | SC | -8 / +0 / -2 / +4 | +6 / -4 / -2 / +4 | +4 / +8 / +0 / +2 | seed-sensitive 2 of 3 |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | OA | +2 / -6 / +0 / -2 | +8 / -6 / +0 / +2 | +6 / -2 / +0 / +2 | seed-sensitive 1 of 3 |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 25 | OB | +0 / -2 / -2 / +2 | +8 / +0 / -4 / -2 | -6 / +8 / +2 / -8 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | OC | +0 / +0 / -2 / +2 | -2 / +0 / +0 / +4 | +2 / +10 / +2 / +0 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | R | -4 / -50 / -2 / -4 | +0 / -60 / -2 / +2 | +2 / -40 / +0 / +2 | missed |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | SO | -86 / -90 / -74 / +4 | -72 / -92 / -50 / -4 | -74 / -70 / -52 / +0 | missed |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | X | -6 / -18 / -6 / +2 | +8 / -18 / -2 / -2 | +4 / -10 / +2 / -2 | seed-sensitive 1 of 3 |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | W | +4 / -10 / -2 / +2 | +6 / -6 / -2 / +4 | +6 / +4 / +2 / +2 | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | SA | road min 38% · bosses min 42% | road min 38% · bosses min 42% | road min 38% · bosses min 41% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | SB | road min 39% · bosses min 41% | road min 38% · bosses min 41% | road min 39% · bosses min 41% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | SC | road min 43% · bosses min 43% | road min 44% · bosses min 43% | road min 42% · bosses min 43% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | OA | road min 41% · bosses min 44% | road min 41% · bosses min 44% | road min 40% · bosses min 45% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | OB | road min 45% · bosses min 38% | road min 45% · bosses min 37% | road min 45% · bosses min 37% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | OC | road min 49% · bosses min 46% | road min 49% · bosses min 46% | road min 49% · bosses min 46% | met |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | SA | 19 cells over +15% · Conductor 233 s | 19 cells over +15% · Conductor 225 s | 19 cells over +15% · Conductor 230 s | missed |
| Skilled length, ≤ 280 s at the Conductor | SB | Conductor 158 s | Conductor 158 s | Conductor 159 s | met |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | SC | 9 cells over +15% · Conductor 210 s | 8 cells over +15% · Conductor 211 s | 8 cells over +15% · Conductor 207 s | missed |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | OA | 26 cells over +15% · Conductor 234 s | 26 cells over +15% · Conductor 232 s | 25 cells over +15% · Conductor 239 s | missed |
| Skilled length, ≤ 280 s at the Conductor | OB | Conductor 167 s | Conductor 164 s | Conductor 158 s | met |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | OC | 21 cells over +15% · Conductor 209 s | 18 cells over +15% · Conductor 213 s | 21 cells over +15% · Conductor 213 s | missed |
| Idle at bosses 0% | SA | 0% | 0% | 0% | met |
| Idle at bosses 0% | SB | 0% | 0% | 0% | met |
| Idle at bosses 0% | SC | 0% | 0% | 0% | met |
| Idle at bosses 0% | OA | 0% | 0% | 0% | met |
| Idle at bosses 0% | OB | 0% | 0% | 0% | met |
| Idle at bosses 0% | OC | 0% | 0% | 0% | met |
| Idle at bosses 0% | R | 0% | 0% | 0% | met |
| Idle at bosses 0% | SO | 0% | 0% | 0% | met |
| Idle at bosses 0% | X | 0% | 0% | 0% | met |
| Idle at bosses 0% | W | 0% | 0% | 0% | met |
| Novice at bosses (%), ≤ Skilled | SA | 58 / 56 / 0 / 14 | 38 / 60 / 0 / 8 | 50 / 52 / 0 / 6 | met |
| Novice at bosses (%), ≤ Skilled; ≥ 10% | SB | 78 / 82 / 20 / 32 | 78 / 80 / 44 / 30 | 82 / 68 / 24 / 38 | met |
| Novice at bosses (%), ≤ Skilled | SC | 36 / 60 / 26 / 12 | 46 / 70 / 22 / 18 | 24 / 74 / 26 / 12 | met |
| Novice at bosses (%), ≤ Skilled | OA | 52 / 44 / 0 / 4 | 44 / 48 / 0 / 4 | 52 / 36 / 0 / 0 | met |
| Novice at bosses (%), ≤ Skilled | OB | 28 / 18 / 0 / 2 | 38 / 2 / 0 / 2 | 30 / 6 / 4 / 12 | met |
| Novice at bosses (%), ≤ Skilled | OC | 6 / 70 / 0 / 10 | 18 / 64 / 0 / 2 | 8 / 64 / 0 / 8 | met |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | SA | 58% (-30); Novice 6% (default 38%) | 62% (-26); Novice 10% (default 32%) | 54% (-32); Novice 8% (default 32%) | missed |
| Whole Prelude, Skilled ≥ default − 5 | SB | 94% (+6); Novice 65% (default 38%) | 94% (+6); Novice 68% (default 32%) | 96% (+9); Novice 66% (default 32%) | met |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | SC | 78% (-11); Novice 21% (default 38%) | 78% (-9); Novice 18% (default 32%) | 78% (-7); Novice 22% (default 32%) | missed |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | OA | 82% (-7); Novice 14% (default 38%) | 82% (-6); Novice 16% (default 32%) | 83% (-3); Novice 12% (default 32%) | missed |
| Whole Prelude, Skilled ≥ default − 10 | OB | 80% (-8); Novice 3% (default 38%) | 85% (-3); Novice 2% (default 32%) | 82% (-5); Novice 4% (default 32%) | met |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | OC | 84% (-4); Novice 10% (default 38%) | 84% (-3); Novice 5% (default 32%) | 86% (+0); Novice 8% (default 32%) | missed |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | SA | 27.5% (-44.5); reached 28.5%, won 96% of those; 18.3 min | 30.5% (-37.5); reached 30.5%, won 100% of those; 19.6 min | 32.0% (-33.5); reached 32.0%, won 100% of those; 18.8 min | missed |
| Whole Finale-route Expedition, won ≥ default − 10 | SB | 62.5% (-9.5); reached 64.5%, won 97% of those; 17.5 min | 61.0% (-7.0); reached 63.0%, won 97% of those; 17.4 min | 55.5% (-10.0); reached 57.0%, won 97% of those; 16.9 min | met |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | SC | 60.5% (-11.5); reached 61.0%, won 99% of those; 20.6 min | 49.5% (-18.5); reached 50.5%, won 98% of those; 18.1 min | 57.5% (-8.0); reached 57.5%, won 100% of those; 19.2 min | missed |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | OA | 67.5% (-4.5); reached 68.5%, won 99% of those; 29.4 min | 67.5% (-0.5); reached 71.0%, won 95% of those; 29.1 min | 66.0% (+0.5); reached 67.0%, won 99% of those; 29.0 min | met |
| Whole Finale-route Expedition, won ≥ default − 20 (provisional) | OB | 57.0% (-15.0); reached 59.0%, won 97% of those; 17.7 min | 61.0% (-7.0); reached 63.0%, won 97% of those; 18.1 min | 56.5% (-9.0); reached 59.5%, won 95% of those; 17.1 min | met |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | OC | 79.0% (+7.0); reached 81.0%, won 98% of those; 23.1 min | 82.0% (+14.0); reached 83.0%, won 99% of those; 23.6 min | 79.0% (+13.5); reached 80.5%, won 98% of those; 23.2 min | met |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | R | 2.0% (-70.0); reached 2.0%, won 100% of those; 14.9 min | 1.5% (-66.5); reached 1.5%, won 100% of those; 15.6 min | 0.5% (-65.0); reached 0.5%, won 100% of those; 13.9 min | missed |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | SO | 0.5% (-71.5); reached 0.5%, won 100% of those; 8.3 min | 0.0% (-68.0); reached 0.0%, won nan% of those; 9.9 min | 0.0% (-65.5); reached 0.0%, won nan% of those; 9.4 min | missed |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | X | 28.0% (-44.0); reached 28.5%, won 98% of those; 22.5 min | 20.5% (-47.5); reached 22.5%, won 91% of those; 21.6 min | 27.0% (-38.5); reached 27.0%, won 100% of those; 22.2 min | missed |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | W | 40.5% (-31.5); reached 41.0%, won 99% of those; 20.5 min | 45.0% (-23.0); reached 46.0%, won 98% of those; 22.5 min | 51.0% (-14.5); reached 51.0%, won 100% of those; 22.1 min | seed-sensitive 1 of 3 |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) | OA | bosses 966/2.12 (default 509/1.06); road 414/0.51 (261/0.27) | bosses 920/1.99 (default 543/1.15); road 421/0.53 (264/0.29) | bosses 995/2.18 (default 518/1.11); road 414/0.51 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) | OB | bosses 626/1.34 (default 509/1.06); road 277/0.30 (261/0.27) | bosses 596/1.28 (default 543/1.15); road 272/0.31 (264/0.29) | bosses 677/1.52 (default 518/1.11); road 291/0.35 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) | OC | bosses 609/1.30 (default 509/1.06); road 354/0.45 (261/0.27) | bosses 681/1.44 (default 543/1.15); road 359/0.44 (264/0.29) | bosses 612/1.20 (default 518/1.11); road 352/0.44 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) (printed) | SA | bosses 1029/2.14 (default 509/1.06); road 407/0.70 (261/0.27) | bosses 1006/2.00 (default 543/1.15); road 409/0.70 (264/0.29) | bosses 960/1.85 (default 518/1.11); road 413/0.69 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) (printed) | SB | bosses 524/1.18 (default 509/1.06); road 269/0.37 (261/0.27) | bosses 530/1.18 (default 543/1.15); road 281/0.39 (264/0.29) | bosses 541/1.29 (default 518/1.11); road 267/0.37 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) (printed) | SC | bosses 808/1.68 (default 509/1.06); road 394/0.65 (261/0.27) | bosses 779/1.63 (default 543/1.15); road 392/0.66 (264/0.29) | bosses 811/1.71 (default 518/1.11); road 388/0.63 (259/0.28) | missed |
| Thread cuts, Movement III, ≤ default + 25% a fight | OA | 1.95 (default 1.06) | 1.95 (default 1.00) | 1.90 (default 1.02) | missed |
| Thread cuts, Movement III, ≤ default + 25% a fight | OB | 1.36 (default 1.06) | 1.35 (default 1.00) | 1.46 (default 1.02) | missed |
| Thread cuts, Movement III, ≤ default + 25% a fight | OC | 1.34 (default 1.06) | 1.35 (default 1.00) | 1.30 (default 1.02) | missed |
| Bond XP a fight ≥ 75% of the starters' | SA | Seren 66% | Seren 66% | Seren 65% | missed |
| Bond XP a fight ≥ 75% of the starters' | SB | Seren 73% | Seren 73% | Seren 73% | missed |
| Bond XP a fight ≥ 75% of the starters' | SC | Seren 62% | Seren 62% | Seren 61% | missed |
| Bond XP a fight ≥ 75% of the starters' | OA | Oro 69% | Oro 69% | Oro 69% | missed |
| Bond XP a fight ≥ 75% of the starters' | OB | Oro 67% | Oro 67% | Oro 67% | missed |
| Bond XP a fight ≥ 75% of the starters' | OC | Oro 64% | Oro 64% | Oro 64% | missed |
| Bond XP a fight ≥ 75% of the starters' | W | Seren 73%, Oro 64% | Seren 73%, Oro 64% | Seren 73%, Oro 64% | missed |
| Bond XP a fight ≥ 75% of the starters' | X | (no starter) | (no starter) | (no starter) | n/a |
| Bond XP a fight ≥ 75% of the starters' | R | Seren 69% | Seren 70% | Seren 69% | missed |
| Bond XP a fight ≥ 75% of the starters' | SO | Seren 85%, Oro 75% | Seren 84%, Oro 75% | Seren 85%, Oro 75% | missed |

#### Bosses (Skilled win, the Novice's in brackets, gap to default; 50 seeds a cell)

| Party | set 1000: Cantor / Vharun / Unweaver / Conductor | set 500003: Cantor / Vharun / Unweaver / Conductor | set 777001: Cantor / Vharun / Unweaver / Conductor |
|---|---|---|---|
| default | 96 (56) / 98 (46) / 100 (42) / 96 (30) | 90 (62) / 100 (50) / 100 (48) / 96 (26) | 92 (72) / 90 (56) / 98 (46) / 98 (18) |
| SA | 98 (58) +2 / 94 (56) -4 / 100 (0) +0 / 100 (14) +4 | 96 (38) +6 / 96 (60) -4 / 100 (0) +0 / 98 (8) +2 | 96 (50) +4 / 98 (52) +8 / 100 (0) +2 / 98 (6) +0 |
| SB | 100 (78) +4 / 92 (82) -6 / 90 (20) -10 / 96 (32) +0 | 98 (78) +8 / 90 (80) -10 / 94 (44) -6 / 100 (30) +4 | 94 (82) +2 / 96 (68) +6 / 94 (24) -4 / 100 (38) +2 |
| SC | 88 (36) -8 / 98 (60) +0 / 98 (26) -2 / 100 (12) +4 | 96 (46) +6 / 96 (70) -4 / 98 (22) -2 / 100 (18) +4 | 96 (24) +4 / 98 (74) +8 / 98 (26) +0 / 100 (12) +2 |
| OA | 98 (52) +2 / 92 (44) -6 / 100 (0) +0 / 94 (4) -2 | 98 (44) +8 / 94 (48) -6 / 100 (0) +0 / 98 (4) +2 | 98 (52) +6 / 88 (36) -2 / 98 (0) +0 / 100 (0) +2 |
| OB | 96 (28) +0 / 96 (18) -2 / 98 (0) -2 / 98 (2) +2 | 98 (38) +8 / 100 (2) +0 / 96 (0) -4 / 94 (2) -2 | 86 (30) -6 / 98 (6) +8 / 100 (4) +2 / 90 (12) -8 |
| OC | 96 (6) +0 / 98 (70) +0 / 98 (0) -2 / 98 (10) +2 | 88 (18) -2 / 100 (64) +0 / 100 (0) +0 / 100 (2) +4 | 94 (8) +2 / 100 (64) +10 / 100 (0) +2 / 98 (8) +0 |
| R | 92 (0) -4 / 48 (20) -50 / 98 (0) -2 / 92 (0) -4 | 90 (0) +0 / 40 (12) -60 / 98 (0) -2 / 98 (0) +2 | 94 (0) +2 / 50 (18) -40 / 98 (0) +0 / 100 (0) +2 |
| SO | 10 (0) -86 / 8 (38) -90 / 26 (0) -74 / 100 (0) +4 | 18 (0) -72 / 8 (40) -92 / 50 (0) -50 / 92 (0) -4 | 18 (0) -74 / 20 (34) -70 / 46 (0) -52 / 98 (4) +0 |
| X | 90 (30) -6 / 80 (46) -18 / 94 (0) -6 / 98 (2) +2 | 98 (36) +8 / 82 (46) -18 / 98 (0) -2 / 94 (4) -2 | 96 (36) +4 / 80 (42) -10 / 100 (0) +2 / 96 (2) -2 |
| W | 100 (54) +4 / 88 (70) -10 / 98 (0) -2 / 98 (20) +2 | 96 (58) +6 / 94 (70) -6 / 98 (0) -2 / 100 (20) +4 | 98 (64) +6 / 94 (70) +4 / 100 (0) +2 / 100 (24) +2 |

#### The road (Skilled, 23 skirmish, elite and miniboss cells, 50 seeds; mean gap to default and the cells past the band)

| Party | set 1000 | set 500003 | set 777001 |
|---|---|---|---|
| SA (band −5) | -9.5; Blood Forge -28, Blood Rites -14, Crimson Gate -6, Frayed Court -28, Frayed Threshold -30, Glass Gallery -32, Maw Hollow -8, Muted Nave -14, Null Chapel -10, Pike Line -6, Shield Wall -14, Tolling Halls -20, Wraith Vigil -16 | -9.0; Blood Forge -24, Blood Rites -16, Frayed Court -40, Frayed Threshold -40, Glass Gallery -30, Muted Nave -16, Shield Wall -26, Tolling Halls -12 | -9.0; Blood Forge -34, Blood Rites -14, Frayed Court -42, Frayed Threshold -20, Glass Gallery -20, Muted Nave -22, Shield Wall -18, Wraith Vigil -18 |
| SB (band −5) | -2.1; Blood Forge -10, Frayed Court -22, Frayed Threshold -14, Null Chapel -8 | -1.6; Blood Forge -12, Frayed Court -12, Null Chapel -6, Shield Wall -16 | -1.9; Frayed Court -14, Frayed Threshold -16, Mirror Hall -6, Null Chapel -10, Shield Wall -8 |
| SC (band −5) | -2.0; Frayed Court -8, Frayed Threshold -8, Glass Gallery -16, Maw Hollow -14, Mirror Hall -6, Wraith Vigil -6 | -2.5; Frayed Court -12, Frayed Threshold -6, Glass Gallery -10, Maw Hollow -26, Mirror Hall -6, Muted Nave -10 | -3.0; Blood Forge -8, Frayed Court -16, Frayed Threshold -8, Glass Gallery -18, Maw Hollow -14, Shield Wall -8 |
| OA (band −5) | +0.6; Glass Gallery -14 | +0.3; Frayed Court -8 | +0.7; Muted Nave -6 |
| OB (band −10) | +1.0; none past | +0.4; The Seamstress -12 | +0.5; none past |
| OC (band −5) | +1.0; none past | +1.5; none past | +1.6; none past |

#### Seren's and Oro's own numbers, and who holds the bosses


**Seren, set 1000** (Skilled; "road" = every skirmish, elite and miniboss cell; "bosses" = the four bosses)

| Party | Wards on her parried: road / bosses | counters + kill shots, share of her damage (skirmishes and elites) | kill shots a fight, elite+boss cells (Novice) | lost | beyond 14 m | overextensions answered ≤ 3 s | Showboat pick | downs a fight: road / bosses | Skilled parries ÷ Novice (bosses) |
|---|---|---|---|---|---|---|---|---|---|
| SA | 47% / 10% | 8% | 0.58 (0.05) | 0.00 | 0% | 65% | 71% | 0.14 / 0.20 | 0.4 ÷ 1.2 |
| SB | 61% / 59% | 12% | 1.21 (0.51) | 0.11 | 0% | 77% | 79% | 0.10 / 0.41 | 8.1 ÷ 16.0 |
| SC | 53% / 17% | 8% | 0.29 (0.04) | 0.00 | 0% | 79% | 70% | 0.10 / 0.29 | 0.6 ÷ 3.2 |
| R | - / 9% | - | 0.63 (0.06) | 0.01 | 0% | 72% | 89% | 0.00 / 0.59 | 0.6 ÷ 1.7 |
| SO | - / 14% | - | 1.02 (0.07) | 0.01 | 0% | 64% | 100% | 0.00 / 1.50 | 1.3 ÷ 2.9 |
| X | - / 59% | - | 2.98 (0.85) | 0.73 | 0% | 85% | 100% | 0.00 / 0.85 | 14.9 ÷ 18.8 |
| W | - / 55% | - | 2.71 (1.19) | 0.72 | 0% | 76% | 100% | 0.00 / 0.61 | 11.6 ÷ 21.6 |

**Oro, set 1000** (Skilled; the Novice beside the in-field share)

| Party | Saplings in your field: road / bosses (Novice road / bosses) | both standing | tending: road / bosses (Novice road) | felled a fight | downs a fight: road / bosses | Rootbond a fight | Ancient taunt s · aura s | timeouts (540 s), Skilled: road / bosses (Novice bosses) |
|---|---|---|---|---|---|---|---|---|
| OA | 86% / 93% (78% / 85%) | 98% | 19% / 1% (44%) | 0.27 | 0.07 / 0.22 | 357 | 9.4 · 12.5 | 0 of 1150 / 0 of 200 (15 of 200) |
| OB | 87% / 59% (80% / 70%) | 95% | 34% / 2% (51%) | 0.63 | 0.12 / 0.17 | 502 | 6.4 · 8.3 | 0 of 1150 / 0 of 200 (1 of 200) |
| OC | 85% / 93% (78% / 85%) | 97% | 30% / 2% (49%) | 0.33 | 0.03 / 0.10 | 377 | 9.1 · 10.7 | 0 of 1150 / 0 of 200 (10 of 200) |
| SO | - / 90% (- / 87%) | 98% | - / 1% (-) | 1.25 | 0.00 / 0.76 | 427 | 21.1 · 49.7 | 0 of 0 / 30 of 200 (33 of 200) |
| X | - / 93% (- / 89%) | 100% | - / 1% (-) | 0.17 | 0.00 / 0.23 | 639 | 16.8 · 41.2 | 0 of 0 / 0 of 200 (31 of 200) |
| W | - / 94% (- / 87%) | 99% | - / 1% (-) | 0.23 | 0.00 / 0.23 | 700 | 13.2 · 31.5 | 0 of 0 / 0 of 200 (19 of 200) |

**Who holds the bosses, set 1000** (Skilled, pooled over the four bosses: share of boss time on each hero)

| Party | kael | lyra | vexis | brann | seren | oro | sapling | ancient |
|---|---|---|---|---|---|---|---|---|
| default | 46% | 50% | 3% |  |  |  |  |  |
| SA | 51% |  | 48% |  | 0% |  |  |  |
| SB |  | 4% | 1% |  | 95% |  |  |  |
| SC | 43% | 57% |  |  | 0% |  |  |  |
| OA | 61% |  | 38% |  |  | 0% |  |  |
| OB |  | 96% | 3% |  |  | 1% |  |  |
| OC | 42% | 58% |  |  |  | 0% |  |  |
| R | 86% |  |  | 11% | 1% |  |  |  |
| SO | 92% |  |  |  | 5% | 3% |  |  |
| X |  |  |  | 1% | 97% | 1% |  |  |
| W |  |  | 1% |  | 98% | 0% |  |  |

**Seren, set 500003** (Skilled; "road" = every skirmish, elite and miniboss cell; "bosses" = the four bosses)

| Party | Wards on her parried: road / bosses | counters + kill shots, share of her damage (skirmishes and elites) | kill shots a fight, elite+boss cells (Novice) | lost | beyond 14 m | overextensions answered ≤ 3 s | Showboat pick | downs a fight: road / bosses | Skilled parries ÷ Novice (bosses) |
|---|---|---|---|---|---|---|---|---|---|
| SA | 48% / 9% | 8% | 0.50 (0.06) | 0.00 | 0% | 66% | 71% | 0.15 / 0.20 | 0.4 ÷ 1.1 |
| SB | 60% / 58% | 12% | 1.28 (0.48) | 0.11 | 0% | 77% | 78% | 0.09 / 0.38 | 8.0 ÷ 16.5 |
| SC | 52% / 15% | 8% | 0.32 (0.03) | 0.00 | 0% | 79% | 70% | 0.09 / 0.29 | 0.6 ÷ 3.0 |
| R | - / 10% | - | 0.81 (0.03) | 0.00 | 0% | 68% | 89% | 0.00 / 0.64 | 0.7 ÷ 1.5 |
| SO | - / 14% | - | 1.22 (0.06) | 0.01 | 0% | 71% | 100% | 0.00 / 1.53 | 1.4 ÷ 2.6 |
| X | - / 60% | - | 3.01 (0.89) | 0.69 | 0% | 83% | 100% | 0.00 / 1.14 | 15.0 ÷ 18.8 |
| W | - / 55% | - | 2.67 (1.25) | 0.75 | 0% | 76% | 100% | 0.00 / 0.57 | 11.6 ÷ 20.9 |

**Oro, set 500003** (Skilled; the Novice beside the in-field share)

| Party | Saplings in your field: road / bosses (Novice road / bosses) | both standing | tending: road / bosses (Novice road) | felled a fight | downs a fight: road / bosses | Rootbond a fight | Ancient taunt s · aura s | timeouts (540 s), Skilled: road / bosses (Novice bosses) |
|---|---|---|---|---|---|---|---|---|
| OA | 86% / 93% (77% / 85%) | 98% | 19% / 1% (45%) | 0.27 | 0.08 / 0.17 | 358 | 9.2 · 12.4 | 0 of 1150 / 0 of 200 (19 of 200) |
| OB | 87% / 59% (80% / 71%) | 95% | 34% / 2% (50%) | 0.55 | 0.12 / 0.21 | 552 | 5.8 · 8.0 | 0 of 1150 / 0 of 200 (1 of 200) |
| OC | 85% / 92% (77% / 86%) | 97% | 31% / 2% (49%) | 0.34 | 0.04 / 0.12 | 356 | 8.8 · 10.6 | 0 of 1150 / 0 of 200 (12 of 200) |
| SO | - / 90% (- / 87%) | 98% | - / 1% (-) | 1.21 | 0.00 / 0.73 | 408 | 19.7 · 49.8 | 0 of 0 / 30 of 200 (33 of 200) |
| X | - / 92% (- / 89%) | 100% | - / 1% (-) | 0.07 | 0.00 / 0.25 | 593 | 15.5 · 40.0 | 0 of 0 / 1 of 200 (34 of 200) |
| W | - / 94% (- / 87%) | 100% | - / 1% (-) | 0.23 | 0.00 / 0.20 | 751 | 15.2 · 31.4 | 0 of 0 / 0 of 200 (15 of 200) |

**Who holds the bosses, set 500003** (Skilled, pooled over the four bosses: share of boss time on each hero)

| Party | kael | lyra | vexis | brann | seren | oro | sapling | ancient |
|---|---|---|---|---|---|---|---|---|
| default | 45% | 51% | 4% |  |  |  |  |  |
| SA | 51% |  | 49% |  | 0% |  |  |  |
| SB |  | 4% | 0% |  | 95% |  |  |  |
| SC | 44% | 55% |  |  | 0% |  |  |  |
| OA | 58% |  | 42% |  |  | 0% |  |  |
| OB |  | 96% | 2% |  |  | 1% |  |  |
| OC | 43% | 57% |  |  |  | 0% |  |  |
| R | 86% |  |  | 11% | 1% |  |  |  |
| SO | 92% |  |  |  | 5% | 2% |  |  |
| X |  |  |  | 2% | 96% | 1% |  |  |
| W |  |  | 1% |  | 98% | 1% |  |  |

**Seren, set 777001** (Skilled; "road" = every skirmish, elite and miniboss cell; "bosses" = the four bosses)

| Party | Wards on her parried: road / bosses | counters + kill shots, share of her damage (skirmishes and elites) | kill shots a fight, elite+boss cells (Novice) | lost | beyond 14 m | overextensions answered ≤ 3 s | Showboat pick | downs a fight: road / bosses | Skilled parries ÷ Novice (bosses) |
|---|---|---|---|---|---|---|---|---|---|
| SA | 47% / 8% | 8% | 0.53 (0.07) | 0.00 | 0% | 69% | 71% | 0.14 / 0.18 | 0.3 ÷ 1.3 |
| SB | 60% / 58% | 11% | 1.34 (0.55) | 0.11 | 0% | 78% | 78% | 0.10 / 0.40 | 8.2 ÷ 16.3 |
| SC | 54% / 15% | 9% | 0.35 (0.02) | 0.00 | 0% | 79% | 70% | 0.11 / 0.26 | 0.5 ÷ 3.1 |
| R | - / 9% | - | 0.84 (0.03) | 0.00 | 0% | 76% | 89% | 0.00 / 0.56 | 0.7 ÷ 1.6 |
| SO | - / 14% | - | 1.10 (0.05) | 0.01 | 0% | 66% | 100% | 0.00 / 1.62 | 1.4 ÷ 2.5 |
| X | - / 59% | - | 3.00 (0.94) | 0.70 | 0% | 85% | 100% | 0.00 / 0.98 | 15.1 ÷ 18.9 |
| W | - / 55% | - | 2.73 (1.18) | 0.75 | 0% | 78% | 100% | 0.00 / 0.65 | 11.7 ÷ 21.5 |

**Oro, set 777001** (Skilled; the Novice beside the in-field share)

| Party | Saplings in your field: road / bosses (Novice road / bosses) | both standing | tending: road / bosses (Novice road) | felled a fight | downs a fight: road / bosses | Rootbond a fight | Ancient taunt s · aura s | timeouts (540 s), Skilled: road / bosses (Novice bosses) |
|---|---|---|---|---|---|---|---|---|
| OA | 86% / 93% (78% / 85%) | 98% | 19% / 1% (45%) | 0.28 | 0.07 / 0.25 | 350 | 8.9 · 12.5 | 0 of 1150 / 0 of 200 (15 of 200) |
| OB | 87% / 59% (79% / 71%) | 95% | 34% / 2% (50%) | 0.64 | 0.15 / 0.26 | 536 | 6.4 · 8.0 | 0 of 1150 / 0 of 200 (0 of 200) |
| OC | 85% / 93% (77% / 86%) | 97% | 31% / 2% (49%) | 0.34 | 0.03 / 0.10 | 360 | 8.5 · 10.6 | 0 of 1150 / 0 of 200 (11 of 200) |
| SO | - / 90% (- / 87%) | 98% | - / 1% (-) | 1.28 | 0.00 / 0.73 | 411 | 20.3 · 50.2 | 0 of 0 / 21 of 200 (33 of 200) |
| X | - / 92% (- / 89%) | 100% | - / 1% (-) | 0.09 | 0.00 / 0.23 | 513 | 16.1 · 41.6 | 0 of 0 / 0 of 200 (29 of 200) |
| W | - / 94% (- / 86%) | 99% | - / 1% (-) | 0.29 | 0.00 / 0.21 | 755 | 14.4 · 30.9 | 0 of 0 / 0 of 200 (18 of 200) |

**Who holds the bosses, set 777001** (Skilled, pooled over the four bosses: share of boss time on each hero)

| Party | kael | lyra | vexis | brann | seren | oro | sapling | ancient |
|---|---|---|---|---|---|---|---|---|
| default | 47% | 49% | 3% |  |  |  |  |  |
| SA | 53% |  | 47% |  | 0% |  |  |  |
| SB |  | 3% | 0% |  | 96% |  |  |  |
| SC | 45% | 54% |  |  | 0% |  |  |  |
| OA | 62% |  | 38% |  |  | 0% |  |  |
| OB |  | 97% | 2% |  |  | 1% |  |  |
| OC | 42% | 58% |  |  |  | 0% |  |  |
| R | 83% |  |  | 14% | 1% |  |  |  |
| SO | 93% |  |  |  | 5% | 2% |  |  |
| X |  |  |  | 2% | 97% | 1% |  |  |
| W |  |  | 2% |  | 98% | 1% |  |  |

**Interrupts in W against the default party** (Skilled: Mirror Wards interrupted a fight at the Unweaver; the Conductor's mirror-choir Solo cues interrupted, of those cued)

| Set | default: Mirror Wards interrupted · Solo cues interrupted | W |
|---|---|---|
| 1000 | 1.86 · 42% (242/574) | 7.28 · 47% (345/728) |
| 500003 | 1.80 · 44% (254/576) | 7.28 · 47% (337/719) |
| 777001 | 1.76 · 46% (263/570) | 7.20 · 46% (334/724) |

#### Callings at the Conductor (SC and OC), the Anchor, the Decree gate, the smoke and pacing

**Callings** (`callings.ts --cells --movement 4 --party`, Skilled, 50 seeds; band ≥ 75% each, length ≤ none + 40 s):

| Party | Set | none | Luminary | Martyr | Chronomancer + Paradox | Chronomancer + Eternal Moment |
|---|---|---|---|---|---|---|
| SC | 1000 | 100% · 210 s | 98% · −40 s | 100% · −6 s | 100% · −28 s | 100% · −27 s |
| SC | 500003 | 100% · 211 s | 100% · −36 s | 100% · +2 s | 100% · −24 s | 100% · −25 s |
| SC | 777001 | 100% · 207 s | 100% · −29 s | 100% · +8 s | 100% · −20 s | 100% · −23 s |
| OC | 1000 | 98% · 209 s | 100% · −24 s | 100% · +4 s | 100% · −9 s | 100% · −11 s |
| OC | 500003 | 100% · 213 s | 100% · −27 s | 100% · −2 s | 100% · −10 s | 100% · −12 s |
| OC | 777001 | 98% · 213 s | 100% · −22 s | 100% · +1 s | 100% · −6 s | 100% · −10 s |

Met on all three sets. **Anchor** (reported; `verbs.ts --techniques anchor`, 50 seeds from 1000): SC 100% (207 s, 0.14 downs), OC 98% (221 s, 0.20), the default party 100% (180 s, 0.08).

**The Decree gate** (`decrees.ts --party`, Skilled, 50 seeds from 1000, real casts; each cell: casts over the 50 fights (answered); ⚠ under default − 10%):

| Boss | Decree | default | SA | SB | SC | OA | OB | OC | W |
|---|---|---|---|---|---|---|---|---|---|
| Vharun | Twin Cleave | 448 (91%) | 841 (88%) | 485 (72%) | 544 (94%) | 851 (89%) | 415 (82%) | 538 (96%) | 712 (84%) |
| Vharun | Bloodmoon | 240 (100%) | 443 (98%) | 243 (95%) | 295 (99%) | 419 (98%) | 255 (98%) | 285 (100%) | 340 (96%) |
| Vharun | Crimson Tide | 187 (100%) | 360 (98%) | 191 (93%) | 232 (99%) | 359 (98%) | 193 (95%) | 220 (98%) | 268 (94%) |
| Vharun | Execution | 152 (99%) | 312 (97%) | 157 (98%) | 193 (99%) | 313 (98%) | 156 (98%) | 189 (97%) | 224 (99%) |
| Vharun | *won* | 98% | 94% | 92% | 98% | 92% | 96% | 98% | 88% |
| the Unweaver | Shear | 529 (99%) | 1129 (98%) | 653 (98%) | 713 (99%) | 1237 (98%) | 306 (89%) ⚠ | 488 (100%) | 1191 (98%) |
| the Unweaver | Snip | 558 (95%) | 995 (92%) | 572 (91%) | 656 (95%) | 1112 (84%) | 636 (87%) | 665 (91%) | 1046 (88%) |
| the Unweaver | Spindles | 101 (100%) | 150 (100%) | 100 (100%) | 100 (100%) | 174 (100%) | 101 (100%) | 100 (100%) | 153 (100%) |
| the Unweaver | Steal Verse | 57 (95%) | 100 (99%) | 51 (100%) ⚠ | 83 (95%) | 100 (100%) | 65 (91%) | 74 (93%) | 100 (100%) |
| the Unweaver | Unravel | 128 (100%) | 203 (100%) | 115 (100%) ⚠ | 151 (100%) | 220 (100%) | 142 (100%) | 152 (100%) | 206 (100%) |
| the Unweaver | Mirror Weave | 205 (98%) | 357 (100%) | 223 (97%) | 256 (100%) | 382 (74%) | 205 (89%) | 228 (96%) | 372 (99%) |
| the Unweaver | *won* | 100% | 100% | 90% | 98% | 100% | 98% | 98% | 98% |
| the Conductor | Lament | 130 (100%) | 198 (83%) | 113 (100%) ⚠ | 169 (100%) | 243 (99%) | 141 (96%) | 218 (100%) | 217 (99%) |
| the Conductor | Basso Ostinato | 121 (99%) | 176 (99%) | 106 (100%) ⚠ | 153 (99%) | 161 (98%) | 125 (98%) | 169 (100%) | 164 (99%) |
| the Conductor | Cadenza | 78 (97%) | 112 (99%) | 98 (96%) | 132 (95%) | 126 (94%) | 93 (90%) | 113 (96%) | 126 (96%) |
| the Conductor | Shatter Aria | 121 (100%) | 153 (99%) | 102 (100%) ⚠ | 153 (100%) | 138 (98%) | 102 (96%) ⚠ | 117 (98%) | 128 (99%) |
| the Conductor | Fortissimo Silence | 50 (98%) | 61 (100%) | 50 (94%) | 63 (100%) | 60 (93%) | 51 (92%) | 57 (98%) | 51 (100%) |
| the Conductor | Grand Silence | 48 (100%) | 50 (100%) | 48 (100%) | 50 (100%) | 47 (100%) | 49 (100%) | 49 (100%) | 49 (100%) |
| the Conductor | *won* | 96% | 100% | 96% | 100% | 94% | 98% | 98% | 98% |

As in round 1: the gate holds wherever the fight lasts at least as long as the default party's, and misses for **SB** (Steal Verse, Unravel, Lament, Basso Ostinato, Shatter Aria: its Unweaver and Conductor fights are 9-17% shorter) and **OB** (the Shear, a cone on the boss's current target, which in OB is Lyra at range; Shatter Aria). Every Decree is still met and answered 74-100% of the time. No round-2 rule moved a Decree count by more than the fight's length.

**The unbanded sweep** (24 Skilled Finale-route runs from 2000; the default party 71%): A 79%, B 67%, C 79% (Brann's parties, pinned; identical to round 1), KBO 8% (−62), LBS 58% (−12), LBO 75% (+4; round 1 67%), LSO 42% (−29; 25%), VBS 42% (−29), VBO 75% (+4; 58%). The outlier is still KBO (Kael, Brann, Oro: Vharun).

**Pacing.** `tools/pacing.ts --route expedition` prints byte-identical output on this tree and on round 1's (and so on `65f8748`): the default party's pacing is untouched. The edge-of-band default numbers are identical by construction (no default-party code path moved; the 22 baseline checks are byte-equal, the 19 goldens unchanged, and every default row in this round's tables is byte-identical to round 1's: Skilled reached the Finale on 333003 at 67%, the 5d edge figure). Seren and Oro Skilled Expedition minutes (default 19.2 / 18.5 / 18.4 on 2000 / 900007 / 333003): SA 18.3-19.6, SB 16.9-17.5, SC 18.1-20.6, OB 17.1-18.1, R 13.9-15.6, SO 8.3-9.9 (inside the soft default + 3); over it: OA 29.0-29.4 (+10.2 to +10.6; round 1 26.4-27.3), OC 23.1-23.6 (+3.9 to +5.1), X 21.6-22.5 (+3.1 to +3.8) and W 20.5-22.5 (+4.0 and +3.7 on two sets). OA's Expeditions are longer because it now reaches the Finale 67-71% of the time (round 1 50-57%).

### Bands after round 2, and what needs you

| Band | Round 2 (three sets; round 1 in brackets) | Status |
|---|---|---|
| Bosses, SA ≥ default − 5 | +2 / −4 / +0 / +4; +6 / −4 / +0 / +2; +4 / +8 / +2 / +0 | **met** |
| Bosses, SC ≥ default − 5 | the Cantor −8 / +6 / +4 (−10 / −12 / −18); the rest −4 to +8 | seed-sensitive 2 of 3 (round 1: missed) |
| Bosses, OA ≥ default − 5 | Vharun −6 / −6 / −2 (−4 / −8 / +0); the rest −2 to +8 | seed-sensitive 1 of 3: Vharun 92 against 98 and 94 against 100 |
| Bosses, OC ≥ default − 5 | −2 to +10 | **met** |
| Bosses, SB ≥ default − 15 | −10 to +8 | **met** |
| Bosses, OB ≥ default − 25 (provisional) | −8 to +8 | **met** |
| Bosses, reduced vs −15 (printed) | W −10 to +6 (met); X Vharun −18 / −18 / −10 (1 of 3); R Vharun −40 to −60; SO −50 to −92 at three bosses (round 1 −46 to −92) | printed |
| Road, OC ≥ default − 5 | 0 / 0 / 0 cells past (2 / 3 / 3) | **met** (round 1: missed) |
| Road, OB ≥ default − 10 (provisional) | 0 / 1 / 0 (the Seamstress −12 on 500003) | seed-sensitive 2 of 3 (round 1: 1 of 3) |
| Road, OA ≥ default − 5 | 1 / 1 / 1 cells past (6 / 5 / 5): the Glass Gallery −14, the Frayed Court −8, the Muted Nave −6, one a set | missed by one cell a set (mean gap +0.3 to +0.7) |
| Road, SA / SB / SC ≥ default − 5 | SA 13 / 8 / 8, SB 4 / 4 / 5, SC 6 / 6 / 6 cells past (unchanged) | missed |
| Skilled share | road ≥ 38%, bosses ≥ 37% everywhere | **met** |
| Skilled length (cells ≤ default + 15%; the Conductor 170-280 s) | SA 19, SC 8-9, OA 25-26, OC 18-21 cells over; the Conductor 207-239 s; SB and OB ≤ 167 s | missed (×A ×C); met (SB, OB) |
| Novice at bosses ≤ Skilled; SB ≥ 10% | every cell; SB 20-82% | **met** for the half read here. *Corrected in W9 round 3:* the band's first half, 'inside each Movement's 5b/5c/5d Novice row' (Cantor 25-70%, Vharun 20-60%, the Unweaver 25-55%, the Conductor 15-40%), was not read: SA, SC, OA and OC miss it on every set (round 3 prints it); OB's Novice is 'recorded' |
| Idle at bosses | 0% everywhere | **met** |
| Whole Prelude, Skilled | SB +6 / +6 / +9, OB −8 / −3 / −5 (met); OC −4 / −3 / +0 (met for the Skilled bot); OA −7 / −6 / −3 (1 of 3); SC −11 / −9 / −7; SA −26 to −32 | met for SB, OB and OC's Skilled; missed for the rest |
| Whole Prelude, Novice ≥ 50% of default | SA 6-10%, SC 18-22%, OA 12-16%, OC 5-10% against 32-38% | missed |
| Whole Expedition, OA ≥ default − 5 and ≥ 55% | 67.5% (−4.5) / 67.5% (−0.5) / 66.0% (+0.5) (56 / 52 / 48%) | **met** (round 1: missed) |
| Whole Expedition, OC ≥ default − 5 and ≥ 55% | 79.0% (+7.0) / 82.0% (+14.0) / 79.0% (+13.5) | **met** |
| Whole Expedition, SB ≥ default − 10 | −9.5 / −7.0 / −10.0 | **met**, at the band's edge on 333003 |
| Whole Expedition, OB ≥ default − 20 (provisional) | −15.0 / −7.0 / −9.0 (−16 / −12 / −15) | **met** |
| Whole Expedition, SC | 60.5% (−11.5) / 49.5% (−18.5) / 57.5% (−8.0) (50 / 44 / 50%) | missed |
| Whole Expedition, SA | 27.5% (−44.5) / 30.5% (−37.5) / 32.0% (−33.5) | missed |
| Whole Expedition, reduced vs −15 (printed) | W −31.5 / −23.0 / −14.5 (1 of 3; round 1 −34 / −31 / −25), X −44 / −47.5 / −38.5 (−68 / −61 / −60), R −65 to −70, SO −65.5 to −71.5 | printed |
| Weaver safety (Oro parties) | road: OB 277 / 272 / 291 and 0.30 / 0.31 / 0.35 against limits 300 / 304 / 298 and 0.32 / 0.34 / 0.33 (met on 2 of 3; round 1 missed), OA 414-421 / 0.51-0.53, OC 352-359 / 0.44-0.45; bosses: OA 920-995 / 1.99-2.18, OB 596-677 / 1.28-1.52, OC 609-681 / 1.20-1.44 against default 509-543 / 1.06-1.15 | missed (OB's road 2 of 3) |
| Thread cuts, Movement III (Oro parties) | OA 1.90-1.95 (2.12-2.21), OB 1.35-1.46 (1.29-1.36), OC 1.30-1.35 (1.50-1.65) against 1.00-1.06 (limit 1.25-1.33) | missed (OC by 0.01-0.10) |
| Callings at the Conductor (SC, OC) | 98-100% each | **met**; Anchor 98-100% |
| Bond XP a fight ≥ 75% of the starters' | Seren 61-74%, Oro 64-69%; SO's Seren 84-85%, Oro 75% (2 of 3) | missed |
| Decree gate | SB 5 Decrees and OB 2 under default − 10% (shorter fights, or Lyra out of the Shear's cone); every other party met | missed for SB and OB |
| Seren: ≥ 50% of the Wards on her parry | road SB 60-61%, SC 52-54%, SA 47-48%; bosses SB 58-59%, W 55%, X 59-60%; SA 8-10%, SC 15-17%, R 9-10%, SO 14% | ~~met where she holds the boss and on SB's and SC's road; SA's road 2-3 points short~~ *corrected in W9 round 3:* **missed** for SA (road and bosses), SC, R and SO at the bosses; met for SB, W and X at the bosses and on SB's and SC's road (the band has no 'where she holds the boss' condition) |
| Seren: counters and kill shots 20-40% of her damage (skirmishes and elites) | SA 8%, SB 11-12%, SC 8-9% | missed |
| Seren: kill shots ≥ 0.5 a fight (elite and boss cells), the Novice ≤ a third | SA 0.50-0.58 (Novice 0.05-0.07), SB 1.21-1.34 (0.48-0.55), SC 0.29-0.35, W 2.67-2.73 (1.18-1.25), X 2.98-3.01 (0.85-0.94) | met for SA and X; SC too few; SB's and W's Novice over a third |
| Seren: beyond 14 m ≤ 2%; overextensions answered ≤ 3 s ≥ 50%; Showboat pick ≥ 60% | 0%; 64-85%; 70-100% | **met** |
| Seren: downs ≤ 0.3 a fight | road 0.09-0.15; bosses SA 0.18-0.20, SC 0.26-0.29, SB 0.38-0.41, W 0.57-0.65, X 0.85-1.14 | met for SA and SC; missed where she holds the boss (the By-party default's knock-on) |
| Seren: Skilled parries ≥ 2× the Novice's | at bosses the Novice parries more (SB 16 against 8 a fight, W 21 against 12) | missed |
| Seren: W's interrupts ≥ the default's rate − 10 | Solo cues interrupted at the Conductor 46-47% against 42-46%; Mirror Wards 7.2-7.3 a fight against 1.8 | **met** |
| Kael holds bosses ≥ 70% (SA, SC) | SA 51-53%, SC 43-45% (39-41%); the default party's Kael 45-47% | **NEEDS USER** (prep) |
| Oro: Saplings in your field ≥ 60% | OA and OC 85-86% road, 92-93% bosses; OB 87% road, 59 / 59 / 59% bosses | met but OB at its bosses (round 1: 59 / 60 / 59) |
| Oro: the Novice ≥ 15 points lower | road 8 (OA, OC; round 1 15-16), 7 (OB); bosses 7-8 (OA, OC), −11 to −12 (OB) | missed (the `groveCover` change's knock-on on the road) |
| Oro: tending ≤ 25% (Skilled) | road OA 19% (41%), OB 34% (53%), OC 30-31% (51%); bosses 1-2% | met for OA; missed for OB and OC on the road |
| Oro: both standing ≥ 60%; downs ≤ 0.3 | 94-98%; 0.03-0.26 | **met** |
| Oro: timeouts ≤ 1% | Skilled OA, OB, OC 0 on every cell; SO's bosses 30 / 30 / 21 of 200 (24 / 20 / 18), X 1 of 200 on 500003; the Novice's OA and OC bosses 10-19 of 200 | met for OA, OB, OC (Skilled); SO missed |
| Boss seconds on a summon | 0-3% (the `oro` share is Oro himself; `sapling` and `ancient` 0) | **met** |
| Default party and Brann parties A, B, C | the 22 baseline checks byte-equal; the 19 goldens unchanged; every default row byte-identical to round 1's | **identical** |

**What round 2 says.** The Oro parties' remaining losses were bot habits, not numbers: Oro tending behind a crowd guard, the Weaver drawn toward the grove while Kael held the pack, and the Thread run back to Oro across the Shears' line. With those three changes OA's whole runs moved 48-56% → 66-68% (band met on all three sets), OC's road band is met, OB's runs and road gained, and so did X (+13 to +25 points) and W (+2 to +11), which share the Oro rules. SC's Cantor was Kael dying to his own Toll after the Choristers wore him down; Seren peeling them off him lifts the Cantor (−10 / −12 / −18 → −8 / +6 / +4) and SC's runs (+5 to +10), but SC is still 8-18 points short on whole runs, and SA unchanged: the parties that drop Lyra or Vexis lose on the road to the starter's missing damage (round 1's finding, still true: SA's road mean gap −9.0 to −9.5).

**The trade-offs the kept rules bring** (for your decision with the rest):
- SO (Kael, Seren, Oro) is worse at its bosses (the Cantor −66 → −86 on 1000; Skilled timeouts 21-30 of 200 against 18-24): Seren peels the Choristers instead of hitting the boss in a party that is already short of boss damage. SO is a reduced, printed party at 0-0.5% whole runs either way. *Corrected in W9 round 3: not the peel.* With the peel turned off in parties with Oro, SO's Skilled Cantor, Vharun and Unweaver cells are byte-identical (50 seeds on 1000 and 500003): the peel never fires there, because `oroFocus` keeps the boss Focused all fight and a Focus overrides Showboat. The Cantor's fall came from `oroFocus` itself (`verbs.ts`, SO at the Cantor: 16% with it, 96% without; round 3's pack guard).
- Oro's Novice skill gap on the road (≥ 15 points) is now 8: the Skilled bot's in-field share on the road fell 93 → 85-86% with `groveCover` off on the road with Kael, while the Novice's is unchanged.
- OC's Weaver takes more on the road (313-321 → 352-359 a fight; still past the band either way); OB's road damage came inside the band on two sets.

**Round 3 leads (taken up in W9 round 3 below):** SO's peel (leave the adds to Oro's Saplings when they hold them); OA's Vharun (−6 on both tuning sets); OB's in-field share at the Cantor (31-34%), where the boss guard keeps the Rally from re-planting the grove into the Silent Verse's circle (the Rally through it cost OB's Cantor 8-12 points).

**NEEDS USER.**
1. *Default taken, awaiting your confirmation:* with no Kael, Seren holds the bosses by threat (`DUEL_BOSS_THREAT` ×6, lever 2; lever 1 cannot: `threatMult` 1.2 put the boss on her 0-18% of the time). Final hold: SB 95-96%, W 98%, X 96-97% of boss time. Its cost: her boss downs 0.38-1.14 a fight (band ≤ 0.3) and 0.11-0.75 kill shots lost a fight in SB, W and X. Confirm, or say how else you want it.
2. *New in round 2, a refinement of Showboat's pick (lever 2), flagged for you:* in a boss fight, a normal or elite enemy swinging at Kael that is not his own target is Seren's to duel; the decision row ('prefer enemies not targeting Kael') now says so. It is what moved SC's Cantor. Confirm, or name the narrower form you want (for instance, not in a party with Oro, which would give SO back its Cantor).
3. *Kael holds bosses ≥ 70% in SA and SC* is above the default party's own Kael (45-47%). Only Kael's or Lyra's numbers could reach it, and they are never moved. Restate it against the default party's share (SA's 51-53% meets it; SC's 43-45% is −1 to −3, round 1's −6), or accept it as missed.
4. *OB (Q8):* the measurements confirm both provisional bands, more firmly than in round 1: bosses −8 to +8 against −25, whole runs −15.0 / −7.0 / −9.0 against −20, on all three sets; the road −10 band is missed by one cell on one set (the Seamstress −12 on 500003). Recommendation: keep both, and make them final. The *Heartwood* alternative is a Quirk change: not built, not needed by these numbers, and yours to decide.
5. *SA's and SC's road and whole runs (≥ default − 5 and ≥ 55%)* cannot be reached with the allowed levers: lever 1 is spent (round 1), and the round-2 rules moved SC's runs +5 to +10 and SA's not at all. The gap is the dropped starter's damage. Reaching it needs one of: a wider lever-1 rule for Seren's damage (beyond ±20%: a design change), a restated band for parties without Lyra or Vexis (as SB and OB have), or starter, enemy or road numbers, which are never moved. The same choice covers the length, Seren-parties' Prelude and Novice-Prelude bands, which read the same longer fights.
6. *The Weaver-safety and Thread-cut bands for Oro parties*: round 2 cut the Thread cuts (OC 1.50-1.65 → 1.30-1.35, 0.01-0.10 short) and brought OB's road damage inside on two sets, but the boss rows (+10-90% damage, +0.05-1.1 downs) read the longer boss fights and the Weaver's healing threat on the Saplings (Q1's knock-on, an aura rule): no hero-only lever found moves them. Restate them, or accept them as missed.
7. *Seren's skill-gap bands* (Skilled parries ≥ 2× the Novice's; the Novice's kill shots ≤ a third) read backwards by construction: the Novice Wards her whenever she is engaged and every Ward parries the next swing, while the Skilled bot keeps its Ward for the boss's cones. Halving the Novice's draw (0.3 → 0.15 → 0.08) lowers its parries only 10-25% and moves its win rates ±20 points. Restate these bands (for instance parries per Ward, or kill shots per Perfect) or accept them as missed.
8. *Bond XP ≥ 75% of the starters'* (Seren 61-74%, Oro 64-69%): Bond XP is shared by the Weaver's support, a rule every party reads (the default party's figures would move); lever 4 has no Seren- or Oro-only Bond XP value. Accept as missed (as Brann's 67-75% was in 5b), or say if a recruit-only weighting is wanted (a design change).
9. *`roster20.test.ts`* still lets SO carry Skilled Vharun on seed 1000 to the 540 s cap (round 1's relaxation); every other party and fight keeps the inside-the-cap check. Approve it, or say how you want SO's timeouts handled.

### The pins and the tests (round 2)

- All 22 baseline checks are byte-equal: `m1-baseline --check` for Movements 1-4, `--movement N --party P --check` for N 1-4 and P A, B, C, and `expedition-baseline --check` at 2, 3 and 4 Movements and at 4 for A, B and C. The `update-golden` dry run says 'Goldens are up to date' after the `--write`.
- `tools/pacing.ts --route expedition` prints byte-identical output on this tree and on round 1's (the default party's pacing is untouched).
- The 19 original goldens are byte-identical; `SIM_VERSION` is 22; `contentVersion` is unchanged (`c-90f2f93ff5775748`). Re-recorded: `skilled-oro-conductor` `f254a5511c85b4d7` → `178ad349e9fd3c8a` (its `ROSTER_HASHES` literal with it). The other five Seren and Oro goldens are byte-identical (the peel needs a boss fight with Kael and an add on him; the Oro rules none of their seeds reach).
- New and changed tests: `bots.test.ts` — `oroFocus` Focuses Kael's target whatever the crowd (six hounds), and never a guarded Sentinel while more than three stand; `groveCover` weighs the Saplings in at a boss and with no tank, and not on the road with Kael; `oroThread` leaves the Thread alone while the Shears stand. `rosterContracts.test.ts` — `duelTarget` leaves an add on Kael to him off the boss fights and peels it in one, the boss staying his.

## W9 tuning round 3 (2026-11-09): the last lever-1 number, then two `oroFocus` rules, and the round-2 corrections

*Branch `m5/tune` from round 2 (`65c673d`). The levers were taken in the agreed order. Lever 1: the one Seren number never screened, the 13 m clamp (11-13), was screened at 12 and 11, and neither was kept. Lever 2: one hero-only targeting rule was screened, a narrower Showboat peel, and not kept. Lever 3: hero-only bot rules after a `verbs.ts` ablation of Oro's rules at every boss, and two `oroFocus` rules were kept. Lever 4 (Bond and motif values): nothing to move (no Seren- or Oro-only value; round 2's finding). No number moved, and nothing in `src/content` or `src/sim` changed. Never moved: Weaver, aura, enemy, encounter, Movement, road, starter and Brann numbers, and no aura definition, number, list or reach. Every existing fight is unchanged: the 19 original goldens are byte-identical, `SIM_VERSION` is 22, `contentVersion` is unchanged (`c-90f2f93ff5775748`), all 22 baseline checks are byte-equal, and the Oro goldens the rules reach are re-recorded with their `ROSTER_HASHES` literals. Tuned on cells 1000 and 500003 and runs 2000 and 900007. Cells 777001 and runs 333003 were first read at the final measurement. One decision came after its first pass had read 777001's boss cells: the pack guard's narrowing (*How the round chose them*, step 4). It rests on set 1000's row, and 777001's row for it is unchanged either way.*

Raw outputs and scripts: scratch `m5e/tune3/`.
- `raw/`: the screen `r2-*` (round 2's committed tree) and `v_*` (one variant each); the boss checks `bpeelo-*`, `bofa-*` and `bpack-*`; the run checks `rruns-*`; the ablations `abl-*`; the diagnostics `d8-*`; the clean-code check `chk-*`; the final `fin-*`, `call-*`, `anchor-*`, `dec-*`, `fin-smoke` and `pacing-default`.
- `scripts/`: `scr.py` (the screen), `bcmp2.py` (boss cells against round 2's final rows), `bands.py` (now with each Movement's Novice row), `own.py`, `tables.py`, and the diagnostics `diag8-10.ts` and `adds.ts`.
- `flags.diff`: the scratch environment flags each variant ran under.

### What changed (every rule; no number moved)

| File | Rule | Old → new | Lever | Why |
|---|---|---|---|---|
| `src/bots/skilled.ts` | `oroFocus`'s re-Focus (new `ORO_REFOCUS` = 2 s) | Once a Focus fell, the next waited out the plain 4 s between Focuses, and Oro tended meanwhile → **while Oro tends and no Focus stands, the next Focus comes 2 s after the last** | 3 | Oro's tending band (≤ 25%). On round 2's tree he tended 34% (OB) and 31% (OC) of the road. Much of it was the wait after a Focus died: Lyra kills fast, and the 4 s throttle left him idle. At 2 s he tends 22% and 18% (screen), OB's road Weaver damage is unchanged (277 a fight), and Movement III's Thread cuts fall (OB 1.32 → 1.21, OC 1.39 → 1.35). At 0 or 1 s he tends less still (13-15%), but OB's Weaver takes 296-300 a fight on the road, at her band's edge. |
| `src/bots/skilled.ts` | `oroFocus`'s pack guard (new `packCaller`) | → **with Kael and Seren in the party (SO), no `oroFocus` Focus in a fight whose boss calls a pack**: a boss, not a miniboss, with a summon special of 3 or more mobile, non-heavy foes. Today that is only the Hollow Cantor (Chorus of the Hollow, four Choristers). | 3 | A Focus stands until its target falls (`commands.ts`: no directive clears one) and overrides Showboat. So the boss Focus that `oroFocus` set at the Cantor's start held Seren on the boss for the whole fight, and her round-2 peel never took the Choir off Kael, who went into his Toll worn down: SC's round-2 diagnosis again, this time made by the bot. The `verbs.ts` ablation found it: SO's Cantor 16 → 96% with `oroFocus` off (50 seeds from 1000; 20 → 92% from 500003). With the guard Oro tends there, Seren peels, and his Saplings taunt the Choir at the tended bonus (the *Every beat* row 'Call the Choir: Saplings taunt the choristers'). It is read only with Seren: in the Kael parties without her it moved OC's Cantor 96 → 90% on set 1000 (past the −5 band) and 88 → 98% on 500003 (step 4). |
| `tests/bots.test.ts` | two new `oroFocus` cases | state both rules | — | |
| `tests/sim/golden.json`, `m1Unchanged.test.ts` | the Oro goldens the rules reach | re-recorded with `update-golden --write` (below) | — | |

### How the round chose them

**1. Diagnosis first** (scratch `diag8-10.ts`, `adds.ts`; 8-12 seeds from 1000; read, not tuned on):
- *What Seren is on in a boss fight.* At the Cantor she is on the boss 75-95% of her time in every party (SC 75%, SA 88%, SO 93%) and on Choristers swinging at Kael 0-10%. At the Unweaver she is on the boss 67-81%. So the narrower peel (the round-2 lead for SO) has little to act on, and the screen below bears that out.
- *Seren has no target 32-40% of Vharun* in every Seren party, and Kael 41-44% (Brann 30% in X). Almost all of it (≥ 88%) is during a Rally, which she always obeys (the design's rule), while the bot Rallies the party into the Bloodmoon's pools. It is not a Showboat fault, and no lever was built for it.
- *Her boss downs where she holds the boss* (SB, W, X). These are the Cantor's Toll and the second Twin Cleave, aimed at her and met unWarded. At Vharun in W (12 seeds), the second blow downed her 9 times, and her Feint (10 s) was ready for only 4 of them. Holding Feint back for the second blow would leave the first unanswered whenever she is unarmed. Not built.
- *The ablation of Oro's rules at every boss* (`verbs.ts --rules oroFocus,oroRally,oroCue`, 50 seeds from 1000, OA, OB, OC, SO, W and X). `oroFocus` pays at Vharun (OA 92 → 76% without it, X 80 → 24%), the Unweaver (X 94 → 82%) and the Conductor (SO 100 → 0%). It costs at the Cantor in the Kael parties: SO 16 → 96%, OC 88 → 100%, OA 100 → 100% (the fight runs 228 → 278 s). Without Kael it neither costs nor pays there (W 98 → 98%, X 96 → 98%, OB 94 → 88%). `oroRally` and `oroCue` pay or are neutral everywhere except a few noisy cells (SO's Vharun +8 and +12, inside its 8% row).

**2. The screen** (Skilled; 25 cells: every road cell, the Cantor and Vharun; 24 seeds on each of 1000 and 500003, pooled to 48). Each entry gives the mean gap to the default party over the 25 cells and the cells past the band, then the Weaver's road damage, Movement III Thread cuts a fight, and Oro's road tending. A blank party cell means the variant cannot reach that party.

| Lever | Change | SA | SB | SC | OA | OB | OC | Kept |
|---|---|---|---|---|---|---|---|---|
| — | none (round 2's tree, `r2`) | −8.0 / 10 | −0.9 / 3 | −1.7 / 3 | +0.8 / 1 · 416 · 1.69 · 19% | +1.3 / 0 · 277 · 1.32 · 34% | +1.6 / 0 · 356 · 1.39 · 31% | |
| 1 | the 13 m clamp → 12 (`clamp12`) | −8.1 / 10 | −2.1 / 5 | −0.7 / 2 | | | | no: SB worse, SA and SC inside noise |
| 1 | the 13 m clamp → 11 (`clamp11`) | −8.5 / 13 | −1.0 / 3 | −1.4 / 3 | | | | no: SA worse (13 cells past) |
| 3 | `groveCover` back on the road with Kael, at heroes 4 : Saplings 1 (`gcw4`) | | | | −1.1 / 4 · 416 · 1.70 · 19%; in field 86 → 89% | | +1.3 / 1 · 363 · 1.43 · 32%; 85 → 89% | no: OA's road worse (4 cells past) |
| 3 | the same at heroes 6 : 1 (`gcw6`) | | | | −0.2 / 4 · 433 · 1.63 · 19%; 88% | | +1.2 / 0 · 353 · 1.51 · 33%; 88% | no: the same |
| 3 | `oroFocus` re-Focus at once (`rf0`) | | | | +0.3 / 3 · 426 · 1.68 · 7% | +1.0 / 0 · 300 · 1.24 · 13% | +1.6 / 0 · 384 · 1.41 · 9% | no: OB's road Weaver damage at its edge |
| 3 | re-Focus after 1 s (`rf1`) | | | | −0.1 / 2 · 424 · 1.67 · 8% | +1.3 / 0 · 296 · 1.22 · 15% | +1.3 / 0 · 386 · 1.40 · 12% | no: the same |
| 3 | **re-Focus after 2 s (`rf2`)** | | | | −0.2 / 3 · 438 · 1.78 · 11% | +0.9 / 0 · 277 · 1.21 · 22% | +1.3 / 0 · 373 · 1.35 · 18% | **kept** |
| 3 | `rf2` + the pack guard at bosses **and minibosses** (`rf2p`) | | | | −0.3 / 3 · 444 · 1.78 · 25% | | +1.1 / 0 · 381 · 1.35 · 30% | no: at the Bellwarden and the Matriarch it brings OC's tending back to 30% |

The boss cells in the screen (the Cantor and Vharun) are byte-identical between `r2` and every re-Focus variant: at a boss a Focus stands all fight, so the re-Focus never fires there.

**3. Checked on whole runs** (100 Finale-route runs on each of 2000 and 900007, the first 100 of the 200-run sets, against round 2's rows on the same seeds; won of 200, pooled). `r2`: OA 135, OB 120, OC 154. `rf0`: 135 / 125 / 152. `rf1`: 142 / 124 / 150. `rf2`: 134 / 118 / 150. All of these sit inside the ±7-run noise of 200 runs. `rf2` was kept for the Weaver's road damage in OB (above), not for wins.

**4. Checked at the bosses** (50 seeds on 1000 and 500003, Idle, Novice and Skilled, against round 2's final rows on the same seeds):
- *The narrower peel* (`bpeelo`: Seren leaves the adds on Kael to him whenever Oro is in the party). SO's Skilled Cantor, Vharun and Unweaver cells are **byte-identical** on both sets. The Conductor moves 100 → 94% (1000) and 92 → 92% (500003). So the peel was never what cost SO in round 2 (corrected below). Not kept.
- *The pack guard, first form* (`bofa`: no `oroFocus` at a boss while a normal, mobile, non-heavy add stands). The Cantor is byte-identical. The boss Focus is set before the first Chorus and then stands all fight, so a guard read later never acts. Not kept; it led to the kept form.
- *The pack guard, second form* (`bpack`: no Focus at all in a fight whose boss calls a pack, in every party with Kael):

  | Party | Cantor, set 1000 | Cantor, set 500003 | Vharun |
  |---|---|---|---|
  | OA | 98 → 100% (231 → 263 s) | 98 → 98% (226 → 260 s) | byte-identical |
  | OC | 96 → 90% | 88 → 98% | byte-identical |
  | SO | 10 → 46% (Weaver damage 1,344 → 842) | 18 → 56% | byte-identical |

  The Novice is byte-identical everywhere: the rules are the Skilled bot's. OC's 90% on set 1000 is −6 against the default party's 96%, past its −5 band, and OA's gain is inside noise at the cost of a 30 s longer fight. So the kept form reads the guard only with Seren in the party, where the Focus was what kept her peel from acting (SO). OA's and OC's Cantor cells are then round 2's, byte for byte (checked on all three sets in the final measurement). This narrowing was decided on set 1000's OC row, which the boss check above had shown. The final measurement's first pass, run with the second form, read OC's Cantor on 777001 as 94 → 94% (unchanged either way).

**5. The clean code** reproduced the flagged runs byte for byte before the narrowing: every road cell of Movements I and II for OA, OB and OC (24 seeds from 1000, against `rf2`), and the Cantor for OA, OC and SO at 50 seeds (against `bpack`). The one exception was the Cantor in the road lane, which differed from `rf2` as the guard intends. After the narrowing, the final measurement re-played the Cantor for the default party, OA, OC and SO on all three sets (`fx-cantor-*`): OA's and OC's rows are round 2's, and SO's are the second form's, byte for byte.

### Tried and not kept (round 3)

| Lever | Change | Where measured | Result | Why not kept |
|---|---|---|---|---|
| 1 | The 13 m clamp (`DUEL_CLAMP`, range 11-13) → 12 | screen | SA −8.0 → −8.1, SB −0.9 → −2.1 (5 cells past), SC −1.7 → −0.7 | SB worse; the rest inside noise |
| 1 | The 13 m clamp → 11 | screen | SA −8.5 (13 cells past), SB −1.0, SC −1.4 | SA worse |
| 2 | Seren's peel off in a party with Oro (round 2's lead for SO) | 50 seeds on 1000 and 500003, SO's bosses | Skilled Cantor, Vharun, Unweaver byte-identical; Conductor 100 → 94% and 92 → 92% | no gain: the peel never fired where SO lost (`oroFocus` held the boss Focus) |
| 3 | `groveCover` back on the road with Kael at heroes 4 : Saplings 1 (for Oro's Novice gap) | screen | Skilled in-field share on the road 86 → 89% (OA), 85 → 89% (OC); OA −1.1 / 4 cells past | OA's road band worse |
| 3 | The same at 6 : 1 | screen | in field 88%; OA −0.2 / 4 past; OC's Thread cuts 1.39 → 1.51 | the same |
| 3 | `oroFocus` re-Focus at once / after 1 s | screen; 100 runs on 2000 and 900007 | tending 7-15%; OB's road Weaver damage 296-300 (limit about 300); runs inside noise | OB's road Weaver-safety band to its edge |
| 3 | No `oroFocus` at a boss while a lesser add stands (Kael parties) | 50 seeds on 1000 and 500003, OA, OC, SO bosses | the Cantor byte-identical; the Conductor moves ±6 | inert where it was meant to act: the boss Focus is set first and stands |
| 3 | The pack guard at minibosses too (the Bellwarden's Choir, the Matriarch's Pack Call) | screen | OA's and OC's road tending back to 25% and 30% | it undoes the re-Focus on the road; kept for bosses only |
| 3 | The pack guard in every party with Kael (OA, OC, SO) | 50 seeds on 1000 and 500003 | the Cantor: OC 96 → 90% and 88 → 98%, OA 98 → 100% and 98% (30 s longer), SO 10 → 46% and 18 → 56% | OC past its band on set 1000; kept only with Kael and Seren |


### Seren holds the Kael-less bosses (default, awaiting your confirmation)

Unchanged from rounds 1 and 2, and still **lever 2, not lever 1**. `threatMult` at its +20% edge (1.2) put SB's bosses on her only 0-3% of the time and W's 5-18%. So the prep's `duelThreat` stands: `DUEL_BOSS_THREAT` ×6, inert unless Seren is in the party and Kael is not. Its one call site is a guarded line in `dealDamage` (`src/sim/combat/health.ts`), which returns at once for any source without `hero.duel` and in any party with a tank. Round 3's rules are bot rules and do not touch it. The hold and its cost are in the final tables below.

### Round 2's report, corrected

Round 2's verifier found these. Each is fixed in this section, and the round-2 rows above carry a *corrected in W9 round 3* note.
- **'Seren: ≥ 50% of the Wards on her parry' was read as met where it is missed.** The band has no 'where she holds the boss' condition. Round 2's own numbers show SA's bosses at 8-10%, SC's at 15-17%, R's at 9-10% and SO's at 14%. So it is **missed** for SA (road and bosses), SC, R and SO at the bosses, and met for SB, W and X at the bosses and on SB's and SC's road. Round 3 states it that way.
- **The Novice band's first half was dropped.** The band reads 'inside each Movement's 5b/5c/5d Novice row; ≤ Skilled': the Cantor 25-70% and Vharun 20-60% (docs/phase-5b.md), the Unweaver 25-55% (docs/phase-5c.md), and the Conductor 15-40% (docs/phase-5d.md). Round 2 read only '≤ Skilled'. On round 2's data the full band is **missed for SA, SC, OA and OC on every set**: SA's, OA's and OC's Novice win the Unweaver 0%, and the Conductor 0-14%. Party A's 0% Novice Unweaver was accepted in 5c, and these parties repeat it. OB's Novice band is 'recorded' (Q8). `bands.py` now prints the full band, and round 3's table below uses it.
- **The Sentinel exception and the third sets.** Round 2's Sentinel exception to `oroFocus` was added after the third sets (cells 777001, runs 333003) had been read. The drop it fixed showed on both tuning sets, so the decision did not rest on 777001. Strictly, though, the third sets were no longer untouched for that rule. Round 3 kept to the protocol, with one disclosed exception (*How the round chose them*, step 4): the pack guard's narrowing was decided on set 1000's OC row, after the first pass of the final measurement had also read 777001.
- **`duelThreat` touches a shared file.** The rule lives in `duel.ts`, but its call is a guarded line in `src/sim/combat/health.ts` (`dealDamage`). It is inert for every other source and party, and the 22 baselines and 19 goldens are byte-equal. The *By party* note now says where the call sits.
- **Seren's peel is wider than its diagnosis, and it did not cost SO.** The rule reaches every party with Kael and Seren: SA, SC, R and SO. Round 2 put SO's fall at its bosses on the peel. Round 3's check says otherwise: with the peel off in parties with Oro, SO's Skilled Cantor, Vharun and Unweaver are byte-identical, because `oroFocus`'s boss Focus stood all fight and a Focus overrides Showboat. The fall came from `oroFocus`, and round 3's pack guard takes it back at the Cantor. The peel is still flagged for you (NEEDS USER).
- **`roster20.test.ts`** still lets SO's Skilled Vharun on seed 1000 run to the 540 s cap. Round 3 did not move SO's Vharun: 8% won on 1000 and 500003, and the guard is inert there. It is still flagged.


### The final measurement (the full protocol, on the committed tree)

What ran (scratch `final{1,2,3}.sh`, one lane a set, never more than three heavy jobs at once), as in rounds 1 and 2:
- **Cells**, 50 seeds on each of 1000, 500003 and 777001: every boss (Idle, Novice, Skilled) for the default party and the ten banded parties, and every skirmish, elite and miniboss cell of the three Movements' roads (Novice and Skilled) for the default party and the six full-protocol parties.
- **Whole runs**, 200 seeds on each of 2000, 900007 and 333003: Finale-route Expeditions (Skilled) for the eleven, and whole Preludes (Novice and Skilled) for the seven.
- **The Cantor re-run** (`refix.sh`, `merge3.py`). The boss cells ran first, with the pack guard's second form (every party with Kael). The guard was then narrowed to Kael and Seren (*How the round chose them*, step 4), before the road finished and before any whole run started. So every road cell, whole run and Prelude here ran on the committed rules. The Cantor was then played again for the default party, OA, OC and SO on all three sets, and those rows replace the first pass (kept in `raw/c1/`). The merge asserts that the default party's rows are byte-identical. OA's and OC's Skilled, Novice and Idle Cantor rows are byte-identical to round 2's. SO's Skilled Cantor moved a little from the first pass, because the kept rule reads the *standing* party, so a downed Seren lifts it: 46 → 44% (1000), 56 → 52% (500003) and 38 → 40% (777001). Its Novice and Idle rows are unchanged. No other boss calls a pack, so no other boss row can move.
- Then the Callings, the Anchor, the Decree gate, the unbanded smoke and pacing (below).
- **Byte-identical to round 2 by construction, and checked.** Every row of the default party, SA, SB, SC and R, on every set (cells and runs). The two rules read Oro's `groveOf`, so they cannot reach a party without him.

**The bands, set by set** (met only on all three sets; otherwise seed-sensitive k of 3):

| Band | Party | set 1000 | set 500003 | set 777001 | Status |
|---|---|---|---|---|---|
| Road cells, Skilled ≥ default − 5 | SA | 13 of 23 past | 8 of 23 past | 8 of 23 past | missed |
| Road cells, Skilled ≥ default − 5 | SB | 4 of 23 past | 4 of 23 past | 5 of 23 past | missed |
| Road cells, Skilled ≥ default − 5 | SC | 6 of 23 past | 6 of 23 past | 6 of 23 past | missed |
| Road cells, Skilled ≥ default − 5 | OA | 2 of 23 past | 1 of 23 past | 0 of 23 past | seed-sensitive 1 of 3 |
| Road cells, Skilled ≥ default − 10 | OB | 0 of 23 past | 1 of 23 past | 0 of 23 past | seed-sensitive 2 of 3 |
| Road cells, Skilled ≥ default − 5 | OC | 0 of 23 past | 0 of 23 past | 0 of 23 past | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | SA | +2 / -4 / +0 / +4 | +6 / -4 / +0 / +2 | +4 / +8 / +2 / +0 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 | SB | +4 / -6 / -10 / +0 | +8 / -10 / -6 / +4 | +2 / +6 / -4 / +2 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | SC | -8 / +0 / -2 / +4 | +6 / -4 / -2 / +4 | +4 / +8 / +0 / +2 | seed-sensitive 2 of 3 |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | OA | +2 / -6 / +0 / -2 | +8 / -6 / +0 / +2 | +6 / -2 / +0 / +2 | seed-sensitive 1 of 3 |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 25 | OB | +0 / -2 / -4 / +0 | +8 / +0 / +0 / -6 | -6 / +8 / +2 / -8 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 5 | OC | +0 / +0 / -2 / +2 | -2 / +0 / +0 / +2 | +2 / +10 / +0 / +2 | met |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | R | -4 / -50 / -2 / -4 | +0 / -60 / -2 / +2 | +2 / -40 / +0 / +2 | missed |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | SO | -52 / -90 / -76 / +0 | -38 / -92 / -52 / -4 | -52 / -70 / -54 / +0 | missed |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | X | -6 / -18 / -4 / +2 | +8 / -18 / -2 / -4 | +4 / -10 / +2 / -4 | seed-sensitive 1 of 3 |
| Bosses (Cantor / Vharun / Unweaver / Conductor), ≥ default − 15 (printed) | W | +4 / -10 / -2 / +2 | +6 / -6 / +0 / +4 | +6 / +4 / +2 / +2 | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | SA | road min 38% · bosses min 42% | road min 38% · bosses min 42% | road min 38% · bosses min 41% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | SB | road min 39% · bosses min 41% | road min 38% · bosses min 41% | road min 39% · bosses min 41% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | SC | road min 43% · bosses min 43% | road min 44% · bosses min 43% | road min 42% · bosses min 43% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | OA | road min 41% · bosses min 44% | road min 41% · bosses min 44% | road min 41% · bosses min 45% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | OB | road min 45% · bosses min 38% | road min 45% · bosses min 37% | road min 45% · bosses min 37% | met |
| Skilled share ≥ 35% road, ≥ 30% bosses | OC | road min 49% · bosses min 46% | road min 50% · bosses min 46% | road min 49% · bosses min 46% | met |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | SA | 19 cells over +15% · Conductor 233 s | 19 cells over +15% · Conductor 225 s | 19 cells over +15% · Conductor 230 s | missed |
| Skilled length, ≤ 280 s at the Conductor | SB | Conductor 158 s | Conductor 158 s | Conductor 159 s | met |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | SC | 9 cells over +15% · Conductor 210 s | 8 cells over +15% · Conductor 211 s | 8 cells over +15% · Conductor 207 s | missed |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | OA | 26 cells over +15% · Conductor 234 s | 25 cells over +15% · Conductor 235 s | 26 cells over +15% · Conductor 237 s | missed |
| Skilled length, ≤ 280 s at the Conductor | OB | Conductor 163 s | Conductor 162 s | Conductor 158 s | met |
| Skilled length, cells ≤ default + 15%; Conductor 170-280 s | OC | 20 cells over +15% · Conductor 210 s | 17 cells over +15% · Conductor 214 s | 21 cells over +15% · Conductor 213 s | missed |
| Idle at bosses 0% | SA | 0% | 0% | 0% | met |
| Idle at bosses 0% | SB | 0% | 0% | 0% | met |
| Idle at bosses 0% | SC | 0% | 0% | 0% | met |
| Idle at bosses 0% | OA | 0% | 0% | 0% | met |
| Idle at bosses 0% | OB | 0% | 0% | 0% | met |
| Idle at bosses 0% | OC | 0% | 0% | 0% | met |
| Idle at bosses 0% | R | 0% | 0% | 0% | met |
| Idle at bosses 0% | SO | 0% | 0% | 0% | met |
| Idle at bosses 0% | X | 0% | 0% | 0% | met |
| Idle at bosses 0% | W | 0% | 0% | 0% | met |
| Novice at bosses (%), inside each Movement’s Novice row; ≤ Skilled | SA | 58 / 56 / 0 / 14; outside the row: Unweaver 0, Conductor 14 | 38 / 60 / 0 / 8; outside the row: Unweaver 0, Conductor 8 | 50 / 52 / 0 / 6; outside the row: Unweaver 0, Conductor 6 | missed |
| Novice at bosses (%), ≤ Skilled; ≥ 10% | SB | 78 / 82 / 20 / 32 | 78 / 80 / 44 / 30 | 82 / 68 / 24 / 38 | met |
| Novice at bosses (%), inside each Movement’s Novice row; ≤ Skilled | SC | 36 / 60 / 26 / 12; outside the row: Conductor 12 | 46 / 70 / 22 / 18; outside the row: Vharun 70, Unweaver 22 | 24 / 74 / 26 / 12; outside the row: Cantor 24, Vharun 74, Conductor 12 | missed |
| Novice at bosses (%), inside each Movement’s Novice row; ≤ Skilled | OA | 52 / 44 / 0 / 4; outside the row: Unweaver 0, Conductor 4 | 44 / 48 / 0 / 4; outside the row: Unweaver 0, Conductor 4 | 52 / 36 / 0 / 0; outside the row: Unweaver 0, Conductor 0 | missed |
| Novice at bosses (%), recorded (Q8) | OB | 28 / 18 / 0 / 2 | 38 / 2 / 0 / 2 | 30 / 6 / 4 / 12 | recorded |
| Novice at bosses (%), inside each Movement’s Novice row; ≤ Skilled | OC | 6 / 70 / 0 / 10; outside the row: Cantor 6, Vharun 70, Unweaver 0, Conductor 10 | 18 / 64 / 0 / 2; outside the row: Cantor 18, Vharun 64, Unweaver 0, Conductor 2 | 8 / 64 / 0 / 8; outside the row: Cantor 8, Vharun 64, Unweaver 0, Conductor 8 | missed |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | SA | 58% (-30); Novice 6% (default 38%) | 62% (-26); Novice 10% (default 32%) | 54% (-32); Novice 8% (default 32%) | missed |
| Whole Prelude, Skilled ≥ default − 5 | SB | 94% (+6); Novice 65% (default 38%) | 94% (+6); Novice 68% (default 32%) | 96% (+9); Novice 66% (default 32%) | met |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | SC | 78% (-11); Novice 21% (default 38%) | 78% (-9); Novice 18% (default 32%) | 78% (-7); Novice 22% (default 32%) | missed |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | OA | 82% (-6); Novice 14% (default 38%) | 82% (-6); Novice 16% (default 32%) | 84% (-2); Novice 12% (default 32%) | missed |
| Whole Prelude, Skilled ≥ default − 10 | OB | 81% (-7); Novice 3% (default 38%) | 83% (-5); Novice 2% (default 32%) | 83% (-3); Novice 4% (default 32%) | met |
| Whole Prelude, Skilled ≥ default − 5; Novice ≥ 50% of default | OC | 88% (-1); Novice 10% (default 38%) | 89% (+2); Novice 5% (default 32%) | 83% (-3); Novice 8% (default 32%) | missed |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | SA | 27.5% (-44.5); reached 28.5%, won 96% of those; 18.3 min | 30.5% (-37.5); reached 30.5%, won 100% of those; 19.6 min | 32.0% (-33.5); reached 32.0%, won 100% of those; 18.8 min | missed |
| Whole Finale-route Expedition, won ≥ default − 10 | SB | 62.5% (-9.5); reached 64.5%, won 97% of those; 17.5 min | 61.0% (-7.0); reached 63.0%, won 97% of those; 17.4 min | 55.5% (-10.0); reached 57.0%, won 97% of those; 16.9 min | met |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | SC | 60.5% (-11.5); reached 61.0%, won 99% of those; 20.6 min | 49.5% (-18.5); reached 50.5%, won 98% of those; 18.1 min | 57.5% (-8.0); reached 57.5%, won 100% of those; 19.2 min | missed |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | OA | 66.0% (-6.0); reached 67.0%, won 99% of those; 29.1 min | 68.5% (+0.5); reached 70.5%, won 97% of those; 29.7 min | 66.5% (+1.0); reached 67.0%, won 99% of those; 28.5 min | seed-sensitive 2 of 3 |
| Whole Finale-route Expedition, won ≥ default − 20 (provisional) | OB | 57.5% (-14.5); reached 59.5%, won 97% of those; 17.7 min | 61.0% (-7.0); reached 61.5%, won 99% of those; 17.8 min | 54.0% (-11.5); reached 57.5%, won 94% of those; 16.9 min | met |
| Whole Finale-route Expedition, won ≥ default − 5 and ≥ 55% | OC | 79.5% (+7.5); reached 81.5%, won 98% of those; 23.1 min | 78.5% (+10.5); reached 80.0%, won 98% of those; 23.1 min | 84.5% (+19.0); reached 87.0%, won 97% of those; 24.4 min | met |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | R | 2.0% (-70.0); reached 2.0%, won 100% of those; 14.9 min | 1.5% (-66.5); reached 1.5%, won 100% of those; 15.6 min | 0.5% (-65.0); reached 0.5%, won 100% of those; 13.9 min | missed |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | SO | 0.5% (-71.5); reached 0.5%, won 100% of those; 12.1 min | 0.0% (-68.0); reached 0.0%, won nan% of those; 12.2 min | 0.0% (-65.5); reached 0.0%, won nan% of those; 11.9 min | missed |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | X | 27.5% (-44.5); reached 28.0%, won 98% of those; 21.8 min | 24.5% (-43.5); reached 26.5%, won 92% of those; 21.5 min | 24.5% (-41.0); reached 26.0%, won 94% of those; 22.2 min | missed |
| Whole Finale-route Expedition, won ≥ default − 15 (printed) | W | 47.0% (-25.0); reached 48.0%, won 98% of those; 22.2 min | 51.0% (-17.0); reached 52.0%, won 98% of those; 22.7 min | 44.0% (-21.5); reached 44.0%, won 100% of those; 21.9 min | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) | OA | bosses 959/2.12 (default 509/1.06); road 436/0.59 (261/0.27) | bosses 917/1.98 (default 543/1.15); road 442/0.59 (264/0.29) | bosses 950/2.12 (default 518/1.11); road 442/0.57 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) | OB | bosses 626/1.31 (default 509/1.06); road 281/0.32 (261/0.27) | bosses 599/1.25 (default 543/1.15); road 276/0.32 (264/0.29) | bosses 674/1.55 (default 518/1.11); road 286/0.37 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) | OC | bosses 624/1.30 (default 509/1.06); road 385/0.52 (261/0.27) | bosses 684/1.43 (default 543/1.15); road 375/0.48 (264/0.29) | bosses 642/1.27 (default 518/1.11); road 376/0.48 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) (printed) | SA | bosses 1029/2.14 (default 509/1.06); road 407/0.70 (261/0.27) | bosses 1006/2.00 (default 543/1.15); road 409/0.70 (264/0.29) | bosses 960/1.85 (default 518/1.11); road 413/0.69 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) (printed) | SB | bosses 524/1.18 (default 509/1.06); road 269/0.37 (261/0.27) | bosses 530/1.18 (default 543/1.15); road 281/0.39 (264/0.29) | bosses 541/1.29 (default 518/1.11); road 267/0.37 (259/0.28) | missed |
| Weaver safety (damage ≤ default + 15%, downs ≤ default + 0.05) (printed) | SC | bosses 808/1.68 (default 509/1.06); road 394/0.65 (261/0.27) | bosses 779/1.63 (default 543/1.15); road 392/0.66 (264/0.29) | bosses 811/1.71 (default 518/1.11); road 388/0.63 (259/0.28) | missed |
| Thread cuts, Movement III, ≤ default + 25% a fight | OA | 2.08 (default 1.06) | 2.00 (default 1.00) | 2.01 (default 1.02) | missed |
| Thread cuts, Movement III, ≤ default + 25% a fight | OB | 1.23 (default 1.06) | 1.16 (default 1.00) | 1.24 (default 1.02) | met |
| Thread cuts, Movement III, ≤ default + 25% a fight | OC | 1.40 (default 1.06) | 1.39 (default 1.00) | 1.39 (default 1.02) | missed |
| Bond XP a fight ≥ 75% of the starters' | SA | Seren 66% | Seren 66% | Seren 65% | missed |
| Bond XP a fight ≥ 75% of the starters' | SB | Seren 73% | Seren 73% | Seren 73% | missed |
| Bond XP a fight ≥ 75% of the starters' | SC | Seren 62% | Seren 62% | Seren 61% | missed |
| Bond XP a fight ≥ 75% of the starters' | OA | Oro 69% | Oro 69% | Oro 69% | missed |
| Bond XP a fight ≥ 75% of the starters' | OB | Oro 67% | Oro 67% | Oro 67% | missed |
| Bond XP a fight ≥ 75% of the starters' | OC | Oro 64% | Oro 64% | Oro 64% | missed |
| Bond XP a fight ≥ 75% of the starters' | W | Seren 73%, Oro 64% | Seren 73%, Oro 64% | Seren 73%, Oro 64% | missed |
| Bond XP a fight ≥ 75% of the starters' | X | (no starter) | (no starter) | (no starter) | n/a |
| Bond XP a fight ≥ 75% of the starters' | R | Seren 69% | Seren 70% | Seren 69% | missed |
| Bond XP a fight ≥ 75% of the starters' | SO | Seren 85%, Oro 72% | Seren 84%, Oro 73% | Seren 86%, Oro 73% | missed |

#### Bosses (Skilled win, the Novice's in brackets, gap to default; 50 seeds a cell)

| Party | set 1000: Cantor / Vharun / Unweaver / Conductor | set 500003: Cantor / Vharun / Unweaver / Conductor | set 777001: Cantor / Vharun / Unweaver / Conductor |
|---|---|---|---|
| default | 96 (56) / 98 (46) / 100 (42) / 96 (30) | 90 (62) / 100 (50) / 100 (48) / 96 (26) | 92 (72) / 90 (56) / 98 (46) / 98 (18) |
| SA | 98 (58) +2 / 94 (56) -4 / 100 (0) +0 / 100 (14) +4 | 96 (38) +6 / 96 (60) -4 / 100 (0) +0 / 98 (8) +2 | 96 (50) +4 / 98 (52) +8 / 100 (0) +2 / 98 (6) +0 |
| SB | 100 (78) +4 / 92 (82) -6 / 90 (20) -10 / 96 (32) +0 | 98 (78) +8 / 90 (80) -10 / 94 (44) -6 / 100 (30) +4 | 94 (82) +2 / 96 (68) +6 / 94 (24) -4 / 100 (38) +2 |
| SC | 88 (36) -8 / 98 (60) +0 / 98 (26) -2 / 100 (12) +4 | 96 (46) +6 / 96 (70) -4 / 98 (22) -2 / 100 (18) +4 | 96 (24) +4 / 98 (74) +8 / 98 (26) +0 / 100 (12) +2 |
| OA | 98 (52) +2 / 92 (44) -6 / 100 (0) +0 / 94 (4) -2 | 98 (44) +8 / 94 (48) -6 / 100 (0) +0 / 98 (4) +2 | 98 (52) +6 / 88 (36) -2 / 98 (0) +0 / 100 (0) +2 |
| OB | 96 (28) +0 / 96 (18) -2 / 96 (0) -4 / 96 (2) +0 | 98 (38) +8 / 100 (2) +0 / 100 (0) +0 / 90 (2) -6 | 86 (30) -6 / 98 (6) +8 / 100 (4) +2 / 90 (12) -8 |
| OC | 96 (6) +0 / 98 (70) +0 / 98 (0) -2 / 98 (10) +2 | 88 (18) -2 / 100 (64) +0 / 100 (0) +0 / 98 (2) +2 | 94 (8) +2 / 100 (64) +10 / 98 (0) +0 / 100 (8) +2 |
| R | 92 (0) -4 / 48 (20) -50 / 98 (0) -2 / 92 (0) -4 | 90 (0) +0 / 40 (12) -60 / 98 (0) -2 / 98 (0) +2 | 94 (0) +2 / 50 (18) -40 / 98 (0) +0 / 100 (0) +2 |
| SO | 44 (0) -52 / 8 (38) -90 / 24 (0) -76 / 96 (0) +0 | 52 (0) -38 / 8 (40) -92 / 48 (0) -52 / 92 (0) -4 | 40 (0) -52 / 20 (34) -70 / 44 (0) -54 / 98 (4) +0 |
| X | 90 (30) -6 / 80 (46) -18 / 96 (0) -4 / 98 (2) +2 | 98 (36) +8 / 82 (46) -18 / 98 (0) -2 / 92 (4) -4 | 96 (36) +4 / 80 (42) -10 / 100 (0) +2 / 94 (2) -4 |
| W | 100 (54) +4 / 88 (70) -10 / 98 (0) -2 / 98 (20) +2 | 96 (58) +6 / 94 (70) -6 / 100 (0) +0 / 100 (20) +4 | 98 (64) +6 / 94 (70) +4 / 100 (0) +2 / 100 (24) +2 |

#### The road (Skilled, 23 skirmish, elite and miniboss cells, 50 seeds; mean gap to default and the cells past the band)

| Party | set 1000 | set 500003 | set 777001 |
|---|---|---|---|
| SA (band −5) | -9.5; Blood Forge -28, Blood Rites -14, Crimson Gate -6, Frayed Court -28, Frayed Threshold -30, Glass Gallery -32, Maw Hollow -8, Muted Nave -14, Null Chapel -10, Pike Line -6, Shield Wall -14, Tolling Halls -20, Wraith Vigil -16 | -9.0; Blood Forge -24, Blood Rites -16, Frayed Court -40, Frayed Threshold -40, Glass Gallery -30, Muted Nave -16, Shield Wall -26, Tolling Halls -12 | -9.0; Blood Forge -34, Blood Rites -14, Frayed Court -42, Frayed Threshold -20, Glass Gallery -20, Muted Nave -22, Shield Wall -18, Wraith Vigil -18 |
| SB (band −5) | -2.1; Blood Forge -10, Frayed Court -22, Frayed Threshold -14, Null Chapel -8 | -1.6; Blood Forge -12, Frayed Court -12, Null Chapel -6, Shield Wall -16 | -1.9; Frayed Court -14, Frayed Threshold -16, Mirror Hall -6, Null Chapel -10, Shield Wall -8 |
| SC (band −5) | -2.0; Frayed Court -8, Frayed Threshold -8, Glass Gallery -16, Maw Hollow -14, Mirror Hall -6, Wraith Vigil -6 | -2.5; Frayed Court -12, Frayed Threshold -6, Glass Gallery -10, Maw Hollow -26, Mirror Hall -6, Muted Nave -10 | -3.0; Blood Forge -8, Frayed Court -16, Frayed Threshold -8, Glass Gallery -18, Maw Hollow -14, Shield Wall -8 |
| OA (band −5) | -0.6; Glass Gallery -26, Mirror Hall -6 | +0.7; Glass Gallery -14 | +0.5; none past |
| OB (band −10) | +0.6; none past | +0.5; The Seamstress -12 | -0.3; none past |
| OC (band −5) | +0.8; none past | +1.2; none past | +1.4; none past |

#### Seren's and Oro's own numbers, and who holds the bosses

**Seren, set 1000** (Skilled; "road" = every skirmish, elite and miniboss cell; "bosses" = the four bosses)

| Party | Wards on her parried: road / bosses | counters + kill shots, share of her damage (skirmishes and elites) | kill shots a fight, elite+boss cells (Novice) | lost | beyond 14 m | overextensions answered ≤ 3 s | Showboat pick | downs a fight: road / bosses | Skilled parries ÷ Novice (bosses) |
|---|---|---|---|---|---|---|---|---|---|
| SA | 47% / 10% | 8% | 0.58 (0.05) | 0.00 | 0% | 65% | 71% | 0.14 / 0.20 | 0.4 ÷ 1.2 |
| SB | 61% / 59% | 12% | 1.21 (0.51) | 0.11 | 0% | 77% | 79% | 0.10 / 0.41 | 8.1 ÷ 16.0 |
| SC | 53% / 17% | 8% | 0.29 (0.04) | 0.00 | 0% | 79% | 70% | 0.10 / 0.29 | 0.6 ÷ 3.2 |
| R | - / 9% | - | 0.63 (0.06) | 0.01 | 0% | 72% | 89% | 0.00 / 0.59 | 0.6 ÷ 1.7 |
| SO | - / 14% | - | 1.03 (0.07) | 0.00 | 0% | 69% | 98% | 0.00 / 1.49 | 1.5 ÷ 2.9 |
| X | - / 59% | - | 2.95 (0.85) | 0.73 | 0% | 85% | 100% | 0.00 / 0.85 | 15.0 ÷ 18.8 |
| W | - / 55% | - | 2.77 (1.19) | 0.73 | 0% | 76% | 100% | 0.00 / 0.61 | 11.6 ÷ 21.6 |

**Oro, set 1000** (Skilled; the Novice beside the in-field share)

| Party | Saplings in your field: road / bosses (Novice road / bosses) | both standing | tending: road / bosses (Novice road) | felled a fight | downs a fight: road / bosses | Rootbond a fight | Ancient taunt s · aura s | timeouts (540 s), Skilled: road / bosses (Novice bosses) |
|---|---|---|---|---|---|---|---|---|
| OA | 85% / 93% (78% / 85%) | 98% | 11% / 1% (44%) | 0.34 | 0.09 / 0.22 | 353 | 9.7 · 12.7 | 1 of 1150 / 0 of 200 (15 of 200) |
| OB | 87% / 59% (80% / 70%) | 95% | 22% / 1% (51%) | 0.61 | 0.13 / 0.18 | 504 | 6.3 · 8.2 | 1 of 1150 / 0 of 200 (1 of 200) |
| OC | 84% / 93% (78% / 85%) | 97% | 18% / 1% (49%) | 0.35 | 0.03 / 0.12 | 361 | 8.3 · 10.6 | 0 of 1150 / 0 of 200 (10 of 200) |
| SO | - / 91% (- / 87%) | 99% | - / 6% (-) | 0.63 | 0.00 / 0.70 | 387 | 18.8 · 50.6 | 0 of 0 / 32 of 200 (33 of 200) |
| X | - / 93% (- / 89%) | 100% | - / 1% (-) | 0.14 | 0.00 / 0.21 | 658 | 17.0 · 41.3 | 0 of 0 / 0 of 200 (31 of 200) |
| W | - / 94% (- / 87%) | 100% | - / 1% (-) | 0.21 | 0.00 / 0.22 | 691 | 13.5 · 31.2 | 0 of 0 / 0 of 200 (19 of 200) |

**Who holds the bosses, set 1000** (Skilled, pooled over the four bosses: share of boss time on each hero)

| Party | kael | lyra | vexis | brann | seren | oro | sapling | ancient |
|---|---|---|---|---|---|---|---|---|
| default | 46% | 50% | 3% |  |  |  |  |  |
| SA | 51% |  | 48% |  | 0% |  |  |  |
| SB |  | 4% | 1% |  | 95% |  |  |  |
| SC | 43% | 57% |  |  | 0% |  |  |  |
| OA | 61% |  | 38% |  |  | 0% |  |  |
| OB |  | 95% | 4% |  |  | 0% |  |  |
| OC | 42% | 57% |  |  |  | 0% |  |  |
| R | 86% |  |  | 11% | 1% |  |  |  |
| SO | 94% |  |  |  | 4% | 2% |  |  |
| X |  |  |  | 1% | 97% | 1% |  |  |
| W |  |  | 1% |  | 98% | 0% |  |  |

**Seren, set 500003** (Skilled; "road" = every skirmish, elite and miniboss cell; "bosses" = the four bosses)

| Party | Wards on her parried: road / bosses | counters + kill shots, share of her damage (skirmishes and elites) | kill shots a fight, elite+boss cells (Novice) | lost | beyond 14 m | overextensions answered ≤ 3 s | Showboat pick | downs a fight: road / bosses | Skilled parries ÷ Novice (bosses) |
|---|---|---|---|---|---|---|---|---|---|
| SA | 48% / 9% | 8% | 0.50 (0.06) | 0.00 | 0% | 66% | 71% | 0.15 / 0.20 | 0.4 ÷ 1.1 |
| SB | 60% / 58% | 12% | 1.28 (0.48) | 0.11 | 0% | 77% | 78% | 0.09 / 0.38 | 8.0 ÷ 16.5 |
| SC | 52% / 15% | 8% | 0.32 (0.03) | 0.00 | 0% | 79% | 70% | 0.09 / 0.29 | 0.6 ÷ 3.0 |
| R | - / 10% | - | 0.81 (0.03) | 0.00 | 0% | 68% | 89% | 0.00 / 0.64 | 0.7 ÷ 1.5 |
| SO | - / 15% | - | 1.19 (0.06) | 0.00 | 0% | 73% | 98% | 0.00 / 1.50 | 1.6 ÷ 2.6 |
| X | - / 60% | - | 2.98 (0.89) | 0.68 | 0% | 84% | 100% | 0.00 / 1.14 | 15.0 ÷ 18.8 |
| W | - / 55% | - | 2.65 (1.25) | 0.75 | 0% | 76% | 100% | 0.00 / 0.57 | 11.6 ÷ 20.9 |

**Oro, set 500003** (Skilled; the Novice beside the in-field share)

| Party | Saplings in your field: road / bosses (Novice road / bosses) | both standing | tending: road / bosses (Novice road) | felled a fight | downs a fight: road / bosses | Rootbond a fight | Ancient taunt s · aura s | timeouts (540 s), Skilled: road / bosses (Novice bosses) |
|---|---|---|---|---|---|---|---|---|
| OA | 85% / 93% (77% / 85%) | 98% | 11% / 1% (45%) | 0.30 | 0.09 / 0.17 | 349 | 9.0 · 12.4 | 0 of 1150 / 0 of 200 (19 of 200) |
| OB | 87% / 59% (80% / 71%) | 95% | 22% / 1% (50%) | 0.59 | 0.12 / 0.23 | 526 | 6.2 · 8.0 | 0 of 1150 / 0 of 200 (1 of 200) |
| OC | 85% / 92% (77% / 86%) | 97% | 18% / 1% (49%) | 0.32 | 0.05 / 0.13 | 347 | 8.1 · 10.5 | 0 of 1150 / 0 of 200 (12 of 200) |
| SO | - / 91% (- / 87%) | 99% | - / 5% (-) | 0.89 | 0.00 / 0.64 | 476 | 19.9 · 50.6 | 0 of 0 / 30 of 200 (33 of 200) |
| X | - / 92% (- / 89%) | 100% | - / 1% (-) | 0.07 | 0.00 / 0.26 | 589 | 15.8 · 40.1 | 0 of 0 / 1 of 200 (34 of 200) |
| W | - / 94% (- / 87%) | 100% | - / 1% (-) | 0.24 | 0.00 / 0.20 | 738 | 15.1 · 31.4 | 0 of 0 / 0 of 200 (15 of 200) |

**Who holds the bosses, set 500003** (Skilled, pooled over the four bosses: share of boss time on each hero)

| Party | kael | lyra | vexis | brann | seren | oro | sapling | ancient |
|---|---|---|---|---|---|---|---|---|
| default | 45% | 51% | 4% |  |  |  |  |  |
| SA | 51% |  | 49% |  | 0% |  |  |  |
| SB |  | 4% | 0% |  | 95% |  |  |  |
| SC | 44% | 55% |  |  | 0% |  |  |  |
| OA | 58% |  | 41% |  |  | 0% |  |  |
| OB |  | 96% | 2% |  |  | 0% |  |  |
| OC | 42% | 57% |  |  |  | 0% |  |  |
| R | 86% |  |  | 11% | 1% |  |  |  |
| SO | 93% |  |  |  | 5% | 2% |  |  |
| X |  |  |  | 2% | 96% | 1% |  |  |
| W |  |  | 1% |  | 98% | 1% |  |  |

**Seren, set 777001** (Skilled; "road" = every skirmish, elite and miniboss cell; "bosses" = the four bosses)

| Party | Wards on her parried: road / bosses | counters + kill shots, share of her damage (skirmishes and elites) | kill shots a fight, elite+boss cells (Novice) | lost | beyond 14 m | overextensions answered ≤ 3 s | Showboat pick | downs a fight: road / bosses | Skilled parries ÷ Novice (bosses) |
|---|---|---|---|---|---|---|---|---|---|
| SA | 47% / 8% | 8% | 0.53 (0.07) | 0.00 | 0% | 69% | 71% | 0.14 / 0.18 | 0.3 ÷ 1.3 |
| SB | 60% / 58% | 11% | 1.34 (0.55) | 0.11 | 0% | 78% | 78% | 0.10 / 0.40 | 8.2 ÷ 16.3 |
| SC | 54% / 15% | 9% | 0.35 (0.02) | 0.00 | 0% | 79% | 70% | 0.11 / 0.26 | 0.5 ÷ 3.1 |
| R | - / 9% | - | 0.84 (0.03) | 0.00 | 0% | 76% | 89% | 0.00 / 0.56 | 0.7 ÷ 1.6 |
| SO | - / 15% | - | 1.10 (0.05) | 0.00 | 0% | 69% | 98% | 0.00 / 1.67 | 1.5 ÷ 2.5 |
| X | - / 59% | - | 3.02 (0.94) | 0.69 | 0% | 86% | 100% | 0.00 / 0.99 | 15.0 ÷ 18.9 |
| W | - / 55% | - | 2.70 (1.18) | 0.75 | 0% | 77% | 100% | 0.00 / 0.64 | 11.7 ÷ 21.5 |

**Oro, set 777001** (Skilled; the Novice beside the in-field share)

| Party | Saplings in your field: road / bosses (Novice road / bosses) | both standing | tending: road / bosses (Novice road) | felled a fight | downs a fight: road / bosses | Rootbond a fight | Ancient taunt s · aura s | timeouts (540 s), Skilled: road / bosses (Novice bosses) |
|---|---|---|---|---|---|---|---|---|
| OA | 86% / 93% (78% / 85%) | 98% | 12% / 1% (45%) | 0.30 | 0.08 / 0.23 | 352 | 9.6 · 12.4 | 0 of 1150 / 0 of 200 (15 of 200) |
| OB | 87% / 58% (79% / 71%) | 94% | 22% / 1% (50%) | 0.64 | 0.17 / 0.26 | 510 | 6.2 · 7.9 | 0 of 1150 / 0 of 200 (0 of 200) |
| OC | 85% / 93% (77% / 86%) | 97% | 18% / 1% (49%) | 0.32 | 0.04 / 0.10 | 354 | 8.2 · 10.3 | 0 of 1150 / 0 of 200 (11 of 200) |
| SO | - / 91% (- / 87%) | 99% | - / 5% (-) | 0.81 | 0.00 / 0.69 | 436 | 19.7 · 50.4 | 0 of 0 / 23 of 200 (33 of 200) |
| X | - / 92% (- / 89%) | 100% | - / 1% (-) | 0.07 | 0.00 / 0.22 | 468 | 16.3 · 41.5 | 0 of 0 / 0 of 200 (29 of 200) |
| W | - / 94% (- / 86%) | 99% | - / 1% (-) | 0.27 | 0.00 / 0.20 | 756 | 13.9 · 30.7 | 0 of 0 / 0 of 200 (18 of 200) |

**Who holds the bosses, set 777001** (Skilled, pooled over the four bosses: share of boss time on each hero)

| Party | kael | lyra | vexis | brann | seren | oro | sapling | ancient |
|---|---|---|---|---|---|---|---|---|
| default | 47% | 49% | 3% |  |  |  |  |  |
| SA | 53% |  | 47% |  | 0% |  |  |  |
| SB |  | 3% | 0% |  | 96% |  |  |  |
| SC | 45% | 54% |  |  | 0% |  |  |  |
| OA | 62% |  | 38% |  |  | 0% |  |  |
| OB |  | 97% | 2% |  |  | 1% |  |  |
| OC | 42% | 58% |  |  |  | 0% |  |  |
| R | 83% |  |  | 14% | 1% |  |  |  |
| SO | 94% |  |  |  | 4% | 1% |  |  |
| X |  |  |  | 2% | 97% | 1% |  |  |
| W |  |  | 2% |  | 98% | 1% |  |  |

**Interrupts in W against the default party** (Skilled: Mirror Wards interrupted a fight at the Unweaver; the Conductor's mirror-choir Solo cues interrupted, of those cued)

| Set | default: Mirror Wards interrupted · Solo cues interrupted | W |
|---|---|---|
| 1000 | 1.86 · 42% (242/574) | 7.24 · 50% (350/705) |
| 500003 | 1.80 · 44% (254/576) | 7.42 · 47% (338/716) |
| 777001 | 1.76 · 46% (263/570) | 7.16 · 48% (345/719) |

#### Callings at the Conductor (SC and OC), the Anchor, the Decree gate, the smoke and pacing

**Callings** (`callings.ts --cells --movement 4 --party`, Skilled, 50 seeds; band ≥ 75% each, length ≤ none + 40 s):

| Party | Set | none | Luminary | Martyr | Chronomancer + Paradox | Chronomancer + Eternal Moment |
|---|---|---|---|---|---|---|
| SC | 1000 | 100% · 210 s | 98% · −40 s | 100% · −6 s | 100% · −28 s | 100% · −27 s |
| SC | 500003 | 100% · 211 s | 100% · −36 s | 100% · +2 s | 100% · −24 s | 100% · −25 s |
| SC | 777001 | 100% · 207 s | 100% · −29 s | 100% · +8 s | 100% · −20 s | 100% · −23 s |
| OC | 1000 | 98% · 210 s | 100% · −26 s | 100% · +4 s | 100% · −9 s | 100% · −9 s |
| OC | 500003 | 98% · 214 s | 100% · −29 s | 100% · −1 s | 100% · −12 s | 100% · −12 s |
| OC | 777001 | 100% · 213 s | 100% · −25 s | 100% · −1 s | 100% · −9 s | 100% · −13 s |

Met on all three sets. SC's rows are byte-identical to round 2's. **Anchor** (reported; `verbs.ts --techniques anchor`, 50 seeds from 1000): SC 100% (207 s, 0.14 downs), OC 100% (219 s, 0.10), the default party 100% (180 s, 0.08).

**The Decree gate** (`decrees.ts --party`, Skilled, 50 seeds from 1000, real casts; each cell: casts over the 50 fights (answered); ⚠ under default − 10%):

| Boss | Decree | default | SA | SB | SC | OA | OB | OC | W |
|---|---|---|---|---|---|---|---|---|---|
| Vharun | Twin Cleave | 448 (91%) | 841 (88%) | 485 (72%) | 544 (94%) | 851 (89%) | 415 (82%) | 538 (96%) | 712 (84%) |
| Vharun | Bloodmoon | 240 (100%) | 443 (98%) | 243 (95%) | 295 (99%) | 419 (98%) | 255 (98%) | 285 (100%) | 340 (96%) |
| Vharun | Crimson Tide | 187 (100%) | 360 (98%) | 191 (93%) | 232 (99%) | 359 (98%) | 193 (95%) | 220 (98%) | 268 (94%) |
| Vharun | Execution | 152 (99%) | 312 (97%) | 157 (98%) | 193 (99%) | 313 (98%) | 156 (98%) | 189 (97%) | 224 (99%) |
| Vharun | *won* | 98% | 94% | 92% | 98% | 92% | 96% | 98% | 88% |
| the Unweaver | Shear | 529 (99%) | 1129 (98%) | 653 (98%) | 713 (99%) | 1236 (98%) | 308 (90%) ⚠ | 511 (99%) | 1190 (99%) |
| the Unweaver | Snip | 558 (95%) | 995 (92%) | 572 (91%) | 656 (95%) | 1111 (83%) | 630 (87%) | 666 (89%) | 1048 (87%) |
| the Unweaver | Spindles | 101 (100%) | 150 (100%) | 100 (100%) | 100 (100%) | 174 (100%) | 101 (100%) | 100 (100%) | 154 (100%) |
| the Unweaver | Steal Verse | 57 (95%) | 100 (99%) | 51 (100%) ⚠ | 83 (95%) | 100 (100%) | 66 (91%) | 76 (89%) | 100 (100%) |
| the Unweaver | Unravel | 128 (100%) | 203 (100%) | 115 (100%) ⚠ | 151 (100%) | 220 (100%) | 151 (100%) | 149 (100%) | 206 (100%) |
| the Unweaver | Mirror Weave | 205 (98%) | 357 (100%) | 223 (97%) | 256 (100%) | 382 (74%) | 199 (93%) | 229 (97%) | 370 (99%) |
| the Unweaver | *won* | 100% | 100% | 90% | 98% | 100% | 96% | 98% | 98% |
| the Conductor | Lament | 130 (100%) | 198 (83%) | 113 (100%) ⚠ | 169 (100%) | 237 (99%) | 136 (97%) | 215 (100%) | 225 (99%) |
| the Conductor | Basso Ostinato | 121 (99%) | 176 (99%) | 106 (100%) ⚠ | 153 (99%) | 170 (97%) | 120 (98%) | 174 (98%) | 163 (99%) |
| the Conductor | Cadenza | 78 (97%) | 112 (99%) | 98 (96%) | 132 (95%) | 118 (94%) | 95 (95%) | 110 (96%) | 111 (96%) |
| the Conductor | Shatter Aria | 121 (100%) | 153 (99%) | 102 (100%) ⚠ | 153 (100%) | 137 (98%) | 92 (98%) ⚠ | 119 (99%) | 111 (100%) |
| the Conductor | Fortissimo Silence | 50 (98%) | 61 (100%) | 50 (94%) | 63 (100%) | 59 (93%) | 51 (94%) | 59 (98%) | 52 (98%) |
| the Conductor | Grand Silence | 48 (100%) | 50 (100%) | 48 (100%) | 50 (100%) | 47 (100%) | 48 (100%) | 49 (100%) | 49 (100%) |
| the Conductor | *won* | 96% | 100% | 96% | 100% | 94% | 96% | 98% | 98% |

As in rounds 1 and 2, the gate holds wherever the fight lasts at least as long as the default party's. It misses for **SB** (Steal Verse, Unravel, Lament, Basso Ostinato and Shatter Aria: its Unweaver and Conductor fights are 9-17% shorter) and for **OB** (the Shear, a cone on the boss's current target, which in OB is Lyra at range; and Shatter Aria, 92 against 121, where round 2 had 102). Every Decree is still met and answered 74-100% of the time. SA's, SB's and SC's columns are byte-identical to round 2's.

**The unbanded sweep** (24 Skilled Finale-route runs from 2000; the default party 71%): A 79%, B 67% and C 79% (Brann's parties, pinned, identical to round 2), KBO 8% (−62), LBS 58% (−12), LBO 75% (+4), LSO 50% (−21; round 2 42%), VBS 42% (−29), VBO 79% (+8; round 2 75%). The outlier is still KBO (Kael, Brann, Oro), which loses 19 of its 24 runs at Vharun.

**Pacing.** `tools/pacing.ts --route expedition` prints byte-identical output on this tree and on round 2's (and so on `65f8748`), so the default party's pacing is untouched. The edge-of-band default numbers are identical by construction: no default-party code path moved, the 22 baseline checks are byte-equal, the 19 goldens are unchanged, and every default row in this round's tables is byte-identical to round 2's (Skilled reached the Finale on 333003 at 67%, the 5d edge figure). Seren and Oro Skilled Expedition minutes, against the default party's 19.2 / 18.5 / 18.4 on 2000 / 900007 / 333003:
- Inside the soft default + 3: SA 18.3-19.6, SB 16.9-17.5, SC 18.1-20.6, OB 16.9-17.8, R 13.9-15.6, SO 11.9-12.2.
- Over it: OA 28.5-29.7 (+9.9 to +11.2), OC 23.1-24.4 (+3.9 to +6.0), W 21.9-22.7 (+3.0 to +4.2; over on two sets, at the limit on the third) and X 21.5-22.2 (+2.6 to +3.8; over on one set, at the limit on another).
- SO's Expeditions are 2-4 min longer than in round 2 (8.3-9.9), because it now gets past the Cantor more often.


### Bands after round 3, and what needs you

| Band | Round 3 (three sets; round 2 in brackets) | Status |
|---|---|---|
| Bosses, SA ≥ default − 5 | +2 / −4 / +0 / +4; +6 / −4 / +0 / +2; +4 / +8 / +2 / +0 (unchanged) | **met** |
| Bosses, SC ≥ default − 5 | the Cantor −8 / +6 / +4; the rest −4 to +8 (unchanged) | seed-sensitive 2 of 3 |
| Bosses, OA ≥ default − 5 | Vharun −6 / −6 / −2 (unchanged; the guard leaves OA out); the rest −2 to +8 | seed-sensitive 1 of 3: Vharun 92 against 98 and 94 against 100 |
| Bosses, OC ≥ default − 5 | −2 to +10 (the Cantor rows are round 2's) | **met** |
| Bosses, SB ≥ default − 15 | −10 to +8 (unchanged) | **met** |
| Bosses, OB ≥ default − 25 (provisional) | −8 to +8 | **met** |
| Bosses, reduced vs −15 (printed) | W −10 to +6 (met); X Vharun −18 / −18 / −10 (1 of 3); R Vharun −40 to −60; SO's Cantor −52 / −38 / −52 (−86 / −72 / −74), Vharun −70 to −92, the Unweaver −52 to −76 | printed |
| Road, OC ≥ default − 5 | 0 / 0 / 0 cells past | **met** |
| Road, OB ≥ default − 10 (provisional) | 0 / 1 / 0 (the Seamstress −12 on 500003, as in round 2) | seed-sensitive 2 of 3 |
| Road, OA ≥ default − 5 | 2 / 1 / 0 cells past (1 / 1 / 1): the Glass Gallery −26 and the Mirror Hall −6 on 1000, the Glass Gallery −14 on 500003, none on 777001; mean gap −0.6 / +0.7 / +0.5 | seed-sensitive 1 of 3 (round 2: missed by one cell a set) |
| Road, SA / SB / SC ≥ default − 5 | SA 13 / 8 / 8, SB 4 / 4 / 5, SC 6 / 6 / 6 cells past (unchanged) | missed |
| Skilled share | road ≥ 38%, bosses ≥ 37% everywhere | **met** |
| Skilled length (cells ≤ default + 15%; the Conductor 170-280 s) | SA 19, SC 8-9, OA 25-26, OC 17-21 cells over; the Conductor 207-237 s; SB and OB ≤ 163 s | missed (SA, SC, OA, OC); met (SB, OB) |
| Novice at bosses: inside each Movement's Novice row, ≤ Skilled (read in full for the first time; *Round 2's report, corrected*) | ≤ Skilled in every cell. Outside the rows: SA, OA and OC's Unweaver 0% and Conductor 0-14%; SC's Conductor 12-18%, Vharun 70-74% (2 of 3 sets) and Cantor 24% (777001); OC's Cantor 6-18% and Vharun 64-70% | **missed** for SA, SC, OA and OC on every set; SB (≥ 10%: 20-82%) **met**; OB recorded |
| Idle at bosses | 0% everywhere | **met** |
| Whole Prelude, Skilled | SB +6 / +6 / +9 and OB −7 / −5 / −3 met; OC −1 / +2 / −3 (−4 / −3 / +0) met for the Skilled bot; OA −6 / −6 / −2 (1 of 3); SC −11 / −9 / −7; SA −26 to −32 | met for SB, OB and OC's Skilled bot |
| Whole Prelude, Novice ≥ 50% of default | SA 6-10%, SC 18-22%, OA 12-16%, OC 5-10% against 32-38% (unchanged) | missed |
| Whole Expedition, OA ≥ default − 5 and ≥ 55% | 66.0% (−6.0) / 68.5% (+0.5) / 66.5% (+1.0) (67.5 / 67.5 / 66.0) | **seed-sensitive 2 of 3** (round 2: met, with −4.5 on 2000) |
| Whole Expedition, OC ≥ default − 5 and ≥ 55% | 79.5% (+7.5) / 78.5% (+10.5) / 84.5% (+19.0) | **met** |
| Whole Expedition, SB ≥ default − 10 | −9.5 / −7.0 / −10.0 (unchanged) | **met**, at the band's edge on 333003 |
| Whole Expedition, OB ≥ default − 20 (provisional) | −14.5 / −7.0 / −11.5 (−15.0 / −7.0 / −9.0) | **met** |
| Whole Expedition, SC | 60.5% (−11.5) / 49.5% (−18.5) / 57.5% (−8.0) (unchanged) | missed |
| Whole Expedition, SA | 27.5% (−44.5) / 30.5% (−37.5) / 32.0% (−33.5) (unchanged) | missed |
| Whole Expedition, reduced vs −15 (printed) | W −25.0 / −17.0 / −21.5 (−31.5 / −23.0 / −14.5); X −44.5 / −43.5 / −41.0 (−44.0 / −47.5 / −38.5); R −65 to −70; SO −65.5 to −71.5 | printed (W now misses on all three sets; round 2 met it on one) |
| Weaver safety (Oro parties) | road: OB 281 / 276 / 286 damage, 0.318 / 0.317 / 0.370 downs, against limits 301 / 303 / 298 and 0.317 / 0.337 / 0.333; OA 436-442 and 0.57-0.59 (414-421 and 0.51-0.53); OC 375-385 and 0.48-0.52 (352-359 and 0.44-0.45). Bosses: OA 917-959 / 1.98-2.12, OB 599-674 / 1.25-1.55, OC 624-684 / 1.27-1.43, against default 509-543 / 1.06-1.15 | missed. OB's road is inside on 1 of 3 (round 2: 2 of 3); it misses on 1000 by 0.001 downs a fight |
| Thread cuts, Movement III (Oro parties) | OB 1.23 / 1.16 / 1.24 against limits 1.33 / 1.25 / 1.28 (1.35-1.46); OC 1.39-1.40 (1.30-1.35); OA 2.00-2.08 (1.90-1.95) | **met for OB** (round 2: missed); missed for OC and OA |
| Callings at the Conductor (SC, OC) | 98-100% each | **met**; Anchor 100% |
| Bond XP a fight ≥ 75% of the starters' | Seren 61-73%, Oro 64-69%; SO's Seren 84-86%, Oro 72-73% (75% in round 2) | missed |
| Decree gate | SB 5 Decrees and OB 2 under default − 10% (as in round 2; OB's Shatter Aria 92 against 121); every other party met | missed for SB and OB |
| Seren: ≥ 50% of the Wards on her parry | road SB 60-61%, SC 52-54%, SA 47-48%; bosses SB 58-59%, W 55%, X 59-60%; SA 8-10%, SC 15-17%, R 9-10%, SO 14-15% | **missed** for SA (road and bosses), SC, R and SO at the bosses; met for SB, W and X at the bosses and on SB's and SC's road (*corrected*) |
| Seren: counters and kill shots 20-40% of her damage (skirmishes and elites) | SA 8%, SB 11-12%, SC 8-9% | missed |
| Seren: kill shots ≥ 0.5 a fight (elite and boss cells), the Novice ≤ a third | SA 0.50-0.58 (Novice 0.05-0.07), SB 1.21-1.34 (0.48-0.55), SC 0.29-0.35, W 2.65-2.77 (1.18-1.25), X 2.95-3.02 (0.85-0.94) | met for SA and X; SC too few; SB's and W's Novice over a third |
| Seren: beyond 14 m ≤ 2%; overextensions answered ≤ 3 s ≥ 50%; Showboat pick ≥ 60% | 0%; 65-86%; 70-100% | **met** |
| Seren: downs ≤ 0.3 a fight | road 0.09-0.15; bosses SA 0.18-0.20, SC 0.26-0.29, SB 0.38-0.41, W 0.57-0.64, X 0.85-1.14 | met for SA and SC; missed where she holds the boss (the By-party default's knock-on) |
| Seren: Skilled parries ≥ 2× the Novice's | at bosses the Novice parries more (SB 16 against 8 a fight, W 21 against 12) | missed |
| Seren: W's interrupts ≥ the default's rate − 10 | Solo cues interrupted at the Conductor 47-50% against 42-46%; Mirror Wards 7.2-7.4 a fight against 1.8 | **met** |
| Kael holds bosses ≥ 70% (SA, SC) | SA 51-53%, SC 43-45%; the default party's Kael 45-47% (unchanged) | **NEEDS USER** |
| Oro: Saplings in your field ≥ 60% | OA and OC 84-86% road, 92-93% bosses; OB 87% road, 59 / 59 / 58% bosses | met but OB at its bosses |
| Oro: the Novice ≥ 15 points lower | road 7-8 (OA, OB, OC); bosses 7-8 (OA, OC), −11 to −13 (OB) | missed |
| Oro: tending ≤ 25% (Skilled) | road OA 11-12% (19%), OB 22% (34%), OC 18% (30-31%); bosses 1% | **met** (round 2: missed for OB and OC) |
| Oro: both standing ≥ 60%; downs ≤ 0.3 | 94-98%; 0.03-0.26 | **met** |
| Oro: timeouts ≤ 1% | Skilled OA and OB 1 of 1,150 road cells on set 1000 (0.09%), OC 0; their bosses 0 of 200. SO's bosses 32 / 30 / 23 of 200 (30 / 30 / 21); X 1 of 200 on 500003. The Novice's OA, OC, W and X bosses 10-34 of 200 | met for OA, OB and OC (Skilled); SO missed; the Novice's bosses miss it if the band covers the Novice |
| Boss seconds on a summon | 0-2% (the `oro` share is Oro himself; `sapling` and `ancient` 0) | **met** |
| Default party and Brann parties A, B, C | the 22 baseline checks byte-equal; the 19 goldens unchanged; every default row byte-identical to round 2's | **identical** |

**What round 3 says.** Lever 1 is now spent in full: the clamp, the last Seren number never screened, moves nothing past noise. What remained for the Oro parties was again a bot habit, `oroFocus`.
- **The re-Focus.** The plain 4 s between Focuses left Oro idle after every kill in a fast party. Waking him 2 s after a Focus falls meets his tending band in all three Oro parties (11-22% of the road). It also brings OB's Thread cuts inside their band on every set (1.35-1.46 → 1.16-1.24).
- **The pack guard.** A boss Focus set at the Cantor's start stood for the whole fight and held Seren on the Cantor while the Choir mauled Kael. Without it SO's Cantor rises from 10-18% to 40-52%, and more of SO's runs get past it: on set 2000, 79 of 200 end at the Cantor (round 2: 122) and 45 at Vharun (22).
- **What did not move.** The parties that drop Lyra or Vexis still lose on the road to the missing starter's damage. SA's road mean gap is −9.0 to −9.5, and SC is 8-18 points short on whole runs. These parties are unchanged by construction this round.

**The trade-offs the kept rules bring** (for your decision with the rest):
- The re-Focus costs OA's whole run 1.5 points on set 2000 (67.5 → 66.0%). That is inside a run row's ±3 noise, but it takes the row from −4.5 to −6.0, past the band, so the band reads seed-sensitive 2 of 3 where round 2 met it.
- It nudges the Weaver's road damage up in OA (+5%) and OC (+7%), and Thread cuts up in OA (+0.05-0.11) and OC (+0.04-0.09). Both bands were already missed in those parties.
- OB's road Weaver downs reach 0.318 a fight on set 1000, against a limit of 0.317. So OB's road Weaver-safety band is inside on 1 set of 3 (round 2: 2).
- W's whole runs move −31.5 / −23.0 / −14.5 → −25.0 / −17.0 / −21.5. That is noise in both directions, but W no longer meets its printed −15 on any set.
- The pack guard reads the standing party. With Seren down, Oro's Focus comes back, and once set it stands.

**Round 4 leads (not built):**
- OA's Vharun (−6 on both tuning sets, unchanged since round 1). The `oroFocus` ablation says the boss Focus is worth 16 points there, so the gap is elsewhere: Vexis holds Vharun about half the time in OA and takes the Twin Cleaves.
- OB's in-field share at the bosses (58-59%, 1-2 points short), which comes from the Cantor's Silent Verse.
- Holding Seren's Feint for the second Twin Cleave blow where she holds Vharun (W, X, SB). The 12-seed diagnosis found Feint off cooldown for 4 of her 9 second-blow downs, which is too few to build on yet.

**NEEDS USER.**
1. *Default taken, awaiting your confirmation (unchanged):* with no Kael, Seren holds the bosses by threat (`DUEL_BOSS_THREAT` ×6, lever 2). Lever 1 cannot do it: `threatMult` 1.2 put the boss on her only 0-18% of the time. Final hold: SB 95-96%, W 98%, X 96-97% of boss time. Its cost: her boss downs are 0.38-1.14 a fight (band ≤ 0.3), and she loses 0.11-0.75 kill shots a fight in SB, W and X. Confirm, or say how else you want it.
2. *Seren's peel (round 2, lever 2), reach and attribution corrected:* in a boss fight, a normal or elite enemy swinging at Kael that is not his own target is hers to duel, in every party with Kael and Seren (SA, SC, R, SO). It is what moved SC's Cantor. Round 2 said it made SO worse; round 3 measured that it did not (byte-identical with it off). Confirm it, or name a narrower form.
3. *New in round 3, flagged:* `oroFocus` never Focuses a boss that calls a pack while Kael and Seren both stand. It is a bot rule (lever 3), so it changes no sim behaviour, and it reaches only SO among the banded parties. Confirm, or say if you want it wider. Read in every Kael party, it lifted OA by 0-2 and moved OC −6 / +10 at the Cantor.
4. *Kael holds bosses ≥ 70% in SA and SC* is above the default party's own Kael (45-47%). Only Kael's or Lyra's numbers could reach it, and those are never moved. Restate it against the default party's share (SA's 51-53% meets it; SC's 43-45% is 1-3 points short), or accept it as missed.
5. *OB (Q8):* the measurements still back both provisional bands. Bosses are −8 to +8 against −25, and whole runs −14.5 / −7.0 / −11.5 against −20, on all three sets. The road −10 band is missed by one cell on one set (the Seamstress −12 on 500003). OB's Prelude (−7 / −5 / −3 against −10) and, new this round, its Thread cuts (1.16-1.24) are met. Recommendation: keep both bands and make them final. The *Heartwood* alternative is a Quirk change: not built, not needed by these numbers, and yours to decide.
6. *SA's and SC's road and whole runs (≥ default − 5 and ≥ 55%)* cannot be reached with the allowed levers. Lever 1 is spent (rounds 1 and 3), and no hero-only rule found moves SA. Reaching them needs one of: a wider lever-1 rule for Seren's damage (a design change), restated bands for parties without Lyra or Vexis (as SB and OB have), or starter, enemy or road numbers, which are never moved. The same choice covers their length, Prelude and Novice-Prelude bands.
7. *The Novice band, read in full for the first time:* SA, SC, OA and OC fall outside the 5b/5c/5d Novice rows at the Unweaver (0% for SA, OA and OC) and the Conductor (0-18%), as party A did in 5c. SC's and OC's Novice also wins Vharun above its 60% ceiling. Accept these as party A was accepted, or restate the rows for the Seren and Oro parties.
8. *The Weaver-safety and Thread-cut bands for Oro parties*: OB's Thread cuts are now met. The rest still read the longer fights and the healing threat from the Saplings' aura heals (Q1, an aura rule). The re-Focus moved OA's and OC's rows a little the wrong way, and OB's road downs to the band's edge. Restate them, or accept them as missed.
9. *Seren's skill-gap bands* (Skilled parries ≥ 2× the Novice's; the Novice's kill shots ≤ a third) read backwards by construction, as round 2 showed. Restate them (for instance parries per Ward, or kill shots per Perfect), or accept them as missed.
10. *Bond XP ≥ 75% of the starters'* (Seren 61-73%, Oro 64-69%): lever 4 has no Seren- or Oro-only value. Accept as missed, as Brann's 67-75% was, or ask for a recruit-only weighting (a design change).
11. *`roster20.test.ts`* still lets SO carry Skilled Vharun on seed 1000 to the 540 s cap. SO's Vharun is unchanged this round (8%, with 4-6 timeouts of 50 a set). Approve it, or say how you want SO's timeouts handled.

### The pins and the tests (round 3)

- All 22 baseline checks are byte-equal: `m1-baseline --check` for Movements 1-4; `--movement N --party P --check` for N 1-4 and P A, B, C; and `expedition-baseline --check` at 2, 3 and 4 Movements and at 4 for A, B and C. The `update-golden` dry run says 'Goldens are up to date' after the `--write`.
- `tools/pacing.ts --route expedition` prints byte-identical output on this tree and on round 2's.
- The 19 original goldens are byte-identical, `SIM_VERSION` is 22, and `contentVersion` is unchanged (`c-90f2f93ff5775748`). Re-recorded: `skilled-oro-conductor` `178ad349e9fd3c8a` → `48db24c60f4424d8`, with its `ROSTER_HASHES` literal (OA at the Conductor, where a Focus falls and the re-Focus wakes Oro sooner). The other five Seren and Oro goldens are byte-identical: no other seed reaches either rule.
- `tests/sim/groveDeterminism.test.ts`: OC's First Light on seed 1 no longer has its Saplings swing. Oro is woken sooner, and the party kills the pack before it reaches them, so they sprout and never swing. The per-fight check now asks that the grove sprouted, and a new per-party check asks that the Saplings swung in at least two of the party's three fights. The determinism checks (replay round-trip, mid-fight hash and events) are unchanged.
- New tests in `bots.test.ts`:
  - `oroFocus` Focuses again 2 s after a tending Oro's Focus fell, not at 1.5 s, and with the rule off not before the plain 4 s.
  - `oroFocus` gives no Focus at the Hollow Cantor with Kael and Seren; it still Focuses Vharun there, and the Cantor without Seren (OA) or without Kael (OB).

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
    - Saplings spawn after the party only with Oro; planted 4 m ahead;
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

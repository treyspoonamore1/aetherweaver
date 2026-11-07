# Phase 5d — The Finale: the Silent Conductor

*2026-11-06 · plan: [02 §8](plan/02-game-design.md) (lines 196-201: "Movement I (6 rows) → Movement II (6 rows) → Movement III (6 rows) → Finale"), 02:236 and 02:250-251 ("after the first Finale clear"), 02:310-311 (the antagonist; no cutscene over 20 s), [03 §7.4](plan/03-content-bible.md) (lines 313-317), [03 §11](plan/03-content-bible.md) (line 461; line 481 True Dissonance), [04 §1](plan/04-presentation.md) (line 14, the Celestial Crucible), [04 §4.1](plan/04-presentation.md) (line 77, the Grand Silence), [06 Phase 5](plan/06-roadmap.md) (lines 112-125: "A full run takes 30–40 minutes") · follows [Phase 5c](phase-5c.md) ("The Finale hook", lines 1180-1192) · revision 2: resolves the design review (see "Review resolutions" at the end)*

After the Unweaver, an Expedition climbs out of the Rift into the **Celestial Crucible**, where the music is drawn as rings in the sky. There the **Silent Conductor** waits with its **mirror-choir**. It was the first Weaver, and it believes the world has earned its rest (02:310).

This slice adds:

- **one boss in three phases:**
  1. *Overture*: the Conductor Cues enemy Solos onto elite choir voices.
  2. *Mirror Choir*: the whole choir sings, the Cues come faster and Discord swells toward Fortissimo Silence.
  3. *Grand Silence*: the music stops and the heroes freeze. Eight notes from the Weaver rebuild the song, reignite the heroes and bring the fallen back for the last burn.
- **Discord**, through phases 1 and 2. Every telegraph you fail to answer feeds it, and it also swells with time (question 7). At 100 the Conductor plays **Fortissimo Silence**: 120% of max life over about 3 s, in three raid pulses (tuned from 150%; see *Tuning*). Your Crescendo cancels it, whatever your Calling. Otherwise the dome, Wards, Bear, Mend and Fermata survive it.
- **four mirror-choir voices.** Each mirrors a hero's leitmotif. Three Solos rehearse the Grand Silence's notes (Chime, Ward, Reel); the fourth teaches spacing (Scatter).
- **the Celestial Crucible** in render, audio and UI, with the Grand Silence as a set piece that reads with the sound off.
- **a run end:** an epilogue under 20 s, Finale victory copy, a first-clear card and two badge Deeds. The first clear opens Dissonance at Rank 15+ (question 3).
- **the plan's shorter road**, only on the route that ends in the Finale: Movement I plays 6 rows and Movement II plays 6 rows (02 §8). The Prelude and the legacy I-II and I-III routes keep their maps byte for byte.

The Expedition becomes **Prep → Movement I (5) → Cantor (interlude) → Movement II (6) → Vharun (interlude) → Movement III (6) → the Unweaver (interlude) → The Finale → epilogue → Summary.** Modelled for a Skilled player: **losses-included average 37-39 minutes, winning-run median 45** (question 2 asks which one is the exit criterion).

Measured numbers come from the repo's code and tools, plus scratch models run during design, all under `/tmp/claude-0/-home-user-aetherweaver/788d7335-cec7-55ed-adf1-f8f57a4dbd4c/scratchpad/m4/`:

- `shortM1.ts` (Movement I roads);
- `pace5d.ts` (the `tools/pacing.ts` player model with the shorter roads and a modelled Finale), outputs `p5d-*.txt`, `q-*.txt`, `r-*.txt`;
- `silence.mjs` (a Monte Carlo of the Grand Silence with the Weaver's real Ward, Chime, Reel, Rewind and Mend numbers from `src/content/weaver.ts:26, 40-61` and `callings.ts:194`, and the Novice's decision clock from `src/bots/novice.ts:98`);
- `de5e.ts` (ΔE);
- `loadouts50-m{1,2,3}.txt` and `loadouts-runs-m3.txt` (presets).

Everything else is a starting value that W9 tunes.

## Principles

Each Movement so far has attacked something: Movement I the party's health, Movement II the heroes, Movement III the Weaver's tools. **The Finale takes the heroes away and leaves only the Weaver.** It is the run's ending, so it is an exam, not a new syllabus.

1. **No new verb.**
   - Every answer already exists: Ward (Perfect), Chime (clutch), Reel (Rewind), Focus or interrupt, Scatter, the dome, Mend, Crescendo.
   - The choir's Solos rehearse the three Grand Silence notes, so phase 3 tests what phases 1 and 2 taught.
   - One answer glyph is new: `crescendo`.
2. **A mirror the player can read.**
   - The Conductor plays your game against you. It Cues soloists as you Cue heroes.
   - Its Discord fills in four segments of 25, as your Resonance does.
   - At 100 it plays its own Crescendo, Fortissimo Silence, and yours silences it. The duel reads at a glance: your Resonance against its Discord.
3. **Readable, fair and finite.**
   - Every telegraph lasts at least 1.0 s and shows its answer glyph. Every spawn has a ≥ 1.0 s ground warning.
   - The floor is enforced: in the Finale a windup that would come out under `FINALE_MIN_WINDUP` (1.0 s, `src/content/crucible.ts`) is held at it (`beginAttack`, `enemies.ts`, behind `world.field.finale`). Only Short Fuse's Dissonance windup multiplier (×0.9 a rank, ×0.8 at rank 2) shortens a windup, and without the floor it would take the 1.2 s Cue to 0.96 s.
   - At most two damaging telegraphs are live at once. The script enforces this itself, because READABILITY_CAP only governs the generic picker (`src/sim/systems/enemies.ts:58, 476`).
   - Every down names its answer in the recap.
   - No beat can stall: the Grand Silence ends within its cap (50 s at default assists) whatever happens.
4. **Readable with the sound off.** Every audio fact has a visual twin that doesn't depend on the Flashes setting. The new captions setting adds text.
5. **Reuse 5c, invent little.** The Conductor is a `BOSS_SCRIPTS` entry (`src/sim/systems/bossScripts.ts:52-55`) whose file is built like `unstitchedBosses.ts`. It reuses:
   - its own `effect:'script'` casts and the `resolved` hook, keyed by the boss's def (`enemies.ts:1280-1281`), so no add-owned script route is needed;
   - `beginAttack` on an add (`enemies.ts:562-818`);
   - `world.internal.pendingSpawns` with `elite: true` and a `spawnWarning` event (the summon pattern, `enemies.ts:1244-1254`; the director spawns them with `{elite: p.elite}`, `director.ts:25-36`);
   - the P7 follow-up chain (Needle Rain) and raids (the Requiem, `enemies.ts:223-238`);
   - Dirge marks with the existing clutch rule (`techniques.ts:296-313`);
   - `isDisabled` with one appended status;
   - `health.invulnerable` (`health.ts:716`), re-armed each tick (it counts down, `statuses.ts:66`);
   - `reviveHero` (`health.ts:1566`);
   - decrees and `decreeNoDome`; `killEnemy` and `interruptEnemy` (`health.ts:1672, 1793`);
   - ledger counters (`state.ts:802-857`), diffed by the script.

   It adds **six** guarded primitives (Q-table), each inert outside a Finale fight.
6. **Every existing fight stays byte-identical.** These are all unchanged:
   - the 15 goldens;
   - m1-baseline `--movement 1|2|3`;
   - preludeSnapshot, commandSnapshot and commandSnapshotM3, rosterInvariance;
   - the render and audio Spire snapshots (and the new Rift ones);
   - the I-II and I-III Expedition pins and baselines, and draftSnapshot.

   SIM_VERSION stays **22**. Only `contentVersion` moves. No aura definition, number, list or reservation changes.
7. **One public key.**
   - Bots, HUD, render and audio read one lazy, hashed `field.finale`, deleted at the encounter's end.
   - Script clocks live in a lazy `internal.m4` (`world.ts`): the clocks `nextCueAt`, `nextRaiseAt`, `nextRestAt`, `nextMeasureAt`, `nextCadenceAt`, `nextDownbeatAt`, `nextSforzandoAt` and `nextRewindNoteAt` (Q8's one Rewind note per 18 s), plus `cycle`, `cuedAt`, `live`, `seen`, `queued` and `choirRaise` (phase 2's entry Raise still to land). Every key is optional and set lazily.
   - Every Finale id is a constant in `src/content/crucibleIds.ts`, so workstreams never guess a string.

## Scope

**In:**

- the Silent Conductor, and 4 mirror-choir voices (boss adds, not counted among the 16 regulars);
- 1 arena (`the_crucible`) and 1 encounter;
- the `FINALE` movement def (a separate boss-only schema, below): label 'The Finale', carrying the route's `road`;
- Discord, Fortissimo Silence, the Grand Silence, Reignite and the Coda;
- 3 Movement-4 relics with real `applyRelic` cases, gated and asleep outside the Finale;
- 2 badge Deeds;
- the first-Finale-clear record and the Dissonance gate (question 3);
- the epilogue and Finale victory copy;
- the Celestial Crucible in render, audio and UI;
- bots, harness, kits, bands, baselines, goldens and pacing.

**Out:**

- Seren, Oro and the Conductor Calling (Grand Finale). Leitmotif loops handle only the party's own heroes.
- True Dissonance (Dissonance 15, a fourth phase; question 4). Its seam is described under *Known gaps*.
- The Atlas of Echoes and weekly seeds (roadmap Phase 6, `docs/plan/06-roadmap.md:131`). This slice only records the clear.
- Tyrant, Mimicry, Counterpoint, the Rubato aura and the Harmony tier.
- The 1.0 content fill: about 58 motifs, 22 relics and 6 events. It can't enter Movement I and II pools without re-baselining them, so it needs its own slice.
- An Aether sink (question 5).

## Your answers (2026-11-06)

Questions 1, 2, 3 and 7 were answered as recommended:

1. **The Grand Silence does not act on auras.** It is presentation plus the hero freeze; every aura keeps working.
2. **The exit clock is the losses-included average** (≤ 40 minutes, stretch 38), with the winning-run median reported beside it (soft ≤ 45) and the 'won Movement III' guard.
3. **Dissonance opens on the first Finale clear**, at Rank 15 or above. Profiles already open stay open.
7. **Discord rises with failures and a slow passive swell**, as below.

Questions 4, 5, 6 and 8 take their recommended defaults until you say otherwise.

## Questions (each has a recommended default; the build proceeds on the default)

1. **Does the Grand Silence act on auras?**
   - **Default: no.** 'The music stops' is presentation (stems, the SFX gate, light, the sky orrery, the HUD) plus the hero freeze. Fermata's guard and hold, Sostenuto, Lullaby and Ostinato keep working, and `field.ts` is untouched.
   - Alternative: a runtime mute of every aura while the silence holds (the `field.suppressed` precedent, `field.ts:152`). That would also turn off Fermata, Lullaby's slower windups and wider Perfect window, the chorus pulse, and strip Ostinato barriers at once (`field.ts:322-325`).
   - No aura data changes either way.
2. **Which clock is the '30-40 minutes'?** The two readings disagree, so this is yours to pick.
   - **Losses-included average** (5c's metric: `tools/pacing.ts --route expedition`, Skilled, seed bases 9001 and 77003): **37.2 / 38.7** on the chosen road. It passes ≤ 40.
   - **Winning-run median**: **45.0 / 44.8**. It misses 30-40, and no road that keeps every Movement's lesson row and mini-boss gets it under 43 (s5nb: 43.1 / 43.4).
   - Part of the average's drop comes from **more losses**, not only shorter runs. On base 9001, Skilled 'won Movement III' falls from 81% (s6e with the full Movement II, `p5d-s6e-9001.txt`) to 70% (s6e plus the 6-row Movement II, `q-s6e-9001.txt`); on 77003 from 84% to 81%. At 43 Expeditions a base that is within noise on 77003 and borderline on 9001; W9 re-measures at 200 seeds × 3 sets.
   - **Default:** report both as headline numbers, and take the losses-included average ≤ 40 (stretch 38) as the exit criterion, as 5c did, **with a guard**: Skilled 'won Movement III' on the Finale route may not fall more than 5 points below today's full-road figure (pooled), or the road's own rewards are raised (the lever under *Bands*). The winning-run median gets a soft target of ≤ 45.
   - Alternative: the winning-run median ≤ 40 is the criterion. That needs faster Movement I-III fights (forbidden by the byte-identical rule) or a leaner screen model (`AROUND` in `tools/pacing.ts`: shorter draft, merchant and event screens), which is UI pacing work for a later slice.
3. **Does Dissonance open on the first Finale clear**, as 02:236, 02:250 and 03:461 say?
   - **Default: yes, still at Rank ≥ 15.** Every profile already open stays open, with no migration and no PROFILE_VERSION bump.
   - Alternative: keep today's 'any win at Rank 15, a Prelude win included' (`src/app/profileStore.ts:509-527`), and let the first-clear Deed be only a record for the Atlas later.
4. **Ship True Dissonance (Dissonance 15: the Finale gains a fourth phase) in this slice?**
   - **Default: no.** The seam is designed (a variant def, *Known gaps*), and LATER_LEVELS keeps it.
   - Alternative: a reuse-only 'Da Capo' fourth phase (the choir re-forms, a trio Cue every 14 s, a faster Discord swell), 3 points, Expedition-only. That costs about one workstream.
5. **The Aether surplus.**
   - A Skilled winner carries 430-480 unspent Aether (5c). The Unweaver's interlude adds 75 × grade, and a boss-only Finale has no shop.
   - **Default: accept it in 5d.** A shop stop costs about 50 s per reaching run against the budget.
   - Alternative: 5c's per-Movement price multiplier, in the content-fill slice.
6. **The Finale route's Movement II cut** drops its row 3, the leech_warren skirmish row.
   - **Default: accept it, with the ladder pools shuffled on this road only**, so leech_warren and blood_forge can still appear in the remaining slots. Leeches also appear in the `shield_wall` elite.
   - Alternative: keep Movement II whole and drop the Bellwarden from Movement I's road ('s5nb'). That loses the Movement I mini-boss and an all-fight row for the Calling tiers.
7. **Discord also rises with time.** 03:316 says only unanswered telegraphs feed it.
   - **Default: a passive swell (+0.5/s in phase 1) plus a floor of 70 and +1.0/s from phase 2's entry**, so Fortissimo Silence comes in about 90% of clean Skilled fights. Its Crescendo cancel is then taught and measured, and its Decree gate counts real casts (5c's Steal Verse lesson). The meter shows the swell and the time left, so it's never a surprise.
   - Alternative (plan-literal): failures only. A clean player then never meets Fortissimo Silence; weaker players meet it as a punishment. The Crescendo-cancel lesson is untaught for most Skilled runs, and its gate is reported 'N/A when clean'.
8. **Does a Rewind count as a note?** 03:317 says only Perfect Wards, Clutch Cleanses and Reel-saves make sound. The Chronomancer's Reel slot casts Rewind, which can't pull a frozen hero out of a shape (they haven't moved, `rewind.ts:96-112`) and can stand one back up only once a run (`rewind.ts:40-44`).
   - **Default: yes, as her Reel-save.** A Rewind cast in the silence that undoes a silence blow counts: it restores life lost to one (`ledger.calling.rewound` rises, `rewind.ts:126`), or, with Paradox, cancels a live silence attack aimed at the hero (`rewind.ts:164-173`). At most one per 18 s.
   - Alternative (plan-literal): only Perfects and clutches for the Chronomancer. The scratch model then puts her at about 1.8 notes a 9 s cycle and about 40-45 s to eight, close to the cap.
   - Paradox's own spares (area attacks the hero merely stands in) don't make notes: in the silence every attack is aimed, so Paradox cancels rather than spares.

## Decisions taken

| Question | Choice | Alternative, and why not |
|---|---|---|
| Where the shorter road lives | **Route-scoped.** The FINALE def carries `road`: variants for earlier Movements, named by id. `routeDefs(n)` overlays them only when the n-th def is the finale. The Movement I and II defs are byte-identical, and `generateMap(seed, 1\|2\|3)` is unchanged. | Shortening Movement I for every Expedition renumbers node ids, so every later fight seed (`run.ts:1071-1072`) and shop (`shop:{node.id}`, `:1476`) moves. That re-pins expedition-baseline ('kept for good'), expedition2Pin, expedition3-baseline, movement3Handoff and draftSnapshot. Putting `expedition` keys on `hollow_choir` itself touches the defs m1Unchanged guards (`tests/sim/m1Unchanged.test.ts:120-196`). |
| The Finale's schema | **A separate `FinaleMovementDefSchema`** (strict: `id, name, mapTitle, label, biome, rows [['boss']], fixed, boss, scale, rewards, finale: true, road`). `CONTENT.movements` becomes `(MovementDef \| FinaleMovementDef)[]`, discriminated by `finale`. `MovementDefSchema` and its type are **unchanged**, so tsc flags every pool reader that must narrow (`isFieldMovement(def)`). | Making `opening`, `skirmishes`, `elites` and `miniboss` optional on MovementDef (`schema.ts:1447-1451`) leaks `undefined` into every legacy reader; a `!` added anywhere hides a movement-4-only crash. Filling the Finale with dummy pools leaks the Conductor into harness cells as a 'skirmish'. |
| Registration order | **W2 lands the Finale content but does not append FINALE to `CONTENT.movements`.** W3 appends it in the same merge as `routeDefs`, the road, the length-derived copy helpers and every test they move. | Registering in W2 makes EXPEDITION_MOVEMENTS 4 (`profile.ts:99`) before the road exists, breaking W3- and W8-owned tests. |
| How much to cut | **Tuned to s5 + 6** (the doc's fallback when 9001 lands over 40; see *Tuning*). Movement I **s5**: First Light; sk/elite/sk; Bellwarden; respite/merchant/forge; Cantor. Movement II: 6 rows (drops row 3). Designed as the plan's 6 + 6 (Movement I **s6e**: First Light; sk/sk/event; elite/sk/sk; Bellwarden; respite/merchant/forge; Cantor), modelled at **37.2 / 38.7** min average and a winning median of 45.0 / 44.8; measured at 41.4 / 40.5 and 44.6 / 45.0 once the Finale was played. | s6e alone: 41.0 / 40.7 (misses). s5 + II-6: 39.7 / 39.0, and it drops Movement I's only event. s5nb: 38.3-38.7 / 38.5, but loses the Bellwarden and an all-fight Calling row. Cutting Movement III would drop its lesson row. |
| Movement II road pools | The road sets `shuffle: true`. The ladder's skirmish and elite pools are shuffled on this road only (`order`, `run.ts:449`), so either elite and every pooled skirmish can appear. The lesson row and Brann's event row stay. The extra draws happen only on the Finale route. | The ladder's least-used-in-content-order pick would strand `leech_warren` and `blood_forge` for good. |
| Threat on the road | Each road row names the full Movement's row whose Threat it takes. Movement I `threat [0,3,7,8,9]` (s5; `[0,3,5,7,8,9]` on s6e) keeps the Bellwarden at 1.225 and the Cantor at 1.3. Movement II `[0,1,2,4,5,6]` keeps the Matriarch at 1.113 and Vharun at 1.188 (`threatFor`, `economy.ts:17-21`). Each fight is the same content and numbers. | Row-in-Movement Threat makes the Bellwarden 1.075 and the Cantor 1.15: easier fights the Prelude never plays. |
| Calling tiers | The Movement I road carries `callingRows: [0,1,2,4]` (s5; `[0,2,3,5]` on s6e): First Light, the all-fight row 1, the Bellwarden, and the Cantor interlude (tier IV; `continueFromResult` already orders calling → relic → draft, `run.ts:1165-1176`). `callingTierDue` reads the run's road. `CALLING_ROWS [0,3,5,7]` stays for the Prelude. `tierWhen(i, run?)` keeps today's output when `run` is omitted, so `tests/uiPhase3c.test.ts:228-299` is unchanged. | Global rows on a 6-row Movement I land tiers on the Bellwarden, the Cantor and Movement II's lesson row. |
| The Finale def | Boss-only: `name 'The Finale'`, `mapTitle 'The Celestial Crucible'` (both required, `schema.ts:1436-1438`), `label 'The Finale'`, `rows [['boss']]`, `fixed [{row 0, encounter the_silent_conductor}]`, `boss the_silent_conductor`, biome `celestial_crucible`, scale `{life 1.85, damage 1.05}` (Movement III's; swept in W9), rewards `{xp 1.35, starlight 1.5, aether 1.5}` (xp tuned from 1.5, so XP per combat minute IV/I is within ±15%). | A merchant/forge stop spends carried Aether, but costs about 50 s a reaching run (question 5). |
| Enemy Solos | **A boss Cue cast, then a script-begun Solo on the add.** `conductor_cue` (effect `'script'`, 1.2 s, on the boss's bar, naming the soloist and its Solo) resolves through the boss's `resolved` hook, which calls `beginAttack(world, soloist, solo)`. Each Solo is `scripted` and `interruptible`, has **range 44**, the arena's diameter (the arena is r 22; `inRange` adds both radii, `enemies.ts:581-582`, so it holds wall to wall, which 40 would not for a voice and a hero on opposite walls), and sits in the voice's `specials`, so the picker skips it and the coverage test counts it. **The target is named when the Solo begins** (its telegraph, ≥ 2.5 s), not at the Cue: `beginAttack` re-picks it (`enemies.ts:594-626`), and Lament's `randomNonTank` draws `rng.ai` then, a Finale-only draw. | Naming the target on the Cue bar would need a `promised` target for every targeting kind; `current` and `farthest` can change in 1.2 s. An add-owned `effect:'script'` route means changing `completeCast` and `scriptedNext` (`enemies.ts:984, 1280-1281`). |
| A Solo that can't begin | `beginAttack` returns false only with no hero standing or the voice with no current target. Then: no Solo, `field.finale.cue` is deleted, the soloist's `cuedAt` isn't updated, and the next Cue is due in 2 s (the next idle voice). | Silently dropping it leaves a Cue bar that promised a Solo. |
| Cast collisions | The script Cues only an **idle** voice: no cast, not spawning, not disabled. `beginAttack` overwrites `c.cast` without cancelling the old telegraph (`enemies.ts:793`). If no voice is idle, the Cue waits; if none stands, it becomes a Raise. | Stacking a Solo on a live cast orphans a telegraph. |
| Elite adds | **Raise pushes `pendingSpawns` entries with `elite: true` at `now + 1.0`** on a **6 m** ring (`ringPoint`, `enemies.ts:1454-1476`) and a `spawnWarning {delay: 1.0}` for each, so every voice has a 1.0 s ground warning after the 1.5 s Raise cast. | Calling `spawnEnemy` directly skips the warning. `summon` is hard-coded `elite:false` (`enemies.ts:1250`). A 9 m ring cost party A 130 s at the Unweaver (5c). |
| The mirror-choir | **Four glass voices that mirror the heroes' leitmotifs.** Each Solo teaches one verb: Alto → Lament → **Chime**; Bass → Basso Ostinato → **Ward**; Tenor → Cadenza → **Reel**; Soprano → Shatter Aria → **Scatter**. | Echoes of the three beaten bosses (Dirge, Execution, Snip) need special Discord rules for Execution and cut verdicts, and don't rehearse the Reel-save. |
| Phase 2's escalation | **Tempo, not a damage buff:** the entry Raise brings the Tenor and Soprano at once whatever the cap (the choir can briefly be 4), then the cap is 3 for later Raises (every 30 s), Cues every 11 s, Discord floor 70 and +1.0/s. | Threading the soloist with `emboldenedUntil` scales only flat `attack.damage` (`rules3.ts:196-200`); `pctMaxHp` passes unscaled apart from the elite ×1.1 (`enemies.ts:765`), and damage is fixed when `beginAttack` runs. It would buff two Solos of four, and only if set before begin. |
| What 'answered' means | **One verdict per Finale telegraph** (an attack with `discord`). A victim **fails** when its own result has `dealt > 0`, `absorbedByWeaver === 0`, no `borne`, no `saved`, no `takenBy`, and it is not in a live Aegis Link. The telegraph fails when failed victims ≥ the attack's `discordQuorum` (default 1). Everything else is answered (table below). | Per-victim Discord punishes raids threefold. Ledger diffs can't tell a dodge from a failure. Perfects-only is too harsh for a healer. |
| Shatter Aria and Scatter | Aria is a ground circle r 4.5 fixed where its target stood when it began (`enemies.ts:713-716`), with **`discordQuorum: 2`**: it feeds Discord only if it catches two or more unanswered heroes. Scatter keeps the others out; the one it's on can walk out, be Reeled out, or take it under a Ward. | Quorum 1: the target is usually inside, so Scatter alone never answers it. |
| Discord numbers | 0-100. A failed boss attack +5 (tuned from +8); a failed Solo +25 (tuned from +20). A passive rise of +0.3/s in phase 1 (tuned from +0.5/s). **At phase 2's entry it rises to at least 70, then +1.0/s**, so a clean phase 2 reaches 100 within 30 s (the Skilled phase 2 targets 50-60 s). It pauses during the 2 s shift, during Fortissimo and in Stasis, resets to 0 after each Fortissimo, and is gone in phase 3. | Floor 50 and +0.8/s reach 100 after 62.5 s, longer than the phase: Fortissimo would rarely be cast in a clean fight (question 7). |
| Fortissimo Silence | A **P7 chain of three raid pulses** of 40% max life each (tuned from 50%). Base windups 3.0, 1.5 and 1.5 s: at default assists, Dissonance 0 and no Lullaby or Slow Dance, impacts land at 3.0, ≈4.5 and ≈6.0 s (±1 tick: each follow-up is queued when the pulse before resolves, `enemies.ts:1266-1273`, and begins on a later boss tick, `bosses.ts:227-230`). Every windup multiplier scales it (`enemies.ts:741-753`): telegraphLead, Lullaby and Slow Dance lengthen it, and Short Fuse's Dissonance windup multiplier shortens it (×0.9 a rank), never under `FINALE_MIN_WINDUP` 1.0 s (Principle 3). Each pulse can be Perfect-Warded. Raids never hit the Weaver (`telegraphs.ts:225-239`). `pctMaxHp` isn't multiplied by the Movement scale or the enrage (`enemies.ts:757-766`), so it is 40% of each hero's own max life in every party (a Shaken hero's max life is ×0.9, `world.ts:977`; the fraction is the same). | One 120% hit: a plain Ward and the dome can't touch it. A DoT: no Perfect on ticks (`health.ts:723-731`), and Stasis pauses ticks. |
| Crescendo cancels | **Any Calling's Crescendo** (Sunrise, the Vow, Stasis) cancels a live Fortissimo, or one that would begin while a Crescendo runs. It goes through one installer hook, `setOnCrescendo`, called in `crescendo()` (`techniques.ts:888-928`) right after the flags and `crescendoStart`, so Stasis cancels synchronously. That matters because `updateBosses` doesn't run under Stasis (`api.ts:96-100`). The script then `cancelTelegraph`s the pulses (`telegraphs.ts:689-711`), clears the boss's cast and `m2.followUp`, and sets Discord to 0. | A `ledger.crescendos` diff in `update()` misses Stasis. If Stasis only paused Fortissimo, the Chronomancer would have no cancel. |
| A threshold crossed during Fortissimo | `enterPhase` cancels the boss's cast as today (`bosses.ts:366-368`). The script's `enter(2)` **re-queues** it (`m4.queued`, Discord = 100), and it is cast again after the shift with a full telegraph. Crossing into phase 3 drops it: the Grand Silence replaces Discord. | A `PhaseDef.waitFor` gate or an HP clamp in `dealDamage` is a new read on a shared path. A free cancel by burst teaches the wrong lesson. |
| The freeze | A new **non-ailment** status `stilled`, appended to `isDisabled` (`health.ts:104-111`; 5c rule 7) and kept out of AILMENT_IDS (`schema.ts:1472-1490`), so Chime and `immune` can't touch it. `cue()` refuses a stilled hero, as it does a possessed one (`techniques.ts:861`). Reel still pulls one (`castReel` has no disable check; the Reel's flight makes them untouchable, `techniques.ts:446`), which makes the Reel-save possible. | An ailment: a Chime would free them. Fermata's `held` would hijack the Skilled `holding` branch (`skilled.ts:303-310`). |
| What a stilled hero still does | Spelled out in the contract: `noticeTelegraphs` and the low-life bark still run (`heroes.ts:97-98`); a riposte would still fire because it sits before the `isDisabled` branch (`heroes.ts:99-103`), but nothing melees in the silence, so `riposteOn` stays null (tested); a Solo already running burns out on its clock (`tickSoloClock`, `heroes.ts:105-109`). A stilled hero deals no damage, so it charges no Solo from its own hits; the notes, a Tuning Fork Perfect (`telegraphs.ts:593`) and Borrowed Time (`rewind.ts:129-131`) still charge it. | Ending a running Solo would write hero state from the script. |
| The boss during the silence | The script re-arms `boss.health.invulnerable` each tick while the silence stands (`health.ts:716` returns NO_DAMAGE) and holds `c.attackCooldown ≥ 0.5`, which gates its melee (`enemies.ts:283, 323`). Only the program's telegraphs touch the heroes. | Letting the last 25% burn while the heroes are frozen makes the notes optional. The Conductor's 110 melee on a frozen Kael would add about 3,600 over 50 s with no telegraph. |
| The last burn's attacks | **The script begins Downbeat and Sforzando itself after Reignite or the Coda** (`m4.nextDownbeatAt` 9 s, `m4.nextSforzandoAt` 12 s, through the same cast gate). The PHASES row keeps `specials: []` in phase 3, so the generic picker never casts into the silence. | Phase-3 specials on the picker would fire Downbeats at frozen heroes; a fourth PHASES row needs an HP threshold the burn doesn't have. |
| Notes | **Script ledger diffs, no new hooks.** At silence entry m4 snapshots `ledger.perfects`, `ledger.clutchCleanses`, `ledger.saves.length`, `ledger.calling.rewound` and the `rewind` markers (`ledger.markers`, pushed by `castRewind`, `rewind.ts:133`). A note is: a new Perfect; a new clutch (per hero, as the ledger counts); a new save with cause **`reel`**; or a new Rewind marker whose cast restored life (`rewound` rose) or cancelled a tracked silence telegraph (question 8). The script counts in `update()` and `stasis()`. | Hooks in `perfect()`, `updateChimes` and `recordSave` touch three hot paths. Counting every save cause lets Bear, the Vow and the Lamb score passively. Paradox spares can't be notes (above). |
| Clutch in the silence | The silence's mark **is a Dirge**: markStatus defaults to Dirge (`enemies.ts:767-768`). So the existing clutch test (`telegraphs.ts:713-716`) works unchanged. | Generalising clutch to every mark changes Movement II-III Chimes. |
| The silence program | Rest → Measure → Cadence, scheduled **from impacts**: Measure begins 0.5 s before Rest's impact, Cadence 0.5 s after Measure's, the next cycle 2.0 s after Cadence's (tuned from 1.0 s). At default assists the cycle is 10.0 s with at most two live telegraphs, and any windup multiplier scales the cycle in proportion (telegraphLead and Lullaby stretch it, Short Fuse shortens it) while the cap still holds. **The Cadence alternates**: the **Final Cadence** (115%, lethal from full) on even cycles, the **Half Cadence** (60%) on odd ones, so a lethal blow comes every 20 s, after Reel's 14 s cooldown. | Fixed offsets break under telegraphLead, Lullaby and Dissonance. A lethal Cadence every cycle wipes the Novice in 77% of silences (`silence.mjs`). |
| Reignite | Each note fills **12.5** of every stilled hero's Solo. The eighth note takes `stilled` off, leaves every standing Solo at 100 (`soloReady`; the `chargeSolos` pattern, `commands.ts:150-157`), and **stands every downed hero back up at 30%** (`reviveHero(world, hero, THREAD.reviveHpPct)`, `health.ts:1566`; `weaver.ts:33`). The burn's Solos are the Weaver's to Cue: with autonomy off (the default, `settings.ts:115`, `world.ts:342`) an uncued Solo waits (`heroes.ts:253-264`); the notes' Resonance (Perfect 20, save 25, clutch 15, `weaver.ts:66-70`) pays for the Cues. | A hero damage multiplier touches the hero damage path in every fight. 'Uncued Solos fire on their own' is true only with autonomy on. |
| Fail-forward: the Coda | At the cap (50 s × telegraphLead × the Dissonance windup multiplier, fixed at silence entry), the *Coda*: `stilled` comes off and the burn begins, but **Solos keep only what the notes gave and nobody is stood back up**. No extra attack. With no Weaver (`config.absent`) or a downed one, no notes come, and the Final Cadence downs a frozen hero every 18 s, so the party falls before the cap or limps into the Coda; the enrage ends it either way. A frozen party alone never triggers defeat (`director.ts:207-223`); downed heroes do. | No cap: the Novice can't finish (she reignites by notes in about 5% of silences, `silence.mjs`). A Coda Fortissimo hits an already hurt party and turns the Novice's Coda into a wipe. The penalty that remains (lost Solos, no revive, 50 s of blows) keeps the notes worth playing for. |
| The choir at the silence | Entering phase 3 interrupts any singing voice (`interruptEnemy`), then shatters the choir with `killEnemy(world, add, null)`: no credit, 'the choir falls silent'. | Stilling the adds would wake them into the burn and pull Focus off the boss. |
| Names | The plan's words stay. **Discord** is drawn as a stave meter in tarnished brass `#a89060` (ΔE ≥ 23.3 from every semantic colour in every vision; see *Colour*), never the Shielded affix's discord pink (bosses take no affixes). It is labelled 'the Conductor's Discord'. **'Fortissimo Silence' is always written in full**, never 'Fortissimo' (an aura, `content/auras.ts:34`). Deed ids and names avoid 'finale' (`bright_finale` is the Cantor's) and 'The Last Note' (an existing boon, `content/relics.ts:200-201`). 'Resonance' always means the Weaver's. | 'The Conductor's Resonance' (03:316) collides with the Weaver's meter, events and stems. |
| The first Finale clear | `finaleCleared(run)`: some result that `endsRun` whose encounter is the finale def's boss. The lasting record is the badge Deed **`song_goes_on`** ('The Song Goes On') in `profile.deeds`, with no profile field. It drives the Dissonance gate (question 3) and later the Atlas. | An additive `profile.finales?` counter. It is not needed until Echo pacing wants a count. |
| Finale relics | Three relics with **their own `applyRelic` cases** (`mods.ts:744-812`), each adding to an existing mod key: Tacet Mark `perfectWindowBonus += 0.1`; **Quick Rosin** `reelCooldownCut += 3` (Rewind reads it too, `rewind.ts:83`); The First Score `wardCharges += 1`. Relics apply after motifs (`mods.ts:411, 520`), so `+=` stacks on Steady Hands, Fisher's Knot and Twin Aegis, which assign. | 'KNOWN_RELICS append only' gives no effect: KNOWN_RELICS is only the tested list (`mods.ts:832-850`). 5c's hook line ('movement: 4 and nothing more', `phase-5c.md:1192`) was wrong for the same reason. A Chime-cut relic would repeat Stillwater Bell (`relics.ts:186-194`, `mods.ts:803-806`). |
| Heartbeat in the silence | The low-life heartbeat (`hud.lowHealthSound`) stays on the allow-list at −6 dB. It is an accessibility aid, and in the silence you hear the heroes' hearts. | Muting it removes a warning players rely on. |
| Versions | SIM_VERSION 22: no Command, replay or normalize change. RUN_SAVE_VERSION 5 and PROFILE_VERSION 9: every field is additive, and maps are saved whole (`save.ts:120-134`); `compatibleWithContent` (`save.ts:591`) already reads ids from CONTENT. | — |

## Engineering ground rules (the Movements I-III contract)

5a's five rules, 5b's seven and 5c's seven (`docs/phase-5c.md:119-147`) still hold. This slice adds seven.

1. **Characterisation first (W0a).** Before any behaviour change, these are committed and green:
   - **expedition3Pin**: FNV fingerprints of `generateMap(seed, 3)` for seeds 1-40, plus the I-III route strings (copying `tests/meta/expedition2Pin.test.ts:32-49`);
   - a **Rift render snapshot** and a **Rift offline-audio snapshot** (extend `tests/renderSpireSnapshot.test.ts:196` and `tests/audioSpireSnapshot.test.ts:365`, or add Rift twins);
   - the 15 goldens; m1-baseline `--movement 1|2|3 --check`; expedition-baseline `--movements 2|3 --check`;
   - preludeSnapshot, draftSnapshot, commandSnapshot, commandSnapshotM3, rosterInvariance and movement3Handoff;
   - the update-golden dry run.
2. **Every hook is a guarded early `if`, false outside the Finale.** Each reads one of:
   - `attack.discord !== undefined` (the verdict; a lint keeps it off Movement I-III attacks);
   - `world.internal.m4` or `world.field.finale` (absent keys);
   - status `stilled` (only the Conductor applies it);
   - an installed hook that `encounterScript(world)` resolves to undefined for every legacy encounter (`bossScripts.ts:69-75`). The Seamstress and Unweaver scripts define neither new hook, and with no script the installed function returns before any event or ledger write.
   - the `finale` flag on a movement def.
3. **Absent, not undefined.** `field.finale`, `internal.m4`, `DamageResult.borne`, and the new def and AttackDef fields are optional, set lazily and removed with `delete`. Nothing is added to the Weaver, Hero or Health components, and `tests/sim/rosterInvariance.keys.json` gains nothing.
4. **`borne` is set only while `world.internal.m4` exists.** Legacy Martyr fights carry borne damage (`health.ts:869-899, 968-986`); the key must not appear on their results. A test hits with Bear, Shared Wounds and the Vow in a Movement I fight and compares events and ledger entries byte for byte.
5. **No new RNG on any Movement I-III path.** The only new `rng.ai` draws are inside the Finale: the ring spawn points, Lament's and Rest's `randomNonTank` targets. The road's shuffles happen only on the Finale route. Soloist choice, Cue order, the Measure and Cadence targets and note counting are deterministic.
6. **`hitEntity` keeps its behaviour.** Its verdict is an optional out-parameter, filled only when the attack has `discord`. Return values, event order and float products are unchanged.
7. **The road is route-scoped.** `routeDefs(n)` returns `CONTENT.movements.slice(0, n)` unchanged unless the n-th def is the finale. The expedition3Pin proves `generateMap(seed, 1|2|3)` is byte-identical.

Interim rule: no band, golden or bot test is recorded against Finale content until W1, W2 and W3 merge.

## Run structure

```
Prelude:        Prep ─▶ Movement I (10) ─▶ Hollow Cantor ─▶ Summary                           (unchanged)
I-II / I-III:   in-flight saves keep their stored maps and their final boss                     (unchanged)
Expedition:     Prep ─▶ I road (6) ─▶ Cantor (interlude, Calling tier IV) ─▶ II road (6) ─▶ Vharun (interlude)
                ─▶ III (6) ─▶ the Unweaver (interlude: epic draft, 3 boss relics from Movement-4 pools,
                   75 × grade Aether, heal 50%, steadies the Shaken) ─▶ The Finale (1 stop: the Silent Conductor)
                ─▶ epilogue (≤ 20 s, skippable) ─▶ Summary
```

- `EXPEDITION_MOVEMENTS = CONTENT.movements.length` (`src/meta/profile.ts:99`) becomes 4 when W3 appends FINALE (`src/content/index.ts:106`). Every value derived from the length moves at that merge, and W3 audits each: `EXPEDITION_MOVEMENTS`, `runMovements` (`run.ts:425-428`), `expeditionReach` (`profile.ts:220-233`), `routeText.ts:234, :310`, and `tools/pacing.ts`'s default route. Any test or tool that builds an Expedition at the default length gets an explicit `movements: 2|3` where it means I-II or I-III; expedition-baseline already passes `--movements`.
- `runMovements` becomes the exported **`routeDefs(n)`**. `generateMap(seed, n) === generateMapFrom(seed, routeDefs(n))` for every n. The Finale route is 5 + 6 + 6 + 1 = 18 rows: I rows 0-4, II 5-10, III 11-16, Finale 17 (tuned from 6 + 6 + 6 + 1 = 19; see *Tuning*). RNG labels stay `'map'` and `'map:m{n}'` (`run.ts:446`).
- `buildMovement` narrows with `isFieldMovement(def)` before reading pools. A finale def builds its one fixed row and draws nothing. Movements I-III draw as before.

### The road (`FINALE.road`)

| Movement | Row | Nodes | Threat from row | Calling tier |
|---|---|---|---|---|
| I `hollow_choir` (s5; tuned from s6e, see *Tuning*) | 0 (fixed) | `first_light`: a rare motif and a relic offer (the road's own reward) | 0 (1.0) | I |
| | 1 | skirmish, elite, skirmish: each skirmish a rare motif and a relic offer | 3 | II |
| | 2 (fixed) | `bellwarden` | 7 (1.225) | III |
| | 3 | respite, merchant, forge | 8 | — |
| | 4 (fixed) | `hollow_cantor` (interlude) | 9 (1.3) | IV |
| II `crimson_legion` (6 rows, `shuffle`) | 0 (fixed) | `crimson_gate` | 0 | — |
| | 1 (lessons) | the two lessons, as today | 1 | — |
| | 2 | skirmish, elite, event | 2 | — |
| | 3 (fixed) | `gorehound_matriarch` | 4 | — |
| | 4 | respite, merchant, forge | 5 | — |
| | 5 (fixed) | `vharun` (interlude) | 6 | — |
| III `unstitched` | as shipped (6 rows) | | | |
| The Finale | 0 (fixed, final) | `the_silent_conductor` | 0 | — |

- Movement I's road (s5) keeps 2 skirmish slots and 1 elite on its one open row; its pools are shuffled per seed (Movement I has no ladder), so every pooled skirmish still appears across seeds (`tests/meta/finaleRoute.test.ts`). It has no event row: Movement I's events are met only on the Prelude and the I-II and I-III routes.
- **The road's own rewards** (`RoadVariant.rewards`, the *Bands* lever): a skirmish on Movement I's rows 0 and 1 pays a rare motif and a 2-relic offer (an elite's), with the same Aether, heal and Threat as the fight on the full map. Only road rows carry them, so the Prelude's and the I-II and I-III routes' rewards are unchanged.
- Movement II keeps its event row, so Brann's Bloodsworn Cell and his Vharun fallback (`run.ts:756-773`) are unchanged.
- Scratch (`shortM1.ts`, 24 Skilled seeds): Movement I takes 15.4 modelled minutes on 10 rows and 11.4 on s6e with Prelude Threat. Skilled won 15/24 (10 rows) and 14/24 (s6e). There is no visible difficulty shift at this size; it is re-measured at 200 seeds × 3 sets.

### Interludes, run end and rewards

- **The Unweaver becomes an interlude** with no code change (`isFinalNode`, `runEnd.ts:9-11`; the boss branch of `rewardKind`, `run.ts:403-417`). It gives:
  - an epic draft;
  - heal 0.5, which steadies the Shaken;
  - Aether 50 × 1.5 = 75 × grade;
  - 3 'boss' relics from `nodeOfferMovement` 4 (`run.ts:1405-1407`);
  - the text 'The Unweaver. Beyond it, the Celestial Crucible.' (BIOME_PLACE).
- **The Conductor ends the run.** `FINAL_CALL.the_silent_conductor` reads 'Answer the silence.' The `the_unweaver`, `vharun` and `hollow_cantor` rows stay, because saved runs still end at them (`run.ts:286-292`).
- **Rewards.** `summarize` multiplies RUN_WIN_XP 100 and the Starlight win bonus 15 by the Finale's `rewards` (`run.ts:1967-1990`). The final boss pays 0 Aether (`economy.ts:23-29`).
- Tears need an S on the run-ending boss (`dissonance.ts:85-93`). Enshrine stays 'reached Movement II' (`run.ts:586-588`).
- Win Deeds (`meta/deeds.ts:24-26`) now mean 'clear the Finale' on an Expedition, as intended. Prelude wins still count.

### Saves, profile and copy

- A **Prep-phase** I-III save is redrawn as the Finale route by `Run.setMovements` (`runStore.ts:171-178`, `run.ts:618-622`). Its path is empty, so nothing is lost. The comments that say 'Movement I comes out the same' (`movements.ts:4-6`, `run.ts:614-616`, `runStore.ts:171-173`) are rewritten.
- A run past Prep keeps its saved map. `compatibleWithContent` (`save.ts:591`) accepts the new ids once they are registered.
- **Label-aware copy** (W3, because it moves with the length). `titleEyebrow`, `prepEyebrow`, `expeditionOnward` and `routeHint` (`routeText.ts:188-239`), and `expeditionReach` (`profile.ts:220-233`, which feeds the 'expedition' unlock text), read 'Movements I–III and the Finale, to the Silent Conductor.' The Prelude literals pinned at `expedition2Pin.test.ts:118-126` don't move.
- `movementCard` pluralises ('1 stop to the Silent Conductor'). `outcomeSub` lowercases the label mid-sentence ('lost in the Finale, in the Celestial Crucible').
- `ROUTE_MINUTES.expedition` (`routeText.ts:25`) takes W9's measured figure.
- `finalBossName` (`reliquaryModel.ts:1136-1142`) follows with no edit.
- **Dissonance gate** (question 3):
  - `recordDissonance` (`profileStore.ts:509-527`) opens Dissonance when `finaleCleared(run)` and Rank ≥ 15, or when the profile already holds `song_goes_on` at Rank ≥ 15 (any run end). `award` opens it on reaching Rank 15 with `song_goes_on` held (`opensFrom`), so a first clear below Rank 15 opens it at Rank 15, as the first-clear card says.
  - Open profiles stay open. `best` per Calling still records any won run.
  - Copy at `profile.ts:327-334`, `loomModel.ts:234-239` and `dissonanceModel.ts` `closedLines` reads 'Opens at Weaver Rank 15 once you have cleared the Finale.' below Rank 15, and 'Opens with your first Finale clear.' at Rank 15+ (closed there means no clear yet).

## Vocabulary

- **AnswerTag `crescendo`** (`schema.ts:13-28`, mirrored in `events.ts:22-36`).
  - Glyph: the Crescendo key's sunburst. Used only on Fortissimo Silence.
  - ANSWER labels, GlyphIcon LABELS, ICONS and ICON_COLORS, and the sfx windStyle each gain one row. It passes the glyph ΔE test.
- **Status `stilled`** (`state.ts:71-100`; StatusIdSchema `schema.ts:34-61`; STATUS looks `labels.ts:57`).
  - Not an ailment; boss-sourced, so it pauses under Stasis (`statuses.ts:65-71`).
  - Label: 'Stilled · waits for your song'.
- **Names in copy:** Discord, Fortissimo Silence, the Cue, the Overture, the Mirror Choir, the Grand Silence, the Rest, the Measure, the Final Cadence, the Half Cadence, a note, Reignite, the Coda.

## The new sim primitives (Q-table)

| # | Primitive | Where | Inert because |
|---|---|---|---|
| Q1 | **Discord verdict.** `hitEntity(..., verdict?)` counts failed victims into `verdict.failed` (a number). After the victim loop, `resolve()` (`telegraphs.ts:295-355`) calls the installed `onTelegraphVerdict(world, t, verdict)` with `failed >= (attack.discordQuorum ?? 1)`, which forwards to `encounterScript(world)?.telegraphVerdict`. A cancelled telegraph never reaches it: answered. | telegraphs.ts; installed by enemies.ts beside `setOnCastComplete` (`telegraphs.ts:718-721`) | Runs only for attacks with `discord`; no Movement I-III attack has one (lint). |
| Q2 | `DamageResult.borne?: number`: what Bear, Shared Wounds or the Vow sent to the Weaver from this hit (set where `sendToWeaver` is called, `health.ts:869-899, 1740-1771`), **only while `world.internal.m4` exists**. | health.ts | An optional key on a returned object, never set outside the Finale. |
| Q3 | `stilled` appended to `isDisabled` (`health.ts:104-111`), plus the cue refusal (`techniques.ts:861`). | health.ts, techniques.ts, state.ts, schema.ts | Only the Conductor applies it. `isDisabled` is shared by enemies (`enemies.ts:278`), calls (`calls.ts:49, 178`), Oathkeeper (`heroes.ts:1610`) and Wind Step (`:1426`); results are unchanged, and sim-bench is re-checked for the extra scan. |
| Q4 | **Crescendo hook.** `setOnCrescendo(fn)` in techniques.ts, called once in `crescendo()` after the flags and `crescendoStart`, forwarding to `encounterScript(world)?.crescendo`. | techniques.ts; installed by enemies.ts (a setter, so no import cycle; `tests/architecture.test.ts` stays green) | Legacy scripts have no `crescendo`, and legacy encounters have no script. |
| Q5 | Lazy `field.finale` (public) and `internal.m4` (clocks and snapshots); `ensureM4` sits beside `ensureM3` (`enemies.ts:190-193`). `endEncounter` (`director.ts:278-283`) and the script's `cleanup` and `onDeath` delete both and strip `stilled`. | state.ts, world.ts, enemies.ts, director.ts | Absent outside the Finale (5c rule 3). |
| Q6 | **The route seam.** `routeDefs(n)`, the `FinaleMovementDef` union member with `road`, `NodePlace.threatRow`, `callingRows(run)`. | schema.ts, run.ts | `routeDefs(n ≤ 3)` is today's slice; MovementDefSchema is unchanged. |

- There is no new effect kind, targeting, shape, Command, RunPhase or AI.
- AttackDef gains two optional fields: `discord?` and `discordQuorum?`.
- BossScript gains two optional hooks: `telegraphVerdict?(world, boss, t, failed)` and `crescendo?(world)`.
- The registry's doc comment ('the Finale's next', `bossScripts.ts:5, 51`) is rewritten. The two tests that pin its keys (`tests/sim/rules3.test.ts:351`, `tests/sim/scripts3.test.ts:138`) take the Conductor.

### The verdict, victim by victim

| A victim's result | Verdict | Why |
|---|---|---|
| `dealt === 0` (Perfect, a full Ward absorb, Paradox spare, Reel flight `invulnerable`, untouched) | answered | nothing landed |
| `absorbedByWeaver > 0` (a partial Ward, the dome) | answered | the Weaver answered it |
| `takenBy` set: Kael's Oathkeeper or Vexis's sphere took it | answered | `oath()` returns `{...NO_DAMAGE, takenBy}` for the victim (`health.ts:1193-1208`); Kael's share is a nested `dealDamage` outside the victim loop |
| a member of a live Aegis Link (`world.internal.link`, `health.ts:1215-1223`) | answered | a Ward variant shared it |
| `saved` (Fermata's hold, Sacrificial Lamb, the Vow's floor) | answered | a save answered it (`health.ts:915-927`) |
| `borne > 0` (Bear, Shared Wounds, the Vow) | answered | the Martyr carried it |
| `dealt > 0` with only Fermata's guard DR or nothing | **failed** | an aura isn't an answer |
| not inside (walked or Reeled out, Scattered) | not a victim | — |

## The Silent Conductor (`the_silent_conductor`, `src/content/crucible.ts`)

Tall and robed in a Weaver's ribbons gone ash-grey, it carries a baton and a stilled halo of five stave lines. It was the first Weaver.

- **Body:**
  - life 40,000 base (tuned from 60,000), ×1.85 = **74,000** at Threat 1.0 (the Finale's row 0). The Unweaver has 144,300 before its row-5 Threat of 1.15 (`threatFor(5)`, `economy.ts:17-21`), about **166,000** in a run, so the Conductor has about **0.45** of its life: the silence and the burn carry the length;
  - speed 2.2, radius 1.5, height 4.8, `keep: 0`;
  - melee 110 (×1.05) every 1.6 s at range 3, held off in the silence;
  - material `glass`.
- **The fight:**
  - encounter `the_silent_conductor`: boss, movement 4, arena `the_crucible`;
  - enrage **420 s** (×2.5; inside the harness's 540 s at `tools/harness-core.ts:360`, decrees.ts's 9 minutes and the counterfactual's 600 s at `counterfactual.ts:29`);
  - par 200: the Skilled mean (174 s over the three cell sets, 50 seeds each) × 1.15, to 5 s (tuned from 225);
  - hints `['decree','discord','silence']`.
- **Opening grace:** nothing lethal in the first 4 s. The first Raise is at +3 s, the first Cue at +8 s.
- Bosses ignore stun and sleep (`health.ts:268-272`). The Cue can't be interrupted, but every Solo can.
- **Specials** list every scripted attack (as `the_unweaver`'s do, `unstitched.ts:797-805`): Downbeat, Sforzando, Cue, Raise, Fortissimo ×3, Grand Silence, Rest, Measure, Final Cadence, Half Cadence. Each voice lists its Solo.
- **Codex:** 'The first Weaver. It held the song longer than anyone, and believes the world has earned its rest. Its baton Cues a mirror-choir that sings your heroes' Solos back at you; every blow you leave unanswered feeds its Discord, and at the last it stops the music.'
- **PHASES row** (`bosses.ts:74-138`): `[{at:1, name:'Overture'}, {at:0.6, name:'Mirror Choir'}, {at:0.25, name:'Grand Silence', specials:[]}]`, each with a decree and answers. It feeds `bossPhaseTable` and the HUD (`hudBridge.ts:78-80`), which stays pure by defId. In phase 3 the generic picker has no specials; the script begins the burn's Downbeat and Sforzando.

### Its own attacks (picker in phases 1-2; the script in the burn)

| id | Name | Shape | Windup | Every | Damage | Answers | Discord |
|---|---|---|---|---|---|---|---|
| `conductor_downbeat` | Downbeat | cleave on current, r 4, 90° | 1.6 s | 9 s | 600 (tuned from 820) | ward, dome (`decreeNoDome`) | 5 |
| `conductor_sforzando` | Sforzando | beam at the farthest hero, 22 × 1.4 | 1.8 s | 12 s | 320 (tuned from 560: ×1.05 it is 336, under the Weaver's 360) | move, reel | 5 |

### Scripted casts

| id | Name | Kind | Windup | Cadence | Answers | Notes |
|---|---|---|---|---|---|---|
| `conductor_raise` | Raise the Choir | burst, script, 0 dmg | 1.5 s | +3 s; at phase 2's entry; then every 30 s while under the cap (tuned from 20 s) | focus | pushes elite `pendingSpawns` at +1.0 s on the 6 m ring, each with a `spawnWarning` |
| `conductor_cue` | Cue | burst, script, 0 dmg, not interruptible | 1.2 s | 12 s (P1, tuned from 14 s), 11 s (P2), 7 s enraged | focus | its bar reads 'Cue · Bass: Basso Ostinato'; Decree on its first 2 casts; resolves into the Solo |
| `fortissimo_silence` (+`_2`, `_3`) | Fortissimo Silence | raid ×3 (P7 chain), `allHeroes` | 3.0 / 1.5 / 1.5 s | Discord = 100 | crescendo, dome, ward | pctMaxHp 0.4 each; cast pips 1/3-3/3; `decree` / `decreeNoDome` |
| `grand_silence` | Grand Silence | burst, script, 0 dmg | 2.0 s | phase 3 entry | ward, chime, reel | the freeze on resolve |
| `silence_rest` | Rest | mark (Dirge), `randomNonTank` | 3.5 s | cycle start | chime, ward | pctMaxHp 0.5 on detonation; the clutch note |
| `silence_measure` | Measure | burst `centre:'target'` r 2.5, current target | 2.0 s | 0.5 s before Rest's impact | ward | pctMaxHp 0.7; the Perfect note |
| `silence_cadence` | Final Cadence | burst `centre:'target'` r 2.5, `lowestHp` | 2.5 s | even cycles, 0.5 s after Measure's impact | reel, ward | pctMaxHp 1.15, lethal from full; the Reel-save note |
| `silence_half_cadence` | Half Cadence | burst `centre:'target'` r 2.5, `lowestHp` | 2.5 s | odd cycles, same slot | ward, reel | pctMaxHp 0.6; a Perfect or a plain Ward |

All silence attacks have range 44 (the arena's diameter) and carry `discord: 0`: the verdict runs (so recaps and tests can name answers) but feeds nothing. Every Measure and Cadence is a ground circle fixed where its target stood, so a Reel pulls a frozen hero out.

**Decrees** (in the Conductor's voice):

- **Overture** (entry; again on the first Cue): 'The Overture — the Conductor Cues its choir. Interrupt the soloist, or answer its Solo. Every blow you leave unanswered feeds its Discord.' Answers `focus`, `ward`, `chime`, `reel`.
- **Mirror Choir** (entry; again on its first Cue): 'Mirror Choir — every voice of your party, sung back at you. Discord swells: hold your Crescendo before it fills.' Answers `focus`, `crescendo`.
- **Fortissimo Silence:** 'Fortissimo Silence — every hero loses 120% of their life over 3 s. Crescendo to cancel it, or dome, Ward and heal.'
  - Without a dome: 'Fortissimo Silence — 120% of every hero's life over 3 s. No dome: keep 100 Resonance and cancel it with your Crescendo; Ward the one you can't lose.'
- **Grand Silence** (entry; again on the first Measure): 'Grand Silence — the music stops and your heroes freeze. Only your Perfect Wards, Clutch Chimes and Reel-saves are heard. Eight notes rebuild the song.' Answers `ward`, `chime`, `reel`. (A Chronomancer reads 'Rewinds that undo a blow' for Reel-saves, question 8.)

Phase banners also carry a line: phase 2 'Hear how they strain.', phase 3 'Hush.'

### Phase 1 — Overture (100-60%)

- At +3 s it raises the **Alto** and the **Bass**. Choir cap 2.
- Every 12 s it Cues a soloist. The Cue lasts 1.2 s, then the Solo winds up for 2.5 s and names its target. From the Cue's start to the Solo's impact, a baton line joins the Conductor and the soloist.
- Downbeat and Sforzando run on the picker. Discord rises +0.3/s, plus failures.
- **The Cue gate:** no Cue while Fortissimo is up, while the boss is casting, or while 2 or more damaging telegraphs are live.
- **Soloist choice:** an idle standing voice never Cued first, else the one Cued longest ago, ties broken by entity id. If none is idle, the Cue waits. If none stands, it becomes a Raise, cast once: no Raise begins while another is in flight (its voices are on their way), so the Cue then waits for them.
- **Double threat:** a Downbeat on the tank while a Solo sings (two telegraphs, inside the cap). Ward the tank, and interrupt or answer the Solo.
- Skilled target: about 60-70 s, about 4 Cues (2 each for Alto and Bass).

### Phase 2 — Mirror Choir (60-30%)

- Discord rises to **at least 70**, then +1.0/s: a clean phase 2 meets Fortissimo Silence within about 30-33 s (the in-flight Solo resolves first).
- A Raise is cast at once and brings the **Tenor** and **Soprano** whatever the cap (the choir can be 4 for a while). The choir cap becomes 3 for later Raises: any missing voice every 30 s while under it, in order Tenor, Soprano, Alto, Bass.
- The Cue comes every 11 s; never-Cued voices first, so the Tenor and Soprano sing early.
- A Fortissimo Silence cut off by the threshold shift is cast again after it.
- Skilled target: about 50-60 s, one Fortissimo (two with failures), about 4 Cues.

### Discord and Fortissimo Silence (phases 1-2)

- Each failed Finale telegraph adds its `discord` and pushes `discordRose {boss, telegraph, amount, value}`.
- At 100, once no Cue or Solo is live (an in-flight Solo resolves first, at most 2.5 s; a Cue still being cast lands and its Solo resolves first, at most 1.2 + 2.5 s), the Conductor begins Fortissimo Silence. It never begins on the tick a Cue lands, beside that Cue's Solo.
- A Crescendo cancels it (`fortissimoCancelled {by:'crescendo'}`). If it isn't cancelled, three pulses land, and Discord resets to 0 after the third.

Survival at full life without a Crescendo (120% = Kael 1,920, Lyra 984, Vexis 888, Brann 1,500; `heroes.ts:11, 99, 187, 279`; Ward = 30% + 120 for 3 s, cooldown 7, `weaver.ts:40-46`; Mend 90/s on one hero, `weaver.ts:26`):

| Answer | Kael | Lyra | Vexis | Brann |
|---|---|---|---|---|
| none | down | down | down | down |
| dome only (40%, `solos.ts:71-81`) | 1,408 (lives) | 722 (lives) | 651 (lives) | 1,100 (lives) |
| dome + Ward (30% + 120) | 808 | 356 | 309 | 605 |
| dome + a Perfect on one pulse | 768 | 394 | 355 | 600 |
| **no dome (party B):** Ward on pulse 1 + Mend 3 s (270) | — | 348 (lives) | 276 (lives) | 735 (lives) |
| **no dome:** none on this hero | — | down | down | down |
| **Martyr, no Vow ready:** Bear on the threaded hero (35%, `callings.ts:100-105`) | 1,248 (lives) | 640 (lives) | 577 (lives) | 975 (lives) |
| any Crescendo | 0 | 0 | 0 | 0 |

- One Ward per 6 s window (cooldown 7) and one Mend thread: in party B without a Crescendo you save one hero and lose about two. Twin Aegis adds a second Ward.
- Bear sends 17.5% of each threaded hit to the Martyr Weaver (35% softened 50%), never past 1 life; the others take the 'none' row.
- Fermata's guard (DR 0.3 below 35%) and its once-a-fight hold (`health.ts:900-910`) are the last net.
- A Shaken hero's max life is ×0.9 (`world.ts:977`); the pulses are the same fraction, so the table holds in proportion.
- Expect a down or two without a Crescendo. That is the lesson: Resonance is the budget, as with the Cantor's Requiem.
- **Party B** has no dome, so the Crescendo is mandatory there, and the decree and hint say so.
- **The Martyr's Vow** keeps every hero at 1 life, but about 30% of the excess flows to her uncapped (`health.ts:869-899`). If that downs her, the Vow ends (`health.ts:1535-1539`). Because the Vow's Crescendo *cancels* Fortissimo through Q4, the pulses never land and the redirect never happens.

### Phase 3 — Grand Silence (30-0%; tuned from 25%)

1. **Entry.** Any singing voice is interrupted, and the choir shatters with no credit ('the choir falls silent'). Discord and its HUD go, a pending Fortissimo is dropped, and `grand_silence` is cast (2.0 s).
2. **On resolve:**
   - every standing hero gains `stilled`;
   - the boss is held `invulnerable` and its melee held off (`attackCooldown ≥ 0.5`);
   - `field.finale.silence = {notes: 0, of: 8, since: now, until: now + cap, sources: []}`;
   - m4 snapshots the ledger;
   - event `silenceBegan`.
   Stilled heroes don't move, attack, cast, take calls or take Cues. They can still be Reeled, Mended, Chimed, Warded and Rewound. What still runs is in the decisions table ('What a stilled hero still does').
3. **The program** repeats Rest → Measure → Cadence, scheduled from impacts (10.0 s a cycle at default assists; tuned from 9.0 s): Rest 0-3.5, Measure 3.0-5.0, Cadence 5.5-8.0, the next Rest at 10.0. The Cadence is the Final Cadence on even cycles and the Half Cadence on odd ones. At most 2 damaging telegraphs are live at once, and targets skip downed heroes.
   - Notes possible per cycle: a clutch on the Rest (Chime, 9 s); a Perfect on Measure or Cadence (Ward, one per cycle with one charge, cooldown 7); a Reel-save on the Final Cadence (Reel, 14 s, so ready for every Final Cadence).
   - **Modelled pace** (`silence.mjs`, 1,500 runs a row, entry at 70% life, the Weaver's real cooldowns; a simplification of the bots):

     | Weaver | reignites by notes | median time to 8 | heroes standing at the end (of 3) | wiped in the silence |
     |---|---|---|---|---|
     | Skilled, default party | 100% | 29.6 s | 2.5 | 0% |
     | Skilled, party B | 100% | 29.6 s | 3.0 | 0% |
     | Skilled, Anchor (no Reel-saves) | 98% | 38.6 s | 1.8 | 1% |
     | Skilled Chronomancer (Rewind notes, question 8) | 100% | ≈ 26 s (the model is generous to Rewind; expect 30-38) | 2.7 | 0% |
     | Novice, default party | 7% | 47 s | 0.8 | 38% |
     | Novice, party B | 4% | 48 s | 0.9 | 42% |

     With a lethal Cadence every cycle, the Novice is wiped in 77-78% of silences; that is why the Cadence alternates.
   - A Chronomancer without question 8's Rewind notes makes about 1.8 notes a cycle (Perfects with a 0.45 s window and clutches): about 40-45 s.
   - Twin Aegis, The First Score and Quick Rosin add more.
   - A plain Ward still saves a Final Cadence target (Lyra takes 943 − 366 = 577 of 820), but makes no note.
   - **Swap** in the silence: the Weaver lands in the circle and takes the attack's share of her own 360 life (Final Cadence 414) behind a barrier of 50% of the hero's life (`variants.ts:42-47`): Kael 800, Brann 625, Lyra 410, Vexis 370. She takes at most 44 (Vexis), or up to 458 of a Martyr's 720. Swap records the save, so it is a note; the Skilled bot Swaps only above 25% life.
4. **Each note:**
   - `silenceNote {n, of: 8, source: 'perfect'|'clutch'|'reel'|'rewind', hero}` (`hero` null for a Rewind note);
   - `field.finale.silence.notes = n`;
   - every stilled hero's Solo +12.5;
   - one sky ring relights.
5. **Eight notes — Reignite:**
   - `stilled` comes off every hero, every standing Solo is at 100 (`soloReady`), **every downed hero stands back up at 30%**, and the invulnerability and melee hold end;
   - `reignited {boss, revived}`, a 0.5 timeScale for 12 ticks, and each party hero's leitmotif plays as it unfreezes;
   - `field.finale.silence` is deleted;
   - **the last burn:** the script begins Downbeat every 9 s and Sforzando every 12 s. At 30% of 74,000 (22,200 life) that is about 15-20 s with the reignited Solos Cued.
   - Barks, one per party hero: Kael 'Still needed.' · Lyra 'You had my back.' · Vexis 'It… resolves.' · Brann 'A pain I can sing to.'
6. **The cap — the Coda** (50 s at default assists).
   - 'The Conductor tires of waiting.' `stilled` comes off; Solos keep only what the notes gave; the downed stay down.
   - `silenceBroken {boss, notes}`.
   - The last burn follows, with the same scripted Downbeat and Sforzando.
7. **Without you** (absent or downed Weaver): no notes come. The Final Cadence downs a frozen hero every 18 s and the Rest and Measure wear the rest; the party falls inside the silence or reaches the Coda crippled. With `config.absent` the fight ends by 450 s (the enrage at 420).
8. **Death and the encounter's end** (`onDeath`, `cleanup`, `endEncounter`): `stilled` comes off, Fortissimo is cancelled, and `field.finale` and `m4` are deleted. This holds in a sandbox too, as `unweaverDeath` does (`unstitchedBosses.ts:397-400`).

**Stasis.** `stasis(dt)` waits every m4 clock (`nextCueAt`, `nextRaiseAt`, `nextRestAt`, `nextMeasureAt`, `nextCadenceAt`, `nextDownbeatAt`, `nextSforzandoAt`), `field.finale.silence.until` and the passive Discord, and counts notes. A Ward cast in Stasis counts as cast when time stopped (`stasis.ts:52-58`), so a well-timed Stasis lines up Perfects.

**Foresight** (`scriptedNext`) reports the soonest of the Cue, the Raise, Fortissimo when queued, the next silence attack, and the burn's Downbeat and Sforzando.

**Fight shape** (default Skilled cell, target): P1 about 65 s, P2 about 55 s, two shifts 4 s, the silence about 30 s, the burn about 30 s. That is **170-230 s**, inside 02 §7's 3-5 minutes. Measured after tuning (`_diag` probe, 50 Skilled seeds from 1000, all won, mean 178 s): P1 ends at about 69 s (the Conductor walks out at 3 s), P2 lasts about 64 s, the shift and the Grand Silence's cast about 2 s, the silence 26 s (8 notes in 25 s), the burn about 17 s. The silence and the burn are shorter than the target; P1 and P2 carry the length.

## The mirror-choir (boss adds, `movement: 4`, `material: 'glass'`)

Four faceted glass choristers echo Movement I's porcelain choir. Each voice mirrors one hero's leitmotif (inverted, minor). Each Solo teaches one verb, and three of them are the Grand Silence's notes.

- **Body:** base life 1,200 (the Bass 1,800; tuned from 2,000 each); with elite ×2.2 and ×1.85, about 4,880 (the Bass 7,330).
- **Basic attack:** Alto and Soprano are ranged, 45 every 1.8 s at range 10 (tuned from 60). Bass and Tenor are melee, 90.
- **Every Solo** is `scripted`, `interruptible`, range 44 (the arena's diameter), and listed in its def's `specials`, with `discord: 25` (tuned from 20) and a **2.5 s** windup.
- Elites can be stunned (`health.ts:291-292`). The native interrupters are **Kael's Shield Bash** (`heroes.ts:1127-1133`), **Lyra's Piercing Shot**, which seeks a caster on its own (`heroes.ts:976-983`), and **Brann's Sunder Leap** (`heroes.ts:1350-1356`). **Vexis has no native stun** (Gravity Well and Starbolt stun 0, `content/heroes.ts:207, 218`): she stuns only through an answered call or her Cued Starfall. Focus points any of them at the soloist.

| Voice | Mirrors (leitmotif) | Solo | Shape | Damage (code → as an elite) | Verb (glyphs) | Rehearses |
|---|---|---|---|---|---|---|
| `mirror_alto` | Lyra (pluckFlute) | **Lament** | mark (Dirge), `randomNonTank` | pctMaxHp 0.5 → 55% | **Chime** (chime, ward, focus) | the clutch note |
| `mirror_bass` | Brann (bowedLow) | **Basso Ostinato** | ground circle on its current target, r 2.5 | 1,000 (×1.25 elite ×1.05) | **Ward** (ward, dome, focus) | the Perfect note |
| `mirror_tenor` | Kael (horn) | **Cadenza** | beam at the farthest hero, 24 × 1.6 | pctMaxHp 1.0 → 110% (lethal from full) | **Reel** (reel, move, focus) | the Reel-save note |
| `mirror_soprano` | Vexis (glassBell) | **Shatter Aria** | ground circle on its current target, r 4.5, `discordQuorum 2` | 480 | **Scatter** (scatter, move, ward, focus) | spacing |

- **Solo Decrees** are built at begin time, when the target is known, so they name the hero (`decreeLimit 2`, the Steal Verse pattern, `unstitchedBosses.ts:369-373`):
  - 'Lament — the Alto's Solo marks {hero}. Chime it away (in its last second, a Clutch), or interrupt the Alto.'
  - 'Basso Ostinato — the Bass's Solo on {hero}. Ward on the beat, or interrupt it.'
  - 'Cadenza — the Tenor's Solo cuts a line to {hero}: more than their life. Reel them out, step aside, or interrupt it.'
  - 'Shatter Aria — the Soprano's Solo shatters a crowd around {hero}. Scatter so it catches one, or interrupt it.'
- Each voice's codex line names its Solo and answer. A share of life is told as it lands on the elite voice (the right-hand number above: the Lament's 55%, the Cadenza's 110%), so the Codex, the Decree ('more than their life') and this table agree.
- First-sighting cards come from `crucibleLesson`, shown at the voice's first Cue.

## Every beat, its verb and its answer

### By Calling

The Chronomancer's Reel slot casts Rewind (18 s cooldown, `callings.ts:194`; revives once a run, `rewind.ts:40-44`), and Stasis is her Crescendo. Paradox is an optional pick; without it, her row's non-Paradox answers apply.

| Beat | Verb | None / Luminary | Martyr | Chronomancer (no Paradox / Paradox) |
|---|---|---|---|---|
| Cue → any Solo | Focus | Focus or interrupt the soloist; else answer the Solo's shape | same; Bear softens a missed Solo (counts as answered) | same; Stasis freezes the windup; Foresight shows the Cue / Paradox cancels aimed Solos |
| Lament | Chime | clutch-Chime, or Chime early; Ward | same | Chime / Paradox cancels the mark |
| Basso Ostinato | Ward | Perfect or plain Ward; dome; walk out | same; Bear | Perfect (0.45 s window); Rewind steps them back out |
| Cadenza | Reel | Reel the target out; step; Perfect | same | Rewind steps them back out of the line (counts as a dodge, `rewind.ts:107-112`) / Paradox cancels (aimed beam) |
| Shatter Aria | Scatter | Scatter; Ward or Reel the one it's on | same | Scatter; Rewind / Paradox spares |
| Downbeat, Sforzando | Ward / move | Ward, dome / move, Reel | same; the Vow | Ward, Rewind / Paradox |
| Discord | answer telegraphs | any answer; partial Wards count | `borne` counts | Rewind and Paradox count |
| Fortissimo Silence | **Crescendo** | Sunrise cancels (and heals 20%); else dome + Ward + Mend + Fermata | **the Vow cancels**; else Bear on one hero | **Stasis cancels** (synchronous hook) |
| Grand Silence notes | Perfect, Clutch, Reel-save | all three | all three (Bear, Vow and Lamb saves are not notes) | Perfect + clutch + a Rewind that undoes a silence blow (question 8); a frozen hero can't be Rewound out of a shape / + Paradox's Rewind cancels the aimed blow (same note) |
| Last burn | Cue | Cue the reignited Solos; Empower | same | same |

Technique variants:

- **Swap** records Reel-saves (`techniques.ts:731-736`); in the silence it costs the Weaver ≤ 44 life (Martyr: up to 458 of 720).
- **Anchor** never does (`:784-797`), so an Anchor Weaver rebuilds with Perfects and clutches (modelled 38.6 s median).
- **Twin Aegis** is the fastest note engine.

### By party

| Party | Native Solo interrupters | Dome for Fortissimo | Notes |
|---|---|---|---|
| default (Kael, Lyra, Vexis) | Lyra (on her own), Kael (Focus) | Kael | reference; Vexis stuns only through a call or her Cued Starfall |
| A (Kael, Vexis, Brann) | Kael and Brann (Focus) | Kael | Melee-heavy: the 6 m ring keeps Kael and Brann close. Blood Rage halves the Weaver's healing on Brann (`blood.ts:110-114`), so Ward Brann before Mending him. |
| B (Lyra, Vexis, Brann) | Lyra (on her own), Brann (Focus) | **none**: `decreeNoDome`; the Crescendo cancel is mandatory | No tank: Basso hits the voice's current target (often Brann). Ward him. |
| C (Kael, Lyra, Brann) | Lyra; Kael and Brann by Focus | Kael | — |

The Grand Silence doesn't depend on the party: only the Weaver acts, and the attacks scale with each hero's max life.

## Encounter and arena

- **`the_crucible`:** r 22, open with no pillars, so the Sforzando and Cadenza lines stay readable. Biome `celestial_crucible`.
  - Floor: obsidian glass `#16141f` (darkened ×0.78, `arena.ts:76`), lines `#5a5470`, accent `#3a3350`, fog `#0b0a14`.
  - Floor-vs-telegraph lightness is tested as in `tests/renderMovement3.test.ts:342-375`.
- **Encounter flavour:** 'At the top of the sky a figure in a Weaver's ash-grey ribbons lifts its baton. "Rest," it says. "Let them rest."'
- **Content lint additions** (`lintMovements`, `schema.ts:1656-1760`; rejection cases in `tests/content.test.ts`):
  - A finale def (the `FinaleMovementDefSchema` member) is the last def, with `rows [['boss']]` and its boss fixed on row 0. `road` names earlier field defs. Each road variant passes Movement-I-style lint:
    - row 0 fixed to the opening; last row the boss;
    - `threat.length === rows.length`;
    - `callingRows` only for movements[0], one per Calling tier, each an all-fight row or that Movement's boss.
  - `discord` and `discordQuorum` only on movement-4 attacks; an attack answering `crescendo` is a raid.
  - Every scripted Solo and silence attack has range ≥ the arena's diameter (44 for r 22). It is a content test (`tests/content.test.ts`, 'every scripted Finale attack spans the Crucible'), not a `lintMovements` rule.
  - BiomeSchema gains `celestial_crucible`; Material gains `glass`.
  - `tests/sim/m1Unchanged.test.ts`'s forbidden-key lists gain `discord`, `discordQuorum`, `road` and `finale` for Movement I-III defs, and `'label' in m` stays false for movements 0-2.

## Rewards and the first Finale clear

- **Relics** (appended to `RELICS`, `movement: 4`, added to KNOWN_RELICS at `mods.ts:832-850`, **each with its own `applyRelic` case** at `mods.ts:744-812`):
  - They sleep outside Finale fights (`relicAwake`, `world.ts:700-719`) and are filtered inside the pools (`offered`, `run.ts:1420-1441`), so they are offered only at the Unweaver interlude.
  - That interlude draws 3 from rare and legendary. Today only 11 such relics exist, and a Skilled winner holds 11-15 of the 16 non-cursed ones, so without these the offer runs short.
  - **Tacet Mark** `tacet_mark` (rare): 'Your Perfect Wards are {seconds} s more forgiving.' `{seconds: 0.1}` → `m.perfectWindowBonus += num(v,'seconds')` (the Steady Hands wording; `tests/architecture.test.ts` bans the bare identifier `window`, the browser global, in sim and content source).
  - **Quick Rosin** `quick_rosin` (rare): 'Reel (and Rewind) recover {cut} s sooner.' `{cut: 3}` → `m.reelCooldownCut += num(v,'cut')` (Rewind subtracts it too, `rewind.ts:83`). It speeds the Reel-save note; no relic cuts Reel today.
  - **The First Score** `first_score` (legendary): 'Your Ward holds {charges} more charge.' `{charges: 1}` → `m.wardCharges += num(v,'charges')`.
- **Deeds** (0-point badges; the ladder stays at exactly 10, `schema.ts:1981`; the count goes 25 → 27, `tests/meta/deeds.test.ts:179, 209`), both using the existing `fight` test (`meta/deeds.ts:52-57`):
  - *The Song Goes On* `song_goes_on`: beat the Silent Conductor. The profile's record of the first Finale clear.
  - *Not One Silent* `not_one_silent`: beat it with no hero down.
- **No motif and no Finale event.** A Finale-category epic needs new sim code by id. A boss-only Movement has no event row (`run.ts:453-456`).

**What the plan ties to the first Finale clear, and what 5d does:**

| Plan | Repo today | 5d |
|---|---|---|
| Dissonance 'after the first Finale clear' (02:236, 02:250, 03:461) | opens on any win at Rank ≥ 15 (`content/dissonance.ts:120-122`, `profileStore.ts:509-527`) | opens on `finaleCleared` at Rank ≥ 15; open profiles stay open (question 3) |
| Atlas of Echoes, weekly seeds (02:251) | absent | 'later' line on the first-clear card; `song_goes_on` is their gate |
| True Dissonance, a fourth phase (03:481) | LATER_LEVELS placeholder (`dissonanceModel.ts:43-47`, `tests/uiPhase4d.test.ts:401`) | unchanged by default (question 4); the seam is in *Known gaps* |
| Badges and Deeds | 25 Deeds | +2 badges |

**The Summary's first-clear card:** 'The Song Goes On — your first Finale clear', then 'Dissonance is open' (or '… opens with a Finale clear at Weaver Rank 15 or above'), and 'Coming later: the Atlas of Echoes and True Dissonance'. It never claims anything unbuilt is open.

## Presentation

### Biome: the Celestial Crucible (`src/render`)

- **Look:** `ArenaLook 'crucible'` (`crimsonCues.ts:100-121`), `BIOME_LOOK.celestial_crucible = 'crucible'`, and a `CRUCIBLE_MOOD` MOODS row:
  - a deep night-navy sky (hemi about 0.5);
  - a warm-white key no brighter than the Reliquary's 1.85;
  - a pale prismatic rim ≤ 0.45 from the far side.
  - `BIOME_LOOK` is Partial, so a test asserts the row exists (a missing row would silently draw the Reliquary).
- **The disc stays dark.** White-gold lives only on the perimeter and in the sky. `#fff6e0` is ΔE 4.2 from Resonance `#fff4d6`, so it must never touch hero rims, telegraph areas or the key light (04 §1 rule 4: gold means the Weaver).
- **`ArenaView`** gains a third case in both switches (`arena.ts:46-91`), keeping the 7/6 mesh budget and the Low-quality hiding (`:1155-1161`):
  - `createCrucibleFloor`: obsidian glass with gold-leaf inlay in the line colour;
  - `createCrucibleRim`: white-gold choir stalls, organ pipes and prism shards, tall only on the far side;
  - the 'rays' slot becomes **`createSkyOrrery`**, eight concentric rings beyond and tilted over the far rim, because the 52° pitch and 40° FOV never show the sky (`camera.ts:8`, `stage.ts:12`). Uniforms `uStems[4]`, `uNotes`, `uBeat`; the rings turn on the beat;
  - the 'dust' slot becomes `createPrismMotes`.
- **`FrameInfo.music?`** (additive, `src/render/types.ts:24-55`) carries the beat phase, bar and stem levels. The runtime fills it from `SynthDirector.musicState()` (`director.ts:398-400`). Without it (tests, audio locked or off), render derives a beat from `state.time` and the levels from `field.finale`, so the orrery reads with the sound off.
- **Models** (`models/library.ts:243-254`, `buildCrucible` before the role fallback, primitives only):
  - the Conductor: tall, robed, a baton, a halo of five stave lines, the Weaver's ribbons in ash grey (never her gold);
  - four faceted glass choristers, each with a tint stripe for its voice.
- **Material `glass`:** a death bursts into prism shards that rise as notes.

### VFX (`src/render/crucibleCues.ts`, new and pure, like `riftCues.ts`)

- **Readers:** `finaleOf(state)`, `discordOf`, `cueOf`, `silenceOf`, `isStilled(hero)`.
- **Counters:** `drawnFinale` and `firedFinale` stay zero in every Movement I-III fight (the `drawnM3` test pattern, `tests/renderMovement3.test.ts:286-299`).
- **`riftCues.ts` is not edited.** Everything Finale-only lives in `crucibleCues.ts`, called from the frame after the Rift's cues and gated on `finaleOf(state)`.
- **The Cue:**
  - a tarnished-brass baton line (BEAM `dashed`) from the Conductor to the soloist, drawn from `field.finale.cue`;
  - SPRITE.baton over the soloist;
  - the Solo's cast progress and interruptible flag on its over-head bar (`entities.ts:2342-2384`).
- **Discord fed:** a brass streak from each failed victim (`discordRose.failed`) to the Conductor, and a '+25' floater (a Solo's; '+5' for the Conductor's own blows). Nothing when answered.
- **Fortissimo Silence:**
  - the existing raid path (`overlay.raid`, `telegraphs.ts:780-795`) with pulse pips 1/3-3/3, plus `overlay.danger`;
  - a rising white rim that cuts to nothing on each pulse;
  - a Crescendo cancel shatters the ring outward.
- **The Grand Silence:**
  - a `silence` term in the light block (`feedback.ts:3823-3845`) lerps hemi and key toward grey, and relights a step per note. It is **inside an `if (silence > 0)`**, never a lerp by 0, so float rounding can't move the Spire or Rift snapshots;
  - `overlay.setSilence(v)`, a steady desaturated vignette copying `setStasis` (`overlay.ts:1057`);
  - the orrery goes dark;
  - stilled heroes use the `held` freeze-frame path (desat 0.72, no tremor; `entities.ts:1504-1508`);
  - aura rings stay as they are, because by default they still work.
- **Each note:** a gold SPRITE.note mote rises from the hero to the orrery and relights a ring, with a ring pulse on the hero (the Weaver did this).
- **Reignite:** a gold rim flare on each hero (the revived ones rise in it), and the orrery at full.
- **New styles** go inside the existing 12 batches only: SPRITE.note, SPRITE.baton, RING.stave.

### Colour (measured with the repo's `deltaE` / `simulateVision`, `colorVision.ts:118-160`)

Each candidate was checked against heal, shield, amp, lethal, threat, ailment, Bear, Mend, Empower, gold, goldHot, Resonance, Weaver, dome, the discord pink and Fermata.

| Candidate | Min ΔE, any vision | Use |
|---|---|---|
| tarnished brass `#a89060` | ≥ 23.3 (Bear, deuteranopia; 24.0 from Empower/amp) | **the Discord meter, baton line, Cue sigil** (`FINALE_HEX`, `DISCORD_HEX`) |
| tarnished bronze `#7a5646` | 7.4 (Bear, deuteranopia; the ≥ 32.4 was against an older Bear) | not used |
| `#8a6a5a` | 12.6 | not used |
| stave `#605078` (`CRUCIBLE_HEX.stave`) | ≥ 21.4 (ailment, protanopia) | the silence stave ring |
| cobalt rim `#4a5aa8` | ≥ 23.6 (ailment, tritanopia) | the Crucible's mood rim (the W0b placeholder `#c9d3f5` sat 2.1 from Fermata, protanopia, and 5.9 from shield, deuteranopia) |
| starlight-bone key `#e2dccc` | 5.3 (Fermata, tritanopia; 7.3 from goldHot, 13.3 from the nearest live role, call) | the Crucible's key light: a scene light, not a mark (`CRUCIBLE_UNMARKED`, so it never draws a ring or a beam), never white-gold |
| ash `#9aa0aa` | 2.8 (ailment, deuteranopia) | never a semantic hue: the silence is desaturation, not a colour |
| sky lilac / white-gold | 0.7 (shield, protanopia) / 4.2 (Resonance) | ambient, off the combat disc only |

- Notes use the Weaver's own gold and the existing Perfect, Clutch and Save colours: they are her doing.
- Every colour is paired with a shape: the stave meter, the baton sigil, the note glyph.
- The ABYSS_HEX test pattern extends to Resonance and gold.

### Audio (`src/audio`; D dorian, 88 BPM, `theory.ts:7-17`)

- **Crucible BiomeVoicing row** (`music.ts:157-285`; VOICED_BIOMES `:176`):
  - progression D5add9 – G6/D – Em7add11 – A7sus4 (kept inside D dorian: the first draft's Dadd9 – Gmaj7/D – Em9 held an F♯);
  - pad: celesta-organ; pulse: a baton tick; melody: prismatic glass; choir: the full choir;
  - ambience: high bowed-glass shimmer.
  - The Conductor's motif is the Weaver's phrase inverted (`mirrorIndex`). Each Cue plays the voice's mirrored leitmotif in minor.
- **Discord fed:** a soft half-step tick (E–F). The phase-2 rise is a slow rising pad note under the stems.
- **Fortissimo Silence:** a rising tutti over each pulse's whole windup (3 s for the first at default assists; every windup multiplier scales it, Short Fuse down to the 1.0 s floor; `TUTTI_MAX` 16 s is only a guard) that cuts to nothing as the pulse lands. A Crescendo cancel resolves it into the Crescendo's swell.
- **The Grand Silence set piece** (04 §4.1):
  - `MusicInputs.silence?: {on, notes}` comes from public state (the `m3Inputs` pattern, `sfx.ts:6005-6014`).
  - The crucible `targets` hook (`music.ts:591`) zeroes all four stems while `on`, then reopens them two notes per stem: 1-2 pad, 3-4 pulse, 5-6 melody, 7-8 choir. A change in notes forces an urgent re-level on the next beat (the `stolenHeard` pattern, `:466-470`).
  - **`hold()` is never reused**: it keeps pad and choir and caps at 12 s (`music.ts:362-376`). Because the rule lives in `targets`, a Fermata or Stasis `releaseHold` inside the silence can't reopen stems.
  - The engine gains a held bus mute, `holdBus(bus, depth)` / `releaseBus(bus)`. While a hold is active, `duck()` clamps to its depth (`engine.ts:209-267`), so a Perfect, Save or Fermata duck (`sfx.ts:1179, 1222, 1940`) can't reopen the silence. **Both new branches short-circuit first** (`if (this.busHolds === undefined)` in `duck()`; `if (this.silence?.on)` in `play()`), so the Reliquary, Spire and Rift offline snapshots keep their scheduling order byte for byte.
  - `play()` (`sfx.ts:639-652`) gets an allow-list while `silence.on`:
    - plays: the Perfect Ward, a clutch `chimeLanded`, a `save` with cause reel, a Rewind note, the eight rebuild notes, the Reignite leitmotifs, UI and reject feedback, and the heartbeat at −6 dB;
    - silent: enemies, ambience, Mend, Ward-cast and Thread sounds.
  - **The rebuild phrase:** note n plays scale degree n of D dorian (D4 E4 F4 G4 A4 B4 C5 **D5**) in the note's own timbre (Ward glass, Chime bell, Reel whoosh-pluck, Rewind reversed bell). It is pitched to the key, not to `chordAt()`, because the chord clock runs on in silence. The eighth resolves on D5.
  - **Reignite:** each party hero's leitmotif in canon (`theory.ts:196-239`; party heroes only, so `leitmotifFor`'s Kael fallback is never hit).
- **StingerKind `'finale'`** (`music.ts:117`): the run's last victory, every party leitmotif in canon, resolving on D.
- FINALE_SOUND_GROUPS, LIMITS and ATTACK_SOUNDS follow the Legion and Unstitched pattern (`sfx.ts:194-283`). Glass deaths are sized by the enemy. `stopCombat` releases every hold.

### UI (`src/ui`)

- **BossHud** (`store.ts:402-447`) gains `discord?: {value, max, rate}`, `fortissimo?: {pulse, of: 3}`, `silence?: {notes, of: 8, sources, left}` and `cue?: {soloist, solo, target?}` (target filled when the Solo begins).
  - HeroHud gains `stilled?: true`. CalloutKind gains `'note'`.
  - All of these are filled only from `field.finale` (`hudBridge.ts:810-864`).
- **BossBar** (`BossBar.tsx`, new `finaleLook.ts`):
  - a **Discord stave meter** under the HP bar: segmented 0-100 with ticks at 25/50/75, the number, a brass baton glyph, and the words 'Conductor's Discord 72/100 · Crescendo cancels Fortissimo Silence'. Blind Score hides only the half after '·' (`BossBar.tsx:206-212`). It is never colour alone;
  - a rise arrow and 'Fortissimo Silence in ~14 s' from the current rate;
  - in phase 3 it becomes the **silence stave**: 8 pips, each filled with its note's source glyph (Ward, Chime, Reel, Rewind), plus the countdown bar to the Coda;
  - CAST_ICON (`legionLook.ts:41-50`) gains baton and Fortissimo.
- **The silence on screen:**
  - a full-screen silence tint (copying the Stasis tint, `Hud.tsx:197-207`);
  - stilled party frames, greyed, with 'Stilled · waits for your song', an aria countdown (the HeldStrip pattern, `PartyFrames.tsx:553-570`) and a Solo ring that fills a segment per note, relit gold on reignite; a downed frame shows 'The song will bring them back' until the Coda;
  - the WeaverBar stays fully lit (she is the only one who can act); Directives grey with 'frozen'.
- **Callouts:** 'Note 3/8 · Perfect Ward' (also Clutch, Reel-save, Rewind), 'Note 8/8 · The song returns!', 'Fortissimo Silence — cancelled', 'The Coda — your heroes wake without the song'.
  - In the Finale, the defeat callout reads 'The Conductor's silence holds.' in place of 'The song falls silent…' (`runtime.ts:734`).
- **Sighting card** `crucibleLesson`, added to the `legionLesson ?? riftLesson` chain (`sighting.ts:35-177`). It is Calling- and variant-aware: a Chronomancer reads 'a Rewind that undoes a blow' for Reel-saves; an Anchor Weaver reads 'Perfects and Clutches'; a Swap Weaver reads 'Swap takes the blow on you'.
- **Hints:**
  - 'Every Solo you let through feeds the Conductor's Discord: answer it, or interrupt the soloist.'
  - 'Fortissimo Silence: hold 100 Resonance — your Crescendo cancels it.'
  - 'The Grand Silence: only your Perfect Wards, Clutch Chimes and Reel-saves are heard. Eight notes bring your heroes back — even the fallen.'
- **Recaps** `finaleDownLine` (`resultText.ts:80-135`):
  - Lament: 'Chime it away, or interrupt the Alto'.
  - Basso: 'Ward on the beat, or interrupt the Bass'.
  - Cadenza: 'Reel them out or step aside'.
  - Shatter Aria: 'Scatter so it catches one, and Ward the one it's on'.
  - Downbeat: 'Ward or dome the tank'.
  - Fortissimo Silence: 'Crescendo before Discord fills, or dome, Ward and heal'.
  - Measure/Final Cadence/Half Cadence: 'Only you can answer in the silence: Ward on the beat, or Reel them out'.
  - Every Finale down names an answer.
- **Map and route** (`routeText.ts`; the length-derived helpers land in W3):
  - BIOME_TONE `crucible`; BIOME_PLACE 'the Celestial Crucible'; CARD_LOOK with a gold-white eyebrow and the button 'Ascend';
  - ENCOUNTER_ICON gets a baton;
  - VICTORY `the_silent_conductor`: 'The Silent Conductor lowers its baton, and the song goes on.';
  - SPOILS `the_unweaver` (`interlude.ts:244-293`): 'The Unweaver falls' / 'The Unweaver's loom' / 'The Rift knits shut, and the sky above rings white-gold. Take something epic.';
  - BackdropTone `'crucible'`: the four spinning rings brighten and pulse (`Backdrop.tsx:58-80`), with text at WCAG AA.
- **Codex:** the Conductor's lore line; the choir under 'The Finale' (`CodexScreen.tsx:518-566`). `callingText.ts` (`tierWhen(i, run?)`), the Codex and the UiLab mock read the run's road rows when given a run.
- **Settings:** an additive `captions` (`.default(false)`, no version bump, `settings.ts:79-102`) captions key sounds: 'The music stops', 'Note 3 of 8 · Perfect Ward', 'Discord rises', 'The song returns'. The visual twins exist with captions off.

### Accessibility with audio off (none needs Flashes > 0)

| Audio fact | Visual twins |
|---|---|
| the music stops | silence vignette, grey light term, dark orrery, HUD tint, stave in place of the meter, stilled frames |
| a note sounds | numbered callout, stave pip with its source glyph, relit sky ring, rising mote, a frame Solo segment |
| which actions count | sighting card and hint; the existing Perfect rim and clutch glow |
| Reignite | frames relit gold, revived frames rising, gold flare, 'The song returns' callout |
| Discord rises | the numbered meter with its rate arrow, brass streak, '+25' floater |
| Fortissimo Silence comes | raid banner with pips, meter at 100, countdown |
| a Cue | boss cast bar naming soloist and Solo, baton line, soloist cast bar naming the target |

### Narrative beat and ending

- **The Crucible's Movement card:** 'Above the Rift the sky rings like a struck bell. Someone is conducting it.'
- **Arrival** (first Decree line, spoken): 'You have sung so long, little Weaver. Let them rest.'
- **Grand Silence:** 'Listen. This is what they deserve.' Then nothing but the heroes' hearts, until the first note.
- **Epilogue** (02:311: ≤ 20 s, always skippable, reduced-motion aware). It uses SceneView's line layout (`SceneScreen.tsx:28-40`) as a panel at the top of the Summary, shown once per victory, with no new RunPhase. About 3 s a line:
  1. *The baton falls. The Conductor's ribbons are a Weaver's, grey as ash.*
  2. Conductor: 'I wove the first of them. I only wanted the world to rest.'
  3. The first party hero's line: Kael 'We rest when the song is done. It isn't.' · Lyra 'You never asked if we were tired.' · Vexis 'An unfinished equation is still worth solving.' · Brann 'Rest? I've only just got loud.'
  4. The Weaver: 'A rest is part of the song. It isn't the end of it.'
  5. *Above the Crucible the rings turn, and the world sings on.*
- **Summary:** OUTCOME (Finale) 'The song goes on', the VICTORY line, and the first-clear card. The Grand Silence is the Conductor's argument; your song is the answer (02:310).

### Labs

- **VfxLab** 'Phase 5d · Finale' group:
  - FINALE_SCENARIOS: the Crucible gallery; a Cue and each Solo; Discord fed; Fortissimo Silence and its cancel; the Grand Silence 0 → 8 notes; Reignite with a revive; the Coda; glass deaths;
  - `__VFX__.finaleScenarios`, `finaleScenario` and `finaleStats`;
  - overrides never write into the sim.
- **UiLab** 'Finale' group:
  - a mock map with the road and the Unweaver flipped to interlude;
  - HUD states: Discord 25/75/100, Fortissimo pips, silence 0/4/8, stilled and downed frames;
  - the epilogue and the first-clear card.
- **AudioLab:** a Celestial Crucible row, a silence-notes slider, and a 'finale' sound group.

## Bots and harness

**Readers** (`src/bots/common.ts`; public state only; null without the mechanic): `discordOf(state)` (value and rate), `fortissimoLive(state)` (pulses and impacts), `cueOf(state)` (soloist, Solo, target once begun, impact), `silenceOf(state)`, `isStilled(hero)`, and `FINALE_BANK_AT = 60`.

**Skilled `FINALE_RULES`.** They sit beside M3_RULES (`skilled.ts:128-167`), and `SkilledOptions.skip` widens to `ReadonlySet<M3Rule | FinaleRule>`. Every rule is gated on its reader and draws no RNG. When `discordOf` is null, the old Cue and Crescendo paths run byte for byte.

| Rule | What it does |
|---|---|
| `cueFocus` | When a Cue or Solo is live and no Ward, Chime or Reel answer is ready, Focus the soloist. It has a crowd guard (≤ 4 standing; m3FocusTarget pattern, `:895-940`), ablated before it ships. The existing `cast?.interruptible` step (`:752`) reaches it first. |
| `bankCrescendo` | When Discord will reach 100 before Resonance would refill (from `discordOf().rate`), and Resonance would fall below 100: no damage Cues, and the generic Crescendo triggers (`:691-699`) hold. The Requiem-dome reserve (`:676-684`) yields. A guarding Cue (the dome) is allowed only if 100 remains after it. Its fight-length cost is measured per Calling and party in W9. |
| `crescendoCancel` | During Fortissimo Silence, Crescendo 0.3 s after pulse 1 begins, whatever the Calling. |
| `fortissimoGuard` | No Crescendo ready: Cue the dome (GUARDING, `:662-670`) before pulse 1, Ward the lowest in each pulse's window (wardWorthy; the 15% filter at `:346` lifted), Bear (Martyr) on the lowest, Rally into the dome, Mend between pulses. |
| `silenceWard` | In the silence, plan the one Ward a cycle: the Final Cadence when Reel won't be ready for it, else the Measure; Perfect window timing, lifting the 15% filter and the bigHitSoon reserve (`:316-324`). |
| `silenceChime` | The existing Dirge clutch (`:405-417`) gets priority; no early Chime on a Rest. |
| `silenceReel` | Reel the Final Cadence target 0.4-0.6 s before impact if it isn't Warded (never with Anchor; Swap only above 25% Weaver life). The Chronomancer Rewinds a hero who lost ≥ 30% to a silence blow in the last 3 s, or (Paradox) Rewinds the target of a live Final Cadence. |
| `silenceThread` | Mend, never Empower, while heroes are stilled (`:561-603`). |
| `reigniteCue` | After Reignite or the Coda, Cue every ready Solo, damage Solos first, Resonance allowing. |

The `holding` branch (`:303-310, :542`) reads Fermata's `hold`, not `stilled`, so it isn't hijacked.

**Novice `NOVICE_M4`** (beside NOVICE_M3, `novice.ts:63-78`). Each draws only while its mechanic is up, appended after the existing draws and before the Cue draw (`:316`):

- `fortissimoCrescendo` 0.35 a decision (about 3 decisions a second, so near-certain within the 3 s windup when Resonance ≥ 100);
- `cueFocus` 0.10;
- `silenceChime` 0.45 when a Rest has ≤ 1.2 s left (it replaces her early Dirge reflex, `:227-231`, only in the silence);
- `silenceWard` 0.5 on a Measure or Cadence target (untimed, so Perfects are luck);
- `silenceReel` 0.25 when a Cadence has ≤ 0.8 s left (she already Reels downed and pinned heroes, `:185-207`; never a hero out of a telegraph today);
- `reigniteCue` 0.5.

The Coda keeps her band reachable. **Idle** stays `[]` (`src/bots/index.ts:7-12`) and loses: Solos, the Final Cadence and Fortissimo Silence.

**Harness** (`tools/harness-core.ts`):

- `EncounterRun.finale?: FinaleTally` with `VERB_TALLY4_KEYS`, absent elsewhere. It records:
  - discordFed (boss / Solo);
  - fortissimoCast, cancelled (by Calling), survived, and downs within 4 s;
  - cues, cuesFailed (the Cue landed on a voice that couldn't sing, or a loss ended it; not a Cue the boss's own phase shift, its soloist's death or a win cleared), cuesInterrupted, cuesAnswered (by answer), solosBegun by voice;
  - silenceTime, notes by source, reignited / silenceBroken, revived, timeToReignite, damageWhileStilled.
- `VerbTally3` stays `fightMovement >= 3`, so Finale rows also carry `m3`. No baseline is affected.
- `movementEncounters(m)` (`:367-377`) narrows with `isFieldMovement` (a finale def lists only its boss). MAX_SECONDS 540 and MAX_PHASES 240 are re-checked against the Finale route.
- **Kit:** `ARRIVAL4_KIT` (`'arrival4'`) is ARRIVAL3 plus a floor of what Skilled winners hold at the Unweaver interlude on the Finale route, measured with `playRun onPhase`. `defaultKit(movement >= 4)` returns it (`kits.ts:87-91`). ARRIVAL and ARRIVAL3 are never edited.
- **Tools:**
  - `harness.ts`: `MOVEMENT_BANDS[4]`; `runBand(4)` 'won ÷ reached the Finale'; `finaleLine`; brannBand rows for movement 4.
  - `m1-baseline.ts`: `BASELINES[4]` / `DRIFTED[4]`.
  - `decrees.ts`: `BOSS_TABLES.the_silent_conductor`.
  - `verbs.ts`: FINALE_RULES, with the rule set following `--movement`; `--bot novice` ablates NOVICE_M4 (`NoviceOptions.skip`, absent by default).
  - `callings.ts --cells --movement 4`; the band label names the Conductor.
  - `brann-bands.ts`: `--movement 4`, `--runs --movements 4`; ExtraWatch gains Fortissimo damage, stilled time and Solos landed on Brann.
  - `pacing.ts`: 'Expedition: average X (band 30-40, stretch 38) · winning-run median Y · won III Z%' replaces the 'Finale budget' line (`:217-231`); labels replace ROMAN; IV/I XP per combat minute; the Finale's time comes from the played fight, per Calling and party.
  - `loadouts.ts`: SHORT and floor rows, and the whole-route viable-build report.
  - `relics.ts` hardFights and `astrolabe.ts` HARD_FIGHTS[4] narrow on a boss-only def.
  - `deeds.ts --movements`.
  - `sim-bench.ts`: `conductor-peak` (phase 2 with 3 voices, a Solo and Fortissimo Silence) and `grand-silence`; budget p95 ≤ 1.5 ms a tick; the legacy benches re-checked for the `isDisabled` scan.

## Bands

ARRIVAL4_KIT. 50 seeds a cell on 1000 / 500003 / 777001; whole runs 200 seeds on 2000 / 900007 / 333003; pacing on 9001 / 77003. 'Met' only on all three sets.

| Content | Idle | Novice | Skilled | Skilled share | Skilled length |
|---|---|---|---|---|---|
| The Silent Conductor | 0% | 15-40% | ≥ 80% | ≥ 30% | 170-230 s |
| Grand Silence | — | a hero standing at its end ≥ 50%; reignite by notes reported only (modelled ≈ 5%) | reignite by notes ≥ 85%; 8 notes in 24-40 s (Anchor ≤ 45 s) | — | — |
| Whole Finale-route Expedition | 0% | won 1-6%; won ÷ reached Finale 15-40% (pooled) | won ≥ 55%; reached Finale ≥ 65%; won ÷ reached Finale ≥ 80%; won III within 5 points of today's full road | — | — |
| Parties A, C at the Conductor | — | — | ≥ default − 5 | ≥ 30% | ≤ 280 s |
| Party B at the Conductor | 0% | ≥ 10% | ≥ default − 15 | ≥ 30% | — |
| Callings at the Conductor (Skilled) | — | — | ≥ 75% each: none, Luminary, Martyr, Chronomancer with and without Paradox | — | ≤ default + 40 s each |
| Five viable builds | — | — | ≥ 5 of 6 CHORD_PRESETS: whole Finale-route Expedition ≥ 50% (30 runs × 3 sets) and Conductor cell ≥ 80% | — | — |
| Movements I-III fights | **identical to the W0a baselines** | | | | |

- **Reach rates move this time.** The shorter road gives fewer drafts and relics before each boss (4.2 Movement I fights against 5.8 in the scratch harness). So reach-II, reach-III and reach-the-Finale are measured fresh.
  - If Skilled reach-the-Finale falls under 65%, or won III falls more than 5 points, the lever is the short road's own rewards (for example the Cantor interlude's draft rarity or a relic), never Movement I-III enemy numbers.
- **Five viable builds** (06:123).
  - Today's per-cell floors already miss on Movement II-III fights that can't be retuned under the byte-identical rule: Anchor's Vharun 80%; All In's Shield Wall, Blood Forge and Vharun; Bastion and Wide Choir on frayed_court at 82-84% (`loadouts50-m{2,3}.txt`).
  - So 'viable' is defined on whole runs plus the Conductor cell. Whole I-III runs today: 5 of 6 presets at ≥ 57% (`loadouts-runs-m3.txt`).
- **Decree gate** (`decrees.ts --boss the_silent_conductor`; counts **real casts**, the 5c Steal Verse lesson). Expected per Skilled fight: about 4 Cues in phase 1 (2 each for Alto and Bass) and about 4 in phase 2 (Tenor and Soprano first), minus waits for the boss's casts and Fortissimo:
  - Lament and Basso begun ≥ 2 times in ≥ 80% of Skilled fights; Cadenza and Shatter Aria begun ≥ 1 time in ≥ 85%; ≥ 7 Solos begun a fight on average;
  - each Solo answered (interrupted, killed, or not failed) ≥ 80%;
  - Fortissimo Silence cast in ≥ 90% of Skilled fights (needs phase 2 ≥ about 33 s), answered (cancelled by a Crescendo, or no hero down within 4 s of pulse 3) ≥ 80%;
  - the Grand Silence reignited by notes (not the Coda) ≥ 85%.
  - Accepted Idle exceptions: Solo answers, Fortissimo cancels and the Grand Silence are N/A for Idle (it never casts). Passive pressure keeps it at 0%.
- **Tuning order** (`docs/phase-5c.md:852-859`):
  1. ARRIVAL4 cells within ±20% of the authored numbers.
  2. A `verbs.ts` ablation bot-fix round.
  3. A Finale `scale` sweep (life 1.6-2.1, damage 0.95-1.15) on whole Finale-route Expeditions.
  4. Par = Skilled mean × 1.15.
  5. `rewards.xp`, so XP per combat minute in the Finale is within ±15% of Movement I.
- **Levers, in order:**
  - the Fortissimo pulse (0.4-0.6);
  - the phase-2 Discord floor (60-80) and rate (0.8-1.2/s), the phase-1 rate (0.3-0.8/s) and the Solo's +15-25;
  - the Cue cadence (12-16 / 9-13 s);
  - choir life;
  - the silence cycle (8-10 s), the cap (45-55 s), and the Final/Half Cadence (1.0-1.2 / 0.5-0.7; the Final ≥ 1.0, so a Reel-save is always possible from full);
  - the Coda's revive (none, or the downed at 15%);
  - the Grand Silence threshold (0.2-0.3).
- **Weaver, hero, aura and Movement I-III numbers never move.**

## Pacing (the Phase 5 exit: a full run takes 30-40 minutes)

Scratch model `pace5d.ts` uses `tools/pacing.ts`'s player model (Skilled, about 41-46 Expeditions a base, so ±1 min of model noise). The Finale is modelled for every run that wins Movement III: Unweaver interlude 41 s + fight + result 12 s + epilogue 15 s.

| Road | 9001: avg / winning median / won III | 77003: avg / winning median / won III |
|---|---|---|
| today's 10 + 7, Finale 240 s | 45.6 / 49.5 / — | 42.8 / 50.4 / — |
| s6e Movement I only, 240 s | 41.0 / 46.7 / 81% | 40.7 / 46.4 / 84% |
| **s6e + Movement II 6 rows, 210 s (chosen)** | **37.2 / 45.0 / 70%** | **38.7 / 44.8 / 81%** |
| s5 + Movement II 6 rows, 210 s | 39.7 / 43.3 / 85% | 39.0 / 43.3 / — |
| s5nb + Movement II 6 rows, 210 s | 38.3 / 43.1 / 82% | 38.5 / 43.4 / — |

- The current tool reads I-III at 17.6 + 12.6 + 10.8 = 41.0 (scratch `pace6.txt`), matching 5c's 40.9.
- **Both numbers are headlines.** The losses-included average passes; the winning-run median doesn't, and part of the average's drop is earlier losses (9001's won III 81% → 70%). Question 2 asks which is the criterion.
- **Targets (default of question 2):**
  - the average Skilled Expedition ≤ 40 on both bases, stretch ≤ 38;
  - won III on the Finale route within 5 points of today's full road (200 seeds × 3 sets), or the road-reward lever applies;
  - the Finale 3.5-5.0 modelled minutes per reaching run, measured per Calling and party (`bankCrescendo` may lengthen phases 1-2; the model's 210 s is replaced by the played fight's length);
  - the winning-run median printed beside it, soft ≤ 45;
  - XP per combat minute IV/I within ±15%;
  - `ROUTE_MINUTES.expedition` set from the measured average.
- **If 9001 lands over 40:** the Conductor's life (the burn), the silence cap 50 → 45 s, then the s5 road.
- **Presentation stays off the critical path.** The epilogue is skippable and sits inside the Summary's `AFTER_RUN` 45 s.

## Tune prep: the ablation round and where the Finale stands (m4/tune, 2026-11-07)

Measured on main's Finale (65b6290) plus this step's bot-tool changes, before any Finale number is tuned. Every cell plays the Silent Conductor on ARRIVAL4_KIT, 24 seeds from base 1000 (seed `1000 + i × 7919`), unless it says otherwise. 24 seeds give about ±10 points of noise on a win rate, so a row only counts as a finding when the mechanism behind it shows up too.

### Carry-over items

- **Already fixed on main**, each with a test, and checked again here:
  - the Cue-turned-Raise cast twice (`raiseInFlight`);
  - Fortissimo Silence beginning on a Cue's landing tick (`beginFortissimo` waits on `f.cue`);
  - range 44 on every scripted Finale attack (the content test 'every scripted Finale attack spans the Crucible');
  - Calling rows that must rise (the road lint);
  - the voices' Codex shares (55% and 110%, as elites);
  - the harness's `cuesFailed` (01c701c);
  - render's Discord streaks (`discordRose.failed`, and the linked Weaver);
  - the tutti's `TUTTI_MAX`;
  - the Coda bar's cap (taken from `silenceBegan`, so Stasis can't shrink it);
  - the choir-cap and `internal.m4` key wording in this doc;
  - the colour table and the Audio progression.
- **Doc mismatch fixed here:** Principle 3 and the Fortissimo, silence-program and Audio rows said every windup multiplier lengthens. Short Fuse shortens, and `FINALE_MIN_WINDUP` (1.0 s) is the floor.
- **The Decree smoke guard** (`tests/bots.test.ts`, 'each Conductor Decree is answered ≥ 80% over 12 seeds') runs again: `TUNED_SILENCE` is gone. Over its 12 seeds the Skilled bot reignites by notes in **6 of 6** silences it reaches (100%; 12 of 12 over 24 seeds). Every Solo and Fortissimo Silence clears 80%; the lowest is Cadenza at 87%.
- **Directives in the silence:** the sim's `applyDirective` still takes one (only the input layer freezes the wheel). Neither bot sends one while the silence holds, and a new test pins that, so bot measurements play the silence by the player's rules. A sim-side refusal stays a design choice, not made here.
- **Left for the hand-off, not defects:**
  - the four Finale goldens, `m4-baseline` / `expedition4-baseline`, `commandSnapshotFinale` and `finaleHandoff` (they pin tuned numbers);
  - `ROUTE_MINUTES.expedition` (from the measured pacing);
  - `docs/phase-5d/{vfx-audio.md, ui.md}`.
- **Not run here:** `e2e/smoke.spec.ts` (this machine has no Playwright browser).
- **Left as they are:**
  - A Dissonance gate opened mid-run by an XP award shows on the Rank-15 card, not in the Summary's Dissonance panel. The first-clear card reads the store, so it is right.
  - Fortissimo pulses split to a Weaver in an Aegis Link, as every raid does (unchanged outside the silence).
  - `Telegraph.sole` circles drawn at 2.5 m.

### `tools/verbs.ts` ablation, Skilled `FINALE_RULES` (win points / length / downs a fight, with the rule off against every rule on)

| Rule left off | default | A | B | C | Luminary | Martyr | Chrono | Chrono+Paradox |
|---|---|---|---|---|---|---|---|---|
| every rule on (win · length · downs) | 50% · 265 s · 2.96 | 63% · 303 s · 5.04 | 63% · 229 s · 6.25 | 29% · 363 s · 6.46 | 50% · 252 s · 3.33 | 54% · 297 s · 3.21 | 96% · 302 s · 0.83 | 100% · 293 s · 0.79 |
| −`cueFocus` | -25 / -29 s / +1.12 | +0 / +25 s / +1.38 | -21 / -33 s / +1.42 | +13 / -36 s / -0.88 | +4 / +13 s / +0.54 | +13 / -21 s / -0.58 | -4 / -14 s / +0.33 | -17 / -22 s / +0.63 |
| −`cueFocusCrowd` | -4 / +5 s / +0.21 | +13 / +17 s / -0.42 | +8 / +14 s / -0.29 | +13 / +26 s / +0.71 | -4 / -15 s / +0.04 | -4 / -22 s / +0.13 | +0 / +2 s / +0.21 | +0 / +9 s / +0.04 |
| −`bankCrescendo` | -17 / -53 s / -0.04 | -4 / -33 s / +0.75 | -4 / -23 s / -0.63 | +8 / -40 s / +1.08 | -4 / -59 s / -0.33 | -12 / -46 s / -0.25 | -4 / -33 s / +0.13 | -8 / -21 s / +0.50 |
| −`crescendoCancel` | -21 / -22 s / +0.96 | +8 / +27 s / +1.54 | -21 / -30 s / -0.21 | +4 / +2 s / +0.33 | +0 / +10 s / +0.13 | -17 / +8 s / +0.50 | -8 / -10 s / +0.33 | -4 / +10 s / -0.04 |
| −`fortissimoGuard` | +0 / -0 s / -0.04 | -4 / +2 s / +0.04 | -4 / -7 s / +0.00 | +4 / +1 s / -0.21 | +0 / -0 s / +0.00 | +8 / +13 s / -0.25 | +0 / -1 s / +0.00 | +0 / -0 s / -0.04 |
| −`silenceWard` | +0 / +4 s / +0.21 | +0 / +5 s / +0.13 | +0 / +5 s / +0.00 | +0 / +3 s / +0.00 | +0 / +6 s / +0.42 | +0 / +5 s / +0.04 | +0 / +5 s / +0.54 | +0 / +6 s / +0.17 |
| −`silenceChime` | +0 / +8 s / +0.08 | +0 / +11 s / +0.33 | +0 / +8 s / +0.08 | +0 / +5 s / +0.13 | +0 / +7 s / +0.04 | +0 / +8 s / +0.13 | +0 / +13 s / +0.13 | +0 / +13 s / +0.00 |
| −`silenceReel` | +0 / +3 s / +0.00 | +0 / +4 s / +0.08 | +0 / +4 s / +0.08 | +0 / +2 s / +0.00 | +0 / +3 s / +0.00 | +0 / +3 s / -0.04 | +0 / +1 s / +0.00 | +0 / +4 s / +0.04 |
| −`silenceThread` | +0 / +0 s / +0.00 | +0 / +0 s / +0.00 | +0 / -0 s / +0.00 | +0 / +0 s / +0.00 | +0 / +0 s / +0.00 | +0 / +0 s / +0.00 | +0 / -0 s / +0.00 | +0 / +0 s / +0.00 |
| −`reigniteCue` | +0 / +0 s / +0.00 | +0 / +2 s / +0.08 | +0 / +0 s / +0.00 | +0 / +1 s / +0.08 | +0 / +0 s / +0.00 | +0 / +0 s / +0.00 | +0 / -0 s / +0.00 | +0 / +0 s / -0.04 |

Chrono is the Chronomancer on path `0001` (Eternal Moment), Chrono+Paradox on `0000`; Luminary and Martyr play their first path.

The rows that moved by more than the noise were played again at 50 seeds on bases 500003 and 777001:

| Rule left off (50 seeds) | default | A | B | C | Martyr |
|---|---|---|---|---|---|
| −`cueFocusCrowd` | +2 / +2 | +6 / +0 | -2 / +6 | +2 / +2 | — |
| −`crescendoCancel` | +16 / -6 | +0 / -8 | -16 / +8 | +8 / +12 | +6 / -4 |
| −`fortissimoGuard` | +2 / -6 | -2 / +2 | +0 / +0 | +10 / +6 | -2 / -4 |
| −`cueFocus` | — | — | — | — | +0 / +10 |

(Win points on 500003 / 777001.) Only one row keeps its sign across all three sets: party C is better without `crescendoCancel` (+4, +8, +12). No mechanism was found for it, so it is a lead for the tuning step, not a fix.

**No `FINALE_RULES` rule is plainly broken. Nothing in the Skilled bot changes.** By rule:

- **The silence rules are flawless, not mistimed.** In 24 `setBossHp 0.26` silences the default Skilled bot casts 96 Wards, 72 Chimes and 24 Reels, and each one is a note (96 Perfects, 72 clutches, 24 Reel-saves). No hero takes a silence blow. It is the same in every party and Calling: Chronomancer Rewinds are notes, and an Anchor Weaver makes 4 Perfects and 4 clutches.
  - `silenceThread` is never needed: nobody is hurt.
  - `reigniteCue` changes nothing because the plain Cue loop already Cues every ready Solo in the burn (96 Cues against 72, with the same burn length of 22.7 s).
- **`crescendoCancel` loses no Resonance.** No Resonance is spent at Discord ≥ 60 outside Fortissimo Silence (`bankCrescendo` holds every Cue and Crescendo).
  - Of 60 Fortissimo Silences in the default cell, 41 begin at 100 Resonance, 13 short of it and 6 with the Weaver down; 52 are cancelled.
  - Each one played out was one where the Crescendo couldn't go: Resonance short, or the Weaver downed (one at 100 Resonance, downed just before pulse 1).
  - Left off, the generic raid trigger still cancels about 0.2 s later. What the rule adds is holding the Cues that would spend the song.
- **No Reel pulls a hero back into a circle.** Of 328 Reels over 24 default fights, 41 targets were hit within 2.5 s by a telegraph not aimed at them, all but 8 by the Sforzando's 22 m line. The Reel lands them outside the line; the hero then walks back into it on its own.
- **`cueFocusCrowd` stays.** The 24-seed rows (+13 for A and C) don't hold at 50 seeds (−2 to +6).

### The Novice's `NOVICE_M4` (`tools/verbs.ts --bot novice`, new: `NoviceOptions.skip`)

| Rule left off | default | A | B | C |
|---|---|---|---|---|
| every rule on (win · length · downs) | 0% · 94 s · 4.79 | 0% · 84 s · 5.42 | 0% · 103 s · 6.33 | 0% · 105 s · 5.46 |
| −`fortissimoCrescendo` | +0 / +0 s / -0.04 | +0 / -6 s / -0.42 | not met | +0 / -2 s / +0.00 |
| −`cueFocus` | +13 / +17 s / -0.21 | +0 / +2 s / -1.04 | +0 / -16 s / -1.46 | +0 / -22 s / -1.08 |
| −`silenceChime`, `silenceWard`, `silenceReel`, `reigniteCue` | not met | not met | not met | not met |

- The Novice never reaches the silence: she loses in phase 1, at about 75% boss life. Of her 115 downs over 24 fights, 50 come from a phase-1 Fortissimo Silence (she feeds Discord 100 by about 88 s and has no song to cancel it), 26 from the Downbeat and 11 from Basso Ostinato.
- `cueFocus` costs her about one more down a fight in every party. That held at 50 seeds: +0.5 and +1.2 downs, and 0-2 win points. Each decision with a Cue live, she has a 10% chance to send the party to the soloist, however late. That is a lever (0.10), not a broken rule.
- Her silence draws, measured through `setBossHp 0.26`, are in the table below.

### Current Finale measurements (24 seeds)

**The Silent Conductor**, played from its start:

| Bot · party · Calling | won | length (won) | downs | share | boss life at a loss | Solos (answered) | Fortissimo (cancelled) | silence reached | reignited | to 8 notes | notes P / C / R / Rw |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Idle · default | 0% | 35 s | 3.00 | 18% | 93% | 2.1 (33%) | 0 | 0/24 | — | — | — |
| Novice · default | 0% | 94 s | 4.79 | 41% | 75% | 5.5 (86%) | 0.9 (5%) | 0/24 | — | — | — |
| Novice · A | 0% | 84 s | 5.42 | 39% | 81% | 5.0 (74%) | 1.0 (9%) | 0/24 | — | — | — |
| Novice · B | 0% | 103 s | 6.33 | 35% | 68% | 6.5 (85%) | 1.1 (0%) | 0/24 | — | — | — |
| Novice · C | 0% | 105 s | 5.46 | 43% | 78% | 6.6 (87%) | 1.1 (8%) | 0/24 | — | — | — |
| Skilled · default | 50% | 265 s (339) | 2.96 | 50% | 55% | 16.6 (96%) | 2.5 (87%) | 12/24 | 12/12 | 26.0 s | 3.6 / 3.0 / 1.4 / 0 |
| Skilled · A | 62% | 303 s (376) | 5.04 | 47% | 59% | 18.7 (91%) | 2.9 (87%) | 15/24 | 15/15 | 23.0 s | 3.7 / 3.0 / 1.3 / 0 |
| Skilled · B | 62% | 229 s (281) | 6.25 | 46% | 52% | 14.2 (94%) | 1.9 (87%) | 15/24 | 15/15 | 23.0 s | 3.9 / 2.9 / 1.3 / 0 |
| Skilled · C | 29% | 363 s (460) | 6.46 | 52% | 44% | 24.9 (93%) | 3.9 (72%) | 8/24 | 8/8 | 23.0 s | 3.8 / 3.0 / 1.2 / 0 |
| Skilled · Luminary | 50% | 252 s (282) | 3.33 | 53% | 45% | 15.8 (96%) | 2.0 (81%) | 12/24 | 12/12 | 23.0 s | 3.8 / 3.2 / 1.1 / 0 |
| Skilled · Martyr | 54% | 297 s (350) | 3.21 | 49% | 51% | 19.3 (96%) | 2.5 (93%) | 14/24 | 13/14 | 23.0 s | 3.9 / 2.9 / 1.0 / 0 |
| Skilled · Chronomancer | 96% | 302 s (310) | 0.83 | 52% | 72% | 17.0 (97%) | 2.2 (98%) | 23/24 | 23/23 | 26.0 s | 3.8 / 2.9 / 0 / 1.3 |
| Skilled · Chronomancer + Paradox | 100% | 293 s (293) | 0.79 | 51% | — | 16.9 (98%) | 2.0 (94%) | 24/24 | 24/24 | 23.0 s | 4.1 / 2.9 / 0 / 1.0 |
| Skilled · Anchor | 58% | 298 s (369) | 2.54 | 51% | 49% | 18.5 (96%) | 2.8 (78%) | 14/24 | 14/14 | 29.7 s | 4.1 / 3.9 / 0 / 0 |

(Notes: Perfect / clutch / Reel-save / Rewind, a silence. The Martyr's one silence not reignited ended in a wipe.)

**The Decree gate** (`tools/decrees.ts --boss the_silent_conductor --seeds 24`):

| | Lament | Basso Ostinato | Cadenza | Shatter Aria | Fortissimo Silence | Grand Silence (reignited) |
|---|---|---|---|---|---|---|
| Skilled, answered | 98% of 144 | 96% of 111 | 90% of 61 | 96% of 82 | 88% of 59 | 100% of 12 |
| Skilled, cast gate | ≥2 in 100% | ≥2 in 96% | ≥1 in 83% (band 85) | ≥1 in 88% | ≥1 in 96% | — |
| Novice, answered | 100% of 71 | 69% of 59 | 1 cast | 1 cast | 5% of 22 | none reached |

Idle is N/A, as the band allows. Skilled begins 16.6 Solos a fight (band ≥ 7) and the Novice 5.5.

**The Grand Silence**, played into by `setBossHp 0.26`:

| Bot · party · Calling | reignited by notes | Coda | median to 8 notes | notes P / C / R / Rw | won the fight |
|---|---|---|---|---|---|
| Idle | 0/24 | 24/24 | — | 0 | 0% |
| Novice · default / A / B / C | 19 / 20 / 22 / 23 of 24 | 5 / 4 / 2 / 1 | 44.0 s | about 2.6 / 4.2 / 1.0 / 0 | 100% / 100% / 96% / 100% |
| Skilled · default, A, B, C, Luminary, Martyr | 24/24 each | 0 | 23.0 s | 4.0 / 3.0 / 1.0 / 0 | 100% |
| Skilled · Chronomancer, with or without Paradox | 24/24 | 0 | 23.0 s | 4.0 / 3.0 / 0 / 1.0 | 100% |
| Skilled · Anchor | 24/24 | 0 | 29.6 s | 4.0 / 4.0 / 0 / 0 | 100% |

### What the tuning step starts from

- **Skilled at the Conductor:**
  - Skilled wins 50% (band ≥ 80%), and its winning fights run 280-460 s (band 170-230).
  - Losses come in phase 2, at about 55% boss life. Downs there are mostly the Downbeat (19), Fortissimo Silence (16), the Sforzando (8) and the Cadenza (7).
  - The Weaver herself is downed 32 times in 24 fights, mostly by the Alto's and Soprano's bolts (range 10) and the Downbeat. A downed Weaver can't cancel Fortissimo Silence or Ward, so this is the first lever to look at. It falls under choir and Conductor content, not the Weaver's numbers.
  - `bankCrescendo` costs 20-60 s a fight in every party and Calling. Its levers are `FINALE_BANK_AT` 60 and `FINALE_RESONANCE_RATE` 2: with phase 2's floor of 70, it holds every damage Cue through phase 2.
- **The Grand Silence is far too forgiving.** Skilled plays it flawlessly in 23-30 s with no harm. The Novice reignites by notes in 79-96% of the silences she is put into, against the modelled 5% and a band that only asks a hero to stand. The silence levers (cycle, cap, Final and Half Cadence) are the place to start.
- **The Novice** loses every fight in phase 1 (band 15-40%), to a phase-1 Fortissimo Silence fed by her failures. The levers are Discord's +8/+20, the phase-1 rate and the pulse.
- **Party C** (Kael, Lyra, Brann) is the weakest: 29%, 363 s, and 72% of its Fortissimo Silences cancelled.

## Tuning (m4/tune, 2026-11-07)

The Finale and the Finale route, tuned to the bands on ARRIVAL4_KIT. Cells are 50 seeds a set on 1000 / 500003 / 777001 (seed base + i × 7919), whole Expeditions 200 seeds a set on 2000 / 900007 / 333003 (+ i × 104729), pacing `tools/pacing.ts --route expedition --players 16 --hours 3 --bot skilled` on 9001 / 77003. A first pass was interrupted by a container restart; its numbers were reviewed, kept where the measurements below bear them out, and everything here is re-measured on the final content. No Weaver, hero, aura or Movement I-III number moves, and no bot rule changes (none was plainly broken for a Finale beat; see the ablation round above).

### What changed (file · key · old → new · why)

| File | Key | Old → new | Why |
|---|---|---|---|
| `src/content/crucible.ts` | Conductor `hp` | 60,000 → 40,000 | The Conductor's own life: Skilled won 50% at 265 s (339 s won). 45,000 put the cell at 191 s; 40,000 at 174 s (band 170-230) and takes about 20 s off the played Finale in the pacing model. |
| | `DOWNBEAT_DAMAGE` | 820 → 600 | The Downbeat downed the Weaver and the tank most in phase 2 (19 downs, 6 Weaver downs in 24 fights). |
| | `SFORZANDO_DAMAGE` | 560 → 320 | ×1.05 it is 336, under the Weaver's 360, so a beam on her is never a one-shot. |
| | `DISCORD_BOSS` | 8 → 5 | A failed Conductor blow feeds less; the Novice's phase-1 Fortissimo Silence came at about 88 s from her failures. |
| | `DISCORD_SOLO` | 20 → 25 | The Solo's lever (+15-25): failures are the Novice's, so it lowers her cell where it ran high (40% on 500003 at +20) and steadies party B's (8% on 777001 at +20, 10-16% at +25); Skilled answers 98% of Solos and is unmoved. |
| | `DISCORD_RATE.overture` | 0.5 → 0.3 /s | The phase-1 rate (0.3-0.8): a clean Overture no longer meets Fortissimo Silence before phase 2. |
| | `FORTISSIMO_PCT` | 0.5 → 0.4 | The pulse (0.4-0.6): 120% over three pulses, so the dome alone saves every hero (the survival table). |
| | `CUE_EVERY.overture` | 14 → 12 s | The Cue cadence (12-16): with the shorter Overture, Lament and Basso still sing twice (the Decree gate). |
| | `RAISE_EVERY` | 20 → 30 s | Fewer voices at once in phase 2; the Alto's and Soprano's bolts were the Weaver's main killer (17 of 32 Weaver downs). |
| | `SILENCE_STEPS.nextCycle` | 1 → 2 s | The silence cycle 9 → 10 s (8-10): the notes come a little slower and every Final Cadence is 20 s apart. |
| | `SILENCE_CYCLE`, `CADENCE_EVERY` | 9 → 10, 18 → 20 | The Rest's, Measure's and Cadences' cooldowns (data only; the script schedules from impacts) follow the cycle. |
| | voices `hp` | 2,000 each → Alto, Tenor, Soprano 1,200; Bass 1,800 | Choir life: the choir fell too slowly for Focus to save the Weaver from it; the Bass keeps more, as Basso Ostinato is the Perfect lesson. |
| | Alto, Soprano bolt | 60 → 45 | The ranged voices' chip on the Weaver (see `RAISE_EVERY`). |
| `src/sim/systems/bosses.ts` | the Conductor's PHASES Grand Silence `at` | 0.25 → 0.3 | The threshold (0.2-0.3): the burn after Reignite deals about 2.7× phase 1-2's damage a second, so more of the fight is spent there. Guarded: the Conductor's own row. |
| `src/content/crucibleIds.ts` | `SILENCE_CAP` | 50 s (unchanged) | Tried at 45 s (a pacing lever): the Skilled silence ends at 25 s, so the clock doesn't move, and the Novice's cells didn't move either (her silences end in a won burn either way). Left at 50. |
| `src/content/crucibleRun.ts` | `PAR` | 225 → 200 s | The Skilled mean, 174 s over the three cell sets, × 1.15, to 5 s. |
| | `FINALE.rewards.xp` | 1.5 → 1.35 | XP per combat minute IV/I was 1.17 / 1.20 (band ±15%); now 1.06 / 1.08. |
| | Movement I's road | s6e (6 rows) → s5 (5 rows): First Light; sk/elite/sk; Bellwarden; respite/merchant/forge; Cantor. `fixed` rows 0/2/4, `threat [0,3,7,8,9]`, `callingRows [0,1,2,4]` | The pacing fallback ('then the s5 road'): s6e measured 41.4 / 40.5 min average and a 44.6 / 45.0 winning median. s5 takes about a minute off every winning run (median 43.3 / 43.8). It drops Movement I's only event row on this route. |
| | Movement I's road `rewards` (new) | none → rows 0 and 1: each skirmish pays a rare motif and a 2-relic offer | The road's own rewards (the *Bands* lever): without them Skilled reach-the-Finale fell to 63% on 2000 (full road won III 73%). With row 0 alone it was 69 / 67 / 66% (pooled −4.0 points, at the band's edge); rows 0 and 1 give 75 / 72 / 74%. |
| `src/content/schema.ts`, `src/meta/run.ts` | `RoadVariant.rewards`, `roadReward` | new | The road rewards' schema (one entry a row, each on a row with a skirmish; content lint) and their reward preview. Only road rows carry them, so the Prelude's and the I-II and I-III routes' maps are byte-identical (expedition2Pin, expedition3Pin). |
| `tools/sim-bench.ts` | `conductor-peak` | `setBossHp 0.55` at once → `0.59` once the Overture's two voices stand | With the faster choir the old start never stood four voices; now the peak has the choir at four, a Solo and Fortissimo Silence. p95 0.046 ms a tick (budget 1.5). |
| `src/ui/lab/mock.ts` | the Fortissimo Decree mock | '150%' → '120%' | Follows `FORTISSIMO_PCT`. |

Considered and not moved: the phase-2 Discord floor (70) and rate (1.0/s), so Fortissimo Silence still comes in every Skilled fight (100% cast, 1.0 a fight); the Coda's revive (none): the Novice's silences end in a won burn; the Finale `scale` (life 1.85, damage 1.05): the Conductor's own life did the work, and the Skilled won ÷ reached the Finale is 94-99% in every party; the Grand Silence's Final and Half Cadence; Movements II and III of the road.

### The Silent Conductor (cells, 50 seeds × 3 sets)

| Bot · party · Calling | won (1000 / 500003 / 777001) | length s (won) | share | downs | Solos (answered) | Fortissimo a fight (cancelled) | silence reached → reignited | to 8 notes |
|---|---|---|---|---|---|---|---|---|
| Idle · default | 0 / 0 / 0% | 29 (0) | 20% | 3.00 | 2.1 (12%) | 0.00 (0%) | 0/150 → 0 | - s |
| Novice · default | 22 / 30 / 26% | 147 (230) | 42% | 4.11 | 9.1 (87%) | 1.19 (1%) | 39/150 → 19 | 43.2 s |
| Novice · A | 12 / 10 / 6% | 133 (264) | 40% | 4.62 | 8.7 (80%) | 1.21 (2%) | 14/150 → 5 | 42.9 s |
| Novice · B | 14 / 16 / 10% | 113 (193) | 37% | 4.75 | 7.3 (84%) | 1.03 (2%) | 20/150 → 12 | 43.1 s |
| Novice · C | 22 / 8 / 16% | 148 (263) | 44% | 4.66 | 9.9 (85%) | 1.33 (1%) | 23/150 → 13 | 42.7 s |
| Skilled · default | 100 / 98 / 96% | 174 (175) | 50% | 0.29 | 8.6 (98%) | 1.03 (98%) | 147/150 → 147 | 25.0 s |
| Skilled · A | 94 / 98 / 96% | 200 (205) | 46% | 0.52 | 10.2 (96%) | 1.05 (91%) | 144/150 → 144 | 25.0 s |
| Skilled · B | 92 / 96 / 94% | 148 (151) | 47% | 0.90 | 7.2 (97%) | 1.00 (95%) | 141/150 → 141 | 25.0 s |
| Skilled · C | 98 / 98 / 98% | 206 (209) | 54% | 0.34 | 11.0 (97%) | 1.10 (95%) | 147/150 → 147 | 25.0 s |
| Skilled · Luminary | 98 / 98 / 100% | 152 (152) | 54% | 0.21 | 7.2 (99%) | 1.01 (99%) | 148/150 → 148 | 25.0 s |
| Skilled · Martyr | 100 / 100 / 100% | 176 (176) | 50% | 0.12 | 8.7 (99%) | 1.02 (99%) | 150/150 → 150 | 25.0 s |
| Skilled · Chronomancer (0001) | 100 / 100 / 100% | 157 (157) | 52% | 0.06 | 7.0 (98%) | 1.00 (100%) | 150/150 → 150 | 25.1 s |
| Skilled · Chronomancer + Paradox (0000) | 100 / 100 / 100% | 158 (158) | 51% | 0.07 | 7.2 (99%) | 1.01 (100%) | 150/150 → 150 | 25.0 s |
| Skilled · Anchor | 96 / 100 / 98% | 174 (176) | 52% | 0.13 | 8.1 (99%) | 1.01 (94%) | 147/150 → 147 | 32.7 s |

Downs a fight on the default Skilled cell (50 seeds from 1000): 0.28; the Weaver is downed 0.30 times a fight (was 1.33), mostly by the Downbeat. Novice losses come in phase 2, at about half the boss's life.

### The Decree gate (`decrees.ts --boss the_silent_conductor --seeds 50`, real casts; 1000 / 500003 / 777001)

| Skilled | Lament | Basso Ostinato | Cadenza | Shatter Aria | Fortissimo Silence | Grand Silence |
|---|---|---|---|---|---|---|
| begun a fight | 2.2 / 2.2 / 2.2 | 2.4 / 2.3 / 2.3 | 1.7 / 1.8 / 1.7 | 2.3 / 2.4 / 2.4 | 1.0 / 1.1 / 1.0 | — |
| cast gate | ≥2 in 84 / 92 / 88% (band 80) | ≥2 in 94 / 86 / 90% (80) | ≥1 in 98 / 96 / 98% (85) | ≥1 in 100% (85) | ≥1 in 100% (90) | — |
| answered | 100 / 99 / 99% | 100% | 93 / 93 / 96% | 100 / 99 / 98% | 100% | reignited by notes 100% (50 / 49 / 48 of the silences reached) |

Skilled begins 8.6 / 8.7 / 8.6 Solos a fight (band ≥ 7). The Novice answers Lament 92-95%, Basso 78-90%, and cancels or survives Fortissimo Silence in 21-29% of 55 a set; Idle is N/A, as the band allows.

### The Grand Silence (played into by `setBossHp 0.31`, 50 seeds × 3 sets)

| Bot · party · Calling | reignited by notes (of 50, per set) | Coda | median to 8 notes | notes P / C / R / Rw | a hero standing at its end | won |
|---|---|---|---|---|---|---|
| Idle · default | 0 / 0 / 0 | 50 / 50 / 50 | - | 0.0 / 0.0 / 0.0 / 0.0 | 0% | 0% |
| Novice · default | 25 / 27 / 20 | 25 / 23 / 30 | 43.0 s | 2.6 / 3.9 / 0.7 / 0.0 | 100% | 100% |
| Novice · A | 26 / 32 / 18 | 24 / 18 / 32 | 42.9 s | 2.7 / 3.9 / 0.8 / 0.0 | 100% | 100% |
| Novice · B | 21 / 23 / 18 | 29 / 27 / 32 | 43.0 s | 2.6 / 3.9 / 0.6 / 0.0 | 100% | 100% |
| Novice · C | 22 / 27 / 24 | 28 / 23 / 26 | 43.0 s | 2.5 / 3.8 / 0.9 / 0.0 | 100% | 100% |
| Skilled · default | 50 / 50 / 50 | 0 / 0 / 0 | 25.0 s | 4.0 / 3.0 / 1.0 / 0.0 | 100% | 100% |
| Skilled · A | 50 / 50 / 50 | 0 / 0 / 0 | 25.0 s | 4.0 / 3.0 / 1.0 / 0.0 | 100% | 100% |
| Skilled · B | 50 / 50 / 50 | 0 / 0 / 0 | 25.0 s | 4.0 / 3.0 / 1.0 / 0.0 | 100% | 100% |
| Skilled · C | 50 / 50 / 50 | 0 / 0 / 0 | 25.0 s | 4.0 / 3.0 / 1.0 / 0.0 | 100% | 100% |
| Skilled · Luminary | 50 / 50 / 50 | 0 / 0 / 0 | 25.0 s | 4.0 / 3.0 / 1.0 / 0.0 | 100% | 100% |
| Skilled · Martyr | 50 / 50 / 50 | 0 / 0 / 0 | 25.0 s | 4.0 / 3.0 / 1.0 / 0.0 | 100% | 100% |
| Skilled · Chronomancer (0001) | 50 / 50 / 50 | 0 / 0 / 0 | 25.1 s | 4.0 / 3.0 / 0.0 / 1.0 | 100% | 100% |
| Skilled · Chronomancer + Paradox (0000) | 50 / 50 / 50 | 0 / 0 / 0 | 25.0 s | 4.0 / 3.0 / 0.0 / 1.0 | 100% | 100% |
| Skilled · Anchor | 50 / 50 / 50 | 0 / 0 / 0 | 32.7 s | 4.0 / 4.0 / 0.0 / 0.0 | 100% | 100% |

### Whole Finale-route Expeditions (200 seeds × 3 sets)

| Party · bot | won (2000 / 900007 / 333003) | reached the Finale (= won III) | won ÷ reached the Finale | Aether left (earned) |
|---|---|---|---|---|
| default · idle | 0 / 0 / 0% | 0 / 0 / 0% | - / - / - (pooled 0/0) | 3 (3) |
| default · novice | 3 / 3 / 5% | 8 / 4 / 7% | 33% / 71% / 64% (pooled 19/36 = 53%) | 152 (206) |
| default · skilled | 72 / 69 / 74% | 75 / 72 / 74% | 97% / 96% / 99% (pooled 428/440 = 97%) | 507 (720) |
| A · idle | 0 / 0 / 0% | 0 / 0 / 0% | - / - / - (pooled 0/0) | 0 (0) |
| A · novice | 0 / 1 / 0% | 0 / 1 / 1% | - / 100% / 0% (pooled 1/2 = 50%) | 76 (105) |
| A · skilled | 74 / 73 / 71% | 75 / 75 / 72% | 98% / 98% / 98% (pooled 434/443 = 98%) | 466 (681) |
| B · idle | 0 / 0 / 0% | 0 / 0 / 0% | - / - / - (pooled 0/0) | 9 (9) |
| B · novice | 0 / 0 / 0% | 1 / 1 / 0% | 0% / 0% / - (pooled 0/3 = 0%) | 92 (119) |
| B · skilled | 76 / 72 / 80% | 81 / 78 / 83% | 94% / 92% / 96% (pooled 456/484 = 94%) | 505 (730) |
| C · idle | 0 / 0 / 0% | 0 / 0 / 0% | - / - / - (pooled 0/0) | 0 (0) |
| C · novice | 0 / 1 / 1% | 1 / 1 / 2% | 0% / 50% / 25% (pooled 2/8 = 25%) | 108 (170) |
| C · skilled | 76 / 77 / 81% | 76 / 78 / 82% | 100% / 99% / 99% (pooled 467/470 = 99%) | 503 (721) |

- **Won III guard:** today's full I-III road (`--movements 3`) wins 73 / 68 / 73% (pooled 71.3%); the Finale route's Skilled reaches the Finale (won III) 75 / 72 / 74% (pooled 73.7%, +2.4 points). The Novice's full road wins 6 / 8 / 7%.
- Unspent Aether: a Skilled run ends with about 500 of 720 earned (466-507 by party; question 5's surplus, accepted).

### Five viable builds (`loadouts.ts --movement 4 --seeds 50 --runs 30 --bots skilled --sets`)

| Preset | Conductor cell (1000 / 500003 / 777001) | Finale-route Expeditions (2000 / 900007 / 333003, 30 each) |
|---|---|---|
| Steady | 100 / 94 / 100% | 80 / 63 / 77% |
| Guardian | 100 / 98 / 96% | 60 / 70 / 73% |
| Bastion | 96 / 96 / 100% | 67 / 83 / 87% |
| Anchor | 96 / 98 / 98% | 60 / 73 / 50% |
| All In | 94 / 96 / 100% | 40 / 50 / 47% |
| Wide Choir | 98 / 96 / 90% | 70 / 80 / 73% |

Viable on all three sets: 5 of 6 (band ≥ 5): every preset but All In, whose whole runs miss on two sets.

### Pacing (both clocks; `pacing.ts --route expedition`, 16 players × 3 h)

| Base | Expeditions | average (band ≤ 40, stretch 38) | winning-run median (soft ≤ 45) | won III | minutes I + II + III + Finale | the Finale a reaching run (3.5-5) | the fight (none / Luminary) | XP a combat minute IV/I (±15%) |
|---|---|---|---|---|---|---|---|---|
| 9001 | 71 | **40.3** (missed) | 43.3 | 89% | 13.2 + 11.8 + 11.9 + 3.4 | 3.8 min | 219 / 216 s | 1.06 |
| 77003 | 71 | **40.5** (missed) | 43.8 | 89% | 13.2 + 11.9 + 12.0 + 3.4 | 3.8 min | 211 / 222 s | 1.08 |

For comparison, on the same bases:

| Road | 9001: average / winning median / won III | 77003 |
|---|---|---|
| today's full I-III road, no Finale (`--movements 3`) | 40.9 / 44.3 / 89% (won) | 39.1 / 44.4 / 84% (won) |
| s6e + II-6, Conductor 45,000 (the interrupted pass) | 41.4 / 44.6 / 87% | 40.5 / 45.0 / 88% |
| s6e + II-6, no road rewards | 41.8 / 45.7 / 87% | 38.9 / 45.0 / 82% |
| s5 + II-6, road rewards on row 0 only | 40.5 / 43.2 / 91% | 37.6 / 43.7 / 79% |
| **s5 + II-6, rewards on rows 0 and 1, Conductor 40,000 (shipped)** | **40.3 / 43.3 / 89%** | **40.5 / 43.8 / 89%** |

- **The exit clock misses by 0.3 / 0.5 minutes**, inside the model's ±1 minute of noise (77003 ranges 37.6-40.6 across near-identical trees). The winning-run median is under its soft 45 on both bases, and the won III guard holds with room.
- Why it sits at the line: the losses-included average follows the win rate. Today's full I-III road already averages 40.9 / 39.1 minutes with no Finale, and the Finale adds about 3.4 minutes an Expedition. The s5 + II-6 road takes about 4.5 minutes off a winning run, but Skilled now wins Movement III in 89% of Expeditions (the design model assumed 70-81%), so more runs go the whole way. The doc's levers are spent in order: the Conductor's life (the played fight is 211-222 s, the Finale 3.8 minutes against a floor of 3.5, and the cell 174 s against a floor of 170), the silence cap (no effect on a 25 s Skilled silence), then the s5 road. What remains is a design change: cutting Movement II's or III's road (their lessons, Brann's event row), or a leaner screen model (`AROUND`).
- `ROUTE_MINUTES.expedition` stays at 40 for the hand-off (the measured average rounds to 40).

### Bands

- **Met on all three sets:** Idle 0% (cells and runs); Novice at the Conductor 15-40% (22 / 30 / 26); party B Novice ≥ 10% (14 / 16 / 10); Skilled ≥ 80% (100 / 98 / 96), share ≥ 30% (50%), length 170-230 s (175 / 175 / 172); party C ≥ default − 5 and ≤ 280 s; party B ≥ default − 15; Callings ≥ 75% each and ≤ default + 40 s; the Decree gate; the Grand Silence (Skilled reignites 100%, 25 s; Anchor 32.7 s; a Novice hero standing 100%); whole runs: Novice won 1-6% (3 / 3 / 5), Skilled won ≥ 55%, reached the Finale ≥ 65%, won ÷ reached ≥ 80%, won III within 5 points; XP IV/I; the Finale 3.5-5 minutes a reaching run; five viable builds (5 of 6); sim-bench.
- **Seed-sensitive:** party A ≥ default − 5: 2 of 3 (94% against the default's 100% on 1000; 98 and 96% on the others).
- **Missed:** the losses-included average ≤ 40 (40.3 / 40.5; above); the Novice's won ÷ reached the Finale 15-40% (pooled 19/36 = 53%; 5/15, 5/7 and 9/14). Only 4-8% of Novice runs reach the Finale, and those are her strongest; her Conductor cell sits at 22-30% on ARRIVAL4_KIT. Lowering it further (a heavier pulse or Discord) would push party B's Novice under 10%.
- **Reported only:** the Novice reignites by notes in 46% of the silences she is put into (20-27 of 50 a set; modelled ≈ 5%), and wins every one of them.

## Determinism and invariance guards

- **Goldens.** The 15 stay byte-identical and are pinned as literals (`tests/sim/m1Unchanged.test.ts:19-56`). Four are appended after `skilled-brann-mirror-hall` (`tools/scenarios.ts`):
  - `skilled-conductor` (ARRIVAL4, about 13,000 ticks; joins the replay round-trip in `determinism.test.ts:54-70`);
  - `novice-grand-silence` (`setBossHp` to 26%, 4,800 ticks);
  - `skilled-brann-conductor` (party B, no dome);
  - `skilled-chrono-silence` (Chronomancer with Paradox, `setBossHp` 26%).
  - 'Exactly the fifteen' (`:66-70`) becomes nineteen, in order. SIM_VERSION 22; only `contentVersion` moves.
- **Byte-equal at every merge:**
  - m1-baseline `--movement 1|2|3 --check`; expedition-baseline `--movements 2|3 --check`;
  - expedition2Pin and expedition3Pin; movement3Handoff;
  - preludeSnapshot; draftSnapshot (movements 2); commandSnapshot and commandSnapshotM3; rosterInvariance;
  - the Spire and Rift render and audio snapshots.
- **Absence:**
  - a sampled test that Movement I-III fights never show `field.finale`, `internal.m4` or `stilled` (every 60 ticks, the `movement3Enemies.test.ts:1059-1079` pattern, with a Movement III fight added);
  - no Movement I-III attack has `discord`, `discordQuorum` or answers `crescendo`;
  - `drawnFinale` and `firedFinale` stay zero, and no Finale sound fires.
- **Exact-shape checks:**
  - `isDisabled` equals the old predicate on every Movement I-III tick, **for heroes and enemies**;
  - `hitEntity` without `discord` gives identical results and events;
  - Martyr Bear, Shared Wounds and the Vow in a Movement I fight: no `borne` key on any result, and events and ledger equal byte for byte;
  - the Crescendo and verdict hooks are no-ops (no event, no ledger write) in legacy encounters; `tests/architecture.test.ts` stays green;
  - `generateMap(seed, n ≤ 3)` equals the W0a fingerprints;
  - `generateMap(seed, 4)` equals `generateMapFrom(seed, routeDefs(4))`, and its Movement III rows equal `generateMap(seed, 3)`'s apart from ids and the Unweaver's `next` and reward.
- **Sleeping relics:** the three Finale relics in a Movement I-III config leave `world.mods` and the events equal; in a Finale config each moves its mod key by its value (stacking on Steady Hands, Fisher's Knot and Twin Aegis).
- **Without you:** with `config.absent` the fight ends by 450 s.
- **Hand-off:**
  - `tools/m4-baseline.json` (1 fight × 3 bots × 10 seeds);
  - `tools/expedition4-baseline.json` (`--movements 4`);
  - `tests/meta/finaleHandoff.test.ts`;
  - `tests/bots/commandSnapshotFinale.test.ts` (Skilled and Novice, 3 seeds × 30 s, plus one stream entering the silence through `setBossHp`).

## Tests

**New:**

- **`tests/sim/finalePrimitives.test.ts`** (W1):
  - `stilled` disables, refuses a Cue, can't be Chimed or blocked by `immune`, and lets a Reel pull;
  - a stilled hero: `riposteOn` stays null in the silence, a running Solo burns out on its clock, `noticeTelegraphs` still sets `incoming`;
  - `isDisabled` is unchanged for every other status, on heroes and enemies;
  - the verdict, row by row of the victim table: a clean hit fails; a partial Ward, the dome, Oathkeeper and the sphere (`takenBy`), Aegis Link, a Fermata hold, the Lamb, `borne`, a Reel, a walking dodge, a Chimed mark, Paradox, an interrupt and a kill are answered; Fermata's guard alone fails; a raid gives one verdict; `discordQuorum 2` needs two failed victims;
  - `borne` only with `internal.m4`;
  - the Crescendo hook fires for Sunrise, the Vow and Stasis, and is a no-op in legacy encounters.
- **`tests/sim/finaleScript.test.ts`** (W1, after W2):
  - the registry has three keys;
  - Raise pushes elite pendingSpawns at +1.0 s with a `spawnWarning` each, on the 6 m ring;
  - the Cue → Solo order; the target named at begin; the idle-voice guard and the wait; a Solo that can't begin refunds the Cue (2 s);
  - the Cue gate (Fortissimo live, ≥ 2 live telegraphs, the boss casting); never-Cued voices first;
  - Discord: amounts, passive rise, the phase-2 floor of 70 and +1.0/s, the reset;
  - Fortissimo Silence: three pulses at 3.0 / ≈4.5 / ≈6.0 s (±1 tick) at default assists, longer in proportion with telegraphLead 1.5; cancelled synchronously by each Crescendo, including one already running; re-queued after a phase-2 crossing; dropped at phase 3;
  - the Grand Silence: choir shattered; boss invulnerable and its melee held; the program scheduled from impacts (9.0 s ±1 tick at defaults; ordering and the 2-live cap with telegraphLead 1.5 and Lullaby); Final and Half Cadence alternating; notes from Perfect, clutch, reel saves and Rewind undoes (restore and Paradox cancel), not from Bear, Vow or Lamb saves; Solo +12.5 a note; Reignite at 8 with downed heroes revived at 30%; the Coda at the cap with no revive; the absent wipe before the enrage;
  - the burn's Downbeat and Sforzando begun by the script; the picker idle in phase 3;
  - Stasis waits every clock; `onDeath`, `cleanup` and `endEncounter` delete everything; `scriptedNext`; both enrages; `setBossHp` drives the phases.
- **`tests/meta/finaleRoute.test.ts`** (W3):
  - 18 rows, unique ids, every node reachable;
  - the road appears only on the Finale route;
  - Threat: Bellwarden 1.225, Cantor 1.3, Matriarch 1.113, Vharun 1.188;
  - callingRows [0,1,2,4], with the tier at the Cantor before relic and draft;
  - over 40 seeds, both Movement II elites and every pooled skirmish appear somewhere;
  - the Unweaver interlude: heal 0.5, 75 Aether, 3 relics, offerMovement 4;
  - Finale relics absent from Movement I-III offers and shops;
  - only the Conductor sets `wonRun`;
  - a Prep-phase save redraws to 4; an in-flight I-III save ends at the Unweaver;
  - `finaleCleared`; the Dissonance gate keeps open profiles open.
- **`tests/meta/expedition3Pin.test.ts`** (W0a).
- **`tests/renderFinale.test.ts`:** absence counters, own bodies, 7/6 meshes, FX peaks at Low, Medium and High, floor lightness, the BIOME_LOOK row, `riftCues.ts` untouched.
- **`tests/colorVision.test.ts`:** FINALE_HEX ≥ 20 ΔE from every semantic colour (Resonance and gold included) in every vision; CRUCIBLE_HEX kept off them.
- **`tests/audioPhase5d.test.ts`:**
  - crucible stems in key;
  - silence zeroes every stem; only the allow-list plays;
  - ducks and Fermata or Stasis releases don't reopen the silence;
  - the eight notes resolve on D5;
  - Reliquary, crimson and abyss output unchanged.
- **`tests/uiPhase5d.test.ts`:**
  - BossHud keys only in the Finale; Blind Score;
  - an audio-muted, Flashes-0 HUD snapshot shows the meter, stave and stilled frames;
  - the route copy, with the Prelude strings unchanged;
  - a Calling- and variant-aware sighting card;
  - the epilogue is under 20 s and skippable.
- **`tests/bots.test.ts`:**
  - staged FINALE_RULES per Calling and per party, and per Reel variant (Swap, Anchor);
  - Novice draws only with a mechanic up;
  - Idle loses the Conductor;
  - `movementEncounters(4)` is exact;
  - each Conductor Decree answered ≥ 80% over 12 seeds.
- **`tests/harnessTools.test.ts`:**
  - a 4-route run reaches the Conductor, with `minutesByMovement` of length 4 and phases under MAX_PHASES/2;
  - `defaultKit(4) = 'arrival4'`;
  - the FinaleTally keys;
  - the I-III and I-II runs are unchanged.
- **`tests/sim/finaleRelics.test.ts`** (W2): each relic's `applyRelic` case moves its key, asleep outside movement 4, stacking after motifs.

**Edited by design:**

- `tests/sim/rules3.test.ts:351` and `tests/sim/scripts3.test.ts:138` (registry keys);
- `tests/sim/m1Unchanged.test.ts` (the relic movement set at `:186-190`, forbidden keys, 19 goldens);
- `tests/content.test.ts:503` (movements length 4, in W3) and the lint rejection cases;
- `tests/meta/movement3.test.ts:110-118, 283-310, 423-432, 448-454` (EXPEDITION_MOVEMENTS 4; `expedition(22)` passes 3 explicitly);
- `tests/meta/deeds.test.ts:179, 209` (27 / 26);
- `tests/uiPhase5.test.ts:272-274` (the `EXPEDITION_MOVEMENTS === 3 ? 'III' : 'II'` ternary becomes the label-aware 'Movements I–III and the Finale'; W3) and `:276-279` ('Expedition · ~40 min' follows `ROUTE_MINUTES`; W9);
- `tests/uiPhase5cFixes.test.ts:110-111` and `tests/uiPhase5Fixes.test.ts:163` (EXPEDITION_MOVEMENTS-based lengths; W3);
- `tests/uiPhase5c.test.ts` (route copy);
- `tests/appStores.test.ts:119-142`;
- `tests/dissonance*`, the loom tests (gate copy);
- `tests/uiPhase3c.test.ts:228-299` stays **unchanged** (`tierWhen(i)` without a run keeps CALLING_ROWS);
- `e2e/smoke.spec.ts:239-390`:
  - `movements: 4`;
  - the Unweaver → relic → draft → map;
  - `warpMovement(4)` → the Conductor → epilogue → Summary 'The song goes on';
  - `winRun` walks to the Conductor (`testHook.ts:119-126, 311-334`);
  - Prep reads 'Movements I–III and the Finale, to the Silent Conductor.'
  - The Prelude smoke is unchanged.

## Exit criteria

1. Every guard above holds. SIM_VERSION is 22.
2. The bands are met on all three seed sets, or each miss is reported as seed-sensitive (k of 3) or missed, with its cause.
3. **Pacing (question 2's default):** the average Skilled Expedition is ≤ 40 on 9001 and 77003 (stretch 38); won III within 5 points of the full road; the Finale takes 3.5-5 min per reaching run; the winning-run median is printed as a headline; XP per combat minute IV/I is within ±15%; `ROUTE_MINUTES.expedition` is set from the measurement.
4. **Readability:**
   - every Finale telegraph and spawn warning lasts ≥ 1.0 s and shows its glyph;
   - 100% of downs name an answer;
   - the Grand Silence reads with audio muted and Flashes at 0 (the HUD snapshot test, plus a cold read ≥ 4/5 naming the three note sources);
   - the ΔE tests pass.
5. **Every Calling and party has an answer to every beat**, checked by staged bot tests per Calling (Chronomancer with and without Paradox), per Reel variant and per party.
6. **Five viable builds** per the band above.
7. **Build health:** lint, tsc, vitest and e2e green; sim-bench p95 ≤ 1.5 ms a tick (legacy benches unchanged within noise); no new FX batch; content lint clean.
8. **Saves:** v5 runs (in-flight I-II and I-III) and v9 profiles load and finish; Prep-phase saves upgrade.
9. **Hand-off and docs:**
   - the m4 and expedition4 baselines, the Finale command snapshot, finaleHandoff and 19 pinned hashes;
   - this file with its measured tables;
   - `docs/phase-5d/{vfx-audio.md, ui.md}` and `docs/demo.md`.

## Hand-off for Phase 6

- `finaleCleared(run)` and the `song_goes_on` Deed gate the Atlas of Echoes and weekly seeds.
- The road shows how an Echo can remix a route without touching a fight.
- The variant-def seam (below) carries True Dissonance and Tyrant.

## Known gaps (deliberate)

- **True Dissonance** is not built (question 4). Its seam is a later variant def, `the_silent_conductor_true`, that shares `conductorScript()` and has its own 4-row PHASES entry. `bossPhaseTable(defId)` stays pure (`bosses.ts:148-155`, `hudBridge.ts:78-80`), and a Dissonance effect swaps the Finale encounter's boss.
- No enemy Solo charge meter and no Rubato: the Cue cadence is the clock.
- Discord also rises with time (question 7), so Fortissimo Silence comes even against perfect play.
- A Rewind that undoes a silence blow counts as a note (question 8).
- Fortissimo Silence without a Crescendo usually costs a down or two. That is by design, and the hint says so.
- A Grand Silence threshold crossed during Fortissimo Silence drops it: the silence replaces it.
- The Grand Silence leaves auras running (question 1).
- The Novice reignites by notes in about 46% of the silences she is put into (measured, `setBossHp 0.31`; modelled ≈ 5%), and a hero stands at the end of every one; her path through the silence is easy, and her losses come in phases 1 and 2 (see *Tuning*).
- The Cue bar names the soloist and Solo; the target is named 1.2 s later, when the Solo begins.
- The Finale is boss-only, with no events and no shop. Aether piles up (question 5).
- The Finale relics live for one fight a run.
- Today's per-cell preset misses in Movements II-III can't be tuned in this slice.
- The winning-run median measures 43.3 / 43.8 minutes and the losses-included average 40.3 / 40.5, just over the band (question 2; see *Tuning*).
- The content counts stay below 1.0 (motifs 30/~90, Harmonies 1/12, relics 21/~40 → 24, events 10/~16, auras 6/10, ornaments 4/10). This slice closes bosses at 4/4.
- The Atlas of Echoes, weekly seeds, Tyrant, Mimicry, Counterpoint, Seren, Oro and the Conductor Calling come later.

## Review resolutions

Each point of the design review was checked against the code. Accepted points changed the design above; rejected or partly rejected ones are listed with the reason.

- **Relics did nothing** (accepted): `applyRelic` cases added; Hush Bell replaced by Quick Rosin (no Stillwater Bell repeat).
- **Paradox doesn't spare aimed silence attacks** (accepted): Paradox spares are no longer notes; a Paradox Rewind's cancel is the Chronomancer's Reel-slot note (question 8).
- **Rewind once a run, 18 s, no dodge when frozen** (accepted): Chronomancer pace re-modelled; question 8.
- **Uncued Solos need autonomy** (accepted): the burn's Solos are Cued; Reignite revives instead.
- **Vexis has no native stun** (accepted): party and choir tables fixed.
- **Thread doesn't scale pctMaxHp, set before begin** (accepted): the phase-2 Thread is removed.
- **Phase-3 specials [] stop the burn** (accepted): the script begins the burn's attacks.
- **Life ratio left out Threat** (accepted): 0.67.
- **Fixed timings ignore multipliers and the follow-up tick** (accepted): timings stated at defaults, ±1 tick; the program schedules from impacts; the cap scales.
- **The Cue can't promise its target** (accepted): target named at begin; Solos range 44 (the diameter); failure path specified.
- **`isKnown`, Novice Reels, CAST_ICON lines, name/mapTitle** (accepted): corrected.
- **Shatter Aria vs Scatter** (partly accepted): the circle is fixed where its target stood when it began (`enemies.ts:713-716`), so the target can walk out; but Scatter alone doesn't answer the target, so `discordQuorum 2`.
- **Fortissimo may never come in a clean fight** (accepted): floor 70, +1.0/s.
- **'Each Solo ≥ 2' not credible** (accepted): gate per voice; never-Cued first; immediate phase-2 Raise.
- **Novice and Coda bands** (accepted): modelled (`silence.mjs`); the Cadence alternates; the Coda drops its Fortissimo; bands re-set.
- **Swap downs the Weaver** (rejected on numbers): the Weaver takes a share of her own 360 life (414 at 115%) behind a barrier of 50% of the hero's life (370-800), so at most 44 (Martyr: 458 of 720); a bot guard and a sighting line are added.
- **Bond intercepts read as failed** (partly rejected): `oath()` returns `{...NO_DAMAGE, takenBy}` for the victim (`health.ts:1205`), so it never read as failed; the full victim table now covers Oathkeeper, the sphere, Aegis Link, Fermata's guard and hold, and the Lamb.
- **Workstream ordering** (accepted): W2 doesn't register FINALE; W3 depends on W2 and registers it; W5 and W8 depend on W3.
- **Unlisted test breaks** (accepted): listed; `tierWhen` keeps its signature.
- **Pacing partly from losses; won-run headline; two plan deviations** (accepted): both headlines; won-III guard; questions 2, 7 and 8.
- **Survival table gaps** (accepted): party B, Martyr and Shaken rows.
- **Stilled orders incomplete** (accepted): spelled out and tested.
- **No spawn warning** (accepted): Raise uses pendingSpawns with a 1.0 s warning.
- **bankCrescendo's pacing cost** (accepted): measured per Calling and party; pacing uses the played fight.
- **Invariance risks** (all accepted): no `riftCues.ts` edit; `borne` gated on `m4`; `isDisabled` sampled on enemies and benched; a separate Finale schema instead of relaxing MovementDef; a length-derived audit in W3; setter hooks with no events when absent; audio short-circuits; the light term behind an `if`.

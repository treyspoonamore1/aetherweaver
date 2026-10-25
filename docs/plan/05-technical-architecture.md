# 05 — Technical Architecture

> How the remake is built so that the game in [02-game-design.md](02-game-design.md) is fast, testable, tunable and can be extended for a long time without turning into another pair of 3,000-line components.

## 1. Goals and non-goals

**Goals**

1. **The simulation is the source of truth.** It is pure TypeScript with no `three`, React or DOM imports. It is deterministic for a given seed and command log, and it runs headless in Node for tests, replays and the bot balance harness.
2. **Everything else is a view.** Rendering, audio and UI read sim state and consume sim events. They never mutate the sim. Player intent goes in only as `Command`s.
3. **Content is data.** Heroes, enemies, bosses, auras, ornaments, motifs, relics and events are typed, schema-validated data files. Adding a motif should not require touching engine code.
4. **Performance.** Hold 60 FPS on a mid-range laptop with integrated graphics at 1080p with 150+ enemies on screen. No per-frame allocation in hot paths, and React does not re-render every frame.
5. **Small modules.** No file over ~600 lines. Each system has one job and its own tests.

**Non-goals for 1.0** (the architecture leaves the door open): online co-op, mobile/touch controls, cloud saves, modding API, WebGPU-only rendering.

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Language/build | TypeScript 5.9 strict, Vite 7 | Same as the original; fast HMR; no reason to change |
| UI | React 19 + Tailwind 4 + Zustand 5 | Same as the original for menus. Zustand gives selective subscriptions, so the HUD doesn't re-render the world |
| 3D | three 0.186 (WebGLRenderer; WebGPU later behind the same `render/` facade) | Same as the original, mature and well documented |
| Post FX | `postprocessing` 6.39 (pmndrs) | Selective bloom, SMAA, vignette and chromatic pulses in one merged pass |
| Particles | `three.quarks` 0.17 (batched), with a fallback to a custom pooled GPU-points system | Batched emitters cut draw calls. Evaluated in a Phase-1 spike (see roadmap) |
| World text | Custom instanced bitmap-font quads for damage/heal numbers; `troika-three-text` 0.52 for nameplates | Hundreds of numbers per second must be one draw call |
| Schemas | `zod` 4 | Content and save validation, with TS types inferred from one source |
| Tests | Vitest 5, Playwright 1.64 | Unit/scenario/harness tests in Node; E2E smoke in a real browser |
| Audio | Thin custom WebAudio engine (buses, voice pool, ducking, stem scheduler) | Needs sample-accurate music sync and pitch-to-key SFX that generic libraries don't give cleanly |
| Navigation | Steering + flow field on a 1 m grid; `@recast-navigation/three` only if arenas get complex | 200 agents on a flow field is cheap; navmesh is overkill for arenas |
| Asset pipeline | glTF, `@gltf-transform/cli` 4.5 (meshopt, KTX2/WebP) | Small downloads, fast decode |

All versions were checked against the npm registry on 2026-10-24.

## 3. Repository layout

```
src/
  app/              bootstrap, screen router (Title → Hub → Map → Combat → Results), error boundary, loading
  sim/              ⛔ no imports from three / react / dom
    core/           fixed-step clock, RNG streams, event bus, entity store + pools, spatial hash
    stats/          stat keys, modifier buckets (base / add / increased / more), derived-stat cache
    combat/         damage pipeline, healing pipeline, shields, statuses & ailments, threat tables
    weaver/         Thread, Ward, Chime (Cleanse), Reel, Glide, Cue, Crescendo, Spirit & Resonance
    heroes/         hero kits + utility AI + quirks + directives
    enemies/        enemy behaviour state machines, telegraph emitters, elite affixes
    encounter/      spawn director, wave scripts, objectives, boss phase scripts
    ledger/         contribution ledger (healing, mitigation, amplification, saves), death recap
    api.ts          createSim(config, seed) → { step(cmds), state, drainEvents(), snapshot(), hash() }
  content/          typed data (heroes, enemies, bosses, auras, ornaments, techniques, motifs, relics, events, biomes)
    schema.ts       zod schemas → inferred TS types (single source of truth)
    effects.ts      the effect/trigger vocabulary content is written in
  meta/             run-map generation, reward tables, merchant, forge, profile, unlocks, save + migrations
  render/
    stage.ts        renderer, scene graph, quality tiers, resize, dynamic resolution
    camera.ts       follow rig, look-ahead, zoom, director shots, trauma-based shake
    views/          HeroView, EnemyView (instanced), WeaverView, ThreadView, AuraView, LootView
    telegraphs/     SDF decal shaders (circle / cone / line / donut / link / mark) + threat lines
    vfx/            particle presets, pooled emitters, hit-stop/flash/chromatic pulses
    text/           instanced damage/heal numbers, nameplates
    assets/         glTF loading, animation retargeting, shared palette material
  audio/            engine, buses, SFX registry, music director (stems, key/scale), spatializer
  input/            action map keyed on KeyboardEvent.code (layout-independent; held keys cleared on blur),
                    remapping, gamepad, pointer→ground picking, smart-cast rules → Commands
  ui/
    store.ts        zustand slices: hudSnapshot (15 Hz), callouts, screens, settings
    hud/            PartyFrames, WeaverBar, ResonanceArc, BossBar, Callouts, Feed
    screens/        Title, Hub, Astrolabe, Reliquary, Bonds, Map, Draft, Forge, Results, Codex, Settings
    kit/            design-system components (Panel, Tooltip, StatLine, KeyHint, Meter, Glyph)
  debug/            dev panel, AI-score overlay, hitbox/radius overlay, replay viewer, perf HUD
tests/              vitest: unit, scenario, determinism, content validation
tools/              harness CLI (bots), content linter, save fuzzer
e2e/                playwright smoke + HUD visual snapshots
reference/original/ the original game, read-only, never imported
```

ESLint `no-restricted-imports` enforces the `sim/` purity rule, and CI fails if `sim/` imports anything outside `sim/` and `content/`.

## 4. Simulation core

### 4.1 Loop and time

- **Fixed timestep: 60 Hz sim**, with render interpolation (`alpha = accumulator / dt`). At most 5 sim steps per frame to prevent a spiral of death. The sim pauses when the tab is hidden.
- **Hit-stop and slow-mo live inside the sim** (`world.timeScale`, set by sim rules such as Perfect Ward). They stay deterministic and replay correctly. The renderer only adds camera and post-FX on top.
- **Game-speed assist** (70–100%) scales the real-time→sim-time ratio. It never changes `dt`, so behaviour stays identical.

### 4.2 Entities and data layout

- Pooled entity records with integer ids plus a generation counter, so stale handles are detectable. Component-style optional fields: `transform`, `health`, `shields`, `statuses`, `ai`, `telegraph`, `projectile`, `thread`, `aura`, etc.
- The expected scale is ≤ 400 live entities (3–6 heroes, the Weaver, ≤ 250 enemies, projectiles, zones). That makes plain arrays of pooled objects simpler and fast enough. bitECS-style SoA is not needed; revisit only if profiling says so.
- A **spatial hash** (4 m cells) handles neighbour queries: aura membership, AoE hits, separation, thread-crossing tests.
- Systems run in a fixed, documented order every tick:

```
commands → weaver techniques → hero AI → enemy AI → movement/steering → telegraph timers
→ attacks & projectiles → damage/heal pipeline → statuses tick → aura membership & buffs
→ threads (tension, crossing effects) → resonance → encounter director → ledger → cleanup
```

### 4.3 RNG

`xoshiro128**` with **independent named streams**: `combat`, `ai`, `loot`, `map`, `cosmetic`. Adding a loot table never changes combat rolls, so daily seeds and replays stay stable across content patches where possible. `Math.random` is banned in `sim/` and `meta/` by lint.

### 4.4 Commands (the only way in)

```ts
type Command =
  | { t: 'move'; x: number; z: number }               // normalized direction
  | { t: 'aim'; x: number; z: number }                // world point under cursor
  | { t: 'thread'; target: HeroRef }                  // attach / retarget
  | { t: 'mode' }                                     // Mend ⇄ Empower
  | { t: 'tech'; id: TechniqueId; target?: HeroRef; point?: Vec2 } // Ward, Cleanse, Reel…
  | { t: 'glide'; x: number; z: number }
  | { t: 'cue'; hero: HeroRef }                       // fire a hero's Solo (costs Resonance)
  | { t: 'crescendo' }
  | { t: 'directive'; kind: 'focus' | 'rally' | 'hold' | 'scatter'; target?: EntityRef | Vec2 };
```

Commands are stamped with the tick they apply on. **Replay = content version + seed + command log.** That gives bug reproduction, daily-run verification, "watch your best run" and bot-generated regression fixtures for free.

### 4.5 Events (the only way out)

A typed discriminated union, buffered per tick and drained by consumers (renderer, audio, UI, ledger, achievements):

`DamageTaken`, `HealApplied` (with `overheal`), `ShieldAbsorbed`, `TelegraphStarted` (shape, owner, target, `impactAt`, `answers: AnswerTag[]`), `TelegraphResolved` (hit / dodged / warded / perfect), `PerfectWard`, `Save` (kind, target, counterfactual damage), `Cleansed`, `Reeled`, `ThreadAttached` / `ThreadTaut` / `ThreadSnapped`, `ResonanceGained`, `SoloReady`, `Cued`, `CrescendoStart` / `End`, `AllyDowned` / `Revived`, `EnemyKilled`, `LootDropped`, `PhaseChanged`, `Bark`, `DirectiveAck`.

UI callouts, SFX, VFX, hero barks, the run feed, achievements and the end-of-run timeline are all **event-driven**. Nothing polls.

### 4.6 Stats and modifiers

One transparent pipeline for every stat, PoE-style but fully inspectable:

```
final = (base + Σ add) × (1 + Σ increased) × Π (1 + more_i)
```

- Each modifier carries `source` (aura, ornament, motif, relic, calling, bond, astrolabe node, status), so tooltips can show a **full breakdown** (hold Alt), and so the ledger can attribute every point to the Weaver.
- Derived stats are cached and invalidated per entity when its modifier set changes, never recomputed per tick.

### 4.7 Damage and healing pipelines

```
Hit → evasion (Grace-type) → Ward → aura barrier → overshield → armour/resist → taken-mods → HP
Heal → healing-received mods → HP up to max → overheal → overshield conversion (if any) → ledger
```

**All damage goes through this one pipeline, ailment ticks included.** Barriers and mitigation apply unless a mechanic explicitly says otherwise on its tooltip. In the original, ailment ticks bypassed every defence and did most of the damage, which made the defensive build options meaningless.

Every stage emits enough data for the **contribution ledger** to compute:

- **Amplified damage.** The Weaver's share of hero damage. The pipeline tracks the product of Weaver-sourced `more` multipliers separately, so `weaverShare = final − final / Π(weaver mores)`, plus the added flat damage from Weaver sources. This is what fixes a meaningless "0% from you".
- **Effective healing** and **overheal** (kept separate).
- **Mitigation**: damage absorbed by Wards/barriers/overshield, damage negated by Perfect Wards, and damage avoided by Reels.
- **Saves.** A *counterfactual* check: at resolution, would this hit/detonation have reduced the hero to ≤ 0 without the Weaver's intervention in the last N seconds? Each save stores its cause for the recap ("Reeled Lyra out of Requiem — would have taken 1,140").
- **Death recap**: the last 5 s of damage and heals per hero, which telegraphs were active, and what was on cooldown.

### 4.8 AI

- **Heroes run utility AI.** Each tick each hero scores a small action set (basic attack target X, use ability A/B, reposition into aura, retreat to Weaver, obey directive, dodge a telegraph it "noticed"). Scores combine considerations (distance, threat, HP, directive, *quirk weights*). Quirks are deliberate, readable flaws (see design doc §6) expressed as weights, so Bond talents can tune them. A debug overlay prints the top 3 scores over each hero's head.
- **Enemies run explicit state machines** with telegraph states: `Idle → Approach → Windup(telegraph) → Strike → Recover`. Windup always emits `TelegraphStarted` with `answers` tags (ward / cleanse / reel / focus / scatter / stack). Content validation fails if a damaging attack has no answer tag.
- **Threat tables per enemy.** Damage, taunts and **healing done** generate threat, so a hard-healing Weaver draws aggro. That is an intentional positional pressure the tank can peel.
- **Steering**: seek/arrive, separation, obstacle avoidance and flow-field following for swarms. Heroes use the same steering plus formation slots relative to the Weaver.

### 4.9 Determinism guardrails

- A golden test runs 3 scripted encounters for 3,600 ticks with fixed seeds and compares `sim.hash()` (quantized positions, HP, RNG states). Sim changes must update goldens deliberately in the same PR.
- No iteration over `Map`/`Set` with insertion order that depends on non-deterministic sources, and no wall-clock reads in `sim/`.
- Floating-point determinism is only guaranteed on the same engine/OS. That is enough for replays and dailies verified locally.

## 5. Rendering

### 5.1 Scene and quality

- WebGLRenderer, antialias off with SMAA in post, ACES/AgX tone mapping, sRGB output.
- One directional key light with a shadow map for heroes, bosses and large enemies only. Fodder gets blob-shadow decals.
- **Quality tiers** (auto-picked from frame-time sampling, overridable): shadows, post chain, particle density multiplier, resolution scale (dynamic resolution between 0.6 and 1.0).
- Per-biome colour-grading LUT. Hit flashes use a hard-coded white emissive pulse on hit.

### 5.2 Characters

- Heroes, Weaver and bosses are skinned glTF with `AnimationMixer` and retargeted shared humanoid animations (see [04-presentation.md](04-presentation.md) for sourcing).
- Enemy crowds: ≤ 40 skinned enemies render individually. Fodder above that uses `InstancedMesh` rigid variants with procedural bob/lean/squash. Phase 7 option: bake vertex-animation textures (VAT) for instanced animated crowds.
- **Readability materials**: allies get a fresnel rim in their aura colour while inside the Weaver's field, so "in aura" is readable without UI. Threaded allies get a thread-coloured outline, and enemies targeting an ally get a thin threat line during windup.

### 5.3 Signature visuals

- **ThreadView**: a camera-facing ribbon along a Catmull-Rom spline from the Weaver's hand to the target's chest. It sags when slack and goes straight and thin when taut, with a high-frequency shimmer near snapping. A shader scrolls noise and **sends visible pulses along the thread on every heal/amp tick**, so the player can see the flow. Mend is teal, Empower is gold. Retargeting whips the spline over 0.15 s, and a snap bursts into particles with a recoil.
- **AuraView**: a ground-projected shader ring stack, one band per active aura in its colour, with rotating glyph texture and a subtle inner tint. It pulses on the music beat and shows a contracted, cracked ring when suppressed.
- **Telegraphs**: a dedicated layer drawn after the ground and before characters, always on top of VFX (render order, depth test off for the fill). SDF shapes in one shader with uniforms `progress`, `severity`, `answerGlyph`. The fill sweeps to the edge exactly at `impactAt`, and the Perfect-Ward band is drawn as a thin bright rim during the last 0.35 s, widenable in accessibility settings. Mark-type telegraphs (single-target nukes) render as a countdown ring above the hero's head.
- **Numbers**: one instanced draw call. Damage numbers show the Weaver-attributed portion as a **gold suffix chip** (`412 +96`), so contribution is visible at the point of impact. Heal numbers are aggregated per target per 0.4 s to avoid spam.

### 5.4 Camera and screen FX

- The follow rig targets `weaver + 0.2 × (cursor − weaver)` look-ahead with critically damped smoothing and a zoom range.
- **Trauma-based shake** (`offset ∝ trauma²`, decays) with a 0–100% accessibility slider and a hard cap.
- **Director events** from sim events: boss-intro pan, Crescendo zoom-punch with a chromatic pulse, Perfect-Ward hit-stop (visual is synced to the sim's time scale), slow-mo on a save.

## 6. UI architecture

- **No per-frame React.** A `HudBridge` samples the sim at **15 Hz** into a compact `hudSnapshot` (party HP/shields/statuses/solo charge, Weaver resources, cooldown *end timestamps*, boss bar, objective). Components subscribe to slices with shallow equality.
- Continuous visuals such as cooldown sweeps, cast bars and Resonance fill animate in CSS from start/end timestamps, or through refs. World-space bars live in WebGL, not the DOM.
- **Callouts** ("PERFECT", "SAVE", "SOLO READY") and the feed are fed from sim events through a small queue store with lifetimes.
- **Screens are lazy-loaded** and never mounted during combat (only Pause). Meta screens read and write the profile through `meta/` services, never sim internals.
- **Design system** in `ui/kit`: tokens for spacing, type (Cinzel for display, Inter for UI, JetBrains Mono for numbers, carried over from the original), semantic colours (heal / shield / damage / amp / ailment / threat) with colour-blind-safe alternates, and every semantic colour paired with a glyph.

## 7. Content pipeline

- Content is written in TS modules using small builder helpers, validated by zod at dev startup and in CI. IDs are string-literal unions derived from the data, so references are type-checked.
- **Effect vocabulary** (`content/effects.ts`): `stat(mods)`, `trigger(on, when?, do[])`. Triggers include `perfectWard`, `save`, `cleanse`, `reel`, `threadAttach`, `threadSnap`, `cue`, `crescendoStart`, `allyHit`, `allyLow`, `enemyKilled`, `telegraphResolved`, `tick(n)`. Effects include `heal`, `shield`, `damage`, `applyStatus`, `cleanse`, `resonance`, `modifyThread`, `spawn` and `cooldown`.
- Only boss phase scripts are code, and they use a constrained `BossScriptAPI`: schedule attack, spawn adds, set phase, set arena state.
- **Content lint** (CI): every reference resolves; every damaging enemy attack has at least one answer tag; numbers stay inside sanity ranges; every motif has ≥ 1 synergy tag; every Harmony's prerequisites exist and are obtainable together.
- The in-game **Codex** is generated from content: no hand-maintained docs to drift.
- **Localization-ready**: player-facing strings use keys, and numbers are formatted through one helper.

## 8. Save system

- **Profile save** (meta progression, settings, unlocks, Reliquary) and **run save** (resume at node boundaries) are separate.
- zod schema, an integer `version`, and an ordered `migrations` array. Validation runs on load. On failure the game keeps the raw blob as a backup, offers export, and starts safe.
- localStorage for the profile (small) with an IndexedDB fallback. Export/import uses a compressed base64 string.
- Autosave runs at node boundaries, on meta changes (debounced) and on `pagehide`. **Saves are never written from per-frame or per-tick paths.** The original re-serialised its whole save about 10 times a second in combat, because bond XP changed every HUD tick.
- A save fuzzer in `tools/` round-trips random valid profiles through every migration.

## 9. Debug tooling

- **Dev panel** (backtick): timescale, god mode, spawn enemy/elite/boss phase, force a telegraph on a hero, grant motif/relic/Resonance, jump to map node, toggle overlays.
- **Overlays**: hero AI top-3 utility scores, hitboxes, aura and thread ranges, telegraph answer tags, threat tables.
- **Replay viewer**: load a command log and scrub. Any bug report can attach its replay (Settings → Export last run).
- **Perf HUD**: frame time, sim ms/tick, draw calls, triangles, live entities, particles, React commits/s.

## 10. Testing strategy

| Layer | What | Tooling |
|---|---|---|
| Unit | stat pipeline, reservation & Spirit math, damage/heal pipeline, statuses, thread tension, Perfect-Ward window, RNG streams | Vitest |
| Scenario | tiny deterministic setups with asserted outcomes, e.g. "Bell Brute cleave on Kael + Ward cast at −0.2 s → 0 damage, Riposte fired, +20 Resonance" | Vitest + sim API |
| AI | e.g. "hero obeys Rally within 0.5 s", "Lyra's Greedy Shot quirk ignores telegraphs < 1 s remaining unless Bond ≥ 6" | Vitest |
| Determinism | golden hashes for 3 scripted encounters | Vitest |
| Mechanics | every boss Decree and elite mechanic must be *failed* by the Idle bot and *passed* by the Expert bot, at 30/60/144 Hz render rates (in the original, two of four Decrees ignored the player entirely) | Vitest + harness |
| Content | lint rules in §7 | Vitest |
| Balance | bot harness (§11) against target bands | `tools/harness` CLI, nightly CI |
| E2E | boot, new profile, play the tutorial encounter via an exposed test hook, zero console errors, HUD screenshot | Playwright |
| Perf | scripted 200-enemy scene; p95 frame time tracked as a relative regression | Playwright |

CI runs on every push: typecheck, lint, unit, scenario, determinism, content lint, a short harness, build and E2E smoke.

## 11. Balance harness (the secret weapon)

The original had no way to know whether the player mattered. The remake measures it.

- **Bots** play through the same `Command` API, so every bot game is a valid replay. Each bot is a parameterised `WeaverBot`:

| Bot | Reaction time | Triage quality | Perfect-Ward rate | Uses Reel/Cue/Crescendo |
|---|---|---|---|---|
| Idle | — | none | 0% | no |
| Novice | 700 ms ± 200 | lowest-HP only | 10% | rarely |
| Skilled | 350 ms ± 100 | threat-aware | 50% | yes |
| Expert | 200 ms ± 50 | predictive (reads telegraphs) | 85% | optimally |

- `npm run harness -- --scenario "act1/*" --bots idle,novice,skilled,expert --runs 200` writes CSV plus a Markdown summary of win rate, time-to-clear, party HP lost, saves and Weaver share. It then compares against `tools/harness/targets.json` and exits non-zero when out of band.
- **Target bands** (initial): in Movement I combat, Idle must **lose** from node 2 onward, Novice wins ≥ 70%, Skilled ≥ 95%, Expert ≥ 99% with an S-grade rate ≥ 50%. Movement III and Dissonance are tuned so the Skilled/Expert gap stays wide. The skill ceiling has to *pay*.
- **Pacing and variance bands:**
  - Skilled-bot boss fights last **3–5 minutes**, with every Decree seen at least twice per fight.
  - For a fixed bot and build, the **coefficient of variation of clear time across seeds is ≤ 0.35**. In the original's planning playtest, the same no-input fight ranged from 18 to 156 s.
- **Provenance.** These bots are the native, headless descendants of the planning playtest's bot ([01 §7](01-findings.md#7-what-its-like-to-play-hands-on-playtest)). That bot had to seed `Math.random` and hand-step a browser loop at a fixed 50 ms to get reproducible runs.
- The harness also answers build questions such as "does any aura/ornament combo dominate across all scenarios?" by running the Skilled bot over N random loadouts and flagging outliers.

## 12. Performance budgets

| Metric | Budget |
|---|---|
| Frame time (mid-range iGPU, 1080p, 150 enemies) | p95 ≤ 16.7 ms |
| Sim tick at 250 entities | ≤ 1.5 ms |
| Draw calls in combat | ≤ 200 |
| Triangles | ≤ 600k |
| React commits during combat | ≤ 20/s |
| Steady-state GC | no per-frame allocations in `sim/`, `render/`, `audio/` hot paths (pools and scratch vectors) |
| Memory over a 40-min run | flat (assets disposed on biome unload; leak check in E2E) |
| Initial download | ≤ 25 MB to title screen; biomes streamed |

## 13. Relationship to the original codebase

This is a **clean rebuild**, not a refactor. The original goes into `reference/original/` read-only. It is used for its palette and fonts, flavour text worth keeping, and a few formulas (reservation efficiency, chorus thresholds) that get re-implemented under test. No original module is imported. The analysis in [01-findings.md](01-findings.md) explains why: the original's combat and state live in two monolithic components, and the remake's core requirements (determinism, headless bots, event-driven feedback) can't be retrofitted into them cheaply.

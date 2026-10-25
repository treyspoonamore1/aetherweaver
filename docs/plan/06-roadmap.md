# 06 — Roadmap, Execution, Risks and Decisions

> The order matters more than the dates. The remake **proves the core combat is fun before building systems on top of it**. That is the inverse of how the original grew ([01-findings.md](01-findings.md)).

Sizes are relative (S < M < L < XL) because the pace depends on how much each session runs in parallel. Every phase ends at a **gate** with explicit exit criteria. Phase 1's gate is a hard go/no-go.

## 1. Phase overview

```
 P0 Foundations ──▶ P1 The Thread (combat slice) ══GO/NO-GO══▶ P2 The Chord (auras, Cue, Crescendo)
      S                    L  (iterate here until fun)                M
                                                                       │
 P7 Polish & ship ◀── P6 Mastery ◀── P5 Full Expedition ◀── P4 The Loom (meta) ◀── P3 The Expedition (Movement I run)
      L                  M              XL                    M/L                       L
```

## 2. Phases

### Phase 0 — Foundations (S)

**Build**
- Scaffold Vite, TS strict, React, Tailwind and three, with ESLint rules (sim purity, no `Math.random` in `sim/` or `meta/`) and CI (typecheck, lint, test, build).
- Sim core: fixed-step clock, RNG streams, entity store and pools, spatial hash, event bus, `Command` API, `hash()`.
- Render shell: stage, camera rig, ground, capsule placeholders, interpolation, quality tiers stub.
- Input: an action map keyed on `KeyboardEvent.code` (layout-independent), pointer-to-ground picking, smart-cast rules, so everything turns into Commands.
- UI shell: zustand store, `HudBridge` at 15 Hz, screen router, design-system tokens.
- Debug: dev panel and perf HUD. Tests: Vitest setup, first determinism golden, and a Playwright boot smoke test.

**Exit**
- A capsule party moves and follows the Weaver.
- A recorded command log replays to an identical hash.
- 200 dummy entities hold 60 FPS.
- CI is green.

### Phase 1 — The Thread: core combat slice (L) 🔴 make-or-break

**Build**
- **Weaver kit:** Thread (Mend/Empower, tension, snap), Ward with Perfect, Chime (Cleanse), Reel, Glide; Spirit pool (no auras yet).
- **Heroes:** Kael, Lyra and Vexis with basic attacks, 2 abilities each, utility AI v1, one quirk each, and text barks.
- **Enemies:** Hollow Chorister, Bell Brute, Lamenter, Glass Lancer and Mute; elite affix *Shielded*.
- **Pipelines:** damage, heal and status (Dirge mark, silence); threat tables with healing aggro.
- **Telegraph layer:** circle, cone, line and mark shapes, with live severity, answer glyphs and Perfect rim. Party frames get the incoming-damage forecast.
- **Ledger v1:** counterfactual saves, amp share and mitigation; a 3 s per-encounter highlight; death recap.
- **Juice v1:** the full Perfect Ward stack ([04 §3](04-presentation.md#3-feedback-juice-specification)), aggregated numbers with gold chips, thread ribbon shader, telegraph shader, trauma shake.
- **Audio v1:** buses plus limiter, and support SFX pitched to a fixed key over one loop.
- **Content:** one arena (Reliquary hall), a 3-wave encounter script, and the Bellwarden mini-boss as a stretch goal.
- **Harness v1:** Idle, Novice and Skilled bots.
- **Spike:** three.quarks vs. a custom pooled particle system, and decide.

**Exit (go/no-go)**
- Harness:
  - Idle loses during wave 2.
  - Novice wins at least 60% of the time.
  - Skilled wins at least 90%.
  - The Skilled bot's Weaver share of party output is at least 35%.
- Playtest with 5 people, or the user plus friends, for 10+ minutes each:
  - at least 4 of 5 say Perfect Ward and Reel moments feel *great*;
  - each can name something they did that mattered;
  - nobody says the heroes "play themselves".
- Perf budgets met in the slice.
- **If any of these fail, iterate inside Phase 1.** Do not start Phase 2.

### Phase 2 — The Chord: build layer inside combat (M)

**Build**
- Spirit reservation; 6 auras (Sostenuto, Ostinato, Allegro, Fortissimo, Lullaby, Fermata); field shader with rim lights; suppression.
- 4 ornaments: Grace Note, Reverb, Unison, Pedal Point.
- Resonance, Solos, Cues and Crescendo, with Luminary's *Sunrise* first.
- The Directive wheel.
- HUD v2: the full combat HUD.
- Settings v1: remapping, shake/flash sliders, colour-blind palettes, UI scale, 12 px minimum text.
- Harness: a build-diversity report.

**Exit**
- Three distinct loadouts are each viable for the Skilled bot.
- Playtesters can describe how the loadouts *play* differently.

### Phase 3 — The Expedition: a full Movement I run (L)

**Build**
- Map generation for Movement I, with every node type and reward previews.
- 40 motifs plus 4 Harmonies; 15 relics; 6 events; the Aether economy.
- Full Movement I roster (6 enemies) plus 4 elite affixes.
- Encounter director v2: role quotas, double-threat scheduler, readability cap.
- The Hollow Cantor (3 phases) and the Bellwarden.
- Grades and run summary v1 (timeline plus ledger).
- Save v1: profile and run-resume, zod and migrations, backup-before-overwrite, save on `pagehide`.
- The Prelude onboarding run.
- Music director v1: Movement I stems, key and chord, pitched SFX tied to music.

**Exit**
- Prelude plus Movement I takes 10–12 minutes.
- Five consecutive runs feel different to playtesters.
- Movement I harness bands are met.
- A first-time player finishes the Prelude without outside help.

### Phase 4 — The Loom: meta progression (M/L)

**Build**
- Hub stations; Weaver Rank and the unlock schedule; Starlight.
- The Astrolabe: about 64 nodes and 6 keystones, with free respec.
- Callings Luminary and Martyr, with paths and mastery.
- Bonds for the 3 starters: ranks, talents and 2 scenes each.
- The Reliquary: enshrine, carry, and Inscribe/Retune/Ascend with Instability.
- Training Grounds (including the Perfect-Ward trainer) and the Codex.

**Exit**
- The pacing model for the first 3 hours matches the schedule in [02 §9](02-game-design.md#9-meta-progression-the-loom).
- In new-player tests, every station is understood on first contact.
- The raw-power cap (+30%) holds in the harness.

### Phase 5 — Full Expedition: content (XL)

**Build**
- Movements II and III plus the Finale: biomes, 10 more enemies, 4 elite affixes, 2 mini-bosses, and the Vharun, Unweaver and Silent Conductor bosses (including the Grand Silence).
- Heroes Brann, Seren and Oro; Callings Chronomancer and Conductor.
- Bring every content category up to its 1.0 count ([03 §12](03-content-bible.md#12-content-targets-per-phase)).
- Biome music and boss phase stems.
- This phase parallelises well (§3): content authoring fans out by category, with content lint and the harness as guards.

**Exit**
- A full run takes 30–40 minutes.
- Harness bands are met across all Movements.
- At least 5 builds are viable at Dissonance 0.
- Content lint is clean.

### Phase 6 — Mastery: endgame (M)

**Build**
- Dissonance (15 levels).
- The Atlas of Echoes.
- The weekly seed, with share codes and replay verification.
- Deeds.

**Exit**
- Expert-bot clear rates sit in target bands per Dissonance tier.
- A seeded replay reproduces bit-for-bit on the same browser.

### Phase 7 — Polish and ship (L)

**Build**
- Custom Weaver and bosses, an art pass, VFX and animation polish, VAT crowds if profiling needs them.
- Final audio: licensed or commissioned stems, plus bark vocalisations.
- An accessibility audit: colour-blind simulation, full remapping, gamepad, UI scale, reduced motion.
- Localization readiness.
- A performance pass on target hardware, plus asset streaming.
- Balance from the harness plus playtests.
- Distribution: a static web build, with an optional Tauri desktop wrapper.

**Exit:** the release checklist (§6) is all green.

## 3. Execution with subagents

The user asked about subagents. This is how the build would actually parallelise without collisions.

**Roles**
- **Director** (the main session): owns the contracts, task breakdown, integration, reviews and the pillar tests at every gate.
- **Contracts are frozen early**, in Phase 0: `sim/api.ts`, `sim/events.ts`, `content/schema.ts`, `content/effects.ts`, `ui/store.ts` (the snapshot shape) and the render `View` interface. Every workstream codes against them, which is what makes parallel work safe.

**Workstreams**, each a subagent in its own git worktree and branch, delivering PR-sized tasks with tests:

| Workstream | Owns | Can start in parallel once… |
|---|---|---|
| Sim and gameplay | `sim/` systems, AI, encounter scripts | Phase 0 contracts exist |
| Render and VFX | `render/`, shaders, camera | the event and snapshot contracts exist (it develops against **recorded event streams** from the sim) |
| UI and HUD | `ui/` | the snapshot shape exists (it develops against **mock snapshots** and a Storybook-style gallery) |
| Audio | `audio/` | the event contract exists |
| Content | `content/` data from [03](03-content-bible.md) | the schema and effect vocabulary exist; fans out by category |
| QA and balance | tests, harness, bots, Playwright | the sim API exists |

**Cadence**
- Each task ships with acceptance tests.
- A task is done only when CI is green: typecheck, lint, unit, scenario, determinism goldens, content lint, a short harness run, and the E2E smoke test.
- The `code-review` skill runs per PR. The Director merges.
- At each gate, the user gets a playable build plus screenshots or a short clip and the harness summary, and makes the go/no-go call.

**What not to parallelise:** Phase 0 contracts (one author) and Phase 1 *feel tuning*, which needs one coherent hand iterating on numbers, timing and juice together.

## 4. Definition of done (any task)

- [ ] Tests added or updated, and CI green.
- [ ] No new per-frame allocations in hot paths; perf HUD budgets still met.
- [ ] No console errors or warnings in the E2E smoke.
- [ ] Player-facing strings go through `t()`, and the new UI meets the 12 px minimum and contrast rules.
- [ ] New content passes lint, with answer tags, synergy tags and sanity ranges.
- [ ] If sim behaviour changed: goldens updated deliberately, with the harness diff attached.

## 5. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Core combat isn't fun enough | M | Critical | Phase 1 go/no-go gate; iterate before building systems; the juice spec doubles as a checklist |
| Ally AI feels dumb and players blame it | H | H | Utility AI with debug overlay; quirks are *announced* and consistent; Directives; Bond talents tune quirks; AI scenario tests |
| Visual noise hides telegraphs | M | H | The telegraph layer always renders on top; VFX intensity budget; spotlight dimming; a high-contrast mode |
| Systems sprawl again (the original's failure mode) | H | H | Progressive disclosure is a rule; every new system must pass the pillar-5 test ("does it change how you play?"); content counts are capped per phase |
| Browser performance with crowds and post FX | M | M | Budgets in CI, instancing and pooling, quality tiers, dynamic resolution, VAT as a fallback |
| Determinism drifts and breaks replays and seeds | M | M | RNG streams, lint bans, golden tests, content version stamped in replays |
| Art inconsistency from mixed asset packs | M | M | Stay inside one kit family (KayKit); a shared palette texture; biome LUTs; custom key assets |
| Music quality (procedural sounds cheap) | M | M | Treat music as licensed or commissioned stems from Phase 5; procedural only for prototyping |
| Balance complexity (90 motifs × 4 Callings × 6 heroes) | H | M | The bot harness with build-diversity reports; synergy tags; Harmonies gated by prerequisites |
| IP exposure from PoE-derived names | already present | M (if published) | The musical rename ([03 §0](03-content-bible.md#0-naming)) |

## 6. Release checklist (1.0)

- [ ] All pillar tests ([02 §2](02-game-design.md#2-design-pillars)) pass on the release build.
- [ ] Harness bands are met in every Movement and in Dissonance tiers 0/5/10/15.
- [ ] Perf budgets ([05 §12](05-technical-architecture.md#12-performance-budgets)) are met on the reference laptop.
- [ ] Accessibility options from [04 §8](04-presentation.md#8-accessibility) are complete and tested with colour-blind simulation.
- [ ] Save migration has been tested from every pre-release version, and export/import works.
- [ ] Zero console errors across a full scripted run.
- [ ] Asset licences are recorded in `assets/licenses/`.

## 7. First session, if you say "go"

1. Create the repo and copy the original to `reference/original/` (read-only).
2. Phase 0 scaffold and contracts: `sim/api.ts`, `sim/events.ts`, `content/schema.ts`, `ui/store.ts`.
3. Write the sim core with determinism golden test #1, and render capsules following the Weaver.
4. Then open Phase 1 with the **Ward and Perfect Ward vertical**: one Bell Brute, Kael, the telegraph shader, the hit-stop and the bell. Tune it until it feels right before anything else. It is the heart of the game.

## 8. Decisions for you

These are the choices that change the plan. Each has a recommendation; the plan assumes the recommended option.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | **Structure** | (a) **Roguelite Expeditions + persistent meta** · (b) persistent ARPG like the original (endless maps and gear) | **(a)**. It gives sessions a shape, decisions every few minutes, and measurable difficulty. If you choose (b): Expeditions become Atlas maps, motifs become persistent "glyphs" on relics, and the Reliquary becomes the main gear loop. Combat, heroes, telegraphs, ledger, auras/ornaments, Callings and presentation all carry over unchanged |
| 2 | **Naming** | (a) musical rename · (b) keep PoE-style names | **(a)**. It reinforces the theme and removes the IP risk. Names are placeholders either way |
| 3 | **Platform** | (a) browser-first (+ optional desktop wrapper) · (b) desktop/Steam-first | **(a)**. It's the original's platform and the cheapest to iterate on; Tauri can wrap it later |
| 4 | **Art** | (a) CC0 kits + custom Weaver and bosses · (b) fully custom · (c) stylised primitives | **(a)**. It looks like a real game in Phase 1 and costs little |
| 5 | **Music** | (a) licensed/commissioned stems · (b) procedural | **(a) for ship, (b) for prototyping** |
| 6 | **Scope** | build to 1.0 · stop after Phase 3 (a polished Movement I) and reassess | **build the Phase 3 slice, then reassess** with real playtest data |

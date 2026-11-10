# Phase 7: Polish and ship

*2026-11-10 · design and build spec · written at 6a2b5eb (main: all of Phase 6, merged, reviewed and tuned, and the Version 14 demo notes) · plan: [06 Phase 7](plan/06-roadmap.md) (lines 139-150: the Build list and its exit, "the release checklist (§6) is all green"), [06 §4](plan/06-roadmap.md) (the definition of done), [06 §5](plan/06-roadmap.md) (risks), [06 §6](plan/06-roadmap.md) (the release checklist), [06 §8](plan/06-roadmap.md) (decisions 3-5: platform, art, music), [04 §1, §4, §8](plan/04-presentation.md) (art sourcing, audio sourcing, accessibility), [05 §5, §7, §8, §10, §12](plan/05-technical-architecture.md) (rendering, localization, saves, testing, performance budgets), [02 §2](plan/02-game-design.md) (the pillars and their tests) · follows [Phase 6](phase-6.md) and the [playtest demo](demo.md) (Version 14)*

Phase 7 is the last phase. The roadmap lists seven pieces of work:

- **Art:** a custom Weaver and bosses, an art pass, VFX and animation polish, and VAT crowds if profiling needs them.
- **Audio:** licensed or commissioned stems, and bark vocalisations.
- **Accessibility:** an audit covering colour-blind simulation, full remapping, gamepad, UI scale and reduced motion.
- **Localization readiness.**
- **Performance:** a pass on target hardware, and asset streaming.
- **Balance:** from the harness and from playtests.
- **Distribution:** a static web build, with an optional Tauri desktop wrapper.

Its exit is that the release checklist (06 §6) is all green.

Much of this already exists in part. Some of it cannot be done without the owner, without money, or without hardware this environment doesn't have. This doc audits each item against the code, says what can honestly be built and proven here, and splits the rest into decisions with defaults that need none of those three. The owner may be away. Every workstream below can finish on the defaults.

This doc is the spec. Implementers build from it and their brief.

## Decisions for you

Each row is a choice that changes what gets built. The rest of the doc follows the recommended default. Any row can be overridden. Every default can be built without you, without new money and without a new third-party asset.

| # | Question | Options | Recommended default |
|---|---|---|---|
| 1 | **Art.** The plan's art decision (06 §8, decision 4) was CC0 kits plus a custom Weaver and bosses. The game has never used a kit: every model is built in code from primitives (`src/render/models/library.ts:7-11`, "Procedural low-poly silhouettes (primitives only, no assets)"). | (a) keep the procedural look, and polish inside it: readability fixes, motion and the open look items (W6); (b) CC0 kits (KayKit, Quaternius) as 04 §1 names them; (c) a commissioned Weaver and bosses | **(a).** (b) brings new third-party assets, a licence check (04 §1 itself flags Quaternius's) and a new loading pipeline (glTF, compression, streaming). (c) needs money. Each would also move every render snapshot and draw-call pin. |
| 2 | **Music.** The plan says licensed or commissioned stems for ship, synthesis for prototyping (06 §8, decision 5; 04 §4.3). Every sound today is synthesised in WebAudio (`src/audio/synth.ts`, `music.ts`, `sfx.ts`), with no sample files. | (a) keep the synthesised score and polish its mix (loudness, voice caps, ducking; W7); (b) licensed stems; (c) commissioned stems | **(a).** (b) and (c) need money and new assets, and the music director's stem and key logic (`src/audio/music.ts`) would need a sample path it doesn't have. |
| 3 | **Bark vocalisations** (04 §4.3: "short non-verbal vocalisations"). Barks today are text only (`Bark` event, `src/sim/events.ts:594-598`). | (a) none: text barks as today; (b) short synthesised non-verbal "voices", one timbre per hero built from the existing synth, on a new barks bus with its own slider, **off by default**; (c) recorded or licensed voices | **(b), off by default.** It can be built with no asset, and the release sounds exactly as today until you turn it on. Nobody has judged the game's sound by ear (docs/phase-6.md, *Not verified*), so new sounds don't go on by default. |
| 4 | **Gamepad scope.** Today a gamepad works on the Title, the Loom and the Atelier only (`useGamepadMenu`, `src/ui/kit/menuNav.ts:137-179`; demo.md: "fights don't yet"). | (a) every menu screen, plus combat on a standard-mapping pad as 04 §8 lays it out (left stick moves; right stick steps a reticle between heroes; triggers for Thread and its mode; face buttons for techniques; d-pad for Directives), with remappable pad buttons and generic button labels; (b) menus only; (c) as today | **(a).** Pad input becomes the same `Command`s as keyboard input, so the sim doesn't change (ground rule 3). No rumble, and no per-brand button art. |
| 5 | **Remapping scope.** All 25 actions are remappable to keys (`src/input/actions.ts:5-30`; Settings → Controls lists each, `src/input/bindings.ts:173`). The mouse-button roles and the Shift modifier for Cue-by-slot are hard-wired (`src/input/InputController.ts:279`, `:398-406`). | (a) also the mouse roles (Thread on click, Mend ⇄ Empower, the wheel) and the Cue modifier; Escape stays fixed as pause (`FIXED_KEYS`, `bindings.ts:24`); menu keys (Enter, arrows, Escape, and the digit and R shortcuts on the Draft, Respite, Calling and Scene screens) stay fixed and are listed in Controls; (b) keys only, as today | **(a).** "Full remapping" in 04 §8 covers what plays the game. Menu keys are browser-standard. |
| 6 | **UI scale range.** 80-150% today (`src/app/settings.ts:90`). Above 100%, it is capped by the window: never wider than 1,280 px per 100% (`fittedScale`, `src/ui/presentation.ts:17-21`). | (a) keep 80-150% and the width fit, and make 100% meet the 12 px minimum; (b) widen to 70-200% | **(a).** It is the plan's range. |
| 7 | **Localization: which languages?** | (a) readiness only: every player-facing string goes through one text layer, numbers and plurals through one formatter, and a lint holds the line; English ships, with one pseudo-locale for testing; (b) also ship one translation | **(a).** A translation needs a translator, which needs money. The pseudo-locale proves readiness without one. |
| 8 | **Reference hardware** for the performance budgets (05 §12: "mid-range iGPU, 1080p, 150 enemies"). No phase has named the "reference laptop" the release checklist asks for. This environment has a headless Chromium rendering with SwiftShader (on the CPU) on 4 cores. That is not a reference laptop. | (a) the budgets stay 05 §12's. Here we measure what this machine can show honestly: the sim in Node; CPU frame time, draw calls, triangles and React commits in headless Chromium. GPU frame time on a real iGPU is recorded as **not provable here**. W4 builds a bench page you can open on any laptop to read the numbers. Quality stays `high` by default, as today; `auto` is offered but is not the default until it has been measured on real hardware. (b) name a laptop now and hold the release until it is measured | **(a).** |
| 9 | **Offline support.** There is no service worker and no manifest (searched `src/`, `index.html`, `vite.config.ts`). | (a) none: a static build only; (b) a service worker that precaches the build, versioned by build | **(a).** A cached old build would read every newer weekly replay as "another version" (docs/phase-6.md, decision 8), and cache invalidation needs its own tests. Revisit it together with distribution. |
| 10 | **The Tauri desktop wrapper** (06 §2: "optional"). | (a) not built; W8 writes down what it would need; (b) built | **(a).** Signing, installers and three web views to test (WebView2, WKWebView, WebKitGTK) are outside what can be proven here. |
| 11 | **Save export and import** (06 §6; 05 §8: "Export/import uses a compressed base64 string"). None exists. Only the dev panel can download a fight replay (`src/debug/DevPanel.tsx:41-49`). | (a) build it: a file and a text code holding the profile, the settings and any run in progress. Import goes through the same loaders, after backing up the current saves. A save that won't load is kept raw and offered for export (05 §8). (b) file only; (c) not built | **(a).** |
| 12 | **The playtest demo's two starts** (Fresh and Veteran) in the release build. | (a) no: the release build has no demo choice, as today (`DEMO` is false outside `build:demo`, `src/app/demo.ts:12-13`; pinned by the e2e test at `e2e/smoke.spec.ts:1682`). The demo stays a separate build. (b) keep a Veteran start in the release | **(a).** |
| 13 | **What "1.0" means for the open balance items** (gathered under *Audit, Balance*: about forty items from Phases 5f, 5g and 6, each already listed for you). | (a) ship them as they are. The gathered list becomes the release's known balance notes, and Phase 7 moves no existing number; (b) hold 1.0 until you have decided each | **(a).** Every item already has its readings and options in its own phase doc. W9 re-reads the bands on the release candidate, so the notes carry current numbers. |
| 14 | **Telemetry.** There is none. The game makes no network request at all (no `fetch`, `sendBeacon`, `XMLHttpRequest` or `WebSocket` in `src/`). | (a) none; (b) opt-in anonymous metrics | **(a).** It would need a server and a privacy notice. |
| 15 | **Assists the plan lists that don't exist** (04 §8). Each falls into one of two kinds. | (a) build those that are input- or presentation-only. These are: game speed 70-100% (the runtime's clock, not the sim's); Auto-Thread (the input layer sends ordinary `thread` commands after 2 s with no input); hold-or-toggle for Thread mode and the wheel; mouseover casting off; answer glyphs off; "important numbers only"; telegraph opacity, outline and Perfect-band width; a high-contrast telegraph mode; turning off the slow-motion vignette. Leave the sim-side ones unbuilt: a hit-stop or slow-mo toggle (the sim's own `world.timeScale`, which is hashed, `src/sim/hashing.ts:20`, `src/sim/api.ts:86`), and the plan's Perfect window +0.25 s and early-Movement-only +15% wind-up (new assist values the run verifier would refuse, `ASSIST_VALUES`, `src/meta/runReplay.ts:81-86`). (b) also the sim-side ones, with a `SIM_VERSION` decision | **(a).** Nothing in (a) changes a fight's result for the same commands. |
| 16 | **The assist badge** on the Summary reads the assists in Settings when the Summary opens (`src/ui/screens/SummaryScreen.tsx:1198-1203`), not what the run's fights used. | (a) the run records that a fight used an assist (an optional run-save key, absent until true, so the run save stays 5); the badge reads that; game speed and Auto-Thread count too; (b) as today | **(a).** "Assists show as a small badge on the run summary" (04 §8) means the run's assists. |
| 17 | **The dev panel, the test hook and the labs in the release build.** The dev panel opens on Backquote in any build (`src/input/actions.ts:64`). The test hook installs with `?e2e=1` (`src/app/testHook.ts:29`). The labs open with `?lab=` (`src/app/App.tsx:49`). | (a) keep them: the e2e suite runs against the production build (`playwright.config.ts`, `webServer`); they act only on the player's own device; the run verifier already refuses a debug command (docs/phase-6.md, *Tests*, "Run replays"); (b) strip them with a build flag and run e2e against a test build | **(a).** W8 records it in the release notes. |
| 18 | **Key names written into content text.** One content text names a key: the Martyr's "Bear (B)" (`src/content/callings.ts:100`). Content text is hashed into `contentVersion` (`src/content/index.ts:166-172`). | (a) leave the content text as it is; wherever the UI shows that Calling, it shows the live binding beside it; (b) change the text to a placeholder and accept one `contentVersion` move | **(a).** |

**Needs you in person: any change to an aura's or ornament's look or sound.** Polishing the art, VFX and audio could touch how an aura or ornament looks or sounds (the field's rings, its colours, the beam song on the Thread, Fermata's hold, the chips and cards that draw them, their sounds). **Default: Phase 7 touches no aura and no ornament, visually or audibly.** Every workstream can finish without it. An aura presentation pin, recorded before any change (ground rule 5), proves it. The accessibility audit found two places where an aura's visuals don't follow a comfort setting: the field (`src/render/field.ts`) and Fermata (`src/render/fermata.ts`) take no Flashes value (`src/render/combatView.ts:205`, `:218`). Neither honours reduced motion. Both are left as they are and listed here for you. Small HUD text on aura and ornament elements is also left as it is (*Audit, Accessibility*).

**Held for you from earlier phases (unchanged, not built):**

- Phase 5g's W7: four auras (Requiem, Staccato, Cantabile, Rubato), six ornaments (Sforzando, Descant, Echo, Counterpoint, Martyr's Tithe, Syncopation), and their six motifs, one Harmony and one relic (`docs/phase-5g.md`, decision 1 and *W7*; *Open, for the owner* item 1). Also 5g's aura line (decision 2; *Open* item 2).
- Phase 6's decision 5: Echo twists that shrink or weaken auras; an Echo that forces Muted Choir on; Tyrant or Mimicry borrowing a mechanic that silences auras (`docs/phase-6.md`, decision 5).
- Phase 6's held Tyrant entry: the Seamstress's phase 1 borrowing the Shears' Shearing Dash, which cuts the Thread the beam song rides (`docs/phase-6.md`, *Held for the owner (aura reach)*; *Open* item 9).

## Words used here

- **Pin**: a committed file or literal that a test or a tool's `--check` compares byte for byte. A **golden** is a pinned hash of a scripted fight (`tests/sim/golden.json`).
- **Presentation-only**: changes what the player sees or hears, or which commands their input becomes. It never changes what the sim does with a given list of commands.
- **Text layer**: the one module that every player-facing string passes through on its way to the screen (W0, `src/ui/text/`).
- **Pseudo-locale** (`en-XA`): English, with accents added, brackets around it and 30% padding. It shows any string that skipped the text layer, and any layout that can't grow.
- **Aura presentation pin**: a recorded fingerprint of how every aura and ornament draws and sounds, used as an existing render or audio snapshot is (ground rule 5).
- **Reference laptop**: 05 §12's "mid-range iGPU, 1080p". Not available here (decision 8).

## Audit: what exists today

Each item is marked **done**, **partial** or **missing**, with its evidence. "Ran" names a command run for this doc, at 6a2b5eb, in this worktree. Scratch output is in `/home/user/aw-work/7/`.

### Accessibility (04 §8)

| Item (04 §8) | Status | Evidence |
|---|---|---|
| Colour-vision palettes for telegraphs and meaning colours | **done** | Protanopia, deuteranopia and tritanopia palettes (`src/app/colorVision.ts:7`, `:34-74`). They are applied live to the HUD's CSS (`applyVisionCss`) and to render (`src/render/combatView.ts:193`). |
| … tested with colour-blind simulation | **partial** | `tests/colorVision.test.ts` simulates each vision type with the Machado matrices (`colorVision.ts:134`) and checks pairs by CIE76 ΔE: the critical pairs at ≥ 20 under each palette (`colorVision.ts:77-83`), and every biome, hero, affix and Finale colour against the meaning colours, Phase by Phase (96 tests; ran `npx vitest run tests/colorVision.test.ts --maxWorkers=2 --reporter=verbose`: all passed). It checks colours as values. It never checks a rendered frame. Two known misses stand: the Atlas station's mint against Training's cyan under tritanopia (4.6 ΔE), and the borrowed accent ring (docs/phase-6.md, *Open* items 6 and 7). |
| Shape or glyph paired with every colour | **partial** | A rule kept per phase (docs/phase-5d.md onward; demo.md "Playing with the sound off"). There is no global test. |
| Telegraph opacity, outline thickness, Perfect-band width, high-contrast telegraph mode | **missing** | None in Settings (`settings.ts:79-108`). The telegraph impact flash isn't scaled by Flashes either (`src/render/telegraphs.ts:437`). |
| UI scale 80-150% | **done** | `uiScale` 0.8-1.5 (`settings.ts:90`); it sets the root font size, and everything is sized in rem (`src/ui/presentation.ts:1-27`). Above 100% it is capped by the window (decision 6). Tested in `tests/uiScreens.test.ts`. |
| 12 px minimum text at 100% | **partial** | Not met. 50 Tailwind text sizes under 12 px outside the labs (11 at 10 px, 38 at 11 px, 1 at 11.2 px) in 16 files: ReliquaryScreen 14, WardTrainer 6, ReliquaryParts 6, ConductParts 4, DissonanceParts 3, WeaverBar 3, PartyFrames 3, ChordBuilder 2, CallingChip 2, and one each in TrainingParts, TechniquesParts, ReliquarySummary, ReliquaryCodex, DraftScreen, ThreadDial, RelicBar. Ran: `grep -rnoE "text-\[[0-9.]+(px|rem)\]" src` filtered to sizes under 12 px, excluding `/lab/`. The world overlay's chips are sized in em (`src/render/overlay.ts:497-504`). No test enforces the minimum. |
| WCAG AA contrast for labels | **partial** | Four test files each carry their own copy of a contrast function and check their phase's colours at 4.5:1 (`tests/uiPhase4c.test.ts:181`, `uiPhase4d.test.ts:152`, `uiPhase4e.test.ts:95`, `uiPhase4f.test.ts:79`). Nothing checks the design tokens as a whole. |
| Screen shake 0-100% | **done** | `screenShake` (`settings.ts:83`) scales the camera's trauma (`src/render/camera.ts:24`, `:39`, `:88`; `src/app/runtime.ts:319`). |
| Flashes and chromatic pulses off | **partial** | `flashes` 0-1 (`settings.ts:85`) scales the overlay's full-screen flash, chromatic and danger pulses (`overlay.ts:364-365`, `:649-651`, `:1177-1356`), and the in-world flares of twelve views (`combatView.ts:222-233`, `flareScale`, `src/render/relicCues.ts:100`). It does **not** reach: telegraph impact flashes (`telegraphs.ts:437`); the Thread and calls views (`combatView.ts:208-209`); feedback's particle bursts (`src/render/feedback.ts` reads only `damageNumbers`, `:1313-1875`); and the aura field and Fermata (`:205`, `:218`, held for you). |
| Reduced-motion UI | **partial** | Only the operating system's setting is read. There is no in-game switch. The stylesheet cuts every CSS animation to 0.01 ms (`src/index.css:278-285`). `src/ui/kit/motion.ts:3-18`'s helpers cover timed reveals in eight components. Rank, ReliquaryScreen, WithoutYou and AstrolabeMap read the media query directly, and AtlasParts, BondsParts and ReliquaryParts carry their own CSS rules for it. Nothing in `src/render` reads it (searched). No test exercises it except `tests/uiConducting.test.ts`. No person has watched it (docs/phase-6.md, *Not verified*). |
| Hit-stop and slow-mo toggles | **missing** | Hit-stop and slow-mo live in the sim (`world.timeScale`, set by `src/sim/combat/feedback.ts:39-66`, used as the step, `src/sim/api.ts:86`, and hashed, `hashing.ts:20`). A toggle would change fights (decision 15). The overlay's slow-mo vignette (`combatView.ts:260`) is presentation and could be toggled. |
| Game speed 70-100% | **missing** | Only the dev panel's `devTimeScale` (`runtime.ts:163`, `:285`). |
| Perfect window +0-0.25 s; telegraph lead | **partial** | `perfectWindowBonus` 0 / 0.1 / 0.2 and `telegraphLead` ×1 / 1.25 / 1.5, in every Movement (`settings.ts:13-20`). The plan's +15% in early Movements only is not built. |
| Hero Autonomy | **done** | `assists.autonomy` (`settings.ts:19`; docs/hero-autonomy.md). |
| Mouseover casting toggle; hold-or-toggle Thread mode | **missing** | Smart-cast always takes the hovered hero, else the threaded one (`InputController.ts:236-238`). Thread mode toggles on each press (`:283-285`, `:405-406`). The Directive wheel is hold-only (`:425-458`). |
| Answer glyphs off; "important numbers only"; Auto-Thread | **missing** | Answers are hidden only by the Blind Score Dissonance level (`src/render/dissonanceCues.ts:84`). `damageNumbers` is on or off only (`settings.ts:86`). There is no Auto-Thread. |
| Bus sliders | **partial** | Master, music, effects and interface (`settings.ts:81`). The engine has an ambience bus that follows the effects slider (`src/audio/engine.ts:198`). There is no barks bus. |
| Captions for sounds that carry meaning | **partial** | `captions` (`settings.ts:107`, off by default) covers four Finale sounds only (`finaleCaption`, `src/ui/hud/finaleLook.ts:261-275`; `runtime.ts:849-856`). There are none for telegraph wind-ups ("Brass windup, left", 04 §8), Tyrant's edict, the Postlude, or the low-life sound. |
| Pause anywhere | **done** | In a fight on Escape or P; Escape can't be unbound (`actions.ts:63`, `bindings.ts:24`). A hidden tab stops the clock (`runtime.ts:873-878`). Menus are not real-time. |
| Assists never block achievements; a badge on the Summary | **partial** | The badge exists (`SummaryScreen.tsx:405`) but reads Settings when the Summary opens (`:1198-1203`; decision 16). |

**Settings and runs.** Settings are per device, in `localStorage` under `aetherweaver.settings` (`settings.ts:171-189`), version 4. Captions were added later with a default and no version bump (`:102-107`). Older versions migrate (`migrateSettings`, `:149-169`; tested in `tests/meta/migration.test.ts:450-537`). Two settings reach a run, and both are recorded:

- **The assists.** Each fight's config takes `{ ...settings.assists }` (`src/app/runStore.ts:670`). The sim resolves exactly three keys (`src/sim/world.ts:347-351`), hashes the config (`hashing.ts:16`), and the run replay's assists schema is strict (`runReplay.ts:155-158`). So **any key added to `settings.assists` would reach every fight's config and fail every replay's schema**. A new assist must live outside that object (ground rule 3).
- **Skip the unlocks** (`unlockAll`). It reaches the run through the allowance at four steps, each recorded in the run replay (docs/phase-6.md, ground rule 8).

### Input: remapping and gamepad

- **Keys: done.** 25 actions, keyed on `KeyboardEvent.code` so they hold on any keyboard layout (`actions.ts:1-66`). There are up to three keys an action, conflicts swap or clear, and an action can be reset (`bindings.ts:27-128`, tested in `tests/uiBindings.test.ts`, 12 cases). Overrides are stored as `settings.bindings` (`settings.ts:97`). On-screen key labels follow the bindings in the HUD and How to Play (`src/ui/hud/labels.ts`, `src/ui/hud/HowToPlay.tsx:100`).
- **Not remappable:** left click threads the hovered hero, right click toggles Mend ⇄ Empower, middle click opens the wheel or Focuses (`InputController.ts:392-407`); Shift + a number Cues (`:279`); Escape pauses (fixed). Menu screens use fixed keys: digits on the Draft (with R to reroll), Respite, Calling and Scene screens (`src/ui/screens/DraftScreen.tsx:38-49`, `RespiteScreen.tsx:76-84`, `CallingScreen.tsx:88-90`, `SceneScreen.tsx:48`), and arrows, Enter and Escape elsewhere.
- **Fixed key names in UI text:** the Codex's technique entries name Q, E, F and Space whatever the bindings (`src/ui/screens/CodexScreen.tsx:789-822`); one content text names B (decision 18). (The Draft screen's R, `DraftScreen.tsx:88`, is its own fixed shortcut, not a binding.)
- **Gamepad: partial.** Standard mapping, menus only, on three screens (Title, Loom, Atelier). The d-pad or left stick sends arrows, A sends Enter and B sends Escape. It polls only while a pad is connected (`menuNav.ts:91-179`). `navigator.getGamepads` appears nowhere else (searched `src/`). There is no pad input in a fight, no pad bindings, and no test of the hook.

### Localization readiness

- **Text layer: missing.** There is no `t()`, catalogue or locale anywhere (searched for `i18n`, `t(`, `useTranslation`). 06 §4's definition of done ("Player-facing strings go through `t()`") has not been met by any phase.
- **Where the strings are**, counted with a rough scanner. It counts multi-word string literals and JSX text, skips class names, test ids and labs, and misses one-word labels (ran `node /home/user/aw-work/7/strings.mjs ui content meta app render audio sim`):

  | Folder | Files | JSX text | String literals | Template literals with words |
  |---|---|---|---|---|
  | `src/ui` | 164 | 928 | 1,097 | 1,249 |
  | `src/content` | 42 | 0 | 1,427 | 287 |
  | `src/meta` | 18 | 0 | 168 | 84 |
  | `src/render` | 62 | 0 | 98 | 52 |
  | `src/sim` | 72 | 0 | 50 | 30 |
  | `src/app` | 23 | 6 | 43 | 23 |
  | `src/audio` | 12 | 0 | 11 | 0 |

- **Hashed text.** Content text is part of `contentVersion` (`contentVersionOf` stringifies the whole of `CONTENT`, `src/content/index.ts:166-172`). Some sim strings are in hashed world state: the boss decree's name and text (`src/sim/state.ts:960`; e.g. `src/sim/systems/bosses.ts:86-137`). Barks travel as English lines in events (`events.ts:594-598`). So localization must **translate at display time by id, never by editing content or sim text** (ground rule 7).
- **Formatting: partial.** There is one shared helper (`src/ui/kit/format.ts`): `fmt` uses `Intl.NumberFormat('en-US')`, `pct` uses `toFixed`, `clock` builds "m:ss", and `plural` is English-only (`n === 1 ? one : many`), used at 51 call sites, with 25 more inline `=== 1 ? '…'` choices. There are 104 `toFixed` calls in 41 files and 8 `toLocaleString('en-US')`. No dates are shown (no `new Date(` in `src/`).
- **Built by concatenation:** no `+` concatenation of strings found by the scanner. Sentences are built in templates instead (1,249 in `src/ui`), often with English word order and possessives (`possessive`, `format.ts:23`).
- **Fonts' glyph coverage** (from the build's font files): Cinzel 600/700 covers Latin and Latin Extended only. Inter 400-700 covers Latin, Latin Extended, Cyrillic (and extended), Greek (and extended) and Vietnamese. JetBrains Mono 500 covers Latin, Latin Extended, Cyrillic, Greek and Vietnamese. None covers CJK, Arabic, Hebrew or Devanagari. Imports are at `src/main.tsx:1-7`; each subset loads on demand by unicode-range. `index.html` declares `lang="en"`.

### Performance (05 §12)

| Budget | Status | Evidence |
|---|---|---|
| Frame time p95 ≤ 16.7 ms (mid-range iGPU, 1080p, 150 enemies) | **partial; not provable here** | The perf HUD shows it (`src/debug/PerfHud.tsx:8-21`, budgets alongside, F3). The e2e perf test spawns 13 enemies and 120 dummies in Training and asserts CPU frame p95 < **25** ms (`e2e/smoke.spec.ts:505-544`, `:542`). Under SwiftShader, GPU time can't be measured (`:541`). |
| Sim tick ≤ 1.5 ms at 250 entities | **done** | `npm run sim:bench -- --check` runs in CI (`.github/workflows/ci.yml`). Ran it: "crowd" (250 entities) avg 0.124 ms, p95 0.186, p99 0.530; the seven fight scenarios p95 0.027-0.123 ms; "✔ within budget" (`/home/user/aw-work/7/simbench.txt`). |
| Draw calls ≤ 200 | **partial** | The e2e busy fight asserts ≤ **220** (`smoke.spec.ts:537`, `:2003`). The per-feature render tests pin "no new draw call" (e.g. `tests/renderPhase6.test.ts:591`). |
| Triangles ≤ 600k | **partial** | Shown on the perf HUD; never asserted. |
| React commits ≤ 20/s in combat | **done** | Asserted in the e2e busy fight (`smoke.spec.ts:543`); the HUD bridge samples at 15 Hz. |
| No per-frame allocation in `sim/`, `render/`, `audio/` hot paths | **partial** | A convention, kept by pools and fixed-capacity batches (`src/render/fx/particles.ts`, `src/render/models/batch.ts`). There is no lint, test or heap measurement. |
| Memory flat over a 40-minute run | **missing** | No leak check in e2e (no `memory` or heap reads in `e2e/`). |
| Initial download ≤ 25 MB to the title; biomes streamed | **done** | Ran `npm run build` once (2.4 s, no chunk-size warning; limit 900 kB, `vite.config.ts:11`). Results: 150 files in `dist/assets`, 38 of them source maps; **7,234,980 bytes without maps** (32.3 MB with them). What the title loads (`dist/index.html`: the entry chunk, 7 preloaded chunks and the CSS) is **1,715,699 bytes, 512,725 gzipped** (`gzip -9`, summed in `/home/user/aw-work/7/`), plus the font subsets the page uses (73 font files, 1,090,308 bytes in all, fetched by unicode-range). There are no assets to stream: models are built in code. |

**Bundle.** Largest chunks (bytes, then `gzip -9`): `stage` 805,190 / 230,379 (three.js and the renderer, loaded with the combat screen); `weeklyBench.worker` 766,733 (the UI lab's bench); `fillCues` 736,796 / 223,844 (preloaded at the title; no three.js in it); `verify.worker` 714,675; `withoutYou.worker` 649,047; `audio` 264,477; the entry 256,305; `tyrantCues` 246,847; `RespiteScreen` 238,682; `UiLab` 193,053; the CSS 188,369. The three workers each bundle their own copy of the sim, content and zod. Screens are lazy (`src/app/App.tsx:8-32`, `src/ui/screens/RunScreen.tsx:21-22`), and so are the labs (`src/app/LabRouter.tsx:7-9`).

**Quality tiers: partial.** `low`, `medium` and `high` set the pixel ratio (1, ≤ 1.5, ≤ 2), shadows and shadow-map size (`src/render/stage.ts:76-84`). The default is `high`. Tiers are chosen only in the dev panel (`src/debug/DevPanel.tsx:128-129`). There is no automatic pick, no dynamic resolution and no player setting.

**Worst-case scenes.** The bench's fight scenarios peak at 17 entities (Unweaver, Grove), 13 (Movement II's hound pack) and 9 (the Silent Conductor with its choir) (ran, above). Only the synthetic crowd reaches 250. No render measurement exists of the Finale with a full choir or of a Movement II swarm. The e2e busy fight is a Movement I mix in Training.

### Art, VFX and animation

- **Models: procedural, no assets.** The Weaver, the six heroes, every enemy and boss, and the arenas' pillars are built from primitives in code (`buildWeaver`, `buildHero`, `buildEnemy`, `buildCrown`, `buildPillar` and the Legion, Unstitched and Crucible builders, `src/render/models/library.ts:44-1659`). They are merged per model and drawn one batch a model (`ModelBatch`, `src/render/models/batch.ts`). The repository holds no glTF, texture, audio or font file of its own (searched for `*.glb`, `*.gltf`, `*.png`, `*.ogg`, `*.woff*` outside `node_modules` and `docs/`).
- **Animation:** rigid models moved by code (bob, lean, gait, death material; fingerprinted per enemy in `tests/renderSpireSnapshot.test.ts:1-15`). No skinning, no `AnimationMixer`.
- **VFX:** a custom pooled particle system with one draw call and no allocation after construction (`src/render/fx/particles.ts`; the Phase 1 spike's outcome). Also ribbons, rings, beams, shells and sprites in `src/render/fx/`, and SDF telegraphs (`src/render/fx/telegraphBatch.ts`).
- **What the plan calls custom:** "the Weaver and the 4 bosses are custom models (commissioned, or built in Blender to the KayKit proportions)" (04 §1), plus kits for heroes and enemies. None of it exists. The plan's post-processing, `three.quarks` and `troika-three-text` (05 §2) were never added (`package.json` dependencies).
- **Feasible without new assets:** readability and motion polish inside the procedural system, under the draw-call and snapshot pins. These include the open look items: the borrowed accent ring (Phase 6 *Open* 7), the Atlas mint (6) and the Borrowed Crowns header wrap (5). Phase 5g's note that the heal cue's teal motes sit close to Sostenuto's green (*Open* 15) is not one of them: the motes use the game-wide `heal` meaning colour (`src/render/fill.ts:117`), so moving them is a palette decision, and the aura's green is out of reach (ground rule 4). VAT crowds are not needed: crowds are instanced rigid models already, and the sim bench's crowd is far inside budget.

### Audio

- **All synthesised.** The engine graph runs buses (music, sfx, ui, ambience) → master → a limiter (threshold −8 dB, ratio 14) → soft clip (`src/audio/engine.ts:1-11`, `:130-135`). The music director, pitched SFX, the Finale's Grand Silence, the Conductor's beat and the UI sounds are all oscillators and noise (`synth.ts`, `music.ts`, `sfx.ts`, `ui.ts`, 16,797 lines in `src/audio`). No sample is loaded (no `decodeAudioData` or `fetch` in `src/audio`).
- **Ducking:** by bus, on big moments (`engine.ts:216`; e.g. `sfx.ts:1585-1587`).
- **Voice caps:** 4 voices a sound group by default (`admit(key, max = 4)`, `engine.ts:342`). Above 70 effects voices or 150 in total, every voice not marked "big" is skipped (`:344`). Phase 5g noted that the Ringing re-strike may drop in a busy fight (`docs/phase-5g.md`, *Open* 15). Peak voice counts are asserted per sound in `tests/audio.test.ts:363-368`.
- **Loudness:** nothing targets a loudness level. The audio lab's offline renderer measures peak and RMS (`measure`, `src/audio/lab/offline.ts:24-41`), and nothing in the tests reads it for loudness.
- **The plan's "licensed or commissioned stems" and "bark vocalisations":** none (decisions 2 and 3).
- **Pins:** the Spire and Rift audio snapshots record every scheduled note and the whole patch (`tests/audioSpireSnapshot.test.ts:1-18`). Adding a bus moves them.

### Saves

- **Where:** `localStorage` keys `aetherweaver.run`, `.run.bak`, `.profile`, `.profile.bak` (`src/meta/save.ts:41-44`). There is an in-memory fallback when storage is blocked (`src/app/storage.ts:11-18`). Run replays (Phase 6) go in IndexedDB (`src/app/replayStore.ts`).
- **Versions:** run save 5, profile 10, settings 4. Profile migrations step 1 → 10 (`migrateProfileJson`, `save.ts:959-981`); run migrations step 1 → 5 (`:585-720`).
- **Migration coverage: partial.** Every profile version has at least one load test, but each is synthesised from today's `newProfile()` with keys removed, not a save written by that version's build. The tests: v1 (`tests/meta/astrolabe.test.ts:130`, `tests/meta/deeds.test.ts:514`), v2 (`deeds.test.ts:499`), v3 (`tests/reliquaryStores.test.ts:290`), v4 (`tests/dissonanceStores.test.ts:474`), v5 (`tests/bondsStores.test.ts:247`), v6 (`tests/variantsStores.test.ts:91`), v7 (`tests/loom.test.ts:304`), v8 (`tests/meta/migration.test.ts:288`), v9 (`tests/phase6Contracts.test.ts:191-225`, `migration.test.ts:338-400`). Run saves v1-v5 are covered in `migration.test.ts:140-286` and `:402-448`; settings v1-v4 in `:450-537`. The three files ran green (`npx vitest run tests/colorVision.test.ts tests/meta/migration.test.ts tests/uiBindings.test.ts --maxWorkers=2`: 127 passed). **The save fuzzer 05 §8 asks for does not exist** (no `fuzz` in `tests/` or `tools/`), although docs/phase-6.md ground rule 9 names one. The build that wrote each version is in git (the `PROFILE_VERSION` bumps: 05933c4, ee6b25e, 05f4454, 9e21c4d, 29278e2, 21ef501, 7a2bbdd, 237094f, 5b365b3, d86b04a). So real fixtures can be made.
- **Export and import: missing** (decision 11).
- **A corrupt save:** `loadProfile` tries the main copy, then the backup, then starts a **new profile without a word** (`save.ts:1007-1086`). The next save copies the unreadable main into the backup slot (`saveProfile`, `:1088-1097`), and the save after that overwrites it. So two saves after a failed load, the player's old progress is gone. Runs behave the same way (`loadRun`, `:775-810`; `saveRun`, `:812-827`). 05 §8 asks that the raw blob be kept and offered for export.
- **The demo's storage:** the same keys, in whatever origin hosts it (a claude.ai artifact, demo.md *Publishing*), so it never meets a release build's saves. The demo's choice lives under `aetherweaver.demo.start` (`src/app/demoChoice.ts:12`).

### Errors

- **Per test: done.** 33 assertions across the two e2e files check that no console error or page error occurred (`trackErrors`, `e2e/smoke.spec.ts:18-25`; `e2e/weekly.spec.ts:17-20`). Console **warnings** are not collected, although 06 §4 asks for "no console errors or warnings".
- **A full scripted run: partial.** The Expedition test reaches the Finale, the epilogue and the Summary with no errors (`smoke.spec.ts:248-428`). But it warps between nodes and ends most fights with the test hook's `winFight`, which writes a plain victory without playing (`src/app/testHook.ts:190-197`). The weekly test plays a whole run in a worker, sim only, and one real fight through the combat screen (docs/phase-6.md, *Verification as run*). No test plays every node of a run through the real app with rendering and sound.
- The suite: 36 e2e tests (34 in `smoke.spec.ts`, 2 in `weekly.spec.ts`), last green at 38.3 minutes (docs/phase-6.md, *Verification as run*). Headless Chromium with SwiftShader (`playwright.config.ts:15-18`).

### Assets and licences

- **`assets/licenses/`: missing.** No such folder, and no licence record anywhere in the repository.
- **What ships** (the build's source maps list every `node_modules` module bundled: react, react-dom, scheduler, three, zod, zustand; ran `node /home/user/aw-work/7/mapsrc.mjs dist/assets`; fonts from the CSS):

  | Package | Version | Licence (its `package.json`, and a `LICENSE` file present) | In the build as |
  |---|---|---|---|
  | `@fontsource/cinzel` | 5.3.0 | OFL-1.1 | font files |
  | `@fontsource/inter` | 5.3.0 | OFL-1.1 | font files |
  | `@fontsource/jetbrains-mono` | 5.3.0 | OFL-1.1 | font files |
  | `react` | 19.3.1 | MIT | code |
  | `react-dom` | 19.3.1 | MIT | code |
  | `scheduler` (react-dom's dependency) | 0.28.0 | MIT | code |
  | `three` | 0.186.1 | MIT | code |
  | `zod` | 4.6.7 | MIT | code (main bundle and the three workers) |
  | `zustand` | 5.0.16 | MIT | code |

  Tailwind's generated CSS (`tailwindcss` 4.3.3, MIT, a dev dependency) and Vite's small runtime helpers (MIT) are also emitted into the build. No image, model, sound or other third-party asset ships.

### Distribution

- **Static web build: done.** `npm run build` writes `dist/` with base `/` (absolute `/assets/` paths in `dist/index.html`) and source maps (`vite.config.ts:8-9`). `npm run build:demo` writes `dist-demo/` with relative paths and no maps (`package.json`, `build:demo`). The demo is published as a claude.ai artifact (demo.md *Publishing*).
- **Offline, service worker, manifest:** none (decision 9).
- **Tauri:** nothing. A wrapper would need a `src-tauri` crate and its config pointing at `dist-demo`-style relative paths; module workers, IndexedDB and WebGL2 in each platform's web view (WebView2, WKWebView, WebKitGTK); `localStorage` kept per app; icons, signing and installers. A Rust toolchain exists on this machine (`cargo`), but the system web-view libraries and crate downloads were not checked (decision 10).
- **CI:** typecheck, lint (with `prettier --check`), unit, `sim:bench --check`, build, e2e (`.github/workflows/ci.yml`). The plan's nightly harness run is not in CI.

### Balance: what earlier phases left for you

Phase 7 changes none of these (decision 13). W9 re-reads the bands on the release candidate. Each line points to where its readings and options are.

**From Phase 6** (`docs/phase-6.md`, *Tuning* and *Open*):

1. Tier I: the Skilled bot is not 10 points below the Expert (−5 / −4 / −7) (*Missed bands* 1).
2. Tier II reads 80% on 900007 against 40-70% (*Missed bands* 1; the Expert's map rule is a policy choice, *For the owner*).
3. Tier IV sits on the edge on all three sets after round 2 (18 / 16 / 14%) (*Round 2*, item 4).
4. Tyrant's cost: −4.1% for the Novice, +11.4% Skilled, +7.2% Expert, against 24-40% (*Round 2*, item 1).
5. Bosses easier with Tyrant: the Seamstress (both bots) and the Matriarch (Novice) (*Round 2*, item 2).
6. Mimicry's cost: +0.9 / +7.4 / +6.2% against 16-32% (*Round 2*, item 3).
7. True Dissonance: the 10-point gap is missed (7.5) (*Missed bands* 4).
8. The Conductor Calling's Postlude lasts about 14 s, because the Grand Finale ends it (*Missed bands* 4; demo.md *What we know is off*).
9. Echoes at ★ above 95% on Retrograde and A Cappella (*Missed bands* 5).
10. The Last Rehearsal is 23.5 minutes long against a 22-minute band (*Missed bands* 6).
11. Weekly entry 9 reads 90% for the Expert (*Missed bands* 7).
12. Restating the tier bands; the changed Echo texts; rotation entries 10 and 11 (*For the owner*).
13. The Novice and Idle bots were never run at the tiers (*The bands*).
14. *Open* 1-10: the "without you" reading in the Postlude; the weak second lane of the content hash; constants that `runtime.ts` and `settings.ts` copy; the lab bench's copy of the recorder; Borrowed Crowns' header wrap; the Atlas mint under tritanopia; the borrowed accent ring; Vharun borrowing the same attack twice; the Seamstress's held entry; earned looks priced 90.

**From Phase 5g** (`docs/phase-5g.md`, *Tuning* and *Open, for the owner*):

15. The archetypes' holding band: only PP holds (*Missed bands* 1).
16. The spread band: PP on all three sets, MA on two (*Missed bands* 2).
17. **Red Line (RD) wins 0 of 90** (*Missed bands* 3).
18. The Novice's won ÷ reached the Finale is 54% against 15-40% (*Missed bands* 4).
19. Pacing on base 9001 is 41.5 minutes against 40 (*Missed bands* 5).
20. 16 trigger entries fire under half the time (*Missed bands* 6).
21. Roster parties: OA under default − 5 on all three sets; SB on 333003 (*Missed bands* 7).
22. Relic cells outside their band at 20 seeds: Red Ink, Hollow Crown, Echoing Shell, Everbell, Water Clock (*Missed bands* 8).
23. CS's third aura in the builds tool; Thread the Needle staying epic; All In and Anchor on the presets' line (*For the owner*). CS's third aura is a choice made by the harness tool, not a change to any aura.
24. *Open* 3-15: Concert Pitch and Thornwreath added to the party damage factor; the "more"-sources registry and its missing lint; Iron Mask and Full Chord as "more" factors; Iron Mask against the Unweaver's Unravel text; the pre-5g Tithe Altar and Mirror Pool selling from an empty rarity; Clutch Peal and Second Toll inert in Movements II and III; texts with fixed numbers; copies that can drift; the reviews' leftovers; presentation not yet heard; **the report tools not compared byte for byte before release** (item 11).

**From Phase 5f** (`docs/phase-5f.md`, *Open* and *For the owner*):

25. The Silent Conductor's length and Cues a boss fight are missed (the Grand Finale).
26. The Triad path's shares at short fights; A Tempo's shares.
27. The two economies (Cue 20 / gain 10, kept, against 15 / 20).
28. A Grand Finale cast during the Grand Silence loses every turn.
29. Hero Autonomy fires Solos uncued, so assisted players get few Duets and Trios.
30. A2: two Conductor goldens that pin little.
31. Rule copies in the bots (`soloFullIn`, `chainOpen`, `marcatoReady`, `finaleFree`) and in `hudBridge.ts`.
32. C2: name collisions (Ensemble, Spotlight, Maestro).

### The pillar tests (02 §2)

| # | Pillar | Its test | What measures it today | Last reading |
|---|---|---|---|---|
| 1 | Anticipate, don't just react | Expert Perfect Ward rate correlates with clear time and grade; Idle always loses; win rate and grade climb steeply from Novice to Expert | Win rates by bot in `tools/harness.ts` (cell bands by encounter kind, `:352-371`) and whole-run bands. **No tool correlates Perfect Ward rate with clear time or grade** (searched `tools/`, `tests/`). | Whole Finale-route Expeditions at Dissonance 0: Skilled 67 / 67 / 64%, Novice 1.0 / 1.0 / 1.5% (docs/phase-5g.md, *Tuning*); Expert at tier 0 98 / 100 / 98% (docs/phase-6.md). Idle: 0% bands at bosses; not run at the tiers. |
| 2 | Your hand on every hit | Players can say what mattered; the Weaver's share is never 0% while the player acts | The Skilled bot's share bands (≥ 35% road, ≥ 30% bosses) | The Silent Conductor 50% (docs/phase-5d.md:1190); roster parties at least 38-41% (docs/phase-5e.md:2133-2134). No person has played Phases 5f-6 (demo.md, "Only bots have played it"). |
| 3 | Every threat has an answer | Content lint passes; the death recap names the telegraph and the missed answer in 100% of downs | Content lint in `tests/content.test.ts`; recap tests by Movement (`tests/sim/movement2.test.ts:86`, `tests/uiPhase5d.test.ts:464`); the harness instruments every down (`tests/harnessTools.test.ts:1612`). **No reading of the share of downs whose recap names an answer.** | Lint green in Phase 6's full suite (223 files, 4,857 tests). |
| 4 | Heroes are characters | Players describe heroes by personality; hero AI never "does nothing"; quirks fire predictably and are announced | AI and quirk scenario tests per hero. No harness measure of a hero's idle time or of quirk announcements. | Not measured as a rate. No playtest. |
| 5 | Builds change how you play | ≥ 5 distinct builds viable at Dissonance 10; no single loadout dominates | Presets and archetypes through `tools/loadouts.ts` and `tools/builds.ts`; the Expert at Tier I | 6 of 6 presets ≥ 50% at Tier I (10 points), 20 runs a preset on two sets (docs/phase-6.md, *Tuning*); 5 of 6 archetypes at Dissonance 0 (docs/phase-5g.md). "No single loadout dominates" is not measured. |

### The release checklist (06 §6), row by row

| # | Row | Status today | What is missing |
|---|---|---|---|
| 1 | All pillar tests pass on the release build | **partial** | The bot halves read on main, not on a release build. Pillar 1's correlation, pillar 3's recap share and pillar 4's rates are not measured. Every playtest half is undone. |
| 2 | Harness bands met in every Movement and in Dissonance tiers 0/5/10/15 | **partial** | **The tiers were redefined by Phase 6's decision 1: point totals 0, 10, 20, 30 and 42** (docs/phase-6.md, decision 1), each with a fixed set of levels. Misses are listed under *Balance* (items 1-11, 15-22, 25-26). |
| 3 | Perf budgets met on the reference laptop | **partial; not provable here** | No reference laptop is named. GPU time can't be measured here. Triangles and memory are not asserted. The e2e thresholds are looser than the budgets. |
| 4 | Accessibility options complete and tested with colour-blind simulation | **partial** | See *Accessibility*: missing options, the 12 px minimum, gaps in Flashes and reduced motion, captions. Simulation checks colour values, not frames. |
| 5 | Save migration tested from every pre-release version; export and import work | **partial / missing** | Fixtures written by real builds; the fuzzer; corrupt-save keeping; export and import. |
| 6 | Zero console errors across a full scripted run | **partial** | A run played node by node through the real app; console warnings are not collected. |
| 7 | Asset licences recorded in `assets/licenses/` | **missing** | The folder and its records (nine packages, no asset files). |

## Engineering ground rules (non-behavioural by default)

5b's to 6's rules still hold (docs/phase-6.md, *Engineering ground rules*, and the rules it carries forward). A polish phase must not move the sim. This phase adds:

1. **Every pin stays byte-identical, unless a workstream's row below names the pin and why.** The pins as they stand on main at 6a2b5eb:
   - the 32 goldens (`tests/sim/golden.json`, `contentVersion` `c-691f26eff5775748`, and the literals in `tests/sim/m1Unchanged.test.ts`), with `SIM_VERSION` **22** (`src/sim/constants.ts:9`); the ten fight-replay round-trips (`tests/sim/determinism.test.ts`);
   - the Dissonance pins (`tests/sim/dissonancePins.json`: 51 fight hashes, five whole runs);
   - the 40 cell and 12 whole-run baseline `--check`s and every other pin in docs/phase-6.md ground rule 1 (Prelude and draft snapshots, the four command snapshots, `fillInert.json`, the key pins, the hand-off pins, the masked replay and the frozen resolver);
   - the render and audio Spire and Rift snapshots, and the "no new draw call" render pins;
   - the versions: fight replay format **6**, run replay **1**, run save **5**, profile **10**, settings **4**.

   Rows that may re-record a presentation pin: W6 (the render snapshots, for each model or arena look it changes, with the diff listing only those entries) and W7 (the audio snapshots, once, for the barks bus's nodes). No row may move a golden, a Dissonance pin, a baseline, a command snapshot, `SIM_VERSION`, `contentVersion` or a save version. If one would have to move, the stream stops and asks.
2. **Determinism.** Nothing in `src/sim`, `src/content` or `src/meta` changes behaviour. The only edits allowed there are W5's save-file handling in `src/meta/save.ts` and a new `src/meta/saveFile.ts` (neither read during a fight or a run step), W9's behaviour-neutral refactors (each proven by the pins), and the optional run key of decision 16 (absent until true, written by the app, read by the Summary). The lint bans stay as they are (`eslint.config.js:67-128`).
3. **Settings are per device and never reach a run's seed, its steps or a replay**, except the two that already do, recorded as now (the assists and Skip the unlocks, *Audit, Accessibility*). Every new option is presentation-only or input-only:
   - **New aids live outside `settings.assists`.** That object is spread into every fight's config (`runStore.ts:670`) and checked by a strict replay schema (`runReplay.ts:155-158`). Game speed and Auto-Thread go in a separate `aids` object (*Contracts*).
   - **Input aids produce ordinary commands.** Auto-Thread, hold-or-toggle and the gamepad send only commands a keyboard player could send. The fight replay records them and plays them back bit for bit.
   - **Game speed scales the runtime's real-time clock** (`stepper.advance`, `runtime.ts:285`), never `SIM_DT` or `world.timeScale`. A fight played slowly has the same ticks and commands as one played fast.
4. **No aura and no ornament changes, in look or sound.** These files are not edited by any stream: `src/content/auras.ts`, `src/content/ornaments.ts`, `src/sim/combat/auras.ts`, `src/sim/systems/field.ts`, `src/sim/chords.ts`, `src/render/field.ts`, `src/render/songs.ts`, `src/render/fermata.ts`. `git diff main --stat` on them is empty at every merge. Neither are the HUD and screen elements that draw an aura or ornament: the Weaver bar's song chips, ChordBuilder's aura and ornament cards, the aura and ornament glyphs in `src/ui/kit/iconPaths.ts`. Comfort options (Flashes, reduced motion, high contrast) leave them exactly as they are. Their colours stay out of every new palette.
5. **The aura presentation pin.** Before any other change, W0 records `tests/aura/presentationPin.json`, as `tests/renderSpireSnapshot.test.ts` and `tests/audioSpireSnapshot.test.ts` record theirs. For each of the six auras and four ornaments, on each Chord role, it records:
   - the field and beam views' state over a scripted fight (colours, radii, uniforms, instance matrices) and Fermata's view;
   - the HUD's song chips as rendered markup;
   - every note and parameter write the audio director schedules for them, through a recording AudioContext.

   It records with default settings and again with every new comfort option at its strongest. A recorder refuses to overwrite. The test runs in the suite. It is byte-identical at every merge.
6. **No new third-party runtime dependency** without a decision row. Nothing in this doc needs one. A new dev dependency (for example a licence scanner) needs a line in W8's licence record and a reason in its hand-off.
7. **Texts through the text layer.** From W3a on, a new or changed player-facing string in `src/ui` goes through `t()`, and its number through the text layer's formatters. Content and sim text are never edited for localization. The layer looks them up by id at display time (`tc(kind, id, field)`). `contentVersion` and every hash stay put.
8. **Every new option has a test and a lab view.** Its default reproduces today's behaviour exactly (a test compares the default against v4 settings without the key). The UI lab shows the option's effect, and the VFX or audio lab where it acts there.
9. **No per-frame allocation** in new code under `src/render`, `src/audio`, `src/input` (the pad poll included) and `src/app/runtime.ts`: scratch objects are kept on the instance.
10. **Shared files get call sites, not bodies.** W0 places one call in `src/app/runtime.ts` for captions and one for game speed, a slot for the saves panel in `SettingsScreen.tsx`, and the types of new actions in `src/input/actions.ts`. The owning stream writes the body in its own file.

## Contracts (W0)

Everything here is built by W0 with no behaviour. Each new key is optional, with a default equal to today, so v4 settings parse to what they were (captions' precedent: no version bump, `settings.ts:102-107`).

- **`src/app/settings.ts`:**
  - `reducedMotion: 'system' | 'on' | 'off'` (default `'system'`, the OS setting as today).
  - `telegraphs: { opacity, outline, perfectBand, highContrast }` (defaults 1, 1, 1, false; ranges 0.6-1, 1-2, 1-2).
  - `answerGlyphs` (default true); `importantNumbersOnly` (default false); `slowmoVignette` (default true).
  - `volumes.ambience?` (absent: follows Effects, as `engine.ts:198` does today); `volumes.barks?` (absent: 1); `heroVoices` (default false, decision 3).
  - `input: { threadMode: 'toggle' | 'hold', wheel: 'hold' | 'toggle', mouseoverCast: boolean, mouse: { thread, mode, wheel } (button roles), padBindings: record }` (defaults: toggle, hold, true, today's buttons, `{}`).
  - `aids: { gameSpeed: 0.7 | 0.8 | 0.9 | 1, autoThread: boolean }` (defaults 1, false), **outside `assists`** (ground rule 3).
  - `quality: 'auto' | 'low' | 'medium' | 'high'` (default `'high'`, decision 8); `locale: 'en' | 'en-XA'` (default `'en'`; the pseudo-locale is reachable from the labs and `?locale=en-XA`).
  - Phase 6 *Open* 3: `ASSIST_VALUES` imported from `src/meta/runReplay.ts` (same values, already pinned by a test).
- **`src/input/actions.ts`:** new action ids appended (pad-only actions such as `reticleNext`, `reticlePrev`, `cueReticle`); `PadButton` and `PadBindings` types and `DEFAULT_PAD_BINDINGS` (04 §8's layout). No handler yet.
- **`src/ui/text/`** (new): `t(key, params?)`; `tc(kind, id, field)` (content text by id: English from `CONTENT`, unchanged); `num`, `percent`, `seconds`, `clockText`, `plural` (through `Intl.PluralRules`), `possessive`, all locale-aware and printing exactly today's English for `'en'`. Also the English catalogue, split into one file an area under `src/ui/text/en/` with an index W0 writes: `input.ts` (W1's), `a11y.ts` (W2's), `saves.ts` (W5's), `release.ts` (W8's) and the rest (W3's), all empty at W0, so no two streams edit one catalogue file; `pseudo.ts` (`en-XA`: accents, brackets, 30% padding), and `useLocale()`. `src/ui/kit/format.ts` re-exports through it, with output unchanged (a test compares both over a table of inputs).
- **`src/app/runtime.ts`** (call sites only, then W4's file): the Finale caption block becomes `captionFor(event)` from new `src/ui/hud/captions.ts`, whose body returns `finaleCaption(event)` as today. The stepper takes `elapsed * this.devTimeScale * gameSpeed()` from new `src/app/gameSpeed.ts`, which returns 1. Phase 6 *Open* 3: `FIGHT_END_DELAY_MS` and `WITHOUT_YOU_GRACE_MS` imported from `src/meta/runEnd.ts`.
- **`src/ui/screens/SettingsScreen.tsx`** (a slot, then W2's file): `<SavesPanel />` in the Progress section, from new `src/ui/screens/SavesPanel.tsx`, which renders nothing until W5 fills it.
- **`src/meta/types.ts`:** `RunState.assisted?: true` (decision 16; absent until true; the run save's schema keeps it, as Phase 6 did for its keys).
- **Characterisation:**
  - `tests/aura/presentationPin.*` (ground rule 5).
  - `tests/phase7Contracts.test.ts`: every new key's default equals today; v4 settings without them parse equal; `format.ts`'s outputs unchanged; `captionFor` and `gameSpeed` inert.
  - A recorded green state: the full suite, every `--check` tool and `sim:bench`, listed in W0's hand-off.

## Workstreams

**W0 lands first, alone.** Then W1, W2, W3a, W4, W5, W6, W7, W8 and W9 run in parallel, each on its own git worktree and branch, on the disjoint files below. **W3b** (the rest of the string extraction) starts after W1, W2 and W6 have merged, because it touches the same component files they edit. **W10** reviews last. Then come the release candidate and the demo.

**Merge order:** W5, W8, W9 and W4 (self-contained); W1; W2; W6; W7; W3a (any time; it converts only files no other stream owns); W3b; W10.

| Stream | Strength | Owns (edits) | Reads only |
|---|---|---|---|
| **W0** contracts and characterisation | careful | `src/app/settings.ts`; `src/input/actions.ts` (types, defaults); `src/ui/text/**` (new); `src/ui/kit/format.ts`; `src/app/runtime.ts` (call sites only, then W4's); `src/app/gameSpeed.ts`, `src/ui/hud/captions.ts`, `src/ui/screens/SavesPanel.tsx` (new, inert, then W2's, W2's and W5's); `src/ui/screens/SettingsScreen.tsx` (the slot only, then W2's); `src/meta/types.ts` (`assisted?`) and the run save schema's entry in `src/meta/save.ts` (then W5's); `tests/aura/**`, `tests/phase7Contracts.test.ts` (new) | everything else |
| **W1** input: remapping and gamepad | careful | `src/input/**` (with `actions.ts` after W0); `src/ui/screens/ControlsSettings.tsx`; `src/ui/kit/menuNav.ts`, `KeyCap.tsx`; `src/ui/hud/labels.ts`, `DirectiveWheel.tsx`; `src/ui/text/en/input.ts`; `src/app/App.tsx` (one global pad-menu call); the `useGamepadMenu()` lines in `TitleScreen.tsx`, `LoomScreen.tsx`, `AtelierScreen.tsx`; the key names in `CodexScreen.tsx:789-822`; `tests/inputPhase7.test.ts`, `tests/gamepad.test.ts` (new), `tests/uiBindings.test.ts`, `tests/input*.test.ts`; `e2e/input.spec.ts` (new) | everything else; never `src/sim` |
| **W2** accessibility options | careful, design-heavy | `src/ui/presentation.ts`, `src/ui/kit/motion.ts`, `src/index.css`; `src/ui/screens/SettingsScreen.tsx` (after W0; not the Controls section, which is `ControlsSettings.tsx`); `src/ui/hud/captions.ts`, `src/app/gameSpeed.ts` (after W0), `src/ui/hud/finaleLook.ts` (captions only); `src/app/runStore.ts` (the `assisted` call site only); `src/ui/screens/SummaryScreen.tsx` (the badge only); the 12 px fixes (class names only) in the 16 files listed under *Audit* (on aura and ornament elements: listed, not changed); `src/render/types.ts`, `overlay.ts`, `camera.ts`, `combatView.ts` (settings call sites), `telegraphs.ts`, `fx/telegraphBatch.ts`, `thread.ts`, `calls.ts`, `feedback.ts`, `relicCues.ts`; `src/ui/text/en/a11y.ts`; `tests/a11yPhase7.test.ts`, `tests/textSize.test.ts`, `tests/contrast.test.ts` (new), `tests/colorVision.test.ts` (appended); `e2e/a11y.spec.ts` (new) | everything else; never the aura files of ground rule 4 |
| **W3a** localization readiness | mechanical, careful | `src/ui/text/**` (after W0: `tc`, the pseudo-locale, the formatters, and the catalogue files no other row names); `tools/strings.ts` (new: the scanner and ratchet), `tests/strings.baseline.json`, `tests/textLayer.test.ts` (new); the conversion of every `src/ui` file **no other row names** | everything else; never `src/content`, `src/sim`, `src/meta` text |
| **W3b** localization: the rest | mechanical | the conversion of the `src/ui` files W1, W2 and W6 edited, after they merge; `tests/strings.baseline.json` (lowered) | everything else |
| **W4** performance | careful | `src/app/runtime.ts` (after W0); `src/render/stage.ts`; `src/debug/**`; `src/ui/perfCounters.ts`; `src/app/bench.ts` (new: bench scenes), `src/app/LabRouter.tsx` (the bench route); `vite.config.ts`; `tools/sim-bench.ts`; `e2e/perf.spec.ts` (new), `tests/perfPhase7.test.ts` (new) | everything else; allocation fixes outside its files go to their owner as a finding with file and line |
| **W5** saves | careful | `src/meta/save.ts` (after W0), `src/meta/saveFile.ts` (new); `src/app/storage.ts`, `src/app/saveTransfer.ts` (new); `src/ui/screens/SavesPanel.tsx` (after W0); `src/ui/text/en/saves.ts`; `tools/save-fixtures.ts`, `tools/save-fuzz.ts` (new); `tests/fixtures/saves/**`, `tests/meta/saveMatrix.test.ts`, `tests/meta/saveFile.test.ts` (new); `e2e/saves.spec.ts` (new) | everything else |
| **W6** visual polish (no aura) | design-heavy | `src/render/models/**`, `entities.ts`, `arena.ts`, `fx/**` (not `telegraphBatch.ts`), `tyrant.ts`, `postlude.ts`, and the `*Cues.ts` colour tables that are not an aura's; `src/ui/screens/AtlasParts.tsx`, `src/ui/kit/loomLook.ts`; `tests/renderPhase7.test.ts` (new); the Spire and Rift render snapshot files (re-recorded only for the entries it names) | everything else; never the aura files of ground rule 4 |
| **W7** audio polish (no aura) | design-heavy | `src/audio/**` (lab included); `tests/audioPhase7.test.ts` (new); the Spire and Rift audio snapshot files (once, for the barks bus) | everything else |
| **W8** release engineering | mechanical, careful | `assets/licenses/**` (new); `tools/licenses.ts`, `tools/release-check.ts` (new); `e2e/fullrun.spec.ts` (new); `src/app/testHook.ts` (hooks the full run needs); `src/ui/text/en/release.ts`; `package.json` (scripts only); `.github/workflows/ci.yml`; `README.md` | everything else |
| **W9** follow-ups and measurements | careful | `src/bots/common.ts` (rule copies replaced by the sim's exports, behaviour-neutral); `tests/bots/conductingBots.test.ts` (Phase 5f A2: assert each golden's named events); `src/ui/lab/weeklyBot.ts` (Phase 6 *Open* 4); `src/app/withoutYou.ts` (Phase 6 *Open* 1, the reading only); the *Release measurements* section appended here | `tools/**` (run, not edited), everything else |
| **W10** review | careful | nothing (a report appended here) | everything |

### W0: contracts and characterisation

1. Before any change: run the whole suite, every `--check` tool and `sim:bench --check` on main, and record the green state.
2. Record the aura presentation pin (ground rule 5) on main, with its test and a recorder that refuses to overwrite.
3. Add *Contracts*, with no behaviour.

**Done when** typecheck, lint and vitest are green; every pin of ground rule 1 is byte-identical; the aura pin reproduces; `phase7Contracts.test.ts` passes.

### W1: input, remapping and gamepad

- **Remapping:** the mouse-button roles (Thread on a hovered hero, Mend ⇄ Empower, the wheel and its Focus click) become bindable to any mouse button or key. The Cue-by-slot modifier is bindable. Hold-or-toggle applies to Thread mode and the wheel, and mouseover casting can be turned off (smart-cast then takes the threaded hero only). Controls lists the fixed menu keys. Key names in the Codex follow the bindings. Beside the Martyr's text, the live Bear key shows (decision 18).
- **Gamepad, combat:** the `InputController` polls `navigator.getGamepads()` once a frame while a pad is connected, with no allocation. The left stick becomes `move`, quantised as keys are (`MOVE_STEP`, `InputController.ts:31`). The right stick steps a reticle between heroes, and the reticle stands in for "hovered" in smart-cast. Triggers give Thread and its mode, face buttons the techniques, the d-pad Directives, Start pauses. Every button is remappable through `padBindings`.
- **Gamepad, menus:** one global hook serves every menu screen (replacing the three per-screen calls), and the pad works on Controls itself.
- **Auto-Thread** (decision 15): after 2 s with no input, the controller sends `thread` to the lowest-life hero, as a key press would.
- **Done when:**
  - every action and mouse role is rebindable, and a test drives each through the controller to the same command as its default;
  - a scripted pad (a fake `getGamepads`) plays a Training fight to the same command list as a scripted keyboard doing the same things;
  - the pad drives every menu screen in e2e;
  - Auto-Thread sends only `thread` commands, and only with the aid on;
  - the pins are unchanged.

### W2: accessibility options

- **Reduced motion** as a setting (System, On, Off). On: the UI's reveals and animations stop as they do under the OS setting; camera shake goes to zero; the slow-mo vignette and full-screen pulses go off; particle bursts, telegraph impact flashes and the Thread's snap burst are cut to a still frame. The aura field and Fermata are left alone (held for you).
- **Flashes coverage:** telegraphs, the Thread, calls and feedback's bursts take the Flashes scale (*Audit*).
- **Telegraph options:** opacity, outline, Perfect-band width (05 §5.3: "widenable in accessibility settings"), and a high-contrast mode, which uses the colour-vision palette's own roles at full value with a dark outline and keeps the answer glyphs. No aura colour is involved.
- **Answer glyphs off; important numbers only** (Weaver-attributed chips, saves and downs only); **slow-mo vignette off.**
- **The 12 px minimum at 100%:** the 50 sizes listed move to `text-xs` (0.75 rem) or larger, with layouts checked in the UI lab at 80%, 100% and 150%. Aura and ornament elements are listed, not changed.
- **Contrast:** a token-level test of every text colour against the surfaces it sits on, at 4.5:1 (one shared helper replacing the four copies in tests).
- **Captions:**
  - telegraph wind-ups with their answer timbre and direction ("Brass wind-up, left"), from the same event and side the audio uses;
  - Tyrant's edict, the Postlude's rise and pair Cue, Mimicry's first sighting;
  - the low-life sound, and the Finale's four as today.
  Each is a callout with its own lifetime, never more than two at a time.
- **Ambience and barks sliders** (ambience absent = follows Effects, as today).
- **Game speed** (70-100%) through `gameSpeed()`.
- **The assist badge** from the run's own record (decision 16).
- **Done when:** each option has its test and lab view; the e2e test turns each on in a fight with no error; reduced motion and Flashes 0 are shown in a test to leave no full-screen pulse and no unscaled flare outside the aura views; the aura pin holds with every option at its strongest; screenshots are taken at 80%, 100% and 150% UI scale and under each palette.

### W3a and W3b: localization readiness

- **W3a:**
  - The English catalogue and the conversion of every `src/ui` file no other stream owns.
  - Content and sim text shown through `tc()` and by id: decrees by boss and phase, barks by hero and line id, where the sim's text has a content source. Where it has none, the HUD keeps the sim's English and the lint lists the call site.
  - Numbers through the formatters; plurals through `plural`, which uses `Intl.PluralRules`.
  - `tools/strings.ts`: the scanner above, as a test with a ratchet. `tests/strings.baseline.json` holds each file's count of literal strings, and a count may only fall. The pseudo-locale is switchable in the labs.
- **W3b:** the files W1, W2 and W6 touched, after they merge; the baseline falls to zero for `src/ui` except the listed sim-text call sites.
- **Out of reach on purpose:** `src/content`, `src/sim` and `src/meta` text stay English and unedited (ground rule 7). `src/meta`'s own text (the "without you" lines, `run.ts`'s English) is shown through `tc`-style lookups by key where the UI renders it.
- **Done when:**
  - `src/ui` has no literal player-facing string outside the catalogue (the ratchet at zero, with the listed exceptions);
  - every screen and the HUD render in `en-XA` in the UI lab without clipping, and screenshots of each are taken;
  - `en` renders byte-identical text to today (the UI tests that pin text pass unchanged);
  - the pins are unchanged.

### W4: performance

- **Bench page** (`?bench=`): fixed scenes, each with a fixed seed, debug spawns and autoplay, as the e2e busy fight does. The scenes:
  - the Finale with the full choir and a Grand Silence;
  - a Movement II hound swarm with the Matriarch;
  - the Unweaver's peak;
  - Movement I with 150 enemies (05 §12's case).
  Each prints p50 and p95 CPU frame time, draw calls, triangles, entities, React commits a second and the JS heap at start and end (where the browser exposes it). The owner can open it on any laptop.
- **Budgets as tests** (`e2e/perf.spec.ts`): draw calls ≤ 200 and triangles ≤ 600k in every scene; React commits ≤ 20/s; the heap after ten minutes of the Finale scene within a set share of its start (the share set from W4's first reading and stated); CPU frame p95 recorded, asserted only against a gross-regression bound under SwiftShader.
- **Quality:** `auto` picks a tier from frame-time sampling over the first seconds of a fight, with a hysteresis. Dynamic resolution runs between 0.6 and 1.0 on `auto` (05 §5.1). Quality is a player setting; the default stays `high` (decision 8).
- **Bundle:** keep the title's load as small as it is or smaller. Check whether the three workers can share one chunk of sim and content. The weekly bench worker loads only from the lab.
- **Allocation:** a heap-sampling pass over the bench scenes in Chromium. Findings in files W4 doesn't own go to their owners with file and line.
- **Done when:** the bench page runs every scene in e2e with no error; every budget that can be measured here is asserted and met, or listed with its reading; the rest are recorded "not provable here"; `sim:bench --check` still passes.

### W5: saves

- **Fixtures written by real builds:** `tools/save-fixtures.ts` checks out each commit that bumped a version, in a scratch worktree, and writes a profile, a run mid-Movement and settings with that build's own code. It also writes the two demo starts as Version 13 and 14 wrote them. The fixtures are committed under `tests/fixtures/saves/`.
- **Migration matrix:** every fixture loads in today's build and plays its next fight to a hash equal to a fresh profile with the same content (for runs), or matches a recorded expected profile.
- **The fuzzer** (05 §8): random valid profiles of each version round-trip through every migration.
- **Corrupt saves:** when both copies fail to load, the raw text is moved to `aetherweaver.profile.corrupt` (or `.run.corrupt`) before anything is written. A notice says so once and offers the raw file for download. A new profile then starts.
- **Export and import** (decision 11): a file (`aetherweaver-save` v1 JSON, optionally gzipped) and a text code (deflated, base64url, with a check value), holding the profile, settings and any run. Import parses in memory through `loadProfile` and `loadRun` on a map store, shows what it holds (Rank, runs, a run in progress), backs up the current saves under `.before-import`, then writes. Settings import is optional.
- **Done when:** every fixture loads; the fuzzer runs in the suite; a corrupt profile keeps its raw text through two saves; export then import round-trips byte for byte; a garbage file or code is refused in words; e2e exports and imports through the panel.

### W6: visual polish (no aura)

- **The look items:** the borrowed accent ring gains a non-colour mark where its accent is close to a meaning colour (Phase 6 *Open* 7); the Atlas station's mint moves away from Training's cyan under tritanopia (*Open* 6); Borrowed Crowns' header fits (*Open* 5). The heal cue's motes are not moved (*Audit, Art*).
- **Motion:** hit reactions and death fades for enemies; an idle for the Weaver's ribbons and the heroes. All transform-only, inside the existing batches: no new draw call.
- **Bosses and the Weaver:** silhouette refinements inside the procedural builders, at no more triangles than the triangle budget allows in the bench's worst scene. Each change is listed with its snapshot entry.
- **Done when:** the render snapshots move only in the entries named; no new draw call (the pins); the colour-vision tests pass with the moved colours; the aura pin holds; screenshots of each change, before and after.

### W7: audio polish (no aura)

- **Loudness:** offline renders of each biome's moods and of a busy fight through the lab's renderer (`offline.ts`), measured for peak and RMS. Targets: no clip before the limiter; each biome's RMS within a stated spread of the others (from the first reading). Bus trims are adjusted only for non-aura sounds.
- **Voice caps:** the Ringing re-strike kept through busy fights; the dropped and skipped counts asserted under a stated ceiling in a scripted busy fight.
- **Ducking:** checked for each big moment against the captions' events.
- **The barks bus** and hero voices (decision 3, off by default): one synthesised non-verbal timbre per hero, drawn from pools per event with cooldowns (04 §4.3).
- **Done when:** the audio snapshots move only by the barks bus's nodes; the aura pin holds; the lab plays every new sound; the measurements are written into W7's hand-off.

### W8: release engineering

- **`assets/licenses/`:** each shipped package's licence text copied from `node_modules`, a `README.md` table (package, version, licence, what of it ships), and a note that no third-party asset ships. `tools/licenses.ts` rebuilds the table from the build's source maps and fails if a shipped module has no record.
- **`e2e/fullrun.spec.ts`:** a whole Finale-route Expedition played node by node through the real app: every fight through the combat screen with the Skilled bot's autoplay at a raised dev time scale, every draft, merchant, event, Respite and the Summary; sound on. Console errors, page errors, **warnings** and failed requests are collected; zero allowed. It runs outside the default e2e suite (its own script), since its length is unknown (*Assumed*).
- **`tools/release-check.ts`:** runs each checklist row's checks and prints green, red or "not provable here" with the evidence.
- **Builds:** `npm run build` and `build:demo` as today; the release notes record decisions 9, 10, 12 and 17. The Tauri notes go into *As built*.
- **Done when:** the licence record is complete and its tool passes; the full run is green once and its time recorded; `release-check` prints every row.

### W9: follow-ups and measurements

- **Behaviour-neutral fixes:** the bots' rule copies replaced by the sim's exports (5f *Open*), with the command snapshots byte-identical. 5f A2: the two Conductor goldens' named events are asserted, as additions only. Phase 6 *Open* 4: the lab bench's copy of the recorder. Phase 6 *Open* 1: the "without you" reading after a Postlude rise.
- **Measurements on the release candidate**, appended here, with no number changed:
  - the harness bands per Movement, and the tiers at 0, 10, 20, 30 and 42 (the protocol's size where the machine allows, or reduced and said so);
  - the report tools of Phase 6's ground rule 1, compared byte for byte against a pre-Phase-6 tree (5g *Open* 11);
  - pillar 1's correlation of Perfect Ward rate with grade and clear time over the Expert's tier-0 runs;
  - pillar 3's share of downs whose recap names a telegraph and an answer;
  - pillar 4's share of fight time each hero spends with no action;
  - pillar 5's dominance check (no preset best in every cell).
- **Done when:** every pin is byte-identical; each measurement is appended with its command.

### W10: review

An independent read of W0-W9 against this doc. It checks:

- the ground rules: re-run every pin; the aura pin; `git diff` on the aura files;
- that no new setting reaches a fight's config or a replay except as recorded today;
- that a gamepad-played, Auto-Threaded and slowed fight each replay bit for bit;
- the text layer's `en` output equal to today's;
- the saves matrix and the corrupt-save path.

**Done when** every finding has a file and line and is fixed with a regression test by its owning stream, or accepted by you.

### The release candidate and the demo

After W10, the orchestrator builds the release (`npm run build`), runs `tools/release-check.ts`, the whole e2e suite and the full run, and records each. It then publishes the demo as Version 15 (`npm run build:demo`, docs/demo.md *Publishing*), with demo.md's notes for the new options and the known balance notes.

## Tests

- **W0:** `phase7Contracts.test.ts` (defaults equal today; v4 settings parse unchanged; the text layer's `en` equals `format.ts`'s old output; `captionFor` and `gameSpeed` inert); `tests/aura/presentationPin.test.ts`.
- **W1:**
  - each binding (key, mouse role, modifier, pad button) to its command;
  - conflicts across devices;
  - hold-or-toggle for Thread mode and the wheel;
  - mouseover casting off;
  - a fake pad's stick quantised as keys are, with no allocation over 1,000 polls;
  - the reticle's order;
  - Auto-Thread's timing and target;
  - pad and keyboard scripts giving equal command lists;
  - e2e: pad in menus and a pad-played fight replayed in Node.
- **W2:**
  - each option's effect on its view;
  - Flashes 0 and reduced motion leaving no unscaled flare outside the aura views;
  - text sizes ≥ 12 px at 100% (a scan of class names and inline sizes, aura and ornament elements excepted and listed);
  - contrast of every text token;
  - captions: one per listed event, at most two live;
  - game speed: the same commands give the same hash at 0.7 and 1.0;
  - the badge from the run's record;
  - colour-vision pairs for the high-contrast telegraph mode.
- **W3:** the ratchet; `en` output unchanged; `en-XA` covers every catalogue key; plural and number formatting for `en`; no `src/content` or `src/sim` file changed (a `git diff` check in the test's hand-off).
- **W4:** bench scenes deterministic (same seed, same hashes); the budgets in `e2e/perf.spec.ts`; `auto` quality's pick on a scripted frame-time series; `sim:bench --check`.
- **W5:** the matrix over every fixture; the fuzzer; corrupt saves through two saves; export and import round-trip and refusal; e2e through the panel.
- **W6:** the snapshot entries it names and no others; no new draw call; colour tests for each moved colour.
- **W7:** the audio snapshots moved only by the barks bus; voice-cap counts in a busy fight; loudness readings in range; hero voices off by default and silent.
- **W8:** the licence tool against the build; `fullrun.spec.ts`; `release-check` on a known-red and a known-green fixture.
- **W9:** command snapshots unchanged; the A2 assertions.
- **Everywhere:** every pin of ground rule 1 and the aura pin byte-identical at each merge.

## Budgets and measurements

The budgets are 05 §12's, unchanged. What can be shown here, and how:

| Budget | Shown here by | Here or not |
|---|---|---|
| Frame time p95 ≤ 16.7 ms, mid-range iGPU, 1080p, 150 enemies | The bench page's Movement I 150-enemy scene | **CPU side only**, under SwiftShader in headless Chromium on 4 cores; the GPU half is **not provable here** (decision 8). The page is for the owner's laptop. |
| Sim tick ≤ 1.5 ms at 250 entities | `sim:bench --check` | here (ran: p95 0.186 ms) |
| Draw calls ≤ 200 | `e2e/perf.spec.ts`, every bench scene | here (the draw count doesn't depend on the GPU) |
| Triangles ≤ 600k | the same | here |
| React commits ≤ 20/s | the same | here |
| No per-frame allocation in hot paths | heap sampling over the bench scenes; no allocation in the new pad poll and option paths (W1, W2 tests) | here, as sampled |
| Memory flat over a 40-minute run | the heap over a long bench scene (`performance.memory` in Chromium) and the full run | here as a trend in one browser; a real 40-minute run on a laptop is not provable here |
| Initial download ≤ 25 MB | `npm run build` sizes in `release-check` | here (ran: 1.7 MB to the title, 7.2 MB in all without maps) |

## Exit criteria

| # | Criterion (06 §6, then this phase's) | How it is shown | Here or recorded |
|---|---|---|---|
| 1 | All pillar tests pass on the release build | W9's measurements on the RC (pillar 1's correlation, pillar 3's recap share, pillar 4's idle time, pillar 5's builds and dominance); the playtest halves | bot halves here; **the playtest halves need people** and are recorded "not done" with the demo's questions |
| 2 | Harness bands met in every Movement and at the tiers (0, 10, 20, 30, 42 points; Phase 6 decision 1) | W9's re-read on the RC | here; misses recorded as the known balance notes (decision 13) |
| 3 | Perf budgets met on the reference laptop | W4's assertions; the bench page | partly here (*Budgets*); the GPU half recorded "not provable here" |
| 4 | Accessibility options complete and tested with colour-blind simulation | W1 and W2's tests and lab views; colour-vision tests including the new modes; screenshots under each palette | here; "complete" means 04 §8 minus decision 15's sim-side items, which are recorded |
| 5 | Save migration tested from every pre-release version; export and import work | W5's matrix over fixtures written by each version's own build and by Versions 13 and 14 of the demo; e2e export and import | here |
| 6 | Zero console errors (and warnings) across a full scripted run | `e2e/fullrun.spec.ts` | here |
| 7 | Asset licences recorded in `assets/licenses/` | `tools/licenses.ts` | here |
| 8 | Every pin of ground rule 1 byte-identical except the presentation pins W6 and W7 name; `SIM_VERSION` 22; `contentVersion` unmoved; save versions unchanged | `m1Unchanged`, `dissonancePins`, the `--check` tools, the snapshot tests | here |
| 9 | No aura or ornament changed in look or sound | the aura presentation pin; `git diff` on ground rule 4's files; W10 | here |
| 10 | Vitest, typecheck and lint green; the e2e suite green, or recorded "not run" with the reason | CI and the hand-offs | here |

## Out of scope

- Commissioned or kit art, licensed or commissioned music, and recorded voices (decisions 1-3).
- Any translation beyond the pseudo-locale (decision 7).
- The Tauri wrapper, a service worker, installers and stores (decisions 9 and 10).
- Telemetry, accounts, servers and cloud saves (decision 14; 05 §1's non-goals).
- Any aura or ornament change, and everything held for you (*Decisions*).
- Any change to a balance number, a level, an Echo, the rotation, a bot's policy or a band (decision 13). W9 measures; it doesn't tune.
- New content of any kind.
- The sim-side assists of decision 15.
- WebGPU, mobile and touch controls, and a modding API (05 §1).
- A replay viewer that scrubs (05 §9).
- Fixing the content hash's second lane (Phase 6 *Open* 2): it would move every `contentVersion`.

## Assumed, not yet verified

- That the bench page's CPU frame times under SwiftShader say anything about a laptop's GPU. They are not claimed to.
- That `performance.memory` (Chromium only) is a usable trend for the memory budget.
- That the build that wrote each save version can still be built and run from git (`npm ci` at each commit, under today's Node). W5 finds out; where a commit can't run, its fixture is synthesised and marked so.
- How long `e2e/fullrun.spec.ts` takes under SwiftShader at a raised dev time scale. No whole run has been played through the combat screen in this environment.
- That a pad's analogue moves keep a human run's replay within the verifier's limits (`REPLAY_FILE_MAX_BYTES`, `runReplay.ts:74`): a stick sends more `move` commands than keys do. W1 measures it.
- That every place the HUD shows sim text has a content id to look it up by (decrees, barks). W3 lists those that don't.
- That the four contrast checks in tests cover the tokens they claim. W2's token test replaces them.
- That `prefers-reduced-motion` and the in-game setting together cover everything that moves. No person has watched reduced motion (docs/phase-6.md, *Not verified*).
- The per-file counts of strings: the scanner is a heuristic (it skips one-word strings and may count non-player text, such as error messages). W3's lint is the real count.
- That nothing ships beyond the nine packages listed. Read from the source maps of the main build. The three workers have no maps, and their bundled modules were not listed separately (they import the same sim, content and zod).
- That the fonts' unicode-range subsets load only on demand in every target browser.
- The size of the auto quality pick's effect, and dynamic resolution's: neither has been measured on any GPU.

*As built* and the release candidate's measurements are appended after the build.

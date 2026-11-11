# Phase 7: Polish and ship

*2026-11-10 · design and build spec · written at 6a2b5eb (main: all of Phase 6, merged, reviewed and tuned, and the Version 14 demo notes) · plan: [06 Phase 7](plan/06-roadmap.md) (lines 139-150: the Build list and its exit, "the release checklist (§6) is all green"), [06 §4](plan/06-roadmap.md) (the definition of done), [06 §5](plan/06-roadmap.md) (risks), [06 §6](plan/06-roadmap.md) (the release checklist), [06 §8](plan/06-roadmap.md) (decisions 3-5: platform, art, music), [04 §1, §4, §8](plan/04-presentation.md) (art sourcing, audio sourcing, accessibility), [05 §5, §7, §8, §10, §12](plan/05-technical-architecture.md) (rendering, localization, saves, testing, performance budgets), [02 §2](plan/02-game-design.md) (the pillars and their tests) · follows [Phase 6](phase-6.md) and the [playtest demo](demo.md) (Version 14)*

*Built 2026-11-11, on main at `f74a46b`: what was built, where it departs from this design, the aura and ornament items held for the owner, the reviews, the checks as run, what nobody has verified and what is open are in [*As built*](#as-built) and the sections after it, at the end of this doc.*

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

## As built

Written after the build, the two reviews and the fix streams, from the workstreams', fix streams' and reviewers' hand-backs, and checked against the code on main at `f74a46b`, where all of Phase 7 has landed. The sections above keep the design; where the code differs, *Differs from the design* says how and why. Every number here is the code's unless it is named as a reading, and a reading names the branch or log it came from. The release candidate's own runs and measurements are appended at the two marked places below.

Phase 7 added 102 commits on top of the design doc (`81a12ef`): 406 files changed. Nothing in `src/content` or `src/sim` changed except one read-only field in `src/sim/counterfactual.ts` (*Follow-ups*). In `src/meta` only `save.ts`, the new `saveFile.ts` and one optional key in `types.ts` changed. The full suite went from 224 files and 4,872 tests (W0, before any change) to 250 files and 5,287 tests at `f74a46b`; the e2e suite from 36 tests to 70.

### Contracts and the aura pins

- **Options** live in `src/app/settings.ts`. Every Phase 7 key, and every field inside one, is optional and absent from `DEFAULT_SETTINGS`, so a fresh save and a v4 save are byte-identical to before; settings stay version **4**. Code reads them only through `optionsOf(settings)`, which fills each absent key from `DEFAULT_OPTIONS` and keeps its answer per settings object, so a per-frame read allocates nothing.

  | Key | Default (absent) | Values |
  |---|---|---|
  | `reducedMotion` | `'system'` | `'system'`, `'on'`, `'off'` (`REDUCED_MOTION`) |
  | `telegraphs` | `{ opacity 1, outline 1, perfectBand 1, highContrast false }` (`DEFAULT_TELEGRAPHS`) | 0.6-1, 1-2, 1-2, boolean |
  | `answerGlyphs`, `importantNumbersOnly`, `slowmoVignette`, `heroVoices` | true, false, true, false | boolean |
  | `volumes.ambience` | follows Effects (`ambienceVolume`: `volumes.ambience ?? volumes.sfx`) | 0-1 |
  | `volumes.barks` | 1 (`barksVolume`) | 0-1 |
  | `input` | `DEFAULT_INPUT`: `threadMode 'toggle'`, `wheel 'hold'`, `mouseoverCast true`, `mouse { thread 'Mouse0', mode 'Mouse2', wheel 'Mouse1' }`, `cueModifier 'Shift'` (either Shift), `padBindings {}` | mouse roles: `Mouse0`-`Mouse4` or a `KeyboardEvent.code`; at most 3 pad buttons an action |
  | `aids` | `{ gameSpeed 1, autoThread false }` (`DEFAULT_AIDS`), outside `assists` | game speed 0.7, 0.8, 0.9, 1 (`GAME_SPEEDS`) |
  | `quality` | `'high'` | `'auto'`, `'low'`, `'medium'`, `'high'` (`QUALITY_SETTINGS`) |
  | `locale` | `'en'` | `'en'`, `'en-XA'` |

  A Phase 7 value this build can't read (a locale or quality a later build adds, a slider out of range, an unknown pad button) is left out and reads as its default; the rest of the file is kept (`fitOptions`, tried only when the file would otherwise be refused, so a file that reads today reads exactly as before). A bad key from before Phase 7 still refuses the file, as it always did. The assists' two literals now come from `ASSIST_VALUES` in `src/meta/runReplay.ts` (Phase 6 *Open* 3, settings half).
- **Input types** (`src/input/actions.ts`): `PAD_BUTTONS` (the 17 standard-mapping buttons in Gamepad API order, named by position: `faceDown` … `home`), `PAD_ACTIONS` (`reticleNext`, `reticlePrev`, `threadReticle`, `cueReticle`, kept out of `Action`), `PadBindable`, `PadBindings` and `DEFAULT_PAD_BINDINGS` (*Input*, below).
- **Runtime call sites** (`src/app/runtime.ts`): the stepper advances by `elapsed * devTimeScale * gameSpeed()` (`src/app/gameSpeed.ts`); captions go through `captionFor(event, state)` (`src/ui/hud/captions.ts`), once per event after the event switch; `FIGHT_END_DELAY_MS` and `WITHOUT_YOU_GRACE_MS` are imported from `src/meta/runEnd.ts` (Phase 6 *Open* 3, runtime half). `tests/perfPhase7.test.ts` pins these three sites.
- **The run's assist mark**: `RunState.assisted?: true` (`src/meta/types.ts`), kept by the run save's schema and dropped when absent.
- **`tests/phase7Contracts.test.ts`**: every default equals today's, written out; a v4 save parses, stringifies and migrates equal; the text layer's English equals `format.ts`'s old output over a recorded table; game speed 1 is inert; the Finale captions equal the old ones; the versions; the default Saves panel's markup.

**The aura pins.** Two, each with its fixture, its test and a recorder that refuses to overwrite; each file has exactly one commit, the one that recorded it.

- **`tests/aura/presentationPin.json`** (recorded by W0, `dddbb46`, before any source change). 19 cases: each of the six auras alone on the beam song and alone on the field song, and each ornament on each role it can take (Grace Note, Reverb and Pedal Point on both, Unison on the beam only), carried by Sostenuto, in one scripted sandbox fight (480 ticks, seed 7: a pour, a plant, the Weaver moved off it, Fermata's held-and-healed and run-out holds for the Fermata cases, a Crescendo). It records the field view's instance data and shader hash, the beam song as the Thread draws it (sheath, beads, the pour), Fermata's view, the Weaver bar's song chips as markup, and every audio node, write and call the aura sound methods make (`pour`, `fieldPlanted`, `chorusPulse`, `fermataHold`, `fermataReleased`, `ensureHarmony`, `ensureDrone`, `stopDrone`, and their writes on shared nodes such as the music duck). It runs twice, at the defaults and at the strongest comfort settings (Screen shake 0, Flashes 0, damage numbers and hints off, captions on, Reduced motion On, telegraphs at opacity 0.6, outline 2, Perfect band 2 and high contrast, answer glyphs off, important numbers only, vignette off), and both must equal the file. **It does not cover**: boss arenas (hymn circles, zones, Sanctuary pools, stolen verses), Calling looks, colour-vision palettes, Chorus Pulse firing (never fired in its script), the camera, the overlay and its vignette, CSS, the aura lines in `src/render/entities.ts` (beam swell, Fermata freeze and rim, coverage colours), feedback's transient aura effects, game speed, quality, hero voices and admission in a busy mix. Review A's findings 1, 8 and 10 were all in that list; each now has its own comparison test against `81a12ef` (*Auras and ornaments*).
- **`tests/aura/chordCardsPin.json`** (fix stream B, `caaf30f`, recorded from a `git archive` of `81a12ef`). 139 cases and 250 distinct cards of the Chord builder as static English markup: every slot card in both songs (filled, empty, open, locked) and every picker item, for each aura in each slot it can take and each ornament in each slot and song it can take, selected and not; Ranks 1 to 6 with their locks; everything "New"; clashing ornaments; the Martyr's Life; the presets' chip rows. The builder at `f74a46b` renders the same bytes. **It does not cover**: computed CSS (transitions), the pseudo-locale, the budget bars, or anything outside the cards.
- `npx vitest run tests/aura` passed before every commit that touched render, audio, the HUD, the kit or settings (the streams' hand-backs), and in every full run listed under *Verification as run*.

### Input: remapping and gamepad

Files: `src/input/InputController.ts`, `gamepad.ts`, `inputMap.ts`, `padBindings.ts` (new), `src/ui/screens/ControlsSettings.tsx`, `src/ui/kit/menuNav.ts`, `KeyCap.tsx` (two new components; `KeyCap` itself unchanged), `src/ui/hud/labels.ts`.

- **Remapping.** Every one of the 25 key actions, the three mouse roles (Thread the hovered hero, Mend ⇄ Empower, the wheel with its quick-click Focus) and the Cue-by-slot modifier take any mouse button (`Mouse0`-`Mouse4`) or any key. Conflicts are found across keys, mouse roles and the modifier, and swap or clear; a swap is offered only where the other action can hold the code it would get. Pad buttons conflict among themselves the same way. `writeInput` stores only what differs from the defaults.
- **Hold or toggle** for Thread mode (hold: Empower while held; a press from Empower or Bear does nothing) and the wheel (toggle: a press opens, the next press or a left click picks). A hold that is lost (pause, the window losing focus, a rebind, a pad unplugged, chorded mouse buttons) sends the mode back to Mend if the sim had seen its press.
- **Mouseover casting off**: Ward, Reel, Cue and Chime go to the threaded hero only; Chime then lands at the cursor; the Thread's own click still threads the hovered hero.
- **Controls** lists every action with its live mouse role and modifier, a Mouse section, the options (Thread mode, wheel, mouseover casting, Cue modifier, Auto-Thread), a Gamepad section (captured from the pad) and the fixed menu keys. Live input names reach the HUD's hints, KeyHints, How to Play, the party frames' call keys, the Codex's technique lines, and the Martyr's Bear (`LiveKey`, shown only once Bear leaves B; decision 18).
- **Gamepad in combat.** Polled once a frame while a pad is connected, paused included (so Start always pauses and unpauses), allocating nothing in our code. It reads one pad: the first connected with `mapping === 'standard'`, else the first connected. The left stick is shaped to 64 directions in eighths and quantised with `MOVE_STEP` (1/1024), so a full push along a key direction is that key's `move`. The right stick steps a reticle through living heroes in slot order (one flick, one step); the reticle stands in for "hovered" for the pad's presses. Plant lands on the reticle's hero, else the Weaver; Focus marks the enemy nearest that hero, else nearest the Weaver. Default layout (`DEFAULT_PAD_BINDINGS`): right trigger Threads the reticle's hero, left trigger Thread mode; bottom face button Glide, left Ward, top Chime, right Reel; right bumper Cues the reticle's hero, left bumper Crescendo; d-pad up Focus, right Rally, down Hold, left Scatter; right stick click the wheel, left stick click Plant; Start pauses. Buttons are labelled by position (●↓ ●→ ●← ●↑, LB, RB, LT, RT). No rumble.
- **Gamepad in menus.** One `useGamepadMenu()` in `src/app/App.tsx` serves every screen (the three per-screen calls are gone): arrows go to the screen's own handler first, else focus moves spatially among the screen's controls or the open dialog's; sliders and lists step left and right. It stands aside during a fight and while Controls waits for a pad button. The digit shortcuts on Draft, Respite, Calling and Scene stay keyboard-only.
- **Auto-Thread** (off): after `AUTO_THREAD_IDLE_SECONDS` (2) of sim time with no input, it sends `thread` to the hero with the lowest share of life (downed counts; dead and out of reach don't; ties keep the Thread). Held buttons, an open wheel and mouse movement count as input. Sim time, so it stops while paused and slows with game speed.
- **Tests**: `tests/inputPhase7.test.ts` (every action and mouse role rebound plays its default's command; the modifier; hold or toggle; mouseover off; conflicts across devices; writes only what differs), `tests/gamepad.test.ts` (no allocation over 1,000 polls; the stick; the reticle; a scripted pad and keyboard play a 600-tick Training fight to equal command lists, and the pad's fight replays bit for bit), `tests/inputNamesW3b.test.ts` (live names), `tests/reviewA7.test.ts` (findings 3, 4, 9, 11); `e2e/input.spec.ts` (the pad drives Title, Settings and Controls, the Loom and its dialog, Prep, Map, the first fight's primer, Result, Draft and the pause menu).

### Accessibility options

Files: `src/ui/screens/SettingsScreen.tsx`, `src/ui/presentation.ts`, `src/ui/kit/motion.ts`, `src/index.css`, `src/ui/hud/captions.ts`, `src/app/gameSpeed.ts`, and the settings call sites in `src/render` (`camera.ts`, `overlay.ts`, `combatView.ts`, `telegraphs.ts`, `fx/telegraphBatch.ts`, `thread.ts`, `calls.ts`, `feedback.ts`, `entities.ts`).

- **Settings rows** (strings in `src/ui/text/en/a11y.ts`): Sound gains Ambience (follows Effects until moved, with a "Follow Effects" button), the hero-voices volume and the Hero voices switch; Comfort gains Reduced motion (System, On, Off), Slow-motion vignette and Important numbers only; a Telegraphs section (opacity, outline, Perfect band, high contrast, answer glyphs); Assists gains Game speed (70, 80, 90, 100%); a Graphics section holds Quality. Rendering the screen writes nothing; Restore defaults removes the keys again. There is no locale row.
- **Reduced motion.** System (the default) is the OS setting for the UI, exactly as before, and leaves the fight as it was (the fight never read the OS setting). On: the stylesheet cuts animation through `data-motion="on"` on the root; `prefersReducedMotion()` follows the setting, and so do the five screens that used to read the media query themselves (Rank, the Reliquary twice, Without You, the Astrolabe map); in the fight (`fightStill`): no camera shake or zoom punch, no danger or chromatic pulse, no slow-motion vignette, particle bursts held still at half the count, no telegraph impact flash, the calls' glyphs don't pop, throb or burst, and W6's enemy recoil, idle breath, ribbon lift and death topple are off (a death fades as it did before W6). Off keeps animation whatever the OS says. The exceptions that keep aura presentation as it was are under *Auras and ornaments*.
- **Flashes** now also scales the telegraph impact flash and sparks, the Thread's pulse heads, the calls' glow and motes and feedback's particles (through `flareScale`). The beam song on the Thread, the field and Fermata never read it.
- **Telegraphs**: four uniforms in `telegraphBatch` (fill opacity, outline width, Perfect band width, high contrast); at the defaults the shader does the same arithmetic as before. High contrast draws the palette's own threat and lethal at full value with a dark outline; answer glyphs follow their own switch.
- **Answer glyphs off** draws a badge only when it carries a timer, with no glyph. **Important numbers only** keeps the Weaver's chips (Empower, songs, Ward blows), the Weaver's heals (Mend, Chime, revive) and the songs' heal numbers. **Vignette off** cuts the slow-motion vignette (Fermata's hold excepted).
- **Captions** (when Captions is on), at most two on screen (`CAPTION_KEYS`, two keys in turn), each lasting 1.8 s unless it has its own (`CAPTION_TTL`): every telegraph's wind-up with its timbre and side ("[Brass wind-up, left]"), at most one every 0.6 s (`WINDUP_GAP`), including one begun in Stasis once time resumes, and the non-damage telegraphs that sound; Tyrant's edict; the Postlude's rise and its pair Cue; a Mimic's first mirror; the low-life tone when a hero drops under 25% (`LOW_ALERT`), re-armed over 40% (`LOW_REARM`), at most one every 1.5 s (`LOW_GAP`), only while the low-life sound is on; the Finale's four, as before.
- **Game speed** scales only the runtime's real-time clock (`gameSpeed()`), never `SIM_DT` or `world.timeScale`. The audio follows it for non-aura sounds: telegraph wind-ups are stretched by 1/speed so they end on the hit, and A Tempo's beat input reads the sim's time scale times the speed (`SfxEngine.speed`, set by the director). At speed 1 every factor is exactly 1.
- **The assist badge** reads the run's own `assisted` mark. `withAssisted` (`src/app/gameSpeed.ts`) marks the run when a fight starts (`runFightStarted`, from `GameHost`'s effect, only for configs the run made) and when it ends (`finishFight`): any of the three assists away from its default, game speed under 1, or Auto-Thread on.
- **Text size**: 48 of the 50 sizes under 12 px moved to `text-[0.75rem]` (font size only, so line heights are unchanged). Two are held: both are in `ChordBuilder.tsx` (*Auras and ornaments*). `tests/textSize.test.ts` scans class names and literal inline sizes and lists the two.
- **Contrast**: `tests/contrast.test.ts` holds one WCAG helper and checks every text token on ink-950, 900, 800 and 700 at 4.5:1. Known and listed: lethal on ink-700 (4.04), and eleven colour-vision palette pairs (lethal under each vision, 3.12-4.05; tritanopia's ailment on ink-900 and 800). A new pair under 4.5 fails.
- **Labs**: the UI lab renders the Settings and Controls screens with every row; the VFX lab has controls for Reduced motion, the four telegraph options, answer glyphs, important numbers and the vignette beside its Flashes slider (`src/render/lab/VfxLab.tsx`), writing the store as Settings does.
- **Tests**: `tests/a11yPhase7.test.ts` (rows, game speed's same commands and hash at 0.7 and 1.0, a recorded fight under the comfort options, camera, overlay, captions, the badge), `tests/reducedMotionSites.test.ts`, `tests/renderPhase7.test.ts` (W6's motion under each setting), `tests/textSize.test.ts`, `tests/contrast.test.ts`, `tests/colorVision.test.ts` (appended: high contrast's threat and lethal stay ΔE ≥ 20 apart under each vision), `tests/reviewA7.test.ts` and `tests/reviewA7Audio.test.ts`; `e2e/a11y.spec.ts` (every option at its strongest in a fight with no error; the defaults write nothing; the rows write what they say; screens and HUD at 80, 100 and 150%; the aura and ornament interface's computed transitions in each OS and setting case).

### Localization readiness

- **The text layer** (`src/ui/text/`): `t(key, params?)`, `tc(kind, id, field)` (content text by id, English from `CONTENT`), the formatters `num`, `percent`, `seconds`, `clockText`, `plural` (through `Intl.PluralRules`, exactly `n === 1` in English) and `possessive`, `pseudo` (the `en-XA` pseudo-locale: accents, brackets, 30% padding, placeholders untouched), its own locale store (`useLocale`, `currentLocale`, `setLocale`), and `installLocale()` (`install.ts`, called once in `src/main.tsx`: `?locale=` wins, else `settings.locale`, absent meaning `en`). `src/ui/kit/format.ts` keeps its functions as fixed-arity wrappers over it, with output unchanged.
- **The English catalogue**: one module per source file under `src/ui/text/en/{hud,screens,common}/`, keyed `<area>.<file>.<slug>`, plus the area files `input.ts`, `a11y.ts`, `saves.ts` (each stream's own; `release.ts` is empty). 3,516 keys on main. A string in a module-level object became a getter, and the exported constants other files read became lookups (`mirrorChoirOthers()`, `expeditionsOnlyText()`, `nothingNew()`, `dormantLine()`, `PLAYTEST_LINE`, `FROZEN_HINT`, and the Finale's Fortissimo name, Discord label and defeat lines), so text is read in the locale in force when it is shown.
- **Sim and content text by source** (`src/ui/text/simText.ts`): a decree's name or text and a bark are looked up in `CONTENT` and the Finale's decree constants; found, they are localized; not found (Cracked Bell, Blood Frenzy, Unpicking, Overture, Mirror Choir, Postlude, and the bell and Matriarch texts in `src/sim/systems/bosses.ts`), the sim's English shows. Content and sim text are never edited.
- **Decisions on data, not words**: the Forge and event choices read a `short` flag, the status badge a `chime` flag, the note banner a `note: { n, of }` field, the wave toasts a `waves` prop, the Atelier chip its item's state; the Crescendo sparkle is decided from the callout's shape. In `en-XA` they style as in English.
- **The ratchet** (`tools/strings.ts`): counts literal player-facing strings per `src/ui` file (labs and the text layer excluded), including any string with a letter handed into a `t()` parameter. `tests/strings.baseline.json` holds the counts: **42** in all, five files, each held on purpose (*Open*): `WeaverBar.tsx` 8, `ChordBuilder.tsx` 23, `songs.ts` 4, `finaleLook.ts` 6, `resultText.ts` 1. `tests/textDecisionsW3b.test.ts` fails if the total passes 42 or the last committed baseline.
- **The pseudo-locale** is reachable from `?locale=en-XA` and the UI lab's English / Pseudo switch.
- **Tests**: `tests/textLayer.test.ts` (English `t()` equals each message; `en-XA` covers every key; plurals and numbers), `tests/textDecisionsW3b.test.ts`, `tests/calloutsLocale.test.ts`, `tests/inputNamesW3b.test.ts`; the 53 then 64 UI test files that pin text passed unchanged after every conversion batch; `e2e/locale.spec.ts` renders every UI lab view in `en-XA` and collects console errors and clipped or plain-English text (run on the W3a and W3b branches, *Verification as run*).

### Performance

- **The bench page**, `?lab=bench` (`src/app/bench.ts`, `src/debug/BenchPage.tsx`, `benchReport.ts`, `frameStats.ts`). Four scenes, each a fixed seed with debug spawns and the Skilled bot: `finale` (seed 9494: the choir reaches four, then the Grand Silence), `hounds` (8585: the Gorehound Matriarch and more hounds), `unweaver` (9393: the Unweaver's peak), `crowd` (4242: First Light, `CROWD_ENEMIES` 150 kept standing). Each prints real frame time p50 and p95 and fps, CPU time per frame, draw calls and triangles (p95 and max), entities, HUD commits a second, the JS heap at start and end, quality, canvas size and the last tick's sim hash, as plain text with a copy button. URL options: `&scene=`, `&quality=`, `&measure=`, `&repeat=`, `&gap=`. Nothing allocates per frame in the runtime's recording.
- **Budgets as tests** (`e2e/perf.spec.ts`): every scene's every measured frame within 200 draw calls and 600k triangles; HUD commits ≤ 20 a second (also checked in a 320 × 180 window on low, the only way to draw frames faster than the HUD's 15 Hz here); CPU frame p95 under a gross-regression bound of 400 ms (`CPU_P95_GROSS_MS`); each scene ending on exactly its headless hash. Opt-in: `AW_PERF_LONG=1` plays the Finale scene again and again for ten minutes and asserts the heap after a forced collection within a share of 0.1 of its start (`HEAP_SHARE`); `AW_PERF_SAMPLE=1` samples allocation. The readings on W4's branch, under software rendering on a loaded machine: at most 34 draw calls, at most 56,736 triangles (the crowd), 4.0-4.9 commits a second at 1280 × 720 and 10.1 at 320 × 180, CPU p95 9-19 ms, real frame p95 366-1,683 ms; the heap from 13.88 MB to 14.84 MB over 12.8 minutes (× 1.069; log `/home/user/aw-work/7/w4/e2e-long.log`). `e2e/smoke.spec.ts` still allows 220 draw calls.
- **Quality** is a player setting (Settings → Graphics), read live; absent is `high`, built exactly as before (the pixel-ratio formula is pinned by a test). `auto` (`AutoQuality`, tuning in `AUTO_QUALITY`, `src/render/stage.ts`): after 1 s of settling, it picks a tier over the next 6 s from 30-frame windows (a window also closes after 1 s once it holds 4 frames); a window whose 90th-percentile frame is over 20 ms steps down at once, and three in a row at 17.5 ms or faster step up (the tier at most once a fight). A window whose frames come at one steady interval (10th and 90th percentiles within 4 ms) of at most 36 ms is taken for a display cap and changes nothing. After the pick, dynamic resolution runs 1, 0.9, 0.8, 0.7, 0.6 (`RESOLUTION_SCALE_MIN`). The perf HUD shows "auto · low · 60%". The dev panel offers Auto.
- **`sim:bench`** gains a `crowd-150` scene (`tools/sim-bench.ts`).
- **Allocation**: the runtime's frame object is filled in place and the perf window lives in typed arrays. The remaining per-frame allocations W4 sampled in other files are listed under *Open*.
- **Tests**: `tests/perfPhase7.test.ts` (each scene twice headless to one hash; the scenes' kits pinned to `tools/kits.ts`; the read-out; `auto` on scripted frame-time series), `tests/reviewA7.test.ts` (the display cap at 30, 48, 50, 60 and 120 Hz); `e2e/perf.spec.ts`.

### Saves

Files: `src/meta/save.ts`, `src/meta/saveFile.ts` (new), `src/app/saveTransfer.ts` (new), `src/ui/screens/SavesPanel.tsx`, `src/ui/text/en/saves.ts`, `tools/save-fixtures.ts`, `tools/save-fuzz.ts`.

- **Fixtures written by real builds** (`tests/fixtures/saves/`, 19 files and `expected.json`): `tools/save-fixtures.ts` checked out each of the 15 commits that bumped a save version (run 1-5, profile 1-10, settings 1-4) in a scratch worktree and wrote a run mid-Movement, a profile and settings with that build's own code; and both demo starts of Versions 13 (`2554e69`) and 14 (`6a2b5eb`). All 19 were written by their builds; none had to be synthesised.
- **The matrix** (`tests/meta/saveMatrix.test.ts`): each fixture loads from its main copy; a profile equals its recorded profile; a run's next fight, 1,800 ticks with no commands, hashes to its recorded hash and to a "fresh twin" built field by field from the raw save's own values (`NESTED_DEFAULTS` for nested fields an old save never had, which throws on one it doesn't state); settings read as recorded; none is set aside as unreadable; each exports and imports byte for byte.
- **The fuzzer** (`tools/save-fuzz.ts`, in the suite through the matrix file; `npx tsx tools/save-fuzz.ts --seeds N`): random profiles written back as each version 1-10 stored them load, keep their fields and round-trip; random runs round-trip; damaged saves, files and codes never throw.
- **A save that won't load**: when neither copy loads, each copy's raw text is kept under its own key plus `.corrupt` (`aetherweaver.profile.corrupt`, `aetherweaver.profile.bak.corrupt`, and the same for the run) before anything is written, and a new profile starts. A kept copy is never overwritten: a later, different one goes beside it under `.corrupt.latest`. Near-full storage: the main copy is kept alone, or in the backup's room; storage that refuses every write leaves the copies where they were. A one-time notice over every screen (`KeptSaveNotice`, mounted in `App.tsx`) says so and offers the download; the Saves panel lists each kept save with "Download it" and "Forget it…". When the kept text is JSON, its download is a v1 save file the import can read (`keptDownload`), which then says why it can't load here.
- **Export and import** (Settings → Progress; export only from a fight's pause menu): a file (`aetherweaver-save` version 1 JSON, gzipped accepted on import) and a text code (`AWSAVE1.<crc32>.<base64url of the deflated JSON>`, spaces, line breaks and a lower-case prefix tolerated, the check value tested before anything is inflated), holding the profile, the settings and any run. Import reads in memory through the same loaders, shows Rank, record, the run in progress and what is left out, keeps the five keys under `.before-import`, then writes each save's text exactly as the file carries it; settings only if the player ticks the box, written to storage and read on the reload. A run that can't continue here is dropped with a word; a profile that won't load refuses the file. The first `.before-import` copy is kept through later imports until the player puts it back ("Put them back…") or forgets it ("Forget them…"); the warning says when an earlier copy is kept. Limits: 8 MB as opened, 16 MB inflated, 16 MB of code text, JSON nested at most 64 deep, 524,288 characters per save (`SAVE_TEXT_MAX_CHARS`; the largest real save among the fixtures is 35,581). Each refusal is in words.
- **A run kept on the way out**: the `pagehide` save in `src/app/runStore.ts` now saves only a run held in memory, so closing or reloading the tab at the Title or the Loom no longer deletes a saved run that hasn't been resumed (a bug from before Phase 7, found by W5 and shown failing by fix stream 1).
- **A migration bug fixed**: run saves written by `ad36f11` (v4) lack `reward.threat`, added at `17dbc56` without a version bump, so they had not loaded since; `threat` now defaults to 1 in the node schema, as `v3to4` gives older maps.
- **Tests**: `tests/meta/saveFile.test.ts`, `tests/meta/saveMatrix.test.ts`, `tests/runKept.test.ts`, `tests/reviewB7.test.ts` (findings 1, 4-7, 9), `tests/savesPanel7.test.ts` (the panel's states); `e2e/saves.spec.ts` (export and import through the panel, refusals, a corrupt profile kept, the notice once, import twice then put back, forget, a kept profile's download read by the import; the demo-only test skips in the normal build) and `e2e/runKept.spec.ts`.

### Visual polish

Files: `src/render/entities.ts`, `tyrant.ts`, `tyrantCues.ts`, `src/ui/screens/AtlasParts.tsx`.

- **The borrowed accent ring** (Phase 6 *Open* 7): where a foe's accent is within 20 ΔE (`TYRANT_MARK_DELTA_E`) of any role in the player's own colour-vision palette, as that vision sees both (`tyrantAccentNearMeaning`), the band's four beads become small crowns instead of diamonds. Same sprites batch, same 8 sprites and 2 rings.
- **Borrowed Crowns' header** (Phase 6 *Open* 5): the constellation panel's name has its own line and the progress sits under it; no text changed.
- **Motion**, transform-only inside the existing batches: an enemy hit recoil (up to 0.16 m back from its facing, a lean and a squash, about 0.18 s; bosses and mini-bosses half; dropped under Stasis); a death that falls before its 0.75 s fade (`deathPose`, `deathDissolve`; Restless Dead's crumble unchanged); an idle breath and sway for heroes and the Weaver (`IDLE`), off while held, stilled, down or dissolved, and on no frame the beam song's swell is drawn; a slow lift of the Weaver's ribbons at rest (with `still` 0 the old points exactly). All of it is off under Reduced motion On.
- **Not changed**: no boss or Weaver silhouette, so no render snapshot entry moved; the Atlas mint (*Auras and ornaments*); the heal cue's motes.
- **Tests**: `tests/renderPhase7.test.ts` (every Tyrant foe under every vision gets crowns exactly where near; the header; hit, death, idle and ribbons, each pushing one instance a frame; the motion under each Reduced motion setting), `tests/reviewA7.test.ts` (the swell through a whole pour, against `81a12ef`).

### Audio polish

Files: `src/audio/barks.ts` (new), `engine.ts`, `director.ts`, `sfx.ts`, `conduct.ts`, `types.ts`, and the lab (`lab/offline.ts`, `AudioLab.tsx`, `soundBoard.ts`, `fight.ts`).

- **Hero voices** (decision 3, off by default): one synthesised non-verbal timbre per hero (a waveform through two vowel formants, plus breath), pitches quantised to D dorian, drawn from content's bark categories, call thanks and Directive acknowledgements, 14 kinds and 30 gestures in turning pools. At most one voice a hero every 3 s (`HERO_VOICE_COOLDOWN`; a downed or revived cry is never held), 0.9 s between any two (`BARK_VOICE_GAP`), two at once (`BARK_VOICE_CAP`); none in the Grand Silence; a saturated mix skips them first. They play on a barks bus (`Engine.barksBus()`: duck, volume, master, a reverb send, trim 0.7, `BARKS_TRIM`) that is built only when the first voice sounds, so with the option off the graph and every node and write are as before. It dips with the effects bus on Perfect Ward and Save, never with a music-only duck such as Fermata's.
- **Sliders**: the ambience bus follows `ambienceVolume` (absent: Effects, exactly as before); the barks slider writes nothing until the bus exists.
- **Voice caps**: `KEPT_WHEN_SATURATED` lets `fill:ringing` (the Ringing and its re-strike), `lowLife`, `dissonance:edict` and `dissonance:pair` through a saturated mix, under their own caps and rate gates. Barks-bus sources and voices admitted only by that set are counted apart (`stats.uncounted`, `uncountedSfx`) and left out of the saturation check, so every other sound's admission, every aura voice's included, is as before.
- **Loudness**: `loudnessReport`, `loudnessOfMood` and `loudnessOfFight` in `lab/offline.ts` render with the signal tapped before and after the limiter. No bus was trimmed.
- **The lab** (`?lab=audio`): a "Phase 7 · Hero voices" group (a button per hero and pool, and a real bark event per hero), ambience and barks sliders, a hero voices switch, a loudness button and table.
- **Readings** (W7's branch, one seed each, hero voices off; `/home/user/aw-work/7/w7/loudness-1.json`): pre-limiter peaks −10.5 to −21.2 dBFS for the moods and −5.5 to −6.5 for three busy fights; time over the limiter's threshold ≤ 0.01%; the biomes' energy means within 2.6 dB (the Rift the quietest); hero voices peak −24.0 to −32.3 dBFS. In a scripted busy fight (`first_light` with a crowd of 20, 40 s): 142 peak sources, 110 of 800 frames saturated; asserted under ceilings of 75 saturated refusals, 15 dropped, 160 skipped and 175 peak sources. Ducking, asserted no deeper than −6 dB on any captioned sound: the deepest is the low-life heartbeat on the ambience bus under a Perfect Ward, −6.0.
- **Tests**: `tests/audioPhase7.test.ts` (voices off add no node and no write for every hero and line; a real fight sounds the same with and without its bark events; key, bus, cooldowns, cap, pools, the Grand Silence, saturation; the busy fight's ceilings; ducking), `tests/reviewA7Audio.test.ts` (wind-ups end on the hit at 0.9, 0.8 and 0.7; A Tempo within 30 ms of the sim's downbeats; no aura sound follows game speed; aura admission against `81a12ef`). The Spire and Rift audio snapshots did not move.

### Release engineering

- **`assets/licenses/`**: 11 packages, each with its licence text copied byte for byte from `node_modules` (as `LICENSE`): react, react-dom, scheduler, three, zod, zustand, the three `@fontsource` families, tailwindcss and vite (both emit code into the build); a `README.md` table and the note that no third-party asset ships. `tools/licenses.ts` (`npm run licenses`) rebuilds the shipped list from the build's source maps (main bundle and workers), its font files and the runtime dependencies, and fails on a shipped module with no record or a changed copy, a stale row, a licence outside MIT, ISC, BSD, Apache-2.0, OFL-1.1 and 0BSD, a record for something not shipped, or any build file that is not code, style, a page, a map or a font. CI runs it after the build.
- **`e2e/fullrun.spec.ts`** (`npm run e2e:fullrun`; skipped unless `AW_FULLRUN` is set, so `npm run e2e` skips it): a whole Finale-route Expedition, Skip the unlocks set through Settings, every fight through the combat screen with the Skilled bot's autoplay at dev time scale 4, every other stop through its screen by clicks and keys, sound on. Only the choice of the next map stop goes through the store action a click calls (`__AWRUN__.choose`), with a planner that visits the most kinds of stop. It collects console errors and warnings, page errors, failed requests and 4xx/5xx responses (one allow-list entry, for software-GL driver messages) and requires victory, sound running and every list empty. `AW_FULLRUN_SEED` picks the seed (default 4242); `AW_FULLRUN_FAST=1` wins fights through the hook to check navigation, and `release-check` counts that as red. `window.__AWFULL__` (read-only, behind `?e2e`) feeds it.
- **`tools/release-check.ts`** (`npm run release-check`): prints the seven checklist rows and exit criteria 8-10 as green, red, "not provable here", "accepted" or "not run", each with its evidence; a row takes its worst part; red exits 1, and `--strict` also fails on "not run". On its own it runs only quick checks (the licence check against `dist/`, the build sizes, the version pins, `git diff` of the aura files against `6a2b5eb`, the aura pins' commits); `--run goldens,sim-bench,typecheck,lint` runs those; the long runs are read from logs (`--suite`, `--e2e`, `--fullrun`, `--baselines`). Every log must carry `[evidence] commit <sha>` for the checked commit on a clean tree, or that row is red; the e2e part needs a result for every `e2e/*.spec.ts` file; row 4 names its test files; row 2 reads "accepted (decision 13)"; row 9 is green only when ground rule 4's eight files and the six aura and ornament glyphs of `iconPaths.ts` are unchanged, each aura pin has one commit, and both aura pin tests pass in the suite log. CI runs it with no flags after the build. `/home/user/aw-work/6/full-suite.sh` and `/home/user/aw-work/7/e2e.sh` write the stamp.
- **`README.md`**: build, test and run; the controls, with the gamepad's defaults and every remapping option; the scripts; the release notes (no offline mode, no desktop wrapper and what one would need, the demo's starts out of the release, the dev panel, test hook and labs kept); the licence record.
- **Tests**: `tests/releaseTools.test.ts` (known-green and known-red fixtures for both tools, a real `vite build` checked by the licence tool, stale and dirty evidence, the parsers).

### Follow-ups

- **The bots' rule copies** (Phase 5f *Open*): `chainOpen` reads the sim's `openChain`, and `finaleFree` is gone, the Novice and Skilled bots reading `finaleTurnBlock(state, id) === null`; the command snapshots, goldens, Dissonance pins and baselines are byte-identical. `marcatoReady` and `soloFullIn` stay copies (*Differs*).
- **5f A2**: `tests/bots/conductingBots.test.ts` plays the two Conductor goldens as `runScenario` does, checks their hashes, and asserts what they produce: `novice-conducting-first-light` wins, Cues a chain with a Cued Solo and has Triad hold the meter; `skilled-conducting-silent` wins at 86.8 s, plays Grand Finales, reaches the Grand Silence and loses a turn to stilling, gives Marcato and makes a Duet.
- **Phase 6 *Open* 4**: `src/ui/lab/weeklyBot.ts` exports a `recordBotRun` identical to `tools/run-verify.ts`'s (the lab copy had drifted: no allowance, no run returned, and it recorded a fight the bot never ended). `tests/weeklyBotParity.test.ts` checks the two sources are identical and record the same Prelude.
- **Phase 6 *Open* 1**: the "without you" result carries `rose?: true` when the re-run's boss rose again in the Postlude (`src/sim/counterfactual.ts`, read only; `WithoutYouSchema` keeps it, absent when absent), and the line says "…, with the boss risen again, at N%" on a defeat or timeout (`withoutYouText.ts`). Not part of the sim hash or the run fingerprint. `tests/withoutYouRise.test.ts` (on a staged fight: the party alone never gets the Conductor past the Grand Silence).

### Versions

| What | Value | Change |
|---|---|---|
| `SIM_VERSION` (`src/sim/constants.ts`) | 22 | unchanged |
| `contentVersion` (`tests/sim/golden.json`) | `c-691f26eff5775748` | unchanged |
| Fight replay format (`src/sim/replay.ts`) | 6 | unchanged |
| Run replay (`RUN_REPLAY_VERSION`) | 1 | unchanged |
| Run save (`RUN_SAVE_VERSION`) | 5 | unchanged (one optional key, `assisted`) |
| Profile (`PROFILE_VERSION`) | 10 | unchanged |
| Settings | 4 | unchanged (optional keys only) |
| Save file (`SAVE_FILE_VERSION`, new) | 1 | new: `aetherweaver-save` |

### Pins

Every pin of ground rule 1 is unchanged: `git diff 81a12ef f74a46b` is empty on `tests/sim` (the 32 goldens and `contentVersion`, `m1Unchanged`, the ten fight-replay round-trips, `dissonancePins.json`), the command snapshots and the other pinned JSON in `tests/bots`, `tests/meta` and `tests/fill`, every `tools/*-baseline.json`, and the four render and audio Spire and Rift snapshot tests. The golden dry run reads "Goldens are up to date", and the pin tests passed in every full run under *Verification as run*. No render or audio snapshot was re-recorded: W6 changed no model, and W7's bus is built lazily. The two new pins are the aura pins above.

### Differs from the design

1. **Pad-only actions** are a separate `PAD_ACTIONS` list, not appended to `Action`: every `Action` must have a Controls row (`tests/uiBindings.test.ts`), which would have shown them as keyboard rows.
2. **`input.cueModifier`** (default `'Shift'`, either Shift key) was added to the contract for "the Cue-by-slot modifier is bindable"; the design's list lacked it.
3. **Every new key and nested field is optional and absent**, not given a schema default, so v4 saves parse to exactly what they were; code reads through `optionsOf`.
4. **`captionFor(event, state)`** returns a callout and runs once per event after the event switch, not inside its `default:` branch, so captions can hang on events that have their own case (Tyrant's edict arrives with a `decree`).
5. **The text layer keeps its own locale store**; `installLocale()` connects it to `settings.locale` and `?locale=` from `src/main.tsx`, a file no row named. A locale change reaches screens on their next render, not at once (the lab re-keys its stage; `?locale=` takes effect at load).
6. **No locale row in Settings**: the pseudo-locale is reachable from `?locale=en-XA` and the UI lab, as the contract said.
7. **Reduced motion's System** changes only the UI, as the OS setting always did; only On holds the fight still. The white full-screen flash is left to Flashes. Reduced motion On zeroes every camera shake and punch, not only screen shake's share (Screen shake 0 already did that), except the aura moves under *Auras and ornaments*.
8. **The low-life caption** is derived from the sim's damage and heal events, mirroring the sound's own rule, not from the sound itself; the sound has no hook the runtime reads.
9. **Captions cover more**: every telegraph's wind-up with a sound, the non-damage ones included (review A finding 7), not only damaging wind-ups.
10. **The 12 px minimum** is met by 48 of the 50 sizes, with `text-[0.75rem]` rather than `text-xs` (line heights unchanged). The two left are aura elements, as the design said; three sizes in `WeaverBar.tsx` that sit on non-aura elements (the Spirit bar's "· all free" note, a technique variant's name, the Cue-cost marks on the Resonance gauge) did move.
11. **The four test copies of the contrast helper** (`uiPhase4c` to `4f`) were not replaced; `tests/contrast.test.ts` holds the shared helper beside them.
12. **The bench page is `?lab=bench`**, not `?bench=` (`App.tsx` reads only `lab`). Its scenes are the design's four, with the Finale's choir at four and the hounds as the Matriarch plus extra hounds. "Ten minutes of the Finale scene" is repeated passes of the scene (its fight is won in under two minutes), and the test is opt-in, not in the default e2e run.
13. **The title's load is not smaller.** W4's own edits added about 1.2 KB raw (the bundler regrouped modules); the text layer's English catalogue added much more (*Open*). The three workers still each bundle the sim, content and zod: Vite builds a worker as its own bundle, and sharing needs one worker entry.
14. **The ratchet is at 42, not zero**: the held aura strings, `finaleLook.ts`'s six (a test builds its pseudo-locale lines from them) and one sim source name used for matching (*Open*). The ratchet names them only as per-file counts.
15. **Content names** (relic, aura and enemy names and the like, shown straight from `CONTENT`) do not go through `tc()`; in `en-XA` they stay English.
16. **The audio snapshots did not move at all**: the barks bus is built on the first voice, so no node was renumbered. The design expected one re-record for the bus.
17. **`KEPT_WHEN_SATURATED`** keeps the low-life alert, Tyrant's edict and the Postlude pair Cue through a saturated mix as well as the Ringing, which goes beyond the design's "the Ringing re-strike kept". It changes the default sound in busy fights (review A noted it; accepted).
18. **Loudness is not read in the suite**: Node has no OfflineAudioContext and no row owned an e2e spec for it, so the readings come from a scratch script through the audio lab in headless Chromium.
19. **No silhouette changed, and the Atlas mint did not move** (*Auras and ornaments*). The borrowed ring's mark is crowns in place of its diamond beads.
20. **W6's motion follows Reduced motion** (fix stream 2): the design gave render no reduced-motion reading for new motion.
21. **The licence record holds 11 packages**, not nine: tailwindcss and vite emit code into the build although no source map lists them.
22. **`release-check` has two states the design lacked**: "not run" (nobody supplied the evidence) and "accepted" (decision 13's band misses). It reads the long runs from stamped logs instead of running them.
23. **The full run** picks map stops through the store action a click calls; its dev time scale of 4 gains little over 2 (the runtime steps at most 5 ticks a frame). A Skilled-bot defeat fails it: it must be a whole run to count, so the seed is part of the evidence.
24. **The bots' rule copies**: only `chainOpen` and `finaleFree` could be replaced without moving a pin. `marcatoReady` stays a copy: the sim's `marcatoReadyIn` allows a 1e-9 s tolerance and moved the golden `skilled-conducting-silent` (`d200c6af6720f641` to `3adcea1b4c5e1842`) when tried. `soloFullIn` stays a copy: no sim export gives a hero's Solo charge time from a `WorldState`. `chainOpen` itself now differs from the old copy within that 1e-9 s tolerance: over 144 Conductor fights the readers disagreed on 3 ticks and the commands were identical.
25. **5f A2 is partial**: First Light's golden does not depend on the Novice's draws at all (its hash is the same with each draw off), and the Silent golden never casts Fortissimo Silence, so neither shows what its comment says. Fixing that means new scenarios, which moves goldens; held.
26. **Phase 6 *Open* 1 was fixed outside the file the design named.** `src/app/withoutYou.ts` only starts the job; the reading is made in `src/sim/counterfactual.ts`, kept by `WithoutYouSchema` in `src/meta/save.ts` and written in `withoutYouText.ts`. The new field is outside ground rule 2's list of allowed edits; it is read-only, outside the hash, and the pins hold.
27. **Fixtures and saves**: the matrix's "hash equal to a fresh profile" is read as a recorded hash plus a fresh twin built from the save's own values. Kept unreadable saves are per copy (`.bak.corrupt`) and bounded to the first and the latest (`.corrupt.latest`), not one `.corrupt` key. Import writes the file's text, not the loader's re-serialised form (what makes the byte-for-byte round trip possible), and does not set the settings store before the reload (review B finding 1). A second import never replaces the first `.before-import` copy.
28. **The assist mark** is set when a fight starts (from `GameHost`'s effect) and when it ends, from Settings at those moments; an assist switched on and off inside one fight is missed. W1's `autoThreadSent` getter is not used for it.
29. **Space in the pause menu** now presses the focused button (Resume is focused first), where before Phase 7 it did nothing; kept as standard behaviour for a focused button (review A finding 9).
30. **A second aura pin** (the Chord builder's cards) was added after review B; the design had one.
31. **`release-check`'s aura base is `6a2b5eb`** (the commit the design was written at); the pins were recorded from `81a12ef`, which adds only the design doc to it.
32. **Test files outside the rows**: `tests/releaseTools.test.ts` (W8), `tests/weeklyBotParity.test.ts` (W9), `e2e/locale.spec.ts` (W3a) and the review and fix streams' test files.

### Auras and ornaments

**The standing rule.** No aura or ornament changes in look, sound, numbers or reach without the owner's approval in person, and comfort options (Flashes, reduced motion, high contrast, UI scale) leave them exactly as they were. Where Phase 7 was found to have changed one under an option, it was put back exactly as it was at `81a12ef`, never given a new look. `git diff 81a12ef f74a46b` is empty on ground rule 4's eight files, on `iconPaths.ts` and `Ring.tsx`; the frozen aura lines of `src/render/entities.ts` and the aura handlers' bodies in `src/render/feedback.ts` have no removed line.

**Found changed, and put back:**

- **Fermata's hold and Pedal Point's plant on the camera and the vignette** (review A finding 1). Reduced motion On had removed the hold's zoom punch and the plant's thump, and On or Vignette off had removed the vignette the hold's slow motion raises. Now an aura's own camera moves pass Reduced motion (`CameraRig.aura`, set by feedback around the aura handlers; Screen shake still scales them as before), and a `'hold'` slow motion keeps its vignette whatever the options say (`Overlay.setSlowmo(v, aura)`). Every other camera move and vignette follows the options. Evidence: `tests/reviewA7.test.ts` drives the real `CombatView`, `Overlay` and `CameraRig` through a plant, a hold, its release, a hero downed and a Crescendo and compares every frame's camera position (to 1e-9 m) and vignette with `tests/reviewA7Fight.81a12ef.json`, recorded from `81a12ef`: all 420 frames identical at the defaults and at Screen shake 0; frames 0-242 (the plant, the punch, the 0.44 vignette) identical under Reduced motion On and with the vignette off.
- **The reduced-motion stylesheet on the aura and ornament interface** (review A finding 2). With the OS reducing motion and the setting Off, the Weaver bar's song chips had kept their transition; with the setting On, the Chord builder's aura and ornament slot cards and picker items had lost theirs. In `src/index.css`, the chips, the slot cards (`[data-testid='chord-builder'] [data-testid^='song-'] [aria-pressed]`) and the picker items (`[aria-labelledby='palette-title'] [aria-pressed]`) now follow the OS setting alone, as before. Evidence: the last test of `e2e/a11y.spec.ts` reads their computed transitions in the four OS × setting cases against `81a12ef`'s rule (0.12 s for chips, 0.15 s for cards and picker items, 1e-05 s when the OS reduces); it fails on the old stylesheet.
- **The budget bars**: the Chord builder's Spirit and Life budget bars draw each song's share in its aura's colour and ease their widths, and Reduced motion On had cut that. They now sit with the chips and cards (`[data-testid='chord-builder'] [role='img']`), following the OS alone (`8b47ca7`), and the same browser test reads their transition in each case.
- **Hero voices in the saturation count** (review A finding 8): with voices on, barks-bus sources counted toward the 150-voice total, so an aura voice (pour, Pedal Point, Chorus) could be refused. Now uncounted. Evidence: `tests/reviewA7Audio.test.ts` replays five busy fights that ask for the pour, Pedal Point, Chorus Pulse, Fermata's hold and its release while saturated, under `81a12ef`'s admission rule and the engine's, with voices off and on: every aura key's admissions and times identical (before the fix, one or two differed in each fight).
- **W6's idle over the beam song's swell** (review A finding 10): for about half a second as a pour started and ended, the poured hero breathed and swayed on top of the swell. Now no idle on any frame `rec.beam` exceeds 0.001. Evidence: `tests/reviewA7.test.ts` compares the poured hero's every pushed instance through a whole pour (ticks 60-240) with `tests/reviewA7Pour.81a12ef.json`: all 240 frames identical (164 had differed).
- **The Life budget's cap label** ("← you keep at least N%"), moved from 11 to 12 px by the text-size pass, sits beside the songs' shares in the auras' colours; it went back to 11 px (`b00a410`) and is listed as held in `tests/textSize.test.ts`.
- **Game speed and aura sounds**: game speed reaches non-aura sounds only; `tests/reviewA7Audio.test.ts` shows the aura pin's sounds computed at 0.7 equal the pin. Fermata's held note already covers the hold at 0.7, and was left alone.

**Held for the owner** (each left as it was; each needs the owner's approval to change):

1. **Two 11 px labels in `ChordBuilder.tsx`**: the Calling's tag on a bonus aura or ornament slot card (line 689) and the Life budget's cap label (line 1214). Changing them is a class edit and a line out of `tests/textSize.test.ts`; the first would also move the cards pin.
2. **The song chips' and cards' strings left unconverted**: 8 in `WeaverBar.tsx` (`ChordChips`, `ChordGroup`, `AuraChip`: "No auras sung", the Field song's title, "Field", Pedal Point's title, "Plant", the stolen aura's title, "Focus", the aura reserve's title), 23 in `ChordBuilder.tsx` (the slot and picker cards, the reserve note a song card passes to its aura slots, the Life budget's cap line), and the beam song chip's tooltip (`beamTitle`, 4 in `src/ui/hud/songs.ts`). They stay English in `en-XA`. Converting them would print the same English bytes, but it edits aura elements.
3. **Telegraph wind-up sounds refused under saturation** (`wind:*`): keeping them through a saturated mix moves two pinned audio snapshot entries (`crimson_spire:fight:vharun`, `abyssal_rift:fight:the_unweaver`). W7 tried it and reverted it.
4. **The beam song's pour refused under saturation**: 5 of 16 in W7's busy fight, as before Phase 7. It is aura admission.
5. **The low-life heartbeat's 6 dB dip under a Perfect Ward** (the deepest dip of any captioned sound): changing it moves the pinned `perfect` audio snapshot entry.
6. **The Atlas station's mint** (Phase 6 *Open* 6), 4.6 ΔE from Training's cyan under tritanopia: no colour in the sRGB cube is both further from Training's cyan and no closer to any of the six aura and four ornament colours, in every vision (W6's search, `/home/user/aw-work/7/w6/scripts/`). Relaxing the rule to normal vision gives `#88fce2` (12.1 ΔE from Training under tritanopia) at the cost of moving closer to the ornament cyan under tritanopia (10.8 to 7.1) and to the call white in the red-green palettes (16.5 to 9.4). Moving Training's cyan instead loses at least 7.8 ΔE to some protected colour. The stations carry a name and a drawing.
7. **The field and Fermata under comfort options**: neither takes a Flashes value or honours reduced motion, as the design listed; the beam song on the Thread likewise never reads Flashes.
8. **The earlier phases' held items**, unchanged: Phase 5g's W7 (four auras, six ornaments, their motifs, one Harmony, one relic) and its aura line; Phase 6's decision 5 (Echo twists that shrink or weaken auras, a forced Muted Choir, Tyrant or Mimicry borrowing a mechanic that silences auras); Phase 6's held Tyrant entry (the Seamstress's phase 1 borrowing the Shears' Shearing Dash, which cuts the Thread the beam song rides).

### Review

Two reviews read the integration tip `d22f5e0` against `81a12ef`: review A the fight side (input, accessibility in the fight, render, audio, performance), review B everything else (saves, the text layer, release engineering, the app shell). Fix streams A and B fixed their findings on the defaults the orchestrator set (the owner being away); a third fix stream wired fix stream B's save behaviours into the Saves panel. Every fix carries a regression test that fails on the code before it.

| Finding | Severity | Decision | Fixed in, and its test |
|---|---|---|---|
| A1: Reduced motion On and Vignette off changed Fermata's hold punch, the plant's thump and the hold's vignette | blocker (owner's rule) | put back as at `81a12ef`; every other move follows the options | `camera.ts`, `feedback.ts`, `combatView.ts`, `overlay.ts`; `tests/reviewA7.test.ts` finding 1 |
| A2: the reduced-motion stylesheet reached the song chips and the Chord builder's cards | blocker (owner's rule) | put back as at `81a12ef`, in `src/index.css` only; the budget bars added after | `src/index.css`; `e2e/a11y.spec.ts`, last test |
| A3: a lost hold could lock Thread mode in Empower (pause, alt-tab, chorded mouse, pad unplugged) | should fix | fix | `InputController.ts`, `gamepad.ts`; `tests/reviewA7.test.ts` finding 3 |
| A4: pressing Start to rebind it in the pause menu unpaused | should fix | fix | `InputController.ts`; `tests/reviewA7.test.ts` finding 4 |
| A5: the audio was never told the game speed (wind-ups ended early; A Tempo off the downbeat by up to 217 ms at 0.7) | should fix | fix for non-aura sounds only | `sfx.ts`, `conduct.ts`, `director.ts`; `tests/reviewA7Audio.test.ts` finding 5 |
| A6: `auto` quality degraded a display capped at 30 or 48 Hz | should fix (minor) | fix: a steady interval is a display cap | `stage.ts`; `tests/reviewA7.test.ts` finding 6 (W4's slow-machine series given uneven frames) |
| A7: no caption for a wind-up begun in Stasis or for non-damage telegraphs that sound | minor | fix | `captions.ts`; `tests/reviewA7.test.ts` finding 7 |
| A8: hero voices counted toward saturation and could refuse an aura voice | minor | fix: aura admission exactly as at `81a12ef` | `engine.ts`; `tests/reviewA7Audio.test.ts` finding 8 |
| A9: a second middle press picked the held wheel; Space pressed the focused pause-menu button | minor | fix the first; accept the second as standard behaviour | `InputController.ts`; `tests/reviewA7.test.ts` finding 9 |
| A10: W6's idle overlapped the beam song's swell | should fix (owner's rule) | fix: no idle while the swell is drawn | `entities.ts`; `tests/reviewA7.test.ts` finding 10 |
| A11 notes: Auto-Thread ignored held buttons, the open wheel and the mouse; pad reading had no standard-mapping check and mixed pads; the assist record wrote during render | note | fix these three | `InputController.ts`, `gamepad.ts`, `runStore.ts`, `GameHost.tsx`; `tests/reviewA7.test.ts` finding 11, `tests/gamepad.test.ts` |
| A11 notes: Pause unbindable from the pad (Escape stays fixed); fix stream 2's `rose` key outside ground rule 2's list; `chainOpen` within the sim's tolerance; what the text-size, contrast and aura pin tests don't see; the Life budget label's size | note | accepted as they are (the label went back, *Auras and ornaments*) | — |
| B1: an import with its settings, made while a Prep run was held, kept the old run | should fix | fix; check the same family | `saveTransfer.ts`; `tests/reviewB7.test.ts` finding 1, `e2e/saves.spec.ts` |
| B2: `release-check` row 9 compared `WeaverBar.tsx` and `ChordBuilder.tsx` whole, so it was red at the tip | should fix | narrow row 9 to the aura files and glyphs; pin the Chord builder's cards from `81a12ef` | `tools/release-check.ts`, `tests/aura/chordCardsPin*`; `tests/releaseTools.test.ts`, `tests/aura/chordCardsPin.test.ts` |
| B3: `release-check` went green on another commit's logs and on a partial e2e run | should fix | fix: stamped evidence, every spec file, named test files, "accepted" for row 2 | `tools/release-check.ts`, the two run scripts; `tests/releaseTools.test.ts` |
| B4: one bad Phase 7 settings value threw away the whole settings file | should fix | fix: the bad value reads as absent | `settings.ts`; `tests/reviewB7.test.ts` finding 4 |
| B5: an imported save's raw text could fill storage so later saves silently failed | minor | fix: a cap per save, refused in words | `saveFile.ts`; `tests/reviewB7.test.ts` finding 5 |
| B6: a second import replaced the "before import" copy; a refused import could leave a mixed set | minor | fix; tell the player in the preview and the panel | `saveFile.ts`, `SavesPanel.tsx`; `tests/reviewB7.test.ts` finding 6, `tests/savesPanel7.test.ts`, `e2e/saves.spec.ts` |
| B7: a kept unreadable save could be overwritten, its download could not be imported, and near-full storage lost it | minor | fix; the notice says only what is true | `save.ts`, `SavesPanel.tsx`, `saves.ts`; `tests/reviewB7.test.ts` finding 7, `tests/savesPanel7.test.ts`, `e2e/saves.spec.ts` |
| B8: English words passed as `t()` parameters, decisions made on English text, a baseline that could rise silently | minor (English unaffected) | to W3b | W3b's conversion, `tools/strings.ts`; `tests/textDecisionsW3b.test.ts` |
| B9: the migration matrix's fresh twin compared the loader with itself | note | build it from the raw save's values | `tools/save-fixtures.ts`; `tests/reviewB7.test.ts` finding 9 |
| B10: the README described keyboard controls only | note | add the gamepad and the remapping options | `README.md` |
| B11: every commit carries the required attribution trailers | note | accepted: the trailers are required | — |

Both reviews found ground rules 1-3 holding: every pin passed, the goldens were up to date, nothing in `src/sim`, `src/content`, `src/meta` or `src/bots` reads a new setting, a pad-played, an Auto-Threaded and a 0.7-speed fight each replayed bit for bit, and 549 of 552 UI lab views rendered identical English text before and after (the other three are the Settings and Controls screens with their new rows).

### Verification as run

- **On the integration branch at `d22f5e0`** (the reviewed tip; `/home/user/aw-work/7/integ/land-1/summary.log`, unstamped, the commit read from its times): typecheck and lint (with `prettier --check`) clean; "Goldens are up to date"; 13 baseline checks byte-equal (`m1-baseline --check` for Movements I-IV, 270, 270, 240 and 30 fights; `expedition-baseline --check` for 2, 3 and 4 Movements, 10 runs each; parties A, SB and OC, Movement IV fights and four-Movement runs each); full suite 243 files, 5,189 passed, 9 skipped, 2 todo, none failed.
- **At `92c81cb`** (after both fix streams; `land-2/summary.log`, stamped): the same checks, all clean and byte-equal; full suite 249 files, 5,279 passed, 10 skipped, 2 todo, none failed.
- **At `f74a46b`** (the final tip; `/home/user/aw-work/7/fix3/full.log`, stamped, clean tree): full suite 250 files, 5,287 passed, 10 skipped, 2 todo, none failed. Fix stream 3 changed only the Saves panel and tests after `92c81cb`, so the baselines were not re-run there. `e2e/saves.spec.ts` at the same commit: 7 passed, 1 skipped (the demo-only test).
- **The budget bars' browser test** (`/home/user/aw-work/7/integ/e2e-motion.log`): passed, run on `45158e1` with that change uncommitted.
- **On the stream branches** (before landing; each stream's hand-back): `e2e/input.spec.ts` 2 passed; `e2e/a11y.spec.ts` 10 passed, then 11 on fix stream A; `e2e/perf.spec.ts` 7 passed, the long heap test once and the sampling pass twice; `e2e/saves.spec.ts` and `e2e/runKept.spec.ts` on fix streams 1 and B; `e2e/locale.spec.ts` over all 404 UI lab views on W3a (26 console errors in 23 views from one broken SVG path, fixed, and those views re-run clean) and 552 views on W3b in two parts from two commits, 0 errors; `e2e/fullrun.spec.ts` green once on W8's branch before W1-W7 merged (seed 4243, 103.3 minutes, 14 fights, victory, zero errors, warnings, page errors and failed requests; seed 4242 lost the Gorehound Matriarch to the Skilled bot).
- **`sim:bench --check`** on `f74a46b`: within budget, the crowd's p95 0.189 ms (*Release measurements*).
- **The release candidate** (`f74a46b`): the whole e2e suite, the full run and `release-check`:

  - **The whole e2e suite** (every `e2e/*.spec.ts`, stamped `f74a46b`): 66 passed, 4 skipped, in 1.5 hours. The four skipped are the ones kept out of the default run, each run on its own: the full run (below), the ten-minute heap test and the heap-sampling pass (W4 ran each on its branch), and the demo-only test, which passed on a demo build of the same commit (neither demo start shows a kept-save notice).
  - **The full run** (`AW_FULLRUN=1`, seed 4243, stamped `f74a46b`): a whole Finale-route Expedition through the real app with sound on, 14 fights and 73 steps to a **victory in 131.4 minutes**, with zero console errors, warnings, page errors and failed requests and nothing tolerated. The heap after each fight, in MB: 25, 25, 25, 36, 36, 36, 36, 38, 38, 38, 38, 38, 40, 38, 38. A first attempt on the same commit was stopped by a two-hour limit on the command that ran it, 96 minutes in at the third Movement's boss, with no error up to there; the two attempts played the same fights to different tick counts, so the bot's play in the page depends on frame pacing and a seed that wins once is not promised to win again.
  - **The 13 baseline checks** at `f74a46b`: every one "unchanged".
  - **`release-check`** at `f74a46b`, with those logs, the full suite's report (250 files, none failing) and `--run goldens,sim-bench,typecheck,lint`: **6 green, 0 red, 3 not provable here, 1 accepted, 0 not run.** Green: saves (5), zero console errors across the full run (6), licences (7), the pins and versions (8), no aura or ornament changed (9), and vitest, typecheck, lint and the e2e suite (10). Not provable here: the pillars' playtest halves (1), frame time on a reference laptop (3), and reduced motion watched, a real gamepad used and the text read on a real screen (4). Accepted: the bands the harness misses, which ship as the known balance notes (2, decision 13). The build: 1.9 MB to the title and 7.3 MB in all without maps, against the 25 MB budget.
- **After the release candidate** (`e0e93ea`, `e1baaf6`): the demo check found the Saves panel saying "Copied." when the page's frame refused the copy, and saying nothing when a frame dropped a download. The panel now says the copy was refused and selects the code, and says where to look if no file came. Full suite at that code: 250 files, 5,300 passed, 10 skipped, 2 todo, none failed; `e2e/saves.spec.ts`: 8 passed, 1 skipped (the demo-only test), with a new test of both messages. The whole e2e suite and the full run were not run again after this change, which touches the Saves panel, its helper and its texts only.
- **The demo, Version 15** (version 1794396819-ac6c, built from `e1baaf6`, 119 files, 7.6 MB): checked as docs/demo.md, *Publishing*, records.

### Not verified

- **No real gamepad** was used: every pad test drives a fake `getGamepads`. Trigger thresholds, stick drift, more than one pad, and `navigator.getGamepads()`'s own allocation in a browser are untested. No person has played with a pad or judged the reticle, which shows only as the existing hover highlight.
- **No real GPU.** Every frame time here is software rendering in headless Chromium on a loaded 4-CPU machine. GPU frame time and the 16.7 ms budget on a reference laptop, what `auto` quality and dynamic resolution do on real hardware, and HUD commits above about 17 fps are not known. No person has opened the bench page.
- **Memory over a 40-minute run**: only a 12.8-minute heap trend in one browser.
- **Nobody has listened** to anything: hero voices, the barks bus, the sliders, the ducking, the wind-ups at game speed. Hero voices were heard only through offline renders and Node. The loudness and busy-fight readings are one seed each; the 403 console errors the dev server logged during the loudness runs were not looked into.
- **Nobody has watched the motion**: reduced motion in the fight and the UI, high contrast, the captions, W6's recoil, death, idle and ribbon lift (too subtle for stills). High contrast is tested on uniforms and colour values, not pixels; the lab's palette screenshots apply each palette and do not simulate colour-blind sight.
- **Real storage quotas**: full and near-full storage is tested only with simulated stores. Each import also stores a second copy of every save under `.before-import`, which may meet a real quota sooner.
- **Browsers other than headless Chromium**, in everything.
- **The demo build**: both demo starts showing no kept-save notice was never run in a browser (the test only runs in the demo's build and never reached the front of the queue); the demo build was not clicked through.
- **The full run on the integrated tree**: its one green run is from W8's branch, before W1-W7 landed (the release candidate's run is above). One winning seed is not stability across seeds.
- **Screens never seen in a browser**: the VFX lab's comfort controls (tested through their writers and server-rendered markup), the Reliquary, Astrolabe and Without You under the setting (mocked effects), hold-or-toggle and mouseover casting (unit tests), imported settings after the reload, the pad on Atelier, Astrolabe, Reliquary, Bonds, Codex, Respite, Calling, Scene, the merchant, events and the Summary.
- **English against a pre-Phase-7 build in a browser**: English identity rests on the converter's check against TypeScript's JSX transform, the unchanged UI tests and review B's server-rendered comparison of 552 views. The fixes W3b made after its pseudo-locale run were not re-shot; its list of plain-English text is not fully sorted.
- **The "without you" rise** only on a staged fight; the `chainOpen` edge case only on the pins and 144 fights; the lab bench's recorder only in Node, on a Prelude.
- **Whether the full run sees console errors raised inside workers.**
- **The save fixtures' gaps**: no fixture holds an enshrined relic (the demo veterans hold relics); the fuzzer's random Astrolabe trees are mostly pruned, and its v1-v9 profiles are today's profile written back, not real old builds.
- **What a capturing `pagehide` listener in the import does** relative to the run store's: reasoned, not tested.
- **The assist mark for an assist switched on and off inside one fight.**
- **`release-check` with no flags in CI**: what it prints there without evidence logs was not looked at.
- **People**: no playtest of anything in Phase 7; every playtest half of the pillar tests is undone.

### Open, for the owner

**Decisions waiting** (each with the default in force):

1. **Every item under *Auras and ornaments*, held.** Default: as before Phase 7. Each change needs the owner's approval; the cost of each is stated there.
2. **`auto` quality as the default** (decision 8). Default: `high`. Changing it is one default in `src/app/settings.ts`, once `auto` has been measured on real hardware.
3. **Hero voices on by default** (decision 3). Default: off. Needs someone to listen first; turning them on is one default.
4. **The colour-vision palette's low-contrast roles**: lethal under each vision (3.12-4.05 against 4.5) and tritanopia's ailment on two surfaces. Default: unchanged (`src/app/colorVision.ts` had no owner this phase; the pairs are listed in `tests/contrast.test.ts`). Changing them moves meaning colours, which the colour-vision tests check.
5. **The two thin Conductor goldens** (5f A2): First Light's does not depend on the Novice's draws and the Silent one never casts Fortissimo Silence. Default: kept, with what they do produce now asserted. Changing them means new scenarios and re-recorded goldens.
6. **`marcatoReady` and `soloFullIn`**, still copies in the bots. Default: kept. `marcatoReady` follows the sim only by moving one golden; `soloFullIn` needs a new sim export (taking a `WorldState` and a hero) and probably changes bot commands.
7. **The commit trailers** (review B finding 11). Default: kept, as required; removing them would rewrite history.
8. **The Seamstress's held Tyrant entry, Phase 5g's held W7 content and Phase 6's decision 5** (*Auras and ornaments*, item 8).

**Known notes that ship as they are:**

- **The 18 decisions' outcomes.** 1: the procedural look kept, with the ring mark, the header and the motion; no kit or commissioned art. 2: the synthesised score, measured, no trim. 3: hero voices built, off. 4: the gamepad in combat and on every menu screen through one hook, remappable, no rumble, no brand art. 5: mouse roles, the Cue modifier, hold or toggle and mouseover casting remappable; Escape and the menu keys fixed and listed in Controls. 6: 80-150% kept with the width fit; 48 of 50 small sizes at 12 px, two held. 7: readiness and the pseudo-locale; no translation. 8: the bench page; `high` by default, `auto` offered. 9: no service worker or manifest. 10: no desktop wrapper; its needs in the README. 11: export and import built. 12: no demo choice in the release build. 13: the balance items ship as they are (below). 14: no telemetry; the game makes no network request. 15: the presentation- and input-side assists built; the sim-side ones not. 16: the badge reads the run's own mark. 17: the dev panel, test hook and labs stay in the release build, recorded in the README. 18: the Martyr's text unchanged, with the live Bear key beside it once it leaves B.
- **The balance items carried from Phases 5f-6**, 32 groups listed under *Audit, Balance: what earlier phases left for you*. Phase 7 moved no number; *Release measurements* re-reads the bands on the release candidate.
- **Small differences kept**: Space presses a focused pause-menu button; `KEPT_WHEN_SATURATED` lets the low-life alert, the edict and the pair Cue through busy fights; Pause can be unbound from the pad (Escape stays fixed); a GPU-bound machine that misses exactly every other vsync looks like a 30 Hz cap to `auto` and won't step down; when a kept sound's group is full of counted voices, the kept one plays over its group cap.

**Localization gaps** (English output is unaffected by each):

- **Words still passed to the plural helper**: 54 calls of `plural(` in `src/ui` pass English words ('Ward', 'Shard', 'star', 'Duet' and the like), so "fights", "Solos" and "marks" stay English in `en-XA`. The helper needs keys instead of words.
- **English produced outside `src/ui`**: `src/meta`'s text ("Clear it at N Dissonance", event problems, "N min of fighting"); the runtime's callouts ("Wave N of M", "Victory", "Crescendo — …", `src/app/runtime.ts`); `src/input`'s action names; lab mock data. Also `atlasModel.ts:852` builds `` `${fmt(m)} min` ``.
- **Content names** come straight from `CONTENT` (1,100 of the plain-English strings W3b's pseudo-locale run listed), and some code handles them as English (`.startsWith('The ')`, `REWIND_NAME`, the ordinal word arrays).
- **Other**: key labels (Space, Esc, WASD); some messages are sentence fragments with edge spaces because the code joins pieces; pseudo text nests brackets where one message is passed into another; layouts that clip in `en-XA` were listed, not fixed (the Deeds rows, Prep's assist labels, the Reliquary chips, the Summary's Bonds ranks, the trainer lines; lists in `/home/user/aw-work/7/w3a/shots/` and `/home/user/aw-work/7/w3b/clipped.txt`); fonts cover no CJK, Arabic, Hebrew or Devanagari.

**Performance findings nobody fixed** (W4's sampling over the bench scenes, per frame):

- **The allocation list**: `ThreadView.draw` (`src/render/thread.ts`, 18-43 KB; its beam-song lines are frozen); feedback's `holdProjectiles` (6-8 KB) and `sync` (4-6 KB); the overlay's `update` (3.5-9.8 KB); `EntityLayer.updateRec` (6.5 KB in the Finale to 52 KB with 150 enemies), its `sync` (up to 23 KB, a Map iterator among it) and `weaverRibbons` (4-5 KB); `fx/ribbons.ts` `endStrip` (6-12 KB); `fx/instanced.ts` `end` (3.7-5.4 KB, through three's `addUpdateRange`, which the aura pin reads); models built mid-fight on spawns (`models/builder.ts`, about 12 KB); `chrono.ts` and `variants.ts` `sync` (2.9 and 1.8 KB); the input controller's `collect()`, which returns a new empty array every frame; the HUD at about 40-55 KB a commit. In the frozen sim, with 150 enemies: `resolveOverlaps` about 228 KB a frame, and smaller amounts in the enemy, spatial hash, hero, field, status and director code.
- **The workers' duplicate bundles**: the run verifier, the "without you" worker and the weekly bench worker each bundle their own sim, content and zod (about 1.4 MB of the total, none of it on the title's path). Sharing needs one worker entry.
- **The WebGL contexts that stay alive**: across three short Finale passes in the bench, the canvases and WebGL2 contexts of earlier passes were still alive after a forced collection; what holds them was not traced. Releasing the context in `Stage.dispose` would print a console warning, so it was left.

**The title's load grew with localization.** The English catalogue sits in the entry chunk because `t()` imports it synchronously: W3a measured the title at 1,871,372 bytes on its branch against W0's 1,717,393 (+154 KB raw, +39 KB gzipped), before W3b converted the rest. Still far under the 25 MB budget; the tip's figure is in the release check's build sizes. Loading the catalogue by area or by locale would shrink it.

**Housekeeping**: the remote backup branches can be deleted once the release is tagged: `origin/backup/integ-p6`, `origin/backup/integ-p7`, `origin/backup/p6-W2`, `origin/backup/p6-W5`, `origin/backup/p6-W7` (as this checkout last fetched them; the older stream branches `5g-*`, `m5/*`, `integ-5g` and `wip/5f-w5` are there too).

## Release measurements

Read on the release candidate, `f74a46b` (a detached checkout of main), with no number changed. The machine was shared with a long browser run, so every harness command ran alone, one at a time, at the reduced sizes said with each table.

**In short.** The sim tick budget is met. Every tier reading equals Phase 6's final tables run for run where they were read on the same sim (tiers 0-II both bots, and the Expert at Tier IV: 870 runs); tier III and the Skilled bot at Tier IV differ from Phase 6's tables because those were read before Phase 6's own round 2 changed Tyrant, and they equal the end-of-Phase-6 tree's. So no band moved: met at tiers 0, I (Expert), II (Skilled), III and IV (Expert); missed, as known, at Tier I (Skilled −5 / −4 / −7 against −10) and Tier II (the Expert's 80% on 900007). No Movement cell is outside its band at 20 seeds (15 readings on the edge). The report tools of Phase 6's ground rule 1 print what they printed before Phase 6, byte for byte. Pillar 1: Perfect Ward rate correlates with grade (+0.29 within an encounter, +0.17 over runs) and with a fight's length against its par (−0.16), not with a whole run's minutes once the Calling is held fixed. Pillar 3: **missed**, 16.3% of downs in whole runs (28.5% in cells) name a telegraph and an answer; after Movement I every telegraph down names an answer, Movement I's never do. Pillar 4: heroes have no action for about 2% of their standing time with the Skilled or Expert Weaver (15% at the Silent Conductor). Pillar 5: no preset is best in every cell; 6 of 6 presets win ≥ 50% at Tier I.

### The sim tick budget

`npm run sim:bench -- --check` (its own nine scenes, full length). **Met**: "within budget", exit 0.

| Scene | Ticks | Entities (up to) | ms/tick avg | p95 | p99 |
|---|---|---|---|---|---|
| crowd | 3,600 | 250 | 0.144 | 0.189 | 0.561 |
| skilled-first-light | 2,400 | 12 | 0.139 | 0.122 | 4.192 |
| novice-cantor | 5,400 | 9 | 0.040 | 0.035 | 0.100 |
| hound-pack | 5,400 | 13 | 0.076 | 0.061 | 0.260 |
| unweaver-peak | 5,400 | 17 | 0.078 | 0.084 | 0.544 |
| conductor-peak | 5,400 | 9 | 0.059 | 0.055 | 0.175 |
| grand-silence | 4,500 | 5 | 0.028 | 0.024 | 0.084 |
| grove-peak | 5,400 | 17 | 0.115 | 0.117 | 1.471 |
| crowd-150 | 2,640 | 160 | 0.331 | 0.406 | 0.912 |

The budget is 1.5 ms a tick at 250 entities: the crowd scene's p95 is 0.189 ms (the doc's earlier reading was 0.186 ms). The p99 of 4.2 ms in the first-light scene is the warm-up and the shared machine's load (the check reads p95); it is not a budget the tool asserts.

### The Dissonance tiers

**Command.** The tiers were played by a scratch probe (`/home/user/aw-work/7/w9b/probes/tiers.ts`) that plays exactly what `tools/dissonance.ts --tiers` plays: the same `TIERS` sets, `TIER_CALLINGS` by seed, `rank20Build()`, Guardian, `expertPolicy` for the Expert only, seeds base + i × 104729, `playRun` with `movements: 4`. It adds read-only `onEvents`, `onFight` and `onEnd` hooks (for the pillar readings below) and writes one line a run (`tiers.jsonl`), so a restart lost nothing. The equivalent tool command is `npx tsx tools/dissonance.ts --tiers --sets --seeds 50 --bots expert` and `--seeds 30 --bots skilled`. To show the probe plays what the tool plays, `npx tsx tools/dissonance.ts --tiers --sets --seeds 4 --bots expert,skilled` was run as well: its 30 run lines equal, character for character, the lines rebuilt from the probe's first 4 runs of each set (`probes/toollines.py`).

**Size.** Phase 6's reduced protocol, its own final size: the Expert 50 seeds on each of 2000, 900007 and 333003; the Skilled bot (same build, the harness's run policy) 30 a set. The Novice and Idle bots were not run at the tiers (as in Phase 6).

**Against Phase 6.** Every run was compared with Phase 6's per-run files (`/home/user/aw-work/6/w8/tf-0.jsonl`, `tf-1.jsonl`, `tf3.jsonl`, `tfs.jsonl`; Tier IV against round 2's `/home/user/aw-work/6/w8b/tIV-0.jsonl`, `tIV-1.jsonl`): the same seed, the same fights in the same order, each fight's outcome and length to the second, and the run's minutes. "Same" in the tables means every one of those matched.

| Tier | Bot | 2000 | 900007 | 333003 | Band | Verdict | Run for run against Phase 6 |
|---|---|---|---|---|---|---|---|
| 0 | Expert | 49/50 (98%) | 50/50 (100%) | 49/50 (98%) | ≥ 90% | **met** (inside on all three) | 150 of 150 the same |
| 0 | Skilled | 29/30 (97%) | 29/30 (97%) | 29/30 (97%) | reported | reported | 90 of 90 the same |
| I (10) | Expert | 44/50 (88%) | 42/50 (84%) | 45/50 (90%) | 70-90% | **met** (edge on 2000 and 333003, inside on 900007) | 150 of 150 the same |
| I (10) | Skilled | 25/30 (83%) | 24/30 (80%) | 25/30 (83%) | ≤ Expert − 10 | **missed** on all three (−5 / −4 / −7) | 90 of 90 the same |
| II (20) | Expert | 35/50 (70%) | 40/50 (80%) | 34/50 (68%) | 40-70% | **missed** on 900007 (outside); edge on the other two | 150 of 150 the same |
| II (20) | Skilled | 16/30 (53%) | 11/30 (37%) | 10/30 (33%) | ≤ Expert − 10 | **met** (−17 / −43 / −35) | 90 of 90 the same |
| III (30) | Expert | 17/50 (34%) | 12/50 (24%) | 17/50 (34%) | 15-40% | **met** (inside on all three) | 26 of 150 the same (see below) |
| III (30) | Skilled | 4/30 (13%) | 2/30 (7%) | 2/30 (7%) | ≤ Expert − 5 | **met** (−21 / −17 / −27) | 31 of 90 the same (see below) |
| IV (42) | Expert | 9/50 (18%) | 8/50 (16%) | 7/50 (14%) | 2-15%, above 0 on every set | **met** by the doc's reading (edge on 2000 and 900007, inside on 333003; above 0 on all three) | 150 of 150 the same as round 2 |
| IV (42) | Skilled | 5/30 (17%) | 1/30 (3%) | 2/30 (7%) | reported | reported | 38 of 90 the same as round 1 (round 2 did not read the Skilled bot) |

Over the three sets, the Expert reached the Finale in 148, 132, 109, 46 and 29 runs at tiers 0 to IV and won 148, 131, 109, 46 and 24 of them (won ÷ reached 100%, 99%, 100%, 100%, 83%); minutes of combat a run 17.5, 23.7, 21.8, 12.9, 12.0. The commonest loss at tiers III and IV is the Hollow Cantor (30 and 45 of the Expert's runs).

**Tiers 0, I and II, and the Expert at Tier IV, are Phase 6's final tables run for run** (870 of 870 runs the same). **Tier III and the Skilled bot at Tier IV differ from the tables, but not because of Phase 7.** Tier III's set holds Tyrant and Mimicry (`TIERS` in `tools/dissonance.ts`), and Phase 6's tier III table (`tf-*`) was read before round 2 changed Tyrant's pacing in the sim (`e8b6839`); round 2 re-read only the Expert at Tier IV, and its "not measured" list says tiers 0-III hold no Tyrant or Mimicry, which is true of 0-II only. To make sure, the same probe played tier III (10 Expert and 10 Skilled runs on 2000) on the tree at the end of Phase 6 (`6a2b5eb`, extracted under the scratch folder): all 20 runs equal the release candidate's, every fight and every count. So the tier III and Skilled tier IV readings above are the first on the round-2 sim, and they replace Phase 6's: the Expert's tier III reads 34 / 24 / 34% (Phase 6: 32 / 26 / 38%), still inside its band; the Skilled bot's 13 / 7 / 7% (10 / 7 / 13%), and at Tier IV 17 / 3 / 7% (17 / 7 / 3%). No reading moved beyond seed noise, and none moved between the end of Phase 6 and the release candidate.

**The bands, as Phase 6 left them, are unchanged:** met at tiers 0, I (Expert), II (Skilled), III (both) and IV (Expert, on the edge); missed at Tier I (Skilled not 10 below the Expert, −5 / −4 / −7) and Tier II (the Expert's 80% on 900007). Those are *Balance* items 1-3, as known.

### Pillar 1: Perfect Ward rate against grade and clear time

**Command.** `python3 -I /home/user/aw-work/7/w9b/probes/pillar1.py tiers.jsonl 0 expert`, over the tier-0 Expert runs above (150 whole Finale-route Expeditions, 50 on each set; 2,206 fights). No tool measured this before. What it counts, all from the harness's own events and the run's own results: Wards cast (`techniqueCast` with `ward`), Perfect Wards (`perfectWard`), telegraph hits aimed at a hero (`telegraphResolved` with a hero target, `cancelled` left out); each fight's `grade` (S 4, A 3, B 2, C 1, D 0) and `duration ÷ par` from its `EncounterResult`; the run's minutes of combat. Rate = Perfect ÷ Wards cast. Correlations are Pearson's (with a 95% interval) and Spearman's.

Over the 150 runs: 16,362 Wards, 8,193 Perfect (50.1%); 36.0% of telegraph hits aimed at a hero met a Perfect Ward; the run rate runs from 0.36 to 0.67 (median 0.51). Grades: 1,477 S, 505 A, 222 B, 2 D.

| Reading | n | Pearson (95%) | Spearman |
|---|---|---|---|
| Run: rate against mean fight grade | 150 | +0.17 (+0.01 to +0.32) | +0.13 |
| Run: rate against mean grade, within Calling (won runs) | 148 | +0.32 (+0.17 to +0.46) | +0.36 |
| Run: rate against minutes of combat (won runs) | 148 | −0.36 (−0.49 to −0.21) | −0.41 |
| Run: rate against minutes, within Calling (won runs) | 148 | −0.02 (−0.18 to +0.14) | −0.04 |
| Run: rate against won | 150 | +0.27 (+0.11 to +0.41) | +0.19 |
| Fight, within encounter (≥ 3 Wards): rate against grade | 1,614 | +0.29 (+0.24 to +0.33) | +0.32 |
| Fight, within encounter (≥ 3 Wards): rate against length ÷ par | 1,614 | −0.16 (−0.21 to −0.11) | −0.15 |

The reading: **with grade, a positive correlation (met in direction, weak to moderate); with clear time, only within a fight.** Within an encounter, a fight with more of its Wards Perfect is graded higher and ends sooner against its par. Across whole runs the minutes correlation (−0.36) comes from the Callings, not from the Wards: Conductor runs are much shorter (10.9 min against 18-20) and the Conductor runs also Ward best (0.535; Martyr runs 0.438). Within a Calling it is zero. Two cautions: the grade counts Perfect Wards itself (`grade()` in `src/meta/run.ts` adds 5 a Perfect Ward, up to 20), so part of the grade correlation is by construction; and at tier 0 the Expert wins 148 of 150, so grade and minutes vary little. Pillar 1 names no number, so "met" here means only that the sign is the one the pillar asks for. For scale, the Skilled bot's 90 tier-0 runs read +0.23 within encounter against grade and −0.13 against length ÷ par.

### Pillar 3: downs whose recap names a telegraph and an answer

**Command.** `python3 -I /home/user/aw-work/7/w9b/probes/pillar3.py tiers.jsonl tier`, over every down in the tier runs above (1,200 whole Finale-route Expeditions: the Expert 50 a set and the Skilled bot 30 a set on 2000, 900007 and 333003, at all five tiers; 4,046 downs). No tool measured this before. What it counts, for each down in a fight's `EncounterResult.deaths` (the recap the Result screen draws):

- *names a telegraph*: the hit that downed the hero was a telegraph's (the hero's last `damageTaken` before its `allyDowned`, in the same tick, carries a `telegraph`); the recap's headline then names that attack ("fell to Toll");
- *names an answer*: `deathAdviceLine(death, party, calling, reel)`, the line the Result screen prints under the recap (`src/ui/screens/ResultScreen.tsx`), is not null.

| Tier | Bot | Downs | Telegraph | Answer | Both |
|---|---|---|---|---|---|
| 0 | Expert | 42 | 57.1% | 45.2% | 28.6% |
| 0 | Skilled | 66 | 84.8% | 39.4% | 36.4% |
| I | Expert | 271 | 77.1% | 35.4% | 33.2% |
| I | Skilled | 310 | 79.7% | 31.3% | 29.4% |
| II | Expert | 456 | 63.2% | 30.5% | 25.4% |
| II | Skilled | 450 | 64.4% | 17.3% | 14.7% |
| III | Expert | 681 | 52.0% | 16.3% | 11.0% |
| III | Skilled | 526 | 58.9% | 16.7% | 10.5% |
| IV | Expert | 758 | 54.4% | 19.9% | 11.5% |
| IV | Skilled | 486 | 54.1% | 17.3% | 8.6% |
| all | | 4,046 | 60.6% | 22.0% | **16.3%** |

**Missed** against the pillar's 100%. The cause is by design rather than a fault: Movement I's recaps name no answer at all (`deathAnswerLine` reads only Movement II's damage-over-time and telegraph answers; its comment says "Null when the recap has none (every Movement I death)"), and most downs in whole runs at Dissonance are in Movement I: 2,431 of the 4,046, none of them with an answer line, against 889 of the 1,615 downs after Movement I (55%). The commonest downs with no answer line are Movement I's: a Hollow Chorister's blow (822, not a telegraph), Toll (601), Requiem (499), Toll Cleave (288, the Bell Brute's), Glass Lance (146), Dirge (120). Of the downs to a telegraph, 1,795 name no answer. A looser reading counts the "Ready but unused" line too, when it names techniques that were ready (`deathReadyLine` with kind `ready`: for a death with no named answer it lists what was ready): 75.7% of downs then name something to do, and 43.4% a telegraph as well. The Movement split is in the cell reading below.

**The same reading over the cells** (`python3 -I /home/user/aw-work/7/w9b/probes/pillar3.py cells.jsonl m`: every down in the 2,160 cell fights below, four bots, 20 seeds a cell; 3,042 downs), by Movement:

| Movement | Downs | Telegraph | Answer | Both | Telegraph downs with no answer |
|---|---|---|---|---|---|
| I | 956 | 74.3% | 0.0% | 0.0% | 710 |
| II | 969 | 35.6% | 73.3% | 35.6% | 0 |
| III | 961 | 43.4% | 44.5% | 43.4% | 0 |
| IV | 156 | 67.3% | 100.0% | 67.3% | 0 |
| all | 3,042 | 51.8% | 42.5% | **28.5%** | 710 |

So **after Movement I, every down to a telegraph names an answer** (no exception in either reading: in the tier runs, all 1,795 telegraph downs without one are Movement I's). What is left are Movement I's downs (none has an answer line) and, in Movements II and III, downs to a plain blow (a Sanguine Hound's bite, a Crimson Sentinel's, the Unweaver's own strike), whose recap names the enemy and, in Movement III, no answer. The Finale names an answer for every down. With the "Ready but unused" line counted too, 93.4% of cell downs name something to do.

### The harness bands by Movement (cells)

Phase 6's tuning read no Movement cells (its tables are the tiers and the levels' costs), so there is no Phase 6 cell table to set these against; the bands are each Movement's own (Movement I: `docs/phase-1.md`'s difficulty contract, which no harness row prints, its First Light "≈ 100%" for the Novice read as ≥ 95%; Movements II-IV: `tools/harness.ts` `MOVEMENT_BANDS`, from docs/phase-5a, 5c and 5d). The Expert has no cell band (its only one is the True Dissonance reference at the Conductor), so its column is reported.

**Command.** A scratch probe (`/home/user/aw-work/7/w9b/probes/cells.ts`) that plays each Movement's cells as `tools/harness.ts --movement N --bots idle,novice,skilled,expert --seeds 20` does: the harness's own `parseArgs` (so the same fight list, kit and loadout: Movement I bare with Sostenuto + Fortissimo, Movement II the arrival kit, III `ARRIVAL3_KIT`, IV `ARRIVAL4_KIT`), seeds 1000 + i × 7919, `playEncounter`, with a read-only watch (for pillars 3 and 4). Tables: `python3 -I /home/user/aw-work/7/w9b/probes/celltable.py cells.jsonl`.

**Size.** 20 seeds a cell on cell base 1000, the default party, four bots (2,160 fights). This is below the 5a-5d protocol's 50 seeds a cell, at the size Phase 6's tuning used for single cells (20 seeds on a base), so one standard error is about 10 points at 50% and 5-7 points near 90%. A cell is *edge* within one standard error of a bound, as Phase 6 reads it.

**Against the pins.** The first 10 seeds of every Idle, Novice and Skilled cell in Movements II-IV are the committed cell baselines' fights (`tools/m2-baseline.json`, `m3-`, `m4-`: same kit, same seeds): all 540 match exactly (outcome, length, downs, Perfect Wards, share). (Movement I's baseline plays Guardian, not the harness's default loadout, so it is not the same fight.)

#### Movement 1

| Fight | Idle | Novice | Skilled (won · s · share) | Expert (won · s · share) | Bands: Idle / Novice / Skilled | Verdict |
|---|---|---|---|---|---|---|
| first_light | 4/20 | 20/20 | 20/20 · 30 · 47% | 20/20 · 29 · 46% | ≤40% / ≥95% / ≥100% · share ≥35% | all inside |
| tolling_halls | 0/20 | 17/20 | 20/20 · 37 · 45% | 20/20 · 39 · 46% | ≤30% / ≥75% / ≥80% · share ≥35% | all inside |
| glass_gallery | 1/20 | 18/20 | 17/20 · 36 · 46% | 20/20 · 35 · 48% | ≤30% / ≥75% / ≥80% · share ≥35% | skilled edge (85% against ≥80%) |
| choir_loft | 0/20 | 20/20 | 20/20 · 28 · 47% | 20/20 · 30 · 48% | ≤30% / ≥75% / ≥80% · share ≥35% | all inside |
| mourning_steps | 2/20 | 20/20 | 20/20 · 35 · 49% | 20/20 · 35 · 48% | ≤30% / ≥75% / ≥80% · share ≥35% | all inside |
| muted_nave | 0/20 | 12/20 | 20/20 · 47 · 52% | 20/20 · 52 · 53% | 0% / 40-85% / ≥90% · share ≥35% | all inside |
| shattered_choir | 0/20 | 16/20 | 20/20 · 47 · 48% | 20/20 · 41 · 50% | 0% / 40-85% / ≥90% · share ≥35% | novice edge (80% against 40-85%) |
| bellwarden | 0/20 | 13/20 | 20/20 · 56 · 49% | 20/20 · 53 · 49% | 0% / 40-70% / ≥90% · share ≥35% | novice edge (65% against 40-70%) |
| hollow_cantor | 0/20 | 12/20 | 19/20 · 146 · 40% | 18/20 · 145 · 41% | 0% / 40-75% / ≥90% · share ≥30% | all inside |

#### Movement 2

| Fight | Idle | Novice | Skilled (won · s · share) | Expert (won · s · share) | Bands: Idle / Novice / Skilled | Verdict |
|---|---|---|---|---|---|---|
| crimson_gate | 1/20 | 20/20 | 20/20 · 37 · 44% | 20/20 · 40 · 43% | ≤15% / ≥65% / ≥85% · share ≥35% · 35-60 s | all inside |
| blood_rites | 1/20 | 20/20 | 20/20 · 43 · 49% | 20/20 · 43 · 49% | ≤15% / ≥65% / ≥85% · share ≥35% · 35-60 s | all inside |
| pike_line | 0/20 | 20/20 | 20/20 · 41 · 51% | 20/20 · 40 · 49% | ≤15% / ≥65% / ≥85% · share ≥35% · 35-60 s | all inside |
| red_muster | 0/20 | 20/20 | 20/20 · 58 · 53% | 20/20 · 60 · 52% | ≤15% / ≥65% / ≥85% · share ≥35% · 35-60 s | all inside |
| leech_warren | 0/20 | 20/20 | 20/20 · 46 · 48% | 20/20 · 46 · 49% | ≤15% / ≥65% / ≥85% · share ≥35% · 35-60 s | all inside |
| shield_wall | 0/20 | 14/20 | 19/20 · 75 · 50% | 19/20 · 77 · 50% | 0% / 35-75% / ≥85% · share ≥35% · 50-80 s | novice edge (70% against 35-75%) |
| blood_forge | 0/20 | 13/20 | 18/20 · 66 · 48% | 18/20 · 63 · 49% | 0% / 35-75% / ≥85% · share ≥35% · 50-80 s | novice edge (65% against 35-75%); skilled edge (90% against ≥85%) |
| gorehound_matriarch | 0/20 | 15/20 | 20/20 · 73 · 47% | 20/20 · 73 · 47% | 0% / 40-70% / ≥90% · share ≥35% · 60-110 s | novice edge (75% against 40-70%) |
| vharun | 0/20 | 8/20 | 19/20 · 202 · 48% | 19/20 · 195 · 47% | 0% / 35-65% / ≥85% · share ≥30% · 180-300 s | novice edge (40% against 35-65%) |

#### Movement 3

| Fight | Idle | Novice | Skilled (won · s · share) | Expert (won · s · share) | Bands: Idle / Novice / Skilled | Verdict |
|---|---|---|---|---|---|---|
| frayed_threshold | 0/20 | 17/20 | 19/20 · 44 · 42% | 20/20 · 45 · 44% | ≤10% / ≥55% / ≥85% · share ≥35% · 40-65 s | all inside |
| maw_hollow | 2/20 | 14/20 | 20/20 · 60 · 48% | 20/20 · 62 · 48% | ≤10% / ≥55% / ≥85% · share ≥35% · 40-65 s | idle edge (10% against ≤10%) |
| wraith_vigil | 0/20 | 10/20 | 19/20 · 43 · 47% | 18/20 · 42 · 49% | ≤10% / ≥55% / ≥85% · share ≥35% · 40-65 s | novice edge (50% against ≥55%) |
| null_chapel | 0/20 | 20/20 | 20/20 · 43 · 48% | 20/20 · 45 · 49% | ≤10% / ≥55% / ≥85% · share ≥35% · 40-65 s | all inside |
| mirror_hall | 2/20 | 19/20 | 20/20 · 43 · 48% | 20/20 · 48 · 47% | ≤10% / ≥55% / ≥85% · share ≥35% · 40-65 s | idle edge (10% against ≤10%) |
| frayed_court | 0/20 | 8/20 | 19/20 · 58 · 43% | 20/20 · 61 · 44% | 0% / 30-65% / ≥85% · share ≥35% · 55-85 s | novice edge (40% against 30-65%) |
| the_seamstress | 0/20 | 5/20 | 18/20 · 82 · 50% | 20/20 · 78 · 50% | 0% / 30-60% / ≥90% · share ≥35% · 70-120 s | novice edge (25% against 30-60%); skilled edge (90% against ≥90%) |
| the_unweaver | 0/20 | 8/20 | 20/20 · 188 · 49% | 20/20 · 191 · 50% | 0% / 25-55% / ≥80% · share ≥30% · 180-280 s | all inside |

#### Movement 4

| Fight | Idle | Novice | Skilled (won · s · share) | Expert (won · s · share) | Bands: Idle / Novice / Skilled | Verdict |
|---|---|---|---|---|---|---|
| the_silent_conductor | 0/20 | 4/20 | 19/20 · 175 · 50% | 20/20 · 171 · 50% | 0% / 15-40% / ≥80% · share ≥30% · 170-230 s | novice edge (20% against 15-40%) |

Win counts are of 20; "s" is the mean fight length in seconds; share is the Weaver's share of party output.

**Verdict: no cell is outside its band at this size; 15 readings are on the edge** (within one standard error of a bound): the Skilled bot at Glass Gallery (85% against ≥ 80%), the Blood Forge (90% against ≥ 85%) and the Seamstress (90% against ≥ 90%); the Novice at Shattered Choir (80%, band 40-85%), the Bellwarden (65%, 40-70%), Shield Wall (70%, 35-75%), the Blood Forge (65%, 35-75%), the Gorehound Matriarch (75%, above its 40-70%), Vharun (40%, 35-65%), Wraith Vigil (50%, under its ≥ 55%), Frayed Court (40%, 30-65%), the Seamstress (25%, under its 30-60%) and the Silent Conductor (20%, 15-40%); the Idle bot at Maw Hollow and Mirror Hall (2 of 20, at the ≤ 10% bound). Every Skilled share is above its floor (40-53%), and every Skilled length is inside its Movement II-IV band. The Novice's misses at the Matriarch (above) and the Seamstress and Wraith Vigil (below) would need the protocol's 50 seeds a cell (on its three cell sets, 16,200 fights for the four bots) to call; that was not run.

### Pillar 4: the share of fight time each hero spends with no action

**Command.** The cell probe above (`/home/user/aw-work/7/w9b/probes/cells.ts`, the four Movements' cells, 20 seeds, four bots, the default party), summed by `python3 -I /home/user/aw-work/7/w9b/probes/cellsum.py cells.jsonl idle`. No tool measured this before. What it counts: every tick of every fight until it ends, for each hero standing (not downed), the hero's `action`; "no action" is `idle` (not moving, attacking, casting, channeling, dodging, charging or reeled). Shares are of the hero's standing time, and of the standing time while at least one enemy stands (between waves a hero has nothing to do).

| Bot (the Weaver) | Kael | Lyra | Vexis | All, with an enemy standing |
|---|---|---|---|---|
| Idle | 22.8% | 15.0% | 15.9% | 7.1% |
| Novice | 7.7% | 6.8% | 6.8% | 3.2% |
| Skilled | 2.7% | 1.8% | 1.9% | 2.1% |
| Expert | 2.6% | 1.9% | 1.8% | 2.0% |

By Movement, with the Skilled bot and an enemy standing: Movement I 0.1-0.2% for each hero; Movement II Kael 3.6%, Lyra and Vexis 0.2-0.3%; Movement III 0.2-0.4%; the Silent Conductor 14.5-14.6% for all three alike (the Expert 14.9-15.1%). The fights where a hero idles most with an enemy standing (Skilled and Expert together): the Silent Conductor (all three heroes, 14.7-14.9%), then Kael at Pike Line (7.4%), the Blood Forge (6.4%) and Vharun (6.2%); everything else is under 2.5%. That the Conductor's share is the same for all three heroes points to a hold the fight puts on the whole party (the Grand Silence's stilling, or a Finale turn), not to a hero's AI; it was not broken down further. Kael's Movement II share was not traced either. Across all bots the heroes spend their standing time attacking (Kael 64%, Lyra 77%, Vexis 56%), moving (29%, 7%, 8%), casting (Lyra 6.5%, Vexis 24%) and channeling (Vexis 4.8%).

The pillar ("hero AI never does nothing") names no number. **Reported, not banded**: with a Weaver who plays (Skilled or Expert) the heroes have no action for about 2% of their standing time, 0.1-0.4% outside the Conductor's fight and Kael's Movement II; with an Idle Weaver much more of it (17%), most of that while no enemy stands (7.1% with one standing). Seren, Oro and Brann were not measured (the default party only).

### The report tools of Phase 6's ground rule 1, byte for byte against a pre-Phase-6 tree (5g *Open* 11)

**The trees.** The release candidate (`f74a46b`) and main at `2554e69`, the tree Phase 6's W0 checked before it changed any source (docs/phase-6.md, *Reconciled with main*; its children are the Phase 6 doc and W0's commits). The old tree was extracted with `git archive 2554e69` under the scratch folder (sharing the candidate's `node_modules`; the two `package.json` files differ only by three scripts) and removed afterwards.

**Command.** `/home/user/aw-work/7/w9b/probes/rule1.sh <tree> <out>`, run once in each tree, one tool at a time: the nine tools of the rule (`callings`, `astrolabe`, `reliquary --power`, `powercap`, `bonds`, `variants`, `dissonance`, `decrees`, `verbs`) in 21 of their existing modes, each at `--seeds 2` (the size the shared machine allows: the brief's rule). Then each output was compared with `cmp`, and again with the `done in N s` timing line left out.

| Mode (command, from the tree's root) | Byte for byte |
|---|---|
| `tools/callings.ts --calling luminary --seeds 2 --bots skilled` | identical |
| `tools/callings.ts --cells --movement 3 --encounters the_unweaver --seeds 2` | identical |
| `tools/callings.ts --cells --movement 4 --seeds 2` | identical |
| `tools/astrolabe.ts --fights --seeds 2` | identical |
| `tools/astrolabe.ts --trees silk,choir --bots novice --seeds 2` | identical |
| `tools/astrolabe.ts --movement 4 --fights --seeds 2` | identical |
| `tools/reliquary.ts --power --seeds 2 --bots novice` | identical |
| `tools/powercap.ts --seeds 2 --set typical --steps 1.3` | identical |
| `tools/bonds.ts --find --seeds 2` | identical |
| `tools/bonds.ts --fires --seeds 2` | identical |
| `tools/variants.ts --tree --fires --seeds 2` | identical |
| `tools/variants.ts --tree --seeds 2 --base 0.85 --base-hard 0.61 --variants chorale` | identical |
| `tools/dissonance.ts --seeds 2 --find` | identical |
| `tools/dissonance.ts --seeds 2` (every level) | the 13 lines before identical; **3 lines added**, one for each of Phase 6's levels (Tyrant, Mimicry, True Dissonance), as the mode lists every level in content |
| `tools/dissonance.ts --seeds 2 --combo --levels hardened:2,wounding_strikes:2` | identical |
| `tools/dissonance.ts --seeds 2 --bot novice --levels brisk_foes` | identical |
| `tools/decrees.ts --seeds 2` | identical |
| `tools/decrees.ts --boss the_silent_conductor --seeds 2` | identical |
| `tools/verbs.ts --seeds 2` | identical but for its timing line (`done in 31 s` / `32 s`) |
| `tools/verbs.ts --movement 4 --seeds 2` | identical |
| `tools/verbs.ts --movement 4 --seeds 2 --bot novice` | identical |

**Met**: every existing mode prints what it printed before Phase 6, byte for byte (outputs in `/home/user/aw-work/7/w9b/rule1/`). The one difference is the three appended levels in the all-levels mode, which adds rows for content that did not exist before and leaves every earlier row as it was. Not covered: these modes at their protocol sizes (`--seeds 2` only), and modes these tools gained in Phase 6 (they have no pre-Phase-6 output to compare).

### Pillar 5: no preset best in every cell

**Commands and size.**

1. `npx tsx tools/loadouts.ts --movement N --seeds 20 --bots skilled,novice --md <file>` for N = 1, 2, 3 and 4: the six Chord presets in every cell of each Movement (Movement I bare, II-IV on their kits), 20 seeds a cell on cell base 1000, the Skilled bot and the Novice (6,480 fights; no whole runs). The tool flags a preset that "dominates" (at least as good in every cell and 10 points better in total than every other). On top of it, `python3 -I /home/user/aw-work/7/w9b/probes/dominance.py m1.md m2.md m3.md m4.md` reads the pillar's own words: for each preset, in how many cells it is best (ties allowed), and whether any is best in every cell.
2. The builds at Tier I, as Phase 6 read them: the Expert at Tier I's set with each of the five other presets, 10 seeds on each of 2000 and 900007 (the tier probe with `--loadout`, 100 runs; Guardian's are the tier table's first 10 a set), split by Calling (4 runs a cell).

**Cells, by Movement** (cells in which each preset is best, ties allowed):

| Movement (cells) | Bot | Steady | Guardian | Bastion | Anchor | All In | Wide Choir | Best in every cell | The tool's flag |
|---|---|---|---|---|---|---|---|---|---|
| I (9) | Skilled | 7 | 6 | 7 | 8 | 6 | 7 | none | none |
| I (9) | Novice | 3 | 2 | 5 | 3 | 2 | 7 | none | none |
| II (9) | Skilled | 6 | 6 | 7 | 6 | 5 | 7 | none | none |
| II (9) | Novice | 5 | 6 | 4 | 4 | 5 | 8 | none | none |
| III (8) | Skilled | 4 | 4 | 5 | 5 | 6 | 4 | none | none |
| III (8) | Novice | 2 | 2 | 4 | 2 | 1 | 5 | none | none |
| IV (1) | Skilled | 0 | 0 | 1 | 1 | 0 | 0 | Bastion and Anchor, tied (100%) | none |
| IV (1) | Novice | 0 | 0 | 1 | 1 | 0 | 0 | Bastion and Anchor, tied (35%) | none |

**Met**: no preset is best in every cell of any Movement with more than one cell, for either bot, and the tool flags no dominant preset anywhere. The nearest is Wide Choir for the Novice (best in 7 of 9, 8 of 9 and 5 of 8 cells in Movements I-III, the Novice's highest mean in I and II), which loses at the Glass Gallery (65%), the Matriarch (55%) and the Unweaver (0 of 20). The Finale is a single cell, so "best in every cell" there only names the cell's best. Two readings beside the pillar: Wide Choir's Weaver share reads 29-32% for the Skilled bot in every Movement (the other presets 46-50%), under the ≥ 35% / ≥ 30% share floors the default party's cells are held to; and the tool's Skilled floors flag All In at Vharun (80%) and the Conductor (75%), Steady at Frayed Threshold (80%), and Anchor and Wide Choir at Frayed Court (80%, 75%). None is a band this pillar sets.

**Builds at Tier I** (Expert, won of 4 a cell; the band: at least 5 presets at ≥ 50%):

| Preset | None | Luminary | Martyr | Chronomancer | Conductor | All (of 20) | Phase 6 |
|---|---|---|---|---|---|---|---|
| Steady | 4 | 4 | 4 | 3 | 4 | 19 (95%) | 19/20, run for run the same |
| Guardian | 2 | 4 | 4 | 4 | 4 | 18 (90%) | 86/100 at 50 a set; these 20 are the tier table's |
| Bastion | 3 | 4 | 4 | 4 | 4 | 19 (95%) | 19/20, the same |
| Anchor | 3 | 4 | 4 | 2 | 4 | 17 (85%) | 17/20, the same |
| All In | 1 | 3 | 3 | 2 | 4 | 13 (65%) | 13/20, the same |
| Wide Choir | 1 | 4 | 4 | 3 | 4 | 16 (80%) | 16/20, the same |

**Met**: 6 of 6 presets at ≥ 50%, as Phase 6 read it (100 of 100 runs the same as its `b-*.jsonl`), and no preset is best in all five Calling cells (Steady, Guardian and Bastion are best in 4, Anchor and Wide Choir in 3, All In in 1). At 4 runs a cell this split is a screen, not a reading; the protocol's size (100 seeds on three sets) was not run.

### What was not run, or was run smaller

- **The protocol's size.** The tiers at Phase 6's reduced final size (Expert 50 a set, Skilled 30 a set), not the doc's 100 a set; the cells at 20 seeds on one cell set, not 50 on three (16,200 fights for four bots); the builds at Tier I at 20 runs a preset on two run sets, not on 333003 and not split by Calling at a size that reads (4 runs a cell); `tools/loadouts.ts` at 20 seeds on one cell set and with no whole runs (`--runs`).
- **The Novice and Idle bots at the tiers** (as in Phase 6): the Tier I band "Novice ≤ 15%" and the "Idle 0%" bands at every tier are still unmeasured. At the cells, the Idle bot's 0% bands hold at every boss, elite and miniboss.
- **The Echoes, the weekly rotation, the True Dissonance Finale cell and the new levels' costs** (Tyrant, Mimicry by 4d's method): Phase 6's other tables, not asked for here and not re-read. The tier readings above, run for run equal to Phase 6's and to the end-of-Phase-6 tree's, show the fight and run layers they rest on did not move.
- **Pillar 4 for Brann, Seren and Oro** (the default party only), and the cause of the Conductor's 15% idle share; **pillar 1** for any bot but the Expert and Skilled at tier 0.
- **The report tools' modes at protocol size** (`--seeds 2` only) and the modes Phase 6 added (nothing older to compare with).
- **The pillars' playtest halves** (people saying what mattered, describing the heroes): no person played.
- **The perf budgets other than the sim tick** (`e2e/perf.spec.ts`, the bench page, the GPU half): W4's and the release candidate's own runs, not part of this reading.

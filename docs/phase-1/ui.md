# Phase 1 UI: screens, HUD and hints

*Owner: the UI workstream (`src/ui/**`, `src/index.css`). Spec: [04-presentation.md](../plan/04-presentation.md) §5–§8.*

Everything here is reviewable without playing: open **`/?lab=ui`** (sidebar) or `/?lab=ui&view=<id>&nav=0`. Each HUD state and screen is rendered with fabricated `HudSnapshot` / `RunState` data, and the **Flow** view plays a whole Prelude with fake combats (Win / Lose buttons) through the real pure run functions in `meta/run.ts`.

## Screen map

| Screen | Where | File |
|---|---|---|
| Title (Continue, New run, Training Grounds, Codex, Settings) | `screen = 'title'` | `screens/TitleScreen.tsx` |
| Prep: party kits, ≤ 2 auras, live Spirit budget, quick assists, Embark | run phase `prep` | `screens/PrepScreen.tsx` |
| Map: left-to-right nodes, reachable glow, walked path, reward tooltip, party/motif sidebar | `map` | `screens/MapScreen.tsx` |
| Combat: `GameHost` + HUD + How to play + Pause | `combat` | `screens/CombatScreen.tsx` (lazy: three.js loads here) |
| Result: grade, best-moment banner, plain-English stats, HP timeline, death recap | `result` | `screens/ResultScreen.tsx`, `screens/Timeline.tsx` |
| Draft: 1 of 3 motifs, upgrade state, reroll (R), skip, keys 1–3 | `draft` | `screens/DraftScreen.tsx` |
| Respite: Rest vs Meditate (keys 1 / 2) | `respite` | `screens/RespiteScreen.tsx` |
| Summary: "proof of support" | `summary` | `screens/SummaryScreen.tsx` |
| Training Grounds: sandbox + spawn palette + debug buttons | `screen = 'training'` | `screens/TrainingScreen.tsx` |
| Codex (heroes, enemies, Weaver, auras, motifs), generated from `CONTENT` | `screen = 'codex'` | `screens/CodexScreen.tsx` |
| Settings (sound, comfort, assists, controls) | `screen = 'settings'` | `screens/SettingsScreen.tsx` |

`RunScreen` switches on `useRun().run.phase`; `SandboxScreen` dispatches `codex` / `settings` / `training` (Training lazy-loads the 3D view). Every screen file exports a pure `…View` component taking props (used by the lab) and a connected wrapper.

## Combat HUD anatomy

All parts re-render only from the 15 Hz `hud` snapshot (plus callouts); nothing runs per frame. Colour is always paired with a glyph, label or pattern; the minimum text size is 12 px.

- **Encounter header** (top-left): name, kind chip, wave n / m, time vs par (amber when over), enemies left. Training shows the sim clock instead.
- **Party frames** (bottom-left, `hud/PartyFrames.tsx`): portrait with a Solo-charge ring (READY + `⇧n` Cue key, SOLO while active); HP bar with the **shield** (cyan) stacked after HP and a **striped incoming-damage forecast** (amber survivable, crimson + pulsing border when lethal, with a `LETHAL −n` label); status badges with countdown rings (Dirge, Resound, Silence, Stun, Immune, Shaken…); cast bar; thread marker (`⟆` + Mend/Empower glyph); in-field pip and an "Outside field" label; downed (bleed-out ring + revive progress) and out-for-the-fight states. Hover or focus sets the smart-cast target (`setUiHover`), click threads that hero.
- **Weaver bar** (bottom, `hud/WeaverBar.tsx`): Life, Spirit with the reserved part **hatched**, four technique buttons (cooldown sweep and seconds, cost, Ward charges as diamonds, key caps, dimmed when unaffordable), the **Resonance arc** (4 segments) around the **Crescendo key** (blazes when affordable, timer ring while active), Thread mode / target / tension (Taut! / Snapped), aura chips, an "Auras silenced" tag when the field is suppressed.
- **Boss bar** (top-centre, `hud/BossBar.tsx`): HP with phase ticks, Discord shield overlay, enrage timer, **cast bar naming the ability with answer glyphs** (glyph + name + key), the latest decree (kept in `useUi().lastDecree`).
- **Callouts** (`hud/Callouts.tsx`): PERFECT / SAVE / CLUTCH banners centre-low; decree banner under the boss bar; wave toast; small reject toasts above the Weaver bar; barks as speech bubbles beside the speaker's frame (unmatched barks fall back to a toast); system and solo toasts.
- **Coach hints** (`hud/hints.ts`, `hud/CoachHints.tsx`): one at a time, each at most 3 times (persisted in `localStorage`), only while relevant, only when `settings.hints` is on and never in the sandbox. Derived from the snapshot alone.
- **How to play** card: first fight of a fresh player; **pauses the sim** (`getRuntime()?.setPaused(true)`), "Begin the fight" resumes. Seen-flag persisted.
- **Pause menu** (Esc, runtime-owned toggle): Resume, Settings (embedded), Abandon run (confirm) or, in Training, Leave.
- **Key hints** (top-right): controls reminder for the first two fights and Training.

### Hint list

| id | When | Text |
|---|---|---|
| `lethal-ward` | a hero's forecast is lethal and Ward is ready | "A lethal hit is coming at *Kael* — Ward `Q` just before it lands for a Perfect" |
| `lethal-reel` | lethal, Ward not ready, Reel ready | "*Lyra* is in a lethal zone — Reel them out `F`" |
| `big-hit` | forecast ≥ 30% max HP, not lethal, Ward ready | "A big hit is coming at *Kael* — Ward `Q` just before it lands for a Perfect" |
| `marked` | a hero has Dirge | "*Lyra* is marked — press `E` to Chime it away" (or Ward can soak it) |
| `downed` | a hero is down | "*Kael* is down — Thread them `1` and let Mend revive them…" |
| `hurt` | a hero < 50% and not threaded | "*Kael* is hurt — click their frame or press `1` to Thread them" |
| `hurt-mode` | hurt hero is threaded in Empower | "…press `RMB` to switch the Thread back to Mend" |
| `silenced` | field suppressed | Mute: mark it with `G`; boss: Rally into a hymn circle |
| `strayed` | a hero is well outside the field | "…move closer so your auras reach them, or Reel `F` them in" |
| `cue` | a Solo is ready and a Resonance segment is available | "*Kael*'s Aegis Wall is ready — press `⇧1` to Cue it…" |
| `crescendo` | Resonance ≥ Crescendo cost | "Resonance is full — press `R` for Sunrise" |
| `boss-cast` | the boss is casting | "*Requiem* is coming — answer it with Dome or Ward" |
| `thread` | no Thread attached after 3 s | "Click a party frame or press `1` to attach your Thread…" |
| `empower` | everyone ≥ 85% for a while, Mend mode | "Everyone is healthy — press `RMB` to switch the Thread to Empower…" |

## Contract changes

- `src/ui/store.ts`: additive `lastDecree: { name; text } | null` on `UiState`, set by `pushCallout` for `decree` callouts and cleared by `resetCombat`, so the boss bar can keep showing the last decree.
- `src/index.css`: extra tokens (`--color-spirit`, rarity colours), keyframes and helper classes (`.stripes`, `.anim-*`).
- `src/ui/kit/*`: new components (Button, Icon, Ring, Chip, Slider/Toggle/Segmented, Modal, Backdrop, sound helpers); Panel gained `tone`.

## Lab views

`hud-calm`, `hud-crisis`, `hud-downed`, `hud-boss`, `hud-resonance`, `hud-sandbox`, `howto`, `pause`, `title`, `prep`, `map-start`, `map-mid`, `result-win`, `result-loss`, `draft`, `respite`, `summary-win`, `summary-loss`, `summary-abandon`, `codex`, `settings`, `flow`. Extra params: `h=<px>` stage height (tall screens), `fit=0` for 1:1, `nav=0` hides the sidebar.

Screenshots: [docs/phase-1/ui/](ui/).

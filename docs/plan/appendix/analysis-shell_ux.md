> **Appendix — raw analysis report** produced while planning the remake. Line references point into the original game's source (`src/…`). It is kept verbatim as evidence; the conclusions are synthesised in [../01-findings.md](../01-findings.md).

# AETHERWEAVER: app shell and the player experience around combat (current build)

**Scope:** `src/App.tsx`, the five shell components, `game/sound.ts`, `index.css` and `index.html`. I read Arena3D only where it connects to the shell. Paths are under `src/`; a bare line number refers to the last file named.

## TL;DR
- **No session structure.** The arena runs from the first frame, even behind the tutorial. A "run" is just the stretch between two `resetRunStats()` calls. You cannot fail, and you can summon the boss at any time. The loop is fight → report → straight into a new fight.
- **App.tsx does almost everything.** It has 37 `useState`, 7 effects and 20 handlers. It holds every progression rule, a 766-line HUD, the report and the Codex. There is no store, no context and no memoisation.
- **Constant re-rendering.** About 10 times a second the arena hands React a full HUD snapshot, even while paused, and the whole tree re-renders, open menus included. In combat the full save is also rewritten to localStorage about 10 times a second.
- **Thin audio.** There are 12 synthesised voices for about 30 events. There is no music and no mix bus. A hero going down, the boss arriving and the boss dying have no sound of their own.
- **Overloaded HUD.** About 70 numbers, mostly in 8–10 px text.
- **Misleading report.** It lists rewards that were never paid, and it grades a 2.5-second DPS sample as if it were the whole run.

## 1. Session and run flow

**First launch**
- `main.tsx:7` mounts the app in StrictMode. State starts from hard-coded defaults (`App.tsx:181-237`): level 1, three auras active, two magic relics, six currencies, a T1 waystone with no mods, and one passive point plus one ascendancy point to spend.
- The save is applied later, in an effect (`240-290`), so the first paint always shows the defaults.
- Arena3D spawns 5 normal enemies and 1 elite as soon as it mounts (`Arena3D.tsx:1433-1434`).
- The tutorial is 6 static cards (`TutorialOverlay.tsx:5-48`), shown until `aetherweaver_seen_tutorial_v2` is set (`App.tsx:362-368`).
- It doesn't pause the game (it is missing from `isGamePaused`, `1112`), so the fight runs behind it and ability keys still fire.
- Esc doesn't close it, and it can only be reopened from a "guide?" link shown on extra-wide screens (`1520,1525`).

**Starting an expedition**
- There is no explicit start. The run timer is set when the app mounts (`214`).
- Picking a tier in the Atlas just swaps the waystone and closes the menu (`2141-2144`). Enemies, wave progress, counters and the timer all carry over.

**Waves**
- Spawning never stops: 1–2 enemies every 2.1 s, up to 10 alive at once (`Arena3D.tsx:2974-2985`).
- Each kill fills the "Resonance Breach" bar: +9 for a normal enemy, +24 for an elite (`2738`). The boss spawns when it reaches 100.
- The **Summon** button skips the waves entirely (`HudBits.tsx:442-447`).

**Boss**
- The top panel changes to the boss's HP, affixes and a Decree box with a timer (`HudBits.tsx:377-427`).
- If the player dies, they respawn at 75% life with 20 less ult charge (`Arena3D.tsx:2926-2938`).
- A downed hero is revived by tethering them or standing near them for about 2.4 s (`2288-2300`).
- Nothing ends a run in failure.

**Report and rewards**
- On the killing blow, all in the same frame, the game grants XP, drops 5 extra loot piles and calls `onBossDefeated` (`2716-2736`).
- The app then unlocks the next tier, pays currency and shows the report, which pauses the game (`App.tsx:649-726, 1897-1992`).
- The grade runs from S+ down to C. It is computed from `attr%×1.4 + saves×9 + cleanses×3 + tier×5`.

**Next run**
- "Descend" re-rolls the waystone with the same number of mods and calls `resetRunStats()` (`1976-1987`).
- `resetRunStats` (`Arena3D.tsx:947-988`) clears enemies, zeroes the run counters, heals the heroes and spawns a fresh pack.
- It does not reset ult charge, cooldowns, player life or loot on the ground, so one run bleeds into the next.
- "Spend Ascendancy Point" does the same reset but keeps you on the tier you just cleared.

**What persists between runs**
- Saved, as one JSON blob (`App.tsx:296-323`): levels and XP, passives, gems, clusters, runes, gear, inventory, currencies, tiers, ascendancy, bonds, attunements, sigils, loadouts, lifetime stats, deeds and settings.
- Not saved:
  - The current waystone, so a reload puts you back on T1 (`204`).
  - The party stance.
  - Loot on the ground.
  - The run in progress.

**Save and load**
- **Storage:** four localStorage keys (`aetherweaver_save_v1`, `_settings_v1`, `_muted_v1`, `_seen_tutorial_v2`). Settings and mute are written in two places.
- **Versioning and migration:** there is no version field. Migration is limited to spreading defaults under a few fields, plus `normalizeItem` (`245-284`). Gems, clusters, bonds and loadouts are trusted wholesale.
- **Writing:** the save is written by an effect whose 23-item dependency list is kept in sync with the object literal by hand (`327-352`).
- **Errors** are swallowed (`285`).
- **Reset:** deletes the keys and reloads, after a two-step confirm (`1104-1110`).
- **Missing:** export, backup and save slots.

**Leveling and XP**
- **Kill XP:** 26, 95 or 420 (normal, elite, boss), multiplied by (1 + waystone XP%) and by (1 + 0.25·(tier−1)) (`Arena3D.tsx:2716-2719`).
- **Level curve:** `220·1.16^(L−1)`, capped at level 30. The formula is written out twice (`App.tsx:502, 553`). By my arithmetic, level 30 takes about 100k XP and a T1 run gives about 1k.
- **Passive points:** (L−1), plus up to 11 from the starter point and first clears of T1–T10, plus 4 from deeds: 44 points for 63 nodes (`499-501`).
- **Gems:** each active gem gets the larger of 4 XP or 45% of every XP grant, on a `120·1.28^(L−1)` curve capped at 20 (`572-590`).
- **Bonds:** bond XP is 12% of effective healing (`Arena3D.tsx:2348`).
- **Ascendancy points:** 1 to start, plus one each for the first clears of T2, T4 and T6.

**Toasts and the event feed**
- **Toasts:** up to 3 at a time, 3.4 s each, at a fixed `top-[68px]`. They don't wrap (long text gets an ellipsis) and can't be clicked (`App.tsx:429-438, 1369-1386`).
- **The feed:**
  - Keeps 8 entries and shows 5. Entries never expire, because `time` is never read (`HudBits.tsx:454-487`).
  - Appears only on extra-wide screens.
  - Is filled by a check every 1.4 s for new saves, cleanses, Warden kills, decrees, cascades and resonance peaks (`App.tsx:986-1036`).
  - Never reports a hero going down, a failed decree or the boss spawning.

**Pause, settings and keybinds**
- **Pause:** a button only (`1210-1216`), with no key and no overlay. Menus and the report auto-pause; losing focus doesn't.
- **Settings** (`SettingsModal.tsx:5-27`): volume, three audio toggles (one does nothing), auto-move, feed, hints, render scale and "reduced flash". There is no UI scale, colour-blind mode, music volume or rebinding.
- **Keybinds:** hard-coded in four places:
  - The arena handler (`Arena3D.tsx:1803-1835`). It reads `e.key`, so AZERTY keyboards break.
  - The app's menu handler (`App.tsx:505-533`).
  - The cheat-sheet strings (`1531-1546`).
  - The keycap labels.

**What the HUD shows, and where**
- **Top row:** level/XP, waystone, buttons, stance and currencies on the left; wave bar or boss/Decree in the centre; attribution and "Vacuum loot" on the right.
- **Left column** (`top-[132px]`): raid frames, auras, set bonuses, chorus.
- **Right column** (extra-wide only): cheat-sheet and feed.
- **Bottom:** life/ward globe | menu tabs, charges/resonance, then beam, Dash, Ult, Cleanse, Sigil | spirit globe.
- **In the world:** nameplates, "CLEANSE [E]!" banners, loot labels, floating numbers (`Arena3D.tsx:3173-3258`).

## 2. State architecture

**How much lives in App.tsx**
- All persistent state and all UI state.
- Every progression rule: reward tables, salvage economics, XP curves, and a deed `switch` that repeats the ACHIEVEMENTS ids (`1040-1085`).
- All the markup. HUD JSX is a third of the file (`1129-1895`), and menu wiring plus the inline Codex is another 14%.
- There is no domain layer, reducer, context or `React.memo` anywhere.

**How combat telemetry flows into React, and how often**
- The simulation lives in closure variables inside one 2,900-line `useEffect` (`Arena3D.tsx:239-3171`).
- Props are mirrored into refs and callbacks go through `callbacksRef`, so no handler is ever stale.
- Every 85 ms of sim time (about 10 Hz at 60 fps), the arena builds fresh HUD, ally and telemetry objects. It then calls `onHudUpdate`, which makes four `setState` calls (`App.tsx:536-544`), and also sets its own tag arrays (`3035,3048`).
- React batches all of this into one commit of the whole App tree, plus whichever menu is open.
- The sync sits outside the pause check (the guard spans `1937-2986`; the sync is at `3004`). So browsing menus still re-renders 10 times a second.

**Other sources of churn**
- **(a) Ult recomputes the build.** The `build` memo depends on the decimal `ultActiveRemaining` rather than the true/false it actually uses (`468/480`). The whole stats engine re-runs on every tick of an ult, and the new object goes to the arena, three menus and the deed check.
- **(b) Saving.** Every bond-XP update creates a new `heroBonds`, which fires the save effect. That is a full `JSON.stringify` plus a blocking write of tens of KB, about 10 times a second until all bonds hit rank 10. XP per kill and the lifetime stats every 1.4 s also trigger saves.
- **(c) Popups.** Each floating popup is one React state update plus a `setTimeout`.
- **(d) Blur.** 13–19 `backdrop-filter` panels sit over a 60 fps WebGL canvas, and the browser has to re-blur them every frame. This is probably the bigger GPU cost.

**Prop drilling vs context**
- App drives the arena through props mirrored into refs, plus a mutable `actionRef` (`Arena3D.tsx:1789-1800`) whose triggers ignore pause (bug 11).
- Menus are prop-drilled. ConduitMatrix alone takes 20 props, many of them inline lambdas.
- `sound` is a module singleton that App configures by mutating it.
- The HUD re-derives sim constants itself. For example, `resonance/260` (`App.tsx:1121`) copies `Arena3D.tsx:821`, while other sim formulas use /220 and /400.

**What will hurt maintainability and performance**
- Every feature touches App.tsx.
- Run state is private to the closure, so it can't be saved, tested or replayed.
- The save is untyped (`parsed` is `any`).
- Copy has drifted from data: the Codex says "50 nodes, 9 keystones" (`2245`), but the data has 63 nodes and 10 keystones.
- There is no error boundary or WebGL fallback, so if WebGL fails the menus go blank too.

## 3. Audio

**What sound.ts does**
- It is pure WebAudio synthesis: no samples, no music, no ambience ("no files, all synthesized live", `SettingsModal.tsx:113`).
- Each cue is 1–6 sine, triangle or sawtooth oscillators with an attack/decay envelope. There is no noise source, filtering, reverb or panning.

**Which events have sounds**

| Voice | Events |
|---|---|
| heal tick | healing: pitch rises from 340 to 780 Hz with the target's HP, at most once per 115 ms (`sound.ts:27-61`). Also used for the lock and salvage UI clicks. |
| amp tick | damage-amp hits, at most once per 65 ms |
| cleanse chime | cleanse; bulk salvage |
| charge bank | Aether Charge banked |
| cascade | Resonant Cascade |
| lifesaver chord | clutch save, revive, Undying, decree answered, **level-up** |
| dash / sigil | their abilities |
| aura toggle | aura on/off; many UI clicks |
| ultimate | your ult, **a boss decree being issued**, **loading a loadout** |
| loot filter | drops by rarity (magic drops are silent); also deeds, unlocks, saving a loadout |
| craft slam | crafting |

About 30 events share 12 voices, so a sound stops meaning one thing: a boss decree sounds exactly like your own ult.

**What has no sound**
- A hero going down (it only gets a popup, `Arena3D.tsx:2449-2455`).
- The player being hit.
- Telegraph wind-ups.
- The boss spawning or dying (on death you only hear its loot chimes).
- The report opening.
- UI hover and confirm.

**Music:** none.

**Mixing and volume**
- Every voice connects straight to `ctx.destination`. There is no master gain, bus, limiter or voice cap.
- Volume is a multiplier applied when each sound is scheduled. Peaks are 0.055–0.16 × the default 0.45, so everything is very quiet. Even so, the 6-voice ult chord stacked on top of a cascade can clip.
- `lootChimesEnabled` is set but never read (bug 3).

## 4. UX and game-feel critique

**HUD information architecture**

The HUD is overloaded.
- **Essential** for a support player:
  - Each hero's HP, ailments and downed state.
  - The tether target and beam mode.
  - Your own cooldowns, life and ward.
  - Boss HP and the current Decree.
  - The telegraphs in the 3D scene.
- **Noise that is always on screen:**
  - Six currencies.
  - XP and the waystone name.
  - The stance selector.
  - Six menu tabs, sitting right above the abilities.
  - The cheat-sheet.
  - Chorus dots and set-bonus text.
  - The 4-stat attribution grid.
  - A spirit globe that barely moves.
  - Per-hero DPS.
- **Duplication:**
  - Hero HP appears on both the frame and the nameplate.
  - Ailments raise three signals at once: frame pips, a bouncing banner in the world and the pulsing Cleanse ring. The banner ignores the hints toggle (`Arena3D.tsx:3185`).
  - Keybinds appear in four places.
- **Collisions:** toasts at `top-[68px]` and the Warden warning at `top-[104px]` land on the boss/Decree panel at exactly the moment it matters. At busy moments 6–10 elements pulse at once, so nothing reads as urgent.

**Onboarding**
- Six cards with nothing to try introduce about 28 proper nouns while enemies attack.
- From the first second, all six menus, six currencies and two pulsing "spend me" badges are live. Nothing unlocks gradually, and there is no first objective and no safe place to practise.
- "Resonance Breach" (the wave bar) and "Resonance" (the combo meter) are two different things with nearly the same name.
- Panel names drift between places:
  - Deeds / Legacy
  - Astrolabe / Tree
  - Reliquary / Gear
  - Atlas / Map
  - Suzu / Purifying Chime
- A permanent cheat-sheet shows the controls are never taught through play.

**Readability**
- In App.tsx and HudBits, 8–10 px text appears 69 times against 16 for 12 px; 13 are 8 px. Cinzel caps at 10 px lose their detail.
- Contrast fails WCAG AA at these sizes: `slate-500` labels come to about 4.2:1 and `slate-600` (`HudBits.tsx:173`) to about 2.7:1.
- Key numbers only appear in native `title` tooltips (70 of them). These are slow, can't be styled and don't work with touch or keyboard. A styled `[data-tip]` tooltip in `index.css:160-181` is never used.
- Internal ids leak into the feed, for example "+1 divineTears" (`App.tsx:617`).

**Accessibility**
- **Remapping:** none.
- **Text size:** there is no UI scale.
- **Colour reliance:**
  - Magic and rare loot differ only by colour.
  - HP bars go from red to green.
  - Ailments are shown as emoji, and 🟣 for Void Rot means nothing to a player.
- **Reduced motion:** the "Reduced flash" setting only stops 7 looping CSS classes (`index.css:150-158`). It ignores `prefers-reduced-motion`, leaves entrance animations running and never reaches the 3D scene (Arena3D isn't passed the setting, `App.tsx:1132-1145`).
- **Screen readers:** no `aria-live` regions and no focus trap.
- **Input:** no gamepad or touch support.
- **What helps:** menus pause the game, and auto-move is available.

**How rewards are presented**

The end-of-run report is not satisfying.
- **Timing:** it opens on the same frame as the kill and covers the boss's death and the loot fountain. The boss-kill and level-up toasts render underneath it (toasts are z-30, the report z-50). There is no sound, no count-up and no beat.
- **Content:** it lists rewards that were never paid and leaves out what was actually earned (loot, XP, levels, gem and bond gains).
- **The headline stat:** "% of all Party DPS came from you" is a rolling 2.5 s sample, not the whole run (`Arena3D.tsx:2690-2691` → `App.tsx:654-657`).
- **Missing:** the grade formula, personal bests and a per-hero breakdown.
- **Buttons:** "Spend Ascendancy Point" shows even when you have none. There is no "replay tier" button.

**Friction in the menu loop**
- The hub is a full-screen modal over a paused fight, and closing the report drops you straight back into combat.
- Every session starts at T1.
- Changing tier mid-run keeps the old run going.
- When the stash fills up, items are deleted silently.
- What works: hotkey toggles, tab badges and Esc to close.

**Visual identity and style consistency**
- The panel kit is consistent: navy glass, gold edges and three fonts.
- The content is a collage, and the code says so itself: "POE DUAL-SPLIT RESOURCE GLOBES + OVERWATCH SLANTED ABILITY BAR" (`App.tsx:1564`).
- Player-facing copy names other games and borrows Path of Exile item names (Shavronne's, Victario's, Prism Guardian, Vaal; `2201-2228`). That is a problem for identity and probably for IP.
- Three icon systems are mixed: lucide icons, Unicode glyphs and emoji.
- Glyphs change meaning: ✦ is Exalted at `1268` but Astral at `1998`.
- Amber marks progression, selection, the ult, saves, auras and toasts, so it no longer signals anything.

## 5. Bugs

| # | Where | Bug and why |
|---|---|---|
| 1 | App.tsx:602, 2120 | **Items vanish silently.** Picking up an item trims the stash to 40 (`slice(0,40)`), but the forge allows up to 60. Whatever falls past 40 is deleted, including locked items and uniques. |
| 2 | App.tsx:984-1014 vs Arena3D.tsx:959-967 | **Lifetime stats under-count after the first run of each session.** `lastCounters` is never reset when `resetRunStats` zeroes the run counters, so each delta stays clamped to 0 until a run beats the previous run's totals. Count-based deeds suffer as well. |
| 3 | sound.ts:282-317; App.tsx:446 | **The loot-chime toggle does nothing.** `playLootFilter` never checks `lootChimesEnabled`. |
| 4 | App.tsx:204, 296-323 | **The waystone isn't saved.** A reload always puts you on T1 with no mods. |
| 5 | App.tsx:663-720 | **The report lies about rewards.** It shows "+1 Ascendancy Point" on every first clear, but only T2, T4 and T6 award one (688). It shows "+1 Astrolabe Point" above T10, which isn't paid (684). Replays list 2 rewards but pay 3–4 (700-706). |
| 6 | App.tsx:941 | **Locked magic items get salvaged.** "Salvage all magic" ignores `locked`, which breaks the promise at types.ts:196. |
| 7 | App.tsx:912-925 | **Auto-equip swaps out locked gear.** Locked items are excluded from the candidates, so a locked item you're wearing gets replaced. It also skips the gem transfer (777-792). |
| 8 | App.tsx:549-569 | **Level-ups misfire.** The level change, sound and toast run inside a `setPlayerXp` updater. StrictMode runs updaters twice, so dev builds toast twice. Two XP grants in the same frame both start from the old `playerLevel`, which can duplicate a level-up and corrupt XP. The toast always says "+1 point", even after several levels. |
| 9 | App.tsx:285-288, 293 | **A failed load wipes the save.** If loading throws, the app still marks itself hydrated, and the next save writes defaults (or a half-loaded state) over the player's data. There is no warning and no backup. |
| 10 | App.tsx:1112, 505-533 | **The tutorial doesn't pause or block input.** Menu hotkeys also open menus behind the tutorial and the report; only `c` is guarded (527). |
| 11 | Arena3D.tsx:840, 1490, 1623, 1705, 1738, 1768-1774 | **You can act while paused.** The trigger functions don't check pause; only the keyboard path does (1808). Clicking HUD buttons or Summon while paused still works. |
| 12 | App.tsx:605, 620-621 | **Uniques toast twice.** A unique's ★ label triggers a second toast. |
| 13 | App.tsx:2058, 2072 | **Loading a loadout rolls back gems.** It restores the gem levels, XP and unlocks saved with it, so Astral Shards spent since then are lost. |
| 14 | App.tsx:2141-2144, 719 | **Run boundaries are wrong.** Switching tier mid-run doesn't reset the run, and run duration includes time spent in the tutorial and menus. |
| 15 | App.tsx:654-657, 1015-1026 | **Attribution is a 2.5 s sample.** The report, the best-attribution record and the 60% deed all use rolling 2.5 s DPS, not the run. |
| 16 | App.tsx:2036 | **Shard level-ups break the gem XP curve.** Buying a level with shards doesn't update `xpToNext`, so the next natural level is cheap. |
| 17 | App.tsx:898 | **Salvaging counts as crafting.** Bulk salvage adds to `relicsCrafted`, so the crafting deed can be farmed. |
| 18 | App.tsx:98 | **`lifetime.runs` never increments.** |
| 19 | SettingsModal.tsx:149-154 | **"Restore gameplay defaults" also resets volume and audio.** |
| 20 | Arena3D.tsx:1806, 1838 | **Keys stick after alt-tab.** There is no blur handler, so a key held during alt-tab stays down and the player keeps walking. |
| 21 | data.ts:1966 | **Every tier above 10 has the same name.** The index is clamped before the `??` fallback, so all of them are called "X. Apex Sanctum of Eternity". |

## 6. What this means for the remake
- **Make the run a real object:** phases (prep → waves → boss → victory beat → report → hub), real stakes, a ledger the report reads from, and a full reset.
- **Take fast HUD values off React's full-tree render** (store selectors or direct DOM writes). Don't sync while paused, and save on run end, idle and `pagehide`.
- **Version the save:** validation, migrations, a backup before overwriting, and the waystone included.
- **One action map keyed on `e.code`**, driving input, keycaps, the tutorial and rebinding.
- **An audio bus** (music / SFX / UI with a limiter), a distinct cue per key event (danger first), and music that follows the run's phase.
- **Separate combat and hub HUD layers**, a 12 px minimum and one meaning per colour. Teach through an interactive first run.

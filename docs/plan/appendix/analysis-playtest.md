> **Appendix — raw playtest report** produced while planning the remake by an agent driving the running original with Playwright (SwiftShader rendering; the game loop stepped at a fixed 50 ms, i.e. a 20 FPS-equivalent simulation, with `Math.random` seeded so idle and active runs share spawns and gear). Kept verbatim as evidence; conclusions are synthesised in [../01-findings.md](../01-findings.md).

# AETHERWEAVER — hands-on playtest report

Screenshots referenced below are bundled (as JPEG) in [screenshots/playtest/](screenshots/playtest/). **★ marks the 8 to open first.**

## How I played it

- **Setup.** I played the unmodified dev server in Playwright Chromium at 1600×900 with SwiftShader, which renders at **3.3–3.4 FPS**. The game clamps its timestep to 50 ms, so below 20 FPS it runs in slow motion (0.17× real time here).
- **Time compression.** To finish full runs, I stepped the game's own requestAnimationFrame loop with exact 50 ms timestamps, 4–8 steps per real frame, and skipped GL draws on the in-between steps. That is exactly what a 20 FPS machine simulates, rendered at full resolution about every 0.2–0.4 game-seconds.
- **Seeding.** I seeded `Math.random`, so same-seed idle and active runs share gear and spawns. Runs are near-deterministic: the idle run and the primer-reading run on seed 101 produced identical report cards.
- **Times** are game seconds from closing the primer. The sim had already run about 7.6 s by then.
- **Idle** = close the primer, touch nothing. The only clicks were "Descend" on report cards.
- **Active** = a scripted bot with roughly 0.2–0.4 s reaction time:
  - **Eyes:** it reads the HUD every ~0.2 game-s, and sees what a player sees on screen (its position, the heroes, telegraph circles) via three.js' devtools hook.
  - **Beam:** it heals the lowest hero below 55%, and amps the top-DPS carry once everyone is above 80%. On "Single Thread" it holds the beam on the MARKED hero.
  - **Abilities:** it cleanses at the afflicted hero and puts the Sigil on the tank. It fires Ult on emergencies or when the boss is up, and Cascade when charged.
  - **Movement and loot:** it leaves telegraphs, walks to downed heroes, and vacuums loot.
- **Coverage:**
  - 3 seeds × T1–T3 for each policy, plus an 8-tier chain for each.
  - Idle variants: auto-move on, Focus Boss, Free Hunt, Summon at 1 s.
  - The primer, read at a normal pace.
  - Every panel, on a fresh save and on a level-10 save.
  - Both report-card buttons.
  - A frame-rate experiment.

## The key question: does idling still win? **Yes — in every configuration and every tier I tried (T1–T8).**

| 20 FPS sim | Idle (no input) | Active (bot) |
|---|---|---|
| T1 boss fight, seeds 101/202/303 | **78 / 46 / 23 s** | **8.6 / 6.8 / 9.4 s** |
| T2 | 91 / 27 / 34 s | 9.6 / 10.4 / 4.0 s |
| T3 | 17 / 18 / 19 s | 9.0 / 7.0 / 10.2 s |
| T4–T8 (seed 101 chain) | 86 / 77 / 98 / **205** / 88 s | 4.6 / 9.8 / 8.2 / 11.2 / 16.6 s |
| Closing primer → boss dead | 28–218 s | 10–27 s |
| Hero downs per tier | 0–35 (median 12) | 0–2 |
| Dead-hero-seconds per tier | up to 469 | ≤ 8 |
| Attribution (HUD average) | **3–9%** | **20–56%** |
| Report grade | **C in 14/14** | A 5, B 7, C 5 |
| Boss Decrees seen | 1–8 per tier | **2 in 17 clears** (T7, T8 only) |

- **Every no-input setup cleared T1** on seed 101:
  - auto-move on: 70 s fight;
  - Focus Boss: 52 s;
  - Free Hunt: 114 s, with Kael downed 19 times and 1.5% attribution;
  - Summon at 1 s and then idle: 144 s, with Kael downed 25 times and both DPS heroes dead throughout.
- **What you can influence:** kill speed (2–19× faster, median about 7×), how long heroes stay dead, attribution, the grade, and Decree outcomes.
- **What you can't influence: winning.** Nothing produces a loss.
  - Downed heroes revive when your beam falls back onto them or you stand on them.
  - The Weaver respawns in place at about 75% life for 20 ult charge. That first happened to the idle Weaver at T5.
  - No wipe or defeat state exists.
- **The biggest lever is a one-time setup, not play.** In 3 of the 8 chain tiers the bot pressed no ability key at all. It kept the beam amping a carry and walked with the party, and still killed bosses 10–20× faster than idle.
- **Also outside your control:**
  - The opening wave: in 10 of 17 T1 runs a hero, usually Kael, was down 5–8 s in, before or as the boss spawned.
  - What heroes target: "Focus the Dissonant Warden!" is an order you can't carry out.

## What a new player sees and feels

- **0:00 — the primer.**
  - Six cards introduce about 16 keys and terms (Caduceus Beam, Mending Stream, Reservation Efficiency, Enlighten, Arrogance, Chorus Harmonics, Resonance, Aether Charges, Decrees…).
  - Dash, Sigil, Ult, stances and **how to revive** are never explained. It tells you to link "Arrogance", which is locked.
  - The arena keeps simulating behind the blur. I read at about 15 s per card: the wave filled during card 1, the boss spawned and all three heroes went down during card 2, and the boss died during card 6.
  - **Closing the primer shows "Tier 1 Sanctum Cleared — C — 11%"** for a fight you never saw (★ [tutorial_after_close](screenshots/playtest/tutorial_after_close.jpg)). The boss arrives 13–24 s after the arena starts, so anyone who actually reads the cards lands mid-boss.
- **First 10 s after skipping the primer:**
  - The wave bar is at about 60%.
  - A purple "AURA FIELD SUPPRESSED — Focus the Dissonant Warden!" banner is up.
  - Red "CLEANSE [E]!" tags bounce over the heroes.
  - Grey cones are closing in, and feed and toast spam arrives ("Level 2" twice).
  - The first feeling is "I'm already behind and I don't know where to look" (★ [panels_fresh_hud](screenshots/playtest/panels_fresh_hud.jpg)).
- **10–25 s:** the boss, a crimson octahedron, lands on the party. With active play it dies in about 9 s, and a report card with a grade and seven currency chips appears.
- **Minute 1:** T2 and T3 go the same way, about 17 s each. After roughly 60 s of play you have:
  - level 10;
  - **14 unspent Astrolabe points** and 2 Ascendancy points;
  - 9 relics, several of them uniques, sitting in the stash with 4 of 6 slots empty (★ [panels_progressed_reliquary](screenshots/playtest/panels_progressed_reliquary.jpg));
  - pulsing badges on four tabs.
- **After that,** combat teaches nothing new. Past T1 the bot usually needed 0–5 ability presses per tier, and the remaining depth is all in the menus. The idle player had 21 unspent points by T5 and reached level 23 by T8.

## Readability of threats

**What works:**
- The raid frames: HP colour thresholds, overshield overlay, ailment pips with an "[E]" hint, "DOWNED — REVIVING x%", and MARKED and IN AURA tags.
- The boss bar with phase ticks and affixes.
- Hero nameplates.

**What doesn't:**
- **Heroes and enemies share one cone-and-floor-ring look.**
  - All normal enemy types (brute, lancer, soulbinder) are one grey cone, nearly invisible on the dark floor.
  - Every elite, including the Dissonant Warden you're told to "focus", is the same amber cone with a crown.
  - Enemies have no health bars.
- **Telegraphs** are a red ring with a slowly filling disc. They compete with:
  - the purple aura ring and three coloured aura sub-rings;
  - the Sigil hexagon and each hero's base ring;
  - the Warden field;
  - a red base ring under *every* enemy, in nearly the same red.

  Boss telegraphs often sit under the boss mesh (★ [idle_s101_e1_boss_spawn](screenshots/playtest/idle_s101_e1_boss_spawn.jpg)).
- **Critical text is covered.**
  - When a Decree runs alongside a Warden, the suppression banner sits exactly on the Decree's instruction line. The boss's main mechanic is unreadable (★ [idleLong_s101_e5_decree_SPIRIT_VOID](screenshots/playtest/idleLong_s101_e5_decree_SPIRIT_VOID.jpg); also [idle_s101_e2_decree_SHATTER_HALO](screenshots/playtest/idle_s101_e2_decree_SHATTER_HALO.jpg)).
  - Toasts stack on the same banner.
  - From T2, loot labels and light pillars (up to 28 drops on the floor) bury nameplates and the CLEANSE callouts.
  - "AURA FIELD RESTORED!" and "RESONANT CASCADE ×3" are painted on the floor in 3D and are unreadable from the camera angle.
- **The state shown is wrong.**
  - Downed heroes keep their last DPS, so "Party DPS" reads 400–540 with two of three heroes dead.
  - The suppression banner can linger after "Warden slain — field restored" ([active_s101_e1_boss_spawn](screenshots/playtest/active_s101_e1_boss_spawn.jpg)).
- **Who's in danger** is easy to read from the frames. It barely matters, because danger has no consequence.

## Pacing and difficulty

- **Everything is compressed into seconds.**
  - The wave fills in about 7–10 s, and the boss arrives 5–16 s after you take control.
  - Active boss fights take 4–17 s.
  - Decrees, the only support-specific boss demands, arrive about 15–22 s into a fight. So **an engaged player almost never sees them** (2 in 17 clears), while an idle player gets up to 8 per fight.
- **Pacing is a lottery.** With no input, the same T1 boss fight lasted anywhere from **18 to 156 s** across 7 seeds, depending on what the opening wave rolled.
- **The curve doesn't climb.**
  - Idle T3 (17–19 s) was easier than idle T1 and T2, because the player passively gains 3–5 levels per tier.
  - Idle fights stay between 77 and 98 s from T4 to T8, apart from a 205 s spike at T7, and never fail.
  - Active fights only start lengthening at T7–T8 (11–17 s).
- **Danger is all at the start.** Elites plus a Warden stack bleed ×3 and void ×3 on the tank within seconds, before the player has done anything meaningful. After that there's no stake to lose.
- **Rewards arrive in a firehose:** a level-up about every 20 s, deeds, uniques and seven currencies. They come faster than you can spend them, so they read as noise.

## Do your actions feel impactful?

**Measurably yes; emotionally rarely.**

- **What lands.**
  - Amping a carry shows "(+442)" next to their DPS. That's the best moment-to-moment feedback in the game.
  - **Ult** is the peak: it revives and dual-tethers everyone, the ring grows to 20.7 m, IMMUNE tags appear, and "SURGING ×3" stacks with a Cascade (★ [active_s101_e1_decree_SINGLE_THREAD](screenshots/playtest/active_s101_e1_decree_SINGLE_THREAD.jpg)).
  - **Cleanse revives any downed hero in its radius** ("★ REVIVED! ★"). That's a lovely clutch beat the primer never mentions.
- **What doesn't.**
  - Sigil is a floor hexagon with no visible payoff.
  - Dash has nothing to dodge until T5+, and even then death is free.
  - Cascade's feedback is floor text.
- **Saves don't feel like saves.** Idle wins anyway. In idle T1 on seed 101, Lyra and Vexis lay dead the whole fight while the ult sat at 100% (★ [idle_s101_e1_decree_SINGLE_THREAD](screenshots/playtest/idle_s101_e1_decree_SINGLE_THREAD.jpg)).
- **The grade is noisy.** It uses the attribution at the instant the boss dies, so near-identical active clears scored A, B and C.

## The 10 biggest problems (ranked by how much they hurt fun)

1. **The player doesn't decide the outcome.** Idle clears T1–T8 under every stance and the auto-move toggle. Downs self-resolve, the Weaver auto-respawns, and there's no loss state. Input changes only speed and a letter grade.
2. **The first session plays itself.** The sim runs behind the primer, so new players return to a finished report card or to a dead party mid-boss.
3. **Encounters are too short and front-loaded for decisions.**
   - Expeditions take about 17 s and boss fights 4–17 s.
   - Bosses die before their Decrees appear.
   - The tank often drops in the opening wave before the player can react.
4. **Threats are hard to read.**
   - Heroes and enemies share one visual vocabulary.
   - Enemy types are indistinguishable, and the Warden can't be identified.
   - Telegraphs drown among 8 or more ring types in near-identical reds.
   - Enemies have no HP bars.
5. **The HUD hides critical information.**
   - The banner covers the Decree text, toasts cover the banner, and loot labels cover nameplates and callouts.
   - The always-on currency strip sits permanently *under* the party frames (I checked with bounding boxes).
   - The controls box overlaps the loot-vacuum button.
   - Key callouts are painted into the floor.
6. **Meta overload from minute one.**
   - Six progression panels, plus Settings and a Codex.
   - The Conduit Matrix alone is **871 words, 183 numbers and 89 buttons** in a panel that scrolls to 1,764 px (★ [panels_fresh_conduit](screenshots/playtest/panels_fresh_conduit.jpg)).
   - Full PoE crafting with seven currency actions on item-level-1 gear.
   - A class choice is offered at minute 0.
   - The Astrolabe has 63 nodes with about 6 px labels that overlap each other and the toolbar.
   - Sidebar names are truncated and don't match the HUD or primer (Conduit Matrix vs "Auras & Links", Legacy vs "Deeds & Perks", Codex vs "How to Play").
7. **Progression outpaces play.**
   - 14 unspent points after a minute.
   - Loot is never auto-equipped or prompted.
   - Report chips over-promise. "+1 Ascendancy Point" was shown after T1, T2 and T3, but the save had only the starter point plus T2's.
   - "Spend Ascendancy Point" opens the class screen. Choosing a class still leaves the point unallocated, and you're silently sent back to T1 instead of descending.
   - The active waystone isn't saved and resets to T1 on reload.
8. **The active kit is thin.**
   - Auras and a one-time "amp a carry" setup do the work.
   - The beam/cleanse loop is rarely needed after T1.
   - Dash and Sigil lack a purpose.
   - The real support decisions (Decrees) get skipped.
9. **You can't direct the heroes, and they behave badly.**
   - Three coarse stances are the only control.
   - Heroes pile on top of each other.
   - DPS heroes stay dead unless you walk onto the body, and nothing says so.
10. **Numbers and words you can't trust.**
    - Stale DPS on dead heroes, and a lingering banner.
    - A single-instant grade.
    - A wall-clock "Run Duration" (216 s shown for a 104 game-second run).
    - The Codex says the Astrolabe has 50 nodes and 9 keystones, while the tree says 63 and 10.
    - The Codex promises attribution "from 35% to 90%+", against 3–9% idle and 20–56% active.
    - The help names other games ("Overwatch-style", "Path-of-Exile … Twist").

## Genuinely fun or promising

- **The fantasy is legible.** "% FROM YOU" plus per-hero "(+N)" boost numbers make support visible. Keep that, and make it decisive.
- **Ult and cleanse-as-revive** are real "I saved them" beats. The Ult's spectacle (ring bloom, dual tethers, IMMUNE, SURGING stacks) is the best-looking moment in the game.
- **Decrees are exactly the right idea**: hold the beam on the MARKED hero, keep everyone in the ring, survive the Spirit Void. Only a support can answer these boss demands. They need to come early, be readable, and carry real consequences.
- **Hero Bond talents** at ranks 3 and 6 change hero behaviour (Kael taunts enemies off the carries, Lyra's bolts chain). That's a strong hook for tying support choices to hero identity.
- **The raid frames** are well designed and worth keeping almost as-is.
- **Presentation:** a clean stylised look, a polished panel and report-card UI, and synthesized audio with sensible settings.
- **Determinism:** seeding `Math.random` alone made runs reproducible. That makes seeded dailies, replays and balance bots cheap in a remake. My bot is a ready-made regression test for "does the player matter?"

## Performance, frame-rate dependence and tech notes

- **Per frame** (one 50 ms step, 1600×900): the whole game step costs **5.5 ms**, of which 1.9 ms is simulation and 3.6 ms is three.js scene submission, with about 90 draw calls. Frames take about 300 ms, but the main thread is only 27–33% busy, so this box is GPU-bound in SwiftShader. Absolute FPS isn't representative.
- **React is the hotspot.** The 3D loop pushes five HUD state slices about 12 times per game-second, and every floating number adds two more updates. Each push re-renders the whole 2,300-line App tree.
  - I measured **10–15 commits per game-second at 43–58 ms each (dev build)**. That's about 9× a full simulation-plus-render frame, or 0.6–0.7 s of main-thread time per game-second.
  - Production will be cheaper, but the architecture is the problem.
- **Frame-rate dependence:**
  - Below 20 FPS the 50 ms clamp slows the whole game rather than skipping. Wall-clock timers (popups, toasts, report duration) then disagree with game time.
  - Above 20 FPS there's **no reliable dependence**. Across 7 seeds, idle T1 fights in 16.7 ms vs 50 ms steps had medians of 67 vs 56 s, with similar downs (13 vs 12) and equal mean dead-hero time. That difference is well inside the seed spread. DoT, healing, movement and attack cooldowns are dt-scaled.
- **Console:** no errors. The only warning, once per load, is three.js' "PCFSoftShadowMap has been removed". In the dev build, StrictMode doubles the level-up toast, feed line and sound, because they fire inside a state updater ([idleFocus_s101_e1_first_down](screenshots/playtest/idleFocus_s101_e1_first_down.jpg)). That's probably dev-only.
- **Other glitches:**
  - The "Performance" render setting can't go below pixel ratio 1, so it does nothing on standard displays.
  - The unselected "Ascendancy Specialization" sub-tab turns nearly invisible.

## Screenshot index

- ★ [tutorial_after_close](screenshots/playtest/tutorial_after_close.jpg) — first expedition already cleared while reading the primer.
- ★ [panels_fresh_hud](screenshots/playtest/panels_fresh_hud.jpg) — the first seconds: banner, CLEANSE tags, grey cones, HUD density.
- ★ [idle_s101_e1_boss_spawn](screenshots/playtest/idle_s101_e1_boss_spawn.jpg) — boss arrives with all three heroes down; ring soup.
- ★ [idle_s101_e1_decree_SINGLE_THREAD](screenshots/playtest/idle_s101_e1_decree_SINGLE_THREAD.jpg) — idle boss fight: everyone down, ult at 100% unused, still wins.
- ★ [idleLong_s101_e5_decree_SPIRIT_VOID](screenshots/playtest/idleLong_s101_e5_decree_SPIRIT_VOID.jpg) — T5: banner hides the Decree, 28 loot drops bury nameplates, +21 unspent points.
- ★ [active_s101_e1_decree_SINGLE_THREAD](screenshots/playtest/active_s101_e1_decree_SINGLE_THREAD.jpg) — Ult + Cascade: the game at its best.
- ★ [panels_fresh_conduit](screenshots/playtest/panels_fresh_conduit.jpg) — meta overload.
- ★ [panels_progressed_reliquary](screenshots/playtest/panels_progressed_reliquary.jpg) — unequipped uniques and unspent points after about a minute.
- Primer cards:
  - [tutorial_step1](screenshots/playtest/tutorial_step1.jpg)
  - [tutorial_step2](screenshots/playtest/tutorial_step2.jpg)
  - [tutorial_step3](screenshots/playtest/tutorial_step3.jpg)
  - [tutorial_step4](screenshots/playtest/tutorial_step4.jpg)
  - [tutorial_step5](screenshots/playtest/tutorial_step5.jpg)
  - [tutorial_step6](screenshots/playtest/tutorial_step6.jpg)
- Report cards:
  - [active_s101_e1_report](screenshots/playtest/active_s101_e1_report.jpg) (A)
  - [idle_s101_e1_report](screenshots/playtest/idle_s101_e1_report.jpg) (C)
- Spend-Ascendancy path:
  - [activeAsc_s404_after_ascend_choice](screenshots/playtest/activeAsc_s404_after_ascend_choice.jpg)
  - [activeAsc_s404_after_close_back_in_arena](screenshots/playtest/activeAsc_s404_after_close_back_in_arena.jpg)
- Fresh-save panels:
  - [panels_fresh_conduit_scrolled](screenshots/playtest/panels_fresh_conduit_scrolled.jpg)
  - [panels_fresh_astrolabe](screenshots/playtest/panels_fresh_astrolabe.jpg)
  - [panels_fresh_reliquary](screenshots/playtest/panels_fresh_reliquary.jpg)
  - [panels_fresh_atlas](screenshots/playtest/panels_fresh_atlas.jpg)
  - [panels_fresh_ascend](screenshots/playtest/panels_fresh_ascend.jpg)
  - [panels_fresh_legacy](screenshots/playtest/panels_fresh_legacy.jpg)
  - [panels_fresh_settings](screenshots/playtest/panels_fresh_settings.jpg)
  - [panels_fresh_help](screenshots/playtest/panels_fresh_help.jpg)
- Level-10 save panels:
  - [panels_progressed_hud](screenshots/playtest/panels_progressed_hud.jpg)
  - [panels_progressed_astrolabe](screenshots/playtest/panels_progressed_astrolabe.jpg)
  - [panels_progressed_ascend_bonds](screenshots/playtest/panels_progressed_ascend_bonds.jpg)
  - [panels_progressed_atlas](screenshots/playtest/panels_progressed_atlas.jpg)

The harness (`run.js`, `lib.js`) and per-run logs (`logs/*_summary.json`, `logs/*.jsonl`) were working files of the planning session and are not bundled with this plan.

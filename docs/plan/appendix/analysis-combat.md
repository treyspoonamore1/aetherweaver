> **Appendix — raw analysis report** produced while planning the remake. Line references point into the original game's source (`src/…`). It is kept verbatim as evidence; the conclusions are synthesised in [../01-findings.md](../01-findings.md).

# Combat slice: how AETHERWEAVER fights today

This report covers `src/components/Arena3D.tsx` (read in full), plus the parts of `statsEngine.ts` (`SE:`), `data.ts` (`D:`), `types.ts` and `App.tsx` (`App:`) that combat uses. A bare line number means a line in Arena3D.tsx. Numbers assume player level 1 (L1), tier 1 (T1) and no gear.

## Headline findings
1. **You cannot lose.** When the player dies, they respawn at 75% (2926-2939). When all three heroes are down, enemies freeze (2765-2778). Only a boss kill ends a run.
2. **Ailments do most of the damage.** They are %max-HP damage-over-time ticks that ignore damage reduction and overshield (2427). One bleed proc deals 27% of max HP. A Soulbinder holds 25.5% max HP/s of Void Rot, 3.6× the T1 heal beam on Kael. The defensive auras only reduce hits.
3. **Two of four decrees ignore the player**, verified by simulating at 30, 60 and 144 fps. Spirit Void always passes and Shatter Halo always fails. Convergence passes itself in the default stance.
4. **The ultimate refills itself.** Ult charge accrues during the ult, and its radius and heal bonuses are applied twice.
5. **Position barely matters.** Nothing targets the player, and the tether, Chime and Sigil are unlimited-range.
6. **The simulation can't be tested.** It is a 2,900-line `useEffect` closure that rebuilds geometry every frame, leaks meshes and re-renders the App at about 11 Hz.

## 1. How combat works

**Loop.** The game steps once per `requestAnimationFrame` with a variable timestep. `dt` is clamped to 0.001–0.05 s (1919), so below 20 fps the game runs in slow motion. Pausing stops the simulation but rendering continues (1937).

Each frame runs these steps in order:
1. Decrees.
2. Cooldowns and regeneration.
3. Movement and the loot vacuum.
4. Sigils.
5. Tether.
6. Heroes.
7. Enemies.
8. Telegraph detonations.
9. Projectiles (damage is applied when they arrive).
10. Spawns.
11. Render.
12. HUD sync, at most every 85 ms (3005).

### Player kit
| Input | Cost / cooldown | Effect |
|---|---|---|
| WASD | — | Move at 6.8 u/s (SE:506). |
| Space: Dash | free / 3.2 s | 0.24 s at 24 u/s (≈5.8 u) toward the cursor (1490-1510). Gives i-frames only if a slam detonates mid-dash (2910). +3 resonance. |
| E: Chime | 18 Spirit / 8.5 s | A bell flies to the cursor (0.24 s) and resolves in radius 5.8 (1512-1665). Heroes inside are cleansed, made immune for 1.15 s and healed for (140+22·L)·incomingHeal·(1+res/220). Overheal becomes overshield (+65). Dead heroes inside revive at 45%. It heals you and knocks back non-boss enemies. Counts as a "clutch save" (+12 ult) if the hero had an ailment or was below 32% HP. |
| F: Sigil | 22 Spirit / 9.5 s | Radius 5.4 for 7 s (1705-1736). Heroes inside regenerate 5.5% max HP/s and get +30% crit chance; enemies inside take ×1.25 damage. Gives +1 charge if it lands near enemies. |
| R: Ult | 100 charge (you start at 35) | Lasts 8 s (1738-1766). Revives everyone at +50% HP, cleanses everyone, fills overshield and grants 1.8 s immunity. While active, all 3 heroes get heal (×1.55) and amp at the same time, and aura radius is ×1.85. |
| X: Cascade | ≥1 charge / 6 s | Spends all n charges (840-887). Resets the Chime and Dash cooldowns, cuts the Sigil cooldown by 2.5n s, gives +7n ult charge and heals the party for 7n% of max HP. For 4+0.5n s, heal and amp are multiplied by ×(1+0.09n). |
| Q / right-click | — | Switch both beams between heal and amp. |
| 1/2/3 or click a hero | — | Retarget the tether (1871-1881). |

Spirit regenerates 16 + 6% of max per second (2116), about 28/s, while casting needs only about 4.4/s. Spirit therefore limits you only through how much of it your auras reserve. Below 8 unreserved Spirit you can never cast (1482).

### Tether
- **Range:** none; nothing checks the distance (2306).
- **Heal:** `(95+14(L−1)) × potency × incomingHeal × 0.72 if suppressed × cascadePower × 1.55 during ult` per second (2322-2329). A quarter of any overheal becomes overshield, capped at 65% of max HP. Healing your primary target also builds 11.2 resonance/s and ult charge equal to `heal/maxHp×18`.
- **Amp:** +42% more damage, +25% attack speed and +30% crit multiplier for the target (2527-2561).
- **Secondary beam:** comes from Triad Bond (0.6 potency), the chr_echo ascendancy node (0.45), or both (0.8). It picks its own target: the lowest HP% hero in heal mode, the highest-DPS hero in amp mode (2245-2255).
- **Target death:** if your target dies, the beam silently moves to the first living hero (2239-2243).

### Auras
- **One radius for everything.** All active auras share a single radius: the largest of their individual radii, 8.2 u at base (SE:222-228, 411-414). The separate ring drawn for each aura is purely decorative (457-473).
- **Radius modifiers:** ×1.85 during the ult, ×1.15 during a Cascade, ×0.58 near a Warden, ×0.6 during Shatter Halo (2177-2182).
- **Who is covered:** a hero counts as "in aura" if they are within that distance of the player (2391). Enemies are checked the same way for Malediction.
- **What the auras give** (SE:355-407): attack speed, crit, regen, incoming healing, DR (×0.75, capped at 78), flat damage, a "more damage" multiplier, overshield per second and move speed.
- **Elemental resistance** only affects ailments.

### Heroes
- **Stats:** Kael 1350 HP / 78 DPS / 2.9 range; Lyra 780 / 122 / 10.5; Vexis 720 / 135 / 9.8 (608-610). They gain +14% HP and +12% DPS per player level.
- **No abilities.** Each hero just attacks 1.15 times a second.
- **Targeting:** the nearest enemy. Under "Focus Boss", the boss first, then elites.
- **Stances:** "Stay in Aura" is the default (App:357). It leashes heroes to within 0.78× your aura radius, about 6.4 u; otherwise they chase. Ranged heroes back off from enemies closer than 3.6 u (2480-2502).
- **Death:** at 0 HP, unless Undying (22 s cooldown) or Caduceus during the ult saves them (2437-2455).
- **Revive:** stand within 3.8 u of a downed hero for 2.4 s and they come back at 50% (2291-2300). The Chime and the ult also revive.

### Enemies
HP scales ×1.33^(T−1) and damage ×1.24^(T−1), before map mods (1233-1243).

| Name | Share | HP / damage | Speed / range | Behaviour |
|---|---|---|---|---|
| Void Stalker | 50% of normals | 340/26 | 4.2/2.1 | Melee every 1.55 s, 18% chance to bleed. |
| Crimson Lancer | 30% | 340/26 | 2.8/9 | Same, but instant and invisible from 9 u away. |
| Soulbinder | 20% | 430/26 | 2.8/9 | Every hit applies Void Rot. A siphon line drains 0.22×damage/s within 11 u (2803-2821). |
| Choir-Slayer (elite) | 45% of elites | 1150/56 | 4.2/2.1 | Slams every 7 s: radius 3.6, 1.7× damage, bleed. |
| Dissonant Warden (elite) | 55% of elites | same | same | Same, plus an 11 u suppression field. |
| Boss (5 names) | at 100 wave progress | 5400/135 | 3.1/3.6 | Melee every 1.35 s. Slams every 4.4 s: radius 5.2, 2.3× damage, Void Rot. Issues decrees. |

- **Slams:** 35% aim at the player's position, the rest at the enemy's current target. Each is telegraphed for 1.65 s, and the player takes 55% of its damage (1395-1430, 2823-2840).
- **Targeting:** enemies go for the living hero with the lowest distance score, where Kael's distance counts ×0.52 (×0.18 with his taunt talent) (2765-2776).
- **The player is never targeted.**
- **Movement:** enemies don't push each other apart, so they stack in one spot.
- **Text-only affixes:** "Hasted", "Sanguine", "Corrupting Nova" and "Soul Siphon" do nothing (1350-1351).

### Waves and pacing
- **Opening wave:** 5 normal enemies and 1 elite.
- **Spawning:** every 2.1 s, 1–2 more spawn (20% elites) as long as there are fewer than 10, or 7 while the boss is up (2973-2985).
- **Boss trigger:** kills add +9 (normal) or +24 (elite) to wave progress, and the boss appears at 100 (2737). That takes about 11 normal kills, fewer with elites.
- **Skipping:** the "Summon" button skips the wave entirely (App:1300).
- **Boss kill:** it drops loot, then App shows the report screen and pauses.

### Dissonant Warden
- **Trigger:** any Warden within 11 u of the **player** suppresses the aura (1971-1977). The Shatterproof Halo keystone prevents this.
- **Effect:** aura radius ×0.58 and beam healing ×0.72. Regen and the Chime are unaffected.
- **Reward:** killing a Warden gives +1 charge and +9 resonance (2707).
- **Contradiction:** the on-screen banner says "Focus the Dissonant Warden!" (App:1358), but there is no way to order a focus.

### Decrees (2003-2104)
Decrees only happen while the boss is alive: the first at 11 s, then one every 13–22 s.

| Decree | What it asks | What the code does |
|---|---|---|
| Convergence (10 s) | Keep every hero within 1.05× the aura radius for 6 s. Heroes outside burn 5%/s. | Checks the unsuppressed `b.auraRadius`, not the ring drawn on screen. The default stance's leash satisfies it automatically. |
| Single Thread (9 s) | Keep the beam on the marked hero for 5.5 s, or they burn 7.5%/s. | The only real test. If the marked hero is dead, progress goes up +30/s. A secondary beam in heal mode solves it on its own. |
| Spirit Void (8 s) | "Cast from Ward & Charges" | No such code path exists. Costs are ×1.6, regen stops and you lose 4 Spirit/s. Progress depends only on time, so it **always passes**. |
| Shatter Halo (12 s) | "Slay the summoned Wardens" | It summons 2 random elites, and 45% of them aren't Wardens. Kills don't count, and progress tops out at 90%, so it **always fails**. |

- **Answered:** +30 ult, +2 charges, and the boss loses 7% of its max HP.
- **Failed:** heroes lose 22% of max HP and the player loses 20%, never dropping below 1 HP (903-929).

### Ailments
- **Stacking:** each hit adds a stack (up to 3) and resets the duration to 4.5 s (2876-2884).
- **Damage:** bleed deals 6% of max HP per second per stack, Void Rot 8.5%. Inside the aura, both damage and duration are multiplied by `max(0.35, 1−elemRes/140)` (2421-2431).
- **Only immunity stops it.**
- **Freeze** exists in the code but nothing ever inflicts it (2425).
- **Death doesn't clear ailments.**

### Resonance, Aether Charges, Cascade
- **Resonance:**
  - Caps at 60, plus 10/22/40 from the chorus tiers (SE:500).
  - Gains: 3 per Dash, 6 per Chime (13.2 if "heroic"), 9.6 per Sigil, 15 per ult, 11.2/s while healing your primary target, 3.3 per amp crit, 9 per Warden kill, and 18 per decree.
  - Starts decaying after 4.6 s without gains.
  - When it hits the cap, it resets to 15% and banks an Aether Charge (1986-2001).
- **Cascade power:** `cascadePower = (1+0.09n while Cascade is active) × (1+res/260)` multiplies both healing and the amp vulnerability bonus (819).
- **High-resonance damage:** above 40 resonance, heroes inside the aura deal ×(1+res/400) damage (2575).
- **Aether Charges:** sources are resonance peaks, heroic Chimes, Sigils that land near enemies, the ult (+2), Warden kills and decrees (+2).

### Formulas
- **Hero hit** (2543-2579): `(baseDps/1.15 + flat) × auraMore × (1+amp%) × crit × vuln`, where:
  - attack speed is `max(0.6, 1.15×(1+AS%))`;
  - crit chance is 0.1 + aura bonus + 0.3 inside a Sigil;
  - crit multiplier is 1.65, +0.30 when amped, + talents;
  - `vuln` = Malediction × Sigil 1.25 × cascadePower (only when amped) × the resonance bonus.
- **Mitigation** (2852-2874), applied in this order:
  1. Immunity negates the hit entirely.
  2. Otherwise damage is reduced by `min(85, auraDR + talentDR)` percent.
  3. The Martyr keystone redirects part of the damage, and your ward pays half of that part.
  4. Overshield absorbs what remains.
  5. Anything left comes off HP.
- **The player:** only slams can hit the player. Ward absorbs first, but Void Rot gets through half of it. Ward recharges at 22%/s and life at 3%/s.

### Support attribution %
- **Per hit:** the support share is `max(0, finalHit − baseDps/1.15 × (crit ? 1.65 : 1))` (2580).
- **Rolling window:** shares are summed over the last 2.5 s for each hero (2627-2691).
- **Grade:** the attribution % at the moment the boss dies, plus `9·saves + 3·cleanses + 5·tier` (App:655-661).
- **Biases:** attack-speed buffs are never credited, and crits are compared against a crit baseline. Talent crit multipliers and talent chain bolts count as yours, the chains at 100% (2677).

### Loot
- **Drop chance:** normal enemies 22%, elites 78% (1070).
- **Boss:** drops one guaranteed rare/unique, one more boss roll, 2 elite rolls, a Vaal Tear and 2 Astral shards (2729-2733).
- **Uniques:** an item is unique when `U×(1+rarity%/150) > 0.98` (1025). That is 2% of drops at T1, 36% at T5 and about 73% at T10 with mods.
- **Pickup:** loot within 4.5 u is vacuumed up, and **C picks up everything on the floor** (App:527).

**Fail state:** there isn't one. A player death costs 20 ult charge, nothing more.

## 2. Rendering and feel
- **Models and lighting.**
  - Everything is a primitive mesh with its own material. Nothing is instanced, there are no imported models, and nothing is animated.
  - Lighting is an ambient light, one directional light with soft (PCF) shadows, a rim light and a point light on the player.
  - There is no bloom and no tone mapping, so emissive glow looks flat.
- **The three normal enemy types are the same grey cone** (1253-1271). Enemies have no HP bars.
- **Ground markings are the strongest visual language:**
  - the aura ring at its true radius, which turns violet when suppressed;
  - rings under heroes standing in the aura;
  - red rings under enemies affected by Malediction;
  - telegraphs that fill up before they detonate;
  - the Warden's 11 u ring;
  - loot pillars.
- **The tether** is a curved tube with beads travelling along it, coloured green for heal, blue for amp and gold during the ult. It is rebuilt every frame.
- **Damage numbers** are DOM elements placed on screen when they spawn, so they drift as the camera moves.
  - Only amped hits show numbers (2633-2646).
  - Heal numbers show the nominal amount, not what was actually healed (2358).
  - Damage taken and kills show nothing.
  - "IMMUNE!" floods the screen (2848).
- **Nameplates** update about 11 times a second through `left`/`top`. Their `transition-transform` class does nothing, so they jump in steps (3183).
- **Camera.** A 44° perspective that follows 65% of the player's offset and zooms between 15 and 35.
- **No impact feedback.** There is no screen shake, hit-stop, hit flash, hit reaction or death animation; dead enemies simply vanish.
- **Audio is the best feedback.**
  - The heal tick rises in pitch with the target's HP (340→780 Hz).
  - Amp hits tick, with a separate crit variant.
  - Chords play on saves.
  - Decrees reuse the ult sound (2046).
  - There is no sound when a hero is hit, goes down, or when a slam starts.
- **Good play is celebrated; damage isn't explained.** Doing well gets big popups like CLUTCH SAVE or DECREE ANSWERED. But nothing ties damage to where it came from: Lancer hits are invisible, and Void Rot has no visible source.

## 3. Architecture and performance
- **Structure.**
  - The whole game is one `useEffect(…, [])` closure (239-3171).
  - State lives in local variables and Three.js objects. For example, `playerGroup.position` is the player's actual position.
  - Logic and meshes are tangled together: damage is computed when an attack fires and captured inside the projectile's arrival callback (2600-2649).
- **React ↔ loop.**
  - Props reach the loop through refs that are reassigned on every render (209-226).
  - About every 85 ms, `onHudUpdate` sends newly allocated copies of the hero data (3054-3150). App responds with 4 `setState` calls, re-rendering the entire App at roughly 10–12 Hz.
  - Arena3D adds two `setState` calls of its own on the same tick, plus a `setState` and a `setTimeout` for every popup (998-1001).
  - App's build memo depends on `ultActiveRemaining` (App:480), so `computeSupportBuild` re-runs about 10 times a second during the ult.
- **Hot-loop allocations.**
  - Every visible beam creates a new curve and a new 207-vertex `TubeGeometry` each frame, then disposes it. That is a GPU buffer upload per beam per frame, and it grows with refresh rate (695-701).
  - Each frame also allocates a Vector3 per beam target, runs a `damageWindow.filter` per hero, and creates 4 Vector3s per Soulbinder.
  - Every attack creates a new sphere geometry and material (2589).
- **Leaks.**
  - Projectiles and shockwaves free their geometry but never their material (2950, 2965).
  - Enemies, telegraphs, loot, sigils, aura rings and siphon lines are removed from the scene but never disposed (2705, 2895, 1204, 2232, 439-445).
  - In three.js 0.186, `WebGLBindingStates` keeps vertex-array state, keyed by `geometry.id`, until `dispose()` is called (WebGLBindingStates.js:74-79, 194-218). So memory grows with every kill and is never reclaimed.
- **Frame-rate dependence.**
  - The dt clamp means slow motion below 20 fps.
  - Attack cooldowns reset to `1/aps` and lose the leftover time, so up to one frame is lost per attack (2540, 2791).
  - The camera lerp is applied per frame.
  - Popups expire on wall-clock time.
  - Keys stay stuck after alt-tab because there is no blur handler.
- **Testability: none.**
  - There is no pure `step(state, input, dt)` function.
  - `Math.random` is unseeded.
  - The renderer and DOM share scope with the logic.
  - A remake needs a deterministic, seeded, fixed-step simulation, with rendering as a read-only view of it.

## 4. Design critique
**Where skill matters**
- **Aiming and timing the Chime is the real game.** It is the only answer to ailments, it revives instantly, and its immunity can be timed to absorb a slam.
- **E→X→E (Chime, Cascade, Chime) is the only combo.**
- **Single Thread is the only real decree.**
- **Stepping out of slams aimed at your feet.**
- **Heal versus amp is weaker than it looks.** Healing an injured primary target earns 11.2 resonance/s, while amp earns about 0.5–2.5/s from crits. So "heal the tank forever" is economically correct.

**Where the game plays itself**
- The heroes target and position themselves, and the leash keeps them in your aura.
- The secondary beam picks its own target.
- Pulses, regen and overshield are passive.
- Optional auto-move (off by default) walks you to the party's centre and dodges slams for you (2143-2166).
- C vacuums up all the loot, and Summon skips the waves.
- Going AFK never loses the run; it just stalls.

**Triage pressure**
- **The cluster removes the choice.** The leash keeps every hero within 6.4 u of you, and a Chime cast at your feet covers 5.8 u. It usually catches everyone, and it counts as "heroic". "Who do I save?" becomes "press E on yourself".
- **Deaths are cheap.** The Chime and ult revive instantly, and there is no fail state, so the pressure is cosmetic.
- **Spirit never constrains you.**

**Readability and counterplay**
- **Slams are readable, but heroes never dodge them.** Since you can cleanse after the hit, timing the immunity rarely pays off.
- **The siphon tether's advertised answer doesn't work.** The game says "break it with [E]" (App:2280), but that does nothing. The real threat is Void Rot from hits you can't see.
- **The Warden is readable**, but you can't order the party to focus it.

**The damage model undercuts the build choices.**
- A Stalker hitting Kael procs bleed 0.116 times/s, worth 364 HP each. That is about 2.5× its hit DPS, and it ignores DR and overshield. Add a Soulbinder's 344 HP/s on top, against a 95 HP/s beam.
- That makes Purity and the Chime mandatory.
- Meanwhile Grace, Discipline, Martyr and Undying only reduce the minor channel (direct hits), so most defensive build choices don't matter.

**The economy collapses to rote**
- Any Chime that includes yourself counts as "heroic" and banks a charge (1521-1525).
- Any Sigil near a pack pays a charge.
- Cascade dumps every charge, and charges have no other use, so the right play is always "press X at 3".
- Dash gives resonance for nothing.
- Amp hits feed 1.2–2.6 ult charge each for all three heroes during the ult. My estimate is that an 8 s ult refunds about 45–100 charge, pushing Transcendence toward permanent uptime.

**Keep (fixed)**
- The aura ring as a visible positional contract, with clear per-hero in-aura indicators.
- The Mercy-style beam with pitch-coded heal audio.
- An aimed, travel-time Chime that does several jobs.
- Enemies that specifically threaten a support, like the Warden and the siphon, made answerable.
- Checks shaped like Single Thread.
- A corrected attribution meter.
- Loot pillars.

**Cut or rework**
- Aether Charges as a third meter on top of Resonance.
- Spirit as a casting cost.
- Resonance from Dash.
- Passive chorus procs.
- Affixes that do nothing.
- The decorative per-aura rings.
- Auto-move and the Summon skip.
- Life and ward pools for a player nothing attacks.
- Identical heroes with no abilities. They need moments worth amplifying, such as "amp Vexis before her nova".

## 5. Bugs and logic errors
1. 2085-2087, 2053-2056: Shatter Halo's progress tops out at 90, so it always fails. It summons random elites (45% aren't Wardens), and killing them doesn't count.
2. 2085-2090: Spirit Void depends only on time, so it always passes. The "cast from Ward & Charges" text (2030) has no matching code (1465-1488).
3. 2101-2103: if the boss dies during a decree, `endDecree(true)` runs and pays the reward for free.
4. 2082-2084: Single Thread completes faster (+30/s) if the marked hero is dead.
5. 2063, 2069: Convergence checks `b.auraRadius` instead of the radius on screen, so it ignores Warden and ult modifiers.
6. 1581-1586 vs 2807-2816: the Chime only hides the siphon tether. It reappears the next frame and keeps draining.
7. 2239-2243 vs 2291: reviving through the tether never works, because a dead primary is replaced immediately. The only exception is Kael when all three heroes are down.
8. 1521-1525: any Chime that includes the player counts as "heroic", giving +1 charge and 2.2× resonance.
9. 2179/2328 + SE:228,435 + App:468: the ult's radius and heal bonuses are applied twice. The radius becomes ×4.1 (about 33 u, larger than the 22.5 u arena) and healing ×2.7.
10. 2349, 2636, 864, 1565: ult charge builds during the ult, so it can be recast the moment it ends.
11. App:480: the whole build is recomputed about 10 times a second throughout the ult.
12. App:1977-1980 + 986: "Descend" calls `setWaystone` and then `resetRunStats` straight away, so the opening pack is spawned from the stale `waystoneRef` (the previous tier).
13. 2916-2924: the Void branch puts only 50% of the damage on life, even when ward is 0. Non-Void slams also fall into that branch at 0 ward. So an empty ward halves the damage you take, and at low ward Void slams hurt less than bleed slams.
14. 2858-2865: Martyr redirect only requires ward > 5, but it removes the full redirected share even when the ward can't pay for it.
15. 2450-2454, 1529-1538, 2293-2299: ailments survive death, and reviving doesn't clear them, so heroes die again as soon as their immunity ends.
16. 2375-2378 vs 2687: dead heroes' DPS windows never expire, leaving stale DPS in the party total and the attribution %.
17. 2580, 2677, 2358: attribution and heal popups are miscalculated. Attack speed is never credited, crits use a crit baseline, talent chains count at 100%, and heal popups show nominal values.
18. 1350-1351, D:1921, D:1927: four enemy affixes have no mechanics. Frenzied promises faster attacks (it only speeds movement), and Corrupted Blood promises Void Rot (it only raises bleed chance).
19. 2425: Freeze is never inflicted, so Alpha's Howl's freeze immunity does nothing.
20. 1955-1959: `maxOvershield` is only recomputed when max HP changes, so Overflowing Grace's 0.42 cap is ignored.
21. 1717-1718: Sigil potency is stored in globals, so every live sigil uses the most recent cast's values.
22. 2652, SE:536-561: `extraChain` is treated as a yes/no flag, so stacking chain sources does nothing. The "conditional" talents (Riposte, Hawkeye, Surge) apply all the time.
23. 2480-2502: at 0.78× the aura radius, the leash and chase logic flip every frame, so heroes jitter. Kael stands idle when the nearest enemy is ranged.
24. 1490-1787 + App:1816-1879: actions never check for pause, so hotbar buttons still work while manually paused.
25. 2974-2985: the spawn timer keeps counting while the enemy cap is full, so kills are replaced instantly and the cap can be exceeded.
26. 947-988: `resetRunStats` keeps sigils, cooldowns, ult charge and player pools, and disposes nothing.

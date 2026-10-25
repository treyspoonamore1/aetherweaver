> **Appendix — raw analysis report** produced while planning the remake. Line references point into the original game's source (`src/…`). It is kept verbatim as evidence; the conclusions are synthesised in [../01-findings.md](../01-findings.md).

# AETHERWEAVER: Build and Progression Systems Audit

Scope: `src/game/{data,statsEngine,ascendancy,types}.ts`, the seven progression UIs, and the grant/reward paths in `App.tsx`. Arena3D was read only to confirm what combat consumes. "Sim" numbers come from running the real `computeSupportBuild` (a transpiled copy) on test builds.

## Headline findings

1. **One scalar decides everything.** About 12 sources multiply a single per-aura `effectMultiplier` (statsEngine.ts:240-245, 294-312), and every aura stat scales linearly with it. The endgame multiplier is ×22–33. Every capped buff saturates at a multiplier of 2.7–5.2. After that, extra power only inflates uncapped stats: +500–1,280% attack speed and ×8–11 "more damage".
2. **Six auras and Sovereign Symphony arrive after the first boss.** That needs level 4, four tree points, the starter Enlighten rune ×3 and the four starting Astraloes.
3. **Low-life is a free ×2.18.** Player Life and Ward barely matter: only slams aimed at the player hurt, and death respawns you in place at 75% for −20 ult charge.
4. **Few options cost anything.** Gems socket into every relic, runes and sigils can be reused everywhere, and every respec except hero talents is free. Runs cannot fail.
5. **Progression floods, then ends.** About 10 runs reach L24 with 37/44 points and a maxed ascendancy. Everything is capped by about run 25. There is no prestige, and T11+ gives no new rewards.
6. **About 15 texts disagree with the code,** and one deed is impossible.

---

## 1. System inventory

### Auras (8) and support runes (6)
| Aura | Res. | Effects at ×1 |
|---|---|---|
| Zealotry | 35% | +22% AS, +18% crit |
| Vitality | 25% | 4.2%/s regen, +24% incoming heal |
| Grace | 35% | 20 DR (counted ×0.75) |
| Wrath | 50% | +42 flat/hit, +28% more damage |
| Purity | 30% | +32 res (only shortens ailments), 8 DR |
| Discipline | 35% | 36 overshield/s, +140 self-Ward |
| Haste | 40% | +24% move, +16% AS, 15% CDR (self ×0.65) |
| Malediction | 35% | enemies in ring take +26%, 22% slow |

| Rune | Res. × | More | Other |
|---|---|---|---|
| Enlighten | 0.78 | — | starter |
| Generosity | 1.00 | +36% | +15% radius; "no self-effect" only touches Discipline Ward and Haste self |
| Arrogance | 0.92 | +24% | cluster reserves Life |
| Magnify | 1.08 | +14% | +48% radius |
| Empower | 1.16 | +22% | +3 gem levels |
| Overflow | 1.06 | +15% | 18×m overshield per hit |

**Conduit rules.**
- **Clusters.** There are 3 fixed clusters, each with 2 aura and 2 rune slots, so 6 auras is the hard maximum (App.tsx:156-177).
- **Linking.** Runes apply to both auras in their cluster. Duplicates within a cluster are deduped (statsEngine.ts:159), but the same rune can be linked in all three clusters. An aura can occupy only one slot.
- **Costs.** Unlocking an aura costs 2 Astraloes, a rune 3, and a gem level 2 (App.tsx:2024-2045).
- **Gem XP.** Each active gem gains max(4, 0.45×XP) per kill, with a level curve of 120×1.28^(L−1) and a cap of 20 (App.tsx:579-584).

### Passive tree (Astrolabe)
There are 64 nodes: origin, 32 minor, 21 notable and 10 keystones. Every node is reachable. The player earns 44 points at most (29 from levels, 11 from the starter plus first clears of T1–10, 4 from deeds; App.tsx:499), which is 70% of the tree. Respec is free (App.tsx:2103-2106).

| Keystone (depth) | Effect / drawback |
|---|---|
| Sovereign Conductor (4) | +32 spirit eff, +25 inc effect / cleanse and sigil cost ×1.35 |
| Unbroken Chorus (7) | ×(1+7%·n) MORE, max 1.42 / −20% tether heal |
| Prism Covenant (4) | low life: ×1.35 aura and tether heal |
| Eldritch Conduit (4) | actives cost Ward |
| Sanguine Font (7) | life eff ×1.5, spirit eff ×0.8 |
| Triad Bond (4) | 2nd beam at 60% (80% with Echo) |
| Overflowing Grace (7) | +25 points overheal→shield / max overshield 65%→42% of HP |
| Martyr's Aegis (4) | 25% of ally hit damage goes to your Ward at half value |
| Temporal Mastery (7) | ×1.25 tether, +15 tick and CDR / −18% radius |
| Shatterproof Halo (6) | immune to Warden suppression, +10 DR / +8% base cost |

### Items, uniques and sets
- **Slots and bases.** 6 slots with 3 cosmetic bases each.
- **Affixes.** 12 families (6 prefix, 6 suffix), each with 3 tiers, drawing from slot-restricted pools (data.ts:1116-1263). The circlet has only 2 suffixes.
- **Magic and rare.** Magic items roll 1 prefix and 1 suffix. Rares roll 3/4/5 affixes at 18/42/40%, capped at 3 prefixes and 3 suffixes.
- **Tier roll.** rand + 0.035·ilvl, with T1 above 0.88 and T2 above 0.45 (data.ts:1592).
- **Quality.** 0–20%, worth up to +10% on every affix (statsEngine.ts:110).
- **Sockets.** 1/2/3 by rarity, +1 at ilvl ≥ 6, maximum 4 (data.ts:1433). A socketed gem gives +4–5% MORE to that aura per copy, plus a minor passive.
- **Uniques (6).**
  - Prism Guardian: cluster II reserves Life, +30 eff.
  - Victario: all auras ×1.15.
  - Alpha's Howl: +2 gem levels.
  - Shavronne: +25% tick on low life.
  - Caduceus Prime: ×1.35 tether, allies can't die during ult.
  - Chayula: Ward +30% of Life.
  - There is no ring unique, so five can be worn at once.
- **Sets (4).** 4 slots each, with 2/3/4-piece bonuses (data.ts:1268-1317). Rares carry a set tag 42% of the time when ilvl ≥ 2.

### Currencies (6)
| Currency | Use | Sources (share of currency drops) |
|---|---|---|
| Transmute | Polish +1–2 quality | 16%; first clear +3 |
| Chaos | Reroll rare (1), Regal (1), Annul a chosen affix (2), Altar-forge (2), Juice map (1) | 14% normal / 2% elite; salvage |
| Exalted | Add an affix (55% T1) | **26%**; first clear +1 |
| Divine | Best-of-two value reroll | 16–18% |
| Astraloes | Unlocks and gem levels | 28%; 2 per boss; +1 per salvage; deeds (49) |
| Vaal | Corrupt | 10% of elite drops; 1 per boss |

Drop rates: normals 22%, elites 78%, of which 55% is currency (Arena3D.tsx:1070-1110).

**Corruption** (data.ts:1811-1882) locks crafting. Each band falls through to the next when it cannot apply:
- 9%: destroyed, refunds 3 Astraloes
- 20%: +1 socket
- 17%: lose an affix
- 18%: gain an affix
- 16%: item level +2–4
- 20%: blind reroll of values

### Ascendancies, bonds and talents, sigils
**Ascendancies** have 4 nodes each, taken in order.
- **Points:** a starter point plus first clears of T2, T4 and T6 (App.tsx:687-690). Switching is free (AscendancyModal.tsx:73).
- **Luminary:** +25 spirit eff and +14 effect, then chorus thresholds −1, then +45% radius and ×1.15 ally damage, then +5s ult.
- **Martyr:** +28 life eff, then ×1.3 on low life, then +20% redirect, then "Undying" (an ally at lethal damage survives at 1 HP, every 22s).
- **Chronomancer:** +32 CDR, then a 45% echo beam, then sigils slow and haste, then dash ×0.55.
- **Undocumented node effects:** starting resonance and charges, +1 charge cap, resonance decay, cascade +2s (statsEngine.ts:100-101, 496-503).

**Bonds** run from rank 1 to 10, needing 900×1.35^(r−1) per rank, 35,726 XP in total. Each rank gives +4% hero HP and damage. XP comes from healing and from the support share of every ally hit (Arena3D.tsx:2348, 2612). Talents are 1 of 2 at rank 3 and 1 of 2 at rank 6, and they are the only permanent choice in the game. types.ts:261 promises rank-9 talents; none exist.

**Sigils (6):** 4 actives × 2 slots, and one sigil can sit on all four abilities. Unlocks cost 2–4 Astraloes.
- Quicken: cooldown ×0.76.
- Multiplicity: +1 chime or sigil, potency ×0.86.
- Potency: ×1.32, cooldown ×1.12.
- Vast: radius ×1.55.
- Infuse: +1 charge on use.
- Eternal: ×1.1 effect, ×1.15 radius, ×0.88 cooldown.

### Maps, deeds, legacy, loadouts
- **Maps:**
  - Tiers: 10 named tiers, then endless (Arena3D.tsx:1233-1234). Enemy HP scales by 1.33^(T−1) and damage by 1.24^(T−1), so T10 is ×13.0 HP and ×6.9 damage.
  - Tier rewards: +20% rarity and +18% XP per tier, with XP further ×(1+0.25(T−1)).
  - Mods: savage, armored, frenzied, corrupted_blood and horde, each adding +35–50% rarity and +25–40% XP. Juicing costs 1 Chaos for 2–4 mods.
- **Deeds:** 20 deeds pay 49 Astraloes in total. Four also give a skill point: first boss, 6 auras, clear T5, clear T8.
- **Legacy and prestige:** cut (data.ts:2071-2093). The "Deeds & Perks" tab has no perks.
- **Loadouts:** 3 slots saving the tree, clusters, `auraGems` and sigils. Gear, ascendancy and talents are not saved.

### Key formulas (statsEngine.ts)
- **Reservation:** cost = base × Π rune multipliers × 1.08 with Shatterproof ÷ max(0.25, 1+eff/100) (210-211). Spirit eff is ×0.8 under Sanguine Font; Life eff is ×1.5 under Sanguine Font, +30 on the Prism Guardian cluster (199-204).
- **Fitting:** greedy, in cluster order, up to 100% Spirit and 94% Life (259-281).
- **Effect:** (1 + 0.06·(level + bonus levels − 1)) × (1 + inc%) × Π rune more × Victario × (1 + socket%) × 1.85 during ult (214-245). It is then multiplied by:
  - Prism ×1.35 and Blood Prism ×1.3, both on low life
  - Symphony ×1.35
  - Unbroken Chorus ×(1+min(42, 7n)%) (294-312)
- **Aggregation:** per-stat sums across auras.
  - DR counts at ×0.75 with a cap of 78 (366); resistance is capped at 85 and slow at 65.
  - More damage and vulnerability multiply across auras.
  - Pentad adds a flat +25 AS.
- **Low life:** unreserved Life ≤ 50%. It is static and never reads current HP (283-285).
- **Chorus:** tiers at 3/5/6 active auras, one fewer with Luminary.
- **Pools:** Life = (420+28(L−1)+flat)(1+%); Spirit = (200+10(L−1)+flat)(1+%); Ward = (110+12(L−1)+flat+140·m Discipline+30% Life with Chayula)(1+%), recharging 22%/s.
- **Tether:** heal = (95+14(L−1))(1+heal%) × tick × the multiplier stack; amp = 42%(1+amp%).
- **Cooldowns:** base ÷ (1+CDR), with floors of 2.4s, 0.55s and 3.0s.
- **Heroes:** HP ×(1+0.14(L−1)) and DPS ×(1+0.12(L−1)) by player level (Arena3D.tsx:1949-1950). Player level is the main source of hero power: ×4.5 DPS at L30, against +36% from bonds.

---

## 2. How the systems interlock

**Data flow.** Tree, ascendancy, affixes, quality, sockets and sets sum into 19 raw stats. Those, together with gem levels, runes, keystones and uniques, produce one multiplier per aura. That multiplier feeds the ally buffs, which apply inside the single largest aura radius.

**What combat consumes.**
- **Ally attacks:** AS (uncapped, Arena3D.tsx:2539), flat and more damage, crit chance (capped at 0.95), and tether crit multi only in amp mode.
- **Enemies:** Malediction vulnerability and slow inside the ring.
- **Mitigation:** DR plus talents (capped at 85, 2855) and overshield.
- **Resistance:** only shortens ailments (2423).
- **Player Ward and Life:** matter only for slams aimed at the player (2905-2940), Martyr redirect and Eldritch costs.
- **Spirit:** funds cleanse (18) and sigil (22) at a regen of 16 + 6% per second. The cast gate is `min(cost, max(8, unreserved))` (1482), so even 96% reservation can still cast.

**Computed or displayed but not consumed.**
- `allyDamageReductionFlat` (statsEngine.ts:102, 600) and `gemLevelBonusLegacy`.
- `maxSpiritPct`: nothing grants it.
- Per-aura `radius` (224-228): only the maximum is used (411-414).
- `itemLevel`: read only by generation and by Chaos/Regal tier odds. Combat never reads it.
- Dash potency and radius, and ult cooldown (Arena3D.tsx:1490-1510, 1738-1765).
- The `extraChain` count: only `>0` is tested (2652).
- Freeze: never applied, which kills Alpha's immunity and part of Purity's text.
- Kael's reflect.
- Pool sizes, which never interact with percentage-based reservation.

**What the player actually chooses.**
- Which 6 of 8 auras, and which second rune per cluster. Generosity takes slot 1 by default.
- Spirit versus Life routing, which is solved by "everything on Life".
- 3–4 keystones; the rest is filler.
- A swappable ascendancy.
- Sigils, which are a real choice.
- Talents, the only irreversible choice.
- Juice or not, which is always juice since runs cannot fail.

---

## 3. Critique

**Real decisions:**
- The aura and rune pairing puzzle per cluster.
- Keystone routing with 44 of 63 points.
- Sigil loadouts, which change verbs.
- Uniques versus sets. Uniques split the sets: Victario and Chayula make only a 2-piece Choir.

**False choices:**
- **Sockets.** Gems aren't consumed and one gem fits all six relics (data.ts:1796-1799), so the answer is always to fill every socket.
- **Unreserved Spirit**, which never binds.
- **Player defence**, because death costs only 20 ult charge.
- **Map risk.** Mods are pure upside since runs can't fail.
- **Respecs**, which are free.
- **Corrupting a finished item.** A 4-socket, 6-affix item rolls 9% destroyed, 37% lose an affix, 34% a dud and 20% a coin-flip, with no upside.

**Dominant picks:**
- **Low life.** Arrogance + Generosity on every cluster with Prism Covenant and Martyr gives effect ×33.0 against ×15.2 for the same tree on Spirit with Generosity + Enlighten. That is ×2.18, and Spirit sits 100% unreserved (sim).
- **Generosity** everywhere.
- **Unbroken Chorus:** ×1.42 for −20% tether heal. It multiplies, although the text says "increased" (data.ts:379 vs statsEngine.ts:307-312).
- **Sovereign Conductor:** +32 eff and +25 effect for 4 points; its drawback adds 6–8 Spirit to two casts.
- **Infuse on Dash.** Dash is free (Arena3D.tsx:1490-1510) and banks a charge every 1.7–3.2s (1507). Cascade has a 6s cooldown (858) and lasts 4 + 0.5 × stacks, so it is up almost permanently, with free cleanse resets and party heals.
- **Gear:** wear all five uniques. Victario's ×1.15 beats a +24% "increased" affix once total increased effect passes 60%.

**Dead or near-useless options:**
- **Ward and Life nodes.** Five East-arm nodes are pure Ward (e1, e2_down, e4_down, e5_down, e6), worth +395 flat Ward, +64% Ward and +63% recharge. Across the whole tree there is +1,080 flat Ward and +645 Life.
- **Eldritch Conduit**, which fixes a problem that doesn't exist.
- **Luminary's "Unending Chorus."** At 6 auras it adds only ×16.96 → ×17.63, because 6 auras already reach tier 3.
- **Hero DR talents** (Kael +18, Lyra +22), which mostly vanish under the 85 cap once Grace hits 78.
- **Lyra Volley and Vexis Nova chains**, which duplicate the Pentad chain.
- **Potency on Dash:** a pure +12% cooldown penalty.
- **Radius beyond the arena.** The arena radius is 22.5 (Arena3D.tsx:285), while endgame rings reach 21–31m. This also makes Temporal Mastery's drawback free.
- **Shatterproof Halo's +10 DR** once DR is capped.

**Redundancy:**
- About 11 sources feed the same multiplier.
- Two second-beam sources (Triad Bond, Chronomancer Echo).
- Two hero-power ladders. Player level gives ×4.5. Bonds give +36%, and late game they fill almost instantly because bond XP scales with the support-added share of damage.
- Two gem-levelling paths (XP and Astraloes).
- Three point types (Astrolabe, ascendancy, deed).
- Three salvage routes with different payouts (App.tsx:875-879, 891-897, 941-946).
- Sets, sockets and affixes all draw on the same 19 stats.

**Complexity without perceptible payoff.** Caps are reached at these multipliers: resistance ×2.66, slow ×2.95, DR (Grace + Purity) ×3.71, crit ×4.72. Cooldowns also hit their floors. The level-4 six-aura build already sits at ×1.93. Past the caps, extra effect only feeds AS, more damage and vulnerability. The sim endgame party has AS ×6–14, more ×8–11 and vulnerability ×7–10, against enemies with ×13 HP at T10, an excess of two to three orders of magnitude. The player perceives only two states: "bigger" and "capped".

**Pacing** (sim, about 16 kills plus a boss per run):
- **Points:** after T1 the player is L4 with 6 points and 6 auras. After T5, about 22 points; after T10, L24 and 37 points.
- **Late levels:** the last 7 points need about 15 juiced T10 runs. L29→30 alone costs 14,036 XP, out of 100,386 total.
- **Ascendancy:** maxed at T6.
- **Astraloes:** about 12 per first-clear run against 32 total for every unlock. Unlocks are done by about run 3; after that, Astraloes convert at 2 per gem level.
- **Uniques:** non-boss item drops are unique 2% at T1, 23% at T3, 36% at T5 and 56% at T10, or 54–70% juiced. Boss items are 45–83% unique. With only 6 uniques, the collection completes in about 5–10 runs.
- **Scarcity is inverted:** Exalted (26%) out-drops Chaos (14%).
- **Cap:** by about run 25 every bar is full.

**Endgame.**
- T11+ adds only HP and damage.
- Deeds complete incidentally.
- Crafting converges to near-perfect 6-affix items, because Annul is deterministic, Exalts are 55% T1 and Divines are best-of-two. After that, corruption is the only sink and it has no upside.

**UI for theorycrafting.**
- **Good:**
  - The stacked Spirit/Life bar with a low-life marker.
  - A per-aura ledger with cost, potency and block reasons.
  - Live buff totals.
  - Path preview and filters on the tree.
  - Roll percentages on affixes.
- **Bad:**
  - **No delta preview** for nodes or items.
  - **Item compare and Auto-equip** use a stat-blind score (bug 10).
  - **Hidden effects:** undocumented ascendancy effects, and Caduceus ×1.08 against bosses (Arena3D.tsx:2574).
  - **Readiness meter** is mostly `activeAuras×14` (ExpeditionAtlasModal.tsx:36-42). My ×22 build reads "Contested" at T10.
  - **Chorus cards** hard-code 3/5/6 and ignore Luminary (ConduitMatrixModal.tsx:226-244).
  - **Currency names:** three different ones for Astraloes.

---

## 4. What to carry into the remake

- **The cluster puzzle:** 2 auras + 2 supports, a legible reservation formula and dual pools. Make the pools matter, for example with flat costs, current-HP stakes or a Spirit that actually binds.
- **Chorus breakpoints with visible combat effects** (pulse, chain, nova).
- **Keystones framed as trade-offs.** Their drawbacks need teeth.
- **Sigils that modify the active verbs.** This is the most perceptible build layer.
- **Ascendancy identities:** aura-stacker, blood-martyr, tempo/dual-beam.
- **Hero Bonds earned by supporting a specific hero,** with talents that reshape that hero. This is the most on-theme idea in the game.
- **Gems in relics as a cross-layer link,** with an opportunity cost such as a gem living in one place only.
- **Deeds that grant passive points.**
- **Boss Decrees as support skill-checks.**
- **Corruption as a gamble,** but with real boons.
- **Tooling:** the ledger, totals, path preview and loadouts.

---

## 5. Bugs and balance errors

1. **"Gemcutter's Eye" is impossible.** It needs 8 filled sockets, but progress is the maximum on a single item (App.tsx:831), and items cap at 4 sockets (data.ts:1435, 1830).
2. **"Relic Hoarder" counts duplicates,** despite saying "distinct" (App.tsx:604, 1061; data.ts:2104).
3. **The boss report misstates rewards.** Every first clear claims "+1 Ascendancy Point, +1 Astrolabe Point" (App.tsx:663-671). Ascendancy points only come at T2/4/6 (688) and Astrolabe points only up to T10 (684). The replay list omits Transmute and Vaal (720 vs 700-706).
4. **Loading a loadout reverts gem levels, XP and unlocks** via `setAuraGems(lo.auraGems)` (App.tsx:2072), losing spent Astraloes. When all slots are full, Save always overwrites slot 1 (BuildLoadouts.tsx:40).
5. **"Salvage All Magic" destroys locked relics** (App.tsx:938-946), contrary to its tooltip (ReliquaryForgeModal.tsx:690).
6. **Overflow silently deletes the oldest relics, including locked ones and uniques:** `slice(0,40)` (App.tsx:602). The Altar caps at 60 (2120), so the next pickup deletes 21.
7. **Auto-equip unequips a locked item** by filtering locked items out of the best-pick (App.tsx:913-915).
8. **Exalted is consumed with no effect** when the chosen side has no eligible template, such as a circlet at 3 prefixes and 2 suffixes (ReliquaryForgeModal.tsx:586-590; data.ts:1743).
9. **No rarity guard on Exalt, Divine and Annul** (data.ts:1728, 1782, 1884). Magic items can reach 6 affixes and uniques can be exalted.
10. **`itemScore` ignores stats and tiers** (data.ts:1463-1478). A max-roll T3 +10% effect scores 134 against 64 for a min-roll T1 +17%, so Auto-equip (App.tsx:915) and the ▲/▼ compare pick the weaker item.
11. **The corruption item-level outcome does nothing** (data.ts:1862-1869). `itemLevel` only matters for crafting rolls, and corrupted items can't be crafted (ReliquaryForgeModal.tsx:542-549). Fall-through raises "lose affix" to 37% on 4-socket items (1830-1848).
12. **The ult is applied twice.** statsEngine applies ×2.2 radius, ×1.85 effect and ×1.75 heal (228, 245, 435; via App.tsx:468). Arena3D then applies ×1.85 radius (2179) and ×1.55 heal (2328) again. The result is radius ×4.07 (×6.3 with Vast) and heal ×2.71.
13. **Only the maximum aura radius is used** (statsEngine.ts:411-414), so Magnify on one cluster widens every aura.
14. **Shard levelling leaves `xpToNext` stale** (App.tsx:2032-2036 vs 583). After shard-levelling from 1 to 19, level 20 costs 120 XP instead of 10,208.
15. **The tier-name fallback is dead** because `Math.min` clamps the index (data.ts:1965-1967). T11+ is named "X. Apex Sanctum…" in-run but "Endless Abyss Tier N" in the Atlas (ExpeditionAtlasModal.tsx:71).
16. **Map mods reroll free on each tier click** (ExpeditionAtlasModal.tsx:84), and "Descend" carries the mod count forward (App.tsx:1979). One Chaos juices forever.
17. **Texts that disagree with code:**
    - n5_left grants player move, not ally move (data.ts:335-337).
    - n5_right says "+5% crit chance" but gives +10 tethered crit multi (350-352).
    - The talents' "in aura / when amped" conditions are never checked (ascendancy.ts:171, 202, 225 vs statsEngine.ts:536-561).
    - Kael's reflect and Alpha's freeze immunity are not implemented.
    - The Codex says "50 nodes, 9 keystones, ~80%" and "perks" (App.tsx:2245-2252).
    - The Legacy modal says "Trials T1, T2, T4, T6, T8" (LegacyModal.tsx:158).
    - Stale "Legacy" text (ConduitMatrixModal.tsx:577).
    - The comment says "52 Astral Shards needed"; the real total is 32 (Arena3D.tsx:2727).
18. **Dead fields and parameters:** `allyDamageReductionFlat`, `gemLevelBonusLegacy` and `maxSpiritPct`. `extraChain` is boolean-only. Dash potency and radius are never read, and neither is ult cooldown: Potency on Dash is a pure penalty, and the cooldown parts of Eternal, Potency, Vast and Infuse do nothing on ult.
19. **"Altar Devotee" counts purged relics as crafts** (App.tsx:898).
20. **`handleGainXp` has side effects inside a state updater.** It calls `setPlayerLevel`, a toast and a sound inside `setPlayerXp`, and reads a stale `playerLevel` when several kills land in one frame. This can double-fire and charge the wrong level's requirement (App.tsx:550-569).
21. **Balance — low-life:** ×2.18 at no meaningful risk. The player takes 0.55× slam damage on 35% of specials (Arena3D.tsx:2829, 2913) and respawns in place at 75% (2935). There is also an inversion: stacking Life efficiency can push Life reservation below 50% and switch low-life off. My first sim build sat at 32–35%.
22. **Balance — power curve:** enemy HP ×13 at T10 against build multipliers in the hundreds, with no AS cap (Arena3D.tsx:2539). Hero level scaling alone (×4.5) covers about a third of that.

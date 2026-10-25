# Aetherweaver: Remake Plan

A plan to rebuild **AETHERWEAVER**, the 3D support/aurabot ARPG prototype, into a game where playing the support is *skilful, readable, and deeply satisfying*, with build depth that actually changes how you play.

## The plan on a page

### What the original gets right, and where it falls short

The original has a great premise ("you are the support, your party is the weapon") and an ambitious Path-of-Exile-style meta layer. Its weakness is that the support never really *matters*:

- **You can't lose.** In a seeded playtest, a run with **no input at all cleared every tier tried (T1–T8)**. Playing well only made bosses die faster (median about 7×). The Weaver respawns at 75% and downed heroes revive on their own.
- **The game plays itself.** Heroes are leashed to you and have no abilities. A second beam triages on its own, auto-move dodges for you, and a button skips the waves.
- **Threats aren't readable.** Some hits are invisible, most damage comes from ailment ticks that bypass every defence, and the normal enemies are identical grey cones.
- **Build math collapses into one multiplier** (×22–33 by the endgame), and progression is maxed out by about run 25.
- **The code can't support fixing this.** It's two monolithic components, with a 2,900-line game loop inside a React effect, whole-app re-renders about 11 times a second, and about 70 bugs.

Full evidence, with line references, is in [01-findings.md](01-findings.md).

### The remake in eight moves

1. **Make support a skill.** Telegraphed threats, each with an answer: Ward (with a *Perfect* window), the aimed Chime, Reel (yank a hero out of danger along your Thread), and Glide. Idle play must lose. A bot harness in CI enforces it.
2. **Make your impact visible and audible.** Gold damage chips show your share at the moment of impact. Counterfactual *Saves* get hit-stop and slow-mo. Support SFX are pitched to the music's key, so playing well literally sounds like music.
3. **Put you in charge of the heroes' best moments.** Heroes charge a **Solo** that you **Cue** by spending Resonance earned through skilful play. Your Calling's **Crescendo** turns boss phases.
4. **Give heroes kits and personalities.** Utility AI, abilities and readable flaws (*Quirks*) that you cover. Bonds reshape them over time. Brann the berserker even inverts the healer's reflex: keep him low, not full.
5. **Keep the build depth, but make every choice change play.**
   - **Chords** (the original's aura clusters) take single-copy **Ornaments**.
   - Four **Callings** (Luminary, Martyr, Chronomancer and the new Conductor).
   - ~90 drafted **Motifs** and 12 **Harmonies**.
   - **Power math rules** stop multiplier inflation.
6. **Wrap it in runs.** A 35-minute **Expedition** of three Movements and a Finale, with map choices, drafts, relics, events and 4 multi-phase bosses. The persistent **Loom** hub holds the Astrolabe, Bonds, Calling mastery and the **Reliquary** (push-your-luck crafting on relics you keep between runs). The endgame is **Dissonance** levels, the **Atlas of Echoes** and weekly seeds.
7. **Teach by doing, reveal systems gradually.** The first run is the tutorial. Systems unlock one at a time. Accessibility is first-class: remapping, gamepad, colour-blind telegraphs, game speed, Perfect-window size.
8. **Rebuild the engine for it.** A deterministic, headless TypeScript simulation drives event-driven views (Three.js, React, WebAudio). That gives replays, golden tests and a **bot balance harness** that checks the player matters.

**What stays:**
- the premise and the heroes
- the heal/amp beam and the Chime
- the aura-cluster puzzle, keystones, ascendancies and Bonds
- Decrees and anti-support enemies
- the navy, gold and Cinzel look
- the heal-pitch audio

They are kept and made to *work*.

### A minute of the remake

> *Movement II, the Crimson Spire.* "Leave them to me!" Kael charges a hound pack again (Glory Hound). Your Allegro–Fortissimo Chord hums around you. A Hemomancer's crimson link snaps between Lyra and Vexis, and its glyph says **Scatter**, so you ping it and they split. Then an Impaler's lance line locks onto Vexis: 1.2 s. You're threaded to Kael. Press **3** to retarget and **F** to Reel: Vexis arcs to you along the thread as the lance tears through empty stone. **SAVED.** Time breathes, and three rising notes land in key. The Sentinel elite raises a discord barrier only empowered heroes can break, so you flip the Thread to **Empower** on Lyra and **Cue** her Gale Barrage. The barrier shatters, the melody stem kicks in, and two Resonance segments light up. The boss is next, and you're saving the Crescendo for it.

### Roadmap

```
P0 Foundations → P1 Combat slice ══ GO/NO-GO ══▶ P2 Auras & Cues → P3 Movement I run → P4 Meta (the Loom)
               → P5 Full Expedition → P6 Endgame → P7 Polish & ship
```

Phase 1 is the make-or-break gate. Ward and Perfect Ward, the Thread, the Chime and Reel against five readable enemies must be *fun on their own*, measured by bots and playtests, before any meta system is built. That is the inverse of how the original grew. Details, exit criteria, subagent workstreams and risks are in [06-roadmap.md](06-roadmap.md).

### Decisions for you

The plan assumes the recommended option for each ([06 §8](06-roadmap.md#8-decisions-for-you)):

1. **Roguelite runs + persistent meta** *(recommended)*, or stay a pure persistent ARPG. About 80% of the plan carries over either way.
2. **Musical renaming** of the Path-of-Exile-derived names *(recommended)*, or keep them.
3. **Browser-first** *(recommended)*, or desktop/Steam-first.
4. **CC0 art kits + custom Weaver/bosses** *(recommended)*, or fully custom art.

## Documents

| Doc | What's in it |
|---|---|
| [01-findings.md](01-findings.md) | What the original is; what's wrong, ranked by impact; what's good; what's kept, reinterpreted or cut; bug census; playtest notes |
| [02-game-design.md](02-game-design.md) | Vision, pillars with tests, loops, core combat rules, Callings, heroes and AI, encounters, Expedition structure, meta (the Loom), endgame, build archetypes, power math rules, economy, narrative |
| [03-content-bible.md](03-content-bible.md) | Every technique, Calling path, aura, Ornament, hero, enemy, elite affix, boss, Motif, Harmony, relic, event and Dissonance level, with starting numbers |
| [04-presentation.md](04-presentation.md) | Art direction, VFX language, the juice spec per event, adaptive music and pitched SFX, HUD layout and telegraph grammar, screens, onboarding, accessibility |
| [05-technical-architecture.md](05-technical-architecture.md) | Stack (versions checked 2026-10-24), module layout, deterministic sim, commands and events, damage pipeline and contribution ledger, AI, rendering, UI, content pipeline, saves, tooling, testing, the bot balance harness, performance budgets |
| [06-roadmap.md](06-roadmap.md) | Phases 0–7 with exit criteria, how subagents parallelise the build, definition of done, risks, release checklist, first-session steps, decisions |
| [appendix/](appendix/) | The four raw analysis reports (combat, systems, shell/UX, playtest) and screenshots of the original |

## Glossary

| Term | Meaning | Original equivalent |
|---|---|---|
| **Weaver** | the player: pure support, never deals direct damage | Weaver |
| **Thread** | constant beam to one hero: *Mend* (heal) or *Empower* (amp); has range, tension and snap | Caduceus tether, heal ⇄ amp |
| **Ward** / **Perfect Ward** | barrier on a hero; cast it no more than 0.35 s before a hit lands to negate the hit entirely | — (new) |
| **Chime** | the aimed Cleanse bell | Purifying Chime |
| **Reel** | yank the threaded hero to you | — (new) |
| **Glide** | the Weaver's dash | Guardian's Fall (dash) |
| **Spirit** | reserved by auras; the unreserved pool pays for techniques | Spirit |
| **Resonance** | skill meter in 4 segments, earned by skilful support | Resonance (reworked) |
| **Solo** / **Cue** | a hero's signature ultimate / the Weaver triggering it | — (new) |
| **Crescendo** | the Calling's ultimate, costing 100 Resonance | Sanctuary Apotheosis (ult) |
| **Directive** | timed party command: Focus, Rally, Hold, Scatter | stances |
| **Chord** | 2 auras + 2 Ornaments that apply to both | conduit cluster |
| **Ornament** | single-copy support modifier for a Chord | support rune |
| **Calling** | per-run Weaver class with a path and a Crescendo | ascendancy |
| **Motif** / **Harmony** | in-run drafted boon / duo boon | — (new) |
| **Expedition** / **Movement** | a run / one of its three acts | expedition tier |
| **Decree** | a boss's named signature mechanic | Decree |
| **The Loom** | the hub | — |
| **Astrolabe** | persistent passive tree | Astrolabe |
| **Reliquary** | persistent relics, inscriptions and crafting | Reliquary Forge |
| **Dissonance** | opt-in difficulty levels | map tiers and modifiers |
| **Ledger** | the counterfactual contribution tracker behind Saves, gold chips and the run report | attribution % |

## Sources

- Asset licences (all CC0 unless noted):
  - [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers)
  - [KayKit Skeletons](https://kaylousberg.itch.io/kaykit-skeletons)
  - [KayKit Dungeon Remastered](https://kaylousberg.itch.io/kaykit-dungeon-remastered)
  - [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-animations) ([OpenGameArt mirror](https://opengameart.org/content/kaykit-character-animations))
  - [Kenney Interface Sounds](https://opengameart.org/content/interface-sounds)
  - [Quaternius Ultimate Monsters](https://sketchfab.com/3d-models/ultimate-monsters-pack-fd72e114d119488da71fe3a16f216c4f): listings disagree (CC0 vs CC-BY), so confirm on quaternius.com before use.
- Libraries:
  - [three.quarks on npm](https://npmjs.com/package/three.quarks)
  - [pmndrs/postprocessing releases](https://releasealert.dev/github/pmndrs/postprocessing)
  - All library versions in [05 §2](05-technical-architecture.md#2-stack) were read from the npm registry on 2026-10-24.

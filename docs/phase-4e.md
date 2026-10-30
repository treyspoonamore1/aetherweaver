# Phase 4e — Bonds

*2026-10-30 · plan: [docs/plan/02-game-design.md §6](plan/02-game-design.md#6-heroes-and-ai), [03 §5](plan/03-content-bible.md#5-heroes) · follows [Phase 4d](phase-4d.md)*

The last piece of the Loom: **Bonds**, the heroes growing with you. Kael, Lyra and Vexis each earn **Bond XP** from the fights you share, most of all from what you do for them. Their Bond **ranks** (1–10) open **talents** that reshape their quirks and kits, an **alternate Solo**, and two short **scenes** each, which give them stories. This is the plan's "heroes are characters, not stat sticks" (pillar 4). The user chose how it works:

| Question | Choice |
|---|---|
| How much now? | **Everything** for the three starters: ranks 1–10, a talent pick (1 of 2) at ranks 3, 6 and 9 (18 talents), an alternate Solo at rank 10, and two scenes each. |
| How is Bond XP earned? | **A base plus your support.** Every fight pays each hero in it some Bond XP, and more for their share of your support: healing, shields, amplified damage and saves. The hero you carry grows fastest, and lost fights still pay. |
| Can talents change? | **Freely, between runs**, like the Astrolabe. A run keeps the talents it embarked with. |
| Where do scenes play? | **At Respites.** When a hero has a scene waiting, a Respite offers it as a fourth choice instead of resting: no healing, but Bond XP for that hero and a short story beat. |

## How it works

- **Bond XP.** After every fight, each hero in the party earns:
  - a **base**, the same for all three;
  - a share of a **support pool**, in proportion to your support of them that fight: your healing and shields on them, the damage your songs and Thread added to theirs, and the life your saves kept.

  Both scale with the fight: an elite pays more, a mini-boss more again, the boss most. A lost fight pays half. The Summary shows what each hero earned, and the Result shows the fight's.
- **Ranks 1–10.** Each rank costs more than the last (see *Bond XP and ranks*). A rank-up gets a card, like a Weaver Rank's.
- **Talents.** At Bond ranks **3, 6 and 9** a hero opens a tier of two talents: choose one, or neither. Talents change *how* a hero fights: they reshape a quirk, add a move, or tie the hero to your Thread, your field or your Focus. Numbers come second (pillar 5).
- **The alternate Solo.** At rank **10** a hero opens a second Solo. Choose which one they bring. The defaults deal damage or shield; the alternates are new ways to support the party, each with its own decision for you.
- **Changing them.** Choose and change talents and Solos freely between runs: on the Bonds screen, from the Title or from Prep. Embarking freezes them for the run, as it does the Astrolabe and the carried relics. The Training Grounds play with your current choices.
- **Scenes.** Each hero has two: one at Bond rank 2 and one at rank 7. Once a hero reaches a scene's rank, it **waits** until a Respite offers it. Choosing it gives up the Respite's rest, meditation or retune for:
  - the scene: about 20 seconds of dialogue, with one reply to choose (it changes their answer, not the game);
  - Bond XP for that hero, worth a good share of a rank.

  A scene plays once. Scenes you've seen can be read again on the Bonds screen.
- **Opening.** Bonds need no Weaver Rank: Bond XP is earned from the first fight. The Bonds screen opens with the first Bond rank-up, which introduces it.
- **Skip the unlocks** lets every talent and both Solos be chosen, as if every Bond were at rank 10. Scenes still wait for real ranks.

## The talents

Each tier's two talents are a real choice: different ways to play, not a stronger and a weaker. Numbers are first guesses, to be tuned (see *Harness*).

### Kael, the Bulwark

Kael needs to be needed. His talents turn Glory Hound from a liability into a tool, and his shield from his own into the party's.

| Rank | Talent | Effect |
|---|---|---|
| 3 | **Steady Vanguard** | Glory Hound waits for your Focus: when a new pack arrives, Kael charges only if you've set a Focus, and charges that enemy. |
| 3 | **Vanguard's Roar** | When Glory Hound sends him charging, everything within 8 m of his quarry turns on him for 4 s. |
| 6 | **Riposte Bash** | A Perfect Ward on Kael fires Shield Bash at the attacker, if it's within 6 m, whatever its cooldown. |
| 6 | **Bulwark of Faith** | While you Thread him, Kael is healed 20% more. |
| 9 | **Unbreakable** | Once a fight, a blow that would down Kael leaves him at 1 life, untouchable for 2 s. |
| 9 | **Shieldbearer** | Aegis Wall also shields every hero within 6 m of Kael, at half its strength. |

### Lyra, the Windrunner

Lyra trusts no one to have her back. Her talents either keep her alive on her own, or bind her to your Thread and field.

| Rank | Talent | Effect |
|---|---|---|
| 3 | **Wind Step** | Every 10 s, Lyra steps out of the first attack aimed at her, whatever she's doing (Greedy Shot included). |
| 3 | **Hawk Eye** | Lyra shoots from 3 m farther, and her Empowered crits give you 1 Resonance. |
| 6 | **Ricochet** | Her arrows bounce once, to another enemy inside your field, at 60% damage. |
| 6 | **Hunter's Mark** | The enemy you Focus takes 20% more damage from every hero while Lyra stands. |
| 9 | **Storm Queen** | During Gale Barrage, the hero you Thread looses an arrow with each of hers, at 50% damage. |
| 9 | **Last Light** | Below 30% of her life, Lyra attacks 50% faster. |

### Vexis, the Starcaller

Vexis thinks the song can be solved like an equation. Her talents make her commitment pay, or carry her spells along your Thread and into your field.

| Rank | Talent | Effect |
|---|---|---|
| 3 | **Arcane Ward** | When an enemy strikes Vexis up close, she blinks 6 m toward you (once every 12 s). |
| 3 | **Overchannel** | Starbolt deals 30% more damage and takes 20% longer to cast. |
| 6 | **Starthread** | Starbolt also strikes the enemy nearest the hero you Thread, at half damage. |
| 6 | **Event Horizon** | Gravity Well pulls enemies toward the centre of your field, from 2 m farther. |
| 9 | **Supernova** | Starfall ends in a nova: every enemy within 6 m of its last meteor takes three meteors' damage. |
| 9 | **Constellation** | Each Cue leaves a star where the hero stands, casting Vexis's arcane bolt at the nearest enemy every second for 6 s. |

## The alternate Solos

At Bond rank 10, choose which Solo a hero brings. Each alternate asks something new of you.

| Hero | Default | Alternate | Uncued | Cued |
|---|---|---|---|---|
| Kael | Aegis Wall (a barrier; cued, a party dome) | **Oathkeeper** | For 5 s, hits on heroes within 6 m of Kael land on him instead, at half. Keep him standing. | Within 9 m, and he takes a third. |
| Lyra | Gale Barrage (12 arrows a second) | **Hawk's Vigil** | For 6 s she holds still and shoots every enemy that starts an attack within her range, once. A cast she can interrupt is interrupted. | She can move, and each shot marks its target to take 25% more damage for 4 s. |
| Vexis | Starfall (meteors) | **Celestial Sphere** | For 5 s, a sphere around the hero you Thread swallows the next 2 hits on them, whole (telegraphs included). Choose whom you Thread. | Every hero in your field gets a sphere of 2 hits. |

## The scenes

Two for each hero, at Bond ranks 2 and 7. Each is a few lines at a Respite's fire, with one reply to choose. The words are written in content.

| Hero | Rank | Scene | What it's about |
|---|---|---|---|
| Kael | 2 | **The Dented Shield** | He mends his shield and talks of the order he swore to, which went silent. He's afraid of being unneeded. |
| Kael | 7 | **Unbidden** | He admits Glory Hound is fear: he charges so someone will need him. He asks you to hold him back. |
| Lyra | 2 | **Tailwind** | Windrunners fly in pairs, and hers flew on without her. She resents the Thread, and relies on it. |
| Lyra | 7 | **Two Fletchings** | She gives you one of her fletchings: if the Thread ever snaps, she'll know you didn't let go. |
| Vexis | 2 | **Margins** | She tries to predict your next Ward in the margins of a star chart, and is cross that the song won't solve. |
| Vexis | 7 | **The Unsolved Term** | Her chart has a gap where the calculation fails: you. Some things, she decides, are trusted rather than solved. |

## Bond XP and ranks

First guesses, to be tuned against the harness (see *Harness*). The aim: a hero's first talent in their first run or two, the second around run 6, the third around run 14, and the alternate Solo around run 18. The hero you support most should be a few runs ahead.

- **Per fight**, for each hero in the party: `kind × (base + pool × share)`.
  - `base` 8 and `pool` 24 (shared among the three by your support).
  - `kind`: a skirmish 1, an elite 1.5, a mini-boss 2, the boss 3. A lost fight pays half.
  - `share`: the hero's part of your support that fight. Without any support, the pool isn't paid.
- **A scene** pays 40% of the XP between its rank and the next.
- **Ranks**, cumulative XP: 0, 80, 220, 420, 680, 1000, 1380, 1820, 2320, 2900.

## Power

Talents and Solos add power, but the plan caps meta *raw* power (the Astrolabe and the Reliquary, about +30%), and Bonds are meant to change how heroes play more than how hard they hit. The harness measures each talent as the enemy life it's worth, as for Dissonance. The targets:

- a tier's two talents within a few percent of each other;
- a hero's full Bond (three talents and either Solo) worth about 5–8% of enemy life;
- all three heroes' full Bonds about 15–20%.

## Contracts (v13)

**Content** (`CONTENT_VERSION` bump), in `src/content/bonds.ts`:
- `bondRules`: the ranks' cumulative XP, `base`, `pool`, the per-kind multipliers, the loss multiplier, the talent ranks (3, 6, 9), the Solo rank (10), the scenes' XP share.
- `talents`: `{ id, hero, tier (1–3), name, text, values }`, two per tier per hero. The text is built from `values`.
- `altSolos`: `{ id, hero, name, text, cuedText, chargeTime, duration, values }`.
- `scenes`: `{ id, hero, rank, title, lines: { speaker, text }[], replies: { text, response }[] }`.
- Lint: every talent and Solo has sim behaviour; every hero has two talents a tier, one alternate Solo and two scenes; texts fill from values.

**Sim** (`SIM_VERSION` 18):
- `SimConfig.bonds?: { talents: string[]; solos: string[] }`: the talents in force and the alternate Solos chosen. Resolution: unknown ids refused, a hero not in the party ignored, one talent per tier per hero. An absent Weaver's re-run keeps them: the heroes are the same people.
- `HeroComponent`:
  - `talents` and `soloId` (the Solo this hero brings), for the views;
  - `supportReceived`: your healing, shields and saves on them this fight (Bond XP);
  - each talent's state where it needs one (a cooldown, once a fight).
- Each talent's effect at its hook: Glory Hound, the Perfect Ward, healing received, the down check, Aegis Wall, telegraph dodging, attack range and speed, landing hits, Focus damage, Gale Barrage, Starbolt, Gravity Well, Starfall, Cues.
- The alternate Solos in `solos.ts`, alongside the defaults.
- Event `talentFired { hero, talent, x, z, target? }` whenever a talent visibly acts, for the views and sounds.

**Meta** (`src/meta/bonds.ts`, pure):
- `bondRank(xp)` and `bondProgress(xp)`;
- `bondXpForFight(outcome, kind)`: Bond XP by hero;
- `talentChoices(hero, rank)`, `fitBond(bond, rank)`, `sceneWaiting(bond, rank)`;
- `bondsConfig(run)`: the run's frozen choices as `SimConfig.bonds`.

**Profile v6:**
- `bonds: Record<heroId, { xp, talents: (id | null)[3], solo: 'default' | 'alt', seen: sceneId[] }>`.
- Fitted on load: unknown ids dropped, a choice above its rank cleared (unless Skip the unlocks).

**Run:**
- `RunState.bonds`: the choices, followed in Prep and frozen at embark. Old saves have none.
- `EncounterResult.bondXp: Record<heroId, number>`.
- A Respite's fourth choice: `respite(run, { scene })` goes to a `scene` phase. `endScene(run, reply)` returns to the map.

**Stores:**
- The profile store: `awardBonds(xpByHero)` (with rank-up notices), `setTalent(hero, tier, id | null)`, `setSolo(hero, choice)`, `seeScene(id)`, `bondsAllowance()`.
- The run store: Prep follows the profile's choices; a fight's Bond XP is awarded with its Weaver XP; a scene's on its end.

## Presentation

*To be filled in by the UI and audio workstreams.*

## Harness

*To be filled in.*

## Code review

*To be filled in after the review.*

## Known gaps

*To be filled in.*

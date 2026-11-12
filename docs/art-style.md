# The art style: stained glass

The owner's decision (Phase 8b): every figure in a fight is drawn as **stained glass**. This guide is
for anyone who builds or changes a figure. It says what the look is, in rules you can follow, how the
code is laid out so several people can redraw at once, what each figure may cost, and what never to
touch. The look's source of truth is the art direction (`docs/plan/04-presentation.md` §1,
"stained-glass cosmos") and its readability rules, which override art.

## The look in one paragraph
A figure is built from flat panes of coloured glass held in dark lead. The big surfaces a player
reads (a cape, a robe, a shield, a pauldron) are cut into irregular panes, each a slightly different
tone, and a share of those panes glow from inside in the glass's own colour. A dark lead outline runs
round every figure. Signature colours are saturated and faintly self-lit so they hold under any
arena's light. The Weaver alone is leaded in gold. The Hollow Choir is porcelain whose "lead" is a
web of violet cracks. Silhouettes are designed for the fight's camera first (high, far, about 70 px
tall at 1280×720), close-ups second.

## Where the code is
- `src/render/models/art/` holds every figure the game draws (Phase 8b: the stained glass is the
  game; there is no switch and none of main's older figures is left).
  - `kit.ts`: the shared helpers and constants every figure uses (read its doc comment first).
  - One **family file** per group of figures, each exporting `ART`:
    `heroes.ts`, `weaver.ts`, `choir.ts` (Movement I), `legion.ts` (II), `unstitched.ts` (III),
    `unweaver.ts` (III's boss), `finale.ts`, `misc.ts` (summons, the elite crown).
  - `index.ts`: the registry. It merges every family's `ART`; `library.ts` builds every figure
    through it. An enemy id with no figure of its own (a content id added before its figure) is
    drawn as its role's Choir figure until it gets one (in its own colours, sized from its radius,
    except a miniboss: the Bellwarden at its own size), and `tests/renderArt.test.ts` fails until then.
- The model shader (panes, lead, lit glass, cracks, outline, motion): `src/render/models/material.ts`.
  The builder (pane detection, outline shell, body layer): `src/render/models/builder.ts`.
- `src/render/models/artFlag.ts`: the heroes' and the Weaver's drawn scale (`HERO_DRAWN`, 1.12) and
  `HOSTILE_EDGE` (see Colour). `src/render/models/artWorld.ts`: the dark worlds' lift.
- The roster of every figure, with its family, size class and triangles: `docs/art-roster.md`.

### The registry's contract (what a family file exports, and nothing else)
1. A family file exports one `ART: ArtFamily` (`kit.ts`) and edits nothing outside itself.
2. `ART.heroes[heroId]` / `ART.enemies[enemyId]`: a builder `(def) => BufferGeometry` per content id.
3. `ART.weaver(palette)`, `ART.sapling(moss)`, `ART.ancient(moss)`, `ART.crown()` for those figures.
4. Each builder starts from `figure(sizeClass, { body })` and returns `b.build()`; it must build the
   same parts in the same order for any colours (the Weaver's robes recolour in place).
5. An id claimed twice is an error when the registry loads; a hero or single figure in no `ART` is
   an error when built, an enemy id in none takes its role's figure (above).

## Rules for building a figure

### Panes and leading
- Every part of a `figure` is glass with lead along its hard edges (a flat facet is one pane).
- `cell: <m>` cuts a big part into irregular panes about that size. Use it on the large, coloured
  surfaces a player reads: 0.15–0.25 m on a hero's cape, robe, shield; 0.1–0.14 on smaller ones
  (a hood, a hat brim). Never on faces, hands, trims, cords or anything under ~0.15 m.
- `lead: 0` for parts with no lead (faces, lights, cords, gems). `lead: 2` (gold came) is the
  **Weaver's only**. `lead: 3` is porcelain: its lead is violet cracks (see below). `lead: 4` is bone
  lead (pale seams along the pane borders: the Unstitched's bone). `LEAD_KIND` names them.
- `lift: false` on a cut part keeps it dark in the three dark worlds, where the darkest cut glass is
  otherwise lifted a little in its own hue (`artWorld.ts`): for void cloth and black coats that must
  stay deep (the Unweaver, the Conductor's coat, the Legion's obsidian).

### Lit panes and self-light
- `lit: share` makes that share of a part's panes glow from inside in their own colour. Heroes:
  `HERO_GLASS` (0.22). Keep it at or under 0.4; a figure that glows everywhere loses its form.
- `glow`: a part's own faint light. `SIG` (0.16) for a hero's signature colour; 1 for real lights
  (eyes, a focus crystal, a lantern). Lights are small: a pin of light reads, a block of light shouts.

### Porcelain and cracks (the Hollow Choir)
- `glaze(cell, share)`: porcelain (`porcelain(def.color)` for the cool white) whose lead is violet
  cracks along `share` of its pane borders. Plain dark cloth under it (a cassock, a hood) stays
  plain and dark: the hostile rim (rule 5) reads on it.
- The Choir's light is violet (`CHOIR`, `CHOIR_DEEP`), never the content's amber accent: amber on a
  foe reads as a threat telegraph. Note: the crack violet is the content's own `CRACKS` (#a78bfa),
  which is also the ailment colour; keep it to thin crack lines and small lights, never a large
  violet glow.

### The outline
- A dark lead shell round every part, a constant ~1.6 px on screen. It is the figure's silhouette
  against the floor in the bright worlds.
- Per figure, by size class (`OUTLINE_OF` in `kit.ts`): `full` (every part: heroes, the Weaver,
  elites, bosses), `major` (only parts ≥ 0.14 m: swarms and crowds; about half the outline's cost),
  `none`. A part may opt out with `shell: false` (lights, thin glowing lines, a face's eyes).
- Open surfaces (`b.arc`, a train or cloak slice) have no shell by design.
- The outline is lead everywhere: no light or tinted edge in any world (tried on the dark worlds,
  it greyed every signature colour and weakened the rims).

### Colour
- **Gold means the Weaver.** No gold trim, gold lead or gold light on anyone else. Heroes' trims are
  silver, steel or leather.
- **No semantic colour as decoration** (`src/render/palette.ts`, PALETTE): Mend/heal teal `#2dd4bf`,
  Ward/shield cyan `#a5f3fc` and dome `#bff7ff`, Empower/amp amber `#fbbf24`, the Weaver's gold
  `#f5d78e` / `#fff1c4` / `#f6e7c1`, Resonance white-gold `#fff4d6`, threat orange `#fb923c`, lethal
  crimson `#f43f5e`, ailment violet `#a78bfa`, discord pink `#f472b6`. A figure may wear its own
  signature colour (Kael steel-blue, Lyra emerald, Vexis violet, Brann crimson, Seren silver/steel,
  Oro moss) and its family's palette, not these as ornament. Check a new colour with
  `deltaE`/`simulateVision` (`src/app/colorVision.ts`) against PALETTE in every colour vision;
  Phase 8a kept ≥ 20 ΔE.
- Each hero keeps their signature hue on most of their area, saturated, faintly self-lit.
- The hostile rim (rule 5), the aura rims, Mend's rim on the threaded hero, the hover rim and the
  Prism edge are drawn **on the body by the shader**: never cover a foe's silhouette with a bright
  glow that would drown its hostile rim.
- The hostile rim today adds a faint flat red to the whole body as well as its edge, which turns a
  near-black body red (the Legion's obsidian, the Unstitched's cloth, the mirror voices' hoods).
  `HOSTILE_EDGE` (artFlag.ts, off until the owner chooses) keeps it to the silhouette's edge on the
  stained-glass foes; flipping that one constant is the whole change. Judge dark foes both ways
  (the studio's `hostile: 'flat' | 'edge' | 'none'`).
- A glow makes a colour brighter than its hex: measure small lights **as rendered** at the game
  camera, not only their hex (the Unstitched's teal stitches read near Mend at glow 1.8; at 0.1
  they clear it). `tests/colorVision.test.ts` checks every colour written in a family file in two
  tiers (Phase 8b) and names each exception: add yours there with its reason.

### Silhouette first, from the fight's camera
- The camera is high (52°) and far (27 m): a figure is ~60–90 px tall and seen mostly from above
  and, for the party, from behind. Design the **top and back** first: what reads from above is a
  hat brim, a hood point, pauldrons, a cape, a shield's back, a bell on a back.
- Give every figure a **signature mark from above**: Kael's glass shield and pauldrons, Lyra's hood
  point and canted bow, Vexis's hat disc, the Weaver's halo ellipse and train, the Chorister's
  upturned white face and candle, the Brute's back-bell, the Bellwarden's bell.
- Roles differ by silhouette (rule 2): brutes wide, casters tall with a glowing focus, snipers
  long-limbed with a lance, swarmers small and low.
- Heroes and the Weaver are drawn **1.12×** (`HERO_DRAWN`, the model only: rings, reach, footprints,
  hit shapes and everything placed by their content height stay as they are). Build them at content
  size; the scale is applied when drawn.
- Keep heights honest: Seren reads as tall against Kael (`tests/renderSeren.test.ts`).

### How the families differ
- **Heroes**: signature glass, silver/steel/leather, the cut panes on their largest surface.
- **The Weaver**: white-gold glass in gold came, hooded, dark face with two points of light, halo,
  bell sleeves, a train; her ribbons leave her hands. Most luminous figure, never the largest.
- **The Hollow Choir (Movement I)**: cool porcelain with violet cracks, dark cassocks, bronze bells
  lit violet inside; masks and bells as their marks.
- **The Crimson Legion (Movement II)**: obsidian plate (near-black glass with dark lead), crimson
  glass panes lit from inside, brass trim and fittings. Crimson as glass, never the lethal crimson
  as a large glow; check against lethal `#f43f5e` and Brann's crimson.
- **The Unstitched (Movement III)**: indigo void cloth (dark glass, few lit panes), bone seams as
  pale lead lines, teal stitches as small lights. Teal is Mend's family: keep stitches thin and away
  from Mend's exact hue (measure).
- **The Finale (the Crucible)**: faceted glass and white-black: clear/pale panes with dark lead,
  sharp facets (few `cell`s, large flat facets), a prismatic edge only where the content asks.

### Motion (tag parts; the shader moves them)
Wrap parts in `b.rigged({ k: KIND, at: pivot, a }, () => ...)`:
- `WEAPON` an attacking arm: anticipation (raised), strike (snaps down and across past rest),
  settle (bounce). `a` scales it (negative pulls back: a bow's draw hand).
- `THRUST` a lunge (a rapier, a spear, a lance): drawn back, driven out along the figure's forward,
  recovered (`a` = reach, m). Never a `WEAPON` for a thrusting weapon: it reads as a chop.
- `BRACE` an off-hand or shield arm (keep `a` small for a shield).
- `CLOTH` hangs from its pivot, trails as the body moves, flares a beat after a blow (`a` ≈ length).
- `BELL` a pendulum: draws back in the wind-up, flings through, rings out.
- `HEAD`, `LIMB` (`a = ±1` per leg), `FLOAT`, `SPIN`, `WHEEL`, `WEAVE` (the Weaver's hands),
  `BODY` (a body that walks on its own: the walking bell).
- `figure(size, { body: [hip, span] })`: everything above the hips breathes, sinks and rolls on each
  step, leans back in the anticipation and twists into the strike. Give every walking figure one.
- A figure's clock stops while it is held, frozen, down or under Reduced motion (entities.ts).

### Budgets (triangles per figure, outline included)
| size class | budget | outline | who |
|---|---|---|---|
| swarm | 1,100 | major | choristers, hounds, leeches, shears, saplings |
| standard | 2,200 | full | rank-and-file casters, snipers, supports |
| elite | 3,600 | full | large rank-and-file (Bell Brute, Crimson Sentinel, Void Maw, Mirror Champion, mirror bass/tenor), the Ancient |
| boss | 8,000 | full | bosses and minibosses |
| hero | 2,600 | full | heroes |
| weaver | 3,400 | full | the Weaver |

Why these: the 150-enemy bench (5/8 Choristers, 1/8 each Brute, Lamenter, Glass Lancer) at these
budgets is ≈ 94 × 1,100 + 19 × 3,600 + 38 × 2,200 + party 3 × 2,600 + 3,400 + arena ~15k ≈ 282k,
under half the 600k limit with every figure redrawn; draw calls do not move (one batch per model).
Check yours: `__VFX__.artBudgets()` in the lab, or the studio script's `budget` view.

## The studio (photographing your work)
The lab's art studio stands any roster id on a real arena floor under the arena's own light, with
no sim. From a page at `?lab=vfx`:

```js
__VFX__.studio({ layout: 'close', subject: 'lamenter', arena: 'reliquary_hall' });
__VFX__.studio({ layout: 'field', subjects: ['kael', 'weaver', 'lamenter', 'glass_lancer'], arena: 'spire_gate' });
__VFX__.studio({ layout: 'lineup', subjects: ['lamenter', 'glass_lancer', 'mute'], arena: 'rift_mouth' });
__VFX__.studio({ layout: 'close', subject: 'lamenter', pose: { clock: 3, windup: 1 } }); // held attack
__VFX__.studio(null); // back to the fight
__VFX__.artBudgets(); // every redrawn figure's triangles against its budget
```

A subject is a hero id, `weaver`, an enemy id, `sapling`, `ancient` or `crown`. `layout: 'field'`
is the game's own camera; judge every figure there first. The four worlds: `reliquary_hall`,
`spire_gate`, `rift_mouth`, `the_crucible` (any arena id works). `rim: { lyra: { hex, strength } }`
puts a rim on a subject (e.g. Mend's `#2dd4bf` at 0.5) to check rims still read.

Studio options beyond the layout: `elite: [ids]` (the gold elite rim and the crown, as the game
draws an elite), `hostile: 'flat' | 'edge' | 'none'`, `look: { robe, thread }` (the Weaver in a robe
or Thread look), `pose` (a held point of the motion), `rim`, `world: false` (no dark-world lift).

The script `tools/art-shoot/shoot.mjs` (one browser per run; give parallel runs their own `--port`,
and set `TMPDIR` on a disk with room for the browser's profile):

```sh
npx vite build --outDir /tmp/art-dist
node tools/art-shoot/shoot.mjs --dist /tmp/art-dist --out /tmp/art-shots \
  --ids lamenter,glass_lancer,mute --world spire --views budget,close,field,lineup,pose \
  --extra '{"elite":["glass_lancer"]}' --tag elite --port 4481
```

Views: `close` (`close-<id>.png`), `field` (`field-<world>.png`), `lineup` (`lineup-<world>.png`),
`pose` (`pose-<id>.png`: a six-frame held attack: wind-up 0.5 and 1, blow 0.26, 0.31, 0.42, 0.7),
`budget` (`budgets.json`). Pictures are 2560×1440 (1280×720 at device scale 2).

## Never touch
- **Auras and ornaments**: the song field, the beam song on the Thread, the pour, Fermata, Chorus
  Pulse, Pedal Point, Unison, their chips and cards, and the lines in `entities.ts` that draw the
  beam swell, the Fermata freeze and rim and the aura coverage marks. No change to their drawing,
  colour, size, timing or reach. `tests/aura` must pass with its pin files unedited.
- **Rings, the Thread, telegraphs, glyphs** and their positions (they stay at content heights).
- **The sim, content and meta** (`src/sim`, `src/content`, `src/meta`): render side only.
- **Lighting** (`lightCues.ts`, `arena.ts` moods).
- **`tests/aura` and its pin files**: never edited. Model pins (renderSpireSnapshot,
  renderRiftSnapshot, renderMovement2, the starters in renderBrann and renderSeren) pin the figures'
  geometry: re-record a figure's entry only when you change that figure on purpose, and say so.
  Rule tests (heights, greyscale separation, colour-vision distances, quadruped gait, distinct
  bodies, parts counts) are never edited: change the figure.

## Before calling a figure done
1. It is in your family file's `ART` under its content id, built with `figure(sizeClass, …)`.
2. `__VFX__.artBudgets()`: within its class budget.
3. **Game camera first**: `field` view in its own world and one dark world. It reads as its role
   at ~70 px; its signature mark is visible from above; it separates from the floor.
4. Hostile rim (rank-and-file foes) still reads; nothing on it is gold or a semantic colour.
5. Close-up and line-up: panes on the big surfaces, lead round them, a few lit panes, face/eyes.
6. `pose` strip: anticipation, strike past rest, settle read; cloth and bells follow.
7. `tests/renderArt.test.ts`, `tests/colorVision.test.ts` and the render and aura tests pass; a
   model pin that fails is your own figure's (re-record its entry, saying why).
8. Typecheck, lint and prettier clean; nothing outside your family file changed (except its pin
   entries).

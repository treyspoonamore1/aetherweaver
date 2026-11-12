# The art roster: every figure a fight can put on screen

Found from `src/content` (heroes, enemies, `loom.ts` cosmetics, summons in
`src/sim/systems/summons.ts`) and the model builders a fight calls (`src/render/models/library.ts`,
`EntityLayer.add` in `src/render/entities.ts`). Every figure is drawn in stained glass by its family
file in `src/render/models/art/` (docs/art-style.md); `tests/renderArt.test.ts` checks that every
content id has one and that each is within its size class's budget. Triangles include the outline.

Size classes: **swarm** (crowd fodder, cheaper outline) · **standard** (rank-and-file) · **elite**
(a large rank-and-file body) · **boss** (bosses and minibosses, one or two on screen) · **hero** ·
**weaver**.

## Heroes (`art/heroes.ts`)
| id | role | triangles / budget | size |
|---|---|---|---|
| kael | tank | 2,004 / 2,600 | hero |
| lyra | ranger | 1,996 / 2,600 | hero |
| vexis | arcanist | 1,828 / 2,600 | hero |
| brann | berserker | 2,332 / 2,600 | hero |
| seren | duelist | 1,716 / 2,600 | hero |
| oro | summoner | 1,812 / 2,600 | hero |

A hero's Save ghost, Rewind ghost and fall reuse its own model (same batch): nothing extra to draw.

## The Weaver (`art/weaver.ts`)
| id | triangles / budget | size |
|---|---|---|
| weaver | 3,092 / 3,400 | weaver |

What changes her model: the robes (`CONTENT.cosmetics.robes`, `loom.ts`): **robe_dusk, robe_ember,
robe_tide, robe_bone, robe_crownless** recolour her body, trim, halo and hood (`weaverPalette`), and
the Thread looks **thread_silver, thread_rose, thread_starlit, thread_wayward** recolour her hands.
Every palette rebuilds the same parts in the same order (`recolorModel`; tests/renderArt). The
robes on the glass Weaver were checked by W2 and photographed at integration (Dusk, Ember and Tide
read well; Bone and Gold reads close to her own; Crownless is the weakest on the Reliquary's floor).

## Movement I, the Hollow Choir (`art/choir.ts`)
| id | role | triangles / budget | size |
|---|---|---|---|
| hollow_chorister | swarm | 1,076 / 1,100 | swarm |
| bell_brute | brute | 3,260 / 3,600 | elite |
| lamenter | caster | 1,240 / 2,200 | standard |
| glass_lancer | sniper | 1,056 / 2,200 | standard |
| mute | controller | 2,040 / 2,200 | standard |
| cantor_acolyte | support | 1,822 / 2,200 | standard |
| the_bellwarden | **miniboss** | 4,692 / 8,000 | boss |
| the_hollow_cantor | **boss** | 5,748 / 8,000 | boss |

## Movement II, the Crimson Legion (`art/legion.ts`)
| id | role | triangles / budget | size |
|---|---|---|---|
| sanguine_hound | swarm | 848 / 1,100 | swarm |
| leech | swarm | 1,080 / 1,100 | swarm |
| hemomancer | caster | 2,016 / 2,200 | standard |
| impaler | brute | 1,836 / 2,200 | standard |
| crimson_sentinel | brute | 2,352 / 3,600 | elite |
| gorehound_matriarch | **miniboss** | 3,008 / 8,000 | boss |
| vharun_crimson_warden | **boss** | 3,900 / 8,000 | boss |

## Movement III, the Unstitched (`art/unstitched.ts`, the Unweaver in `art/unweaver.ts`)
| id | role | triangles / budget | size |
|---|---|---|---|
| shears | swarm | 1,000 / 1,100 | swarm |
| void_maw | brute | 1,640 / 3,600 | elite |
| doubt_wraith | caster | 1,300 / 2,200 | standard |
| null_priest | caster | 1,748 / 2,200 | standard |
| mimic | caster | 480 / 2,200 | standard |
| spindle | support | 1,264 / 2,200 | standard |
| stolen_verse | caster | 768 / 2,200 | standard |
| mirror_champion | brute | 1,916 / 3,600 | elite |
| the_seamstress | **miniboss** | 4,652 / 8,000 | boss |
| the_unweaver | **boss** | 3,796 / 8,000 | boss |

## The Finale, the Celestial Crucible (`art/finale.ts`)
| id | role | triangles / budget | size |
|---|---|---|---|
| mirror_alto | caster | 1,072 / 2,200 | standard |
| mirror_soprano | caster | 720 / 2,200 | standard |
| mirror_bass | brute | 912 / 3,600 | elite |
| mirror_tenor | brute | 1,012 / 3,600 | elite |
| the_silent_conductor | **boss** | 4,652 / 8,000 | boss |

## Everything else a fight draws as a figure (`art/misc.ts`)
| id | what | triangles / budget | size |
|---|---|---|---|
| sapling | Oro's Sapling (summon) | 432 / 1,100 | swarm |
| ancient | Oro's Ancient (summon) | 1,672 / 3,600 | elite |
| crown | the elite crown over an elite foe | 480 / 1,100 | swarm |
| dummy | the lab's debug dummy | the Chorister in grey | swarm |

Looked for and found not to be figures (no model of their own; nothing to redraw): **Tyrant** (bands,
crown sigils and its borrowed telegraphs on the boss's own model, `tyrant.ts`), **Mimicry**
(a gem where an elite's crown would sit, on the foe's own model), **Echoes** (run modifiers),
the **Postlude** (sprites, rings and the orrery on existing batches, `postlude.ts`), **ghosts**
(Save, Rewind and the fall reuse the hero's or Weaver's own batch), affix gems, the Grove's
vines and seeds (sprites and rings).

## Totals
- **41 figures**: 6 heroes, the Weaver (her 5 robes and 4 Thread looks recolour her model in place),
  30 enemies (4 bosses, 3 minibosses, 23 rank-and-file), 2 summons, the elite crown, the lab's dummy.
- **All 41 drawn in stained glass** (Phase 8b). An enemy id added to content without a figure of its
  own is drawn as its role's Choir figure (`models/art/index.ts`: its colours, sized from its
  radius, except a miniboss's Bellwarden at its own size), and `renderArt` fails until it has one.

## Who drew what (Phase 8b)
| family file | figures |
|---|---|
| `heroes.ts`, `weaver.ts` | Kael, Lyra, Vexis, the Weaver (W0); Brann, Seren, Oro (W1) |
| `misc.ts` | the Sapling, the Ancient, the elite crown (W1) |
| `choir.ts` | the Chorister, the Bell Brute, the Bellwarden (W0); the Lamenter, the Glass Lancer, the Mute, the Cantor's Acolyte, the Hollow Cantor (W2) |
| `legion.ts` | all seven (W3) |
| `unstitched.ts` | all nine rank-and-file and the Seamstress (W4) |
| `finale.ts`, `unweaver.ts` | the four mirror voices and the Silent Conductor; the Unweaver (W5) |

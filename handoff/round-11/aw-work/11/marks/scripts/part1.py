IMP = "import { HERO_DRAWN } from './models/artFlag';\n"
IMPD = "import { HERO_DRAWN, drawnHeight } from './models/artFlag';\n"
EDITS = {
 'src/render/models/artFlag.ts': [
  ("export const HERO_DRAWN = 1.12;\n",
   "export const HERO_DRAWN = 1.12;\n\n"
   "/**\n"
   " * The height a figure is drawn at, for a mark placed over its head: its content height times how\n"
   " * large its model is drawn (`ModelBatch.drawn`: HERO_DRAWN for a hero and the Weaver, 1 for an\n"
   " * enemy or a summon). For the marks that sit over heroes and enemies alike (a damage number, the\n"
   " * stun stars): over a hero they keep their clearance over the drawn head, over an enemy they stay\n"
   " * where they were. A record with no model is taken at its own height.\n"
   " */\n"
   "export function drawnHeight(r: { height: number; batch?: { drawn: number } }): number {\n"
   "  return r.height * (r.batch?.drawn ?? 1);\n"
   "}\n"),
 ],
 'src/render/entities.ts': [
  ("import { HERO_DRAWN, HOSTILE_EDGE, HOSTILE_OUTLINE } from './models/artFlag';",
   "import { HERO_DRAWN, HOSTILE_EDGE, HOSTILE_OUTLINE, drawnHeight } from './models/artFlag';"),
  ("      // En garde: two blades crossed over her head (a shape, never the Ward's cyan or silver).\n"
   "      const y = rec.y + rec.height + 0.5 + 0.05 * Math.sin(this.now * 3);",
   "      // En garde: two blades crossed over her head (a shape, never the Ward's cyan or silver).\n"
   "      // Over the drawn head (heroes are drawn HERO_DRAWN tall): the same lift over it as before.\n"
   "      const y = rec.y + rec.height * HERO_DRAWN + 0.5 + 0.05 * Math.sin(this.now * 3);"),
  ("    if (tending(state, e)) {\n      const y = rec.y + rec.height + 0.45 + 0.04 * Math.sin(this.now * 2);",
   "    if (tending(state, e)) {\n      // Over the drawn head, as every mark over a hero is.\n"
   "      const y = rec.y + rec.height * HERO_DRAWN + 0.45 + 0.04 * Math.sin(this.now * 2);"),
  ("      const y = r.y + r.height + 0.95;\n      kit.spritesTop.push(r.x, y, r.z, 0.34, SPRITE.needle, SEREN_VIOLET, 0.95, 0.75);",
   "      // Over her drawn head (the target is Seren: parryGlyph), beside the marks already there.\n"
   "      const y = r.y + r.height * HERO_DRAWN + 0.95;\n      kit.spritesTop.push(r.x, y, r.z, 0.34, SPRITE.needle, SEREN_VIOLET, 0.95, 0.75);"),
  ("    if (!crimsonStatuses(e, look)) return;\n    const x = rec.x;\n    const z = rec.z;\n    const top = rec.height + rec.y;",
   "    if (!crimsonStatuses(e, look)) return;\n    const x = rec.x;\n    const z = rec.z;\n"
   "    // The drawn head (a hero and the Weaver are drawn HERO_DRAWN tall): the pips and the heart keep\n"
   "    // their place over the bar, which is lifted from it too (partyBars.ts).\n"
   "    const top = drawnHeight(rec) + rec.y;"),
  ("  private rift(rec: EntityRec, e: ReadonlyEntity, state: WorldState, kit: FxKit, dt: number): void {\n"
   "    const x = rec.x;\n    const z = rec.z;\n    const top = rec.height + rec.y;",
   "  private rift(rec: EntityRec, e: ReadonlyEntity, state: WorldState, kit: FxKit, dt: number): void {\n"
   "    const x = rec.x;\n    const z = rec.z;\n"
   "    // The drawn head: the mask, the Doom pips and the rune lock are over a hero or the Weaver.\n"
   "    const top = drawnHeight(rec) + rec.y;"),
  ("          x + Math.cos(a) * rec.radius * 0.8,\n          rec.height + 0.15 + rec.y,",
   "          x + Math.cos(a) * rec.radius * 0.8,\n"
   "          // Over the drawn head: a hero's is HERO_DRAWN tall, an enemy's as it was.\n"
   "          drawnHeight(rec) + 0.15 + rec.y,"),
 ],
 'src/render/telegraphs.ts': [
  ("import { BADGE_TONE, type GlyphIcon, type Overlay } from './overlay';\n",
   IMP + "import { BADGE_TONE, type GlyphIcon, type Overlay } from './overlay';\n"),
  ("            r.x,\n            r.height + STATUS_BADGE_LIFT + r.y,",
   "            r.x,\n            // Over the drawn head (heroes are drawn HERO_DRAWN tall), over the pips and the bar.\n"
   "            r.height * HERO_DRAWN + STATUS_BADGE_LIFT + r.y,"),
  ("        r.x,\n        r.height + STATUS_BADGE_LIFT + r.y,",
   "        r.x,\n        r.height * HERO_DRAWN + STATUS_BADGE_LIFT + r.y,"),
 ],
 'src/render/feedback.ts': [
  ("import { HERO_DRAWN } from './models/artFlag';\n", IMPD),
  ("              r.x,\n              r.height + 1.1,\n              r.z,\n              'SNAPPED',",
   "              r.x,\n              r.height * HERO_DRAWN + 1.1,\n              r.z,\n              'SNAPPED',"),
  ("    if (fresh) b.handle = this.d.overlay.spawnNumber(r.x, r.height + 0.35, r.z, colorHex, size);",
   "    // From the drawn head: a hero's is HERO_DRAWN tall, an enemy's as it was.\n"
   "    if (fresh) b.handle = this.d.overlay.spawnNumber(r.x, drawnHeight(r) + 0.35, r.z, colorHex, size);"),
  ("        r.x + 0.35,\n        r.height + 0.2,\n        r.z,\n        cut ? dimHex",
   "        r.x + 0.35,\n        drawnHeight(r) + 0.2,\n        r.z,\n        cut ? dimHex"),
  ("      this.sprite(r.x, r.height + 0.2, r.z, 0.3, 1.2, 0.25, C.goldHot, SPRITE.star, 1);",
   "      this.sprite(r.x, drawnHeight(r) + 0.2, r.z, 0.3, 1.2, 0.25, C.goldHot, SPRITE.star, 1);"),
  ("    this.d.overlay.callout(r.x, r.height + 1.25, r.z, 'PERFECT', '#fff1c4', 28, 1.2);",
   "    // Over the drawn head (heroes and the Weaver are drawn HERO_DRAWN tall).\n"
   "    this.d.overlay.callout(r.x, drawnHeight(r) + 1.25, r.z, 'PERFECT', '#fff1c4', 28, 1.2);"),
  ("    this.d.overlay.callout(x, r.height + 1.7, z, 'SAVED', '#fcd98a', 32, 1.5);",
   "    this.d.overlay.callout(x, r.height * HERO_DRAWN + 1.7, z, 'SAVED', '#fcd98a', 32, 1.5);"),
  ("      r.x,\n      r.height + 1.1,\n      r.z,\n      'REVIVED',",
   "      r.x,\n      r.height * HERO_DRAWN + 1.1,\n      r.z,\n      'REVIVED',"),
  ("      this.sprite(r.x, r.height + 1.1, r.z, 1.3, 1.6, 1.5, C.amp, SPRITE.sigil, 1, e.hero, true);\n"
   "      this.sprite(\n        r.x,\n        r.height + 1.1,",
   "      // The Cue's sigil over the drawn head (heroes are drawn HERO_DRAWN tall).\n"
   "      const top = r.height * HERO_DRAWN + 1.1;\n"
   "      this.sprite(r.x, top, r.z, 1.3, 1.6, 1.5, C.amp, SPRITE.sigil, 1, e.hero, true);\n"
   "      this.sprite(\n        r.x,\n        top,"),
  ("      r.x,\n      r.height + 1.1,\n      r.z,\n      cutLabel(cause),",
   "      r.x,\n      r.height * HERO_DRAWN + 1.1,\n      r.z,\n      cutLabel(cause),"),
  ("      r.x,\n      r.height + 1.2,\n      r.z,\n      'POSSESSED',",
   "      r.x,\n      r.height * HERO_DRAWN + 1.2,\n      r.z,\n      'POSSESSED',"),
  ("      w.x,\n      w.height + 1.3,\n      w.z,\n      'UNRAVEL',",
   "      w.x,\n      w.height * HERO_DRAWN + 1.3,\n      w.z,\n      'UNRAVEL',"),
  ("    const top = r ? r.height + 1.4 : 2.6;", "    const top = r ? r.height * HERO_DRAWN + 1.4 : 2.6;"),
  ("      const y = r.height + r.y + 1.05;\n      const R = 0.26;",
   "      // Over his drawn head, where a call's prompt is (calls.ts).\n"
   "      const y = r.height * HERO_DRAWN + r.y + 1.05;\n      const R = 0.26;"),
 ],
 'src/render/bonds.ts': [
  ("import { C, clamp01, color, rgba } from './palette';\n", IMPD + "import { C, clamp01, color, rgba } from './palette';\n"),
  ("  radius: number;\n  height: number;\n}\n\nexport interface BondsDeps {",
   "  radius: number;\n  height: number;\n  /** How large its model is drawn (a hero's: HERO_DRAWN); absent: as its height says. */\n"
   "  batch?: { drawn: number };\n}\n\nexport interface BondsDeps {"),
  ("    this.d.overlay?.callout(r.x, r.y + r.height + 1.4, r.z, text, TITHE_HEX, 13, 1.0);",
   "    // Over the drawn head (heroes are drawn HERO_DRAWN tall), as every callout over a hero is.\n"
   "    this.d.overlay?.callout(r.x, r.y + r.height * HERO_DRAWN + 1.4, r.z, text, TITHE_HEX, 13, 1.0);"),
  ("    this.callout(m, k.x, k.height + 1.6, k.z, 15);\n    void time;",
   "    // Over the hero's drawn head; over the Sapling, the Ancient or the striker, where it was.\n"
   "    this.callout(m, k.x, drawnHeight(k) + 1.6, k.z, 15);\n    void time;"),
  ("    this.callout(m, k.x, k.height + 1.9, k.z, 22);", "    this.callout(m, k.x, k.height * HERO_DRAWN + 1.9, k.z, 22);"),
  ("    this.callout(m, k.x, k.height + 1.7, k.z, 16);", "    this.callout(m, k.x, k.height * HERO_DRAWN + 1.7, k.z, 16);"),
  ("    this.callout(m, l?.x ?? m.x2, (l?.height ?? m.h) + 1.6, l?.z ?? m.z2, 15);",
   "    this.callout(m, l?.x ?? m.x2, (l?.height ?? m.h) * HERO_DRAWN + 1.6, l?.z ?? m.z2, 15);"),
  ("    this.callout(m, dx, m.h + 1.6, dz, 15);", "    this.callout(m, dx, m.h * HERO_DRAWN + 1.6, dz, 15);"),
  ("    this.callout(m, k.x, k.height + 1.7, k.z, 15);", "    this.callout(m, k.x, k.height * HERO_DRAWN + 1.7, k.z, 15);"),
  ("    this.callout(m, k.x, k.height + 1.8, k.z, 17);", "    this.callout(m, k.x, k.height * HERO_DRAWN + 1.8, k.z, 17);"),
  ("    // Over his head, his oath: a diamond in a ring.\n"
   "    kit.sprites.push(r.x, r.height + 0.95, r.z, 0.52, SPRITE.ring, col, 0.75 * a);\n"
   "    kit.sprites.push(r.x, r.height + 0.95, r.z, 0.24, SPRITE.diamond, col, 0.95 * a);",
   "    // Over his head, his oath: a diamond in a ring (the drawn head: heroes are HERO_DRAWN tall).\n"
   "    const top = r.height * HERO_DRAWN + 0.95;\n"
   "    kit.sprites.push(r.x, top, r.z, 0.52, SPRITE.ring, col, 0.75 * a);\n"
   "    kit.sprites.push(r.x, top, r.z, 0.24, SPRITE.diamond, col, 0.95 * a);"),
  ("    const y = r.height + 0.95;\n    kit.sprites.push(r.x, y, r.z, 0.58, SPRITE.timer, col, 0.9 * a, 0, 1, frac);",
   "    const y = r.height * HERO_DRAWN + 0.95;\n    kit.sprites.push(r.x, y, r.z, 0.58, SPRITE.timer, col, 0.9 * a, 0, 1, frac);"),
 ],
 'src/render/relics.ts': [
  ("import { C, VISION_HEX, approach, clamp01, color } from './palette';\n",
   IMP + "import { C, VISION_HEX, approach, clamp01, color } from './palette';\n"),
  ("      h.x,\n      h.height + 1.85,\n      h.z,\n      'THIMBLE',", "      h.x,\n      h.height * HERO_DRAWN + 1.85,\n      h.z,\n      'THIMBLE',"),
  ("    this.callout(m, 2, bx, w.height + 1.9, bz, 'VEIL',", "    this.callout(m, 2, bx, w.height * HERO_DRAWN + 1.9, bz, 'VEIL',"),
  ("    out.y = w.y + w.height + 0.42;", "    // Over her drawn head (the Weaver is drawn HERO_DRAWN tall): the same lift over it as before.\n    out.y = w.y + w.height * HERO_DRAWN + 0.42;"),
  ("      h.x,\n      h.height + 2,\n      h.z,\n      'METRONOME',", "      h.x,\n      h.height * HERO_DRAWN + 2,\n      h.z,\n      'METRONOME',"),
  ("    const top = h.y + h.height + 0.32;", "    // Over the drawn head (heroes are drawn HERO_DRAWN tall): the same clearance as before.\n    const top = h.y + h.height * HERO_DRAWN + 0.32;"),
  ("          h.x,\n          h.height + 2.35,\n          h.z,\n          'GLASS HALO',", "          h.x,\n          h.height * HERO_DRAWN + 2.35,\n          h.z,\n          'GLASS HALO',"),
  ("      w.x,\n      w.height + 1.5,\n      w.z,\n      cueReady(state)", "      w.x,\n      w.height * HERO_DRAWN + 1.5,\n      w.z,\n      cueReady(state)"),
  ("      const y = w.y + w.height + 2 - 2 * t * t;", "      // …onto her drawn head.\n      const y = w.y + w.height * HERO_DRAWN + 2 - 2 * t * t;"),
  ("        w.x,\n        w.height + 1.1,\n        w.z,\n        'NO GLIDE',", "        w.x,\n        w.height * HERO_DRAWN + 1.1,\n        w.z,\n        'NO GLIDE',"),
 ],
 'src/render/serenCues.ts': [
  ("import { C, clamp01, color } from './palette';\n", IMP + "import { C, clamp01, color } from './palette';\n"),
  ("        r.x,\n        r.y + r.height + 1.1,\n        r.z,\n        PARRIED_TEXT,", "        r.x,\n        r.y + r.height * HERO_DRAWN + 1.1,\n        r.z,\n        PARRIED_TEXT,"),
  ("        at.x,\n        at.y + at.height + 1.3,", "        at.x,\n        // Over her quarry as it was; over Seren herself (no quarry drawn), her drawn head.\n        at.y + at.height * (t ? 1 : HERO_DRAWN) + 1.3,"),
 ],
 'src/render/groveCues.ts': [
  ("import { clamp01, color } from './palette';\n", "import { HERO_DRAWN } from './models/artFlag';\nimport { clamp01, color } from './palette';\n"),
  ("          r.x,\n          r.y + r.height + 0.55,\n          r.z,\n          0.36 + 0.12 * f,", "          r.x,\n          r.y + r.height * HERO_DRAWN + 0.55,\n          r.z,\n          0.36 + 0.12 * f,"),
 ],
 'src/render/variants.ts': [
  ("import { C, clamp01, color, rgba, threadColor } from './palette';\n", IMP + "import { C, clamp01, color, rgba, threadColor } from './palette';\n"),
  ("      // Alone, its seconds over the hero's head.\n      const y = ra.y + ra.height + 0.55;", "      // Alone, its seconds over the hero's head (the drawn head: heroes are HERO_DRAWN tall).\n      const y = ra.y + ra.height * HERO_DRAWN + 0.55;"),
 ],
 'src/render/crucibleCues.ts': [
  ("import { C, clamp01, color, rgba } from './palette';\n", IMP + "import { C, clamp01, color, rgba } from './palette';\n"),
  ("    const y = r.height + 0.4 + r.y;\n    orreryTop(", "    // From over the drawn head (a hero and the Weaver are drawn HERO_DRAWN tall).\n    const y = r.height * HERO_DRAWN + 0.4 + r.y;\n    orreryTop("),
 ],
}

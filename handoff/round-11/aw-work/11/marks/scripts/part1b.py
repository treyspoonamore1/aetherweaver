EDITS = {
 'src/render/fill.ts': [
  ("import { C, clamp01 } from './palette';\n", "import { drawnHeight } from './models/artFlag';\nimport { C, clamp01 } from './palette';\n"),
  ("  radius: number;\n  height: number;\n}\n\n/** What FillView needs of the Thread",
   "  radius: number;\n  height: number;\n  /** How large its model is drawn (a hero's: HERO_DRAWN); absent: as its height says. */\n"
   "  batch?: { drawn: number };\n}\n\n/** What FillView needs of the Thread"),
  ("  z: number;\n  h: number;\n  r: number;\n  /** A bite's place",
   "  z: number;\n  h: number;\n  /** Its target's drawn height: what a mark over its head is lifted from (a hero's: HERO_DRAWN). */\n"
   "  top: number;\n  r: number;\n  /** A bite's place"),
  ("          h: 1.5,\n", "          h: 1.5,\n          top: 1.5,\n"),
  ("    m.h = r?.height ?? 1.5;\n", "    m.h = r?.height ?? 1.5;\n    m.top = r ? drawnHeight(r) : 1.5;\n"),
  ("        m.h = r.height;\n", "        m.h = r.height;\n        m.top = drawnHeight(r);\n"),
  ("          m.h + 0.75 - 0.25 * drop,", "          m.top + 0.75 - 0.25 * drop,"),
  ("            m.h + 0.3,", "            m.top + 0.3,"),
  ("        const y = m.h + 0.75;", "        const y = m.top + 0.75;"),
  ("          m.h + 0.45,", "          m.top + 0.45,"),
  ("        kit.sprites.push(m.x, m.h + 0.4, m.z, 0.3, SPRITE.star, col, 0.85 * fade, t * 3);",
   "        kit.sprites.push(m.x, m.top + 0.4, m.z, 0.3, SPRITE.star, col, 0.85 * fade, t * 3);"),
  ("    const y = m.h + 0.8;\n    this.callout(m, 'water_clock'", "    const y = m.top + 0.8;\n    this.callout(m, 'water_clock'"),
 ],
}

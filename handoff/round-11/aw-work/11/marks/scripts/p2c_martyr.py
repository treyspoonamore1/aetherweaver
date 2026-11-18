IMP = "import { HERO_DRAWN } from './models/artFlag';\n"
EDITS = {
 'src/render/martyr.ts': [
  ("import { C, approach, clamp01, color } from './palette';\n", IMP + "import { C, approach, clamp01, color } from './palette';\n"),
  ("      const sy = r.y + r.height + 0.72 + Math.sin(time * 1.8 + slot) * 0.03;",
   "      // Over the drawn head (heroes are drawn HERO_DRAWN tall): the same lift over it as before.\n      const sy = r.y + r.height * HERO_DRAWN + 0.72 + Math.sin(time * 1.8 + slot) * 0.03;"),
  ("      const y = w.y + w.height + 0.42 + Math.sin(time * 1.5) * 0.03;",
   "      const y = w.y + w.height * HERO_DRAWN + 0.42 + Math.sin(time * 1.5) * 0.03;"),
  ("          r.x,\n          r.y + r.height + 0.7,\n          r.z,\n          8,", "          r.x,\n          r.y + r.height * HERO_DRAWN + 0.7,\n          r.z,\n          8,"),
  ("          r.x,\n          r.y + r.height + 0.7,\n          r.z,\n          6,", "          r.x,\n          r.y + r.height * HERO_DRAWN + 0.7,\n          r.z,\n          6,"),
  ("          r.x,\n          r.y + r.height + 0.72,\n          r.z,\n          10,", "          r.x,\n          r.y + r.height * HERO_DRAWN + 0.72,\n          r.z,\n          10,"),
  ("        w.x,\n        w.y + w.height + 1.2,\n        w.z,\n        'UNDYING',", "        w.x,\n        w.y + w.height * HERO_DRAWN + 1.2,\n        w.z,\n        'UNDYING',"),
 ],
}

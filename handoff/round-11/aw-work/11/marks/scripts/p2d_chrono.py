IMP = "import { HERO_DRAWN } from './models/artFlag';\n"
EDITS = {
 'src/render/chrono.ts': [
  ("import { C, approach, clamp01, color } from './palette';\n", IMP + "import { C, approach, clamp01, color } from './palette';\n"),
  ("    const y = w.y + w.height + 0.75;\n    const a = 1 - seg(m.age, m.life * 0.6, m.life);",
   "    // Over her drawn head (the Weaver is drawn HERO_DRAWN tall): the same lift over it as before.\n    const y = w.y + w.height * HERO_DRAWN + 0.75;\n    const a = 1 - seg(m.age, m.life * 0.6, m.life);"),
  ("      w.x,\n      w.y + w.height + 1.7,\n      w.z,\n      0.8,\n      SPRITE.clock,", "      w.x,\n      w.y + w.height * HERO_DRAWN + 1.7,\n      w.z,\n      0.8,\n      SPRITE.clock,"),
 ],
}

EDITS = {
 'src/render/telegraphs.ts': [
  ("import { HERO_DRAWN } from './models/artFlag';\n", "import { HERO_DRAWN, drawnHeight } from './models/artFlag';\n"),
  ("          rec.a = target.height;\n          rec.b = target.radius;",
   "          // The drawn head (a hero's is HERO_DRAWN tall): the mark, Doom's pips round it and its\n          // answer badge keep their lift over it.\n          rec.a = drawnHeight(target);\n          rec.b = target.radius;"),
  ("          this.drawMark(h.x, h.z, h.height, h.radius, kit, prog, perfect, sev, flash, alpha, frost);",
   "          const top = h.height * HERO_DRAWN;\n          this.drawMark(h.x, h.z, top, h.radius, kit, prog, perfect, sev, flash, alpha, frost);"),
 ],
 'src/render/chrono.ts': [
  ("import { HERO_DRAWN } from './models/artFlag';\n", "import { HERO_DRAWN, drawnHeight } from './models/artFlag';\n"),
  ("  radius: number;\n  height: number;\n  /** Held by Stasis (entities.ts), 0..1. */",
   "  radius: number;\n  height: number;\n  /** How large its model is drawn (a hero's: HERO_DRAWN); absent: as its height says. */\n  batch?: { drawn: number };\n  /** Held by Stasis (entities.ts), 0..1. */"),
  ("        const h = r ? r.height : g.a;", "        // Where the attack's own mark will be (telegraphs.ts: over the drawn head).\n        const h = r ? drawnHeight(r) : g.a;"),
  ("      const sy = (r ? r.height : s.a) + 0.75;", "      const sy = (r ? drawnHeight(r) : s.a) + 0.75;"),
 ],
}

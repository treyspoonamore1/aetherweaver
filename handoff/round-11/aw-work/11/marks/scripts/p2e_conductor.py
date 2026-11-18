IMP = "import { HERO_DRAWN } from './models/artFlag';\n"
EDITS = {
 'src/render/conduct.ts': [
  ("import { C, clamp01, color } from './palette';\n", IMP + "import { C, clamp01, color } from './palette';\n"),
  ("    out.y = r.height + SIGIL_UP;", "    // Over the drawn head (heroes are drawn HERO_DRAWN tall): the same lift over it as before.\n    out.y = r.height * HERO_DRAWN + SIGIL_UP;"),
  ("      const y = r.height + 0.55;\n      const z = r.z;\n      const s = 0.26;", "      const y = r.height * HERO_DRAWN + 0.55;\n      const z = r.z;\n      const s = 0.26;"),
  ("        const top = r.height + 3.4;", "        const top = r.height * HERO_DRAWN + 3.4;"),
 ],
}

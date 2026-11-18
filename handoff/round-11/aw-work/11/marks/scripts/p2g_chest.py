EDITS = {
 'src/render/fermata.ts': [
  ("      const cy = hr.height * 0.5 + hr.y;",
   "      // The middle of the drawn body (heroes are drawn HERO_DRAWN tall); the shell's size is kept.\n      const cy = hr.height * HERO_DRAWN * 0.5 + hr.y;"),
 ],
 'src/render/field.ts': [
  ("      hr.x,\n      hr.height * 0.55 + hr.y,\n      hr.z,\n      hr.radius * (2.2 + 0.6 * level) * k,",
   "      hr.x,\n      hr.height * HERO_DRAWN * 0.55 + hr.y,\n      hr.z,\n      hr.radius * (2.2 + 0.6 * level) * k,"),
 ],
 'src/render/thread.ts': [
  ("      tr.x,\n      tr.height * 0.55 + tr.y,\n      tr.z,\n      tr.radius * (2.6 + 1.6 * u),",
   "      tr.x,\n      tr.height * HERO_DRAWN * 0.55 + tr.y,\n      tr.z,\n      tr.radius * (2.6 + 1.6 * u),"),
  ("      const y = tr.height * 0.55 + tr.y;", "      const y = tr.height * HERO_DRAWN * 0.55 + tr.y;"),
 ],
 'src/render/martyr.ts': [
  ("    const wy = w.y + w.height * 0.62;\n    for (let slot = 0;", "    const wy = w.y + w.height * HERO_DRAWN * 0.62;\n    for (let slot = 0;"),
  ("      kit.beams.push(\n        r.x,\n        r.y + r.height * 0.6,\n        r.z,\n        w.x,\n        wy,",
   "      kit.beams.push(\n        r.x,\n        r.y + r.height * HERO_DRAWN * 0.6,\n        r.z,\n        w.x,\n        wy,", 2),
 ],
 'src/render/feedback.ts': [
  ("    const cy = r.height * 0.58 + r.y;", "    const cy = r.height * HERO_DRAWN * 0.58 + r.y;"),
  ("      if (r) this.beam(w.x, 1.1, w.z, r.x, r.height * 0.5, r.z, 0.3, 0.2, C.shield, BEAM.glow, 0.9);",
   "      if (r)\n        this.beam(w.x, 1.1, w.z, r.x, drawnHeight(r) * 0.5, r.z, 0.3, 0.2, C.shield, BEAM.glow, 0.9);"),
 ],
}

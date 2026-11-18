EDITS = {
 'src/render/calling.ts': [
  ("    const top = r.y + r.height;\n    const col = S > 0.5 ? SUN_HOT : SUN;",
   "    // The drawn head (heroes are drawn HERO_DRAWN tall): the shaft starts as far over it as before.\n    const top = r.y + r.height * HERO_DRAWN;\n    const col = S > 0.5 ? SUN_HOT : SUN;"),
  ("    const y = w.y + w.height + 0.32;\n    kit.rings.push(w.x, y, w.z, 0.38, 0.05, 0.12, RING.plain, C.goldHot, 0.75 * k);",
   "    // Over her drawn head (the Weaver is drawn HERO_DRAWN tall): the same clearance as before.\n    const y = w.y + w.height * HERO_DRAWN + 0.32;\n    kit.rings.push(w.x, y, w.z, 0.38, 0.05, 0.12, RING.plain, C.goldHot, 0.75 * k);"),
  ("        r.x,\n        r.y + r.height + 0.75,\n        r.z,\n        `${SUN_GLYPH}",
   "        r.x,\n        r.y + r.height * HERO_DRAWN + 0.75,\n        r.z,\n        `${SUN_GLYPH}"),
 ],
}

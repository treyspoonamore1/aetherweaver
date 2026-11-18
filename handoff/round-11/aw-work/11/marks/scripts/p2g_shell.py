EDITS = {
 'src/render/fermata.ts': [
  ("      const cy = hr.height * 0.5 + hr.y;",
   "      // The middle of the drawn body (heroes are drawn HERO_DRAWN tall); the shell's size is kept.\n      const cy = hr.height * HERO_DRAWN * 0.5 + hr.y;"),
 ],
}

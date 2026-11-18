EDITS = {
 'src/render/thread.ts': [
  ("        tr.x,\n        tr.height + 1.25 + tr.y,",
   "        tr.x,\n        // Over the drawn head (heroes are drawn HERO_DRAWN tall): the same lift over it as before.\n        tr.height * HERO_DRAWN + 1.25 + tr.y,"),
 ],
}

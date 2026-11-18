EDITS = {
 'src/render/serenCues.ts': [
  ("export const SEREN_HEX = {",
   "/**\n * How far over Seren's drawn head her en garde blades cross (m). Over the health bar, which sits\n * at 0.42 (partyBars.ts BAR_LIFT) and is about 0.35 m tall at the game camera: at their first\n * lift, 0.5, the bar lay across them.\n */\nexport const GARDE_LIFT = 0.85;\n\nexport const SEREN_HEX = {"),
 ],
 'src/render/groveCues.ts': [
  ("export const GROVE_HEX = {",
   "/**\n * How far over Oro's drawn head his tending drop sits, and the closed leaf that flares there when\n * he refuses (m). Over the health bar, which sits at 0.42 (partyBars.ts BAR_LIFT) and is about\n * 0.35 m tall at the game camera: at their first lifts, 0.45 and 0.55, the bar lay across them.\n */\nexport const TEND_LIFT = 0.8;\n\nexport const GROVE_HEX = {"),
  ("          r.y + r.height * HERO_DRAWN + 0.55,\n          r.z,\n          0.36 + 0.12 * f,", "          r.y + r.height * HERO_DRAWN + TEND_LIFT,\n          r.z,\n          0.36 + 0.12 * f,"),
 ],
 'src/render/entities.ts': [
  ("      // Over the drawn head (heroes are drawn HERO_DRAWN tall): the same lift over it as before.\n      const y = rec.y + rec.height * HERO_DRAWN + 0.5 + 0.05 * Math.sin(this.now * 3);",
   "      // Over the drawn head (heroes are drawn HERO_DRAWN tall), clear of the health bar.\n      const y = rec.y + rec.height * HERO_DRAWN + GARDE_LIFT + 0.05 * Math.sin(this.now * 3);"),
  ("      // Over the drawn head, as every mark over a hero is.\n      const y = rec.y + rec.height * HERO_DRAWN + 0.45 + 0.04 * Math.sin(this.now * 2);",
   "      // Over the drawn head, as every mark over a hero is, clear of the health bar.\n      const y = rec.y + rec.height * HERO_DRAWN + TEND_LIFT + 0.04 * Math.sin(this.now * 2);"),
  ("  SEREN_FLASH,\n", "  GARDE_LIFT,\n  SEREN_FLASH,\n"),
  ("  tending,\n", "  TEND_LIFT,\n  tending,\n"),
 ],
}

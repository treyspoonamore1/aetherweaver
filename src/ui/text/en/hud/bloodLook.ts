import type { Catalogue } from '../../catalogue';

/** The `hud.bloodLook.*` messages: `src/ui/hud/bloodLook.ts`. */
export const bloodLook = {
  'hud.bloodLook.bloodlustBelowItHe':
    '{round}%: Bloodlust — below it he won’t Rally, and Blood Rage runs hot',
  'hud.bloodLook.berserkerSHymnEvery': 'Berserker’s Hymn — every hero hits harder',
  'hud.bloodLook.bloodAndSilkEmpower': 'Blood and Silk — Empower him for Resonance',
  'hud.bloodLook.criticalWardHimNow': '{round}%: critical — Ward him now',
  'hud.bloodLook.deathlessOnceAFight': '{round}%: Deathless — once a fight, he can’t die',
  'hud.bloodLook.deathless': 'Deathless',
  'hud.bloodLook.deathlessCanTDrop': 'Deathless: {name} can’t drop below 1 life while it lasts',
  'hud.bloodLook.bloodlustNoRally': 'Bloodlust · no Rally',
  'hud.bloodLook.bloodlustWonTCome':
    'Bloodlust: {name} won’t come back for a Rally. Ward him (Iron Will) or Reel him',
  'hud.bloodLook.bloodRageHitsHarder':
    'Blood Rage: {name} hits {rageLabel} harder, the lower his life',
  'hud.bloodLook.bloodlet': 'Bloodlet ×{bled}',
  'hud.bloodLook.bloodlettingHisNextHarder':
    'Bloodletting: his next {value} harder, all round him. The life he spent isn’t damage',
  'hud.bloodLook.swingHits': 'swing hits',
  'hud.bloodLook.swingsHit': '{bled} swings hit',
  'hud.bloodLook.oath': 'Oath +{oath}',
  'hud.bloodLook.bloodOathYourOverheal':
    'Blood Oath: your overheal rides on his next swing (+{oath})',
  'hud.bloodLook.tithe': 'Tithe',
  'hud.bloodLook.bloodTitheYourWard':
    'Blood Tithe: your Ward on him is stronger, and gives back Spirit when it breaks',
} satisfies Catalogue;

/**
 * Bonds (docs/phase-4e.md): the heroes growing with you. Bond XP from every fight they share
 * with you, most from your support of them; talents at Bond ranks 3, 6 and 9 (one of two), an
 * alternate Solo at 10, and two scenes each, offered at Respites.
 */
import type { ContentInput } from './schema';

export const BOND_RULES: ContentInput['bondRules'] = {
  // Cumulative Bond XP for ranks 1–10.
  ranks: [0, 80, 220, 420, 680, 1000, 1380, 1820, 2320, 2900],
  // Per fight, for each hero in it: kind × (base + pool × their share of your support).
  base: 12,
  pool: 30,
  kinds: { skirmish: 1, elite: 1.5, miniboss: 2, boss: 3 },
  loss: 0.5,
  talentRanks: [3, 6, 9],
  soloRank: 10,
  // A scene pays this share of the XP between its rank and the next.
  scene: 0.4,
};

export const TALENTS: ContentInput['talents'] = [
  // ── Kael: Glory Hound as a tool, his shield as the party's ─────────────────────────
  {
    id: 'steady_vanguard',
    hero: 'kael',
    tier: 1,
    name: 'Steady Vanguard',
    values: {},
    text: 'Glory Hound waits for your Focus: when a new pack arrives, Kael charges only if you’ve set a Focus, and charges that enemy.',
  },
  {
    id: 'vanguards_roar',
    hero: 'kael',
    tier: 1,
    name: 'Vanguard’s Roar',
    values: { radius: 8, seconds: 4 },
    text: 'When Glory Hound sends Kael charging, everything within {radius} m of his quarry turns on him for {seconds} s.',
  },
  {
    id: 'riposte_bash',
    hero: 'kael',
    tier: 2,
    name: 'Riposte Bash',
    values: { range: 6, pct: 50, seconds: 6 },
    text: 'When a Ward on Kael takes a blow, he answers with Shield Bash at the attacker, if it’s within {range} m, whatever its cooldown (once every {seconds} s). A Perfect Ward does every time, and sends back {pct}% of the blow.',
  },
  {
    id: 'bulwark_of_faith',
    hero: 'kael',
    tier: 2,
    name: 'Bulwark of Faith',
    values: { pct: 15 },
    text: 'While you Thread him, Kael is healed {pct}% more.',
  },
  {
    id: 'unbreakable',
    hero: 'kael',
    tier: 3,
    name: 'Unbreakable',
    values: { seconds: 1 },
    text: 'Once a fight, a blow that would down Kael leaves him at 1 life, untouchable for {seconds} s.',
  },
  {
    id: 'shieldbearer',
    hero: 'kael',
    tier: 3,
    name: 'Shieldbearer',
    values: { radius: 10, pct: 75, below: 30 },
    text: 'Uncued, Aegis Wall also shields every hero within {radius} m of Kael with {pct}% of his barrier. He raises it himself when one of them falls below {below}% of their life.',
  },
  // ── Lyra: alone and alive, or bound to your Thread and field ───────────────────────
  {
    id: 'wind_step',
    hero: 'lyra',
    tier: 1,
    name: 'Wind Step',
    values: { seconds: 6 },
    text: 'Every {seconds} s, Lyra steps out of the first attack aimed at her, even mid-shot, and keeps shooting.',
  },
  {
    id: 'hawk_eye',
    hero: 'lyra',
    tier: 1,
    name: 'Hawk Eye',
    values: { range: 2, resonance: 1 },
    text: 'Lyra shoots from {range} m farther, and her Empowered crits give you {resonance} Resonance.',
  },
  {
    id: 'ricochet',
    hero: 'lyra',
    tier: 2,
    name: 'Ricochet',
    values: { pct: 20 },
    text: 'Lyra’s arrows bounce once, to another enemy inside your field, at {pct}% damage.',
  },
  {
    id: 'hunters_mark',
    hero: 'lyra',
    tier: 2,
    name: 'Hunter’s Mark',
    values: { pct: 20 },
    text: 'The enemy you Focus takes {pct}% more damage from every hero while Lyra stands.',
  },
  {
    id: 'storm_queen',
    hero: 'lyra',
    tier: 3,
    name: 'Storm Queen',
    values: { pct: 50 },
    text: 'During Gale Barrage, the hero you Thread (if it isn’t Lyra) looses an arrow with each of hers, at {pct}% damage.',
  },
  {
    id: 'last_light',
    hero: 'lyra',
    tier: 3,
    name: 'Last Light',
    values: { below: 40, pct: 60 },
    text: 'Below {below}% of her life, Lyra attacks {pct}% faster.',
  },
  // ── Vexis: commitment that pays, or spells carried along your Thread and field ─────
  {
    id: 'arcane_ward',
    hero: 'vexis',
    tier: 1,
    name: 'Arcane Ward',
    values: { metres: 6, seconds: 12 },
    text: 'When an enemy strikes Vexis up close, she blinks {metres} m away from it (once every {seconds} s).',
  },
  {
    id: 'overchannel',
    hero: 'vexis',
    tier: 1,
    name: 'Overchannel',
    values: { damage: 40, cast: 10 },
    text: 'Starbolt deals {damage}% more damage and takes {cast}% longer to cast.',
  },
  {
    id: 'starthread',
    hero: 'vexis',
    tier: 2,
    name: 'Starthread',
    values: { pct: 15 },
    text: 'Starbolt also strikes the enemy nearest the hero you Thread (if it isn’t Vexis), at {pct}% damage.',
  },
  {
    id: 'event_horizon',
    hero: 'vexis',
    tier: 2,
    name: 'Event Horizon',
    values: { radius: 2 },
    text: 'Gravity Well reaches {radius} m farther, and pulls the enemies it catches into your field.',
  },
  {
    id: 'supernova',
    hero: 'vexis',
    tier: 3,
    name: 'Supernova',
    values: { radius: 6, meteors: 5 },
    text: 'Starfall ends in a nova: every enemy within {radius} m of its last meteor takes {meteors} meteors’ damage.',
  },
  {
    id: 'constellation',
    hero: 'vexis',
    tier: 3,
    name: 'Constellation',
    values: { interval: 1.5, seconds: 6 },
    text: 'Each Cue leaves a star where the hero stands, casting Vexis’s arcane bolt at the nearest enemy every {interval} s for {seconds} s.',
  },
];

export const ALT_SOLOS: ContentInput['altSolos'] = [
  {
    id: 'oathkeeper',
    hero: 'kael',
    name: 'Oathkeeper',
    chargeTime: 25,
    values: { seconds: 6, radius: 9, pct: 40, cuedRadius: 12, cuedPct: 25, guard: 30 },
    text: 'For {seconds} s, hits on you and on the heroes within {radius} m of Kael land on him instead, at {pct}%, and he takes {guard}% less of everything. Keep him standing.',
    cuedText: 'Cued: within {cuedRadius} m, and he takes {cuedPct}%.',
  },
  {
    id: 'hawks_vigil',
    hero: 'lyra',
    name: 'Hawk’s Vigil',
    chargeTime: 25,
    // `power`: each shot, in her basic attacks.
    values: { seconds: 6, power: 8, pct: 25, mark: 4 },
    text: 'For {seconds} s, Lyra holds still and shoots every enemy that starts an attack within her range, once each, as hard as {power} of her arrows. A cast she can interrupt is interrupted.',
    cuedText:
      'Cued: she can move, and each shot marks its target to take {pct}% more damage for {mark} s.',
  },
  {
    id: 'celestial_sphere',
    hero: 'vexis',
    name: 'Celestial Sphere',
    chargeTime: 25,
    values: { seconds: 5, hits: 2 },
    text: 'For {seconds} s, a sphere around the hero you Thread swallows the next {hits} hits on them, whole, telegraphs included. Choose whom you Thread.',
    cuedText: 'Cued: every hero in your field gets a sphere of {hits} hits.',
  },
];

export const SCENES: ContentInput['scenes'] = [
  {
    id: 'kael_dented_shield',
    hero: 'kael',
    rank: 2,
    title: 'The Dented Shield',
    lines: [
      {
        speaker: 'narration',
        text: 'Kael sits by the fire, hammering a dent out of his shield. He doesn’t look up.',
      },
      {
        speaker: 'hero',
        text: 'The Order of the Bell swore me to this shield at sixteen. Every oath I have, I made to them.',
      },
      {
        speaker: 'hero',
        text: 'Then the silence reached the chapterhouse, and the bells stopped. All of them, in one night.',
      },
      {
        speaker: 'hero',
        text: 'I keep my oaths. But to whom, now? A knight no one needs is just a man holding a door shut.',
      },
    ],
    replies: [
      {
        text: 'You’re needed here.',
        response:
          '“…Here.” He sets the shield down, and for once his shoulders come down with it. “Then I’ll hold this door.”',
      },
      {
        text: 'Swear one to yourself.',
        response:
          'He laughs, short and surprised. “That’s not how oaths work.” A pause. “…I’ll think on it.”',
      },
    ],
  },
  {
    id: 'kael_unbidden',
    hero: 'kael',
    rank: 7,
    title: 'Unbidden',
    lines: [
      {
        speaker: 'narration',
        text: 'Kael finds you at the edge of the firelight, his armour still scored from the last fight.',
      },
      { speaker: 'hero', text: 'When a new pack comes, I run at the biggest one. You’ve seen it.' },
      {
        speaker: 'hero',
        text: 'It isn’t courage. If I’m in front, someone has to need me. The Order taught me that, and it was a lie.',
      },
      {
        speaker: 'hero',
        text: 'So. If I run again, call me back. I’ll hear you. I always hear you.',
      },
    ],
    replies: [
      {
        text: 'I’ll call you back.',
        response:
          '“Good.” He nods, as if he’s set a weight down somewhere he can find it again. “Then I won’t run alone.”',
      },
      {
        text: 'Run. I’ll hold the line behind you.',
        response:
          'He stares, then grins. “A knight with a rearguard. The Order would have had a fit.” He sounds glad of it.',
      },
    ],
  },
  {
    id: 'lyra_tailwind',
    hero: 'lyra',
    rank: 2,
    title: 'Tailwind',
    lines: [
      {
        speaker: 'narration',
        text: 'Lyra is perched on a broken pillar, restringing her bow by feel.',
      },
      {
        speaker: 'hero',
        text: 'Windrunners fly in pairs. You hold the wind for your partner, and they hold it for you.',
      },
      {
        speaker: 'hero',
        text: 'Mine flew on without me. A storm came in, and she chose the sky. I’d have done the same. Probably.',
      },
      { speaker: 'hero', text: 'Your Thread pulls at me in a fight. I hate it.' },
      { speaker: 'narration', text: 'She tests the string.' },
      { speaker: 'hero', text: 'It’s also the only reason I’m still up here.' },
    ],
    replies: [
      {
        text: 'It won’t pull you down.',
        response:
          '“Everything pulls you down, sooner or later.” She almost smiles. “But I’ll grant you this: so far, it’s pulled me up.”',
      },
      {
        text: 'Then trust the pull.',
        response:
          '“Trust.” She says it like a word in another language. “Ask me again after the next storm.”',
      },
    ],
  },
  {
    id: 'lyra_two_fletchings',
    hero: 'lyra',
    rank: 7,
    title: 'Two Fletchings',
    lines: [
      {
        speaker: 'narration',
        text: 'Lyra sits down beside you without being asked, which is new.',
      },
      { speaker: 'hero', text: 'Here.' },
      { speaker: 'narration', text: 'She presses a grey fletching into your hand.' },
      {
        speaker: 'hero',
        text: 'From my first arrow. Windrunners give the other half to their partner.',
      },
      {
        speaker: 'hero',
        text: 'I’m not saying anything by it. Only: if the Thread ever snaps in a fight, I’ll look at mine and know you didn’t let go.',
      },
    ],
    replies: [
      {
        text: 'I won’t let go.',
        response: '“I know.” She looks away, fast. “That’s the annoying part.”',
      },
      {
        text: 'Then keep yours close.',
        response:
          '“Always have.” She taps her quiver. “Couldn’t throw it away. Couldn’t think why, until now.”',
      },
    ],
  },
  {
    id: 'vexis_margins',
    hero: 'vexis',
    rank: 2,
    title: 'Margins',
    lines: [
      {
        speaker: 'narration',
        text: 'Vexis has a star chart spread across her knees, its margins black with figures.',
      },
      {
        speaker: 'hero',
        text: 'I’ve been timing your Wards. Forty-one of them. If the song is a function, your Wards are its derivative.',
      },
      {
        speaker: 'hero',
        text: 'And yet I can’t predict the next one. The error isn’t in the figures. I checked them twice. Three times.',
      },
      {
        speaker: 'hero',
        text: 'Either the song can’t be solved, or you aren’t playing it. Both are deeply irritating.',
      },
    ],
    replies: [
      {
        text: 'I listen. I don’t count.',
        response:
          '“Listening.” She writes it down, then crosses it out. “That isn’t a method.” A pause. “It works, though. Annoyingly.”',
      },
      {
        text: 'Maybe you need more data.',
        response:
          '“Yes. Obviously.” She brightens at once. “Ward slower in the next fight. No — normally. Forget I spoke.”',
      },
    ],
  },
  {
    id: 'vexis_unsolved_term',
    hero: 'vexis',
    rank: 7,
    title: 'The Unsolved Term',
    lines: [
      {
        speaker: 'narration',
        text: 'Vexis turns her chart toward you. Every star on it is joined to another, except for one blank space at the centre.',
      },
      {
        speaker: 'hero',
        text: 'The whole song, reduced. Every enemy, every wind-up, every hero’s habit. It closes. Except here.',
      },
      { speaker: 'hero', text: 'That term is you. I’ve tried for weeks. You won’t reduce.' },
      {
        speaker: 'hero',
        text: 'My teachers said a thing you can’t solve is a thing you don’t understand yet. I’m beginning to think some things are meant to be trusted instead.',
      },
    ],
    replies: [
      {
        text: 'Leave the space blank.',
        response:
          'She considers it, then rolls the chart up with the space still empty. “A known unknown. Very well. I can live beside one.”',
      },
      {
        text: 'Draw me in anyway.',
        response:
          '“In what ink?” But she takes out her pen and draws a small, careful star in the gap, and doesn’t join it to anything.',
      },
    ],
  },
];

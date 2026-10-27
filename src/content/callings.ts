import type { ContentInput } from './schema';

/**
 * Callings (docs/phase-3c.md): the Weaver's class for a run, chosen in Prep. `values` are in
 * the units the text shows (4 = 4%, 8 = 8 s); the sim's Calling resolver (sim/mods.ts) knows
 * what each id means.
 */
export const CALLINGS: ContentInput['callings'] = [
  {
    id: 'luminary',
    name: 'Luminary',
    title: 'the aura sovereign',
    summary: 'Heroes in your field shine: every aura they hear makes their hits brighter.',
    text: 'Radiance: heroes standing in your field shine, dealing {radiance}% more damage for every aura they hear. Your field song reaches {reach}% farther.',
    crescendo: 'Sunrise burns brighter: Radiance is ×{sunrise} while it lasts.',
    flavor: 'Stand where the light is. Bring them into it.',
    values: { radiance: 4, reach: 15, sunrise: 3 },
    unlockRank: 7,
    icon: 'luminary',
    tiers: [
      {
        options: [
          {
            id: 'haloed',
            name: 'Haloed',
            text: 'Heroes in your field take {pct}% less damage from ordinary hits. The big hits you see coming still need your Ward.',
            values: { pct: 8 },
            icon: 'halo_ring',
          },
          {
            id: 'wide_choir',
            name: 'Wide Choir',
            text: 'Your field song reaches {pct}% farther.',
            values: { pct: 20 },
            icon: 'wide',
          },
        ],
      },
      {
        options: [
          {
            id: 'dawnward',
            name: 'Dawnward',
            text: 'A hero who steps into your field gains a barrier worth {pct}% of their life for every aura they hear, once every {cooldown} s.',
            values: { pct: 3, cooldown: 8, duration: 6 },
            icon: 'dawn',
          },
          {
            id: 'searing_hymns',
            name: 'Searing Hymns',
            text: 'Radiance burns ×{mult} as bright.',
            values: { mult: 2 },
            icon: 'sear',
          },
        ],
      },
      {
        options: [
          {
            id: 'third_voice',
            name: 'Third Voice',
            text: 'Your field song holds a third aura. Choosing it opens the song builder, free.',
            values: { slots: 1 },
            icon: 'voice',
          },
          {
            id: 'lantern_bearer',
            name: 'Lantern Bearer',
            text: 'A planted field (Pedal Point) sings {pct}% stronger.',
            values: { pct: 30 },
            icon: 'stake',
          },
        ],
      },
      {
        options: [
          {
            id: 'sovereign_symphony',
            name: 'Sovereign Symphony',
            text: 'With {count} or more auras across your songs, every aura is {pct}% stronger.',
            values: { count: 4, pct: 25 },
            icon: 'crown',
          },
          {
            id: 'eclipse',
            name: 'Eclipse',
            text: 'During Sunrise, enemies in your field take {pct}% more damage from your heroes, and Sunrise reaches ×{reach} instead of ×1.5.',
            values: { pct: 15, reach: 2 },
            icon: 'eclipse',
          },
        ],
      },
    ],
  },
  {
    id: 'martyr',
    name: 'Martyr',
    title: 'the one who bleeds for them',
    summary: 'You take their wounds: Bear a hero’s damage, and sing with your own Life.',
    text: 'Your Life is {life}% greater, and your songs reserve Life instead of Spirit. Bear (B): you take {bear}% of what your threaded hero would lose, softened by {cut}%, and never more than leaves you at 1 life.',
    crescendo:
      'Martyr’s Vow replaces Sunrise: for {vow} s heroes can’t drop below 1 life. Damage past that comes to you at −{redirect}%, and your healing received is ×{healing}.',
    crescendoName: 'Martyr’s Vow',
    flavor: 'Let it come to me.',
    values: { life: 100, bear: 35, cut: 50, vow: 5, redirect: 70, healing: 2 },
    reserves: 'life',
    unlockRank: 8,
    icon: 'martyr',
    tiers: [
      {
        options: [
          {
            id: 'penitence',
            name: 'Penitence',
            text: 'Damage you Bear fills Resonance: {per} for every 100.',
            values: { per: 4 },
            icon: 'penitence',
          },
          {
            id: 'scarred_hide',
            name: 'Scarred Hide',
            text: 'You take {pct}% less damage while Bearing.',
            values: { pct: 15 },
            icon: 'scar',
          },
        ],
      },
      {
        options: [
          {
            id: 'blood_font',
            name: 'Blood Font',
            text: 'While you’re below {below}% of your Life, the Life your songs reserve regenerates you: {pct}% of it per second.',
            values: { pct: 2, below: 50 },
            icon: 'font',
          },
          {
            id: 'shared_wounds',
            name: 'Shared Wounds',
            text: 'While Bearing, you also take {pct}% of what every other hero in your field would lose.',
            values: { pct: 10 },
            icon: 'wounds',
          },
        ],
      },
      {
        options: [
          {
            id: 'undying_devotion',
            name: 'Undying Devotion',
            text: 'Once a fight, a hit that would down you instead leaves you at 1 life, untouchable for {seconds} s, and Mends every hero for {pct}% of their life.',
            values: { seconds: 3, pct: 30 },
            icon: 'undying',
          },
          {
            id: 'low_life_vigil',
            name: 'Low-Life Vigil',
            text: 'While you’re below {below}% of your Life, every aura is {pct}% stronger.',
            values: { below: 35, pct: 30 },
            icon: 'vigil',
          },
        ],
      },
      {
        options: [
          {
            id: 'martyrs_aegis',
            name: 'Martyr’s Aegis',
            text: 'Your Wards are {pct}% stronger, and each one shields you too.',
            values: { pct: 50 },
            icon: 'aegis',
          },
          {
            id: 'sanguine_covenant',
            name: 'Sanguine Covenant',
            text: 'Mend heals you for {pct}% of what it heals.',
            values: { pct: 30 },
            icon: 'covenant',
          },
        ],
      },
    ],
  },
  {
    id: 'chronomancer',
    name: 'Chronomancer',
    title: 'the one who was ready',
    summary: 'You bend time: Rewind a hero’s last seconds, and stop the fight in Stasis.',
    text: 'Perfect Wards are {perfect} s more forgiving, and every telegraph shows its timer. Rewind replaces Reel: your threaded hero’s life and place return to {rewind} s ago, never to less life than now, and a hero who went down in that time stands back up ({cooldown} s cooldown).',
    crescendo:
      'Stasis replaces Sunrise: for {stasis} s every enemy and its attacks stand still, and your techniques have no cooldowns and cost {cost}% less Spirit.',
    crescendoName: 'Stasis',
    flavor: 'Again. I was ready this time.',
    values: { perfect: 0.1, rewind: 3, cooldown: 18, stasis: 3, cost: 50 },
    unlockRank: 9,
    icon: 'chronomancer',
    tiers: [
      {
        options: [
          {
            id: 'quickened',
            name: 'Quickened',
            text: 'Your techniques recover {pct}% faster.',
            values: { pct: 10 },
            icon: 'quickened',
          },
          {
            id: 'foresight',
            name: 'Foresight',
            text: 'You see every enemy attack {seconds} s before it begins: its shape and its target.',
            values: { seconds: 1 },
            icon: 'foresight',
          },
        ],
      },
      {
        options: [
          {
            id: 'echo_ward',
            name: 'Echo Ward',
            text: 'A Perfect Ward comes back {delay} s later at {pct}% strength.',
            values: { delay: 1, pct: 50 },
            icon: 'echo',
          },
          {
            id: 'borrowed_time',
            name: 'Borrowed Time',
            text: 'Rewind also fills {pct}% of that hero’s Solo.',
            values: { pct: 30 },
            icon: 'borrowed',
          },
        ],
      },
      {
        options: [
          {
            id: 'temporal_mastery',
            name: 'Temporal Mastery',
            text: 'Glide resets the cooldown of the last technique you used, once every {cooldown} s.',
            values: { cooldown: 10 },
            icon: 'mastery',
          },
          {
            id: 'slow_dance',
            name: 'Slow Dance',
            text: 'Enemies in your field move {speed}% slower and wind up {windup}% longer.',
            values: { speed: 15, windup: 10 },
            icon: 'slow_dance',
          },
        ],
      },
      {
        options: [
          {
            id: 'paradox',
            name: 'Paradox',
            text: 'Rewind also undoes every attack aimed at that hero.',
            values: {},
            icon: 'paradox',
          },
          {
            id: 'eternal_moment',
            name: 'Eternal Moment',
            text: 'Stasis lasts {seconds} s longer, and a Ward cast during it that turns out Perfect gives {resonance} Resonance.',
            values: { seconds: 2, resonance: 10 },
            icon: 'eternal',
          },
        ],
      },
    ],
  },
];

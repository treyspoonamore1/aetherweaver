import type { ContentInput } from './schema';

/**
 * Map events (docs/phase-3b.md): a scene and a choice. Every choice has a price, a risk or
 * nothing at all — walking away is always allowed.
 */
export const RUN_EVENTS: ContentInput['events'] = [
  {
    id: 'wounded_cantor',
    name: 'The Wounded Cantor',
    text: 'A cantor of the old choir lies against a pillar, its song failing. It reaches for your Thread.',
    teaser: 'A dying voice reaches for you.',
    icon: 'cantor',
    choices: [
      {
        id: 'mend',
        label: 'Mend it',
        text: 'Your Spirit is 10% smaller for the rest of the run. Gain a rare relic.',
        effects: [
          { kind: 'boon', boon: 'frayed_spirit' },
          { kind: 'relic', rarity: 'rare' },
        ],
        outcome:
          'You pour yourself into its song. It steadies, presses something into your hand, and fades.',
      },
      {
        id: 'last_note',
        label: 'Take its last note',
        text: 'Your heroes start the next 2 fights with their Solos charged.',
        effects: [{ kind: 'boon', boon: 'last_note' }],
        outcome: 'You catch the note before it falls silent. Your heroes hear it too.',
      },
      {
        id: 'leave',
        label: 'Leave it in peace',
        text: 'Nothing happens.',
        outcome: 'You leave it to its song.',
      },
    ],
  },
  {
    id: 'shrine_of_discord',
    name: 'The Shrine of Discord',
    text: 'A cracked bell hangs over an altar of tuning forks. It wants a song, and it does not care which.',
    teaser: 'A gamble with one of your motifs.',
    icon: 'discord',
    choices: [
      {
        id: 'offer',
        label: 'Offer a motif',
        text: '60%: it gains 2 levels. 40%: it shatters, and is lost.',
        motif: 'upgradable',
        chance: 0.6,
        effects: [{ kind: 'motifLevels', levels: 2 }],
        outcome: 'The bell rings true. Your motif rings louder than ever.',
        fail: [{ kind: 'loseMotif' }],
        failOutcome: 'The bell cracks the note apart. The motif is gone.',
      },
      {
        id: 'walk',
        label: 'Walk away',
        text: 'Nothing happens.',
        outcome: 'The bell keeps its silence.',
      },
    ],
  },
  {
    id: 'tuning_pool',
    name: 'The Tuning Pool',
    text: 'Still water that remembers every note ever sung over it. Your reflection hums along.',
    teaser: 'Rest, or rethink your song.',
    icon: 'pool',
    choices: [
      {
        id: 'retune',
        label: 'Retune',
        text: 'Change your Chords.',
        effects: [{ kind: 'retune' }],
        outcome: 'The water takes your old song and gives you a new one.',
      },
      {
        id: 'bathe',
        label: 'Bathe',
        text: 'Every hero heals 25% of their life.',
        effects: [{ kind: 'heal', pct: 0.25 }],
        outcome: 'The cold water closes old wounds.',
      },
    ],
  },
  {
    id: 'merchant_of_silences',
    name: 'The Merchant of Silences',
    text: 'A hooded figure with no mouth spreads its wares on a cloth. It trades in quiet things.',
    teaser: 'Strange wares, stranger prices.',
    icon: 'hood',
    choices: [
      {
        id: 'blood',
        label: 'Pay in blood',
        text: 'Every hero loses 20% of their life. Gain a rare relic.',
        effects: [
          { kind: 'hurt', pct: 0.2 },
          { kind: 'relic', rarity: 'rare' },
        ],
        outcome: 'It takes its price without a sound, and leaves something behind.',
      },
      {
        id: 'gift',
        label: 'Accept a gift',
        text: 'Gain a cursed relic. A Forge can lift the curse.',
        effects: [{ kind: 'relic', rarity: 'cursed' }],
        outcome: 'It presses a gift into your hands. It is heavier than it looks.',
      },
      {
        id: 'decline',
        label: 'Decline',
        text: 'Nothing happens.',
        outcome: 'It bows, and is gone.',
      },
    ],
  },
  {
    id: 'unsung_choir',
    name: 'The Unsung Choir',
    text: 'Hollow choristers stand around a sealed reliquary, singing a song no one has ever heard.',
    teaser: 'A hard fight guards a reliquary.',
    icon: 'reliquary',
    choices: [
      {
        id: 'fight',
        label: 'Break their song',
        text: 'An elite fight. Win, and choose one of 3 relics.',
        effects: [{ kind: 'fight', encounter: 'unsung_choir', relics: 3 }],
        outcome: 'They turn to you as one.',
      },
      {
        id: 'slip',
        label: 'Slip past',
        text: 'Nothing happens.',
        outcome: 'You leave them to their song.',
      },
    ],
  },
  {
    id: 'broken_loom',
    name: 'The Broken Loom',
    text: 'A loom of silver thread stands in the dust, its frame cracked. A few strands still hum as you pass.',
    teaser: 'Mend it, or take it apart.',
    icon: 'loom',
    choices: [
      {
        id: 'mend',
        label: 'Mend it',
        text: 'Mend heals 10% more and Empower is 10% stronger for the rest of the run.',
        cost: 40,
        effects: [{ kind: 'boon', boon: 'mended_loom' }],
        outcome: 'The strands knit together. Your Thread hums in answer.',
      },
      {
        id: 'salvage',
        label: 'Salvage it',
        text: 'Gain 35 Aether.',
        effects: [{ kind: 'aether', amount: 35 }],
        outcome: 'You strip the silver from the frame.',
      },
      {
        id: 'leave',
        label: 'Leave it',
        text: 'Nothing happens.',
        outcome: 'It hums after you as you go.',
      },
    ],
  },
];

/**
 * Phase 5g, W6 (docs/phase-5g.md, "Events and boons"): six events (Hero's Doubt, The
 * Quartermaster and The Bleeding Bell in Movement II; Lost Weaver's Echo, The Unravelled Tapestry
 * and The Stopped Clock in Movement III, each with `movement: 2` or `3`, so the Prelude never
 * meets them) and two boons (Steadied, Faltering). `src/content/index.ts` appends the events after
 * every existing event (after the Mirror Pool) and the boons after Mended Loom. Only existing
 * effect kinds; every event keeps a free choice with nothing to pick, and lists its choices in
 * the order the harness takes them. The boons' resolver cases are in `src/sim/fill/relics.ts`.
 * Every number a choice's text shows comes from the constants below, or the boon it gives. Each
 * icon is one the event screen already draws (src/ui/kit/RelicGlyph.tsx).
 */
import { BOONS } from '../relics';
import type { ContentInput } from '../schema';

/** Steadied and Faltering: their damage, in percent, and the fights they last. */
const STEADIED = { pct: 10, fights: 2 } as const;
const FALTERING = { pct: 10, fights: 1 } as const;

/** Hero's Doubt: what hearing them out heals, and what pressing on pays. */
const DOUBT = { heal: 0.2, aether: 40 } as const;
/** The Quartermaster's two prices. */
const QUARTERMASTER = { crate: 70, chest: 140 } as const;
/** The Bleeding Bell: the toll's heal, the gamble's odds and what losing it costs. */
const BELL = { heal: 0.2, chance: 0.5, hurt: 0.25 } as const;
/** Lost Weaver's Echo: the relics its fight offers, and what listening costs. */
const ECHO = { relics: 2, hurt: 0.1 } as const;
/** The Unravelled Tapestry: what reweaving it costs. */
const TAPESTRY = { aether: 50 } as const;
/** The Stopped Clock: what taking its spring costs. */
const CLOCK = { hurt: 0.15 } as const;

const pct = (share: number) => Math.round(share * 100);
/** The Last Note's fights (an existing boon: the Wounded Cantor gives it too). */
const LAST_NOTE_FIGHTS = BOONS.find((b) => b.id === 'last_note')?.fights ?? 0;

export const FILL_EVENTS: ContentInput['events'] = [
  // ── Movement II: the Crimson Spire ─────────────────────────────────────────────────
  {
    id: 'heros_doubt',
    name: 'Hero’s Doubt',
    text: 'Halfway up the Spire, one of your heroes stops on the stair. ‘How many more of these?’ The others wait for your answer.',
    teaser: 'One of your heroes stops on the stair.',
    icon: 'cantor',
    movement: 2,
    choices: [
      {
        id: 'hear',
        label: 'Hear them out',
        text: `Every hero heals ${pct(DOUBT.heal)}% of their life, and your heroes deal ${STEADIED.pct}% more damage for the next ${STEADIED.fights} fights.`,
        effects: [
          { kind: 'heal', pct: DOUBT.heal },
          { kind: 'boon', boon: 'steadied' },
        ],
        outcome: 'You sit on the stair beside them and listen. When they stand, they stand taller.',
      },
      {
        id: 'press',
        label: 'Press on',
        text: `Gain ${DOUBT.aether} Aether. Your heroes deal ${FALTERING.pct}% less damage in the next fight.`,
        effects: [
          { kind: 'aether', amount: DOUBT.aether },
          { kind: 'boon', boon: 'faltering' },
        ],
        outcome: 'You climb on without a word. They follow, a step behind.',
      },
      {
        id: 'silent',
        label: 'Say nothing',
        text: 'Nothing happens.',
        outcome: 'The silence answers for you. After a while, they climb on.',
      },
    ],
  },
  {
    id: 'quartermaster',
    name: 'The Quartermaster',
    text: 'A Legion quartermaster sells from the back of a cart, no questions asked, and no prices lowered.',
    teaser: 'A Legion cart, no questions asked.',
    icon: 'reliquary',
    movement: 2,
    choices: [
      {
        id: 'crate',
        label: 'Buy the sealed crate',
        text: `Pay ${QUARTERMASTER.crate} Aether. Gain a rare relic.`,
        cost: QUARTERMASTER.crate,
        effects: [{ kind: 'relic', rarity: 'rare' }],
        outcome: 'The quartermaster counts every coin twice, then pries the crate open for you.',
      },
      {
        id: 'chest',
        label: 'Buy the war chest',
        text: `Pay ${QUARTERMASTER.chest} Aether. Gain a legendary relic.`,
        cost: QUARTERMASTER.chest,
        effects: [{ kind: 'relic', rarity: 'legendary' }],
        outcome:
          'The chest is heavier than it looks. Whatever is inside was never meant to be sold.',
      },
      {
        id: 'walk',
        label: 'Walk on',
        text: 'Nothing happens.',
        outcome: 'The quartermaster shrugs, and goes back to counting.',
      },
    ],
  },
  {
    id: 'bleeding_bell',
    name: 'The Bleeding Bell',
    text: 'A bell of red iron hangs over the road. It rings by itself whenever blood is spilled near it.',
    teaser: 'A bell of red iron rings for the fallen.',
    icon: 'bell',
    movement: 2,
    choices: [
      {
        id: 'toll',
        label: 'Toll for the fallen',
        text: `Every hero heals ${pct(BELL.heal)}% of their life.`,
        effects: [{ kind: 'heal', pct: BELL.heal }],
        outcome: 'One slow toll for everyone who fell on this road. Your heroes breathe easier.',
      },
      {
        id: 'ring',
        label: 'Ring it yourself',
        text: `A gamble. ${pct(BELL.chance)}%: gain a legendary relic. Otherwise every hero loses ${pct(BELL.hurt)}% of their life.`,
        chance: BELL.chance,
        effects: [{ kind: 'relic', rarity: 'legendary' }],
        outcome: 'The bell rings true, and something falls from its mouth into your hands.',
        fail: [{ kind: 'hurt', pct: BELL.hurt }],
        failOutcome: 'The bell rings for blood, and takes it.',
      },
      {
        id: 'pass',
        label: 'Pass by',
        text: 'Nothing happens.',
        outcome: 'It rings once behind you, though no one has bled.',
      },
    ],
  },
  // ── Movement III: the Abyssal Rift ─────────────────────────────────────────────────
  {
    id: 'lost_weavers_echo',
    name: 'Lost Weaver’s Echo',
    text: 'In a cracked mirror a Weaver lifts a Thread the moment you do. It isn’t your reflection; it’s later than you.',
    teaser: 'A Weaver in the mirror, a moment later than you.',
    icon: 'spindle',
    movement: 3,
    choices: [
      {
        id: 'face',
        label: 'Face your echo',
        text: `A fight in the Mirror Hall. Win, and choose one of ${ECHO.relics} relics.`,
        effects: [{ kind: 'fight', encounter: 'mirror_hall', relics: ECHO.relics }],
        outcome: 'You step through the glass. On the other side, every mirror is watching.',
      },
      {
        id: 'listen',
        label: 'Listen to it',
        text: `A motif of your choice gains a level. Every hero loses ${pct(ECHO.hurt)}% of their life.`,
        motif: 'upgradable',
        effects: [
          { kind: 'motifLevels', levels: 1 },
          { kind: 'hurt', pct: ECHO.hurt },
        ],
        outcome: 'It hums the song you will sing later. Learning it early costs everyone a little.',
      },
      {
        id: 'away',
        label: 'Look away',
        text: 'Nothing happens.',
        outcome: 'When you look back, the mirror shows only you.',
      },
    ],
  },
  {
    id: 'unravelled_tapestry',
    name: 'The Unravelled Tapestry',
    text: 'A tapestry the height of the hall, half unpicked. Every loose thread is a song someone stopped singing.',
    teaser: 'A tapestry, half unpicked.',
    icon: 'loom',
    movement: 3,
    choices: [
      {
        id: 'reweave',
        label: 'Reweave it',
        text: `Pay ${TAPESTRY.aether} Aether. A motif of your choice gains a level.`,
        cost: TAPESTRY.aether,
        motif: 'upgradable',
        effects: [{ kind: 'motifLevels', levels: 1 }],
        outcome: 'You stitch a song back into the cloth, and it sings a little of yours.',
      },
      {
        id: 'pull',
        label: 'Pull a thread',
        text: 'Lose a motif of your choice. Gain a legendary relic.',
        motif: 'any',
        effects: [{ kind: 'loseMotif' }, { kind: 'relic', rarity: 'legendary' }],
        outcome: 'The thread comes away with one of your songs on it, and something bright behind.',
      },
      {
        id: 'leave',
        label: 'Leave it',
        text: 'Nothing happens.',
        outcome: 'Another thread falls loose as you go.',
      },
    ],
  },
  {
    id: 'stopped_clock',
    name: 'The Stopped Clock',
    text: 'A clock with no hands stands in the dust of the Rift, ticking.',
    teaser: 'A clock with no hands, ticking.',
    icon: 'metronome',
    movement: 3,
    choices: [
      {
        id: 'wind',
        label: 'Wind it',
        text: `Your heroes start the next ${LAST_NOTE_FIGHTS} fights with their Solos charged.`,
        effects: [{ kind: 'boon', boon: 'last_note' }],
        outcome: 'It ticks faster as you wind it. Your heroes feel the moment coming.',
      },
      {
        id: 'spring',
        label: 'Take its spring',
        text: `Every hero loses ${pct(CLOCK.hurt)}% of their life. Gain a rare relic.`,
        effects: [
          { kind: 'hurt', pct: CLOCK.hurt },
          { kind: 'relic', rarity: 'rare' },
        ],
        outcome: 'The spring bites as it comes free. The ticking stops.',
      },
      {
        id: 'leave',
        label: 'Leave it',
        text: 'Nothing happens.',
        outcome: 'It ticks on behind you, keeping a time no one else keeps.',
      },
    ],
  },
];

/** Boons and banes the new events leave behind (after Mended Loom). */
export const FILL_BOONS: ContentInput['boons'] = [
  {
    id: 'steadied',
    name: 'Steadied',
    kind: 'boon',
    text: 'Your heroes deal {pct}% more damage.',
    values: { pct: STEADIED.pct },
    fights: STEADIED.fights,
    icon: 'steadied',
  },
  {
    id: 'faltering',
    name: 'Faltering',
    kind: 'bane',
    text: 'Your heroes deal {pct}% less damage.',
    values: { pct: FALTERING.pct },
    fights: FALTERING.fights,
    icon: 'faltering',
  },
];

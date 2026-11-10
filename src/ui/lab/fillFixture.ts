/**
 * Phase 5g (docs/phase-5g.md): lab and test fixtures for the fill, shaped by the content schema.
 * The fill's entries are written in `src/content/fill/` by other streams; until they are in
 * `CONTENT`, the UI lab and `tests/uiFill.test.ts` name triggers from this fixture instead. Its
 * entries copy a few of the doc's rows (names, texts with {v} and their value names, values) and
 * are parsed by the schema, so a fixture can't drift into a shape content can't hold. Once an id
 * is in `CONTENT`, content's own entry wins (`fillFixtureContent`). Never imported by the game.
 */
import { CONTENT } from '../../content';
import { BoonDefSchema, MotifDefSchema, RelicDefSchema } from '../../content/schema';
import type { TriggerContent } from '../hud/triggers';

/** A few of the doc's motifs (Aegis, the Perfect Ward's payoffs). */
const MOTIFS = [
  {
    id: 'clean_strike',
    name: 'Clean Strike',
    category: 'aegis',
    rarity: 'common',
    values: [6, 9, 12],
    text: 'A Perfect Ward gives back {v} Spirit.',
    requires: { expedition: true },
    tags: ['ward', 'perfect'],
  },
  {
    id: 'tender_guard',
    name: 'Tender Guard',
    category: 'aegis',
    rarity: 'common',
    values: [8, 12, 16],
    text: 'A Perfect Ward heals its hero {v}% of their life.',
    requires: { expedition: true },
    tags: ['ward', 'perfect', 'heal'],
  },
  {
    id: 'saving_grace',
    name: 'Saving Grace',
    category: 'finale',
    rarity: 'common',
    values: [5, 8, 10],
    text: 'Each Save gives {v} more Resonance.',
    requires: { expedition: true },
    tags: ['resonance'],
  },
].map((m) => MotifDefSchema.parse(m));

/** A few of the doc's relics. */
const RELICS = [
  {
    id: 'pilgrims_lamp',
    name: 'Pilgrim’s Lamp',
    rarity: 'common',
    text: 'When a hero is revived, they gain a barrier worth {barrier}% of their life for {seconds} s.',
    flavor: 'A lamp for the road back.',
    values: { barrier: 25, seconds: 4 },
    empowered: { values: { barrier: 35 } },
    icon: 'pilgrims_lamp',
    expedition: true,
  },
  {
    id: 'echoing_shell',
    name: 'Echoing Shell',
    rarity: 'rare',
    text: 'A Perfect Ward charges every other hero’s Solo by {pct}%.',
    flavor: 'Hold it to your ear: the last song is still in it.',
    values: { pct: 10 },
    empowered: { values: { pct: 15 } },
    icon: 'echoing_shell',
    expedition: true,
  },
  {
    id: 'red_ink',
    name: 'Red Ink',
    rarity: 'cursed',
    text: 'Every Perfect Ward gives {resonance} more Resonance.',
    curse: 'Your Ward recovers {slower} s slower.',
    flavor: 'Every mark it makes is a debt.',
    values: { resonance: 10, slower: 3 },
    empowered: { values: { resonance: 15 } },
    icon: 'red_ink',
    expedition: true,
  },
].map((r) => RelicDefSchema.parse(r));

/** The doc's two boons. */
const BOONS = [
  {
    id: 'steadied',
    name: 'Steadied',
    kind: 'boon',
    text: 'Your heroes deal {pct}% more damage.',
    values: { pct: 10 },
    fights: 2,
    icon: 'steadied',
  },
  {
    id: 'faltering',
    name: 'Faltering',
    kind: 'bane',
    text: 'Your heroes deal {pct}% less damage.',
    values: { pct: 10 },
    fights: 1,
    icon: 'faltering',
  },
].map((b) => BoonDefSchema.parse(b));

function merged<T extends { id: string }>(real: readonly T[], fixture: readonly T[]): T[] {
  return [...real, ...fixture.filter((f) => !real.some((r) => r.id === f.id))];
}

/** `CONTENT`'s motifs, relics and boons, with the fixture's entries content doesn't hold yet. */
export function fillFixtureContent(): TriggerContent {
  return {
    motifs: merged(CONTENT.motifs, MOTIFS),
    relics: merged(CONTENT.relics, RELICS),
    boons: merged(CONTENT.boons, BOONS),
  };
}

/** A fight's trigger counts over the fixture's sources (in resolution order). */
export const FIXTURE_TRIGGERS: Readonly<Record<string, number>> = {
  clean_strike: 7,
  tender_guard: 1,
  saving_grace: 0,
  echoing_shell: 4,
  red_ink: 7,
};

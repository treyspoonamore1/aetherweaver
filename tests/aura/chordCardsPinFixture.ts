/**
 * The Chord builder's aura and ornament cards pin (docs/phase-7.md, ground rule 4: "ChordBuilder's
 * aura and ornament cards" are not edited by anyone; review B, finding 2). The aura presentation pin
 * (`presentationPinFixture.ts`) leaves them out; this pins them, as static markup in English.
 *
 * Shared by `recordChordCardsPin.ts` (which recorded `chordCardsPin.json` once, from the tree at
 * 81a12ef, before Phase 7 changed any source) and `chordCardsPin.test.ts` (which renders the cards
 * again and compares them with the file).
 *
 * What is recorded, for each case (`chordCardsCases`), from `ChordBuilder` as rendered on the
 * server (`renderToStaticMarkup`):
 *   - `slots`: every slot card in both song cards (`song-beam`, `song-field`), filled or empty,
 *     open or locked, in order;
 *   - `picker`: every item of the picker beside them (the auras or ornaments that fit the selected
 *     slot: here, elsewhere, locked, new, a misfit or a clash);
 *   - `presets` (the `presets:*` cases only): each preset's row of aura and ornament chips.
 * Each card's markup is stored once, in `cards`, under a hash of it; a case lists the hashes.
 *
 * The cases: each of the six auras in each slot it can take (two in the beam song, three in the
 * field song with Third Voice's slot), selected and not; each of the four ornaments in each slot
 * and song it can take (Unison: the beam song only), selected and not; at each Rank from 1 to 6,
 * two full loadouts and an empty one (locked songs, slots and items, filled and empty), with the
 * picker for an aura and an ornament slot; everything "New"; ornaments that clash; and the
 * Martyr's Life with a lighter Astrolabe. The selected slot is the builder's own state: the test
 * sets it through `select`, which its `react` mock reads (the builder's first state is the
 * selected slot).
 */
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONTENT } from '../../src/content';
import { allowanceFor, EVERYTHING, UNLOCKS, type Allowance } from '../../src/meta/profile';
import type { ChordLoadout } from '../../src/sim';

/** The builder's selected slot (as `chordModel.ts`'s `SlotRef`). */
export interface SlotRef {
  chord: number;
  kind: 'aura' | 'ornament';
  index: number;
}

/** The Chord builder's props this pin uses (as at 81a12ef and since). */
export interface CardProps {
  value: ChordLoadout[];
  onChange(next: ChordLoadout[]): void;
  allowance?: Allowance;
  fresh?: ReadonlySet<string>;
  fieldAuraSlots?: number;
  bonus?: { name: string; icon: string; callingId: string } | null;
  pool?: 'spirit' | 'life';
  reserveMult?: number;
}
export type ChordBuilderView = FunctionComponent<CardProps>;

export interface CardsCase {
  key: string;
  value: ChordLoadout[];
  allowance: Allowance;
  /** The slot selected (null: the builder's own first choice). */
  select: SlotRef | null;
  fresh?: ReadonlySet<string>;
  fieldAuraSlots?: number;
  bonus?: CardProps['bonus'];
  pool?: 'spirit' | 'life';
  reserveMult?: number;
  /** Record the presets' chip rows too. */
  presets?: boolean;
}

export interface CaseCards {
  slots: string[];
  picker: string[];
  presets?: string[];
}

export interface ChordCardsPin {
  cases: Record<string, CaseCards>;
  /** Each card's markup, by its hash. */
  cards: Record<string, string>;
}

const BEAM = 0;
const FIELD = 1;

const auraIds = () => CONTENT.auras.map((a) => a.id);
const ornamentIds = () => CONTENT.ornaments.map((o) => o.id);
const ornament = (id: string) => CONTENT.ornaments.find((o) => o.id === id)!;

function empty(): ChordLoadout[] {
  return Array.from({ length: CONTENT.weaver.chords }, () => ({ auras: [], ornaments: [] }));
}

/** The Calling option that adds a field slot (the Luminary's Third Voice), as Prep marks it. */
function thirdVoice(): NonNullable<CardProps['bonus']> {
  for (const c of CONTENT.callings)
    for (const t of c.tiers)
      for (const o of t.options)
        if ((o.values.slots ?? 0) > 0) return { name: o.name, icon: o.icon, callingId: c.id };
  throw new Error('no Calling option adds a field slot');
}

/** Can ornaments `a` and `b` share a song? */
const shareable = (a: string, b: string) =>
  !ornament(a).excludes.includes(b) && !ornament(b).excludes.includes(a);

/** Every case, in a fixed order. */
export function chordCardsCases(): CardsCase[] {
  const out: CardsCase[] = [];
  const auras = auraIds();
  const ornaments = ornamentIds();
  const bonus = thirdVoice();

  // Each aura in each slot it can take, selected and not.
  const auraSlots: [number, number][] = [
    [BEAM, 0],
    [BEAM, 1],
    [FIELD, 0],
    [FIELD, 1],
    [FIELD, 2],
  ];
  for (const id of auras) {
    for (const [chord, index] of auraSlots) {
      const value = empty();
      const fillers = auras.filter((a) => a !== id).slice(0, index);
      value[chord]!.auras = [...fillers, id];
      const third = chord === FIELD && index === 2;
      for (const selected of [true, false])
        out.push({
          key: `aura:${id}:${chord === BEAM ? 'beam' : 'field'}${index + 1}:${selected ? 'selected' : 'unselected'}`,
          value,
          allowance: EVERYTHING,
          select: selected
            ? { chord, kind: 'aura', index }
            : { chord: chord === BEAM ? FIELD : BEAM, kind: 'aura', index: 0 },
          ...(third ? { fieldAuraSlots: 3, bonus } : {}),
        });
    }
  }

  // Each ornament in each slot and song it can take, selected and not.
  for (const id of ornaments) {
    for (const chord of [BEAM, FIELD]) {
      if (!ornament(id).roles.includes(chord === BEAM ? 'beam' : 'field')) continue;
      for (const index of [0, 1]) {
        const value = empty();
        const filler = ornaments.find(
          (o) =>
            o !== id &&
            shareable(o, id) &&
            ornament(o).roles.includes(chord === BEAM ? 'beam' : 'field'),
        )!;
        value[chord]!.ornaments = index === 0 ? [id] : [filler, id];
        for (const selected of [true, false])
          out.push({
            key: `ornament:${id}:${chord === BEAM ? 'beam' : 'field'}${index + 1}:${selected ? 'selected' : 'unselected'}`,
            value,
            allowance: EVERYTHING,
            select: selected
              ? { chord, kind: 'ornament', index }
              : { chord, kind: 'aura', index: 0 },
          });
      }
    }
  }

  // Locks, at each Rank: an empty loadout, and two that hold every aura and ornament.
  const full: ChordLoadout[][] = [
    [
      { auras: [auras[0]!, auras[1]!], ornaments: ['unison', 'grace_note'] },
      { auras: [auras[2]!, auras[3]!], ornaments: ['pedal_point', 'reverb'] },
    ],
    [
      { auras: [auras[4]!, auras[5]!], ornaments: ['reverb', 'pedal_point'] },
      { auras: [auras[0]!, auras[1]!], ornaments: ['grace_note'] },
    ],
  ];
  for (let rank = 1; rank <= 6; rank++) {
    const allowance = allowanceFor(rank);
    out.push({ key: `rank${rank}:empty`, value: empty(), allowance, select: null });
    full.forEach((value, v) => {
      for (const [name, select] of [
        ['first', null],
        ['beamOrnament1', { chord: BEAM, kind: 'ornament', index: 0 }],
        ['fieldAura1', { chord: FIELD, kind: 'aura', index: 0 }],
      ] as const)
        out.push({ key: `rank${rank}:full${v + 1}:${name}`, value, allowance, select });
    });
  }

  // Everything new.
  const fresh = new Set(UNLOCKS.map((u) => u.id));
  for (const [name, select] of [
    ['aura', null],
    ['beamOrnament1', { chord: BEAM, kind: 'ornament', index: 0 }],
    ['fieldOrnament2', { chord: FIELD, kind: 'ornament', index: 1 }],
  ] as const)
    out.push({ key: `fresh:${name}`, value: empty(), allowance: EVERYTHING, select, fresh });

  // Ornaments that can't share a song with the one beside them.
  for (const chord of [BEAM, FIELD]) {
    const value = empty();
    value[chord]!.ornaments = [chord === BEAM ? 'unison' : 'reverb'];
    out.push({
      key: `clash:${chord === BEAM ? 'beam' : 'field'}`,
      value,
      allowance: EVERYTHING,
      select: { chord, kind: 'ornament', index: 1 },
    });
  }

  // The Martyr's Life, and an Astrolabe that lightens the songs.
  for (const [name, select] of [
    ['aura', { chord: BEAM, kind: 'aura', index: 0 }],
    ['ornament', { chord: FIELD, kind: 'ornament', index: 0 }],
  ] as const)
    out.push({
      key: `life:${name}`,
      value: full[0]!,
      allowance: EVERYTHING,
      select,
      pool: 'life',
      reserveMult: 0.86,
    });

  // The presets' chips, with everything open and at Rank 1.
  out.push({
    key: 'presets:everything',
    value: empty(),
    allowance: EVERYTHING,
    select: null,
    presets: true,
  });
  out.push({
    key: 'presets:rank1',
    value: empty(),
    allowance: allowanceFor(1),
    select: null,
    presets: true,
  });
  return out;
}

// ── Reading the markup ────────────────────────────────────────────────────────

interface Node {
  tag: string;
  attrs: Record<string, string>;
  start: number;
  end: number;
  children: Node[];
}

const VOID = new Set([
  'area',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'wbr',
]);

/** The elements of server-rendered markup, as a tree (text left out). */
function parse(html: string): Node {
  const root: Node = { tag: '#root', attrs: {}, start: 0, end: html.length, children: [] };
  const stack: Node[] = [root];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[0].startsWith('<!--')) continue;
    const [all, close, tag, attrText, self] = m;
    if (close) {
      const node = stack.pop()!;
      if (node.tag !== tag) throw new Error(`unbalanced markup: </${tag}> closes <${node.tag}>`);
      node.end = m.index + all.length;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of attrText!.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[a[1]!] = a[2] ?? '';
    const node: Node = {
      tag: tag!,
      attrs,
      start: m.index,
      end: m.index + all.length,
      children: [],
    };
    stack.at(-1)!.children.push(node);
    if (!self && !VOID.has(tag!)) stack.push(node);
  }
  if (stack.length !== 1) throw new Error('unbalanced markup');
  return root;
}

function find(node: Node, test: (n: Node) => boolean): Node[] {
  const out: Node[] = [];
  const walk = (n: Node) => {
    if (test(n)) out.push(n);
    else n.children.forEach(walk);
  };
  node.children.forEach(walk);
  return out;
}

function one(node: Node, test: (n: Node) => boolean, what: string): Node {
  const found = find(node, test);
  if (found.length !== 1) throw new Error(`expected one ${what}, found ${found.length}`);
  return found[0]!;
}

/** The cards of one render: slot cards, picker items, and (asked for) the presets' chip rows. */
export function cardsOf(
  html: string,
  presets: boolean,
): { slots: string[]; picker: string[]; presets?: string[] } {
  const root = parse(html);
  const text = (n: Node) => html.slice(n.start, n.end);
  const slots: string[] = [];
  for (const role of ['beam', 'field']) {
    const song = one(root, (n) => n.attrs['data-testid'] === `song-${role}`, `song-${role}`);
    for (const grid of find(song, (n) => n.attrs.class === 'grid grid-cols-2 gap-2'))
      for (const card of grid.children) slots.push(text(card));
  }
  const palette = one(root, (n) => n.attrs['aria-labelledby'] === 'palette-title', 'picker');
  const list = one(palette, (n) => n.tag === 'ul', 'picker list');
  const picker = list.children.map(text);
  if (!presets) return { slots, picker };
  const section = one(root, (n) => n.attrs['aria-labelledby'] === 'presets-title', 'presets');
  const rows = find(section, (n) => n.tag === 'li').map((li) => {
    const button = one(li, (n) => n.tag === 'button', 'preset button');
    const row = button.children[1];
    if (!row) throw new Error('a preset with no chip row');
    return text(row);
  });
  return { slots, picker, presets: rows };
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/**
 * Renders every case with `ChordBuilder`, the selected slot set through `select` (the test's
 * `react` mock gives it to the builder as its first state).
 */
export function computeChordCards(
  ChordBuilder: ChordBuilderView,
  select: (ref: SlotRef | null) => void,
): ChordCardsPin {
  const cards: Record<string, string> = {};
  const cases: Record<string, CaseCards> = {};
  const keep = (markup: string) => {
    const h = hash(markup);
    if (cards[h] !== undefined && cards[h] !== markup) throw new Error(`hash collision: ${h}`);
    cards[h] = markup;
    return h;
  };
  try {
    for (const c of chordCardsCases()) {
      select(c.select);
      const html = renderToStaticMarkup(
        createElement(ChordBuilder, {
          value: c.value,
          onChange: () => {},
          allowance: c.allowance,
          ...(c.fresh ? { fresh: c.fresh } : {}),
          ...(c.fieldAuraSlots ? { fieldAuraSlots: c.fieldAuraSlots } : {}),
          ...(c.bonus ? { bonus: c.bonus } : {}),
          ...(c.pool ? { pool: c.pool } : {}),
          ...(c.reserveMult ? { reserveMult: c.reserveMult } : {}),
        }),
      );
      const got = cardsOf(html, c.presets === true);
      cases[c.key] = {
        slots: got.slots.map(keep),
        picker: got.picker.map(keep),
        ...(got.presets ? { presets: got.presets.map(keep) } : {}),
      };
    }
  } finally {
    select(null);
  }
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(cards).sort()) sorted[k] = cards[k]!;
  return { cases, cards: sorted };
}

/** The file's text: stable key order, as the repo's Prettier writes JSON (so `npm run lint` passes). */
export async function serializeChordCards(pin: ChordCardsPin): Promise<string> {
  const filepath = fileURLToPath(new URL('./chordCardsPin.json', import.meta.url));
  const options = (await resolveConfig(filepath)) ?? {};
  return format(JSON.stringify(pin, null, 2), { ...options, filepath });
}

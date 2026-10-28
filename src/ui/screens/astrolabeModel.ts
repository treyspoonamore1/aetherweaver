/**
 * The Astrolabe's pure model (Phase 4, docs/phase-4.md): where each star sits on the map, what
 * state it's in, what pointing at one would do (the path `pathTo` takes and what it costs, or
 * what hangs on a star you own), what the tree adds up to, each keystone's gains and price, and
 * the lines the screens print. The moves are meta/astrolabe.ts's, through the profile store, so
 * the map can't disagree with them. Every number comes from content (`values`), the Rank
 * (`astrolabePoints`) or the run.
 */
import type { UiSound } from '../../audio';
import { CONTENT, astrolabeNode, astrolabeText, type AstrolabeNode } from '../../content';
import {
  ASTROLABE_RANK,
  ASTROLABE_START,
  astrolabePoints,
  canRefund,
  neighbours,
  pathTo,
  pruneTree,
} from '../../meta/astrolabe';
import { CONSTELLATIONS, isConstellation, type Constellation } from '../kit/astrolabeLook';
import { plural } from '../kit/format';

export type StarKind = AstrolabeNode['kind'];

// ── The map ───────────────────────────────────────────────────────────────────────────

/** Every star, in content order: the centre, each constellation centre outward, the bridges. */
export const STARS: readonly AstrolabeNode[] = CONTENT.astrolabe.nodes;
/** The links, each listed once. */
export const LINKS: readonly (readonly [string, string])[] = CONTENT.astrolabe.links;

/** How big each kind of star is drawn, in map units (the map is about 9 units in radius). */
export const STAR_RADIUS: Readonly<Record<StarKind, number>> = {
  start: 0.66,
  travel: 0.29,
  notable: 0.46,
  great: 0.55,
  keystone: 0.6,
};

/**
 * Where the map is drawn: a square view box in map units, y pointing down (north up on screen),
 * with room round the stars for the dial's rim (`rim`) and the band of names outside it.
 */
export const MAP_BOX = (() => {
  let r = 0;
  for (const n of STARS) r = Math.max(r, Math.hypot(n.x, n.y) + STAR_RADIUS[n.kind]);
  const half = r + 1.95;
  return { x: -half, y: -half, w: 2 * half, h: 2 * half, rim: r + 0.75 };
})();

/** A star's place on screen, in map units (content's y is north-up; the screen's is down). */
export function starAt(node: Pick<AstrolabeNode, 'x' | 'y'>): { x: number; y: number } {
  return { x: node.x, y: -node.y };
}

/** A star's place as a share of the map box (0..1), to put HTML (a tooltip) over it. */
export function starShare(node: Pick<AstrolabeNode, 'x' | 'y'>): { x: number; y: number } {
  const p = starAt(node);
  return { x: (p.x - MAP_BOX.x) / MAP_BOX.w, y: (p.y - MAP_BOX.y) / MAP_BOX.h };
}

/** How far past each edge of the map something may reach, in px. */
export interface Room {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Where a star's tooltip goes, in px from the map's top-left corner: beside, above or below the
 * star, wherever it hides the fewest stars the preview lights (the path, what hangs on it), then
 * the fewest of the tree, then the fewest others. It never leaves `bounds` (the screen), and
 * reaches past `room` (the map's own column, clear of the header and the side panel) only to
 * keep the path in sight.
 */
export function tipPlacement(
  p: Pick<StarPreview, 'id' | 'path' | 'hangs'>,
  tree: readonly string[],
  map: { w: number; h: number },
  tip: { w: number; h: number },
  room: Room,
  bounds: Room = room,
): { x: number; y: number } {
  const scale = map.w / MAP_BOX.w;
  const px = (n: AstrolabeNode) => {
    const s = starShare(n);
    return { x: s.x * map.w, y: s.y * map.h, r: STAR_RADIUS[n.kind] * scale };
  };
  const at = px(astrolabeNode(p.id));
  const gap = at.r + 12;
  const lit = new Set([...p.path, ...p.hangs]);
  const owned = new Set(tree);
  const { w, h } = tip;
  const past = (x: number, y: number, r: Room) =>
    Math.max(0, -r.left - x) +
    Math.max(0, x + w - map.w - r.right) +
    Math.max(0, -r.top - y) +
    Math.max(0, y + h - map.h - r.bottom);
  // Beside the star (level with it, or slid down or up along it), or above or below it (centred,
  // or slid right or left); a step farther out if the path runs close by; else parked in a
  // corner of the map's column. The small numbers break ties in that order.
  const slides = [0.5, 0.25, 0.75, 0.1, 0.9];
  const around = (d: number, rank: number) => [
    ...slides.map((f, i) => ({ x: at.x + d, y: at.y - h * f, rank: rank + i * 0.1 })),
    ...slides.map((f, i) => ({ x: at.x - d - w, y: at.y - h * f, rank: rank + 0.05 + i * 0.1 })),
    ...slides.map((f, i) => ({ x: at.x - w * f, y: at.y + d, rank: rank + 1 + i * 0.1 })),
    ...slides.map((f, i) => ({ x: at.x - w * f, y: at.y - d - h, rank: rank + 1.05 + i * 0.1 })),
  ];
  const [left, right] = [-room.left, map.w + room.right - w];
  const [top, bottom] = [-room.top, map.h + room.bottom - h];
  const options = [
    ...around(gap, 0),
    ...around(gap + 0.1 * map.w, 50),
    { x: left, y: top, rank: 300 },
    { x: right, y: top, rank: 300 },
    { x: left, y: bottom, rank: 300 },
    { x: right, y: bottom, rank: 300 },
  ].map((o) => ({
    // Slid back inside the bounds, if it can be.
    ...o,
    x: Math.min(Math.max(o.x, -bounds.left), map.w + bounds.right - w),
    y: Math.min(Math.max(o.y, -bounds.top), map.h + bounds.bottom - h),
  }));
  let best = options[0]!;
  let bestScore = Infinity;
  for (const o of options) {
    let score = o.rank + past(o.x, o.y, room) * 10 + past(o.x, o.y, bounds) * 1e5;
    for (const n of STARS) {
      const s = px(n);
      const r = s.r + 3;
      if (s.x + r < o.x || s.x - r > o.x + w || s.y + r < o.y || s.y - r > o.y + h) continue;
      score += n.id === p.id ? 1e6 : lit.has(n.id) ? 1000 : owned.has(n.id) ? 60 : 4;
    }
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return { x: best.x, y: best.y };
}

/** The two constellations a bridge notable joins (its neighbours' own), in map order. */
export function bridgeOf(id: string): Constellation[] {
  const set = new Set<Constellation>();
  for (const n of neighbours(id)) {
    const c = astrolabeNode(n).constellation;
    if (isConstellation(c)) set.add(c);
  }
  return CONSTELLATIONS.filter((c) => set.has(c));
}

/** The constellations a star belongs to: its own, a bridge's two, none for the centre. */
export function starConstellations(node: AstrolabeNode): Constellation[] {
  if (isConstellation(node.constellation)) return [node.constellation];
  return node.constellation === 'bridge' ? bridgeOf(node.id) : [];
}

/** Stars per constellation (the bridges are their own). */
export function constellationStars(c: Constellation): AstrolabeNode[] {
  return STARS.filter((n) => n.constellation === c);
}

/** What each effect looks like on its star: an Astrolabe glyph or a kit icon. */
const EFFECT_GLYPH: Readonly<Record<string, string>> = {
  none: 'weaver_star',
  thread: 'thread',
  spun_silver: 'thread',
  mend: 'mend',
  second_stitch: 'mend',
  overflowing_grace: 'overflowing_grace',
  empower: 'empower',
  afterglow: 'empower',
  life: 'heart',
  sanguine_font: 'sanguine_font',
  aura_effect: 'note',
  clear_voice: 'note',
  held_note: 'fermata',
  prism_covenant: 'prism_covenant',
  reserve: 'sparkle',
  field: 'scatter',
  unbroken_chorus: 'unbroken_chorus',
  ward: 'ward',
  shieldwright: 'ward',
  perfect: 'star',
  ringing_parry: 'bell',
  shatterproof_halo: 'shatterproof_halo',
  tech_cost: 'aether',
  tech_cooldown: 'clock',
  bell_tower: 'chime',
  spirit_regen: 'reroll',
  eldritch_conduit: 'eldritch_conduit',
  hero_life: 'heart',
  hero_damage: 'swords',
  fellowship: 'bond',
  bleed_out: 'hourglass',
  close_ranks: 'stack',
  revive_speed: 'mend',
  second_wind: 'second_wind',
  solo_charge: 'flame',
  cued_solo: 'clock',
  ready_answer: 'call',
  ensemble: 'ensemble',
  resonant_thread: 'tune',
  anthem: 'flag',
  shield_bearer: 'swords',
  lifeguard: 'heart',
};

/** A star's glyph (an Astrolabe glyph key or a kit icon), from what it does. */
export function starGlyph(node: Pick<AstrolabeNode, 'effect'>): string {
  return EFFECT_GLYPH[node.effect] ?? 'diamond';
}

export const KIND_LABEL: Readonly<Record<StarKind, string>> = {
  start: 'The centre',
  travel: 'Travel star',
  notable: 'Notable',
  great: 'Great notable',
  keystone: 'Keystone',
};

// ── States ────────────────────────────────────────────────────────────────────────────

/**
 * `owned`: taken (the centre always is); `takeable`: it touches the tree, so one point takes it;
 * `far`: out of reach for now (taking it takes the path to it).
 */
export type StarState = 'centre' | 'owned' | 'takeable' | 'far';

export function ownedSet(tree: readonly string[]): Set<string> {
  return new Set([ASTROLABE_START, ...tree]);
}

export function starState(tree: readonly string[], id: string, owned = ownedSet(tree)): StarState {
  if (id === ASTROLABE_START) return 'centre';
  if (owned.has(id)) return 'owned';
  return neighbours(id).some((n) => owned.has(n)) ? 'takeable' : 'far';
}

/** A link's look: `lit` between two stars you own, `open` from one you own, else `dark`. */
export function linkState(
  owned: ReadonlySet<string>,
  a: string,
  b: string,
): 'lit' | 'open' | 'dark' {
  const n = (owned.has(a) ? 1 : 0) + (owned.has(b) ? 1 : 0);
  return n === 2 ? 'lit' : n === 1 ? 'open' : 'dark';
}

/**
 * The stars you own that would be cut off from the centre without `id`: what "hangs on" it.
 * Empty exactly when `canRefund` says it can go back.
 */
export function hangsOn(tree: readonly string[], id: string): string[] {
  if (!tree.includes(id)) return [];
  const rest = new Set(tree.filter((n) => n !== id));
  const reached = new Set<string>();
  const queue = [ASTROLABE_START];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const next of neighbours(at))
      if (rest.has(next) && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
  }
  return tree.filter((n) => n !== id && !reached.has(n));
}

/** Stars a tree holds beyond its points, that embarking would leave behind (`pruneTree`). */
export function droppedStars(tree: readonly string[], points: number): string[] {
  if (tree.length <= points) return [];
  const kept = new Set(pruneTree(tree, points));
  return tree.filter((id) => !kept.has(id));
}

// ── Pointing at a star ────────────────────────────────────────────────────────────────

export interface StarPreview {
  id: string;
  /**
   * `take`: the path to it fits the points left; `short`: it doesn't; `mine`: yours, and it can
   * go back; `held`: yours, but something you've taken hangs on it; `centre`: the Weaver's Star.
   */
  action: 'take' | 'short' | 'mine' | 'held' | 'centre';
  /** `pathTo`: the stars taking it would take, nearest first (empty for a star you own). */
  path: string[];
  /** Points the path costs (one a star). */
  cost: number;
  /** Points left to spend now (negative: the tree holds more than the Rank gives). */
  left: number;
  /** The points the Rank gives. */
  points: number;
  /** `held`: the stars that hang on it. */
  hangs: string[];
}

export function previewStar(tree: readonly string[], points: number, id: string): StarPreview {
  const left = points - tree.length;
  const base = { id, path: [] as string[], cost: 0, left, points, hangs: [] as string[] };
  if (id === ASTROLABE_START) return { ...base, action: 'centre' };
  if (tree.includes(id)) {
    const hangs = hangsOn(tree, id);
    return { ...base, action: canRefund(tree, id) ? 'mine' : 'held', hangs };
  }
  const path = pathTo(tree, id) ?? [];
  return { ...base, path, cost: path.length, action: path.length <= left ? 'take' : 'short' };
}

/**
 * The links a path runs along, from the star you own it leaves (the one `pathTo`'s search leaves
 * from: the first owned star, in tree order, beside its first step) to its end.
 */
export function pathLinks(tree: readonly string[], path: readonly string[]): [string, string][] {
  if (path.length === 0) return [];
  const from = [ASTROLABE_START, ...tree].find((o) => neighbours(o).includes(path[0]!));
  const links: [string, string][] = from ? [[from, path[0]!]] : [];
  for (let i = 1; i < path.length; i++) links.push([path[i - 1]!, path[i]!]);
  return links;
}

/** The key a link is known by, whichever way round. */
export function linkKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ── Words ─────────────────────────────────────────────────────────────────────────────

/** "3 points", "1 point". */
export function pointsWord(n: number): string {
  return `${n} ${plural(n, 'point')}`;
}

/** "12 of 15 points". */
export function pointsLine(spent: number, points: number): string {
  return `${spent} of ${pointsWord(points)}`;
}

/** "3 points to spend", "Every point spent", "4 points over". */
export function spendLine(left: number): string {
  if (left > 0) return `${pointsWord(left)} to spend`;
  if (left === 0) return 'Every point spent';
  return `${pointsWord(-left)} over`;
}

/** Names, joined: "Afterglow", "Afterglow and Blood", "Afterglow and 3 more". */
export function namesLine(ids: readonly string[], max = 2): string {
  const names = ids.map((id) => astrolabeNode(id).name);
  // Travel stars share names ("Blood"): say each once.
  const unique = [...new Set(names)];
  if (unique.length <= max) return unique.join(' and ');
  return `${unique.slice(0, max - 1).join(', ')} and ${unique.length - max + 1} more`;
}

/** What pointing at a star says it would do, in a line. */
export function previewLine(p: StarPreview): string {
  const node = astrolabeNode(p.id);
  switch (p.action) {
    case 'centre':
      return 'The Weaver’s Star: every path begins here, and it’s always yours.';
    case 'take':
      return p.cost === 1
        ? `Take it: ${pointsWord(1)}.`
        : `Take it and the ${p.cost - 1} on the way: ${pointsWord(p.cost)}.`;
    case 'short':
      return p.left < 0
        ? `Your tree already holds more than your ${pointsWord(p.points)}: give some back first.`
        : `Not enough points: ${node.name} takes ${pointsWord(p.cost)}, you have ${pointsWord(p.left)} left.`;
    case 'mine':
      return 'Yours. Give it back for a point (right-click, or Delete).';
    case 'held':
      return `Yours. Something you’ve taken hangs on it: ${namesLine(p.hangs)}. Give ${p.hangs.length === 1 ? 'that' : 'those'} back first.`;
  }
}

/**
 * How far the first notables sit from the centre, from the map itself: "Every constellation's
 * first notable is 3 points from the centre." (or the nearest one, if they differ).
 */
export function firstNotableLine(): string {
  const nearest = new Map<string, number>();
  for (const n of STARS) {
    if (n.kind !== 'notable' || !isConstellation(n.constellation)) continue;
    const cost = pathTo([], n.id)?.length;
    if (cost === undefined) continue;
    nearest.set(n.constellation, Math.min(nearest.get(n.constellation) ?? cost, cost));
  }
  const costs = [...nearest.values()];
  if (costs.length === 0) return '';
  const least = Math.min(...costs);
  return costs.every((c) => c === least)
    ? `Every constellation’s first notable is ${pointsWord(least)} from the centre.`
    : `The nearest notable is ${pointsWord(least)} from the centre.`;
}

/** "Your tree holds 19 points; your Rank and Deeds give 11. Embarking keeps the nearest 11…" */
export function overBudgetLine(held: number, points: number): string {
  return `Your tree holds ${pointsWord(held)}, and your Rank and Deeds give ${points}: Skip the unlocks is off. Embarking keeps the ${points} nearest the centre. Give some back to choose which.`;
}

/** The accessible name of a star on the map. */
export function starLabel(node: AstrolabeNode, state: StarState, p: StarPreview | null): string {
  const where = starConstellations(node)
    .map((c) => CONSTELLATION_NAME[c])
    .join(' and ');
  const what =
    node.kind === 'start' ? '' : `${KIND_LABEL[node.kind]}${where ? `, ${where}` : ''}. `;
  const status =
    state === 'centre'
      ? ''
      : state === 'owned'
        ? 'Taken. '
        : state === 'takeable'
          ? 'Can be taken. '
          : 'Out of reach for now. ';
  return `${node.name}. ${what}${astrolabeText(node)}. ${status}${p ? previewLine(p) : ''}`.trim();
}

const CONSTELLATION_NAME: Readonly<Record<Constellation, string>> = {
  silk: 'Silk',
  choir: 'Choir',
  aegis: 'Aegis',
  bond: 'Bond',
};

// ── Sounds ────────────────────────────────────────────────────────────────────────────

/**
 * The sound a take plays: a keystone's own (even at the end of a path), else several stars at
 * once, else a notable's or a travel star's.
 */
export function takeSound(path: readonly string[]): UiSound {
  const last = path[path.length - 1];
  if (!last) return 'cantAfford';
  const target = astrolabeNode(last);
  if (target.kind === 'keystone') return 'starKeystone';
  if (path.length > 1) return 'starPath';
  return target.kind === 'notable' || target.kind === 'great' ? 'starNotable' : 'starTake';
}

// ── Moving with the keyboard ──────────────────────────────────────────────────────────

/**
 * The star an arrow key moves to from `fromId`: the nearest in that direction (within 75° of
 * it), linked stars first. `dx`, `dy` on screen (y down). Null when there's none. The angle
 * weighs more than the distance, so a bridge straight ahead beats a linked star off to the side.
 */
export function starToward(fromId: string, dx: number, dy: number): string | null {
  const from = starAt(astrolabeNode(fromId));
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const linked = new Set(neighbours(fromId));
  let best: { id: string; score: number } | null = null;
  for (const n of STARS) {
    if (n.id === fromId) continue;
    const p = starAt(n);
    const vx = p.x - from.x;
    const vy = p.y - from.y;
    const d = Math.hypot(vx, vy);
    if (d < 1e-6) continue;
    const cos = (vx * ux + vy * uy) / d;
    if (cos < Math.cos((75 * Math.PI) / 180)) continue;
    const score = d * (1 + 8 * (1 - cos)) * (linked.has(n.id) ? 0.7 : 1);
    if (!best || score < best.score - 1e-9) best = { id: n.id, score };
  }
  return best?.id ?? null;
}

// ── What the tree adds up to ──────────────────────────────────────────────────────────

export type StatKey =
  | 'mend'
  | 'empower'
  | 'reach'
  | 'life'
  | 'aura'
  | 'reserve'
  | 'field'
  | 'ward'
  | 'wardRecovery'
  | 'perfect'
  | 'techCost'
  | 'techCooldown'
  | 'spiritRegen'
  | 'heroLife'
  | 'heroDamage'
  | 'bleedOut'
  | 'revive'
  | 'soloCharge'
  | 'cuedSolo';

/** Each stat: the constellation it's shown under, and how it reads with its total. */
const STATS: readonly { key: StatKey; group: Constellation; text: (v: string) => string }[] = [
  { key: 'mend', group: 'silk', text: (v) => `Mend +${v}%` },
  { key: 'empower', group: 'silk', text: (v) => `Empower +${v}%` },
  { key: 'reach', group: 'silk', text: (v) => `The Thread reaches ${v} m farther` },
  { key: 'life', group: 'silk', text: (v) => `Your Life +${v}%` },
  { key: 'aura', group: 'choir', text: (v) => `Aura effect +${v}%` },
  { key: 'reserve', group: 'choir', text: (v) => `Songs reserve ${v}% less` },
  { key: 'field', group: 'choir', text: (v) => `Your field is ${v}% wider` },
  { key: 'ward', group: 'aegis', text: (v) => `Ward barrier +${v}%` },
  { key: 'wardRecovery', group: 'aegis', text: (v) => `Ward recovers ${v} s faster` },
  { key: 'perfect', group: 'aegis', text: (v) => `Perfect Wards ${v} s more forgiving` },
  { key: 'techCost', group: 'aegis', text: (v) => `Techniques cost ${v}% less` },
  { key: 'techCooldown', group: 'aegis', text: (v) => `Techniques recover ${v}% faster` },
  { key: 'spiritRegen', group: 'aegis', text: (v) => `Spirit regenerates ${v}% faster` },
  { key: 'heroLife', group: 'bond', text: (v) => `Heroes +${v}% life` },
  { key: 'heroDamage', group: 'bond', text: (v) => `Heroes deal ${v}% more damage` },
  { key: 'bleedOut', group: 'bond', text: (v) => `Downed heroes bleed out ${v}% slower` },
  { key: 'revive', group: 'bond', text: (v) => `Mend revives ${v}% faster` },
  { key: 'soloCharge', group: 'bond', text: (v) => `Solos charge ${v}% faster` },
  { key: 'cuedSolo', group: 'bond', text: (v) => `Cued Solos last ${v}% longer` },
];

/**
 * What a star adds to each stat, from its content values (the sim's resolver adds the same
 * "% more" within the tree: sim/astrolabe.ts). Stars whose effect is a rule of its own add none
 * here: they are listed by name.
 */
export function starStats(node: AstrolabeNode): Partial<Record<StatKey, number>> {
  const v = node.values;
  const pct = v.pct ?? 0;
  switch (node.effect) {
    case 'thread':
      return { mend: pct, empower: pct };
    case 'spun_silver':
      return { reach: v.range ?? 0, mend: pct, empower: pct };
    case 'mend':
      return { mend: pct };
    case 'empower':
      return { empower: pct };
    case 'life':
      return { life: pct };
    case 'aura_effect':
      return { aura: pct };
    case 'clear_voice':
      return { aura: pct, reserve: v.reserve ?? 0 };
    case 'reserve':
      return { reserve: pct };
    case 'field':
      return { field: pct };
    case 'ward':
      return { ward: pct };
    case 'shieldwright':
      return { ward: pct, wardRecovery: v.seconds ?? 0 };
    case 'perfect':
      return { perfect: v.seconds ?? 0 };
    case 'tech_cost':
      return { techCost: pct };
    case 'tech_cooldown':
      return { techCooldown: pct };
    case 'spirit_regen':
      return { spiritRegen: pct };
    case 'hero_life':
      return { heroLife: pct };
    case 'hero_damage':
      return { heroDamage: pct };
    case 'fellowship':
      return { heroLife: v.life ?? 0, heroDamage: v.damage ?? 0 };
    case 'bleed_out':
      return { bleedOut: pct };
    case 'revive_speed':
      return { revive: pct };
    case 'solo_charge':
      return { soloCharge: pct };
    case 'cued_solo':
      return { cuedSolo: pct };
    default:
      return {};
  }
}

/** "9", "0.06" (no float dust). */
export function num(v: number): string {
  return String(Number(v.toFixed(2)));
}

export interface TotalLine {
  key: StatKey;
  value: number;
  text: string;
}

export interface TreeTotals {
  /** Stat totals by constellation, in map order; empty groups left out. */
  groups: { constellation: Constellation; lines: TotalLine[] }[];
  /** Notables and great notables whose effect is a rule of its own, by name. */
  rules: AstrolabeNode[];
  /** Keystones taken. */
  keystones: AstrolabeNode[];
}

/** What a tree adds up to: totals by stat, then the rules its notables add, then keystones. */
export function treeTotals(tree: readonly string[]): TreeTotals {
  const sum = new Map<StatKey, number>();
  const rules: AstrolabeNode[] = [];
  const keystones: AstrolabeNode[] = [];
  const owned = new Set(tree);
  for (const node of STARS) {
    if (!owned.has(node.id)) continue;
    if (node.kind === 'keystone') {
      keystones.push(node);
      continue;
    }
    const stats = Object.entries(starStats(node)) as [StatKey, number][];
    for (const [k, v] of stats) sum.set(k, (sum.get(k) ?? 0) + v);
    if (stats.length === 0 && node.kind !== 'start' && node.kind !== 'travel') rules.push(node);
  }
  const groups = CONSTELLATIONS.map((constellation) => ({
    constellation,
    lines: STATS.filter((s) => s.group === constellation && (sum.get(s.key) ?? 0) > 0).map((s) => ({
      key: s.key,
      value: sum.get(s.key)!,
      text: s.text(num(sum.get(s.key)!)),
    })),
  })).filter((g) => g.lines.length > 0);
  return { groups, rules, keystones };
}

/**
 * Which sentences of a keystone's text are its price (content has no field for it): the
 * rest are what it gives. Indices from the start, or from the end when negative.
 */
const KEYSTONE_PRICE: Readonly<Record<string, readonly number[]>> = {
  overflowing_grace: [-1],
  sanguine_font: [0, -1],
  prism_covenant: [0],
  unbroken_chorus: [-1],
  shatterproof_halo: [-1],
  eldritch_conduit: [0],
};

/** A keystone's text as what it gives and what it costs you, sentence by sentence. */
export function keystoneParts(node: AstrolabeNode): { gains: string[]; prices: string[] } {
  const sentences = astrolabeText(node)
    .split(/(?<=\.)\s+/)
    .map((s) => s.replace(/\.$/, '').trim())
    .filter(Boolean);
  const marks = KEYSTONE_PRICE[node.effect] ?? [];
  const price = new Set(marks.map((i) => (i < 0 ? sentences.length + i : i)));
  return {
    gains: sentences.filter((_, i) => !price.has(i)),
    prices: sentences.filter((_, i) => price.has(i)),
  };
}

/** The keystones among some stars, in content order. */
export function keystonesOf(ids: readonly string[]): AstrolabeNode[] {
  const set = new Set(ids);
  return STARS.filter((n) => n.kind === 'keystone' && set.has(n.id));
}

/** How many stars of a constellation are lit. */
export function litIn(tree: readonly string[], c: Constellation): number {
  const owned = new Set(tree);
  return constellationStars(c).filter((n) => owned.has(n.id)).length;
}

// ── Ranks ─────────────────────────────────────────────────────────────────────────────

/**
 * What a Rank gives the Astrolabe, for the rank-up card, the Rank panel and the Codex: it opens
 * (with its points), then a point a Rank. `deeds`: the points the player's Deeds give (Phase 4b,
 * `deedPoints`), which count from the Astrolabe's Rank, so "opens with" and "in all" are what the
 * profile store gives. Null below it.
 */
export function rankAstrolabeLine(rank: number, deeds = 0): string | null {
  if (rank < ASTROLABE_RANK) return null;
  const points = astrolabePoints(rank, false, deeds);
  if (rank === ASTROLABE_RANK) return `It opens with ${pointsWord(points)} to spend.`;
  const gain = points - astrolabePoints(rank - 1, false, deeds);
  if (gain <= 0) return null;
  return `+${pointsWord(gain).replace(' point', ' Astrolabe point')} (${points} in all).`;
}

/** The Astrolabe is open: the Rank reached it, or Settings → Skip the unlocks. */
export function astrolabeOpen(rank: number, unlockAll: boolean): boolean {
  return unlockAll || rank >= ASTROLABE_RANK;
}

// ── What the tree does to the songs and techniques, outside a fight ───────────────────

function treeNodes(tree: readonly string[]): AstrolabeNode[] {
  const set = new Set(tree);
  return STARS.filter((n) => set.has(n.id));
}

/** The stars that make the songs lighter (or hold Life): Clear Voice, Breath, the keystones. */
export function reserveStars(tree: readonly string[]): AstrolabeNode[] {
  const effects = new Set(['clear_voice', 'reserve', 'eldritch_conduit', 'sanguine_font']);
  return treeNodes(tree).filter((n) => effects.has(n.effect));
}

/**
 * The tree's multiplier on the Weaver's whole Life (Blood: "% more", added within the tree), as
 * the sim's resolver applies it (`mods.lifeMult`). The UI test pins it to a real sim.
 */
export function treeLifeMult(tree: readonly string[]): number {
  let life = 0;
  for (const n of treeNodes(tree)) if (n.effect === 'life') life += n.values.pct ?? 0;
  return 1 + life / 100;
}

/** What techniques cost with the tree (Economy), outside Stasis (`mods.techCostMult`). */
export function treeTechCostMult(tree: readonly string[]): number {
  let less = 0;
  for (const n of treeNodes(tree)) if (n.effect === 'tech_cost') less += n.values.pct ?? 0;
  return Math.max(0, 1 - less / 100);
}

/** Eldritch Conduit: techniques cost Life instead of Spirit. */
export function treeTechniquesCostLife(tree: readonly string[]): boolean {
  return treeNodes(tree).some((n) => n.effect === 'eldritch_conduit');
}

/** Prism Covenant: the share of her Life the Weaver fights at and can be healed to (1: all). */
export function treeLifeCap(tree: readonly string[]): number {
  let cap = 1;
  for (const n of treeNodes(tree))
    if (n.effect === 'prism_covenant') cap = Math.min(cap, (n.values.cap ?? 100) / 100);
  return cap;
}

/** Grit: how much slower downed heroes bleed out (`mods.bleedOutMult`). */
export function treeBleedOutMult(tree: readonly string[]): number {
  let slower = 0;
  for (const n of treeNodes(tree)) if (n.effect === 'bleed_out') slower += n.values.pct ?? 0;
  return 1 + slower / 100;
}

/** Afterglow: seconds Empower lingers on a hero the Thread leaves (0: not in the tree). */
export function treeAfterglow(tree: readonly string[]): number {
  let seconds = 0;
  for (const n of treeNodes(tree))
    if (n.effect === 'afterglow') seconds = Math.max(seconds, n.values.seconds ?? 0);
  return seconds;
}

/** Overflowing Grace is in the tree (Mend's overheal becomes a shield). */
export function treeGrace(tree: readonly string[]): AstrolabeNode | null {
  return treeNodes(tree).find((n) => n.effect === 'overflowing_grace') ?? null;
}

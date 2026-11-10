/**
 * Phase 5g (docs/phase-5g.md): the trigger system on screen. A motif, relic or boon whose rule is
 * a trigger fires `motifTriggered` and counts into `ledger.triggers`; the HUD's chips read the
 * counts' rises (as the relic bar flashes without seeing events) and the Result and the Summary
 * read the totals ("Clean Strike triggered 3 times."). Pure: the tests and the UI lab call it
 * with hand-made counts and, before the fill's content is in `CONTENT`, a fixture content.
 */
import { CONTENT, type Content, type MotifDef, type RelicRarity } from '../../content';
import type { IconName } from '../kit/iconPaths';

/** What fired: a motif (its category), a relic (its rarity) or a boon or bane. */
export interface TriggerSource {
  id: string;
  /** Its content name. */
  name: string;
  kind: 'motif' | 'relic' | 'boon';
  /** A motif's category (its colour and glyph, as on its card). */
  category?: MotifDef['category'];
  /** A relic's rarity (its colour, as on the relic bar). */
  rarity?: RelicRarity;
  /** A boon's kind. */
  bane?: boolean;
}

/** The content lists a source is named from (`CONTENT`, or a fixture shaped like it). */
export type TriggerContent = Pick<Content, 'motifs' | 'relics' | 'boons'>;

/**
 * A trigger's source by content id, in resolution order (motifs, then relics, then boons, as the
 * sim arms them). Null for an id content doesn't know: it is never named, so never shown.
 */
export function triggerSource(id: string, content: TriggerContent = CONTENT): TriggerSource | null {
  const m = content.motifs.find((x) => x.id === id);
  if (m) return { id, name: m.name, kind: 'motif', category: m.category };
  const r = content.relics.find((x) => x.id === id);
  if (r) return { id, name: r.name, kind: 'relic', rarity: r.rarity };
  const b = content.boons.find((x) => x.id === id);
  if (b) return { id, name: b.name, kind: 'boon', bane: b.kind === 'bane' };
  return null;
}

/**
 * A source's glyph from the Icon kit: a motif's category's (as `CATEGORY` in `kit/Chip.tsx`
 * draws it; the tests hold them equal), a relic's, a boon's.
 */
export const CATEGORY_ICON: Readonly<Record<MotifDef['category'], IconName>> = {
  silk: 'thread',
  aegis: 'ward',
  choir: 'note',
  bond: 'link',
  finale: 'sparkle',
};

export function triggerIcon(s: TriggerSource): IconName {
  if (s.kind === 'motif' && s.category) return CATEGORY_ICON[s.category];
  return s.kind === 'relic' ? 'relic' : 'star';
}

// ── The HUD's chips ──────────────────────────────────────────────────────────────────

/** A chip stays this long (sim seconds) after its source last fired. */
export const TRIGGER_CHIP_SECONDS = 2.2;
/** At most this many chips at once: the newest stay, the oldest go. */
export const TRIGGER_CHIPS_MAX = 3;

export interface TriggerChip {
  source: TriggerSource;
  /** Fires since the chip appeared ("×3"). */
  count: number;
  /** Sim time of its last fire. */
  at: number;
  /** Sim time it appeared (its key: a new chip for the same source is a new element). */
  since: number;
}

/**
 * One HUD snapshot's step. A source whose count rose gets a chip; while that chip still shows,
 * further fires add to its count rather than adding chips, so a trigger firing every tick shows
 * as one chip counting up (the rate limit). A count that fell (a new fight) starts afresh.
 * Chips older than `TRIGGER_CHIP_SECONDS` since their last fire go; the newest
 * `TRIGGER_CHIPS_MAX` stay, newest first.
 */
export function stepTriggerChips(
  chips: readonly TriggerChip[],
  prev: Readonly<Record<string, number>> | null | undefined,
  next: Readonly<Record<string, number>> | null | undefined,
  now: number,
  content: TriggerContent = CONTENT,
): TriggerChip[] {
  let out = chips.filter((c) => now - c.at < TRIGGER_CHIP_SECONDS && c.at <= now);
  if (prev && next) {
    for (const [id, n] of Object.entries(next)) {
      const rose = n - (prev[id] ?? 0);
      if (rose <= 0) continue;
      const live = out.find((c) => c.source.id === id);
      if (live) {
        out = out.map((c) => (c === live ? { ...c, count: c.count + rose, at: now } : c));
        continue;
      }
      const source = triggerSource(id, content);
      if (!source) continue;
      out = [...out, { source, count: rose, at: now, since: now }];
    }
  }
  return out
    .slice()
    .sort((a, b) => b.at - a.at || b.since - a.since)
    .slice(0, TRIGGER_CHIPS_MAX);
}

/** A chip's words: "Clean Strike", "Clean Strike ×3". */
export function triggerChipText(c: Pick<TriggerChip, 'source' | 'count'>): string {
  return c.count > 1 ? `${c.source.name} ×${c.count}` : c.source.name;
}

// ── The Result and the Summary ───────────────────────────────────────────────────────

export interface TriggerTally {
  source: TriggerSource;
  count: number;
}

/**
 * The fight's (or the run's) fires, named from content, in the order the counts hold them (the
 * sim's resolution order: motifs, relics, boons). Ids content doesn't know are left out.
 */
export function triggerTallies(
  triggers: Readonly<Record<string, number>> | null | undefined,
  content: TriggerContent = CONTENT,
): TriggerTally[] {
  if (!triggers) return [];
  const out: TriggerTally[] = [];
  for (const [id, count] of Object.entries(triggers)) {
    const source = triggerSource(id, content);
    if (source) out.push({ source, count });
  }
  return out;
}

/** "Clean Strike triggered 3 times." / "… once." / "… never triggered." */
export function triggerSentence(t: TriggerTally): string {
  if (t.count <= 0) return `${t.source.name} never triggered.`;
  if (t.count === 1) return `${t.source.name} triggered once.`;
  return `${t.source.name} triggered ${t.count.toLocaleString('en-US')} times.`;
}

import type { CSSProperties } from 'react';
import type { RelicRarity } from '../../content';
import { Icon } from './Icon';

/**
 * Line-art glyphs for relics, boons and events (Phase 3b), keyed by content `icon`. Same
 * 24×24 grid, stroke and round caps as the Icon kit, so they sit next to it.
 */
export const GLYPHS: Readonly<Record<string, string>> = {
  // Relics
  thimble:
    'M8 19.5V9.5a4 4 0 0 1 8 0v10 M6.5 19.5h11 M10.2 10.5h.01 M13.8 10.5h.01 M12 12.7h.01 M10.2 14.9h.01 M13.8 14.9h.01 M12 17.1h.01',
  lantern:
    'M12 2.8v2.4 M9 5.2h6 M7.5 7.7h9 M8.5 7.7l.8 10.6h5.4l.8-10.6 M7.5 18.3h9 M12 10.6c1.2 1.2 1.5 2.2 1.1 3.1a1.2 1.2 0 0 1-2.2 0c-.4-.9-.1-1.9 1.1-3.1z',
  robe: 'M19.5 4C12 5 7 10 5.8 18.2L4.5 20.5 M19.5 4c.6 5.6-3.4 10.6-9.6 12.3 M15.5 8.5l-6.8 6.8 M17.6 10.5l-3.4.2 M14.8 14l-3.2.1',
  key: 'M7.5 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M11 12h10 M18 12v3.2 M15.2 12v2.4',
  fork: 'M9 3v7a3 3 0 0 0 6 0V3 M12 13v6.5 M10 20.5h4 M5.5 5.5v4 M18.5 5.5v4 M3.5 6.5v2 M20.5 6.5v2',
  baton: 'M4.5 19.5L17.5 6.5 M15.6 4.6l3.8 3.8 M3.2 20.8l2.4-2.4 M19.8 3.5l.7.7',
  bell: 'M12 3.5a1 1 0 0 1 1 1v.7A6 6 0 0 1 18 11v4l2 2.5H4L6 15v-4a6 6 0 0 1 5-5.8v-.7a1 1 0 0 1 1-1z M10 20a2 2 0 0 0 4 0 M12.8 8l-1.6 2.6 1.8 1.6-1.4 2.6',
  veil: 'M6 20.5V9.5a6 6 0 0 1 12 0v11 M6 20.5c2-1.1 4-1.1 6 0s4 1.1 6 0 M9.5 11v7 M14.5 11v7',
  hymnal:
    'M4 5.5c2.7-1 5.4-.8 8 .8v14c-2.6-1.6-5.3-1.8-8-.8z M20 5.5c-2.7-1-5.4-.8-8 .8v14c2.6-1.6 5.3-1.8 8-.8z M15 9.5v4.2 M15 9.5l2.6-.8 M15 13.7a1.1 1.1 0 1 1-1.1-1.1',
  star: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M12 7l1.3 3.7L17 12l-3.7 1.3L12 17l-1.3-3.7L7 12l3.7-1.3z',
  loom: 'M5 3.5v17 M19 3.5v17 M3.5 6h17 M3.5 18h17 M9 6v12 M12 6v12 M15 6v12',
  metronome: 'M6.5 20.5h11L14.5 3.5h-5z M12 16.5l3.6-8.4 M8.1 16.5h7.8 M14.8 9.8l1.6.4',
  spindle:
    'M12 2.5v19 M7.5 10c0-2.6 2-4.3 4.5-4.3s4.5 1.7 4.5 4.3v4c0 2.6-2 4.3-4.5 4.3S7.5 16.6 7.5 14z M7.6 11h8.8 M7.6 13h8.8',
  score: 'M5.5 3.5h13v17h-13z M8 7.5h8 M8 10.5h8 M8 13.5h8 M8 16.5h4.5',
  halo: 'M12 5.5c4.7 0 8.5 1.6 8.5 3.5s-3.8 3.5-8.5 3.5S3.5 10.9 3.5 9 7.3 5.5 12 5.5z M12.8 5.6l-1.2 2.1 1.6 1.4-1 2.1 M8.5 15.5l-1.5 3.5 M15.5 15.5l1.5 3.5 M12 15.5v4.5',
  // Boons and banes
  note: 'M9 17.5V6l10-2v11.5 M9 17.5a2.75 2.75 0 1 1-2.75-2.75A2.75 2.75 0 0 1 9 17.5z M19 15.5a2.75 2.75 0 1 1-2.75-2.75A2.75 2.75 0 0 1 19 15.5z',
  frayed:
    'M3.5 12h8.5 M12 12l3.2-3.4 M12 12l4.4.4 M12 12l3 3.6 M16.6 6.8l2.2-1.6 M18.2 12.6h2.4 M16.7 17.2l2 1.7',
  // Events
  cantor:
    'M12 3.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 21c0-5 2.6-8.5 6-8.5s6 3.5 6 8.5 M16.6 4.5l2.2-1.2 M17.2 7h2.6 M16.6 9.4l2.2 1.2',
  discord:
    'M12 3.5a1 1 0 0 1 1 1v.7A6 6 0 0 1 18 11v4l2 2.5H4L6 15v-4a6 6 0 0 1 5-5.8v-.7a1 1 0 0 1 1-1z M10 20a2 2 0 0 0 4 0 M13.4 7.5l-2.2 3 2.4 1.8-2 3.4',
  pool: 'M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2-1.5 4.5-1.5S19 15 21 15 M5 19c1.6 0 1.6-1.2 3.5-1.2S10.5 19 12 19s1.6-1.2 3.5-1.2S17.4 19 19 19 M12 3.5c1.8 2.3 2.7 3.9 2.7 5.2a2.7 2.7 0 0 1-5.4 0c0-1.3.9-2.9 2.7-5.2z',
  hood: 'M12 3c-4 0-6.5 3.5-6.5 8.5V21h13v-9.5C18.5 6.5 16 3 12 3z M9 12.2c1.2-1 4.8-1 6 0v3c-1.2 1.2-4.8 1.2-6 0z',
  reliquary:
    'M4.5 10.5h15v10h-15z M4.5 10.5a7.5 6 0 0 1 15 0 M4.5 14h15 M12 14v3.2 M12 4.5v-1.5 M10.5 3.8h3',
};

/** A relic glyph's path data (a plain diamond for an unknown key). */
export function glyphPath(icon: string): string {
  return GLYPHS[icon] ?? 'M12 3l7 9-7 9-7-9z';
}

/** How each relic rarity looks. Colour is never alone: there's a label and a pip glyph too. */
export const RELIC_RARITY: Readonly<
  Record<RelicRarity, { label: string; color: string; pips: number; glow: boolean }>
> = {
  common: { label: 'Common', color: '#cbd5e1', pips: 1, glow: false },
  rare: { label: 'Rare', color: '#60a5fa', pips: 2, glow: false },
  legendary: { label: 'Legendary', color: '#fdba74', pips: 3, glow: true },
  cursed: { label: 'Cursed', color: '#fb7185', pips: 0, glow: false },
};

/** A cursed relic whose curse a forge lifted: calm, still marked as once-cursed. */
export const CLEANSED = { label: 'Cleansed', color: '#a5b4fc' } as const;

/** The colour a relic is drawn in (a cleansed curse is tamed). */
export function relicColor(rarity: RelicRarity, cleansed = false): string {
  return rarity === 'cursed' && cleansed ? CLEANSED.color : RELIC_RARITY[rarity].color;
}

/** A bare glyph (no badge), in currentColor. */
export function Glyph({
  icon,
  size = 20,
  className,
  style,
}: {
  icon: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
      style={style}
    >
      <path d={glyphPath(icon)} />
    </svg>
  );
}

/**
 * A relic as a badge: the glyph in a disc ringed in its rarity's colour. Cursed relics get a
 * dashed ring and a skull; cleansed ones a calm solid ring and a check. Legendary ones glow.
 */
export function RelicGlyph({
  icon,
  rarity,
  cleansed = false,
  size = 40,
  className = '',
  style,
}: {
  icon: string;
  rarity: RelicRarity;
  cleansed?: boolean;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const color = relicColor(rarity, cleansed);
  const cursed = rarity === 'cursed' && !cleansed;
  const badge = Math.max(12, Math.round(size * 0.38));
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        color,
        border: `${size >= 36 ? 2 : 1.5}px ${cursed ? 'dashed' : 'solid'} ${color}`,
        background: cursed
          ? 'radial-gradient(circle at 50% 40%, rgb(244 63 94 / 0.28), rgb(10 16 34 / 0.92) 70%)'
          : `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${color} 22%, transparent), rgb(10 16 34 / 0.92) 72%)`,
        boxShadow: RELIC_RARITY[rarity].glow
          ? `0 0 ${Math.round(size * 0.35)}px color-mix(in srgb, ${color} 55%, transparent)`
          : undefined,
        ...style,
      }}
      aria-hidden
    >
      <Glyph icon={icon} size={Math.round(size * 0.58)} />
      {rarity === 'cursed' && size >= 24 && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-ink-900 text-ink-950"
          style={{ width: badge, height: badge, background: color }}
        >
          <Icon name={cleansed ? 'check' : 'skull'} size={Math.round(badge * 0.72)} />
        </span>
      )}
    </span>
  );
}

/** A rarity label: colour, 1–3 diamonds (legendary: stars) or a skull, and the word. */
export function RelicRarityChip({
  rarity,
  cleansed = false,
}: {
  rarity: RelicRarity;
  cleansed?: boolean;
}) {
  const r = RELIC_RARITY[rarity];
  const color = relicColor(rarity, cleansed);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium"
      style={{
        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span className="flex" aria-hidden>
        {rarity === 'cursed' ? (
          <Icon name={cleansed ? 'check' : 'skull'} size={11} />
        ) : (
          Array.from({ length: r.pips }, (_, i) => (
            <Icon
              key={i}
              name={rarity === 'legendary' ? 'star' : 'diamond'}
              size={10}
              solid
              className="-mr-0.5"
            />
          ))
        )}
      </span>
      {rarity === 'cursed' && cleansed ? 'Cursed · cleansed' : r.label}
    </span>
  );
}

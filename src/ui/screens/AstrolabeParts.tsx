import { astrolabeText, type AstrolabeNode } from '../../content';
import { AstrolabeGlyph, KeystoneBadge } from '../kit/AstrolabeGlyph';
import { constellationLook } from '../kit/astrolabeLook';
import { Tip } from '../kit/Tip';
import { keystoneParts, keystonesOf, spendLine, starGlyph } from './astrolabeModel';

/** A keystone's tooltip: its name, what it gives and its price. */
export function KeystoneTip({ node }: { node: AstrolabeNode }) {
  const parts = keystoneParts(node);
  const look = constellationLook(node.constellation);
  return (
    <span className="flex flex-col gap-1">
      <span
        className="flex items-center gap-1.5 font-display text-sm font-bold"
        style={{ color: look.light }}
      >
        <KeystoneBadge glyph={starGlyph(node)} constellation={node.constellation} size={20} />
        {node.name}
        <span className="font-sans text-xs font-normal text-muted">· Keystone, {look.name}</span>
      </span>
      {parts.gains.map((s) => (
        <span key={s} className="text-xs leading-snug text-text">
          <b className="text-gold-300">+</b> {s}
        </span>
      ))}
      {parts.prices.map((s) => (
        <span key={s} className="text-xs leading-snug text-rose-200">
          <b className="text-rose-300">−</b> {s}
        </span>
      ))}
    </span>
  );
}

/** The keystones a tree holds, as named chips (each its own tooltip). Nothing without one. */
export function KeystoneChips({
  tree,
  className = '',
  align = 'end',
}: {
  tree: readonly string[];
  className?: string;
  align?: 'start' | 'center' | 'end';
}) {
  const keystones = keystonesOf(tree);
  if (keystones.length === 0) return null;
  return (
    <ul
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      aria-label={`Keystones: ${keystones.map((k) => k.name).join(', ')}`}
      data-testid="keystone-chips"
    >
      {keystones.map((k) => {
        const look = constellationLook(k.constellation);
        return (
          <li key={k.id}>
            <Tip tip={<KeystoneTip node={k} />} align={align} width="w-80">
              <span
                tabIndex={0}
                className="flex items-center gap-1 rounded-lg border bg-ink-900/80 py-0.5 pl-0.5 pr-2 text-xs font-semibold"
                style={{
                  color: look.light,
                  borderColor: `color-mix(in srgb, ${look.color} 60%, transparent)`,
                }}
                aria-label={`${k.name}: ${astrolabeText(k)}`}
              >
                <KeystoneBadge glyph={starGlyph(k)} constellation={k.constellation} size={20} />
                {k.name}
              </span>
            </Tip>
          </li>
        );
      })}
    </ul>
  );
}

/** The button that opens the Astrolabe: its glyph, and the points left to spend (or spent). */
export function AstrolabeButtonLabel({ spent, points }: { spent: number; points: number }) {
  const left = points - spent;
  return (
    <>
      <AstrolabeGlyph glyph="weaver_star" size={16} />
      Astrolabe
      <span
        className={`rounded-md px-1.5 py-px text-xs font-semibold ${
          left > 0
            ? 'bg-gold-400 text-ink-950'
            : left < 0
              ? 'bg-threat/20 text-orange-200'
              : 'bg-ink-700 text-muted'
        }`}
        data-testid="astrolabe-points-badge"
      >
        {left === 0 ? `${spent}/${points}` : spendLine(left)}
      </span>
    </>
  );
}

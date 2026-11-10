import { Icon } from '../kit/Icon';
import type { HeroHud } from '../store';
import { AnswerGlyph } from './AnswerGlyph';
import { t } from '../text';

/**
 * A possessed hero's frame (docs/phase-5c.md): an indigo border, never the enemy bar's red or
 * Focus gold. The same family as the model's rim in the world.
 */
export const POSSESSED_COLOR = '#818cf8';

/**
 * A possessed hero's strip (docs/phase-5c.md): who they strike now, and the Chime that frees them
 * (hidden under Blind Score).
 */
export function PossessedStrip({
  possessed,
  blind = false,
}: {
  possessed: NonNullable<HeroHud['possessed']>;
  blind?: boolean;
}) {
  return (
    <p
      className="mt-1.5 flex items-center gap-1.5 rounded-md border-2 px-2 py-1 text-xs font-bold"
      style={{
        borderColor: POSSESSED_COLOR,
        color: '#e0e7ff',
        background: 'rgb(49 46 129 / 0.45)',
      }}
      role="status"
      data-testid="possessed-strip"
    >
      <Icon name="mask" size={14} />
      <span className="uppercase tracking-wider">{t('hud.riftMarks.possessed')}</span>
      {possessed.victim && (
        <span className="flex items-center gap-1 font-semibold" data-testid="possessed-victim">
          <Icon name="arrow" size={12} />
          {possessed.victim}
        </span>
      )}
      {!blind && (
        <span className="ml-auto">
          <AnswerGlyph tag="chime" />
        </span>
      )}
    </p>
  );
}

/** A Stitch joining two frames: the needle, a link, and the hero it joins them to. */
export function StitchChip({
  slots,
  names,
}: {
  slots: readonly number[];
  /** The party's names by slot. */
  names: readonly (string | undefined)[];
}) {
  return (
    <span
      className="flex items-center gap-1 whitespace-nowrap rounded-md border px-1 text-xs font-bold leading-5"
      style={{ borderColor: '#c4b5fd', color: '#ddd6fe', background: 'rgb(46 16 101 / 0.4)' }}
      title={t('hud.riftMarks.stitchedTogetherAChime')}
      data-testid="stitched-with"
    >
      <Icon name="needle" size={12} />
      <Icon name="link" size={12} />
      {slots.map((slot) => names[slot] ?? `${slot + 1}`).join(', ')}
    </span>
  );
}

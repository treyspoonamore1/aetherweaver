import { Fold } from '../kit/Fold';
import { noVariants } from '../../meta/variants';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Panel } from '../kit/Panel';
import { TechniqueCard } from './TechniquesParts';
import { codexLines, optionState, sourceText, techniqueSlots } from './variantsModel';
import { t } from '../text';

/**
 * The Codex's Techniques page (Phase 4f): what variants are and how they're chosen, kept and had;
 * then each slot's default and its variants (content's names, texts, costs and cooldowns), each
 * marked owned, open (Skip the unlocks) or locked, with how it's had.
 */
export function TechniquesCodexPage({
  owned,
  all,
}: {
  /** The variants the profile owns. */
  owned: readonly string[];
  /** Settings → Skip the unlocks: every variant is open. */
  all: boolean;
}) {
  const slots = techniqueSlots({ techniques: noVariants(), owned, all });
  const lines = codexLines();
  return (
    <div className="flex flex-col gap-6" data-testid="codex-techniques">
      <Panel tone="gold" className="p-5">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
          <Icon name="ward" size={22} /> {t('screens.techniquesCodex.techniqueVariants')}
        </h2>
        {lines.map((line, i) => (
          <p
            key={i}
            className="mt-2 max-w-5xl text-sm leading-relaxed text-text"
            data-testid="codex-techniques-line"
          >
            {line}
          </p>
        ))}
      </Panel>
      {/* One slot open, the others a fold away (the second menu text pass, round 11). */}
      {slots.map((view, i) => (
        <Fold
          key={view.slot}
          label={view.name}
          open={i === 0}
          count={view.options.length}
          headingClass="text-gold-300"
          testId={`codex-technique-slot-${view.slot}`}
          heading={
            <span id={`codex-slot-${view.slot}`} className="flex items-center gap-2">
              <KeyCap label={view.key} accent /> {view.name}
            </span>
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
            {view.options.map((o) => (
              <TechniqueCard
                key={o.id ?? 'default'}
                option={o}
                state={optionState(o, all)}
                source={o.id ? sourceText(o.id) : undefined}
              />
            ))}
          </div>
        </Fold>
      ))}
    </div>
  );
}

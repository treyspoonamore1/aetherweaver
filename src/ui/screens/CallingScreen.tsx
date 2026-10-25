import { useEffect } from 'react';
import { useRun } from '../../app/runStore';
import { callingDef, callingOption, optionText } from '../../content';
import type { RunState } from '../../meta/types';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Panel } from '../kit/Panel';

/**
 * The Calling's next tier (docs/phase-3c.md): pick one of two options. A plain first version;
 * the Phase 3c UI pass gives it its own look (and Third Voice's song builder).
 */
export function CallingView({ run, onPick }: { run: RunState; onPick(index: 0 | 1): void }) {
  const offer = run.callingOffer;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') onPick(0);
      else if (e.key === '2') onPick(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPick]);
  if (!offer || !run.calling) return null;
  const def = callingDef(run.calling.id);
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-8">
        <ScreenHeader
          eyebrow={`The ${def.name} · tier ${offer.tier + 1} of ${def.tiers.length}`}
          title="Your Calling grows"
        >
          Choose one. It lasts the rest of the run.
        </ScreenHeader>
        <div className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="calling-options">
          {offer.options.map((id, i) => {
            const option = callingOption(id);
            return (
              <Panel key={id} tone="gold" className="flex flex-col gap-3 p-5">
                <p className="font-display text-xl font-bold text-gold-200">{option.name}</p>
                <p className="flex-1 text-base text-text">{optionText(option)}</p>
                <Button variant="primary" onClick={() => onPick(i as 0 | 1)}>
                  Choose ({i + 1})
                </Button>
              </Panel>
            );
          })}
        </div>
      </div>
    </ScreenFrame>
  );
}

export function CallingScreen() {
  const run = useRun((s) => s.run);
  const pick = useRun((s) => s.pickCalling);
  if (!run) return null;
  return <CallingView run={run} onPick={(i) => pick(i)} />;
}

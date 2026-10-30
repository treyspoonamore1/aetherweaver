import { useEffect } from 'react';
import { useRun } from '../../app/runStore';
import type { RunState } from '../../meta/types';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { KeyCap } from '../kit/KeyCap';
import { playUi, useMood } from '../kit/sound';
import { eventNameOf, relicInfo, relicOfferCopy } from './interlude';
import { RelicCard, RunStrip } from './RelicCard';

export interface RelicOfferViewProps {
  run: RunState;
  /** Take option `index`, or leave them all (null). */
  onPick(index: number | null): void;
}

/** After an elite, the Bellwarden or the Unsung Choir: choose one relic, or none. */
export function RelicOfferView({ run, onPick }: RelicOfferViewProps) {
  useMood('map');
  const offer = run.relicOffer;
  const count = offer?.options.length ?? 0;
  useEffect(() => {
    if (count > 0) playUi('relicReveal');
  }, [count]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= count) {
        e.preventDefault();
        playUi('relicPick');
        onPick(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, onPick]);
  if (!offer) return null;
  const copy = relicOfferCopy(offer, offer.reason === 'event' ? eventNameOf(run) : null);
  return (
    <ScreenFrame tone="gold">
      <div className="mx-auto max-w-6xl px-6 pb-28 pt-8">
        <ScreenHeader eyebrow={copy.eyebrow} title={copy.title}>
          <p className="mt-2 max-w-2xl text-sm text-muted">{copy.blurb}</p>
        </ScreenHeader>
        <RunStrip
          className="mt-4 w-fit"
          calling={run.calling}
          map={run.map}
          aether={run.aether}
          relics={run.relics}
          carried={run.carried}
          boons={run.boons}
        />
        <ul
          className={`mt-6 grid gap-5 ${count >= 3 ? 'md:grid-cols-3' : 'mx-auto max-w-4xl md:grid-cols-2'}`}
          data-testid="relic-offer"
        >
          {offer.options.map((id, i) => {
            const info = relicInfo(id);
            return (
              <li key={id} className="anim-rise" style={{ animationDelay: `${i * 110}ms` }}>
                <RelicCard
                  info={info}
                  keyLabel={<KeyCap label={String(i + 1)} />}
                  onClick={() => {
                    playUi('relicPick');
                    onPick(i);
                  }}
                  label={`Take ${info.name}: ${info.rule}`}
                  footer={
                    <span className="block rounded-lg bg-gold-400 py-2 text-center text-sm font-semibold text-ink-950 opacity-90 group-hover:opacity-100">
                      Take it
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
        <div className="mt-8 flex justify-center">
          <Button variant="ghost" onClick={() => onPick(null)} sound="back">
            Leave them: carry on without a relic
          </Button>
        </div>
      </div>
    </ScreenFrame>
  );
}

export function RelicScreen() {
  const run = useRun((s) => s.run);
  const pick = useRun((s) => s.pickRelic);
  if (!run) return null;
  return <RelicOfferView run={run} onPick={pick} />;
}

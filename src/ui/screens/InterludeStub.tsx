import { CONTENT, relicDef, relicText, runEventDef } from '../../content';
import type { RunState } from '../../meta/types';
import { ScreenFrame } from '../kit/Backdrop';
import { Button } from '../kit/Button';

/**
 * Stand-in for the Phase 3b screens (merchant, forge, event, relic) until their UI pass lands:
 * enough to buy, choose and move on, nothing more.
 */
export function InterludeStub({
  run,
  onBuy,
  onLeave,
  onEvent,
  onRelic,
}: {
  run: RunState;
  onBuy(index: number): void;
  onLeave(): void;
  onEvent(choiceId: string): void;
  onRelic(index: number | null): void;
}) {
  const title =
    run.phase === 'merchant'
      ? 'A merchant'
      : run.phase === 'forge'
        ? 'A forge'
        : run.phase === 'relic'
          ? 'Choose a relic'
          : run.event
            ? runEventDef(run.event.eventId).name
            : 'An event';
  return (
    <ScreenFrame>
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-parchment-100">
        <p className="font-display text-2xl text-gold-300">{title}</p>
        <p className="text-sm text-parchment-300">Aether: {run.aether}</p>
        {run.phase === 'merchant' &&
          run.shop?.items.map((item, i) => (
            <Button
              key={i}
              disabled={item.sold || run.aether < item.price}
              onClick={() => onBuy(i)}
            >
              {item.kind === 'heal'
                ? `Heal ${Math.round(item.heal * 100)}%`
                : item.kind === 'relic'
                  ? relicDef(item.id).name
                  : (CONTENT.motifs.find((m) => m.id === item.id)?.name ?? item.id)}{' '}
              — {item.price}
            </Button>
          ))}
        {run.phase === 'event' && run.event && run.event.choice === null && (
          <>
            <p className="max-w-xl text-center">{runEventDef(run.event.eventId).text}</p>
            {runEventDef(run.event.eventId).choices.map((c) => (
              <Button key={c.id} onClick={() => onEvent(c.id)}>
                {c.label}
              </Button>
            ))}
          </>
        )}
        {run.phase === 'event' && run.event?.outcome && run.event.choice !== null && (
          <p className="max-w-xl text-center">{run.event.outcome}</p>
        )}
        {run.phase === 'relic' &&
          run.relicOffer?.options.map((id, i) => (
            <Button key={id} onClick={() => onRelic(i)}>
              {relicDef(id).name}: {relicText(relicDef(id))}
            </Button>
          ))}
        <Button
          variant="primary"
          onClick={() => (run.phase === 'relic' ? onRelic(null) : onLeave())}
          disabled={run.phase === 'event' && run.event?.choice === null}
        >
          {run.phase === 'relic' ? 'Leave them' : 'Move on'}
        </Button>
      </div>
    </ScreenFrame>
  );
}

import { CallingGlyph } from '../kit/CallingGlyph';
import { callingLook } from '../kit/callingLook';
import { clock, fmt } from '../kit/format';
import { Icon } from '../kit/Icon';
import type { BossHud } from '../store';
import { AnswerGlyph } from './AnswerGlyph';
import { secondsLabel } from './chrono';

/** The Chronomancer's silver, for Foresight's line (Phase 3e). */
const CHRONO = callingLook('chronomancer');

/**
 * Boss bar (docs/plan/04 §5.2, top-centre): HP with phase ticks, the cast and its answers. With
 * the Chronomancer's Foresight, the boss's next attack shows before it begins.
 */
export function BossBar({
  boss,
  decree,
  decreeBanner = false,
  rewind = false,
}: {
  boss: BossHud;
  decree: { name: string; text: string } | null;
  /** The big decree banner is on screen: the quiet line below the bar waits. */
  decreeBanner?: boolean;
  /** A Chronomancer run: Reel's answer is Rewind's (Phase 3e). */
  rewind?: boolean;
}) {
  const hpPct = boss.maxHp > 0 ? Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100)) : 0;
  const shieldPct = boss.maxHp > 0 ? Math.min(100 - 0, (boss.shield / boss.maxHp) * 100) : 0;
  const ticks = Array.from(
    { length: Math.max(0, boss.phases - 1) },
    (_, i) => ((boss.phases - 1 - i) / boss.phases) * 100,
  );
  const enrageSoon = boss.enrageIn !== null && boss.enrageIn < 30;
  return (
    <div
      className="absolute left-1/2 top-4 w-[36rem] max-w-[calc(100vw-2rem)] -translate-x-1/2"
      data-testid="boss-bar"
    >
      <div className="rounded-2xl border border-ink-600/70 bg-ink-900/88 px-4 py-2.5 shadow-lg shadow-black/40 backdrop-blur-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate font-display text-lg font-bold tracking-wide text-gold-200">
            {boss.name}
          </h2>
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <span className="font-semibold text-muted">
              Phase {boss.phase} / {boss.phases}
            </span>
            {boss.enrageIn !== null && (
              <span
                className={`flex items-center gap-1 font-mono font-semibold ${enrageSoon ? 'text-lethal' : 'text-muted'}`}
                title="Time until the boss enrages"
              >
                <Icon name="hourglass" size={13} />
                Enrage {clock(boss.enrageIn)}
              </span>
            )}
          </div>
        </div>
        <div
          role="meter"
          aria-label={`${boss.name} health`}
          aria-valuemin={0}
          aria-valuemax={boss.maxHp}
          aria-valuenow={Math.round(boss.hp)}
          className="relative mt-1.5 h-4 overflow-hidden rounded-full border border-ink-500 bg-ink-800"
        >
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
            style={{ width: `${hpPct}%`, background: 'linear-gradient(90deg,#be3a5b,#f43f5e)' }}
          />
          {boss.shield > 0 && (
            <div
              className="stripes absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
              style={{ width: `${shieldPct}%`, backgroundColor: 'rgb(244 114 182 / 0.7)' }}
              title={`Discord shield ${fmt(boss.shield)}`}
            />
          )}
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 w-0.5 bg-gold-200"
              style={{ left: `${t}%` }}
              aria-hidden
            />
          ))}
        </div>
        <div className="mt-0.5 flex justify-between font-mono text-xs text-muted">
          <span>
            {fmt(boss.hp)} / {fmt(boss.maxHp)}
          </span>
          {boss.shield > 0 && (
            <span className="text-pink-300">Discord shield {fmt(boss.shield)}</span>
          )}
        </div>
        {boss.cast && (
          <div className="mt-1.5 rounded-lg bg-ink-950/60 px-3 py-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-threat">
                <Icon name="bell" size={14} /> {boss.cast.name}
              </span>
              <span className="flex flex-wrap items-center justify-end gap-1">
                <span className="text-xs text-muted">Answer:</span>
                {boss.cast.answers.map((a) => (
                  <AnswerGlyph key={a} tag={a} rewind={rewind} />
                ))}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full transition-[width] duration-150 ease-linear"
                style={{
                  width: `${Math.max(0, Math.min(1, boss.cast.progress)) * 100}%`,
                  background: 'linear-gradient(90deg,#fb923c,#f43f5e)',
                }}
              />
            </div>
          </div>
        )}
        {boss.foreseen && (
          <p
            className="mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs"
            style={{
              color: CHRONO.light,
              background: `color-mix(in srgb, ${CHRONO.color} 18%, rgb(5 8 20 / 0.6))`,
            }}
            role="status"
            aria-label={`Foresight: ${boss.foreseen.name} ${boss.foreseen.in < 0.05 ? 'is about to begin' : `begins in ${boss.foreseen.in.toFixed(1)} seconds`}${boss.foreseen.target ? `, at ${boss.foreseen.target}` : ''}`}
            data-testid="boss-foreseen"
          >
            <CallingGlyph icon="foresight" size={14} />
            <span className="font-semibold uppercase tracking-wider">Foresight</span>
            <span className="font-display text-sm font-bold">{boss.foreseen.name}</span>
            {boss.foreseen.target && <span>→ {boss.foreseen.target}</span>}
            <span className="ml-auto font-mono">{secondsLabel(boss.foreseen.in)}</span>
          </p>
        )}
      </div>
      {(boss.decree ?? decree) && !decreeBanner && <DecreeLine decree={(boss.decree ?? decree)!} />}
    </div>
  );
}

function DecreeLine({ decree }: { decree: { name: string; text: string } }) {
  return (
    <p
      className="mt-1.5 rounded-lg border border-ailment/50 bg-ink-900/85 px-3 py-1.5 text-xs leading-snug text-violet-200 backdrop-blur-sm"
      title={decree.text}
    >
      <span className="mr-1.5 font-display text-sm font-bold text-violet-100">Decree</span>
      <span className="line-clamp-2">{decree.text || decree.name}</span>
    </p>
  );
}

import { useEffect, useState } from 'react';
import { useRun } from '../../app/runStore';
import { EVERYTHING, type Allowance, type Unlock } from '../../meta/profile';
import type { ForgeChoice, ForgeService, RunState } from '../../meta/types';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Panel } from '../kit/Panel';
import { playUi, useMood } from '../kit/sound';
import {
  FORGE_COPY,
  FORGE_SERVICES,
  forgeResultOf,
  forgeServiceStatus,
  motifStep,
  relicInfo,
  songsLine,
  type ForgeResult,
  type ForgeServiceStatus,
} from './interlude';
import { MotifPicker } from './MotifPicker';
import { useAllowance, useFreshUnlocks } from './PrepScreen';
import { RelicCard, RunStrip, Purse } from './RelicCard';
import { RetuneView } from './RespiteScreen';
import { Pips, SectionTitle } from './shared';
import { t } from '../text';

export type { ForgeResult };

export interface ForgeViewProps {
  run: RunState;
  onForge(choice: ForgeChoice): void;
  onLeave(): void;
  allowance?: Allowance;
  fresh?: readonly Unlock[];
  /** UI lab: open a service's picker straight away, or show a finished visit. */
  initialMode?: ForgeService | null;
  initialResult?: ForgeResult | null;
}

/** A forge: one service per visit (temper a motif, retune, or lift a curse), for Aether. */
export function ForgeView({
  run,
  onForge,
  onLeave,
  allowance = EVERYTHING,
  fresh = [],
  initialMode = null,
  initialResult = null,
}: ForgeViewProps) {
  useMood('map');
  const [mode, setMode] = useState<ForgeService | null>(initialMode);
  const [result, setResult] = useState<ForgeResult | null>(initialResult);
  const choosing = mode === null && run.forge?.used === null;
  useEffect(() => {
    if (!choosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const s = FORGE_SERVICES[Number(e.key) - 1];
      if (!s) return;
      e.preventDefault();
      const status = forgeServiceStatus(run, s);
      if (!status.available) playUi(status.short ? 'cantAfford' : 'error');
      else setMode(s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choosing, run]);
  const forge = run.forge;
  if (!forge) return null;
  const price = (s: ForgeService) => forge.prices[s];
  const used = forge.used;

  if (mode === 'retune' && used === null) {
    const p = price('retune');
    return (
      <RetuneView
        run={run}
        allowance={allowance}
        fresh={fresh}
        tone="gold"
        onBack={() => setMode(null)}
        onRetune={(chords) => {
          playUi('forge');
          setResult({ service: 'retune' });
          setMode(null);
          onForge({ service: 'retune', chords });
        }}
        copy={{
          eyebrow: t('screens.forgeScreen.theForgeRetune'),
          title: t('screens.forgeScreen.retuneYourSongs'),
          blurb: t('screens.forgeScreen.theForgeSFire', { p }),
          back: t('screens.forgeScreen.backToTheForge'),
          confirm: t('screens.forgeScreen.retuneForAether', { p }),
        }}
      />
    );
  }

  const header = (
    <>
      <ScreenHeader
        eyebrow={t('screens.forgeScreen.aForgeOneService')}
        title={t('screens.forgeScreen.theForge')}
        right={<Purse aether={run.aether} size="lg" />}
      >
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {t('screens.forgeScreen.anOldBellForge')}
        </p>
      </ScreenHeader>
      <RunStrip
        className="mt-4 w-fit"
        calling={run.calling}
        map={run.map}
        aether={run.aether}
        purse={false}
        relics={run.relics}
        carried={run.carried}
        boons={run.boons}
      />
    </>
  );

  let body;
  if (used !== null) {
    body = <ForgeDone run={run} used={used} result={result ?? forgeResultOf(run)} />;
  } else if (mode === 'temper') {
    const status = forgeServiceStatus(run, 'temper');
    body = (
      <section className="mt-6" aria-label={t('screens.forgeScreen.temperAMotif')}>
        <SectionTitle right={<BackButton onClick={() => setMode(null)} />}>
          {t('screens.forgeScreen.temperChooseAMotif')}
        </SectionTitle>
        <MotifPicker
          steps={status.targets.map((id) => motifStep(run, id, 1))}
          verb={
            <span className="inline-flex items-center gap-1.5">
              {t('screens.forgeScreen.temper')} <Icon name="aether" size={13} /> {price('temper')}
            </span>
          }
          onPick={(motifId) => {
            playUi('forge');
            setResult({ service: 'temper', step: motifStep(run, motifId, 1) });
            setMode(null);
            onForge({ service: 'temper', motifId });
          }}
        />
      </section>
    );
  } else if (mode === 'cleanse') {
    const status = forgeServiceStatus(run, 'cleanse');
    body = (
      <section className="mt-6" aria-label={t('screens.forgeScreen.liftACurse')}>
        <SectionTitle right={<BackButton onClick={() => setMode(null)} />}>
          {t('screens.forgeScreen.liftACurseThe')}
        </SectionTitle>
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {status.targets.map((id) => {
            const info = relicInfo(id);
            return (
              <li key={id}>
                <RelicCard
                  info={info}
                  previewCleanse
                  onClick={() => {
                    playUi('curseLifted');
                    setResult({ service: 'cleanse', relicId: id });
                    setMode(null);
                    onForge({ service: 'cleanse', relicId: id });
                  }}
                  label={t('screens.forgeScreen.liftTheCurseOf', {
                    name: info.name,
                    price: price('cleanse'),
                    value: info.curse ?? '',
                  })}
                  footer={
                    <span className="flex items-center justify-center gap-1.5 rounded-lg bg-gold-400 py-2 text-sm font-semibold text-ink-950">
                      {t('screens.forgeScreen.liftTheCurse')} <Icon name="aether" size={14} />{' '}
                      {price('cleanse')}
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      </section>
    );
  } else {
    body = (
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {FORGE_SERVICES.map((s, i) => (
          <ServiceCard
            key={s}
            service={s}
            index={i}
            status={forgeServiceStatus(run, s)}
            onOpen={() => setMode(s)}
          />
        ))}
      </div>
    );
  }

  return (
    <ScreenFrame tone="gold">
      <div className="mx-auto max-w-6xl px-6 pb-28 pt-8">
        {header}
        {body}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-end bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent px-6 pb-5 pt-10">
        <Button
          variant={used !== null ? 'primary' : 'secondary'}
          size="lg"
          className="pointer-events-auto"
          onClick={onLeave}
          sound={used !== null ? 'confirm' : 'back'}
          autoFocus={used !== null}
        >
          {used !== null
            ? t('screens.forgeScreen.leaveTheForge')
            : t('screens.forgeScreen.leaveWithoutUsingIt')}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </ScreenFrame>
  );
}

function BackButton({ onClick }: { onClick(): void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} sound="back">
      <Icon name="back" size={14} /> {t('screens.forgeScreen.anotherService')}
    </Button>
  );
}

function ServiceCard({
  service,
  index,
  status,
  onOpen,
}: {
  service: ForgeService;
  index: number;
  status: ForgeServiceStatus;
  onOpen(): void;
}) {
  const c = FORGE_COPY[service];
  const short = status.short;
  return (
    <button
      type="button"
      onClick={() => {
        if (!status.available) {
          playUi(short ? 'cantAfford' : 'error');
          return;
        }
        playUi('click');
        onOpen();
      }}
      aria-disabled={!status.available || undefined}
      aria-label={t('screens.forgeScreen.aether2', {
        title: c.title,
        price: status.price,
        text: c.text,
        value: status.problem
          ? t('screens.forgeScreen.unavailable', { problem: status.problem })
          : '',
      })}
      data-testid={`forge-${service}`}
      className={`anim-rise group flex flex-col items-start rounded-2xl border-2 bg-ink-800/90 p-6 text-left shadow-xl shadow-black/40 transition-all ${status.available ? 'hover:-translate-y-1 hover:bg-ink-700/90' : 'cursor-not-allowed opacity-60'}`}
      style={{ borderColor: status.available ? c.color : 'var(--color-ink-500)' }}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full border-2"
          style={{ borderColor: c.color, color: c.color }}
        >
          <Icon name={c.icon} size={30} />
        </span>
        <KeyCap label={String(index + 1)} />
      </div>
      <h2 className="mt-4 font-display text-3xl font-bold" style={{ color: c.color }}>
        {c.title}
      </h2>
      <p className="mt-1 flex items-center gap-1.5 font-mono text-base font-bold text-gold-200">
        <Icon name="aether" size={16} /> {status.price}{' '}
        <span className="font-sans text-sm font-normal text-muted">
          {t('screens.forgeScreen.aether')}
        </span>
      </p>
      <p className="mt-3 text-base leading-relaxed text-text">{c.text}</p>
      <p
        className={`mt-auto flex items-start gap-1.5 pt-4 text-sm ${status.available ? 'text-muted' : 'text-rose-300'}`}
      >
        <Icon
          name={status.available ? 'check' : 'lock'}
          size={15}
          className="mt-0.5 shrink-0"
          style={{ color: status.available ? 'var(--color-heal)' : undefined }}
        />
        {status.problem ?? status.note}
      </p>
    </button>
  );
}

/** After the one service: what changed. */
function ForgeDone({
  run,
  used,
  result,
}: {
  run: RunState;
  used: ForgeService;
  result: ForgeResult | null;
}) {
  const c = FORGE_COPY[used];
  return (
    <Panel tone="gold" className="anim-rise mt-6 p-6" data-testid="forge-done">
      <p
        className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em]"
        style={{ color: c.color }}
      >
        <Icon name={c.icon} size={16} /> {t('screens.forgeScreen.done', { title: c.title })}
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold text-gold-200">
        {t('screens.forgeScreen.theFireSettlesThe')}
      </h2>
      {result?.service === 'temper' && (
        <div className="mt-4 max-w-xl rounded-xl border border-ink-600/70 bg-ink-900/60 p-4">
          <p className="flex items-center justify-between gap-3 font-semibold text-text">
            {result.step.name}
            <span className="flex items-center gap-2 font-mono text-xs text-gold-200">
              {t('screens.forgeScreen.lv', { from: result.step.from, to: result.step.to })}
              <Pips level={result.step.to} max={result.step.max} />
            </span>
          </p>
          <p className="mt-2 text-xs text-muted">
            {t('screens.forgeScreen.was')}{' '}
            <span className="line-through decoration-ink-500">{result.step.now}</span>
          </p>
          <p className="mt-1 text-sm text-text">
            {t('screens.forgeScreen.now', { next: result.step.next })}
          </p>
        </div>
      )}
      {result?.service === 'cleanse' && (
        <div className="mt-4 max-w-md">
          <RelicCard
            info={relicInfo(
              result.relicId,
              run.relics.find((r) => r.id === result.relicId)?.cleansed ?? true,
            )}
          />
        </div>
      )}
      {result?.service === 'retune' && (
        <p className="mt-3 text-base text-text">{songsLine(run.chords)}</p>
      )}
      {!result && <p className="mt-3 text-base text-text">{c.text}</p>}
      <p className="mt-4 text-sm text-muted">
        {t('screens.forgeScreen.oneServicePerVisit', { aether: run.aether })}
      </p>
    </Panel>
  );
}

export function ForgeScreen() {
  const run = useRun((s) => s.run);
  const forge = useRun((s) => s.forge);
  const leave = useRun((s) => s.leaveForge);
  const allowance = useAllowance();
  const fresh = useFreshUnlocks();
  if (!run) return null;
  return (
    <ForgeView run={run} onForge={forge} onLeave={leave} allowance={allowance} fresh={fresh} />
  );
}

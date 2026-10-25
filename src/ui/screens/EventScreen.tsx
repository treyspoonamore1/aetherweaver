import { useEffect, useState } from 'react';
import { useRun } from '../../app/runStore';
import { runEventDef, type EventChoice } from '../../content';
import { EVERYTHING, type Allowance, type Unlock } from '../../meta/profile';
import type { ChordLoadout, RunState } from '../../meta/types';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Panel } from '../kit/Panel';
import { Glyph } from '../kit/RelicGlyph';
import { playUi, useMood } from '../kit/sound';
import {
  choiceInfo,
  choiceLevels,
  eventMotifTargets,
  gainLines,
  motifStep,
  relicInfo,
  type ChoiceInfo,
} from './interlude';
import { MotifPicker } from './MotifPicker';
import { useAllowance, useFreshUnlocks } from './PrepScreen';
import { Purse, RelicCard, RunStrip } from './RelicCard';
import { RetuneView } from './RespiteScreen';
import { PartyHealth, SectionTitle } from './shared';

export const EVENT_COLOR = '#c4b5fd';

/** An event's glyph in its violet disc. */
export function EventGlyph({ icon, size = 72 }: { icon: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border-2"
      style={{
        width: size,
        height: size,
        color: EVENT_COLOR,
        borderColor: EVENT_COLOR,
        background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${EVENT_COLOR} 24%, transparent), rgb(10 16 34 / 0.92) 72%)`,
        boxShadow: `0 0 ${Math.round(size * 0.4)}px color-mix(in srgb, ${EVENT_COLOR} 35%, transparent)`,
      }}
      aria-hidden
    >
      <Glyph icon={icon} size={Math.round(size * 0.56)} />
    </span>
  );
}

export interface EventViewProps {
  run: RunState;
  onChoose(choiceId: string, opts?: { motifId?: string; chords?: ChordLoadout[] }): void;
  onLeave(): void;
  allowance?: Allowance;
  fresh?: readonly Unlock[];
  /** UI lab: open a choice's motif picker or song builder straight away. */
  initialPending?: string | null;
}

/** A map event: the scene and its choices, then what happened and what it gave or took. */
export function EventView({
  run,
  onChoose,
  onLeave,
  allowance = EVERYTHING,
  fresh = [],
  initialPending = null,
}: EventViewProps) {
  useMood('map');
  const [pending, setPending] = useState<string | null>(initialPending);
  const event = run.event;
  const chosen = event?.choice ?? null;
  const won = event?.won ?? null;
  const relicsGained = event?.gains?.relics.length ?? 0;
  useEffect(() => {
    if (chosen === null) playUi('eventOpen');
    else if (won === true) playUi('gambleWin');
    else if (won === false) playUi('gambleLose');
    else if (relicsGained > 0) playUi('relicReveal');
  }, [chosen, won, relicsGained]);
  const def = event ? runEventDef(event.eventId) : null;
  const choices = def && run ? def.choices.map((c) => choiceInfo(run, def.id, c)) : [];
  const pick = (c: ChoiceInfo) => {
    if (c.problem) {
      playUi(c.problem.startsWith('Needs') && c.cost > 0 ? 'cantAfford' : 'error');
      return;
    }
    if (c.motif !== 'none' || c.retune) {
      playUi('click');
      setPending(c.id);
      return;
    }
    playUi('confirm');
    onChoose(c.id);
  };
  useEffect(() => {
    if (chosen !== null || pending !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const c = choices[Number(e.key) - 1];
      if (!c) return;
      e.preventDefault();
      pick(c);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!event || !def) return null;
  const pendingChoice = pending ? def.choices.find((c) => c.id === pending) : undefined;

  if (pendingChoice && chosen === null && choiceInfo(run, def.id, pendingChoice).retune) {
    return (
      <RetuneView
        run={run}
        allowance={allowance}
        fresh={fresh}
        onBack={() => setPending(null)}
        onRetune={(chords) => onChoose(pendingChoice.id, { chords })}
        copy={{
          eyebrow: `${def.name} · ${pendingChoice.label}`,
          title: 'Retune your songs',
          blurb: `${pendingChoice.text} The same rules as Prep; your motifs stay.`,
          back: 'Back to the choices',
          confirm: 'Retune',
        }}
      />
    );
  }

  return (
    <ScreenFrame tone="dusk">
      <div className="mx-auto max-w-6xl px-6 pb-28 pt-8">
        <ScreenHeader
          eyebrow="An event"
          title={def.name}
          right={<Purse aether={run.aether} size="lg" />}
        />
        <RunStrip
          className="mt-4 w-fit"
          aether={run.aether}
          purse={false}
          relics={run.relics}
          boons={run.boons}
        />
        <Panel
          tone="solid"
          className={`anim-rise mt-5 flex items-center gap-5 p-5 ${chosen !== null ? 'opacity-80' : ''}`}
        >
          <EventGlyph icon={def.icon} size={chosen !== null ? 56 : 76} />
          <p className="max-w-3xl text-lg leading-relaxed text-text">{def.text}</p>
        </Panel>

        {chosen !== null ? (
          <Outcome run={run} />
        ) : pendingChoice ? (
          <MotifStepPicker
            run={run}
            choice={pendingChoice}
            onBack={() => setPending(null)}
            onPick={(motifId) => onChoose(pendingChoice.id, { motifId })}
          />
        ) : (
          <ul
            className={`mt-6 grid gap-5 ${choices.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
            data-testid="event-choices"
          >
            {choices.map((c, i) => (
              <li key={c.id}>
                <ChoiceCard choice={c} index={i} onPick={() => pick(c)} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-end bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent px-6 pb-5 pt-10">
        {chosen !== null && (
          <Button
            variant="primary"
            size="lg"
            className="pointer-events-auto"
            onClick={onLeave}
            sound="confirm"
            autoFocus
          >
            Continue <Icon name="arrow" size={18} />
          </Button>
        )}
      </div>
    </ScreenFrame>
  );
}

const TAG_COLOR = {
  aether: 'var(--color-gold-300)',
  risk: '#fda4af',
  fight: '#fb923c',
  relic: '#93c5fd',
  plain: 'var(--color-muted)',
} as const;

function ChoiceCard({
  choice: c,
  index,
  onPick,
}: {
  choice: ChoiceInfo;
  index: number;
  onPick(): void;
}) {
  const off = c.problem !== null;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-disabled={off || undefined}
      aria-label={`${c.label}. ${c.text}${c.problem ? ` Unavailable: ${c.problem}` : ''}`}
      className={`anim-rise group flex h-full w-full flex-col rounded-2xl border-2 bg-ink-800/90 p-5 text-left shadow-xl shadow-black/40 transition-all ${off ? 'cursor-not-allowed border-ink-600 opacity-60' : 'hover:-translate-y-1 hover:bg-ink-700/90'}`}
      style={{ borderColor: off ? undefined : c.fight ? '#fb923c' : EVENT_COLOR }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-2xl font-bold leading-tight text-text">{c.label}</h2>
        <KeyCap label={String(index + 1)} />
      </div>
      <p className="mt-2 text-base leading-relaxed text-text">{c.text}</p>
      {c.odds && (
        <div className="mt-3" aria-hidden>
          <div className="flex h-2.5 overflow-hidden rounded-full">
            <div className="bg-heal" style={{ width: `${c.odds.win}%` }} />
            <div className="stripes bg-lethal/80" style={{ width: `${c.odds.lose}%` }} />
          </div>
          <p className="mt-1 flex justify-between font-mono text-xs">
            <span className="text-heal">{c.odds.win}% it works</span>
            <span className="text-rose-300">{c.odds.lose}% it doesn’t</span>
          </p>
        </div>
      )}
      {c.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <span
              key={t.text}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium"
              style={{
                color: TAG_COLOR[t.tone],
                borderColor: `color-mix(in srgb, ${TAG_COLOR[t.tone]} 50%, transparent)`,
              }}
            >
              <Icon name={t.icon} size={12} /> {t.text}
            </span>
          ))}
        </div>
      )}
      <p
        className={`mt-auto flex items-start gap-1.5 pt-4 text-sm ${off ? 'text-rose-300' : 'text-muted'}`}
      >
        {off ? (
          <>
            <Icon name="lock" size={15} className="mt-0.5 shrink-0" /> {c.problem}
          </>
        ) : (
          <span className="w-full rounded-lg border border-ink-500 py-1.5 text-center font-semibold text-text group-hover:border-gold-400 group-hover:text-gold-200">
            {c.motif !== 'none'
              ? 'Choose a motif…'
              : c.retune
                ? 'Open the song builder…'
                : 'Choose'}
          </span>
        )}
      </p>
    </button>
  );
}

function MotifStepPicker({
  run,
  choice,
  onBack,
  onPick,
}: {
  run: RunState;
  choice: EventChoice;
  onBack(): void;
  onPick(motifId: string): void;
}) {
  const levels = choiceLevels(choice);
  const ids = eventMotifTargets(run, choice.motif);
  const odds =
    choice.chance === undefined
      ? null
      : { win: Math.round(choice.chance * 100), lose: 100 - Math.round(choice.chance * 100) };
  const loses = choice.fail.some((e) => e.kind === 'loseMotif');
  return (
    <section className="mt-6" aria-label={choice.label}>
      <SectionTitle
        right={
          <Button variant="ghost" size="sm" onClick={onBack} sound="back">
            <Icon name="back" size={14} /> Back to the choices
          </Button>
        }
      >
        {choice.label}: which motif?
      </SectionTitle>
      <p className="-mt-1 mb-4 text-sm text-muted">
        {choice.motif === 'upgradable'
          ? 'Only motifs below their last level can be offered.'
          : 'Any of your motifs.'}{' '}
        {choice.text}
      </p>
      <MotifPicker
        steps={ids.map((id) => motifStep(run, id, Math.max(1, levels)))}
        odds={odds ? `${odds.win}%` : undefined}
        risk={odds && loses ? `${odds.lose}%: it shatters, and is lost.` : undefined}
        verb="Offer it"
        onPick={onPick}
      />
    </section>
  );
}

function Outcome({ run }: { run: RunState }) {
  const event = run.event!;
  const def = runEventDef(event.eventId);
  const choice = def.choices.find((c) => c.id === event.choice);
  const gains = event.gains;
  const chance = choice?.chance;
  const lines = gains ? gainLines(gains, run).filter((l) => l.icon !== 'relic') : [];
  const touchedLife = !!gains && (gains.heal > 0 || gains.hurt > 0);
  return (
    <section className="anim-rise mt-6" aria-label="What happened" data-testid="event-outcome">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
        You chose: <span className="text-text">{choice?.label}</span>
      </p>
      {event.won !== null && chance !== undefined && (
        <p
          className={`mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${event.won ? 'border-heal/60 bg-heal/10 text-heal' : 'border-lethal/60 bg-lethal/10 text-rose-300'}`}
          role="status"
        >
          <Icon name={event.won ? 'check' : 'skull'} size={16} />
          {event.won
            ? `It worked: the ${Math.round(chance * 100)}% came up.`
            : `It went wrong: the ${100 - Math.round(chance * 100)}% came up.`}
        </p>
      )}
      <p className="mt-3 max-w-3xl text-xl italic leading-snug text-gold-200">{event.outcome}</p>
      {gains && gains.relics.length > 0 && (
        <ul className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {gains.relics.map((id) => (
            <li key={id}>
              <RelicCard info={relicInfo(id)} />
            </li>
          ))}
        </ul>
      )}
      <Panel tone="solid" className="mt-5 max-w-3xl p-5">
        <SectionTitle>What changed</SectionTitle>
        <ul className="flex flex-col gap-2.5">
          {gains?.relics.map((id) => (
            <li key={id} className="flex items-start gap-2.5 text-sm text-text">
              <Icon name="relic" size={17} className="mt-0.5 shrink-0 text-heal" />
              {relicInfo(id).name} is yours for the rest of the run.
            </li>
          ))}
          {lines.map((l, i) => (
            <li
              key={i}
              className={`flex items-start gap-2.5 text-sm leading-relaxed ${l.tone === 'bad' ? 'text-rose-200' : 'text-text'} ${gains?.lostMotif && l.icon === 'close' ? 'line-through decoration-rose-400/70' : ''}`}
            >
              {l.icon === 'glyph' ? (
                <Glyph
                  icon={l.glyph!}
                  size={17}
                  className={`mt-0.5 shrink-0 ${l.tone === 'bad' ? 'text-rose-300' : 'text-heal'}`}
                />
              ) : (
                <Icon
                  name={l.icon}
                  size={17}
                  className={`mt-0.5 shrink-0 ${l.tone === 'bad' ? 'text-rose-300' : l.tone === 'good' ? 'text-heal' : 'text-muted'}`}
                />
              )}
              {l.text}
            </li>
          ))}
        </ul>
        {touchedLife && (
          <div className="mt-4 flex flex-col gap-3 border-t border-ink-600/60 pt-4">
            {run.party.map((h) => (
              <PartyHealth key={h.heroId} hero={h} />
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}

export function EventScreen() {
  const run = useRun((s) => s.run);
  const choose = useRun((s) => s.chooseEvent);
  const leave = useRun((s) => s.leaveEvent);
  const allowance = useAllowance();
  const fresh = useFreshUnlocks();
  if (!run) return null;
  return (
    <EventView run={run} onChoose={choose} onLeave={leave} allowance={allowance} fresh={fresh} />
  );
}

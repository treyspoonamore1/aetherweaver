import { useRun } from '../../app/runStore';
import { DEFAULT_SETTINGS, useSettings } from '../../app/settings';
import { CONTENT, heroDef, motifDef } from '../../content';
import { motifLine, runTotals } from '../../meta/run';
import type { EncounterResult, Grade, Highlight, RunState } from '../../meta/types';
import type { ReactNode } from 'react';
import { ScreenFrame } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { CATEGORY, Chip } from '../kit/Chip';
import { clock, fmt, pct, plural } from '../kit/format';
import { Icon, type IconName } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { Ring } from '../kit/Ring';
import { useMood } from '../kit/sound';
import { useUi } from '../store';
import { HeroDisc, Pips, SectionTitle } from './shared';
import { HpTimeline, TimelineLegend } from './Timeline';

const GRADE_COLOR: Record<Grade, string> = {
  S: '#fde9b8',
  A: '#5eead4',
  B: '#93c5fd',
  C: '#fbbf24',
  D: '#fb7185',
};

const OUTCOME = {
  victory: {
    title: 'The silence is broken',
    sub: 'The Hollow Cantor falls and the Reliquary sings again.',
    color: 'var(--color-gold-300)',
  },
  defeat: {
    title: 'The song falls silent',
    sub: 'The party is lost, but every note you wove is on record.',
    color: '#fda4af',
  },
  abandoned: {
    title: 'You set down the thread',
    sub: 'The road waits. Here is what you wove while you walked it.',
    color: '#c4b5fd',
  },
} as const;

const HIGHLIGHT_ORDER: Highlight['kind'][] = [
  'save',
  'perfect',
  'clutch',
  'crescendo',
  'reel',
  'cue',
  'revive',
];
const HIGHLIGHT_ICON: Record<Highlight['kind'], IconName> = {
  perfect: 'ward',
  save: 'heart',
  clutch: 'chime',
  reel: 'reel',
  cue: 'note',
  crescendo: 'sparkle',
  revive: 'mend',
  response: 'note',
  fermata: 'heart',
};

/** Top moments across the whole run, most valuable kinds first. */
export function runHighlights(results: EncounterResult[]): (Highlight & { fight: string })[] {
  const all = results.flatMap((r) => r.highlights.map((h) => ({ ...h, fight: r.name })));
  const picked: typeof all = [];
  // One of each kind first (most valuable kinds first), then whatever is left.
  for (const kind of HIGHLIGHT_ORDER) {
    const h = all.find((x) => x.kind === kind);
    if (h) picked.push(h);
  }
  for (const h of all) if (picked.length < 3 && !picked.includes(h)) picked.push(h);
  return picked.slice(0, 3);
}

export interface SummaryViewProps {
  run: RunState;
  onNewRun(): void;
  onTitle(): void;
  /** Assists in effect (badge). */
  assisted?: boolean;
}

/** The run summary, "proof of support" (docs/plan/04 §6.1). */
export function SummaryView({ run, onNewRun, onTitle, assisted = false }: SummaryViewProps) {
  useMood('map');
  const totals = runTotals(run);
  const outcome = OUTCOME[run.outcome ?? 'abandoned'];
  const heroIds = run.party.map((p) => p.heroId);
  const mitigated = totals.shielded + totals.negated;
  const segments = run.results.map((r) => ({
    name: r.name,
    duration: r.duration,
    timeline: r.timeline,
    markers: r.markers,
  }));
  const kinds = [...new Set(run.results.flatMap((r) => r.markers.map((m) => m.kind)))];
  const highlights = runHighlights(run.results);
  const saveLines = run.results
    .flatMap((r) => r.highlights.filter((h) => h.kind === 'save'))
    .slice(0, 3);

  // Per hero totals for "your thread accounted for 31% of Lyra's damage".
  const perHero = heroIds.map((id) => {
    let damage = 0;
    let amplified = 0;
    for (const r of run.results) {
      for (const h of r.heroes) {
        if (h.heroId === id) {
          damage += h.damage;
          amplified += h.amplified;
        }
      }
    }
    return { id, damage, amplified };
  });
  const aimed = totals.telegraphsAimed;

  return (
    <ScreenFrame tone={run.outcome === 'victory' ? 'gold' : 'dusk'}>
      <div className="mx-auto max-w-6xl px-6 pb-28 pt-8">
        <header className="anim-rise flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
              The Prelude · summary
            </p>
            <h1
              className="mt-1 font-display text-4xl font-bold tracking-wide sm:text-5xl"
              style={{ color: outcome.color }}
            >
              {outcome.title}
            </h1>
            <p className="mt-2 max-w-xl text-base text-muted">{outcome.sub}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
              <span>
                {totals.encounters} {plural(totals.encounters, 'fight')}
              </span>
              <span>{clock(totals.duration)} in combat</span>
              <span>seed {run.seed}</span>
              {assisted && (
                <Chip color="var(--color-rare)" icon="info" title="Assists were on for this run">
                  Assists on
                </Chip>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-gold-500/50 bg-ink-800/90 px-6 py-4">
            <Ring value={totals.weaverShare} size={84} stroke={8} color="var(--color-gold-300)">
              <span className="font-display text-xl font-bold text-gold-200">
                {pct(totals.weaverShare)}
              </span>
            </Ring>
            <p className="max-w-[12rem] text-sm leading-snug text-text">
              of everything that mattered in this run was <b className="text-gold-300">you</b>:
              healing, shields, saves and added damage.
            </p>
          </div>
        </header>

        {run.results.length > 0 && (
          <Panel tone="solid" className="mt-6 p-5">
            <SectionTitle
              right={
                <ul className="flex flex-wrap gap-1.5" aria-label="Fights and grades">
                  {run.results.map((r, i) => (
                    <li key={i}>
                      <Chip color={GRADE_COLOR[r.grade]} title={`${r.name}: grade ${r.grade}`}>
                        <b className="font-display">{r.grade}</b> {r.name}
                      </Chip>
                    </li>
                  ))}
                </ul>
              }
            >
              Your run, fight by fight
            </SectionTitle>
            <HpTimeline segments={segments} heroIds={heroIds} height={270} />
            <TimelineLegend heroIds={heroIds} kinds={kinds} />
          </Panel>
        )}

        <section className="mt-6" aria-labelledby="proof-title">
          <SectionTitle>
            <span id="proof-title">Proof of support</span>
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Tile
              icon="empower"
              color="var(--color-amp)"
              label="Amplified"
              value={fmt(totals.amplified)}
              sentence={
                totals.amplified > 0
                  ? `Your Empower thread and auras added ${fmt(totals.amplified)} damage: ${pct(totals.partyDamage > 0 ? totals.amplified / totals.partyDamage : 0)} of everything your party dealt.`
                  : 'Your Threads stayed on Mend. Empower adds damage when the party is healthy.'
              }
            />
            <Tile
              icon="mend"
              color="var(--color-heal)"
              label="Healed"
              value={fmt(totals.healing)}
              sentence={`You healed ${fmt(totals.healing)} life across ${totals.encounters} ${plural(totals.encounters, 'fight')}${totals.overheal > 0 ? `; ${fmt(totals.overheal)} was overheal` : ''}.`}
            />
            <Tile
              icon="ward"
              color="var(--color-shield)"
              label="Mitigated"
              value={fmt(mitigated)}
              sentence={`${fmt(mitigated)} damage never landed: ${fmt(totals.shielded)} absorbed by Wards and ${fmt(totals.negated)} negated by ${totals.perfects} Perfect ${plural(totals.perfects, 'Ward')}.`}
            />
            <Tile
              icon="heart"
              color="#f9a8d4"
              label="Saves"
              value={String(totals.saves)}
              sentence={`${totals.saves} ${plural(totals.saves, 'time')} a hero would have died and didn’t.`}
            >
              {saveLines.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs leading-snug text-muted">
                  {saveLines.map((h, i) => (
                    <li key={i}>{h.text}</li>
                  ))}
                </ul>
              )}
            </Tile>
            <Tile
              icon="chime"
              color="#c4b5fd"
              label="Cleanses"
              value={String(totals.cleanses)}
              sentence={`${totals.cleanses} ${plural(totals.cleanses, 'mark')} cleansed, ${totals.clutchCleanses} at the last moment.${aimed > 0 ? ` You answered ${totals.telegraphsAnswered} of ${aimed} aimed attacks.` : ''}`}
            />
            <Tile
              icon="note"
              color="var(--color-gold-300)"
              label="Cues"
              value={String(totals.cues)}
              sentence={`${totals.cues} ${plural(totals.cues, 'Solo')} cued, ${totals.crescendos} ${plural(totals.crescendos, 'Crescendo')} sung, ${totals.reels} ${plural(totals.reels, 'Reel')} to safety.`}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel tone="solid" className="p-5">
            <SectionTitle>Per hero</SectionTitle>
            <ul className="flex flex-col gap-3.5">
              {perHero.map((h) => {
                const def = heroDef(h.id);
                const share = h.damage > 0 ? h.amplified / h.damage : 0;
                const state = run.party.find((p) => p.heroId === h.id);
                return (
                  <li key={h.id} className="flex items-start gap-3">
                    <HeroDisc heroId={h.id} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {def.name}
                        {state && state.hpPct <= 0 && (
                          <span className="ml-2 text-xs font-normal text-lethal">fell</span>
                        )}
                      </p>
                      <p className="text-sm leading-relaxed text-muted">
                        {h.damage > 0
                          ? `Dealt ${fmt(h.damage)} damage. Your Empower thread and auras accounted for ${pct(share)} of it.`
                          : 'Dealt no recorded damage.'}
                      </p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                        <div className="h-full bg-amp" style={{ width: `${share * 100}%` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel tone="solid" className="p-5">
            <SectionTitle>Best moments</SectionTitle>
            {highlights.length === 0 ? (
              <p className="text-sm text-muted">
                No highlights yet. A Perfect Ward or a Save will show up here.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-lg bg-ink-900/60 px-3 py-2.5"
                  >
                    <Icon
                      name={HIGHLIGHT_ICON[h.kind]}
                      size={20}
                      className="mt-0.5 shrink-0 text-gold-300"
                    />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug text-text">{h.text}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {h.fight} · {clock(h.time)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <Panel tone="solid" className="mt-6 p-5">
          <SectionTitle
            right={<span className="font-mono text-xs text-muted">{run.motifs.length} woven</span>}
          >
            Motifs built
          </SectionTitle>
          {run.motifs.length === 0 ? (
            <p className="text-sm text-muted">You didn’t weave any motifs this time.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {run.motifs.map((m) => {
                const def = motifDef(m.id);
                const cat = CATEGORY[def.category];
                return (
                  <li key={m.id} className="rounded-lg bg-ink-900/60 px-3 py-2.5">
                    <p
                      className="flex items-center justify-between gap-2 text-sm font-semibold"
                      style={{ color: cat.color }}
                    >
                      <span className="flex items-center gap-1.5">
                        <Icon name={cat.icon} size={15} /> {def.name}
                      </span>
                      <Pips level={m.level} max={def.values.length} color={cat.color} />
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {motifLine(m.id, m.level)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Chord:{' '}
            {run.chords
              .flatMap((c) => c.auras)
              .map((id) => CONTENT.auras.find((a) => a.id === id)?.name)
              .filter(Boolean)
              .join(' + ') || 'none'}
          </p>
        </Panel>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-end gap-3 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent px-6 pb-5 pt-10">
        <Button className="pointer-events-auto" size="lg" onClick={onTitle} sound="back">
          <Icon name="home" size={18} /> Title
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="pointer-events-auto"
          onClick={onNewRun}
          sound="confirm"
          autoFocus
        >
          New run <Icon name="arrow" size={18} />
        </Button>
      </div>
    </ScreenFrame>
  );
}

function Tile({
  icon,
  color,
  label,
  value,
  sentence,
  children,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: string;
  sentence: string;
  children?: ReactNode;
}) {
  return (
    <article
      className="rounded-xl border border-ink-600/70 bg-ink-800/85 p-4"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      <p
        className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        <Icon name={icon} size={16} /> {label}
      </p>
      <p className="mt-1 font-display text-5xl font-bold leading-tight text-text">{value}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{sentence}</p>
      {children}
    </article>
  );
}

export function SummaryScreen() {
  const run = useRun((s) => s.run);
  const settings = useSettings((s) => s.settings);
  const setScreen = useUi((s) => s.setScreen);
  if (!run) return null;
  const a = settings.assists;
  const d = DEFAULT_SETTINGS.assists;
  const assisted =
    a.autonomy !== d.autonomy ||
    a.perfectWindowBonus !== d.perfectWindowBonus ||
    a.telegraphLead !== d.telegraphLead;
  return (
    <SummaryView
      run={run}
      assisted={assisted}
      onNewRun={() => {
        useRun.getState().closeRun();
        useRun.getState().newRun();
      }}
      onTitle={() => {
        useRun.getState().closeRun();
        setScreen('title');
      }}
    />
  );
}

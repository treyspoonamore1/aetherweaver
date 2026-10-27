import type { RankUp } from '../../app/profileStore';
import { useProfile } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import { DEFAULT_SETTINGS, useSettings } from '../../app/settings';
import { auraDef, callingDef, heroDef, motifDef, optionText, ornamentDef } from '../../content';
import { songName } from '../../sim';
import { motifLine, runTotals } from '../../meta/run';
import type {
  EncounterResult,
  EncounterStats,
  Grade,
  Highlight,
  RunCalling,
  RunState,
} from '../../meta/types';
import { PathPip, callingLook } from '../kit/CallingGlyph';
import { CallingTitle } from './CallingParts';
import { callingNothingText, callingParts, pathSteps, techniqueName } from './callingText';
import { bindingLabel } from '../hud/labels';
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
import { ContributionBar } from './ContributionBar';
import { RankUpCard, XpBar, useRankUps } from './Rank';
import { rankPanel, runRank, xpGain, xpHeadline } from './rankText';
import { HIGHLIGHT_COLOR, contributionOf, songLines } from './resultText';
import { HpTimeline, TimelineLegend } from './Timeline';
import { RelicGlyph } from '../kit/RelicGlyph';
import { aetherEarned, relicInfo } from './interlude';
import { RelicBody } from './RelicCard';
import { tallyLine, withoutYouTally, withoutYouLine } from './withoutYouText';

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
  'fermata',
  'perfect',
  'response',
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
  response: 'call',
  fermata: 'fermata',
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
  /** The profile's XP now (this run's included); omitted hides the Rank panel. */
  profileXp?: number;
  rankUps?: readonly RankUp[];
  onDismissRankUps?(): void;
  firstRankUp?: boolean;
}

/** The run summary, "proof of support" (docs/plan/04 §6.1). */
export function SummaryView({
  run,
  onNewRun,
  onTitle,
  assisted = false,
  profileXp,
  rankUps = [],
  onDismissRankUps,
  firstRankUp = false,
}: SummaryViewProps) {
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
  const tally = withoutYouTally(run.results);
  const fermataSaves = run.results.reduce(
    (n, r) => n + r.highlights.filter((h) => h.kind === 'fermata').length,
    0,
  );

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

        {profileXp !== undefined && <RunRankPanel run={run} profileXp={profileXp} />}

        {totals.encounters > 0 && (
          <Panel tone="solid" className="mt-6 p-5" data-testid="summary-songs">
            <SectionTitle>Your songs and your Thread</SectionTitle>
            <ContributionBar parts={contributionOf(totals)} className="mb-3" />
            <ul className="flex flex-col gap-2">
              {songLines(totals).map((l, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-3 text-sm leading-relaxed ${l.muted ? 'text-muted' : 'text-text'}`}
                >
                  <Icon
                    name={l.icon}
                    size={18}
                    className={`mt-0.5 shrink-0 ${l.muted ? 'text-ink-500' : 'text-gold-300'}`}
                  />
                  {l.text}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {run.calling && <CallingSummary calling={run.calling} totals={totals} run={run} />}

        {tally.fights > 0 && (
          <Panel tone="solid" className="mt-6 p-5" data-testid="summary-without-you">
            <SectionTitle>Without you</SectionTitle>
            <p className="font-display text-xl font-bold leading-snug text-gold-100 sm:text-2xl">
              {tallyLine(tally)}
            </p>
            <ol
              className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
              aria-label="Each fight, with and without you"
            >
              {run.results.map((r, i) => {
                const w = r.withoutYou;
                const alone = w?.outcome ?? null;
                return (
                  <li
                    key={i}
                    className="rounded-lg border border-ink-600/70 bg-ink-900/60 px-3 py-2"
                    title={w ? withoutYouLine(w, r) : 'Not re-run'}
                  >
                    <p className="truncate text-sm font-semibold text-text">{r.name}</p>
                    <p className="mt-1 flex items-center justify-between gap-2 text-xs">
                      <span
                        className="flex items-center gap-1"
                        style={{
                          color:
                            r.outcome === 'victory'
                              ? 'var(--color-gold-300)'
                              : 'var(--color-lethal)',
                        }}
                      >
                        <Icon name={r.outcome === 'victory' ? 'crown' : 'skull'} size={12} />
                        You: {r.outcome === 'victory' ? 'won' : 'fell'}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        style={{
                          color:
                            alone === 'victory'
                              ? 'var(--color-muted)'
                              : alone === 'defeat'
                                ? 'var(--color-lethal)'
                                : 'var(--color-threat)',
                        }}
                      >
                        <Icon
                          name={
                            alone === 'victory'
                              ? 'crown'
                              : alone === 'defeat'
                                ? 'skull'
                                : 'hourglass'
                          }
                          size={12}
                        />
                        Alone:{' '}
                        {alone === null
                          ? 'not re-run'
                          : alone === 'victory'
                            ? `won ${clock(w!.duration)}`
                            : alone === 'defeat'
                              ? `fell ${clock(w!.duration)}`
                              : 'stuck'}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ol>
          </Panel>
        )}

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              icon="empower"
              color="var(--color-amp)"
              label="Amplified"
              value={fmt(totals.amplified)}
              sentence={
                totals.amplified > 0
                  ? `You added ${fmt(totals.amplified)} damage (auras ${fmt(totals.auraAmplified)}, Empower ${fmt(totals.threadAmplified)}): ${pct(totals.partyDamage > 0 ? totals.amplified / totals.partyDamage : 0)} of everything your party dealt.`
                  : 'Your Thread stayed on Mend and no aura added damage. Empower adds damage when the party is healthy.'
              }
            />
            <Tile
              icon="mend"
              color="var(--color-heal)"
              label="Healed"
              value={fmt(totals.healing)}
              sentence={`You healed ${fmt(totals.healing)} life across ${totals.encounters} ${plural(totals.encounters, 'fight')} (auras ${fmt(totals.auraHealing)}, your beam ${fmt(totals.threadHealing)})${totals.overheal > 0 ? `; ${fmt(totals.overheal)} was overheal` : ''}.`}
            />
            <Tile
              icon="ward"
              color="var(--color-shield)"
              label="Mitigated"
              value={fmt(mitigated)}
              sentence={`${fmt(mitigated)} damage never landed: ${fmt(totals.shielded)} stopped by your shields and auras, and ${fmt(totals.negated)} negated by ${totals.perfects} Perfect ${plural(totals.perfects, 'Ward')}.`}
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
              sentence={`${totals.cues} ${plural(totals.cues, 'Solo')} cued, ${totals.crescendos} ${plural(totals.crescendos, 'Crescendo')} sung, ${totals.reels} ${plural(totals.reels, techniqueName('reel', run.calling?.id))} to safety.`}
            />
            <Tile
              icon="call"
              color="var(--color-call, #fde68a)"
              label="Calls answered"
              value={totals.calls > 0 ? `${totals.responses}/${totals.calls}` : '0'}
              sentence={
                totals.calls > 0
                  ? `Your party called for help ${totals.calls} ${plural(totals.calls, 'time')}; you answered ${totals.responses}, and each became a Flourish.`
                  : 'No hero called for help this run.'
              }
            />
            <Tile
              icon="fermata"
              color="#e2d6f8"
              label="Fermata holds"
              value={String(totals.holds)}
              sentence={
                totals.holds > 0
                  ? `${totals.holds} lethal ${plural(totals.holds, 'hit')} caught by Fermata and held at 1 life${fermataSaves > 0 ? `; ${fermataSaves} healed through it in time` : ''}.`
                  : 'Fermata never had to hold anyone. Slot it to catch a lethal hit once per fight.'
              }
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
                          ? `Dealt ${fmt(h.damage)} damage. Your auras and Empower accounted for ${pct(share)} of it.`
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
                      style={
                        HIGHLIGHT_COLOR[h.kind] ? { color: HIGHLIGHT_COLOR[h.kind] } : undefined
                      }
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

        <Panel tone="solid" className="mt-6 p-5" data-testid="summary-relics">
          <SectionTitle
            right={
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
                <Icon name="aether" size={13} className="text-gold-300" />
                {aetherEarned(run)} earned in fights · {run.aether} left unspent
              </span>
            }
          >
            Relics and Aether
          </SectionTitle>
          {run.relics.length === 0 ? (
            <p className="text-sm text-muted">You carried no relics this time.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {run.relics.map((r) => {
                const info = relicInfo(r.id, r.cleansed);
                return (
                  <li key={r.id} className="flex gap-3 rounded-lg bg-ink-900/60 px-3 py-2.5">
                    <RelicGlyph
                      icon={info.icon}
                      rarity={info.rarity}
                      cleansed={info.cleansed}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">{info.name}</p>
                      <RelicBody info={info} compact flavor={false} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

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
            Songs:{' '}
            {run.chords
              .map(
                (c, i) =>
                  `${songName(i)}: ${c.auras.map((id) => auraDef(id).name).join(' + ') || '—'}${c.ornaments.length ? ` (${c.ornaments.map((id) => ornamentDef(id).name).join(', ')})` : ''}`,
              )
              .join(' · ') || 'none'}
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
      {rankUps.length > 0 && onDismissRankUps && (
        <RankUpCard rankUps={rankUps} onDismiss={onDismissRankUps} firstTime={firstRankUp} />
      )}
    </ScreenFrame>
  );
}

/** The run's Weaver XP and what it did for the Rank. */
/** The run's Calling: the path taken, tier by tier, and what it did over the run. */
function CallingSummary({
  calling,
  totals,
  run,
}: {
  calling: RunCalling;
  totals: EncounterStats;
  run: RunState;
}) {
  const def = callingDef(calling.id);
  const look = callingLook(def.id);
  const steps = pathSteps(calling, { map: run.map });
  const parts = callingParts(totals, calling);
  return (
    <Panel
      tone="solid"
      className="mt-6 p-5"
      style={{ borderColor: `color-mix(in srgb, ${look.color} 45%, var(--color-ink-600))` }}
      data-testid="summary-calling"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <CallingTitle def={def} size={52} />
        {parts.length > 0 ? (
          <ul className="flex flex-wrap gap-3">
            {parts.map((p) => (
              <li
                key={p.label}
                className="rounded-xl border bg-ink-900/60 px-4 py-2"
                style={{ borderColor: `color-mix(in srgb, ${look.color} 35%, transparent)` }}
              >
                <p className="font-mono text-xl font-bold" style={{ color: look.color }}>
                  {p.figure}
                </p>
                <p className="text-xs text-muted">{p.caption}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-sm text-sm text-muted">
            {callingNothingText(def.id, bindingLabel('bear'), bindingLabel('reel'))}
          </p>
        )}
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="The path you took">
        {steps.map((st) => (
          <li
            key={st.tier}
            className={`flex items-start gap-2.5 rounded-lg bg-ink-900/60 px-3 py-2.5 ${st.chosen ? '' : 'opacity-60'}`}
          >
            <PathPip
              callingId={def.id}
              state={st.chosen ? 'chosen' : 'open'}
              icon={st.chosen?.icon}
              numeral={st.numeral}
              size={32}
            />
            <div className="min-w-0">
              <p
                className="text-sm font-semibold"
                style={{ color: st.chosen ? look.color : undefined }}
              >
                {st.chosen ? st.chosen.name : `Tier ${st.numeral}: not reached`}
              </p>
              <p className="text-xs leading-relaxed text-muted">
                {st.chosen ? optionText(st.chosen) : `It would have come ${st.when}.`}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function RunRankPanel({ run, profileXp }: { run: RunState; profileXp: number }) {
  const rr = runRank(run, profileXp);
  const gain = xpGain(profileXp, run.xp);
  const p = rankPanel({ xp: profileXp, runs: 0, wins: 0 });
  return (
    <Panel tone="gold" className="mt-6 p-5" data-testid="summary-rank">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <p className="flex items-center gap-2 font-display text-2xl font-bold text-gold-200">
            <Icon name="star" size={20} solid className="text-gold-300" /> {xpHeadline(run.xp)}
          </p>
          <p className="mt-0.5 text-sm text-text">{rr.line}</p>
        </div>
        <div className="min-w-[16rem] flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-semibold text-gold-300">Rank {p.rank}</span>
            <XpBar
              before={gain.before}
              after={gain.after}
              label={`Weaver XP: ${p.progressText}`}
              className="flex-1"
            />
          </div>
          <p className="mt-1 font-mono text-xs text-muted">{p.progressText}</p>
        </div>
      </div>
      {rr.unlocks.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Unlocked this run">
          {rr.unlocks.map((u) => (
            <li key={u.id}>
              <Chip icon="sparkle" color="var(--color-gold-300)" title={u.text}>
                Rank {u.rank} · {u.name}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </Panel>
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
  const xp = useProfile((s) => s.profile.xp);
  const { rankUps, firstTime, dismiss } = useRankUps();
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
      profileXp={xp}
      rankUps={rankUps}
      onDismissRankUps={dismiss}
      firstRankUp={firstTime}
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

/**
 * The UI lab's 'Fill (5g)' group (docs/phase-5g.md): the fill's 18 relic, 6 event and 2 boon
 * glyphs; trigger chips on the HUD; the Result's and Summary's trigger lines; a draft offering a
 * Harmony with its prerequisites owned and missing; the Codex's motif, relic and event pages; and
 * each new event, once its content is in `CONTENT`. Until the fill's content merges, the chips and
 * lines name their sources from `fillFixture.ts` (shaped by the schema) and the content-driven
 * views show what content holds.
 */
import type { ReactNode } from 'react';
import { CONTENT, motifDef } from '../../content';
import { FILL_IDS } from '../../content/fill';
import type { RunState } from '../../meta/types';
import { HudView } from '../hud/Hud';
import { triggerSource, type TriggerChip } from '../hud/triggers';
import { Icon } from '../kit/Icon';
import { FILL_GLYPHS } from '../kit/iconPaths';
import { Panel } from '../kit/Panel';
import { Glyph, RelicGlyph } from '../kit/RelicGlyph';
import { CodexView } from '../screens/CodexScreen';
import { DraftView } from '../screens/DraftScreen';
import { EventGlyph, EventView } from '../screens/EventScreen';
import { ResultView } from '../screens/ResultScreen';
import { triggerLines } from '../screens/resultText';
import { SummaryView } from '../screens/SummaryScreen';
import { FIXTURE_TRIGGERS, fillFixtureContent } from './fillFixture';
import { brannResultRun, draftRun, eventRun, mockCallouts, mockHud, withParty } from './mock';

export interface FillLabView {
  id: string;
  group: string;
  label: string;
  w: number;
  h: number;
  render(): ReactNode;
}

const noop = () => {};
const GROUP = 'Fill (5g)';

/** The doc's ids for each glyph table, in its table order. */
export const FILL_RELIC_GLYPHS: readonly string[] = [
  'pilgrims_lamp',
  'tin_whistle',
  'black_ribbon',
  'pedlars_ledger',
  'spare_strings',
  'echoing_shell',
  'lament_pin',
  'sand_glass',
  'prompt_book',
  'thornwreath',
  'bell_clapper',
  'menders_needle',
  'everbell',
  'heartwood_lute',
  'water_clock',
  'iron_mask',
  'red_ink',
  'hollow_crown',
];
export const FILL_EVENT_GLYPHS: readonly string[] = [
  'heros_doubt',
  'quartermaster',
  'bleeding_bell',
  'lost_weavers_echo',
  'unravelled_tapestry',
  'stopped_clock',
];
export const FILL_BOON_GLYPHS: readonly string[] = ['steadied', 'faltering'];

/** Content's name for an id, or the id itself while the fill's content hasn't merged. */
function nameOf(id: string): string {
  return (
    CONTENT.relics.find((r) => r.id === id)?.name ??
    CONTENT.events.find((e) => e.id === id)?.name ??
    CONTENT.boons.find((b) => b.id === id)?.name ??
    id
  );
}

function GlyphGallery() {
  const rarity = (id: string) => CONTENT.relics.find((r) => r.id === id)?.rarity ?? 'common';
  const cell = (id: string, glyph: ReactNode) => (
    <li key={id} className="flex w-28 flex-col items-center gap-1.5 text-center">
      {glyph}
      <span className="text-xs text-text">{nameOf(id)}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-6 bg-ink-950 p-6">
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-gold-300">Relics</h2>
        <ul className="flex flex-wrap gap-4">
          {FILL_RELIC_GLYPHS.map((id) =>
            cell(id, <RelicGlyph icon={id} rarity={rarity(id)} size={48} />),
          )}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-gold-300">Events</h2>
        <ul className="flex flex-wrap gap-4">
          {FILL_EVENT_GLYPHS.map((id) => cell(id, <EventGlyph icon={id} size={56} />))}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-gold-300">Boons and banes</h2>
        <ul className="flex flex-wrap gap-4">
          {FILL_BOON_GLYPHS.map((id) =>
            cell(
              id,
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border"
                style={{
                  color: id === 'faltering' ? '#fb7185' : '#86efac',
                  borderStyle: id === 'faltering' ? 'dashed' : 'solid',
                }}
              >
                <Glyph icon={id} size={26} />
              </span>,
            ),
          )}
        </ul>
      </section>
      <p className="text-xs text-muted">
        {Object.keys(FILL_GLYPHS).length} glyphs, keyed by content id (`FILL_GLYPHS`).
      </p>
    </div>
  );
}

/** The fixture's fires as the HUD would show them mid-fight: one a count, one fresh. */
export function labTriggerChips(seconds: number): TriggerChip[] {
  const content = fillFixtureContent();
  const at = (id: string, count: number, ago: number): TriggerChip | null => {
    const source = triggerSource(id, content);
    return source ? { source, count, at: seconds - ago, since: seconds - ago - 0.6 } : null;
  };
  return [at('clean_strike', 3, 0.2), at('echoing_shell', 1, 0.5), at('red_ink', 2, 1.1)].filter(
    (c): c is TriggerChip => c !== null,
  );
}

function World({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 45%, #22304a 0%, #141a2e 60%, #0a0d1c 100%), repeating-linear-gradient(0deg, transparent 0 63px, rgb(255 255 255 / 0.04) 63px 64px)',
      }}
    >
      {children}
    </div>
  );
}

function TriggerHud() {
  const hud = { ...mockHud('calm'), triggers: { ...FIXTURE_TRIGGERS } };
  return (
    <World>
      <HudView
        hud={hud}
        callouts={mockCallouts('calm')}
        decree={null}
        subtitle="Movement II · node 4 of 7"
        triggerChips={labTriggerChips(hud.seconds)}
      />
    </World>
  );
}

function TriggerLinesPanel() {
  const lines = triggerLines({ triggers: { ...FIXTURE_TRIGGERS } }, fillFixtureContent());
  return (
    <div className="bg-ink-950 p-6">
      <Panel tone="solid" className="max-w-2xl p-5">
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted">
          What you did: the triggers (fixture names until the fill merges)
        </h2>
        <ul className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <li
              key={i}
              className={`flex items-start gap-3 text-sm ${l.muted ? 'text-muted' : 'text-text'}`}
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
    </div>
  );
}

/** A Result whose fight held the fill's triggers (named once their content is in `CONTENT`). */
function triggerResultRun(): RunState {
  const run = brannResultRun(CONTENT.defaultParty);
  const r = run.lastResult;
  if (!r) return run;
  const result = { ...r, stats: { ...r.stats, triggers: { ...FIXTURE_TRIGGERS } } };
  return { ...run, lastResult: result, results: [...run.results.slice(0, -1), result] };
}

function triggerSummaryRun(): RunState {
  return { ...triggerResultRun(), phase: 'summary', outcome: 'victory', pending: null };
}

/**
 * A draft offering a Harmony: the fill's first Harmony once content has one, else Blood and Silk.
 * `missing`: the run owns only its first motif prerequisite (as a merchant may offer it), and the
 * second is offered beside it, its card naming the Harmony it leads to.
 */
export function harmonyLabRun(missing: boolean): RunState {
  const h =
    CONTENT.motifs.find((m) => FILL_IDS.includes(m.id) && m.requires.motifs) ??
    motifDef('blood_and_silk');
  const pre = h.requires.motifs ?? [];
  const base = draftRun();
  const party = h.requires.hero
    ? [h.requires.hero, ...CONTENT.defaultParty.filter((id) => id !== h.requires.hero)].slice(0, 3)
    : CONTENT.defaultParty;
  const run = withParty(base, party);
  const owned = (missing ? pre.slice(0, 1) : pre).map((id) => ({ id, level: 1 }));
  const aura = h.requires.aura;
  const chords =
    aura && !run.chords.some((c) => c.auras.includes(aura))
      ? run.chords.map((c, i) => (i === 0 ? { ...c, auras: [aura, ...c.auras.slice(1)] } : c))
      : run.chords;
  const offered = [
    h.id,
    ...(missing && pre[1] ? [pre[1]] : []),
    ...CONTENT.motifs
      .filter((m) => m.rarity === 'common' && !m.requires.hero && !m.requires.aura)
      .slice(0, 1)
      .map((m) => m.id),
  ];
  return {
    ...run,
    motifs: owned,
    chords,
    draft: {
      reason: 'elite',
      rerollsLeft: 1,
      options: offered.map((motifId) => ({ motifId, level: 1, upgrade: false })),
    },
  };
}

function EventsWaiting() {
  return (
    <div className="bg-ink-950 p-6">
      <Panel tone="solid" className="max-w-2xl p-5 text-sm text-muted">
        The fill’s events are not in content yet: each gets its own view here once they merge.
      </Panel>
    </div>
  );
}

const fillEvents = CONTENT.events.filter((e) => FILL_IDS.includes(e.id));

export const FILL_VIEWS: FillLabView[] = [
  {
    id: 'fill-glyphs',
    group: GROUP,
    label: 'Glyphs: 18 relics, 6 events, 2 boons',
    w: 1280,
    h: 720,
    render: () => <GlyphGallery />,
  },
  {
    id: 'fill-hud-triggers',
    group: GROUP,
    label: 'HUD: trigger chips under the relic bar',
    w: 1280,
    h: 720,
    render: () => <TriggerHud />,
  },
  {
    id: 'fill-trigger-lines',
    group: GROUP,
    label: 'Result lines: "X triggered N times" (fixture names)',
    w: 1280,
    h: 480,
    render: () => <TriggerLinesPanel />,
  },
  {
    id: 'fill-result',
    group: GROUP,
    label: 'Result: a fight with triggers (named once the fill merges)',
    w: 1280,
    h: 1700,
    render: () => {
      const run = triggerResultRun();
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} />;
    },
  },
  {
    id: 'fill-summary',
    group: GROUP,
    label: 'Summary: the run’s triggers (named once the fill merges)',
    w: 1280,
    h: 2000,
    render: () => <SummaryView run={triggerSummaryRun()} onNewRun={noop} onLoom={noop} />,
  },
  {
    id: 'fill-draft-harmony-missing',
    group: GROUP,
    label: 'Draft: a Harmony with a prerequisite missing, and the card it leads from',
    w: 1280,
    h: 900,
    render: () => <DraftView run={harmonyLabRun(true)} onPick={noop} onReroll={noop} />,
  },
  {
    id: 'fill-draft-harmony',
    group: GROUP,
    label: 'Draft: a Harmony with every prerequisite owned',
    w: 1280,
    h: 900,
    render: () => <DraftView run={harmonyLabRun(false)} onPick={noop} onReroll={noop} />,
  },
  {
    id: 'fill-codex-motifs',
    group: GROUP,
    label: 'Codex: Motifs (Harmonies name their prerequisites)',
    w: 1280,
    h: 4200,
    render: () => (
      <CodexView onBack={noop} initialTab="motifs" roster={CONTENT.heroes.map((h) => h.id)} />
    ),
  },
  {
    id: 'fill-codex-relics',
    group: GROUP,
    label: 'Codex: Relics',
    w: 1280,
    h: 3600,
    render: () => <CodexView onBack={noop} initialTab="relics" />,
  },
  {
    id: 'fill-codex-events',
    group: GROUP,
    label: 'Codex: Events, boons and banes',
    w: 1280,
    h: 4200,
    render: () => <CodexView onBack={noop} initialTab="events" />,
  },
  ...(fillEvents.length === 0
    ? [
        {
          id: 'fill-events-waiting',
          group: GROUP,
          label: 'Events: waiting for the fill’s content',
          w: 1280,
          h: 300,
          render: () => <EventsWaiting />,
        },
      ]
    : fillEvents.map((e) => ({
        id: `fill-event-${e.id}`,
        group: GROUP,
        label: `Event: ${e.name}`,
        w: 1280,
        h: 900,
        render: () => <EventView run={eventRun(e.id)} onChoose={noop} onLeave={noop} />,
      }))),
];

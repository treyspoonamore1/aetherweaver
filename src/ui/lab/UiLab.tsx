import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as Run from '../../meta/run';
import type { RunState } from '../../meta/types';
import { HudView } from '../hud/Hud';
import { HowToPlay } from '../hud/HowToPlay';
import { PauseMenu } from '../hud/PauseMenu';
import { Button } from '../kit/Button';
import { CodexView } from '../screens/CodexScreen';
import { DraftView } from '../screens/DraftScreen';
import { MapView } from '../screens/MapScreen';
import { PrepView } from '../screens/PrepScreen';
import { RespiteView } from '../screens/RespiteScreen';
import { ResultView } from '../screens/ResultScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SummaryView } from '../screens/SummaryScreen';
import { TitleScreen } from '../screens/TitleScreen';
import {
  draftRun,
  fakeOutcome,
  freshRun,
  mockCallouts,
  mockHud,
  playedRun,
  respiteRun,
  resultRun,
  summaryRun,
  type HudScenario,
} from './mock';

/** A stand-in for the 3D arena behind the HUD. */
function World({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 45%, #2a3354 0%, #161c33 60%, #0a0d1c 100%), repeating-linear-gradient(0deg, transparent 0 63px, rgb(255 255 255 / 0.04) 63px 64px)',
      }}
    >
      <div className="absolute left-1/2 top-[44%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-gold-400/30" />
      {children}
    </div>
  );
}

function HudStage({ scenario, coach }: { scenario: HudScenario; coach?: boolean }) {
  return (
    <World>
      <HudView
        hud={mockHud(scenario)}
        callouts={mockCallouts(scenario)}
        decree={
          scenario === 'boss'
            ? {
                name: 'Requiem',
                text: 'Every hero will lose 90% of their life. Cue Kael’s dome, or Ward and heal.',
              }
            : null
        }
        subtitle={scenario === 'sandbox' ? 'Training Grounds' : 'The Prelude · node 3 of 7'}
        coach={coach}
        forceCoach
      />
    </World>
  );
}

/** Holds a run in local state, so a screen's buttons really work. */
function Interactive({
  initial,
  children,
}: {
  initial(): RunState;
  children: (run: RunState, set: (fn: (r: RunState) => RunState) => void) => ReactNode;
}) {
  const [run, setRun] = useState(initial);
  return <>{children(run, (fn) => setRun(fn))}</>;
}

/** The whole Prelude with fake combats: click through every screen to the summary. */
function Flow() {
  const [run, setRun] = useState<RunState>(() => freshRun(11));
  const set = (fn: (r: RunState) => RunState) => setRun(fn);
  switch (run.phase) {
    case 'prep':
      return (
        <PrepView
          run={run}
          onAuras={(ids) => set((r) => Run.setAuras(r, ids))}
          onEmbark={() => set(Run.embark)}
          onBack={() => set(() => freshRun(Math.floor(Math.random() * 999)))}
        />
      );
    case 'map':
      return (
        <MapView
          run={run}
          onChoose={(id) => set((r) => Run.chooseNode(r, id))}
          onAbandon={() => set(Run.abandon)}
        />
      );
    case 'combat':
      return (
        <World>
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="font-display text-2xl text-gold-300">
              Combat (the 3D view is not rendered in the lab)
            </p>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={() => set((r) => Run.finishCombat(r, fakeOutcome(r, true)))}
              >
                Win this fight
              </Button>
              <Button
                onClick={() =>
                  set((r) => Run.finishCombat(r, fakeOutcome(r, false, { deaths: 2 })))
                }
              >
                Lose it
              </Button>
            </div>
          </div>
        </World>
      );
    case 'result':
      return run.lastResult ? (
        <ResultView
          run={run}
          result={run.lastResult}
          onContinue={() => set(Run.continueFromResult)}
        />
      ) : null;
    case 'draft':
      return (
        <DraftView
          run={run}
          onPick={(i) => set((r) => Run.pickDraft(r, i))}
          onReroll={() => set(Run.rerollDraft)}
        />
      );
    case 'respite':
      return <RespiteView run={run} onChoose={(c) => set((r) => Run.respite(r, c))} />;
    case 'summary':
      return (
        <SummaryView
          run={run}
          onNewRun={() => set(() => freshRun(Math.floor(Math.random() * 999)))}
          onTitle={() => set(() => freshRun(11))}
        />
      );
  }
}

interface ViewDef {
  id: string;
  group: string;
  label: string;
  /** Design size of the stage. */
  w: number;
  h: number;
  render(): ReactNode;
}

const noop = () => {};

const VIEWS: ViewDef[] = [
  {
    id: 'hud-calm',
    group: 'Combat HUD',
    label: 'Mid-fight',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="calm" />,
  },
  {
    id: 'hud-crisis',
    group: 'Combat HUD',
    label: 'Crisis: low HP, lethal forecast, marks',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="crisis" />,
  },
  {
    id: 'hud-downed',
    group: 'Combat HUD',
    label: 'Downed + out hero',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="downed" />,
  },
  {
    id: 'hud-boss',
    group: 'Combat HUD',
    label: 'Boss phase 3, decree, Requiem',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="boss" />,
  },
  {
    id: 'hud-resonance',
    group: 'Combat HUD',
    label: 'Full Resonance, Solos ready',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="resonance" />,
  },
  {
    id: 'hud-sandbox',
    group: 'Combat HUD',
    label: 'Training Grounds',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="sandbox" coach={false} />,
  },
  {
    id: 'howto',
    group: 'Overlays',
    label: 'How to play card',
    w: 1280,
    h: 720,
    render: () => (
      <World>
        <HowToPlay onClose={noop} />
      </World>
    ),
  },
  {
    id: 'pause',
    group: 'Overlays',
    label: 'Pause menu',
    w: 1280,
    h: 720,
    render: () => (
      <World>
        <PauseMenu mode="run" onResume={noop} onAbandon={noop} />
      </World>
    ),
  },
  { id: 'title', group: 'Screens', label: 'Title', w: 1280, h: 720, render: () => <TitleScreen /> },
  {
    id: 'prep',
    group: 'Screens',
    label: 'Prep',
    w: 1280,
    h: 900,
    render: () => (
      <Interactive initial={() => freshRun(7)}>
        {(run, set) => (
          <PrepView
            run={run}
            onAuras={(ids) => set((r) => Run.setAuras(r, ids))}
            onEmbark={noop}
            onBack={noop}
          />
        )}
      </Interactive>
    ),
  },
  {
    id: 'map-start',
    group: 'Screens',
    label: 'Map: start',
    w: 1280,
    h: 800,
    render: () => <MapView run={Run.embark(freshRun(7))} onChoose={noop} onAbandon={noop} />,
  },
  {
    id: 'map-mid',
    group: 'Screens',
    label: 'Map: mid-run',
    w: 1280,
    h: 800,
    render: () => <MapView run={playedRun(3)} onChoose={noop} onAbandon={noop} />,
  },
  {
    id: 'result-win',
    group: 'Screens',
    label: 'Result: victory',
    w: 1280,
    h: 1500,
    render: () => (
      <ResultView run={resultRun(true)} result={resultRun(true).lastResult!} onContinue={noop} />
    ),
  },
  {
    id: 'result-loss',
    group: 'Screens',
    label: 'Result: defeat with deaths',
    w: 1280,
    h: 1500,
    render: () => (
      <ResultView
        run={resultRun(false, 2)}
        result={resultRun(false, 2).lastResult!}
        onContinue={noop}
      />
    ),
  },
  {
    id: 'draft',
    group: 'Screens',
    label: 'Draft (with an upgrade)',
    w: 1280,
    h: 800,
    render: () => (
      <Interactive initial={draftRun}>
        {(run, set) => <DraftView run={run} onPick={noop} onReroll={() => set(Run.rerollDraft)} />}
      </Interactive>
    ),
  },
  {
    id: 'respite',
    group: 'Screens',
    label: 'Respite',
    w: 1280,
    h: 800,
    render: () => <RespiteView run={respiteRun()} onChoose={noop} />,
  },
  {
    id: 'summary-win',
    group: 'Screens',
    label: 'Summary: victory',
    w: 1280,
    h: 1800,
    render: () => <SummaryView run={summaryRun('victory')} onNewRun={noop} onTitle={noop} />,
  },
  {
    id: 'summary-loss',
    group: 'Screens',
    label: 'Summary: defeat',
    w: 1280,
    h: 1800,
    render: () => (
      <SummaryView run={summaryRun('defeat')} onNewRun={noop} onTitle={noop} assisted />
    ),
  },
  {
    id: 'summary-abandon',
    group: 'Screens',
    label: 'Summary: abandoned (early)',
    w: 1280,
    h: 1500,
    render: () => (
      <SummaryView run={Run.abandon(Run.embark(freshRun(7)))} onNewRun={noop} onTitle={noop} />
    ),
  },
  {
    id: 'codex',
    group: 'Screens',
    label: 'Codex',
    w: 1280,
    h: 900,
    render: () => <CodexView onBack={noop} />,
  },
  {
    id: 'settings',
    group: 'Screens',
    label: 'Settings',
    w: 1280,
    h: 900,
    render: () => <SettingsScreen />,
  },
  {
    id: 'flow',
    group: 'Flow',
    label: 'Whole run, fake combats',
    w: 1280,
    h: 800,
    render: () => <Flow />,
  },
];

function readParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    view: p.get('view') ?? VIEWS[0]!.id,
    h: Number(p.get('h')) || 0,
    fit: p.get('fit') !== '0',
    nav: p.get('nav') !== '0',
  };
}

/** `?lab=ui` — every HUD state and screen against mock data. `&view=<id>` selects one. */
export function UiLab() {
  const [params, setParams] = useState(readParams);
  const view = VIEWS.find((v) => v.id === params.view) ?? VIEWS[0]!;
  const stageH = params.h || view.h;
  const select = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', id);
    url.searchParams.delete('h');
    window.history.replaceState(null, '', url);
    setParams(readParams());
  };

  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setScale(params.fit ? Math.min(1, el.clientWidth / view.w) : 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [params.fit, view.w]);
  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const groups = [...new Set(VIEWS.map((v) => v.group))];
  return (
    <div className="flex min-h-full bg-ink-950 text-text">
      {params.nav && (
        <nav
          className="sticky top-0 h-screen w-64 shrink-0 overflow-y-auto border-r border-ink-600/60 bg-ink-900 p-4"
          aria-label="UI lab views"
        >
          <h1 className="font-display text-lg font-bold text-gold-300">UI lab</h1>
          <p className="mb-3 text-xs text-muted">Mock data for every HUD state and screen.</p>
          {groups.map((g) => (
            <div key={g} className="mb-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{g}</p>
              <ul className="flex flex-col gap-0.5">
                {VIEWS.filter((v) => v.group === g).map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => select(v.id)}
                      aria-current={v.id === view.id}
                      className={`w-full rounded-md px-2.5 py-1.5 text-left text-sm ${v.id === view.id ? 'bg-gold-400 font-semibold text-ink-950' : 'text-text hover:bg-ink-800'}`}
                    >
                      {v.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      )}
      <div ref={holder} className="min-w-0 flex-1 p-4">
        <div
          style={{ width: view.w * scale, height: stageH * scale }}
          data-testid="lab-stage-outer"
        >
          <div
            data-testid="lab-stage"
            className="relative origin-top-left overflow-hidden rounded-lg border border-ink-600"
            style={{ width: view.w, height: stageH, transform: `scale(${scale})` }}
          >
            {view.render()}
          </div>
        </div>
      </div>
    </div>
  );
}

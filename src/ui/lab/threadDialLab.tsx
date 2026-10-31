/**
 * UI lab: the Thread dial (docs/thread-dial.md). `DialCycle` is a fight's HUD whose Thread
 * switches mode on a timer, to watch the crossfade; `DialGallery` sets the dial's every state
 * side by side, large, with what each says.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { HudView } from '../hud/Hud';
import { ThreadDial } from '../hud/ThreadDial';
import { threadDialView } from '../hud/threadMode';
import type { HeroHud, WeaverHud } from '../store';
import { mockHud, type HudScenario } from './mock';

/** How long each mode holds before the next switch (ms). */
export const DIAL_CYCLE_MS = 1600;

/** A mid-fight HUD whose Thread switches Mend → Empower (→ Bear, on the Martyr's run) and on. */
export function DialCycle({ martyr = false }: { martyr?: boolean }) {
  const scenario: HudScenario = martyr ? 'martyr-bear' : 'calm';
  const base = useMemo(() => mockHud(scenario), [scenario]);
  const modes: WeaverHud['threadMode'][] = martyr
    ? ['mend', 'empower', 'bear']
    : ['mend', 'empower'];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((k) => k + 1), DIAL_CYCLE_MS);
    return () => window.clearInterval(t);
  }, []);
  const mode = modes[i % modes.length]!;
  const hud = {
    ...base,
    weaver: { ...base.weaver, threadMode: mode, lastMode: mode === 'bear' ? 'empower' : mode },
  } as typeof base;
  return (
    <HudView
      hud={hud}
      callouts={[]}
      decree={null}
      subtitle="The Prelude · node 3 of 10"
      coach={false}
      keyHints={false}
    />
  );
}

/** The dial's states, each with its plate and what it says. */
export function DialGallery() {
  const base = useMemo(() => mockHud('calm'), []);
  const martyr = useMemo(() => mockHud('martyr-bear'), []);
  const kael = base.party[0] ?? null;
  const w = base.weaver;
  const states: { title: string; weaver: WeaverHud; target: HeroHud | null }[] = [
    { title: 'Mend, on Kael', weaver: { ...w, threadMode: 'mend' }, target: kael },
    { title: 'Empower, on Kael', weaver: { ...w, threadMode: 'empower' }, target: kael },
    {
      title: 'Bear (the Martyr)',
      weaver: { ...martyr.weaver, threadMode: 'bear' },
      target: martyr.party[0] ?? null,
    },
    { title: 'On no one', weaver: { ...w, threadMode: 'mend', threadSlot: null }, target: null },
    { title: 'Snapped', weaver: { ...w, threadMode: 'empower', threadLock: 2.4 }, target: kael },
    { title: 'The Weaver down', weaver: { ...w, threadMode: 'mend', downed: true }, target: kael },
  ];
  return (
    <div className="grid h-full grid-cols-3 gap-4 bg-ink-950 p-6">
      {states.map((s) => {
        const view = threadDialView(s.weaver, s.target);
        return (
          <Card key={s.title} title={s.title}>
            <div className="flex h-28 items-center justify-center" style={{ zoom: 1.6 }}>
              <ThreadDial view={view} />
            </div>
            <p className="text-center text-xs leading-snug text-muted">{view.says}</p>
          </Card>
        );
      })}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-ink-600/70 bg-ink-900/80 p-3">
      <h3 className="text-center font-display text-sm text-gold-300">{title}</h3>
      {children}
    </section>
  );
}

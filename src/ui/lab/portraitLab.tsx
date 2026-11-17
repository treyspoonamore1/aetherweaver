/**
 * The UI lab's 'Portraits (8d)' group (docs/phase-8.md, 8d): every portrait on one sheet with its
 * name, and the Codex pages that show them. The sheet's address takes `&vision=` (a colour
 * vision), `&robe=` and `&thread=` (keepsake ids): what the Weaver wears there.
 */
import type { ReactNode } from 'react';
import { COLOR_VISIONS, type ColorVision } from '../../app/colorVision';
import { CONTENT } from '../../content';
import { Portrait } from '../kit/Portrait';
import { weaverSubject } from '../kit/portraitStore';
import { CodexView } from '../screens/CodexScreen';
import { movementLabel } from '../screens/routeText';
import { ROSTER6 } from './serenLab';

export interface PortraitLabView {
  id: string;
  group: string;
  label: string;
  w: number;
  h: number;
  render(): ReactNode;
}

const noop = () => {};
const GROUP = 'Portraits (8d)';

/** What the Weaver wears in the lab, from the address. */
function labLook(): { robe: string | null; thread: string | null; vision: ColorVision } {
  const q = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const vision = q.get('vision') as ColorVision | null;
  return {
    robe: q.get('robe'),
    thread: q.get('thread'),
    vision: vision && COLOR_VISIONS.includes(vision) ? vision : 'normal',
  };
}

function Tile({ children, name, note }: { children: ReactNode; name: string; note?: string }) {
  return (
    <figure className="flex w-36 flex-col items-center gap-1.5" data-testid="portrait-tile">
      {children}
      <figcaption className="text-center text-sm font-semibold leading-tight text-text">
        {name}
        {note && <span className="block text-xs font-normal text-muted">{note}</span>}
      </figcaption>
    </figure>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold text-gold-300">{title}</h2>
      <div className="flex flex-wrap gap-x-4 gap-y-5">{children}</div>
    </section>
  );
}

/** Every portrait with its name: the heroes, the Weaver in each robe and Thread look, each world's enemies. */
function PortraitSheet() {
  const { robe, thread, vision } = labLook();
  const movements = [...new Set(CONTENT.enemies.map((e) => e.movement ?? 1))].sort();
  return (
    <div className="flex flex-col gap-7 bg-ink-950 p-8" data-testid="portrait-sheet">
      <Row title="Heroes">
        {CONTENT.heroes.map((h) => (
          <Tile key={h.id} name={h.name} note={h.title}>
            <Portrait subject={{ kind: 'hero', id: h.id }} name={h.name} size={128} />
          </Tile>
        ))}
      </Row>
      <Row title={`The Weaver (colour vision: ${vision})`}>
        <Tile name="The Weaver" note={robe || thread ? 'as dressed in the address' : 'her own'}>
          <Portrait
            subject={weaverSubject({ robe, thread }, vision)}
            name="The Weaver"
            size={128}
          />
        </Tile>
        {CONTENT.cosmetics.robes.map((r) => (
          <Tile key={r.id} name={r.name} note="robe">
            <Portrait
              subject={weaverSubject({ robe: r.id, thread: null }, vision)}
              name={`The Weaver, ${r.name}`}
              size={128}
            />
          </Tile>
        ))}
        {CONTENT.cosmetics.threads.map((t) => (
          <Tile key={t.id} name={t.name} note="Thread look (her hands)">
            <Portrait
              subject={weaverSubject({ robe: null, thread: t.id }, vision)}
              name={`The Weaver, ${t.name}`}
              size={128}
            />
          </Tile>
        ))}
      </Row>
      {movements.map((m) => (
        <Row key={m} title={`${movementLabel(m)} · ${CONTENT.movements[m - 1]?.mapTitle ?? ''}`}>
          {CONTENT.enemies
            .filter((e) => (e.movement ?? 1) === m)
            .map((e) => (
              <Tile key={e.id} name={e.name} note={e.role}>
                <Portrait
                  subject={{ kind: 'enemy', id: e.id }}
                  name={e.name}
                  size={128}
                  world={m}
                />
              </Tile>
            ))}
        </Row>
      ))}
    </div>
  );
}

function CodexWeaver() {
  const { robe, thread } = labLook();
  return <CodexView onBack={noop} initialTab="weaver" look={{ robe, thread }} />;
}

export const PORTRAIT_VIEWS: PortraitLabView[] = [
  {
    id: 'portraits',
    group: GROUP,
    label: 'Every portrait, with its name',
    w: 1280,
    h: 2000,
    render: () => <PortraitSheet />,
  },
  {
    id: 'portraits-codex-heroes',
    group: GROUP,
    label: 'Codex: Heroes, all six',
    w: 1280,
    h: 2300,
    render: () => <CodexView onBack={noop} initialTab="heroes" roster={ROSTER6} />,
  },
  {
    id: 'portraits-codex-enemies',
    group: GROUP,
    label: 'Codex: Enemies, every Movement',
    w: 1280,
    h: 9000,
    render: () => <CodexView onBack={noop} initialTab="enemies" />,
  },
  {
    id: 'portraits-codex-enemies-unseen',
    group: GROUP,
    label: 'Codex: Enemies, only First Light’s met',
    w: 1280,
    h: 5200,
    render: () => (
      <CodexView onBack={noop} initialTab="enemies" seen={['hollow_chorister', 'bell_brute']} />
    ),
  },
  {
    id: 'portraits-codex-weaver',
    group: GROUP,
    label: 'Codex: The Weaver (her card; &robe= &thread= &vision=)',
    w: 1280,
    h: 1500,
    render: () => <CodexWeaver />,
  },
];

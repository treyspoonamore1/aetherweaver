import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CONTENT, arenaDef } from '../../content';
import {
  FixedStepper,
  createSim,
  type Command,
  type EntityId,
  type PartySlot,
  type Sim,
  type SimEvent,
  type WorldState,
} from '../../sim';
import { CameraRig } from '../camera';
import { CombatView } from '../combatView';
import { Stage, type QualityTier } from '../stage';

/**
 * VFX lab (`?lab=vfx`): a Stage + CameraRig + the real combat view over a real debug sim,
 * with buttons to stage every juice-table item, plus synthetic event injection so one-off
 * moments (Perfect Ward, Save…) can be reviewed in isolation. `window.__VFX__` exposes the
 * same controls to screenshot scripts.
 */

type Settings = { screenShake: number; flashes: boolean; damageNumbers: boolean };

interface LabApi {
  queue(command: Command): void;
  inject(events: SimEvent[]): void;
  state(): WorldState;
  info(): { calls: number; triangles: number; particles: number; fps: number };
  preset(name: string): void;
  setTheme(arena: string): void;
  setHymn(on: boolean): void;
  grammar(on: boolean): void;
  setQuality(q: QualityTier): void;
  setPaused(paused: boolean): void;
  heroId(slot: number): EntityId;
  debug(): Record<string, number>;
}

declare global {
  interface Window {
    __VFX__?: LabApi;
  }
}

const ENCOUNTERS = ['sandbox', 'first_light', 'muted_nave', 'bellwarden', 'hollow_cantor'];
const THEMES = CONTENT.arenas.map((a) => a.id);

class LabRuntime {
  readonly sim: Sim;
  readonly stage: Stage;
  readonly rig: CameraRig;
  private view: CombatView;
  private readonly overlay: HTMLDivElement;
  private readonly stepper = new FixedStepper(60, 5);
  private readonly pending: Command[] = [];
  private raf = 0;
  private last = -1;
  private start = -1;
  private aim: { x: number; z: number } | null = null;
  private keys = new Set<string>();
  private moveX = 0;
  private moveZ = 0;
  private hymn = false;
  paused = false;
  timeScale = 1;
  settings: Settings = { screenShake: 1, flashes: true, damageNumbers: true };
  private frames = 0;
  private fpsTimer = 0;
  fps = 0;

  constructor(
    container: HTMLElement,
    encounter: string,
    private theme: string,
    quality: QualityTier,
  ) {
    this.sim = createSim({
      seed: 1234,
      encounter,
      debug: true,
      auras: ['sostenuto', 'fortissimo'],
    });
    this.stage = new Stage(container, quality);
    this.rig = new CameraRig(this.stage.camera);
    this.overlay = document.createElement('div');
    this.overlay.className = 'pointer-events-none absolute inset-0 overflow-hidden';
    container.appendChild(this.overlay);
    this.view = this.createView();
    const w = this.sim.state.entities.get(this.sim.state.weaverId);
    this.rig.snapTo(w?.x ?? 0, w?.z ?? 0);
    this.view.onEvents(this.sim.drainEvents(), this.sim.state);
    this.stage.canvas.addEventListener('pointermove', this.onPointer);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
  }

  private createView(): CombatView {
    return new CombatView(
      {
        stage: this.stage,
        rig: this.rig,
        overlay: this.overlay,
        arena: arenaDef(this.theme),
        quality: this.stage.qualityTier,
      },
      this.sim.state,
    );
  }

  setTheme(theme: string): void {
    this.theme = theme;
    this.view.dispose();
    this.view = this.createView();
    this.view.field.hymnOverride = this.hymn ? this.hymnCircles() : null;
  }

  setQuality(q: QualityTier): void {
    this.stage.setQuality(q);
    this.view.setQuality(q);
  }

  private hymnCircles(): { x: number; z: number; r: number }[] {
    const w = this.sim.state.entities.get(this.sim.state.weaverId);
    const x = w?.x ?? 0;
    const z = w?.z ?? 0;
    return [
      { x: x - 5, z: z - 3, r: 3.6 },
      { x: x + 6, z: z - 4, r: 3.6 },
      { x: x + 0.5, z: z + 5, r: 3.6 },
    ];
  }

  /** Synthetic telegraphs around the Weaver: every shape, both severities, a cast circle. */
  grammar(on: boolean): void {
    if (!on) {
      this.view.telegraphs.preview = null;
      return;
    }
    const s = this.sim.state;
    const w = this.weaverPos();
    const now = s.time;
    const kael = this.heroId(0);
    const lyra = this.heroId(1);
    const vexis = this.heroId(2);
    const enemy = this.nearestEnemy() ?? kael;
    let id = 900000 + Math.floor(now * 10) * 10;
    type T = WorldState['telegraphs'][number];
    const mk = (
      shape: T['shape'],
      severity: 'normal' | 'lethal',
      windup: number,
      answers: T['answers'],
      name: string,
    ): T => ({
      id: id++,
      owner: enemy,
      target: null,
      attackId: 'lab',
      name,
      kind: 'burst',
      shape,
      start: now,
      impact: now + windup,
      perfectFrom: now + windup - 0.35,
      damage: 500,
      pctMaxHp: 0,
      effect: 'damage',
      answers,
      severity,
    });
    this.view.telegraphs.preview = [
      {
        t: mk(
          { kind: 'circle', x: w.x - 7, z: w.z - 5, r: 2.6 },
          'normal',
          3,
          ['scatter', 'reel'],
          'Burst',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'circle', x: w.x - 1, z: w.z - 7, r: 2.6 },
          'lethal',
          3,
          ['ward'],
          'Lethal burst',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          {
            kind: 'cone',
            x: w.x + 4,
            z: w.z - 3,
            r: 4.5,
            dirX: 0.6,
            dirZ: -0.8,
            halfAngleCos: Math.cos(0.9),
          },
          'normal',
          2.4,
          ['ward'],
          'Cleave',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'line', x: w.x - 10, z: w.z + 4, toX: w.x + 9, toZ: w.z + 6, width: 1.4 },
          'lethal',
          3.4,
          ['ward', 'reel', 'move'],
          'Lance',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'donut', x: w.x + 9, z: w.z + 2, innerR: 1.6, outerR: 4.2 },
          'normal',
          3,
          ['stack'],
          'Toll Inward',
        ),
        effect: 'damage',
      },
      {
        t: mk({ kind: 'mark', target: lyra }, 'normal', 4, ['chime', 'ward'], 'Dirge'),
        effect: 'damage',
      },
      {
        t: mk({ kind: 'link', a: kael, b: vexis, r: 6 }, 'normal', 4, ['scatter'], 'Resound'),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'circle', x: w.x - 9, z: w.z - 12, r: 3 },
          'normal',
          3,
          ['focus'],
          'Mending Hymn',
        ),
        effect: 'healAllies',
      },
    ];
  }

  setHymn(on: boolean): void {
    this.hymn = on;
    this.view.field.hymnOverride = on ? this.hymnCircles() : null;
  }

  run(): void {
    if (this.raf === 0) this.raf = requestAnimationFrame(this.frame);
  }

  queue(c: Command): void {
    this.pending.push(c);
  }

  inject(events: SimEvent[]): void {
    this.view.onEvents(events, this.sim.state);
  }

  heroId(slot: number): EntityId {
    return this.sim.state.party[slot] ?? -1;
  }

  heroPos(slot: number): { x: number; z: number } {
    const e = this.sim.state.entities.get(this.heroId(slot));
    return { x: e?.x ?? 0, z: e?.z ?? 0 };
  }

  weaverPos(): { x: number; z: number } {
    const e = this.sim.state.entities.get(this.sim.state.weaverId);
    return { x: e?.x ?? 0, z: e?.z ?? 0 };
  }

  nearestEnemy(): EntityId | null {
    const w = this.weaverPos();
    let best: EntityId | null = null;
    let bd = Infinity;
    for (const e of this.sim.state.entities.list()) {
      if (e.kind !== 'enemy' || e.health?.dead) continue;
      const d = Math.hypot(e.x - w.x, e.z - w.z);
      if (d < bd) {
        bd = d;
        best = e.id;
      }
    }
    return best;
  }

  spawn(defId: string, dx: number, dz: number, elite = false): void {
    const w = this.weaverPos();
    this.queue({ t: 'debug', op: { op: 'spawnEnemy', defId, x: w.x + dx, z: w.z + dz, elite } });
  }

  preset(name: string): void {
    const q = (c: Command) => this.queue(c);
    switch (name) {
      case 'gallery':
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('bell_brute', -3, -4);
        this.spawn('glass_lancer', 9, -10);
        this.spawn('lamenter', -8, -10);
        this.spawn('cantor_acolyte', 3, -12);
        this.spawn('mute', 6, -3);
        break;
      case 'busy': {
        q({ t: 'debug', op: { op: 'killEnemies' } });
        const ring: [string, number][] = [
          ['hollow_chorister', 12],
          ['bell_brute', 3],
          ['lamenter', 3],
          ['glass_lancer', 3],
          ['cantor_acolyte', 2],
          ['mute', 1],
        ];
        let i = 0;
        for (const [id, n] of ring) {
          for (let k = 0; k < n; k++, i++) {
            const a = (i / 24) * Math.PI * 2;
            const r = 6 + (i % 3) * 2.5;
            this.spawn(
              id,
              Math.cos(a) * r,
              Math.sin(a) * r - 2,
              k === 0 && id !== 'hollow_chorister',
            );
          }
        }
        this.spawn('the_bellwarden', 0, -12);
        break;
      }
      case 'cantor':
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('the_hollow_cantor', 0, -9);
        this.spawn('hollow_chorister', -4, -6);
        this.spawn('hollow_chorister', 4, -6);
        break;
      case 'bellwarden':
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('the_bellwarden', 0, -7);
        break;
      default:
        break;
    }
  }

  private onPointer = (ev: PointerEvent): void => {
    const p = { x: 0, z: 0 };
    if (this.stage.pickGround(ev.clientX, ev.clientY, p)) {
      this.aim = p;
      this.queue({ t: 'aim', x: p.x, z: p.z });
    }
  };

  private onKey = (ev: KeyboardEvent): void => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
    const down = ev.type === 'keydown';
    if (down) this.keys.add(ev.code);
    else this.keys.delete(ev.code);
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW')) z -= 1;
    if (this.keys.has('KeyS')) z += 1;
    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    const m = Math.hypot(x, z) || 1;
    x /= m;
    z /= m;
    if (x !== this.moveX || z !== this.moveZ) {
      this.moveX = x;
      this.moveZ = z;
      this.queue({ t: 'move', x, z });
    }
    if (down && ev.code === 'Space') {
      this.queue({ t: 'glide', x: x || 0, z: z || -1 });
    }
  };

  private hovered(kind: 'hero' | 'enemy'): EntityId | null {
    if (!this.aim) return null;
    for (const e of this.sim.state.entities.list()) {
      if (e.kind !== kind) continue;
      if (Math.hypot(e.x - this.aim.x, e.z - this.aim.z) < e.radius + 0.6) return e.id;
    }
    return null;
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const elapsed = this.last < 0 ? 0 : Math.min(250, now - this.last);
    this.last = now;
    if (this.start < 0) this.start = now;
    if (!this.paused) {
      const steps = this.stepper.advance(elapsed * this.timeScale);
      if (steps > 0) {
        const cmds = this.pending.splice(0);
        for (let i = 0; i < steps; i++) this.sim.step(i === 0 ? cmds : []);
        this.view.onEvents(this.sim.drainEvents(), this.sim.state);
      }
    }
    const state = this.sim.state;
    const alpha = this.stepper.alpha;
    const w = state.entities.get(state.weaverId);
    this.rig.shakeScale = this.settings.screenShake;
    if (w) {
      const wx = w.px + (w.x - w.px) * alpha;
      const wz = w.pz + (w.z - w.pz) * alpha;
      this.rig.update(wx, wz, this.aim?.x ?? wx, this.aim?.z ?? wz, elapsed / 1000);
    }
    this.view.sync(state, {
      realDt: elapsed / 1000,
      time: (now - this.start) / 1000,
      alpha,
      hoveredHero: this.hovered('hero'),
      hoveredEnemy: this.hovered('enemy'),
      aim: this.aim,
      settings: this.settings,
    });
    this.stage.render();
    this.frames++;
    this.fpsTimer += elapsed;
    if (this.fpsTimer > 500) {
      this.fps = (this.frames * 1000) / this.fpsTimer;
      this.frames = 0;
      this.fpsTimer = 0;
    }
  };

  info(): { calls: number; triangles: number; particles: number; fps: number } {
    const i = this.stage.info();
    return {
      ...i,
      particles: this.view.kit.particles.alive + this.view.kit.smoke.alive,
      fps: this.fps,
    };
  }

  debug(): Record<string, number> {
    const k = this.view.kit;
    return {
      rings: k.rings.size,
      beams: k.beams.size,
      sprites: k.sprites.size,
      shells: k.shells.size,
      telegraphs: k.telegraphs.size,
      marks: k.marks.size,
      bars: k.bars.size,
      geometries: this.stage.renderer.info.memory.geometries,
      textures: this.stage.renderer.info.memory.textures,
      programs: this.stage.renderer.info.programs?.length ?? 0,
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.stage.canvas.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    this.view.dispose();
    this.stage.dispose();
    this.overlay.remove();
  }
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-ink-700 px-3 py-2">
      <h2 className="mb-1.5 font-display text-[11px] tracking-[0.14em] text-gold-300 uppercase">
        {title}
      </h2>
      <div className="flex flex-wrap gap-1">{children}</div>
    </section>
  );
}

function Btn({
  onClick,
  children,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded border border-ink-600 bg-ink-800 px-2 py-0.5 text-[11px] text-text hover:border-gold-400 hover:bg-ink-700"
    >
      {children}
    </button>
  );
}

export function VfxLab() {
  const hostRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLPreElement>(null);
  const rtRef = useRef<LabRuntime | null>(null);
  const [encounter, setEncounter] = useState('sandbox');
  const [theme, setTheme] = useState('reliquary_hall');
  const [quality, setQuality] = useState<QualityTier>('high');
  const [elite, setElite] = useState(false);
  const [slot, setSlot] = useState<PartySlot>(0);
  const [hymn, setHymn] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const rt = new LabRuntime(host, encounter, theme, quality);
    rtRef.current = rt;
    rt.run();
    window.__VFX__ = {
      queue: (c) => rt.queue(c),
      inject: (e) => rt.inject(e),
      state: () => rt.sim.state,
      info: () => rt.info(),
      preset: (n) => rt.preset(n),
      setTheme: (t) => rt.setTheme(t),
      setHymn: (on) => rt.setHymn(on),
      grammar: (on) => rt.grammar(on),
      setQuality: (q) => rt.setQuality(q),
      setPaused: (p) => {
        rt.paused = p;
      },
      heroId: (s) => rt.heroId(s),
      debug: () => rt.debug(),
    };
    const timer = window.setInterval(() => {
      const i = rt.info();
      if (statsRef.current) {
        statsRef.current.textContent = `fps ${i.fps.toFixed(1)}  calls ${i.calls}  tris ${(i.triangles / 1000).toFixed(1)}k\nparticles ${i.particles}  entities ${rt.sim.state.entities.count}  tick ${rt.sim.tick}`;
      }
    }, 250);
    return () => {
      window.clearInterval(timer);
      delete window.__VFX__;
      rt.dispose();
      rtRef.current = null;
    };
    // The theme and quality are applied live below; only the encounter recreates the sim.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter]);

  useEffect(() => {
    rtRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    rtRef.current?.setQuality(quality);
  }, [quality]);
  useEffect(() => {
    rtRef.current?.setHymn(hymn);
  }, [hymn]);

  const rt = () => rtRef.current;
  const q = (c: Command) => rt()?.queue(c);
  const tick = () => rt()?.sim.tick ?? 0;
  const hero = () => rt()?.heroId(slot) ?? -1;
  const inject = (e: SimEvent[]) => rt()?.inject(e);

  return (
    <main className="fixed inset-0 flex bg-ink-950 text-text">
      <div ref={hostRef} className="relative flex-1" data-testid="vfx-host" />
      <aside
        className="w-72 shrink-0 overflow-y-auto border-l border-ink-700 bg-ink-900/95 text-xs"
        data-testid="vfx-panel"
      >
        <header className="border-b border-ink-700 px-3 py-2">
          <h1 className="font-display text-sm tracking-[0.18em] text-gold-300">VFX LAB</h1>
          <pre ref={statsRef} className="mt-1 font-mono text-[10px] leading-tight text-muted" />
          <p className="mt-1 text-[10px] text-muted">WASD move · Space glide · mouse aims</p>
        </header>
        <Group title="Scene">
          <label className="flex w-full items-center justify-between gap-2">
            Encounter
            <select
              className="bg-ink-800"
              value={encounter}
              onChange={(e) => setEncounter(e.target.value)}
            >
              {ENCOUNTERS.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Theme
            <select className="bg-ink-800" value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Quality
            <select
              className="bg-ink-800"
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualityTier)}
            >
              <option>low</option>
              <option>medium</option>
              <option>high</option>
            </select>
          </label>
          <Btn onClick={() => rt() && (rt()!.paused = !rt()!.paused)}>Pause</Btn>
          <Btn onClick={() => rt() && (rt()!.timeScale = rt()!.timeScale === 1 ? 0.25 : 1)}>
            Slow ×¼
          </Btn>
          <Btn
            onClick={() =>
              rt() && (rt()!.settings = { ...rt()!.settings, flashes: !rt()!.settings.flashes })
            }
          >
            Flashes
          </Btn>
          <Btn
            onClick={() =>
              rt() &&
              (rt()!.settings = { ...rt()!.settings, damageNumbers: !rt()!.settings.damageNumbers })
            }
          >
            Numbers
          </Btn>
        </Group>
        <Group title="Presets">
          <Btn onClick={() => rt()?.preset('gallery')}>Telegraph gallery</Btn>
          <Btn onClick={() => rt()?.preset('busy')}>Busy fight (25)</Btn>
          <Btn onClick={() => rt()?.preset('cantor')}>Boss: Cantor</Btn>
          <Btn onClick={() => rt()?.preset('bellwarden')}>Boss: Bellwarden</Btn>
          <Btn onClick={() => q({ t: 'debug', op: { op: 'killEnemies' } })}>Kill all</Btn>
          <Btn onClick={() => q({ t: 'debug', op: { op: 'healParty' } })}>Heal party</Btn>
          <Btn onClick={() => setHymn(!hymn)}>{hymn ? 'Hide' : 'Show'} hymn circles</Btn>
          <Btn
            onClick={() => rt()?.grammar(true)}
            title="Synthetic telegraphs: every shape, both severities (click again to restart)"
          >
            Telegraph grammar
          </Btn>
          <Btn onClick={() => rt()?.grammar(false)}>Clear grammar</Btn>
        </Group>
        <Group title="Spawn">
          <label className="flex w-full items-center gap-1">
            <input type="checkbox" checked={elite} onChange={(e) => setElite(e.target.checked)} />{' '}
            elite
          </label>
          {CONTENT.enemies.map((d) => (
            <Btn
              key={d.id}
              onClick={() =>
                rt()?.spawn(d.id, (Math.random() - 0.5) * 10, -7 - Math.random() * 4, elite)
              }
            >
              {d.name.replace('The ', '')}
            </Btn>
          ))}
        </Group>
        <Group title="Weaver">
          <label className="flex w-full items-center justify-between">
            Target slot
            <select
              className="bg-ink-800"
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value) as PartySlot)}
            >
              <option value={0}>0 · Kael</option>
              <option value={1}>1 · Lyra</option>
              <option value={2}>2 · Vexis</option>
            </select>
          </label>
          <Btn onClick={() => q({ t: 'thread', slot })}>Thread</Btn>
          <Btn onClick={() => q({ t: 'mode' })}>Mode</Btn>
          <Btn onClick={() => q({ t: 'tech', id: 'ward', slot })}>Ward</Btn>
          <Btn onClick={() => rt() && q({ t: 'tech', id: 'chime', point: rt()!.heroPos(slot) })}>
            Chime
          </Btn>
          <Btn onClick={() => q({ t: 'tech', id: 'reel', slot })}>Reel</Btn>
          <Btn onClick={() => q({ t: 'glide', x: 1, z: 0 })}>Glide →</Btn>
          <Btn onClick={() => q({ t: 'glide', x: -1, z: 0 })}>Glide ←</Btn>
          <Btn
            onClick={() => {
              q({ t: 'debug', op: { op: 'setResonance', value: 100 } });
              q({ t: 'cue', slot });
            }}
          >
            Cue
          </Btn>
          <Btn
            onClick={() => {
              q({ t: 'debug', op: { op: 'setResonance', value: 100 } });
              q({ t: 'crescendo' });
            }}
          >
            Crescendo
          </Btn>
          <Btn onClick={() => q({ t: 'debug', op: { op: 'setResonance', value: 75 } })}>
            Resonance 75
          </Btn>
          <Btn
            onClick={() => {
              const id = rt()?.nearestEnemy();
              if (id !== null && id !== undefined) q({ t: 'directive', kind: 'focus', target: id });
            }}
          >
            Focus nearest
          </Btn>
          <Btn onClick={() => q({ t: 'directive', kind: 'scatter' })}>Scatter</Btn>
          <Btn onClick={() => q({ t: 'directive', kind: 'rally' })}>Rally</Btn>
        </Group>
        <Group title="Inject (synthetic)">
          <Btn
            onClick={() => {
              const s = rt()?.sim.state;
              const tg = s?.telegraphs[0]?.id ?? null;
              inject([
                { type: 'perfectWard', tick: tick(), target: hero(), telegraph: tg, negated: 520 },
              ]);
            }}
          >
            Perfect Ward
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'save',
                  tick: tick(),
                  target: hero(),
                  cause: 'ward',
                  counterfactualDamage: 1140,
                  attack: 'Requiem',
                },
              ])
            }
          >
            Save
          </Btn>
          <Btn
            onClick={() => {
              const p = rt()?.heroPos(slot) ?? { x: 0, z: 0 };
              inject([
                {
                  type: 'chimeLanded',
                  tick: tick(),
                  chime: 0,
                  x: p.x,
                  z: p.z,
                  radius: 4,
                  cleansed: 1,
                  clutch: true,
                },
                { type: 'cleansed', tick: tick(), target: hero(), removed: 2, clutch: true },
              ]);
            }}
          >
            Clutch Chime
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'damageTaken',
                  tick: tick(),
                  target: rt()?.nearestEnemy() ?? hero(),
                  source: hero(),
                  amount: 412,
                  absorbed: 0,
                  amplified: 96,
                  crit: false,
                  telegraph: null,
                  hit: 'hit',
                },
              ])
            }
          >
            Hit 412 +96
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'damageTaken',
                  tick: tick(),
                  target: hero(),
                  source: null,
                  amount: 640,
                  absorbed: 180,
                  amplified: 0,
                  crit: false,
                  telegraph: null,
                  hit: 'hit',
                },
              ])
            }
          >
            Hero hit
          </Btn>
          <Btn
            onClick={() =>
              inject([{ type: 'shieldBroken', tick: tick(), target: hero(), shield: 'ward' }])
            }
          >
            Shatter
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'soloStarted',
                  tick: tick(),
                  hero: hero(),
                  solo: 'aegisWall',
                  cued: true,
                  duration: 4,
                },
              ])
            }
          >
            Cue sigil + dome
          </Btn>
          <Btn
            onClick={() =>
              inject([{ type: 'crescendoStart', tick: tick(), calling: 'Test', duration: 6 }])
            }
          >
            Crescendo FX
          </Btn>
          <Btn onClick={() => inject([{ type: 'allyDowned', tick: tick(), hero: hero() }])}>
            Downed pulse
          </Btn>
          <Btn
            onClick={() => {
              const id = rt()?.nearestEnemy();
              if (id !== null && id !== undefined)
                inject([{ type: 'phaseChanged', tick: tick(), boss: id, phase: 2 }]);
            }}
          >
            Phase change
          </Btn>
          <Btn onClick={() => inject([{ type: 'threadSnapped', tick: tick(), target: hero() }])}>
            Snap
          </Btn>
          <Btn
            onClick={() => {
              const p = rt()?.heroPos(slot) ?? { x: 0, z: 0 };
              inject([{ type: 'spawnWarning', tick: tick(), x: p.x + 3, z: p.z - 3, delay: 1.2 }]);
            }}
          >
            Portal
          </Btn>
        </Group>
      </aside>
    </main>
  );
}

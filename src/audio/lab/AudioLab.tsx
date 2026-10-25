/**
 * Audio lab (`?lab=audio`): every sound on a button, a mood switcher, Resonance / intensity
 * drivers, volume sliders, a live headless fight, offline level audits and a stats panel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../../app/settings';
import { getAudio, type SynthDirector } from '../index';
import type { AudioDebugStats, AudioMood, Volumes } from '../types';
import { Fight } from './fight';
import { FakeWorld, HERO_IDS, type HeroKey } from './labState';
import {
  auditMood,
  auditSound,
  pitchReport,
  renderFight,
  renderMood,
  renderSound,
  type FightRender,
  type LevelReport,
  type PitchReport,
} from './offline';
import { SOUNDS, fireSound } from './soundBoard';

const MOODS: AudioMood[] = [
  'silent',
  'title',
  'map',
  'calm',
  'combat',
  'boss',
  'victory',
  'defeat',
];
const GROUPS: { id: 'support' | 'phase2' | 'relic' | 'calling' | 'world' | 'ui'; title: string }[] =
  [
    { id: 'support', title: 'Support actions' },
    { id: 'phase2', title: 'Phase 2: Call and Response, Fermata, Chords' },
    { id: 'relic', title: 'Phase 3b: relics and the refused Glide' },
    { id: 'calling', title: 'Phase 3c: the Luminary (Radiance, Dawnward, Sunrise)' },
    { id: 'world', title: 'World, enemies and telegraphs' },
    { id: 'ui', title: 'UI' },
  ];

declare global {
  interface Window {
    __audioLab?: {
      director: SynthDirector;
      stats(): AudioDebugStats;
      startFight(autoSupport?: boolean): void;
      stopFight(): void;
      fightInfo(): { running: boolean; tick: number; events: number; ended: string | null };
      audit(): Promise<Record<string, LevelReport>>;
      auditMoods(): Promise<Record<string, LevelReport>>;
      renderFight(seconds?: number): Promise<FightRender>;
      pitch(): Promise<Record<string, PitchReport>>;
      world: FakeWorld;
    };
  }
}

const fmtDb = (x: number) => (Number.isFinite(x) ? `${x.toFixed(1)} dB` : '-inf');

function Slider(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange(v: number): void;
  testId?: string;
}) {
  const { label, value, min = 0, max = 1, step = 0.01, onChange, testId } = props;
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-28 text-muted">{label}</span>
      <input
        type="range"
        className="flex-1 accent-amber-400"
        min={min}
        max={max}
        step={step}
        value={value}
        data-testid={testId}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-12 text-right font-mono text-xs">
        {max > 1 ? value.toFixed(0) : value.toFixed(2)}
      </span>
    </label>
  );
}

function Btn(props: {
  children: React.ReactNode;
  onClick(): void;
  active?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={props.testId}
      onClick={props.onClick}
      className={`rounded border px-2.5 py-1 text-xs transition-colors ${
        props.active
          ? 'border-gold-400 bg-gold-500/20 text-gold-200'
          : 'border-ink-500 bg-ink-800 text-text hover:border-gold-400/70 hover:bg-ink-700'
      }`}
    >
      {props.children}
    </button>
  );
}

export function AudioLab() {
  const director = getAudio() as SynthDirector;
  const [world] = useState(() => new FakeWorld());
  const fightRef = useRef<Fight | null>(null);
  const [fighting, setFighting] = useState(false);
  const [autoSupport, setAutoSupport] = useState(true);
  const [mood, setMoodState] = useState<AudioMood>('calm');
  const [resonance, setResonance] = useState(0);
  const [enemies, setEnemies] = useState(0);
  const [tension, setTension] = useState(0);
  const [crescendo, setCrescendo] = useState(false);
  const [lowHp, setLowHp] = useState<Record<HeroKey, boolean>>({
    kael: false,
    lyra: false,
    vexis: false,
  });
  const [downed, setDowned] = useState<Record<HeroKey, boolean>>({
    kael: false,
    lyra: false,
    vexis: false,
  });
  const [planted, setPlanted] = useState(false);
  const [unison, setUnison] = useState(0);
  const [volumes, setVolumes] = useState<Volumes>(() => ({
    ...useSettings.getState().settings.volumes,
  }));
  const [stats, setStats] = useState<AudioDebugStats>(() => director.debugStats());
  const [fightInfo, setFightInfo] = useState({ tick: 0, events: 0, ended: '' });
  const [audit, setAudit] = useState<Record<string, LevelReport> | null>(null);
  const [moodAudit, setMoodAudit] = useState<Record<string, LevelReport> | null>(null);
  const [fightRender, setFightRender] = useState<FightRender | null>(null);
  const [busy, setBusy] = useState('');

  const fightingRef = useRef(false);
  const autoRef = useRef(autoSupport);
  useEffect(() => {
    autoRef.current = autoSupport;
    if (fightRef.current) fightRef.current.options.autoSupport = autoSupport;
  }, [autoSupport]);

  const setMood = useCallback(
    (m: AudioMood) => {
      setMoodState(m);
      director.setMood(m);
    },
    [director],
  );

  const stopFight = useCallback(() => {
    fightRef.current = null;
    fightingRef.current = false;
    setFighting(false);
    director.stopCombat();
  }, [director]);

  const startFight = useCallback(
    (auto?: boolean) => {
      if (auto !== undefined) {
        setAutoSupport(auto);
        autoRef.current = auto;
      }
      director.stopCombat();
      fightRef.current = new Fight({ autoSupport: auto ?? autoRef.current });
      fightingRef.current = true;
      setFighting(true);
      setMood('combat');
      void director.unlock();
    },
    [director, setMood],
  );

  // Drive the world → director every frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let statTimer = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const fight = fightRef.current;
      if (fight && fightingRef.current) {
        const events = fight.advance(dt);
        if (events.length) director.onEvents(events, fight.sim.state);
        director.update(fight.sim.state, dt);
        if (fight.ended && fightingRef.current) {
          director.setMood(fight.ended);
          setMoodState(fight.ended);
          fightingRef.current = false;
          setFighting(false);
        }
      } else {
        director.update(world.state, dt);
      }
      statTimer += dt;
      if (statTimer > 0.25) {
        statTimer = 0;
        setStats(director.debugStats());
        if (fight)
          setFightInfo({
            tick: fight.sim.tick,
            events: fight.eventCount,
            ended: fight.ended ?? '',
          });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [director, world]);

  // Sliders → fake world.
  useEffect(() => {
    world.setResonance(resonance);
    fightRef.current?.setResonance(resonance);
  }, [world, resonance]);
  useEffect(() => world.setEnemies(enemies), [world, enemies]);
  useEffect(() => world.setTension(tension), [world, tension]);
  useEffect(() => world.setChords(planted, unison), [world, planted, unison]);
  useEffect(() => world.setCrescendo(crescendo), [world, crescendo]);
  useEffect(() => {
    for (const h of HERO_IDS) world.setHeroHp(h, lowHp[h] ? 0.18 : 1);
  }, [world, lowHp]);
  useEffect(() => {
    for (const h of HERO_IDS) world.setDowned(h, downed[h]);
  }, [world, downed]);

  const applyVolumes = (v: Volumes) => {
    setVolumes(v);
    director.setVolumes(v);
  };

  // Test / debug hooks.
  useEffect(() => {
    window.__audioLab = {
      director,
      world,
      stats: () => director.debugStats(),
      startFight,
      stopFight,
      fightInfo: () => ({
        running: fightingRef.current,
        tick: fightRef.current?.sim.tick ?? 0,
        events: fightRef.current?.eventCount ?? 0,
        ended: fightRef.current?.ended ?? null,
      }),
      audit: async () => {
        const out: Record<string, LevelReport> = {};
        for (const s of SOUNDS) out[s.id] = await auditSound(s);
        return out;
      },
      auditMoods: async () => {
        const out: Record<string, LevelReport> = {};
        for (const m of ['title', 'map', 'calm', 'combat', 'boss'] as AudioMood[]) {
          out[`${m}@0`] = await auditMood(m, 0);
          out[`${m}@100`] = await auditMood(m, 100);
        }
        return out;
      },
      renderFight: (s) => renderFight(s ?? 30),
      pitch: async () => {
        const out: Record<string, PitchReport> = {};
        for (const m of ['title', 'map', 'calm', 'combat', 'boss'] as AudioMood[]) {
          out[`${m}@100`] = pitchReport(await renderMood(m, 100));
        }
        for (const s of SOUNDS) {
          if (s.group === 'ui') continue;
          out[s.id] = pitchReport(await renderSound(s), 1.5, false);
        }
        return out;
      },
    };
    return () => {
      delete window.__audioLab;
    };
  }, [director, world, startFight, stopFight]);

  const runAudit = async () => {
    setBusy('Auditing every sound offline…');
    const out: Record<string, LevelReport> = {};
    for (const s of SOUNDS) out[s.id] = await auditSound(s, volumes);
    setAudit(out);
    setBusy('');
  };
  const runMoodAudit = async () => {
    setBusy('Rendering moods offline…');
    const out: Record<string, LevelReport> = {};
    for (const m of ['title', 'map', 'calm', 'combat', 'boss'] as AudioMood[]) {
      out[`${m} · res 0`] = await auditMood(m, 0, 16, volumes);
      out[`${m} · res 100`] = await auditMood(m, 100, 16, volumes);
    }
    setMoodAudit(out);
    setBusy('');
  };
  const runFightRender = async () => {
    setBusy('Rendering a 30 s fight offline…');
    setFightRender(await renderFight(30, volumes));
    setBusy('');
  };

  const perfect = audit?.['perfect'];
  const stemRow = (['pad', 'pulse', 'melody', 'choir'] as const).map((s) => (
    <div key={s} className="flex items-center gap-2 text-xs">
      <span className="w-12 text-muted">{s}</span>
      <div className="h-2 flex-1 rounded bg-ink-700">
        <div
          className="h-2 rounded bg-heal"
          style={{ width: `${Math.round(stats.stems[s] * 100)}%` }}
        />
      </div>
    </div>
  ));

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 text-text sm:p-6" data-testid="audio-lab">
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 className="font-display text-2xl text-gold-300">Audio lab</h1>
        <p className="text-sm text-muted">
          {stats.key} · 88 BPM · chord <b className="text-text">{stats.chord}</b> · bar {stats.bar}{' '}
          · beat {stats.beat + 1} · context{' '}
          <span data-testid="ctx-state">{stats.contextState}</span>
          {stats.unlocked ? '' : ' (click anywhere to unlock audio)'}
        </p>
        <Btn onClick={() => void director.unlock()} testId="unlock">
          Unlock audio
        </Btn>
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3 rounded border border-ink-600 bg-ink-900 p-4">
          <h2 className="font-display text-gold-300">Music</h2>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <Btn key={m} active={mood === m} onClick={() => setMood(m)} testId={`mood-${m}`}>
                {m}
              </Btn>
            ))}
          </div>
          <Slider
            label="Resonance"
            value={resonance}
            max={100}
            step={1}
            onChange={setResonance}
            testId="resonance"
          />
          <Slider label="Enemies alive" value={enemies} max={20} step={1} onChange={setEnemies} />
          <Slider label="Thread tension" value={tension} onChange={setTension} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={crescendo}
                onChange={(e) => setCrescendo(e.target.checked)}
              />{' '}
              Crescendo active
            </label>
            <label className="flex items-center gap-1" title="A planted Pedal Point Chord stands">
              <input
                type="checkbox"
                checked={planted}
                data-testid="chord-planted"
                onChange={(e) => setPlanted(e.target.checked)}
              />{' '}
              Pedal drone (planted Chord)
            </label>
            <label
              className="flex items-center gap-1"
              title="The beam song rides the Thread: raise Thread tension, or move the beam, to hear it"
            >
              Beam song on the Thread{' '}
              <select
                value={unison}
                data-testid="chord-unison"
                onChange={(e) => setUnison(Number(e.target.value))}
              >
                <option value={0}>off</option>
                <option value={2}>x2 (subtle hum)</option>
                <option value={3}>x3 Unison (fuller hum)</option>
              </select>
            </label>
            {HERO_IDS.map((h) => (
              <span key={h} className="flex items-center gap-2 rounded bg-ink-800 px-2 py-1">
                <b className="text-text">{h}</b>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={lowHp[h]}
                    onChange={(e) => setLowHp((s) => ({ ...s, [h]: e.target.checked }))}
                  />
                  low HP
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={downed[h]}
                    onChange={(e) => setDowned((s) => ({ ...s, [h]: e.target.checked }))}
                  />
                  downed
                </label>
              </span>
            ))}
          </div>
          <div className="space-y-1 pt-1">{stemRow}</div>
          <p className="text-xs text-muted">
            Tier {stats.tier}/4 · intensity {stats.intensity.toFixed(2)} · mood {stats.mood}
          </p>
        </div>

        <div className="space-y-3 rounded border border-ink-600 bg-ink-900 p-4">
          <h2 className="font-display text-gold-300">Mix</h2>
          {(['master', 'music', 'sfx', 'ui'] as const).map((k) => (
            <Slider
              key={k}
              label={k}
              value={volumes[k]}
              onChange={(v) => applyVolumes({ ...volumes, [k]: v })}
              testId={`vol-${k}`}
            />
          ))}
          <h2 className="pt-2 font-display text-gold-300">Simulated fight</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Btn
              active={fighting}
              onClick={() => (fighting ? stopFight() : startFight())}
              testId="fight-toggle"
            >
              {fighting ? 'Stop fight' : 'Simulate a fight'}
            </Btn>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input
                type="checkbox"
                checked={autoSupport}
                onChange={(e) => setAutoSupport(e.target.checked)}
                data-testid="auto-support"
              />
              auto-support bot (Thread, Ward, Cue…)
            </label>
          </div>
          <p className="font-mono text-xs text-muted" data-testid="fight-info">
            tick {fightInfo.tick} · events {fightInfo.events}
            {fightInfo.ended ? ` · ${fightInfo.ended}` : ''}
          </p>
        </div>
      </section>

      {GROUPS.map((g) => (
        <section key={g.id} className="rounded border border-ink-600 bg-ink-900 p-4">
          <h2 className="mb-2 font-display text-gold-300">{g.title}</h2>
          <div className="flex flex-wrap gap-1.5">
            {SOUNDS.filter((s) => s.group === g.id).map((s) => (
              <Btn
                key={s.id}
                testId={`sound-${s.id}`}
                onClick={() => {
                  void director.unlock();
                  fireSound(s, director, world);
                }}
              >
                {s.label}
              </Btn>
            ))}
            {g.id === 'support' && (
              <Btn
                testId="sound-mend-sweep"
                onClick={() => {
                  void director.unlock();
                  [0.08, 0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.92, 1].forEach((f, i) =>
                    window.setTimeout(
                      () => SOUNDS.find((s) => s.id === 'mend-50')?.fire(director, setHp(world, f)),
                      i * 130,
                    ),
                  );
                }}
              >
                Mend sweep 8%→100%
              </Btn>
            )}
          </div>
        </section>
      ))}

      <section className="space-y-3 rounded border border-ink-600 bg-ink-900 p-4">
        <h2 className="font-display text-gold-300">
          Level audit (offline render, peaks after the limiter)
        </h2>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => void runAudit()} testId="run-audit">
            Audit every sound
          </Btn>
          <Btn onClick={() => void runMoodAudit()} testId="run-mood-audit">
            Audit moods
          </Btn>
          <Btn onClick={() => void runFightRender()} testId="run-fight-render">
            Render 30 s fight
          </Btn>
          <span className="text-xs text-muted" data-testid="busy">
            {busy}
          </span>
        </div>
        {audit && (
          <table className="w-full text-left font-mono text-xs" data-testid="audit-table">
            <thead className="text-muted">
              <tr>
                <th>sound</th>
                <th>peak</th>
                <th>rms</th>
              </tr>
            </thead>
            <tbody>
              {SOUNDS.map((s) => {
                const r = audit[s.id];
                if (!r) return null;
                const loud = perfect && r.peak > perfect.peak + 1e-6 && s.id !== 'perfect';
                return (
                  <tr key={s.id} className={loud ? 'text-lethal' : ''}>
                    <td>{s.label}</td>
                    <td>{fmtDb(r.peakDb)}</td>
                    <td>{fmtDb(r.rmsDb)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {moodAudit && (
          <table className="w-full text-left font-mono text-xs" data-testid="mood-table">
            <tbody>
              {Object.entries(moodAudit).map(([k, r]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{fmtDb(r.peakDb)}</td>
                  <td>{fmtDb(r.rmsDb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {fightRender && (
          <p className="font-mono text-xs" data-testid="fight-render">
            fight {fightRender.seconds}s · {fightRender.events} events · peak{' '}
            {fmtDb(fightRender.overall.peakDb)} · rms {fmtDb(fightRender.overall.rmsDb)} · loudest
            second rms {fmtDb(fightRender.loudestWindow.rmsDb)}
          </p>
        )}
      </section>

      <section className="rounded border border-ink-600 bg-ink-900 p-4">
        <h2 className="mb-2 font-display text-gold-300">Engine stats</h2>
        <pre className="overflow-x-auto font-mono text-xs text-muted" data-testid="audio-stats">
          {JSON.stringify(stats, null, 1)}
        </pre>
      </section>
    </main>
  );
}

function setHp(world: FakeWorld, frac: number): FakeWorld {
  world.setHeroHp('kael', frac);
  return world;
}

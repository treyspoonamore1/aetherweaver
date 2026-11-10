/**
 * Audio lab (`?lab=audio`): every sound on a button, a mood switcher, Resonance / intensity
 * drivers, volume sliders, a live headless fight, offline level audits and a stats panel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../../app/settings';
import type { Biome } from '../../content';
import type { SimEvent } from '../../sim';
import { getAudio, type SynthDirector } from '../index';
import type { AudioDebugStats, AudioMood, Volumes } from '../types';
import { Fight } from './fight';
import {
  BRANN_LAB_PARTY,
  FakeWorld,
  HERO_IDS,
  IDS,
  ORO_LAB_PARTY,
  SEREN_LAB_PARTY,
  ev,
  type HeroKey,
} from './labState';
import {
  auditMood,
  auditSound,
  pitchReport,
  renderFight,
  renderMood,
  renderSound,
  type FightRender,
  type LevelReport,
  type MoodScene,
  type PitchReport,
} from './offline';
import { SOUNDS, fireSound, type SoundButton } from './soundBoard';

const MOODS: AudioMood[] = [
  'silent',
  'title',
  'map',
  'loom',
  'calm',
  'combat',
  'boss',
  'victory',
  'defeat',
];
/**
 * Phase 5a: the biomes the music and ambience voice, and Vharun's phases (0: no boss). Phase 5c:
 * the Abyssal Rift (the Seamstress's and the Unweaver's phases). Phase 5d: the Celestial Crucible
 * (the Silent Conductor's phases, and the Grand Silence's notes).
 */
const BIOMES: { id: Biome; label: string }[] = [
  { id: 'reliquary', label: 'Sunlit Reliquary' },
  { id: 'crimson_spire', label: 'Crimson Spire' },
  { id: 'abyssal_rift', label: 'Abyssal Rift' },
  { id: 'celestial_crucible', label: 'Celestial Crucible' },
];
const WARDEN_PHASES = [0, 1, 2, 3] as const;
/** Phase 5a: the Crimson Spire's moods for the audits (a boss at each of Vharun's phases). */
const CRIMSON_AUDITS: [AudioMood, number][] = [
  ['map', 0],
  ['calm', 0],
  ['combat', 0],
  ['boss', 1],
  ['boss', 2],
  ['boss', 3],
];
/**
 * Phase 5c: the Abyssal Rift's moods for the audits: the Unweaver at each phase, with a verse
 * stolen and with Unravel up in phase 2, and the Seamstress's second phase (its pickup).
 */
const ABYSS_AUDITS: { mood: AudioMood; phase: number; scene: MoodScene; label: string }[] = [
  { mood: 'map', phase: 0, scene: {}, label: 'map' },
  { mood: 'calm', phase: 0, scene: {}, label: 'calm' },
  { mood: 'combat', phase: 0, scene: {}, label: 'combat' },
  { mood: 'boss', phase: 1, scene: {}, label: 'Unweaver p1' },
  { mood: 'boss', phase: 2, scene: {}, label: 'Unweaver p2' },
  { mood: 'boss', phase: 2, scene: { stolen: true }, label: 'Unweaver p2 · verse stolen' },
  { mood: 'boss', phase: 2, scene: { unravel: true }, label: 'Unweaver p2 · Unravel' },
  { mood: 'boss', phase: 3, scene: {}, label: 'Unweaver p3 · mirror canon' },
  { mood: 'boss', phase: 2, scene: { miniboss: true }, label: 'Seamstress p2 · pickup' },
];

/**
 * Phase 5d: the Celestial Crucible's moods for the audits: the Silent Conductor at each phase (its
 * Overture, its Mirror Choir, and the last burn after the Grand Silence).
 */
const CRUCIBLE_AUDITS: { mood: AudioMood; phase: number; label: string }[] = [
  { mood: 'map', phase: 0, label: 'map' },
  { mood: 'calm', phase: 0, label: 'calm' },
  { mood: 'combat', phase: 0, label: 'combat' },
  { mood: 'boss', phase: 1, label: 'Conductor p1 · Overture' },
  { mood: 'boss', phase: 2, label: 'Conductor p2 · Mirror Choir' },
  { mood: 'boss', phase: 3, label: 'Conductor p3 · the last burn' },
];
/** Phase 5d: what made each of the lab's Grand Silence notes, in turn. */
const LAB_NOTE_SOURCES = ['perfect', 'clutch', 'reel', 'rewind'] as const;

const GROUPS: {
  id: SoundButton['group'];
  title: string;
}[] = [
  { id: 'support', title: 'Support actions' },
  { id: 'phase2', title: 'Phase 2: Call and Response, Fermata, Chords' },
  { id: 'relic', title: 'Phase 3b: relics and the refused Glide' },
  { id: 'calling', title: 'Phase 3c: the Luminary (Radiance, Dawnward, Sunrise)' },
  { id: 'martyr', title: 'Phase 3d: the Martyr (Bear, Borne, Vow, Undying Devotion)' },
  {
    id: 'chrono',
    title: 'Phase 3e: the Chronomancer (Rewind, Stasis, Foresight, the path, its UI sounds)',
  },
  {
    id: 'astrolabe',
    title: 'Phase 4 · Astrolabe (the star map, and its keystones in the fight)',
  },
  {
    id: 'bonds',
    title: 'Phase 4e · Bonds (each talent acting, the alternate Solos starting, their bursts)',
  },
  {
    id: 'variants',
    title: 'Phase 4f · Variants (each cast, the moments after it, their bursts)',
  },
  {
    id: 'loom',
    title:
      'Phase 4g · The Loom (the Atelier, keepsakes, stations, Starlight; the Perfect-Ward trainer)',
  },
  {
    id: 'crimson',
    title:
      'Phase 5a · The Crimson Legion (its statuses, the Chime’s release, the guard, charges, the Tide, Execution, iron kills)',
  },
  {
    id: 'brann',
    title:
      'Phase 5b · Brann (his leitmotif and Call, Red Comet, his kit, his war drum and alert; he joins the lab party)',
  },
  {
    id: 'seren',
    title:
      'Phase 5e · Seren (her leitmotif and Call, Flèche, the parry and its counter, the kill shot, Lunge, Feint, Thousand Cuts, her heartbeat; she joins the lab party)',
  },
  {
    id: 'oro',
    title:
      'Phase 5e · Oro (his leitmotif and Call, Spring Rain, his Saplings sprouting, struck, felled and burrowing, Rootbond, Wildgrowth and the Ancient, roots, Gentle, his heartbeat; he joins the lab party)',
  },
  {
    id: 'conductor',
    title:
      'Phase 5f · The Conductor (Duets and Trios, the free Cue, the downbeat, the Grand Finale and its cadence, Reprise, Marcato, Ensemble, Spotlight, Triad, his Calling’s UI)',
  },
  {
    id: 'fill',
    title:
      'Phase 5g · The content fill (Razor Silk’s bite, Thread the Needle’s catch, a trigger firing: one for each kind of effect)',
  },
  {
    id: 'unstitched',
    title:
      'Phase 5c · The Unstitched (cuts, the Maw, the Wraith, the rune, the Mimic, the Seamstress, Doom, the Unweaver, cloth kills)',
  },
  {
    id: 'finale',
    title:
      'Phase 5d · The Finale (Discord, Fortissimo Silence, the Cues, the Grand Silence and its eight notes, the Reignite, the Coda, glass kills, the stinger)',
  },
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
      /** Phase 4d: the audit and the pitch report for the named buttons only. */
      auditIds(ids: string[]): Promise<Record<string, LevelReport>>;
      pitchIds(ids: string[]): Promise<Record<string, PitchReport>>;
      /** Phase 5a: the biome the music voices, and the Crimson Spire's moods' pitch reports. */
      setBiome(biome: Biome): void;
      pitchCrimson(): Promise<Record<string, PitchReport>>;
      /** Phase 5c: the Abyssal Rift's moods' pitch reports (ABYSS_AUDITS). */
      pitchAbyss(): Promise<Record<string, PitchReport>>;
      /** Phase 5d: the Celestial Crucible's moods' pitch reports (CRUCIBLE_AUDITS). */
      pitchCrucible(): Promise<Record<string, PitchReport>>;
      /** Phase 5d: the Grand Silence's notes (-1: no silence), as its events would tell them. */
      setSilenceNotes(notes: number): void;
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
  const [biome, setBiomeState] = useState<Biome>(() => director.getBiome());
  const [wardenPhase, setWardenPhase] = useState(0);
  // Phase 5c: the boss is a mini-boss (the Seamstress); the Unweaver's stolen verse and Unravel.
  const [bossMini, setBossMini] = useState(false);
  const [stolen, setStolen] = useState(false);
  const [unravel, setUnravel] = useState(false);
  // Phase 5d: the Grand Silence's notes (-1: no silence).
  const [silenceNotes, setSilenceNotes] = useState(-1);
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
  // Phase 5b: Brann in the lab party (a fourth, opt-in), his life and whether he is falling fast.
  const [brannIn, setBrannIn] = useState(false);
  const [brannLife, setBrannLife] = useState(1);
  const [brannFast, setBrannFast] = useState(false);
  // Phase 5e: Seren or Oro in the lab party (a fourth, opt-in; Brann's box comes first), and their life.
  const [newIn, setNewIn] = useState<'seren' | 'oro' | null>(null);
  const [newLife, setNewLife] = useState(1);
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

  const setBiome = useCallback(
    (b: Biome) => {
      setBiomeState(b);
      director.setBiome(b);
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
  // Phase 5a: a final boss at a phase (Vharun's stems) stands in for the enemy count.
  useEffect(() => {
    const role = bossMini ? 'miniboss' : 'boss';
    if (wardenPhase > 0) world.setEnemies(1, role, role, wardenPhase);
    else world.setEnemies(enemies);
  }, [world, enemies, wardenPhase, bossMini]);
  // Phase 5c: a verse stolen, and Unravel, as the sim's events would tell them (on a change only,
  // so opening the lab plays neither the verse's return nor Unravel closing).
  const m3Was = useRef({ stolen: false, unravel: false });
  useEffect(() => {
    if (m3Was.current.stolen === stolen) return;
    m3Was.current.stolen = stolen;
    director.onEvents(
      [
        stolen
          ? ev('verseStolen', { aura: 'lab', add: IDS.enemyBase + 1, until: world.time + 1e6 })
          : ev('verseReturned', { aura: 'lab', reason: 'killed' }),
      ],
      world.state,
    );
  }, [director, world, stolen]);
  useEffect(() => {
    if (m3Was.current.unravel === unravel) return;
    m3Was.current.unravel = unravel;
    director.onEvents(
      [ev('unravelled', { active: unravel, until: world.time + (unravel ? 1e6 : 0) })],
      world.state,
    );
  }, [director, world, unravel]);
  // Phase 5d: the Grand Silence, as the sim's events would tell it: it begins (again, when the
  // notes go back down), each new note sounds, and taking it off is the Coda.
  const silenceWas = useRef(-1);
  useEffect(() => {
    const was = silenceWas.current;
    if (was === silenceNotes) return;
    silenceWas.current = silenceNotes;
    const boss = IDS.enemyBase;
    const events: SimEvent[] = [];
    if (silenceNotes < 0) {
      events.push(ev('silenceBroken', { boss, notes: Math.max(0, was) }));
    } else {
      let from = was;
      if (was < 0 || silenceNotes < was) {
        events.push(ev('silenceBegan', { boss, until: world.time + 1e6 }));
        from = 0;
      }
      for (let n = from + 1; n <= silenceNotes; n++) {
        const source = LAB_NOTE_SOURCES[(n - 1) % LAB_NOTE_SOURCES.length] ?? 'perfect';
        events.push(
          ev('silenceNote', { n, of: 8, source, hero: source === 'rewind' ? null : IDS.kael }),
        );
      }
    }
    director.onEvents(events, world.state);
  }, [director, world, silenceNotes]);
  useEffect(() => world.setTension(tension), [world, tension]);
  useEffect(() => world.setChords(planted, unison), [world, planted, unison]);
  useEffect(() => world.setCrescendo(crescendo), [world, crescendo]);
  useEffect(() => {
    for (const h of HERO_IDS) world.setHeroHp(h, lowHp[h] ? 0.18 : 1);
  }, [world, lowHp]);
  useEffect(() => {
    for (const h of HERO_IDS) world.setDowned(h, downed[h]);
  }, [world, downed]);
  useEffect(() => {
    world.setParty(
      brannIn
        ? BRANN_LAB_PARTY
        : newIn === 'seren'
          ? SEREN_LAB_PARTY
          : newIn === 'oro'
            ? ORO_LAB_PARTY
            : HERO_IDS,
    );
    if (!brannIn && newIn) world.setHeroHp(newIn, newLife);
    if (!brannIn) return;
    world.setHeroHp('brann', brannLife);
    world.setBleedRate(brannFast ? 2000 : 0);
  }, [world, brannIn, brannLife, brannFast, newIn, newLife]);

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
        for (const m of ['title', 'map', 'loom', 'calm', 'combat', 'boss'] as AudioMood[]) {
          out[`${m}@0`] = await auditMood(m, 0);
          out[`${m}@100`] = await auditMood(m, 100);
        }
        return out;
      },
      renderFight: (s) => renderFight(s ?? 30),
      pitch: async () => {
        const out: Record<string, PitchReport> = {};
        for (const m of ['title', 'map', 'loom', 'calm', 'combat', 'boss'] as AudioMood[]) {
          out[`${m}@100`] = pitchReport(await renderMood(m, 100));
        }
        for (const s of SOUNDS) {
          if (s.group === 'ui') continue;
          out[s.id] = pitchReport(await renderSound(s), 1.5, false);
        }
        return out;
      },
      auditIds: async (ids) => {
        const out: Record<string, LevelReport> = {};
        for (const s of SOUNDS) if (ids.includes(s.id)) out[s.id] = await auditSound(s);
        return out;
      },
      pitchIds: async (ids) => {
        const out: Record<string, PitchReport> = {};
        for (const s of SOUNDS)
          if (ids.includes(s.id)) out[s.id] = pitchReport(await renderSound(s), 1.5, false);
        return out;
      },
      setBiome,
      pitchCrimson: async () => {
        const out: Record<string, PitchReport> = {};
        for (const [m, p] of CRIMSON_AUDITS)
          out[`crimson:${m}@100/${p}`] = pitchReport(
            await renderMood(m, 100, 16, undefined, 'crimson_spire', m === 'boss' ? p : 0),
          );
        return out;
      },
      pitchAbyss: async () => {
        const out: Record<string, PitchReport> = {};
        for (const a of ABYSS_AUDITS)
          out[`abyss:${a.label}`] = pitchReport(
            await renderMood(a.mood, 100, 16, undefined, 'abyssal_rift', a.phase, a.scene),
          );
        return out;
      },
      pitchCrucible: async () => {
        const out: Record<string, PitchReport> = {};
        for (const a of CRUCIBLE_AUDITS)
          out[`crucible:${a.label}`] = pitchReport(
            await renderMood(a.mood, 100, 16, undefined, 'celestial_crucible', a.phase),
          );
        return out;
      },
      setSilenceNotes,
    };
    return () => {
      delete window.__audioLab;
    };
  }, [director, world, startFight, stopFight, setBiome]);

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
    for (const m of ['title', 'map', 'loom', 'calm', 'combat', 'boss'] as AudioMood[]) {
      out[`${m} · res 0`] = await auditMood(m, 0, 16, volumes);
      out[`${m} · res 100`] = await auditMood(m, 100, 16, volumes);
    }
    // Phase 5a: the Crimson Spire's moods, the boss at each of Vharun's phases.
    for (const [m, p] of CRIMSON_AUDITS)
      out[`crimson ${m}${m === 'boss' ? ` p${p}` : ''} · res 100`] = await auditMood(
        m,
        100,
        16,
        volumes,
        'crimson_spire',
        m === 'boss' ? p : 0,
      );
    // Phase 5c: the Abyssal Rift's moods, the Unweaver's phases and the Seamstress's pickup.
    for (const a of ABYSS_AUDITS)
      out[`abyss ${a.label} · res 100`] = await auditMood(
        a.mood,
        100,
        16,
        volumes,
        'abyssal_rift',
        a.phase,
        a.scene,
      );
    // Phase 5d: the Celestial Crucible's moods, the Silent Conductor's phases.
    for (const a of CRUCIBLE_AUDITS)
      out[`crucible ${a.label} · res 100`] = await auditMood(
        a.mood,
        100,
        16,
        volumes,
        'celestial_crucible',
        a.phase,
      );
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="w-28">Biome</span>
            {BIOMES.map((b) => (
              <Btn
                key={b.id}
                active={biome === b.id}
                onClick={() => setBiome(b.id)}
                testId={`biome-${b.id}`}
              >
                {b.label}
              </Btn>
            ))}
            <label
              className="flex items-center gap-1"
              title="A boss at this phase (Vharun's in the Spire, the Unweaver's in the Rift)"
            >
              Boss phase{' '}
              <select
                value={wardenPhase}
                data-testid="warden-phase"
                onChange={(e) => setWardenPhase(Number(e.target.value))}
              >
                {WARDEN_PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p === 0 ? 'none' : p === 2 ? '2 (Bloodmoon)' : p === 3 ? '3 (judgement)' : p}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="flex items-center gap-1"
              title="The boss is a mini-boss (the Seamstress)"
            >
              <input
                type="checkbox"
                checked={bossMini}
                data-testid="boss-mini"
                onChange={(e) => setBossMini(e.target.checked)}
              />{' '}
              mini-boss
            </label>
            <label
              className="flex items-center gap-1"
              title="The Unweaver holds a stolen verse (the Rift's choir drops)"
            >
              <input
                type="checkbox"
                checked={stolen}
                data-testid="verse-stolen"
                onChange={(e) => setStolen(e.target.checked)}
              />{' '}
              verse stolen
            </label>
            <label
              className="flex items-center gap-1"
              title="Unravel is up (the Rift's melody mirrors about D)"
            >
              <input
                type="checkbox"
                checked={unravel}
                data-testid="unravel"
                onChange={(e) => setUnravel(e.target.checked)}
              />{' '}
              Unravel
            </label>
          </div>
          <Slider
            label="Silence notes (-1 off)"
            value={silenceNotes}
            min={-1}
            max={8}
            step={1}
            onChange={setSilenceNotes}
            testId="silence-notes"
          />
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <label
              className="flex items-center gap-1"
              title="Brann joins the lab party as a fourth hero (his buttons bring him in too)"
            >
              <input
                type="checkbox"
                checked={brannIn}
                data-testid="brann-in"
                onChange={(e) => setBrannIn(e.target.checked)}
              />{' '}
              Brann in the party
            </label>
            <label className="flex items-center gap-1" title="His war drum quickens under 40%">
              <input
                type="checkbox"
                checked={brannFast}
                disabled={!brannIn}
                data-testid="brann-fast"
                onChange={(e) => setBrannFast(e.target.checked)}
              />{' '}
              falling fast (the alert)
            </label>
            {(['seren', 'oro'] as const).map((h) => (
              <label
                key={h}
                className="flex items-center gap-1"
                title={`${h === 'seren' ? 'Seren' : 'Oro (and his Saplings)'} joins the lab party as a fourth hero (Brann's box comes first)`}
              >
                <input
                  type="checkbox"
                  checked={newIn === h}
                  data-testid={`${h}-in`}
                  onChange={(e) => setNewIn(e.target.checked ? h : null)}
                />{' '}
                {h === 'seren' ? 'Seren' : 'Oro'} in the party
              </label>
            ))}
          </div>
          {newIn && !brannIn && (
            <Slider
              label={`${newIn === 'seren' ? 'Seren' : 'Oro'} low (the heartbeat)`}
              value={newLife}
              onChange={setNewLife}
              testId={`${newIn}-life`}
            />
          )}
          {brannIn && (
            <Slider
              label="Brann low (Blood Rage)"
              value={brannLife}
              onChange={setBrannLife}
              testId="brann-life"
            />
          )}
          <div className="space-y-1 pt-1">{stemRow}</div>
          <p className="text-xs text-muted">
            Tier {stats.tier}/4 · intensity {stats.intensity.toFixed(2)} · mood {stats.mood} · biome{' '}
            {biome}
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

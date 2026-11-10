/**
 * Phase 7's contracts (docs/phase-7.md, "Contracts (W0)"): the settings keys, the pad types, the
 * text layer, the runtime's call sites, the saves slot and the run's `assisted` key, each present
 * and each inert. Nothing here may change what the game does, shows or sounds like: every new
 * key's default is today's behaviour, v4 settings without the keys parse and save back as they
 * were, `format.ts` prints what it printed, `captionFor` and `gameSpeed` change nothing, an old run
 * save loads exactly, and the sim's and content's versions stand.
 *
 * A few assertions pin a body that a later stream fills (each says which); that stream replaces
 * the line when it writes the body.
 */
import { readFileSync } from 'node:fs';
import type { FunctionComponent } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { gameSpeed } from '../src/app/gameSpeed';
import {
  DEFAULT_AIDS,
  DEFAULT_INPUT,
  DEFAULT_OPTIONS,
  DEFAULT_SETTINGS,
  DEFAULT_TELEGRAPHS,
  GAME_SPEEDS,
  QUALITY_SETTINGS,
  REDUCED_MOTION,
  SettingsSchema,
  ambienceVolume,
  barksVolume,
  migrateSettings,
  optionsOf,
  type Settings,
} from '../src/app/settings';
import { CONTENT_VERSION } from '../src/content';
import {
  DEFAULT_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  PAD_ACTIONS,
  PAD_BUTTONS,
  type PadBindable,
} from '../src/input/actions';
import { PROFILE_VERSION } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import { FIGHT_END_DELAY_MS, WITHOUT_YOU_GRACE_MS } from '../src/meta/runEnd';
import { ASSIST_VALUES } from '../src/meta/runReplay';
import { loadRun, RunStateSchema, saveRun, type KeyValueStore } from '../src/meta/save';
import { RUN_SAVE_VERSION, type RunState } from '../src/meta/types';
import { createSim } from '../src/sim/api';
import { SIM_VERSION } from '../src/sim/constants';
import { captionFor } from '../src/ui/hud/captions';
import { captionCallout, finaleCaption } from '../src/ui/hud/finaleLook';
import { clock, fmt, pct, plural, possessive } from '../src/ui/kit/format';
import {
  EN,
  EN_AREAS,
  LOCALES,
  clockText,
  currentLocale,
  interpolate,
  localize,
  num,
  percent,
  plural as pluralText,
  possessive as possessiveText,
  pseudo,
  seconds,
  setLocale,
  tc,
  t,
  type TextKey,
} from '../src/ui/text';
import golden from './sim/golden.json';
import { SCENARIO_CONDUCTOR } from '../tools/scenarios';

/** Today's DEFAULT_SETTINGS, written out (the Phase 7 keys are absent from it). */
const TODAY: Settings = {
  version: 4,
  volumes: { master: 0.8, music: 0.6, sfx: 0.9, ui: 0.7 },
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  hints: true,
  uiScale: 1,
  colorVision: 'normal',
  bindings: {},
  assists: { perfectWindowBonus: 0, telegraphLead: 1, autonomy: false },
  unlockAll: false,
  hud: {
    frames: { at: null, scale: 1, orientation: 'vertical' },
    weaverBar: { at: null, scale: 1 },
    allyBars: 'always',
    healthText: 'missing',
    lowHealthSound: true,
  },
  captions: false,
};

const PHASE7_KEYS = [
  'reducedMotion',
  'telegraphs',
  'answerGlyphs',
  'importantNumbersOnly',
  'slowmoVignette',
  'heroVoices',
  'input',
  'aids',
  'quality',
  'locale',
] as const;

/** A player's v4 settings as a build before Phase 7 saved them (nothing at its default). */
const SAVED_V4 = {
  version: 4,
  volumes: { master: 0.5, music: 0.25, sfx: 0.75, ui: 1 },
  screenShake: 0.4,
  flashes: 0,
  damageNumbers: false,
  hints: false,
  uiScale: 1.25,
  colorVision: 'deuteranopia',
  bindings: { ward: ['KeyJ'], directiveScatter: ['KeyY'] },
  assists: { perfectWindowBonus: 0.2, telegraphLead: 1.5, autonomy: true },
  unlockAll: true,
  hud: {
    frames: { at: { x: 0.1, y: 0.9, corner: 'bl' }, scale: 1.2, orientation: 'horizontal' },
    weaverBar: { at: null, scale: 0.9 },
    allyBars: 'hurt',
    healthText: 'percent',
    lowHealthSound: false,
  },
  captions: true,
};

describe('Phase 7 settings contracts', () => {
  it('the version stays 4, and DEFAULT_SETTINGS is today’s, with no Phase 7 key', () => {
    expect(DEFAULT_SETTINGS.version).toBe(4);
    expect(DEFAULT_SETTINGS).toStrictEqual(TODAY);
    for (const key of PHASE7_KEYS) expect(key in DEFAULT_SETTINGS, key).toBe(false);
    expect('ambience' in DEFAULT_SETTINGS.volumes || 'barks' in DEFAULT_SETTINGS.volumes).toBe(
      false,
    );
  });

  it('every new option’s default is today’s behaviour', () => {
    expect(DEFAULT_OPTIONS).toStrictEqual({
      reducedMotion: 'system',
      telegraphs: { opacity: 1, outline: 1, perfectBand: 1, highContrast: false },
      answerGlyphs: true,
      importantNumbersOnly: false,
      slowmoVignette: true,
      heroVoices: false,
      input: {
        threadMode: 'toggle',
        wheel: 'hold',
        mouseoverCast: true,
        mouse: { thread: 'Mouse0', mode: 'Mouse2', wheel: 'Mouse1' },
        cueModifier: 'Shift',
        padBindings: {},
      },
      aids: { gameSpeed: 1, autoThread: false },
      quality: 'high',
      locale: 'en',
    });
    expect(Object.keys(DEFAULT_OPTIONS).sort()).toEqual([...PHASE7_KEYS].sort());
    expect(DEFAULT_OPTIONS.telegraphs).toBe(DEFAULT_TELEGRAPHS);
    expect(DEFAULT_OPTIONS.input).toBe(DEFAULT_INPUT);
    expect(DEFAULT_OPTIONS.aids).toBe(DEFAULT_AIDS);
    expect(REDUCED_MOTION).toEqual(['system', 'on', 'off']);
    expect(GAME_SPEEDS).toEqual([0.7, 0.8, 0.9, 1]);
    expect(QUALITY_SETTINGS).toEqual(['auto', 'low', 'medium', 'high']);
    expect(LOCALES).toEqual(['en', 'en-XA']);
    // Absent, the ambience bus follows Effects (engine.ts today) and the barks bus is at 1.
    expect(ambienceVolume(DEFAULT_SETTINGS.volumes)).toBe(DEFAULT_SETTINGS.volumes.sfx);
    expect(barksVolume(DEFAULT_SETTINGS.volumes)).toBe(1);
  });

  it('optionsOf fills every absent key and field, once per settings object', () => {
    const o = optionsOf(DEFAULT_SETTINGS);
    expect(o).toStrictEqual(DEFAULT_OPTIONS);
    expect(optionsOf(DEFAULT_SETTINGS)).toBe(o);
    const some: Settings = {
      ...DEFAULT_SETTINGS,
      telegraphs: { outline: 2 },
      input: { mouse: { mode: 'KeyM' }, threadMode: 'hold' },
      aids: { gameSpeed: 0.8 },
      volumes: { ...DEFAULT_SETTINGS.volumes, ambience: 0.3 },
    };
    const s = optionsOf(some);
    expect(s.telegraphs).toStrictEqual({ ...DEFAULT_TELEGRAPHS, outline: 2 });
    expect(s.input.mouse).toStrictEqual({ thread: 'Mouse0', mode: 'KeyM', wheel: 'Mouse1' });
    expect(s.input.threadMode).toBe('hold');
    expect(s.input.wheel).toBe('hold');
    expect(s.aids).toStrictEqual({ gameSpeed: 0.8, autoThread: false });
    expect(s.quality).toBe('high');
    expect(ambienceVolume(some.volumes)).toBe(0.3);
  });

  it('v4 settings without the new keys parse to exactly what they were, and save back equal', () => {
    for (const saved of [SAVED_V4, TODAY]) {
      const parsed = SettingsSchema.parse(JSON.parse(JSON.stringify(saved)));
      expect(parsed).toStrictEqual(saved);
      expect(JSON.stringify(parsed)).toBe(JSON.stringify(saved));
      expect(migrateSettings(JSON.parse(JSON.stringify(saved)))).toStrictEqual(saved);
      for (const key of PHASE7_KEYS) expect(key in parsed, key).toBe(false);
      expect(optionsOf(parsed)).toStrictEqual(DEFAULT_OPTIONS);
    }
    // Saved before captions (v4's first shape): as before, the default is filled in.
    const { captions: _c, ...early } = SAVED_V4;
    expect(SettingsSchema.parse(early)).toStrictEqual({ ...early, captions: false });
  });

  it('the new keys survive a save once written, and only values in range parse', () => {
    const written = {
      ...SAVED_V4,
      volumes: { ...SAVED_V4.volumes, ambience: 0.4, barks: 0 },
      reducedMotion: 'on',
      telegraphs: { opacity: 0.6, outline: 2, perfectBand: 1.5, highContrast: true },
      answerGlyphs: false,
      importantNumbersOnly: true,
      slowmoVignette: false,
      heroVoices: true,
      input: {
        threadMode: 'hold',
        wheel: 'toggle',
        mouseoverCast: false,
        mouse: { thread: 'Mouse2', mode: 'Mouse0', wheel: 'KeyF' },
        cueModifier: 'Control',
        padBindings: { ward: ['faceDown', 'faceUp'], reticleNext: ['bumperRight'] },
      },
      aids: { gameSpeed: 0.7, autoThread: true },
      quality: 'auto',
      locale: 'en-XA',
    };
    expect(SettingsSchema.parse(JSON.parse(JSON.stringify(written)))).toStrictEqual(written);
    const bad = (patch: Record<string, unknown>) =>
      SettingsSchema.safeParse({ ...SAVED_V4, ...patch }).success;
    expect(bad({ telegraphs: { opacity: 0.5 } })).toBe(false);
    expect(bad({ telegraphs: { outline: 2.5 } })).toBe(false);
    expect(bad({ telegraphs: { perfectBand: 0.9 } })).toBe(false);
    expect(bad({ aids: { gameSpeed: 0.75 } })).toBe(false);
    expect(bad({ aids: { gameSpeed: 1.2 } })).toBe(false);
    expect(bad({ reducedMotion: 'maybe' })).toBe(false);
    expect(bad({ quality: 'ultra' })).toBe(false);
    expect(bad({ locale: 'fr' })).toBe(false);
    expect(bad({ input: { padBindings: { ward: ['triangle'] } } })).toBe(false);
    expect(bad({ volumes: { ...SAVED_V4.volumes, barks: 1.5 } })).toBe(false);
    expect(bad({ telegraphs: { opacity: 0.8 } })).toBe(true);
  });

  it('the new aids live outside the assists: a fight’s assists are still exactly three keys', () => {
    expect(Object.keys(DEFAULT_SETTINGS.assists).sort()).toEqual([
      'autonomy',
      'perfectWindowBonus',
      'telegraphLead',
    ]);
    expect(SettingsSchema.shape.assists.safeParse({ ...TODAY.assists, gameSpeed: 1 }).data).toEqual(
      TODAY.assists,
    );
  });

  it('the assists offer exactly the run verifier’s values (ASSIST_VALUES)', () => {
    const offers = (key: 'perfectWindowBonus' | 'telegraphLead', v: number) =>
      SettingsSchema.shape.assists.safeParse({ ...TODAY.assists, [key]: v }).success;
    for (const key of ['perfectWindowBonus', 'telegraphLead'] as const) {
      for (const v of ASSIST_VALUES[key]) expect(offers(key, v), `${key} ${v}`).toBe(true);
      for (const v of [-1, 0.05, 0.3, 1.1, 2]) expect(offers(key, v), `${key} ${v}`).toBe(false);
    }
    expect(ASSIST_VALUES).toEqual({
      perfectWindowBonus: [0, 0.1, 0.2],
      telegraphLead: [1, 1.25, 1.5],
    });
  });
});

describe('Phase 7 input contracts', () => {
  it('the keyboard’s actions are today’s; the pad-only actions are apart from them', () => {
    expect(Object.keys(DEFAULT_BINDINGS)).toHaveLength(25);
    for (const a of PAD_ACTIONS) expect(a in DEFAULT_BINDINGS, a).toBe(false);
    expect(PAD_ACTIONS).toEqual(['reticleNext', 'reticlePrev', 'threadReticle', 'cueReticle']);
  });

  it('the default pad layout uses standard buttons, each once, on known actions', () => {
    expect(PAD_BUTTONS).toHaveLength(17);
    const seen = new Set<string>();
    const known = new Set<string>([...Object.keys(DEFAULT_BINDINGS), ...PAD_ACTIONS]);
    for (const [action, buttons] of Object.entries(DEFAULT_PAD_BINDINGS)) {
      expect(known.has(action), action).toBe(true);
      for (const b of buttons!) {
        expect(PAD_BUTTONS, b).toContain(b);
        expect(seen.has(b), b).toBe(false);
        seen.add(b);
      }
    }
    const pause: PadBindable = 'pause';
    expect(DEFAULT_PAD_BINDINGS[pause]).toEqual(['start']);
  });
});

const FMT: [number, string][] = [
  [0, '0'],
  [-0, '-0'],
  [1, '1'],
  [-1, '-1'],
  [0.4, '0'],
  [0.5, '1'],
  [1.5, '2'],
  [2.5, '3'],
  [-2.5, '-2'],
  [999, '999'],
  [999.5, '1,000'],
  [1000, '1,000'],
  [12345.678, '12,346'],
  [-12345.678, '-12,346'],
  [1e6, '1,000,000'],
  [1234567.89, '1,234,568'],
  [1e21, '1,000,000,000,000,000,000,000'],
  [NaN, 'NaN'],
  [Infinity, '\u221e'],
  [-Infinity, '-\u221e'],
];
const PCT: [number, number | undefined, string][] = [
  [0, undefined, '0%'],
  [1, undefined, '100%'],
  [0.5, undefined, '50%'],
  [0.123, undefined, '12%'],
  [0.1234, 1, '12.3%'],
  [0.1235, 2, '12.35%'],
  [1.5, undefined, '150%'],
  [-0.25, undefined, '-25%'],
  [0.005, undefined, '1%'],
  [0.015, undefined, '2%'],
  [12.345, 1, '1234.5%'],
  [NaN, undefined, 'NaN%'],
  [0.999, undefined, '100%'],
];
const CLOCK: [number, string][] = [
  [0, '0:00'],
  [-5, '0:00'],
  [0.9, '0:00'],
  [59.9, '0:59'],
  [60, '1:00'],
  [83.4, '1:23'],
  [599, '9:59'],
  [3599.99, '59:59'],
  [3600, '60:00'],
  [7322.5, '122:02'],
  [NaN, 'NaN:NaN'],
];
const PLURAL: [number, string, string | undefined, string][] = [
  [0, 'hero', undefined, 'heros'],
  [1, 'hero', undefined, 'hero'],
  [2, 'hero', undefined, 'heros'],
  [-1, 'hero', undefined, 'heros'],
  [1.5, 'run', undefined, 'runs'],
  [1, 'mouse', 'mice', 'mouse'],
  [3, 'mouse', 'mice', 'mice'],
  [NaN, 'note', undefined, 'notes'],
  [0.999, 'beat', undefined, 'beats'],
];
const POSSESSIVE: [string, string][] = [
  ['Kael', 'Kael’s'],
  ['Vexis', 'Vexis’'],
  ['Lyra', 'Lyra’s'],
  ['Brann', 'Brann’s'],
  ['Oro', 'Oro’s'],
  ['Seren', 'Seren’s'],
  ['Iris', 'Iris’'],
  ['', '’s'],
];

describe('the text layer', () => {
  it('format.ts prints exactly what it printed before Phase 7', () => {
    for (const [n, out] of FMT) expect(fmt(n), String(n)).toBe(out);
    for (const [n, d, out] of PCT)
      expect(d === undefined ? pct(n) : pct(n, d), String(n)).toBe(out);
    for (const [n, out] of CLOCK) expect(clock(n), String(n)).toBe(out);
    for (const [n, one, many, out] of PLURAL)
      expect(many === undefined ? plural(n, one) : plural(n, one, many), String(n)).toBe(out);
    for (const [name, out] of POSSESSIVE) expect(possessive(name)).toBe(out);
  });

  it('the formatters print the same English in both locales, and the locale is English', () => {
    expect(currentLocale()).toBe('en');
    for (const locale of LOCALES) {
      for (const [n, out] of FMT) expect(num(n, locale)).toBe(out);
      for (const [n, d, out] of PCT) expect(percent(n, d, locale)).toBe(out);
      for (const [n, out] of CLOCK) expect(clockText(n, locale)).toBe(out);
      for (const [n, one, many, out] of PLURAL) expect(pluralText(n, one, many, locale)).toBe(out);
      for (const [name, out] of POSSESSIVE) expect(possessiveText(name, locale)).toBe(out);
    }
    expect(seconds(2.5)).toBe('2.5 s');
    expect(seconds(1.25, 2)).toBe('1.25 s');
    expect(seconds(3, 0)).toBe('3 s');
  });

  it('the pseudo-locale transforms (accents, brackets, 30% padding) and English does not', () => {
    expect(pseudo('Settings')).toBe('[Šéţţíñĝš~~~]');
    const long = 'Pause anywhere, and the fight waits for you';
    const p = pseudo(long);
    expect(p.startsWith('[') && p.endsWith(']')).toBe(true);
    expect([...p].length).toBeGreaterThanOrEqual(Math.ceil(long.length * 1.3) + 2);
    expect(p).not.toContain('a');
    // Placeholders stay as they are, so a message still takes its parameters.
    expect(pseudo('Note {n} of {of}')).toBe('[Ñóţé {n} óƒ {of}~~~~~]');
    expect(interpolate(localize('Note {n} of {of}', 'en-XA'), { n: 3, of: 8 })).toBe(
      '[Ñóţé 3 óƒ 8~~~~~]',
    );
    expect(localize('Note {n} of {of}', 'en')).toBe('Note {n} of {of}');
    expect(interpolate('Note {n} of {of}', { n: 3 })).toBe('Note 3 of {of}');
    // An unknown key prints itself (the catalogue is empty at W0).
    expect(t('screens.none' as TextKey)).toBe('screens.none');
    expect(t('screens.none' as TextKey, undefined, 'en-XA')).toBe(pseudo('screens.none'));
  });

  it('tc looks content text up by id: English from CONTENT, unchanged', () => {
    expect(tc('auras', 'sostenuto', 'name')).toBe('Sostenuto');
    expect(tc('auras', 'fermata', 'description')).toBe(
      'Heroes in your field below 35% life take 30% less damage. Once per fight, a hit that would down a hero holds them at 1 life for 1.5 seconds instead — heal them in time and they live.',
    );
    expect(tc('ornaments', 'unison', 'subtitle')).toBe('All in');
    expect(tc('heroes', 'kael', 'name')).toBe('Kael');
    expect(tc('auras', 'nowhere', 'name')).toBe('');
    expect(tc('auras', 'sostenuto', 'name', 'en-XA')).toBe(pseudo('Sostenuto'));
    // Switching the locale reaches t and tc, and switching back restores English.
    setLocale('en-XA');
    try {
      expect(tc('ornaments', 'reverb', 'name')).toBe(pseudo('Reverb'));
    } finally {
      setLocale('en');
    }
    expect(tc('ornaments', 'reverb', 'name')).toBe('Reverb');
  });

  it('the catalogue: one file an area, each key under its area’s prefix (all empty at W0)', () => {
    expect(Object.keys(EN_AREAS)).toEqual([
      'input',
      'a11y',
      'saves',
      'release',
      'hud',
      'screens',
      'common',
    ]);
    let total = 0;
    for (const [area, catalogue] of Object.entries(EN_AREAS)) {
      for (const key of Object.keys(catalogue)) expect(key.startsWith(`${area}.`), key).toBe(true);
      total += Object.keys(catalogue).length;
    }
    expect(Object.keys(EN)).toHaveLength(total);
  });
});

describe('Phase 7 runtime call sites', () => {
  it('gameSpeed() is 1 (W2 writes the body; with default settings it stays 1)', () => {
    expect(gameSpeed()).toBe(1);
    for (const elapsed of [0, 16.6667, 250, 1 / 3, 1e-9])
      expect(elapsed * 1 * gameSpeed()).toBe(elapsed);
  });

  it('the fight-end constants are runEnd’s, read by the runtime, with no copy left', () => {
    expect(FIGHT_END_DELAY_MS).toBe(2600);
    expect(WITHOUT_YOU_GRACE_MS).toBe(4000);
    const src = readFileSync(new URL('../src/app/runtime.ts', import.meta.url), 'utf8');
    expect(src).toContain(
      "import { FIGHT_END_DELAY_MS, WITHOUT_YOU_GRACE_MS } from '../meta/runEnd';",
    );
    expect(src).not.toMatch(/const (END_DELAY_MS|WITHOUT_YOU_GRACE_MS|FIGHT_END_DELAY_MS) =/);
    expect(src).toContain('elapsed * this.devTimeScale * gameSpeed()');
    expect(src).toContain('captionFor(event, state)');
    expect(src).not.toContain('finaleCaption(');
  });

  it('captionFor gives the Finale’s captions as before, and nothing else; the fight is its golden', () => {
    const s = SCENARIO_CONDUCTOR;
    const sim = createSim({ seed: s.seed, debug: true, ...s.config });
    const drive = s.driver();
    const captions: string[] = [];
    for (let tick = 0; tick < s.ticks; tick++) {
      sim.step(drive(tick, sim.state));
      for (const e of sim.drainEvents()) {
        const before = finaleCaption(e);
        const now = captionFor(e, sim.state);
        // W2 (addendum B): a Finale sound keeps its caption exactly (text, colour, kind,
        // lifetime), now in one of the two caption turns; every other caption is W2's own.
        if (before) {
          const { key, ...rest } = now!.callout;
          expect({ callout: rest, ttl: now!.ttl }).toStrictEqual(captionCallout(before));
          expect(key).toMatch(/^caption:[ab]$/);
        } else if (now) expect(now.callout.key).toMatch(/^caption:[ab]$/);
        if (now) captions.push(now.callout.text);
      }
    }
    expect(captions.length).toBeGreaterThan(0);
    expect(captions).toContain('[The music stops]');
    expect(sim.hash()).toBe((golden.scenarios as Record<string, string>)[s.name]);
  }, 120_000);
});

describe('Phase 7 save and version contracts', () => {
  function memoryStore(): KeyValueStore {
    const data = new Map<string, string>();
    return {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  }

  /** A run one fight in, saved as JSON with no Phase 7 key. */
  function aRun(): RunState {
    let run = Run.embark(Run.newRun(41));
    run = Run.chooseNode(run, Run.reachable(run)[0]!.id);
    return run;
  }

  it('no version moves: sim 22, content as the goldens, run save 5, profile 10, settings 4', () => {
    expect(SIM_VERSION).toBe(22);
    expect(CONTENT_VERSION).toBe(golden.contentVersion);
    expect(RUN_SAVE_VERSION).toBe(5);
    expect(PROFILE_VERSION).toBe(10);
    expect(DEFAULT_SETTINGS.version).toBe(4);
  });

  it('an old run save (no assisted) loads to exactly what it was, and saves back the same', () => {
    const run = aRun();
    expect('assisted' in run).toBe(false);
    const json = JSON.stringify(run);
    const store = memoryStore();
    store.setItem('aetherweaver.run', json);
    const loaded = loadRun(store)!;
    expect(loaded).toStrictEqual(run);
    expect('assisted' in loaded).toBe(false);
    saveRun(store, loaded);
    // The schema's key order, as before Phase 7; no `assisted` key written.
    const saved = store.getItem('aetherweaver.run')!;
    expect(JSON.parse(saved)).toStrictEqual(JSON.parse(json));
    expect(saved).not.toContain('"assisted"');
  });

  it('the run save keeps assisted once true; anything else reads as absent', () => {
    const store = memoryStore();
    saveRun(store, { ...aRun(), assisted: true });
    expect(loadRun(store)!.assisted).toBe(true);
    for (const bad of [false, 'yes', 1, null]) {
      const parsed = RunStateSchema.parse({ ...aRun(), assisted: bad });
      expect(parsed.assisted, String(bad)).toBeUndefined();
      store.setItem('aetherweaver.run', JSON.stringify({ ...aRun(), assisted: bad }));
      expect('assisted' in loadRun(store)!, String(bad)).toBe(false);
    }
  });

  it('the saves slot renders nothing (W5 replaces this line when it fills SavesPanel)', async () => {
    const path = '../src/ui/screens/SavesPanel';
    const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent>;
    expect(renderToStaticMarkup(createElement(mod['SavesPanel']!))).toBe('');
  });
});

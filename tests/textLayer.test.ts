/**
 * The text layer, W3a (docs/phase-7.md, *W3a* and *Tests*, "W3"): the strings ratchet, the English
 * catalogue and its pseudo-locale, the formatters in English, and the locale's wiring to settings
 * and the address.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, useSettings } from '../src/app/settings';
import {
  EN,
  EN_AREAS,
  clockText,
  currentLocale,
  interpolate,
  num,
  percent,
  plural,
  pseudo,
  setLocale,
  t,
  type TextKey,
} from '../src/ui/text';
import { installLocale, localeFromSearch, localeFromSettings } from '../src/ui/text/install';
import { simText, simTextSource } from '../src/ui/text/simText';
import { CONTENT } from '../src/content';
import { CONDUCTOR_DECREES, POSTLUDE_DECREE } from '../src/content/crucible';
import {
  ROOT,
  counts,
  decodeEntities,
  human,
  jsxText,
  ratchet,
  readBaseline,
  scanSource,
  uiFiles,
} from '../tools/strings';

afterEach(() => {
  setLocale('en');
  useSettings.setState({ settings: DEFAULT_SETTINGS });
});

describe('the strings ratchet (tools/strings.ts, tests/strings.baseline.json)', () => {
  it('no src/ui file has more literal player-facing strings than the baseline allows', () => {
    const bad = ratchet(counts(), readBaseline());
    expect(
      bad.map((b) => `${b.file}: ${b.count} > ${b.allowed}`),
      'route new strings through t() (src/ui/text), or lower the baseline with --write-baseline',
    ).toEqual([]);
  }, 60_000);

  it('covers every src/ui file but the labs and the text layer', () => {
    const files = uiFiles();
    expect(files.length).toBeGreaterThan(150);
    expect(files.some((f) => f.startsWith('src/ui/lab/'))).toBe(false);
    expect(files.some((f) => f.startsWith('src/ui/text/'))).toBe(false);
    expect(files).toContain('src/ui/hud/Hud.tsx');
  });

  it('finds JSX text, text attributes, prose literals and templates, and skips code', () => {
    const src = `
      import x from 'some module path';
      type T = 'a type name';
      const cls = 'flex items-center gap-2';
      const css = 'translate(-50%, -50%) rotate(45deg)';
      export function A({ n }: { n: number }) {
        if (n === 'not text either') return null;
        console.log('a log line');
        const label = { label: 'Leave', note: 'M9 17.5V6l10-2v11.5', className: 'text-sm font-bold' };
        const line = \`\${n} hits left\`;
        return (
          <div className="p-2 m-1" title="Pause" data-testid="a test id">
            Hello there
            <b>{n}</b>
            {t('screens.x')}
          </div>
        );
      }`;
    const found = scanSource('x.tsx', src).map((f) => [f.kind, f.text]);
    expect(found).toEqual([
      ['literal', 'Leave'],
      ['template', '${…} hits left'],
      ['attr', 'Pause'],
      ['jsx', 'Hello there'],
    ]);
    expect(human('Thread a hero')).toBe(true);
    expect(human('absolute inset-0')).toBe(false);
    expect(human('0 0 12px rgba(0, 0, 0, 0.4)')).toBe(false);
  });

  it('reads JSX text exactly as the JSX transform does (whitespace and entities)', () => {
    const samples = [
      'Hello',
      '\n      Hello there\n    ',
      '  two  spaces  ',
      '\n  line one\n  line two\n',
      'tab\there',
      ' a &amp; b &mdash; c&nbsp;d &#8217; &#x2192; ',
      '\n\n   \n  spaced\n\n  out\n  ',
      'trailing ',
      ' leading',
    ];
    for (const raw of samples) {
      const out = ts.transpileModule(`const x = <>${raw}</>;`, {
        compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
        fileName: 'x.tsx',
      }).outputText;
      const m = /React\.Fragment, null, (".*")\)/.exec(out);
      expect(m, out).not.toBeNull();
      expect(jsxText(raw), JSON.stringify(raw)).toBe(JSON.parse(m![1]!) as string);
    }
    expect(decodeEntities('&rsquo;&hellip;')).toBe('’…');
  });
});

describe('the English catalogue', () => {
  const keys = Object.keys(EN) as TextKey[];

  it('holds the converted files’ messages, each area’s keys under its prefix, none twice', () => {
    expect(keys.length).toBeGreaterThan(0);
    let total = 0;
    for (const [area, catalogue] of Object.entries(EN_AREAS)) {
      for (const key of Object.keys(catalogue)) expect(key.startsWith(`${area}.`), key).toBe(true);
      total += Object.keys(catalogue).length;
    }
    expect(keys).toHaveLength(total);
  });

  it('every W3 message lives in its source file’s module, and that file uses it', () => {
    for (const area of ['hud', 'screens', 'common'] as const) {
      for (const key of Object.keys(EN_AREAS[area])) {
        const file = key.split('.')[1]!;
        expect(file, key).toMatch(/^[a-z][A-Za-z0-9]*$/);
      }
    }
    // Every key is read somewhere in src/ui: no message is left behind by a conversion.
    const sources = uiFiles()
      .map((f) => readFileSync(join(ROOT, f), 'utf8'))
      .join('\n');
    const unused = keys.filter(
      (k) => /^(hud|screens|common)\./.test(k) && !sources.includes(`'${k}'`),
    );
    expect(unused).toEqual([]);
  }, 60_000);

  it('en-XA covers every key: each message pseudo-localized, its placeholders kept', () => {
    for (const key of keys) {
      const en = EN[key] as string;
      const xa = t(key, undefined, 'en-XA');
      expect(xa, key).toBe(pseudo(en));
      expect(xa.startsWith('[') && xa.endsWith(']'), key).toBe(true);
      for (const ph of en.match(/\{\w+\}/g) ?? []) expect(xa, key).toContain(ph);
    }
  });

  it('English prints each message exactly as written, with its parameters', () => {
    for (const key of keys) {
      const en = EN[key] as string;
      expect(t(key), key).toBe(en);
      expect(t(key, undefined, 'en'), key).toBe(en);
    }
    const withParams = keys.find((k) => /\{\w+\}/.test(EN[k] as string));
    if (withParams) {
      const en = EN[withParams] as string;
      const params = Object.fromEntries(
        [...en.matchAll(/\{(\w+)\}/g)].map((m, i) => [m[1]!, i * 7]),
      );
      expect(t(withParams, params)).toBe(interpolate(en, params));
      expect(t(withParams, params)).not.toMatch(/\{\w+\}/);
    }
  });

  it('a parameter is printed as a template literal would print it', () => {
    for (const v of ['Kael', 3, 0, -0, 2.5, 1e21, NaN, '', 'a {b} c'])
      expect(interpolate('x {v} y', { v })).toBe(`x ${v} y`);
  });
});

describe('numbers and plurals in English', () => {
  it('formats as the UI did', () => {
    expect(num(12345.6)).toBe('12,346');
    expect(num(-3)).toBe('-3');
    expect(percent(0.123)).toBe('12%');
    expect(percent(0.1234, 1)).toBe('12.3%');
    expect(clockText(83.4)).toBe('1:23');
    expect(plural(1, 'hit')).toBe('hit');
    expect(plural(0, 'hit')).toBe('hits');
    expect(plural(2, 'foe', 'foes')).toBe('foes');
    expect(plural(1.5, 'second')).toBe('seconds');
    expect(plural(-1, 'hit')).toBe('hits');
  });
});

describe('the locale’s wiring (src/ui/text/install.ts)', () => {
  it('?locale= names a known locale or nothing', () => {
    expect(localeFromSearch('?locale=en-XA')).toBe('en-XA');
    expect(localeFromSearch('?lab=ui&locale=en')).toBe('en');
    expect(localeFromSearch('?locale=fr')).toBeNull();
    expect(localeFromSearch('')).toBeNull();
  });

  it('settings.locale absent means English', () => {
    expect(localeFromSettings(DEFAULT_SETTINGS)).toBe('en');
    expect(localeFromSettings({ ...DEFAULT_SETTINGS, locale: 'en-XA' })).toBe('en-XA');
  });

  it('follows the settings, unless the address fixed the locale', () => {
    const stop = installLocale('');
    expect(currentLocale()).toBe('en');
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, locale: 'en-XA' } });
    expect(currentLocale()).toBe('en-XA');
    useSettings.setState({ settings: DEFAULT_SETTINGS });
    expect(currentLocale()).toBe('en');
    stop();

    const stop2 = installLocale('?locale=en-XA');
    expect(currentLocale()).toBe('en-XA');
    useSettings.setState({ settings: DEFAULT_SETTINGS });
    expect(currentLocale()).toBe('en-XA');
    stop2();
  });

  it('installing leaves the default settings without a locale key', () => {
    const stop = installLocale('');
    expect('locale' in useSettings.getState().settings).toBe(false);
    stop();
  });
});

describe('sim text by its content source (src/ui/text/simText.ts)', () => {
  const bark = CONTENT.heroes.flatMap((h) => Object.values(h.barks).flat())[0]!;
  const decree = CONTENT.attacks.find((a) => a.decree)!.decree!;

  it('English shows every sim line as the sim wrote it', () => {
    for (const line of [bark, decree, CONDUCTOR_DECREES.overture, 'Cracked Bell', 'anything'])
      expect(simText(line, 'en')).toBe(line);
  });

  it('a bark and a decree are found in CONTENT and pseudo-localized in en-XA', () => {
    expect(simTextSource(bark)).toMatch(/^CONTENT\.heroes\[\d+\]\{\w+\}\.barks\./);
    expect(simTextSource(decree)).toMatch(/^CONTENT\.attacks\[\d+\]\{\w+\}\.decree$/);
    expect(simTextSource(POSTLUDE_DECREE)).toBe('POSTLUDE_DECREE');
    expect(simText(bark, 'en-XA')).toBe(pseudo(bark));
    expect(simText(CONDUCTOR_DECREES.grandSilence, 'en-XA')).toBe(
      pseudo(CONDUCTOR_DECREES.grandSilence),
    );
  });

  it('the sim’s own words, with no content source, stay English (the listed exceptions)', () => {
    // Decree names and texts written in src/sim/systems/bosses.ts, not in content.
    const simOnly = [
      'Cracked Bell',
      'Blood Frenzy',
      'Unpicking',
      'Overture',
      'Mirror Choir',
      'Postlude',
      'The bell cracks — every Toll Outward now rings back Inward. Out, then in!',
      'The Matriarch hunts faster. Cleanse the bleeding; Focus the pack.',
    ];
    for (const line of simOnly) {
      expect(simTextSource(line), line).toBeNull();
      expect(simText(line, 'en-XA')).toBe(line);
    }
  });
});

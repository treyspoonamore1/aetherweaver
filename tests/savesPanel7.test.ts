/**
 * The Saves panel shows what review B's fix stream built (docs/phase-7.md, W5): the import warning
 * that says an earlier copy is kept, "Forget them…" beside "Put them back…", a kept unreadable save
 * that has a later one beside it, and a kept save's download that the import can read. Render tests
 * for each state, on device storage held in memory (the node environment has no `localStorage`).
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The notice reads storage in an effect; the render runs that effect once, in place.
let effectRan = false;
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useEffect: (fn: () => void) => {
      if (effectRan) return;
      effectRan = true;
      fn();
    },
  };
});

import {
  keptDownload,
  keptSaves,
  previewImport,
  readSaveBytes,
  type KeptSave,
} from '../src/app/saveTransfer';
import { storage } from '../src/app/storage';
import { CORRUPT_KEYS, SAVE_KEYS } from '../src/meta/save';
import { BEFORE_IMPORT_SUFFIX } from '../src/meta/saveFile';
import { t } from '../src/ui/text';

const store = storage();
const ALL_KEYS = [
  ...CORRUPT_KEYS,
  ...Object.values(SAVE_KEYS),
  ...Object.values(SAVE_KEYS).map((k) => k + BEFORE_IMPORT_SUFFIX),
  'aetherweaver.settings',
  'aetherweaver.settings' + BEFORE_IMPORT_SUFFIX,
  'aetherweaver.corrupt.noticed',
];

function wipe(): void {
  for (const k of ALL_KEYS) store.removeItem(k);
}

const PROFILE_KEY = 'aetherweaver.profile';
const RAW_FIRST = '{"version":10,"xp":9001,"broken":';
const RAW_LATEST = '{"version":10,"xp":12,"runs":';

// The panel is a .tsx module the node project does not compile (no `--jsx`): loaded by path.
let SavesPanelView: FunctionComponent<{ canImport: boolean }>;
let KeptSaveNotice: FunctionComponent;
beforeAll(async () => {
  const path = '../src/ui/screens/SavesPanel';
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<never>>;
  SavesPanelView = mod['SavesPanelView'] as unknown as typeof SavesPanelView;
  KeptSaveNotice = mod['KeptSaveNotice'] as FunctionComponent;
});

const panel = () => renderToStaticMarkup(createElement(SavesPanelView, { canImport: true }));
const notice = () => {
  effectRan = false;
  return renderToStaticMarkup(createElement(KeptSaveNotice));
};
/** The text as the markup holds it (escaped). */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const has = (html: string, text: string) => html.includes(esc(text));
const testIds = (html: string) => html.match(/data-testid="[^"]+"/g) ?? [];

beforeEach(wipe);
afterEach(wipe);

describe('the Saves panel with no copy and nothing kept', () => {
  it('renders the default markup: export and import only', () => {
    const html = panel();
    expect(testIds(html)).toEqual([
      'data-testid="saves-panel"',
      'data-testid="saves-export-file"',
      'data-testid="saves-export-code"',
      'data-testid="saves-import-file"',
      'data-testid="saves-code-in"',
      'data-testid="saves-read-code"',
    ]);
    expect(html).not.toContain('saves-restore');
    expect(html).not.toContain('saves-kept');
    expect(has(html, t('saves.restore.forget'))).toBe(false);
    expect(notice()).toBe('');
  });

  it('from a fight, offers export only', () => {
    const html = renderToStaticMarkup(createElement(SavesPanelView, { canImport: false }));
    expect(has(html, t('saves.import.inFight'))).toBe(true);
    expect(html).not.toContain('saves-restore');
  });
});

describe('a copy of the saves from before an import is kept', () => {
  beforeEach(() => {
    store.setItem(PROFILE_KEY + BEFORE_IMPORT_SUFFIX, '{"version":10}');
  });

  it('offers to put them back and to forget them, and nothing else changes', () => {
    const html = panel();
    expect(testIds(html)).toEqual([
      'data-testid="saves-panel"',
      'data-testid="saves-export-file"',
      'data-testid="saves-export-code"',
      'data-testid="saves-import-file"',
      'data-testid="saves-code-in"',
      'data-testid="saves-read-code"',
      'data-testid="saves-restore"',
      'data-testid="saves-restore-button"',
      'data-testid="saves-restore-forget"',
    ]);
    expect(has(html, t('saves.restore.offer'))).toBe(true);
    expect(has(html, t('saves.restore.button'))).toBe(true);
    expect(has(html, t('saves.restore.forget'))).toBe(true);
    // The confirms are not open.
    expect(has(html, t('saves.restore.forgetQuestion'))).toBe(false);
    expect(has(html, t('saves.restore.question'))).toBe(false);
    expect(html).not.toContain('saves-kept');
  });

  it('the strings are words, through the text layer', () => {
    for (const key of [
      'saves.import.warningKept',
      'saves.restore.forget',
      'saves.restore.forgetQuestion',
      'saves.restore.forgetConfirm',
      'saves.kept.latest',
    ] as const) {
      expect(t(key), key).not.toBe(key);
      expect(t(key).length, key).toBeGreaterThan(8);
    }
    // The warning with a copy kept differs from the one without, and says the earlier copy stays.
    expect(t('saves.import.warningKept')).not.toBe(t('saves.import.warning'));
  });
});

describe('a kept unreadable save', () => {
  it('shows its line, with download and forget, and no mark of a later one', () => {
    store.setItem(PROFILE_KEY + '.corrupt', RAW_FIRST);
    const html = panel();
    expect(testIds(html)).toContain('data-testid="saves-kept"');
    expect(testIds(html).filter((x) => x.includes('saves-kept-download'))).toHaveLength(1);
    expect(has(html, t('saves.kept.profile'))).toBe(true);
    expect(html).not.toContain(esc(t('saves.kept.latest')));
    expect(html).not.toContain('saves-restore');
  });

  it('with a later one beside it, says so in its line, in the panel and in the notice', () => {
    store.setItem(PROFILE_KEY + '.corrupt', RAW_FIRST);
    store.setItem(PROFILE_KEY + '.corrupt.latest', RAW_LATEST);
    const kept = keptSaves(store);
    expect(kept.map((k) => k.latest)).toEqual([false, true]);

    const html = panel();
    expect(testIds(html).filter((x) => x.includes('saves-kept-download'))).toHaveLength(2);
    // The later one's line, and only that one's, carries the mark.
    const lines = html.match(/<span class="text-sm text-text">[^<]*<\/span>/g) ?? [];
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toContain(esc(t('saves.kept.latest')));
    expect(lines[1]).toContain(esc(t('saves.kept.latest')));

    // The notice: the same lines, and the later one's download label says so.
    const n = notice();
    expect(n).toContain('data-testid="saves-kept-notice"');
    const items = n.match(/<li>[^<]*<\/li>/g) ?? [];
    expect(items).toHaveLength(2);
    expect(items[0]).not.toContain(esc(t('saves.kept.latest')));
    expect(items[1]).toContain(esc(t('saves.kept.latest')));
    const buttons = n.match(/<button[^>]*>[^]*?<\/button>/g) ?? [];
    const downloads = buttons.filter((b) => b.includes(esc(t('saves.kept.download'))));
    expect(downloads).toHaveLength(2);
    expect(downloads[0]).not.toContain(esc(t('saves.kept.latest')));
    expect(downloads[1]).toContain(esc(t('saves.kept.latest')));
  });

  it('a backup copy with a later one carries both marks, in that order', () => {
    store.setItem('aetherweaver.profile.bak.corrupt', RAW_FIRST);
    store.setItem('aetherweaver.profile.bak.corrupt.latest', RAW_LATEST);
    const lines = panel().match(/<span class="text-sm text-text">[^<]*<\/span>/g) ?? [];
    const last = lines[1]!;
    expect(last.indexOf(esc(t('saves.kept.backup')))).toBeGreaterThan(0);
    expect(last.indexOf(esc(t('saves.kept.latest')))).toBeGreaterThan(
      last.indexOf(esc(t('saves.kept.backup'))),
    );
  });
});

describe('a kept save’s download', () => {
  const keptOf = (kind: 'profile' | 'run', raw: string): KeptSave => ({
    key: `aetherweaver.${kind}.corrupt`,
    kind,
    backup: false,
    latest: false,
    raw,
  });

  it('is a file the import reads when the raw text is JSON, and the raw text otherwise', async () => {
    const json = '{"version":9999,"xp":3,"future":{"a":[1,2]}}';
    const text = keptDownload(keptOf('profile', json));
    expect(text).not.toBe(json);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed).toMatchObject({ format: 'aetherweaver-save', version: 1, run: null });
    expect(parsed['profile']).toEqual(JSON.parse(json));
    const read = await readSaveBytes(new TextEncoder().encode(text));
    expect(read.ok).toBe(true);
    // The reader goes on to say why the save in it cannot load here, in words, not a crash.
    if (read.ok) {
      const judged = previewImport(read.file);
      expect(judged.ok).toBe(false);
      if (!judged.ok)
        expect(t(`saves.error.${judged.error}` as never)).not.toContain('saves.error');
    }
    expect(keptDownload(keptOf('profile', RAW_FIRST))).toBe(RAW_FIRST);
    expect(keptDownload(keptOf('run', 'null'))).toBe('null');
  });
});

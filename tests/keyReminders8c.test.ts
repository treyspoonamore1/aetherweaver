/**
 * Phase 8c (docs/phase-8.md): the key reminders stay for a player's first fights, then leave the
 * HUD; the pause menu's Controls shows them on demand.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KEY_REMINDER_FIGHTS, countKeyReminders, keyRemindersDue } from '../src/ui/hud/hints';

type Props = Record<string, unknown>;
/** The components are .tsx: loaded as the other UI tests load them. */
async function tsx<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ path)) as T;
}
const { KeyHints } = await tsx<{ KeyHints: FunctionComponent<Props> }>('../src/ui/hud/KeyHints');
const { PauseMenu } = await tsx<{ PauseMenu: FunctionComponent<Props> }>('../src/ui/hud/PauseMenu');

describe('the key reminders', () => {
  it('stay for a player’s first fights, then leave the HUD', () => {
    for (let fight = 0; fight < KEY_REMINDER_FIGHTS; fight++) {
      expect(keyRemindersDue()).toBe(true);
      countKeyReminders();
    }
    expect(keyRemindersDue()).toBe(false);
    expect(KEY_REMINDER_FIGHTS).toBeGreaterThanOrEqual(3);
  });

  it('come back on demand: the pause menu has Controls, at any screen width', () => {
    const menu = renderToStaticMarkup(
      createElement(PauseMenu, { mode: 'run', onResume: () => {}, onAbandon: () => {} }),
    );
    expect(menu).toContain('data-testid="pause-controls-open"');
    expect(menu).toContain('Controls');
    const shown = renderToStaticMarkup(createElement(KeyHints, { always: true }));
    expect(shown).not.toContain('hidden');
    expect(shown).toContain('Move');
    expect(shown).toContain('Pause');
  });
});

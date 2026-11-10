/**
 * The aura presentation pin (docs/phase-7.md, ground rule 5): every aura and ornament, on each
 * Chord role, draws and sounds exactly as it did when `presentationPin.json` was recorded
 * (`recordPresentationPin.ts`, once, before Phase 7 changed any source). See
 * `presentationPinFixture.ts` for what is recorded and how it is kept apart from everything else.
 * A change to an aura's or an ornament's look or sound changes a hash here, and needs the owner.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../../src/app/settings';
import { CONTENT } from '../../src/content';
import { SIM_VERSION } from '../../src/sim/constants';
import { computePin, pinCases, serializePin, type PresentationPin } from './presentationPinFixture';

/**
 * Every comfort option at its strongest (ground rule 4: Flashes, reduced motion, high contrast and
 * the rest leave every aura and ornament exactly as it is). The settings store holds these while
 * the pin is computed, and the views are passed Flashes 0 where they take a Flashes value.
 */
const STRONGEST: Settings = {
  ...DEFAULT_SETTINGS,
  screenShake: 0,
  flashes: 0,
  damageNumbers: false,
  hints: false,
  captions: true,
  reducedMotion: 'on',
  telegraphs: { opacity: 0.6, outline: 2, perfectBand: 2, highContrast: true },
  answerGlyphs: false,
  importantNumbersOnly: true,
  slowmoVignette: false,
};

const FILE = readFileSync(new URL('./presentationPin.json', import.meta.url), 'utf8');
const PIN = JSON.parse(FILE) as PresentationPin;

describe('the aura presentation pin (docs/phase-7.md, ground rule 5)', () => {
  it('covers the six auras on both roles and the four ornaments on every role they take', () => {
    expect(CONTENT.auras).toHaveLength(6);
    expect(CONTENT.ornaments).toHaveLength(4);
    expect(Object.keys(PIN.cases)).toEqual(pinCases().map((c) => c.key));
    expect(Object.keys(PIN.cases)).toHaveLength(19);
    expect(PIN.simVersion).toBe(SIM_VERSION);
    // The scripted fight sang every song it was meant to: the pour, the plant, Fermata's holds.
    const audio = (k: string) => PIN.cases[k]!.audio.calls;
    expect(audio('aura:allegro:beam').pour).toBeGreaterThan(0);
    expect(audio('ornament:pedal_point:field').fieldPlanted).toBeGreaterThan(0);
    expect(audio('ornament:pedal_point:field').ensureDrone).toBeGreaterThan(0);
    expect(audio('aura:fermata:field').fermataHold).toBe(2);
    expect(audio('aura:fermata:field').fermataReleased).toBe(2);
  });

  it('with default settings, the file is exactly what the fixture computes now', async () => {
    const now = await computePin(DEFAULT_SETTINGS);
    for (const key of Object.keys(PIN.cases)) expect(now.cases[key], key).toEqual(PIN.cases[key]);
    expect(now.markup).toEqual(PIN.markup);
    expect(now.fieldShader).toBe(PIN.fieldShader);
    expect(serializePin(now)).toBe(FILE);
  }, 300_000);

  it('with every comfort option at its strongest, nothing moves: the same file', async () => {
    const now = await computePin(STRONGEST);
    for (const key of Object.keys(PIN.cases)) expect(now.cases[key], key).toEqual(PIN.cases[key]);
    expect(now.markup).toEqual(PIN.markup);
    expect(serializePin(now)).toBe(FILE);
  }, 300_000);
});

/**
 * The Chord builder's aura and ornament cards (docs/phase-7.md, ground rule 4; review B, finding
 * 2): every aura and ornament card `ChordBuilder` draws, in English, is exactly as it was when
 * `chordCardsPin.json` was recorded (`recordChordCardsPin.ts`, once, from the tree at 81a12ef,
 * before Phase 7 changed any source). See `chordCardsPinFixture.ts` for the cases. A change to how
 * a card draws an aura or an ornament changes the file's markup here, and needs the owner.
 *
 * With `AW_RECORD_CHORD_CARDS` set (by the recorder only) it writes the file instead.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type * as ReactModule from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, useSettings } from '../../src/app/settings';
import { CONTENT } from '../../src/content';
import {
  chordCardsCases,
  computeChordCards,
  serializeChordCards,
  type ChordBuilderView,
  type ChordCardsPin,
  type SlotRef,
} from './chordCardsPinFixture';

/** The slot the next render selects (null: the builder's own first choice). */
const gate = vi.hoisted(() => ({ ref: null as SlotRef | null }));

vi.mock('react', async (importOriginal) => {
  const React = await importOriginal<typeof ReactModule>();
  const isSlotRef = (v: unknown) =>
    typeof v === 'object' && v !== null && 'chord' in v && 'kind' in v && 'index' in v;
  return {
    ...React,
    // The builder's selected slot is its first state: the case's choice stands in for it.
    useState(init: unknown) {
      const state = React.useState(init);
      return gate.ref && isSlotRef(state[0]) ? [gate.ref, state[1]] : state;
    },
  };
});

/** ChordBuilder, loaded at run time (tsconfig.node.json compiles no JSX, as tests/uiFill does). */
async function chordBuilder(): Promise<ChordBuilderView> {
  const path = '../../src/ui/screens/ChordBuilder';
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, ChordBuilderView>;
  return mod['ChordBuilder']!;
}

const PATH = new URL('./chordCardsPin.json', import.meta.url);
const RECORD = process.env.AW_RECORD_CHORD_CARDS;

let now: ChordCardsPin;
beforeAll(async () => {
  useSettings.setState({ settings: DEFAULT_SETTINGS });
  now = computeChordCards(await chordBuilder(), (ref) => {
    gate.ref = ref;
  });
}, 300_000);

describe.runIf(RECORD)('recording the Chord builder’s cards pin', () => {
  it('writes the file once', async () => {
    if (existsSync(PATH)) throw new Error(`${PATH.pathname} exists: it is recorded once`);
    writeFileSync(PATH, await serializeChordCards(now));
  });
});

describe.skipIf(RECORD)('the Chord builder’s aura and ornament cards (ground rule 4)', () => {
  const FILE = existsSync(PATH) ? readFileSync(PATH, 'utf8') : '';
  const PIN = (FILE ? JSON.parse(FILE) : { cases: {}, cards: {} }) as ChordCardsPin;

  it('covers every aura and ornament, in every slot it can take, and the locks', () => {
    expect(CONTENT.auras).toHaveLength(6);
    expect(CONTENT.ornaments).toHaveLength(4);
    expect(Object.keys(PIN.cases)).toEqual(chordCardsCases().map((c) => c.key));
    // 6 auras × 5 slots × selected or not; 3 ornaments × 4 slots and Unison × 2, × 2; 6 Ranks × 7;
    // 3 new, 2 clashes, 2 on Life, 2 presets.
    expect(Object.keys(PIN.cases)).toHaveLength(60 + 28 + 42 + 3 + 2 + 2 + 2);
    const all = Object.values(PIN.cards).join('\n');
    for (const a of CONTENT.auras) expect(all, a.id).toContain(a.name);
    for (const o of CONTENT.ornaments) expect(all, o.id).toContain(o.name);
    expect(all).toContain('Rank 2: empty it');
    expect(all).toContain('Ornament · Rank 3');
    expect(all).toContain('Third Voice');
    expect(all).toContain('>New<');
    expect(all).toContain('Can’t share a song with');
    expect(all).toContain('Beam song only');
  });

  it('every card is exactly as recorded at 81a12ef', async () => {
    for (const key of Object.keys(PIN.cases)) {
      const cards = (c: ChordCardsPin, list: string[]) => list.map((h) => c.cards[h]);
      const want = PIN.cases[key]!;
      const got = now.cases[key]!;
      expect(cards(now, got.slots), `${key}: slots`).toEqual(cards(PIN, want.slots));
      expect(cards(now, got.picker), `${key}: picker`).toEqual(cards(PIN, want.picker));
      if (want.presets)
        expect(cards(now, got.presets ?? []), `${key}: presets`).toEqual(cards(PIN, want.presets));
    }
    expect(await serializeChordCards(now)).toBe(FILE);
  });
});

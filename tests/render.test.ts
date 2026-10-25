import type * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT } from '../src/content';
import { CHORD_PRESETS } from '../src/meta/run';
import { C, VISION_HEX, applyVision, auraColor, color } from '../src/render/palette';
import {
  REGEN_MASK,
  SONG_GLYPH,
  auraHearing,
  beamSong,
  chipText,
  chordMask,
  fieldLook,
  fieldLoudness,
  focusLabel,
  focusLevel,
  isAllIn,
  softenHex,
  songHex,
  splitAmplified,
  type ChordView,
} from '../src/render/songs';
import { createSim, type ChordConfig } from '../src/sim';

const hex = (c: THREE.Color) => `#${c.getHexString()}`;

describe('render palette (Phase 2)', () => {
  afterEach(() => {
    applyVision('normal');
  });

  it('switches the live semantic colours with the colour-vision setting', () => {
    applyVision('normal');
    expect(hex(C.lethal)).toBe(visionPalette('normal').lethal);
    expect(applyVision('deuteranopia')).toBe(true);
    const p = visionPalette('deuteranopia');
    for (const key of ['heal', 'threat', 'lethal', 'mend', 'empower', 'call'] as const) {
      expect(hex(C[key])).toBe(p[key]);
      expect(VISION_HEX[key]).toBe(p[key]);
    }
    // Re-applying the same palette is a no-op (no per-frame work).
    expect(applyVision('deuteranopia')).toBe(false);
  });

  it('never mutates the shared colour cache', () => {
    const teal = color('#2dd4bf');
    applyVision('tritanopia');
    expect(hex(teal)).toBe('#2dd4bf');
    expect(hex(C.heal)).toBe(visionPalette('tritanopia').heal);
  });

  it('colours every aura with its content colour', () => {
    for (const a of CONTENT.auras) expect(hex(auraColor(a.id))).toBe(a.color.toLowerCase());
    expect(hex(auraColor('nope'))).toBe('#f5d78e');
  });
});

describe('render songs (Phase 3)', () => {
  afterEach(() => {
    applyVision('normal');
  });

  const chord = (over: Partial<ChordView>): ChordView => ({
    index: 0,
    role: 'beam',
    auras: ['fortissimo'],
    ornaments: [],
    anchor: 'weaver',
    x: 0,
    z: 0,
    radius: 6,
    effectMult: 1,
    focus: 2,
    echo: 0.75,
    threadHero: null,
    ...over,
  });

  it('draws the beam song’s echo quieter than a field song, and Unison with no disc', () => {
    const echo = chord({});
    const field = chord({ index: 1, role: 'field', focus: 1, echo: 1 });
    expect(fieldLook(echo)).toBe('echo');
    expect(fieldLook(field)).toBe('song');
    expect(fieldLoudness(field)).toBe(1);
    expect(fieldLoudness(echo)).toBeLessThan(0.75);
    expect(fieldLook(chord({ echo: 0, radius: 0, focus: 2.5 }))).toBe('none');
    expect(isAllIn(chord({ echo: 0, radius: 0 }))).toBe(true);
    expect(fieldLook(chord({ auras: [] }))).toBe('none');
  });

  it('scales the beam visuals with chord.focus (tuning shows without render changes)', () => {
    expect(focusLevel(1)).toBe(0);
    expect(focusLevel(2)).toBeGreaterThan(0.5);
    expect(focusLevel(2.5)).toBeGreaterThan(focusLevel(2));
    expect(focusLevel(9)).toBeLessThanOrEqual(1.4);
    expect(focusLabel(2)).toBe('×2');
    expect(focusLabel(2.5)).toBe('×2.5');
  });

  it('splits the Weaver’s share into the gold chip and the song chip', () => {
    const out = { empower: 0, aura: 0 };
    expect(splitAmplified(100, 30, out)).toEqual({ empower: 70, aura: 30 });
    expect(splitAmplified(20, 35, out)).toEqual({ empower: 0, aura: 20 });
    expect(splitAmplified(40, 0, out)).toEqual({ empower: 40, aura: 0 });
    expect(chipText(0.6)).toBeNull();
    expect(chipText(12.4)).toBe('+12');
    expect(chipText(30, SONG_GLYPH)).toBe('♪+30');
  });

  it('keeps the song chip apart from the gold chip and the damage text in every palette', () => {
    for (const v of COLOR_VISIONS) {
      const p = visionPalette(v);
      const song = simulateVision(songHex(v), v);
      const see = (h: string) => simulateVision(h, v);
      expect(deltaE(song, see(p.amp)), `${v} song/amp`).toBeGreaterThanOrEqual(30);
      expect(deltaE(song, see(p.empower)), `${v} song/empower`).toBeGreaterThanOrEqual(30);
      expect(deltaE(song, see('#fff7ed')), `${v} song/white text`).toBeGreaterThanOrEqual(20);
      expect(deltaE(song, see('#fde68a')), `${v} song/crit text`).toBeGreaterThanOrEqual(20);
      expect(deltaE(song, see(p.lethal)), `${v} song/lethal`).toBeGreaterThanOrEqual(20);
      applyVision(v);
      expect(hex(C.song)).toBe(songHex(v));
    }
  });

  it('maps auras to coverage bits and knows which heal over time', () => {
    const i = CONTENT.auras.findIndex((a) => a.id === 'sostenuto');
    const j = CONTENT.auras.findIndex((a) => a.id === 'fortissimo');
    expect(chordMask(['sostenuto', 'fortissimo'])).toBe((1 << i) | (1 << j));
    expect(chordMask([])).toBe(0);
    expect(REGEN_MASK & (1 << i)).not.toBe(0);
    expect(REGEN_MASK & (1 << j)).toBe(0);
    const beam = chordMask(['fortissimo']);
    expect(auraHearing(1 << j, beam, true)).toBe('focus');
    expect(auraHearing(1 << j, beam, false)).toBe('echo');
    expect(auraHearing(1 << i, beam, true)).toBe('full');
    expect(softenHex('#000000', 0.5)).toBe('#808080');
  });

  it('reads the real sim: Guardian = echo + field song, All In = no disc, beam on the hero', () => {
    const run = (chords: ChordConfig[]) => {
      const sim = createSim({ seed: 7, encounter: 'sandbox', debug: true, chords });
      sim.step([{ t: 'thread', slot: 1 }]);
      for (let k = 0; k < 5; k++) sim.step([]);
      return sim.state;
    };
    const preset = (id: string) => CHORD_PRESETS.find((p) => p.id === id)!.chords;
    const g = run(preset('guardian').map((c) => ({ ...c })));
    expect(fieldLook(g.field.chords[0]!)).toBe('echo');
    expect(fieldLook(g.field.chords[1]!)).toBe('song');
    expect(beamSong(g)?.threadHero).toBe(g.party[1]);
    expect(g.entities.get(g.party[1]!)?.hero?.beamFocus).toBe(true);
    const a = run(preset('all_in').map((c) => ({ ...c })));
    const beam = beamSong(a)!;
    expect(fieldLook(beam)).toBe('none');
    expect(isAllIn(beam)).toBe(true);
    expect(beam.focus).toBeGreaterThan(2);
    expect(beam.threadHero).toBe(a.party[1]);
  });
});

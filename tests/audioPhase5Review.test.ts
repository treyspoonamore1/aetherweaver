/**
 * Phase 5a review fixes (audio): the Crimson Spire's voicing never outlives its run. Run-less
 * screens in the map mood (the Loom's Reliquary and Astrolabe) and Training's calm sound the
 * Reliquary's, as they did before Movement II.
 */
import { describe, expect, it } from 'vitest';
import { useRun } from '../src/app/runStore';
import { SynthDirector } from '../src/audio/director';
import * as Run from '../src/meta/run';
import type { RunState } from '../src/meta/types';

/** An Expedition past the Cantor: its Map voices the Crimson Spire. */
function climbing(): RunState {
  const exp = Run.newRun(3, undefined, [], [], [], [], undefined, 2);
  const cantor = exp.map.rows.flat().find((n) => n.encounterId === 'hollow_cantor')!;
  return { ...exp, path: [cantor.id] } as RunState;
}

describe('the Crimson Spire after its run', () => {
  it('a run-less map-mood screen (Reliquary, Astrolabe) is voiced as the Reliquary', () => {
    const before = useRun.getState().run;
    const d = new SynthDirector({ installUnlock: false, followSettings: false });
    try {
      useRun.setState({ run: climbing() });
      d.setMood('map');
      expect(d.getBiome()).toBe('crimson_spire');
      // The Summary closes the run; the Loom, then its Reliquary station (the map mood).
      d.setMood('victory');
      useRun.getState().closeRun();
      d.setMood('loom');
      d.setMood('map');
      expect(d.getBiome()).toBe('reliquary');
      // And while on such a screen, the run store closing moves it back too.
      useRun.setState({ run: climbing() });
      expect(d.getBiome()).toBe('crimson_spire');
      useRun.setState({ run: null });
      expect(d.getBiome()).toBe('reliquary');
    } finally {
      d.dispose();
      useRun.setState({ run: before });
    }
  });

  it('without a run, whoever set the biome last keeps it (a fight’s arena, the audio lab)', () => {
    const before = useRun.getState().run;
    const d = new SynthDirector({ installUnlock: false, followSettings: false });
    try {
      useRun.setState({ run: null });
      // The runtime sets a sandbox fight's arena biome, then the calm mood.
      d.setBiome('crimson_spire');
      d.setMood('calm');
      expect(d.getBiome()).toBe('crimson_spire');
      // The audio lab picks the Crimson Spire, then the map mood.
      d.setMood('map');
      expect(d.getBiome()).toBe('crimson_spire');
      // An unrelated run-store change with no run doesn't reset it.
      useRun.setState({ run: null });
      expect(d.getBiome()).toBe('crimson_spire');
      // A run that closes from a fight takes its biome with it, whatever the mood.
      useRun.setState({ run: climbing() });
      d.setMood('combat');
      useRun.getState().closeRun();
      expect(d.getBiome()).toBe('reliquary');
      d.setMood('calm');
      expect(d.getBiome()).toBe('reliquary');
    } finally {
      d.dispose();
      useRun.setState({ run: before });
    }
  });
});

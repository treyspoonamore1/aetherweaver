/** UI sounds: subtle, short, pitched inside D dorian. They bypass the music ducker. */
import { Voice, type Engine } from './engine';
import { glassNote, handbell, pluck, whoosh } from './synth';
import { midiToHz, scaleMidi } from './theory';
import type { UiSound } from './types';

const hz = (idx: number) => midiToHz(scaleMidi(idx));

export function playUiSound(e: Engine, sound: UiSound): void {
  if (sound === 'hover' && !e.gate('ui:hover', 0.045)) return;
  if (!e.admit(`ui:${sound}`, sound === 'hover' ? 2 : 3)) return;
  const t = e.now + 0.004;
  const v = new Voice(e, 'ui');
  switch (sound) {
    case 'hover':
      v.osc({
        type: 'sine',
        freq: hz(11),
        start: t,
        dur: 0.03,
        attack: 0.004,
        release: 0.02,
        gain: 0.07,
      });
      break;
    case 'click':
      pluck(v, t, hz(7), 0.12, 0.12, 0.5);
      break;
    case 'confirm':
      pluck(v, t, hz(7), 0.11, 0.2, 0.6);
      pluck(v, t + 0.085, hz(11), 0.12, 0.34, 0.7);
      break;
    case 'back':
      pluck(v, t, hz(11), 0.08, 0.16, 0.4);
      pluck(v, t + 0.075, hz(7), 0.09, 0.26, 0.3);
      break;
    case 'pick':
      pluck(v, t, hz(8), 0.12, 0.22, 0.6);
      glassNote(v, t + 0.01, hz(15), 0.035, 0.7, 0.6);
      break;
    case 'node':
      handbell(v, t, hz(3), 0.1, 1.2, 0.4);
      whoosh(v, t, 0.3, 0.025, 600, 1800);
      break;
    case 'error':
      v.osc({
        type: 'sawtooth',
        freq: 110,
        freqTo: 92,
        start: t,
        dur: 0.11,
        attack: 0.008,
        release: 0.05,
        gain: 0.07,
        filter: { type: 'lowpass', freq: 320, q: 0.7 },
      });
      break;
    case 'reward':
      [7, 9, 11, 13, 15].forEach((idx, i) => {
        pluck(v, t + i * 0.075, hz(idx), 0.085, 0.4, 0.7);
        glassNote(v, t + i * 0.075, hz(idx + 7), 0.03, 0.9, 0.7);
      });
      handbell(v, t + 0.3, hz(14), 0.06, 1.4, 0.6);
      break;
  }
  e.register(`ui:${sound}`, v.commit());
}

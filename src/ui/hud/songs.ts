/**
 * How the two songs read on the HUD (pure, from the snapshot): which hero the beam song pours
 * into and at what strength, who hears its echo, and who hears the field song.
 */
import { mult } from '../screens/chordModel';
import type { ChordHud, HeroHud } from '../store';

/** The beam song, if it sings anything. */
export function beamSong(chords: readonly ChordHud[]): ChordHud | null {
  return chords.find((c) => c.role === 'beam' && c.auras.length > 0) ?? null;
}

export interface HeroSongs {
  /** The beam song pours into this hero: its strength ("×2"), else null. */
  focus: string | null;
  /** Beam-song auras on them at focus strength. */
  focusAuras: string[];
  /** Beam-song auras they hear only as the echo. */
  echoAuras: string[];
  /** Field-song auras on them. */
  fieldAuras: string[];
  /** The echo's strength ("×0.75"), for the tooltip. */
  echo: string | null;
}

/** Splits a hero's `auras` by song. */
export function heroSongs(hero: HeroHud, chords: readonly ChordHud[]): HeroSongs {
  const beam = beamSong(chords);
  const beamIds = new Set(beam?.auras.map((a) => a.id) ?? []);
  const onBeam = hero.auras.filter((id) => beamIds.has(id));
  const focused = !!beam && hero.beamFocus;
  return {
    focus: focused ? mult(beam.focus) : null,
    focusAuras: focused ? onBeam : [],
    echoAuras: focused ? [] : onBeam,
    fieldAuras: hero.auras.filter((id) => !beamIds.has(id)),
    echo: beam && beam.echo > 0 ? mult(beam.echo) : null,
  };
}

/** The beam song's tooltip in the Weaver bar. */
export function beamTitle(beam: ChordHud, target: string | null): string {
  const names = beam.auras.map((a) => a.name).join(' + ');
  const echo =
    beam.echo > 0
      ? ` Everyone else within ${Number(beam.radius.toFixed(1))} m hears an echo at ${mult(beam.echo)}.`
      : ' Nobody else hears an echo.';
  return target
    ? `Beam song (${names}): ${target} hears it at ${mult(beam.focus)}.${echo}`
    : `Beam song (${names}): thread a hero and they hear it at ${mult(beam.focus)}.${echo}`;
}

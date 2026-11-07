/**
 * The Finale's HUD looks as plain data (docs/phase-5d.md "UI"): the Conductor's Discord meter, the
 * Grand Silence's stave, the Cue line, stilled frames, the callouts and captions its events bring,
 * and the defeat line. Testable without React. Every helper reads only the optional BossHud and
 * HeroHud keys the Finale sets, or a Finale event, so nothing here draws in any other fight.
 */
import {
  CONDUCTOR_ENCOUNTER,
  DISCORD_MAX,
  FORTISSIMO,
  NOTES_NEEDED,
  SILENCE_CAP,
} from '../../content/crucibleIds';
import type { NoteSource, SimEvent } from '../../sim';
import type { IconName } from '../kit/iconPaths';
import type { BossHud, Callout } from '../store';

// ── Colours (each paired with a glyph and words, never colour alone) ──────────────────

/**
 * The Conductor's Discord: tarnished bronze (ΔE ≥ 32 from every semantic colour in every vision,
 * docs/phase-5d.md "Colour"), never the Shielded affix's discord pink.
 */
export const DISCORD_HEX = '#7a5646';
/** The same bronze, lightened for words on the dark HUD (text contrast). */
export const DISCORD_INK = '#e3c4b2';
/** The silence is desaturation, not a hue: the stave's ground and the stilled frames' ink. */
export const SILENCE_INK = '#cbd5e1';
/** A note is the Weaver's doing: her gold. */
export const NOTE_GOLD = '#f5d78e';

/** "Fortissimo Silence" is always written in full (Fortissimo alone is an aura). */
export const FORTISSIMO_NAME = 'Fortissimo Silence';
/** Discord's owner, in words: never 'Resonance', which is always the Weaver's. */
export const DISCORD_LABEL = 'Conductor’s Discord';

// ── The Discord stave meter (phases 1-2) ─────────────────────────────────────────────

/** Discord's four segments of 25, each filled 0..1 (it fills as the Weaver's Resonance does). */
export function discordSegments(
  d: Pick<NonNullable<BossHud['discord']>, 'value' | 'max'>,
): number[] {
  const max = d.max > 0 ? d.max : DISCORD_MAX;
  const seg = max / 4;
  return [0, 1, 2, 3].map((i) => Math.max(0, Math.min(1, (d.value - i * seg) / seg)));
}

/**
 * The meter's words: "Conductor’s Discord 72/100 · Crescendo cancels Fortissimo Silence". Blind
 * Score hides the answer after the "·", as it does on every condition line.
 */
export function discordText(
  d: Pick<NonNullable<BossHud['discord']>, 'value' | 'max'>,
  blind = false,
): string {
  const head = `${DISCORD_LABEL} ${Math.floor(Math.max(0, d.value))}/${d.max}`;
  return blind ? head : `${head} · Crescendo cancels ${FORTISSIMO_NAME}`;
}

/**
 * Seconds until Discord reaches its top at its passive rate (null when it isn't rising), and the
 * words for it: "Fortissimo Silence in ~14 s", or "now" once full.
 */
export function fortissimoIn(d: NonNullable<BossHud['discord']>): number | null {
  if (d.value >= d.max) return 0;
  return d.rate > 0 ? (d.max - d.value) / d.rate : null;
}

export function fortissimoInText(d: NonNullable<BossHud['discord']>): string | null {
  const s = fortissimoIn(d);
  if (s === null) return null;
  return s <= 0.05 ? `${FORTISSIMO_NAME} now` : `${FORTISSIMO_NAME} in ~${Math.ceil(s)} s`;
}

/** Fortissimo Silence's pulses as the bar names them: "pulse 2 of 3". */
export function fortissimoPulseText(f: NonNullable<BossHud['fortissimo']>): string {
  return `${FORTISSIMO_NAME} · pulse ${f.pulse} of ${f.of}`;
}

// ── The Grand Silence's stave (phase 3) ───────────────────────────────────────────────

export interface NoteLook {
  icon: IconName;
  /** The note's source as the callout and caption name it. */
  label: string;
  color: string;
}

/** What made a note: the Weaver's Perfect Ward, Clutch Chime, Reel-save, or a Rewind that undid a blow. */
export const NOTE_LOOK: Readonly<Record<NoteSource, NoteLook>> = {
  perfect: { icon: 'ward', label: 'Perfect Ward', color: NOTE_GOLD },
  clutch: { icon: 'chime', label: 'Clutch Chime', color: '#c4b5fd' },
  reel: { icon: 'reel', label: 'Reel-save', color: NOTE_GOLD },
  rewind: { icon: 'rewind', label: 'Rewind', color: '#cbd5f5' },
};

/** The stave's eight pips: each played note's source, in order, then null for the unplayed. */
export function silencePips(
  s: Pick<NonNullable<BossHud['silence']>, 'notes' | 'of' | 'sources'>,
): (NoteSource | null)[] {
  const of = s.of > 0 ? s.of : NOTES_NEEDED;
  return Array.from({ length: of }, (_, i) => (i < s.notes ? (s.sources[i] ?? 'perfect') : null));
}

/** The stave's words: "Grand Silence · 3/8 notes". */
export function silenceText(s: Pick<NonNullable<BossHud['silence']>, 'notes' | 'of'>): string {
  return `Grand Silence · ${s.notes}/${s.of} notes`;
}

/**
 * How much of the silence is left, 1 → 0, measured against its real cap (fixed at silence entry,
 * stretched by the windup assists), so the bar drains from the first second of a stretched cap.
 */
export function silenceLeftFrac(s: Pick<NonNullable<BossHud['silence']>, 'left' | 'cap'>): number {
  const cap = s.cap > 0 ? s.cap : SILENCE_CAP;
  return Math.max(0, Math.min(1, s.left / cap));
}

/** The countdown to the Coda: "The Coda in 32 s". */
export function codaText(left: number): string {
  return `The Coda in ${Math.max(0, Math.ceil(left))} s`;
}

/** What the stave asks for, Calling-aware (Rewind on a Chronomancer's run, no Reel with Anchor). */
export function silenceAsk(opts: { rewinds?: boolean; reel?: string | null } = {}): string {
  return `Eight notes wake them: ${noteSources(opts)}`;
}

/**
 * The actions that make a note, for this Weaver: "Perfect Wards, Clutch Chimes and Reel-saves"; a
 * Chronomancer's Reel slot is Rewind's ("… and a Rewind that undoes a blow"); an Anchor never
 * makes a Reel-save ("Perfect Wards and Clutch Chimes"); Swap takes the blow on the Weaver.
 */
export function noteSources(opts: { rewinds?: boolean; reel?: string | null } = {}): string {
  if (opts.rewinds) return 'Perfect Wards, Clutch Chimes and a Rewind that undoes a blow';
  if (opts.reel === 'anchor') return 'Perfect Wards and Clutch Chimes';
  if (opts.reel === 'swap')
    return 'Perfect Wards, Clutch Chimes and Reel-saves (Swap takes the blow on you)';
  return 'Perfect Wards, Clutch Chimes and Reel-saves';
}

// ── The Cue (a soloist and its Solo) ──────────────────────────────────────────────────

/** A voice's short name on the Cue line: "Mirror Bass" → "Bass". */
export function voiceName(name: string): string {
  return name.replace(/^Mirror /, '');
}

/** The Cue line: "Cue · Bass: Basso Ostinato", then "→ Lyra" once the Solo has begun. */
export function cueText(cue: NonNullable<BossHud['cue']>): string {
  return `Cue · ${voiceName(cue.soloist)}: ${cue.solo}${cue.target ? ` → ${cue.target}` : ''}`;
}

/** What answers a Cued Solo, after the "·" (Blind Score hides it). */
export const CUE_ANSWER = 'interrupt the soloist, or answer its Solo';

// ── Party frames ──────────────────────────────────────────────────────────────────────

/** A stilled hero's strip. */
export const STILLED_LINE = 'Stilled · waits for your song';
/** A downed hero's line while the silence holds: the eighth note stands them back up. */
export const DOWNED_SONG_LINE = 'The song will bring them back';
/** A frame just after Reignite: relit gold; `risen` for a hero the song stood back up. */
export const REIGNITE_LINE: Readonly<Record<'relit' | 'risen', string>> = {
  relit: 'Relit · the song returns',
  risen: 'Risen · the song brought them back',
};

/** A stilled frame's accessible line: what holds them, and how long until the Coda. */
export function stilledAria(name: string, notes: number, of: number, left: number | null): string {
  const coda = left === null ? '' : `; the Coda in ${Math.max(0, Math.ceil(left))} seconds`;
  return `${name} is stilled by the Grand Silence and waits for your song: ${notes} of ${of} notes${coda}`;
}

// ── Callouts and captions (from the Finale's events only) ────────────────────────────

/** A callout the runtime pushes, with how long it stays (ms). */
export interface FinaleCallout {
  callout: Omit<Callout, 'id' | 'expiresAt'>;
  ttl: number;
}

/** A note's callout: "Note 3/8 · Perfect Ward"; the eighth "Note 8/8 · The song returns!". */
export function noteCallout(n: number, of: number, source: NoteSource): FinaleCallout {
  const look = NOTE_LOOK[source];
  const last = n >= of;
  return {
    callout: {
      kind: 'note',
      text: last ? `Note ${n}/${of} · The song returns!` : `Note ${n}/${of} · ${look.label}`,
      color: last ? NOTE_GOLD : look.color,
      icon: last ? 'note' : look.icon,
      key: 'note',
    },
    ttl: last ? 2600 : 1600,
  };
}

/**
 * What a Finale event says on the HUD (none for any other event): a note, the song's return with
 * whoever stood back up, the Coda, and Fortissimo Silence cancelled. `name` names a hero by id.
 */
export function finaleCallouts(
  event: SimEvent,
  name: (id: number) => string | null,
): FinaleCallout[] {
  switch (event.type) {
    case 'silenceNote':
      return [noteCallout(event.n, event.of, event.source)];
    case 'reignited': {
      const names = event.revived.flatMap((id) => name(id) ?? []);
      if (names.length === 0) return [];
      return [
        {
          callout: {
            kind: 'system',
            text: `${names.join(' and ')} ${names.length === 1 ? 'stands' : 'stand'} again`,
            color: NOTE_GOLD,
          },
          ttl: 2400,
        },
      ];
    }
    case 'silenceBroken':
      return [
        {
          callout: {
            kind: 'system',
            text: 'The Coda — your heroes wake without the song',
            detail: `${event.notes}/${NOTES_NEEDED} notes`,
            color: SILENCE_INK,
          },
          ttl: 2600,
        },
      ];
    case 'fortissimoCancelled':
      if (event.by !== 'crescendo') return [];
      return [
        {
          callout: {
            kind: 'perfect',
            text: `${FORTISSIMO_NAME} — cancelled`,
            color: NOTE_GOLD,
            icon: 'sun',
          },
          ttl: 2000,
        },
      ];
    default:
      return [];
  }
}

/**
 * Captions (Settings → captions): key sounds in words. "The music stops", "Note 3 of 8 · Perfect
 * Ward", "Discord rises", "The song returns". Null for every other event. Each has a visual twin
 * with captions off.
 */
export function finaleCaption(event: SimEvent): string | null {
  switch (event.type) {
    case 'silenceBegan':
      return 'The music stops';
    case 'silenceNote':
      return `Note ${event.n} of ${event.of} · ${NOTE_LOOK[event.source].label}`;
    case 'discordRose':
      return 'Discord rises';
    case 'reignited':
      return 'The song returns';
    default:
      return null;
  }
}

/** A caption as a callout: a quiet line in brackets, as subtitles write a sound. */
export function captionCallout(text: string): FinaleCallout {
  return { callout: { kind: 'system', text: `[${text}]`, color: SILENCE_INK }, ttl: 1800 };
}

/** The defeat callout in the Finale; elsewhere the song falls silent as it always did. */
export const FINALE_DEFEAT_LINE = 'The Conductor’s silence holds.';
export const DEFEAT_LINE = 'The song falls silent…';

export function defeatLine(encounterId: string): string {
  return encounterId === CONDUCTOR_ENCOUNTER ? FINALE_DEFEAT_LINE : DEFEAT_LINE;
}

/** Fortissimo Silence's attack ids (its three pulses). */
export const FORTISSIMO_IDS: ReadonlySet<string> = new Set(FORTISSIMO);

// ── The Codex ─────────────────────────────────────────────────────────────────────────

/** A boss's lore line, under its Codex entry (docs/phase-5d.md "The Silent Conductor"). */
export const ENEMY_LORE: Readonly<Record<string, string>> = {
  the_silent_conductor:
    'Tall and robed in a Weaver’s ribbons gone ash-grey, it carries a baton and a stilled halo of five stave lines. It was the first Weaver.',
};

/**
 * CONTRACT v4 — player settings (docs/plan/04 §9). Persisted per device in localStorage.
 * Version 4 adds the HUD's layout and health read-outs (docs/health-ui.md).
 * Assists feed the sim config (and are stamped into replays); the rest is presentation.
 * Older saved settings are migrated, never thrown away.
 */
import { z } from 'zod';
import { create } from 'zustand';
import { PAD_BUTTONS, type PadButton } from '../input/actions';
import { ASSIST_VALUES } from '../meta/runReplay';
import { LOCALES } from '../ui/text/locales';
import { COLOR_VISIONS } from './colorVision';

const Volume = z.number().min(0).max(1);

/**
 * The volume sliders. Phase 7 (*Contracts*): `ambience` (absent: follows Effects, as the engine
 * does today, `ambienceVolume`) and `barks` (absent: 1, `barksVolume`), each optional.
 */
const VolumesSchema = z.object({
  master: Volume,
  music: Volume,
  sfx: Volume,
  ui: Volume,
  ambience: Volume.optional(),
  barks: Volume.optional(),
});

const AssistsSchema = z.object({
  /**
   * Extra seconds on the Perfect Ward window. The values are the run verifier's (`ASSIST_VALUES`,
   * meta/runReplay.ts): a fight played with any other wouldn't verify (Phase 6 *Open* 3).
   */
  perfectWindowBonus: z.literal(ASSIST_VALUES.perfectWindowBonus),
  /** Telegraph wind-up multiplier (≥ 1 = more time to react). */
  telegraphLead: z.literal(ASSIST_VALUES.telegraphLead),
  /** Heroes fire their own Solos after a moment's Cue window (docs/hero-autonomy.md). */
  autonomy: z.boolean(),
});

/**
 * Where a HUD panel sits (docs/health-ui.md), as Edit HUD layout leaves it: the panel's corner
 * nearest the screen's edges is pinned at (`x`, `y`), shares of the screen's width and height, so
 * it keeps its place at any resolution and grows away from the edge it's pinned to.
 */
const PanelPlaceSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  /**
   * The frames' point pinned there: top or bottom, then left, right or centre (`c`: their middle
   * at `x`, for frames centred under the fight). The one nearest the screen's edges.
   */
  corner: z.enum(['tl', 'tc', 'tr', 'bl', 'bc', 'br']),
});
export type PanelPlace = z.infer<typeof PanelPlaceSchema>;

/** The party frames: where (null: the default place, bottom left), how big, which way. */
export const FramesLayoutSchema = z.object({
  at: PanelPlaceSchema.nullable(),
  /** Their size, over the default. */
  scale: z.number().min(0.75).max(1.5),
  /** Stacked one above another (the default) or side by side. */
  orientation: z.enum(['vertical', 'horizontal']),
});
export type FramesLayout = z.infer<typeof FramesLayoutSchema>;

/** The Weaver bar: where (null: the default place, bottom middle) and how big. */
export const WeaverBarLayoutSchema = z.object({
  at: PanelPlaceSchema.nullable(),
  scale: z.number().min(0.75).max(1.25),
});
export type WeaverBarLayout = z.infer<typeof WeaverBarLayoutSchema>;

export const DEFAULT_WEAVER_BAR: WeaverBarLayout = { at: null, scale: 1 };

/** The fight's health read-outs and the HUD's layout (docs/health-ui.md). */
const HudSchema = z.object({
  frames: FramesLayoutSchema,
  /** Added after v4 first shipped: settings saved before it take the default. */
  weaverBar: WeaverBarLayoutSchema.default(DEFAULT_WEAVER_BAR),
  /** Bars over the heroes: always, only while they're hurt, or none. */
  allyBars: z.enum(['always', 'hurt', 'off']),
  /** The party frames' big number: the life missing, the percent left, or the life left. */
  healthText: z.enum(['missing', 'percent', 'current']),
  /** A soft sound when a hero falls under a quarter of their life. */
  lowHealthSound: z.boolean(),
});
export type HudSettings = z.infer<typeof HudSchema>;

export const DEFAULT_HUD: HudSettings = {
  frames: { at: null, scale: 1, orientation: 'vertical' },
  weaverBar: DEFAULT_WEAVER_BAR,
  allyBars: 'always',
  healthText: 'missing',
  lowHealthSound: true,
};

// ── Phase 7 (docs/phase-7.md, *Contracts*): the new options. Every key is optional, absent until
// the player sets it, and absent means today's behaviour, so v4 settings saved before them parse to
// exactly what they were (captions' precedent: no version bump). Read them through `optionsOf`,
// which fills each absent key (and each absent field of a present one) with its default. None of
// them reaches a fight's config or a replay (ground rule 3): the new aids live in `aids`, never in
// `assists`. Declared by W0; nothing reads them yet. ──

/** Reduced motion: follow the operating system (as today), or on, or off. */
export const REDUCED_MOTION = ['system', 'on', 'off'] as const;
export type ReducedMotion = (typeof REDUCED_MOTION)[number];

/** The telegraphs' look (W2): opacity 0.6-1, outline 1-2 (×), Perfect band width 1-2 (×). */
const TelegraphsSchema = z.object({
  opacity: z.number().min(0.6).max(1).optional(),
  outline: z.number().min(1).max(2).optional(),
  perfectBand: z.number().min(1).max(2).optional(),
  highContrast: z.boolean().optional(),
});
export interface TelegraphSettings {
  opacity: number;
  outline: number;
  perfectBand: number;
  highContrast: boolean;
}
export const DEFAULT_TELEGRAPHS: Readonly<TelegraphSettings> = {
  opacity: 1,
  outline: 1,
  perfectBand: 1,
  highContrast: false,
};

/**
 * What plays each mouse role (W1): a mouse button (`Mouse0` left, `Mouse1` middle, `Mouse2`
 * right, `Mouse3`, `Mouse4`) or a key (`KeyboardEvent.code`). `thread`: Thread the hovered hero;
 * `mode`: Mend ⇄ Empower; `wheel`: hold for the Directive wheel, click an enemy to Focus it.
 */
const MouseRolesSchema = z.object({
  thread: z.string().optional(),
  mode: z.string().optional(),
  wheel: z.string().optional(),
});
export interface MouseRoles {
  thread: string;
  mode: string;
  wheel: string;
}
export const DEFAULT_MOUSE_ROLES: Readonly<MouseRoles> = {
  thread: 'Mouse0',
  mode: 'Mouse2',
  wheel: 'Mouse1',
};

/** Input options (W1). */
const InputSchema = z.object({
  /** Thread mode: each press toggles (as today), or held for Empower. */
  threadMode: z.enum(['toggle', 'hold']).optional(),
  /** The Directive wheel: held open (as today), or a press opens it and the next closes it. */
  wheel: z.enum(['hold', 'toggle']).optional(),
  /** Smart-cast takes the hovered hero (as today); off, the threaded hero only. */
  mouseoverCast: z.boolean().optional(),
  mouse: MouseRolesSchema.optional(),
  /**
   * The Cue-by-slot modifier: held with a hero's Thread key, it Cues them. `Shift` (either Shift
   * key, as today), `Control`, `Alt`, or a `KeyboardEvent.code`. Not in the doc's list: W0 adds it
   * for W1's "the Cue-by-slot modifier is bindable".
   */
  cueModifier: z.string().optional(),
  /** Pad overrides by action (as `bindings` is for keys): at most 3 buttons an action. */
  padBindings: z.record(z.string(), z.array(z.enum(PAD_BUTTONS)).max(3)).optional(),
});
export interface InputSettings {
  threadMode: 'toggle' | 'hold';
  wheel: 'hold' | 'toggle';
  mouseoverCast: boolean;
  mouse: MouseRoles;
  cueModifier: string;
  padBindings: Readonly<Record<string, readonly PadButton[]>>;
}
export const DEFAULT_INPUT: Readonly<InputSettings> = {
  threadMode: 'toggle',
  wheel: 'hold',
  mouseoverCast: true,
  mouse: DEFAULT_MOUSE_ROLES,
  cueModifier: 'Shift',
  padBindings: {},
};

/** Game speed (W2): the runtime's real-time clock, never the sim's (ground rule 3). */
export const GAME_SPEEDS = [0.7, 0.8, 0.9, 1] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];

/** Aids (decision 15): input- and clock-side, outside `assists`, never in a fight's config. */
const AidsSchema = z.object({
  gameSpeed: z.literal(GAME_SPEEDS).optional(),
  /** After 2 s with no input, Thread the lowest-life hero (W1), as a key press would. */
  autoThread: z.boolean().optional(),
});
export interface Aids {
  gameSpeed: GameSpeed;
  autoThread: boolean;
}
export const DEFAULT_AIDS: Readonly<Aids> = { gameSpeed: 1, autoThread: false };

/** Render quality (W4, decision 8): `auto` is offered; `high` stays the default, as today. */
export const QUALITY_SETTINGS = ['auto', 'low', 'medium', 'high'] as const;
export type QualitySetting = (typeof QUALITY_SETTINGS)[number];

/** Phase 7's options, every one filled in (`optionsOf`). */
export interface Options {
  reducedMotion: ReducedMotion;
  telegraphs: TelegraphSettings;
  /** The answer glyphs on telegraphs (W2). */
  answerGlyphs: boolean;
  /** Damage numbers: only the Weaver's, saves and downs (W2). */
  importantNumbersOnly: boolean;
  /** The overlay's slow-motion vignette (W2). */
  slowmoVignette: boolean;
  /** The heroes' synthesised voices on the barks bus (W7, decision 3: off by default). */
  heroVoices: boolean;
  input: InputSettings;
  aids: Aids;
  quality: QualitySetting;
  /** The text layer's locale (W3a): English, or the pseudo-locale. */
  locale: (typeof LOCALES)[number];
}

/** Every Phase 7 option's default: exactly today's behaviour. */
export const DEFAULT_OPTIONS: Readonly<Options> = {
  reducedMotion: 'system',
  telegraphs: DEFAULT_TELEGRAPHS,
  answerGlyphs: true,
  importantNumbersOnly: false,
  slowmoVignette: true,
  heroVoices: false,
  input: DEFAULT_INPUT,
  aids: DEFAULT_AIDS,
  quality: 'high',
  locale: 'en',
};

export const SettingsSchema = z.object({
  version: z.literal(4),
  volumes: VolumesSchema,
  /** 0 = off … 1 = full trauma shake. */
  screenShake: z.number().min(0).max(1),
  /** Full-screen flashes on Perfect / Save / Crescendo: 0 = off … 1 = full strength. */
  flashes: z.number().min(0).max(1),
  damageNumbers: z.boolean(),
  /** Coach hints during the first encounters. */
  hints: z.boolean(),
  /** HUD and menu scale. */
  uiScale: z.number().min(0.8).max(1.5),
  /** Palette for danger, answers and life (see colorVision.ts). */
  colorVision: z.enum(COLOR_VISIONS),
  /**
   * Key overrides by input action (`KeyboardEvent.code`s, at most 3 per action). Actions not
   * listed use input/actions.ts DEFAULT_BINDINGS; an empty list unbinds the action.
   */
  bindings: z.record(z.string(), z.array(z.string()).max(3)),
  assists: AssistsSchema,
  /** Skip the unlocks: every song, aura and ornament from the first run (meta/profile.ts). */
  unlockAll: z.boolean(),
  hud: HudSchema,
  /**
   * Captions for key sounds (docs/phase-5d.md): 'The music stops', 'Note 3 of 8 · Perfect Ward',
   * 'Discord rises', 'The song returns'. Added after v4 first shipped: settings saved before it
   * take the default, so no version bump. Every caption has a visual twin with it off.
   */
  captions: z.boolean().default(false),
  // Phase 7 (see `Options`): each optional, absent until set.
  reducedMotion: z.enum(REDUCED_MOTION).optional(),
  telegraphs: TelegraphsSchema.optional(),
  answerGlyphs: z.boolean().optional(),
  importantNumbersOnly: z.boolean().optional(),
  slowmoVignette: z.boolean().optional(),
  heroVoices: z.boolean().optional(),
  input: InputSchema.optional(),
  aids: AidsSchema.optional(),
  quality: z.enum(QUALITY_SETTINGS).optional(),
  locale: z.enum(LOCALES).optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

let optionsFor: Settings | null = null;
let optionsMemo: Options = DEFAULT_OPTIONS;

/**
 * Phase 7's options with every absent key (and absent field) at its default. Settings objects are
 * replaced, never mutated, so the answer is kept for the last one asked about: a per-frame read
 * allocates nothing.
 */
export function optionsOf(settings: Settings): Readonly<Options> {
  if (settings === optionsFor) return optionsMemo;
  const d = DEFAULT_OPTIONS;
  const input = settings.input;
  optionsMemo = {
    reducedMotion: settings.reducedMotion ?? d.reducedMotion,
    telegraphs: { ...d.telegraphs, ...defined(settings.telegraphs) },
    answerGlyphs: settings.answerGlyphs ?? d.answerGlyphs,
    importantNumbersOnly: settings.importantNumbersOnly ?? d.importantNumbersOnly,
    slowmoVignette: settings.slowmoVignette ?? d.slowmoVignette,
    heroVoices: settings.heroVoices ?? d.heroVoices,
    input: {
      ...d.input,
      ...defined(input),
      mouse: { ...d.input.mouse, ...defined(input?.mouse) },
      padBindings: input?.padBindings ?? d.input.padBindings,
    },
    aids: { ...d.aids, ...defined(settings.aids) },
    quality: settings.quality ?? d.quality,
    locale: settings.locale ?? d.locale,
  };
  optionsFor = settings;
  return optionsMemo;
}

/** An object's fields that are set (an absent or undefined field keeps the default). */
function defined<T extends object>(o: T | undefined): Partial<T> {
  const out: Partial<T> = {};
  if (!o) return out;
  for (const [k, v] of Object.entries(o))
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

/** The ambience bus's volume: its own slider, or (absent, as today) the Effects slider's. */
export function ambienceVolume(volumes: Settings['volumes']): number {
  return volumes.ambience ?? volumes.sfx;
}

/** The barks bus's volume (W7): its own slider, or 1. */
export function barksVolume(volumes: Settings['volumes']): number {
  return volumes.barks ?? 1;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 4,
  volumes: { master: 0.8, music: 0.6, sfx: 0.9, ui: 0.7 },
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  hints: true,
  uiScale: 1,
  colorVision: 'normal',
  bindings: {},
  assists: { perfectWindowBonus: 0, telegraphLead: 1, autonomy: false },
  unlockAll: false,
  hud: DEFAULT_HUD,
  captions: false,
};

/** Settings as Phase 4 saved them (no HUD settings yet). */
const SettingsV3Schema = SettingsSchema.omit({ version: true, hud: true }).extend({
  version: z.literal(3),
});

/** Settings as Phase 2 saved them (no unlocks yet). */
const SettingsV2Schema = SettingsV3Schema.omit({ version: true, unlockAll: true }).extend({
  version: z.literal(2),
});

/** Settings as Phase 1 saved them. */
const SettingsV1Schema = z.object({
  version: z.literal(1),
  volumes: z.object({ master: Volume, music: Volume, sfx: Volume, ui: Volume }),
  screenShake: z.number().min(0).max(1),
  flashes: z.boolean(),
  damageNumbers: z.boolean(),
  hints: z.boolean(),
  assists: AssistsSchema,
});

/** Parses saved settings of any known version into the current shape (null if unusable). */
export function migrateSettings(raw: unknown): Settings | null {
  const current = SettingsSchema.safeParse(raw);
  if (current.success) return current.data;
  const v3 = SettingsV3Schema.safeParse(raw);
  if (v3.success) return { ...v3.data, version: 4, hud: DEFAULT_HUD };
  const v2 = SettingsV2Schema.safeParse(raw);
  if (v2.success) return { ...v2.data, version: 4, unlockAll: false, hud: DEFAULT_HUD };
  const v1 = SettingsV1Schema.safeParse(raw);
  if (v1.success) {
    return {
      ...DEFAULT_SETTINGS,
      volumes: v1.data.volumes,
      screenShake: v1.data.screenShake,
      flashes: v1.data.flashes ? 1 : 0,
      damageNumbers: v1.data.damageNumbers,
      hints: v1.data.hints,
      assists: v1.data.assists,
    };
  }
  return null;
}

const KEY = 'aetherweaver.settings';

function load(): Settings {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return migrateSettings(JSON.parse(raw)) ?? DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode or quota: settings simply don't persist.
  }
}

export interface SettingsState {
  settings: Settings;
  update(patch: (draft: Settings) => Settings): void;
  reset(): void;
}

export const useSettings = create<SettingsState>()((set, get) => ({
  settings: load(),
  update: (patch) => {
    const next = SettingsSchema.parse(patch(get().settings));
    save(next);
    set({ settings: next });
  },
  reset: () => {
    save(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
}));

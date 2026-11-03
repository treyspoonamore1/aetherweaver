/**
 * CONTRACT v4 — player settings (docs/plan/04 §9). Persisted per device in localStorage.
 * Version 4 adds the HUD's layout and health read-outs (docs/health-ui.md).
 * Assists feed the sim config (and are stamped into replays); the rest is presentation.
 * Older saved settings are migrated, never thrown away.
 */
import { z } from 'zod';
import { create } from 'zustand';
import { COLOR_VISIONS } from './colorVision';

const Volume = z.number().min(0).max(1);

const AssistsSchema = z.object({
  /** Extra seconds on the Perfect Ward window. */
  perfectWindowBonus: z.union([z.literal(0), z.literal(0.1), z.literal(0.2)]),
  /** Telegraph wind-up multiplier (≥ 1 = more time to react). */
  telegraphLead: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
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

export const SettingsSchema = z.object({
  version: z.literal(4),
  volumes: z.object({ master: Volume, music: Volume, sfx: Volume, ui: Volume }),
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
});
export type Settings = z.infer<typeof SettingsSchema>;

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

/**
 * CONTRACT v4 — player settings (docs/plan/04 §9). Persisted per device in localStorage.
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
  /** Heroes fire their Solos on their own when charged. */
  autonomy: z.boolean(),
});

export const SettingsSchema = z.object({
  version: z.literal(3),
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
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  version: 3,
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
};

/** Settings as Phase 2 saved them (no unlocks yet). */
const SettingsV2Schema = SettingsSchema.omit({ version: true, unlockAll: true }).extend({
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
  const v2 = SettingsV2Schema.safeParse(raw);
  if (v2.success) return { ...v2.data, version: 3, unlockAll: false };
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

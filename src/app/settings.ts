/**
 * CONTRACT v2 — player settings (docs/plan/04 §9). Persisted per device in localStorage.
 * Assists feed the sim config (and are stamped into replays); the rest is presentation.
 */
import { z } from 'zod';
import { create } from 'zustand';

export const SettingsSchema = z.object({
  version: z.literal(1),
  volumes: z.object({
    master: z.number().min(0).max(1),
    music: z.number().min(0).max(1),
    sfx: z.number().min(0).max(1),
    ui: z.number().min(0).max(1),
  }),
  /** 0 = off … 1 = full trauma shake. */
  screenShake: z.number().min(0).max(1),
  /** Full-screen flashes on Perfect / Save / Crescendo. */
  flashes: z.boolean(),
  damageNumbers: z.boolean(),
  /** Coach hints during the first encounters. */
  hints: z.boolean(),
  assists: z.object({
    /** Extra seconds on the Perfect Ward window. */
    perfectWindowBonus: z.union([z.literal(0), z.literal(0.1), z.literal(0.2)]),
    /** Telegraph wind-up multiplier (≥ 1 = more time to react). */
    telegraphLead: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
    /** Heroes fire their Solos on their own when charged. */
    autonomy: z.boolean(),
  }),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  volumes: { master: 0.8, music: 0.6, sfx: 0.9, ui: 0.7 },
  screenShake: 1,
  flashes: true,
  damageNumbers: true,
  hints: true,
  assists: { perfectWindowBonus: 0, telegraphLead: 1, autonomy: false },
};

const KEY = 'aetherweaver.settings';

function load(): Settings {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = SettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
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

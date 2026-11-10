/**
 * The English catalogue (docs/phase-7.md, *Contracts*): one file an area, so no two streams edit
 * one catalogue file. W0 writes this index; each area's file is its stream's:
 *
 *   input.ts   W1 (input, remapping and gamepad)       `input.*`
 *   a11y.ts    W2 (accessibility options)              `a11y.*`
 *   saves.ts   W5 (saves)                              `saves.*`
 *   release.ts W8 (release engineering)               `release.*`
 *   hud.ts, screens.ts, common.ts  W3a / W3b (the rest) `hud.*`, `screens.*`, `common.*`
 */
import { a11y } from './a11y';
import { common } from './common';
import { hud } from './hud';
import { input } from './input';
import { release } from './release';
import { saves } from './saves';
import { screens } from './screens';

/** Each area's catalogue, by its key prefix. */
export const EN_AREAS = { input, a11y, saves, release, hud, screens, common } as const;

/** Every English message, by key. */
export const EN = { ...input, ...a11y, ...saves, ...release, ...hud, ...screens, ...common };

/** A key of the English catalogue. */
export type TextKey = Extract<keyof typeof EN, string>;

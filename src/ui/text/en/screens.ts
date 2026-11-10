import type { Catalogue } from '../catalogue';
import { relicScreen as screensRelicScreen } from './screens/relicScreen';

/**
 * The English catalogue's `screens.*` keys (docs/phase-7.md, *Contracts*): W3's file. Each source
 * file's messages are in their own module under `./screens/`, keyed `screens.<file>.<message>`.
 * Every key here starts with `screens.` (tests/phase7Contracts.test.ts), so no two areas' keys meet.
 */
export const screens = {
  ...screensRelicScreen,
} satisfies Catalogue;

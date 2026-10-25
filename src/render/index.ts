/** Entry point for the combat view. The runtime only talks to `createWorldView`. */
import { CombatView } from './combatView';
import type { CreateWorldView } from './types';

export const createWorldView: CreateWorldView = (ctx, state) => new CombatView(ctx, state);

export { CombatView } from './combatView';
export type { FrameInfo, RenderContext, WorldView } from './types';

import type { Command } from '../sim';
import { NoviceBot } from './novice';
import { SkilledBot } from './skilled';
import type { Bot, BotKind } from './types';

/** Does nothing: the party fights alone. The floor of the difficulty contract. */
export class IdleBot implements Bot {
  readonly name = 'idle';
  decide(): Command[] {
    return [];
  }
}

export function makeBot(kind: BotKind, seed: number): Bot {
  switch (kind) {
    case 'idle':
      return new IdleBot();
    case 'novice':
      return new NoviceBot(seed);
    case 'skilled':
      return new SkilledBot(seed);
  }
}

export { NoviceBot, SkilledBot };
export type { Bot, BotKind };

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { EffectBundleSchema } from '../src/content/effects';
import { ContentSchema } from '../src/content/schema';

describe('content', () => {
  it('validates and has the starter party', () => {
    expect(CONTENT.heroes.map((h) => h.id)).toEqual(['kael', 'lyra', 'vexis']);
    expect(CONTENT.defaultParty).toEqual(['kael', 'lyra', 'vexis']);
  });

  it('rejects heroes slower than the Weaver and unknown party members', () => {
    const slow = structuredClone(CONTENT);
    slow.heroes[0]!.moveSpeed = 1;
    expect(ContentSchema.safeParse(slow).success).toBe(false);
    const unknown = structuredClone(CONTENT);
    unknown.defaultParty = ['kael', 'nobody'];
    expect(ContentSchema.safeParse(unknown).success).toBe(false);
  });
});

describe('effect vocabulary', () => {
  it('accepts a motif-shaped bundle', () => {
    // Riposte Bloom-like: Perfect Ward releases a nova (docs/plan/03 §8).
    const bundle = EffectBundleSchema.parse({
      stats: [{ stat: 'perfectWindow', bucket: 'add', value: 0.08 }],
      triggers: [
        {
          on: 'perfectWard',
          do: [{ type: 'damage', target: 'enemiesNearTarget', amount: 150, radius: 5 }],
        },
      ],
    });
    expect(bundle.triggers).toHaveLength(1);
  });

  it('rejects malformed effects', () => {
    expect(
      EffectBundleSchema.safeParse({
        triggers: [{ on: 'save', do: [{ type: 'heal', target: 'threaded' }] }],
      }).success,
    ).toBe(false);
    expect(
      EffectBundleSchema.safeParse({ stats: [{ stat: 'threadPotency', bucket: 'mega', value: 1 }] })
        .success,
    ).toBe(false);
  });
});

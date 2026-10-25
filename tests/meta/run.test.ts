import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import * as Run from '../../src/meta/run';
import { loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import type { CombatOutcome, RunState } from '../../src/meta/types';
import { emptyLedger } from '../../src/sim/world';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function outcomeFor(run: RunState, result: 'victory' | 'defeat'): CombatOutcome {
  const node = Run.findNode(run, run.pending!)!;
  const ledger = emptyLedger();
  ledger.healing = 1200;
  ledger.partyDamage = 4000;
  ledger.amplified = 600;
  ledger.perfects = 2;
  ledger.markers.push({ time: 12, kind: 'perfect', slot: 0 });
  ledger.saves.push({
    time: 20,
    hero: 1,
    heroDefId: 'lyra',
    cause: 'ward',
    prevented: 700,
    attack: 'Glass Lance',
  });
  return {
    encounterId: node.encounterId!,
    outcome: result,
    duration: 50,
    ledger,
    party: run.party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: result === 'victory' ? 500 : 0,
      maxHp: 1000,
      downed: result === 'defeat',
      dead: false,
      damage: 1000,
      amplified: 200,
    })),
    withoutYou: null,
  };
}

describe('the Prelude map', () => {
  it('is deterministic per seed and differs across seeds', () => {
    expect(Run.generateMap(5)).toEqual(Run.generateMap(5));
    expect(JSON.stringify(Run.generateMap(5))).not.toBe(JSON.stringify(Run.generateMap(6)));
  });

  it('never repeats an encounter within two rows (so no path repeats a fight)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const map = Run.generateMap(seed);
      for (let r = 1; r < map.rows.length; r++) {
        const here = map.rows[r]!.map((n) => n.encounterId).filter(Boolean);
        const before = [...(map.rows[r - 1] ?? []), ...(map.rows[r - 2] ?? [])].map(
          (n) => n.encounterId,
        );
        for (const id of here) expect(before, `seed ${seed} row ${r}`).not.toContain(id);
      }
    }
  });

  it('starts with First Light, ends with the Hollow Cantor, and every node is reachable', () => {
    for (let seed = 0; seed < 30; seed++) {
      const map = Run.generateMap(seed);
      expect(map.rows[0]!.map((n) => n.encounterId)).toEqual(['first_light']);
      expect(map.rows.at(-1)!.map((n) => n.encounterId)).toEqual(['hollow_cantor']);
      expect(map.rows.some((r) => r.some((n) => n.kind === 'miniboss'))).toBe(true);
      const reachable = new Set<string>([map.rows[0]![0]!.id]);
      for (const row of map.rows)
        for (const n of row) if (reachable.has(n.id)) n.next.forEach((id) => reachable.add(id));
      for (const row of map.rows) {
        for (const n of row) {
          expect(reachable.has(n.id), `${seed}:${n.id}`).toBe(true);
          if (n.row < map.rows.length - 1) expect(n.next.length).toBeGreaterThan(0);
          if (n.encounterId)
            expect(CONTENT.encounters.some((e) => e.id === n.encounterId)).toBe(true);
        }
      }
    }
  });
});

describe('a run', () => {
  it('plays from Prep to a victorious Summary with drafts, respites and carry-over', () => {
    let run = Run.newRun(42);
    expect(run.phase).toBe('prep');
    // An illegal loadout (three auras in one Chord) is ignored; a legal one is kept.
    expect(
      Run.setChords(run, [{ auras: ['allegro', 'fortissimo', 'lullaby'], ornaments: [] }]),
    ).toBe(run);
    run = Run.setChords(run, [
      { auras: ['allegro', 'fortissimo'], ornaments: ['grace_note'] },
      { auras: ['fermata'], ornaments: [] },
    ]);
    expect(run.chords).toEqual([
      { auras: ['allegro', 'fortissimo'], ornaments: ['grace_note'] },
      { auras: ['fermata'], ornaments: [] },
    ]);
    run = Run.embark(run);
    let guard = 0;
    while (run.phase !== 'summary' && guard++ < 50) {
      if (run.phase === 'map') {
        const options = Run.reachable(run);
        expect(options.length).toBeGreaterThan(0);
        run = Run.chooseNode(run, options[0]!.id);
      } else if (run.phase === 'combat') {
        const config = Run.combatConfig(run)!;
        expect(config.encounter).toBe(Run.findNode(run, run.pending!)!.encounterId);
        expect(config.chords).toEqual(run.chords);
        run = Run.finishCombat(run, outcomeFor(run, 'victory'));
        expect(run.phase).toBe('result');
        expect(run.lastResult!.highlights[0]!.kind).toBe('save');
        run = Run.continueFromResult(run);
      } else if (run.phase === 'draft') {
        expect(run.draft!.options.length).toBeGreaterThan(0);
        run = Run.pickDraft(run, 0);
      } else if (run.phase === 'respite') {
        run = Run.respite(run, 'rest');
      } else throw new Error(`unexpected phase ${run.phase}`);
    }
    expect(run.phase).toBe('summary');
    expect(run.outcome).toBe('victory');
    expect(run.results.at(-1)!.encounterId).toBe('hollow_cantor');
    expect(run.motifs.length).toBeGreaterThan(0);
    const totals = Run.runTotals(run);
    expect(totals.encounters).toBe(run.results.length);
    expect(totals.weaverShare).toBeGreaterThan(0);
  });

  it('a defeat ends the run; carry-over marks downed heroes Shaken', () => {
    let run = Run.embark(Run.newRun(7));
    run = Run.chooseNode(run, Run.reachable(run)[0]!.id);
    run = Run.finishCombat(run, outcomeFor(run, 'defeat'));
    expect(run.lastResult!.grade).toBe('D');
    expect(run.party.every((h) => h.shaken && h.hpPct === 0.3)).toBe(true);
    run = Run.continueFromResult(run);
    expect(run.phase).toBe('summary');
    expect(run.outcome).toBe('defeat');
  });

  it('Shaken lasts until the hero rests', () => {
    let run = Run.embark(Run.newRun(21));
    run = Run.chooseNode(run, Run.reachable(run)[0]!.id);
    run = Run.finishCombat(run, outcomeFor(run, 'defeat'));
    expect(run.party.every((h) => h.shaken)).toBe(true);
    // Pretend the run went on: a won fight keeps them Shaken; resting clears it.
    run = { ...run, phase: 'combat', outcome: null };
    run = Run.finishCombat(run, outcomeFor(run, 'victory'));
    expect(run.party.every((h) => h.shaken)).toBe(true);
    run = Run.respite({ ...run, phase: 'respite' }, 'rest');
    expect(run.party.every((h) => !h.shaken)).toBe(true);
  });

  it('ignores actions that do not fit the phase', () => {
    const run = Run.newRun(1);
    expect(Run.chooseNode(run, 'r0c0')).toBe(run);
    expect(Run.pickDraft(run, 0)).toBe(run);
    expect(Run.finishCombat(run, {} as CombatOutcome)).toBe(run);
  });
});

describe('drafts', () => {
  it('only offers motifs whose requirements are met, and upgrades owned ones', () => {
    let run = Run.embark(
      Run.setChords(Run.newRun(3), [{ auras: ['sostenuto', 'fortissimo'], ornaments: [] }]),
    );
    for (let i = 0; i < 20; i++) {
      const draft = Run.makeDraft(run, 'victory', 'common', i);
      for (const o of draft.options) {
        const def = CONTENT.motifs.find((m) => m.id === o.motifId)!;
        if (def.requires.aura) expect(['sostenuto', 'fortissimo']).toContain(def.requires.aura);
      }
      expect(new Set(draft.options.map((o) => o.motifId)).size).toBe(draft.options.length);
    }
    run = { ...run, motifs: CONTENT.motifs.map((m) => ({ id: m.id, level: m.values.length })) };
    expect(Run.makeDraft(run, 'victory', 'common').options).toHaveLength(0);
    run = { ...run, motifs: [{ id: 'deep_roots', level: 1 }] };
    const meditate = Run.makeDraft(run, 'meditate', 'common');
    expect(meditate.options).toEqual([{ motifId: 'deep_roots', level: 2, upgrade: true }]);
  });

  it('skipping heals; rerolls are limited', () => {
    let run = Run.embark(Run.newRun(9));
    run = {
      ...run,
      party: run.party.map((h) => ({ ...h, hpPct: 0.5 })),
      phase: 'draft',
      draft: Run.makeDraft(run, 'victory', 'common'),
    };
    const rerolled = Run.rerollDraft(run);
    expect(rerolled.draft!.rerollsLeft).toBe(0);
    expect(Run.rerollDraft(rerolled)).toBe(rerolled);
    const skipped = Run.pickDraft(run, null);
    expect(skipped.party.every((h) => h.hpPct > 0.5)).toBe(true);
    expect(skipped.phase).toBe('map');
  });
});

describe('grades', () => {
  const base = Run.summarize(
    {
      id: 'r0c0',
      row: 0,
      x: 0.5,
      kind: 'skirmish',
      encounterId: 'first_light',
      next: [],
      reward: { draft: 'common', heal: 0, text: '' },
    },
    {
      encounterId: 'first_light',
      outcome: 'victory',
      duration: 40,
      ledger: emptyLedger(),
      party: [],
      withoutYou: null,
    },
  ).stats;

  it('rewards clean, fast fights and punishes downs', () => {
    expect(Run.grade('defeat', base, 10, 80)).toBe('D');
    const flawless = {
      ...base,
      perfects: 4,
      saves: 2,
      telegraphsAimed: 10,
      telegraphsAnswered: 10,
    };
    expect(['S', 'A']).toContain(Run.grade('victory', flawless, 40, 80));
    const messy = { ...base, downs: 3, deaths: 1 };
    expect(['C', 'D']).toContain(Run.grade('victory', messy, 160, 80));
  });
});

describe('save v1', () => {
  it('round-trips through storage and falls back to the backup', () => {
    const store = memoryStore();
    const run = Run.embark(Run.newRun(11));
    saveRun(store, run);
    expect(loadRun(store)).toEqual(run);
    const next = Run.chooseNode(run, Run.reachable(run)[0]!.id);
    saveRun(store, next);
    store.data.set('aetherweaver.run', '{"broken"');
    expect(loadRun(store)).toEqual(run);
    saveRun(store, null);
    expect(loadRun(store)).toBeNull();
  });

  it('rejects saves that name content this build does not have, falling back to the backup', () => {
    const store = memoryStore();
    const run = Run.embark(Run.newRun(12));
    saveRun(store, run);
    saveRun(store, { ...run, chords: [{ auras: ['staccato'], ornaments: [] }] });
    expect(loadRun(store)).toEqual(run);
    store.data.delete('aetherweaver.run.bak');
    expect(loadRun(store)).toBeNull();
  });

  it('saving unchanged state keeps the backup one step behind', () => {
    const store = memoryStore();
    const a = Run.embark(Run.newRun(13));
    const b = Run.chooseNode(a, Run.reachable(a)[0]!.id);
    saveRun(store, a);
    saveRun(store, b);
    saveRun(store, b);
    expect(JSON.parse(store.data.get('aetherweaver.run.bak')!)).toEqual(a);
  });

  it('rejects saves that fail validation', () => {
    const store = memoryStore();
    store.data.set('aetherweaver.run', JSON.stringify({ version: 99 }));
    expect(loadRun(store)).toBeNull();
  });
});

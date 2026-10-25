import { describe, expect, it } from 'vitest';
import { CONTENT, relicCurse, relicDef, relicText, runEventDef } from '../src/content';
import {
  FIGHT_AETHER,
  FORGE_PRICE,
  GRADE_AETHER,
  RELIC_OFFERS,
  SHOP_HEAL,
  threatFor,
} from '../src/meta/economy';
import * as Run from '../src/meta/run';
import type { ShopItem } from '../src/meta/types';
import { createSim } from '../src/sim';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { pulsed, relicHuds, type RelicSource } from '../src/ui/hud/relics';
import {
  eventAfter,
  eventFightResultRun,
  eventRun,
  forgeAfter,
  forgeRun,
  merchantRun,
  mockHud,
  relicOfferRun,
} from '../src/ui/lab/mock';
import {
  aetherDelta,
  aetherEarned,
  aetherLine,
  boonInfo,
  choiceInfo,
  eventMotifTargets,
  eventPreview,
  forgeServiceStatus,
  gainLines,
  motifStep,
  nextStep,
  relicInfo,
  relicOfferCopy,
  relicSentence,
  rewardChips,
  shopItemStatus,
  songsLine,
  threatLine,
} from '../src/ui/screens/interlude';

const elite = { draft: 'rare', heal: 0.2, aether: 35, relics: 2, threat: 1, text: '' } as const;

describe('Aether', () => {
  it('formats gains and losses', () => {
    expect(aetherDelta(20)).toBe('+20 Aether');
    expect(aetherDelta(-40)).toBe('−40 Aether');
  });

  it('explains a fight’s Aether from economy.ts', () => {
    const won = aetherLine({ kind: 'elite', outcome: 'victory', grade: 'A', aether: 46 });
    expect(won).toEqual({
      headline: '+46 Aether',
      detail: `${FIGHT_AETHER.elite} for the win × ${GRADE_AETHER.A} for grade A`,
    });
    expect(
      aetherLine({ kind: 'skirmish', outcome: 'victory', grade: 'C', aether: 20 })!.detail,
    ).toBe(`${FIGHT_AETHER.skirmish} for the win`);
    expect(aetherLine({ kind: 'skirmish', outcome: 'defeat', grade: 'D', aether: 0 })).toEqual({
      headline: '+0 Aether',
      detail: 'A loss pays nothing.',
    });
    // The Hollow Cantor pays nothing: no line at all.
    expect(aetherLine({ kind: 'boss', outcome: 'victory', grade: 'S', aether: 0 })).toBeNull();
  });

  it('sums what the run’s fights paid', () => {
    const run = eventFightResultRun();
    expect(aetherEarned(run)).toBe(run.results.reduce((s, r) => s + r.aether, 0));
    expect(aetherEarned(run)).toBeGreaterThan(0);
  });
});

describe('map tooltips', () => {
  it('previews Aether and relics', () => {
    const chips = rewardChips(elite).map((c) => c.text);
    expect(chips).toContain(`+${elite.aether} Aether, more for a good grade`);
    expect(chips).toContain(`Choose 1 of ${elite.relics} relics`);
    expect(chips).toContain('Rare+ motif');
    expect(chips).toContain('+20% life');
  });

  it('every node on a real map gets the right chips', () => {
    const run = Run.newRun(5);
    for (const node of run.map.rows.flat()) {
      const chips = rewardChips(node.reward);
      expect(chips.some((c) => c.icon === 'aether')).toBe(node.reward.aether > 0);
      expect(chips.some((c) => c.icon === 'relic')).toBe(node.reward.relics > 0);
      if (node.kind === 'elite')
        expect(chips.map((c) => c.text)).toContain(
          `Choose 1 of ${RELIC_OFFERS.elite.count} relics`,
        );
      if (node.kind === 'miniboss')
        expect(chips.map((c) => c.text)).toContain(`Choose 1 of ${RELIC_OFFERS.boss.count} relics`);
      if (node.kind === 'event') {
        const p = eventPreview(node.eventId)!;
        expect(p).toEqual({
          name: runEventDef(node.eventId!).name,
          teaser: runEventDef(node.eventId!).teaser,
        });
      }
    }
  });

  it('threat is quiet at ×1 and reads from the node', () => {
    expect(threatLine(1)).toBeNull();
    const t = threatFor(7);
    const pct = Math.round((t - 1) * 100);
    expect(threatLine(t)).toBe(`Threat: enemies +${pct}% life`);
    expect(threatLine(t, true)).toBe(`Threat: any fight here, enemies +${pct}% life`);
    const run = Run.newRun(3);
    const boss = run.map.rows.flat().find((n) => n.kind === 'miniboss')!;
    expect(threatLine(boss.reward.threat)).toContain(
      `+${Math.round((boss.reward.threat - 1) * 100)}%`,
    );
  });
});

describe('relics and boons', () => {
  it('fills the rule and the curse from content', () => {
    for (const def of CONTENT.relics) {
      const info = relicInfo(def.id);
      expect(info.rule).toBe(relicText(def));
      expect(info.curse).toBe(relicCurse(def));
      expect(info.rule).not.toMatch(/\{/);
    }
  });

  it('a cleansed curse is still shown, marked as lifted', () => {
    const info = relicInfo('heavy_score', true);
    expect(info.cleansed).toBe(true);
    expect(relicSentence(info)).toContain('Its curse is lifted (was: ');
    expect(relicSentence(relicInfo('heavy_score'))).toContain(
      `Curse: ${relicCurse(relicDef('heavy_score'))}`,
    );
    // Only cursed relics can be cleansed.
    expect(relicInfo('tuning_fork', true).cleansed).toBe(false);
  });

  it('says how long a boon lasts', () => {
    expect(boonInfo({ id: 'last_note', fights: 2 }).left).toBe('2 fights left');
    expect(boonInfo({ id: 'last_note', fights: 1 }).left).toBe('1 fight left');
    expect(boonInfo({ id: 'frayed_spirit', fights: null }).left).toBe('The rest of the run');
    expect(boonInfo({ id: 'frayed_spirit', fights: null }).kind).toBe('bane');
  });

  it('titles relic offers by why they are offered', () => {
    expect(relicOfferCopy(relicOfferRun('elite').relicOffer!).title).toBe('A relic for the taking');
    expect(relicOfferCopy(relicOfferRun('boss').relicOffer!).title).toBe('The Warden’s hoard');
    const ev = relicOfferCopy(relicOfferRun('event').relicOffer!, 'The Unsung Choir');
    expect(ev.eyebrow).toBe('The Unsung Choir');
    expect(ev.blurb).toContain('Choose 1 of 3');
  });

  it('after an event’s fight, Continue says a relic is next', () => {
    const run = eventFightResultRun();
    expect(run.phase).toBe('result');
    expect(run.lastResult!.name).toBe('The Unsung Choir');
    expect(nextStep(run)).toBe('Continue: choose a relic');
    const next = Run.continueFromResult(run);
    expect(next.phase).toBe('relic');
    expect(next.relicOffer!.reason).toBe('event');
  });
});

describe('merchant', () => {
  it('marks sold, affordable and unaffordable items with a reason', () => {
    const run = merchantRun();
    const items = run.shop!.items;
    const sold = items.find((i) => i.sold)!;
    expect(shopItemStatus(run, sold)).toEqual({ available: false, problem: 'Sold' });
    const dear = items.find((i) => !i.sold && i.price > run.aether)!;
    expect(shopItemStatus(run, dear)).toEqual({
      available: false,
      problem: `Needs ${dear.price - run.aether} more Aether`,
    });
    const cheap = items.find((i) => !i.sold && i.price <= run.aether)!;
    expect(shopItemStatus(run, cheap)).toEqual({ available: true, problem: null });
    // The run agrees: buying the dear one does nothing, the cheap one works.
    expect(Run.buy(run, items.indexOf(dear))).toBe(run);
    expect(Run.buy(run, items.indexOf(cheap)).aether).toBe(run.aether - cheap.price);
  });

  it('a real shop’s healing is priced from economy.ts', () => {
    // A shop the run layer stocks itself, not the lab's hand-made one.
    let run = Run.embark(Run.newRun(5));
    const target = run.map.rows.flat().find((n) => n.kind === 'merchant')!;
    const before = run.map.rows[target.row - 1]!.find((n) => n.next.includes(target.id))!;
    run = Run.chooseNode({ ...run, path: [before.id] }, target.id);
    expect(run.phase).toBe('merchant');
    const heal = run.shop!.items.find((i: ShopItem) => i.kind === 'heal')!;
    expect(heal.price).toBe(SHOP_HEAL.price);
    expect(heal.heal).toBe(SHOP_HEAL.pct);
  });
});

describe('forge', () => {
  it('every service is open with Aether and a target', () => {
    const run = forgeRun();
    for (const s of ['temper', 'retune', 'cleanse'] as const) {
      const st = forgeServiceStatus(run, s);
      expect(st.available, s).toBe(true);
      expect(st.price).toBe(FORGE_PRICE[s]);
      expect(st.targets).toEqual(Run.forgeTargets(run, s));
    }
  });

  it('explains why a service is closed', () => {
    const run = forgeRun({ aether: 25, curse: false });
    expect(forgeServiceStatus(run, 'temper').problem).toBe(
      `Needs ${FORGE_PRICE.temper - 25} more Aether`,
    );
    expect(forgeServiceStatus(run, 'retune').available).toBe(true);
    expect(forgeServiceStatus(run, 'cleanse').problem).toBe('You carry no curse.');
    const bare = { ...forgeRun(), motifs: [] };
    expect(forgeServiceStatus(bare, 'temper').problem).toBe('You have no motifs yet.');
  });

  it('one service per visit', () => {
    const { run } = forgeAfter('cleanse');
    expect(forgeServiceStatus(run, 'cleanse').problem).toBe('Done');
    expect(forgeServiceStatus(run, 'temper').problem).toBe(
      'The forge has cooled: one service per visit.',
    );
    expect(run.relics.find((r) => r.id === 'heavy_score')!.cleansed).toBe(true);
  });

  it('temper shows level n → n+1 and the lines', () => {
    const { run, result } = forgeAfter('temper');
    if (result.service !== 'temper') throw new Error('temper');
    const step = result.step;
    expect(step.to).toBe(step.from + 1);
    expect(step.now).toBe(Run.motifLine(step.motifId, step.from));
    expect(step.next).toBe(Run.motifLine(step.motifId, step.to));
    expect(run.motifs.find((m) => m.id === step.motifId)!.level).toBe(step.to);
  });

  it('motif steps cap at the last level', () => {
    const run = forgeRun();
    const m = run.motifs[0]!;
    const max = CONTENT.motifs.find((x) => x.id === m.id)!.values.length;
    expect(motifStep(run, m.id, 99).to).toBe(max);
  });
});

describe('events', () => {
  it('greys choices with the run’s own sentence', () => {
    const run = eventRun('broken_loom', 25);
    const def = runEventDef('broken_loom');
    const mend = choiceInfo(
      run,
      def.id,
      def.choices.find((c) => c.id === 'mend')!,
    );
    expect(mend.problem).toBe(Run.eventChoiceProblem(run, 'mend'));
    expect(mend.problem).toBe('Needs 40 Aether.');
    expect(mend.tags.map((t) => t.text)).toContain('Costs 40 Aether');
    const salvage = choiceInfo(
      run,
      def.id,
      def.choices.find((c) => c.id === 'salvage')!,
    );
    expect(salvage.problem).toBeNull();
  });

  it('says a gamble’s odds, a fight and a retune', () => {
    const run = eventRun('shrine_of_discord');
    const offer = runEventDef('shrine_of_discord').choices.find((c) => c.id === 'offer')!;
    const info = choiceInfo(run, 'shrine_of_discord', offer);
    expect(info.odds).toEqual({ win: 60, lose: 40 });
    expect(info.motif).toBe('upgradable');
    const fight = runEventDef('unsung_choir').choices.find((c) => c.id === 'fight')!;
    expect(choiceInfo(run, 'unsung_choir', fight).fight).toBe(true);
    const retune = runEventDef('tuning_pool').choices.find((c) => c.id === 'retune')!;
    expect(choiceInfo(run, 'tuning_pool', retune).retune).toBe(true);
  });

  it('only offers motifs that can still grow', () => {
    const run = eventRun('shrine_of_discord');
    const maxed = run.motifs[0]!;
    const max = CONTENT.motifs.find((m) => m.id === maxed.id)!.values.length;
    const at = {
      ...run,
      motifs: run.motifs.map((m) => (m.id === maxed.id ? { ...m, level: max } : m)),
    };
    expect(eventMotifTargets(at, 'upgradable')).not.toContain(maxed.id);
    expect(eventMotifTargets(at, 'any')).toContain(maxed.id);
    expect(eventMotifTargets(at, 'none')).toEqual([]);
  });

  it('summarises gains: a relic and a bane', () => {
    const run = eventAfter('wounded_cantor', 'mend');
    const lines = gainLines(run.event!.gains!, run);
    expect(run.event!.gains!.relics).toHaveLength(1);
    expect(lines[0]!.text).toContain('is yours.');
    const bane = lines.find((l) => l.glyph === 'frayed')!;
    expect(bane.tone).toBe('bad');
    expect(bane.text).toContain('for the rest of the run');
  });

  it('a lost gamble loses the motif, a won one levels it', () => {
    const lost = eventAfter('shrine_of_discord', 'offer', { won: false });
    expect(lost.event!.won).toBe(false);
    const gone = lost.event!.gains!.lostMotif!;
    expect(gainLines(lost.event!.gains!, lost)).toContainEqual({
      icon: 'close',
      text: `${CONTENT.motifs.find((m) => m.id === gone)!.name} is lost.`,
      tone: 'bad',
    });
    const won = eventAfter('shrine_of_discord', 'offer', { won: true });
    expect(won.event!.won).toBe(true);
    expect(gainLines(won.event!.gains!, won)[0]!.text).toMatch(/rises, level \d → \d/);
  });

  it('heal, hurt, Aether, retune and nothing', () => {
    // The lines say what really happened, hero by hero, when a cap or the floor got in the way.
    const bathe = eventAfter('tuning_pool', 'bathe');
    const healed = bathe.party.map((h, i) =>
      Math.round((h.hpPct - bathe.event!.gains!.before[i]!) * 100),
    );
    expect(gainLines(bathe.event!.gains!, bathe)[0]!.text).toBe(
      healed.every((d) => d === 25)
        ? 'Every hero healed 25% of their life.'
        : `The party healed up to 25% of their life: ${bathe.party
            .map((h, i) => `${CONTENT.heroes.find((x) => x.id === h.heroId)!.name} ${healed[i]}%`)
            .join(', ')}.`,
    );
    const full = { ...bathe, party: bathe.party.map((h) => ({ ...h, hpPct: 0.5 })) };
    const even = { ...bathe.event!.gains!, before: full.party.map(() => 0.25) };
    expect(gainLines(even, full)[0]!.text).toBe('Every hero healed 25% of their life.');
    const blood = eventAfter('merchant_of_silences', 'blood');
    expect(
      gainLines(blood.event!.gains!, blood)
        .map((l) => l.text)
        .join(' '),
    ).toMatch(/lost (at most )?20% of their life/);
    const salvage = eventAfter('broken_loom', 'salvage');
    expect(gainLines(salvage.event!.gains!, salvage)[0]!.text).toBe('+35 Aether.');
    const retune = eventAfter('tuning_pool', 'retune');
    expect(retune.event!.gains!.retuned).toBe(true);
    expect(gainLines(retune.event!.gains!, retune).at(-1)!.text).toBe(songsLine(retune.chords));
    const slip = eventAfter('unsung_choir', 'slip');
    expect(gainLines(slip.event!.gains!, slip)).toEqual([
      { icon: 'info', text: 'Nothing changed.', tone: 'plain' },
    ]);
  });
});

describe('HUD relic bar', () => {
  const src = (over: Partial<RelicSource['relics']> = {}, time = 10): RelicSource => ({
    relics: {
      ids: ['cracked_metronome', 'silver_thimble', 'martyrs_veil', 'star_chart', 'heavy_score'],
      cleansed: ['heavy_score'],
      metronomeAt: 0,
      thimbleAt: 0,
      veil: true,
      ...over,
    },
    time,
    ledger: { perfects: 0, downs: 0 },
  });

  it('derives cooldowns, the Veil and passives from the world', () => {
    const huds = relicHuds(src({ metronomeAt: 15, thimbleAt: 0, veil: false }));
    const by = Object.fromEntries(huds.map((h) => [h.id, h]));
    // Run-only relics never show in a fight.
    expect(by.star_chart).toBeUndefined();
    expect(by.cracked_metronome).toMatchObject({ kind: 'cooldown', ready: false, remaining: 5 });
    expect(by.cracked_metronome!.total).toBe(relicDef('cracked_metronome').values.cooldown);
    expect(by.cracked_metronome!.label).toBe('Cracked Metronome: 5.0 s');
    expect(by.silver_thimble).toMatchObject({ kind: 'cooldown', ready: true, remaining: 0 });
    expect(by.martyrs_veil).toMatchObject({ kind: 'once', ready: false });
    expect(by.martyrs_veil!.label).toContain('spent');
    expect(by.heavy_score).toMatchObject({ kind: 'passive', cleansed: true });
  });

  it('flashes a relic exactly when it acts', () => {
    const a = relicHuds(src());
    const b = relicHuds(src({ metronomeAt: 22 }));
    expect(pulsed(a, b)).toEqual(['cracked_metronome']);
    const c = relicHuds(src({ metronomeAt: 22, veil: false }));
    expect(pulsed(b, c)).toEqual(['martyrs_veil']);
    expect(pulsed(c, c)).toEqual([]);
    const fork = (perfects: number) =>
      relicHuds({ ...src({ ids: ['tuning_fork'] }), ledger: { perfects, downs: 0 } });
    expect(pulsed(fork(1), fork(2))).toEqual(['tuning_fork']);
    // From a real sim, the relic's own count drives it: a Perfect that charged nothing doesn't.
    const counted = (triggers: number, perfects: number) =>
      relicHuds({
        ...src({ ids: ['tuning_fork'], triggers: { tuning_fork: triggers } }),
        ledger: { perfects, downs: 0 },
      });
    expect(pulsed(counted(1, 1), counted(1, 2))).toEqual([]);
    expect(pulsed(counted(1, 2), counted(2, 3))).toEqual(['tuning_fork']);
  });

  it('the bridge reads WorldState.relics', () => {
    const sim = createSim({
      seed: 3,
      encounter: 'first_light',
      relics: ['cracked_metronome', { id: 'glass_halo', cleansed: true }, 'martyrs_veil'],
    });
    const hud = buildHudSnapshot(sim.state, { seed: 3, hovered: null });
    expect(hud.relics.map((r) => r.id)).toEqual([
      'cracked_metronome',
      'glass_halo',
      'martyrs_veil',
    ]);
    expect(hud.relics[0]).toMatchObject({ kind: 'cooldown', ready: true });
    expect(hud.relics[1]!.cleansed).toBe(true);
    expect(hud.relics[2]).toMatchObject({ kind: 'once', ready: true });
    // Without relics, the bar is empty.
    expect(
      buildHudSnapshot(createSim({ seed: 3 }).state, { seed: 3, hovered: null }).relics,
    ).toEqual([]);
  });

  it('the lab mocks cover ready, cooling, spent and cleansed', () => {
    const states = [...mockHud('relics').relics, ...mockHud('relics-waiting').relics];
    expect(states.some((r) => r.kind === 'cooldown' && r.ready)).toBe(true);
    expect(states.some((r) => r.kind === 'cooldown' && !r.ready)).toBe(true);
    expect(states.some((r) => r.kind === 'once' && r.ready)).toBe(true);
    expect(states.some((r) => r.kind === 'once' && !r.ready)).toBe(true);
    expect(states.some((r) => r.cleansed)).toBe(true);
    expect(mockHud('calm').relics).toEqual([]);
  });
});

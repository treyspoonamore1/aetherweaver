import { CONTENT, curseText, inscriptionText } from '../../content';
import { UNLOCKS } from '../../meta/profile';
import { craftOdds } from '../../meta/reliquary';
import { AstrolabeGlyph } from '../kit/AstrolabeGlyph';
import { Chip } from '../kit/Chip';
import { Icon } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import {
  CARRIED_LOOK,
  DISSONANCE_LOOK,
  FRACTURED_LOOK,
  SHARD_LOOK,
  TEAR_LOOK,
  categoryLook,
} from '../kit/reliquaryLook';
import { InstabilityBar, PanelLabel, TierBadge } from './ReliquaryParts';
import {
  DISSONANCE_KINDS,
  DORMANT_LINE,
  ROLE_LINE,
  andList,
  blankRelic,
  codexEmpowered,
  codexInscriptions,
  dissonateChances,
  fractureExamples,
  instabilityView,
  materialsHow,
  num,
  oddsText,
  shardsText,
  tearsText,
  tierLabel,
} from './reliquaryModel';

const GRID = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(22rem,1fr))]';

/** A relic of content that a Dissonate can Empower, and one it can't (for their odds). */
function sampleRelics() {
  const grows = CONTENT.relics.find((d) => d.empowered) ?? CONTENT.relics[0]!;
  const still = CONTENT.relics.find((d) => !d.empowered) ?? null;
  return { grows, still };
}

/** Ascend's chance from each tier it can rise from now (`craftOdds`, as the screen shows it). */
function ascendLadder(): { from: number; p: number }[] {
  const cap = CONTENT.reliquary.tierCap;
  const id = CONTENT.inscriptions.find((d) => d.kind === 'normal')!.id;
  const out: { from: number; p: number }[] = [];
  for (let tier = 5; tier > cap; tier--) {
    const relic = { ...blankRelic(CONTENT.relics[0]!.id), inscriptions: [{ id, tier, value: 0 }] };
    out.push({ from: tier, p: craftOdds(relic, 'ascend', 0).success ?? 0 });
  }
  return out;
}

/**
 * The Codex's Reliquary (Phase 4c): its rules (enshrine, carry and attunement, the crafts,
 * Instability and Fracture, Dissonate's outcomes), every Inscription with its five tiers, the
 * Dissonant Inscriptions and the curses, and the relics a Dissonate can Empower. All from content
 * and meta. Locked until the Reliquary opens (Rank 10, or Skip the unlocks).
 */
export function ReliquaryCodexPage({ open, rank }: { open: boolean; rank: number }) {
  const rules = CONTENT.reliquary;
  const unlock = UNLOCKS.find((u) => u.kind === 'reliquary');
  const openRank = rules.slotRanks[0]!;
  if (!open) {
    return (
      <Panel tone="solid" className="border-dashed p-6" data-testid="codex-reliquary-locked">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-gold-200">
            <Icon name="reliquary" size={26} /> The Reliquary
          </h2>
          <Chip icon="lock">Rank {openRank}</Chip>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text">{unlock?.text}</p>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
          <Icon name="lock" size={14} /> It opens at Weaver Rank {openRank} (you’re Rank {rank}).
          Its rules wait here until then, or turn on Settings → Skip the unlocks.
        </p>
      </Panel>
    );
  }
  const how = materialsHow();
  const { grows, still } = sampleRelics();
  const growsOdds = dissonateChances(blankRelic(grows.id));
  const stillOdds = still ? craftOdds(blankRelic(still.id), 'dissonate').outcomes! : null;
  const empowered = codexEmpowered();
  const ladder = ascendLadder();
  const enshrine = rules.enshrineInscriptions;
  const release = rules.release;
  const above = rules.fracture.above;
  const demo = blankRelic(grows.id, Math.min(100, above + 20));
  return (
    <div className="flex flex-col gap-6" data-testid="codex-reliquary">
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
        <Panel tone="gold" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="reliquary" size={22} /> The Reliquary
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Relics that outlive their runs. <b>Enshrine:</b> a won run’s Summary lets you keep one
            relic it found (not one it carried in). It arrives with its first Inscriptions:{' '}
            {enshrine.common} for a common, {enshrine.rare} for a rare, {enshrine.legendary} for a
            legendary and {enshrine.cursed} for a cursed relic, rolled as Inscribe rolls them but
            adding no Instability. A cursed relic a Forge cleansed comes cleansed. The Reliquary
            holds {rules.capacity}; a full one must release a relic before it takes another. The
            same relic can be enshrined more than once: each is its own.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text">
            <b>Carry:</b> in Prep, choose up to{' '}
            {rules.slotRanks.map((r, i) => `${i + 1} at Rank ${r}`).join(', ')}, never two of the
            same relic. They’re yours from the first fight, and the run’s offers won’t give them
            again. Embarking copies them, Inscriptions and all: crafting later doesn’t change a run
            under way. The Training Grounds use the relics you’ve chosen, so you can try them first.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text" data-testid="codex-attunement">
            <b style={{ color: CARRIED_LOOK.color }}>Attunement:</b> the relic in the first slot is{' '}
            <b>attuned</b>: its own effect (Empowered, if a Dissonate Empowered it) and its
            Inscriptions. The others are <b>dormant</b>: their own effect sleeps, a cursed relic’s
            own curse with it, so a Forge has nothing to lift; they lend the run their Inscriptions,
            a Dissonant one and a Reliquary curse. Choose which to attune by reordering the carry.
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
            <Icon
              name="shard"
              size={13}
              className="mt-px shrink-0"
              style={{ color: SHARD_LOOK.color }}
            />
            <span>
              <b className="text-text">Tuning Shards.</b> {how.shards}
            </span>
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
            <Icon
              name="tear"
              size={13}
              className="mt-px shrink-0"
              style={{ color: TEAR_LOOK.color }}
            />
            <span>
              <b className="text-text">Discord Tears.</b> {how.tears}
            </span>
          </p>
        </Panel>
        <Panel tone="solid" className="p-4">
          <PanelLabel>The carry</PanelLabel>
          <ol className="mt-2 flex flex-col gap-1.5 text-sm">
            {rules.slotRanks.map((r, i) => (
              <li key={r} className="flex items-start gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${i === 0 ? 'border-gold-300 text-gold-200' : 'border-ink-500 text-muted'}`}
                >
                  {i + 1}
                </span>
                <span className="leading-snug">
                  <b className="text-text">Rank {r}</b>{' '}
                  <span className="text-muted">· {ROLE_LINE[i === 0 ? 'attuned' : 'lends']}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs leading-snug text-muted">{DORMANT_LINE}</p>
        </Panel>
      </div>

      <Panel tone="solid" className="p-5" data-testid="codex-crafts">
        <h3 className="font-display text-lg font-bold text-gold-300">The crafts</h3>
        <p className="mt-1 text-sm text-muted">
          Between runs, on the Reliquary’s screen. Each shows its cost, its odds and its chance to
          Fracture before you commit; its roll is seeded and saved, so reloading can’t roll it
          again.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-1 pr-3 font-semibold">Craft</th>
                <th className="py-1 pr-3 font-semibold">Cost</th>
                <th className="py-1 pr-3 font-semibold">What it does</th>
                <th className="py-1 font-semibold">Instability</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t border-ink-600/70" data-craft="inscribe">
                <td className="py-2 pr-3 font-semibold text-text">Inscribe</td>
                <td className="py-2 pr-3 font-mono text-text">{shardsText(rules.inscribe.cost)}</td>
                <td className="py-2 pr-3 text-text">
                  Adds a random Inscription of the kind you choose (one it doesn’t have), up to{' '}
                  {rules.maxInscriptions}:{' '}
                  {rules.inscribe.tierOdds
                    .map((p, i) => (p > 0 ? `${tierLabel(5 - i)} ${num(p)}%` : null))
                    .filter(Boolean)
                    .join(', ')}
                  .
                </td>
                <td className="py-2 font-mono text-text">+{rules.inscribe.instability}</td>
              </tr>
              <tr className="border-t border-ink-600/70" data-craft="retune">
                <td className="py-2 pr-3 font-semibold text-text">Retune</td>
                <td className="py-2 pr-3 font-mono text-text">{shardsText(rules.retune.cost)}</td>
                <td className="py-2 pr-3 text-text">
                  Rolls one Inscription’s value again within its tier, every value as likely.
                </td>
                <td className="py-2 font-mono text-text">+{rules.retune.instability}</td>
              </tr>
              <tr className="border-t border-ink-600/70" data-craft="ascend">
                <td className="py-2 pr-3 font-semibold text-text">Ascend</td>
                <td className="py-2 pr-3 font-mono text-text">{shardsText(rules.ascend.cost)}</td>
                <td className="py-2 pr-3 text-text">
                  Tries to raise one Inscription a tier:{' '}
                  {ladder
                    .map((l) => `${tierLabel(l.from)} → ${tierLabel(l.from - 1)} ${oddsText(l.p)}`)
                    .join(', ')}
                  . A miss changes nothing (the cost and Instability are spent).{' '}
                  {tierLabel(rules.tierCap - 1)} and {tierLabel(1)} wait for Dissonance.
                </td>
                <td className="py-2 font-mono text-text">+{rules.ascend.instability}</td>
              </tr>
              <tr className="border-t border-ink-600/70" data-craft="dissonate">
                <td className="py-2 pr-3 font-semibold text-text">Dissonate</td>
                <td className="py-2 pr-3 font-mono text-text">{tearsText(rules.dissonate.cost)}</td>
                <td className="py-2 pr-3 text-text">
                  The final gamble (below). It never Fractures, and the relic can’t be crafted
                  afterwards.
                </td>
                <td className="py-2 font-mono text-muted">—</td>
              </tr>
              <tr className="border-t border-ink-600/70" data-craft="release">
                <td className="py-2 pr-3 font-semibold text-text">Release</td>
                <td className="py-2 pr-3 font-mono text-muted">—</td>
                <td className="py-2 pr-3 text-text">
                  The relic leaves for Tuning Shards: {release.common} for a common, {release.rare}{' '}
                  for a rare, {release.cursed} for a cursed relic, {release.legendary} for a
                  legendary, and {release.perInscription} more for each Inscription.
                </td>
                <td className="py-2 font-mono text-muted">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel tone="solid" className="p-5" data-testid="codex-fracture">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-gold-300">
            <Icon name="crack" size={20} style={{ color: FRACTURED_LOOK.color }} /> Instability and
            Fracture
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Instability runs 0–100 and only rises. Past {above}, every craft but a Dissonate (its
            own gamble) first risks a <b style={{ color: FRACTURED_LOOK.color }}>Fracture</b>:{' '}
            {num(rules.fracture.perPoint)}% for each point past it, so{' '}
            {andList(fractureExamples().map((e) => `${oddsText(e.p)} at ${e.at}`))}. A fractured
            relic freezes as it was, and the craft and its cost are lost. It still works, and can
            still be carried. The odds are always shown.
          </p>
          <div className="mt-3 max-w-md">
            <InstabilityBar view={instabilityView(demo)} />
            <p className="mt-1 text-xs text-muted">
              At {demo.instability}, Inscribe, Retune and Ascend each risk{' '}
              {oddsText(instabilityView(demo).fracture)}. A Dissonate never Fractures.
            </p>
          </div>
        </Panel>
        <Panel tone="solid" className="p-5" data-testid="codex-dissonate">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-gold-300">
            <Icon name="dissonate" size={20} style={{ color: DISSONANCE_LOOK.dissonant.color }} />{' '}
            Dissonate
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {growsOdds.map((c) => {
              const look = DISSONANCE_LOOK[c.key as (typeof DISSONANCE_KINDS)[number]];
              return (
                <li key={c.key} className="flex items-start gap-2 text-sm" data-outcome={c.key}>
                  <Icon
                    name={look.icon}
                    size={16}
                    className="mt-0.5 shrink-0"
                    style={{ color: look.color }}
                  />
                  <span className="leading-snug">
                    <b style={{ color: look.color }}>{c.label}</b>{' '}
                    <span className="font-mono text-text">{c.text}</span>{' '}
                    <span className="text-muted">
                      {c.key === 'empowered'
                        ? 'Its own effect grows (the relics below).'
                        : c.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {still && stillOdds && (
            <p className="mt-2 text-xs text-muted">
              A relic with no numbers to grow turns Dissonant instead: for {still.name},{' '}
              {DISSONANCE_KINDS.map(
                (k) => `${DISSONANCE_LOOK[k].label} ${oddsText(stillOdds[k])}`,
              ).join(', ')}
              .
            </p>
          )}
        </Panel>
      </div>

      <section aria-label="Inscriptions" data-testid="codex-inscriptions">
        <h3 className="mb-1 font-display text-lg font-bold text-gold-300">Inscriptions</h3>
        <p className="mb-3 max-w-4xl text-sm text-muted">
          Up to {rules.maxInscriptions} on a relic (and a Dissonant one), never the same twice. A
          tier is a range: the value rolls within it. They add to the Astrolabe’s own sums.{' '}
          {tierLabel(rules.tierCap - 1)} and {tierLabel(1)} can’t be reached yet, except by a
          Dissonate gone Cursed: they wait for Dissonance.
        </p>
        <div className={GRID}>
          {codexInscriptions().map((group) => {
            const look = categoryLook(group.category);
            return (
              <Panel
                key={group.category}
                tone="solid"
                className="p-4"
                style={{ borderTopColor: look.color, borderTopWidth: 3 }}
              >
                <h4
                  className="flex items-center gap-2 font-display text-base font-bold"
                  style={{ color: look.color }}
                >
                  <AstrolabeGlyph glyph={look.glyph} size={18} /> {look.name}
                  <span className="font-sans text-sm font-normal text-muted">{look.blurb}</span>
                </h4>
                <ul className="mt-2 flex flex-col gap-2.5">
                  {group.rows.map((row) => (
                    <li key={row.id} data-inscription={row.id}>
                      <p className="text-sm">
                        <b className="text-text">{row.name}</b>{' '}
                        <span className="text-muted">{row.text}</span>
                      </p>
                      <ol className="mt-1 grid grid-cols-5 gap-1">
                        {row.tiers.map((t) => (
                          <li
                            key={t.tier}
                            className={`flex flex-col items-center gap-0.5 rounded-md bg-ink-900/70 py-1 ${t.reachable ? '' : 'opacity-70'}`}
                            title={
                              t.reachable
                                ? undefined
                                : 'Waits for Dissonance (or a Cursed Dissonate)'
                            }
                          >
                            <TierBadge tier={t.tier} size="sm" />
                            <span className="font-mono text-[11px] text-text">{t.text}</span>
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel tone="solid" className="p-5" data-testid="codex-dissonant">
          <h3
            className="font-display text-lg font-bold"
            style={{ color: DISSONANCE_LOOK.dissonant.color }}
          >
            Dissonant Inscriptions
          </h3>
          <p className="mt-1 text-sm text-muted">
            One of these fills a fifth slot when a Dissonate goes Dissonant.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {CONTENT.inscriptions
              .filter((d) => d.kind === 'dissonant')
              .map((d) => (
                <li key={d.id} className="flex items-start gap-2 text-sm" data-dissonant={d.id}>
                  <span
                    style={{ color: categoryLook(d.category).color }}
                    className="mt-0.5 shrink-0"
                  >
                    <AstrolabeGlyph glyph={categoryLook(d.category).glyph} size={15} />
                  </span>
                  <span>
                    <b className="text-text">{d.name}</b>{' '}
                    <span className="text-muted">{inscriptionText(d)}</span>
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
        <Panel tone="solid" className="p-5" data-testid="codex-curses">
          <h3
            className="font-display text-lg font-bold"
            style={{ color: DISSONANCE_LOOK.cursed.color }}
          >
            Curses
          </h3>
          <p className="mt-1 text-sm text-muted">
            One of these joins a relic when a Dissonate goes Cursed (and its Inscriptions rise a
            tier, as far as {tierLabel(rules.dissonate.cursedTierCap)}). A curse is an affix: a
            dormant relic still lends it.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {CONTENT.curses.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm" data-curse={c.id}>
                <Icon
                  name="skull"
                  size={15}
                  className="mt-0.5 shrink-0"
                  style={{ color: DISSONANCE_LOOK.cursed.color }}
                />
                <span>
                  <b className="text-text">{c.name}</b>{' '}
                  <span className="text-muted">{curseText(c)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel tone="solid" className="p-5" data-testid="codex-empowered">
        <h3
          className="font-display text-lg font-bold"
          style={{ color: DISSONANCE_LOOK.empowered.color }}
        >
          Empowered relics
        </h3>
        <p className="mt-1 text-sm text-muted">
          What an Empowered relic plays, attuned. {andList(empowered.none)} have no numbers to grow.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-1 pr-3 font-semibold">Relic</th>
                <th className="py-1 pr-3 font-semibold">Its effect</th>
                <th className="py-1 font-semibold">Empowered</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {empowered.rows.map((r) => (
                <tr key={r.id} className="border-t border-ink-600/70" data-empowered={r.id}>
                  <td className="py-1.5 pr-3 font-semibold text-text">{r.name}</td>
                  <td className="py-1.5 pr-3 text-muted">{r.text}</td>
                  <td className="py-1.5" style={{ color: DISSONANCE_LOOK.empowered.color }}>
                    {r.empowered}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

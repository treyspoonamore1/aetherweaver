import { CONTENT, curseText, inscriptionText } from '../../content';
import { UNLOCKS } from '../../meta/profile';
import { band, craftOdds } from '../../meta/reliquary';
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
  dormantLine,
  ROLE_LINE,
  andList,
  blankRelic,
  codexEmpowered,
  codexInscriptions,
  depthForTier,
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
import { bandsSentence, oddsLine } from './dissonanceModel';
import { t as txt } from '../text';

const GRID = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(22rem,1fr))]';

/** A relic of content that a Dissonate can Empower, and one it can't (for their odds). */
function sampleRelics() {
  const grows = CONTENT.relics.find((d) => d.empowered) ?? CONTENT.relics[0]!;
  const still = CONTENT.relics.find((d) => !d.empowered) ?? null;
  return { grows, still };
}

/**
 * Ascend's chance from each tier it can rise from (`craftOdds`, as the screen shows it), on a
 * relic won deep enough to reach T1; with the depth each rise needs (Phase 4d; 0: any relic).
 */
function ascendLadder(): { from: number; p: number; depth: number }[] {
  const deepest = Math.max(0, ...CONTENT.reliquary.bands.map((b) => b.depth));
  const top = band(deepest).tierCap;
  const id = CONTENT.inscriptions.find((d) => d.kind === 'normal')!.id;
  const out: { from: number; p: number; depth: number }[] = [];
  for (let tier = 5; tier > top; tier--) {
    const relic = {
      ...blankRelic(CONTENT.relics[0]!.id),
      depth: deepest,
      inscriptions: [{ id, tier, value: 0 }],
    };
    out.push({
      from: tier,
      p: craftOdds(relic, 'ascend', 0).success ?? 0,
      depth: depthForTier(tier - 1) ?? deepest,
    });
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
            <Icon name="reliquary" size={26} /> {txt('screens.reliquaryCodex.theReliquary')}
          </h2>
          <Chip icon="lock">{txt('screens.reliquaryCodex.rank', { openRank })}</Chip>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text">{unlock?.text}</p>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
          <Icon name="lock" size={14} />{' '}
          {txt('screens.reliquaryCodex.itOpensAtWeaver', { openRank, rank })}
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
            <Icon name="reliquary" size={22} /> {txt('screens.reliquaryCodex.theReliquary')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            {txt('screens.reliquaryCodex.relicsThatOutliveTheir')}{' '}
            <b>{txt('screens.reliquaryCodex.enshrine')}</b>{' '}
            {txt('screens.reliquaryCodex.aWonRunS', {
              common: enshrine.common,
              rare: enshrine.rare,
              legendary: enshrine.legendary,
              cursed: enshrine.cursed,
              capacity: rules.capacity,
            })}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text">
            <b>{txt('screens.reliquaryCodex.carry')}</b>{' '}
            {txt('screens.reliquaryCodex.inPrepChooseUp', {
              slotRanks: rules.slotRanks
                .map((r, i) => txt('screens.reliquaryCodex.atRank', { value: i + 1, r }))
                .join(', '),
            })}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text" data-testid="codex-attunement">
            <b style={{ color: CARRIED_LOOK.color }}>{txt('screens.reliquaryCodex.attunement')}</b>{' '}
            {txt('screens.reliquaryCodex.theRelicInThe')}
            <b>{txt('screens.reliquaryCodex.attuned')}</b>
            {txt('screens.reliquaryCodex.itsOwnEffectEmpowered')}{' '}
            <b>{txt('screens.reliquaryCodex.dormant')}</b>
            {txt('screens.reliquaryCodex.theirOwnEffectSleeps')}
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
            <Icon
              name="shard"
              size={13}
              className="mt-px shrink-0"
              style={{ color: SHARD_LOOK.color }}
            />
            <span>
              <b className="text-text">{txt('screens.reliquaryCodex.tuningShards')}</b> {how.shards}
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
              <b className="text-text">{txt('screens.reliquaryCodex.discordTears')}</b> {how.tears}
            </span>
          </p>
        </Panel>
        <Panel tone="solid" className="p-4">
          <PanelLabel>{txt('screens.reliquaryCodex.theCarry')}</PanelLabel>
          <ol className="mt-2 flex flex-col gap-1.5 text-sm">
            {rules.slotRanks.map((r, i) => (
              <li key={r} className="flex items-start gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${i === 0 ? 'border-gold-300 text-gold-200' : 'border-ink-500 text-muted'}`}
                >
                  {i + 1}
                </span>
                <span className="leading-snug">
                  <b className="text-text">{txt('screens.reliquaryCodex.rank2', { r })}</b>{' '}
                  <span className="text-muted">· {ROLE_LINE[i === 0 ? 'attuned' : 'lends']}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs leading-snug text-muted">{dormantLine()}</p>
        </Panel>
      </div>

      <Panel tone="solid" className="p-5" data-testid="codex-crafts">
        <h3 className="font-display text-lg font-bold text-gold-300">
          {txt('screens.reliquaryCodex.theCrafts')}
        </h3>
        <p className="mt-1 text-sm text-muted">{txt('screens.reliquaryCodex.betweenRunsOnThe')}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-1 pr-3 font-semibold">{txt('screens.reliquaryCodex.craft')}</th>
                <th className="py-1 pr-3 font-semibold">{txt('screens.reliquaryCodex.cost')}</th>
                <th className="py-1 pr-3 font-semibold">
                  {txt('screens.reliquaryCodex.whatItDoes')}
                </th>
                <th className="py-1 font-semibold">{txt('screens.reliquaryCodex.instability')}</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t border-ink-600/70" data-craft="inscribe">
                <td className="py-2 pr-3 font-semibold text-text">
                  {txt('screens.reliquaryCodex.inscribe')}
                </td>
                <td className="py-2 pr-3 font-mono text-text">{shardsText(rules.inscribe.cost)}</td>
                <td className="py-2 pr-3 text-text">
                  {txt('screens.reliquaryCodex.addsARandomInscription', {
                    maxInscriptions: rules.maxInscriptions,
                    tierOdds: rules.inscribe.tierOdds
                      .map((p, i) => (p > 0 ? `${tierLabel(5 - i)} ${num(p)}%` : null))
                      .filter(Boolean)
                      .join(', '),
                    bands: rules.bands
                      .map((b) =>
                        txt('screens.reliquaryCodex.from', {
                          depth: b.depth,
                          oddsLine: oddsLine(b.depth),
                        }),
                      )
                      .join('; '),
                  })}
                </td>
                <td className="py-2 font-mono text-text">+{rules.inscribe.instability}</td>
              </tr>
              <tr className="border-t border-ink-600/70" data-craft="retune">
                <td className="py-2 pr-3 font-semibold text-text">
                  {txt('screens.reliquaryCodex.retune')}
                </td>
                <td className="py-2 pr-3 font-mono text-text">{shardsText(rules.retune.cost)}</td>
                <td className="py-2 pr-3 text-text">
                  {txt('screens.reliquaryCodex.rollsOneInscriptionS')}
                </td>
                <td className="py-2 font-mono text-text">+{rules.retune.instability}</td>
              </tr>
              <tr className="border-t border-ink-600/70" data-craft="ascend">
                <td className="py-2 pr-3 font-semibold text-text">
                  {txt('screens.reliquaryCodex.ascend')}
                </td>
                <td className="py-2 pr-3 font-mono text-text">{shardsText(rules.ascend.cost)}</td>
                <td className="py-2 pr-3 text-text">
                  {txt('screens.reliquaryCodex.triesToRaiseOne', {
                    ladder: ladder
                      .map(
                        (l) =>
                          `${tierLabel(l.from)} → ${tierLabel(l.from - 1)} ${oddsText(l.p)}${l.depth > 0 ? txt('screens.reliquaryCodex.wonAt', { depth: l.depth }) : ''}`,
                      )
                      .join(', '),
                    bandsSentence: bandsSentence(),
                  })}
                </td>
                <td className="py-2 font-mono text-text">+{rules.ascend.instability}</td>
              </tr>
              <tr className="border-t border-ink-600/70" data-craft="dissonate">
                <td className="py-2 pr-3 font-semibold text-text">
                  {txt('screens.reliquaryCodex.dissonate')}
                </td>
                <td className="py-2 pr-3 font-mono text-text">{tearsText(rules.dissonate.cost)}</td>
                <td className="py-2 pr-3 text-text">
                  {txt('screens.reliquaryCodex.theFinalGambleBelow')}
                </td>
                <td className="py-2 font-mono text-muted">—</td>
              </tr>
              <tr className="border-t border-ink-600/70" data-craft="release">
                <td className="py-2 pr-3 font-semibold text-text">
                  {txt('screens.reliquaryCodex.release')}
                </td>
                <td className="py-2 pr-3 font-mono text-muted">—</td>
                <td className="py-2 pr-3 text-text">
                  {txt('screens.reliquaryCodex.theRelicLeavesFor', {
                    common: release.common,
                    rare: release.rare,
                    cursed: release.cursed,
                    legendary: release.legendary,
                    perInscription: release.perInscription,
                  })}
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
            <Icon name="crack" size={20} style={{ color: FRACTURED_LOOK.color }} />{' '}
            {txt('screens.reliquaryCodex.instabilityAndFracture')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-text">
            {txt('screens.reliquaryCodex.instabilityRuns0100', { above })}{' '}
            <b style={{ color: FRACTURED_LOOK.color }}>{txt('screens.reliquaryCodex.fracture')}</b>
            {txt('screens.reliquaryCodex.forEachPointPast', {
              perPoint: num(rules.fracture.perPoint),
              andList: andList(fractureExamples().map((e) => `${oddsText(e.p)} at ${e.at}`)),
            })}
          </p>
          <div className="mt-3 max-w-md">
            <InstabilityBar view={instabilityView(demo)} />
            <p className="mt-1 text-xs text-muted">
              {txt('screens.reliquaryCodex.atInscribeRetuneAnd', {
                instability: demo.instability,
                oddsText: oddsText(instabilityView(demo).fracture),
              })}
            </p>
          </div>
        </Panel>
        <Panel tone="solid" className="p-5" data-testid="codex-dissonate">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-gold-300">
            <Icon name="dissonate" size={20} style={{ color: DISSONANCE_LOOK.dissonant.color }} />{' '}
            {txt('screens.reliquaryCodex.dissonate')}
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
                        ? txt('screens.reliquaryCodex.itsOwnEffectGrows')
                        : c.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {still && stillOdds && (
            <p className="mt-2 text-xs text-muted">
              {txt('screens.reliquaryCodex.aRelicWithNo', {
                name: still.name,
                DISSONANCE_KINDS: DISSONANCE_KINDS.map(
                  (k) => `${DISSONANCE_LOOK[k].label} ${oddsText(stillOdds[k])}`,
                ).join(', '),
              })}
            </p>
          )}
        </Panel>
      </div>

      <section
        aria-label={txt('screens.reliquaryCodex.inscriptions')}
        data-testid="codex-inscriptions"
      >
        <h3 className="mb-1 font-display text-lg font-bold text-gold-300">
          {txt('screens.reliquaryCodex.inscriptions')}
        </h3>
        <p className="mb-3 max-w-4xl text-sm text-muted">
          {txt('screens.reliquaryCodex.upToOnA', {
            maxInscriptions: rules.maxInscriptions,
            tierLabel: tierLabel(rules.tierCap),
            bandsSentence: bandsSentence(),
            tierLabel2: tierLabel(rules.dissonate.cursedTierCap),
          })}
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
                                : txt('screens.reliquaryCodex.aRelicWonAt', {
                                    value: t.depth ?? '?',
                                  })
                            }
                          >
                            <TierBadge tier={t.tier} size="sm" />
                            <span className="font-mono text-[0.75rem] text-text">{t.text}</span>
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
            {txt('screens.reliquaryCodex.dissonantInscriptions')}
          </h3>
          <p className="mt-1 text-sm text-muted">{txt('screens.reliquaryCodex.oneOfTheseFills')}</p>
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
            {txt('screens.reliquaryCodex.curses')}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {txt('screens.reliquaryCodex.oneOfTheseJoins', {
              tierLabel: tierLabel(rules.dissonate.cursedTierCap),
            })}
            {rules.bands.length > 0 &&
              txt('screens.reliquaryCodex.orForARelic', {
                tierLabel: tierLabel(band(rules.bands[0]!.depth).cursedTierCap),
                depth: rules.bands[0]!.depth,
              })}
            {txt('screens.reliquaryCodex.aCurseIsAn')}
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
          {txt('screens.reliquaryCodex.empoweredRelics')}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {txt('screens.reliquaryCodex.whatAnEmpoweredRelic', { andList: andList(empowered.none) })}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-1 pr-3 font-semibold">{txt('screens.reliquaryCodex.relic')}</th>
                <th className="py-1 pr-3 font-semibold">
                  {txt('screens.reliquaryCodex.itsEffect')}
                </th>
                <th className="py-1 font-semibold">{txt('screens.reliquaryCodex.empowered')}</th>
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

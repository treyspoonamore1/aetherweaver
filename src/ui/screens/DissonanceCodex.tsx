import { CONTENT } from '../../content';
import { UNLOCKS } from '../../meta/profile';
import { maxDissonance } from '../../meta/dissonance';
import { Chip } from '../kit/Chip';
import { Icon } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { DISCORD_LOOK, depthColor } from '../kit/dissonanceLook';
import { SHARD_LOOK, TEAR_LOOK } from '../kit/reliquaryLook';
import { DiscordDisc } from './DissonanceParts';
import { TierBadge } from './ReliquaryParts';
import {
  laterLevels,
  EXPEDITIONS_ONLY,
  bandsSentence,
  bestRecords,
  closedLines,
  codexBands,
  dissonanceBlurb,
  exampleTotals,
  levelRows,
  pointsText,
  rangeLabel,
  rewardView,
  tearRules,
  tierName,
} from './dissonanceModel';
import { t as txt } from '../text';

const DISCORD = DISCORD_LOOK.color;

/**
 * The Codex's Dissonance (Phase 4d): what it is and how it opens, every level with its ranks and
 * points, what the points pay (XP, shards, Tears), the depth bands that let relics won deeper
 * craft further, the records by Calling, and the levels still to come. All from content and meta.
 * Locked until it opens (a win at its Rank, or Skip the unlocks).
 */
export function DissonanceCodexPage({
  open,
  rank,
  best = {},
}: {
  open: boolean;
  rank: number;
  /** The profile's bests by Calling (`profile.dissonance.best`). */
  best?: Readonly<Record<string, number>>;
}) {
  const rules = CONTENT.dissonanceRules;
  const unlock = UNLOCKS.find((u) => u.kind === 'dissonance');
  if (!open) {
    const lines = closedLines(rank);
    return (
      <Panel tone="solid" className="border-dashed p-6" data-testid="codex-dissonance-locked">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-gold-200">
            <Icon name={DISCORD_LOOK.icon} size={26} /> {txt('screens.dissonanceCodex.dissonance')}
          </h2>
          <Chip icon="lock">
            {txt('screens.dissonanceCodex.aFinaleClearAt', { openRank: rules.openRank })}
          </Chip>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text">{unlock?.text}</p>
        <p className="mt-3 flex items-start gap-1.5 text-sm text-muted">
          <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
          <span>
            {txt('screens.dissonanceCodex.itsRulesWaitHere', {
              lead: lines.lead,
              skip: lines.skip,
            })}
          </span>
        </p>
      </Panel>
    );
  }
  const rows = levelRows([]);
  // Phase 6: the levels content doesn't hold yet (none, once all three have landed).
  const later = laterLevels();
  const max = maxDissonance();
  const bands = codexBands();
  const totals = exampleTotals();
  const records = bestRecords(best);
  return (
    <div className="flex flex-col gap-6" data-testid="codex-dissonance">
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
        <Panel
          tone="gold"
          className="p-5"
          style={{ borderColor: `color-mix(in srgb, ${DISCORD} 55%, var(--color-ink-600))` }}
        >
          <h2
            className="flex items-center gap-3 font-display text-xl font-bold"
            style={{ color: DISCORD }}
          >
            <DiscordDisc size={36} /> {txt('screens.dissonanceCodex.dissonance')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            {txt('screens.dissonanceCodex.theEndgameSDifficulty', {
              dissonanceBlurb: dissonanceBlurb(),
            })}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text">
            <b>{txt('screens.dissonanceCodex.choosing')}</b>{' '}
            {txt('screens.dissonanceCodex.inPrepTurnLevels', { max })}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text">
            <b>{txt('screens.dissonanceCodex.opening')}</b>{' '}
            {txt('screens.dissonanceCodex.yourFirstFinaleClear', { openRank: rules.openRank })}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text">
            <b>{txt('screens.dissonanceCodex.relicsRemember')}</b>{' '}
            {txt('screens.dissonanceCodex.aRelicEnshrinedFrom')}
            <b>{txt('screens.dissonanceCodex.depth')}</b>
            {txt('screens.dissonanceCodex.relicsEnshrinedBeforeDissonance', {
              bandsSentence: bandsSentence(),
            })}
          </p>
        </Panel>
        <Panel tone="solid" className="p-4" data-testid="codex-dissonance-records">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {txt('screens.dissonanceCodex.yourBestByCalling')}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {records.map((r) => (
              <li
                key={r.key}
                className="flex items-baseline justify-between gap-3"
                data-key={r.key}
                data-best={r.best ?? 0}
              >
                <span className="text-text">{r.who}</span>
                <span
                  className="font-mono font-semibold"
                  style={{ color: r.best ? DISCORD : 'var(--color-muted)' }}
                >
                  {r.best ?? '—'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-snug text-muted">
            {txt('screens.dissonanceCodex.theHighestDissonanceYou')}
          </p>
        </Panel>
      </div>

      <Panel tone="solid" className="p-5" data-testid="codex-dissonance-levels">
        <h3 className="font-display text-lg font-bold" style={{ color: DISCORD }}>
          {txt('screens.dissonanceCodex.theLevels')}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {txt('screens.dissonanceCodex.levelsInAllMost', {
            length: rows.length,
            pointsText: pointsText(max),
          })}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-1 pr-3 font-semibold">{txt('screens.dissonanceCodex.level')}</th>
                <th className="py-1 pr-3 font-semibold">
                  {txt('screens.dissonanceCodex.whatItDoes')}
                </th>
                <th className="py-1 pr-3 text-right font-semibold">
                  {txt('screens.dissonanceCodex.ranks')}
                </th>
                <th className="py-1 pr-3 text-right font-semibold">
                  {txt('screens.dissonanceCodex.points')}
                </th>
                <th className="py-1 text-right font-semibold">
                  {txt('screens.dissonanceCodex.atMost')}
                </th>
              </tr>
            </thead>
            <tbody className="align-top">
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-ink-600/70" data-level={r.id}>
                  <td className="py-1.5 pr-3 font-semibold text-text">{r.name}</td>
                  <td className="py-1.5 pr-3 text-muted">
                    {r.text}
                    {r.expeditionsOnly && (
                      <span
                        className="ml-1 text-xs font-semibold text-text"
                        data-testid="level-expeditions"
                      >
                        {EXPEDITIONS_ONLY}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-text">{r.ranks}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-text">
                    {r.points}
                    {r.ranks > 1 && (
                      <span className="text-muted"> {txt('screens.dissonanceCodex.each')}</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono" style={{ color: DISCORD }}>
                    {r.points * r.ranks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {later.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted" data-testid="codex-later">
            <Icon name="hourglass" size={13} className="mt-px shrink-0" />
            <span>
              {txt('screens.dissonanceCodex.stillToComeWith')}
              {later.map((l, i) => (
                <span key={l.name}>
                  {i > 0 && (i === later.length - 1 ? ' and ' : ', ')}
                  <b className="text-text">{l.name}</b> ({l.text})
                </span>
              ))}
              .
            </span>
          </p>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel tone="solid" className="p-5" data-testid="codex-dissonance-rewards">
          <h3 className="font-display text-lg font-bold text-gold-300">
            {txt('screens.dissonanceCodex.whatItPays')}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            <li className="flex items-center gap-2">
              <Icon name="star" size={15} solid className="shrink-0 text-gold-300" />
              <span>
                <b className="font-mono text-text">+{rules.xpPerPoint}%</b>{' '}
                <span className="text-muted">{txt('screens.dissonanceCodex.weaverXpForEach')}</span>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Icon
                name="shard"
                size={15}
                className="shrink-0"
                style={{ color: SHARD_LOOK.color }}
              />
              <span>
                <b className="font-mono text-text">+{rules.shardsPerPoint}%</b>{' '}
                <span className="text-muted">
                  {txt('screens.dissonanceCodex.tuningShardsForEach')}
                </span>
              </span>
            </li>
            {tearRules(Infinity).map((t) => (
              <li key={t.from} className="flex items-start gap-2" data-from={t.from}>
                <Icon
                  name="tear"
                  size={15}
                  className="mt-0.5 shrink-0"
                  style={{ color: TEAR_LOOK.color }}
                />
                <span className="text-text">{t.text}</span>
              </li>
            ))}
          </ul>
          <table className="mt-3 w-full text-left text-sm" data-testid="codex-dissonance-totals">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-1 pr-3 font-semibold">{txt('screens.dissonanceCodex.at')}</th>
                <th className="py-1 pr-3 font-semibold">
                  {txt('screens.dissonanceCodex.weaverXp')}
                </th>
                <th className="py-1 pr-3 font-semibold">
                  {txt('screens.dissonanceCodex.tuningShards')}
                </th>
                <th className="py-1 font-semibold">{txt('screens.dissonanceCodex.relicsReach')}</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((n) => {
                const pays = rewardView(n);
                const cap = codexBands()
                  .filter((b) => b.from <= n)
                  .at(-1)!.cap;
                return (
                  <tr key={n} className="border-t border-ink-600/70" data-total={n}>
                    <td className="py-1 pr-3 font-mono font-semibold" style={{ color: DISCORD }}>
                      {n}
                    </td>
                    <td className="py-1 pr-3 font-mono text-text">+{pays.xpPct}%</td>
                    <td className="py-1 pr-3 font-mono text-text">+{pays.shardsPct}%</td>
                    <td className="py-1">
                      <TierBadge tier={cap} size="sm" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        <Panel tone="solid" className="p-5" data-testid="codex-dissonance-bands">
          <h3 className="font-display text-lg font-bold text-gold-300">
            {txt('screens.dissonanceCodex.howDeepTheRelics')}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {txt('screens.dissonanceCodex.aRelicSDepth', { tierName: tierName(1) })}
          </p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-1 pr-3 font-semibold">{txt('screens.dissonanceCodex.depth2')}</th>
                <th className="py-1 pr-3 font-semibold">
                  {txt('screens.dissonanceCodex.ascendReaches')}
                </th>
                <th className="py-1 pr-3 font-semibold">
                  {txt('screens.dissonanceCodex.inscribeRollsT5T4')}
                </th>
                <th className="py-1 font-semibold">
                  {txt('screens.dissonanceCodex.cursedRaisesTo')}
                </th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b) => (
                <tr key={b.from} className="border-t border-ink-600/70" data-band={b.from}>
                  <td
                    className="py-1.5 pr-3 font-mono font-semibold"
                    style={{ color: depthColor(b.cap) }}
                  >
                    {rangeLabel(b)}
                  </td>
                  <td className="py-1.5 pr-3">
                    <TierBadge tier={b.cap} size="sm" />
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-text">
                    {b.odds.map((p) => Math.round(p * 10) / 10).join(' / ')}
                  </td>
                  <td className="py-1.5">
                    <TierBadge tier={b.cursedCap} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

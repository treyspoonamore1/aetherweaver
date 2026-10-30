import { CONTENT, heroDef } from '../../content';
import { bondRank, bondedHeroes, talentChoices, type Bond } from '../../meta/bonds';
import { BOND_LOOK, heroInk } from '../kit/bondLook';
import { Chip } from '../kit/Chip';
import { fmt } from '../kit/format';
import { Icon } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { BondGlyph, HeroPortrait } from './BondsParts';
import {
  bondOf,
  bondRulesLines,
  bondsIntroLines,
  numeral,
  rankRows,
  sceneRows,
  soloView,
  talentView,
  tiers,
} from './bondsModel';
import { SceneBody } from './SceneParts';

const BOND = BOND_LOOK.color;

/**
 * The Codex's Bonds (Phase 4e): what they are and how Bond XP is earned, the ranks and what each
 * opens, every hero's talents by tier, their own and alternate Solos, and the scenes (the seen
 * ones with the reply chosen, to read again). All from content and meta. Locked until a hero's
 * first Bond rank-up (or Skip the unlocks).
 */
export function BondsCodexPage({
  open,
  bonds,
}: {
  open: boolean;
  /** The profile's Bonds: ranks now and the scenes seen. */
  bonds: Readonly<Record<string, Bond>>;
}) {
  const intro = bondsIntroLines();
  if (!open) {
    return (
      <Panel tone="solid" className="border-dashed p-6" data-testid="codex-bonds-locked">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-gold-200">
            <BondGlyph size={26} /> Bonds
          </h2>
          <Chip icon="lock">A hero’s first Bond rank-up</Chip>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text">{intro[0]}</p>
        <p className="mt-3 flex items-start gap-1.5 text-sm text-muted">
          <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
          <span>
            Every fight pays Bond XP: this page opens with a hero’s first Bond rank-up. Settings →
            Skip the unlocks opens it now.
          </span>
        </p>
      </Panel>
    );
  }
  const rules = bondRulesLines();
  const rows = rankRows();
  return (
    <div className="flex flex-col gap-6" data-testid="codex-bonds">
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_24rem]">
        <Panel
          tone="gold"
          className="p-5"
          style={{ borderColor: `color-mix(in srgb, ${BOND} 55%, var(--color-ink-600))` }}
        >
          <h2
            className="flex items-center gap-2 font-display text-xl font-bold"
            style={{ color: BOND }}
          >
            <BondGlyph size={24} /> Bonds
          </h2>
          {intro.map((l) => (
            <p key={l} className="mt-2 text-sm leading-relaxed text-text">
              {l}
            </p>
          ))}
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">
            Bond XP
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-text" data-testid="codex-bonds-fight">
            {rules.fight}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-text">{rules.weights}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-text">{rules.scene}</p>
        </Panel>
        <Panel tone="solid" className="p-4" data-testid="codex-bonds-ranks">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">The ranks</p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-1 font-semibold">Rank</th>
                <th className="pb-1 text-right font-semibold">Bond XP</th>
                <th className="pb-1 pl-4 font-semibold">Opens</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.rank}
                  className="border-t border-ink-600/50"
                  data-rank={r.rank}
                  data-xp={r.xp}
                >
                  <td className="py-1 font-mono font-semibold" style={{ color: BOND }}>
                    {r.rank}
                  </td>
                  <td className="py-1 text-right font-mono text-text">{fmt(r.xp)}</td>
                  <td className="py-1 pl-4 text-xs text-muted">{r.opens.join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {bondedHeroes().map((h) => (
        <HeroBondEntry key={h} heroId={h} bond={bondOf(bonds, h)} />
      ))}
    </div>
  );
}

function HeroBondEntry({ heroId, bond }: { heroId: string; bond: Bond }) {
  const def = heroDef(heroId);
  const ink = heroInk(heroId);
  const own = soloView(heroId, null);
  const alt = CONTENT.altSolos.find((s) => s.hero === heroId);
  const altView = alt ? soloView(heroId, alt.id) : null;
  const scenes = sceneRows(heroId, bond);
  return (
    <Panel
      tone="solid"
      className="p-5"
      style={{ borderTopColor: def.color, borderTopWidth: 3 }}
      data-testid={`codex-bond-${heroId}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <HeroPortrait heroId={heroId} size={44} rank={bondRank(bond.xp)} />
        <h3 className="font-display text-xl font-bold text-text">
          {def.name} <span className="text-sm font-normal text-muted">{def.title}</span>
        </h3>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Talents</p>
          <ol className="mt-1.5 flex flex-col gap-2">
            {tiers().map((tier) => (
              <li
                key={tier}
                className="grid grid-cols-[3.2rem_minmax(0,1fr)_minmax(0,1fr)] gap-2"
                data-tier={tier}
              >
                <span className="flex flex-col items-center justify-center rounded-lg bg-ink-900/70 py-1">
                  <span
                    className="font-display text-lg font-bold leading-none"
                    style={{ color: ink }}
                  >
                    {numeral(tier)}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {CONTENT.bondRules.talentRanks[tier - 1]}
                  </span>
                </span>
                {talentChoices(heroId, tier).map((t) => {
                  const v = talentView(t);
                  return (
                    <span
                      key={t.id}
                      className="rounded-lg bg-ink-900/60 px-3 py-2"
                      data-talent={t.id}
                    >
                      <b className="block text-sm font-semibold text-text">{v.name}</b>
                      <span className="block text-xs leading-snug text-muted">{v.text}</span>
                    </span>
                  );
                })}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Solos</p>
            <dl className="mt-1.5 flex flex-col gap-2">
              {[own, ...(altView ? [altView] : [])].map((s) => (
                <div key={s.id} className="rounded-lg bg-ink-900/60 px-3 py-2" data-solo={s.id}>
                  <dt className="flex items-center gap-1.5 text-sm font-semibold text-gold-200">
                    <Icon name="note" size={14} /> {s.name}
                    <span className="text-xs font-normal text-muted">
                      {s.alt
                        ? `· alternate, Bond rank ${CONTENT.bondRules.soloRank}`
                        : '· their own'}
                    </span>
                  </dt>
                  <dd className="text-xs leading-snug text-muted">{s.text}</dd>
                  <dd className="text-xs leading-snug text-gold-300">{s.cued}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Scenes</p>
            <ul className="mt-1.5 flex flex-col gap-2">
              {scenes.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg bg-ink-900/60 px-3 py-2"
                  data-scene={r.id}
                  data-state={r.state}
                >
                  {r.state === 'seen' ? (
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-text">
                        <Icon
                          name="check"
                          size={13}
                          className="mr-1 inline"
                          style={{ color: ink }}
                        />
                        {r.title}{' '}
                        <span className="font-mono text-xs font-normal text-muted">
                          rank {r.rank} · read it again
                        </span>
                      </summary>
                      <div className="mt-2">
                        <SceneBody
                          scene={CONTENT.scenes.find((s) => s.id === r.id)!}
                          reply={r.reply}
                          compact
                        />
                      </div>
                    </details>
                  ) : (
                    <p className="text-sm text-muted">
                      <Icon
                        name={r.state === 'locked' ? 'lock' : 'scene'}
                        size={13}
                        className="mr-1 inline"
                      />
                      <b className="font-semibold text-text">{r.title}</b>{' '}
                      <span className="font-mono text-xs">rank {r.rank}</span> ·{' '}
                      {r.state === 'locked' ? 'not yet' : 'waiting for a Respite'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  );
}

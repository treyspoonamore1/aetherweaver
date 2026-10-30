import { useState, type KeyboardEvent } from 'react';
import { useProfile } from '../../app/profileStore';
import { CONTENT, motifText, ornamentDef } from '../../content';
import {
  FIGHT_XP,
  GRADE_XP,
  LOSS_XP,
  RANK_XP,
  RUN_WIN_XP,
  UNLOCKS,
  unlockRank,
} from '../../meta/profile';
import { CHORD_PRESETS } from '../../meta/run';
import { WITHOUT_YOU_MAX_SECONDS } from '../../sim';
import type { AttackDef, EnemyDef, HeroDef } from '../../content';
import { AnswerGlyph } from '../hud/AnswerGlyph';
import { ROLE_LABEL, bindingLabel } from '../hud/labels';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { CATEGORY, Chip, RARITY, RarityChip } from '../kit/Chip';
import { fmt, pct } from '../kit/format';
import { Icon, type IconName } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { useMood } from '../kit/sound';
import { useUi } from '../store';
import { HeroDisc } from './shared';
import { FORGE_PRICE, RELIC_OFFERS, RELIC_PRICE } from '../../meta/economy';
import { eventFightRelics } from '../../meta/run';
import { RELIC_RARITY, RelicGlyph, RelicRarityChip, Glyph } from '../kit/RelicGlyph';
import type { RelicRarity } from '../../content';
import { EventGlyph } from './EventScreen';
import { boonDuration, boonInfo, choiceInfo, relicInfo } from './interlude';
import { BoonTip, RelicBody, boonStyle } from './RelicCard';
import { CALLING_ROWS, newRun } from '../../meta/run';
import { EVERYTHING, type Allowance } from '../../meta/profile';
import { callingLook } from '../kit/CallingGlyph';
import { AxisLegend, CallingPassive, CallingPathPreview, CallingTitle } from './CallingParts';
import { callingOpen } from './CallingPicker';
import { tierWhenList } from './callingText';
import { useAllowance } from './PrepScreen';
import { ASTROLABE_RANK, astrolabePoints } from '../../meta/astrolabe';
import { DEED_POINTS_MAX, deedPoints } from '../../meta/deeds';
import { MAX_RANK, rankOf } from '../../meta/profile';
import { AstrolabeGlyph, KeystoneBadge } from '../kit/AstrolabeGlyph';
import { CONSTELLATIONS, CONSTELLATION_LOOK, STARLIGHT } from '../kit/astrolabeLook';
import { AstrolabeMap } from './AstrolabeMap';
import {
  KIND_LABEL,
  STARS,
  astrolabeOpen,
  constellationStars,
  keystoneParts,
  rankAstrolabeLine,
  starGlyph,
} from './astrolabeModel';
import { DeedsPage } from './DeedsParts';
import type { DeedsHeld } from './deedsModel';
import { reliquaryOpen } from '../../meta/reliquary';
import { ReliquaryCodexPage } from './ReliquaryCodex';
import { DissonanceCodexPage } from './DissonanceCodex';
import { useSettings } from '../../app/settings';
import { UnlockGlyph } from './Rank';

const TABS = [
  { id: 'heroes', label: 'Heroes' },
  { id: 'enemies', label: 'Enemies' },
  { id: 'weaver', label: 'The Weaver' },
  { id: 'auras', label: 'Auras' },
  { id: 'chords', label: 'Songs & ornaments' },
  { id: 'rank', label: 'Weaver Rank' },
  { id: 'astrolabe', label: 'The Astrolabe' },
  { id: 'deeds', label: 'Deeds' },
  { id: 'reliquary', label: 'The Reliquary' },
  { id: 'dissonance', label: 'Dissonance' },
  { id: 'callings', label: 'Callings' },
  { id: 'calls', label: 'Calls' },
  { id: 'motifs', label: 'Motifs' },
  { id: 'relics', label: 'Relics' },
  { id: 'events', label: 'Events' },
] as const;
export type TabId = (typeof TABS)[number]['id'];

const NO_DEEDS: DeedsHeld = { earned: [], best: {} };

/** Phase 4d: Dissonance as the profile holds it (open, and its bests by Calling). */
export interface CodexDissonance {
  open: boolean;
  best: Readonly<Record<string, number>>;
}

/** The Codex: everything is generated from content, so it can never drift from the game. */
export function CodexView({
  onBack,
  initialTab = 'heroes',
  allowance = EVERYTHING,
  rank = MAX_RANK,
  deeds = NO_DEEDS,
  dissonance,
}: {
  onBack(): void;
  initialTab?: TabId;
  /** What the player's Rank opens: locked Callings say so (default: everything). */
  allowance?: Allowance;
  /** The player's Rank: Deeds that need the Astrolabe say when it opens (default: the top). */
  rank?: number;
  /** The Deeds the profile holds (Phase 4b): earned, and each counting Deed's best run. */
  deeds?: DeedsHeld;
  /**
   * Phase 4d: Dissonance as the profile holds it. Omitted: open with everything (the default
   * allowance), else closed, with no records.
   */
  dissonance?: CodexDissonance;
}) {
  useMood('title');
  const [tab, setTab] = useState<TabId>(initialTab);
  // Phase 4c: the Reliquary's page is locked until it opens (Rank 10, or Skip the unlocks).
  const reliquary = reliquaryOpen(rank, allowance.all);
  // Phase 4d: Dissonance's too, until a win at its Rank (or Skip the unlocks).
  const dissonant = dissonance ? dissonance.open || allowance.all : allowance.all;
  const locked = (id: TabId) =>
    (id === 'reliquary' && !reliquary) || (id === 'dissonance' && !dissonant);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
    setTab(next.id);
    e.currentTarget.querySelector<HTMLElement>(`#tab-${next.id}`)?.focus();
    e.preventDefault();
  };
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ScreenHeader
          eyebrow="Reference"
          title="Codex"
          right={
            <Button variant="secondary" onClick={onBack} sound="back">
              <Icon name="back" size={16} /> Back
            </Button>
          }
        />
        <div
          role="tablist"
          aria-label="Codex sections"
          onKeyDown={onKey}
          className="mt-6 flex flex-wrap gap-2 border-b border-ink-600/60 pb-3"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id ? 'bg-gold-400 text-ink-950' : 'bg-ink-800 text-muted hover:text-text'
              }`}
            >
              {locked(t.id) && <Icon name="lock" size={12} className="-mt-0.5 mr-1 inline" />}
              {t.label}
              {locked(t.id) && <span className="sr-only"> (locked)</span>}
            </button>
          ))}
        </div>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6">
          {tab === 'heroes' && <Heroes />}
          {tab === 'enemies' && <Enemies />}
          {tab === 'weaver' && <Weaver />}
          {tab === 'auras' && <Auras />}
          {tab === 'chords' && <Chords />}
          {tab === 'rank' && <Ranks deeds={deedPoints(deeds.earned)} />}
          {tab === 'astrolabe' && <Astrolabe onDeeds={() => setTab('deeds')} />}
          {tab === 'deeds' && (
            <DeedsPage
              held={deeds}
              open={{ allowance, astrolabe: astrolabeOpen(rank, allowance.all) }}
            />
          )}
          {tab === 'reliquary' && <ReliquaryCodexPage open={reliquary} rank={rank} />}
          {tab === 'dissonance' && (
            <DissonanceCodexPage open={dissonant} rank={rank} best={dissonance?.best} />
          )}
          {tab === 'callings' && <Callings allowance={allowance} />}
          {tab === 'calls' && <Calls />}
          {tab === 'motifs' && <Motifs />}
          {tab === 'relics' && <Relics />}
          {tab === 'events' && <Events />}
        </div>
      </div>
    </ScreenFrame>
  );
}

export function CodexScreen() {
  const back = useUi((s) => s.back);
  const allowance = useAllowance();
  const xp = useProfile((s) => s.profile.xp);
  const earned = useProfile((s) => s.profile.deeds);
  const best = useProfile((s) => s.profile.deedBest);
  const dissonance = useCodexDissonance();
  return (
    <CodexView
      onBack={back}
      allowance={allowance}
      rank={rankOf(xp)}
      deeds={{ earned, best }}
      dissonance={dissonance}
    />
  );
}

/** Dissonance as the Codex shows it, from the profile (and Settings → Skip the unlocks). */
export function useCodexDissonance(): CodexDissonance {
  const won = useProfile((s) => s.profile.dissonance.open);
  const best = useProfile((s) => s.profile.dissonance.best);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  return { open: won || unlockAll, best };
}

/**
 * Callings (Phase 3c, 3d, 3e): each one's passive, Crescendo, flavour and whole path; locks by
 * Rank.
 */
function Callings({ allowance }: { allowance: Allowance }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel tone="gold" className="p-5">
        <p className="max-w-4xl text-sm leading-relaxed text-text">
          A <b className="text-gold-200">Calling</b> is the Weaver’s class for a run, chosen in
          Prep. It brings a passive and its own Crescendo, and a <b>path</b>: {CALLING_ROWS.length}{' '}
          tiers of two options each, picked during the run {tierWhenList(CALLING_ROWS.length)} (the
          first fight you win at that step), before the fight’s relic and motif. Each pick lasts the
          rest of the run. The map marks the fights that bring one. Runs without a Calling play as
          before. The auras themselves never change: a Calling adds to your songs’ reach, strength
          or slots, or (the Martyr) changes what they reserve: your Life instead of your Spirit.
          Some bring a key of their own: the Martyr’s Bear ({bindingLabel('bear')}), and the
          Chronomancer’s Rewind, which takes Reel’s ({bindingLabel('reel')}).
        </p>
      </Panel>
      {CONTENT.callings.map((def) => {
        const open = callingOpen(allowance, def.id);
        const look = callingLook(def.id);
        const rank = unlockRank('calling', def.id);
        return (
          <section
            key={def.id}
            aria-label={`The ${def.name}`}
            className="flex flex-col gap-4"
            data-testid={`codex-calling-${def.id}`}
          >
            <Panel
              tone="solid"
              className={`p-5 ${open ? '' : 'border-dashed'}`}
              style={{ borderTopColor: open ? look.color : undefined, borderTopWidth: 3 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <CallingTitle def={def} size={64} muted={!open} />
                <span className="flex items-center gap-2">
                  {open ? (
                    <Chip color={look.color} icon={look.icon}>
                      {allowance.all ? 'Open (unlocks skipped)' : `Unlocked at Rank ${rank}`}
                    </Chip>
                  ) : (
                    <Chip icon="lock">Rank {rank}</Chip>
                  )}
                </span>
              </div>
              <p className="mt-3 text-sm italic text-muted">“{def.flavor}”</p>
              <div className="mt-3 max-w-4xl">
                <CallingPassive def={def} />
              </div>
              {!open && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                  <Icon name="lock" size={14} /> Reach Weaver Rank {rank} to choose it in Prep, or
                  turn on Settings → Skip the unlocks.
                </p>
              )}
            </Panel>
            <CallingPathPreview def={def} columns={4} />
            <AxisLegend def={def} />
          </section>
        );
      })}
    </div>
  );
}

const GRID = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(22rem,1fr))]';

function Heroes() {
  return (
    <div className={GRID}>
      {CONTENT.heroes.map((h) => (
        <HeroEntry key={h.id} hero={h} />
      ))}
    </div>
  );
}

function HeroEntry({ hero: h }: { hero: HeroDef }) {
  return (
    <Panel tone="solid" className="p-5" style={{ borderTopColor: h.color, borderTopWidth: 3 }}>
      <div className="flex items-center gap-3">
        <HeroDisc heroId={h.id} size={46} />
        <div>
          <h2 className="font-display text-xl font-bold leading-tight">{h.name}</h2>
          <p className="text-sm text-muted">
            {h.title} · {ROLE_LABEL[h.role]}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text">{h.codex}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip icon="heart">{fmt(h.maxHp)} life</Chip>
        {h.armor > 0 && <Chip icon="ward">{pct(h.armor)} armour</Chip>}
        <Chip>{h.attack.kind === 'melee' ? 'Melee' : 'Ranged'}</Chip>
      </div>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        {h.abilities.map((a) => (
          <div key={a.id}>
            <dt className="font-semibold">
              {a.name}{' '}
              <span className="font-mono text-xs font-normal text-muted">{a.cooldown}s</span>
            </dt>
            <dd className="text-xs leading-relaxed text-muted">{a.description}</dd>
          </div>
        ))}
        <div>
          <dt className="font-semibold text-gold-200">Solo · {h.solo.name}</dt>
          <dd className="text-xs leading-relaxed text-muted">{h.solo.description}</dd>
          <dd className="text-xs leading-relaxed text-gold-300">{h.solo.cuedDescription}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 font-semibold" style={{ color: CALL }}>
            <Icon name="call" size={14} /> Call · {CALL_ANSWER[h.call.answer]} →{' '}
            {h.call.flourish.name}
          </dt>
          <dd className="text-xs leading-relaxed text-muted">{h.call.flourish.description}</dd>
        </div>
        <div>
          <dt className="font-semibold">Quirk · {h.quirk.name}</dt>
          <dd className="text-xs leading-relaxed text-muted">{h.quirk.description}</dd>
        </div>
      </dl>
    </Panel>
  );
}

const CALL = 'var(--color-call, #fde68a)';
const CALL_ANSWER = { ward: 'Ward', empower: 'Empower', chime: 'Chime' } as const;
const CALL_ICON = { ward: 'ward', empower: 'empower', chime: 'chime' } as const;

function attackDamage(a: AttackDef): string {
  if (a.effect === 'healAllies') return 'heals allies';
  if (a.effect === 'summon')
    return `summons ${a.summon?.count ?? ''} ${a.summon?.enemy.replace(/_/g, ' ') ?? ''}`;
  if (a.effect === 'suppress') return 'silences auras';
  if (a.pctMaxHp !== undefined) return `${Math.round(a.pctMaxHp * 100)}% of max life`;
  return `${fmt(a.damage)} damage`;
}

function Enemies() {
  return (
    <div className={GRID}>
      {CONTENT.enemies.map((e) => (
        <EnemyEntry key={e.id} enemy={e} />
      ))}
    </div>
  );
}

function EnemyEntry({ enemy: e }: { enemy: EnemyDef }) {
  const attacks = e.specials.map((id) => CONTENT.attacks.find((a) => a.id === id)!).filter(Boolean);
  const boss = e.role === 'boss' || e.role === 'miniboss';
  return (
    <Panel
      tone="solid"
      className={`p-5 ${boss ? 'md:col-span-2' : ''}`}
      style={{ borderTopColor: e.accent, borderTopWidth: 3 }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{e.name}</h2>
        <Chip color={e.accent} icon={boss ? 'eye' : 'skull'}>
          {e.role}
        </Chip>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text">{e.codex}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip icon="heart">{fmt(e.hp)} life</Chip>
        <Chip>
          {e.basic.kind === 'melee' ? 'Melee' : 'Ranged'} · {e.basic.damage} per hit
        </Chip>
        {e.suppressRadius > 0 && (
          <Chip icon="mute">silences auras within {e.suppressRadius} m</Chip>
        )}
      </div>
      {attacks.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {attacks.map((a) => (
            <li key={a.id} className="rounded-lg bg-ink-900/60 p-3">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-semibold">
                {a.name}
                <span className="font-mono text-xs font-normal text-muted">
                  {a.kind} · {a.windup}s wind-up · {attackDamage(a)}
                </span>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                Answer:
                {a.answers.map((tag) => (
                  <AnswerGlyph key={tag} tag={tag} />
                ))}
              </p>
              {a.decree && (
                <p className="mt-1.5 text-xs italic leading-relaxed text-violet-200">
                  “{a.decree}”
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Weaver() {
  const t = CONTENT.techniques;
  // The Calling whose Rewind takes Reel's key (Phase 3e), for Reel's entry.
  const rewind = CONTENT.callings.find((c) => (c.values.rewind ?? 0) > 0);
  const r = CONTENT.resonance;
  const th = CONTENT.thread;
  const entries: {
    name: string;
    icon: IconName;
    keys: string;
    body: string;
    stats: string[];
  }[] = [
    {
      name: 'Thread',
      icon: 'thread',
      keys: '1–4 / click, RMB',
      body: `Tie your Thread to a hero. Mend heals them; Empower adds damage and attack speed. Your beam song rides it in every mode. Stray too far and it snaps. On a Martyr run, Bear (${bindingLabel('bear')}) is a third mode: you take part of the life they would lose.`,
      stats: [
        `Mend ${th.mendPerSec}/s`,
        `Empower +${pct(th.empowerMore)} damage`,
        `Full strength to ${th.comfortRange} m`,
        `Snaps at ${th.snapRange} m`,
      ],
    },
    {
      name: t.ward.name,
      icon: 'ward',
      keys: 'Q',
      body: `A barrier worth ${pct(t.ward.barrierPct)} of the hero's life plus ${t.ward.barrierFlat}. Cast it just before a hit lands (within ${t.ward.perfectWindow}s) for a Perfect Ward: the hit is negated, the attacker staggers and you get ${pct(t.ward.perfectRefund)} of the Spirit back.`,
      stats: [`${t.ward.cost} Spirit`, `${t.ward.cooldown}s cooldown`, `${t.ward.range} m range`],
    },
    {
      name: t.chime.name,
      icon: 'chime',
      keys: 'E',
      body: `A bell lands under your cursor, cleanses every ailment in ${t.chime.radius} m and leaves heroes immune for ${t.chime.immunity}s. Clutch Chimes (within ${t.chime.clutchWindow}s of a mark's end) feed Resonance.`,
      stats: [
        `${t.chime.cost} Spirit`,
        `${t.chime.cooldown}s cooldown`,
        `${t.chime.range} m range`,
      ],
    },
    {
      name: t.reel.name,
      icon: 'reel',
      keys: 'F',
      body: `Yank a hero to your side along a ribbon. Out of a lethal zone or a beam, and into your aura field.${rewind ? ` On a Chronomancer run, Rewind takes its key: the hero goes back ${rewind.values.rewind} s, to where they stood and the life they had (never less than now). ${rewind.values.cooldown} s cooldown, Reel’s cost and range. Once a run, it stands back up a hero who fell in that time.` : ''}`,
      stats: [`${t.reel.cost} Spirit`, `${t.reel.cooldown}s cooldown`, `${t.reel.range} m range`],
    },
    {
      name: t.glide.name,
      icon: 'glide',
      keys: 'Space',
      body: `A short dash with ${t.glide.iframes}s of invulnerability. Free to use.`,
      stats: [`${t.glide.cooldown}s cooldown`, `${t.glide.distance} m`],
    },
    {
      name: 'Resonance',
      icon: 'note',
      keys: 'T / R',
      body: `Good support fills the Resonance arc (${r.max} in segments of ${r.segment}). A Cue (T, or Shift + a hero's number) spends one segment to fire a charged Solo with a bonus. Crescendo (R) spends it all on ${CONTENT.crescendo.name}: ${CONTENT.crescendo.description}`,
      stats: [
        `Perfect Ward +${r.gains.perfectWard}`,
        `Save +${r.gains.save}`,
        `Clutch Chime +${r.gains.clutchChime}`,
        `Reel dodge +${r.gains.reelDodge}`,
        `Answered call +${r.gains.response}`,
      ],
    },
    {
      name: 'Directives',
      icon: 'wheel',
      keys: 'hold C / MMB',
      body: 'Hold C or the middle mouse button for the Directive wheel, move toward a spoke and let go: Focus (the enemy under your cursor), Rally (regroup on you), Hold (stay put) or Scatter (spread out). Let go in the centre to cancel. A quick middle-click on an enemy Focuses it.',
      stats: ['Focus · Rally · Hold · Scatter', 'G: Focus', 'Z: Rally', 'X: Hold'],
    },
    {
      name: 'Without you',
      icon: 'eye',
      keys: 'after each fight',
      body: `When a fight ends, the Loom replays it with the same enemies and the same seed, but with you absent: no Thread, no auras, no techniques. The result screen shows the two side by side ("Without you, the party falls at 0:41 in wave 2"), and the run summary counts the fights they would have lost alone. The re-run is capped at ${Math.round(WITHOUT_YOU_MAX_SECONDS / 60)} minutes.`,
      stats: ['Same seed, same enemies', 'Shown on Result and Summary'],
    },
  ];
  return (
    <div className={GRID}>
      {entries.map((e) => (
        <Panel key={e.name} tone="solid" className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
              <Icon name={e.icon} size={22} /> {e.name}
            </h2>
            <span className="font-mono text-xs text-muted">{e.keys}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-text">{e.body}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {e.stats.map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Auras() {
  return (
    <div className={GRID}>
      {CONTENT.auras.map((a) => (
        <Panel
          key={a.id}
          tone="solid"
          className="p-5"
          style={{ borderTopColor: a.color, borderTopWidth: 3 }}
        >
          <h2
            className="flex items-center gap-2 font-display text-xl font-bold"
            style={{ color: a.color }}
          >
            <Icon name="note" size={20} /> {a.name}
          </h2>
          <p className="text-sm text-muted">{a.subtitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-text">{a.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip icon="sparkle">reserves {pct(a.reserve)} of Spirit</Chip>
            <Chip icon="lock">Rank {unlockRank('aura', a.id)}</Chip>
          </div>
        </Panel>
      ))}
    </div>
  );
}

const ANCHOR_TEXT = {
  weaver: 'Around you',
  planted: 'Planted where you put it',
} as const;

function Chords() {
  const w = CONTENT.weaver;
  const c = CONTENT.chorus;
  const fermata = CONTENT.auras.find((a) => a.id === 'fermata');
  const unison = CONTENT.ornaments.find((o) => o.id === 'unison');
  const mult = (v: number) => `×${Number(v.toFixed(2))}`;
  return (
    <div className="flex flex-col gap-8">
      <div className={GRID}>
        <Panel tone="gold" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="thread" size={22} /> The beam song
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Your first Chord rides the Thread. The hero you thread hears it at{' '}
            <b>{mult(w.beamFocus)}</b>, wherever they are, and its hexes hit whatever attacks them.
            Everyone else in its field hears an echo at <b>{mult(w.beamEcho)}</b>. Who you thread
            decides who becomes the monster; right-click (Mend ⇄ Empower) doesn’t change it.
            {unison && (
              <>
                {' '}
                With <b style={{ color: unison.color }}>{unison.name}</b> it goes all in:{' '}
                {mult(w.beamFocus * unison.focusMult)} on your threaded hero, and nobody hears an
                echo.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip icon="thread">{mult(w.beamFocus)} on your threaded hero</Chip>
            <Chip icon="scatter">
              echo {mult(w.beamEcho)} within {w.fieldRadius} m
            </Chip>
            <Chip icon="lock">Rank {unlockRank('song', 'beam')}</Chip>
          </div>
        </Panel>
        <Panel
          tone="solid"
          className="p-5"
          style={{ borderTopColor: '#93c5fd', borderTopWidth: 3 }}
        >
          <h2
            className="flex items-center gap-2 font-display text-xl font-bold"
            style={{ color: '#93c5fd' }}
          >
            <Icon name="scatter" size={22} /> The field song
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Your second Chord surrounds you: everyone within {w.fieldRadius} m hears it at full
            strength. Make one ally a monster with the beam, and the whole party stronger just by
            being near you with the field. Each song holds {w.auraSlots} auras and up to{' '}
            {w.ornamentSlots} ornaments, and an ornament changes both auras in its song. You own one
            copy of each aura and each ornament. Auras reserve Spirit; what they leave free powers
            Ward ({CONTENT.techniques.ward.cost}), Chime ({CONTENT.techniques.chime.cost}) and Reel
            ({CONTENT.techniques.reel.cost}). Change your songs in Prep, or Retune at a Respite.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip>×1 within {w.fieldRadius} m</Chip>
            <Chip>{w.fieldRadiusCap} m at most</Chip>
            <Chip icon="lock">Rank {unlockRank('song', 'field')}</Chip>
          </div>
        </Panel>
        <Panel tone="solid" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="sparkle" size={22} /> Chorus pulse
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Sing {c.minAuras} or more auras and every Cue also releases a chorus pulse from your
            field: each hero it reaches heals {pct(c.healPctPerAura)} of their life and gains a
            barrier of {pct(c.barrierPctPerAura)} of their life for {c.barrierDuration} s, per aura
            you sing. Grace Note is how you fit the third aura.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip icon="mend">{pct(c.healPctPerAura)} heal per aura</Chip>
            <Chip icon="ward">{pct(c.barrierPctPerAura)} barrier per aura</Chip>
          </div>
        </Panel>
        {fermata && (
          <Panel
            tone="solid"
            className="p-5"
            style={{ borderTopColor: fermata.color, borderTopWidth: 3 }}
          >
            <h2
              className="flex items-center gap-2 font-display text-xl font-bold"
              style={{ color: fermata.color }}
            >
              <Icon name="fermata" size={22} /> Fermata hold
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text">
              With the Fermata aura sung, once per fight per hero, a hit that would down them holds
              them at 1 life for {fermata.effects.holdTime ?? 1.5} s instead. Their frame shows{' '}
              <b>HELD · Heal!</b> with a countdown: heal them in time (Mend on the Thread, or a
              Chime on them) and it counts as a Save. Let it run out and they go down.
            </p>
          </Panel>
        )}
      </div>
      <section aria-label="Ornaments">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-gold-300">
          <Icon name="diamond" size={20} /> Ornaments
        </h2>
        <div className={GRID}>
          {CONTENT.ornaments.map((o) => (
            <Panel
              key={o.id}
              tone="solid"
              className="p-5"
              style={{ borderTopColor: o.color, borderTopWidth: 3 }}
            >
              <h3
                className="flex items-center gap-2 font-display text-xl font-bold"
                style={{ color: o.color }}
              >
                <Icon name="diamond" size={20} /> {o.name}
              </h3>
              <p className="text-sm text-muted">{o.subtitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-text">{o.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {o.reserveMult !== 1 && <Chip icon="sparkle">reserve {mult(o.reserveMult)}</Chip>}
                {o.effectMult !== 1 && <Chip icon="empower">effect {mult(o.effectMult)}</Chip>}
                {o.radiusMult !== 1 && <Chip icon="scatter">radius {mult(o.radiusMult)}</Chip>}
                {o.focusMult !== 1 && (
                  <Chip icon="thread">beam {mult(w.beamFocus * o.focusMult)}</Chip>
                )}
                <Chip icon={o.echoMult === 0 ? 'thread' : o.anchor === 'planted' ? 'pin' : 'note'}>
                  {o.echoMult === 0 ? 'Only your threaded hero' : ANCHOR_TEXT[o.anchor]}
                </Chip>
                {o.roles.length === 1 && (
                  <Chip icon="info">{o.roles[0] === 'beam' ? 'beam song' : 'field song'} only</Chip>
                )}
                <Chip icon="lock">Rank {unlockRank('ornament', o.id)}</Chip>
                {o.excludes.map((x) => (
                  <Chip key={x} icon="close" color="var(--color-threat)">
                    not with {ornamentDef(x).name}
                  </Chip>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * The Astrolabe in brief (Phase 4): how its points come and go (the Rank's, and Phase 4b's
 * Deeds'), and its four constellations with their landmarks. Everything from content and
 * meta/astrolabe.ts.
 */
function Astrolabe({ onDeeds }: { onDeeds(): void }) {
  const first = astrolabePoints(ASTROLABE_RANK);
  const top = astrolabePoints(MAX_RANK);
  const all = astrolabePoints(MAX_RANK, true);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_17rem]">
        <Panel tone="gold" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <AstrolabeGlyph glyph="weaver_star" size={22} /> The Astrolabe
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            A star map of passives you change between runs. It opens at Rank {ASTROLABE_RANK} with{' '}
            {first} points, then every Rank adds one: {top} at Rank {MAX_RANK}, of {STARS.length}{' '}
            stars.{' '}
            <button
              type="button"
              onClick={onDeeds}
              className="font-semibold text-gold-200 underline decoration-gold-400/60 underline-offset-2 hover:text-gold-100"
            >
              Deeds
            </button>{' '}
            add up to {DEED_POINTS_MAX} more, a point for each on their ladder: {all} in all. The
            Weaver’s Star at the centre is always yours. A star can be taken when it touches one you
            have; pointing at a far one shows the path to it and what it costs, and taking it takes
            the path.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Give a star back if nothing you’ve taken hangs on it, or everything at once: it’s free
            between runs. A run keeps the tree it embarked with; the Training Grounds use yours, so
            you can try a change first. Open it from the Title or from Prep. Settings →{' '}
            <b>Skip the unlocks</b> gives all {all} points.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            {(['travel', 'notable', 'great', 'keystone'] as const).map((kind) => (
              <li key={kind}>
                <b className="text-text">{KIND_LABEL[kind]}</b>{' '}
                {
                  {
                    travel: 'small numbers on the way',
                    notable: 'a new rule or a big number',
                    great: 'the heroes’ rim stars',
                    keystone: 'a rule that bends the game, with a price',
                  }[kind]
                }
              </li>
            ))}
          </ul>
        </Panel>
        <Panel tone="solid" className="p-3">
          <AstrolabeMap tree={[]} mini label="The Astrolabe’s four constellations" />
        </Panel>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {CONSTELLATIONS.map((c) => {
          const look = CONSTELLATION_LOOK[c];
          const stars = constellationStars(c);
          const notables = stars.filter((n) => n.kind === 'notable');
          const rim = stars.filter((n) => n.kind === 'keystone' || n.kind === 'great');
          return (
            <Panel
              key={c}
              tone="solid"
              className="p-4"
              style={{ borderTopColor: look.color, borderTopWidth: 3 }}
            >
              <h3
                className="flex items-center gap-2 font-display text-lg font-bold"
                style={{ color: look.color }}
              >
                <AstrolabeGlyph glyph={look.glyph} size={20} /> {look.name}
                <span className="font-sans text-sm font-normal text-muted">{look.blurb}</span>
              </h3>
              <p className="mt-1 text-xs text-muted">
                {stars.length} stars · notables: {notables.map((n) => n.name).join(', ')}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {rim.map((n) => {
                  const parts = keystoneParts(n);
                  return (
                    <li key={n.id} className="flex items-start gap-2">
                      <KeystoneBadge glyph={starGlyph(n)} constellation={c} size={26} />
                      <div className="min-w-0 text-xs leading-snug">
                        <p className="font-semibold" style={{ color: look.light }}>
                          {n.name}{' '}
                          <span className="font-normal text-muted">· {KIND_LABEL[n.kind]}</span>
                        </p>
                        {parts.gains.map((s) => (
                          <p key={s} className="text-text">
                            {s}.
                          </p>
                        ))}
                        {parts.prices.map((s) => (
                          <p key={s} className="text-rose-200">
                            − {s}.
                          </p>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          );
        })}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted">
        <span style={{ color: STARLIGHT.color }}>
          <AstrolabeGlyph glyph="weaver_star" size={14} />
        </span>
        Between each pair of constellations sits a bridge notable, so a build can reach into a
        neighbour without walking its trunk.
      </p>
    </div>
  );
}

/** Weaver Rank: XP, and what each Rank opens (its Astrolabe totals count `deeds`' points). */
function Ranks({ deeds }: { deeds: number }) {
  const kinds = (['skirmish', 'elite', 'miniboss', 'boss'] as const).map((k) => ({
    k,
    label: { skirmish: 'Skirmish', elite: 'Elite', miniboss: 'Mini-boss', boss: 'Boss' }[k],
  }));
  return (
    <div className="flex flex-col gap-6">
      <div className={GRID}>
        <Panel tone="gold" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="crown" size={22} /> Weaver Rank
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            Every fight earns Weaver XP, won or lost, and XP raises your Rank. Each Rank opens one
            more piece of the build layer, so you meet the beam song first and the rest as you
            learn. XP is kept as each fight ends: quitting a run never loses it. Settings →{' '}
            <b>Skip the unlocks</b> opens everything at once; the Training Grounds always have
            everything.
          </p>
        </Panel>
        <Panel tone="solid" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="star" size={22} /> Weaver XP
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {kinds.map(({ k, label }) => (
              <li key={k} className="flex justify-between gap-3">
                <span className="text-text">{label} won</span>
                <span className="font-mono text-gold-300">+{FIGHT_XP[k]}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3">
              <span className="text-text">A fight lost</span>
              <span className="font-mono text-gold-300">{pct(LOSS_XP)} of it</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-text">Grade S · A · B</span>
              <span className="font-mono text-gold-300">
                ×{GRADE_XP.S} · ×{GRADE_XP.A} · ×{GRADE_XP.B}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-text">Winning the run</span>
              <span className="font-mono text-gold-300">+{RUN_WIN_XP}</span>
            </li>
          </ul>
        </Panel>
      </div>
      <section aria-label="Ranks">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-gold-300">
          <Icon name="lock" size={20} /> What each Rank opens
        </h2>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {RANK_XP.map((xp, i) => {
            const rank = i + 1;
            const preset = CHORD_PRESETS.find((p) => p.rank === rank);
            return (
              <li key={rank}>
                <Panel tone="solid" className="h-full p-4">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-lg font-bold text-gold-200">
                      Rank {rank}
                    </span>
                    <span className="font-mono text-xs text-muted">{fmt(xp)} XP</span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                    {UNLOCKS.filter((u) => u.rank === rank).map((u) => (
                      <li
                        key={u.id}
                        className="flex items-start gap-1.5 leading-snug"
                        data-unlock={u.kind}
                      >
                        <span className="mt-0.5 shrink-0 text-gold-300">
                          <UnlockGlyph unlock={u} size={14} />
                        </span>
                        <span>
                          <b className="text-text">{u.name}</b>{' '}
                          <span className="text-xs text-muted">{u.text}</span>
                        </span>
                      </li>
                    ))}
                    {rankAstrolabeLine(rank, deeds) && (
                      <li className="flex items-center gap-1.5 text-xs leading-snug text-gold-200">
                        <AstrolabeGlyph glyph="weaver_star" size={13} />
                        {rank === ASTROLABE_RANK
                          ? `The Astrolabe: ${rankAstrolabeLine(rank, deeds)}`
                          : rankAstrolabeLine(rank, deeds)}
                      </li>
                    )}
                  </ul>
                  {preset && <p className="mt-2 text-xs text-gold-300">Preset · {preset.name}</p>}
                </Panel>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Calls() {
  const calls = CONTENT.calls;
  return (
    <div className="flex flex-col gap-6">
      <Panel tone="gold" className="p-5">
        <h2
          className="flex items-center gap-2 font-display text-xl font-bold"
          style={{ color: CALL }}
        >
          <Icon name="call" size={22} /> Call and Response
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-text">
          Before a big move, a hero calls for a specific answer: their frame shows a gold glyph, the
          key that answers it and a countdown. Answer in time and the move becomes a{' '}
          <b style={{ color: CALL }}>Flourish</b>, a stronger version of it, and you gain{' '}
          {CONTENT.resonance.gains.response} Resonance. Ignoring a call costs nothing but a short
          delay: they use the plain move when the window closes.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>first call after {calls.firstAfter} s</Chip>
          <Chip>a hero calls at most every {calls.heroCooldown} s</Chip>
        </div>
      </Panel>
      <div className={GRID}>
        {CONTENT.heroes.map((h) => {
          const ability = h.abilities[h.call.ability];
          return (
            <Panel
              key={h.id}
              tone="solid"
              className="p-5"
              style={{ borderTopColor: h.color, borderTopWidth: 3 }}
            >
              <div className="flex items-center gap-3">
                <HeroDisc heroId={h.id} size={40} />
                <div>
                  <h3 className="font-display text-lg font-bold leading-tight">{h.name}</h3>
                  <p className="text-sm text-muted">calls before {ability?.name ?? 'a big move'}</p>
                </div>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-muted">Wants:</span>
                <Chip icon={CALL_ICON[h.call.answer]} color={CALL}>
                  {CALL_ANSWER[h.call.answer]}
                </Chip>
                <span className="text-muted">within {h.call.answerTime} s</span>
              </p>
              <p className="mt-2 font-semibold" style={{ color: CALL }}>
                Flourish · {h.call.flourish.name}
              </p>
              <p className="text-sm leading-relaxed text-text">{h.call.flourish.description}</p>
              {h.call.lines[0] && (
                <p className="mt-2 text-xs italic text-muted">“{h.call.lines[0]}”</p>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function Motifs() {
  const categories = Object.keys(CATEGORY) as (keyof typeof CATEGORY)[];
  return (
    <div className="flex flex-col gap-8">
      {categories.map((cat) => {
        const motifs = CONTENT.motifs.filter((m) => m.category === cat);
        if (motifs.length === 0) return null;
        const c = CATEGORY[cat];
        return (
          <section key={cat} aria-label={c.label}>
            <h2
              className="mb-3 flex items-center gap-2 font-display text-lg font-bold"
              style={{ color: c.color }}
            >
              <Icon name={c.icon} size={20} /> {c.label}
              <span className="text-sm font-normal text-muted">{c.blurb}</span>
            </h2>
            <div className={GRID}>
              {motifs.map((m) => (
                <Panel
                  key={m.id}
                  tone="solid"
                  className="p-4"
                  style={{ borderLeftColor: RARITY[m.rarity].color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{m.name}</h3>
                    <RarityChip rarity={m.rarity} />
                  </div>
                  <ol className="mt-2 flex flex-col gap-1 text-sm leading-snug text-muted">
                    {m.values.map((_, i) => (
                      <li key={i}>
                        <span className="mr-1.5 font-mono text-xs text-gold-300">Lv {i + 1}</span>
                        {motifText(m, i + 1)}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.requires.aura && (
                      <Chip icon="note">
                        needs {CONTENT.auras.find((a) => a.id === m.requires.aura)?.name}
                      </Chip>
                    )}
                    {m.requires.hero && (
                      <Chip icon="link">
                        needs {CONTENT.heroes.find((h) => h.id === m.requires.hero)?.name}
                      </Chip>
                    )}
                    {m.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded border border-ink-500 px-1.5 py-px font-mono text-xs text-muted"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </Panel>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const RELIC_ORDER: RelicRarity[] = ['common', 'rare', 'legendary', 'cursed'];

function Relics() {
  return (
    <div className="flex flex-col gap-8">
      <Panel tone="gold" className="p-5">
        <p className="max-w-4xl text-sm leading-relaxed text-text">
          A motif adds a number; a <b className="text-gold-200">relic changes a rule</b>, for the
          rest of the run. Elites offer 1 of {RELIC_OFFERS.elite.count}, the Bellwarden 1 of{' '}
          {RELIC_OFFERS.boss.count} (rare or legendary), the Unsung Choir 1 of{' '}
          {eventFightRelics('unsung_choir')}. Merchants sell them for Aether. Cursed relics are
          bargains: a forge lifts the curse for {FORGE_PRICE.cleanse} Aether and the blessing stays.
        </p>
      </Panel>
      {RELIC_ORDER.map((rarity) => {
        const relics = CONTENT.relics.filter((r) => r.rarity === rarity);
        const look = RELIC_RARITY[rarity];
        return (
          <section key={rarity} aria-label={look.label}>
            <h2
              className="mb-3 flex items-center gap-2 font-display text-lg font-bold"
              style={{ color: look.color }}
            >
              {look.label}
              <span className="text-sm font-normal text-muted">
                {RELIC_PRICE[rarity]} Aether at a merchant
              </span>
            </h2>
            <div className={GRID}>
              {relics.map((r) => {
                const info = relicInfo(r.id);
                return (
                  <Panel
                    key={r.id}
                    tone="solid"
                    className="p-4"
                    style={{ borderLeftColor: look.color, borderLeftWidth: 3 }}
                  >
                    <div className="flex items-center gap-3">
                      <RelicGlyph icon={info.icon} rarity={info.rarity} size={44} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{info.name}</h3>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <RelicRarityChip rarity={info.rarity} />
                          {info.runOnly && <Chip>Between fights</Chip>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <RelicBody info={info} compact />
                    </div>
                  </Panel>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** A run to read choice tags from (no event live: nothing is greyed out). */
const CODEX_RUN = newRun(1);

function Events() {
  return (
    <div className="flex flex-col gap-8">
      <Panel tone="gold" className="p-5">
        <p className="max-w-4xl text-sm leading-relaxed text-text">
          Events wait on the map between fights: a scene and a few choices, each with a price, a
          risk or nothing at all. Walking away is always allowed. The map names the event before you
          go. Gambles are seeded by the run: the same seed and node always roll the same.
        </p>
      </Panel>
      <div className={GRID}>
        {CONTENT.events.map((ev) => (
          <Panel key={ev.id} tone="solid" className="p-5">
            <div className="flex items-center gap-3">
              <EventGlyph icon={ev.icon} size={46} />
              <div>
                <h2 className="font-display text-xl font-bold leading-tight">{ev.name}</h2>
                <p className="text-sm italic text-muted">{ev.teaser}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text">{ev.text}</p>
            <ul className="mt-3 flex flex-col gap-2.5 border-t border-ink-600/60 pt-3">
              {ev.choices.map((c) => {
                const info = choiceInfo(CODEX_RUN, ev.id, c);
                return (
                  <li key={c.id} className="text-sm">
                    <p className="font-semibold text-gold-200">{c.label}</p>
                    <p className="leading-relaxed text-muted">{c.text}</p>
                    {info.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {info.tags.map((t) => (
                          <Chip key={t.text} icon={t.icon}>
                            {t.text}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}
      </div>
      <section aria-label="Boons and banes">
        <h2 className="mb-3 font-display text-lg font-bold text-gold-300">Boons and banes</h2>
        <div className={GRID}>
          {CONTENT.boons.map((b) => {
            const info = boonInfo({ id: b.id, fights: b.fights });
            return (
              <Panel key={b.id} tone="solid" className="p-4">
                <p className="flex items-center gap-2">
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border"
                    style={boonStyle(info)}
                  >
                    <Glyph icon={info.icon} size={20} />
                  </span>
                  <span className="text-xs text-muted">Lasts {boonDuration(b.id)}</span>
                </p>
                <p className="mt-2 block">
                  <BoonTip info={info} left={false} />
                </p>
              </Panel>
            );
          })}
        </div>
      </section>
    </div>
  );
}

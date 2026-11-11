import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
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
import type { EnemyDef, HeroDef } from '../../content';
import { AnswerGlyph } from '../hud/AnswerGlyph';
import { ROLE_LABEL, bindingLabel, inputLabel, mouseRoleCode, mouseRoleLabel } from '../hud/labels';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { CATEGORY, Chip, RARITY, RarityChip } from '../kit/Chip';
import { fmt, pct } from '../kit/format';
import { Icon, type IconName } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { useMood } from '../kit/sound';
import { useUi } from '../store';
import { HeroDisc } from './shared';
import {
  healCutStackText,
  lockedHeroText,
  lockedHeroes,
  heroTerms,
  harmonyNeeds,
  needsRow,
  passiveIcon,
  passiveRow,
  summonsEntry,
} from './rosterModel';
import { FORGE_PRICE, RELIC_OFFERS, RELIC_PRICE } from '../../meta/economy';
import { eventFightRelics } from '../../meta/run';
import { RELIC_RARITY, RelicGlyph, RelicRarityChip, Glyph } from '../kit/RelicGlyph';
import { glyphKey } from '../kit/iconPaths';
import type { RelicRarity } from '../../content';
import { EventGlyph } from './EventScreen';
import { boonDuration, boonInfo, choiceInfo, relicInfo } from './interlude';
import { BoonTip, RelicBody, boonStyle } from './RelicCard';
import { CALLING_ROWS, eventChoiceShown, newRun } from '../../meta/run';
import { EVERYTHING, EXPEDITION_MOVEMENTS, heroRoster, type Allowance } from '../../meta/profile';
import { ENEMY_LORE } from '../hud/finaleLook';
import { callingLook } from '../kit/CallingGlyph';
import { AxisLegend, CallingPassive, CallingPathPreview, CallingTitle } from './CallingParts';
import { callingOpen } from './CallingPicker';
import { conductorDef, crescendoName, tierWhenList } from './callingText';
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
import { optionsOf, useSettings } from '../../app/settings';
import { UnlockGlyph } from './Rank';
import { bondedHeroes, type Bond } from '../../meta/bonds';
import { BondsCodexPage } from './BondsCodex';
import { TechniquesCodexPage } from './TechniquesCodex';
import { bondsOpen } from './bondsModel';
import { STARLIGHT_LOOK } from '../kit/loomLook';
import { atelierUnlock } from './loomModel';
import { movementInSentence, movementLabel, sightedMovement } from './routeText';
import { attackDamage } from './codexAttack';
import { wakesLabel } from './reliquaryModel';
import { AtlasCodexPage } from './AtlasParts';
import { atlasInContent, atlasStationOpen } from './atlasModel';
import type { ProfileAtlas } from '../../meta/profile';
import { t as txt } from '../text';

const TABS = [
  {
    id: 'heroes',
    get label() {
      return txt('screens.codexScreen.heroes');
    },
  },
  {
    id: 'bonds',
    get label() {
      return txt('screens.codexScreen.bonds');
    },
  },
  {
    id: 'enemies',
    get label() {
      return txt('screens.codexScreen.enemies');
    },
  },
  {
    id: 'weaver',
    get label() {
      return txt('screens.codexScreen.theWeaver');
    },
  },
  {
    id: 'techniques',
    get label() {
      return txt('screens.codexScreen.techniques');
    },
  },
  {
    id: 'auras',
    get label() {
      return txt('screens.codexScreen.auras');
    },
  },
  {
    id: 'chords',
    get label() {
      return txt('screens.codexScreen.songsOrnaments');
    },
  },
  {
    id: 'rank',
    get label() {
      return txt('screens.codexScreen.weaverRank');
    },
  },
  {
    id: 'astrolabe',
    get label() {
      return txt('screens.codexScreen.theAstrolabe');
    },
  },
  {
    id: 'deeds',
    get label() {
      return txt('screens.codexScreen.deeds');
    },
  },
  {
    id: 'reliquary',
    get label() {
      return txt('screens.codexScreen.theReliquary');
    },
  },
  {
    id: 'dissonance',
    get label() {
      return txt('screens.codexScreen.dissonance');
    },
  },
  // Phase 6: the Atlas of Echoes (shown once content has Echoes).
  {
    id: 'atlas',
    get label() {
      return txt('screens.codexScreen.atlasOfEchoes');
    },
  },
  {
    id: 'callings',
    get label() {
      return txt('screens.codexScreen.callings');
    },
  },
  {
    id: 'calls',
    get label() {
      return txt('screens.codexScreen.calls');
    },
  },
  {
    id: 'motifs',
    get label() {
      return txt('screens.codexScreen.motifs');
    },
  },
  {
    id: 'relics',
    get label() {
      return txt('screens.codexScreen.relics');
    },
  },
  {
    id: 'events',
    get label() {
      return txt('screens.codexScreen.events');
    },
  },
] as const;
export type TabId = (typeof TABS)[number]['id'];

const NO_DEEDS: DeedsHeld = { earned: [], best: {} };

/** Phase 4d: Dissonance as the profile holds it (open, and its bests by Calling). */
export interface CodexDissonance {
  open: boolean;
  best: Readonly<Record<string, number>>;
}

/** Phase 4e: the profile's Bonds (ranks, scenes seen) for the Codex's Bonds page. */
export type CodexBonds = Readonly<Record<string, Bond>>;

/** Phase 4f: the technique variants the profile owns, for the Codex's Techniques page. */
export interface CodexTechniques {
  owned: readonly string[];
}

const NO_TECHNIQUES: CodexTechniques = { owned: [] };

const NO_BONDS: CodexBonds = {};

/** The Codex: everything is generated from content, so it can never drift from the game. */
export function CodexView({
  onBack,
  initialTab = 'heroes',
  allowance = EVERYTHING,
  rank = MAX_RANK,
  deeds = NO_DEEDS,
  dissonance,
  bonds,
  techniques = NO_TECHNIQUES,
  seen,
  roster,
  atlas,
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
  /**
   * Phase 4e: the profile's Bonds. Omitted: open with everything (the default allowance), with no
   * Bond XP and no scenes seen; else locked until a hero's first Bond rank-up.
   */
  bonds?: CodexBonds;
  /**
   * Phase 4f: the variants the profile owns (omitted: none). Every variant is open with Skip the
   * unlocks (the allowance's `all`; the default allowance is everything).
   */
  techniques?: CodexTechniques;
  /**
   * Phase 5a: the enemies the profile has sighted (`profile.seen`). Unseen enemies show as locked
   * silhouettes, and a later Movement's events wait until its enemies are met. Omitted: all seen.
   */
  seen?: readonly string[];
  /**
   * Phase 5b: the profile's hero roster (`heroRoster`). Heroes outside it, and their motifs, don't
   * show yet (docs/phase-5b.md). Omitted: the starters, or every hero with Skip the unlocks.
   */
  roster?: readonly string[];
  /**
   * Phase 6: the Atlas's stars (`profile.atlas`, null while none is lit). Omitted (undefined): no
   * Atlas tab, as before Phase 6 (the UI lab's and tests' older views).
   */
  atlas?: ProfileAtlas | null;
}) {
  useMood('title');
  const [tab, setTab] = useState<TabId>(initialTab);
  // Phase 4g: Escape goes back too (to the Loom, or wherever the Codex was opened from).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
  // Phase 4c: the Reliquary's page is locked until it opens (Rank 10, or Skip the unlocks).
  const reliquary = reliquaryOpen(rank, allowance.all);
  // Phase 4d: Dissonance's too, until a win at its Rank (or Skip the unlocks).
  const dissonant = dissonance ? dissonance.open || allowance.all : allowance.all;
  // Phase 5b: the heroes the player has (the starters until a recruit; all, Skip the unlocks).
  const heroes = roster ?? heroRoster({}, allowance.all);
  const bondHeroes = bondedHeroes().filter((h) => heroes.includes(h));
  // Phase 4e: Bonds' too, until a hero's first Bond rank-up (or Skip the unlocks).
  const bonded = bondsOpen(bonds ?? NO_BONDS, allowance.all, bondHeroes);
  // Phase 6: the Atlas opens with Dissonance; its tab shows only once content has Echoes.
  const atlasOpen = atlasStationOpen(dissonant, false);
  const tabs = TABS.filter((t) => t.id !== 'atlas' || (atlas !== undefined && atlasInContent()));
  const locked = (id: TabId) =>
    (id === 'reliquary' && !reliquary) ||
    (id === 'dissonance' && !dissonant) ||
    (id === 'atlas' && !atlasOpen) ||
    (id === 'bonds' && !bonded);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.id === tab);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
    setTab(next.id);
    e.currentTarget.querySelector<HTMLElement>(`#tab-${next.id}`)?.focus();
    e.preventDefault();
  };
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ScreenHeader
          eyebrow={txt('screens.codexScreen.reference')}
          title={txt('screens.codexScreen.codex')}
          right={
            <Button variant="secondary" onClick={onBack} sound="back">
              <Icon name="back" size={16} /> {txt('screens.codexScreen.back')}
            </Button>
          }
        />
        <div
          role="tablist"
          aria-label={txt('screens.codexScreen.codexSections')}
          onKeyDown={onKey}
          className="mt-6 flex flex-wrap gap-2 border-b border-ink-600/60 pb-3"
        >
          {tabs.map((t) => (
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
              {locked(t.id) && (
                <span className="sr-only"> {txt('screens.codexScreen.locked')}</span>
              )}
            </button>
          ))}
        </div>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6">
          {tab === 'heroes' && <Heroes roster={heroes} />}
          {tab === 'bonds' && (
            <BondsCodexPage open={bonded} bonds={bonds ?? NO_BONDS} heroes={bondHeroes} />
          )}
          {tab === 'enemies' && <Enemies seen={seen} />}
          {tab === 'weaver' && <Weaver />}
          {tab === 'techniques' && (
            <TechniquesCodexPage owned={techniques.owned} all={allowance.all} />
          )}
          {tab === 'auras' && <Auras />}
          {tab === 'chords' && <Chords />}
          {tab === 'rank' && <Ranks deeds={deedPoints(deeds.earned)} />}
          {tab === 'astrolabe' && <Astrolabe onDeeds={() => setTab('deeds')} />}
          {tab === 'deeds' && (
            <DeedsPage
              held={deeds}
              seen={seen}
              roster={heroes}
              open={{
                allowance,
                astrolabe: astrolabeOpen(rank, allowance.all),
                ...(dissonance ? { endgame: dissonant } : {}),
              }}
            />
          )}
          {tab === 'reliquary' && <ReliquaryCodexPage open={reliquary} rank={rank} />}
          {tab === 'dissonance' && (
            <DissonanceCodexPage open={dissonant} rank={rank} best={dissonance?.best} />
          )}
          {tab === 'atlas' && <AtlasCodexPage open={atlasOpen} atlas={atlas ?? undefined} />}
          {tab === 'callings' && <Callings allowance={allowance} />}
          {tab === 'calls' && <Calls roster={heroes} />}
          {tab === 'motifs' && <Motifs roster={heroes} />}
          {tab === 'relics' && <Relics />}
          {tab === 'events' && <Events seen={seen} allowance={allowance} />}
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
  const atlas = useProfile((s) => s.profile.atlas);
  const weekly = useProfile((s) => s.profile.weekly);
  const dissonance = useCodexDissonance();
  const bonds = useCodexBonds();
  const techniques = useCodexTechniques();
  const seen = useProfile((s) => s.profile.seen);
  const roster = useCodexRoster();
  return (
    <CodexView
      onBack={back}
      allowance={allowance}
      rank={rankOf(xp)}
      deeds={{ earned, best, atlas, weekly }}
      atlas={atlas ?? null}
      dissonance={dissonance}
      bonds={bonds}
      techniques={techniques}
      seen={seen}
      roster={roster}
    />
  );
}

/** The technique variants the profile owns, for the Codex's Techniques page (Phase 4f). */
export function useCodexTechniques(): CodexTechniques {
  const owned = useProfile((s) => s.profile.variants);
  return useMemo(() => ({ owned }), [owned]);
}

/** The profile's Bonds, for the Codex's Bonds page (Phase 4e). */
export function useCodexBonds(): CodexBonds {
  return useProfile((s) => s.profile.bonds);
}

/** Phase 5b: the heroes the Codex shows, from the profile (and Settings → Skip the unlocks). */
export function useCodexRoster(): string[] {
  const recruited = useProfile((s) => s.profile.recruited);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  return useMemo(() => heroRoster({ recruited }, unlockAll), [recruited, unlockAll]);
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
  // The Expedition's road brings the tiers at its own rows (its first Movement is shorter).
  const road = tierWhenList(CALLING_ROWS.length, { movements: EXPEDITION_MOVEMENTS });
  const expeditionTiers = road === tierWhenList(CALLING_ROWS.length) ? null : road;
  return (
    <div className="flex flex-col gap-6">
      <Panel tone="gold" className="p-5">
        <p className="max-w-4xl text-sm leading-relaxed text-text">
          {txt('screens.codexScreen.a')}{' '}
          <b className="text-gold-200">{txt('screens.codexScreen.calling')}</b>{' '}
          {txt('screens.codexScreen.isTheWeaverS')} <b>{txt('screens.codexScreen.path')}</b>
          {txt('screens.codexScreen.tiersOfTwoOptions', {
            length: CALLING_ROWS.length,
            tierWhenList: tierWhenList(CALLING_ROWS.length),
          })}
          {expeditionTiers && (
            // The Finale's shorter road (docs/phase-5d.md) moves them on an Expedition.
            <span data-testid="codex-calling-road">
              {txt('screens.codexScreen.onAnExpeditionS', { expeditionTiers })}
            </span>
          )}{' '}
          {txt('screens.codexScreen.eachPickLastsThe', {
            bindingLabel: bindingLabel('bear'),
            bindingLabel2: bindingLabel('reel'),
          })}
        </p>
      </Panel>
      {CONTENT.callings.map((def) => {
        const open = callingOpen(allowance, def.id);
        const look = callingLook(def.id);
        const rank = unlockRank('calling', def.id);
        return (
          <section
            key={def.id}
            aria-label={txt('screens.codexScreen.the', { name: def.name })}
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
                    <Chip color={look.text} icon={look.icon}>
                      {allowance.all
                        ? txt('screens.codexScreen.openUnlocksSkipped')
                        : txt('screens.codexScreen.unlockedAtRank', { rank })}
                    </Chip>
                  ) : (
                    <Chip icon="lock">{txt('screens.codexScreen.rank', { rank })}</Chip>
                  )}
                </span>
              </div>
              <p className="mt-3 text-sm italic text-muted">“{def.flavor}”</p>
              <div className="mt-3 max-w-4xl">
                <CallingPassive def={def} />
              </div>
              {!open && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                  <Icon name="lock" size={14} />{' '}
                  {txt('screens.codexScreen.reachWeaverRankTo', { rank })}
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

function Heroes({ roster }: { roster: readonly string[] }) {
  // Phase 5e: Seren's and Oro's words, once one of them is in the roster.
  const terms = heroTerms(roster);
  const grid = (
    <div className={GRID}>
      {CONTENT.heroes
        .filter((h) => roster.includes(h.id))
        .map((h) => (
          <HeroEntry key={h.id} hero={h} />
        ))}
      {lockedHeroes(roster).map((id) => (
        <LockedHero key={id} heroId={id} />
      ))}
    </div>
  );
  if (terms.length === 0) return grid;
  return (
    <div className="flex flex-col gap-6">
      {grid}
      <Panel tone="solid" className="p-5" data-testid="codex-hero-terms">
        <h2 className="font-display text-lg font-bold">{txt('screens.codexScreen.terms')}</h2>
        <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          {terms.map((t) => (
            <div key={t.term} data-term={t.term}>
              <dt className="font-semibold text-text">{t.term}</dt>
              <dd className="text-xs leading-relaxed text-muted">{t.text}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

/**
 * Phase 5b: a hero not yet in the roster (docs/phase-5b.md), as a silhouette: no name, no kit,
 * only how he is earned (both routes). Used on the Heroes and Calls pages.
 */
function LockedHero({ heroId, compact = false }: { heroId: string; compact?: boolean }) {
  const how = lockedHeroText(heroId);
  return (
    <Panel
      tone="solid"
      className={`border-dashed ${compact ? 'p-4' : 'p-5'}`}
      data-testid="codex-hero-locked"
      data-hero={heroId}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-950/80 text-ink-600"
          aria-hidden
        >
          <Icon name="lock" size={20} />
        </span>
        <h2 className="font-display text-xl font-bold text-muted">
          {txt('screens.codexScreen.aHeroNotYet')}
        </h2>
      </div>
      {how && <p className="mt-3 text-sm leading-relaxed text-muted">{how}</p>}
    </Panel>
  );
}

function HeroEntry({ hero: h }: { hero: HeroDef }) {
  // Phase 5b: a passive and what they need of you, only for a hero who has them (Brann).
  const passive = passiveRow(h);
  const stack = healCutStackText(h);
  const needs = needsRow(h);
  // Phase 5e: Oro's "Saplings and the Ancient" (empty for every hero without summons).
  const summons = summonsEntry(h);
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
        <Chip icon="heart">{txt('screens.codexScreen.life', { maxHp: fmt(h.maxHp) })}</Chip>
        {h.armor > 0 && (
          <Chip icon="ward">{txt('screens.codexScreen.armour', { armor: pct(h.armor) })}</Chip>
        )}
        <Chip>
          {h.attack.kind === 'melee'
            ? txt('screens.codexScreen.melee')
            : txt('screens.codexScreen.ranged')}
        </Chip>
      </div>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        {h.abilities.map((a) => (
          <div key={a.id}>
            <dt className="font-semibold">
              {a.name}{' '}
              <span className="font-mono text-xs font-normal text-muted">
                {txt('screens.codexScreen.s', { cooldown: a.cooldown })}
              </span>
            </dt>
            <dd className="text-xs leading-relaxed text-muted">{a.description}</dd>
          </div>
        ))}
        <div>
          <dt className="font-semibold text-gold-200">
            {txt('screens.codexScreen.solo', { name: h.solo.name })}
          </dt>
          <dd className="text-xs leading-relaxed text-muted">{h.solo.description}</dd>
          <dd className="text-xs leading-relaxed text-gold-300">{h.solo.cuedDescription}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 font-semibold" style={{ color: CALL }}>
            <Icon name="call" size={14} />{' '}
            {txt('screens.codexScreen.call', {
              value: CALL_ANSWER[h.call.answer],
              name: h.call.flourish.name,
            })}
          </dt>
          <dd className="text-xs leading-relaxed text-muted">{h.call.flourish.description}</dd>
        </div>
        <div>
          <dt className="font-semibold">
            {txt('screens.codexScreen.quirk', { name: h.quirk.name })}
          </dt>
          <dd className="text-xs leading-relaxed text-muted">{h.quirk.description}</dd>
        </div>
        {passive && (
          <div data-testid={`codex-passive-${h.id}`}>
            {h.passive && h.passive.id !== 'bloodRage' ? (
              <dt className="flex items-center gap-1.5 font-semibold">
                <Icon name={passiveIcon(h)} size={14} className="text-muted" />
                {txt('screens.codexScreen.passive', { name: passive.name })}
              </dt>
            ) : (
              // Brann's entry (and any passive without a glyph) is byte-equal to before Phase 5e.
              <dt className="font-semibold">
                {txt('screens.codexScreen.passive', { name: passive.name })}
              </dt>
            )}
            <dd className="text-xs leading-relaxed text-muted">{passive.text}</dd>
            {stack && (
              <dd
                className="mt-1 text-xs leading-relaxed text-muted"
                data-testid={`codex-heal-stack-${h.id}`}
              >
                {stack}
              </dd>
            )}
          </div>
        )}
        {summons.length > 0 && (
          <div data-testid={`codex-summons-${h.id}`}>
            <dt className="flex items-center gap-1.5 font-semibold">
              <Icon name="leaf" size={14} className="text-muted" />{' '}
              {txt('screens.codexScreen.saplingsAndTheAncient')}
            </dt>
            {summons.map((line) => (
              <dd key={line} className="text-xs leading-relaxed text-muted">
                {line}
              </dd>
            ))}
          </div>
        )}
        {needs && (
          <div data-testid={`codex-needs-${h.id}`}>
            <dt className="font-semibold">{txt('screens.codexScreen.needs')}</dt>
            <dd className="text-xs leading-relaxed text-muted">{needs}</dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}

const CALL = 'var(--color-call, #fde68a)';
const CALL_ANSWER = {
  get ward() {
    return txt('screens.codexScreen.callWard');
  },
  get empower() {
    return txt('screens.codexScreen.callEmpower');
  },
  get chime() {
    return txt('screens.codexScreen.callChime');
  },
};
const CALL_ICON = { ward: 'ward', empower: 'empower', chime: 'chime' } as const;

/**
 * The enemies, by Movement (Phase 5a), in content order. One not sighted yet is a locked
 * silhouette: its name and lessons wait until it's met.
 */
function Enemies({ seen }: { seen?: readonly string[] }) {
  const known = seen ? new Set(seen) : null;
  const groups = byMovement(CONTENT.enemies);
  return (
    <div className="flex flex-col gap-8">
      {groups.map(({ movement, items }) => (
        <section
          key={movement}
          aria-label={movementLabel(movement)}
          data-testid={`codex-enemies-${movement}`}
        >
          {groups.length > 1 && <MovementHeading movement={movement} />}
          <div className={GRID}>
            {items.map((e) =>
              !known || known.has(e.id) ? (
                <EnemyEntry key={e.id} enemy={e} />
              ) : (
                <LockedEnemy key={e.id} enemy={e} />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Content's entries grouped by Movement (content `movement`, 1 when absent), in order. */
function byMovement<T extends { movement?: number }>(
  items: readonly T[],
): { movement: number; items: T[] }[] {
  const groups: { movement: number; items: T[] }[] = [];
  for (const item of items) {
    const m = item.movement ?? 1;
    let g = groups.find((x) => x.movement === m);
    if (!g) groups.push((g = { movement: m, items: [] }));
    g.items.push(item);
  }
  return groups.sort((a, b) => a.movement - b.movement);
}

function MovementHeading({ movement }: { movement: number }) {
  const def = CONTENT.movements[movement - 1];
  return (
    <h2 className="mb-3 flex items-baseline gap-2 font-display text-lg font-bold text-gold-300">
      {movementLabel(movement)}
      {/* A labelled Movement (the Finale) is named by its place, not its name twice. */}
      {def && (
        <span className="text-sm font-normal text-muted">
          · {def.label === movementLabel(movement) ? def.mapTitle : def.name}
        </span>
      )}
    </h2>
  );
}

/** An enemy not met yet: a silhouette, its role, and when it shows. */
function LockedEnemy({ enemy: e }: { enemy: EnemyDef }) {
  const boss = e.role === 'boss' || e.role === 'miniboss';
  return (
    <Panel
      tone="solid"
      className={`border-dashed p-5 ${boss ? 'md:col-span-2' : ''}`}
      data-testid="codex-enemy-locked"
      data-enemy={e.id}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-muted">
          <Icon name="lock" size={16} /> {txt('screens.codexScreen.unknownFoe')}
        </h2>
        <Chip icon={boss ? 'eye' : 'skull'}>{e.role}</Chip>
      </div>
      <div
        className="mt-3 flex h-20 items-center justify-center rounded-lg bg-ink-950/70 text-ink-600"
        aria-hidden
      >
        <Icon name={boss ? 'eye' : 'skull'} size={44} />
      </div>
      <p className="mt-3 text-sm text-muted">
        {txt('screens.codexScreen.metInItsEntry', {
          movementInSentence: movementInSentence(e.movement ?? 1),
        })}
      </p>
    </Panel>
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
      {ENEMY_LORE[e.id] && (
        <p className="mt-1.5 text-sm italic leading-relaxed text-muted" data-testid="codex-lore">
          {ENEMY_LORE[e.id]}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip icon="heart">{txt('screens.codexScreen.life2', { hp: fmt(e.hp) })}</Chip>
        <Chip>
          {txt('screens.codexScreen.perHit', {
            value:
              e.basic.kind === 'melee'
                ? txt('screens.codexScreen.melee')
                : txt('screens.codexScreen.ranged'),
            damage: e.basic.damage,
          })}
        </Chip>
        {e.suppressRadius > 0 && (
          <Chip icon="mute">
            {txt('screens.codexScreen.silencesAurasWithinM', { suppressRadius: e.suppressRadius })}
          </Chip>
        )}
        {/* Movement III (docs/phase-5c.md): a body that never moves, a Spindle's tether. */}
        {e.stationary && <Chip icon="pin">{txt('screens.codexScreen.neverMoves')}</Chip>}
        {e.tether && (
          <Chip icon="spindle">
            {txt('screens.codexScreen.theBossTakesLess', { round: Math.round(e.tether.dr * 100) })}
          </Chip>
        )}
      </div>
      {attacks.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {attacks.map((a) => (
            <li key={a.id} className="rounded-lg bg-ink-900/60 p-3">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-semibold">
                {a.name}
                <span className="font-mono text-xs font-normal text-muted">
                  {txt('screens.codexScreen.sWindUp', {
                    kind: a.kind,
                    windup: a.windup,
                    attackDamage: attackDamage(a),
                  })}
                </span>
              </p>
              {a.cut && (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-indigo-200">
                  <Icon name="threadCut" size={13} />
                  {txt('screens.codexScreen.lockedS', {
                    value: a.cut.always
                      ? txt('screens.codexScreen.cutsYourThread')
                      : txt('screens.codexScreen.cutsYourThreadIf'),
                    lock: a.cut.lock,
                  })}
                </p>
              )}
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {txt('screens.codexScreen.answer')}
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
  // The Calling whose Cues chain into Duets and Trios (Phase 5f), for Resonance's entry.
  const conductor = conductorDef();
  const r = CONTENT.resonance;
  const th = CONTENT.thread;
  // Key names follow the player's bindings, mouse roles and Cue modifier (Phase 7, W1).
  useSettings((s) => s.settings.bindings);
  const controls = useSettings((s) => optionsOf(s.settings).input);
  const key = bindingLabel;
  const threadClick = mouseRoleCode('thread') === 'Mouse0' ? 'click' : mouseRoleLabel('thread');
  const wheelMiddle = mouseRoleCode('wheel') === 'Mouse1';
  const cueMod = inputLabel(controls.cueModifier || 'Shift');
  const entries: {
    name: string;
    icon: IconName;
    keys: string;
    body: string;
    stats: string[];
  }[] = [
    {
      name: txt('screens.codexScreen.thread'),
      icon: 'thread',
      keys: `${key('focus1')}–${key('focus4')} / ${threadClick}, ${mouseRoleLabel('mode')}`,
      body: txt('screens.codexScreen.tieYourThreadTo', { bindingLabel: bindingLabel('bear') }),
      stats: [
        txt('screens.codexScreen.mendS', { mendPerSec: th.mendPerSec }),
        txt('screens.codexScreen.empowerDamage', { empowerMore: pct(th.empowerMore) }),
        txt('screens.codexScreen.fullStrengthToM', { comfortRange: th.comfortRange }),
        txt('screens.codexScreen.snapsAtM', { snapRange: th.snapRange }),
      ],
    },
    {
      name: t.ward.name,
      icon: 'ward',
      keys: key('ward'),
      body: txt('screens.codexScreen.aBarrierWorthOf', {
        barrierPct: pct(t.ward.barrierPct),
        barrierFlat: t.ward.barrierFlat,
        perfectWindow: t.ward.perfectWindow,
        perfectRefund: pct(t.ward.perfectRefund),
      }),
      stats: [
        txt('screens.codexScreen.spirit', { cost: t.ward.cost }),
        txt('screens.codexScreen.sCooldown', { cooldown: t.ward.cooldown }),
        txt('screens.codexScreen.mRange', { range: t.ward.range }),
      ],
    },
    {
      name: t.chime.name,
      icon: 'chime',
      keys: key('chime'),
      body: txt('screens.codexScreen.aBellLandsUnder', {
        radius: t.chime.radius,
        immunity: t.chime.immunity,
        clutchWindow: t.chime.clutchWindow,
      }),
      stats: [
        txt('screens.codexScreen.spirit', { cost: t.chime.cost }),
        txt('screens.codexScreen.sCooldown', { cooldown: t.chime.cooldown }),
        txt('screens.codexScreen.mRange', { range: t.chime.range }),
      ],
    },
    {
      name: t.reel.name,
      icon: 'reel',
      keys: key('reel'),
      body: txt('screens.codexScreen.yankAHeroTo', {
        value: rewind
          ? txt('screens.codexScreen.onAChronomancerRun', {
              rewind: rewind.values.rewind,
              cooldown: rewind.values.cooldown,
            })
          : '',
      }),
      stats: [
        txt('screens.codexScreen.spirit', { cost: t.reel.cost }),
        txt('screens.codexScreen.sCooldown', { cooldown: t.reel.cooldown }),
        txt('screens.codexScreen.mRange', { range: t.reel.range }),
      ],
    },
    {
      name: t.glide.name,
      icon: 'glide',
      keys: key('glide'),
      body: txt('screens.codexScreen.aShortDashWith', { iframes: t.glide.iframes }),
      stats: [
        txt('screens.codexScreen.sCooldown', { cooldown: t.glide.cooldown }),
        `${t.glide.distance} m`,
      ],
    },
    {
      name: txt('screens.codexScreen.resonance'),
      icon: 'note',
      keys: `${key('cue')} / ${key('crescendo')}`,
      body: txt('screens.codexScreen.goodSupportFillsThe', {
        max: r.max,
        segment: r.segment,
        key: key('cue'),
        cueMod,
        key2: key('crescendo'),
        name: CONTENT.crescendo.name,
        description: CONTENT.crescendo.description,
        value: conductor
          ? txt('screens.codexScreen.onARunA', {
              name: conductor.name,
              value: conductor.values.cue ?? r.segment,
              value2: conductor.values.chain ?? 0,
              value3: conductor.values.duet ?? 0,
              value4: conductor.values.trio ?? 0,
              crescendoName: crescendoName(conductor),
            })
          : '',
      }),
      stats: [
        txt('screens.codexScreen.perfectWard', { perfectWard: r.gains.perfectWard }),
        txt('screens.codexScreen.save', { save: r.gains.save }),
        txt('screens.codexScreen.clutchChime', { clutchChime: r.gains.clutchChime }),
        txt('screens.codexScreen.reelDodge', { reelDodge: r.gains.reelDodge }),
        txt('screens.codexScreen.answeredCall', { response: r.gains.response }),
      ],
    },
    {
      name: txt('screens.codexScreen.directives'),
      icon: 'wheel',
      keys: txt('screens.codexScreen.hold', {
        key: key('directiveWheel'),
        mouseRoleLabel: mouseRoleLabel('wheel'),
      }),
      body: txt('screens.codexScreen.holdOrForThe', {
        key: key('directiveWheel'),
        value: wheelMiddle
          ? txt('screens.codexScreen.theMiddleMouseButton')
          : mouseRoleLabel('wheel'),
        value2: wheelMiddle
          ? txt('screens.codexScreen.middleClick')
          : txt('screens.codexScreen.pressOf', { mouseRoleLabel: mouseRoleLabel('wheel') }),
      }),
      stats: [
        txt('screens.codexScreen.focusRallyHoldScatter'),
        txt('screens.codexScreen.focus', { key: key('directiveFocus') }),
        txt('screens.codexScreen.rally', { key: key('directiveRally') }),
        txt('screens.codexScreen.hold2', { key: key('directiveHold') }),
      ],
    },
    {
      name: txt('screens.codexScreen.withoutYou'),
      icon: 'eye',
      keys: txt('screens.codexScreen.afterEachFight'),
      body: txt('screens.codexScreen.whenAFightEnds', {
        round: Math.round(WITHOUT_YOU_MAX_SECONDS / 60),
      }),
      stats: [
        txt('screens.codexScreen.sameSeedSameEnemies'),
        txt('screens.codexScreen.shownOnResultAnd'),
      ],
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
            <Chip icon="sparkle">
              {txt('screens.codexScreen.reservesOfSpirit', { reserve: pct(a.reserve) })}
            </Chip>
            <Chip icon="lock">
              {txt('screens.codexScreen.rank2', { unlockRank: unlockRank('aura', a.id) })}
            </Chip>
          </div>
        </Panel>
      ))}
    </div>
  );
}

const ANCHOR_TEXT = {
  get weaver() {
    return txt('screens.codexScreen.aroundYou');
  },
  get planted() {
    return txt('screens.codexScreen.plantedWhereYouPut');
  },
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
            <Icon name="thread" size={22} /> {txt('screens.codexScreen.theBeamSong')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            {txt('screens.codexScreen.yourFirstChordRides')}
            <b>{mult(w.beamFocus)}</b>
            {txt('screens.codexScreen.whereverTheyAreAnd')} <b>{mult(w.beamEcho)}</b>
            {txt('screens.codexScreen.whoYouThreadDecides')}
            {unison && (
              <>
                {txt('screens.codexScreen.with')}{' '}
                <b style={{ color: unison.color }}>{unison.name}</b>{' '}
                {txt('screens.codexScreen.itGoesAllIn', {
                  mult: mult(w.beamFocus * unison.focusMult),
                })}
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip icon="thread">
              {txt('screens.codexScreen.onYourThreadedHero', { mult: mult(w.beamFocus) })}
            </Chip>
            <Chip icon="scatter">
              {txt('screens.codexScreen.echoWithinM', {
                mult: mult(w.beamEcho),
                fieldRadius: w.fieldRadius,
              })}
            </Chip>
            <Chip icon="lock">
              {txt('screens.codexScreen.rank2', { unlockRank: unlockRank('song', 'beam') })}
            </Chip>
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
            <Icon name="scatter" size={22} /> {txt('screens.codexScreen.theFieldSong')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            {txt('screens.codexScreen.yourSecondChordSurrounds', {
              fieldRadius: w.fieldRadius,
              auraSlots: w.auraSlots,
              ornamentSlots: w.ornamentSlots,
              cost: CONTENT.techniques.ward.cost,
              cost2: CONTENT.techniques.chime.cost,
              cost3: CONTENT.techniques.reel.cost,
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip>{txt('screens.codexScreen.n1WithinM', { fieldRadius: w.fieldRadius })}</Chip>
            <Chip>{txt('screens.codexScreen.mAtMost', { fieldRadiusCap: w.fieldRadiusCap })}</Chip>
            <Chip icon="lock">
              {txt('screens.codexScreen.rank2', { unlockRank: unlockRank('song', 'field') })}
            </Chip>
          </div>
        </Panel>
        <Panel tone="solid" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="sparkle" size={22} /> {txt('screens.codexScreen.chorusPulse')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            {txt('screens.codexScreen.singOrMoreAuras', {
              minAuras: c.minAuras,
              healPctPerAura: pct(c.healPctPerAura),
              barrierPctPerAura: pct(c.barrierPctPerAura),
              barrierDuration: c.barrierDuration,
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip icon="mend">
              {txt('screens.codexScreen.healPerAura', { healPctPerAura: pct(c.healPctPerAura) })}
            </Chip>
            <Chip icon="ward">
              {txt('screens.codexScreen.barrierPerAura', {
                barrierPctPerAura: pct(c.barrierPctPerAura),
              })}
            </Chip>
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
              <Icon name="fermata" size={22} /> {txt('screens.codexScreen.fermataHold')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text">
              {txt('screens.codexScreen.withTheFermataAura', {
                value: fermata.effects.holdTime ?? 1.5,
              })}
              <b>{txt('screens.codexScreen.heldHeal')}</b>{' '}
              {txt('screens.codexScreen.withACountdownHeal')}
            </p>
          </Panel>
        )}
      </div>
      <section aria-label={txt('screens.codexScreen.ornaments')}>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-gold-300">
          <Icon name="diamond" size={20} /> {txt('screens.codexScreen.ornaments')}
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
                {o.reserveMult !== 1 && (
                  <Chip icon="sparkle">
                    {txt('screens.codexScreen.reserve', { mult: mult(o.reserveMult) })}
                  </Chip>
                )}
                {o.effectMult !== 1 && (
                  <Chip icon="empower">
                    {txt('screens.codexScreen.effect', { mult: mult(o.effectMult) })}
                  </Chip>
                )}
                {o.radiusMult !== 1 && (
                  <Chip icon="scatter">
                    {txt('screens.codexScreen.radius', { mult: mult(o.radiusMult) })}
                  </Chip>
                )}
                {o.focusMult !== 1 && (
                  <Chip icon="thread">
                    {txt('screens.codexScreen.beam', { mult: mult(w.beamFocus * o.focusMult) })}
                  </Chip>
                )}
                <Chip icon={o.echoMult === 0 ? 'thread' : o.anchor === 'planted' ? 'pin' : 'note'}>
                  {o.echoMult === 0
                    ? txt('screens.codexScreen.onlyYourThreadedHero')
                    : ANCHOR_TEXT[o.anchor]}
                </Chip>
                {o.roles.length === 1 && (
                  <Chip icon="info">
                    {txt('screens.codexScreen.only', {
                      value:
                        o.roles[0] === 'beam'
                          ? txt('screens.codexScreen.beamSong')
                          : txt('screens.codexScreen.fieldSong'),
                    })}
                  </Chip>
                )}
                <Chip icon="lock">
                  {txt('screens.codexScreen.rank2', { unlockRank: unlockRank('ornament', o.id) })}
                </Chip>
                {o.excludes.map((x) => (
                  <Chip key={x} icon="close" color="var(--color-threat)">
                    {txt('screens.codexScreen.notWith', { name: ornamentDef(x).name })}
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
            <AstrolabeGlyph glyph="weaver_star" size={22} />{' '}
            {txt('screens.codexScreen.theAstrolabe')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            {txt('screens.codexScreen.aStarMapOf', {
              ASTROLABE_RANK,
              first,
              top,
              MAX_RANK,
              length: STARS.length,
            })}
            <button
              type="button"
              onClick={onDeeds}
              className="font-semibold text-gold-200 underline decoration-gold-400/60 underline-offset-2 hover:text-gold-100"
            >
              {txt('screens.codexScreen.deeds')}
            </button>{' '}
            {txt('screens.codexScreen.addUpToMore', { DEED_POINTS_MAX, all })}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text">
            {txt('screens.codexScreen.giveAStarBack')}
            <b>{txt('screens.codexScreen.skipTheUnlocks')}</b>{' '}
            {txt('screens.codexScreen.givesAllPoints', { all })}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            {(['travel', 'notable', 'great', 'keystone'] as const).map((kind) => (
              <li key={kind}>
                <b className="text-text">{KIND_LABEL[kind]}</b>{' '}
                {
                  {
                    travel: txt('screens.codexScreen.smallNumbersOnThe'),
                    notable: txt('screens.codexScreen.aNewRuleOr'),
                    great: txt('screens.codexScreen.theHeroesRimStars'),
                    keystone: txt('screens.codexScreen.aRuleThatBends'),
                  }[kind]
                }
              </li>
            ))}
          </ul>
        </Panel>
        <Panel tone="solid" className="p-3">
          <AstrolabeMap tree={[]} mini label={txt('screens.codexScreen.theAstrolabeSFour')} />
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
                {txt('screens.codexScreen.starsNotables', {
                  length: stars.length,
                  notables: notables.map((n) => n.name).join(', '),
                })}
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
        {txt('screens.codexScreen.betweenEachPairOf')}
      </p>
    </div>
  );
}

/** Weaver Rank: XP, and what each Rank opens (its Astrolabe totals count `deeds`' points). */
function Ranks({ deeds }: { deeds: number }) {
  const kinds = (['skirmish', 'elite', 'miniboss', 'boss'] as const).map((k) => ({
    k,
    label: {
      skirmish: txt('screens.codexScreen.kind.skirmish'),
      elite: txt('screens.codexScreen.kind.elite'),
      miniboss: txt('screens.codexScreen.kind.miniboss'),
      boss: txt('screens.codexScreen.kind.boss'),
    }[k],
  }));
  return (
    <div className="flex flex-col gap-6">
      <div className={GRID}>
        <Panel tone="gold" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="crown" size={22} /> {txt('screens.codexScreen.weaverRank')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            {txt('screens.codexScreen.everyFightEarnsWeaver')}
            <b>{txt('screens.codexScreen.skipTheUnlocks')}</b>{' '}
            {txt('screens.codexScreen.opensEverythingAtOnce')}
          </p>
        </Panel>
        <Panel tone="solid" className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gold-200">
            <Icon name="star" size={22} /> {txt('screens.codexScreen.weaverXp')}
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {kinds.map(({ k, label }) => (
              <li key={k} className="flex justify-between gap-3">
                <span className="text-text">{txt('screens.codexScreen.won', { label })}</span>
                <span className="font-mono text-gold-300">+{FIGHT_XP[k]}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3">
              <span className="text-text">{txt('screens.codexScreen.aFightLost')}</span>
              <span className="font-mono text-gold-300">
                {txt('screens.codexScreen.ofIt', { LOSS_XP: pct(LOSS_XP) })}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-text">{txt('screens.codexScreen.gradeSAB')}</span>
              <span className="font-mono text-gold-300">
                ×{GRADE_XP.S} · ×{GRADE_XP.A} · ×{GRADE_XP.B}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-text">{txt('screens.codexScreen.winningTheRun')}</span>
              <span className="font-mono text-gold-300">+{RUN_WIN_XP}</span>
            </li>
          </ul>
        </Panel>
      </div>
      <section aria-label={txt('screens.codexScreen.ranks')}>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-gold-300">
          <Icon name="lock" size={20} /> {txt('screens.codexScreen.whatEachRankOpens')}
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
                      {txt('screens.codexScreen.rank', { rank })}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {txt('screens.codexScreen.xp', { xp: fmt(xp) })}
                    </span>
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
                    {(() => {
                      // Phase 4g: the Atelier opens at its Rank (not one of the profile's unlocks).
                      const atelier = atelierUnlock(rank);
                      return (
                        atelier && (
                          <li
                            className="flex items-start gap-1.5 leading-snug"
                            data-unlock="atelier"
                          >
                            <span
                              className="mt-0.5 shrink-0"
                              style={{ color: STARLIGHT_LOOK.color }}
                            >
                              <Icon name="starlight" size={14} />
                            </span>
                            <span>
                              <b className="text-text">{atelier.name}</b>{' '}
                              <span className="text-xs text-muted">{atelier.text}</span>
                            </span>
                          </li>
                        )
                      );
                    })()}
                    {rankAstrolabeLine(rank, deeds) && (
                      <li className="flex items-center gap-1.5 text-xs leading-snug text-gold-200">
                        <AstrolabeGlyph glyph="weaver_star" size={13} />
                        {rank === ASTROLABE_RANK
                          ? txt('screens.codexScreen.theAstrolabe2', {
                              rankAstrolabeLine: rankAstrolabeLine(rank, deeds),
                            })
                          : rankAstrolabeLine(rank, deeds)}
                      </li>
                    )}
                  </ul>
                  {preset && (
                    <p className="mt-2 text-xs text-gold-300">
                      {txt('screens.codexScreen.preset', { name: preset.name })}
                    </p>
                  )}
                </Panel>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Calls({ roster }: { roster: readonly string[] }) {
  const calls = CONTENT.calls;
  return (
    <div className="flex flex-col gap-6">
      <Panel tone="gold" className="p-5">
        <h2
          className="flex items-center gap-2 font-display text-xl font-bold"
          style={{ color: CALL }}
        >
          <Icon name="call" size={22} /> {txt('screens.codexScreen.callAndResponse')}
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-text">
          {txt('screens.codexScreen.beforeABigMove')}
          <b style={{ color: CALL }}>{txt('screens.codexScreen.flourish')}</b>
          {txt('screens.codexScreen.aStrongerVersionOf', {
            response: CONTENT.resonance.gains.response,
          })}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>
            {txt('screens.codexScreen.firstCallAfterS', { firstAfter: calls.firstAfter })}
          </Chip>
          <Chip>
            {txt('screens.codexScreen.aHeroCallsAt', { heroCooldown: calls.heroCooldown })}
          </Chip>
        </div>
      </Panel>
      <div className={GRID}>
        {CONTENT.heroes
          .filter((h) => roster.includes(h.id))
          .map((h) => {
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
                    <p className="text-sm text-muted">
                      {txt('screens.codexScreen.callsBefore', {
                        value: ability?.name ?? txt('screens.codexScreen.aBigMove'),
                      })}
                    </p>
                  </div>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-muted">{txt('screens.codexScreen.wants')}</span>
                  <Chip icon={CALL_ICON[h.call.answer]} color={CALL}>
                    {CALL_ANSWER[h.call.answer]}
                  </Chip>
                  <span className="text-muted">
                    {txt('screens.codexScreen.withinS', { answerTime: h.call.answerTime })}
                  </span>
                </p>
                <p className="mt-2 font-semibold" style={{ color: CALL }}>
                  {txt('screens.codexScreen.flourish2', { name: h.call.flourish.name })}
                </p>
                <p className="text-sm leading-relaxed text-text">{h.call.flourish.description}</p>
                {h.call.lines[0] && (
                  <p className="mt-2 text-xs italic text-muted">“{h.call.lines[0]}”</p>
                )}
              </Panel>
            );
          })}
        {lockedHeroes(roster).map((id) => (
          <LockedHero key={id} heroId={id} compact />
        ))}
      </div>
    </div>
  );
}

/**
 * Phase 5b: a motif bound to a hero not yet in the roster (docs/phase-5b.md), as a silhouette:
 * a neutral name, no text (it names him), only how he is earned (both routes).
 */
function LockedMotif({ heroId }: { heroId: string }) {
  const how = lockedHeroText(heroId);
  return (
    <Panel
      tone="solid"
      className="border-dashed p-4"
      data-testid="codex-motif-locked"
      data-hero={heroId}
    >
      <div className="flex items-center gap-2">
        <Icon name="lock" size={16} className="text-ink-600" />
        <h3 className="font-semibold text-muted">{txt('screens.codexScreen.aMotifNotYet')}</h3>
      </div>
      <p className="mt-2 text-sm leading-snug text-muted">
        {txt('screens.codexScreen.waitsForAHero', { value: how ? ` · ${how}` : '' })}
      </p>
    </Panel>
  );
}

function Motifs({ roster }: { roster: readonly string[] }) {
  const categories = Object.keys(CATEGORY) as (keyof typeof CATEGORY)[];
  return (
    <div className="flex flex-col gap-8">
      {categories.map((cat) => {
        // A hero's motifs wait for that hero to join the roster (docs/phase-5b.md): each is a
        // locked silhouette with a neutral name (never his, nor the motif's, whose text names
        // him), and how he is earned.
        const motifs = CONTENT.motifs.filter(
          (m) => m.category === cat && (!m.requires.hero || roster.includes(m.requires.hero)),
        );
        const waiting = CONTENT.motifs.filter(
          (m) => m.category === cat && !!m.requires.hero && !roster.includes(m.requires.hero),
        );
        if (motifs.length === 0 && waiting.length === 0) return null;
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
                  data-testid="codex-motif"
                  data-motif={m.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{m.name}</h3>
                    <RarityChip rarity={m.rarity} />
                  </div>
                  <ol className="mt-2 flex flex-col gap-1 text-sm leading-snug text-muted">
                    {m.values.map((_, i) => (
                      <li key={i}>
                        <span className="mr-1.5 font-mono text-xs text-gold-300">
                          {txt('screens.codexScreen.lv', { value: i + 1 })}
                        </span>
                        {motifText(m, i + 1)}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {/* Phase 5g: a Harmony names what it needs; an Expedition-only motif says so. */}
                    {m.requires.motifs && (
                      <span data-testid="codex-harmony">
                        <Chip color="var(--color-gold-200)" icon="link">
                          {txt('screens.codexScreen.harmonyNeeds', {
                            harmonyNeeds: harmonyNeeds(m.id).join(' + '),
                          })}
                        </Chip>
                      </span>
                    )}
                    {m.requires.expedition && (
                      <Chip icon="flag">{txt('screens.codexScreen.expeditionsOnly')}</Chip>
                    )}
                    {m.requires.aura && (
                      <Chip icon="note">
                        {txt('screens.codexScreen.needs2')}{' '}
                        {CONTENT.auras.find((a) => a.id === m.requires.aura)?.name}
                      </Chip>
                    )}
                    {m.requires.hero && (
                      <Chip icon="link">
                        {txt('screens.codexScreen.needs2')}{' '}
                        {CONTENT.heroes.find((h) => h.id === m.requires.hero)?.name}
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
              {waiting.map((m) => (
                <LockedMotif key={m.id} heroId={m.requires.hero!} />
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
          {txt('screens.codexScreen.aMotifAddsA')}{' '}
          <b className="text-gold-200">{txt('screens.codexScreen.relicChangesARule')}</b>
          {txt('screens.codexScreen.forTheRestOf', {
            count: RELIC_OFFERS.elite.count,
            count2: RELIC_OFFERS.boss.count,
            eventFightRelics: eventFightRelics('unsung_choir'),
            cleanse: FORGE_PRICE.cleanse,
          })}
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
                {txt('screens.codexScreen.aetherAtAMerchant', { value: RELIC_PRICE[rarity] })}
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
                    data-relic={r.id}
                  >
                    <div className="flex items-center gap-3">
                      <RelicGlyph icon={info.icon} rarity={info.rarity} size={44} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{info.name}</h3>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <RelicRarityChip rarity={info.rarity} />
                          {info.runOnly && <Chip>{txt('screens.codexScreen.betweenFights')}</Chip>}
                          {r.expedition && (
                            <Chip icon="flag">{txt('screens.codexScreen.expeditionsOnly')}</Chip>
                          )}
                          {wakesLabel(r.id) && <Chip icon="moon">{wakesLabel(r.id)}</Chip>}
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

function Events({ seen, allowance }: { seen?: readonly string[]; allowance: Allowance }) {
  // A later Movement's events open once its enemies are met (Phase 5a).
  const reach = sightedMovement(seen);
  const groups = byMovement(CONTENT.events);
  return (
    <div className="flex flex-col gap-8">
      <Panel tone="gold" className="p-5">
        <p className="max-w-4xl text-sm leading-relaxed text-text">
          {txt('screens.codexScreen.eventsWaitOnThe')}
        </p>
      </Panel>
      {groups.map(({ movement, items }) => (
        <section
          key={movement}
          aria-label={txt('screens.codexScreen.eventsOf', {
            movementInSentence: movementInSentence(movement),
          })}
        >
          {groups.length > 1 && <MovementHeading movement={movement} />}
          {movement > reach ? (
            <Panel
              tone="solid"
              className="border-dashed p-5"
              data-testid="codex-events-locked"
              data-movement={movement}
            >
              <p className="flex items-center gap-2 text-sm text-muted">
                <Icon name="lock" size={14} />{' '}
                {txt('screens.codexScreen.inTheyOpenOnce', {
                  length: items.length,
                  value:
                    items.length === 1
                      ? txt('screens.codexScreen.eventWaits')
                      : txt('screens.codexScreen.eventsWait'),
                  movementInSentence: movementInSentence(movement),
                })}
              </p>
            </Panel>
          ) : (
            <div className={GRID}>
              {items.map((ev) => (
                <Panel key={ev.id} tone="solid" className="p-5" data-event={ev.id}>
                  <div className="flex items-center gap-3">
                    <EventGlyph icon={glyphKey(ev)} size={46} />
                    <div>
                      <h2 className="font-display text-xl font-bold leading-tight">{ev.name}</h2>
                      <p className="text-sm italic text-muted">{ev.teaser}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-text">{ev.text}</p>
                  <ul className="mt-3 flex flex-col gap-2.5 border-t border-ink-600/60 pt-3">
                    {/* Phase 5e: a Rank-gated recruiting choice reads here only once the event
                        screen offers it (hidden below its Rank, never shown locked). */}
                    {ev.choices
                      .filter((c) => eventChoiceShown(c, allowance))
                      .map((c) => {
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
          )}
        </section>
      ))}
      <section aria-label={txt('screens.codexScreen.boonsAndBanes')}>
        <h2 className="mb-3 font-display text-lg font-bold text-gold-300">
          {txt('screens.codexScreen.boonsAndBanes')}
        </h2>
        <div className={GRID}>
          {CONTENT.boons.map((b) => {
            const info = boonInfo({ id: b.id, fights: b.fights });
            return (
              <Panel key={b.id} tone="solid" className="p-4" data-boon={b.id}>
                <p className="flex items-center gap-2">
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border"
                    style={boonStyle(info)}
                  >
                    <Glyph icon={info.icon} size={20} />
                  </span>
                  <span className="text-xs text-muted">
                    {txt('screens.codexScreen.lasts', { boonDuration: boonDuration(b.id) })}
                  </span>
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

import { useEffect, useState, type KeyboardEvent } from 'react';
import { useProfile } from '../../app/profileStore';
import { useSettings } from '../../app/settings';
import { storage } from '../../app/storage';
import { heroDef } from '../../content';
import { bondRank, bondedHeroes, type Bond } from '../../meta/bonds';
import { rankOf } from '../../meta/profile';
import { loadRun } from '../../meta/save';
import { Backdrop } from '../kit/Backdrop';
import { BOND_LOOK, BOND_SOUNDS, heroInk } from '../kit/bondLook';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Panel } from '../kit/Panel';
import { playUi, useMood } from '../kit/sound';
import { useUi } from '../store';
import {
  BONDS_CSS,
  BondBar,
  BondGlyph,
  BondRankBadge,
  BondTrack,
  HeroPortrait,
  SceneList,
  SceneReader,
  SoloChoice,
  TierRow,
} from './BondsParts';
import {
  RUN_UNDER_WAY,
  bondOf,
  bondPage,
  skipLine,
  soloLockLine,
  soloAnnounce,
  talentAnnounce,
  talentClick,
  type TierView,
} from './bondsModel';
import { CodexView, useCodexBonds, useCodexTechniques, useCodexDissonance } from './CodexScreen';
import { useAllowance } from './PrepScreen';

const BOND = BOND_LOOK.color;

export interface BondsViewProps {
  /** The profile's Bonds, by hero. */
  bonds: Readonly<Record<string, Bond>>;
  /** Settings → Skip the unlocks: every talent and Solo can be chosen. */
  unlockAll?: boolean;
  /** A talent chosen in a tier (1–3), or the tier cleared (the profile store's `setTalent`). */
  onTalent(heroId: string, tier: number, talentId: string | null): void;
  /** Which Solo a hero brings (the profile store's `setSolo`). */
  onSolo(heroId: string, solo: 'default' | 'alt'): void;
  onBack(): void;
  /** Where Back goes ("Prep", "Title"). */
  backTo?: string;
  /** A run under way keeps the choices it embarked with (opened from the Title mid-run). */
  runUnderWay?: boolean;
  /** Opens the Codex's Bonds page (the rules). */
  onRules?(): void;
  /** UI lab: the hero shown first, and a seen scene open in the reader. */
  initialHero?: string;
  initialReading?: string | null;
}

/**
 * The Bonds screen (Phase 4e, docs/phase-4e.md): a page per hero. Their Bond rank and XP, the
 * ranks ahead and what each opens; the three talent tiers (one of two, or neither; a locked tier
 * names its rank); at the Solo's rank, their own Solo or the alternate; their scenes (seen ones
 * read again, a waiting one waits for a Respite, a locked one names its rank). Choices go
 * straight to the profile: free between runs, frozen at embark.
 */
export function BondsView({
  bonds,
  unlockAll = false,
  onTalent,
  onSolo,
  onBack,
  backTo = 'Title',
  runUnderWay = false,
  onRules,
  initialHero,
  initialReading = null,
}: BondsViewProps) {
  useMood('map');
  const heroes = bondedHeroes();
  const [hero, setHero] = useState(
    initialHero && heroes.includes(initialHero) ? initialHero : heroes[0]!,
  );
  const [reading, setReading] = useState<string | null>(initialReading);
  const [say, setSay] = useState('');
  /** Why a click did nothing (a locked tier or Solo), in the panel it concerns. */
  const [notice, setNotice] = useState<{ where: 'talents' | 'solo'; text: string } | null>(null);
  const bond = bondOf(bonds, hero);
  const page = bondPage(hero, bond, unlockAll);

  // Escape goes back (the reader closes itself first).
  useEffect(() => {
    if (reading) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, reading]);

  const select = (h: string) => {
    if (h === hero) return;
    setHero(h);
    setNotice(null);
    playUi('click');
  };
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = heroes.indexOf(hero);
    const next = heroes[(i + (e.key === 'ArrowRight' ? 1 : heroes.length - 1)) % heroes.length]!;
    select(next);
    e.currentTarget.querySelector<HTMLElement>(`#bonds-tab-${next}`)?.focus();
    e.preventDefault();
  };

  const pick = (tier: TierView, id: string) => {
    const click = talentClick(tier, id);
    if (click.kind === 'locked') {
      playUi('error');
      setNotice({ where: 'talents', text: click.reason });
      setSay(click.reason);
      return;
    }
    onTalent(hero, tier.tier, click.id);
    if (click.kind === 'choose') playUi(BOND_SOUNDS.choose, { hero });
    else playUi(BOND_SOUNDS.clear);
    setNotice(null);
    setSay(talentAnnounce(hero, tier.tier, click.id));
  };
  const chooseSolo = (key: 'default' | 'alt') => {
    const solo = page.solo;
    if (!solo || key === solo.chosen) return;
    if (key === 'alt' && !solo.open) {
      const why = soloLockLine(solo.rank);
      playUi('error');
      setNotice({ where: 'solo', text: why });
      setSay(why);
      return;
    }
    onSolo(hero, key);
    playUi(BOND_SOUNDS.solo, { hero });
    setNotice(null);
    setSay(soloAnnounce(hero, key));
  };

  return (
    <main className="relative h-full w-full overflow-hidden" data-testid="bonds-screen">
      <Backdrop tone="dusk" />
      <style>{BONDS_CSS}</style>
      <div className="scroll-thin relative z-10 flex h-full flex-col overflow-y-auto px-5 pb-5 pt-3">
        <header className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
              Between runs{unlockAll && ' · all unlocked'}
            </p>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-wide text-gold-300">
              <BondGlyph size={28} /> Bonds
            </h1>
          </div>
          <div
            role="tablist"
            aria-label="Heroes"
            className="order-last grid w-full gap-2 sm:grid-cols-3 xl:order-none xl:w-auto xl:flex-1"
            onKeyDown={onTabKey}
          >
            {heroes.map((h) => {
              const def = heroDef(h);
              const b = bondOf(bonds, h);
              const on = h === hero;
              return (
                <button
                  key={h}
                  id={`bonds-tab-${h}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`bonds-panel-${h}`}
                  tabIndex={on ? 0 : -1}
                  autoFocus={on}
                  onClick={() => select(h)}
                  className={`flex items-center gap-2.5 rounded-xl border-2 px-2.5 py-1.5 text-left transition-colors ${on ? 'bg-ink-800/95' : 'bg-ink-900/70 hover:bg-ink-800/80'}`}
                  style={{ borderColor: on ? def.color : 'var(--color-ink-600)' }}
                  data-testid={`bonds-tab-${h}`}
                >
                  <HeroPortrait heroId={h} size={30} />
                  <span className="min-w-0 flex-1">
                    <b className="block font-display text-base leading-tight text-text">
                      {def.name}
                    </b>
                    <span className="block truncate text-xs text-muted">{def.title}</span>
                  </span>
                  <BondRankBadge rank={bondRank(b.xp)} />
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {onRules && (
              <Button variant="secondary" size="sm" onClick={onRules} sound="click">
                <Icon name="book" size={15} /> Rules
              </Button>
            )}
            <Button variant="ghost" onClick={onBack} sound="back" data-testid="bonds-back">
              <Icon name="back" size={16} /> {backTo} <KeyCap label="Esc" />
            </Button>
          </div>
        </header>
        {(unlockAll || runUnderWay) && (
          <div className="mt-2 flex flex-col gap-1.5">
            {unlockAll && (
              <p
                className="flex items-start gap-2 rounded-lg border border-ink-600 bg-ink-900/80 px-3 py-1.5 text-xs text-muted"
                data-testid="bonds-skip"
              >
                <Icon name="info" size={14} className="mt-px shrink-0 text-gold-300" />
                {skipLine()}
              </p>
            )}
            {runUnderWay && (
              <p className="flex items-start gap-2 rounded-lg border border-ink-600 bg-ink-900/80 px-3 py-1.5 text-xs text-muted">
                <Icon name="info" size={14} className="mt-px shrink-0 text-gold-300" />
                {RUN_UNDER_WAY}
              </p>
            )}
          </div>
        )}

        <div
          role="tabpanel"
          id={`bonds-panel-${hero}`}
          aria-labelledby={`bonds-tab-${hero}`}
          className="mt-3 grid min-h-0 flex-1 items-start gap-3 lg:grid-cols-[20rem_minmax(0,1fr)]"
          data-testid="bond-page"
          data-hero={hero}
          data-rank={page.progress.rank}
          data-xp={page.progress.xp}
        >
          <Panel tone="solid" className="flex flex-col gap-3.5 p-4">
            <div className="flex items-center gap-4">
              <HeroPortrait heroId={hero} size={68} lit />
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-bold leading-tight text-text">
                  {page.name}
                </h2>
                <p className="text-sm text-muted">{page.heroTitle}</p>
                <p
                  className="mt-1 flex items-center gap-1.5 font-display text-lg font-bold"
                  style={{ color: BOND }}
                >
                  <BondGlyph size={18} /> Bond rank {page.progress.rank}
                </p>
              </div>
            </div>
            <div>
              <BondBar
                before={page.progress.fraction}
                after={page.progress.fraction}
                color={page.color}
                label={`${page.name}’s Bond: ${page.progress.text}`}
              />
              <p className="mt-1 font-mono text-xs text-muted" data-testid="bond-progress">
                {page.progress.text}
              </p>
              {page.next && (
                <p className="mt-0.5 text-xs text-text" data-testid="bond-next">
                  {page.next}
                </p>
              )}
            </div>
            <BondTrack steps={page.track} heroId={hero} />
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                <Icon name="scene" size={13} style={{ color: BOND }} /> Scenes
              </h3>
              <SceneList rows={page.scenes} heroId={hero} onRead={setReading} />
            </div>
          </Panel>

          <div className="flex min-w-0 flex-col gap-4">
            <Panel tone="solid" className="px-4 py-3" role="group" aria-label="Talents">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="flex items-center gap-1.5 font-display text-lg font-bold text-gold-300">
                  <Icon name="talent" size={17} /> Talents
                </h3>
                {notice?.where === 'talents' ? (
                  <Notice text={notice.text} heroId={hero} />
                ) : (
                  <p className="text-xs text-muted">
                    One a tier, or neither: choose again to clear it. They change freely between
                    runs.
                  </p>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {page.tiers.map((t) => (
                  <TierRow key={t.tier} view={t} heroId={hero} onPick={(id) => pick(t, id)} />
                ))}
              </div>
            </Panel>
            {page.solo && (
              <Panel tone="solid" className="px-4 py-3" role="group" aria-label="Solo">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="flex items-center gap-1.5 font-display text-lg font-bold text-gold-300">
                    <Icon name="note" size={17} /> Solo
                  </h3>
                  {notice?.where === 'solo' ? (
                    <Notice text={notice.text} heroId={hero} />
                  ) : (
                    <p
                      className="flex items-center gap-1.5 text-xs text-muted"
                      data-testid="solo-lock"
                    >
                      {page.solo.lockLine ? (
                        <>
                          <Icon name="lock" size={12} /> {soloLockLine(page.solo.rank)}
                        </>
                      ) : page.solo.note ? (
                        `${page.solo.note}: the alternate opens at Bond rank ${page.solo.rank}.`
                      ) : (
                        `Choose which one ${page.name} brings.`
                      )}
                    </p>
                  )}
                </div>
                <div className="mt-2">
                  <SoloChoice view={page.solo} heroId={hero} onChoose={chooseSolo} />
                </div>
              </Panel>
            )}
          </div>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {say}
        </p>
      </div>
      {reading && (
        <SceneReader
          sceneId={reading}
          reply={bond.seen[reading] ?? null}
          onClose={() => setReading(null)}
        />
      )}
    </main>
  );
}

/** Why a click did nothing, where the hint was: the lock and the rank it opens at. */
function Notice({ text, heroId }: { text: string; heroId: string }) {
  return (
    <p
      className="anim-fade flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold text-text"
      style={{ borderColor: `color-mix(in srgb, ${heroInk(heroId)} 55%, transparent)` }}
      data-testid="bonds-notice"
    >
      <Icon name="lock" size={12} style={{ color: heroInk(heroId) }} /> {text}
    </p>
  );
}

/** The Bonds screen from the stores: from the Title or from Prep (Back returns there). */
export function BondsScreen() {
  const bonds = useProfile((s) => s.profile.bonds);
  const xp = useProfile((s) => s.profile.xp);
  const deeds = useProfile((s) => s.profile.deeds);
  const deedBest = useProfile((s) => s.profile.deedBest);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  const allowance = useAllowance();
  const back = useUi((s) => s.back);
  const previous = useUi((s) => s.previous);
  const dissonance = useCodexDissonance();
  const codexBonds = useCodexBonds();
  const codexTechniques = useCodexTechniques();
  const [runUnderWay] = useState(() => {
    if (previous === 'run') return false;
    const saved = loadRun(storage());
    return !!saved && saved.phase !== 'prep' && saved.phase !== 'summary';
  });
  const [codex, setCodex] = useState(false);
  if (codex) {
    return (
      <CodexView
        onBack={() => setCodex(false)}
        initialTab="bonds"
        allowance={allowance}
        rank={rankOf(xp)}
        deeds={{ earned: deeds, best: deedBest }}
        dissonance={dissonance}
        bonds={codexBonds}
        techniques={codexTechniques}
      />
    );
  }
  return (
    <BondsView
      bonds={bonds}
      unlockAll={unlockAll}
      onTalent={(h, tier, id) => useProfile.getState().setTalent(h, tier, id)}
      onSolo={(h, solo) => useProfile.getState().setSolo(h, solo)}
      onBack={back}
      backTo={previous === 'run' ? 'Prep' : 'Title'}
      runUnderWay={runUnderWay}
      onRules={() => setCodex(true)}
    />
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useProfile } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import * as Run from '../../meta/run';
import { weeklyEntry } from '../../meta/weekly';
import { useSettings } from '../../app/settings';
import { CONTENT } from '../../content';
import {
  EVERYTHING,
  allowanceFor,
  heroRoster,
  rankOf,
  type Allowance,
  type Unlock,
} from '../../meta/profile';
import type { ChordLoadout, RunState } from '../../meta/types';
import { canonicalChords, type ReservePool } from '../../sim';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import type { ProfileAtlas } from '../../meta/profile';
import { PrepEchoPanel, PrepWeeklyPanel } from './AtlasParts';
import { prepEchoView, prepWeeklyView, type PrepWeeklyInput } from './atlasModel';

/** A weekly run's Prep panel input: its week and that week's entry (null: none in content). */
function prepWeeklyInput(week: number): PrepWeeklyInput | null {
  const entry = weeklyEntry(week);
  return entry ? { week, entry } : null;
}
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { Icon } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { Segmented, Toggle } from '../kit/Slider';
import { useMood } from '../kit/sound';
import { useUi } from '../store';
import { HeroDisc, SectionTitle } from './shared';
import { ROLE_LABEL } from '../hud/labels';
import { ChordBuilder, NewTag, SONG_LOOK } from './ChordBuilder';
import { freshUnlocks, loadoutProblems, mult, padChords, poolBlurb } from './chordModel';
import { CallingPicker, type PickerMastery } from './CallingPicker';
import {
  carriedPassives,
  fieldAuraSlots as runFieldAuraSlots,
  reserveMult as runReserveMult,
  reservePool,
} from '../../meta/run';
import { slotBonus } from './callingText';
import { AstrolabeButtonLabel, KeystoneChips } from './AstrolabeParts';
import { astrolabeOpen } from './astrolabeModel';
import { astrolabePoints } from '../../meta/astrolabe';
import { deedPoints } from '../../meta/deeds';
import { carrySlots, reliquaryOpen } from '../../meta/reliquary';
import type { DissonanceChoice } from '../../meta/dissonance';
import { PrepReliquaryRow } from './ReliquaryParts';
import { EmbarkDissonance, PrepDissonancePanel } from './DissonanceParts';
import type { Bond, RunBond } from '../../meta/bonds';
import { PrepBondsRow } from './BondsParts';
import { bondsOpen, prepBondViews, soloView, talentView } from './bondsModel';
import { PrepTechniquesPanel } from './TechniquesParts';
import type { TechniqueKey } from '../types';
import { CodexView, useCodexBonds, useCodexDissonance, useCodexTechniques } from './CodexScreen';
import { prepRoute } from './prepRoute';
import { prepParty } from './prepParty';
import {
  focusKeyLabel,
  freshHeroes,
  missingStarterNotes,
  type FreshHero,
  needsRow,
  passiveIcon,
  passiveRow,
  pickerColumns,
  pickLegal,
  pickProblem,
  pickerCards,
  summonsRow,
  togglePick,
} from './rosterModel';
import { KeyCap } from '../kit/KeyCap';
import {
  expeditionLength,
  expeditionOnward,
  prepEyebrow,
  routeHint,
  routeOf,
  routeOptions,
  type Route,
} from './routeText';
import { t as txt } from '../text';

export interface PrepViewProps {
  run: RunState;
  /** Called with every legal loadout the builder reaches (canonical form). */
  onChords(chords: ChordLoadout[]): void;
  onEmbark(): void;
  /** Back to the Loom, the hub between runs (Phase 4g). */
  onBack(): void;
  /** Choose the run's Calling (null: none). Omitted: no Calling picker (the UI lab's old views). */
  onCalling?(id: string | null): void;
  /** UI lab: open a Calling's path dialog. */
  openCallingPath?: string;
  /** What the player's Rank opens (default: everything). */
  allowance?: Allowance;
  /** Unlocks to introduce and mark "New" this visit. */
  fresh?: readonly Unlock[];
  /** Phase 5b: heroes recruited since the last Prep, named in the same strip. */
  freshHeroes?: readonly FreshHero[];
  /** The player's Weaver Rank, for the header (omitted: no Rank shown). */
  rank?: number;
  /**
   * Phase 4: the Astrolabe's points (the Rank's) and how to open it; omitted (or null): no
   * button, as before Rank 4.
   */
  astrolabe?: { points: number; onOpen(): void } | null;
  /**
   * Phase 4c: the Reliquary's carry slots (what the Rank opens) and how to open it; omitted (or
   * null): no row, as before Rank 10. What the run carries is `run.carried`.
   */
  reliquary?: { slots: number; onOpen(): void } | null;
  /**
   * Phase 4d: Dissonance. Open: the profile's bests and how a choice is made (the profile store's
   * `setDissonance`; the run's levels, `run.dissonance`, follow it). Closed: the panel says how it
   * opens. Omitted (or null): no panel (the UI lab's older views).
   */
  dissonance?: {
    open: boolean;
    best: Readonly<Record<string, number>>;
    onChange(levels: DissonanceChoice[]): void;
  } | null;
  /**
   * Phase 4e: Bonds, once open (a hero's first Bond rank-up, or Skip the unlocks): the profile's
   * (each hero's rank) and how to open the Bonds screen. What the run plays is `run.bonds`, which
   * follows the profile until it embarks. Omitted (or null): no row.
   */
  bonds?: { bonds: Readonly<Record<string, Bond>>; onOpen(): void } | null;
  /**
   * Phase 4f: technique variants. The profile's (the variants it owns, Skip the unlocks) and how a
   * choice is made (the profile store's `setTechnique`); what the run plays is `run.techniques`,
   * which follows the profile until it embarks. Omitted (or null): no panel (the UI lab's older
   * views).
   */
  techniques?: {
    owned: readonly string[];
    all: boolean;
    onChoose(slot: TechniqueKey, id: string | null): void;
    onRules?(): void;
    /** UI lab: the panel open or folded. */
    expanded?: boolean;
  } | null;
  /**
   * Phase 4g: Calling mastery, each Calling's (the profile's), and the tiers a run would offer
   * now (the profile store's `tiersOpen`, which embarking snapshots). Omitted (or null): every
   * tier shows open (the UI lab's older views).
   */
  mastery?: PickerMastery | null;
  /**
   * Phase 5a: the Route, Prelude or Expedition, once Expeditions are open (Rank 2, or Skip the
   * unlocks); the run's route is `run.movements`. Omitted (or null): no toggle, as before.
   */
  route?: { onChange(route: Route): void } | null;
  /**
   * Phase 5b: the party picker, once the roster holds more heroes than a party (`prepParty`): the
   * heroes it offers and how a pick reaches the run (the run store's `setParty`, which keeps them
   * in content order). Omitted (or null): no picker, as before the roster.
   */
  party?: { roster: readonly string[]; onChange(heroIds: string[]): void } | null;
  /**
   * Phase 6: This Week's Song's fixed choices (the weekly model's week and entry), shown locked.
   * Omitted (or null): no panel. An Echo's panel needs no prop: it shows from `run.echo`.
   */
  weekly?: PrepWeeklyInput | null;
  /** Phase 6: the Atlas's stars, for an Echo's panel (omitted: none lit). */
  atlas?: ProfileAtlas;
}

/**
 * The Chord draft while editing: may be illegal for a moment, in which case the run keeps
 * its last legal Chords and Embark waits. `pool` is what the songs reserve
 * (`Run.reservePool(run)`) and `reserveMult` the Astrolabe's share of it (`Run.reserveMult`);
 * in Prep they follow the Calling chosen there and the tree, so when either changes and the
 * draft is legal under it, the run is given the draft again (the Martyr's Life holds at most
 * 90%: a draft that only Spirit allowed waits while she's chosen).
 */
export function useChordDraft(
  initial: readonly ChordLoadout[],
  allowance: Allowance,
  onLegal?: (c: ChordLoadout[]) => void,
  /** The field song's aura slots (`Run.fieldAuraSlots(run)`; Third Voice adds one). */
  fieldAuraSlots: number = CONTENT.weaver.auraSlots,
  pool: ReservePool = 'spirit',
  reserveMult = 1,
) {
  const [draft, setDraft] = useState(() => padChords(initial));
  const problems = loadoutProblems(draft, allowance, fieldAuraSlots, pool, reserveMult);
  const legal = problems.length === 0;
  const change = (next: ChordLoadout[]) => {
    setDraft(next);
    if (loadoutProblems(next, allowance, fieldAuraSlots, pool, reserveMult).length === 0)
      onLegal?.(canonicalChords(next));
  };
  const reserve = `${pool}:${reserveMult}`;
  const [lastReserve, setLastReserve] = useState(reserve);
  const pending = useRef<ChordLoadout[] | null>(null);
  if (reserve !== lastReserve) {
    // Adjusting state on a change of prop (React's documented pattern); the run hears in an effect.
    setLastReserve(reserve);
    pending.current = legal ? canonicalChords(draft) : null;
  }
  useEffect(() => {
    if (!pending.current) return;
    const chords = pending.current;
    pending.current = null;
    onLegal?.(chords);
  });
  return { draft, change, legal };
}

/** What Prep and Retune may use, following the profile and Settings → Skip the unlocks. */
export function useAllowance(): Allowance {
  const xp = useProfile((s) => s.profile.xp);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  return useMemo(() => (unlockAll ? EVERYTHING : allowanceFor(rankOf(xp))), [xp, unlockAll]);
}

/**
 * The unlocks to mark "New" on this visit to the builder: read once when it opens, then
 * marked introduced, so the badges stay up while the player looks and are gone next time.
 */
export function useFreshUnlocks(): Unlock[] {
  const [fresh] = useState(() => {
    const p = useProfile.getState().profile;
    return freshUnlocks(p.xp, p.introduced, p.recruited ?? []);
  });
  useEffect(() => {
    if (fresh.length > 0) useProfile.getState().markIntroduced(fresh.map((u) => u.id));
  }, [fresh]);
  return fresh;
}

/**
 * Phase 5b: heroes recruited since the last Prep (`profile.introduced` keeps `hero.<id>` once
 * shown): read once when Prep opens, then marked, so the strip names them this visit only.
 */
export function useFreshHeroes(): FreshHero[] {
  const [fresh] = useState(() => {
    const p = useProfile.getState().profile;
    return freshHeroes(p.recruited ?? [], p.introduced);
  });
  useEffect(() => {
    if (fresh.length > 0) useProfile.getState().markIntroduced(fresh.map((h) => h.id));
  }, [fresh]);
  return fresh;
}

/** "New since last time": each unlock the player hasn't met yet, with its sentence. */
export function FreshStrip({ fresh }: { fresh: readonly Pick<Unlock, 'id' | 'name' | 'text'>[] }) {
  if (fresh.length === 0) return null;
  return (
    <Panel
      tone="gold"
      className="anim-rise mt-5 p-4"
      aria-label={txt('screens.prepScreen.newlyUnlocked')}
    >
      <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-gold-300">
        <Icon name="sparkle" size={15} /> {txt('screens.prepScreen.newlyUnlocked')}
      </p>
      <ul className="mt-2 grid gap-x-6 gap-y-2 md:grid-cols-2">
        {fresh.map((u) => (
          <li key={u.id} className="flex items-start gap-2 text-sm leading-relaxed">
            <NewTag />
            <span>
              <b className="text-gold-100">{u.name}</b> <span className="text-muted">{u.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Expedition prep: the party's kits and the Chord builder. */
export function PrepView({
  run,
  onChords,
  onEmbark,
  onBack,
  onCalling,
  openCallingPath,
  allowance = EVERYTHING,
  fresh = [],
  freshHeroes: newHeroes = [],
  rank,
  astrolabe = null,
  reliquary = null,
  dissonance = null,
  bonds = null,
  techniques = null,
  mastery = null,
  route = null,
  party = null,
  weekly = null,
  atlas,
}: PrepViewProps) {
  useMood('map');
  // A weekly on an Echo's route shows the weekly's panel alone: it names the route, and its
  // choices (the Calling, the party) are the week's, not the Echo's player's.
  const echoPanel = run.echo === undefined || weekly ? null : prepEchoView(run.echo, atlas);
  // Always the content's two at Prep (the path is empty), but read from the run like Retune.
  const slots = runFieldAuraSlots(run);
  // The Calling chosen above decides the pool (the Martyr's songs reserve Life), and so does the
  // run's tree (Sanguine Font); the tree makes them lighter too (Clear Voice, Breath).
  const pool = reservePool(run);
  const lighter = runReserveMult(run);
  const { draft, change, legal } = useChordDraft(
    run.chords,
    allowance,
    onChords,
    slots,
    pool,
    lighter,
  );
  const [freshIds] = useState(() => new Set(fresh.map((u) => u.id)));
  // Phase 5b: the pick while choosing (it may hold fewer than three for a moment; the run keeps
  // its last legal party, and Embark waits).
  const [pick, setPick] = useState<string[]>(() => run.party.map((h) => h.heroId));
  const partyLegal = !party || pickLegal(pick, party.roster);
  const choose = (heroId: string) => {
    if (!party) return;
    const next = togglePick(pick, heroId, party.roster);
    setPick(next);
    if (pickLegal(next, party.roster)) party.onChange(next);
  };
  const w = CONTENT.weaver;
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-7xl px-6 pb-28 pt-8">
        <ScreenHeader
          eyebrow={prepEyebrow(run)}
          title={txt('screens.prepScreen.prepareYourSongs')}
          right={
            // Stacked, so it stays beside the blurb: the Rank and the way back to the Loom, then
            // the Astrolabe (Phase 4) and the keystones it holds.
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {rank !== undefined && (
                  <span
                    className="flex items-center gap-1.5 rounded-lg border border-gold-500/50 bg-ink-900/80 px-3 py-1.5 text-sm font-semibold text-gold-200"
                    title={
                      allowance.all ? txt('screens.prepScreen.settingsTheUnlocksAre') : undefined
                    }
                  >
                    <Icon name="crown" size={15} /> {txt('screens.prepScreen.weaverRank', { rank })}
                    {allowance.all && (
                      <span className="font-normal text-muted">
                        {txt('screens.prepScreen.allUnlocked')}
                      </span>
                    )}
                  </span>
                )}
                <Button variant="ghost" onClick={onBack} sound="back">
                  <Icon name="back" size={16} /> {txt('screens.prepScreen.theLoom')}
                </Button>
              </div>
              {astrolabe && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={astrolabe.onOpen}
                  sound="click"
                  data-testid="prep-astrolabe"
                  title={txt('screens.prepScreen.yourStarMapOf')}
                >
                  <AstrolabeButtonLabel spent={run.astrolabe.length} points={astrolabe.points} />
                </Button>
              )}
              <KeystoneChips tree={run.astrolabe} />
            </div>
          }
        >
          <p className="mt-2 max-w-3xl text-sm text-muted">
            {txt('screens.prepScreen.youAreTheWeaver')}{' '}
            <b style={{ color: SONG_LOOK.beam.color }}>{txt('screens.prepScreen.beamSong')}</b>{' '}
            {txt('screens.prepScreen.ridesTheThreadWhoever', { mult: mult(w.beamFocus) })}
            {allowance.songs > 1 || allowance.all ? (
              <>
                {txt('screens.prepScreen.your')}{' '}
                <b style={{ color: SONG_LOOK.field.color }}>
                  {txt('screens.prepScreen.fieldSong')}
                </b>{' '}
                {txt('screens.prepScreen.surroundsYouAtFull')}
              </>
            ) : null}{' '}
            {poolBlurb(run)}
          </p>
        </ScreenHeader>

        {/* Phase 6: an Echo's twists, or the weekly's fixed choices (absent on every other run). */}
        {echoPanel && <PrepEchoPanel view={echoPanel} />}
        {weekly && <PrepWeeklyPanel view={prepWeeklyView(weekly)} />}

        {reliquary && (
          <PrepReliquaryRow
            className="mt-4"
            carried={run.carried}
            slots={reliquary.slots}
            onOpen={reliquary.onOpen}
          />
        )}

        {bonds && (
          <PrepBondsRow
            className={reliquary ? 'mt-2' : 'mt-4'}
            views={prepBondViews(
              run.party.map((h) => h.heroId),
              run.bonds,
              bonds.bonds,
              allowance.all,
            )}
            onOpen={bonds.onOpen}
          />
        )}

        <FreshStrip fresh={[...fresh, ...newHeroes]} />

        {onCalling && (
          <CallingPicker
            chosen={run.calling?.id ?? null}
            allowance={allowance}
            fresh={freshIds}
            onChoose={onCalling}
            openPath={openCallingPath}
            mastery={mastery}
            at={{ movements: run.movements, ...(run.echo !== undefined ? { echo: run.echo } : {}) }}
          />
        )}

        {techniques && (
          <PrepTechniquesPanel
            run={run}
            owned={techniques.owned}
            all={techniques.all}
            onChoose={techniques.onChoose}
            onRules={techniques.onRules}
            expanded={techniques.expanded}
          />
        )}

        {dissonance && (
          <PrepDissonancePanel
            run={run}
            open={dissonance.open}
            best={dissonance.best}
            rank={rank ?? 1}
            onChange={dissonance.onChange}
          />
        )}

        <section className="mt-6" aria-label={txt('screens.prepScreen.songs')}>
          <ChordBuilder
            value={draft}
            onChange={change}
            allowance={allowance}
            fresh={freshIds}
            fieldAuraSlots={slots}
            bonus={slotBonus(run)}
            pool={pool}
            calling={run.calling}
            reserveMult={lighter}
            astrolabe={run.astrolabe}
            passives={carriedPassives(run)}
            techniques={run.techniques}
          />
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <section aria-labelledby="party-title">
            <SectionTitle>
              <span id="party-title">{txt('screens.prepScreen.yourParty')}</span>
            </SectionTitle>
            {party && <PartyPicker roster={party.roster} pick={pick} onToggle={choose} />}
            <div className="flex flex-col gap-3">
              {run.party.map((p) => (
                <HeroCard
                  key={p.heroId}
                  heroId={p.heroId}
                  bond={run.bonds.find((b) => b.heroId === p.heroId)}
                />
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-6">
            {route && (
              <Panel tone="solid" className="p-4" data-testid="prep-route">
                <h2 className="font-display text-base font-bold text-gold-300">
                  {txt('screens.prepScreen.route')}
                </h2>
                <p className="mb-3 text-xs text-muted">
                  {txt('screens.prepScreen.thePreludeIsMovement', {
                    expeditionOnward: expeditionOnward(expeditionLength(run)),
                  })}
                </p>
                <Segmented
                  label={txt('screens.prepScreen.thisRun')}
                  hint={routeHint(routeOf(run), expeditionLength(run))}
                  value={routeOf(run)}
                  options={routeOptions()}
                  onChange={(v) => route.onChange(v)}
                />
              </Panel>
            )}
            <Panel tone="solid" className="p-4">
              <h2 className="font-display text-base font-bold text-gold-300">
                {txt('screens.prepScreen.quickAssists')}
              </h2>
              <p className="mb-3 text-xs text-muted">{txt('screens.prepScreen.changeAnyTimeIn')}</p>
              <div className="flex flex-col gap-3.5">
                <Segmented
                  label={txt('screens.prepScreen.telegraphLead')}
                  hint={txt('screens.prepScreen.enemyAttacksWindUp')}
                  value={settings.assists.telegraphLead}
                  options={[
                    { value: 1, label: txt('screens.prepScreen.standard') },
                    { value: 1.25, label: '×1.25' },
                    { value: 1.5, label: '×1.5' },
                  ]}
                  onChange={(v) =>
                    update((d) => ({ ...d, assists: { ...d.assists, telegraphLead: v } }))
                  }
                />
                <Segmented
                  label={txt('screens.prepScreen.perfectWardWindow')}
                  value={settings.assists.perfectWindowBonus}
                  options={[
                    { value: 0, label: txt('screens.prepScreen.standard') },
                    { value: 0.1, label: '+0.1 s' },
                    { value: 0.2, label: '+0.2 s' },
                  ]}
                  onChange={(v) =>
                    update((d) => ({ ...d, assists: { ...d.assists, perfectWindowBonus: v } }))
                  }
                />
                <Toggle
                  label={txt('screens.prepScreen.heroAutonomy')}
                  hint={txt('screens.prepScreen.heroesFireTheirOwn')}
                  checked={settings.assists.autonomy}
                  onChange={(v) =>
                    update((d) => ({ ...d, assists: { ...d.assists, autonomy: v } }))
                  }
                />
              </div>
            </Panel>
          </div>
        </div>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-end bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent px-6 pb-5 pt-10">
        <div className="pointer-events-auto flex items-center gap-4">
          {dissonance?.open && <EmbarkDissonance run={run} />}
          <p className="text-sm text-muted">
            {txt('screens.prepScreen.seed')} <span className="font-mono text-text">{run.seed}</span>
          </p>
          {!legal && (
            <p className="text-sm font-semibold text-rose-200" role="status">
              {txt('screens.prepScreen.fixYourSongsTo')}
            </p>
          )}
          {legal && !partyLegal && (
            <p className="text-sm font-semibold text-rose-200" role="status">
              {pickProblem(pick)} {txt('screens.prepScreen.toEmbark')}
            </p>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={onEmbark}
            sound="confirm"
            disabled={!legal || !partyLegal}
            autoFocus
          >
            {txt('screens.prepScreen.embark')} <Icon name="arrow" size={18} />
          </Button>
        </div>
      </div>
    </ScreenFrame>
  );
}

/**
 * Phase 5b, Prep's party picker (docs/phase-5b.md, "Choosing the party"): every roster hero as a
 * toggle, exactly three chosen, each chosen card showing the number key it will take (the chosen
 * go in content order, so a hero's key can change with the party). Under it, one note for each
 * starter the pick leaves out.
 */
function PartyPicker({
  roster,
  pick,
  onToggle,
}: {
  roster: readonly string[];
  pick: readonly string[];
  onToggle(heroId: string): void;
}) {
  const cards = pickerCards(roster, pick);
  const notes = missingStarterNotes(pick);
  return (
    <Panel tone="solid" className="mb-4 p-4" data-testid="prep-party">
      <p className="mb-3 text-xs text-muted">
        {txt('screens.prepScreen.chooseThreeTheyTake', {
          focusKeyLabel: focusKeyLabel(1),
          focusKeyLabel2: focusKeyLabel(2),
          focusKeyLabel3: focusKeyLabel(3),
        })}
      </p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${pickerColumns(cards.length)}, minmax(0, 1fr))` }}
        data-columns={pickerColumns(cards.length)}
        role="group"
        aria-label={txt('screens.prepScreen.chooseYourPartyThree')}
      >
        {cards.map((c) => {
          const def = CONTENT.heroes.find((h) => h.id === c.heroId)!;
          return (
            <button
              key={c.heroId}
              type="button"
              aria-pressed={c.selected}
              aria-label={`${c.name}, ${ROLE_LABEL[c.role]}${c.key ? txt('screens.prepScreen.key', { keyLabel: c.keyLabel }) : c.full ? txt('screens.prepScreen.dropAHeroFirst') : ''}`}
              onClick={() => onToggle(c.heroId)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-colors ${c.selected ? 'bg-ink-800' : 'bg-ink-900/60 opacity-70 hover:opacity-100'} ${c.full ? 'cursor-not-allowed' : ''}`}
              style={{ borderColor: c.selected ? def.color : 'var(--color-ink-600)' }}
              data-testid={`prep-pick-${c.heroId}`}
              data-selected={c.selected || undefined}
              data-key={c.key ?? undefined}
            >
              <HeroDisc heroId={c.heroId} size={40} />
              <span className="font-display text-sm font-bold leading-tight">{c.name}</span>
              <Chip color={def.color}>{ROLE_LABEL[c.role]}</Chip>
              {c.key !== null ? (
                <KeyCap label={c.keyLabel ?? String(c.key)} accent />
              ) : (
                <span className="text-xs text-muted">
                  {c.full
                    ? txt('screens.prepScreen.dropOneFirst')
                    : txt('screens.prepScreen.notChosen')}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5" data-testid="prep-party-notes">
          {notes.map((n) => (
            <li
              key={n.heroId}
              className="flex items-start gap-2 text-xs leading-relaxed text-threat"
              data-note={n.heroId}
            >
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** A hero's kit, with the talents and Solo the run plays (Phase 4e: `run.bonds`). */
function HeroCard({ heroId, bond }: { heroId: string; bond?: RunBond }) {
  const def = CONTENT.heroes.find((h) => h.id === heroId)!;
  const solo = soloView(heroId, bond?.solo ?? null);
  const talents = (bond?.talents ?? [])
    .filter((id) => CONTENT.talents.some((t) => t.id === id))
    .map((id) => talentView(id))
    .sort((a, b) => a.tier - b.tier);
  // Phase 5b: a passive and what they need of you, only for a hero who has them (Brann).
  const passive = passiveRow(def);
  const needs = needsRow(def);
  // Phase 5e: Oro's Saplings (null for every hero without summons).
  const summons = summonsRow(def);
  return (
    <article
      className="rounded-xl border border-ink-600/70 bg-ink-800/80 p-4"
      style={{ borderTopColor: def.color, borderTopWidth: 3 }}
    >
      <div className="flex items-center gap-3">
        <HeroDisc heroId={heroId} size={48} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-tight">
            {def.name} <span className="text-sm font-normal text-muted">{def.title}</span>
          </h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip color={def.color}>{ROLE_LABEL[def.role]}</Chip>
            <Chip>
              <Icon name="heart" size={12} />{' '}
              {txt('screens.prepScreen.life', {
                toLocaleString: def.maxHp.toLocaleString('en-US'),
              })}
            </Chip>
            {def.armor > 0 && (
              <Chip icon="ward">
                {txt('screens.prepScreen.armour', { round: Math.round(def.armor * 100) })}
              </Chip>
            )}
          </div>
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {def.abilities.map((a) => (
          <div key={a.id} className="rounded-lg bg-ink-900/60 px-3 py-2">
            <dt className="font-semibold text-text">
              {a.name}{' '}
              <span className="font-mono text-xs font-normal text-muted">
                {txt('screens.prepScreen.s', { cooldown: a.cooldown })}
              </span>
            </dt>
            <dd className="text-xs leading-relaxed text-muted">{a.description}</dd>
          </div>
        ))}
        <div
          className="rounded-lg bg-gold-400/5 px-3 py-2 ring-1 ring-gold-500/30 sm:col-span-2"
          data-testid={`prep-solo-${heroId}`}
          data-solo={solo.id}
        >
          <dt className="flex items-center gap-1.5 font-semibold text-gold-200">
            <Icon name="note" size={14} /> {txt('screens.prepScreen.solo', { name: solo.name })}
            {solo.alt && (
              <span className="text-xs font-normal text-muted">
                {txt('screens.prepScreen.alternateFromTheirBond')}
              </span>
            )}
          </dt>
          <dd className="text-xs leading-relaxed text-muted">
            {solo.text} <span className="text-gold-300">{solo.cued}</span>
          </dd>
        </div>
        {talents.map((t) => (
          <div
            key={t.id}
            className="rounded-lg bg-ink-900/60 px-3 py-2 sm:col-span-2"
            data-talent={t.id}
          >
            <dt className="flex items-center gap-1.5 font-semibold text-text">
              <Icon name="talent" size={14} className="text-muted" />{' '}
              {txt('screens.prepScreen.talent', { numeral: t.numeral, name: t.name })}
            </dt>
            <dd className="text-xs leading-relaxed text-muted">{t.text}</dd>
          </div>
        ))}
        <div className="rounded-lg bg-ink-900/60 px-3 py-2 sm:col-span-2">
          <dt className="font-semibold text-text">
            {txt('screens.prepScreen.quirk', { name: def.quirk.name })}
          </dt>
          <dd className="text-xs leading-relaxed text-muted">{def.quirk.description}</dd>
        </div>
        {passive && (
          <div
            className="rounded-lg bg-ink-900/60 px-3 py-2 sm:col-span-2"
            data-testid={`prep-passive-${heroId}`}
          >
            <dt className="flex items-center gap-1.5 font-semibold text-text">
              <Icon name={passiveIcon(def)} size={14} className="text-muted" />{' '}
              {txt('screens.prepScreen.passive', { name: passive.name })}
            </dt>
            <dd className="text-xs leading-relaxed text-muted">{passive.text}</dd>
          </div>
        )}
        {summons && (
          <div
            className="rounded-lg bg-ink-900/60 px-3 py-2 sm:col-span-2"
            data-testid={`prep-summons-${heroId}`}
          >
            <dt className="flex items-center gap-1.5 font-semibold text-text">
              <Icon name="leaf" size={14} className="text-muted" />{' '}
              {txt('screens.prepScreen.saplings')}
            </dt>
            <dd className="text-xs leading-relaxed text-muted">{summons}</dd>
          </div>
        )}
        {needs && (
          <div
            className="rounded-lg bg-ink-900/60 px-3 py-2 ring-1 ring-ink-500 sm:col-span-2"
            data-testid={`prep-needs-${heroId}`}
          >
            <dt className="flex items-center gap-1.5 font-semibold text-text">
              <Icon name="heart" size={14} className="text-muted" />{' '}
              {txt('screens.prepScreen.needs')}
            </dt>
            <dd className="text-xs leading-relaxed text-muted">{needs}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

export function PrepScreen() {
  const run = useRun((s) => s.run);
  const setChords = useRun((s) => s.setChords);
  const setCalling = useRun((s) => s.setCalling);
  const embark = useRun((s) => s.embark);
  const setScreen = useUi((s) => s.setScreen);
  const xp = useProfile((s) => s.profile.xp);
  const deeds = useProfile((s) => s.profile.deeds);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  // Dissonance (Phase 4d): open once won at its Rank, or with Skip the unlocks.
  const dissonanceWon = useProfile((s) => s.profile.dissonance.open);
  const best = useProfile((s) => s.profile.dissonance.best);
  // Bonds (Phase 4e): open from a hero's first Bond rank-up, or with Skip the unlocks.
  const bonds = useProfile((s) => s.profile.bonds);
  // Technique variants (Phase 4f): the ones owned; the run follows the choice.
  const owned = useProfile((s) => s.profile.variants);
  // Calling mastery (Phase 4g): read here so Prep redraws when it (or Skip the unlocks) changes;
  // the tiers a run would offer are the store's own `tiersOpen`, which embarking snapshots.
  const mastery = useProfile((s) => s.profile.mastery);
  const allowance = useAllowance();
  const fresh = useFreshUnlocks();
  const freshRecruits = useFreshHeroes();
  // The Codex's Techniques page, over Prep (its Rules).
  const [codex, setCodex] = useState(false);
  const deedBest = useProfile((s) => s.profile.deedBest);
  const codexDissonance = useCodexDissonance();
  const codexBonds = useCodexBonds();
  const codexTechniques = useCodexTechniques();
  // Phase 5b: the roster (the profile's, or every hero with Skip the unlocks) for the picker.
  const recruited = useProfile((s) => s.profile.recruited);
  const atlas = useProfile((s) => s.profile.atlas);
  // As the store's `roster()` reckons it (`heroRoster`), following both.
  const roster = useMemo(() => heroRoster({ recruited }, unlockAll), [recruited, unlockAll]);
  const pickable = prepParty(roster);
  if (!run) return null;
  const rank = rankOf(xp);
  // Phase 6: a weekly's choices are fixed but its Chords and variants are free (decision 6(a));
  // an Echo's twists take away what they name (docs/phase-6.md).
  const weekly = run.weekly !== undefined;
  const twists = Run.echoTwists(run);
  if (codex)
    return (
      <CodexView
        onBack={() => setCodex(false)}
        initialTab="techniques"
        allowance={allowance}
        rank={rank}
        deeds={{ earned: deeds, best: deedBest }}
        dissonance={codexDissonance}
        bonds={codexBonds}
        techniques={codexTechniques}
        seen={useProfile.getState().profile.seen}
        roster={roster}
      />
    );
  return (
    <PrepView
      run={run}
      atlas={atlas}
      onChords={setChords}
      onCalling={weekly || twists.noCalling ? undefined : setCalling}
      onEmbark={embark}
      onBack={() => setScreen('loom')}
      allowance={Run.runAllowance(run, allowance)}
      weekly={weekly ? prepWeeklyInput(run.weekly!.week) : null}
      fresh={fresh}
      freshHeroes={freshRecruits}
      rank={rank}
      astrolabe={
        !weekly && !twists.noTree && astrolabeOpen(rank, unlockAll)
          ? {
              points: astrolabePoints(rank, unlockAll, deedPoints(deeds)),
              onOpen: () => setScreen('astrolabe'),
            }
          : null
      }
      reliquary={
        !weekly && !twists.noCarry && reliquaryOpen(rank, unlockAll)
          ? { slots: carrySlots(rank, unlockAll), onOpen: () => setScreen('reliquary') }
          : null
      }
      dissonance={
        // A weekly's Dissonance is its entry's, shown locked in its own panel.
        weekly
          ? null
          : {
              open: dissonanceWon || unlockAll,
              best,
              onChange: (levels) => useProfile.getState().setDissonance(levels),
            }
      }
      bonds={
        !weekly && bondsOpen(bonds, unlockAll) ? { bonds, onOpen: () => setScreen('bonds') } : null
      }
      techniques={
        weekly
          ? {
              // Every variant, for this run only (the profile's own choices are untouched).
              owned: [],
              all: true,
              onChoose: (slot, id) =>
                useRun.getState().setRunTechniques({ ...run.techniques, [slot]: id }),
              onRules: () => setCodex(true),
            }
          : {
              owned,
              all: unlockAll,
              onChoose: (slot, id) => useProfile.getState().setTechnique(slot, id),
              onRules: () => setCodex(true),
            }
      }
      mastery={{
        xp: mastery,
        tiersOpen: (id) => useProfile.getState().tiersOpen(id),
        all: unlockAll,
      }}
      // Phase 5a: the Route, once Expeditions are open; switching keeps the Calling and Chords.
      route={weekly || run.echo !== undefined ? null : prepRoute()}
      // Phase 5b: the party picker, once the roster outgrows a party.
      party={
        pickable && !Run.partyFixed(run)
          ? { roster: pickable, onChange: (ids) => useRun.getState().setParty(ids) }
          : null
      }
    />
  );
}

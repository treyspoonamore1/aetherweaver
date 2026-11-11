/**
 * Phase 4f UI: technique variants (docs/phase-4f.md), as plain data and words. Every name, number
 * and line comes from content (`CONTENT.techniqueVariants` and `variantText`, the defaults'
 * `CONTENT.techniques`) or meta (`variantsFor`, `fitOwned`, `TECHNIQUE_SLOTS`), so the tuning
 * reaches every screen untouched. How a variant is had (the Atelier's Rank, a Calling's top
 * mastery) is Phase 4g's content once it's there (docs/phase-4g.md), the plan's until then.
 */
import { CONTENT, variantText, type TechniqueVariantDef } from '../../content';
import { liveBindings } from '../../input/bindings';
import { keyLabel } from '../../input/keyLabel';
import {
  TECHNIQUE_SLOTS,
  fitOwned,
  fitTechniques,
  variantsFor,
  type Techniques,
} from '../../meta/variants';
import { pct } from '../kit/format';
import type { IconName } from '../kit/iconPaths';
import { SLOT_ICON, techniqueIcon } from '../kit/variantLook';
import type { TechniqueHud } from '../store';
import type { TechniqueKey } from '../types';
import { REWIND_NAME, rewindsFor } from './callingText';
import { t as txt } from '../text';

export { TECHNIQUE_SLOTS };

/** A variant's content, if the content knows it. */
function defOf(id: string | null | undefined): TechniqueVariantDef | undefined {
  return id ? CONTENT.techniqueVariants.find((v) => v.id === id) : undefined;
}

/** A slot's default technique's name (content's): "Ward". */
export function defaultName(slot: TechniqueKey): string {
  return CONTENT.techniques[slot].name;
}

/** What's in a slot, by name: its variant's, or the default's. */
export function slotName(slot: TechniqueKey, variant: string | null | undefined): string {
  return defOf(variant)?.name ?? defaultName(slot);
}

/** A slot's key as the player has bound it ("Q", "Space"). */
export function slotKey(slot: TechniqueKey): string {
  const code = liveBindings()[slot][0];
  return code ? keyLabel(code) : '—';
}

/** A slot's Spirit cost before modifiers (null: Glide's, which is free). */
export function slotCost(slot: TechniqueKey, variant: string | null | undefined): number | null {
  if (slot === 'glide') return null;
  return defOf(variant)?.cost ?? CONTENT.techniques[slot].cost;
}

/** A slot's cooldown before modifiers, in seconds: its variant's, or the default's. */
export function slotCooldown(slot: TechniqueKey, variant: string | null | undefined): number {
  return defOf(variant)?.cooldown ?? CONTENT.techniques[slot].cooldown;
}

/**
 * A slot's default technique in the words the variants use, with content's numbers: what the
 * variants are told against.
 */
export function defaultText(slot: TechniqueKey): string {
  const t = CONTENT.techniques;
  switch (slot) {
    case 'ward':
      return txt('screens.variantsModel.aBarrierOnThe', {
        barrierPct: pct(t.ward.barrierPct),
        barrierFlat: t.ward.barrierFlat,
        duration: t.ward.duration,
        perfectWindow: t.ward.perfectWindow,
      });
    case 'chime':
      return txt('screens.variantsModel.aBellUnderYour', {
        radius: t.chime.radius,
        healPct: pct(t.chime.healPct),
        immunity: t.chime.immunity,
      });
    case 'reel':
      return txt('screens.variantsModel.pullTheHeroYou');
    case 'glide':
      return txt('screens.variantsModel.aMDashUntouchable', {
        distance: t.glide.distance,
        iframes: t.glide.iframes,
      });
  }
}

/** A variant as the fight's HUD names it: its id, name and text (null: none, or unknown). */
export function variantHud(
  id: string | null | undefined,
): { id: string; name: string; text: string } | null {
  const def = defOf(id);
  return def ? { id: def.id, name: def.name, text: variantText(def) } : null;
}

// ── How a variant is had ──────────────────────────────────────────────────────────────

/** The Weaver Rank the Atelier, Starlight's shop, opens at (docs/phase-4g.md). */
export function atelierRank(): number {
  return CONTENT.starlight.atelierRank;
}

export type VariantSource =
  { kind: 'rank'; rank: number } | { kind: 'mastery'; calling: string; callingName: string };

/** How a variant is had: Starlight from the shop's Rank, or with a Calling's top mastery. */
export function variantSource(id: string): VariantSource {
  const m = CONTENT.mastery.callings.find((x) => x.variant === id);
  if (m) {
    const name = CONTENT.callings.find((c) => c.id === m.calling)?.name ?? m.calling;
    return { kind: 'mastery', calling: m.calling, callingName: name };
  }
  return { kind: 'rank', rank: atelierRank() };
}

/** Why a variant can't be chosen yet, short (Prep's cards): "Starlight, from Weaver Rank 5". */
export function lockText(id: string): string {
  const s = variantSource(id);
  return s.kind === 'mastery'
    ? txt('screens.variantsModel.starlightFromTheS', { callingName: s.callingName })
    : txt('screens.variantsModel.starlightFromWeaverRank', { rank: s.rank });
}

/** How a variant is had, as the Codex says it. */
export function sourceText(id: string): string {
  const s = variantSource(id);
  return s.kind === 'mastery'
    ? txt('screens.variantsModel.boughtWithStarlightFrom', { callingName: s.callingName })
    : txt('screens.variantsModel.boughtWithStarlightFrom2', { rank: s.rank });
}

// ── A slot's choice ───────────────────────────────────────────────────────────────────

/** One of a slot's three: the default, or a variant. */
export interface TechniqueOption {
  /** The variant's id; null for the slot's default. */
  id: string | null;
  slot: TechniqueKey;
  name: string;
  /** Filled from its values (`variantText`), or the default's words (`defaultText`). */
  text: string;
  icon: IconName;
  /** Spirit before modifiers (null: free, as Glide is). */
  cost: number | null;
  /** Seconds before modifiers. */
  cooldown: number;
  /** Its cost, or its cooldown, isn't the default's. */
  costChanged: boolean;
  cooldownChanged: boolean;
  /** The profile owns it (the default always). */
  owned: boolean;
  /** It can be chosen: owned, or Skip the unlocks. */
  open: boolean;
  chosen: boolean;
  /** Why it can't be chosen ("Starlight, from Weaver Rank 5"); null when open. */
  lock: string | null;
}

/** What decides a slot's options: the run's choice, what's owned, Skip the unlocks. */
export interface TechniqueContext {
  /** The variant chosen per slot (the run's `techniques`, which follows the profile in Prep). */
  techniques: Techniques;
  owned: readonly string[];
  /** Settings → Skip the unlocks (or the Training Grounds): every variant is open. */
  all: boolean;
  /** The run's Calling: the Chronomancer's Rewind takes Reel's slot. */
  callingId?: string | null;
}

/** A slot's three, in order: the default, then its variants as content lists them. */
export function techniqueOptions(slot: TechniqueKey, ctx: TechniqueContext): TechniqueOption[] {
  const chosen = ctx.techniques[slot] ?? null;
  const baseCost = slotCost(slot, null);
  const baseCooldown = slotCooldown(slot, null);
  const variants = variantsFor(slot).map((def): TechniqueOption => {
    const owned = ctx.owned.includes(def.id);
    const open = owned || ctx.all;
    const cost = slotCost(slot, def.id);
    const cooldown = slotCooldown(slot, def.id);
    return {
      id: def.id,
      slot,
      name: def.name,
      text: variantText(def),
      icon: techniqueIcon(slot, def.id),
      cost,
      cooldown,
      costChanged: cost !== baseCost,
      cooldownChanged: cooldown !== baseCooldown,
      owned,
      open,
      chosen: chosen === def.id,
      lock: open ? null : lockText(def.id),
    };
  });
  const fallback = !variants.some((v) => v.chosen);
  return [
    {
      id: null,
      slot,
      name: defaultName(slot),
      text: defaultText(slot),
      icon: SLOT_ICON[slot],
      cost: baseCost,
      cooldown: baseCooldown,
      costChanged: false,
      cooldownChanged: false,
      owned: true,
      open: true,
      chosen: fallback,
      lock: null,
    },
    ...variants,
  ];
}

/** A slot as Prep shows it: its key, its default's name, its three, and a note. */
export interface TechniqueSlotView {
  slot: TechniqueKey;
  /** The default's name: "Ward". */
  name: string;
  /** Its key, as bound: "Q". */
  key: string;
  icon: IconName;
  options: TechniqueOption[];
  /** The chosen option (the default when no variant is). */
  chosen: TechniqueOption;
  /**
   * The Chronomancer's Rewind takes this slot on this run: the choice has no effect on it (it's
   * kept for the next). Null otherwise.
   */
  note: string | null;
}

/** Rewind takes Reel's slot on a Chronomancer run. */
export function rewindNote(callingId: string | null | undefined): string | null {
  if (!rewindsFor(callingId)) return null;
  const calling = CONTENT.callings.find((c) => c.id === callingId)?.name ?? callingId;
  const reel = defaultName('reel');
  return txt('screens.variantsModel.onARunTakes', { calling, REWIND_NAME, reel });
}

export function techniqueSlots(ctx: TechniqueContext): TechniqueSlotView[] {
  return TECHNIQUE_SLOTS.map((slot) => {
    const options = techniqueOptions(slot, ctx);
    return {
      slot,
      name: defaultName(slot),
      key: slotKey(slot),
      icon: SLOT_ICON[slot],
      options,
      chosen: options.find((o) => o.chosen) ?? options[0]!,
      note: slot === 'reel' ? rewindNote(ctx.callingId) : null,
    };
  });
}

/** What a click on an option does, and what the live region says. */
export type TechniqueAction =
  | { kind: 'choose'; slot: TechniqueKey; id: string | null; announce: string }
  | { kind: 'locked'; announce: string }
  | { kind: 'none' };

/** "Chorale on Q.", or why it can't be chosen: "Chorale: Starlight, from the Luminary’s …". */
export function techniqueClick(view: TechniqueSlotView, option: TechniqueOption): TechniqueAction {
  if (!option.open) return { kind: 'locked', announce: `${option.name}: ${option.lock}.` };
  if (option.chosen) return { kind: 'none' };
  return {
    kind: 'choose',
    slot: view.slot,
    id: option.id,
    announce: txt('screens.variantsModel.on', {
      name: option.name,
      key: view.key,
      value: view.note ? txt('screens.variantsModel.takesItThisRun', { REWIND_NAME }) : '',
    }),
  };
}

/** The arrow keys: the next open option after the chosen one (wrapping), skipping locked ones. */
export function stepOption(view: TechniqueSlotView, dir: 1 | -1): TechniqueOption | null {
  const n = view.options.length;
  const at = view.options.indexOf(view.chosen);
  for (let i = 1; i < n; i++) {
    const o = view.options[(at + dir * i + n * n) % n]!;
    if (o.open) return o;
  }
  return null;
}

/** "25 Spirit", "Free" (Glide). */
export function costLabel(cost: number | null): string {
  return cost === null
    ? txt('screens.variantsModel.free')
    : txt('screens.variantsModel.spirit2', { cost });
}

/** "7 s cooldown". */
export function cooldownLabel(seconds: number): string {
  return txt('screens.variantsModel.sCooldown', { seconds });
}

// ── The panel's line ──────────────────────────────────────────────────────────────────

export interface TechniquesSummary {
  /** Variants the profile owns (that the content still knows), of all of them. */
  owned: number;
  total: number;
  all: boolean;
  /** Some variant can be chosen now (owned, or Skip the unlocks). */
  choosable: boolean;
  /** "3 of 8 variants owned.", "Every variant is open (Skip the unlocks).", or how they're had. */
  line: string;
}

export function techniquesSummary(
  owned: readonly string[],
  all: boolean,
  /** Phase 6: This Week's Song, whose level field opens every variant for its run. */
  weekly = false,
): TechniquesSummary {
  const n = fitOwned(owned).length;
  const total = CONTENT.techniqueVariants.length;
  const line = weekly
    ? txt('screens.variantsModel.everyVariantIsOpen')
    : all
      ? txt('screens.variantsModel.everyVariantIsOpen2')
      : n === 0
        ? txt('screens.variantsModel.eachSlotHasVariants', {
            countWord: countWord(variantsFor('ward').length),
          })
        : txt('screens.variantsModel.ofVariantsOwnedThe', { n, total });
  return { owned: n, total, all, choosable: all || n > 0, line };
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "a, b and c". */
function listAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ── The Codex ─────────────────────────────────────────────────────────────────────────

/** An option's state as the Codex marks it. */
export interface OptionState {
  kind: 'default' | 'owned' | 'open' | 'locked';
  label: string;
}

export function optionState(option: TechniqueOption, all: boolean): OptionState {
  if (option.id === null)
    return { kind: 'default', label: txt('screens.variantsModel.alwaysYours') };
  if (option.owned) return { kind: 'owned', label: txt('screens.variantsModel.owned') };
  if (all) return { kind: 'open', label: txt('screens.variantsModel.openSkipTheUnlocks') };
  // How it's had is the card's own line (`sourceText`).
  return { kind: 'locked', label: txt('screens.variantsModel.locked') };
}

/** The Codex's opening lines: what variants are, how they're chosen and kept, and had. */
export function codexLines(): string[] {
  const slots = TECHNIQUE_SLOTS.map((s) => defaultName(s));
  const ranked = CONTENT.techniqueVariants.filter((v) => variantSource(v.id).kind === 'rank');
  const mastered = CONTENT.techniqueVariants.filter((v) => variantSource(v.id).kind === 'mastery');
  const reel = defaultName('reel');
  const lines = [
    txt('screens.variantsModel.eachOfYourFour', {
      slots: slots.join(', '),
      countWord: countWord(variantsFor('ward').length),
    }),
    txt('screens.variantsModel.aVariantKeepsIts'),
  ];
  const byMastery = mastered.map((v) => {
    const s = variantSource(v.id);
    return txt('screens.variantsModel.withTheS', {
      name: v.name,
      value: s.kind === 'mastery' ? s.callingName : '',
    });
  });
  const rank = txt('screens.variantsModel.boughtWithStarlightFrom3', {
    atelierRank: atelierRank(),
  });
  const how =
    mastered.length === 0
      ? txt('screens.variantsModel.allAre', { rank })
      : ranked.length === 0
        ? txt('screens.variantsModel.eachOpensToBuy', { listAnd: listAnd(byMastery) })
        : txt('screens.variantsModel.areTheOtherOpen', {
            capital: capital(countWord(ranked.length)),
            rank,
            countWord: countWord(mastered.length),
            listAnd: listAnd(byMastery),
          });
  lines.push(txt('screens.variantsModel.settingsSkipTheUnlocks', { how }));
  if (CONTENT.callings.some((c) => rewindsFor(c.id)))
    lines.push(
      txt('screens.variantsModel.onARunTakes2', {
        name: CONTENT.callings.find((c) => rewindsFor(c.id))!.name,
        REWIND_NAME,
        reel,
      }),
    );
  return lines;
}

// ── In a fight ────────────────────────────────────────────────────────────────────────

/** A Weaver bar slot's tooltip: its name, whose variant it is, what it does and costs. */
export interface TechniqueTipView {
  slot: TechniqueKey;
  name: string;
  /** "A Ward variant", Rewind's slot, or null for a default. */
  sub: string | null;
  text: string;
  /** "25 Spirit", "2 charges". */
  stats: string[];
}

/** A cost as the HUD prints it ("20", "12.5" in Stasis). */
function num(v: number): string {
  return String(Number(v.toFixed(1)));
}

export function techniqueTip(
  t: Pick<TechniqueHud, 'key' | 'name' | 'variant' | 'cost' | 'pool' | 'maxCharges'>,
  /** Rewind in Reel's slot (the Chronomancer): how far back it reaches; null otherwise. */
  rewindSeconds: number | null = null,
): TechniqueTipView {
  const stats = [
    t.key === 'glide'
      ? txt('screens.variantsModel.free')
      : `${num(t.cost)} ${t.pool === 'life' ? txt('screens.variantsModel.life') : txt('screens.variantsModel.spirit')}`,
    ...(t.maxCharges > 1
      ? [txt('screens.variantsModel.charges', { maxCharges: t.maxCharges })]
      : []),
  ];
  if (t.key === 'reel' && rewindSeconds !== null)
    return {
      slot: t.key,
      name: t.name,
      sub: txt('screens.variantsModel.inSSlotOn', { defaultName: defaultName('reel') }),
      text: txt('screens.variantsModel.theHeroYouAim', { rewindSeconds }),
      stats,
    };
  return {
    slot: t.key,
    name: t.name,
    sub: t.variant
      ? txt('screens.variantsModel.aVariant', { defaultName: defaultName(t.key) })
      : null,
    text: t.variant?.text ?? defaultText(t.key),
    stats,
  };
}

// ── The Training Grounds ──────────────────────────────────────────────────────────────

/**
 * What the Training Grounds start with: the profile's choice, every variant open (fitted with
 * `all`), whatever it owns.
 */
export function trainingChoice(profile: {
  techniques: Partial<Techniques>;
  variants: readonly string[];
}): Techniques {
  return fitTechniques(profile.techniques, profile.variants, true);
}

/** The Training Grounds' choice for a slot: every option open, the profile's ownership untouched. */
export function trainingOptions(slot: TechniqueKey, techniques: Techniques): TechniqueOption[] {
  return techniqueOptions(slot, { techniques, owned: [], all: true });
}

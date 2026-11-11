import { CONTENT } from '../../content';
import type { Action } from '../../input/actions';
import type { HeroHud, HudSnapshot } from '../store';
import { keyLabel } from '../../input/keyLabel';
import { fmt } from '../kit/format';
import {
  ANSWER,
  bindingCode,
  bindingLabel,
  cueModifierMark,
  mouseRoleDefault,
  mouseRoleLabel,
} from './labels';
import { mult } from '../screens/chordModel';
import { beamSong } from './songs';
import { stasisCostMult } from './calling';
import { secondsLabel } from './chrono';
import { healBarelyTakes } from './legionLook';
import { DOOM_EMPHASIS, doomCount, spindleCutPct } from './riftLook';
import { fortissimoName, noteSources } from './finaleLook';
import { outOfReach } from './duelLook';
import { saplingsOutside } from './groveLook';
import { heroPronouns } from '../screens/rosterModel';
import { linkName } from '../screens/callingText';
import { t as txt } from '../text';

/**
 * Contextual coach hints (docs/plan/04 §7). Derived from the HUD snapshot alone; each hint
 * shows at most MAX_SHOWS times (persisted), and only when it is relevant right now.
 * `{X}` in the text renders as a key cap.
 */
export const MAX_SHOWS = 3;

export interface Hint {
  id: string;
  text: string;
}

const STORE_KEY = 'aetherweaver.hints.v1';
const memory: Record<string, number> = {};

function load(): Record<string, number> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORE_KEY);
    if (!raw) return { ...memory };
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? { ...memory, ...(parsed as Record<string, number>) }
      : { ...memory };
  } catch {
    return { ...memory };
  }
}

export function hintCount(id: string): number {
  return load()[id] ?? 0;
}

export function bumpHint(id: string): void {
  const counts = load();
  counts[id] = (counts[id] ?? 0) + 1;
  memory[id] = counts[id];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(counts));
  } catch {
    // Private mode: hints just repeat next session.
  }
}

export function resetHints(): void {
  for (const k of Object.keys(memory)) delete memory[k];
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // Nothing to clear.
  }
}

const alive = (h: HeroHud) => !h.dead && !h.downed;

function techReady(hud: HudSnapshot, key: 'ward' | 'chime' | 'reel'): boolean {
  const t = hud.weaver.techniques.find((x) => x.key === key);
  // With charges (the Ward's), it works while one is left, its cooldown running or not.
  const charged = !!t && t.maxCharges > 1 && t.charges > 0;
  return !!t && (t.remaining <= 0.05 || charged) && t.affordable && !hud.weaver.downed;
}

/** The variant a slot plays this fight (Phase 4f), or null for the default. */
function variantIn(hud: HudSnapshot, key: 'ward' | 'chime' | 'reel'): string | null {
  return hud.weaver.techniques.find((x) => x.key === key)?.variant?.id ?? null;
}

/** A variant's name, from content (Phase 4f). */
function variantName(id: string): string {
  return CONTENT.techniqueVariants.find((v) => v.id === id)?.name ?? id;
}

/**
 * Hints that name the answer a telegraph wants (Ward it, Chime the mark away, Reel or Rewind them
 * out of it, the boss cast's answer). Phase 4d: Blind Score hides them, as it hides every answer.
 */
export const ANSWER_HINTS: ReadonlySet<string> = new Set([
  'lethal-ward',
  'lethal-rewind',
  'lethal-reel',
  'big-hit',
  'marked',
  'boss-cast',
  // Movement II (docs/phase-5a.md): each names the answer its threat wants.
  'bleed',
  'pinned',
  'pact',
  'latched',
  'wound',
  'guard',
  'bloodmoon',
  'execution',
  // Movement III (docs/phase-5c.md). The rune and the cut hints stay: they say why an input was
  // refused and when the Thread comes back, not what a telegraph wants.
  'cut-coming',
  'inhale',
  'possessed',
  'wraith',
  'doom',
  'stitched',
  'unravel',
  'spindles',
  'verse',
  'mirror-ward',
  'mimic',
  // The Finale (docs/phase-5d.md): each names the answer its beat wants.
  'discord',
  'fortissimo',
  'silence',
]);

/** All hints that apply right now, most important first. */
export function evaluateHints(hud: HudSnapshot, opts: { banner?: boolean } = {}): Hint[] {
  const all = allHints(hud);
  // The Conductor's timing hints wait for a quiet moment: not while the Grand Finale plays (its
  // pips, turns and banner fill the screen) nor while a banner call-out is up.
  const busy = !!hud.conducting?.finale || !!opts.banner;
  const shown = busy ? all.filter((h) => !QUIET_HINTS.has(h.id)) : all;
  return hud.dissonance?.blindScore ? shown.filter((h) => !ANSWER_HINTS.has(h.id)) : shown;
}

/**
 * Hints that only open in a quiet moment (docs/phase-5f.md): the chain's and the beat's. An open
 * one closes at once when the moment stops being quiet (`CoachHints`).
 */
export const QUIET_HINTS: ReadonlySet<string> = new Set(['chain', 'beat']);

function allHints(hud: HudSnapshot): Hint[] {
  if (hud.encounter.kind === 'sandbox' || hud.encounter.status !== 'fighting') return [];
  const out: Hint[] = [];
  const w = hud.weaver;
  const party = hud.party;
  const Q = `{${bindingLabel('ward')}}`;
  const E = `{${bindingLabel('chime')}}`;
  const F = `{${bindingLabel('reel')}}`;

  // Fermata hold: the most urgent thing on screen.
  for (const h of party.filter((p) => p.held && !p.dead)) {
    // Brann (docs/phase-5b.md): your healing on him is halved, but any of it saves him.
    if (h.blood) {
      const him = heroPronouns(h.defId).obj;
      out.push({
        id: 'brannHold',
        text: txt('hud.hints.fermataHoldsAt1', {
          name: h.name,
          him,
          value: h.threaded
            ? txt('hud.hints.keepMending', { him })
            : txt('hud.hints.thread', { him, value: h.slot + 1 }),
        }),
      });
    }
    out.push({
      id: 'hold',
      text: h.threaded
        ? txt('hud.hints.fermataIsHoldingAt', { name: h.name, E })
        : txt('hud.hints.fermataIsHoldingAt2', { name: h.name, value: h.slot + 1, E }),
    });
  }
  // The Chronomancer (Phase 3e): Rewind is in Reel's slot. F Rewinds the hovered hero, else
  // the threaded one, so a hero who isn't its target is threaded first.
  const rewind = w.rewind?.ready ? w.rewind : null;
  const toRewind = (h: HeroHud) =>
    h.rewind?.target
      ? F
      : txt('hud.hints.then', { bindingLabel: bindingLabel(`focus${h.slot + 1}` as Action), F });
  if (rewind) {
    for (const h of party.filter((p) => p.rewind?.kind === 'revive' && p.rewind.inRange)) {
      out.push({
        id: 'rewind-up',
        text: txt('hud.hints.justWentDownPress', {
          name: h.name,
          toRewind: toRewind(h),
          secondsLabel: secondsLabel(h.rewind!.left),
        }),
      });
    }
  }
  // Call and Response: the first time a hero asks for something specific.
  for (const h of party.filter((p) => alive(p) && p.call && !p.call.answered)) {
    const call = h.call!;
    out.push({
      id: 'call',
      text:
        call.answer === 'ward'
          ? txt('hud.hints.isCallingForA', { name: h.name, Q, flourish: call.flourish })
          : call.answer === 'chime'
            ? txt('hud.hints.isCallingForA2', { name: h.name, E, flourish: call.flourish })
            : txt('hud.hints.isCallingForEmpower', {
                name: h.name,
                RMB: modeKey(),
                value: h.slot + 1,
                flourish: call.flourish,
              }),
    });
  }

  // Phase 4f: the Ward's slot may play a variant: the hints name it.
  const ward = variantIn(hud, 'ward');
  const wardIt = ward ? `cast ${variantName(ward)} ${Q}` : `Ward ${Q}`;
  for (const h of party.filter(alive)) {
    if (h.lethal) {
      if (techReady(hud, 'ward')) {
        out.push({
          id: 'lethal-ward',
          text: txt('hud.hints.aLethalHitIs', { name: h.name, wardIt }),
        });
      } else if (w.rewind) {
        // Rewind only helps if where they stood is out of it (or Paradox undoes it).
        if (rewind && h.rewind?.escape && h.rewind.inRange)
          out.push({
            id: 'lethal-rewind',
            text:
              h.rewind.escape === 'undo'
                ? txt('hud.hints.aLethalHitIs2', { name: h.name, toRewind: toRewind(h) })
                : txt('hud.hints.isInALethal', { name: h.name, toRewind: toRewind(h) }),
          });
      } else if (techReady(hud, 'reel')) {
        out.push({ id: 'lethal-reel', text: reelHint(h.name, variantIn(hud, 'reel'), F) });
      }
    }
  }
  for (const h of party.filter(alive)) {
    if (!h.lethal && h.incoming >= h.maxHp * 0.3 && techReady(hud, 'ward')) {
      out.push({
        id: 'big-hit',
        text: txt('hud.hints.aBigHitIs', { name: h.name, wardIt }),
      });
    }
  }
  const chime = variantIn(hud, 'chime');
  for (const h of party.filter(alive)) {
    if (h.statuses.some((s) => s.id === 'dirge')) {
      out.push({
        id: 'marked',
        text: techReady(hud, 'chime')
          ? chime
            ? txt('hud.hints.isMarkedPressTo', { name: h.name, E, variantName: variantName(chime) })
            : txt('hud.hints.isMarkedPressTo2', { name: h.name, E })
          : txt('hud.hints.isMarkedAWard', { name: h.name, Q }),
      });
    }
  }
  out.push(...movementTwoHints(hud, { Q, E, F }));
  out.push(...movementThreeHints(hud, { Q, E, F }));
  out.push(...finaleHints(hud));
  for (const h of party.filter((p) => p.downed && !p.dead)) {
    out.push({
      id: 'downed',
      text: txt('hud.hints.isDownThreadThem', { name: h.name, value: h.slot + 1 }),
    });
  }
  // A big blow Rewind would give back, while they're still in danger.
  if (rewind) {
    for (const h of party.filter(alive)) {
      const r = h.rewind;
      if (
        r?.kind === 'restore' &&
        r.inRange &&
        r.amount >= h.maxHp * 0.35 &&
        (h.lethal || h.hp < h.maxHp * 0.5)
      )
        out.push({
          id: 'rewind-back',
          text: txt('hud.hints.tookABigBlow', {
            name: h.name,
            toRewind: toRewind(h),
            amount: fmt(r.amount),
            seconds: rewind.seconds,
          }),
        });
    }
  }
  // The Martyr (Phase 3d): Bear has its own key, and costs the threaded hero their Mend.
  // Bear may be unbound (a player's override took B): the hints then point to Settings.
  const bearKey = bindingCode('bear');
  const B = `{${bindingLabel('bear')}}`;
  if (w.bearShare > 0 && bearKey) {
    const threaded = party.find((h) => alive(h) && h.threaded);
    if (
      threaded &&
      w.threadMode !== 'bear' &&
      (threaded.lethal || threaded.incoming >= threaded.maxHp * 0.3)
    ) {
      out.push({
        id: 'bear',
        text: txt('hud.hints.bearTakePartOf', { B, name: threaded.name }),
      });
    }
    if (
      threaded &&
      w.threadMode === 'bear' &&
      threaded.hp < threaded.maxHp * 0.5 &&
      threaded.incoming <= 0
    ) {
      out.push({
        id: 'bear-back',
        text: txt('hud.hints.bearingStopsYourOn', {
          value: w.lastMode === 'mend' ? txt('hud.hints.mend') : txt('hud.hints.empower'),
          name: threaded.name,
          B,
        }),
      });
    }
  }
  if (w.vow && w.bearShare > 0) {
    out.push({
      id: 'vow',
      text: txt('hud.hints.yourHeroesCanT', { crescendoName: w.crescendoName }),
    });
  }
  if (w.stasis) {
    const less = Math.round((1 - stasisCostMult(hud.calling?.id)) * 100);
    out.push({
      id: 'stasis',
      text: txt('hud.hints.everyEnemyWaitsYour', {
        crescendoName: w.crescendoName,
        value: less > 0 ? txt('hud.hints.andCostLess', { less }) : '',
        Q,
        E,
        F,
      }),
    });
  }
  // Brann fights best hurt (docs/phase-5b.md): his own hints, never the 'hurt' ones.
  out.push(...brannHints(hud, { Q, F }));
  // Seren and Oro (docs/phase-5e.md): their own hints, with their own ids.
  out.push(...serenHints(hud, { Q, F }), ...oroHints(hud));
  const hurt = party.filter((h) => alive(h) && !h.blood && h.hp < h.maxHp * 0.5);
  for (const h of hurt) {
    if (!h.threaded) {
      out.push({
        id: 'hurt',
        text: txt('hud.hints.isHurtClickTheir', { name: h.name, value: h.slot + 1 }),
      });
    } else if (
      w.threadMode === 'empower' ||
      (w.threadMode === 'bear' && w.lastMode === 'empower')
    ) {
      out.push({
        id: 'hurt-mode',
        text:
          w.threadMode === 'bear'
            ? txt('hud.hints.isHurtPressTwice', {
                name: h.name,
                RMB: modeKey(),
                value: bearKey ? txt('hud.hints.orThen', { B, RMB: modeKey() }) : '',
              })
            : txt('hud.hints.isHurtPressTo', { name: h.name, RMB: modeKey() }),
      });
    }
  }
  if (w.fieldSuppressed) {
    out.push({
      id: 'silenced',
      // The hymn circles are the Hollow Cantor's: only while they stand do they help.
      text:
        (hud.hymnCircles ?? 0) > 0
          ? txt('hud.hints.yourAurasAreSilenced', { bindingLabel: bindingLabel('directiveRally') })
          : txt('hud.hints.yourAurasAreSilenced2', {
              silencerName: silencerName(hud),
              bindingLabel: bindingLabel('directiveFocus'),
            }),
    });
  }
  // Seren (docs/phase-5e.md) duels outside your field by design: her own hints say what to do.
  const reelTarget = party.find(
    (h) => alive(h) && !h.inField && h.distance > w.fieldRadius + 3 && !h.duel?.quarryName,
  );
  if (reelTarget && w.auras.length > 0 && !w.fieldSuppressed) {
    out.push({
      id: 'strayed',
      // Rewind sends a hero back, not to you: on a Chronomancer run, walk to them.
      text: w.rewind
        ? txt('hud.hints.isOutsideYourField', { name: reelTarget.name })
        : txt('hud.hints.isOutsideYourField2', { name: reelTarget.name, F }),
    });
  }
  // The beam song: the first time it pours into someone, say what that means.
  const beam = beamSong(w.chords);
  const focused = party.find((h) => alive(h) && h.beamFocus);
  if (beam && focused && hud.encounter.elapsed > 4 && !w.fieldSuppressed) {
    out.push({
      id: 'beam',
      text:
        beam.echo > 0
          ? txt('hud.hints.yourBeamSongPours', { mult: mult(beam.focus), name: focused.name })
          : txt('hud.hints.yourBeamSongPours2', { mult: mult(beam.focus), name: focused.name }),
    });
  }
  // The Conductor (docs/phase-5f.md): chain a Duet, Cue on the downbeat, the Grand Finale.
  // Before the plain Cue's hint: a chain's window is the more urgent.
  out.push(...conductingHints(hud));
  // What a Cue costs is the fight's (Silent Cues, Phase 4d, raises it past a segment).
  const cueHero = party.find((h) => h.soloReady && alive(h));
  // During the Grand Finale a Cue only makes that hero's turn wait: say nothing then.
  if (cueHero && w.resonance + 1e-9 >= w.cueCost && !hud.conducting?.finale) {
    out.push({
      id: 'cue',
      text: cueHero.soloAuto
        ? txt('hud.hints.sIsReadyPress', {
            name: cueHero.name,
            soloName: cueHero.soloName,
            mod: cueModifierMark(),
            value: cueHero.slot + 1,
          })
        : txt('hud.hints.sIsReadyPress2', {
            name: cueHero.name,
            soloName: cueHero.soloName,
            mod: cueModifierMark(),
            value: cueHero.slot + 1,
            value2:
              w.cueCost === w.segment
                ? txt('hud.hints.oneResonanceSegment')
                : txt('hud.hints.resonance', { cueCost: w.cueCost }),
          }),
    });
  }
  if (w.resonance >= w.crescendoCost && w.crescendo <= 0 && !hud.conducting) {
    out.push({
      id: 'crescendo',
      text: txt('hud.hints.resonanceIsFullPress', {
        bindingLabel: bindingLabel('crescendo'),
        crescendoName: w.crescendoName,
      }),
    });
  }
  // Foresight: the first time it shows an attack on its way to someone.
  const seen = party.find((h) => alive(h) && h.foreseen.some((f) => f.aimed));
  if (seen) {
    const f = seen.foreseen.find((x) => x.aimed)!;
    out.push({
      id: 'foresight',
      text: txt('hud.hints.foresightIsComingFor', {
        name: f.name,
        name2: seen.name,
        value:
          f.in < 0.05
            ? txt('hud.hints.anyMoment')
            : txt('hud.hints.in', { secondsLabel: secondsLabel(f.in) }),
      }),
    });
  }
  if (hud.boss?.cast && hud.boss.cast.answers.length > 0) {
    const names = hud.boss.cast.answers
      .map((a) => (a === 'reel' && w.rewind ? 'Rewind' : ANSWER[a].label))
      .join(' or ');
    out.push({
      id: 'boss-cast',
      text: txt('hud.hints.isComingAnswerIt', { name: hud.boss.cast.name, names }),
    });
  }
  // Pedal Point: the planted field only helps where the fight is.
  if (w.plant && w.plant.remaining <= 0.05 && party.filter(alive).some((h) => !h.inField)) {
    const V = `{${w.plant.key0 ? keyLabel(w.plant.key0) : bindingLabel('plant')}}`;
    out.push({
      id: 'plant',
      text: txt('hud.hints.yourPedalPointField', { V }),
    });
  }
  // The Directive wheel: when the party is spread out, or once the fight has settled.
  const strays = party.filter((h) => alive(h) && !h.inField).length;
  if (hud.directive === null && (strays >= 2 || hud.encounter.elapsed > 45)) {
    out.push({
      id: 'wheel',
      text:
        strays >= 2
          ? txt('hud.hints.yourPartyIsSpread', { bindingLabel: bindingLabel('directiveWheel') })
          : mouseRoleDefault('wheel')
            ? txt('hud.hints.holdOrTheMiddle', { bindingLabel: bindingLabel('directiveWheel') })
            : txt('hud.hints.holdOrTheWheelButton', {
                bindingLabel: bindingLabel('directiveWheel'),
                wheel: mouseRoleLabel('wheel'),
              }),
    });
  }
  if (w.threadSlot === null && hud.encounter.elapsed > 3 && party.some(alive)) {
    out.push({
      id: 'thread',
      text: txt('hud.hints.clickAPartyFrame'),
    });
  }
  // The Chronomancer's first fights: introduce Rewind once the Thread is on someone.
  if (w.rewind && w.threadSlot !== null && hud.encounter.elapsed > 6) {
    out.push({
      id: 'rewind-intro',
      text: txt('hud.hints.rewindYourThreadedHero', { F, seconds: w.rewind.seconds }),
    });
  }
  // The Martyr's first fight: introduce Bear once the Thread is on someone.
  if (
    w.bearShare > 0 &&
    w.threadSlot !== null &&
    w.threadMode !== 'bear' &&
    hud.encounter.elapsed > 6
  ) {
    out.push({
      id: 'bear-intro',
      text: bearKey ? txt('hud.hints.bearTakePartOf2', { B }) : txt('hud.hints.bearHasNoKey'),
    });
  }
  // Not in the Grand Silence: the stilled party deals nothing and the Conductor cannot be hurt.
  if (
    w.threadMode === 'mend' &&
    !hud.boss?.silence &&
    hud.encounter.elapsed > 20 &&
    hud.encounter.enemies > 0 &&
    party.filter(alive).length > 0 &&
    party.filter(alive).every((h) => h.hp >= h.maxHp * 0.85)
  ) {
    out.push({
      id: 'empower',
      text: txt('hud.hints.everyoneIsHealthyPress', { RMB: modeKey() }),
    });
  }
  return out;
}

/**
 * The Conductor's three lessons (docs/phase-5f.md "Hints"): `chain` while a chain is open and
 * another ready hero would join it, `beat` (A Tempo) while a hero is ready to Cue, and `finale`
 * when the Grand Finale can be sung. Its window, cost and link are the sim's (`hud.conducting`).
 */
function conductingHints(hud: HudSnapshot): Hint[] {
  const c = hud.conducting;
  if (!c) return [];
  const out: Hint[] = [];
  const w = hud.weaver;
  const ready = hud.party.filter((h) => alive(h) && h.soloReady && h.cue);
  const chained = c.chain
    ? ready.find((h) => h.cue!.link > 1 && w.resonance + 1e-9 >= h.cue!.cost)
    : undefined;
  if (c.chain && chained)
    out.push({
      id: 'chain',
      text: txt('hud.hints.cueAnotherWithinS', {
        Number: Number(c.chain.total.toFixed(1)),
        linkName: linkName(chained.cue!.link),
        name: chained.name,
        mod: cueModifierMark(),
        value: chained.slot + 1,
      }),
    });
  if (c.beat && ready.length > 0)
    out.push({
      id: 'beat',
      text:
        c.beat.downbeatCost > 0
          ? txt('hud.hints.cueOnTheDownbeat', { downbeatCost: c.beat.downbeatCost })
          : txt('hud.hints.cueOnTheDownbeat2'),
    });
  if (c.finale === null && w.crescendo <= 0 && w.resonance + 1e-9 >= w.crescendoCost)
    out.push({
      id: 'finale',
      text: txt('hud.hints.playsEverySoloRising', {
        crescendoName: w.crescendoName,
        bindingLabel: bindingLabel('crescendo'),
      }),
    });
  return out;
}

/** The Mend ⇄ Empower mouse role as a key part of a hint: `{RMB}` by default. */
function modeKey(): string {
  return `{${mouseRoleLabel('mode')}}`;
}

/** Splits `text {Q} more` into plain and key parts. */
export function splitHint(text: string): { key: boolean; text: string }[] {
  return text
    .split(/(\{[^}]+\})/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('{') ? { key: true, text: part.slice(1, -1) } : { key: false, text: part },
    );
}

/**
 * Someone is in a lethal zone and Reel's slot is ready: Reel pulls them out. A variant in the
 * slot (Phase 4f) is named, not explained: what it does is content's (Prep, the tooltip).
 */
function reelHint(name: string, variant: string | null, F: string): string {
  if (variant) return txt('hud.hints.isInALethal2', { name, variantName: variantName(variant), F });
  return txt('hud.hints.isInALethal3', { name, F });
}

// ── Movement II (docs/phase-5a.md) ───────────────────────────────────────────────────

/** Chime the bleeding from this many stacks (the badge's emphasis). */
const BLEED_CHIME_AT = 5;

function stacksOf(h: HeroHud, id: string): number {
  const s = h.statuses.find((x) => x.id === id);
  return s ? (s.stacks ?? 1) : 0;
}

/**
 * The Crimson Legion's threats, each with the verb it teaches: Chime a stack, Reel to free,
 * Scatter a pact, Focus to flank, heal where Bloodmoon holds, lift the condemned.
 */
function movementTwoHints(hud: HudSnapshot, keys: { Q: string; E: string; F: string }): Hint[] {
  const { Q, E, F } = keys;
  const out: Hint[] = [];
  const up = hud.party.filter(alive);
  const boss = hud.boss;
  if (boss?.executeTarget) {
    const condemned = up.find((h) => h.execute !== undefined);
    const pct = Math.round((condemned?.execute ?? EXECUTE_DEFAULT) * 100);
    out.push({
      id: 'execution',
      // Brann (docs/phase-5b.md): your healing barely takes on him, so the Ward is the answer;
      // with Blood Oath it takes in full (no live cut), so the generic answer stands.
      text: healBarelyTakes(condemned)
        ? txt('hud.hints.isCondemnedWardYour', {
            executeTarget: boss.executeTarget,
            Q,
            obj: heroPronouns(condemned!.defId).obj,
          })
        : txt('hud.hints.isCondemnedLiftThem', { executeTarget: boss.executeTarget, pct, Q }),
    });
  }
  for (const h of up) {
    const bleed = stacksOf(h, 'bleed');
    if (bleed >= BLEED_CHIME_AT)
      out.push({
        id: 'bleed',
        text: txt('hud.hints.isBleedingChimeOn', { name: h.name, bleed, E }),
      });
  }
  for (const h of up.filter((p) => p.statuses.some((s) => s.id === 'pinned')))
    out.push({
      id: 'pinned',
      text: hud.weaver.rewind
        ? txt('hud.hints.isPinnedAWard', { name: h.name, Q })
        : txt('hud.hints.isPinnedReelFrees', { name: h.name, F }),
    });
  for (const h of up.filter((p) => p.statuses.some((s) => s.id === 'latched')))
    out.push({
      id: 'latched',
      // On a Chronomancer run Reel's key casts Rewind, which frees no one: Chime does.
      text: hud.weaver.rewind
        ? txt('hud.hints.aLeechHasLatched', { name: h.name, E })
        : txt('hud.hints.aLeechHasLatched2', { name: h.name, F, E }),
    });
  const pact = up.filter((p) => p.statuses.some((s) => s.id === 'pact'));
  if (pact.length > 0)
    out.push({
      id: 'pact',
      text: txt('hud.hints.aBloodPactScatter', {
        pact: pact.map((h) => h.name).join(' and '),
        value: pact.length > 1 ? txt('hud.hints.share') : txt('hud.hints.carries'),
        bindingLabel: bindingLabel('directiveScatter'),
      }),
    });
  for (const h of up.filter((p) => p.statuses.some((s) => s.id === 'wound')))
    out.push({
      id: 'wound',
      text: txt('hud.hints.isWoundedHealingOn', { name: h.name, E }),
    });
  // Keyed on the Sentinel blocking a blow (the sim's `guardBlocked`, via the HUD bridge), while
  // nothing is focused.
  if (hud.guardBlocked && hud.focusTarget === null)
    out.push({
      id: 'guard',
      text: txt('hud.hints.aCrimsonSentinelS', { bindingLabel: bindingLabel('directiveFocus') }),
    });
  if (boss?.bloodmoon)
    out.push({
      id: 'bloodmoon',
      text: txt('hud.hints.bloodmoonHealingIsHalved', {
        bindingLabel: bindingLabel('directiveRally'),
        value: hud.weaver.rewind ? '' : txt('hud.hints.reelFreesAPinned', { F }),
      }),
    });
  return out;
}

/** Execution's line when no frame carries it (content's `executeBelow`). */
const EXECUTE_DEFAULT =
  CONTENT.attacks.find((a) => a.executeBelow !== undefined)?.executeBelow ?? 0.4;

// ── Brann (docs/phase-5b.md) ─────────────────────────────────────────────────────────

/**
 * Brann's hints, each with its own id so the existing hints' counts are untouched: hurt, he wants
 * a Ward, not a Mend (`brannLow`); a Rally he refuses (`brannRally`). His Fermata hint
 * (`brannHold`) sits with the hold's.
 */
function brannHints(hud: HudSnapshot, keys: { Q: string; F: string }): Hint[] {
  const { Q, F } = keys;
  const out: Hint[] = [];
  for (const h of hud.party.filter((p) => alive(p) && p.blood)) {
    const him = heroPronouns(h.defId).obj;
    if (hud.directive === 'rally' && h.blood!.bloodlust)
      out.push({
        id: 'brannRally',
        // A Void Maw's Inhale (Movement III only) wants him out of the pull, not Warded.
        text: hud.rift?.inhale
          ? txt('hud.hints.bloodlustWonTRally', {
              name: h.name,
              bloodlustPct: bloodlustPct(h.defId),
              mawRescue: mawRescue(hud, F, 'him'),
            })
          : txt('hud.hints.bloodlustWonTRally2', {
              name: h.name,
              bloodlustPct: bloodlustPct(h.defId),
              Q,
              him,
              value: h.talents.includes('iron_will')
                ? txt('hud.hints.ironWillBringsBack', { him })
                : '',
              value2: hud.weaver.rewind ? '' : txt('hud.hints.orReel', { F, him }),
            }),
      });
    if (h.hp < h.maxHp * 0.5)
      out.push({
        id: 'brannLow',
        text: txt('hud.hints.fightsHarderHurtWard', { name: h.name, Q, him }),
      });
  }
  return out;
}

// ── Seren and Oro (docs/phase-5e.md) ─────────────────────────────────────────────────

/**
 * Seren's hints, each with its own id so the existing hints' counts are untouched: surrounded in
 * her duel, the answer by the Reel slot (`serenOver`; with Swap, `serenSwap`: swapping in puts
 * you in her duel); beyond your reach (`serenReach`); her duel itself (`serenDuel`); and, while
 * your Ward is on her, the kill shot a Perfect one is (`serenKillShot`).
 */
function serenHints(hud: HudSnapshot, keys: { Q: string; F: string }): Hint[] {
  const { Q, F } = keys;
  const out: Hint[] = [];
  const C = `{${bindingLabel('directiveRally')}}`;
  const G = `{${bindingLabel('glide')}}`;
  const reel = variantIn(hud, 'reel');
  for (const h of hud.party.filter((p) => alive(p) && p.duel)) {
    const d = h.duel!;
    if (d.overextended) {
      if (!hud.weaver.rewind && reel === 'swap')
        out.push({
          id: 'serenSwap',
          text: txt('hud.hints.swapPutsYouIn', { C }),
        });
      else
        out.push({
          id: 'serenOver',
          text: hud.weaver.rewind
            ? txt('hud.hints.isSurroundedRallyShe', { name: h.name, C })
            : reel === 'anchor'
              ? txt('hud.hints.isSurroundedRallyShe2', { name: h.name, C })
              : txt('hud.hints.isSurroundedReelHer', { name: h.name, F, C }),
        });
    }
    if (outOfReach(h))
      out.push({
        id: 'serenReach',
        text: txt('hud.hints.isBeyondYourReach', { name: h.name, G }),
      });
    if (d.quarryName)
      out.push({
        id: 'serenDuel',
        text: txt('hud.hints.duelsAloneWardHer', { name: h.name, Q, F, C }),
      });
    if (d.armed && !d.waltz)
      out.push({ id: 'serenKillShot', text: txt('hud.hints.aPerfectWardOn', { Q, name: h.name }) });
  }
  return out;
}

/**
 * Oro's hints, each with its own id: Saplings standing outside your songs (`oroOutside`), Gentle
 * with no Focus (`oroGentle`, once the fight has run a moment), and, at a boss, that bosses and
 * the biggest foes ignore Saplings (`oroBoss`).
 */
function oroHints(hud: HudSnapshot): Hint[] {
  const out: Hint[] = [];
  const w = hud.weaver;
  const C = `{${bindingLabel('directiveRally')}}`;
  for (const h of hud.party.filter((p) => alive(p) && p.grove)) {
    if (saplingsOutside(h) > 0 && w.auras.length > 0 && !w.fieldSuppressed)
      out.push({
        id: 'oroOutside',
        text: txt('hud.hints.sSaplingsAreOutside', { name: h.name, C }),
      });
    if (h.grove!.tending && hud.encounter.elapsed > 6 && hud.encounter.enemies > 0)
      out.push({
        id: 'oroGentle',
        text: txt('hud.hints.wonTFightWithout', {
          name: h.name,
          bindingLabel: bindingLabel('directiveFocus'),
        }),
      });
    if (hud.boss) out.push({ id: 'oroBoss', text: txt('hud.hints.bossesAndTheBiggest') });
  }
  return out;
}

/**
 * What takes a hero out of a Void Maw's pull, or keeps it from dragging them in, by the Reel
 * slot (docs/phase-5c.md, Void Maw): a plain Reel lands them by you; Anchor holds them where they
 * stand (inside the pull it still hurts, so before it drags them); Rewind sends a dragged hero
 * back; Swap would put you in the Maw, so a Hold (the party's, which he always obeys) keeps a
 * hero outside it where they stand.
 */
function mawRescue(hud: HudSnapshot, F: string, who: 'one' | 'him'): string {
  const them = who === 'one' ? 'them' : 'him';
  if (hud.weaver.rewind)
    return who === 'one'
      ? txt('hud.hints.rewindOneItDrags', { F })
      : txt('hud.hints.rewindHimBackOnce', { F });
  const reel = variantIn(hud, 'reel');
  if (reel === 'anchor') return txt('hud.hints.anchorBeforeItDrags', { F, who, them });
  if (reel === 'swap')
    return txt('hud.hints.holdSoOutsideIt', {
      bindingLabel: bindingLabel('directiveHold'),
      value: who === 'one' ? txt('hud.hints.theyStay') : txt('hud.hints.heStays'),
    });
  return txt('hud.hints.reelOut', { F, who });
}

/**
 * Whom the 'silenced' hint marks: a Silencing elite (Movement III's affix) when one stands and no
 * Mute does; the Mute otherwise, as it always read (a downed Weaver silences in every Movement).
 */
function silencerName(hud: HudSnapshot): string {
  return hud.rift?.silencer && !hud.foes?.includes('mute')
    ? txt('hud.hints.silencingElite')
    : 'Mute';
}

/** Bloodlust's line, as a whole percent (content's `quirk.below`). */
function bloodlustPct(defId: string): number {
  return Math.round((CONTENT.heroes.find((h) => h.id === defId)?.quirk.below ?? 0.4) * 100);
}

// ── Movement III (docs/phase-5c.md) ──────────────────────────────────────────────────

/**
 * The Unstitched's threats, each with the verb it teaches: Retarget off a cut line, re-thread
 * after a cut, Rally out of an Inhale, Chime the possessed, Focus the Wraith, Glide out of a rune
 * (a technique silence, not the Mute's aura one), Chime Doom, Empower through Unravel, Focus the
 * Spindles, the Verse and the Mirror Ward, vary what a Mimic copies. Every one keys on a HUD key
 * only Movement III sets, so a Movement I or II fight shows none.
 */
function movementThreeHints(hud: HudSnapshot, keys: { Q: string; E: string; F: string }): Hint[] {
  const { Q, E, F } = keys;
  const out: Hint[] = [];
  const w = hud.weaver;
  const up = hud.party.filter(alive);
  const rift = hud.rift;
  const boss = hud.boss;
  const focus = `{${bindingLabel('directiveFocus')}}`;
  const rally = `{${bindingLabel('directiveRally')}}`;
  if (w.runeLocked && !w.downed)
    out.push({
      id: 'rune',
      text: txt('hud.hints.youStandInA', {
        value: w.rewind ? txt('hud.hints.rewind') : txt('hud.hints.reel'),
        bindingLabel: bindingLabel('glide'),
      }),
    });
  if (rift?.cutComing && w.threadSlot !== null)
    out.push({
      id: 'cut-coming',
      text: txt('hud.hints.willCutYourThread', { name: rift.cutComing.name }),
    });
  if (w.threadCut)
    out.push({
      id: 'cut',
      text: txt('hud.hints.yourThreadWasCut', { secondsLabel: secondsLabel(w.threadLock) }),
    });
  if (rift?.inhale) {
    // A bloodlusting Brann refuses the Rally (docs/phase-5c.md, Void Maw): name what he obeys.
    const lust = up.find((h) => h.blood?.bloodlust);
    const brann = lust
      ? txt('hud.hints.wonTRallyBelow', {
          name: lust.name,
          bloodlustPct: bloodlustPct(lust.defId),
          mawRescue: mawRescue(hud, F, 'him'),
        })
      : '';
    out.push({
      id: 'inhale',
      text:
        !w.rewind && variantIn(hud, 'reel') === 'swap'
          ? txt('hud.hints.aVoidMawBreathes', { rally, brann })
          : txt('hud.hints.aVoidMawBreathes2', {
              rally,
              mawRescue: mawRescue(hud, F, 'one'),
              brann,
            }),
    });
  }
  // The Wraith's cast (`rift.wraithCasting`) names the hero its doubt mark is on; the hint goes the
  // moment the cast is interrupted, even while an orphaned mark lingers its last half second.
  let wraithNamed = false;
  for (const h of up) {
    if (h.possessed)
      out.push({
        id: 'possessed',
        text: txt('hud.hints.isPossessedChimeOn', {
          name: h.name,
          value: h.possessed.victim
            ? txt('hud.hints.andStrikes', { victim: h.possessed.victim })
            : '',
          E,
        }),
      });
    if (rift?.wraithCasting && !wraithNamed && h.statuses.some((s) => s.id === 'doubt')) {
      wraithNamed = true;
      out.push({
        id: 'wraith',
        text: txt('hud.hints.aDoubtWraithReaches', { name: h.name, focus, E }),
      });
    }
  }
  if (rift?.wraithCasting && !wraithNamed)
    out.push({
      id: 'wraith',
      text: txt('hud.hints.aDoubtWraithIs', { focus }),
    });
  for (const h of up) {
    const doom = stacksOf(h, 'doom');
    const doomed = h.statuses.some((s) => s.id === 'doomed');
    if (doomed || doom >= DOOM_EMPHASIS)
      out.push({
        id: 'doom',
        text: doomed
          ? txt('hud.hints.doomIgnitesOnChime', { name: h.name, E, Q })
          : txt('hud.hints.carriesDoomChimeBefore', {
              name: h.name,
              doomCount: doomCount(doom),
              E,
              Q,
            }),
      });
  }
  // A Stitch pairs two heroes up to its whole reach apart, and a Chime frees only those it
  // reaches (radius 4): never promise one Chime frees both.
  const stitched = up.filter((h) => h.stitchedWith && h.stitchedWith.length > 0);
  if (stitched.length > 0)
    out.push({
      id: 'stitched',
      text:
        stitched.length > 1
          ? txt('hud.hints.areStitchedToThe', {
              stitched: stitched.map((h) => h.name).join(' and '),
              E,
              value: w.rewind ? '' : txt('hud.hints.aReelTheOne', { F }),
            })
          : txt('hud.hints.isStitchedToThe', {
              name: stitched[0]!.name,
              E,
              value: w.rewind ? '' : txt('hud.hints.orReelThemFree', { F }),
            }),
    });
  if ((w.unravelLeft ?? 0) > 0 && w.threadMode === 'mend')
    out.push({
      id: 'unravel',
      text:
        w.bearShare > 0 && bindingCode('bear')
          ? txt('hud.hints.unravelYourMendWounds', {
              RMB: modeKey(),
              bindingLabel: bindingLabel('bear'),
            })
          : txt('hud.hints.unravelYourMendWounds2', { RMB: modeKey() }),
    });
  if (boss?.spindles)
    out.push({
      id: 'spindles',
      text: txt('hud.hints.spindlesShieldTheBoss', { spindleCutPct: spindleCutPct(), focus }),
    });
  if (boss?.stolen)
    out.push({
      id: 'verse',
      text: txt('hud.hints.wasStolenFocusThe', {
        name: boss.stolen.name,
        focus,
        value: hud.calling?.id === 'luminary' ? txt('hud.hints.yourRadianceCountsOne') : '',
      }),
    });
  if (boss?.mirrorWard?.casting)
    out.push({
      id: 'mirror-ward',
      text: txt('hud.hints.theUnweaverWardsIts', { focus }),
    });
  const copy = rift?.mimicCopy;
  if (copy)
    out.push({
      id: 'mimic',
      text:
        copy === 'empower'
          ? txt('hud.hints.aMimicIsCopying3', { RMB: modeKey() })
          : copy === 'ward'
            ? txt('hud.hints.aMimicIsCopying', { E, focus })
            : txt('hud.hints.aMimicIsCopying2', { Q, focus }),
    });
  return out;
}

/**
 * The Finale's three lessons (docs/phase-5d.md "Hints"): a Cued Solo feeds the Conductor's
 * Discord; Fortissimo Silence is cancelled by the Crescendo; the Grand Silence hears only the
 * Weaver's notes (Calling- and variant-aware). Each keys on a BossHud key only the Finale sets.
 */
function finaleHints(hud: HudSnapshot): Hint[] {
  const boss = hud.boss;
  if (!boss || (!boss.discord && !boss.cue && !boss.fortissimo && !boss.silence)) return [];
  const out: Hint[] = [];
  const w = hud.weaver;
  const crescendo = `{${bindingLabel('crescendo')}}`;
  if (boss.silence) {
    const reel = variantIn(hud, 'reel');
    out.push({
      id: 'silence',
      text: txt('hud.hints.theGrandSilenceOnly', {
        noteSources: noteSources({ rewinds: !!w.rewind, reel }),
      }),
    });
  }
  if (boss.fortissimo || (boss.discord && boss.discord.value >= boss.discord.max * 0.75))
    out.push({
      id: 'fortissimo',
      text:
        boss.fortissimo && w.resonance >= w.crescendoCost
          ? txt('hud.hints.yourCrescendoCancelsIt', {
              FORTISSIMO_NAME: fortissimoName(),
              crescendo,
            })
          : txt('hud.hints.holdResonanceYourCrescendo', {
              FORTISSIMO_NAME: fortissimoName(),
              crescendoCost: w.crescendoCost,
              crescendo,
            }),
    });
  if (boss.cue)
    out.push({
      id: 'discord',
      text: txt('hud.hints.everySoloYouLet', { bindingLabel: bindingLabel('directiveFocus') }),
    });
  return out;
}

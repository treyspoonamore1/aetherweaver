import { CONTENT } from '../../content';
import type { Action } from '../../input/actions';
import type { HeroHud, HudSnapshot } from '../store';
import { keyLabel } from '../../input/keyLabel';
import { fmt } from '../kit/format';
import { ANSWER, bindingCode, bindingLabel } from './labels';
import { mult } from '../screens/chordModel';
import { beamSong } from './songs';
import { stasisCostMult } from './calling';
import { secondsLabel } from './chrono';
import { healBarelyTakes } from './legionLook';
import { DOOM_EMPHASIS, doomCount, spindleCutPct } from './riftLook';
import { FORTISSIMO_NAME, noteSources } from './finaleLook';
import { outOfReach } from './duelLook';
import { saplingsOutside } from './groveLook';
import { heroPronouns } from '../screens/rosterModel';
import { linkName } from '../screens/callingText';

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
        text: `Fermata holds ${h.name} at 1 life — one touch of the Thread saves ${him}, even halved: ${h.threaded ? `keep Mending ${him}` : `Thread ${him} {${h.slot + 1}}`}`,
      });
    }
    out.push({
      id: 'hold',
      text: h.threaded
        ? `Fermata is holding ${h.name} at 1 life — keep Mending them, or Chime ${E} on them, before it ends`
        : `Fermata is holding ${h.name} at 1 life — Thread them {${h.slot + 1}} or Chime ${E} on them before it ends`,
    });
  }
  // The Chronomancer (Phase 3e): Rewind is in Reel's slot. F Rewinds the hovered hero, else
  // the threaded one, so a hero who isn't its target is threaded first.
  const rewind = w.rewind?.ready ? w.rewind : null;
  const toRewind = (h: HeroHud) =>
    h.rewind?.target ? F : `{${bindingLabel(`focus${h.slot + 1}` as Action)}}, then ${F}`;
  if (rewind) {
    for (const h of party.filter((p) => p.rewind?.kind === 'revive' && p.rewind.inRange)) {
      out.push({
        id: 'rewind-up',
        text: `${h.name} just went down — press ${toRewind(h)}: Rewind stands them back up, once a run (${secondsLabel(h.rewind!.left)} left)`,
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
          ? `${h.name} is calling for a Ward — press ${Q} on them before the ring runs out for ${call.flourish}`
          : call.answer === 'chime'
            ? `${h.name} is calling for a Chime — press ${E} on them before the ring runs out for ${call.flourish}`
            : `${h.name} is calling for Empower — Thread them {${h.slot + 1}} in Empower {RMB} before the ring runs out for ${call.flourish}`,
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
          text: `A lethal hit is coming at ${h.name} — ${wardIt} just before it lands for a Perfect`,
        });
      } else if (w.rewind) {
        // Rewind only helps if where they stood is out of it (or Paradox undoes it).
        if (rewind && h.rewind?.escape && h.rewind.inRange)
          out.push({
            id: 'lethal-rewind',
            text:
              h.rewind.escape === 'undo'
                ? `A lethal hit is coming at ${h.name} — Rewind ${toRewind(h)}: Paradox undoes it`
                : `${h.name} is in a lethal zone — Rewind ${toRewind(h)} takes them back out of it`,
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
        text: `A big hit is coming at ${h.name} — ${wardIt} just before it lands for a Perfect`,
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
            ? `${h.name} is marked — press ${E} (${variantName(chime)}) to cleanse it`
            : `${h.name} is marked — press ${E} to Chime it away`
          : `${h.name} is marked — a Ward ${Q} can still soak the blast`,
      });
    }
  }
  out.push(...movementTwoHints(hud, { Q, E, F }));
  out.push(...movementThreeHints(hud, { Q, E, F }));
  out.push(...finaleHints(hud));
  for (const h of party.filter((p) => p.downed && !p.dead)) {
    out.push({
      id: 'downed',
      text: `${h.name} is down — Thread them {${h.slot + 1}} and let Mend revive them before they bleed out`,
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
          text: `${h.name} took a big blow — Rewind ${toRewind(h)} gives back ${fmt(r.amount)}: their life and place from ${rewind.seconds} s ago`,
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
        text: `${B} Bear — take part of the big hit coming at ${threaded.name} on yourself`,
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
        text: `Bearing stops your ${w.lastMode === 'mend' ? 'Mend' : 'Empower'} on ${threaded.name} — press ${B} again to go back`,
      });
    }
  }
  if (w.vow && w.bearShare > 0) {
    out.push({
      id: 'vow',
      text: `${w.crescendoName}: your heroes can’t fall below 1 life — what gets past them comes to you, softened`,
    });
  }
  if (w.stasis) {
    const less = Math.round((1 - stasisCostMult(hud.calling?.id)) * 100);
    out.push({
      id: 'stasis',
      text: `${w.crescendoName}: every enemy waits — your techniques have no cooldowns${less > 0 ? ` and cost ${less}% less` : ''} while it lasts. Ward ${Q}, Chime ${E} and Rewind ${F} freely`,
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
        text: `${h.name} is hurt — click their frame or press {${h.slot + 1}} to Thread them`,
      });
    } else if (
      w.threadMode === 'empower' ||
      (w.threadMode === 'bear' && w.lastMode === 'empower')
    ) {
      out.push({
        id: 'hurt-mode',
        text:
          w.threadMode === 'bear'
            ? `${h.name} is hurt — press {RMB} twice${bearKey ? ` (or ${B}, then {RMB})` : ''} to get back to Mend`
            : `${h.name} is hurt — press {RMB} to switch the Thread back to Mend`,
      });
    }
  }
  if (w.fieldSuppressed) {
    out.push({
      id: 'silenced',
      // The hymn circles are the Hollow Cantor's: only while they stand do they help.
      text:
        (hud.hymnCircles ?? 0) > 0
          ? `Your auras are silenced — bring the party into a hymn circle with Rally {${bindingLabel('directiveRally')}}`
          : `Your auras are silenced — mark the ${silencerName(hud)} with {${bindingLabel('directiveFocus')}} so the party breaks its dome`,
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
        ? `${reelTarget.name} is outside your field — move closer so your auras reach them`
        : `${reelTarget.name} is outside your field — move closer so your auras reach them, or Reel ${F} them in`,
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
          ? `Your beam song pours into whoever you thread: ${mult(beam.focus)} on ${focused.name}. Everyone else near you hears an echo`
          : `Your beam song pours into whoever you thread: ${mult(beam.focus)} on ${focused.name}, and nobody else`,
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
        ? `${cueHero.name}'s ${cueHero.soloName} is ready — press {⇧${cueHero.slot + 1}} now to Cue the stronger form, or it fires on its own`
        : `${cueHero.name}'s ${cueHero.soloName} is ready — press {⇧${cueHero.slot + 1}} to Cue it (costs ${w.cueCost === w.segment ? 'one Resonance segment' : `${w.cueCost} Resonance`})`,
    });
  }
  if (w.resonance >= w.crescendoCost && w.crescendo <= 0 && !hud.conducting) {
    out.push({
      id: 'crescendo',
      text: `Resonance is full — press {${bindingLabel('crescendo')}} for ${w.crescendoName}`,
    });
  }
  // Foresight: the first time it shows an attack on its way to someone.
  const seen = party.find((h) => alive(h) && h.foreseen.some((f) => f.aimed));
  if (seen) {
    const f = seen.foreseen.find((x) => x.aimed)!;
    out.push({
      id: 'foresight',
      text: `Foresight: ${f.name} is coming for ${seen.name} (${f.in < 0.05 ? 'any moment' : `in ${secondsLabel(f.in)}`}) — be ready before it begins`,
    });
  }
  if (hud.boss?.cast && hud.boss.cast.answers.length > 0) {
    const names = hud.boss.cast.answers
      .map((a) => (a === 'reel' && w.rewind ? 'Rewind' : ANSWER[a].label))
      .join(' or ');
    out.push({
      id: 'boss-cast',
      text: `${hud.boss.cast.name} is coming — answer it with ${names}`,
    });
  }
  // Pedal Point: the planted field only helps where the fight is.
  if (w.plant && w.plant.remaining <= 0.05 && party.filter(alive).some((h) => !h.inField)) {
    const V = `{${w.plant.key0 ? keyLabel(w.plant.key0) : bindingLabel('plant')}}`;
    out.push({
      id: 'plant',
      text: `Your Pedal Point field stays where you plant it — press ${V} to plant it under the fight`,
    });
  }
  // The Directive wheel: when the party is spread out, or once the fight has settled.
  const strays = party.filter((h) => alive(h) && !h.inField).length;
  if (hud.directive === null && (strays >= 2 || hud.encounter.elapsed > 45)) {
    out.push({
      id: 'wheel',
      text:
        strays >= 2
          ? `Your party is spread out — hold {${bindingLabel('directiveWheel')}} and flick toward Rally to call them to you`
          : `Hold {${bindingLabel('directiveWheel')}} (or the middle mouse button) for the Directive wheel: Focus, Rally, Hold, Scatter`,
    });
  }
  if (w.threadSlot === null && hud.encounter.elapsed > 3 && party.some(alive)) {
    out.push({
      id: 'thread',
      text: `Click a party frame or press {1} to attach your Thread — Mend heals, Empower hits harder`,
    });
  }
  // The Chronomancer's first fights: introduce Rewind once the Thread is on someone.
  if (w.rewind && w.threadSlot !== null && hud.encounter.elapsed > 6) {
    out.push({
      id: 'rewind-intro',
      text: `${F}: Rewind — your threaded hero goes back ${w.rewind.seconds} s: where they stood and the life they had. Once a run, it stands up a hero who just fell. It replaces Reel`,
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
      text: bearKey
        ? `${B}: Bear — take part of a big hit on your threaded hero. Your songs hold your Life, not your Spirit`
        : 'Bear has no key — bind one in Settings → Controls to take part of a big hit on your threaded hero',
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
      text: `Everyone is healthy — press {RMB} to switch the Thread to Empower and add damage`,
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
      text: `Cue another within ${Number(c.chain.total.toFixed(1))} s for a ${linkName(chained.cue!.link)}: ${chained.name}, {⇧${chained.slot + 1}}`,
    });
  if (c.beat && ready.length > 0)
    out.push({
      id: 'beat',
      text:
        c.beat.downbeatCost > 0
          ? `Cue on the downbeat: it costs only ${c.beat.downbeatCost} Resonance. The light under your Resonance shows the beat`
          : `Cue on the downbeat: it’s free. The light under your Resonance shows the beat`,
    });
  if (c.finale === null && w.crescendo <= 0 && w.resonance + 1e-9 >= w.crescendoCost)
    out.push({
      id: 'finale',
      text: `${w.crescendoName} {${bindingLabel('crescendo')}} plays every Solo, rising, then fills them all`,
    });
  return out;
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
  if (variant) return `${name} is in a lethal zone — ${variantName(variant)} ${F} on them`;
  return `${name} is in a lethal zone — Reel them out ${F}`;
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
        ? `${boss.executeTarget} is condemned — Ward ${Q} ${heroPronouns(condemned!.defId).obj}: your healing barely takes on ${heroPronouns(condemned!.defId).obj}`
        : `${boss.executeTarget} is condemned — lift them above ${pct}% before it lands, or Ward ${Q} them`,
    });
  }
  for (const h of up) {
    const bleed = stacksOf(h, 'bleed');
    if (bleed >= BLEED_CHIME_AT)
      out.push({
        id: 'bleed',
        text: `${h.name} is bleeding ×${bleed} — Chime ${E} on them to cleanse every stack`,
      });
  }
  for (const h of up.filter((p) => p.statuses.some((s) => s.id === 'pinned')))
    out.push({
      id: 'pinned',
      text: hud.weaver.rewind
        ? `${h.name} is pinned — a Ward ${Q} soaks what the pin deals`
        : `${h.name} is pinned — Reel ${F} frees them`,
    });
  for (const h of up.filter((p) => p.statuses.some((s) => s.id === 'latched')))
    out.push({
      id: 'latched',
      // On a Chronomancer run Reel's key casts Rewind, which frees no one: Chime does.
      text: hud.weaver.rewind
        ? `A Leech has latched onto ${h.name} — Chime ${E} frees them`
        : `A Leech has latched onto ${h.name} — Reel ${F} or Chime ${E} frees them`,
    });
  const pact = up.filter((p) => p.statuses.some((s) => s.id === 'pact'));
  if (pact.length > 0)
    out.push({
      id: 'pact',
      text: `${pact.map((h) => h.name).join(' and ')} ${pact.length > 1 ? 'share' : 'carries'} a Blood Pact — Scatter {${bindingLabel('directiveScatter')}}: Chime can’t break it`,
    });
  for (const h of up.filter((p) => p.statuses.some((s) => s.id === 'wound')))
    out.push({
      id: 'wound',
      text: `${h.name} is Wounded: healing on them is halved — Chime ${E} before you Mend`,
    });
  // Keyed on the Sentinel blocking a blow (the sim's `guardBlocked`, via the HUD bridge), while
  // nothing is focused.
  if (hud.guardBlocked && hud.focusTarget === null)
    out.push({
      id: 'guard',
      text: `A Crimson Sentinel’s shield blocks most of a blow from the front — Focus it {${bindingLabel('directiveFocus')}} so the party flanks`,
    });
  if (boss?.bloodmoon)
    out.push({
      id: 'bloodmoon',
      text: `Bloodmoon: healing is halved outside the pools — stand in one and Rally {${bindingLabel('directiveRally')}} the party to you${hud.weaver.rewind ? '' : `. Reel ${F} frees a pinned hero into your pool`}`,
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
          ? `Bloodlust: ${h.name} won’t Rally below ${bloodlustPct(h.defId)}% — ${mawRescue(hud, F, 'him')}`
          : `Bloodlust: ${h.name} won’t Rally below ${bloodlustPct(h.defId)}% — Ward ${Q} ${him}${h.talents.includes('iron_will') ? ` (Iron Will brings ${him} back)` : ''}${hud.weaver.rewind ? '' : ` or Reel ${F} ${him}`}`,
      });
    if (h.hp < h.maxHp * 0.5)
      out.push({
        id: 'brannLow',
        text: `${h.name} fights harder hurt — Ward ${Q} ${him}, don’t Mend ${him}`,
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
          text: `Swap puts you in her duel; Rally ${C} brings her home`,
        });
      else
        out.push({
          id: 'serenOver',
          text: hud.weaver.rewind
            ? `${h.name} is surrounded — Rally ${C}: she always comes. Rewind only takes her back as the pack closes`
            : reel === 'anchor'
              ? `${h.name} is surrounded — Rally ${C}: she always comes, and your Anchor holds while she does`
              : `${h.name} is surrounded — Reel ${F} her home, or Rally ${C}: she always comes`,
        });
    }
    if (outOfReach(h))
      out.push({
        id: 'serenReach',
        text: `${h.name} is beyond your reach — Glide ${G} toward her so your Ward and Reel reach her`,
      });
    if (d.quarryName)
      out.push({
        id: 'serenDuel',
        text: `${h.name} duels alone: Ward ${Q} her before the blow lands, Reel ${F} or Rally ${C} when they surround her`,
      });
    if (d.armed && !d.waltz)
      out.push({ id: 'serenKillShot', text: `A Perfect Ward ${Q} on ${h.name} is a kill shot` });
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
        text: `${h.name}’s Saplings are outside your songs: walk back, or Rally ${C} to re-plant them`,
      });
    if (h.grove!.tending && hud.encounter.elapsed > 6 && hud.encounter.enemies > 0)
      out.push({
        id: 'oroGentle',
        text: `${h.name} won’t fight without a Focus {${bindingLabel('directiveFocus')}}`,
      });
    if (hud.boss) out.push({ id: 'oroBoss', text: 'Bosses and the biggest foes ignore Saplings' });
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
    return who === 'one' ? `Rewind ${F} one it drags in` : `Rewind ${F} him back once it drags him`;
  const reel = variantIn(hud, 'reel');
  if (reel === 'anchor') return `Anchor ${F} ${who} before it drags ${them} in`;
  if (reel === 'swap')
    return `Hold {${bindingLabel('directiveHold')}} so ${who === 'one' ? 'they stay' : 'he stays'} outside it`;
  return `Reel ${F} ${who} out`;
}

/**
 * Whom the 'silenced' hint marks: a Silencing elite (Movement III's affix) when one stands and no
 * Mute does; the Mute otherwise, as it always read (a downed Weaver silences in every Movement).
 */
function silencerName(hud: HudSnapshot): string {
  return hud.rift?.silencer && !hud.foes?.includes('mute') ? 'Silencing elite' : 'Mute';
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
      text: `You stand in a Null rune: Ward, Chime and ${w.rewind ? 'Rewind' : 'Reel'} are refused — Glide {${bindingLabel('glide')}} or walk out of it`,
    });
  if (rift?.cutComing && w.threadSlot !== null)
    out.push({
      id: 'cut-coming',
      text: `${rift.cutComing.name} will cut your Thread — Thread a hero on your side of the line, or step across it`,
    });
  if (w.threadCut)
    out.push({
      id: 'cut',
      text: `Your Thread was cut — re-thread {1}–{3} the moment the lock ends (${secondsLabel(w.threadLock)})`,
    });
  if (rift?.inhale) {
    // A bloodlusting Brann refuses the Rally (docs/phase-5c.md, Void Maw): name what he obeys.
    const lust = up.find((h) => h.blood?.bloodlust);
    const brann = lust
      ? `. ${lust.name} won’t Rally below ${bloodlustPct(lust.defId)}% — ${mawRescue(hud, F, 'him')}`
      : '';
    out.push({
      id: 'inhale',
      text:
        !w.rewind && variantIn(hud, 'reel') === 'swap'
          ? `A Void Maw breathes in — Rally ${rally} the party to you: Swap puts you in the Maw${brann}`
          : `A Void Maw breathes in — Rally ${rally} the party to you before the pull, or ${mawRescue(hud, F, 'one')}${brann}`,
    });
  }
  // The Wraith's cast (`rift.wraithCasting`) names the hero its doubt mark is on; the hint goes the
  // moment the cast is interrupted, even while an orphaned mark lingers its last half second.
  let wraithNamed = false;
  for (const h of up) {
    if (h.possessed)
      out.push({
        id: 'possessed',
        text: `${h.name} is possessed${h.possessed.victim ? ` and strikes ${h.possessed.victim}` : ''} — Chime ${E} on them frees them`,
      });
    if (rift?.wraithCasting && !wraithNamed && h.statuses.some((s) => s.id === 'doubt')) {
      wraithNamed = true;
      out.push({
        id: 'wraith',
        text: `A Doubt Wraith reaches for ${h.name} — Focus it ${focus} to interrupt the cast, or Chime ${E} the mark`,
      });
    }
  }
  if (rift?.wraithCasting && !wraithNamed)
    out.push({
      id: 'wraith',
      text: `A Doubt Wraith is casting — Focus it ${focus} to interrupt the cast`,
    });
  for (const h of up) {
    const doom = stacksOf(h, 'doom');
    const doomed = h.statuses.some((s) => s.id === 'doomed');
    if (doomed || doom >= DOOM_EMPHASIS)
      out.push({
        id: 'doom',
        text: doomed
          ? `Doom ignites on ${h.name} — Chime ${E} it, or Ward ${Q} the blast`
          : `${h.name} carries Doom ${doomCount(doom)} — Chime ${E} before it ignites, or Ward ${Q} the blast`,
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
          ? `${stitched.map((h) => h.name).join(' and ')} are stitched to the floor — a Chime ${E} frees each one it reaches${w.rewind ? '' : `, a Reel ${F} the one it pulls`}`
          : `${stitched[0]!.name} is stitched to the floor — Chime ${E} on them frees them${w.rewind ? '' : `, or Reel ${F} them free`}`,
    });
  if ((w.unravelLeft ?? 0) > 0 && w.threadMode === 'mend')
    out.push({
      id: 'unravel',
      text:
        w.bearShare > 0 && bindingCode('bear')
          ? `Unravel: your Mend wounds — press {RMB} for Empower, or Bear {${bindingLabel('bear')}}, until it passes`
          : `Unravel: your Mend wounds — press {RMB} for Empower until it passes`,
    });
  if (boss?.spindles)
    out.push({
      id: 'spindles',
      text: `Spindles shield the boss: −${spindleCutPct()}% damage while one stands — Focus them ${focus}`,
    });
  if (boss?.stolen)
    out.push({
      id: 'verse',
      text: `${boss.stolen.name} was stolen — Focus the Stolen Verse ${focus} to take it back${hud.calling?.id === 'luminary' ? ': your Radiance counts one aura fewer until then' : ''}`,
    });
  if (boss?.mirrorWard?.casting)
    out.push({
      id: 'mirror-ward',
      text: `The Unweaver Wards its champion — interrupt the Mirror Ward, and Focus the champion ${focus}`,
    });
  const copy = rift?.mimicCopy;
  if (copy)
    out.push({
      id: 'mimic',
      text:
        copy === 'empower'
          ? `A Mimic is copying your Empower — switch the Thread to Mend {RMB} to crack the mirror`
          : copy === 'ward'
            ? `A Mimic is copying your Ward — cast a Chime ${E} instead to crack the mirror, or Focus it ${focus}`
            : `A Mimic is copying your Chime — cast a Ward ${Q} instead to crack the mirror, or Focus it ${focus}`,
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
      text: `The Grand Silence: only your ${noteSources({ rewinds: !!w.rewind, reel })} are heard. Eight notes bring your heroes back — even the fallen`,
    });
  }
  if (boss.fortissimo || (boss.discord && boss.discord.value >= boss.discord.max * 0.75))
    out.push({
      id: 'fortissimo',
      text:
        boss.fortissimo && w.resonance >= w.crescendoCost
          ? `${FORTISSIMO_NAME} — your Crescendo ${crescendo} cancels it: press it now`
          : `${FORTISSIMO_NAME}: hold ${w.crescendoCost} Resonance — your Crescendo ${crescendo} cancels it`,
    });
  if (boss.cue)
    out.push({
      id: 'discord',
      text: `Every Solo you let through feeds the Conductor’s Discord: answer it, or interrupt the soloist (Focus {${bindingLabel('directiveFocus')}})`,
    });
  return out;
}

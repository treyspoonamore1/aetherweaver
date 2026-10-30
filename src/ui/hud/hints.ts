import type { Action } from '../../input/actions';
import type { HeroHud, HudSnapshot } from '../store';
import { keyLabel } from '../../input/keyLabel';
import { fmt } from '../kit/format';
import { ANSWER, bindingCode, bindingLabel } from './labels';
import { mult } from '../screens/chordModel';
import { beamSong } from './songs';
import { stasisCostMult } from './calling';
import { secondsLabel } from './chrono';

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
  return !!t && t.remaining <= 0.05 && t.affordable && !hud.weaver.downed;
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
]);

/** All hints that apply right now, most important first. */
export function evaluateHints(hud: HudSnapshot): Hint[] {
  const all = allHints(hud);
  return hud.dissonance?.blindScore ? all.filter((h) => !ANSWER_HINTS.has(h.id)) : all;
}

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

  for (const h of party.filter(alive)) {
    if (h.lethal) {
      if (techReady(hud, 'ward')) {
        out.push({
          id: 'lethal-ward',
          text: `A lethal hit is coming at ${h.name} — Ward ${Q} just before it lands for a Perfect`,
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
        out.push({ id: 'lethal-reel', text: `${h.name} is in a lethal zone — Reel them out ${F}` });
      }
    }
  }
  for (const h of party.filter(alive)) {
    if (!h.lethal && h.incoming >= h.maxHp * 0.3 && techReady(hud, 'ward')) {
      out.push({
        id: 'big-hit',
        text: `A big hit is coming at ${h.name} — Ward ${Q} just before it lands for a Perfect`,
      });
    }
  }
  for (const h of party.filter(alive)) {
    if (h.statuses.some((s) => s.id === 'dirge')) {
      out.push({
        id: 'marked',
        text: techReady(hud, 'chime')
          ? `${h.name} is marked — press ${E} to Chime it away`
          : `${h.name} is marked — a Ward ${Q} can still soak the blast`,
      });
    }
  }
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
  const hurt = party.filter((h) => alive(h) && h.hp < h.maxHp * 0.5);
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
      text: hud.boss
        ? `Your auras are silenced — bring the party into a hymn circle with Rally {${bindingLabel('directiveRally')}}`
        : `Your auras are silenced — mark the Mute with {${bindingLabel('directiveFocus')}} so the party breaks its dome`,
    });
  }
  const reelTarget = party.find((h) => alive(h) && !h.inField && h.distance > w.fieldRadius + 3);
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
  // What a Cue costs is the fight's (Silent Cues, Phase 4d, raises it past a segment).
  const cueHero = party.find((h) => h.soloReady && alive(h));
  if (cueHero && w.resonance + 1e-9 >= w.cueCost) {
    out.push({
      id: 'cue',
      text: `${cueHero.name}'s ${cueHero.soloName} is ready — press {⇧${cueHero.slot + 1}} to Cue it (costs ${w.cueCost === w.segment ? 'one Resonance segment' : `${w.cueCost} Resonance`})`,
    });
  }
  if (w.resonance >= w.crescendoCost && w.crescendo <= 0) {
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
  if (
    w.threadMode === 'mend' &&
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

/** Splits `text {Q} more` into plain and key parts. */
export function splitHint(text: string): { key: boolean; text: string }[] {
  return text
    .split(/(\{[^}]+\})/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('{') ? { key: true, text: part.slice(1, -1) } : { key: false, text: part },
    );
}

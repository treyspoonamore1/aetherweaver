/**
 * The Weaver's work split three ways: what the auras did, what the Thread did (Mend's healing,
 * Empower's damage), and everything else (Wards, Perfect Wards, Chimes, Flourishes…). Shared by
 * the HUD's live readout and the Result / Summary screens. Pure.
 */
import { fmt } from './kit/format';

export interface ContributionParts {
  auras: { healing: number; shielded: number; amplified: number };
  thread: { healing: number; amplified: number };
  /** Everything the Weaver did: healing + shielded + negated + amplified. */
  total: number;
}

export interface ContributionSplit {
  auras: number;
  thread: number;
  /** Wards, Perfect Wards, Flourishes and the rest (never negative). */
  other: number;
  total: number;
  /** 0..1 shares of `total` (0 when nothing has happened yet). */
  auraShare: number;
  threadShare: number;
  otherShare: number;
}

export function splitContribution(c: ContributionParts): ContributionSplit {
  const auras = Math.max(0, c.auras.healing + c.auras.shielded + c.auras.amplified);
  const thread = Math.max(0, c.thread.healing + c.thread.amplified);
  const total = Math.max(c.total, auras + thread);
  const other = Math.max(0, total - auras - thread);
  const share = (v: number) => (total > 0 ? v / total : 0);
  return {
    auras,
    thread,
    other,
    total,
    auraShare: share(auras),
    threadShare: share(thread),
    otherShare: share(other),
  };
}

/** HUD-sized numbers: 840, 5.0k, 12k, 1.2M. */
export function compact(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v < 1000) return String(v);
  if (v < 10_000) return `${(v / 1000).toFixed(1)}k`;
  if (v < 1_000_000) return `${Math.round(v / 1000)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

/** "healed 1,840, shielded 960 and added 2,210 damage" (zero parts left out; null if all zero). */
export function auraVerbs(a: ContributionParts['auras']): string | null {
  const parts = [
    a.healing >= 1 && `healed ${fmt(a.healing)}`,
    a.shielded >= 1 && `shielded ${fmt(a.shielded)}`,
    a.amplified >= 1 && `added ${fmt(a.amplified)} damage`,
  ].filter((p): p is string => !!p);
  return parts.length === 0 ? null : joinAnd(parts);
}

/** "a, b and c". */
export function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

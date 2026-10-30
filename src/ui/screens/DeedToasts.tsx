import { useEffect, useState } from 'react';
import { useProfile } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import { playUi } from '../kit/sound';
import { useUi } from '../store';
import { DeedToastCard, TOAST_PLACE } from './DeedsParts';
import { bondCardShows } from './bondsModel';
import {
  TOAST_GAP_MS,
  TOAST_LEAD_MS,
  TOAST_MS,
  TOAST_OUT_MS,
  toastStep,
  toastsBlocked,
  type DeedToast,
} from './deedsModel';

interface Showing {
  toast: DeedToast;
  index: number;
  total: number;
}

/**
 * The Deed toasts (Phase 4b), over whatever screen the player is on: one per Deed in the profile
 * store's `deedNotices`, one after another, each with its sound (`deedStar` for a point, `deed`
 * for a badge) as it appears; then `dismissDeeds` with the ids shown. They wait while something
 * else holds the moment: a rank-up card, the Weaver's or a Bond's (its own sounds and a button to
 * press), or a fight (the Training Grounds, or a run's combat); a toast put away mid-way comes
 * back afterwards.
 */
export function DeedToasts() {
  const notices = useProfile((s) => s.deedNotices);
  const rankUps = useProfile((s) => s.rankUps.length);
  const bondNotices = useProfile((s) => s.bondNotices.length);
  const screen = useUi((s) => s.screen);
  const phase = useRun((s) => s.run?.phase ?? null);
  // Phase 4e: the Bond rank-up card holds the moment too, while it's up.
  const bondCard = bondCardShows({ notices: bondNotices, rankUps, screen, phase });
  const blocked = toastsBlocked({ rankUps: rankUps + (bondCard ? 1 : 0), screen, phase });
  // The notices shown since there were none waiting.
  const [shown, setShown] = useState<readonly string[]>([]);
  const [showing, setShowing] = useState<Showing | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Something else holds the moment: put the toast away (it isn't counted as shown).
  useEffect(() => {
    if (!blocked) return;
    setShowing(null);
    setLeaving(false);
  }, [blocked]);

  // Nothing waiting (all dismissed, or Reset progress): start over.
  useEffect(() => {
    if (notices.length > 0) return;
    setShown([]);
    setShowing(null);
    setLeaving(false);
  }, [notices.length]);

  // Nothing on screen: the next toast after a pause, or done.
  useEffect(() => {
    if (showing) return;
    const step = toastStep(notices, shown, blocked);
    if (step.kind === 'wait') return;
    if (step.kind === 'done') {
      useProfile.getState().dismissDeeds(step.dismiss);
      return;
    }
    const t = setTimeout(
      () => {
        setShowing({ toast: step.toast, index: step.index, total: step.total });
        playUi(step.toast.sound);
      },
      shown.length === 0 ? TOAST_LEAD_MS : TOAST_GAP_MS,
    );
    return () => clearTimeout(t);
  }, [showing, notices, shown, blocked]);

  // A toast stays, fades, and counts as shown.
  useEffect(() => {
    if (!showing) return;
    const id = showing.toast.id;
    const out = setTimeout(() => setLeaving(true), TOAST_MS - TOAST_OUT_MS);
    const end = setTimeout(() => {
      setShowing(null);
      setLeaving(false);
      setShown((ids) => (ids.includes(id) ? ids : [...ids, id]));
    }, TOAST_MS);
    return () => {
      clearTimeout(out);
      clearTimeout(end);
    };
  }, [showing]);

  return (
    <div className={TOAST_PLACE} role="status" aria-live="polite" data-testid="deed-toasts">
      {showing && (
        <DeedToastCard
          key={`${showing.index}-${showing.toast.id}`}
          toast={showing.toast}
          index={showing.index}
          total={showing.total}
          leaving={leaving}
        />
      )}
    </div>
  );
}

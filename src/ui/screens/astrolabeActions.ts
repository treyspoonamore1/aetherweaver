/**
 * The Astrolabe's moves through the profile store (app/profileStore.ts): what the screen calls
 * and the tests drive. Each reads the store first, so the screen and the store can't disagree
 * about what a click did.
 */
import { useProfile } from '../../app/profileStore';
import { previewStar, type StarPreview } from './astrolabeModel';

/** Takes a star and the path to it, if the points allow. Returns the stars taken (in order). */
export function takeStar(id: string): { took: string[]; preview: StarPreview } {
  const store = useProfile.getState();
  const before = store.profile.astrolabe;
  const preview = previewStar(before, store.astrolabePoints(), id);
  if (preview.action === 'take') store.takeNode(id);
  const after = useProfile.getState().profile.astrolabe;
  return { took: after.length > before.length ? after.slice(before.length) : [], preview };
}

/** Gives a star back, if nothing taken hangs on it. */
export function giveBackStar(id: string): { gave: boolean; preview: StarPreview } {
  const store = useProfile.getState();
  const before = store.profile.astrolabe;
  const preview = previewStar(before, store.astrolabePoints(), id);
  if (preview.action === 'mine') store.giveBack(id);
  return { gave: useProfile.getState().profile.astrolabe.length < before.length, preview };
}

/** Gives every star back. Returns how many points came back. */
export function respecStars(): number {
  const n = useProfile.getState().profile.astrolabe.length;
  useProfile.getState().respecTree();
  return n - useProfile.getState().profile.astrolabe.length;
}

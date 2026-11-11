import { Suspense, lazy } from 'react';

/**
 * Dev-only showcase pages, one per workstream (`?lab=vfx|ui|audio`). Each lab renders its
 * area against synthetic state/events so it can be developed and reviewed in isolation. The
 * bench (`?lab=bench`, docs/phase-7.md W4) plays fixed fights and reads their performance.
 */
const VfxLab = lazy(() => import('../render/lab/VfxLab').then((m) => ({ default: m.VfxLab })));
const UiLab = lazy(() => import('../ui/lab/UiLab').then((m) => ({ default: m.UiLab })));
const AudioLab = lazy(() => import('../audio/lab/AudioLab').then((m) => ({ default: m.AudioLab })));
const BenchPage = lazy(() => import('../debug/BenchPage').then((m) => ({ default: m.BenchPage })));

export function LabRouter({ lab }: { lab: string }) {
  return (
    <Suspense fallback={<p className="p-6 text-muted">Loading lab…</p>}>
      {lab === 'vfx' ? (
        <VfxLab />
      ) : lab === 'ui' ? (
        <UiLab />
      ) : lab === 'audio' ? (
        <AudioLab />
      ) : lab === 'bench' ? (
        <BenchPage />
      ) : (
        <Unknown lab={lab} />
      )}
    </Suspense>
  );
}

function Unknown({ lab }: { lab: string }) {
  return (
    <main className="p-6">
      <p className="font-display text-gold-300">Unknown lab “{lab}”.</p>
      <p className="mt-2 text-sm text-muted">Try ?lab=vfx, ?lab=ui, ?lab=audio or ?lab=bench.</p>
    </main>
  );
}

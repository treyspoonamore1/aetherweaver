import { t } from '../text';

/** The line a screen shows while its code loads (`src/app/App.tsx`'s Suspense fallback). */
export function weavingLine(): string {
  return t('common.loading.weaving');
}

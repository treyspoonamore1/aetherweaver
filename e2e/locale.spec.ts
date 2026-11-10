import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 7 W3a: the pseudo-locale in the UI lab (docs/phase-7.md, *W3a*). The lab's switch turns
 * every converted string to en-XA and back; every lab view renders in en-XA with no error. For
 * each view the run screenshots the stage, and lists text that clips (an element whose content
 * is larger than a box that hides overflow) and text that stayed plain English (it skipped the
 * text layer, or is a name or number passed in). With `W3A_SHOTS` set, the screenshots and the
 * list go there; otherwise into the test's output folder (`W3A_KEEP` keeps screenshots already
 * there; `W3A_VIEWS` names the views to visit).
 */

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

const PSEUDO = /[áƀçðéƒĝĥíĵķļɱñóþǫŕšţúṽŵẋýžÁƁÇÐÉƑĜĤÍĴĶĻṀÑÓÞǪŔŠŢÚṼŴẊÝŽ]/;

test('the UI lab switches the locale to en-XA and back', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?lab=ui&view=hud-calm');
  await expect(page.getByTestId('lab-stage')).toBeVisible();
  const stage = page.getByTestId('lab-stage');
  await expect(stage).not.toContainText('[');
  await page.getByTestId('lab-locale-en-XA').click();
  await expect(page.getByTestId('lab-locale-en-XA')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => PSEUDO.test((await stage.textContent()) ?? '')).toBe(true);
  expect(page.url()).toContain('locale=en-XA');
  await page.getByTestId('lab-locale-en').click();
  await expect.poll(async () => PSEUDO.test((await stage.textContent()) ?? '')).toBe(false);
  expect(page.url()).not.toContain('locale=');
  expect(errors).toEqual([]);
});

test('every UI lab view renders in en-XA', async ({ page }, info) => {
  test.setTimeout(90 * 60_000);
  const out = process.env.W3A_SHOTS ?? info.outputPath('shots');
  const errors = trackErrors(page);
  await page.goto('/?lab=ui');
  await expect(page.locator('nav [data-view]').first()).toBeVisible();
  const ids = await page
    .locator('nav [data-view]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-view')!));
  expect(ids.length).toBeGreaterThan(100);
  const only = process.env.W3A_VIEWS?.split(',');
  const report: Record<string, { clipped: string[]; overflow: string[]; plain: string[] }> = {};
  for (const id of only ?? ids) {
    const before = errors.length;
    await page.goto(`/?lab=ui&view=${id}&nav=0&fit=0&locale=en-XA`);
    const stage = page.getByTestId('lab-stage');
    await expect(stage).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(400);
    const found = await stage.evaluate((root, pseudoSrc) => {
      const pseudo = new RegExp(pseudoSrc);
      const clipped: string[] = [];
      const overflow: string[] = [];
      const plain = new Set<string>();
      const ownText = (el: Element) =>
        [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent ?? '')
          .join('')
          .trim();
      for (const el of root.querySelectorAll('*')) {
        const text = ownText(el);
        if (!text) continue;
        const cs = getComputedStyle(el);
        const hidesX = /hidden|clip/.test(cs.overflowX) || cs.textOverflow === 'ellipsis';
        const clamp = cs.getPropertyValue('-webkit-line-clamp');
        const hidesY = /hidden|clip/.test(cs.overflowY) || (clamp !== '' && clamp !== 'none');
        const wide = el.scrollWidth > el.clientWidth + 1;
        const tall = el.scrollHeight > el.clientHeight + 1;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if ((hidesX && wide) || (hidesY && tall)) clipped.push(text.slice(0, 80));
        else if (wide && cs.display !== 'inline') overflow.push(text.slice(0, 80));
        for (const node of el.childNodes) {
          if (node.nodeType !== 3) continue;
          const s = (node.textContent ?? '').trim();
          if (/[A-Za-z]{2,}/.test(s) && !pseudo.test(s)) plain.add(s.slice(0, 80));
        }
      }
      return { clipped, overflow, plain: [...plain] };
    }, PSEUDO.source);
    report[id] = found;
    if (!existsSync(join(out, `${id}.png`)) || !process.env.W3A_KEEP)
      await stage.screenshot({ path: join(out, `${id}.png`) });
    writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 1)}\n`);
    if (errors.length > before)
      report[id]!.clipped.unshift(`ERROR: ${errors.slice(before).join(' | ')}`);
  }
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 1)}\n`);
  expect(errors).toEqual([]);
});

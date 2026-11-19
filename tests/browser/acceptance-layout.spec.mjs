// Reflow at narrow widths. 320 CSS px is what a 1280 px window shows at 400% zoom
// (WCAG 1.4.10); this emulates the viewport, not the browser's own zoom control.
import { test, expect, settle, sessionQuestions, startCustomSession, goToQuestion } from './fixtures.mjs';

async function expectNoHorizontalScroll(page, state) {
  // Measure the settled layout, after the page-turn entrance animation.
  await settle(page);
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    // The root clips horizontal overflow, so also try to scroll it.
    window.scrollTo(200, window.scrollY);
    const scrolled = window.scrollX;
    window.scrollTo(0, window.scrollY);
    const wide = [...document.querySelectorAll('body *')]
      .filter((node) => {
        const box = node.getBoundingClientRect();
        if (!box.width || getComputedStyle(node).visibility === 'hidden') return false;
        // Content inside a deliberately scrollable region (data tables) may be wider.
        if (node.closest('.practice-table-scroll, .sr-only, .skip-link')) return false;
        return box.right > root.clientWidth + 1 || box.left < -1;
      })
      .slice(0, 5)
      .map((node) => `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}.${[...node.classList].join('.')}`);
    return { scroll: root.scrollWidth, client: root.clientWidth, scrolled, wide };
  });
  expect(overflow.scrolled, `${state}: page scrolls horizontally (${overflow.wide.join(', ')})`).toBe(0);
  expect(overflow.scroll, `${state}: content is wider than the viewport (${overflow.wide.join(', ')})`).toBeLessThanOrEqual(overflow.client);
  expect(overflow.wide, `${state}: elements outside the viewport`).toEqual([]);
}

for (const width of [320, 390]) {
  test.describe(`Acceptance: reflow at ${width} px`, () => {
    test.use({ viewport: { width, height: 720 } });
    for (const [path, state] of [['/', 'overview'], ['/bank.html', 'question bank'], ['/practice.html', 'practice setup'], ['/progress.html', 'progress']]) {
      test(`${state} fits without horizontal scrolling`, async ({ page }) => {
        await page.goto(path);
        await expectNoHorizontalScroll(page, state);
      });
    }
    test('practice question, dialog and results fit without horizontal scrolling', async ({ page }) => {
      await startCustomSession(page, { count: 5, timed: true });
      const questions = await sessionQuestions(page);
      await expectNoHorizontalScroll(page, 'multiple-choice question');
      await goToQuestion(page, questions.findIndex((q) => q.type === 'spr') + 1);
      await expectNoHorizontalScroll(page, 'numeric question');
      await page.locator('.practice-navigator').getByRole('button', { name: 'Finish & review' }).click();
      await expectNoHorizontalScroll(page, 'finish dialog');
      await page.getByRole('dialog').getByRole('button', { name: 'Finish & review' }).click();
      for (const summary of await page.locator('.review-item summary').all()) await summary.click();
      await expectNoHorizontalScroll(page, 'results with every worked solution open');
    });
  });
}

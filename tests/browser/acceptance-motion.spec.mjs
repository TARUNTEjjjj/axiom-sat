// With prefers-reduced-motion: reduce, nothing should move (animations, or transitions of
// transform and position) for longer than 10 ms, and links skip the page-turn animation.
// Colour and opacity fades are not motion and are allowed.
import { test, expect, startCustomSession } from './fixtures.mjs';

async function longestMotion(page) {
  return page.evaluate(() => {
    const seconds = (list) => Math.max(0, ...list.split(',').map((part) => {
      const value = parseFloat(part);
      return part.trim().endsWith('ms') ? value / 1000 : value;
    }));
    let longest = { seconds: 0, node: '' };
    for (const node of [document.documentElement, ...document.querySelectorAll('body, body *')]) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(node, pseudo);
        const animated = style.animationName !== 'none' ? seconds(style.animationDuration) : 0;
        const durations = style.transitionDuration.split(',');
        const moving = style.transitionProperty.split(',').map((name, i) =>
          /^(all|transform|translate|scale|rotate|top|left|right|bottom|inset|margin.*|width|height)$/.test(name.trim())
            ? seconds(durations[i % durations.length]) : 0);
        const time = Math.max(animated, ...moving);
        if (time > longest.seconds) longest = { seconds: time, node: `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}${pseudo || ''}` };
      }
    }
    return longest;
  });
}

test.describe('Acceptance: reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const path of ['/', '/bank.html', '/practice.html', '/progress.html']) {
    test(`${path} has no motion longer than 10 ms`, async ({ page }) => {
      await page.goto(path);
      const longest = await longestMotion(page);
      expect(longest.seconds, `longest motion on ${longest.node}`).toBeLessThanOrEqual(0.01);
    });
  }
  test('an active practice question has no motion longer than 10 ms', async ({ page }) => {
    await startCustomSession(page, { count: 5 });
    const longest = await longestMotion(page);
    expect(longest.seconds, `longest motion on ${longest.node}`).toBeLessThanOrEqual(0.01);
  });
  test('page links navigate without the page-turn animation', async ({ page }) => {
    await page.goto('/progress.html');
    await page.locator('main').getByRole('link', { name: /Start a practice session/ }).click();
    await expect(page).toHaveURL(/practice/);
    await expect(page.locator('html.is-leaving')).toHaveCount(0);
  });
});

test.describe('Acceptance: motion allowed (control)', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('the page-turn animation runs when motion is allowed', async ({ page }) => {
    await page.goto('/progress.html');
    await page.locator('main').getByRole('link', { name: /Start a practice session/ }).click();
    await expect(page.locator('html.is-leaving')).toHaveCount(1);
  });
});

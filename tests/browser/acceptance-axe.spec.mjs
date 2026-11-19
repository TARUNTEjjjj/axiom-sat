// Automated WCAG 2.2 A/AA rule checks (axe-core) on each page and practice state.
// axe finds a subset of accessibility problems; it does not replace a screen-reader pass.
import AxeBuilder from '@axe-core/playwright';
import {
  test, expect, START, settle, sessionQuestions, startCustomSession, answer, goToQuestion,
} from './fixtures.mjs';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page, state) {
  await test.step(`axe: ${state}`, async () => {
    // axe schedules its own work with timers, so let the page clock run in real time.
    await page.clock.resume();
    await settle(page);
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const found = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(found, `axe violations in ${state}`).toEqual([]);
  });
}

test.describe('Acceptance: automated accessibility rules', () => {
  for (const [path, state] of [
    ['/', 'overview'],
    ['/bank.html', 'question bank'],
    ['/practice.html', 'practice setup'],
    ['/progress.html', 'empty progress'],
    ['/no-such-page', '404 page'],
  ]) {
    test(`${state} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      await page.locator('main').first().waitFor();
      await expectNoViolations(page, state);
    });
  }

  test('practice states have no axe violations', async ({ page }) => {
    await startCustomSession(page, { count: 5, timed: true });
    const questions = await sessionQuestions(page);
    await expectNoViolations(page, 'multiple-choice question');
    await goToQuestion(page, questions.findIndex((q) => q.type === 'spr') + 1);
    await page.getByLabel('Your answer').fill('1/');
    await page.getByLabel('Your answer').blur();
    await expect(page.getByLabel('Your answer')).toHaveAttribute('aria-invalid', 'true');
    await expectNoViolations(page, 'numeric question with an invalid draft');
    await page.locator('.practice-navigator').getByRole('button', { name: 'Finish & review' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoViolations(page, 'finish dialog');
    await page.getByRole('dialog').getByRole('button', { name: 'Finish & review' }).click();
    await page.locator('.review-item summary').first().click();
    await expectNoViolations(page, 'results with an expanded worked solution');
  });

  test('progress with history and the reset dialog have no axe violations', async ({ page }) => {
    await page.goto('/progress.html');
    const backup = await page.evaluate(async (at) => {
      const { generate, listTemplates } = await import('/src/questions/index.js');
      const attempts = listTemplates().slice(0, 8).map(({ id }, i) => {
        const item = generate(id, 3);
        const response = i % 2 ? item.answer : item.type === 'mc' ? (item.answer === 'A' ? 'B' : 'A') : '99';
        return { templateId: id, seed: 3, response, source: 'bank', at: at + i };
      });
      return JSON.stringify({ version: 1, attempts });
    }, START.getTime() - 86_400_000);
    await page.locator('#backup-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await expect(page.locator('#data-message')).toHaveText(/^Backup merged/);
    await expectNoViolations(page, 'progress with history');
    await page.getByRole('button', { name: 'Reset progress' }).click();
    await expectNoViolations(page, 'reset dialog');
  });
});

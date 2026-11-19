// Storage that is denied, full or corrupted must never cost the learner visible work.
import {
  test, expect, START, SESSION_KEY, PROGRESS_KEY, storedSession, storedProgress, sessionQuestions,
  startCustomSession, answer, seedStorage, resultMetric,
} from './fixtures.mjs';

const DENIED = 'Browser storage is unavailable or full.';

test.describe('Acceptance: storage denied', () => {
  test.beforeEach(async ({ page }) => {
    // As when a browser blocks site data: reading window.localStorage throws.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('The operation is insecure.', 'SecurityError'); },
      });
    });
  });

  test('practice still runs to results and says that nothing is saved', async ({ page }) => {
    await startCustomSession(page, { count: 5, timed: true });
    await expect(page.locator('#save-status')).toContainText(DENIED);
    await page.getByRole('button', { name: /Flag for review/ }).click();
    await page.locator('.practice-navigator').getByRole('button', { name: 'Finish & review' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Finish & review' }).click();
    await expect(resultMetric(page, 'Skipped')).toHaveText('5');
    await expect(page.locator('#save-status')).toContainText(DENIED);
  });

  test('progress explains the problem and restore fails without losing anything', async ({ page }) => {
    await page.goto('/progress.html');
    await expect(page.locator('#storage-notice')).toBeVisible();
    await expect(page.locator('#storage-notice')).toHaveText('Browser storage is unavailable.');
    await expect(page.getByRole('button', { name: 'Download backup' })).toBeDisabled();
    await page.locator('#backup-file').setInputFiles({
      name: 'b.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"attempts":[]}'),
    });
    await expect(page.locator('#data-message')).toHaveText('Could not restore: Browser storage is unavailable.');
  });
});

test.describe('Acceptance: storage fills during a session', () => {
  test('answers stay on screen and the last saved state survives a reload', async ({ page }) => {
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (sessionStorage.getItem('full') === '1' && this === localStorage)
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
    });
    await startCustomSession(page, { count: 5, timed: true });
    const questions = await sessionQuestions(page);
    await answer(page, questions[0], questions[0].answer);
    const saved = await storedSession(page);
    await page.evaluate(() => sessionStorage.setItem('full', '1'));
    await page.getByRole('button', { name: 'Next question →' }).click();
    await answer(page, questions[1], questions[1].answer);
    await expect(page.locator('#save-status')).toContainText(DENIED);
    await expect(page.locator('#answer-count')).toHaveText('2 of 5 answered · 0 flagged');
    // Storage still holds the last state that could be written; nothing was erased.
    expect(await storedSession(page)).toEqual(saved);
    await page.evaluate(() => sessionStorage.removeItem('full'));
    await page.reload();
    await expect(page.locator('#answer-count')).toHaveText('1 of 5 answered · 0 flagged');
  });
});

test.describe('Acceptance: corrupted storage', () => {
  test('an unreadable saved session is reported and practice can start again', async ({ page }) => {
    await seedStorage(page, { [SESSION_KEY]: '{"version":2,"mode":' });
    await page.goto('/practice.html');
    await expect(page.locator('#save-status')).toHaveText(/could not be resumed/);
    await expect(page.getByRole('button', { name: 'Start practicing →' })).toBeVisible();
    await startCustomSession(page, { count: 5 });
  });

  test('unreadable progress is kept until the learner resets it, and practice results still show', async ({ page }) => {
    const garbage = '{"version":1,"attempts":[{"broken":true}]}';
    await seedStorage(page, { [PROGRESS_KEY]: garbage });
    await page.goto('/progress.html');
    await expect(page.locator('#storage-notice')).toHaveText(/Saved progress could not be read/);
    await page.locator('#backup-file').setInputFiles({
      name: 'b.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"attempts":[]}'),
    });
    await expect(page.locator('#data-message')).toHaveText(/^Could not restore: Saved progress could not be read/);
    expect(await storedProgress(page)).toBe(garbage);

    await startCustomSession(page, { count: 5, timed: false });
    const questions = await sessionQuestions(page);
    await answer(page, questions[0], questions[0].answer);
    await page.locator('.practice-navigator').getByRole('button', { name: 'Finish & review' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Finish & review' }).click();
    await expect(resultMetric(page, 'Correct')).toHaveText('1');
    expect(await storedProgress(page)).toBe(garbage);
    // The first retry press explains how to keep these first attempts instead of discarding them.
    await page.getByRole('button', { name: /^Retry missed/ }).click();
    await expect(page.locator('#save-status')).toHaveText(/Your saved progress could not be read/);
    await expect(resultMetric(page, 'Correct')).toHaveText('1');
  });
});

test.describe('Acceptance: timer across a closed page', () => {
  test('a session whose deadline passed while the page was closed finishes at that deadline', async ({ page }) => {
    await startCustomSession(page, { count: 5, timed: true });
    const questions = await sessionQuestions(page);
    await answer(page, questions[0], questions[0].answer);
    const { deadline } = await storedSession(page);
    await page.goto('about:blank');
    await page.clock.fastForward('15:00');
    await page.goto('/practice.html');
    await expect(page.getByRole('heading', { name: 'Time’s up. Let’s learn from it.' })).toBeVisible();
    const finished = await storedSession(page);
    expect(finished.finishedAt).toBe(deadline);
    expect(finished.responses[0]).toBe(questions[0].answer);
    await expect(resultMetric(page, 'Correct')).toHaveText('1');
    expect(deadline).toBe(START.getTime() + 10 * 60_000);
  });
});

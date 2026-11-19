// Keyboard-only operation, focus recovery and live-region text. Live-region checks
// confirm what the page writes for assistive technology, not what a screen reader speaks.
import { test, expect, START, storedSession, sessionQuestions, tabTo, tabKey } from './fixtures.mjs';

test.describe('Acceptance: keyboard-only practice', () => {
  test('setup, answers, flags, navigation, dialogs, review and retry work from the keyboard', async ({ page }) => {
    let questions;
    const stem = page.locator('#practice-stem');
    const live = page.locator('#practice-live');
    await page.goto('/practice.html');
    await test.step('choose a custom untimed session and start it', async () => {
      await tabTo(page, page.getByRole('radio', { name: /Quick sprint/ }));
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('radio', { name: /Build your own/ })).toBeChecked();
      await tabTo(page, page.getByLabel('Session length'));
      await tabTo(page, page.getByRole('checkbox', { name: /Practice with a timer/ }));
      await page.keyboard.press('Space');
      await expect(page.locator('#timer-budget')).toHaveText(/^Untimed/);
      await tabTo(page, page.getByRole('button', { name: 'Start practicing →' }));
      await page.keyboard.press('Enter');
      await expect(stem).toBeFocused();
      questions = await sessionQuestions(page);
    });
    const choiceFor = (key) =>
      page.locator('button.choice').filter({ has: page.locator('.choice-key', { hasText: new RegExp(`^${key}$`) }) });
    const answerHere = async (question, response) => {
      if (question.type === 'mc') {
        await tabTo(page, choiceFor(response));
        await page.keyboard.press('Enter');
        await expect(choiceFor(response)).toHaveAttribute('aria-pressed', 'true');
      } else {
        await tabTo(page, page.getByLabel('Your answer'));
        await page.keyboard.type(response);
      }
    };
    await test.step('answer and flag the first question', async () => {
      await answerHere(questions[0], questions[0].answer);
      await tabTo(page, page.getByRole('button', { name: /Flag for review/ }));
      await page.keyboard.press('Space');
      await expect(page.getByRole('button', { name: /Flagged for review/ })).toHaveAttribute('aria-pressed', 'true');
    });
    await test.step('move on with Next and recover focus on the new question', async () => {
      await tabTo(page, page.getByRole('button', { name: 'Next question →' }));
      await page.keyboard.press('Enter');
      await expect(page.getByText('Question 2 of 10', { exact: true })).toBeVisible();
      await expect(stem).toBeFocused();
    });
    const spr = questions.findIndex((q) => q.type === 'spr');
    await test.step('numeric input reports an invalid draft and accepts a valid answer', async () => {
      await tabTo(page, page.locator('#question-numbers').getByRole('button', { name: new RegExp(`^Question ${spr + 1},`) }));
      await page.keyboard.press('Enter');
      await expect(stem).toBeFocused();
      const input = page.getByLabel('Your answer');
      await tabTo(page, input);
      await page.keyboard.type('3/');
      await page.keyboard.press(tabKey(page));
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('#response-error')).toHaveText(/Use a number or fraction/);
      await expect(input).toHaveAccessibleDescription(/Use a number or fraction/);
      await tabTo(page, input, { back: true });
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type(questions[spr].answer);
      await expect(input).toHaveAttribute('aria-invalid', 'false');
      await expect(page.locator('#response-error')).toHaveText('');
    });
    const finishButton = page.locator('.practice-navigator').getByRole('button', { name: 'Finish & review' });
    const dialog = page.getByRole('dialog', { name: 'Finish this session?' });
    await test.step('Escape cancels the finish dialog and returns focus to its button', async () => {
      await tabTo(page, finishButton);
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Keep practicing' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(finishButton).toBeFocused();
      expect((await storedSession(page)).finishedAt).toBeNull();
    });
    await test.step('confirm the finish dialog and land on the results heading', async () => {
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      await tabTo(page, dialog.getByRole('button', { name: 'Finish & review' }));
      await page.keyboard.press('Enter');
      await expect(page.locator('#result-heading')).toBeFocused();
      await expect(live).toHaveText('Session complete. 2 correct, 0 incorrect, 8 skipped.');
    });
    await test.step('open a worked solution from the keyboard', async () => {
      const summary = page.locator('.review-item summary').first();
      await tabTo(page, summary);
      await page.keyboard.press('Enter');
      await expect(page.locator('.review-item').first()).toHaveJSProperty('open', true);
      await expect(page.locator('.review-item .explanation').first()).toBeVisible();
    });
    await test.step('start the retry and recover focus on its first question', async () => {
      await tabTo(page, page.getByRole('button', { name: /^Retry missed/ }), { back: true });
      await page.keyboard.press('Enter');
      await expect(stem).toBeFocused();
      await expect(live).toHaveText(/^Untimed retry started with 8 questions\. First-attempt progress is preserved\.$/);
    });
  });

  test('timer warning is written to the live region', async ({ page }) => {
    await page.goto('/practice.html');
    await page.getByRole('radio', { name: /Quick sprint/ }).check();
    await page.getByRole('button', { name: 'Start practicing →' }).click();
    await page.clock.fastForward('10:59');
    await expect(page.locator('#practice-clock')).toHaveText('05:01 left');
    await expect(page.locator('#practice-live')).toHaveText('');
    await page.clock.fastForward('00:02');
    await expect(page.locator('#practice-live')).toHaveText('Five minutes or less remain in this session.');
  });
});

test.describe('Acceptance: keyboard-only progress data', () => {
  test('backup restore and reset cancellation work from the keyboard', async ({ page }) => {
    await page.goto('/progress.html');
    const valid = await page.evaluate(async (at) => {
      const { generate, listTemplates } = await import('/src/questions/index.js');
      const [{ id }] = listTemplates();
      return JSON.stringify({ version: 1, attempts: [{ templateId: id, seed: 5, response: generate(id, 5).answer, source: 'bank', at }] });
    }, START.getTime() - 60_000);
    await test.step('the restore control is reachable and opens a file chooser', async () => {
      await tabTo(page, page.locator('#backup-file'));
      const chooser = page.waitForEvent('filechooser');
      await page.keyboard.press('Space');
      await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(valid) });
      await expect(page.locator('#data-message')).toHaveText('Backup merged: 1 new question, 1 retained in total.');
    });
    await test.step('Escape cancels reset and returns focus to the Reset button', async () => {
      const reset = page.getByRole('button', { name: 'Reset progress' });
      await tabTo(page, reset);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Keep my progress' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(reset).toBeFocused();
      await expect(page.locator('.progress-metric').first()).toContainText('1');
    });
  });
});

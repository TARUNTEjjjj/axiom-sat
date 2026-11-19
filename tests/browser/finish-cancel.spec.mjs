import { test, expect, storedSession, sessionQuestions, startCustomSession, answer } from './fixtures.mjs';

test.describe('Journey: cancelling the finish dialog keeps the session active', () => {
  test('Keep practicing and Escape both leave the session unfinished', async ({ page }) => {
    let questions;
    const dialog = page.getByRole('dialog', { name: 'Finish this session?' });
    await test.step('start a timed session and answer one question', async () => {
      await startCustomSession(page, { count: 5, timed: true });
      questions = await sessionQuestions(page);
      await answer(page, questions[0], questions[0].answer);
    });
    await test.step('open the dialog from the navigator and choose Keep practicing', async () => {
      await page.locator('.practice-navigator').getByRole('button', { name: 'Finish & review' }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('1 of 5 answered. 4 unanswered. 0 flagged for review.');
      await expect(dialog.getByRole('button', { name: 'Keep practicing' })).toBeFocused();
      await dialog.getByRole('button', { name: 'Keep practicing' }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('#practice-stem')).toBeVisible();
      expect((await storedSession(page)).finishedAt).toBeNull();
    });
    await test.step('open it from the last question and press Escape', async () => {
      await page.locator('#question-numbers').getByRole('button', { name: /^Question 5,/ }).click();
      await page.getByRole('button', { name: 'Finish session' }).click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.getByText('Question 5 of 5', { exact: true })).toBeVisible();
    });
    await test.step('the session stays active as time passes and after a reload', async () => {
      await page.clock.fastForward('01:00');
      await expect(page.locator('#practice-clock')).toHaveText('09:00 left');
      await page.reload();
      await expect(page.locator('#practice-stem')).toBeVisible();
      await expect(page.getByRole('heading', { name: /Good work|Time’s up/ })).toHaveCount(0);
      const session = await storedSession(page);
      expect(session.finishedAt).toBeNull();
      expect(session.responses[0]).toBe(questions[0].answer);
      await expect(page.locator('#answer-count')).toHaveText('1 of 5 answered · 0 flagged');
    });
  });
});

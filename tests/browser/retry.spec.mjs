import {
  test, expect, storedSession, storedProgress, sessionQuestions, startCustomSession, answer, shownResponse,
  resultMetric, progressMetric,
} from './fixtures.mjs';

const identity = ({ templateId, seed }) => ({ templateId, seed });
const firstAttempts = (text) =>
  Object.fromEntries(JSON.parse(text).attempts.map((a) => [`${a.templateId}#${a.seed}`, a]));

test.describe('Journey: retry missed questions', () => {
  test('retries the exact missed identities with cleared responses and keeps first attempts', async ({ page }) => {
    let questions, progressBefore;
    await test.step('answer an untimed session: correct, wrong, skipped, correct, wrong', async () => {
      await startCustomSession(page, { count: 5, timed: false });
      await expect(page.locator('#practice-clock')).toHaveText('Untimed practice');
      questions = await sessionQuestions(page);
      const plan = [questions[0].answer, questions[1].wrong, null, questions[3].answer, questions[4].wrong];
      for (const [i, response] of plan.entries()) {
        if (response !== null) await answer(page, questions[i], response);
        if (i === 1) await page.getByRole('button', { name: /Flag for review/ }).click();
        if (i < 4) await page.getByRole('button', { name: 'Next question →' }).click();
      }
    });
    await test.step('finish through the confirmation dialog', async () => {
      await page.getByRole('button', { name: 'Finish session' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Finish & review' }).click();
      await expect(page.getByRole('heading', { name: 'Good work. Now make it stick.' })).toBeFocused();
      await expect(resultMetric(page, 'Correct')).toHaveText('2');
      await expect(resultMetric(page, 'Incorrect')).toHaveText('2');
      await expect(resultMetric(page, 'Skipped')).toHaveText('1');
      progressBefore = firstAttempts(await storedProgress(page));
      expect(Object.keys(progressBefore)).toHaveLength(4);
    });
    const missed = () => [questions[1], questions[2], questions[4]];
    await test.step('start the retry and check its exact identities', async () => {
      await page.getByRole('button', { name: 'Retry missed (3)' }).click();
      await expect(page.getByText('Question 1 of 3', { exact: true })).toBeVisible();
      await expect(page.locator('#practice-stem')).toHaveText(questions[1].stem);
      await expect(page.locator('#answer-count')).toHaveText('0 of 3 answered · 0 flagged');
      await expect(page.locator('#practice-clock')).toHaveText('Untimed practice');
      expect(await shownResponse(page, questions[1])).toBe('');
      const retry = await storedSession(page);
      expect(retry.mode).toBe('retry');
      expect(retry.timed).toBe(false);
      expect(retry.questions).toEqual(missed().map(identity));
      expect(retry.responses).toEqual(['', '', '']);
      expect(retry.flags).toEqual([false, false, false]);
      expect(retry.answeredBefore).toEqual([true, false, true]);
    });
    await test.step('the retry survives a reload', async () => {
      await page.reload();
      await expect(page.locator('#practice-stem')).toHaveText(questions[1].stem);
      expect((await storedSession(page)).questions).toEqual(missed().map(identity));
    });
    await test.step('answer every retry question correctly and finish', async () => {
      for (const [i, question] of missed().entries()) {
        await answer(page, question, question.answer);
        if (i < 2) await page.getByRole('button', { name: 'Next question →' }).click();
      }
      await page.getByRole('button', { name: 'Finish session' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Finish & review' }).click();
      await expect(resultMetric(page, 'Correct')).toHaveText('3');
    });
    await test.step('first-attempt history keeps the original answers', async () => {
      const after = firstAttempts(await storedProgress(page));
      for (const key of Object.keys(progressBefore)) expect(after[key]).toEqual(progressBefore[key]);
      // Only the previously skipped question adds a first attempt.
      const skipped = `${questions[2].templateId}#${questions[2].seed}`;
      expect(Object.keys(after).sort()).toEqual([...Object.keys(progressBefore), skipped].sort());
      expect(after[skipped].response).toBe(questions[2].answer);
      await page.getByRole('link', { name: 'View my progress →' }).click();
      await expect(progressMetric(page, 'Questions attempted')).toHaveText('5');
      await expect(progressMetric(page, 'First-attempt accuracy')).toHaveText('60%');
    });
  });
});

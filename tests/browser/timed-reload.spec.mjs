import {
  test, expect, START, storedSession, sessionQuestions, startCustomSession, answer, shownResponse, goToQuestion,
  resultMetric, progressMetric,
} from './fixtures.mjs';

test.describe('Journey: timed session survives a reload', () => {
  test('question identities, answers, flags and the original deadline are kept', async ({ page }) => {
    let questions, before;
    await test.step('start a timed five-question custom session', async () => {
      await startCustomSession(page, { count: 5, timed: true });
      await expect(page.locator('#practice-clock')).toHaveText('10:00 left');
      questions = await sessionQuestions(page);
      expect(questions).toHaveLength(5);
    });
    await test.step('answer, flag and move between questions', async () => {
      await answer(page, questions[0], questions[0].answer);
      await page.getByRole('button', { name: /Flag for review/ }).click();
      await page.getByRole('button', { name: 'Next question →' }).click();
      await answer(page, questions[1], questions[1].wrong);
      await goToQuestion(page, 4);
      await page.getByRole('button', { name: /Flag for review/ }).click();
      await expect(page.locator('#answer-count')).toHaveText('2 of 5 answered · 2 flagged');
    });
    await test.step('let 3 minutes 30 seconds pass on the controlled clock', async () => {
      await page.clock.fastForward('03:30');
      await expect(page.locator('#practice-clock')).toHaveText('06:30 left');
      before = await storedSession(page);
      expect(before.startedAt).toBe(START.getTime());
      expect(before.deadline).toBe(START.getTime() + 10 * 60_000);
    });
    await test.step('reload and compare the restored session', async () => {
      await page.reload();
      await expect(page.getByText('Question 4 of 5', { exact: true })).toBeVisible();
      await expect(page.locator('#practice-stem')).toHaveText(questions[3].stem);
      await expect(page.locator('#answer-count')).toHaveText('2 of 5 answered · 2 flagged');
      // The deadline did not move: the time spent away still counts.
      await expect(page.locator('#practice-clock')).toHaveText('06:30 left');
      const after = await storedSession(page);
      expect(after.questions).toEqual(questions.map(({ templateId, seed }) => ({ templateId, seed })));
      expect(after.responses).toEqual(before.responses);
      expect(after.flags).toEqual([true, false, false, true, false]);
      expect(after.deadline).toBe(before.deadline);
      expect(after.startedAt).toBe(before.startedAt);
      const navigator = page.locator('#question-numbers');
      await expect(navigator.getByRole('button', { name: 'Question 1, answered, flagged' })).toBeVisible();
      await expect(navigator.getByRole('button', { name: 'Question 2, answered' })).toBeVisible();
      await expect(navigator.getByRole('button', { name: 'Question 4, unanswered, flagged' })).toBeVisible();
      await goToQuestion(page, 1);
      expect(await shownResponse(page, questions[0])).toBe(questions[0].answer);
      await expect(page.getByRole('button', { name: /Flagged for review/ })).toHaveAttribute('aria-pressed', 'true');
      await goToQuestion(page, 2);
      expect(await shownResponse(page, questions[1])).toBe(questions[1].wrong);
    });
    await test.step('the original deadline ends the session without a full real-time wait', async () => {
      await page.clock.fastForward('06:31');
      await expect(page.getByRole('heading', { name: 'Time’s up. Let’s learn from it.' })).toBeVisible();
      const finished = await storedSession(page);
      expect(finished.expired).toBe(true);
      expect(finished.finishedAt).toBe(before.deadline);
      expect(finished.responses).toEqual(before.responses);
      await expect(resultMetric(page, 'Correct')).toHaveText('1');
      await expect(resultMetric(page, 'Incorrect')).toHaveText('1');
      await expect(resultMetric(page, 'Skipped')).toHaveText('3');
    });
  });
});

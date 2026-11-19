// Shared setup for the browser journeys: a fixed clock, a fixed session seed, isolated
// storage (Playwright gives every test a new browser context) and failure diagnostics.
import { test as base, expect } from '@playwright/test';

export { expect };
export const SESSION_KEY = 'axiom.practice.v1';
export const PROGRESS_KEY = 'axiom.progress.v1';
// A fixed wall-clock start. Time only moves when a test advances it.
export const START = new Date('2026-11-19T09:00:00Z');
// The practice page seeds each session from crypto.getRandomValues. Fixing that one call
// makes every run select the same questions, so a failure can be reproduced exactly.
export const SESSION_SEED = 20261119;

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const log = [];
    const errors = [];
    page.on('console', (message) => log.push(`[${message.type()}] ${message.text()}`));
    page.on('pageerror', (error) => {
      errors.push(error);
      log.push(`[pageerror] ${error.stack || error.message}`);
    });
    page.on('requestfailed', (request) =>
      log.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText || ''}`),
    );
    // Keep each run offline and self-contained: only the local build may answer.
    await page.route(/^(?!http:\/\/127\.0\.0\.1[:/])/, (route) => {
      log.push(`[blocked] ${route.request().url()}`);
      return route.abort('blockedbyclient');
    });
    await page.clock.install({ time: START });
    // Paused: the page clock only moves when a test advances it.
    await page.clock.pauseAt(START);
    await page.addInitScript((seed) => {
      const random = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (array) => {
        if (array instanceof Uint32Array && array.length === 1) {
          array[0] = seed;
          return array;
        }
        return random(array);
      };
    }, SESSION_SEED);
    await use(page);
    if (testInfo.status !== testInfo.expectedStatus) {
      // The trace, screenshot and video are kept by the config; add the console and storage.
      let storage = '(page closed)';
      try {
        storage = JSON.stringify(
          await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
          null,
          2,
        );
      } catch {}
      await testInfo.attach('browser-console.txt', { body: log.join('\n') || '(empty)', contentType: 'text/plain' });
      await testInfo.attach('local-storage.json', { body: storage, contentType: 'application/json' });
    }
    expect(errors.map((error) => error.message), 'uncaught page errors').toEqual([]);
  },
});

export async function storedSession(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SESSION_KEY);
}

export async function storedProgress(page) {
  return page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY);
}

// Answer keys come from the application's own question engine for the stored identities.
// They choose what to enter; every answer is still given through the rendered page.
export async function sessionQuestions(page) {
  return page.evaluate(async (key) => {
    const { generate } = await import('/src/questions/index.js');
    const { sprEquals } = await import('/src/questions/spr.js');
    const session = JSON.parse(localStorage.getItem(key));
    return session.questions.map(({ templateId, seed }) => {
      const item = generate(templateId, seed);
      const wrong =
        item.type === 'mc'
          ? item.choices.map((choice) => choice.key).find((choice) => choice !== item.answer)
          : ['0', '1', '2', '3'].find((candidate) => !sprEquals(candidate, item.answer));
      return { templateId, seed, type: item.type, stem: item.stem, answer: item.answer, wrong };
    });
  }, SESSION_KEY);
}

export async function startCustomSession(page, { count = 5, timed = true } = {}) {
  await page.goto('/practice.html');
  await page.getByRole('radio', { name: /Build your own/ }).check();
  await page.getByLabel('Session length').selectOption(String(count));
  await page.getByRole('checkbox', { name: /Practice with a timer/ }).setChecked(timed);
  await page.getByRole('button', { name: 'Start practicing →' }).click();
  await expect(page.locator('#practice-stem')).toBeVisible();
}

// Enter a response on the current question through its rendered control.
export async function answer(page, question, response) {
  if (question.type === 'mc') {
    const choice = page.locator('button.choice').filter({ has: page.locator('.choice-key', { hasText: new RegExp(`^${response}$`) }) });
    await choice.click();
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
  } else {
    await page.getByLabel('Your answer').fill(response);
  }
}

// The response the page currently shows for the current question ('' when none).
export async function shownResponse(page, question) {
  if (question.type === 'mc') {
    const pressed = page.locator('button.choice[aria-pressed="true"] .choice-key');
    return (await pressed.count()) ? (await pressed.textContent()).trim() : '';
  }
  return page.getByLabel('Your answer').inputValue();
}

export async function goToQuestion(page, number) {
  await page.locator('#question-numbers').getByRole('button', { name: new RegExp(`^Question ${number},`) }).click();
  await expect(page.getByText(new RegExp(`^Question ${number} of \\d+$`))).toBeVisible();
}

// The number shown on a practice result card, such as Correct or Skipped.
export function resultMetric(page, label) {
  return page.locator('.result-metric').filter({ has: page.getByText(label, { exact: true }) }).locator('strong');
}

// The value shown on a Progress page summary card.
export function progressMetric(page, title) {
  return page.locator('.progress-metric').filter({ has: page.getByText(title, { exact: true }) }).locator('strong');
}

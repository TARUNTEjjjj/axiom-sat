import { test, expect, START, storedProgress } from './fixtures.mjs';

const malformed = {
  'truncated JSON': '{"version":1,"attempts":[{"templateId":',
  'unsupported version': JSON.stringify({ version: 2, attempts: [] }),
  'unknown question': JSON.stringify({
    version: 1,
    attempts: [{ templateId: 'no-such-template', seed: 1, response: 'A', source: 'bank', at: START.getTime() }],
  }),
};

test.describe('Journey: a malformed backup cannot change saved progress', () => {
  test('restore shows an error and leaves existing progress untouched', async ({ page }) => {
    let saved, metrics;
    const message = page.locator('#data-message');
    const input = page.locator('#backup-file');
    await page.goto('/progress.html');
    await test.step('restore a valid backup to create existing progress', async () => {
      const valid = await page.evaluate(async (at) => {
        const { generate, listTemplates } = await import('/src/questions/index.js');
        const attempts = listTemplates().slice(0, 2).map(({ id }) => {
          const item = generate(id, 7);
          return { templateId: id, seed: 7, response: item.answer, source: 'bank', at };
        });
        return JSON.stringify({ version: 1, attempts });
      }, START.getTime() - 86_400_000);
      await input.setInputFiles({ name: 'axiom-progress.json', mimeType: 'application/json', buffer: Buffer.from(valid) });
      await expect(message).toHaveText('Backup merged: 2 new questions, 2 retained in total.');
      saved = await storedProgress(page);
      metrics = await page.locator('#metrics').innerText();
      expect(metrics).toContain('100%');
    });
    for (const [name, text] of Object.entries(malformed)) {
      await test.step(`reject a backup with ${name}`, async () => {
        await input.setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(text) });
        await expect(message).toHaveText(/^Could not restore: /);
        expect(await storedProgress(page)).toBe(saved);
        expect(await page.locator('#metrics').innerText()).toBe(metrics);
        // The input is cleared so the same file can be chosen again.
        expect(await input.inputValue()).toBe('');
      });
    }
    await test.step('progress is unchanged after a reload', async () => {
      await page.reload();
      expect(await storedProgress(page)).toBe(saved);
      await expect.poll(() => page.locator('#metrics').innerText()).toBe(metrics);
    });
  });
});

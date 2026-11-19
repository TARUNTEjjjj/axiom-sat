// Browser regression journeys against the packaged dist/ release. Run: npm run test:browser
// Development tooling only; the deployed site has no runtime dependencies.
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT || 4317);

export default defineConfig({
  testDir: 'tests/browser',
  testMatch: '*.spec.mjs',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // Every test gets a fresh context, so localStorage starts empty. Service workers are
    // blocked so a cached shell from one run cannot answer for the build under test.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Build (tests + packaging) first, so the suite always exercises the current dist/.
    command: 'node scripts/build.mjs && node tests/browser/serve.mjs',
    url: `http://127.0.0.1:${port}/practice.html`,
    env: { PORT: String(port) },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

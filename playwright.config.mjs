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
  // results.json feeds scripts/acceptance-matrix.mjs.
  reporter: [
    ['list'],
    ...(process.env.CI ? [['github']] : []),
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // Every test gets a fresh context, so localStorage starts empty. Service workers are
    // blocked so a cached shell from one run cannot answer for the build under test.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // The learner journeys and the acceptance checks run in all three engines.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // Optional: the installed, branded Google Chrome (PW_CHROME=1), for the acceptance record.
    ...(process.env.PW_CHROME === '1' ? [{ name: 'google-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }] : []),
  ],
  webServer: {
    // Build (tests + packaging) first, so the suite always exercises the current dist/.
    command: 'node scripts/build.mjs && node tests/browser/serve.mjs',
    url: `http://127.0.0.1:${port}/practice.html`,
    env: { PORT: String(port) },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

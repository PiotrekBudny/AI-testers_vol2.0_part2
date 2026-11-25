import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Never open the report server locally: it would block the pre-commit hook.
  reporter: isCI
    ? [['html'], ['json', { outputFile: 'test-results/results.json' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://aitesters.byst.re',
    trace: isCI ? 'off' : 'on-first-retry',
  },
  projects: [
    {
      name: 'mockingTests',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

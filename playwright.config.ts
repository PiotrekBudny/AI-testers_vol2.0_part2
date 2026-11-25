import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import type { Options } from './src/fixtures/test';

dotenv.config({ quiet: true });

const isCI = !!process.env.CI;

export default defineConfig<Options>({
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
    harRecording: !isCI,
    harUpdate: !isCI && process.env.UPDATE_HAR === 'true',
  },
  projects: [
    {
      name: 'mockingTests',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

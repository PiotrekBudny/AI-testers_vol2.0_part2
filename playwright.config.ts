import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { featureTags, tagPattern } from '@/config/testTags';
import type { Options } from '@/fixtures/test';

dotenv.config({ quiet: true });

const isCI = !!process.env.CI;

export default defineConfig<Options>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [
        ['list'],
        ['html'],
        ['json', { outputFile: 'test-results/results.json' }],
      ]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.BASE_URL ?? 'https://aitesters.byst.re',
    trace: isCI ? 'off' : 'on-first-retry',
    harRecording: !isCI,
  },
  projects: [
    ...featureTags.map((tag) => ({ name: tag, grep: tagPattern(tag) })),
    { name: 'untagged', grepInvert: featureTags.map(tagPattern) },
  ],
});

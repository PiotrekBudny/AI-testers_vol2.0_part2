import { existsSync } from 'node:fs';
import { test as base } from '@playwright/test';
import { readHar, sanitizeHar, writeHar } from '@/har/harFile';

export type HarOptions = {
  harRecording: boolean;
};

const harUrlFilter =
  /\/api\/v1\/(products|cart|currencies|users\/me|orders|admin\/inventory)(\/|\?|$)/;

export const harTest = base.extend<HarOptions>({
  harRecording: [false, { option: true }],
  contextOptions: async ({ contextOptions, harRecording }, use, testInfo) => {
    if (!harRecording) {
      await use(contextOptions);
      return;
    }
    const harPath = testInfo.outputPath('network.har');
    await use({
      ...contextOptions,
      recordHar: {
        path: harPath,
        urlFilter: harUrlFilter,
        mode: 'minimal',
        content: 'embed',
      },
    });
    if (!existsSync(harPath)) {
      return;
    }
    const har = sanitizeHar(readHar(harPath));
    writeHar(harPath, har);
    if (har.log.entries.length === 0) {
      return;
    }
    await testInfo.attach('network.har', {
      path: harPath,
      contentType: 'application/json',
    });
  },
});

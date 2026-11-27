import { expect, mergeTests } from '@playwright/test';
import { type HarOptions, harTest } from './har';
import { mocksTest } from './mocks';
import { pagesTest } from './pages';
import { safetyTest } from './safety';
import type { SessionOptions } from './session';

export type Options = SessionOptions & HarOptions;

export const test = mergeTests(harTest, safetyTest, pagesTest, mocksTest);

export { expect };

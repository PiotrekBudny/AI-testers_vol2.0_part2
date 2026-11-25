import type { Locator } from '@playwright/test';

export type Locators<K extends string> = Readonly<Record<K, Locator>>;

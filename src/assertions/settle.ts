import { expect, type Page } from '@playwright/test';

export async function expectToStay<T>(
  page: Page,
  read: () => T,
  expected: T,
  forMs: number,
  message: string,
  pollTimeout?: number,
): Promise<void> {
  const readValue: () => unknown = read;
  await expect
    .poll(
      readValue,
      pollTimeout === undefined
        ? { message }
        : { message, timeout: pollTimeout },
    )
    .toEqual(expected);
  await page.waitForTimeout(forMs);
  expect(readValue(), `${message} after ${forMs} ms`).toEqual(expected);
}

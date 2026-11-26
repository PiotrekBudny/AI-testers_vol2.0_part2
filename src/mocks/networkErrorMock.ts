import { expect, type Page } from '@playwright/test';
import { type ApiEndpoint, apiRoutes } from './apiRoutes';

export type NetworkErrorCode =
  | 'failed'
  | 'aborted'
  | 'timedout'
  | 'internetdisconnected'
  | 'connectionreset'
  | 'connectionrefused'
  | 'connectionclosed'
  | 'namenotresolved';

export type NetworkErrorOptions = {
  times?: number;
  errorCode?: NetworkErrorCode;
};

export class NetworkErrorMock {
  private readonly attempts = new Map<ApiEndpoint, number>();

  constructor(private readonly page: Page) {}

  async abort(
    endpoint: ApiEndpoint,
    { times, errorCode = 'failed' }: NetworkErrorOptions = {},
  ): Promise<void> {
    await this.page.route(
      apiRoutes[endpoint],
      async (route) => {
        this.attempts.set(endpoint, this.abortedCount(endpoint) + 1);
        await route.abort(errorCode);
      },
      times === undefined ? {} : { times },
    );
  }

  abortedCount(endpoint: ApiEndpoint): number {
    return this.attempts.get(endpoint) ?? 0;
  }

  async waitForAbortedCount(
    endpoint: ApiEndpoint,
    atLeast: number,
  ): Promise<void> {
    await expect
      .poll(() => this.abortedCount(endpoint), {
        message: `waiting for ${atLeast} aborted requests to ${endpoint}`,
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(atLeast);
  }

  async expectAbortedCount(
    endpoint: ApiEndpoint,
    count: number,
  ): Promise<void> {
    await expect
      .poll(() => this.abortedCount(endpoint), {
        message: `aborted requests to ${endpoint}`,
        timeout: 10_000,
      })
      .toBe(count);
  }

  async expectAbortedCountToStay(
    endpoint: ApiEndpoint,
    count: number,
    forMs: number,
  ): Promise<void> {
    await this.expectAbortedCount(endpoint, count);
    await this.page.waitForTimeout(forMs);
    expect(
      this.abortedCount(endpoint),
      `aborted requests to ${endpoint} after ${forMs} ms`,
    ).toBe(count);
  }
}

import { expect, type Page } from '@playwright/test';
import { type ApiEndpoint, apiRoutes } from '@/api/endpoints';
import { expectToStay } from '@/assertions/settle';
import { RETRY_WAIT_TIMEOUT_MS } from '@/config/timing';

type NetworkErrorCode =
  | 'failed'
  | 'aborted'
  | 'timedout'
  | 'internetdisconnected'
  | 'connectionreset'
  | 'connectionrefused'
  | 'connectionclosed'
  | 'namenotresolved';

type NetworkErrorOptions = {
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
        timeout: RETRY_WAIT_TIMEOUT_MS,
      })
      .toBeGreaterThanOrEqual(atLeast);
  }

  async expectAbortedCountToStay(
    endpoint: ApiEndpoint,
    count: number,
    forMs: number,
  ): Promise<void> {
    await expectToStay(
      this.page,
      () => this.abortedCount(endpoint),
      count,
      forMs,
      `aborted requests to ${endpoint}`,
      RETRY_WAIT_TIMEOUT_MS,
    );
  }
}

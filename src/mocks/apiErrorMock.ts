import { expect, type Page, type Route } from '@playwright/test';
import { type ApiEndpoint, apiRoutes } from '@/api/endpoints';
import { expectToStay } from '@/assertions/settle';
import { RETRY_WAIT_TIMEOUT_MS } from '@/config/timing';

type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502 | 503;

const reasonPhrases: Record<ApiErrorStatus, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

type ApiErrorOptions = {
  times?: number;
  message?: string;
};

export class ApiErrorMock {
  private readonly hits = new Map<ApiEndpoint, number>();

  constructor(private readonly page: Page) {}

  async respondWithError(
    endpoint: ApiEndpoint,
    status: ApiErrorStatus,
    { times, message = `Mocked ${status} response` }: ApiErrorOptions = {},
  ): Promise<void> {
    await this.page.route(
      apiRoutes[endpoint],
      (route) => this.fulfill(route, endpoint, status, message),
      times === undefined ? {} : { times },
    );
  }

  async rejectSession(): Promise<void> {
    await this.respondWithError('logout', 401);
    await this.respondWithError('tokenRefresh', 401);
    await this.respondWithError('currentUser', 401);
  }

  async waitForRequestCount(
    endpoint: ApiEndpoint,
    atLeast: number,
  ): Promise<void> {
    await expect
      .poll(() => this.requestCount(endpoint), {
        message: `waiting for ${atLeast} mocked requests to ${endpoint}`,
        timeout: RETRY_WAIT_TIMEOUT_MS,
      })
      .toBeGreaterThanOrEqual(atLeast);
  }

  async expectRequestCountToStay(
    endpoint: ApiEndpoint,
    count: number,
    forMs: number,
  ): Promise<void> {
    await expectToStay(
      this.page,
      () => this.requestCount(endpoint),
      count,
      forMs,
      `mocked error responses served for ${endpoint}`,
    );
  }

  async expectRequestCount(
    endpoint: ApiEndpoint,
    count: number,
  ): Promise<void> {
    await expect
      .poll(() => this.requestCount(endpoint), {
        message: `mocked error responses served for ${endpoint}`,
      })
      .toBe(count);
  }

  requestCount(endpoint: ApiEndpoint): number {
    return this.hits.get(endpoint) ?? 0;
  }

  private async fulfill(
    route: Route,
    endpoint: ApiEndpoint,
    status: ApiErrorStatus,
    message: string,
  ): Promise<void> {
    this.hits.set(endpoint, this.requestCount(endpoint) + 1);
    await route.fulfill({
      status,
      json: {
        status,
        error: reasonPhrases[status],
        message,
        path: new URL(route.request().url()).pathname,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

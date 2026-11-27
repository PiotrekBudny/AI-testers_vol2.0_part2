import {
  type APIResponse,
  expect,
  type Page,
  type Route,
} from '@playwright/test';
import { type ApiEndpoint, apiRoutes } from '@/api/endpoints';
import { expectToStay } from '@/assertions/settle';

type LiveTransform<T> = (realResponse: T) => T;

const SETTLE_WINDOW_MS = 1_000;

export class LivePatchedMock<T> {
  readonly realResponses: T[] = [];
  readonly servedResponses: T[] = [];
  readonly errors: string[] = [];

  constructor(
    protected readonly page: Page,
    private readonly endpoint: ApiEndpoint,
  ) {}

  async register(transform: LiveTransform<T>): Promise<void> {
    await this.page.route(apiRoutes[this.endpoint], (route) =>
      this.fulfill(route, transform),
    );
  }

  lastServed(): T {
    const served = this.servedResponses.at(-1);
    if (served === undefined) {
      throw new Error(
        `No patched ${this.endpoint} response was served. Errors: ${this.errors.join('; ') || 'none'}`,
      );
    }
    return served;
  }

  lastReal(): T {
    const real = this.realResponses.at(-1);
    if (real === undefined) {
      throw new Error(`No real ${this.endpoint} response was fetched`);
    }
    return real;
  }

  async expectServedWithoutErrors(
    count: number,
    settleMs = SETTLE_WINDOW_MS,
  ): Promise<void> {
    await expect
      .poll(() => this.servedResponses.length + this.errors.length, {
        message: `patched ${this.endpoint} responses served or failed`,
      })
      .toBeGreaterThanOrEqual(count);
    expect(this.errors, `errors patching ${this.endpoint}`).toEqual([]);
    await expectToStay(
      this.page,
      () => this.servedResponses.length,
      count,
      settleMs,
      `patched ${this.endpoint} responses served`,
    );
    expect(this.errors, `errors patching ${this.endpoint}`).toEqual([]);
  }

  private async fulfill(
    route: Route,
    transform: LiveTransform<T>,
  ): Promise<void> {
    let response: APIResponse | undefined;
    let realResponse: T;
    let served: T;
    try {
      response = await route.fetch();
      if (!response.ok()) {
        throw new Error(`real ${this.endpoint} returned ${response.status()}`);
      }
      realResponse = (await response.json()) as T;
      served = transform(structuredClone(realResponse));
    } catch (error) {
      this.errors.push(error instanceof Error ? error.message : String(error));
      await (response ? route.fulfill({ response }) : route.abort('failed'));
      return;
    }
    await route.fulfill({ response, json: served });
    this.realResponses.push(realResponse);
    this.servedResponses.push(served);
  }
}

import type { APIResponse, Page, Route } from '@playwright/test';
import type { ProductSearchResponse } from '../models/productSearchResponse';
import { apiRoutes } from './apiRoutes';

export type ProductSearchTransform = (
  realResponse: ProductSearchResponse,
) => ProductSearchResponse;

export class LivePatchedProductSearchMock {
  readonly realResponses: ProductSearchResponse[] = [];
  readonly servedResponses: ProductSearchResponse[] = [];
  readonly errors: string[] = [];

  constructor(private readonly page: Page) {}

  async register(transform: ProductSearchTransform): Promise<void> {
    await this.page.route(apiRoutes.productSearch, (route) =>
      this.fulfill(route, transform),
    );
  }

  lastServed(): ProductSearchResponse {
    const served = this.servedResponses.at(-1);
    if (!served) {
      throw new Error(
        `No patched product search response was served. Errors: ${this.errors.join('; ') || 'none'}`,
      );
    }
    return served;
  }

  private async fulfill(
    route: Route,
    transform: ProductSearchTransform,
  ): Promise<void> {
    let response: APIResponse | undefined;
    try {
      response = await route.fetch();
      if (!response.ok()) {
        throw new Error(`real search returned ${response.status()}`);
      }
      const realResponse = (await response.json()) as ProductSearchResponse;
      const served = transform(structuredClone(realResponse));
      this.realResponses.push(realResponse);
      this.servedResponses.push(served);
      await route.fulfill({ response, json: served });
    } catch (error) {
      this.errors.push(error instanceof Error ? error.message : String(error));
      if (response) {
        await route.fulfill({ response });
      } else {
        await route.abort('failed');
      }
    }
  }
}

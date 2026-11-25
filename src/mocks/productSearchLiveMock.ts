import type { Page, Route } from '@playwright/test';
import type { ProductSearchResponse } from '../models/productSearchResponse';
import { ProductSearchMock } from './productSearchMock';

export type ProductSearchTransform = (
  realResponse: ProductSearchResponse,
) => ProductSearchResponse;

export class ProductSearchLiveMock {
  readonly realResponses: ProductSearchResponse[] = [];
  readonly servedResponses: ProductSearchResponse[] = [];
  readonly errors: string[] = [];

  constructor(private readonly page: Page) {}

  async register(transform: ProductSearchTransform): Promise<void> {
    await this.page.route(ProductSearchMock.urlPattern, (route) =>
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
    const response = await route.fetch();
    try {
      if (!response.ok()) {
        throw new Error(`real search returned ${response.status()}`);
      }
      const realResponse = (await response.json()) as ProductSearchResponse;
      this.realResponses.push(structuredClone(realResponse));
      const served = transform(realResponse);
      this.servedResponses.push(served);
      await route.fulfill({ response, json: served });
    } catch (error) {
      this.errors.push(error instanceof Error ? error.message : String(error));
      await route.fulfill({ response });
    }
  }
}

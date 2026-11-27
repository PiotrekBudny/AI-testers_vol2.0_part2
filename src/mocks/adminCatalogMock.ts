import { expect, type Page, type Route } from '@playwright/test';
import { apiRoutes } from '@/api/endpoints';
import { expectToStay } from '@/assertions/settle';
import { requireMockIds } from '@/config/mockIds';
import type { ProductDetails } from '@/models/product';
import { pathId } from './support/pathId';
import { ResponseHold } from './support/responseHold';

export class AdminCatalogMock {
  readonly deletedIds: number[] = [];
  private products: ProductDetails[] = [];
  private servedListReads = 0;
  private readonly deleteHold = new ResponseHold();
  private readonly readHold = new ResponseHold();

  constructor(private readonly page: Page) {}

  async register(): Promise<void> {
    await this.page.route(apiRoutes.productList, (route) =>
      this.handleList(route),
    );
    await this.page.route(apiRoutes.productDetails, (route) =>
      this.handleProduct(route),
    );
  }

  seed(products: ProductDetails[]): void {
    requireMockIds(
      'product',
      products.map((product) => product.id),
    );
    this.products = [...products];
  }

  holdDeletes(): () => void {
    return this.deleteHold.hold();
  }

  holdReads(): () => void {
    return this.readHold.hold();
  }

  releaseHeldResponses(): void {
    this.deleteHold.release();
    this.readHold.release();
  }

  async waitForListReads(count: number): Promise<void> {
    await expect
      .poll(() => this.servedListReads, {
        message: 'served product list reads',
      })
      .toBeGreaterThanOrEqual(count);
  }

  async expectDeletedIds(ids: number[]): Promise<void> {
    await expect
      .poll(() => this.deletedIds, { message: 'deleted product ids' })
      .toEqual(ids);
  }

  async expectDeletedIdsToStay(ids: number[], forMs: number): Promise<void> {
    await expectToStay(
      this.page,
      () => this.deletedIds,
      ids,
      forMs,
      'deleted product ids',
    );
  }

  async expectProductIds(ids: number[]): Promise<void> {
    await expect
      .poll(() => this.products.map((product) => product.id), {
        message: 'product ids in the mocked catalog',
      })
      .toEqual(ids);
  }

  private async handleList(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await this.readHold.wait();
    await route.fulfill({ json: this.products });
    this.servedListReads += 1;
  }

  private async handleProduct(route: Route): Promise<void> {
    const method = route.request().method();
    if (method !== 'GET' && method !== 'DELETE') {
      await route.fallback();
      return;
    }
    const id = pathId(route.request().url());
    if (method === 'DELETE') {
      this.deletedIds.push(id);
      await this.deleteHold.wait();
    }
    const product = this.products.find((candidate) => candidate.id === id);
    if (product === undefined) {
      await route.fulfill({
        status: 404,
        json: { message: 'Product not found' },
      });
      return;
    }
    if (method === 'GET') {
      await route.fulfill({ json: product });
      return;
    }
    this.products = this.products.filter((candidate) => candidate.id !== id);
    await route.fulfill({ status: 204 });
  }
}

import { expect, type Page, type Route } from '@playwright/test';
import { ProductSearchResponseBuilder } from '../builders/productSearchResponseBuilder';
import type { Product } from '../models/product';
import { apiRoutes } from './apiRoutes';

export class FakeProductSearchMock {
  products: Product[];
  readonly receivedQueries: (string | null)[] = [];

  constructor(
    private readonly page: Page,
    products: Product[],
  ) {
    this.products = products;
  }

  async register(): Promise<void> {
    await this.page.route(apiRoutes.productSearch, (route) =>
      this.fulfill(route),
    );
  }

  updateProduct(id: number, changes: Omit<Partial<Product>, 'id'>): Product {
    const product = this.products.find((candidate) => candidate.id === id);
    if (!product) {
      throw new Error(`No mocked product with id ${id}`);
    }
    return Object.assign(product, changes);
  }

  async expectLastSearchedFor(query: string | null): Promise<void> {
    await expect
      .poll(() => this.receivedQueries.at(-1), {
        message: 'last product search query',
      })
      .toBe(query);
  }

  private matching(query: string | null): Product[] {
    const needle = query?.trim().toLowerCase();
    if (!needle) {
      return this.products;
    }
    return this.products.filter(
      ({ name, description }) =>
        name.toLowerCase().includes(needle) ||
        description.toLowerCase().includes(needle),
    );
  }

  private async fulfill(route: Route): Promise<void> {
    const params = new URL(route.request().url()).searchParams;
    const query = params.get('q');
    this.receivedQueries.push(query);
    const builder = new ProductSearchResponseBuilder()
      .withProducts(this.matching(query))
      .withPageNumber(Number(params.get('page') ?? 0));
    const size = params.get('size');
    if (size !== null) {
      builder.withPageSize(Number(size));
    }
    await route.fulfill({ json: builder.build() });
  }
}

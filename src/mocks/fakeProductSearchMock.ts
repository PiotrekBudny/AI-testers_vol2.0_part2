import type { Page, Route } from '@playwright/test';
import { ProductSearchResponseBuilder } from '../builders/productSearchResponseBuilder';
import type { Product } from '../models/product';
import { apiRoutes } from './apiRoutes';

export class FakeProductSearchMock {
  products: Product[];

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

  private async fulfill(route: Route): Promise<void> {
    const params = new URL(route.request().url()).searchParams;
    const builder = new ProductSearchResponseBuilder()
      .withProducts(this.products)
      .withPageNumber(Number(params.get('page') ?? 0));
    const size = params.get('size');
    if (size !== null) {
      builder.withPageSize(Number(size));
    }
    await route.fulfill({ json: builder.build() });
  }
}

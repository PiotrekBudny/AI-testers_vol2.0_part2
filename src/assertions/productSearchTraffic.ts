import { expect, type Page, type Response } from '@playwright/test';
import type { Product } from '@/models/product';
import type { ProductSearchResponse } from '@/models/productSearchResponse';

const productSearchPath = '/api/v1/products/search';

export class ProductSearchTraffic {
  private readonly responses: Response[] = [];

  constructor(page: Page) {
    page.on('response', (response) => {
      if (
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === productSearchPath
      ) {
        this.responses.push(response);
      }
    });
  }

  async expectOkWithProducts(): Promise<ProductSearchResponse> {
    await expect
      .poll(() => this.responses.length, {
        message: `a GET ${productSearchPath} response`,
      })
      .toBeGreaterThan(0);
    const [response] = this.responses;
    expect(response?.status()).toBe(200);
    const body = (await response?.json()) as ProductSearchResponse;
    expect(body.content.length).toBeGreaterThan(0);
    return body;
  }

  async expectAnInStockProduct(): Promise<Product> {
    const { content } = await this.expectOkWithProducts();
    const inStock = content.find(({ stockQuantity }) => stockQuantity > 0);
    expect(inStock, 'an in-stock product in the real search').toBeDefined();
    return inStock as Product;
  }
}

import type { Page, Route } from '@playwright/test';
import type { Product, ProductDetails } from '@/models/product';
import { apiRoutes } from './apiRoutes';

export class FakeProductDetailsMock {
  product: Product;
  private otherProducts: () => Product[] = () => [];

  constructor(
    private readonly page: Page,
    product: Product,
  ) {
    this.product = product;
  }

  async register(): Promise<void> {
    await this.page.route(apiRoutes.productDetails, (route) =>
      this.fulfillDetails(route),
    );
    await this.page.route(apiRoutes.productReviews, (route) =>
      this.fulfillNoReviews(route),
    );
  }

  alsoServe(products: () => Product[]): void {
    this.otherProducts = products;
  }

  updateProduct(changes: Omit<Partial<Product>, 'id'>): Product {
    return Object.assign(this.product, changes);
  }

  private find(id: number): Product | undefined {
    return [this.product, ...this.otherProducts()].find(
      (candidate) => candidate.id === id,
    );
  }

  private async fulfillDetails(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const id = Number(
      new URL(route.request().url()).pathname.split('/').filter(Boolean).at(-1),
    );
    const product = this.find(id);
    if (product === undefined) {
      await route.fulfill({
        status: 404,
        json: { message: 'Product not found' },
      });
      return;
    }
    await route.fulfill({ json: toDetails(product) });
  }

  private async fulfillNoReviews(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/reviews/summary')) {
      await route.fulfill({
        json: {
          productId: this.product.id,
          averageRating: null,
          reviewCount: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
      });
      return;
    }
    if (pathname.endsWith('/reviews/mine')) {
      await route.fulfill({
        json: { canReview: true, reason: null, review: null },
      });
      return;
    }
    await route.fulfill({
      json: {
        content: [],
        pageNumber: 0,
        pageSize: 10,
        totalElements: 0,
        totalPages: 0,
      },
    });
  }
}

function toDetails({
  averageRating: _rating,
  reviewCount: _count,
  ...details
}: Product): ProductDetails {
  return details;
}

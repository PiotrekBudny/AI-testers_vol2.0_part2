import { expect, type Page } from '@playwright/test';
import { LivePatchedMock } from '@/mocks/support/livePatchedMock';
import type { ProductDetails } from '@/models/product';

export class LivePatchedProductDetailsMock extends LivePatchedMock<ProductDetails> {
  constructor(page: Page) {
    super(page, 'productDetails');
  }

  async patchStockQuantity(stockQuantity: number): Promise<void> {
    await this.register((realProduct) => ({ ...realProduct, stockQuantity }));
  }

  expectOnlyStockQuantityPatched(stockQuantity: number): void {
    expect(this.lastServed()).toEqual({ ...this.lastReal(), stockQuantity });
  }
}

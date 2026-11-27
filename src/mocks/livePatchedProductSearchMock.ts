import { expect, type Page } from '@playwright/test';
import type { Product } from '@/models/product';
import type { ProductSearchResponse } from '@/models/productSearchResponse';
import { LivePatchedMock } from './support/livePatchedMock';

export class LivePatchedProductSearchMock extends LivePatchedMock<ProductSearchResponse> {
  constructor(page: Page) {
    super(page, 'productSearch');
  }

  async patchFirstProduct(
    changes: Omit<Partial<Product>, 'id'>,
  ): Promise<void> {
    await this.register((realResponse) => {
      const [first, ...rest] = realResponse.content;
      if (!first) {
        throw new Error('The real search returned no products to patch');
      }
      return { ...realResponse, content: [{ ...first, ...changes }, ...rest] };
    });
  }

  expectOnlyFirstProductPatched(): void {
    const served = this.lastServed();
    const real = this.lastReal();
    expect(served.content[0]).not.toEqual(real.content[0]);
    expect(served.content.slice(1)).toEqual(real.content.slice(1));
  }
}

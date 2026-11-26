import { expect, type Page } from '@playwright/test';
import type { ProductSearchResponse } from '@/models/productSearchResponse';
import { LivePatchedMock, type LiveTransform } from './livePatchedMock';

export type ProductSearchTransform = LiveTransform<ProductSearchResponse>;

export class LivePatchedProductSearchMock extends LivePatchedMock<ProductSearchResponse> {
  constructor(page: Page) {
    super(page, 'productSearch');
  }

  expectOnlyFirstProductPatched(): void {
    const served = this.lastServed();
    const real = this.lastReal();
    expect(served.content[0]).not.toEqual(real.content[0]);
    expect(served.content.slice(1)).toEqual(real.content.slice(1));
  }
}

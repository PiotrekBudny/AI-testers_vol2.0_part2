import { expect, type Locator, type Page } from '@playwright/test';
import { formatUsd } from '@/formatters/price';
import type { Product } from '@/models/product';
import type { Locators } from '@/types/locators';

export class CheckoutItemRow {
  readonly root: Locator;
  readonly image: Locator;
  readonly texts: Locators<'name' | 'price' | 'quantity' | 'total'>;

  constructor(page: Page, productId: number) {
    this.root = page.getByTestId(`checkout-item-${productId}`);
    const testId = (part: string) =>
      this.root.getByTestId(`checkout-item-${part}-${productId}`);
    this.image = testId('image');
    this.texts = {
      name: testId('name'),
      price: testId('price'),
      quantity: testId('quantity'),
      total: testId('total'),
    };
  }

  async expectToShow(product: Product, quantity: number): Promise<void> {
    await expect(this.texts.name).toHaveText(product.name);
    await expect(this.texts.price).toHaveText(formatUsd(product.price));
    await expect(this.texts.quantity).toHaveText(String(quantity));
    await expect(this.texts.total).toHaveText(
      formatUsd(product.price * quantity),
    );
  }
}

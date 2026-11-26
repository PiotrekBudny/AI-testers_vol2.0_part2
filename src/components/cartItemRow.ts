import { expect, type Locator, type Page } from '@playwright/test';
import { formatUsd } from '@/formatters/price';
import type { Product } from '@/models/product';
import type { Locators } from '@/types/locators';

export class CartItemRow {
  readonly root: Locator;
  readonly image: Locator;
  readonly nameLink: Locator;
  readonly texts: Locators<'price' | 'quantity' | 'total'>;
  readonly buttons: Locators<'decrease' | 'increase' | 'update' | 'remove'>;

  constructor(page: Page, productId: number) {
    this.root = page.getByTestId(`cart-item-${productId}`);
    const testId = (part: string) =>
      this.root.getByTestId(`cart-item-${part}-${productId}`);
    this.image = testId('image');
    this.nameLink = testId('name');
    this.texts = {
      price: testId('price'),
      quantity: testId('quantity'),
      total: testId('total'),
    };
    this.buttons = {
      decrease: testId('decrease'),
      increase: testId('increase'),
      update: testId('update'),
      remove: testId('remove'),
    };
  }

  async changeQuantityWithoutSaving(
    current: number,
    target: number,
  ): Promise<void> {
    const button =
      target > current ? this.buttons.increase : this.buttons.decrease;
    for (let step = 0; step < Math.abs(target - current); step++) {
      await button.click();
    }
    await expect(this.texts.quantity).toHaveText(String(target));
  }

  async setQuantity(current: number, target: number): Promise<void> {
    if (target === current) {
      throw new Error(
        `setQuantity(${current}, ${target}) changes nothing: Update only appears when the quantity differs from the cart`,
      );
    }
    await this.changeQuantityWithoutSaving(current, target);
    await this.saveQuantity();
  }

  async saveQuantity(): Promise<void> {
    await this.buttons.update.click();
  }

  async expectUnsavedQuantity(quantity: number): Promise<void> {
    await expect(this.texts.quantity).toHaveText(String(quantity));
    await expect(this.buttons.update).toHaveText('Update');
    await expect(this.buttons.update).toBeEnabled();
  }

  async expectSavedQuantity(quantity: number): Promise<void> {
    await expect(this.texts.quantity).toHaveText(String(quantity));
    await expect(this.buttons.update).toBeHidden();
  }

  async expectQuantityLimits({
    atMinimum,
    atMaximum,
  }: {
    atMinimum: boolean;
    atMaximum: boolean;
  }): Promise<void> {
    await (atMinimum
      ? expect(this.buttons.decrease).toBeDisabled()
      : expect(this.buttons.decrease).toBeEnabled());
    await (atMaximum
      ? expect(this.buttons.increase).toBeDisabled()
      : expect(this.buttons.increase).toBeEnabled());
  }

  async remove(): Promise<void> {
    await this.buttons.remove.click();
  }

  async expectToShow(product: Product, quantity: number): Promise<void> {
    await expect(this.nameLink).toHaveText(product.name);
    await expect(this.texts.price).toHaveText(formatUsd(product.price));
    await expect(this.texts.quantity).toHaveText(String(quantity));
    await expect(this.texts.total).toHaveText(
      formatUsd(product.price * quantity),
    );
  }
}

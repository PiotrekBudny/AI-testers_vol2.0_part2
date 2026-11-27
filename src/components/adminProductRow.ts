import { expect, type Locator, type Page } from '@playwright/test';
import { formatUsd } from '@/formatters/price';
import type { ProductDetails } from '@/models/product';
import type { Locators } from '@/types/locators';

export class AdminProductRow {
  readonly root: Locator;
  readonly image: Locator;
  readonly editLink: Locator;
  readonly deleteButton: Locator;
  readonly texts: Locators<'name' | 'price' | 'stock' | 'category'>;

  constructor(page: Page, productId: number) {
    this.root = page.getByTestId(`admin-product-row-${productId}`);
    const testId = (part: string) =>
      this.root.getByTestId(`admin-product-${part}-${productId}`);
    this.image = testId('image');
    this.editLink = testId('edit');
    this.deleteButton = testId('delete');
    this.texts = {
      name: testId('name'),
      price: testId('price'),
      stock: testId('stock'),
      category: testId('category'),
    };
  }

  async delete(): Promise<void> {
    await this.deleteButton.click();
  }

  async forceDelete(): Promise<void> {
    await this.deleteButton.click({ force: true });
    await this.deleteButton.dispatchEvent('click');
  }

  async expectToShow(product: ProductDetails): Promise<void> {
    await expect(this.texts.name).toHaveText(product.name);
    await expect(this.texts.price).toHaveText(formatUsd(product.price));
    await expect(this.texts.stock).toHaveText(String(product.stockQuantity));
    await expect(this.texts.category).toHaveText(product.category);
    await expect(this.editLink).toHaveText('Edit');
    await expect(this.editLink).toHaveAttribute(
      'href',
      `/admin/products/edit/${product.id}`,
    );
    await this.expectImage(product.imageUrl);
    await this.expectReadyToDelete();
  }

  async expectReadyToDelete(): Promise<void> {
    await expect(this.deleteButton).toHaveText('Delete');
    await expect(this.deleteButton).toBeEnabled();
  }

  async expectDeleting(): Promise<void> {
    await expect(this.deleteButton).toHaveText('Deleting...');
    await expect(this.deleteButton).toBeDisabled();
  }

  private async expectImage(imageUrl: string | null): Promise<void> {
    if (imageUrl === null) {
      await expect(this.image).toHaveCount(0);
      return;
    }
    await expect(this.image).toHaveAttribute('src', imageUrl);
  }
}

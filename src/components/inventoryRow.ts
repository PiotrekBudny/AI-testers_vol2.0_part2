import { expect, type Locator, type Page } from '@playwright/test';
import type { InventoryItem } from '@/models/inventory';
import { STOCK_STATUS_LABELS } from './inventoryLabels';

export class InventoryRow {
  readonly root: Locator;
  readonly link: Locator;
  readonly cells: Locator;

  constructor(
    page: Page,
    private readonly productId: number,
  ) {
    this.root = page.getByTestId(`inventory-row-${productId}`);
    this.link = this.root.getByTestId(`inventory-row-link-${productId}`);
    this.cells = this.root.getByRole('cell');
  }

  async open(): Promise<void> {
    await this.link.click();
  }

  async expectToShow(item: InventoryItem): Promise<void> {
    await expect(this.link).toHaveText(item.name);
    await expect(this.link).toHaveAttribute(
      'href',
      `/admin/inventory/${this.productId}`,
    );
    await expect(this.cells).toHaveText([
      item.name,
      item.category,
      String(item.availableQuantity),
      STOCK_STATUS_LABELS[item.stockStatus],
    ]);
  }
}

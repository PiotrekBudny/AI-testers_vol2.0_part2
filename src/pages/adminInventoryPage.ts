import { expect, type Locator, type Page } from '@playwright/test';
import { AdminSectionNav } from '@/components/adminSectionNav';
import { InventoryInspector } from '@/components/inventoryInspector';
import { InventoryRow } from '@/components/inventoryRow';
import { LOAD_ERROR_TIMEOUT_MS } from '@/config/timing';
import type { InventoryItem, StockStatus } from '@/models/inventory';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

export class AdminInventoryPage extends BasePage {
  readonly url = '/admin/inventory';
  readonly title = 'Inventory – Awesome Testing';

  readonly sectionNav: AdminSectionNav;
  readonly inspector: InventoryInspector;
  readonly resultCount: Locator;
  readonly statusSelect: Locator;
  readonly rows: Locator;
  readonly pageIndicator: Locator;

  readonly inputs: Locators<'search' | 'category' | 'threshold'>;
  readonly buttons: Locators<'previous' | 'next'>;
  readonly listStates: Locators<'empty' | 'loading' | 'error'>;

  constructor(page: Page) {
    super(page);

    this.sectionNav = new AdminSectionNav(page);
    this.inspector = new InventoryInspector(page);
    this.resultCount = page.getByTestId('inventory-result-count');
    this.statusSelect = page.getByTestId('inventory-status');
    this.rows = page.getByTestId(/^inventory-row-\d+$/);
    this.pageIndicator = page.getByTestId('inventory-page-indicator');
    this.inputs = {
      search: page.getByTestId('inventory-search'),
      category: page.getByTestId('inventory-category'),
      threshold: page.getByTestId('inventory-threshold'),
    };
    this.buttons = {
      previous: page.getByTestId('inventory-previous-page'),
      next: page.getByTestId('inventory-next-page'),
    };
    this.listStates = {
      empty: page.getByTestId('inventory-empty'),
      loading: page.getByTestId('inventory-list-loading'),
      error: page.getByTestId('inventory-list-error'),
    };
  }

  item(productId: number): InventoryRow {
    return new InventoryRow(this.page, productId);
  }

  async openItem(productId: number): Promise<void> {
    await this.page.goto(this.itemPath(productId));
  }

  async selectItem(productId: number): Promise<void> {
    await this.item(productId).open();
  }

  async search(text: string): Promise<void> {
    await this.inputs.search.fill(text);
  }

  async filterByCategory(category: string): Promise<void> {
    await this.inputs.category.fill(category);
  }

  async filterByStatus(status: StockStatus): Promise<void> {
    await this.statusSelect.selectOption(status);
  }

  async setLowStockThreshold(threshold: number): Promise<void> {
    await this.inputs.threshold.fill(String(threshold));
  }

  async goToNextPage(): Promise<void> {
    await this.buttons.next.click();
  }

  async expectItemOpen(productId: number): Promise<void> {
    await expect(this.page).toHaveURL(
      (url) => url.pathname === this.itemPath(productId),
    );
    await expect(this.page).toHaveTitle(this.title);
  }

  async expectItems(items: InventoryItem[]): Promise<void> {
    await expect(this.rows).toHaveCount(items.length);
    for (const [index, item] of items.entries()) {
      await expect(this.rows.nth(index)).toHaveAttribute(
        'data-testid',
        `inventory-row-${item.productId}`,
      );
      await this.item(item.productId).expectToShow(item);
    }
  }

  async expectResultCount(count: number): Promise<void> {
    await expect(this.resultCount).toHaveText(`${count} products`);
  }

  async expectPage(current: number, total: number): Promise<void> {
    await expect(this.pageIndicator).toHaveText(`Page ${current} of ${total}`);
    await expect(this.buttons.previous).toBeEnabled({ enabled: current > 1 });
    await expect(this.buttons.next).toBeEnabled({ enabled: current < total });
  }

  async expectNoMatches(): Promise<void> {
    await expect(this.listStates.empty).toHaveText(
      'No inventory matches these filters.',
    );
    await expect(this.rows).toHaveCount(0);
    await this.expectResultCount(0);
    await this.expectPage(0, 0);
  }

  async expectListLoading(): Promise<void> {
    await expect(this.listStates.loading).toHaveText('Loading inventory…');
    await expect(this.listStates.error).toBeHidden();
  }

  async expectListError(): Promise<void> {
    await expect(this.listStates.error).toHaveText(
      'Unable to load inventory. Try again shortly.',
      { timeout: LOAD_ERROR_TIMEOUT_MS },
    );
    await expect(this.listStates.error).toHaveAttribute('role', 'alert');
    await expect(this.listStates.loading).toBeHidden();
    await expect(this.rows).toHaveCount(0);
  }

  private itemPath(productId: number): string {
    return `${this.url}/${productId}`;
  }
}

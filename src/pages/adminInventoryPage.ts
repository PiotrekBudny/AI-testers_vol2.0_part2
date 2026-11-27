import type { Page } from '@playwright/test';
import { BasePage } from './basePage';

export class AdminInventoryPage extends BasePage {
  readonly url = '/admin/inventory';
  readonly title = 'Inventory – Awesome Testing';

  constructor(page: Page) {
    super(page);
  }
}

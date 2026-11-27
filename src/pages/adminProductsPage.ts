import type { Page } from '@playwright/test';
import { BasePage } from './basePage';

export class AdminProductsPage extends BasePage {
  readonly url = '/admin/products';
  readonly title = 'Manage Products – Awesome Testing';

  constructor(page: Page) {
    super(page);
  }
}

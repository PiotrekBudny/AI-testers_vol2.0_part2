import type { Page } from '@playwright/test';
import { BasePage } from './basePage';

export class AdminOrdersPage extends BasePage {
  readonly url = '/admin/orders';
  readonly title = 'Manage Orders – Awesome Testing';

  constructor(page: Page) {
    super(page);
  }
}

import type { Page } from '@playwright/test';
import { BasePage } from './basePage';

export class AdminDashboardPage extends BasePage {
  readonly url = '/admin';
  readonly title = 'Admin Dashboard – Awesome Testing';

  constructor(page: Page) {
    super(page);
  }
}

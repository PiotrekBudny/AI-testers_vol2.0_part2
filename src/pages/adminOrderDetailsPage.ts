import type { Page } from '@playwright/test';
import { BasePage } from './basePage';

export class AdminOrderDetailsPage extends BasePage {
  readonly title = 'Order details – Awesome Testing';
  private orderId: number | undefined;

  constructor(page: Page) {
    super(page);
  }

  get url(): string {
    if (this.orderId === undefined) {
      throw new Error('Call open(orderId) first');
    }
    return `/orders/${this.orderId}`;
  }

  async open(orderId: number): Promise<void> {
    this.orderId = orderId;
    await this.goto();
  }
}

import { expect, type Locator, type Page } from '@playwright/test';
import { formatUsd } from '@/formatters/price';
import type { Order } from '@/models/order';
import type { Locators } from '@/types/locators';

export class AdminOrderRow {
  readonly root: Locator;
  readonly detailsLink: Locator;
  readonly texts: Locators<'id' | 'customer' | 'amount' | 'status'>;

  constructor(page: Page, orderId: number) {
    this.root = page.getByTestId(`admin-order-row-${orderId}`);
    const testId = (part: string) =>
      this.root.getByTestId(`admin-order-${part}-${orderId}`);
    this.detailsLink = testId('details');
    this.texts = {
      id: testId('id'),
      customer: testId('customer'),
      amount: testId('amount'),
      status: testId('status'),
    };
  }

  async openDetails(): Promise<void> {
    await this.detailsLink.click();
  }

  async expectToShow(order: Order): Promise<void> {
    await expect(this.texts.id).toHaveText(`#${order.id}`);
    await expect(this.texts.customer).toHaveText(order.username);
    await expect(this.texts.amount).toHaveText(formatUsd(order.totalAmount));
    await expect(this.texts.status).toHaveText(order.status);
    await expect(this.detailsLink).toHaveText('View Details');
    await expect(this.detailsLink).toHaveAttribute(
      'href',
      `/orders/${order.id}`,
    );
  }
}

import { expect, type Locator, type Page } from '@playwright/test';
import { formatUsd } from '@/formatters/price';
import type { Order } from '@/models/order';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

export class PaymentPage extends BasePage {
  readonly title = 'Pay for order – Awesome Testing';
  private orderId: number | undefined;

  readonly heading: Locator;
  readonly texts: Locators<'total' | 'vatLabel' | 'vat'>;

  constructor(page: Page) {
    super(page);

    this.heading = page.getByTestId('payment-title');
    this.texts = {
      total: page.getByTestId('payment-order-total'),
      vatLabel: page.getByTestId('payment-order-vat-label'),
      vat: page.getByTestId('payment-order-vat'),
    };
  }

  get url(): string {
    if (this.orderId === undefined) {
      throw new Error('Call expectToShowOrder(order) first');
    }
    return `/orders/${this.orderId}/pay`;
  }

  async expectToShowOrder(order: Order): Promise<void> {
    this.orderId = order.id;
    await this.expectToBeOpen();
    await expect(this.heading).toHaveText(`Pay for order #${order.id}`);
    await expect(this.texts.total).toHaveText(formatUsd(order.totalAmount));
    if (order.taxRate === null || order.taxAmount === null) {
      await expect(this.texts.vatLabel).toBeHidden();
      await expect(this.texts.vat).toBeHidden();
      return;
    }
    await expect(this.texts.vatLabel).toHaveText(
      `incl. VAT ${order.taxRate}% (${order.taxCountry})`,
    );
    await expect(this.texts.vat).toHaveText(formatUsd(order.taxAmount));
  }
}

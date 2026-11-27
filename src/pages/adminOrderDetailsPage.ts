import { expect, type Locator, type Page } from '@playwright/test';
import { formatUsd } from '@/formatters/price';
import type { Order, OrderStatus } from '@/models/order';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

const UPDATE_FAILED_MESSAGE =
  'Failed to update order status. Please try again.';

const CANCEL_WARNING =
  'Are you sure you want to cancel this order? Reserved items go back into stock.';

export class AdminOrderDetailsPage extends BasePage {
  readonly title = 'Order details – Awesome Testing';
  private orderId: number | undefined;

  readonly heading: Locator;
  readonly statusBadge: Locator;
  readonly totalAmount: Locator;
  readonly statusSelect: Locator;
  readonly cancelDialog: Locator;
  readonly dialogTexts: Locators<'title' | 'description'>;
  readonly buttons: Locators<
    'update' | 'cancel' | 'expireReservation' | 'keepOrder' | 'confirmCancel'
  >;

  constructor(page: Page) {
    super(page);

    this.heading = page.getByTestId('order-details-title');
    this.statusBadge = page.getByTestId('order-details-status');
    this.totalAmount = page.getByTestId('order-details-total-amount');
    this.statusSelect = page.getByTestId('order-details-status-select');
    this.cancelDialog = page.getByTestId('order-cancel-dialog');
    this.dialogTexts = {
      title: this.cancelDialog.getByTestId('order-cancel-dialog-title'),
      description: this.cancelDialog.getByTestId(
        'order-cancel-dialog-description',
      ),
    };
    this.buttons = {
      update: page.getByTestId('order-details-update-status-button'),
      cancel: page.getByTestId('order-details-cancel-button'),
      expireReservation: page.getByTestId('order-details-expire-reservation'),
      keepOrder: this.cancelDialog.getByTestId('order-cancel-dialog-keep'),
      confirmCancel: this.cancelDialog.getByTestId(
        'order-cancel-dialog-confirm',
      ),
    };
  }

  get url(): string {
    if (this.orderId === undefined) {
      throw new Error('Call open(orderId) or expectToShowOrder(order) first');
    }
    return `/orders/${this.orderId}`;
  }

  async open(orderId: number): Promise<void> {
    this.orderId = orderId;
    await this.goto();
  }

  async chooseStatus(status: OrderStatus): Promise<void> {
    await this.statusSelect.selectOption(status);
  }

  async updateStatus(): Promise<void> {
    await this.buttons.update.click();
  }

  async forceUpdateStatus(): Promise<void> {
    await this.buttons.update.click({ force: true });
    await this.buttons.update.dispatchEvent('click');
  }

  async askToCancel(): Promise<void> {
    await this.buttons.cancel.click();
  }

  async keepOrder(): Promise<void> {
    await this.buttons.keepOrder.click();
  }

  async confirmCancel(): Promise<void> {
    await this.buttons.confirmCancel.click();
  }

  async expectToShowOrder(order: Order): Promise<void> {
    this.orderId = order.id;
    await this.expectToBeOpen();
    await expect(this.heading).toHaveText(`Order #${order.id}`);
    await expect(this.totalAmount).toHaveText(formatUsd(order.totalAmount));
    await this.expectStatus(order.status);
  }

  async expectStatus(status: OrderStatus): Promise<void> {
    await expect(this.statusBadge).toHaveText(status);
  }

  async expectNothingToUpdate(currentStatus: OrderStatus): Promise<void> {
    await expect(this.statusSelect).toHaveValue(currentStatus);
    await expect(this.statusSelect).toBeEnabled();
    await expect(this.buttons.update).toHaveText('Update');
    await expect(this.buttons.update).toBeDisabled();
  }

  async expectReadyToUpdate(chosenStatus: OrderStatus): Promise<void> {
    await expect(this.statusSelect).toHaveValue(chosenStatus);
    await expect(this.statusSelect).toBeEnabled();
    await expect(this.buttons.update).toHaveText('Update');
    await expect(this.buttons.update).toBeEnabled();
  }

  async expectUpdating(chosenStatus: OrderStatus): Promise<void> {
    await expect(this.buttons.update).toHaveText('Updating...');
    await expect(this.buttons.update).toBeDisabled();
    await expect(this.statusSelect).toHaveValue(chosenStatus);
    await expect(this.statusSelect).toBeDisabled();
  }

  async expectPendingOnlyActions(): Promise<void> {
    await expect(this.buttons.cancel).toBeVisible();
    await expect(this.buttons.expireReservation).toBeVisible();
  }

  async expectNoPendingOnlyActions(): Promise<void> {
    await expect(this.statusSelect).toBeVisible();
    await expect(this.buttons.cancel).toBeHidden();
    await expect(this.buttons.expireReservation).toBeHidden();
  }

  async expectCancelConfirmationAsked(orderId: number): Promise<void> {
    await expect(this.dialogTexts.title).toHaveText(
      `Cancel order #${orderId}?`,
    );
    await expect(this.dialogTexts.description).toHaveText(CANCEL_WARNING);
    await expect(this.buttons.keepOrder).toHaveText('Keep order');
    await expect(this.buttons.confirmCancel).toHaveText('Cancel order');
  }

  async expectCancelDialogClosed(): Promise<void> {
    await expect(this.cancelDialog).toBeHidden();
  }

  async expectStatusUpdateConfirmed(status: OrderStatus): Promise<void> {
    await this.toast.expectToShow(
      'Status Updated',
      `Order status has been updated to ${status}.`,
    );
  }

  async expectStatusUpdateFailed(): Promise<void> {
    await this.toast.expectToShow('Error', UPDATE_FAILED_MESSAGE);
  }

  async expectCancellationConfirmed(orderId: number): Promise<void> {
    await this.toast.expectToShow(
      'Order Cancelled',
      `Order #${orderId} has been cancelled successfully.`,
    );
  }
}

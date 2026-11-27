import { expect, type Locator, type Page } from '@playwright/test';
import { AdminOrderRow } from '@/components/adminOrderRow';
import { AdminSectionNav } from '@/components/adminSectionNav';
import { LOAD_ERROR_TIMEOUT_MS } from '@/config/timing';
import type { Order, OrderStatus } from '@/models/order';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

export type OrderStatusFilter = OrderStatus | 'ALL';

export class AdminOrdersPage extends BasePage {
  readonly url = '/admin/orders';
  readonly title = 'Manage Orders – Awesome Testing';

  readonly sectionNav: AdminSectionNav;
  readonly heading: Locator;
  readonly statusFilter: Locator;
  readonly paginationInfo: Locator;
  readonly rows: Locator;
  readonly emptyState: Locator;
  readonly loadError: Locator;
  readonly buttons: Locators<'previous' | 'next'>;

  constructor(page: Page) {
    super(page);

    this.sectionNav = new AdminSectionNav(page);
    this.heading = page.getByTestId('admin-order-list-title');
    this.statusFilter = page.getByTestId('admin-order-list-status-filter');
    this.paginationInfo = page.getByTestId('admin-order-list-pagination-info');
    this.rows = page.getByTestId(/^admin-order-row-\d+$/);
    this.emptyState = page.getByTestId('admin-order-list-empty');
    this.loadError = page.getByTestId('admin-order-list-error');
    this.buttons = {
      previous: page.getByTestId('admin-order-list-prev-page'),
      next: page.getByTestId('admin-order-list-next-page'),
    };
  }

  order(orderId: number): AdminOrderRow {
    return new AdminOrderRow(this.page, orderId);
  }

  async filterByStatus(status: OrderStatusFilter): Promise<void> {
    await this.statusFilter.selectOption(status);
  }

  async goToNextPage(): Promise<void> {
    await this.buttons.next.click();
  }

  async expectToShowOrders(orders: Order[]): Promise<void> {
    await expect(this.heading).toHaveText('Manage Orders');
    await expect(this.rows).toHaveCount(orders.length);
    for (const [index, order] of orders.entries()) {
      await expect(this.rows.nth(index)).toHaveAttribute(
        'data-testid',
        `admin-order-row-${order.id}`,
      );
      await this.order(order.id).expectToShow(order);
    }
    await expect(this.emptyState).toBeHidden();
    await expect(this.loadError).toBeHidden();
  }

  async expectPagination(current: number, total: number): Promise<void> {
    await expect(this.paginationInfo).toHaveText(`Page ${current} of ${total}`);
    await expect(this.buttons.previous).toBeEnabled({ enabled: current > 1 });
    await expect(this.buttons.next).toBeEnabled({ enabled: current < total });
  }

  async expectNoOrders(): Promise<void> {
    await expect(this.emptyState).toContainText('No orders found');
    await expect(this.rows).toHaveCount(0);
    await expect(this.loadError).toBeHidden();
  }

  async expectLoadError(): Promise<void> {
    await expect(this.loadError).toContainText('Error loading orders', {
      timeout: LOAD_ERROR_TIMEOUT_MS,
    });
    await expect(this.rows).toHaveCount(0);
    await expect(this.emptyState).toBeHidden();
  }
}

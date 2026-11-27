import { expect, type Locator, type Page } from '@playwright/test';
import { AdminSectionNav } from '@/components/adminSectionNav';
import { LOAD_ERROR_TIMEOUT_MS } from '@/config/timing';
import { formatUsd } from '@/formatters/price';
import type { Order } from '@/models/order';
import type { ProductDetails } from '@/models/product';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

const UNAVAILABLE_METRIC = '—';

const MESSAGES = {
  ordersError: 'Order data could not be loaded. Order metrics are unavailable.',
  productsError:
    'Product data could not be loaded. Product metrics are unavailable.',
  ordersUnavailable: 'Orders are unavailable.',
  lowStockUnavailable: 'Stock levels are unavailable.',
  noOrders: 'No orders found',
  noLowStock: 'No low stock products',
} as const;

type Source = 'orders' | 'products';

type CardLink =
  | 'products'
  | 'orders'
  | 'pending'
  | 'viewAllOrders'
  | 'manageInventory';

type OrderMetrics = {
  orders: number;
  pending: number;
  revenue: number;
};

export class AdminDashboardPage extends BasePage {
  readonly url = '/admin';
  readonly title = 'Admin Dashboard – Awesome Testing';

  readonly sectionNav: AdminSectionNav;
  readonly heading: Locator;
  readonly counts: Locators<'products' | 'orders' | 'pending'>;
  readonly revenue: Locator;
  readonly links: Locators<CardLink>;
  readonly errors: Locators<Source>;
  readonly retryButtons: Locators<Source>;
  readonly unavailableTexts: Locators<'orders' | 'lowStock'>;
  readonly emptyTexts: Locators<'orders' | 'lowStock'>;
  readonly rows: Locators<'recentOrders' | 'lowStock'>;

  constructor(page: Page) {
    super(page);

    this.sectionNav = new AdminSectionNav(page);
    this.heading = page.getByTestId('admin-dashboard-title');
    this.counts = {
      products: page.getByTestId('admin-dashboard-products-count'),
      orders: page.getByTestId('admin-dashboard-orders-count'),
      pending: page.getByTestId('admin-dashboard-pending-count'),
    };
    this.revenue = page.getByTestId('admin-dashboard-revenue-amount');
    this.links = {
      products: page.getByTestId('admin-dashboard-products-link'),
      orders: page.getByTestId('admin-dashboard-orders-link'),
      pending: page.getByTestId('admin-dashboard-pending-link'),
      viewAllOrders: page.getByTestId('admin-dashboard-view-all-orders'),
      manageInventory: page.getByTestId('admin-dashboard-manage-inventory'),
    };
    this.errors = {
      orders: page.getByTestId('admin-dashboard-orders-error'),
      products: page.getByTestId('admin-dashboard-products-error'),
    };
    this.retryButtons = {
      orders: page.getByTestId('admin-dashboard-orders-error-retry'),
      products: page.getByTestId('admin-dashboard-products-error-retry'),
    };
    this.unavailableTexts = {
      orders: page.getByTestId('admin-dashboard-orders-unavailable'),
      lowStock: page.getByTestId('admin-dashboard-low-stock-unavailable'),
    };
    this.emptyTexts = {
      orders: page.getByTestId('admin-dashboard-no-orders'),
      lowStock: page.getByTestId('admin-dashboard-no-low-stock'),
    };
    this.rows = {
      recentOrders: page.getByTestId(/^admin-dashboard-order-\d+$/),
      lowStock: page.getByTestId(/^admin-dashboard-product-\d+$/),
    };
  }

  async retryLoading(source: Source): Promise<void> {
    await this.retryButtons[source].click();
  }

  async expectToShowDashboard(): Promise<void> {
    await this.expectToBeOpen();
    await expect(this.heading).toHaveText('Admin Dashboard');
  }

  async expectProductsCount(count: number): Promise<void> {
    await expect(this.counts.products).toHaveText(String(count));
  }

  async expectOrderMetrics({
    orders,
    pending,
    revenue,
  }: OrderMetrics): Promise<void> {
    await expect(this.counts.orders).toHaveText(String(orders));
    await expect(this.counts.pending).toHaveText(String(pending));
    await expect(this.revenue).toHaveText(formatUsd(revenue));
  }

  async expectRecentOrders(orders: Order[]): Promise<void> {
    await expect(this.rows.recentOrders).toHaveCount(orders.length);
    for (const [index, order] of orders.entries()) {
      await expect(this.rows.recentOrders.nth(index)).toHaveAttribute(
        'data-testid',
        `admin-dashboard-order-${order.id}`,
      );
      await expect(this.orderCell('id', order.id)).toHaveText(
        `Order #${order.id}`,
      );
      await expect(this.orderCell('amount', order.id)).toHaveText(
        formatUsd(order.totalAmount),
      );
      await expect(this.orderCell('status', order.id)).toHaveText(order.status);
    }
    await expect(this.emptyTexts.orders).toBeHidden();
  }

  async expectLowStockProducts(products: ProductDetails[]): Promise<void> {
    await expect(this.rows.lowStock).toHaveCount(products.length);
    for (const [index, product] of products.entries()) {
      await expect(this.rows.lowStock.nth(index)).toHaveAttribute(
        'data-testid',
        `admin-dashboard-product-${product.id}`,
      );
      await expect(this.productCell('name', product.id)).toHaveText(
        product.name,
      );
      await expect(this.productCell('price', product.id)).toHaveText(
        formatUsd(product.price),
      );
      await expect(this.productCell('stock', product.id)).toHaveText(
        `${product.stockQuantity} in stock`,
      );
      const update = this.productCell('update', product.id);
      await expect(update).toHaveText('Update');
      await expect(update).toHaveAttribute(
        'href',
        `/admin/products/edit/${product.id}`,
      );
    }
    await expect(this.emptyTexts.lowStock).toBeHidden();
  }

  async expectEmptyShop(): Promise<void> {
    await this.expectProductsCount(0);
    await this.expectOrderMetrics({ orders: 0, pending: 0, revenue: 0 });
    await expect(this.emptyTexts.orders).toHaveText(MESSAGES.noOrders);
    await expect(this.emptyTexts.lowStock).toHaveText(MESSAGES.noLowStock);
    await expect(this.rows.recentOrders).toHaveCount(0);
    await expect(this.rows.lowStock).toHaveCount(0);
    await this.expectNoLoadErrors();
  }

  async expectOrdersLoadError(): Promise<void> {
    await this.expectLoadErrorBox('orders', MESSAGES.ordersError);
    await expect(this.counts.orders).toHaveText(UNAVAILABLE_METRIC);
    await expect(this.counts.pending).toHaveText(UNAVAILABLE_METRIC);
    await expect(this.revenue).toHaveText(UNAVAILABLE_METRIC);
    await expect(this.unavailableTexts.orders).toHaveText(
      MESSAGES.ordersUnavailable,
    );
    await expect(this.rows.recentOrders).toHaveCount(0);
    await expect(this.emptyTexts.orders).toBeHidden();
    await expect(this.errors.products).toBeHidden();
    await expect(this.unavailableTexts.lowStock).toBeHidden();
  }

  async expectProductsLoadError(): Promise<void> {
    await this.expectLoadErrorBox('products', MESSAGES.productsError);
    await expect(this.counts.products).toHaveText(UNAVAILABLE_METRIC);
    await expect(this.unavailableTexts.lowStock).toHaveText(
      MESSAGES.lowStockUnavailable,
    );
    await expect(this.rows.lowStock).toHaveCount(0);
    await expect(this.emptyTexts.lowStock).toBeHidden();
    await expect(this.errors.orders).toBeHidden();
    await expect(this.unavailableTexts.orders).toBeHidden();
  }

  async expectNoLoadErrors(): Promise<void> {
    await expect(this.errors.orders).toBeHidden();
    await expect(this.errors.products).toBeHidden();
    await expect(this.unavailableTexts.orders).toBeHidden();
    await expect(this.unavailableTexts.lowStock).toBeHidden();
  }

  async expectCardLinks(): Promise<void> {
    const paths: Record<CardLink, string> = {
      products: '/admin/products',
      orders: '/admin/orders',
      pending: '/admin/orders',
      viewAllOrders: '/admin/orders',
      manageInventory: '/admin/inventory',
    };
    for (const [name, path] of Object.entries(paths)) {
      await expect(this.links[name as CardLink]).toHaveAttribute('href', path);
    }
  }

  private async expectLoadErrorBox(
    source: Source,
    message: string,
  ): Promise<void> {
    const error = this.errors[source];
    await expect(error).toContainText(message, {
      timeout: LOAD_ERROR_TIMEOUT_MS,
    });
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(this.retryButtons[source]).toHaveText('Try again');
  }

  private orderCell(
    part: 'id' | 'amount' | 'status',
    orderId: number,
  ): Locator {
    return this.page.getByTestId(`admin-dashboard-order-${part}-${orderId}`);
  }

  private productCell(
    part: 'name' | 'price' | 'stock' | 'update',
    productId: number,
  ): Locator {
    return this.page.getByTestId(
      `admin-dashboard-product-${part}-${productId}`,
    );
  }
}

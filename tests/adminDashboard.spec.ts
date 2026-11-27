import {
  NO_MORE_REQUESTS_WINDOW_MS,
  SERVER_ERROR_ATTEMPTS,
} from '@/config/timing';
import { test } from '@/fixtures/test';
import { ShopDataGenerator } from '@/generators/shopDataGenerator';
import { fixedTimestamp } from '@/generators/timestamps';
import type { AdminCatalogMock } from '@/mocks/adminCatalogMock';
import type { AdminOrdersMock } from '@/mocks/adminOrdersMock';

function seedSmallShop(
  adminCatalogMock: AdminCatalogMock,
  adminOrdersMock: AdminOrdersMock,
) {
  const data = new ShopDataGenerator();
  const lowStock = data.product(90_001, { stockQuantity: 2 });
  const stocked = data.product(90_002, { stockQuantity: 40 });
  const older = data.order(90_001, {
    status: 'PAID',
    totalAmount: 120,
    createdAt: fixedTimestamp(1),
  });
  const newer = data.order(90_002, {
    status: 'PENDING',
    totalAmount: 80,
    createdAt: fixedTimestamp(2),
  });
  adminCatalogMock.seed([lowStock, stocked]);
  adminOrdersMock.seed([older, newer]);
  return {
    productsCount: 2,
    lowStockProducts: [lowStock],
    orderMetrics: { orders: 2, pending: 1, revenue: 200 },
    recentOrders: [newer, older],
  };
}

test.use({ userRole: 'admin' });

test.describe('Admin dashboard', {
  tag: ['@admin-dashboard', '@mocked'],
}, () => {
  test('metrics and recent orders cover every page of orders', async ({
    adminDashboardPage,
    adminCatalogMock: _adminCatalogMock,
    adminOrdersMock,
  }) => {
    const data = new ShopDataGenerator();
    const third = data.order(90_001, {
      status: 'PAID',
      totalAmount: 100,
      createdAt: fixedTimestamp(3),
    });
    const seventh = data.order(90_002, {
      status: 'PENDING',
      totalAmount: 10,
      createdAt: fixedTimestamp(1),
    });
    const second = data.order(90_003, {
      status: 'SHIPPED',
      totalAmount: 200,
      createdAt: fixedTimestamp(6),
    });
    const sixth = data.order(90_004, {
      status: 'DELIVERED',
      totalAmount: 300,
      createdAt: fixedTimestamp(2),
    });
    const newest = data.order(90_005, {
      status: 'PENDING',
      totalAmount: 400,
      createdAt: fixedTimestamp(7),
    });
    const cancelled = data.order(90_006, {
      status: 'CANCELLED',
      totalAmount: 5000,
      createdAt: fixedTimestamp(5),
    });
    const fourth = data.order(90_007, {
      status: 'PENDING',
      totalAmount: 25.5,
      createdAt: fixedTimestamp(4),
    });
    adminOrdersMock.pageSize = 4;
    adminOrdersMock.seed([
      third,
      seventh,
      second,
      sixth,
      newest,
      cancelled,
      fourth,
    ]);

    await adminDashboardPage.goto();

    await adminDashboardPage.expectToShowDashboard();
    await adminDashboardPage.expectOrderMetrics({
      orders: 7,
      pending: 3,
      revenue: 1035.5,
    });
    await adminDashboardPage.expectRecentOrders([
      newest,
      second,
      cancelled,
      fourth,
      third,
    ]);
    await adminOrdersMock.expectListQueriesToStay(
      [
        { page: 0, size: 50, status: null },
        { page: 1, size: 50, status: null },
      ],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('low stock lists only products with fewer than 5 units', async ({
    adminDashboardPage,
    adminCatalogMock,
    adminOrdersMock: _adminOrdersMock,
  }) => {
    const data = new ShopDataGenerator();
    const four = data.product(90_001, { stockQuantity: 4 });
    const five = data.product(90_002, { stockQuantity: 5 });
    const none = data.product(90_003, { stockQuantity: 0 });
    adminCatalogMock.seed([four, five, none]);

    await adminDashboardPage.goto();

    await adminDashboardPage.expectProductsCount(3);
    await adminDashboardPage.expectLowStockProducts([four, none]);
  });

  test('an empty shop shows zeros and empty lists', async ({
    adminDashboardPage,
    adminCatalogMock,
    adminOrdersMock,
  }) => {
    await adminDashboardPage.goto();
    await adminCatalogMock.waitForListReads(1);
    await adminOrdersMock.expectLastListQuery({ page: 0, size: 50 });

    await adminDashboardPage.expectToShowDashboard();
    await adminDashboardPage.expectEmptyShop();
  });

  test('a failed orders read keeps product metrics and can be retried', {
    tag: '@negative',
  }, async ({
    adminDashboardPage,
    adminCatalogMock,
    adminOrdersMock,
    apiErrorMock,
  }) => {
    const shop = seedSmallShop(adminCatalogMock, adminOrdersMock);
    await apiErrorMock.respondWithError('adminOrders', 500, {
      times: SERVER_ERROR_ATTEMPTS,
    });

    await adminDashboardPage.goto();

    await adminDashboardPage.expectOrdersLoadError();
    await adminDashboardPage.expectProductsCount(shop.productsCount);
    await adminDashboardPage.expectLowStockProducts(shop.lowStockProducts);
    await apiErrorMock.expectRequestCountToStay(
      'adminOrders',
      SERVER_ERROR_ATTEMPTS,
      NO_MORE_REQUESTS_WINDOW_MS,
    );

    await adminDashboardPage.retryLoading('orders');

    await adminDashboardPage.expectOrderMetrics(shop.orderMetrics);
    await adminDashboardPage.expectRecentOrders(shop.recentOrders);
    await adminDashboardPage.expectNoLoadErrors();
  });

  test('a failed products read keeps order metrics and can be retried', {
    tag: '@negative',
  }, async ({
    adminDashboardPage,
    adminCatalogMock,
    adminOrdersMock,
    apiErrorMock,
  }) => {
    const shop = seedSmallShop(adminCatalogMock, adminOrdersMock);
    await apiErrorMock.respondWithError('productList', 500, {
      times: SERVER_ERROR_ATTEMPTS,
    });

    await adminDashboardPage.goto();

    await adminDashboardPage.expectProductsLoadError();
    await adminDashboardPage.expectOrderMetrics(shop.orderMetrics);
    await adminDashboardPage.expectRecentOrders(shop.recentOrders);
    await apiErrorMock.expectRequestCountToStay(
      'productList',
      SERVER_ERROR_ATTEMPTS,
      NO_MORE_REQUESTS_WINDOW_MS,
    );

    await adminDashboardPage.retryLoading('products');

    await adminDashboardPage.expectProductsCount(shop.productsCount);
    await adminDashboardPage.expectLowStockProducts(shop.lowStockProducts);
    await adminDashboardPage.expectNoLoadErrors();
  });

  test('section tabs and card links lead to the admin areas', async ({
    adminDashboardPage,
    adminCatalogMock,
    adminOrdersMock,
  }) => {
    seedSmallShop(adminCatalogMock, adminOrdersMock);

    await adminDashboardPage.goto();

    await adminDashboardPage.expectToShowDashboard();
    await adminDashboardPage.sectionNav.expectLinks();
    await adminDashboardPage.expectCardLinks();
  });
});

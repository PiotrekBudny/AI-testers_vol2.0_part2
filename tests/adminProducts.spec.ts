import {
  NO_MORE_REQUESTS_WINDOW_MS,
  SERVER_ERROR_ATTEMPTS,
} from '@/config/timing';
import { test } from '@/fixtures/test';
import { AdminDataGenerator } from '@/generators/adminDataGenerator';
import type { AdminCatalogMock } from '@/mocks/adminCatalogMock';

function seedTwoProducts(adminCatalogMock: AdminCatalogMock) {
  const data = new AdminDataGenerator();
  const first = data.product(90_001, { stockQuantity: 12 });
  const second = data.product(90_002, { stockQuantity: 7 });
  const products = [first, second];
  adminCatalogMock.seed(products);
  return { products, first, second };
}

test.use({ userRole: 'admin' });

test.describe('Admin products page', {
  tag: ['@admin-products', '@mocked'],
}, () => {
  test('lists every product in API order with its details and links', async ({
    adminProductsPage,
    adminCatalogMock,
  }) => {
    const data = new AdminDataGenerator();
    const products = [
      data.product(90_002, { price: 1299.5, stockQuantity: 0 }),
      data.product(90_001, { stockQuantity: 25 }),
      data.product(90_003, { imageUrl: null }),
    ];
    adminCatalogMock.seed(products);

    await adminProductsPage.goto();

    await adminProductsPage.expectToShowProducts(products);
    await adminProductsPage.sectionNav.expectLinks();
  });

  test('an empty catalog offers to add the first product', async ({
    adminProductsPage,
    adminCatalogMock,
  }) => {
    await adminProductsPage.goto();

    await adminCatalogMock.waitForListReads(1);
    await adminProductsPage.expectEmpty();
  });

  test('a confirmed delete removes only that product', async ({
    adminProductsPage,
    adminCatalogMock,
  }) => {
    const { products, first, second } = seedTwoProducts(adminCatalogMock);
    await adminProductsPage.goto();
    await adminProductsPage.expectToShowProducts(products);

    await adminProductsPage.deleteProduct(first.id, 'accept');

    await adminProductsPage.expectToShowProducts([second]);
    await adminCatalogMock.expectDeletedIdsToStay(
      [first.id],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    await adminCatalogMock.expectProductIds([second.id]);
    await adminProductsPage.expectDeleteConfirmationAsked();
  });

  test('a dismissed confirmation keeps the products and sends nothing', async ({
    adminProductsPage,
    adminCatalogMock,
  }) => {
    const { products, first } = seedTwoProducts(adminCatalogMock);
    await adminProductsPage.goto();
    await adminProductsPage.expectToShowProducts(products);

    await adminProductsPage.deleteProduct(first.id, 'dismiss');

    await adminProductsPage.expectDeleteConfirmationAsked();
    await adminCatalogMock.expectDeletedIdsToStay(
      [],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    await adminProductsPage.expectToShowProducts(products);
  });

  test('a pending delete locks only its button and sends one request', async ({
    adminProductsPage,
    adminCatalogMock,
  }) => {
    const { products, first, second } = seedTwoProducts(adminCatalogMock);
    const releaseDelete = adminCatalogMock.holdDeletes();
    await adminProductsPage.goto();
    await adminProductsPage.expectToShowProducts(products);

    await adminProductsPage.deleteProduct(first.id, 'accept');
    await adminProductsPage.product(first.id).expectDeleting();
    await adminProductsPage.product(second.id).expectReadyToDelete();
    await adminProductsPage.product(first.id).forceDelete();

    await adminCatalogMock.expectDeletedIdsToStay(
      [first.id],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    await adminProductsPage.product(first.id).expectDeleting();
    await adminProductsPage.expectDeleteConfirmationAsked();
    releaseDelete();
    await adminProductsPage.expectToShowProducts([second]);
  });

  test('a rejected delete alerts the admin and keeps the product', {
    tag: '@negative',
  }, async ({ adminProductsPage, adminCatalogMock, apiErrorMock }) => {
    const { products, first } = seedTwoProducts(adminCatalogMock);
    await apiErrorMock.respondWithError('productDetails', 409, {
      message: 'Product is referenced by existing orders',
    });
    await adminProductsPage.goto();
    await adminProductsPage.expectToShowProducts(products);

    await adminProductsPage.deleteProduct(first.id, 'accept');

    await adminProductsPage.expectDeleteFailureAlerted();
    await apiErrorMock.expectRequestCountToStay(
      'productDetails',
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    await adminProductsPage.expectToShowProducts(products);
    await adminCatalogMock.expectProductIds(products.map(({ id }) => id));
  });

  test('shows a loading state until the products arrive', async ({
    adminProductsPage,
    adminCatalogMock,
  }) => {
    const { products } = seedTwoProducts(adminCatalogMock);
    const releaseProducts = adminCatalogMock.holdReads();

    await adminProductsPage.goto();

    await adminProductsPage.expectStillLoading();
    releaseProducts();
    await adminProductsPage.expectToShowProducts(products);
  });

  test('a failing product list shows the load error after the retries', {
    tag: '@negative',
  }, async ({
    adminProductsPage,
    adminCatalogMock: _adminCatalogMock,
    apiErrorMock,
  }) => {
    await apiErrorMock.respondWithError('productList', 500);

    await adminProductsPage.goto();

    await adminProductsPage.expectLoadError();
    await apiErrorMock.expectRequestCountToStay(
      'productList',
      SERVER_ERROR_ATTEMPTS,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });
});

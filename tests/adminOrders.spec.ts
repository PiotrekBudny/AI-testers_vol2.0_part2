import {
  NO_MORE_REQUESTS_WINDOW_MS,
  SERVER_ERROR_ATTEMPTS,
} from '@/config/timing';
import { test } from '@/fixtures/test';
import { AdminDataGenerator } from '@/generators/adminDataGenerator';

test.use({ userRole: 'admin' });

test.describe('Admin orders', {
  tag: ['@admin-orders', '@mocked'],
}, () => {
  test('the list is paged and a status filter returns to the first page', async ({
    adminOrdersPage,
    adminOrdersMock,
  }) => {
    const data = new AdminDataGenerator();
    const firstPaid = data.order(90_001, { status: 'PAID' });
    const pending = data.order(90_002, { status: 'PENDING' });
    const shipped = data.order(90_003, { status: 'SHIPPED' });
    const secondPaid = data.order(90_004, { status: 'PAID' });
    const delivered = data.order(90_005, { status: 'DELIVERED' });
    adminOrdersMock.pageSize = 3;
    adminOrdersMock.seed([firstPaid, pending, shipped, secondPaid, delivered]);

    await adminOrdersPage.goto();

    await adminOrdersPage.expectToBeOpen();
    await adminOrdersPage.sectionNav.expectLinks();
    await adminOrdersPage.expectToShowOrders([firstPaid, pending, shipped]);
    await adminOrdersPage.expectPagination(1, 2);
    await adminOrdersMock.expectLastListQuery({
      page: 0,
      size: 10,
      status: null,
    });

    await adminOrdersPage.goToNextPage();

    await adminOrdersPage.expectToShowOrders([secondPaid, delivered]);
    await adminOrdersPage.expectPagination(2, 2);
    await adminOrdersMock.expectLastListQuery({ page: 1, status: null });

    await adminOrdersPage.filterByStatus('PAID');

    await adminOrdersPage.expectToShowOrders([firstPaid, secondPaid]);
    await adminOrdersPage.expectPagination(1, 1);
    await adminOrdersMock.expectLastListQuery({ page: 0, status: 'PAID' });
    await adminOrdersPage.expectToBeOpen();

    await adminOrdersPage.filterByStatus('ALL');

    await adminOrdersPage.expectToShowOrders([firstPaid, pending, shipped]);
    await adminOrdersPage.expectPagination(1, 2);
    await adminOrdersMock.expectLastListQuery({ page: 0, status: null });
  });

  test('a status filter without matches shows the empty state', async ({
    adminOrdersPage,
    adminOrdersMock,
  }) => {
    const order = new AdminDataGenerator().order(90_001, {
      status: 'PENDING',
    });
    adminOrdersMock.seed([order]);
    await adminOrdersPage.goto();
    await adminOrdersPage.expectToShowOrders([order]);

    await adminOrdersPage.filterByStatus('CANCELLED');

    await adminOrdersPage.expectNoOrders();
    await adminOrdersMock.expectLastListQuery({
      page: 0,
      status: 'CANCELLED',
    });
  });

  test('admin ships a pending order opened from the list', async ({
    adminOrdersPage,
    adminOrderDetailsPage,
    adminOrdersMock,
  }) => {
    const order = new AdminDataGenerator().order(90_001, {
      status: 'PENDING',
    });
    adminOrdersMock.seed([order]);
    await adminOrdersPage.goto();
    await adminOrdersPage.expectToShowOrders([order]);

    await adminOrdersPage.order(order.id).openDetails();

    await adminOrderDetailsPage.expectToShowOrder(order);
    await adminOrderDetailsPage.expectPendingOnlyActions();
    await adminOrderDetailsPage.expectNothingToUpdate('PENDING');

    await adminOrderDetailsPage.chooseStatus('SHIPPED');
    await adminOrderDetailsPage.expectReadyToUpdate('SHIPPED');
    await adminOrderDetailsPage.updateStatus();

    await adminOrderDetailsPage.expectStatusUpdateConfirmed('SHIPPED');
    await adminOrderDetailsPage.expectStatus('SHIPPED');
    await adminOrderDetailsPage.expectNoPendingOnlyActions();
    await adminOrderDetailsPage.expectNothingToUpdate('SHIPPED');
    await adminOrdersMock.expectOrderStatus(order.id, 'SHIPPED');
    await adminOrdersMock.expectStatusUpdatesToStay(
      [{ id: order.id, status: 'SHIPPED' }],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('repeated clicks while a status update is pending send one request', async ({
    adminOrderDetailsPage,
    adminOrdersMock,
  }) => {
    const order = new AdminDataGenerator().order(90_001, { status: 'PAID' });
    adminOrdersMock.seed([order]);
    const releaseUpdate = adminOrdersMock.holdUpdates();
    await adminOrderDetailsPage.open(order.id);
    await adminOrderDetailsPage.expectToShowOrder(order);
    await adminOrderDetailsPage.chooseStatus('SHIPPED');

    await adminOrderDetailsPage.updateStatus();
    await adminOrderDetailsPage.expectUpdating('SHIPPED');
    await adminOrderDetailsPage.forceUpdateStatus();

    await adminOrderDetailsPage.expectUpdating('SHIPPED');
    await adminOrderDetailsPage.expectStatus('PAID');
    await adminOrdersMock.expectStatusUpdatesToStay(
      [{ id: order.id, status: 'SHIPPED' }],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    releaseUpdate();

    await adminOrderDetailsPage.expectStatus('SHIPPED');
    await adminOrderDetailsPage.expectStatusUpdateConfirmed('SHIPPED');
    await adminOrderDetailsPage.expectNothingToUpdate('SHIPPED');
    await adminOrdersMock.expectStatusUpdates([
      { id: order.id, status: 'SHIPPED' },
    ]);
  });

  test('a rejected status change keeps the order and is not retried', {
    tag: '@negative',
  }, async ({ adminOrderDetailsPage, adminOrdersMock }) => {
    const order = new AdminDataGenerator().order(90_001, {
      status: 'DELIVERED',
    });
    adminOrdersMock.seed([order]);
    await adminOrderDetailsPage.open(order.id);
    await adminOrderDetailsPage.expectToShowOrder(order);
    await adminOrderDetailsPage.expectNoPendingOnlyActions();
    await adminOrderDetailsPage.chooseStatus('PENDING');

    await adminOrderDetailsPage.updateStatus();

    await adminOrderDetailsPage.expectStatusUpdateFailed();
    await adminOrderDetailsPage.expectStatus('DELIVERED');
    await adminOrderDetailsPage.expectReadyToUpdate('PENDING');
    await adminOrdersMock.expectStatusUpdatesToStay(
      [{ id: order.id, status: 'PENDING' }],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    await adminOrdersMock.expectOrderStatus(order.id, 'DELIVERED');
  });

  test('admin cancels a pending order only after confirming', async ({
    adminOrderDetailsPage,
    adminOrdersMock,
  }) => {
    const order = new AdminDataGenerator().order(90_001, {
      status: 'PENDING',
    });
    adminOrdersMock.seed([order]);
    await adminOrderDetailsPage.open(order.id);
    await adminOrderDetailsPage.expectToShowOrder(order);

    await adminOrderDetailsPage.askToCancel();
    await adminOrderDetailsPage.expectCancelConfirmationAsked(order.id);
    await adminOrderDetailsPage.keepOrder();

    await adminOrderDetailsPage.expectCancelDialogClosed();
    await adminOrderDetailsPage.expectStatus('PENDING');
    await adminOrdersMock.expectCancelledIdsToStay(
      [],
      NO_MORE_REQUESTS_WINDOW_MS,
    );

    await adminOrderDetailsPage.askToCancel();
    await adminOrderDetailsPage.confirmCancel();

    await adminOrderDetailsPage.expectCancellationConfirmed(order.id);
    await adminOrderDetailsPage.expectCancelDialogClosed();
    await adminOrderDetailsPage.expectStatus('CANCELLED');
    await adminOrderDetailsPage.expectNoPendingOnlyActions();
    await adminOrderDetailsPage.expectNothingToUpdate('CANCELLED');
    await adminOrdersMock.expectOrderStatus(order.id, 'CANCELLED');
    await adminOrdersMock.expectCancelledIdsToStay(
      [order.id],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    await adminOrdersMock.expectStatusUpdates([]);
  });

  test('a list that cannot be loaded shows an error', {
    tag: '@negative',
  }, async ({
    adminOrdersPage,
    adminOrdersMock: _adminOrdersMock,
    apiErrorMock,
  }) => {
    await apiErrorMock.respondWithError('adminOrders', 500);

    await adminOrdersPage.goto();

    await adminOrdersPage.expectLoadError();
    await apiErrorMock.expectRequestCountToStay(
      'adminOrders',
      SERVER_ERROR_ATTEMPTS,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });
});

import { UNKNOWN_ID } from '@/config/mockIds';
import {
  NO_MORE_REQUESTS_WINDOW_MS,
  SERVER_ERROR_ATTEMPTS,
} from '@/config/timing';
import { test } from '@/fixtures/test';
import { ShopDataGenerator } from '@/generators/shopDataGenerator';

test.use({ userRole: 'admin' });

const removal = { delta: -5, reason: 'Damaged in storage' };
const removalInput = { delta: '-5', reason: removal.reason };

function inventory() {
  const data = new ShopDataGenerator();
  const keyboard = data.inventoryItem(90_001, {
    name: 'Mechanical Keyboard',
    category: 'Computers',
    availableQuantity: 20,
  });
  const headphones = data.inventoryItem(90_002, {
    name: 'Studio Headphones',
    category: 'Audio',
    availableQuantity: 3,
    stockStatus: 'LOW_STOCK',
  });
  const speaker = data.inventoryItem(90_003, {
    name: 'Portable Speaker',
    category: 'Audio',
    availableQuantity: 0,
    stockStatus: 'OUT_OF_STOCK',
  });
  return {
    items: [keyboard, headphones, speaker],
    keyboard,
    headphones,
    speaker,
  };
}

test.describe('Admin inventory list', {
  tag: ['@admin-inventory', '@mocked'],
}, () => {
  test('filters reach the query and return the list to the first page', async ({
    adminInventoryPage,
    adminInventoryMock,
  }) => {
    const { items, keyboard, headphones, speaker } = inventory();
    adminInventoryMock.seed(items);
    adminInventoryMock.pageSize = 2;

    await adminInventoryPage.goto();

    await adminInventoryPage.expectToBeOpen();
    await adminInventoryPage.sectionNav.expectLinks();
    await adminInventoryPage.inspector.expectNoSelection();
    await adminInventoryPage.expectResultCount(3);
    await adminInventoryPage.expectItems([keyboard, headphones]);
    await adminInventoryPage.expectPage(1, 2);
    await adminInventoryMock.expectLastListQuery({
      page: 0,
      size: 20,
      search: null,
      category: null,
      status: null,
      lowStockThreshold: '5',
    });

    await adminInventoryPage.goToNextPage();

    await adminInventoryPage.expectItems([speaker]);
    await adminInventoryPage.expectPage(2, 2);
    await adminInventoryMock.expectLastListQuery({ page: 1 });

    await adminInventoryPage.search('p');

    await adminInventoryMock.expectLastListQuery({ page: 0, search: 'p' });
    await adminInventoryPage.expectItems([headphones, speaker]);
    await adminInventoryPage.expectPage(1, 1);

    await adminInventoryPage.filterByStatus('LOW_STOCK');

    await adminInventoryMock.expectLastListQuery({
      page: 0,
      search: 'p',
      status: 'LOW_STOCK',
    });
    await adminInventoryPage.expectItems([headphones]);

    await adminInventoryPage.filterByCategory('Audio');

    await adminInventoryMock.expectLastListQuery({
      page: 0,
      search: 'p',
      status: 'LOW_STOCK',
      category: 'Audio',
    });
    await adminInventoryPage.expectItems([headphones]);

    await adminInventoryPage.setLowStockThreshold(3);

    await adminInventoryMock.expectLastListQuery({
      page: 0,
      search: 'p',
      status: 'LOW_STOCK',
      category: 'Audio',
      lowStockThreshold: '3',
    });
    await adminInventoryPage.expectToBeOpen();
  });

  test('filters without matches show the empty state', async ({
    adminInventoryPage,
    adminInventoryMock,
  }) => {
    const { items } = inventory();
    adminInventoryMock.seed(items);
    await adminInventoryPage.goto();
    await adminInventoryPage.expectItems(items);

    await adminInventoryPage.search('No such product');

    await adminInventoryMock.expectLastListQuery({
      search: 'No such product',
    });
    await adminInventoryPage.expectNoMatches();
  });

  test('a list server error is shown after the retries', {
    tag: '@negative',
  }, async ({
    adminInventoryPage,
    adminInventoryMock: _adminInventoryMock,
    apiErrorMock,
  }) => {
    await apiErrorMock.respondWithError('inventoryList', 500);

    await adminInventoryPage.goto();

    await adminInventoryPage.expectListLoading();
    await adminInventoryPage.expectListError();
    await apiErrorMock.expectRequestCountToStay(
      'inventoryList',
      SERVER_ERROR_ATTEMPTS,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });
});

test.describe('Admin inventory adjustments', {
  tag: ['@admin-inventory', '@mocked'],
}, () => {
  test('admin adjusts stock twice with a new request id each time', async ({
    adminInventoryPage,
    adminInventoryMock,
  }) => {
    const { items, keyboard, headphones, speaker } = inventory();
    adminInventoryMock.seed(items);
    const restock = { delta: 3, reason: 'Found during recount' };
    const afterRemoval = { ...keyboard, availableQuantity: 15 };
    const afterRestock = { ...keyboard, availableQuantity: 18 };
    await adminInventoryPage.goto();
    await adminInventoryPage.expectItems(items);

    await adminInventoryPage.selectItem(keyboard.productId);

    await adminInventoryPage.expectItemOpen(keyboard.productId);
    await adminInventoryPage.inspector.expectToShow(keyboard);
    await adminInventoryPage.inspector.expectNoMovements();
    await adminInventoryPage.inspector.expectClearedForm();

    await adminInventoryPage.inspector.fillAdjustment(removalInput);
    await adminInventoryPage.inspector.apply();

    await adminInventoryPage.inspector.expectToShow(afterRemoval);
    await adminInventoryPage.inspector.expectMovements([{ id: 1, ...removal }]);
    await adminInventoryPage.inspector.expectClearedForm();
    await adminInventoryPage.expectItems([afterRemoval, headphones, speaker]);
    await adminInventoryMock.expectAttempts([removal]);
    await adminInventoryMock.expectAttemptsToStay(
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );

    await adminInventoryPage.inspector.fillAdjustment({
      delta: String(restock.delta),
      reason: restock.reason,
    });
    await adminInventoryPage.inspector.apply();

    await adminInventoryPage.inspector.expectToShow(afterRestock);
    await adminInventoryPage.inspector.expectMovements([
      { id: 2, ...restock },
      { id: 1, ...removal },
    ]);
    await adminInventoryPage.inspector.expectClearedForm();
    await adminInventoryPage.expectItems([afterRestock, headphones, speaker]);
    await adminInventoryMock.expectAttempts([removal, restock]);
    await adminInventoryMock.expectDistinctRequestIds(2);
    await adminInventoryMock.expectQuantity(keyboard.productId, 18);
  });

  test('repeated clicks while an adjustment is pending send one request', async ({
    adminInventoryPage,
    adminInventoryMock,
  }) => {
    const { items, keyboard } = inventory();
    adminInventoryMock.seed(items);
    const releaseAdjustment = adminInventoryMock.holdAdjustments();
    await adminInventoryPage.openItem(keyboard.productId);
    await adminInventoryPage.inspector.expectToShow(keyboard);
    await adminInventoryPage.inspector.fillAdjustment(removalInput);

    await adminInventoryPage.inspector.apply();
    await adminInventoryPage.inspector.expectApplying();
    await adminInventoryPage.inspector.forceApply();

    await adminInventoryPage.inspector.expectApplying();
    await adminInventoryMock.expectAttemptsToStay(
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    releaseAdjustment();
    await adminInventoryPage.inspector.expectToShow({
      ...keyboard,
      availableQuantity: 15,
    });
    await adminInventoryPage.inspector.expectClearedForm();
    await adminInventoryMock.expectAdjustmentMovements(keyboard.productId, 1);
  });

  test('invalid input keeps Apply disabled and sends nothing', {
    tag: '@negative',
  }, async ({ adminInventoryPage, adminInventoryMock }) => {
    const { items, keyboard } = inventory();
    adminInventoryMock.seed(items);
    const valid = { delta: '2', reason: 'Recount' };
    const invalidInputs = [
      ...['', '0', '1.5', 'abc'].map((delta) => ({ ...valid, delta })),
      ...['', '   '].map((reason) => ({ ...valid, reason })),
    ];
    await adminInventoryPage.openItem(keyboard.productId);
    await adminInventoryPage.inspector.expectToShow(keyboard);

    for (const invalid of invalidInputs) {
      await adminInventoryPage.inspector.fillAdjustment(valid);
      await adminInventoryPage.inspector.expectApplyEnabled();
      await adminInventoryPage.inspector.fillAdjustment(invalid);
      await adminInventoryPage.inspector.expectApplyDisabled();
      await adminInventoryPage.inspector.forceApply();
    }

    await adminInventoryMock.expectAttemptsToStay(
      0,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('removing more than the stock shows a conflict and changes nothing', {
    tag: '@negative',
  }, async ({ adminInventoryPage, adminInventoryMock }) => {
    const { items, headphones } = inventory();
    adminInventoryMock.seed(items);
    const input = { delta: '-4', reason: 'Written off' };
    await adminInventoryPage.openItem(headphones.productId);
    await adminInventoryPage.inspector.expectToShow(headphones);
    await adminInventoryPage.inspector.fillAdjustment(input);

    await adminInventoryPage.inspector.apply();

    await adminInventoryPage.inspector.expectConflictError(input);
    await adminInventoryPage.inspector.expectToShow(headphones);
    await adminInventoryPage.inspector.expectNoMovements();
    await adminInventoryMock.expectAttemptsToStay(
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
    await adminInventoryMock.expectQuantity(
      headphones.productId,
      headphones.availableQuantity,
    );
  });

  test('retrying after a lost reply changes the stock only once', {
    tag: ['@negative', '@network'],
  }, async ({ adminInventoryPage, adminInventoryMock }) => {
    const { items, keyboard } = inventory();
    adminInventoryMock.seed(items);
    adminInventoryMock.loseNextResponse();
    await adminInventoryPage.openItem(keyboard.productId);
    await adminInventoryPage.inspector.expectToShow(keyboard);
    await adminInventoryPage.inspector.fillAdjustment(removalInput);

    await adminInventoryPage.inspector.apply();

    await adminInventoryPage.inspector.expectGenericError(removalInput);
    await adminInventoryPage.inspector.expectToShow(keyboard);
    await adminInventoryMock.expectQuantity(keyboard.productId, 15);
    await adminInventoryMock.expectAttemptsToStay(
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );

    await adminInventoryPage.inspector.apply();

    await adminInventoryPage.inspector.expectClearedForm();
    await adminInventoryPage.inspector.expectToShow({
      ...keyboard,
      availableQuantity: 15,
    });
    await adminInventoryPage.inspector.expectMovements([{ id: 1, ...removal }]);
    await adminInventoryMock.expectAttempts([removal, removal]);
    await adminInventoryMock.expectAttemptsToShareRequestId(2);
    await adminInventoryMock.expectQuantity(keyboard.productId, 15);
    await adminInventoryMock.expectAdjustmentMovements(keyboard.productId, 1);
  });

  test('editing the delta after a lost reply conflicts with the saved one', {
    tag: ['@negative', '@network'],
  }, async ({ adminInventoryPage, adminInventoryMock }) => {
    const { items, keyboard } = inventory();
    adminInventoryMock.seed(items);
    const editedInput = { ...removalInput, delta: '-7' };
    adminInventoryMock.loseNextResponse();
    await adminInventoryPage.openItem(keyboard.productId);
    await adminInventoryPage.inspector.expectToShow(keyboard);
    await adminInventoryPage.inspector.fillAdjustment(removalInput);
    await adminInventoryPage.inspector.apply();
    await adminInventoryPage.inspector.expectGenericError(removalInput);

    await adminInventoryPage.inspector.fillAdjustment(editedInput);
    await adminInventoryPage.inspector.apply();

    await adminInventoryPage.inspector.expectConflictError(editedInput);
    await adminInventoryMock.expectAttempts([
      removal,
      { ...removal, delta: -7 },
    ]);
    await adminInventoryMock.expectAttemptsToShareRequestId(2);
    await adminInventoryMock.expectQuantity(keyboard.productId, 15);
    await adminInventoryMock.expectAdjustmentMovements(keyboard.productId, 1);
  });

  test('an unknown product id shows the detail error', {
    tag: '@negative',
  }, async ({ adminInventoryPage, adminInventoryMock }) => {
    const { items } = inventory();
    adminInventoryMock.seed(items);

    await adminInventoryPage.openItem(UNKNOWN_ID);

    await adminInventoryPage.inspector.expectUnableToLoadProduct();
    await adminInventoryPage.expectItemOpen(UNKNOWN_ID);
    await adminInventoryPage.expectItems(items);
  });
});

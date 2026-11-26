import { test } from '@/fixtures/test';

const FIRST_RETRY_DELAY_MS = 1_000;

test('client sees load error when product search returns 404', async ({
  productsPage,
  apiErrorMock,
}) => {
  await apiErrorMock.respondWithError('productSearch', 404);

  await productsPage.goto();

  await productsPage.expectLoadError();
  await apiErrorMock.expectRequestCountToStay(
    'productSearch',
    1,
    FIRST_RETRY_DELAY_MS + 500,
  );
});

test('client sees load error after retries when product search returns 500', async ({
  productsPage,
  apiErrorMock,
}) => {
  await apiErrorMock.respondWithError('productSearch', 500);

  await productsPage.goto();

  await apiErrorMock.waitForRequestCount('productSearch', 2);
  await productsPage.expectStillLoading();
  await productsPage.expectLoadError();
  await apiErrorMock.expectRequestCount('productSearch', 4);
});

test('client loads products with retry after a failed search', async ({
  productsPage,
  fakeProductSearchMock,
  apiErrorMock,
}) => {
  await apiErrorMock.respondWithError('productSearch', 404, { times: 1 });
  await productsPage.goto();
  await productsPage.expectLoadError();

  await productsPage.retryLoading();

  await productsPage.expectToShowProducts(fakeProductSearchMock.products);
});

test('client is sent to login when current user returns 401', async ({
  productsPage,
  loginPage,
  apiErrorMock,
}) => {
  await apiErrorMock.rejectSession();

  await productsPage.goto();

  await loginPage.expectToShowLoggedOutForm();
  await apiErrorMock.expectRequestCount('currentUser', 1);
  await apiErrorMock.expectRequestCount('tokenRefresh', 1);
  await apiErrorMock.expectRequestCount('logout', 0);
});

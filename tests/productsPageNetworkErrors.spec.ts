import { test } from '@/fixtures/test';
import { singleEntry } from '@/har/recording';
import type { ProductSearchResponse } from '@/models/productSearchResponse';

const SEARCH_ATTEMPTS = 4;
const NO_MORE_ATTEMPTS_WINDOW_MS = 1_500;

test('client sees load error when the connection drops', async ({
  productsPage,
  networkErrorMock,
}) => {
  await networkErrorMock.abort('productSearch', {
    errorCode: 'internetdisconnected',
  });

  await productsPage.goto();

  await networkErrorMock.waitForAbortedCount('productSearch', 1);
  await productsPage.expectStillLoading();
  await productsPage.expectLoadError();
  await networkErrorMock.expectAbortedCountToStay(
    'productSearch',
    SEARCH_ATTEMPTS,
    NO_MORE_ATTEMPTS_WINDOW_MS,
  );
});

test('client gets products after two dropped search attempts', async ({
  productsPage,
  harReplayMock,
  networkErrorMock,
}) => {
  const recording = await harReplayMock.serve('productSearch');
  const recorded = singleEntry(recording).body as ProductSearchResponse;
  await networkErrorMock.abort('productSearch', {
    times: 2,
    errorCode: 'internetdisconnected',
  });

  await productsPage.goto();

  await productsPage.expectToShowProducts(recorded.content);
  await productsPage.expectMatchCount(recorded.totalElements);
  await networkErrorMock.expectAbortedCountToStay(
    'productSearch',
    2,
    NO_MORE_ATTEMPTS_WINDOW_MS,
  );
});

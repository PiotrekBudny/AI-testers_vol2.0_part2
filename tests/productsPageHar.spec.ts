import { expect, test } from '../src/fixtures/test';
import { apiRoutes } from '../src/mocks/apiRoutes';
import type { ProductSearchResponse } from '../src/models/productSearchResponse';

const productSearchHar = 'productSearch.har';
const productSearchPath = '/api/v1/products/search';

test('client sees products replayed from the recorded HAR file', async ({
  productsPage,
  harReplayMock,
}) => {
  await harReplayMock.serve(productSearchHar, apiRoutes.productSearch);
  const searchResponse = harReplayMock.waitForReplayedResponse(
    'GET',
    productSearchPath,
  );

  await productsPage.goto();

  const response = await searchResponse;
  await harReplayMock.expectMatchesRecording(productSearchHar, response);
  const body = (await response.json()) as ProductSearchResponse;
  await productsPage.expectToShowProducts(body.content);
  await expect(productsPage.texts.countSummary).toContainText(
    String(body.totalElements),
  );
});

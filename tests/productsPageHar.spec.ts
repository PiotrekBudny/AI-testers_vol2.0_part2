import { test } from '@/fixtures/test';
import { singleEntry } from '@/har/recording';
import type { ProductSearchResponse } from '@/models/productSearchResponse';

test.describe('Products page HAR replay', {
  tag: ['@products', '@mocked', '@har'],
}, () => {
  test('client sees products replayed from the recorded search', async ({
    productsPage,
    harReplayMock,
  }) => {
    const recording = await harReplayMock.serve('productSearch');
    const entry = singleEntry(recording);
    const searchResponse = harReplayMock.waitForReplayedResponse(
      entry.method,
      entry.url,
    );

    await productsPage.goto();

    const response = await searchResponse;
    await harReplayMock.expectMatchesRecording(recording, response);
    const body = entry.body as ProductSearchResponse;
    await productsPage.expectToShowProducts(body.content);
    await productsPage.expectMatchCount(body.totalElements);
  });
});

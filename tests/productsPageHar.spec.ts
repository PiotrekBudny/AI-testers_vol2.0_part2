import { expect, test } from '../src/fixtures/test';
import { ProductSearchMock } from '../src/mocks/productSearchMock';
import type { ProductSearchResponse } from '../src/models/productSearchResponse';

const productSearchHar = 'productSearch.har';
const productSearchPath = '/api/v1/products/search';

test('client sees products replayed from the recorded HAR file', async ({
  page,
  productsPage,
  harMock,
}) => {
  await harMock.serve(productSearchHar, ProductSearchMock.urlPattern);
  const searchResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === productSearchPath,
  );

  await productsPage.goto();

  const response = await searchResponse;
  await harMock.expectMatchesRecording(productSearchHar, response);
  const body = (await response.json()) as ProductSearchResponse;
  await productsPage.expectToShowProducts(body.content);
  await expect(productsPage.texts.countSummary).toContainText(
    String(body.totalElements),
  );
});

test('client sees real products with the first one patched to sold out', async ({
  productsPage,
  productSearchLiveMock,
}) => {
  const patchedName = 'Patched real product';
  await productSearchLiveMock.register((realResponse) => {
    const [first, ...rest] = realResponse.content;
    if (!first) {
      throw new Error('The real search returned no products to patch');
    }
    return {
      ...realResponse,
      content: [{ ...first, name: patchedName, stockQuantity: 0 }, ...rest],
    };
  });

  await productsPage.goto();

  await expect(productsPage.productItems.first()).toBeVisible();
  const served = productSearchLiveMock.lastServed();
  await productsPage.expectToShowProducts(served.content);
  await expect(productsPage.productAt(0).texts.name).toHaveText(patchedName);
  const [realFirst] = productSearchLiveMock.realResponses[0]?.content ?? [];
  expect(realFirst?.name).not.toBe(patchedName);
  expect(served.content.slice(1)).toEqual(
    productSearchLiveMock.realResponses[0]?.content.slice(1),
  );
});

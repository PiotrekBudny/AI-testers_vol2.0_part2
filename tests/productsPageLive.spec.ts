import { expect, test } from '../src/fixtures/test';
import type { ProductSearchResponse } from '../src/models/productSearchResponse';

test('client sees the products the real search API returns', async ({
  page,
  productsPage,
}) => {
  const searchResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/v1/products/search',
  );

  await productsPage.goto();

  const response = await searchResponse;
  expect(response.status()).toBe(200);
  const body = (await response.json()) as ProductSearchResponse;
  expect(body.content.length).toBeGreaterThan(0);
  await productsPage.expectToShowProducts(body.content);
  await expect(productsPage.texts.countSummary).toContainText(
    String(body.totalElements),
  );
});

import { test } from '@/fixtures/test';

test('client sees the products the real search API returns', async ({
  productsPage,
  productSearchTraffic,
}) => {
  await productsPage.goto();

  const body = await productSearchTraffic.expectOkWithProducts();
  await productsPage.expectToShowProducts(body.content);
  await productsPage.expectMatchCount(body.totalElements);
});

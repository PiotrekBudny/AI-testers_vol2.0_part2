import { test } from '@/fixtures/test';

test.describe('Products page on patched live data', {
  tag: ['@products', '@live'],
}, () => {
  test('client sees real products with the first one patched to sold out', async ({
    productsPage,
    livePatchedProductSearchMock,
  }) => {
    await livePatchedProductSearchMock.patchFirstProduct({
      name: 'Patched real product',
      stockQuantity: 0,
    });

    await productsPage.goto();

    await productsPage.productItems.first().waitFor();
    await livePatchedProductSearchMock.expectServedWithoutErrors(1);
    livePatchedProductSearchMock.expectOnlyFirstProductPatched();
    await productsPage.expectToShowProducts(
      livePatchedProductSearchMock.lastServed().content,
    );
  });
});

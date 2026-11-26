import { test } from '@/fixtures/test';

test.describe('Product details page on patched live data', {
  tag: ['@product-details', '@live'],
}, () => {
  test('client cannot add a real product patched to out of stock', async ({
    productsPage,
    productDetailsPage,
    productSearchTraffic,
    livePatchedProductDetailsMock,
  }) => {
    await productsPage.goto();
    const realProduct = await productSearchTraffic.expectAnInStockProduct();
    await livePatchedProductDetailsMock.patchStockQuantity(0);

    await productDetailsPage.open(realProduct);

    await livePatchedProductDetailsMock.expectServedWithoutErrors(1);
    livePatchedProductDetailsMock.expectOnlyStockQuantityPatched(0);
    await productDetailsPage.expectToShowProduct(
      livePatchedProductDetailsMock.lastServed(),
    );
  });
});
